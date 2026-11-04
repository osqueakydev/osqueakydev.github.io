// ============================================================
// Camera.js
// ------------------------------------------------------------
// The camera is a RECTANGLE in world space, sized by
// viewportWidth x viewportHeight (world units, before zoom).
//
//   camera.x, camera.y          = top-left corner of that rect
//   camera.alignment            = where the rect anchors on screen
//                                 ['left'|'center'|'right',
//                                  'top' |'center'|'bottom']
//   camera.zoom                 = scale factor applied to the rect
//
// Screen mapping (per axis):
//   With alignment 'left'  : camera.x appears at screen x = 0
//   With alignment 'center': camera.x appears at screen x = W/2
//   With alignment 'right' : camera.x appears at screen x = W
// (and analogous for y / 'top' / 'center' / 'bottom')
//
// So with alignment ['left','top'] (the default), camera (0,0)
// is the TOP-LEFT of the screen. With ['center','center'], the
// old behaviour, (0,0) is the middle of the screen.
//
// Rendering resets the p5 transform each frame before applying
// the camera. p5's translate()/scale() are RELATIVE and persist
// across frames unless resetMatrix() is called.
// ============================================================

// class Camera {
//     static init() {
//         if (Camera.started) return;
//         Camera.instances = [];
//         Camera.started = true;
//         Camera.main = null;
//     }

//     constructor(x = 0, y = 0, options = {}) {
//         Camera.init();

//         // ---- World-space top-left of the camera rectangle ----
//         this.x = x;
//         this.y = y;

//         // ---- Viewport size in world units ----
//         // The camera rectangle is this big (before zoom).
//         this.viewportWidth  = options.width  ?? (window.MALC ? window.MALC.width  : 1080);
//         this.viewportHeight = options.height ?? (window.MALC ? window.MALC.height : 720);

//         // Legacy aliases so old code that reads camera.width/height
//         // keeps working. They map to the viewport dimensions.
//         Object.defineProperty(this, 'width', {
//             get: () => this.viewportWidth,
//             set: (v) => { this.viewportWidth = v; },
//             configurable: true,
//         });
//         Object.defineProperty(this, 'height', {
//             get: () => this.viewportHeight,
//             set: (v) => { this.viewportHeight = v; },
//             configurable: true,
//         });

        

//         // ---- Screen anchor ----
//         // 'left'|'center'|'right' horizontally, 'top'|'center'|'bottom'
//         // vertically. Like textAlign(), this is where the camera rect's
//         // (x,y) corner lands on screen.
//         this.alignment = Array.isArray(options.alignment)
//             ? [...options.alignment]
//             : ['left', 'top'];

//         // ---- Zoom ----
//         this.zoom = options.zoom || 1;
//         this.targetZoom = this.zoom;
//         this.minZoom = options.minZoom || 0.1;
//         this.maxZoom = options.maxZoom || 10;
//         this.zoomSpeed = options.zoomSpeed || 5;

//         // ---- Follow system ----
//         this.linkedObject = null;
//         this.followMode = options.followMode || "hard";
//         this.followOffset = options.followOffset || { x: 0, y: 0 };
//         this.followSpeed = options.followSpeed || 5;
//         this.followDelay = options.followDelay || 0;
//         this.followHistory = [];
//         this.historyLength = options.historyLength || 10;
//         this.velocity = { x: 0, y: 0 };
//         this.customFollowFunction = null;

//         // ---- Shake ----
//         this.shakeIntensity = 0;
//         this.shakeDecay = options.shakeDecay || 0.9;
//         this.shakeOffset = { x: 0, y: 0 };
//         this.shakeTimer = 0;
//         this.shakeDuration = 0;

//         // ---- World-space bounds (clamped in applyBounds) ----
//         this.bounds = {
//             minX: options.minX ?? -Infinity,
//             maxX: options.maxX ??  Infinity,
//             minY: options.minY ?? -Infinity,
//             maxY: options.maxY ??  Infinity,
//         };

//         // ---- Debug ----
//         this.debug = options.debug || false;
//         this.debugColor = options.debugColor || [255, 0, 0, 100];

//         Camera.instances.push(this);
//         if (!Camera.main) Camera.main = this;
//     }

    

