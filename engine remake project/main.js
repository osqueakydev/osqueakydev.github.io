var world;
function setup() {
  world = new World();
  world.setDebugMode(true);   // enables the DevConsole: press ` then try /display todoList
  console.log(world);
}


//===================================
//          Debugger Scene
//===================================
var g = new Player(250,100,50,50,'Player1','debugger'); 
var b = new gameObject(180,600,2000,20,'debugger');
var h = new gameObject(0,0,20,20,'debugger');
//var test = new inputBox(300,300,120,30,'debugger');
h.addHitbox('triangle',0,-45,-10,10,10,10,-0,-20);
h.collision.pushable = false;
b.setStaticObject();
g.physicsToggles.friction = true;
g.setGravityObject();
g.addHitbox('circle',100,0,15,15);
const moveStick = new KeyboardStick({ left: 'a', right: 'd', up: 'w', down: 's' });
//b.addHitbox('circle',100,0,40,30);
let _G = {x:0,y:0};
g.scripts.push((self) => {
  //self.position('set',mouse.x,mouse.y);
  moveStick.update();
  if(g.position() != _G){
    //World.camera.link(g,0,100);
    _G=g.position();
  }
  h.position('set',world.mouse.x,world.mouse.y);
  g.addVelocity(moveStick.x,0);
  //g.addVelocity(-moveStick.y,270);
  if((getInput('key@w') || getInput('key@space')) && g.grounded)g.velocity('add',0,-25)
  point(350,400);
  //g.addVelocity(1)
  if(g.velocity().y < -25)
    new Message(World.tick+'t|'+g.velocity().y+'v');
  colorText(`${b.getSpeed()}`,200,70);
});


b.transform.velocity.x = 0;
b.addHitbox('triangle',0,-45,-10,10,10,10,-0,-20);


new Scene('debugger', 70,()=>{
            if (World.controller && World.controller.connected) {
                World.controller.update();
            }
            
            // Display FPS and info
            let fpsDisplay = `\\${World.stats.fpsColor}|FPS: ${World.stats.fps}|`;
            let avgFPSDisplay = `\\white|Avg: ${World.stats.averageFPS}|`;
            let statusDisplay = `\\${World.stats.fpsColor}|${fpsTracker.getPerformanceStatus()}|`;
            
            let mouseX = world.mouse ? world.mouse.x : 0;
            let mouseY = world.mouse ? world.mouse.y : 0;
            let ping = world.getPing ? world.getPing() : -1;
            
            colorText(
                `\\red|X: ${mouseX}|\n` +
                `\\blue|Y: ${mouseY}|\n` +
                `\\yellow|Time: ${pad(world.time || 0, 1, 1)}|\n` +
                `${fpsDisplay} ${avgFPSDisplay} ${statusDisplay}\n` +
                `\\cyan|Tick: ${world.getTick()} (${world.stats.measuredTickRate}/${Math.round(world.tickRate)} tps, ${world.tickLength}ms)|\n` +
                `\\white|Ping: ${ping}| \n`+
                `clicked: ${world.mouse.clicked} | pressed: ${world.mouse.pressed}`,
                40, 40
            );
            
            
});
Scene.setScene('debugger');










