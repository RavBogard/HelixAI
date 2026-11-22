---
name: helix-tone
description: Build a Line 6 Helix LT or POD Go preset from a description of a sound ("something U2-like with a wah", "Hendrix-ish", "Fender amp, filters, funky for David's Jazzmaster"). Use for any request to make, change, fix or explain a Helix LT or POD Go tone, to read a .hlx/.pgp/.hls file, or to say which models and settings suit a player or song.
---

# Building a tone

You write a **tone spec** (a small JSON file); `helixtone` turns it into the
preset file. You never write preset JSON by hand, and you never write a model
id or control name from memory: both come from the catalog, which is the
editors' own model database.

Run everything from the repository root with `python -m helixtone`. On
Daniel's PC the repository is `C:\Users\dsbog\HelixAI`, and this skill is
linked into his user skills folder, so it can be invoked from any folder:
change to the repository first. All paths below are relative to it.

## The loop

1. **Read the rig.** `rig/rig.md` says who plays what into what, and
   `rig/taste.md` records what they liked and rejected before. Both change what
   you build. If the request names a player (Daniel → Helix LT, David → POD Go)
   use their device; if it is unclear which device, ask. `rig/players.json`
   holds each player's layout as data (snapshot roles and order, which switch
   holds which kind of effect, whether stomps stay put, level): build to it.
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
7. **Hand it over** with: the file path, the sheet (`<name>.md`, written by
   `helixtone check`), any note the build printed, and what you were unsure
   about.
8. **Take feedback and record it.** When the player says what is wrong ("too
   fizzy", "the wah is nasal"), change the spec, rebuild, and add one line to
   `rig/taste.md` saying what was changed and why. That file is how the next
   tone starts closer.

## Working without the player in the room

The aim is to hand over a preset that is already close, not to make the player
sit through every adjustment. What can be done unattended, and what cannot:

- **Check `rig/rig.md` for whether the Helix Native loop is working.** If it
  is not, the first job on a machine that has Helix Native is
  `references/native-setup.md`. Until then every preset is an unmeasured draft.
- **With a working renderer**, after building any tone:
  1. `helixtone tune measure <spec>` and read the numbers. A snapshot that
     clips, or is far louder or quieter than the rest, is a defect: fix it.
  2. `helixtone tune level <spec> --write`. The level and the snapshots
     meant to be louder come from `rig/players.json` for the folder the spec
     is in; `--level` and `--offset "<name>=2"` override. Every tone, every time.
  3. `helixtone tune stomps <spec> --write` sets each drive stomp's own level
     so that stepping on it lifts the Crunch snapshot by 1.5 dB, then level
     again (step 2), since the two interact slightly.
  4. `helixtone check <spec>`. It reads the player's layout, renders every
     snapshot and every stomp on and off, and writes the one-page sheet
     (`<name>.md`) beside the preset. Fix every DEFECT. Read every NOTE and
     either fix it or say in the spec's notes why it is on purpose. Run it
     last, so the sheet describes the preset as handed over.
  A POD Go tone goes through the same steps: it is measured as the same chain
  on a Helix. Say so when reporting its levels.
  5. If there is a recording to aim at (an isolated guitar part, or a preset
     the player already likes rendered through the same input),
     `helixtone tune match <spec> --ref <wav> --write` moves the amp and cab
     controls toward its balance. Read what it moved: a control driven to its
     limit means the amp or cab choice is wrong, not the setting.
- **Choosing models by measurement.** `atlas/helix-native.json` holds what
  every amp (at three drive settings), cab and drive pedal measures like
  through Helix Native. `helixtone atlas gain` lists amps from cleanest to
  most saturated; `helixtone atlas nearest <wav>` lists the amp and cab pairs
  closest to a recording. Use it instead of guessing which amp is bright or
  how much gain a setting is. After a Helix Native update, or if the file is
  missing, `helixtone atlas measure` rebuilds it (about an hour, unattended).
- **From a recording with nobody listening.**
  `helixtone auto <wav> tones/<player>/<name>.json` shortlists pairs from the
  atlas, renders them, tunes the best toward the recording and writes the
  spec and preset. It gives an amp and a cab only: add the effects, snapshots
  and switches the tone needs, then measure and level as above.
- **Changing the loop itself.** `helixtone bench --label "<what changed>"`
  hides presets, lets the loop match them from audio alone and appends the
  score to `atlas/bench.jsonl`. A change to the atlas, the shortlist or the
  search stays only if the score there improves.
- **Never keep numbers from the stand-in renderer** (`-r sim`). It exists to
  test the tuning code.
- **A closer measurement is not a better tone.** Matching balance and dynamics
  gets a preset into the right neighbourhood. Feel, the way an amp cleans up,
  and whether the player likes it are theirs to judge.
- **Record everything.** `helixtone note <spec> --verdict keep|change|reject
  "<what they said>"` after any feedback, and `--verdict loaded` or `failed`
  after a first import. `helixtone history` shows what has been tried;
  `helixtone learn reference` shows what the player's own presets favour. Read
  both before designing a new tone.

## Rules that are not negotiable

- **Never invent a model id, a control name or a value range.** If `search`
  does not find it, it is not on the device; say so and offer the nearest thing.
- **Values are in the file's units, not the knob's.** Most knobs are 0..1 for
  0..10 on the device; `show` says which unit each control uses.
- **Say what a preset has and has not been through.** Unmeasured: a first
  draft from knowledge and factory settings. Measured: say what was measured
  and with which renderer. Never describe how something sounds as fact; no
  measurement here hears the way a person does.
- **Loading is verified by format, not by device, until someone loads it.**
  The builder reproduces 185 Line 6 factory presets (44 with parallel paths,
  57 with dual cabs) and 52 real POD Go presets block for block, which is
  strong evidence and not proof. The first time a
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
  no tone change) to trim, by measurement (`tune level`).
