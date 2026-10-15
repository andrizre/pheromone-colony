"use strict";

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const params = {
  ants: 400,
  speed: 2,
  sensorAngle: 0.6,
  sensorDist: 20,
  deposit: 8,
  evap: 0.1,
  diffusion: 2,
  wander: 0.5,
  turnSpeed: 0.2,
  odorDist: 70,
};

const nest = { x: W / 2, y: H / 2, r: 22 };

let grid, ants, foodPiles, walls, delivered, paused = false, tool = "food";

function reset() {
  grid = new PheromoneGrid();
  ants = Array.from({ length: params.ants }, () =>
    new Ant(nest.x + (Math.random() - 0.5) * 30, nest.y + (Math.random() - 0.5) * 30));
  foodPiles = [];
  walls = new Uint8Array(GW * GH);
  delivered = 0;
  scatterFood(+document.getElementById("piles").value);
}

function scatterFood(n) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    // bias piles to reachable ring 160-320px from nest so trails form quickly
    const dist = 160 + Math.random() * 160;
    const x = Math.min(W - 50, Math.max(50, nest.x + Math.cos(ang) * dist));
    const y = Math.min(H - 50, Math.max(50, nest.y + Math.sin(ang) * dist));
    foodPiles.push({ x, y, r: 26 + Math.random() * 12, amount: 1000 + (Math.random() * 800 | 0) });
  }
}

function wallAt(x, y) {
  return walls[grid.idx(x, y)] === 1;
}
PheromoneGrid; // (referenced so sim.js classes stay in shared scope order)

function atNest(x, y) {
  return (x - nest.x) ** 2 + (y - nest.y) ** 2 < nest.r * nest.r;
}

// ---------- rendering ----------
const trailCanvas = document.createElement("canvas");
trailCanvas.width = GW; trailCanvas.height = GH;
const tctx = trailCanvas.getContext("2d");
const trailImage = tctx.createImageData(GW, GH);

function drawTrails() {
  const px = trailImage.data;
  for (let i = 0; i < GW * GH; i++) {
    const h = grid.home[i], f = grid.food[i];
    const o = i * 4;
    px[o]     = Math.min(255, h * 0.9);              // home trail: warm
    px[o + 1] = Math.min(255, f * 0.9);              // food trail: green-ish
    px[o + 2] = Math.min(255, f * 0.45 + h * 0.2);
    px[o + 3] = 255;
  }
  tctx.putImageData(trailImage, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(trailCanvas, 0, 0, W, H);
}

function drawScene() {
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, W, H);

  // walls
  ctx.fillStyle = "#3a4250";
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      if (walls[gy * GW + gx]) ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
    }
  }

  drawTrails();

  // food piles
  for (const p of foodPiles) {
    if (p.amount <= 0) continue;
    const density = Math.min(1, p.amount / 1500);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * density), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120, 220, 120, ${0.25 + 0.5 * density})`;
    ctx.fill();
    ctx.fillStyle = "#c8f5c8";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + p.r;
      const rr = p.r * 0.5 * density;
      ctx.fillRect(p.x + Math.cos(a) * rr - 1, p.y + Math.sin(a) * rr - 1, 2.5, 2.5);
    }
  }

  // nest
  ctx.beginPath();
  ctx.arc(nest.x, nest.y, nest.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 180, 84, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "#ffb454";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffb454";
  ctx.font = "11px system-ui";
  ctx.fillText("NEST", nest.x - 15, nest.y + 4);

  // ants
  ctx.fillStyle = "#e8e4da";
  for (const a of ants) {
    ctx.fillStyle = a.carrying ? "#8ef58e" : "#e8e4da";
    ctx.fillRect(a.x - 1.2, a.y - 1.2, 2.4, 2.4);
  }

  // stats
  const remaining = foodPiles.reduce((s, p) => s + Math.max(0, p.amount), 0);
  document.getElementById("statlines").textContent =
    `FPS ${fps.toFixed(0)} · Food remaining ${remaining} · Food delivered ${delivered}`;
}

// ---------- input ----------
let painting = false;
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

canvas.addEventListener("pointerdown", e => { painting = true; paint(canvasPos(e)); });
canvas.addEventListener("pointermove", e => { if (painting) paint(canvasPos(e)); });
window.addEventListener("pointerup", () => painting = false);

function paint(pos) {
  if (tool === "food") {
    foodPiles.push({ x: pos.x, y: pos.y, r: 18, amount: 500 });
  } else if (tool === "wall") {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const i = grid.idx(pos.x + dx * CELL, pos.y + dy * CELL);
        walls[i] = 1;
      }
  } else {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const i = grid.idx(pos.x + dx * CELL, pos.y + dy * CELL);
        walls[i] = 0;
        const gx = (pos.x + dx * CELL) / CELL | 0, gy = (pos.y + dy * CELL) / CELL | 0;
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
          grid.home[gy * GW + gx] = 0;
          grid.food[gy * GW + gx] = 0;
        }
      }
    foodPiles = foodPiles.filter(p => (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2 > 30 * 30);
  }
}

document.querySelectorAll(".tool").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    tool = btn.dataset.tool;
  });
});

function bindRange(id, fn) {
  const el = document.getElementById(id);
  const out = document.getElementById(id + "Out");
  const update = () => { out.textContent = el.value; fn(+el.value); };
  el.addEventListener("input", update);
  update();
}

bindRange("ants", v => {
  params.ants = v;
  if (!ants) return;
  while (ants.length < v) ants.push(new Ant(nest.x, nest.y));
  ants.length = v;
});
bindRange("speed", v => params.speed = v);
bindRange("sense", v => { params.sensorAngle = v; });
bindRange("dist", v => params.sensorDist = v);
bindRange("dep", v => params.deposit = v);
bindRange("evap", v => params.evap = v);
bindRange("diff", v => params.diffusion = v);
bindRange("odor", v => params.odorDist = v);
bindRange("piles", () => {});

document.getElementById("scatter").addEventListener("click", () =>
  scatterFood(+document.getElementById("piles").value));
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("pause").addEventListener("click", e => {
  paused = !paused;
  e.target.textContent = paused ? "Resume" : "Pause";
});

// ---------- main loop ----------
let last = performance.now(), fps = 60;

function frame(now) {
  fps = fps * 0.9 + (1000 / Math.max(1, now - last)) * 0.1;
  last = now;
  if (!paused) {
    for (const a of ants) a.step({ grid, params, foodPiles, wallAt, atNest, nest, get delivered() { return delivered; }, set delivered(v) { delivered = v; } }, 1);
    grid.diffuseEvaporate(params.evap, params.diffusion > 0 ? 1 : 0);
  }
  drawScene();
  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);
