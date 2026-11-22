# How players organise Helix LT and POD Go presets for live use

Research date 2026-11-22. Web research only; nothing here was measured.

## Source quality, read this first

- **Primary and solid:** the Helix LT 3.0 owner's manual, the POD Go 2.0 owner's
  manual and the Powercab Plus manual. I downloaded the PDFs and read the text.
  - LT: https://jp.line6.com/data/6/0a020a41edfe64823e79e9cdc/application/pdf/Helix%20LT%203.0%20Owner's%20Manual%20-%20English%20.pdf
  - POD Go: https://jp.line6.com/data/6/0a00050b25196643a3b67f821/application/pdf/POD%20Go%202.0%20Owner's%20Manual%20-%20English%20.pdf
  - Powercab: https://jam.ua/files/files/Powercab%20Manual%20-%20English%20.pdf
  - The Helix Stadium online manual (manuals.line6.com/en/helix-stadium/live/...) was
    used only where it matches the LT manual. It is a different product.
- **Line 6 forum:** almost all of the practice below is working players on the
  Line 6 Helix forum (line6.com/support). Posters with a "Line 6 Expert" badge
  (silverhead, phil_m) are community experts, not confirmed employees. The one staff
  handle I could find is `Digital_Igloo`, in thread 28346 (see Q1). Where I say
  "staff" it is only that handle, and I could not verify the badge from the page.
- **Not reached:** I found no usable text for Jason Sadites, Worship Tutorials,
  Steve Sterlacci, John Nathan Cordy, Rhett Shull or Pete Thorn. Their material is
  mostly YouTube video and paid presets, and search returned only store listings
  and an unrelated Fractal page. **Unconfirmed: nothing below is attributed to
  them.** The only Sadites item is a second-hand forum summary (Q3). No Ben Adrian or
  Eric Klein statement on live level or snapshot practice turned up. Klein's
  playback article is used in Q4.
- **Third-party guides** (komposition101, MatchPatch) are labelled as such.
- Forum figures are one person's taste unless several posters agree. I say so.

## 1. Snapshots, stomps and separate presets

**What the manual says (LT 3.0, pp. 47ff; POD Go 2.0, "Snapshots").**
- LT has 8 snapshots per preset, POD Go has 4. "Snapshots are presets within a
  preset." A snapshot stores block bypass states (not the Looper), parameters
  assigned to the Snapshots controller (max 64 per preset), Command Center values,
  and tempo only if Tempo Select is "Per Snapshot" (default "Per Preset").
- Snapshots cannot change the amp or effect models or rearrange blocks. Both
  models must exist in the preset and be switched on or off.
