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
    /**
     * The position everything should READ (drawing, hitbox world
     * position, debug overlays, position()). For most objects this is just
     * transform.position itself (same object, so code that holds on to it
     * keeps working). gameObject overrides it so that objects with
     * `ignoreCamera` get a NEW {x, y} = own position + camera position.
     * Writes always go to transform.position.
     */
    get effectivePosition() { return this.transform.position; }

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
        super();
        gameObject.init();
        this.id = "MALE:gameObject[" + Math.random().toString(36).substring(2) + "]";
        this.superId = this.id;
        this.deleted = false;
        this.transform = new Transform(x, y, w, h);
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
        
        let move = {
            x: (vel.self.x || 0) * deltaTime * 10,
            y: (vel.self.y || 0) * deltaTime * 10,
        };


        // pos.x += move.x;
        // pos.y += move.y;
        //this._sweepMove(deltaTime);


        const gap = Math.hypot(move.x,move.y);
        const gapAngle = Math.atan2(move.x,move.y) - Math.PI/2;
        const sizeThreshold = Math.hypot(scale.x*-Math.cos(gapAngle),scale.y*-Math.sin(gapAngle));

        //if the velocity moves the object greater than its size: test for ray cast
        if(gap > sizeThreshold){
            //console.log(`Ray-Casting Reccomended:`,pad(gap/sizeThreshold));
            let subMove = {
                x:move.x/sizeThreshold,
                y:move.y/sizeThreshold
            };
            for(let g = 0; g<gap;g+=gap/sizeThreshold){
                pos.x += subMove.x;
                pos.y += subMove.y;
                this.processCollisions();
            }
        }

        // // Sub-step movement so fast objects don't tunnel.
        // let subSteps = 1000;
        // let maxStepSize = 1;
        // let totalDist = Math.hypot(move.x,move.y);
        // //if (totalDist > maxStepSize) subSteps = Math.ceil(totalDist / maxStepSize);
        // //subSteps = Math.min(subSteps, 100);

        // let subMove = { x: move.x / subSteps, y: move.y / subSteps };
        // this._subStepCount = subSteps;

        // for (let step = 0; step < subSteps; step++) {
        //     pos.x += subMove.x;
        //     pos.y += subMove.y;

        //     if (isNaN(pos.x) || isNaN(pos.y)) {
        //         console.warn(`Position became NaN for object ${this.id}, reverting to previous position`);
        //         pos.x = this.previousPosition.x || 0;
        //         pos.y = this.previousPosition.y || 0;
        //         return;
        //     }

        //     this.hitbox.forEach((hb) => {
        //         hb.updatePosition();
        //         hb.width = hb.transform.scale.x || 20;
        //         hb.height = hb.transform.scale.y || 20;
        //     });

        //     this.processCollisions();
        // }
        
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
     * Advances this object along its per-tick velocity, sweeping collision
     * at 1-pixel intervals from its current position to its future position.
     *
     *   per-tick move = velocity.self * deltaTime
     *                 = velocity / tickRate   (because deltaTime = 1 / tickRate)
     *
     * `deltaTime` is exactly what Scene.tick passes to update() — do not
     * recompute it from World or a hard-coded 1/60.
     *
     * Behaviour:
     *   - moveDist <= 0.0001  →  nothing happens (no sweep cost).
     *   - collision disabled  →  full move applied, no sweep.
     *   - else                →  sample positions at 1 px steps; stop AT the
     *                            first sample that overlaps a solid hitbox so
     *                            processCollisions() (which runs right after,
     *                            with err = 1.0) sees the contact, resolves it,
     *                            and sets grounded / sides.
     *
     * Side effects: transform.position, hitbox positions, this._subStepCount.
     */
    _sweepMove(deltaTime) {
        const vel = this.transform.velocity;
        const pos = this.transform.position;

        // ---- Per-tick velocity (this is the max simulation distance) ----
        const move = {
            x: (vel.self.x || 0) * deltaTime,
            y: (vel.self.y || 0) * deltaTime,
        };
        const moveDist = Math.hypot(move.x, move.y);

        this._subStepCount = 100;

        if (moveDist <= 0.0001) return;

        // No point sweeping if we can't collide with anything.
        if (!this.collision || !this.collision.enabled) {
            pos.x += move.x;
            pos.y += move.y;
            return;
        }

        const scene = this.getParentScene();
        if (!scene) {
            pos.x += move.x;
            pos.y += move.y;
            return;
        }

        // ---- Pre-filter: only objects whose bounds overlap the swept
        // AABB (current footprint + the move vector) can possibly collide.
        let sb = null;
        this.hitbox.forEach((hb) => {
            const b = hb.bounds(1);
            if (!sb) sb = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
            else {
                sb.left   = Math.min(sb.left,   b.left);
                sb.right  = Math.max(sb.right,  b.right);
                sb.top    = Math.min(sb.top,    b.top);
                sb.bottom = Math.max(sb.bottom, b.bottom);
            }
        });

        let candidates = null;
        if (sb) {
            const swept = {
                left:   sb.left   + Math.min(0, move.x),
                right:  sb.right  + Math.max(0, move.x),
                top:    sb.top    + Math.min(0, move.y),
                bottom: sb.bottom + Math.max(0, move.y),
            };
            candidates = scene.objects.filter((other) => {
                if (other.id === this.id || other.deleted || !other.active) return false;
                if (!other.collision || !other.collision.enabled || !other.collision.solid) return false;
                return other.hitbox.some((hb) => {
                    const ob = hb.bounds(1);
                    return ob.left < swept.right && ob.right > swept.left &&
                        ob.top  < swept.bottom && ob.bottom > swept.top;
                });
            });
        }

        // ---- Sweep: 1-pixel steps from current position to future position ----
        const dirX = move.x / moveDist;
        const dirY = move.y / moveDist;

        // MAX_SWEEP_STEPS protects the frame from absurdly fast objects.
        // At 60 Hz, 1000 px/tick is 60000 px/sec — plenty of headroom.
        const MAX_SWEEP_STEPS = 1000;
        const stepCount = Math.min(MAX_SWEEP_STEPS, Math.max(1, Math.ceil(moveDist)));
        this._subStepCount = stepCount;

        const startX = pos.x;
        const startY = pos.y;
        let safeT = 1.0;

        for (let i = 1; i <= stepCount; i++) {
            // Exactly i pixels along the move vector (clamped to moveDist
            // so the last sample lands on the exact future position).
            const d = Math.min(i, moveDist);
            const tx = startX + dirX * d;
            const ty = startY + dirY * d;
            if (isNaN(tx) || isNaN(ty)) break;

            if (this._collidesAt(tx, ty, 0, candidates)) {
                safeT = d / moveDist;
                break;
            }
        }

        pos.x = startX + move.x * safeT;
        pos.y = startY + move.y * safeT;
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
            other.hitbox.forEach((hb) => hb.updatePosition());

            this.hitbox.forEach((thisHitbox, index) => {
                if (!thisHitbox.collision || !thisHitbox.collision.enabled) return;
                
                other.hitbox.forEach((otherHitbox) => {
                    if (!otherHitbox.collision || !otherHitbox.collision.enabled) return;

                    if (thisHitbox.collidesWith(otherHitbox, 1.0)) {
                        
                        collisions.push({
                            thisHitbox, otherHitbox, other, index, excluded
                        });

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

                        if (index === lowestHitboxIndex && sides.includes("bottom") && !excluded) {
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
                if (!other.collision || !other.collision.enabled || !other.collision.resolve) return;
                if (!(other.collision.static || !other.collision.pushable)) return;
                var excluded = false;
                this.collision.excluded.forEach(ex => {
                    if(ex == other)excluded = true;
                });
                if(!excluded)
                other.hitbox.forEach((hb) => {
                    if (this.grounded || !hb.collision || !hb.collision.enabled || !hb.collision.resolve) return;
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
                if (!coll.thisHitbox.collision.resolve || !coll.otherHitbox.collision.resolve) continue;

                if (coll.thisHitbox.collidesWith(coll.otherHitbox, 0)) {
                    if (this.collision.solid || coll.other.collision.solid) {
                        if(!coll.excluded)this.resolveCollision(coll.other, coll.thisHitbox, coll.otherHitbox);
                    }
                }
            }
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
                applyDamage(n){
                    if(this.shield.value > 0){
                        if(this.shield.value - n*(1+this.shield.decay) >= 0){
                            this.shield.value -= Number(pad(n*(1+this.shield.decay),1,2));
                            this.health -= Number(pad(n*(1-this.shield.protection),1,2));
                        }else{
                            //total damage - damage needed to break shield * damage taken with shield up
                            let total = (this.shield.value/(1+this.shield.decay))*(1-this.shield.protection);
                            this.shield.value = 0;
                            this.health -= Number(pad(total,1,2));
                            this.health = Number(pad(this.health,1,2));
                        }
                    }else{
                        this.health -= n;
                    }
                    this.damaged = true;
                    if(this.damageFlash)this.damageFlash();
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
                    value:1.5,
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
                            
                            
                            if(typeof target.applyDamage != 'function'){
                                target.health -= self.attack.damage;
                                //return true;
                            }else {
                                target.applyDamage(self.attack.damage);
                                //return true;
                            }
                            //return 'error';
                            self.isAttacking = true;
                            setTimeout(() => {
                                self.isAttacking = false;
                            }, 1/self.attack.speed);
                        }
                        return false;
                    },1/self.attack.speed);
                    self.tryAttack = att;
                    return true;
                }
            };
            
            return pck;
        }
    };
    constructor(x, y, w, h, id, ...scenes) {
        super(x, y, w, h, ...scenes);
        this.id = id;
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

        let move = {
            x: (vel.self.x || 0) * deltaTime * 10,
            y: (vel.self.y || 0) * deltaTime * 10,
        };

        let subSteps = 1;
        let maxStepSize = 20;
        let totalDist = Math.sqrt(move.x * move.x + move.y * move.y);
        if (totalDist > maxStepSize) subSteps = Math.ceil(totalDist / maxStepSize);
        subSteps = Math.min(subSteps, 10);

        let subMove = { x: move.x / subSteps, y: move.y / subSteps };
        this._subStepCount = subSteps;

        for (let step = 0; step < subSteps; step++) {
            pos.x += subMove.x;
            pos.y += subMove.y;

            if (isNaN(pos.x) || isNaN(pos.y)) {
                console.warn(`Position became NaN for object ${this.id}, reverting to previous position`);
                pos.x = this.previousPosition.x || 0;
                pos.y = this.previousPosition.y || 0;
                return;
            }

            this.hitbox.forEach((hb) => {
                hb.updatePosition();
                hb.width = hb.transform.scale.x || 20;
                hb.height = hb.transform.scale.y || 20;
            });

            this.processCollisions();
        }

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
        // `pos` is the Mouse, a {x, y} in canvas pixels, or another object.
        hover:(pos = UI.mouseSource(),obj = this)=>{
            const p = UI.pointerOf(pos);
            if(!p || !obj || !obj.transform) return false;
            if(obj.active === false) return false;
            if(obj.rendering && obj.rendering.visible === false) return false;
            if(!UI.contains(obj,p)) return false;
            if(UI._consoleOwns(p)) return false;
            // Overlapping UI objects: only the one on top is hovered.
            if(UI.objects && UI.objects.includes(obj) && UI.topAt(p) !== obj) return false;
            return obj.enabled !== false;
        },
        // Hovered, and the mouse has just been clicked.
        clicked:(pos = UI.mouseSource(),obj = this)=>{
            const selection = UI.mouseSource();
            return !!selection && !!selection.clicked && UI.getEvents.hover(pos,obj);
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
        UI._releasedOn = null;      // ...and released from (kept for the tick that sees the click)
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

    /** Pointer position in canvas pixels, or null. */
    static pointer() {
        const m = UI.mouseSource();
        return m ? UI.toCanvas(m.x, m.y) : null;
    }

    /** Turns whatever getEvents was given into a canvas-pixel point (or null). */
    static pointerOf(src) {
        if (!src) return null;
        if (src.transform && src.transform.position) return { x: src.transform.position.x, y: src.transform.position.y };
        if (typeof Mouse !== "undefined" && src instanceof Mouse) return UI.toCanvas(src.x, src.y);
        if (isFinite(src.x) && isFinite(src.y)) return { x: src.x, y: src.y };
        return null;
    }

    /** Is the canvas point inside obj's rectangle? Takes obj's rotation into account. */
    static contains(obj, p) {
        const t = obj.transform;
        let dx = p.x - t.position.x, dy = p.y - t.position.y;
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

    /** Topmost interactive UI object under a canvas point (draw order: layer, then creation). */
    static topAt(p) {
        if (!p) return null;
        const list = (typeof Scene !== "undefined" && Scene.renderOrder) ? Scene.renderOrder(UI.active()) : UI.active();
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].interactive !== false && UI.contains(list[i], p)) return list[i];
        }
        return null;
    }

    /** getInput() asks this: hide the mouse from the game while the pointer is over a UI object. */
    static blocksInput(domain) {
        if (!Object.prototype.hasOwnProperty.call(UI, "_ready")) return false;
        if (domain !== "mouse") return false;
        const p = UI.pointer();
        return !!(UI._downOn || (p && UI.topAt(p)));
    }

    static _bindInput() {
        if (UI._bound) return true;
        const m = UI.mouseSource();
        if (!m || typeof m.subscribe !== "function") return false;
        m.subscribe((ev) => UI._onMouse(ev));
        UI._bound = true;
        return true;
    }

    // The Mouse only keeps flags (pressed / clicked). A press and release can both
    // fit inside one 20ms tick, so remember WHERE the press began from the events.
    static _onMouse(ev) {
        if (ev.button !== 0) return;
        const p = UI.toCanvas(ev.x, ev.y);
        if (ev.type === "down") {
            UI._downOn = UI.topAt(p);
            UI.selected = UI._downOn;
        } else if (ev.type === "up") {
            UI._releasedOn = UI._downOn;
            UI._downOn = null;
        }
    }

    /** End of every game tick (called by Scene.tick after the objects' scripts). */
    static tick() {
        UI.init();
        UI._bindInput();
        UI._releasedOn = null;
    }

    /** Pointer cursor while the mouse is over something clickable (called by Scene.render). */
    static applyCursor() {
        if (typeof cursor !== "function") return;
        const p = UI.pointer();
        const over = !!(p && !UI._consoleOwns(p) && (UI._downOn || UI.topAt(p)) &&
            (UI._downOn || UI.topAt(p)).cursorType === "pointer");
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
        if (UI._releasedOn === this) UI._releasedOn = null;
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
     * Draws in screen space. The body (fill, outline, shape, rotation, rounded
     * corners, debug bounds) is drawn by gameObject's own render code; then
     * draw() puts the object's content (a button's label) on top.
     */
    render() {
        UI.renderLikeGameObject(this);
    }

    /**
     * Runs gameObject.prototype.render on a UI object, in screen space (the
     * camera transform is reset first, so UI ignores camera position / zoom).
     * That code reads the hitbox list, collision sides and grounded - the
     * stand-ins the constructor created (UIBounds etc.) - so it works as is.
     */
    static renderLikeGameObject(obj, drawContent = true) {
        if (obj.deleted || !obj.active || !obj.rendering.visible) return;
        push();
        resetMatrix();
        rectMode(CENTER);
        try {
            obj._syncRendering();
            gameObject.prototype.render.call(obj);
            if (drawContent) obj.draw();
        } finally { pop(); }
    }

    /** Subclasses set rendering.color / outline from their current state here. */
    _syncRendering() {}

    /** Content drawn on top of the body, in screen space. Subclasses override. */
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
        this._seenClicks = null;              // mouse.clickCount as of the last update
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
        if (e.clicked) this.emit("click");
        // A click counts only if the press began on THIS button. mouse.clickCount goes up
        // once per click, so clicks that come faster than mouse.clicked's 100ms flag lasts
        // are still counted (the flag can't show a second click inside that window).
        const m = UI.mouseSource();
        const mc = m ? (m.clickCount || 0) : 0;
        if (this._seenClicks === null || mc < this._seenClicks) this._seenClicks = mc;
        if (mc > this._seenClicks) {
            this._seenClicks = mc;
            if (e.hover && (UI._downOn === this || UI._releasedOn === this)) this.click("mouse");
        }

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