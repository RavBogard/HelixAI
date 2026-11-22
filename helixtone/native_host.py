"""A helper process that makes Helix Native load a .hlx file, and hands back the plugin state.

Helix Native keeps its preset inside its saved state in a form that is not
.hlx (see .claude/skills/helix-tone/references/native-setup.md). The only
thing that turns a .hlx into that form is the plugin's own importer, which is
reachable only from its window. So this process opens the window, invisible
and unable to take the keyboard (see keep_out_of_sight), and works it with
window messages (never the real mouse or keyboard):

    select the scratch slot (Factory 1, 01A) -> IMPORT -> file dialog -> Yes
    -> EXPORT the slot again, so the caller can check what the plugin took
    -> double-click the slot to load it -> read the plugin state

The scratch slot's library files are put back when the process ends.

Protocol: one JSON object per line on stdin, one per line on stdout.
    {"cmd": "load", "hlx": <path>, "state": <path to write>, "export": <path to write>}
    {"cmd": "quit"}
Windows only. Needs pedalboard and pywin32.
"""
from __future__ import annotations

import ctypes
import json
import os
import shutil
import sys
import threading
import time

# Positions inside the plugin's view at its default size (1034 x 656), established on
# Helix Native 3.82. `ready` checks the size and refuses anything else.
VIEW = (1034, 656)
SLOT = (92, 140)          # first row of the preset list (01A)
OTHER_SLOT = (92, 161)    # second row (01B), loaded first so a load is always a change
IMPORT = (161, 114)
EXPORT = (204, 114)
LIBRARY = os.path.expandvars(r"%APPDATA%\Line 6\Helix Native\#PRESET_LIBRARY\#SETLIST0")
SCRATCH_FILES = ("#PRESET000", ".nodes")


def keep_out_of_sight():
    """Make every window this thread creates invisible and unable to take the keyboard.

    A hook on the thread sees each window as it is created and as it asks to
    become the active window. Top-level windows are cloaked (Windows still
    treats them as shown, so the plugin and its dialogs behave normally, but
    nothing is drawn on screen) and activation is refused, so whoever is using
    the computer keeps typing into their own window. A desktop of its own would
    be simpler, but the plugin's file dialogs never open on one.
    Returns the hook objects, which must be kept alive.
    """
    from ctypes import wintypes
    user32, dwmapi, kernel32 = ctypes.windll.user32, ctypes.windll.dwmapi, ctypes.windll.kernel32
    HCBT_CREATEWND, HCBT_ACTIVATE, WH_CBT, DWMWA_CLOAK, GA_ROOT = 3, 5, 5, 13, 2
    user32.CallNextHookEx.argtypes = [ctypes.c_void_p, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
    user32.CallNextHookEx.restype = ctypes.c_ssize_t
    user32.GetAncestor.argtypes = [wintypes.HWND, ctypes.c_uint]
    user32.GetAncestor.restype = wintypes.HWND
    on = ctypes.c_int(1)

    def cloak(hwnd):
        dwmapi.DwmSetWindowAttribute(wintypes.HWND(hwnd), DWMWA_CLOAK, ctypes.byref(on), ctypes.sizeof(on))

    @ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
    def hook(code, wparam, lparam):
        if code == HCBT_CREATEWND:
            cloak(wparam)                      # does nothing for a child window
        elif code == HCBT_ACTIVATE:
            cloak(user32.GetAncestor(wparam, GA_ROOT) or wparam)
            return 1                           # refuse: do not take the keyboard
        return user32.CallNextHookEx(None, code, wparam, lparam)

    user32.SetWindowsHookExW.restype = ctypes.c_void_p
    user32.SetWindowsHookExW.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD]
    handle = user32.SetWindowsHookExW(WH_CBT, hook, None, kernel32.GetCurrentThreadId())
    if not handle:
        raise RuntimeError("could not install the window hook")
    return handle, hook


