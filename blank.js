

const loginpage = {
  button:{
    drop:{
      gameid:new dropDown(),
      engineVerion:new dropDown(),
    },
    input:{
      user:new inputField(),
      password:new inputField(),
    },
  },
};






// Screen-space interface objects: Text, button, inputField.
//
//   * Position is the CENTER of the object (like gameObject) and
//     transform.scale is its width/height. Coordinates are canvas
//     pixels from the top-left, NOT world units: UI is drawn after the
//     camera is reset, so it never moves with the camera.
//   * Pass scene ids after the size like gameObject does. With none, the
//     object lives in the "blank" scene.
//   * Scene.tick() calls update(); Scene.render() draws every UI object
//     AFTER the world objects (sorted by `layer`, then creation order).
//   * Mouse/keyboard events arrive through mouse.subscribe() /
//     keyboard.subscribe(), so a click shorter than one tick is never lost.
//   * Hovering an enabled button/field hides the mouse from getInput(), and a
//     focused inputField hides the keyboard, so the game doesn't react to
//     clicks and typing meant for the UI.
//
//   Events (obj.on("click", fn) or an `onClick` option):
//     hoverStart hoverEnd pressStart release click focus blur
//     input change submit            (inputField)
class UI extends geometryObject {
    static init() {
        // NOT `UI.started`: static properties are inherited, and UI extends
        // shell, whose own `started` is already true - that made init() a no-op
        // and left UI.objects undefined. `_ready` exists only on UI itself.
        if (Object.prototype.hasOwnProperty.call(UI, "_ready")) return;
        UI.objects = [];
        UI.focused = null;       // the object that receives typing
        UI._pressed = null;      // object the left mouse button went down on
        UI._hover = null;        // topmost interactive object under the pointer
        UI._bound = false;
        UI._counter = 0;
        UI._cursorSet = false;
        UI._ready = true;
    }

    // ---------- pointer helpers ----------

    /** Canvas-relative coordinates for a client (page) coordinate. */
    static toCanvas(clientX, clientY) {
        let ox = 0, oy = 0;
        try {
            const el = World.canvas && World.canvas.elt;
            if (el && el.getBoundingClientRect) {
                const r = el.getBoundingClientRect();
                ox = r.left; oy = r.top;
            }
        } catch (e) { /* ignore */ }
        return { x: clientX - ox, y: clientY - oy };
    }

    /** Current pointer position in canvas pixels, or null before the mouse exists. */
    static pointer() {
        if (typeof mouse === "undefined" || !mouse) return null;
        return UI.toCanvas(mouse.x, mouse.y);
    }

    static _consoleOwns(p) {
        // The debug console / its panels sit on top of everything: UI under them ignores the pointer.
        return typeof DevConsole !== "undefined" && DevConsole.enabled && DevConsole.pointerOverUI(p);
    }

    // ---------- which objects take part ----------

    /** UI objects in the active scene, in draw order (last = topmost). */
    static active() {
        UI.init();
        const id = (typeof Scene !== "undefined") ? Scene.activeScene : null;
        return UI.objects
            .filter((o) => !o.deleted && o.active && o.visible && o.scenes.includes(id))
            .sort((a, b) => (a.layer - b.layer) || (a._order - b._order));
    }

    /** Topmost interactive object under (x, y) canvas pixels. */
    static topAt(x, y) {
        const list = UI.active();
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].interactive && list[i].containsPoint(x, y)) return list[i];
        }
        return null;
    }

    /** True if the game should NOT see this input domain right now (used by getInput). */
    static blocksInput(domain) {
        if (!Object.prototype.hasOwnProperty.call(UI, "_ready")) return false;
        if (domain === "key" || domain === "keyboard") {
            return !!(UI.focused && UI.focused.capturesKeys && !UI.focused.deleted);
        }
        if (domain === "mouse") return !!(UI._hover || UI._pressed);
        return false;
    }

    // ---------- input wiring ----------

    static _bindInput() {
        if (UI._bound) return true;
        if (typeof mouse === "undefined" || !mouse || typeof mouse.subscribe !== "function") return false;
        mouse.subscribe((ev) => UI._onMouse(ev));
        if (typeof keyboard !== "undefined" && keyboard && typeof keyboard.subscribe === "function") {
            keyboard.subscribe((ev) => UI._onKey(ev));
        }
        UI._bound = true;
        return true;
    }

    static _onMouse(ev) {
        const p = UI.toCanvas(ev.x, ev.y);
        if (ev.type === "move") {
            UI._updateHover(p);
            if (UI._pressed && UI._pressed._pointerDrag) UI._pressed._pointerDrag(p, ev);
            return;
        }
        if (ev.button !== 0) return;                      // left button only

        if (ev.type === "down") {
            if (UI._consoleOwns(p)) return;
            const t = UI.topAt(p.x, p.y);
            const target = (t && t.enabled) ? t : null;
            UI._pressed = target;
            if (UI.focused && UI.focused !== target) UI.focused.blur();   // clicked somewhere else
            UI._updateHover(p);
            if (target) target._pointerDown(p, ev);
        } else if (ev.type === "up") {
            const pr = UI._pressed;
            UI._pressed = null;
            if (pr && !pr.deleted) pr._pointerUp(p, ev);
            UI._updateHover(p);
        }
    }

    static _onKey(ev) {
        if (typeof DevConsole !== "undefined" && DevConsole.enabled) {
            if (DevConsole.open) return;
            // In debug mode the console shortcut (` by default) wins: don't type it into a field.
            if (DevConsole._shortcutEventIndex([ev]) >= 0) return;
        }
        const f = UI.focused;
        if (!f || f.deleted || !f.enabled) return;
        if (ev.type === "down" && ev.key === "Tab") { UI.focusNext(ev.shift ? -1 : 1); return; }
        f._onKey(ev);
    }

    static _updateHover(p) {
        let hv = null;
        if (p && !UI._consoleOwns(p)) {
            const t = UI.topAt(p.x, p.y);
            hv = (t && t.enabled) ? t : null;
        }
        if (hv === UI._hover) return;
        if (UI._hover) UI._hover._setHover(false);
        UI._hover = hv;
        if (hv) hv._setHover(true);
    }

    /** Moves keyboard focus to the next (dir = 1) or previous (-1) focusable object. */
    static focusNext(dir = 1) {
        const list = UI.active()
            .filter((o) => o.focusable && o.enabled)
            .sort((a, b) => (a.tabIndex - b.tabIndex) || (a._order - b._order));
        if (!list.length) return null;
        let i = list.indexOf(UI.focused);
        i = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
        list[i]._focusVisible = true;
        list[i].focus();
        list[i]._focusVisible = true;
        return list[i];
    }

    /** Keyboard capture (stops Tab/Backspace/arrows from acting on the web page). */
    static _syncCapture() {
        if (typeof keyboard === "undefined" || !keyboard) return;
        const consoleOpen = typeof DevConsole !== "undefined" && DevConsole.open;
        keyboard.capture = !!(UI.focused && UI.focused.capturesKeys) || !!consoleOpen;
    }

    /** Called once per game tick by Scene.tick(). */
    static tick(dt = 1 / 60) {
        UI.init();
        UI._bindInput();
        const active = UI.active();
        if (UI.focused && !active.includes(UI.focused)) UI.focused.blur();   // scene changed / hidden
        UI._updateHover(UI.pointer());
        UI.objects.forEach((o) => { if (!o.deleted) o._endTick(dt); });
    }

    /** Called by Scene.render() after drawing UI: pointer shape for the hovered object. */
    static applyCursor() {
        if (typeof cursor !== "function") return;
        const h = UI._hover;
        if (h && h.cursorType) { cursor(h.cursorType); UI._cursorSet = true; }
        else if (UI._cursorSet) { cursor("default"); UI._cursorSet = false; }
    }

    // ---------- construction ----------

    constructor(x = 0, y = 0, w = 100, h = 30, ...scenes) {
        super();
        UI.init();
        this.id = "MALE:UI[" + Math.random().toString(36).substring(2) + "]";
        this.superId = this.id;
        this.deleted = false;
        this.transform = new Transform(x, y, w, h);
        this.tags = ["ui"];
        this.scripts = [];
        this.scenes = scenes.length < 1 ? ["blank"] : scenes;
        this.isUI = true;

        // Rendering settings: the SAME structure gameObject uses (see
        // gameObject.rendering). render() draws the body from these with the
        // same steps as gameObject.render(); button / inputField fill
        // color + outline in per state (rest / hover / pressed ...).
        this.rendering = {
            draw: {
                hitbox: false,
                shape: "rect",       // "rect" | "circle" | "ellipse" | "none"
                texture: null,
                presets: [],
                radius: 0,           // rounded corners (rect only)
            },
            color: "white",
            visible: true,           // false: hidden and not clickable
            outline: [0.1, "black"], // [weight, color] or null for none
            debug: false,            // true / { color, center }: draw the click bounds like a hitbox
        };

        this.active = true;          // false: skipped completely (no update / draw / input)
        this.enabled = true;         // false: drawn greyed out, ignores input
        this.interactive = true;     // false: clicks pass straight through (Text)
        this.focusable = false;
        this.capturesKeys = false;   // true: while focused the game doesn't see the keyboard
        this.tabIndex = 0;
        this.layer = 0;              // higher draws on top

        this.hovered = false;
        this.focused = false;
        this.cursorType = null;

        this._handlers = {};
        this._order = UI._counter++;
        this._focusVisible = false;

        UI.objects.push(this);
        this.push(this);
        UI._bindInput();
    }

    /** Alias of rendering.visible. */
    get visible() { return this.rendering.visible; }
    set visible(v) { this.rendering.visible = !!v; }

    get x() { return this.transform.position.x; }
    set x(v) { this.transform.position.x = v; }
    get y() { return this.transform.position.y; }
    set y(v) { this.transform.position.y = v; }
    get width() { return this.transform.scale.x; }
    set width(v) { this.transform.scale.x = v; }
    get height() { return this.transform.scale.y; }
    set height(v) { this.transform.scale.y = v; }

    /** Copies option values onto this object. `onClick`-style keys become event handlers. */
    _applyOptions(opts) {
        if (!opts || typeof opts !== "object") return this;
        const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
        Object.keys(opts).forEach((k) => {
            const v = opts[k];
            if (/^on[A-Z]/.test(k) && typeof v === "function") {
                this.on(k[2].toLowerCase() + k.slice(3), v);
            } else if (isPlain(v) && isPlain(this[k])) {
                Object.assign(this[k], v);
            } else {
                this[k] = v;
            }
        });
        return this;
    }

    // ---------- events ----------

    on(type, fn) {
        if (typeof fn !== "function") return this;
        (this._handlers[type] = this._handlers[type] || []).push(fn);
        return this;
    }

    off(type, fn) {
        const list = this._handlers[type];
        if (!list) return this;
        if (!fn) delete this._handlers[type];
        else { const i = list.indexOf(fn); if (i > -1) list.splice(i, 1); }
        return this;
    }

    emit(type, data = {}) {
        const list = this._handlers[type];
        if (!list) return;
        const ev = Object.assign({ type, target: this }, data);
        list.slice().forEach((fn) => {
            try { fn.call(this, ev); } catch (err) { console.error(`[UI] "${type}" handler error:`, err); }
        });
    }

    // ---------- geometry ----------

    bounds() {
        const p = this.transform.position, s = this.transform.scale;
        return { left: p.x - s.x / 2, right: p.x + s.x / 2, top: p.y - s.y / 2, bottom: p.y + s.y / 2 };
    }

    containsPoint(px, py) {
        const b = this.bounds();
        return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
    }

    // ---------- focus ----------

    focus() {
        if (!this.focusable || !this.enabled || this.deleted) return false;
        if (UI.focused === this) return true;
        if (UI.focused) UI.focused.blur();
        UI.focused = this;
        this.focused = true;
        this._onFocus();
        this.emit("focus");
        UI._syncCapture();
        return true;
    }

    blur() {
        if (UI.focused !== this) return false;
        UI.focused = null;
        this.focused = false;
        this._focusVisible = false;
        this._onBlur();
        this.emit("blur");
        UI._syncCapture();
        return true;
    }

    // ---------- internal hooks (subclasses override) ----------
    _setHover(on) {
        if (this.hovered === on) return;
        this.hovered = on;
        this.emit(on ? "hoverStart" : "hoverEnd");
    }
    _pointerDown(p, ev) {}
    _pointerUp(p, ev) {}
    _pointerDrag(p, ev) {}
    _onKey(ev) {}
    _onFocus() {}
    _onBlur() {}
    _endTick(dt) {}

    // ---------- Scene hooks ----------

    update(dt = 1 / 60) {}

    /**
     * Draws in screen space (the camera transform is reset first), using the
     * same steps as gameObject.render(): body from `rendering` (fill, outline,
     * shape at the transform's position/scale), then the object's own content
     * (draw()), then optional debug bounds.
     */
    render() {
        if (this.deleted || !this.active || !this.rendering.visible) return;
        push();
        resetMatrix();
        try {
            this._syncRendering();
            this._drawBody();
            this.draw();
            if (this.rendering.debug) this._drawDebug();
        } finally { pop(); }
    }

    /** Subclasses set rendering.color / outline from their current state here. */
    _syncRendering() {}

    /** Body shape: mirrors the shape switch in gameObject.render(). */
    _drawBody() {
        const r = this.rendering, d = r.draw;
        if (!d || !d.shape || d.shape === "none" || r.color === null || r.color === undefined) return;
        const pos = this.transform.position, scale = this.transform.scale;
        push();
        fill(r.color);
        translate(pos.x, pos.y);
        if (Array.isArray(r.outline) && r.outline[0] > 0) {
            stroke(r.outline[1]);
            strokeWeight(r.outline[0]);
        } else noStroke();
        switch (d.shape) {
            case "rect":
            case "rectangle":
                rectMode(CENTER);
                rect(0, 0, scale.x, scale.y, d.radius || 0);
                break;
            case "circle":
            case "ellipse":
                ellipse(0, 0, scale.x, scale.y);
                break;
        }
        pop();
    }

    /** Debug overlay like gameObject's: outline of the click bounds + center dot. */
    _drawDebug() {
        const dbg = this.rendering.debug;
        const pos = this.transform.position, scale = this.transform.scale;
        push();
        translate(pos.x, pos.y);
        noFill();
        stroke((dbg && dbg.color) || "yellow");
        strokeWeight(1.5);
        rectMode(CENTER);
        rect(0, 0, scale.x, scale.y);
        if (!dbg || dbg.center !== false) {
            stroke("red");
            strokeWeight(2);
            point(0, 0);
        }
        pop();
    }

    /** Content drawn on top of the body, in screen space. Subclasses override. */
    draw() {}

    delete() {
        if (this.deleted) return;
        this.blur();
        if (UI._hover === this) UI._hover = null;
        if (UI._pressed === this) UI._pressed = null;
        this.deleted = true;
        const i = UI.objects.indexOf(this);
        if (i > -1) UI.objects.splice(i, 1);
        this.remove(this);
        if (typeof Scene !== "undefined" && Scene.scenes) {
            Scene.scenes.forEach((sc) => {
                const j = sc.objects.indexOf(this);
                if (j > -1) sc.objects.splice(j, 1);
            });
        }
    }
}