//     // ============================================================
//     // MAIN UPDATE
//     // ============================================================
//     update(deltaTime = 1 / 60) {
//         if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
//             this.zoom += (this.targetZoom - this.zoom) * Math.min(this.zoomSpeed * deltaTime * 60, 1);
//         } else {
//             this.zoom = this.targetZoom;
//         }

//         if (this.linkedObject) this.updateFollow(deltaTime);
//         this.updateShake(deltaTime);
//         this.applyBounds();

//         return this;
//     }

//     // ============================================================
//     // RENDER TRANSFORM
//     // ============================================================
//     // Applies the p5 transform so world coordinates map to screen
//     // coordinates as described in the file header.
//     //
//     //   screenX = anchorX + (worldX - camera.x) * zoom + shakeX
//     //   screenY = anchorY + (worldY - camera.y) * zoom + shakeY
//     //
//     // The p5 transform sequence is:
//     //   1. resetMatrix()                - kill last frame's transforms
//     //   2. translate(anchorX, anchorY)  - move origin to the screen anchor
//     //   3. scale(zoom)                  - scale around that anchor
//     //   4. translate(-camera.x, -camera.y) - move world (camera.x,camera.y)
//     //                                       to the origin we just set
//     render() {
//         const canvasW = World.canvas ? World.canvas.width  : this.viewportWidth;
//         const canvasH = World.canvas ? World.canvas.height : this.viewportHeight;

//         const ax = this.anchorScreenX(canvasW);
//         const ay = this.anchorScreenY(canvasH);

//         const shakeX = this.shakeOffset.x || 0;
//         const shakeY = this.shakeOffset.y || 0;

//         resetMatrix();
//         translate(ax + shakeX, ay + shakeY);
//         scale(this.zoom);
//         translate(-this.x, -this.y);
//     }

//     // ============================================================
//     // SCREEN ANCHOR
//     // ============================================================
//     anchorScreenX(canvasW) {
//         switch (this.alignment[0]) {
//             case 'left':   return 0;
//             case 'right':  return canvasW;
//             case 'center':
//             default:       return canvasW / 2;
//         }
//     }

//     anchorScreenY(canvasH) {
//         switch (this.alignment[1]) {
//             case 'top':    return 0;
//             case 'bottom': return canvasH;
//             case 'center':
//             default:       return canvasH / 2;
//         }
//     }

//     /**
//      * Changes the screen anchor. Accepts a 2-element array
//      * like ['center','center'] or a string for shorthand:
//      * 'top-left', 'center', 'bottom-right', etc.
//      */
//     setAlignment(a, v) {
//         if (Array.isArray(a)) {
//             this.alignment = [
//                 this._normalizeH(a[0]),
//                 this._normalizeV(a[1]),
//             ];
//             return this;
//         }
//         if (typeof a === 'string' && v === undefined) {
//             // Shorthand: "top-left", "center", "bottom-right"
//             const [h, vv] = a.toLowerCase().split('-');
//             this.alignment = [
//                 this._normalizeH(h),
//                 this._normalizeV(vv || h),
//             ];
//             return this;
//         }
//         // (h, v) pair
//         this.alignment = [this._normalizeH(a), this._normalizeV(v)];
//         return this;
//     }

//     _normalizeH(h) {
//         h = String(h || 'center').toLowerCase();
//         if (h === 'left' || h === 'center' || h === 'right') return h;
//         return 'center';
//     }

//     _normalizeV(v) {
//         v = String(v || 'center').toLowerCase();
//         if (v === 'top' || v === 'center' || v === 'bottom') return v;
//         return 'center';
//     }

//     // ============================================================
//     // COORDINATE CONVERSION
//     // ============================================================
//     screenToWorld(screenX, screenY) {
//         let sx = screenX, sy = screenY;
//         if (window.MALC) {
//             sx = (screenX - window.MALC.offsetX) / window.MALC.scale;
//             sy = (screenY - window.MALC.offsetY) / window.MALC.scale;
//         }

//         const canvasW = World.canvas ? World.canvas.width  : this.viewportWidth;
//         const canvasH = World.canvas ? World.canvas.height : this.viewportHeight;

//         const ax = this.anchorScreenX(canvasW) + (this.shakeOffset.x || 0);
//         const ay = this.anchorScreenY(canvasH) + (this.shakeOffset.y || 0);

//         return {
//             x: (sx - ax) / this.zoom + this.x,
//             y: (sy - ay) / this.zoom + this.y,
//         };
//     }

