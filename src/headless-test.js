// Headless verification: run the sim for 3000 ticks and confirm food gets delivered.
const fs = require("fs");
const vm = require("vm");
const simCtx = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(__dirname + "/../src/sim.js", "utf8").replace(/^"use strict";/m, ""),
  simCtx
);
const { PheromoneGrid, Ant } = vm.runInContext("({ PheromoneGrid, Ant })", simCtx);

const grid = new PheromoneGrid();
const params = { speed: 2, sensorAngle: 0.6, sensorDist: 20, deposit: 8, evap: 0.1, wander: 0.5, turnSpeed: 0.2, odorDist: 70 };
const nest = { x: 480, y: 320, r: 22 };
const foodPiles = [{ x: 320, y: 200, r: 30, amount: 5000 }];
const wallAt = () => false;
const atNest = (x, y) => (x - nest.x) ** 2 + (y - nest.y) ** 2 < nest.r ** 2;
let delivered = 0;
const sim = { grid, params, foodPiles, wallAt, atNest, nest, get delivered() { return delivered; }, set delivered(v) { delivered = v; } };
const ants = Array.from({ length: 300 }, () => new Ant(nest.x, nest.y));

for (let t = 0; t < 6000; t++) {
  for (const a of ants) a.step(sim, 1);
  grid.diffuseEvaporate(params.evap, 1);
  if (t === 3000) {
    console.log(`t=3000 delivered=${delivered}`);
    if (delivered < 30) {
      console.log("FAIL: discovery too slow — food-odor sensing not working?");
      process.exit(1);
    }
  }
  if (t % 1000 === 0) {
    let s = 0;
    for (let i = 0; i < grid.home.length; i++) s += grid.home[i];
    console.log(`t=${t} delivered=${delivered} avg home trail=${(s / grid.home.length).toFixed(2)}`);
  }
}
console.log("FINAL delivered:", delivered);
if (delivered > 5) console.log("PASS: colony successfully forages");
else { console.log("FAIL"); process.exit(1); }
