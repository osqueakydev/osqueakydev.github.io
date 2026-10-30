// ============================================================
// devConsole.js
// ------------------------------------------------------------
// An in-game command console for when the World is in DEBUG MODE
// (world.setDebugMode(true)).
//
//   `  (backtick)   open / close the console   <- DevConsole.shortcuts
//   Esc             close the console (or the displayed panel)
//   Enter           run the line         Up/Down   history
//   Tab             complete a command   PgUp/PgDn scroll output
//
// Commands start with "/":
//   /help [command]        list commands
//   /display <target>      change what is shown:
//        todoList [file]     the YAML todo list with clickable check boxes
//        scene <id>  | <id>  switch scene
//        none                hide the displayed panel
//        list                list every target
//   /todo [reset|export|reload|load|list|toggle <n>]
//   /clear  /close  /eval <js>
//
// Everything is extensible:
//   DevConsole.registerCommand({ name, aliases, usage, help, run(args, raw) })
//   DevConsole.registerDisplay({ name, aliases, help, open(args), close(),
//                                render(ctx), click(x,y), wheel(dy,x,y),
//                                contains(x,y) })
//
// The shortcut is read through the engine's input system
// (getInput strings), see DevConsole.shortcuts / setShortcut().
// While the console is open, keyboard input is hidden from the game
// (getInput returns neutral values) so typing doesn't move the player,
// and mouse input is hidden while the pointer is over the console or a
// displayed panel.
// ============================================================

// ------------------------------------------------------------
// TodoModel - pure data (no p5), so it can be unit tested.
// ------------------------------------------------------------
class TodoModel {
    /**
     * @param {string} text   YAML source
     * @param {string} file   file name (used for the persistence key)
     * @param {object} opts   { persist: true }
     */
    constructor(text, file = "todoList.yaml", opts = {}) {
        this.file = file;
        this.text = text;
        this.persist = opts.persist !== false;
        this.warnings = [];
        this.root = Yaml.parse(text);
        this.title = "Todo List";
        this.sections = [];     // [{ name, items: [item], src }]
        this.flat = [];         // every item, in display order
        this._build();
        this._applySaved();
    }

    get storageKey() { return "male.devConsole.todo." + this.file; }

    _build() {
        const root = this.root;
        let sections = [];
        if (Array.isArray(root)) {
            sections = [{ name: "", items: root }];
        } else if (root && typeof root === "object") {
            if (typeof root.title === "string") this.title = root.title;
            const secs = root.sections || root.groups;
            if (Array.isArray(secs)) {
                sections = secs.map((s) => (s && typeof s === "object" && !Array.isArray(s))
                    ? { name: String(s.name ?? s.title ?? ""), items: s.items || s.tasks || [], src: s }
                    : { name: "", items: [s] });
            } else if (Array.isArray(root.items || root.tasks)) {
                sections = [{ name: "", items: root.items || root.tasks }];
            }
        }
        if (!sections.length) this.warnings.push("No sections/items found in the YAML.");

        let n = 0;
        const makeItem = (raw, depth, path) => {
            const isObj = raw && typeof raw === "object" && !Array.isArray(raw);
            const text = isObj ? String(raw.text ?? raw.name ?? raw.title ?? "(untitled)") : String(raw);
            if (!isObj) this.warnings.push(`"${text}" is a plain string; it can be toggled but not saved to YAML.`);
            const key = path + " > " + text;
            const item = {
                n: ++n,
                text,
                depth,
                key,
                note: isObj && raw.note != null ? String(raw.note).trim() : "",
                priority: isObj && raw.priority != null ? String(raw.priority).toLowerCase() : "",
                base: isObj ? raw.done === true : false,      // value written in the YAML
                done: isObj ? raw.done === true : false,      // current value
                src: isObj ? raw : null,
                children: [],
            };
            this.flat.push(item);
            const kids = isObj ? (raw.items || raw.tasks || raw.subtasks) : null;
            if (Array.isArray(kids)) item.children = kids.map((k) => makeItem(k, depth + 1, key));
            return item;
        };

        this.sections = sections.map((s, i) => {
            const path = s.name || "section" + i;
            return {
                name: s.name,
                src: s.src || null,
                items: (Array.isArray(s.items) ? s.items : []).map((it) => makeItem(it, 0, path)),
            };
        });
    }

    // ---- persistence (localStorage; only differences from the YAML) ----
    _applySaved() {
        if (!this.persist) return;
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
            this.flat.forEach((it) => {
                const v = saved[it.key];
                if (v === undefined) return;
                if (typeof v === "boolean") it.done = v;                    // older save format
                // A saved toggle only applies while the YAML still says what it said
                // when you clicked. If you edit `done:` in the file, the file wins.
                else if (v && v.base === it.base) it.done = !!v.done;
            });
        } catch (e) { /* storage unavailable: fine */ }
    }

    _save() {
        if (!this.persist) return;
        try {
            const diff = {};
            this.flat.forEach((it) => { if (it.done !== it.base) diff[it.key] = { done: it.done, base: it.base }; });
            if (Object.keys(diff).length) localStorage.setItem(this.storageKey, JSON.stringify(diff));
            else localStorage.removeItem(this.storageKey);
        } catch (e) { /* ignore */ }
    }

    toggle(item) {
        if (!item) return false;
        item.done = !item.done;
        this._save();
        return item.done;
    }

    byNumber(n) { return this.flat.find((it) => it.n === n) || null; }

    /** Forget every toggle and go back to what the YAML says. */
    reset() {
        this.flat.forEach((it) => { it.done = it.base; });
        this._save();
    }

    get total() { return this.flat.length; }
    get doneCount() { return this.flat.filter((it) => it.done).length; }
    get changed() { return this.flat.filter((it) => it.done !== it.base).length; }

    /** The YAML text with the current check states written back in. */
    exportText() {
        const edits = [];
        this.flat.forEach((it) => {
            if (it.src && it.done !== it.base) edits.push({ target: it.src, key: "done", value: it.done });
        });
        return Yaml.patch(this.text, edits);
    }
}

// ------------------------------------------------------------
// DevConsole
// ------------------------------------------------------------
class DevConsole {
    // ---------- argument parsing ----------

