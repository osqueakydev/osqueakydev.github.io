// ============================================================
// inputs.js
// ------------------------------------------------------------
// Mouse, Keyboard, _Controller input containers plus the
// getInput() string-based input resolver and KeyboardStick.
// All polling methods are tick-gated (see World.updateTick).
// ============================================================

// ============================================
// MOUSE
// ============================================
// Tracks raw position, pressed buttons, drag deltas, wheel
// deltas, and click/double-click state. Polling methods only
// report during a game tick.
class Mouse {
    static init() {
        if (Mouse.started) return;
        Mouse.started = true;
        Mouse.mice = 0;
    }

    constructor() {
        Mouse.init();
        if (Mouse.mice >= 1) {
            new Message("MouseError: Can only create 1 mouse container!");
            return;
        }
        Mouse.mice += 1;

        this.x = 0;
        this.y = 0;

        this.pressed = false;
        this.button = null;
        this.clicked = false;
        this.doubleClicked = false;
        this.lastClickTime = 0;
        this.clickCount = 0;
        this.pressedButtons = new Set();
        this.dragStart = { x: 0, y: 0, active: false };
        this.dragDelta = { dx: 0, dy: 0 };
        this.wheelDeltaX = 0;
        this.wheelDeltaY = 0;
        this.wheelDeltaZ = 0;
        this.insideCanvas = false;
        this.prevX = 0;
        this.prevY = 0;
        this.velocityX = 0;
        this.velocityY = 0;

        this.buttonMap = { 0: "left", 1: "middle", 2: "right" };

        this.offsetX = 0;
        this.offsetY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        window.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        window.addEventListener("mouseup", (e) => this.handleMouseUp(e));
        window.addEventListener("click", (e) => this.handleClick(e));
        window.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
        window.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
        window.addEventListener("mouseenter", (e) => this.handleMouseEnter(e));
        window.addEventListener("mouseleave", (e) => this.handleMouseLeave(e));
    }

    handleMouseMove(e) {
        this.x = e.clientX + world.camera.x;
        this.y = e.clientY + world.camera.y;

        if (this.pressed) {
            this.dragStart.active = true;
            this.dragDelta = { dx: this.x - this.dragStart.x, dy: this.y - this.dragStart.y };
        }

        if (this.prevX !== 0 || this.prevY !== 0) {
            this.velocityX = this.x - this.prevX;
            this.velocityY = this.y - this.prevY;
        } else {
            this.velocityX = 0;
            this.velocityY = 0;
        }

        this.prevX = this.x;
        this.prevY = this.y;

        this.insideCanvas =
            this.x >= 0 && this.x <= World.canvas.width &&
            this.y >= 0 && this.y <= World.canvas.height;

        if (window.p5 && p5.instance) p5.instance._onmousemove(e);
    }

    handleMouseDown(e) {
        this.pressed = true;
        this.button = e.button;
        this.pressedButtons.add(e.button);

        this.dragStart = { x: this.x, y: this.y, active: false };
        this.dragDelta = { dx: 0, dy: 0 };

        if (window.p5 && p5.instance) p5.instance._onmousedown(e);
    }

    handleMouseUp(e) {
        this.pressed = false;
        this.pressedButtons.delete(e.button);
        if (this.dragStart.active) this.dragStart.active = false;
        if (window.p5 && p5.instance) p5.instance._onmouseup(e);
    }

    handleClick(e) {
        this.clicked = true;
        this.clickCount++;

        const currentTime = Date.now();
        if (currentTime - this.lastClickTime < 300) this.doubleClicked = true;
        this.lastClickTime = currentTime;

        setTimeout(() => {
            this.clicked = false;
            this.doubleClicked = false;
        }, 100);

        if (window.p5 && p5.instance) p5.instance._onclick(e);
    }

    handleDoubleClick(e) {
        this.doubleClicked = true;
        if (window.p5 && p5.instance) p5.instance._ondblclick(e);
    }

    handleWheel(e) {
        this.wheelDeltaX = e.deltaX;
        this.wheelDeltaY = e.deltaY;
        this.wheelDeltaZ = e.deltaZ;
        e.preventDefault();
        if (window.p5 && p5.instance) p5.instance._onwheel(e);
    }

    handleMouseEnter(e) { this.insideCanvas = true; }

