var world;
function setup(){
    world = new World(20);
    world.camera.link(player);   // the World of Theaya game is set up further down this file
}

//world.writeBind('interact',{ keyboard:'e', controller: '' });


/*
    tempature things:
    temp measure unit: cc
    20 = normal
    >=10 = cold (snow and ice)
    <=30 = hot (drought weather increase, thirst decay increase, ect...)

    Weather things:
    rain 
    storm
    drought
*/
// Rates are "per minute of weather" for the whole map (see the Weather
// section further down). Anything left out falls back to 0 / off.
const _weatherControl = {
    rain:{
        /*
            can create puddles, mud [hail: very low chance] 
            can refill water cells 
        */
        name:'Rain',
        temprature:-2,       //added to the temperature while it lasts
        precipitation:true,  //rain falls (snow instead when it's freezing)
        puddles:4,           //new puddles per minute
        maxPuddles:45,
        mud:6,               //grass cells turned to mud per minute (near water / puddles)
        refill:8,            //water units given back to water cells per minute (and dried cells come back)
        farmWater:20,        //water added to every farmland per minute
        ferns:0.6,           //ferns that sprout per minute
        clay:0.5,            //dirt next to water that turns into clay per minute
        snow:10,             //cells that get snow per minute when it's freezing
        hailChance:0.03,     //chance that a cold rain is a hail rain
        intensity:0.6,       //how heavy it looks (0..1)
    },
    storm:{
        /*
            can create same things as rain but everything is less rare/more common
            refills water cells [hail: common]
            lightning strike (is sand is struck, result is glass) : very rare
        */
        name:'Storm',
        temprature:-4,
        precipitation:true,
        puddles:9,
        maxPuddles:80,
        mud:12,
        refill:18,
        farmWater:40,
        ferns:1.2,
        clay:1.2,
        snow:22,
        hailChance:0.6,
        lightning:0.5,       //strikes per minute (near the player)
        lightningDamage:3,   //health lost when it hits the player's cell
        intensity:1,
        darkness:0.25,       //extra darkness while it storms
    },
    hail:{
        /*
            exclusive to winter season / cold biomes 
        */
        name:'Hail',
        temprature:-5,
        maxTemprature:10,    //hail only happens at or below this temperature (otherwise it's rain)
        precipitation:true,
        cropDamage:0.6,      //chance per minute that a growing crop gets knocked back
        setback:0.25,        //in game days of growth a hit crop loses
        intensity:0.8,
    },
    drought:{
        /*
            makes water cell's water count decrease over time, can destroy water cells 
            makes thirst decrease faster 
        */
        name:'Drought',
        temprature:5,
        evaporate:10,        //water units taken from water cells per minute
        dryUp:0.35,          //chance an empty shoreline water cell dries into land
        thirst:1.5,          //thirst drains this many times faster
        farmDrain:2,         //farmland loses water this many times faster
        puddleDrain:4,       //puddles dry this many times faster
    }
};
//time control in game
const _worldTimeCycle = {
    sunTime:10*60, //seconds
    moonTime:5*60, //seconds
    day:15*60, //seconds, total time for a day
    month:28, //days
    months:13,
    year:365, //in game days in a in game year
    monthNames:['Caltide','Mestcet','Lecten','Wederwen','Luwen','Feldide','Fyrtide','Brynweal','Ennestil','Honmile','Henfallen','Mistide','Dufre'],
    newYearDay:'Zuwend',
    seasons:{
        winter:{
            temprature:-7,
            weather:[
                {
                    type:'rain', //makes snow if cold enough
                    chance:0.75, //percentage
                    duration:[0.1,0.45], //percentage of a day
                },
                {
                    type:'storm', //makes snow if cold enough, and hail
                    chance:0.15, //percentage
                    duration:[0.05,0.15], //percentage of a day
                }
            ]
        },
        spring:{
            temprature:14,
            weather:[
                { type:'rain',  chance:0.5,  duration:[0.1,0.4] },
                { type:'storm', chance:0.12, duration:[0.05,0.15] },
            ]
        },
        summer:{
            temprature:26,
            weather:[
                { type:'drought', chance:0.3,  duration:[0.5,1.5] },
                { type:'storm',   chance:0.18, duration:[0.05,0.12] },
                { type:'rain',    chance:0.25, duration:[0.05,0.2] },
            ]
        },
        autumn:{
            temprature:11,
            weather:[
                { type:'rain',  chance:0.55, duration:[0.15,0.5] },
                { type:'storm', chance:0.15, duration:[0.05,0.15] },
            ]
        },
    },
    //which months belong to each season (the new year day belongs to the season of the last month)
    seasonMonths:{
        winter:['Dufre','Caltide','Mestcet'],
        spring:['Lecten','Wederwen','Luwen'],
        summer:['Feldide','Fyrtide','Brynweal'],
        autumn:['Ennestil','Honmile','Henfallen','Mistide'],
    },
    //where the clock starts when the game loads
    start:{ month:'Lecten', day:1, hour:7 },
    //game clock speed (2 = days pass twice as fast). Handy for testing seasons.
    speed:1,
};






// The item sets a material can be made into. They match the `SET` of the
// resource item classes below (sTool, sWeapon, sArmor, sMaterial).
const metalSet = ['armor','tool','weapon','material'];

//hardness = 1
//tool = pick
const materialList = {
    tin:{
        origin:'ore',
        tier:1,
        sets:metalSet,
    },
    coal:{
        origin:['waste', 'ore'],
        tier:1,
        sets:'material'
    },
    zinc:{
        origin:'ore',
        tier:2,
        sets:metalSet,
    },
    iron:{
        origin:'ore',
        tier:4,
        sets:metalSet,
    },
    copper:{
        origin:'ore',
        tier:3,
        sets:metalSet,
    },
    bronze:{
        origin:'forge',
        tier:4,
        recipe:{
            copper:2,
            tin:1,
        },
        sets:metalSet,
    },
    aluminum:{
        origin:'ore',
        tier:5,
        sets:'material',
    },
    nickel:{
        origin:'forge',
        tier:5,
        recipe:{
            iron:3,
            tin:2,
        },
        sets:metalSet,
    },
    steel:{
        origin:'forge',
        tier:6,
        recipe:{
            iron:2,
            coal:1
        },
        sets:metalSet,
    },
    galvanized_steel:{
        origin:'forge',
        tier:6,
        recipe:{
            steel:1,
            zinc:1,
        },
        sets:metalSet,
    },
    gold:{
        origin:'ore',
        tier:6,
        sets:[...metalSet,'currency'],
    },
    sulfer:{
        origin:'ore',
        tier:6,
        sets:'material',
    },
    titanium:{
        origin:'ore',
        tier:7,
        sets:metalSet,
    },
    cobalt:{
        origin:'ore',
        tier:8,
        sets:metalSet,
    },
    lithium:{
        origin:'forge',
        tier:8,
        recipe:{
            titanium:2,
            zinc:3,
            gold:1,
            cobalt:2,
        },
        sets:'material'
    }
};

const naturalMaterials = {
    logs:{
        oak:{
            //hardness of 1000% or 10 means that it's unbreakable
            //percentage of hardness, 1 = stones
            hardness:0.6, 
            tier:1,
            tool:'axe'
        },
        ash:{
            hardness:0.75,
            tier:2,
            tool:'axe'
        },
        pine:{
            hardness:0.55,
            tier:1,
            tool:'axe'
        },
        cedar:{
            hardness:0.35,
            tier:0,
            tool:'axe'
        },
    },
    nature:{
        grass:{
            passable:true,
            hardness:-1, //hardness of less than 0 menas it breaks instantly 
            tier:0, //tier 0 means anything can mine it
            tool:'hoe', 
        },
        dirt:{
            hardness:1,
            tier:0,
            tool:'shovel'
        },
        gravel:{
            hardness:0.15,
            tier:0,
            tool:'shovel'
        },
        sand:{
            hardness:0.1,
            tier:0,
            tool:'shovel'
        },
        stone:{
            hardness:1,
            tier:1,
            tool:'pick'
        },
        calcite:{
            hardness:1,
            tier:1,
            tool:'pick'
        },
        clay:{
            //found next to water, or made from dirt + gravel + water
            hardness:0.5,
            tier:0,
            tool:'shovel'
        },

    },
};

/* ---------------------------------------------------------------------
 * Material lookups (all read from materialList)
 * --------------------------------------------------------------------- */

/** The materialList entry for `id`, or null. */
function getMaterial(id){
    return Object.prototype.hasOwnProperty.call(materialList, id) ? materialList[id] : null;
}
/** The item sets a material can be made into, always as an array. */
function materialSets(id){
    const m = getMaterial(id);
    if(!m || m.sets == null) return [];
    return Array.isArray(m.sets) ? m.sets : [m.sets];
}
/** The material's tier (its resource value), 0 if unknown. */
function materialTier(id){
    const m = getMaterial(id);
    return m ? (m.tier ?? 0) : 0;
}
/** True when the material can be made into an item of this set ('tool', 'weapon', 'armor', 'material'). */
function materialAllows(id, set){
    return materialSets(id).includes(set);
}
/** Every material id that can be made into this set, optionally limited to a tier range. */
function materialsFor(set, minTier = -Infinity, maxTier = Infinity){
    return Object.keys(materialList).filter(id => {
        const t = materialTier(id);
        return materialAllows(id, set) && t >= minTier && t <= maxTier;
    });
}
/**
 * Throws if `material` isn't in materialList or can't be made into `set`.
 * A null material is allowed (Item.fromJSON builds items with no arguments).
 */
function checkMaterial(material, set){
    if(material == null) return null;
    if(!getMaterial(material)) throw new typeError(`Unknown material '${material}'. Add it to materialList.`);
    if(!materialAllows(material, set)){
        throw new typeError(`'${material}' can't be made into a ${set} (its sets: ${materialSets(material).join(', ') || 'none'}).`);
    }
    return getMaterial(material);
}
/** The given name, or '<material>_<set>' when no name was passed. */
function resourceItemName(name, material, set){
    if(name != null) return name;
    return material != null ? `${material}_${set}` : null;
}



/* ---------------------------------------------------------------------
 * Resource component: which material an item is made of, and its tier.
 *   new Resource(material, set)
 *   item.get('resource').material / .tier
 * --------------------------------------------------------------------- */
class Resource extends ItemComponent {
    static id = 'resource';
    constructor(material = null, set = null){
        super();
        this.material = material;
        this.tier     = materialTier(material);
        this.set      = set;
    }
    attach(item){
        if(this.material != null) item.addTag(this.material);
    }
    detach(item){
        if(this.material != null) item.removeTag(this.material);
    }
    /** The full materialList entry (origin, recipe, sets...). */
    info(){ return getMaterial(this.material); }
}
ItemComponent.register(Resource);   // so Item.fromJSON knows it even before one is built


/* ---------------------------------------------------------------------
 * Resource items. Each one checks its material against materialList
 * (the material's `sets` must include the class's SET), then packages
 * a Resource component. The name defaults to '<material>_<set>'.
 * --------------------------------------------------------------------- */

/** Mixed into every resource item class. */
const ResourceItemMethods = {
    get resource(){ return this.get('resource'); },
    getMaterial(){ const r = this.resource; return r ? r.material : null; },
    getResourceTier(){ const r = this.resource; return r ? r.tier : 0; },
    isMaterial(id){ return this.getMaterial() === id; },
};

/** The mining tier is the material's tier.
 *  new sTool(name, material, speed, durability, effective, damage) */
class sTool extends Tool {
    static TYPE = 's_tool';
    static SET  = 'tool';
    constructor(name = null, material = null, speed = 1, durability = 100, effective = [], damage = 1){
        checkMaterial(material, sTool.SET);
        super(resourceItemName(name, material, sTool.SET), materialTier(material), speed, durability, effective, damage);
        if(material != null) this.package(new Resource(material, sTool.SET));
    }
}

/** new sWeapon(name, material, damage, speed, reach, knockback, durability) */
class sWeapon extends Weapon {
    static TYPE = 's_weapon';
    static SET  = 'weapon';
    constructor(name = null, material = null, damage = 4, speed = 4, reach = 3, knockback = 0, durability = 100){
        checkMaterial(material, sWeapon.SET);
        super(resourceItemName(name, material, sWeapon.SET), damage, speed, reach, knockback, durability);
        if(material != null) this.package(new Resource(material, sWeapon.SET));
    }
}

/** new sArmor(name, material, defense, toughness, durability, slot) */
class sArmor extends Armor {
    static TYPE = 's_armor';
    static SET  = 'armor';
    constructor(name = null, material = null, defense = 1, toughness = 0, durability = 200, slot = 'chest'){
        checkMaterial(material, sArmor.SET);
        super(resourceItemName(name, material, sArmor.SET), defense, toughness, durability, slot);
        if(material != null) this.package(new Resource(material, sArmor.SET));
    }
}

/** A raw resource (ore, ingot, coal...). Its Value is the material's tier unless one is passed.
 *  new sMaterial(name, material, maxStack, value, rarity) */
class sMaterial extends Material {
    static TYPE = 's_material';
    static SET  = 'material';
    constructor(name = null, material = null, maxStack = 64, value = null, rarity = 'common'){
        checkMaterial(material, sMaterial.SET);
        super(resourceItemName(name, material, sMaterial.SET), maxStack, value ?? materialTier(material), rarity);
        if(material != null) this.package(new Resource(material, sMaterial.SET));
    }
    /** What this material is forged from (materialList recipe), or null for raw ores. */
    getRecipe(){ const m = getMaterial(this.getMaterial()); return m && m.recipe ? m.recipe : null; }
}





for(const cls of [sTool, sWeapon, sArmor, sMaterial]){
    Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(ResourceItemMethods));
    Item.registerClass(cls);
}

// Examples:
//   new sTool(null, 'iron')            -> 'iron_tool', mining tier 3
//   new sWeapon('bronze_sword', 'bronze', 7)
//   new sArmor(null, 'steel', 4, 1, 300, 'chest')
//   new sMaterial(null, 'coal')        -> 'coal_material', value 1
//   new sTool(null, 'coal')            -> throws: coal's sets are only 'material'
//   materialsFor('weapon', 5)          -> every weapon material of tier 5 and up

/*
    * Skills
    Active Runner
      increases sprint charge+
      decreases sprint decay-
      increases sprint speed+`
    
      Steel Stomach
*/








/* =====================================================================
 * =====================================================================
 *                 WORLD OF THEAYA - overhead survival demo
 * =====================================================================
 * Sections:
 *   1. Settings
 *   2. Natural materials (biomes, grounds, log types)
 *   3. Item components / item classes / item registry (Items)
 *   4. Block registry (Blocks)
 *   5. Recipes (Recipe)
 *   6. SurvivalInventory (hotbar = last resort)
 *   7. World state + generation (hex tileMatrix)
 *   8. Player + survival stats
 *   9. Actions (move / mine / place / harvest / fill / till / plant / use)
 *  10. Stations + containers (workbench / forge / chest)
 *  10b. Time, seasons, temperature and weather (WorldClock / Weather)
 *  11. Input + GameUI state
 *  12. Rendering (terrain, world overlay, lighting + weather, HUD)
 *  13. Scene
 * ===================================================================== */


/* ---------------------------------------------------------------------
 * 1. Settings
 * --------------------------------------------------------------------- */

/*
 * =====================================================================
 *  How WORLD_SEED works
 * =====================================================================
 *  WORLD_SEED is the one number the whole map is built from. The same seed
 *  always gives the same world (terrain, biomes, caves, ores, trees...), and
 *  a different seed gives a completely different one. generateWorld(seed) in
 *  section 7 uses it in two ways:
 *
 *  1) NOISE MAPS (smooth, "hilly" values over the map)
 *     hash2(x, y, seed) turns a cell + seed into a fixed pseudo-random value
 *     0..1. valueNoise() blends those values smoothly between grid points,
 *     and fbm() stacks a few layers of it (big shapes + finer detail).
 *     Each map gets its own copy of the seed, offset by a constant so the
 *     maps don't look alike:
 *       elevation  seed        land vs ocean (pulled down toward the map
 *                              edges, pushed up around the spawn: an island)
 *       moisture   seed + 911  desert (dry) / plains / forest (wet)
 *       caves      seed + 577  where cave areas form (away from spawn)
 *       tunnels    seed + 33   open tunnels inside caves, and the sand
 *                              patches in the desert
 *       ore        seed + 71   which cave walls hold ore
 *       dunes      seed + 404  ridges of sand dunes in the desert
 *       ore type   seed + 5    which ore a vein is (higher tiers further out)
 *     The cut-off values are percentiles (quantile()), so every seed keeps
 *     the same proportions: about 24% ocean, 28% of the land desert, 38%
 *     forest, and so on. The seed changes where things are, not how much.
 *
 *  2) A SEEDED RANDOM SEQUENCE
 *     makeRng(seed) is a small generator that returns the same list of
 *     "random" numbers every time for the same seed. generateWorld() draws
 *     from it, cell by cell in order, to decide the details: which resource
 *     sits in a cell (each biome's `resources` chances), the cave wall mix,
 *     clay on shorelines, wild crops, the starter trees / bushes / ferns /
 *     stone near camp, extra ore placement, and ore heart tie-breaks.
 *
 *  Things to know:
 *   - Only the map at load time comes from the seed. Creatures, weather,
 *     drops, crop yields, regrowth and spawns use Math.random(), so they
 *     differ every time you play, even on the same seed.
 *   - The spawn is always the middle of the map; the seed shapes the land
 *     around it.
 *   - Because the random sequence is used in order, changing generation
 *     data (a biome's `resources` chances, the `crops` table, MAP_COLS /
 *     MAP_ROWS, new blocks...) can change the world even with the same seed.
 *   - Use a whole number. It is read as a 32-bit integer (`seed | 0`), so
 *     decimals are dropped and text would become 0.
 *   - Seeds 33 / 71 / 404 / 577 / 911 apart share one noise map in a
 *     different role (e.g. seed 100's tunnels = seed 133's elevation).
 *     Harmless, just not fully independent.
 *   - The small cosmetic details (grass tufts, pebbles, ripple positions)
 *     use their own fixed hash values, not the seed.
 * ===================================================================== */
const SCENE_ID        = 'theaya';
const WORLD_SEED      = 0;      // change for a different world
const MAP_COLS        = 56;
const MAP_ROWS        = 48;
const HEX_W           = 40;        // pointy-top hex cell width  (px)
const HEX_H           = 46;        // pointy-top hex cell height (px)
const MINE_TIME_SCALE = 2.0;       // seconds to break hardness 1 (stone) at speed 1, see miningInfo()
const HAND_SPEED      = 0.6;       // mining speed with no fitting tool
const WATER_UNITS     = 5;         // canteen fills a water cell holds before it runs dry
const WATER_REFILL_SECONDS = 120;  // a dry water cell refills after this long (0 = never)
const SURVIVAL = {
    hungerRate: 0.05,     // per second (saturation drains first)
    thirstRate: 0.06,     // per second
    regenRate:  0.15,      // health per second while well fed and watered
    regenAbove: 70,       // hunger and thirst must both be at least this to regenerate
    saturationMax: 20,
    sip: 25,              // thirst restored per canteen sip
    hotAbove: 30,         // above this temperature thirst drains faster...
    hotThirst: 0.05,      // ...by 5% per degree
    coldBelow: 10,        // below this temperature hunger drains faster...
    coldHunger: 0.03,     // ...by 3% per degree
};
const FARM = {
    waterMax: 100,        // water a farmland holds (like a planter box)
    bucketUnit: 25,       // farmland water per bucket unit poured
    evaporate: 8,         // water an empty farmland loses per in game day
    cropWater: 40,        // water a crop drinks per in game day (crops can override with `water`)
    dryDays: 1,           // a crop that stays dry this long withers
    wildChance: 0.006,    // chance a land cell has a wild crop
    wildMin: 2,           // every crop appears at least this many times in the world
    fernSeedChance: 0.25, // chance gathering a fern also gives a crop seed (tier 1 or lower)
    fernSeedMaxTier: 1,
    floodMax: 400,        // a bucket can overfill farmland up to this much water...
    floodAt: 3,           // ...and above this many times waterMax...
    floodDays: 0.5,       // ...for this long (half a day = 7.5 min) it turns into a water source
    overflowDrain: 40,    // water above waterMax soaks away this much faster per in game day
};
const FORGE = {
    input: 4, fuel: 1, output: 2,   // container slots
    fuelSeconds: 12,                // burn time per fuel unit (coal 4, log 2, planks 1)
};
/**
 * Cooking pot: works like the forge (limited input / fuel / output slots,
 * one recipe at a time, needs fuel). It only takes food ingredients (and
 * canteens / buckets for recipes that need water) and only makes food.
 * Cooking meat can also give grease (each MEATS entry's `grease` chance).
 */
const POT = {
    input: 4, fuel: 1, output: 2,   // container slots
    fuelSeconds: 12,                // burn time per fuel unit
};
const CHEST_SLOTS = 40;
const TORCH = {
    light: 150,           // glow radius (px)
    safe: 5,              // no hostile creature spawns within this many cells of a torch
    heldLight: 190,       // the player's light radius while holding a torch (120 without)
    // better lights made with grease (from cooking meat)
    greaseLight: 210, greaseSafe: 7,    // grease torch: glow radius (px), no spawns within (cells)
    lampLight: 270,   lampSafe: 10,     // oil lamp
};
const CAVE_DARKNESS = 0.62;   // caves are this dark even at noon (torches light them up)
const ORE_HEART = {
    days: 0.75,           // in game days between ores a heart grows (randomized +-30%)
    radius: 2,            // it grows ore in cave walls / bare cave floor this close to it
    max: 6,               // stops while this many of its ore are already around it
    perOre: 12,           // one heart per this many ore blocks of a type at world creation (1..3 per ore)
};
/**
 * The world slowly grows back toward how it was generated. Every `every`
 * seconds, `tries` random cells are checked: an emptied cell that started
 * with a natural block gets it back (trees come back as saplings, cave walls
 * as their stone). Never near the player, a torch or anything the player built.
 */
const REGROW = {
    every: 20, tries: 14,
    playerDist: 7,        // cells from the player
    builtDist: 3,         // cells from walls, doors, stations, farmland, torches...
    chance: { tree:0.5, fern:1, plant:0.35, soil:0.4, stone:0.3, dune:0.5 },
    treeSeed: 0.015,      // chance per check that a tree drops a sapling next to it (spreads forests)
    sandDrift: 0.4,       // chance per check that desert wind piles sand on a bare desert cell
};


/* ---------------------------------------------------------------------
 * 2. Natural materials
 *   The block data (hardness, tier, tool, passable) comes from
 *   `naturalMaterials` (logs + nature) and `materialList` (ores) at the top
 *   of this file. This section only adds how they look and where they grow.
 *   Hardness is relative to stone (1): < 0 breaks instantly, >= 10 can't be
 *   broken. Tier 0 = anything (bare hands too) can break it.
 * --------------------------------------------------------------------- */

/** 'galvanized_steel' -> 'Galvanized Steel' */
const prettify = id => String(id ?? '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Display colors of every materialList entry (ore specks, ingots, tools). */
const MATERIAL_COLORS = {
    tin:'#cfd0c4', coal:'#2e2e2e', zinc:'#9fb7bd', iron:'#c98f6d', copper:'#dd7a3c',
    bronze:'#b8873b', aluminum:'#e4e9ee', nickel:'#b1ad92', steel:'#8b98a6',
    galvanized_steel:'#bfcad2', gold:'#f2c230', sulfer:'#e8e04c', titanium:'#9a93dc',
    cobalt:'#3f5fe0', lithium:'#de74b6',
};
/** Colors of the naturalMaterials.nature blocks. */
const NATURE_COLORS = {
    grass:'#62a046', dirt:'#7d5b3b', gravel:'#8f8b86', sand:'#dcc581', stone:'#808080', calcite:'#e6e1d3',
    clay:'#b0745a',
};
/**
 * How each crop looks. `produce` = item / fruit color, `plant` = leaves,
 * `form` = how the plant is drawn (bush, leafy, root, grain, stalk, vine, tall),
 * `shape` = the produce icon (round, root, grain, leaf, stalk, pepper, berries).
 */
const CROP_LOOKS = {
    berries:    { produce:'#c8324d', plant:'#3c7a34', form:'bush',  shape:'berries' },
    wheat:      { produce:'#e2c25a', plant:'#9db04a', form:'grain', shape:'grain' },
    tomato:     { produce:'#e0402e', plant:'#4f8a3a', form:'vine',  shape:'round' },
    carrot:     { produce:'#ee8a26', plant:'#5fae3f', form:'root',  shape:'root' },
    potato:     { produce:'#c9a16a', plant:'#4d8f3d', form:'leafy', shape:'round' },
    rice:       { produce:'#efe9d6', plant:'#8fbf5a', form:'grain', shape:'grain' },
    corn:       { produce:'#f0cf3a', plant:'#6aa63a', form:'tall',  shape:'grain' },
    ginger:     { produce:'#d9b57a', plant:'#5e9c48', form:'stalk', shape:'root' },
    pepper:     { produce:'#d8302a', plant:'#3f7f36', form:'vine',  shape:'pepper' },
    pumpkin:    { produce:'#e8862a', plant:'#4c8a34', form:'vine',  shape:'round', big:true },
    lettuce:    { produce:'#8fd05a', plant:'#7cc04e', form:'leafy', shape:'leaf' },
    onion:      { produce:'#d8b0d0', plant:'#6cae4a', form:'root',  shape:'round' },
    garlic:     { produce:'#efe6d8', plant:'#7fb35a', form:'root',  shape:'round' },
    nuts:       { produce:'#9a6a3a', plant:'#3f7a3a', form:'bush',  shape:'round' },
    sugar_cane: { produce:'#b8d88a', plant:'#7fbf5a', form:'stalk', shape:'stalk' },
    hemp:       { produce:'#a7b86a', plant:'#5e8f3e', form:'tall',  shape:'stalk' },
};
const cropLook = id => CROP_LOOKS[id] ?? { produce:'#c9a16a', plant:'#5fae3f', form:'leafy', shape:'round' };
/** Colors of each naturalMaterials.logs type (tree, log, planks, sapling). */
const LOG_LOOKS = {
    oak:   { bark:'#6b4a2b', leaves:'#3f8a34', planks:'#b98d55' },
    ash:   { bark:'#8c8378', leaves:'#73ad55', planks:'#d8c69c' },
    pine:  { bark:'#5a3d26', leaves:'#245f3b', planks:'#caa36b', conifer:true },
    cedar: { bark:'#7b3f2a', leaves:'#4f8046', planks:'#b8673e' },
};
const logTypes = Object.keys(naturalMaterials.logs);
const logLook  = t => LOG_LOOKS[t] ?? { bark:'#6b4a2b', leaves:'#3f8a34', planks:'#b98d55' };
/** Tool names in naturalMaterials ('pick') -> the engine's mining classes ('pickaxe'). */
const toolClass = t => t === 'pick' ? 'pickaxe' : (t ?? null);

/**
 * Cell floors. Only `passable` nature entries (grass) are walkable floors;
 * water is a floor you can't walk on. Everything else in naturalMaterials.nature
 * is a solid block that sits on a grass floor.
 */
const groundTypes = { water: { name:'Water', color:'#2d6db0', passable:false, water:true } };
for(const [id, n] of Object.entries(naturalMaterials.nature)){
    if(n.passable) groundTypes[id] = { name: prettify(id), color: NATURE_COLORS[id] ?? '#62a046', passable:true };
}
const FLOOR = Object.keys(groundTypes).find(id => groundTypes[id].passable) ?? 'grass';

/**
 * Biomes. `resources` = chance per cell of each block (Blocks registry ids:
 * nature ids like 'stone', '<log>_tree', 'berry_bush'). `fill` covers that
 * share of the biome's cells with one block (the desert is mostly sand).
 * `dunes` turns that share of the biome's cells into ridges of another block
 * (sand dunes you can't walk over; the loose sand around them is walkable).
 * `floorColor` tints the grass floor. The cave biome generates INSIDE the
 * biomes in `within`: `wall` blocks with tunnels (`openness` = walkable share),
 * ores in the walls (`oreChance`, higher tiers further from spawn) and
 * `wallMix` (other wall blocks). `shoreClay` = chance a land cell next to
 * water is clay. Wild crops are placed separately (see FARM.wildChance and
 * each crop's `biomes`).
 */
const biomes = {
    plains: {
        floor: FLOOR,
        temprature:20,
        shoreClay:0.14,
        resources: { oak_tree:0.03, cedar_tree:0.02, ash_tree:0.006, berry_bush:0.025, fern:0.05, dirt:0.02, stone:0.012, gravel:0.006 },
    },
    forest: {
        floor: FLOOR, floorColor: '#4d8a39',
        temprature:17,
        shoreClay:0.1,
        resources: { oak_tree:0.08, ash_tree:0.06, pine_tree:0.05, cedar_tree:0.025, berry_bush:0.03, fern:0.08, dirt:0.015 },
    },
    desert: {
        floor: FLOOR, floorColor: '#a7a25c',
        temprature:28,
        shoreClay:0.06,
        fill: { block:'sand', share:0.78 },
        dunes: { block:'sand_dune', share:0.22 },   // ridges of impassable dunes in the sand
        resources: { cedar_tree:0.03, fern:0.006, stone:0.02, gravel:0.02 },
    },
    ocean: {
        floor: 'water',
        temprature:16,
        resources: {},
    },
    cave: {
        within: ['plains', 'forest', 'desert'],
        temprature:15,
        floor: FLOOR, floorColor: '#3e4636',
        wall: 'stone',
        wallMix: { calcite:0.10, gravel:0.07, dirt:0.04 },
        openness: 0.38,
        oreChance: 0.30,
        resources: {},
    },
};

/** Ores that drop the material itself instead of a raw ore to smelt. */
const DIRECT_ORE_DROPS = ['coal', 'sulfer'];
/** Every materialList entry with 'ore' in its origin gets an ore block. */
const oreMaterials = Object.keys(materialList).filter(id => [].concat(materialList[id].origin).includes('ore'));
const oreDropOf  = id => DIRECT_ORE_DROPS.includes(id) ? id : `raw_${id}`;
const ingotOf    = id => DIRECT_ORE_DROPS.includes(id) ? id : `${id}_ingot`;


/* ---------------------------------------------------------------------
 * 3. Items
 * --------------------------------------------------------------------- */

/*
    items to add:
    ferns: generated block, harvest = plant fibers, chance of: random crop seed
    (done: the 'fern' block + plant_fiber item, see section 4)
*/

const crops = {
    /*
        template:
        hunger:0,
        satruation:0,
        tier:0,
        growth:{
            stages:[]
        }

        optional (defaults in brackets):
        edible:     false = not food, it's a material (true)
        health:     health restored when eaten (0)
        regrow:     true = the plant stays after a harvest and grows again (false)
        seeds:      [min,max] seeds given by a ripe ('done') harvest ([1,2])
        seed:       the item that plants it (`<crop>_seeds`)
        farm:       false = planted straight on grass, no farmland or water needed (true)
        water:      farmland water it drinks per in game day (FARM.cropWater)
        rarity:     how common it is in the wild and from ferns, 0 = never (1)
        biomes:     biomes its wild plants grow in (['plains','forest'])
        nearWater:  true = wild plants only grow next to water (false)
        stage time: in game days since planting when that stage starts
    */
    berries:{
        hunger:8,
        satruation:2,
        tier:0,
        regrow:true,
        seed:'berry_bush',
        farm:false,
        rarity:0, //berry bushes are placed by the biomes instead
        growth:{
            stages:[
                {
                    yeild:1,
                    time:0.5, //in game days
                },
                {
                    yeild:2,
                    time:1.25, //in game days
                },
                {
                    yeild:[3,4], //random amount between the 2 numbers
                    time:2,
                    done:true, //ready to harvest
                },
                {
                    //rot stage
                    yeild:0, //gain no yeild
                    time:4,
                    rot:true, //rotted
                }
            ],
        },
    },
    wheat:{
        hunger:0,
        satruation:0,
        tier:1, //tool tier needed to harvest
        edible:false,
        rarity:0.9,
        biomes:['plains'],
        growth:{
            stages:[
                {
                    //waiting stage
                    yeild:0,
                    time:1,
                },
                {
                    //waiting stage
                    yeild:0,
                    time:2,
                },
                {
                    //harvest stage
                    yeild:2,
                    time:3,
                    done:true,
                },
                {
                    //rot stage
                    yeild:0,
                    time:6,
                    rot:true,
                }
            ],
        },
    },
    tomato:{
        hunger:3,
        satruation:0,
        tier:0,
        regrow:true,
        rarity:0.8,
        biomes:['plains'],
        growth:{
            stages:[
                {
                    yeild:0,
                    time:0.75,
                },
                {
                    yeild:2,
                    time:1.5,
                },
                {
                    yeild:[3,5],
                    time:2.25,
                    done:true,
                },
                {
                    yield:0,
                    time:4,
                    rot:true,
                }
            ]
        }
    },
    carrot:{
        hunger:6, satruation:3, tier:0,
        rarity:1, biomes:['plains','forest'],
        growth:{ stages:[
            { yeild:0,     time:0.6 },
            { yeild:1,     time:1.4 },
            { yeild:[2,3], time:2.2, done:true },
            { yeild:0,     time:5,   rot:true },
        ]},
    },
    potato:{
        hunger:9, satruation:4, tier:0,
        rarity:1, biomes:['plains'],
        growth:{ stages:[
            { yeild:0,     time:0.8 },
            { yeild:1,     time:1.8 },
            { yeild:[2,4], time:2.8, done:true },
            { yeild:0,     time:6,   rot:true },
        ]},
    },
    rice:{
        hunger:0, satruation:0, tier:1, edible:false,   //cook it in the forge
        water:70, rarity:0.6, biomes:['plains','forest'], nearWater:true,
        growth:{ stages:[
            { yeild:0,     time:1 },
            { yeild:0,     time:2 },
            { yeild:[3,4], time:3,   done:true },
            { yeild:0,     time:6.5, rot:true },
        ]},
    },
    corn:{
        hunger:7, satruation:3, tier:1,
        rarity:0.7, biomes:['plains'],
        growth:{ stages:[
            { yeild:0,     time:1 },
            { yeild:1,     time:2 },
            { yeild:[2,3], time:3, done:true },
            { yeild:0,     time:6, rot:true },
        ]},
    },
    ginger:{
        hunger:2, satruation:1, tier:2, health:2,
        rarity:0.35, biomes:['forest'],
        growth:{ stages:[
            { yeild:0,     time:1 },
            { yeild:0,     time:2 },
            { yeild:[1,3], time:3.2, done:true },
            { yeild:0,     time:7,   rot:true },
        ]},
    },
    pepper:{
        hunger:3, satruation:1, tier:1, regrow:true,
        rarity:0.5, biomes:['desert','plains'],
        growth:{ stages:[
            { yeild:0,     time:0.7 },
            { yeild:1,     time:1.5 },
            { yeild:[2,3], time:2.3, done:true },
            { yeild:0,     time:4.5, rot:true },
        ]},
    },
    pumpkin:{
        hunger:14, satruation:6, tier:2,
        water:55, rarity:0.4, biomes:['plains','forest'],
        growth:{ stages:[
            { yeild:0, time:1.2 },
            { yeild:0, time:2.4 },
            { yeild:1, time:3.5, done:true },
            { yeild:0, time:7.5, rot:true },
        ]},
    },
    lettuce:{
        hunger:4, satruation:1, tier:0,
        rarity:1, biomes:['plains','forest'],
        growth:{ stages:[
            { yeild:0,     time:0.4 },
            { yeild:1,     time:1 },
            { yeild:[1,2], time:1.6, done:true },
            { yeild:0,     time:3,   rot:true },
        ]},
    },
    onion:{
        hunger:4, satruation:2, tier:0,
        rarity:0.9, biomes:['plains'],
        growth:{ stages:[
            { yeild:0,     time:0.7 },
            { yeild:1,     time:1.5 },
            { yeild:[2,3], time:2.4, done:true },
            { yeild:0,     time:5.5, rot:true },
        ]},
    },
    garlic:{
        hunger:2, satruation:2, tier:0, health:1,
        rarity:0.8, biomes:['forest','plains'],
        growth:{ stages:[
            { yeild:0,     time:0.8 },
            { yeild:1,     time:1.8 },
            { yeild:[2,3], time:2.6, done:true },
            { yeild:0,     time:6,   rot:true },
        ]},
    },
    nuts:{
        hunger:5, satruation:4, tier:1, regrow:true,
        rarity:0.5, biomes:['forest'],
        growth:{ stages:[
            { yeild:0,     time:1 },
            { yeild:1,     time:2 },
            { yeild:[3,5], time:3, done:true },
            { yeild:0,     time:6, rot:true },
        ]},
    },
    sugar_cane:{
        hunger:2, satruation:0, tier:2, regrow:true,
        water:60, rarity:0.4, biomes:['desert','plains'], nearWater:true,
        growth:{ stages:[
            { yeild:0,     time:0.8 },
            { yeild:1,     time:1.6 },
            { yeild:[2,4], time:2.4, done:true },
            { yeild:0,     time:6,   rot:true },
        ]},
    },
    hemp:{
        //not food: the loom spins it into cloth (then cloth into silk)
        hunger:0, satruation:0, tier:1, edible:false,
        rarity:0.8, biomes:['plains','forest'],
        growth:{ stages:[
            { yeild:0,     time:0.7 },
            { yeild:1,     time:1.6 },
            { yeild:[2,4], time:2.5, done:true },
            { yeild:0,     time:6,   rot:true },
        ]},
    },
};

/**
 * Crops: normalized views of the `crops` table.
 *   Crops.get('carrot') -> { id, hunger, saturation, tier, edible, health, regrow,
 *                            seeds:[min,max], seed, farm, water, rarity, biomes,
 *                            nearWater, stages:[{ yield:[min,max], time, done, rot }] }
 *   Crops.stageAt(crop, age) -> index of the stage reached (-1 = still a sprout)
 */
const Crops = {
    _cache: new Map(),
    ids(){ return Object.keys(crops); },
    get(id){
        if(this._cache.has(id)) return this._cache.get(id);
        const c = crops[id];
        if(!c) return null;
        const range = v => Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1] ?? v[0]) || 0] : [Number(v) || 0, Number(v) || 0];
        const stages = ((c.growth && c.growth.stages) || []).map(s => ({
            yield: range(s.yeild ?? s.yield ?? 0), time: Number(s.time) || 0, done: !!s.done, rot: !!s.rot,
        })).sort((a, b) => a.time - b.time);
        const out = {
            id, hunger: c.hunger ?? 0, saturation: c.satruation ?? c.saturation ?? 0, tier: c.tier ?? 0,
            edible: c.edible !== false, health: c.health ?? 0, regrow: !!c.regrow,
            seeds: range(c.seeds ?? [1, 2]), seed: c.seed ?? `${id}_seeds`, farm: c.farm !== false,
            water: c.water ?? FARM.cropWater, rarity: c.rarity ?? 1,
            biomes: c.biomes ?? ['plains', 'forest'], nearWater: !!c.nearWater, stages,
        };
        out.ripeAge = (stages.find(s => s.done) || stages[stages.length - 1] || { time: 0 }).time;
        out.rotAge  = (stages.find(s => s.rot) || { time: Infinity }).time;
        this._cache.set(id, out);
        return out;
    },
    stageAt(crop, age){
        let k = -1;
        for(let i = 0; i < crop.stages.length; i++) if(age >= crop.stages[i].time) k = i;
        return k;
    },
    stage(crop, age){ const k = this.stageAt(crop, age); return k < 0 ? null : crop.stages[k]; },
    /** Weighted random crop id (by rarity) from those passing `filter`. */
    random(filter = () => true, r = Math.random()){
        const ids = this.ids().filter(id => { const c = this.get(id); return c.rarity > 0 && filter(c); });
        const total = ids.reduce((a, id) => a + this.get(id).rarity, 0);
        let roll = r * total;
        for(const id of ids){ roll -= this.get(id).rarity; if(roll <= 0) return id; }
        return ids[ids.length - 1] ?? null;
    },
};

/** Which block a BlockItem places.   new BlockPlacement(blockId) */
class BlockPlacement extends ItemComponent {
    static id = 'blockPlacement';
    constructor(block = null){ super(); this.block = block; }
}
ItemComponent.register(BlockPlacement);

/** Water carried by a canteen.   new WaterStore(capacity, value) */
class WaterStore extends ItemComponent {
    static id = 'water';
    constructor(capacity = 4, value = 0){
        super();
        this.capacity = Math.max(1, Math.floor(Number(capacity) || 1));
        this.value    = Math.min(this.capacity, Math.max(0, Math.floor(Number(value) || 0)));
    }
    get full(){ return this.value >= this.capacity; }
    get empty(){ return this.value <= 0; }
}
ItemComponent.register(WaterStore);

/** An item that places a block into a cell.   new BlockItem(name, blockId, maxStack) */
class BlockItem extends Item {
    static TYPE = 'block_item';
    constructor(name = null, block = null, stack = 64){
        super(name);
        this.package(new MaxStack(stack), new BlockPlacement(block ?? name));
        this.addTag('block');
        this.meta.category = 'block';
    }
    get block(){ const p = this.get('blockPlacement'); return p ? p.block : null; }
}

/** Holds water from water cells; drink it to restore thirst.   new Canteen(name, capacity) */
class Canteen extends Item {
    static TYPE = 'canteen';
    constructor(name = 'canteen', capacity = 4){
        super(name);
        this.package(new MaxStack(1), new WaterStore(capacity, 0));
        this.addTag('canteen');
        this.meta.category = 'tool';
    }
    get water(){ return this.get('water'); }
}

/** Carries more water than a canteen, to water farmland (not to drink).   new Bucket(name, capacity) */
class Bucket extends Item {
    static TYPE = 'bucket';
    constructor(name = 'bucket', capacity = 8){
        super(name);
        this.package(new MaxStack(1), new WaterStore(capacity, 0));
        this.addTag('bucket');
        this.meta.category = 'tool';
    }
    get water(){ return this.get('water'); }
}

/** What a seed plants.   new CropSeed(cropId) */
class CropSeed extends ItemComponent {
    static id = 'cropSeed';
    constructor(crop = null){ super(); this.crop = crop; }
}
ItemComponent.register(CropSeed);

/** Planted on watered farmland.   new CropSeedItem(name, cropId) */
class CropSeedItem extends Item {
    static TYPE = 'crop_seed';
    constructor(name = null, crop = null){
        super(name);
        this.package(new MaxStack(64), new CropSeed(crop));
        this.addTag('seed');
        this.meta.category = 'seed';
    }
    get crop(){ const s = this.get('cropSeed'); return s ? s.crop : null; }
}

/** The water component of a canteen / bucket, or null. */
const waterOf = item => item && typeof item.get === 'function' ? item.get('water') : null;

/**
 * A metal pickaxe. Its mining tier is the material's tier + 1, so a pick made
 * from tier N metal can mine the tier N+1 ore (otherwise no higher ore could
 * ever be reached: tier N ore would need a pick made from itself).
 *   new sPickaxe(name, material)
 */
class sPickaxe extends sTool {
    static TYPE = 's_pickaxe';
    constructor(name = null, material = null){
        const tier = material != null ? materialTier(material) + 1 : 0;
        super(name ?? (material != null ? `${material}_pickaxe` : null), material, 1.4 + 0.3 * tier, 60 + 45 * tier, [], 2);
        const m = this.get('mining');
        if(m){ m.tier = tier; m.classes = ['pickaxe']; }
        this.addTag('pickaxe');
    }
}
for(const cls of [BlockItem, Canteen, Bucket, CropSeedItem, sPickaxe]) Item.registerClass(cls);

/**
 * Item registry: every item the game can create, by id.
 *   Items.define(id, id => new SomeItem(id, ...), { color, icon, accent })
 *   Items.create(id, count)
 * `look` is how the HUD draws it (icon = block, log, stick, raw, chunk, ingot,
 * pickaxe, axe, shovel, hoe, berries, bush, sapling, canteen, bucket, workbench,
 * furnace, produce, seeds, fiber, wall, door, chest, glass, food, torch, lamp, grease).
 */
const Items = {
    defs: new Map(),
    _max: new Map(),
    define(id, factory, look = {}){
        this.defs.set(id, { factory, look: Object.assign({ color:'#cccccc', icon:'raw' }, look) });
        return this;
    },
    has(id){ return this.defs.has(id); },
    create(id, count = 1){
        const d = this.defs.get(id);
        if(!d) throw new Error(`Items.create: unknown item '${id}'.`);
        const item = d.factory(id);
        item.count = Math.max(1, Math.min(item.getMaxStack(), Math.floor(Number(count) || 1)));
        return item;
    },
    maxStack(id){
        if(!this._max.has(id)) this._max.set(id, this.create(id).getMaxStack());
        return this._max.get(id);
    },
    look(itemOrId){
        const id = typeof itemOrId === 'string' ? itemOrId : itemOrId && itemOrId.id;
        const d = this.defs.get(id);
        return d ? d.look : { color:'#cccccc', icon:'raw' };
    },
};

// Wood (one set per naturalMaterials.logs entry)
for(const t of logTypes){
    const L = logLook(t);
    Items.define(`${t}_log`,     id => new Material(id, 64, 1).package(new Fuel(2)).addTag('log', 'fuel', 'wood'), { color:L.bark, icon:'log', accent:L.planks });
    Items.define(`${t}_planks`,  id => new BlockItem(id, id).package(new Fuel(1)).addTag('planks', 'fuel', 'wood'), { color:L.planks, icon:'block' });
    Items.define(`${t}_sapling`, id => new BlockItem(id, id, 32).addTag('sapling'), { color:L.leaves, icon:'sapling' });
}
Items.define('stick', id => new Material(id, 64, 0).addTag('stick'), { color:'#9a7146', icon:'stick' });

// Nature blocks (every naturalMaterials.nature entry that isn't a floor)
for(const [id, n] of Object.entries(naturalMaterials.nature)){
    if(n.passable) continue;
    Items.define(id, i => new BlockItem(i, i).addTag(toolClass(n.tool) === 'pickaxe' ? 'stone' : 'soil'), { color:NATURE_COLORS[id] ?? '#8a8a8a', icon:'block' });
}

// Ores and ingots (from materialList)
for(const m of oreMaterials){
    if(DIRECT_ORE_DROPS.includes(m)) continue;
    Items.define(`raw_${m}`, id => new sMaterial(id, m).addTag('raw_ore'), { color:MATERIAL_COLORS[m], icon:'raw' });
}
Items.define('coal',   id => new sMaterial(id, 'coal').package(new Fuel(4)).addTag('fuel'), { color:MATERIAL_COLORS.coal, icon:'chunk' });
Items.define('sulfer', id => new sMaterial(id, 'sulfer'), { color:MATERIAL_COLORS.sulfer, icon:'chunk' });
for(const m of Object.keys(materialList)){
    if(DIRECT_ORE_DROPS.includes(m)) continue;
    Items.define(`${m}_ingot`, id => new sMaterial(id, m).addTag('ingot'), { color:MATERIAL_COLORS[m], icon:'ingot' });
}

// Tools (Pickaxe / Axe / Shovel / Hoe are the engine's item.js classes).
// Wooden tools are tier 1, stone tools tier 2. A hoe tills grass into
// farmland, and its tier is the crop tier it can harvest.
const SOIL_TAGS = ['dirt', 'sand', 'gravel', 'clay', 'farmland'];
const HOE_TAGS  = ['grass', 'farmland', 'plant'];
Items.define('wooden_hoe',     id => new Hoe(id, 1, 1.4, 60,  HOE_TAGS), { color:'#b98d55', icon:'hoe' });
Items.define('stone_hoe',      id => new Hoe(id, 2, 1.9, 120, HOE_TAGS), { color:'#8a8a8a', icon:'hoe' });
Items.define('wooden_pickaxe', id => new Pickaxe(id, 1, 1.2, 50,  ['stone', 'ore']), { color:'#b98d55', icon:'pickaxe' });
Items.define('stone_pickaxe',  id => new Pickaxe(id, 2, 1.6, 110, ['stone', 'ore']), { color:'#8a8a8a', icon:'pickaxe' });
Items.define('wooden_axe',     id => new Axe(id, 1, 1.6, 60,  ['wood', 'plant']), { color:'#b98d55', icon:'axe' });
Items.define('stone_axe',      id => new Axe(id, 2, 2.2, 120, ['wood', 'plant']), { color:'#8a8a8a', icon:'axe' });
Items.define('wooden_shovel',  id => new Shovel(id, 1, 1.6, 60,  SOIL_TAGS), { color:'#b98d55', icon:'shovel' });
Items.define('stone_shovel',   id => new Shovel(id, 2, 2.2, 120, SOIL_TAGS), { color:'#8a8a8a', icon:'shovel' });
for(const m of materialsFor('tool')){
    Items.define(`${m}_pickaxe`, id => new sPickaxe(id, m), { color:MATERIAL_COLORS[m], icon:'pickaxe' });
}



// Crops: produce (food, or a material when edible:false) + seeds, from the `crops` table
for(const id of Crops.ids()){
    const c = Crops.get(id), L = cropLook(id);
    Items.define(id, i => c.edible
        ? new Consumable(i, c.hunger, c.saturation, c.health).addTag('crop', 'food')
        : new Material(i, 64, 1).addTag('crop'), { color:L.produce, icon: L.shape === 'berries' ? 'berries' : 'produce', shape:L.shape, accent:L.plant });
    if(c.seed === `${id}_seeds`) Items.define(c.seed, i => new CropSeedItem(i, id), { color:L.produce, icon:'seeds', accent:L.plant });
}
Items.define('berry_bush',  id => new BlockItem(id, 'berry_bush', 16), { color:'#3c7a34', icon:'bush' });
Items.define('plant_fiber', id => new Material(id, 64, 0).addTag('fiber'), { color:'#8fb35a', icon:'fiber' });

// Fibers and fabric (the loom refines them): plant fiber -> thread, hemp -> cloth -> silk
Items.define('flint',  id => new Material(id, 64, 1).addTag('flint'), { color:'#4a4a55', icon:'chunk' });
Items.define('thread', id => new Material(id, 64, 1).addTag('thread'), { color:'#e8dfc4', icon:'thread' });
Items.define('cloth',  id => new Material(id, 64, 2).addTag('fabric'), { color:'#cdb88e', icon:'cloth' });
Items.define('silk',   id => new Material(id, 64, 4).addTag('fabric'), { color:'#f1eafc', icon:'cloth', accent:'#c9b8ff' });

/**
 * Gear tiers. Like metal pickaxes, gear made from a material is that
 * material's tier + 1 (wood = 1). Its binding:
 *   tier 1 -> plant fiber, tier 2-3 -> thread, tier 4+ -> silk.
 */
const gearTier   = m => m === 'wood' ? 1 : m === 'stone' ? 2 : materialTier(m) + 1;
const bindingFor = tier => tier <= 1 ? 'plant_fiber' : tier <= 3 ? 'thread' : 'silk';
const WEAPON_METALS = materialsFor('weapon');
const ARMOR_METALS  = materialsFor('armor');

/** A bow / crossbow: range in cells, seconds between shots, damage multiplier. Shoots arrows. */
class Launcher extends ItemComponent {
    static id = 'launcher';
    constructor(range = 5, cooldown = 1, power = 1){ super(); Object.assign(this, { range, cooldown, power }); }
}
ItemComponent.register(Launcher);
/** Food that can poison you: chance, seconds, health lost per second. */
class Poisonous extends ItemComponent {
    static id = 'poisonous';
    constructor(chance = 1, seconds = 12, dps = 1.5){ super(); Object.assign(this, { chance, seconds, dps }); }
}
ItemComponent.register(Poisonous);

/** Food that heals over time after you eat it: health per second, for `seconds`. */
class Regeneration extends ItemComponent {
    static id = 'regeneration';
    constructor(rate = 1, seconds = 20){ super(); Object.assign(this, { rate, seconds }); }
}
ItemComponent.register(Regeneration);

/**
 * Meat from animals. raw / cooked = [hunger, saturation]; `poison` = chance
 * that eating it RAW poisons you (cook it in the cooking pot). `grease` =
 * chance that cooking one also leaves a grease in the pot's output.
 */
const MEATS = {
    venison:      { raw:[4, 1], cooked:[18, 8],  poison:0.15, grease:0.5,  color:'#a8423a' },
    bear_meat:    { raw:[5, 1], cooked:[24, 10], poison:0.6,  grease:1,    color:'#8a3430' },
    rabbit:       { raw:[3, 1], cooked:[12, 5],  poison:0.3,  grease:0.3,  color:'#d07a70' },
    beef:         { raw:[4, 1], cooked:[20, 9],  poison:0.2,  grease:0.8,  color:'#b8403c' },
    pork:         { raw:[4, 1], cooked:[20, 8],  poison:0.5,  grease:1,    color:'#e39a9a' },
    chicken:      { raw:[3, 1], cooked:[14, 6],  poison:0.7,  grease:0.5,  color:'#f0c0b0' },
    bird_meat:    { raw:[2, 0], cooked:[9, 4],   poison:0.4,  grease:0.3,  color:'#c86a5a' },
    rotten_flesh: { raw:[4, 0], cooked:null,     poison:1,                 color:'#6f7f4a' },
};
const rawMeatId    = k => k === 'rotten_flesh' ? k : `raw_${k}`;
const cookedMeatId = k => `cooked_${k}`;
for(const [k, m] of Object.entries(MEATS)){
    Items.define(rawMeatId(k), id => new Consumable(id, m.raw[0], m.raw[1]).package(new Poisonous(m.poison)).addTag('food', 'meat', 'raw_meat'),
        { color:m.color, icon:'meat' });
    if(m.cooked) Items.define(cookedMeatId(k), id => new Consumable(id, m.cooked[0], m.cooked[1]).addTag('food', 'meat', 'cooked_meat'), { color:'#8a5232', icon:'meat', accent:m.color });
}

// Grease: left over from cooking meat. Makes better torches / lamps and better food.
Items.define('grease', id => new Material(id, 64, 1).addTag('grease'), { color:'#e8d38a', icon:'grease' });

// Food made in the cooking pot
Items.define('bread',          id => new Consumable(id, 22, 8).addTag('food'),  { color:'#c98a45', icon:'food' });
Items.define('cooked_rice',    id => new Consumable(id, 18, 9).addTag('food'),  { color:'#f3efe2', icon:'food', accent:'#8a5a3a' });
Items.define('baked_potato',   id => new Consumable(id, 16, 7).addTag('food'),  { color:'#b8844a', icon:'produce', shape:'round', accent:'#6b4a2a' });
Items.define('vegetable_stew', id => new Consumable(id, 34, 14, 4).addTag('food'), { color:'#c9742e', icon:'food', accent:'#6b4a2a' });
// Better food (cooked with grease): heals right away and / or regenerates health for a while.
//   new Consumable(id, hunger, saturation, health) + Regeneration(health per second, seconds)
const FINE_FOODS = {
    fried_potatoes: { food:[24, 10, 8],  regen:null,     color:'#e0b050', accent:'#8a5a2a', icon:'produce', shape:'round' },
    garlic_bread:   { food:[30, 12, 6],  regen:[0.5, 20], color:'#d9a050', accent:'#f3efe2', icon:'food' },
    fried_rice:     { food:[28, 14, 4],  regen:[0.6, 25], color:'#f0d890', accent:'#c07a3a', icon:'food' },
    meat_pie:       { food:[36, 16, 10], regen:[0.8, 20], color:'#b87838', accent:'#8a3a2a', icon:'food' },
    hearty_stew:    { food:[44, 20, 6],  regen:[1.2, 30], color:'#a84a2a', accent:'#6b4a2a', icon:'food' },
};
for(const [id, f] of Object.entries(FINE_FOODS)){
    Items.define(id, i => {
        const it = new Consumable(i, ...f.food).addTag('food', 'fine_food');
        if(f.regen) it.package(new Regeneration(...f.regen));
        return it;
    }, { color:f.color, accent:f.accent, icon:f.icon, shape:f.shape });
}

// Melee weapons: one cell of reach (you must stand next to the target, like mining).
Items.define('wooden_sword', id => new Sword(id, 7, 4, 1, 0, 80).addTag('melee'), { color:'#b98d55', icon:'sword' });
for(const m of WEAPON_METALS){
    const t = gearTier(m);
    Items.define(`${m}_sword`, id => new sWeapon(id, m, 4 + 3 * t, 4, 1, 0, 90 + 45 * t).addTag('sword', 'melee'), { color:MATERIAL_COLORS[m], icon:'sword' });
}
// Ranged weapons: shoot arrows from a distance (range in cells).
Items.define('bow',      id => new Bow(id, 1, 25, 'arrow', 0, 800, 'arrow', 150, 20).package(new Launcher(5, 1.0, 1.0)), { color:'#9a6b3a', icon:'bow' });
Items.define('crossbow', id => new Bow(id, 1, 25, 'arrow', 0, 800, 'arrow', 260, 30).package(new Launcher(7, 1.6, 1.6)).addTag('crossbow'), { color:'#7a5a3a', icon:'crossbow' });
Items.define('flint_arrow', id => new Ammo(id, 'arrow', 5, 0, 64).addTag('arrow'), { color:'#4a4a55', icon:'arrow' });
for(const m of WEAPON_METALS){
    Items.define(`${m}_arrow`, id => new Ammo(id, 'arrow', 5 + 2 * gearTier(m), 0, 64).addTag('arrow'), { color:MATERIAL_COLORS[m], icon:'arrow' });
}

/**
 * Armor: 4 pieces per set. Fabric sets (cloth, silk) are made on the loom,
 * metal sets (every materialList entry with 'armor' in its sets) on the
 * workbench. Defense = piece share * set multiplier. See damagePlayer().
 */
const ARMOR_PIECES = [
    { key:'helmet',     fabric:'hood',     slot:'head',  share:2, cost:3, cls: Helmet },
    { key:'chestplate', fabric:'tunic',    slot:'chest', share:5, cost:5, cls: Chestplate },
    { key:'leggings',   fabric:'trousers', slot:'legs',  share:4, cost:4, cls: Leggings },
    { key:'boots',      fabric:'boots',    slot:'feet',  share:2, cost:2, cls: Boots },
];
const ARMOR_SETS = {};   // set id -> { pieces: [itemId per ARMOR_PIECES], tier, ... }
const defenseOf = (share, mult) => Math.max(1, Math.round(share * mult));
for(const [fab, mult, dur, tier] of [['cloth', 0.5, 60, 1], ['silk', 1, 120, 4]]){
    ARMOR_SETS[fab] = { tier, pieces: ARMOR_PIECES.map(p => {
        const id = `${fab}_${p.fabric}`;
        Items.define(id, i => new p.cls(i, defenseOf(p.share, mult), 0, dur, p.slot), { color: fab === 'silk' ? '#e9e0fb' : '#cdb88e', icon:'armor', piece:p.slot });
        return id;
    }) };
}
for(const m of ARMOR_METALS){
    const t = gearTier(m), mult = 0.6 + 0.35 * t;
    ARMOR_SETS[m] = { tier: t, pieces: ARMOR_PIECES.map(p => {
        const id = `${m}_${p.key}`;
        Items.define(id, i => new sArmor(i, m, defenseOf(p.share, mult), 0, 100 + 40 * t, p.slot), { color:MATERIAL_COLORS[m], icon:'armor', piece:p.slot });
        return id;
    }) };
}

// Water
Items.define('canteen', id => new Canteen(id, 4), { color:'#7a8f9a', icon:'canteen' });
Items.define('bucket',  id => new Bucket(id, 8),  { color:'#9b6b3d', icon:'bucket' });

// Stations + base building
Items.define('workbench',   id => new BlockItem(id, id, 8),  { color:'#9b6b3d', icon:'workbench' });
Items.define('forge',       id => new BlockItem(id, id, 8),  { color:'#8a6656', icon:'furnace' });
Items.define('loom',        id => new BlockItem(id, id, 8),  { color:'#a8834f', icon:'loom' });
Items.define('cooking_pot', id => new BlockItem(id, id, 8),  { color:'#5a5f66', icon:'pot' });
Items.define('chest',       id => new BlockItem(id, id, 16), { color:'#a0703a', icon:'chest' });
Items.define('wooden_wall', id => new BlockItem(id, id, 64).addTag('wall'), { color:'#a77b4a', icon:'wall' });
Items.define('stone_wall',  id => new BlockItem(id, id, 64).addTag('wall'), { color:'#8d8d8d', icon:'wall' });
Items.define('wooden_door', id => new BlockItem(id, id, 16).addTag('door'), { color:'#93683c', icon:'door' });
Items.define('glass',       id => new BlockItem(id, id, 64), { color:'#bfe3ea', icon:'glass' });
Items.define('torch',       id => new BlockItem(id, id, 32).addTag('torch', 'light'), { color:'#ffb347', icon:'torch' });
Items.define('grease_torch', id => new BlockItem(id, id, 32).addTag('torch', 'light'), { color:'#ffd27a', icon:'torch', accent:'#e8d38a' });
Items.define('oil_lamp',    id => new BlockItem(id, id, 16).addTag('lamp', 'light'), { color:'#b0745a', icon:'lamp' });


/* ---------------------------------------------------------------------
 * 4. Blocks: what can sit in a cell
 *   Blocks.define(id, {
 *     name, kind ('stone'|'soil'|'ore'|'tree'|'sapling'|'plant'|'fern'|'farmland'|
 *                 'planks'|'station'|'wall'|'door'|'glass'|'torch'|'ore_heart'),
 *     tag        what tools' `effective` lists match ('stone','ore','wood','plant','dirt','sand','gravel','clay','farmland')
 *     solid      true = the cell can't be walked through (default true). Sand and torches
 *                are walk-over blocks (solid:false) that can still be dug up / picked up.
 *     passableFor  movers that CAN go through a solid block: ['player'] (doors),
 *                  ['animal', 'zombie'] (farmland: blocks only the player, so crops aren't trampled)
 *                  Movers: 'player', 'animal', 'zombie' ('bird' flies over everything).
 *     replaceable  true = placing a block / tilling just removes it (ferns)
 *     hardness   relative to stone (1); < 0 instant, >= 10 unbreakable. See miningInfo()
 *     tier       0 = anything (hands too) breaks it; > 0 needs a `tool` of that tier or higher
 *     tool       'pickaxe' | 'axe' | 'shovel' | 'hoe' (the tool class it needs / that mines it faster)
 *     drops      [[itemId, min, max = min, chance = 1, insteadId], ...]   or dropsFor(blockState) -> same
 *                (insteadId: what drops when the chance misses, e.g. gravel: flint OR gravel)
 *     grow       { into: blockId, seconds }  turns into another block over time
 *     siege      'wood' | 'stone' | 'glass': hostile creatures can break it (see CREATURES `breaks`)
 *     light      glow radius in px (torches); `safe` = no hostile spawns within that many cells
 *     built      true = something the player builds (natural regrowth keeps away from it)
 *     init(b)    fills in a new block's state (containers, plants...)
 *     placeState()  state given to a block placed by the player
 *     station    'workbench' | 'forge' | 'chest'
 *     color, accent, ...  for drawing
 *   })
 * --------------------------------------------------------------------- */
const Blocks = {
    defs: {},
    define(id, def){
        this.defs[id] = Object.assign({
            id, name: prettify(id), kind:'block', tag:'stone', solid:true,
            hardness:1, tier:0, tool:null, drops:[[id, 1]], color:'#888888',
        }, def);
        return this.defs[id];
    },
    get(id){ return this.defs[id] ?? null; },
};

// naturalMaterials.nature: every entry that isn't a floor is a block (solid, except WALKABLE_SOIL)
const WALKABLE_SOIL = ['sand'];   // you walk over these but can still dig them up
for(const [id, n] of Object.entries(naturalMaterials.nature)){
    if(n.passable) continue;
    const tool = toolClass(n.tool);
    Blocks.define(id, {
        kind: tool === 'pickaxe' ? 'stone' : 'soil',
        tag:  tool === 'pickaxe' ? 'stone' : id,
        color: NATURE_COLORS[id] ?? '#888888',
        hardness: n.hardness ?? 1, tier: n.tier ?? 0, tool,
        solid: !WALKABLE_SOIL.includes(id),
        drops: id === 'gravel' ? [['flint', 1, 1, 0.5, 'gravel']] : [[id, 1]],   // gravel: 50% flint, otherwise the gravel itself
    });
}
// Sand dunes: piled-up sand ridges in the desert. Unlike loose sand you can't walk over them.
Blocks.define('sand_dune', {
    name:'Sand Dune', kind:'soil', tag:'sand', color:'#d2b46a', hardness:0.35, tool:'shovel',
    drops: [['sand', 2, 3]],
});

// materialList ores (hardness: materialList[m].hardness, default 1 = stone)
for(const m of oreMaterials){
    const tier = materialTier(m);
    Blocks.define(`${m}_ore`, {
        kind:'ore', tag:'ore', material:m, color:'#6c6c6c', accent:MATERIAL_COLORS[m],
        hardness: materialList[m].hardness ?? 1, tier, tool:'pickaxe',
        drops: [[oreDropOf(m), 1, tier <= 2 ? 2 : 1]],
    });
    // Ore heart: can't be mined, slowly grows its ore back around it (see tickOreHearts)
    Blocks.define(`${m}_ore_heart`, {
        name:`${prettify(m)} Ore Heart`, kind:'ore_heart', tag:'ore', material:m, color:'#4e4e56', accent:MATERIAL_COLORS[m],
        hardness:10, tier, tool:'pickaxe', drops: [], light: 45,
    });
}

// naturalMaterials.logs: a tree, sapling and planks block per log type
for(const t of logTypes){
    const L = logLook(t), log = naturalMaterials.logs[t];
    Blocks.define(`${t}_tree`, {
        kind:'tree', tag:'wood', tree:t, color:L.bark, accent:L.leaves, conifer:!!L.conifer, passableFor:['zombie'],
        hardness: log.hardness ?? 0.6, tier: log.tier ?? 0, tool: toolClass(log.tool ?? 'axe'),
        drops: [[`${t}_log`, 3, 5], [`${t}_sapling`, 1, 1, 0.6]],
    });
    Blocks.define(`${t}_sapling`, {
        kind:'sapling', tag:'plant', tree:t, color:L.leaves, hardness:-1, tool:'axe',
        grow: { into:`${t}_tree`, seconds:90 },
    });
    Blocks.define(`${t}_planks`, {
        kind:'planks', tag:'wood', siege:'wood', color:L.planks, hardness: log.hardness ?? 0.6, tool:'axe',
    });
}

/*
 * Plants. Every plant block keeps `b.plant = { crop, age (in game days), dry (days) }`
 * (see section 9 for growing / harvesting). Wild plants and berry bushes
 * grow without water; crops on farmland need the farmland's water.
 */
const newPlant = (crop, age = 0) => ({ crop, age, dry: 0 });
Blocks.define('berry_bush', {
    name:'Berry Bush', kind:'plant', crop:'berries', tag:'plant', color:'#3c7a34', hardness:0.2, tool:'axe', passableFor:['zombie'],
    drops: [['berry_bush', 1]],
    init(b){ if(!b.plant) b.plant = newPlant('berries', Crops.get('berries').ripeAge); },
    placeState: () => ({ plant: newPlant('berries', 0) }),
});
// A wild plant for every other crop (rare, see FARM.wildChance)
for(const id of Crops.ids()){
    if(id === 'berries') continue;
    const c = Crops.get(id);
    Blocks.define(`wild_${id}`, {
        name:`Wild ${prettify(id)}`, kind:'plant', crop:id, tag:'plant', color:cropLook(id).plant, hardness:0.2, tool:'hoe', passableFor:['zombie'],
        drops: Items.has(c.seed) ? [[c.seed, 1]] : [],
        init(b){ if(!b.plant) b.plant = newPlant(id, c.ripeAge + Math.random() * 0.3 * (Math.min(c.rotAge, c.ripeAge * 2) - c.ripeAge)); },
    });
}

// Ferns: walk-through ground cover. Gather them for plant fibers (and sometimes a seed).
Blocks.define('fern', {
    kind:'fern', tag:'plant', solid:false, replaceable:true, color:'#4f9a46', hardness:-1, tool:'hoe',
    drops: [['plant_fiber', 1]],
});

// Farmland: tilled grass that holds water (FARM.waterMax) and one crop.
// Solid for the player only, so the crops don't get trampled.
Blocks.define('farmland', {
    kind:'farmland', tag:'farmland', passableFor:['animal', 'zombie'], color:'#6b4a2e', hardness:0.3, tool:'hoe',
    drops: [],
    dropsFor: b => b.plant ? [[Crops.get(b.plant.crop).seed, 1]] : [],
    init(b){ if(b.water == null) b.water = 0; if(b.plant === undefined) b.plant = null; },
});

// Stations / containers
// Zombies shamble through workbenches / looms / cooking pots / chests (but not doors or the forge).
Blocks.define('workbench', { kind:'station', station:'workbench', tag:'wood',  color:'#9b6b3d', hardness:0.6, tool:'axe', passableFor:['zombie'] });
Blocks.define('loom',        { kind:'station', station:'loom', tag:'wood',  color:'#a8834f', hardness:0.6, tool:'axe', passableFor:['zombie'] });
/** Input / fuel / output slots of a forge-like station (cfg = FORGE or POT). */
const machineState = (cfg, accepts) => ({
    input:  new Box(cfg.input,  accepts),
    fuel:   new Box(cfg.fuel,   item => fuelValue(item) > 0),
    output: new Box(cfg.output, () => false),
    burn: 0, burnMax: 0, progress: 0, active: null, lit: false, status: 'Idle',
});
Blocks.define('cooking_pot', {
    kind:'station', station:'pot', tag:'stone', color:'#5a5f66', hardness:0.8, tool:'pickaxe', passableFor:['zombie'],
    init(b){ if(!b.input) Object.assign(b, machineState(POT, item => isCookable(item))); },
});
Blocks.define('forge', {
    kind:'station', station:'forge', tag:'stone', color:'#8a6656', hardness:1, tool:'pickaxe',
    init(b){ if(!b.input) Object.assign(b, machineState(FORGE, item => isSmeltable(item))); },
});
Blocks.define('chest', {
    kind:'station', station:'chest', tag:'wood', color:'#a0703a', hardness:0.6, tool:'axe', passableFor:['zombie'],
    init(b){ if(!b.box) b.box = new Box(CHEST_SLOTS); },
});

// Base building
Blocks.define('wooden_wall', { kind:'wall', tag:'wood',  siege:'wood',  color:'#a77b4a', hardness:0.8, tool:'axe' });
Blocks.define('stone_wall',  { kind:'wall', tag:'stone', siege:'stone', color:'#8d8d8d', hardness:1.4, tier:1, tool:'pickaxe' });
Blocks.define('wooden_door', { kind:'door', tag:'wood',  siege:'wood',  color:'#93683c', hardness:0.6, tool:'axe', passableFor:['player'] });
Blocks.define('glass',       { kind:'glass', tag:'stone', siege:'glass', color:'#bfe3ea', hardness:0.3 });
// Torch: lights the area around it and stops hostile creatures spawning nearby. You walk over it.
Blocks.define('torch', { kind:'torch', tag:'wood', solid:false, color:'#ffb347', hardness:-1, light: TORCH.light, safe: TORCH.safe });
// Better lights made with grease: a brighter torch, and an oil lamp (brightest, keeps monsters furthest away)
Blocks.define('grease_torch', { kind:'torch', tag:'wood', solid:false, color:'#ffd27a', hardness:-1, light: TORCH.greaseLight, safe: TORCH.greaseSafe });
Blocks.define('oil_lamp',     { kind:'lamp', tag:'stone', solid:false, color:'#b0745a', hardness:-1, light: TORCH.lampLight, safe: TORCH.lampSafe });

// Everything the player builds (natural regrowth keeps its distance)
for(const d of Object.values(Blocks.defs)) if(['station', 'wall', 'door', 'glass', 'planks', 'torch', 'lamp', 'farmland'].includes(d.kind)) d.built = true;


/* ---------------------------------------------------------------------
 * 5. Recipes
 *   Recipe.add(station, output, inputs, opts)
 *     station  'hand' (inventory screen) | 'workbench' | 'forge' | any new station
 *     output   'itemId' | 'itemId:count' | { id, count }
 *     inputs   { itemId: count, '#tag': count, '@water': units }
 *              '#planks' = any item tagged planks,
 *              '@water'  = water units from a canteen / bucket you carry
 *     opts     { time (s, forge), id }
 *   Recipe.for('hand', 'workbench') lists recipes; recipe.canCraft(inv), .consume(inv)
 *   `inv` is anything with countOf(key) / take(key, n): the player's inventory
 *   or a container Box (the forge's input slots).
 * --------------------------------------------------------------------- */
class Recipe {
    static list = [];
    static _byId = new Map();

    static add(station, output, inputs = {}, opts = {}){
        const r = new Recipe(station, output, inputs, opts);
        Recipe.list.push(r);
        Recipe._byId.set(r.id, r);
        return r;
    }
    static for(...stations){ return Recipe.list.filter(r => stations.includes(r.station)); }
    static byId(id){ return Recipe._byId.get(id) ?? null; }
    /** Does `item` count as ingredient `key` ('itemId' or '#tag')? */
    static matches(item, key){
        if(!item) return false;
        return key.startsWith('#') ? item.hasTag(key.slice(1)) : item.id === key;
    }
    static label(key){
        if(key === '@water') return 'water (canteen / bucket)';
        return key.startsWith('#') ? `any ${prettify(key.slice(1))}` : prettify(key);
    }

    constructor(station = 'hand', output = null, inputs = {}, opts = {}){
        let id = output, count = 1;
        if(typeof output === 'string' && output.includes(':')) [id, count] = output.split(':');
        else if(output && typeof output === 'object'){ id = output.id; count = output.count ?? 1; }
        this.station = station;
        this.output  = { id, count: Math.max(1, Math.floor(Number(count) || 1)) };
        this.inputs  = { ...inputs };
        this.time    = Number(opts.time) || 0;
        this.byproduct = opts.byproduct ?? null;   // { id, count, chance }: also made (cooking pot: grease from meat)
        this.id      = opts.id ?? `${station}:${id}`;
        if(Recipe._byId.has(this.id)) console.warn(`Recipe '${this.id}' already exists: give it an opts.id.`);
        if(!Items.has(id)) console.warn(`Recipe '${this.id}': unknown output item '${id}'.`);
        for(const k of Object.keys(this.inputs)){
            if(!/^[#@]/.test(k) && !Items.has(k)) console.warn(`Recipe '${this.id}': unknown input item '${k}'.`);
        }
    }
    /** Ingredients short for `times` crafts: [{ key, need, have }]. */
    missing(inv, times = 1){
        return Object.entries(this.inputs)
            .map(([key, n]) => ({ key, need: n * times, have: inv.countOf(key) }))
            .filter(e => e.have < e.need);
    }
    canCraft(inv, times = 1){ return this.missing(inv, times).length === 0; }
    maxCrafts(inv){
        let m = Infinity;
        for(const [k, n] of Object.entries(this.inputs)) m = Math.min(m, Math.floor(inv.countOf(k) / n));
        return m === Infinity ? 0 : m;
    }
    /** Removes the ingredients for `times` crafts. False (nothing removed) when short. */
    consume(inv, times = 1){
        if(!this.canCraft(inv, times)) return false;
        for(const [k, n] of Object.entries(this.inputs)) inv.take(k, n * times);
        return true;
    }
}

// Hand (inventory screen)
for(const t of logTypes) Recipe.add('hand', `${t}_planks:4`, { [`${t}_log`]:1 });
Recipe.add('hand', 'stick:4',   { '#planks':2 });
Recipe.add('hand', 'workbench', { '#planks':4 });
Recipe.add('hand', 'clay:2',    { dirt:1, gravel:1, '@water':1 });   // wet dirt + gravel = clay
Recipe.add('hand', 'torch:4',   { stick:1, coal:1 });
Recipe.add('hand', 'grease_torch:4', { stick:2, grease:1, plant_fiber:1 });   // brighter, keeps monsters further away
Recipe.add('hand', 'torch:2',   { stick:2, plant_fiber:2 }, { id:'hand:torch_fiber' });   // before you have coal

// Workbench. Tools and weapons need a binding for their tier (see bindingFor):
// tier 1 (wood) = plant fiber, tier 2-3 = thread, tier 4+ = silk.
const bind = (tier, n = 2) => ({ [bindingFor(tier)]: n });
Recipe.add('workbench', 'wooden_pickaxe', { '#planks':3, stick:2, ...bind(1) });
Recipe.add('workbench', 'wooden_axe',     { '#planks':3, stick:2, ...bind(1) });
Recipe.add('workbench', 'wooden_shovel',  { '#planks':2, stick:2, ...bind(1) });
Recipe.add('workbench', 'wooden_hoe',     { '#planks':2, stick:2, ...bind(1) });
Recipe.add('workbench', 'wooden_sword',   { '#planks':2, stick:1, flint:1, ...bind(1) });
Recipe.add('workbench', 'bow',            { stick:3, ...bind(1, 3) });
Recipe.add('workbench', 'flint_arrow:4',  { flint:1, stick:1, ...bind(1, 1) });
Recipe.add('workbench', 'stone_pickaxe',  { stone:3, stick:2, ...bind(2, 1) });
Recipe.add('workbench', 'stone_axe',      { stone:3, stick:2, ...bind(2, 1) });
Recipe.add('workbench', 'stone_shovel',   { stone:1, stick:2, ...bind(2, 1) });
Recipe.add('workbench', 'stone_hoe',      { stone:2, stick:2, ...bind(2, 1) });
Recipe.add('workbench', 'crossbow',       { '#planks':3, tin_ingot:2, ...bind(3, 3) });
for(const m of materialsFor('tool')) Recipe.add('workbench', `${m}_pickaxe`, { [ingotOf(m)]:3, stick:2, ...bind(gearTier(m)) });
for(const m of WEAPON_METALS){
    Recipe.add('workbench', `${m}_sword`,   { [ingotOf(m)]:2, stick:1, ...bind(gearTier(m)) });
    Recipe.add('workbench', `${m}_arrow:6`, { [ingotOf(m)]:1, stick:2, ...bind(gearTier(m), 1) });
}
// Metal armor: ingots + a fabric lining (cloth up to tier 3, silk above).
for(const m of ARMOR_METALS){
    const t = gearTier(m), lining = t <= 3 ? 'cloth' : 'silk';
    ARMOR_PIECES.forEach((p, k) => Recipe.add('workbench', ARMOR_SETS[m].pieces[k], { [ingotOf(m)]: p.cost, [lining]: Math.ceil(p.cost / 2) }));
}
Recipe.add('workbench', 'forge',          { stone:6, clay:4 });
Recipe.add('workbench', 'loom',           { plant_fiber:5, oak_log:4, stone:2 });
Recipe.add('workbench', 'cooking_pot',    { clay:3, stone:2, stick:2 });
Recipe.add('workbench', 'oil_lamp',       { clay:2, grease:2, thread:1 });   // the brightest light
Recipe.add('workbench', 'canteen',        { '#planks':3 });
Recipe.add('workbench', 'bucket',         { '#planks':5, plant_fiber:3 });
Recipe.add('workbench', 'chest',          { '#planks':8 });
Recipe.add('workbench', 'wooden_wall:2',  { '#planks':3 });
Recipe.add('workbench', 'stone_wall:2',   { stone:3 });
Recipe.add('workbench', 'wooden_door',    { '#planks':4, stick:2 });

// Loom: refine fibers and fabric, and sew fabric armor.
Recipe.add('loom', 'thread',  { plant_fiber:3 });
Recipe.add('loom', 'cloth',   { hemp:3 });
Recipe.add('loom', 'silk',    { cloth:2, thread:2 });
for(const fab of ['cloth', 'silk']){
    ARMOR_PIECES.forEach((p, k) => Recipe.add('loom', ARMOR_SETS[fab].pieces[k], { [fab]: p.cost, thread: 1 }));
}

// Cooking pot (works like the forge: see POT). It only makes food. '@water' comes
// from a canteen / bucket put in its input slots. Meat can leave grease behind.
for(const [k, m] of Object.entries(MEATS)){
    if(!m.cooked) continue;
    Recipe.add('pot', cookedMeatId(k), { [rawMeatId(k)]:1 }, { time: 10, byproduct: m.grease ? { id:'grease', count:1, chance: m.grease } : null });
}
Recipe.add('pot', 'bread',          { wheat:3 },                                 { time: 12 });
Recipe.add('pot', 'cooked_rice',    { rice:2, '@water':1 },                      { time: 12 });
Recipe.add('pot', 'baked_potato',   { potato:1 },                                { time: 8 });
Recipe.add('pot', 'vegetable_stew', { carrot:1, potato:1, onion:1, '@water':1 }, { time: 16 });
// Better food, cooked with grease (heals and / or regenerates health, see FINE_FOODS)
Recipe.add('pot', 'fried_potatoes', { potato:2, grease:1 },                      { time: 10 });
Recipe.add('pot', 'garlic_bread',   { bread:1, garlic:1, grease:1 },             { time: 10 });
Recipe.add('pot', 'fried_rice',     { cooked_rice:1, onion:1, grease:1 },        { time: 12 });
Recipe.add('pot', 'meat_pie',       { wheat:2, '#cooked_meat':1, grease:1 },     { time: 18 });
Recipe.add('pot', 'hearty_stew',    { '#cooked_meat':1, carrot:1, onion:1, grease:1, '@water':1 }, { time: 20 });
for(const r of Recipe.for('pot')) if(!Items.create(r.output.id).has('consume')) console.warn(`Cooking pot recipe '${r.id}' doesn't make food: the pot only cooks food.`);

/**
 * Can this item go into a cooking pot input slot? Ingredients of pot recipes
 * only, plus canteens / buckets (the water for soups and rice).
 */
function isCookable(item){
    if(!item) return false;
    const recipes = Recipe.for('pot');
    if(waterOf(item)) return recipes.some(r => '@water' in r.inputs);
    return recipes.some(r => Object.keys(r.inputs).some(k => Recipe.matches(item, k)));
}

// Forge. It runs ONE recipe at a time, picked from what's in its input slots.
// Smelt every raw ore, forge every materialList recipe (alloys)...
for(const m of oreMaterials){
    if(DIRECT_ORE_DROPS.includes(m)) continue;
    Recipe.add('forge', `${m}_ingot`, { [`raw_${m}`]:1 }, { time: 10 + 2 * materialTier(m) });
}
for(const [m, info] of Object.entries(materialList)){
    if(!info.recipe) continue;
    const inputs = {};
    for(const [k, n] of Object.entries(info.recipe)) inputs[ingotOf(k)] = n;
    Recipe.add('forge', `${m}_ingot`, inputs, { time: 16 + 2 * materialTier(m), id:`forge:${m}_alloy` });
}
// ...burn natural resources down to carbon waste (coal)...
Recipe.add('forge', 'coal', { '#log':1 },        { time: 8, id:'forge:coal_from_log' });
Recipe.add('forge', 'coal', { '#planks':3 },     { time: 8, id:'forge:coal_from_planks' });
Recipe.add('forge', 'coal', { plant_fiber:4 },   { time: 6, id:'forge:coal_from_fiber' });
Recipe.add('forge', 'coal', { '#sapling':2 },    { time: 6, id:'forge:coal_from_saplings' });
// ...and fire sand.
Recipe.add('forge', 'glass',       { sand:1 },  { time: 8 });

/** Can this item go into a forge input slot (is it used by any forge recipe)? */
function isSmeltable(item){
    if(!item) return false;
    return Recipe.for('forge').some(r => Object.keys(r.inputs).some(k => Recipe.matches(item, k)));
}
/** Fuel units of an item (coal 4, log 2, planks 1, 0 = not fuel). */
function fuelValue(item){ const f = item && item.get ? item.get('fuel') : null; return f ? f.ticks : 0; }


/* ---------------------------------------------------------------------
 * 6. SurvivalInventory
 *   Slots 1..(slots - hotbar) are the backpack, the last `hotbar` slots are
 *   the hotbar. New items join matching stacks first, then take a backpack
 *   slot; a hotbar slot is only used when the backpack is full. The engine's
 *   `inv.hotbar` entries are kept pointing at the hotbar slots.
 * --------------------------------------------------------------------- */
class SurvivalInventory extends Inventory {
    constructor(inv = 47, hotbar = 7, skills = 5){
        super(inv, hotbar, skills);
        this.appendMode = 'first';
        this.hotbarStart = inv - hotbar + 1;
        this.on('change', () => this._linkHotbar());
    }
    get backpackSlots(){ const a = []; for(let i = 1; i < this.hotbarStart; i++) a.push(i); return a; }
    get hotbarSlotList(){ const a = []; for(let i = this.hotbarStart; i <= this.slots; i++) a.push(i); return a; }
    isHotbarSlot(s){ return s >= this.hotbarStart && s <= this.slots; }
    /** Inventory slot of hotbar position i (1-based). */
    hotbarSlot(i){ return this.hotbarStart + i - 1; }
    hotbarItem(i){ return this[this.hotbarSlot(i)] ?? null; }

    _linkHotbar(){
        for(let i = 1; i <= this.hotbar.slots; i++){
            const s = this.hotbarSlot(i);
            this.hotbar[i] = this[s] ? { inventorySlot: s, item: this[s] } : null;
        }
    }
    _changed(info = {}){
        for(let i = 1; i <= this.slots; i++) if(this[i] && this[i].count <= 0) this[i] = null;
        this._emit('change', info);
    }
    _firstEmpty(){
        return this.backpackSlots.find(i => this[i] == null) ?? this.hotbarSlotList.find(i => this[i] == null) ?? null;
    }

    /* Slot interface shared with Box (containers), used by the slot UI. */
    get firstSlot(){ return 1; }
    get lastSlot(){ return this.slots; }
    getSlot(i){ return this[i] ?? null; }
    setSlot(i, item){ this[i] = item ?? null; }
    accepts(){ return true; }
    changed(info){ this._changed(info); }

    /** How many of key ('itemId', '#tag' or '@water') are held. */
    countOf(key){
        let n = 0;
        if(key === '@water'){
            for(let i = 1; i <= this.slots; i++){ const w = waterOf(this[i]); if(w) n += w.value; }
            return n;
        }
        for(let i = 1; i <= this.slots; i++) if(this[i] && Recipe.matches(this[i], key)) n += this[i].count;
        return n;
    }
    /** Remove up to n of key (backpack first). Returns how many were removed. */
    take(key, n = 1){
        let left = n;
        for(const s of [...this.backpackSlots, ...this.hotbarSlotList]){
            if(left <= 0) break;
            const it = this[s];
            if(key === '@water'){
                const w = waterOf(it);
                if(w){ const k = Math.min(left, w.value); w.value -= k; left -= k; }
                continue;
            }
            if(!it || !Recipe.matches(it, key)) continue;
            left -= it.removeCount(Math.min(left, it.count));
        }
        this._changed({ event:'take', key });
        return n - left;
    }
    /** How many more of this item fit. */
    roomFor(item){
        let room = 0;
        const max = item.getMaxStack();
        for(let i = 1; i <= this.slots; i++){
            const it = this[i];
            if(!it) room += max;
            else if(it !== item && it.canStackWith(item)) room += it.spaceLeft();
        }
        return room;
    }
    /** Adds an item stack. Returns how many did NOT fit (0 = all of it). */
    give(item){
        if(!(item instanceof Item) || item.count <= 0) return 0;
        if(item.getMaxStack() > 1){
            for(const s of [...this.hotbarSlotList, ...this.backpackSlots]){
                const st = this[s];
                if(st && st !== item && st.canStackWith(item)) st.mergeFrom(item);
                if(item.count <= 0) break;
            }
        }
        if(item.count > 0){
            const s = this._firstEmpty();
            if(s != null){
                this[s] = item;
                this._changed({ event:'add', slot:s, item });
                return 0;
            }
        }
        this._changed({ event:'give', item });
        return Math.max(0, item.count);
    }
    /** append(item) with no slot uses give() (backpack first, hotbar last). */
    append(n, slot = null, overflow = 'trash', destination = 'inventory'){
        if((destination == null || destination === 'inventory') && (slot == null || slot === 0) && n instanceof Item){
            return this.give(n) === 0;
        }
        return super.append(n, slot, overflow, destination);
    }
    /** Drop slot a onto slot b: merge matching stacks, otherwise swap. */
    moveOrSwap(a, b){
        if(a === b) return false;
        const A = this[a], B = this[b];
        if(A && B && A !== B && B.canStackWith(A) && !B.isFullStack()){
            B.mergeFrom(A);
        } else {
            this[a] = B ?? null;
            this[b] = A ?? null;
        }
        this._changed({ event:'swap', a, b });
        return true;
    }
    /** Shift-click: move a stack between the hotbar and the backpack. */
    quickMove(s){
        const item = this[s];
        if(!item) return false;
        const region = this.isHotbarSlot(s) ? this.backpackSlots : this.hotbarSlotList;
        if(item.getMaxStack() > 1){
            for(const t of region){
                const st = this[t];
                if(st && st !== item && st.canStackWith(item)) st.mergeFrom(item);
                if(item.count <= 0) break;
            }
        }
        if(item.count > 0){
            const t = region.find(i => this[i] == null);
            if(t != null){ this[t] = item; this[s] = null; }
        }
        this._changed({ event:'quickMove', slot:s });
        return true;
    }
    /** Right-click: half of a stack into the first empty slot. */
    splitHalf(s){
        const it = this[s];
        if(!it || it.count < 2) return false;
        const t = this._firstEmpty();
        if(t == null) return false;
        this[t] = it.split(Math.floor(it.count / 2));
        this._changed({ event:'split', slot:s, to:t });
        return true;
    }
    /** Take a specific item object out of whichever slot holds it. */
    removeRef(item){
        for(let i = 1; i <= this.slots; i++) if(this[i] === item){ this[i] = null; this._changed({ event:'remove', slot:i, item }); return true; }
        return false;
    }
}

/**
 * A container's slots (forge input / fuel / output, chests). Same slot
 * interface as SurvivalInventory (getSlot, setSlot, accepts, changed,
 * countOf, take), so recipes and the slot UI work on both.
 *   new Box(size, accept = item => true)
 */
class Box {
    constructor(size = 9, accept = null){
        this.size = Math.max(1, Math.floor(size));
        this.items = new Array(this.size).fill(null);
        this._accept = accept;
    }
    get firstSlot(){ return 0; }
    get lastSlot(){ return this.size - 1; }
    getSlot(i){ return this.items[i] ?? null; }
    setSlot(i, item){ this.items[i] = item ?? null; }
    accepts(item){ return !item || !this._accept || !!this._accept(item); }
    changed(){ for(let i = 0; i < this.size; i++) if(this.items[i] && this.items[i].count <= 0) this.items[i] = null; }
    get isEmpty(){ return this.items.every(it => !it); }
    countOf(key){
        let n = 0;
        if(key === '@water'){ for(const it of this.items){ const w = waterOf(it); if(w) n += w.value; } return n; }   // canteens / buckets in the box
        for(const it of this.items) if(it && Recipe.matches(it, key)) n += it.count;
        return n;
    }
    take(key, n = 1){
        let left = n;
        for(const it of this.items){
            if(left <= 0) break;
            if(key === '@water'){ const w = waterOf(it); if(w){ const k = Math.min(left, w.value); w.value -= k; left -= k; } continue; }
            if(it && Recipe.matches(it, key)) left -= it.removeCount(Math.min(left, it.count));
        }
        this.changed();
        return n - left;
    }
    roomFor(item){
        let room = 0;
        for(const it of this.items){
            if(!it) room += item.getMaxStack();
            else if(it !== item && it.canStackWith(item)) room += it.spaceLeft();
        }
        return room;
    }
    /** Adds a stack (matching stacks first). Returns how many did NOT fit. */
    give(item){
        if(!item || item.count <= 0) return 0;
        if(item.getMaxStack() > 1) for(const it of this.items){ if(it && it !== item && it.canStackWith(item)) it.mergeFrom(item); if(item.count <= 0) break; }
        if(item.count > 0){
            const k = this.items.findIndex(it => !it);
            if(k >= 0){ this.items[k] = item; return 0; }
        }
        this.changed();
        return Math.max(0, item.count);
    }
    /** Moves everything it can into `inv` (give). Returns true when it ended up empty. */
    emptyInto(inv){
        for(let i = 0; i < this.size; i++){
            const it = this.items[i];
            if(!it) continue;
            if(inv.give(it) === 0) this.items[i] = null;
        }
        this.changed();
        return this.isEmpty;
    }
}

/* Slot references: { box, i } where box is player.inventory or a Box. */
const slotRef  = (box, i) => ({ box, i });
const refItem  = r => r ? r.box.getSlot(r.i) : null;
const sameRef  = (a, b) => !!(a && b && a.box === b.box && a.i === b.i);
/** Drop slot a onto slot b (any two containers): merge matching stacks, otherwise swap. */
function moveOrSwapRef(a, b){
    if(sameRef(a, b)) return false;
    const A = refItem(a), B = refItem(b);
    if(!A) return false;
    if(!b.box.accepts(A) || (B && !a.box.accepts(B))){ notify("That can't go in that slot.", '#ffb070'); return false; }
    if(B && B !== A && B.canStackWith(A) && !B.isFullStack()) B.mergeFrom(A);
    else { a.box.setSlot(a.i, B ?? null); b.box.setSlot(b.i, A); }
    a.box.changed({ event:'swap' });
    if(b.box !== a.box) b.box.changed({ event:'swap' });
    return true;
}
/** Right-click: half a stack into the first empty slot of the same container. */
function splitRef(r){
    if(r.box === player.inventory) return player.inventory.splitHalf(r.i);
    const it = refItem(r);
    if(!it || it.count < 2) return false;
    for(let k = r.box.firstSlot; k <= r.box.lastSlot; k++){
        if(!r.box.getSlot(k)){ r.box.setSlot(k, it.split(Math.floor(it.count / 2))); r.box.changed(); return true; }
    }
    return false;
}


/* ---------------------------------------------------------------------
 * 7. World state + generation
 * --------------------------------------------------------------------- */
const areaZones = {
    home: new tileMatrix(0, 0, MAP_COLS, MAP_ROWS, HEX_W, HEX_H, {
        shape: 'hex',
        orientation: 'pointy',
        logErrors: false,
        pathing: new PathingAI({ speed: 150 }),
    }, SCENE_ID),
};
areaZones.home.debug = { grid:false, states:false, gridColor:'rgba(255,255,255,0.25)',
    colors:{ empty:null, occupied:'rgba(80,160,255,0.45)', reserved:'rgba(255,220,60,0.35)', blocked:'rgba(255,40,40,0.7)' } };

const Theaya = {
    ready: false,
    zone: areaZones.home,
    ground: [],          // groundTypes id per cell
    biome: [],           // naturalMaterials id per cell
    parentBiome: [],     // for caves: the biome the cave is in
    blocks: [],          // null | { id, ...state }
    water: [],           // units left in water cells
    growing: new Map(),  // cell index -> scene time it grows
    refilling: new Map(),// cell index -> scene time the water comes back
    forges: new Set(),
    pots: new Set(),     // cooking pot cells (ticked like forges)
    plants: new Set(),   // cells with a plant or farmland (ticked by tickPlants)
    trees: new Set(),
    lights: new Set(),   // cells with a block that glows (torches, ore hearts)
    hearts: new Set(),   // ore heart cells
    built: new Set(),    // cells with something the player built (Blocks `built`)
    origin: [],          // natural block id each cell had when the world was made (regrowth)
    waterCells: [],      // every cell that started as water (dried ones included)
    dried: new Set(),    // water cells a drought turned into land
    puddles: new Map(),  // cell index -> water units in a rain puddle
    mud: new Set(),      // muddy grass cells
    snow: new Set(),     // snow covered cells
    dirty: new Set(),    // cells to redraw on the terrain buffer
    fullRedraw: true,
    spawn: { x:0, y:0 },
};

const cellIndex = (x, y) => y * MAP_COLS + x;
const cellXY    = i => ({ x: i % MAP_COLS, y: Math.floor(i / MAP_COLS) });
function sceneTime(){ return Scene.time(SCENE_ID); }
function blockAt(x, y){ return Theaya.zone.inBounds(x, y) ? Theaya.blocks[cellIndex(x, y)] : null; }
function blockDefAt(x, y){ const b = blockAt(x, y); return b ? Blocks.get(b.id) : null; }
function groundAt(x, y){ return Theaya.zone.inBounds(x, y) ? groundTypes[Theaya.ground[cellIndex(x, y)]] : null; }
/** Does this block stop `mover` ('player', 'animal', 'zombie')? Doors only let the player through, farmland only blocks the player. */
function blocksMover(def, mover = 'player'){
    return !!(def && def.solid && !(def.passableFor && def.passableFor.includes(mover)));
}
/** Walkable floor (grass) with nothing in the way of `mover`. */
function isPassable(x, y, mover = 'player'){
    const g = groundAt(x, y);
    if(!g || !g.passable) return false;
    return !blocksMover(blockDefAt(x, y), mover);
}
/** Mirror the player's passability into the tileMatrix's reserved flag (pathing + walking read it). */
function syncCell(x, y){
    Theaya.zone.setReserved(x, y, !isPassable(x, y, 'player'));
    Theaya.dirty.add(cellIndex(x, y));
}
/** Put a block (or null) in a cell, keeping timers / trackers / reserved flags right. */
function setBlock(x, y, id, state = {}){
    const i = cellIndex(x, y);
    Theaya.growing.delete(i);
    Theaya.trees.delete(i);
    Theaya.forges.delete(i);
    Theaya.pots.delete(i);
    Theaya.plants.delete(i);
    Theaya.lights.delete(i);
    Theaya.hearts.delete(i);
    Theaya.built.delete(i);
    if(id == null){
        Theaya.blocks[i] = null;
    } else {
        const def = Blocks.get(id);
        if(!def) throw new Error(`setBlock: unknown block '${id}'.`);
        const b = Object.assign({ id }, state);
        if(def.init) def.init(b);
        Theaya.blocks[i] = b;
        if(!def.replaceable){ Theaya.puddles.delete(i); Theaya.snow.delete(i); }
        if(def.grow) Theaya.growing.set(i, sceneTime() + def.grow.seconds * (0.8 + 0.4 * Math.random()));
        if(def.kind === 'tree') Theaya.trees.add(i);
        if(def.station === 'forge') Theaya.forges.add(i);
        if(def.station === 'pot') Theaya.pots.add(i);
        if(b.plant || def.kind === 'farmland') Theaya.plants.add(i);
        if(def.light) Theaya.lights.add(i);
        if(def.kind === 'ore_heart') Theaya.hearts.add(i);
        if(def.built) Theaya.built.add(i);
    }
    syncCell(x, y);
}
/** Change a cell's floor (water <-> grass when a drought dries it / rain brings it back). */
function setGround(x, y, ground){
    const i = cellIndex(x, y);
    Theaya.ground[i] = ground;
    if(groundTypes[ground].water){ Theaya.water[i] = Theaya.water[i] || 1; Theaya.mud.delete(i); Theaya.puddles.delete(i); Theaya.snow.delete(i); }
    syncCell(x, y);
}
/** The block in a cell is a container that still holds items. */
function containerBusy(b){
    if(!b) return false;
    if(b.box) return !b.box.isEmpty;
    if(b.input) return !(b.input.isEmpty && b.fuel.isEmpty && b.output.isEmpty);
    return false;
}
/** Cell indexes of the 6 neighbours. */
function neighborIdx(i){
    const { x, y } = cellXY(i);
    return Theaya.zone.neighbors(x, y).map(n => cellIndex(n.x, n.y));
}
const isWaterCell = i => !!(groundTypes[Theaya.ground[i]] && groundTypes[Theaya.ground[i]].water);
const nextToWater = i => neighborIdx(i).some(isWaterCell);

/** Pointy-hex (odd rows shifted right) cell distance. */
function hexDist(a, b){
    const cube = c => { const q = c.x - (c.y - (c.y & 1)) / 2; return { q, r: c.y, s: -q - c.y }; };
    const A = cube(a), B = cube(b);
    return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.s - B.s)) / 2;
}

/* Seeded noise (p5's noise()/random() aren't available before setup). */
function makeRng(seed){
    let s = seed | 0;
    return function(){
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hash2(x, y, seed){
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
function valueNoise(x, y, seed){
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, octaves = 4){
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for(let o = 0; o < octaves; o++){
        sum += valueNoise(x * freq, y * freq, seed + o * 101) * amp;
        norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
}
/** Value below which `frac` of the listed values fall. */
function quantile(values, frac){
    if(!values.length) return 0;
    const v = values.slice().sort((a, b) => a - b);
    return v[Math.max(0, Math.min(v.length - 1, Math.floor(frac * (v.length - 1))))];
}

/** Highest ore tier allowed at this distance (cells) from spawn. */
function oreTierAt(dist){ return Math.max(1, Math.min(8, 1 + Math.floor((dist - 4) / 2.4))); }
/** Weighted ore pick: the newest allowed tier is most common, coal a bit more. */
function pickOre(dist, r){
    const maxTier = oreTierAt(dist);
    const cands = oreMaterials.filter(m => materialTier(m) <= maxTier);
    const weights = cands.map(m => (1 / (1 + 0.35 * (maxTier - materialTier(m)))) * (m === 'coal' ? 1.6 : 1));
    let total = weights.reduce((a, b) => a + b, 0), roll = r * total;
    for(let k = 0; k < cands.length; k++){ roll -= weights[k]; if(roll <= 0) return cands[k]; }
    return cands[cands.length - 1];
}

function generateWorld(seed = WORLD_SEED){
    const T = Theaya, N = MAP_COLS * MAP_ROWS;
    const rng = makeRng(seed);
    T.spawn = { x: Math.floor(MAP_COLS / 2), y: Math.floor(MAP_ROWS / 2) & ~1 };
    const P = (x, y) => ({ px: x + 0.5 * (y & 1), py: y * 0.866 });   // hex-even noise coords
    const sp = P(T.spawn.x, T.spawn.y);
    const maxD = Math.hypot(MAP_COLS / 2, MAP_ROWS * 0.866 / 2);

    const elev = [], moist = [], cav = [], tun = [], oreN = [], dist = [], dune = [];
    for(let i = 0; i < N; i++){
        const { x, y } = cellXY(i), p = P(x, y);
        const d = Math.hypot(p.px - sp.px, p.py - sp.py);
        dist[i]  = d;
        elev[i]  = fbm(p.px * 0.07, p.py * 0.07, seed, 4) - 0.55 * Math.pow(d / maxD, 2.2) + (d < 6 ? 0.3 * (1 - d / 6) : 0);
        moist[i] = fbm(p.px * 0.06, p.py * 0.06, seed + 911, 3);
        cav[i]   = fbm(p.px * 0.09, p.py * 0.09, seed + 577, 3);
        tun[i]   = fbm(p.px * 0.20, p.py * 0.20, seed + 33, 2);
        oreN[i]  = valueNoise(p.px * 0.45, p.py * 0.45, seed + 71);
        const dn = fbm(p.px * 0.30, p.py * 0.10, seed + 404, 2);
        dune[i]  = 1 - Math.abs(2 * dn - 1);   // ridges: long, wavy lines (sand dunes)
    }

    // Biomes: percentiles keep the proportions stable whatever the noise does.
    const oceanCut = quantile(elev, 0.24);
    const land = [];
    for(let i = 0; i < N; i++) if(elev[i] >= oceanCut || dist[i] < 3) land.push(i);
    const dryCut = quantile(land.map(i => moist[i]), 0.28);
    const wetCut = quantile(land.map(i => moist[i]), 0.62);
    for(let i = 0; i < N; i++) T.biome[i] = 'ocean';
    for(const i of land) T.biome[i] = moist[i] < dryCut ? 'desert' : moist[i] > wetCut ? 'forest' : 'plains';

    // Caves form inside their host biomes, away from spawn.
    const caveDef = biomes.cave;
    const caveHosts = land.filter(i => dist[i] > 5 && caveDef.within.includes(T.biome[i]));
    const caveCut = quantile(caveHosts.map(i => cav[i]), 0.74);
    const caves = caveHosts.filter(i => cav[i] >= caveCut);
    for(const i of caves){ T.parentBiome[i] = T.biome[i]; T.biome[i] = 'cave'; }
    const tunnelCut = quantile(caves.map(i => tun[i]), 1 - caveDef.openness);
    const oreCut    = quantile(caves.map(i => oreN[i]), 1 - caveDef.oreChance);
    // Biome `fill` (desert sand): a noise threshold per biome, so the open cells form paths.
    const fillCut = {};
    for(const [id, b] of Object.entries(biomes)){
        if(!b.fill) continue;
        const cells = [];
        for(let i = 0; i < N; i++) if(T.biome[i] === id) cells.push(tun[i]);
        fillCut[id] = quantile(cells, 1 - b.fill.share);
    }
    // Biome `dunes`: the highest ridges of the dune noise
    const duneCut = {};
    for(const [id, b] of Object.entries(biomes)){
        if(!b.dunes) continue;
        const cells = [];
        for(let i = 0; i < N; i++) if(T.biome[i] === id) cells.push(dune[i]);
        duneCut[id] = quantile(cells, 1 - b.dunes.share);
    }
    const rollTable = (table, r) => {
        let acc = 0;
        for(const [id, chance] of Object.entries(table)){ acc += chance; if(r < acc) return id; }
        return null;
    };

    // Fill cells
    for(let i = 0; i < N; i++){
        const { x, y } = cellXY(i), p = P(x, y);
        const biome = biomes[T.biome[i]];
        T.ground[i] = biome.floor;
        T.blocks[i] = null;
        if(groundTypes[biome.floor].water) T.water[i] = WATER_UNITS;
        if(T.biome[i] === 'cave'){
            if(tun[i] >= tunnelCut) continue;   // open tunnel
            if(oreN[i] >= oreCut){
                const ore = pickOre(dist[i], hash2(Math.floor(p.px / 2.5), Math.floor(p.py / 2.5), seed + 5));
                setBlock(x, y, `${ore}_ore`);
            } else {
                setBlock(x, y, rollTable(caveDef.wallMix || {}, rng()) ?? caveDef.wall);
            }
            continue;
        }
        if(dist[i] < 2.2) continue;   // keep the camp clear
        const res = rollTable(biome.resources, rng());
        if(res) setBlock(x, y, res);
        else if(biome.dunes && dune[i] >= duneCut[T.biome[i]] && dist[i] > 4) setBlock(x, y, biome.dunes.block);
        else if(biome.fill && tun[i] >= fillCut[T.biome[i]]) setBlock(x, y, biome.fill.block);
    }

    // Cedar is tier 0 (choppable by hand): make sure the first wood is close to camp.
    const ensureNear = (blockId, count, minD, maxD) => {
        const ring = land.filter(i => dist[i] >= minD && dist[i] <= maxD && T.biome[i] !== 'cave');
        let have = ring.filter(i => T.blocks[i] && T.blocks[i].id === blockId).length;
        const free = ring.filter(i => !T.blocks[i] && T.ground[i] === FLOOR);
        while(have < count && free.length){
            const i = free.splice(Math.floor(rng() * free.length), 1)[0], { x, y } = cellXY(i);
            setBlock(x, y, blockId);
            have++;
        }
    };
    ensureNear('cedar_tree', 4, 2.5, 7);
    ensureNear('berry_bush', 2, 2.5, 7);
    ensureNear('fern', 4, 2.5, 7);
    ensureNear('stone', 3, 3, 9);

    // Water cells (for weather) and clay on the shorelines.
    T.waterCells = [];
    for(let i = 0; i < N; i++) if(isWaterCell(i)) T.waterCells.push(i);
    for(let i = 0; i < N; i++){
        const b = biomes[T.biome[i]];
        if(!b || !b.shoreClay || T.blocks[i] || isWaterCell(i) || dist[i] < 2.2) continue;
        if(nextToWater(i) && rng() < b.shoreClay){ const { x, y } = cellXY(i); setBlock(x, y, 'clay'); }
    }
    // Make sure there's some clay (the forge needs it), close-ish to camp first.
    const clayCount = () => T.blocks.filter(b => b && b.id === 'clay').length;
    if(clayCount() < 8){
        const shore = land.filter(i => !T.blocks[i] && !isWaterCell(i) && T.biome[i] !== 'cave' && dist[i] > 2.2 && nextToWater(i)).sort((a, b) => dist[a] - dist[b]);
        for(const i of shore.slice(0, 8 - clayCount())){ const { x, y } = cellXY(i); setBlock(x, y, 'clay'); }
    }

    // Wild crops: rare, in each crop's biomes, every crop at least FARM.wildMin times.
    const wildSpot = (i, c) => !T.blocks[i] && T.ground[i] === FLOOR && dist[i] > 3 && c.biomes.includes(T.biome[i]) && (!c.nearWater || nextToWater(i));
    const wildIds = Crops.ids().filter(id => Blocks.get(`wild_${id}`));
    for(let i = 0; i < N; i++){
        if(rng() >= FARM.wildChance) continue;
        const id = Crops.random(c => wildIds.includes(c.id) && wildSpot(i, c), rng());
        if(id){ const { x, y } = cellXY(i); setBlock(x, y, `wild_${id}`); }
    }
    for(const id of wildIds){
        const c = Crops.get(id);
        let have = T.blocks.filter(b => b && b.id === `wild_${id}`).length;
        let spots = land.filter(i => wildSpot(i, c));
        if(!spots.length) spots = land.filter(i => !T.blocks[i] && T.ground[i] === FLOOR && dist[i] > 3 && T.biome[i] !== 'cave');
        while(have < FARM.wildMin && spots.length){
            const i = spots.splice(Math.floor(rng() * spots.length), 1)[0], { x, y } = cellXY(i);
            setBlock(x, y, `wild_${id}`);
            have++;
        }
    }

    // Make sure every ore exists somewhere it's allowed.
    for(const m of oreMaterials){
        const id = `${m}_ore`;
        if(T.blocks.some(b => b && b.id === id)) continue;
        const spots = caves.filter(i => T.blocks[i] && T.blocks[i].id === caveDef.wall && oreTierAt(dist[i]) >= materialTier(m))
            .sort((a, b) => dist[b] - dist[a]);
        const fallback = land.filter(i => !T.blocks[i] && dist[i] > 8).sort((a, b) => dist[b] - dist[a]);
        const pool = spots.length ? spots : fallback;
        for(let k = 0; k < Math.min(3, pool.length); k++){
            const { x, y } = cellXY(pool[Math.floor(rng() * Math.min(pool.length, 30))]);
            setBlock(x, y, id);
        }
    }

    // Ore hearts: in the middle of each ore's biggest veins (1..3 per ore type, never mineable).
    for(const m of oreMaterials){
        const id = `${m}_ore`, cells = [];
        for(let i = 0; i < N; i++) if(T.blocks[i] && T.blocks[i].id === id) cells.push(i);
        if(!cells.length) continue;
        const score = i => neighborIdx(i).filter(j => T.blocks[j] && T.blocks[j].id === id).length + rng() * 0.5;
        const ranked = cells.map(i => [i, score(i)]).sort((a, b) => b[1] - a[1]).map(e => e[0]);
        const want = Math.max(1, Math.min(3, Math.round(cells.length / ORE_HEART.perOre)));
        const placed = [];
        for(const i of ranked){
            if(placed.length >= want) break;
            if(placed.some(j => hexDist(cellXY(i), cellXY(j)) < 4)) continue;
            // small veins keep their ore: the heart goes in the wall next to it
            const wall = cells.length <= 3 ? neighborIdx(i).find(j => T.blocks[j] && Blocks.get(T.blocks[j].id).kind === 'stone') : undefined;
            const at = wall ?? i, { x, y } = cellXY(at);
            setBlock(x, y, `${m}_ore_heart`);
            placed.push(at);
        }
    }

    // Remember what grew where, so the world can slowly grow back (see tickRegrowth)
    for(let i = 0; i < N; i++) T.origin[i] = T.blocks[i] ? T.blocks[i].id : null;

    // Sync every cell's reserved flag (setBlock already did the ones with blocks)
    for(let i = 0; i < N; i++){ const { x, y } = cellXY(i); syncCell(x, y); }
    T.fullRedraw = true;
}


/* ---------------------------------------------------------------------
 * 8. Player + survival
 * --------------------------------------------------------------------- */
const theayaScene = new Scene(SCENE_ID, '#1f4f80', { exe: (dt) => gameTick(dt) }, () => drawTerrain());
generateWorld(WORLD_SEED);

const _spawnPos = areaZones.home.toWorld(Theaya.spawn.x, Theaya.spawn.y);
const player = new Player(_spawnPos.x, _spawnPos.y, 18, 18, 'survival_player', SCENE_ID);
player.package(Entity.Packages.living(), Entity.Packages.speed(), {
    interact:{
        range:50,
        bind:'default@interact',
    },
    inventory: new SurvivalInventory(47, 7, 5),
    hunger: 100,
    satruation: 10,
    thirst: 50,
    nutritionDamage: 5,      // health per second at weight 1 and full severity
    /**
     * Each stat starts hurting below its threshold. Its severity goes from
     * `minSeverity` (just under the threshold) to 1 (at 0), times its weight,
     * so thirst (weight 0.6) hurts twice as much as hunger (0.3).
     * When BOTH are below their thresholds, the sum is multiplied by `stack`.
     */
    nutritionRules: {
        thirst: { threshold: 35, weight: 0.6 },
        hunger: { threshold: 40, weight: 0.3 },
        minSeverity: 0.25,
        stack: 1.5,
    },
    /** 0 (fine) .. 1 (stat at 0) for 'thirst' or 'hunger'. */
    _deficit(stat){
        const rule = this.nutritionRules[stat], v = this[stat];
        if(v >= rule.threshold) return 0;
        const d = (rule.threshold - Math.max(0, v)) / rule.threshold;
        return this.nutritionRules.minSeverity + (1 - this.nutritionRules.minSeverity) * d;
    },
    /** Health lost per second from thirst + hunger right now. */
    nutritionDamageRate(){
        const R = this.nutritionRules;
        const t = this._deficit('thirst'), h = this._deficit('hunger');
        let rate = this.nutritionDamage * (t * R.thirst.weight + h * R.hunger.weight);
        if(t > 0 && h > 0) rate *= R.stack;
        return rate;
    },
    /** 1 = no nutrition damage, 0 = the worst it gets (both stats at 0). */
    nutrition(){
        const R = this.nutritionRules;
        const worst = this.nutritionDamage * (R.thirst.weight + R.hunger.weight) * R.stack;
        return 1 - this.nutritionDamageRate() / worst;
    },
    _damageOnNutrition(dt = World.tickLength/1000){
        const dmg = this.nutritionDamageRate() * dt;
        this.health -= dmg;
        return dmg;
    }
});
if(player.rendering) player.rendering.color = '#f3d9a4';
areaZones.home.link(player);

/** Which armor slot an item goes in ('head' | 'chest' | 'legs' | 'feet'), or null. */
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];
function armorSlotOf(item){
    const e = item && typeof item.get === 'function' ? item.get('equippable') : null;
    return e && ARMOR_SLOTS.includes(e.slot) ? e.slot : null;
}
/** Worn armor: one 1-slot Box per armor slot (drag / shift-click armor in the backpack). */
player.gear = {};
for(const s of ARMOR_SLOTS) player.gear[s] = new Box(1, item => armorSlotOf(item) === s);
player.poison = null;   // { left (s), dps }
const ARMOR_SCALE = 25;  // damage taken = damage * 25 / (25 + defense)
function playerDefense(){
    let d = 0;
    for(const s of ARMOR_SLOTS){ const it = player.gear[s].getSlot(0); if(it && it.getDefense) d += it.getDefense(); }
    return d;
}
/** Damage from creatures / lightning. Armor soaks part of it and wears down. Returns damage taken. */
function damagePlayer(amount, source = ''){
    const def = playerDefense(), dmg = amount * ARMOR_SCALE / (ARMOR_SCALE + def);
    player.health -= dmg;
    for(const s of ARMOR_SLOTS){
        const it = player.gear[s].getSlot(0);
        if(!it) continue;
        it.wear(1);
        if(it.isBroken){ player.gear[s].setSlot(0, null); notify(`Your ${prettify(it.id)} broke!`, '#ff8a7a'); }
    }
    GameUI.hurtAt = performance.now();
    if(source) GameUI.lastHurt = source;
    return dmg;
}

// Starting kit: a full canteen and a few berries on the hotbar.
(() => {
    const inv = player.inventory;
    const canteen = Items.create('canteen');
    canteen.water.value = canteen.water.capacity;
    inv[inv.hotbarSlot(1)] = canteen;
    inv[inv.hotbarSlot(2)] = Items.create('berries', 4);
    inv._changed({ event:'kit' });
})();

/** Add `count` of an item id, in max-size stacks. Returns how many didn't fit. */
function giveItems(id, count = 1){
    let left = count;
    while(left > 0){
        const n = Math.min(left, Items.maxStack(id));
        const rest = player.inventory.give(Items.create(id, n));
        left -= (n - rest);
        if(rest > 0) break;
    }
    return left;
}
function roomForItems(id){ return player.inventory.roomFor(Items.create(id, 1)); }

/** How much faster hunger / thirst drain right now (heat, cold, drought). */
function climateRates(){
    const pc = playerCell(), temp = pc ? temperatureAt(pc.x, pc.y) : 20;
    let thirst = 1, hunger = 1;
    if(temp > SURVIVAL.hotAbove)  thirst *= 1 + SURVIVAL.hotThirst * (temp - SURVIVAL.hotAbove);
    if(temp < SURVIVAL.coldBelow) hunger *= 1 + SURVIVAL.coldHunger * (SURVIVAL.coldBelow - temp);
    thirst *= Weather.param('thirst', 1);
    return { thirst, hunger, temp };
}
function tickSurvival(dt){
    const p = player, rates = climateRates();
    const drain = SURVIVAL.hungerRate * rates.hunger * dt;
    if(p.satruation > 0) p.satruation = Math.max(0, p.satruation - drain);
    else p.hunger = Math.max(0, p.hunger - drain);
    p.thirst = Math.max(0, p.thirst - SURVIVAL.thirstRate * rates.thirst * dt);
    p._damageOnNutrition(dt);
    if(p.poison){
        p.health -= p.poison.dps * dt;
        p.poison.left -= dt;
        if(p.poison.left <= 0){ p.poison = null; notify('The poison wore off.', '#a6f0a0'); }
    }
    const wellFed = !p.poison && p.nutritionDamageRate() === 0 && p.hunger >= SURVIVAL.regenAbove && p.thirst >= SURVIVAL.regenAbove;
    if(wellFed && p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + SURVIVAL.regenRate * dt);
    // better food: fast regeneration for a while (works even while poisoned)
    if(p.regenBuff){
        p.health = Math.min(p.maxHealth, p.health + p.regenBuff.rate * dt);
        p.regenBuff.left -= dt;
        if(p.regenBuff.left <= 0) p.regenBuff = null;
    }
    if(p.health <= 0) respawn();
}
function respawn(){
    const s = Theaya.spawn;
    if(!isPassable(s.x, s.y)) setBlock(s.x, s.y, null);
    Act.job = null;
    Act.combat = null;
    areaZones.home.move(player, s.x, s.y);
    Object.assign(player, { health: player.maxHealth, hunger: 60, satruation: 5, thirst: 90, poison: null, regenBuff: null });
    if(typeof Mobs !== 'undefined') Mobs.calmNear(s, 8);   // hostiles at camp give up the chase
    notify('You collapsed... and woke up back at camp.', '#ff9a8a');
}


/* ---------------------------------------------------------------------
 * 9. Actions
 * --------------------------------------------------------------------- */
const Act = {
    job: null,     // { x, y, id, time, elapsed, tool, verb } while mining
    combat: null,  // { mob, plan, key } while fighting (see tickCombat)
    attackCd: 0,   // seconds until the next swing / shot
};

function playerCell(){ return areaZones.home.positionOf(player); }
function heldItem(){ return player.inventory.hotbarItem(GameUI.hotbar); }
const pathOpts = () => ({ passable: (x, y) => isPassable(x, y) });

/** Best passable cell next to `cell` the player can walk to: { x, y, path } or null. */
function findApproach(cell){
    const pc = playerCell();
    if(!pc) return null;
    if(hexDist(pc, cell) === 1) return { x: pc.x, y: pc.y, path: [] };
    let best = null;
    for(const n of areaZones.home.neighbors(cell.x, cell.y)){
        if(!isPassable(n.x, n.y)) continue;
        const path = areaZones.home.findPath(pc, n, pathOpts());
        if(path && (!best || path.length < best.path.length)) best = { x: n.x, y: n.y, path };
    }
    return best;
}
function walkTo(x, y, onArrive = null){
    Act.combat = null;
    Act.job = null;
    const ok = areaZones.home.moveTo(player, x, y, Object.assign(pathOpts(), {
        onArrive: () => { if(onArrive) onArrive(); },
        onBlocked: () => notify('Path blocked.', '#ffb070'),
    }));
    if(!ok) notify("Can't get there.", '#ffb070');
    return !!ok;
}
/**
 * Default left click: walk onto the cell, or (when it can't be stood on:
 * water, trees, stone, farmland...) to the closest reachable cell next to it.
 */
function moveToward(x, y){
    const pc = playerCell(), cell = { x, y };
    if(!pc || !Theaya.zone.inBounds(x, y) || (pc.x === x && pc.y === y)) return false;
    GameUI.wheel = null;
    if(isPassable(x, y)) return walkTo(x, y);
    if(hexDist(pc, cell) === 1){ Act.job = null; areaZones.home.stopMove(player); return true; }   // already next to it
    const ap = findApproach(cell);
    if(!ap){ notify("Can't reach that cell.", '#ffb070'); return false; }
    return walkTo(ap.x, ap.y);
}
/** Run fn once the player stands next to `cell` (walking there first when needed). */
function doNear(cell, fn){
    const pc = playerCell();
    if(pc && hexDist(pc, cell) === 1){ fn(); return; }
    const ap = findApproach(cell);
    if(!ap){ notify("Can't reach that cell.", '#ffb070'); return; }
    walkTo(ap.x, ap.y, () => { const c = playerCell(); if(c && hexDist(c, cell) === 1) fn(); });
}

function verbFor(def){
    switch(def.kind){
        case 'tree': return 'Chop';
        case 'stone': case 'ore': return 'Mine';
        case 'soil': return 'Dig';
        case 'sapling': case 'plant': return 'Dig up';
        case 'farmland': return 'Clear';
        default: return 'Break';
    }
}

/** Can `item` break this block, and how long does it take? { ok, reason?, fits, time } */
/*
 * Tier rule: tier 0 = anything breaks it (bare hands too). Tier > 0 needs a
 * tool of the block's class (pickaxe / axe / shovel / hoe) whose tier is >= the
 * block's tier. Time = MINE_TIME_SCALE * hardness * (1 + 0.15 * block tier)
 * / speed, where speed = tool speed * (1 + 0.25 per tier above the block),
 * or HAND_SPEED without a fitting tool. Hardness < 0 is instant, >= 10 never.
 */
function miningInfo(def, item){
    const m = item && typeof item.get === 'function' ? item.get('mining') : null;
    const fits = !!(m && def.tool && !item.isBroken && m.classes.includes(def.tool) && m.worksOn(def.tag));
    if(def.hardness >= 10) return { ok:false, fits, reason:'Unbreakable' };
    if(def.tier > 0){
        if(!fits) return { ok:false, fits, reason:`Needs a tier ${def.tier}+ ${def.tool}` };
        if(m.tier < def.tier) return { ok:false, fits, reason:`Needs a tier ${def.tier}+ ${def.tool} (yours: tier ${m.tier})` };
    }
    if(def.hardness < 0) return { ok:true, fits, time: 0.1 };
    const speed = fits ? m.speed * (1 + 0.25 * Math.max(0, m.tier - def.tier)) : HAND_SPEED;
    return { ok:true, fits, time: Math.max(0.15, MINE_TIME_SCALE * def.hardness * (1 + 0.15 * def.tier) / speed) };
}
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
function rollDrops(def, b = null){
    const out = [];
    const list = def.dropsFor && b ? def.dropsFor(b) : def.drops;
    for(const [id, min, max = min, chance = 1, instead = null] of list){
        if(chance < 1 && Math.random() >= chance){ if(instead) out.push([instead, 1]); continue; }
        out.push([id, randInt(min, max)]);
    }
    return out;
}
/** One use of a tool on `tag` (wears it). Removes it when it breaks. */
function wearTool(tool, tag){
    if(!tool || typeof tool.mine !== 'function') return;
    tool.mine(tag, player);
    if(tool.isBroken){ player.inventory.removeRef(tool); notify(`Your ${prettify(tool.id)} broke!`, '#ff8a7a'); }
}
const dropsText = drops => drops.filter(([, n]) => n > 0).map(([id, n]) => `${n} ${prettify(id)}`).join(', ');
function hasRoomFor(drops){ return drops.every(([id, n]) => n <= 0 || roomForItems(id) >= n); }

/* Timed jobs (mining, tilling): { x, y, time, elapsed, tool, verb, check(), done(job) } */
function startJob(job){ Act.job = Object.assign({ elapsed: 0 }, job); }
function startMine(x, y){
    const b = blockAt(x, y), def = b && Blocks.get(b.id);
    if(!def) return;
    const tool = heldItem();
    const info = miningInfo(def, tool);
    if(!info.ok){ notify(info.reason, '#ff8a7a'); return; }
    if(containerBusy(b)){ notify(`Empty the ${def.name} first.`, '#ff8a7a'); return; }
    const id = b.id;
    startJob({ x, y, id, time: info.time, tool, verb: verbFor(def),
        check: () => { const c = blockAt(x, y); return !!(c && c.id === id); }, done: finishMine });
}
function tickJob(dt){
    const j = Act.job;
    if(!j) return;
    const pc = playerCell();
    if(!j.check() || !pc || hexDist(pc, j) > 1 || areaZones.home.isMoving(player)){ Act.job = null; return; }
    if(heldItem() !== j.tool){ Act.job = null; notify('Stopped: you switched items.', '#ffb070'); return; }
    j.elapsed += dt;
    if(j.elapsed >= j.time){ Act.job = null; j.done(j); }
}
function finishMine(j){
    const b = blockAt(j.x, j.y), def = Blocks.get(j.id);
    const drops = rollDrops(def, b);
    if(!hasRoomFor(drops)){ notify('Inventory full!', '#ff8a7a'); return; }
    if(j.tool && miningInfo(def, j.tool).fits) wearTool(j.tool, def.tag);
    setBlock(j.x, j.y, null);
    for(const [id, n] of drops) if(n > 0) giveItems(id, n);
    if(drops.length) notify('+ ' + dropsText(drops), '#a6f0a0');
}

/* ----- Farming ----- */
const isHoe = item => !!(item && item.get && item.get('mining') && item.get('mining').classes.includes('hoe') && !item.isBroken);
/** Grass with nothing on it (ferns get cleared) that the player isn't standing on. */
function canTill(x, y){
    const g = groundAt(x, y), def = blockDefAt(x, y), pc = playerCell();
    if(!g || !g.passable || Theaya.ground[cellIndex(x, y)] !== FLOOR) return { ok:false, reason:'Only grass can be tilled' };
    if(def && !def.replaceable) return { ok:false, reason:'Something is in the way' };
    if(pc && pc.x === x && pc.y === y) return { ok:false, reason:"You're standing here" };
    return { ok:true };
}
function tillTime(tool){ const m = tool && tool.get('mining'); return Math.max(0.3, MINE_TIME_SCALE * 0.35 / (m ? m.speed : HAND_SPEED)); }
function startTill(x, y){
    const tool = heldItem();
    if(!isHoe(tool)){ notify('Hold a hoe to till the soil.', '#ffb070'); return; }
    const can = canTill(x, y);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    startJob({ x, y, time: tillTime(tool), tool, verb:'Till', check: () => canTill(x, y).ok, done: finishTill });
}
function finishTill(j){
    const i = cellIndex(j.x, j.y);
    const wet = (Theaya.puddles.get(i) || 0) * 15 + (Theaya.snow.has(i) ? 10 : 0) + (Theaya.mud.has(i) ? 10 : 0);
    wearTool(j.tool, 'grass');
    Theaya.puddles.delete(i); Theaya.mud.delete(i); Theaya.snow.delete(i);
    setBlock(j.x, j.y, 'farmland', { water: Math.min(FARM.waterMax, wet) });
    notify('Tilled the soil. Water it with a bucket, then plant seeds.', '#c9e89a');
}

/* Digging grass: bare grass gives dirt, as often as you like (the grass stays). */
const isShovel = item => !!(item && item.get && item.get('mining') && item.get('mining').classes.includes('shovel') && !item.isBroken);
/** Bare grass (no block on it). You can dig the cell you're standing on. */
function canDigGrass(x, y){
    const g = groundAt(x, y);
    if(!g || !g.passable || Theaya.ground[cellIndex(x, y)] !== FLOOR) return { ok:false, reason:'Only grass gives dirt' };
    if(blockAt(x, y)) return { ok:false, reason:'Something is in the way' };
    return { ok:true };
}
/** Like mining a dirt block: a shovel is faster, bare hands work too. */
function digGrassTime(tool){
    const m = isShovel(tool) ? tool.get('mining') : null;
    return Math.max(0.3, MINE_TIME_SCALE * (Blocks.get('dirt').hardness ?? 1) * 0.6 / (m ? m.speed : HAND_SPEED));
}
function startDigGrass(x, y){
    const tool = heldItem(), can = canDigGrass(x, y);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    if(roomForItems('dirt') < 1){ notify('Inventory full!', '#ff8a7a'); return; }
    startJob({ x, y, time: digGrassTime(tool), tool, verb:'Dig', check: () => canDigGrass(x, y).ok, done: finishDigGrass });
}
function finishDigGrass(j){
    if(roomForItems('dirt') < 1){ notify('Inventory full!', '#ff8a7a'); return; }
    if(isShovel(j.tool)) wearTool(j.tool, 'dirt');
    giveItems('dirt', 1);
    notify('+ 1 Dirt', '#a6f0a0');
}

/** Plant view of a block: { crop, stage, k, ripe, rot } or null. */
function plantInfo(b){
    if(!b || !b.plant) return null;
    const crop = Crops.get(b.plant.crop);
    if(!crop) return null;
    const k = Crops.stageAt(crop, b.plant.age), stage = k < 0 ? null : crop.stages[k];
    return { crop, stage, k, ripe: !!(stage && stage.done), rot: !!(stage && stage.rot) };
}
/** Crops with tier > 0 need a hoe of that tier to harvest. */
function canHarvestTier(crop, item){
    if(crop.tier <= 0) return { ok:true };
    const m = isHoe(item) ? item.get('mining') : null;
    if(m && m.tier >= crop.tier) return { ok:true, tool:item };
    return { ok:false, reason:`Needs a tier ${crop.tier}+ hoe${m ? ` (yours: tier ${m.tier})` : ''}` };
}
function harvestPlant(x, y){
    const b = blockAt(x, y), info = plantInfo(b);
    if(!info) return;
    const { crop } = info, held = heldItem();
    const tier = canHarvestTier(crop, held);
    if(!info.rot && !tier.ok){ notify(tier.reason, '#ff8a7a'); return; }
    const n = info.rot || !info.stage ? 0 : randInt(info.stage.yield[0], info.stage.yield[1]);
    let seeds = 0;
    if(info.ripe && Items.has(crop.seed) && crop.seed !== 'berry_bush') seeds = crop.regrow ? (Math.random() < 0.3 ? 1 : 0) : randInt(crop.seeds[0], crop.seeds[1]);
    const drops = [[crop.id, n], [crop.seed, seeds]];
    if(!hasRoomFor(drops)){ notify('Inventory full!', '#ff8a7a'); return; }
    if(tier.tool && n > 0) wearTool(tier.tool, 'plant');
    for(const [id, c] of drops) if(c > 0) giveItems(id, c);
    const onFarm = b.id === 'farmland';
    if(crop.regrow) b.plant.age = 0;                 // perennials grow back
    else if(onFarm) b.plant = null;                  // the farmland stays
    else setBlock(x, y, null);                       // a wild plant is gone
    Theaya.dirty.add(cellIndex(x, y));
    notify(info.rot ? `Cleared the rotten ${prettify(crop.id)}.` : `+ ${dropsText(drops)}`, info.rot ? '#d8c08a' : '#a6f0a0');
}
/** Ferns: always plant fibers, sometimes a crop seed (tier FARM.fernSeedMaxTier or lower). Then they're gone. */
function harvestFern(x, y){
    const drops = [['plant_fiber', randInt(1, 2)]];
    if(Math.random() < FARM.fernSeedChance){
        const id = Crops.random(c => c.farm && c.tier <= FARM.fernSeedMaxTier && Items.has(c.seed));
        if(id) drops.push([Crops.get(id).seed, 1]);
    }
    if(!hasRoomFor(drops)){ notify('Inventory full!', '#ff8a7a'); return; }
    for(const [id, n] of drops) giveItems(id, n);
    setBlock(x, y, null);
    notify('+ ' + dropsText(drops), '#a6f0a0');
}
function harvest(x, y){
    const def = blockDefAt(x, y);
    if(!def) return;
    if(def.kind === 'fern') harvestFern(x, y);
    else if(plantInfo(blockAt(x, y))) harvestPlant(x, y);
}
function plantSeed(x, y){
    const item = heldItem(), b = blockAt(x, y);
    if(!(item instanceof CropSeedItem)){ notify('Hold seeds to plant.', '#ffb070'); return; }
    if(!b || b.id !== 'farmland'){ notify('Seeds go on farmland (till grass with a hoe).', '#ffb070'); return; }
    if(b.plant){ notify('Something is already growing here.', '#ffb070'); return; }
    b.plant = newPlant(item.crop, 0);
    Theaya.plants.add(cellIndex(x, y));
    Theaya.dirty.add(cellIndex(x, y));
    item.removeCount(1);
    player.inventory._changed({ event:'plant' });
    notify(`Planted ${prettify(item.crop)}${b.water <= 0 ? ' - the soil is dry, water it!' : ''}`, b.water <= 0 ? '#ffb070' : '#a6f0a0');
}
function waterFarmland(x, y){
    const item = heldItem(), b = blockAt(x, y), w = waterOf(item);
    if(!(item instanceof Bucket)){ notify('Hold a bucket of water.', '#ffb070'); return; }
    if(!b || b.id !== 'farmland') return;
    if(w.empty){ notify('The bucket is empty. Fill it at water or a puddle.', '#ffb070'); return; }
    // Fills up to waterMax. Pouring on farmland that's already full floods it (up to FARM.floodMax).
    const flood = b.water >= FARM.waterMax, cap = flood ? FARM.floodMax : FARM.waterMax;
    const room = cap - b.water;
    if(room <= 0){ notify(`This farmland can't hold any more water.`, '#ffb070'); return; }
    const units = Math.min(w.value, Math.ceil(room / FARM.bucketUnit));
    w.value -= units;
    b.water = Math.min(cap, b.water + units * FARM.bucketUnit);
    Theaya.dirty.add(cellIndex(x, y));
    const pond = FARM.waterMax * FARM.floodAt;
    notify(flood ? `Flooded: ${Math.round(b.water)}/${FARM.waterMax}${b.water > pond ? ` - kept over ${pond} for half a day it becomes a water source` : ` (over ${pond} for half a day makes a pond)`}`
                 : `Watered: ${Math.round(b.water)}/${FARM.waterMax} (bucket ${w.value}/${w.capacity})`, '#8fd0ff');
}
/** Farmland that stayed flooded long enough becomes a water cell (a pond you made). */
function floodToWater(i){
    const { x, y } = cellXY(i);
    setBlock(x, y, null);
    Theaya.mud.delete(i);
    Theaya.water[i] = WATER_UNITS;
    setGround(x, y, 'water');
    Theaya.water[i] = WATER_UNITS;
    if(!Theaya.waterCells.includes(i)) Theaya.waterCells.push(i);
    Theaya.dried.delete(i);
    Theaya.origin[i] = null;
    notify('Flooded farmland turned into a water source!', '#8fd0ff');
}
/** Grows plants and drains farmland water (every tick). */
function tickPlants(dt){
    const days = Clock.dayDelta(dt), drain = Weather.param('farmDrain', 1);
    for(const i of Theaya.plants){
        const b = Theaya.blocks[i];
        if(!b){ Theaya.plants.delete(i); continue; }
        const farm = b.id === 'farmland', p = b.plant;
        const crop = p ? Crops.get(p.crop) : null;
        if(farm){
            const { x, y } = cellXY(i);
            const heat = temperatureAt(x, y) > SURVIVAL.hotAbove ? 1.5 : 1;
            const over = b.water > FARM.waterMax ? FARM.overflowDrain : 0;   // flood water soaks away faster
            b.water = Math.max(0, b.water - ((crop ? crop.water : FARM.evaporate) + over) * days * drain * heat);
            // kept flooded (over floodAt x waterMax) for floodDays: it becomes a water source
            if(b.water > FARM.waterMax * FARM.floodAt){
                b.flood = (b.flood || 0) + days;
                if(b.flood >= FARM.floodDays){ floodToWater(i); continue; }
            } else b.flood = 0;
            const lvl = Math.ceil(b.water / (FARM.waterMax / 4));
            if(lvl !== b._lvl){ b._lvl = lvl; Theaya.dirty.add(i); }
        }
        if(!crop) continue;
        const before = Crops.stageAt(crop, p.age);
        if(farm && b.water <= 0){
            p.dry += days;
            if(p.dry >= FARM.dryDays && p.age < crop.rotAge){   // withered
                if(crop.rotAge === Infinity) b.plant = null; else p.age = crop.rotAge;
                Theaya.dirty.add(i);
                continue;
            }
        } else {
            p.dry = 0;
            p.age += days;
        }
        if(!farm && p.age >= crop.rotAge + 1) p.age = 0;   // wild plants rot away and sprout again
        if(Crops.stageAt(crop, p.age) !== before) Theaya.dirty.add(i);
    }
}

/* ----- Placing / water / using items ----- */
function placeBlock(x, y){
    const item = heldItem();
    if(!(item instanceof BlockItem)){ notify('Hold a block item to place it.', '#ffb070'); return; }
    const pc = playerCell(), g = groundAt(x, y), cur = blockDefAt(x, y), def = Blocks.get(item.block);
    if((cur && !cur.replaceable) || !g || !g.passable || !def){ notify("Can't build there.", '#ff8a7a'); return; }
    if(pc && pc.x === x && pc.y === y && blocksMover(def, 'player')){ notify("You're standing there.", '#ff8a7a'); return; }
    setBlock(x, y, item.block, def.placeState ? def.placeState() : {});
    item.removeCount(1);
    player.inventory._changed({ event:'place' });
}

/** Water you can scoop from a cell: { kind:'water'|'puddle', left, max } or null. */
function waterSourceAt(x, y){
    const i = cellIndex(x, y), g = groundAt(x, y);
    if(g && g.water) return { kind:'water', left: Theaya.water[i] ?? 0, max: WATER_UNITS };
    if(Theaya.puddles.has(i)) return { kind:'puddle', left: Theaya.puddles.get(i), max: 2 };
    return null;
}
/** Fill the held canteen / bucket from a water cell or a puddle. */
function fillContainer(x, y){
    const item = heldItem(), i = cellIndex(x, y), w = waterOf(item), src = waterSourceAt(x, y);
    if(!w){ notify('Hold a canteen or a bucket.', '#ffb070'); return; }
    if(!src) return;
    if(src.left <= 0){ notify('This water source is dry.', '#ffb070'); return; }
    if(w.full){ notify(`The ${prettify(item.id)} is already full.`, '#ffb070'); return; }
    const n = Math.min(src.left, w.capacity - w.value);
    w.value += n;
    if(src.kind === 'water'){
        Theaya.water[i] = src.left - n;
        if(Theaya.water[i] <= 0 && WATER_REFILL_SECONDS > 0) Theaya.refilling.set(i, sceneTime() + WATER_REFILL_SECONDS);
    } else if(src.left - n > 0) Theaya.puddles.set(i, src.left - n);
    else Theaya.puddles.delete(i);
    Theaya.dirty.add(i);
    notify(`${prettify(item.id)} ${w.value}/${w.capacity} (${src.left - n} left in this ${src.kind === 'water' ? 'source' : 'puddle'})`, '#8fd0ff');
}
/** Kept for older code: fillCanteen(x, y) = fillContainer(x, y). */
function fillCanteen(x, y){ fillContainer(x, y); }

function useLabel(item){
    if(!item) return null;
    if(item instanceof Canteen) return item.water.empty ? null : `Drink (${item.water.value}/${item.water.capacity})`;
    if(item.has && item.has('consume')) return `Eat ${prettify(item.id)}${item.has('poisonous') ? ' (raw: may poison)' : ''}`;
    if(armorSlotOf(item)) return `Wear ${prettify(item.id)}`;
    if(item instanceof BlockItem && Blocks.get(item.block) && Blocks.get(item.block).light) return `Place ${prettify(item.id)} here`;
    return null;
}
/** F key / "Eat"/"Drink" action: use the held item on yourself. */
function useHeld(){
    const item = heldItem(), p = player;
    if(!item){ notify('Nothing in hand.', '#ffb070'); return; }
    if(item instanceof Canteen){
        if(item.water.empty){ notify('The canteen is empty. Fill it at a water cell or a puddle.', '#ffb070'); return; }
        item.water.value--;
        p.thirst = Math.min(100, p.thirst + SURVIVAL.sip);
        notify(`Drank water (thirst ${Math.round(p.thirst)})`, '#8fd0ff');
        return;
    }
    if(item instanceof Bucket){ notify('Bucket water is for farmland. Drink from a canteen.', '#ffb070'); return; }
    if(item.has('consume')){
        const r = item.consume(p);
        p.hunger = Math.min(100, p.hunger + (r.hunger || 0));
        p.satruation = Math.min(SURVIVAL.saturationMax, p.satruation + (r.saturation || 0));
        p.health = Math.min(p.maxHealth, p.health + (r.health || 0));
        const poison = item.get('poisonous'), regenC = item.get('regeneration');
        if(regenC){   // better food: heal over time (a stronger / longer meal replaces a weaker one)
            const cur = p.regenBuff;
            p.regenBuff = { rate: Math.max(regenC.rate, cur ? cur.rate : 0), left: Math.max(regenC.seconds, cur ? cur.left : 0) };
        }
        item.removeCount(1);
        p.inventory._changed({ event:'consume' });
        if(poison && Math.random() < poison.chance){
            // a second bad meal stacks the time, not the damage
            p.poison = { left: (p.poison ? p.poison.left : 0) + poison.seconds, dps: Math.max(poison.dps, p.poison ? p.poison.dps : 0) };
            notify(`Ate ${prettify(item.id)}... you feel sick! Poisoned for ${Math.ceil(p.poison.left)}s. Cook meat in a cooking pot.`, '#c6ff6a');
            return;
        }
        notify(`Ate ${prettify(item.id)} (hunger ${Math.round(p.hunger)})${r.health ? `, +${r.health} health` : ''}${regenC ? `, regenerating +${regenC.rate}/s for ${regenC.seconds}s` : ''}`, '#a6f0a0');
        return;
    }
    if(armorSlotOf(item)){ equipArmor(slotRef(p.inventory, p.inventory.hotbarSlot(GameUI.hotbar))); return; }
    if(item instanceof BlockItem && Blocks.get(item.block) && Blocks.get(item.block).light){   // torch: put it down at your feet
        const pc = playerCell();
        if(pc) placeBlock(pc.x, pc.y);
        return;
    }
    notify(`${prettify(item.id)} can't be used on yourself.`, '#ffb070');
}

function inspectCell(x, y){
    const i = cellIndex(x, y), b = blockAt(x, y), def = blockDefAt(x, y), g = groundAt(x, y);
    const biome = Theaya.biome[i] === 'cave' ? `Cave (in ${prettify(Theaya.parentBiome[i])})` : prettify(Theaya.biome[i]);
    const parts = [];
    if(def){
        let t = `${def.name}: `;
        if(def.hardness >= 10) t += 'unbreakable';
        else t += `hardness ${def.hardness}` + (def.tier > 0 ? `, needs a tier ${def.tier}+ ${def.tool}` : ', breakable by hand');
        if(def.grow) t += ', growing';
        if(!def.solid) t += ', you can walk over it';
        parts.push(t);
        if(def.kind === 'farmland'){
            parts.push(`water ${Math.round(b.water)}/${FARM.waterMax}`);
            if(b.flood > 0) parts.push(`flooded for ${(b.flood / FARM.floodDays * 100).toFixed(0)}% of the time it takes to become a pond`);
        }
        if(def.kind === 'ore_heart') parts.push(`slowly grows ${prettify(def.material)} ore in the cave around it`);
        if(def.safe) parts.push(`no monsters spawn within ${def.safe} cells`);
        if(b.cracks > 0) parts.push(`${Math.round(b.cracks * 100)}% broken by monsters`);
        const info = plantInfo(b);
        if(info){
            const state = info.rot ? 'rotten' : info.ripe ? 'ripe' : info.k < 0 ? 'sprout' : `stage ${info.k + 1}`;
            parts.push(`${prettify(info.crop.id)}: ${state}, ${b.plant.age.toFixed(2)} days old${b.plant.dry > 0 ? ', DRY' : ''}`);
            if(info.crop.tier > 0) parts.push(`harvest needs a tier ${info.crop.tier}+ hoe`);
        }
        if(def.station === 'forge' || def.station === 'pot') parts.push(b.status);
    } else if(g && g.water){
        parts.push(`Water: ${Theaya.water[i]}/${WATER_UNITS} canteen fills left`);
    } else {
        parts.push(g ? g.name : '?');
        if(Theaya.dried.has(i)) parts.push('dried-up water');
    }
    if(Theaya.puddles.has(i)) parts.push(`puddle (${Theaya.puddles.get(i)} water)`);
    if(Theaya.mud.has(i)) parts.push('muddy');
    if(Theaya.snow.has(i)) parts.push('snowy');
    parts.push(`${Math.round(temperatureAt(x, y))}°C`);
    notify(`${parts.join(', ')} | ${biome}`, '#e8e8e8');
}

/**
 * Options for the action wheel on cell (x, y):
 *   { label, enabled, reason?, warn?, run }
 * `warn` says the player walks to the cell first.
 */
function buildActions(x, y){
    const opts = [];
    const pc = playerCell();
    if(!pc) return opts;
    const cell = { x, y }, i = cellIndex(x, y);
    const d = hexDist(pc, cell);
    const b = blockAt(x, y), def = b && Blocks.get(b.id), g = groundAt(x, y);
    const held = heldItem(), w = waterOf(held);
    let approach;
    const getApproach = () => approach !== undefined ? approach : (approach = findApproach(cell));

    // An action done from a neighbouring cell. Walks there first when needed.
    const nearAction = (label, run, extra = {}) => {
        if(extra.enabled === false) return { label, enabled:false, reason: extra.reason };
        if(d === 1) return { label, enabled:true, run: () => doNear(cell, run) };
        if(d === 0 && extra.here){ return { label, enabled:true, run } }
        const ap = getApproach();
        if(!ap) return { label, enabled:false, reason:"Can't reach this cell" };
        const steps = ap.path.length;
        return { label, enabled:true, warn:`Walks there first (${steps} cell${steps === 1 ? '' : 's'})`, run: () => doNear(cell, run) };
    };

    // Main action: move
    if(d > 0){
        if(isPassable(x, y)){
            const path = areaZones.home.findPath(pc, cell, pathOpts());
            opts.push(path ? { label:'Move here', enabled:true, run: () => walkTo(x, y) }
                           : { label:'Move here', enabled:false, reason:'No path' });
        } else if(d > 1){
            const ap = getApproach();
            opts.push(ap ? { label:'Move next to it', enabled:true, run: () => walkTo(ap.x, ap.y) }
                         : { label:'Move next to it', enabled:false, reason:'No path' });
        }
    }

    // A creature in the cell: attack it (walks into range first)
    const mob = Mobs.at(x, y);
    if(mob){
        const a = attackActionFor(mob);
        opts.push(a.reason ? { label: a.label, enabled:false, reason: a.reason } : { label: a.label, enabled:true, run: a.run });
    }

    if(def){
        if(def.station) opts.push(nearAction(`Open ${def.name}`, () => openStation(x, y)));
        const info = plantInfo(b);
        if(info){
            const name = prettify(info.crop.id), tier = canHarvestTier(info.crop, held);
            if(info.rot) opts.push(nearAction(`Clear rotten ${name}`, () => harvestPlant(x, y)));
            else if(info.stage && info.stage.yield[1] > 0){
                opts.push(nearAction(`Harvest ${name}${info.ripe ? '' : ' (not ripe yet)'}`, () => harvestPlant(x, y), { enabled: tier.ok, reason: tier.reason }));
            }
        }
        if(def.kind === 'fern') opts.push(nearAction('Gather plant fibers', () => harvestFern(x, y), { here:true }));
        if(def.kind === 'farmland'){
            if(!b.plant && held instanceof CropSeedItem) opts.push(nearAction(`Plant ${prettify(held.crop)}`, () => plantSeed(x, y)));
            if(held instanceof Bucket){
                const full = b.water >= FARM.waterMax;   // full: pouring more floods it (a pond, given time)
                const reason = w.empty ? 'The bucket is empty' : b.water >= FARM.floodMax ? "Can't hold any more water" : undefined;
                opts.push(nearAction(`${full ? 'Flood' : 'Water'} farmland (${Math.round(b.water)}/${FARM.waterMax})`, () => waterFarmland(x, y), { enabled: !reason, reason }));
            }
        }
        if(!def.replaceable){
            const mi = miningInfo(def, held), busy = containerBusy(b);
            opts.push(nearAction(`${verbFor(def)} ${def.name}${mi.ok ? ` (${mi.time.toFixed(1)}s)` : ''}`,
                () => startMine(x, y),
                { enabled: mi.ok && !busy, reason: !mi.ok ? mi.reason : busy ? 'Empty it first' : undefined, here: !def.solid }));
        }
    }
    const floorish = !def || def.replaceable;
    const src = waterSourceAt(x, y);
    if(floorish && src && (src.kind === 'water' || w)){
        let reason;
        if(!w) reason = 'Hold a canteen or a bucket';
        else if(src.left <= 0) reason = 'This source is dry';
        else if(w.full) reason = `The ${prettify(held.id)} is full`;
        const what = w ? prettify(held.id).toLowerCase() : 'canteen';
        opts.push(nearAction(`Fill ${what} (${src.left}/${src.max}${src.kind === 'puddle' ? ' puddle' : ''})`, () => fillContainer(x, y), { enabled: !reason, reason, here: src.kind === 'puddle' }));
    }
    if(floorish && g && g.passable){
        if(isHoe(held)){
            const can = canTill(x, y);
            opts.push(nearAction(`Till soil (${tillTime(held).toFixed(1)}s)`, () => startTill(x, y), { enabled: can.ok, reason: can.reason }));
        }
        if(!def && Theaya.ground[i] === FLOOR){
            opts.push(nearAction(`Dig dirt (${digGrassTime(held).toFixed(1)}s${isShovel(held) ? '' : ', by hand'})`, () => startDigGrass(x, y), { here:true }));
        }
        // walk-over blocks (torches, sand) can go on your own cell
        const underfoot = held instanceof BlockItem && !blocksMover(Blocks.get(held.block), 'player');
        if((d > 0 || underfoot) && held instanceof BlockItem) opts.push(nearAction(`Place ${prettify(held.id)}`, () => placeBlock(x, y), { here: underfoot }));
    } else if(!def && d > 0 && held instanceof BlockItem){
        opts.push({ label:`Place ${prettify(held.id)}`, enabled:false, reason:"Can't build here" });
    }

    if(d === 0){
        const use = useLabel(held);
        if(use) opts.push({ label: use, enabled:true, run: useHeld });
    }
    opts.push({ label:'Inspect', enabled:true, run: () => inspectCell(x, y) });
    return opts;
}


/* ---------------------------------------------------------------------
 * 10. Stations + containers
 *   workbench: crafting menu.  forge: input (4) / fuel (1) / output (2)
 *   slots, smelts one recipe at a time.  chest: CHEST_SLOTS slots.
 *   Forges and chests open the backpack next to them for moving items.
 * --------------------------------------------------------------------- */
function openStation(x, y){
    const def = blockDefAt(x, y);
    if(!def || !def.station) return;
    GameUI.station = { x, y, kind: def.station };
    GameUI.scroll.station = 0;
    GameUI.wheel = null;
    GameUI.picked = null;
    if(!CRAFT_STATIONS.includes(def.station) && !GameUI.inventoryOpen){ GameUI.inventoryOpen = true; GameUI.station.openedInventory = true; }
}
function closeStation(){
    const s = GameUI.station;
    if(s && s.openedInventory){ GameUI.inventoryOpen = false; }
    GameUI.station = null;
    GameUI.picked = null;
}
/** E key: open the station next to you (the hovered one first). */
function tryInteract(){
    if(GameUI.station){ closeStation(); return; }
    const pc = playerCell();
    if(!pc) return;
    const cands = areaZones.home.neighbors(pc.x, pc.y).filter(n => { const d = blockDefAt(n.x, n.y); return d && d.station; });
    if(!cands.length){ notify('No workbench, loom, cooking pot, forge or chest next to you.', '#ffb070'); return; }
    const hov = areaZones.home.toCell(mouse.x, mouse.y);
    const pick = (hov && cands.find(c => c.x === hov.x && c.y === hov.y)) || cands[0];
    openStation(pick.x, pick.y);
}
/** Close the station menu when the station is gone or the player walked off. */
function checkStation(){
    const s = GameUI.station, pc = playerCell();
    const def = blockDefAt(s.x, s.y);
    if(!def || def.station !== s.kind || !pc || hexDist(pc, s) > 1) closeStation();
}

function craft(recipe, times = 1){
    const inv = player.inventory;
    const missing = recipe.missing(inv, 1);
    if(missing.length){ notify('Missing: ' + missing.map(m => `${m.need - m.have} ${Recipe.label(m.key)}`).join(', '), '#ff8a7a'); return false; }
    times = Math.max(1, Math.min(times, recipe.maxCrafts(inv)));
    const out = recipe.output;
    if(roomForItems(out.id) < out.count * times){ notify('No room in your inventory.', '#ff8a7a'); return false; }
    recipe.consume(inv, times);
    giveItems(out.id, out.count * times);
    notify(`Crafted ${out.count * times} ${prettify(out.id)}`, '#a6f0a0');
    return true;
}

/**
 * Forge / cooking pot tick. The station picks ONE recipe from what's in its
 * input slots and sticks with it until those inputs run out (one metal / one
 * dish at a time). A fuel item burns for fuelValue * cfg.fuelSeconds once
 * lit, even if the station runs out of work. Output waits in the output
 * slots; a recipe's `byproduct` (grease from meat) goes there too.
 * The cooking pot tries the fanciest dish first (the recipe using the most
 * kinds of ingredients), so potato + grease fries instead of baking.
 */
const MACHINES = {
    forge: { cfg: FORGE, cells: () => Theaya.forges, verb:'Smelting', idle:'Idle: put ore, wood or sand in the input slots', fancyFirst:false },
    pot:   { cfg: POT,   cells: () => Theaya.pots,   verb:'Cooking',  idle:'Idle: put food in the input slots (a canteen for water)', fancyFirst:true },
};
function machineRecipe(b, kind){
    let r = b.active ? Recipe.byId(b.active) : null;
    if(r && !r.canCraft(b.input)){ r = null; b.active = null; b.progress = 0; }
    if(!r){
        let list = Recipe.for(kind);
        if(MACHINES[kind].fancyFirst) list = list.slice().sort((p, q) => Object.keys(q.inputs).length - Object.keys(p.inputs).length);
        r = list.find(q => q.canCraft(b.input)) || null;
        if(r){ b.active = r.id; b.progress = 0; }
    }
    return r;
}
/** Kept for older code: the forge's current recipe. */
function forgeRecipe(b){ return machineRecipe(b, 'forge'); }
/** Is there room in the output for a recipe's result (and its byproduct)? */
function machineHasRoom(b, r){
    const out = r.output, bp = r.byproduct;
    if(!bp) return b.output.roomFor(Items.create(out.id)) >= out.count;
    if(out.id === bp.id) return b.output.roomFor(Items.create(out.id)) >= out.count + bp.count;
    // both need a place: a slot that can take each (they can't share one slot)
    const test = new Box(b.output.size);
    b.output.items.forEach((it, k) => { if(it) test.items[k] = it.clone ? it.clone() : it; });
    return test.give(Items.create(out.id, out.count)) === 0 && test.give(Items.create(bp.id, bp.count)) === 0;
}
function tickMachines(dt){
    for(const [kind, M] of Object.entries(MACHINES)){
        for(const i of M.cells()){
            const b = Theaya.blocks[i];
            if(!b || !b.input) continue;
            const r = machineRecipe(b, kind);
            let status = M.idle;
            if(r){
                const out = r.output;
                if(!machineHasRoom(b, r)) status = 'Output full: take the items out';
                else {
                    if(b.burn <= 0){
                        const f = b.fuel.getSlot(0), v = fuelValue(f);
                        if(v > 0){ f.removeCount(1); b.fuel.changed(); b.burn = b.burnMax = v * M.cfg.fuelSeconds; }
                    }
                    if(b.burn > 0){
                        status = `${M.verb} ${prettify(out.id)}`;
                        b.progress += dt;
                        if(b.progress >= r.time){
                            b.progress = 0;
                            r.consume(b.input);
                            b.output.give(Items.create(out.id, out.count));
                            const bp = r.byproduct;
                            if(bp && Math.random() < (bp.chance ?? 1)) b.output.give(Items.create(bp.id, bp.count ?? 1));
                            if(!r.canCraft(b.input)) b.active = null;
                        }
                    } else status = 'Needs fuel (coal, logs or planks)';
                }
            }
            if(b.burn > 0) b.burn = Math.max(0, b.burn - dt);
            b.status = status;
            const lit = b.burn > 0;
            if(lit !== b.lit){ b.lit = lit; Theaya.dirty.add(i); }
        }
    }
}
/** Kept for older code / tests: ticks forges AND cooking pots. */
function tickForges(dt){ tickMachines(dt); }
function tickWorld(){
    const now = sceneTime();
    for(const [i, t] of Theaya.growing){
        if(now < t) continue;
        Theaya.growing.delete(i);
        const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
        if(def && def.grow){ const { x, y } = cellXY(i); setBlock(x, y, def.grow.into); }
    }
    for(const [i, t] of Theaya.refilling){
        if(now < t) continue;
        Theaya.refilling.delete(i);
        if(isWaterCell(i)){ Theaya.water[i] = WATER_UNITS; Theaya.dirty.add(i); }
    }
    tickOreHearts();
}

/** Cells within r (hex distance) of cell c, c excluded. */
function cellsWithin(c, r){
    const out = [];
    for(let y = c.y - r; y <= c.y + r; y++) for(let x = c.x - r - 1; x <= c.x + r + 1; x++){
        if(!Theaya.zone.inBounds(x, y) || (x === c.x && y === c.y)) continue;
        if(hexDist(c, { x, y }) <= r) out.push({ x, y });
    }
    return out;
}
/**
 * Ore hearts: every ORE_HEART.days (in game days) each heart turns one cave
 * wall (stone / calcite) or bare cave floor near it into its ore, unless
 * ORE_HEART.max of that ore are already around it.
 */
function tickOreHearts(){
    const T = Theaya, now = Clock.elapsed, pc = playerCell();
    for(const i of T.hearts){
        const b = T.blocks[i], def = b && Blocks.get(b.id);
        if(!def || def.kind !== 'ore_heart'){ T.hearts.delete(i); continue; }
        if(b.next == null){ b.next = now + ORE_HEART.days * Clock.day * (0.7 + 0.6 * Math.random()); continue; }
        if(now < b.next) continue;
        b.next = now + ORE_HEART.days * Clock.day * (0.7 + 0.6 * Math.random());
        const ore = `${def.material}_ore`, near = cellsWithin(cellXY(i), ORE_HEART.radius);
        if(near.filter(c => (blockAt(c.x, c.y) || {}).id === ore).length >= ORE_HEART.max) continue;
        const spots = near.filter(c => {
            const j = cellIndex(c.x, c.y), d = blockDefAt(c.x, c.y);
            if(d) return d.kind === 'stone';                                        // cave wall
            return T.biome[j] === 'cave' && T.ground[j] === FLOOR && !Mobs.occ.has(j) && !(pc && pc.x === c.x && pc.y === c.y);
        });
        if(!spots.length) continue;
        spots.sort((a, b2) => (blockAt(b2.x, b2.y) ? 1 : 0) - (blockAt(a.x, a.y) ? 1 : 0) + (Math.random() - 0.5) * 0.5);   // walls first
        const c = spots[0];
        setBlock(c.x, c.y, ore);
    }
}

/**
 * Natural regrowth (see REGROW): emptied cells slowly get back the natural
 * block they had when the world was made (trees as saplings, mined ore as
 * cave wall: the ore hearts turn that back into ore). Forests spread a
 * little and desert wind piles up sand and rebuilds dunes. Nothing grows
 * near the player, near torches or near anything the player built.
 */
const Regrowth = {
    timer: REGROW.every,
    treeCap: 0,          // forests don't spread past this many trees (the world's start count + 10%)
    kindOf(id){
        const d = Blocks.get(id);
        if(!d) return null;
        if(id === 'sand_dune') return 'dune';
        if(d.kind === 'sapling' || d.kind === 'tree') return 'tree';
        if(d.kind === 'stone' || d.kind === 'ore' || d.kind === 'ore_heart') return 'stone';
        return d.kind;   // 'fern' | 'plant' | 'soil'
    },
    /** What grows back on cell i (it started with Theaya.origin[i]). */
    regrowId(i){
        const o = Theaya.origin[i], d = o && Blocks.get(o);
        if(!d) return null;
        if(d.kind === 'ore' || d.kind === 'ore_heart') return biomes.cave.wall;
        if(d.kind === 'tree') return `${d.tree}_sapling`;
        if(o === 'sand_dune') return 'sand';   // the sand comes back first, then the dune (step)
        return o;
    },
    /** Far enough from the player, torches and everything built? */
    quiet(i){
        const c = cellXY(i), pc = playerCell();
        if(pc && hexDist(c, pc) < REGROW.playerDist) return false;
        if(Mobs.occ.has(i)) return false;
        for(const j of Theaya.built) if(hexDist(c, cellXY(j)) <= REGROW.builtDist) return false;
        return true;
    },
    tick(dt){
        this.timer -= dt;
        if(this.timer > 0) return;
        this.timer = REGROW.every;
        this.step();
    },
    step(){
        const T = Theaya, N = MAP_COLS * MAP_ROWS;
        const warm = i => { const { x, y } = cellXY(i); return temperatureAt(x, y) > 0; };
        const put = (i, id) => { const { x, y } = cellXY(i); setBlock(x, y, id); };
        for(let k = 0; k < REGROW.tries; k++){
            const i = Math.floor(Math.random() * N), b = T.blocks[i];
            if(b){
                // loose sand where a dune was piles back up into a dune
                if(b.id === 'sand' && T.origin[i] === 'sand_dune' && Math.random() < REGROW.chance.dune && this.quiet(i)) put(i, 'sand_dune');
                continue;
            }
            if(T.ground[i] !== FLOOR) continue;
            const id = this.regrowId(i);
            if(id){
                const kind = this.kindOf(id);
                if(Math.random() >= (REGROW.chance[kind] ?? 0.3)) continue;
                if(['tree', 'fern', 'plant'].includes(kind) && !warm(i)) continue;
                if(this.quiet(i)) put(i, id);
            } else if(T.biome[i] === 'desert' && !T.origin[i] && Math.random() < REGROW.sandDrift * 0.25 && this.quiet(i)){
                put(i, 'sand');   // wind-blown sand on bare desert floor
            }
        }
        // forests spread: a tree drops a sapling next to it
        if(T.trees.size && T.trees.size < this.treeCap){
            const trees = [...T.trees];
            for(let k = 0; k < REGROW.tries; k++){
                if(Math.random() >= REGROW.treeSeed) continue;
                const t = trees[Math.floor(Math.random() * trees.length)], def = Blocks.get(T.blocks[t].id);
                const spots = neighborIdx(t).filter(j => !T.blocks[j] && T.ground[j] === FLOOR && T.biome[j] !== 'cave' && warm(j) && this.quiet(j));
                if(spots.length) put(spots[Math.floor(Math.random() * spots.length)], `${def.tree}_sapling`);
            }
        }
    },
};
Regrowth.treeCap = Math.round(Theaya.trees.size * 1.1);


/* ---------------------------------------------------------------------
 * 10b. Time, seasons, temperature and weather
 *   Clock reads _worldTimeCycle (day length, sun / moon time, months,
 *   seasons, start). Day 0 of a year is the new year day, then the months.
 *   A day starts at sunrise (06:00); the sun is up for `sunTime` seconds.
 *   Weather reads each season's `weather` list (rolled once a day) and the
 *   effect values in _weatherControl.
 * --------------------------------------------------------------------- */
const Clock = {
    cfg: _worldTimeCycle,
    elapsed: 0,    // game seconds since year 1 day 0 sunrise
    startDay: 0,   // dayIndex the game started on ("Day 1")
    get day(){ return Number(this.cfg.day) || 900; },
    get speed(){ return Number(this.cfg.speed) || 1; },
    get sunTime(){ return Math.min(this.day, Number(this.cfg.sunTime) || this.day * 2 / 3); },
    get monthDays(){ return Number(this.cfg.month) || 28; },
    get months(){ return Number(this.cfg.months) || (this.cfg.monthNames || []).length || 12; },
    get yearDays(){ return Math.max(this.months * this.monthDays, Number(this.cfg.year) || 0); },
    get extraDays(){ return this.yearDays - this.months * this.monthDays; },   // new year day(s)
    monthName(m){ return (this.cfg.monthNames && this.cfg.monthNames[m]) || `Month ${m + 1}`; },
    advance(dt){ this.elapsed += dt * this.speed; },
    /** In game days that pass in dt real (scene) seconds. */
    dayDelta(dt){ return dt * this.speed / this.day; },
    get dayIndex(){ return Math.floor(this.elapsed / this.day); },
    /** 0 (sunrise) .. 1 */
    get timeOfDay(){ return (this.elapsed % this.day) / this.day; },
    get isDay(){ return (this.elapsed % this.day) < this.sunTime; },
    /** 24 hour clock, sunrise = 06:00. */
    get hour(){ return (6 + this.timeOfDay * 24) % 24; },
    timeText(){ const h = this.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
    /** { year, dayOfYear, month (-1 on a new year day), monthName, dayOfMonth, newYear } */
    date(){
        const D = this.dayIndex, Y = this.yearDays, doy = ((D % Y) + Y) % Y, extra = this.extraDays;
        const year = Math.floor(D / Y) + 1;
        if(doy < extra) return { year, dayOfYear: doy, month: -1, monthName: this.cfg.newYearDay || 'New Year', dayOfMonth: doy + 1, newYear: true };
        const m = Math.floor((doy - extra) / this.monthDays);
        return { year, dayOfYear: doy, month: m, monthName: this.monthName(m), dayOfMonth: (doy - extra) % this.monthDays + 1, newYear: false };
    },
    dateText(){ const d = this.date(); return d.newYear ? `${d.monthName}, Year ${d.year}` : `${d.monthName} ${d.dayOfMonth}, Year ${d.year}`; },
    /** Season id for the current date. */
    season(){ const d = this.date(); return this.seasonOf(d.newYear ? -1 : d.month); },
    /** Season id of month m (0-based; -1 = the new year day(s), which belong to the last month's season). */
    seasonOf(m){
        const seasons = Object.keys(this.cfg.seasons || {});
        if(!seasons.length) return 'none';
        const month = m < 0 ? this.months - 1 : m, name = this.monthName(month);
        const map = this.cfg.seasonMonths || {};
        for(const s of seasons) if((map[s] || []).includes(name)) return s;
        return seasons[Math.min(seasons.length - 1, Math.floor(month * seasons.length / this.months))];   // even split
    },
    seasonData(){ return (this.cfg.seasons || {})[this.season()] || {}; },
    /** 1 = full daylight, 0 = night. Dawn / dusk fade over 6% of a day. */
    light(){
        const t = this.elapsed % this.day, f = 0.06 * this.day, sun = this.sunTime;
        const s = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
        const up = t < sun / 2 ? s((t + f / 2) / f) : 1;            // sunrise around t = 0
        const down = t > sun / 2 ? s((sun + f / 2 - t) / f) : 1;    // sunset around t = sunTime
        const dawn = t > this.day - f / 2 ? s((t - (this.day - f / 2)) / f) : 0;
        return Math.max(Math.min(up, down), dawn);
    },
    /** Set the clock: setTime(hour) or setTime(hour, { month:'Fyrtide', day: 3, year: 1 }). */
    set(hour = 7, date = null){
        let day = this.dayIndex;
        if(date){
            const names = this.cfg.monthNames || [];
            const m = typeof date.month === 'string' ? names.indexOf(date.month) : (date.month ?? 0);
            day = ((date.year ?? 1) - 1) * this.yearDays + this.extraDays + Math.max(0, m) * this.monthDays + ((date.day ?? 1) - 1);
        }
        this.elapsed = day * this.day + (((hour - 6) % 24 + 24) % 24) / 24 * this.day;
    },
};
(() => { const s = _worldTimeCycle.start || {}; Clock.set(s.hour ?? 7, { month: s.month ?? 0, day: s.day ?? 1, year: s.year ?? 1 }); Clock.startDay = Clock.dayIndex; })();

/** Temperature (°C) of a cell: biome + season + time of day + weather. Caves are sheltered. */
function temperatureAt(x, y){
    const i = cellIndex(x, y), id = Theaya.biome[i], b = biomes[id] || {};
    const cave = id === 'cave';
    const seasonal = ((Clock.seasonData().temprature ?? 20) - 20) * (cave ? 0.5 : 1);
    const t = Clock.timeOfDay * Clock.day, sun = Clock.sunTime;
    const daily = cave ? 0 : t < sun ? 3 * Math.sin(Math.PI * t / sun) : -4 * Math.sin(Math.PI * (t - sun) / (Clock.day - sun));
    return (b.temprature ?? 20) + seasonal + daily + (cave ? 0 : Weather.param('temprature', 0));
}
const playerTemperature = () => { const pc = playerCell(); return pc ? temperatureAt(pc.x, pc.y) : 20; };

const Weather = {
    current: null,   // { type, start, end, hail }
    next: null,      // { type, start, duration } rolled for today
    lastDay: -1,
    acc: 0,
    flash: 0,        // lightning flash, 1 -> 0
    bolt: null,      // { x, y, until } last lightning strike (world position)
    get type(){ return this.current ? this.current.type : 'clear'; },
    data(type = this.type){ return _weatherControl[type] || {}; },
    /** A value of the current weather's _weatherControl entry (dflt when clear / missing). */
    param(key, dflt){ if(!this.current) return dflt; const v = this.data()[key]; return v ?? dflt; },
    name(){
        if(!this.current) return 'Clear';
        const W = this.data(), base = W.name || prettify(this.type);
        if(this.current.hail && this.type !== 'hail') return `${base} + hail`;
        if(W.precipitation && playerTemperature() <= 0 && this.type !== 'hail') return this.type === 'storm' ? 'Snowstorm' : 'Snow';
        return base;
    },
    /** Rolls today's weather from the season's list (first entry whose chance hits). */
    roll(){
        for(const w of Clock.seasonData().weather || []){
            if(Math.random() >= (w.chance || 0)) continue;
            const [a, b] = w.duration || [0.1, 0.3];
            this.next = { type: w.type, start: Clock.elapsed + Math.random() * 0.6 * Clock.day, duration: (a + Math.random() * (b - a)) * Clock.day };
            return;
        }
    },
    /** Start a weather now. duration in game seconds. */
    begin(type, duration){
        const temp = playerTemperature(), hailMax = (_weatherControl.hail || {}).maxTemprature ?? 10;
        if(type === 'hail' && temp > hailMax) type = 'rain';
        if(!_weatherControl[type]){ console.warn(`Weather: unknown type '${type}'.`); return; }
        const W = _weatherControl[type];
        this.current = { type, start: Clock.elapsed, end: Clock.elapsed + duration,
            hail: type === 'hail' || (!!W.hailChance && temp <= hailMax && Math.random() < W.hailChance) };
        notify(`Weather: ${this.name()}`, '#bcd6ff');
    },
    end(){ if(this.current) notify(`The ${this.name().toLowerCase()} is over.`, '#bcd6ff'); this.current = null; },
    tick(dt){
        const day = Clock.dayIndex;
        if(day !== this.lastDay){ this.lastDay = day; if(!this.current && !this.next) this.roll(); }
        if(!this.current && this.next && Clock.elapsed >= this.next.start){ const n = this.next; this.next = null; this.begin(n.type, n.duration); }
        if(this.current && Clock.elapsed >= this.current.end) this.end();
        this.acc += dt * Clock.speed;
        if(this.acc >= 1){ this.step(this.acc); this.acc = 0; }
        this.flash = Math.max(0, this.flash - dt * 2.5);
    },
    /** Applies `sec` game seconds of weather to the terrain. */
    step(sec){
        const T = Theaya, N = MAP_COLS * MAP_ROWS, k = sec / 60;
        const W = this.current ? this.data() : {};
        const count = rate => { const v = (rate || 0) * k; return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); };
        const chance = rate => Math.random() < (rate || 0) * k;
        const randomCell = (test, tries = 25) => { for(let t = 0; t < tries; t++){ const i = Math.floor(Math.random() * N); if(test(i)) return i; } return -1; };
        const tempOf = i => { const { x, y } = cellXY(i); return temperatureAt(x, y); };
        const openFloor = i => T.ground[i] === FLOOR && !blocksMover(Blocks.get(T.blocks[i] && T.blocks[i].id), 'animal') && !(T.blocks[i] && Blocks.get(T.blocks[i].id).kind === 'farmland');
        const pc = playerCell(), notPlayer = i => !pc || cellIndex(pc.x, pc.y) !== i;

        if(W.precipitation){
            for(let n = count(W.puddles); n > 0 && T.puddles.size < (W.maxPuddles || 40); n--){
                const i = randomCell(i => openFloor(i) && !T.blocks[i] && tempOf(i) > 0);
                if(i >= 0){ T.puddles.set(i, Math.min(2, (T.puddles.get(i) || 0) + 1)); T.dirty.add(i); }
            }
            for(let n = count(W.snow); n > 0; n--){
                const i = randomCell(i => openFloor(i) && !T.snow.has(i) && tempOf(i) <= 0);
                if(i >= 0){ T.snow.add(i); T.puddles.delete(i); T.dirty.add(i); }
            }
            for(let n = count(W.mud); n > 0; n--){
                const i = randomCell(i => openFloor(i) && !T.mud.has(i) && (T.puddles.has(i) || neighborIdx(i).some(j => isWaterCell(j) || T.puddles.has(j) || T.mud.has(j))));
                if(i >= 0){ T.mud.add(i); T.dirty.add(i); }
            }
            for(let n = count(W.refill); n > 0 && T.waterCells.length; n--){
                const i = T.waterCells[Math.floor(Math.random() * T.waterCells.length)];
                if(T.dried.has(i)){
                    if(!T.blocks[i] && notPlayer(i)){ T.dried.delete(i); const { x, y } = cellXY(i); T.water[i] = 1; setGround(x, y, 'water'); }
                } else if(isWaterCell(i) && (T.water[i] ?? 0) < WATER_UNITS){
                    T.water[i] = (T.water[i] ?? 0) + 1; T.refilling.delete(i); T.dirty.add(i);
                }
            }
            if(W.farmWater){
                for(const i of T.plants){
                    const b = T.blocks[i];
                    if(b && b.id === 'farmland' && b.water < FARM.waterMax) b.water = Math.min(FARM.waterMax, b.water + W.farmWater * k * (tempOf(i) <= 0 ? 0.3 : 1));
                }
            }
            for(let n = count(W.ferns); n > 0; n--){
                const i = randomCell(i => !T.blocks[i] && T.ground[i] === FLOOR && ['plains', 'forest'].includes(T.biome[i]) && notPlayer(i) && tempOf(i) > 0);
                if(i >= 0){ const { x, y } = cellXY(i); setBlock(x, y, 'fern'); }
            }
            for(let n = count(W.clay); n > 0; n--){
                const i = randomCell(i => T.blocks[i] && T.blocks[i].id === 'dirt' && nextToWater(i), 60);
                if(i >= 0){ const { x, y } = cellXY(i); setBlock(x, y, 'clay'); }
            }
            if(this.current.hail){
                const H = _weatherControl.hail || {};
                for(const i of T.plants){
                    const b = T.blocks[i], info = plantInfo(b);
                    if(info && !info.rot && b.plant.age > 0 && chance(H.cropDamage)){ b.plant.age = Math.max(0, b.plant.age - (H.setback ?? 0.25)); T.dirty.add(i); }
                }
            }
            if(chance(W.lightning)) this.strike();
        }
        if(this.type === 'drought'){
            for(let n = count(W.evaporate); n > 0 && T.waterCells.length; n--){
                const i = T.waterCells[Math.floor(Math.random() * T.waterCells.length)];
                if(!isWaterCell(i)) continue;
                T.water[i] = Math.max(0, (T.water[i] ?? 0) - 1); T.dirty.add(i);
                const shore = neighborIdx(i).some(j => !isWaterCell(j));
                if(T.water[i] <= 0 && shore && Math.random() < (W.dryUp || 0)){
                    const { x, y } = cellXY(i);
                    T.dried.add(i); T.refilling.delete(i); setGround(x, y, FLOOR);
                }
            }
        }
        // Drying: puddles / mud dry out and snow melts when it isn't coming down.
        const wet = !!W.precipitation, pdrain = this.param('puddleDrain', 1);
        for(const [i, v] of T.puddles){
            if(wet && tempOf(i) > 0) continue;
            if(Math.random() < k * 0.6 * pdrain){ if(v <= 1) T.puddles.delete(i); else T.puddles.set(i, v - 1); T.dirty.add(i); }
        }
        if(!wet) for(const i of T.mud) if(Math.random() < k * 0.45 * pdrain){ T.mud.delete(i); T.dirty.add(i); }
        for(const i of T.snow){
            if(Math.random() < k * 0.8 && tempOf(i) > 0){
                T.snow.delete(i);
                if(!T.blocks[i] && Math.random() < 0.5) T.puddles.set(i, 1);   // melt water
                T.dirty.add(i);
            }
        }
    },
    /** A lightning strike near the player: sand turns to glass, it hurts if it hits you. */
    strike(){
        const pc = playerCell();
        if(!pc) return;
        let x = pc.x, y = pc.y;
        for(let t = 0; t < 10; t++){
            x = pc.x + Math.round((Math.random() * 2 - 1) * 9); y = pc.y + Math.round((Math.random() * 2 - 1) * 7);
            if(Theaya.zone.inBounds(x, y)) break;
        }
        if(!Theaya.zone.inBounds(x, y)) return;
        const b = blockAt(x, y), W = this.data(), w = Theaya.zone.toWorld(x, y);
        this.flash = 1;
        this.bolt = { x: w.x, y: w.y, until: performance.now() + 220 };
        if(b && b.id === 'sand'){ setBlock(x, y, 'glass'); notify('Lightning struck the sand and turned it to glass!', '#fff2a8'); }
        if(x === pc.x && y === pc.y){ damagePlayer(W.lightningDamage ?? 3, 'lightning'); notify('You were struck by lightning!', '#ff8a7a'); }
    },
};

/* Console helpers for trying things out:
 *   setWeather('storm', 0.2)   start a weather for 0.2 in game days ('clear' stops it)
 *   setTime(21)                set the hour;  setTime(12, { month:'Fyrtide', day:1 })
 *   Clock.cfg.speed = 20       make days pass 20x faster                          */
function setWeather(type, days = 0.2){
    if(type === 'clear' || !type){ Weather.end(); Weather.next = null; return; }
    Weather.next = null;
    Weather.begin(type, days * Clock.day);
}
function setTime(hour, date = null){ Clock.set(hour, date); Weather.lastDay = Clock.dayIndex; }


/* ---------------------------------------------------------------------
 * 10c. Creatures (animals + zombies) and combat
 *   Creatures live on the hex grid, one per cell, and walk cell to cell.
 *   Who can walk where is the block's `passableFor` (movers 'animal',
 *   'zombie'; birds fly over everything). Combat: see startAttack().
 * --------------------------------------------------------------------- */

/**
 * Creature types.
 *   hp, speed (cells per second), size (px), mover ('animal' | 'zombie' | 'bird')
 *   behaviour  'hostile': wanders, chases the player within `sight` cells and
 *                         hits for `damage` every `cooldown` seconds
 *              'passive': wanders, runs when hurt (or when the player comes
 *                         within `skittish` cells)
 *   biomes / count  where they live and how many (topped up over time)
 *   dark       only spawns in dark places (caves, or anywhere at night)
 *   breaks     seconds it takes to break a block by its `siege` class ('wood' walls / doors /
 *              planks, 'stone' walls, 'glass') when it's chasing you and that's the way through
 *   drops      [[itemId, min, max = min, chance = 1], ...]
 * Hostiles that spot you keep chasing: they remember you for HOSTILE.memory
 * seconds after they lose sight of you (walls block sight).
 */
const CREATURES = {
    zombie:  { name:'Zombie',  hp:30, speed:0.9, size:15, mover:'zombie', behaviour:'hostile', sight:6, damage:8,  cooldown:1.6, color:'#5d7a4c', dark:true,
               breaks:{ wood:15, stone:60, glass:10 }, drops:[['rotten_flesh', 0, 2]] },
    // rare, daytime only (HOSTILE.orcChance): slower than a zombie, hits much harder but slowly
    orc:     { name:'Orc',     hp:80, speed:0.6, size:19, mover:'zombie', behaviour:'hostile', sight:7, damage:22, cooldown:3.2, color:'#56733a',
               breaks:{ wood:7, stone:35, glass:5 }, drops:[['raw_iron', 1, 2, 0.5], ['coal', 1, 3], ['flint', 1, 2, 0.5]] },
    bear:    { name:'Bear',    hp:60, speed:2.0, size:20, mover:'animal', behaviour:'hostile', sight:4, damage:14, cooldown:1.8, color:'#5a3e2b', biomes:['forest'], count:4, drops:[['raw_bear_meat', 2, 4]] },
    deer:    { name:'Deer',    hp:24, speed:2.8, size:15, mover:'animal', behaviour:'passive', skittish:4, color:'#a8743f', biomes:['forest', 'plains'], count:8, drops:[['raw_venison', 2, 3]] },
    rabbit:  { name:'Rabbit',  hp:6,  speed:3.2, size:8,  mover:'animal', behaviour:'passive', skittish:3, color:'#c9bfb2', biomes:['plains', 'desert', 'forest'], count:8, drops:[['raw_rabbit', 1]] },
    cow:     { name:'Cow',     hp:30, speed:1.2, size:18, mover:'animal', behaviour:'passive', color:'#f2efe8', biomes:['plains'], count:6, drops:[['raw_beef', 2, 4]] },
    pig:     { name:'Pig',     hp:20, speed:1.4, size:14, mover:'animal', behaviour:'passive', color:'#eaa3a8', biomes:['plains', 'forest'], count:6, drops:[['raw_pork', 2, 3]] },
    chicken: { name:'Chicken', hp:6,  speed:1.6, size:8,  mover:'animal', behaviour:'passive', color:'#f6f3ea', biomes:['plains'], count:7, drops:[['raw_chicken', 1, 2]] },
    bird:    { name:'Bird',    hp:4,  speed:3.6, size:7,  mover:'bird',   behaviour:'passive', skittish:3, color:'#3f5a8a', biomes:['plains', 'forest', 'desert'], count:8, drops:[['raw_bird_meat', 1]] },
};
/**
 * Hostile spawning: caps, seconds between spawn tries, min / max cells from the player, light
 * level that counts as dark, sun damage. `memory` = seconds a hostile keeps chasing after it
 * loses sight of you, `giveUp` = it stops when you're further than this many cells.
 * Orcs: `orcChance` per spawn try in daylight (every spawnEvery s), at most `maxOrcs` at once.
 * Nothing hostile spawns near a torch (TORCH.safe cells) or a lit forge (3 cells).
 */
const HOSTILE = { maxNight: 10, maxCave: 5, spawnEvery: 4, minDist: 8, maxDist: 16, darkLight: 0.35, sunBurn: 4,
                  memory: 30, giveUp: 10, orcChance: 0.006, maxOrcs: 5 };

/** A tiny binary min-heap for the chase pathing. */
class MinHeap {
    constructor(){ this.a = []; }
    get size(){ return this.a.length; }
    push(key, pri){
        const a = this.a; a.push({ key, pri });
        for(let i = a.length - 1; i > 0;){ const p = (i - 1) >> 1; if(a[p].pri <= a[i].pri) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop(){
        const a = this.a, top = a[0], last = a.pop();
        if(a.length){
            a[0] = last;
            for(let i = 0;;){
                const l = 2 * i + 1, r = l + 1; let m = i;
                if(l < a.length && a[l].pri < a[m].pri) m = l;
                if(r < a.length && a[r].pri < a[m].pri) m = r;
                if(m === i) break;
                [a[m], a[i]] = [a[i], a[m]]; i = m;
            }
        }
        return top;
    }
}

const Mobs = {
    list: [],
    occ: new Map(),          // cell index -> mob (current cell and the cell it's walking into)
    nextId: 1,
    now: 0,                  // creature clock: seconds of game ticks (aggro, memory, fleeing timers)
    spawnTimer: 0,
    repopTimer: 0,
    fx: [],                  // { kind:'arrow'|'swing'|'number'|'poof', ..., t0, dur }
    at(x, y){ return this.occ.get(cellIndex(x, y)) ?? null; },
    /** The creature drawn nearest to a world point (within r px). */
    nearPoint(wx, wy, r = 22){
        let best = null, bd = r;
        for(const m of this.list){ const d = Math.hypot(m.px - wx, m.py - wy); if(d < bd){ bd = d; best = m; } }
        return best;
    },
    passable(m, x, y){
        if(!Theaya.zone.inBounds(x, y)) return false;
        return m.def.mover === 'bird' ? true : isPassable(x, y, m.def.mover);
    },
    canEnter(m, x, y){
        if(!this.passable(m, x, y)) return false;
        // creatures of the dark don't leave a cave into daylight
        if(m.def.dark && Theaya.biome[cellIndex(m.x, m.y)] === 'cave' && Theaya.biome[cellIndex(x, y)] !== 'cave' && Clock.light() > 0.5) return false;
        const o = this.occ.get(cellIndex(x, y));
        if(o && o !== m) return false;
        const pc = playerCell();
        return !(pc && pc.x === x && pc.y === y);
    },
    spawn(type, x, y){
        const def = CREATURES[type];
        if(!def) throw new Error(`Mobs.spawn: unknown creature '${type}'.`);
        const w = Theaya.zone.toWorld(x, y);
        const m = { id: this.nextId++, type, def, hp: def.hp, x, y, px: w.x, py: w.y, next: null,
                    wait: Math.random() * 2, cooldown: 0, fleeUntil: 0, aggroUntil: 0, facing: Math.random() * Math.PI * 2,
                    hitAt: -1e9, alive: true, bob: Math.random() * 10 };
        this.list.push(m);
        this.occ.set(cellIndex(x, y), m);
        return m;
    },
    remove(m){
        m.alive = false;
        this.list = this.list.filter(o => o !== m);
        for(const [k, o] of this.occ) if(o === m) this.occ.delete(k);
    },
    /** Damage a creature (from the player). Animals run, hostiles get angry. Kills give the drops. */
    hurt(m, dmg){
        if(!m.alive) return;
        m.hp -= dmg;
        m.hitAt = performance.now();
        this.fx.push({ kind:'number', x: m.px, y: m.py - m.def.size, text: Math.round(dmg), t0: performance.now(), dur: 700 });
        if(m.def.behaviour === 'passive') m.fleeUntil = this.now + 6;
        else { m.aggroUntil = this.now + 12; m.seenAt = this.now; }   // hurt: it knows where you are
        if(m.hp <= 0) this.kill(m);
    },
    kill(m, byPlayer = true){
        this.remove(m);
        this.fx.push({ kind:'poof', x: m.px, y: m.py, t0: performance.now(), dur: 400, color: m.def.color });
        if(!byPlayer) return;
        const drops = rollDrops({ drops: m.def.drops }).filter(([, n]) => n > 0);
        const kept = drops.map(([id, n]) => [id, n - giveItems(id, n)]);
        notify(`${m.def.name} defeated${kept.length ? ': + ' + dropsText(kept) : ''}`, '#a6f0a0');
    },
    /** Hostiles near a cell forget the player (respawn). */
    calmNear(cell, r){
        for(const m of [...this.list]) if(m.def.behaviour === 'hostile' && hexDist(m, cell) <= r) this.remove(m);
    },

    /* ----- movement / AI ----- */
    commit(m, x, y){
        m.next = { x, y };
        this.occ.set(cellIndex(x, y), m);
        const w = Theaya.zone.toWorld(x, y);
        m.facing = Math.atan2(w.y - m.py, w.x - m.px);
    },
    /** First step from the creature toward any cell within `reach` of target (BFS, limited). */
    stepToward(m, target, reach = 1, limit = 350){
        const start = cellIndex(m.x, m.y), prev = new Map([[start, -1]]), queue = [start];
        while(queue.length && prev.size < limit){
            const i = queue.shift(), c = cellXY(i);
            if(i !== start && hexDist(c, target) <= reach){
                let k = i; while(prev.get(k) !== start) k = prev.get(k);
                return cellXY(k);
            }
            for(const n of Theaya.zone.neighbors(c.x, c.y)){
                const j = cellIndex(n.x, n.y);
                if(prev.has(j) || !this.canEnter(m, n.x, n.y)) continue;
                prev.set(j, i); queue.push(j);
            }
        }
        return null;
    },
    stepAway(m, from){
        let best = null, bd = hexDist(m, from);
        for(const n of Theaya.zone.neighbors(m.x, m.y)){
            if(!this.canEnter(m, n.x, n.y)) continue;
            const d = hexDist(n, from) + Math.random() * 0.3;
            if(d > bd){ bd = d; best = n; }
        }
        return best;
    },
    wander(m){
        if(Math.random() < 0.5){ m.wait = 1 + Math.random() * 3; return; }
        const opts = Theaya.zone.neighbors(m.x, m.y).filter(n => this.canEnter(m, n.x, n.y));
        if(opts.length){ const n = opts[Math.floor(Math.random() * opts.length)]; this.commit(m, n.x, n.y); }
        m.wait = 0.5 + Math.random() * 2.5;
    },
    /** Seconds this creature needs to break the block at (x, y), or null when it can't / won't. */
    breakTime(m, x, y){
        const br = m.def.breaks;
        if(!br || !Theaya.zone.inBounds(x, y)) return null;
        const g = groundAt(x, y), b = blockAt(x, y), def = b && Blocks.get(b.id);
        if(!g || !g.passable || !def || !def.siege || br[def.siege] == null) return null;
        if(this.occ.has(cellIndex(x, y))) return null;
        return br[def.siege] * (1 - (b.cracks || 0));
    },
    /**
     * Next step of a chase: the cheapest way to a cell next to `target`, where
     * breaking a wall / door costs its break time (in cells walked at the
     * creature's speed). Returns { x, y } to walk to, { x, y, breakIt:true }
     * when the way on is through that block, or null.
     */
    chaseStep(m, target, limit = 1500){
        // A* (heuristic: hex distance to a cell next to the target)
        const start = cellIndex(m.x, m.y), cost = new Map([[start, 0]]), prev = new Map([[start, -1]]);
        const hOf = c => Math.max(0, hexDist(c, target) - 1);
        const heap = new MinHeap(), closed = new Set();
        heap.push(start, hOf(m));
        let found = -1;
        while(heap.size && closed.size < limit){
            const { key: i } = heap.pop();
            if(closed.has(i)) continue;
            closed.add(i);
            const c = cellXY(i), g = cost.get(i);
            if(i !== start && hexDist(c, target) <= 1){ found = i; break; }
            for(const n of Theaya.zone.neighbors(c.x, c.y)){
                const j = cellIndex(n.x, n.y);
                if(closed.has(j)) continue;
                let step;
                if(this.canEnter(m, n.x, n.y)) step = 1;
                else { const t = this.breakTime(m, n.x, n.y); if(t == null) continue; step = 1 + Math.min(t * m.def.speed, 12) + t * 0.001; }   // a wall "costs" at most a 12 cell detour
                const nc = g + step;
                if(nc < (cost.get(j) ?? Infinity)){ cost.set(j, nc); prev.set(j, i); heap.push(j, nc + hOf(n)); }
            }
        }
        if(found < 0) return null;
        let k = found;
        while(prev.get(k) !== start) k = prev.get(k);
        const c = cellXY(k);
        return this.canEnter(m, c.x, c.y) ? c : { x: c.x, y: c.y, breakIt: true };
    },
    /** Is a hostile after the player? (saw them within HOSTILE.memory seconds, not too far) */
    hunting(m, d, now = this.now){
        return m.def.behaviour === 'hostile' && now - (m.seenAt ?? -1e9) < HOSTILE.memory && d <= HOSTILE.giveUp;
    },
    /** Chipping at a wall / door on the way to the player (every tick while it does). */
    breakTick(m, dt){
        const k = m.breaking, b = blockAt(k.x, k.y), def = b && Blocks.get(b.id);
        const pc = playerCell(), d = pc ? hexDist(m, pc) : 99;
        if(d <= m.def.sight) m.seenAt = this.now;   // it can hear you on the other side
        if(!b || b.id !== k.id || hexDist(m, k) !== 1 || !this.hunting(m, d) || d <= 1){ m.breaking = null; return false; }
        k.recheck -= dt;
        if(k.recheck <= 0){   // a quicker way may have opened up (a door left open, the player moved)
            k.recheck = 2;
            const step = this.chaseStep(m, pc);
            if(!step || !step.breakIt){ m.breaking = null; return false; }   // another wall is no better: keep at this one
        }
        const i = cellIndex(k.x, k.y), level = Math.floor((b.cracks || 0) * 4);
        b.cracks = Math.min(1, (b.cracks || 0) + dt / m.def.breaks[def.siege]);
        if(Math.floor(b.cracks * 4) !== level) Theaya.dirty.add(i);
        const w = Theaya.zone.toWorld(k.x, k.y);
        m.facing = Math.atan2(w.y - m.py, w.x - m.px);
        k.thump -= dt;
        if(k.thump <= 0){ k.thump = 0.9; this.fx.push({ kind:'swing', x: w.x, y: w.y, t0: performance.now(), dur: 200, color:'#ffcf8a' }); }
        if(b.cracks >= 1){
            setBlock(k.x, k.y, null);
            m.breaking = null;
            if(pc && hexDist(pc, k) <= 14) notify(`The ${m.def.name.toLowerCase()} broke through your ${def.name.toLowerCase()}!`, '#ff8a7a');
        }
        return true;
    },
    think(m){
        const pc = playerCell(), now = this.now, d = pc ? hexDist(m, pc) : 99;
        m.running = false;
        if(m.def.behaviour === 'hostile' && pc){
            // spots you in its sight range (walls, doors and rock block its view). Once it's
            // after you it keeps track of you while you're in range, even behind walls.
            const was = this.hunting(m, d, now);
            if(d <= m.def.sight && (was || lineClear(m, pc, blocksSight))) m.seenAt = now;
            if(this.hunting(m, d, now)){
                if(d <= 1){
                    m.facing = Math.atan2(player.transform.position.y - m.py, player.transform.position.x - m.px);
                    if(m.cooldown <= 0){
                        const dmg = damagePlayer(m.def.damage, m.def.name);
                        m.cooldown = m.def.cooldown;
                        this.fx.push({ kind:'swing', x: player.transform.position.x, y: player.transform.position.y, t0: performance.now(), dur: 200, color:'#ff6a5a' });
                        notify(`The ${m.def.name.toLowerCase()} hits you (-${dmg.toFixed(1)})`, '#ff8a7a');
                    }
                    return;
                }
                if(now >= (m.stuckUntil || 0)){
                    const step = this.chaseStep(m, pc);
                    if(step && step.breakIt){
                        const b = blockAt(step.x, step.y);
                        m.breaking = { x: step.x, y: step.y, id: b.id, recheck: 2, thump: 0 };
                        if(hexDist(pc, step) <= 14 && now - (this._warned || -1e9) > 8){
                            this._warned = now;
                            notify(`A${/^[aeiou]/i.test(m.def.name) ? 'n' : ''} ${m.def.name.toLowerCase()} is breaking your ${Blocks.get(b.id).name.toLowerCase()}!`, '#ffb070');
                        }
                        return;
                    }
                    if(step){ this.commit(m, step.x, step.y); return; }
                    m.stuckUntil = now + 1;   // no way to you right now: shuffle about, look again shortly
                }
            }
        } else if(pc){
            const scared = now < m.fleeUntil || (m.def.skittish && d <= m.def.skittish);
            if(scared){
                const step = this.stepAway(m, pc);
                if(step){ m.running = true; this.commit(m, step.x, step.y); return; }
            }
        }
        if(m.wait > 0) return;
        this.wander(m);
    },
    tick(dt){
        this.now += dt;
        const T = Theaya, zone = T.zone, now = this.now;
        for(const m of [...this.list]){
            if(!m.alive) continue;
            m.cooldown = Math.max(0, m.cooldown - dt);
            m.wait -= dt;
            // zombies burn in daylight on the surface
            if(m.def.dark && T.biome[cellIndex(m.x, m.y)] !== 'cave' && Clock.light() > 0.5){
                m.hp -= HOSTILE.sunBurn * dt;
                if(m.hp <= 0){ this.kill(m, false); continue; }
            }
            if(m.next){
                const w = zone.toWorld(m.next.x, m.next.y);
                const speed = m.def.speed * HEX_W * (m.running ? 1.4 : 1) * (m.def.behaviour === 'hostile' && now < m.aggroUntil ? 1.2 : 1);
                const dx = w.x - m.px, dy = w.y - m.py, dist = Math.hypot(dx, dy), stepLen = speed * dt;
                if(dist <= stepLen){
                    this.occ.delete(cellIndex(m.x, m.y));
                    m.px = w.x; m.py = w.y; m.x = m.next.x; m.y = m.next.y; m.next = null;
                    this.occ.set(cellIndex(m.x, m.y), m);
                } else { m.px += dx / dist * stepLen; m.py += dy / dist * stepLen; }
                continue;
            }
            // a block placed on it / ground changed: push it out or remove it
            if(!this.passable(m, m.x, m.y)){
                m.breaking = null;
                const out = zone.neighbors(m.x, m.y).find(n => this.canEnter(m, n.x, n.y));
                if(out) this.commit(m, out.x, out.y); else this.remove(m);
                continue;
            }
            if(m.breaking && this.breakTick(m, dt)) continue;
            this.think(m);
        }
        this.spawnTimer -= dt;
        if(this.spawnTimer <= 0){ this.spawnTimer = HOSTILE.spawnEvery; this.spawnHostiles(); }
        this.repopTimer -= dt;
        if(this.repopTimer <= 0){ this.repopTimer = 15; this.repopulate(false); }
        const t = performance.now();
        this.fx = this.fx.filter(f => t - f.t0 < f.dur);
    },

    /* ----- spawning ----- */
    randomCell(test, tries = 60){
        const N = MAP_COLS * MAP_ROWS;
        for(let k = 0; k < tries; k++){ const i = Math.floor(Math.random() * N); if(test(i)) return cellXY(i); }
        return null;
    },
    count(pred){ return this.list.filter(pred).length; },
    nearLitForge(c, r = 3){
        for(const i of Theaya.forges){ const b = Theaya.blocks[i]; if(b && b.lit && hexDist(cellXY(i), c) <= r) return true; }
        return false;
    },
    /** Is a cell kept safe by light? (a torch within its `safe` cells, or a lit forge within 3) */
    lightSafe(c){
        if(this.nearLitForge(c)) return true;
        for(const i of Theaya.lights){
            const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
            if(def && def.safe && hexDist(cellXY(i), c) <= def.safe) return true;
        }
        return false;
    },
    spawnHostiles(){
        const pc = playerCell();
        if(!pc) return;
        const T = Theaya, inCave = i => T.biome[i] === 'cave';
        const ok = (i, cave) => {
            const c = cellXY(i), d = hexDist(c, pc);
            if(inCave(i) !== cave || d < HOSTILE.minDist || d > HOSTILE.maxDist) return false;
            if(!isPassable(c.x, c.y, 'zombie') || this.occ.has(i) || this.lightSafe(c)) return false;
            return true;
        };
        const dark = Clock.light() < HOSTILE.darkLight;
        const surface = this.count(m => m.def.dark && !inCave(cellIndex(m.x, m.y)));
        const cave = this.count(m => m.def.dark && inCave(cellIndex(m.x, m.y)));
        if(dark && surface < HOSTILE.maxNight){ const c = this.randomCell(i => ok(i, false)); if(c) this.spawn('zombie', c.x, c.y); }
        if(cave < HOSTILE.maxCave){ const c = this.randomCell(i => ok(i, true), 120); if(c) this.spawn('zombie', c.x, c.y); }
        // orcs: a very rare daytime spawn on the surface
        if(Clock.light() >= 0.5 && this.count(m => m.type === 'orc') < HOSTILE.maxOrcs && Math.random() < HOSTILE.orcChance){
            const c = this.randomCell(i => ok(i, false));
            if(c){ this.spawn('orc', c.x, c.y); notify('You hear heavy footsteps... an orc is roaming nearby.', '#ffb070'); }
        }
    },
    /** Tops up every animal type to its `count` (all at once at load, one at a time later). */
    repopulate(all = true){
        const pc = playerCell() || Theaya.spawn;
        for(const [type, def] of Object.entries(CREATURES)){
            if(!def.count) continue;
            let have = this.count(m => m.type === type);
            while(have < def.count){
                const c = this.randomCell(i => {
                    const xy = cellXY(i);
                    if(!def.biomes.includes(Theaya.biome[i]) || hexDist(xy, pc) < (all ? 6 : 10) || this.occ.has(i)) return false;
                    return def.mover === 'bird' || isPassable(xy.x, xy.y, def.mover);
                }, 200);
                if(!c) break;
                this.spawn(type, c.x, c.y);
                have++;
                if(!all) break;
            }
        }
    },
};


/* ----- Combat -----
 * Left click (or the wheel's Attack) on a creature: if it's in range, attack;
 * otherwise walk to the closest cell that is in range, then attack. Swords,
 * axes and fists reach 1 cell (stand next to it, like mining). Bows and
 * crossbows reach `launcher.range` cells with a clear line (trees, stone and
 * walls block arrows) and use the best arrow in the inventory.
 */
/** What the held item does in a fight: { kind:'melee'|'ranged', range, cooldown, damage?, power?, item } */
function weaponInfo(item){
    const L = item && typeof item.get === 'function' ? item.get('launcher') : null;
    if(L && !item.isBroken) return { kind:'ranged', range: L.range, cooldown: L.cooldown, power: L.power, item, name: prettify(item.id) };
    const a = item && typeof item.get === 'function' ? item.get('attack') : null;
    if(a && !item.isBroken && item.hasTag('weapon')){
        return { kind:'melee', range:1, cooldown: item.hasTag('sword') ? 0.6 : 0.9, damage: a.damage, item, name: prettify(item.id) };
    }
    return { kind:'melee', range:1, cooldown:0.7, damage:2, item:null, name:'fists' };
}
/** The strongest arrow in the inventory, or null. */
function bestArrow(){
    const inv = player.inventory;
    let best = null;
    for(let i = 1; i <= inv.slots; i++){
        const it = inv[i], s = it && it.hasTag && it.hasTag('arrow') ? it.get('ammoStats') : null;
        if(s && (!best || s.damage > best.get('ammoStats').damage)) best = it;
    }
    return best;
}
/** Is the straight line from cell a to cell b free of blocks for which stops(def) is true? (ends excluded) */
function lineClear(a, b, stops){
    const zone = Theaya.zone, wa = zone.toWorld(a.x, a.y), wb = zone.toWorld(b.x, b.y);
    const steps = Math.max(1, hexDist(a, b) * 4);
    for(let k = 1; k < steps; k++){
        const c = zone.toCell(wa.x + (wb.x - wa.x) * k / steps, wa.y + (wb.y - wa.y) * k / steps);
        if(!c || (c.x === a.x && c.y === a.y) || (c.x === b.x && c.y === b.y)) continue;
        const def = blockDefAt(c.x, c.y);
        if(def && stops(def)) return false;
    }
    return true;
}
/** What stops an arrow: solid blocks other than plants / farmland. */
const blocksArrows = def => def.solid && !['plant', 'farmland', 'fern'].includes(def.kind);
/** What a creature can't see through: walls, doors and rock. */
const blocksSight  = def => ['wall', 'door', 'stone', 'ore', 'ore_heart'].includes(def.kind);
/** Can an arrow fly from cell a to cell b? */
function hasLineOfSight(a, b){ return lineClear(a, b, blocksArrows); }
function inAttackRange(from, m, w){
    const d = hexDist(from, m);
    if(w.kind === 'melee') return d <= 1;
    return d <= w.range && hasLineOfSight(from, m);
}
/** The reachable cell closest to the player (by walking) from which the weapon reaches m. */
function attackCellFor(m, w){
    const pc = playerCell();
    if(!pc) return null;
    const start = cellIndex(pc.x, pc.y), seen = new Set([start]), queue = [start];
    while(queue.length && seen.size < 1500){
        const i = queue.shift(), c = cellXY(i);
        if(!(c.x === m.x && c.y === m.y) && inAttackRange(c, m, w) && (i === start || !Mobs.occ.has(i))) return c;
        for(const n of Theaya.zone.neighbors(c.x, c.y)){
            const j = cellIndex(n.x, n.y);
            if(seen.has(j) || !isPassable(n.x, n.y)) continue;
            seen.add(j); queue.push(j);
        }
    }
    return null;
}
function startAttack(m){
    if(!m || !m.alive) return;
    Act.job = null;
    GameUI.wheel = null;
    Act.combat = { mob: m, plan: 0, key: '' };
}
/** One hit / shot. False when it couldn't (no arrows). */
function attackMob(m, w){
    const pp = player.transform.position;
    let dmg;
    if(w.kind === 'ranged'){
        const arrow = bestArrow();
        if(!arrow){ notify(`No arrows for the ${w.name}!`, '#ff8a7a'); return false; }
        dmg = arrow.get('ammoStats').damage * w.power;
        arrow.removeCount(1);
        player.inventory._changed({ event:'shoot' });
        Mobs.fx.push({ kind:'arrow', x0: pp.x, y0: pp.y, x1: m.px, y1: m.py, t0: performance.now(), dur: 160, color: Items.look(arrow).color });
    } else {
        dmg = w.damage;
        Mobs.fx.push({ kind:'swing', x: m.px, y: m.py, t0: performance.now(), dur: 200, color:'#ffffff' });
    }
    if(w.item){
        w.item.wear(1);
        if(w.item.isBroken){ player.inventory.removeRef(w.item); notify(`Your ${prettify(w.item.id)} broke!`, '#ff8a7a'); }
    }
    Mobs.hurt(m, dmg);
    return true;
}
function tickCombat(dt){
    Act.attackCd = Math.max(0, (Act.attackCd || 0) - dt);
    const c = Act.combat;
    if(!c) return;
    const m = c.mob, pc = playerCell(), zone = areaZones.home;
    if(!m.alive){ Act.combat = null; return; }
    if(!pc) return;
    const w = weaponInfo(heldItem());
    if(inAttackRange(pc, m, w)){
        if(zone.isMoving(player)) zone.stopMove(player);
        if(Act.attackCd <= 0){
            if(!attackMob(m, w)){ Act.combat = null; return; }
            Act.attackCd = w.cooldown;
        }
        return;
    }
    // out of range: (re)plan a walk to the best spot every 0.4 s or when the target moved
    c.plan -= dt;
    const key = `${m.x},${m.y},${w.kind}`;
    if(c.plan > 0 && c.key === key && zone.isMoving(player)) return;
    c.plan = 0.4; c.key = key;
    const spot = attackCellFor(m, w);
    if(!spot){ notify(`Can't reach the ${m.def.name.toLowerCase()}.`, '#ffb070'); Act.combat = null; return; }
    if(spot.x === pc.x && spot.y === pc.y) return;
    zone.moveTo(player, spot.x, spot.y, pathOpts());
}
/** Quick action for a creature under the cursor (any held item; weapons hit harder). */
function attackActionFor(m){
    const w = weaponInfo(heldItem());
    const label = `Attack ${m.def.name} (${w.name}${w.kind === 'ranged' ? `, range ${w.range}` : ''})`;
    if(w.kind === 'ranged' && !bestArrow()) return { label, reason:'No arrows', mob: m };
    return { label, run: () => startAttack(m), mob: m };
}


/* ----- Drawing creatures (world space, under the tree canopies) ----- */
function drawMob(m){
    const d = m.def, s = d.size * 1.3, t = performance.now() / 1000;
    const fx = Math.cos(m.facing), fy = Math.sin(m.facing), px = -fy, py = fx;   // forward / sideways
    const lift = d.mover === 'bird' ? 10 + 2 * Math.sin(t * 6 + m.bob) : 0;
    const x = m.px, y = m.py - lift;
    noStroke(); fill(0, 0, 0, d.mover === 'bird' ? 30 : 55); ellipse(m.px + 2, m.py + s * 0.45, s * 1.6, s * 0.6);
    const col = d.color, dark = shade(col, -0.35);
    stroke(dark); strokeWeight(1.2);
    const head = (k, r, c = col) => { fill(c); circle(x + fx * s * k, y + fy * s * k, r); };
    switch(m.type){
        case 'zombie': {
            stroke('#2f3f26'); strokeWeight(3);
            for(const side of [-1, 1]) line(x + px * s * 0.45 * side, y + py * s * 0.45 * side, x + px * s * 0.4 * side + fx * s * 0.95, y + py * s * 0.4 * side + fy * s * 0.95);
            strokeWeight(1.2); fill('#4a5f3a'); circle(x, y, s * 1.15);
            head(0.25, s * 0.75, '#8aa874');
            noStroke(); fill('#ff4030');
            for(const side of [-1, 1]) circle(x + fx * s * 0.45 + px * s * 0.13 * side, y + fy * s * 0.45 + py * s * 0.13 * side, 2.4);
            break;
        }
        case 'orc': {
            // a club in the right hand, broad shoulders, tusks
            const hx = x - px * s * 0.62 + fx * s * 0.35, hy = y - py * s * 0.62 + fy * s * 0.35;
            stroke('#4a3220'); strokeWeight(4); line(hx, hy, hx + fx * s * 0.9 - px * s * 0.2, hy + fy * s * 0.9 - py * s * 0.2);
            noStroke(); fill('#5a3d26'); circle(hx + fx * s * 0.95 - px * s * 0.22, hy + fy * s * 0.95 - py * s * 0.22, s * 0.38);
            stroke('#2e3f20'); strokeWeight(1.4); fill('#6b5a3a'); ellipse(x, y, s * 1.55, s * 1.25);   // leather
            fill(col); for(const side of [-1, 1]) circle(x + px * s * 0.62 * side, y + py * s * 0.62 * side, s * 0.48);   // shoulders
            head(0.3, s * 0.72, '#6f8f4a');
            noStroke(); fill('#f2ead2');
            for(const side of [-1, 1]) triangle(x + fx * s * 0.6 + px * s * 0.14 * side, y + fy * s * 0.6 + py * s * 0.14 * side,
                                                x + fx * s * 0.6 + px * s * 0.24 * side, y + fy * s * 0.6 + py * s * 0.24 * side,
                                                x + fx * s * 0.82 + px * s * 0.2 * side, y + fy * s * 0.82 + py * s * 0.2 * side);
            fill('#ffcf3a'); for(const side of [-1, 1]) circle(x + fx * s * 0.42 + px * s * 0.13 * side, y + fy * s * 0.42 + py * s * 0.13 * side, 2.6);
            break;
        }
        case 'bear':
            fill(col); ellipse(x, y, s * 1.5, s * 1.25);
            head(0.65, s * 0.8);
            fill(dark); for(const side of [-1, 1]) circle(x + fx * s * 0.85 + px * s * 0.28 * side, y + fy * s * 0.85 + py * s * 0.28 * side, s * 0.25);
            break;
        case 'deer':
            fill(col); ellipse(x, y, s * 1.5, s * 0.95);
            head(0.75, s * 0.55);
            stroke('#6b4a2a'); strokeWeight(1.5);
            for(const side of [-1, 1]){
                const hx = x + fx * s * 0.85, hy = y + fy * s * 0.85;
                line(hx, hy, hx + px * s * 0.45 * side + fx * s * 0.2, hy + py * s * 0.45 * side + fy * s * 0.2);
            }
            noStroke(); fill('#f3ead8'); circle(x - fx * s * 0.7, y - fy * s * 0.7, s * 0.3);
            break;
        case 'rabbit':
            fill(col); ellipse(x, y, s * 1.4, s * 1.1);
            head(0.6, s * 0.75);
            noStroke(); fill(shade(col, -0.15));
            for(const side of [-1, 1]) ellipse(x + fx * s * 0.6 + px * s * 0.25 * side - fx * s * 0.45, y + fy * s * 0.6 + py * s * 0.25 * side - fy * s * 0.45, s * 0.35, s * 0.35);
            fill(255); circle(x - fx * s * 0.7, y - fy * s * 0.7, s * 0.4);
            break;
        case 'cow':
            fill(col); ellipse(x, y, s * 1.6, s * 1.05);
            noStroke(); fill('#2b2b2b'); circle(x - fx * s * 0.2 + px * s * 0.2, y - fy * s * 0.2 + py * s * 0.2, s * 0.4); circle(x + fx * s * 0.25 - px * s * 0.25, y + fy * s * 0.25 - py * s * 0.25, s * 0.3);
            stroke(dark); head(0.8, s * 0.55, '#e8d8cc');
            noStroke(); fill('#e5a4a0'); circle(x + fx * s * 1.0, y + fy * s * 1.0, s * 0.3);
            break;
        case 'pig':
            fill(col); ellipse(x, y, s * 1.5, s * 1.1);
            head(0.65, s * 0.7);
            noStroke(); fill('#d9828a'); circle(x + fx * s * 0.95, y + fy * s * 0.95, s * 0.32);
            break;
        case 'chicken':
            fill(col); ellipse(x, y, s * 1.3, s * 1.1);
            head(0.55, s * 0.7);
            noStroke(); fill('#e03a2a'); circle(x + fx * s * 0.45, y + fy * s * 0.45 - 2, s * 0.25);
            fill('#f0b030'); circle(x + fx * s * 0.95, y + fy * s * 0.95, s * 0.25);
            break;
        case 'bird': {
            const BIRD_FLAP = 7;   // wing beat speed (radians / s): ~1 beat per second
            const flap = Math.sin(t * BIRD_FLAP + m.bob) * 0.6 + 0.6;
            fill(dark); noStroke();
            // wings: rooted on the middle of the body (a little in front of and behind its center), tips straight out to the sides
            for(const side of [-1, 1]){
                const tipX = x + px * s * (1 + flap) * side, tipY = y + py * s * (1 + flap) * side;
                triangle(x + fx * s * 0.25, y + fy * s * 0.25, tipX, tipY, x - fx * s * 0.25, y - fy * s * 0.25);
            }
            fill(col); ellipse(x, y, s * 1.1, s * 1.1);
            head(0.5, s * 0.6);
            fill('#f0b030'); circle(x + fx * s * 0.85, y + fy * s * 0.85, 2.5);
            break;
        }
        default:
            fill(col); circle(x, y, s);
    }
    const since = performance.now() - m.hitAt;
    if(since < 160){ noStroke(); fill(255, 40, 40, 140 * (1 - since / 160)); circle(x, y, s * 1.6); }
    if(m.hp < m.def.hp){
        const w = Math.max(18, s * 1.6), bx = x - w / 2, by = y - s - 10;
        noStroke(); fill(0, 0, 0, 150); rect(bx, by, w, 4, 2);
        fill(m.def.behaviour === 'hostile' ? '#ff6a5a' : '#7ddc6a'); rect(bx, by, w * Math.max(0, m.hp / m.def.hp), 4, 2);
    }
}
function drawCombatFx(){
    const now = performance.now();
    for(const f of Mobs.fx){
        const k = (now - f.t0) / f.dur;
        if(f.kind === 'arrow'){
            const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k, a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
            stroke('#6b4a2a'); strokeWeight(2); line(x - Math.cos(a) * 12, y - Math.sin(a) * 12, x, y);
            stroke(f.color); strokeWeight(3); point(x, y);
        } else if(f.kind === 'swing'){
            noFill(); stroke(255, 255, 255, 220 * (1 - k)); strokeWeight(3);
            arc(f.x, f.y, 34 + 10 * k, 34 + 10 * k, -Math.PI * 0.9 + k * 1.2, -Math.PI * 0.2 + k * 1.2);
        } else if(f.kind === 'number'){
            noStroke(); fill(255, 230, 120, 255 * (1 - k)); textSize(13); textStyle(BOLD); textAlign(CENTER, CENTER);
            text(`-${f.text}`, f.x, f.y - 18 * k); textStyle(NORMAL);
        } else if(f.kind === 'poof'){
            noStroke(); const c = color(f.color); c.setAlpha(160 * (1 - k)); fill(c);
            for(let j = 0; j < 6; j++){ const a = j * Math.PI / 3; circle(f.x + Math.cos(a) * 16 * k, f.y + Math.sin(a) * 16 * k, 8 * (1 - k) + 2); }
        }
    }
}
const mobLayer = {
    id: 'theaya_mobs', scenes: [SCENE_ID], layer: 6, deleted: false, tags: [],
    render(){
        if(!Theaya.ready) return;
        push();
        resetDrawModes();
        const cam = World.camera.getBounds(40);
        for(const m of Mobs.list){
            if(m.px < cam.left || m.px > cam.right || m.py < cam.top || m.py > cam.bottom) continue;
            drawMob(m);
        }
        // the creature you're fighting
        const c = Act.combat;
        if(c && c.mob.alive){ noFill(); stroke(255, 90, 74, 200); strokeWeight(2); circle(c.mob.px, c.mob.py, c.mob.def.size * 2.2); }
        drawCombatFx();
        pop();
    },
};
theayaScene.addObject(mobLayer);
Mobs.repopulate(true);


/* ---------------------------------------------------------------------
 * 11. Input + GameUI state
 * --------------------------------------------------------------------- */
const GameUI = {
    hotbar: 1,            // selected hotbar position (1..7)
    inventoryOpen: false,
    station: null,        // { x, y, kind, openedInventory }
    wheel: null,          // { x, y, options, from }
    picked: null,         // click-to-swap: first slot clicked ({ box, i })
    press: null,          // { ref, x, y, dragging, shift }
    regions: [],          // clickable screen areas, rebuilt every frame by the HUD
    scroll: { hand: 0, station: 0 },
    toasts: [],
    paused: false,        // pause menu open (P): the world stops
    pauseView: 'main',    // 'main' | 'controls' | 'restart'
    showHelp: true,       // the controls list on the right side of the HUD
    calendar: null,       // { year, month } the calendar under the clock shows (month -1 = new year day), null = folded up
};

/** Edge detection over getInput (pressed this tick / released this tick). */
const Keys = {
    watch: ['key@tab', 'key@e', 'key@f', 'key@p', 'key@escape', 'key@shift', 'mouse@left', 'mouse@right',
            'key@1', 'key@2', 'key@3', 'key@4', 'key@5', 'key@6', 'key@7'],
    now: {}, prev: {},
    update(){ this.prev = this.now; this.now = {}; for(const k of this.watch) this.now[k] = !!getInput(k); },
    down(k){ return !!this.now[k]; },
    pressed(k){ return !!this.now[k] && !this.prev[k]; },
    released(k){ return !this.now[k] && !!this.prev[k]; },
};
const _wheelInput = { steps: 0 };
window.addEventListener('wheel', e => { if(e.deltaY) _wheelInput.steps += Math.sign(e.deltaY); }, { passive: true });
window.addEventListener('keydown', e => { if(e.key === 'Tab') e.preventDefault(); });   // keep Tab for the inventory

function notify(text, color = '#ffffff'){
    GameUI.toasts.push({ text, color, until: performance.now() + 3000 });
    if(GameUI.toasts.length > 5) GameUI.toasts.shift();
}

function uiHitAll(mx, my){
    const out = [];
    for(let k = GameUI.regions.length - 1; k >= 0; k--){
        const r = GameUI.regions[k];
        if(mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) out.push(r);
    }
    return out;
}
const uiHit = (mx, my) => uiHitAll(mx, my)[0] ?? null;

function openWheelAt(wx, wy){
    const c = areaZones.home.toCell(wx, wy);
    if(!c) return;
    const pc = playerCell();
    GameUI.wheel = { x: c.x, y: c.y, options: buildActions(c.x, c.y), from: pc ? `${pc.x},${pc.y}` : '' };
}
/** Rebuild the wheel's options when the player moved to another cell. */
function refreshWheel(){
    const pc = playerCell(), key = pc ? `${pc.x},${pc.y}` : '';
    if(key !== GameUI.wheel.from){ GameUI.wheel.options = buildActions(GameUI.wheel.x, GameUI.wheel.y); GameUI.wheel.from = key; }
}
function chooseOption(opt){
    if(!opt.enabled){ notify(opt.reason || 'Not possible.', '#ff8a7a'); return; }
    GameUI.wheel = null;
    Act.combat = null;
    opt.run();
}
/**
 * Left-click quick action while holding a tool (pickaxe / axe / shovel / hoe):
 * walk next to the cell and use the tool on it, no wheel.
 *   - hoe on a crop / fern: harvest it (or clear it when rotten)
 *   - hoe on bare grass: till it
 *   - a tool on a block of its class: mine / chop / dig it (pickaxe -> stone / ore,
 *     axe -> trees / wood, shovel -> soil). Plants and farmland are left to the wheel (right click).
 * Returns { label, run } (doable), { label, reason } (not possible right now)
 * or null (nothing for this tool here, so left click just moves there: moveToward).
 */
function quickActionFor(x, y, wx = null, wy = null){
    if(wx != null){ const mob = Mobs.nearPoint(wx, wy) || Mobs.at(x, y); if(mob) return attackActionFor(mob); }
    else if(Theaya.zone.inBounds(x, y) && Mobs.at(x, y)) return attackActionFor(Mobs.at(x, y));
    const held = heldItem(), m = held && typeof held.get === 'function' ? held.get('mining') : null;
    if(!m || held.isBroken || !Theaya.zone.inBounds(x, y)) return null;
    const pc = playerCell();
    if(!pc) return null;
    const cell = { x, y }, b = blockAt(x, y), def = b && Blocks.get(b.id);
    const near = fn => () => (hexDist(pc, cell) === 0 && !blocksMover(def, 'player')) ? fn() : doNear(cell, fn);
    if(isHoe(held)){
        const info = plantInfo(b);
        if(info){
            const name = prettify(info.crop.id);
            if(info.rot) return { label:`Clear rotten ${name}`, run: near(() => harvestPlant(x, y)) };
            if(info.stage && info.stage.yield[1] > 0){
                const tier = canHarvestTier(info.crop, held);
                return tier.ok ? { label:`Harvest ${name}`, run: near(() => harvestPlant(x, y)) } : { label:`Harvest ${name}`, reason: tier.reason };
            }
        }
        if(def && def.kind === 'fern') return { label:'Gather plant fibers', run: near(() => harvestFern(x, y)) };
        if(!def || def.replaceable){
            const g = groundAt(x, y);
            if(g && g.passable){
                const can = canTill(x, y);
                return can.ok ? { label:'Till soil', run: near(() => startTill(x, y)) } : { label:'Till soil', reason: can.reason };
            }
        }
    }
    // Shovel on bare grass: dig up dirt (endless, the grass stays)
    if(isShovel(held) && !def && Theaya.ground[cellIndex(x, y)] === FLOOR){
        return { label:`Dig dirt (${digGrassTime(held).toFixed(1)}s)`, run: near(() => startDigGrass(x, y)) };
    }
    // Mining: only with the block's own tool class (an axe on trees, a pickaxe on stone...),
    // and never plants / farmland (crops would get dug up by accident; use the wheel for that).
    if(def && !def.replaceable && def.kind !== 'plant' && def.kind !== 'farmland' && def.tool && m.classes.includes(def.tool)){
        const label = `${verbFor(def)} ${def.name}`, info = miningInfo(def, held);
        if(!info.ok) return { label, reason: info.reason };
        if(!info.fits) return null;
        if(containerBusy(b)) return { label, reason:`Empty the ${def.name} first` };
        return { label: `${label} (${info.time.toFixed(1)}s)`, run: near(() => startMine(x, y)) };
    }
    return null;
}
function cancelAll(){
    Act.combat = null;
    GameUI.wheel = null;
    Act.job = null;
    areaZones.home.stopMove(player);
}

/** The block of the open forge / chest, or null. */
function openContainer(){
    const s = GameUI.station;
    if(!s || CRAFT_STATIONS.includes(s.kind)) return null;
    return blockAt(s.x, s.y);
}
/** Crafting stations: a recipe menu, no item slots. */
const CRAFT_STATIONS = ['workbench', 'loom'];   // the cooking pot has slots like the forge
const STATION_TITLES = { workbench:'Workbench', loom:'Loom', pot:'Cooking Pot', forge:'Forge', chest:'Chest' };
/** Put on the armor at ref (swaps with what was worn). */
function equipArmor(ref){
    const item = refItem(ref), slot = armorSlotOf(item);
    if(!slot) return false;
    moveOrSwapRef(ref, slotRef(player.gear[slot], 0));
    notify(`Wearing ${prettify(item.id)} (defense ${playerDefense()})`, '#a6f0a0');
    return true;
}
function unequipArmor(ref){
    const item = refItem(ref);
    if(!item) return false;
    if(player.inventory.give(item) !== 0){ notify('No room in your backpack.', '#ffb070'); return false; }
    ref.box.setSlot(ref.i, null);
    return true;
}
/**
 * Shift-click. With a forge / chest open: move the stack between it and the
 * backpack (fuel goes to the forge's fuel slot, ore / wood to its input).
 * Otherwise: armor <-> worn, or hotbar <-> backpack.
 */
function quickMoveRef(ref){
    const inv = player.inventory, item = refItem(ref), c = openContainer();
    if(!item) return;
    if(!c){
        if(ref.box === inv && armorSlotOf(item)) equipArmor(ref);                 // backpack -> worn
        else if(ARMOR_SLOTS.some(s => player.gear[s] === ref.box)) unequipArmor(ref); // worn -> backpack
        else if(ref.box === inv) inv.quickMove(ref.i);
        return;
    }
    if(ref.box !== inv && ARMOR_SLOTS.some(s => player.gear[s] === ref.box)){ unequipArmor(ref); return; }
    if(ref.box !== inv){                                    // container -> inventory
        if(inv.give(item) === 0) ref.box.setSlot(ref.i, null);
        ref.box.changed();
        if(item.count > 0 && refItem(ref)) notify('Not enough room in your inventory.', '#ffb070');
        return;
    }
    let targets;
    if(c.box) targets = [c.box];
    else {
        const fuelOk = c.fuel.accepts(item) && (!c.fuel.getSlot(0) || c.fuel.getSlot(0).canStackWith(item));
        targets = [fuelOk ? c.fuel : null, c.input.accepts(item) ? c.input : null].filter(Boolean);
    }
    if(!targets.length){ notify(`That can't go in the ${STATION_TITLES[GameUI.station.kind].toLowerCase()}.`, '#ffb070'); return; }
    for(const box of targets){
        if(box.give(item) === 0){ inv.setSlot(ref.i, null); break; }
    }
    inv._changed({ event:'quickMove' });
    if(refItem(ref)) notify('No room for all of it.', '#ffb070');
}
function slotClick(ref, shift){
    const inv = player.inventory;
    if(!GameUI.inventoryOpen && ref.box === inv){
        if(inv.isHotbarSlot(ref.i)) GameUI.hotbar = ref.i - inv.hotbarStart + 1;
        return;
    }
    if(shift){ quickMoveRef(ref); GameUI.picked = null; return; }
    if(GameUI.picked == null){ if(refItem(ref)) GameUI.picked = ref; return; }
    if(sameRef(GameUI.picked, ref)){ GameUI.picked = null; return; }
    moveOrSwapRef(GameUI.picked, ref);
    GameUI.picked = null;
}

/**
 * Pause (P): the world stops (creatures, weather, the clock, crops, forges,
 * survival stats) and the pause menu opens. The scene is paused too, so the
 * player stops walking and scene timers (saplings, water refills) wait.
 */
function setPaused(on = true){
    on = !!on;
    if(on === GameUI.paused) return;
    GameUI.paused = on;
    GameUI.pauseView = 'main';
    theayaScene.pause = on;
    if(on){ GameUI.wheel = null; GameUI.press = null; }
}
const togglePause = () => setPaused(!GameUI.paused);

/** Input while paused: only the menu (P / Esc / clicks on its buttons). */
function handlePausedInput(hit){
    if(Keys.pressed('key@escape')){
        if(GameUI.pauseView !== 'main') GameUI.pauseView = 'main';
        else setPaused(false);
        return;
    }
    if(Keys.pressed('mouse@left') && hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
}

function handleInput(){
    Keys.update();
    const consoleBlocks = typeof DevConsole !== 'undefined' && DevConsole.blocksInput && DevConsole.blocksInput('mouse');
    const mx = mouse.rawX, my = mouse.rawY;
    const hits = uiHitAll(mx, my), hit = hits[0] ?? null;

    if(Keys.pressed('key@p')){ togglePause(); return; }
    if(GameUI.paused){ handlePausedInput(hit); return; }

    if(Keys.pressed('key@tab')){
        GameUI.inventoryOpen = !GameUI.inventoryOpen; GameUI.picked = null; GameUI.wheel = null;
        if(!GameUI.inventoryOpen && openContainer()) closeStation();
    }
    // Calendar: clicking anywhere off the clock / calendar folds it back up (that click does nothing else)
    let clickTaken = false;
    if(GameUI.calendar && (Keys.pressed('mouse@left') || Keys.pressed('mouse@right')) && !hits.some(r => r.kind === 'clock' || r.kind === 'calendar')){
        GameUI.calendar = null;
        clickTaken = true;
    }
    if(Keys.pressed('key@escape')){
        if(GameUI.calendar) GameUI.calendar = null;
        else if(GameUI.wheel) GameUI.wheel = null;
        else if(GameUI.station) closeStation();
        else if(GameUI.inventoryOpen){ GameUI.inventoryOpen = false; GameUI.picked = null; }
        else cancelAll();
    }
    if(Keys.pressed('key@e')) tryInteract();
    if(Keys.pressed('key@f')) useHeld();
    for(let i = 1; i <= 7; i++) if(Keys.pressed('key@' + i)) GameUI.hotbar = i;

    // Mouse wheel: scroll a list under the mouse, otherwise change hotbar slot
    const steps = consoleBlocks ? 0 : _wheelInput.steps;
    _wheelInput.steps = 0;
    if(steps){
        const list = hits.find(r => r.scroll);
        if(list) GameUI.scroll[list.scroll] = Math.max(0, GameUI.scroll[list.scroll] + steps);
        else if(!GameUI.wheel) GameUI.hotbar = (((GameUI.hotbar - 1 + steps) % 7) + 7) % 7 + 1;
    }

    if(Keys.pressed('mouse@left') && !clickTaken){
        if(GameUI.wheel){
            if(hit && hit.kind === 'wheelOption') chooseOption(hit.option);
            else GameUI.wheel = null;
        } else if(hit){
            if(hit.kind === 'clock') toggleCalendar();
            else if(hit.kind === 'slot') GameUI.press = { ref: hit.ref, x: mx, y: my, dragging: false, shift: Keys.down('key@shift') };
            else if(hit.kind === 'button' && hit.enabled !== false) hit.onClick(Keys.down('key@shift'));
        } else if(!consoleBlocks){
            // Left click: holding a fitting tool -> walk over and use it; otherwise just move there
            const c = areaZones.home.toCell(mouse.x, mouse.y);
            const q = c ? quickActionFor(c.x, c.y, mouse.x, mouse.y) : null;
            Act.combat = null;
            if(!q){ if(c) moveToward(c.x, c.y); }
            else if(q.reason) notify(q.reason, '#ff8a7a');
            else q.run();
        }
    }
    const pr = GameUI.press;
    if(pr && Keys.down('mouse@left') && !pr.dragging && refItem(pr.ref) && Math.hypot(mx - pr.x, my - pr.y) > 6) pr.dragging = true;
    if(pr && Keys.released('mouse@left')){
        GameUI.press = null;
        if(pr.dragging){
            const target = hits.find(r => r.kind === 'slot');
            if(target && !sameRef(target.ref, pr.ref)) moveOrSwapRef(pr.ref, target.ref);
            GameUI.picked = null;
        } else {
            slotClick(pr.ref, pr.shift);
        }
    }
    if(Keys.pressed('mouse@right') && !clickTaken){
        if(GameUI.wheel) GameUI.wheel = null;
        else if(hit && hit.kind === 'slot'){ if(GameUI.inventoryOpen) splitRef(hit.ref); }
        else if(!hit && !consoleBlocks) openWheelAt(mouse.x, mouse.y);   // right click: the full action wheel
    }
}

/** Every game tick (scene script). */
function gameTick(dt){
    if(!Theaya.ready) return;
    handleInput();
    if(GameUI.paused) return;   // the pause menu is open: nothing in the world moves
    Clock.advance(dt);
    Weather.tick(dt);
    tickSurvival(dt);
    tickJob(dt);
    tickWorld();
    tickPlants(dt);
    tickForges(dt);
    Regrowth.tick(dt);
    Mobs.tick(dt);
    tickCombat(dt);
    // doors are drawn open while the player stands in them
    const pc = playerCell(), here = pc ? cellIndex(pc.x, pc.y) : -1;
    if(here !== GameUI.lastCell){
        for(const i of [GameUI.lastCell, here]) if(i >= 0 && Theaya.blocks[i] && Blocks.get(Theaya.blocks[i].id).kind === 'door') Theaya.dirty.add(i);
        GameUI.lastCell = here;
    }
    if(GameUI.wheel) refreshWheel();
    if(GameUI.station) checkStation();
    regen.tick(dt);
}


/* ---------------------------------------------------------------------
 * 12. Rendering
 * --------------------------------------------------------------------- */
const _shadeCache = new Map();
/** Lighter (amt > 0) or darker (amt < 0) version of a color, as an rgba string. */
function shade(c, amt){
    const key = c + '|' + amt;
    let v = _shadeCache.get(key);
    if(!v){
        const base = color(c);
        v = (amt < 0 ? lerpColor(base, color(0), -amt) : lerpColor(base, color(255), amt)).toString();
        _shadeCache.set(key, v);
    }
    return v;
}
function polyShape(g, pts, k = 1, c = null){
    const cx = c ? c.x : pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = c ? c.y : pts.reduce((a, p) => a + p.y, 0) / pts.length;
    g.beginShape();
    for(const p of pts) g.vertex(cx + (p.x - cx) * k, cy + (p.y - cy) * k);
    g.endShape(CLOSE);
}
function hexPoints(cx, cy, r){
    const pts = [];
    for(let k = 0; k < 6; k++){ const a = Math.PI / 6 + k * Math.PI / 3; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return pts;
}
function groundColorAt(i){
    const gid = Theaya.ground[i], gt = groundTypes[gid];
    if(gt.water){
        const lvl = (Theaya.water[i] ?? WATER_UNITS) / WATER_UNITS;
        return lerpColor(color('#8b9f8a'), color(gt.color), lvl);
    }
    if(Theaya.dried.has(i)) return '#9c8a62';           // cracked, dried-up water bed
    const b = biomes[Theaya.biome[i]];
    const base = (b && b.floor === gid && b.floorColor) || gt.color;
    return Theaya.mud.has(i) ? lerpColor(color(base), color('#5e4630'), 0.55).toString() : base;
}
/** Puddles, snow and dried cracks drawn over a cell's floor. */
function drawGroundCover(g, i, c, poly, h){
    if(Theaya.dried.has(i)){
        g.stroke('#6f5f40'); g.strokeWeight(1.2);
        g.line(c.x - 12, c.y - 3, c.x - 2, c.y + 1); g.line(c.x - 2, c.y + 1, c.x + 4, c.y - 7); g.line(c.x - 2, c.y + 1, c.x + 8, c.y + 9);
    }
    const p = Theaya.puddles.get(i);
    if(p){
        g.noStroke(); g.fill(70, 130, 200, 150 + 40 * p);
        g.ellipse(c.x - 3 + h(20) * 6, c.y + 2, 14 + 8 * p, 8 + 4 * p);
        g.fill(255, 255, 255, 70); g.ellipse(c.x - 5 + h(20) * 6, c.y, 5, 2);
    }
    if(Theaya.snow.has(i)){
        g.noStroke(); g.fill(245, 248, 255, 215); polyShape(g, poly, 0.97, c);
        g.fill(215, 225, 240); for(let k = 0; k < 3; k++) g.circle(c.x - 10 + h(k + 30) * 20, c.y - 10 + h(k + 33) * 20, 4);
    }
}
/** The engine leaves p5 in rectMode(CENTER) etc.; the HUD and overlay draw from corners. */
function resetDrawModes(){
    rectMode(CORNER); ellipseMode(CENTER); imageMode(CORNER);
    strokeCap(ROUND); textStyle(NORMAL);
}

/** Redraws one cell (ground + block body) onto the terrain buffer. */
function drawCellOn(g, i){
    const { x, y } = cellXY(i), zone = Theaya.zone;
    const poly = zone.cellPolygon(x, y), c = zone.toWorld(x, y);
    const col = groundColorAt(i), gt = groundTypes[Theaya.ground[i]];
    g.noStroke();
    g.fill(col);
    polyShape(g, poly, 1.04, c);
    // ground detail
    const h = k => hash2(x * 7 + k, y * 13 + k, 99);
    if(gt.water){
        g.stroke(255, 255, 255, 50); g.strokeWeight(1.5); g.noFill();
        const wy = c.y - 4 + h(1) * 8;
        g.line(c.x - 9, wy, c.x - 2, wy - 2); g.line(c.x - 2, wy - 2, c.x + 6, wy);
    } else if(Theaya.ground[i] === FLOOR){
        g.stroke(shade(col, -0.18)); g.strokeWeight(1.5);
        for(let k = 0; k < 3; k++){ const px = c.x - 12 + h(k) * 24, py = c.y - 12 + h(k + 5) * 24; g.line(px, py, px - 1, py - 4); g.line(px, py, px + 2, py - 3); }
    } else {
        g.noStroke(); g.fill(shade(col, -0.12));
        for(let k = 0; k < 3; k++) g.circle(c.x - 12 + h(k) * 24, c.y - 12 + h(k + 5) * 24, 2.5);
    }
    drawGroundCover(g, i, c, poly, h);
    g.stroke(0, 0, 0, 28); g.strokeWeight(1); g.noFill();
    polyShape(g, poly, 1, c);

    const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
    if(def) drawBlockBody(g, def, b, c, poly, i);
}
/** A crop at its growth stage (sprout / growing / ripe / rotten), centered at c. */
function drawPlant(g, cropId, info, c, h){
    const L = cropLook(cropId);
    const k = info ? info.k : -1, n = info ? info.crop.stages.length : 1;
    const grow = Math.min(1, (k + 2) / Math.max(2, n));            // 0..1 size
    const rot = info && info.rot, ripe = info && info.ripe;
    const leaf = rot ? '#7a6a3a' : L.plant, fruit = rot ? '#5e4a2a' : L.produce;
    const s = 6 + 12 * grow;
    g.strokeWeight(1.2); g.stroke(shade(leaf, -0.35));
    switch(L.form){
        case 'bush':
            g.noStroke(); g.fill(0, 0, 0, 45); g.ellipse(c.x + 2, c.y + 7, 28 * grow + 6, 12);
            g.fill(shade(leaf, -0.15)); g.circle(c.x - s * 0.4, c.y + 2, s * 0.95); g.circle(c.x + s * 0.4, c.y + 2, s * 0.95);
            g.fill(leaf); g.circle(c.x, c.y - s * 0.22, s * 1.1);
            break;
        case 'grain':
        case 'tall':
            g.stroke(leaf); g.strokeWeight(2);
            for(let j = -2; j <= 2; j++){ const lx = c.x + j * 4; g.line(lx, c.y + 9, lx + j, c.y + 9 - s * (L.form === 'tall' ? 1.5 : 1.1)); }
            break;
        case 'stalk':
            g.stroke(leaf); g.strokeWeight(3);
            for(let j = -1; j <= 1; j++){ const lx = c.x + j * 6; g.line(lx, c.y + 9, lx, c.y + 9 - s * 1.4); }
            g.strokeWeight(1); g.stroke(shade(leaf, -0.3)); for(let j = -1; j <= 1; j++) g.line(c.x + j * 6 - 2, c.y + 2 - s * 0.4, c.x + j * 6 + 2, c.y + 2 - s * 0.4);
            break;
        case 'vine':
            g.fill(leaf);
            for(let j = 0; j < 4; j++) g.ellipse(c.x - 9 + h(j + 40) * 18, c.y - 6 + h(j + 44) * 12, s * 0.7, s * 0.45);
            break;
        case 'root':
            g.stroke(leaf); g.strokeWeight(2);
            g.line(c.x, c.y + 6, c.x - 5, c.y + 6 - s); g.line(c.x, c.y + 6, c.x, c.y + 4 - s * 1.1); g.line(c.x, c.y + 6, c.x + 5, c.y + 6 - s);
            break;
        default: // leafy
            g.fill(leaf); g.circle(c.x - s * 0.3, c.y + 2, s * 0.8); g.circle(c.x + s * 0.3, c.y + 2, s * 0.8); g.fill(shade(leaf, 0.15)); g.circle(c.x, c.y - 1, s * 0.75);
    }
    // what you'll harvest
    const yieldMax = info && info.stage ? info.stage.yield[1] : 0;
    if(yieldMax > 0 || rot){
        g.noStroke(); g.fill(fruit);
        if(L.big && ripe){ g.stroke(shade(fruit, -0.35)); g.ellipse(c.x + 3, c.y + 4, 18, 13); g.noStroke(); }
        else if(L.form === 'root' || L.shape === 'root'){ g.circle(c.x - 4, c.y + 7, 5); g.circle(c.x + 4, c.y + 7, 5); }
        else for(let j = 0; j < Math.min(5, yieldMax + 1); j++) g.circle(c.x - 8 + h(j + 50) * 16, c.y - 8 + h(j + 55) * 14, ripe ? 5.5 : 4);
    }
}
function drawBlockBody(g, def, b, c, poly, i = -1){
    const h = k => hash2(Math.round(c.x) + k, Math.round(c.y) + k * 3, 7);
    g.strokeWeight(1.5);
    switch(def.kind){
        case 'stone':
        case 'ore': {
            g.fill(def.color); g.stroke(shade(def.color, -0.35));
            polyShape(g, poly, 0.86, c);
            g.stroke(shade(def.color, -0.25)); g.strokeWeight(1);
            g.line(c.x - 8 + h(1) * 4, c.y - 6, c.x - 2, c.y + 1); g.line(c.x + 4, c.y + 3, c.x + 9, c.y + 8 - h(2) * 4);
            if(def.kind === 'ore'){
                g.noStroke();
                for(let k = 0; k < 6; k++){
                    g.fill(shade(def.accent, -0.25)); g.circle(c.x - 10 + h(k + 3) * 20, c.y - 10 + h(k + 9) * 20 + 1, 7);
                    g.fill(def.accent);               g.circle(c.x - 10 + h(k + 3) * 20, c.y - 10 + h(k + 9) * 20, 6);
                }
            }
            break;
        }
        case 'soil': {
            if(!def.solid){
                // loose sand you walk over: a flat, rippled layer
                g.noStroke(); g.fill(def.color); polyShape(g, poly, 0.98, c);
                g.stroke(shade(def.color, -0.14)); g.strokeWeight(1.2); g.noFill();
                for(let k = -1; k <= 1; k++){ const yy = c.y + k * 8 + h(k + 20) * 3; g.arc(c.x - 6 + h(k + 23) * 8, yy, 14, 5, Math.PI * 1.1, Math.PI * 1.9); }
                g.noStroke(); g.fill(shade(def.color, 0.2)); for(let k = 0; k < 4; k++) g.circle(c.x - 10 + h(k) * 20, c.y - 10 + h(k + 6) * 20, 2);
                break;
            }
            if(def.id === 'sand_dune'){
                // a tall wind-shaped ridge
                g.noStroke(); g.fill(shade(def.color, -0.12)); polyShape(g, poly, 1.0, c);
                g.fill(0, 0, 0, 38); g.ellipse(c.x + 4, c.y + 9, 38, 12);
                g.fill(def.color); g.stroke(shade(def.color, -0.32)); g.strokeWeight(1.2);
                g.arc(c.x, c.y + 9, 38, 36, Math.PI, 0, CHORD);                          // the mound
                g.noStroke(); g.fill(shade(def.color, 0.18));
                g.arc(c.x - 1, c.y + 9, 30, 30, Math.PI, Math.PI * 1.5, PIE);            // sunlit windward side
                g.noFill(); g.stroke(shade(def.color, -0.28)); g.strokeWeight(1.4);
                g.arc(c.x + 5, c.y - 1, 26, 18, Math.PI * 1.1, Math.PI * 1.75);          // the crest
                g.stroke(shade(def.color, -0.1)); g.strokeWeight(1);
                g.arc(c.x - 4, c.y + 6, 16, 6, Math.PI * 1.1, Math.PI * 1.9); g.arc(c.x + 6, c.y + 4, 12, 5, Math.PI * 1.1, Math.PI * 1.9);
                break;
            }
            // a mound of dirt / gravel / clay
            g.fill(shade(def.color, -0.12)); g.stroke(shade(def.color, -0.35));
            polyShape(g, poly, 0.9, c);
            g.noStroke(); g.fill(def.color); polyShape(g, poly, 0.66, { x: c.x, y: c.y - 3 });
            g.fill(shade(def.color, def.id === 'gravel' ? -0.3 : 0.2));
            for(let k = 0; k < 5; k++) g.circle(c.x - 9 + h(k) * 18, c.y - 10 + h(k + 6) * 16, def.id === 'gravel' ? 4 : 2.5);
            break;
        }
        case 'tree':
            g.noStroke(); g.fill(0, 0, 0, 50); g.ellipse(c.x + 3, c.y + 5, 26, 14);
            g.fill(def.color); g.stroke(shade(def.color, -0.35)); g.circle(c.x, c.y, 15);
            break;
        case 'sapling':
            g.stroke('#5b4026'); g.strokeWeight(2); g.line(c.x, c.y + 8, c.x, c.y - 4);
            g.noStroke(); g.fill(def.color); g.ellipse(c.x - 5, c.y - 4, 10, 6); g.ellipse(c.x + 5, c.y - 7, 10, 6);
            break;
        case 'plant':
            drawPlant(g, b.plant ? b.plant.crop : def.crop, plantInfo(b), c, h);
            break;
        case 'fern':
            g.stroke(shade(def.color, -0.25)); g.strokeWeight(2);
            for(let k = 0; k < 5; k++){
                const a = -Math.PI / 2 + (k - 2) * 0.55, len = 11 + h(k + 60) * 5;
                const ex = c.x + Math.cos(a) * len, ey = c.y + 6 + Math.sin(a) * len;
                g.line(c.x, c.y + 6, ex, ey);
                g.noStroke(); g.fill(def.color); g.ellipse((c.x + ex) / 2, (c.y + 6 + ey) / 2, 6, 9); g.stroke(shade(def.color, -0.25));
            }
            break;
        case 'farmland': {
            const wet = Math.min(1, (b.water || 0) / FARM.waterMax);
            const soil = lerpColor(color('#8a6a48'), color('#4a3220'), wet);
            g.fill(soil); g.stroke(shade(def.color, -0.4)); polyShape(g, poly, 0.88, c);
            g.stroke(lerpColor(soil, color(0), 0.3)); g.strokeWeight(2);
            for(let k = -1; k <= 1; k++) g.line(c.x - 13, c.y + k * 7, c.x + 13, c.y + k * 7);
            // water gauge
            g.noStroke(); g.fill(0, 0, 0, 90); g.rect(c.x - 12, c.y + 13, 24, 3, 1);
            g.fill('#4aa3ff'); g.rect(c.x - 12, c.y + 13, 24 * wet, 3, 1);
            if(b.water > FARM.waterMax){   // flooded: standing water + an overflow gauge
                const fl = Math.min(1, (b.water - FARM.waterMax) / (FARM.floodMax - FARM.waterMax));
                g.fill(70, 130, 200, 90 + 90 * fl); g.ellipse(c.x, c.y, 18 + 10 * fl, 10 + 6 * fl);
                g.fill(0, 0, 0, 90); g.rect(c.x - 12, c.y + 9, 24, 3, 1);
                g.fill('#a8ecff'); g.rect(c.x - 12, c.y + 9, 24 * fl, 3, 1);
            }
            if(b.plant) drawPlant(g, b.plant.crop, plantInfo(b), c, h);
            if(b.plant && b.water <= 0){ g.noStroke(); g.fill('#ffb347'); g.textSize(11); g.textAlign(CENTER, CENTER); g.text('!', c.x + 12, c.y - 12); }
            break;
        }
        case 'wall':
            g.fill(shade(def.color, -0.2)); g.stroke(shade(def.color, -0.45)); polyShape(g, poly, 0.96, c);
            g.fill(def.color); g.noStroke(); polyShape(g, poly, 0.72, { x: c.x, y: c.y - 4 });
            g.stroke(shade(def.color, -0.3)); g.strokeWeight(1);
            g.line(c.x - 12, c.y - 4, c.x + 12, c.y - 4); g.line(c.x - 3, c.y - 14, c.x - 3, c.y - 4); g.line(c.x + 5, c.y - 4, c.x + 5, c.y + 6);
            break;
        case 'door': {
            const pc = playerCell(), open = !!(pc && cellIndex(pc.x, pc.y) === i);
            g.fill(shade(def.color, -0.35)); g.stroke(shade(def.color, -0.5)); g.rect(c.x - 15, c.y - 16, 30, 30, 3);
            g.fill(open ? '#2a2018' : def.color); g.stroke(shade(def.color, -0.4)); g.rect(c.x - 11, c.y - 13, open ? 6 : 22, 25, 2);
            if(!open){ g.noStroke(); g.fill('#e0c060'); g.circle(c.x + 6, c.y, 4); }
            break;
        }
        case 'ore_heart': {
            // dark rock with a big glowing crystal of its ore
            g.fill(def.color); g.stroke(shade(def.color, -0.4)); polyShape(g, poly, 0.9, c);
            g.noStroke(); g.fill(shade(def.accent, -0.55)); polyShape(g, hexPoints(c.x, c.y, 13), 1, c);
            g.fill(def.accent); g.stroke(shade(def.accent, -0.4)); g.strokeWeight(1.2);
            g.quad(c.x, c.y - 12, c.x + 8, c.y, c.x, c.y + 12, c.x - 8, c.y);
            g.noStroke(); g.fill(255, 255, 255, 170); g.quad(c.x, c.y - 9, c.x + 3, c.y - 2, c.x, c.y + 2, c.x - 3, c.y - 2);
            g.fill(def.accent); for(let k = 0; k < 4; k++){ const a = k * Math.PI / 2 + Math.PI / 4; g.circle(c.x + Math.cos(a) * 15, c.y + Math.sin(a) * 15, 4); }
            break;
        }
        case 'torch':
            g.noStroke(); g.fill(0, 0, 0, 45); g.ellipse(c.x + 2, c.y + 9, 12, 5);
            g.stroke('#5b4026'); g.strokeWeight(3); g.line(c.x, c.y + 9, c.x, c.y - 6);   // the flame is drawn live (worldOverlay)
            if(def.id === 'grease_torch'){ g.noStroke(); g.fill('#e8d38a'); g.rect(c.x - 3, c.y - 7, 6, 5, 1); }   // greased head
            break;
        case 'lamp':
            g.noStroke(); g.fill(0, 0, 0, 45); g.ellipse(c.x + 2, c.y + 10, 20, 7);
            g.fill(def.color); g.stroke(shade(def.color, -0.45)); g.strokeWeight(1.2);
            g.ellipse(c.x, c.y + 4, 22, 12);                                  // clay bowl
            g.triangle(c.x + 9, c.y + 1, c.x + 17, c.y - 2, c.x + 10, c.y + 6);   // spout
            g.noStroke(); g.fill('#e8d38a'); g.ellipse(c.x, c.y + 2, 14, 5);  // oil
            break;
        case 'glass':
            g.fill(191, 227, 234, 150); g.stroke('#e8fbff'); polyShape(g, poly, 0.84, c);
            g.stroke(255, 255, 255, 180); g.line(c.x - 8, c.y - 8, c.x - 2, c.y - 13); g.line(c.x + 2, c.y + 6, c.x + 9, c.y + 1);
            break;
        case 'planks':
            g.fill(def.color); g.stroke(shade(def.color, -0.35));
            polyShape(g, poly, 0.86, c);
            g.stroke(shade(def.color, -0.25)); g.strokeWeight(1);
            g.line(c.x - 15, c.y - 5, c.x + 15, c.y - 5); g.line(c.x - 15, c.y + 5, c.x + 15, c.y + 5);
            break;
        case 'station':
            if(def.station === 'workbench'){
                g.fill(shade(def.color, -0.3)); g.noStroke(); g.rect(c.x - 12, c.y + 4, 4, 8); g.rect(c.x + 8, c.y + 4, 4, 8);
                g.fill(def.color); g.stroke(shade(def.color, -0.4)); g.rect(c.x - 15, c.y - 10, 30, 16, 2);
                g.stroke(shade(def.color, -0.2)); g.line(c.x - 5, c.y - 10, c.x - 5, c.y + 6); g.line(c.x + 5, c.y - 10, c.x + 5, c.y + 6);
            } else if(def.station === 'loom'){
                g.fill(shade(def.color, -0.3)); g.stroke(shade(def.color, -0.5)); g.rect(c.x - 15, c.y - 13, 4, 26, 1); g.rect(c.x + 11, c.y - 13, 4, 26, 1);
                g.fill(def.color); g.rect(c.x - 15, c.y - 13, 30, 5, 1); g.rect(c.x - 15, c.y + 8, 30, 5, 1);
                g.stroke('#efe6cc'); g.strokeWeight(1); for(let k = -8; k <= 8; k += 3) g.line(c.x + k, c.y - 8, c.x + k, c.y + 8);
                g.noStroke(); g.fill('#cdb88e'); g.rect(c.x - 9, c.y - 2, 18, 6, 1);
            } else if(def.station === 'pot'){
                const lit = !!b.lit;   // a fire under it while it cooks
                g.noStroke(); g.fill('#3a3a3a'); g.rect(c.x - 12, c.y + 6, 4, 7); g.rect(c.x + 8, c.y + 6, 4, 7);
                if(lit){ g.fill('#ff8a1e'); g.ellipse(c.x, c.y + 12, 18, 8); g.fill('#ffe27a'); g.ellipse(c.x, c.y + 12, 9, 4); }
                g.fill(def.color); g.stroke(shade(def.color, -0.45)); g.ellipse(c.x, c.y + 2, 30, 22);
                g.fill(lit ? '#9a5a2a' : '#7a4a2a'); g.ellipse(c.x, c.y - 3, 22, 9);
                if(lit){ g.noFill(); g.stroke(255, 255, 255, 150); g.strokeWeight(1.5); g.arc(c.x - 3, c.y - 12, 6, 8, Math.PI, 0); g.arc(c.x + 4, c.y - 14, 6, 8, Math.PI, 0); }   // steam
            } else if(def.station === 'chest'){
                g.fill(shade(def.color, -0.15)); g.stroke(shade(def.color, -0.45)); g.rect(c.x - 15, c.y - 10, 30, 22, 3);
                g.fill(def.color); g.rect(c.x - 15, c.y - 12, 30, 9, 3);
                g.noStroke(); g.fill('#d8b450'); g.rect(c.x - 3, c.y - 6, 6, 7, 1);
            } else {   // forge: clay-and-stone dome
                const lit = !!b.lit;
                g.fill(shade(def.color, -0.15)); g.stroke(shade(def.color, -0.45)); g.rect(c.x - 15, c.y - 4, 30, 17, 3);
                g.fill(def.color); g.arc(c.x, c.y - 2, 30, 30, Math.PI, 0, CHORD);
                g.fill(lit ? '#ff9a2e' : '#262626'); g.noStroke(); g.arc(c.x, c.y + 6, 14, 14, Math.PI, 0, CHORD); g.rect(c.x - 7, c.y + 6, 14, 4);
                if(lit){ g.fill('#ffe07a'); g.ellipse(c.x, c.y + 7, 8, 5); }
                g.fill(shade(def.color, -0.35)); g.rect(c.x + 5, c.y - 19, 5, 7);   // chimney
            }
            break;
        default:
            g.fill(def.color); g.stroke(shade(def.color, -0.35)); polyShape(g, poly, 0.8, c);
    }
    // cracks from monsters trying to break through (1..4 levels)
    const lvl = b && b.cracks ? Math.floor(b.cracks * 4) + 1 : 0;
    if(lvl){
        g.stroke(20, 14, 10, 200); g.strokeWeight(1.6); g.noFill();
        const cracks = [[-2, -12, 3, -3, -4, 4], [3, -3, 11, 2, 14, -6], [-4, 4, -12, 8, -14, 2], [-4, 4, 1, 12, 6, 9]];
        for(let k = 0; k < Math.min(4, lvl); k++){
            const q = cracks[k];
            g.line(c.x + q[0], c.y + q[1], c.x + q[2], c.y + q[3]); g.line(c.x + q[2], c.y + q[3], c.x + q[4], c.y + q[5]);
        }
    }
}

const Render = { gfx: null };
/** Scene function script (world space, under the objects): the cached terrain. */
function drawTerrain(){
    if(!Theaya.ready) return;
    const T = Theaya, zone = T.zone;
    if(!Render.gfx){
        const s = tileMatrix.boundsFor('hex', 'pointy', MAP_COLS, MAP_ROWS, HEX_W, HEX_H);
        Render.gfx = createGraphics(Math.ceil(s.w) + 2, Math.ceil(s.h) + 2);
        Render.gfx.pixelDensity(1);
        T.fullRedraw = true;
    }
    const g = Render.gfx;
    if(T.fullRedraw){
        g.clear();
        for(let i = 0; i < MAP_COLS * MAP_ROWS; i++) drawCellOn(g, i);
        T.fullRedraw = false;
        T.dirty.clear();
    } else if(T.dirty.size){
        for(const i of T.dirty) drawCellOn(g, i);
        T.dirty.clear();
    }
    const o = zone.transform.position;
    push(); imageMode(CORNER); image(g, o.x, o.y); pop();
}

function cellOutline(x, y, col, weight = 2){
    const poly = Theaya.zone.cellPolygon(x, y);
    if(!poly.length) return;
    push(); noFill(); stroke(col); strokeWeight(weight);
    beginShape(); for(const p of poly) vertex(p.x, p.y); endShape(CLOSE);
    pop();
}
function ringArc(cx, cy, r, frac, col, weight){
    push(); noFill(); stroke(col); strokeWeight(weight);
    beginShape();
    const n = Math.max(2, Math.ceil(40 * frac));
    for(let k = 0; k <= n; k++){ const a = -Math.PI / 2 + Math.PI * 2 * frac * k / n; vertex(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    endShape();
    pop();
}

/** World-space overlay drawn above the player: canopies, hover, path, mining progress. */
const worldOverlay = {
    id: 'theaya_world_overlay', scenes: [SCENE_ID], layer: 10, deleted: false, tags: [],
    render(){
        if(!Theaya.ready) return;
        push();
        resetDrawModes();
        this._draw();
        pop();
    },
    _draw(){
        const zone = Theaya.zone, cam = World.camera.getBounds(60);
        const pp = player.transform.position;
        // path preview
        push(); noStroke(); fill(255, 255, 255, 140);
        for(const c of zone.remainingPath(player)){ const w = zone.toWorld(c.x, c.y); circle(w.x, w.y, 5); }
        pop();
        // hovered / targeted cells
        if(!GameUI.wheel && !uiHit(mouse.rawX, mouse.rawY)){
            const hc = zone.toCell(mouse.x, mouse.y);
            if(hc){
                const q = quickActionFor(hc.x, hc.y, mouse.x, mouse.y);   // gold = left click uses the tool here, red = it can't
                cellOutline(hc.x, hc.y, !q ? 'rgba(255,255,255,0.55)' : q.reason ? 'rgba(255,110,90,0.8)' : '#ffd75e', q ? 3 : 2);
            }
        }
        if(GameUI.wheel) cellOutline(GameUI.wheel.x, GameUI.wheel.y, '#ffd75e', 3);
        if(GameUI.station) cellOutline(GameUI.station.x, GameUI.station.y, '#8fd0ff', 2);
        // torch flames (they flicker, so they're drawn live, not on the terrain buffer)
        push(); noStroke();
        const t = performance.now() / 1000;
        for(const i of Theaya.lights){
            const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
            if(!def || (def.kind !== 'torch' && def.kind !== 'lamp')) continue;
            const { x, y } = cellXY(i), w = zone.toWorld(x, y);
            if(w.x < cam.left || w.x > cam.right || w.y < cam.top || w.y > cam.bottom) continue;
            const f = 0.85 + 0.15 * Math.sin(t * 13 + i) * Math.sin(t * 7.3 + i * 1.7);
            const k = def.light / TORCH.light;                      // brighter lights have a bigger flame
            const fx = def.kind === 'lamp' ? w.x + 15 : w.x, fy = def.kind === 'lamp' ? w.y - 4 : w.y - 9;   // lamps burn at the spout
            const s = def.kind === 'lamp' ? 0.8 : Math.min(1.3, k);
            fill(255, 170, 60, 60 * Math.min(1.6, k)); circle(fx, fy, 22 * f * Math.min(1.6, k));
            fill('#ff8a1e'); ellipse(fx, fy, 9 * f * s, 13 * f * s);
            fill('#ffe27a'); ellipse(fx, fy + 1, 4.5 * f * s, 7 * f * s);
        }
        pop();
        // tree canopies (over the player)
        push(); strokeWeight(1.5);
        for(const i of Theaya.trees){
            const { x, y } = cellXY(i), w = zone.toWorld(x, y);
            if(w.x < cam.left || w.x > cam.right || w.y < cam.top || w.y > cam.bottom) continue;
            const def = Blocks.get(Theaya.blocks[i].id);
            const near = Math.hypot(pp.x - w.x, pp.y - (w.y - 10)) < HEX_W * 1.3;
            const a = near ? 120 : 235;
            const leaf = color(def.accent), dark = color(shade(def.accent, -0.3)), lite = color(shade(def.accent, 0.15));
            leaf.setAlpha(a); dark.setAlpha(a); lite.setAlpha(a);
            stroke(dark); fill(leaf);
            if(def.conifer){
                triangle(w.x, w.y - 40, w.x - 17, w.y - 6, w.x + 17, w.y - 6);
                fill(lite); triangle(w.x, w.y - 46, w.x - 12, w.y - 22, w.x + 12, w.y - 22);
            } else {
                circle(w.x - 9, w.y - 14, 24); circle(w.x + 9, w.y - 14, 24); circle(w.x, w.y - 24, 28);
                noStroke(); fill(lite); circle(w.x - 4, w.y - 28, 10);
            }
        }
        pop();
        // mining progress
        const j = Act.job;
        if(j){
            const w = zone.toWorld(j.x, j.y);
            ringArc(w.x, w.y, 17, 1, 'rgba(0,0,0,0.45)', 6);
            ringArc(w.x, w.y, 17, Math.min(1, j.elapsed / j.time), '#ffd75e', 4);
        }
    },
};
theayaScene.addObject(worldOverlay);

/**
 * Sky layer (screen space, over the world, under the HUD): rain / snow / hail,
 * lightning, drought haze, and the day / night darkness with light around the
 * player and lit forges.
 */
const modp = (a, m) => ((a % m) + m) % m;
const skyLayer = {
    id: 'theaya_sky', scenes: [SCENE_ID], layer: 500, deleted: false, tags: [],
    gfx: null,
    render(){
        if(!Theaya.ready) return;
        push();
        resetMatrix();
        resetDrawModes();
        this._precipitation();
        this._darkness();
        this._eyes();
        this._hurt();
        this._flash();
        pop();
    },
    _precipitation(){
        const cur = Weather.current;
        if(!cur) return;
        const W = Weather.data(), sp = World.camera.superPosition, t = performance.now() / 1000;
        if(Weather.type === 'drought'){ noStroke(); fill(255, 170, 70, 28 + 10 * Math.sin(t * 0.7)); rect(0, 0, width, height); return; }
        if(!W.precipitation) return;
        const snow = playerTemperature() <= 0 && Weather.type !== 'hail', hail = cur.hail, I = W.intensity ?? 0.6;
        noStroke(); fill(20, 30, 50, 25 + 35 * I); rect(0, 0, width, height);
        const n = Math.floor((snow ? 160 : 240) * I);
        for(let k = 0; k < n; k++){
            const s = 0.7 + 0.6 * hash2(k, 3, 77);
            const isHail = hail && k % 3 === 0;
            const vy = snow ? 55 * s : isHail ? 900 * s : 650 * s;
            const vx = snow ? 18 * Math.sin(t * 0.8 + k) : -110;
            const x = modp(hash2(k, 1, 77) * width + vx * t - sp.x, width), y = modp(hash2(k, 2, 77) * height + vy * t - sp.y, height);
            if(isHail){ fill(235, 240, 250, 230); circle(x, y, 4); }
            else if(snow){ fill(255, 255, 255, 220); circle(x, y, 2.5 + 2 * s); }
            else { stroke(175, 200, 255, 150); strokeWeight(1.3); line(x, y, x + vx * 0.022, y + vy * 0.022); noStroke(); }
        }
    },
    _darkness(){
        const dark = Math.min(0.82, (1 - Clock.light()) * 0.74 + Weather.param('darkness', 0));
        // caves stay dark in daytime too: find the cave cells on screen
        const zone = Theaya.zone, cam = World.camera.getBounds(HEX_W), caves = [];
        if(dark < CAVE_DARKNESS){
            const a = zone.toCell(cam.left, cam.top), b = zone.toCell(cam.right, cam.bottom);
            const x0 = Math.max(0, (a ? a.x : 0) - 1), y0 = Math.max(0, (a ? a.y : 0) - 1);
            const x1 = Math.min(MAP_COLS - 1, (b ? b.x : MAP_COLS - 1) + 1), y1 = Math.min(MAP_ROWS - 1, (b ? b.y : MAP_ROWS - 1) + 1);
            for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) if(Theaya.biome[cellIndex(x, y)] === 'cave') caves.push({ x, y });
        }
        if(dark < 0.01 && !caves.length) return;
        const sc = 0.5, w = Math.ceil(width * sc), h = Math.ceil(height * sc);
        if(!this.gfx || this.gfx.width !== w || this.gfx.height !== h){ this.gfx = createGraphics(w, h); this.gfx.pixelDensity(1); }
        const g = this.gfx, sp = World.camera.superPosition;
        g.clear(); g.noStroke(); g.fill(6, 10, 30, 255 * dark); g.rect(0, 0, w, h);
        if(caves.length){
            // extra darkness so cave cells end up CAVE_DARKNESS dark overall
            const extra = 1 - (1 - CAVE_DARKNESS) / (1 - dark);
            g.fill(6, 10, 30, 255 * extra);
            for(const c of caves){
                g.beginShape();
                for(const p of zone.cellPolygon(c.x, c.y)){ const k = 1.06, wc = zone.toWorld(c.x, c.y); g.vertex((wc.x + (p.x - wc.x) * k - sp.x) * sc, (wc.y + (p.y - wc.y) * k - sp.y) * sc); }
                g.endShape(CLOSE);
            }
        }
        // holding a light (torch, grease torch, lamp) widens your own light: its glow x heldLight / light
        const held = heldItem(), heldDef = held instanceof BlockItem ? Blocks.get(held.block) : null;
        const holdsLight = !!(heldDef && heldDef.light && held.hasTag('light'));
        const heldR = holdsLight ? Math.max(120, heldDef.light * TORCH.heldLight / TORCH.light) : 120;
        const lights = [{ x: player.transform.position.x, y: player.transform.position.y, r: heldR, warm: holdsLight }];
        for(const i of [...Theaya.forges, ...Theaya.pots]){   // lit forges and cooking pots
            const b = Theaya.blocks[i];
            if(b && b.lit){ const { x, y } = cellXY(i), p = Theaya.zone.toWorld(x, y); lights.push({ x: p.x, y: p.y, r: Theaya.pots.has(i) ? 70 : 95, warm: true }); }
        }
        const flick = performance.now() / 1000;
        for(const i of Theaya.lights){   // torches + ore hearts
            const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
            if(!def || !def.light) continue;
            const { x, y } = cellXY(i), p = Theaya.zone.toWorld(x, y);
            if(p.x < cam.left - def.light || p.x > cam.right + def.light || p.y < cam.top - def.light || p.y > cam.bottom + def.light) continue;
            const fire = def.kind === 'torch' || def.kind === 'lamp';
            const r = fire ? def.light * (0.96 + 0.04 * Math.sin(flick * 9 + i)) : def.light;
            lights.push({ x: p.x, y: p.y - (fire ? 9 : 0), r, warm: fire, tint: def.kind === 'ore_heart' ? def.accent : null });
        }
        g.erase(42, 0);
        for(const L of lights){
            const lx = (L.x - sp.x) * sc, ly = (L.y - sp.y) * sc;
            if(lx < -L.r || ly < -L.r || lx > w + L.r || ly > h + L.r) continue;
            for(let k = 0; k < 12; k++) g.circle(lx, ly, 2 * L.r * sc * (1 - k / 13));
        }
        g.noErase();
        image(g, 0, 0, width, height);
        noStroke();
        const glow = Math.max(dark, caves.length ? CAVE_DARKNESS * 0.7 : 0);
        for(const L of lights){   // warm glow around fires, colored glow around ore hearts
            if(L.tint){ const c = color(L.tint); c.setAlpha(55 * glow); fill(c); circle(L.x - sp.x, L.y - sp.y, L.r * 1.3); continue; }
            if(!L.warm) continue;
            fill(255, 150, 60, 40 * glow); circle(L.x - sp.x, L.y - sp.y, L.r * 1.2);
        }
    },
    /** Zombie eyes glow through the dark. */
    _eyes(){
        const dark = 1 - Clock.light();
        if(dark < 0.3) return;
        const sp = World.camera.superPosition;
        noStroke(); fill(255, 70, 50, 220 * dark);
        for(const m of Mobs.list){
            if(m.type !== 'zombie') continue;
            const fx = Math.cos(m.facing), fy = Math.sin(m.facing), s = m.def.size;
            for(const side of [-1, 1]) circle(m.px - sp.x + fx * s * 0.45 - fy * s * 0.13 * side, m.py - sp.y + fy * s * 0.45 + fx * s * 0.13 * side, 3);
        }
    },
    /** Red screen edge right after the player gets hit. */
    _hurt(){
        const k = 1 - (performance.now() - (GameUI.hurtAt || -1e9)) / 400;
        if(k <= 0) return;
        noFill(); stroke(220, 30, 30, 140 * k);
        for(let j = 0; j < 4; j++){ strokeWeight(18 - j * 4); rect(j * 6, j * 6, width - j * 12, height - j * 12); }
    },
    _flash(){
        const bolt = Weather.bolt, sp = World.camera.superPosition;
        if(bolt && performance.now() < bolt.until){
            const bx = bolt.x - sp.x, by = bolt.y - sp.y;
            stroke(255, 255, 230, 240); strokeWeight(3); noFill();
            beginShape();
            let x = bx + 40, y = -10;
            vertex(x, y);
            for(let k = 1; k <= 7; k++){ y = by * k / 7; x = bx + (k < 7 ? (hash2(k, Math.floor(bolt.until), 5) - 0.5) * 50 : 0); vertex(x, y); }
            endShape();
        }
        if(Weather.flash > 0){ noStroke(); fill(255, 255, 255, 170 * Weather.flash); rect(0, 0, width, height); }
    },
};
theayaScene.addObject(skyLayer);


/* ----- HUD (screen space) ----- */
const SLOT = 46, SLOT_GAP = 5;

function region(x, y, w, h, props){ const r = Object.assign({ x, y, w, h }, props); GameUI.regions.push(r); return r; }
function panel(x, y, w, h, title = null, props = {}){
    noStroke(); fill(18, 22, 30, 225); rect(x, y, w, h, 10);
    stroke(255, 255, 255, 30); noFill(); rect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
    if(title){ noStroke(); fill(240); textSize(15); textStyle(BOLD); textAlign(LEFT, TOP); text(title, x + 14, y + 11); textStyle(NORMAL); }
    region(x, y, w, h, Object.assign({ kind:'panel' }, props));
}
function button(x, y, w, h, label, enabled, onClick, hover){
    const over = hover && mouse.rawX >= x && mouse.rawX <= x + w && mouse.rawY >= y && mouse.rawY <= y + h;
    noStroke(); fill(enabled ? (over ? '#4f8f5a' : '#3d7347') : '#3a3d44'); rect(x, y, w, h, 6);
    fill(enabled ? 255 : 140); textSize(12); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2 + 1);
    region(x, y, w, h, { kind:'button', enabled, onClick });
}

/** Draws an item (instance or id) centered at (cx, cy) in a box of size s. */
function drawItemIcon(item, cx, cy, s){
    const look = Items.look(item), col = look.color, dk = shade(col, -0.4), r = s / 2;
    push(); strokeWeight(1.5); stroke(dk); fill(col);
    switch(look.icon){
        case 'block': {
            beginShape(); for(const p of hexPoints(cx, cy, r * 0.72)) vertex(p.x, p.y); endShape(CLOSE);
            noStroke(); fill(shade(col, 0.18)); beginShape(); for(const p of hexPoints(cx, cy - 3, r * 0.4)) vertex(p.x, p.y); endShape(CLOSE);
            break;
        }
        case 'log':
            rect(cx - r * 0.75, cy - r * 0.35, r * 1.4, r * 0.7, 4);
            fill(look.accent || shade(col, 0.4)); ellipse(cx + r * 0.65, cy, r * 0.42, r * 0.7);
            noFill(); stroke(dk); ellipse(cx + r * 0.65, cy, r * 0.18, r * 0.34);
            break;
        case 'stick':
            strokeWeight(4); stroke(col); line(cx - r * 0.55, cy + r * 0.55, cx + r * 0.55, cy - r * 0.55);
            break;
        case 'raw':
            fill('#7a7a7a'); stroke('#4a4a4a');
            beginShape(); vertex(cx - r * 0.6, cy + r * 0.1); vertex(cx - r * 0.3, cy - r * 0.55); vertex(cx + r * 0.35, cy - r * 0.5);
            vertex(cx + r * 0.65, cy + r * 0.05); vertex(cx + r * 0.25, cy + r * 0.55); vertex(cx - r * 0.35, cy + r * 0.5); endShape(CLOSE);
            noStroke(); fill(col); circle(cx - r * 0.2, cy - r * 0.15, r * 0.3); circle(cx + r * 0.2, cy + r * 0.15, r * 0.34); circle(cx + r * 0.25, cy - r * 0.25, r * 0.2);
            break;
        case 'chunk':
            circle(cx - r * 0.25, cy + r * 0.15, r * 0.7); circle(cx + r * 0.25, cy + r * 0.2, r * 0.6); circle(cx, cy - r * 0.25, r * 0.65);
            break;
        case 'ingot':
            beginShape(); vertex(cx - r * 0.7, cy + r * 0.35); vertex(cx - r * 0.45, cy - r * 0.3); vertex(cx + r * 0.45, cy - r * 0.3); vertex(cx + r * 0.7, cy + r * 0.35); endShape(CLOSE);
            noStroke(); fill(shade(col, 0.3)); quad(cx - r * 0.4, cy - r * 0.22, cx + r * 0.4, cy - r * 0.22, cx + r * 0.3, cy - r * 0.05, cx - r * 0.3, cy - r * 0.05);
            break;
        case 'shovel':
            strokeWeight(3.5); stroke('#7a5532'); line(cx - r * 0.55, cy + r * 0.6, cx + r * 0.25, cy - r * 0.2);
            strokeWeight(1.5); stroke(dk); fill(col);
            quad(cx + r * 0.15, cy - r * 0.35, cx + r * 0.45, cy - r * 0.68, cx + r * 0.72, cy - r * 0.42, cx + r * 0.42, cy - r * 0.08);
            break;
        case 'pickaxe':
        case 'axe':
            strokeWeight(3.5); stroke('#7a5532'); line(cx - r * 0.55, cy + r * 0.6, cx + r * 0.35, cy - r * 0.35);
            strokeWeight(1.5); stroke(dk); fill(col);
            if(look.icon === 'pickaxe'){
                beginShape(); vertex(cx - r * 0.35, cy - r * 0.6); vertex(cx + r * 0.25, cy - r * 0.62); vertex(cx + r * 0.7, cy - r * 0.15);
                vertex(cx + r * 0.6, cy - r * 0.05); vertex(cx + r * 0.2, cy - r * 0.42); vertex(cx - r * 0.3, cy - r * 0.45); endShape(CLOSE);
            } else {
                beginShape(); vertex(cx + r * 0.1, cy - r * 0.55); vertex(cx + r * 0.6, cy - r * 0.6); vertex(cx + r * 0.65, cy + r * 0.05); vertex(cx + r * 0.3, cy - r * 0.15); endShape(CLOSE);
            }
            break;
        case 'berries':
            noStroke(); fill('#2f6b2a'); ellipse(cx + r * 0.1, cy - r * 0.55, r * 0.5, r * 0.25);
            fill(col); circle(cx - r * 0.25, cy, r * 0.6); circle(cx + r * 0.25, cy + r * 0.05, r * 0.6); circle(cx, cy - r * 0.3, r * 0.55);
            fill(255, 255, 255, 120); circle(cx - r * 0.32, cy - r * 0.08, r * 0.15);
            break;
        case 'bush':
            noStroke(); fill(shade(col, -0.15)); circle(cx - r * 0.3, cy + r * 0.15, r * 0.8); circle(cx + r * 0.3, cy + r * 0.15, r * 0.8);
            fill(col); circle(cx, cy - r * 0.15, r * 0.9);
            fill('#c8324d'); circle(cx - r * 0.2, cy - r * 0.2, r * 0.2); circle(cx + r * 0.25, cy, r * 0.2);
            break;
        case 'sapling':
            stroke('#5b4026'); strokeWeight(2.5); line(cx, cy + r * 0.6, cx, cy - r * 0.2);
            noStroke(); fill(col); ellipse(cx - r * 0.3, cy - r * 0.2, r * 0.6, r * 0.32); ellipse(cx + r * 0.3, cy - r * 0.4, r * 0.6, r * 0.32);
            break;
        case 'canteen': {
            rect(cx - r * 0.45, cy - r * 0.45, r * 0.9, r * 1.05, 7);
            fill('#4a4a4a'); noStroke(); rect(cx - r * 0.15, cy - r * 0.7, r * 0.3, r * 0.28, 2);
            const w = item && item.get ? item.get('water') : null;
            if(w && w.value > 0){
                const fh = r * 0.85 * (w.value / w.capacity);
                fill('#4aa3ff'); rect(cx - r * 0.33, cy + r * 0.5 - fh, r * 0.66, fh, 4);
            }
            break;
        }
        case 'workbench':
            rect(cx - r * 0.7, cy - r * 0.45, r * 1.4, r * 0.55, 3);
            fill(dk); noStroke(); rect(cx - r * 0.6, cy + r * 0.1, r * 0.2, r * 0.5); rect(cx + r * 0.4, cy + r * 0.1, r * 0.2, r * 0.5);
            break;
        case 'furnace':
            rect(cx - r * 0.65, cy - r * 0.1, r * 1.3, r * 0.65, 3);
            arc(cx, cy, r * 1.3, r * 1.2, Math.PI, 0, CHORD);
            fill('#ff9a2e'); noStroke(); arc(cx, cy + r * 0.3, r * 0.6, r * 0.6, Math.PI, 0, CHORD);
            break;
        case 'hoe':
            strokeWeight(3.5); stroke('#7a5532'); line(cx - r * 0.55, cy + r * 0.6, cx + r * 0.35, cy - r * 0.45);
            strokeWeight(1.5); stroke(dk); fill(col);
            quad(cx + r * 0.2, cy - r * 0.6, cx + r * 0.65, cy - r * 0.45, cx + r * 0.6, cy - r * 0.25, cx + r * 0.25, cy - r * 0.35);
            break;
        case 'bucket': {
            quad(cx - r * 0.55, cy - r * 0.45, cx + r * 0.55, cy - r * 0.45, cx + r * 0.42, cy + r * 0.6, cx - r * 0.42, cy + r * 0.6);
            noFill(); stroke('#5a5a5a'); arc(cx, cy - r * 0.45, r * 1.1, r * 0.9, Math.PI, 0);
            const w = waterOf(item);
            noStroke(); fill(w && w.value > 0 ? '#4aa3ff' : shade(col, -0.3));
            ellipse(cx, cy - r * 0.45, r * 1.05, r * 0.25);
            break;
        }
        case 'produce': {
            const sh = look.shape;
            noStroke();
            if(sh === 'root'){
                fill(col); triangle(cx - r * 0.25, cy - r * 0.35, cx + r * 0.25, cy - r * 0.35, cx + r * 0.05, cy + r * 0.7);
                fill(look.accent || '#5fae3f'); ellipse(cx - r * 0.12, cy - r * 0.5, r * 0.2, r * 0.45); ellipse(cx + r * 0.12, cy - r * 0.5, r * 0.2, r * 0.45);
            } else if(sh === 'grain'){
                stroke(shade(col, -0.3)); strokeWeight(1.5); line(cx, cy + r * 0.7, cx, cy - r * 0.2); noStroke();
                fill(col); for(let k = 0; k < 4; k++){ ellipse(cx - r * 0.15, cy - r * 0.55 + k * r * 0.2, r * 0.25, r * 0.16); ellipse(cx + r * 0.15, cy - r * 0.5 + k * r * 0.2, r * 0.25, r * 0.16); }
            } else if(sh === 'leaf'){
                fill(shade(col, -0.15)); circle(cx - r * 0.25, cy + r * 0.1, r * 0.8); circle(cx + r * 0.25, cy + r * 0.1, r * 0.8);
                fill(col); circle(cx, cy - r * 0.15, r * 0.85);
            } else if(sh === 'stalk'){
                stroke(col); strokeWeight(r * 0.22); line(cx - r * 0.2, cy + r * 0.6, cx - r * 0.2, cy - r * 0.6); line(cx + r * 0.2, cy + r * 0.6, cx + r * 0.2, cy - r * 0.6);
                stroke(shade(col, -0.3)); strokeWeight(1.5); line(cx - r * 0.35, cy, cx + r * 0.35, cy);
            } else if(sh === 'pepper'){
                fill(col); ellipse(cx, cy + r * 0.05, r * 0.55, r * 1.1);
                fill(look.accent || '#3f7f36'); rect(cx - r * 0.1, cy - r * 0.65, r * 0.2, r * 0.25, 2);
            } else {
                stroke(shade(col, -0.35)); strokeWeight(1.2); fill(col); circle(cx, cy + r * 0.05, r * 1.05);
                noStroke(); fill(look.accent || '#5fae3f'); ellipse(cx + r * 0.08, cy - r * 0.5, r * 0.35, r * 0.18);
                fill(255, 255, 255, 80); circle(cx - r * 0.2, cy - r * 0.12, r * 0.2);
            }
            break;
        }
        case 'seeds':
            noStroke(); fill('#c9b48a'); rect(cx - r * 0.5, cy - r * 0.55, r, r * 1.15, 4);
            fill(col); circle(cx, cy - r * 0.05, r * 0.55);
            fill('#6b5636'); for(let k = 0; k < 3; k++) ellipse(cx - r * 0.25 + k * r * 0.25, cy + r * 0.4, r * 0.16, r * 0.24);
            break;
        case 'fiber':
            noFill(); stroke(col); strokeWeight(2.2);
            for(let k = -1; k <= 1; k++){ beginShape(); for(let t = 0; t <= 4; t++) vertex(cx + k * r * 0.25 + Math.sin(t + k) * r * 0.12, cy - r * 0.6 + t * r * 0.3); endShape(); }
            break;
        case 'wall':
            rect(cx - r * 0.65, cy - r * 0.55, r * 1.3, r * 1.1, 2);
            stroke(shade(col, -0.35)); line(cx - r * 0.65, cy, cx + r * 0.65, cy); line(cx - r * 0.1, cy - r * 0.55, cx - r * 0.1, cy); line(cx + r * 0.25, cy, cx + r * 0.25, cy + r * 0.55);
            break;
        case 'door':
            rect(cx - r * 0.4, cy - r * 0.7, r * 0.8, r * 1.4, 3);
            noStroke(); fill('#e0c060'); circle(cx + r * 0.22, cy, r * 0.16);
            break;
        case 'chest':
            rect(cx - r * 0.65, cy - r * 0.35, r * 1.3, r * 0.9, 3);
            fill(shade(col, 0.15)); rect(cx - r * 0.65, cy - r * 0.55, r * 1.3, r * 0.35, 3);
            noStroke(); fill('#d8b450'); rect(cx - r * 0.1, cy - r * 0.35, r * 0.2, r * 0.3, 1);
            break;
        case 'glass':
            fill(191, 227, 234, 170); beginShape(); for(const p of hexPoints(cx, cy, r * 0.72)) vertex(p.x, p.y); endShape(CLOSE);
            stroke(255); line(cx - r * 0.3, cy - r * 0.2, cx - r * 0.05, cy - r * 0.45);
            break;
        case 'food':
            fill(col); ellipse(cx, cy + r * 0.05, r * 1.3, r * 0.85);
            noStroke(); fill(shade(col, 0.25)); ellipse(cx - r * 0.1, cy - r * 0.08, r * 0.8, r * 0.35);
            if(look.accent){ fill(look.accent); ellipse(cx, cy + r * 0.35, r * 1.2, r * 0.25); }
            break;
        case 'thread':
            fill('#8a6a42'); rect(cx - r * 0.45, cy - r * 0.6, r * 0.9, r * 0.18, 2); rect(cx - r * 0.45, cy + r * 0.42, r * 0.9, r * 0.18, 2);
            fill(col); rect(cx - r * 0.32, cy - r * 0.42, r * 0.64, r * 0.84, 2);
            stroke(shade(col, -0.25)); for(let k = -2; k <= 2; k++) line(cx - r * 0.32, cy + k * r * 0.15, cx + r * 0.32, cy + k * r * 0.15 + 2);
            break;
        case 'cloth':
            quad(cx - r * 0.65, cy - r * 0.35, cx + r * 0.5, cy - r * 0.5, cx + r * 0.65, cy + r * 0.35, cx - r * 0.5, cy + r * 0.5);
            stroke(look.accent || shade(col, -0.2)); line(cx - r * 0.5, cy, cx + r * 0.5, cy - r * 0.12); line(cx - r * 0.35, cy + r * 0.25, cx + r * 0.6, cy + r * 0.12);
            break;
        case 'meat':
            fill(col); ellipse(cx - r * 0.08, cy, r * 1.15, r * 0.85);
            noStroke(); fill(look.accent ? shade(col, 0.2) : '#f3e3d8'); ellipse(cx - r * 0.2, cy - r * 0.1, r * 0.45, r * 0.3);
            fill('#f3efe6'); rect(cx + r * 0.38, cy - r * 0.08, r * 0.38, r * 0.16, 2); circle(cx + r * 0.76, cy - r * 0.08, r * 0.18); circle(cx + r * 0.76, cy + r * 0.08, r * 0.18);
            break;
        case 'sword':
            strokeWeight(r * 0.22); stroke(col); line(cx - r * 0.35, cy + r * 0.35, cx + r * 0.6, cy - r * 0.6);
            strokeWeight(r * 0.14); stroke('#6b4a2a'); line(cx - r * 0.6, cy + r * 0.6, cx - r * 0.35, cy + r * 0.35);
            stroke('#4a4a4a'); line(cx - r * 0.55, cy + r * 0.15, cx - r * 0.15, cy + r * 0.55);
            break;
        case 'bow':
            noFill(); strokeWeight(3); stroke(col); arc(cx - r * 0.3, cy, r * 1.1, r * 1.4, -Math.PI / 2, Math.PI / 2);
            strokeWeight(1); stroke('#efe6cc'); line(cx - r * 0.3, cy - r * 0.7, cx - r * 0.3, cy + r * 0.7);
            break;
        case 'crossbow':
            strokeWeight(3); stroke(col); line(cx, cy - r * 0.6, cx, cy + r * 0.7);
            noFill(); stroke('#8a8a8a'); arc(cx, cy - r * 0.1, r * 1.3, r * 0.7, Math.PI, 0);
            strokeWeight(1); stroke('#efe6cc'); line(cx - r * 0.65, cy - r * 0.1, cx, cy + r * 0.2); line(cx + r * 0.65, cy - r * 0.1, cx, cy + r * 0.2);
            break;
        case 'arrow':
            strokeWeight(2); stroke('#8a6a42'); line(cx - r * 0.6, cy + r * 0.6, cx + r * 0.4, cy - r * 0.4);
            noStroke(); fill(col); triangle(cx + r * 0.65, cy - r * 0.65, cx + r * 0.25, cy - r * 0.45, cx + r * 0.45, cy - r * 0.25);
            fill('#e8e0d0'); triangle(cx - r * 0.6, cy + r * 0.6, cx - r * 0.7, cy + r * 0.3, cx - r * 0.45, cy + r * 0.45); triangle(cx - r * 0.6, cy + r * 0.6, cx - r * 0.3, cy + r * 0.7, cx - r * 0.45, cy + r * 0.45);
            break;
        case 'armor': {
            const p = look.piece;
            if(p === 'head'){ arc(cx, cy + r * 0.15, r * 1.2, r * 1.2, Math.PI, 0, CHORD); rect(cx - r * 0.6, cy + r * 0.1, r * 1.2, r * 0.18, 2); }
            else if(p === 'chest'){ beginShape(); vertex(cx - r * 0.65, cy - r * 0.5); vertex(cx - r * 0.25, cy - r * 0.6); vertex(cx, cy - r * 0.4); vertex(cx + r * 0.25, cy - r * 0.6); vertex(cx + r * 0.65, cy - r * 0.5); vertex(cx + r * 0.45, cy - r * 0.1); vertex(cx + r * 0.4, cy + r * 0.6); vertex(cx - r * 0.4, cy + r * 0.6); vertex(cx - r * 0.45, cy - r * 0.1); endShape(CLOSE); }
            else if(p === 'legs'){ beginShape(); vertex(cx - r * 0.45, cy - r * 0.6); vertex(cx + r * 0.45, cy - r * 0.6); vertex(cx + r * 0.45, cy + r * 0.65); vertex(cx + r * 0.1, cy + r * 0.65); vertex(cx, cy - r * 0.1); vertex(cx - r * 0.1, cy + r * 0.65); vertex(cx - r * 0.45, cy + r * 0.65); endShape(CLOSE); }
            else { rect(cx - r * 0.6, cy - r * 0.2, r * 0.45, r * 0.6, 2); rect(cx + r * 0.15, cy - r * 0.2, r * 0.45, r * 0.6, 2); }
            noStroke(); fill(255, 255, 255, 70); circle(cx - r * 0.2, cy - r * 0.2, r * 0.2);
            break;
        }
        case 'loom':
            fill(shade(col, -0.3)); rect(cx - r * 0.65, cy - r * 0.6, r * 0.18, r * 1.2); rect(cx + r * 0.47, cy - r * 0.6, r * 0.18, r * 1.2);
            fill(col); rect(cx - r * 0.65, cy - r * 0.6, r * 1.3, r * 0.2); rect(cx - r * 0.65, cy + r * 0.4, r * 1.3, r * 0.2);
            stroke('#efe6cc'); strokeWeight(1); for(let k = -2; k <= 2; k++) line(cx + k * r * 0.15, cy - r * 0.4, cx + k * r * 0.15, cy + r * 0.4);
            break;
        case 'torch':
            strokeWeight(r * 0.2); stroke('#6b4a2a'); line(cx, cy + r * 0.7, cx, cy - r * 0.1);
            noStroke(); fill('#ff8a1e'); ellipse(cx, cy - r * 0.35, r * 0.55, r * 0.8);
            fill('#ffe27a'); ellipse(cx, cy - r * 0.28, r * 0.25, r * 0.4);
            if(look.accent){ fill(look.accent); rect(cx - r * 0.14, cy - r * 0.08, r * 0.28, r * 0.2, 1); }   // grease torch
            break;
        case 'lamp':
            fill(col); ellipse(cx - r * 0.1, cy + r * 0.25, r * 1.1, r * 0.6);
            triangle(cx + r * 0.35, cy + r * 0.1, cx + r * 0.75, cy - r * 0.05, cx + r * 0.4, cy + r * 0.4);
            noStroke(); fill('#e8d38a'); ellipse(cx - r * 0.1, cy + r * 0.12, r * 0.7, r * 0.22);
            fill('#ff8a1e'); ellipse(cx + r * 0.72, cy - r * 0.3, r * 0.3, r * 0.45);
            fill('#ffe27a'); ellipse(cx + r * 0.72, cy - r * 0.25, r * 0.14, r * 0.22);
            break;
        case 'grease':   // a little clay jar of grease
            fill('#b0745a'); rect(cx - r * 0.45, cy - r * 0.3, r * 0.9, r * 0.9, 4);
            fill(col); noStroke(); ellipse(cx, cy - r * 0.3, r * 0.9, r * 0.32);
            fill(255, 255, 255, 120); ellipse(cx - r * 0.15, cy - r * 0.34, r * 0.3, r * 0.1);
            fill(col); ellipse(cx + r * 0.2, cy - r * 0.15, r * 0.18, r * 0.35);   // a drip
            break;
        case 'pot':
            fill(col); ellipse(cx, cy + r * 0.1, r * 1.3, r * 1.0);
            noStroke(); fill('#7a4a2a'); ellipse(cx, cy - r * 0.2, r * 1.0, r * 0.35);
            stroke(255, 255, 255, 140); noFill(); arc(cx - r * 0.15, cy - r * 0.55, r * 0.3, r * 0.4, Math.PI, 0);
            break;
        default:
            circle(cx, cy, r);
    }
    pop();
}

/** One slot of any container. ref = { box, i } (player.inventory or a Box). */
function drawSlot(x, y, ref, opts = {}){
    const item = refItem(ref);
    const over = mouse.rawX >= x && mouse.rawX <= x + SLOT && mouse.rawY >= y && mouse.rawY <= y + SLOT;
    noStroke(); fill(over ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)'); rect(x, y, SLOT, SLOT, 7);
    if(opts.tint){ fill(opts.tint); rect(x, y, SLOT, SLOT, 7); }
    if(opts.selected){ noFill(); stroke('#ffd75e'); strokeWeight(3); rect(x, y, SLOT, SLOT, 7); }
    if(sameRef(GameUI.picked, ref)){ noFill(); stroke('#6fd3ff'); strokeWeight(3); rect(x + 2, y + 2, SLOT - 4, SLOT - 4, 6); }
    if(opts.number != null){ noStroke(); fill(255, 255, 255, 110); textSize(10); textAlign(LEFT, TOP); text(opts.number, x + 4, y + 3); }
    if(!item && opts.hint){ noStroke(); fill(255, 255, 255, 60); textSize(9); textAlign(CENTER, CENTER); text(opts.hint, x + SLOT / 2, y + SLOT / 2); }
    if(item){
        drawItemIcon(item, x + SLOT / 2, y + SLOT / 2, SLOT * 0.78);
        if(item.count > 1){
            noStroke(); fill(0, 0, 0, 160); textSize(12); textAlign(RIGHT, BOTTOM); text(item.count, x + SLOT - 3, y + SLOT - 1);
            fill(255); text(item.count, x + SLOT - 4, y + SLOT - 2);
        }
        const d = item.get('durability');
        if(d && d.value < d.max){
            noStroke(); fill(0, 0, 0, 160); rect(x + 5, y + SLOT - 7, SLOT - 10, 3);
            fill(lerpColor(color('#e04a3a'), color('#5ad15a'), d.value / d.max)); rect(x + 5, y + SLOT - 7, (SLOT - 10) * d.value / d.max, 3);
        }
        const w = waterOf(item);
        if(w && !(item instanceof Canteen)){ noStroke(); fill(0, 0, 0, 160); rect(x + 5, y + SLOT - 7, SLOT - 10, 3); fill('#4aa3ff'); rect(x + 5, y + SLOT - 7, (SLOT - 10) * w.value / w.capacity, 3); }
        if(GameUI.press && GameUI.press.dragging && sameRef(GameUI.press.ref, ref)){ noStroke(); fill(18, 22, 30, 170); rect(x, y, SLOT, SLOT, 7); }
    }
    region(x, y, SLOT, SLOT, { kind:'slot', ref });
}

function statBar(x, y, w, label, value, max, col, extra = 0, danger = null){
    const low = danger != null && value < danger;
    noStroke(); fill(255, 255, 255, 25); rect(x, y, w, 12, 6);
    fill(low && Math.floor(performance.now() / 400) % 2 ? '#ff5a4a' : col); rect(x, y, w * Math.max(0, Math.min(1, value / max)), 12, 6);
    if(extra > 0){ fill(255, 255, 255, 90); rect(x, y, w * Math.min(1, extra / max), 4, 3); }
    if(danger != null){ stroke(255, 90, 74, 200); strokeWeight(2); line(x + w * danger / max, y - 2, x + w * danger / max, y + 14); noStroke(); }
    fill(low ? '#ff8a7a' : 235); textSize(11); textAlign(LEFT, CENTER); text(`${label} ${Math.round(value)}`, x + w + 8, y + 6);
}
function drawStats(){
    const p = player, R = p.nutritionRules, rate = p.nutritionDamageRate(), def = playerDefense();
    const extra = [];
    if(rate > 0) extra.push([`Starving: -${rate.toFixed(2)} health/s`, '#ff8a7a']);
    if(p.poison) extra.push([`Poisoned: -${p.poison.dps.toFixed(1)} health/s (${Math.ceil(p.poison.left)}s)`, '#c6ff6a']);
    if(p.regenBuff) extra.push([`Well fed: +${p.regenBuff.rate.toFixed(1)} health/s (${Math.ceil(p.regenBuff.left)}s)`, '#ff9ac0']);
    if(def > 0) extra.push([`Armor: ${def} defense (-${Math.round(100 - 100 * ARMOR_SCALE / (ARMOR_SCALE + def))}% damage)`, '#bcd6ff']);
    panel(12, 12, 248, 84 + extra.length * 18);
    statBar(24, 24, 150, 'Health', p.health, p.maxHealth, '#e05555');
    statBar(24, 46, 150, 'Hunger', p.hunger, 100, '#e0a040', p.satruation, R.hunger.threshold);
    statBar(24, 68, 150, 'Thirst', p.thirst, 100, '#4aa3ff', 0, R.thirst.threshold);
    textSize(11); textAlign(LEFT, CENTER);
    extra.forEach(([t, c], k) => { fill(c); text(t, 24, 92 + k * 18); });
}
/** Top-right: time, date, season, temperature and weather. Returns the panel's bottom y. */
function drawClock(){
    const w = 236, x = width - w - 12, y = 12, rates = climateRates();
    const effects = [];
    if(rates.thirst > 1.001) effects.push(`thirst x${rates.thirst.toFixed(2)}`);
    if(rates.hunger > 1.001) effects.push(`hunger x${rates.hunger.toFixed(2)}`);
    const h = effects.length ? 104 : 88;
    panel(x, y, w, h, null, { kind:'clock' });   // click: open / close the calendar
    const over = mouse.rawX >= x && mouse.rawX <= x + w && mouse.rawY >= y && mouse.rawY <= y + h;
    if(over || GameUI.calendar){ noFill(); stroke(255, 215, 94, GameUI.calendar ? 160 : 90); strokeWeight(1.5); rect(x + 1, y + 1, w - 2, h - 2, 10); }
    // a small arrow: the calendar folds out below
    noStroke(); fill(over || GameUI.calendar ? '#ffd75e' : 150);
    const ax = x + w - 16, ay = y + 47;
    if(GameUI.calendar) triangle(ax - 4, ay + 3, ax + 4, ay + 3, ax, ay - 2); else triangle(ax - 4, ay - 2, ax + 4, ay - 2, ax, ay + 3);
    // sun / moon
    const day = Clock.isDay, ix = x + 24, iy = y + 24;
    noStroke();
    if(day){ fill('#ffd75e'); circle(ix, iy, 18); stroke('#ffd75e'); strokeWeight(2); for(let k = 0; k < 8; k++){ const a = k * Math.PI / 4; line(ix + Math.cos(a) * 12, iy + Math.sin(a) * 12, ix + Math.cos(a) * 15, iy + Math.sin(a) * 15); } }
    else { fill('#dfe6ff'); circle(ix, iy, 18); fill(18, 22, 30); circle(ix + 6, iy - 4, 15); }
    noStroke(); fill(255); textSize(17); textStyle(BOLD); textAlign(LEFT, CENTER); text(Clock.timeText(), x + 44, iy);
    textStyle(NORMAL); textSize(11); fill(190); textAlign(RIGHT, CENTER); text(`Day ${Math.max(1, Clock.dayIndex - Clock.startDay + 1)}`, x + w - 12, iy);
    textAlign(LEFT, TOP); fill(225); textSize(11.5);
    text(Clock.dateText(), x + 14, y + 42);
    const season = Clock.season();
    fill('#c9e89a'); text(`${prettify(season)}`, x + 14, y + 58);
    const t = Math.round(rates.temp);
    fill(t >= SURVIVAL.hotAbove ? '#ffb070' : t <= 0 ? '#9fd4ff' : t < SURVIVAL.coldBelow ? '#bcd6ff' : 225);
    text(`${t}°C`, x + 82, y + 58);
    fill(Weather.current ? '#bcd6ff' : 200); textAlign(RIGHT, TOP); text(Weather.name(), x + w - 12, y + 58);
    if(effects.length){ fill('#ffb070'); textAlign(LEFT, TOP); text(effects.join(', '), x + 14, y + 76); }
    return y + h;
}

/* ----- Calendar (click the clock) ----- */
const CALENDAR_WEEK = 7;   // days per calendar row
const SEASON_COLORS = { winter:'#9fd4ff', spring:'#c9e89a', summer:'#ffd75e', autumn:'#e8a25a' };
/** Open the calendar on today's month, or fold it back up. */
function toggleCalendar(){
    if(GameUI.calendar){ GameUI.calendar = null; return; }
    const d = Clock.date();
    GameUI.calendar = { year: d.year, month: d.newYear ? -1 : d.month };
}
/** Page the calendar by +1 / -1 month (the new year day(s) get a page of their own before the first month). */
function calendarStep(dir){
    const c = GameUI.calendar;
    if(!c) return;
    const first = Clock.extraDays > 0 ? -1 : 0;
    c.month += dir;
    if(c.month >= Clock.months){ c.month = first; c.year++; }
    else if(c.month < first){
        if(c.year <= 1){ c.month = first; return; }
        c.month = Clock.months - 1; c.year--;
    }
}
/** Absolute day index of day `d` (0-based) of month m (-1 = new year) in year y. */
const calendarDayIndex = (y, m, d) => (y - 1) * Clock.yearDays + (m < 0 ? d : Clock.extraDays + m * Clock.monthDays + d);
/** The calendar panel under the clock. Returns its bottom edge. */
function drawCalendar(top){
    const c = GameUI.calendar, w = 236, x = width - w - 12;
    const days = c.month < 0 ? Clock.extraDays : Clock.monthDays;
    const rows = Math.max(1, Math.ceil(days / CALENDAR_WEEK));
    const cw = (w - 20) / CALENDAR_WEEK, ch = 24, gridY = top + 54;
    const today = Clock.dayIndex, d = Clock.date();
    const h = 54 + rows * ch + 62;
    panel(x, top, w, h, null, { kind:'calendar' });
    // header: < Month, Year N >   + season
    const season = Clock.seasonOf(c.month), scol = SEASON_COLORS[season] ?? '#c9e89a';
    const name = c.month < 0 ? (Clock.cfg.newYearDay || 'New Year') : Clock.monthName(c.month);
    noStroke(); fill(255); textStyle(BOLD); textSize(14); textAlign(CENTER, TOP); text(name, x + w / 2, top + 10); textStyle(NORMAL);
    textSize(11); fill(scol); text(`${prettify(season)}  -  Year ${c.year}`, x + w / 2, top + 30);
    const canBack = !(c.year <= 1 && c.month <= (Clock.extraDays > 0 ? -1 : 0));
    button(x + 10, top + 12, 26, 24, '<', canBack, () => calendarStep(-1), true);
    button(x + w - 36, top + 12, 26, 24, '>', true, () => calendarStep(1), true);
    // season stripe
    fill(scol); rect(x + 10, gridY - 6, w - 20, 2, 1);
    // the days
    textSize(11); textAlign(CENTER, CENTER);
    for(let k = 0; k < days; k++){
        const cx = x + 10 + (k % CALENDAR_WEEK) * cw, cy = gridY + Math.floor(k / CALENDAR_WEEK) * ch;
        const idx = calendarDayIndex(c.year, c.month, k);
        const isToday = idx === today, past = idx < today;
        noStroke();
        if(isToday){ fill(255, 215, 94, 60); rect(cx + 1, cy + 1, cw - 2, ch - 2, 5); stroke('#ffd75e'); strokeWeight(1.5); noFill(); rect(cx + 1, cy + 1, cw - 2, ch - 2, 5); noStroke(); }
        else { fill(255, 255, 255, past ? 8 : 18); rect(cx + 1, cy + 1, cw - 2, ch - 2, 5); }
        fill(isToday ? '#ffd75e' : past ? 120 : 230);
        text(c.month < 0 ? '*' : k + 1, cx + cw / 2, cy + ch / 2 + 1);
        if(idx === Clock.startDay && !isToday){ fill('#8fd0ff'); circle(cx + cw - 6, cy + 6, 4); }   // the day you arrived
    }
    // footer: today + weather
    const fy = gridY + rows * ch + 8;
    stroke(255, 255, 255, 25); line(x + 10, fy - 2, x + w - 10, fy - 2); noStroke();
    textAlign(LEFT, TOP); textSize(11.5); fill(225);
    text(`Today: ${d.newYear ? d.monthName : `${d.monthName} ${d.dayOfMonth}`}, Year ${d.year}`, x + 12, fy + 4);
    const later = Weather.next && Math.floor(Weather.next.start / Clock.day) === today ? `, ${prettify(Weather.next.type).toLowerCase()} later` : '';
    fill(200); text(`Weather: ${Weather.name()}${later}`, x + 12, fy + 21);
    const onToday = c.year === d.year && c.month === (d.newYear ? -1 : d.month);
    button(x + w - 64, fy + 6, 52, 24, 'Today', !onToday, () => { const t = Clock.date(); c.year = t.year; c.month = t.newYear ? -1 : t.month; }, true);
    noStroke(); fill('#8fd0ff'); circle(x + 16, fy + 44, 4);
    fill(150); textSize(10); textAlign(LEFT, CENTER); text('the day you arrived', x + 24, fy + 44);
    return top + h;
}
function hotbarLayout(){
    const n = player.inventory.hotbar.slots, w = n * SLOT + (n - 1) * SLOT_GAP;
    return { n, x: width / 2 - w / 2, y: height - SLOT - 18, w };
}
function drawHotbar(){
    const inv = player.inventory, L = hotbarLayout();
    panel(L.x - 9, L.y - 9, L.w + 18, SLOT + 18);
    for(let i = 1; i <= L.n; i++) drawSlot(L.x + (i - 1) * (SLOT + SLOT_GAP), L.y, slotRef(inv, inv.hotbarSlot(i)), { selected: GameUI.hotbar === i, number: i });
    const held = heldItem();
    if(held){
        noStroke(); fill(0, 0, 0, 150); textSize(13); textAlign(CENTER, BOTTOM);
        let label = prettify(held.id);
        const m = held.get('mining'), w = waterOf(held);
        if(m) label += `  (tier ${m.tier} ${m.classes[0]})`;
        if(w) label += `  (${w.value}/${w.capacity} water)`;
        if(held instanceof CropSeedItem) label += '  (plant on farmland)';
        text(label, width / 2 + 1, L.y - 15);
        fill(255); text(label, width / 2, L.y - 16);
    }
}

function inventoryLayout(){
    const cols = 10, rows = 4;
    const w = cols * (SLOT + SLOT_GAP) - SLOT_GAP + 28, h = rows * (SLOT + SLOT_GAP) - SLOT_GAP + 62;
    const craftW = 330, hb = hotbarLayout();
    const y = hb.y - 44 - h;   // leaves room for the held-item label above the hotbar
    const x = GameUI.station ? width / 2 - w - 8 : width / 2 - (w + 10 + craftW) / 2;
    return { x, y, w, h, cols, rows, craft: GameUI.station ? null : { x: x + w + 10, y, w: craftW, h } };
}
function drawInventory(){
    const inv = player.inventory, L = inventoryLayout();
    panel(L.x, L.y, L.w, L.h, 'Backpack');
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP);
    text('Tab to close', L.x + L.w - 14, L.y + 13);
    const slots = inv.backpackSlots;
    for(let k = 0; k < slots.length; k++){
        const cx = k % L.cols, cy = Math.floor(k / L.cols);
        drawSlot(L.x + 14 + cx * (SLOT + SLOT_GAP), L.y + 36 + cy * (SLOT + SLOT_GAP), slotRef(inv, slots[k]));
    }
    // worn armor, left of the backpack
    const gx = L.x - 72;
    panel(gx, L.y, 64, L.h);
    noStroke(); fill(200); textSize(11); textStyle(BOLD); textAlign(CENTER, TOP); text('Gear', gx + 32, L.y + 11); textStyle(NORMAL);
    const hints = { head:'head', chest:'chest', legs:'legs', feet:'feet' };
    ARMOR_SLOTS.forEach((s, k) => drawSlot(gx + 9, L.y + 30 + k * (SLOT + 4), slotRef(player.gear[s], 0), { hint: hints[s] }));
    fill('#bcd6ff'); textSize(10.5); textAlign(CENTER, BOTTOM); text(`Def ${playerDefense()}`, gx + 32, L.y + L.h - 7);
    noStroke(); fill(150); textSize(10.5); textAlign(LEFT, BOTTOM);
    const shiftHelp = openContainer() ? `Shift+click: to / from the ${GameUI.station.kind}` : 'Shift+click: hotbar <-> backpack, wear armor';
    text(`Click two slots to swap  |  Drag to move  |  ${shiftHelp}  |  Right-click: split`, L.x + 14, L.y + L.h - 7);
    if(L.craft){
        const c = L.craft;
        panel(c.x, c.y, c.w, c.h, 'Crafting (hand)');
        drawRecipeList(c.x + 10, c.y + 36, c.w - 20, c.h - 44, Recipe.for('hand'), 'hand', 'Craft', (r, shift) => craft(r, shift ? 64 : 1));
    }
}

function stationLayout(){
    const kind = GameUI.station ? GameUI.station.kind : 'workbench';
    const w = kind === 'chest' ? 8 * (SLOT + SLOT_GAP) - SLOT_GAP + 28 : 460;
    const h = kind === 'chest' ? Math.ceil(CHEST_SLOTS / 8) * (SLOT + SLOT_GAP) - SLOT_GAP + 62 : Math.min(height - 170, 560);
    const x = GameUI.inventoryOpen ? width / 2 + 8 : width / 2 - w / 2;
    return { x, y: Math.max(12, hotbarLayout().y - 44 - h), w, h };
}
function drawStation(){
    const s = GameUI.station, b = blockAt(s.x, s.y), L = stationLayout();
    if(!b) return;
    if(CRAFT_STATIONS.includes(s.kind)){
        // workbench (+ hand recipes), loom, cooking pot: recipe menus
        const verb = s.kind === 'pot' ? 'Cook' : s.kind === 'loom' ? 'Weave' : 'Craft';
        panel(L.x, L.y, L.w, L.h, STATION_TITLES[s.kind]);
        noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text('E / Esc to close  |  Shift: craft max', L.x + L.w - 14, L.y + 13);
        const list = s.kind === 'workbench' ? Recipe.for('hand', 'workbench') : Recipe.for(s.kind);
        drawRecipeList(L.x + 10, L.y + 38, L.w - 20, L.h - 48, list, 'station', verb, (r, shift) => craft(r, shift ? 64 : 1));
        return;
    }
    if(s.kind === 'chest'){
        panel(L.x, L.y, L.w, L.h, `Chest (${CHEST_SLOTS} slots)`);
        noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text('E / Esc to close', L.x + L.w - 14, L.y + 13);
        for(let k = 0; k < b.box.size; k++){
            const cx = k % 8, cy = Math.floor(k / 8);
            drawSlot(L.x + 14 + cx * (SLOT + SLOT_GAP), L.y + 36 + cy * (SLOT + SLOT_GAP), slotRef(b.box, k));
        }
        button(L.x + L.w - 120, L.y + L.h - 26, 106, 20, 'Take all', !b.box.isEmpty, () => { b.box.emptyInto(player.inventory); }, true);
        return;
    }
    // forge / cooking pot: input (4) -> fuel (1) -> output (2)
    const M = MACHINES[s.kind] || MACHINES.forge, pot = s.kind === 'pot';
    panel(L.x, L.y, L.w, L.h, STATION_TITLES[s.kind] || 'Forge');
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text('E / Esc to close', L.x + L.w - 14, L.y + 13);
    const top = L.y + 40, row = SLOT + SLOT_GAP;
    fill(200); textSize(11); textAlign(LEFT, TOP);
    text('Input', L.x + 16, top); text('Fuel', L.x + 16 + 4 * row + 14, top); text('Output', L.x + L.w - 16 - 2 * row + SLOT_GAP, top);
    for(let k = 0; k < b.input.size; k++) drawSlot(L.x + 16 + k * row, top + 16, slotRef(b.input, k), { hint: pot ? 'food' : 'ore' });
    const fx = L.x + 16 + 4 * row + 14;
    drawSlot(fx, top + 16, slotRef(b.fuel, 0), { hint:'fuel', tint: b.lit ? 'rgba(255,150,46,0.25)' : null });
    for(let k = 0; k < b.output.size; k++) drawSlot(L.x + L.w - 16 - 2 * row + SLOT_GAP + k * row, top + 16, slotRef(b.output, k));
    // progress + fuel bars
    const r = b.active ? Recipe.byId(b.active) : null, by = top + 16 + SLOT + 12, bw = L.w - 32;
    noStroke(); fill(255, 255, 255, 25); rect(L.x + 16, by, bw, 10, 5);
    fill('#ff9a2e'); rect(L.x + 16, by, bw * (r ? Math.min(1, b.progress / r.time) : 0), 10, 5);
    fill(255, 255, 255, 25); rect(L.x + 16, by + 14, bw, 5, 3);
    fill('#ffd75e'); rect(L.x + 16, by + 14, bw * (b.burnMax ? b.burn / b.burnMax : 0), 5, 3);
    const working = b.status.startsWith(M.verb);
    fill(working ? '#ffd28a' : 200); textSize(12); textAlign(LEFT, TOP);
    text(`${b.status}${r && working ? `  (${r.time.toFixed(0)}s each)` : ''}`, L.x + 16, by + 26);
    fill(150); textSize(10.5);
    text(pot ? `Cooks one dish at a time. Meat can leave grease. Fuel burns ${POT.fuelSeconds}s per unit.`
             : `Smelts one recipe at a time. Fuel burns ${FORGE.fuelSeconds}s per unit (coal 4, log 2, planks 1).`, L.x + 16, by + 44);
    fill(210); textSize(12); text(pot ? 'What the cooking pot makes (a canteen in the input = water)' : 'What the forge makes', L.x + 16, by + 66);
    drawRecipeList(L.x + 10, by + 84, L.w - 20, L.y + L.h - by - 94, Recipe.for(s.kind === 'pot' ? 'pot' : 'forge'), 'station', null, null, b.input);
}

/**
 * Scrollable recipe rows: icon, name, ingredients (green = have, red = short),
 * and a button (none when onCraft is null). `source` = where ingredients are
 * counted from (the player's inventory, or the forge's input slots).
 */
function drawRecipeList(x, y, w, h, recipes, scrollKey, verb, onCraft, source = null){
    const inv = source || player.inventory, rowH = 46;
    region(x, y, w, h, { kind:'panel', scroll: scrollKey });
    const sorted = recipes.map((r, i) => ({ r, i, ok: r.canCraft(inv) })).sort((a, b) => (b.ok - a.ok) || (a.i - b.i));
    const visible = Math.max(1, Math.floor(h / rowH));
    const maxScroll = Math.max(0, sorted.length - visible);
    GameUI.scroll[scrollKey] = Math.min(GameUI.scroll[scrollKey], maxScroll);
    const start = GameUI.scroll[scrollKey];
    for(let k = 0; k < visible && start + k < sorted.length; k++){
        const { r, ok } = sorted[start + k], ry = y + k * rowH;
        noStroke(); fill(255, 255, 255, k % 2 ? 6 : 14); rect(x, ry, w, rowH - 4, 6);
        drawItemIcon(r.output.id, x + 22, ry + rowH / 2 - 2, 32);
        region(x, ry, onCraft ? w - 80 : w, rowH - 4, { kind:'recipe', itemId: r.output.id, recipe: r, scroll: scrollKey });
        fill(ok ? 245 : 175); textSize(13); textAlign(LEFT, TOP);
        text(`${prettify(r.output.id)}${r.output.count > 1 ? ' x' + r.output.count : ''}`, x + 44, ry + 5);
        textSize(11);
        let tx = x + 44;
        const parts = Object.entries(r.inputs).map(([key, n]) => ({ t: `${n} ${Recipe.label(key)}`, ok: inv.countOf(key) >= n }));
        if(r.time) parts.push({ t: `${r.time.toFixed(0)}s`, ok: true, note: true });
        for(const p of parts){
            fill(p.note ? '#ffd28a' : p.ok ? '#8fe39a' : '#ff8a7a');
            text(p.t, tx, ry + 24);
            tx += textWidth(p.t) + 12;
        }
        if(onCraft) button(x + w - 72, ry + 9, 64, 24, verb, ok, (shift) => onCraft(r, shift), true);
    }
    if(maxScroll > 0){
        const th = h * visible / sorted.length, ty = y + (h - th) * (start / maxScroll);
        noStroke(); fill(255, 255, 255, 40); rect(x + w + 3, ty, 4, th, 2);
    }
}

function drawWheel(){
    const wl = GameUI.wheel, zone = Theaya.zone, sp = World.camera.superPosition;
    const wc = zone.toWorld(wl.x, wl.y), cx = wc.x - sp.x, cy = wc.y - sp.y;
    const opts = wl.options, n = opts.length, R = 66 + 7 * n;
    // center: what's in the cell
    const def = blockDefAt(wl.x, wl.y), g = groundAt(wl.x, wl.y);
    const title = def ? def.name : g ? g.name : '';
    textSize(12); const tw = textWidth(title) + 16;
    noStroke(); fill(18, 22, 30, 230); rect(cx - tw / 2, cy - 11, tw, 22, 11);
    fill(255); textAlign(CENTER, CENTER); text(title, cx, cy);
    opts.forEach((o, k) => {
        const a = -Math.PI / 2 + k * Math.PI * 2 / n;
        const sub = !o.enabled ? o.reason : o.warn;
        textSize(13); let w = textWidth(o.label);
        if(sub){ textSize(10.5); w = Math.max(w, textWidth((o.enabled ? '! ' : '') + sub)); }
        w += 24;
        const h = sub ? 38 : 26;
        let px = cx + R * Math.cos(a) - w / 2, py = cy + R * Math.sin(a) - h / 2;
        px = Math.max(6, Math.min(width - w - 6, px)); py = Math.max(6, Math.min(height - h - 6, py));
        const over = mouse.rawX >= px && mouse.rawX <= px + w && mouse.rawY >= py && mouse.rawY <= py + h;
        stroke(255, 255, 255, 60); strokeWeight(1.5); line(cx + 16 * Math.cos(a), cy + 16 * Math.sin(a), px + w / 2, py + h / 2);
        noStroke(); fill(over && o.enabled ? 'rgba(70,110,80,0.97)' : 'rgba(18,22,30,0.95)'); rect(px, py, w, h, 9);
        stroke(o.enabled ? (o.warn ? '#ffb347' : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.12)'); noFill(); rect(px, py, w, h, 9);
        noStroke(); fill(o.enabled ? 255 : 130); textSize(13); textAlign(CENTER, TOP); text(o.label, px + w / 2, py + 6);
        if(sub){ fill(o.enabled ? '#ffb347' : '#ff8a7a'); textSize(10.5); text((o.enabled ? '! ' : '') + sub, px + w / 2, py + 22); }
        region(px, py, w, h, { kind:'wheelOption', option: o });
    });
}

function drawToasts(){
    const now = performance.now(), hb = hotbarLayout();
    GameUI.toasts = GameUI.toasts.filter(t => t.until > now);
    let y = hb.y - 44 - (GameUI.inventoryOpen ? inventoryLayout().h + 26 : 0);
    if(GameUI.inventoryOpen) y = Math.max(140, y);
    textSize(13); textAlign(CENTER, CENTER);
    for(let k = GameUI.toasts.length - 1; k >= 0; k--){
        const t = GameUI.toasts[k], a = Math.min(1, (t.until - now) / 500), w = textWidth(t.text) + 24;
        noStroke(); fill(18, 22, 30, 210 * a); rect(width / 2 - w / 2, y - 12, w, 24, 12);
        const c = color(t.color); c.setAlpha(255 * a); fill(c); text(t.text, width / 2, y);
        y -= 28;
    }
}
/** Every control, shown on the HUD (right side) and in the pause menu. */
const CONTROLS = [
    ['Left-click', 'move there (or next to it)'],
    ['Left-click + tool', 'walk there and use it'],
    ['Right-click a cell', 'action wheel'],
    ['Left-click a creature', 'attack it'],
    ['Tab', 'inventory'],
    ['E', 'open the station next to you'],
    ['F', 'eat / drink / wear / place torch'],
    ['1-7 / wheel', 'hotbar'],
    ['Esc', 'close / cancel'],
    ['P', 'pause'],
];
function drawHelp(top = 12){
    if(!GameUI.showHelp) return;
    const lines = CONTROLS.map(([k, v]) => `${k}: ${v}`);
    textSize(11); textAlign(RIGHT, TOP); noStroke();
    lines.forEach((l, k) => { fill(0, 0, 0, 130); text(l, width - 11, top + 1 + k * 15); fill(235); text(l, width - 12, top + k * 15); });
}
/** The pause menu (P): Resume, Controls, show / hide the on-screen controls list, Restart. */
function drawPauseMenu(){
    noStroke(); fill(6, 8, 14, 165); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the menu reacts to the mouse
    const view = GameUI.pauseView, w = 320;
    const h = view === 'controls' ? 110 + CONTROLS.length * 20 : view === 'restart' ? 170 : 302;
    const x = Math.round(width / 2 - w / 2), y = Math.round(height / 2 - h / 2);
    panel(x, y, w, h);
    noStroke(); fill(255); textAlign(CENTER, TOP); textStyle(BOLD); textSize(22);
    text(view === 'controls' ? 'Controls' : view === 'restart' ? 'Restart?' : 'Paused', x + w / 2, y + 16);
    textStyle(NORMAL);
    const bx = x + 30, bw = w - 60, bh = 34;
    if(view === 'controls'){
        textSize(12);
        CONTROLS.forEach(([k, v], n) => {
            const ty = y + 56 + n * 20;
            fill('#ffd75e'); textAlign(RIGHT, TOP); text(k, x + 136, ty);
            fill(225); textAlign(LEFT, TOP); text(v, x + 148, ty);
        });
        button(bx, y + h - bh - 14, bw, bh, 'Back', true, () => { GameUI.pauseView = 'main'; }, true);
        return;
    }
    if(view === 'restart'){
        fill(215); textSize(12.5); textAlign(CENTER, TOP);
        text('Start over in a fresh copy of the world?\nEverything in this one is lost.', x + w / 2, y + 54);
        const half = (bw - 10) / 2;
        button(bx, y + h - bh - 18, half, bh, 'Cancel', true, () => { GameUI.pauseView = 'main'; }, true);
        button(bx + half + 10, y + h - bh - 18, half, bh, 'Restart', true, () => location.reload(), true);
        return;
    }
    fill(190); textSize(12); textAlign(CENTER, TOP);
    text(`${Clock.dateText()}  -  ${Clock.timeText()}  -  Day ${Math.max(1, Clock.dayIndex - Clock.startDay + 1)}`, x + w / 2, y + 48);
    let by = y + 76;
    const add = (label, fn) => { button(bx, by, bw, bh, label, true, fn, true); by += bh + 10; };
    add('Resume  (P)', () => setPaused(false));
    add('Controls', () => { GameUI.pauseView = 'controls'; });
    add(`Controls list on screen: ${GameUI.showHelp ? 'On' : 'Off'}`, () => { GameUI.showHelp = !GameUI.showHelp; });
    add('Restart', () => { GameUI.pauseView = 'restart'; });
    add('Return to Home Page', () => { window.location.href = 'index.html'; });   // the game picker
}
function itemInfoLines(item){
    const lines = [prettify(item.id)];
    const m = item.get('mining'), d = item.get('durability'), f = item.get('fuel'), c = item.get('consume'), r = item.get('resource');
    const w = waterOf(item);
    if(m) lines.push(`${prettify(m.classes[0])} - tier ${m.tier}, speed ${m.speed.toFixed(1)}`);
    if(m && m.classes.includes('hoe')) lines.push(`Tills grass into farmland, harvests tier ${m.tier} crops`);
    if(m && m.classes.includes('shovel')) lines.push('Digs dirt out of grass (left-click bare grass)');
    if(d) lines.push(`Durability ${Math.ceil(d.value)}/${d.max}`);
    if(w) lines.push(`Water ${w.value}/${w.capacity}${item instanceof Bucket ? ' (for farmland)' : ''}`);
    if(c) lines.push(`Food: +${c.hunger} hunger, +${c.saturation} saturation${c.health ? `, +${c.health} health` : ''}`);
    if(item instanceof CropSeedItem){
        const crop = Crops.get(item.crop);
        if(crop) lines.push(`Ripe after ${crop.ripeAge} days on watered farmland`, crop.tier > 0 ? `Harvest needs a tier ${crop.tier}+ hoe` : 'Harvest by hand');
    }
    if(Crops.get(item.id) && !c) lines.push(item.id === 'hemp' ? 'Spin it into cloth on the loom' : 'Cook it in the cooking pot');
    const pz = item.get('poisonous'), atk = item.get('attack'), L = item.get('launcher'), ammo = item.get('ammoStats');
    if(pz) lines.push(`Raw: ${Math.round(pz.chance * 100)}% chance of poison. Cook it in the cooking pot.`);
    const rg = item.get('regeneration');
    if(rg) lines.push(`Regenerates +${rg.rate} health/s for ${rg.seconds}s`);
    if(item.id === 'grease') lines.push('From cooking meat. Makes grease torches, oil lamps', 'and better food in the cooking pot.');
    if(isCookable(item) && !waterOf(item)) lines.push('Can go in the cooking pot');
    if(L) lines.push(`Ranged: ${L.range} cells, x${L.power} arrow damage, ${L.cooldown}s per shot`);
    else if(atk && item.hasTag('weapon')) lines.push(`Melee: ${atk.damage} damage, reach 1 cell`);
    if(ammo) lines.push(`Arrow: ${ammo.damage} damage`);
    if(item.getDefense && armorSlotOf(item)) lines.push(`Armor (${armorSlotOf(item)}): ${item.getDefense()} defense - shift-click to wear`);
    if(item instanceof BlockItem){
        const bd = Blocks.get(item.block);
        lines.push(bd && bd.passableFor && bd.passableFor.includes('player') ? 'Placeable: only you can walk through it'
                 : bd && !bd.solid ? 'Placeable: you can walk over it' : 'Placeable block');
        if(bd && bd.safe) lines.push(`Lights the dark; no monsters spawn within ${bd.safe} cells`, 'F: place it where you stand');
        if(bd && bd.siege) lines.push(`Monsters can break it (zombie ${CREATURES.zombie.breaks[bd.siege]}s, orc ${CREATURES.orc.breaks[bd.siege]}s)`);
    }
    if(r && r.material) lines.push(`Material: ${prettify(r.material)} (tier ${r.tier})`);
    if(f) lines.push(`Fuel: ${f.ticks} (${f.ticks * FORGE.fuelSeconds}s in the forge)`);
    if(isSmeltable(item)) lines.push('Can go in the forge');
    if(item.count > 1) lines.push(`x${item.count}`);
    return lines;
}
/** Next to the cursor: what a left click does with the held tool (when it does something). */
function drawQuickHint(){
    if(GameUI.wheel || (GameUI.press && GameUI.press.dragging) || uiHit(mouse.rawX, mouse.rawY)) return;
    const c = areaZones.home.toCell(mouse.x, mouse.y), q = c ? quickActionFor(c.x, c.y, mouse.x, mouse.y) : null;
    if(!q) return;
    const t = q.reason ? `${q.label}: ${q.reason}` : q.label;
    textSize(11.5); const w = textWidth(t) + 14;
    const x = Math.min(width - w - 6, mouse.rawX + 16), y = mouse.rawY + 14;
    noStroke(); fill(10, 12, 18, 215); rect(x, y, w, 20, 6);
    fill(q.reason ? '#ff8a7a' : '#ffd75e'); textAlign(LEFT, CENTER); text(t, x + 7, y + 10);
}
function drawTooltip(){
    if(GameUI.press && GameUI.press.dragging) return;
    const hit = uiHit(mouse.rawX, mouse.rawY);
    let lines = null;
    if(hit && hit.kind === 'slot' && refItem(hit.ref)) lines = itemInfoLines(refItem(hit.ref));
    else if(hit && hit.kind === 'recipe') lines = itemInfoLines(Items.create(hit.itemId));
    if(!lines) return;
    textSize(12);
    const w = Math.max(...lines.map(l => textWidth(l))) + 20, h = lines.length * 16 + 10;
    const x = Math.min(width - w - 6, mouse.rawX + 14), y = Math.max(6, mouse.rawY - h - 8);
    noStroke(); fill(10, 12, 18, 240); rect(x, y, w, h, 6);
    textAlign(LEFT, TOP);
    lines.forEach((l, k) => { fill(k === 0 ? '#ffd75e' : 220); text(l, x + 10, y + 6 + k * 16); });
}

const hudLayer = {
    id: 'theaya_hud', isUI: true, scenes: [SCENE_ID], layer: 1000, _order: 1e9, deleted: false, tags: [],
    render(){
        if(!Theaya.ready) return;
        push();
        resetMatrix();
        resetDrawModes();
        GameUI.regions = [];
        textFont('sans-serif');
        drawStats();
        drawHotbar();
        if(GameUI.inventoryOpen) drawInventory();
        if(GameUI.station) drawStation();
        if(GameUI.wheel) drawWheel();
        drawToasts();
        const clockBottom = drawClock();
        drawHelp((GameUI.calendar ? drawCalendar(clockBottom + 6) : clockBottom) + 10);
        if(GameUI.press && GameUI.press.dragging && refItem(GameUI.press.ref)){
            drawItemIcon(refItem(GameUI.press.ref), mouse.rawX, mouse.rawY, SLOT * 0.85);
        }
        if(GameUI.paused) drawPauseMenu();
        else { drawQuickHint(); drawTooltip(); }
        pop();
    },
};
theayaScene.addObject(hudLayer);


/* ---------------------------------------------------------------------
 * 13. Scene
 * --------------------------------------------------------------------- */
const regen = new Skill('regen', true,
    //active every tick, so divide by total ticks to have 1 health per second
    (self, tg) => { tg.health += 1*world.tickRate/1000; },
    (self, tg) => tg.health < tg.maxHealth,
    0, 'mana', 1, null, 0, 1);        // cooldown 10 ticks
const me = { health: 5, maxHealth: 8 };
regen.activate(me);                     // "me" owns it and it is now on
// call regen.tick() once per game tick:
// health: 6 on the 1st tick, 7 on the 11th, 8 on the 21st, then it stops (the condition is false)

Scene.setScene(SCENE_ID);
Theaya.ready = true;