// ============================================
// UI: TEXT
// ============================================
// Same constructor as before. By default a Text is NOT put in any scene
// (draw() it yourself, e.g. from a scene script). Pass scene ids as extra
// arguments and the Scene updates/draws it automatically:
//     new Text(20, 30, "Score", "white", "bold", 18, "left", "top", "level1");
class Text extends UI {
    static init() {}
    constructor(x, y, txt, c, sty, size, ha = 'left', va = 'bottom', ...scenes) {
        super(x, y, 0, 0, ...scenes);
        if (scenes.length === 0) this.scenes = [];
        this.interactive = false;       // text never steals clicks
        this.rendering.draw.shape = "none";   // text draws itself, no body
        this.text = txt;
        this.color = c;
        this.size = size;
        this.style = sty;
        this.align = [ha, va];
    }
    update() {
        let styles = ["bold", "italic", null];
        if (!styles.includes(this.style)) this.style = null;
        if (typeof this.size != "number") this.size = 16;
    }
    draw() {
        push();
        translate(this.x, this.y);
        textSize(this.size);
        textAlign(this.align[0], this.align[1]);
        textStyle(this.style || NORMAL);
        if (this.color !== undefined && this.color !== null) fill(this.color);
        colorText(String(this.text), 0, 0);
        pop();
    }
}

// ============================================
// UI: BUTTON
// ============================================
// A push button. States: "rest", "hover", "pressed" (and "disabled").
//
//   new button(x, y, w, h, "Play", "menuScene")
//   new button(x, y, w, h, { text: "Play", onClick: () => start(),
//                            colors: { rest: "#345", hover: "#456", pressed: "#123" } })
//
// Trackers (readable from scripts):
//   hovered / pressed        live state (pressed = mouse is down on it AND still over it)
//   state                    "rest" | "hover" | "pressed" | "disabled"
//   justHovered / justPressed / justReleased / justClicked
//                            true for exactly one tick after it happens
//   clicked                  same as justClicked
//   clickCount               total clicks
//   hoverTime / pressTime    seconds of the current hover / press (0 when not)
//
// Like an HTML button: the click happens when the mouse is released while
// still over the button after being pressed on it; Enter / Space click it
// while it has focus (click it or Tab to it).
class button extends UI {
    constructor(x, y, w = 120, h = 40, opts = {}, ...scenes) {
        super(x, y, w, h, ...scenes);
        if (typeof opts === "string") opts = { text: opts };

        this.focusable = true;
        this.cursorType = "pointer";

        this.text = "";
        this.font = "sans-serif";
        this.fontSize = 16;
        this.fontStyle = null;           // "bold" | "italic" | null

        // Fill color for each state (any p5 color: "#rrggbb", "red", [r,g,b], ...).
        this.colors = {
            rest: "#3a4160",
            hover: "#4d5a8f",
            pressed: "#232a47",
            disabled: "#2a2d38",
        };
        // Label color for each state.
        this.textColors = {
            rest: "#e6e9f2",
            hover: "#ffffff",
            pressed: "#c3cbe4",
            disabled: "#6f7690",
        };
        // Border color for each state (set outlineWeight to 0 for none).
        this.outlineColors = {
            rest: "#5b6593",
            hover: "#8fa2e6",
            pressed: "#7a86bd",
            disabled: "#3a3e4d",
        };
        this.outlineWeight = 1;
        this.focusColor = "#7aa2ff";
        this.radius = 6;

        // trackers
        this.pressed = false;
        this.clickCount = 0;
        this.hoverTime = 0;
        this.pressTime = 0;
        this.justHovered = false;
        this.justPressed = false;
        this.justReleased = false;
        this.justClicked = false;
        this._pressInside = false;
        this._flash = 0;                 // keyboard "press" animation (seconds left)

        this._applyOptions(opts);
    }

    get clicked() { return this.justClicked; }

    get state() {
        if (!this.enabled) return "disabled";
        if (this.pressed || this._flash > 0) return "pressed";
        if (this.hovered) return "hover";
        return "rest";
    }

    /** Sets the three main fill colors at once. Chainable. */
    setColors(rest, hover, pressed) {
        if (rest !== undefined) this.colors.rest = rest;
        if (hover !== undefined) this.colors.hover = hover;
        if (pressed !== undefined) this.colors.pressed = pressed;
        return this;
    }

    /** Shorthand for on("click", fn). Chainable. */
    onClick(fn) { return this.on("click", fn); }

    /** Clicks the button from code (fires "click" and updates the trackers). */
    click(source = "script") {
        if (!this.enabled) return false;
        this.clickCount++;
        this.justClicked = true;
        this.emit("click", { source });
        return true;
    }

    _setHover(on) {
        if (this.hovered === on) return;
        super._setHover(on);
        if (on) this.justHovered = true; else this.hoverTime = 0;
    }

    _pointerDown(p) {
        this._pressInside = true;
        this.pressed = true;
        this.justPressed = true;
        this._focusVisible = false;      // mouse focus: no keyboard focus ring
        this.focus();
        this._focusVisible = false;
        this.emit("pressStart");
    }

