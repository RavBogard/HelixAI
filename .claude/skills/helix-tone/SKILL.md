---
name: helix-tone
description: Build a Line 6 Helix LT or POD Go preset from a description of a sound ("something U2-like with a wah", "Hendrix-ish", "Fender amp, filters, funky for David's Jazzmaster"). Use for any request to make, change, fix or explain a Helix LT or POD Go tone, to read a .hlx/.pgp/.hls file, or to say which models and settings suit a player or song.
---

# Building a tone

You write a **tone spec** (a small JSON file); `helixtone` turns it into the
preset file. You never write preset JSON by hand, and you never write a model
id or control name from memory: both come from the catalog, which is the
editors' own model database.

Run everything from the repository root with `python -m helixtone`.

## The loop

1. **Read the rig.** `rig/rig.md` says who plays what into what, and
   `rig/taste.md` records what they liked and rejected before. Both change what
   you build. If the request names a player (Daniel → Helix LT, David → POD Go)
   use their device; if it is unclear which device, ask.
2. **Work out the real gear.** For an artist or song, name the amp, the
   speakers, and the pedals in order, as that player used them. Say which parts
   you are sure of and which are a reasonable stand-in. If you can search the
   web, check rather than recall.
3. **Find the models.** `helixtone search <words> [-d pod_go] [-c amp]`
   matches names and the gear each model is based on ("fender deluxe",
   "mu-tron", "klon"). Search the device you are building for: the POD Go has
   fewer models and different ids.
4. **Read each model before setting it.** `helixtone show <model> [-d pod_go]`
   prints every control with its range and default, and how Line 6 set that
   model in its own factory presets. Start from a factory setting that suits
   the sound and move only what you have a reason to move. Controls you leave
   out keep the model's default.
5. **Write the spec** in `tones/<player>-<device>/<name>.json`. The format is
   documented at the top of `helixtone/spec.py`; the files already in `tones/`
   are worked examples.
6. **Build.** `helixtone build <spec>` validates, prints the layout with DSP
   use, and writes the `.hlx` or `.pgp` next to the spec. If it refuses, it
   lists every problem by name; fix the spec, do not work around the check.
7. **Hand it over** with: the file path, what each snapshot and footswitch
   does, any note the build printed, and what you were unsure about.
8. **Take feedback and record it.** When the player says what is wrong ("too
   fizzy", "the wah is nasal"), change the spec, rebuild, and add one line to
   `rig/taste.md` saying what was changed and why. That file is how the next
   tone starts closer.

## Rules that are not negotiable

- **Never invent a model id, a control name or a value range.** If `search`
  does not find it, it is not on the device; say so and offer the nearest thing.
- **Values are in the file's units, not the knob's.** Most knobs are 0..1 for
  0..10 on the device; `show` says which unit each control uses.
- **Nothing here has been heard.** No tool in this repository can listen. A
  new preset is a first draft from knowledge and factory settings; say that
  plainly, and never describe how it sounds as fact.
- **Loading is verified by format, not by device, until someone loads it.**
  The builder reproduces 93 Line 6 factory presets and 52 real POD Go presets
  block for block, which is strong evidence and not proof. The first time a
  kind of preset goes onto a unit, ask the player to confirm it loaded and say
  so in `rig/taste.md`.
- **Do not commit other people's presets.** A player's own exports go in
  `reference/` (git-ignored contents are fine to read, not to publish).

## Things the builder does for you

- Puts blocks on the Helix's two processors by DSP cost, in order, and refuses
  a chain that cannot fit, naming the heaviest blocks.
- Adds the POD Go's built-in blocks (volume, wah, FX loop, EQ) when the spec
  leaves them out, and holds the chain to the four free effect blocks.
- Wah goes on EXP 1 and volume on EXP 2, both on the pedal's toe switch,
  unless the spec says otherwise.
- On the Helix, effects with a mono and a stereo version are mono before the
  amp and stereo after the cab unless the spec says otherwise.
- The preset loads in snapshot 1, so the blocks start in that snapshot's state.

## Tone craft, briefly

Read `references/craft.md` before designing a chain. The short version:

- **Gain comes from the amp first.** Pick the amp for the sound, set its drive
  for the loudest clean or the base crunch, then add a pedal for the step up.
- **Level-match snapshots by intent.** A lead should be a little louder, a
  clean should not vanish. Use the amp's `ChVol` (channel volume: level only,
  no tone change) to trim. This is by reasoning until we can measure.
- **Cut the cab.** High cut around 8–10 kHz and low cut around 80–100 Hz is
  the usual starting point through full-range speakers.
- **Time effects after the cab, in stereo; drives, wah and compressor before
  the amp.** Uni-Vibe and phaser before the amp for vintage sounds.
- **Tempo-synced delays:** set `Time` in seconds from the tempo
  (quarter = 60/bpm, dotted eighth = 0.75 × that, eighth = 0.5 ×) and leave
  `TempoSync1` false. The note-division index table has not been confirmed.

## Reading existing presets

`helixtone inspect <file>` shows a `.hlx`, `.pgp` or `.hls` setlist as a block
list with what differs from default. `--spec` prints it as a spec to edit;
`-d pod_go` retargets it. Use this to learn from a preset the player already
likes, or to move a Helix tone to the POD Go: retargeting keeps what exists on
the other device and tells you what does not.

## Not built yet

Parallel paths, dual cabs, impulse responses, the Helix's send/return blocks,
command switches, momentary switches, and measuring audio (see
`tools/native_probe.py` for the first step toward that). If a tone needs one of
these, say so rather than approximating silently.