    handleMouseLeave(e) {
        this.insideCanvas = false;
        if (this.dragStart.active) {
            this.dragStart.active = false;
            this.dragDelta = { dx: 0, dy: 0 };
        }
    }

    isPressed(button = null) {
        // Tick-gated: only report during a tick.
        if (!World.updateTick) return false;
        if (button !== null) {
            if (typeof button === "string") return this.pressedButtons.has(this.getButtonIndex(button));
            return this.pressedButtons.has(button);
        }
        return this.pressed;
    }

    getPressedButton() {
        if (this.button !== null) {
            return { index: this.button, name: this.buttonMap[this.button] || "unknown" };
        }
        return null;
    }

    getPressedButtons() {
        const buttons = [];
        this.pressedButtons.forEach((buttonIndex) => {
            buttons.push({ index: buttonIndex, name: this.buttonMap[buttonIndex] || "unknown" });
        });
        return buttons;
    }

    wasClicked() { return this.clicked; }
    wasDoubleClicked() { return this.doubleClicked; }
    getClickCount() { return this.clickCount; }
    isDragging() { return this.dragStart.active && this.pressed; }
    getDragDelta() { return { ...this.dragDelta }; }

    getDragStartPosition() {
        if (this.dragStart.active) return { x: this.dragStart.x, y: this.dragStart.y };
        return null;
    }

    getWheelDelta() {
        return { deltaX: this.wheelDeltaX, deltaY: this.wheelDeltaY, deltaZ: this.wheelDeltaZ };
    }

    wasWheelScrolled() {
        return this.wheelDeltaY !== 0 || this.wheelDeltaX !== 0 || this.wheelDeltaZ !== 0;
    }

    getWheelDirection() {
        if (this.wheelDeltaY > 0) return "down";
        if (this.wheelDeltaY < 0) return "up";
        if (this.wheelDeltaX > 0) return "right";
        if (this.wheelDeltaX < 0) return "left";
        return "none";
    }

    getVelocity() { return { vx: this.velocityX || 0, vy: this.velocityY || 0 }; }

    getButtonIndex(buttonName) {
        const buttonMap = { left: 0, middle: 1, right: 2, back: 3, forward: 4 };
        return buttonMap[buttonName.toLowerCase()] ?? -1;
    }

    reset() {
        this.pressed = false;
        this.button = null;
        this.clicked = false;
        this.doubleClicked = false;
        this.pressedButtons.clear();
        this.dragStart.active = false;
        this.dragDelta = { dx: 0, dy: 0 };
        this.wheelDeltaX = 0;
        this.wheelDeltaY = 0;
        this.wheelDeltaZ = 0;
    }
}

// ============================================
// KEYBOARD
// ============================================
// Tracks per-key press/release timestamps + keyStates used by
// keyTyped() for OS-style key-repeat behavior.
class Keyboard {
    static init() {
        if (Keyboard.started) return;
        Keyboard.length = 0;
        Keyboard.started = true;
    }

    constructor() {
        this.keys = {};
        this.typedBuffer = "";
        this.nonTypingKeys = [
            'shift', 'control', 'alt', 'meta', 'escape', 'tab', 'capslock',
            'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
            'enter', 'backspace', 'delete'
        ];

        this.keyStates = {};
        this.initialDelay = 300; // ms before key repeat starts
        this.repeatRate = 20;    // ms between repeats

        // Raw key events for text entry (the debug console). Every keydown
        // (including OS auto-repeat) and paste is queued here; drainEvents()
        // hands them over once per tick, so fast typing never drops chars.
        this.eventQueue = [];
        // While true, keys the page would normally act on (Tab, /, Backspace,
        // arrows...) are swallowed. Ctrl/Meta combos are left alone so paste works.
        this.capture = false;

        this.setupEventListeners();
    }

    _queueEvent(ev) {
        if (this.eventQueue.length >= 256) this.eventQueue.shift();
        this.eventQueue.push(ev);
    }

    /** Returns and clears the queued key events since the last call. */
    drainEvents() {
        const q = this.eventQueue;
        this.eventQueue = [];
        return q;
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        window.addEventListener('blur', (e) => this.handleBlur(e));
        window.addEventListener('paste', (e) => {
            const t = e.clipboardData && e.clipboardData.getData('text');
            if (t) this._queueEvent({ type: 'paste', text: t });
            if (this.capture) e.preventDefault();
        });
    }