    _pointerDrag(p) {
        // Dragging off the button un-presses it; dragging back on presses it again.
        this.pressed = this._pressInside && this.containsPoint(p.x, p.y);
    }

    _pointerUp(p) {
        const wasPressed = this._pressInside;
        const stillOver = this.containsPoint(p.x, p.y) && UI.topAt(p.x, p.y) === this;
        this._pressInside = false;
        this.pressed = false;
        this.pressTime = 0;
        this.justReleased = true;
        this.emit("release");
        if (wasPressed && stillOver) this.click("mouse");
    }

    _onKey(ev) {
        if (ev.type !== "down" || ev.repeat) return;
        if (ev.key === "Enter" || ev.key === " ") {
            this._flash = 0.12;
            this.click("keyboard");
        }
    }

    _endTick(dt) {
        if (this.hovered) this.hoverTime += dt;
        if (this.pressed) this.pressTime += dt;
        if (this._flash > 0) this._flash = Math.max(0, this._flash - dt);
        this.justHovered = false;
        this.justPressed = false;
        this.justReleased = false;
        this.justClicked = false;
    }

    /** Picks the body fill / outline for the current state (rest, hover, pressed, disabled). */
    _syncRendering() {
        const st = this.state;
        const r = this.rendering;
        r.color = this.colors[st];
        r.outline = this.outlineWeight > 0 ? [this.outlineWeight, this.outlineColors[st]] : null;
        r.draw.radius = this.radius;
    }

    draw() {
        const st = this.state;
        const w = this.width, h = this.height;
        push();
        translate(this.x, this.y);
        rectMode(CENTER);

        if (this.focused && this._focusVisible && this.enabled) {
            noFill();
            stroke(this.focusColor);
            strokeWeight(2);
            rect(0, 0, w + 4, h + 4, this.radius + 2);
        }

        noStroke();
        fill(this.textColors[st]);
        textFont(this.font);
        textSize(this.fontSize);
        textStyle(this.fontStyle || NORMAL);
        textAlign(CENTER, CENTER);
        text(String(this.text), 0, 0);
        pop();
    }
}

// ============================================
// UI: INPUT FIELD
// ============================================
// A single-line text box that behaves like <input type="text">:
//
//   click to focus (blue ring) - click elsewhere / Tab to leave
//   type, Backspace, Delete, Left/Right/Home/End (+Ctrl = by word, +Shift = select)
//   mouse: click to place the caret, drag or Shift+click to select, double-click a word
//   Ctrl+A select all, Ctrl+C / X / V copy / cut / paste, Ctrl+Z / Y undo / redo
//   Enter -> "submit"; losing focus after a change -> "change"
//   long text scrolls to keep the caret visible
//
//   new inputField(x, y, 220, 34, { placeholder: "Name", maxLength: 12,
//                                   onSubmit: (e) => console.log(e.value) })
//   field.value                      read / write the text
//   options: value, placeholder, type ("text" | "password" | "number"),
//            maxLength, readOnly, enabled, allow (RegExp tested per typed
//            character), font, fontSize, colors / outlineColors / textColor ...
//
// A string as the 5th argument is the starting value.
class inputField extends UI {
    constructor(x, y, w = 200, h = 34, opts = {}, ...scenes) {
        super(x, y, w, h, ...scenes);
        if (typeof opts === "string") opts = { value: opts };

        this.focusable = true;
        this.capturesKeys = true;
        this.cursorType = "text";

        this._value = "";
        this.placeholder = "";
        this.type = "text";              // "text" | "password" | "number"
        this.maxLength = Infinity;
        this.readOnly = false;
        this.allow = null;               // RegExp each typed character must match

        this.font = "sans-serif";
        this.fontSize = 16;
        this.padding = 8;
        this.radius = 4;
        this.outlineWeight = 1;

        // Per-state colors: rest, hover, focused, disabled.
        this.colors = { rest: "#1c2030", hover: "#232842", focused: "#12151f", disabled: "#23252e" };
        this.outlineColors = { rest: "#4b5578", hover: "#6f7db5", focused: "#7aa2ff", disabled: "#363a48" };
        this.textColor = "#e6e9f2";
        this.disabledTextColor = "#6f7690";
        this.placeholderColor = "#6f7690";
        this.selectionColor = "rgba(122,162,255,0.45)";
        this.caretColor = "#e6e9f2";

        this.caret = 0;                  // insertion point (selection focus)
        this.anchor = 0;                 // other end of the selection (== caret when none)
        this.scrollX = 0;                // how far the text is scrolled left (px)
        this._caretReset = 0;
        this._dragging = false;
        this._valueAtFocus = "";
        this._history = [{ v: "", c: 0, a: 0 }];
        this._hIndex = 0;
        this._lastKind = null;
        this._lastEditAt = 0;
        this._lastClickAt = 0;
        this._lastClickX = -1;

        this._applyOptions(opts);
        this.caret = this.anchor = this._value.length;
        this._history = [{ v: this._value, c: this.caret, a: this.anchor }];
        this._hIndex = 0;
    }

    // ---------- value ----------

    get value() { return this._value; }
    set value(v) {
        v = String(v ?? "");
        if (v.length > this.maxLength) v = v.slice(0, this.maxLength);
        this._value = v;
        this.caret = Math.min(this.caret, v.length);
        this.anchor = Math.min(this.anchor, v.length);
        this._scrollIntoView();
    }

    get valueAsNumber() { return this._value.trim() === "" ? NaN : Number(this._value); }
    get selectionStart() { return Math.min(this.anchor, this.caret); }
    get selectionEnd() { return Math.max(this.anchor, this.caret); }
    get selectedText() { return this._value.slice(this.selectionStart, this.selectionEnd); }
    get hasSelection() { return this.anchor !== this.caret; }

    setSelectionRange(start, end) {
        const n = this._value.length;
        this.anchor = Math.max(0, Math.min(n, start));
        this.caret = Math.max(0, Math.min(n, end));
        this._touchCaret();
        return this;
    }

    select() { return this.setSelectionRange(0, this._value.length); }

    onInput(fn) { return this.on("input", fn); }
    onChange(fn) { return this.on("change", fn); }
    onSubmit(fn) { return this.on("submit", fn); }

    /** What is drawn: the text, or bullets for a password. */
    get displayText() {
        return this.type === "password" ? "\u2022".repeat(this._value.length) : this._value;
    }

    // ---------- text measuring (needs p5) ----------

    _measure(str) {
        push();
        textFont(this.font);
        textSize(this.fontSize);
        textStyle(NORMAL);
        const w = textWidth(str);
        pop();
        return w;
    }

    /** Character index nearest to a canvas-pixel x position. */
    _indexAt(px) {
        const disp = this.displayText;
        const local = px - (this.bounds().left + this.padding) + this.scrollX;
        if (local <= 0) return 0;
        let prev = 0;
        for (let i = 1; i <= disp.length; i++) {
            const w = this._measure(disp.slice(0, i));
            if (local < (prev + w) / 2) return i - 1;
            prev = w;
        }
        return disp.length;
    }

    _scrollIntoView() {
        let cx = 0, total = 0;
        try {
            const disp = this.displayText;
            cx = this._measure(disp.slice(0, this.caret));
            total = this._measure(disp);
        } catch (e) { return; }
        const vw = Math.max(1, this.width - this.padding * 2);
        if (cx - this.scrollX > vw) this.scrollX = cx - vw;
        if (cx - this.scrollX < 0) this.scrollX = cx;
        this.scrollX = Math.max(0, Math.min(this.scrollX, Math.max(0, total - vw + 2)));
    }

    _touchCaret() {
        this._caretReset = (typeof millis === "function") ? millis() : 0;
        this._scrollIntoView();
    }

    // ---------- editing ----------

    _canEdit() { return this.enabled && !this.readOnly; }

    _record(kind) {
        const now = Date.now();
        const snap = { v: this._value, c: this.caret, a: this.anchor };
        // Consecutive typing / deleting is one undo step.
        if (kind && kind === this._lastKind && now - this._lastEditAt < 800 && this._hIndex === this._history.length - 1) {
            this._history[this._hIndex] = snap;
        } else {
            this._history = this._history.slice(0, this._hIndex + 1);
            this._history.push(snap);
            if (this._history.length > 100) this._history.shift();
            this._hIndex = this._history.length - 1;
        }
        this._lastKind = kind;
        this._lastEditAt = now;
    }

    _restore(i) {
        const s = this._history[i];
        if (!s) return;
        this._hIndex = i;
        this._value = s.v;
        this.caret = s.c;
        this.anchor = s.a;
        this._lastKind = null;
        this._touchCaret();
        this.emit("input", { value: this._value });
    }

    /** Replaces the selection (or inserts at the caret) with `str`. */
    _insert(str, kind = "type") {
        if (!this._canEdit()) return false;
        let s = String(str).replace(/[\r\n\t]+/g, " ");
        if (this.type === "number") s = s.replace(/[^0-9.\-+eE]/g, "");
        if (this.allow instanceof RegExp) s = Array.from(s).filter((ch) => { this.allow.lastIndex = 0; return this.allow.test(ch); }).join("");
        const room = this.maxLength - (this._value.length - (this.selectionEnd - this.selectionStart));
        if (room <= 0) s = "";
        else if (s.length > room) s = s.slice(0, room);
        if (!s && !this.hasSelection) return false;

        const a = this.selectionStart, b = this.selectionEnd;
        this._value = this._value.slice(0, a) + s + this._value.slice(b);
        this.caret = this.anchor = a + s.length;
        this._record(kind);
        this._touchCaret();
        this.emit("input", { value: this._value });
        return true;
    }

    _delete(dir, byWord) {
        if (!this._canEdit()) return;
        if (!this.hasSelection) {
            let to = this.caret;
            if (dir < 0) to = byWord ? this._wordLeft(this.caret) : Math.max(0, this.caret - 1);
            else to = byWord ? this._wordRight(this.caret) : Math.min(this._value.length, this.caret + 1);
            if (to === this.caret) return;
            this.anchor = to;
        }
        const a = this.selectionStart, b = this.selectionEnd;
        this._value = this._value.slice(0, a) + this._value.slice(b);
        this.caret = this.anchor = a;
        this._record("delete");
        this._touchCaret();
        this.emit("input", { value: this._value });
    }

