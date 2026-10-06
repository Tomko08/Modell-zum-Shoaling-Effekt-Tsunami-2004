/* Independent wave journeys; common spatial, height and model-time scales. */
(function () {
  "use strict";

  const physics = window.RegionalShoaling;
  const $ = (id) => document.getElementById(id);
  const format = (value, digits = 0) => new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
  let mode = "regional";
  let timeScale = 90;
  let frameId = null;
  let previousFrame = null;
  let lastUiFrame = -Infinity;

  const states = Array.from(document.querySelectorAll("[data-region]")).map((panel) => {
    const nodes = Object.fromEntries(Array.from(panel.querySelectorAll("[data-role]")).map((node) => [node.dataset.role, node]));
    const region = panel.dataset.region;
    const settings = physics.settingsForMode(mode, region);
    return {
      region, panel, nodes, settings,
      journey: physics.createJourney(region, settings),
      time: 0, running: false, hasStarted: false,
      canvas: nodes.canvas, ctx: nodes.canvas.getContext("2d"),
      width: 0, height: 0, samples: [],
      color: region === "bandaAceh" ? "#d5ef89" : "#8acbd2",
    };
  });

  function rangeFill(input) {
    const value = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty("--range-fill", value + "%");
  }

  function clock(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
  }

  function updateRegion(state) {
    const position = state.journey.positionAtTime(state.time);
    const values = physics.valuesAt(position, state.region, state.settings);
    const n = state.nodes;
    const complete = state.time >= state.journey.totalTime;
    n.speed.textContent = format(values.speed * 3.6);
    n.wavelength.textContent = format(values.wavelength / 1000, 1);
    n.height.textContent = format(values.waveHeight, 2);
    n.depth.textContent = format(values.depth);
    n.time.textContent = clock(state.time) + " / " + clock(state.journey.totalTime) + " min";
    n.distance.textContent = format(values.distance / 1000) + " von 120 km";
    n.progress.value = String(state.time / state.journey.totalTime * 1000);
    n.progress.setAttribute("aria-valuetext", format(values.distance / 1000) + " Kilometer, Wassertiefe " + format(values.depth) + " Meter");
    rangeFill(n.progress);
    n["shoaling-gain"].textContent = format(values.shoalingGain, 2) + "×";
    n["geometry-gain"].textContent = format(values.geometryGain, 2) + "×";
    n.warning.hidden = !values.nonlinearWarning;
    n["status-text"].textContent = complete ? "Küste erreicht" : state.running ? "Läuft" : state.hasStarted ? "Pausiert" : "Bereit";
    n.status.classList.toggle("running", state.running);
    n.status.classList.toggle("complete", complete);
    n.start.disabled = state.running;
    n.pause.disabled = !state.running;
    n.start.querySelector("span").textContent = complete ? "Erneut" : state.hasStarted ? "Weiter" : "Start";
    n.start.setAttribute("aria-label", physics.PRESETS[state.region].shortName + (complete ? " erneut starten" : state.hasStarted ? " fortsetzen" : " starten"));
    n["input-height"].value = String(state.settings.incomingHeight);
    n.period.value = String(state.settings.period / 60);
    n["input-height-value"].innerHTML = format(state.settings.incomingHeight, 1) + " <span>m</span>";
    n["period-value"].innerHTML = format(state.settings.period / 60) + " <span>min</span>";
    n["input-height"].setAttribute("aria-valuetext", format(state.settings.incomingHeight, 1) + " Meter");
    n.period.setAttribute("aria-valuetext", format(state.settings.period / 60) + " Minuten");
    rangeFill(n["input-height"]); rangeFill(n.period);
    state.canvas.setAttribute("aria-label", physics.PRESETS[state.region].shortName + ": " + format(values.depth) + " Meter Wassertiefe, " + format(values.speed * 3.6) + " Kilometer pro Stunde, " + format(values.wavelength / 1000, 1) + " Kilometer Wellenlänge, " + format(values.waveHeight, 2) + " Meter Modellwellenhöhe. Schematisches Profil mit überzeichneter Wellenhöhe.");
  }

  function updateSummary() {
    const [aceh, lanka] = states.map((state) => physics.valuesAt(1, state.region, state.settings));
    const largest = Math.max(aceh.waveHeight, lanka.waveHeight);
    $("banda-coast-height").textContent = format(aceh.waveHeight, 2) + " m";
    $("lanka-coast-height").textContent = format(lanka.waveHeight, 2) + " m";
    $("banda-bar").style.width = aceh.waveHeight / largest * 100 + "%";
    $("lanka-bar").style.width = lanka.waveHeight / largest * 100 + "%";
    const ratio = aceh.waveHeight / lanka.waveHeight;
    if (Math.abs(ratio - 1) < 1e-8) {
      $("coast-ratio").textContent = "1,00×";
      $("ratio-label").innerHTML = "Gleiche Endhöhe<br>bei gleicher Eingangswelle";
    } else {
      $("coast-ratio").textContent = format(ratio > 1 ? ratio : 1 / ratio, 2) + "×";
      $("ratio-label").innerHTML = "höhere Welle vor " + (ratio > 1 ? "Banda Aceh" : "Sri Lanka") + "<br>im gewählten Szenario";
    }
    const equal = mode === "equal";
    const geometry = $("geometry").checked;
    $("result-explanation").textContent = equal
      ? geometry ? "Bei gleicher Eingangswelle entsteht der Höhenunterschied hier durch die angenommene seitliche Bündelung." : "Trotz verschiedener Profile bleibt die Endhöhe gleich: gleiche Eingangswelle, gleiche Endtiefe, keine seitliche Bündelung."
      : geometry ? "Eingangshöhe und angenommene seitliche Bündelung tragen hier zum Höhenunterschied bei." : "Ohne seitliche Bündelung entsteht der Unterschied am Endpunkt aus den unterschiedlichen Eingangshöhen.";
    $("mode-description").textContent = equal
      ? "Höhen- und Periodenregler sind gekoppelt. Start, Pause und Zeitleisten bleiben unabhängig."
      : "Eingangshöhen sind illustrative Annahmen. Jede Welle lässt sich separat anpassen; Moduswechsel setzt beide Wellen zurück.";
    document.body.classList.toggle("geometry-disabled", !geometry);
  }

  function updateAll() { states.forEach(updateRegion); updateSummary(); }

  // The surface displacement has exactly the same pixel/metre factor in both
  // panels, so the taller model wave is visibly taller at equal endpoint depths.
  function commonAmplitudeScale() {
    const maximum = Math.max(...states.map((state) => physics.valuesAt(1, state.region, state.settings).amplitude));
    return Math.min(17, 43 / maximum);
  }

  function geometry(state) {
    const compact = state.width < 430;
    return {
      left: compact ? 28 : 38,
      right: state.width - (compact ? 28 : 38),
      waterline: state.height * .38,
      floor: state.height * .79,
      compact,
    };
  }

  function bed(depth, g) {
    return g.waterline + 56 + (g.floor - g.waterline - 56) * Math.pow(depth / physics.DEEP_DEPTH, .75);
  }

  function rebuildSamples(state) {
    const count = Math.max(300, Math.ceil(state.width));
    state.samples = Array.from({ length: count + 1 }, (_, index) => {
      const x = index / count;
      const values = physics.valuesAt(x, state.region, state.settings);
      return { x, depth: values.depth, amplitude: values.amplitude, arrival: state.journey.travelTime(x) };
    });
  }

  function resize(state) {
    const bounds = state.canvas.getBoundingClientRect();
    state.width = bounds.width; state.height = bounds.height;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    state.canvas.width = Math.round(state.width * density);
    state.canvas.height = Math.round(state.height * density);
    state.ctx.setTransform(density, 0, 0, density, 0, 0);
    rebuildSamples(state); draw(state);
  }

  function label(ctx, content, x, y, size, color, align = "left", weight = "400") {
    ctx.font = weight + " " + size + "px Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(content, x, y);
  }

  function arrow(ctx, x1, y1, x2, y2, color, both = false) {
    ctx.strokeStyle = color; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const tip = (x, y, theta) => {
      ctx.beginPath(); ctx.moveTo(x - 3 * Math.cos(theta - .6), y - 3 * Math.sin(theta - .6));
      ctx.lineTo(x, y); ctx.lineTo(x - 3 * Math.cos(theta + .6), y - 3 * Math.sin(theta + .6)); ctx.stroke();
    };
    tip(x2, y2, angle); if (both) tip(x1, y1, angle + Math.PI);
  }

  function draw(state) {
    const { ctx, width, height, samples } = state;
    if (!width || !height || !ctx) return;
    const g = geometry(state);
    const span = g.right - g.left;
    const position = state.journey.positionAtTime(state.time);
    const current = physics.valuesAt(position, state.region, state.settings);
    const scale = commonAmplitudeScale();
    const crestX = g.left + position * span;
    const crestY = g.waterline - current.amplitude * scale;
    const surface = samples.map((sample) => {
      const offset = (sample.arrival - state.time) / state.settings.period;
      const fade = Math.max(0, Math.abs(offset) - .55);
      const envelope = Math.exp(-.5 * Math.pow(fade / .18, 2));
      return { x: g.left + sample.x * span, y: g.waterline - sample.amplitude * scale * Math.cos(2 * Math.PI * offset) * envelope };
    });

    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#092a36"); background.addColorStop(1, "#103843");
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    for (let index = 0; index < 4; index += 1) {
      const y = g.waterline + index * (g.floor - g.waterline) / 3;
      ctx.strokeStyle = "rgba(162,204,204,.07)"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(width - 15, y); ctx.stroke();
    }

    const land = ctx.createLinearGradient(0, g.waterline, 0, height);
    land.addColorStop(0, "#839179"); land.addColorStop(.4, "#526960"); land.addColorStop(1, "#354e4d");
    ctx.fillStyle = land;
    ctx.beginPath(); ctx.moveTo(0, bed(physics.DEEP_DEPTH, g));
    for (const sample of samples) ctx.lineTo(g.left + sample.x * span, bed(sample.depth, g));
    ctx.bezierCurveTo(g.right + 8, g.waterline + 24, width - 12, g.waterline - 25, width, g.waterline - 28);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();

    const water = ctx.createLinearGradient(0, g.waterline - 50, 0, g.floor);
    water.addColorStop(0, "rgba(110,186,187,.3)"); water.addColorStop(.4, "rgba(49,125,140,.27)"); water.addColorStop(1, "rgba(16,73,94,.6)");
    ctx.fillStyle = water; ctx.beginPath(); ctx.moveTo(0, surface[0].y);
    for (const point of surface) ctx.lineTo(point.x, point.y);
    ctx.lineTo(g.right, bed(physics.SHALLOW_DEPTH, g));
    for (let index = samples.length - 1; index >= 0; index -= 1) ctx.lineTo(g.left + samples[index].x * span, bed(samples[index].depth, g));
    ctx.lineTo(0, bed(physics.DEEP_DEPTH, g)); ctx.closePath(); ctx.fill();

    ctx.beginPath(); ctx.moveTo(0, bed(physics.DEEP_DEPTH, g));
    for (const sample of samples) ctx.lineTo(g.left + sample.x * span, bed(sample.depth, g));
    ctx.bezierCurveTo(g.right + 8, g.waterline + 24, width - 12, g.waterline - 25, width, g.waterline - 28);
    ctx.strokeStyle = "#9eae96"; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(188,217,213,.25)"; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(15, g.waterline); ctx.lineTo(g.right, g.waterline); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, surface[0].y);
    for (const point of surface) ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = "#82bdc0"; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); let started = false;
    for (let index = 0; index < samples.length; index += 1) {
      if (Math.abs(samples[index].arrival - state.time) <= state.settings.period * .1) {
        if (started) ctx.lineTo(surface[index].x, surface[index].y);
        else { ctx.moveTo(surface[index].x, surface[index].y); started = true; }
      }
    }
    ctx.strokeStyle = state.color; ctx.lineWidth = 2; ctx.stroke();

    ctx.setLineDash([3, 4]); ctx.strokeStyle = state.region === "bandaAceh" ? "rgba(213,239,137,.25)" : "rgba(138,203,210,.3)";
    ctx.beginPath(); ctx.moveTo(crestX, g.waterline + 4); ctx.lineTo(crestX, bed(current.depth, g) - 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(crestX, crestY, 8, 0, Math.PI * 2); ctx.fillStyle = state.region === "bandaAceh" ? "rgba(213,239,137,.12)" : "rgba(138,203,210,.12)"; ctx.fill();
    ctx.beginPath(); ctx.arc(crestX, crestY, 2.8, 0, Math.PI * 2); ctx.fillStyle = state.color; ctx.fill();
    const crestLabelX = Math.max(g.left + 32, Math.min(g.right - 30, crestX));
    label(ctx, "WELLENBERG", crestLabelX, crestY - 15, g.compact ? 6 : 7, state.color, "center", "500");
    const side = crestX > g.right - 25 ? -1 : 1;
    if (g.waterline - crestY > 6) {
      arrow(ctx, crestX + side * 11, crestY + 2, crestX + side * 11, g.waterline, state.color, true);
      label(ctx, "A", crestX + side * 18, (g.waterline + crestY) / 2 + 3, 7, state.color, side > 0 ? "left" : "right");
    }

    const localWavelength = current.wavelength / physics.DISTANCE * span;
    const lambdaY = height * .14;
    if (localWavelength <= span) {
      const lambdaLeft = Math.min(Math.max(g.left, crestX - localWavelength / 2), g.right - localWavelength);
      arrow(ctx, lambdaLeft, lambdaY, lambdaLeft + localWavelength, lambdaY, "#67949c", true);
      label(ctx, "lokale λ  " + format(current.wavelength / 1000, 1) + " km", lambdaLeft + localWavelength / 2, lambdaY - 7, g.compact ? 6 : 7, "#a2c0c4", "center");
    } else {
      label(ctx, "λ = " + format(current.wavelength / 1000, 1) + " km · länger als die 120-km-Modellstrecke", width / 2, lambdaY - 6, g.compact ? 5.5 : 7, "#8fb1b8", "center");
    }
    label(ctx, "0 km", g.left, g.floor + 17, 7, "#a5b8a9");
    label(ctx, "120 km · Küstenpunkt", g.right, g.floor + 17, 7, "#a5b8a9", "right");
    const depthX = crestX > g.right - 65 ? crestX - 9 : crestX + 9;
    label(ctx, "h = " + format(current.depth) + " m", depthX, Math.min(g.waterline + 80, bed(current.depth, g) - 8), 7, "#acc3bb", crestX > g.right - 65 ? "right" : "left");
    if (!g.compact) {
      const directionX = g.left + span * .45;
      arrow(ctx, directionX - 16, g.waterline + 37, directionX + 16, g.waterline + 37, "#688e96");
      label(ctx, "AUSBREITUNG", directionX, g.waterline + 49, 6, "#75949a", "center");
    }
  }

  function drawAll() { states.forEach(draw); }

  function stopLoopIfIdle() {
    if (states.some((state) => state.running)) return;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null; previousFrame = null;
  }

  function tick(timestamp) {
    const delta = previousFrame === null ? 0 : Math.min((timestamp - previousFrame) / 1000, .1);
    previousFrame = timestamp;
    let completed = false;
    for (const state of states) {
      if (!state.running) continue;
      state.time = Math.min(state.journey.totalTime, state.time + delta * timeScale);
      if (state.time >= state.journey.totalTime) { state.running = false; completed = true; }
    }
    drawAll();
    if (timestamp - lastUiFrame > 80 || completed) { updateAll(); lastUiFrame = timestamp; }
    if (states.some((state) => state.running)) frameId = requestAnimationFrame(tick);
    else { frameId = null; previousFrame = null; updateAll(); }
  }

  function start(state) {
    if (state.running) return;
    if (state.time >= state.journey.totalTime) state.time = 0;
    state.running = true; state.hasStarted = true;
    updateRegion(state); draw(state);
    if (frameId === null) { previousFrame = null; frameId = requestAnimationFrame(tick); }
  }

  function pause(state) { state.running = false; updateRegion(state); stopLoopIfIdle(); }
  function restart(state) { state.time = 0; state.running = false; state.hasStarted = false; updateRegion(state); draw(state); stopLoopIfIdle(); }

  function changeParameters(changed) {
    const updates = {
      incomingHeight: Number(changed.nodes["input-height"].value),
      period: Number(changed.nodes.period.value) * 60,
      geometryEffect: $("geometry").checked,
    };
    for (const state of states) {
      if (state !== changed && mode !== "equal") continue;
      state.settings = physics.normalizeSettings(updates);
      // The unchanged bathymetry retains the current position and travel time.
      rebuildSamples(state);
    }
    updateAll(); drawAll();
  }

  for (const state of states) {
    state.nodes.start.addEventListener("click", () => start(state));
    state.nodes.pause.addEventListener("click", () => pause(state));
    state.nodes.restart.addEventListener("click", () => restart(state));
    state.nodes.progress.addEventListener("input", () => {
      state.running = false; state.hasStarted = true;
      state.time = Number(state.nodes.progress.value) / 1000 * state.journey.totalTime;
      updateRegion(state); draw(state); stopLoopIfIdle();
    });
    state.nodes["input-height"].addEventListener("input", () => changeParameters(state));
    state.nodes.period.addEventListener("input", () => changeParameters(state));
    new ResizeObserver(() => resize(state)).observe(state.canvas);
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mode === button.dataset.mode) return;
      mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
      for (const state of states) {
        state.settings = physics.settingsForMode(mode, state.region, { geometryEffect: $("geometry").checked });
        state.time = 0; state.running = false; state.hasStarted = false;
        rebuildSamples(state);
      }
      stopLoopIfIdle(); updateAll(); drawAll();
    });
  });

  $("geometry").addEventListener("change", () => {
    for (const state of states) {
      state.settings = physics.normalizeSettings({ ...state.settings, geometryEffect: $("geometry").checked });
      rebuildSamples(state);
    }
    updateAll(); drawAll();
  });
  document.querySelectorAll("[data-tempo]").forEach((button) => {
    button.addEventListener("click", () => {
      timeScale = Number(button.dataset.tempo);
      document.querySelectorAll("[data-tempo]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
    });
  });
  $("compare-coast").addEventListener("click", () => {
    for (const state of states) { state.time = state.journey.totalTime; state.running = false; state.hasStarted = true; }
    stopLoopIfIdle(); updateAll(); drawAll();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    states.forEach((state) => { state.running = false; });
    stopLoopIfIdle(); updateAll();
  });

  updateAll(); states.forEach(resize);
})();
