# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**MALE** is a browser 2D game engine written in plain JavaScript on top of p5.js. There is no build step, no bundler, no package.json and no module system: every file is a classic `<script>` that declares globals. Pages are designed to run **straight from disk (`file://`)** as well as over http, so avoid `fetch`, ES modules, or anything that breaks on `file://`.

## Running

- `index.html` is the home page / game picker (plain HTML, no engine scripts; it is the GitHub Pages landing page). It links to `shooter_demo.html` (entry: `shooterGameDemo.js`) and `world_of_theaya.html` (entry: `world_of_theaya.js`). Each game's pause menu has a "Return to Home Page" button that goes back to `index.html`. To add a game, copy a game page, change its last `<script>` tag, and add a card to `index.html`. `main.js` is an older debugger-scene demo and `blank.js` is a scratch file.
- Run the YAML embed sync while editing `.yaml` files: `node tools/syncDevFiles.js --watch` (one-shot: drop `--watch`). It rewrites `male/devFiles.js`, which is auto-generated, so never edit it by hand.

## Tests

The tests run in the browser; there is no CLI runner. They live in `male/unitTests.js` and need every engine class loaded, so they only work inside a page.
- In the browser devtools console: `runUnitTests()` (runs and logs a report), or `UnitTests.run()` for the structured result (`.testsFailed` lists failures).
- Running one suite: there is no filter. Call `UnitTests.suite(name, fn)` / `UnitTests.test(name, fn)` / `UnitTests.assert` from the console, or temporarily comment out the other `testX()` calls in `run()`.
- New suites go in a `testX()` function that `run()` calls. `blank.js` and `main.js` are deliberately not tested.

## Architecture

**Script load order matters** (see `shooter_demo.html`): `libs/p5.js` → `libs/MAL_Graphics_Engine.js` → `male/Global.js` → `helperFunctions.js` → `inputs.js` → `Camera.js` → `item.js` → `objects.js` → `scene.js` → `yaml.js` → `devFiles.js` → `devConsole.js` → `unitTests.js` → game file. Later files rely on globals from earlier ones.

**Game file pattern**: the game file defines p5's `setup()`, which does `world = new World(tickLength)`. Game objects and `new Scene(...)` are usually created at the top level of the game file, *before* `setup()` runs. Objects register themselves in static registries (`shell.allObjects`, `gameObject.objects`, `Hitbox.objects`, `UI.objects`, `Scene.scenes`), and each one names the scene ids it belongs to through trailing `...scenes` constructor args. Pick the shown scene with `Scene.setScene(id)`.