    _wordLeft(i) {
        const s = this._value;
        while (i > 0 && /\s/.test(s[i - 1])) i--;
        while (i > 0 && !/\s/.test(s[i - 1])) i--;
        return i;
    }

    _wordRight(i) {
        const s = this._value;
        while (i < s.length && /\s/.test(s[i])) i++;
        while (i < s.length && !/\s/.test(s[i])) i++;
        return i;
    }

    _move(to, extend) {
        this.caret = Math.max(0, Math.min(this._value.length, to));
        if (!extend) this.anchor = this.caret;
        this._lastKind = null;
        this._touchCaret();
    }

    _copy(cut) {
        if (!this.hasSelection || this.type === "password") return;
        const txt = this.selectedText;
        UI.writeClipboard(txt);
        if (cut) this._delete(-1, false);
    }

    // ---------- keyboard ----------

    _onKey(ev) {
        if (ev.type === "paste") {
            this._insert(ev.text, "paste");
            return;
        }
        if (ev.type !== "down") return;
        const k = ev.key;
        const ctrl = ev.ctrl || ev.meta;

        if (k === "Enter") {
            this.emit("submit", { value: this._value });
            this._fireChange();
            return;
        }
        if (ctrl && !ev.alt) {
            const lk = k.toLowerCase();
            if (lk === "a") { this.select(); return; }
            if (lk === "c") { this._copy(false); return; }
            if (lk === "x") { this._copy(true); return; }
            if (lk === "z") { if (ev.shift) this._redo(); else this._undo(); return; }
            if (lk === "y") { this._redo(); return; }
            if (lk === "v") return;                       // the browser's paste event delivers the text
        }
        switch (k) {
            case "Backspace": this._delete(-1, ctrl); return;
            case "Delete": this._delete(1, ctrl); return;
            case "ArrowLeft":
                if (!ev.shift && this.hasSelection) this._move(this.selectionStart, false);
                else this._move(ctrl ? this._wordLeft(this.caret) : this.caret - 1, ev.shift);
                return;
            case "ArrowRight":
                if (!ev.shift && this.hasSelection) this._move(this.selectionEnd, false);
                else this._move(ctrl ? this._wordRight(this.caret) : this.caret + 1, ev.shift);
                return;
            case "Home": case "ArrowUp": this._move(0, ev.shift); return;
            case "End": case "ArrowDown": this._move(this._value.length, ev.shift); return;
        }
        if (k.length === 1 && (!ctrl || ev.alt)) this._insert(k, "type");
    }

    _undo() { if (this._canEdit() && this._hIndex > 0) this._restore(this._hIndex - 1); }
    _redo() { if (this._canEdit() && this._hIndex < this._history.length - 1) this._restore(this._hIndex + 1); }

    _fireChange() {
        if (this._value !== this._valueAtFocus) {
            this._valueAtFocus = this._value;
            this.emit("change", { value: this._value });
        }
    }

    // ---------- mouse ----------

    _pointerDown(p, ev) {
        this._focusVisible = false;
        this.focus();
        const idx = this._indexAt(p.x);
        const now = Date.now();
        const dbl = now - this._lastClickAt < 350 && Math.abs(p.x - this._lastClickX) < 4;
        this._lastClickAt = now;
        this._lastClickX = p.x;

        if (dbl) {                                         // double-click selects the word
            let a = idx, b = idx;
            while (a > 0 && !/\s/.test(this._value[a - 1])) a--;
            while (b < this._value.length && !/\s/.test(this._value[b])) b++;
            this.anchor = a; this.caret = b;
            this._dragging = false;
        } else {
            this.caret = idx;
            if (!ev.shift) this.anchor = idx;
            this._dragging = true;
        }
        this._lastKind = null;
        this._touchCaret();
    }

    _pointerDrag(p) {
        if (!this._dragging) return;
        this.caret = this._indexAt(p.x);
        this._touchCaret();
    }

    _pointerUp() { this._dragging = false; }

    // ---------- focus ----------

    _onFocus() {
        this._valueAtFocus = this._value;
        this._touchCaret();
        if (!this._dragging && this._focusVisible) this.select();     // Tab in = select all, like HTML
    }

    _onBlur() {
        this._dragging = false;
        this._fireChange();
        this.anchor = this.caret;
    }

    // ---------- drawing ----------

    get _visualState() {
        return !this.enabled ? "disabled" : this.focused ? "focused" : this.hovered ? "hover" : "rest";
    }

    /** Picks the box fill / outline for the current state (rest, hover, focused, disabled). */
    _syncRendering() {
        const st = this._visualState;
        const r = this.rendering;
        r.color = this.colors[st];
        r.outline = this.outlineWeight > 0
            ? [this.focused ? this.outlineWeight + 1 : this.outlineWeight, this.outlineColors[st]]
            : null;
        r.draw.radius = this.radius;
    }

    draw() {
        const w = this.width, h = this.height;
        push();
        translate(this.x, this.y);
        rectMode(CENTER);
        noStroke();

        // text area (clipped)
        const g = drawingContext;
        g.save();
        g.beginPath();
        g.rect(-w / 2 + this.padding - 1, -h / 2 + 1, w - this.padding * 2 + 2, h - 2);
        g.clip();

        textFont(this.font);
        textSize(this.fontSize);
        textStyle(NORMAL);
        textAlign(LEFT, CENTER);
        const disp = this.displayText;
        const x0 = -w / 2 + this.padding - this.scrollX;

        if (disp === "" && this.placeholder !== "") {
            fill(this.placeholderColor);
            text(this.placeholder, x0, 0);
        } else {
            if (this.focused && this.hasSelection) {
                const sx = x0 + textWidth(disp.slice(0, this.selectionStart));
                const ex = x0 + textWidth(disp.slice(0, this.selectionEnd));
                rectMode(CORNER);
                fill(this.selectionColor);
                rect(sx, -this.fontSize * 0.65, ex - sx, this.fontSize * 1.3);
                rectMode(CENTER);
            }
            fill(this.enabled ? this.textColor : this.disabledTextColor);
            text(disp, x0, 0);
        }

        // caret
        if (this.focused && this.enabled && !this.hasSelection) {
            const t = (typeof millis === "function") ? millis() - this._caretReset : 0;
            if (Math.floor(t / 530) % 2 === 0) {
                const cx = x0 + textWidth(disp.slice(0, this.caret));
                stroke(this.caretColor);
                strokeWeight(1.5);
                line(cx, -this.fontSize * 0.65, cx, this.fontSize * 0.65);
            }
        }
        g.restore();
        pop();
    }
}

// Alternate spelling of the class name.
const fieldInput = inputField;

/** Copies text to the system clipboard (best effort; needs a user gesture). */
UI.writeClipboard = function (txt) {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).catch(() => UI._legacyCopy(txt));
            return;
        }
    } catch (e) { /* fall through */ }
    UI._legacyCopy(txt);
};

UI._legacyCopy = function (txt) {
    try {
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
    } catch (e) { /* clipboard unavailable */ }
};





class genricShape extends geometryObject {
  static init() {
    if (Hitbox.started) return;
    genricShape.shapes = [];
    genricShape.started = true;
  }

  constructor(shape, ...dimensions) {
    super(...dimensions);
    genericShape.init();
    this.id = "MALE:genericShape[" + Math.random().toString(36).substring(2) + "]";
    this.deleted = false;
    

    this.defaultShapes = [
      "rectangle",
      "rect",
      "ellipse",
      "circle",
      "square",
      "triangle",
    ];
    this.shape = this.defaultShapes.includes(shape) ? shape : "rectangle";
    this.radius = null;
    this.width = 0;
    this.height = 0;
    this.arcData = null;

    if (this.shape === "triangle") {
      this.transform = new Transform(0, 0, 0, 0);
      this.offset = {
        x: dimensions[0],
        y: dimensions[1],
        ax: dimensions[2],
        ay: dimensions[3],
        bx: dimensions[4],
        by: dimensions[5],
        cx: dimensions[6],
        cy: dimensions[7],
      };
      
      this.triangleRoles = this.classifyTriangleVertices([
        { x: this.offset.ax, y: this.offset.ay },
        { x: this.offset.bx, y: this.offset.by },
        { x: this.offset.cx, y: this.offset.cy },
      ]);
    } else {
      this.transform = new Transform(0, 0, dimensions[2], dimensions[3]);
      this.width = this.transform.scale.x;
      this.height = this.transform.scale.y;
      
      if (this.shape === "circle" && this.width !== this.height) 
        this.shape = "ellipse";
      if (this.shape === "ellipse") 
        this.radius = [this.width/2, this.height/2];
      if (this.shape === "circle") 
        this.radius = this.width / 2;
    }
    this.rendering = {
      draw: {
        shape: true,
        texture: null,
        presets: [],
      },
      color: "#fffffff",
      visible: true,
      outline: [0.1, "#000000"],
      debug: {
        mode:'outline', //mdoes: shape, outline
        color: "#37ff29",
        center: true,
        velocity:true,
        outline: [0.1, '#700060']
      },
    };
    if (genricShape.shapes) genricShape.shapes.push(this);
    else genricShape.shapes = [this];
    this.push(this);
  }

  getWorldPosition() {
    return this.position();
  }