    handleKeyDown(e) {
        this._queueEvent({
            type: 'down', key: e.key, code: e.code, repeat: e.repeat,
            ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey
        });
        if (this.capture && !e.ctrlKey && !e.metaKey && !/^F\d+$/.test(e.key)) e.preventDefault();

        const key = e.key;
        const lowerKey = key.toLowerCase();
        let ck = this.keys[lowerKey];
        let keyObject;

        if (ck !== undefined) {
            if (!ck.pressed) {
                ck.timeStamp.pressed = new Date().getTime();
                this.keyStates[lowerKey] = {
                    hasOutputInitial: false,
                    lastOutputTime: new Date().getTime(),
                    phase: 'initial'
                };
            }
            ck.pressed = true;
            keyObject = ck;
        } else {
            keyObject = {
                key: lowerKey,
                originalKey: key,
                held: e.repeat,
                pressed: true,
                timeStamp: { pressed: new Date().getTime(), released: -1 }
            };
            this.keyStates[lowerKey] = {
                hasOutputInitial: false,
                lastOutputTime: new Date().getTime(),
                phase: 'initial'
            };
        }
        this.keys[lowerKey] = keyObject;
    }

    handleKeyUp(e) {
        const lowerKey = e.key.toLowerCase();
        let ck = this.keys[lowerKey];
        let keyObject;
        if (ck !== undefined) {
            if (ck.pressed) ck.timeStamp.released = new Date().getTime();
            ck.pressed = false;
            keyObject = ck;
        } else {
            keyObject = {
                key: lowerKey,
                held: e.repeat,
                pressed: false,
                timeStamp: { pressed: -1, released: new Date().getTime() }
            };
        }
        this.keys[lowerKey] = keyObject;
        delete this.keyStates[lowerKey];
    }

    handleBlur(e) {
        for (let K in this.keys) {
            let k = this.keys[K];
            k.pressed = false;
            k.timeStamp.released = new Date().getTime();
            delete this.keyStates[K];
        }
    }

    keyPressed() {
        if (!World.updateTick) return false;
        if (arguments.length == 1) {
            return (this.keys[arguments[0]] != undefined) ? this.keys[arguments[0]].pressed : false;
        }
        return false;
    }

    keyReset(k) {
        try { this.keys[k].pressed = false; return true; }
        catch (e) { return false; }
    }

    keyFunction(k) {
        if (!World.updateTick) return k ? false : {};
        if (!k) {
            let list = {};
            this.nonTypingKeys.forEach(f => {
                let _k = this.keys[f];
                if (_k) list[f] = _k.pressed;
            });
            return list;
        } else if (typeof k == "string") {
            let r = this.keys[k] ? this.keys[k].pressed : false;
            this.keyReset(k);
            return r;
        }
        return false;
    }

    keyTyped() {
        if (!World.updateTick) return "";
        let currentTime = new Date().getTime();
        let shiftHeld = this.keyPressed('shift');

        let pressedKey = null;
        let pressedKeyName = null;
        for (let keyName in this.keys) {
            let k = this.keys[keyName];
            if (!k.pressed) continue;
            if (this.nonTypingKeys.includes(k.key)) continue;
            pressedKey = k;
            pressedKeyName = keyName;
            break;
        }

        if (pressedKey === null) return "";

        let char = pressedKey.key;
        if (shiftHeld) char = char.toUpperCase();

        let state = this.keyStates[pressedKeyName];
        if (!state) {
            this.keyStates[pressedKeyName] = {
                hasOutputInitial: false,
                lastOutputTime: currentTime,
                phase: 'initial'
            };
            state = this.keyStates[pressedKeyName];
        }

        let shouldOutput = false;
        if (!state.hasOutputInitial) {
            state.hasOutputInitial = true;
            state.lastOutputTime = currentTime;
            shouldOutput = true;
        } else {
            let timeSinceLastOutput = currentTime - state.lastOutputTime;
            if (state.phase === 'initial') {
                if (timeSinceLastOutput >= this.initialDelay) {
                    state.phase = 'repeating';
                    state.lastOutputTime = currentTime;
                    shouldOutput = true;
                }
            } else if (state.phase === 'repeating') {
                if (timeSinceLastOutput >= this.repeatRate) {
                    state.lastOutputTime = currentTime;
                    shouldOutput = true;
                }
            }
        }

        return shouldOutput ? char : "";
    }

