// ============================================================
// Global.js
// ------------------------------------------------------------
// Core engine bootstrap: error classes, utility functions,
// FPS tracking, the Message system, the p5 colorText extension,
// and the World class (fixed-timestep game loop + render loop).
//
// This file is intentionally dependency-light so it can load
// first, before any other engine file, when running from disk.
// ============================================================

// ============================================
// ERROR CLASSES
// ============================================
// Custom error types so console output clearly shows which
// subsystem failed (rendering, hitbox, scene, world, etc.).
class rendererError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject|Rendering"; }
}
class gameObjectError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject"; }
}
class hitboxError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject|HitBox"; }
}
class sceneError extends Error {
    constructor(msg) { super(msg); this.name = "Scene"; }
}
class typeError extends Error {
    constructor(msg) { super(msg); this.name = "MALE|TypeError"; }
}
class numberError extends Error {
    constructor(msg) { super(msg); this.name = "MALE|NumaricalError"; }
}
class worldError extends Error {
    constructor(msg) { super(msg); this.name = "MALE"; }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Pads a number with leading zeros and trailing zeros so it
 * always has `totalLength` integer digits and `decimalPlaces`
 * decimal digits. Example: pad(3, 4, 2) -> "0003.00".
 */
function pad(num, totalLength = 4, decimalPlaces = 4) {
    let str = num + '';

    if (str.includes('.')) {
        let parts = str.split('.');
        let intPart = parts[0];
        let decPart = parts[1];

        while (decPart.length < decimalPlaces) {
            decPart += '0';
        }
        decPart = decPart.slice(0, decimalPlaces);
        str = intPart + '.' + decPart;
    } else {
        str = str + '.' + '0'.repeat(decimalPlaces);
    }

    let intPart = str.split('.')[0];
    let decPart = str.split('.')[1];

    while (intPart.length < totalLength) {
        intPart = '0' + intPart;
    }

    return intPart + '.' + decPart;
}

// ============================================
// FPS TRACKER
// ============================================
// Measures render FPS and keeps a rolling average. Updates
// World.stats so HUD scripts can read fpsColor / averageFPS.
class FPSTracker {
    constructor() {
        this.frameCount = 0;
        this.currentFPS = 0;
        this.lastUpdateTime = performance.now();
        this.updateInterval = 500;
        this.fpsHistory = [];
        this.maxHistory = 60;
        this.averageFPS = 0;
    }

    tick() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastUpdateTime >= this.updateInterval) {
            const elapsedSeconds = (now - this.lastUpdateTime) / 1000;
            this.currentFPS = Math.round(this.frameCount / elapsedSeconds);

            this.fpsHistory.push(this.currentFPS);
            if (this.fpsHistory.length > this.maxHistory) {
                this.fpsHistory.shift();
            }

            if (this.fpsHistory.length > 0) {
                const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
                this.averageFPS = Math.round(sum / this.fpsHistory.length);
            }

            if (typeof World !== 'undefined' && World.stats) {
                World.stats.fps = this.currentFPS;
                World.stats.averageFPS = this.averageFPS;

                if (this.currentFPS < 30) {
                    World.stats.fpsColor = "red";
                } else if (this.currentFPS < 50) {
                    World.stats.fpsColor = "yellow";
                } else {
                    World.stats.fpsColor = "green";
                }
            }

            this.frameCount = 0;
            this.lastUpdateTime = now;
        }
    }

    getFPS() { return this.currentFPS; }
    getAverageFPS() { return this.averageFPS; }

    getPerformanceStatus() {
        if (this.currentFPS < 30) return "Poor";
        if (this.currentFPS < 50) return "Fair";
        return "Good";
    }
}

const fpsTracker = new FPSTracker();

// ============================================
// MESSAGE SYSTEM
// ============================================
// All runtime messages (including Unit Test output) go through
// this class. Messages are filtered by World.chat.rules and
// flushed to the console once per second by the main loop.
// ============================================
// MESSAGE SYSTEM
// ============================================
// All runtime messages (including Unit Test output) go through
// this class. Messages are filtered by the active World's chat
// rules and flushed to the console once per second by its loop.
class Message {
    static init(msg) {
        if (!msg) return;
        const world = World.active;
        if (!world || !world.chat) return;
        let query = world.chat.rules.every(rule => rule.test(msg.message));
        if (query || msg.logs) world.chat.messages.push(msg);
        else world.chat.query.push(msg);
        if (Message.logs) Message.logs.push(msg);
        else Message.logs = [msg];
    }