  getWorldTrianglePoints(err = 0) {
    if (this.shape !== "triangle") return null;
    const pos = this.getWorldPosition();
    
    if (!pos || isNaN(pos.x) || isNaN(pos.y)) {
      return null;
    }
    
    const p = this.offset;
    if (!p) return null;
    
    const parentRotation = this.parent ? this.parent.transform.rotation || 0 : 0;
  
    const cos = Math.cos(parentRotation);
    const sin = Math.sin(parentRotation);

    // Calculate expansion direction for each vertex (outward from triangle center)
    const points = [
      { x: p.ax || 0, y: p.ay || 0 },
      { x: p.bx || 0, y: p.by || 0 },
      { x: p.cx || 0, y: p.cy || 0 },
    ];
    
    // Calculate center of triangle for expansion direction
    const centerX = (points[0].x + points[1].x + points[2].x) / 3;
    const centerY = (points[0].y + points[1].y + points[2].y) / 3;
    
    // Expand each vertex outward from center
    const expandedPoints = points.map((pt) => {
      const dx = pt.x - centerX;
      const dy = pt.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return pt;
      const scale = (dist + err) / dist;
      return {
        x: centerX + dx * scale,
        y: centerY + dy * scale
      };
    });
  
    return expandedPoints.map((pt) => ({
      x: pos.x + (pt.x * cos - pt.y * sin),
      y: pos.y + (pt.x * sin + pt.y * cos),
    }));
  }

  updatePosition() {
    if (!this.parent) return;
    let worldPos = this.getWorldPosition();
    this.transform.position.x = worldPos.x;
    this.transform.position.y = worldPos.y;

    if (this.shape !== "triangle") {
      this.width = this.transform.scale.x;
      this.height = this.transform.scale.y;
      if (this.shape === "circle") {
        this.radius = this.width / 2;
      } else if (this.shape === "ellipse") {
        this.radius = [this.width / 2, this.height / 2];
      }
    }
  }

  setTrianglePoints(ax, ay, bx, by, cx, cy) {
    if (this.shape !== "triangle") return this;
    this.offset.ax = ax || this.offset.ax;
    this.offset.ay = ay || this.offset.ay;
    this.offset.bx = bx || this.offset.bx;
    this.offset.by = by || this.offset.by;
    this.offset.cx = cx || this.offset.cx;
    this.offset.cy = cy || this.offset.cy;
    return this;
  }

  setScale(x, y) {
    if (this.shape === "triangle") {
      console.warn("Triangles use vertex positions, not scale. Use setTrianglePoints() instead.");
      return this;
    }
    this._customScale = true;
    this.transform.scale.x = x;
    this.transform.scale.y = y || x;
    this.width = this.transform.scale.x;
    this.height = this.transform.scale.y;
    return this;
  }

  setScaleMultiplier(multiplier) {
    if (this.shape === "triangle") {
      console.warn("Triangles use vertex positions, not scale. Use setTrianglePoints() instead.");
      return this;
    }
    this.scaleMultiplier = multiplier;
    this._customScale = false;
    return this;
  }

  delete() {
    this.deleted = true;
    let idx = Hitbox.objects.indexOf(this);
    if (idx > -1) Hitbox.objects.splice(idx, 1);
    this.remove(this);
  }

  download() {
    let r = {
      cl: Object.values(this.collision),
      tr: {
        p: this.transform.position,
        s: this.shape === "triangle" ? null : this.transform.scale,
        r: this.transform.rotation,
      },
      s: this.shape,
    };
    return `genericShape:${this.id}|${JSON.stringify(r)}`;
  }

  getTriangleVertices(err = 0) {
    if (this.shape !== "triangle") return null;
    return this.getWorldTrianglePoints(err);
  }

  classifyTriangleVertices(pts) {
    let apex = 0;
    for (let i = 1; i < 3; i++) {
      if (pts[i].y < pts[apex].y) apex = i;
    }
    const rest = [0, 1, 2].filter((i) => i !== apex);
    let [left, right] = rest;
    if (pts[left].x > pts[right].x) {
      [left, right] = [right, left];
    }
    return { apex, left, right };
  }

  getRectangleVertices(err = 0) {
    if (this.shape === "triangle") return null;
    const pos = this.getWorldPosition();
    
    if (!pos || isNaN(pos.x) || isNaN(pos.y)) {
      return null;
    }
    
    const w = this.transform.width || this.transform.scale.x || 20;
    const h = this.transform.height || this.transform.scale.y || 20;
    const rotation = this.transform.rotation || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
  
    const corners = [
      { x: -(w + err) / 2, y: -(h + err) / 2 },
      { x: (w + err) / 2, y: -(h + err) / 2 },
      { x: (w + err) / 2, y: (h + err) / 2 },
      { x: -(w + err) / 2, y: (h + err) / 2 },
    ];
  
    return corners.map((c) => ({
      x: pos.x + c.x * cos - c.y * sin,
      y: pos.y + c.x * sin + c.y * cos,
    }));
  }

  sign(px, py, x1, y1, x2, y2) {
    return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  }

  render() {
    if (!this.active) return;
    var pos = this.transform.position;
    var scale = this.transform.scale;
    var vel = this.transform.velocity;
    var renderer = this.rendering;
    var settings = renderer.draw;

    if (renderer.visible) {
      push();
      fill(renderer.color);
      translate(pos.x, pos.y);
      if (Array.isArray(renderer.outline)) {
        stroke(renderer.outline[1]);
        strokeWeight(renderer.outline[0]);
      } else noStroke();

      switch (settings.shape) {
          case "rect":
          case "rectangle":
            rectMode(CENTER);
            rect(0, 0, scale.x, scale.y);
            break;
          case "triangle":
            triangle(
              pos.ax || -scale.x / 2,
              pos.ay || scale.y / 2,
              pos.bx || 0,
              pos.by || -scale.y / 2,
              pos.cx || scale.x / 2,
              pos.cy || scale.y / 2
            );
            break;
          case "circle":
          case "ellipse":
            ellipse(0, 0, scale.x, scale.y);
            break;
        }

      if (settings.hitbox && this.hitbox) {
        this.hitbox.forEach((hb) => {
          noFill();
          stroke("red");
          strokeWeight(1);
          let hbPos = hb.getWorldPosition();
          let hbScale = hb.transform.scale;
          switch (hb.shape) {
            case "rect":
            case "rectangle":
              rectMode(CENTER);
              rect(hbPos.x - pos.x, hbPos.y - pos.y, hbScale.x, hbScale.y);
              break;
            case "circle":
            case "ellipse":
              ellipse(hbPos.x - pos.x, hbPos.y - pos.y, hbScale.x, hbScale.y);
              break;
            case "triangle":
              let verts = hb.getTriangleVertices();
              if (verts) {
                triangle(
                  verts[0].x - pos.x,
                  verts[0].y - pos.y,
                  verts[1].x - pos.x,
                  verts[1].y - pos.y,
                  verts[2].x - pos.x,
                  verts[2].y - pos.y
                );
              }
              break;
          }
        });
      }

      pop();
    }

    // Debug rendering
    if (renderer.debug) {
      let d = renderer.debug;
      let sides = this.collision.sides;

      

      if (d.velocity) {
        let pos = this.transform.position;
        let vel = this.transform.velocity;

        push();
        translate(pos.x, pos.y);

        push();
        stroke("purple");
        strokeWeight(2);
        let velMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        let minLength = 4;
        let maxLength = 50;
        let arrowSize = 3;
        let arrowAngle = 0.25;
        if (velMag > 0.01) {
          let angle = Math.atan2(vel.y, vel.x);
          let logScale = Math.log(1 + velMag) / Math.log(1 + 100);
          let len = minLength + (maxLength - minLength) * logScale;
          let endX = Math.cos(angle) * len;
          let endY = Math.sin(angle) * len;

          line(0, 0, endX, endY);
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle)
          );
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle)
          );

          noStroke();
          fill("purple");
          textSize(11);
          let label = "v: " + velMag.toFixed(1) + " px/s";
          text(label, endX + 5, endY - 5);
        }
        pop();

        push();
        stroke("cyan");
        strokeWeight(2);
        let trueVelMag = Math.sqrt(
          vel.self.x * vel.self.x + vel.self.y * vel.self.y
        );
        if (trueVelMag > 0.01) {
          let angle = Math.atan2(vel.self.y, vel.self.x);
          let logScale = Math.log(1 + trueVelMag) / Math.log(1 + 100);
          let len =
            minLength * 1.5 + (maxLength * 1.5 - minLength * 1.5) * logScale;
          let endX = Math.cos(angle) * len;
          let endY = Math.sin(angle) * len;

          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle)
          );
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle)
          );

          noStroke();
          fill("green");
          textSize(11);
        }
        pop();

        pop();
      }
    }
  }
  
}

class gameObject extends geometryObject {
  static init() {
    if (gameObject.started) return;
    gameObject.objects = [];
    gameObject.started = true;
  }
  
  constructor(x, y, w, h, ...scenes) {
    super();
    gameObject.init();
    this.id = "MALE:UIpanal[" + Math.random().toString(36).substring(2) + "]";
    this.superId = this.id;
    this.deleted = false;
    this.transform = new Transform(x, y, w, h);
    
    this.x = x;
    this.y = y;

    //this.hitbox = [];
    //var defaultHitbox = new Hitbox(this.id, "rect", 0, 0, w, h);
    //defaultHitbox.setParent(this);
    //this.hitbox.push(defaultHitbox);

    this.renders = [];
    
    this.scripts = [];
    this.scenes = scenes.length < 1 ? ["blank"] : scenes;
    
    
    this.rendering = {
      draw: {
        shape: false,
        shape: "rect",
        texture: null,
        presets: [],
      },
      color: "white",
      visible: true,
      outline: [0.1, 0 || "black"],
      debug: {
        color: "#37ff29",
        center: true,
        grounded: true,
        velocity: true,
      },
    };

    this.previousPosition = { x: x || 0, y: y || 0 };
    this._subStepCount = 0;

    if (gameObject.objects) gameObject.objects.push(this);
    else gameObject.objects = [this];
    this._index = gameObject.objects.length - 1;
    this.push(this);
  }

  addHitbox(shape, ...params) {
    let hb;
    if (shape === "triangle") {
      hb = new Hitbox(this.id, shape, ...params);
    } else {
      hb = new Hitbox(
        this.id,
        shape,
        params[0] || 0,
        params[1] || 0,
        params[2] || 20,
        params[3] || 20
      );
    }
    hb.setParent(this);
    this.hitbox.push(hb);
    return hb;
  }

  delete() {
    this.deleted = true;
    let idx = gameObject.objects.indexOf(this);
    if (idx > -1) gameObject.objects.splice(idx, 1);
    this.remove(this);
    if (typeof Scene !== 'undefined' && Scene.scenes) {
      Scene.scenes.forEach((scene) => {
        let idx2 = scene.objects.indexOf(this);
        if (idx2 > -1) scene.objects.splice(idx2, 1);
      });
    }
    this.hitbox.forEach((hb) => hb.delete());
  }