**World (`male/Global.js`)**: owns its own `requestAnimationFrame` loop. It does not use p5's `draw()`, so don't define one. The loop has two cadences:
- **Fixed-timestep ticks** (`tickLength` ms, default 20): `DevConsole.tick()` → controller update → `Scene.tick(dt)` → global `main()` if defined → syncing and cleanup of the object registries. Game logic and physics belong here.
- **Render every frame**: `Scene.render()` → `DevConsole.render()`.
- **Looking away**: `world.whenHidden` (tab hidden or browser minimized) and `world.whenUnfocused` (another program focused while the page still shows) are each `'run'` or `'pause'`. `'pause'` freezes ticks and drops the time away (nothing is caught up), but a visible page keeps rendering. In a hidden tab rAF stops, so `'run'` is driven by a Blob Worker timer that sends a step every tick (`world.backgroundTimer` is `'worker'`). If the browser refuses the worker, a throttled `setInterval` backup runs the missed ticks in bursts of up to `world.backgroundCatchUp` seconds (`backgroundTimer` is `'interval'`). Hidden tabs render `world.backgroundFps` times a second (default 0). Hooks: `onHidden` / `onShown`, and `onFocusLost` / `onFocusGained` for window focus only (tab switches don't count). `runInBackground` is an older alias for `whenHidden`. The shooter demo uses `onFocusLost` to open its pause menu.
- `World` has static getters (`World.mouse`, `World.tick`, `World.camera`, …) that pass through to `World.active` for older code. New code should use the instance (`world.` / `this.`). `window.mouse`, `window.keyboard` and `window.controller` are global aliases too.

**Scene (`male/scene.js`)**: `new Scene(id, backColor, ...scripts)`. How a script runs depends on its type:
- A **function** script runs every **render frame**, for HUD and drawing.
- An **object** with `exe` / `call` / `callback` / `function` runs every **tick** as `(dt, scene)`.

Every object's `update(dt)` and its `obj.scripts` (functions called with `(obj)`) run on ticks. `scene.pause` freezes updates for objects that don't set `ignorePause`, but rendering continues. `scene.time` is a clock that pauses with the scene, and timers such as `throttle` / `gameTimeout` read it. Draw order: game objects by `layer`, then `uiObjects`, which are always drawn on top.

**Object hierarchy (`male/objects.js`)**: `shell` (registry/ids) → `geometryObject` (holds a `Transform` plus a `Renderer`) → `Hitbox`, `genericObject`, `gameObject`, `UI` / `Button`. Then `gameObject` → `Entity` (which takes behaviour bundles through `entity.package(Entity.Packages.living(), ...)`) → `Player`. Hitbox shapes are `rect`, `circle`, `ellipse` and `triangle`. The collision math lives in `helperFunctions.js`. Collision resolution is a known weak area (see `notes.txt` and `todoList.yaml`).

**Items (`male/item.js`)**: `Inventory`, plus the `Item` class. An item is built from components: subclasses of `ItemComponent` (`Durability`, `Attack`, `Mining`, `Ranged`, `Firearm`, `Placement`, `Ability`, …) whose constructors take their values. Add them with `item.package(new Durability(500), Item.Packages.melee(...), …)`, which works like `Entity.package`. Read them with `item.get('attack')` / `item.components.attack`. Hooks are methods on the component (`canUse`, `onUse`, `onTick`, `onPlace`, `onBreak`, or any `onX` for `item.emit('x')`). Item types are plain subclasses whose constructor calls `super(name)` and then `this.package(...)`, for example `Weapon` → `Sword`, `Tool`, `Armor`, `Consumable`, `Placeable`, `Skill`, `Gun`. Every constructor parameter (component or item) needs a default, because `Item.fromJSON` calls `new Type(name)`. `clone()` doesn't call the constructor; `_afterBuild()` sets up runtime state. `Gun` owns the bullets in flight (`Gun.bullets`).

**Input (`male/inputs.js`)**: read input through `getInput('key@r')`, `getInput('key@shift')`, `mouse@left`, `stick@left:x`, `button@...` and so on. `KeyboardStick` gives a virtual analog stick. Default bindings are in `world.defaults.binds`. When the DevConsole is open, `getInput` returns neutral values.

**DevConsole (`male/devConsole.js`)**: only active after `world.setDebugMode(true)`. The `` ` `` key toggles it. Extend it with `DevConsole.registerCommand({...})` / `registerDisplay({...})`. `/display todoList` renders `todoList.yaml`, parsed by the small custom YAML reader in `male/yaml.js`. `documentation.md` has the full command and todo-file reference.

**Graphics/audio (`libs/MAL_Graphics_Engine.js`)**: a standalone image, sprite and audio library with the global `MAL` / `MAL_Graphics_Engine`. It does not depend on the engine files. The root `README.md` is its documentation. Angles are in **degrees**. On `file://`, `getPixel` / `toDataURL` return null and p5 WEBGL can't use image textures. Browsers block audio until the user interacts with the page. `male/graphics.js` (`Song`) is an unfinished wrapper and is not loaded by the HTML pages.

## Conventions

- Class names are mixed case (`gameObject`, `shell`, `uiButton` next to `Player`, `Scene`). Keep the existing names, because the registries and `world.defaults.classes` refer to classes by name.
- Custom error classes (`gameObjectError`, `hitboxError`, `sceneError`, …) live at the top of `Global.js`.
- To print to the in-engine log, use `new Message(text)`.

## Adding content to World of Theaya

`world_of_theaya.js` creates every item, block, food, station, creature, crop and skill from a plain spec object with one function: `defineElement(spec)` (or `defineElements([...])`). The field list is the doc comment at "3b. Game elements"; the game's own content (search for `defineElements([`) is written the same way. Types: `item`, `block`, `terrain`, `food`, `crop`, `creature`, `workbench` (a recipe menu, or a machine when `slots:{input, output, fuel}` is an object), `container` (`slots: n`), `skill`, `upgrade`. Drops are `[{ id, chance, amount:[min, max], linked, priority }]`. Stack sizes come from one category rule (`STACK` / `STACK_OF`) and a spec's `stack` only overrides it. Stations register themselves in `STATION_TITLES`, `CRAFT_STATIONS`, `MACHINES` and `STATION_DRAW`, which the UI, ticking and cell tracking read. Recipes written in a spec (`recipe`, `recipes`) are queued and added once the `Recipe` class exists (`Content.flush()`); other recipes still use `Recipe.add` in section 5. Natural block families (`naturalMaterials`), ores / metals / tools / armor (generated from `materialList`) and the weather table stay in their own tables.

Textures are optional (section "3a. Textures"): a spec's `texture` field, the `TEXTURES` table (keyed by element id, including generated ones, ground floors and `'player'`), or `Textures.set(id, tex)`. Every world draw site falls back to the built-in procedural look when there's no texture or the image hasn't loaded. HUD drawing (item icons, menus) is never textured.

Text and languages (English + Japanese): never put on-screen text in `world_of_theaya.js`. Every string lives in `world_of_theaya_text.js` (loaded in the page's `<head>`, before the engine) as `THEAYA_TEXT['key'] = { english, japanese }`, registered with the World language system in `setup()` (`world.addDialog`). Show it with `T('key', { vars })` (`{name}` placeholders; `{s}` is the English plural). Names of items, blocks, creatures, skills, biomes, weather and months come from `nameOf(id)`: Japanese uses `THEAYA_NAMES`, or builds generated ids from `THEAYA_WORDS` (`iron_pickaxe` → 鉄のツルハシ), so a new material or crop only needs its word added. Block / creature / skill `def.name` and `STATION_TITLES` / `MACHINES` texts are getters that follow the language; station texts are `station.<station>.<field>` keys, creature actions `action.<creature>.<key>`. Don't name a local variable `T`. The language is picked in the Settings menu (pause menu > Settings, or the start menu toggle), saved in `localStorage` (`theaya.settings`), and otherwise follows the browser.
