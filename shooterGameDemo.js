var world;
function setup() {
  world = new World();
  world.setDebugMode(false);   // enables the DevConsole: press ` then try /display todoList
  console.log(world);
}

const damageDisplay = [];

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
        if(isNaN(this.ammo)){
            this.ammo = 0;
        }
        if(this.fireType != this._previousFireType){
            if(this.fireType != 3){
                var _time = (this.original.fireType == 3 ? this.burst/this.burstTime/5 : 1);
                //console.log(1000/(this.firerate * _time));
                this.shoot = throttle(()=>{
                    if(this._mag <= 0 || !this.canShoot)return;
                    const _p = player.position(true);
                    const angle = findSlope(_p.x,_p.y, player.ignoreCamera ? mouse.rawX : mouse.x, player.ignoreCamera ? mouse.rawY : mouse.y);
                    //+25*-Math.cos(angle), +25*-Math.sin(angle)
                    
                    player.processCollisions();
                    // const _cdl = player.collisions.filter(e => e.thisHitbox == player.hitbox[2]);
                    // if(false)
                    // if(_cdl.length > 0){

                    //     _cdl.forEach(data => {
                    //         const obj = data.other;
                    //         if(!(obj instanceof Player) && obj instanceof Entity && meleeCanReach(obj)){
                    //             if(obj.applyDamage)obj.applyDamage(this.damage);
                    //             else if(obj.health) obj.health -= this.damage;
                    //             this._mag -= 1;
                    //             return;
                    //         }
                    //     });

                    //     return;
                    // }
                    let _prematureCollision = false;
                    Scene.getActiveScene().objects.forEach(s => {
                        if(s.id != _playerMelee.id && s.id != player.id){
                            if(s.collision.enabled && s.collision.solid){
                                if(meleeCanReach(s) && _playerMelee.hitbox[0].collidesWith(s.hitbox[0],0)){
                                    
                                    if(s instanceof Player){
                                        s.applyDamage(this.damage * gameSettings.friendlyDamage);
                                        this._mag -= 1;
                                        //console.log('premature collision',s.constructor.name);
                                        _triggers._prematureCollision.damaged = true;
                                    }else if(s instanceof Entity){
                                        if(s.applyDamage)s.applyDamage(this.damage,damageDisplay);
                                        else s.health -= this.damage;
                                        this._mag -= 1;
                                        //console.log('premature collision',s.constructor.name);
                                        _triggers._prematureCollision.damaged = true;
                                    }
                                    _triggers._prematureCollision.self = true;
                                    
                                    _prematureCollision = true;
                                }
                            }
                            
                        }
                    });
                    if(_prematureCollision){
                        _triggers._prematureCollision.last = new Date().getTime();
                        return;
                    }
                    var bullet = new gameObject(_p.x,_p.y,this.size.width,this.size.height,'play');
                    bullet.processCollisions();
                    
                    
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
                        else if(collisions.some(e => e==player)){
                            //console.log('player*');
                            return;
                        }
                        else if(gameSettings.friendlyFire && collisions.some(e => e==player) && self.totalDist > 300){
                            
                            //console.log(`you hurt youre self.... some how...`);
                            player.applyDamage(dmg * gameSettings.friendlyDamage,damageDisplay);
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
                                else t.other.applyDamage(dmg,damageDisplay);
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
                    let _prematureCollision = false;
                    Scene.getActiveScene().objects.forEach(s => {
                        if(s.id != _playerMelee.id && s.id != player.id){
                            if(s.collision.enabled && s.collision.solid){
                                if(meleeCanReach(s) && _playerMelee.hitbox[0].collidesWith(s.hitbox[0],0)){
                                    
                                    if(s instanceof Player){
                                        s.applyDamage(this.damage * gameSettings.friendlyDamage);
                                        this._mag -= 1;
                                        //console.log('premature collision',s.constructor.name);
                                        _triggers._prematureCollision.damaged = true;
                                    }else if(s instanceof Entity){
                                        if(s.applyDamage)s.applyDamage(this.damage,damageDisplay);
                                        else s.health -= this.damage;
                                        this._mag -= 1;
                                        //console.log('premature collision',s.constructor.name);
                                        _triggers._prematureCollision.damaged = true;
                                    }
                                    _triggers._prematureCollision.self = true;
                                    
                                    _prematureCollision = true;
                                }
                            }
                            
                        }
                    });
                    if(_prematureCollision){
                        _triggers._prematureCollision.last = new Date().getTime();
                        return;
                    }
                    const _p = player.position(true);
                    const angle = findSlope(_p.x,_p.y,
                        player.ignoreCamera ? mouse.rawX : mouse.x,
                        player.ignoreCamera ? mouse.rawY : mouse.y);
                    var bullet = new gameObject(_p.x,_p.y,this.size.width,this.size.height,'play');
                    bullet.processCollisions();
                    
                    
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
                            player.applyDamage(dmg * gameSettings.friendlyDamage,damageDisplay);
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
                                else t.other.applyDamage(dmg,damageDisplay);
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
            //console.log('wait');
            return false;
        }
        
        let _toggle = throttle(()=>{
            
            if(this.original.fireType != 1){
                //console.log('toggling...');
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



class Level {
    constructor(enemyMatrix,ammoMatrix,healthMatrix,shieldMatrix){

        this.spawn = [];
        this.enemys = [];
        if(!Array.isArray(enemyMatrix)&&typeof enemyMatrix == 'object'){
            let keys = Object.keys(enemyMatrix);
            let num = Object.values(enemyMatrix);
            
            keys.forEach((e,i) => {
                let _data = num[i];
                if(validNumber(e)){
                    this.spawn[Number(e)] = _data;
                }
            });
            
        }else if(Array.isArray(enemyMatrix)){
            this.spawn = enemyMatrix;
        }


        this.ammo = [];

        if(!Array.isArray(ammoMatrix)&&typeof ammoMatrix == 'object'){
            let keys = Object.keys(ammoMatrix);
            let num = Object.values(ammoMatrix);
            
            keys.forEach((e,i) => {
                let _data = num[i];
                if(validNumber(e)){
                    this.ammo[Number(e)] = _data;
                }
            });
            
        }else if(Array.isArray(ammoMatrix)){
            this.ammo = ammoMatrix;
        }


        this.health = [];

        if(!Array.isArray(healthMatrix)&&typeof healthMatrix == 'object'){
            let keys = Object.keys(healthMatrix);
            let num = Object.values(healthMatrix);
            
            keys.forEach((e,i) => {
                let _data = num[i];
                if(validNumber(e)){
                    this.health[Number(e)] = _data;
                }
            });
            
        }else if(Array.isArray(healthMatrix)){
            this.health = healthMatrix;
        }


        this.shield = [];

        if(!Array.isArray(shieldMatrix)&&typeof shieldMatrix == 'object'){
            let keys = Object.keys(shieldMatrix);
            let num = Object.values(shieldMatrix);
            
            keys.forEach((e,i) => {
                let _data = num[i];
                if(validNumber(e)){
                    this.shield[Number(e)] = _data;
                }
            });
            
        }else if(Array.isArray(shieldMatrix)){
            this.shield = shieldMatrix;
        }
        

        this.statred = false;
        this.completed = false;
    }
    getEnemys(lvl = false){
        if(!lvl)
            return this.enemys.filter(e => !e.deleted);
        let _filter = this.enemys.filter(e => e.name == `l${lvl}e` && !e.deleted);
        return _filter;
    }
    remaining(percent = false){
        if(!percent)
            return this.getEnemys().length;
        return this.getEnemys().length / this.spawn.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    }
}


//const buttonTest = new uiButton(400,400,130,30,'lets play','play');

var currentLevel = 0;
const levelMap = [
    // {
    //     enemys:{
    //         list:[], //for enemies of the level
    //         spawn:[6] //enemyLevel:enemyCount index = 1:6, index = 2:0
    //     },
    //     remaining(percent = false){
    //         let total = 0;
    //         this.enemys.spawn.forEach(e => total += e);
    //         let left = this.enemys.list.filter(e => !e.deleted).length;
    //         return percent ? (left)/total : (left);
    //     },
    //     ammo:[15], //ammo per enemy level
    //     completed:false,
    //     started:false,
    // },
    // {
    //     enemys:{
    //         list:[], //for enemies of the level
    //         spawn:[12,5] //enemyLevel:enemyCount index = 1:6, index = 2:0
    //     },
    //     remaining(percent = false){
    //         let total = 0;
    //         this.enemys.spawn.forEach(e => total += e);
    //         let left = this.enemys.list.filter(e => !e.deleted).length;
    //         return percent ? (left)/total : (left);
    //     },
    //     ammo:[15,21], //ammo per enemy level
    //     completed:false,
    //     started:false,
    // }
    new Level([6],[15]),
    new Level([12,5],[5,7],[0,20],[5,5]),
    new Level([7,8,3],[6,15,20],[0,12,0],[0,5,10]),
];

function newEnemy(x, y, w, h, lvl) {
    let e = new Entity(x, y, w, h, `l${lvl + 1}e`, "play");
    e.setGravityObject();
    e.tags.push("enemy");

    e.package(
        Entity.Packages.living(),
        Entity.Packages.speed(),
        Entity.Packages.attack()
    );
    e.targeting = {
        type: Player,
        range: 1200,
    };
    /*
        Level | type
        1 : beginner
        2 : normal (can jump)
        3 : reinforced
        4 : tanker
        5 : vampire
        6 : speed
    */
    switch(lvl+1){
        case 4:
            e.speed.max = 5;
            e.speed.value = 0.65;
            e.speed.sprint = 10;
        break;
        case 5:
            e.vampire = {
                health:0.2,
                shield:0,
            };
            e.rendering.color = '#400642';
        break;
    }
    const _enemyShield = [0,20,35,50,30,10];
    e.shield.value = _enemyShield[lvl];
    // Moves `current` toward `target` by at most `step` (never overshoots).
    function _approach(current, target, step) {
        const diff = target - current;
        return current + Math.sign(diff) * Math.min(step, Math.abs(diff));
    }

    // Enemies in the way of `self` walking in direction `dir` (1 = right, -1 = left): ones
    // touching, overlapping or within a couple of pixels in front of it. An enemy standing on
    // top of (or under) another one doesn't count: it shares no height with it. Enemies
    // behind `self` never count.
    function _enemiesInWay(self, dir) {
        if (dir === 0) return [];
        const room = 2;                                   // px an enemy keeps from the one in front
        const a = self.hitbox[0].bounds(0);
        const aMid = (a.left + a.right) / 2;
        return self.getParentScene().objects.filter((o) => {
            if (o === self || o.deleted || !o.tags.includes("enemy") || !o.hitbox[0]) return false;
            const b = o.hitbox[0].bounds(0);
            if (((b.left + b.right) / 2 - aMid) * dir <= 0.5) return false;                       // behind / level with me
            if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1.5) return false;        // only stacked, not side by side
            return (dir > 0 ? b.left - a.right : a.left - b.right) <= room;                        // touching or about to
        });
    }

    // Is collision `c` a wall BESIDE `self` (side-on), rather than a floor or ceiling?
    // Uses the collision's own sides when the engine provides them; otherwise works it out
    // from the two hitboxes: they must share some height and be touching horizontally.
    function _sideContact(self, c) {
        if (c.sides) return !!(c.sides.left || c.sides.right);
        const a = c.thisHitbox.bounds(0), b = c.otherHitbox.bounds(0);
        const shared = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return shared > 2 && (b.left - a.right) <= 2 && (a.left - b.right) <= 2;
    }

    function _move(self) {
        var dir = 0;

        const pos = self.position();
        const vel = self.velocity();
        const look = {
            left: pos.x - self.size().x / 2 - self.targeting.range,
            right: pos.x + self.size().x / 2 + self.targeting.range,
        };
        if (player.x > look.left && player.x > pos.x) {
            self.transform.rotation = 0;
            dir = 1;
        }
        if (player.x < look.right && player.x < pos.x) {
            self.transform.rotation = Math.PI;
            dir = -1;
        }

        const dt = world.tickLength / 1000;                // seconds per game tick

        // How fast this enemy really moved since its last move (in velocity units), so the
        // enemy behind it can match it. Measured from its position, so friction, walls and
        // pushes all count.
        const _perTick = dt * 10;
        self._actualVX = self._lastX === undefined ? 0 : (pos.x - self._lastX) / _perTick;
        self._lastX = pos.x;

        // speed.value is the speed gained per SECOND; each tick adds its share until speed.max.
        // The speed is kept in speed.current (not added onto vel.x) because friction / velocity
        // decay shave vel.x every tick and would eat increments this small.
        self.speed.current = self.speed.current || 0;
        const inWay = _enemiesInWay(self, dir);
        if (dir === 0) {
            self.speed.current = 0;                        // nothing to chase
        } else {
            self.speed.current = _approach(self.speed.current, dir * self.speed.max, self.speed.value);
            let along = self.speed.current * dir;          // speed in the walking direction
            if (inWay.length > 0) {
                // Don't cram into the enemy in front: move at ITS speed instead (the slowest
                // one if several are in the way). speed.current keeps building meanwhile.
                const follow = Math.min(...inWay.map((o) => Math.max((o._actualVX || 0) * dir, 0)));
                along = Math.min(Math.max(along, 0), follow);
            }
            vel.x = along * dir;
        }

        //if in contact with a wall object, or cramming into an enemy, try to jump over
        const _walls = self.collisions.filter(
            (e) => !(e.other instanceof self.targeting.type)
        );
        const _blocked = inWay.length > 0 || _walls.some((e) => _sideContact(self, e));
        if (_blocked && lvl > 0 && self.velocity().y >= 0 && self.grounded && self.y > player.y)
            self.velocity("add", 0, -self.size().y * 1.25);

        self.velocity("set", limit(vel.x, -self.speed.max, self.speed.max), vel.y);
    }
    e.scripts.push((self)=>{
            if(self.health <= 0){
                if(game.level.ammo.length > 0)player.weapon.ammo += game.level.ammo[lvl];
                if(game.level.health.length > 0)player.health += isNaN(game.level.health[lvl]) ? 0 : game.level.health[lvl];
                if(game.level.shield.length > 0){
                    player.shield.value += isNaN(game.level.shield[lvl]) ? 0 : game.level.shield[lvl];
                    //console.log(isNaN(game.level.shield[lvl]) ? 0 : game.level.shield[lvl]);
                }
                self.delete();
            }
            const pos = self.position();
            const vel = self.velocity();
            
            
            //attempt to attack all enemy target type objects
            self.getParentScene().objects.forEach(e => {
                if(e instanceof self.targeting.type){
                    if(self.hitbox[0].collidesWith(e.hitbox[0],self.attack.range)){
                        let _attacked = self.tryAttack(e);
                        
                        if(self.vampire && _attacked != false){
                            
                            if(typeof _attacked == 'object'){
                                if(_attacked.health >= 0)
                                    self.health += _attacked.health*self.vampire.health;
                                self.shield.value += _attacked.shield*self.vampire.shield;
                            } else self.health += _attacked*self.vampire.health;
                        }
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

    

    levelMap[currentLevel].enemys.push(e);
}


const enemyTypes = [
    (x,y,w,h,lvl)=>newEnemy(x,y,w,h,lvl),
    (x,y,w,h,lvl)=>newEnemy(x,y,w,h,lvl),
];



function waveStart(){
    const level = levelMap[currentLevel];
    if(level == undefined){
        game.completed = true;
        return;
    }
    if(!level.started){
        level.spawn.forEach(num => {
            const lvl = level.spawn.indexOf(num);
            if(num<=0)return;
            
            for(let e = 0;e<num;e++){
                let enemy = newEnemy(randomNumber(-2500,2500),500,15,25,lvl);
            }
            
            level.enemys.forEach(e => {
                player.collision.excluded.push(e);
                e.collision.excluded = [player];
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
    immortal:true,
};

const game = {
    get level(){
        return levelMap[currentLevel];
    },
    completed:false,
};

const arsonal = {
    //damage,range,velocity,firerate,fireType,burst,burstTime,reloadTime,mag,ammo,a
    m4:new Gun('m4',20,600,150,16,2,1,1,3.5,30,120,ammoTypes['5.56']),
    //damage,range,velocity,firerate (bursts per second),burst,burstTime,reloadTime,amg,ammo,a
    m16:new Gun('m16',14,850,120,0.85,3,3,0.05,3.25,24,24*5,ammoTypes['5.56']),
    
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
// const dummy = new Entity(200,275,25,40,'tester','play');
// dummy.setGravityObject();

class Obstical {
    constructor(x,y,w,h,moveable = true){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.moveable = moveable;
    }
}

const obsticals = [
    new Obstical(200,500,25,40,false),
    new Obstical(-420,475,25,30),
    new Obstical(-120,500,55,40,false),
    new Obstical(805,500,50,40,false),
    
];


obsticals.forEach((o,i) => {
    let p = new gameObject(o.x,o.y,o.w,o.h,'play');
    p.setGravityObject();
    if(!o.moveable)
        p.collision.pushable = false;
    obsticals[i] = p;
});


const _triggers = {
    _prematureCollision:{
        damaged:false,
        self:false,
        last:0,
    },
};


const player = new Player(200,200, 20,30,'player1','play');
player.physicsToggles.friction = true;
player.rendering.color = '#23b306';
player.setGravityObject();
//player.rendering.debug.active = true;
player.melee = {
    range:37,
    damage:40,
    cooldown:1.5,
    targets:5,
    display:{
        start:0,
        end:-1,
    },
};

// player.addHitbox('rect',0,0,player.size().x+player.melee.range,15);
// player.hitbox[1].rendering.color = 'rgba(0,0,0,0)';
// player.hitbox[1].rendering.visible = false;
// player.hitbox[1].rendering.outline = [1,'red'];
// player.hitbox[1].collision.resolve = false;
// player.hitbox[1].collision.pushable = false;
// player.hitbox[1].collision.solid = false;

const _playerMelee = new gameObject(0,0,player.size().x+player.melee.range,15,'play');
_playerMelee.collision.solid = false;
_playerMelee.collision.pushable = false;
_playerMelee.rendering.color = 'rgba(0,0,0,0)';
_playerMelee.rendering.outline = [1,'red'];

// player.addHitbox('rect',0,0,player.size().x+50,5);
// player.hitbox[2].rendering.color = 'rgba(0,0,0,0)';
// player.hitbox[2].rendering.visible = true;
// player.hitbox[2].rendering.outline = [1,'red'];
// player.hitbox[2].collision.resolve = false;
// player.hitbox[2].collision.pushable = false;
// player.hitbox[2].collision.solid = false;

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
player.package(Entity.Packages.living(),Entity.Packages.inventory());


player.weapon = arsonal.mp5;





// ---------------------------------------------------------------
// Melee line of sight
// A swing can't reach through walls or any other solid object that isn't
// an enemy. An enemy is hit when the player has a clear line from the
// centre of their body to some part of the enemy that is inside the melee
// hitbox, so enemies in front of a wall (or on top of the player while the
// swing also touches a wall) are still hit, and enemies behind it aren't.
// Turn off with:  player.melee.blockedByWalls = false
// ---------------------------------------------------------------
player.melee.blockedByWalls = true;

// World-space outline of a hitbox: { poly:[points] } for rect / triangle,
// { center, rx, ry } for circle / ellipse.
function hitboxOutline(hb){
    if(hb.shape === 'circle' || hb.shape === 'ellipse'){
        const isEllipse = Array.isArray(hb.radius);
        return {
            center:hb.getWorldPosition(),
            rx:isEllipse ? hb.radius[0] : (hb.radius || hb.width/2),
            ry:isEllipse ? hb.radius[1] : (hb.radius || hb.height/2),
        };
    }
    return { poly: hb.shape === 'triangle' ? hb.getWorldTrianglePoints(0) : hb.getRectangleVertices(0) };
}

function outlineContains(o,p){
    if(o.poly)return pointInPolygon(p,o.poly);
    const dx = (p.x-o.center.x)/o.rx, dy = (p.y-o.center.y)/o.ry;
    return dx*dx + dy*dy <= 1;
}

function segmentHitsOutline(a,b,o){
    if(o.poly){
        if(outlineContains(o,a) || outlineContains(o,b))return true;
        for(let i=0,k=o.poly.length-1;i<o.poly.length;k=i++){
            if(segmentsIntersect(a,b,o.poly[k],o.poly[i]))return true;
        }
        return false;
    }
    // ellipse: scale into a unit circle and test against that
    const s = (p)=>({x:(p.x-o.center.x)/o.rx, y:(p.y-o.center.y)/o.ry});
    return segmentIntersectsCircle(s(a),s(b),{x:0,y:0},1);
}

// A few points on a shape (centre + points just inside its extremes).
function outlineSamples(o){
    if(o.poly){
        const c = {
            x:o.poly.reduce((s,v)=>s+v.x,0)/o.poly.length,
            y:o.poly.reduce((s,v)=>s+v.y,0)/o.poly.length,
        };
        return [c, ...o.poly.map(v=>({x:c.x+(v.x-c.x)*0.85, y:c.y+(v.y-c.y)*0.85}))];
    }
    return [o.center, ...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({
        x:o.center.x+dx*o.rx*0.85,
        y:o.center.y+dy*o.ry*0.85,
    }))];
}

// True if the melee swing can reach `target` (no wall / non-enemy solid in the way).
function meleeCanReach(target,__h = _playerMelee){
    if(!player.melee.blockedByWalls)return true;

    const origin = player.hitbox[0].getWorldPosition();
    const strike = hitboxOutline(__h.hitbox[0]);

    // Solid, non-enemy objects (not the player, not the target) block the swing.
    const blockers = [];
    player.getParentScene().objects.forEach(o => {
        if(o === player || o === target || o.deleted || !o.active)return;
        if(o.tags.includes('enemy'))return;
        if(!o.collision || !o.collision.solid)return;
        o.hitbox.forEach(hb => {
            if(!hb.collision || !hb.collision.enabled)return;
            const outline = hitboxOutline(hb);
            // A wall the player's centre is pressed into must not block every swing.
            if(!outlineContains(outline,origin))blockers.push(outline);
        });
    });
    if(blockers.length < 1)return true;

    // Parts of the enemy inside the swing (if only a sliver overlaps, use all its points).
    const samples = outlineSamples(hitboxOutline(target.hitbox[0]));
    const inReach = samples.filter(p => outlineContains(strike,p));
    return (inReach.length ? inReach : samples)
        .some(p => !blockers.some(b => segmentHitsOutline(origin,p,b)));
}

const meleeAttack = throttle(()=>{
    
    var targets = 0;
    player.melee.display.end = player.melee.cooldown*100;
    let now = 0;
    let _end = setInterval(()=>{
        now+=1;
        player.melee.display.start = now;
        if(now >= player.melee.display.end)clearInterval(_end);
    },10);
    //player.collisions[0]?.other
    player.getParentScene().objects.forEach(o => {
        
        
        if(targets < player.melee.targets)
        if(o.tags.includes('enemy')){
            if(o.hitbox[0].collidesWith(_playerMelee.hitbox[0]) && meleeCanReach(o)){
                if(o.applyDamage)o.applyDamage(player.melee.damage,damageDisplay);
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

function groupByNestedObjectId(array) {
  const groups = array.reduce((acc, item) => {
    // Safely extract the ID from the nested object
    const idKey = item.object?.id;
    
    // Ignore items that don't have a valid object ID
    if (idKey !== undefined && idKey !== null) {
      acc[idKey] = acc[idKey] || [];
      acc[idKey].push(item);
    }
    
    return acc;
  }, {});

  // Return only the groups that have more than one matching item
  return Object.values(groups).filter(group => group.length > 0);
}

const displayableStats = ['damage','range','velcoity','firerate','fireType','burst','burstTime','ammo','mag','reloadTime'];
function arsonalDisplay(){
    const weapons = Object.keys(arsonal);
    const stats = Object.values(arsonal);
    weapons.forEach((d,i)=>{
        if(d!=player.weapon.id)return;
        const statDisplays = Object.keys(stats[i]).filter(e => displayableStats.includes(e));
        const statValues = Object.values(stats[i]);
        push();
        translate(player.x,300);
        fill('#4b12a7');
        rect(0,0,200,200);
        textSize(18);
        fill(255);
        colorText(`${d}`,-20,-80);
        statDisplays.forEach((display,index)=>{
            const value = statValues[index];
            textSize(12);
            fill(255);
            colorText(`${display}: ${value}`,80-170,-70+18*(index+1));
        });
        pop();
    });
}


const damageDisplayMode = 'stack';
const damageDisplayTime = 1500;
function playerUI(){



    //player tried shooting into wall....
    push();
    let __tn = new Date().getTime();
    translate(player.x,player.y);
    if(_triggers._prematureCollision.self){
        //console.log('premature...');
        if(_triggers._prematureCollision.last + 2000 <= __tn){
            _triggers._prematureCollision.self = false;
            _triggers._prematureCollision.damaged = false;
        }
        if(!_triggers._prematureCollision.damaged && _triggers._prematureCollision.last + 2000 > __tn){
            textAlign(CENTER,CENTER);
            const txt = `Prevented Gun Fire\nDue to wall`;
            fill('#6a6a6b');
            rect(0,-195,textWidth(txt)*1.05,35);
            fill('red');
            colorText(txt,0,-200);
            //console.log('applyed damage');
        }
    }
    pop();



    //enemy health bars
    if(game.level)
    game.level.getEnemys().forEach(e=>{
        push();
        const pos = e.position();
        const size = e.size();
        translate(pos.x,pos.y-size.y*1.15);
        let __eWidth = map(e.health,0,100,0,45);
        let _enemyColorMesh = map(__eWidth,0,35,0,1);
        fill('#818181');
        rect(0,0,45,5);
        fill(new Blender('#66ff00',_enemyColorMesh).actualize('#ff0000'));
        noStroke();
        rect(0,-0.5,__eWidth,4);
        //shields
        if(e.shield.value > 0){
            let __eShieldWidth = map(e.shield.value,0,e.shield.max,0,45);
            fill('#16d6dd');
            noStroke();
            rect(-(45/2-__eShieldWidth/2),-0.5,__eShieldWidth,4);
        }
        pop();
    });


    //arsonal display 
    if(arsonalToggle)arsonalDisplay();
    

    //damage numbers
    const numbers = groupByNestedObjectId(damageDisplay);
    numbers.forEach((m,j) => {
        let now = new Date().getTime();
        let total = {
            health:0,
            shield:0,
        };
        if(damageDisplayMode == 'stack'){
            m.forEach((e,i) => {
                
                if(e.timeStamp + damageDisplayTime > now && e.health > 0){
                    push();
                    const pos = e.object.position();
                    const size = e.object.size();
                    translate(pos.x,pos.y-size.y*1.05-(16*(i+1)))
                    let txt = e.shield > 0 ? `  \\blue|${e.shield}|` : '';
                    colorText(`\\red|${Math.floor(e.health) != e.health ? pad(e.health) : e.health}|${txt}`);
                    
                    pop();
                }
            });
        }else if(damageDisplayMode == 'total'){
            let object = null;
            let lastTime = 0;
            m.forEach(e => {
                
                if(e.timeStamp > lastTime){
                    lastTime = e.timeStamp;
                    //e.timeStamp = now;
                }
                
                if(e.timeStamp + damageDisplayTime > now){
                    object = e.object;
                    //if(lastTime + damageDisplayTime > now)
                        total.health += e.health;
                    
                }
                if(e.shield > 0)total.shield += e.shield;
                
                
            });
            push();
            
            if(lastTime + damageDisplayTime > now && total.health > 0){
                const pos = object.position();
                const size = object.size();
                translate(pos.x,pos.y-size.y*1.05);
                let txt = total.shield > 0 ? `  \\blue|${pad(total.shield)}|` : '';
                colorText(`\\red|${Math.floor(total.health) != total.health ? pad(total.health) : total.health}|${txt}`);
            }

            pop();
        }
    });
    

    //Health Bar
    push();
    strokeWeight(0.5);
    rectMode(CORNER);
    translate(player.x,player.y);
    fill('#818181');
    const w2 = 50;
    rect(-w2/2,(-player.size().y*2 + 15),w2,10);
    healthColorMesh.value = player.health/100;
    //health bar color: over health or health
    if(player.health <= 100)fill(healthColorMesh.actualize('#ff0000'));
    else fill('#f767cc');

    let width2 = limit(map(player.health,0,100,0,w2-1),0,50);
    noStroke();
    rect(-w2/2+0.5,(-player.size().y*2 + 14.5),width2,9.5);
    //shield
    if(player.shield.value > 0){
        
        let __pShieldWidth = map(player.shield.value,0,player.shield.max,0,49);
        fill('#16d6dd');
        noStroke();
        rect(-w2/2+0.5,(-player.size().y*2 + 4.5),__pShieldWidth,10);
        
    }
    //over health
    if(player.health > 100){
        fill('#da04da');
        let __ohh = 'OverHealth:';
        textSize(10);
        textAlign(CENTER,CENTER);
        colorText(`\\white|${__ohh}|`,-5,-player.size().y*0.95);
        fill('#f767cc');
        colorText(`${pad(player.health - 100)}`,-5+textWidth(__ohh)/1.25,-player.size().y*0.95);
    }
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


    //Wave/Level display
    fill('#2be725');
    colorText(`Wave: \\pink|${game.level ? currentLevel+1 : 'You Win!'}|`,100-world.camera.width/2);
    fill('#2be725');
    let __eNum = game.level ? game.level.remaining() : 0;
    if(__eNum > 0)colorText(`Enem${__eNum > 1 ? 'ies' : 'y'} left: \\rgb(241, 94, 119)|${game.level.remaining()}|`,100-world.camera.width/2,20);
    
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
    translate(player.x, player.y-player.size().y*2.25);
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
        _playerMelee.rendering.visible = true;
    }else _playerMelee.rendering.visible = false;
    pop();



}




var arsonalToggle = false;
var _arsonalToggle = throttle(()=>{
    arsonalToggle = !arsonalToggle;
},1);

var _weaponToggle = throttle((n)=>{
    const weapons = Object.keys(arsonal);
    let index = weapons.indexOf(player.weapon.id);
    if(index >= 0){
        index += n;
        //console.log(weapons[index],index);
        if(index < weapons.length && index >= 0){
            player.weapon = arsonal[weapons[index]];
            //console.log('up 1');
        }else if(index < 0){
            player.weapon = arsonal[weapons[weapons.length-1]];
            //console.log('wrapped up');
        }else if(index >= weapons.length){
            player.weapon = arsonal[weapons[0]];
            //console.log('wrapped down');
        }
    }
},0.15);

var _test;
player.scripts.push((self)=>{
    // world.camera.x = player.x;
    // world.camera.y = player.y;
    player.weapon.update();
    if(player.health <= 0 && !gameSettings.immortal)Scene.setScene('blank');
    _playerMelee.ignoreCamera = true;
    _playerMelee.transform.scale.x = player.size().x/2 + player.melee.range;
    _playerMelee.transform.position.y = player.y;
    // const __pra = findSlope(mouse.x,mouse.y,player.position().x,player.position().y);
    // player.hitbox[2].transform.rotation = degrees(__pra);
    // const _hPos = sideOffset(__pra,player.size().x+player.hitbox[2].size().x,5);
    // player.hitbox[2].offset = _hPos;

    let _hbS = _playerMelee.size().x;
    //if(player.melee.display.start >= player.melee.display.end){
       _playerMelee.transform.position.x = (player.x - world.camera.x + ((mouse.x < player.x) ? -(_hbS/2 + player.size().x/4) : _hbS/2 + player.size().x/4)); 
    //}
    player.shield.value = limit(player.shield.value,0,100);
        
    if(arsonalToggle){
        if(getInput('key@arrowdown'))_weaponToggle(-1);
        if(getInput('key@arrowup'))_weaponToggle(1);
    }

    world.camera.link(player,0,':50');
    
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
    
    if(getInput('key@y')){
        _arsonalToggle();
    }

    
    
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
    
    if((keyboard.keyPressed('w') || keyboard.keyPressed('space')) && player.grounded)
        player.velocity('add',0,-player.size().y);
    
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
    push();
    translate(world.camera.x,world.camera.y);
    colorText(`player sprint: ${player.sprint.value} \nplayer speed: ${pad(player.velocity().x,2,2)}`,300,70);
    pop();
    if(getInput('key@e:held')>0)console.log(67);
    findSlope(player.x,player.y,mouse.x,mouse.y);
    
    
    playerUI();
    

});






// getter: menuScreen menuScene _menu
//
//
//
//

function newMenuButton(type,x,w,y,h,txt){

}

const mainMenu = {
    buttons:[

    ],
};

















Scene.setScene('play');