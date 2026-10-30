// ============================================================
// helperFunctions.js
// ------------------------------------------------------------
// Pure math / geometry utilities used by the collision system.
// No p5 dependencies, no DOM dependencies - safe to load in
// Node for the Unit Test runner.
// ============================================================

// ============================================
// SLOPE / ANGLE HELPERS
// ============================================

/**
 * Robustly computes the slope between two points. Accepts
 * either point objects ({x,y}) or bare numbers, in any
 * combination. Returns 0 for vertical/invalid input instead
 * of Infinity/NaN.
 */
function findSlope(x1, y1, x2, y2) {
    var r = 0;
    switch (typeof x1) {
        case 'object':
            if (typeof y1 == 'object') {
                r = (x1.y - y1.y) / (x1.x - y1.x);
            } else if (typeof y1 == 'number') {
                r = (x1.y - x2) / (x1.x - y1);
            }
            break; // NOTE: original had missing break here (fallthrough)
        case 'number':
            if (typeof y1 == 'number') {
                if (typeof x2 == 'object') {
                    r = (y1 - x2.y) / (x1 - x2.x);
                } else if (typeof x2 == 'number') {
                    r = (y1 - y2) / (x1 - x2);
                }
            }
            break;
        default:
            r = 0;
            console.log(`Error: Invalid parameter types`);
    }
    return isNaN(r) ? 0 : r;
}

function radiansToDegrees(radians) { return radians * (180 / Math.PI); }
function degreesToRadians(degrees) { return degrees * (Math.PI / 180); }

// ============================================
// POINT-ON / POINT-IN TESTS
// ============================================
function pos_add(pos, dx, dy) {
    pos.x += dx;
    pos.y += dy;
}
/**
 * Returns the point on segment p1-p2 nearest to `point`.
 */
function closestPointOnSegment(point, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: p1.x, y: p1.y };
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: p1.x + t * dx, y: p1.y + t * dy };
}

/**
 * Barycentric-style sign test: point is inside triangle if
 * all three edge signs match (or are zero).
 */
function pointInTriangle(px, py, v1, v2, v3) {
    const d1 = sign(px, py, v1.x, v1.y, v2.x, v2.y);
    const d2 = sign(px, py, v2.x, v2.y, v3.x, v3.y);
    const d3 = sign(px, py, v3.x, v3.y, v1.x, v1.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
}

/** 2D cross-product sign helper used by point-in-triangle. */
function sign(px, py, x1, y1, x2, y2) {
    return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

/**
 * Returns the signed perpendicular offset between two parallel
 * segments, or `false` if they aren't parallel. Used to detect
 * "sandwiched" collisions on rect/triangle edges.
 */
function getParallelDistance(p1, p2, p3, p4) {
    let dx1 = p2.x - p1.x;
    let dy1 = p2.y - p1.y;
    let dx2 = p4.x - p3.x;
    let dy2 = p4.y - p3.y;

    let len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    let len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 === 0 || len2 === 0) return false;

    let nx1 = dx1 / len1, ny1 = dy1 / len1;
    let nx2 = dx2 / len2, ny2 = dy2 / len2;

    let cross = nx1 * ny2 - ny1 * nx2;
    const tolerance = 0.0001;

    if (Math.abs(cross) >= tolerance) return false;

    let perpX = -ny1;
    let perpY = nx1;

    let vx = p3.x - p1.x;
    let vy = p3.y - p1.y;
    let offset = vx * perpX + vy * perpY;

    return offset;
}

// ============================================
// SEGMENT / RAY TESTS
// ============================================

/** True if segments p1-p2 and p3-p4 intersect (incl. touching). */
function segmentsIntersect(p1, p2, p3, p4) {
    let d1 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
    let d2 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
    let d3 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    let d4 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }

    if (d1 === 0 && pointOnSegment(p3, p1, p2)) return true;
    if (d2 === 0 && pointOnSegment(p4, p1, p2)) return true;
    if (d3 === 0 && pointOnSegment(p1, p3, p4)) return true;
    if (d4 === 0 && pointOnSegment(p2, p3, p4)) return true;

    return false;
}

