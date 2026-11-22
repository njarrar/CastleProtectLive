# 03. Code and Tech Survey

Status: research. Date: 2026-11-22.
Scope: open source artillery, Worms-like and castle physics code, plus the core tech Castle Protect needs.
Rule from the brief: we take ideas and math, never code, names, art or audio from other games.

## Contents

1. Summary and picks
2. Reference repo 1: BharathKumarRavichandran/pocket-tanks
3. Reference repo 2: AtlantaTeam/pocket-tanks
4. Wider survey (20 repos and libraries)
5. Deep dive: terrain (bitmap vs polygon vs marching squares)
6. Deep dive: falling dirt
7. Deep dive: projectile integration, wind, fixed step, determinism
8. Deep dive: AI aiming
9. Deep dive: trajectory preview
10. Deep dive: castle block physics
11. Deep dive: explosions and damage falloff
12. Deep dive: camera
13. Deep dive: low-end phone performance
14. Recommendations for Castle Protect
15. License notes

---

## 1. Summary and picks

- The two Pocket Tanks repos the owner gave us are small student and course projects. They show the genre loop in very few lines, but neither has code we should copy. One is AGPL-3.0, the other has no license file. Treat both as reading only.
- The best reference code in the genre is Hedgewars (GPL-2.0). Its AI ("guess flight time, solve launch speed, then simulate to check") and its land flag grid are the two ideas worth the most to us.
- Our picks, explained in section 14:
  - Terrain: a material grid (bitmap) as the one source of truth, drawn as chunked textures. No polygons for dirt.
  - Falling dirt: column compaction inside a dirty rect, animated over a short time.
  - Projectiles: our own code, not the physics engine. Fixed 120 Hz step, semi-implicit Euler, swept grid tests, seeded RNG.
  - AI: analytic solve plus simulated check plus candidate scoring. Difficulty from aim noise, weapon smarts and "bracketing" like a person.
  - Preview: run the same sim code, show a partial arc, and let the tech tree extend it.
  - Castle blocks: Planck.js (MIT, Box2D port, pure JS) with sleeping bodies and a "settle, then next turn" rule. Keep body counts low.
  - Damage: linear falloff with a floor, material multipliers, knockback impulse.
  - Camera: damped spring follow with lookahead and auto zoom to fit shooter and target.

## 2. Reference repo 1: BharathKumarRavichandran/pocket-tanks

| Field | Value |
|---|---|
| Link | https://github.com/BharathKumarRavichandran/pocket-tanks |
| Stars | 3 |
| Language | Vanilla JavaScript, Canvas 2D |
| License | AGPL-3.0 (LICENSE file present) |
| Size | 1 file of logic: `game.js`, 1030 lines. Plus `index.html`, `main.css`, ~100 images, ~17 sounds |
| Last push | 2024 (written 2018) |

### Structure

- One global script. About 80 global variables (`angle1`, `angle2`, `power1`, `power2`, `fire1`, `fire2`, ...).
- One `keydown` listener holds all input logic (F fire, A/D move, J/L angle, N/M power, W/S weapon, U switch player).
- One `requestAnimationFrame` loop (`animation`) redraws everything each frame.
- Every function exists twice, once per player (`missile1Draw` and `missile2Draw`, `missileHitCheck1` and `missileHitCheck2`).

### Terrain

- The hill is a fixed shape: a bezier curve, two line segments, another bezier. Points get a small random offset at load.
- "Destruction" is fake. On impact the code pushes `{x, y, side}` into `hillDamageArray` and each frame draws a grey filled arc plus an explosion sprite over the hill. The hill shape never changes, so later shots still collide with the old surface.

### Projectile physics

- Not real physics. Speed is `13 + 2 * power` with only 3 power levels.
- Gravity changes by angle bucket. For angles 0 to 15 it adds `gravity * inc * 0.2`; for 35 to 42 it adds `gravity * inc * 0.01`; above 42 it subtracts a tiny amount. A magic "bounce" factor scales vertical motion. The left and right tanks use different constants.
- The step is per frame, so speed depends on the screen refresh rate (a 120 Hz phone plays at double speed).
- No wind.

### Collision

- Tank hit: axis aligned box test with hand tuned offsets.
- Hill hit: hard coded line equations, for example `yhit1 = (-33*mHitX1+124350)/247`. Those lines only match the default hill, not the randomised one.
- Out of bounds ends the shot.

### Damage, turns, AI, weapons

- No health. Each hit adds a fixed score (15 for "Single Shot", 20 for "Missile").
- 5 shots and 4 moves per player. Turn passes on impact or miss. The U key also flips the active player by hand.
- No AI. Local two player only.
- Two weapons. The asset folder holds many weapon icons (laser, homing, acid rain, three shot, ...) named after the original commercial game, but the code never uses them.

### Rendering and audio

- Canvas 2D, fixed 1270x600 canvas, no scaling, keyboard only. Not playable on a phone.
- UI is images with text drawn at fixed pixel spots.
- `new Audio()` per sound. Music is a commercial track file.

### Code quality

Low. Globals, copy paste per player, magic numbers, frame rate bound physics, collision that does not match the drawn terrain, no tests, no modules. Fine as a weekend project, not a base.

### Reuse as ideas

- The UI strip idea: move, weapon, fire, angle, power in one bottom bar. Pocket Tanks style players expect it.
- Ammo and move counts per match as a simple pacing tool.

### Avoid

- Its physics hacks. Tuning feel by bending gravity per angle makes shots impossible to learn and impossible for AI to predict.
- Its assets. Many look taken from the commercial game and its menus. The brief bans that look, and the files carry no clear rights.
- AGPL code. Linking or copying it would force our whole app under AGPL. Do not copy any line.

