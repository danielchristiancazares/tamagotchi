# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repo.

## Project

Tamagotchi-style desktop pet built with **Electron + vanilla JS + HTML5 Canvas**. No bundler, no framework, no TypeScript. Pixel-art aesthetic with an LCD-screen feel. Two UI modes: a full game window (~420×640) and a frameless always-on-top **companion mode** (176×176).

## Commands

```bash
npm start              # Run the Electron app (dev)
npm test               # Pet unit tests (custom Node runner — NOT Jest)
npm run test:visual    # Canvas visual regression tests
npm run test:visual:update  # Regenerate visual baselines (set UPDATE_BASELINES=1)
npm run test:all       # Both suites
npm run build          # electron-builder, current platform
npm run build:win      # Windows .exe
npm run build:mac      # macOS .dmg
npm run build:linux    # Linux AppImage
```

**Important:** Tests use a custom runner at `test/runner.js` that calls `process.exit()`. Do **not** run them with `jest` — the tests will appear to pass but Jest will report worker crashes. Always use the `npm test` scripts above.

## Architecture

Three-process Electron model following Clean Architecture layers. Dependency rule: outer layers depend on inner layers, never the reverse.

```
┌─────────────────────────────────────────────┐
│ Infrastructure (Electron, DOM, Canvas)       │
│   main.js  ·  preload.js  ·  index.html     │
├─────────────────────────────────────────────┤
│ Interface Adapters                           │
│   ui.js  ·  animator.js  ·  game.js         │
├─────────────────────────────────────────────┤
│ Presenters                                   │
│   pet-presenter.js  ·  quotes.js            │
├─────────────────────────────────────────────┤
│ Entities (pure domain, zero side effects)    │
│   pet.js                                     │
└─────────────────────────────────────────────┘
```

### Entity layer — `renderer/pet.js`

**Pet class.** Pure state and game logic. No DOM, no console, no globals, no side effects. Owns:
- Stats (hunger/happiness/energy/hygiene, all 0–100, clamped via `_setStat`).
- State machine with explicit `STATE_TRANSITIONS` whitelist (idle/happy/eating/playing/sleeping/sad/dead). `_setState` rejects invalid transitions.
- Stage progression (`egg → baby → child → teen → adult`) driven by `evolutionTimer` and `STAGE_TIMES`.
- Variants (`normal`/`good`/`excellent`/`poor`) determined by avg stats at evolution time.
- Personality (one of 6).
- Autonomy: `_think()` picks a goal (`wander`, `seek_food`, `seek_sleep`, `seek_toy`, `groom`), pet walks toward `STATIONS` and performs the action on arrival.
- `serialize()` / `Pet.deserialize()` for save/load with strict input validation.
- `activityLog` — domain notification log (entries are `{ t, msg, kind }`). Presentation layer formats display; Pet only stores structured events.

### Presenter layer

`pet-presenter.js` — **PetPresenter.** Pure display formatting functions with zero dependencies. Translates domain state into UI values:
- `displayStage(stage)` — capitalizes stage name.
- `displayHealthColor(health)` — maps health value to hex color (`#4CAF50`/`#FF9800`/`#E53935`).
- `displayPersonalityEmoji(personality)` — maps personality to emoji character.

`quotes.js` — 390 personality-themed quotes keyed by `(personality, category)` where category is `idle`/`feed`/`play`/`pet`/`clean`/`sleep`/`wake`/`evolve`/`death`/`poop`/`sick`/`hungry`/`hobby`. Exposed as `getQuote(personality, category)`.

### Interface adapter layer

`animator.js` — **Canvas renderer.** Receives scene config (stations) via constructor injection, never reads globals. `update(pet)` spawns particles, `draw(pet)` is pure rendering. Branches on `this.companionMode`:
- `_drawNormal` — full scene with background, sky details, stations, poops, status icons, pet, state overlays, particles.
- `_drawCompanion` — pet centered on a 160×160 canvas, no stations, mood emoji icons.
- Sprites loaded lazily from `renderer/data/sprites/` and `renderer/data/pet-sprites/`. Falls back to procedural pixel-art.
- Particle cap is 50 normally, 10 in companion mode.

`ui.js` — **UI controller.** DOM-only. Receives **action callbacks** via constructor (`actions` param) — never calls Pet mutation methods directly. Actions: `onFeed`, `onPlay`, `onClean`, `onSleep`, `onPet`, `quoteFn`. Uses `PetPresenter` for display formatting. Owns:
- Stat bar segments, action buttons with cooldowns, notifications, quote bubble, activity log, hobby panel.
- `addCompanionListeners(handlers)` / `removeCompanionListeners()` — manages canvas click/double-click/context-menu for companion mode.
- Reads stat colors from CSS custom properties (`--stat-*`).