    /** Splits a command line into tokens; "double", 'single' quotes and \ escapes. */
    static parseArgs(str) {
        const out = [];
        let cur = "", q = null, has = false;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (q) {
                if (c === "\\" && i + 1 < str.length) { cur += str[++i]; }
                else if (c === q) q = null;
                else cur += c;
            } else if (c === '"' || c === "'") { q = c; has = true; }
            else if (/\s/.test(c)) {
                if (cur !== "" || has) out.push(cur);
                cur = ""; has = false;
            } else if (c === "\\" && i + 1 < str.length) { cur += str[++i]; }
            else cur += c;
        }
        if (cur !== "" || has) out.push(cur);
        return out;
    }

    // ---------- registries ----------

    static registerCommand(cmd) {
        if (!cmd || !cmd.name || typeof cmd.run !== "function") return false;
        DevConsole.commands[cmd.name.toLowerCase()] = cmd;
        return true;
    }

    static findCommand(name) {
        name = String(name || "").toLowerCase();
        if (DevConsole.commands[name]) return DevConsole.commands[name];
        return Object.values(DevConsole.commands).find((c) => (c.aliases || []).includes(name)) || null;
    }

    static registerDisplay(d) {
        if (!d || !d.name) return false;
        DevConsole.displays[d.name.toLowerCase()] = d;
        return true;
    }

    static findDisplay(name) {
        name = String(name || "").toLowerCase();
        if (DevConsole.displays[name]) return DevConsole.displays[name];
        return Object.values(DevConsole.displays).find((d) => (d.aliases || []).includes(name)) || null;
    }

    // ---------- enable / shortcut ----------

    /** True while the World is in debug mode. */
    static get enabled() {
        return typeof World !== "undefined" && !!World.active && !!World.active.debugMode;
    }

    /**
     * Replaces the open/close shortcut. Each argument is one COMBO: an
     * array of getInput strings that must all be down at once.
     *   DevConsole.setShortcut(["key@`"], ["key@control", "key@k"])
     */
    static setShortcut(...combos) {
        DevConsole.shortcuts = combos
            .map((c) => (Array.isArray(c) ? c : [c]))
            .filter((c) => c.length);
        DevConsole._wasDown = false;
        return DevConsole.shortcuts;
    }

    static _shortcutDown() {
        DevConsole._bypass = true;           // the console must see keys even while it hides them
        try {
            return DevConsole.shortcuts.some((combo) => combo.every((s) => !!getInput(s)));
        } finally { DevConsole._bypass = false; }
    }

    /**
     * Safety net for very quick taps: a key pressed AND released inside one
     * 20ms tick never shows up in getInput's per-tick snapshot, but its
     * keydown is still queued. Finds a queued keydown that completes one of
     * the shortcut combos (the other keys/modifiers being held).
     * Returns the index of the LAST such event, or -1.
     */
    static _shortcutEventIndex(events) {
        const modFlag = { control: "ctrl", ctrl: "ctrl", shift: "shift", alt: "alt", meta: "meta" };
        DevConsole._bypass = true;
        try {
            let found = -1;
            events.forEach((ev, idx) => {
                if (ev.type !== "down" || ev.repeat) return;
                const k = String(ev.key).toLowerCase();
                const hit = DevConsole.shortcuts.some((combo) => {
                    const names = combo.map((s) => (/^key(board)?@/i.test(s) ? s.split("@")[1].split(":")[0].toLowerCase() : null));
                    if (names.some((n) => n === null) || !names.includes(k)) return false;
                    return combo.every((s, i) => names[i] === k || !!getInput(s) || !!ev[modFlag[names[i]]]);
                });
                if (hit) found = idx;
            });
            return found;
        } finally { DevConsole._bypass = false; }
    }

    /** Names of every key used by the shortcut combos (lower-case). */
    static _shortcutKeyNames() {
        const out = new Set();
        DevConsole.shortcuts.forEach((combo) => combo.forEach((s) => {
            if (/^key(board)?@/i.test(s)) out.add(s.split("@")[1].split(":")[0].toLowerCase());
        }));
        return out;
    }

    // ---------- input gating (called by getInput) ----------

    /** True if the game should NOT see this input domain right now. */
    static blocksInput(domain) {
        if (DevConsole._bypass || !DevConsole.enabled) return false;
        if (domain === "key" || domain === "keyboard") return DevConsole.open;
        if (domain === "mouse") return DevConsole.pointerOverUI();
        return false;
    }

    static _pointer() {
        if (typeof mouse === "undefined" || !mouse) return null;
        let ox = 0, oy = 0;
        try {
            const el = World.canvas && World.canvas.elt;
            if (el && el.getBoundingClientRect) {
                const r = el.getBoundingClientRect();
                ox = r.left; oy = r.top;
            }
        } catch (e) { /* ignore */ }
        return { x: mouse.x - ox, y: mouse.y - oy };
    }

    static pointerOverUI(p) {
        p = p || DevConsole._pointer();
        if (!p) return false;
        const hit = (r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
        if (DevConsole.open && hit(DevConsole._ui.consoleRect)) return true;
        return !!(DevConsole.panel && hit(DevConsole._ui.panelRect));
    }

    // ---------- output ----------

    static print(text, color = "#d7dbe6") {
        String(text).split("\n").forEach((ln) => DevConsole.lines.push({ text: ln, color }));
        if (DevConsole.lines.length > 300) DevConsole.lines.splice(0, DevConsole.lines.length - 300);
        DevConsole.scroll = 0;
    }
    static info(t)  { DevConsole.print(t, "#7aa2ff"); }
    static ok(t)    { DevConsole.print(t, "#6bd18a"); }
    static warn(t)  { DevConsole.print(t, "#ffcf5c"); }
    static error(t) { DevConsole.print(t, "#ff6b6b"); }

    // ---------- open / close ----------

    static setOpen(v) {
        v = !!v;
        if (v === DevConsole.open) return;
        DevConsole.open = v;
        if (typeof keyboard !== "undefined" && keyboard) keyboard.capture = v;
        if (v && !DevConsole._greeted) {
            DevConsole._greeted = true;
            DevConsole.info("MALE debug console - type /help   (/display todoList)");
        }
    }

    // ---------- per-tick update (called from World's tick) ----------

    static tick() {
        try {
            const kb = (typeof keyboard !== "undefined") ? keyboard : null;
            if (!DevConsole.enabled) {
                if (DevConsole.open) DevConsole.setOpen(false);
                if (kb && kb.drainEvents) kb.drainEvents();
                return;
            }
            DevConsole.init();
            const down = DevConsole._shortcutDown();
            const events = (kb && kb.drainEvents) ? kb.drainEvents() : [];
            const hitAt = DevConsole._shortcutEventIndex(events);
            const pressedNow = (down && !DevConsole._wasDown) || hitAt >= 0;
            DevConsole._wasDown = down;

            let todo = events;
            if (pressedNow) {
                DevConsole.setOpen(!DevConsole.open);
                // The toggle key itself is never typed. Anything typed AFTER it in
                // this same tick (fast typing, macros, scripts) is kept.
                if (hitAt >= 0) todo = events.slice(hitAt + 1);
                else {
                    const names = DevConsole._shortcutKeyNames();
                    todo = events.filter((ev) => !(ev.type === "down" && names.has(String(ev.key).toLowerCase())));
                }
            }

            if (DevConsole.open) todo.forEach((ev) => DevConsole._handleKey(ev));
            else if (DevConsole.panel) {
                todo.forEach((ev) => {
                    if (ev.type === "down" && ev.key === "Escape") DevConsole.closePanel();
                });
            }
        } catch (e) {
            DevConsole._fail("tick", e);
        }
    }

    static _fail(where, e) {
        if (DevConsole._failed !== where) {
            console.error(`[DevConsole] ${where} error:`, e);
            DevConsole._failed = where;
        }
        try { DevConsole.error(`internal ${where} error: ${e.message}`); } catch (x) { /* ignore */ }
    }

    // ---------- keyboard handling ----------

    static _insert(str) {
        const b = DevConsole.buffer, c = DevConsole.cursor;
        DevConsole.buffer = b.slice(0, c) + str + b.slice(c);
        DevConsole.cursor = c + str.length;
        DevConsole.histIdx = -1;
    }

    static _handleKey(ev) {
        if (ev.type === "paste") {
            DevConsole._insert(String(ev.text).replace(/[\r\n]+/g, " "));
            return;
        }
        if (ev.type !== "down") return;
        const k = ev.key;

        if (k === "Escape") { DevConsole.setOpen(false); return; }
        if (k === "Enter") { DevConsole.submit(); return; }
        if (k === "Backspace") {
            if (DevConsole.cursor > 0) {
                DevConsole.buffer = DevConsole.buffer.slice(0, DevConsole.cursor - 1) + DevConsole.buffer.slice(DevConsole.cursor);
                DevConsole.cursor--;
            }
            return;
        }
        if (k === "Delete") {
            DevConsole.buffer = DevConsole.buffer.slice(0, DevConsole.cursor) + DevConsole.buffer.slice(DevConsole.cursor + 1);
            return;
        }
        if (k === "ArrowLeft")  { DevConsole.cursor = Math.max(0, DevConsole.cursor - 1); return; }
        if (k === "ArrowRight") { DevConsole.cursor = Math.min(DevConsole.buffer.length, DevConsole.cursor + 1); return; }
        if (k === "Home") { DevConsole.cursor = 0; return; }
        if (k === "End")  { DevConsole.cursor = DevConsole.buffer.length; return; }
        if (k === "ArrowUp")   { DevConsole._history(+1); return; }
        if (k === "ArrowDown") { DevConsole._history(-1); return; }
        if (k === "PageUp")    { DevConsole.scroll = Math.min(DevConsole.lines.length, DevConsole.scroll + 5); return; }
        if (k === "PageDown")  { DevConsole.scroll = Math.max(0, DevConsole.scroll - 5); return; }
        if (k === "Tab") { DevConsole._complete(); return; }

        if (k.length === 1 && !ev.ctrl && !ev.meta) DevConsole._insert(k);
    }

    static _history(dir) {
        const h = DevConsole.history;
        if (!h.length) return;
        if (DevConsole.histIdx === -1) {
            if (dir < 0) return;
            DevConsole._draft = DevConsole.buffer;
        }
        DevConsole.histIdx = Math.max(-1, Math.min(h.length - 1, DevConsole.histIdx + dir));
        DevConsole.buffer = DevConsole.histIdx === -1 ? DevConsole._draft : h[h.length - 1 - DevConsole.histIdx];
        DevConsole.cursor = DevConsole.buffer.length;
    }

    /** Candidate completions for the current buffer. */
    static completions(buffer = DevConsole.buffer) {
        DevConsole.init();
        if (!buffer.startsWith("/")) return [];
        const parts = buffer.slice(1).split(/\s+/);
        const names = (obj) => Object.values(obj).flatMap((o) => [o.name, ...(o.aliases || [])]);
        if (parts.length === 1) {
            return names(DevConsole.commands).filter((n) => n.toLowerCase().startsWith(parts[0].toLowerCase()))
                .map((n) => "/" + n);
        }
        if (parts.length === 2 && ["display", "d"].includes(parts[0].toLowerCase())) {
            const scenes = (typeof Scene !== "undefined" && Scene.scenes) ? Scene.scenes.map((s) => s.id) : [];
            return [...names(DevConsole.displays), "scene", ...scenes]
                .filter((n) => String(n).toLowerCase().startsWith(parts[1].toLowerCase()))
                .map((n) => "/" + parts[0] + " " + n);
        }
        if (parts.length === 2 && parts[0].toLowerCase() === "todo") {
            return ["reset", "export", "reload", "load", "list", "toggle"]
                .filter((n) => n.startsWith(parts[1].toLowerCase())).map((n) => "/todo " + n);
        }
        return [];
    }

    static _complete() {
        const c = DevConsole.completions();
        if (!c.length) return;
        if (c.length === 1) {
            DevConsole.buffer = c[0] + " ";
        } else {
            let pre = c[0];
            for (const s of c) while (!s.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1);
            if (pre.length > DevConsole.buffer.length) DevConsole.buffer = pre;
            DevConsole.print(c.map((s) => s.trim()).join("   "), "#8b93a8");
        }
        DevConsole.cursor = DevConsole.buffer.length;
    }

    // ---------- running commands ----------

    static submit() {
        const line = DevConsole.buffer.trim();
        DevConsole.buffer = "";
        DevConsole.cursor = 0;
        DevConsole.histIdx = -1;
        if (!line) return;
        DevConsole.print("> " + line, "#9aa3bd");
        if (DevConsole.history[DevConsole.history.length - 1] !== line) DevConsole.history.push(line);
        if (DevConsole.history.length > 100) DevConsole.history.shift();
        return DevConsole.run(line);
    }

    /** Runs one command line ("/display todoList"). Returns the command's result. */
    static run(line) {
        DevConsole.init();
        line = String(line).trim();
        if (!line) return;
        if (line[0] !== "/") {
            DevConsole.error('Commands start with "/".  Try /help   (e.g. /display todoList)');
            return;
        }
        const tokens = DevConsole.parseArgs(line.slice(1));
        const name = tokens.shift();
        const cmd = DevConsole.findCommand(name);
        if (!cmd) {
            DevConsole.error(`Unknown command "/${name}". Type /help`);
            return;
        }
        const raw = line.slice(1 + String(name).length).trim();
        try {
            const r = cmd.run(tokens, raw);
            if (r && typeof r.then === "function") {
                return r.catch((e) => DevConsole.error(e && e.message ? e.message : String(e)));
            }
            return r;
        } catch (e) {
            DevConsole.error(e && e.message ? e.message : String(e));
        }
    }

    // ---------- displays (panels / scenes) ----------

    static closePanel() {
        if (DevConsole.panel && typeof DevConsole.panel.close === "function") DevConsole.panel.close();
        DevConsole.panel = null;
        DevConsole._ui.panelRect = null;
    }

    /** Implements "/display <target> [args]". */
    static display(args) {
        const target = args[0];
        if (!target) {
            DevConsole.print("Usage: /display <target>   (try /display list)", "#ffcf5c");
            return;
        }
        const rest = args.slice(1);

        const disp = DevConsole.findDisplay(target);
        if (disp) return disp.open(rest);

        if (target.toLowerCase() === "scene") return DevConsole._displayScene(rest[0]);

        // "/display <sceneId>" is a shortcut for "/display scene <sceneId>"
        const scenes = (typeof Scene !== "undefined" && Scene.scenes) ? Scene.scenes : [];
        const sc = scenes.find((s) => s.id === target) || scenes.find((s) => String(s.id).toLowerCase() === target.toLowerCase());
        if (sc) return DevConsole._displayScene(sc.id);

        DevConsole.error(`Unknown display target "${target}". Try /display list`);
    }

    static _displayScene(id) {
        const scenes = (typeof Scene !== "undefined" && Scene.scenes) ? Scene.scenes : [];
        if (!id) {
            DevConsole.info("Scenes: " + (scenes.map((s) => s.id + (s.id === Scene.activeScene ? " (active)" : "")).join(", ") || "none"));
            return;
        }
        const sc = scenes.find((s) => s.id === id) || scenes.find((s) => String(s.id).toLowerCase() === String(id).toLowerCase());
        if (!sc) {
            DevConsole.error(`No scene "${id}". Scenes: ${scenes.map((s) => s.id).join(", ")}`);
            return;
        }
        Scene.setScene(sc.id);
        DevConsole.ok(`Scene -> ${sc.id}`);
    }

    // ---------- init ----------

    static init() {
        if (DevConsole._inited) return;
        DevConsole._inited = true;

        DevConsole.registerCommand({
            name: "help", aliases: ["?", "h"], usage: "/help [command]",
            help: "List commands, or show help for one.",
            run(args) {
                if (args[0]) {
                    const c = DevConsole.findCommand(args[0]);
                    if (!c) return DevConsole.error(`No command "${args[0]}"`);
                    DevConsole.info(c.usage || "/" + c.name);
                    DevConsole.print("  " + (c.help || ""));
                    if (c.aliases && c.aliases.length) DevConsole.print("  aliases: " + c.aliases.map((a) => "/" + a).join(" "), "#8b93a8");
                    return;
                }
                DevConsole.info("Commands:");
                const cmds = Object.values(DevConsole.commands);
                const pad = Math.max(...cmds.map((c) => (c.usage || "/" + c.name).length)) + 2;
                cmds.forEach((c) =>
                    DevConsole.print("  " + (c.usage || "/" + c.name).padEnd(pad) + (c.help || "")));
                DevConsole.print("Tab completes.  Up/Down = history.  PgUp/PgDn = scroll.", "#8b93a8");
            },
        });

        DevConsole.registerCommand({
            name: "display", aliases: ["d"], usage: "/display <target> [args]",
            help: "Change what's on screen: todoList, scene <id>, none, list.",
            run(args) {
                if ((args[0] || "").toLowerCase() === "list") {
                    DevConsole.info("Display targets:");
                    Object.values(DevConsole.displays).forEach((d) =>
                        DevConsole.print("  " + d.name.padEnd(12) + (d.help || "")));
                    DevConsole.print("  " + "scene".padEnd(12) + "/display scene <id>   or just   /display <id>");
                    const scenes = (typeof Scene !== "undefined" && Scene.scenes) ? Scene.scenes.map((s) => s.id) : [];
                    DevConsole.print("  scenes: " + scenes.join(", "), "#8b93a8");
                    return;
                }
                return DevConsole.display(args);
            },
        });

        DevConsole.registerCommand({
            name: "todo", usage: "/todo [reset|export|reload|load|list|toggle <n>]",
            help: "Todo list actions (no argument = /display todoList).",
            run(args) { return TodoPanel.command(args); },
        });

        DevConsole.registerCommand({
            name: "clear", aliases: ["cls"], usage: "/clear", help: "Clear the console output.",
            run() { DevConsole.lines = []; DevConsole.scroll = 0; },
        });

        DevConsole.registerCommand({
            name: "close", aliases: ["exit", "quit"], usage: "/close", help: "Close the console.",
            run() { DevConsole.setOpen(false); },
        });

        DevConsole.registerCommand({
            name: "eval", aliases: ["js"], usage: "/eval <javascript>",
            help: "Run JavaScript (debug only). Example: /eval world.tick",
            run(args, raw) {
                if (!raw) return DevConsole.warn("Usage: /eval <javascript>");
                const r = (0, eval)(raw);
                let out;
                try { out = typeof r === "string" ? r : JSON.stringify(r); } catch (e) { out = String(r); }
                DevConsole.print("= " + (out === undefined ? String(r) : out), "#6bd18a");
            },
        });

        DevConsole.registerDisplay(TodoPanel.asDisplay());
        DevConsole.registerDisplay({
            name: "none", aliases: ["off", "hide", "close"], help: "hide the displayed panel",
            open() { DevConsole.closePanel(); DevConsole.ok("Display cleared."); },
        });
    }

    // ---------- rendering (called after Scene.render) ----------

    static render() {
        if (!DevConsole.enabled) return;
        try {
            DevConsole.init();
            if (!DevConsole.open && !DevConsole.panel) return;
            DevConsole._draw();
        } catch (e) {
            DevConsole._fail("render", e);
            try { pop(); } catch (x) { /* ignore */ }
        }
    }

    /** Word-wraps `str` to `maxW` pixels using the current text settings. */
    static wrap(str, maxW) {
        const out = [];
        String(str).split("\n").forEach((para) => {
            const words = para.split(" ");
            let cur = "";
            words.forEach((w) => {
                const test = cur === "" ? w : cur + " " + w;
                if (textWidth(test) <= maxW) { cur = test; return; }
                if (cur !== "") out.push(cur);
                while (textWidth(w) > maxW && w.length > 1) {      // split a very long word
                    let n = w.length - 1;
                    while (n > 1 && textWidth(w.slice(0, n)) > maxW) n--;
                    out.push(w.slice(0, n));
                    w = w.slice(n);
                }
                cur = w;
            });
            out.push(cur);
        });
        return out;
    }

    static _draw() {
        push();
        resetMatrix();
        rectMode(CORNER);
        textAlign(LEFT, TOP);
        textFont("monospace");
        textSize(13);
        textLeading(16);
        noStroke();

        const W = width, H = height;
        const ctx = { W, H, pointer: DevConsole._pointer(), consoleTop: H };

        // ---- console box (bottom) ----
        if (DevConsole.open) {
            const lineH = 17;
            const rows = Math.max(4, Math.min(14, Math.floor((H * 0.4) / lineH)));
            const boxH = rows * lineH + 34;
            const top = H - boxH;
            ctx.consoleTop = top;
            DevConsole._ui.consoleRect = { x: 0, y: top, w: W, h: boxH };

            fill(8, 10, 16, 228);
            rect(0, top, W, boxH);
            fill(122, 162, 255);
            rect(0, top, W, 2);

            // wrapped output, newest at the bottom
            const maxW = W - 24;
            const wrapped = [];
            DevConsole.lines.slice(-80).forEach((ln) =>
                DevConsole.wrap(ln.text, maxW).forEach((t) => wrapped.push({ text: t, color: ln.color })));
            const maxScroll = Math.max(0, wrapped.length - rows);
            DevConsole.scroll = Math.min(DevConsole.scroll, maxScroll);
            const start = Math.max(0, wrapped.length - rows - DevConsole.scroll);
            wrapped.slice(start, start + rows).forEach((ln, i) => {
                fill(ln.color);
                text(ln.text, 12, top + 8 + i * lineH);
            });
            if (DevConsole.scroll > 0) {
                fill(139, 147, 168);
                text("^ scrolled (PgDn)", W - 140, top + 8);
            }

            // input line
            const iy = H - 24;
            fill(20, 24, 36);
            rect(0, iy - 5, W, 29);
            fill(122, 162, 255);
            text(">", 12, iy);
            fill(235, 238, 247);
            const bx = 28;
            text(DevConsole.buffer, bx, iy);
            if (Math.floor(millis() / 500) % 2 === 0) {
                const cx = bx + textWidth(DevConsole.buffer.slice(0, DevConsole.cursor));
                rect(cx, iy - 1, 2, 15);
            }
            // ghost completion hint
            const comp = DevConsole.completions();
            if (comp.length === 1 && comp[0].length > DevConsole.buffer.length) {
                fill(110, 118, 140);
                text(comp[0].slice(DevConsole.buffer.length), bx + textWidth(DevConsole.buffer), iy);
            }
            fill(110, 118, 140);
            const hint = "` close   Tab complete   /help";
            text(hint, W - textWidth(hint) - 12, iy);
        } else {
            DevConsole._ui.consoleRect = null;
        }

        // ---- displayed panel ----
        if (DevConsole.panel && typeof DevConsole.panel.render === "function") {
            DevConsole.panel.render(ctx);
        } else {
            DevConsole._ui.panelRect = null;
        }

        // pointer style
        if (ctx.pointer && DevConsole._ui.hoverButton !== DevConsole._lastCursor) {
            cursor(DevConsole._ui.hoverButton ? "pointer" : "default");
            DevConsole._lastCursor = DevConsole._ui.hoverButton;
        }
        DevConsole._ui.hoverButton = false;
        pop();
    }

    // ---------- mouse (window listeners) ----------

    static _bindMouse() {
        if (DevConsole._mouseBound || typeof window === "undefined" || !window.addEventListener) return;
        DevConsole._mouseBound = true;

        const local = (e) => {
            let ox = 0, oy = 0;
            try {
                const el = World.canvas && World.canvas.elt;
                if (el) { const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; }
            } catch (x) { /* ignore */ }
            return { x: e.clientX - ox, y: e.clientY - oy };
        };

        window.addEventListener("mousedown", (e) => {
            if (!DevConsole.enabled || e.button !== 0) return;
            const p = local(e);
            if (DevConsole.panel && DevConsole.panel.contains && DevConsole.panel.contains(p.x, p.y)) {
                try { DevConsole.panel.click && DevConsole.panel.click(p.x, p.y); }
                catch (err) { DevConsole._fail("click", err); }
            }
        });

        window.addEventListener("wheel", (e) => {
            if (!DevConsole.enabled) return;
            const p = local(e);
            const r = DevConsole._ui.consoleRect;
            if (DevConsole.open && r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
                DevConsole.scroll = Math.max(0, DevConsole.scroll + (e.deltaY < 0 ? 2 : -2));
                e.preventDefault();
            } else if (DevConsole.panel && DevConsole.panel.contains && DevConsole.panel.contains(p.x, p.y)) {
                DevConsole.panel.wheel && DevConsole.panel.wheel(e.deltaY, p.x, p.y);
                e.preventDefault();
            }
        }, { passive: false });
    }
}