- Snapshot switching is instant. Switching presets "can result in a small audible
  gap" (LT manual, True Preset Spillover). Joe Gore, Line 6 blog:
  "snapshot switching is instantaneous", and delay and reverb tails continue
  (https://blog.line6.com/?p=2631).
- Manual tip: snapshots map naturally to song sections (Intro, Verse 1, Chorus).
  Name them (max 10 characters).

**Division of labour, as the forum states it.** amsdenj (forum Mentor), thread
43996: "patches for songs, snapshots for sections of songs, and foot switches for
changing things within the section." Snapshots suit big multi-parameter changes;
stomps suit layering and momentary or non-latching control. Fits Line 6 text above.
https://line6.com/support/topic/43996-snapshots-vs-stomp-thoughts-on-why-one-vs-the-other
- rd2rk in the same thread: snapshots beat preset loads because of "a slight lag
  with potential momentary audio dropout when loading presets".

**Real layouts people report** (thread 28066,
https://line6.com/support/topic/28066-most-usable-helix-setup, community only):

| Poster | Layout |
|---|---|
| kaleidoskope | Snapshots on the bottom row, stomps on the top row. Four base sounds plus a boost/delay solo switch. |
| rzumwalt | First 4 top-row snapshots plus 4 bottom-row stomps, later all 8 snapshots. EXP 1 triggers a post-amp lead boost and an external drive in an FX loop. Stomps are "effects I might want to hit on the fly regardless of the snapshot". |
| DunedinDragon | One preset per song. Lower row (stomps) set per preset, usually one active button for the lead break. Upper row reserved for snapshots if needed. |
| gunpointmetal | Prefers snapshots live for "spillover and gapless switching". Copies a master patch with clean and dirty amps and swaps drives and ambience per song. |
| GenoBluzGtr | Per-amp preset with snapshots Clean, Crunch, Drive and a fourth solo/extra drive. Stomps for trem, chorus, wah on all of them. Footswitch positions and LED colours kept the same across presets. |
| amsdenj | Often plays a whole gig on one patch. |
| lawrence_Arps (thread 43996) | 4 presets of 4 snapshots, 11 recall stomps. |

- Worship use: one forum worshipper finds 4 snapshots "plenty" for cleans, dirt,
  heavier overdrive and ambient on one amp model (Line 6 forum, reported via search
  result; I did not open the thread, so unconfirmed in detail). Tyler Logan's
  MultiTracks pack (snapshot mode "SO much more simple" for lead in a worship set) is
  a seller's claim: https://www.multitracks.com/sounds/Tyler-Logan/Helix-Song-Specific-Patches-Volume-1-Helix/

**Typical snapshot sets.** Clean / Crunch / Drive-lead are the common core (GenoBluzGtr,
kaleidoskope). Joe Gore's example set uses 8 snapshots: 4 different amp/drive states, then
those four repeated with reverb+tremolo, delay, reverse delay and so on
(Line 6 blog above). No source gives a single standard set beyond this.

**What changes per snapshot** (manual, helixhelp, Gore, forum):
- Block on/off: drives, boost, modulation, delay, reverb, and which of two amps is
  on. Gore's presets open with most blocks bypassed and switch amp/cab pairs.
- Per-snapshot parameters, from helixhelp's snapshots page
  (https://helixhelp.netlify.app/tips-and-guides/helix/snapshots): Output block
  level, harmony keys, pitch intervals, Variax model, Command Center values (amp
  channel, DAW).
- Gore changed delay Feedback and Mix and reverb Decay and Mix per snapshot.
- Disagreement: themetallikid and Indianrock2020 (thread 56102) say do not change
  delay feedback/mix or reverb decay per snapshot because of artefacts when you
  switch. Gore does it. I could not verify either claim by ear.
- Amp-setting changes between snapshots can cause pops and crackles (theElevators,
  thread 56102), one user's report.

**How to assign a parameter to a snapshot.** Staff handle Digital_Igloo (thread 28346):
find the level parameter, "Press and turn that knob", value turns white with
brackets, and it is now per snapshot. HonestOpinion in the same thread: unassigned
parameters stay shared across all snapshots. Source:
https://line6.com/support/topic/28346-adjusting-volume-of-multiple-snapshots
- Gotcha from helixhelp: expression-pedal parameters are only per snapshot if
  EXP Pedal Position is set to "Per Snapshot".

**Snapshot bypass and "Snapshot Edits".**
- Bypass is stored and recalled per snapshot automatically. A block can opt out
  (LT: Snapshot Block Bypass off; POD Go: "Snapshot Bypass" Off, via ACTION in Edit
  view). Danger from the manual and helixhelp: blocks that share a footswitch can end
  up in odd states.
- Global Settings > Preferences > Snapshot Edits: "Recall" (default; edits remembered
  when you return to a snapshot) or "Discard" (edits lost unless you SAVE twice).
  The camera icon is grey for Recall, red for Discard (LT manual p.66). Preset saves
  store all snapshots and the one active when saved.
- Snapshot Reselect (LT): pressing the active snapshot again either "Reload" (default)
  or "Toggle Previous".

**Spillover and trails.**
- Between snapshots: manual says set Trails to On for Delay, Reverb and FX Loop blocks
  (LT p.47, POD Go p.36). Trails Off mutes repeats the moment the block is bypassed.
- Between presets: LT only does it in "True Preset Spillover" mode, which removes
  Path 2 (one DSP is given up), and only two presets are ever heard at once. A tempo-
  synced delay trail will re-sync to the new preset's BPM; the manual says to avoid
  tempo sync or set Tempo Select to Global to prevent that (LT p.23). POD Go has no
  preset spillover; it relies on snapshots.
- Output-block level per snapshot may cut or keep tails oddly: one user found it kept
  Path 1's tails sounding after a path switch (thread 65354, search result only).

## 2. Footswitch layout conventions

**Helix LT (manual 3.0, Global Settings > Footswitches, pp.13-15, 68).**
- Modes: Stomp, Preset, Snapshot, Looper, Pedal Edit. FS6 (MODE) toggles. Default
  Preset mode shows 8 presets.
- "Preset Mode Switches" can be: 8 Presets, Preset/Stomp, Stomp/Preset, Preset/Snap,
  Snap/Preset, Snap/Stomp, Stomp/Snap, 8 Snapshots. Snap/Stomp (snapshots 1-4 top row,
  stomps bottom row) is the mixed layout players describe.
- "Snapshot Mode Switches": Auto Return (go back to the previous mode after choosing
  a snapshot) or Manual Return (stay in Snapshot mode until FS6). Up/Down switches can
  step through snapshots.
- Stomp mode switches can be Momentary or Latching per switch (Bypass Assign page).
  The EXP toe switch can hold a bypass but it is always Latching, never Momentary.
  A Wham block automatically takes "EXP Toe".
- EXP: onboard pedal is EXP 1 or EXP 2; the hidden toe switch toggles between them.
  Factory convention (manual): Wah on EXP 1, Volume on EXP 2. A second external
  pedal on EXP 2/EXT AMP changes the onboard pedal to EXP 1 only.
- The TAP/TUNER switch: tap sets tempo, hold opens the tuner. Touching TAP shows the
  tempo field.

**Conventions from players (community, not from Line 6):**
- Keep switch positions and LED colours the same across presets (GenoBluzGtr, thread
  28066). Name and colour snapshots (POD Go manual tip, LT manual tip).
- Stomps are for things you want regardless of snapshot (modulation, wah, boost)
  (rzumwalt). Wah on the EXP pedal; delay feedback or drive on a second external
  pedal (jbuhajla).
- Channel-volume on a switch or EXP: GenoBluzGtr uses the amp's channel volume on a
  footswitch with heel for gig volume and toe for lead volume. rzumwalt uses the main
  pedal as ±4 dB global volume.

**POD Go (manual 2.0).**
- Fixed blocks always in a preset: Input, Wah, Volume, FX Loop, Amp/Preamp, Cab/IR,
  Preset EQ, Output, plus 4 free effects blocks. One amp and one cab only; no second
  path.
- 6 stomp switches (FS1-FS6) in Stomp mode, 4 snapshots A-D in Snapshot mode,
  entered from Preset mode with both Bank switches. Options: Stomp mode "4 Switches"
  replaces FS1 and FS4 with Up/Down so banks and snapshots stay reachable; Snapshot
  Mode Switches "Auto Return" / "Manual" / "Toggle".
- Wah is auto-assigned to EXP 1 and Volume to EXP 2; the toe switch swaps them.
- EXP 2 / FS 7/8 jack takes an extra expression pedal or up to two momentary
  footswitches (Y cable).

## 3. Level matching

**Order of controls.** The most detailed consistent statement: silverhead (forum
"Line 6 Expert"), thread 70559
(https://line6.com/support/topic/70559-ways-to-achieve-consistent-sound-levels-across-presets):
1. Amp Channel Volume first, set high for clean presets and lower as presets get
   dirtier.
2. Output block Level for fine tuning.
3. A Gain block at the end of the chain, or a flat EQ block, "only if necessary".
- Do not use Drive or amp Master for level; they change tone (codamedia, thread 66589).
- komposition101 (third-party blog, no named author) agrees: same order, compare on
  the clean tone, keep Output block trims to about ±1-3 dB
  (https://komposition101.squarespace.com/blog/volume-matching-presets-on-line6-helix).

**Disagreement on output block per snapshot** (thread 56102, no Line 6 staff):
- For: HonestOpinion (changes are fine, often the best transparent lever);
  themetallikid (-4 dB base, 0 dB for lead boost, "no problems live").
- Against: DunedinDragon (output block sits at the AD/DA edge, prefers amp channel
  volume); theElevators (output level as "last resort", noise when level differs
  between snapshots, also pops from amp changes).
- Neither side has a measurement. The POD Go manual itself says to set "one of the
  effects' Gain or Level parameter per snapshot" for consistent volume. helixhelp lists
  Output block level per snapshot.
- Gain blocks: codamedia calls them transparent; rd2rk warns a Gain block first in the
  chain breaks Input Impedance "Auto" (thread 58592). HonestOpinion suggests a
  Volume block ahead of delay and reverb so an EXP heel-down does not cut trails.

**How much louder a lead.** Figures people give (all taste, not a standard):

| Who | Lead lift |
|---|---|
| patdixon (thread 49092) | about +3 dB over rhythm, tuned by ear to a track |
| themetallikid (56102) | output -4 dB to 0 dB for lead (4 dB) |
| rzumwalt (28066) | main EXP pedal as ±4 dB volume |
| PaulTBaker (64724) | adds no more than 2-3 dB at any block |
| komposition101 | 1-3 dB; "+6 dB sounds unprofessional, +2 dB sounds intentional" |
| Vanderdecker (70559) | idea of a 0-4 dB expression gain on each preset |
| Forum "±3 dB" rule | aim for every preset and snapshot to land within about 3 dB (relayed in a search summary of a Sadites-related thread; unconfirmed) |
Rough range: +2 to +4 dB. +6 is called too much by one source and is not recommended
by any.

**Meter and loudness methods.**
- Output block meter: DunedinDragon (thread 66589) says about 60-65 percent on the
  Output block meter gives a consistent signal for the sound engineer, and with a
  mixer's trim at 12 o'clock he adjusts to read 0 dB on the board.
- Board level: DunedinDragon (thread 49092) about -8 dB on the board meters;
  Heavyville -6 to -8 dB.
- Loudness: craiganderton (Helix Native input/output at 0.0, match averaged LUFS,
  thread 66589); Blumi_guitar suggests the Orban meter with ITU BS.1770 short-term
  and integrated. No target LUFS number was given by anyone.
- codamedia: "trust meters, not your ears" for the first pass, because dirty tones
  need more output to match clean ones, then finish by ear.
- Counter: brighter tones can seem louder at equal measure (theElevators), and
  craiganderton notes a different room may need a different baseline, so the
  baseline speeds up soundcheck rather than replacing it.
- Do the matching at gig volume (PeterHamm, trhx; threads 28066, 70559), over several
  sessions to avoid ear fatigue (trhx).
- MatchPatch (https://noseglasses.github.io/MatchPatch/musician-guide.html) is a
  third-party tool that adjusts Output block levels per snapshot from measured
  loudness. Evidence that this is an accepted workflow, not an endorsement.
- Mismatched gain structure is the usual cause of snapshot jumps, rather than the
  block you pick (forum reply, relayed; unconfirmed).

## 4. Playback system: FRFR, Powercab, guitar cab, FOH, in-ears

**Line 6's own framing (Eric Klein, Line 6 blog, 2023-09-15,
https://blog.line6.com/2023/09/15/eric-klein-at-least-half-of-your-modelers-sound-is-determined-by-your-playback-system/).**
"At least 50%" of a modeler's sound is the playback system. Options: FRFR (flat,
suits many cabs or IRs; tweeter may be strident, adjustable with Global EQ), PA
speakers (often hyped or scooped), IEMs, studio monitors, a power amp plus real cab,
a real amp (4-cable method), and Powercab. He says to set mic and distance within the
cab block and place the speaker like a real cab. He gives no cab-on/off rule.

**Powercab Plus (manual).**
- Flat mode "is equivalent to the signal being sent to a front-of-house mixer", ideal
  for signals that already include a cab emulation. Voicings: FRFR (uses the HF
  driver), LF Solo (woofer, no EQ), LF Flat (woofer, flattened EQ).
- Speaker mode: "intended to respond like a real guitar speaker"; it applies its own
  speaker model to the driver, and its XLR gets a DI mic model. LF Flat is the
  voicing used in Speaker mode.
- IR mode loads IRs in the cab and "can offload DSP from your Helix".
- L6 LINK (LT manual p.27-28, Output block pages 2-5): digital link plus remote; one
  Powercab gets a mono sum, two get left and right. Powercab Remote can be Off,
  Preset (stored with each preset) or Global (same everywhere). Mode and Flat Voicing
  can be set from the Helix output block. Needs Powercab firmware 2.00 or later.
- Practice (forum, thread 59751 and others, community only): when Helix runs a cab or
  IR, use Flat (FRFR or LF Flat) so the sound is not coloured twice; when you want the
  Powercab speaker, bypass the Helix cab and use Speaker mode. Reported trade-off:
  Flat and IR modes lose the DI mic emulation on the Powercab XLR. Remote control over
  L6 LINK is reported as inconsistent by several users, and one suggests turning
  Remote off and sending changes via MIDI or Command Center instead.
- Disagreement: some users run Powercab speaker modes while sending a Helix cab to FOH,
  others run Flat and one preset for both. Which is better is not settled.

**Cab block on or off.**
- Real guitar amp front-end (1/4" out set to Instrument): cab block off; the amp's
  speaker is the cab (manual: 1/4" "Instrument" for the front of guitar amps).
- Power amp into a real cab: Klein lists this as an option and notes the load for
  cab sims, so a cab/IR is still used in the load-box case ("implied"). I found no
  explicit rule for a power-amp-into-real-cab setup, so treat as unconfirmed.
- FRFR, PA and IEMs: cab block or IR on.
- POD Go Amp Out jack (manual): "Pre Cab/IR" taps the signal before the cab so a
  cab-sim signal can go to speakers or the mixer while a dry one goes to a guitar amp.
  This supports splitting cab-on and cab-off outputs.
- LT: Output block can feed two outputs, but the cab setting is per path, not per
  output. Players use two paths or a Global EQ difference between outputs (see below).

**FOH, in-ears and monitors** (community):
- XLR set to Mic for mixers (manual), at full level, with the Helix VOLUME knob set to
  affect only the 1/4" stage output ("Volume Knob Controls" in Ins/Outs). Reported by
  DunedinDragon, TLF2007 and others (threads 49092, 18589, 64724). TLF2007 turns the
  knob off (Digital) before gigs so a bump cannot change FOH.
- Cuts for FOH: low cut on every preset because many engineers high-pass guitar at
  80-120 Hz (codamedia); cab block low cut 100 Hz and high cut 5 kHz plus a global
  low cut at 80 Hz and a few dB down at 4 kHz (strabes, thread 25978); PaulTBaker
  cuts lows around 90-100 Hz and highs 4.5-8 kHz; DunedinDragon high cuts between 8
  and 10 kHz with a parametric cut near 4.2 kHz on Strats/Teles; Joepeggio cuts 4-5 dB
  around 3 kHz (Q about 1.8-2) for loud playback and boosts it at home (thread 25978).
  Disagreement: Evil_Patrick cuts about 3 dB from 500 Hz down, while SaschaFranck says
  300-500 Hz gives vocal quality and should not be cut generally (thread 64724).
- Global EQ: manual says it is for "wide disparity in acoustic environments"; it can
  be applied to 1/4" only, XLR only or both, is never heard from Send, Digital or USB
  outputs (LT manual p.63), and has 3 bands plus low/high cut. Players disagree:
  enjalt applies it to XLR only; theElevators applies it to the stage output only and
  leaves FOH flat for the engineer; DunedinDragon avoids it entirely because a board
  RTA process could alter it; Evil_Patrick uses it only at the venue (threads 64724,
  70124). HonestOpinion uses it as a quick room fix (thread 18589).
- Engineers: "I always tell the sound man to leave my channel completely flat"
  (DunedinDragon, thread 25978). Others say the engineer should do the EQ (theElevators,
  SaschaFranck, thread 70124).
- Phantom power: Helix does not like it; turn it off on the channel or use blockers
  (HonestOpinion, thread 64724; ozbadman, thread 18589).
- IEMs differ from room sound; prioritise what the audience hears, then adjust for
  comfort (cruisinon2, thread 49092). Heavyville keeps separate setlists for mic'd cab
  and IEM.

## 5. DSP management

**Helix LT (manual, Dynamic DSP, p.24).**
- Two DSPs, one per path (Path 1 and Path 2). If everything is on 1A/1B you use half
  the DSP.
- Limits: 4 amp-ish blocks (2 per path), 4 cab blocks (Dual counts as 2), IRs 4x1024
  or 2x2048, one Poly effect per path, one Looper.
- Heavy: Amps, IRs, Reverbs, Poly effects (Poly Detune and Poly Sustain "up to half"
  of a path). Light: EQ, Dynamics, Volume/Pan, Send/Return. Stereo costs about twice
  mono; Cab > Dual about twice a single cab.
- Manual advice: use snapshots or controllers on one block instead of two
  identical blocks; prefer one Amp plus a Cab > Dual to two Amp+Cab; add mono blocks
  before amps because amps and Poly effects are mono.
- Players split by putting the amp+cab and its reverb on one path and the second
  amp/pitch/delay on the other. I have no source describing a named convention; the
  manual's own examples are the evidence.
- Spillover mode costs the whole second path.

**POD Go (manual plus forum).**
- 4 free effects blocks only. A greyed-out item means "there isn't enough DSP to
  accommodate that category or model" (POD Go manual p.14).
- DSP shared across everything: amp choice cuts into the free blocks (silverhead,
  "Line 6 Expert", thread 55996). Figures from a community chart (malhavok) via
  voxman55: Brit Plexi Jump about 41 percent, Normal about 35; spring reverb about 34;
  other reverbs about 14; EP-3 tape delay about 24; TS808 about 14; Phase 90 about
  5; an imported IR about 3. Total over 100 percent is refused. Another poster put
  Benzin amp and some reverbs at about 33 percent (thread 62007). Chart figures
  are from 2020 and may have changed.
- Workarounds players report: lighter reverb, cheaper model variant, external pedal in
  the FX loop. Both authors say it rarely bites in practice.
- Note the LT manual says Powercab IR mode offloads DSP (applies to LT; I did not
  confirm for POD Go).

## 6. Input, output and volume knob

- **Pad:** "If your guitar or bass has active or really loud pickups, you may want to
  turn this on. There's really no rule; use what sounds best." (LT and POD Go manuals.)
  Craig Anderton advises against it "unless you have super-hot or active pickups"
  (audiomasterclass.com blog).
- **Input impedance:** Guitar In-Z per input block; "Auto" follows the first block on
  Path 1A. Higher is brighter and tighter; lower is softer (LT manual). Preference
  "Auto Impedance" can follow the first block even when bypassed or only the first
  enabled block. Gain block first in the chain breaks Auto (rd2rk).
- **Noise gate:** each input block has its own gate with Threshold and Decay, off by
  default. Forum thresholds quoted are about -45, -48, -50 and -65 dB, with decay
  often short (about 10 ms); it affects feel on soft playing and fading chords. A few
  users assign threshold per snapshot (lower for clean). All community; no official
  recommended value. I did not confirm any default numbers.
- **Output level:** 1/4" "Instrument" for stompboxes and the front of an amp, "Line"
  for mixers and monitors; XLR "Mic" for mixer mic inputs and "Line" for studio
  monitors or line inputs (LT manual). POD Go: Main Out "Line" for powered speakers
  or mixers, "Instrument" for the front of a guitar amp.
- **Mic vs Line on XLR to FOH:** DunedinDragon and HonestOpinion (thread 64724) prefer
  Mic: it runs cooler, reduces spikes and lets the knob control only monitors.
  Evil_Patrick keeps the main knob at least at noon and stacks no block above 0 dB.
- **Volume knob:** set to control only the 1/4" or main outs, or disabled (Digital =
  unity). One user turns it off before gigs (TLF2007). POD Go: "Volume Knob" controls
  Main Out only, Amp Out only, or both.
- **Clipping:** Input and Output blocks show red when they clip (LT manual).
  Jason Sadites' reported view (forum summary, unconfirmed): do not worry about every
  block at unity or about clipping inside blocks, but keep the signal between noise
  and digital clip. Another poster pushed back that unity is a safer start for hot
  guitars (thread 58917, search summary only).

## 7. Tempo, tap, delay sync, tuner, looper

- Tempo Select (LT MIDI/Tempo; POD Go): Per Preset (default), Per Snapshot or Global
  (manual). Tap works from the TAP switch; below 40 BPM taps are ignored (LT).
  Players with song presets use Per Preset; Global is suggested for auditioning
  (forum, thread 62352 summary). Mixed behaviour between presets saved with tempo on
  and off is reported as buggy (search summary, unconfirmed).
- Delay blocks set to a note division follow tap. The manual's own caution: a synced
  trail changes tempo on preset change; avoid sync in spillover mode or use Global.
- Tap Tempo Pitch: "Accurate" (Authentic on POD Go) keeps the natural pitch wobble
  when tapping; "Transparent" removes it.
- I found no documented dotted-eighth convention among the sources reached. Unconfirmed.
- **Tuner:** hold the TAP/TUNER switch. LT Tuner Out can be Multi or Mute. Global
  tuner settings. Common practice to mute while tuning is in the manual's wording
  ("If you prefer to hear nothing while tuning, choose Mute"); I found no gig-specific
  convention beyond "Mute on stage".
- **Looper:** one block per preset, Looper bypass is not stored per snapshot. It does
  not carry over a preset change unless the target preset has the same type and
  position and is assigned to a footswitch (Line 6 KB, kb.line6.com/the-helix-looper).
  Stadium's guide puts it last before Output so loops capture the full signal; I have
  not seen that line for LT. The 6-switch looper switches the switch row into Looper
  mode, so it does not share a stomp layout with other things.

## 8. What makes a preset "gig ready", and common mistakes

Sources: thread 18589 (first gig), 49092, 70559, 66589, 64724, 28066.

Players' checklist:
- Levels within a few dB across presets and snapshots, set at gig volume with a
  backing track or band (PeterHamm, trhx, codamedia, DunedinDragon). One poster's
  first gig ended with the engineer saying "all the patches were even" (greekjgg).
- Flat, FOH-friendly tone: cut sub-bass and fizz so the engineer does little (the
  low and high cut values in Q4). Engineers' EQs differ; check at the venue.
- Keep presets simple and few. One chain copied with small variations (theElevators),
  few amp types, soundcheck every sound (Jarrod Nelson, theElevators).
- Consistent footswitch layout and names (GenoBluzGtr; manual snapshot naming tip).
- Volume knob locked or set to stage only; FOH on XLR at fixed level.
- Backup: bring a backup rig, and back up presets through a computer because a USB
  drive cannot be read by the unit (HonestOpinion, mdmayfield, DarrellM5; thread
  18589).
- Phantom power off or blocked.

Mistakes named:
- Voicing at bedroom volume then gigging; preset sounds different loud (patdixon,
  PeterHamm, cruisinon2).
- Using Drive or amp Master to match levels (codamedia).
- Stacking block gains above 0 dB and clipping the PA (Evil_Patrick).
- Trails off on delay and reverb so snapshot changes chop the tail (manual).
- Snapshot Edits set to Discard and forgetting to save (manual).
- Parameter not assigned to Snapshots so it changes everywhere (HonestOpinion,
  Digital_Igloo).
- Blocks on the same footswitch confusing snapshot states (manual).
- Output-level swings of 6 dB or more (komposition101); these are advice from one blog.

## Where sources disagree (summary)

1. Output block level per snapshot: fine (HonestOpinion, themetallikid) versus avoid
   (DunedinDragon, theElevators).
2. Changing delay feedback, mix or reverb decay per snapshot: Gore does it; two forum
   posters advise against.
3. Global EQ on the XLR: apply, leave flat for the engineer, or avoid altogether.
4. Cutting 300-500 Hz for FOH: Evil_Patrick yes, SaschaFranck no.
5. Powercab: Flat versus Speaker mode with a Helix cab, no consensus.
6. Gain block position and whether it helps or colours the tone.
7. Unity gain in every block (some say start there, Sadites reportedly says not to
   obsess).

## Checkable claims

Each is a claim that could be tested by rendering a preset in Helix Native and
measuring.

1. Amp Channel Volume changes level without changing tone; Drive and Master change
   tone. Settings: one amp, Ch Vol -6 vs 0 vs +6 dB at fixed Drive and Master. Expect
   loudness scales with Ch Vol and spectrum tilt stays flat; changing Drive changes
   spectral centroid and crest factor.
2. Output block level per snapshot is a pure gain. Settings: Output Level -4 vs 0 dB
   as a Snapshots-controlled parameter. Expect exactly 4 dB change in integrated level
   and no spectral change; check the same on a looped delay tail.
3. Lead lift of +2 to +4 dB sits between 'intentional' and 'too much'. Settings: lead
   snapshot +2, +3, +4, +6 dB over rhythm. Expect LUFS difference equal to the setting;
   +6 flagged by one source only.
4. Presets from clean to high gain drop in Channel Volume to match loudness. Settings:
   same output block; clean Ch Vol high, crunch and lead lower (silverhead). Expect
   matched short-term LUFS within about 1-3 dB when Ch Vol is set per gain level, and a
   large mismatch when Ch Vol is left constant.
5. Dirtier tones need more output to match cleaner ones on a meter (codamedia).
   Settings: clean vs high gain at the same Ch Vol. Expect high gain reads higher on
   LUFS and lower on peak headroom.
6. Brighter tones seem louder at equal measurement (theElevators). Settings: same
   preset with Tilt/high shelf +3 dB. Expect equal LUFS but higher A-weighted or
   perceived loudness; render and compare K-weighted vs flat.
7. Trails On carries delay and reverb tails across a snapshot switch; Trails Off cuts
   them (manual). Settings: delay Feedback 50 percent, snapshot A has delay on,
   snapshot B off. Expect a tail after the switch only with Trails On.
8. Changing delay Feedback/Mix per snapshot causes artefacts at the switch (forum,
   disputed). Settings: Feedback 15 vs 50 percent per snapshot. Expect a discontinuity
   (step or click) in the tail if true; none if the disputed claim is wrong.
9. Output block level changes per snapshot keep earlier tails audible when switching
   paths (one user). Settings: two paths, Output Level different per snapshot. Expect
   the tail of the old path persists if the claim holds.
10. A low cut around 80-120 Hz on every preset removes sub-bass the engineer would cut
    anyway. Settings: cab block Low Cut 100 Hz, High Cut 5 kHz (strabes) vs default.
    Expect energy below 100 Hz down by 12 dB or more, brightness lower; check the
    rendered spectrum above 5 kHz.
11. A cut of 3-5 dB around 3-4 kHz tames loud-playback harshness (Joepeggio, strabes).
    Settings: parametric -4 dB at 3 kHz, Q about 2. Expect a narrow notch of about 4 dB
    at 3 kHz, with overall level change under 1 dB.
12. Flat Powercab voicing with a Helix cab, not stacked (forum). Not measurable in
    Native, since the Powercab is hardware; note as outside the renderer.
13. A noise gate threshold of about -48 to -65 dB cuts noise without choking soft
    notes (forum, one person's taste). Settings: Input gate on, Threshold -48, -60, -65
    dB, Decay about 10-500 ms, soft-pick and fading-chord test signals. Expect more
    truncation of the decay at the higher thresholds.
14. A Gain block first in the chain changes Guitar In-Z behaviour with Auto
    impedance (rd2rk). Not measurable in Native, since impedance is hardware.
15. POD Go-style per-snapshot gain via a block's Gain or Level (manual tip) gives the
    same level change as setting the amp Ch Vol. Settings: Level parameter on a drive
    block per snapshot. Expect level change equals setting; tone shift only if the
    drive is pushing the amp harder.