/** Shortest distance from `point` to segment p1-p2. */
function pointToSegmentDistance(point, p1, p2) {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let fx = point.x - p1.x;
    let fy = point.y - p1.y;

    let lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) return Math.sqrt(fx * fx + fy * fy);

    let t = Math.max(0, Math.min(1, (fx * dx + fy * dy) / lineLenSq));
    let closestX = p1.x + t * dx;
    let closestY = p1.y + t * dy;

    let distX = point.x - closestX;
    let distY = point.y - closestY;
    return Math.sqrt(distX * distX + distY * distY);
}

/** True if `point` lies within the axis-aligned bounds of p1-p2. */
function pointOnSegment(point, p1, p2) {
    let minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
    let minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
    return point.x >= minX && point.x <= maxX &&
           point.y >= minY && point.y <= maxY;
}

/** Standard even-odd raycast point-in-polygon test. */
function pointInPolygon(point, vertices) {
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = (yi > point.y) !== (yj > point.y) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ============================================
// SEGMENT / CIRCLE TESTS
// ============================================

function segmentIntersectsCircle(p1, p2, circleCenter, circleRadius) {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let fx = circleCenter.x - p1.x;
    let fy = circleCenter.y - p1.y;

    let lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) {
        let distSq = fx * fx + fy * fy;
        return distSq <= circleRadius * circleRadius;
    }

    let t = (fx * dx + fy * dy) / lineLenSq;
    let clampedT = Math.max(0, Math.min(1, t));

    let closestX = p1.x + clampedT * dx;
    let closestY = p1.y + clampedT * dy;

    let distX = circleCenter.x - closestX;
    let distY = circleCenter.y - closestY;
    return (distX * distX + distY * distY) <= circleRadius * circleRadius;
}

function getSegmentCircleIntersections(p1, p2, circleCenter, circleRadius) {
    let dx = p2.x - p1.x, dy = p2.y - p1.y;
    let fx = p1.x - circleCenter.x, fy = p1.y - circleCenter.y;

    let a = dx * dx + dy * dy;
    let b = 2 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - circleRadius * circleRadius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    if (discriminant === 0) {
        let t = -b / (2 * a);
        if (t >= 0 && t <= 1) return [{ x: p1.x + t * dx, y: p1.y + t * dy }];
        return [];
    }

    let sqrtDisc = Math.sqrt(discriminant);
    let t1 = (-b - sqrtDisc) / (2 * a);
    let t2 = (-b + sqrtDisc) / (2 * a);

    let intersections = [];
    if (t1 >= 0 && t1 <= 1) intersections.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    if (t2 >= 0 && t2 <= 1) intersections.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    return intersections;
}

/**
 * Full report for a segment-vs-circle test: intersection points,
 * their angles, and the arc percentage covered.
 */