## 3. Reference repo 2: AtlantaTeam/pocket-tanks

| Field | Value |
|---|---|
| Link | https://github.com/AtlantaTeam/pocket-tanks |
| Stars | 2 |
| Language | TypeScript, React 17, Redux, Redux Saga, Express SSR, Sequelize + Postgres, Webpack, Jest, Storybook, Tailwind, Docker |
| License | No LICENSE file. `package.json` says `"ISC"`, GitHub detects none. Treat as all rights reserved. |
| Game code | `src/components/Pages/Game/`: `GamePlay.ts` 538, `Tank.ts` 317, `Bullet.ts` 207, `Ground.ts` 162, `Worker.ts` 145, `Game.tsx` 420 lines |
| Last push | 2024 (course project, three authors, Russian comments) |

### Structure

- A full web app: login, OAuth, profile, forum, leaderboard, i18n, theme switch, SSR server. Most of the repo is not the game.
- The game is a set of classes (`GamePlay`, `Tank`, `Bullet`, `Ground`) driven by a React page that pushes angle and power through Redux.
- Bot aiming runs in a Web Worker through `comlink`, with a sync fallback.

### Terrain (`Ground.ts`)

- A heightmap: `heights[x]` for every pixel column. No caves or overhangs.
- Generation is a random walk on slope: each column adds `slope` to height, `slope` drifts by a small random amount, and it flips when it hits a min or max height. Simple and gives decent rolling hills.
- On explosion, `fall(x, y, r)` stores for each column in the blast a `delta` (the chord length of the circle at that column, via Pythagoras). Each draw frame lowers `heights[x]` by 1 while `delta` counts down, so the crater "sinks" in an animation. Because it is a heightmap, a blast under an overhang is not possible and the whole column above the blast drops.
- Drawn as one vertical 1 px line per column, then a sand pattern on top with `source-atop`.

### Projectile physics (`Bullet.ts`)

- Euler step per frame: `dy += gravity (0.1)`, `dx -= dx * wind`, then `x = floor(x + dx)`, `y = floor(y + dy)`.
- Flooring position every step throws away sub pixel motion, so slow shots drift and the arc is jagged.
- Wind exists as a drag factor, but it is always 0.
- Step is per animation frame with a 15 ms throttle, so speed still depends on frame timing.
- Side walls bounce the shell (`dx *= -1`).

### Collision

- Ground: `innerHeight - y - radius <= heights[floor(x)]`. A point test, so fast shells can tunnel through thin peaks.
- Tank: `ctx.isPointInPath(tank.tankHitArea, x, y)` with the tank's current canvas transform. Works, but ties collision to a canvas context. The worker has to build an `OffscreenCanvas` only to run hit tests.

### Damage and turns

- Score is the shot's power on a hit. Hit tanks "jump" with a small arc (`jumpOnHit`).
- Turn changes when the bullet finishes its explosion animation and the ground stops falling.
- Bot taunts after big hits (`sendBotAngryMessage` and so on). A nice touch of personality.

### AI (`GamePlay.botAiming`, `Worker.ts`)

```
for power in 2..17:
  for angle from straight up toward the target, step 0.01 rad:
    simulate a virtual bullet until it hits something
    if it hits the tank: add small random angle noise by difficulty, fire
    if it overshoots: remember the closest miss, step angle back 2, try next power
fallback: fire the closest miss; if it missed twice, move 10 px
```

- Brute force over up to ~16 x 157 sims, each a per pixel loop. It works because a sim is cheap and the world is small.
- Difficulty noise is tiny: `random * (5 - level) * 0.001` rad. Easy and hard feel nearly the same.
- The worker clones state with `JSON.stringify` of whole objects, then patches them back with `Object.assign`. Fragile.

### Rendering

- Canvas 2D with dirty region redraws: only the strip under the blast and the strip under each tank get cleared and redrawn. Good instinct for slow devices, but the bookkeeping leaks into game logic.
- Tank slope on terrain: find the two highest support points under the tank and rotate the sprite between them (`slopeTank`). Good idea.
- `calcBulletStartPos` reads `document.querySelector('.canvas').getBoundingClientRect()` inside game logic. Mixing DOM scroll into physics is a bug source.

### Code quality

Medium for app code (TypeScript, lint, tests, Storybook), low for game code. Game state is split between class fields and Redux. Modes are booleans (`isFireMode`, `isAngleMode`, `isMoveMode`) not a state machine. Physics, drawing and DOM mix in the same methods. Only one weapon type exists.

### Reuse as ideas

- Run AI in a worker so the UI never stalls. Have a sync fallback.
- Heightmap random walk with slope drift as a cheap terrain seed (we use it to fill our grid, not as the store).
- Sinking crater animation timing (short, readable).
- Two support point tank tilt.
- Bot personality lines after events.

### Avoid

- Flooring positions every step.
- Canvas API calls (`isPointInPath`) in collision code. Keep sim pure data.
- Redux for per frame game state.
- Login, forum, server: our game is offline and single player.
- Any code copy. No license means no rights.

## 4. Wider survey

Stars and data from the GitHub API on 2026-11-22. "Technique" is what is worth learning, not a judgement of the whole project.

### 4.1 Games