def reply(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


class Host:
    def __init__(self, vst: str, show: bool):
        self.hook = None if show else keep_out_of_sight()    # before anything on this thread makes a window
        import win32api, win32con, win32gui, win32process
        from pedalboard import load_plugin
        self.api, self.con, self.gui, self.proc = win32api, win32con, win32gui, win32process
        ctypes.windll.user32.SetProcessDPIAware()
        self.show = show
        self.plugin = load_plugin(vst)
        self.done = threading.Event()
        self.backup = {}
        for name in SCRATCH_FILES:
            path = os.path.join(LIBRARY, name)
            if os.path.exists(path):
                with open(path, "rb") as fh:
                    self.backup[name] = fh.read()

    # -- windows ---------------------------------------------------------
    def top_windows(self):
        out = []

        def each(h, _):
            if self.gui.IsWindowVisible(h) and self.proc.GetWindowThreadProcessId(h)[1] == os.getpid():
                out.append((h, self.gui.GetWindowText(h), self.gui.GetClassName(h)))
        self.gui.EnumWindows(each, None)
        return out

    def view(self):
        """The plugin's own child window, or None while it is not there yet."""
        for h, title, cls in self.top_windows():
            if cls.startswith("JUCE_"):
                kids = []
                self.gui.EnumChildWindows(h, lambda c, _: kids.append(c), None)
                for c in kids:
                    if self.gui.GetClassName(c).startswith("XGWINDOW"):
                        return h, c
        return None

    def dialogs(self):
        return [(h, title) for h, title, cls in self.top_windows() if cls == "#32770"]

    def dialog_parts(self, h):
        parts = []
        self.gui.EnumChildWindows(h, lambda c, _: parts.append(
            (c, self.gui.GetClassName(c), self.gui.GetWindowText(c), self.gui.GetDlgCtrlID(c))), None)
        return parts

    def click(self, xy, double=False):
        _, view = self.view()
        lp = self.api.MAKELONG(*xy)
        c = self.con
        self.gui.PostMessage(view, c.WM_MOUSEMOVE, 0, lp)
        time.sleep(0.08)
        self.gui.PostMessage(view, c.WM_LBUTTONDOWN, c.MK_LBUTTON, lp)
        time.sleep(0.04)
        self.gui.PostMessage(view, c.WM_LBUTTONUP, 0, lp)
        if double:
            time.sleep(0.08)
            self.gui.PostMessage(view, c.WM_LBUTTONDBLCLK, c.MK_LBUTTON, lp)
            time.sleep(0.04)
            self.gui.PostMessage(view, c.WM_LBUTTONUP, 0, lp)

    def wait(self, test, seconds, what):
        end = time.time() + seconds
        while time.time() < end:
            got = test()
            if got:
                return got
            time.sleep(0.1)
        raise RuntimeError(f"timed out waiting for {what}")

    # -- the plugin's own dialogs ------------------------------------------
    def file_dialog(self, path: str):
        """Fill in the file dialog that is open and accept it."""
        h, title = self.wait(lambda: next(iter(self.dialogs()), None), 10, "the file dialog")
        edit = self.wait(lambda: next((p[0] for p in self.dialog_parts(h) if p[1] == "Edit"), None), 5, "the file name box")
        time.sleep(0.5)
        self.gui.SetWindowPos(h, 0, -32000, -32000, 0, 0, self.con.SWP_NOSIZE | self.con.SWP_NOZORDER | self.con.SWP_NOACTIVATE)
        self.gui.SendMessage(edit, self.con.WM_SETTEXT, 0, path)
        time.sleep(0.2)
        self.gui.PostMessage(h, self.con.WM_COMMAND, 1, 0)
        self.wait(lambda: not self.gui.IsWindow(h), 10, f"'{title}' to close")

    def answer(self, expect: str, button: str, seconds: float = 4.0, required: bool = True):
        """Press `button` on a message box whose text contains `expect`. Any other box is an error."""
        end = time.time() + seconds
        while time.time() < end:
            for h, title in self.dialogs():
                parts = self.dialog_parts(h)
                text = " ".join(p[2] for p in parts if p[1] == "Static" and p[2])
                if not text:
                    continue
                if expect.lower() not in text.lower():
                    self.gui.PostMessage(h, self.con.WM_CLOSE, 0, 0)
                    raise RuntimeError(f"Helix Native said: {text}")
                for c, cls, label, cid in parts:
                    if cls == "Button" and label.replace("&", "").lower() == button.lower():
                        self.gui.PostMessage(h, self.con.WM_COMMAND, cid, c)
                        self.wait(lambda: not self.gui.IsWindow(h), 5, "the message box to close")
                        return True
            time.sleep(0.1)
        if required:
            raise RuntimeError(f"Helix Native did not ask '{expect}'")
        return False

    def unexpected_dialog(self):
        for h, title in self.dialogs():
            text = " ".join(p[2] for p in self.dialog_parts(h) if p[1] == "Static" and p[2])
            self.gui.PostMessage(h, self.con.WM_CLOSE, 0, 0)
            raise RuntimeError(f"Helix Native said: {text or title}")

    # -- commands ------------------------------------------------------------
    def ready(self):
        frame, view = self.wait(self.view, 30, "the plugin window")
        if not self.show:
            self.gui.SetWindowPos(frame, 0, -32000, -32000, 0, 0, self.con.SWP_NOSIZE | self.con.SWP_NOZORDER | self.con.SWP_NOACTIVATE)

        def editor_up():
            l, t, r, b = self.gui.GetClientRect(self.view()[1])
            return (r - l, b - t) == VIEW
        try:
            self.wait(editor_up, 60, "the editor")
        except RuntimeError:
            l, t, r, b = self.gui.GetClientRect(self.view()[1])
            raise RuntimeError(
                f"Helix Native's editor did not open (its view is {r - l}x{b - t}, the editor is {VIEW[0]}x{VIEW[1]}). "
                "It is probably signed out or this computer is not authorised: open it once and sign in.")
        time.sleep(1.5)

    def state_settled(self, differs_from: bytes | None = None) -> bytes:
        last, same = None, 0
        end = time.time() + 15
        while time.time() < end:
            s = self.plugin.raw_state
            if s == last and (differs_from is None or s != differs_from):
                same += 1
                if same >= 3:
                    return s
            else:
                same = 0
            last = s
            time.sleep(0.15)
        raise RuntimeError("the plugin state did not change after loading the preset")

    def load(self, hlx: str, state_path: str, export_path: str) -> dict:
        hlx, state_path, export_path = (os.path.abspath(p) for p in (hlx, state_path, export_path))
        # 1. Put a different preset in the edit buffer, so that step 4 is always a visible change.
        self.click(OTHER_SLOT, double=True)
        before = self.state_settled()
        # 2. Import the file into the scratch slot.
        self.click(SLOT)
        time.sleep(0.3)
        self.click(IMPORT)
        self.file_dialog(hlx)
        self.answer("overwrite", "Yes")
        time.sleep(0.6)
        self.unexpected_dialog()
        # 3. Export the slot, so the caller can compare it with what it sent.
        if os.path.exists(export_path):
            os.remove(export_path)
        self.click(SLOT)
        time.sleep(0.3)
        self.click(EXPORT)
        self.file_dialog(export_path)
        self.answer("", "Yes", seconds=1.0, required=False)
        self.wait(lambda: os.path.exists(export_path) and os.path.getsize(export_path) > 0, 10, "the exported preset")
        # 4. Load the slot and read the state.
        self.click(SLOT, double=True)
        state = self.state_settled(differs_from=before)
        self.unexpected_dialog()
        with open(state_path, "wb") as fh:
            fh.write(state)
        return {"ok": True}

    def restore_library(self):
        for name, data in self.backup.items():
            try:
                with open(os.path.join(LIBRARY, name), "wb") as fh:
                    fh.write(data)
            except OSError:
                pass

    def serve(self):
        try:
            self.ready()
            reply({"ok": True, "ready": True})
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                msg = json.loads(line)
                if msg.get("cmd") == "quit":
                    break
                try:
                    reply(self.load(msg["hlx"], msg["state"], msg["export"]))
                except Exception as exc:  # report and keep serving
                    reply({"ok": False, "error": str(exc)})
        except Exception as exc:
            reply({"ok": False, "error": str(exc)})
        finally:
            self.done.set()

    def give_back_focus(self):
        """Windows makes a new dialog the foreground window whatever the hook says. Hand the foreground
        straight back to the window that had it, so at most a keystroke goes astray."""
        theirs = None
        while not self.done.is_set():
            try:
                fg = self.gui.GetForegroundWindow()
                if fg and self.proc.GetWindowThreadProcessId(fg)[1] != os.getpid():
                    theirs = fg
                elif fg and theirs and self.gui.IsWindow(theirs):
                    self.gui.SetForegroundWindow(theirs)
            except Exception:
                pass
            time.sleep(0.005)

    def run(self):
        threading.Thread(target=self.serve, daemon=True).start()
        if not self.show:
            threading.Thread(target=self.give_back_focus, daemon=True).start()
        try:
            self.plugin.show_editor(self.done)
        finally:
            if self.hook:
                ctypes.windll.user32.UnhookWindowsHookEx(ctypes.c_void_p(self.hook[0]))
            del self.plugin
            self.restore_library()


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python -m helixtone.native_host <Helix Native.vst3> [--show]", file=sys.stderr)
        return 2
    Host(sys.argv[1], "--show" in sys.argv[2:]).run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
