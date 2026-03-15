import { buildHspFile } from "@/lib/helix/stadium-builder";
import * as fs from "fs";
import * as path from "path";

const baseline = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "baseline/clean-helix_stadium.json"), "utf-8")
);
const hsp = buildHspFile(baseline.presetSpec);

console.log("=== .hsp JSON structure ===");
console.log(JSON.stringify(hsp.json, null, 2));
console.log("\n=== Serialized (first 200 chars) ===");
console.log(hsp.serialized.substring(0, 200));
