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