  getParentScene() {
    if (typeof Scene === 'undefined') return;
    let s = Scene.getScene();
    if (s && s.objects.includes(this)) return s;
    else return Scene.getScene("blank");
  }

  updateParentScene() {
    if (typeof Scene === 'undefined') return;
    let s = Scene.getScene();
    if (!s || !this.scenes.includes(s.id)) s = Scene.getScene("blank");

    if (!s.objects.includes(this)) {
      s.objects.push(this);
    } else {
      let idx = s.objects.indexOf(this);
      if (idx > -1) s.objects[idx] = this;
    }

    Scene.scenes.forEach((scene) => {
      if (!this.scenes.includes(scene.id) && scene.objects.includes(this)) {
        let idx = scene.objects.indexOf(this);
        if (idx > -1) scene.objects.splice(idx, 1);
      }
    });

    return s;
  }

  update(deltaTime = 1 / 60) {
    if (this.deleted) return;
    this.id = this.superId;
    let pos = this.transform.position;
    let scale = this.transform.scale;
    let vel = this.transform.velocity;

    // Validate current position
    if (isNaN(pos.x) || isNaN(pos.y)) {
      console.warn(`Invalid position detected for object ${this.id}, resetting to last known position`);
      pos.x = this.previousPosition.x || 0;
      pos.y = this.previousPosition.y || 0;
      return;
    }

    this.previousPosition = { x: pos.x, y: pos.y };
    this._wasGrounded = this.grounded;
    
    // Reset grounded state - will be set in collision processing
    if (!this.collision.static) {
      this.grounded = false;
      if(!this.grounded)this.groundedOn = null;
    } else {
      this.grounded = true;
      this.groundedOn = null;
    }
    

    this.x = pos.x;
    this.y = pos.y;
    this.width = scale.x;
    this.height = scale.y;

    if (this.groundedOn instanceof gameObject) {
      vel.inherited = this.groundedOn.transform.velocity.self;
    }

    vel.self.x = vel.x + (vel.inherited?.x || 0);
    vel.self.y = vel.y + (vel.inherited?.y || 0);

    // Clamp velocity
    let maxSpeed = 3000;
    let currentSpeed = Math.sqrt(vel.self.x * vel.self.x + vel.self.y * vel.self.y);
    if (currentSpeed > maxSpeed) {
      let scaleFactor = maxSpeed / currentSpeed;
      vel.self.x *= scaleFactor;
      vel.self.y *= scaleFactor;
      vel.x *= scaleFactor;
      vel.y *= scaleFactor;
    }

    let move = {
      x: (vel.self.x || 0) * deltaTime * 10,
      y: (vel.self.y || 0) * deltaTime * 10,
    };

    // Sub-step movement
    let subSteps = 1;
    let maxStepSize = 20;
    let totalDist = Math.sqrt(move.x * move.x + move.y * move.y);
    if (totalDist > maxStepSize) {
      subSteps = Math.ceil(totalDist / maxStepSize);
    }
    subSteps = Math.min(subSteps, 10);

    let subMove = {
      x: move.x / subSteps,
      y: move.y / subSteps
    };

    this._subStepCount = subSteps;

    // Process each sub-step
    for (let step = 0; step < subSteps; step++) {
      // Move
      pos.x += subMove.x;
      pos.y += subMove.y;

      if (isNaN(pos.x) || isNaN(pos.y)) {
        console.warn(`Position became NaN for object ${this.id}, reverting to previous position`);
        pos.x = this.previousPosition.x || 0;
        pos.y = this.previousPosition.y || 0;
        return;
      }

      // Update hitboxes
      this.hitbox.forEach((hb) => {
        hb.updatePosition();
        hb.width = hb.transform.scale.x || 20;
        hb.height = hb.transform.scale.y || 20;
      });

      // Process all collisions in one pass
      this.processCollisions();
    }

    // Apply gravity
    if (this.physicsToggles.gravity) {
      if (this.grounded) {
        vel.y = 0;
        this.lastGrounded = typeof World !== 'undefined' ? World.time : Date.now() / 1000;
      } else {
        const gravity = (typeof World !== 'undefined' && World.defaults?.gameObject?.gravity) || 500;
        const terminalVelocity = (typeof World !== 'undefined' && World.defaults?.gameObject?.terminalVelocity) || 2000;
        vel.y = Math.min((vel.y || 0) + gravity * deltaTime, terminalVelocity);
      }
    }

    if (this.physicsToggles.friction) {
      if (!this.grounded) {
        vel.x *= 0.99;
        if (Math.abs(vel.x) < 0.01) vel.x = 0;
      } else {
        const fps = typeof window !== 'undefined' ? window.fps || 60 : 60;
        vel.x *= Math.pow(1 - (1 - this.friction) * 1.5, deltaTime * fps);
        if (Math.abs(vel.x) < 0.01) vel.x = 0;
        if (vel.y < 0) vel.y = 0;
      }
    }

    if (Math.abs(vel.x) < 0.0001) vel.x = 0;
    if (Math.abs(vel.y) < 0.0001) vel.y = 0;

    let idx = gameObject.objects.indexOf(this);
    if (idx > -1) gameObject.objects[idx] = this;
    else gameObject.objects.push(this);

    this.updateParentScene();
  }

  // Combined collision detection and resolution in one pass
  processCollisions() {
    let scene = this.getParentScene();
    if (!scene) return;

    // Reset collision sides
    this.colliding = false;
    this.collisions = [];
    
    Object.keys(this.collision.sides).forEach((k) => {
      this.collision.sides[k] = false;
    });

    this.hitbox.forEach((hb) => {
      Object.keys(hb.collision.sides).forEach((k) => {
        hb.collision.sides[k] = false;
      });
    });

    // Track grounded state
    let foundGround = false;
    let groundObject = null;
    let groundHitbox = null;
    let groundDistance = Infinity;

    // Update all hitboxes
    this.hitbox.forEach((hb) => hb.updatePosition());

    // Find the lowest hitbox for grounded detection
    let lowestHitbox = null;
    let lowestY = -Infinity;
    let lowestHitboxIndex = -1;

    this.hitbox.forEach((hb, index) => {
      let bounds = hb.bounds();
      if (bounds.bottom > lowestY) {
        lowestY = bounds.bottom;
        lowestHitbox = hb;
        lowestHitboxIndex = index;
      }
    });

    // First pass: Detect all collisions
    let collisions = [];

    scene.objects.forEach((other) => {
      if (other.id === this.id || other.deleted || !other.active) return;
      if (!other.collision || !other.collision.enabled) return;
      if (!this.collision.enabled) return;

      other.hitbox.forEach((hb) => hb.updatePosition());

      this.hitbox.forEach((thisHitbox, index) => {
        if (!thisHitbox.collision || !thisHitbox.collision.enabled) return;

        other.hitbox.forEach((otherHitbox) => {
          if (!otherHitbox.collision || !otherHitbox.collision.enabled) return;

          // Check collision with error margin for detection
          if (thisHitbox.collidesWith(otherHitbox, 1.0)) {
            // Store collision info
            collisions.push({
              thisHitbox: thisHitbox,
              otherHitbox: otherHitbox,
              other: other,
              index: index
            });

            // Update collision sides
            let sides = thisHitbox.getCollisionSides();
            
            sides.forEach((side) => {
              if (thisHitbox.collision.sides.hasOwnProperty(side)) {
                thisHitbox.collision.sides[side] = true;
              }
            });

            sides.forEach((side) => {
              if (this.collision.sides.hasOwnProperty(side)) {
                this.collision.sides[side] = true;
              }
            });

            if (sides.includes("embedded")) {
              this.collision.sides.embedded = true;
            }

            // Check for grounded state - only for bottom of lowest hitbox
            if (index === lowestHitboxIndex && sides.includes("bottom")) {
              //Is object solid? can it be grounded?
              if(this.collision.solid){
                //if the other object grounded?
                if(other.grounded){
                  this.grounded = true;
                  this.groundedOn = other;
                }else{
                  this.grounded = false;
                  this.groundedOn = null;
                }
              }

            }
          }
        });
      });
    });

    // Set grounded state with stability
    // if (foundGround) {
    //   if (!this.grounded) {
    //     this._groundedFrames = 0;
    //   }
    //   this.grounded = true;
    //   this.groundedOn = groundObject;
    //   this._groundedFrames++;
    // } else {
    //   this._groundedFrames = 0;
    //   this.grounded = false;
    //   this.groundedOn = null;
    // }

    // Second pass: Resolve actual collisions (no error margin)
    // Only resolve if object is moving
    let vel = this.transform.velocity;
    if (Math.abs(vel.x) > 0.01 || Math.abs(vel.y) > 0.01 || this.collision.solid) {
      
      // Process each collision
      for (let i = 0; i < collisions.length; i++) {
        let coll = collisions[i];
        let thisHitbox = coll.thisHitbox;
        let otherHitbox = coll.otherHitbox;
        let other = coll.other;

        // Check for actual collision (no error margin)
        if (thisHitbox.collidesWith(otherHitbox, 0)) {
          // Resolve if solid
          if (this.collision.solid || other.collision.solid) {
            this.resolveCollision(other, thisHitbox, otherHitbox);
          }
        }
      }
    }
  }

  setGravityObject(n = true) {
    this.collision.static = !n;
    this.collision.solid = n;
    this.physicsToggles.gravity = n;
    this.physicsToggles.friction = n;
  }

  setStaticObject(n = true) {
    this.collision.static = n;
    this.physicsToggles.gravity = !n;
    this.physicsToggles.friction = !n;
  }

  setImmovableObject(n = true) {
    this.collision.static = n;
    this.collision.pushable = !n;
    this.physicsToggles.gravity = !n;
    this.physicsToggles.friction = !n;
  }

