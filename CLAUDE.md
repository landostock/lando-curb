## Source layout

- `src/entities/` — Game objects: business-park, commuter, street, house, lake, tree, landmark, boulevard
- `src/logic/` — Game rules: pathfinding, spawning, map generation, street removal
- `src/input/` — Player interaction: pointer events, path drawing, cell queries, grid toggle
- `src/gfx/` — Rendering: colors, SVG setup, layers, grid
- `src/ui/` — Interface: menus, gameover, upgrades, HUD elements
- `src/util/` — Pure helpers: shuffle, weighted-random
- `src/main.ts` — Entry point and game loop
- `src/inventory.ts` — Shared game state (path tile count)