    resetKeyState(keyName) { delete this.keyStates[keyName]; }
    getKey(k) { return this.keys[k] ? this.keys[k] : null; }

    held(k) {
        if (!this.keys[k]) return 0;
        let key = this.keys[k];
        if (key.timeStamp.pressed > key.timeStamp.released) {
            return (new Date().getTime() - key.timeStamp.pressed) / 1000;
        }
        return (key.timeStamp.released - key.timeStamp.pressed) / 1000;
    }
}

// ============================================
// CONTROLLER
// ============================================
// Wraps navigator.getGamepads() with a friendlier button/axis map.
class _Controller {
    constructor() {
        this.index = 0;
        this.buttons = [];
        this.axes = [];
        this.connected = false;
        this.id = "";
        this.axisMap = {
            left:  { horizontal: 0, vertical: 1 },
            right: { horizontal: 2, vertical: 3 }
        };
        this.buttonMap = {
            select: 0, back: 1, primary: 2, secondary: 3,
            leftbumber: 4, rightbumber: 5, lefttrigger: 6, righttrigger: 7,
            view: 8, menu: 9, leftstick: 10, rightstick: 11,
            up: 12, down: 13, left: 14, right: 15,
            bumber: { left: 4, right: 5 },
            stick:  { left: 10, right: 11 },
            trigger:{ left: 6, right: 7 },
            dPad:   { up: 12, down: 13, left: 14, right: 15 }
        };
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener("gamepadconnected", (e) => {
            console.debug("Controller connected!");
            this.updateController(e.gamepad);
        });
        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Controller disconnected");
            this.connected = false;
        });
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (gamepads[this.index]) this.updateController(gamepads[this.index]);

        // Rebuild maps (in case we want to allow runtime remapping later).
        this.axisMap = {
            left:  { horizontal: 0, vertical: 1 },
            right: { horizontal: 2, vertical: 3 }
        };
        this.buttonMap = {
            select: 0, back: 1, primary: 2, secondary: 3,
            leftbumber: 4, rightbumber: 5, lefttrigger: 6, righttrigger: 7,
            view: 8, menu: 9, leftstick: 10, rightstick: 11,
            up: 12, down: 13, left: 14, right: 15,
            bumber: { left: 4, right: 5 },
            stick:  { left: 10, right: 11 },
            trigger:{ left: 6, right: 7 },
            dPad:   { up: 12, down: 13, left: 14, right: 15 }
        };
    }

    updateController(gp) {
        this.connected = true;
        this.id = gp.id;

        if (this.buttons.length <= 0) {
            this.buttons = gp.buttons.map((b) => ({
                pressed: b.pressed,
                value: b.value,
                _press: b.pressed,
                timeStamp: { pressed: -1, released: 0 }
            }));
        } else {
            for (let i in this.buttons) {
                let b = this.buttons[i];
                let rb = gp.buttons[i];
                b.pressed = rb.pressed;
                b.value = rb.value;
                if (b.pressed && !b._press) {
                    b._press = true;
                    b.timeStamp.pressed = World.currentTime;
                } else if (!b.pressed && b._press) {
                    b.timeStamp.released = World.currentTime;
                    b._press = false;
                }
            }
        }

        this.axes = [...gp.axes];
    }

    getButton(name) {
        const btnMap = {
            "select": 0, "back": 1, "primary": 2, "secondary": 3,
            "leftbumber": 4, "rightbumber": 5, "lefttrigger": 6, "righttrigger": 7,
            "view": 8, "menu": 9, "leftstick": 10, "rightstick": 11,
            "up": 12, "down": 13, "left": 14, "right": 15,
            "bumber": { "left": 4, "right": 5 },
            "stick":  { "left": 10, "right": 11 },
            "trigger":{ "left": 6, "right": 7 },
            "dpad":   { "up": 12, "down": 13, "left": 14, "right": 15 }
        };
        const list = name.split(":");
        let btn;

        if (list.length == 1) btn = btnMap[name.toLowerCase()];
        else if (list.length > 1) {
            btn = btnMap[list[0]];
            if (btn != undefined) btn = btn[list[1]];
        }

        if (btn !== undefined && this.buttons[btn]) return this.buttons[btn].pressed;
        return null;
    }

    getStick(axisIndex) {
        if (typeof axisIndex == "number") return this.axes[axisIndex] || 0;
        else if (typeof axisIndex == "string") {
            if (/left/gi.test(axisIndex))  return { x: this.axes[0], y: this.axes[1] };
            if (/right/gi.test(axisIndex)) return { x: this.axes[2], y: this.axes[3] };
        }
        return { x: 0, y: 0 };
    }

    getButtonValue(buttonIndex) { return this.buttons[buttonIndex]?.value || 0; }
    isButtonPressed(buttonIndex) { return this.buttons[buttonIndex]?.pressed || false; }
}