    constructor(msg, logs = true, exe = false) {
        this.message = msg;
        this.time = World.active ? World.active.currentTime : 0;
        this.executable = exe;
        this.log = logs;
        Message.init(this);
    }
}
// ============================================
// P5.JS COLOR TEXT EXTENSIONS
// ============================================
// Adds colorText("\\red|Hello| \\blue|World|", x, y) which
// parses inline color codes and draws each segment with the
// current text settings (size, align, style).
if (typeof p5 !== 'undefined') {
    p5.prototype._parseColoredText = function (str) {
        const lines = str.split('\n');
        const result = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = /\\([^|\\\n]+)\|([^|]+)\|/g;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({ text: line.substring(lastIndex, match.index), color: null });
                }
                parts.push({ text: match[2], color: match[1] });
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < line.length) {
                parts.push({ text: line.substring(lastIndex), color: null });
            }

            const lineParts = parts.length ? parts : [{ text: line, color: null }];
            result.push(...lineParts);

            if (i < lines.length - 1) {
                result.push({ text: '\n', color: null, isNewline: true });
            }
        }

        return result;
    };

    p5.prototype.colorText = function (str, x = 0, y = 0, horizontal = LEFT, vertical = BASELINE, maxWidth) {
        const parts = this._parseColoredText(str);
        let currentX = x;
        let currentY = y;

        const originalFill = this.drawingContext.fillStyle;

        for (const part of parts) {
            if (part.isNewline) {
                currentX = x;
                currentY += (this.textLeading() || 20);
                continue;
            }

            if (part.color) {
                try {
                    this.fill(part.color);
                } catch (e) {
                    this.fill(originalFill);
                }
            }

            this.text(part.text, currentX, currentY, maxWidth);
            currentX += this.textWidth(part.text);
        }

        this.fill(originalFill);
        return this;
    };
}

// ============================================
// PING TRACKING
// ============================================
let refresher = {
    last: -1,
    ping: -1,
};

// ============================================
// WORLD CLASS
// ============================================
// Owns a fixed-timestep game loop. Rendering happens every
// animation frame; game logic (object updates, object scripts,
// input polling) only runs on a "tick" whose duration is set
// by `tickLength` (ms). Default 20ms -> 50 ticks/sec.
//
// ALL mutable state lives on the INSTANCE (this.canvas,
// this.tick, this.mouse, ...). The only static members are:
//   World.active    - the currently-running instance (or null)
//   World.instances - all live instances
//   World.started   - whether any instance has ever been created
//
// For backwards compatibility with older engine code that
// still reads World.canvas, World.mouse, etc., static getters
// proxy to World.active. New code should prefer `this.` inside
// the class or `world.` / `World.active.` outside it.
class World {
    // ---------- Static registry ----------
    static get active() { return World._active || null; }
    static set active(w) { World._active = w; }

    static get instances() { return World._instances || []; }

    static get started() { return !!World._started; }
    static set started(v) { World._started = !!v; }