//     worldToScreen(worldX, worldY) {
//         const canvasW = World.canvas ? World.canvas.width  : this.viewportWidth;
//         const canvasH = World.canvas ? World.canvas.height : this.viewportHeight;

//         const ax = this.anchorScreenX(canvasW) + (this.shakeOffset.x || 0);
//         const ay = this.anchorScreenY(canvasH) + (this.shakeOffset.y || 0);

//         let sx = ax + (worldX - this.x) * this.zoom;
//         let sy = ay + (worldY - this.y) * this.zoom;

//         if (window.MALC) {
//             sx = sx * window.MALC.scale + window.MALC.offsetX;
//             sy = sy * window.MALC.scale + window.MALC.offsetY;
//         }
//         return { x: sx, y: sy };
//     }

//     /**
//      * The world-space rectangle the camera currently sees,
//      * accounting for zoom. Returned as {left,right,top,bottom}.
//      */
//     getWorldBounds() {
//         const w = this.viewportWidth  / this.zoom;
//         const h = this.viewportHeight / this.zoom;
//         return {
//             left:   this.x,
//             right:  this.x + w,
//             top:    this.y,
//             bottom: this.y + h,
//         };
//     }

//     // ============================================================
//     // FOLLOW SYSTEM
//     // ============================================================
//     // Positions the camera so its CENTER lands on the target
//     // object (plus followOffset). This keeps the previous
//     // "camera looks at object" behaviour intact regardless of
//     // alignment.
//     updateFollow(deltaTime) {
//         if (!this.linkedObject) return;

//         const targetCenterX = (this.linkedObject.x ?? 0) + this.followOffset.x;
//         const targetCenterY = (this.linkedObject.y ?? 0) + this.followOffset.y;

//         // Camera top-left that puts its center on the target.
//         const halfW = this.viewportWidth  / (2 * this.zoom);
//         const halfH = this.viewportHeight / (2 * this.zoom);
//         let targetX = targetCenterX - halfW;
//         let targetY = targetCenterY - halfH;

//         if (this.customFollowFunction) {
//             const result = this.customFollowFunction(this.linkedObject, targetX, targetY, this);
//             if (result && typeof result.x === 'number' && typeof result.y === 'number') {
//                 this.x = result.x;
//                 this.y = result.y;
//                 return;
//             }
//         }

//         switch (this.followMode) {
//             case "hard":
//                 this.x = targetX;
//                 this.y = targetY;
//                 break;

//             case "smooth": {
//                 const t = Math.min(this.followSpeed * deltaTime * 60, 1);
//                 this.x += (targetX - this.x) * t;
//                 this.y += (targetY - this.y) * t;
//                 break;
//             }

//             case "delayed": {
//                 this.followHistory.unshift({ x: targetX, y: targetY });
//                 if (this.followHistory.length > this.historyLength) this.followHistory.pop();

//                 const delayFrames = Math.floor(this.followDelay * 60);
//                 if (delayFrames < this.followHistory.length) {
//                     const delayed = this.followHistory[delayFrames];
//                     if (delayed) {
//                         this.x += (delayed.x - this.x) * 0.3;
//                         this.y += (delayed.y - this.y) * 0.3;
//                     }
//                 } else {
//                     this.x += (targetX - this.x) * 0.1;
//                     this.y += (targetY - this.y) * 0.1;
//                 }
//                 break;
//             }

//             case "platformer": {
//                 const lookAhead = (this.linkedObject.velocity?.x || 0) * 0.05;
//                 this.x += (targetX + lookAhead - this.x) * 0.1;
//                 this.y += (targetY - this.y) * 0.08;
//                 break;
//             }

//             case "elastic": {
//                 const dx = targetX - this.x;
//                 const dy = targetY - this.y;
//                 this.velocity.x += dx * 0.1;
//                 this.velocity.y += dy * 0.1;
//                 this.velocity.x *= 0.95;
//                 this.velocity.y *= 0.95;
//                 this.x += this.velocity.x;
//                 this.y += this.velocity.y;
//                 break;
//             }

//             default:
//                 this.x = targetX;
//                 this.y = targetY;
//                 break;
//         }
//     }

