# Jason Sadites on effects, live tones and level balancing

Source set: seven of his YouTube videos in the "Line 6 Helix - How To Create A Great Tone" series (auto-generated transcripts in `~/.helixtone/transcripts/`). Nothing here comes from outside those transcripts. He is one player giving his taste; he says so repeatedly ("personal preference", "not the only way"). Where a statement is his taste rather than a general rule, the text says so.

Caveats on the transcripts:
- Auto-captions mishear. Numbers or names I could not read with confidence are marked **[unclear]** and not guessed.
- The videos date from Helix firmware around 2.3 (compressors, delays) and later (reverb video mentions two new HX reverbs). Model lists reflect that time.
- Timestamps are m:ss in the caption file. Each link is the video itself.

Short names used below (each citation is title, m:ss, link):
- **Pt.5 Compressor** = "Line 6 Helix - How To Create A Great Tone - Pt. 5 - How To Use A Compressor" https://www.youtube.com/watch?v=-6c4WUOETpM
- **Pt.7 Delays** = "... Pt. 7 - Understanding And Using Delays" https://www.youtube.com/watch?v=2Xzzc566zbc
- **Pt.8 Stereo Delays** = "... Pt. 8 - Understanding And Using STEREO Delays" https://www.youtube.com/watch?v=2nczTO-Ptgs
- **Pt.10 Chorus/Vibrato** = "... Pt. 10 - Modulation FX 1: Chorus & Vibrato" https://www.youtube.com/watch?v=7Kgeq4LoJrs
- **Pt.16 Reverb** = "... Pt. 16 - Understanding And Using REVERB" https://www.youtube.com/watch?v=90ASKPTdYls
- **Pt.14 Live** = "... Pt. 14 - Dialing In Tones For Live Playing" https://www.youtube.com/watch?v=BN3BldVCAR8
- **Pt.33 Balancing** = "Line 6 Helix - Create A Great Tone - Pt. 33 - Balancing Volume Levels Between Snapshot/Presets" https://www.youtube.com/watch?v=HE3IBSfc62Y

---

## 1. Balancing levels between snapshots and presets (the most important part)

### His stated method

