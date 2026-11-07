var world;
function setup() {
  world = new World();
  world.setDebugMode(false);   // enables the DevConsole: press ` then try /display todoList
  console.log(world);
}


const bullets = [];
class Gun {
    constructor(name,damage,range,velocity,firerate,fireType,burst,burstTime,reloadTime,mag,ammo,a){
        this.damage = damage;
        this.range = range;
        this.velocity = velocity;
        this.firerate = firerate; //seconds (times weapon can fire)
        this.id = name;
        this.fireType = fireType; //1,2,3 [1: semiauto, 2: fullauto, 3: burst]
        //burst weapon stats
        this.burst = burst; //bullet per burst (3)
        this.burstTime = burstTime; //seconds between each bullet in burst (0.105)
        //
        this.ammo = ammo;
        this.mag = mag;
        this.reloadTime = reloadTime; //seconds
        this.reloading = false;
        this.togglingFire = false;
        this.canShoot = true;

        this._previousFireType = 0;
        this._canBurst = true;
        this._burst = 0;
        this._burstToggle = false; //burst is 'semi auto' or has to recieve new input for each fire

        this.original = {
            damage,
            range,
            velocity,
            firerate,
            burst,
            burstTime,
            fireType,
            reloadTime,
            ammo,
            mag,
        };

        this.attachments = {
            muzzle:null,
            barrel:null,
            //optic:null, //handling attachment
            mag:null,
            underBarrel:null, //semi-handling attachment
            //stock:null, //handling attachment
        };

        this._mag = mag;
        
        this.size = {
            width:a.x,
            height:a.y,
        };
        

        this.reload = throttle(()=>{
            
            if(this._mag >= this.mag || this.ammo <= 0 || this.reloading)return;
            
            this.reloading = true;
            let needed = this.mag - this._mag;
            this.ammo += this._mag;
            this._mag = 0;

            setTimeout(() => {
                this.ammo -= this.mag;
                this._mag = this.mag;
                if(this.ammo < 0){
                    this._mag += this.ammo;
                    this.ammo = 0;
                }
                this.reloading = false;
                
            }, this.reloadTime*1000);
        },this.reloadTime);
    }
    update(){
        if(this.fireType != this._previousFireType){
            if(this.fireType != 3){
                var _time = (this.original.fireType == 3 ? this.burst/this.burstTime/5 : 1);
                console.log(1000/(this.firerate * _time));
                this.shoot = throttle(()=>{
                    if(this._mag <= 0 || !this.canShoot)return;
                    const _p = player.position(true);
                    const angle = findSlope(_p.x,_p.y,
                        player.ignoreCamera ? mouse.rawX : mouse.x,
                        player.ignoreCamera ? mouse.rawY : mouse.y);
                    var bullet = new gameObject(_p.x+25*-Math.cos(angle),_p.y+25*-Math.sin(angle),this.size.width,this.size.height,'play');
                    bullet.processCollisions();
                    Scene.getActiveScene().objects.forEach(s => {
                        if(s.id != bullet.id){
                            if(bullet.collidesAtPoint(s.x,s.y,5)){
                                
                                if(s instanceof Player){
                                    //s.applyDamage(this.damage * gameSettings.friendlyDamage);
                                }else if(s instanceof Entity){
                                    if(s.applyDamage)s.applyDamage(this.damage);
                                    else s.health -= this.damage;
                                    bullet.delete();
                                }
                                //console.log('premature collision');
                                
                            }
                        }
                    });
                    
                    bullet.ignoreCamera = player.ignoreCamera;
                    if(this.fireType != 3)this._mag -= 1;
                    bullet.massArea = false;
                    bullet.mass = this.velocity/8;
                    //bullet.rendering.debug.active = true;
                    bullet.physicsToggles.gravity = true;
                    bullet.collision.solid = false;
                    bullet.startPosition = player.position();
                    
                    bullet.totalDist = 0;
                    //bullet's independent script to deal damage and delete itself
                    
                    bullet.scripts.push((self)=>{
                        self.ignoreCamera = player.ignoreCamera;
                        const _bi = bullets.indexOf(self);
                        self.processCollisions();

                        const prv = self.previousPosition;
                        const pos = self.position();
                        const vel = self.velocity();
                        const srt = self.startPosition;
                        let d = dist(
                            srt.x+vel.x/world.tickLength,
                            srt.y+vel.y/world.tickLength,
                            prv.x-vel.x/world.tickLength,
                            prv.y-vel.y/world.tickLength);
                        self.totalDist += d;
                        self.startPosition = self.position();
                        let div = this.range/self.totalDist;
                        /*
                            limit(600/625 <= 1 ? 20*Math.pow(600/625,1.25) : 20, 2, 20)
                        */
                        let dmg = limit(
                            div <= 1 ? 
                            this.damage*Math.pow(this.range/self.totalDist,1.25) : 
                            this.damage, this.damage/10, this.damage);
                        
                        
                        updateRotationSmooth(self,world.tickToSeconds(1),10000);
                        //all objects colliding with this bullet
                        const collisions = self.collisions.map(e => e.other);
                        //all bullet objects that exist
                        const bulletSet = new Set(bullets.filter(e => e!=self && !e.deleted));
                        // const cont = bullets.filter(e => !e.deleted);
                        // cont.forEach(e => {
                        //     e.collisions.forEach(y => collisions.push(y));
                        // });
                        // if(!world.camera.isHitboxVisible(self.hitbox[0])){
                        //     self.delete();
                        // }
                        const bounds = world.camera.getBounds(100);
                        if( self.x < bounds.left || self.x > bounds.right || self.y > bounds.bottom){
                            self.delete();
                            //console.log('despawned');
                        }
                        if(!Object.values(self.collision.sides).some(e => e))return;
                        //const cont = bullets.filter(e => !e.deleted).some(b => !self.collisions.forEach(e => e.other == b));
                        
                        if(collisions.some(e => bulletSet.has(e))){
                            //console.log('other bullet collision');
                            return;
                        }
                        // else if(collisions.some(e => e==player)){
                        //     //console.log('player*');
                        //     return;
                        // }
                        else if(gameSettings.friendlyFire && collisions.some(e => e==player) && self.totalDist > 300){
                            
                            //console.log(`you hurt youre self.... some how...`);
                            player.applyDamage(dmg * gameSettings.friendlyDamage);
                            self.delete();
                            return;
                        }else if(collisions.some(e => e==player) && !gameSettings.friendlyFire){
                            //console.log('you hit youre self... nice');
                            return;
                        }
                        
                        var terminate = false;
                        
                        self.collisions.forEach(t => {
                            if(t.other.health && !terminate){
                                if(!t.other.applyDamage)t.health -= dmg;
                                else t.other.applyDamage(dmg);
                                terminate = true;
                            }
                            //else console.log('hit inanimate object');
                        });
                        self.delete();
                        bullets[_bi] = self;
                    });

                    bullet.transform.rotation = (angle);
                    bullet.setVelocity(this.velocity,angle-Math.PI);
                    bullets.push(bullet);
                    this.canShoot = false;
                    setTimeout(()=>{
                        if(this.fireType!=1)this.canShoot = true;
                    },1/_time);
                    return true;
                },1/(this.firerate * _time));
                this._previousFireType = this.fireType;
            }else{
                var shoot = burstThrottle(()=>{
                    if(this._mag <= 0 || this._burst > this.burst)return;
                    if(this._burst <= 0){
                        setTimeout(() => {
                            if(!this._burstToggle)this.canShoot = true;
                            this._canBurst = true;
                            this._burst = 0;
                        }, 1000/(this.firerate*this.burst));
                    }
                    const _p = player.position(true);
                    const angle = findSlope(_p.x,_p.y,
                        player.ignoreCamera ? mouse.rawX : mouse.x,
                        player.ignoreCamera ? mouse.rawY : mouse.y);
                    var bullet = new gameObject(_p.x+25*-Math.cos(angle),_p.y+25*-Math.sin(angle),this.size.width,this.size.height,'play');
                    bullet.processCollisions();
                    Scene.getActiveScene().objects.forEach(s => {
                        if(s.id != bullet.id){
                            if(bullet.collidesAtPoint(s.x,s.y,5)){
                                
                                if(s instanceof Player){
                                    //s.applyDamage(this.damage * gameSettings.friendlyDamage);
                                }else if(s instanceof Entity){
                                    if(s.applyDamage)s.applyDamage(this.damage);
                                    else s.health -= this.damage;
                                    bullet.delete();
                                }
                                //console.log('premature collision');
                                
                            }
                        }
                    });
                    
                    bullet.ignoreCamera = player.ignoreCamera;
                    this._mag -= 1;
                    bullet.massArea = false;
                    bullet.mass = this.velocity/8;
                    //bullet.rendering.debug.active = true;
                    bullet.physicsToggles.gravity = true;
                    bullet.collision.solid = false;
                    bullet.startPosition = player.position();
                    
                    bullet.totalDist = 0;
                    //bullet's independent script to deal damage and delete itself
                    
                    bullet.scripts.push((self)=>{
                        self.ignoreCamera = player.ignoreCamera;
                        const _bi = bullets.indexOf(self);
                        self.processCollisions();

                        const prv = self.previousPosition;
                        const pos = self.position();
                        const vel = self.velocity();
                        const srt = self.startPosition;
                        let d = dist(
                            srt.x+vel.x/world.tickLength,
                            srt.y+vel.y/world.tickLength,
                            prv.x-vel.x/world.tickLength,
                            prv.y-vel.y/world.tickLength);
                        self.totalDist += d;
                        self.startPosition = self.position();
                        let div = this.range/self.totalDist;
                        /*
                            limit(600/625 <= 1 ? 20*Math.pow(600/625,1.25) : 20, 2, 20)
                        */
                        let dmg = limit(
                            div <= 1 ? 
                            this.damage*Math.pow(this.range/self.totalDist,1.25) : 
                            this.damage, this.damage/10, this.damage);
                        
                        
                        updateRotationSmooth(self,world.tickToSeconds(1),10000);
                        //all objects colliding with this bullet
                        const collisions = self.collisions.map(e => e.other);
                        //all bullet objects that exist
                        const bulletSet = new Set(bullets.filter(e => e!=self && !e.deleted));
                        // const cont = bullets.filter(e => !e.deleted);
                        // cont.forEach(e => {
                        //     e.collisions.forEach(y => collisions.push(y));
                        // });
                        // if(!world.camera.isHitboxVisible(self.hitbox[0])){
                        //     self.delete();
                        // }
                        const bounds = world.camera.getBounds(100);
                        if( self.x < bounds.left || self.x > bounds.right || self.y > bounds.bottom){
                            self.delete();
                            //console.log('despawned');
                        }
                        if(!Object.values(self.collision.sides).some(e => e))return;
                        //const cont = bullets.filter(e => !e.deleted).some(b => !self.collisions.forEach(e => e.other == b));
                        
                        if(collisions.some(e => bulletSet.has(e))){
                            //console.log('other bullet collision');
                            return;
                        }
                        // else if(collisions.some(e => e==player)){
                        //     //console.log('player*');
                        //     return;
                        // }
                        else if(gameSettings.friendlyFire && collisions.some(e => e==player) && self.totalDist > 300){
                            
                            //console.log(`you hurt youre self.... some how...`);
                            player.applyDamage(dmg * gameSettings.friendlyDamage);
                            self.delete();
                            return;
                        }else if(collisions.some(e => e==player) && !gameSettings.friendlyFire){
                            //console.log('you hit youre self... nice');
                            return;
                        }
                        
                        var terminate = false;
                        
                        self.collisions.forEach(t => {
                            if(t.other.health && !terminate){
                                if(!t.other.applyDamage)t.health -= dmg;
                                else t.other.applyDamage(dmg);
                                terminate = true;
                            }
                            //else console.log('hit inanimate object');
                        });
                        self.delete();
                        bullets[_bi] = self;
                    });

                    bullet.transform.rotation = (angle);
                    bullet.setVelocity(this.velocity,angle-Math.PI);
                    bullets.push(bullet);
                    this.canShoot = false;
                    this._canBurst = false;
                    this._burst ++;
                    // setTimeout(()=>{
                    //     this._canBurst = true;
                    // },this.burstTime*1000);
                    return true;
                },1/(this.firerate*this.burst),this.burst,this.burstTime);
                this.shoot = function(){
                    
                    if(this.canShoot && this._canBurst && this._burst < this.burst){
                        shoot();
                        
                        
                    }
                    
                }
                this._previousFireType = this.fireType;
            }
        }
    }
    getMode(){
        switch(this.fireType){
            case 1:return 'Semi Auto';
            case 2:return 'Full Auto';
            case 3:return `${this.burst} Burst`;
        }
    }

