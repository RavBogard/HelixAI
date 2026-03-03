---
created: 2026-03-03T15:55:17.986Z
title: Investigate Helix Floor device compatibility bug
area: ui
files: []
---

## Problem

Users report getting an "incompatible device type" error when selecting Helix Floor in the device picker. The same presets/workflow works correctly when choosing Helix LT instead. This was reported by user Shane Booth and potentially others.

Key symptoms:
- Selecting "Floor" as device type triggers "incompatible device type" error
- Selecting "LT" works fine for the same user
- Suggests device type validation, preset compatibility filtering, or device constant definitions may incorrectly classify or reject the Floor model

## Solution

Deep dive investigation needed:
1. Trace device type definitions and constants for Floor vs LT
2. Review preset validation/filtering logic that checks device compatibility
3. Check if Floor-specific device ID or family mapping is missing or incorrect
4. Compare how Floor and LT are differentiated in the device picker and downstream logic
5. Test with Floor-specific presets to reproduce the issue
