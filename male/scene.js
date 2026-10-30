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

    return active;
  }

  // GAME LOGIC - runs only on a game tick (see World._mainLoop).
  // This is where object physics/behavior and object scripts (the
  // "functions" that react to mouse/keyboard/controller input) live,
  // so they only ever produce updates at the configured tick rate.
  static tick(deltaTime = 1/60){
    if(!Scene.started)return;
    let active = Scene.getActiveScene();

    active.objects.forEach(o => {
      if(o.deleted) {
        let idx = active.objects.indexOf(o);
        if(idx > -1) active.objects.splice(idx, 1);
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

    //draw scene objects at their current (last-tick) transform
    active.objects.forEach(o => {
      if(o.deleted) return;
      if(typeof o.render == "function"){
        o.render(active);
      }
    });
  }
  
  // Method to add objects to scene
  addObject(obj) {
    if(!obj) return false;
    if(!this.objects.includes(obj)) {
      this.objects.push(obj);
    }
    if(!obj.scenes.includes(this.id)) {
      obj.scenes.push(this.id);
    }
    return true;
  }
  
  // Method to remove objects from scene
  removeObject(obj) {
    if(!obj) return false;
    let idx = this.objects.indexOf(obj);
    if(idx > -1) {
      this.objects.splice(idx, 1);
    }
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
    this.objects = [];
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