// ============================================================
// objects.js
// ------------------------------------------------------------
// Core object hierarchy:
//   shell            - global registry of all engine objects
//   Transform        - position/scale/rotation/velocity
//   geometryObject   - shared position/size/velocity helpers
//   Hitbox           - collision shape (rect/circle/ellipse/triangle)
//   gameObject       - a Hitbox owner with scripts + rendering
//   Entity/Player    - gameObject subclasses with AI/max-velocity
//   UI               - screen-space interface base class
//   Text / button / inputField - UI subclasses (label, push button, text box)
//   tileMatrix       - grid of cells with layered stacks for placing objects
// ============================================================

// ============================================
// SHELL - global object registry
// ============================================
class shell {
    static init() {
        if (shell.started) return;
        shell.allObjects = [];
        shell.started = true;
    }

    push(self) {
        shell.allObjects.push(self ?? this);
        return shell.allObjects;
    }

    remove(self) {
        let obj = self ?? this;
        let idx = shell.allObjects.indexOf(obj);
        if (idx > -1) shell.allObjects.splice(idx, 1);
        return shell.allObjects;
    }

    constructor() {
        shell.init();
        this.shellIndex = shell.allObjects.length;
    }
}

// ============================================
// TRANSFORM
// ============================================
// Holds position, scale, rotation, and a velocity struct with
// three parts: `x`/`y` (explicit velocity), `inherited` (from a
// parent/ground object), and `self` (x + y + inherited).
class Transform {
    static init() {}

    constructor(x = 0, y = 0, sx = 20, sy = 20, r = 0) {
        this.position = { x: x, y: y };
        this.velocity = {
            x: 0,
            y: 0,
            inherited: { x: 0, y: 0 },
            self: { x: 0, y: 0 },
        };
        this.scale = { x: sx, y: sy };
        this.rotation = r;
        this.rotationMode = "degrees";
    }

    /**
     * `rotation` converted to radians, whatever rotationMode is
     * ("degrees" by default, or "radians"). Everything that draws or
     * measures a rotation (render, hitbox corners, hit-testing) uses this
     * one conversion so they can't disagree.
     */
    get radians() {
        const r = this.rotation || 0;
        return this.rotationMode === "radians" ? r : (r * Math.PI) / 180;
    }

    update(deltaTime = 1 / 60) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
    }
}

// ============================================
// GEOMETRY OBJECT
// ============================================
// Provides the chainable .position()/.size()/.velocity() helpers
// used everywhere in scripts. Each accepts either no args (get)
// or a mode string + values (set/add/multiply/power).
class geometryObject extends shell {
    constructor(x,y,w,h,r=0){
        super();
        this.transform = new Transform(x,y,w,h);
    }
    /**
     * The position everything should READ (drawing, hitbox world
     * position, debug overlays, position()). For most objects this is just
     * transform.position itself (same object, so code that holds on to it
     * keeps working). gameObject overrides it so that objects with
     * `ignoreCamera` get a NEW {x, y} = own position + camera position.
     * Writes always go to transform.position.
     */
    get effectivePosition() { return this.transform.position; }
    get rotation(){ return this.transform.rotation; }
    get rotationMode(){ return this.transform.rotationMode; }
    
    position(...argss) {
        if (argss.length <= 0) return this.effectivePosition;
        else {
            let modes = [/set/gi, /add/gi, /multiply/gi, /power/gi];
            if (typeof argss[1] == 'string') argss[1] = this.transform.position.x;
            if (typeof argss[2] == 'string') argss[2] = this.transform.position.y;

            if (modes[0].test(argss[0])) {
                this.transform.position.x = argss[1] ?? 0;
                this.transform.position.y = argss[2] ?? 0;
            } else if (modes[1].test(argss[0])) {
                this.transform.position.x += argss[1] ?? 0;
                this.transform.position.y += argss[2] ?? 0;
            } else if (modes[2].test(argss[0])) {
                this.transform.position.x *= argss[1] ?? 1;
                this.transform.position.y *= argss[2] ?? 1;
            } else if (modes[3].test(argss[3])) {
                this.transform.position.x = Math.pow(this.transform.position.x, argss[1] ?? 1);
                this.transform.position.y = Math.pow(this.transform.position.y, argss[2] ?? 1);
            }
        }
        return this.effectivePosition;
    }

    size(...argss) {
        if (argss.length <= 0) return this.transform.scale;
        else {
            let modes = [/set/gi, /add/gi, /multiply/gi, /power/gi];
            if (typeof argss[1] == 'string') argss[1] = this.transform.scale.x;
            if (typeof argss[2] == 'string') argss[2] = this.transform.scale.y;

            if (modes[0].test(argss[0])) {
                this.transform.scale.x = argss[1] ?? 0;
                this.transform.scale.y = argss[2] ?? 0;
            } else if (modes[1].test(argss[0])) {
                this.transform.scale.x += argss[1] ?? 0;
                this.transform.scale.y += argss[2] ?? 0;
            } else if (modes[2].test(argss[0])) {
                this.transform.scale.x *= argss[1] ?? 1;
                this.transform.scale.y *= argss[2] ?? 1;
            } else if (modes[3].test(argss[3])) {
                this.transform.scale.x = Math.pow(this.transform.scale.x, argss[1] ?? 1);
                this.transform.scale.y = Math.pow(this.transform.scale.y, argss[2] ?? 1);
            }
        }
        return this.transform.scale;
    }

    velocity(...argss) {
        if (argss.length <= 0) return this.transform.velocity;
        else {
            let modes = [/set/gi, /add/gi, /multiply/gi, /power/gi];
            if (typeof argss[1] == 'string') argss[1] = this.transform.velocity.x;
            if (typeof argss[2] == 'string') argss[2] = this.transform.velocity.y;

            if (modes[0].test(argss[0])) {
                this.transform.velocity.x = argss[1] ?? 0;
                this.transform.velocity.y = argss[2] ?? 0;
            } else if (modes[1].test(argss[0])) {
                this.transform.velocity.x += argss[1] ?? 0;
                this.transform.velocity.y += argss[2] ?? 0;
            } else if (modes[2].test(argss[0])) {
                this.transform.velocity.x *= argss[1] ?? 1;
                this.transform.velocity.y *= argss[2] ?? 1;
            } else if (modes[3].test(argss[3])) {
                this.transform.velocity.x = Math.pow(this.transform.velocity.x, argss[1] ?? 1);
                this.transform.velocity.y = Math.pow(this.transform.velocity.y, argss[2] ?? 1);
            }
        }
        return this.transform.velocity;
    }

    check(obj1, obj2) {
        let x = obj1.x == obj2.x;
        let y = obj1.y == obj2.y;
        return x && y;
    }

    update(dt = 1/60){

        const vel = this.velocity();
        const pos = this.position();

        vel.self.x = (vel.x + (vel.inherited?.x || 0));
        vel.self.y = (vel.y + (vel.inherited?.y || 0));

        if (Math.abs(vel.x) < 0.0001) vel.x = 0;
        if (Math.abs(vel.y) < 0.0001) vel.y = 0;

        pos.x += vel.self.x*dt;
        pos.y += vel.self.y*dt;

        // let idx = gameObject.objects.indexOf(this);
        // if (idx > -1) gameObject.objects[idx] = this;
        // else gameObject.objects.push(this);

        //this.updateParentScene();
    }
}



class Renderer {
    constructor(obj,type,...args){
        const validShapes = {
            rect:'rectangle',
            rectangle:'rectangle',
            square:'square',
            triangle:'triangle',
            circle:'circle',
            ellipse:'ellipse'
        };
        if(typeof type == 'string'){
            type = type.toLowerCase();
            if(type == 'basic'){
                this.mode = 'basic';
                //parameters: color, shape, outlineData {parameterType: array, number, color}
                this.color = args[0];
                this.shape = validShapes[args[1].toLowerCase()]??'rectangle';
                this.outline =  ((typeof args[2] == 'object' && Array.isArray(args[2])) ? args[2] : 
                    ((args[3] != undefined) ? [args[2],args[3]] : [0.1,0]));
                this.radius = 0;
            }else if(type == 'sprite'){
                this.mode ='texture';
                this.texture = args[0];
                this.animations = [];
                this.frame = 0;

            }
        }
        this.visible = true;
        this.debug = {
            active:false,
            color:"#37ff29",
            center:true,
            velocity:true,
        };
        //give parent object new method
        obj.constructor.prototype.render = function(){
            
            if (!this.active) return;
            const pos = this.effectivePosition;
            const scale = this.transform.scale;
            const vel = this.transform.velocity;
            const renderer = this;
            const settings = this.mode;
            
            if (renderer.visible) {
                push();
                fill(color(renderer.color));
                translate(pos.x, pos.y);
                
                if (Array.isArray(renderer.outline)) {
                    stroke(renderer.outline[1]);
                    strokeWeight(renderer.outline[0]);
                } else noStroke();
                
                if (settings == 'basic') {
                    // The body turns with transform.rotation (about its center).
                    push();
                    rotate(this.transform.rotation);
                    switch (renderer.shape) {
                        case "rect":
                        case "rectangle":
                            rectMode(CENTER);
                            rect(0, 0, scale.x, scale.y, renderer.radius || 0);   // radius: optional rounded corners
                            break;
                        case "triangle":
                            triangle(
                                pos.ax || -scale.x / 2, pos.ay || scale.y / 2,
                                pos.bx || 0, pos.by || -scale.y / 2,
                                pos.cx || scale.x / 2, pos.cy || scale.y / 2
                            );
                            break;
                        case "circle":
                        case "ellipse":
                            ellipse(0, 0, scale.x, scale.y);
                            break;
                    }
                    pop();
                }

                

                pop();
            }
            // Debug rendering (hitbox outlines, sides, velocity arrows).
            if (renderer.debug.active || renderer.debug) {
                let d = renderer.debug;
                

                

                if (d.velocity) {
                    let pos = this.effectivePosition;
                    //let vel = obj.transform.velocity;

                    push();
                    translate(pos.x, pos.y);

                    // Raw velocity arrow.
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
                        line(endX, endY, endX - arrowSize * Math.cos(angle - arrowAngle), endY - arrowSize * Math.sin(angle - arrowAngle));
                        line(endX, endY, endX - arrowSize * Math.cos(angle + arrowAngle), endY - arrowSize * Math.sin(angle + arrowAngle));

                        noStroke();
                        fill("purple");
                        textSize(11);
                        text("v: " + velMag.toFixed(1) + " px/s", endX + 5, endY - 5);
                    }
                    pop();

                    // Self (total) velocity arrow.
                    push();
                    stroke("cyan");
                    strokeWeight(2);
                    let trueVelMag = Math.sqrt(vel.self.x * vel.self.x + vel.self.y * vel.self.y);
                    if (trueVelMag > 0.01) {
                        let angle = Math.atan2(vel.self.y, vel.self.x);
                        let logScale = Math.log(1 + trueVelMag) / Math.log(1 + 100);
                        let len = minLength * 1.5 + (maxLength * 1.5 - minLength * 1.5) * logScale;
                        let endX = Math.cos(angle) * len;
                        let endY = Math.sin(angle) * len;

                        line(endX, endY, endX - arrowSize * Math.cos(angle - arrowAngle), endY - arrowSize * Math.sin(angle - arrowAngle));
                        line(endX, endY, endX - arrowSize * Math.cos(angle + arrowAngle), endY - arrowSize * Math.sin(angle + arrowAngle));

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
    get frames(){
        return this.animations.length;
    }
}


class genericObject extends geometryObject {
    constructor(shape,x,y,w,h,...scenes){
        super(x,y,w,h);
        
        this.scenes = scenes??[];
        
        
        this.rendering = new Renderer(this,'basic',color(255),shape,[0.1,0]);
        this.push(this);
    }
    
}



// ============================================
// HITBOX
// ============================================
// A collision shape owned by a gameObject. Supports rect,
// circle, ellipse, and triangle. Triangle vertices are stored
// in this.offset (ax/ay/bx/by/cx/cy) rather than scale.
class Hitbox extends geometryObject {
    static init() {
        if (Hitbox.started) return;
        Hitbox.objects = [];
        Hitbox.started = true;
    }
    /**
     * Robust triangle-vs-triangle intersection test.
     *
     * Three complementary checks:
     *   1. SAT with all six edge normals (face overlaps).
     *   2. Edge-segment intersection (thin interlocking cases).
     *   3. Vertex-in-triangle containment (full containment).
     *
     * `vertsA` and `vertsB` are 3-element arrays of {x,y} world
     * coordinates. Depends on `segmentsIntersect` and
     * `pointInTriangle` from helperFunctions.js.
     */
    static trianglesIntersect(vertsA, vertsB) {
        // ---- 1. SAT ----
        const axes = [];
        const pushEdgeNormals = (v) => {
            for (let i = 0; i < 3; i++) {
                const j = (i + 1) % 3;
                const ex = v[j].x - v[i].x;
                const ey = v[j].y - v[i].y;
                const len = Math.hypot(ex, ey);
                if (len > 0) axes.push({ x: -ey / len, y: ex / len });
            }
        };
        pushEdgeNormals(vertsA);
        pushEdgeNormals(vertsB);

        const project = (verts, axis) => {
            let min = Infinity, max = -Infinity;
            for (const p of verts) {
                const d = p.x * axis.x + p.y * axis.y;
                if (d < min) min = d;
                if (d > max) max = d;
            }
            return { min, max };
        };

        let satOverlap = true;
        for (const axis of axes) {
            const a = project(vertsA, axis);
            const b = project(vertsB, axis);
            if (a.max < b.min || b.max < a.min) { satOverlap = false; break; }
        }
        if (satOverlap) return true;

        // ---- 2. Edge-segment intersection ----
        for (let i = 0; i < 3; i++) {
            const a1 = vertsA[i];
            const a2 = vertsA[(i + 1) % 3];
            for (let j = 0; j < 3; j++) {
                const b1 = vertsB[j];
                const b2 = vertsB[(j + 1) % 3];
                if (segmentsIntersect(a1, a2, b1, b2)) return true;
            }
        }

        // ---- 3. Containment ----
        if (pointInTriangle(vertsA[0].x, vertsA[0].y, vertsB[0], vertsB[1], vertsB[2])) return true;
        if (pointInTriangle(vertsB[0].x, vertsB[0].y, vertsA[0], vertsA[1], vertsA[2])) return true;

        return false;
    }

    /**
     * Self-contained fallback for trianglesIntersect. Inlines every
     * helper so this works even if helperFunctions.js failed to
     * load or wasn't included.
     */
    static _trianglesIntersectFallback(vertsA, vertsB) {
        // Local seg-vs-seg intersection.
        const segIntersect = (p1, p2, p3, p4) => {
            const d1 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
            const d2 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
            const d3 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
            const d4 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);

            if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;

            const onSeg = (p, a, b) =>
                p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
                p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);

            if (d1 === 0 && onSeg(p3, p1, p2)) return true;
            if (d2 === 0 && onSeg(p4, p1, p2)) return true;
            if (d3 === 0 && onSeg(p1, p3, p4)) return true;
            if (d4 === 0 && onSeg(p2, p3, p4)) return true;
            return false;
        };

        // Local point-in-triangle.
        const pointInTri = (px, py, v1, v2, v3) => {
            const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
            const d1 = s(px, py, v1.x, v1.y, v2.x, v2.y);
            const d2 = s(px, py, v2.x, v2.y, v3.x, v3.y);
            const d3 = s(px, py, v3.x, v3.y, v1.x, v1.y);
            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(hasNeg && hasPos);
        };

        // SAT.
        const axes = [];
        const pushN = (v) => {
            for (let i = 0; i < 3; i++) {
                const j = (i + 1) % 3;
                const ex = v[j].x - v[i].x, ey = v[j].y - v[i].y;
                const len = Math.hypot(ex, ey);
                if (len > 0) axes.push({ x: -ey / len, y: ex / len });
            }
        };
        pushN(vertsA); pushN(vertsB);

        const proj = (verts, axis) => {
            let min = Infinity, max = -Infinity;
            for (const p of verts) {
                const d = p.x * axis.x + p.y * axis.y;
                if (d < min) min = d;
                if (d > max) max = d;
            }
            return { min, max };
        };

        let satOverlap = true;
        for (const axis of axes) {
            const a = proj(vertsA, axis);
            const b = proj(vertsB, axis);
            if (a.max < b.min || b.max < a.min) { satOverlap = false; break; }
        }
        if (satOverlap) return true;

        // Edge crossings.
        for (let i = 0; i < 3; i++) {
            const a1 = vertsA[i], a2 = vertsA[(i + 1) % 3];
            for (let j = 0; j < 3; j++) {
                const b1 = vertsB[j], b2 = vertsB[(j + 1) % 3];
                if (segIntersect(a1, a2, b1, b2)) return true;
            }
        }

        // Containment.
        if (pointInTri(vertsA[0].x, vertsA[0].y, vertsB[0], vertsB[1], vertsB[2])) return true;
        if (pointInTri(vertsB[0].x, vertsB[0].y, vertsA[0], vertsA[1], vertsA[2])) return true;

        return false;
    }

    constructor(id, shape, ...dimensions) {
        super(...dimensions);
        Hitbox.init();
        this.id = id;
        this.deleted = false;
        this.parent = null;
        this.offset = { x: 0, y: 0 };

        this.defaultShapes = [
            "rectangle", "rect", "ellipse", "circle", "square", "triangle"
        ];
        this.shape = this.defaultShapes.includes(shape) ? shape : "rectangle";
        // Amount (world units) each side is inset by when classifying
        // which sides are colliding. Prevents a flush bottom contact
        // from also flagging left/right when the objects are exactly
        // edge-aligned. Does NOT shrink the actual collision bounds.
        this.sideInset = 0.5;
        this.sideCoverage = 0.25;
        this.collision = {
            enabled: true,
            resolve:true,
            pushable: true,
            solid: true,
            sides: {}
        };
        this.sides = [];
        this.lastCollisionSides = [];
        this.radius = null;
        this.width = 0;
        this.height = 0;
        this.arcData = null;

        if (this.shape === "triangle") {
            this.transform = new Transform(0, 0, 0, 0);
            this.offset = {
                x: dimensions[0], y: dimensions[1],
                ax: dimensions[2], ay: dimensions[3],
                bx: dimensions[4], by: dimensions[5],
                cx: dimensions[6], cy: dimensions[7],
            };
            this.collision.sides = {
                left: false, right: false, bottom: false, embedded: false,
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
            this.offset = {
                x: dimensions[0] || 0,
                y: dimensions[1] || 0
            };

            // A "circle" with unequal w/h is really an ellipse.
            // NOTE: must only apply to circle/ellipse requests -
            // the original ran unconditionally and silently turned
            // any non-square rect into an ellipse.
            if (this.shape === "circle" && this.width !== this.height) {
                this.shape = "ellipse";
            }

            if (this.shape === "ellipse") this.radius = [this.width / 2, this.height / 2];
            if (this.shape === "circle")  this.radius = this.width / 2;

            if (this.shape == 'rect' || this.shape == 'rectangle') {
                this.collision.sides = {
                    left: false, right: false, bottom: false, top: false, embedded: false,
                };
            } else if (this.shape == 'circle' || this.shape == 'ellipse') {
                this.collision.sides = { self: false, embedded: false, arc: null };
            }
        }

        if (Hitbox.objects) Hitbox.objects.push(this);
        else Hitbox.objects = [this];
        this.push(this);
    }

    setParent(parent) { this.parent = parent; return this; }

    /**
     * This hitbox's rotation in the world, in radians: the parent's
     * transform.rotation plus the hitbox's own (so every hitbox - the
     * default one included - turns with the object, and a hitbox can still
     * be turned a little extra on its own).
     */
    getWorldRotation() {
        const own = (this.transform && typeof this.transform.radians === "number") ? this.transform.radians : 0;
        const par = (this.parent && this.parent.transform && typeof this.parent.transform.radians === "number")
            ? this.parent.transform.radians : 0;
        return par + own;
    }

    /**
     * Center of this hitbox in the world. The offset is rotated around the
     * parent's position by the parent's rotation, so the hitboxes keep
     * their place on the object as it turns.
     */
    getWorldPosition() {
        if (!this.parent) {
            return { x: this.offset.x || 0, y: this.offset.y || 0 };
        }
        if (!this.parent.transform || !this.parent.transform.position) {
            return { x: this.offset.x || 0, y: this.offset.y || 0 };
        }

        // effectivePosition = parent's position (+ camera position when the
        // parent has ignoreCamera). Falls back to transform.position for
        // parents that don't define it.
        const parentPos = this.parent.effectivePosition || this.parent.transform.position;
        const parentX = parentPos.x || 0;
        const parentY = parentPos.y || 0;
        let offsetX = this.offset.x || 0;
        let offsetY = this.offset.y || 0;

        const parentRot = typeof this.parent.transform.radians === "number" ? this.parent.transform.radians : 0;
        if (parentRot !== 0 && (offsetX !== 0 || offsetY !== 0)) {
            const cos = Math.cos(parentRot);
            const sin = Math.sin(parentRot);
            const rx = offsetX * cos - offsetY * sin;
            const ry = offsetX * sin + offsetY * cos;
            offsetX = rx;
            offsetY = ry;
        }

        return { x: parentX + offsetX, y: parentY + offsetY };
    }

    /**
     * Returns this triangle's vertices in world space, expanded
     * outward from the centroid by `err` pixels. The expansion
     * direction is "outward from center", not "along the normal",
     * so an inflated triangle stays similar to the original.
     */
    getWorldTrianglePoints(err = 0) {
        if (this.shape !== "triangle") return null;
        const pos = this.getWorldPosition();
        if (!pos || isNaN(pos.x) || isNaN(pos.y)) return null;

        const p = this.offset;
        if (!p) return null;

        const rotation = this.getWorldRotation();
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const points = [
            { x: p.ax || 0, y: p.ay || 0 },
            { x: p.bx || 0, y: p.by || 0 },
            { x: p.cx || 0, y: p.cy || 0 },
        ];

        const centerX = (points[0].x + points[1].x + points[2].x) / 3;
        const centerY = (points[0].y + points[1].y + points[2].y) / 3;

        const expandedPoints = points.map((pt) => {
            const dx = pt.x - centerX;
            const dy = pt.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return pt;
            const scale = (dist + err) / dist;
            return { x: centerX + dx * scale, y: centerY + dy * scale };
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
            if (this.shape === "circle") this.radius = this.width / 2;
            else if (this.shape === "ellipse") this.radius = [this.width / 2, this.height / 2];
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
        return `hitbox:${this.id}|${JSON.stringify(r)}`;
    }

    getTriangleVertices(err = 0) {
        if (this.shape !== "triangle") return null;
        return this.getWorldTrianglePoints(err);
    }

    /** Labels a triangle's vertices as apex/left/right for side tests. */
    classifyTriangleVertices(pts) {
        let apex = 0;
        for (let i = 1; i < 3; i++) {
            if (pts[i].y < pts[apex].y) apex = i;
        }
        const rest = [0, 1, 2].filter((i) => i !== apex);
        let [left, right] = rest;
        if (pts[left].x > pts[right].x) [left, right] = [right, left];
        return { apex, left, right };
    }
    /**
     * Returns the outward unit normal of this hitbox's surface at
     * the given world-space point, plus the slope angle in radians.
     *
     * For rects: the dominant axis normal (±x or ±y).
     * For circles/ellipses: the normalized vector from the center
     *   to the point, adjusted by the ellipse's radii gradient.
     * For triangles: the outward normal of whichever edge the point
     *   lies on (within tolerance); if the point is closest to a
     *   vertex, the normal is the average of that vertex's two edges.
     *
     * Returns null if the point isn't on or near this hitbox's surface.
     */
    getSurfaceNormalAt(point, tolerance = 2.0) {
        const pos = this.getWorldPosition();

        if (this.shape === "circle" || this.shape === "ellipse") {
            // Ellipse: normal at a point on the boundary is
            //   n = ((px - cx) / rx^2, (py - cy) / ry^2), normalized.
            const isEllipse = Array.isArray(this.radius);
            const rx = isEllipse ? this.radius[0] : (this.radius || this.width / 2);
            const ry = isEllipse ? this.radius[1] : (this.radius || this.height / 2);
            const dx = point.x - pos.x;
            const dy = point.y - pos.y;
            const nx = dx / (rx * rx);
            const ny = dy / (ry * ry);
            const len = Math.hypot(nx, ny);
            if (len < 1e-6) return null;
            const n = { x: nx / len, y: ny / len };
            return {
                normal: n,
                angle: Math.atan2(n.y, n.x),
                // "slope" means not aligned with the world axes
                isSloped: Math.abs(n.x) > 1e-3,
            };
        }

        if (this.shape === "triangle") {
            const verts = this.getWorldTrianglePoints(0);
            if (!verts || verts.length !== 3) return null;

            // Find the edge whose distance to `point` is smallest.
            let bestEdge = -1;
            let bestDist = Infinity;
            for (let i = 0; i < 3; i++) {
                const j = (i + 1) % 3;
                const d = pointToSegmentDistance(point, verts[i], verts[j]);
                if (d < bestDist) {
                    bestDist = d;
                    bestEdge = i;
                }
            }

            if (bestDist > tolerance) return null;

            // Near a vertex: average the two adjoining edge normals
            // (as documented above) instead of arbitrarily picking one.
            const VERTEX_TOL = 1.5;
            for (let vi = 0; vi < 3; vi++) {
                if (Math.hypot(point.x - verts[vi].x, point.y - verts[vi].y) > VERTEX_TOL) continue;
                const cen = {
                    x: (verts[0].x + verts[1].x + verts[2].x) / 3,
                    y: (verts[0].y + verts[1].y + verts[2].y) / 3,
                };
                let sx = 0, sy = 0;
                for (const nb of [verts[(vi + 1) % 3], verts[(vi + 2) % 3]]) {
                    const ex = nb.x - verts[vi].x, ey = nb.y - verts[vi].y;
                    const el = Math.hypot(ex, ey);
                    if (el < 1e-6) continue;
                    let enx = -ey / el, eny = ex / el;
                    if (enx * (cen.x - verts[vi].x) + eny * (cen.y - verts[vi].y) > 0) {
                        enx = -enx; eny = -eny;
                    }
                    sx += enx; sy += eny;
                }
                const sl = Math.hypot(sx, sy);
                if (sl > 1e-6) {
                    const avg = { x: sx / sl, y: sy / sl };
                    return {
                        normal: avg,
                        angle: Math.atan2(avg.y, avg.x),
                        isSloped: Math.abs(avg.x) > 1e-3,
                        vertexIndex: vi,
                    };
                }
            }

            const i = bestEdge;
            const j = (i + 1) % 3;
            const a = verts[i];
            const b = verts[j];

            // Edge direction, then perpendicular.
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const len = Math.hypot(ex, ey);
            if (len < 1e-6) return null;

            // Two candidate normals (± perpendicular); pick the one
            // pointing AWAY from the triangle's centroid.
            let nx = -ey / len;
            let ny = ex / len;
            const centroid = {
                x: (verts[0].x + verts[1].x + verts[2].x) / 3,
                y: (verts[0].y + verts[1].y + verts[2].y) / 3,
            };
            const toCentroidX = centroid.x - a.x;
            const toCentroidY = centroid.y - a.y;
            if (nx * toCentroidX + ny * toCentroidY > 0) {
                nx = -nx;
                ny = -ny;
            }

            return {
                normal: { x: nx, y: ny },
                angle: Math.atan2(ny, nx),
                isSloped: Math.abs(nx) > 1e-3,
                edgeIndex: i,
            };
        }

        // Rect: dominant axis normal.
        const bounds = this.bounds();
        const distLeft   = Math.abs(point.x - bounds.left);
        const distRight  = Math.abs(point.x - bounds.right);
        const distTop    = Math.abs(point.y - bounds.top);
        const distBottom = Math.abs(point.y - bounds.bottom);
        const minD = Math.min(distLeft, distRight, distTop, distBottom);

        if (minD > tolerance) return null;

        if (minD === distLeft)   return { normal: { x: -1, y: 0 }, angle: Math.PI,      isSloped: false };
        if (minD === distRight)  return { normal: { x:  1, y: 0 }, angle: 0,            isSloped: false };
        if (minD === distTop)    return { normal: { x:  0, y: -1 }, angle: -Math.PI / 2, isSloped: false };
        /* bottom */             return { normal: { x:  0, y:  1 }, angle: Math.PI / 2,  isSloped: false };
    }

    /**
     * Returns the point of this hitbox that lies farthest in the
     * direction (dx, dy) (world space). Used to measure how deeply a
     * hitbox has sunk past a surface plane.
     */
    getSupportPoint(dx, dy) {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        if (this.shape === "circle" || this.shape === "ellipse") {
            const pos = this.getWorldPosition();
            const isEllipse = Array.isArray(this.radius);
            const rx = isEllipse ? this.radius[0] : (this.radius || this.width / 2);
            const ry = isEllipse ? this.radius[1] : (this.radius || this.height / 2);
            const k = Math.sqrt(rx * rx * dx * dx + ry * ry * dy * dy) || 1;
            return { x: pos.x + (rx * rx * dx) / k, y: pos.y + (ry * ry * dy) / k };
        }
        const verts = this.shape === "triangle"
            ? this.getWorldTrianglePoints(0)
            : this.getRectangleVertices(0);
        if (!verts || !verts.length) return this.getWorldPosition();
        let best = verts[0], bestDot = -Infinity;
        for (const v of verts) {
            const d = v.x * dx + v.y * dy;
            if (d > bestDot) { bestDot = d; best = v; }
        }
        return { x: best.x, y: best.y };
    }

    // ------------------------------------------------------------
    // SWEPT COLLISION (CCD / time of impact)
    // ------------------------------------------------------------
    // Every hitbox shape (rect, triangle, circle, ellipse) is convex, so
    // one "support function" per shape is enough to measure the distance
    // between any two of them (GJK) and, from that, the exact moment a
    // moving hitbox first touches a still one (conservative advancement).
    // ------------------------------------------------------------

    /**
     * Returns a function f(dx, dy) -> the point of this hitbox farthest in
     * direction (dx, dy), in world space at the hitbox's CURRENT position.
     * The shape data is read once, so the function is cheap to call
     * repeatedly. Same shapes getSupportPoint() uses.
     */
    _ccdSupport() {
        if (this.shape === "circle" || this.shape === "ellipse") {
            const pos = this.getWorldPosition();
            const isEllipse = Array.isArray(this.radius);
            const rx = isEllipse ? this.radius[0] : (this.radius || this.width / 2);
            const ry = isEllipse ? this.radius[1] : (this.radius || this.height / 2);
            return (dx, dy) => {
                const len = Math.hypot(dx, dy) || 1;
                dx /= len; dy /= len;
                const k = Math.sqrt(rx * rx * dx * dx + ry * ry * dy * dy) || 1;
                return { x: pos.x + (rx * rx * dx) / k, y: pos.y + (ry * ry * dy) / k };
            };
        }
        const verts = this.shape === "triangle"
            ? this.getWorldTrianglePoints(0)
            : this.getRectangleVertices(0);
        if (!verts || !verts.length) {
            const p = this.getWorldPosition();
            return () => ({ x: p.x, y: p.y });
        }
        return (dx, dy) => {
            let best = verts[0], bestDot = -Infinity;
            for (let i = 0; i < verts.length; i++) {
                const d = verts[i].x * dx + verts[i].y * dy;
                if (d > bestDot) { bestDot = d; best = verts[i]; }
            }
            return { x: best.x, y: best.y };
        };
    }

    /**
     * Closest point to the origin on a 2- or 3-point simplex, plus the
     * smallest sub-simplex that still holds it. Helper for _gjk().
     * Returns { overlap: true } when the origin is inside the triangle.
     */
    static _closestOnSimplex(s) {
        const seg = (a, b) => {
            const abx = b.x - a.x, aby = b.y - a.y;
            const l2 = abx * abx + aby * aby;
            const t = l2 > 0 ? -(a.x * abx + a.y * aby) / l2 : 0;
            if (t <= 0) return { c: { x: a.x, y: a.y }, s: [a] };
            if (t >= 1) return { c: { x: b.x, y: b.y }, s: [b] };
            return { c: { x: a.x + t * abx, y: a.y + t * aby }, s: [a, b] };
        };
        if (s.length === 2) return seg(s[0], s[1]);

        const [a, b, c] = s;
        const cr = (p, q) => (q.x - p.x) * (-p.y) - (q.y - p.y) * (-p.x);   // cross(q-p, origin-p)
        const c1 = cr(a, b), c2 = cr(b, c), c3 = cr(c, a);
        const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (Math.abs(area) > 1e-12 &&
            ((c1 >= 0 && c2 >= 0 && c3 >= 0) || (c1 <= 0 && c2 <= 0 && c3 <= 0))) {
            return { overlap: true };
        }
        let best = null, bestD = Infinity;
        for (const r of [seg(a, b), seg(b, c), seg(c, a)]) {
            const d = r.c.x * r.c.x + r.c.y * r.c.y;
            if (d < bestD) { bestD = d; best = r; }
        }
        return best;
    }

    /**
     * GJK distance between two convex shapes. `sup(dx, dy)` must return the
     * point of the Minkowski difference (A - B) farthest along (dx, dy).
     *
     * Returns { overlap: true } if the shapes overlap or touch, otherwise
     * { overlap: false, dist, nx, ny } - the gap between them and the unit
     * direction from B toward A across that gap.
     */
    static _gjk(sup) {
        let simplex = [sup(1, 0)];
        let c = { x: simplex[0].x, y: simplex[0].y };
        for (let it = 0; it < 32; it++) {
            const cc = c.x * c.x + c.y * c.y;
            if (cc < 1e-12) return { overlap: true };
            const w = sup(-c.x, -c.y);
            const dist = Math.sqrt(cc);
            // Can the support point get any closer to the origin than c? If not, c is the answer.
            if ((cc - (c.x * w.x + c.y * w.y)) / dist < 1e-4) {
                return { overlap: false, dist, nx: c.x / dist, ny: c.y / dist };
            }
            simplex.push(w);
            const r = Hitbox._closestOnSimplex(simplex);
            if (r.overlap) return { overlap: true };
            simplex = r.s;
            c = r.c;
        }
        const dist = Math.hypot(c.x, c.y);
        return dist < 1e-6 ? { overlap: true } : { overlap: false, dist, nx: c.x / dist, ny: c.y / dist };
    }

    /**
     * Contact normal for two shapes that already touch or overlap.
     *
     * Finds the direction `d` that minimises the support value of the
     * Minkowski difference W = A - B, i.e. the outward normal of the face of W
     * nearest the origin. Moving A by a vector v pushes it DEEPER into B
     * exactly when v . d > 0. `depth` is how far they overlap (<= 0 when they
     * only just touch / are slightly apart).
     *
     * Coarse scan of 128 directions, then a ternary search around the best
     * one, so the normal is exact for polygons (a V-shaped minimum) and
     * accurate for circles / ellipses.
     */
    static _penetrationNormal(supA, supB) {
        const h = (th) => {
            const dx = Math.cos(th), dy = Math.sin(th);
            const p = supA(dx, dy), q = supB(-dx, -dy);
            return (p.x - q.x) * dx + (p.y - q.y) * dy;
        };
        const N = 128, step = (Math.PI * 2) / N;
        let best = Infinity, bestTh = 0;
        for (let k = 0; k < N; k++) {
            const v = h(k * step);
            if (v < best) { best = v; bestTh = k * step; }
        }
        let lo = bestTh - step, hi = bestTh + step;
        for (let i = 0; i < 40; i++) {
            const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
            if (h(m1) < h(m2)) hi = m2; else lo = m1;
        }
        const th = (lo + hi) / 2;
        return { nx: Math.cos(th), ny: Math.sin(th), depth: h(th) };
    }

    /**
     * Time of impact: how far along the displacement (mx, my) hitbox `a`
     * travels before it first touches hitbox `b` (b stays where it is).
     *
     * Conservative advancement: measure the gap with GJK, advance by
     * gap / closing-speed (which can never overshoot the first contact,
     * because the gap between two translating convex shapes is a convex
     * function of time), and repeat until they touch.
     *
     * If they already touch at the start there is no gap to advance across,
     * so the contact normal decides (see _penetrationNormal): moving INTO the
     * contact at any angle is an immediate hit (0); moving along or away from
     * it is no hit. Overlap deeper than `skin` counts as already inside.
     *
     * Returns:
     *   null      - they do not touch anywhere along the move
     *   0..1      - fraction of the move at first contact
     *   "inside"  - already overlapping by more than `skin` (resolution's job)
     */
    static timeOfImpact(a, b, mx, my, skin = 0.05) {
        const len = Math.hypot(mx, my);
        if (len < 1e-9) return null;
        const supA = a._ccdSupport();
        const supB = b._ccdSupport();
        const TOUCH = 1e-3;
        let t = 0;
        for (let i = 0; i < 32; i++) {
            const ox = mx * t, oy = my * t;
            const r = Hitbox._gjk((dx, dy) => {
                const p = supA(dx, dy), q = supB(-dx, -dy);
                return { x: p.x + ox - q.x, y: p.y + oy - q.y };
            });
            if (r.overlap || r.dist <= TOUCH) {
                if (i === 0) {
                    
                    // Touching at the start: the contact normal says whether this move goes deeper.
                    const c = Hitbox._penetrationNormal(supA, supB);
                    if (c.depth > skin) return (mx * c.nx + my * c.ny > 1e-4 * len) ? 0 : "inside";
                    if (c.depth > skin) return "inside";
                    return (mx * c.nx + my * c.ny > 1e-4 * len) ? 0 : null;
                }
                return t;
            }
            const vn = mx * r.nx + my * r.ny;                  // closing speed along the gap
            if (-vn <= 1e-4 * len) return null;                // not approaching
            t += r.dist / -vn;
            if (t > 1) return null;                            // contact is beyond this move
        }
        return t;
    }

    /**
     * BACKWARD CAST (time of entry, looking into the past).
     *
     * `a` must already sit at the END of its move; (mx, my) is the displacement
     * it just travelled, so it STARTED at (end - (mx, my)). `b` is still.
     * Answers: "on the way from the start to here, did `a` pass through `b`,
     * and how far along the move did it first touch it?"
     *
     * Nothing is predicted - the ray runs from where `a` is now back to where
     * it was. Let s be the distance back from the end as a fraction of the
     * move (s = 0 is the end, s = 1 is the start). The shapes are convex, so
     * the s values where they touch form one interval [sExit, sEntry]:
     *
     *   1. From the end, step back (conservative advancement on the GJK gap,
     *      same idea as timeOfImpact) until they touch -> sExit, the point the
     *      object LEFT `b`. If they already touch at the end, sExit = 0.
     *   2. The first contact in time is the far edge of that interval, so
     *      bisect between sExit (touching) and the start (clear) -> sEntry.
     *
     * The object `b` that was entered FIRST is the one with the largest sEntry
     * (the smallest forward fraction below) - not the one the backward ray meets
     * first, which would be the last thing the object touched.
     *
     * If the start itself already touches `b`, there is no entry to find, so the
     * contact normal decides (same rule as timeOfImpact): moving into it = 0,
     * overlap deeper than `skin` = "inside", otherwise no hit.
     *
     * Returns:
     *   null      - `a` never touched `b` along the move
     *   0..1      - fraction of the move (from the start) at the first contact
     *   "inside"  - already overlapping at the start by more than `skin`
     */
    static backcast(a, b, mx, my, skin = 0.05) {
        const len = Math.hypot(mx, my);
        if (len < 1e-9) return null;
        const supA = a._ccdSupport();           // a at its END position
        const supB = b._ccdSupport();
        const TOUCH = 1e-3;

        // GJK gap between a (pulled back s of the move) and b.
        const gapAt = (s) => {
            const ox = -mx * s, oy = -my * s;
            return Hitbox._gjk((dx, dy) => {
                const p = supA(dx, dy), q = supB(-dx, -dy);
                return { x: p.x + ox - q.x, y: p.y + oy - q.y };
            });
        };
        const touching = (r) => r.overlap || r.dist <= TOUCH;

        // ---- Already touching at the start: the contact normal decides ----
        const r1 = gapAt(1);
        if (touching(r1)) {
            const ox = -mx, oy = -my;
            const c = Hitbox._penetrationNormal(
                (dx, dy) => { const p = supA(dx, dy); return { x: p.x + ox, y: p.y + oy }; },
                supB
            );
            const into = (mx * c.nx + my * c.ny > 1e-4 * len);
            if (c.depth > skin) return into ? 0 : "inside";
            return into ? 0 : null;
        }

        // ---- 1. Walk back from the end to the first contact (sExit) ----
        let sExit = 0;
        let hit = false;
        for (let i = 0; i < 32; i++) {
            const r = gapAt(sExit);
            if (touching(r)) { hit = true; break; }
            // Closing speed of `a` toward b as it is pulled BACK along (-mx, -my).
            const vn = -mx * r.nx + -my * r.ny;
            if (-vn <= 1e-4 * len) return null;          // never closing: the path misses b
            sExit += r.dist / -vn;
            if (sExit >= 1) return null;                 // contact would be before the start
        }
        if (!hit) hit = touching(gapAt(sExit));
        if (!hit) return null;

        // ---- 2. Bisect sExit (touching) .. 1 (clear) for the entry ----
        let lo = sExit, hi = 1;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) * 0.5;
            if (touching(gapAt(mid))) lo = mid; else hi = mid;
        }
        return Math.min(1, Math.max(0, 1 - hi));         // hi = last clear point seen from the end
    }

    /**
     * Returns the point on THIS hitbox's surface that is nearest to
     * `other`'s world position. Used as the contact point for slope
     * normal calculations.
     *
     * For rects: the closest point on the rect's boundary.
     * For circles/ellipses: the boundary point along the direction
     *   from this center to other's center.
     * For triangles: the closest point on any of the three edges.
     */
    getContactPoint(other) {
        const thisPos = this.getWorldPosition();
        const otherPos = other.getWorldPosition();

        if (this.shape === "circle" || this.shape === "ellipse") {
            const isEllipse = Array.isArray(this.radius);
            const rx = isEllipse ? this.radius[0] : (this.radius || this.width / 2);
            const ry = isEllipse ? this.radius[1] : (this.radius || this.height / 2);
            const dx = otherPos.x - thisPos.x;
            const dy = otherPos.y - thisPos.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) {
                // Degenerate: return top of shape.
                return { x: thisPos.x, y: thisPos.y - ry };
            }
            // Project the direction onto the ellipse boundary.
            const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
            return {
                x: thisPos.x + dx * scale,
                y: thisPos.y + dy * scale,
            };
        }

        if (this.shape === "triangle") {
            const verts = this.getWorldTrianglePoints(0);
            if (!verts || verts.length !== 3) return null;
            let best = null;
            let bestDist = Infinity;
            for (let i = 0; i < 3; i++) {
                const j = (i + 1) % 3;
                const closest = closestPointOnSegment(otherPos, verts[i], verts[j]);
                const d = Math.hypot(closest.x - otherPos.x, closest.y - otherPos.y);
                if (d < bestDist) {
                    bestDist = d;
                    best = closest;
                }
            }
            return best;
        }

        // Rect: closest point on boundary.
        const bounds = this.bounds();
        return {
            x: Math.max(bounds.left, Math.min(otherPos.x, bounds.right)),
            y: Math.max(bounds.top,  Math.min(otherPos.y, bounds.bottom)),
        };
    }
    /**
     * Returns the 4 corners of this hitbox in world space,
     * inflated by `err`. NOTE: uses this.width/this.height (set
     * in the constructor and refreshed in updatePosition) rather
     * than transform.width/height, which never existed.
     */
    getRectangleVertices(err = 0) {
        if (this.shape === "triangle") return null;
        const pos = this.getWorldPosition();
        if (!pos || isNaN(pos.x) || isNaN(pos.y)) return null;

        const w = this.width  || this.transform.scale.x || 20;
        const h = this.height || this.transform.scale.y || 20;
        const rotation = this.getWorldRotation();
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const corners = [
            { x: -(w + err) / 2, y: -(h + err) / 2 },
            { x:  (w + err) / 2, y: -(h + err) / 2 },
            { x:  (w + err) / 2, y:  (h + err) / 2 },
            { x: -(w + err) / 2, y:  (h + err) / 2 },
        ];

        return corners.map((c) => ({
            x: pos.x + c.x * cos - c.y * sin,
            y: pos.y + c.x * sin + c.y * cos,
        }));
    }

    /** Axis-aligned bounding box in world space (inflated by err). */
    bounds(err = 0) {
        if (!this.transform || !this.transform.position) {
            return { left: 0, right: 0, top: 0, bottom: 0 };
        }

        if (this.shape === "triangle") {
            const verts = this.getWorldTrianglePoints(err);
            if (!verts || verts.length !== 3) {
                return { left: 0, right: 0, top: 0, bottom: 0 };
            }

            let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
            verts.forEach((v) => {
                if (!isNaN(v.x) && !isNaN(v.y)) {
                    left = Math.min(left, v.x);
                    right = Math.max(right, v.x);
                    top = Math.min(top, v.y);
                    bottom = Math.max(bottom, v.y);
                }
            });

            if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
                const pos = this.getWorldPosition();
                return {
                    left: (pos.x || 0) - 10,
                    right: (pos.x || 0) + 10,
                    top: (pos.y || 0) - 10,
                    bottom: (pos.y || 0) + 10
                };
            }

            return { left, right, top, bottom };
        } else {
            const pos = this.getWorldPosition();
            if (!pos || isNaN(pos.x) || isNaN(pos.y)) {
                return { left: -10, right: 10, top: -10, bottom: 10 };
            }

            const w = this.width  || this.transform.scale.x || 20;
            const h = this.height || this.transform.scale.y || 20;
            const rotation = this.getWorldRotation();

            if (rotation === 0 || this.shape === "circle" || this.shape === "ellipse") {
                const rx = (w + err) / 2;
                const ry = (h + err) / 2;
                return {
                    left: pos.x - rx, right: pos.x + rx,
                    top:  pos.y - ry, bottom: pos.y + ry,
                };
            } else {
                const vertices = this.getRectangleVertices(err);
                if (!vertices || vertices.length === 0) {
                    return {
                        left: pos.x - 10, right: pos.x + 10,
                        top: pos.y - 10, bottom: pos.y + 10
                    };
                }

                let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
                vertices.forEach((v) => {
                    if (!isNaN(v.x) && !isNaN(v.y)) {
                        left = Math.min(left, v.x);
                        right = Math.max(right, v.x);
                        top = Math.min(top, v.y);
                        bottom = Math.max(bottom, v.y);
                    }
                });

                if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
                    return {
                        left: pos.x - 10, right: pos.x + 10,
                        top: pos.y - 10, bottom: pos.y + 10
                    };
                }

                return { left, right, top, bottom };
            }
        }
    }

