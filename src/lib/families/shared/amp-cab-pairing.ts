// src/lib/families/shared/amp-cab-pairing.ts
// Shared amp-to-cab pairing table builder.
// Pure function returning prompt text — receives all content via parameters.

/**
 * A grouping of amps by family with their recommended cab pairings.
 * Each family's prompt provides its own pairings data — no model names live here.
 */
export interface AmpCabPairing {
  /** Amp family grouping (e.g., "Fender", "Marshall", "Agoura") */
  ampFamily: string;
  /** Amp model names in this family */
  amps: string[];
  /** Cab names that pair well with these amps */
  recommendedCabs: string[];
}

/**
 * Returns an amp-to-cab pairing table section for planner prompts.
 * The table is formatted as a markdown table from the provided pairings data.
 * Each family calls this with its own device-specific pairings.
 */
export function ampCabPairingSection(pairings: AmpCabPairing[]): string {
  if (pairings.length === 0) {
    return "";
  }

  const rows = pairings.map(
    (p) => `| ${p.ampFamily} (${p.amps.join(", ")}) | ${p.recommendedCabs.join(", ")} |`
  );

  return `## Amp-to-Cab Pairing

Pair amps with historically correct cabs. Match the amp's era and speaker voicing:

| Amp Family | Recommended Cabs |
|------------|-----------------|
${rows.join("\n")}

If the requested tone doesn't fit a row above, choose a cab with matching era and speaker voicing.`;
}
