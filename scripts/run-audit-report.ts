// Quick script to run the full audit and print per-device report
import { runAudit } from "../src/lib/helix/audit-runner";
import { formatAuditReport, formatAuditJson } from "../src/lib/helix/audit-report";
import { MOCK_SCENARIOS } from "../src/lib/helix/mock-scenarios";
import type { CorpusConfig } from "../src/lib/helix/reference-corpus";

const corpusConfig: CorpusConfig = {
  helix: [
    "C:\\Users\\dsbog\\OneDrive\\Desktop\\Strab ORNG RV SC.hlx",
    "C:\\Users\\dsbog\\OneDrive\\Desktop\\TONEAGE 185.hlx",
    "C:\\Users\\dsbog\\OneDrive\\Desktop\\Vox Liverpool.hlx",
    "C:\\Users\\dsbog\\Downloads\\Alchemy Sultan 2.hlx",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JSDualChmpMan.hlx",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS-EVPanRed.hlx",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS-GermXRed.hlx",
  ],
  stomp: [
    "C:\\Users\\dsbog\\Downloads\\CATS NO OTO4.hlx",
    "C:\\Users\\dsbog\\Downloads\\Bass Rig.hlx",
    "C:\\Users\\dsbog\\Downloads\\Fillmore Beast.hlx",
    "C:\\Users\\dsbog\\Downloads\\Parallel X.hlx",
    "C:\\Users\\dsbog\\Downloads\\Throne of Grass.hlx",
    "C:\\Users\\dsbog\\Downloads\\MATCH CH.2.hlx",
    "C:\\Users\\dsbog\\Downloads\\Synyster Gates.hlx",
  ],
  podgo: [
    "C:\\Users\\dsbog\\Downloads\\ROCK CRUNCH.pgp",
    "C:\\Users\\dsbog\\Downloads\\A7X.pgp",
    "C:\\Users\\dsbog\\Downloads\\AI CHICK_ROCK.pgp",
    "C:\\Users\\dsbog\\Downloads\\AI SANTANA DRG.pgp",
    "C:\\Users\\dsbog\\Downloads\\MUNTAZIR SOLO.pgp",
    "C:\\Users\\dsbog\\Downloads\\GrindZilla .pgp",
    "C:\\Users\\dsbog\\Downloads\\The Hell Song.pgp",
  ],
  stadium: [
    "C:\\Users\\dsbog\\Downloads\\NH_STADIUM_AURA_REFLECTIONS\\NH_BoomAuRang.hsp",
    "C:\\Users\\dsbog\\Downloads\\NH_STADIUM_AURA_REFLECTIONS\\Stadium Rock Rig.hsp",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS USSperBlck Vib.hsp",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS EV Panama Blue.hsp",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS Solid 100.hsp",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS German Xtra Blue.hsp",
    "C:\\Users\\dsbog\\Downloads\\new presets\\JS - Dual ChampMan\\JS Brit JuJube.hsp",
  ],
};

console.log("Running full audit: 25 scenarios × 4 device families...\n");

const result = runAudit({
  scenarios: MOCK_SCENARIOS,
  corpusConfig,
});

console.log(formatAuditReport(result));
console.log("\n\n=== JSON SUMMARY ===\n");
console.log(JSON.stringify(formatAuditJson(result), null, 2));