    getShapeSides() {
        switch (this.shape) {
            case "circle":
            case "ellipse": return ["self", "embedded"];
            case "triangle": return ["left", "right", "bottom", "embedded"];
            default: return ["left", "right", "top", "bottom", "embedded"];
        }
    }

    boundsOverlap(other, err = 0) {
        const a = this.bounds(err);
        const b = other.bounds(err);
        return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
        );
    }

    // --- Low-level geometry helpers ---
    pointInTriangle(px, py, v1, v2, v3) {
        const d1 = this.sign(px, py, v1.x, v1.y, v2.x, v2.y);
        const d2 = this.sign(px, py, v2.x, v2.y, v3.x, v3.y);
        const d3 = this.sign(px, py, v3.x, v3.y, v1.x, v1.y);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(hasNeg && hasPos);
    }

    sign(px, py, x1, y1, x2, y2) {
        return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    }

    

    projectOverlap(verts1, verts2, axis) {
        const proj1 = this.projectVertices(verts1, axis);
        const proj2 = this.projectVertices(verts2, axis);
        return proj1.max > proj2.min && proj2.max > proj1.min;
    }

    projectVertices(vertices, axis) {
        let min = Infinity, max = -Infinity;
        for (const v of vertices) {
            const projection = v.x * axis.x + v.y * axis.y;
            min = Math.min(min, projection);
            max = Math.max(max, projection);
        }
        return { min, max };
    }

    // --- Basic shape-vs-shape tests ---
    circleRectCollision(circleCenter, circleRadius, rectVertices) {
        let closestX = Math.max(rectVertices[0].x, Math.min(circleCenter.x, rectVertices[2].x));
        let closestY = Math.max(rectVertices[0].y, Math.min(circleCenter.y, rectVertices[2].y));
        const dx = circleCenter.x - closestX;
        const dy = circleCenter.y - closestY;
        return Math.sqrt(dx * dx + dy * dy) < circleRadius;
    }

    circleCircleCollision(c1, r1, c2, r2) {
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < r1 + r2;
    }

    circleTriangleCollision(circleCenter, circleRadius, triVerts) {
        if (this.pointInTriangle(circleCenter.x, circleCenter.y, triVerts[0], triVerts[1], triVerts[2])) {
            return true;
        }
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const edgeStart = triVerts[i];
            const edgeEnd = triVerts[j];
            const dx = edgeEnd.x - edgeStart.x;
            const dy = edgeEnd.y - edgeStart.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;
            const t = ((circleCenter.x - edgeStart.x) * dx + (circleCenter.y - edgeStart.y) * dy) / (len * len);
            const clampedT = Math.max(0, Math.min(1, t));
            const closestX = edgeStart.x + clampedT * dx;
            const closestY = edgeStart.y + clampedT * dy;
            const distX = circleCenter.x - closestX;
            const distY = circleCenter.y - closestY;
            if (Math.sqrt(distX * distX + distY * distY) < circleRadius) return true;
        }
        for (const v of triVerts) {
            const dx = v.x - circleCenter.x;
            const dy = v.y - circleCenter.y;
            if (dx * dx + dy * dy < circleRadius * circleRadius) return true;
        }
        return false;
    }

    rectRectCollision(verts1, verts2) {
        const axes = [];
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            const edge = { x: verts1[j].x - verts1[i].x, y: verts1[j].y - verts1[i].y };
            axes.push({ x: -edge.y, y: edge.x });
        }
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            const edge = { x: verts2[j].x - verts2[i].x, y: verts2[j].y - verts2[i].y };
            axes.push({ x: -edge.y, y: edge.x });
        }
        for (const axis of axes) {
            if (!this.projectOverlap(verts1, verts2, axis)) return false;
        }
        return true;
    }

    pointInRect(point, rectVerts) {
        let inside = false;
        const n = rectVerts.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = rectVerts[i].x, yi = rectVerts[i].y;
            const xj = rectVerts[j].x, yj = rectVerts[j].y;
            if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Full collision info for a circle/ellipse hitbox vs any other
     * shape: intersection boolean, sides hit, and arc coverage.
     */
    getCircularCollision(other, err = 0) {
        if (this.shape != "ellipse" && this.shape != "circle") return { sides: [], info: null };

        let isEllipse = (this.shape === "ellipse" && Array.isArray(this.radius));
        let rx = isEllipse ? this.radius[0] : (this.radius || this.width / 2);
        let ry = isEllipse ? this.radius[1] : (this.radius || this.height / 2);
        rx += err; ry += err;

        let info = null;
        let sides = [];

        if (other.shape == "rect" || other.shape == "rectangle") {
            let rectVerts = other.getRectangleVertices(err);
            let rectBounds = other.bounds(err);
            let rectCorners = [
                { x: rectBounds.left,  y: rectBounds.top },
                { x: rectBounds.right, y: rectBounds.top },
                { x: rectBounds.right, y: rectBounds.bottom },
                { x: rectBounds.left,  y: rectBounds.bottom }
            ];

            let center = this.getWorldPosition();
            let intersects = false;

            if (isEllipse) {
                intersects = ellipsePolygonCollision(center, rx, ry, rectVerts || rectCorners);
            } else {
                let closestX = Math.max(rectBounds.left, Math.min(center.x, rectBounds.right));
                let closestY = Math.max(rectBounds.top, Math.min(center.y, rectBounds.bottom));
                let dx = center.x - closestX;
                let dy = center.y - closestY;
                intersects = (dx * dx + dy * dy) < (rx * rx);
            }

            if (intersects) {
                let rectFullyInside = true;
                for (let v of rectCorners) {
                    if (isEllipse) {
                        if (!pointInEllipse(v.x, v.y, center, rx, ry)) { rectFullyInside = false; break; }
                    } else {
                        let dx = v.x - center.x, dy = v.y - center.y;
                        if (dx * dx + dy * dy > rx * rx) { rectFullyInside = false; break; }
                    }
                }

                let ellipseFullyInside = true;
                if (isEllipse) {
                    const numPoints = 36;
                    for (let i = 0; i < numPoints; i++) {
                        let theta = (i / numPoints) * 2 * Math.PI;
                        let px = center.x + rx * Math.cos(theta);
                        let py = center.y + ry * Math.sin(theta);
                        if (!pointInRect({ x: px, y: py }, rectCorners)) { ellipseFullyInside = false; break; }
                    }
                } else {
                    if (!(center.x - rx >= rectBounds.left && center.x + rx <= rectBounds.right &&
                          center.y - ry >= rectBounds.top  && center.y + ry <= rectBounds.bottom)) {
                        ellipseFullyInside = false;
                    }
                }

                if (rectFullyInside) sides.push("self");
                else if (ellipseFullyInside) sides.push("embedded");
                else sides.push("self");
            }

            const arc = intersects
                ? computeCircularArcInfo(center, rx, ry, (p) => pointInRect(p, rectVerts || rectCorners))
                : { start: 0, end: 0, length: 0 };

            info = { intersects, arc };
            return { sides, info };
        }

        else if (other.shape === "circle" || other.shape === "ellipse") {
            let center1 = this.getWorldPosition();
            let center2 = other.getWorldPosition();
            let r2 = other.radius || Math.max(other.width || 20, other.height || 20) / 2;
            let rx2 = r2 + err;
            let ry2 = r2 + err;
            let isOtherEllipse = (other.shape === "ellipse" && Array.isArray(other.radius));

            if (isOtherEllipse) {
                rx2 = other.radius[0] + err;
                ry2 = other.radius[1] + err;
            }

            let intersects = false;
            let dist = 0;

            if (isEllipse && isOtherEllipse) {
                dist = Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2));
                if (dist < rx + rx2 + ry + ry2) {
                    intersects =
                        pointInEllipse(center1.x, center1.y, center2, rx2, ry2) ||
                        pointInEllipse(center2.x, center2.y, center1, rx, ry);
                    if (!intersects) {
                        const numPoints = 180;
                        for (let i = 0; i < numPoints && !intersects; i++) {
                            let theta = (i / numPoints) * 2 * Math.PI;
                            let px = center1.x + rx * Math.cos(theta);
                            let py = center1.y + ry * Math.sin(theta);
                            if (pointInEllipse(px, py, center2, rx2, ry2)) intersects = true;
                        }
                    }
                }
            } else if (isEllipse && !isOtherEllipse) {
                dist = Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2));
                let dx = center2.x - center1.x;
                let dy = center2.y - center1.y;
                if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) intersects = true;
                else {
                    let closest = closestPointOnEllipse(rx, ry, dx, dy);
                    let distToEllipse = Math.sqrt(Math.pow(dx - closest.x, 2) + Math.pow(dy - closest.y, 2));
                    intersects = distToEllipse <= r2 + err;
                }
            } else if (!isEllipse && isOtherEllipse) {
                dist = Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2));
                let dx = center1.x - center2.x;
                let dy = center1.y - center2.y;
                if ((dx * dx) / (rx2 * rx2) + (dy * dy) / (ry2 * ry2) <= 1) intersects = true;
                else {
                    let closest = closestPointOnEllipse(rx2, ry2, dx, dy);
                    let distToEllipse = Math.sqrt(Math.pow(dx - closest.x, 2) + Math.pow(dy - closest.y, 2));
                    intersects = distToEllipse <= rx + err;
                }
            } else {
                dist = Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2));
                intersects = dist < (rx + err) + (r2 + err);
            }

            if (intersects) {
                // Determine containment (self/embedded) with sampling.
                let thisInsideOther = true;
                let otherInsideThis = true;

                if (isEllipse) {
                    const numPoints = 36;
                    for (let i = 0; i < numPoints; i++) {
                        let theta = (i / numPoints) * 2 * Math.PI;
                        let px = center1.x + rx * Math.cos(theta);
                        let py = center1.y + ry * Math.sin(theta);
                        let dx = px - center2.x, dy = py - center2.y;
                        if (isOtherEllipse) {
                            if ((dx * dx) / (rx2 * rx2) + (dy * dy) / (ry2 * ry2) > 1) { thisInsideOther = false; break; }
                        } else {
                            if (dx * dx + dy * dy > Math.pow(r2 + err, 2)) { thisInsideOther = false; break; }
                        }
                    }
                } else {
                    if (isOtherEllipse) {
                        const numPoints = 36;
                        for (let i = 0; i < numPoints; i++) {
                            let theta = (i / numPoints) * 2 * Math.PI;
                            let px = center1.x + rx * Math.cos(theta);
                            let py = center1.y + ry * Math.sin(theta);
                            let dx = px - center2.x, dy = py - center2.y;
                            if ((dx * dx) / (rx2 * rx2) + (dy * dy) / (ry2 * ry2) > 1) { thisInsideOther = false; break; }
                        }
                    } else {
                        if (dist + (rx + err) > (r2 + err)) thisInsideOther = false;
                    }
                }

                if (isOtherEllipse) {
                    const numPoints = 36;
                    for (let i = 0; i < numPoints; i++) {
                        let theta = (i / numPoints) * 2 * Math.PI;
                        let px = center2.x + rx2 * Math.cos(theta);
                        let py = center2.y + ry2 * Math.sin(theta);
                        let dx = px - center1.x, dy = py - center1.y;
                        if (isEllipse) {
                            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) { otherInsideThis = false; break; }
                        } else {
                            if (dx * dx + dy * dy > Math.pow(rx + err, 2)) { otherInsideThis = false; break; }
                        }
                    }
                } else {
                    if (isEllipse) {
                        const numPoints = 36;
                        for (let i = 0; i < numPoints; i++) {
                            let theta = (i / numPoints) * 2 * Math.PI;
                            let px = center2.x + (r2 + err) * Math.cos(theta);
                            let py = center2.y + (r2 + err) * Math.sin(theta);
                            let dx = px - center1.x, dy = py - center1.y;
                            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) { otherInsideThis = false; break; }
                        }
                    } else {
                        if (dist + (r2 + err) > (rx + err)) otherInsideThis = false;
                    }
                }

                if (thisInsideOther && !otherInsideThis) sides.push("embedded");
                else if (otherInsideThis && !thisInsideOther) sides.push("self");
                else sides.push("self");
            }

            const arc = intersects
                ? computeCircularArcInfo(center1, rx, ry, (p) => pointInEllipse(p.x, p.y, center2, rx2, ry2))
                : { start: 0, end: 0, length: 0 };

            return { sides, info: { intersects, arc } };
        }

        else if (other.shape === "triangle") {
            let center = this.getWorldPosition();
            let triVerts = other.getTriangleVertices(err);
            if (!triVerts) return { sides: [], info: null };

            let intersects = false;
            if (isEllipse) intersects = ellipsePolygonCollision(center, rx, ry, triVerts);
            else intersects = this.circleTriangleCollision(center, rx + err, triVerts);

            if (intersects) {
                let allInside = true;
                const numPoints = 36;
                for (let i = 0; i < numPoints; i++) {
                    let theta = (i / numPoints) * 2 * Math.PI;
                    let px = center.x + rx * Math.cos(theta);
                    let py = center.y + ry * Math.sin(theta);
                    if (!pointInTriangle(px, py, triVerts[0], triVerts[1], triVerts[2])) {
                        allInside = false;
                        break;
                    }
                }

                let triangleInside = true;
                for (let v of triVerts) {
                    if (isEllipse) {
                        if (!pointInEllipse(v.x, v.y, center, rx, ry)) { triangleInside = false; break; }
                    } else {
                        let dx = v.x - center.x, dy = v.y - center.y;
                        if (dx * dx + dy * dy > Math.pow(rx + err, 2)) { triangleInside = false; break; }
                    }
                }

                if (triangleInside && !allInside) sides.push("self");
                else if (allInside && !triangleInside) sides.push("embedded");
                else sides.push("self");
            }

            const arc = intersects
                ? computeCircularArcInfo(center, rx, ry, (p) => pointInTriangle(p.x, p.y, triVerts[0], triVerts[1], triVerts[2]))
                : { start: 0, end: 0, length: 0 };

            return { sides, info: { intersects, arc } };
        }

        return { sides: [], info: null };
    }

    /**
     * Master collision entry point. Returns true if this hitbox
     * intersects `other`, and fills this.sides with the sides hit.
     *
     * `err` inflates the shape a small amount so near-misses during
     * detection don't get missed. Resolution should pass 0.
     */
    collidesWith(other, err = 0, sideReturn = false) {
        if (!this.collision.enabled || !other.collision.enabled) return false;
        if (!this.boundsOverlap(other, err)) {
            this.sides = [];
            this.lastCollisionSides = [];
            return false;
        }

        let collision = false;
        const thisShape = this.shape;
        const otherShape = other.shape;

        if ((thisShape === "circle" || thisShape === "ellipse") &&
            (otherShape === "circle" || otherShape === "ellipse")) {
            const pos1 = this.getWorldPosition();
            const pos2 = other.getWorldPosition();

            let isEllipse1 = (thisShape === "ellipse" && Array.isArray(this.radius));
            let isEllipse2 = (otherShape === "ellipse" && Array.isArray(other.radius));

            if (isEllipse1) {
                let r1 = this.radius[0] + err;
                let ry1 = this.radius[1] + err;
                if (isEllipse2) {
                    let rx2 = other.radius[0] + err;
                    let ry2 = other.radius[1] + err;
                    collision = ellipseEllipseCollision(pos1, r1, ry1, pos2, rx2, ry2);
                } else {
                    let r2 = (other.radius || Math.max(other.width || 20, other.height || 20) / 2) + err;
                    collision = ellipseCircleCollision(pos1, r1, ry1, pos2, r2);
                }
            } else if (isEllipse2) {
                let rx2 = other.radius[0] + err;
                let ry2 = other.radius[1] + err;
                let r1 = (this.radius || Math.max(this.width || 20, this.height || 20) / 2) + err;
                collision = ellipseCircleCollision(pos2, rx2, ry2, pos1, r1);
            } else {
                let r1 = (this.radius || Math.max(this.width || 20, this.height || 20) / 2) + err;
                let r2 = (other.radius || Math.max(other.width || 20, other.height || 20) / 2) + err;
                collision = this.circleCircleCollision(pos1, r1, pos2, r2);
            }
        } else if ((thisShape === "circle" || thisShape === "ellipse") &&
                (otherShape === "rectangle" || otherShape === "rect")) {
            const rectVerts = other.getRectangleVertices(err);
            if (rectVerts) {
                const rectBounds = other.bounds(err);
                const rectCorners = [
                    { x: rectBounds.left,  y: rectBounds.top },
                    { x: rectBounds.right, y: rectBounds.top },
                    { x: rectBounds.right, y: rectBounds.bottom },
                    { x: rectBounds.left,  y: rectBounds.bottom }
                ];

                const pos = this.getWorldPosition();
                let rx, ry;
                let isEllipse = (thisShape === "ellipse" && Array.isArray(this.radius));

                if (isEllipse) {
                    rx = this.radius[0] + err;
                    ry = this.radius[1] + err;
                    collision = ellipsePolygonCollision(pos, rx, ry, rectVerts);
                } else {
                    rx = (this.radius || Math.max(this.width || 20, this.height || 20) / 2) + err;
                    ry = rx;
                    collision = this.circleRectCollision(pos, rx, rectCorners);
                }
            }
        } else if ((thisShape === "rectangle" || thisShape === "rect") &&
                (otherShape === "circle" || otherShape === "ellipse")) {
            collision = other.collidesWith(this, err);
        } else if ((thisShape === "circle" || thisShape === "ellipse") && otherShape === "triangle") {
            const triVerts = other.getWorldTrianglePoints(err);
            if (triVerts) {
                const pos = this.getWorldPosition();
                let isEllipse = (thisShape === "ellipse" && Array.isArray(this.radius));

                if (isEllipse) {
                    collision = ellipsePolygonCollision(pos, this.radius[0] + err, this.radius[1] + err, triVerts);
                } else {
                    let rx = (this.radius || Math.max(this.width || 20, this.height || 20) / 2) + err;
                    collision = this.circleTriangleCollision(pos, rx, triVerts);
                }
            }
        } else if (thisShape === "triangle" &&
                (otherShape === "circle" || otherShape === "ellipse")) {
            collision = other.collidesWith(this, err);
        }
        // ---- TRIANGLE vs TRIANGLE ----
        else if (thisShape === "triangle" && otherShape === "triangle") {
            const verts1 = this.getWorldTrianglePoints(0);
            const verts2 = other.getWorldTrianglePoints(0);

            if (verts1 && verts2 && verts1.length === 3 && verts2.length === 3) {
                // Prefer the static method if it's present; fall back
                // to a self-contained copy so this branch works even if
                // Hitbox.trianglesIntersect wasn't added to the class.
                const tester = (typeof Hitbox.trianglesIntersect === 'function')
                    ? Hitbox.trianglesIntersect
                    : Hitbox._trianglesIntersectFallback;
                collision = tester(verts1, verts2);
            } else {
                // Loud failure: this is why the collision was silently
                // missed before.
                console.warn("[Hitbox] triangle/triangle: could not get vertex arrays.", {
                    thisVerts: verts1, otherVerts: verts2,
                    thisShape: this.shape, otherShape: other.shape
                });
            }
        }
        // ---- TRIANGLE vs RECT ----
        else if (thisShape === "triangle" &&
                (otherShape === "rectangle" || otherShape === "rect")) {
            const triVerts = this.getWorldTrianglePoints(0);
            const rectVerts = other.getRectangleVertices(0);

            if (triVerts && rectVerts && triVerts.length === 3 && rectVerts.length === 4) {
                // 1. Any triangle vertex inside the rect?
                for (const v of triVerts) {
                    if (this.pointInRect(v, rectVerts)) { collision = true; break; }
                }

                // 2. Any rect vertex inside the triangle?
                if (!collision) {
                    for (const v of rectVerts) {
                        if (this.pointInTriangle(v.x, v.y, triVerts[0], triVerts[1], triVerts[2])) {
                            collision = true;
                            break;
                        }
                    }
                }

                // 3. Any edge crossing? This catches interlocking
                //    cases where no vertex is strictly inside the
                //    other shape but the outlines cross.
                if (!collision) {
                    for (let i = 0; i < 3 && !collision; i++) {
                        const a1 = triVerts[i];
                        const a2 = triVerts[(i + 1) % 3];
                        for (let j = 0; j < 4; j++) {
                            const b1 = rectVerts[j];
                            const b2 = rectVerts[(j + 1) % 4];
                            if (segmentsIntersect(a1, a2, b1, b2)) {
                                collision = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
        // ---- RECT vs TRIANGLE ----
        else if ((thisShape === "rectangle" || thisShape === "rect") && otherShape === "triangle") {
            collision = other.collidesWith(this, err);
        }
        // ---- RECT vs RECT ----
        else if ((thisShape === "rectangle" || thisShape === "rect") &&
                (otherShape === "rectangle" || otherShape === "rect")) {
            const verts1 = this.getRectangleVertices(err);
            const verts2 = other.getRectangleVertices(err);
            if (verts1 && verts2) collision = this.rectRectCollision(verts1, verts2);
        }
        // ---- Fallback ----
        else {
            collision = this.boundsOverlap(other, err);
        }

        if (collision) {
            this.lastCollisionSides = this.sides;
            this.sides = this.determineCollisionSides(other, err);
        } else {
            this.lastCollisionSides = this.sides;
            this.sides = [];
            this.collision.sides.arc = null;
        }

        if (sideReturn) return this.collision.sides;
        return collision;
    }

    /**
     * Classifies which sides of this hitbox are touching `other`.
     * For rects, uses inclusive >=/<= comparisons so two flush
     * surfaces (which is exactly what resolveCollision produces)
     * still register as touching.
     */
    determineCollisionSides(other, err = 0) {
        const sides = [];
        const thisBounds = this.bounds(err);
        const otherBounds = other.bounds(err);

        if (this.shape === "circle" || this.shape === "ellipse") {
            let result = this.getCircularCollision(other, err);
            if (result && result.sides) {
                result.sides.forEach((s) => { if (!sides.includes(s)) sides.push(s); });
            }
            const validSides = this.getShapeSides();
            const filtered = sides.filter((side) => validSides.includes(side));

            this.collision.sides.self = filtered.includes("self");
            this.collision.sides.embedded = filtered.includes("embedded");
            if (result && result.info && result.info.intersects) {
                this.collision.sides.arc = result.info.arc;
                this.arcData = result.info.arc;
            } else {
                this.collision.sides.arc = null;
                this.arcData = null;
            }
            return filtered;
        }

        if (this.shape === "triangle") {
            const triangleVerts = this.getWorldTrianglePoints(err);

            const thisFullyInsideOther =
                thisBounds.left >= otherBounds.left &&
                thisBounds.right <= otherBounds.right &&
                thisBounds.top >= otherBounds.top &&
                thisBounds.bottom <= otherBounds.bottom;

            const otherFullyInsideThis =
                otherBounds.left >= thisBounds.left &&
                otherBounds.right <= thisBounds.right &&
                otherBounds.top >= thisBounds.top &&
                otherBounds.bottom <= thisBounds.bottom;

            if (otherFullyInsideThis) { sides.push("embedded"); return sides; }
            if (thisFullyInsideOther) {
                sides.push("left"); sides.push("right"); sides.push("bottom");
                return sides;
            }

            const otherTester = this.getTriangularCollision(other, err);
            otherTester.forEach((s) => { if (!sides.includes(s)) sides.push(s); });
            const validSides = this.getShapeSides();
            return sides.filter((side) => validSides.includes(side));
        }

        if (this.shape === "rectangle" || this.shape === "rect") {
            // Full-bounds containment checks.
            const thisFullyInsideOther =
                thisBounds.left   >= otherBounds.left &&
                thisBounds.right  <= otherBounds.right &&
                thisBounds.top    >= otherBounds.top &&
                thisBounds.bottom <= otherBounds.bottom;
        
            const otherFullyInsideThis =
                otherBounds.left   >= thisBounds.left &&
                otherBounds.right  <= thisBounds.right &&
                otherBounds.top    >= thisBounds.top &&
                otherBounds.bottom <= thisBounds.bottom;
        
            if (otherFullyInsideThis) { sides.push("embedded"); return sides; }
        
            // Per-side inset and coverage threshold.
            const inset = (typeof this.sideInset === 'number') ? this.sideInset : 0.5;
            const coverage = (typeof this.sideCoverage === 'number') ? this.sideCoverage : 0.25;
        
            const thisW = thisBounds.right  - thisBounds.left;
            const thisH = thisBounds.bottom - thisBounds.top;
        
            // ---- LEFT side ----
            // Other must reach past my left edge, AND the vertical
            // overlap of that reach must cover at least `coverage` of
            // my height.
            {
                const vOverlap = Math.min(thisBounds.bottom, otherBounds.bottom) -
                                 Math.max(thisBounds.top,    otherBounds.top);
                if (otherBounds.right > thisBounds.left + inset &&
                    otherBounds.left  < thisBounds.left + inset &&
                    vOverlap >= thisH * coverage) {
                    sides.push("left");
                }
            }
        
            // ---- RIGHT side ----
            {
                const vOverlap = Math.min(thisBounds.bottom, otherBounds.bottom) -
                                 Math.max(thisBounds.top,    otherBounds.top);
                if (otherBounds.left  < thisBounds.right - inset &&
                    otherBounds.right > thisBounds.right - inset &&
                    vOverlap >= thisH * coverage) {
                    sides.push("right");
                }
            }
        
            // ---- TOP side ----
            {
                const hOverlap = Math.min(thisBounds.right, otherBounds.right) -
                                 Math.max(thisBounds.left,  otherBounds.left);
                if (otherBounds.bottom > thisBounds.top + inset &&
                    otherBounds.top    < thisBounds.top + inset &&
                    hOverlap >= thisW * coverage) {
                    sides.push("top");
                }
            }
        
            // ---- BOTTOM side ----
            {
                const hOverlap = Math.min(thisBounds.right, otherBounds.right) -
                                 Math.max(thisBounds.left,  otherBounds.left);
                if (otherBounds.top    < thisBounds.bottom - inset &&
                    otherBounds.bottom > thisBounds.bottom - inset &&
                    hOverlap >= thisW * coverage) {
                    sides.push("bottom");
                }
            }
        
            if (thisFullyInsideOther) {
                if (!sides.includes("left"))   sides.push("left");
                if (!sides.includes("right"))  sides.push("right");
                if (!sides.includes("top"))    sides.push("top");
                if (!sides.includes("bottom")) sides.push("bottom");
                return sides;
            }
        
            // Fallback if the coverage test rejected all sides but they
            // still overlap: pick the minimum-overlap axis.
            if (sides.length === 0) {
                const overlapX = Math.min(thisBounds.right - otherBounds.left,
                                          otherBounds.right - thisBounds.left);
                const overlapY = Math.min(thisBounds.bottom - otherBounds.top,
                                          otherBounds.bottom - thisBounds.top);
                if (overlapX < overlapY) {
                    const cx1 = (thisBounds.left + thisBounds.right) / 2;
                    const cx2 = (otherBounds.left + otherBounds.right) / 2;
                    sides.push(cx1 < cx2 ? "right" : "left");
                } else {
                    const cy1 = (thisBounds.top + thisBounds.bottom) / 2;
                    const cy2 = (otherBounds.top + otherBounds.bottom) / 2;
                    sides.push(cy1 < cy2 ? "bottom" : "top");
                }
            }
        }

        const validSides = this.getShapeSides();
        return sides.filter((side) => validSides.includes(side));
    }

    /** Triangle-specific side classification vs. rect/circle. */
    getTriangularCollision(other, err = 0) {
        if (this.shape != "triangle") return [];
        let verts = this.getTriangleVertices(err);
        if (!verts || verts.length !== 3) return [];

        let collisions = { left: false, right: false, bottom: false };

        const roles = this.triangleRoles || this.classifyTriangleVertices(verts);
        const apex = verts[roles.apex];
        const leftPt = verts[roles.left];
        const rightPt = verts[roles.right];

        let sides = {
            left:   [leftPt, apex],
            right:  [rightPt, apex],
            bottom: [leftPt, rightPt],
        };

        if (other.shape == 'rect' || other.shape == 'rectangle') {
            let points = other.getRectangleVertices(err);
            if (!points) return [];

            let parallel = { left: [], right: [], bottom: [] };

            for (let p = 0; p < points.length; p++) {
                let p1 = points[p];
                let p2 = points[(p + 1) % points.length];

                let lls = [
                    segmentsIntersect(sides.left[0],  sides.left[1],  p1, p2),
                    segmentsIntersect(sides.right[0], sides.right[1], p1, p2),
                    segmentsIntersect(sides.bottom[0], sides.bottom[1], p1, p2)
                ];

                let para = [
                    getParallelDistance(sides.left[0],  sides.left[1],  p1, p2),
                    getParallelDistance(sides.right[0], sides.right[1], p1, p2),
                    getParallelDistance(sides.bottom[0], sides.bottom[1], p1, p2)
                ];

                if (lls[0]) collisions.left = true;
                if (lls[1]) collisions.right = true;
                if (lls[2]) collisions.bottom = true;

                if (para[0] !== false) parallel.left.push(para[0]);
                if (para[1] !== false) parallel.right.push(para[1]);
                if (para[2] !== false) parallel.bottom.push(para[2]);
            }

            // If a triangle edge has a rect edge on both sides, it's
            // sandwiched - count it as a collision.
            for (let k in parallel) {
                let list = parallel[k];
                if (list.length > 1) {
                    if ((list[0] < 0 && list[1] > 0) || (list[0] > 0 && list[1] < 0)) collisions[k] = true;
                }
            }
        } else if (other.shape == 'circle' || other.shape == 'ellipse') {
            let circleCenter = other.getWorldPosition();
            let isEllipse = other.shape === 'ellipse' && Array.isArray(other.radius);
            let rx = isEllipse ? other.radius[0] : (other.radius || Math.max(other.width || 20, other.height || 20) / 2);
            let ry = isEllipse ? other.radius[1] : rx;
            rx += err; ry += err;

            collisions.left   = ellipseSegmentIntersects(circleCenter, rx, ry, sides.left[0],   sides.left[1]);
            collisions.right  = ellipseSegmentIntersects(circleCenter, rx, ry, sides.right[0],  sides.right[1]);
            collisions.bottom = ellipseSegmentIntersects(circleCenter, rx, ry, sides.bottom[0], sides.bottom[1]);

            if (!collisions.left && !collisions.right && !collisions.bottom) {
                if (
                    pointInTriangle(circleCenter.x, circleCenter.y, verts[0], verts[1], verts[2]) ||
                    (pointInEllipse(apex.x, apex.y, circleCenter, rx, ry) &&
                     pointInEllipse(leftPt.x, leftPt.y, circleCenter, rx, ry) &&
                     pointInEllipse(rightPt.x, rightPt.y, circleCenter, rx, ry))
                ) {
                    collisions.left = true;
                    collisions.right = true;
                    collisions.bottom = true;
                }
            }
        }

        let r = [];
        for (let o in collisions) if (collisions[o]) r.push(o);
        return r;
    }

    /** Point-in-shape test for a raw world-space point. */
    pointCollision(pointX, pointY) {
        if (!this.collision || !this.collision.enabled) return false;

        const shape = this.shape;
        const pos = this.getWorldPosition();

        switch (shape) {
            case "rect":
            case "rectangle": {
                const verts = this.getRectangleVertices();
                if (!verts) return false;
                return this.pointInRect({ x: pointX, y: pointY }, verts);
            }
            case "triangle": {
                const verts = this.getWorldTrianglePoints();
                if (!verts || verts.length !== 3) return false;
                return this.pointInTriangle(pointX, pointY, verts[0], verts[1], verts[2]);
            }
            case "circle":
            case "ellipse": {
                let rx, ry;
                let isEllipse = Array.isArray(this.radius);
                if (isEllipse) { rx = this.radius[0]; ry = this.radius[1]; }
                else { rx = this.radius || this.width / 2; ry = this.radius || this.height / 2; }

                const dx = pointX - pos.x;
                const dy = pointY - pos.y;
                return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
            }
            default: {
                const bounds = this.bounds();
                return pointX >= bounds.left && pointX <= bounds.right &&
                       pointY >= bounds.top  && pointY <= bounds.bottom;
            }
        }
    }

    getCollisionSides() { return this.sides; }
    getPreviousCollisionSides() { return this.lastCollisionSides; }
    isSideColliding(side) { return this.sides.includes(side); }
    isSideJustColliding(side) { return this.sides.includes(side) && !this.lastCollisionSides.includes(side); }
    isSideJustStopped(side) { return !this.sides.includes(side) && this.lastCollisionSides.includes(side); }

    static checkCollision(a, b, err = 0) {
        if (a instanceof Hitbox && b instanceof Hitbox) {
            const result = a.collidesWith(b, err);
            if (result) b.sides = b.determineCollisionSides(a, err);
            else b.sides = [];
            return result;
        }
        return false;
    }
}

// ============================================
// GAME OBJECT
// ============================================
// An object with one or more Hitboxes, per-tick physics, and a
// list of scripts (functions called with the object as `self`).
class gameObject extends geometryObject {
    // Swept-collision (CCD) tuning, shared by every gameObject / Entity.
    //   enabled          turn the swept path off to get plain one-step movement
    //   thresholdFactor  a move longer than (thinnest hitbox side involved * this) gets the backward cast
    //   minMove          moves shorter than this many px are never cast (pure noise)
    //   moveScale        per-tick distance scale (velocity * deltaTime * moveScale)
    //   maxIterations    blocking contacts handled per tick (triggers don't count); leftover movement is dropped
    //   penetration      px pushed into a contact so processCollisions() resolves it
    //   deepSkin         overlap deeper than this at the start counts as "already inside" (skipped by the sweep)
    static CCD = {
        enabled: true,
        thresholdFactor: 0.1,
        minMove: 0.01,
        moveScale: 10,
        maxIterations: 40,
        penetration: 0.05,
        deepSkin: 0.05,
    };

    static init() {
        if (gameObject.started) return;
        gameObject.objects = [];
        gameObject.started = true;
        gameObject.validTags = ['entity', 'static_object', 'physics_object', 'immovable_object', 'player'];
    }

    static addTag(t) {
        if (typeof t == 'string') t = t.toLowerCase();
        let test = gameObject.validTags.some(i => i == t);
        if (test) {
            new Message(`gameObject|Tag: tried adding new tag "${t}" was already an existing tag!`);
            return false;
        } else {
            gameObject.validTags.push(t);
        }
    }

    constructor(x, y, w, h, ...scenes) {
        super(x,y,w,h);
        gameObject.init();
        this.id = "MALE:gameObject[" + Math.random().toString(36).substring(2) + "]";
        this.superId = this.id;
        this.deleted = false;
        //this.transform = new Transform(x, y, w, h);
        this.x = x;
        this.y = y;
        this.tags = [];
        this.hitbox = [];
        // When true, the camera's position is added to this object's position
        // wherever the position is read (see effectivePosition), which cancels
        // the camera's translate so the object stays fixed on screen.
        this.ignoreCamera = false;

        // Default hitbox matches the object's initial size.
        var defaultHitbox = new Hitbox(this.id, "rect", 0, 0, w, h);
        defaultHitbox.setParent(this);
        this.hitbox.push(defaultHitbox);

        this.scripts = [];
        this.scenes = scenes.length < 1 ? ["blank"] : scenes;
        this.collision = {
            enabled: true,
            resolve:false,
            static: false,
            pushable: true,
            solid: false,
            sides: {
                left: false, right: false, bottom: false, top: false, embedded: false,
            },
            excluded:[],
        };
        
        /**
         * Slope physics settings. Applied only when:
         *   - this object has gravity enabled (physicsToggles.gravity)
         *   - the contact surface is a non-flat edge of a triangle,
         *     or any point of a circle/ellipse that isn't at the
         *     top/bottom axis
         *   - the contact normal isn't vertical
         *
         *   enabled:         master on/off
         *   staticFriction:  coefficient (0..1+); resists sliding when
         *                    the tangential force is below this fraction
         *                    of the normal force. tan(theta) < mu_s -> stick.
         *   kineticFriction: coefficient (0..1+); opposes sliding while
         *                    the object is already moving on the slope.
         *   minSlopeAngle:   minimum slope angle (radians) before the
         *                    object is considered "on a slope" at all.
         *   gravityScale:    multiplier applied to gravity when computing
         *                    the tangential acceleration. 1.0 = normal.
         */
        this.slopeSettings = {
            enabled: true,
            staticFriction: 0.3,
            kineticFriction: 0.2,
            minSlopeAngle: 0.05,        // ~3 degrees
            gravityScale: 1.0,
            // Peak support: an object whose footprint covers the top
            // point of a surface (a triangle apex, or the top of a
            // circle/ellipse) rests on it instead of sliding off.
            //   peakSupport:   master on/off
            //   peakTolerance: pixels of horizontal slack allowed
            //                  between a round object's centre and the
            //                  peak before it is treated as off-peak.
            peakSupport: true,
            peakTolerance: 3,
        };
        /**
         * Mass-based pushing (side-on contact between two movable objects).
         *   enabled:  master on/off. false = the old "split the overlap" push.
         *   friction: mu, the coefficient of friction between THIS object and
         *             the ground when it is the one being pushed.
         * Mass is width * height (see `mass`). See _resolveMassPush().
         */
        this.pushSettings = {
            enabled: true,
            friction: 0.2,
        };
        this.mass = w*h;
        this.massArea = true;
        this.lastGrounded = -1;
        this.colliding = false;
        this.collisions = [];
        this.friction = 0.95;
        this.bounciness = 0.5;
        this.bounce = 0.5;
        this.active = true;
        this.grounded = false;
        this.groundedOn = null;
        this._groundedStable = false;
        this._groundedFrames = 0;
        this._wasGrounded = false;
        this.physicsToggles = {
            friction: false,
            enabled: true,
            gravity: false,
        };
        this.rendering = {
            draw: {
                hitbox: false,
                shape: "rect",
                texture: null, // fire path / folder path within 'Assests'
                animations: {
                    /*
                        propertyName:[\-animationFrames / File Paths-\]
                    */
                },
            },
            color: "white",
            visible: true,
            outline: [0.1, 0 || "black"],
            debug: {
                color: "#37ff29",
                center: true,
                grounded: true,
                velocity: true,
                active:false,
            },
        };

        

        this.previousPosition = { x: x || 0, y: y || 0 };
        this._subStepCount = 0;

        if (gameObject.objects) gameObject.objects.push(this);
        else gameObject.objects = [this];
        this._index = gameObject.objects.length - 1;
        this.push(this);
    }

    

    /**
     * The camera's position as {x, y}, or {0, 0} if there is no camera yet.
     * Uses superPosition (the point Camera.render() actually translates by,
     * which accounts for camera.origin); falls back to camera.x / camera.y.
     */
    static cameraPosition() {
        const cam = (typeof World !== 'undefined') ? World.camera : null;
        if (!cam) return { x: 0, y: 0 };
        const p = cam.superPosition || cam;
        return { x: p.x || 0, y: p.y || 0 };
    }

    /**
     * Position used for drawing, hitboxes and position(). Normal objects
     * return transform.position itself. With ignoreCamera it returns a NEW
     * object: own position + camera position. Writing to the returned
     * object does not move the gameObject; use transform.position / position(mode, ...).
     */
    get effectivePosition() {
        const pos = this.transform.position;
        if (!this.ignoreCamera) return pos;
        const cam = gameObject.cameraPosition();
        return { x: pos.x + cam.x, y: pos.y + cam.y };
    }

    addHitbox(shape, ...params) {
        let hb;
        if (shape === "triangle") {
            hb = new Hitbox(this.id, shape, ...params);
        } else {
            hb = new Hitbox(
                this.id, shape,
                params[0] || 0, params[1] || 0,
                params[2] || 20, params[3] || 20
            );
        }
        hb.rendering = {
            color: "white",
            visible: true,
            outline: [0.1, 0 || "black"],
        };
        hb.setParent(this);
        this.hitbox.push(hb);
        return hb;
    }

    addTag(t) {
        if (typeof t == 'string') t = t.toLowerCase();
        let tag = gameObject.validTags.includes(t);
        if (tag) this.tags.push(t);
        else {
            console.log(`gameObject|Tag: the tag "${t}" isn't a valid tag!`);
            return false;
        }
        return this.tags;
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

        if (!s.objects.includes(this)) s.objects.push(this);
        else {
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

    /**
     * Per-tick physics update: gravity, friction, velocity clamping,
     * sub-stepped movement, and collision resolution.
     */
    update(deltaTime = 1 / 60) {
        if (this.deleted) return;
        this.id = this.superId;
        let pos = this.transform.position;
        let scale = this.transform.scale;
        let vel = this.transform.velocity;
        if(this.massArea)this.mass = scale.x*scale.y;
        if (isNaN(pos.x) || isNaN(pos.y)) {
            console.warn(`Invalid position detected for object ${this.id}, resetting to last known position`);
            pos.x = this.previousPosition.x || 0;
            pos.y = this.previousPosition.y || 0;
            return;
        }

        this.previousPosition = { x: pos.x, y: pos.y };
        this._wasGrounded = this.grounded;

        // Reset grounded each tick; processCollisions sets it again.
        if (!this.collision.static) {
            this.grounded = false;
            if (!this.grounded) this.groundedOn = null;
        } else {
            this.grounded = true;
            this.groundedOn = null;
        }
        this._onSlope = false;
        this._slopeNormal = null;
        this._slopeAngle = 0;
        const effPos = this.effectivePosition;
        this.x = effPos.x;
        this.y = effPos.y;
        this.width = scale.x;
        this.height = scale.y;

        if (this.groundedOn instanceof gameObject) {
            vel.inherited = this.groundedOn.transform.velocity.self;
        }

        vel.self.x = vel.x + (vel.inherited?.x || 0);
        vel.self.y = vel.y + (vel.inherited?.y || 0);

        // Clamp total speed.
        let maxSpeed = 3000;
        let currentSpeed = Math.sqrt(vel.self.x * vel.self.x + vel.self.y * vel.self.y);
        if (currentSpeed > maxSpeed) {
            let scaleFactor = maxSpeed / currentSpeed;
            vel.self.x *= scaleFactor;
            vel.self.y *= scaleFactor;
            vel.x *= scaleFactor;
            vel.y *= scaleFactor;
        }
        
        // Move along the velocity and run collisions. Fast moves use swept
        // collision (a backward cast over the path just travelled), so
        // nothing can be skipped over. See _backcastMove().
        this._backcastMove(deltaTime);

        // Gravity.
        if (this.physicsToggles.gravity) {
            if (this.grounded) {
                vel.y = 0;
                this.lastGrounded = typeof World !== 'undefined' ? World.time : Date.now() / 1000;
            } else {
                const gravity = (typeof World !== 'undefined' && World.defaults?.gameObject?.gravity) || 500;
                const terminalVelocity = (typeof World !== 'undefined' && World.defaults?.gameObject?.terminalVelocity) || 2000;
                const gravWeight = limit(this.mass/Math.abs(vel.x),0,1);
                vel.y = Math.min((vel.y || 0) + (gravity*gravWeight) * deltaTime, terminalVelocity);
                
                //console.log(vel.y,gravWeight);
                
            }
        }

        // Friction.
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


    /**
     * Union of this object's enabled hitbox bounds (inflated by `err`),
     * or null if it has none. Used by _backcastMove's broad-phase.
     */
    _hitboxBounds(err = 0) {
        let u = null;
        this.hitbox.forEach((hb) => {
            if (!hb.collision || !hb.collision.enabled) return;
            const b = hb.bounds(err);
            if (!u) u = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
            else {
                u.left   = Math.min(u.left,   b.left);
                u.right  = Math.max(u.right,  b.right);
                u.top    = Math.min(u.top,    b.top);
                u.bottom = Math.max(u.bottom, b.bottom);
            }
        });
        return u;
    }

    /**
     * Thinnest side of one hitbox (its real size, not its rotated bounding box).
     * Used to decide when a move is long enough to need a backward cast.
     */
    static _thinnest(hb) {
        if (hb.shape === "triangle") {
            const bb = hb.bounds(0);
            return Math.min((bb.right - bb.left) * 0.5, (bb.bottom - bb.top) * 0.5);
        }
        return Math.min(hb.transform.scale.x || 20, hb.transform.scale.y || 20);
    }

    /**
     * Moves the object along its velocity for one tick, then looks BACK along
     * the path it just travelled to find anything it should have stopped at.
     *
     *   move = velocity.self * deltaTime * CCD.moveScale     (per-tick distance)
     *
     *   1. Apply the whole move (velocity is applied first - no prediction).
     *   2. Cast a ray backwards from the new position to the old one
     *      (Hitbox.backcast) against every solid hitbox the path could touch.
     *      Each pair gives the moment the object first entered the other one;
     *      the pair with the EARLIEST entry is the object that was really hit.
     *   3. No hit: keep the end position and run processCollisions() there.
     *      Hit: rewind to the contact (+ CCD.penetration so the overlap is
     *      real) and run processCollisions(), which resolves it and cancels
     *      the velocity into it.
     *   4. Spend the rest of the tick on the corrected velocity (slide along the
     *      wall / floor) by applying it and casting back again from 2.
     *
     * Because it measures what the path actually crossed, a thin wall can't be
     * skipped however fast or short the move is. Moves too small to cross the
     * thinnest hitbox involved (CCD.thresholdFactor) skip the cast entirely.
     *
     * Hitboxes that don't resolve (triggers, excluded objects) are still
     * detected at the moment of contact but don't stop the object.
     *
     * this.collisions / this.collision.sides are merged across every
     * processCollisions() call made during the move, so a contact made
     * mid-move is still visible to scripts at the end of the tick.
     *
     * Side effects: transform.position, hitbox positions, velocity (via
     * resolution), this._subStepCount (contacts processed + final step).
     */
    _backcastMove(deltaTime) {
        const S = gameObject.CCD;
        const pos = this.transform.position;
        const vel = this.transform.velocity;
        this._ccdHits = null;        // contacts kept from last tick's move (see processCollisions)

        const toMove = () => ({
            x: (vel.self.x || 0) * deltaTime * S.moveScale,
            y: (vel.self.y || 0) * deltaTime * S.moveScale,
        });
        const syncHitboxes = () => this.hitbox.forEach((hb) => {
            hb.updatePosition();
            hb.width = hb.transform.scale.x || 20;
            hb.height = hb.transform.scale.y || 20;
        });
        const advance = (dx, dy) => {
            pos.x += dx;
            pos.y += dy;
            if (isNaN(pos.x) || isNaN(pos.y)) {
                console.warn(`Position became NaN for object ${this.id}, reverting to previous position`);
                pos.x = this.previousPosition.x || 0;
                pos.y = this.previousPosition.y || 0;
                return false;
            }
            syncHitboxes();
            return true;
        };

        const move = toMove();
        const gap = Math.hypot(move.x, move.y);
        this._subStepCount = 1;

        // Thinnest of my own hitboxes.
        let minDim = Infinity;
        this.hitbox.forEach((hb) => {
            if (!hb.collision || !hb.collision.enabled) return;
            minDim = Math.min(minDim, gameObject._thinnest(hb));
        });
        if (!isFinite(minDim)) minDim = Math.min(this.transform.scale.x, this.transform.scale.y);

        const scene = (S.enabled && gap > S.minMove) ? this.getParentScene() : null;
        if (!scene) {
            if (!advance(move.x, move.y)) return;
            this.processCollisions();
            return;
        }

        // ---- Broad-phase: solid objects near the whole path (start footprint .. end footprint) ----
        // Padded by a share of the move because resolution can bend the path.
        const pad = 2 + gap * 0.25;
        const sb = this._hitboxBounds(0) || { left: pos.x, right: pos.x, top: pos.y, bottom: pos.y };
        const swept = {
            left:   sb.left   + Math.min(0, move.x) - pad,
            right:  sb.right  + Math.max(0, move.x) + pad,
            top:    sb.top    + Math.min(0, move.y) - pad,
            bottom: sb.bottom + Math.max(0, move.y) + pad,
        };
        let thinnest = minDim;           // thinnest hitbox that could be crossed (mine or theirs)
        const candidates = scene.objects.filter((other) => {
            if (other === this || other.id === this.id || other.deleted || !other.active) return false;
            if (!other.collision || !other.collision.enabled || !other.collision.solid) return false;
            return other.hitbox.some((hb) => {
                if (!hb.collision || !hb.collision.enabled) return false;   // disabled hitboxes can't collide
                const ob = hb.bounds(0);
                const near = ob.left < swept.right && ob.right > swept.left &&
                             ob.top  < swept.bottom && ob.bottom > swept.top;
                if (near) thinnest = Math.min(thinnest, gameObject._thinnest(hb));
                return near;
            });
        });

        // ---- Short move: can't cross anything thinner than itself, so plain step ----
        if (candidates.length === 0 || gap <= thinnest * S.thresholdFactor) {
            if (!advance(move.x, move.y)) return;
            this.processCollisions();
            return;
        }

        // Everything processCollisions() reports during the move.
        const merged = [];
        const sideAcc = {};
        const record = () => {
            this.collisions.forEach((c) => {
                if (!merged.some((m) => m.thisHitbox === c.thisHitbox && m.otherHitbox === c.otherHitbox)) merged.push(c);
            });
            Object.keys(this.collision.sides).forEach((k) => {
                if (this.collision.sides[k]) sideAcc[k] = this.collision.sides[k];
            });
        };

        // Pairs (my hitbox, other hitbox) that can't stop us any more this tick. Keyed by the PAIR:
        // one of my hitboxes that doesn't resolve (a melee / sensor box) touching a wall must not
        // stop the wall from blocking my solid hitbox.
        const skip = new Map();          // my hitbox -> Set of other hitboxes
        const skipped = (th, oh) => skip.has(th) && skip.get(th).has(oh);
        const addSkip = (th, oh) => {
            if (!skip.has(th)) skip.set(th, new Set());
            skip.get(th).add(oh);
        };
        let used = 0;                    // fraction of this tick's move already travelled
        let rem = move;                  // displacement still to travel
        let contacts = 0;
        let blocking = 0;                // contacts that actually stopped / redirected the object

        for (let iter = 0; iter < S.maxIterations + 64 && blocking < S.maxIterations; iter++) {
            const remLen = Math.hypot(rem.x, rem.y);
            if (remLen < 1e-4) break;    // nothing left to travel (last position was already tested)

            // ---- 1. Apply the remaining velocity: the object is now at the END of the move ----
            if (!advance(rem.x, rem.y)) return;

            // ---- 2. Cast back from here to where it was; keep the EARLIEST entry ----
            let best = null;
            for (const other of candidates) {
                if (other.deleted) continue;
                const excluded = this.collision.excluded.includes(other);
                for (const oh of other.hitbox) {
                    if (!oh.collision || !oh.collision.enabled) continue;
                    for (const th of this.hitbox) {
                        if (!th.collision || !th.collision.enabled || skipped(th, oh)) continue;
                        const t = Hitbox.backcast(th, oh, rem.x, rem.y, S.deepSkin);
                        if (t === null) continue;
                        if (t === "inside") { addSkip(th, oh); continue; }   // already overlapping at the start: resolution's job
                        if (!best || t < best.t) {
                            // Would processCollisions() resolve this pair (and so stop the object)?
                            const resolves = !excluded &&
                                this.collision.resolve && other.collision.resolve &&
                                th.collision.resolve && oh.collision.resolve && oh.collision.solid &&
                                (this.collision.solid || other.collision.solid);
                            best = { t, th, oh, resolves };
                        }
                    }
                }
            }

            // ---- 3a. Path was clear: keep the end position ----
            if (!best) {
                this.processCollisions();
                record();
                contacts++;
                break;
            }

            // ---- 3b. Rewind to the first contact (just inside it) and resolve there ----
            const tt = Math.min(1, best.t + S.penetration / remLen);
            if (!advance(-rem.x * (1 - tt), -rem.y * (1 - tt))) return;

            const vxBefore = vel.x, vyBefore = vel.y;
            this.processCollisions();
            record();
            contacts++;
            if (best.resolves) blocking++;
            else addSkip(best.th, best.oh);            // detected; this pair just doesn't block movement

            // ---- 4. Spend what is left of the tick on the velocity resolution left us with ----
            vel.self.x += vel.x - vxBefore;
            vel.self.y += vel.y - vyBefore;
            used += (1 - used) * tt;
            const full = toMove();
            rem = { x: full.x * (1 - used), y: full.y * (1 - used) };
        }
        // (If maxIterations ran out, the leftover movement is dropped - the
        //  object stays at its last resolved contact instead of risking a skip.)

        this._subStepCount = Math.max(1, contacts);
        if (contacts > 0) {
            // Kept until the next move: scripts run after update() and usually call
            // processCollisions() again at the END position, which would otherwise
            // forget a contact made mid-move (a fast bullet that crossed its target).
            this._ccdHits = { collisions: merged, sides: sideAcc };
            this.collisions = merged;
            Object.keys(sideAcc).forEach((k) => {
                if (this.collision.sides.hasOwnProperty(k)) this.collision.sides[k] = sideAcc[k];
            });
        }
    }

    /**
     * Returns true if moving this object to (x, y) would put any of its
     * hitboxes in contact with a solid hitbox of another active object in
     * the current scene. Does not modify the transform permanently -
     * the position is restored before returning.
     *
     * `err` inflates the shapes for the test (0 = exact overlap).
     * `candidates` (optional) restricts the check to a pre-filtered list
     * of `other` objects; if omitted, every object in the scene is checked.
     *
     * This is the "ray" primitive the sweep in update() uses. It mirrors
     * the filtering processCollisions() does (active / collision enabled /
     * solid), so the sweep stops exactly where detection would fire.
     */
    _collidesAt(x, y, err = 0, candidates = null) {
        if (!this.collision || !this.collision.enabled) return false;
        const scene = this.getParentScene();
        if (!scene) return false;

        const origX = this.transform.position.x;
        const origY = this.transform.position.y;
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.hitbox.forEach((hb) => hb.updatePosition());

        const others = candidates || scene.objects;
        let hit = false;

        for (const other of others) {
            if (hit) break;
            if (other.id === this.id || other.deleted || !other.active) continue;
            if (!other.collision || !other.collision.enabled || !other.collision.solid) continue;

            for (const otherHb of other.hitbox) {
                if (hit) break;
                if (!otherHb.collision || !otherHb.collision.enabled) continue;

                for (const thisHb of this.hitbox) {
                    if (!thisHb.collision || !thisHb.collision.enabled) continue;
                    if (thisHb.collidesWith(otherHb, err)) {
                        hit = true;
                        break;
                    }
                }
            }
        }

        this.transform.position.x = origX;
        this.transform.position.y = origY;
        this.hitbox.forEach((hb) => hb.updatePosition());

        return hit;
    }
    collidesAtPoint(x,y,err = 0){
        if (!this.collision || !this.collision.enabled) return false;
        const scene = this.getParentScene();
        if (!scene) return false;
        var result = false;
        this.hitbox.forEach(hb => {
            if (!hb.collision || !hb.collision.enabled) return;
            const bounds = hb.bounds(err);
            
            if(bounds.left < x && 
                bounds.right > x &&
                bounds.top < y && 
                bounds.bottom > y
            )
            result = true;

        });
        return result;
    }
    /**
     * Collision detection + resolution in one pass, per sub-step.
     * Detection uses a small error margin; resolution uses none.
     */
    processCollisions() {
        let scene = this.getParentScene();
        if (!scene) return;

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

        this.hitbox.forEach((hb) => hb.updatePosition());

        // Find the lowest hitbox for grounded detection.
        let lowestHitbox = null;
        let lowestY = -Infinity;
        let lowestHitboxIndex = -1;

        this.hitbox.forEach((hb, index) => {
            // Disabled / non-solid / non-resolving hitboxes (melee boxes, sensors) can't be the feet.
            if (!hb.collision || !hb.collision.enabled || !hb.collision.solid || !hb.collision.resolve) return;
            let bounds = hb.bounds();
            if (bounds.bottom > lowestY) {
                lowestY = bounds.bottom;
                lowestHitbox = hb;
                lowestHitboxIndex = index;
            }
        });

        // Pass 1: detect.
        let collisions = [];
        
        scene.objects.forEach((other) => {
            if (other.id === this.id || other.deleted || !other.active) return;
            if (!other.collision || !other.collision.enabled || !other.collision.solid) return;
            if (!this.collision.enabled) return;
            var excluded = false;
            this.collision.excluded.forEach(ex => {
                if(ex == other)excluded = true;
            });
            other.hitbox.forEach((hb) => {
                if(hb.collision.solid && hb.collision.enabled)hb.updatePosition()
            });

            this.hitbox.forEach((thisHitbox, index) => {
                if (!thisHitbox.collision || !thisHitbox.collision.enabled) return;
                
                other.hitbox.forEach((otherHitbox) => {
                    if (!otherHitbox.collision || !otherHitbox.collision.enabled) return;
                    const _collisionalData = [
                        thisHitbox.collidesWith(otherHitbox, 1.0,true),
                        otherHitbox.collidesWith(thisHitbox, 1.0,true)];

                    if (thisHitbox.collidesWith(otherHitbox, 1.0)) {
                        
                        

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
                        if (sides.includes("embedded")) this.collision.sides.embedded = true;

                        if (index === lowestHitboxIndex && sides.includes("bottom") && !excluded && thisHitbox.collision.solid &&
                            this.collision.resolve && other.collision.resolve &&
                            thisHitbox.collision.resolve && otherHitbox.collision.resolve && otherHitbox.collision.solid) {
                            if (this.collision.solid) {
                                if (other.grounded) {
                                    this.grounded = true;
                                    this.groundedOn = other;
                                } else {
                                    this.grounded = false;
                                    this.groundedOn = null;
                                }
                            }
                        }
                        const cross = ['right','left','top','bottom'];
                        let crossed = {
                            left:false,
                            right:false,
                            top:false,
                            bottom:false,
                        };
                        Object.keys(_collisionalData[0]).forEach((side,index) => {
                            //oppisite side of the current side
                            let _oot = _collisionalData[1][cross[index]];
                            crossed[side] = _collisionalData[0][side] && _oot;
                        });
                        collisions.push({
                            thisHitbox, otherHitbox, other, index, excluded,
                            sides: crossed,
                        });
                    }
                });
            });
        });

        // Peak grounding: an object balanced exactly on a peak (triangle
        // apex / top of a circle) only touches at a single point, which
        // the overlap test can miss on alternate frames. Keep it grounded
        // when its lowest hitbox is within 1px of a supporting peak.
        if (!this.grounded && lowestHitbox && this.collision.solid &&
            this.physicsToggles.gravity && this.slopeSettings.peakSupport) {
            const lb = lowestHitbox.bounds();
            scene.objects.forEach((other) => {
                if (this.grounded || other.id === this.id || other.deleted || !other.active) return;
                if (!other.collision || !other.collision.enabled || !other.collision.resolve || !other.collision.solid) return;
                if (!(other.collision.static || !other.collision.pushable)) return;
                var excluded = false;
                this.collision.excluded.forEach(ex => {
                    if(ex == other)excluded = true;
                });
                if(!excluded)
                other.hitbox.forEach((hb) => {
                    if (this.grounded || !hb.collision || !hb.collision.enabled || !hb.collision.resolve || !hb.collision.solid) return;
                    const peak = this._getPeakPoint(hb);
                    if (!peak) return;
                    if (Math.abs(lb.bottom - peak.y) > 1.0) return;
                    if (!this._isSupportedByPeak(hb, lowestHitbox)) return;
                    this.grounded = true;
                    this.groundedOn = other;
                });
            });
        }

        // Pass 2: resolve. Skipped entirely for pairs where either
        // side has collision.resolve === false.
        let vel = this.transform.velocity;
        
        if (Math.abs(vel.x) > 0.01 || Math.abs(vel.y) > 0.01 || this.collision.solid) {
            for (let i = 0; i < collisions.length; i++) {
                const coll = collisions[i];
                if(coll.excluded) continue;
                // Skip resolution if either object opts out.
                if (!this.collision.resolve || !coll.other.collision.resolve) continue;
                if (!coll.thisHitbox.collision.resolve || !coll.otherHitbox.collision.resolve || !coll.otherHitbox.collision.solid) continue;

                if (coll.thisHitbox.collidesWith(coll.otherHitbox, 0)) {
                    if (this.collision.solid || coll.other.collision.solid) {
                        if(!coll.excluded)this.resolveCollision(coll.other, coll.thisHitbox, coll.otherHitbox);
                    }
                }
            }
        }

        // Contacts the swept move made earlier this tick (see _backcastMove) still count,
        // even though the object may no longer be touching them at its end position.
        if (this._ccdHits) {
            this._ccdHits.collisions.forEach((c) => {
                if (c.other.deleted) return;
                if (collisions.some((m) => m.thisHitbox === c.thisHitbox && m.otherHitbox === c.otherHitbox)) return;
                collisions.push(c);
            });
            Object.keys(this._ccdHits.sides).forEach((k) => {
                if (this.collision.sides.hasOwnProperty(k)) this.collision.sides[k] = true;
            });
        }
        this.collisions = [...collisions];
    }

    setGravityObject(n = true) {
        this.collision.static = !n;
        this.collision.solid = n;
        this.collision.resolve = true;
        this.physicsToggles.gravity = n;
        this.physicsToggles.friction = n;
    }

    setStaticObject(n = true) {
        this.collision.static = n;
        this.collision.solid = n;
        this.collision.resolve = true;
        this.physicsToggles.gravity = !n;
        this.physicsToggles.friction = !n;
    }

    setImmovableObject(n = true) {
        this.collision.static = n;
        this.collision.pushable = !n;
        this.collision.resolve = true;
        this.physicsToggles.gravity = !n;
        this.physicsToggles.friction = !n;
    }
    setGhostObject(n = true){
        this.collision.static = !n;
        this.collision.pushable = !n;
        this.collision.resolve = true;
        this.physicsToggles.gravity = !n;
        this.physicsToggles.friction = !n;
    }
    /**
     * Mass-based push for side-on contact (horizontal axis only).
     *
     * The object driving into the other one is the PUSHER, the other is the
     * PUSHED object. Mass = width * height. With mu = pushed.pushSettings.friction:
     *
     *   Push = m_pusher * v_closing / dt      force needed to bring the closing
     *                                         speed to zero in one tick
     *   a    = (Push - mu * m_pushed * g) / m_pushed
     *
     * - The pushed object gains a * dt of velocity (never below 0, so friction
     *   holds it still when Push <= mu * m * g, and never more than the closing
     *   speed, so it can't outrun the thing pushing it). Simplified:
     *       dv = (m_pusher / m_pushed) * v_closing - mu * g * dt
     * - The overlap is split by how far the pushed object actually gives:
     *   it takes dv / v_closing of it, the pusher gets pushed back by the rest.
     *   While friction holds, the pusher keeps its velocity (it is "leaning" on
     *   the object), so its speed builds up until Push beats friction.
     * - Pusher lighter than the pushed object: its closing speed is cut by
     *   (1 - m_pusher / m_pushed), so it slows down. Pusher the same weight or
     *   heavier: its velocity is left alone.
     *
     * Returns false (and changes nothing) when it does not apply: either object
     * can't move (static / not pushable), pushSettings.enabled is false on the
     * pushed object, or neither is moving into the other.
     */
    _resolveMassPush(other, overlap, dirX) {
        const thisCanMove  = this.collision.pushable && !this.collision.static;
        const otherCanMove = other.collision.pushable && !other.collision.static;
        if (!thisCanMove || !otherCanMove) return false;

        // dirX is the way `this` gets pushed out. Speed of each object toward
        // the other one:
        const vel      = this.transform.velocity;
        const otherVel = other.transform.velocity;
        const thisIn   = -vel.x * dirX;
        const otherIn  =  otherVel.x * dirX;

        let pusher, pushed, s;               // s = +/-1, direction pusher -> pushed
        if (thisIn > 0 && thisIn >= otherIn) { pusher = this;  pushed = other; s = -dirX; }
        else if (otherIn > 0)                { pusher = other; pushed = this;  s =  dirX; }
        else return false;

        const settings = pushed.pushSettings;
        if (settings && settings.enabled === false) return false;

        const mPusher = pusher.mass;
        const mPushed = pushed.mass;
        if (!(mPusher > 0) || !(mPushed > 0)) return false;

        const pv = pusher.transform.velocity;
        const dv = pushed.transform.velocity;
        const closing = pv.x * s - dv.x * s;          // pusher speed minus pushed speed along s
        if (closing <= 0) return false;

        const mu = (settings && Number.isFinite(settings.friction)) ? settings.friction : 0.2;
        const g  = (typeof World !== 'undefined' && World.defaults?.gameObject?.gravity) || 500;
        const dt = (typeof World !== 'undefined' && World._tickDeltaSeconds) ? World._tickDeltaSeconds : 1 / 60;

        // a = (Push - mu * m * g) / m
        const resistence = Math.pow((mPusher/mPushed),1.75);
        const push = mPusher * closing*resistence / dt;
        const a    = (push - mu * mPushed * g) / mPushed;
        const gain = Math.min(Math.max(a * dt, 0), closing);   // velocity the pushed object picks up
        const give = gain / closing;                           // 0 = held by friction, 1 = moves with pusher

        dv.x += s * gain;
        if (mPusher < mPushed) {
            pv.x -= s * (1 - mPusher / mPushed) * closing;     // lighter pusher slows down
        }

        pushed.transform.position.x += s * overlap * give;
        pusher.transform.position.x -= s * overlap * (1 - give);
        return true;
    }

    /**
     * Resolves a collision. If the contact is on a slope (a
     * non-flat triangle edge or a circle/ellipse boundary), applies
     * slope physics: gravity is projected onto the slope's normal
     * and tangent, static friction may hold the object, otherwise
     * the tangential component accelerates the object down the slope.
     *
     * Otherwise falls back to the axis-aligned minimum-penetration
     * push (existing behavior).
     */
    resolveCollision(other, thisHitbox, otherHitbox) {
        if (!this.collision.resolve || !other.collision.resolve) return;
        if (!thisHitbox.collision.resolve || !otherHitbox.collision.resolve) return;

        const thisBounds  = thisHitbox.bounds();
        const otherBounds = otherHitbox.bounds();
        const pos         = this.transform.position;
        const otherPos    = other.transform.position;
        const vel         = this.transform.velocity;
        const otherVel    = other.transform.velocity;

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

        // ---- 1. Try slope resolution ----
        const slopeResult = this._tryResolveSlope(other, thisHitbox, otherHitbox);
        if (slopeResult) {
            this.hitbox.forEach((hb) => hb.updatePosition());
            other.hitbox.forEach((hb) => hb.updatePosition());
            return;
        }

        // ---- 2. Fallback: axis-aligned minimum-penetration push ----
        const overlapX = Math.min(thisBounds.right - otherBounds.left,
                                otherBounds.right - thisBounds.left);
        const overlapY = Math.min(thisBounds.bottom - otherBounds.top,
                                otherBounds.bottom - thisBounds.top);

        if (overlapX <= 0 || overlapY <= 0) return;

        const resolveHorizontal = overlapX < overlapY;

        const thisCx = (thisBounds.left + thisBounds.right) / 2;
        const otherCx = (otherBounds.left + otherBounds.right) / 2;
        const thisCy = (thisBounds.top + thisBounds.bottom) / 2;
        const otherCy = (otherBounds.top + otherBounds.bottom) / 2;

        const dirX = thisCx < otherCx ? -1 : 1;
        const dirY = thisCy < otherCy ? -1 : 1;

        const thisCanMove  = this.collision.pushable && !this.collision.static;
        const otherCanMove = other.collision.pushable && !other.collision.static;

        let thisShare  = 0;
        let otherShare = 0;

        if (thisCanMove && otherCanMove) {
            thisShare = 0.5; otherShare = 0.5;
        } else if (thisCanMove) {
            thisShare = 1; otherShare = 0;
        } else if (otherCanMove) {
            thisShare = 0; otherShare = 1;
        }

        // Velocity is only cancelled when an object is moving INTO the other
        // one. `this` is pushed along dir (dirX / dirY) and `other` along -dir,
        // so `this` moves into other when vel * dir < 0, and `other` moves into
        // this when otherVel * dir > 0. An object already moving away keeps its
        // velocity. (Zeroing it unconditionally wiped an upward jump/flight
        // velocity every time the pair still overlapped - and with a pushable
        // object underneath, which only takes half of the push and gets pressed
        // back by whatever it rests on, they overlapped for many ticks, so the
        // object on top could never rise.)
        if (resolveHorizontal) {
            // Two movable objects, one driving into the other: mass-based push.
            // Anything else (walls, static / non-pushable objects, no closing
            // speed) keeps the plain overlap push below.
            if (!this._resolveMassPush(other, overlapX, dirX)) {
                const push = overlapX;
                if (thisShare > 0)  pos.x      += dirX * push * thisShare;
                if (otherShare > 0) otherPos.x -= dirX * push * otherShare;
                if (vel.x * dirX < 0) vel.x = 0;
                if (otherCanMove && otherVel.x * dirX > 0) otherVel.x = 0;
            }
        } else {
            const push = overlapY;
            if (thisShare > 0)  pos.y      += dirY * push * thisShare;
            if (otherShare > 0) otherPos.y -= dirY * push * otherShare;
            if (vel.y * dirY < 0) vel.y = 0;
            if (otherCanMove && otherVel.y * dirY > 0) otherVel.y = 0;

            if (dirY < 0 && this.collision.solid) {
                this.grounded = true;
                this.groundedOn = other;
            }
        }

        this.hitbox.forEach((hb) => hb.updatePosition());
        other.hitbox.forEach((hb) => hb.updatePosition());

        if (isNaN(pos.x) || isNaN(pos.y)) {
            pos.x = this.previousPosition?.x || 0;
            pos.y = this.previousPosition?.y || 0;
        }
        if (isNaN(otherPos.x) || isNaN(otherPos.y)) {
            otherPos.x = other.previousPosition?.x || 0;
            otherPos.y = other.previousPosition?.y || 0;
        }
    }

    /**
     * Chooses which edge of a triangle `thisHitbox` is really touching,
     * based on the side it CAME FROM. Only edges whose outward face the
     * hitbox was on (at the start of this tick) are candidates, and of
     * those the one it has sunk into the least wins (minimum push).
     * This stops an object that hit the right side from being pushed out
     * through the left side or the base just because that edge happened
     * to be nearer its centre.
     *
     * Returns { n: outward unit normal, depth } or null if no edge
     * qualifies (caller falls back to the old nearest-edge logic).
     */
    _pickTriangleEdge(triHitbox, thisHitbox) {
        const v = triHitbox.getWorldTrianglePoints(0);
        if (!v || v.length !== 3) return null;
        const cen = {
            x: (v[0].x + v[1].x + v[2].x) / 3,
            y: (v[0].y + v[1].y + v[2].y) / 3,
        };
        const pos = this.transform.position;
        const prev = this.previousPosition || pos;
        const mx = pos.x - prev.x;
        const my = pos.y - prev.y;

        let best = null;
        for (let i = 0; i < 3; i++) {
            const a = v[i];
            const c = v[(i + 1) % 3];
            const ex = c.x - a.x, ey = c.y - a.y;
            const el = Math.hypot(ex, ey);
            if (el < 1e-6) continue;
            let nx = -ey / el, ny = ex / el;
            if (nx * (cen.x - a.x) + ny * (cen.y - a.y) > 0) { nx = -nx; ny = -ny; }

            const sup = thisHitbox.getSupportPoint(-nx, -ny);
            const depth = (a.x - sup.x) * nx + (a.y - sup.y) * ny;   // >0: past this edge's plane
            if (depth <= 0) continue;

            // Where was that same point at the start of the tick?
            const prevDepth = depth + (mx * nx + my * ny);
            if (prevDepth > 1.5) continue;                           // it came from behind this edge

            if (!best || depth < best.depth) best = { n: { x: nx, y: ny }, depth };
        }
        return best;
    }

    /**
     * Returns the topmost support point of `surfaceHitbox` (world
     * space), or null if it has none that counts as a peak.
     *   - triangle: the highest vertex, only when BOTH neighbouring
     *     vertices are lower (both attached edges descend away).
     *   - circle/ellipse: the top of the boundary.
     */
    _getPeakPoint(surfaceHitbox) {
        const EPS = 1e-6;
        if (surfaceHitbox.shape === "triangle") {
            const v = surfaceHitbox.getWorldTrianglePoints(0);
            if (!v || v.length !== 3) return null;
            let top = 0;
            for (let i = 1; i < 3; i++) if (v[i].y < v[top].y) top = i;
            const a = v[(top + 1) % 3];
            const b = v[(top + 2) % 3];
            if (a.y > v[top].y + EPS && b.y > v[top].y + EPS) {
                return { x: v[top].x, y: v[top].y };
            }
            return null;   // flat top / vertical edge: normal logic handles it
        }
        if (surfaceHitbox.shape === "circle" || surfaceHitbox.shape === "ellipse") {
            const pos = surfaceHitbox.getWorldPosition();
            const isEllipse = Array.isArray(surfaceHitbox.radius);
            const ry = isEllipse ? surfaceHitbox.radius[1]
                                 : (surfaceHitbox.radius || surfaceHitbox.height / 2);
            return { x: pos.x, y: pos.y - ry };
        }
        return null;
    }

    /**
     * True when `thisHitbox` is resting on the peak of
     * `surfaceHitbox`: the peak is above the object's centre line
     * (the object is on top, not beside it) and lies under the
     * object's footprint.
     *   - rect / triangle object: peak.x inside its horizontal extent
     *   - circle / ellipse object: peak.x within peakTolerance of its
     *     centre (a round body only balances on a point directly
     *     below its centre)
     */
    _isSupportedByPeak(surfaceHitbox, thisHitbox) {
        const peak = this._getPeakPoint(surfaceHitbox);
        if (!peak) return false;

        const b = thisHitbox.bounds();
        const cx = (b.left + b.right) / 2;
        const cy = (b.top + b.bottom) / 2;

        // Object must be above the peak, not beside / below it. A fast
        // faller can be several px past the peak by the time contact is
        // detected, so also accept "its bottom was at/above the peak at
        // the start of this tick".
        const dy = this.transform.position.y - (this.previousPosition?.y ?? this.transform.position.y);
        const prevBottom = b.bottom - dy;
        const camefromAbove = prevBottom <= peak.y + 1;
        if (cy >= peak.y && !camefromAbove) return false;

        if (thisHitbox.shape === "circle" || thisHitbox.shape === "ellipse") {
            const tol = this.slopeSettings.peakTolerance;
            return Math.abs(peak.x - cx) <= tol;
        }
        return peak.x >= b.left && peak.x <= b.right;
    }

    /**
     * Attempts slope-physics resolution against `other`. Returns
     * true if it handled the collision, false to fall back.
     *
     * Applicability:
     *   - this.collision.solid must be true
     *   - this.physicsToggles.gravity must be true
     *   - this.slopeSettings.enabled must be true
     *   - `other` must be static OR immovable (not pushable) so
     *     slope physics doesn't fight momentum transfer between
     *     two movable objects. Movable-vs-movable slopes fall
     *     through to the axis-aligned push.
     *   - The contact normal (from the OTHER object) must be
     *     sloped (n.x != 0) and above minSlopeAngle.
     */
    _tryResolveSlope(other, thisHitbox, otherHitbox) {
        if (!this.collision.solid) return false;
        if (!this.physicsToggles.gravity) return false;
        if (!this.slopeSettings.enabled) return false;

        // Only against effectively-static surfaces, otherwise two
        // movable objects would each try to slide down the other.
        const otherIsStatic = other.collision.static || !other.collision.pushable;
        if (!otherIsStatic) return false;

        // Which hitbox is the "surface"? If the other object is a
        // triangle or circle/ellipse, use its surface normal. If
        // this object is the one with a sloped hitbox, swap roles.
        let surfaceHitbox = null;
        let surfaceIsSelf = false;

        if (otherHitbox.shape === "triangle" ||
            otherHitbox.shape === "circle" ||
            otherHitbox.shape === "ellipse") {
            surfaceHitbox = otherHitbox;
        } else if (thisHitbox.shape === "triangle" ||
                thisHitbox.shape === "circle" ||
                thisHitbox.shape === "ellipse") {
            surfaceHitbox = thisHitbox;
            surfaceIsSelf = true;
        } else {
            // Rect-vs-rect: no slope.
            return false;
        }

        // ---- Peak support ----
        // If this object is sitting on the topmost point of the
        // surface (triangle apex / top of a circle), it is supported
        // by that point and must not be pushed down either side.
        if (!surfaceIsSelf && this.slopeSettings.peakSupport &&
            this._isSupportedByPeak(surfaceHitbox, thisHitbox)) {
            return false;   // axis-aligned push keeps it standing + grounded
        }

        // Triangles: decide the contact edge from the side the object
        // came from (see _pickTriangleEdge). Otherwise measure from the
        // hitbox that actually collided (NOT hitbox[0]: an object can own
        // several hitboxes at different offsets, and measuring from the
        // wrong one flips the normal to the wrong side of the surface).
        let normal, isSloped, trueDepth = null;
        const picked = (!surfaceIsSelf && surfaceHitbox.shape === "triangle")
            ? this._pickTriangleEdge(surfaceHitbox, thisHitbox) : null;

        if (picked) {
            normal = picked.n;
            isSloped = Math.abs(normal.x) > 1e-3;
            trueDepth = picked.depth;
        } else {
            const touchingHitbox = surfaceIsSelf ? otherHitbox : thisHitbox;
            let contactSource = touchingHitbox;
            if (surfaceIsSelf && (touchingHitbox.shape === "rect" || touchingHitbox.shape === "rectangle")) {
                // A rect is wide: its centre is a poor contact reference.
                // Use the point of the rect nearest to our own centre.
                const sp = surfaceHitbox.getWorldPosition();
                const rb = touchingHitbox.bounds();
                const q = {
                    x: Math.max(rb.left, Math.min(sp.x, rb.right)),
                    y: Math.max(rb.top,  Math.min(sp.y, rb.bottom)),
                };
                contactSource = { getWorldPosition: () => q };
            }

            const contactPoint = surfaceHitbox.getContactPoint(contactSource);
            if (!contactPoint) return false;

            // Outward normal at that point.
            const normalInfo = surfaceHitbox.getSurfaceNormalAt(contactPoint);
            if (!normalInfo) return false;
            normal = normalInfo.normal;
            isSloped = normalInfo.isSloped;

            // True overlap depth along the normal (replaces the old
            // bounding-box estimate, which overshoots on slopes).
            if (!surfaceIsSelf) {
                const sup = thisHitbox.getSupportPoint(-normal.x, -normal.y);
                const d = (contactPoint.x - sup.x) * normal.x + (contactPoint.y - sup.y) * normal.y;
                if (isFinite(d)) trueDepth = Math.max(0, d);
            }
        }

        if (!isSloped) {
            // Flat top of a triangle / circle at top: fall through to
            // the axis-aligned push so the object rests normally.
            return false;
        }

        // The normal we want is the one pushing THIS object away
        // from the surface. If the surface is `other`, its outward
        // normal points from other toward this. If the surface is
        // `this`, flip.
        let n = { x: normal.x, y: normal.y };
        if (surfaceIsSelf) {
            n.x = -n.x;
            n.y = -n.y;
        }

        // Angle between the normal and straight up (0, -1).
        // A horizontal surface has normal (0, -1) -> angle 0.
        // A slope has normal tilted -> angle > 0.
        const upX = 0, upY = -1;
        const cosA = n.x * upX + n.y * upY;
        const slopeAngle = Math.acos(Math.max(-1, Math.min(1, cosA)));

        if (slopeAngle < this.slopeSettings.minSlopeAngle) {
            // Almost flat -> axis-aligned push.
            return false;
        }

        // ---- Compute tangential gravity ----
        // Gravity vector in world space (y-down convention: +y is down).
        const g = ((typeof World !== 'undefined' && World.defaults?.gameObject?.gravity) || 500)
            * this.slopeSettings.gravityScale;

        // Project gravity onto the normal: gN = (g . n) n.
        // Project gravity onto the tangent: gT = g - gN.
        const gVec = { x: 0, y: g };
        const gDotN = gVec.x * n.x + gVec.y * n.y;
        const gN = { x: gDotN * n.x, y: gDotN * n.y };
        const gT = { x: gVec.x - gN.x, y: gVec.y - gN.y };
        const gTMag = Math.hypot(gT.x, gT.y);
        
        // Static friction: if the tangential gravity is smaller than
        // mu_s * |gN|, the object sticks. Otherwise kinetic friction
        // opposes the tangential motion.
        const normalForceMag = Math.abs(gDotN);
        const staticFrictionLimit = this.slopeSettings.staticFriction * normalForceMag;
        const isSticking = gTMag <= staticFrictionLimit;

        // ---- Resolve penetration along the normal ----
        // Push this object out along +n by the penetration depth
        // projected onto n. Penetration is computed from the
        // hitbox bounds overlap, projected onto n.
        const overlapX = Math.min(thisHitbox.bounds().right - otherHitbox.bounds().left,
                                otherHitbox.bounds().right - thisHitbox.bounds().left);
        const overlapY = Math.min(thisHitbox.bounds().bottom - otherHitbox.bounds().top,
                                otherHitbox.bounds().bottom - thisHitbox.bounds().top);
        // The penetration along the normal is the smaller of the
        // bounds overlap when projected; a simpler, stable choice
        // is min(overlapX, overlapY) scaled by the normal direction.
        const penetration = (trueDepth !== null) ? trueDepth + 0.01 : Math.min(overlapX, overlapY);
        const thisCanMove = this.collision.pushable && !this.collision.static;
        
        if (thisCanMove) {
            pos_add(this.transform.position, n.x * penetration, n.y * penetration);
        }

        // ---- Cancel the normal component of velocity ----
        // v_n = (v . n) n;  v <- v - v_n  (so the object slides along
        // the surface but doesn't sink into it).
        const vel = this.transform.velocity;
        const vDotN = vel.x * n.x + vel.y * n.y;
        if (vDotN < 0) {
            // Moving INTO the surface -> cancel the inward component.
            vel.x -= vDotN * n.x;
            vel.y -= vDotN * n.y;
        }

        // ---- Apply tangential acceleration ----
        if (!isSticking) {
            // Direction of slide (down the slope) = gT normalized.
            const tMag = gTMag > 1e-6 ? gTMag : 1;
            const tDir = { x: gT.x / tMag, y: gT.y / tMag };

            // Tangential acceleration = g * sin(theta) - friction * g * cos(theta)
            // sin(theta) = gTMag / g, cos(theta) = normalForceMag / g.
            const tangentialAccel = gTMag / g; // = sin(theta)
            const normalAccel      = normalForceMag / g; // = cos(theta)

            const kineticLoss = this.slopeSettings.kineticFriction * normalAccel;
            const netAccel = Math.max(0, tangentialAccel - kineticLoss) * g;

            // Apply as acceleration * dt. We don't have dt here
            // directly, so integrate into velocity via a small
            // implicit step (1/60 s is the typical tick).
            const dt = (typeof World !== 'undefined' && World._tickDeltaSeconds)
                ? World._tickDeltaSeconds
                : 1 / 60;
            vel.x += tDir.x * netAccel * dt;
            vel.y += tDir.y * netAccel * dt;
        } else {
            // Sticking: damp tangential velocity aggressively so the
            // object doesn't drift while resting on a shallow slope.
            const tDotV = vel.x * (-n.y) + vel.y * (n.x);
            const tangent = { x: -n.y, y: n.x };
            // Remove the tangential component of velocity (project out).
            vel.x -= tDotV * tangent.x;
            vel.y -= tDotV * tangent.y;
        }

        // ---- Grounding ----
        // The object is grounded if the normal is roughly upward.
        if (n.y < -0.1) {
            this.grounded = true;
            this.groundedOn = other;
            this._onSlope = true;
            this._slopeNormal = n;
            this._slopeAngle = slopeAngle;
        }

        return true;
    }

    setVelocity(speed, angle = this.transform.rotation, rm = 'radians') {
        let vel = this.transform.velocity;
        let angleRad = angle;
        if(rm == 'degrees')angleRad = (angle * Math.PI) / 180;
        vel.x = speed * Math.cos(angleRad);
        vel.y = speed * Math.sin(angleRad);
    }

    addVelocity(speed, angle = this.transform.rotation) {
        let vel = this.transform.velocity;
        let angleRad = angle;
        if (this.transform.rotationMode === "degrees") angleRad = (angle * Math.PI) / 180;
        vel.x += speed * Math.cos(angleRad);
        vel.y += speed * Math.sin(angleRad);
    }

    getSpeed() {
        let vel = this.transform.velocity;
        return Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    }

    getVelocityAngle() {
        let vel = this.transform.velocity;
        let angle = Math.atan2(vel.y, vel.x);
        if (this.transform.rotationMode === "degrees") angle = (angle * 180) / Math.PI;
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
                    if (k == "embedded" && s) { all = [true]; end = true; }
                    else if (k != "embedded") all.push(s);
                });
                return all.every((l) => l);
            }
        }
    }

    handleMovement(movement) {}

    setCollision(
        e  = this.collision.enabled,
        st = this.collision.static,
        pu = this.collision.pushable,
        so = this.collision.solid,
        re = this.collision.resolve
    ) {
        this.collision.enabled  = e;
        this.collision.static   = st;
        this.collision.pushable = pu;
        this.collision.solid    = so;
        this.collision.resolve  = re;
    
        this.hitbox.forEach((hitbox) => {
            hitbox.collision.enabled  = e;
            hitbox.collision.static   = st;
            hitbox.collision.pushable = pu;
            hitbox.collision.solid    = so;
            hitbox.collision.resolve  = re;
        });
    }

    render() {
        if (!this.active) return;
        var pos = this.effectivePosition;
        var scale = this.transform.scale;
        var vel = this.transform.velocity;
        var renderer = this.rendering;
        var settings = renderer.draw;
        if(settings.hitbox){
            stroke("red");
            strokeWeight(1);
        }
        if (renderer.visible) {
            push();
            fill(color(renderer.color));
            translate(pos.x, pos.y);
            
            if (Array.isArray(renderer.outline)) {
                stroke(renderer.outline[1]);
                strokeWeight(renderer.outline[0]);
            } else noStroke();
            
            if (!settings.texture) {
                // The body turns with transform.rotation (about its center).
                push();
                rotate(this.transform.rotation);
                switch (settings.shape) {
                    case "rect":
                    case "rectangle":
                        rectMode(CENTER);
                        rect(0, 0, scale.x, scale.y, settings.radius || 0);   // radius: optional rounded corners
                        break;
                    case "triangle":
                        triangle(
                            pos.ax || -scale.x / 2, pos.ay || scale.y / 2,
                            pos.bx || 0, pos.by || -scale.y / 2,
                            pos.cx || scale.x / 2, pos.cy || scale.y / 2
                        );
                        break;
                    case "circle":
                    case "ellipse":
                        ellipse(0, 0, scale.x, scale.y);
                        break;
                }
                pop();
            }

            if (this.hitbox) {
                this.hitbox.forEach((hb) => {
                    if(this.hitbox.indexOf(hb) == 0)return;
                    let hbr = hb.rendering;
                    let hbPos = hb.getWorldPosition();
                    let hbScale = hb.transform.scale;
                    fill(hbr.color);
                    if (Array.isArray(hbr.outline)) {
                        stroke(hbr.outline[1]);
                        strokeWeight(hbr.outline[0]);
                    } else noStroke();
                    if(hbr.visible)
                    switch (hb.shape) {
                        case "rect":
                        case "rectangle":
                            push();
                            rectMode(CENTER);
                            translate(hbPos.x - pos.x, hbPos.y - pos.y);
                            rotate(hb.getWorldRotation());
                            rect(0, 0, hbScale.x, hbScale.y);
                            pop();
                            break;
                        case "circle":
                        case "ellipse":
                            push();
                            translate(hbPos.x - pos.x, hbPos.y - pos.y);
                            rotate(hb.getWorldRotation());
                            ellipse(0, 0, hbScale.x, hbScale.y);
                            pop();
                            break;
                        case "triangle":
                            let verts = hb.getTriangleVertices();
                            if (verts) {
                                triangle(
                                    verts[0].x - pos.x, verts[0].y - pos.y,
                                    verts[1].x - pos.x, verts[1].y - pos.y,
                                    verts[2].x - pos.x, verts[2].y - pos.y
                                );
                            }
                            break;
                    }
                });
            }

            pop();
        }

        // Debug rendering (hitbox outlines, sides, velocity arrows).
        if (renderer.debug.active || this.debug) {
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
                // Hitbox rotation (parent's + its own). Triangles are drawn from their
                // already-rotated world vertices, so only the other shapes turn here.
                const hbRot = hb.shape === "triangle" ? 0 : hb.getWorldRotation();
                push();
                if (hbRot) rotate(hbRot);
                switch (hb.shape) {
                    case "rect":
                    case "rectangle":
                        rect(0, 0, hbScale.x, hbScale.y);
                        break;
                    case "triangle":
                        let verts = hb.getTriangleVertices();
                        if (verts) {
                            triangle(
                                verts[0].x - hbPos.x, verts[0].y - hbPos.y,
                                verts[1].x - hbPos.x, verts[1].y - hbPos.y,
                                verts[2].x - hbPos.x, verts[2].y - hbPos.y
                            );
                        }
                        break;
                    case "circle":
                    case "ellipse":
                        ellipse(0, 0, hbScale.x, hbScale.y);
                        break;
                }
                pop();

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
                    rect(0, hb.shape === "triangle" ? 20 : hbScale.y / 2 + hbScale.y * 0.125, size || 20, 4);
                    pop();
                }

                if (hb.shape === "triangle") {
                    let verts = hb.getTriangleVertices();
                    if (verts) {
                        let triSides = {
                            left: [verts[0], verts[2]],
                            right: [verts[1], verts[2]],
                            bottom: [verts[0], verts[1]],
                        };
                        const drawTriSide = (side) => {
                            if (!hbSides[side]) return;
                            push();
                            stroke("#f570ff");
                            strokeWeight(2);
                            translate(-this.position().x - hb.offset.x, -this.position().y - hb.offset.y);
                            line(triSides[side][0].x, triSides[side][0].y, triSides[side][1].x, triSides[side][1].y);
                            pop();
                        };
                        drawTriSide('left');
                        drawTriSide('right');
                        drawTriSide('bottom');

                        if (hbSides.embedded) {
                            push();
                            stroke("#00b3ff");
                            strokeWeight(2);
                            let centerX = (verts[0].x + verts[1].x + verts[2].x) / 3 - hbPos.x;
                            let centerY = (verts[0].y + verts[1].y + verts[2].y) / 3 - hbPos.y;
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
                        line(-size, 0, size, 0);
                        line(0, -size, 0, size);
                        pop();
                    }
                } else {
                    push();
                    if (hbRot) rotate(hbRot);
                    if (hbSides.top) {
                        push(); stroke("#f570ff"); strokeWeight(2);
                        line(-hbScale.x / 2, -hbScale.y / 2, hbScale.x / 2, -hbScale.y / 2);
                        pop();
                    }
                    if (hbSides.bottom) {
                        push(); stroke("#f570ff"); strokeWeight(2);
                        line(-hbScale.x / 2, hbScale.y / 2, hbScale.x / 2, hbScale.y / 2);
                        pop();
                    }
                    if (hbSides.left) {
                        push(); stroke("#f570ff"); strokeWeight(2);
                        line(-hbScale.x / 2, -hbScale.y / 2, -hbScale.x / 2, hbScale.y / 2);
                        pop();
                    }
                    if (hbSides.right) {
                        push(); stroke("#f570ff"); strokeWeight(2);
                        line(hbScale.x / 2, -hbScale.y / 2, hbScale.x / 2, hbScale.y / 2);
                        pop();
                    }
                    pop();
                    if (hbSides.embedded) {
                        push(); stroke("#00b3ff"); strokeWeight(2);
                        let size = 6;
                        line(-size, 0, size, 0);
                        line(0, -size, 0, size);
                        pop();
                    }
                }

                pop();
            });

            if (d.velocity) {
                let pos = this.effectivePosition;
                let vel = this.transform.velocity;

                push();
                translate(pos.x, pos.y);

                // Raw velocity arrow.
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
                    line(endX, endY, endX - arrowSize * Math.cos(angle - arrowAngle), endY - arrowSize * Math.sin(angle - arrowAngle));
                    line(endX, endY, endX - arrowSize * Math.cos(angle + arrowAngle), endY - arrowSize * Math.sin(angle + arrowAngle));

                    noStroke();
                    fill("purple");
                    textSize(11);
                    text("v: " + velMag.toFixed(1) + " px/s", endX + 5, endY - 5);
                }
                pop();

                // Self (total) velocity arrow.
                push();
                stroke("cyan");
                strokeWeight(2);
                let trueVelMag = Math.sqrt(vel.self.x * vel.self.x + vel.self.y * vel.self.y);
                if (trueVelMag > 0.01) {
                    let angle = Math.atan2(vel.self.y, vel.self.x);
                    let logScale = Math.log(1 + trueVelMag) / Math.log(1 + 100);
                    let len = minLength * 1.5 + (maxLength * 1.5 - minLength * 1.5) * logScale;
                    let endX = Math.cos(angle) * len;
                    let endY = Math.sin(angle) * len;

                    line(endX, endY, endX - arrowSize * Math.cos(angle - arrowAngle), endY - arrowSize * Math.sin(angle - arrowAngle));
                    line(endX, endY, endX - arrowSize * Math.cos(angle + arrowAngle), endY - arrowSize * Math.sin(angle + arrowAngle));

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

// ============================================
// ENTITY PATH (SCRATCH)
// ============================================
// A simple path/target holder for AI. Not yet wired into Entity
// update logic - kept for future use.
class EntityPath {
    constructor(destination, face, ...conditions) {
        this.destination = destination; // FIX: was "destintion"
        this.faces = face;              // FIX: was "fase"
        this.conditions = conditions;
        this.parent = null;
    }

    setParent(obj) {
        if (!(obj instanceof geometryObject)) return false;
        this.parent = obj;
        return true;
    }

    testConditions() {
        let obj = this.parent;
        let pos = this.parent.position();
        if (!obj.check(obj, pos)) {
            this.conditions.forEach(c => {
                if (c.type == 'range') { /* TODO */ }
            });
        }
    }
}

// ============================================
// ENTITY
// ============================================
// gameObject with max velocity caps, velocity decay, and a
// pathing list. Player extends Entity with a "player" tag.
class Entity extends gameObject {
    static Packages = {
        living:()=>{
            let pck = {
                health:100,
                maxHealth:100,
                flash:{
                    percent:0.5,
                    color:'#ff0000',
                    duration:0.25, //seconds
                },
                damaged:false,
                shield:{
                    max:100,
                    value:0,
                    protection:0.1,
                    decay:0.12,
                },
                applyDamage(n,displayObject){
                    let dmg = {
                        shield:-1,
                        health:0,
                        timeStamp:new Date().getTime(),
                        object:this,
                    };
                    if(this.shield.value > 0){
                        if(this.shield.value - n*(1+this.shield.decay) >= 0){
                            dmg.shield = Number(pad(n*(1+this.shield.decay),1,2));
                            dmg.health = Number(pad(n*(1-this.shield.protection),1,2));
                            this.shield.value -= dmg.shield;
                            this.health -= dmg.health;
                        }else{
                            //total damage - damage needed to break shield * damage taken with shield up
                            let total = (this.shield.value/(1+this.shield.decay))*(1-this.shield.protection);
                            dmg.shield = this.shield.value;
                            this.shield.value = 0;
                            dmg.health = Number(pad(total,1,2));
                            //console.log('had shield');
                            this.health -= dmg.health;
                            this.health = Number(pad(this.health,1,2));
                        }
                    }else{
                        this.health -= n;
                        dmg.health = n;
                    }
                    this.damaged = true;
                    if(this.damageFlash)this.damageFlash();
                    if(typeof displayObject == 'object' && Array.isArray(displayObject)){
                        displayObject.unshift(dmg);
                    }
                    
                    return {
                        health:this.health,
                        shield:this.shield.value,
                    };
                },
                damageFlash(){
                    if(!this.damaged)this.__originalColor = this.rendering.color;

                    if(this.__originalColor == undefined){
                        this.__originalColor = this.rendering.color;
                    }
                    if(this.__damageFlashed)return;
                    if(this.__damageFlashed == undefined){
                        this.__damageFlashed = true;
                    }
                    
                    let flsh = throttle(()=>{
                        
                        if(!this.damaged)return;
                        var base = color(this.__originalColor);
                        var v = 0;
                        var start = new Date().getTime();
                        var nc = new Blender(this.flash.color,0);
                        
                        const _end = setInterval(() => {
                            let now = new Date().getTime();
                            var x = ((start + this.flash.duration*1000)-now)/1000;

                            if(start + this.flash.duration*1000 >= now){
                                //smooth color shift
                                //from 0% to X%
                                
                                v = Math.pow(Math.sin(Math.PI*(x/this.flash.duration)),0.5);
                                //console.log(x);
                                nc.value = v > 1 ? 2-v : v;
                                
                                this.rendering.color = nc.actualize(base);
                            }else{
                                this.rendering.color = this.__originalColor;
                                this.damaged = false;
                                this.__damageFlashed = false;
                                clearInterval(_end);
                            }
                            
                        }, 10);
                        
                    },this.flash.duration);
                    return flsh();
                }
            };
            
            return pck;
        },
        speed:()=>{
            return {
                    speed:{
                    max:10,
                    value:2.5,
                    sprint:15,
                },
                jumpHeight(){ return -this.transform.size().y}
            }
        },
        sprint:()=>{
            var time = 0;
            let pck = {
                sprint:{
                    max:100,
                    value:100,
                    consume:1, //charge lost per second
                    charge:{
                        time:1.5, //seconds
                        value:5, //charge per second
                    },
                    run(input){
                        const curr = new Date().getTime();
                        this.sprint.value = limit(this.sprint.value, 0, this.sprint.max);
                        if(getInput(input)){
                            this.sprint.value -= this.sprint.consume/World.tickLength;
                            time = curr;
                        }
                        if(time + this.sprint.charge.time*1000 <= curr){
                            this.sprint.value += this.sprint.charge.value/World.tickLength;
                        }
                    }
                }
            };
            
            
            return pck;
        },
        attack:()=>{
            let pck = {
                attack:{
                    damage:20,
                    range:5,
                    speed:0.5, //attacks per second
                    
                },
                isAttacking:false,
                _packageInit(self){
                    let att = throttle((target)=>{
                        
                        if(self.hitbox[0].collidesWith(target.hitbox[0],self.attack.range)){
                            
                            self.isAttacking = true;
                            setTimeout(() => {
                                self.isAttacking = false;
                            }, 1/self.attack.speed);
                            if(typeof target.applyDamage != 'function'){
                                target.health -= self.attack.damage;
                                return self.attack.damage;
                            }else {
                                let _data = target.applyDamage(self.attack.damage);
                                return _data;
                            }
                            //return 'error';
                            
                        }
                        return false;
                    },1/self.attack.speed);
                    self.tryAttack = att;
                    return true;
                }
            };
            
            return pck;
        },
        inventory:()=>{
          let pck = {
            inventory:{},
          };
          pck.inventory.slots = 36;
          pck.inventory.actionbar = {
            slots:5,
          };
          pck.inventory.activeItem = 0;

          for(let i = 0;i<pck.inventory.actionbar.slots;i++){
            pck.inventory.actionbar[i] = null;
          }

          

          pck.inventory.append = (e, _slot = pck.inventory.length) => {
            const max = pck.inventory.slots;
            var items = pck.inventory.length;
            let returnItem;
            if(_slot == pck.inventory.length){
                if(items+1 <= max){
                    pck.inventory.unshift(e);
                    returnItem = e;
                    new Message(`PlayerAction|InventoryPush: successfully pushed item to inventory: {${pck.inventory.length}}`);
                    return returnItem;
                }else{
                    const popped = pck.inventory.pop();
                    returnItem = popped;
                    pck.inventory.unshift(e);
                    new Message(`PlayerAction|InventoryPush: pushed new item to inventory, but removed last item in inventory: ${popped}`);
                    return returnItem;
                }
            }else{
                if(pck.inventory[_slot] != undefined){
                    pck.inventory[_slot] = e;
                    returnItem = e;
                    new Message(`PlayerAction|InventorySlot: successfully set item to inventory slot: {${_slot}}`);
                    return returnItem;
                } else {
                    pck.inventory[_slot] = e;
                    returnItem = e;
                    new Message(`PlayerAction|InventorySlot: inventory slot {${_slot}} previously didn't exist, inventory: {${pck.inventory.length}}`);
                    return returnItem;
                }
            }
            
          };
          pck.inventory.getActiveItem = ()=>{
            try {
              return pck.inventory.actionbar[pck.inventory.activeItem];
            } catch(e){
              return pck.inventory.actionbar[0];
            }
          };
          pck.inventory.push = undefined;
          pck.inventory.actionbar.equip = (inventorySlot, actionbarSlot) => {
            try {
              const target = pck.inventory[inventorySlot-1];
              pck.inventory.actionbar[actionbarSlot-1] = target;
              return {
                slot:actionbarSlot,
                item:target
              };
            } catch(e){
              new Message(`PlayerAction|ActionbarPush: failed to find valid item in inventory slot: '${inventorySlot}' avalible slots: ${pck.inventory.length}`);
              return false;
            }
          }
          Object.defineProperty(pck.inventory, 'length', {
            get (){
                const keys = Object.keys(this);
                return keys.filter(e => {
                    let item = Number(e);
                    //console.log(item, item == NaN);
                    return !isNaN(item);
                }).length;
            }
          });
          
          return pck;
        }
    };
    constructor(x, y, w, h, id, ...scenes) {
        super(x, y, w, h, ...scenes);
        this.id = id;
        this.name = id;
        this.transform.velocity.max = { x: 50, y: 2000 };
        this.transform.velocity.decay = 0.89;
        this.physicsToggles.velocityDecay = true;
        this.pathing = [];
        this.tags.push('entity');
    }
    package(...objs){
        const inits = [];
        objs.forEach(e => {
            Object.assign(this, e);
            
            if(!!e._packageInit){
                inits.push(e._packageInit);
            }
        });
        inits.forEach(exe => exe(this));
        return true;
    }
    update(deltaTime = 1 / 60) {
        if (this.deleted) return;
        this.id = this.superId;
        let pos = this.transform.position;
        let scale = this.transform.scale;
        let vel = this.transform.velocity;

        if (isNaN(pos.x) || isNaN(pos.y)) {
            console.warn(`Invalid position detected for object ${this.id}, resetting to last known position`);
            pos.x = this.previousPosition.x || 0;
            pos.y = this.previousPosition.y || 0;
            return;
        }

        this.previousPosition = { x: pos.x, y: pos.y };
        this._wasGrounded = this.grounded;

        if (!this.collision.static) {
            this.grounded = false;
            if (!this.grounded) this.groundedOn = null;
        } else {
            this.grounded = true;
            this.groundedOn = null;
        }

        const effPos = this.effectivePosition;
        this.x = effPos.x;
        this.y = effPos.y;
        this.width = scale.x;
        this.height = scale.y;

        if (this.groundedOn instanceof gameObject) {
            vel.inherited = this.groundedOn.transform.velocity.self;
        }

        if (vel.x < 0) vel.x = Math.max(vel.x, -vel.max.x);
        else if (vel.x > 0) vel.x = Math.min(vel.x, vel.max.x);

        vel.self.x = vel.x + (vel.inherited?.x || 0);
        vel.self.y = vel.y + (vel.inherited?.y || 0);

        let maxSpeed = 3000;
        let currentSpeed = Math.sqrt(vel.self.x * vel.self.x + vel.self.y * vel.self.y);
        if (currentSpeed > maxSpeed) {
            let scaleFactor = maxSpeed / currentSpeed;
            vel.self.x *= scaleFactor;
            vel.self.y *= scaleFactor;
            vel.x *= scaleFactor;
            vel.y *= scaleFactor;
        }

        // Same swept (time of impact) movement as gameObject (replaces the old
        // fixed 20px / max-10 substep loop, which still let fast entities tunnel).
        this._backcastMove(deltaTime);

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

        if (this.physicsToggles.velocityDecay) {
            vel.x *= vel.decay;
            if (Math.abs(vel.x) < 0.01) vel.x = 0;
            if (!this.physicsToggles.gravity) {
                vel.y *= vel.decay;
                if (Math.abs(vel.y) < 0.01) vel.y = 0;
            }
        }

        if (Math.abs(vel.x) < 0.0001) vel.x = 0;
        if (Math.abs(vel.y) < 0.0001) vel.y = 0;

        let idx = gameObject.objects.indexOf(this);
        if (idx > -1) gameObject.objects[idx] = this;
        else gameObject.objects.push(this);

        this.updateParentScene();
    }
}

// ============================================
// PLAYER
// ============================================
class Player extends Entity {
    constructor(x, y, w, h, id, ...scenes) {
        super(x, y, w, h, id, ...scenes);
        delete this.pathing;
        this.tags.push('player');
    }
}

// ============================================
// UI (base class)
// ============================================
// Screen-space interface objects. A UI object is built like a gameObject -
// the same id / transform / tags / scripts / scenes / rendering settings,
// the same render method, rotation, velocity helpers - but it has NO
// collision and NO hitboxes. Where a gameObject has a list of hitboxes, a
// UI object has exactly one hitbox-like object (UIBounds): a rectangle
// that follows its transform and never collides with anything.
//
// UI objects live in their scenes' `uiObjects` array (not `objects`), which
// Scene.render() draws after - so over - the game objects, in screen space
// (they ignore the camera).

/**
 * Mixes the color `base` toward `blender.blend` by `blender.value`
 * (0 = unchanged, 1 = the blend color). Used by Blender.actualize().
 * Colors can be anything p5's color() understands ("#rgb", "#rrggbb",
 * "red", "rgb(...)", [r, g, b], a p5.Color). Returns "#rrggbb", or
 * "rgba(r,g,b,a)" when the result isn't fully opaque.
 */
function blendColors(base, blender) {
    const toRGBA = (c) => {
        if (c && c.levels) return Array.from(c.levels);                      // p5.Color
        if (Array.isArray(c)) return [c[0] || 0, c[1] || 0, c[2] || 0, c[3] === undefined ? 255 : c[3]];
        if (typeof c === "string") {
            const m = c.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
            if (m) {
                let h = m[1];
                if (h.length <= 4) h = h.split("").map((ch) => ch + ch).join("");
                return [
                    parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
                    h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
                ];
            }
        }
        if (typeof color === "function") return Array.from(color(c).levels);   // named colors, rgb(), hsl()...
        return [0, 0, 0, 255];
    };
    const a = toRGBA(base);
    const b = toRGBA(blender && blender.blend !== undefined ? blender.blend : "#000000");
    const t = Math.max(0, Math.min(1, blender && typeof blender.value === "number" ? blender.value : 0));
    const mix = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const hex = (n) => n.toString(16).padStart(2, "0");
    return mix[3] >= 255
        ? "#" + hex(mix[0]) + hex(mix[1]) + hex(mix[2])
        : `rgba(${mix[0]},${mix[1]},${mix[2]},${(mix[3] / 255).toFixed(3)})`;
}

class Blender {
    constructor(c,v){
        this.blend = c;
        this.value = v;
    }
    actualize(b){
        return blendColors(b,this);
    }
}

// ============================================
// UIBounds: the one hitbox-like object of a UI object
// ============================================
// gameObject.render() draws hitbox outlines in its debug mode and reads
// collision / grounded flags. A UI object has no real hitboxes, so it owns
// exactly one UIBounds: a rectangle matching the object's position, size
// and rotation, flagged static and never colliding, never touching
// anything. That lets gameObject's render code run on a UI object unchanged,
// and gives pointer hit-testing something to measure.
class UIBounds {
    constructor(owner) {
        this.parent = owner;
        this.shape = "rect";
        this.offset = { x: 0, y: 0 };
        
    }
    get transform() { return this.parent.transform; }
    get width() { return this.parent.transform.scale.x; }
    get height() { return this.parent.transform.scale.y; }
    getWorldPosition() { return this.parent.transform.position; }
    getWorldRotation() { return this.parent.transform.radians; }
    getTriangleVertices() { return null; }
    /** Axis-aligned box around the (possibly rotated) rectangle. */
    bounds() {
        const p = this.parent.transform.position, sc = this.parent.transform.scale;
        const r = this.parent.transform.radians;
        const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
        const hw = (sc.x * c + sc.y * s) / 2, hh = (sc.x * s + sc.y * c) / 2;
        return { left: p.x - hw, right: p.x + hw, top: p.y - hh, bottom: p.y + hh };
    }
    delete() {}
}

class UI extends geometryObject {
    static getEvents = {
        // Is the pointer over `obj` (and is `obj` the topmost UI object there)?
        // `pos` is the Mouse, a {x, y} point, or another object.
        // With the Mouse, the position that is tested depends on obj.ignoreCamera:
        //   ignoreCamera true  (the UI default) -> mouse.rawX / rawY  (where the pointer is on the screen)
        //   ignoreCamera false                  -> mouse.x / y        (the pointer relative to the camera)
        hover:(pos = UI.mouseSource(),obj = this)=>{
            if(!pos || !obj || !obj.transform) return false;
            const p = UI.pointerOf(pos, obj);
            if(!p) return false;
            if(obj.active === false) return false;
            if(obj.rendering && obj.rendering.visible === false) return false;
            if(!UI.contains(obj,p)) return false;
            // The dev console is drawn on the screen, so it is always tested with the screen position.
            if(UI._consoleOwns(UI.pointerOf(pos) || p)) return false;
            // Overlapping UI objects: only the one on top is hovered.
            if(UI.objects && UI.objects.includes(obj) && UI.topAt(pos) !== obj) return false;
            return obj.enabled !== false;
        },
        // A click on `obj` happened since the last tick: the left button was pressed on
        // obj AND released while the pointer was still over obj. True for exactly one
        // tick per click (UI.tick clears it), so a click is never seen twice. A press
        // that began elsewhere and was released over obj is not a click. `pos` is
        // unused (where the press and release happened is recorded from the mouse events).
        clicked:(pos = UI.mouseSource(),obj = this)=>{
            if(!obj || UI._clickedOn !== obj) return false;
            if(obj.active === false || obj.enabled === false) return false;
            return !(obj.rendering && obj.rendering.visible === false);
        },
        // Hovered, and the left mouse button is held down.
        pressed:(pos = UI.mouseSource(),obj = this)=>{
            const selection = UI.mouseSource();
            if(!selection) return false;
            // Read the button state directly (Mouse.isPressed() is tick-gated and reports false between ticks).
            const down = selection.pressedButtons ? selection.pressedButtons.has(0) : selection.pressed;
            return !!down && UI.getEvents.hover(pos,obj);
        },

        // Is `obj` the selected UI object? (the last one pressed on; clicking empty space clears it)
        selection:(pos = UI.mouseSource(),obj = this)=>{
            return UI.selected === obj;
        }
    }

    // ---------- class-level state & helpers ----------

    static init() {
        // NOT `UI.started`: statics are inherited and shell.started is already
        // true, which would turn this into a no-op. `_ready` exists only on UI.
        if (Object.prototype.hasOwnProperty.call(UI, "_ready")) return;
        UI.objects = [];
        UI.selected = null;
        UI.validTags = ['ui', 'button'];
        UI._order = 0;
        UI._downOn = null;          // UI object the left button was pressed on
        UI._clickedOn = null;       // UI object that was pressed AND released on (cleared each tick)
        UI._bound = false;
        UI._cursorSet = false;
        UI._ready = true;
    }

    static addTag(t) {
        UI.init();
        if (typeof t == 'string') t = t.toLowerCase();
        if (UI.validTags.includes(t)) return false;
        UI.validTags.push(t);
        return true;
    }

    /** The Mouse container (global `mouse`, or world.mouse). Safe before either exists. */
    static mouseSource() {
        if (typeof mouse !== "undefined" && mouse) return mouse;
        if (typeof world !== "undefined" && world && world.mouse) return world.mouse;
        return null;
    }

    /** Client (page) coordinates -> canvas pixels. */
    static toCanvas(x, y) {
        let ox = 0, oy = 0;
        try {
            const el = (typeof World !== "undefined" && World.canvas) ? World.canvas.elt : null;
            if (el && el.getBoundingClientRect) { const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; }
        } catch (e) { /* ignore */ }
        return { x: x - ox, y: y - oy };
    }

    /** The camera's world position (the point drawn at the canvas's top-left corner). */
    static _cameraPosition() {
        return (typeof gameObject !== "undefined" && gameObject.cameraPosition) ? gameObject.cameraPosition() : { x: 0, y: 0 };
    }

    /**
     * Pointer position in canvas pixels, or null.
     *   UI.pointer()     -> where the pointer is on the screen (mouse.rawX / rawY)
     *   UI.pointer(obj)  -> the pointer in obj's own space: the screen position when
     *                       obj.ignoreCamera is true (the UI default), otherwise the
     *                       position relative to the camera (mouse.x / y).
     */
    static pointer(obj = null) {
        const m = UI.mouseSource();
        return m ? UI.pointerOf(m, obj) : null;
    }

    /**
     * Turns whatever getEvents was given into a canvas-pixel point (or null).
     *   - the Mouse (or a mouse event: anything with rawX / rawY):
     *       no `obj`, or obj.ignoreCamera !== false -> rawX / rawY, the position on the screen
     *       obj.ignoreCamera === false              -> x / y, the position relative to the camera
     *   - another object: its position
     *   - a plain {x, y}: used as is (you already picked the space)
     * The Mouse's raw values are client (page) pixels and x / y are client pixels plus the camera
     * position, so both are shifted by the canvas's page offset to give canvas pixels.
     */
    static pointerOf(src, obj = null) {
        if (!src) return null;
        if (src.transform && src.transform.position) return { x: src.transform.position.x, y: src.transform.position.y };
        if (isFinite(src.rawX) && isFinite(src.rawY)) {
            const screenSpace = !obj || obj.ignoreCamera !== false;
            if (screenSpace) return UI.toCanvas(src.rawX, src.rawY);
            if (isFinite(src.x) && isFinite(src.y)) return UI.toCanvas(src.x, src.y);
            const raw = UI.toCanvas(src.rawX, src.rawY), cam = UI._cameraPosition();   // an event without x / y
            return { x: raw.x + cam.x, y: raw.y + cam.y };
        }
        if (isFinite(src.x) && isFinite(src.y)) return { x: src.x, y: src.y };
        return null;
    }

    /**
     * Is the point inside obj's rectangle? Takes obj's rotation into account.
     * `p` must be in obj's own space (see pointerOf): the object's transform.position is a screen
     * pixel when ignoreCamera is true and a camera-relative position when it is false.
     */
    static contains(obj, p) {
        const t = obj.transform;
        const _pos = t.position;
        let dx = p.x - _pos.x, dy = p.y - _pos.y;
        const r = t.radians;
        if (r) {                                   // undo the rotation, then test an upright box
            const c = Math.cos(r), s = Math.sin(r);
            const ux = dx * c + dy * s;
            dy = -dx * s + dy * c;
            dx = ux;
        }
        return Math.abs(dx) <= t.scale.x / 2 && Math.abs(dy) <= t.scale.y / 2;
    }

    static _consoleOwns(p) {
        return (typeof DevConsole !== "undefined") && DevConsole.enabled && DevConsole.pointerOverUI(p);
    }

    /** UI objects of the active scene that can be seen. */
    static active() {
        UI.init();
        const id = (typeof Scene !== "undefined") ? Scene.activeScene : null;
        return UI.objects.filter((o) => !o.deleted && o.active && o.rendering.visible && o.scenes.includes(id));
    }

    /**
     * Topmost interactive UI object under the pointer (draw order: layer, then creation).
     * `src` is the Mouse / a mouse event (each object is tested in its own space, see pointerOf)
     * or a plain {x, y} point (tested as is against every object).
     */
    static topAt(src = UI.mouseSource()) {
        if (!src) return null;
        const list = (typeof Scene !== "undefined" && Scene.renderOrder) ? Scene.renderOrder(UI.active()) : UI.active();
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].interactive === false) continue;
            const p = UI.pointerOf(src, list[i]);
            if (p && UI.contains(list[i], p)) return list[i];
        }
        return null;
    }

    /** getInput() asks this: hide the mouse from the game while the pointer is over a UI object. */
    static blocksInput(domain) {
        if (!Object.prototype.hasOwnProperty.call(UI, "_ready")) return false;
        if (domain !== "mouse") return false;
        const m = UI.mouseSource();
        return !!(UI._downOn || (m && UI.topAt(m)));
    }

    /**
     * Listens to the left button's presses and releases. The Mouse class has no event
     * subscription, so UI listens on the window itself and passes _onMouse an event with
     * the same fields the Mouse keeps (rawX / rawY = client pixels, x / y = plus the camera).
     */
    static _bindInput() {
        if (UI._bound) return true;
        const m = UI.mouseSource();
        if (m && typeof m.subscribe === "function") {
            m.subscribe((ev) => UI._onMouse(ev));
        } else if (typeof window !== "undefined" && window.addEventListener) {
            const relay = (type) => (e) => {
                const cam = (typeof world !== "undefined" && world && world.camera) ? world.camera : { x: 0, y: 0 };
                UI._onMouse({ type, button: e.button, rawX: e.clientX, rawY: e.clientY,
                              x: e.clientX + (cam.x || 0), y: e.clientY + (cam.y || 0) });
            };
            window.addEventListener("mousedown", relay("down"));
            window.addEventListener("mouseup", relay("up"));
        } else {
            return false;
        }
        UI._bound = true;
        return true;
    }

    // The Mouse only keeps flags (pressed / clicked), and its `clicked` flag stays on
    // for 100ms wherever the pointer is. So the click is worked out here from the raw
    // events: it counts only if the press began on an object and the release happens
    // with that same object still under the pointer. A press and release can both
    // fit inside one 20ms tick; the click is kept until the end of the next tick.
    static _onMouse(ev) {
        if (ev.button !== 0) return;
        if (ev.type === "down") {
            UI._downOn = UI.topAt(ev);          // the event carries rawX / rawY (and x / y)
            UI.selected = UI._downOn;
        } else if (ev.type === "up") {
            const down = UI._downOn;
            UI._downOn = null;
            if (down && UI.topAt(ev) === down && !UI._consoleOwns(UI.pointerOf(ev))) UI._clickedOn = down;
        }
    }

    /** End of every game tick (called by Scene.tick after the objects' scripts): a click lasts one tick. */
    static tick() {
        UI.init();
        UI._bindInput();
        UI._clickedOn = null;
    }

    /** Pointer cursor while the mouse is over something clickable (called by Scene.render). */
    static applyCursor() {
        if (typeof cursor !== "function") return;
        const m = UI.mouseSource();
        const p = UI.pointer();                                    // screen position (the console lives there)
        const top = m ? (UI._downOn || UI.topAt(m)) : null;
        const over = !!(p && !UI._consoleOwns(p) && top && top.cursorType === "pointer");
        if (over !== UI._cursorSet) {
            cursor(over ? "pointer" : "default");
            UI._cursorSet = over;
        }
    }

    // ---------- instance ----------

    constructor(x = 0, y = 0, w = 120, h = 40, ...scenes){
        super();
        UI.init();
        this.isUI = true;
        this.id = "MALE:UI[" + Math.random().toString(36).substring(2) + "]";
        this.superId = this.id;
        this.deleted = false;
        this.transform = new Transform(x,y,w,h);
        this.tags = ['ui'];
        this.scripts = [];
        this.scenes = scenes.length < 1 ? ["blank"] : scenes;

        // Exactly one hitbox-like object, with no collision (see UIBounds), and the
        // inert collision record gameObject's render code expects to find.
        this.hitbox = [new UIBounds(this)];
        
        

        // Same structure as gameObject.rendering (and drawn by the same render code).
        this.rendering = {
            draw: {
                hitbox: false,
                shape: "rect",
                texture: null,
                presets: [],
                radius: 0,           // rounded corners (rect only)
            },
            color: "white",
            visible: true,
            outline: [0.1, "black"],
            debug: false,            // true / { color, center }: outline the UIBounds like a hitbox
        };

        // Where the object lives:
        //   true  (default) SCREEN space. transform.position is a pixel on the canvas, the camera never moves
        //         it, and the pointer is tested with mouse.rawX / rawY (where the mouse is on the screen).
        //   false WORLD space, like a gameObject. transform.position is a world position, the object is drawn
        //         in the camera's frame (it scrolls with the world) and the pointer is tested with
        //         mouse.x / y (the mouse position relative to the camera).
        this.ignoreCamera = true;

        this.active = true;          // false: skipped completely (no update / draw / input)
        this.enabled = true;         // false: drawn greyed out, ignores input
        this.interactive = true;     // false: the pointer passes through it
        this.layer = 0;              // higher = drawn later (on top of the other UI objects)
        this.cursorType = "default";
        this._order = ++UI._order;   // creation order: tie-break for layer
        this.previousPosition = { x: x || 0, y: y || 0 };

        this.events = {
            hover:UI.getEvents.hover(UI.mouseSource(),this),
            clicked:UI.getEvents.clicked(UI.mouseSource(),this),
            pressed:UI.getEvents.pressed(UI.mouseSource(),this),
            selected:null,
        };
        this.format = {
            text:{
                font:'Arial',
                size:16,
                style:null, //bold, italic, null
                color:'#000000'
            },
            
        };

        this._handlers = {};
        UI.objects.push(this);
        this.push(this);
        this.updateParentScene();
    }

    // Plain properties on gameObject; here they read and write the transform directly.
    get x() { return this.transform.position.x; }
    set x(v) { this.transform.position.x = v; }
    get y() { return this.transform.position.y; }
    set y(v) { this.transform.position.y = v; }
    get width() { return this.transform.scale.x; }
    set width(v) { this.transform.scale.x = v; }
    get height() { return this.transform.scale.y; }
    set height(v) { this.transform.scale.y = v; }
    /** Alias of rendering.visible. */
    get visible() { return this.rendering.visible; }
    set visible(v) { this.rendering.visible = !!v; }

    addTag(t) {
        if (typeof t == 'string') t = t.toLowerCase();
        if (UI.validTags.includes(t)) this.tags.push(t);
        else {
            console.log(`UI|Tag: the tag "${t}" isn't a valid tag!`);
            return false;
        }
        return this.tags;
    }

    // ---------- events: tiny emitter ----------

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

    /** Copies option values onto this object; `onClick`-style function keys become handlers. */
    _applyOptions(opts) {
        if (!opts || typeof opts !== "object") return this;
        const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Blender);
        Object.keys(opts).forEach((k) => {
            const v = opts[k];
            if (/^on[A-Z]/.test(k) && typeof v === "function") this.on(k[2].toLowerCase() + k.slice(3), v);
            else if (isPlain(v) && isPlain(this[k])) {
                Object.keys(v).forEach((kk) => {
                    if (isPlain(v[kk]) && isPlain(this[k][kk])) Object.assign(this[k][kk], v[kk]);
                    else this[k][kk] = v[kk];
                });
            } else this[k] = v;
        });
        return this;
    }

    // ---------- scenes (same idea as gameObject, but the UI array) ----------

    getParentScene() {
        if (typeof Scene === 'undefined') return;
        let s = Scene.getScene();
        if (s && s.uiObjects.includes(this)) return s;
        else return Scene.getScene("blank");
    }

    updateParentScene() {
        if (typeof Scene === 'undefined' || !Scene.scenes) return;
        let s = Scene.getScene();
        if (!s || !this.scenes.includes(s.id)) s = Scene.getScene("blank");
        if (!s) return;

        if (!s.uiObjects.includes(this)) s.uiObjects.push(this);

        Scene.scenes.forEach((scene) => {
            if (!this.scenes.includes(scene.id) && scene.uiObjects.includes(this)) {
                let idx = scene.uiObjects.indexOf(this);
                if (idx > -1) scene.uiObjects.splice(idx, 1);
            }
        });
        return s;
    }

    delete() {
        if (this.deleted) return;
        this.deleted = true;
        if (UI.selected === this) UI.selected = null;
        if (UI._downOn === this) UI._downOn = null;
        if (UI._clickedOn === this) UI._clickedOn = null;
        let idx = UI.objects.indexOf(this);
        if (idx > -1) UI.objects.splice(idx, 1);
        this.remove(this);
        if (typeof Scene !== 'undefined' && Scene.scenes) {
            Scene.scenes.forEach((scene) => {
                [scene.uiObjects, scene.objects].forEach((list) => {
                    let i = list ? list.indexOf(this) : -1;
                    if (i > -1) list.splice(i, 1);
                });
            });
        }
        this.hitbox.forEach((hb) => hb.delete());
    }

    // ---------- per tick ----------

    /**
     * Per-tick update: refreshes `events` (hover / clicked / pressed), then does
     * the movement part of gameObject.update() - velocity moves the object, with
     * no gravity, friction or collision.
     */
    update(deltaTime = 1 / 60) {
        if (this.deleted) return;
        this.events.hover = UI.getEvents.hover(UI.mouseSource(),this);
        this.events.clicked = UI.getEvents.clicked(UI.mouseSource(),this);
        this.events.pressed = UI.getEvents.pressed(UI.mouseSource(),this);
        this.events.selected = UI.getEvents.selection(UI.mouseSource(),this);

        let pos = this.transform.position;
        let vel = this.transform.velocity;
        if (isNaN(pos.x) || isNaN(pos.y)) {
            pos.x = this.previousPosition.x || 0;
            pos.y = this.previousPosition.y || 0;
            return;
        }
        this.previousPosition = { x: pos.x, y: pos.y };

        vel.self.x = vel.x + (vel.inherited?.x || 0);
        vel.self.y = vel.y + (vel.inherited?.y || 0);
        // Same movement scale as gameObject (velocity * deltaTime * 10).
        pos.x += (vel.self.x || 0) * deltaTime * 10;
        pos.y += (vel.self.y || 0) * deltaTime * 10;
        if (Math.abs(vel.x) < 0.0001) vel.x = 0;
        if (Math.abs(vel.y) < 0.0001) vel.y = 0;

        this.updateParentScene();
    }

    // ---------- drawing ----------

    /**
     * Draws in screen space (ignoreCamera true, the default) or in the camera's frame
     * (ignoreCamera false). The body (fill, outline, shape, rotation, rounded corners,
     * debug bounds) is drawn by gameObject's own render code; then draw() puts the
     * object's content (a button's label) on top.
     */
    render() {
        UI.renderLikeGameObject(this);
    }

    /**
     * Runs gameObject.prototype.render on a UI object. The camera transform is reset first;
     * with ignoreCamera true that leaves the object in screen space (it ignores the camera's
     * position / zoom), with ignoreCamera false the camera's translate is applied again, so the
     * object sits in the world and scrolls with it.
     * That code reads the hitbox list, collision sides and grounded - the
     * stand-ins the constructor created (UIBounds etc.) - so it works as is.
     */
    static renderLikeGameObject(obj, drawContent = true) {
        if (obj.deleted || !obj.active || !obj.rendering.visible) return;
        push();
        resetMatrix();
        if (obj.ignoreCamera === false) {
            const cam = UI._cameraPosition();
            translate(-cam.x, -cam.y);
        }
        rectMode(CENTER);
        try {
            obj._syncRendering();
            gameObject.prototype.render.call(obj);
            if (drawContent) obj.draw();
        } finally { pop(); }
    }

    /** Subclasses set rendering.color / outline from their current state here. */
    _syncRendering() {}

    /** Content drawn on top of the body, in the object's own space (screen, or the camera's frame). Subclasses override. */
    draw() {}

    download() {
        return this.constructor.name + ":" + JSON.stringify({
            trs: { p: this.transform.position, s: this.transform.scale, r: this.transform.rotation },
            scenes: this.scenes,
            format: this.format,
        });
    }
}

// Movement helpers that only use the transform: shared with gameObject, not copied.
["setVelocity", "addVelocity", "getSpeed", "getVelocityAngle", "sides"].forEach((name) => {
    UI.prototype[name] = gameObject.prototype[name];
});

// ============================================
// UI BUTTON
// ============================================
// A push button, built like a gameObject but without collision or hitboxes:
//
//   new uiButton(x, y, width, height, buttonText, ...scenes)
//   x, y         center of the button, in canvas pixels
//   buttonText   the label drawn on top (or an options object, see below)
//   ...scenes    scene ids it lives in (none = "blank")
//
//   const b = new uiButton(150, 100, 200, 44, "Play", "menu");
//   b.onClick(() => console.log("clicked"));
//   b.transform.rotation = 15;          // degrees; the button, its label and its click area turn
//
// Everything it reads comes from the UI base class:
//   events.hover / .pressed / .clicked   updated every tick by UI.getEvents
//   format.text    { font, size, style, color }   the label
//   format.colors  { base, hover, pressed, clicked }   `base` is the resting
//                  color; the others are Blenders mixed into it
//   format.shapeColor   the color the button is drawn with right now
//
// States, strongest first: pressed (mouse held down on it) > clicked (a short
// flash after a click) > hover > base. A disabled button (enabled = false) is
// drawn greyed out and ignores the mouse.
//
// Trackers: clickCount, hoverTime, pressTime (seconds). Events: hoverStart
// hoverEnd pressStart release click.
//
// Options (instead of the text): { text, format: {...}, enabled, layer,
// onClick: fn, ... } - nested objects are merged into the defaults.
class uiButton extends UI {
    constructor(x, y, w, h, buttonText = "", ...scenes){
        super(x, y, w, h, ...scenes);
        this.cursorType = "pointer";
        this.text = "";                       // the label
        this.format.colors = {
            base:'#ffffff',
            hover:new Blender('#000000',0.25),
            pressed:new Blender('#000000',0.75),
            clicked:new Blender('#000000',0.5),
            disabled:new Blender('#808080',0.6)
        };
        this.format.shapeColor = '#ffffff';
        this.format.textAutoContrast = true;  // light label on a dark fill (see _labelColor)
        this.format.outline = { weight: 1, color: '#000000' };
        this.format.radius = 6;

        this.clickCount = 0;
        this.hoverTime = 0;
        this.pressTime = 0;
        this._flash = 0;                      // seconds left of the "clicked" flash
        this._wasHover = false;
        this._wasPressed = false;

        if (typeof buttonText === "string") this.text = buttonText;
        else this._applyOptions(buttonText);
    }

    /** Shorthand for on("click", fn). Chainable. */
    onClick(fn) { return this.on("click", fn); }

    /** Which color of format.colors applies right now. */
    get state() {
        if (!this.enabled) return "disabled";
        if (this.events.pressed) return "pressed";
        if (this._flash > 0) return "clicked";
        if (this.events.hover) return "hover";
        return "base";
    }

    /** Clicks the button from code. */
    click(source = "script") {
        if (!this.enabled) return false;
        this.clickCount++;
        this._flash = 0.12;
        this.emit("click", { source });
        return true;
    }

    update(deltaTime = 1 / 60) {
        super.update(deltaTime);
        if (this.deleted) return;
        const e = this.events;

        if (this._flash > 0) this._flash = Math.max(0, this._flash - deltaTime);
        if (e.hover && !this._wasHover) this.emit("hoverStart");
        if (!e.hover && this._wasHover) this.emit("hoverEnd");
        if (e.pressed && !this._wasPressed) this.emit("pressStart");
        if (!e.pressed && this._wasPressed) this.emit("release");
        // events.clicked is true for one tick per click, and only when the press began
        // on this button and was released over it, so "click" handlers run once per click.
        if (e.clicked) this.click("mouse");

        this.hoverTime = e.hover ? this.hoverTime + deltaTime : 0;
        this.pressTime = e.pressed ? this.pressTime + deltaTime : 0;
        this._wasHover = e.hover;
        this._wasPressed = e.pressed;
    }

    /** format.shapeColor for the current state: `base`, or `base` blended by the state's Blender. */
    _currentColor() {
        const colors = this.format.colors;
        const st = this.state;
        const base = colors.base;
        const blender = st === "base" ? null : colors[st];
        return blender && typeof blender.actualize === "function" ? blender.actualize(base) : base;
    }

    _syncRendering() {
        this.format.shapeColor = this._currentColor();
        const r = this.rendering, o = this.format.outline;
        r.color = this.format.shapeColor;
        r.outline = o && o.weight > 0 ? [o.weight, o.color] : null;
        r.draw.radius = this.format.radius || 0;
    }

    /** Label color: format.text.color, or white when the fill is dark. */
    _labelColor() {
        const t = this.format.text;
        if (this.format.textAutoContrast === false) return t.color;
        const c = this.format.shapeColor;
        const m = typeof c === "string" && c.match(/^#([0-9a-f]{6})$/i);
        if (!m) return t.color;
        const n = parseInt(m[1], 16);
        const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
        return lum < 0.45 ? "#ffffff" : t.color;
    }

    /** The label, centered on the button and turned with it. */
    draw() {
        if (this.text === "" || this.text === null || this.text === undefined) return;
        const t = this.format.text;
        push();
        translate(this.transform.position.x, this.transform.position.y);
        rotate(this.transform.radians);
        noStroke();
        fill(this._labelColor());
        textFont(t.font);
        textSize(t.size);
        textStyle(t.style || NORMAL);
        textAlign(CENTER, CENTER);
        text(String(this.text), 0, 0);
        pop();
    }
}






/* 

    Game Notification Class

*/

class ButtonEvent {
    static validEvent(e){
        let i = ['hover','pressed','clicked'];
        if(i.includes(e.toLowerCase())){
            return i[i.indexOf(e.toLowerCase())];
        }
    }
    constructor(eventName,fn){
        const eve = ButtonEvent.validEvent(eventName);
        if(!eve)throw 'ButtonEvent_object|EventName: invalid event name!'
        this.event = eve;
        this.run = fn;
    }
    exe(obj){
        return fn(obj);
    }
}

class Button extends geometryObject {
    static getEvents = {
        hover:(pos = World.mouse, obj = this)=>{
            let dim = obj.size();
            let dip = obj.position();
            return  (pos.x > dip.x-dim.x/2) &&
                    (pos.x < dip.x+dim.x/2) &&
                    (pos.y > dip.y-dim.y/2) &&
                    (pos.y < dip.y-dim.y/2)
        },
        pressed:(pos = World.mouse, obj = this)=>{
            let dim = obj.size();
            let dip = obj.position();
            return  (pos.x > dip.x-dim.x/2) &&
                    (pos.x < dip.x+dim.x/2) &&
                    (pos.y > dip.y-dim.y/2) &&
                    (pos.y < dip.y-dim.y/2) && pos.pressed
        },
        clicked:(pos = World.mouse, obj = this)=>{
            let dim = obj.size();
            let dip = obj.position();
            return  (pos.x > dip.x-dim.x/2) &&
                    (pos.x < dip.x+dim.x/2) &&
                    (pos.y > dip.y-dim.y/2) &&
                    (pos.y < dip.y-dim.y/2) && pos.clicked
        },
        
    };
    constructor(x,y,w,h,txt,...scenes){
        super(x,w,y,h,5);
        this.rendering = new Renderer(this,'basic','white','rect');
        this.rendering.colors = {
            hover:new Blender('#000',0.25),
            pressed:new Blender('#000',0.75),
            clicked:new Blender('#000',0.5),
            disabled:new Blender('#808080',0.6)
        };
        this.events = {
            get hover(){
                return Button.getEvents.hover(World.mouse,this);
            },
            get pressed(){
                return Button.getEvents.pressed(World.mouse,this);
            },
            get clicked(){
                return Button.getEvents.clicked(World.mouse,this);
            }
        };
        this.onEvent = {
            clicked:[],
            pressed:[],
            hover:[],
        };
    }
    onClick(fn){
        this.onEvent.clicked.push(new ButtonEvent('clicked',fn));
    }
    update(){

        gameObject.prototype.update.call(this);
    }
}


// ============================================
// PATHING AI
// ============================================
// Decides how linked objects move through a tileMatrix: which cells are open,
// which steps are allowed and what they cost (findPath), and how an object
// walks a path tick by tick (start / step). Every matrix has one:
//   new tileMatrix(x, y, cols, rows, w, h, { pathing: new PathingAI({ cornerRule: 'strict' }) }, ...)
//   matrix.pathing = new PathingAI({ speed: 150 });     // or a plain options object
//   matrix.moveTo(obj, x, y, { pathing: otherAI });     // just for this walk
// For custom behaviour, subclass it and override passable / allowStep /
// stepCost / heuristic (or findPath / step entirely).
class PathingAI {
    static CORNER_RULES = ['strict', 'loose', 'free'];

    /**
     * options:
     *   corners     allow corner moves, through a tile's vertex (default true)
     *   cornerRule  when a corner move is allowed, judged by the two cells
     *               beside that corner:
     *                 'loose'  (default) at least one of them is open: it
     *                          can slip past a single closed cell
     *                 'strict' both must be open: never past a closed cell
     *                 'free'   always, even between two closed cells
     *   cornerCost  multiplier on corner steps (default 1). A step costs the
     *               distance between the two cell centers, so paths are the
     *               shortest in pixels.
     *   speed       walking speed, pixels per second (default 100); a walk
     *               covers at most one cell per tick
     *   align       first move to the center of the current cell, so every
     *               step after that follows an allowed direction (default true)
     *   maxRepaths  when the next cell gets closed mid-walk, find a new path up
     *               to this many times in a row, then give up (default 3)
     *   passable    (matrix, x, y, obj) => boolean, replaces passable()
     *   stepCost    (matrix, from, to, dir, settings) => number, replaces stepCost()
     */
    constructor(options = {}) {
        this.corners = options.corners !== false;
        this.cornerRule = options.cornerRule ?? 'loose';
        this.cornerCost = options.cornerCost ?? 1;
        this.speed = options.speed ?? 100;
        this.align = options.align !== false;
        this.maxRepaths = options.maxRepaths ?? 3;
        if (typeof options.passable === 'function') this.passable = options.passable;
        if (typeof options.stepCost === 'function') this.stepCost = options.stepCost;
        PathingAI._checkRule(this.cornerRule);
    }

    static _checkRule(rule) {
        if (!PathingAI.CORNER_RULES.includes(rule)) {
            throw new tileMatrixError(`unknown cornerRule '${rule}' (use ${PathingAI.CORNER_RULES.join(', ')})`);
        }
    }

    /**
     * This AI's settings with one call's opts on top (opts.cornerCutting is
     * the old name: true = 'free', false = 'strict').
     */
    settings(opts = {}) {
        let cornerRule = opts.cornerRule ?? this.cornerRule;
        if (opts.cornerRule === undefined && opts.cornerCutting !== undefined) cornerRule = opts.cornerCutting ? 'free' : 'strict';
        PathingAI._checkRule(cornerRule);
        return {
            corners: opts.corners ?? this.corners,
            cornerRule,
            cornerCost: opts.cornerCost ?? this.cornerCost,
            speed: opts.speed ?? this.speed,
            align: opts.align ?? this.align,
            maxRepaths: opts.maxRepaths ?? this.maxRepaths,
        };
    }

    // ---------- rules (override these) ----------

    /**
     * Can obj go into cell (x, y)? Default: canPlace() says yes (not blocked or
     * reserved, support rules allow it, ...). Without obj, only blocked cells stop it.
     */
    passable(matrix, x, y, obj) {
        return obj ? matrix.canPlace(x, y, obj, { anchor: 'none' }) === true : !matrix.isBlocked(x, y);
    }

    /**
     * Is the step from cell `from` in direction `dir` (from matrix.directions())
     * allowed? Its target is already known to be open; open(x, y) tests others.
     * Side steps always are; corner steps follow settings.cornerRule.
     */
    allowStep(matrix, from, dir, open, settings) {
        if (dir.kind !== 'corner') return true;
        if (settings.cornerRule === 'free') return true;
        const flank = dir.flank.map(f => !!(f && open(f.x, f.y)));
        return settings.cornerRule === 'strict' ? flank.every(Boolean) : flank.some(Boolean);
    }

    /** Cost of a step: center-to-center distance, times cornerCost for corner steps. */
    stepCost(matrix, from, to, dir, settings) {
        const a = matrix._localCenter(from.x, from.y), b = matrix._localCenter(to.x, to.y);
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        return dir.kind === 'corner' ? d * settings.cornerCost : d;
    }

    /**
     * Estimated cost from a cell to the goal. Must never be more than the real
     * cost or paths stop being the cheapest (return 0 to search exhaustively).
     */
    heuristic(matrix, cell, goal, settings) {
        const a = matrix._localCenter(cell.x, cell.y), b = matrix._localCenter(goal.x, goal.y);
        return Math.hypot(b.x - a.x, b.y - a.y) * Math.min(1, settings.cornerCost);
    }

    // ---------- planning ----------

    /**
     * Cheapest path (A*) from cell `from` to cell `to` through matrix, using
     * the rules above. Returns the cells after `from`, ending at `to` ([] when
     * they're the same cell), or null when there's no way. opts: obj (the
     * walker, for passable()), passable ((x, y, obj, matrix) => boolean, for
     * this call only), and any setting (see settings()).
     */
    findPath(matrix, from, to, opts = {}) {
        if (!from || !to || !matrix.inBounds(from.x, from.y) || !matrix.inBounds(to.x, to.y)) return null;
        if (from.x === to.x && from.y === to.y) return [];
        const s = this.settings(opts);
        const obj = opts.obj ?? null;
        const cols = matrix.cols;
        const key = (cx, cy) => cy * cols + cx;
        const memo = new Map();
        const open = (cx, cy) => {
            const k = key(cx, cy);
            if (!memo.has(k)) {
                memo.set(k, !!(typeof opts.passable === 'function'
                    ? opts.passable(cx, cy, obj, matrix)
                    : this.passable(matrix, cx, cy, obj)));
            }
            return memo.get(k);
        };
        if (!open(to.x, to.y)) return null;

        const heap = [];   // [priority, cellKey], smallest first
        const push = (f, k) => {
            heap.push([f, k]);
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p][0] <= heap[i][0]) break;
                [heap[p], heap[i]] = [heap[i], heap[p]];
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0], last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let i = 0;
                for (;;) {
                    const l = 2 * i + 1, r = l + 1;
                    let m = i;
                    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                    if (m === i) break;
                    [heap[m], heap[i]] = [heap[i], heap[m]];
                    i = m;
                }
            }
            return top;
        };

        const sk = key(from.x, from.y), tk = key(to.x, to.y);
        const g = new Map([[sk, 0]]), prev = new Map(), closed = new Set();
        push(this.heuristic(matrix, from, to, s), sk);
        while (heap.length) {
            const k = pop()[1];
            if (closed.has(k)) continue;
            if (k === tk) break;
            closed.add(k);
            const here = { x: k % cols, y: Math.floor(k / cols) };
            for (const d of matrix.directions(here.x, here.y, { corners: s.corners })) {
                const nk = key(d.x, d.y);
                if (closed.has(nk) || !open(d.x, d.y)) continue;
                if (!this.allowStep(matrix, here, d, open, s)) continue;
                const next = { x: d.x, y: d.y };
                const ng = g.get(k) + this.stepCost(matrix, here, next, d, s);
                if (ng < (g.get(nk) ?? Infinity)) {
                    g.set(nk, ng);
                    prev.set(nk, k);
                    push(ng + this.heuristic(matrix, next, to, s), nk);
                }
            }
        }
        if (!prev.has(tk)) return null;
        const path = [];
        for (let k = tk; k !== sk; k = prev.get(k)) path.push({ x: k % cols, y: Math.floor(k / cols) });
        return path.reverse();
    }

    // ---------- walking ----------

    /** State for a new walk (stored as the object's link state .move). */
    start(matrix, obj, goal, path, opts = {}) {
        const s = this.settings(opts);
        return { ai: this, goal: { x: goal.x, y: goal.y }, path: path.slice(), opts, settings: s, aligned: !s.align, repaths: 0 };
    }

    /**
     * One tick of a walk: move obj (by position; the matrix's late pass then
     * moves its placement) toward the next cell center. Re-plans when the
     * next cell gets closed, and ends the walk with opts.onArrive / onBlocked.
     */
    step(matrix, obj, st, dt) {
        const mv = st.move;
        const s = mv.settings;
        const cur = matrix.placementOf(obj);
        if (!cur) return this._end(obj, st, 'onBlocked', null);   // taken out of its cell mid-walk
        const pos = obj.transform.position;
        let target;
        if (!mv.aligned) {
            target = { x: cur.x, y: cur.y };
        } else {
            if (!mv.path.length) return this._end(obj, st, 'onArrive', mv.goal);
            target = mv.path[0];
            // About to enter the next cell: is it still open?
            const passOpts = Object.assign({}, mv.opts, { obj });
            const stillOpen = typeof mv.opts.passable === 'function'
                ? mv.opts.passable(target.x, target.y, obj, matrix)
                : this.passable(matrix, target.x, target.y, obj);
            if ((target.x !== cur.x || target.y !== cur.y) && !stillOpen) {
                const path = mv.repaths < s.maxRepaths ? this.findPath(matrix, cur, mv.goal, passOpts) : null;
                if (!path) return this._end(obj, st, 'onBlocked', { x: target.x, y: target.y });
                mv.path = path;
                mv.repaths++;
                return;
            }
        }
        const w = matrix.toWorld(target.x, target.y);
        const dx = w.x - pos.x, dy = w.y - pos.y;
        const dist = Math.hypot(dx, dy);
        const step = s.speed * dt;
        if (dist <= step) {
            pos.x = w.x;
            pos.y = w.y;
            if (!mv.aligned) mv.aligned = true;
            else { mv.path.shift(); mv.repaths = 0; }
            if (mv.aligned && !mv.path.length) this._end(obj, st, 'onArrive', mv.goal);
        } else {
            pos.x += dx / dist * step;
            pos.y += dy / dist * step;
        }
    }

    _end(obj, st, hook, cell) {
        const mv = st.move;
        st.move = null;
        if (typeof mv.opts[hook] === 'function') mv.opts[hook](obj, cell ? { x: cell.x, y: cell.y } : null);
    }
}