    toggleFireType(wait = 0.5){
        if(this.togglingFire){
            console.log('wait');
            return false;
        }
        
        let _toggle = throttle(()=>{
            
            if(this.original.fireType != 1){
                console.log('toggling...');
                this.togglingFire = true;
                switch(this.fireType){
                    case 2:
                        this.fireType = 1;
                    break;
                    case 3:
                        this.fireType = 1;
                    break;
                    case 1:
                        this.fireType = this.original.fireType;
                        this.canShoot = true;
                    break;
                }
                setTimeout(()=>{
                    this.togglingFire = false;
                },wait*1000);
                //return true;
            }
            //return false;
        },wait*1000);
        return _toggle();
    }
    
    resetStats(){
        let stats = this.original;
        this.damage = stats.damage;
        this.firerate = stats.firerate;
        this.fireType = stats.fireType;
        this.burst = stats.burst;
        this.burstTime = stats.burstTime;
        this.range = stats.range;
        this.velocitycotiy = stats.velocityocity;
        this.ammo = stats.ammo;
        this.mag = stats.mag;
        this.reloadTime = stats.reloadTime;
    }
    applyAttachments(){
        let attach = this.attachments;
        
        this.resetStats();

        if(attach.mag!=null){
            this.damage += stats.damage*attach.mag.damage;
            this.firerate += stats.firerate*attach.mag.firerate;
            this.range += stats.range*attach.mag.range;
            this.velocity += stats.velocity*attach.mag.velocity;
            this.ammo += stats.ammo*attach.mag.ammo;
            this.reloadTime += stats.ammo*attach.mag.reloadTime;
            this.mag += stats.mag*attach.mag.mag;
            this.burst += stats.burst*attach.mag.burst;
            this.burstTime += stats.burstTime*attach.mag.burstTime;
        }
        
        if(attach.barrel!=null){
            this.firerate += stats.firerate*attach.barrel.firerate;
            this.range += stats.range*attach.barrel.range;
            this.velocityocity += stats.velocity*attach.barrel.velocity;
        }

        if(attach.muzzle!=null){
            this.firerate += stats.firerate*attach.muzzle.firerate;
            this.range += stats.range*attach.muzzle.range;
            this.velocityocity += stats.velocity*attach.muzzle.velocity;
        }
        
        if(attach.underBarrel!=null){
            this.range += stats.range*attach.underBarrel.range;
        }
        
        
        

    }
}