    // ---------- Backward-compat proxies to the active world ----------
    // These let older code keep reading World.canvas, World.mouse,
    // etc. New code should read from the instance directly.
    static get canvas()       { return World.active ? World.active.canvas       : undefined; }
    static get mouse()        { return World.active ? World.active.mouse        : undefined; }
    static get keyboard()     { return World.active ? World.active.keyboard     : undefined; }
    static get controller()   { return World.active ? World.active.controller   : undefined; }
    static get camera()       { return World.active ? World.active.camera       : undefined; }
    static get chat()         { return World.active ? World.active.chat         : undefined; }
    static get stats()        { return World.active ? World.active.stats        : undefined; }
    static get defaults()     { return World.active ? World.active.defaults     : undefined; }
    static get tick()         { return World.active ? World.active.tick         : 0; }
    static get tickLength()   { return World.active ? World.active.tickLength   : 20; }
    static get tickRate()     { return World.active ? World.active.tickRate     : 50; }
    static get updateTick()   { return World.active ? World.active.updateTick   : false; }
    static get currentTime()  { return World.active ? World.active.currentTime  : 0; }
    static get time()         { return World.active ? World.active.time         : 0; }
    static get startTime()    { return World.active ? World.active.startTime    : performance.now(); }
    static get ping()         { return World.active ? World.active.ping         : -1; }
    static get players()      { return World.active ? World.active.players      : []; }
    static get gyroKeyboard() { return World.active ? World.active.gyroKeyboard : undefined; }
    static get debugMode()    { return World.active ? World.active.debugMode    : false; }
    objects(returner)   {
        if(!World.active)   return false;
        switch(returner){
            case 'type':
                const list = [];
                shell.allObjects.filter(o => !o.deleted ? o : false).forEach(o => list.push(o.constructor.name));
                return list;
            default:
                return shell.allObjects.filter(o => !o.deleted ? o : false)
        }
    }
    // ---------- Static convenience accessors ----------
    static getMain() { return World.active; }

    static getFPS() {
        return fpsTracker ? fpsTracker.getFPS() : 0;
    }
    static getAverageFPS() {
        return fpsTracker ? fpsTracker.getAverageFPS() : 0;
    }
    static getPerformanceStatus() {
        return fpsTracker ? fpsTracker.getPerformanceStatus() : "Unknown";
    }

    /**
     * Stops every live instance and clears the static registry.
     * For a single instance, prefer `worldInstance.stop()`.
     */
    static delete() {
        (World._instances || []).slice().forEach(w => w.stop());
        World._instances = [];
        World._active = null;
        World._started = false;
    }

    // ============================================================
    // INSTANCE
    // ============================================================

    /**
     * @param {number} tickLength ms per game tick (default 20)
     */
    constructor(tickLength = 20) {
        // Register this instance BEFORE init so any code that
        // calls World.active during init sees this one.
        if (!World._instances) World._instances = [];
        World._instances.push(this);
        if (!World._active) World.active = this;
        World.started = true;

        // ---- Identity ----
        this.id = "MALE:world[" + Math.random().toString(36).substring(2) + "]";
        this.loops = 0;

        // ---- Timing ----
        this.startTime = performance.now();
        this.currentTime = 0;
        this.time = 0;
        this.tick = 0;
        this.tickLength = tickLength > 0 ? tickLength : 20;
        this.tickRate = 1000 / this.tickLength;
        this._tickDeltaSeconds = this.tickLength / 1000;
        this._tickAccumulator = 0;
        this.updateTick = false;
        this.ping = -1;

        // ---- Running state ----
        this.started = true;    // per-instance "has init run"
        this.paused = false;
        this._rafHandle = null;
        this._running = false;
        this._initialized = false;

        // Debug mode enables developer tools such as the DevConsole
        // (backtick to open). Off by default; see setDebugMode().
        this.debugMode = false;

        // ---- Systems (created in init()) ----
        this.mouse = null;
        this.keyboard = null;
        this.controller = null;
        this.camera = null;
        this.canvas = null;
        this.gyroKeyboard = null;

        // ---- Data containers ----
        this.players = [];
        this.chat = {
            messages: [],
            query: [],
            rules: [],
        };

        // ---- Stats ----
        this.stats = {
            fps: 0,
            averageFPS: 0,
            fpsColor: 'white',
            standardFPS: 60,
            tickRate: this.tickRate,
            measuredTickRate: 0,
            ping: { current: -1, max: -1, min: Infinity, color: 'white' },
        };

        // ---- Per-instance defaults ----
        // Built fresh so instances never share nested references.
        this.defaults = World._makeDefaults();

        // ---- Time conversion helpers (bound to this instance) ----
        this.msToTicks = (ms) => ms / this.tickLength;
        this.ticksToMs = (t = this.tick) => t * this.tickLength;
        this.tickToSeconds = (t = this.tick) => (t * this.tickLength) / 1000;
        this.getTick = (total = false) => {
            if (total) return this.tick;
            const ticksPerSecond = 1000 / this.tickLength;
            return this.tick - Math.floor(this.tick / ticksPerSecond) * ticksPerSecond;
        };

        this.init();
        this.startLoop();
        this.loops += 1;

        console.debug(
            `${this.id} started: rendering every frame, ` +
            `game ticks every ${this.tickLength}ms (${this.tickRate} ticks/sec)`
        );
    }

