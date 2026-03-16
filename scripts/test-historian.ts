import { callGeminiHistorian, callGeminiPlanner } from "../src/lib/planner";

async function run() {
  const messages = [{ role: "user", content: "The Edge's guitar tone on U2 - Mysterious Ways" }];
  console.log("Running Historian Agent...");
  
  const bp = await callGeminiHistorian(messages);
  console.log("\n--- HISTORIAN BLUEPRINT ---");
  console.log(JSON.stringify(bp, null, 2));

  const historianPromptInject = `HISTORIAN RESEARCH OVERRIDE:
The Historian Agent has analyzed the request and determined the following:
Song/Artist: ${bp.songTarget}
Amp Era: ${bp.ampEra}
Historically Accurate Effects: ${bp.mandatoryCoreEffects.join(", ")}
Notes: ${bp.historianNotes}

You MUST utilize this historical context. Act as the device-specialized audio engineer: pick the specific Line 6 models that best match this gear, and use your DSP limits to filter the list to only the essentials that fit on the board.`;

  console.log("\nRunning Planner Agent...");
  const intent = await callGeminiPlanner(messages, "helix_lt", "helix", historianPromptInject);
  
  // Apply the manual overrides just like our API route
  intent.tempoHint = bp.bpm;
  intent.delaySubdivision = bp.delaySubdivision;

  console.log("\n--- PLANNER TONE INTENT ---");
  console.log(JSON.stringify(intent, null, 2));
}

run().catch(console.error);