const ammoTypes = {
    '5.56':{y:7,x:12},
    '7.76':{y:7,x:16},
    '9mm':{y:6,x:8},
    '50cal':{y:8,x:22},
};






//const buttonTest = new uiButton(400,400,130,30,'lets play','play');

var currentLevel = 0;
const levelMap = [
    {
        enemys:{
            list:[], //for enemies of the level
            spawn:[6] //enemyLevel:enemyCount index = 1:6, index = 2:0
        },
        remaining(percent = false){
            let total = 0;
            this.enemys.spawn.forEach(e => total += e);
            let left = this.enemys.list.filter(e => !e.deleted).length;
            return percent ? (left)/total : (left);
        },
        ammo:[15], //ammo per enemy level
        completed:false,
        started:false,
    }
];

const enemyTypes = [
    (x,y,w,h,lvl)=>{
        let e = new Entity(x,y,w,h,'l1e','play');
        e.setGravityObject();
        e.tags.push('enemy');
        
        e.package(Entity.Packages.living(),Entity.Packages.speed(),Entity.Packages.attack());
        e.targeting = {
            type:Player,
            range:1200,
        };
        function _move(self){
            var dir = 0;
            const pos = self.position();
            const vel = self.velocity();
            const look = {
                left:pos.x - self.size().x/2 - self.targeting.range,
                right:pos.x + self.size().x/2 + self.targeting.range,
            };
            if(player.x > look.left && player.x > pos.x){
                self.transform.rotation = 0;
                dir = 1;
            }
            if(player.x < look.right && player.x < pos.x){
                self.transform.rotation = Math.PI;
                dir = -1;
            }
            if(Math.abs(self.velocity().x) < self.speed.max){
                vel.x += self.speed.value*dir;
            }
            self.velocity('set',limit(vel.x,-self.speed.max,self.speed.max),vel.y);
        }
        e.scripts.push((self)=>{
            if(self.health <= 0){
                player.weapon.ammo += levelMap[currentLevel].ammo[lvl];
                self.delete();
            }
            const pos = self.position();
            const vel = self.velocity();
            
            
            //attempt to attack all enemy target type objects
            self.getParentScene().objects.forEach(e => {
                if(e instanceof self.targeting.type){
                    if(self.hitbox[0].collidesWith(e.hitbox[0],self.attack.range)){
                        self.tryAttack(e);
                    }
                    //console.log('trying attack');
                }
            });
            var collisions = self.collisions.length > 0 ?
                self.collisions.map(e => e.other) : self.collisions;
            
            // if(collisions.length > 0){
            //     collisions.forEach(c => {
            //         if(!(c instanceof Entity) && !c.tags.includes('enemy')){
                        
            //         }else{
            //             self.velocity('set',0,vel.y);
            //         }
            //     });
            // }
            _move(self);
            
        });
        levelMap[currentLevel].enemys.list.push(e);
    },
];