// ============================================
// TILE MATRIX
// ============================================
// A grid of cells that objects are placed into, so they line up
// uniformly and stay inside a limited space. Each cell holds a STACK of
// layers (levels), so one cell can hold e.g. floor -> table -> lamp.
//
//   new tileMatrix(x, y, cols, rows, cellW, cellH?, options?, ...scenes)
//
//   x, y      world position of the grid's TOP-LEFT corner (not its center,
//             unlike most engine objects): cell (2, 2) with 20px cells at
//             origin (0, 0) has its top-left corner at (40, 40)
//   cellH     defaults to cellW
//   options   {
//     layers:     ['furniture', 'decor'] names for levels 1, 2, ... (use null
//                 to skip a level). Level 0 is ALWAYS 'ground' and can't be
//                 renamed or moved.
//     freeStack:  true  -> any level (up to maxLayers) can be used, named or not
//                 false -> only 'ground' and the named levels can be used
//     maxLayers:  total levels per cell INCLUDING ground (default Infinity)
//     anchor:     where placed objects go in their cell: 'center' (default),
//                 'bottom', 'topleft' or 'none' (don't move the object)
//     baseLayer:  placed objects get obj.layer = baseLayer + level, so the
//                 scene draws higher levels on top (setDrawLayer: false to skip)
//     bareGround: { supports, accepts } rules for an EMPTY ground slot
//                 (default: supports anything)
//     removeMode: default for removeAt(): 'block' | 'cascade' | 'collapse'
//     moveMode:   default for move(): the same plus 'carry' (default: removeMode)
//     logErrors:  log failed place()/removeAt() calls with new Message (default true)
//     shape:      'square' (default) | 'diamond' | 'hex' | 'triangle'
//     orientation: 'pointy' | 'flat' for hex (default 'pointy'),
//                 'up' | 'down' for triangle (default 'up': the triangle at
//                 cell (0, 0) points up; 'down' flips every triangle),
//                 ignored by square and diamond.
//     autoFit:    how cols / rows that AREN'T numbers ('auto', undefined, ...)
//                 are sized from the screen (canvas, or window before
//                 createCanvas), measured from x, y:
//                 'centers' (default) as many cells as fit with every cell
//                           center inside the screen
//                 'cover'   enough cells to cover the screen solidly (cells
//                           stick out past the right / bottom edges)
//     defaultColor, layer: see below
//   }
//
// Shapes (cellW x cellH is the size of ONE tile's bounding box):
//   square    plain rectangles.
//   diamond   each tile is rotated 45 degrees, laid out in a rectangle
//             ("staggered"): rows are half a tile apart vertically and odd rows
//             are shifted right by half a tile, so diamonds interlock with no
//             gaps. Use cellH = cellW / 2 for the classic 2:1 isometric look.
//   hex       pointy: rows are offset (odd rows shifted right), cellW = flat-to-flat,
//             cellH = point-to-point. flat: odd columns are shifted down.
//   triangle  alternating up/down triangles; each cell is half a cellW further
//             right than the last, so (x + y) even = one way, odd = the other.
// Cell coordinates (x, y) are always the same plain 0..cols-1 / 0..rows-1 indices
// whatever the shape. Footprints are w x h ranges of those indices. x, y is still
// the top-left of the grid's bounding box. Use neighbors(x, y) for adjacency.
//
// Movement: directions(x, y) lists the ways out of a cell for its shape (sides,
// plus corners except on hex), findPath(from, to) walks only those, and
// link(...objects) makes free-moving objects track their cell, stay inside the
// grid and walk paths with moveTo(obj, x, y). See "linked objects" below.
//
// Placed objects can carry an optional `tile` settings block (all optional,
// it's read but never modified, so instances can share one config object):
//   obj.tile = {
//     footprint: { w: 2, h: 1 },   cells covered; (x, y) passed to place() is the top-left one
//     height:    12,               px the next object up is raised by (stacked visuals)
//     supports:  true,             can things be placed on it? (default true)
//     accepts:   ['decor'],        categories it supports (null/missing = anything)
//     category:  'furniture',      what it counts as for the object below's `accepts`
//     layer:     'ground',         default layer for place() when opts.layer isn't given
//     anchor:    'bottom',         overrides the matrix anchor for this object
//   }
// Optional hooks on the object: onTilePlaced(matrix, placement),
// onTileMoved(matrix, newPlacement, oldPlacement) and
// onTileRemoved(matrix, placement) (placement.reason: 'removed' | 'cascade' | 'deleted').
//
// Cell states: 'blocked' and 'reserved' are flags on the cell (setBlocked /
// setReserved); 'occupied' / 'empty' come from the stack. See cellState().
//
// The scene draws the matrix itself (it's synced into scene.objects by its
// scene ids) on `layer` (option, default -1, so under objects on layer 0+).
// render() draws visible cell colors, then the debug grid/tints. Turn the
// overlay off with matrix.debug.grid = false / matrix.debug.states = false.
class tileMatrix extends geometryObject {
    static init() {
        // hasOwnProperty: a plain `tileMatrix.started` would read the inherited
        // shell.started (static fields inherit through `extends`).
        if (Object.prototype.hasOwnProperty.call(tileMatrix, 'started')) return;
        tileMatrix.matrices = [];
        tileMatrix.started = true;
    }

