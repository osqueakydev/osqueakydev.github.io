class Scene extends shell{
  static init(){
    if(Scene.started)return;
    Scene.scenes = [];
    Scene.activeScene = "blank";
    Scene.history = {
      list:["blank"],
      limit:5,
    };
    Scene.started = true;
  }
  static scenesList(exclude = false){
    let ids = [];
    Scene.scenes.forEach(e => {
      if(exclude && e.id == 'blank')return;
      ids.push(e.id);
      });
    return ids;
  }
  static setScene(id){
    let s = Scene.scenes.find(scene => scene.id == id);
    if(typeof s != "object")return null;
    Scene.activeScene = s.id;
    Scene.history.list.push(Scene.activeScene);
    // Limit history
    if(Scene.history.list.length > Scene.history.limit) {
      Scene.history.list.shift();
    }
    return Scene.activeScene;
  }
  static getScene(id){
    if(!id)id=Scene.activeScene;
    return Scene.scenes.find(scene => scene.id == id) || null;
  }
  // Resolves the active scene, keeps its bookkeeping (start time,
  // active flags, and its object list) up to date, and returns it.
  // Shared by both tick() and render() so they always agree on which
  // scene/objects are "active" even though they run on different cadences.
  static getActiveScene(){
    let active = Scene.getScene();
    if(active == null){
      active = Scene.getScene("blank");
      console.warn(`Invalid Scene "${Scene.activeScene}"`);
    }
    active.active = true;

    Scene.scenes.forEach(s => {
      if(s.id != active.id) s.active = false;
    });

    if(!active._active){
      active._active = true;
      active.startTime = World.currentTime;
    }
    active.activeTime = World.currentTime - active.startTime;

    // Update and sync object list
    active.objects = active.objects.filter(o => !o.deleted);
    gameObject.objects.forEach(o => {
      if(o.deleted) return;
      if(o.scenes.includes(active.id) && !active.objects.includes(o)) {
        active.objects.push(o);
      }
    });
    // UI objects (Text / button / inputField) are kept in their own array,
    // separate from the game objects: scene.uiObjects. It is drawn after
    // (= over) scene.objects, see Scene.render().
    active.uiObjects = active.uiObjects.filter(o => !o.deleted);
    if(typeof UI !== "undefined" && UI.objects) {
      UI.objects.forEach(o => {
        if(o.deleted) return;
        if(o.scenes.includes(active.id) && !active.uiObjects.includes(o)) {
          active.uiObjects.push(o);
        }
      });
    }

    return active;
  }

  // GAME LOGIC — runs only on a game tick (see World._mainLoop).
  // This is where object physics/behavior and object scripts (the
  // "functions" that react to mouse/keyboard/controller input) live,
  // so they only ever produce updates at the configured tick rate.
  static tick(deltaTime = 1/60){
    if(!Scene.started)return;
    let active = Scene.getActiveScene();

    [active.objects, active.uiObjects].forEach(list => {
      list.slice().forEach(o => {
        if(o.deleted) {
          let idx = list.indexOf(o);
          if(idx > -1) list.splice(idx, 1);
          return;
        }

        if(typeof o.update == "function"){
          // Pass the fixed tick deltaTime to the object's update method
          o.update(deltaTime);
        }
        if(o.scripts && o.scripts.length > 0){
          o.scripts.forEach(exe => {
            if(typeof exe == "function")exe(o);
          });
        }
      });
    });

    // Button bookkeeping AFTER scripts ran, so scripts see one-tick flags
    // like button.clicked before they are cleared.
    if(typeof UI !== "undefined" && UI.tick) UI.tick(deltaTime);
    if(typeof gameButton !== "undefined" && gameButton.tick) gameButton.tick(deltaTime);
  }

  // RENDERING — runs every animation frame regardless of ticks, so
  // visuals always stay smooth even when the tick rate is low.
  static render(){
    if(!Scene.started)return;
    let active = Scene.getActiveScene();

    World.camera.update();
    World.camera.render();
    background(active.backColor);


    //run scene scripts (e.g. HUD / debug overlays)

    
    active.scripts.forEach(exe => {
      if(typeof exe == "function")exe();
    });
    const preCameraObjects = Scene.renderOrder(active.objects).filter(e => e.rendering.draw.ignoreCamera);
    const postCameraObjects = Scene.renderOrder(active.objects).filter(e => !e.rendering.draw.ignoreCamera)
    //1) game objects, bottom to top (by layer, then list order)
    preCameraObjects.forEach(o => {
      // o.scripts.forEach(exe => {
      //   if(typeof exe == 'function')exe(o);
      // });
      if(typeof o.render == "function"){
        if(world.debugMode)o.debug = true;
        o.render(active);
      }
    });
    
    postCameraObjects.forEach(o => {
      // o.scripts.forEach(exe => {
      //   if(typeof exe == 'function')exe(o);
      // });
      if(typeof o.render == "function"){
        if(world.debugMode)o.debug = true;
        o.render(active);
      }
    });
    //2) UI objects (scene.uiObjects): always rendered over the game objects,
    //   whatever their layers are. Within the array: layer, then creation order.
    Scene.renderOrder(active.uiObjects).forEach(o => {
      if(typeof o.render == "function"){
        o.render(active);
      }
    });
    if(typeof UI !== "undefined" && UI.applyCursor) UI.applyCursor();
  }

  // RENDER ORDER within one array (first drawn = bottom, last drawn = top):
  //   1. o.layer (default 0), higher on top
  //   2. creation order (UI objects carry _order)
  //   3. position in the array
  // Deleted objects are skipped. The sort is stable.
  static renderOrder(list){
    return list
      .map((o, i) => ({ o, i }))
      .filter(e => e.o && !e.o.deleted)
      .sort((a, b) =>
        ((a.o.layer || 0) - (b.o.layer || 0)) ||
        ((a.o._order || 0) - (b.o._order || 0)) ||
        (a.i - b.i))
      .map(e => e.o);
  }

  // Method to add objects to scene
  addObject(obj) {
    if(!obj) return false;
    const list = obj.isUI ? this.uiObjects : this.objects;   // UI has its own array
    if(!list.includes(obj)) {
      list.push(obj);
    }
    if(!obj.scenes.includes(this.id)) {
      obj.scenes.push(this.id);
    }
    return true;
  }
  
  // Method to remove objects from scene
  removeObject(obj) {
    if(!obj) return false;
    [this.objects, this.uiObjects].forEach(list => {
      let idx = list.indexOf(obj);
      if(idx > -1) list.splice(idx, 1);
    });
    let idx2 = obj.scenes.indexOf(this.id);
    if(idx2 > -1) {
      obj.scenes.splice(idx2, 1);
    }
    return true;
  }
  
  constructor(id,bc,...scripts){
    super();
    Scene.init();
    this.id = id;
    this.active = false;
    this._active = false;
    this.backColor = bc;
    this.objects = [];     // game objects (gameObject and subclasses), drawn first
    this.uiObjects = [];   // UI objects (Text / button / inputField), drawn over `objects`
    this.tags = [];
    this.activeTime = 0;
    this.startTime = -1;
    this.scripts = [...scripts];
    this.push(this);
    if(Scene.scenes)Scene.scenes.push(this);
    else Scene.scenes = [this];
  }
  
  download(){
    let r = {
      bc:this.backColor,
      t:this.tags,
      obj:[],
      scr:[],
    };
    this.objects.forEach(
      obj => typeof obj.download == "function" ? r.obj.push(obj.download()) : false);
    this.scripts.forEach(exe => {
      let t = exe+'';
      t = t.replace(/\s/gi,'');
      r.scr.push(t);
    });
    console.warn(
      "Warning! Script Packages are space reduced to save space but may be difficult to read.");
    return `${this.id}:${JSON.stringify(r)}`;
  }
}

Scene.init();