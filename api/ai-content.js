from pathlib import Path

# Build a robust NoteBank visual renderer that does not depend on
# window.currentAIResult or temporary chat attachment URLs.
frontend = r'''/* ============================================================
   AIBINU FLEXIPREP — NoteBank Visual Learning Engine v2
   File: academic-note-visuals.js

   INSTALL:
   Add this file to academic.html immediately before </body>:
       <script src="/academic-note-visuals.js"></script>

   IMPORTANT:
   - Does NOT replace existing Academic Management functions.
   - Hooks the existing /api/ai-content fetch response.
   - Does NOT use temporary chat.openai.com / chatgpt.com attachment URLs.
   - Visuals are rendered locally from safe structured JSON.
   - Simulations are trusted frontend code; the AI supplies only
     the simulation name and numeric parameters.
============================================================ */

(function () {
  "use strict";

  const MAX_VISUALS = 40;

  const SIMS = {
    projectile_motion: {
      title: "Projectile Motion",
      defaults: { velocity: 20, angle: 45, gravity: 9.81 }
    },
    ohms_law: {
      title: "Ohm's Law",
      defaults: { voltage: 12, resistance: 6 }
    },
    hookes_law: {
      title: "Hooke's Law",
      defaults: { force: 5, springConstant: 50 }
    },
    uniform_acceleration: {
      title: "Uniform Acceleration",
      defaults: { u: 5, acceleration: 2, time: 5 }
    },
    simple_pendulum: {
      title: "Simple Pendulum",
      defaults: { length: 1, gravity: 9.81 }
    },
    series_parallel_circuit: {
      title: "Series & Parallel Circuit",
      defaults: { resistance1: 4, resistance2: 6, voltage: 12 }
    }
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));

  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* ---------- Lightweight safe equation formatter ---------- */

  function formatEquation(latex) {
    let s = esc(latex || "");
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      '<span class="nbv-frac"><span>$1</span><span>$2</span></span>');
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
    s = s.replace(/\\times/g, " × ");
    s = s.replace(/\\cdot/g, " · ");
    s = s.replace(/\\pm/g, " ± ");
    s = s.replace(/\\pi/g, "π");
    s = s.replace(/\\theta/g, "θ");
    s = s.replace(/\\Delta/g, "Δ");
    s = s.replace(/\\alpha/g, "α");
    s = s.replace(/\\beta/g, "β");
    s = s.replace(/\\gamma/g, "γ");
    s = s.replace(/\\lambda/g, "λ");
    s = s.replace(/\^(\{([^{}]+)\}|([A-Za-z0-9+\-]+))/g,
      (_, all, a, b) => `<sup>${a || b}</sup>`);
    s = s.replace(/_((\{([^{}]+)\})|([A-Za-z0-9+\-]+))/g,
      (_, all, a, b, c) => `<sub>${b || c}</sub>`);
    s = s.replace(/\\\\/g, "");
    return s;
  }

  function renderEquation(v) {
    const box = document.createElement("article");
    box.className = "nbv-card nbv-equation";
    box.innerHTML =
      `<div class="nbv-card-title">📐 Equation</div>
       <div class="nbv-eq">${formatEquation(v.latex)}</div>
       <div class="nbv-caption">${esc(v.caption || "Key equation")}</div>
       ${v.variables ? `<div class="nbv-variables">${esc(v.variables)}</div>` : ""}`;
    return box;
  }

  /* ---------- SVG helpers ---------- */

  function svgWrap(inner, label) {
    return `<svg viewBox="0 0 720 360" role="img" aria-label="${esc(label)}"
      xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  function line(x1, y1, x2, y2, extra = "") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="currentColor" stroke-width="2" ${extra}/>`;
  }

  function text(x, y, t, extra = "") {
    return `<text x="${x}" y="${y}" font-family="Arial,sans-serif"
      font-size="18" fill="currentColor" ${extra}>${esc(t)}</text>`;
  }

  function drawDiagram(type, labels) {
    const t = String(type || "").toLowerCase();
    const L = Array.isArray(labels) ? labels : [];

    if (t.includes("projectile")) {
      return svgWrap(
        `<path d="M90 285 Q260 55 600 255" fill="none" stroke="currentColor" stroke-width="4"/>
         ${line(70,285,650,285)}
         ${line(90,300,90,45)}
         <circle cx="90" cy="285" r="9" fill="currentColor"/>
         ${text(100,275,"launch")}
         ${text(475,245,"trajectory")}
         ${text(30,55,"y")}
         ${text(625,310,"x")}`,
        "Projectile motion diagram"
      );
    }

    if (t.includes("wave")) {
      return svgWrap(
        `${line(50,180,670,180)}
         <path d="M50 180 C90 80 130 80 170 180 S250 280 290 180
                  S370 80 410 180 S490 280 530 180 S610 80 650 180"
           fill="none" stroke="currentColor" stroke-width="4"/>
         ${text(265,75,"wavelength λ")}
         ${text(315,215,"equilibrium")}`,
        "Wave diagram"
      );
    }

    if (t.includes("ray") || t.includes("reflection") || t.includes("refraction")) {
      return svgWrap(
        `${line(70,270,650,270)}
         ${line(360,60,360,320,"stroke-dasharray='8 7'")}
         ${line(110,215,360,270)}
         ${line(360,270,610,125)}
         ${text(85,205,"incident ray")}
         ${text(500,120,"reflected/refracted ray")}
         ${text(375,85,"normal")}
         ${text(520,300,"surface")}`,
        "Ray diagram"
      );
    }

    if (t.includes("circuit")) {
      return svgWrap(
        `${line(120,90,600,90)}${line(120,270,600,270)}
         ${line(120,90,120,155)}${line(120,205,120,270)}
         ${line(600,90,600,270)}
         <rect x="105" y="155" width="30" height="50" fill="white" stroke="currentColor" stroke-width="3"/>
         ${line(95,165,135,165)}${line(100,195,130,195)}
         <rect x="330" y="245" width="100" height="50" fill="white" stroke="currentColor" stroke-width="3"/>
         ${text(348,277,"resistor")}
         ${text(78,145,"cell")}`,
        "Simple circuit diagram"
      );
    }

    if (t.includes("force") || t.includes("free_body")) {
      return svgWrap(
        `<rect x="280" y="145" width="160" height="100" fill="white" stroke="currentColor" stroke-width="3"/>
         ${line(360,145,360,65,"marker-end='url(#a)'")}
         ${line(440,195,590,195,"marker-end='url(#a)'")}
         ${line(280,195,130,195,"marker-end='url(#a)'")}
         ${line(360,245,360,325,"marker-end='url(#a)'")}
         ${text(330,200,"object")}
         ${text(370,70,"weight")}
         ${text(470,180,"force")}`,
        "Free-body force diagram"
      );
    }

    const labelsSvg = L.slice(0, 12).map((x, i) =>
      `<rect x="${60 + (i % 3) * 215}" y="${70 + Math.floor(i / 3) * 65}"
        width="190" height="42" rx="8" fill="currentColor" opacity=".08"/>
       ${text(75 + (i % 3) * 215, 97 + Math.floor(i / 3) * 65, x)}`
    ).join("");

    return svgWrap(
      `<rect x="35" y="35" width="650" height="290" rx="16"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-dasharray="8 8"/>
       ${labelsSvg || text(215,185,"Teacher-directed labelled diagram")}`,
      "Educational diagram"
    );
  }

  function renderDiagram(v) {
    const box = document.createElement("article");
    box.className = "nbv-card nbv-diagram";
    box.innerHTML =
      `<div class="nbv-card-title">🔬 ${esc(v.title || "Educational Diagram")}</div>
       <div class="nbv-svg">${drawDiagram(v.diagram, v.labels)}</div>
       <p>${esc(v.description || "Study the labelled diagram carefully.")}</p>`;
    return box;
  }

  /* ---------- Graph ---------- */

  function renderGraph(v) {
    const box = document.createElement("article");
    box.className = "nbv-card nbv-graph";
    const points = Array.isArray(v.data) ? v.data : [];
    const cleanPoints = points.map(p => [num(p?.[0], NaN), num(p?.[1], NaN)])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 100);

    let plot = "";
    if (cleanPoints.length) {
      const xs = cleanPoints.map(p => p[0]);
      const ys = cleanPoints.map(p => p[1]);
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const ymin = Math.min(...ys), ymax = Math.max(...ys);
      const dx = xmax - xmin || 1, dy = ymax - ymin || 1;
      plot = cleanPoints.map(p =>
        `${70 + ((p[0] - xmin) / dx) * 590},${295 - ((p[1] - ymin) / dy) * 245}`
      ).join(" ");
    }

    box.innerHTML =
      `<div class="nbv-card-title">📈 ${esc(v.title || "Graph")}</div>
       <div class="nbv-svg">
         ${svgWrap(
           `${line(70,295,660,295)}${line(70,295,70,50)}
            ${plot ? `<polyline points="${plot}" fill="none" stroke="currentColor" stroke-width="4"/>
            ${cleanPoints.map((p, i) => {
              const xs = cleanPoints.map(q => q[0]), ys = cleanPoints.map(q => q[1]);
              const x = 70 + ((p[0] - Math.min(...xs)) / (Math.max(...xs)-Math.min(...xs)||1))*590;
              const y = 295 - ((p[1] - Math.min(...ys)) / (Math.max(...ys)-Math.min(...ys)||1))*245;
              return `<circle cx="${x}" cy="${y}" r="5" fill="currentColor"/>`;
            }).join("")}` : ""}
            ${text(340,335,v.xLabel || "x")}
            ${text(18,70,v.yLabel || "y")}`,
           v.title || "Graph"
         )}
       </div>
       <div class="nbv-graph-meta"><span>X: ${esc(v.xLabel || "x")}</span>
       <span>Y: ${esc(v.yLabel || "y")}</span></div>`;
    return box;
  }

  /* ---------- Interactive parameter explorer ---------- */

  function renderInteractive(v) {
    const box = document.createElement("article");
    box.className = "nbv-card nbv-interactive";
    box.innerHTML =
      `<div class="nbv-card-title">🎛️ ${esc(v.title || "Interactive Exploration")}</div>
       <p>${esc(v.instructions || "Adjust the variables and observe the change.")}</p>
       <div class="nbv-controls"></div>
       <div class="nbv-output">Adjust a parameter to explore the relationship.</div>`;

    const controls = box.querySelector(".nbv-controls");
    const output = box.querySelector(".nbv-output");
    const params = Array.isArray(v.parameters) ? v.parameters.slice(0, 12) : [];

    const update = () => {
      const values = {};
      controls.querySelectorAll("input[data-name]").forEach(i => values[i.dataset.name] = Number(i.value));
      const names = Object.keys(values);
      if (names.length >= 2) {
        const a = values[names[0]], b = values[names[1]];
        output.textContent = `${names[0]} = ${a}; ${names[1]} = ${b}`;
      } else if (names.length === 1) {
        output.textContent = `${names[0]} = ${values[names[0]]}`;
      }
    };

    params.forEach(p => {
      let min = num(p?.min, 0), max = num(p?.max, 100);
      if (max <= min) max = min + 100;
      const step = num(p?.step, 1) > 0 ? num(p.step, 1) : 1;
      const value = clamp(num(p?.value, min), min, max);

      const row = document.createElement("label");
      row.className = "nbv-slider";
      row.innerHTML =
        `<span>${esc(p?.name || "Parameter")}</span>
         <input data-name="${esc(p?.name || "Parameter")}" type="range"
           min="${min}" max="${max}" step="${step}" value="${value}">
         <output>${value}</output>`;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      input.addEventListener("input", () => {
        out.value = input.value;
        update();
      });
      controls.appendChild(row);
    });

    update();
    return box;
  }

  /* ---------- Real simulations ---------- */

  function simValue(vars, keys, fallback) {
    for (const k of keys) {
      if (vars && Number.isFinite(Number(vars[k]))) return Number(vars[k]);
    }
    return fallback;
  }

  function addSlider(container, label, value, min, max, step, onChange) {
    const row = document.createElement("label");
    row.className = "nbv-slider";
    row.innerHTML =
      `<span>${esc(label)}</span>
       <input type="range" min="${min}" max="${max}" step="${step}" value="${value}">
       <output>${value}</output>`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    input.addEventListener("input", () => {
      output.value = input.value;
      onChange(Number(input.value));
    });
    container.appendChild(row);
    return input;
  }

  function renderSimulation(v) {
    const type = String(v.simulation || "").toLowerCase();
    if (!SIMS[type]) return null;

    const vars = v.variables || {};
    const box = document.createElement("article");
    box.className = "nbv-card nbv-simulation";
    box.innerHTML =
      `<div class="nbv-card-title">🧪 ${esc(v.title || SIMS[type].title)}</div>
       <p>${esc(v.instructions || "Adjust the controls and observe the result.")}</p>
       <div class="nbv-sim-controls"></div>
       <canvas class="nbv-canvas" width="760" height="360"></canvas>
       <div class="nbv-sim-result"></div>`;

    const controls = box.querySelector(".nbv-sim-controls");
    const canvas = box.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const result = box.querySelector(".nbv-sim-result");

    const state = {};
    Object.assign(state, SIMS[type].defaults, vars);

    function drawProjectile() {
      const u = clamp(num(state.velocity, 20), 1, 100);
      const angle = clamp(num(state.angle, 45), 5, 85) * Math.PI / 180;
      const g = clamp(num(state.gravity, 9.81), 0.1, 30);
      const T = 2 * u * Math.sin(angle) / g;
      const R = u * u * Math.sin(2 * angle) / g;
      const H = u * u * Math.sin(angle) ** 2 / (2 * g);

      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.beginPath();
      for (let i=0;i<=100;i++) {
        const t = T*i/100;
        const x = u*Math.cos(angle)*t;
        const y = u*Math.sin(angle)*t - .5*g*t*t;
        const px = 45 + (x/Math.max(R,1))*650;
        const py = 300 - (y/Math.max(H,1))*240;
        i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40,300); ctx.lineTo(710,300); ctx.stroke();
      ctx.beginPath(); ctx.arc(45,300,7,0,Math.PI*2); ctx.fill();
      result.textContent =
        `Range R = ${R.toFixed(2)} m  |  Maximum height H = ${H.toFixed(2)} m  |  Time of flight = ${T.toFixed(2)} s`;
    }

    function drawOhm() {
      const V = clamp(num(state.voltage,12),0,50);
      const R = clamp(num(state.resistance,6),0.1,100);
      const I = V/R;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.beginPath(); ctx.moveTo(90,180); ctx.lineTo(670,180); ctx.stroke();
      ctx.strokeRect(320,145,120,70);
      ctx.fillText("R",375,185);
      ctx.beginPath(); ctx.arc(90,180,30,0,Math.PI*2); ctx.stroke();
      ctx.fillText("+",82,172); ctx.fillText("−",82,198);
      result.textContent = `Current I = V/R = ${I.toFixed(3)} A`;
    }

    function drawHooke() {
      const F = clamp(num(state.force,5),0,50);
      const k = clamp(num(state.springConstant,50),1,200);
      const x = F/k;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const base = 100, top = 180;
      ctx.beginPath(); ctx.moveTo(base,top);
      for(let i=0;i<12;i++){
        const xx = base + i*15;
        const yy = top + (i%2?18:-18);
        ctx.lineTo(xx,yy);
      }
      ctx.lineTo(base+180+x*500,top); ctx.stroke();
      ctx.fillRect(base+180+x*500,top-25,65,50);
      result.textContent = `Extension x = F/k = ${x.toFixed(3)} m`;
    }

    function drawUniform() {
      const u = num(state.u,5);
      const a = num(state.acceleration,2);
      const t = clamp(num(state.time,5),0,20);
      const s = u*t + .5*a*t*t;
      const v2 = u + a*t;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const distance = clamp(s,0,500);
      ctx.beginPath(); ctx.moveTo(50,230); ctx.lineTo(50+distance,230); ctx.stroke();
      ctx.fillRect(45+distance,215,25,25);
      result.textContent = `Displacement s = ${s.toFixed(2)} m  |  Final velocity v = ${v2.toFixed(2)} m/s`;
    }

    function drawPendulum() {
      const L = clamp(num(state.length,1),0.2,5);
      const g = clamp(num(state.gravity,9.81),0.1,30);
      const period = 2*Math.PI*Math.sqrt(L/g);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const pivotX=380,pivotY=55, scale=Math.min(230/L,70);
      const bobX=pivotX+Math.sin(.65)*L*scale;
      const bobY=pivotY+Math.cos(.65)*L*scale;
      ctx.beginPath(); ctx.moveTo(pivotX,pivotY); ctx.lineTo(bobX,bobY); ctx.stroke();
      ctx.beginPath(); ctx.arc(bobX,bobY,22,0,Math.PI*2); ctx.fill();
      result.textContent = `Period T = 2π√(L/g) = ${period.toFixed(3)} s`;
    }

    function drawCircuit() {
      const R1 = clamp(num(state.resistance1,4),0.1,100);
      const R2 = clamp(num(state.resistance2,6),0.1,100);
      const V = clamp(num(state.voltage,12),0,100);
      const series = R1 + R2;
      const parallel = 1/(1/R1 + 1/R2);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.beginPath(); ctx.moveTo(90,90); ctx.lineTo(670,90); ctx.lineTo(670,270); ctx.lineTo(90,270); ctx.closePath(); ctx.stroke();
      ctx.strokeRect(250,65,90,50); ctx.strokeRect(420,65,90,50);
      ctx.fillText("R1",280,95); ctx.fillText("R2",450,95);
      result.textContent =
        `Series Req = ${series.toFixed(2)} Ω  |  Parallel Req = ${parallel.toFixed(2)} Ω  |  Series current = ${(V/series).toFixed(3)} A`;
    }

    const redraw = {
      projectile_motion: drawProjectile,
      ohms_law: drawOhm,
      hookes_law: drawHooke,
      uniform_acceleration: drawUniform,
      simple_pendulum: drawPendulum,
      series_parallel_circuit: drawCircuit
    };

    const limits = {
      projectile_motion: [
        ["Initial velocity u (m/s)", "velocity", 1, 100, .5],
        ["Angle θ (°)", "angle", 5, 85, 1],
        ["Gravity g (m/s²)", "gravity", .1, 30, .1]
      ],
      ohms_law: [
        ["Voltage V (V)", "voltage", 0, 50, .5],
        ["Resistance R (Ω)", "resistance", .1, 100, .1]
      ],
      hookes_law: [
        ["Force F (N)", "force", 0, 50, .5],
        ["Spring constant k (N/m)", "springConstant", 1, 200, 1]
      ],
      uniform_acceleration: [
        ["Initial velocity u (m/s)", "u", -20, 50, .5],
        ["Acceleration a (m/s²)", "acceleration", -10, 20, .1],
        ["Time t (s)", "time", 0, 20, .1]
      ],
      simple_pendulum: [
        ["Length L (m)", "length", .2, 5, .1],
        ["Gravity g (m/s²)", "gravity", .1, 30, .1]
      ],
      series_parallel_circuit: [
        ["Resistance R1 (Ω)", "resistance1", .1, 100, .1],
        ["Resistance R2 (Ω)", "resistance2", .1, 100, .1],
        ["Voltage V (V)", "voltage", 0, 100, .5]
      ]
    };

    (limits[type] || []).forEach(([label,key,min,max,step]) => {
      const value = clamp(num(state[key], SIMS[type].defaults[key]), min, max);
      state[key] = value;
      addSlider(controls, label, value, min, max, step, value2 => {
        state[key] = value2;
        redraw[type]();
      });
    });

    redraw[type]();
    return box;
  }

  function renderImage(v) {
    /* Deliberately does not use AI-generated URLs. */
    const box = document.createElement("article");
    box.className = "nbv-card nbv-image-spec";
    box.innerHTML =
      `<div class="nbv-card-title">🖼️ ${esc(v.caption || "Educational Illustration")}</div>
       <div class="nbv-image-note">
         <strong>Illustration specification</strong>
         <p>${esc(v.alt || "Educational image")}</p>
         ${v.imageQuery ? `<small>Suggested image subject: ${esc(v.imageQuery)}</small>` : ""}
       </div>
       <div class="nbv-image-warning">
         No temporary AI attachment URL is used here. A permanent image can be attached
         later through the teacher-controlled NoteBank asset workflow.
       </div>`;
    return box;
  }

  function renderVisual(v) {
    if (!v || typeof v !== "object") return null;
    switch (String(v.type || "").toLowerCase()) {
      case "equation": return renderEquation(v);
      case "diagram": return renderDiagram(v);
      case "image": return renderImage(v);
      case "graph": return renderGraph(v);
      case "interactive": return renderInteractive(v);
      case "simulation": return renderSimulation(v);
      default: return null;
    }
  }

  function injectStyles() {
    if (document.getElementById("nbv-styles")) return;
    const s = document.createElement("style");
    s.id = "nbv-styles";
    s.textContent = `
      .nbv-visuals{margin:20px 0;display:grid;gap:16px}
      .nbv-card{background:#fff;border:1px solid #dfe7e2;border-radius:16px;padding:18px;box-shadow:0 4px 16px rgba(0,0,0,.04)}
      .nbv-card-title{font-size:18px;font-weight:800;margin-bottom:10px;color:#17382b}
      .nbv-eq{font-family:Georgia,"Times New Roman",serif;font-size:28px;text-align:center;padding:20px;background:#f4f7f5;border-left:5px solid #d7a62a;border-radius:12px;overflow:auto}
      .nbv-eq sup{font-size:.65em}.nbv-eq sub{font-size:.65em}
      .nbv-frac{display:inline-flex;vertical-align:middle;flex-direction:column;text-align:center;line-height:1.05;margin:0 .15em}
      .nbv-frac span:first-child{border-bottom:1px solid currentColor;padding:0 .2em}
      .nbv-frac span:last-child{padding:0 .2em}
      .nbv-caption,.nbv-variables{margin-top:8px;text-align:center;color:#6c7872}
      .nbv-svg{width:100%;overflow:auto;background:#fbfdfc;border-radius:12px;padding:8px}
      .nbv-svg svg{width:100%;min-width:520px;height:auto}
      .nbv-graph-meta{display:flex;justify-content:space-between;color:#6c7872;font-size:13px}
      .nbv-controls{display:grid;gap:6px}
      .nbv-slider{display:grid;grid-template-columns:minmax(130px,190px) 1fr 65px;gap:10px;align-items:center;margin:8px 0}
      .nbv-slider input{width:100%}.nbv-slider output{font-weight:700}
      .nbv-canvas{display:block;width:100%;height:auto;background:#fbfdfc;border:1px solid #dfe7e2;border-radius:12px;margin-top:12px}
      .nbv-sim-result,.nbv-output{margin-top:10px;padding:11px;border-radius:10px;background:#f4f7f5;font-weight:700}
      .nbv-image-note{padding:18px;border-radius:12px;background:#f4f7f5}
      .nbv-image-warning{margin-top:10px;font-size:12px;color:#6c7872}
      @media(max-width:600px){
        .nbv-slider{grid-template-columns:1fr}
        .nbv-eq{font-size:22px}
      }
    `;
    document.head.appendChild(s);
  }

  function getVisualsFromResponse(data) {
    return data && data.note && Array.isArray(data.note.visualComponents)
      ? data.note.visualComponents.slice(0, MAX_VISUALS)
      : [];
  }

  function mountVisuals(data) {
    const visuals = getVisualsFromResponse(data);
    if (!visuals.length) return;

    const host = document.getElementById("notePromptPreview");
    if (!host) return;

    const old = document.getElementById("nbv-visuals");
    if (old) old.remove();

    injectStyles();

    const wrap = document.createElement("section");
    wrap.id = "nbv-visuals";
    wrap.className = "nbv-visuals";

    const heading = document.createElement("h3");
    heading.textContent = "📐 Visual Learning Components";
    wrap.appendChild(heading);

    visuals.forEach(v => {
      try {
        const el = renderVisual(v);
        if (el) wrap.appendChild(el);
      } catch (e) {
        console.warn("NoteBank visual skipped:", e);
      }
    });

    host.parentNode.insertBefore(wrap, host);
  }

  /* ----------------------------------------------------------
     KEY FIX:
     The previous add-on depended on window.currentAIResult.
     academic.html assigns currentAIResult internally, so that
     assumption is unreliable for let/const scoped variables.

     Instead, intercept the existing fetch response. This works
     without changing generateNoteDraft() and without replacing
     any Academic Management function.
  ---------------------------------------------------------- */

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      if (String(url).includes("/api/ai-content")) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data && data.success === true && data.note) {
            mountVisuals(data);
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("NoteBank visual hook error:", e);
    }

    return response;
  };

  console.log("Aibinu Flexiprep NoteBank Visual Learning Engine v2 loaded.");
})();
'''