    static DEFAULT_COLOR = 'rgba(120,120,120,1)';
    static GROUND = 'ground';
    static EMPTY = 'empty';
    static OCCUPIED = 'occupied';
    static BLOCKED = 'blocked';
    static RESERVED = 'reserved';
    static REMOVE_MODES = ['block', 'cascade', 'collapse'];
    static MOVE_MODES = ['block', 'cascade', 'collapse', 'carry'];

    static SHAPES = ['square', 'diamond', 'hex', 'triangle'];
    static ORIENTATIONS = { square: [null], diamond: [null], hex: ['pointy', 'flat'], triangle: ['up', 'down'] };

    /** Size of the whole grid's bounding box for a shape (static: needed before super()). */
    static boundsFor(shape, orientation, cols, rows, w, h) {
        switch (shape) {
            case 'diamond': return { w: (cols + (rows > 1 ? 0.5 : 0)) * w, h: (rows + 1) * h / 2 };
            case 'triangle': return { w: (cols + 1) * w / 2, h: rows * h };
            case 'hex':
                return orientation === 'flat'
                    ? { w: w + (cols - 1) * 0.75 * w, h: (rows + (cols > 1 ? 0.5 : 0)) * h }
                    : { w: (cols + (rows > 1 ? 0.5 : 0)) * w, h: h + (rows - 1) * 0.75 * h };
            default: return { w: cols * w, h: rows * h };
        }
    }