function waveStart(){
    const level = levelMap[currentLevel];
    if(level == undefined)return;
    if(!level.started){
        level.enemys.spawn.forEach(num => {
            const lvl = level.enemys.spawn.indexOf(num);
            if(num<=0)return;
            for(let e = 0;e<num;e++){
                let enemy = enemyTypes[lvl](randomNumber(-2000,2000),600,15,25,lvl);
            }
            level.enemys.list.forEach(e => {
                player.collision.excluded.push(e);
                e.collision.excluded = [...level.enemys.list,player];
            });
        });
        
        level.started = true;
    }else{
        if(level.remaining() <= 0)currentLevel+=1;
    }
}

const gameSettings = {
    friendlyFire:false,
    friendlyDamage:1, //percent
};

const arsonal = {
    //damage,range,velocity,firerate,fireType,burst,burstTime,reloadTime,mag,ammo,a
    m4:new Gun('m4',20,600,150,16,2,1,1,3.5,30,120,ammoTypes['5.56']),
    //damage,range,velocity,firerate (bursts per second),burst,burstTime,reloadTime,amg,ammo,a
    m16:new Gun('m16',14,850,100,0.85,3,3,0.05,3.25,24,24*5,ammoTypes['5.56']),
    
    mp5:new Gun('mp5',9,400,200,22,2,1,1,2.75,35,35*6,ammoTypes['9mm']),
};


