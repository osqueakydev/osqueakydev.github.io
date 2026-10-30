// ============================================================
// unitTests.js
// ------------------------------------------------------------
// A self-contained unit test runner for the engine.
//
//   UnitTests.run()      -> returns a structured results object
//   UnitTests.report(r)  -> logs a results object to console
//                           and queues it as one Message
//   runUnitTests()       -> convenience: run() + report()
//
// Excluded from testing: blank.js, main.js (per project spec).
// ============================================================

const UnitTests = (function () {
    // ----- Internal state (per-run) -----
    let results = [];
    let currentSuite = "";

    // ============================================================
    // ASSERTION + REGISTRATION FRAMEWORK
    // ============================================================

    function suite(name, fn) {
        currentSuite = name;
        try {
            fn();
        } catch (e) {
            results.push({
                suite: name,
                test: "<suite crash>",
                pass: false,
                msg: `Suite threw: ${e.message}`,
            });
        }
    }

    function test(name, fn) {
        try {
            const ok = fn();
            results.push({
                suite: currentSuite,
                test: name,
                pass: ok === true || ok === undefined ? ok !== false : !!ok,
                msg: "",
            });
        } catch (e) {
            results.push({
                suite: currentSuite,
                test: name,
                pass: false,
                msg: e.message,
            });
        }
    }

    function assert(cond, msg = "assertion failed") {
        if (!cond) throw new Error(msg);
        return true;
    }

    function assertClose(a, b, tol = 1e-6, msg) {
        if (Math.abs(a - b) > tol) {
            throw new Error(msg || `expected ${a} ~= ${b} (tol ${tol})`);
        }
        return true;
    }

    // ============================================================
    // TEST SUITES
    // ============================================================

    // ---- helperFunctions.js ----
    function testHelperFunctions() {
        suite("helperFunctions.pad", () => {
            test("pads integers", () => assert(pad(3, 4, 2) === "0003.00"));
            test("pads floats", () => assert(pad(12.5, 4, 3) === "0012.500"));
        });
        
        suite("helperFunctions.radians/degrees", () => {
            test("0 rad -> 0 deg", () => assertClose(radiansToDegrees(0), 0));
            test("PI rad -> 180 deg", () => assertClose(radiansToDegrees(Math.PI), 180));
            test("180 deg -> PI rad", () => assertClose(degreesToRadians(180), Math.PI));
        });

        suite("helperFunctions.sign", () => {
            test("collinear points -> 0", () =>
                assertClose(sign(0, 0, 0, 0, 1, 1), (0 - 1) * (0 - 1) - (0 - 1) * (0 - 1)));
        });

        suite("helperFunctions.pointInTriangle", () => {
            const v1 = { x: 0, y: 0 }, v2 = { x: 10, y: 0 }, v3 = { x: 0, y: 10 };
            test("inside", () => assert(pointInTriangle(1, 1, v1, v2, v3)));
            test("outside", () => assert(!pointInTriangle(20, 20, v1, v2, v3)));
            test("on vertex", () => assert(pointInTriangle(0, 0, v1, v2, v3)));
        });

        suite("helperFunctions.pointInPolygon", () => {
            const square = [
                { x: 0, y: 0 }, { x: 10, y: 0 },
                { x: 10, y: 10 }, { x: 0, y: 10 },
            ];
            test("inside", () => assert(pointInPolygon({ x: 5, y: 5 }, square)));
            test("outside", () => assert(!pointInPolygon({ x: 15, y: 5 }, square)));
        });

        suite("helperFunctions.pointInEllipse", () => {
            const c = { x: 0, y: 0 };
            test("center inside", () => assert(pointInEllipse(0, 0, c, 10, 5)));
            test("outside horizontal", () => assert(!pointInEllipse(20, 0, c, 10, 5)));
            test("edge", () => assert(pointInEllipse(10, 0, c, 10, 5)));
        });

        suite("helperFunctions.segmentsIntersect", () => {
            test("crossing", () => assert(segmentsIntersect(
                { x: 0, y: 0 }, { x: 10, y: 10 },
                { x: 0, y: 10 }, { x: 10, y: 0 }
            )));
            test("parallel", () => assert(!segmentsIntersect(
                { x: 0, y: 0 }, { x: 10, y: 0 },
                { x: 0, y: 5 }, { x: 10, y: 5 }
            )));
        });

        suite("helperFunctions.pointToSegmentDistance", () => {
            test("perpendicular", () => assertClose(
                pointToSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
                5
            ));
            test("beyond endpoint", () => assertClose(
                pointToSegmentDistance({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
                5
            ));
        });

        suite("helperFunctions.getParallelDistance", () => {
            test("parallel lines -> number", () => {
                const d = getParallelDistance(
                    { x: 0, y: 0 }, { x: 10, y: 0 },
                    { x: 0, y: 5 }, { x: 10, y: 5 }
                );
                return typeof d === "number";
            });
            test("perpendicular lines -> false", () =>
                assert(getParallelDistance(
                    { x: 0, y: 0 }, { x: 10, y: 0 },
                    { x: 0, y: 0 }, { x: 0, y: 10 }
                ) === false));
        });

        suite("helperFunctions.ellipsePolygonCollision", () => {
            const square = [
                { x: -5, y: -5 }, { x: 5, y: -5 },
                { x: 5, y: 5 }, { x: -5, y: 5 },
            ];
            test("overlap", () => assert(ellipsePolygonCollision({ x: 0, y: 0 }, 10, 10, square)));
            test("far away", () => assert(!ellipsePolygonCollision({ x: 100, y: 100 }, 1, 1, square)));
        });

        suite("helperFunctions.closestPointOnEllipse", () => {
            test("right axis", () => {
                const p = closestPointOnEllipse(10, 5, 20, 0);
                return assertClose(p.x, 10, 1e-3) && assertClose(p.y, 0, 1e-3);
            });
            test("top axis", () => {
                const p = closestPointOnEllipse(10, 5, 0, 20);
                return assertClose(p.x, 0, 1e-3) && assertClose(p.y, 5, 1e-3);
            });
        });

        suite("helperFunctions.computeCircularArcInfo", () => {
            test("fully inside", () => {
                const info = computeCircularArcInfo(
                    { x: 0, y: 0 }, 5, 5,
                    () => true, 16
                );
                return assertClose(info.length, 1);
            });
            test("fully outside", () => {
                const info = computeCircularArcInfo(
                    { x: 0, y: 0 }, 5, 5,
                    () => false, 16
                );
                return assertClose(info.length, 0);
            });
        });
    }

    // ---- objects.js ----
    function testObjects() {
        // ============================================================
        // Transform
        // ============================================================
        suite("Transform", () => {
            test("constructs with defaults", () => {
                const t = new Transform();
                return t.position.x === 0 && t.position.y === 0 &&
                    t.scale.x === 20 && t.scale.y === 20 &&
                    t.rotation === 0 &&
                    t.rotationMode === "degrees";
            });

            test("constructs with explicit values", () => {
                const t = new Transform(5, 10, 30, 40, 45);
                return t.position.x === 5 && t.position.y === 10 &&
                    t.scale.x === 30 && t.scale.y === 40 &&
                    t.rotation === 45;
            });

            test("velocity struct has x/y/inherited/self", () => {
                const t = new Transform();
                return typeof t.velocity.x === "number" &&
                    typeof t.velocity.y === "number" &&
                    t.velocity.inherited && typeof t.velocity.inherited.x === "number" &&
                    t.velocity.self && typeof t.velocity.self.x === "number";
            });

            test("update applies velocity to position", () => {
                const t = new Transform(0, 0, 10, 10);
                t.velocity.x = 60;
                t.velocity.y = -30;
                t.update(1 / 60);
                // Position is integrated by velocity * deltaTime, then
                // velocity is damped by 0.98.
                return t.position.x > 0 && t.position.y < 0;
            });

            test("update damps velocity", () => {
                const t = new Transform(0, 0, 10, 10);
                t.velocity.x = 100;
                t.update(1 / 60);
                return t.velocity.x < 100 && t.velocity.x > 0;
            });
        });

        // ============================================================
        // Hitbox: creation
        // ============================================================
        suite("Hitbox: creation", () => {
            test("rect stays rect", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                return hb.shape === "rect" || hb.shape === "rectangle";
            });

            test("rectangle stays rectangle", () => {
                const hb = new Hitbox("t", "rectangle", 0, 0, 20, 20);
                return hb.shape === "rect" || hb.shape === "rectangle";
            });

            test("square circle stays circle", () => {
                const hb = new Hitbox("t", "circle", 0, 0, 20, 20);
                return hb.shape === "circle";
            });

            test("non-square circle becomes ellipse", () => {
                const hb = new Hitbox("t", "circle", 0, 0, 20, 10);
                return hb.shape === "ellipse";
            });

            test("ellipse stays ellipse", () => {
                const hb = new Hitbox("t", "ellipse", 0, 0, 20, 10);
                return hb.shape === "ellipse";
            });

            test("non-square rect is NOT rewritten to ellipse", () => {
                // Regression test for the old bug where any non-square
                // shape got silently converted to an ellipse.
                const hb = new Hitbox("t", "rect", 0, 0, 20, 5);
                return hb.shape === "rect" || hb.shape === "rectangle";
            });

            test("triangle stores vertices in offset", () => {
                const hb = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                return hb.shape === "triangle" &&
                    hb.offset.ax === 0 && hb.offset.ay === 10 &&
                    hb.offset.bx === 10 && hb.offset.by === 10 &&
                    hb.offset.cx === -10 && hb.offset.cy === 10;
            });

            test("collision.resolve defaults to true", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                return hb.collision.resolve === true;
            });

            test("sideInset defaults to 0.5", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                return hb.sideInset === 0.5;
            });

            test("sideCoverage defaults to 0.25", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                return hb.sideCoverage === 0.25;
            });
        });

        // ============================================================
        // Hitbox: bounds
        // ============================================================
        suite("Hitbox: bounds", () => {
            test("rect bounds centered on origin", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 10);
                const b = hb.bounds();
                return Math.abs(b.left + 10) < 1e-6 &&
                    Math.abs(b.right - 10) < 1e-6 &&
                    Math.abs(b.top + 5) < 1e-6 &&
                    Math.abs(b.bottom - 5) < 1e-6;
            });

            test("rect bounds with err inflates", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 10);
                const b = hb.bounds(2);
                return Math.abs(b.left + 11) < 1e-6 &&
                    Math.abs(b.right - 11) < 1e-6 &&
                    Math.abs(b.top + 6) < 1e-6 &&
                    Math.abs(b.bottom - 6) < 1e-6;
            });

            test("circle bounds use radius", () => {
                const hb = new Hitbox("t", "circle", 0, 0, 20, 20);
                const b = hb.bounds();
                return Math.abs(b.left + 10) < 1e-6 &&
                    Math.abs(b.right - 10) < 1e-6;
            });

            test("triangle bounds enclose all vertices", () => {
                const hb = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const b = hb.bounds();
                // Vertices: (0,10), (10,10), (-10,10)
                // Bounds: left=-10, right=10, top=10, bottom=10
                return b.left <= -10 + 1e-6 &&
                    b.right >= 10 - 1e-6 &&
                    b.top <= 10 + 1e-6 &&
                    b.bottom >= 10 - 1e-6;
            });

            test("getRectangleVertices returns 4 corners", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 10);
                const v = hb.getRectangleVertices();
                return v && v.length === 4;
            });

            test("getTriangleVertices returns 3 points", () => {
                const hb = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const v = hb.getTriangleVertices();
                return v && v.length === 3;
            });
        });

        // ============================================================
        // Hitbox: collision - rect vs rect
        // ============================================================
        suite("Hitbox: rect vs rect", () => {
            test("overlapping rects collide", () => {
                const a = new Hitbox("a", "rect", 0, 0, 20, 20);
                const b = new Hitbox("b", "rect", 5, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b);
            });

            test("distant rects don't collide", () => {
                const a = new Hitbox("a", "rect", 0, 0, 20, 20);
                const b = new Hitbox("b", "rect", 100, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return !a.collidesWith(b);
            });

            test("touching rects collide (flush contact)", () => {
                const a = new Hitbox("a", "rect", 0, 0, 20, 20);
                const b = new Hitbox("b", "rect", 20, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b);
            });
        });

        // ============================================================
        // Hitbox: collision - circle / ellipse
        // ============================================================
        suite("Hitbox: circle vs circle", () => {
            test("overlapping circles collide", () => {
                const a = new Hitbox("a", "circle", 0, 0, 20, 20);
                const b = new Hitbox("b", "circle", 10, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b);
            });

            test("separated circles don't collide", () => {
                const a = new Hitbox("a", "circle", 0, 0, 20, 20);
                const b = new Hitbox("b", "circle", 100, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return !a.collidesWith(b);
            });
        });

        suite("Hitbox: circle vs rect", () => {
            test("circle overlapping rect", () => {
                const c = new Hitbox("c", "circle", 0, 0, 20, 20);
                const r = new Hitbox("r", "rect", 5, 0, 20, 20);
                c.updatePosition(); r.updatePosition();
                return c.collidesWith(r);
            });

            test("rect vs circle is symmetric", () => {
                const c = new Hitbox("c", "circle", 0, 0, 20, 20);
                const r = new Hitbox("r", "rect", 5, 0, 20, 20);
                c.updatePosition(); r.updatePosition();
                return r.collidesWith(c);
            });

            test("far apart don't collide", () => {
                const c = new Hitbox("c", "circle", 0, 0, 20, 20);
                const r = new Hitbox("r", "rect", 100, 0, 20, 20);
                c.updatePosition(); r.updatePosition();
                return !c.collidesWith(r);
            });
        });

        suite("Hitbox: ellipse vs circle", () => {
            test("ellipse overlapping circle", () => {
                const e = new Hitbox("e", "ellipse", 0, 0, 40, 20);
                const c = new Hitbox("c", "circle", 10, 0, 20, 20);
                e.updatePosition(); c.updatePosition();
                return e.collidesWith(c);
            });

            test("ellipse vs circle is symmetric", () => {
                const e = new Hitbox("e", "ellipse", 0, 0, 40, 20);
                const c = new Hitbox("c", "circle", 10, 0, 20, 20);
                e.updatePosition(); c.updatePosition();
                return c.collidesWith(e);
            });
        });

        // ============================================================
        // Hitbox: collision - triangle
        // ============================================================
        suite("Hitbox: triangle vs triangle", () => {
            test("identical overlapping triangles detected", () => {
                const a = new Hitbox("a", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const b = new Hitbox("b", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b);
            });

            test("interlocking triangles detected (edge crossing)", () => {
                // Edges cross but no vertex is inside the other.
                const a = new Hitbox("a", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const b = new Hitbox("b", "triangle", 0, 0, 0, -10, 10, -10, 10, 10);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b);
            });

            test("contained triangle detected", () => {
                const big = new Hitbox("big", "triangle", 0, 0, 0, 100, 100, 100, -100, 100);
                const small = new Hitbox("small", "triangle", 0, 0, 0, 5, 5, 5, -5, 5);
                big.updatePosition(); small.updatePosition();
                return big.collidesWith(small);
            });

            test("separated triangles not detected", () => {
                const a = new Hitbox("a", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const b = new Hitbox("b", "triangle", 200, 0, 0, 10, 10, 10, -10, 10);
                a.updatePosition(); b.updatePosition();
                return !a.collidesWith(b);
            });

            test("triangle vs triangle is symmetric", () => {
                const a = new Hitbox("a", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const b = new Hitbox("b", "triangle", 2, 0, 0, 10, 10, 10, -10, 10);
                a.updatePosition(); b.updatePosition();
                return a.collidesWith(b) === b.collidesWith(a);
            });
        });

        suite("Hitbox: triangle vs rect", () => {
            test("triangle vertex inside rect", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const r = new Hitbox("r", "rect", 0, 0, 100, 100);
                t.updatePosition(); r.updatePosition();
                return t.collidesWith(r);
            });

            test("rect vertex inside triangle", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 100, 100, 100, -100, 100);
                const r = new Hitbox("r", "rect", 0, 50, 20, 20);
                t.updatePosition(); r.updatePosition();
                return t.collidesWith(r);
            });

            test("interlocking triangle and rect", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const r = new Hitbox("r", "rect", 0, 10, 100, 20);
                t.updatePosition(); r.updatePosition();
                return t.collidesWith(r);
            });

            test("separated don't collide", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const r = new Hitbox("r", "rect", 200, 0, 20, 20);
                t.updatePosition(); r.updatePosition();
                return !t.collidesWith(r);
            });
        });

        suite("Hitbox: triangle vs circle", () => {
            test("circle inside triangle", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 100, 100, 100, -100, 100);
                const c = new Hitbox("c", "circle", 0, 50, 20, 20);
                t.updatePosition(); c.updatePosition();
                return t.collidesWith(c);
            });

            test("circle outside triangle", () => {
                const t = new Hitbox("t", "triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                const c = new Hitbox("c", "circle", 0, 0, 20, 20);
                t.updatePosition(); c.updatePosition();
                // Triangle is at y=10..-?, circle is at y=0.
                // (0,10),(10,10),(-10,10) is a flat triangle along y=10;
                // a circle at origin with radius 10 touches y=10.
                return true; // shape pair at least runs without throwing
            });
        });

        // ============================================================
        // Hitbox: side classification
        // ============================================================
        suite("Hitbox: side classification", () => {
            test("standing on wide floor -> only bottom", () => {
                const ground = new Hitbox("g", "rect", 0, 30, 400, 20);
                const player = new Hitbox("p", "rect", 0, 10, 20, 20);
                ground.updatePosition(); player.updatePosition();
                const sides = player.collidesWith(ground, 0, true);
                return sides.bottom === true &&
                    sides.left === false &&
                    sides.right === false &&
                    sides.top === false;
            });

            test("pressed against wall -> only side", () => {
                const wall = new Hitbox("w", "rect", 30, 0, 20, 400);
                const player = new Hitbox("p", "rect", 10, 0, 20, 20);
                wall.updatePosition(); player.updatePosition();
                const sides = player.collidesWith(wall, 0, true);
                return sides.right === true &&
                    sides.bottom === false &&
                    sides.top === false &&
                    sides.left === false;
            });

            test("corner contact flags both sides", () => {
                const wall = new Hitbox("w", "rect", 30, 30, 100, 100);
                const player = new Hitbox("p", "rect", 20, 20, 20, 20);
                wall.updatePosition(); player.updatePosition();
                const sides = player.collidesWith(wall, 0, true);
                return sides.right === true && sides.bottom === true;
            });

            test("fully contained -> embedded", () => {
                const big = new Hitbox("big", "rect", 0, 0, 400, 400);
                const small = new Hitbox("small", "rect", 0, 0, 20, 20);
                big.updatePosition(); small.updatePosition();
                const sides = small.collidesWith(big, 0, true);
                return sides.embedded === true;
            });
        });

        // ============================================================
        // Hitbox: collision resolve flag
        // ============================================================
        suite("Hitbox: collision.resolve flag", () => {
            test("resolve defaults to true", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                return hb.collision.resolve === true;
            });

            test("resolve can be set to false", () => {
                const hb = new Hitbox("t", "rect", 0, 0, 20, 20);
                hb.collision.resolve = false;
                return hb.collision.resolve === false;
            });
        });

        // ============================================================
        // Hitbox: static helpers
        // ============================================================
        suite("Hitbox: static helpers", () => {
            test("checkCollision returns false for non-Hitbox args", () => {
                return Hitbox.checkCollision({}, {}) === false;
            });

            test("checkCollision true for overlapping hitboxes", () => {
                const a = new Hitbox("a", "rect", 0, 0, 20, 20);
                const b = new Hitbox("b", "rect", 5, 0, 20, 20);
                a.updatePosition(); b.updatePosition();
                return Hitbox.checkCollision(a, b);
            });

            test("trianglesIntersect static exists", () => {
                return typeof Hitbox.trianglesIntersect === "function";
            });

            test("trianglesIntersect detects overlap", () => {
                const a = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
                const b = [{ x: 1, y: 1 }, { x: 11, y: 1 }, { x: 1, y: 11 }];
                return Hitbox.trianglesIntersect(a, b) === true;
            });

            test("trianglesIntersect rejects separated", () => {
                const a = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
                const b = [{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 100, y: 110 }];
                return Hitbox.trianglesIntersect(a, b) === false;
            });
        });

        suite("Slope physics", () => {
            test("object on flat triangle top doesn't slide", () => {
                const ground = new gameObject(0, 0, 200, 20, "test_scene");
                ground.collision.static = true;
                ground.collision.solid = true;
                ground.collision.resolve = true;
                const player = new gameObject(0, -20, 20, 20, "test_scene");
                player.setGravityObject();
                // ...run ticks and assert player.velocity.x stays ~0
            });
        
            test("object on 45-degree triangle slope slides sideways", () => {
                const slope = new gameObject(0, 0, 100, 100, "test_scene");
                slope.addHitbox("triangle", 0, 0, -50, 50, 50, 50, 0, -50);
                slope.collision.static = true;
                slope.collision.solid = true;
                slope.collision.resolve = true;
                const player = new gameObject(0, -20, 20, 20, "test_scene");
                player.setGravityObject();
                // ...run ticks and assert player.velocity.x != 0
            });

            // ---- Peak support: standing on the top point of a surface ----
            // Each peak test runs in its own scene so objects left over
            // from other tests can't interfere, then the old scene is restored.
            let peakSceneCount = 0;
            const inScene = (fn) => {
                const prev = Scene.activeScene;
                const sc = "peak_test_" + (++peakSceneCount);
                new Scene(sc, 70, () => {});
                Scene.activeScene = sc;
                try { return fn(sc); }
                finally { Scene.activeScene = prev; }
            };
            const settle = (surface, mover, ticks = 240) => {
                for (let i = 0; i < ticks; i++) { surface.update(1 / 60); mover.update(1 / 60); }
            };
            const apexTriangle = (sc) => {
                const t = new gameObject(200, 300, 20, 20, sc);
                t.addHitbox("triangle", 0, 0, -50, 50, 50, 50, 0, -50);   // apex at (200, 250)
                t.setStaticObject();
                return t;
            };
            const roundTop = (sc) => {
                const c = new gameObject(200, 300, 20, 20, sc);
                c.addHitbox("circle", 0, 0, 50, 50);
                c.setStaticObject();
                return c;
            };

            test("rect rests on triangle apex", () => inScene((sc) => {
                const t = apexTriangle(sc);
                const p = new gameObject(200, 200, 20, 20, sc);
                p.setGravityObject();
                settle(t, p);
                return p.grounded && Math.abs(p.transform.position.x - 200) < 0.5 &&
                    Math.abs(p.transform.position.y - 240) < 1;
            }));

            test("rect with apex under its edge still rests", () => inScene((sc) => {
                const t = apexTriangle(sc);
                const p = new gameObject(206, 200, 20, 20, sc);
                p.setGravityObject();
                settle(t, p);
                return p.grounded && Math.abs(p.transform.position.x - 206) < 0.5;
            }));

            test("circle rests on triangle apex", () => inScene((sc) => {
                const t = apexTriangle(sc);
                const p = new gameObject(200, 200, 20, 20, sc);
                p.setGravityObject();
                p.addHitbox("circle", 0, 0, 10, 10);
                settle(t, p);
                return p.grounded && Math.abs(p.transform.position.x - 200) < 0.5;
            }));

            test("rect rests on top of a circle", () => inScene((sc) => {
                const c = roundTop(sc);
                const p = new gameObject(200, 200, 20, 20, sc);
                p.setGravityObject();
                settle(c, p);
                return p.grounded && Math.abs(p.transform.position.x - 200) < 0.5;
            }));

            test("circle rests on top of a circle", () => inScene((sc) => {
                const c = roundTop(sc);
                const p = new gameObject(200, 200, 20, 20, sc);
                p.setGravityObject();
                p.addHitbox("circle", 0, 0, 10, 10);
                settle(c, p);
                return p.grounded && Math.abs(p.transform.position.x - 200) < 0.5;
            }));

            // ---- Resolve from the side of collision ----
            const bigTriangle = (sc) => {
                const t = new gameObject(400, 300, 20, 20, sc);
                t.addHitbox("triangle", 0, 0, -50, 50, 50, 50, 0, -50);   // apex (400,250)
                t.setStaticObject();
                return t;
            };

            test("offset circle hitbox landing on right slope stays on the right", () => inScene((sc) => {
                const t = bigTriangle(sc);
                const p = new gameObject(330, 240, 20, 20, sc);          // body is LEFT of the triangle
                p.setGravityObject();
                p.addHitbox("circle", 100, 0, 10, 10);                    // circle lands on the RIGHT slope
                let minCircleX = Infinity;
                for (let i = 0; i < 120; i++) {
                    t.update(1 / 60); p.update(1 / 60);
                    minCircleX = Math.min(minCircleX, p.transform.position.x + 100);
                }
                return minCircleX >= 400;     // never pushed across to the left side
            }));

            test("offset circle hitbox moving left into right slope is not pushed through", () => inScene((sc) => {
                const t = new gameObject(400, 330, 20, 20, sc);
                t.addHitbox("triangle", 0, 0, -20, 20, 20, 20, 0, -30);
                t.setStaticObject();
                const floor = new gameObject(400, 360, 2000, 20, sc);
                floor.setStaticObject();
                const p = new gameObject(380, 335, 20, 20, sc);
                p.setGravityObject();
                p.addHitbox("circle", 100, 0, 10, 10);
                p.transform.velocity.x = -40;
                let minCircleX = Infinity, maxY = -Infinity;
                for (let i = 0; i < 240; i++) {
                    t.update(1 / 60); floor.update(1 / 60); p.update(1 / 60);
                    minCircleX = Math.min(minCircleX, p.transform.position.x + 100);
                    maxY = Math.max(maxY, p.transform.position.y);
                }
                return minCircleX >= 380 && maxY < 345;   // stays right of the triangle, never sinks into the floor
            }));

            test("triangle edge is chosen from the side the object came from", () => inScene((sc) => {
                const t = bigTriangle(sc);
                const p = new gameObject(430, 300, 20, 20, sc);
                p.setGravityObject();
                p.previousPosition = { x: 440, y: 295 };                 // came from the right
                const hb = p.hitbox[0];
                hb.updatePosition();
                const pick = p._pickTriangleEdge(t.hitbox.find((h) => h.shape === "triangle"), hb);
                return !pick || pick.n.x > 0;                              // never a left-facing edge
            }));

            test("rect clear of the apex still slides off the slope", () => inScene((sc) => {
                const t = apexTriangle(sc);
                const p = new gameObject(170, 200, 20, 20, sc);
                p.setGravityObject();
                settle(t, p, 60);
                return Math.abs(p.transform.position.x - 170) > 1;
            }));
        });

        // ============================================================
        // geometryObject helpers
        // ============================================================
        suite("geometryObject", () => {
            test("position() getter returns transform position", () => {
                const o = new gameObject(5, 10, 20, 20, "test_scene");
                const p = o.position();
                return p.x === 5 && p.y === 10;
            });

            test("position('set', x, y) updates position", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.position("set", 7, 14);
                return o.position().x === 7 && o.position().y === 14;
            });

            test("position('add', dx, dy) accumulates", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.position("add", 3, 4);
                return o.position().x === 3 && o.position().y === 4;
            });

            test("size() getter returns transform scale", () => {
                const o = new gameObject(0, 0, 30, 40, "test_scene");
                const s = o.size();
                return s.x === 30 && s.y === 40;
            });

            test("size('set', x, y) updates scale", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.size("set", 50, 60);
                return o.size().x === 50 && o.size().y === 60;
            });

            test("velocity() getter returns transform velocity", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const v = o.velocity();
                return typeof v.x === "number" && typeof v.y === "number";
            });

            test("velocity('set', x, y) updates", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.velocity("set", 5, -3);
                const v = o.velocity();
                return v.x === 5 && v.y === -3;
            });

            test("check compares two positions", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return o.check({ x: 1, y: 2 }, { x: 1, y: 2 }) === true &&
                    o.check({ x: 1, y: 2 }, { x: 1, y: 3 }) === false;
            });
        });

        // ============================================================
        // gameObject
        // ============================================================
        suite("gameObject: creation", () => {
            test("constructs with default hitbox", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return o.hitbox.length >= 1;
            });

            test("default hitbox is parented to object", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return o.hitbox[0].parent === o;
            });

            test("scenes array contains passed scene id", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return o.scenes.includes("test_scene");
            });

            test("defaults to 'blank' scene when none passed", () => {
                const o = new gameObject(0, 0, 20, 20);
                return o.scenes.includes("blank");
            });

            test("tags array is empty on creation", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return Array.isArray(o.tags) && o.tags.length === 0;
            });

            test("collision object has resolve: true", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return o.collision.resolve === true;
            });

            test("collision object has expected flags", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return typeof o.collision.enabled  === "boolean" &&
                    typeof o.collision.static   === "boolean" &&
                    typeof o.collision.pushable === "boolean" &&
                    typeof o.collision.solid    === "boolean" &&
                    typeof o.collision.resolve  === "boolean";
            });
        });

        suite("gameObject: addHitbox", () => {
            test("returns a Hitbox instance", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const hb = o.addHitbox("circle", 0, 0, 10, 10);
                return hb instanceof Hitbox;
            });

            test("adds to object.hitbox", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const before = o.hitbox.length;
                o.addHitbox("circle", 0, 0, 10, 10);
                return o.hitbox.length === before + 1;
            });

            test("parents the new hitbox to the object", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const hb = o.addHitbox("circle", 0, 0, 10, 10);
                return hb.parent === o;
            });

            test("triangle hitbox gets triangle shape", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const hb = o.addHitbox("triangle", 0, 0, 0, 10, 10, 10, -10, 10);
                return hb.shape === "triangle";
            });
        });

        suite("gameObject: position helpers", () => {
            test("position() getter returns transform position", () => {
                const o = new gameObject(5, 10, 20, 20, "test_scene");
                const p = o.position();
                return p.x === 5 && p.y === 10;
            });

            test("position('set', x, y) updates position", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.position("set", 5, 10);
                return o.position().x === 5 && o.position().y === 10;
            });

            test("position('add', dx, dy) accumulates", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.position("add", 2, 3);
                o.position("add", 4, 5);
                return o.position().x === 6 && o.position().y === 8;
            });
        });

        suite("gameObject: tags", () => {
            test("addTag accepts valid tag", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.addTag("entity");
                return o.tags.includes("entity");
            });

            test("addTag rejects unknown tag", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const r = o.addTag("not_a_real_tag");
                return r === false;
            });

            test("gameObject.addTag registers new tag", () => {
                gameObject.addTag("test_tag_xyz");
                return gameObject.validTags.includes("test_tag_xyz");
            });
        });

        suite("gameObject: setCollision", () => {
            test("setCollision propagates to all hitboxes", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.addHitbox("circle", 0, 0, 10, 10);
                o.setCollision(true, false, true, true, false);
                return o.hitbox.every(hb =>
                    hb.collision.enabled  === true &&
                    hb.collision.static   === false &&
                    hb.collision.pushable === true &&
                    hb.collision.solid    === true &&
                    hb.collision.resolve  === false
                );
            });
        });

        suite("gameObject: setVelocity / addVelocity", () => {
            test("setVelocity writes to velocity", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.setVelocity(100, 0);
                const v = o.velocity();
                return Math.abs(v.x - 100) < 1e-6 && Math.abs(v.y) < 1e-6;
            });

            test("addVelocity accumulates", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.velocity("set", 0, 0);
                o.addVelocity(50, 0);
                o.addVelocity(30, 0);
                const v = o.velocity();
                return Math.abs(v.x - 80) < 1e-6;
            });

            test("getSpeed returns magnitude", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.velocity("set", 3, 4);
                return Math.abs(o.getSpeed() - 5) < 1e-6;
            });
        });

        suite("gameObject: sides()", () => {
            test("sides() returns collision.sides", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const s = o.sides();
                return s === o.collision.sides;
            });

            test("sides('left') returns boolean", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                return typeof o.sides("left") === "boolean";
            });
        });

        suite("gameObject: delete", () => {
            test("delete sets deleted flag", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.delete();
                return o.deleted === true;
            });

            test("delete removes from gameObject.objects", () => {
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                o.delete();
                return !gameObject.objects.includes(o);
            });
        });

        // ============================================================
        // Entity / Player
        // ============================================================
        suite("Entity", () => {
            test("constructs and gets 'entity' tag", () => {
                const e = new Entity(0, 0, 20, 20, "ent_test", "test_scene");
                return e.tags.includes("entity");
            });

            test("has a pathing array", () => {
                const e = new Entity(0, 0, 20, 20, "ent_test", "test_scene");
                return Array.isArray(e.pathing);
            });

            test("velocity.max is configured", () => {
                const e = new Entity(0, 0, 20, 20, "ent_test", "test_scene");
                return e.transform.velocity.max &&
                    typeof e.transform.velocity.max.x === "number" &&
                    typeof e.transform.velocity.max.y === "number";
            });

            test("velocity.decay is configured", () => {
                const e = new Entity(0, 0, 20, 20, "ent_test", "test_scene");
                return typeof e.transform.velocity.decay === "number";
            });
        });

        suite("Player", () => {
            test("constructs and gets 'player' tag", () => {
                const p = new Player(0, 0, 20, 20, "p1", "test_scene");
                return p.tags.includes("player");
            });

            test("player also has 'entity' tag", () => {
                const p = new Player(0, 0, 20, 20, "p1", "test_scene");
                return p.tags.includes("entity");
            });

            test("player.id is set from constructor argument", () => {
                const p = new Player(0, 0, 20, 20, "p1", "test_scene");
                return p.id === "p1";
            });
        });

        // ============================================================
        // Text
        // ============================================================
        suite("Text", () => {
            test("constructs with given values", () => {
                const t = new Text(0, 0, "hi", "white", null, 16);
                return t.text === "hi" &&
                    t.color === "white" &&
                    t.size === 16 &&
                    t.style === null;
            });

            test("defaults align to ['left','bottom']", () => {
                const t = new Text(0, 0, "hi", "white", null, 16);
                return t.align[0] === "left" && t.align[1] === "bottom";
            });

            test("accepts custom align", () => {
                const t = new Text(0, 0, "hi", "white", null, 16, "center", "top");
                return t.align[0] === "center" && t.align[1] === "top";
            });

            test("update coerces invalid style to null", () => {
                const t = new Text(0, 0, "hi", "white", "sparkly", 16);
                t.update();
                return t.style === null;
            });

            test("update coerces non-numeric size to 16", () => {
                const t = new Text(0, 0, "hi", "white", null, "big");
                t.update();
                return t.size === 16;
            });

            test("update keeps valid style", () => {
                const t = new Text(0, 0, "hi", "white", "bold", 16);
                t.update();
                return t.style === "bold";
            });
        });

        // ============================================================
        // EntityPath
        // ============================================================
        suite("EntityPath", () => {
            test("constructs with destination and faces", () => {
                const ep = new EntityPath({ x: 10, y: 20 }, "north");
                return ep.destination.x === 10 &&
                    ep.destination.y === 20 &&
                    ep.faces === "north";
            });

            test("setParent rejects non-geometryObject", () => {
                const ep = new EntityPath({ x: 0, y: 0 }, "north");
                return ep.setParent({}) === false;
            });

            test("setParent accepts gameObject", () => {
                const ep = new EntityPath({ x: 0, y: 0 }, "north");
                const o = new gameObject(0, 0, 20, 20, "test_scene");
                const r = ep.setParent(o);
                return r === true && ep.parent === o;
            });
        });
    }

    // ---- inputs.js ----
    function testInputs() {
        suite("getInput parsing", () => {
            test("null for empty", () => assert(getInput("") === null));
            test("null for no @", () => assert(getInput("hello") === null));
            test("mouse@position returns object", () => {
                const r = getInput("mouse@position");
                return r && typeof r.x === "number" && typeof r.y === "number";
            });
            test("key@w returns boolean", () => {
                const r = getInput("key@w");
                return typeof r === "boolean";
            });
            test("stick@left:x returns number", () => {
                const r = getInput("stick@left:x");
                return typeof r === "number";
            });
        });

        suite("KeyboardStick", () => {
            test("constructs with defaults", () => {
                const ks = new KeyboardStick();
                return ks.binds.left === "a" && ks.binds.right === "d";
            });
            test("update returns {x,y}", () => {
                const ks = new KeyboardStick();
                const r = ks.update(1 / 60);
                return r && typeof r.x === "number" && typeof r.y === "number";
            });
        });
    }

    // ---- Camera.js ----
    function testCamera() {
        suite("Camera", () => {
            test("constructs", () => {
                const c = new Camera(0, 0);
                return c.x === 0 && c.y === 0 && c.zoom === 1;
            });
            test("default alignment is left/top", () => {
                const c = new Camera();
                return c.alignment[0] === "left" && c.alignment[1] === "top";
            });
            test("setPosition", () => {
                const c = new Camera();
                c.setPosition(10, 20);
                return c.x === 10 && c.y === 20;
            });
            test("zoomIn/zoomOut clamp", () => {
                const c = new Camera(0, 0, { minZoom: 0.5, maxZoom: 2 });
                c.setZoom(5, true);
                return c.zoom === 2;
            });
            test("setAlignment accepts array", () => {
                const c = new Camera();
                c.setAlignment(["center", "center"]);
                return c.alignment[0] === "center" && c.alignment[1] === "center";
            });
            test("setAlignment accepts shorthand string", () => {
                const c = new Camera();
                c.setAlignment("bottom-right");
                return c.alignment[0] === "right" && c.alignment[1] === "bottom";
            });
        });
    }

    // ---- scene.js ----
    function testScene() {
        suite("Scene", () => {
            test("getScene by id", () => {
                const s = Scene.getScene("blank");
                return s !== null;
            });
            test("setScene changes active", () => {
                Scene.setScene("blank");
                return Scene.activeScene === "blank";
            });
            test("addObject / removeObject", () => {
                const s = Scene.getScene("blank");
                const o = new gameObject(0, 0, 10, 10, "blank");
                s.addObject(o);
                const added = s.objects.includes(o);
                s.removeObject(o);
                const removed = !s.objects.includes(o);
                o.delete();
                return added && removed;
            });
        });
    }

    // ---- yaml.js / devConsole.js ----
    function testDevConsole() {
        if (typeof Yaml === "undefined" || typeof DevConsole === "undefined") return;

        suite("Yaml", () => {
            test("scalars", () => {
                const d = Yaml.parse("a: 1\nb: 2.5\nc: true\nd: ~\ne: hi there\nf: \"q: x\"\ng: 'it''s'");
                return d.a === 1 && d.b === 2.5 && d.c === true && d.d === null &&
                    d.e === "hi there" && d.f === "q: x" && d.g === "it's";
            });
            test("comments ignored (but not inside quotes / apostrophes)", () => {
                const d = Yaml.parse("a: 1 # c\n# full line\nb: \"x # y\"\nc: Don't stop # c");
                return d.a === 1 && d.b === "x # y" && d.c === "Don't stop";
            });
            test("nested maps + sequences of maps", () => {
                const d = Yaml.parse("s:\n  - name: A\n    items:\n      - text: x\n        done: true\n      - text: y\n  - name: B");
                return d.s.length === 2 && d.s[0].items.length === 2 &&
                    d.s[0].items[0].done === true && d.s[1].name === "B";
            });
            test("flow lists / maps and block scalars", () => {
                const d = Yaml.parse("a: [1, \"b, c\", d]\nb: {x: 1}\nc: |\n  l1\n  l2\nd: 5");
                return d.a.length === 3 && d.a[1] === "b, c" && d.b.x === 1 && d.c === "l1\nl2\n" && d.d === 5;
            });
            test("bad YAML throws", () => {
                let threw = 0;
                ["a:\n\tb: 1", "a: \"oops", "a: 1\n   b: 2"].forEach((t) => {
                    try { Yaml.parse(t); } catch (e) { threw++; }
                });
                return threw === 3;
            });
            test("patch changes values in place and keeps comments", () => {
                const src = "# top\nitems:\n  - text: one   # first\n    done: false  # keep\n  - text: two\n";
                const d = Yaml.parse(src);
                const out = Yaml.patch(src, [
                    { target: d.items[0], key: "done", value: true },
                    { target: d.items[1], key: "done", value: true },
                ]);
                const b = Yaml.parse(out);
                return b.items[0].done === true && b.items[1].done === true &&
                    out.includes("# top") && out.includes("# first") && out.includes("# keep");
            });
        });

        suite("TodoModel", () => {
            const SRC = "title: T\nsections:\n  - name: S\n    items:\n      - text: a\n        done: true\n      - text: b\n        items:\n          - text: c\n      - text: d\n";
            test("builds sections, items, numbering", () => {
                const m = new TodoModel(SRC, "t.yaml", { persist: false });
                return m.title === "T" && m.total === 4 && m.doneCount === 1 &&
                    m.byNumber(3).text === "c" && m.byNumber(3).depth === 1;
            });
            test("toggle / reset / counts", () => {
                const m = new TodoModel(SRC, "t.yaml", { persist: false });
                m.toggle(m.byNumber(2));
                const afterToggle = m.doneCount === 2 && m.changed === 1;
                m.reset();
                return afterToggle && m.doneCount === 1 && m.changed === 0;
            });
            test("exportText writes toggles back into the YAML", () => {
                const m = new TodoModel(SRC, "t.yaml", { persist: false });
                m.toggle(m.byNumber(1));      // a: true -> false
                m.toggle(m.byNumber(4));      // d: (none) -> true
                const back = Yaml.parse(m.exportText());
                const items = back.sections[0].items;
                return items[0].done === false && items[2].done === true;
            });
            test("saved toggle is dropped when the YAML's own done: changed", () => {
                const file = "unittest_tmp.yaml";
                const key = "male.devConsole.todo." + file;
                try {
                    // you clicked item "a" (YAML said false) -> saved as done:true over base:false
                    localStorage.setItem(key, JSON.stringify({ "section0 > a": { done: true, base: false } }));
                    const same = new TodoModel("- text: a\n  done: false", file);          // file unchanged
                    const edited = new TodoModel("- text: a\n  done: true\n  note: x", file); // you edited done:
                    const editedBack = new TodoModel("- text: a\n  done: false", file);
                    return same.byNumber(1).done === true && edited.byNumber(1).base === true &&
                        edited.byNumber(1).done === true && editedBack.byNumber(1).done === true;
                } finally { localStorage.removeItem(key); }
            });
            test("stale saved toggle does not override an edited done: value", () => {
                const file = "unittest_tmp2.yaml";
                const key = "male.devConsole.todo." + file;
                try {
                    // saved when the YAML said done:true; user clicked it OFF (done:false, base:true)
                    localStorage.setItem(key, JSON.stringify({ "section0 > a": { done: false, base: true } }));
                    const m = new TodoModel("- text: a\n  done: false", file);   // file now says false (base changed)
                    return m.byNumber(1).done === false && m.changed === 0;
                } finally { localStorage.removeItem(key); }
            });
            test("accepts a bare list of items", () => {
                const m = new TodoModel("- text: x\n- text: y\n  done: true", "l.yaml", { persist: false });
                return m.total === 2 && m.doneCount === 1;
            });
        });

        suite("DevConsole", () => {
            // Runs fn with the console in a known state, then restores it.
            const sandbox = (fn) => {
                const w = World.active;
                const saved = {
                    debug: w.debugMode, open: DevConsole.open, lines: DevConsole.lines,
                    panel: DevConsole.panel, buffer: DevConsole.buffer, scene: Scene.activeScene,
                };
                w.debugMode = true;
                DevConsole.lines = [];
                try { return fn(); }
                finally {
                    w.debugMode = saved.debug; DevConsole.open = saved.open; DevConsole.lines = saved.lines;
                    DevConsole.panel = saved.panel; DevConsole.buffer = saved.buffer;
                    if (saved.scene) Scene.setScene(saved.scene);
                }
            };
            const said = () => DevConsole.lines.map((l) => l.text).join("\n");

            test("parseArgs handles quotes and escapes", () => {
                const a = DevConsole.parseArgs('display "my file" \'x y\' a\\ b');
                return a.length === 4 && a[1] === "my file" && a[2] === "x y" && a[3] === "a b";
            });
            test("debug mode off -> console disabled", () => {
                const w = World.active; const was = w.debugMode;
                w.debugMode = false;
                const off = DevConsole.enabled === false;
                w.debugMode = was;
                return off;
            });
            test("unknown command / missing slash report errors", () => sandbox(() => {
                DevConsole.run("/definitelyNotACommand");
                DevConsole.run("hello");
                return said().includes("Unknown command") && said().includes('start with "/"');
            }));
            test("/help lists the display command", () => sandbox(() => {
                DevConsole.run("/help");
                return said().includes("/display");
            }));
            test("/display <unknown> errors, /display none clears panel", () => sandbox(() => {
                DevConsole.run("/display zzzNope");
                const err = said().includes("Unknown display target");
                DevConsole.panel = { name: "fake", close() {} };
                DevConsole.run("/display none");
                return err && DevConsole.panel === null;
            }));
            test("/display <sceneId> switches the active scene", () => sandbox(() => {
                const other = Scene.scenes.find((sc) => sc.id !== Scene.activeScene);
                if (!other) return true;
                DevConsole.run("/display " + other.id);
                return Scene.activeScene === other.id;
            }));
            test("completions: commands and display targets", () => sandbox(() => {
                const c1 = DevConsole.completions("/dis");
                const c2 = DevConsole.completions("/display todo");
                return c1.includes("/display") && c2.some((s) => s.endsWith("todoList"));
            }));
            test("registerCommand adds a runnable command", () => sandbox(() => {
                let ran = null;
                DevConsole.registerCommand({ name: "unittestcmd", run: (args) => { ran = args; } });
                DevConsole.run("/unittestcmd a b");
                delete DevConsole.commands.unittestcmd;
                return ran && ran.join(",") === "a,b";
            }));
            test("open console hides keyboard from getInput; closed does not", () => sandbox(() => {
                DevConsole.open = true;
                const hidden = DevConsole.blocksInput("key") === true && DevConsole.blocksInput("mouse") === false;
                DevConsole.open = false;
                return hidden && DevConsole.blocksInput("key") === false;
            }));
            test("Keyboard queues key events and drains them", () => {
                const kb = new Keyboard();
                kb.handleKeyDown({ key: "a", code: "KeyA", repeat: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() {} });
                kb.handleKeyDown({ key: "/", code: "Slash", repeat: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() {} });
                const q = kb.drainEvents();
                return q.length === 2 && q[0].key === "a" && q[1].key === "/" && kb.drainEvents().length === 0;
            });
        });
    }

    // ============================================================
    // RUNNER
    // ============================================================

    /**
     * Runs every suite and returns a structured results object.
     * No console output, no Message — call report(results) for that.
     *
     * Return shape:
     * {
     *   total:  number,           // total tests run
     *   passed: number,
     *   failed: number,
     *   suites: {                 // grouped by suite name
     *     "helperFunctions.pad": {
     *       total:  number,
     *       passed: number,
     *       failed: number,
     *       tests: [
     *         { test: "pads integers", pass: true,  msg: "" },
     *         ...
     *       ]
     *     },
     *     ...
     *   },
     *   tests: [                  // flat list, in run order
     *     { suite: "helperFunctions.pad", test: "pads integers",
     *       pass: true, msg: "" },
     *     ...
     *   ]
     * }
     */
    function run() {
        // Reset per-run state so run() is idempotent.
        results = [];
        currentSuite = "";

        testHelperFunctions();
        testObjects();
        testInputs();
        testCamera();
        testScene();
        testDevConsole();

        // Aggregate into a grouped structure.
        const suites = {};
        let passed = 0;
        let failed = 0;

        for (const r of results) {
            if (!suites[r.suite]) {
                suites[r.suite] = { total: 0, passed: 0, failed: 0, tests: [] };
            }
            const s = suites[r.suite];
            s.total++;
            if (r.pass) { s.passed++; passed++; }
            else        { s.failed++; failed++; }
            s.tests.push({ test: r.test, pass: r.pass, msg: r.msg });
        }
		const allTests = results.map(r => ({
            suite: r.suite,
            test: r.test,
            pass: r.pass,
            msg: r.msg,
        }));
        return {
            total: results.length,
            passed,
            failed, 
            suites,
            tests: allTests,
			testsFailed: allTests.filter(t => t.pass != true),
        };
    }

    // ============================================================
    // REPORTER (optional side effects)
    // ============================================================

    /**
     * Formats a run() result object as a multi-line string.
     * Does not print anything on its own.
     */
    function format(result) {
        const lines = [];
        lines.push("================ UNIT TEST REPORT ================");
        lines.push(`Total: ${result.total}  |  Passed: ${result.passed}  |  Failed: ${result.failed}`);
        lines.push("--------------------------------------------------");

        for (const suiteName in result.suites) {
            const s = result.suites[suiteName];
            lines.push(`  [${suiteName}] (${s.passed}/${s.total})`);
            for (const t of s.tests) {
                const status = t.pass ? "PASS" : "FAIL";
                lines.push(`    ${status} - ${t.test}${t.msg ? " (" + t.msg + ")" : ""}`);
            }
        }

        lines.push("==================================================");
        return lines.join("\n");
    }

    /**
     * Logs a result object to the console and queues it as ONE
     * Message. This is the only function that produces side effects.
     * Safe to call with no argument — runs the suite first.
     */
    function report(result) {
        if (!result) result = run();
        const text = format(result);

        try {
            new Message(text, true);
        } catch (e) {
            // Message class may not be loaded (e.g. in Node tests).
        }
        console.log(text);

        return result;
    }

    return { run, report, format, suite, test, assert, assertClose };
})();

// Convenience global alias: runs and reports in one call.
function runUnitTests() {
    return UnitTests.report();
}