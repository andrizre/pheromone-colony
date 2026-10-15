// Pheromone field + ant agents. Pure JS, no dependencies.
"use strict";

const W = 960, H = 640;
const CELL = 4;                      // pheromone grid resolution
const GW = Math.ceil(W / CELL);      // grid width
const GH = Math.ceil(H / CELL);      // grid height

class PheromoneGrid {
  constructor() {
    this.home = new Float32Array(GW * GH);   // trail back to nest
    this.food = new Float32Array(GW * GH);   // trail to food
  }

  idx(x, y) {
    const gx = Math.min(GW - 1, Math.max(0, (x / CELL) | 0));
    const gy = Math.min(GH - 1, Math.max(0, (y / CELL) | 0));
    return gy * GW + gx;
  }

  deposit(x, y, amount, kind) {
    const i = this.idx(x, y);
    if (kind === 0) this.home[i] = Math.min(255, this.home[i] + amount);
    else this.food[i] = Math.min(255, this.food[i] + amount);
  }

  // 3x3 box diffusion + evaporation on both channels
  diffuseEvaporate(evapRate, passes) {
    for (let p = 0; p < passes; p++) {
      for (const field of [this.home, this.food]) {
        const out = new Float32Array(GW * GH);
        for (let y = 0; y < GH; y++) {
          for (let x = 0; x < GW; x++) {
            const i = y * GW + x;
            let sum = 0, n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = y + dy;
              if (yy < 0 || yy >= GH) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx;
                if (xx < 0 || xx >= GW) continue;
                sum += field[yy * GW + xx];
                n++;
              }
            }
            out[i] = (sum / n) * (1 - evapRate);
          }
        }
        field.set(out);
      }
    }
  }

  sample(x, y, kind) {
    const i = this.idx(x, y);
    return kind === 0 ? this.home[i] : this.food[i];
  }
}

class Ant {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.carrying = false;
    this.wanderPhase = Math.random() * 1000;
    this.lifetime = 0;
  }

  step(sim, dt) {
    const { grid, params } = sim;
    this.lifetime++;

    // --- sense three points ahead, steer toward strongest relevant pheromone
    const seekKind = this.carrying ? 1 : 0;   // carrying food: seek home trail; foraging: seek food trail
    const sd = params.sensorDist;
    const sa = params.sensorAngle;

    const mid = grid.sample(
      this.x + Math.cos(this.angle) * sd,
      this.y + Math.sin(this.angle) * sd, seekKind);
    const left = grid.sample(
      this.x + Math.cos(this.angle - sa) * sd,
      this.y + Math.sin(this.angle - sa) * sd, seekKind);
    const right = grid.sample(
      this.x + Math.cos(this.angle + sa) * sd,
      this.y + Math.sin(this.angle + sa) * sd, seekKind);

    const wander = (Math.random() - 0.5) * 2 * params.wander;

    // --- food odor: foraging ants with no trail to follow sniff nearby piles
    // and turn toward the closest one, giving the colony a discovery boost
    if (!this.carrying && mid + left + right < 1) {
      const odor = params.odorDist;
      let best = null, bestD2 = odor * odor;
      for (const pile of sim.foodPiles) {
        if (pile.amount <= 0) continue;
        const d2 = (this.x - pile.x) ** 2 + (this.y - pile.y) ** 2;
        if (d2 < bestD2) { bestD2 = d2; best = pile; }
      }
      if (best) {
        const target = Math.atan2(best.y - this.y, best.x - this.x);
        let diff = target - this.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));   // wrap to [-pi, pi]
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), params.turnSpeed * 1.5);
      }
    }

    // --- path integration (homing fallback): a carrying ant that senses no
    // home trail steers straight toward the nest, like real ants integrating
    // their outbound path. Keeps delivery from stalling before trails form.
    if (this.carrying && sim.nest && mid + left + right < 1) {
      const target = Math.atan2(sim.nest.y - this.y, sim.nest.x - this.x);
      let diff = target - this.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.angle += Math.sign(diff) * Math.min(Math.abs(diff), params.turnSpeed * 1.5);
    }

    if (mid > left && mid > right) {
      // keep going
    } else if (left > right) {
      this.angle -= params.turnSpeed + (Math.random() - 0.5) * 0.05;
    } else if (right > left) {
      this.angle += params.turnSpeed + (Math.random() - 0.5) * 0.05;
    }
    this.angle += wander;

    // --- move
    this.x += Math.cos(this.angle) * params.speed;
    this.y += Math.sin(this.angle) * params.speed;

    // --- walls (block) and edges (bounce)
    const wallCell = sim.wallAt(this.x, this.y);
    if (wallCell || this.x < 1 || this.x > W - 1 || this.y < 1 || this.y > H - 1) {
      this.x -= Math.cos(this.angle) * params.speed * 2;
      this.y -= Math.sin(this.angle) * params.speed * 2;
      this.angle += Math.PI + (Math.random() - 0.5);
      if (this.x < 1) { this.x = 1; this.angle = Math.PI - this.angle; }
      if (this.x > W - 1) { this.x = W - 1; this.angle = Math.PI - this.angle; }
      if (this.y < 1) { this.y = 1; this.angle = -this.angle; }
      if (this.y > H - 1) { this.y = H - 1; this.angle = -this.angle; }
    }

    // --- food pickup
    if (!this.carrying) {
      const fx = this.x, fy = this.y;
      for (const pile of sim.foodPiles) {
        const d2 = (fx - pile.x) ** 2 + (fy - pile.y) ** 2;
        if (d2 < pile.r * pile.r && pile.amount > 0) {
          pile.amount--;
          this.carrying = true;
          this.angle += Math.PI + (Math.random() - 0.5) * 0.5;  // turn back home
          this.foodSource = pile;
          break;
        }
      }
    } else if (sim.atNest(this.x, this.y)) {
      this.carrying = false;
      sim.delivered++;
      this.angle += Math.PI + (Math.random() - 0.5) * 0.5;
    }

    // --- deposit pheromone (only meaningful while on a mission)
    if (!this.carrying) {
      grid.deposit(this.x, this.y, params.deposit, 1);  // "food here" trail
    } else {
      grid.deposit(this.x, this.y, params.deposit, 0);  // "home this way" trail
    }
  }
}