//     // ============================================================
//     // SHAKE
//     // ============================================================
//     updateShake(deltaTime) {
//         if (this.shakeIntensity > 0.01) {
//             if (this.shakeDuration > 0) {
//                 this.shakeDuration -= deltaTime;
//                 if (this.shakeDuration <= 0) {
//                     this.shakeIntensity = 0;
//                     this.shakeOffset = { x: 0, y: 0 };
//                     return;
//                 }
//             }

//             this.shakeOffset.x = (Math.random() - 0.5) * this.shakeIntensity * 2;
//             this.shakeOffset.y = (Math.random() - 0.5) * this.shakeIntensity * 2;
//             this.shakeIntensity *= Math.pow(this.shakeDecay, deltaTime * 60);
//         } else {
//             this.shakeIntensity = 0;
//             this.shakeOffset = { x: 0, y: 0 };
//         }
//     }

//     shake(intensity, duration = null, decay = null) {
//         this.shakeIntensity = intensity;
//         this.shakeOffset = { x: 0, y: 0 };

//         if (duration !== null) {
//             this.shakeDuration = duration;
//             this.shakeDecay = decay || Math.pow(0.01, 1 / (duration * 60));
//         } else if (decay !== null) {
//             this.shakeDecay = decay;
//             this.shakeDuration = 0;
//         } else {
//             this.shakeDecay = 0.9;
//             this.shakeDuration = 0;
//         }
//         return this;
//     }

//     stopShake() {
//         this.shakeIntensity = 0;
//         this.shakeOffset = { x: 0, y: 0 };
//         this.shakeDuration = 0;
//         return this;
//     }

//     // ============================================================
//     // BOUNDS
//     // ============================================================
//     // Clamps the camera rect so it doesn't scroll past the
//     // configured world limits. Uses the world rect's edges.
//     applyBounds() {
//         const w = this.viewportWidth  / this.zoom;
//         const h = this.viewportHeight / this.zoom;

//         this.x = Math.min(
//             this.bounds.maxX - w,
//             Math.max(this.bounds.minX, this.x)
//         );
//         this.y = Math.min(
//             this.bounds.maxY - h,
//             Math.max(this.bounds.minY, this.y)
//         );
//     }

//     setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds }; return this; }
//     clearBounds() {
//         this.bounds = { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
//         return this;
//     }

//     // ============================================================
//     // FOLLOW CONTROL
//     // ============================================================
//     link(obj, offsetX = 0, offsetY = 0, options = {}) {
//         if (!obj) { this.linkedObject = null; return this; }

//         this.linkedObject = obj;
//         this.followOffset = { x: offsetX, y: offsetY };

//         this.followMode    = options.mode || this.followMode;
//         this.followSpeed   = options.speed || this.followSpeed;
//         this.followDelay   = options.delay || this.followDelay;
//         this.historyLength = options.historyLength || this.historyLength;

//         if (options.setInitial !== false) {
//             const halfW = this.viewportWidth  / (2 * this.zoom);
//             const halfH = this.viewportHeight / (2 * this.zoom);
//             this.x = (obj.x ?? 0) + offsetX - halfW;
//             this.y = (obj.y ?? 0) + offsetY - halfH;
//         }
//         return this;
//     }

//     setFollowMode(mode, options = {}) {
//         this.followMode = mode;
//         if (options.speed !== undefined) this.followSpeed = options.speed;
//         if (options.delay !== undefined) this.followDelay = options.delay;
//         if (options.historyLength !== undefined) this.historyLength = options.historyLength;
//         this.followHistory = [];
//         return this;
//     }

//     setCustomFollow(followFunction) {
//         if (typeof followFunction === 'function') {
//             this.customFollowFunction = followFunction;
//             this.followMode = "custom";
//         }
//         return this;
//     }

//     // ============================================================
//     // ZOOM CONTROL
//     // ============================================================
//     setZoom(zoom, instant = false) {
//         this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
//         if (instant) this.zoom = this.targetZoom;
//         return this;
//     }

//     zoomIn(amount = 0.2, instant = false) { return this.setZoom(this.targetZoom + amount, instant); }
//     zoomOut(amount = 0.2, instant = false) { return this.setZoom(this.targetZoom - amount, instant); }

//     zoomTo(target, amount = 0.1) {
//         const diff = target - this.zoom;
//         if (Math.abs(diff) > 0.001) this.zoom += diff * amount;
//         return this;
//     }

