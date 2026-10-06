/* Shoaling Lab: dependency-free rendering and interaction. All model units are SI. */
(function () {
  "use strict";

  const physics = window.ShoalingPhysics;
  const $ = (id) => document.getElementById(id);
  const canvas = $("ocean");
  const ctx = canvas.getContext("2d");
  const controls = {
    start: $("start"), pause: $("pause"), restart: $("restart"),
    height: $("wave-height"), period: $("period"), progress: $("progress"),
  };
  const format = (number, digits = 0) => new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(number);
  let settings = physics.normalizeSettings();
  let journey = physics.createJourney(settings);
  let time = 0;
  let tempo = 1;
  let running = false;
  let hasStarted = false;
  let previousFrame = null;
  let frameId = null;
  let width = 0;
  let height = 0;
  let sceneSamples = [];
  let lastUiUpdate = -Infinity;
  const ANIMATION_DURATION = 40;

  function setRangeFill(input) {
    const fill = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty("--range-fill", fill + "%");
  }

  function clock(seconds) {
    const rounded = Math.floor(Math.max(0, seconds));
    return Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0");
  }

  function updateInterface() {
    const position = journey.positionAtTime(time);
    const values = physics.valuesAt(position, settings);
    const offshore = physics.valuesAt(0, settings);
    const reduction = Math.max(0, (1 - values.speed / offshore.speed) * 100);
    $("speed-value").textContent = format(values.speed * 3.6);
    $("wavelength-value").textContent = format(values.wavelength / 1000, 1);
    $("height-value").textContent = format(values.waveHeight, 2);
    $("speed-change").textContent = format(reduction) + " % langsamer";
    $("wavelength-change").textContent = format(reduction) + " % kürzer";
    $("height-change").textContent = format(values.waveHeight / offshore.waveHeight, 2) + " × Ausgangshöhe";
    $("depth-value").textContent = format(values.depth);
    $("depth-progress").style.width = (values.depth / settings.deepDepth * 100) + "%";
    $("journey-time").textContent = clock(time) + " / " + clock(journey.totalTime) + " min";
    $("position-text").textContent = format(position * settings.distance / 1000) + " km von 300 km";
    controls.progress.value = String(time / journey.totalTime * 1000);
    controls.progress.setAttribute("aria-valuetext", format(position * 300) + " Kilometer; Wassertiefe " + format(values.depth) + " Meter");
    setRangeFill(controls.progress);
    const complete = time >= journey.totalTime;
    $("status-text").textContent = complete ? "Küste erreicht" : running ? "Läuft" : hasStarted ? "Pausiert" : "Bereit";
    $("status").classList.toggle("running", running);
    $("status").classList.toggle("complete", complete);
    controls.start.disabled = running;
    controls.pause.disabled = !running;
    controls.start.querySelector("span").textContent = complete ? "Erneut" : hasStarted ? "Weiter" : "Start";
    $("time-compression").textContent = format(journey.totalTime / 60) + " Minuten Modellzeit in " + format(ANIMATION_DURATION / tempo) + " Sekunden.";
    $("model-warning").hidden = values.waveHeight / values.depth <= .5;
    canvas.setAttribute("aria-label", "Tsunamiwelle bei " + format(values.depth) + " Metern Wassertiefe: " + format(values.speed * 3.6) + " Kilometer pro Stunde, " + format(values.wavelength / 1000, 1) + " Kilometer Wellenlänge und " + format(values.waveHeight, 2) + " Meter Wellenhöhe. Darstellung schematisch und Höhe überzeichnet.");
  }

  function geometry() {
    const compact = width < 500;
    return {
      left: compact ? 30 : 52,
      right: width - (compact ? 35 : 55),
      waterline: height * .38,
      floor: height * .83,
      compact,
    };
  }

  function bedAt(x, g) {
    const depth = physics.depthAt(x, settings);
    return bedForDepth(depth, g);
  }

  function bedForDepth(depth, g) {
    // Depth and surface displacement are schematic, independent vertical scales.
    // Reserve enough water column for the full exaggerated trough at every setting.
    return g.waterline + 61 + (g.floor - g.waterline - 61) * Math.pow(depth / settings.deepDepth, .75);
  }

  function rebuildSamples() {
    const count = Math.max(250, Math.ceil(width));
    sceneSamples = Array.from({ length: count + 1 }, (_, index) => {
      const x = index / count;
      const values = physics.valuesAt(x, settings);
      return { x, arrival: journey.travelTime(x), amplitude: values.amplitude, depth: values.depth };
    });
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
    rebuildSamples();
    draw();
  }

  function text(content, x, y, size, color, align = "left", weight = "400") {
    ctx.fillStyle = color;
    ctx.font = weight + " " + size + "px Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = align;
    ctx.fillText(content, x, y);
  }

  function drawArrow(x1, y1, x2, y2, color, both = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const wing = 4;
    function tip(x, y, direction) {
      ctx.beginPath();
      ctx.moveTo(x - wing * Math.cos(direction - .55), y - wing * Math.sin(direction - .55));
      ctx.lineTo(x, y);
      ctx.lineTo(x - wing * Math.cos(direction + .55), y - wing * Math.sin(direction + .55));
      ctx.stroke();
    }
    tip(x2, y2, angle);
    if (both) tip(x1, y1, angle + Math.PI);
  }

  function draw() {
    if (!width || !height || !ctx) return;
    const g = geometry();
    const span = g.right - g.left;
    const position = journey.positionAtTime(time);
    const current = physics.valuesAt(position, settings);
    const pixelScale = Math.min(16, 49 / physics.valuesAt(1, settings).amplitude);
    const crestX = g.left + position * span;
    const amplitudePx = current.amplitude * pixelScale;
    const crestY = g.waterline - amplitudePx;
    ctx.clearRect(0, 0, width, height);

    // Quiet atmosphere and horizontal guide lines.
    const sky = ctx.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, "#092a36"); sky.addColorStop(1, "#0d3440");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    for (let n = 0; n <= 3; n += 1) {
      const y = g.waterline + n * (g.floor - g.waterline) / 3;
      ctx.strokeStyle = "rgba(154,193,197,.09)"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(width - 20, y); ctx.stroke();
    }

    // Land extends above sea level beyond the model's 20 m endpoint.
    const land = ctx.createLinearGradient(0, g.waterline, 0, height);
    land.addColorStop(0, "#839178"); land.addColorStop(.25, "#536861"); land.addColorStop(1, "#344c4d");
    ctx.fillStyle = land;
    ctx.beginPath(); ctx.moveTo(0, bedAt(0, g)); ctx.lineTo(g.left, bedAt(0, g));
    for (const sample of sceneSamples) ctx.lineTo(g.left + sample.x * span, bedForDepth(sample.depth, g));
    ctx.bezierCurveTo(g.right + 13, g.waterline + 34, width - 18, g.waterline - 34, width, g.waterline - 39);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();

    // A phase defined in travel-time coordinates gives local wavelength c*T.
    // A flat-centred envelope preserves the full crest and neighbouring troughs.
    const surface = sceneSamples.map((sample) => {
      const phaseTime = sample.arrival - time;
      const phase = 2 * Math.PI * phaseTime / settings.period;
      const fade = Math.max(0, Math.abs(phaseTime) / settings.period - .55);
      const envelope = Math.exp(-.5 * Math.pow(fade / .18, 2));
      const displacement = sample.amplitude * pixelScale * Math.cos(phase) * envelope;
      return { x: g.left + sample.x * span, y: g.waterline - displacement };
    });
    const water = ctx.createLinearGradient(0, g.waterline - 80, 0, g.floor);
    water.addColorStop(0, "rgba(112,187,185,.34)"); water.addColorStop(.48, "rgba(54,126,138,.22)"); water.addColorStop(1, "rgba(18,75,94,.55)");
    ctx.fillStyle = water;
    ctx.beginPath(); ctx.moveTo(0, surface[0].y);
    for (const point of surface) ctx.lineTo(point.x, point.y);
    ctx.lineTo(g.right, bedAt(1, g));
    for (let index = sceneSamples.length - 1; index >= 0; index -= 1) {
      const sample = sceneSamples[index]; ctx.lineTo(g.left + sample.x * span, bedForDepth(sample.depth, g));
    }
    ctx.lineTo(0, bedAt(0, g)); ctx.closePath(); ctx.fill();

    // The seabed contour remains visible through the ocean.
    ctx.strokeStyle = "#9aac94"; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, bedAt(0, g));
    for (const sample of sceneSamples) ctx.lineTo(g.left + sample.x * span, bedForDepth(sample.depth, g));
    ctx.bezierCurveTo(g.right + 13, g.waterline + 34, width - 18, g.waterline - 34, width, g.waterline - 39); ctx.stroke();

    // Still-water level and the animated surface.
    ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(174,208,207,.25)"; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(20, g.waterline); ctx.lineTo(g.right, g.waterline); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "#8ac7c7"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, surface[0].y);
    for (const point of surface) ctx.lineTo(point.x, point.y);
    ctx.stroke();

    // A highlighted segment makes the tracked crest easy to follow.
    ctx.beginPath(); let inSegment = false;
    for (let i = 0; i < sceneSamples.length; i += 1) {
      if (Math.abs(sceneSamples[i].arrival - time) <= settings.period * .1) {
        if (!inSegment) { ctx.moveTo(surface[i].x, surface[i].y); inSegment = true; }
        else ctx.lineTo(surface[i].x, surface[i].y);
      }
    }
    ctx.strokeStyle = "#d5ef89"; ctx.lineWidth = 2; ctx.stroke();

    // Current depth, directly beneath the moving crest.
    ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(213,239,137,.35)"; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(crestX, g.waterline + 3); ctx.lineTo(crestX, bedAt(position, g) - 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(crestX, crestY, 9, 0, Math.PI * 2); ctx.fillStyle = "rgba(213,239,137,.11)"; ctx.fill();
    ctx.beginPath(); ctx.arc(crestX, crestY, 3, 0, Math.PI * 2); ctx.fillStyle = "#d5ef89"; ctx.fill();
    const labelX = Math.max(g.left + 37, Math.min(g.right - 38, crestX));
    text("WELLENBERG", labelX, Math.max(24, crestY - 19), g.compact ? 7 : 8, "#c4dc8d", "center", "550");
    const amplitudeSide = crestX > g.right - 35 ? -1 : 1;
    const amplitudeX = crestX + amplitudeSide * 12;
    drawArrow(amplitudeX, crestY + 2, amplitudeX, g.waterline, "rgba(213,239,137,.65)", true);
    text("A", amplitudeX + amplitudeSide * 7, crestY + amplitudePx / 2 + 3, 8, "#c4dc8d", amplitudeSide === 1 ? "left" : "right");

    // Local wavelength is shown as an exact horizontal interval, drawn where it fits.
    const lambdaWidth = current.wavelength / settings.distance * span;
    const lambdaLeft = Math.min(Math.max(g.left, crestX - lambdaWidth / 2), g.right - lambdaWidth);
    const lambdaY = height * .17;
    if (!g.compact && lambdaWidth <= span) {
      drawArrow(lambdaLeft, lambdaY, lambdaLeft + lambdaWidth, lambdaY, "#658f99", true);
      text("λ  " + format(current.wavelength / 1000, 1) + " km", lambdaLeft + lambdaWidth / 2, lambdaY - 8, 9, "#a8c3c6", "center");
    } else if (!g.compact) {
      text("λ  " + format(current.wavelength / 1000, 1) + " km · länger als die Modellstrecke", width / 2, lambdaY - 8, 9, "#a8c3c6", "center");
    }

    // Direction and environmental annotations.
    text("T I E F S E E", g.left, g.floor + (g.compact ? 12 : 24), g.compact ? 7 : 8, "#a9bab0", "left", "500");
    text("K Ü S T E", width - 20, g.floor + (g.compact ? 12 : 24), g.compact ? 7 : 8, "#a9bab0", "right", "500");
    if (!g.compact) {
      text("MEERESBODEN", g.left + span * .43, g.floor - 12, 7, "#899f94", "center");
      const ax = g.left + span * .51; const ay = g.waterline + 46;
      drawArrow(ax - 26, ay, ax + 26, ay, "rgba(147,182,188,.55)");
      text("AUSBREITUNG", ax, ay + 15, 7, "#7fa0a8", "center");
    }
    text("h = " + format(current.depth) + " m", Math.min(g.right - 4, Math.max(g.left + 3, crestX + 12)), Math.min(bedAt(position, g) - 9, g.waterline + 93), 9, "#afc4c0", crestX > g.right - 76 ? "right" : "left");
  }

  function stop() {
    running = false;
    previousFrame = null;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function tick(timestamp) {
    if (!running) return;
    if (previousFrame !== null) {
      const seconds = Math.min((timestamp - previousFrame) / 1000, .1);
      time = Math.min(journey.totalTime, time + seconds * journey.totalTime / ANIMATION_DURATION * tempo);
    }
    previousFrame = timestamp;
    draw();
    if (timestamp - lastUiUpdate >= 80 || time >= journey.totalTime) {
      updateInterface(); lastUiUpdate = timestamp;
    }
    if (time >= journey.totalTime) {
      stop(); updateInterface(); return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    if (time >= journey.totalTime) time = 0;
    running = true; hasStarted = true; previousFrame = null;
    updateInterface(); draw(); frameId = requestAnimationFrame(tick);
  }

  controls.start.addEventListener("click", start);
  controls.pause.addEventListener("click", () => { stop(); updateInterface(); draw(); });
  controls.restart.addEventListener("click", () => { stop(); time = 0; hasStarted = false; updateInterface(); draw(); });
  controls.progress.addEventListener("input", () => {
    stop(); hasStarted = true;
    time = Number(controls.progress.value) / 1000 * journey.totalTime;
    updateInterface(); draw();
  });

  function changeParameters() {
    settings = physics.normalizeSettings({ offshoreAmplitude: Number(controls.height.value) / 2, period: Number(controls.period.value) * 60 });
    journey = physics.createJourney(settings);
    time = Math.min(time, journey.totalTime);
    $("initial-height").innerHTML = format(Number(controls.height.value), 1) + " <span>m</span>";
    $("period-value").innerHTML = format(Number(controls.period.value)) + " <span>min</span>";
    controls.height.setAttribute("aria-valuetext", format(Number(controls.height.value), 1) + " Meter");
    controls.period.setAttribute("aria-valuetext", format(Number(controls.period.value)) + " Minuten");
    setRangeFill(controls.height); setRangeFill(controls.period);
    rebuildSamples(); updateInterface(); draw();
  }
  controls.height.addEventListener("input", changeParameters);
  controls.period.addEventListener("input", changeParameters);
  document.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      tempo = Number(button.dataset.speed);
      document.querySelectorAll("[data-speed]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
      updateInterface();
    });
  });

  // Background tabs never advance the simulation unexpectedly.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) { stop(); updateInterface(); }
  });
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.code === "Space" && !["INPUT", "BUTTON", "A", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
      event.preventDefault();
      if (running) { stop(); updateInterface(); } else start();
    }
  });
  new ResizeObserver(resize).observe(canvas);
  changeParameters(); resize();
})();
