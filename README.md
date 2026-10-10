# 🐜 Pheromone Colony

An interactive, emergent ant-trail simulator. Hundreds of simple agents — each with
just three pheromone sensors and a random walk — collectively discover food piles,
build visible highways back to the nest, and switch to new routes when food runs out.
There is no pathfinding code: the intelligence lives entirely in the stigmergic
pheromone field (two channels: "food this way" and "home this way"), which diffuses
and evaporates on a grid every tick.

## Features

- Real-time canvas simulation (960×640) with up to 1,500 ants
- Two-channel pheromone field with adjustable deposit, evaporation, and diffusion
- Food odor sensing: foraging ants near a pile turn toward it even without a trail
  (adjustable odor range)
- Tunable ant sensing: sensor angle, sensor distance, speed, population
- Paint directly on the canvas: drop food, draw walls ants must route around, or erase
- Live stats: FPS, food remaining, food delivered
- Pause / reset / re-scatter food

## Run it

No build step, no dependencies:

```bash
# just open it
open index.html          # macOS
xdg-open index.html      # Linux
```

or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Headless verification

The agent logic is decoupled from rendering, so the colony can be tested in Node:

```bash
node src/headless-test.js
```

Runs 6,000 ticks and passes when ants successfully deliver food to the nest.

## How it works

Each ant samples three pheromone sensor points ahead (left / center / right),
steers toward the strongest relevant channel, adds a little random wander, and
deposits pheromone of the opposite channel (food-seekers lay "home" trail and
vice versa). Positive feedback amplifies the shortest successful routes; evaporation
prunes abandoned ones. Walls block movement and force rerouting.

## Files

- `index.html` / `style.css` — UI shell and control panel
- `src/sim.js` — pheromone grid + ant agent (pure logic, no DOM)
- `src/main.js` — rendering, input, control panel wiring
- `src/headless-test.js` — Node smoke test