//     // ============================================================
//     // POSITION CONTROL
//     // ============================================================
//     // setPosition/centerOn now use WORLD-RECT-TOP-LEFT semantics,
//     // matching how camera.x/camera.y are documented.
//     setPosition(x, y) { this.x = x; this.y = y; return this; }

//     /** Places the camera so `x,y` (world) is at the rect's top-left. */
//     centerOn(x, y) {
//         this.x = x;
//         this.y = y;
//         return this;
//     }

//     /**
//      * Places `x,y` (world) at the camera's CENTER, regardless of
//      * screen alignment. This is what most "look at this point"
//      * code wants.
//      */
//     lookAt(x, y) {
//         const halfW = this.viewportWidth  / (2 * this.zoom);
//         const halfH = this.viewportHeight / (2 * this.zoom);
//         this.x = x - halfW;
//         this.y = y - halfH;
//         return this;
//     }

//     move(dx, dy) { this.x += dx; this.y += dy; return this; }

//     // ============================================================
//     // VISIBILITY
//     // ============================================================
//     isVisible(worldX, worldY, margin = 0) {
//         const b = this.getWorldBounds();
//         return worldX >= b.left - margin && worldX <= b.right + margin &&
//                worldY >= b.top  - margin && worldY <= b.bottom + margin;
//     }

//     isRectVisible(rect, margin = 0) {
//         const b = this.getWorldBounds();
//         return rect.x + rect.w > b.left - margin &&
//                rect.x < b.right + margin &&
//                rect.y + rect.h > b.top - margin &&
//                rect.y < b.bottom + margin;
//     }

//     isHitboxVisible(hitbox, margin = 0) {
//         const hb = hitbox.bounds();
//         const b = this.getWorldBounds();
//         return hb.right > b.left - margin &&
//                hb.left < b.right + margin &&
//                hb.bottom > b.top - margin &&
//                hb.top < b.bottom + margin;
//     }

//     // ============================================================
//     // UTILITY
//     // ============================================================
//     setViewport(width, height) {
//         this.viewportWidth = width;
//         this.viewportHeight = height;
//         return this;
//     }

//     getTransform() {
//         return {
//             x: this.x, y: this.y,
//             zoom: this.zoom,
//             alignment: [...this.alignment],
//             shakeX: this.shakeOffset.x || 0,
//             shakeY: this.shakeOffset.y || 0,
//         };
//     }

//     getOrientation() {
//         const b = this.getWorldBounds();
//         return [b.left, b.top];
//     }

//     reset() {
//         this.x = 0;
//         this.y = 0;
//         this.zoom = 1;
//         this.targetZoom = 1;
//         this.alignment = ['left', 'top'];
//         this.shakeIntensity = 0;
//         this.shakeOffset = { x: 0, y: 0 };
//         this.shakeDuration = 0;
//         this.linkedObject = null;
//         this.followMode = "hard";
//         this.followHistory = [];
//         this.velocity = { x: 0, y: 0 };
//         return this;
//     }

//     // ============================================================
//     // DEBUG
//     // ============================================================
//     drawDebug() {
//         if (!this.debug) return;

//         const b = this.getWorldBounds();
//         const tl = this.worldToScreen(b.left, b.top);
//         const br = this.worldToScreen(b.right, b.bottom);
//         const anchor = this.worldToScreen(this.x, this.y);

//         push();
//         noFill();
//         stroke(this.debugColor[0], this.debugColor[1], this.debugColor[2], this.debugColor[3]);
//         strokeWeight(2);

//         // Camera rect as drawn on screen.
//         rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

//         // Anchor cross.
//         stroke(255, 0, 0, 150);
//         line(anchor.x - 10, anchor.y, anchor.x + 10, anchor.y);
//         line(anchor.x, anchor.y - 10, anchor.x, anchor.y + 10);

//         // World bounds if set.
//         if (isFinite(this.bounds.minX) || isFinite(this.bounds.maxX) ||
//             isFinite(this.bounds.minY) || isFinite(this.bounds.maxY)) {
//             const bMin = this.worldToScreen(this.bounds.minX, this.bounds.minY);
//             const bMax = this.worldToScreen(this.bounds.maxX, this.bounds.maxY);
//             stroke(0, 255, 0, 100);
//             rect(bMin.x, bMin.y, bMax.x - bMin.x, bMax.y - bMin.y);
//         }

