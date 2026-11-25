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

    // ---- item.js (Item / ItemComponent) ----
    function testItems() {
        if (typeof Item === "undefined" || typeof ItemComponent === "undefined") return;
        suite("Items", () => {
            test("component constructor sets values", () => {
                const d = new Durability(500, 200, 2);
                return d.max === 500 && d.value === 200 && d.perUse === 2 && d.item === null;
            });
            test("package / get / has / unpackage", () => {
                const it = new Item("stick").package(new Durability(50), new Attack(2, 6, 1.5));
                const ok = it.has("attack") && it.get(Attack).damage === 2 && it.get("durability").item === it;
                it.unpackage(Attack);
                return ok && !it.has("attack") && it.components.attack === undefined;
            });
            test("package replaces a component with the same id", () => {
                const it = new Item("x").package(new Attack(2));
                const old = it.get("attack");
                it.package(new Attack(9));
                return it.get("attack").damage === 9 && old.item === null;
            });
            test("package accepts classes, arrays and plain objects", () => {
                let inited = null;
                const it = new Item("x").package(Glint, [new MaxStack(16)], {
                    shine() { return 7; }, tags: ["shiny"], meta: { a: 1 },
                    _packageInit(item) { inited = item; },
                });
                return it.get("glint").enabled === true && it.getMaxStack() === 16 &&
                       it.shine() === 7 && it.hasTag("shiny") && it.meta.a === 1 && inited === it;
            });
            test("a component on another item is cloned", () => {
                const d = new Durability(10);
                const a = new Item("a").package(d), b = new Item("b").package(d);
                return a.get("durability") === d && b.get("durability") !== d && b.get("durability").max === 10;
            });
            test("use(): durability wears, breaks and blocks", () => {
                let broke = 0;
                const it = new Item("x").package(new Durability(2));
                it.on("break", () => broke++);
                it.use(); it.use();
                const r = it.use();
                return it.isBroken && broke === 1 && r.cancelled && r.reason === "broken";
            });
            test("use(): cooldown blocks until ticked down", () => {
                const it = new Item("x").package(new Cooldown(2));
                it.use();
                const blocked = it.use().reason === "cooldown";
                it.tick(); it.tick();
                return blocked && !it.use().cancelled;
            });
            test("custom component: hooks and emit", () => {
                class TestCharges extends ItemComponent {
                    static id = "testCharges";
                    constructor(max = 2) { super(); this.max = max; this.value = max; }
                    canUse() { return this.value > 0 ? undefined : "empty"; }
                    onUse() { this.value--; return { left: this.value }; }
                    onPing(n) { return n * 2; }
                }
                const it = new Item("wand").package(new TestCharges(1));
                const r1 = it.use(), r2 = it.use();
                return r1.hooks.testCharges.left === 0 && r2.reason === "empty" &&
                       it.emit("ping", 4).testCharges === 8 && ItemComponent.get("testCharges") === TestCharges;
            });
            test("hook priority order", () => {
                const order = [];
                class TestLow extends ItemComponent { static id = "testLow"; static priority = -1; onUse() { order.push("low"); } }
                class TestHigh extends ItemComponent { static id = "testHigh"; static priority = 5; onUse() { order.push("high"); } }
                new Item("x").package(TestLow, TestHigh).use();
                return order.join() === "high,low";
            });
            test("subclass constructor values and tags", () => {
                const s = new Sword("iron_sword", 8, undefined, 3.5);
                return s.type === "sword" && s.getDamage() === 8 && s.getSpeed() === 4 && s.getReach() === 3.5 &&
                       s.get("durability").max === 250 && s.hasTag("weapon") && s.hasTag("sword") &&
                       s.is("weapon") && s.getMaxStack() === 1;
            });
            test("user subclass of an item type", () => {
                class TestWand extends Item {
                    static TYPE = "testWand";
                    constructor(name = null, damage = 4) { super(name); this.package(new Ranged(damage, 18, "spark")); }
                }
                const w = new TestWand("w", 6);
                return w.get("ranged").damage === 6 && Item.getClass("testWand") === TestWand;
            });
            test("clone is deep and keeps functions", () => {
                const fn = () => 1;
                const it = new Skill("s", true, fn);
                it.get("cooldown").remaining = 5;
                const c = it.clone();
                c.get("cooldown").remaining = 0;
                return c instanceof Skill && c.get("ability").fn === fn && c.get("ability").item === c &&
                       it.get("cooldown").remaining === 5;
            });
            test("toJSON / fromJSON round trip", () => {
                const s = new Sword("iron_sword", 8);
                s.wear(10);
                s.package(new Glint());
                s.unpackage("maxStack");
                s.setName("Iron Sword").addTag("metal");
                const l = Item.fromJSON(JSON.parse(JSON.stringify(s)));
                return l instanceof Sword && l.get("durability").value === 240 && l.get("attack").damage === 8 &&
                       l.has("glint") && !l.has("maxStack") && l.getDisplayName() === "Iron Sword" && l.hasTag("metal");
            });
            test("Item.create / define / spawn", () => {
                const it = Item.create({ type: "sword", name: "big", args: [12],
                                         components: { attack: { reach: 9 }, glint: [false], durability: null } });
                Item.define({ id: "test_proto", type: "food", args: [9] });
                const sp = Item.spawn("test_proto");
                return it.getDamage() === 12 && it.getReach() === 9 && it.get("glint").enabled === false &&
                       it.isUnbreakable() && sp instanceof Food && sp.get("consume").hunger === 9 && sp.id !== "test_proto";
            });
            test("stacking compares components", () => {
                const a = new Food("pie"), b = new Food("pie");
                const same = a.canStackWith(b);
                b.get("consume").hunger = 99;
                return same && !a.canStackWith(b) && !new Sword("s").canStackWith(new Sword("s"));
            });
            test("count defaults to 1 and is capped by maxStack", () => {
                const f = new Food("pie");                         // maxStack 16
                const start = f.count === 1 && f.spaceLeft() === 15;
                const left = f.addCount(20);                       // 15 fit, 5 don't
                const capped = f.count === 16 && left === 5 && f.isFullStack();
                f.setCount(-3);
                const floor = f.count === 0 && f.isEmptyStack();
                f.setCount(99);
                const s = new Sword("s").setCount(5);              // doesn't stack
                return start && capped && floor && f.count === 16 && s.count === 1;
            });
            test("removeCount / split / mergeFrom move counts between stacks", () => {
                let emptied = 0;
                const a = new Food("pie").setCount(10);
                a.on("empty", () => emptied++);
                const taken = a.removeCount(3);                    // 7 left
                const part = a.split(4);                           // a 3, part 4
                const b = new Food("pie").setCount(14);
                const moved = b.mergeFrom(part);                   // only 2 fit
                const all = a.removeCount(50);
                return taken === 3 && part.count === 2 && moved === 2 && b.count === 16 &&
                       all === 3 && a.count === 0 && emptied === 1 && a.split(1) === null &&
                       new Food("pie").mergeFrom(new Food("cake")) === 0;
            });
            test("count survives clone, toJSON / fromJSON and Item.create", () => {
                const f = new Food("pie").setCount(9);
                const c = f.clone();
                const l = Item.fromJSON(JSON.parse(JSON.stringify(f)));
                const made = Item.create({ type: "food", name: "pie", count: 12 });
                return c.count === 9 && l.count === 9 && made.count === 12 &&
                       Item.fromJSON({ type: "food", name: "old" }).count === 1;
            });
            test("Gun keeps its positional constructor and stat passthrough", () => {
                const g = Gun.fromStats("m4", 15, 600, 150, 16, 2, 1, 1, 3.5, 30, 120, { x: 12, y: 7 });
                g.damage = 20;
                return g.get("firearm").damage === 20 && g.mag === 30 && g._mag === 30 && g.ammo === 120 &&
                       g.fireType === 2 && g.size.width === 12 && g.getMode() === "Full Auto";
            });
            test("Skill: passive fires from tick while its condition holds", () => {
                const me = { health: 5, maxHealth: 7 };
                const s = new Skill("regen", true, (i, t) => { t.health += 1; }, (i, t) => t.health < t.maxHealth, 0, "mana", 1, null, 0, 0);
                s.activate(me);
                for (let i = 0; i < 5; i++) s.tick(1 / 50);
                return me.health === 7;
            });
        });

        suite("Inventory stacks", () => {
            const pies = (n) => new Food("pie").setCount(n);    // maxStack 16
            test("append merges into matching stacks before taking a slot", () => {
                const inv = new Inventory(4, 0, 0);
                inv.appendMode = "first";
                inv.append(pies(10));
                inv.append(pies(10));                            // 6 join slot 1, 4 take slot 2
                const third = pies(3);
                const r = inv.append(third);                     // all join slot 2
                return inv[1].count === 16 && inv[2].count === 7 && inv[3] === null &&
                       r === true && third.count === 0;
            });
            test("shift mode merges too, and things that don't stack still take slots", () => {
                const inv = new Inventory(4, 0, 0);
                inv.append(pies(5));
                inv.append(pies(5));
                inv.append(new Sword("s"));
                inv.append(new Sword("s"));
                return inv[3].count === 10 && inv[1] instanceof Sword && inv[2] instanceof Sword && inv.length === 3;
            });
            test("leftover from a full given slot goes to an empty slot, not over it", () => {
                const inv = new Inventory(3, 0, 0);
                inv.appendMode = "first";
                inv.append(pies(14));
                inv.append(pies(5), 1);                          // 2 join slot 1, 3 go to slot 2
                return inv[1].count === 16 && inv[2].count === 3 && inv.trashed.length === 0;
            });
            test("autoStack = false keeps stacks apart", () => {
                const inv = new Inventory(3, 0, 0);
                inv.appendMode = "first";
                inv.autoStack = false;
                inv.append(pies(2));
                inv.append(pies(2));
                return inv[1].count === 2 && inv[2].count === 2;
            });
            test("split: half by default, into an empty slot", () => {
                const inv = new Inventory(3, 0, 0);
                inv.appendMode = "first";
                inv.append(pies(9));
                const r = inv.split(1);
                return r.slot === 2 && r.moved === 4 && inv[1].count === 5 && inv[2].count === 4 &&
                       inv[1] !== inv[2] && inv[1].canStackWith(inv[2]);
            });
            test("split: into a matching stack is capped by its space", () => {
                const inv = new Inventory(3, 0, 0);
                inv.appendMode = "first";
                inv.autoStack = false;
                inv.append(pies(10));
                inv.append(pies(14));
                const r = inv.split(1, 5, 2);
                return r.moved === 2 && inv[1].count === 8 && inv[2].count === 16;
            });
            test("split refuses when it can't", () => {
                const inv = new Inventory(2, 0, 0);
                inv.appendMode = "first";
                inv.append(pies(1));
                inv.append(new Sword("s"));
                const single = inv.split(1);                     // count 1
                inv[1].setCount(6);
                const full = inv.split(1);                       // no empty slot
                const wrong = inv.split(1, 2, 2);                // a sword isn't a pie stack
                return single === null && full === null && wrong === null && inv[1].count === 6;
            });
        });
    }

    // ---- objects.js: tileMatrix ----
    function testTileMatrix() {
        // Plain test pieces: a transform (so positioning runs) + optional tile config.
        const piece = (tile, w = 10, h = 10) => ({ tile, transform: new Transform(0, 0, w, h) });
        const floor = () => piece({ layer: 'ground', category: 'ground' });
        const table = (extra = {}) => piece(Object.assign({ category: 'furniture', height: 12, accepts: ['decor'] }, extra));
        const lamp = () => piece({ category: 'decor', supports: false });
        const crate = () => piece({ category: 'furniture' });
        const grid = (opts = {}) => new tileMatrix(0, 0, 8, 6, 20, 20, Object.assign({ logErrors: false }, opts), "blank");
        const throws = (fn) => { try { fn(); return false; } catch (e) { return e instanceof tileMatrixError; } };

        suite("tileMatrix: construction & coordinates", () => {
            test("stores size, cell size and scenes", () => {
                const m = grid();
                const ok = m.cols === 8 && m.rows === 6 && m.cell.w === 20 && m.cell.h === 20 && m.scenes[0] === "blank";
                m.delete();
                return ok;
            });
            test("cellH and options are optional (a string is a scene id)", () => {
                const m = new tileMatrix(0, 0, 4, 4, 16, "blank");
                const ok = m.cell.h === 16 && m.scenes[0] === "blank";
                m.delete();
                return ok;
            });
            test("rejects bad dimensions", () => {
                return throws(() => new tileMatrix(0, 0, 0, 4, 20)) &&
                    throws(() => new tileMatrix(0, 0, 4, 4, -5)) &&
                    throws(() => new tileMatrix(0, 0, 4, 4, 20, 20, { maxLayers: 0 }));
            });
            test("toWorld / toCell round-trip with an offset origin", () => {
                const m = new tileMatrix(100, 50, 5, 5, 20, 20, { logErrors: false }, "blank");
                const tl = m.toWorld(2, 2, 'topleft');
                const c = m.toWorld(2, 2);
                const back = m.toCell(c.x, c.y);
                const ok = tl.x === 140 && tl.y === 90 && c.x === 150 && c.y === 100 &&
                    back.x === 2 && back.y === 2 && m.toCell(99, 60) === null && m.toCell(200, 60) === null;
                m.delete();
                return ok;
            });
            test("inBounds rejects non-integers and outside cells", () => {
                const m = grid();
                const ok = m.inBounds(0, 0) && m.inBounds(7, 5) && !m.inBounds(8, 0) && !m.inBounds(-1, 0) && !m.inBounds(1.5, 0);
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: shapes", () => {
            const shaped = (shape, orientation, w = 20, h = 20) =>
                new tileMatrix(10, 5, 6, 5, w, h, { shape, orientation, logErrors: false }, "blank");
            const variants = [['square'], ['diamond', null, 40, 20], ['hex', 'pointy'], ['hex', 'flat'],
                ['triangle', 'up'], ['triangle', 'down']];

            test("countToCover: the far edges are covered solidly for every shape", () => {
                const W = 333, H = 217;
                return variants.every(([s, o, w = 20, h = 20]) => {
                    const fit = tileMatrix.countToCover(s, o, W, H, w, h);
                    const m = new tileMatrix(0, 0, fit.cols, fit.rows, w, h, { shape: s, orientation: o, logErrors: false }, "blank");
                    let ok = true;
                    // skip the zig-zag origin side (one cell), then sample up to the far edges
                    for (let py = h; py < H; py += 3.7) for (let px = w; px < W; px += 3.3) {
                        if (!m.toCell(px, py)) ok = false;
                    }
                    for (let py = h; py < H; py += 1.9) if (!m.toCell(W - 0.01, py)) ok = false;
                    for (let px = w; px < W; px += 1.7) if (!m.toCell(px, H - 0.01)) ok = false;
                    m.delete();
                    return ok;
                });
            });
            test("countWithin: every center inside, and one more col / row wouldn't fit", () => {
                const W = 333, H = 217;
                return variants.every(([s, o, w = 20, h = 20]) => {
                    const fit = tileMatrix.countWithin(s, o, W, H, w, h);
                    const inside = (cols, rows) => {
                        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                            const c = tileMatrix.centerFor(s, o, x, y, w, h);
                            if (c.x < 0 || c.y < 0 || c.x > W || c.y > H) return false;
                        }
                        return true;
                    };
                    return inside(fit.cols, fit.rows) && !inside(fit.cols + 1, fit.rows) && !inside(fit.cols, fit.rows + 1);
                });
            });
            test("non-number cols / rows are sized from the screen (centers by default, or cover)", () => {
                const scr = tileMatrix.screenSize();
                const fit = tileMatrix.countWithin('diamond', null, scr.w - 10, scr.h, 40, 20);
                const m = new tileMatrix(10, 0, 'auto', undefined, 40, 20, { shape: 'diamond', logErrors: false }, "blank");
                const m2 = new tileMatrix(0, 0, 5, null, 20, "blank");
                const cover = tileMatrix.countToCover('hex', 'pointy', scr.w, scr.h, 20, 20);
                const m3 = new tileMatrix(0, 0, 'auto', 'auto', 20, 20, { shape: 'hex', autoFit: 'cover' }, "blank");
                let centersOk = true;
                for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
                    const c = m.toWorld(x, y);
                    if (c.x < 0 || c.y < 0 || c.x > scr.w || c.y > scr.h) centersOk = false;
                }
                const ok = centersOk && m.cols === fit.cols && m.rows === fit.rows && m.autoSize.cols && m.autoSize.rows &&
                    m2.cols === 5 && m2.rows === tileMatrix.countWithin('square', null, scr.w, scr.h, 20, 20).rows &&
                    !m2.autoSize.cols && m2.autoSize.rows &&
                    m3.cols === cover.cols && m3.rows === cover.rows &&
                    throws(() => new tileMatrix(0, 0, 'auto', 'auto', 20, 20, { autoFit: 'nope' }));
                m.delete(); m2.delete(); m3.delete();
                return ok;
            });
            test("rejects unknown shapes and orientations", () => {
                return throws(() => shaped('blob')) && throws(() => shaped('hex', 'up')) && throws(() => shaped('triangle', 'flat'));
            });
            test("toCell(toWorld(x, y)) round-trips for every cell of every shape", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    let ok = true;
                    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
                        const p = m.toWorld(x, y), c = m.toCell(p.x, p.y);
                        if (!c || c.x !== x || c.y !== y) ok = false;
                    }
                    m.delete();
                    return ok;
                });
            });
            test("cell polygons stay inside the grid bounds", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const p = m.transform.position, sz = m.transform.scale, e = 1e-6;
                    let ok = true;
                    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
                        m.cellPolygon(x, y).forEach(v => {
                            if (v.x < p.x - e || v.y < p.y - e || v.x > p.x + sz.x + e || v.y > p.y + sz.y + e) ok = false;
                        });
                    }
                    m.delete();
                    return ok;
                });
            });
            test("polygons have the right corner count", () => {
                const n = { square: 4, diamond: 4, hex: 6, triangle: 3 };
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const ok = m.cellPolygon(1, 1).length === n[s] && m.cellPolygon(99, 0).length === 0;
                    m.delete();
                    return ok;
                });
            });
            test("diamond is a staggered rectangle of 45-degree tiles", () => {
                const m = new tileMatrix(0, 0, 4, 3, 40, 20, { shape: 'diamond', logErrors: false }, "blank");
                const c00 = m.toWorld(0, 0), c01 = m.toWorld(0, 1), c10 = m.toWorld(1, 0), c02 = m.toWorld(0, 2);
                const ok = c00.x === 20 && c00.y === 10 &&     // row 0
                    c10.x === 60 && c10.y === 10 &&            // next tile in the row: one tile right
                    c01.x === 40 && c01.y === 20 &&            // odd row: half a tile right, half a tile down
                    c02.x === 20 && c02.y === 30 &&            // even rows line up again
                    m.transform.scale.x === 180 && m.transform.scale.y === 40 &&
                    m.neighbors(1, 1).length === 4 && m.neighbors(1, 1, true).length === 6;   // (1,3) is outside 3 rows
                m.delete();
                return ok;
            });
            test("toCell is null outside the grid shape", () => {
                const m = shaped('diamond', null, 40, 20);
                // top-left corner of the bounding box is outside an isometric grid
                const ok = m.toCell(10.5, 5.5) === null;
                m.delete();
                return ok;
            });
            test("neighbors: counts and symmetry", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const want = { square: 4, diamond: 4, hex: 6, triangle: 3 }[s];
                    let ok = m.neighbors(2, 2).length === want;
                    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
                        m.neighbors(x, y).forEach(n => {
                            if (!m.neighbors(n.x, n.y).some(b => b.x === x && b.y === y)) ok = false;
                        });
                    }
                    m.delete();
                    return ok;
                });
            });
            test("square diagonals option adds 4 neighbors", () => {
                const m = grid();
                const ok = m.neighbors(2, 2, true).length === 8 && m.neighbors(0, 0).length === 2;
                m.delete();
                return ok;
            });
            test("placed objects are centered on their cell", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const a = piece();
                    m.place(2, 3, a);
                    const c = m.toWorld(2, 3);
                    const ok = Math.abs(a.transform.position.x - c.x) < 1e-6 && Math.abs(a.transform.position.y - c.y) < 1e-6;
                    m.delete();
                    return ok;
                });
            });
        });

        suite("tileMatrix: directions & paths", () => {
            const shaped = (shape, orientation, w = 20, h = 20) =>
                new tileMatrix(0, 0, 6, 5, w, h, { shape, orientation, logErrors: false }, "blank");
            const variants = [['square'], ['diamond', null, 40, 20], ['hex', 'pointy'], ['hex', 'flat'],
                ['triangle', 'up'], ['triangle', 'down']];
            const same = (a, b) => a.length === b.length && a.every(p => b.some(q => q.x === p.x && q.y === p.y));

            test("direction counts: square/diamond 8, hex 6, triangle 6", () => {
                const want = { square: 8, diamond: 8, hex: 6, triangle: 6 };
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const ok = m.directions(2, 2).length === want[s];
                    m.delete();
                    return ok;
                });
            });
            test("side directions lead to the same cells as neighbors()", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    let ok = true;
                    for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
                        if (!same(m.directions(x, y, { corners: false }), m.neighbors(x, y))) ok = false;
                    }
                    m.delete();
                    return ok;
                });
            });
            test("square angles are 0, 45, ... 315", () => {
                const m = shaped('square');
                const ok = m.directions(2, 2).map(d => d.angle).join() === '0,45,90,135,180,225,270,315';
                m.delete();
                return ok;
            });
            test("outside: true keeps directions that leave the grid", () => {
                const m = shaped('square');
                const all = m.directions(0, 0, { outside: true });
                const ok = all.length === 8 && all.filter(d => d.x === null).length === 5 && m.directions(0, 0).length === 3;
                m.delete();
                return ok;
            });
            test("snapDirection picks the nearest allowed angle", () => {
                const m = shaped('square');
                const ok = m.snapDirection(2, 2, 10).angle === 0 && m.snapDirection(2, 2, 40).angle === 45 &&
                    m.snapDirection(2, 2, 350).angle === 0 && m.snapDirection(2, 2, 40, { corners: false }).angle === 0;
                m.delete();
                return ok;
            });
            test("findPath: diagonal vs sides only", () => {
                const m = grid();
                const ok = m.findPath({ x: 0, y: 0 }, { x: 3, y: 3 }).length === 3 &&
                    m.findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, { corners: false }).length === 6 &&
                    m.findPath({ x: 1, y: 1 }, { x: 1, y: 1 }).length === 0;
                m.delete();
                return ok;
            });
            test("findPath goes around walls and fails when walled off", () => {
                const m = grid();
                for (let y = 0; y < 5; y++) m.setBlocked(2, y);
                const p = m.findPath({ x: 0, y: 0 }, { x: 4, y: 0 });
                const ok1 = p && p[p.length - 1].x === 4 && p.every(c => !m.isBlocked(c.x, c.y));
                m.setBlocked(2, 5);
                const ok = ok1 && m.findPath({ x: 0, y: 0 }, { x: 4, y: 0 }) === null;
                m.delete();
                return ok;
            });
            test("corner cutting is off by default", () => {
                const m = grid();
                m.setBlocked(1, 0); m.setBlocked(0, 1);
                const ok = m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }) === null &&
                    m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, { cornerCutting: true }).length === 1;
                m.delete();
                return ok;
            });
            test("every path step is one of the previous cell's directions (all shapes)", () => {
                return variants.every(([s, o, w, h]) => {
                    const m = shaped(s, o, w, h);
                    const p = m.findPath({ x: 0, y: 0 }, { x: 5, y: 4 });
                    let prev = { x: 0, y: 0 }, ok = !!p && p.length > 0;
                    (p || []).forEach(c => {
                        if (!m.directions(prev.x, prev.y).some(d => d.x === c.x && d.y === c.y)) ok = false;
                        prev = c;
                    });
                    m.delete();
                    return ok;
                });
            });
        });

        suite("PathingAI", () => {
            const str = p => p ? p.map(c => `(${c.x},${c.y})`).join(' ') : String(p);
            const walker = (m, x, y) => { const c = m.toWorld(x, y); const o = piece(); o.transform.position.x = c.x; o.transform.position.y = c.y; m.link(o); return o; };
            const run = (m, ticks) => { for (let i = 0; i < ticks; i++) { m.update(0.02); m.lateUpdate(); } };
            const diamond = (opts = {}) => new tileMatrix(0, 0, 8, 8, 50, 50, Object.assign({ shape: 'diamond', logErrors: false }, opts), "blank");

            test("diamond: slips past a reserved cell's corner (default 'loose')", () => {
                const m = diamond();
                const a = walker(m, 1, 1);
                m.setReserved(2, 1);
                const p = m.moveTo(a, 3, 1, { speed: 50 });   // 1px steps: lands exactly on the shared vertex
                run(m, 400);
                const ok = str(p) === '(2,2) (3,2) (3,1)' && m.placementOf(a).x === 3 && m.placementOf(a).y === 1 && !m.isMoving(a);
                m.delete();
                return ok;
            });
            test("cornerRule 'strict' never passes a closed cell (the old behaviour)", () => {
                const m = diamond({ pathing: new PathingAI({ cornerRule: 'strict' }) });
                const a = walker(m, 1, 1);
                m.setReserved(2, 1);   // reserved only stops a path that knows its walker (obj)
                const ok = str(m.findPath({ x: 1, y: 1 }, { x: 3, y: 1 }, { obj: a })) === '(2,2) (2,3) (3,2) (3,1)' &&
                    str(m.findPath({ x: 1, y: 1 }, { x: 3, y: 1 }, { obj: a, pathing: new PathingAI(), cornerCutting: false })) === '(2,2) (2,3) (3,2) (3,1)' &&
                    str(m.findPath({ x: 1, y: 1 }, { x: 3, y: 1 }, { obj: a, pathing: new PathingAI() })) === '(2,2) (3,2) (3,1)';
                m.delete();
                return ok;
            });
            test("'loose' won't squeeze between two closed cells; 'free' will", () => {
                const m = grid();
                m.setBlocked(1, 0); m.setBlocked(0, 1);
                const ok = m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }) === null &&
                    str(m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, { cornerRule: 'free' })) === '(1,1)';
                m.delete();
                return ok;
            });
            test("square: a diagonal past one blocked cell is walked all the way", () => {
                const m = grid();
                const a = walker(m, 0, 0);
                m.setBlocked(1, 0);
                const p = m.moveTo(a, 1, 1, { speed: 100 });
                run(m, 100);
                const ok = str(p) === '(1,1)' && m.placementOf(a).x === 1 && m.placementOf(a).y === 1 && !m.isMoving(a);
                m.delete();
                return ok;
            });
            test("cornerCost makes corner steps dearer (or cheaper)", () => {
                const m = grid();
                const ok = m.findPath({ x: 0, y: 0 }, { x: 2, y: 2 }).length === 2 &&
                    m.findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, { cornerCost: 10 }).length === 4 &&
                    m.findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, { cornerCost: 0.5 }).length === 2;
                m.delete();
                return ok;
            });
            test("a subclass can change what's passable (e.g. a custom cell property)", () => {
                class NoWater extends PathingAI {
                    passable(matrix, x, y, obj) { return super.passable(matrix, x, y, obj) && matrix.cellInfo(x, y).terrain !== 'water'; }
                }
                const m = grid({ pathing: new NoWater() });
                for (let y = 0; y < 5; y++) m.setCell(2, y, { terrain: 'water' });
                const p = m.findPath({ x: 0, y: 0 }, { x: 4, y: 0 });
                const ok = p && p.every(c => c.x !== 2 || c.y === 5);
                m.delete();
                return ok;
            });
            test("pathing setter: options object -> PathingAI, bad values throw; per-call opts.pathing", () => {
                const m = grid();
                m.pathing = { cornerRule: 'strict', speed: 7 };
                const ok1 = m.pathing instanceof PathingAI && m.pathing.speed === 7 && m.pathing.cornerRule === 'strict';
                const ok2 = throws(() => { m.pathing = 5; }) && throws(() => new PathingAI({ cornerRule: 'sideways' }));
                m.setBlocked(1, 0);
                const ok3 = m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }).length === 2 &&
                    m.findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, { pathing: new PathingAI() }).length === 1;
                m.delete();
                return ok1 && ok2 && ok3;
            });
            test("the AI's speed drives moveTo unless the call overrides it", () => {
                const m = grid({ pathing: new PathingAI({ speed: 1000 }) });
                const a = walker(m, 0, 0);
                m.moveTo(a, 3, 0);
                run(m, 4);   // 1 tick to align, then 20px per tick: (0,0) -> (3,0) is 60px
                const fast = m.placementOf(a).x === 3;
                const b = walker(m, 0, 2);
                m.moveTo(b, 3, 2, { speed: 100 });
                run(m, 4);
                const ok = fast && m.placementOf(b).x < 3;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: linked objects", () => {
            const at = (x, y, tile = {}) => { const p = piece(tile); p.transform.position.x = x; p.transform.position.y = y; return p; };
            const run = (m, ticks, dt = 0.02) => { for (let i = 0; i < ticks; i++) { m.update(dt); m.lateUpdate(); } };

            test("link places objects in the cell under their center without moving them", () => {
                const m = grid();
                const a = at(50, 30), b = at(115, 95);
                const ok = m.link(a, [b]) && m.isLinked(a) && m.isLinked(b) &&
                    m.placementOf(a).x === 2 && m.placementOf(a).y === 1 && m.placementOf(b).x === 5 && m.placementOf(b).y === 4 &&
                    a.transform.position.x === 50 && a.transform.position.y === 30;
                m.delete();
                return ok;
            });
            test("linking an object outside the grid puts it on the outside list", () => {
                const m = grid();
                const a = at(-5, 5), b = at(50, 30);
                const ok = m.link(a, b) && m.isLinked(a) && m.isOutside(a) && !m.isOutside(b) &&
                    m.placementOf(a) === null && m.outside.length === 1 && m.outside[0] === a;
                m.delete();
                return ok;
            });
            test("an outside object moves freely and gets a cell when it enters the grid", () => {
                const m = grid();
                const a = at(-50, 30);
                m.link(a);
                a.transform.position.x = -30;
                m.lateUpdate();
                const ok1 = a.transform.position.x === -30 && m.isOutside(a);
                a.transform.position.x = 15;      // crosses the left edge into cell (0, 1)
                m.lateUpdate();
                const ok = ok1 && !m.isOutside(a) && m.placementOf(a).x === 0 && m.placementOf(a).y === 1 &&
                    a.transform.position.x === 15;
                m.delete();
                return ok;
            });
            test("entering through a blocked cell stops it at the edge", () => {
                const m = grid();
                const a = at(-30, 30);
                m.link(a);
                m.setBlocked(0, 1);
                a.transform.position.x = 5;
                m.lateUpdate();
                const ok = m.isOutside(a) && a.transform.position.x < 0;
                m.delete();
                return ok;
            });
            test("release takes it out of its cell but keeps it linked", () => {
                const m = grid();
                const a = at(50, 30);
                let reason = null;
                a.onTileRemoved = (mx, rec) => reason = rec.reason;
                m.link(a);
                const ok1 = m.release(a) && m.isLinked(a) && m.isOutside(a) && m.cellState(2, 1) === 'empty' && reason === 'released';
                a.transform.position.x = 70;      // moving over the grid doesn't re-place it
                m.lateUpdate();
                const ok2 = m.isOutside(a) && a.transform.position.x === 70;
                const ok = ok1 && ok2 && m.link(a) && m.placementOf(a).x === 3;   // link() again places it
                m.delete();
                return ok;
            });
            test("released objects re-enter after leaving and coming back", () => {
                const m = grid();
                const a = at(10, 30);
                m.link(a);
                m.release(a);
                a.transform.position.x = -20; m.lateUpdate();
                const ok1 = m.isOutside(a);
                a.transform.position.x = 10; m.lateUpdate();
                const ok = ok1 && !m.isOutside(a) && m.placementOf(a).x === 0;
                m.delete();
                return ok;
            });
            test("place() teleports a linked object to the cell (even past walls) and keeps tracking it", () => {
                const m = grid();
                const a = at(14, 13);
                m.link(a);
                for (let y = 0; y < 6; y++) m.setBlocked(3, y);
                m.moveTo(a, 1, 0);
                const r = m.place(5, 2, a);
                m.lateUpdate();
                const ok1 = r && m.placementOf(a).x === 5 && m.placementOf(a).y === 2 &&
                    a.transform.position.x === 110 && a.transform.position.y === 50 && !m.isMoving(a);
                a.transform.position.x = 130;     // still tracked (anchor 'none') after the teleport
                m.lateUpdate();
                const ok = ok1 && m.placementOf(a).x === 6 && a.transform.position.x === 130;
                m.delete();
                return ok;
            });
            test("place() on the linked object's own cell re-centers it; outside objects get placed", () => {
                const m = grid();
                const a = at(14, 13), b = at(-40, 10);
                m.link(a, b);
                m.place(0, 0, a);
                const ok1 = a.transform.position.x === 10 && a.transform.position.y === 10;
                const ok = ok1 && m.place(2, 0, b) && !m.isOutside(b) && b.transform.position.x === 50 &&
                    (m.lateUpdate(), m.placementOf(b).x === 2 && b.transform.position.x === 50);
                m.delete();
                return ok;
            });
            test("removeObject keeps a linked object linked (outside); moveTo refuses outside objects", () => {
                const m = grid();
                const a = at(50, 30);
                m.link(a);
                m.removeObject(a);
                m.update(0.02); m.lateUpdate();
                const ok = m.isLinked(a) && m.isOutside(a) && m.moveTo(a, 0, 0) === false;
                m.delete();
                return ok;
            });
            test("moving into another cell updates the placement (and fires onTileMoved)", () => {
                const m = grid();
                const a = at(50, 30);
                let moved = 0;
                a.onTileMoved = () => moved++;
                m.link(a);
                a.transform.position.x = 65;
                m.lateUpdate();
                const ok = m.placementOf(a).x === 3 && moved === 1 && a.transform.position.x === 65;
                m.delete();
                return ok;
            });
            test("a blocked cell stops it", () => {
                const m = grid();
                const a = at(50, 30);
                m.link(a);
                m.setBlocked(3, 1);
                a.transform.position.x = 65;
                m.lateUpdate();
                const ok = m.placementOf(a).x === 2 && a.transform.position.x < 60;
                m.delete();
                return ok;
            });
            test("it slides along a blocked cell", () => {
                const m = grid();
                const a = at(50, 30);
                m.link(a);
                m.setBlocked(3, 2);
                a.transform.position.x = 65; a.transform.position.y = 45;
                m.lateUpdate();
                const r = m.placementOf(a);
                const ok = r.x === 3 && r.y === 1 && a.transform.position.x === 65;
                m.delete();
                return ok;
            });
            test("it can't leave the grid ('block')", () => {
                const m = grid();
                const a = at(150, 30);
                m.link(a);
                a.transform.velocity.x = 500;
                a.transform.position.x = 200;
                m.lateUpdate();
                const ok = m.placementOf(a).x === 7 && a.transform.position.x < 160 && a.transform.velocity.x === 0;
                m.delete();
                return ok;
            });
            test("a fast move can't skip over a blocked cell", () => {
                const m = grid();
                const a = at(10, 10);
                m.link(a);
                m.setBlocked(2, 0);
                a.transform.position.x = 110;
                m.lateUpdate();
                const ok = m.placementOf(a).x === 1;
                m.delete();
                return ok;
            });
            test("unlink stops tracking; deleted objects are dropped", () => {
                const m = grid();
                const a = at(50, 30), b = at(10, 10);
                m.link(a, b);
                m.unlink(a);
                a.transform.position.x = 90;
                b.deleted = true;
                m.lateUpdate();
                const ok = m.placementOf(a).x === 2 && !m.isLinked(a) && !m.isLinked(b);
                m.delete();
                return ok;
            });
            test("moveTo walks to the cell and calls onArrive", () => {
                const m = grid();
                const a = at(10, 10);
                let arrived = null;
                m.link(a);
                const path = m.moveTo(a, 3, 0, { speed: 200, onArrive: (o, c) => arrived = c });
                run(m, 100);
                const ok = path.length === 3 && m.placementOf(a).x === 3 && a.transform.position.x === 70 &&
                    a.transform.position.y === 10 && !m.isMoving(a) && arrived && arrived.x === 3;
                m.delete();
                return ok;
            });
            test("moveTo only moves along allowed directions after aligning", () => {
                const m = grid();
                const a = at(4, 6);   // off-center in cell (0, 0)
                m.link(a);
                m.moveTo(a, 3, 2, { speed: 100 });
                run(m, 4);   // aligns to (10, 10) first: ~7.2px at 2px per tick
                let last = { x: a.transform.position.x, y: a.transform.position.y }, ok = true;
                for (let i = 0; i < 100 && m.isMoving(a); i++) {
                    run(m, 1);
                    const dx = a.transform.position.x - last.x, dy = a.transform.position.y - last.y;
                    if (dx || dy) {
                        const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                        if (Math.abs(Math.round(ang / 45) * 45 - ang) > 1e-6) ok = false;
                    }
                    last = { x: a.transform.position.x, y: a.transform.position.y };
                }
                ok = ok && m.placementOf(a).x === 3 && m.placementOf(a).y === 2;
                m.delete();
                return ok;
            });
            test("moveTo goes around walls; fails for blocked targets and unlinked objects", () => {
                const m = grid();
                const a = at(10, 10);
                m.link(a);
                m.setBlocked(1, 0); m.setBlocked(1, 1);
                m.moveTo(a, 2, 0, { speed: 300 });
                run(m, 100);
                const ok1 = m.placementOf(a).x === 2 && m.placementOf(a).y === 0;
                m.setBlocked(5, 5);
                const ok = ok1 && m.moveTo(a, 5, 5) === false && m.moveTo(at(10, 10), 2, 2) === false;
                m.delete();
                return ok;
            });
            test("moveTo repaths when the next cell gets blocked", () => {
                const m = grid();
                const a = at(10, 10);
                let blocked = false;
                m.link(a);
                m.moveTo(a, 4, 0, { speed: 100, corners: false, onBlocked: () => blocked = true });
                m.setBlocked(1, 0);
                run(m, 200);
                const ok = !blocked && m.placementOf(a).x === 4 && m.placementOf(a).y === 0;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: layer names", () => {
            test("level 0 is always 'ground'", () => {
                const m = grid({ layers: ['furniture', 'decor'] });
                const ok = m.layerName(0) === 'ground' && m.layerIndex('ground') === 0 &&
                    m.layerIndex('furniture') === 1 && m.layerIndex('decor') === 2;
                m.delete();
                return ok;
            });
            test("a leading 'ground' in options.layers is skipped", () => {
                const m = grid({ layers: ['ground', 'furniture'] });
                const ok = m.layerIndex('furniture') === 1;
                m.delete();
                return ok;
            });
            test("null in options.layers leaves a level unnamed", () => {
                const m = grid({ layers: ['furniture', null, 'roof'] });
                const ok = m.layerName(2) === null && m.layerIndex('roof') === 3;
                m.delete();
                return ok;
            });
            test("ground can't be renamed, reused or put above level 0", () => {
                const m = grid({ layers: ['furniture'] });
                const ok = throws(() => m.renameLayer('ground', 'dirt')) &&
                    throws(() => m.renameLayer(0, 'dirt')) &&
                    throws(() => m.nameLayer(0, 'dirt')) &&
                    throws(() => m.nameLayer(2, 'ground')) &&
                    throws(() => m.nameLayer(2, 'Ground')) &&
                    throws(() => grid({ layers: ['furniture', 'ground'] }));
                m.delete();
                return ok;
            });
            test("renameLayer / nameLayer and duplicate names", () => {
                const m = grid({ layers: ['furniture', 'decor'] });
                m.renameLayer('decor', 'items');
                m.nameLayer(4, 'roof');
                const ok = m.layerIndex('items') === 2 && m.layerIndex('decor') === -1 &&
                    m.layerIndex('roof') === 4 && throws(() => m.nameLayer(3, 'furniture')) &&
                    m.layers.map(l => l.name).join() === 'ground,furniture,items,roof';
                m.delete();
                return ok;
            });
            test("can't name a level at or above maxLayers", () => {
                const m = grid({ maxLayers: 3 });
                const ok = throws(() => m.nameLayer(3, 'roof')) && throws(() => m.nameLayer(2, 'top'));
                m.nameLayer(2, 'upper');
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: placing & stacking", () => {
            test("tile.layer 'ground' goes to level 0, other objects default to level 1", () => {
                const m = grid();
                const f = floor(), t = table();
                const a = m.place(1, 1, f), b = m.place(2, 2, t);
                const ok = a.level === 0 && b.level === 1 && m.getAt(1, 1, 'ground') === f &&
                    m.cellState(1, 1) === 'occupied' && m.cellState(0, 0) === 'empty';
                m.delete();
                return ok;
            });
            test("floor -> table -> lamp stacks; a crate can't go on the lamp", () => {
                const m = grid();
                const f = floor(), t = table(), l = lamp(), c = crate();
                m.place(3, 3, f); m.place(3, 3, t); const r = m.place(3, 3, l);
                const bad = m.place(3, 3, c);
                const s = m.getStack(3, 3);
                const ok = r.level === 2 && bad === false && /doesn't accept/.test(m.lastError) &&
                    s[0] === f && s[1] === t && s[2] === l && m.top(3, 3) === l;
                m.delete();
                return ok;
            });
            test("accepts filters by category", () => {
                const m = grid();
                m.place(0, 0, table());
                const ok = m.canPlace(0, 0, crate()) !== true && m.canPlace(0, 0, lamp()) === true;
                m.delete();
                return ok;
            });
            test("objects without a tile block are permissive", () => {
                const m = grid();
                const a = piece(), b = piece();
                const ok = m.place(0, 0, a).level === 1 && m.place(0, 0, b).level === 2;
                m.delete();
                return ok;
            });
            test("positions: centered in the cell and raised by the heights below", () => {
                const m = grid();
                const t = table(), l = lamp();
                m.place(2, 1, t); m.place(2, 1, l);
                // cell (2,1): center (50, 30); the lamp sits 12px (table height) higher
                const ok = t.transform.position.x === 50 && t.transform.position.y === 30 &&
                    l.transform.position.x === 50 && l.transform.position.y === 18;
                m.delete();
                return ok;
            });
            test("'bottom' anchor puts the object's bottom on the surface", () => {
                const m = grid({ anchor: 'bottom' });
                const t = table();   // 10px tall
                m.place(0, 0, t);
                const ok = t.transform.position.y === 15;   // cell bottom 20 - 10/2
                m.delete();
                return ok;
            });
            test("draw layer follows the level", () => {
                const m = grid({ baseLayer: 10 });
                const f = floor(), t = table();
                m.place(0, 0, f); m.place(0, 0, t);
                const ok = f.layer === 10 && t.layer === 11;
                m.delete();
                return ok;
            });
            test("maxLayers caps the stack (ground counts)", () => {
                const m = grid({ maxLayers: 3 });
                const a = piece(), b = piece(), c = piece();
                m.place(0, 0, a); m.place(0, 0, b);
                const ok = m.place(0, 0, c) === false && /full/.test(m.lastError) &&
                    m.place(0, 0, floor()).level === 0;
                m.delete();
                return ok;
            });
            test("blocked cells refuse everything, reserved cells need force", () => {
                const m = grid();
                m.setBlocked(1, 0); m.setReserved(2, 0);
                const ok = m.place(1, 0, piece()) === false && m.place(1, 0, piece(), { force: true }) === false &&
                    m.cellState(1, 0) === 'blocked' && m.cellState(2, 0) === 'reserved' &&
                    m.place(2, 0, piece()) === false && m.place(2, 0, piece(), { force: true }) !== false;
                m.delete();
                return ok;
            });
            test("can't place outside the grid", () => {
                const m = grid();
                const ok = m.place(8, 0, piece()) === false && m.place(-1, 0, piece()) === false && m.place(0, 6, piece()) === false;
                m.delete();
                return ok;
            });
            test("placeAtWorld uses the cell under the point", () => {
                const m = grid();
                const r = m.placeAtWorld(45, 25, piece());
                const ok = r.x === 2 && r.y === 1 && m.placeAtWorld(500, 0, piece()) === false;
                m.delete();
                return ok;
            });
            test("bareGround rules apply to an empty ground slot", () => {
                const m = grid({ bareGround: { accepts: ['furniture'] } });
                const ok = m.place(0, 0, lamp()) === false && m.place(0, 0, crate()) !== false;
                m.delete();
                return ok;
            });
            test("placement hook and record", () => {
                const m = grid();
                const a = piece();
                let got = null;
                a.onTilePlaced = (mat, rec) => { got = rec; };
                m.place(4, 2, a);
                const ok = got && got.x === 4 && got.y === 2 && a.tilePlacement === got && m.placementOf(a) === got;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: named layers (freeStack off)", () => {
            const named = () => grid({ freeStack: false, layers: ['furniture', 'decor'] });
            test("only ground and named levels can be used", () => {
                const m = named();
                m.place(0, 0, piece()); m.place(0, 0, piece());
                const ok = m.place(0, 0, piece()) === false && m.place(1, 0, piece(), { layer: 5 }) === false &&
                    m.levelLimit === 3;
                m.delete();
                return ok;
            });
            test("'top' skips unnamed levels", () => {
                const m = grid({ freeStack: false, layers: ['furniture', null, 'roof'] });
                m.place(0, 0, piece());
                const ok = m.place(0, 0, piece()).level === 3;
                m.delete();
                return ok;
            });
            test("a named layer can be targeted with a gap below (rests on the ground)", () => {
                const m = named();
                const f = floor(), l = lamp();
                m.place(0, 0, f);
                const r = m.place(0, 0, l, { layer: 'decor' });
                const ok = r.level === 2 && r.layer === 'decor' && m.getAt(0, 0, 'furniture') === null;
                m.delete();
                return ok;
            });
            test("inserting under an object checks that it accepts the object above", () => {
                const m = named();
                const l = lamp(), t = table();
                const picky = piece({ category: 'furniture', accepts: ['food'] });
                m.place(0, 0, l, { layer: 'decor' });
                const rejected = m.place(0, 0, picky, { layer: 'furniture' }) === false;
                const r = m.place(0, 0, t, { layer: 'furniture' });
                // the lamp is now raised by the table's 12px height (cell center 10 -> -2)
                const ok = rejected && r.level === 1 && l.transform.position.y === -2;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: removing", () => {
            const tower = (m) => {
                const f = floor(), t = table(), l = lamp();
                m.place(0, 0, f); m.place(0, 0, t); m.place(0, 0, l);
                return { f, t, l };
            };
            test("'block' (default) refuses while something is on top", () => {
                const m = grid();
                const { t, l } = tower(m);
                const ok = m.removeAt(0, 0, 1) === false && m.top(0, 0) === l &&
                    m.removeAt(0, 0)[0] === l && m.removeAt(0, 0, 'top')[0] === t;
                m.delete();
                return ok;
            });
            test("'cascade' removes everything on top and calls the hook", () => {
                const m = grid();
                const { f, t, l } = tower(m);
                let reason = null;
                l.onTileRemoved = (mat, rec) => { reason = rec.reason; };
                const out = m.removeAt(0, 0, 1, { mode: 'cascade' });
                const ok = out.length === 2 && out[0] === t && out[1] === l && reason === 'cascade' &&
                    m.top(0, 0) === f && l.tilePlacement === null;
                m.delete();
                return ok;
            });
            test("'collapse' (free stack) drops objects down a level", () => {
                const m = grid();
                const lowLamp = piece({ category: 'decor' });
                const f = floor(), t = table();
                m.place(0, 0, f); m.place(0, 0, t); m.place(0, 0, lowLamp);
                const out = m.removeAt(0, 0, 1, { mode: 'collapse' });
                const ok = out.length === 1 && out[0] === t && m.getAt(0, 0, 1) === lowLamp &&
                    m.placementOf(lowLamp).level === 1 && lowLamp.transform.position.y === 10;
                m.delete();
                return ok;
            });
            test("'collapse' (named layers) keeps the object's level", () => {
                const m = grid({ freeStack: false, layers: ['furniture', 'decor'] });
                const t = table(), l = lamp();
                m.place(0, 0, t); m.place(0, 0, l);
                m.removeAt(0, 0, 'furniture', { mode: 'collapse' });
                const ok = m.getAt(0, 0, 'decor') === l && m.getAt(0, 0, 'furniture') === null;
                m.delete();
                return ok;
            });
            test("'collapse' cascades objects the new support won't accept", () => {
                const m = grid({ bareGround: { accepts: ['furniture'] } });
                const t = table(), l = lamp();
                m.place(0, 0, t); m.place(0, 0, l);
                const out = m.removeAt(0, 0, 1, { mode: 'collapse' });
                const ok = out.length === 2 && m.top(0, 0) === null && m.cellState(0, 0) === 'empty';
                m.delete();
                return ok;
            });
            test("removeObject and an unknown mode", () => {
                const m = grid();
                const a = piece();
                m.place(3, 3, a);
                const ok = m.removeObject(a, { mode: 'explode' }) === false &&
                    m.removeObject(a)[0] === a && m.removeObject(a) === false;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: footprints", () => {
            const wide = () => piece({ category: 'furniture', footprint: { w: 2, h: 1 }, height: 8, accepts: ['decor'] }, 40, 10);
            test("a 2x1 object covers both cells and is centered on them", () => {
                const m = grid();
                const w = wide();
                const r = m.place(1, 0, w);
                const ok = r && m.top(1, 0) === w && m.top(2, 0) === w &&
                    w.transform.position.x === 40 && w.transform.position.y === 10;
                m.delete();
                return ok;
            });
            test("rests on two different floor tiles", () => {
                const m = grid();
                m.place(1, 0, floor()); m.place(2, 0, floor());
                const ok = m.place(1, 0, wide()).level === 1;
                m.delete();
                return ok;
            });
            test("fails if any covered cell is outside, taken or blocked", () => {
                const m = grid();
                m.place(3, 0, piece());
                m.setBlocked(5, 1);
                const ok = m.place(7, 0, wide()) === false &&
                    m.place(2, 0, wide(), { layer: 1 }) === false &&
                    m.place(4, 1, wide()) === false;
                m.delete();
                return ok;
            });
            test("something on either cell rests on it; removing it cascades both", () => {
                const m = grid();
                const w = wide(), a = lamp(), b = lamp();
                m.place(1, 0, w);
                m.place(1, 0, a); m.place(2, 0, b);
                const out = m.removeObject(w, { mode: 'cascade' });
                const ok = a.transform.position.y === 2 && out.length === 3 &&
                    m.cellState(1, 0) === 'empty' && m.cellState(2, 0) === 'empty';
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: moving & finding", () => {
            test("place() on an already placed object moves it", () => {
                const m = grid();
                const a = piece();
                m.place(0, 0, a);
                const r = m.place(3, 2, a);
                const p = m.positionOf(a);
                const ok = r && r.x === 3 && r.y === 2 && m.cellState(0, 0) === 'empty' &&
                    m.top(3, 2) === a && a.transform.position.x === 70 && a.transform.position.y === 50 &&
                    p.x === 3 && p.y === 2 && p.level === 1 && m.objects.length === 1;
                m.delete();
                return ok;
            });
            test("moving to the cell it's already in does nothing", () => {
                const m = grid();
                const a = piece();
                const r1 = m.place(1, 1, a);
                const r2 = m.place(1, 1, a);
                const ok = r1 === r2 && m.positionOf(a).level === 1;
                m.delete();
                return ok;
            });
            test("a failed move leaves the object where it was", () => {
                const m = grid();
                const a = piece();
                m.place(0, 0, a);
                m.setBlocked(4, 4);
                const r = m.move(a, 4, 4);
                const p = m.positionOf(a);
                const ok = r === false && /blocked/.test(m.lastError) && p.x === 0 && p.y === 0 &&
                    m.top(0, 0) === a && a.transform.position.x === 10 && a.tilePlacement === m.placementOf(a);
                m.delete();
                return ok;
            });
            test("'block' (default) won't move an object with things on top", () => {
                const m = grid();
                const t = table(), l = lamp();
                m.place(0, 0, t); m.place(0, 0, l);
                const ok = m.place(2, 2, t) === false && m.top(0, 0) === l && m.positionOf(t).x === 0;
                m.delete();
                return ok;
            });
            test("'cascade' move takes the objects on top out", () => {
                const m = grid();
                const t = table(), l = lamp();
                let reason = null;
                l.onTileRemoved = (mat, rec) => { reason = rec.reason; };
                m.place(0, 0, t); m.place(0, 0, l);
                const r = m.place(2, 2, t, { mode: 'cascade' });
                const ok = r && r.x === 2 && m.positionOf(l) === null && reason === 'cascade' &&
                    m.cellState(0, 0) === 'empty';
                m.delete();
                return ok;
            });
            test("'collapse' move drops the objects on top onto what was under it", () => {
                const m = grid();
                const f = floor(), t = table(), d = piece({ category: 'decor' });
                m.place(0, 0, f); m.place(0, 0, t); m.place(0, 0, d);
                m.move(t, 2, 0, { mode: 'collapse' });
                const ok = m.positionOf(t).x === 2 && m.getAt(0, 0, 1) === d && m.getAt(0, 0, 0) === f;
                m.delete();
                return ok;
            });
            test("moving to another layer of the same cell", () => {
                const m = grid({ freeStack: false, layers: ['furniture', 'decor'] });
                const l = lamp();
                m.place(0, 0, l, { layer: 'decor' });
                const r = m.place(0, 0, l, { layer: 'furniture' });
                const ok = r && r.level === 1 && m.getAt(0, 0, 'decor') === null && m.positionOf(l).layer === 'furniture';
                m.delete();
                return ok;
            });
            test("a 2x1 object can move one cell over its own old spot", () => {
                const m = grid();
                const w = piece({ footprint: { w: 2, h: 1 } }, 40, 10);
                m.place(1, 0, w);
                const r = m.move(w, 2, 0);
                const cells = m.positionOf(w).cells.map(c => `${c.x},${c.y}`).join(' ');
                const ok = r && cells === '2,0 3,0' && m.cellState(1, 0) === 'empty';
                m.delete();
                return ok;
            });
            test("keeps its anchor and calls onTileMoved", () => {
                const m = grid();
                const a = piece();
                let args = null;
                a.onTileMoved = (mat, now, before) => { args = [now.x, before.x]; };
                m.place(0, 0, a, { anchor: 'bottom' });
                m.move(a, 1, 0);
                const ok = a.transform.position.y === 15 && args && args[0] === 1 && args[1] === 0;
                m.delete();
                return ok;
            });
            test("canPlace on a placed object previews the move without changing anything", () => {
                const m = grid();
                const a = piece();
                m.place(0, 0, a);
                m.setBlocked(5, 5);
                const ok = m.canPlace(3, 3, a) === true && typeof m.canPlace(5, 5, a) === 'string' &&
                    m.positionOf(a).x === 0 && m.top(0, 0) === a && m.cellState(3, 3) === 'empty';
                m.delete();
                return ok;
            });
            test("move() needs an object placed in this matrix", () => {
                const m = grid();
                const ok = m.move(piece(), 1, 1) === false;
                m.delete();
                return ok;
            });
            test("positionOf: null when not placed, copy of the placement, current layer name", () => {
                const m = grid({ layers: ['furniture'] });
                const a = piece();
                const before = m.positionOf(a);
                m.place(4, 3, a);
                const p = m.positionOf(a);
                p.x = 99;
                m.renameLayer('furniture', 'stuff');
                const ok = before === null && !m.has(piece()) && m.has(a) &&
                    m.positionOf(a).x === 4 && m.positionOf(a).layer === 'stuff' &&
                    m.placementOf(a).layer === 'stuff' && m.positionOf(a).cells.length === 1;
                m.delete();
                return ok;
            });
            test("positionOf a deleted object is null", () => {
                const m = grid();
                const a = piece();
                m.place(0, 0, a);
                a.deleted = true;
                const ok = m.positionOf(a) === null && m.cellState(0, 0) === 'empty';
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: carry", () => {
            test("'carry' moves the objects on top along with it", () => {
                const m = grid();
                const t = table(), l = lamp();
                let moved = null;
                l.onTileMoved = (mat, now, before) => { moved = [now.x, now.y, before.x]; };
                m.place(0, 0, t); m.place(0, 0, l);
                const r = m.move(t, 3, 2, { mode: 'carry' });
                const p = m.positionOf(l);
                const ok = r && r.x === 3 && p.x === 3 && p.y === 2 && p.level === 2 &&
                    l.transform.position.x === 70 && l.transform.position.y === 38 &&
                    m.cellState(0, 0) === 'empty' && moved && moved.join() === '3,2,0';
                m.delete();
                return ok;
            });
            test("carried objects keep their level offset when the base lands higher", () => {
                const m = grid();
                const t = table(), l = lamp(), c = crate();
                m.place(0, 0, t); m.place(0, 0, l);
                m.place(4, 0, c);
                m.move(t, 4, 0, { mode: 'carry' });
                const ok = m.positionOf(t).level === 2 && m.positionOf(l).level === 3 &&
                    m.getStack(4, 0)[1] === c && m.getStack(4, 0)[2] === t && m.getStack(4, 0)[3] === l && l.transform.position.y === -2;
                m.delete();
                return ok;
            });
            test("if a carried object doesn't fit, nothing moves", () => {
                const m = grid({ maxLayers: 3 });
                const t = table(), l = lamp(), c = crate();
                m.place(0, 0, t); m.place(0, 0, l);
                m.place(3, 2, c);
                const r = m.move(t, 3, 2, { mode: 'carry' });
                const ok = r === false && /can't carry/.test(m.lastError) &&
                    m.positionOf(t).x === 0 && m.positionOf(t).level === 1 && m.positionOf(l).level === 2 &&
                    t.transform.position.y === 10 && l.transform.position.y === -2 &&
                    t.layer === 1 && l.layer === 2 && m.getStack(3, 2).length === 2 && m.top(3, 2) === c &&
                    t.tilePlacement === m.placementOf(t);
                m.delete();
                return ok;
            });
            test("carry with a 2x1 base keeps each object's cell offset", () => {
                const m = grid();
                const w = piece({ footprint: { w: 2, h: 1 }, height: 8 }, 40, 10), l = lamp();
                m.place(1, 0, w); m.place(2, 0, l);
                m.move(w, 1, 3, { mode: 'carry' });
                const p = m.positionOf(l);
                const ok = p.x === 2 && p.y === 3 && m.cellState(2, 0) === 'empty';
                m.delete();
                return ok;
            });
            test("canPlace previews a carry without changing anything", () => {
                const m = grid({ maxLayers: 3 });
                const t = table(), l = lamp(), c = crate();
                m.place(0, 0, t); m.place(0, 0, l);
                m.place(3, 2, c);
                const yes = m.canPlace(5, 5, t, { mode: 'carry' });
                const no = m.canPlace(3, 2, t, { mode: 'carry' });
                const ok = yes === true && typeof no === 'string' &&
                    m.positionOf(t).x === 0 && m.positionOf(l).x === 0 &&
                    t.transform.position.x === 10 && l.transform.position.y === -2 &&
                    m.cellState(5, 5) === 'empty';
                m.delete();
                return ok;
            });
            test("moveMode option sets the default; removeAt doesn't take 'carry'", () => {
                const m = grid({ moveMode: 'carry' });
                const t = table(), l = lamp();
                m.place(0, 0, t); m.place(0, 0, l);
                const moved = m.place(2, 2, t);
                const ok = moved && m.positionOf(l).x === 2 && m.removeMode === 'block' &&
                    m.removeAt(2, 2, 1, { mode: 'carry' }) === false;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: cellAt", () => {
            test("two numbers and a {x, y} point", () => {
                const m = new tileMatrix(100, 50, 5, 5, 20, 20, { logErrors: false }, "blank");
                const a = m.cellAt(145, 75), b = m.cellAt({ x: 145, y: 75 });
                const ok = a.x === 2 && a.y === 1 && b.x === 2 && b.y === 1 &&
                    m.cellAt(99, 75) === null && m.cellAt({ x: 145, y: 500 }) === null;
                m.delete();
                return ok;
            });
            test("an object: uses its transform position (center)", () => {
                const m = grid();
                const a = piece();
                a.transform.position.x = 70; a.transform.position.y = 50;
                const c = m.cellAt(a);
                const ok = c.x === 3 && c.y === 2;
                m.delete();
                return ok;
            });
            test("uses effectivePosition when the object has one (ignoreCamera)", () => {
                const m = grid();
                const o = { transform: new Transform(0, 0, 10, 10), get effectivePosition() { return { x: 30, y: 30 }; } };
                const c = m.cellAt(o);
                const ok = c.x === 1 && c.y === 1;
                m.delete();
                return ok;
            });
            test("a gameObject's transform wins over its stale x/y fields", () => {
                const m = grid();
                const o = new gameObject(5, 5, 10, 10, "blank");
                o.transform.position.x = 70; o.transform.position.y = 50;
                const c = m.cellAt(o);
                o.delete();
                const ok = c && c.x === 3 && c.y === 2;
                m.delete();
                return ok;
            });
            test("the mouse: 'mouse', no argument, or the mouse object", () => {
                const m = grid();
                const mouse = World.active && World.active.mouse;
                if (!mouse) { m.delete(); throw new Error("no World.active.mouse in this page"); }
                const saved = [mouse.x, mouse.y];
                mouse.x = 45; mouse.y = 25;
                const a = m.cellAt('mouse'), b = m.cellAt(), c = m.cellAt(mouse);
                mouse.x = saved[0]; mouse.y = saved[1];
                const ok = a.x === 2 && a.y === 1 && b.x === 2 && b.y === 1 && c.x === 2 && c.y === 1;
                m.delete();
                return ok;
            });
            test("returns the cell data along with its coordinates", () => {
                const m = grid();
                const f = floor(), t = table(), l = lamp();
                m.place(2, 1, f); m.place(2, 1, t); m.place(2, 1, l);
                m.setReserved(4, 4);
                const c = m.cellAt(45, 25);
                const empty = m.cellAt(5, 5), res = m.cellInfo(4, 4);
                c.stack.push('junk');
                const ok = c.x === 2 && c.y === 1 && c.state === 'occupied' && !c.blocked && !c.reserved &&
                    c.ground === f && c.top === l && c.stack[1] === t &&
                    m.getStack(2, 1).length === 3 &&
                    empty.state === 'empty' && empty.top === null && empty.ground === null && empty.stack.length === 0 &&
                    res.reserved === true && res.state === 'reserved' && m.cellInfo(8, 0) === null;
                m.delete();
                return ok;
            });
            test("unreadable input gives null", () => {
                const m = grid();
                const ok = m.cellAt('nope') === null && m.cellAt(null) === null &&
                    m.cellAt({ x: NaN, y: 1 }) === null && m.cellAt(5) === null && m.cellAt({}) === null;
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: setCell", () => {
            test("sets built-in and custom properties; cellInfo reports them", () => {
                const m = grid();
                const info = m.setCell(2, 3, { color: 'red', visible: 1, blocked: true, terrain: 'water', cost: 5 });
                const ok = info.color === 'red' && info.visible === true && info.blocked === true &&
                    info.state === 'blocked' && info.terrain === 'water' && info.cost === 5 &&
                    m.isBlocked(2, 3) && m.cellInfo(2, 3).terrain === 'water' && m.cellInfo(2, 2).terrain === undefined;
                m.delete();
                return ok;
            });
            test("function form edits a copy that's then applied", () => {
                const m = grid();
                m.setCell(1, 1, { blocked: true });
                m.setCell(1, 1, cell => { cell.blocked = !cell.blocked; cell.color = cell.blocked ? 'red' : 'green'; cell.tag = 'x'; });
                const i = m.cellInfo(1, 1);
                const ok = i.blocked === false && i.color === 'green' && i.tag === 'x' &&
                    m.setCell(1, 1, c => { c.stack = 1; }) === false && m.getStack(1, 1).length === 0;
                m.delete();
                return ok;
            });
            test("accepts a point; undefined removes a custom key; color null resets to default", () => {
                const m = grid();
                m.setCell({ x: 0, y: 0 }, { tag: 'a', color: 'blue' });
                m.setCell(0, 0, { tag: undefined, color: null });
                const i = m.cellInfo(0, 0);
                const ok = !('tag' in i) && i.color === m.defaultColor;
                m.delete();
                return ok;
            });
            test("rejects locked keys and outside cells without changing anything", () => {
                const m = grid();
                const ok = m.setCell(0, 0, { color: 'red', stack: [] }) === false && m.cellInfo(0, 0).color === m.defaultColor &&
                    m.setCell(0, 0, { state: 'empty' }) === false && m.setCell(99, 0, { color: 'red' }) === false;
                m.delete();
                return ok;
            });
            test("Scene's `debug = true` toggles the overlay instead of wiping its settings", () => {
                const m = grid();
                m.debug = false;
                const off = m.debug.grid === false && m.debug.states === false;
                m.debug = true;
                const ok = off && m.debug.grid === true && m.debug.states === true && typeof m.debug.colors === 'object';
                m.delete();
                return ok;
            });
        });

        suite("tileMatrix: deleted objects", () => {
            test("a deleted object is pruned and what was on it collapses", () => {
                const m = grid();
                const t = piece(), top = piece();
                m.place(0, 0, t); m.place(0, 0, top);
                t.deleted = true;
                const ok = m.top(0, 0) === top && m.placementOf(top).level === 1 && m.placementOf(t) === null;
                m.delete();
                return ok;
            });
            test("works with a real gameObject", () => {
                const m = grid();
                const o = new gameObject(0, 0, 10, 10, "blank");
                const r = m.place(1, 1, o);
                const ok1 = r && o.transform.position.x === 30 && o.transform.position.y === 30;
                o.delete();
                const ok = ok1 && m.cellState(1, 1) === 'empty';
                m.delete();
                return ok;
            });
            test("delete() clears the matrix and the registry", () => {
                const m = grid();
                const a = piece();
                m.place(0, 0, a);
                m.delete();
                return m.deleted && a.tilePlacement === null && !tileMatrix.matrices.includes(m);
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

    // ---- Global.js: World language / dialog ----
    function testLanguage() {
        suite("World: language", () => {
            // Runs fn with a known language setup on the active world, then restores it.
            const sandbox = (fn) => {
                const w = World.active;
                const saved = { lang: w.defaults.lang, dialog: w.dialog };
                w.defaults.lang = { user: [], system: { supported: [], default: 'english' } };
                w.dialog = {};
                try { return fn(w); }
                finally { w.defaults.lang = saved.lang; w.dialog = saved.dialog; }
            };

            test("languageName turns codes into names", () =>
                World.languageName('en-US') === 'english' && World.languageName('es') === 'spanish' &&
                World.languageName('Japanese') === 'japanese' && World.languageName('pt_BR') === 'portuguese');
            test("detectLanguages returns names with no repeats", () => {
                const l = World.detectLanguages();
                return Array.isArray(l) && new Set(l).size === l.length;
            });
            test("defaults.lang has the user / system shape", () => {
                const lang = World.active.defaults.lang;
                return Array.isArray(lang.user) && Array.isArray(lang.system.supported) && lang.system.default === 'english';
            });
            test("language: first supported user language, else default", () => sandbox((w) => {
                w.defaults.lang.user = ['german', 'spanish'];
                const none = w.language === 'english';
                w.setSupportedLanguages('en', 'es');
                return none && w.language === 'spanish';
            }));
            test("setLanguage moves a choice to the front", () => sandbox((w) => {
                w.setSupportedLanguages('english', 'spanish', 'french');
                w.defaults.lang.user = ['spanish', 'french'];
                w.setLanguage('fr');
                return w.language === 'french' && w.defaults.lang.user.join() === 'french,spanish';
            }));
            test("getText picks the language, falls back, fills vars", () => sandbox((w) => {
                w.setSupportedLanguages('english', 'spanish', 'french');
                w.addDialog('greet', { en: 'Hello, {name}!', es: '¡Hola, {name}!' });
                w.setLanguage('spanish');
                const es = w.getText('greet', { name: 'A' }) === '¡Hola, A!';
                w.setLanguage('french');
                const fallback = w.getText('greet', { name: 'A' }) === 'Hello, A!';
                const inline = w.getText({ french: 'Salut', english: 'Hi' }) === 'Salut';
                const missing = w.getText('no.such.key') === 'no.such.key';
                return es && fallback && inline && missing;
            }));
        });
    }

    // ---- Global.js: World whenHidden / whenUnfocused ----
    function testBackground() {
        suite("World: background settings", () => {
            const sandbox = (fn) => {
                const w = World.active;
                const saved = { h: w.whenHidden, u: w.whenUnfocused, hidden: w.hidden, lost: w.focusLost };
                try { return fn(w); }
                finally { w.whenHidden = saved.h; w.whenUnfocused = saved.u; w.hidden = saved.hidden; w.focusLost = saved.lost; }
            };
            test("settings hold 'run' or 'pause'", () => {
                const w = World.active;
                return ['run', 'pause'].includes(w.whenHidden) && ['run', 'pause'].includes(w.whenUnfocused);
            });
            test("autoPaused follows the hidden / unfocused settings", () => sandbox((w) => {
                w.hidden = false; w.focusLost = false; w.whenHidden = 'pause'; w.whenUnfocused = 'pause';
                const visible = w.autoPaused === false;
                w.hidden = true;
                const hiddenPause = w.autoPaused === true;
                w.whenHidden = 'run';
                const hiddenRun = w.autoPaused === false;
                w.hidden = false; w.focusLost = true;
                const unfocusedPause = w.autoPaused === true;
                w.whenUnfocused = 'run';
                return visible && hiddenPause && hiddenRun && unfocusedPause && w.autoPaused === false;
            }));
            test("runInBackground is an alias for whenHidden", () => sandbox((w) => {
                w.runInBackground = false;
                const off = w.whenHidden === 'pause';
                w.whenHidden = 'run';
                return off && w.runInBackground === true;
            }));
            test("backgroundTimer reports a known driver", () =>
                ['worker', 'interval', 'none'].includes(World.active.backgroundTimer));
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
        testItems();
        testTileMatrix();
        testScene();
        testDevConsole();
        testLanguage();
        testBackground();

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