# How Helix preset makers build a guitar tone

Research date 2026-11-22. Method: web search and page fetch. Read this first.

## Coverage and limits (read before trusting anything below)

Most named makers publish as video. Page fetch cannot read YouTube transcripts, so their numbers are NOT here.

| Person | What I could confirm |
|---|---|
| Jason Sadites | Only the title list of his 32-part series (Line 6 KB). No video content read. Everything about him below is second-hand, labelled as such. |
| Worship Tutorials | Product pages only. They say they have an amp-gain section for humbucker guitars; the numbers were cut off. Unconfirmed. |
| Glenn DeLaune | Two forum posts (see Q2, Q4). Other users say his presets need low cut 100-120 Hz or more. Second-hand. |
| Fremen, M. Britt, John Nathan Cordy, Steve Sterlacci | Nothing found by search. Unconfirmed. Not represented. |
| Scott Marquart / Helix Help | The fetched site (helixhelp.netlify.app) credits Jason Shimkoski, with tone-control text by Ben Adrian. I found no Marquart-attributed page. |
| Digital Igloo / Eric Klein | No posts found. Search never surfaced his posts, and pages that were supposed to include him did not. Unconfirmed. |
| Line 6 | Helix Stadium manual (the Stadium cab-block page mirrors Helix 3.50 wording), 3.50 release notes, a Dave Hunter blog post. Sweetwater inSync pages (Craig Anderton) returned 403 and were not read. |
| Others | Craig Anderton (Line 6 forum posts), Nail The Mix staff, and Line 6 forum regulars DunedinDragon, HonestOpinion, amsdenj, cruisinon2. These are experienced users, not product makers. |

Rule used below: "Line 6" means maker documentation. "Forum" means one user's taste unless several agree.

## 1. Amp block

What Line 6 and Helix Help say (no numbers beyond these):