  resolveCollision(other, thisHitbox, otherHitbox) {
    let thisBounds = thisHitbox.bounds();
    let otherBounds = otherHitbox.bounds();
    let pos = this.transform.position;
    let otherPos = other.transform.position;
    let vel = this.transform.velocity;
    let otherVel = other.transform.velocity;

    // Validate positions
    if (isNaN(pos.x) || isNaN(pos.y)) {
      pos.x = this.previousPosition?.x || 0;
      pos.y = this.previousPosition?.y || 0;
      return;
    }

    if (isNaN(otherPos.x) || isNaN(otherPos.y)) {
      otherPos.x = other.previousPosition?.x || 0;
      otherPos.y = other.previousPosition?.y || 0;
      return;
    }

    // Get collision sides
    let sides = thisHitbox.getCollisionSides();
    let otherSides = otherHitbox.getCollisionSides();

    // Calculate overlaps
    let overlapX = Math.min(
      thisBounds.right - otherBounds.left,
      otherBounds.right - thisBounds.left
    );
    let overlapY = Math.min(
      thisBounds.bottom - otherBounds.top,
      otherBounds.bottom - thisBounds.top
    );

    // Determine movement direction
    let movingRight = vel.x > 0;
    let movingLeft = vel.x < 0;
    let movingDown = vel.y > 0;
    let movingUp = vel.y < 0;

    // Store original velocities for impulse
    let origVelX = vel.x;
    let origVelY = vel.y;

    // Handle embedded collision
    if (sides.includes("embedded") || otherSides.includes("embedded")) {
      if (overlapX < overlapY) {
        let dir = pos.x < otherPos.x ? -1 : 1;
        if (this.collision.pushable && !this.collision.static) {
          pos.x += overlapX * dir;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.x -= overlapX * dir * 0.3;
        }
        vel.x = 0;
      } else {
        let dir = pos.y < otherPos.y ? -1 : 1;
        if (this.collision.pushable && !this.collision.static) {
          pos.y += overlapY * dir;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.y -= overlapY * dir * 0.3;
        }
        vel.y = 0;
      }
      
      this.hitbox.forEach((hb) => hb.updatePosition());
      other.hitbox.forEach((hb) => hb.updatePosition());
      return;
    }

    // Determine which axis to resolve based on velocity and overlap
    let resolveHorizontal = Math.abs(vel.x) > Math.abs(vel.y);
    let resolveVertical = true;

    // Horizontal resolution
    if (resolveHorizontal) {
      if ((otherSides.includes("right") || sides.includes("left")) && movingLeft) {
        // Snap to surface
        if (this.collision.pushable && !this.collision.static) {
          pos.x = otherBounds.left - thisBounds.width;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.x += overlapX * 0.3;
        }
        
        if (!this.collision.pushable || this.collision.static) {
          vel.x = 0;
        } else if (!this.collision.static) {
          let impulse = Math.abs(origVelX) * this.bounciness;
          vel.x = impulse;
          if (other.collision.pushable && !other.collision.static) {
            otherVel.x -= origVelX * this.bounce * 0.3;
          }
        }
      } else if ((otherSides.includes("left") || sides.includes("right")) && movingRight) {
        if (this.collision.pushable && !this.collision.static) {
          pos.x = otherBounds.right;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.x -= overlapX * 0.3;
        }
        
        if (!this.collision.pushable || this.collision.static) {
          vel.x = 0;
        } else if (!this.collision.static) {
          let impulse = Math.abs(origVelX) * this.bounciness;
          vel.x = -impulse;
          if (other.collision.pushable && !other.collision.static) {
            otherVel.x += origVelX * this.bounce * 0.3;
          }
        }
      }
    }

    // Vertical resolution
    if (resolveVertical) {
      if ((otherSides.includes("bottom") || sides.includes("top")) && movingUp) {
        if (this.collision.pushable && !this.collision.static) {
          pos.y = otherBounds.top + thisBounds.height;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.y += overlapY * 0.3;
        }
        
        if (!this.collision.pushable || this.collision.static) {
          vel.y = 0;
        } else if (!this.collision.static) {
          let impulse = Math.abs(origVelY) * this.bounciness;
          vel.y = impulse;
          if (other.collision.pushable && !other.collision.static) {
            otherVel.y -= origVelY * this.bounce * 0.3;
          }
        }
      } else if ((otherSides.includes("top") || sides.includes("bottom")) && movingDown) {
        // Snap to surface - this is where grounded happens
        if (this.collision.pushable && !this.collision.static) {
          pos.y = otherBounds.top - thisBounds.height;
        }
        if (other.collision.pushable && !other.collision.static) {
          otherPos.y -= overlapY * 0.3;
        }
        
        if (!this.collision.pushable || this.collision.static) {
          vel.y = 0;
        } else if (!this.collision.static) {
          let impulse = Math.abs(origVelY) * this.bounciness;
          vel.y = -impulse;
          if (other.collision.pushable && !other.collision.static) {
            otherVel.y += origVelY * this.bounce * 0.3;
          }
        }
        
        // Set grounded state when landing
        if (sides.includes("bottom") || otherSides.includes("top")) {
          this.grounded = true;
          this.groundedOn = other;
          vel.y = 0;
        }
      }
    }

    // Fallback: If still overlapping after resolution
    thisBounds = thisHitbox.bounds();
    otherBounds = otherHitbox.bounds();
    let stillOverlapX = Math.min(
      thisBounds.right - otherBounds.left,
      otherBounds.right - thisBounds.left
    );
    let stillOverlapY = Math.min(
      thisBounds.bottom - otherBounds.top,
      otherBounds.bottom - thisBounds.top
    );

    if (stillOverlapX > 0 && stillOverlapY > 0) {
      // Force separation based on velocity priority
      if (Math.abs(vel.x) > Math.abs(vel.y)) {
        if (movingLeft) {
          pos.x = otherBounds.left - thisBounds.width;
        } else if (movingRight) {
          pos.x = otherBounds.right;
        }
        vel.x = 0;
      } else {
        if (movingUp) {
          pos.y = otherBounds.top + thisBounds.height;
        } else if (movingDown) {
          pos.y = otherBounds.top - thisBounds.height;
          this.grounded = true;
          this.groundedOn = other;
        }
        vel.y = 0;
      }
    }

    // Update hitbox positions
    this.hitbox.forEach((hb) => hb.updatePosition());
    other.hitbox.forEach((hb) => hb.updatePosition());

    // Final position validation
    if (isNaN(pos.x) || isNaN(pos.y)) {
      pos.x = this.previousPosition?.x || 0;
      pos.y = this.previousPosition?.y || 0;
    }
    if (isNaN(otherPos.x) || isNaN(otherPos.y)) {
      otherPos.x = other.previousPosition?.x || 0;
      otherPos.y = other.previousPosition?.y || 0;
    }
  }

  setVelocity(speed, angle = this.transform.rotation) {
    let vel = this.transform.velocity;
    let angleRad = angle;
    if (this.transform.rotationMode === "degrees") {
      angleRad = (angle * Math.PI) / 180;
    }
    vel.x = speed * Math.cos(angleRad);
    vel.y = speed * Math.sin(angleRad);
    //return this;
  }

  addVelocity(speed, angle = this.transform.rotation) {
    let vel = this.transform.velocity;
    let angleRad = angle;
    if (this.transform.rotationMode === "degrees") {
      angleRad = (angle * Math.PI) / 180;
    }
    vel.x += speed * Math.cos(angleRad);
    vel.y += speed * Math.sin(angleRad);
    //return this;
  }

  

  getSpeed() {
    let vel = this.transform.velocity;
    return Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  }

  getVelocityAngle() {
    let vel = this.transform.velocity;
    let angle = Math.atan2(vel.y, vel.x);
    if (this.transform.rotationMode === "degrees") {
      angle = (angle * 180) / Math.PI;
    }
    return angle;
  }

  sides(side) {
    if (!side) return this.collision.sides;
    let sides = this.collision.sides;
    switch (side) {
      case "left": return sides.left;
      case "right": return sides.right;
      case "top": return sides.top;
      case "bottom": return sides.bottom;
      case "embedded": return sides.embedded;
      case "all": {
        let all = [];
        let end = false;
        Object.keys(sides).forEach((k) => {
          if (end) return;
          let s = sides[k];
          if (k == "embedded" && s) {
            all = [true];
            end = true;
          } else if (k != "embedded") all.push(s);
        });
        return all.every((l) => l);
      }
    }
  }

  handleMovement(movement) {}

  setCollision(e = this.collision.enabled, st = this.collision.static, pu = this.collision.pushable, so = this.collision.solid) {
    this.hitbox.forEach((hitbox) => {
      hitbox.collision.enabled = e;
      hitbox.collision.static = st;
      hitbox.collision.pushable = pu;
      hitbox.collision.solid = so;
    });
  }

