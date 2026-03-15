const fs = require('fs');
const params = require('./extracted-params.json');

const schema = {
    schemas: {
        percentage: { type: "slider", min: 0.0, max: 1.0, step: 0.01, unit: "%", displayMultiplier: 100 },
        eq_gain: { type: "slider", min: 0.0, max: 1.0, step: 0.01, unit: "dB", displayMultiplier: 24, displayOffset: -12 },
        db_level: { type: "slider", min: -60.0, max: 12.0, step: 0.1, unit: "dB" },
        time_ms: { type: "slider", min: 0.0, max: 1.0, step: 0.001, unit: "ms", displayMultiplier: 2000 },
        hz_freq: { type: "slider", min: 20.0, max: 20000.0, step: 10.0, unit: "Hz" },
        boolean: { type: "toggle" },
        discrete: { type: "dropdown" }
    },
    parameterMap: {}
};

// Heuristic matching rules
params.forEach(param => {
    const p = param.toLowerCase();

    // 1. Booleans (Switches, Toggles)
    if (p.includes('switch') || p.includes('old_new') || p.includes('jack')) {
        schema.parameterMap[param] = "boolean";
        return;
    }

    // 2. Frequencies (Hz)
    if (p.includes('freq') || p.includes('cut') && !p.includes('shortcut') || p.includes('fc')) {
        schema.parameterMap[param] = "hz_freq";
        return;
    }

    // 3. Time (ms)
    if (p.includes('time') || p.includes('delay') || p.includes('attack') || p.includes('release') || p.includes('decay')) {
        schema.parameterMap[param] = "time_ms";
        return;
    }

    // 4. DB levels (Gain, Level, Thresh)
    if (p.includes('level') || p.includes('thresh') || p.includes('gain') || p.includes('vol') && !p.includes('volume')) {
        if (p.includes('eq') || p.includes('mid') || p.includes('low') || p.includes('high')) {
            schema.parameterMap[param] = "eq_gain"; // EQ specific -12 to +12
        } else {
            schema.parameterMap[param] = "db_level";
        }
        return;
    }

    // 5. Discrete lists (Mic, Mode, Voice, Subdivision)
    if (p.includes('mic') || p.includes('mode') || p.includes('voice') || p.includes('interval') || p.includes('taps') || p.includes('type')) {
        schema.parameterMap[param] = "discrete";
        return;
    }

    // Default to Percentage for continuous dials (Drive, Bass, Mix, Depth, Speed, etc)
    schema.parameterMap[param] = "percentage";
});

fs.writeFileSync('src/lib/helix/inferred-schema.json', JSON.stringify(schema, null, 2));
console.log(`Generated inferred schema for ${Object.keys(schema.parameterMap).length} parameters.`);