- Drive: the Drive/Gain knob on master-volume amps, the Volume knob on amps without master. Helix Help, https://helixhelp.netlify.app/tips-and-guides/universal/common-amp-settings
- Master: lower settings reduce the effect of the other power-amp controls; at 10 the master is effectively out of the circuit. Same page. For amps with no master control, set it to 100%. Same page.
- Ch Vol: "a flat, post-model level control used to balance presets against each other." Same page.
- Sag: low is tighter (metal, djent); high gives touch dynamics and sustain (blues, classic rock). Same page. Dave Hunter (Line 6 blog, https://blog.line6.com/?p=5222): sag "can slur the notes and power chords", so minimal for fast country picking and modern metal; higher is more forgiving for blues and classic rock.
- Bias: low is colder Class AB, maximum is Class A. Helix Help. As a rule increase from 6 to 8 to mitigate crossover distortion. Same page. Hunter: cold is "tighter, punchier... a little more headroom"; hot is warmer and softer, with earlier onset of distortion.
- Bias X: Helix Help: low is tighter, high is more tube compression, interacts strongly with Drive and Master. Hunter: "the majority of players can probably ignore this control entirely."
- Hum and Ripple: Helix Help gives no values, only "At higher settings, things get freaky." Forum, https://line6.com/support/topic/30750-hum-ripple-bias-x: AlexKenivel says Hum is "generally left at 0 unless you are looking for a specific effect"; PeterHamm sets both to 0 first; twystedriffs (https://line6.com/support/topic/26948-rules-of-thumb-and-tips-for-creating-new-presets) turns both off then adds a little back at the end; jerseyboy says the controls are subtle even on real amps. willjrock says Ripple "doesnt even work half the time" (one claim, unverified).

What matters for a builder:

- Sag, Bias and Bias X do little unless the power amp is distorting. amsdenj, forum thread 30750. A commenter on Hunter's post says the same about higher Master. So at low Master they are mostly inert.
- Master versus Drive: forum (unattributed, search summary) says low Master with high Drive gives smoother preamp distortion; high Master with lower Drive gives more power-amp (more aggressive) distortion. DunedinDragon (https://line6.com/support/topic/26948-rules-of-thumb-and-tips-for-creating-new-presets): Master adds dirt, Channel Volume is cleaner.
- Where makers disagree on Ch Vol: DunedinDragon says on a Fender Deluxe model Channel Volume changed the crunch and he prefers the Output block for level; lawrence_Arps and knoxdaz10 say Channel Volume changes level without tone and any change comes from driving later blocks harder (https://line6.com/support/topic/23132-patch-normalization-methods-and-guidelines/). willjrock: Ch Vol also changes how hard post-amp blocks like compressors are driven. mdmayfield: Ch Vol 7-8 with later effects caused clipping and harshness; lowering it and raising the Output level fixed it.
- Defaults: Hunter and the forum agree most players should leave Bias X, Hum, Ripple alone. aleclee (thread 26948) kept amp defaults as a starting point, left mids alone and adjusted lows and highs. This is one user's practice.
- Sadites: Part 4 of his series is "Using Sag, Hum, Ripple, Bias etc." (https://kb.line6.com/helix-tutorials-by-jason-sadites). Content not read. Unconfirmed.

Single data point on Master and feel: DunedinDragon moved Helix's hardware Master knob from about 11 o'clock to 3 o'clock and cut Channel Volumes (Twin model 9 to about 5.5-6; Placater 7-7.5 to 4-5), reporting more touch dynamics (https://line6.com/support/topic/44877-experiments-with-helix-master-volume-settings/). Others heard no difference (cruisinon2). Note this is the Master knob on the unit, not the amp block's Master parameter; it is not evidence about the block's Master. Treat as unconfirmed.

## 2. Cab block

Line 6 facts (Stadium manual, https://manuals.line6.com/en/helix-stadium/live/cab-blocks; 3.50 notes, https://kb.line6.com/helix-3-50-release-notes):

- 3.50 (November 2022) added a new cab engine: 20 guitar cabs and 4 bass cabs (sources disagree; one says 24 guitar-and-bass total), each as Single or Dual, with up to 12 mics. Legacy Single/Dual are the older Hybrid cabs. New cabs use 66-80% less DSP than Hybrid cabs (search summary of the release notes).
- Mic Distance 1.00-12.00 in, Angle 0-45 degrees. Low Cut is a high-pass filter ("may be useful in removing undesirable low end rumble"); High Cut a low-pass ("high end harshness"). The manual gives no default or recommended values. It says mic choice can affect tone as much as the amp's tonestack or an EQ block.
- Delay: the manual recommends 0.0 ms. For two cabs/IRs that sound thin, try inverted Polarity. Stadium only; Helix 3.50 manual not read.

Cut values (all forum, i.e. taste, with broad agreement on the range):

| Source | Low cut | High cut | Note |
|---|---|---|---|
| efrati (https://line6.com/support/topic/29771-how-do-you-handle-high-end-brightness-of-the-helix) | 100-130 Hz | 3.5-5 kHz | prefers IRs with cuts built in |
| rvroberts, brettchinery (same thread) | 100 Hz | 5 kHz | cab block |
| shanecgriffo (same thread) | | down to 3 kHz | shallow slope, so go further than expected |
| talwilkins (https://line6.com/support/topic/16925-global-eq-and-live-sound-advice/) | | 2-4 kHz | fixed muddy Brit 2204 |
| HonestOpinion (same) | 60-120 Hz | 4-8 kHz (uses about 5) | full-range/PA |
| themetallikid (https://line6.com/support/topic/46380-low-cut-settings/) | 100-200, settles near 150 | | cuts before the amp, high cut post |
| twystedriffs (thread 26948) | about 120 Hz | 5-13 (units unclear) | |
| troy (https://line6.com/support/topic/32956-tips-for-use-with-power-amp-cab/) | 80 Hz | 12 kHz | before the 1/4 in out into a guitar cab |
| Glenn DeLaune, 2017 | | "use the Hi Cut to tame some of the high end" | on an EV ZLX; no number (https://line6.com/support/topic/21517-glenn-delaune/) |

- Disagreement: DunedinDragon says the harshness comes from FRFR speakers and should first be fixed with mic distance, off-cone placement and room reflections, with cuts only if needed; he sometimes uses no cuts. cruisinon2 says cab cuts are "close to essential, especially with FRFR" (https://line6.com/support/topic/31926-building-your-tone/). efrati and others say it depends on amp, cab, mic and position.
- Slopes: cab-block cuts are shallower than the Low/High Cut EQ block. SaschaFranck estimates about 6 dB/oct versus at least 12 (https://line6.com/support/topic/65836-help-me-understand-lowhigh-cut-on-cabsirs), an estimate not a Line 6 figure. AlexKenivel (thread 29771): aggressive cab cuts, then an EQ block with steeper cuts just outside them so the curve tapers.
- FRFR versus real guitar cab: to use Helix into a real guitar cab or amp return, forum answers say turn the cab block off or use a preamp (jws1982, PaulWilliamson, thread 32956). For the Powercab: the global EQ does not pass through L6 Link; other EQ blocks do; its own low/high cuts are set in the Powercab tab (HonestOpinion, https://line6.com/support/topic/59793-highlow-cut-pc112-helixlt). davedivessails cites about 50-60 Hz low and about 10-12 high (units not stated) on the Powercab. I found nothing on cab-block use with Powercab speaker modelling, so how cuts change there is unconfirmed.
- Dual cabs: blended with a split (DunedinDragon: use separate cab blocks in parallel with an A/B split to balance; Line 6 note: Dual cabs cost twice the DSP). If two cabs or IRs sound thin, try inverted polarity (Line 6, Stadium manual).
- Legacy versus new: forum opinions only. Some say new cabs alone now suffice for high gain, others say IRs still sound better; one report of phase problems swapping new for legacy, contradicted by another. No maker guidance found on mic or distance habits for the new cabs. One user says increasing distance helps more on new cabs (single report).
- IRs versus stock: Sadites Parts 11 and 13 ("Stock Cabs vs. IR's", "Stock Cabs REVISITED") exist; content not read. Forum: IRs may carry built-in filtering (zolko60; efrati).
- Mics: efrati favors ribbons (4038); brettchinery a 121 ribbon at setting 6 with 50% reflections. Single users' taste. Sadites Part 26 covers mic models; not read.

## 3. Gain staging

- Drive into amp: Nail The Mix (https://www.nailthemix.com/line-6-helix; high-gain metal): drive pedal (Compulsive Drive) low drive, high level, a graphic EQ before the amp, turn the amp's gain down to compensate. No values given.
- Tube Screamer as a boost: the general guidance (Guitar World, search summary) is low drive, high level. A Helix forum user found the Helix TS model adds more distortion at 0 gain than the pedal. A shared profile lists Scream 808 gain 2.6, tone 4.6, level 8.5 (Tone3000; low reliability). amsdenj: TS-type pedals suit Fender-style amps (mid scoop) and less so Marshall styles; Chris Buck stacks several lightly clipping pedals (https://line6.com/support/topic/43428-chris-buck-tube-screamer-trick-in-helix). Kinky Boost at drive 0 suits mid-focused amps (same). EP Boost: Boost on, Bright off, gain about 2 (about 4-5 for lead) (forum, thread 30587; one user). Minotaur gain 0.7, tone 3.5-3.8 (The Gear Forum; one user). I found no maker-published "standard" settings.
- Input pad and Guitar In Z: Helix Help says lower In-Z gives softer feel and fewer highs; higher gives fuller, more gain, tighter. Forum: pad is per-preset from firmware 3.15 (one post). Opinions conflict: pad on suits low-to-medium output guitars (brettchinery); pad on sounded dull on a Strat (yossarian1156); jbuhajla plays Strats and Teles pad off. Guitarzman: avoid the pad, rarely use global EQ, In-Z Auto or 1 MOhm. Another user keeps the pad on and adds +5.5 dB gain at the front for single coils. Lachdanan0121: pad on for four of five guitars, volume block for the weakest. No maker numbers.
- Compressors: forum placement. DunedinDragon: Red Squeeze or Deluxe Comp right after the volume pedal for squish; LA Studio at the end if no front comp. cruisinon2: compressor in front of the amp on clean single-coil tones for sustain. Guitarzman: 3-Band compressor, Red Squeeze/MXR. aleclee: 3-Band comp tamed harshness better than EQ. Sadites Part 5 is on compressors; not read. Sadites' "LA Comp Style" is mentioned second-hand by themetallikid.
- Build order (forum, DunedinDragon, jbuhajla, thread 26948/31926): amp and cab first; then drives; then effects. brue58ski: build as if mixing a miked amp in a studio control room.
- Level per block: amsdenj: keep each block near unity and run Master around 1-3 o'clock to avoid converter clipping. zooey disagrees: not every block should sit at unity, especially before the amp (thread 23132).

## 4. EQ after the cab, and Global EQ

- Nail The Mix (metal): pre-amp graphic EQ -2 dB at 125 Hz and -2 dB at 250 Hz; post-amp parametric narrow cuts near 500 Hz (boxy) and 800 Hz (honk), no dB amounts.
- DunedinDragon (thread 26948): narrow 2-3 dB cut around 180-220 Hz for boominess; around 4000-5000 Hz to tame highs. Thread 31926: slight cut about 2000 Hz on Strats and Teles for "beef"; cut about 500 Hz for muddiness.
- themetallikid (thread 46380): pre-EQ for flubby bass, post-EQ for harsh highs; narrow boost near 120 Hz post, low cut 100-120.
- A recurring rule: "cut bass before distortion and treble after" (forum). Craig Anderton cleans a high-frequency band with a low cut near 400 Hz in multiband setups (thread 65836).
- HonestOpinion's method: boost a narrow band and sweep, cut as little as possible.
- Global EQ: Glenn DeLaune (July 2016): "I'm not using the Global EQ ... I haven't used it since November of last year." cruisinon2: Global EQ "is really for fine-tuning for the room." DunedinDragon, Doug6String and Guitarzman: do not put cuts in Global EQ; set per preset. Some do use it: davidb7170 cut about 8 dB at 3 kHz to tame a PA speaker; one user runs low cut 90 Hz and high cut 6 kHz in Global (a search summary says Fremen patches were among those used; unconfirmed). Sadites Part 29 is "Global EQ - When Should I Use it?"; not read.
- Do not guess about "Fletcher-Munson": rvroberts, tommasi and others say tune at performance volume; louder volume means a higher low cut is reasonable.

## 5. Time-based effects

Sparse maker information. Mostly forum.
- Mix: a full-band tip is to turn mix down (one user: mix 15-20 with full band to avoid washing out). A worship guitar article (worshiponline.com, not fetched) says lower mix for big-chord moments; high feedback and very low mix for a quiet ambient bed; a little pre-delay adds clarity at higher mix. Another forum poster: heavy reverb mix (over 50) with heavy delay mix and shorter feedback, in parallel, for worship. These are one-person views and conflict on level.
- Placement: DunedinDragon puts delay and reverb just before the final comp and mixes both through a split; harmonizers after the EQ (thread 31926) or after amp and cab (thread 26948), while Rocco_Crocco puts harmonizers between amp and cab. Spring reverb and tremolo are kept between amp and cab by splitting amp and cab (PeterHamm). One user puts delay before reverb to smooth repeats without lowering mix.
- Sadites: Part 7 delays, Part 8 stereo delays, Part 16 reverb, Part 19 FX placement, Part 27 tempo. Content not read.
- Mono versus stereo and trails: Helix Help only says FX Loop Trails on lets an external effect keep decaying when bypassed. I found no maker statement on mono versus stereo for guitar.

## 6. Single coils versus humbuckers

All forum, no maker data.
- Several users keep separate presets per guitar (thread 34353). Level differs and there is no one fix.
- Pad: see Q3. One user adds a front gain block (+5.5 dB) for single coils.
- Fizzy highs with humbuckers: suggested fix is better EQ in the lower mids.
- Compressor in front for single coils (cruisinon2); slight 2 kHz cut on Strats and Teles (DunedinDragon).
- Amp drive: Hunter and others say nothing specific. The Tube Screamer note in Q3 (Fender-like amps for TS) is amp-type, not pickup-type. No published numbers found.

## 7. Published target numbers

- Craig Anderton (https://line6.com/support/topic/61955-wow-i-got-a-loundness-meter-and-it-made-a-huge-difference-on-my-tone): -15 LUFS "a happy place for Helix" when playing hard with passive humbuckers and unity afterwards; for normal playing aims for -18 LUFS; with Helix bypassed his guitar reads -18 LUFS, so he adjusts each preset to match. He calls LUFS "suggestions" for guitar.
- DAW peak method (thread 23132): Verne-Bunsen about -12 dBFS on a strong strum, 3-5 dB more for leads; captainnemo70 clean about -12, solo about -9 and found a 6 dB or more lift needed in a band.
- johneric8 (thread 61955): clean about -30 dB, overdrive about -34 dB, unit unspecified. PaulTBaker: peaks about -15 to -12.
- DunedinDragon: about 100 dB average on a sound meter; builds at 80-90 dB (also stated in thread 26948). Helix Help: Output level sets overall path level; pressing Knob 2 returns to unity 0.0 dB.
- Disagreement: peak figures (-12 dBFS) versus loudness (-18 LUFS) are not the same measure. Anderton also says meters do not predict fit in a band. brue58ski agrees.
- Sadites Part 31 is "Volume Level Matching: Why It Is Crucial?" but his figures were not read.

## 8. Mistakes they warn against

- Cutting in Global EQ for every preset (DunedinDragon, Doug6String, DeLaune's own non-use).
- Building at low volume then playing loud (rvroberts, gunpointmetal, DunedinDragon).
- Using Drive for level matching: use Channel Volume or Output level (komposition101 blog, secondary).
- Clipping inside the chain from hot Ch Vol before post effects (mdmayfield, HonestOpinion).
- Too much gain: BBD_123 "less is indeed more"; with more distortion you need more bass and treble cut (forum).
- Standing next to the speaker and using EQ to fix what is a placement problem (MikeDV1: floor placement cut the sharp sound).
- Relying on meters alone and not testing against the band (brue58ski, captainnemo70).
- Leaving the cab on when feeding a real amp or cab (jws1982).
- Overusing Hum, Ripple, Bias X (consensus above).

## Checkable claims

- Low Cut raises: cab Low Cut 100-130 Hz, High Cut 3.5-5 kHz on a high-gain preset should give lower spectral centroid and a clear drop above the High Cut; the same preset with cuts off should be visibly brighter. (Forum consensus; test with a stock new cab and a 57-type mic.)
- Cab-block cut slope is shallower than an EQ-block cut: same 5 kHz High Cut in each; the cab block should leave more energy at 8-10 kHz. (SaschaFranck's estimate 6 versus 12 dB/oct.)
- Sag, Bias and Bias X do almost nothing at low Master: render a clean amp at Master about 3 with sag 0 versus 10; difference should be small, and larger at Master near 10. (amsdenj; Hunter commenter.)
- Master up and Drive down gives harsher, power-amp distortion than the reverse at the same loudness; compare crest factor and top-end content.
- Ch Vol changes level only: step Ch Vol on an amp with nothing after it; level changes by the dB of the step, spectral balance unchanged. DunedinDragon claims tone changes; test with and without a post-amp compressor to see the difference.
- Dropping Ch Vol by about 3-4 points while raising Output level should leave level equal but change the drive reaching a following compressor or delay (willjrock; mdmayfield).
- Hum and Ripple at 0 versus their defaults: no audible change in a clean signal at normal levels; expect a faint low-frequency tone only with Hum raised (AlexKenivel; Helix Help "freaky" when high).
- Tube Screamer-style drive: Scream 808 at gain 0 should still be clipping more than the real pedal (forum report); drive low, level high should raise the amp's input level and increase amp distortion.
- Level targets: a preset tuned to about -18 LUFS (Anderton) should match bypassed guitar level; peak of a strong strum about -12 dBFS (Verne-Bunsen).
- Pad: Input pad on lowers level by a fixed amount; on a single-coil level test, the same preset should read lower with pad on (the amount is not published by a maker I found).
- Post-cab EQ: -2 dB at 125 and 250 Hz pre-amp (Nail The Mix) should tighten the low end of high gain; narrow cuts near 500 and 800 Hz post-amp should reduce boxiness.