  render() {
    if (!this.active) return;
    var pos = this.transform.position;
    var scale = this.transform.scale;
    var vel = this.transform.velocity;
    var renderer = this.rendering;
    var settings = renderer.draw;

    if (renderer.visible) {
      push();
      fill(renderer.color);
      translate(pos.x, pos.y);
      if (Array.isArray(renderer.outline)) {
        stroke(renderer.outline[1]);
        strokeWeight(renderer.outline[0]);
      } else noStroke();

      if (!settings.hitbox && !settings.texture) {
        switch (settings.shape) {
          case "rect":
          case "rectangle":
            rectMode(CENTER);
            rect(0, 0, scale.x, scale.y);
            break;
          case "triangle":
            triangle(
              pos.ax || -scale.x / 2,
              pos.ay || scale.y / 2,
              pos.bx || 0,
              pos.by || -scale.y / 2,
              pos.cx || scale.x / 2,
              pos.cy || scale.y / 2
            );
            break;
          case "circle":
          case "ellipse":
            ellipse(0, 0, scale.x, scale.y);
            break;
        }
      }

      if (settings.hitbox && this.hitbox) {
        this.hitbox.forEach((hb) => {
          noFill();
          stroke("red");
          strokeWeight(1);
          let hbPos = hb.getWorldPosition();
          let hbScale = hb.transform.scale;
          switch (hb.shape) {
            case "rect":
            case "rectangle":
              rectMode(CENTER);
              rect(hbPos.x - pos.x, hbPos.y - pos.y, hbScale.x, hbScale.y);
              break;
            case "circle":
            case "ellipse":
              ellipse(hbPos.x - pos.x, hbPos.y - pos.y, hbScale.x, hbScale.y);
              break;
            case "triangle":
              let verts = hb.getTriangleVertices();
              if (verts) {
                triangle(
                  verts[0].x - pos.x,
                  verts[0].y - pos.y,
                  verts[1].x - pos.x,
                  verts[1].y - pos.y,
                  verts[2].x - pos.x,
                  verts[2].y - pos.y
                );
              }
              break;
          }
        });
      }

      pop();
    }

    // Debug rendering
    if (renderer.debug) {
      let d = renderer.debug;
      let sides = this.collision.sides;

      this.hitbox.forEach((hb, index) => {
        push();
        let hbPos = hb.getWorldPosition();
        let hbScale = hb.transform.scale;
        let hbSides = hb.collision.sides;
        if (hbSides.embedded) stroke("#00b3ff");
        else if (d.color) stroke(d.color);
        else stroke("yellow");
        noFill();
        strokeWeight(1.5);
        translate(hbPos.x, hbPos.y);

        switch (hb.shape) {
          case "rect":
          case "rectangle":
            rect(0, 0, hbScale.x, hbScale.y);
            break;
          case "triangle":
            let verts = hb.getTriangleVertices();
            if (verts) {
              triangle(
                verts[0].x - hbPos.x,
                verts[0].y - hbPos.y,
                verts[1].x - hbPos.x,
                verts[1].y - hbPos.y,
                verts[2].x - hbPos.x,
                verts[2].y - hbPos.y
              );
            }
            break;
          case "circle":
          case "ellipse":
            ellipse(0, 0, hbScale.x, hbScale.y);
            break;
        }

        if (d.center) {
          stroke("red");
          strokeWeight(2);
          point(0, 0);
        }

        if (d.grounded && index === 0 && !this.collision.static) {
          push();
          noStroke();
          fill(this.grounded ? "#ff0000" : "#fff700");
          let size = hb.shape === "triangle" ? 20 : hbScale.x;
          rectMode(CENTER);
          rect(
            0,
            hb.shape === "triangle" ? 20 : hbScale.y / 2 + hbScale.y * 0.125,
            size || 20,
            4
          );
          pop();
        }

        if (hb.shape === "triangle") {
          let verts = hb.getTriangleVertices();
          let triSides = {
            left: [verts[0], verts[2]],
            right: [verts[1], verts[2]],
            bottom: [verts[0], verts[1]],
          };
          if (verts) {
            if (hbSides.left) {
              push();
              stroke("#f570ff");
              strokeWeight(2);
              translate(
                -this.position().x - hb.offset.x,
                -this.position().y - hb.offset.y
              );
              line(
                triSides.left[0].x,
                triSides.left[0].y,
                triSides.left[1].x,
                triSides.left[1].y
              );
              pop();
            }

            if (hbSides.right) {
              push();
              stroke("#f570ff");
              strokeWeight(2);
              translate(
                -this.position().x - hb.offset.x,
                -this.position().y - hb.offset.y
              );
              line(
                triSides.right[0].x,
                triSides.right[0].y,
                triSides.right[1].x,
                triSides.right[1].y
              );
              pop();
            }

            if (hbSides.bottom) {
              push();
              stroke("#f570ff");
              strokeWeight(2);
              translate(
                -this.position().x - hb.offset.x,
                -this.position().y - hb.offset.y
              );
              line(
                triSides.bottom[0].x,
                triSides.bottom[0].y,
                triSides.bottom[1].x,
                triSides.bottom[1].y
              );
              pop();
            }

            if (hbSides.embedded) {
              push();
              stroke("#00b3ff");
              strokeWeight(2);
              let centerX =
                (verts[0].x + verts[1].x + verts[2].x) / 3 - hbPos.x;
              let centerY =
                (verts[0].y + verts[1].y + verts[2].y) / 3 - hbPos.y;
              let size = 6;
              line(centerX - size, centerY, centerX + size, centerY);
              line(centerX, centerY - size, centerX, centerY + size);
              pop();
            }
          }
        } else if (hb.shape == 'circle' || hb.shape == 'ellipse') {
          if (hbSides.self) {
            push();
            stroke("#f570ff");
            strokeWeight(2);
            ellipse(0, 0, hbScale.x, hbScale.y);
            stroke('red');
            if (hbSides.arc) arc(0, 0, hb.width, hb.height, hbSides.arc.start * TWO_PI, hbSides.arc.end * TWO_PI);
            pop();
          }
          if (hbSides.embedded) {
            push();
            stroke("#00b3ff");
            strokeWeight(2);
            let size = 6;
            line(0 - size, 0, 0 + size, 0);
            line(0, 0 - size, 0, 0 + size);
            pop();
          }
        } else {
          if (hbSides.top) {
            push();
            stroke("#f570ff");
            strokeWeight(2);
            line(-hbScale.x / 2, -hbScale.y / 2, hbScale.x / 2, -hbScale.y / 2);
            pop();
          }
          if (hbSides.bottom) {
            push();
            stroke("#f570ff");
            strokeWeight(2);
            line(-hbScale.x / 2, hbScale.y / 2, hbScale.x / 2, hbScale.y / 2);
            pop();
          }
          if (hbSides.left) {
            push();
            stroke("#f570ff");
            strokeWeight(2);
            line(-hbScale.x / 2, -hbScale.y / 2, -hbScale.x / 2, hbScale.y / 2);
            pop();
          }
          if (hbSides.right) {
            push();
            stroke("#f570ff");
            strokeWeight(2);
            line(hbScale.x / 2, -hbScale.y / 2, hbScale.x / 2, hbScale.y / 2);
            pop();
          }
          if (hbSides.embedded) {
            push();
            stroke("#00b3ff");
            strokeWeight(2);
            let size = 6;
            line(0 - size, 0, 0 + size, 0);
            line(0, 0 - size, 0, 0 + size);
            pop();
          }
        }

        pop();
      });

      if (d.velocity) {
        let pos = this.transform.position;
        let vel = this.transform.velocity;

        push();
        translate(pos.x, pos.y);

        push();
        stroke("purple");
        strokeWeight(2);
        let velMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        let minLength = 4;
        let maxLength = 50;
        let arrowSize = 3;
        let arrowAngle = 0.25;
        if (velMag > 0.01) {
          let angle = Math.atan2(vel.y, vel.x);
          let logScale = Math.log(1 + velMag) / Math.log(1 + 100);
          let len = minLength + (maxLength - minLength) * logScale;
          let endX = Math.cos(angle) * len;
          let endY = Math.sin(angle) * len;

          line(0, 0, endX, endY);
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle)
          );
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle)
          );

          noStroke();
          fill("purple");
          textSize(11);
          let label = "v: " + velMag.toFixed(1) + " px/s";
          text(label, endX + 5, endY - 5);
        }
        pop();

        push();
        stroke("cyan");
        strokeWeight(2);
        let trueVelMag = Math.sqrt(
          vel.self.x * vel.self.x + vel.self.y * vel.self.y
        );
        if (trueVelMag > 0.01) {
          let angle = Math.atan2(vel.self.y, vel.self.x);
          let logScale = Math.log(1 + trueVelMag) / Math.log(1 + 100);
          let len =
            minLength * 1.5 + (maxLength * 1.5 - minLength * 1.5) * logScale;
          let endX = Math.cos(angle) * len;
          let endY = Math.sin(angle) * len;

          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle)
          );
          line(
            endX,
            endY,
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle)
          );

          noStroke();
          fill("green");
          textSize(11);
        }
        pop();

        pop();
      }
    }
  }

  download(includeScriptPackage = false) {
    let r = {
      trs: {
        p: this.transform.position,
        s: this.transform.scale,
        r: this.transform.rotation,
      },
      cl: [...Object.values(this.collision)],
      ht: [],
      scr: "excluded",
    };
    r.cl[4] = [...Object.values(r.cl[4])];
    this.hitbox.forEach((ht) => r.ht.push(ht.download()));
    if (includeScriptPackage) {
      r.scr = [];
      this.scripts.forEach((exe) => {
        let t = exe + "";
        t = t.replace(/\s/gi, "");
        r.scr.push(t);
      });
      console.warn("Warning! Script Packages are space reduced to save space but may be difficult to read.");
    }
    return "gameObject:" + JSON.stringify(r);
  }
}







static Packages = {
        living:()=>{
            let pck = {health:100,
                shield:{
                    max:100,
                    value:0,
                    protection:0.1,
                    decay:0.12,
                }
            }
            pck.damage = (n)=>{
                if(pck.shield.value > 0){
                    if(pck.shield.value - n*(1+pck.shield.decay) >= 0){
                        pck.shield.value -= Number(pad(n*(1+pck.shield.decay),1,2));
                        pck.health -= Number(pad(n*(1-pck.shield.protection),1,2));
                    }else{
                        //total damage - damage needed to break shield * damage taken with shield up
                        let total = (pck.shield.value/(1+pck.shield.decay))*(1-pck.shield.protection);
                        pck.shield.value = 0;
                        pck.health -= Number(pad(total,1,2));
                        pck.health = Number(pad(pck.health,1,2));
                    }
                }else{
                    pck.health -= n;
                }
                return {
                    health:pck.health,
                    shield:pck.shield.value,
                };
            }
            return pck;
        },
        speed:()=>{
            return {
                    speed:{
                    max:10,
                    sprint:15,
                },
                jumpHeight:self => -self.transform.size().y
            }
        },
        sprint:()=>{
            let pck = {
                max:100,
                value:100,
                consume:1, //charge lost per second
                charge:{
                    time:1.5, //seconds
                    value:5, //charge per second
                },
            };
            var time = 0;
            pck.run = (input)=>{
                const curr = new Date().getTime();
                pck.value = limit(pck.value, 0, pck.max);
                if(getInput(input)){
                    pck.value -= pck.consume/World.tickLength;
                    time = curr;
                }
                if(time + pck.charge.time*1000 <= curr){
                    pck.value += pck.charge.value/World.tickLength;
                }
            }
            return pck;
        },
    };




