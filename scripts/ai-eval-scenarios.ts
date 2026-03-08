// scripts/ai-eval-scenarios.ts
// Standard test scenarios for AI platform evaluation (Phase 4).
// Each scenario is a realistic conversation history covering a specific genre + device.

import type { DeviceTarget } from "../src/lib/helix/types";

export interface EvalScenario {
  id: number;
  name: string;
  genre: string;
  device: DeviceTarget;
  /** Expected amp category for appropriateness scoring */
  expectedAmpCategory: "clean" | "crunch" | "high_gain";
  /** Keywords that should appear in effects for appropriateness */
  expectedEffectKeywords: string[];
  messages: Array<{ role: string; content: string }>;
}

export const SCENARIOS: EvalScenario[] = [
  // ── Scenario 0: Clean Country (Helix LT) ──
  {
    id: 0,
    name: "Clean Country",
    genre: "country",
    device: "helix_lt",
    expectedAmpCategory: "clean",
    expectedEffectKeywords: ["Comp", "Delay"],
    messages: [
      { role: "user", content: "Hey! I play country and chicken pickin' style. Looking for that sparkly clean tone." },
      { role: "assistant", content: "Nice! Country tones are all about that spanky clean sound. What guitar are you using? Telecaster or something else?" },
      { role: "user", content: "Yep, Fender Telecaster with single coil pickups. I play in a band at local bars." },
      { role: "assistant", content: "Perfect — Tele single coils are ideal for country. Do you want any effects? Compressor is a must for chicken pickin'. Maybe a slapback delay?" },
      { role: "user", content: "Yes! Compressor for sure, slapback delay, and maybe a subtle chorus for some shimmer. Keep it clean, no dirt." },
    ],
  },

  // ── Scenario 1: High-Gain Metal (Helix Floor) ──
  {
    id: 1,
    name: "High-Gain Metal",
    genre: "metal",
    device: "helix_floor",
    expectedAmpCategory: "high_gain",
    expectedEffectKeywords: ["Gate", "Dist"],
    messages: [
      { role: "user", content: "I need a crushing metal tone. Think modern djent / progressive metal." },
      { role: "assistant", content: "Awesome! What guitar are you running? Extended range or standard 6-string?" },
      { role: "user", content: "7-string with active EMG pickups. I need tight low end and lots of gain." },
      { role: "assistant", content: "EMGs are perfect for this. Do you want a boost pedal in front of the amp for extra tightness? And any specific effects — noise gate is a must for this gain level." },
      { role: "user", content: "Definitely a noise gate and a tube screamer boost in front. For lead, I want a delay and maybe a subtle reverb. Keep it tight and aggressive." },
    ],
  },

  // ── Scenario 2: Ambient Worship (HX Stomp) ──
  {
    id: 2,
    name: "Ambient Worship",
    genre: "worship",
    device: "helix_stomp",
    expectedAmpCategory: "clean",
    expectedEffectKeywords: ["Delay", "Reverb"],
    messages: [
      { role: "user", content: "I play at my church and need ambient, pad-like tones. Think Hillsong / Bethel style." },
      { role: "assistant", content: "Great! Those worship tones rely on big delays and lush reverbs. What guitar?" },
      { role: "user", content: "Fender Strat with single coils. I need it to work on my HX Stomp — limited blocks." },
      { role: "assistant", content: "With the Stomp's 8-block limit, we'll need to be strategic. Delay and reverb are essential. Want a light drive for the louder sections?" },
      { role: "user", content: "Yes, a light overdrive for swells. The ambient snapshot should have heavy reverb and dotted eighth delay. Keep the clean really pristine." },
    ],
  },

  // ── Scenario 3: Blues Rock (Pod Go) ──
  {
    id: 3,
    name: "Blues Rock",
    genre: "blues",
    device: "pod_go",
    expectedAmpCategory: "crunch",
    expectedEffectKeywords: ["Reverb"],
    messages: [
      { role: "user", content: "I'm looking for a classic blues rock tone. Think SRV, BB King, that warm overdriven sound." },
      { role: "assistant", content: "Love it! Blues is all about feel and dynamics. What guitar are you playing?" },
      { role: "user", content: "Gibson Les Paul with humbuckers. Playing through a Pod Go." },
      { role: "assistant", content: "Les Paul into a crunchy amp is a classic combo. Want a Tube Screamer style boost for solos? And what about reverb — spring or hall?" },
      { role: "user", content: "Spring reverb for sure, and yes a tube screamer for the lead channel. Maybe a wah for some funk moments. Keep it simple and responsive." },
    ],
  },

  // ── Scenario 4: Modern Prog (Helix LT, dual-amp) ──
  {
    id: 4,
    name: "Modern Prog",
    genre: "progressive",
    device: "helix_lt",
    expectedAmpCategory: "high_gain",
    expectedEffectKeywords: ["Delay", "Reverb"],
    messages: [
      { role: "user", content: "I play progressive rock/metal — think Periphery, Animals as Leaders, Plini style." },
      { role: "assistant", content: "That's a wide tonal range! These artists use clean to high-gain tones. What's your guitar setup?" },
      { role: "user", content: "Strandberg with Fishman Fluence pickups. I want a dual-amp setup — one clean, one high-gain." },
      { role: "assistant", content: "Dual-amp is perfect for prog — blend a pristine clean with a tight high-gain. Any specific effects?" },
      { role: "user", content: "Definitely delay and reverb for the clean side. Noise gate for the high-gain side. Maybe a pitch shifter for some harmonized lead lines. I want 8 snapshots covering everything from crystal clean to crushing heavy." },
    ],
  },

  // ── Scenario 5: Classic Rock (Stadium) ──
  {
    id: 5,
    name: "Classic Rock",
    genre: "classic_rock",
    device: "helix_stadium",
    expectedAmpCategory: "crunch",
    expectedEffectKeywords: ["Reverb", "Delay"],
    messages: [
      { role: "user", content: "I need a classic rock tone for my Stadium. Think AC/DC, Zeppelin, Hendrix." },
      { role: "assistant", content: "Classic rock heaven! Those are three slightly different flavors — AC/DC is more crunch, Zeppelin is bluesy, Hendrix is psychedelic. Which way do you lean?" },
      { role: "user", content: "More AC/DC / Angus Young. Crunchy British amp pushed hard. Humbucker guitar." },
      { role: "assistant", content: "Marshall-style crunch with humbuckers is the recipe. Any effects you want?" },
      { role: "user", content: "Just reverb and maybe a delay for solos. Keep it simple and raw — the amp tone should do the work. I want the crunch to clean up when I roll back the volume knob." },
    ],
  },
];