- His own everyday method is "I always use my ear". He says that on its own is not much help to others, so the video offers a measured starting point that gets presets close, leaving "a few small tweaks" live. (Pt.33 Balancing, 2:11-2:54, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- The goal of the video is snapshots/presets at about the same perceived volume. He says there is no right answer: a player may want a quiet clean part, or a lead that jumps in volume to cut over a rhythm guitar. (Pt.33 Balancing, 2:57-3:36, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- Reference tool: a loudness meter reading **integrated LUFS**. His DAW (Cubase) has one built in. Free options he names: **YouLean Loudness Meter** and the standalone **Orban Loudness Meter** (set its audio interface to the Helix ASIO driver, read the "integrated" value). (Pt.33 Balancing, 3:44-5:36, https://www.youtube.com/watch?v=HE3IBSfc62Y) Caption spells YouLean as "you lean"; the product identification is mine from context, treat the name as slightly uncertain.
- The same performance must feed every sound being compared, so he puts a **Looper block at the start of the chain** and plays a fixed loop through each snapshot; otherwise softer or harder picking skews the reading. (Pt.33 Balancing, 7:16-8:11, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- Control he adjusts: **channel volume** (the amp's Channel Vol), not the tone controls, because it changes level without changing tonality, and it sets how much signal hits the compressor at the end. (Pt.33 Balancing, 12:06-12:20, https://www.youtube.com/watch?v=HE3IBSfc62Y)

### The demo preset and the numbers he measured

Demo preset: Brit Plexi Nrm into a 4x12 Greenback, 4038 (ribbon) mic pulled 12 inches back. Chain has a Parametric EQ (low cut 120 Hz, high cut 8 kHz, a split crossover at 650 Hz), a little room reverb, and an LA Studio Comp last. Four snapshots: clean, push, OD, lead. (Pt.33 Balancing, 5:38-7:10, https://www.youtube.com/watch?v=HE3IBSfc62Y) Caption says "4038"; that matches the ribbon mic named in the live video, but the "pulled 12 inches back" wording is as captioned.

| Item | What he reports | Source |
|---|---|---|
| Clean snapshot, integrated loudness | about **-24.6 LUFS**; later re-measured "around -25" for the same snapshot (cause not explained) | 8:44-9:01 and 11:46-11:52 |
| Push snapshot | Drive raised from 1.5 to 3.5 | 10:12-10:16 |
| OD snapshot | Master 8 to 9, Drive up to 9 | 10:17-10:23 |
| Lead snapshot | everything at 10 | 10:25-10:28 |
| Jump with channel volume left unchanged | "almost 10 dB" jump; push/lead read around **-15 LUFS** | 11:27-11:56 |
| Push channel volume after matching | started at 5.2, too loud; **4.9 to 5** matched the clean | 12:43-13:52 |
| OD channel volume | about **4.7** | 13:53-14:00 |
| Lead channel volume | **4.7**; 4.8 slightly too high, "4.x" slightly low | 14:22-15:47 |
| Tolerance he accepts | "within this 1/2 dB margin that we need for things to be perceived the same" | 15:45-15:51 |

All from Pt.33 Balancing, https://www.youtube.com/watch?v=HE3IBSfc62Y. Uncertain: he says clean-to-push went "from seven to five or to 4.8, 4.9" (14:39-14:46), which implies the clean channel volume was 7, but he never states the clean value outright **[unclear: clean channel volume, probably 7]**.

- Heavier gain needs less cut than you would expect: clean to push took about a 2 to 2.2 point channel-volume cut, push to lead only slightly more, because distorted tones have natural compression. He says matching a set of distorted sounds with the meter to within about half a dB is "probably going to be alright". (Pt.33 Balancing, 14:39-14:56 and 29:33-29:48, https://www.youtube.com/watch?v=HE3IBSfc62Y)

### Why the meter is not enough for clean versus driven

- After matching by LUFS, OD and lead sounded identical in level, but the clean still felt wrong: he expects the lead would "fall back in the mix" against the clean in a band. His explanation: clean tones have transient peaks that stick out while the average (LUFS) is equal; distorted tones are glued together by natural compression. (Pt.33 Balancing, 17:52-19:17, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- Fix: a compressor on the clean sounds (first two snapshots) and **off** for the two distorted snapshots. (Pt.33 Balancing, 19:43-20:49, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- Compressor used: **Deluxe Comp**. Starting point: threshold 0 dB (does nothing), **ratio 2:1** ("as transparent as possible", he says 3:1 or 4:1 also possible), **attack 1 ms** (0.1 ms is the minimum, he says "maybe even faster"), **release as fast as possible** (50 ms, the Deluxe Comp minimum per the compressor video). Then roll the threshold back by ear until it audibly smooths the transient peaks. (Pt.33 Balancing, 20:49-22:30, https://www.youtube.com/watch?v=HE3IBSfc62Y) The 50 ms figure for the minimum release is from Pt.5 Compressor, 16:37-16:41, https://www.youtube.com/watch?v=-6c4WUOETpM.
- Final settings he reports: threshold "my necks 27" **[unclear: almost certainly -27 dB, not confirmed]**, ratio raised to **4:1**, **+1 dB makeup**. The meter showed about 1 dB lost, so he estimates roughly 1 dB of gain reduction on peaks. (Pt.33 Balancing, 24:32-24:43 and 26:52-27:12, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- He admits there is no gain-reduction meter on the Deluxe Comp and wishes there were, because it would show when the threshold only catches peaks. (Pt.33 Balancing, 22:40-23:04, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- Result: with the clean tamed, he says the lead "will sound like it jumps more". Still "ballpark", not finished: expect to adjust live. (Pt.33 Balancing, 25:37-28:31, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- The LA Studio Comp at the end is a "glue" compressor, a slower compressor that does not grab transients, and is "not really there to control or match volumes". (Pt.33 Balancing, 12:18-12:43 and 19:50-20:08, https://www.youtube.com/watch?v=HE3IBSfc62Y)

### How much louder a lead should be

- He gives **no fixed number**. His example live adjustments: if you want the lead to pop, "go up a dB or two to your lead preset"; if cleans need to be louder, bump makeup gain by half a dB or a dB, or raise channel volume "a couple notches". (Pt.33 Balancing, 28:31-28:53, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- His own demo leaves OD and lead equal and he notes you "maybe would want to raise it more for our lead because we wanted to poke out a little bit more". (Pt.33 Balancing, 17:52-18:09, https://www.youtube.com/watch?v=HE3IBSfc62Y)

### Target level for a preset

- His target depends on the destination. For a **Powercab fed digitally over Line 6 Link** he wants the Powercab's input light **yellow, not going into red**; for this preset that corresponded to about **-24.6 LUFS integrated**, and later he says -25 would "hit the power cab the same way" for every preset. (Pt.33 Balancing, 9:06-9:57 and 29:15-29:28, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- He explicitly warns not to treat that as universal: the same level is lower than he would want to record into a DAW over USB. (Pt.33 Balancing, 9:33-9:49, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- This is one player's preference on one rig, not a standard.

---

## 2. Compressors

### Placement

- Two uses. (a) His everyday "mastering/glue" use: the compressor last in the chain after delays and reverbs, used lightly, not as dramatic compression. He knows many people object to this and says he does it deliberately. (Pt.5 Compressor, 0:15-0:54, https://www.youtube.com/watch?v=-6c4WUOETpM) (b) The classic guitar use: at the start of the chain before all effects and overdrives, with only a volume or wah ahead of it. (Pt.5 Compressor, 0:56-1:23, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Glue compressor settings in his live template: **LA Studio Comp, peak reduction 5, gain 5, set to Compress, mix 100%** (sometimes mix pulled back for parallel compression). He keeps it on "pretty much on all my sounds". (Pt.14 Live, 16:37-17:14, https://www.youtube.com/watch?v=BN3BldVCAR8) Caption reads "peak reduction of five gain of five"; Helix control names are as he says them.
- He argues a heavy squash compressor (very low threshold, fast attack) after a big reverb would be a problem, but that his light glue use is fine and does not harm reverb. (Pt.33 Balancing, 20:08-20:29, https://www.youtube.com/watch?v=HE3IBSfc62Y; Pt.16 Reverb, 21:39-22:18, https://www.youtube.com/watch?v=90ASKPTdYls)
- Live purpose of the end compressor: it keeps notes from spiking, so you can run louder without abrasiveness. (Pt.14 Live, 17:19-17:57, https://www.youtube.com/watch?v=BN3BldVCAR8)

### When not to use one

- On distorted tones he does not compress in front: the amp already compresses, and Sag and Bias/Bias X can shape dynamics instead. He applies compression for those tones only as the end "mastering" stage. (Pt.5 Compressor, 17:05-17:33, https://www.youtube.com/watch?v=-6c4WUOETpM) In the balancing demo the Deluxe Comp is off on the OD and lead snapshots. (Pt.33 Balancing, 20:42-20:49, https://www.youtube.com/watch?v=HE3IBSfc62Y)
- He dislikes simplified pedal-style compressors (one or two knobs) because he cannot find the setting he wants. (Pt.5 Compressor, 1:47-2:30 and 26:38-26:58, https://www.youtube.com/watch?v=-6c4WUOETpM)

### Models and what he says about each

(Pt.5 Compressor, https://www.youtube.com/watch?v=-6c4WUOETpM; he lists, for firmware 2.3, Deluxe Comp, Red Squeeze, Kinky Comp, LA Studio Comp, and a 3 Band Comp he does not cover.)

| Model | What he says | Time |
|---|---|---|
| Deluxe Comp | Line 6 original. Controls: threshold, ratio, attack, release, mix, level, knee. Attack from 0.1 ms to 200 ms; release minimum 50 ms; ratios 2, 3, 4, 6, 10, 20 to 1. His favourite because every control is available. | 5:10-5:46, 7:23-8:00, 11:26 |
| Red Squeeze (the MXR Dyna Comp model) | Controls sensitivity, mix, level. Manual says max compression 36 dB, attack 5 ms, release 1 second, sensitivity sets ratio. He dislikes the fixed 1 s release: pumping and breathing. | 26:20-27:51, 31:46-32:29 |
| Kinky Comp (Exotic compressor model) | Attack in 0.5 steps (not ms), release, level, mix, sensitivity. "Not really my favourite", pumps. | 29:42-30:05, 39:48-40:13 |
| LA Studio Comp (LA-2A model) | Fixed attack, he believes about 10 ms, release about 60 ms, not adjustable; Peak Reduction acts as ratio and threshold together; Emphasis is a high-frequency sidechain emphasis and is not very noticeable on guitar. Mix for parallel. | 33:16-34:08 |

Uncertain: the "10 ms / 60 ms" figures for the LA Studio Comp are "I believe", not read off a manual.

### Settings he gives

- "Typical" squash settings: **ratio 4:1, attack 5-10 ms, release 50-100 ms**. (Pt.5 Compressor, 21:07-21:27, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Threshold: set so it gives "3, 4, 5 dB of gain reduction". Test by toggling bypass and adding makeup gain until volume matches; his example needed about 3-5 dB of makeup. (Pt.5 Compressor, 23:57-25:13, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Threshold at 0 dB means the compressor does nothing; a common mistake is hearing "compression" from a threshold the playing never reaches. (Pt.5 Compressor, 9:46-10:07, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Attack: 0.1 ms chops off most pick attack; 5 ms still squashes it; 10 ms chops less; 50 ms lets the attack through and the compression is mostly lost. (Pt.5 Compressor, 7:23-7:49 and 19:42-20:57, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Release: a very long release (1-2 s) gives audible pumping and breathing as the chord decays; 50 ms is stable. (Pt.5 Compressor, 22:08-23:11, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Ratio: he uses 4:1 or maybe 6:1 for hard compression; he says mastering engineers use about 2:1, even 1.5:1 or 1.1:1. (Pt.5 Compressor, 12:53-13:16, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Mix: 50% mix of an aggressive compressor is "New York style" parallel compression (he mentions drums, 40-50% blended). (Pt.5 Compressor, 14:00-15:00, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Knee: he leaves it at 0 and calls it a minor control. (Pt.5 Compressor, 15:07-16:04, https://www.youtube.com/watch?v=-6c4WUOETpM)
- His deliberately extreme test settings, to hear the models: Deluxe Comp threshold -50, ratio 20:1, attack 3 ms, slow release, mix 100%, level +28; Red Squeeze sensitivity 10, level 12, mix 100. Not for use. (Pt.5 Compressor, 30:36-31:46, https://www.youtube.com/watch?v=-6c4WUOETpM)
- His "dialled in more like I'd use" settings: **Deluxe Comp threshold -30 dB, 4:1, attack 3 ms, release 100 ms, mix 100%, makeup 6.6 dB**; Red Squeeze sensitivity 5, mix 65, some makeup; LA Studio Comp peak reduction 7.8, gain 5.5, emphasis 10, plus 1 dB; Kinky Comp sensitivity 0, attack and release values captioned "a to release it to" **[unclear]**. He says for himself he might use 50 ms release and a little less. (Pt.5 Compressor, 36:17-37:10 and 41:07-41:14, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Subtle use: compressors can also be set very lightly just to control occasional peaks. (Pt.5 Compressor, 42:09-42:20, https://www.youtube.com/watch?v=-6c4WUOETpM)
- Clean-snapshot compressor for level matching (see section 1): Deluxe Comp, 4:1, attack 1 ms, fastest release, threshold about -27 [unclear], +1 dB makeup.

---

## 3. Delays

(Pt.7 Delays unless noted, https://www.youtube.com/watch?v=2Xzzc566zbc)

### Time and sync

- He never sets delay time in milliseconds; he uses the note-sync setting with tap tempo so repeats stay in time with the song. Calls out-of-sync delay "a little pet peeve", distracting, and making the playing seem out of time. (4:12-5:45, https://www.youtube.com/watch?v=2Xzzc566zbc) He says ms is fine if it suits you. (7:03-7:15)
- Note values: quarter, eighth, dotted eighth, triplets chosen to the tune. For slow tempos he may pick eighth notes. (5:41-5:54) Demo at 120 BPM, quarter note.
- Dotted-eighth demo: with straight eighth-note playing, repeats land on the sixteenth between your notes and sound like extra notes; mix set to roughly equal and feedback low for one or two repeats. (15:50-17:30) You must play in time for it to work.

### Mix and feedback

- Mix as a concept: 0% is dry, about 45-50% is roughly equal echo and direct, 100% is echo only. (8:44-9:31, https://www.youtube.com/watch?v=2Xzzc566zbc)
- **Lead sound: mix about 20-25%**, maybe a touch less for a subtle effect, so the delay is not "walking all over" the notes. (9:37-10:10, https://www.youtube.com/watch?v=2Xzzc566zbc)
- In the live video: general-purpose tones should pull delay back to **20-25%**, maybe up to about 29%. A mix near 50% makes repeats pile up and lose definition, which then tempts you to over-EQ the highs. (Pt.14 Live, 14:15-16:09 and 16:09-16:25, https://www.youtube.com/watch?v=BN3BldVCAR8) He exempts deliberate effect uses.
- With the delay back on in the finished live tone he says it "didn't really affect how it's going to cut through". (Pt.14 Live, 28:50-29:08, https://www.youtube.com/watch?v=BN3BldVCAR8)
- Feedback behaviour as demonstrated: 10% adds little; 20% gives about one quiet extra repeat and perhaps a very quiet third; 30% about four; 50% many; 100% regenerates indefinitely. (7:18-8:26, https://www.youtube.com/watch?v=2Xzzc566zbc) His snapshot comparison used **feedback 20%, mix 30%** on every delay (the caption wording "20% feedback 30% mix" is read as feedback 20, mix 30). (44:19-44:58, https://www.youtube.com/watch?v=2Xzzc566zbc)
- Level: on the delay block it just raises or lowers the whole block's volume; a fix if adding the delay makes the patch louder. (10:24-10:38)

### Cuts on repeats

- Low cut and high cut on a delay affect **only the repeats**, not the direct sound. Pulling the high cut down makes repeats dark and muffled; raising the low cut thins them. He gives no recommended frequencies, only demonstrations. (12:08-13:35, https://www.youtube.com/watch?v=2Xzzc566zbc) The simple delay has no such controls; the Mod/Chorus Echo, Duck, Reverse, etc. do. (12:08)
- Same statement for reverbs: cuts affect only the reverb tail. (Pt.16 Reverb, 10:01-10:16, https://www.youtube.com/watch?v=90ASKPTdYls)

### Models

| Model (as he names it) | What he says | Time |
|---|---|---|
| Simple Delay | Clean digital, pristine; time, feedback, mix, level, trails only | 3:12-11:13 |
| Mod/Chorus Echo | Digital delay plus low/high cut plus chorus or vibrato on repeats only | 11:46-15:33 |
| Duck Delay | Sidechain compressor: repeats are held down while you play and come in when you stop; parameters threshold, amount of ducking, attack, release; "gating" dynamic type does the reverse | 17:36-21:30 |
| Reverse Delay | Plays the repeat backwards; mix 100% imitates backwards guitar; special effect | 21:36-24:02 |
| Vintage Digital | Models early low-bit/low-sample-rate digital; bit depth, sample rate, headroom; low headroom gives crackle; his demonstration used 16 bit / 44.1 kHz as clean CD quality | 24:04-32:03 |
| Bucket Brigade | Analog, warm soft repeats; time range only about 20-300 ms; noise control | 32:09-33:24 |
| Transistor Tape (Echoplex EP-3 type; he says "I believe") | Darker than typical tape; wow and flutter; "one of my favourite delays" | 33:27-35:47 |
| Cosmos Echo (Space Echo RE-201 model, "I believe") | Three playback heads; he would use **head 3** with normal note-sync time as a straight delay; also bass, treble, feedback tone, splice, ramp; dirtier than the Echoplex model | 36:03-43:00 |
| Adriatic Delay | Same as bucket brigade with longer possible time (from a viewer, in Pt.8) | Pt.8 5:20-5:47 |
| Pitch Echo | Repeats shifted to a set interval | 43:08-43:34 |

All Pt.7 Delays, https://www.youtube.com/watch?v=2Xzzc566zbc, except the Adriatic row. Pt.8 for Adriatic: https://www.youtube.com/watch?v=2nczTO-Ptgs. Model names and which hardware they model are his statements ("I believe") unless otherwise noted.

- His preference for tape models as a straight delay: "I just love the way that they have a softness and that vintage gooeyness". That is taste. (35:44-35:57)
- He says Line 6's delays are enough that he does not need any other. (48:48-49:00)

### Trails, and before or after the amp, and mono or stereo

- Trails: when off, repeats are cut when you change snapshot or patch; when on, repeats continue. He explains it but says it is outside the scope of his video, and gives no recommended setting. (10:40-11:10, https://www.youtube.com/watch?v=2Xzzc566zbc)
- Before or after the amp: **not covered in these seven videos**. The only placement statements are about compressor and EQ (end of chain). **[not found]**
- Mono versus stereo: Pt.7 covers the mono delays; Pt.8 is a separate video for the stereo ones (below). He gives no rule for when to choose stereo.

---

## 4. Stereo delays

(Pt.8 Stereo Delays, https://www.youtube.com/watch?v=2nczTO-Ptgs. He recommends headphones or decent speakers to hear them.)

- **Multi-Tap 4** (and Multi-Tap 6, which has six taps, no diffusion and no modulation): each tap has scale (percentage of the main time), pan and level. Demo: main time 1 s, mix 43%; tap 1 scale 100% panned left; tap 2 at 50% (500 ms) panned right; tap 3 at 75% (750 ms) around left 50; tap 4 at 90% (900 ms) fully right. Result is an automatic bouncing rhythm; four taps with high levels "starts to get overwhelming". Levels were kept equal and cranked for demonstration; he says you can lower them below the direct signal. (6:40-12:11 and 12:29-14:01)
- Diffusion on the Multi-Tap 4: to his ears adds a little reverb-like ambience to the tails; "you might dial in halfway". (6:55-7:13)
- Tap scale at 0 sounds like almost no delay (very short). (7:57-8:24)
- **Ping Pong**: time 1 s, feedback 44% in his demo. Spread acts as pan: 0 is mono/centre, 10 is all the way to one side. Scale adds a second delay at that percentage of the time on the opposite side: 25% gives a 250 ms repeat, 50% gives 500 ms plus the 1 s repeat. It gets messy with faster playing. (14:01-17:00)
- **Sweep Echo**: stereo echo with a low-pass, band-pass or high-pass filter on the repeats modulated by an LFO; he does not give settings and defers it. (17:35-19:08)
- **Harmony Delay**: pitch-intelligent repeats, needs the key set. His setup: key of A major, quarter-note triplets at 120 BPM, voice shifts **+2 and +4** (a third and a fifth above diatonically, major or minor triad as the key requires), scale 33% and 76% of the time, root level optionally adds an unshifted voice. He ties the sound to Steve Vai's "Ballerina 12/24" and says "I think" an Eventide H3000 was used there (unsure; he asks for correction). (19:08-24:56)
- **Cosmos Echo ramp**: sets how fast the tape speed reaches a new value when you move the time control; it did nothing in his earlier test because time was not being moved. Demo: time on an expression pedal from 150 ms (heel) to about 1.7 s (toe), mix 100%, feedback about 40%. (0:03-4:24)
- Technique takeaway: no "use this setting" guidance for stereo beyond demonstrations. He treats the multi-tap, ping pong and harmony models as creative effects.

---

## 5. Chorus and vibrato

(Pt.10 Chorus/Vibrato, https://www.youtube.com/watch?v=7Kgeq4LoJrs. This is mostly explanation; he gives **no recommended settings and no chain placement** beyond what is below.)

- How modulation works: the signal is split, an LFO varies one parameter of the copy, and it is mixed back with the original. Chorus: the LFO sweeps a very short delay, "usually around 15 to 25 ms" (he says "I believe"), which also causes slight pitch variation. Vibrato: the LFO varies pitch only. (2:50-5:10 and 14:15-15:11)
- LFO rates run from about 0.5 or 1 Hz up to about 20 Hz; each doubling of rate halves the cycle time. (6:57-8:29)
- Controls on the Line 6 original Chorus: speed (rate), depth (amplitude), pre-delay, wave shape (saw up, saw down, triangle, sine, square, inverse sine, random), tone, spread, mix, level. Note-sync: a quarter note at 120 BPM completes one cycle per beat (half a second). (12:55-17:33)
- Mix: 0% is dry only; 100% removes the direct signal; 50% blends the two. (17:10-17:33)
- Spread: low collapses toward mono, high spreads wider in stereo. (16:56-17:10 and 18:26-18:50)
- Demo of "more usable" settings: from an extremely fast and deep setting he moved to a **slower rate and less depth, "much more usable"** for a shimmery chorus, and notes an even more subtle sound with much less depth. No numbers given. (19:27-20:53)
- Extreme demo setting included "a mix of 15" **[unclear: caption is garbled]**. (18:04-18:13)
- 70s Chorus (Boss CE-1 model): selectable chorus or vibrato; depth is fixed and not adjustable in chorus mode; has a Mode setting (true or classic stereo; he thinks classic drops to mono and does not know what the difference is); headroom lowered adds grit. (25:04-28:15 and 28:48-30:19)
- Plastic Chorus (modded Arion SCH-Z model, "not one I was overly familiar with"): rate, depth, bass, chorus or vibrato. He says he likes it over the Line 6 original and Trinity. That is taste. (30:23-31:20)
- Trinity Chorus (Dimension-style tri-stereo model): three LFOs (left, centre, right depth), with preset/manual/both wave options. Mono collapse loses the stereo spread. (32:33-35:47)
- Bubble Vibrato (Boss VB-2 model): speed and depth plus **rise time**. Per Line 6's Ben (as told in the video): rise time only matters when you turn the effect on; at 0 it hits full speed instantly, at 10 it ramps up slowly like a rotary speaker accelerating. (36:20-39:30)
- Live control: speed or depth assigned to an expression pedal; shown working with the usual right-click, expression pedal 1. (36:22-37:25 and 39:46-40:19)
- Chorus or vibrato on delay repeats only: the Mod/Chorus Echo delay does this. (Pt.7 Delays, 13:44-15:33, https://www.youtube.com/watch?v=2Xzzc566zbc)

Gap: chain placement of chorus and vibrato, and "normal" settings for a rhythm or lead tone, are **not given** in the transcript. The modelled hardware identifications are his own and uncertain in places ("believe", "not one I was overly familiar with").

---

## 6. Reverb

(Pt.16 Reverb, https://www.youtube.com/watch?v=90ASKPTdYls unless noted. He deliberately does not rank models; he says choosing is taste and the video is about parameters.)

### What the parameters do

- **Decay**: size of the space, how long the tail goes on. (7:21-8:20)
- **Pre-delay**: time before the reverb begins. With the mix at 100% you can hear it directly. 20 ms lets the note "bloom" before reverb arrives. He compares it to attack on a compressor: at zero the reverb sits on the pick attack and softens it. (8:20-9:13 and 16:59-20:04)
- **Low cut / high cut**: remove low or high frequencies from the reverb only, not the dry guitar. Reverb can eat space in a mix and wash out cymbals. He gives **no recommended frequencies**. (9:14-10:33)
- **Mix**: 50% is about equal reverb and direct; 100% is reverb only. (10:45-11:20)
- **Ducking**: reverb is lowered while you play and blooms when you stop. He had not tried it, so that is his understanding. (6:06-6:38 and 30:50-31:20)

### Settings and guidance

- His own use is "a little bit of realism, like an amp sitting in a room": **Room reverb, mix about 30, pre-delay about 10-15 ms** ("11, 10, 15, somewhere in there"), so subtle it is "almost not even apparent". (20:55-21:39, https://www.youtube.com/watch?v=90ASKPTdYls)
- Another general-purpose use he sketches: Chamber with the reverb not "super noticeable, just a bit of ambience". (23:46-23:59)
- In the live video: his live tone uses Ganymede, pre-delay 0 ms, mix at a low value "just enough to give it a bit of room ambience". A **zero to 30% mix** range does not hurt note definition; around 50% things change; at about 62-66% "things were kind of turning to mush". Pulling a 50% reverb back to 25-30% keeps the ambience and lets the notes cut. (Pt.14 Live, 10:05-14:09, https://www.youtube.com/watch?v=BN3BldVCAR8)
- Pre-delay for cutting through: bump it up by "five, ten, fifteen milliseconds" so the direct notes poke through. (Pt.14 Live, 11:25-11:41, https://www.youtube.com/watch?v=BN3BldVCAR8)
- Busy versus sparse playing: the busier you play, the shorter the decay and the lower the mix; sparse playing can have longer decay and more mix. For a sound that sits back, higher mix and longer decay; for a forward, cutting sound, keep the mix low and pull decay back. (15:50-16:50, https://www.youtube.com/watch?v=90ASKPTdYls)
- Long tail against fast chord stabs (his reggae example) builds up over successive hits, so shorten decay. (13:26-14:00)
- Hall at a long decay with modest mix and some pre-delay can get away with an extreme decay for sparse playing, but long decay on quick overdriven lead lines loses definition. (25:40-28:15)
- A mix near 100% with a long decay is for atmosphere and swells; he does not use it for general tones. (12:05-12:48, 34:19-34:28)
- Mistake he sees in viewers' patches: too much reverb makes the tone "not cut through" or "lack presence", and fixing it by raising the high mids gives a harsh wet sound; lowering the reverb mix is the actual fix. (1:34-2:06, https://www.youtube.com/watch?v=90ASKPTdYls; Pt.14 Live, 13:35-13:50, https://www.youtube.com/watch?v=BN3BldVCAR8)
- Reverb placement in the chain: not stated. The end-of-chain compressor comes after it. **[not found]**

### Models he mentions

Legacy reverbs: Plate, Spring (and another spring flavour), Room, Chamber, Hall, Cave, Tile, Echo, Ducking, Octo, Particle Verb. Short, sometimes uncertain descriptions: Room is "more dead", good for an amp in a normal room; Chamber an "imperfect" reverb; Hall larger and more controlled; Tile like a bathroom; Cave long and reverberant; Echo a very short echo; Octo adds octaves; Particle Verb uses a Dwell control for atmosphere. New HX models mentioned: Ganymede (he likes it), Glitz, Plateau (pitch, can be put on an expression pedal as a reverb-only whammy), Delta, Double Tank (modulated tails). (2:49-7:00, 21:19-24:50, 29:15-39:45)

---

## 7. Dialling tones for live playing

(Pt.14 Live, https://www.youtube.com/watch?v=BN3BldVCAR8, one player's preference, and he says repeatedly he cannot make rules because every monitor, guitar and player differs.)

### Volume and monitoring

- He does not give a stage volume or dB. He wants to hear himself enough to judge intonation and notes, but dislikes sitting "above the mix"; he wants guitar "to sit in the mix not on top of the mix", a habit from studio work. (2:56-3:30)
- Practical tips: keep the volume under control, because blasting at the ear at the "right angle" in front of the cab makes distortion harsh; stand back or off-axis; turn down a touch and find the sweet spot. (3:49-5:50)
- Recorded demos are via Helix as USB interface straight into the DAW, so he cannot show an FRFR sound; he says translating that to video is impossible. FRFR versus another monitoring system is **not otherwise addressed**. (0:57-1:19 and 30:15-30:28)
- Global EQ: the same ideas apply there, but he can't demo it because Global EQ does not affect the USB output (stated as his belief). (32:33-32:48)
- He says tones dialled in the studio always "translated very, very well live" on every modeller he has used, including Helix. (1:44-2:06)

### What changes versus home

- His main points are about effects and EQ, in this order: 1) do not wash the tone with delay and reverb; 2) use the end compressor; 3) EQ. (5:55-6:36 and 30:40-31:08)
- He starts darker than most. Reason: when volume goes up, harshness appears, and dark tones with ribbon mics "still cut" at loud volume. He tested this by cranking the tone up before filming. He says there is a limit and you can be too dark. (8:02-9:44)
- Example tone: Friedmann model into a 4x12 Greenback 25 with a 4038 ribbon, balanced by boosting highs **+8 dB** and cutting lows **-7.4 dB** with the Split block. (7:33-7:54) Caption says "412 green back 25", "Friedmann model", "split block"; the numbers are as heard.
- Common live complaints he lists: too harsh, too muddy, too boomy. (18:33-18:50)

### Cuts and EQ numbers

- Parametric EQ at the end of the chain: starting defaults **low cut 80 Hz, high cut 12 kHz**; he says the Parametric EQ's cuts act more steeply than the cab block's cuts, so he uses them. (9:49-10:00 and 19:21-20:16)
- Harsh or fizzy: roll the high cut back until the offending sound goes. He demonstrates 8 kHz and mentions 8.5 kHz; "trust your ears". (20:34-22:03 and 31:15-32:01)
- Boomy or muddy low end: raise the low cut; with a bass player covering sub-100 Hz, guitar below about that range is "not useful"; he demonstrates 120-130 Hz as thinning, and for his own sound lands at **about 110 Hz** (caption "a hundred and ten Hertz"). (24:52-25:34 and 31:20-31:35)
- Presence: a boost at **4 kHz, Q 1.4, up to almost 6 dB** with the high cut at 8 kHz sounded good; live he would reduce to 4 or 3 dB if needed. He names the working region as **3-5 kHz**, "doesn't have to be super dramatic". He calls the boost with the 12 kHz high cut "really harsh", showing the high cut matters. (22:28-24:50 and 32:14-32:30)
- Low-mid body: a narrow boost around **180-200 Hz, a couple of dB** to bring body back. (27:09-27:30)
- Mud: a narrow cut around **400 Hz, Q about 1.4-1.6, 1-2 dB** ("a little goes a long way"). (28:11-28:30 and 32:52-33:12)
- Full finished tone sounded "more polished, like a record", and the EQ-off comparison sounded worse to him; that is his opinion. (28:50-30:11)
- He often gets better results from cuts than boosts. (27:50-28:01)

### End-of-chain compressor in live use

- LA Studio Comp at the end, peak reduction 5, gain 5, compress mode, 100% mix, on essentially all sounds. (16:37-17:14)
- Low cut, high cut, and the parametric bands can all be tweaked at soundcheck; he says he may need a tweak "based on the venue or the stage". (33:41-33:48)

---

## Where sources disagree or rest on taste

- Within these transcripts there is no disagreement. Items that are plainly his taste: darker tone for live; compressor at the end of the chain; delay mix 20-25%; reverb 25-30%; preferring tape delays; the Plastic Chorus.
- His LUFS target (about -24.6 to -25) is tied to his Powercab and Link setup and he says it is not universal.

## Not found in these seven videos

- Whether delay or reverb goes before or after the amp.
- Chorus or vibrato chain placement and everyday settings.
- Any rule for FRFR versus guitar-cab monitoring beyond "I can't translate it".
- A fixed number for how much louder a lead should be (only "a dB or two").
- Recommended delay or reverb low/high cut frequencies.

---

## Checkable claims

One line each: claim, settings, what should be seen when the preset is rendered and measured.

1. Snapshot level matching by channel volume: with the same looped DI performance, integrated loudness (LUFS) can be matched across clean, push, OD and lead snapshots by lowering amp Channel Vol on the dirtier ones; his example went from clean about 7 [unclear] to about 4.9-5.0 (push), 4.7 (OD), 4.7 (lead). Expect integrated LUFS within about 0.5 dB across the four.
2. Same preset with Channel Vol unchanged, raising Drive and Master from clean to lead (push Drive 1.5 to 3.5; OD Master 8 to 9, Drive 9; lead all 10): expect roughly a 10 dB rise in integrated loudness (his reading about -25 to about -15 LUFS).
3. Distorted tones need a smaller channel-volume cut than the jump in gain suggests: push to lead should need only a small additional cut compared with clean to push. Expect the OD/lead channel volumes to be within about 0.3 of each other and the clean-to-push cut to be roughly 2 or more points.
4. Equal integrated LUFS between a clean and a high-gain snapshot still leaves the clean with higher peaks: expect clean to show a larger peak-to-average ratio (crest factor) than the lead at equal LUFS.
5. Deluxe Comp on the clean snapshots (ratio 2:1 or 4:1, attack 1 ms, release minimum 50 ms, threshold rolled back until about 1 dB of gain reduction, +1 dB makeup) lowers the clean's crest factor while moving integrated loudness by about 1 dB or less; the lead snapshot (compressor off) is unchanged.
6. Deluxe Comp with threshold 0 dB should be inaudible: output equals bypass within measurement error.
7. Deluxe Comp "typical squash" (4:1, 5-10 ms attack, 50-100 ms release, 3-5 dB gain reduction, about 3-5 dB makeup): bypass versus on should be within about 1 dB of integrated loudness, with a lower crest factor and a weaker initial pick transient with the compressor on. Attack of 50 ms should leave the transient mostly intact.
8. Long release (1-2 s) with a deep threshold shows pumping: the amplitude envelope of a held chord rises after the initial squash; at 50 ms release it does not.
9. Delay mix: simple delay at 50% mix gives a first repeat about equal in level to the direct signal (his estimate about 45%); at 20-25% mix the repeat sits clearly below the direct note, and the effect on the dry note's crest and level is small.
10. Delay low/high cuts affect only repeats: with high cut pulled down, the spectrum of the repeats loses top end while the direct attack's spectrum is unchanged.
11. Reverb mix: at 0-30% mix the early note attack stays prominent; around 50% and above the attack-to-tail energy ratio drops noticeably and the sound is perceived as further back. Pre-delay of 5-15 ms restores the pick transient at a given mix. Expect a higher attack-window peak with pre-delay of about 10-15 ms than at 0 ms.
12. Reverb ducking: with duck settings on, the tail level while playing is lower than after playing stops.
13. Live EQ recipe (low cut about 80 to 110 Hz, high cut 8 kHz instead of 12 kHz, +4 to 6 dB at 4 kHz Q 1.4, narrow +2 dB around 180-200 Hz, -1 to -2 dB at 400 Hz Q 1.4-1.6): spectral centroid lower than the same preset with high cut 12 kHz and no EQ bands, but with a presence peak near 4 kHz; energy below the low-cut frequency is reduced.
14. Boosting 4 kHz with the high cut still at 12 kHz sounds harsher than the same boost with the high cut at 8 kHz: expect more energy above 8 kHz in the first case.
15. Ribbon-mic dark tone (Friedmann into 4x12 Greenback with 4038, Split block high +8 dB, low -7.4 dB): expect a spectral tilt darker than a typical bright-mic version while retaining presence near 3-5 kHz after the live EQ above.
16. LA Studio Comp at the end (peak reduction 5, gain 5, compress, mix 100%): should reduce crest factor slightly without a large level change; with mix below 100% (parallel) the effect is smaller.
17. Level target: a preset aimed at the Powercab over Link should read about -24.6 to -25 LUFS integrated on his looper phrase (his preference, specific to his setup).