// ============================================
// getInput() — STRING-BASED INPUT RESOLVER
// ============================================
// Syntax: <domain>@<control>:<attribute>[<params>]
// Domains: mouse, key/keyboard, stick, trigger, bumper, dpad, button, default.
// Attributes: pressed[count,time], held[time], x, y, horizontal, vertical, axis, start, dist.
//
// getInput keeps its own bookkeeping (per-input id -> press
// start / press history) because the Mouse class doesn't track
// per-button timestamps and no class tracks "pressed N times in
// the last M seconds". It updates on every query, so accuracy is
// tied to how often the script queries the same string - for a
// per-tick script that's once per tick.

getInput._pressStart = getInput._pressStart || {};
getInput._pressHistory = getInput._pressHistory || {};
getInput._wasPressed = getInput._wasPressed || {};

function _inputTrackEdge(id, isPressedNow) {
    const now = Date.now();
    const was = getInput._wasPressed[id] || false;
    if (isPressedNow && !was) {
        getInput._pressStart[id] = now;
        (getInput._pressHistory[id] || (getInput._pressHistory[id] = [])).push(now);
    } else if (!isPressedNow && was) {
        delete getInput._pressStart[id];
    }
    getInput._wasPressed[id] = isPressedNow;
}

function _inputHeldDuration(id, isPressedNow) {
    if (!isPressedNow || getInput._pressStart[id] === undefined) return 0;
    return (Date.now() - getInput._pressStart[id]) / 1000;
}

function _inputPressedCountWithin(id, count, windowSeconds) {
    const now = Date.now();
    let hist = (getInput._pressHistory[id] || []).filter((t) => now - t <= windowSeconds * 1000);
    getInput._pressHistory[id] = hist;
    return hist.length >= count;
}

function _resolvePressedHeld(id, isPressedNow, attr, heldDuration) {
    _inputTrackEdge(id, isPressedNow);
    if (attr.name === 'pressed') {
        if (attr.params.length >= 2) {
            return _inputPressedCountWithin(id, attr.params[0], attr.params[1] / 10);
        }
        return isPressedNow;
    }
    if (attr.name === 'held') {
        const duration = heldDuration !== undefined ? heldDuration : _inputHeldDuration(id, isPressedNow);
        if (attr.params.length >= 1) return duration >= (attr.params[0] / 10);
        return duration;
    }
    return null;
}

function _parseAttribute(attrRaw) {
    if (attrRaw === null || attrRaw === undefined) return null;
    let m = attrRaw.trim().match(/^([a-zA-Z]+)(?:\[([^\]]*)\])?$/);
    if (!m) return null;
    return {
        name: m[1].toLowerCase(),
        params: m[2] ? m[2].split(',').map((s) => parseFloat(s.trim())) : []
    };
}

const MOUSE_BUTTON_INDEX = { left: 0, middle: 1, right: 2 };

function _resolveMouseInput(control, attr) {
    if (control in MOUSE_BUTTON_INDEX) {
        if (!attr) return null;
        const index = MOUSE_BUTTON_INDEX[control];
        const isPressedNow = mouse.pressedButtons.has(index);
        return _resolvePressedHeld('mouse:' + index, isPressedNow, attr);
    }

    if (control === 'wheel') {
        if (!attr) return null;
        const w = mouse.getWheelDelta();
        if (attr.name === 'x') return w.deltaX;
        if (attr.name === 'y') return w.deltaY;
        if (attr.name === 'xy') return { x: w.deltaX, y: w.deltaY };
        return null;
    }

    if (control === 'position') {
        // mouse@position has no ":attribute" - always returns (x,y).
        return { x: mouse.x, y: mouse.y };
    }

    if (control === 'drag') {
        if (!attr) return null;
        if (attr.name === 'start') {
            const s = mouse.getDragStartPosition();
            return s || { x: 0, y: 0 };
        }
        if (attr.name === 'dist') {
            const d = mouse.getDragDelta();
            return { x: d.dx, y: d.dy };
        }
        return null;
    }

    return null;
}