    /**
     * Size of the screen: the p5 canvas once it exists, otherwise the window.
     * (Game files usually build matrices at the top level, before setup() /
     * createCanvas() run, so that's the window size.)
     */
    static screenSize() {
        if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 &&
            typeof document !== 'undefined' && document.querySelector('canvas')) {
            return { w: width, h: height };
        }
        if (typeof window !== 'undefined') return { w: window.innerWidth, h: window.innerHeight };
        return { w: 0, h: 0 };
    }

    /**
     * Fewest cols / rows of a shape so that, from the grid's origin, the area
     * w x h is covered SOLIDLY: diamond, hex and triangle grids have zig-zag
     * edges, so the far (right / bottom) edges go past w / h until the notches
     * are past it too. (The origin side is zig-zag as well; to cover it, move the
     * origin up/left, e.g. by half a cell, and the counts grow to match.)
     */
    static countToCover(shape, orientation, w, h, cellW, cellH) {
        const n = (span, step) => Math.max(1, Math.ceil(Math.max(0, span) / step - 1e-9));
        switch (shape) {
            case 'diamond':  return { cols: n(w, cellW), rows: n(h, cellH / 2) };
            case 'triangle': return { cols: n(w, cellW / 2), rows: n(h, cellH) };
            case 'hex':
                return orientation === 'flat'
                    ? { cols: n(w, 0.75 * cellW), rows: n(h, cellH) }
                    : { cols: n(w, cellW), rows: n(h, 0.75 * cellH) };
            default:         return { cols: n(w, cellW), rows: n(h, cellH) };
        }
    }

    /**
     * Most cols / rows of a shape whose cell CENTERS all stay within w x h,
     * measured from the grid's origin (the default auto-size: no cell sits
     * mostly off-screen). Staggered shapes check both row/column parities, so
     * e.g. a diamond grid's shifted odd rows stay inside too. Always at least 1.
     */
    static countWithin(shape, orientation, w, h, cellW, cellH) {
        const eps = 1e-9;
        const center = (x, y) => tileMatrix.centerFor(shape, orientation, x, y, cellW, cellH);
        const count = (fits) => {
            let n = 1;
            while (n < 100000 && fits(n)) n++;   // fits(n): can index n (an (n+1)th cell) be added?
            return n;
        };
        const cols = (multiRow) => count(n => (multiRow ? [0, 1] : [0]).every(y => center(n, y).x <= w + eps));
        const rows = (multiCol) => count(n => (multiCol ? [0, 1] : [0]).every(x => center(x, n).y <= h + eps));
        let c = cols(true), r = rows(true);
        if (r === 1) c = cols(false);
        if (c === 1) r = rows(false);
        return { cols: c, rows: r };
    }

    /** Is (px, py) inside the polygon (array of {x, y})? Ray casting. */
    static pointInPolygon(px, py, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    /** Distance from (px, py) to the nearest edge of a polygon (array of {x, y}). */
    static distToPolygon(px, py, poly) {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[j], b = poly[i];
            const vx = b.x - a.x, vy = b.y - a.y;
            const len2 = vx * vx + vy * vy;
            const t = len2 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / len2)) : 0;
            best = Math.min(best, Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy)));
        }
        return best;
    }

    /** obj.tile with defaults filled in (never modifies obj.tile). */
    static tileInfo(obj) {
        const t = (obj && obj.tile) || {};
        const fp = t.footprint || {};
        let accepts = null;
        if (Array.isArray(t.accepts)) accepts = t.accepts;
        else if (typeof t.accepts === 'string') accepts = [t.accepts];
        return {
            w: Math.max(1, Math.floor(fp.w ?? 1)),
            h: Math.max(1, Math.floor(fp.h ?? 1)),
            height: Number(t.height) || 0,
            supports: t.supports !== false,
            accepts,
            category: t.category ?? null,
            layer: t.layer ?? null,
            anchor: t.anchor ?? null,
        };
    }

    /** Does a support (its tileInfo) accept an object (its tileInfo) on top? */
    static accepts(supportInfo, objInfo) {
        if (!supportInfo.supports) return false;
        if (supportInfo.accepts === null) return true;
        return objInfo.category !== null && supportInfo.accepts.includes(objInfo.category);
    }

    constructor(x = 0, y = 0, cols, rows, cellW = 20, ...rest) {
        // rest = [cellH?, options?, ...scenes]: cellH and options are optional,
        // so a string here is already a scene id.
        const cellH = typeof rest[0] === 'number' ? rest.shift() : cellW;
        const options = (rest[0] && typeof rest[0] === 'object') ? rest.shift() : {};
        const scenes = rest;

        if (!(cellW > 0) || !(cellH > 0)) {
            throw new tileMatrixError(`cell size must be positive (got ${cellW}, ${cellH})`);
        }

        const shape = options.shape ?? 'square';
        if (!tileMatrix.SHAPES.includes(shape)) {
            throw new tileMatrixError(`unknown shape '${shape}' (use ${tileMatrix.SHAPES.join(', ')})`);
        }
        const allowed = tileMatrix.ORIENTATIONS[shape];
        const orientation = allowed[0] === null ? null : (options.orientation ?? allowed[0]);
        if (allowed[0] !== null && !allowed.includes(orientation)) {
            throw new tileMatrixError(`unknown orientation '${orientation}' for ${shape} (use ${allowed.join(', ')})`);
        }

        // cols / rows that aren't numbers: sized from the screen (see options.autoFit).
        const autoCols = typeof cols !== 'number' || Number.isNaN(cols);
        const autoRows = typeof rows !== 'number' || Number.isNaN(rows);
        if (autoCols || autoRows) {
            const autoFit = options.autoFit ?? 'centers';
            if (autoFit !== 'centers' && autoFit !== 'cover') {
                throw new tileMatrixError(`unknown autoFit '${autoFit}' (use 'centers' or 'cover')`);
            }
            const screen = tileMatrix.screenSize();
            const fitFn = autoFit === 'cover' ? tileMatrix.countToCover : tileMatrix.countWithin;
            const fit = fitFn(shape, orientation, screen.w - x, screen.h - y, cellW, cellH);
            if (autoCols) cols = fit.cols;
            if (autoRows) rows = fit.rows;
        }
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
            throw new tileMatrixError(`cols and rows must be positive integers (got ${cols}, ${rows})`);
        }

        const size = tileMatrix.boundsFor(shape, orientation, cols, rows, cellW, cellH);
        super(x, y, size.w, size.h);
        tileMatrix.init();
        this.autoSize = { cols: autoCols, rows: autoRows };
        this.shape = shape;
        this.orientation = orientation;
        this.id = "MALE:tileMatrix[" + Math.random().toString(36).substring(2) + "]";
        this.deleted = false;
        this.scenes = scenes.length < 1 ? ["blank"] : scenes;

        this.cols = cols;
        this.rows = rows;
        this.cell = { w: cellW, h: cellH };

        this.freeStack = options.freeStack !== false;
        this.maxLayers = options.maxLayers ?? Infinity;
        this.anchor = options.anchor ?? 'center';
        this.baseLayer = options.baseLayer ?? 0;
        // Scene draws by `layer`; default -1 puts the grid under objects on layer 0+.
        this.layer = options.layer ?? -1;
        this.setDrawLayer = options.setDrawLayer !== false;
        this.removeMode = options.removeMode ?? 'block';
        this.moveMode = options.moveMode ?? this.removeMode;
        this.logErrors = options.logErrors !== false;
        const bg = options.bareGround || {};
        this.bareGround = { supports: bg.supports !== false, accepts: bg.accepts ?? null };
        if (typeof this.bareGround.accepts === 'string') this.bareGround.accepts = [this.bareGround.accepts];

        if (!(this.maxLayers >= 1)) {
            throw new tileMatrixError(`maxLayers must be at least 1 (the ground layer), got ${this.maxLayers}`);
        }

        // Level names: index = level. Level 0 is always 'ground'; null = unnamed.
        this._layerNames = [tileMatrix.GROUND];
        const names = Array.isArray(options.layers) ? options.layers.slice() : [];
        if (names.length && names[0] === tileMatrix.GROUND) names.shift();
        names.forEach((name, i) => {
            if (name !== null && name !== undefined) this.nameLayer(i + 1, name);
        });

        // Flat cell array, index = y * cols + x. stack[level] = object or null.
        // color/visible: render() fills the cell with `color` when `visible` is true.
        this.defaultColor = options.defaultColor ?? tileMatrix.DEFAULT_COLOR;
        this.cells = Array.from({ length: cols * rows }, () => ({
            blocked: false, reserved: false, stack: [],
            color: this.defaultColor, visible: false,
        }));
        this._placed = new Map();   // object -> placement record
        this._linked = new Map();   // linked object -> { x, y (last accepted position), move }
        this.pathing = options.pathing ?? new PathingAI();   // see the pathing setter
        this.lastError = null;

        // Debug overlay settings (see render()). colors[state] = null skips that state.
        this.debug = {
            grid: true,
            states: true,
            gridColor: 'rgba(255,255,255,0.25)',
            colors: {
                empty: null,
                occupied: 'rgba(80,160,255,0.45)',
                reserved: 'rgba(255,220,60,0.55)',
                blocked: 'rgba(255,40,40,0.7)',
            },
        };

        tileMatrix.matrices.push(this);
        this.push(this);
    }

    // Scene.render() sets `o.debug = true` on every object in debug mode; for the
    // matrix that would wipe the overlay settings, so a boolean just toggles
    // the overlay (grid + states) instead of replacing them.
    get debug() { return this._debug; }
    set debug(v) {
        if (v && typeof v === 'object') { this._debug = v; return; }
        if (this._debug) { this._debug.grid = !!v; this._debug.states = !!v; }
    }

    // ---------- coordinates ----------

    inBounds(x, y) {
        return Number.isInteger(x) && Number.isInteger(y) &&
            x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    }

    _index(x, y) {
        return this.inBounds(x, y) ? y * this.cols + x : -1;
    }

    // ---------- shape geometry (all "local" = relative to the grid's top-left) ----------

    /** Center of a cell in local coordinates (the centroid for triangles). */
    _localCenter(x, y) {
        return tileMatrix.centerFor(this.shape, this.orientation, x, y, this.cell.w, this.cell.h);
    }

    /**
     * Center of cell (x, y) relative to a grid's top-left, for any shape. Static
     * so it can be used before a matrix exists (auto-sizing in the constructor).
     */
    static centerFor(shape, orientation, x, y, w, h) {
        switch (shape) {
            case 'diamond':
                return { x: (x + 0.5 + (y & 1) * 0.5) * w, y: (y + 1) * h / 2 };
            case 'hex':
                return orientation === 'flat'
                    ? { x: w / 2 + x * 0.75 * w, y: (y + 0.5 + (x & 1) * 0.5) * h }
                    : { x: (x + 0.5 + (y & 1) * 0.5) * w, y: h / 2 + y * 0.75 * h };
            case 'triangle': {
                const up = tileMatrix.triangleUp(orientation, x, y);
                return { x: x * w / 2 + w / 2, y: y * h + (up ? 2 * h / 3 : h / 3) };
            }
            default:
                return { x: (x + 0.5) * w, y: (y + 0.5) * h };
        }
    }

    /** Does the triangle at (x, y) point up? (only meaningful for shape 'triangle') */
    _triangleUp(x, y) {
        return tileMatrix.triangleUp(this.orientation, x, y);
    }

    static triangleUp(orientation, x, y) {
        return (((x + y) & 1) === 0) === (orientation !== 'down');
    }

    /** Corner points of a cell in local coordinates, in drawing order. */
    _localPolygon(x, y) {
        const w = this.cell.w, h = this.cell.h;
        if (this.shape === 'triangle') {
            const l = x * w / 2, t = y * h;
            return this._triangleUp(x, y)
                ? [{ x: l + w / 2, y: t }, { x: l + w, y: t + h }, { x: l, y: t + h }]
                : [{ x: l, y: t }, { x: l + w, y: t }, { x: l + w / 2, y: t + h }];
        }
        const c = this._localCenter(x, y);
        switch (this.shape) {
            case 'diamond':
                return [{ x: c.x, y: c.y - h / 2 }, { x: c.x + w / 2, y: c.y }, { x: c.x, y: c.y + h / 2 }, { x: c.x - w / 2, y: c.y }];
            case 'hex':
                return this.orientation === 'flat'
                    ? [{ x: c.x - w / 2, y: c.y }, { x: c.x - w / 4, y: c.y - h / 2 }, { x: c.x + w / 4, y: c.y - h / 2 },
                       { x: c.x + w / 2, y: c.y }, { x: c.x + w / 4, y: c.y + h / 2 }, { x: c.x - w / 4, y: c.y + h / 2 }]
                    : [{ x: c.x, y: c.y - h / 2 }, { x: c.x + w / 2, y: c.y - h / 4 }, { x: c.x + w / 2, y: c.y + h / 4 },
                       { x: c.x, y: c.y + h / 2 }, { x: c.x - w / 2, y: c.y + h / 4 }, { x: c.x - w / 2, y: c.y - h / 4 }];
            default:
                return [{ x: c.x - w / 2, y: c.y - h / 2 }, { x: c.x + w / 2, y: c.y - h / 2 },
                        { x: c.x + w / 2, y: c.y + h / 2 }, { x: c.x - w / 2, y: c.y + h / 2 }];
        }
    }

    /** Bounding box of a cell in local coordinates: { left, top, right, bottom }. */
    _localBox(x, y) {
        const p = this._localPolygon(x, y);
        return {
            left: Math.min(...p.map(v => v.x)), top: Math.min(...p.map(v => v.y)),
            right: Math.max(...p.map(v => v.x)), bottom: Math.max(...p.map(v => v.y)),
        };
    }

    /** Corner points of a cell in WORLD coordinates ([] outside the grid). */
    cellPolygon(x, y) {
        if (!this.inBounds(x, y)) return [];
        const o = this.transform.position;
        return this._localPolygon(x, y).map(v => ({ x: o.x + v.x, y: o.y + v.y }));
    }

    /**
     * World position of a cell: anchor 'center' (default; the centroid for
     * triangles) or 'topleft' (the top-left of the cell's bounding box).
     */
    toWorld(x, y, anchor = 'center') {
        const o = this.transform.position;
        if (anchor === 'topleft') {
            if (this.shape === 'square') return { x: o.x + x * this.cell.w, y: o.y + y * this.cell.h };
            const b = this._localBox(x, y);
            return { x: o.x + b.left, y: o.y + b.top };
        }
        const c = this._localCenter(x, y);
        return { x: o.x + c.x, y: o.y + c.y };
    }

    /** Cell under a world position, or null when it's outside the grid. */
    toCell(wx, wy) {
        const o = this.transform.position;
        const px = wx - o.x, py = wy - o.y;
        const w = this.cell.w, h = this.cell.h;
        let x, y;
        switch (this.shape) {
            case 'square':
                x = Math.floor(px / w);
                y = Math.floor(py / h);
                return this.inBounds(x, y) ? { x, y } : null;
            default: {
                // diamond / hex / triangle: estimate, then test the polygons around the estimate.
                let ex, ey;
                if (this.shape === 'diamond') { ex = Math.floor(px / w); ey = Math.floor(py / (h / 2)); }
                else if (this.shape === 'triangle') { ex = Math.floor(px / (w / 2)); ey = Math.floor(py / h); }
                else if (this.orientation === 'flat') { ex = Math.floor(px / (0.75 * w)); ey = Math.floor(py / h); }
                else { ex = Math.floor(px / w); ey = Math.floor(py / (0.75 * h)); }
                const candidates = [];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const cx = ex + dx, cy = ey + dy;
                        if (!this.inBounds(cx, cy)) continue;
                        const poly = this._localPolygon(cx, cy);
                        if (tileMatrix.pointInPolygon(px, py, poly)) return { x: cx, y: cy };
                        candidates.push({ x: cx, y: cy, poly });
                    }
                }
                // A point exactly on a shared edge can fall between two cells
                // through floating-point error: take a cell it's (almost) on.
                const eps = 1e-6 * Math.max(w, h);
                for (const c of candidates) {
                    if (tileMatrix.distToPolygon(px, py, c.poly) <= eps) return { x: c.x, y: c.y };
                }
                return null;
            }
        }
    }

    /**
     * Cells touching this one by an edge, as [{ x, y }] (only cells inside the
     * grid): 4 for square/diamond, 6 for hex, 3 for triangle. Pass
     * diagonals = true for square/diamond to include the 4 corner neighbors too.
     */
    neighbors(x, y, diagonals = false) {
        if (!this.inBounds(x, y)) return [];
        let d;
        switch (this.shape) {
            case 'hex':
                if (this.orientation === 'flat') {
                    d = (x & 1)
                        ? [[0, -1], [0, 1], [1, 0], [1, 1], [-1, 0], [-1, 1]]
                        : [[0, -1], [0, 1], [1, -1], [1, 0], [-1, -1], [-1, 0]];
                } else {
                    d = (y & 1)
                        ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]]
                        : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
                }
                break;
            case 'triangle':
                d = [[-1, 0], [1, 0], this._triangleUp(x, y) ? [0, 1] : [0, -1]];
                break;
            case 'diamond': {
                // Edges touch the rows above and below; odd rows sit half a tile right.
                const s = (y & 1) ? 0 : -1;
                d = [[s, -1], [s + 1, -1], [s, 1], [s + 1, 1]];
                // Corners: left/right in the same row, up/down two rows away.
                if (diagonals) d.push([-1, 0], [1, 0], [0, -2], [0, 2]);
                break;
            }
            default:
                d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                if (diagonals) d.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        }
        return d.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(c => this.inBounds(c.x, c.y));
    }

    // ---------- directions & paths ----------

    /**
     * The ways to leave cell (x, y), worked out from the tile's geometry:
     *   'side'    through one of its edges (4 square / 4 diamond / 6 hex / 3 triangle)
     *   'corner'  through one of its vertices, to the cell directly across it
     *             (4 square / 4 diamond / 3 triangle; none for hex, where
     *             every cell touching a vertex also shares an edge)
     * Each direction is { kind, angle, x, y, dx, dy, flank }:
     *   angle     degrees on screen, 0 = right, 90 = down, 180 = left, 270 = up
     *             (a square gives 0, 45, 90 ... 315)
     *   x, y      the cell it leads to (null when that's outside the grid and
     *             opts.outside is true)
     *   dx, dy    cell offset to it
     *   flank     corners only: the two cells beside the corner ({x, y} or null)
     * Sorted by angle. Only directions that lead inside the grid are returned,
     * unless opts.outside is true. opts.corners = false returns just the sides.
     * (Not "opts.all": helperFunctions.js puts an `all` method on every object.)
     */
    directions(x, y, opts = {}) {
        if (!this.inBounds(x, y)) return [];
        const o = this.transform.position;
        const poly = this._localPolygon(x, y);
        const c = this._localCenter(x, y);
        const n = poly.length;
        // The cell that holds the point (px, py) (local coords), if it's another cell.
        const cellAtLocal = (px, py) => {
            const t = this.toCell(o.x + px, o.y + py);
            return t && (t.x !== x || t.y !== y) ? t : null;
        };
        const angleTo = (px, py) => {
            let a = Math.atan2(py - c.y, px - c.x) * 180 / Math.PI;
            if (a < 0) a += 360;
            return Math.round(a * 1e6) / 1e6 % 360;
        };
        // Leaving through a feature (edge midpoint or vertex) lands in the cell
        // holding the center reflected through that feature.
        const sides = [];
        for (let i = 0; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            sides.push({ kind: 'side', angle: angleTo(mx, my), cell: cellAtLocal(2 * mx - c.x, 2 * my - c.y) });
        }
        const found = sides.slice();
        if (opts.corners !== false && this.shape !== 'hex') {
            for (let k = 0; k < n; k++) {
                const v = poly[k];
                found.push({
                    kind: 'corner', angle: angleTo(v.x, v.y), cell: cellAtLocal(2 * v.x - c.x, 2 * v.y - c.y),
                    flank: [sides[(k + n - 1) % n].cell, sides[k].cell],
                });
            }
        }
        return found
            .filter(d => opts.outside === true || d.cell)
            .map(d => {
                const out = {
                    kind: d.kind, angle: d.angle,
                    x: d.cell ? d.cell.x : null, y: d.cell ? d.cell.y : null,
                    dx: d.cell ? d.cell.x - x : null, dy: d.cell ? d.cell.y - y : null,
                };
                if (d.flank) out.flank = d.flank;
                return out;
            })
            .sort((a, b) => a.angle - b.angle);
    }

    /**
     * The allowed direction (see directions()) closest to an angle in degrees,
     * e.g. to snap player input to what this tile shape allows. Directions that
     * lead outside the grid are included (their x, y are null). opts.corners = false
     * limits it to side directions.
     */
    snapDirection(x, y, angle, opts = {}) {
        let best = null, bestDiff = Infinity;
        for (const d of this.directions(x, y, Object.assign({}, opts, { outside: true }))) {
            const diff = Math.abs(((angle - d.angle) % 360 + 540) % 360 - 180);
            if (diff < bestDiff) { best = d; bestDiff = diff; }
        }
        return best;
    }

    /**
     * Path between two cells, worked out by this matrix's pathing AI
     * (this.pathing, a PathingAI) or opts.pathing. Returns the cells to walk
     * through, NOT including `from`, ending at `to` ([] when they're the same
     * cell), or null when there's no way. opts (each overrides the AI's setting
     * for this call): obj, passable, corners, cornerRule, cornerCost, cornerCutting
     * (old name: true = cornerRule 'free', false = 'strict'). See PathingAI.
     */
    findPath(from, to, opts = {}) {
        return (opts.pathing ?? this.pathing).findPath(this, from, to, opts);
    }

    /**
     * Cell under a world position, given in any of these forms:
     *   cellAt(wx, wy)         two numbers
     *   cellAt(obj)            an engine object: its center (effectivePosition,
     *                          so ignoreCamera objects work too)
     *   cellAt({ x, y })       any point, e.g. cellAt(world.mouse)
     *   cellAt('mouse') / cellAt()   the mouse (World.mouse x/y are world coordinates)
     * Returns the cell's coordinates and data (see cellInfo()), or null when
     * it's outside the grid or the position can't be read.
     */
    cellAt(a, b) {
        const p = tileMatrix._worldPoint(a, b);
        const c = p ? this.toCell(p.x, p.y) : null;
        return c ? this.cellInfo(c.x, c.y) : null;
    }

    /**
     * A cell's coordinates and data, or null outside the grid:
     *   {
     *     x, y,                cell coordinates in this matrix
     *     state,               'blocked' | 'occupied' | 'reserved' | 'empty'
     *     blocked, reserved,   the cell's flags
     *     color, visible,      what render() fills it with, and whether it does
     *     stack,               copy of the stack: index = level, null = empty level
     *     top,                 highest object, or null
     *     ground,              object on the ground layer, or null
     *     ...                  any custom properties set with setCell()
     *   }
     * It's a copy, so changing it doesn't change the cell: use setCell() (or
     * place / removeAt for the stack).
     */
    cellInfo(x, y) {
        const i = this._index(x, y);
        if (i < 0) return null;
        this._pruneCells([i]);
        const c = this.cells[i];
        const stack = c.stack.slice();
        const custom = {};
        for (const k of Object.keys(c)) if (!tileMatrix.CELL_KEYS.includes(k)) custom[k] = c[k];
        return {
            ...custom,
            color: c.color,
            visible: c.visible,
            x, y,
            state: this.cellState(x, y),
            blocked: c.blocked,
            reserved: c.reserved,
            stack,
            top: stack.length ? stack[stack.length - 1] : null,
            ground: stack[0] ?? null,
        };
    }

    /**
     * Edit a cell's properties in one call. Either an object of changes:
     *   m.setCell(2, 3, { color: 'red', visible: true, blocked: true })
     *   m.setCell(2, 3, { terrain: 'water', cost: 5 })     // custom properties
     * or a function that edits a copy of the cell's properties, which is then applied:
     *   m.setCell(2, 3, cell => { cell.blocked = !cell.blocked; cell.color = cell.blocked ? 'red' : 'green'; })
     * The cell can also be given as a point: m.setCell({ x: 2, y: 3 }, {...}),
     * e.g. m.setCell(m.cellAt('mouse'), { visible: true }).
     *
     * Editable: color, visible, blocked, reserved (booleans are coerced), and any
     * custom key, which is stored on the cell and shows up in cellInfo().
     * Not editable here: stack (use place / removeAt) and the computed
     * x, y, state, top, ground. Setting a custom key to undefined removes it.
     * Returns the updated cellInfo(), or false (this.lastError) when the cell is
     * outside the grid or a key isn't editable (then nothing is changed).
     */
    setCell(a, b, c) {
        let x = a, y = b, changes = c;
        if (a && typeof a === 'object') { x = a.x; y = a.y; changes = b; }
        const i = this._index(x, y);
        if (i < 0) return this._fail('setCell', `cell (${x}, ${y}) is outside the grid`);
        const cell = this.cells[i];

        if (typeof changes === 'function') {
            const draft = {};
            for (const k of Object.keys(cell)) if (k !== 'stack') draft[k] = cell[k];
            const before = Object.assign({}, draft);
            changes(draft);
            changes = {};
            for (const k of new Set([...Object.keys(before), ...Object.keys(draft)])) {
                if (draft[k] !== before[k]) changes[k] = draft[k];
            }
        }
        if (!changes || typeof changes !== 'object') return this._fail('setCell', 'changes must be an object or a function');

        const keys = Object.keys(changes);
        const bad = keys.find(k => tileMatrix.CELL_LOCKED.includes(k));
        if (bad) return this._fail('setCell', `'${bad}' can't be set with setCell()${bad === 'stack' ? ' (use place / removeAt)' : ''}`);
        for (const k of keys) {
            const v = changes[k];
            if (k === 'blocked' || k === 'reserved' || k === 'visible') cell[k] = !!v;
            else if (k === 'color') cell.color = v ?? this.defaultColor;
            else if (v === undefined) delete cell[k];
            else cell[k] = v;
        }
        return this.cellInfo(x, y);
    }

    /** Built-in cell keys (everything else on a cell is a custom property). */
    static CELL_KEYS = ['blocked', 'reserved', 'stack', 'color', 'visible'];
    /** Keys setCell() refuses: the stack and cellInfo()'s computed fields. */
    static CELL_LOCKED = ['stack', 'x', 'y', 'state', 'top', 'ground'];

    /** Reads a world point from (x, y), an object, a {x, y} point or 'mouse'. */
    static _worldPoint(a, b) {
        if (typeof a === 'number' && typeof b === 'number') return { x: a, y: b };
        if (a === undefined || a === 'mouse') {
            const m = (typeof World !== 'undefined' && World.active) ? World.active.mouse : window.mouse;
            a = m;
        }
        if (!a || typeof a !== 'object') return null;
        // Check transforms before plain x/y: gameObject also has x/y fields,
        // but those are only set in its constructor and go stale.
        let p = null;
        if (a.transform && a.transform.position) p = ('effectivePosition' in a) ? a.effectivePosition : a.transform.position;
        else if ('x' in a && 'y' in a) p = a;
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
        return { x: p.x, y: p.y };
    }

    // ---------- layer names ----------

    /** Level number for a layer name or number, or -1 if there's no such layer. */
    layerIndex(ref) {
        if (typeof ref === 'number') return Number.isInteger(ref) && ref >= 0 ? ref : -1;
        if (typeof ref === 'string') return this._layerNames.indexOf(ref);
        return -1;
    }

    /** Name of a level, or null when it's unnamed. */
    layerName(level) {
        return this._layerNames[level] ?? null;
    }

    /** All named levels: [{ level: 0, name: 'ground' }, ...] */
    get layers() {
        const out = [];
        this._layerNames.forEach((name, level) => { if (name) out.push({ level, name }); });
        return out;
    }

    /**
     * Highest level a placement can use + 1. In free-stack mode that's
     * maxLayers; otherwise only up to the highest named level.
     */
    get levelLimit() {
        if (this.freeStack) return this.maxLayers;
        return Math.min(this.maxLayers, this._layerNames.length);
    }

    /** Can objects go on this level at all (ignoring what's in the cell)? */
    isLevelAllowed(level) {
        if (!Number.isInteger(level) || level < 0 || level >= this.maxLayers) return false;
        return this.freeStack || level === 0 || !!this._layerNames[level];
    }

    /** Name (or rename) a level. Level 0 is 'ground' and can't be changed. */
    nameLayer(level, name) {
        if (!Number.isInteger(level) || level < 0) {
            throw new tileMatrixError(`nameLayer: level must be a non-negative integer (got ${level})`);
        }
        if (level === 0) {
            throw new tileMatrixError(`nameLayer: level 0 is the fixed '${tileMatrix.GROUND}' layer and can't be renamed`);
        }
        if (level >= this.maxLayers) {
            throw new tileMatrixError(`nameLayer: level ${level} is above maxLayers (${this.maxLayers})`);
        }
        if (typeof name !== 'string' || name.trim() === '') {
            throw new tileMatrixError(`nameLayer: name must be a non-empty string`);
        }
        if (name.toLowerCase() === tileMatrix.GROUND) {
            throw new tileMatrixError(`nameLayer: '${tileMatrix.GROUND}' is reserved for level 0`);
        }
        if (name === 'top') {
            throw new tileMatrixError(`nameLayer: 'top' is reserved (it means "next level up" in place/removeAt)`);
        }
        const existing = this._layerNames.indexOf(name);
        if (existing > -1 && existing !== level) {
            throw new tileMatrixError(`nameLayer: '${name}' is already the name of level ${existing}`);
        }
        while (this._layerNames.length < level) this._layerNames.push(null);
        this._layerNames[level] = name;
        // Keep placement records' layer names current (_placed doesn't exist yet during the constructor).
        if (this._placed) this._placed.forEach(rec => { if (rec.level === level) rec.layer = name; });
        return this;
    }

    /** Rename a layer by its current name or level. 'ground' can't be renamed. */
    renameLayer(ref, newName) {
        const level = this.layerIndex(ref);
        if (level === 0) {
            throw new tileMatrixError(`renameLayer: the '${tileMatrix.GROUND}' layer can't be renamed`);
        }
        if (level < 0 || !this._layerNames[level]) {
            throw new tileMatrixError(`renameLayer: no named layer '${ref}'`);
        }
        return this.nameLayer(level, newName);
    }

    // ---------- cell flags ----------

    setBlocked(x, y, value = true) { return this._setFlag(x, y, 'blocked', value); }
    setReserved(x, y, value = true) { return this._setFlag(x, y, 'reserved', value); }
    isBlocked(x, y) { const i = this._index(x, y); return i > -1 && this.cells[i].blocked; }
    isReserved(x, y) { const i = this._index(x, y); return i > -1 && this.cells[i].reserved; }

    _setFlag(x, y, flag, value) {
        const i = this._index(x, y);
        if (i < 0) return false;
        this.cells[i][flag] = !!value;
        return true;
    }

    // ---------- cell colors ----------

    /** Set one cell's color (any p5 color value). Returns false outside the grid. */
    setColor(x, y, color) {
        const i = this._index(x, y);
        if (i < 0) return false;
        this.cells[i].color = color;
        return true;
    }

    /** A cell's color, or null outside the grid. */
    getColor(x, y) {
        const i = this._index(x, y);
        return i < 0 ? null : this.cells[i].color;
    }

    /** Set the color of every cell. Pass visible (true/false) to change that too. */
    setAllColors(color, visible) {
        for (const c of this.cells) {
            c.color = color;
            if (visible !== undefined) c.visible = !!visible;
        }
        return this;
    }

    /** Set whether render() fills a cell with its color. Returns false outside the grid. */
    setVisible(x, y, value = true) {
        const i = this._index(x, y);
        if (i < 0) return false;
        this.cells[i].visible = !!value;
        return true;
    }

    isVisible(x, y) { const i = this._index(x, y); return i > -1 && this.cells[i].visible; }

    /** Set the visible state of every cell. */
    setAllVisible(value = true) {
        for (const c of this.cells) c.visible = !!value;
        return this;
    }

    /** Reset every cell's color to the default color (visible is untouched). */
    resetColors() {
        return this.setAllColors(this.defaultColor);
    }

    /** 'blocked' | 'occupied' | 'reserved' | 'empty', or null outside the grid. */
    cellState(x, y) {
        const i = this._index(x, y);
        if (i < 0) return null;
        this._pruneCells([i]);
        const c = this.cells[i];
        if (c.blocked) return tileMatrix.BLOCKED;
        if (c.stack.length > 0) return tileMatrix.OCCUPIED;
        if (c.reserved) return tileMatrix.RESERVED;
        return tileMatrix.EMPTY;
    }

    // ---------- reading ----------

    /** Copy of a cell's stack: index = level, null = empty level. */
    getStack(x, y) {
        const i = this._index(x, y);
        if (i < 0) return [];
        this._pruneCells([i]);
        return this.cells[i].stack.slice();
    }

    /** Object on a layer (name or level) of a cell, or null. */
    getAt(x, y, layer) {
        const i = this._index(x, y);
        const level = this.layerIndex(layer);
        if (i < 0 || level < 0) return null;
        this._pruneCells([i]);
        return this.cells[i].stack[level] ?? null;
    }

    /** Highest object in a cell, or null. */
    top(x, y) {
        const i = this._index(x, y);
        if (i < 0) return null;
        this._pruneCells([i]);
        const s = this.cells[i].stack;
        return s.length ? s[s.length - 1] : null;
    }

    /** Placement record of an object in this matrix, or null. */
    placementOf(obj) {
        return this._placed.get(obj) ?? null;
    }

    /** Is the object placed in this matrix? */
    has(obj) {
        return this.positionOf(obj) !== null;
    }

    /**
     * Where an object is in this matrix, or null if it isn't placed here:
     *   { x, y, level, layer, w, h, cells: [{ x, y }, ...] }
     * x, y is the top-left cell of its footprint; cells lists every cell it covers.
     * The result is a copy: changing it doesn't move the object.
     */
    positionOf(obj) {
        const rec = this._placed.get(obj);
        if (!rec) return null;
        if (obj.deleted) {
            this._remove(obj, 'collapse', 'deleted', { quiet: true });
            return null;
        }
        return {
            x: rec.x,
            y: rec.y,
            level: rec.level,
            layer: this.layerName(rec.level),
            w: rec.w,
            h: rec.h,
            cells: rec.cells.map(i => ({ x: i % this.cols, y: Math.floor(i / this.cols) })),
        };
    }

    /** Every object placed in this matrix. */
    get objects() {
        return [...this._placed.keys()];
    }

    // ---------- placing ----------

    /**
     * Place an object into cell (x, y) (cell coordinates, not pixels).
     *   opts.layer   'top' (default; next level above the highest object),
     *                a layer name, or a level number. Without opts.layer the
     *                object's tile.layer is used, then 'top'.
     *   opts.force   ignore the reserved flag and supports/accepts rules
     *                (never bounds, blocked cells, maxLayers or occupied levels)
     *   opts.anchor  overrides tile.anchor and the matrix anchor
     *   opts.quiet   don't log a failure
     * Returns the placement record { matrix, x, y, level, w, h, ... }, or
     * false (the reason is in this.lastError).
     *
     * If the object is ALREADY placed in this matrix, it's moved instead (see move()).
     */
    place(x, y, obj, opts = {}) {
        if (this._placed.has(obj) && !obj.deleted) return this.move(obj, x, y, opts);
        const rec = this._place(x, y, obj, this._teleportOpts(obj, opts), true);
        if (rec) this._afterTeleport(obj, rec, opts);
        return rec;
    }

    /**
     * Move an already placed object to cell (x, y). Same opts as place(), plus:
     *   opts.mode    what happens to objects resting on it (default this.moveMode):
     *                'block' refuses to move it, 'cascade' takes them out of the
     *                matrix, 'collapse' drops them onto what was under it,
     *                'carry' moves them along (same cell and level offsets;
     *                if any of them doesn't fit at the new spot, nothing moves)
     *   opts.anchor  defaults to the anchor it was placed with
     * On failure nothing changes (the object stays where it was) and it returns
     * false. Calls obj.onTileMoved(matrix, newPlacement, oldPlacement) if defined
     * (with 'carry', on every carried object too).
     * Moving to the cell it's already in, without asking for a different
     * layer, does nothing and returns its current placement.
     */
    move(obj, x, y, opts = {}) {
        const r = this._move(obj, x, y, this._teleportOpts(obj, opts), false);
        if (!r.ok) return this._fail('move', r.reason, opts);
        this._afterTeleport(obj, r.rec, opts);
        return r.rec;
    }

    /**
     * A linked object is tracked with anchor 'none' (never snapped). An explicit
     * place()/move() on it without opts.anchor is a teleport: it's positioned in
     * the new cell with its tile.anchor / the matrix anchor instead.
     */
    _teleportOpts(obj, opts) {
        if (!this._linked || !this._linked.has(obj) || opts.anchor !== undefined) return opts;
        return Object.assign({}, opts, { anchor: tileMatrix.tileInfo(obj).anchor ?? this.anchor });
    }

    /** After a teleport of a linked object: position it, keep tracking it from there. */
    _afterTeleport(obj, rec, opts) {
        const st = this._linked && this._linked.get(obj);
        if (!st || !rec || opts.anchor !== undefined) return;
        const anchor = tileMatrix.tileInfo(obj).anchor ?? this.anchor;
        // Also covers place() on the cell it's already in, which moves nothing.
        this._positionObject(obj, Object.assign({}, rec, { anchor }));
        rec.anchor = 'none';
        const p = obj.transform.position;
        st.x = p.x;
        st.y = p.y;
        st.inGrid = true;
        st.move = null;   // a running moveTo() path no longer fits
    }

    /** Same checks as place() / move() without changing anything: true, or the reason it would fail. */
    canPlace(x, y, obj, opts = {}) {
        const r = (this._placed.has(obj) && !obj.deleted)
            ? this._move(obj, x, y, opts, true)
            : this._check(x, y, obj, opts);
        return r.ok ? true : r.reason;
    }

    /** place() at the cell under a world position (e.g. the mouse). */
    placeAtWorld(wx, wy, obj, opts = {}) {
        const c = this.toCell(wx, wy);
        if (!c) return this._fail('place', `world position (${wx}, ${wy}) is outside the grid`, opts);
        return this.place(c.x, c.y, obj, opts);
    }

    _place(x, y, obj, opts, hooks) {
        const r = this._check(x, y, obj, opts);
        if (!r.ok) return this._fail('place', r.reason, opts);
        const rec = this._commit(x, y, obj, r, opts);
        if (hooks && typeof obj.onTilePlaced === 'function') obj.onTilePlaced(this, rec);
        return rec;
    }

    /**
     * Shared by move() and canPlace(). Lifts the object (and anything on it)
     * out, checks the new spot, then either commits or puts everything back.
     * Returns { ok, reason } or { ok: true, rec }.
     */
    _move(obj, x, y, opts, dryRun) {
        const old = this._placed.get(obj);
        if (!old) return { ok: false, reason: 'object is not placed in this matrix' };

        const ref = opts.layer ?? tileMatrix.tileInfo(obj).layer;
        const sameLevel = ref === null || ref === undefined || ref === 'top' || this.layerIndex(ref) === old.level;
        if (old.x === x && old.y === y && sameLevel) return { ok: true, rec: old };

        const mode = opts.mode ?? this.moveMode;
        if (!tileMatrix.MOVE_MODES.includes(mode)) {
            return { ok: false, reason: `unknown mode '${mode}' (use ${tileMatrix.MOVE_MODES.join(', ')})` };
        }
        const above = this._aboveSet(obj);
        if (mode === 'block' && above.length) {
            return { ok: false, reason: `${above.length} object(s) are on top of it (mode 'block')` };
        }

        const saved = above.map(o => [o, this._placed.get(o)]);
        const moveOpts = Object.assign({ anchor: old.anchor }, opts);
        this._detach(obj);
        saved.forEach(([o]) => this._detach(o));
        const r = this._check(x, y, obj, moveOpts);

        if (!r.ok || (dryRun && mode !== 'carry')) {
            this._attach(obj, old);
            saved.forEach(([o, rec]) => this._attach(o, rec));
            return r.ok ? { ok: true } : r;
        }

        const rec = this._commit(x, y, obj, r, moveOpts);
        if (mode === 'carry') return this._carry(obj, old, rec, saved, dryRun);
        if (mode === 'collapse') {
            this._resettle(saved);
        } else {
            saved.forEach(([o, oldRec]) => {
                if (typeof o.onTileRemoved === 'function') o.onTileRemoved(this, Object.assign({}, oldRec, { reason: 'cascade' }));
            });
        }
        if (typeof obj.onTileMoved === 'function') obj.onTileMoved(this, rec, old);
        return { ok: true, rec };
    }

    /**
     * 'carry' part of a move: obj is already committed at its new spot (rec);
     * the objects that were on it (saved, lowest first, detached) follow,
     * keeping their cell offset and their level offset from obj. All or
     * nothing: if one can't be placed, everything goes back to where it was.
     */
    _carry(obj, old, rec, saved, dryRun) {
        const dx = rec.x - old.x, dy = rec.y - old.y, dl = rec.level - old.level;
        const moved = [[obj, old, rec]];   // [object, old record, new record]

        const rollback = () => {
            moved.forEach(([o]) => this._detach(o));
            this._attach(obj, old);
            saved.forEach(([o, oRec]) => this._attach(o, oRec));
            [[obj, old], ...saved].forEach(([o, oRec]) => {
                if (this.setDrawLayer) o.layer = this.baseLayer + oRec.level;
                this._positionObject(o, oRec);
            });
            // objects at the destination may have been raised by the commit
            moved.forEach(([, , nRec]) => this._repositionAbove(nRec.cells, -1));
        };

        for (const [o, oRec] of saved) {
            const nx = oRec.x + dx, ny = oRec.y + dy;
            const oOpts = { layer: oRec.level + dl, anchor: oRec.anchor, force: oRec.force };
            const r = this._check(nx, ny, o, oOpts);
            if (!r.ok) {
                rollback();
                return { ok: false, reason: `can't carry an object that's on top of it: ${r.reason}` };
            }
            moved.push([o, oRec, this._commit(nx, ny, o, r, oOpts)]);
        }

        if (dryRun) {
            rollback();
            return { ok: true };
        }
        moved.forEach(([o, oRec, nRec]) => {
            if (typeof o.onTileMoved === 'function') o.onTileMoved(this, nRec, oRec);
        });
        return { ok: true, rec };
    }

    /** Put an object back exactly as a saved record says (no checks, no repositioning). */
    _attach(obj, rec) {
        for (const i of rec.cells) {
            const s = this.cells[i].stack;
            while (s.length < rec.level) s.push(null);
            s[rec.level] = obj;
        }
        this._placed.set(obj, rec);
        obj.tilePlacement = rec;
    }

    /** Writes a checked placement (r from _check) into the cells. */
    _commit(x, y, obj, r, opts) {
        const info = r.info;
        const level = r.level;
        for (const i of r.cells) {
            const s = this.cells[i].stack;
            while (s.length < level) s.push(null);
            s[level] = obj;
        }
        const rec = {
            matrix: this,
            x, y, level,
            layer: this.layerName(level),
            w: info.w, h: info.h,
            anchor: opts.anchor ?? info.anchor ?? this.anchor,
            force: !!opts.force,
            cells: r.cells,
        };
        this._placed.set(obj, rec);
        obj.tilePlacement = rec;
        if (this.setDrawLayer) obj.layer = this.baseLayer + level;
        this._positionObject(obj, rec);
        this._repositionAbove(rec.cells, level);
        this.lastError = null;
        return rec;
    }

    _check(x, y, obj, opts = {}) {
        const fail = (reason) => ({ ok: false, reason });
        if (!obj || typeof obj !== 'object') return fail('no object given');
        if (this._placed.has(obj)) return fail('object is already placed in this matrix (use move())');
        if (obj.tilePlacement && obj.tilePlacement.matrix && obj.tilePlacement.matrix !== this &&
            obj.tilePlacement.matrix._placed.has(obj)) {
            return fail('object is already placed in another tileMatrix');
        }
        if (obj.deleted) return fail('object is deleted');

        const info = tileMatrix.tileInfo(obj);
        const cells = [];
        for (let dy = 0; dy < info.h; dy++) {
            for (let dx = 0; dx < info.w; dx++) {
                const i = this._index(x + dx, y + dy);
                if (i < 0) return fail(`cell (${x + dx}, ${y + dy}) is outside the grid`);
                cells.push(i);
            }
        }
        this._pruneCells(cells);

        for (const i of cells) {
            const c = this.cells[i];
            const cx = i % this.cols, cy = Math.floor(i / this.cols);
            if (c.blocked) return fail(`cell (${cx}, ${cy}) is blocked`);
            if (c.reserved && !opts.force) return fail(`cell (${cx}, ${cy}) is reserved (use force)`);
        }

        // Which level?
        const ref = opts.layer ?? info.layer ?? 'top';
        let level;
        if (ref === 'top') {
            let base = 1;
            for (const i of cells) base = Math.max(base, this.cells[i].stack.length);
            level = base;
            if (!this.freeStack) {
                while (level < this.levelLimit && !this._layerNames[level]) level++;
            }
            if (level >= this.levelLimit) {
                return fail(this.freeStack
                    ? `stack is full (maxLayers ${this.maxLayers})`
                    : `no named layer is free above level ${base - 1}`);
            }
        } else {
            level = this.layerIndex(ref);
            if (level < 0) return fail(`unknown layer '${ref}'`);
        }
        if (!this.isLevelAllowed(level)) {
            if (level >= this.maxLayers) return fail(`level ${level} is above maxLayers (${this.maxLayers})`);
            return fail(`level ${level} has no name and freeStack is off`);
        }

        for (const i of cells) {
            if (this.cells[i].stack[level]) {
                const cx = i % this.cols, cy = Math.floor(i / this.cols);
                return fail(`level ${level} of cell (${cx}, ${cy}) is already taken`);
            }
        }

        if (!opts.force) {
            for (const i of cells) {
                const s = this.cells[i].stack;
                const cx = i % this.cols, cy = Math.floor(i / this.cols);
                // What it rests on: nearest object below, or bare ground.
                if (level > 0) {
                    const below = this._nearestBelow(s, level);
                    const supportInfo = below ? tileMatrix.tileInfo(below) : this.bareGround;
                    if (!tileMatrix.accepts(supportInfo, info)) {
                        return fail(below
                            ? `the object below in cell (${cx}, ${cy}) doesn't accept it`
                            : `bare ground in cell (${cx}, ${cy}) doesn't accept it`);
                    }
                }
                // Inserting under something: it has to accept what's above.
                const above = this._nearestAbove(s, level);
                if (above && !tileMatrix.accepts(info, tileMatrix.tileInfo(above))) {
                    return fail(`it doesn't accept the object above it in cell (${cx}, ${cy})`);
                }
            }
        }

        return { ok: true, level, cells, info };
    }

    _nearestBelow(stack, level) {
        for (let l = Math.min(level, stack.length) - 1; l >= 0; l--) if (stack[l]) return stack[l];
        return null;
    }

    _nearestAbove(stack, level) {
        for (let l = level + 1; l < stack.length; l++) if (stack[l]) return stack[l];
        return null;
    }

    /** px a level is raised by: the heights of everything under it (max over its cells). */
    _surface(cells, level) {
        let max = 0;
        for (const i of cells) {
            const s = this.cells[i].stack;
            let sum = 0;
            for (let l = 0; l < Math.min(level, s.length); l++) {
                if (s[l]) sum += tileMatrix.tileInfo(s[l]).height;
            }
            max = Math.max(max, sum);
        }
        return max;
    }

    _positionObject(obj, rec) {
        if (rec.anchor === 'none' || !obj.transform || !obj.transform.position) return;
        const o = this.transform.position;
        // Bounding box of the footprint's cells (for a square grid: the plain rectangle).
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const i of rec.cells) {
            const b = this._localBox(i % this.cols, Math.floor(i / this.cols));
            left = Math.min(left, b.left); top = Math.min(top, b.top);
            right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom);
        }
        left += o.x; right += o.x; top += o.y; bottom += o.y;
        const fw = right - left;
        const fh = bottom - top;
        const surf = this._surface(rec.cells, rec.level);
        const sz = obj.transform.scale || { x: 0, y: 0 };
        let px = left + fw / 2;
        let py = top + fh / 2 - surf;
        if (rec.cells.length === 1 && this.shape !== 'square') {
            // One cell: use the shape's own center (matters for triangles).
            const c = this.toWorld(rec.x, rec.y);
            px = c.x; py = c.y - surf;
        }
        if (rec.anchor === 'bottom') py = top + fh - surf - sz.y / 2;
        else if (rec.anchor === 'topleft') { px = left + sz.x / 2; py = top + sz.y / 2 - surf; }
        // Engine positions are object centers (rectMode(CENTER) in Renderer).
        obj.transform.position.x = px;
        obj.transform.position.y = py;
    }

    _repositionAbove(cells, level) {
        const seen = new Set();
        for (const i of cells) {
            const s = this.cells[i].stack;
            for (let l = level + 1; l < s.length; l++) {
                const o = s[l];
                if (o && !seen.has(o)) {
                    seen.add(o);
                    this._positionObject(o, this._placed.get(o));
                }
            }
        }
    }

    // ---------- removing ----------

    /**
     * Remove the object on a layer of a cell. layer: 'top' (default),
     * a layer name or a level number.
     *   opts.mode  what happens to objects resting on it (default this.removeMode):
     *     'block'    refuse while anything is on top
     *     'cascade'  remove everything on top too
     *     'collapse' everything on top falls down onto whatever is now under
     *                it (free stack: levels compact; named layers: they keep
     *                their level). Anything the new support doesn't accept is
     *                cascaded.
     * Returns the array of objects taken out of the matrix (the target first),
     * or false. Removed objects are NOT deleted: delete them yourself, or use
     * the onTileRemoved hook (e.g. to drop an item).
     */
    removeAt(x, y, layer = 'top', opts = {}) {
        const i = this._index(x, y);
        if (i < 0) return this._fail('remove', `cell (${x}, ${y}) is outside the grid`, opts);
        this._pruneCells([i]);
        const s = this.cells[i].stack;
        let level;
        if (layer === 'top') {
            if (!s.length) return this._fail('remove', `cell (${x}, ${y}) is empty`, opts);
            level = s.length - 1;
        } else {
            level = this.layerIndex(layer);
            if (level < 0) return this._fail('remove', `unknown layer '${layer}'`, opts);
        }
        const obj = s[level];
        if (!obj) return this._fail('remove', `nothing on level ${level} of cell (${x}, ${y})`, opts);
        return this._remove(obj, opts.mode ?? this.removeMode, 'removed', opts);
    }

    /** Remove a placed object wherever it is. Same opts/return as removeAt(). */
    removeObject(obj, opts = {}) {
        if (!this._placed.has(obj)) return this._fail('remove', 'object is not placed in this matrix', opts);
        return this._remove(obj, opts.mode ?? this.removeMode, 'removed', opts);
    }

    /** Remove everything (no hooks), e.g. before rebuilding a level. */
    clear() {
        for (const obj of [...this._placed.keys()]) this._detach(obj);
        return this;
    }

    _remove(target, mode, reason, opts = {}) {
        if (!tileMatrix.REMOVE_MODES.includes(mode)) {
            return this._fail('remove', `unknown remove mode '${mode}' (use ${tileMatrix.REMOVE_MODES.join(', ')})`, opts);
        }
        const above = this._aboveSet(target);
        if (mode === 'block' && above.length) {
            return this._fail('remove', `${above.length} object(s) are on top of it (mode 'block')`, opts);
        }

        const removed = [];
        const takeOut = (obj, why) => {
            const rec = this._detach(obj);
            removed.push(obj);
            if (typeof obj.onTileRemoved === 'function') obj.onTileRemoved(this, Object.assign({}, rec, { reason: why }));
        };

        if (mode === 'collapse') {
            const saved = above.map(o => [o, this._placed.get(o)]);
            takeOut(target, reason);
            saved.forEach(([o]) => this._detach(o));
            removed.push(...this._resettle(saved));
        } else {
            takeOut(target, reason);
            above.forEach(o => takeOut(o, 'cascade'));
        }
        this.lastError = null;
        return removed;
    }

    /**
     * 'collapse': re-place detached objects ([obj, oldRecord] pairs, lowest
     * first) on whatever is now under them. Free stack: they drop to the next
     * free level; named layers: they keep their level. Returns the ones that
     * didn't fit (they're out of the matrix and get onTileRemoved 'cascade').
     */
    _resettle(saved) {
        const dropped = [];
        for (const [o, rec] of saved) {
            const back = this._place(rec.x, rec.y, o, {
                layer: this.freeStack ? 'top' : rec.level,
                anchor: rec.anchor,
                force: rec.force,
                quiet: true,
            }, false);
            if (!back) {
                dropped.push(o);
                if (typeof o.onTileRemoved === 'function') o.onTileRemoved(this, Object.assign({}, rec, { reason: 'cascade' }));
            }
        }
        return dropped;
    }

    /** Everything resting on obj, directly or through other objects, lowest first. */
    _aboveSet(obj) {
        const found = new Set([obj]);
        const queue = [obj];
        while (queue.length) {
            const rec = this._placed.get(queue.shift());
            if (!rec) continue;
            for (const i of rec.cells) {
                const s = this.cells[i].stack;
                for (let l = rec.level + 1; l < s.length; l++) {
                    const o = s[l];
                    if (o && !found.has(o)) { found.add(o); queue.push(o); }
                }
            }
        }
        found.delete(obj);
        return [...found].sort((a, b) => this._placed.get(a).level - this._placed.get(b).level);
    }

    /** Take obj out of its cells and the registry. Returns its old record. */
    _detach(obj) {
        const rec = this._placed.get(obj);
        if (!rec) return null;
        for (const i of rec.cells) {
            const s = this.cells[i].stack;
            if (s[rec.level] === obj) s[rec.level] = null;
            while (s.length && !s[s.length - 1]) s.pop();
        }
        this._placed.delete(obj);
        if (obj.tilePlacement === rec) obj.tilePlacement = null;
        return rec;
    }

    /** Take deleted objects (obj.deleted) out of some cells; things on top collapse. */
    _pruneCells(indices) {
        const dead = new Set();
        for (const i of indices) {
            for (const o of this.cells[i].stack) if (o && o.deleted) dead.add(o);
        }
        dead.forEach(o => { if (this._placed.has(o)) this._remove(o, 'collapse', 'deleted', { quiet: true }); });
    }

    /** Take every deleted object out of the matrix. */
    prune() {
        for (const o of [...this._placed.keys()]) {
            if (o.deleted && this._placed.has(o)) this._remove(o, 'collapse', 'deleted', { quiet: true });
        }
        return this;
    }

    _fail(action, reason, opts = {}) {
        this.lastError = reason;
        if (this.logErrors && !opts.quiet) new Message(`tileMatrix|${action}: ${reason}`);
        return false;
    }

    // ---------- linked objects ----------
    //
    // A linked object moves freely (its own physics, scripts, moveTo()), and the
    // matrix keeps its cell up to date from its CENTER (transform.position, the
    // same center the renderer draws around). It's placed in its cell with
    // anchor 'none', so the matrix never snaps it. Every tick, after all objects
    // have updated (Scene's late pass -> lateUpdate()):
    //   - entering another cell moves its placement there (onTileMoved fires)
    //   - it can't leave the grid or enter a cell it couldn't be placed in
    //     (blocked/reserved cells, support rules, ...): it stops at the edge
    //     ('block'), slides along it if it can, and the blocked velocity is zeroed
    // Fast moves are checked in half-cell steps, so it can't skip over a cell.
    // To make cells exclusive between linked objects, give them
    // tile: { supports: false } so nothing can stack on them.
    //
    // OUTSIDE objects: a linked object can also be in no cell at all (see
    // `outside`). That happens when it's linked while its center is outside the
    // grid, or when it's taken out of its cells (release(), removeObject(),
    // removeAt(), a cascade, clear()): it stays linked instead of being dropped.
    // An outside object moves freely (no blocking) and gets a cell again when:
    //   - it crosses INTO the grid from beyond its edge (if that cell won't take
    //     it, it's blocked at the edge like any wall), or
    //   - you call link(obj) again while its center is over a cell.
    // An object released while still over the grid stays outside until one of those.

    /**
     * Link objects (or arrays of objects) to this matrix. Each one is placed in
     * the cell under its center without being moved; one whose center is outside
     * the grid is linked as an outside object instead. Calling it on an outside
     * object that's over the grid places it. Returns true when all of them were
     * linked (and placed, if over the grid); a failure (cell blocked, footprint
     * bigger than 1x1, ...) is reported like place() (this.lastError).
     */
    link(...objects) {
        let ok = true;
        for (const obj of objects.flat(Infinity)) if (!this._link(obj)) ok = false;
        return ok;
    }

    _link(obj) {
        if (!obj || typeof obj !== 'object' || !obj.transform || !obj.transform.position) {
            return this._fail('link', 'needs an object with a transform');
        }
        const linked = this._linked.get(obj);
        if (linked && this._placed.has(obj)) return true;
        const info = tileMatrix.tileInfo(obj);
        if (info.w > 1 || info.h > 1) return this._fail('link', 'only objects with a 1x1 footprint can be linked');
        const p = obj.transform.position;
        const c = this.toCell(p.x, p.y);
        if (!c) {
            // Outside the grid: linked, but in no cell (the outside list).
            if (this._placed.has(obj)) this._detach(obj);
            if (!linked) this._linked.set(obj, { x: p.x, y: p.y, move: null, inGrid: false });
            return true;
        }
        if (this._placed.has(obj)) {
            if (!this.move(obj, c.x, c.y, { anchor: 'none' })) return false;
            this._placed.get(obj).anchor = 'none';
        } else if (!this.place(c.x, c.y, obj, { anchor: 'none' })) {
            return false;
        }
        if (linked) Object.assign(linked, { x: p.x, y: p.y, inGrid: true });
        else this._linked.set(obj, { x: p.x, y: p.y, move: null, inGrid: true });
        return true;
    }

    /** Stop tracking objects. They stay placed in their current cell (removeObject() takes them out). */
    unlink(...objects) {
        for (const obj of objects.flat(Infinity)) this._linked.delete(obj);
        return this;
    }

    /**
     * Take linked objects out of every cell but keep them linked: they join the
     * outside list (see `outside`). Objects stacked on them follow removeMode
     * (default 'block': it fails while something is on top). Fires
     * onTileRemoved with reason 'released'. Any moveTo() is stopped. Returns
     * true when all of them are now outside.
     */
    release(...objects) {
        let ok = true;
        for (const obj of objects.flat(Infinity)) {
            const st = this._linked.get(obj);
            if (!st) { ok = this._fail('release', 'object is not linked to this matrix') && ok; continue; }
            st.move = null;
            if (!this._placed.has(obj)) continue;
            if (!this._remove(obj, this.removeMode, 'released')) ok = false;
        }
        return ok;
    }

    isLinked(obj) { return this._linked.has(obj); }

    /** Is obj linked but in no cell? */
    isOutside(obj) { return this._linked.has(obj) && !this._placed.has(obj); }

    /** Every linked object. */
    get linked() { return [...this._linked.keys()]; }

    /** Linked objects that are in no cell (outside the grid, or released). */
    get outside() { return [...this._linked.keys()].filter(o => !this._placed.has(o)); }

    /**
     * Walk a linked object to cell (x, y). The matrix's pathing AI
     * (this.pathing, or opts.pathing for this call) plans the path and moves
     * the object along it each tick; see PathingAI for how. opts (each overrides
     * the AI's setting for this walk):
     *   speed, align, maxRepaths, corners, cornerRule, cornerCost, passable
     *   onArrive(obj, cell), onBlocked(obj, cell)   called when it arrives / gives up
     * Returns the planned path (see findPath()) or false (this.lastError).
     * A new moveTo() replaces the current one.
     */
    moveTo(obj, x, y, opts = {}) {
        const st = this._linked.get(obj);
        if (!st) return this._fail('moveTo', 'object is not linked to this matrix (use link())', opts);
        if (!this.inBounds(x, y)) return this._fail('moveTo', `cell (${x}, ${y}) is outside the grid`, opts);
        const rec = this._placed.get(obj);
        if (!rec) return this._fail('moveTo', 'object is outside the matrix (in no cell)', opts);
        const ai = opts.pathing ?? this.pathing;
        const path = ai.findPath(this, { x: rec.x, y: rec.y }, { x, y }, Object.assign({}, opts, { obj }));
        if (!path) return this._fail('moveTo', `no path to cell (${x}, ${y})`, opts);
        st.move = ai.start(this, obj, { x, y }, path, opts);
        return path.slice();
    }

    /**
     * The pathing AI that plans and drives moveTo() for linked objects: a
     * PathingAI (or any object with the same findPath / start / step methods).
     * Assigning a plain options object builds a PathingAI from it.
     */
    get pathing() { return this._pathing; }
    set pathing(ai) {
        if (ai && typeof ai === 'object' && !(typeof ai.findPath === 'function' && typeof ai.step === 'function')) {
            ai = new PathingAI(ai);
        }
        if (!ai || typeof ai.findPath !== 'function' || typeof ai.start !== 'function' || typeof ai.step !== 'function') {
            throw new tileMatrixError('pathing must be a PathingAI (or have findPath, start and step methods)');
        }
        this._pathing = ai;
    }

    /** Stop a moveTo() where the object is now. */
    stopMove(obj) {
        const st = this._linked.get(obj);
        if (st) st.move = null;
        return this;
    }

    isMoving(obj) { const st = this._linked.get(obj); return !!(st && st.move); }

    /** Cells a moving object still has to walk through ([] when it isn't moving). */
    remainingPath(obj) {
        const st = this._linked.get(obj);
        return st && st.move ? st.move.path.slice() : [];
    }

    /** Tick: moveTo() movement (done by each walk's pathing AI). Runs with the other objects' update(). */
    update(dt = 1 / 60) {
        super.update(dt);
        for (const [obj, st] of this._linked) {
            if (obj.deleted) { this._linked.delete(obj); continue; }
            if (st.move) st.move.ai.step(this, obj, st, dt);
        }
    }

    /** Late tick (after every object moved): keep linked objects' cells in sync. */
    lateUpdate() {
        for (const [obj, st] of this._linked) {
            if (obj.deleted) { this._linked.delete(obj); continue; }
            this._syncLinked(obj, st);
        }
    }

    /** Make the linked object's placement match its position, or push it back ('block'). */
    _syncLinked(obj, st) {
        const p = obj.transform.position;
        if (p.x === st.x && p.y === st.y) return;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { p.x = st.x; p.y = st.y; return; }
        const tx = p.x, ty = p.y;
        const vel = obj.transform.velocity;
        const stop = (axis) => {
            if (!vel) return;
            vel[axis] = 0;
            if (vel.self) vel.self[axis] = 0;
        };
        if (this._walk(obj, st, tx, ty).blocked) {
            // Slide along whatever stopped it: try each axis on its own.
            if (this._walk(obj, st, tx, st.y).moved) stop('y');
            else if (this._walk(obj, st, st.x, ty).moved) stop('x');
            else { stop('x'); stop('y'); }
        }
        p.x = st.x;
        p.y = st.y;
    }

    /**
     * Move st (the last accepted position) toward (tx, ty) in half-cell steps.
     * Placed: the placement follows into each new cell; it stops before the
     * first step that leaves the grid or can't enter its cell.
     * Outside: it moves freely; a step that crosses from beyond the grid's edge
     * onto a cell places it there (or stops it, if the cell won't take it).
     */
    _walk(obj, st, tx, ty) {
        const dx = tx - st.x, dy = ty - st.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return { blocked: false, moved: false };
        const n = Math.max(1, Math.ceil(dist / (Math.min(this.cell.w, this.cell.h) / 2)));
        const sx = st.x, sy = st.y;
        let moved = false;
        for (let i = 1; i <= n; i++) {
            const px = i === n ? tx : sx + dx * i / n;
            const py = i === n ? ty : sy + dy * i / n;
            const c = this.toCell(px, py);
            const rec = this._placed.get(obj);
            if (rec) {
                const cell = c ? this._walkCell(px, py, c, rec, obj) : null;
                if (!cell) return { blocked: true, moved };
                if ((cell.x !== rec.x || cell.y !== rec.y) && !this.move(obj, cell.x, cell.y, { anchor: 'none', quiet: true })) {
                    return { blocked: true, moved };
                }
            } else if (c && !st.inGrid && !this.place(c.x, c.y, obj, { anchor: 'none', quiet: true })) {
                return { blocked: true, moved };   // entering from outside, but the cell won't take it
            }
            st.x = px;
            st.y = py;
            st.inGrid = !!c;
            moved = true;
        }
        return { blocked: false, moved };
    }

    /**
     * Which cell a walking (placed) object at world point (px, py) is in, given
     * c = toCell(px, py) and its current placement rec, or null if it can't be
     * there. A point only counts as inside a closed cell when it's strictly
     * inside: on that cell's edge or vertex it belongs to the current cell (if
     * it's on its edge too) or to a neighbouring cell that's open. That's how a
     * corner step slips past a closed cell through their shared vertex, and how
     * a slide runs along a closed cell's edge.
     */
    _walkCell(px, py, c, rec, obj) {
        if (c.x === rec.x && c.y === rec.y) return c;
        if (this.canPlace(c.x, c.y, obj, { anchor: 'none' }) === true) return c;
        const eps = 1e-6 * Math.max(this.cell.w, this.cell.h);
        const onEdge = (x, y) => tileMatrix.distToPolygon(px, py, this.cellPolygon(x, y)) <= eps;
        if (!onEdge(c.x, c.y)) return null;                       // strictly inside a closed cell
        if (onEdge(rec.x, rec.y)) return { x: rec.x, y: rec.y };  // still on its own cell's edge
        for (const d of this.directions(c.x, c.y)) {
            if ((d.x !== rec.x || d.y !== rec.y) && onEdge(d.x, d.y) &&
                this.canPlace(d.x, d.y, obj, { anchor: 'none' }) === true) {
                return { x: d.x, y: d.y };
            }
        }
        return null;
    }

    // ---------- lifetime / drawing ----------

    delete() {
        this._linked.clear();
        this.clear();
        this.deleted = true;
        const idx = tileMatrix.matrices.indexOf(this);
        if (idx > -1) tileMatrix.matrices.splice(idx, 1);
        this.remove(this);   // shell.remove: takes it out of shell.allObjects
    }

    /** Fills every cell whose `visible` is true with its `color`. */
    renderCells() {
        push();
        noStroke();
        for (let i = 0; i < this.cells.length; i++) {
            const c = this.cells[i];
            if (!c.visible) continue;
            fill(c.color);
            this._drawCell(i);
        }
        pop();
    }

    /** Draws cell i's shape with the current fill/stroke. */
    _drawCell(i) {
        const poly = this.cellPolygon(i % this.cols, Math.floor(i / this.cols));
        beginShape();
        for (const v of poly) vertex(v.x, v.y);
        endShape(CLOSE);
    }

    /**
     * Draws visible cell colors, then the debug overlay (this.debug):
     *   states  every cell is tinted with debug.colors[its state], read straight
     *           from the cell, so direct edits show too. Same priority as
     *           cellState(): blocked > occupied > reserved > empty. Blocked cells
     *           also get a thick outline so they stand out over any cell color.
     *   grid    cell outlines in debug.gridColor
     */
    render() {
        if (this.deleted) return;
        if (typeof Scene !== 'undefined' && Scene.activeScene && !this.scenes.includes(Scene.activeScene)) return;
        this.renderCells();
        const dbg = this.debug;
        push();
        if (dbg.states) {
            const colors = dbg.colors || {};
            for (let i = 0; i < this.cells.length; i++) {
                const c = this.cells[i];
                const state = c.blocked ? tileMatrix.BLOCKED
                    : c.stack.some(o => o) ? tileMatrix.OCCUPIED
                    : c.reserved ? tileMatrix.RESERVED
                    : tileMatrix.EMPTY;
                const col = colors[state];
                if (!col) continue;
                fill(col);
                if (state === tileMatrix.BLOCKED) { stroke(col); strokeWeight(2); }
                else noStroke();
                this._drawCell(i);
            }
        }
        if (dbg.grid) {
            stroke(dbg.gridColor);
            strokeWeight(1);
            noFill();
            for (let i = 0; i < this.cells.length; i++) this._drawCell(i);
        }
        pop();
    }
}

