# Phase 61: Family Router and Capabilities - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The type system knows what family every device belongs to, and the application resolves family at pipeline entry — before any chat or generation begins. Covers: DeviceFamily discriminated union, resolveFamily(), getCapabilities(), DeviceCapabilities interface, and single-resolution-at-entry enforcement.

</domain>

<decisions>
## Implementation Decisions

### Family Grouping
- 4 families: helix, stomp, podgo, stadium
- helix: Floor, LT, Rack (all identical for preset generation)
- stomp: Stomp, Stomp XL
- podgo: Pod Go, Pod Go XL
- stadium: Stadium, Stadium XL
- 3 new DeviceTarget entries added in this phase: helix_rack, pod_go_xl, helix_stadium_xl
- New devices share sibling capabilities until real hardware data validates them

### Within-Family Device Differences
- Stomp vs Stomp XL capability differences: researcher must determine (block count, DSP count, etc.)
- Pod Go vs Pod Go XL capability differences: researcher must determine
- Stadium vs Stadium XL capability differences: researcher must determine
- Helix Floor vs LT vs Rack: identical capabilities for preset generation

### Capabilities Shape
- DeviceCapabilities should encode ALL known hardware-relevant capabilities, not just the 4 in success criteria
- Required fields: block limits (per-DSP AND total), DSP count, dual-amp support, available block types
- Additional fields: snapshot count, path routing options, variax support, send/return loop count, expression pedal count, firmware version range
- Researcher should determine exact values per device from Line 6 documentation

### Claude's Discretion
- Whether getCapabilities() takes DeviceFamily or DeviceTarget (depends on how within-family differences shake out after research)
- Whether to include file format (hlx/pgp/hsp) in DeviceCapabilities or handle separately
- Whether to include amp catalog era (hd2/agoura) in DeviceCapabilities or leave for Phase 62
- How to handle new device functionality — fully functional with sibling data vs gated with warning
- Module file structure (new file vs extending types.ts)

</decisions>

<specifics>
## Specific Ideas

- Helix Rack is identical to Helix Floor — same .hlx format, same capabilities, different form factor
- New devices (Rack, Pod Go XL, Stadium XL) should be in the type system NOW even though their builders and firmware data won't ship until v5.1
- Success criteria require TypeScript compiler rejection when DeviceFamily variants aren't exhaustively handled — discriminated union with exhaustive switch

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DeviceTarget` type (src/lib/helix/types.ts): Already has 6 variants — extend to 9 with rack, pod_go_xl, helix_stadium_xl
- `isHelix()`, `isPodGo()`, `isStadium()`, `isStomp()` helpers: Already do family grouping as boolean functions — these become the basis for resolveFamily()
- `DEVICE_IDS` constant: Maps DeviceTarget to numeric device IDs — extend with new entries
- Pod Go constants (`BLOCK_TYPES_PODGO`, `POD_GO_MAX_USER_EFFECTS`, etc.): Capability data already exists in scattered form

### Established Patterns
- Discriminated unions used throughout: `BlockType`, `AmpCategory`, `TopologyTag` — DeviceFamily follows same pattern
- `Record<K, V>` for lookup tables: `DEVICE_IDS` is `Record<DeviceTarget, number>` — DeviceCapabilities map follows same pattern
- Type-only imports via `import type` — keeps types out of runtime bundles
- Constants are UPPERCASE: `DEVICE_IDS`, `BLOCK_TYPES_PODGO` — new capability constants follow suit

### Integration Points
- `src/lib/helix/types.ts`: Where DeviceTarget lives — DeviceFamily and DeviceCapabilities go here or adjacent file
- `src/app/api/generate/route.ts`: Pipeline entry point for generation — resolveFamily() called here
- `src/app/api/chat/route.ts`: Pipeline entry point for chat — resolveFamily() called here
- `src/lib/helix/index.ts`: Public API exports — new types and functions exported here

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 61-family-router-and-capabilities*
*Context gathered: 2026-03-05*