// ---- static state (declared after the class for broad browser support) ----
DevConsole.open = false;
DevConsole.buffer = "";
DevConsole.cursor = 0;
DevConsole.history = [];
DevConsole.histIdx = -1;
DevConsole._draft = "";
DevConsole.lines = [];
DevConsole.scroll = 0;
DevConsole.commands = {};
DevConsole.displays = {};
DevConsole.panel = null;
DevConsole.shortcuts = [["key@`"], ["key@~"]];
DevConsole._wasDown = false;
DevConsole._bypass = false;
DevConsole._inited = false;
DevConsole._greeted = false;
DevConsole._failed = null;
DevConsole._lastCursor = false;
DevConsole._ui = { consoleRect: null, panelRect: null, hoverButton: false };

// ------------------------------------------------------------
// TodoPanel - the "/display todoList" visual element
// ------------------------------------------------------------
class TodoPanel {
    static asDisplay() {
        return {
            name: "todoList",
            aliases: ["todo", "todos"],
            help: "YAML todo list with clickable check boxes: /display todoList [file]",
            open: (args) => TodoPanel.open(args),
            close: () => {},
            render: (ctx) => TodoPanel.render(ctx),
            click: (x, y) => TodoPanel.click(x, y),
            wheel: (dy) => TodoPanel.wheel(dy),
            contains: (x, y) => TodoPanel.contains(x, y),
        };
    }