    /**
     * Shared template for per-instance defaults. Returns a fresh
     * object each call so instances never share nested references.
     */
    static _makeDefaults() {
        return {
            _world: { size: 1080, aspect: 9 / 16 },
            scene: "blank",
            classes: ['Message', 'shell', 'Hitbox', 'gameObject', 'Transform', 'Camera', 'Scene'],
            _classes: ['Message', 'shell', 'Hitbox', 'gameObject', 'Transform', 'Camera', 'Scene'],
            gameObject: {
                constructor: [0, 0, 20, 20, "blank"],
                collision: { enabled: true, static: true, pushable: true, solid: true },
                friction: 0.98,
                gravity: 98,
                terminalVelocity: 2000,
            },
            input: { device: 'keyboard', style: 'gyro' },
            binds: {
                left:  { keyboard: 'a', controller: 'stick@left:x' },
                right: { keyboard: 'd', controller: 'stick@left:x' },
                up:    { keyboard: ['w', 'space'], controller: ['stick@left:y', 'button@select'] },
                down:  { keyboard: ['s', 'shift'], controller: ['stick@left:y', 'button@back'] },
                interact: { keyboard: 'mouse@left', controller: 'trigger@right' },
                use:      { keyboard: 'mouse@right', controller: 'trigger@left' },
            },
            getBind: (b) => {
                const world = World.active;
                if (!world) return false;
                const bind = world.defaults.binds[b];
                if (!bind) return false;
                return bind[world.defaults.input.device];
            },
        };
    }