//         pop();
//     }

//     // ============================================================
//     // STATIC
//     // ============================================================
//     static getMain() { return Camera.main; }
//     static setMain(camera) {
//         if (camera instanceof Camera) Camera.main = camera;
//         return Camera.main;
//     }
//     static getInstances() { return Camera.instances; }
//     static clearInstances() { Camera.instances = []; Camera.main = null; }
// }


class Camera {
    constructor(){
        this.x = 0;
        this.y = 0;
        Object.defineProperty(this, 'width', {
            get: () => world.canvas.width,
            configurable: true,
        });
        Object.defineProperty(this, 'height', {
            get: () => world.canvas.height,
            configurable: true,
        });
        this.alignment = [CENTER,CENTER];
        this.origin = [LEFT,TOP];
        this.superPosition = {x:0,y:0};
        // Link state, see link(). null = camera is not following anything.
        this.linked = null;
        
    }
    // origin    = which point of the canvas camera.x / camera.y is (LEFT/TOP: the
    //             top-left corner, CENTER: the canvas center, RIGHT/BOTTOM: the far corner).
    // superPosition = the world point at the canvas's top-left, i.e. x/y minus
    //             that origin point. render() translates by -superPosition.
    update(){
        // Follow the linked object first, so superPosition below is built from
        // the camera x/y that puts the object where `alignment` says.
        if(this.linked) this._applyLink();
        this.superPosition = {x:this.x,y:this.y};

        switch(this.origin[0]){
            case CENTER:
                this.superPosition.x = this.x-this.width/2;
            break;
            case LEFT:
                this.superPosition.x = this.x;
            break;
            case RIGHT:
                this.superPosition.x = this.x-this.width;
            break;
            default:
                this.superPosition.x = this.x;
                this.origin[0] = LEFT;
        }
        switch(this.origin[1]){
            case CENTER:
                this.superPosition.y = this.y-this.height/2;
            break;
            case TOP:
                this.superPosition.y = this.y;
            break;
            case BOTTOM:
                this.superPosition.y = this.y-this.height;
            break;
            default:
                this.superPosition.y = this.y;
                this.origin[1] = TOP;
        }
        if(World)
        if(World.mouse){
            World.mouse.x = World.mouse.rawX + this.x;
            World.mouse.y = World.mouse.rawY + this.y;
        }
    }
    render(...calls){
        resetMatrix();
        calls.forEach(e => {
            //pre-camera transform rendering
            if(typeof e == 'function')
                e(this);
        });
        resetMatrix();
        translate(-this.superPosition.x,-this.superPosition.y);
    }
    // ============================================================
    // LINKING (follow an object)
    // ============================================================
    /**
     * Links the camera to an object so it follows that object's position.
     *
     *   camera.link(player);              // keep the player at the alignment point
     *   camera.link(player, 0, -40);      // aim 40 units above the player
     *   camera.link(null);                // same as unlink()
     *
     * `origin` = which point of the canvas the camera's position (camera.x /
     *   camera.y) is: [LEFT,TOP] the top-left corner, [CENTER,CENTER] the
     *   canvas center, [RIGHT,BOTTOM] the bottom-right corner.
     * `alignment` = where on the canvas we WANT the object to be:
     *   [CENTER,CENTER] (default) -> canvas center, [LEFT,TOP] -> top-left corner,
     *   [RIGHT,BOTTOM] -> bottom-right corner, etc.
     * link() moves camera.x / camera.y by the difference between those two
     * canvas points, so the object lands on the alignment point whatever the
     * origin is (origin only changes what camera.x / camera.y read as).
     *
     * The camera snaps to the object right away, then re-snaps every update().
     * The object's own transform.position is followed (not effectivePosition),
     * so linking to an `ignoreCamera` object would feed back on itself - don't.
     * offsetX / offsetY are world units added to the object's position.
     */
    // 'set:50' => camera.x = 50, 50 => camera.x = obj.x + 50
    link(obj, offsetX = 0, offsetY = 0, mode){
        if(!obj){ return this.unlink(); }
        var _x = typeof offsetX == 'string' && (Number(offsetX) == NaN) ? offsetX.split(':') : offsetX;
        var _y = typeof offsetY == 'string' && (Number(offsetY) == NaN) ? offsetX.split(':') : offsetY;
        
        this.linked = { 
            object: obj, 
            offset: { 
                x: typeof offsetX == 'object' ? Number(offsetX[1])??0 : offsetX, 
                y: typeof offsetY == 'object' ? Number(offsetY[1])??0 : offsetY 
            },
            mode: {
                x:offsetX[0]?true:false,
                y:offsetY[0]?true:false
            },
        };
        this._applyLink();
        this.update();   // refresh superPosition now so this frame is already correct
        return this;
    }