`game.js` — **Use-case orchestrator.** Creates UI with action callbacks via `_buildUIActions()`, wires companion listener handlers, owns tick loop and rAF loop, save throttling, mode state. No direct DOM access — delegates canvas listener management to UI.
- `mode`: `'normal' | 'companion'`. `setMode()` updates UI, animator, registers companion listeners on UI, calls `electronAPI.setCompanionMode`.
- Companion-mode interactions: single-click → `pet.pet()` + hearts via `animator.spawnHearts`; double-click or right-click → return to normal.
- Quote throttling: in companion mode `_randomIdleInterval` is 3× longer and `_checkEventQuotes` / `_checkCriticalStates` are skipped.

### Infrastructure layer

`main.js` — **Electron main process.** Creates the `BrowserWindow` (normal or companion). Holds save/load IPC handlers. Owns mode switching, system tray, graceful quit protocol.

`preload.js` — Single bridge via `contextBridge.exposeInMainWorld('electronAPI', ...)`. `contextIsolation: true`, `nodeIntegration: false`.

`index.html` / `styles.css` — Layout. Scripts loaded in dependency order: `pet-presenter.js` → `quotes.js` → `pet.js` → `animator.js` → `ui.js` → `game.js`.

### Save format

`save-game.json` in `userData`. Loader validates JSON, presence of `data.pet`, and required fields (`name`, `stage`, `stats`, `bornAt`). Corrupted files are backed up to `save-game.json.corrupted.<timestamp>` rather than overwritten. Out-of-range stats fall back to defaults (`Pet.deserialize`).

## Design conventions

- **No DOM access in `Pet`.** Pet is pure state with zero side effects (no console.log, no globals).
- **No game logic in `Animator` or `UI`.** They observe `Pet` and render.
- **UI calls actions, never Pet directly.** UI receives action callbacks (`onFeed`, `onPlay`, etc.) from Game. All pet mutations flow through Game as the use-case controller.
- **Display formatting via PetPresenter.** Colors, emojis, and label formatting live in `pet-presenter.js`, not on the Pet entity.
- **Animator receives config via DI.** Stations are passed via `new Animator(canvasId, { stations })`, not read from globals.
- **No DOM access in Game.** Canvas listener management is delegated to UI methods.
- **All timers tracked.** `Game`, `UI`, `Animator` each keep their own `_timeouts` / `_intervals` sets and clear them in `destroy()`. Don't add a raw `setInterval`/`setTimeout` without tracking it.
- **State transitions go through `_setState`.** Don't assign to `this.state` directly — `_setState` validates the transition and updates `stateHistory`.
- **CSS variables, not hardcoded colors.** Stat bar colors live in `:root { --stat-* }` and are read by `ui.js`.
- **Pet position is normalized** (0–1 floats). `Animator._petScreenPos` multiplies by canvas dimensions, so the same pet works at any canvas size.

## Testing

`test/pet.test.js` — ~124 unit tests covering constructor/defaults, stat clamping, state transitions, actions, decay, sickness, evolution, serialization, display helpers (via PetPresenter), mood rings, dreams, stat history, antics, hobbies, and edge cases.

`test/seasonal.test.js` — ~52 tests for season detection, background colors, particles, holiday detection.

`test/visual/` — Canvas visual regression tests using a Node-side `mock-canvas.js` to record draw calls into a deterministic JSON trace, then diff against `test/visual/baselines/*.json`. Update baselines with `UPDATE_BASELINES=1 npm run test:visual` (or `npm run test:visual:update`) when a deliberate visual change lands.

When adding visual changes, regenerate baselines and inspect the diff before committing.

## Companion mode notes

- Mode switching destroys and recreates the `BrowserWindow` (frame settings can't be changed at runtime in Electron). State survives via auto-save before destruction and auto-load on init.
- The new window inherits position via `setPosition(bounds.x, bounds.y)` and is launched with `?mode=companion` so `Game.init()` calls `setMode('companion')` immediately.
- `quitInProgress` is reset after the swap so the new window's `before-quit` handler still works.
- The transparent + frameless window relies on `body.companion-body` CSS — don't remove `background-color: transparent` from that rule or the OS will show a white square.

## Common gotchas

- Adding a new IPC channel: update `main.js` (`ipcMain.handle`), `preload.js` (`contextBridge` + wrapped listener for `ipcRenderer.on`), and the renderer caller. Don't expose `ipcRenderer` directly.
- Adding a new pet state: add it to `PET_CONST.VALID_STATES` **and** to `STATE_TRANSITIONS` (both directions), or `_setState` will silently reject it.
- Adding a new sprite: register the path in `SPRITE_PATHS` in `animator.js` and use `_drawSprite(key, x, y, scale)`. Always provide a procedural fallback for the case where the image hasn't loaded yet.
- Pet quotes: every personality must have an entry for every category in `quotes.js`, otherwise `getQuote` returns `null` and the bubble silently doesn't appear.
- Adding a new UI action: define the action callback in `Game._buildUIActions()`, not in `UI` directly. UI only fires callbacks; Game owns the business logic.
- Adding display formatting: put it in `pet-presenter.js`, not on the Pet class. Pet is a pure domain entity.
