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
//   Text             - simple UI text helper
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
    position(...argss) {
        if (argss.length <= 0) return this.transform.position;
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
        return this.transform.position;
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

    getWorldPosition() {
        if (!this.parent) {
            return { x: this.offset.x || 0, y: this.offset.y || 0 };
        }
        if (!this.parent.transform || !this.parent.transform.position) {
            return { x: this.offset.x || 0, y: this.offset.y || 0 };
        }

        const parentX = this.parent.transform.position.x || 0;
        const parentY = this.parent.transform.position.y || 0;
        const offsetX = this.offset.x || 0;
        const offsetY = this.offset.y || 0;

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

        const parentRotation = this.parent ? this.parent.transform.rotation || 0 : 0;
        const cos = Math.cos(parentRotation);
        const sin = Math.sin(parentRotation);

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
        const rotation = this.transform.rotation || 0;
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
            const rotation = this.transform.rotation || 0;

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
                this.id, shape,
                params[0] || 0, params[1] || 0,
                params[2] || 20, params[3] || 20
            );
        }
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
        this.x = pos.x;
        this.y = pos.y;
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

        // Sub-step movement so fast objects don't tunnel.
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

        // Gravity.
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
            if (!other.collision || !other.collision.enabled) return;
            if (!this.collision.enabled) return;

            other.hitbox.forEach((hb) => hb.updatePosition());

            this.hitbox.forEach((thisHitbox, index) => {
                if (!thisHitbox.collision || !thisHitbox.collision.enabled) return;

                other.hitbox.forEach((otherHitbox) => {
                    if (!otherHitbox.collision || !otherHitbox.collision.enabled) return;

                    if (thisHitbox.collidesWith(otherHitbox, 1.0)) {
                        collisions.push({
                            thisHitbox, otherHitbox, other, index
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

                        if (index === lowestHitboxIndex && sides.includes("bottom")) {
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

                // Skip resolution if either object opts out.
                if (!this.collision.resolve || !coll.other.collision.resolve) continue;
                if (!coll.thisHitbox.collision.resolve || !coll.otherHitbox.collision.resolve) continue;

                if (coll.thisHitbox.collidesWith(coll.otherHitbox, 0)) {
                    if (this.collision.solid || coll.other.collision.solid) {
                        this.resolveCollision(coll.other, coll.thisHitbox, coll.otherHitbox);
                    }
                }
            }
        }
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

        if (resolveHorizontal) {
            const push = overlapX;
            if (thisShare > 0)  pos.x      += dirX * push * thisShare;
            if (otherShare > 0) otherPos.x -= dirX * push * otherShare;
            vel.x = 0;
            if (otherCanMove) otherVel.x = 0;
        } else {
            const push = overlapY;
            if (thisShare > 0)  pos.y      += dirY * push * thisShare;
            if (otherShare > 0) otherPos.y -= dirY * push * otherShare;
            vel.y = 0;
            if (otherCanMove) otherVel.y = 0;

            if (dirY < 0 && this.collision.solid) {
                this.grounded = true;
                this.groundedOn = other;
            } else if (dirY > 0) {
                if (vel.y < 0) vel.y = 0;
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

    setVelocity(speed, angle = this.transform.rotation) {
        let vel = this.transform.velocity;
        let angleRad = angle;
        if (this.transform.rotationMode === "degrees") angleRad = (angle * Math.PI) / 180;
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
                let pos = this.transform.position;
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
    constructor(x, y, w, h, id, ...scenes) {
        super(x, y, w, h, ...scenes);
        this.id = id;
        this.transform.velocity.max = { x: 50, y: 2000 };
        this.transform.velocity.decay = 0.89;
        this.physicsToggles.velocityDecay = true;
        this.pathing = [];
        this.tags.push('entity');
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

        this.x = pos.x;
        this.y = pos.y;
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
// UI: TEXT
// ============================================
class Text {
    static init() {}
    constructor(x, y, txt, c, sty, size, ha = 'left', va = 'bottom') {
        this.x = x;
        this.y = y;
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
        textStyle(this.style);
        coloredText(this.text, 0, 0);
        pop();
    }
}



class UI extends shell{
    static elements = [];
    constructor(){
        super();
        this.events = Object.freeze({
            hover:(self,pos = {x:world.mouse.x,y:world.mouse.y})=>{
                let bounds;
                if(self.transform instanceof Transform){
                    let p = self.transform.position;
                    let scale = self.transform.scale;
                    bounds = [
                        p.x-scale.x/2,
                        p.x+scale.x/2,
                        p.y-scale.y/2,
                        p.y+scale.y/2
                    ];
                }else{
                    bounds = [
                        self.x-self.width/2,
                        self.x+self.width/2,
                        self.y-self.height/2,
                        self.y+self.height/2
                    ];
                }
                return  bounds[0] < pos.x &&
                        bounds[1] > pos.x &&
                        bounds[2] < pos.y &&
                        bounds[3] > pos.y
            },
            clicked:(self,pos = {x:world.mouse.x,y:world.mouse.y})=>{
                let bounds;
                if(self.transform instanceof Transform){
                    let p = self.transform.position;
                    let scale = self.transform.scale;
                    bounds = [
                        p.x-scale.x/2,
                        p.x+scale.x/2,
                        p.y-scale.y/2,
                        p.y+scale.y/2
                    ];
                }else{
                    bounds = [
                        self.x-self.width/2,
                        self.x+self.width/2,
                        self.y-self.height/2,
                        self.y+self.height/2
                    ];
                }
                return  bounds[0] < pos.x &&
                        bounds[1] > pos.x &&
                        bounds[2] < pos.y &&
                        bounds[3] > pos.y &&
                        world.mouse.clicked
            }
        });
        this.elementID = UI.elements.length;
        UI.elements.push(this);
    }
}

class Button extends UI {
    constructor(x,y,w,h,txt,...scenes){
        super();
        this.transform = new Transform(x,y,w,h);
        this.format = {
            colors:{
                default:'#ffffff',
                hover:'#cccccc',
                pressed:'#aaaaaa'
            },
            draw:{
                shape:'rect',
                texture:null,
                presets:[]
            },
            visible: true,
            outline: [0.1, 0 || '#000000'],
            debug: {
                color: "#37ff29",
                center: true,
            },
        };
        this.cameraLocked = false;
        
        //--\\
    }
}