    // ---------- loading ----------

    /**
     * Finds the YAML text: fetch() when served over http(s), otherwise the
     * copy embedded in devFiles.js (fetch can't read file:// pages).
     */
    static async readSource(name) {
        const file = /\.ya?ml$/i.test(name) ? name : name + ".yaml";
        const proto = (typeof location !== "undefined") ? location.protocol : "file:";
        if (proto === "file:") await TodoPanel.refreshEmbedded();   // re-read devFiles.js from disk
        if (proto !== "file:" && typeof fetch === "function") {
            try {
                const r = await fetch(file, { cache: "no-store" });
                if (r.ok) return { text: await r.text(), file, source: "file" };
            } catch (e) { /* fall through to the embedded copy */ }
        }
        const embedded = (typeof window !== "undefined" && window.DEV_FILES) ? window.DEV_FILES : {};
        if (embedded[file] != null) return { text: embedded[file], file, source: "embedded" };
        throw new Error(`Couldn't find "${file}". On file:// pages add it to male/devFiles.js ` +
            `(node tools/syncDevFiles.js) or use /todo load.`);
    }

    /**
     * Re-loads male/devFiles.js (a plain <script>, which file:// pages ARE
     * allowed to load) so window.DEV_FILES reflects the latest sync, with
     * no page reload.
     */
    static refreshEmbedded() {
        return new Promise((resolve) => {
            if (typeof document === "undefined" || !document.getElementsByTagName) return resolve(false);
            const tag = Array.from(document.getElementsByTagName("script"))
                .find((s) => /devFiles\.js(\?|$)/.test(s.getAttribute("src") || ""));
            if (!tag) return resolve(false);
            const s = document.createElement("script");
            s.src = tag.getAttribute("src").split("?")[0] + "?t=" + Date.now();
            s.onload = () => { s.remove(); resolve(true); };
            s.onerror = () => { s.remove(); resolve(false); };
            document.head.appendChild(s);
        });
    }