const ground = new gameObject(1000,1000,10000,20,'play');
ground.setStaticObject();


ground.scripts.push((self)=>{
    self.position('set',world.canvas.width/2,world.canvas.height-10);
});


// const bull = new gameObject(200,75,20,40,'play');
// bull.setGravityObject();
// const bully = new gameObject(400,75,20,49,'play');
// bully.setGravityObject();
const dummy = new Entity(200,75,25,40,'tester','play');
dummy.setGravityObject();
dummy.package(Entity.Packages.attack());





const player = new Player(200,200, 20,30,'player1','play');
player.physicsToggles.friction = true;
player.rendering.color = '#23b306';
player.setGravityObject();

player.addHitbox('rect',0,0,player.size().x+25,15);
player.hitbox[1].rendering.color = 'rgba(0,0,0,0)';
player.hitbox[1].rendering.visible = false;
player.hitbox[1].rendering.outline = [1,'red'];
player.hitbox[1].collision.resolve = false;
player.hitbox[1].collision.pushable = false;
player.hitbox[1].collision.solid = false;


player.speed = {
    max:10,
    shift:5,
};
player.sprint = {
    max:50,
    value:50,
    chargeTime:1.25, // delay before charging 
    charge:5, // charge X per second
};
player.package(Entity.Packages.living());
player.weapon = arsonal.mp5;

player.melee = {
    range:20,
    damage:40,
    cooldown:1.5,
    targets:5,
    display:{
        start:0,
        end:-1,
    },
};

