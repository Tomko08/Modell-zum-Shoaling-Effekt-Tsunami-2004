"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const physics = require("../regional-physics.js");

const regions = ["bandaAceh", "sriLanka"];
function approximately(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} should approximately equal ${expected}`);
}

test("both regional profiles share depth endpoints and remain smooth and monotone", () => {
  for (const region of regions) {
    assert.equal(physics.depthAt(0, region), 2000);
    assert.equal(physics.depthAt(1, region), 20);
    let previous = physics.depthAt(0, region);
    for (let index = 1; index <= 2000; index += 1) {
      const current = physics.depthAt(index / 2000, region);
      assert.ok(current < previous);
      assert.ok(current >= 20 && current <= 2000);
      previous = current;
    }
    for (const knot of physics.PRESETS[region].profile.slice(1, -1)) {
      const epsilon = 1e-7;
      const leftDerivative = (physics.depthAt(knot.position, region) - physics.depthAt(knot.position - epsilon, region)) / epsilon;
      const rightDerivative = (physics.depthAt(knot.position + epsilon, region) - physics.depthAt(knot.position, region)) / epsilon;
      approximately(leftDerivative, rightDerivative, 5e-5);
    }
  }
  assert.ok(physics.depthAt(0.75, "bandaAceh") < physics.depthAt(0.75, "sriLanka"));
});

test("regional shoaling conserves energy flux A² c b with and without lateral geometry", () => {
  for (const region of regions) {
    for (const geometryEffect of [true, false]) {
      const settings = { incomingHeight: 1.8, period: 900, geometryEffect };
      const offshore = physics.valuesAt(0, region, settings);
      const reference = offshore.amplitude ** 2 * offshore.speed * offshore.rayWidth;
      for (let index = 0; index <= 100; index += 1) {
        const values = physics.valuesAt(index / 100, region, settings);
        approximately(values.amplitude ** 2 * values.speed * values.rayWidth, reference);
        approximately(values.waveHeight, 2 * values.amplitude);
        approximately(values.wavelength, values.speed * settings.period);
        approximately(values.waveHeight / settings.incomingHeight, values.shoalingGain * values.geometryGain);
      }
    }
  }
});

test("different slopes alone cannot change the endpoint Green-law gain at equal depths", () => {
  const settings = { incomingHeight: 2, geometryEffect: false };
  const aceh = physics.valuesAt(1, "bandaAceh", settings);
  const lanka = physics.valuesAt(1, "sriLanka", settings);
  approximately(aceh.waveHeight, lanka.waveHeight);
  approximately(aceh.waveHeight, 2 * Math.pow(100, 0.25));
  assert.equal(aceh.geometryGain, 1);
  assert.equal(lanka.geometryGain, 1);
  assert.notEqual(physics.createJourney("bandaAceh").totalTime, physics.createJourney("sriLanka").totalTime);
});

test("explicit ray convergence and divergence explain their separate geometry gains", () => {
  approximately(physics.rayWidthAt(1, "bandaAceh"), 0.65);
  approximately(physics.rayWidthAt(1, "sriLanka"), 1.25);
  const aceh = physics.valuesAt(1, "bandaAceh");
  const lanka = physics.valuesAt(1, "sriLanka");
  approximately(aceh.shoalingGain, lanka.shoalingGain);
  approximately(aceh.waveHeight / lanka.waveHeight, Math.sqrt(1.25 / 0.65));
  assert.ok(aceh.geometryGain > 1);
  assert.ok(lanka.geometryGain < 1);
});

test("regional incident-height assumptions remain independent of morphology and shoaling", () => {
  const equalAceh = physics.settingsForMode("equal", "bandaAceh");
  const equalLanka = physics.settingsForMode("equal", "sriLanka");
  const regionalAceh = physics.settingsForMode("regional", "bandaAceh");
  const regionalLanka = physics.settingsForMode("regional", "sriLanka");
  assert.equal(equalAceh.incomingHeight, equalLanka.incomingHeight);
  assert.equal(regionalAceh.incomingHeight, 3);
  assert.equal(regionalLanka.incomingHeight, 1.5);
  const coastAceh = physics.valuesAt(1, "bandaAceh", regionalAceh);
  const coastLanka = physics.valuesAt(1, "sriLanka", regionalLanka);
  approximately(coastAceh.waveHeight / coastLanka.waveHeight,
    (3 / 1.5) * coastAceh.geometryGain / coastLanka.geometryGain);
  assert.equal(regionalAceh.period, regionalLanka.period);
  assert.equal(physics.settingsForMode("regional", "sriLanka", { incomingHeight: 4 }).incomingHeight, 4);
  assert.equal(physics.valuesAt(1, "bandaAceh", { incomingHeight: 0 }).waveHeight, 0);
});

test("independent local journeys invert time and remain unchanged by height or period", () => {
  for (const region of regions) {
    const journey = physics.createJourney(region);
    assert.equal(journey.travelTime(0), 0);
    assert.equal(journey.travelTime(1), journey.totalTime);
    let previousTime = -1;
    for (let index = 0; index <= 100; index += 1) {
      const position = index / 100;
      const time = journey.travelTime(position);
      assert.ok(time > previousTime);
      approximately(journey.positionAtTime(time), position);
      previousTime = time;
    }
    const differentWave = physics.createJourney(region, { incomingHeight: 5, period: 600, geometryEffect: false });
    approximately(differentWave.totalTime, journey.totalTime);
    const refined = physics.createJourney(region, undefined, 9600);
    approximately(journey.totalTime, refined.totalTime, 5e-6);
    assert.ok(journey.totalTime > physics.DISTANCE / Math.sqrt(physics.GRAVITY * physics.DEEP_DEPTH));
    assert.ok(journey.totalTime < physics.DISTANCE / Math.sqrt(physics.GRAVITY * physics.SHALLOW_DEPTH));
  }
});

test("regional API clamps endpoints and rejects nonphysical or nonfinite settings", () => {
  assert.equal(physics.depthAt(-1, "bandaAceh"), 2000);
  assert.equal(physics.depthAt(2, "sriLanka"), 20);
  const journey = physics.createJourney("BandaAceh");
  assert.equal(journey.positionAtTime(-1), 0);
  assert.equal(journey.positionAtTime(1e8), 1);
  assert.throws(() => physics.depthAt(NaN, "bandaAceh"), RangeError);
  assert.throws(() => physics.valuesAt(0, "unknown"), RangeError);
  assert.throws(() => physics.normalizeSettings({ incomingHeight: -1 }), RangeError);
  assert.throws(() => physics.normalizeSettings({ period: 0 }), RangeError);
  assert.throws(() => physics.normalizeSettings({ geometryEffect: "false" }), TypeError);
  assert.throws(() => journey.positionAtTime(NaN), RangeError);
  assert.throws(() => physics.createJourney("sriLanka", undefined, 1), RangeError);
  assert.throws(() => physics.settingsForMode("unknown", "sriLanka"), RangeError);
});
