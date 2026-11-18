# Jelly Smash Level Builder

A level builder for Jelly Smash, built on the rules in the [Jelly Smash GDD](https://hvtanh07.github.io/gdd-jelly-smash/). The first 10 levels from the Level Config sheet are preloaded in the list on the left.

## Run it

You need Node.js 20 or newer.

```sh
npm install
npm run dev      # opens the builder at http://localhost:5173
npm test         # format round trip and game rules
npm run build    # writes dist/index.html, one file that opens without a server
```

Every push to `main` runs the tests, builds, and publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves.

## Features

- **Levels:** list, filter, new, duplicate, reorder, delete. Edits are saved in the browser. **Reset to sheet** brings back the built-in levels.
- **Design:** paint the ant wall (color, HP, Queen Ant, erase), shape the board (cells, Chocolate Layer, Jelly Bottle trays), set slot locks by clicking slots. Undo and redo.
- **Inspector:** Level (name, difficulty, colors, slots, locks, queen HP), Wall (size, mirror, flip, color-block generator, armor re-roll, counts per color), Board (size, mirror, tray bottle colors), Tuning (all timing and wall-speed numbers), Check (format errors, shots needed, bot estimate), JSON (live text, apply, copy, download).
- **Play test:** the game rules on a canvas laid out like the game. Swap by drag or tap, Hand / Shuffle / Bomb boosters, speed 0.5×–8×, pause, fixed seed, and a bot that can play for you.
- **Bot estimate:** a greedy bot plays the level N times and reports win rate, time, wall cleared, cannons lost to full slots and merges. It is a rough floor, not a real player.
- **Import / export:** one level, a JSON list, several level objects pasted one after another, or Id/Level rows copied from the sheet. "Copy as sheet rows" pastes back into the sheet. Export writes the exact layout of the game file. Paste a level anywhere on the page to add it.

## Level format

The tool reads and writes the same keys, in the same order, as the game's level file (`tests/fixtures/level_demo.json`). The test suite checks that a level goes in and comes out byte for byte the same.

| Key | Meaning in the tool |
| --- | --- |
| `Colors` | Color letters in the level. R B G O Y come from the game file. P, K, C are not confirmed yet. |
| `WallRows` | The ant wall, one string per row. Row 1 is the back (top), the last row is the front, which starts in view. A color letter is an ant, `Q` is a Queen Ant cell (each 2×2 block is one queen), `.` is empty. |
| `WallHp` | One digit per wall cell: shots to defeat that ant. 1 is a normal ant, 2 or more is an Armored Ant with armor HP − 1 (GDD: armor 3 = 4 shots). Ignored on Q cells. |
| `QueenHp` | HP of every Queen Ant. Any cannon color hits her. |
| `BoardRows` | `.` is a cell, `#` is no cell. A color letter is a cell whose cube starts with that color; under a chocolate it is the cube shown when the chocolate breaks (my reading, see below). |
| `BoardElements` | A digit 1–9 is a Chocolate Layer with that HP (1 match next to it = 1 HP). `X` is a chocolate with the default HP (3, set in the Board tab). `T` Jelly Bottle tray (2×2), `.` nothing. |
| `TrayBottles` | One 4-letter string per tray, trays in reading order (top to bottom, left to right). Bottles: top left, top right, bottom left, bottom right. |
| `SlotCount`, `SlotLocks` | Number of cannon slots, and one digit per slot: cannons that must enter a slot before it opens (0 = open). |
| `WallStartVisibleRows`, `LoseDepthCells` | The front row starts this many rows into the view; the red line is `LoseDepthCells` rows below the top of the view. |
| `WallDescentPerSecond`, `WallBoost*` | Wall speed in rows per second; speed-up ×`WallBoostFactor` while fewer than `WallBoostMinAnts` ants or `WallBoostMinRows` rows are in view, never within `WallBoostStopRows` of the red line or once the top row is in view. |
| `FireInterval`, `ShotFlight`, `SwapSeconds`, `MatchHold`, `MatchFlight`, `FallSeconds` | Timings in seconds. |
| `RefillFrontShare` | Share of new cubes colored by the bottom-row colors of the wall; the rest is even. |

Open questions, where the tool picked a reading: a color letter in `BoardRows` (the `B` in L10) is read as a fixed start color; `X` without a digit keeps the default chocolate HP; `Difficulty` is read as 0 Normal, 1 Hard, 2 Super hard.

## Rules used by the play test

From the GDD, sections 1.2, 1.4 and 1.5:

- Swap two neighboring cubes; a line of 3+ matches. Touching lines of one color are one group, n cubes, ammo = 2n − 3. Cascades match on their own.
- Each match sends a cannon to the leftmost open, empty slot. 3 cannons of one color merge into the leftmost with their ammo added. Slots full: the cannon is lost, unless 2 cannons of its color are in the slots, then it merges into them and a slot opens. A cannon leaves at 0 ammo or when its color is gone from the wall.
- **Slots** (play test toolbar, also used by the bot): *Conveyor* (default, a trial not yet in the GDD) slides the row left to right: a new cannon enters the leftmost open slot and pushes the others right up to the first empty slot; with no empty slot the rightmost cannon is pushed out and lost. A cannon whose color is already twice in the row merges into them. *Fill left* is the GDD rule above.
- Cannons fire every `FireInterval` at front ants of their color that are in view, lowest first, then left to right.
- New cubes are colored so each bottom-row color gets a swap that makes a line of 3; if that fails, a few board cubes change color with a glow. No move left: the board reshuffles.
- Chocolate Layer: a match next to it removes 1 HP; at 0 the cube under it opens. Nothing falls through it.
- Jelly Bottle: a match next to the tray breaks the bottle of its color, +5 ammo. All 4 broken: the tray is gone and cubes fall in.
- Locked Slot: every cannon that enters a slot counts each lock down by 1.
- Hand: the fullest cannon fires all its ammo at any ant of its color, nearest first. Shuffle: new board, a swap ready per bottom-row color. Bomb: 3 cannons of bottom-row colors with 15 ammo each, outside the slots.

## Code

- `index.html`: page markup.
- `src/main.js`: the builder UI.
- `src/format.js`: the level format, reading, writing and checks.
- `src/engine.js`: game rules, boosters and the bot.
- `src/render.js`: draws the play test.
- `src/data/levels.json`: the built-in levels, same as the Level Config sheet (L1–L10).
- `tests/`: Vitest tests.