const meleeAttack = throttle(()=>{
    
    var targets = 0;
    player.melee.display.end = player.melee.cooldown*100;
    let now = 0;
    let _end = setInterval(()=>{
        now+=1;
        player.melee.display.start = now;
        if(now >= player.melee.display.end)clearInterval(_end);
    },10);
    player.getParentScene().objects.forEach(o => {
        
        
        if(targets < player.melee.targets)
        if(o.tags.includes('enemy')){
            if(o.hitbox[0].collidesWith(player.hitbox[1])){
                if(o.applyDamage)o.applyDamage(player.melee.damage);
                else o.health -= player.melee.damage;
                targets++;
            }
        }
    });
},player.melee.cooldown);


const colorMesh = new Blender('#66ff00',0);
const healthColorMesh = new Blender('#66ff00',0);
//Player Game Stats UI
//const shoot = throttle(() => console.log("bang"), 0.5);
const ammoColor = new Blender('#66ff00',0);


function playerUI(){


    //Health Bar
    push();
    strokeWeight(0.5);
    rectMode(CORNER);
    translate(player.x,player.y);
    fill('#818181');
    const w2 = 50;
    rect(-w2/2,(-player.size().y*2 + 15),w2,10);
    healthColorMesh.value = player.health/100;
    fill(healthColorMesh.actualize('#ff0000'));
    let width2 = limit(map(player.health,0,100,0,w2-1),0,100);
    noStroke();
    rect(-w2/2+0.5,(-player.size().y*2 + 14.5),width2,9.5);
    
    pop();


    //Sprint Charge
    push();
    strokeWeight(0.5);
    rectMode(CORNER);
    translate(player.x,world.camera.y);
    fill('#818181');
    const w = 150;
    rect(40-world.camera.width/2,(25 + 15),w,10);
    fill(colorMesh.actualize('#ff0000'));
    let width = map(player.sprint.value,0,player.sprint.max,0,w-1);
    noStroke();
    rect(40-world.camera.width/2,(25 + 14.5),width,9.5);
    
    pop();


    

    
    //Gun Ammo and Mag
    push();
    translate(player.x+50,world.camera.y+75);
    let segment = player.weapon.reloading ? 
        `⟳` : 
        `${player.weapon._mag}`;
    let txt = (`/${player.weapon.mag}\nAmmo: ${player.weapon.ammo}`);
    let spacer = player.weapon.reloading ?
        '    ' : ' '.repeat(segment.length*2);
    ammoColor.value = player.weapon._mag/player.weapon.mag;
    fill(player.weapon.reloading ? '#ffffff' : ammoColor.actualize('#ff0000'));
    colorText(segment,-world.camera.width/2);
    fill('#ffffff');
    colorText(`${spacer}${txt}\n${player.weapon.getMode()}`,-world.camera.width/2);
    pop();


    //crosshair
    push();
    translate(player.x,player.y);
    const a = findSlope(player.x,player.y,
                player.ignoreCamera ? mouse.rawX : mouse.x,
                player.ignoreCamera ? mouse.rawY : mouse.y);
    const length = player.weapon.range*0.6;
    const o = {
        x:-25*Math.cos(a),
        y:-25*Math.sin(a)
    };
    const ds = dist(player.x+o.x,player.y+o.y,mouse.x,mouse.y);
    const e = {
        x:-length*Math.cos(a),
        y:-length*Math.sin(a)
    }
    const cm = {
        x:mouse.x-player.x+o.x,
        y:mouse.y-player.y+o.y
    };
    const rd = dist(o.x,o.y,cm.x,cm.y);
    
    const isInside = isPointInCircle(mouse.x,mouse.y,player.x,player.y,length);
    const inToo = !isPointInCircle(mouse.x,mouse.y,player.x,player.y,25);
    stroke('#550000');
    if(!isInside)line(o.x,o.y,e.x,e.y);
    else if(inToo)line(o.x,o.y,mouse.x-player.x,mouse.y-player.y);

    pop();


    //Melee cooldown
    push();
    translate(player.x, player.y-player.size().y*2);
    const data = player.melee.display;
    let width3 = map(data.start/data.end,0,1,100,0);
    if(player.melee.display.start < player.melee.display.end){
        fill('#818181');
        rect(0,0,100,8);
        fill('#772323');
        noStroke();
        rect(0,0,width3,8);
        let size = player.size();
        noFill();
        stroke('#772323');
        strokeWeight(1);
        player.hitbox[1].rendering.visible = true;
    }else player.hitbox[1].rendering.visible = false;
    pop();



}


