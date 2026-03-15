import { ANCHORS } from "../../helix/catalogs/anchors";

export function anchorCatalogSection(): string {
  let section = `## Semantic Anchors\n\n`;
  section += `You MUST select ONE of the following expertly-tuned \`anchorId\`s as the foundation for the preset. `;
  section += `Do not attempt to build a rig from scratch. Choose the closest anchor to the user's request and use \`userTweaks\` to customize the amp or cab parameters if needed.\n\n`;

  for (const anchor of Object.values(ANCHORS)) {
    section += `- **${anchor.id}**: ${anchor.name} - ${anchor.description}\n`;
  }

  section += `\n### User Tweaks\n`;
  section += `If the user requests specific tone adjustments (e.g., "more bass", "less gain"), provide these as numeric overrides (0.0 to 1.0) in the \`userTweaks\` object. `;
  section += `For example: \`{ "userTweaks": { "amp": { "Bass": 0.8, "Drive": 0.3 } } }\`.\n`;
  return section;
}
