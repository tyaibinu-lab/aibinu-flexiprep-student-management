/* ============================================================
   AIBINU FLEXIPREP — NoteBank Visual Learning Engine v3
   Dynamic visual renderer for AI-generated NoteBank content.

   INSTALL in academic.html, immediately before </body>:
       <script src="/academic-note-visuals-v3.js"></script>

   DESIGN:
   - Works for every subsequent /api/ai-content note generation.
   - Does not depend on window.currentAIResult.
   - Uses the existing fetch response.
   - AI supplies structured data; trusted frontend supplies behavior.
   - Never renders AI-provided executable code or arbitrary URLs.
   - Supports topic-neutral tables, processes, diagrams, graphs,
     equations, interactives and a growing simulation registry.
============================================================ */

(function () {
  "use strict";

  const MAX_VISUALS = 40;

  /* ----------------------------------------------------------
     Simulation registry.
     Adding a new simulation means adding a trusted renderer here;
     the AI cannot execute its own code.
  ---------------------------------------------------------- */

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
    },

    wave_motion: {
      title: "Wave Motion",
      defaults: { amplitude: 1, frequency: 2, wavelength: 2 }
    },

    lens_formula: {
      title: "Lens Formula",
      defaults: { focalLength: 10, objectDistance: 20 }
    },

    transformer: {
      title: "Transformer",
      defaults: { primaryVoltage: 240, primaryTurns: 1000, secondaryTurns: 100 }
    },

    density_pressure: {
      title: "Density and Pressure",
      defaults: { density: 1000, depth: 2, gravity: 9.81 }
    },

    gas_law: {
      title: "Gas Law Explorer",
      defaults: { pressure: 100, volume: 1, temperature: 300 }
    },

    probability: {
      title: "Probability Explorer",
      defaults: { favourable: 1, total: 6 }
    }
  };


  // ==========================================================
  // SAFETY HELPERS
  // ==========================================================

  const esc = v =>
    String(v ?? "").replace(
      /[&<>"']/g,
      s => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[s])
    );

  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));


  // ==========================================================
  // STYLES
  // ==========================================================

  function injectStyles() {
    if (document.getElementById("nbv3-styles")) return;

    const s = document.createElement("style");
    s.id = "nbv3-styles";

    s.textContent = `
      .nbv3-visuals {
        margin: 20px 0;
        display: grid;
        gap: 18px;
      }

      .nbv3-card {
        background: #fff;
        border: 1px solid #dfe7e2;
        border-radius: 16px;
        padding: 18px;
        box-shadow: 0 4px 16px rgba(0,0,0,.04);
      }

      .nbv3-title {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 12px;
        color: #17382b;
      }

      .nbv3-equation {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 29px;
        text-align: center;
        padding: 22px;
        background: #f4f7f5;
        border-left: 5px solid #d7a62a;
        border-radius: 12px;
        overflow: auto;
      }

      .nbv3-equation sup,
      .nbv3-equation sub {
        font-size: .65em;
      }

      .nbv3-frac {
        display: inline-flex;
        flex-direction: column;
        vertical-align: middle;
        text-align: center;
        line-height: 1.05;
        margin: 0 .15em;
      }

      .nbv3-frac span:first-child {
        border-bottom: 1px solid currentColor;
        padding: 0 .2em;
      }

      .nbv3-frac span:last-child {
        padding: 0 .2em;
      }

      .nbv3-caption {
        margin-top: 9px;
        text-align: center;
        color: #66746d;
      }

      .nbv3-meta {
        margin-top: 8px;
        color: #66746d;
        font-size: 13px;
      }

      .nbv3-svg-wrap {
        width: 100%;
        overflow: auto;
        background: #fbfdfc;
        border-radius: 12px;
        padding: 8px;
      }

      .nbv3-svg-wrap svg {
        width: 100%;
        min-width: 520px;
        height: auto;
      }

      .nbv3-table-wrap {
        overflow-x: auto;
      }

      .nbv3-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 520px;
      }

      .nbv3-table th,
      .nbv3-table td {
        border: 1px solid #dfe7e2;
        padding: 10px;
        text-align: left;
        vertical-align: top;
      }

      .nbv3-table th {
        background: #f4f7f5;
        font-weight: 800;
      }

      .nbv3-flow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }

      .nbv3-step {
        padding: 12px 16px;
        border: 1px solid #dfe7e2;
        border-radius: 12px;
        background: #f8faf9;
        font-weight: 700;
      }

      .nbv3-arrow {
        font-size: 22px;
        font-weight: 800;
      }

      .nbv3-slider {
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr 75px;
        gap: 10px;
        align-items: center;
        margin: 9px 0;
      }

      .nbv3-slider input {
        width: 100%;
      }

      .nbv3-slider output {
        font-weight: 700;
      }

      .nbv3-canvas {
        display: block;
        width: 100%;
        height: auto;
        background: #fbfdfc;
        border: 1px solid #dfe7e2;
        border-radius: 12px;
        margin-top: 14px;
      }

      .nbv3-result {
        margin-top: 10px;
        padding: 11px;
        border-radius: 10px;
        background: #f4f7f5;
        font-weight: 700;
      }

      .nbv3-image-spec {
        padding: 16px;
        background: #f8faf9;
        border-radius: 12px;
      }

      @media (max-width: 650px) {
        .nbv3-slider {
          grid-template-columns: 1fr;
        }

        .nbv3-equation {
          font-size: 22px;
        }

        .nbv3-flow {
          display: grid;
        }

        .nbv3-arrow {
          transform: rotate(90deg);
          justify-self: center;
        }
      }
    `;

    document.head.appendChild(s);
  }


  // ==========================================================
  // EQUATION
  // ==========================================================

  function formatEquation(latex) {
    let s = esc(latex || "");

    s = s.replace(
      /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      '<span class="nbv3-frac"><span>$1</span><span>$2</span></span>'
    );

    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
    s = s.replace(/\\times/g, " × ");
    s = s.replace(/\\cdot/g, " · ");
    s = s.replace(/\\pm/g, " ± ");
    s = s.replace(/\\pi/g, "π");
    s = s.replace(/\\theta/g, "θ");
    s = s.replace(/\\Delta/g, "Δ");
    s = s.replace(/\\lambda/g, "λ");
    s = s.replace(/\\alpha/g, "α");
    s = s.replace(/\\beta/g, "β");
    s = s.replace(/\\gamma/g, "γ");

    s = s.replace(
      /\^(\{([^{}]+)\}|([A-Za-z0-9+\-]+))/g,
      (_, all, a, b) => `<sup>${a || b}</sup>`
    );

    s = s.replace(
      /_(\{([^{}]+)\}|([A-Za-z0-9+\-]+))/g,
      (_, all, a, b) => `<sub>${a || b}</sub>`
    );

    return s.replace(/\\\\/g, "");
  }

  function renderEquation(v) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    el.innerHTML = `
      <div class="nbv3-title">📐 Equation</div>
      <div class="nbv3-equation">${formatEquation(v.latex)}</div>
      <div class="nbv3-caption">${esc(v.caption || "Key equation")}</div>
      ${v.variables ? `<div class="nbv3-meta">${esc(v.variables)}</div>` : ""}
    `;

    return el;
  }


  // ==========================================================
  // SVG / DIAGRAMS
  // ==========================================================

  function svg(inner, label) {
    return `
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label="${esc(label)}"
        xmlns="http://www.w3.org/2000/svg">
        ${inner}
      </svg>
    `;
  }

  function line(x1, y1, x2, y2, extra = "") {
    return `
      <line
        x1="${x1}" y1="${y1}"
        x2="${x2}" y2="${y2}"
        stroke="currentColor"
        stroke-width="2"
        ${extra}/>
    `;
  }

  function txt(x, y, value, extra = "") {
    return `
      <text
        x="${x}" y="${y}"
        font-family="Arial,sans-serif"
        font-size="18"
        fill="currentColor"
        ${extra}>
        ${esc(value)}
      </text>
    `;
  }

  function drawDiagram(type, labels) {
    const t = String(type || "").toLowerCase();
    const L = Array.isArray(labels) ? labels : [];

    if (t.includes("projectile")) {
      return svg(`
        <path d="M90 285 Q260 55 600 255"
          fill="none" stroke="currentColor" stroke-width="4"/>
        ${line(70,285,650,285)}
        ${line(90,300,90,45)}
        <circle cx="90" cy="285" r="9" fill="currentColor"/>
        ${txt(105,275,"launch")}
        ${txt(485,245,"trajectory")}
        ${txt(30,55,"y")}
        ${txt(625,310,"x")}
      `, "Projectile motion diagram");
    }

    if (t.includes("wave")) {
      return svg(`
        ${line(50,180,670,180)}
        <path
          d="M50 180 C90 80 130 80 170 180
             S250 280 290 180
             S370 80 410 180
             S490 280 530 180
             S610 80 650 180"
          fill="none"
          stroke="currentColor"
          stroke-width="4"/>
        ${txt(270,75,"wavelength λ")}
        ${txt(310,215,"equilibrium")}
      `, "Wave diagram");
    }

    if (
      t.includes("ray") ||
      t.includes("reflection") ||
      t.includes("refraction")
    ) {
      return svg(`
        ${line(70,270,650,270)}
        ${line(360,60,360,320,"stroke-dasharray='8 7'")}
        ${line(110,215,360,270)}
        ${line(360,270,610,125)}
        ${txt(85,205,"incident ray")}
        ${txt(500,120,"reflected/refracted ray")}
        ${txt(375,85,"normal")}
        ${txt(520,300,"surface")}
      `, "Ray diagram");
    }

    if (t.includes("circuit")) {
      return svg(`
        ${line(120,90,600,90)}
        ${line(120,270,600,270)}
        ${line(120,90,120,155)}
        ${line(120,205,120,270)}
        ${line(600,90,600,270)}
        <rect x="105" y="155" width="30" height="50"
          fill="white" stroke="currentColor" stroke-width="3"/>
        ${line(95,165,135,165)}
        ${line(100,195,130,195)}
        <rect x="330" y="245" width="100" height="50"
          fill="white" stroke="currentColor" stroke-width="3"/>
        ${txt(348,277,"resistor")}
        ${txt(78,145,"cell")}
      `, "Simple circuit diagram");
    }

    if (
      t.includes("free_body") ||
      t.includes("force")
    ) {
      return svg(`
        <rect x="280" y="145" width="160" height="100"
          fill="white" stroke="currentColor" stroke-width="3"/>
        ${line(360,145,360,65)}
        ${line(440,195,590,195)}
        ${line(280,195,130,195)}
        ${line(360,245,360,325)}
        ${txt(330,200,"object")}
        ${txt(370,70,"weight")}
        ${txt(470,180,"force")}
      `, "Free body diagram");
    }

    if (
      t.includes("cell")
    ) {
      return svg(`
        <ellipse cx="360" cy="180" rx="170" ry="110"
          fill="none" stroke="currentColor" stroke-width="3"/>
        <circle cx="300" cy="145" r="28"
          fill="none" stroke="currentColor" stroke-width="3"/>
        <circle cx="420" cy="215" r="35"
          fill="none" stroke="currentColor" stroke-width="3"/>
        ${txt(265,145,"nucleus")}
        ${txt(450,220,"organelle")}
      `, "Cell diagram");
    }

    const items = L.slice(0, 12).map((x, i) => `
      <rect
        x="${55 + (i % 3) * 220}"
        y="${60 + Math.floor(i / 3) * 65}"
        width="195" height="42" rx="8"
        fill="currentColor" opacity=".08"/>
      ${txt(
        70 + (i % 3) * 220,
        87 + Math.floor(i / 3) * 65,
        x
      )}
    `).join("");

    return svg(`
      <rect x="35" y="35" width="650" height="290"
        rx="16" fill="none" stroke="currentColor"
        stroke-width="2" stroke-dasharray="8 8"/>
      ${items || txt(220,185,"Teacher-directed labelled diagram")}
    `, "Educational diagram");
  }

  function renderDiagram(v) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    el.innerHTML = `
      <div class="nbv3-title">🔬 ${esc(v.title || "Educational Diagram")}</div>
      <div class="nbv3-svg-wrap">
        ${drawDiagram(v.diagram, v.labels)}
      </div>
      <p>${esc(v.description || "Study the labelled diagram carefully.")}</p>
    `;

    return el;
  }


  // ==========================================================
  // TABLE / COMPARISON
  // ==========================================================

  function renderTable(v, comparison = false) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    const headers = Array.isArray(v.headers) ? v.headers.slice(0, 12) : [];
    const rows = Array.isArray(v.rows) ? v.rows.slice(0, 40) : [];

    el.innerHTML = `
      <div class="nbv3-title">
        ${comparison ? "⚖️" : "📋"}
        ${esc(v.title || (comparison ? "Comparison" : "Study Table"))}
      </div>

      <div class="nbv3-table-wrap">
        <table class="nbv3-table">
          <thead>
            <tr>
              ${headers.map(h => `<th>${esc(h)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${Array.isArray(row)
                  ? row.slice(0, headers.length || 12)
                      .map(cell => `<td>${esc(cell)}</td>`).join("")
                  : ""}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${v.caption ? `<div class="nbv3-caption">${esc(v.caption)}</div>` : ""}
    `;

    return el;
  }


  // ==========================================================
  // FLOWCHART / PROCESS
  // ==========================================================

  function renderFlow(v, process = false) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    const steps = (
      Array.isArray(v.steps)
        ? v.steps
        : Array.isArray(v.stages)
          ? v.stages
          : []
    ).slice(0, 20);

    el.innerHTML = `
      <div class="nbv3-title">
        ${process ? "🔄" : "➡️"}
        ${esc(v.title || (process ? "Process" : "Flowchart"))}
      </div>

      <div class="nbv3-flow">
        ${steps.map((step, i) => `
          ${i ? `<span class="nbv3-arrow">→</span>` : ""}
          <div class="nbv3-step">${esc(step)}</div>
        `).join("")}
      </div>

      ${v.description
        ? `<p>${esc(v.description)}</p>`
        : ""}
    `;

    return el;
  }


  // ==========================================================
  // GRAPH
  // ==========================================================

  function renderGraph(v) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    const points = (
      Array.isArray(v.data)
        ? v.data
        : []
    )
      .map(p => [
        num(p?.[0], NaN),
        num(p?.[1], NaN)
      ])
      .filter(p =>
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1])
      )
      .slice(0, 100);

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    const xmin = xs.length ? Math.min(...xs) : 0;
    const xmax = xs.length ? Math.max(...xs) : 1;
    const ymin = ys.length ? Math.min(...ys) : 0;
    const ymax = ys.length ? Math.max(...ys) : 1;

    const dx = xmax - xmin || 1;
    const dy = ymax - ymin || 1;

    const plotted = points.map(p => {
      const x = 70 + ((p[0] - xmin) / dx) * 590;
      const y = 295 - ((p[1] - ymin) / dy) * 245;
      return `${x},${y}`;
    }).join(" ");

    el.innerHTML = `
      <div class="nbv3-title">📈 ${esc(v.title || "Graph")}</div>

      <div class="nbv3-svg-wrap">
        ${svg(`
          ${line(70,295,660,295)}
          ${line(70,295,70,50)}

          ${
            plotted
              ? `
                <polyline
                  points="${plotted}"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="4"/>

                ${points.map(p => {
                  const x = 70 + ((p[0] - xmin) / dx) * 590;
                  const y = 295 - ((p[1] - ymin) / dy) * 245;

                  return `
                    <circle
                      cx="${x}"
                      cy="${y}"
                      r="5"
                      fill="currentColor"/>
                  `;
                }).join("")}
              `
              : txt(250,185,"No numerical data supplied")
          }

          ${txt(320,335,v.xLabel || "x")}
          ${txt(18,70,v.yLabel || "y")}
        `, v.title || "Graph")}
      </div>

      <div class="nbv3-meta">
        X: ${esc(v.xLabel || "x")}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        Y: ${esc(v.yLabel || "y")}
      </div>
    `;

    return el;
  }


  // ==========================================================
  // GENERIC INTERACTIVE
  // ==========================================================

  function renderInteractive(v) {
    const el = document.createElement("article");
    el.className = "nbv3-card";

    el.innerHTML = `
      <div class="nbv3-title">🎛️ ${esc(v.title || "Interactive Exploration")}</div>
      <p>${esc(v.instructions || "Adjust the variables and observe the values.")}</p>
      <div class="nbv3-interactive-controls"></div>
      <div class="nbv3-result">Adjust a parameter to explore.</div>
    `;

    const controls =
      el.querySelector(".nbv3-interactive-controls");

    const result =
      el.querySelector(".nbv3-result");

    const params =
      Array.isArray(v.parameters)
        ? v.parameters.slice(0, 12)
        : [];

    function update() {
      const values = {};

      controls.querySelectorAll("input[data-name]")
        .forEach(input => {
          values[input.dataset.name] =
            Number(input.value);
        });

      result.textContent =
        Object.entries(values)
          .map(([k, val]) => `${k} = ${val}`)
          .join("  |  ") ||
        "Adjust a parameter to explore.";
    }

    params.forEach(p => {
      let min = num(p?.min, 0);
      let max = num(p?.max, 100);

      if (max <= min) max = min + 100;

      const step =
        num(p?.step, 1) > 0
          ? num(p.step, 1)
          : 1;

      const value =
        clamp(
          num(p?.value, min),
          min,
          max
        );

      const row =
        document.createElement("label");

      row.className =
        "nbv3-slider";

      row.innerHTML = `
        <span>${esc(p?.name || "Parameter")}</span>

        <input
          data-name="${esc(p?.name || "Parameter")}"
          type="range"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${value}">

        <output>${value}</output>
      `;

      const input =
        row.querySelector("input");

      const output =
        row.querySelector("output");

      input.addEventListener("input", () => {
        output.value = input.value;
        update();
      });

      controls.appendChild(row);
    });

    update();

    return el;
  }


  // ==========================================================
  // SIMULATION COMMON UI
  // ==========================================================

  function slider(container, label, value, min, max, step, onChange) {
    const row = document.createElement("label");
    row.className = "nbv3-slider";

    row.innerHTML = `
      <span>${esc(label)}</span>
      <input
        type="range"
        min="${min}"
        max="${max}"
        step="${step}"
        value="${value}">
      <output>${value}</output>
    `;

    const input = row.querySelector("input");
    const output = row.querySelector("output");

    input.addEventListener("input", () => {
      output.value = input.value;
      onChange(Number(input.value));
    });

    container.appendChild(row);
  }


  function renderSimulation(v) {
    const type =
      String(v.simulation || "").toLowerCase();

    if (!SIMS[type]) return null;

    const state = {
      ...SIMS[type].defaults,
      ...(v.variables || {})
    };

    const el =
      document.createElement("article");

    el.className =
      "nbv3-card";

    el.innerHTML = `
      <div class="nbv3-title">
        🧪 ${esc(v.title || SIMS[type].title)}
      </div>

      <p>
        ${esc(
          v.instructions ||
          "Adjust the controls and observe the result."
        )}
      </p>

      <div class="nbv3-sim-controls"></div>

      <canvas
        class="nbv3-canvas"
        width="760"
        height="360">
      </canvas>

      <div class="nbv3-result"></div>
    `;

    const controls =
      el.querySelector(".nbv3-sim-controls");

    const canvas =
      el.querySelector("canvas");

    const ctx =
      canvas.getContext("2d");

    const result =
      el.querySelector(".nbv3-result");


    // --------------------------------------------------------
    // DRAWING HELPERS
    // --------------------------------------------------------

    function clear() {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    function projectile() {
      clear();

      const u =
        clamp(num(state.velocity,20),1,100);

      const angle =
        clamp(num(state.angle,45),5,85)
        * Math.PI / 180;

      const g =
        clamp(num(state.gravity,9.81),.1,30);

      const T =
        2*u*Math.sin(angle)/g;

      const R =
        u*u*Math.sin(2*angle)/g;

      const H =
        u*u*Math.sin(angle)**2/(2*g);

      ctx.beginPath();

      for (let i=0;i<=100;i++) {
        const t = T*i/100;
        const x = u*Math.cos(angle)*t;
        const y = u*Math.sin(angle)*t-.5*g*t*t;

        const px =
          45+(x/Math.max(R,1))*650;

        const py =
          300-(y/Math.max(H,1))*240;

        i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
      }

      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(40,300);
      ctx.lineTo(710,300);
      ctx.stroke();

      result.textContent =
        `Range = ${R.toFixed(2)} m | ` +
        `Maximum height = ${H.toFixed(2)} m | ` +
        `Time = ${T.toFixed(2)} s`;
    }


    function ohm() {
      clear();

      const V =
        clamp(num(state.voltage,12),0,50);

      const R =
        clamp(num(state.resistance,6),.1,100);

      const I = V/R;

      ctx.beginPath();
      ctx.moveTo(90,180);
      ctx.lineTo(670,180);
      ctx.stroke();

      ctx.strokeRect(320,145,120,70);
      ctx.fillText("R",375,185);

      ctx.beginPath();
      ctx.arc(90,180,30,0,Math.PI*2);
      ctx.stroke();

      result.textContent =
        `Current I = ${I.toFixed(3)} A`;
    }


    function hooke() {
      clear();

      const F =
        clamp(num(state.force,5),0,50);

      const k =
        clamp(num(state.springConstant,50),1,200);

      const x = F/k;

      const start = 100;
      const y = 180;
      const end = start+180+x*500;

      ctx.beginPath();
      ctx.moveTo(start,y);

      for(let i=0;i<12;i++) {
        ctx.lineTo(
          start+i*15,
          y+(i%2 ? 18 : -18)
        );
      }

      ctx.lineTo(end,y);
      ctx.stroke();

      ctx.fillRect(
        end,
        y-25,
        65,
        50
      );

      result.textContent =
        `Extension x = ${x.toFixed(3)} m`;
    }


    function uniformAcceleration() {
      clear();

      const u = num(state.u,5);
      const a = num(state.acceleration,2);
      const t = clamp(num(state.time,5),0,20);

      const s =
        u*t+.5*a*t*t;

      const v =
        u+a*t;

      const distance =
        clamp(s,0,620);

      ctx.beginPath();
      ctx.moveTo(50,230);
      ctx.lineTo(50+distance,230);
      ctx.stroke();

      ctx.fillRect(
        45+distance,
        215,
        25,
        25
      );

      result.textContent =
        `Displacement = ${s.toFixed(2)} m | ` +
        `Final velocity = ${v.toFixed(2)} m/s`;
    }


    function pendulum() {
      clear();

      const L =
        clamp(num(state.length,1),.2,5);

      const g =
        clamp(num(state.gravity,9.81),.1,30);

      const T =
        2*Math.PI*Math.sqrt(L/g);

      const pivotX=380;
      const pivotY=55;
      const scale=Math.min(230/L,70);

      const bobX =
        pivotX+
        Math.sin(.65)*L*scale;

      const bobY =
        pivotY+
        Math.cos(.65)*L*scale;

      ctx.beginPath();
      ctx.moveTo(pivotX,pivotY);
      ctx.lineTo(bobX,bobY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(
        bobX,
        bobY,
        22,
        0,
        Math.PI*2
      );
      ctx.fill();

      result.textContent =
        `Period T = ${T.toFixed(3)} s`;
    }


    function circuit() {
      clear();

      const R1 =
        clamp(num(state.resistance1,4),.1,100);

      const R2 =
        clamp(num(state.resistance2,6),.1,100);

      const V =
        clamp(num(state.voltage,12),0,100);

      const series = R1+R2;

      const parallel =
        1/(1/R1+1/R2);

      ctx.beginPath();
      ctx.moveTo(90,90);
      ctx.lineTo(670,90);
      ctx.lineTo(670,270);
      ctx.lineTo(90,270);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeRect(250,65,90,50);
      ctx.strokeRect(420,65,90,50);

      ctx.fillText("R1",280,95);
      ctx.fillText("R2",450,95);

      result.textContent =
        `Series Req = ${series.toFixed(2)} Ω | ` +
        `Parallel Req = ${parallel.toFixed(2)} Ω | ` +
        `Series current = ${(V/series).toFixed(3)} A`;
    }


    function wave() {
      clear();

      const A =
        clamp(num(state.amplitude,1),.1,5);

      const f =
        clamp(num(state.frequency,2),.1,10);

      const wavelength =
        clamp(num(state.wavelength,2),.1,10);

      ctx.beginPath();

      for(let x=0;x<=700;x++) {
        const y =
          180-
          A*55*
          Math.sin(
            2*Math.PI*x/
            (wavelength*70)
          );

        x ? ctx.lineTo(40+x,y)
          : ctx.moveTo(40+x,y);
      }

      ctx.stroke();

      const speed =
        f*wavelength;

      result.textContent =
        `Wave speed v = fλ = ${speed.toFixed(2)} units/s`;
    }


    function lens() {
      clear();

      const f =
        clamp(num(state.focalLength,10),1,100);

      const u =
        clamp(num(state.objectDistance,20),1,200);

      const denominator =
        f-u;

      const v =
        denominator === 0
          ? Infinity
          : (f*u)/denominator;

      ctx.beginPath();
      ctx.moveTo(380,50);
      ctx.lineTo(380,310);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(
        380,
        180,
        55,
        -Math.PI/2,
        Math.PI/2
      );
      ctx.stroke();

      result.textContent =
        Number.isFinite(v)
          ? `Image distance v = ${v.toFixed(2)} cm (using 1/f = 1/u + 1/v)`
          : "Image distance is undefined at u = f.";
    }


    function transformer() {
      clear();

      const Vp =
        clamp(num(state.primaryVoltage,240),1,1000);

      const Np =
        clamp(num(state.primaryTurns,1000),1,10000);

      const Ns =
        clamp(num(state.secondaryTurns,100),1,10000);

      const Vs =
        Vp*(Ns/Np);

      ctx.strokeRect(260,90,90,180);
      ctx.strokeRect(410,90,90,180);

      ctx.fillText("Primary",270,310);
      ctx.fillText("Secondary",405,310);

      result.textContent =
        `Secondary voltage Vs = ${Vs.toFixed(2)} V`;
    }


    function densityPressure() {
      clear();

      const rho =
        clamp(num(state.density,1000),.1,20000);

      const h =
        clamp(num(state.depth,2),0,100);

      const g =
        clamp(num(state.gravity,9.81),.1,30);

      const p =
        rho*g*h;

      ctx.strokeRect(
        260,
        60,
        200,
        240
      );

      ctx.fillText(
        "Fluid",
        330,
        180
      );

      result.textContent =
        `Pressure p = ρgh = ${p.toFixed(2)} Pa`;
    }


    function gasLaw() {
      clear();

      const P =
        clamp(num(state.pressure,100),1,1000);

      const V =
        clamp(num(state.volume,1),.1,20);

      const T =
        clamp(num(state.temperature,300),1,2000);

      const PV_T =
        (P*V)/T;

      ctx.beginPath();
      ctx.moveTo(70,295);
      ctx.lineTo(660,295);
      ctx.lineTo(660,50);
      ctx.stroke();

      result.textContent =
        `PV/T = ${PV_T.toFixed(4)} (relative constant)`;
    }


    function probability() {
      clear();

      const favourable =
        clamp(
          num(state.favourable,1),
          0,
          100
        );

      const total =
        clamp(
          num(state.total,6),
          1,
          100
        );

      const p =
        Math.min(
          favourable/total,
          1
        );

      ctx.strokeRect(
        120,
        120,
        500,
        80
      );

      ctx.fillRect(
        120,
        120,
        500*p,
        80
      );

      result.textContent =
        `Probability = ${p.toFixed(4)} = ${(p*100).toFixed(2)}%`;
    }


    const draw = {
      projectile_motion: projectile,
      ohms_law: ohm,
      hookes_law: hooke,
      uniform_acceleration: uniformAcceleration,
      simple_pendulum: pendulum,
      series_parallel_circuit: circuit,
      wave_motion: wave,
      lens_formula: lens,
      transformer: transformer,
      density_pressure: densityPressure,
      gas_law: gasLaw,
      probability
    };


    const ranges = {
      projectile_motion: [
        ["Initial velocity u (m/s)","velocity",1,100,.5],
        ["Angle θ (°)","angle",5,85,1],
        ["Gravity g (m/s²)","gravity",.1,30,.1]
      ],

      ohms_law: [
        ["Voltage V (V)","voltage",0,50,.5],
        ["Resistance R (Ω)","resistance",.1,100,.1]
      ],

      hookes_law: [
        ["Force F (N)","force",0,50,.5],
        ["Spring constant k (N/m)","springConstant",1,200,1]
      ],

      uniform_acceleration: [
        ["Initial velocity u (m/s)","u",-20,50,.5],
        ["Acceleration a (m/s²)","acceleration",-10,20,.1],
        ["Time t (s)","time",0,20,.1]
      ],

      simple_pendulum: [
        ["Length L (m)","length",.2,5,.1],
        ["Gravity g (m/s²)","gravity",.1,30,.1]
      ],

      series_parallel_circuit: [
        ["Resistance R1 (Ω)","resistance1",.1,100,.1],
        ["Resistance R2 (Ω)","resistance2",.1,100,.1],
        ["Voltage V (V)","voltage",0,100,.5]
      ],

      wave_motion: [
        ["Amplitude","amplitude",.1,5,.1],
        ["Frequency","frequency",.1,10,.1],
        ["Wavelength","wavelength",.1,10,.1]
      ],

      lens_formula: [
        ["Focal length f (cm)","focalLength",1,100,1],
        ["Object distance u (cm)","objectDistance",1,200,1]
      ],

      transformer: [
        ["Primary voltage Vp (V)","primaryVoltage",1,1000,1],
        ["Primary turns Np","primaryTurns",1,10000,10],
        ["Secondary turns Ns","secondaryTurns",1,10000,10]
      ],

      density_pressure: [
        ["Density ρ (kg/m³)","density",.1,20000,10],
        ["Depth h (m)","depth",0,100,.1],
        ["Gravity g (m/s²)","gravity",.1,30,.1]
      ],

      gas_law: [
        ["Pressure P","pressure",1,1000,1],
        ["Volume V","volume",.1,20,.1],
        ["Temperature T","temperature",1,2000,1]
      ],

      probability: [
        ["Favourable outcomes","favourable",0,100,1],
        ["Total outcomes","total",1,100,1]
      ]
    };


    (ranges[type] || []).forEach(
      ([label,key,min,max,step]) => {

        const value =
          clamp(
            num(
              state[key],
              SIMS[type].defaults[key]
            ),
            min,
            max
          );

        state[key] = value;

        slider(
          controls,
          label,
          value,
          min,
          max,
          step,
          newValue => {
            state[key] = newValue;
            draw[type]();
          }
        );
      }
    );


    draw[type]();

    return el;
  }


  // ==========================================================
  // IMAGE METADATA — NO TEMPORARY URL
  // ==========================================================

  function renderImage(v) {
    const el =
      document.createElement("article");

    el.className =
      "nbv3-card";

    el.innerHTML = `
      <div class="nbv3-title">
        🖼️ ${esc(v.caption || "Educational Illustration")}
      </div>

      <div class="nbv3-image-spec">
        <strong>Illustration specification</strong>

        <p>
          ${esc(
            v.alt ||
            "Educational illustration"
          )}
        </p>

        ${
          v.imageQuery
            ? `<small>
                Suggested subject:
                ${esc(v.imageQuery)}
               </small>`
            : ""
        }

      </div>
    `;

    return el;
  }


  // ==========================================================
  // COMPONENT DISPATCH
  // ==========================================================

  function renderVisual(v) {

    if (
      !v ||
      typeof v !== "object"
    ) {
      return null;
    }

    switch (
      String(v.type || "").toLowerCase()
    ) {

      case "equation":
        return renderEquation(v);

      case "diagram":
        return renderDiagram(v);

      case "graph":
        return renderGraph(v);

      case "table":
        return renderTable(v);

      case "comparison":
        return renderTable(v, true);

      case "flowchart":
        return renderFlow(v);

      case "process":
        return renderFlow(v, true);

      case "interactive":
        return renderInteractive(v);

      case "simulation":
        return renderSimulation(v);

      case "image":
        return renderImage(v);

      default:
        return null;
    }
  }


  // ==========================================================
  // MOUNT
  // ==========================================================

  function mountVisuals(data) {

    const visuals =
      data &&
      data.note &&
      Array.isArray(
        data.note.visualComponents
      )
        ? data.note.visualComponents
            .slice(0, MAX_VISUALS)
        : [];

    if (!visuals.length) return;

    const host =
      document.getElementById(
        "notePromptPreview"
      );

    if (!host) {
      console.warn(
        "NoteBank visual host not found."
      );
      return;
    }

    injectStyles();

    const old =
      document.getElementById(
        "nbv3-visuals"
      );

    if (old) old.remove();

    const wrap =
      document.createElement("section");

    wrap.id =
      "nbv3-visuals";

    wrap.className =
      "nbv3-visuals";

    const heading =
      document.createElement("h3");

    heading.textContent =
      "📚 Visual Learning Components";

    wrap.appendChild(heading);

    let rendered = 0;

    visuals.forEach(v => {

      try {

        const component =
          renderVisual(v);

        if (component) {
          wrap.appendChild(component);
          rendered++;
        }

      } catch (error) {

        console.warn(
          "NoteBank visual component skipped:",
          error
        );

      }

    });

    if (!rendered) return;

    host.parentNode.insertBefore(
      wrap,
      host
    );
  }


  // ==========================================================
  // DYNAMIC AI RESPONSE HOOK
  // ==========================================================

  const originalFetch =
    window.fetch.bind(window);

  window.fetch =
    async function (...args) {

      const response =
        await originalFetch(...args);

      try {

        const url =
          typeof args[0] === "string"
            ? args[0]
            : (
                args[0] &&
                args[0].url
              ) || "";

        if (
          String(url).includes(
            "/api/ai-content"
          )
        ) {

          const clone =
            response.clone();

          clone
            .json()
            .then(data => {

              if (
                data &&
                data.success === true &&
                data.note
              ) {

                mountVisuals(data);

              }

            })
            .catch(() => {});

        }

      } catch (error) {

        console.warn(
          "NoteBank visual hook error:",
          error
        );

      }

      return response;
    };


  // Expose a small safe API for future academic.html integrations.
  window.AINoteVisuals = {
    version: "3.0",
    mount: mountVisuals,
    simulations: Object.keys(SIMS)
  };


  console.log(
    "Aibinu Flexiprep NoteBank Visual Learning Engine v3 loaded."
  );

})();