    /**
     * While the panel is open, re-read the source every ~1.5s and swap in
     * the new content when it changed. Check marks you clicked are kept
     * (matched by item text) unless the file's own `done:` changed.
     */
    static _startWatch() {
        if (TodoPanel._watchTimer || typeof setInterval === "undefined") return;
        TodoPanel._watchTimer = setInterval(async () => {
            const m = TodoPanel.model;
            if (!DevConsole.panel || !m || TodoPanel._watching || TodoPanel.source === "picked") return;
            if (typeof document !== "undefined" && document.hidden) return;
            TodoPanel._watching = true;
            try {
                const src = await TodoPanel.readSource(TodoPanel.lastName || "todoList");
                if (src.text !== m.text && src.text !== TodoPanel._badText) {
                    const keep = TodoPanel.scrollY;
                    try {
                        TodoPanel.setText(src.text, src.file, src.source);
                        TodoPanel.scrollY = keep;
                        TodoPanel._badText = null;
                        DevConsole.ok(`${src.file} changed - reloaded (${TodoPanel.model.doneCount}/${TodoPanel.model.total} done)`);
                    } catch (e) {
                        TodoPanel._badText = src.text;          // report a broken edit once, keep the old list
                        DevConsole.error(`${src.file}: ${e.message}  (keeping the previous version)`);
                    }
                }
            } catch (e) { /* source temporarily unreadable: try again next time */ }
            finally { TodoPanel._watching = false; }
        }, 1500);
    }