| # | Repo | Stars | Lang | License | Technique worth noting |
|---|---|---|---|---|---|
| 1 | [hedgewars/hw](https://github.com/hedgewars/hw) | 577 | Pascal, Lua, Rust, C++ | GPL-2.0 | Land is a 2D grid of 16 bit flags (`lfBasic`, `lfIndestructible`, `lfObject`, `lfDamaged`) apart from the color pixels. Custom fixed point `hwFloat` for deterministic sim and replays. Sin lookup table (`uSinTable.pas`). AI per weapon "test" functions (`uAIAmmoTests.pas`): pick a flight time, solve velocity in closed form with wind, then step a sim to find the real impact and rate the blast. Difficulty adds angle and power noise. Explosion damage falls off linearly with distance. Lua mission scripting. |
| 2 | [yeKcim/warmux](https://github.com/yeKcim/warmux) | 153 | C++ (SDL) | GPL-2.0 | Map split into fixed tiles. Empty tiles share one "empty" object; others keep an "empty bitfield" so whole blocks can be skipped. AI "ideas" make "strategies" with a rating; `FireMissileWithFixedDurationIdea` solves launch speed for a set flight time and lowers confidence for long flights (`1/duration`). Closed form `Trajectory::GetPositionAt(t)`. |
| 3 | [CiaranMcCann/Worms-Armageddon-HTML5-Clone](https://github.com/CiaranMcCann/Worms-Armageddon-HTML5-Clone) | 323 | TypeScript | Apache-2.0 | Canvas terrain cut with `destination-out` arcs, then Box2D static boxes rebuilt from the alpha channel in 5 px tall row runs, only inside the blast's band. Deforms batched to once per frame. Simple pan camera. Shows the cost of rebuilding physics from pixels. |
| 4 | [zladovan/gorched](https://github.com/zladovan/gorched) | 432 | Go (terminal) | MIT | Terrain as columns of vertical spans. A cut splits a column into parts; floating parts become falling bodies; a "joiner" merges touching spans after they land. Clean model for falling dirt. |
| 5 | [zenoamaro/ravaged-planet](https://github.com/zenoamaro/ravaged-planet) | 25 | JavaScript | MIT | Canvas alpha as the land mask with a cached `ImageData` for point tests. `collapseTerrain` counts solid pixels per column and redraws them at the bottom: the simplest falling dirt. Weapon specs as data objects (MIRV, roller, etc). AI is only random. |
| 6 | [openlierox/openlierox](https://github.com/openlierox/openlierox) | 306 | C++ | mixed (LGPL / GPL parts) | Real time Liero clone. Per pixel material map (dirt, rock, background) and particles that carve and deposit dirt. Weapons fully scripted in data files. |
| 7 | [gliptic/liero](https://github.com/gliptic/liero) | 287 | C | none listed | Classic per pixel material table with flags per palette index. Shows how far a plain byte grid goes. |
| 8 | [bberberov/scorched3d](https://github.com/bberberov/scorched3d) | 14 | C++ | GPL-2.0 | 3D heightmap artillery. Heightmap deform plus a wide weapon set, wind, shields and economy between rounds. Good for weapon and shop ideas. |
| 9 | [amhndu/tanks-game](https://github.com/amhndu/tanks-game) | 36 | C++ (SFML) | GPL-3.0 | Small, clean turn based artillery with destructible procedural terrain and up to 8 local players. |
| 10 | [jamesmoriarty/scorched_earth](https://github.com/jamesmoriarty/scorched_earth) | 130 | Ruby (JRuby) | MIT | Tiny Scorched Earth clone, no dependencies. Easy to read event driven turn loop. |
| 11 | [pkali/scorch_src](https://github.com/pkali/scorch_src) | 48 | 6502 Assembly | Unlicense | Scorched Earth demake for Atari 800. Proof that the whole genre runs on a 1.8 MHz CPU; useful as a mindset for low end phones. |
| 12 | [sergiss/artillery-game](https://github.com/sergiss/artillery-game) | 7 | JavaScript | MIT | AI uses trajectory prediction by running the shot model ahead. |
| 13 | [lospolosadwords-dev/squeak-and-destroy](https://github.com/lospolosadwords-dev/squeak-and-destroy) | 7 | JavaScript | MIT | Modern no build canvas game: bitmap mask terrain plus cached painted canvas, 63 weapons as data, class skill trees, "forts" mode, three AI personalities, daily challenge. Close to our feature scope; useful as a scale check. |
| 14 | [whyboris/Gravity-Wars](https://github.com/whyboris/Gravity-Wars) | 56 | Lua (LOVE2D) | MIT | Shots bend around planets. Example of a twist on the core shot model. |
| 15 | [apetavern/grubs](https://github.com/apetavern/grubs) | 50 | C# (s&box) | MIT | Worms like with random levels. Recent and active. |
| 16 | [bryceredd/CastleHassle](https://github.com/bryceredd/CastleHassle) | 115 | Objective-C (cocos2d, Box2D) | none listed | Physics castle building and siege on iOS. Pieces as Box2D bodies, catapult shots. Closest open code to "build a castle, knock theirs down". |
| 17 | [cubiccm/artil-io](https://github.com/cubiccm/artil-io), [jimmyfnc/tank-wars](https://github.com/jimmyfnc/tank-wars) | 4, 0 | TypeScript, Phaser 3 | none, MIT | Phaser 3 artillery samples: how scenes, input and texture terrain fit Phaser's model. |
| 18 | [tryfinsigabrt/Artillery-Rampage](https://github.com/tryfinsigabrt/Artillery-Rampage) | 4 | GDScript (Godot 4.4) | MIT | Godot 4 artillery sample: polygon terrain with `Geometry2D` clip ops. |

ShellShock Live and Gunbound have no open source code. The only "Gunbound clone" repos found are tiny (for example [masag0/Guntanks](https://github.com/masag0/Guntanks), 17 stars, no license).

### 4.2 Terrain and physics libraries

| # | Repo | Stars | Lang | License | Technique |
|---|---|---|---|---|---|
| 19 | [Ideefixze/DTerrain](https://github.com/Ideefixze/DTerrain) | 461 | C# (Unity) | MIT | Bitmap stored as per column lists of solid ranges `[min,max]`. Layer split into chunks with their own small textures (many small texture uploads beat one big one). Colliders rebuilt per chunk with a quadtree of boxes. Author notes colliders cost ~90% of the time; splitting a render layer from a logic layer fixes it. |
| 20 | [milesturin/Godot-Destructable-Terrain](https://github.com/milesturin/Godot-Destructable-Terrain) | 113 | GDScript | MIT | Interpolated marching squares on a density field, per chunk, then triangle decomposition for collision. Smooth edges. |
| 21 | [matterda/godot-destructible-terrain](https://github.com/matterda/godot-destructible-terrain) | 101 | GDScript | MIT | Polygon clipping terrain in Godot. |
| 22 | [xjxxjx1017/Destructible-Terrain-With-Phaser](https://github.com/xjxxjx1017/Destructible-Terrain-With-Phaser) | 36 | TypeScript | MIT | Quadtree of solid / empty cells in Phaser 3. Draw and erase with circles, rects, lines. Area calc and ray tests. |
| 23 | [lukakostic/PixelTerrainInUnity](https://github.com/lukakostic/PixelTerrainInUnity) | 36 | C# | GPL-3.0 | Pixel terrain for Unity in the Scorched Earth / Worms style. |
| 24 | [JAStanton/Destructible-Terrain](https://github.com/JAStanton/Destructible-Terrain) | 21 | JavaScript | none listed | Early HTML5 pixel perfect terrain demo. |
| 25 | [piqnt/planck.js](https://github.com/piqnt/planck.js) | 5322 | TypeScript | MIT | Box2D 2.x port in pure JS/TS. No WASM, small, stable API, sleeping bodies, chain shapes, continuous collision for bullets. |
| 26 | [erincatto/box2d](https://github.com/erincatto/box2d) | 10512 | C | MIT | Box2D v3. Faster solver, built for cross platform determinism. Needs a WASM build for web. |
| 27 | [dimforge/rapier.js](https://github.com/dimforge/rapier.js) | 700 (engine 6107) | Rust to WASM | Apache-2.0 | Fast, has an enhanced determinism mode and snapshot / restore of the whole world (handy for AI lookahead). WASM bundle is large (~1 to 2 MB). |
| 28 | [liabru/matter-js](https://github.com/liabru/matter-js) | 18666 | JavaScript | MIT | Easy and popular, built into Phaser. Weaker stacking stability than Box2D family; tall block towers jitter and creep. |
| 29 | [AngusJohnson/Clipper2](https://github.com/AngusJohnson/Clipper2) / [velipso/polybooljs](https://github.com/velipso/polybooljs) | 2524 / 619 | C++ (WASM port) / JS | BSL-1.0 / MIT | Polygon boolean ops if we ever cut polygon shapes (for example shattering a block). |
| 30 | [mapbox/earcut](https://github.com/mapbox/earcut), [mourner/simplify-js](https://github.com/mourner/simplify-js) | 2632, 2388 | JS | ISC, BSD-2 | Triangulate and simplify outlines from marching squares. |

## 5. Deep dive: terrain

Three families exist. Below, "cell" means one grid unit. We can use 1 cell = 2 screen px on phones to cut memory by 4x.

### 5.1 Bitmap (material grid)

Store terrain as `Uint8Array(w * h)`, one byte per cell holding a material id (0 = air). Draw it by keeping a texture in sync.

```
grid = Uint8Array(W * H)            // 0 air, 1 dirt, 2 rock, 3 bedrock (no damage), 4 castle stone ...
solid(x, y)  = grid[y * W + x] != 0
hardness[m]  = table per material   // how much blast it takes to remove

carveCircle(cx, cy, r, power):
  for y in cy - r .. cy + r:
    dx = floor(sqrt(r*r - (y - cy)^2))
    for x in cx - dx .. cx + dx:
      m = grid[y*W + x]
      if m == 0 or m == BEDROCK: continue
      d = dist(x, y, cx, cy) / r            // 0 center, 1 edge
      if power * (1 - d) >= hardness[m]: grid[y*W + x] = 0
  markDirty(rect(cx - r, cy - r, 2r, 2r))
```

Pros: exact craters, caves, tunnels, any shape. Point and ray tests are a single array read. Materials come for free. Easy to save (RLE or deflate). Easy to make deterministic (integers only).
Cons: memory (2048 x 1024 = 2 MB per byte grid, fine), texture upload cost when it changes, and rigid bodies cannot collide with a grid directly.

Used by: Hedgewars, Liero, ravaged-planet, squeak-and-destroy, DTerrain.

### 5.2 Polygon terrain with boolean clips

Store land as a set of polygons. A blast subtracts a circle polygon (Clipper2, polybool, or Godot `Geometry2D.clip_polygons`).

```
land = [polygons]
explode(c, r): land = difference(land, circlePolygon(c, r, 24 sides))
                 land = simplify(land, 0.5)
                 rebuildColliders(touched polygons)
```

Pros: smooth edges, low memory, maps straight onto physics engine shapes.
Cons: repeated clips build up tiny slivers and float errors; needs cleanup. Materials and hardness are awkward. Cost grows with polygon complexity. Hard to make bit exact deterministic.

### 5.3 Marching squares over a grid

Keep the grid (5.1) as truth, and extract outlines from it when you need them.

```
for each 2x2 cell block in dirty chunk:
  case = solid(tl)<<3 | solid(tr)<<2 | solid(br)<<1 | solid(bl)
  emit edge segments from lookup table[case]       // interpolate on density for smooth edges
join segments into polylines
simplify (Douglas Peucker, tolerance 0.75 cell)
create chain shapes for the physics engine for this chunk only
```

Pros: grid flexibility plus smooth outlines and real collision shapes for rigid bodies. Work stays per chunk.
Cons: more code. Must handle chunk seams.

### 5.4 Verdict

Use the grid as truth (5.1). Projectiles test the grid directly. Only if a rigid body (castle block, rolling unit) needs to touch dirt do we build marching squares chain shapes (5.3), and only for dirty chunks near bodies. Skip polygon clipping for dirt. Use polygon clips only to split castle blocks into chunks if design wants it.

Render: split the world into 256 x 256 cell chunks. Each chunk owns a small canvas (or WebGL texture). On change, redraw only dirty chunks and upload them. DTerrain found that many small uploads beat one big upload; the Worms HTML5 clone shows the cost of rebuilding everything.

Terrain art: do not paint per cell colors. Keep a material grid plus a few tiling textures per material and a 1 to 2 cell darker "edge" pass computed from neighbors. That keeps craters pretty without storing a full color image.

## 6. Deep dive: falling dirt

Pocket Tanks style games drop loose dirt after a blast. Options from the survey:

1. Heightmap sink (AtlantaTeam): only works with no overhangs.
2. Whole map column collapse (ravaged-planet): count solid cells per column, stack them at the bottom. Simple, but it flattens every overhang on the map, every time.
3. Span columns with falling parts (gorched): accurate, more code.
4. Cellular sand (falling sand games): each cell falls on its own. Pretty but slow at scale and hard to predict.

Pick: local column compaction, limited to the blast rect plus a margin, only for "loose" materials. Rock and bedrock never fall. Animate over ~300 to 500 ms.

```
settleDirt(rect):
  moves = []
  for x in rect.x0 .. rect.x1:
    write = rect.y1                    // bottom of the rect (y grows down)
    for y from rect.y1 down to topOfWorld:
      m = grid[y*W + x]
      if m == 0: continue
      if not loose[m]: write = y - 1; continue      // rock acts as a floor
      if y != write:
        moves.push({x, from: y, to: write, m})
        grid[write*W + x] = m; grid[y*W + x] = 0
      write -= 1
  return moves                          // renderer tweens these, sim is already final
```

Key rule: the sim result is final at once. The animation only plays the moves back. That keeps AI, preview and replays exact, and the turn can end as soon as the animation ends.

Units and castle parts on top of fallen dirt get a "ground lost" check and fall (with fall damage if design wants it).

## 7. Deep dive: projectile integration with wind and gravity

### 7.1 Rules

- Fixed time step for all sim. Render with interpolation. Never step physics per frame.
- Semi-implicit (symplectic) Euler: update velocity, then position. Stable and cheap. Matches what the AI simulates.
- Wind is a constant horizontal acceleration for the whole turn (Hedgewars adds `aiWindSpeed` to `dX` each tick). Optional drag per weapon.
- Swept collision: test the segment from old to new position, not only the end point. Fast shells must not tunnel through thin walls.
- Never round positions inside the sim (AtlantaTeam bug).

### 7.2 Step

```
const DT = 1 / 120                     // sim rate; render at display rate
G = 600 cells/s^2 (tune)               // gravity
wind = turnWind * WIND_SCALE           // cells/s^2, set once per turn from seeded RNG

stepShell(s):
  s.vx += (wind * s.windFactor - s.drag * s.vx) * DT
  s.vy += (G * s.gravFactor - s.drag * s.vy) * DT
  nx = s.x + s.vx * DT
  ny = s.y + s.vy * DT
  hit = sweep(s.x, s.y, nx, ny)        // DDA through the grid + circle test vs units/blocks
  if hit: return impact(hit)
  s.x = nx; s.y = ny
  s.age += DT
  weapon.onTick(s)                     // splits, homing, bounces live here

loop(frameTime):
  acc += min(frameTime, 0.25)          // clamp after tab switch / app resume
  while acc >= DT: stepAll(); acc -= DT
  alpha = acc / DT
  render(lerp(prev, curr, alpha))
```

Sweep: a DDA / Bresenham walk across grid cells between the two points. At 120 Hz and top speed ~1500 cells/s the segment is ~12 cells, so the walk is cheap.

### 7.3 Determinism

Why we care in a single player game: the AI and the trajectory preview must match the real shot, replays and bug reports must reproduce, and a seed must give the same level on every device (for daily challenges or shared seeds).

- One seeded PRNG (for example sfc32 or mulberry32) owned by the sim. Never call `Math.random()` in sim code. Use separate streams for sim and cosmetic effects so particles do not change outcomes.
- JS `+ - * /` on doubles is IEEE exact and the same on every engine. `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp` are not specified bit exact, and V8 and JavaScriptCore (iOS) can differ in the last bit. Fix: compute the launch vector once per shot with a lookup table (Hedgewars ships `uSinTable`) or a fixed polynomial, and keep the per tick loop to basic math.
- Sim reads no wall clock, no DOM, no canvas.
- Fixed order of updates (stable arrays, no iteration over object keys that may reorder).
- Physics engine bodies (section 10) are the weak spot. Planck.js is deterministic on one build and engine, and in practice across engines if we avoid trig in our own code paths, but this is not guaranteed. We only need "same device, same result" for preview and AI, which it gives.

## 8. Deep dive: AI aiming

### 8.1 Approaches seen

| Approach | Where | Notes |
|---|---|---|
| Random | ravaged-planet | Useless beyond a joke "dummy" bot. |
| Brute force grid over angle and power with full sim | AtlantaTeam | Works, slow if the sim grows (castles, many units). |
| Pick flight time, solve velocity in closed form, verify by sim, rate blast | Hedgewars, Warmux | Best. Few sims, handles wind, scores real damage. |

### 8.2 Closed form seed

Given launch point `P`, target `T`, gravity `g` (down positive), wind `w`, and a flight time `t`:

```
vx = (T.x - P.x) / t - 0.5 * w * t
vy = (T.y - P.y) / t - 0.5 * g * t
speed = hypot(vx, vy); angle = atan2(-vy, vx)
reject if speed > maxSpeed or angle outside the barrel limits
```

Sweep `t` from short (flat shot) to long (lob). Each `t` gives one candidate. This is what Hedgewars `TestBazooka` does (`rTime` loop).

### 8.3 Verify and score by sim

Terrain, castle walls and drag break the closed form, so run the real sim on a copy of the world:

```
planShot(ai, world):
  best = null
  for weapon in ai.usableWeapons():
    for t in flightTimes(weapon):                 // 8 to 20 samples
      (angle, power) = solve(P, aimPoint(weapon), t)
      if invalid: continue
      result = simulateShot(world.cloneLight(), weapon, angle, power)   // same code as the game
      score = rate(result)                        // damage to enemy - k * damage to self
                                                  // + bonus for key structures, - wasted ammo cost
      if score > best.score: best = {weapon, angle, power, score}
      // local refine: try +-1 degree, +-2% power around good candidates
  return best
```

When the target is behind a wall, a binary search on power at a fixed angle is a cheap fallback: impact distance grows with power for a fixed angle, so bisect on "landed short" vs "landed long".

```
bisectPower(angle, lo, hi):
  repeat 12:
    mid = (lo + hi) / 2
    x = simulateShot(angle, mid).impactX
    if x < target.x: lo = mid else hi = mid      // flip for shots to the left
  return (lo + hi) / 2
```

`cloneLight()` copies only what a shell can touch: the grid is shared read only during the sim (we carve nothing), units and blocks are copied as plain records. Rigid body reaction (blocks falling after the hit) is not simulated in planning; we use a cheap "structure value" estimate instead.

### 8.4 Difficulty

Make difficulty a set of knobs, not one number. AtlantaTeam's noise was too small to matter; Hedgewars scales noise by level for both angle and power.

| Knob | Easy | Normal | Hard | Boss |
|---|---|---|---|---|
| Angle noise (deg, gaussian sigma) | 4 | 2 | 0.7 | 0.3 |
| Power noise (% sigma) | 8 | 4 | 1.5 | 0.5 |
| Uses wind | half | yes | yes | yes |
| Weapon choice | random from best 4 | best of 2 | best | best + combos |
| Thinks about own safety | no | yes | yes | yes |
| Bracketing (corrects from its own last miss) | slow | yes | fast | n/a (rarely misses) |
| Think time shown | 1.5 s | 1.2 s | 0.8 s | 0.8 s |

"Bracketing" makes AI feel human: first shot uses a bigger error, each next shot at the same target halves it, like a person who adjusts from the last impact. Players read that as "it is learning", which is more fun than a bot that is either perfect or random.

```
error_n = baseError * (0.5 ^ shotsAtThisTarget)
```

Personality (from AtlantaTeam's taunts and squeak-and-destroy's AI types): weight terms in `rate()` differently per enemy type. A "sapper" prefers digging shots under walls, a "show off" prefers big flashy weapons, a "turtle" spends turns on repair.

### 8.5 Budget

Run planning in a Web Worker (AtlantaTeam did) or slice it across frames (for example 30 sims per frame). Cap at ~400 sims per turn. With a 120 Hz step and 3 s average flight that is ~144k shell steps: under 50 ms on a mid phone in a worker. Show a "thinking" pose while it runs.

## 9. Deep dive: trajectory preview

Run the same `stepShell` from the barrel for N steps. Draw dots, not a solid line. Use the real gravity and real wind.

```
preview(angle, power, weapon, lengthFrac):
  s = makeShell(angle, power, weapon)
  pts = []
  for i in 0 .. MAX_STEPS:
    stepShell(s) (no carve, no damage)
    if i % 6 == 0: pts.push(s.x, s.y)
    if hit or pathLength(s) > lengthFrac * fullLength: break
  draw dots with fading alpha
```

Design levers (fits the tech tree):

- Show only the first 25% of the arc at the start. Upgrades extend it (40%, 60%), show wind effect, or show the impact marker. Full preview kills the skill game, so keep the last bit hidden except for training or easy mode.
- Show a ghost of the last shot's arc. It is cheap, helps players adjust, and is fair.
- Update on input change only, not every frame.

## 10. Deep dive: castle block physics

### 10.1 What the design needs

Castle Clashers style play wants walls and towers made of pieces that crack, fall and topple. That means rigid bodies with stacking, friction and joints. Stacking stability matters more than raw speed.

### 10.2 Options

| Option | Pros | Cons |
|---|---|---|
| Planck.js (Box2D 2.x in JS) | Pure JS, MIT, small (~200 KB min), mature Box2D solver, sleeping, chain shapes for terrain, bullet CCD, joints. Easy to debug. | Single thread. Slower than WASM for 500+ bodies. Not guaranteed cross engine deterministic. |
| Box2D v3 (C, via WASM) | Fastest Box2D, better stacking, designed for determinism. | We must build or pick a WASM binding. Less JS tooling. |
| Rapier (WASM) | Fast, deterministic mode, world snapshot and restore. | Big download, WASM debugging, async init. |
| Matter.js | Easiest, built into Phaser. | Weaker stacking; towers creep and wobble. Poor fit for castles. |
| Custom (grid of blocks with HP, no rigid bodies) | Fully deterministic, tiny, trivial AI planning. | No toppling drama. Feels static. |

### 10.3 Pick: hybrid

- Castle pieces are Planck.js bodies (boxes, wedges, round towers as polygons). Joints ("mortar") break when an impulse or HP threshold is passed.
- Each piece also has HP and a material. Shells hit pieces through our own sweep (not the engine), then apply damage plus an impulse at the hit point.
- Bodies sleep by default. Only bodies near a hit wake up.
- After a shot, the turn waits until all bodies sleep or 4 s pass ("settle, then next turn"). After 4 s we force sleep. Players never wait on a slow wobble.
- Terrain under castles: chain shapes from marching squares for chunks that touch castle bodies (section 5.3). Rebuild only dirty chunks.
- Keep budgets: ~60 to 120 bodies per castle, ~250 per scene. Use compound bodies (one body, many fixtures) for parts that should move as one until broken.
- Fragments: when a piece dies, spawn 2 to 4 debris bodies that fade after 2 s, or pure particles on low end devices.

```
onShellHitsPiece(piece, hit):
  dmg = weaponDamage * material[piece.mat].mult
  piece.hp -= dmg
  piece.body.applyLinearImpulse(hit.dir * weapon.push, hit.point)
  wakeNeighbors(piece, radius)
  if piece.hp <= 0: breakJoints(piece); spawnDebris(piece); destroy(piece)

endOfShot():
  while not allSleeping() and elapsed < 4s: world.step(1/60, 8, 3)
  forceSleepAll()
  nextTurn()
```

Physics engine step at 60 Hz, separate from the 120 Hz shell step. Both are fixed.

## 11. Deep dive: explosions and damage falloff

### 11.1 Damage

Hedgewars: `dmgBase = 2R + unitRadius/2`, `dmg = min((dmgBase - dist) / 2, R)`. A linear falloff measured from the edge of the unit, not the center.

Our form, with a floor so edge hits still count:

```
explode(c, R, power, weapon):
  carveCircle(c, R, power)                                  // section 5.1
  for each target in query(c, R + maxRadius):
    d = max(0, dist(c, target.center) - target.radius)      // edge distance
    if d > R: continue
    f = 1 - d / R                                           // 1 at center, 0 at edge
    f = MIN_FRAC + (1 - MIN_FRAC) * f                       // MIN_FRAC ~0.25
    dmg = round(weapon.damage * f * armorMult(target, weapon.type))
    target.takeDamage(dmg)
    target.applyImpulse(normalize(target.center - c) * weapon.knock * f)
  settleDirt(blastRect(c, R))
```

- Use linear falloff. It is easy to read on screen and easy for players to learn. Smoothstep is an option for "big soft" weapons.
- Line of sight blocking (walls absorb blast) is costly and confuses players. Skip it, but let material multipliers make stone walls soak damage.
- Damage numbers pop at the hit point. Big hits get screen shake and a short hit stop (50 to 80 ms).

### 11.2 Visuals

Do not draw a radial gradient per frame on Canvas 2D (AtlantaTeam). Use a sprite sheet flash plus pooled particles plus a crater edge pass on the terrain chunk.

## 12. Deep dive: camera

```
camera.update(dt):
  target = focus.position + focus.velocity * LOOKAHEAD (0.35 s)
  // critically damped spring, framerate independent
  k = 1 - exp(-STIFFNESS * dt)          // STIFFNESS ~6
  cam.pos += (target - cam.pos) * k
  // auto zoom: keep shooter and shell (or shell and target) in view
  want = fitZoom(boundsOf(shooter, shell, predictedImpact), margin = 15%)
  cam.zoom += (clamp(want, MIN_Z, MAX_Z) - cam.zoom) * (1 - exp(-3 * dt))
  cam.pos = clampToWorld(cam.pos, cam.zoom)
  cam.pos += shake.offset(dt)           // decays, seeded from the cosmetic RNG
```

States: aim (frame the shooter, slight bias toward the enemy), flight (follow shell with lookahead), impact (hold 0.6 s on the blast, zoom out to show the castle settle), return (ease to the next shooter). Let the player pinch to zoom and drag to look around during aim; snap back on fire. Dead zone in the middle 30% of the screen avoids jitter during slow lobs. The Worms HTML5 clone pans at a fixed pixel speed per frame, which feels robotic and is frame rate bound; use the exponential smoothing above.

## 13. Deep dive: low-end phone performance

Target: steady 60 fps on a 2019 mid range Android (for example 3 GB RAM, Mali GPU), 30 fps floor on older devices, in a WebView.

- Render with WebGL (PixiJS or Phaser WebGL), not Canvas 2D, for sprites and particles. Terrain chunks are textures.
- Cap the device pixel ratio at 2 (1.5 on low tier). A 3x DPR phone renders 2.25x more pixels for almost no visible gain.
- Terrain grid at half resolution (1 cell = 2 px) on low tier. Craters still look sharp with an edge pass.
- Update only dirty chunks. Never call `getImageData` on the whole map; keep the grid in JS memory and write it into the chunk texture with `putImageData` or `texSubImage2D`.
- Pool shells, particles, debris, damage numbers. No allocation per tick in the sim.
- Texture atlases. Fewer than ~50 draw calls per frame.
- Sleep physics bodies. Freeze the physics engine entirely while aiming.
- AI planning in a worker. Trajectory preview recompute only on input change.
- Quality tiers chosen at first launch by a short benchmark: particle count, debris bodies vs particles, shadow and glow passes, DPR.
- Pause the loop on `visibilitychange` and app background. Clamp the step accumulator after resume.
- Audio: one decoded `AudioBuffer` per sound via Web Audio, not `new Audio()` per play (BK repo).
- Memory: a 4096 x 2048 map at half res is a 2048 x 1024 grid (2 MB) plus chunk textures (~8 MB at RGBA). Fine. Avoid one giant 4096 px texture; some GPUs cap at 4096 and uploads stall.

## 14. Recommendations for Castle Protect

| Area | Recommendation | Why |
|---|---|---|
| Sim core | Pure TypeScript module, no DOM, no engine imports. Fixed 120 Hz shell step, 60 Hz rigid body step. Seeded PRNG. | Same code runs the game, the AI, the preview, tests and replays. Avoids every coupling bug in both reference repos. |
| Terrain store | `Uint8Array` material grid (dirt, clay, rock, bedrock, plus castle ground types). Optional half res. | Exact craters, caves, materials and hardness for weapon variety. Cheap tests. |
| Terrain render | 256 cell chunks as textures, dirty chunk upload, edge pass, tiling material art. | Fast on phones. Proven by DTerrain and Hedgewars. |
| Terrain collision for bodies | Marching squares to chain shapes per chunk, only where bodies touch. | Lets castles sit on and slide off real terrain without polygon terrain. |
| Falling dirt | Local column compaction for loose materials; renderer tweens the moves. | Simple, predictable, exact for AI. |
| Projectiles | Custom sim, semi-implicit Euler, wind as acceleration, swept DDA test, per weapon `onTick` hooks (split, bounce, roll, dig, home). | Physics engines are a poor fit for shells: tunneling, non-determinism and no control over feel. |
| Castle blocks | Planck.js bodies with HP, materials, breakable joints, sleep, "settle then next turn" with 4 s cap. Budget ~250 bodies. Keep Box2D v3 WASM as a later upgrade path. | Box2D solver stacks well; pure JS keeps the build simple across iOS, Android and web. |
| Damage | Linear falloff from edge distance with a 25% floor, material multipliers, knockback. | Readable, learnable, matches the genre. |
| AI | Hedgewars style: flight time sweep, closed form seed, sim verify, score by damage and structure value, local refine, power bisection fallback. Difficulty via noise, bracketing, weapon smarts, personality weights. Worker plus time slicing. | Strong when needed, human when not, cheap enough for phones. |
| Preview | Same sim, partial arc, ghost of last shot, length and wind display as tech tree upgrades. | Ties a core skill aid to progression. |
| Camera | Spring follow with lookahead, auto zoom to fit, shot states, pinch and drag in aim. | Clear on small screens. |
| Performance | WebGL renderer, DPR cap, pools, atlases, quality tiers, pause on background. | Low end Android in a WebView is the hardest target. |

Engine choice (Phaser vs PixiJS vs Godot vs others) belongs to the tech stack doc. This survey only needs: a WebGL 2D renderer, a JS physics lib we control, and a sim we own. Phaser 3 (MIT, 40.7k stars) or PixiJS (MIT, 48.9k stars) plus Capacitor (MIT) for iOS and Android both fit. If the team picks Godot 4 instead, the same design holds: grid terrain in a `PackedByteArray`, own shell sim in GDScript or C#, Godot physics or Rapier for blocks.

Things we will not do:

- Copy any code from GPL, AGPL or unlicensed repos. Study the math, write our own.
- Use the Pocket Tanks repos' assets or anything that echoes the original game's look, names or sounds.
- Tie physics to frame rate, round sim positions, or call canvas or DOM APIs from sim code.
- Use a physics engine for shells.
- Use Matter.js for castle stacking.

## 15. License notes

| Project | License | What it means for us |
|---|---|---|
| BharathKumarRavichandran/pocket-tanks | AGPL-3.0 | Strong copyleft, even over a network. Read only. No code, no assets. |
| AtlantaTeam/pocket-tanks | None (package.json says ISC, no LICENSE file) | Default copyright applies. Read only. |
| Hedgewars, Warmux, Scorched3D, OpenLieroX | GPL-2.0 (and mixes) | Copyleft. Ideas and math only. Hedgewars art has its own mixed licenses. |
| tanks-game, PixelTerrainInUnity | GPL-3.0 | Ideas only. |
| Worms HTML5 clone | Apache-2.0 | Code reuse allowed with notice, but it is old Box2DWeb code; we do not need it. Its art is from a commercial game: never use. |
| gorched, ravaged-planet, DTerrain, Godot terrain libs, Phaser terrain lib, squeak-and-destroy | MIT | Permissive. We could reuse small parts with a notice. We still plan to write our own. |
| Planck.js, Matter.js, Phaser, PixiJS, Capacitor, Godot, Box2D | MIT | Safe to ship. Keep a third party notices file. |
| Rapier | Apache-2.0 | Safe to ship with notice. |
| Clipper2 | BSL-1.0 | Safe, permissive. |
| earcut, delaunator | ISC | Safe. |
| liero (gliptic), CastleHassle | None listed | Read only. |
