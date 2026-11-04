# Game Engine Organization
    - World
    - Camera 
    - Scenes 
    - gameObjects 
    - !UI Objects 
    - Hitboxes 

# Class Hierarchy
    - World {Supreme Class}
    - Scene {Supreme Class}
    - shell {Foundational Class}
    - Transform {Secondary Foundational Class}
    - Text {Secondary Foundational Class}
    - geometryObject {Foundational Subclass}
    - Hitbox {Foundational Subclass}
    - gameObject {Super Class}
    - Entity {Super Class}
    - Player {Final Class}
    - UI {Sub-super Class}
    - 

---

## Debug Console (`male/devConsole.js`)

Available when the world is in **debug mode**: `world.setDebugMode(true)` (main.js does this for the debugger scene).

| Key | Action |
|---|---|
| `` ` `` (or `~`) | open / close the console (`DevConsole.shortcuts`, change with `DevConsole.setShortcut([...])`) |
| `Enter` / `Esc` | run the line / close the console (or the shown panel) |
| `Tab` | complete a command or display target |
| `Up` / `Down` | command history |
| `PgUp` / `PgDn` / wheel | scroll the output |

While the console is open the game does not see the keyboard (`getInput` returns neutral values), and the game does not see the mouse while the pointer is over the console or a panel.

### Commands (all start with `/`)

| Command | What it does |
|---|---|
| `/help [command]` | list commands |
| `/display todoList [file]` | show the YAML todo list with clickable check boxes |
| `/display scene <id>` or `/display <id>` | switch scene |
| `/display none` | hide the shown panel (`/display list` shows every target) |
| `/todo list` / `toggle <n>` / `reset` / `export` / `reload` / `load` | work with the todo list from the keyboard |
| `/clear`, `/close`, `/eval <js>` | utilities |

Add your own with `DevConsole.registerCommand({ name, usage, help, run(args, raw) })` and
`DevConsole.registerDisplay({ name, open(args), close(), render(ctx), click(x, y), wheel(dy), contains(x, y) })`.

### Todo list file (`todoList.yaml`)

```yaml
title: My todo list
sections:
  - name: Collision
    items:
      - text: Fix the thing
        done: false          # optional, default false
        note: extra detail   # optional
        priority: high       # optional: high | med | low
        items:               # optional sub-tasks
          - text: a sub-task
```

* Check-box clicks are remembered in the browser (localStorage). `Export YAML` / `/todo export` downloads the file with the new `done:` values written in, keeping your comments and formatting. Replace the file with it to make the change permanent.
* A page opened from disk (`file://`) can't `fetch()` files, so `.yaml` files are embedded in `male/devFiles.js`. Keep it up to date with `node tools/syncDevFiles.js --watch` (leave it running; it re-syncs every time you save a `.yaml`). While `/display todoList` is open the panel re-reads the source every ~1.5s and swaps in changes by itself - no page reload. `/todo reload` forces a re-read. Served over http, the real file is read directly (no sync step). `/todo load` picks a file from disk.
* A broken edit (invalid YAML) is reported once in the console and the previous list stays on screen until the file is valid again.
* Check marks you click are remembered per item, but only while the file's own `done:` for that item is unchanged - edit `done:` in the file and the file wins.
* `male/yaml.js` is a small dependency-free YAML reader (`Yaml.parse`, `Yaml.patch`); it supports block maps/lists, quoted strings, `[a, b]` / `{a: 1}` on one line, `|` and `>` blocks and comments.
