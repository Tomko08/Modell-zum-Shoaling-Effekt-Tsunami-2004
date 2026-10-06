"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const physics = require("../physics.js");

function approximately(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} should approximately equal ${expected}`);
}

test("default model reaches the specified water depths and keeps height distinct from amplitude", () => {
  const deep = physics.valuesAt(0);
  const coast = physics.valuesAt(1);
  assert.equal(deep.depth, 4000);
  assert.equal(coast.depth, 20);
  assert.equal(deep.amplitude, 1);
  assert.equal(deep.waveHeight, 2);
  approximately(deep.speed, 198.09088823063013);
  approximately(coast.speed, 14.007141035914502);
  approximately(coast.waveHeight, 7.521206186172787);
});

test("shoaling makes a travelling wave slower, shorter and higher towards shore", () => {
  let previous = physics.valuesAt(0);
  for (let index = 1; index <= 100; index += 1) {
    const current = physics.valuesAt(index / 100);
    assert.ok(current.depth < previous.depth);
    assert.ok(current.speed < previous.speed);
    assert.ok(current.wavelength < previous.wavelength);
    assert.ok(current.amplitude > previous.amplitude);
    approximately(current.wavelength / current.speed, physics.DEFAULTS.period);
    previous = current;
  }
});

test("Green's law preserves shallow-water energy flux A²c along the full slope", () => {
  const settings = { offshoreAmplitude: 1.8, deepDepth: 5000, shallowDepth: 12, period: 900 };
  const offshore = physics.valuesAt(0, settings);
  const referenceFlux = offshore.amplitude ** 2 * offshore.speed;
  for (let index = 0; index <= 100; index += 1) {
    const values = physics.valuesAt(index / 100, settings);
    approximately(values.amplitude ** 2 * values.speed, referenceFlux);
  }
});

test("integrated travel times are monotone and their inverse returns the original position", () => {
  const journey = physics.createJourney();
  assert.equal(journey.travelTime(0), 0);
  assert.equal(journey.travelTime(1), journey.totalTime);
  assert.equal(journey.positionAtTime(0), 0);
  assert.equal(journey.positionAtTime(journey.totalTime), 1);
  let previousTime = -1;
  for (let index = 0; index <= 100; index += 1) {
    const position = index / 100;
    const time = journey.travelTime(position);
    assert.ok(time > previousTime);
    approximately(journey.positionAtTime(time), position);
    previousTime = time;
  }
  const fastest = physics.DEFAULTS.distance / physics.valuesAt(0).speed;
  const slowest = physics.DEFAULTS.distance / physics.valuesAt(1).speed;
  assert.ok(journey.totalTime > fastest && journey.totalTime < slowest);
});

test("constant depth gives uniform motion and numerical integration is converged", () => {
  const flat = physics.createJourney({ deepDepth: 100, shallowDepth: 100, distance: 10000 });
  approximately(flat.totalTime, 10000 / Math.sqrt(physics.GRAVITY * 100));
  approximately(flat.positionAtTime(flat.totalTime / 3), 1 / 3);
  const standard = physics.createJourney();
  const refined = physics.createJourney(undefined, 4800);
  approximately(standard.totalTime, refined.totalTime, 1e-5);
});

test("model clamps the journey endpoints and rejects unusable depth and time settings", () => {
  assert.equal(physics.depthAt(-1), physics.DEFAULTS.deepDepth);
  assert.equal(physics.depthAt(2), physics.DEFAULTS.shallowDepth);
  assert.equal(physics.positionAtTime(-20), 0);
  assert.equal(physics.positionAtTime(1e9), 1);
  assert.throws(() => physics.normalizeSettings({ shallowDepth: 0 }), RangeError);
  assert.throws(() => physics.normalizeSettings({ period: -1 }), RangeError);
  assert.throws(() => physics.normalizeSettings({ deepDepth: 10, shallowDepth: 20 }), RangeError);
  assert.throws(() => physics.positionAtTime(NaN), RangeError);
  assert.equal(physics.valuesAt(1, { offshoreAmplitude: 0 }).waveHeight, 0);
});
