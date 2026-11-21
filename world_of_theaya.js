var world;
function setup(){
    world = new World(20);
}

//world.writeBind('interact',{ keyboard:'e', controller: '' });










/*
    * Skills
    Active Runner
      increases sprint charge+
      decreases sprint decay-
      increases sprint speed+`
    
      Steel Stomach
*/


function hungerDecay(x, target = 50, spread = 20) {
  const clamped = Math.max(0, Math.min(100, x));
  const safeSpread = Math.max(0.001, spread);
  const sig = (v) => 1 / (1 + Math.exp(-(v - target) / safeSpread));
  const min = sig(0);
  const max = sig(100);
  return (sig(clamped) - min) / (max - min);
}




const player = new Player(0,0,20,20,'survival_player','test');
player.package(Entity.Packages.living(),Entity.Packages.speed(),{
    interact:{
        range:50,
        bind:'default@interact',
    }, 
    inventory: new Inventory(47,7,5), 
    hunger: 100,
    satruation: 10,
    thirst: 50, 
    nutritionDamage: 5,
    nutrition(){
        let value = 1;
        value *= limit(map(this.hunger+this.satruation,0,75,0,0.75),0,1);
        value *= limit(map(this.thirst,0,49,0.1,0.5),0,1);
        return value;
    },
    _damageOnNutrition(dt = World.tickLength/1000){
        let n = this.nutrition();
        //console.log(n);
        if(n < 0.25){
            this.health -= (this.nutritionDamage)*dt;
            return (this.nutritionDamage)*dt;
        } else if(n < 0.5){
            this.health -= (this.nutritionDamage/3)*dt;
            return (this.nutritionDamage/3)*dt;
        } else if(n < 0.75){
            this.health -= (this.nutritionDamage/5)*dt;
            return (this.nutritionDamage/5)*dt;
        }
        return 0;
    }
});
































const regen = new Skill('regen', true,
    //active every tick, so divide by total ticks to have 1 health per second
    (self, tg) => { tg.health += 1*world.tickRate/1000; },
    (self, tg) => tg.health < tg.maxHealth,
    0, 'mana', 1, null, 0, 1);        // cooldown 10 ticks
const me = { health: 5, maxHealth: 8 };
regen.activate(me);                     // "me" owns it and it is now on
// call regen.tick() once per game tick:
// health: 6 on the 1st tick, 7 on the 11th, 8 on the 21st, then it stops (the condition is false)



const g = new Entity(200,200,20,20,'test');
g.package(Entity.Packages.living());
g.rendering.visible = true;



new Scene('test', 70, {
    exe:(dt)=>{
        regen.tick(dt);
    }
}, ()=>{
    push();
    fill(255);
    colorText(`health: ${pad(player.health)} nutrition: ${player.nutrition()} \nhunger: ${player.hunger} \nthirst: ${player.thirst}`,100,100);
    pop();
});
Scene.setScene('test');