function _resolveKeyInput(control, attr) {
    if (!control || !attr) return null;
    const keyName = control.toLowerCase();
    const isPressedNow = !!(keyboard.keys[keyName] && keyboard.keys[keyName].pressed);
    // Keyboard.held() reports the duration of the last hold even after
    // release - for held[...] here that must reset to 0 the moment the
    // key isn't actively down, or a previously-true held[...] stays true.
    const heldDuration = isPressedNow ? keyboard.held(keyName) : 0;
    return _resolvePressedHeld('key:' + keyName, isPressedNow, attr, heldDuration);
}

const STICK_DEADZONE = 0.2;

function _resolveStickInput(control, attr) {
    if (control !== 'left' && control !== 'right') return null;
    const stick = controller.getStick(control); // { x, y }
    if (!attr) return null;
    if (attr.name === 'x' || attr.name === 'horizontal') return stick.x || 0;
    if (attr.name === 'y' || attr.name === 'vertical') return stick.y || 0;
    if (attr.name === 'axis') return { x: stick.x || 0, y: stick.y || 0 };
    if (attr.name === 'pressed' || attr.name === 'held') {
        const magnitude = Math.hypot(stick.x || 0, stick.y || 0);
        const isPressedNow = magnitude > STICK_DEADZONE;
        return _resolvePressedHeld('stick:' + control, isPressedNow, attr);
    }
    return null;
}

const CONTROLLER_BUTTON_INDEX = {
    trigger: { left: 6, right: 7 },
    bumper:  { left: 4, right: 5 },
    dpad:    { up: 12, down: 13, left: 14, right: 15 },
    button: {
        select: 0, back: 1, primary: 2, secondary: 3,
        leftbumper: 4, rightbumper: 5, lefttrigger: 6, righttrigger: 7,
        view: 8, menu: 9, leftstick: 10, rightstick: 11,
        up: 12, down: 13, left: 14, right: 15
    }
};

function _resolveControllerButtonInput(domain, control, attr) {
    const map = CONTROLLER_BUTTON_INDEX[domain];
    const index = map ? map[control] : undefined;
    if (index === undefined || !attr) return null;

    const btn = controller.buttons ? controller.buttons[index] : null;
    const isPressedNow = !!(btn && btn.pressed);

    let heldDuration = 0;
    if (isPressedNow && btn.timeStamp && btn.timeStamp.pressed >= 0) {
        heldDuration = (World.currentTime - btn.timeStamp.pressed) / 1000;
    }

    return _resolvePressedHeld('controller:' + index, isPressedNow, attr, heldDuration);
}

function _resolveDefaultInput(control) {
    const defaults = (typeof World !== 'undefined') && (World.defaults || World.defualts);
    const binds = defaults && defaults.binds;
    const bound = binds ? binds[control] : undefined;
    if (typeof bound === 'string') return getInput(bound);
    return null;
}

function _controlDefaultsToPressed(domain, control) {
    if (domain === 'mouse') return control in MOUSE_BUTTON_INDEX;
    if (domain === 'key' || domain === 'keyboard') return true;
    if (domain === 'stick') return control === 'left' || control === 'right';
    if (domain === 'trigger' || domain === 'bumper' || domain === 'dpad' || domain === 'button') {
        return !!(CONTROLLER_BUTTON_INDEX[domain] && control in CONTROLLER_BUTTON_INDEX[domain]);
    }
    return false;
}

/**
 * Reads an input string in the documented syntax and returns
 * whatever it currently evaluates to. Bare pressable controls
 * default to a ":pressed" check. Returns null for malformed or
 * unrecognized strings.
 */