var _instanceClick = -1;
var clt = true;
var _test;
player.scripts.push((self)=>{
    // world.camera.x = player.x;
    // world.camera.y = player.y;
    player.weapon.update();

    player.hitbox[1].transform.scale.x = player.size().x/2 + player.melee.range;
    let _hbS = player.hitbox[1].size();
    if(player.melee.display.start >= player.melee.display.end)player.hitbox[1].offset.x = (mouse.x < player.x) ? -_hbS.x/2-player.size().x/4 : _hbS.x/2+player.size().x/4;


    world.camera.link(player,0,':50');
    if(getInput('key@arrowright')){
        world.camera.x += 2;
    }
    if(getInput('key@arrowleft')){
        world.camera.x -= 2;
    }
    if(_test == undefined){
        _test = world.mouse.instanceClick(
            ()=>{
                return player.weapon._mag <= 0;
            },
            ()=>{
                player.weapon.reload();
            }
        );
    }
    world.gyroKeyboard.update();
    //if (getInput('key@space')) shoot();
    
    colorMesh.value = map(self.sprint.value,0,self.sprint.max,0,1);
    

    if((getInput('key@w') || keyboard.keyPressed('space')) && player.grounded)
        player.velocity('add',0,-player.size().y);
    // if(getInput('mouse@right')){
    //     player.velocity('set');
    //     player.position('set',mouse.rawX,mouse.rawY);
    // }
    player.sprint.value = limit(player.sprint.value,0,player.sprint.max);
    

    if(getInput('mouse@left') && !player.weapon.reloading && player.weapon._mag > 0){
        player.weapon.shoot();
    }else if(!getInput('mouse@left') && !player.weapon.reloading && player.weapon._mag > 0){
        if(player.weapon.fireType == 1 || (player.weapon.fireType == 3 && player.weapon._burstToggle))
            player.weapon.canShoot = true;
    }
    if(typeof _test == 'function')
    if(_test() && !player.weapon.reloading){
        console.log('gar');
    }
    
    if(getInput('mouse@right')){
        // player.getParentScene().objects.forEach(o => {
        //     if(o.tags.includes('enemy')){
        //         if(o.hitbox[0].collidesWith(player.hitbox[0],player.melee.range)){
        //             meleeAttack();
        //         }
        //     }
        // });
        meleeAttack();
    }
    
    if(getInput('key@q'))
        player.weapon.toggleFireType();
    

    if(getInput('key@r')){
        player.weapon.reload();
        
    }
    

    
    var speed = player.speed.max*world.gyroKeyboard.x;
    if(getInput('key@shift')){
        if(self.sprint.value > 0 && (keyboard.keyPressed('a') || keyboard.keyPressed('d'))){
            let amp = limit(
                map(
                    keyboard.getKey('shift').getHeld(),
                    0,
                    500,
                    0,
                    1
                ),
                0,
                1
            );
            speed += Math.sign(world.gyroKeyboard.x)*(player.speed.shift*amp);
            self.sprint.value -= 5/world.tickLength;

        }

    } else if(new Date().getTime() - keyboard.getKey('shift')?.timeStamp.released>=player.sprint.chargeTime*1000){
        player.sprint.value += player.sprint.charge / world.tickLength;
    }
    
    if(player.grounded)
        player.velocity('add',speed/5);
    else
        player.velocity('add',speed/8);
    player.velocity('set',
        limit(player.velocity().x,-(player.speed.max+player.speed.shift),player.speed.max+player.speed.shift),
        player.velocity().y);
});













new Scene('play', '#4e4e8d', ()=>{
    if (World.controller && World.controller.connected) {
        World.controller.update();
    }
    waveStart();
    let gg = keyboard.getKey('shift');
    colorText(`player sprint: ${player.sprint.value} \nplayer speed: ${pad(player.velocity().x,2,2)} \nshifted: ${gg ? gg.getHeld() : 0}` + 
    `\n${mouse.x} ${player.x}`,100,70);
    if(getInput('key@e:held')>0)console.log(67);
    findSlope(player.x,player.y,mouse.x,mouse.y);
    
    
    
    playerUI();
    

});
Scene.setScene('play');