    /**
     * Per-instance initialization. Creates input systems, the
     * p5 canvas, the main camera, and the default scene. Safe to
     * call once per instance.
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Input systems become instance properties.
        this.mouse = new Mouse();
        this.keyboard = new Keyboard();
        this.controller = new _Controller();

        // Global aliases for convenience - these point at the
        // ACTIVE world's inputs. For multi-world code, read
        // world.mouse directly instead.
        if (World.active === this) {
            window.mouse = this.mouse;
            window.keyboard = this.keyboard;
            window.controller = this.controller;
        }

        console.warn(
            "World time tracks have millisecond errors! \n" +
            "Using any display components in the main() function will be bugged!"
        );

        // ----- Class registration + init -----
        let classes = [];
        let msg = "Successfully Registered Classes: \n";
        for (let i = 0; i < this.defaults.classes.length; i++) {
            let c = this.defaults.classes[i];
            try {
                classes[i] = eval(c);
                msg += (`${c}${i < this.defaults.classes.length - 1 ? ", " : ""}`);
            } catch (e) {
                console.error(`Class Registration Failure: "${c}"`);
            }
        }
        console.table(msg);

        console.debug("Attempting Class initializations...");
        let intdds = 0;
        msg = "Successfully initialized Classes: \n";
        classes.forEach(cl => {
            try {
                if (typeof cl.init === 'function') cl.init();
                msg += (`${this.defaults.classes[intdds]}${intdds < this.defaults.classes.length - 1 ? ", " : ""}`);
            } catch (e) {
                console.error(`Class ${this.defaults.classes[intdds]} failed initialization!`);
            }
            intdds++;
        });
        console.table(msg);

        this.defaults.classes = {};
        for (let c in this.defaults._classes) {
            let cl = this.defaults._classes[c];
            this.defaults.classes[cl] = classes[c];
        }

        // ----- Canvas + camera + default scene -----
        frameRate(60);
        this.canvas = createCanvas(
            window.innerWidth /** 0.9*/,
            window.innerHeight /** 0.9 * this.defaults._world.aspect*/
        );

        this.camera = new Camera(0, 0, {
            width: this.defaults._world.size,
            height: this.defaults._world.size * this.defaults._world.aspect,
            zoom: 1,
            minZoom: 0.1,
            maxZoom: 2,
            zoomSpeed: 3,
        });

        new Scene("blank", 70, () => {
			push();
			fill('#ff0000');
			text('Blank',20,20);
			pop();
		});
        
        new Scene("startpage", 50, ()=>{
            push();

            pop();
        });

    }

    /**
     * Starts the per-instance rAF loop.
     *
     * NOTE: the loop body is a `const gameLoop = (t) => {...}`
     * arrow function, NOT `this._mainLoop = function() {...}`.
     * This matters:
     *   - Arrow functions capture `this` lexically, so every
     *     `this.tick`, `this.canvas`, etc. inside the loop
     *     refers to the World instance (not `window`).
     *   - The closure-locals (lastTime, tickRateTimer,
     *     ticksThisSecond) are declared once in startLoop and
     *     persist across frames, instead of being reset every
     *     time the loop recursed through `this._mainLoop`.
     */
    startLoop() {
        if (this._running) return;   // already running
        this._running = true;

        let lastTime = performance.now();
        this.tick = 0;
        this._tickAccumulator = 0;

        if (this.defaults.input.device == 'keyboard' &&
            this.defaults.input.style == 'gyro' &&
            !this.gyroKeyboard) {
            this.gyroKeyboard = new KeyboardStick({
                left:  this.defaults.getBind('left'),
                right: this.defaults.getBind('right'),
                up:    this.defaults.getBind('up'),
                down:  this.defaults.getBind('down'),
            });
        }

        let tickRateTimer = 0;
        let ticksThisSecond = 0;

        const gameLoop = (currentTime) => {
            if (this.paused) {
                // Keep the rAF chain alive but skip all work.
                this._rafHandle = requestAnimationFrame(gameLoop);
                lastTime = currentTime;
                return;
            }

            fpsTracker.tick();
            if (this.gyroKeyboard) this.gyroKeyboard.update();

            let deltaTime = (currentTime - lastTime) / 1000;
            if (deltaTime > 0.25) deltaTime = 0.25;
            lastTime = currentTime;

            rectMode(CENTER);
            window.fps = fpsTracker.getFPS();
            window.averageFPS = fpsTracker.getAverageFPS();
            window.mouse = this.mouse;
            window.keyboard = this.keyboard;
            window.controller = this.controller;
            window.ping = this.ping;
            window.deltaTime = deltaTime;

            // ---- Fixed-timestep game ticks ----
            this._tickAccumulator += deltaTime;
            while (this._tickAccumulator >= this._tickDeltaSeconds) {
                this._tickAccumulator -= this._tickDeltaSeconds;
                this.tick += 1;
                ticksThisSecond += 1;
                this.updateTick = true;

                // Debug console first, so it can claim input before the game reads it.
                if (typeof DevConsole !== 'undefined') DevConsole.tick();

                if (this.controller && this.controller.connected) {
                    this.controller.update();
                }
                if (typeof Scene !== 'undefined' && Scene.tick) {
                    Scene.tick(this._tickDeltaSeconds);
                }
                if (typeof main == "function") main();

                this.updateTick = false;

                // Flush chat messages to console once per second.
                if (this.tick % 25 == 0) {
                    if (this.chat && this.chat.messages && typeof this.chat.messages.filter === 'function') {
                        this.chat.messages.forEach(m => {
                            if (m.log) console.log(m.message);
                            m.log = false;
                            m.logged = true;
                        });
                        this.chat.messages = [];
                    }
                }

                // Sync object refs into scenes.
                if (gameObject && gameObject.objects && Array.isArray(gameObject.objects)) {
                    gameObject.objects.forEach(obj => {
                        if (obj.deleted) return;
                        if (Scene && Scene.scenes && Array.isArray(Scene.scenes)) {
                            Scene.scenes.forEach(scene => {
                                if (!obj.scenes.includes(scene.id)) {
                                    if (scene.objects && Array.isArray(scene.objects)) {
                                        let idx = scene.objects.indexOf(obj);
                                        if (idx > -1) scene.objects.splice(idx, 1);
                                    }
                                    return;
                                }
                                if (scene.objects && Array.isArray(scene.objects) && scene.objects.includes(obj)) {
                                    let idx = scene.objects.indexOf(obj);
                                    if (idx > -1) scene.objects[idx] = obj;
                                    return;
                                }
                                if (scene.objects && Array.isArray(scene.objects)) {
                                    scene.objects.push(obj);
                                }
                            });
                        }
                    });
                }

                // Remove deleted objects.
                if (gameObject && gameObject.objects && Array.isArray(gameObject.objects) && typeof gameObject.objects.filter === 'function') {
                    gameObject.objects = gameObject.objects.filter(obj => !obj.deleted);
                } else if (gameObject && gameObject.objects && !Array.isArray(gameObject.objects)) {
                    gameObject.objects = [];
                }
                if (Hitbox && Hitbox.objects && Array.isArray(Hitbox.objects) && typeof Hitbox.objects.filter === 'function') {
                    Hitbox.objects = Hitbox.objects.filter(hb => !hb.deleted);
                } else if (Hitbox && Hitbox.objects && !Array.isArray(Hitbox.objects)) {
                    Hitbox.objects = [];
                }
            }

            // Measured tick rate (updates once per second).
            tickRateTimer += deltaTime;
            if (tickRateTimer >= 1) {
                this.stats.measuredTickRate = ticksThisSecond;
                ticksThisSecond = 0;
                tickRateTimer -= 1;
            }

            // ---- Render (every frame) ----
            if (typeof Scene !== 'undefined' && Scene.render) {
                Scene.render();
            }
            // Console + panels draw last, in screen space, on top of the scene.
            if (typeof DevConsole !== 'undefined') DevConsole.render();

            this.currentTime = (performance.now() - this.startTime);
            this.time = this.currentTime / 1000;
            this.ping = Math.floor(performance.now() - (this.currentTime + this.startTime));
            this.getPing();

            this._rafHandle = requestAnimationFrame(gameLoop);
        };

        this._rafHandle = requestAnimationFrame(gameLoop);
    }

    // ==================== PER-INSTANCE METHODS ====================

    /** Turns developer tools (DevConsole, ...) on or off for this world. */
    setDebugMode(on = true) {
        this.debugMode = !!on;
        return this;
    }

    /** Pauses ticks and rendering (loop stays alive, does nothing). */
    pause() { this.paused = true; return this; }

    /** Resumes after pause(). */
    resume() { this.paused = false; return this; }

    /** Stops the rAF loop and removes this instance from the registry. */
    stop() {
        this._running = false;
        if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;

        if (World._instances) {
            const idx = World._instances.indexOf(this);
            if (idx > -1) World._instances.splice(idx, 1);
        }
        if (World.active === this) {
            World.active = (World._instances && World._instances[0]) ? World._instances[0] : null;
        }
        return this;
    }

    /** Makes this the active world (used by the static proxies). */
    activate() {
        World.active = this;
        window.mouse = this.mouse;
        window.keyboard = this.keyboard;
        window.controller = this.controller;
        return this;
    }

    /**
     * Ping measurement, using this instance's startTime/currentTime.
     */
    getPing() {
        if (!this.started) return -1;
        this.ping = Math.floor(performance.now() - (this.currentTime + this.startTime));
        if (performance.now() - refresher.last > 200) {
            refresher.ping = this.ping;
            refresher.last = performance.now();
        }
        if (this.stats && this.stats.ping) {
            this.stats.ping.current = this.ping;
            let stats = this.stats.ping;
            if (this.ping > stats.max) stats.max = this.ping;
            if (this.ping < stats.min && this.ping > 0) stats.min = this.ping;

            if (this.ping > 125) stats.color = "red";
            else if (this.ping > 75) stats.color = "yellow";
            else if (this.ping >= 0) stats.color = "green";
        }
        return refresher.ping;
    }

    setFPS(n) {
        this.stats.standardFPS = n > 0 ? n : 60;
        frameRate(n > 0 ? n : 60);
        return this;
    }

    setTickLength(ms) {
        if (!this.started || !(ms > 0)) return this;
        this.tickLength = ms;
        this.tickRate = 1000 / ms;
        this._tickDeltaSeconds = ms / 1000;
        this.stats.tickRate = this.tickRate;
        console.debug(`Tick length changed to ${ms}ms (${this.tickRate} ticks/sec)`);
        return this;
    }

    /**
     * Convenience: read a bind from this instance's defaults.
     * (Matches the old `World.defaults.getBind`, but scoped.)
     */
    getBind(b) {
        const bind = this.defaults.binds[b];
        if (!bind) return false;
        return bind[this.defaults.input.device];
    }
}