    static setText(text, file, source) {
        TodoPanel.model = new TodoModel(text, file);
        TodoPanel.source = source;
        TodoPanel.scrollY = 0;
        TodoPanel._layoutKey = "";
        TodoPanel.model.warnings.forEach((w) => DevConsole.warn(w));
        return TodoPanel.model;
    }

    static async open(args = []) {
        const name = args[0] || TodoPanel.lastName || "todoList";
        let model = TodoPanel.model;
        if (!model || args[0] || !DevConsole.panel) {
            const src = await TodoPanel.readSource(name);
            model = TodoPanel.setText(src.text, src.file, src.source);
            TodoPanel.lastName = name;
            DevConsole.ok(`Loaded ${src.file} (${src.source}): ${model.doneCount}/${model.total} done`);
            if (src.source === "embedded") {
                DevConsole.print("  Read from male/devFiles.js. After editing the .yaml run:  node tools/syncDevFiles.js --watch" +
                    "  (the panel then updates by itself)", "#8b93a8");
            }
        }
        DevConsole.panel = DevConsole.findDisplay("todoList");
        TodoPanel.scrollY = 0;
        TodoPanel._startWatch();
    }

    // ---------- /todo subcommands ----------

    static command(args) {
        const sub = (args[0] || "").toLowerCase();
        const m = TodoPanel.model;
        if (!sub) return TodoPanel.open([]);
        if (sub === "reload") {
            const name = TodoPanel.lastName || "todoList";
            return TodoPanel.readSource(name).then((src) => {
                const model = TodoPanel.setText(src.text, src.file, src.source);
                DevConsole.ok(`Reloaded ${src.file}: ${model.doneCount}/${model.total} done`);
            });
        }
        if (sub === "load") return TodoPanel.pickFile();
        if (!m) return DevConsole.warn("No todo list loaded yet. Use /display todoList");
        if (sub === "reset") {
            m.reset();
            DevConsole.ok("Reset to the states written in the YAML.");
        } else if (sub === "export" || sub === "save") {
            TodoPanel.exportYaml();
        } else if (sub === "list") {
            m.sections.forEach((s) => {
                if (s.name) DevConsole.info(s.name);
                const walk = (it) => {
                    DevConsole.print(`  ${String(it.n).padStart(3)}. [${it.done ? "x" : " "}] ${"  ".repeat(it.depth)}${it.text}`,
                        it.done ? "#6b7690" : "#d7dbe6");
                    it.children.forEach(walk);
                };
                s.items.forEach(walk);
            });
        } else if (sub === "toggle" || sub === "check") {
            const n = parseInt(args[1], 10);
            const it = m.byNumber(n);
            if (!it) return DevConsole.error(`No item #${args[1]}. See /todo list`);
            DevConsole.ok(`#${n} ${m.toggle(it) ? "done" : "not done"}: ${it.text}`);
        } else {
            DevConsole.error(`Unknown /todo option "${sub}"`);
        }
    }

