(function (root, factory) {
  "use strict";

  const physics = factory();
  if (typeof module === "object" && module.exports) module.exports = physics;
  root.RegionalShoaling = physics;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GRAVITY = 9.81;
  const DEEP_DEPTH = 2000;
  const SHALLOW_DEPTH = 20;
  const DISTANCE = 120000;
  const DEFAULTS = Object.freeze({ incomingHeight: 2, period: 1200, geometryEffect: true });

  function profile(points) {
    return Object.freeze(points.map(([position, depth]) => Object.freeze({ position, depth })));
  }

  // These are deliberately schematic profiles, not measured bathymetry or a
  // reconstruction of a 2004 transect. Both end at the same 20 m water depth.
  const PRESETS = Object.freeze({
    bandaAceh: Object.freeze({
      id: "bandaAceh",
      name: "Banda Aceh · Nordwest-Sumatra",
      shortName: "Banda Aceh",
      profile: profile([[0, 2000], [0.30, 1800], [0.62, 300], [0.80, 70], [1, 20]]),
      endpointRayWidth: 0.65,
      incomingHeight: 3,
      description: "Schematischer Küstentransekt: frühere Abflachung und längeres flaches Endsegment.",
      geometryDescription: "Illustrative Konvergenz: effektive Bündelbreite nimmt von 1 auf 0,65 ab.",
    }),
    sriLanka: Object.freeze({
      id: "sriLanka",
      name: "Sri Lanka · Ostküste bei Kalmunai",
      shortName: "Sri Lanka",
      profile: profile([[0, 2000], [0.58, 1850], [0.84, 350], [0.95, 100], [1, 20]]),
      endpointRayWidth: 1.25,
      incomingHeight: 1.5,
      description: "Schematischer Küstentransekt: spätere Abflachung und kürzeres flaches Endsegment.",
      geometryDescription: "Illustrative Divergenz: effektive Bündelbreite nimmt von 1 auf 1,25 zu.",
    }),
  });

  // A change in incident forcing must remain separate from local shoaling.
  // The regional input heights illustrate this distinction; they are not
  // observations of incoming wave heights at these offshore model endpoints.
  const MODE_PRESETS = Object.freeze({
    equal: Object.freeze({
      bandaAceh: Object.freeze({ ...DEFAULTS }),
      sriLanka: Object.freeze({ ...DEFAULTS }),
    }),
    regional: Object.freeze({
      bandaAceh: Object.freeze({ ...DEFAULTS, incomingHeight: 3 }),
      sriLanka: Object.freeze({ ...DEFAULTS, incomingHeight: 1.5 }),
    }),
  });

  function resolveRegion(region) {
    if (region && typeof region === "object") region = region.id;
    const aliases = { BandaAceh: "bandaAceh", SriLanka: "sriLanka", "banda-aceh": "bandaAceh", "sri-lanka": "sriLanka" };
    const key = aliases[region] || region;
    if (!Object.prototype.hasOwnProperty.call(PRESETS, key)) {
      throw new RangeError("Unbekannte Modellregion: " + String(region));
    }
    return PRESETS[key];
  }

  function normalizeSettings(overrides) {
    const input = overrides || {};
    const incomingHeight = input.incomingHeight === undefined ? DEFAULTS.incomingHeight : Number(input.incomingHeight);
    const period = input.period === undefined ? DEFAULTS.period : Number(input.period);
    const geometryEffect = input.geometryEffect === undefined ? DEFAULTS.geometryEffect : input.geometryEffect;
    if (!Number.isFinite(incomingHeight) || incomingHeight < 0) {
      throw new RangeError("Die Eingangswellenhöhe muss endlich und nicht negativ sein.");
    }
    if (!Number.isFinite(period) || period <= 0) {
      throw new RangeError("Die Wellenperiode muss endlich und positiv sein.");
    }
    if (typeof geometryEffect !== "boolean") {
      throw new TypeError("geometryEffect muss true oder false sein.");
    }
    return Object.freeze({ incomingHeight, period, geometryEffect });
  }

  function settingsForMode(mode, region, overrides) {
    const preset = resolveRegion(region);
    if (!Object.prototype.hasOwnProperty.call(MODE_PRESETS, mode)) {
      throw new RangeError("Unbekannter Vergleichsmodus: " + String(mode));
    }
    return normalizeSettings({ ...MODE_PRESETS[mode][preset.id], ...(overrides || {}) });
  }

  function clampPosition(position) {
    const value = Number(position);
    if (!Number.isFinite(value)) throw new RangeError("Die Position muss endlich sein.");
    return Math.max(0, Math.min(1, value));
  }

  // Shape-preserving cubic Hermite interpolation (weighted harmonic interior
  // derivatives) keeps the depth decreasing smoothly without overshoot.
  function profileSlopes(points) {
    const intervals = [];
    const secants = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      intervals.push(points[index + 1].position - points[index].position);
      secants.push((points[index + 1].depth - points[index].depth) / intervals[index]);
    }
    const slopes = [0];
    for (let index = 1; index < points.length - 1; index += 1) {
      const left = intervals[index - 1];
      const right = intervals[index];
      const weightLeft = 2 * right + left;
      const weightRight = right + 2 * left;
      slopes.push((weightLeft + weightRight) /
        (weightLeft / secants[index - 1] + weightRight / secants[index]));
    }
    slopes.push(0);
    return slopes;
  }

  const slopesByRegion = Object.fromEntries(Object.values(PRESETS).map((preset) => [preset.id, profileSlopes(preset.profile)]));

  function profileDepth(position, preset) {
    if (position === 0) return DEEP_DEPTH;
    if (position === 1) return SHALLOW_DEPTH;
    const points = preset.profile;
    let lower = 0;
    while (position > points[lower + 1].position) lower += 1;
    const left = points[lower];
    const right = points[lower + 1];
    const width = right.position - left.position;
    const t = (position - left.position) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    const slopes = slopesByRegion[preset.id];
    return (2 * t3 - 3 * t2 + 1) * left.depth +
      (t3 - 2 * t2 + t) * width * slopes[lower] +
      (-2 * t3 + 3 * t2) * right.depth +
      (t3 - t2) * width * slopes[lower + 1];
  }

  /** Position is a fraction 0…1 of the common 120 km model transect. */
  function depthAt(position, region) {
    return profileDepth(clampPosition(position), resolveRegion(region));
  }

  /** Relative effective ray-bundle width b/b0, with b0 = 1 offshore. */
  function rayWidthAt(position, region, enabled = true) {
    const preset = resolveRegion(region);
    const x = clampPosition(position);
    if (typeof enabled !== "boolean") throw new TypeError("enabled muss true oder false sein.");
    if (!enabled) return 1;
    // Lateral convergence/divergence builds mainly along the coastal end of
    // the transect. This is an assumed geometric effect, not a slope multiplier.
    const t = Math.max(0, (x - 0.35) / 0.65);
    const blend = t * t * (3 - 2 * t);
    return 1 + (preset.endpointRayWidth - 1) * blend;
  }

  function valuesAt(position, region, overrides) {
    const preset = resolveRegion(region);
    const settings = normalizeSettings(overrides);
    const x = clampPosition(position);
    const depth = profileDepth(x, preset);
    const speed = Math.sqrt(GRAVITY * depth);
    const shoalingGain = Math.pow(DEEP_DEPTH / depth, 0.25);
    const rayWidth = rayWidthAt(x, preset, settings.geometryEffect);
    const geometryGain = Math.sqrt(1 / rayWidth);
    const amplitude = settings.incomingHeight / 2 * shoalingGain * geometryGain;
    const waveHeight = 2 * amplitude;
    return {
      position: x,
      distance: x * DISTANCE,
      depth,
      speed,
      wavelength: speed * settings.period,
      amplitude,
      waveHeight,
      shoalingGain,
      geometryGain,
      rayWidth,
      incomingHeight: settings.incomingHeight,
      relativeHeight: waveHeight / depth,
      // This is an indication of model limitations, not a breaking criterion.
      nonlinearWarning: waveHeight / depth > 0.2,
    };
  }

  /** Integrate ds/c along this local transect; this is not the 2004 basin travel time. */
  function createJourney(region, overrides, requestedSamples = 2400) {
    const preset = resolveRegion(region);
    const settings = normalizeSettings(overrides);
    const requested = Number(requestedSamples);
    if (!Number.isFinite(requested) || requested < 2) {
      throw new RangeError("Die Zahl der Integrationsschritte muss mindestens 2 sein.");
    }
    const samples = Math.min(20000, Math.floor(requested));
    const times = new Float64Array(samples + 1);
    const distanceStep = DISTANCE / samples;
    let previousSlowness = 1 / Math.sqrt(GRAVITY * DEEP_DEPTH);
    for (let index = 1; index <= samples; index += 1) {
      const slowness = 1 / Math.sqrt(GRAVITY * profileDepth(index / samples, preset));
      times[index] = times[index - 1] + distanceStep * (previousSlowness + slowness) / 2;
      previousSlowness = slowness;
    }
    const totalTime = times[samples];
    return Object.freeze({
      region: preset.id,
      settings,
      distance: DISTANCE,
      totalTime,
      travelTime(position) {
        const fractionalIndex = clampPosition(position) * samples;
        const lower = Math.floor(fractionalIndex);
        if (lower >= samples) return totalTime;
        return times[lower] + (fractionalIndex - lower) * (times[lower + 1] - times[lower]);
      },
      positionAtTime(seconds) {
        const time = Number(seconds);
        if (!Number.isFinite(time)) throw new RangeError("Die Reisezeit muss endlich sein.");
        if (time <= 0) return 0;
        if (time >= totalTime) return 1;
        let lower = 0;
        let upper = samples;
        while (upper - lower > 1) {
          const midpoint = Math.floor((lower + upper) / 2);
          if (times[midpoint] <= time) lower = midpoint;
          else upper = midpoint;
        }
        return (lower + (time - times[lower]) / (times[upper] - times[lower])) / samples;
      },
    });
  }

  return Object.freeze({
    GRAVITY, DEEP_DEPTH, SHALLOW_DEPTH, DISTANCE,
    DEFAULTS, DEFAULT_PARAMS: DEFAULTS, defaultParams: DEFAULTS,
    PRESETS, presets: PRESETS, REGIONS: PRESETS, MODE_PRESETS,
    normalizeSettings, settingsForMode, resolveRegion,
    depthAt, rayWidthAt, valuesAt, createJourney,
  });
});
