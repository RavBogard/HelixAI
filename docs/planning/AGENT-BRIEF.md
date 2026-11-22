# Brief for agents working in this repo

helixtone builds Line 6 Helix LT (`.hlx`) and POD Go (`.pgp`) presets from
plain tone specs. Players and gear: `rig/rig.md`. Daniel plays a Helix LT into
a Powercab 212 Plus in flat mode; David plays a POD Go (Jazzmaster) into
full-range speakers.

## Rules

- Work on branch `ccr-1d52fe65-ns2qs9`. Do not commit, push or switch branch
  unless your task says so; the lead commits.
- Do not run anything that uses Helix Native (`-r native`, `tests.test_native`,
  `helixtone atlas measure`, `helixtone bench`, `helixtone auto`) unless your
  task says so: only one process can drive the plugin at a time.
- Do not edit `helixtone/data/` (generated) or anything outside the files your
  task names.
- Never invent a model name, control name or value. `python -m helixtone
  search <text>` and `python -m helixtone show <model>` say what exists.
- File-format and device facts come from real files or cited sources, never
  from memory.
- Do not download paid or pirated preset packs. Free, publicly offered
  material only.
- Do not send Daniel's name, email or project details to any outside service.

## Research tasks

- Every claim carries its source (URL, and who said it). Say when sources
  disagree and when something is one person's taste rather than common
  practice. Mark anything you could not confirm as unconfirmed.
- Prefer primary sources: the maker's own video, post, manual or product
  page over a summary of it.
- Write findings to the file your task names, in plain prose and short
  tables. Where a claim could be checked by rendering a preset and measuring
  it (level, brightness, gain), put it in a final section "Checkable claims"
  as one line each: the claim, the settings involved, what should be seen.

## Report

Under 15 lines back to the lead: what you wrote and where, the three or four
findings that most change how a preset should be built, and what you could
not find. Do not paste the file's contents back.