    static exportYaml() {
        const m = TodoPanel.model;
        if (!m) return DevConsole.warn("No todo list loaded.");
        const text = m.exportText();
        try {
            const blob = new Blob([text], { type: "text/yaml" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = m.file;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
            DevConsole.ok(`Downloaded ${m.file} with ${m.changed} change(s). Replace the original to keep them.`);
        } catch (e) {
            DevConsole.print(text);
            DevConsole.warn("Couldn't start a download - YAML printed above.");
        }
    }

    static pickFile() {
        return new Promise((resolve) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".yaml,.yml,text/yaml";
            input.onchange = () => {
                const f = input.files && input.files[0];
                if (!f) return resolve();
                f.text().then((text) => {
                    try {
                        const model = TodoPanel.setText(text, f.name, "picked");
                        TodoPanel.lastName = f.name;
                        DevConsole.panel = DevConsole.findDisplay("todoList");
                        DevConsole.ok(`Loaded ${f.name}: ${model.doneCount}/${model.total} done`);
                    } catch (e) { DevConsole.error(e.message); }
                    resolve();
                });
            };
            input.click();
        });
    }

    // ---------- interaction ----------

    static contains(x, y) {
        const r = DevConsole._ui.panelRect;
        return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    static click(x, y) {
        const ui = TodoPanel._ui;
        for (const b of ui.buttons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.action();
        }
        const v = ui.viewport;
        if (!v || y < v.y || y > v.y + v.h) return;
        const cy = y - v.y + TodoPanel.scrollY;
        for (const row of ui.rows) {
            if (row.item && cy >= row.y && cy < row.y + row.h && x >= v.x + row.boxX - 4 && x <= v.x + v.w) {
                TodoPanel.model.toggle(row.item);
                return;
            }
        }
    }

    static wheel(dy) {
        const ui = TodoPanel._ui;
        if (!ui.viewport) return;
        const max = Math.max(0, ui.contentH - ui.viewport.h);
        TodoPanel.scrollY = Math.max(0, Math.min(max, TodoPanel.scrollY + dy));
    }

    // ---------- drawing ----------

    static _layout(vw) {
        const m = TodoPanel.model;
        const rows = [];
        let y = 0;
        const lineH = 16;
        const numW = 34;
        m.sections.forEach((s) => {
            if (s.name) {
                y += 6;
                rows.push({ kind: "section", text: s.name, y, h: 22 });
                y += 24;
            }
            const walk = (it) => {
                const boxX = 6 + numW + it.depth * 20;
                const tx = boxX + 24;
                const avail = vw - tx - 30;                 // leaves room for the priority dot + scrollbar
                textSize(13);                               // must match the size rows are drawn at
                const lines = DevConsole.wrap(it.text, avail);
                textSize(11);
                const noteLines = it.note ? DevConsole.wrap(it.note, avail) : [];
                const h = Math.max(24, lines.length * lineH + noteLines.length * 14 + 8);
                rows.push({ kind: "item", item: it, lines, noteLines, boxX, tx, y, h });
                y += h;
                it.children.forEach(walk);
            };
            s.items.forEach(walk);
        });
        return { rows, contentH: y + 8 };
    }

    static render(ctx) {
        const m = TodoPanel.model;
        if (!m) { DevConsole._ui.panelRect = null; return; }
        const { W, H } = ctx;

        // panel geometry: right side, never underneath the console
        const pw = Math.min(520, W - 24);
        const bottom = Math.max(120, ctx.consoleTop - 12);
        const ph = Math.min(620, bottom - 12);
        const px = W - pw - 12, py = 12;
        DevConsole._ui.panelRect = { x: px, y: py, w: pw, h: ph };

        // background + frame
        fill(12, 14, 22, 240);
        rect(px, py, pw, ph, 8);
        noFill();
        stroke(58, 65, 96);
        strokeWeight(1);
        rect(px + 0.5, py + 0.5, pw - 1, ph - 1, 8);
        noStroke();

        // header: title + progress
        const done = m.doneCount, total = m.total;
        fill(230, 233, 242);
        textSize(15);
        text(m.title, px + 14, py + 12);
        textSize(12);
        fill(139, 147, 168);
        const prog = `${done}/${total} done` + (m.changed ? `   (${m.changed} unsaved)` : "");
        text(prog, px + 14, py + 34);
        fill(34, 40, 60);
        rect(px + 14, py + 54, pw - 28, 6, 3);
        fill(107, 209, 138);
        rect(px + 14, py + 54, (pw - 28) * (total ? done / total : 0), 6, 3);

        // footer buttons
        const ui = TodoPanel._ui = { buttons: [], rows: [], viewport: null, contentH: 0 };
        const by = py + ph - 36;
        const defs = [
            ["Export YAML", () => TodoPanel.exportYaml()],
            ["Reset", () => { m.reset(); }],
            ["Close", () => DevConsole.closePanel()],
        ];
        let bx = px + 14;
        textSize(12);
        defs.forEach(([label, action]) => {
            const bw = textWidth(label) + 22;
            const b = { x: bx, y: by, w: bw, h: 26, action };
            ui.buttons.push(b);
            const hot = ctx.pointer && ctx.pointer.x >= b.x && ctx.pointer.x <= b.x + b.w &&
                ctx.pointer.y >= b.y && ctx.pointer.y <= b.y + b.h;
            if (hot) DevConsole._ui.hoverButton = true;
            fill(hot ? 52 : 36, hot ? 62 : 44, hot ? 96 : 68);
            rect(b.x, b.y, b.w, b.h, 5);
            fill(220, 226, 240);
            text(label, b.x + 11, b.y + 7);
            bx += bw + 8;
        });
        fill(98, 106, 130);
        const hint = "click a box to toggle";
        text(hint, px + pw - textWidth(hint) - 14, by + 7);

        // scroll viewport
        const vx = px + 4, vy = py + 70, vw = pw - 8, vh = by - vy - 8;
        ui.viewport = { x: vx, y: vy, w: vw, h: vh };

        const key = `${vw}|${m.total}|${m.sections.length}`;
        if (TodoPanel._layoutKey !== key || TodoPanel._layoutModel !== m) {
            TodoPanel._cache = TodoPanel._layout(vw);
            TodoPanel._layoutKey = key;
            TodoPanel._layoutModel = m;
        }
        const lay = TodoPanel._cache;
        ui.rows = lay.rows;
        ui.contentH = lay.contentH;
        TodoPanel.scrollY = Math.max(0, Math.min(Math.max(0, lay.contentH - vh), TodoPanel.scrollY));

        const g = drawingContext;
        g.save();
        g.beginPath();
        g.rect(vx, vy, vw, vh);
        g.clip();

        const ptr = ctx.pointer;
        lay.rows.forEach((row) => {
            const ry = vy + row.y - TodoPanel.scrollY;
            if (ry + row.h < vy || ry > vy + vh) return;

            if (row.kind === "section") {
                textSize(13);
                fill(122, 162, 255);
                text(row.text.toUpperCase(), vx + 10, ry + 4);
                fill(46, 54, 82);
                rect(vx + 10, ry + 21, vw - 24, 1);
                return;
            }

            const it = row.item;
            const overRow = ptr && DevConsole._pointerInRect(ptr, vx, ry, vw, row.h) && ptr.y >= vy && ptr.y <= vy + vh;
            if (overRow) { fill(255, 255, 255, 12); rect(vx + 2, ry, vw - 4, row.h, 4); DevConsole._ui.hoverButton = true; }

            textSize(11);
            fill(82, 90, 116);
            text(String(it.n), vx + row.boxX - 30, ry + 6);

            // check box
            const bx0 = vx + row.boxX, by0 = ry + 4;
            if (it.done) { fill(107, 209, 138); rect(bx0, by0, 16, 16, 3); }
            else { fill(24, 28, 42); rect(bx0, by0, 16, 16, 3); noFill(); stroke(98, 108, 140); rect(bx0 + 0.5, by0 + 0.5, 15, 15, 3); noStroke(); }
            if (it.done) {
                stroke(12, 14, 22); strokeWeight(2); noFill();
                line(bx0 + 3.5, by0 + 8.5, bx0 + 7, by0 + 12); line(bx0 + 7, by0 + 12, bx0 + 12.5, by0 + 4.5);
                noStroke(); strokeWeight(1);
            }

            // text
            textSize(13);
            fill(it.done ? color(98, 108, 134) : color(230, 233, 242));
            row.lines.forEach((ln, i) => {
                const ty = ry + 5 + i * 16;
                text(ln, vx + row.tx, ty);
                if (it.done) { fill(98, 108, 134); rect(vx + row.tx, ty + 7, textWidth(ln), 1); }
            });
            if (row.noteLines.length) {
                textSize(11);
                fill(120, 128, 154);
                row.noteLines.forEach((ln, i) => text(ln, vx + row.tx, ry + 5 + row.lines.length * 16 + i * 14));
            }
            if (it.priority) {
                const col = it.priority.startsWith("h") ? [255, 107, 107] : it.priority.startsWith("m") ? [255, 207, 92] : [107, 209, 138];
                fill(col[0], col[1], col[2]);
                ellipse(vx + vw - 14, ry + 12, 7, 7);
            }
        });
        g.restore();

        // scrollbar
        if (lay.contentH > vh) {
            const th = Math.max(24, vh * (vh / lay.contentH));
            const ty = vy + (vh - th) * (TodoPanel.scrollY / (lay.contentH - vh));
            fill(70, 80, 112, 160);
            rect(px + pw - 8, ty, 4, th, 2);
        }
    }
}

TodoPanel.model = null;
TodoPanel.source = "";
TodoPanel._watchTimer = null;
TodoPanel._watching = false;
TodoPanel._badText = null;
TodoPanel.lastName = null;
TodoPanel.scrollY = 0;
TodoPanel._ui = { buttons: [], rows: [], viewport: null, contentH: 0 };
TodoPanel._layoutKey = "";
TodoPanel._layoutModel = null;
TodoPanel._cache = { rows: [], contentH: 0 };

DevConsole._pointerInRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
DevConsole._bindMouse();