- **Cut the cab.** High cut 6.5–8 kHz and low cut 80–100 Hz in the cab block
  is the starting point through full-range speakers (the cab block's cut is
  gentle: 8 kHz there is 3 dB down at 8 kHz). For a darker or fuller sound
  change the mic or its position before reaching for EQ; a 57 with a 121
  ribbon as a dual cab adds about 2 dB of body below 1 kHz.
- **Time effects after the cab, in stereo; drives, wah and compressor before
  the amp.** Uni-Vibe and phaser before the amp for vintage sounds.
- **Delays that follow tap tempo:** set `"TempoSync1": true` and
  `"SyncSelect1"` to the note value by name (`"1/8 Dotted"`, `"1/4"`). For a
  fixed time instead, leave sync off and set `Time` in seconds.
- **Named choices:** any control `show` lists as "one of: ..." takes the name
  (`"Mic": "121 Ribbon"`, `"Ratio": "4:1"`) or its number.

## Richer layouts (Helix LT only)

Use these when the sound calls for them, not by default: each costs DSP and
makes the preset harder to adjust.

- **Dual cab:** add `"dual": {"model": ..., "params": {...}}` to a cab block
  to blend two cabs or two mics (a 57 with a ribbon is the classic pair). Use
  `Pan` on each half to spread them or keep both at 0.5.
- **Parallel paths:** a chain entry `{"split": "y", "a": [...], "b": [...],
  "join": {...}}` runs two paths side by side and joins them again: two amps,
  or a dry path beside a wet one. `"ab"` sends everything to one side
  (`RouteTo`), `"crossover"` splits by frequency. One split per processor.
  Balance the two sides with the join's `A Level` and `B Level`.
- **A stomp that stays put:** `"stays": true` on a block makes snapshots
  leave its on/off state alone (Daniel's layout requires it on every switched
  block). A snapshot cannot then list it under `on` or `off`; give the
  snapshot its own unswitched block instead. Seen in one real preset (an HX
  Stomp file), not yet confirmed on the LT: ask the player to check that a
  stomp survives a snapshot change the first time.
- **Momentary switch:** `"footswitch": {"switch": 9, "momentary": true}` for
  an effect that is on only while the switch is held.
- **Several controls on the pedal:** `"pedal"` takes a list of assignments.
- **Volume pedal:** add a `Volume` block and it goes on EXP 2 with the wah on
  EXP 1; the toe switch swaps which one is active.

## Reading existing presets

`helixtone inspect <file>` shows a `.hlx`, `.pgp` or `.hls` setlist as a block
list with what differs from default. `--spec` prints it as a spec to edit;
`-d pod_go` retargets it. Use this to learn from a preset the player already
likes, or to move a Helix tone to the POD Go: retargeting keeps what exists on
the other device and tells you what does not.

## Not built yet

Impulse responses, the Helix's send/return blocks, command switches, paths
with their own input or output (a second instrument), more than one split per
processor. If a tone needs one of these, say so rather than approximating
silently.