function getCircleIntersectionInfo(p1, p2, circleCenter, circleRadius) {
    let intersects = segmentIntersectsCircle(p1, p2, circleCenter, circleRadius);

    if (!intersects) {
        return {
            intersects: false, points: [], angles: [],
            arcPercentage: 0, arcLength: 0,
            arcStartAngle: 0, arcEndAngle: 0,
            arcStartDegrees: 0, arcEndDegrees: 0
        };
    }

    let points = getSegmentCircleIntersections(p1, p2, circleCenter, circleRadius);
    let angles = points.map(p => Math.atan2(p.y - circleCenter.y, p.x - circleCenter.x));
    let anglesDeg = points.map(p => radiansToDegrees(Math.atan2(p.y - circleCenter.y, p.x - circleCenter.x)));

    let arcPercentage = 0, arcLength = 0;
    let arcStartAngle = 0, arcEndAngle = 0;
    let arcStartDeg = 0, arcEndDeg = 0;

    if (points.length === 2) {
        let angle1 = ((angles[0] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        let angle2 = ((angles[1] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        let sortedAngles = [angle1, angle2].sort((a, b) => a - b);

        let diff = Math.abs(sortedAngles[1] - sortedAngles[0]);
        let arcAngle = Math.min(diff, 2 * Math.PI - diff);

        if (diff <= 2 * Math.PI - diff) {
            arcStartAngle = sortedAngles[0];
            arcEndAngle = sortedAngles[1];
        } else {
            arcStartAngle = sortedAngles[1];
            arcEndAngle = sortedAngles[0] + 2 * Math.PI;
        }

        // Keep the reported arc to <= half the circle.
        if (arcEndAngle - arcStartAngle > Math.PI) {
            let temp = arcStartAngle;
            arcStartAngle = arcEndAngle;
            arcEndAngle = temp + 2 * Math.PI;
        }

        arcPercentage = (arcEndAngle - arcStartAngle) / (2 * Math.PI);
        arcLength = (arcEndAngle - arcStartAngle) * circleRadius;
        arcStartDeg = radiansToDegrees(arcStartAngle);
        arcEndDeg = radiansToDegrees(arcEndAngle);
    }

    for (let k in points) {
        points[k].angle = anglesDeg[k];
        points[k].angleRad = angles[k];
    }

    return {
        intersects: true,
        points: points,
        angles: anglesDeg,
        anglesRadians: angles,
        arcPercentage: Math.round(arcPercentage * 10000) / 10000,
        arcLength: Math.round(arcLength * 100) / 100,
        arcStartAngle: arcStartAngle,
        arcEndAngle: arcEndAngle,
        arcStartDegrees: Math.round(arcStartDeg * 100) / 100,
        arcEndDegrees: Math.round(arcEndDeg * 100) / 100
    };
}

/** Wraps a triangle hitbox's vertices into the generic shape-circle test. */
function getTriangleCircleIntersectionInfo(triangleHitbox, circleCenter, circleRadius) {
    if (!triangleHitbox || triangleHitbox.shape !== 'triangle') {
        return {
            intersects: false, points: [], edgeIntersections: [],
            verticesInside: [], circleCenterInside: false,
            circleFullyInside: false, arcPercentage: 0, arcLength: 0,
            arcStartAngle: 0, arcEndAngle: 0,
            arcStartDegrees: 0, arcEndDegrees: 0,
            details: 'Not a triangle hitbox'
        };
    }

    let vertices = triangleHitbox.getTriangleVertices();
    if (!vertices || vertices.length !== 3) {
        return {
            intersects: false, points: [], edgeIntersections: [],
            verticesInside: [], circleCenterInside: false,
            circleFullyInside: false, arcPercentage: 0, arcLength: 0,
            arcStartAngle: 0, arcEndAngle: 0,
            arcStartDegrees: 0, arcEndDegrees: 0,
            details: 'Invalid triangle vertices'
        };
    }

    return getShapeCircleIntersectionInfo(circleCenter, circleRadius, ...vertices);
}

// ============================================
// ELLIPSE COLLISION UTILITIES
// ============================================

function ellipseRectCollision(ellipseCenter, rx, ry, rectVertices) {
    let closestX = Math.max(rectVertices[0].x, Math.min(ellipseCenter.x, rectVertices[2].x));
    let closestY = Math.max(rectVertices[0].y, Math.min(ellipseCenter.y, rectVertices[2].y));
    let dx = closestX - ellipseCenter.x;
    let dy = closestY - ellipseCenter.y;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

function pointInEllipse(px, py, ellipseCenter, rx, ry) {
    let dx = px - ellipseCenter.x;
    let dy = py - ellipseCenter.y;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

function ellipseCircleCollision(ellipseCenter, rx, ry, circleCenter, circleRadius) {
    let dx = circleCenter.x - ellipseCenter.x;
    let dy = circleCenter.y - ellipseCenter.y;

    // Fast accept: circle center inside ellipse.
    let scaledX = dx / rx, scaledY = dy / ry;
    if (Math.sqrt(scaledX * scaledX + scaledY * scaledY) <= 1) return true;

    let closest = closestPointOnEllipse(rx, ry, dx, dy);
    let ddx = dx - closest.x, ddy = dy - closest.y;
    return (ddx * ddx + ddy * ddy) <= circleRadius * circleRadius;
}

/**
 * Closest point on an axis-aligned ellipse (centered at origin,
 * semi-axes rx/ry) to an external point (px, py) already in the
 * ellipse's local frame. Uses bisection on the derivative of the
 * squared-distance function restricted to one quadrant - that
 * derivative is monotonic there, so this converges for any rx, ry,
 * unlike a Newton iteration which can diverge near degenerate cases.
 */
function closestPointOnEllipse(rx, ry, px, py) {
    let sx = px < 0 ? -1 : 1;
    let sy = py < 0 ? -1 : 1;
    let x = Math.abs(px), y = Math.abs(py);

    function g(theta) {
        let cosT = Math.cos(theta), sinT = Math.sin(theta);
        return (ry * ry - rx * rx) * sinT * cosT + rx * x * sinT - ry * y * cosT;
    }

    let lo = 0, hi = Math.PI / 2;
    for (let i = 0; i < 40; i++) {
        let mid = (lo + hi) / 2;
        if (g(mid) < 0) lo = mid; else hi = mid;
    }
    let theta = (lo + hi) / 2;

    return {
        x: sx * rx * Math.cos(theta),
        y: sy * ry * Math.sin(theta),
    };
}

function ellipseEllipseCollision(e1Center, rx1, ry1, e2Center, rx2, ry2) {
    let dx = e2Center.x - e1Center.x;
    let dy = e2Center.y - e1Center.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > rx1 + rx2 + ry1 + ry2) return false;

    // Sample points on first ellipse.
    const numPoints = 72;
    for (let i = 0; i < numPoints; i++) {
        let theta = (i / numPoints) * 2 * Math.PI;
        let px = e1Center.x + rx1 * Math.cos(theta);
        let py = e1Center.y + ry1 * Math.sin(theta);
        let dx2 = px - e2Center.x, dy2 = py - e2Center.y;
        if ((dx2 * dx2) / (rx2 * rx2) + (dy2 * dy2) / (ry2 * ry2) <= 1) return true;
    }

    // Sample points on second ellipse.
    for (let i = 0; i < numPoints; i++) {
        let theta = (i / numPoints) * 2 * Math.PI;
        let px = e2Center.x + rx2 * Math.cos(theta);
        let py = e2Center.y + ry2 * Math.sin(theta);
        let dx2 = px - e1Center.x, dy2 = py - e1Center.y;
        if ((dx2 * dx2) / (rx1 * rx1) + (dy2 * dy2) / (ry1 * ry1) <= 1) return true;
    }

    return false;
}

// ============================================
// EXACT ELLIPSE-vs-POLYGON COLLISION (no sampling)
// ============================================
// Scale space by (1/rx, 1/ry) so the ellipse becomes a unit
// circle, then do exact circle-vs-segment math. Affine scaling
// preserves "inside" and "crossing" tests, so this is exact -
// no missed collisions from coarse angular sampling.

function ellipseSegmentIntersects(center, rx, ry, p1, p2) {
    let sx1 = (p1.x - center.x) / rx, sy1 = (p1.y - center.y) / ry;
    let sx2 = (p2.x - center.x) / rx, sy2 = (p2.y - center.y) / ry;
    let dx = sx2 - sx1, dy = sy2 - sy1;
    let lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? (-sx1 * dx - sy1 * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    let cx = sx1 + t * dx, cy = sy1 + t * dy;
    return (cx * cx + cy * cy) <= 1;
}

function ellipsePolygonCollision(center, rx, ry, verts) {
    if (!verts || verts.length < 2) return false;

    if (pointInPolygon(center, verts)) return true;
    for (const v of verts) if (pointInEllipse(v.x, v.y, center, rx, ry)) return true;
    for (let i = 0; i < verts.length; i++) {
        let j = (i + 1) % verts.length;
        if (ellipseSegmentIntersects(center, rx, ry, verts[i], verts[j])) return true;
    }
    return false;
}

// ============================================================
// CIRCULAR ARC INTERSECTION (start/end/length as 0-1 fractions)
// ============================================================
// Samples the boundary at fixed angle steps and reports which
// portion is inside `insideTestFn`. If more than one separate
// arc is inside (possible vs. a concave shape), `start`/`end`
// describe the largest contiguous run, `length` is the combined
// fraction across all runs.
function computeCircularArcInfo(center, rx, ry, insideTestFn, samples = 360) {
    const flags = new Array(samples);
    let insideCount = 0;

    for (let i = 0; i < samples; i++) {
        const theta = (i / samples) * Math.PI * 2;
        const px = center.x + rx * Math.cos(theta);
        const py = center.y + ry * Math.sin(theta);
        const inside = insideTestFn({ x: px, y: py });
        flags[i] = inside;
        if (inside) insideCount++;
    }

    if (insideCount === 0) return { start: 0, end: 0, length: 0 };
    if (insideCount === samples) return { start: 0, end: 1, length: 1 };

    const startScan = flags.findIndex((v) => !v);
    const runs = [];
    let k = 0;
    while (k < samples) {
        const idx = (startScan + k) % samples;
        if (flags[idx]) {
            let runLength = 0;
            while (runLength < samples && flags[(idx + runLength) % samples]) runLength++;
            runs.push({ startIdx: idx, length: runLength });
            k += runLength;
        } else k++;
    }

    runs.sort((a, b) => b.length - a.length);
    const primary = runs[0];
    const start = primary.startIdx / samples;
    const end = (primary.startIdx + primary.length) / samples; // may exceed 1 - fine for p5 arc()
    const length = runs.reduce((sum, r) => sum + r.length, 0) / samples;

    return { start, end, length };
}

function pointInRect(point, rectVerts) {
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

// ============================================
// SHAPE-vs-CIRCLE ARC CALCULATION
// ============================================

function getShapeCircleIntersectionInfo(circleCenter, circleRadius, ...vertices) {
    if (!vertices || vertices.length < 2) {
        return {
            intersects: false, points: [], edgeIntersections: [],
            verticesInside: [], circleCenterInside: false,
            circleFullyInside: false, arcPercentage: 0, arcLength: 0,
            arcStartAngle: 0, arcEndAngle: 0,
            arcStartDegrees: 0, arcEndDegrees: 0,
            details: 'Not enough vertices'
        };
    }

    let allIntersections = [];
    let edgeIntersections = [];
    let allAngles = [];

    for (let i = 0; i < vertices.length; i++) {
        let j = (i + 1) % vertices.length;
        let result = getCircleIntersectionInfo(vertices[i], vertices[j], circleCenter, circleRadius);
        if (result.intersects) {
            result.points.forEach(p => {
                edgeIntersections.push(p);
                allIntersections.push(p);
                let angle = Math.atan2(p.y - circleCenter.y, p.x - circleCenter.x);
                allAngles.push(((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
            });
        }
    }

    let verticesInside = [];
    for (let v of vertices) {
        let dx = v.x - circleCenter.x, dy = v.y - circleCenter.y;
        if (dx * dx + dy * dy <= circleRadius * circleRadius) {
            verticesInside.push(v);
            let angle = Math.atan2(v.y - circleCenter.y, v.x - circleCenter.x);
            allAngles.push(((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
        }
    }

    let circleCenterInside = pointInPolygon(circleCenter, vertices);

    let circleFullyInside = false;
    if (circleCenterInside) {
        circleFullyInside = true;
        for (let i = 0; i < vertices.length; i++) {
            let j = (i + 1) % vertices.length;
            let dist = pointToSegmentDistance(circleCenter, vertices[i], vertices[j]);
            if (dist < circleRadius) {
                if (Math.abs(dist - circleRadius) > 0.0001) {
                    circleFullyInside = false;
                    break;
                }
            }
        }
    }

    // Dedupe angles.
    let uniqueAngles = [];
    const tolerance = 0.0001;
    for (let angle of allAngles) {
        if (!uniqueAngles.some(u => Math.abs(u - angle) < tolerance)) uniqueAngles.push(angle);
    }

    let arcStartAngle = 0, arcEndAngle = 0;
    let arcStartDeg = 0, arcEndDeg = 0;
    let arcPercentage = 0, arcLength = 0;

    if (circleFullyInside || (circleCenterInside && uniqueAngles.length === 0)) {
        arcPercentage = 1;
        arcLength = 2 * Math.PI * circleRadius;
        arcStartAngle = 0;
        arcEndAngle = 2 * Math.PI;
        arcStartDeg = 0;
        arcEndDeg = 360;
    } else if (uniqueAngles.length >= 2) {
        uniqueAngles.sort((a, b) => a - b);

        let largestGap = 0, largestGapIndex = 0;
        for (let i = 0; i < uniqueAngles.length; i++) {
            let next = (i + 1) % uniqueAngles.length;
            let gap = (i === uniqueAngles.length - 1)
                ? (2 * Math.PI - uniqueAngles[i]) + uniqueAngles[0]
                : uniqueAngles[next] - uniqueAngles[i];
            if (gap > largestGap) { largestGap = gap; largestGapIndex = i; }
        }

        let startIdx = (largestGapIndex + 1) % uniqueAngles.length;
        let endIdx = largestGapIndex;

        arcStartAngle = uniqueAngles[startIdx];
        arcEndAngle = uniqueAngles[endIdx];
        if (arcStartAngle > arcEndAngle) arcEndAngle += 2 * Math.PI;

        if (arcEndAngle - arcStartAngle > Math.PI) {
            let tempStart = arcStartAngle;
            let tempEnd = arcEndAngle;
            arcStartAngle = tempEnd;
            arcEndAngle = tempStart + 2 * Math.PI;
        }

        arcPercentage = (arcEndAngle - arcStartAngle) / (2 * Math.PI);
        arcLength = (arcEndAngle - arcStartAngle) * circleRadius;
        arcStartDeg = radiansToDegrees(arcStartAngle);
        arcEndDeg = radiansToDegrees(arcEndAngle);
    }

    // Dedupe points.
    let uniquePoints = [];
    for (let p of allIntersections) {
        if (!uniquePoints.some(u => {
            let dx = u.x - p.x, dy = u.y - p.y;
            return (dx * dx + dy * dy) < tolerance * tolerance;
        })) uniquePoints.push(p);
    }

    let intersects = uniquePoints.length > 0 || verticesInside.length > 0 || circleCenterInside;

    return {
        intersects: intersects,
        points: uniquePoints,
        edgeIntersections: edgeIntersections,
        verticesInside: verticesInside,
        circleCenterInside: circleCenterInside,
        circleFullyInside: circleFullyInside,
        arcPercentage: Math.round(arcPercentage * 10000) / 10000,
        arcLength: Math.round(arcLength * 100) / 100,
        numIntersections: uniquePoints.length,
        arcStartAngle: arcStartAngle,
        arcEndAngle: arcEndAngle,
        arcStartDegrees: Math.round(arcStartDeg * 100) / 100,
        arcEndDegrees: Math.round(arcEndDeg * 100) / 100,
        details: intersects ? 'Intersection detected' : 'No intersection'
    };
}

function calculateArcAngles(circleCenter, ...points) {
    if (!points || points.length < 2) {
        return { startAngle: 0, endAngle: 0, startDegrees: 0, endDegrees: 0 };
    }

    let angles = points.map(p => Math.atan2(p.y - circleCenter.y, p.x - circleCenter.x));
    let normalizedAngles = angles.map(a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    normalizedAngles.sort((a, b) => a - b);

    let uniqueAngles = [];
    for (let a of normalizedAngles) {
        if (!uniqueAngles.some(u => Math.abs(u - a) < 0.0001)) uniqueAngles.push(a);
    }

    if (uniqueAngles.length < 2) {
        return { startAngle: 0, endAngle: 0, startDegrees: 0, endDegrees: 0 };
    }

    let largestGap = 0, largestGapIndex = 0;
    for (let i = 0; i < uniqueAngles.length; i++) {
        let next = (i + 1) % uniqueAngles.length;
        let gap = (i === uniqueAngles.length - 1)
            ? (2 * Math.PI - uniqueAngles[i]) + uniqueAngles[0]
            : uniqueAngles[next] - uniqueAngles[i];
        if (gap > largestGap) { largestGap = gap; largestGapIndex = i; }
    }

    let startIdx = (largestGapIndex + 1) % uniqueAngles.length;
    let endIdx = largestGapIndex;

    let startAngle = uniqueAngles[startIdx];
    let endAngle = uniqueAngles[endIdx];
    if (startAngle > endAngle) endAngle += 2 * Math.PI;

    if (endAngle - startAngle > Math.PI) {
        let tempStart = startAngle;
        let tempEnd = endAngle;
        startAngle = tempEnd;
        endAngle = tempStart + 2 * Math.PI;
    }

    return {
        startAngle: startAngle,
        endAngle: endAngle,
        startDegrees: radiansToDegrees(startAngle),
        endDegrees: radiansToDegrees(endAngle)
    };
}

// ============================================
// MISC HELPERS
// ============================================
// Returns the keys of `object` whose value === `value` (simple)
// or [undefined] (non-simple placeholder).
Object.indexOf = (object, value, simple = true) => {
    if (simple) return Object.keys(object).filter(key => object[key] === value);
    else return [undefined];
};