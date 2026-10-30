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