function getInput(str) {
    if (typeof str !== "string" || str.length === 0) return null;

    const atIndex = str.indexOf('@');
    if (atIndex === -1) return null;

    const domain = str.slice(0, atIndex).trim().toLowerCase();
    const rest = str.slice(atIndex + 1);

    const colonIndex = rest.indexOf(':');
    let control, attrRaw;
    if (colonIndex === -1) {
        control = rest.trim();
        attrRaw = null;
    } else {
        control = rest.slice(0, colonIndex).trim();
        attrRaw = rest.slice(colonIndex + 1);
    }
    control = control.toLowerCase();

    let attr = _parseAttribute(attrRaw);
    if (attrRaw !== null && attr === null) return null;

    if (attr === null && _controlDefaultsToPressed(domain, control)) {
        attr = { name: 'pressed', params: [] };
    }

    // Tick-gated: off-tick, return neutral values instead of stale ones.
    // The debug console also hides keyboard input while it's open (and
    // mouse input while the pointer is over it) so the game doesn't react
    // to typing or clicks meant for the console.
    const _hiddenByConsole = (typeof DevConsole !== 'undefined') && DevConsole.blocksInput(domain);
    if ((typeof World !== 'undefined' && !World.updateTick) || _hiddenByConsole) {
        if (control === 'position') return { x: mouse.x, y: mouse.y };
        if (!attr) return null;
        if (attr.name === 'pressed') return false;
        if (attr.name === 'held') return attr.params.length ? false : 0;
        if (['x', 'y', 'horizontal', 'vertical'].includes(attr.name)) return 0;
        if (['xy', 'axis', 'start', 'dist'].includes(attr.name)) return { x: 0, y: 0 };
        return null;
    }

    switch (domain) {
        case 'mouse': return _resolveMouseInput(control, attr);
        case 'key':
        case 'keyboard': return _resolveKeyInput(control, attr);
        case 'stick': return _resolveStickInput(control, attr);
        case 'trigger':
        case 'bumper':
        case 'dpad':
        case 'button': return _resolveControllerButtonInput(domain, control, attr);
        case 'default': return _resolveDefaultInput(control);
        default: return null;
    }
}

// ============================================
// KEYBOARD STICK
// ============================================
// Simulates a virtual analog stick from 4 key binds. Moves
// toward full deflection while a key is held, springs back to
// 0 when neither (or both) of an axis's keys are held.
class KeyboardStick {
    constructor(binds = {}, options = {}) {
        this.binds = {
            left:  binds.left  || 'a',
            right: binds.right || 'd',
            up:    binds.up    || 'w',
            down:  binds.down  || 's',
        };

        this.turnSpeed   = options.turnSpeed   !== undefined ? options.turnSpeed   : 2.5;
        this.returnSpeed = options.returnSpeed !== undefined ? options.returnSpeed : this.turnSpeed;
        this.invertY     = options.invertY     !== undefined ? options.invertY     : true;

        this.x = 0;
        this.y = 0;
    }

    update(deltaTime) {
        if (deltaTime === undefined) {
            deltaTime = (typeof World !== 'undefined' && World._tickDeltaSeconds)
                ? World._tickDeltaSeconds
                : 1 / 60;
        }

        if (typeof World !== 'undefined' && !World.updateTick) {
            return { x: this.x, y: this.y };
        }

        const leftDown  = !!getInput('key@' + this.binds.left);
        const rightDown = !!getInput('key@' + this.binds.right);
        const upDown    = !!getInput('key@' + this.binds.up);
        const downDown  = !!getInput('key@' + this.binds.down);

        this.x = this._approachAxis(this.x, leftDown, rightDown, deltaTime);
        this.y = this.invertY
            ? this._approachAxis(this.y, upDown, downDown, deltaTime)
            : this._approachAxis(this.y, downDown, upDown, deltaTime);

        // Clamp combined vector to unit circle (diagonal held keys).
        const magnitude = Math.hypot(this.x, this.y);
        if (magnitude > 1) {
            const angle = Math.atan2(this.y, this.x);
            this.x = Math.cos(angle);
            this.y = Math.sin(angle);
        }

        return { x: this.x, y: this.y };
    }

    _approachAxis(current, negativeDown, positiveDown, deltaTime) {
        let target = 0;
        if (negativeDown && !positiveDown) target = -1;
        else if (positiveDown && !negativeDown) target = 1;

        const rate = (target === 0 ? this.returnSpeed : this.turnSpeed) * deltaTime;
        if (current < target) current = Math.min(target, current + rate);
        else if (current > target) current = Math.max(target, current - rate);
        return current;
    }

    reset() { this.x = 0; this.y = 0; }
}