    /** Stops following. The camera stays where it is. */
    unlink(){
        this.linked = null;
        return this;
    }

    /** The linked object's world position (raw transform.position), or null. */
    static _targetPosition(obj){
        if(obj.transform && obj.transform.position) return obj.transform.position;
        if(isFinite(obj.x) && isFinite(obj.y)) return { x: obj.x, y: obj.y };
        return null;
    }

    /** The canvas point (pixels from the top-left) that this.origin names - where camera.x/y sits on the canvas. */
    _originOffset(){
        const ox = this.origin[0] === CENTER ? this.width / 2 : this.origin[0] === RIGHT  ? this.width  : 0;
        const oy = this.origin[1] === CENTER ? this.height / 2 : this.origin[1] === BOTTOM ? this.height : 0;
        return { x: ox, y: oy };
    }

    /** The screen point (canvas pixels) that `alignment` names. Unknown values count as CENTER. */
    _alignmentPoint(){
        const ax = this.alignment[0], ay = this.alignment[1];
        return {
            x: ax === LEFT ? 0 : ax === RIGHT ? this.width  : this.width  / 2,
            y: ay === TOP  ? 0 : ay === BOTTOM ? this.height : this.height / 2,
        };
    }

    /**
     * Sets x/y so the linked object (+ offset) is drawn at the alignment point.
     * After update(): superPosition = x - originPoint, render() translates by
     * -superPosition, so screen = target - superPosition = alignment point when
     *   x = target - alignmentPoint + originPoint.
     */
    _applyLink(){
        const link = this.linked;
        if(!link) return;
        const obj = link.object;
        if(!obj || obj.deleted){ this.linked = null; return; }   // target is gone: stay put
        const p = Camera._targetPosition(obj);
        if(!p) return;
        const screen = this._alignmentPoint();
        const origin = this._originOffset();
        this.x = link.mode.x ? 0 : p.x + link.offset.x - screen.x + origin.x;
        this.y = link.mode.y ? 0 : p.y + link.offset.y - screen.y + origin.y;
    }

    getBounds(err = 0){
        const o = this._originOffset();        // where camera.x/y sits on the canvas
        const left = this.x - o.x;             // world point at the canvas's top-left
        const top  = this.y - o.y;
        return {
            left:   left - err,
            right:  left + this.width + err,
            top:    top - err,
            bottom: top + this.height + err,
        };
    }
    
}



// ============================================================
// _cameraProto
// ------------------------------------------------------------
// Legacy scratch implementation kept for reference. Not wired
// into the engine; unused by Scene.render().
// ============================================================
class _cameraProto {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.zoom = z;

        this.linkedObject = null;
        let c = World.canvas;
        this.bounds = {
            left: c.width / 2,
            right: -c.width / 2,
            top: -c.height / 2,
            bottom: c.height / 2,
            horazontal: c.width / 2,
            vertical: c.height / 2
        };
        this.alignment = ['center', 'center'];
        this._align = 'center';
        this.previousPosition = { x, y };
        this.velocity = { x: 0, y: 0, decay: 0.5 };

        this.linked = {
            object: null,
            offset: { x: 0, y: 0 },
            mode: 'set',
            delay: 0.2,
            speed: 1,
        };
    }

    update() {
        const validAlign = {
            h: { center: 'center', left: 'left', right: 'right' },
            v: { center: 'center', top: 'top', bottom: 'bottom' }
        };
        this.previousPosition = { x: this.x, y: this.y };
        this._align = [
            validAlign.h[this.alignment[0] ?? 'center'],
            validAlign.v[this.alignment[1] ?? 'center']
        ];
        this.alignment = this._align;

        if (this.linked.object instanceof geometryObject) {
            this.mode = ['set', 'delayed', 'elastic'].includes(this.mode) ? this.mode : 'set';
        }
    }

    render() {
        // Scratch stub - intentionally empty.
        push();
        pop();
    }
}