(function (root, factory) {
  "use strict";

  const physics = factory();
  if (typeof module === "object" && module.exports) module.exports = physics;
  root.ShoalingPhysics = physics;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GRAVITY = 9.81;
  const DEFAULTS = Object.freeze({
    deepDepth: 4000,
    shallowDepth: 20,
    offshoreAmplitude: 1,
    period: 1200,
    distance: 300000,
  });
  const journeyCache = new Map();

  /** All depths and distances are in metres; period and travel times in seconds. */
  function normalizeSettings(overrides) {
    const input = overrides || {};
    const settings = {};
    for (const name of Object.keys(DEFAULTS)) {
      const value = input[name] === undefined ? DEFAULTS[name] : Number(input[name]);
      if (!Number.isFinite(value) || (name === "offshoreAmplitude" ? value < 0 : value <= 0)) {
        throw new RangeError("Ungültiger Modellparameter: " + name);
      }
      settings[name] = value;
    }
    if (settings.shallowDepth > settings.deepDepth) {
      throw new RangeError("Die Küstenwassertiefe darf die Tiefseetiefe nicht überschreiten.");
    }
    return Object.freeze(settings);
  }

  function clampPosition(position) {
    const value = Number(position);
    if (!Number.isFinite(value)) throw new RangeError("Die Position muss endlich sein.");
    return Math.max(0, Math.min(1, value));
  }

  function profileDepthAt(position, settings) {
    // Smoothstep gives a schematic continental slope with horizontal end tangents.
    const blend = position * position * (3 - 2 * position);
    return settings.deepDepth + (settings.shallowDepth - settings.deepDepth) * blend;
  }

  function depthAt(position, overrides) {
    return profileDepthAt(clampPosition(position), normalizeSettings(overrides));
  }

  function valuesAt(position, overrides) {
    const settings = normalizeSettings(overrides);
    const depth = profileDepthAt(clampPosition(position), settings);
    const speed = Math.sqrt(GRAVITY * depth);
    const amplitude = settings.offshoreAmplitude * Math.pow(settings.deepDepth / depth, 0.25);
    return {
      depth,
      speed,
      wavelength: speed * settings.period,
      amplitude,
      waveHeight: 2 * amplitude,
    };
  }

  /** Integrate ds / sqrt(g h) once, then interpolate both time and position. */
  function createJourney(overrides, requestedSamples) {
    const settings = normalizeSettings(overrides);
    const requested = requestedSamples === undefined ? 1200 : Number(requestedSamples);
    if (!Number.isFinite(requested) || requested < 2) {
      throw new RangeError("Die Zahl der Integrationsschritte muss mindestens 2 sein.");
    }
    const samples = Math.min(20000, Math.floor(requested));
    const times = new Float64Array(samples + 1);
    const distanceStep = settings.distance / samples;
    let previousSlowness = 1 / Math.sqrt(GRAVITY * settings.deepDepth);

    for (let index = 1; index <= samples; index += 1) {
      const depth = profileDepthAt(index / samples, settings);
      const slowness = 1 / Math.sqrt(GRAVITY * depth);
      times[index] = times[index - 1] + distanceStep * (previousSlowness + slowness) / 2;
      previousSlowness = slowness;
    }

    const totalTime = times[samples];
    return Object.freeze({
      settings,
      totalTime,
      travelTime(position) {
        const fractionalIndex = clampPosition(position) * samples;
        const lowerIndex = Math.floor(fractionalIndex);
        if (lowerIndex >= samples) return totalTime;
        const fraction = fractionalIndex - lowerIndex;
        return times[lowerIndex] + fraction * (times[lowerIndex + 1] - times[lowerIndex]);
      },
      positionAtTime(seconds) {
        const time = Number(seconds);
        if (!Number.isFinite(time)) throw new RangeError("Die Reisezeit muss endlich sein.");
        if (time <= 0) return 0;
        if (time >= totalTime) return 1;
        let lowerIndex = 0;
        let upperIndex = samples;
        while (upperIndex - lowerIndex > 1) {
          const midpoint = Math.floor((lowerIndex + upperIndex) / 2);
          if (times[midpoint] <= time) lowerIndex = midpoint;
          else upperIndex = midpoint;
        }
        const fraction = (time - times[lowerIndex]) / (times[upperIndex] - times[lowerIndex]);
        return (lowerIndex + fraction) / samples;
      },
    });
  }

  function cachedJourney(overrides) {
    const settings = normalizeSettings(overrides);
    const key = Object.values(settings).join(":");
    if (journeyCache.has(key)) return journeyCache.get(key);
    const journey = createJourney(settings);
    // Keep interactive parameter changes from growing the cache indefinitely.
    if (journeyCache.size >= 16) journeyCache.delete(journeyCache.keys().next().value);
    journeyCache.set(key, journey);
    return journey;
  }

  return Object.freeze({
    GRAVITY,
    DEFAULTS,
    normalizeSettings,
    depthAt,
    valuesAt,
    createJourney,
    travelTime: (position, settings) => cachedJourney(settings).travelTime(position),
    positionAtTime: (seconds, settings) => cachedJourney(settings).positionAtTime(seconds),
  });
});