backend = Path("/mnt/data/ai-content.js").read_text(encoding="utf-8")

Path("/mnt/data/academic-note-visuals-v2.js").write_text(frontend, encoding="utf-8")
Path("/mnt/data/ai-content-enhanced.js").write_text(backend, encoding="utf-8")

# Installation guide
guide = """AIBINU FLEXIPREP — NoteBank Visual Upgrade v2

FILES
1. ai-content-enhanced.js
   Replace: api/ai-content.js
2. academic-note-visuals-v2.js
   Add to the website as: academic-note-visuals.js
   Place immediately before </body> in academic.html.

IMPORTANT
- Do not store temporary chatgpt.com/backend-api/estuary/content URLs.
- The visual engine renders equations, diagrams, graphs and simulations locally.
- The frontend hooks the existing /api/ai-content response, so it does not depend
  on window.currentAIResult and does not replace generateNoteDraft().
- Existing Academic Management tabs and NoteBank workflow are preserved.

SIMULATIONS INCLUDED
- projectile_motion
- ohms_law
- hookes_law
- uniform_acceleration
- simple_pendulum
- series_parallel_circuit

AFTER INSTALLATION
1. Generate a new Physics note such as "Projectile Motion".
2. Confirm the AI response shows "Visual Learning Components".
3. Test the sliders and simulation canvas.
4. Confirm the NoteBank record remains "AI Draft".
5. Teacher can then edit and submit for approval.

NOTE
The backend stores structured visual specifications. The Images attachment field is
not populated with temporary AI URLs. Permanent image assets should be uploaded
through a trusted storage/teacher asset workflow.
"""
Path("/mnt/data/NoteBank-Visual-Upgrade-v2-README.txt").write_text(guide, encoding="utf-8")

print("Created:")
print("/mnt/data/ai-content-enhanced.js")
print("/mnt/data/academic-note-visuals-v2.js")
print("/mnt/data/NoteBank-Visual-Upgrade-v2-README.txt")
