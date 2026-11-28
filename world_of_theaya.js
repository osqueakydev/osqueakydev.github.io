var world;
function setup(){
    world = new World(20);
    world.whenHidden = 'pause';      // tab switched / browser minimized: 'run' keeps the game going, 'pause' freezes it
    world.whenUnfocused = 'pause';   // another program focused, game still showing: 'run' or 'pause'
    // clicking off the game (or switching tabs) opens the pause menu, so it stays paused when you come back
    world.onFocusLost = world.onHidden = pauseOnLeave;
    world.camera.link(player);   // the World of Theaya game is set up further down this file
    // Languages: every on-screen text is in THEAYA_TEXT (world_of_theaya_text.js), see section 0
    world.setSupportedLanguages(LANGUAGES.map(l => l.id));
    world.addDialog(THEAYA_TEXT);
    if(Settings.data.language) world.setLanguage(Settings.data.language);   // the player's choice (Settings), else the browser's language
    // Controls: every action's default bind goes through the engine (world.defineBinds), then the player's
    // saved changes go on top. See THEAYA_BINDS / Binds (section 11, "Controls").
    Binds.install(world);
}

/* ---------------------------------------------------------------------
 * 0. Text + language
 *   All on-screen text lives in world_of_theaya_text.js:
 *     THEAYA_TEXT   key -> { english, japanese }   ({name} placeholders get filled in)
 *     THEAYA_NAMES  element / biome / weather id -> { english?, japanese }
 *     THEAYA_WORDS  word -> japanese, for names built from ids ('iron_pickaxe' -> 鉄のツルハシ)
 *   T(key, vars)  the text in the current language (World language system: world.getText)
 *   nameOf(id)    the display name of an item, block, creature, skill, biome, weather...
 *   The language is chosen in Settings (pause menu > Settings) and saved in localStorage.
 *   To add a language: add it to LANGUAGES and give every THEAYA_TEXT entry that key.
 * --------------------------------------------------------------------- */
const LANGUAGES = [
    { id:'english',  label:'English' },
    { id:'japanese', label:'日本語' },
    { id:'dutch',    label:'Nederlands' },
];
/** The current language id ('english' | 'japanese'). */
function currentLanguage(){
    if(World.active) return World.active.language;
    const saved = Settings.data.language;
    return LANGUAGES.some(l => l.id === saved) ? saved : 'english';
}
const _missingText = new Set();
/** On-screen text by key, in the current language: T('inv.full'), T('farm.planted', { crop, n }). */
function T(key, vars){
    const w = World.active;
    if(w && w.dialog && w.dialog[key]) return w.getText(key, vars);
    const e = THEAYA_TEXT[key];
    if(e == null){
        if(!_missingText.has(key)){ _missingText.add(key); console.warn(`T: no text for '${key}' (add it to world_of_theaya_text.js)`); }
        return World._fillText(String(key), vars);
    }
    return World._fillText(String(e[currentLanguage()] ?? e.english ?? ''), vars);
}
/** English names that aren't just the prettified id ('hydration' -> 'Well Hydrated'), filled in by the element definitions. */
const ENGLISH_NAMES = {};
/** Japanese words for the parts of generated ids; see nameOf. */
function _jaWord(w){ const v = THEAYA_WORDS[w]; return v == null ? prettify(w) : v; }
/**
 * Dutch name of an id: THEAYA_NAMES[id].dutch, else built from THEAYA_WORDS_NL like the English one is built
 * from the id: '<material>_<thing>' -> 'IJzeren houweel', 'raw_<metal>' -> 'Ruw ijzer', '<metal>_ore' -> 'IJzererts',
 * 'wild_<crop>' -> 'Wilde tarwe', '<crop>_seeds' -> 'Tarwezaden'. Anything it can't build keeps its English name.
 */
function _dutchName(id, fixed){
    const cap = s => s.startsWith('ij') ? 'IJ' + s.slice(2) : s.charAt(0).toUpperCase() + s.slice(1);   // IJzer, not Ijzer
    if(fixed && fixed.dutch) return fixed.dutch;
    const W = typeof THEAYA_WORDS_NL === 'undefined' ? null : THEAYA_WORDS_NL;
    const english = () => (fixed && fixed.english) || ENGLISH_NAMES[id] || prettify(id);
    if(!W) return english();
    const noun = k => W.noun[k] ?? W.thing[k] ?? null;
    if(W.noun[id] || W.thing[id]) return cap(W.noun[id] || W.thing[id]);   // a bare material / crop / thing: 'onion', 'planks'
    const parts = id.split('_');
    if(parts[0] === 'raw' && W.noun[parts.slice(1).join('_')] && materialList[parts.slice(1).join('_')]) return `Ruw ${W.noun[parts.slice(1).join('_')]}`;
    for(let k = parts.length - 1; k >= 1; k--){
        const head = parts.slice(0, k).join('_'), tail = parts.slice(k).join('_');
        if(tail === 'seeds' && W.noun[head]) return cap(`${W.noun[head]}zaden`);
        if(tail === 'ore' && W.noun[head]) return cap(`${W.noun[head]}erts`);
        if(tail === 'ore_heart' && W.noun[head]) return cap(`${W.noun[head]}-ertskern`);
        if(W.adj[head] == null) continue;
        const t = THEAYA_NAMES[tail] && THEAYA_NAMES[tail].dutch ? THEAYA_NAMES[tail].dutch.toLowerCase() : noun(tail);
        if(t) return cap(`${W.adj[head]} ${t}`);
    }
    return english();
}
/**
 * Display name of any id (item, block, creature, skill, biome, weather, season, month...).
 * English: its defined name, else the prettified id. Japanese: THEAYA_NAMES, else built from
 * THEAYA_WORDS: '<material>_<thing>' -> '<material>の<thing>', 'raw_<metal>' -> '<metal>の原石',
 * '<metal>_ore' -> '<metal>鉱石', 'wild_<crop>' -> '野生の<crop>', '<crop>_seeds' -> '<crop>の種'.
 */
function nameOf(id){
    if(id == null) return '';
    id = String(id);
    const fixed = THEAYA_NAMES[id];
    if(currentLanguage() === 'english') return (fixed && fixed.english) || ENGLISH_NAMES[id] || prettify(id);
    if(currentLanguage() === 'dutch') return _dutchName(id, fixed);
    if(fixed && fixed.japanese) return fixed.japanese;
    if(THEAYA_WORDS[id] != null) return THEAYA_WORDS[id];   // a whole word, even with an underscore ('sugar_cane')
    const parts = id.split('_');
    if(parts.length === 1) return _jaWord(id);
    if(parts[0] === 'raw' && THEAYA_WORDS[parts.slice(1).join('_')] && materialList[parts.slice(1).join('_')]) return `${_jaWord(parts.slice(1).join('_'))}の原石`;
    // the longest known first part (materials like galvanized_steel are two words)
    for(let k = parts.length - 1; k >= 1; k--){
        const head = parts.slice(0, k).join('_'), tail = parts.slice(k).join('_');
        if(THEAYA_WORDS[head] == null) continue;
        if(tail === 'ore') return `${_jaWord(head)}鉱石`;
        if(tail === 'ore_heart') return `${_jaWord(head)}の鉱脈核`;
        return `${_jaWord(head)}の${THEAYA_NAMES[tail] && THEAYA_NAMES[tail].japanese || (THEAYA_WORDS[tail] != null ? THEAYA_WORDS[tail] : parts.slice(k).map(_jaWord).join(''))}`;
    }
    return parts.map(_jaWord).join('');
}
/**
 * A station's text (verb, idle, hint, blurb, listTitle): THEAYA_TEXT 'station.<station>.<field>' when the
 * game has one, else `own` (a spec's own text, for added stations), else the generic key.
 */
function stationText(station, field, own, genericKey, vars){
    const k = `station.${station}.${field}`;
    if(THEAYA_TEXT[k]) return T(k, vars);
    if(own != null) return World._fillText(String(own), vars);
    return genericKey ? T(genericKey, vars) : '';
}
/** Turns a definition's `name` into a getter that follows the language (custom English names are kept in ENGLISH_NAMES). */
function translatedName(obj, id){
    const en = obj.name;
    if(en && en !== prettify(id) && !ENGLISH_NAMES[id]) ENGLISH_NAMES[id] = en;
    Object.defineProperty(obj, 'name', { get: () => nameOf(id), set(v){ ENGLISH_NAMES[id] = v; }, enumerable: true, configurable: true });
    return obj;
}

/**
 * Searching names (the crafting menus' search bar): NameSearch.matcher(query) -> (id) => true/false.
 * The name or the id contains the query as text, in every language. In Japanese the readings are
 * compared too: the name and the query are both turned into romaji (Hepburn), so 斧, おの, オノ and
 * "ono" all find 鉄の斧. Kanji are read with THEAYA_READINGS (world_of_theaya_text.js); typed romaji
 * is turned into kana the way an IME does it first ("nn" = ん, "kk" = っ, "-" = ー), so si / shi,
 * tu / tsu, zi / ji... all work, and kanji typed in the query are read too (鉄のおの). A second,
 * looser comparison ignores long vowels and doubled letters ("butsu" finds ブーツ, "ninniku" ニンニク).
 */
const NameSearch = (() => {
    const VOWEL = { a:1, i:1, u:1, e:1, o:1 }, CONSONANT = /[bcdfghjklmpqrstvwxyz]/, MAX_FORMS = 16;
    // kana -> romaji (Hepburn)
    const ROMAJI = {};
    for(const p of ('あa いi うu えe おo かka きki くku けke こko さsa しshi すsu せse そso たta ちchi つtsu てte とto '
        + 'なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro '
        + 'わwa ゐi ゑe をwo んn がga ぎgi ぐgu げge ごgo ざza じji ずzu ぜze ぞzo だda ぢji づzu でde どdo '
        + 'ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo ゔvu ぁa ぃi ぅu ぇe ぉo ゃya ゅyu ょyo ゎwa ゕka ゖke').split(' '))
        ROMAJI[p[0]] = p.slice(1);
    // two kana read together that don't follow the き + ゃ = kya rule
    const PAIRS = { 'ふぁ':'fa', 'ふぃ':'fi', 'ふぇ':'fe', 'ふぉ':'fo', 'うぃ':'wi', 'うぇ':'we', 'しぇ':'she', 'ちぇ':'che', 'じぇ':'je',
        'てぃ':'thi', 'でぃ':'dhi', 'でゅ':'dhu', 'ゔぁ':'va', 'ゔぃ':'vi', 'ゔぇ':'ve', 'ゔぉ':'vo', 'つぁ':'tsa' };

    /** Katakana -> hiragana; also full-width letters and half-width kana -> normal ones, and lower case. */
    function hiragana(s){
        return String(s).normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    }
    /** Hiragana -> romaji. Anything else (letters, kanji) is kept as it is. */
    function toRomaji(s){
        let out = '', sokuon = false;
        const put = r => { if(sokuon && CONSONANT.test(r[0])) out += r[0]; sokuon = false; out += r; };   // っ doubles the next consonant
        for(let i = 0; i < s.length; i++){
            const c = s[i], small = s[i + 1] || '';
            if(c === 'っ'){ sokuon = true; continue; }
            if(c === 'ー'){ const v = out[out.length - 1]; if(VOWEL[v]) out += v; continue; }   // long vowel: say it twice
            if(PAIRS[c + small]){ put(PAIRS[c + small]); i++; continue; }
            const r = ROMAJI[c];
            if(r == null){ put(c); continue; }
            if(r.length > 1 && r.endsWith('i') && small && 'ゃゅょ'.includes(small)){   // きゃ kya, しゃ sha, じゃ ja
                const base = r.slice(0, -1), v = ROMAJI[small][1];
                put(/(sh|ch|j)$/.test(base) ? base + v : base + 'y' + v); i++; continue;
            }
            put(r);
        }
        return out;
    }
    // romaji -> kana, with the other common spellings an IME accepts
    const KANA = {};
    for(const [k, r] of Object.entries(ROMAJI)) if(!'ゐゑぢづんぁぃぅぇぉゃゅょゎゕゖ'.includes(k) && KANA[r] == null) KANA[r] = k;
    for(const b of 'きしちにひみりぎじびぴぢ') for(const s of 'ゃゅょ') KANA[toRomaji(b + s)] = b + s;
    for(const [k, r] of Object.entries(PAIRS)) KANA[r] = k;
    'ぁぃぅぇぉ'.split('').forEach((k, i) => { KANA['x' + 'aiueo'[i]] = KANA['l' + 'aiueo'[i]] = k; });
    Object.assign(KANA, { si:'し', ti:'ち', tu:'つ', hu:'ふ', zi:'じ', di:'ぢ', du:'づ', ca:'か', cu:'く', co:'こ',
        sya:'しゃ', syu:'しゅ', syo:'しょ', sye:'しぇ', tya:'ちゃ', tyu:'ちゅ', tyo:'ちょ', tye:'ちぇ', cya:'ちゃ', cyu:'ちゅ', cyo:'ちょ',
        zya:'じゃ', zyu:'じゅ', zyo:'じょ', zye:'じぇ', jya:'じゃ', jyu:'じゅ', jyo:'じょ', dya:'ぢゃ', dyu:'ぢゅ', dyo:'ぢょ',
        xtu:'っ', ltu:'っ', xtsu:'っ', ltsu:'っ', xya:'ゃ', lya:'ゃ', xyu:'ゅ', lyu:'ゅ', xyo:'ょ', lyo:'ょ', xwa:'ゎ', lwa:'ゎ', '-':'ー' });
    /** Typed romaji -> hiragana, like an IME. An unfinished syllable at the end ("on" -> おn) stays as letters. */
    function romajiToKana(s){
        let out = '';
        for(let i = 0; i < s.length;){
            const c = s[i], n = s[i + 1];
            if(c === 'n' && n !== undefined && !VOWEL[n] && n !== 'y'){ out += 'ん'; i += (n === 'n' || n === "'") ? 2 : 1; continue; }
            if(CONSONANT.test(c) && (n === c || (c === 't' && n === 'c' && s[i + 2] === 'h'))){ out += 'っ'; i++; continue; }
            let len = 4;
            for(; len >= 1; len--){ const part = s.slice(i, i + len); if(part.length === len && KANA[part] != null) break; }
            if(len >= 1){ out += KANA[s.slice(i, i + len)]; i += len; }
            else { out += c; i++; }
        }
        return out;
    }
    // THEAYA_READINGS with its keys through hiragana(), so メッキ and めっき are the same word
    let index = null, longest = 1;
    function readingIndex(){
        if(index) return index;
        index = new Map();
        for(const [word, r] of Object.entries(typeof THEAYA_READINGS === 'undefined' ? {} : THEAYA_READINGS)){
            const k = hiragana(word);
            index.set(k, (Array.isArray(r) ? r : [r]).map(hiragana));
            longest = Math.max(longest, k.length);
        }
        return index;
    }
    /** The ways to read `text` (already through hiragana()): at each spot the longest THEAYA_READINGS word that fits. */
    function readings(text){
        const idx = readingIndex();
        let forms = [''];
        for(let i = 0; i < text.length;){
            let len = Math.min(longest, text.length - i);
            while(len >= 1 && !idx.has(text.substr(i, len))) len--;
            const alts = len >= 1 ? idx.get(text.substr(i, len)) : [text[i]], next = [];
            for(const f of forms) for(const a of alts) if(next.length < MAX_FORMS) next.push(f + a);
            forms = next; i += Math.max(1, len);
        }
        return forms;
    }
    /** The looser form: no long vowels (ou, ei, doubled vowels) and no doubled consonants. */
    function loose(r){
        const single = s => s.replace(/([a-z])\1+/g, '$1');
        return single(single(r.replace(/tch/g, 'ch')).replace(/ou/g, 'o').replace(/ei/g, 'e'));
    }
    const cache = new Map(), warned = new Set();
    /** An id's name and its readings in romaji, cached until the name changes (a new language). */
    function keysOf(id){
        const name = nameOf(id);
        let e = cache.get(id);
        if(e && e.name === name) return e;
        const forms = readings(hiragana(name));
        const unread = forms[0].match(/[㐀-鿿豈-﫿々]+/g);
        if(unread && !warned.has(name)){
            warned.add(name);
            console.warn(`NameSearch: no reading for ${unread.join(', ')} in '${name}' (add it to THEAYA_READINGS in world_of_theaya_text.js)`);
        }
        const romaji = forms.map(f => toRomaji(f).replace(/\s+/g, ''));
        e = { name, romaji, loose: romaji.map(loose) };
        cache.set(id, e);
        return e;
    }
    /** (id) => does it match `query`? An empty query matches everything. */
    function matcher(query){
        const raw = String(query == null ? '' : query).trim().toLowerCase();
        if(!raw) return () => true;
        const asText = id => nameOf(id).toLowerCase().includes(raw) || String(id).replace(/_/g, ' ').toLowerCase().includes(raw);
        if(currentLanguage() !== 'japanese') return asText;
        const forms = readings(romajiToKana(hiragana(raw).replace(/\s+/g, ''))).map(toRomaji);
        const looseForms = forms.map(loose).filter(Boolean);
        return id => {
            if(asText(id)) return true;
            const k = keysOf(id);
            return forms.some(q => k.romaji.some(r => r.includes(q))) || looseForms.some(q => k.loose.some(r => r.includes(q)));
        };
    }
    return { matcher, keysOf, hiragana, toRomaji, romajiToKana, readings };
})();

/** Player settings (pause menu > Settings), kept between visits (the page reloads for a new game). */
const Settings = {
    storageKey: 'theaya.settings',
    data: { language: null, doubleClickMs: 130, cursorSpeed: 900, difficulty: 'normal' },   // doubleClickMs: see DoubleClick (0 = off); cursorSpeed: see Pad; difficulty: see Difficulty
    doubleClickRange: { min: 0, max: 500, step: 10 },
    cursorSpeedRange: { min: 200, max: 2000, step: 50 },   // the controller's cursor at full tilt, px per second
    cursorSpeed(){ const R = this.cursorSpeedRange, v = Number(this.data.cursorSpeed); return Number.isFinite(v) ? Math.max(R.min, Math.min(R.max, v)) : 900; },
    load(){ try{ Object.assign(this.data, JSON.parse(localStorage.getItem(this.storageKey) || '{}')); } catch(e){ /* private mode / file:// without storage */ } },
    save(){ try{ localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch(e){} },
    setLanguage(id){
        this.data.language = id;
        this.save();
        if(World.active) World.active.setLanguage(id);
        if(typeof Theaya !== 'undefined' && Theaya) Theaya.fullRedraw = true;   // the map has a few drawn labels
    },
};
Settings.load();

/**
 * Difficulty (pause menu > Settings > Difficulty, saved as Settings.data.difficulty and in every save game).
 * Lower levels soften the bad sides of the game and make the good ones more likely; higher ones do the opposite.
 * Each level is a table of multipliers (1 = normal):
 *   hunger, thirst   how fast they drain (tickSurvival)
 *   damage           damage you take from creatures / lightning (damagePlayer)
 *   regen            your natural health regeneration
 *   spawns           hostile spawns: tries per second, caps (night, cave, orcs) and the orc chance (Mobs.spawnHostiles)
 *   aiShift          a creature's AI odds (Mobs.rollAi): < 0 moves that share of each level's weight one level down
 *                    (genius -> smart -> dumb), > 0 one level up
 *   luck             chance rolls that help you: drops, camp loot, a creature's gear (Difficulty.luck: 1 - (1 - c)^luck,
 *                    so rare drops gain the most and nothing passes 100%)
 *   bad              chance rolls that hurt you: food poisoning, storms and droughts (Difficulty.bad: c x bad)
 *   camps            how many hostile structures (spec `hostile: true`, goblin camps) a new world gets
 *   enemyRespawn     how long hostile structures and their creatures take to come back (x days / seconds)
 * The difficulty can be changed at any time; creatures already in the world keep the AI they were born with.
 */
const DIFFICULTY = {
    easy:   { hunger: 0.6,  thirst: 0.6,  damage: 0.6,  regen: 1.4, spawns: 0.6, aiShift: -0.5, luck: 1.6, bad: 0.5,  camps: 0.6, enemyRespawn: 1.6 },
    normal: { hunger: 1,    thirst: 1,    damage: 1,    regen: 1,   spawns: 1,   aiShift: 0,    luck: 1,   bad: 1,    camps: 1,   enemyRespawn: 1 },
    hard:   { hunger: 1.25, thirst: 1.25, damage: 1.3,  regen: 0.8, spawns: 1.3, aiShift: 0.3,  luck: 0.8, bad: 1.3,  camps: 1.3, enemyRespawn: 0.75 },
    brutal: { hunger: 1.5,  thirst: 1.5,  damage: 1.6,  regen: 0.6, spawns: 1.6, aiShift: 0.5,  luck: 0.65, bad: 1.6, camps: 1.6, enemyRespawn: 0.5 },
};
const Difficulty = {
    levels: Object.keys(DIFFICULTY),
    get id(){ const d = Settings.data.difficulty; return DIFFICULTY[d] ? d : 'normal'; },
    /** A multiplier of the current level (see DIFFICULTY). */
    mult(key){ const v = DIFFICULTY[this.id][key]; return Number.isFinite(v) ? v : (key === 'aiShift' ? 0 : 1); },
    /** A good chance (0..1) at this difficulty. */
    luck(c){ c = Number(c) || 0; return c <= 0 || c >= 1 ? c : 1 - Math.pow(1 - c, this.mult('luck')); },
    /** A bad chance (0..1) at this difficulty. */
    bad(c){ c = Number(c) || 0; return c <= 0 ? c : Math.min(1, c * this.mult('bad')); },
    /** AI odds ({ dumb, smart, genius } weights) shifted by aiShift. levels = the AI levels, lowest first. */
    shiftAi(odds, levels){
        const s = this.mult('aiShift'), w = levels.map(k => Math.max(0, Number(odds[k]) || 0)), out = w.slice();
        if(s < 0) for(let k = 1; k < w.length; k++){ const mv = w[k] * -s; out[k] -= mv; out[k - 1] += mv; }
        if(s > 0) for(let k = 0; k < w.length - 1; k++){ const mv = w[k] * s; out[k] -= mv; out[k + 1] += mv; }
        return Object.fromEntries(levels.map((k, i) => [k, out[i]]));
    },
    /** Pick a level (save = remember it between visits; a loaded save sets its own without a message). */
    set(id, save = true, quiet = false){
        if(!DIFFICULTY[id]) return;
        const was = this.id;
        Settings.data.difficulty = id;
        if(save) Settings.save();
        if(!quiet && was !== id && typeof notify === 'function') notify(T('notify.difficulty', { name: T('difficulty.' + id) }), '#ffd75e');
    },
};




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
        shade:true,          //the clouds hide the sun: creatures of the dark (zombies) don't burn and can come out of their caves
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
        shade:true,
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





//advenced game element definition
const __customDefine = {
    name:'',//<display name of element>
    id:'',//<back end element ID>
    type:'',//<type of game element> [item, block, food/consumable, terrian, crop, creature, workbench, container]
    //for elements that can be placed in inventory
    stack:100,
    //any item/block or resource that can be in the inventory
    tags:[], //craft/workbench tags
    texture:'', //can be an array
    //for elements that are blocks or terrian (terrian is a block that can spawn naturally)
        tier:1, //tier tool needed to break, tier of -1 is unbreakable
        tool:'axe', //type of tool needed
        //drop:'self', //self -> drops itself as an item
        //drop: <item id> -> drops that item
        //list of items to drop given item id and chance to drop
        drop: [
            
            {
                id:'', //item id
                chance:0.5, //drop chance
                linked:true, //links this chance to another with the linked property, cant drop multiple items at once
                priority:1, //in the chance that both chances are true at the same time, choose the one with higher priority
                /*
                    Example:
                    what the current gravel drop model would look like in this system:
                    drop:[
                        {
                            id:'self',
                            chance:1,
                            linked:true,
                            priority:0,
                        },
                        {
                            id:'flint',
                            chance:0.5,
                            amount:[1,2], 
                            linked:true,
                            priority:1,
                        }
                    ]
                */
            },
            {
                id:'',
                chance:0.25,
                amount:[1,2],
            }
        ],
    //for elements that are terrian (pairs with the block)
        biome:'all', //what biome this terrian block belongs to
        textureType:'', //how its rendered: floor (what grass is), tree, block, crop, hill (hill refers to how sand dunes are displayed)
        emitLight:0, //amount of light that it emits
        cellBehavior:'', //behaviors are: empty, passable, entityPass, blocked;
        /*
            empty = cell is free and there isn't a block
            passable = cell has block but player can pass through 
            entityPass = cell has block but player cant pass through
            blocked = cell has block, nothing can pass
        */
    //include texture color properties to be able to set the color texture of the game element
    texture:'', //optional image path (or { src, states, canopy, scale, ... }, see "3a. Textures"); leave it out to keep the built-in look

    //food
        hunger:0,
        satruation:0,
        regen:[1,10], //amount, time in seconds
        instantHealth:0, //health granted on consumtion
        poison:{
            chance:0, //percent
            apply:[1,5], //damage, time in seconds
        },
    //crop
        require:'farmland', //type of block/cell it requires to be planted
        //other valid require inputs: none, water (for rice)
        thirst:0, //amount of water units consumed per in game day
        growth:{
            stages:[
                { yeild: 0, time: 1},
                { yeild: 1, time: 2, done: true },
                { yeild: 0, time: 3, rot: true },
                {
                    yeild:0,
                    time: 4,
                    clear:true, //auto clear the rotted crop
                }
            ],
        },
        crop:'', //item id for when crop is harvested

    //creature (uses already existing object defining properties)
        health:100,
        hp:60, 
        speed:2.0, 
        size:20, 
        mover:'animal', 
        behaviour:'hostile', //behavoirs: passive, hostile, neutral; neutral means that the creature will fight back if provoked
        sight:4, 
        damage:14, 
        cooldown:1.8, 
        color:'#5a3e2b', 
        biomes:['forest'], 
        count:4, 
        xp:60, 
        drops:[
            {
                id:'raw_bear_meat',
                chance:1,
                amount:[1,2]
            },
            {
                id:'raw_leather',
                chance:0.5,
                amount:[2,3],
                //can have 'linked' modifier
            },
        ],
        actions:{
            // example action to add to the cell action menu for milking a cow
            // milk:{
            //     display:"Milk @animal", //@ refers to the source of this action, in this example the cow
            //     require:'item',
            //     id:'bucket',
            //     result:'item',
            //     id:'milk_bucket',
            // },
        },
    //container (for chests basically, or workbenches with container slots)
        //slots:20, for normal chest
        slots:{
            input:4,
            output:2,
            //fuel: 1
        },
    
    //workbench
        workbenchTag:'', //workbench
        recipes:[
            {
                input:{
                    //item_id: amount required
                    cloth:2,
                },
                /*
                fuel:10, //time to cook/smelt (for workbenches with container machanics)
                */
                output:{
                    //item_id: amount given
                    silk:1,
                },
            }
        ], //recipe objects
}


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
            hardness:0.05,
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
      increases movement speed+
      decrease hunger from moving-
    
    Steel Stomach
      decrease poison duration and damage
      decreases hunger decay

    Hunter
      can sneak by holding "shift"
      makes player less detectable and noticable to other entities
    
    
    
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
const WORLD_SEED      = 5201314;      // the menu's backdrop world, and the tutorial world
/**
 * Saved games: .malengine files (male/MALEngine_Encryption.js), see section 12c.
 *   key      seals every save file. A file only opens with the key it was made with, so changing the key
 *            makes all older saves unreadable. (It has to be in the game's code, so it stops edited
 *            files, not someone who reads this code.)
 *   version  the layout of the save data (SaveGame.capture). A save with a newer layout is refused.
 *
 * Game version (GAME_VERSION, 'major.minor.patch'): every save is stamped with it (data.gameVersion).
 *   - A save from the same major.minor (0.5.x) always loads. One from an older patch is brought up to date
 *     first: SAVE_PATCHES[x] runs for every patch x after the save's, in order (SaveVersion.upgrade), so a
 *     small change to the save's contents (a new field, a renamed one) only needs a patch number and its fix.
 *   - A save from a newer version is refused ('newer'), and one from an older major.minor too ('older').
 *   - Saves made before the stamp count as SaveVersion.LEGACY (0.5.0).
 *   To ship a small change: bump the patch in GAME_VERSION and, when old saves need fixing up, add
 *   SAVE_PATCHES[<new patch>] = data => { ...edit data in place... }.
 */
const GAME_VERSION = '0.5.2';
/** Save fix-ups by patch number: SAVE_PATCHES[x] turns a 0.5.(x-1) save into a 0.5.x one (edits `data` in place). */
const SAVE_PATCHES = {
    // 0.5.1: structures are saved as { list, gone } (gone = when each type ran out, so goblin camps can come back)
    1: data => { if(Array.isArray(data.structures) || data.structures == null) data.structures = { list: data.structures ?? [], gone: {} }; },
    // 0.5.2: saves carry their difficulty (see Difficulty); every older world was played on normal
    2: data => { if(data.difficulty == null) data.difficulty = 'normal'; },
};
const SaveVersion = {
    LEGACY: '0.5.0',
    /** 'a.b.c' -> [a, b, c], or null when it isn't a version. */
    parse(v){ const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(typeof v === 'string' ? v.trim() : ''); return m ? m.slice(1).map(Number) : null; },
    /** The version a save was made with (LEGACY when it has no stamp), or null when its stamp is broken. */
    of(data){ return data.gameVersion == null ? this.parse(this.LEGACY) : this.parse(data.gameVersion); },
    /** null when this game can load it, else 'newer' | 'older' | 'damaged'. */
    problem(data){
        const v = this.of(data), g = this.parse(GAME_VERSION);
        if(!v) return 'damaged';
        for(let k = 0; k < 3; k++){
            if(v[k] > g[k]) return 'newer';
            if(v[k] < g[k]) return k < 2 ? 'older' : null;   // an older patch is fine: upgrade() brings it up to date
        }
        return null;
    },
    /** Runs the patches the save is missing and stamps it with this version. Returns the version it was made with. */
    upgrade(data){
        const from = this.of(data), to = this.parse(GAME_VERSION), was = from.join('.');
        for(let x = from[2] + 1; x <= to[2]; x++) if(SAVE_PATCHES[x]) SAVE_PATCHES[x](data);
        data.gameVersion = GAME_VERSION;
        return was;
    },
};
const SAVE_FILE = {
    game: 'world_of_theaya',
    key: 'World of Theaya :: MALE save seal :: 7c1e9a52-f04b-4d3e-a8b6-3e9d21c7f5a0',
    type: 'world_of_theaya.save',
    version: 1,
    maxBytes: 32 * 1024 * 1024,     // anything bigger isn't one of our saves
    stashKey: 'theaya.load',        // sessionStorage: the file being loaded, while the page reloads into '#load'
};
const saveOpts = () => ({ key: SAVE_FILE.key, type: SAVE_FILE.type, maxBytes: SAVE_FILE.maxBytes });
/** A failed load (MALEncryptionError or any error) -> the code of its 'load.err.<code>' text. */
function saveErrorCode(e){
    const codes = { not_malengine:'notSave', wrong_type:'wrongGame', tampered:'tampered', unsupported_version:'newer', too_big:'tooBig' };
    if(e && codes[e.code]) return codes[e.code];
    return e && e.name === 'MALEncryptionError' ? 'damaged' : 'read';
}
/** Why decoded save data can't be loaded ('wrongGame' | 'newer' | 'older' | 'damaged'), or null when it can. */
function saveProblem(data){
    if(!data || typeof data !== 'object' || data.game !== SAVE_FILE.game) return 'wrongGame';
    if(!(Number(data.version) <= SAVE_FILE.version)) return 'newer';
    const old = SaveVersion.problem(data);
    if(old) return old;
    if(!data.world || !Array.isArray(data.world.blocks) || !data.player || !Number.isFinite(Number(data.seed))) return 'damaged';
    return null;
}
/**
 * Keeps the save file being loaded across the page reload: sessionStorage (or window.name when storage is
 * turned off). It holds the sealed file itself, so the file is checked again after the reload.
 */
const SaveStash = {
    put(bytes){
        const key = SAVE_FILE.stashKey, text = MALEngine_Encryption.toBase64(bytes);
        try { sessionStorage.setItem(key, text); return true; } catch(e){}
        try { window.name = key + ':' + text; return true; } catch(e){}
        return false;
    },
    /** The stashed file (base64), removed from the stash; null when there's none. */
    take(){
        const key = SAVE_FILE.stashKey;
        let text = null;
        try { text = sessionStorage.getItem(key); sessionStorage.removeItem(key); } catch(e){}
        try {
            if(typeof window.name === 'string' && window.name.startsWith(key + ':')){
                if(!text) text = window.name.slice(key.length + 1);
                window.name = '';
            }
        } catch(e){}
        return text;
    },
    /** The stashed save, decoded and checked: { data } or { error: 'load.err.<code>' code }. */
    open(){
        const text = this.take();
        if(!text) return { error: 'missing' };
        if(typeof MALEngine_Encryption === 'undefined') return { error: 'noTool' };
        try {
            const data = MALEngine_Encryption.decode(MALEngine_Encryption.fromBase64(text), saveOpts());
            const why = saveProblem(data);
            return why ? { error: why } : { data };
        } catch(e){ return { error: saveErrorCode(e) }; }
    },
    /** A save that broke after the reload (SaveGame.start): the start menu says so after the next one. */
    setError(code){ try { sessionStorage.setItem(SAVE_FILE.stashKey + '.error', code); } catch(e){} },
    takeError(){
        try {
            const key = SAVE_FILE.stashKey + '.error', code = sessionStorage.getItem(key);
            sessionStorage.removeItem(key);
            return code || null;
        } catch(e){ return null; }
    },
};
/**
 * How this page was opened (the URL hash), see the start menu in section 12b:
 *   (nothing)      the start menu: Tutorial / New Game / Load Saved Game
 *   #new           the start menu, already on the New Game screen
 *   #tutorial      the tutorial (a calm copy of the WORLD_SEED world)
 *   #seed=<int>    a new game on that seed
 *   #load          the save file in SaveStash: its seed's world, with the save laid over it (section 12c)
 * The world is made once at load, so the menu starts a game by setting the hash and reloading the page
 * (that also keeps Restart on the same seed, and works from file://).
 */
const LAUNCH = (() => {
    let h = '';
    try { h = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch(e){ h = ''; }
    if(h === 'tutorial') return { mode:'tutorial', seed: WORLD_SEED };
    if(h === 'load'){
        const r = SaveStash.open();
        if(r.data) return { mode:'load', seed: Number(r.data.seed) | 0, save: r.data };
        return { mode:'menu', view:'main', seed: WORLD_SEED, loadError: r.error };   // the start menu says what went wrong
    }
    const loadError = SaveStash.takeError();
    if(h === 'new') return { mode:'menu', view:'new', seed: WORLD_SEED, loadError };
    const m = /^seed=(-?\d+)$/.exec(h);
    if(m) return { mode:'new', seed: Number(m[1]) | 0 };
    return { mode:'menu', view:'main', seed: WORLD_SEED, loadError };
})();
/** Text from the seed box -> a whole number. Blank = random, digits = that number, anything else = a number made from the text. */
function parseSeed(text){
    const t = String(text ?? '').trim();
    if(!t) return Math.floor(Math.random() * 2147483647);
    if(/^-?\d+$/.test(t)) return Number(t) | 0;
    let h = 2166136261;
    for(let k = 0; k < t.length; k++){ h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); }
    return Math.abs(h | 0);
}
const MAP_COLS        = 84;
const MAP_ROWS        = 72;
const HEX_W           = 40;        // pointy-top hex cell width  (px)
const HEX_H           = 46;        // pointy-top hex cell height (px)
const MINE_TIME_SCALE = 1.5;       // seconds to break hardness 1 (stone) at speed 1, see miningInfo()
const HAND_SPEED      = 0.6;       // mining speed with no fitting tool
const WATER_UNITS     = 15;         // canteen fills a water cell holds before it runs dry
const WATER_REFILL_SECONDS = 120;  // a dry water cell refills after this long (0 = never)
const SURVIVAL = {
    hungerRate: 0.05,     // per second (saturation drains first)
    thirstRate: 0.06,     // per second
    regenRate:  0.2,      // health per second while well fed and watered
    regenAbove: 70,       // hunger and thirst must both be at least this to regenerate
    saturationMax: 20,
    sip: 25,              // thirst restored per canteen sip
    hotAbove: 30,         // above this temperature thirst drains faster...
    hotThirst: 0.05,      // ...by 5% per degree
    coldBelow: 10,        // below this temperature hunger drains faster...
    coldHunger: 0.03,     // ...by 3% per degree
    moveHunger: 0.3,      // walking costs this much extra hunger (Active Runner shrinks it)
};
const FARM = {
    waterMax: 100,        // water a farmland holds (like a planter box)
    bucketUnit: 25,       // farmland water per bucket unit poured
    evaporate: 8,         // water an empty farmland loses per in game day
    cropWater: 40,        // water a crop drinks per in game day (crops can override with `water`)
    dryDays: 1,           // a crop that stays dry this long withers
    wildChance: 0.006,    // chance a land cell has a wild crop
    wildMin: 4,           // every crop appears at least this many times in the world
    fernSeedChance: 0.125, // chance gathering a fern also gives a crop seed (tier 1 or lower)
    fernSeedMaxTier: 1,
    floodMax: 400,        // a bucket can overfill farmland up to this much water...
    floodAt: 3,           // ...and above this many times waterMax...
    floodDays: 0.5,       // ...for this long (half a day = 7.5 min) it turns into a water source
    overflowDrain: 40,    // water above waterMax soaks away this much faster per in game day
    slots: 5,             // seedling slots of a farmland (one seed each, all the same crop; each grows on its own)
    stackThirst: 0.5,     // each extra growing seedling makes the cell drink this much more (x1 + 0.5 per extra)
    intakeSeconds: 1,     // the water slot pours one bucket unit (bucketUnit water) into the soil this often...
                          // ...while a whole unit still fits under waterMax (it never floods the farmland)
    irrigationPerUnit: 150, // irrigated farmland growing crops takes 1 unit from the water cell next to it per this much
                          // soil water it tops up (very slow; a dry water cell stops irrigating until it refills)
    // Farmland next to a water cell is irrigated: it stays full and never needs the bucket.
};
/** Experience: killing hostiles gives far more than anything else. Level n -> n+1 costs levelBase + levelStep*(n-1) + levelCurve*(n-1)^2. */
const XP = {
    levelBase: 100, levelStep: 40, levelCurve: 6,
    healthPerLevel: 1,     // max health gained per level (and a heal of the same size)
    hostile: 30,           // default xp for a hostile creature (a creature's own `xp` wins)
    passive: 3,            // default xp for an animal
    harvest: 2,            // per crop harvested from a ripe plant (a stack of 3 gives 3x)
    till: 0.5,             // tilling soil
    plantRatio: 0.5,       // xp per plant when sowing
    stone: 1, tree: 1,     // mining plain blocks...
    ore: 3, oreTier: 2,    // ...ore: 3 + 2 per tier of the ore block
    fish: 3,               // per fish caught
};
/**
 * The price of dying (see deathPenalty). The penalty is worth
 *   base + perLevel * (level - 1)   levels' worth of xp (1 = what the current level needs).
 * It is paid from your xp progress first (your level itself never drops). Whatever is left
 * over takes skill levels: one per `perSkillLoss` levels' worth (the fraction is a chance at
 * one more), at most `maxSkillLoss`. Each loss picks a skill at level 2+ at random, weighted
 * by its level, so one skill can drop more than once. Stat upgrades count as skills here
 * (their `onLose` undoes what `onPick` gave).
 */
const DEATH = {
    base: 0.5,
    perLevel: 0.1,
    perSkillLoss: 1,
    maxSkillLoss: 5,
    hunger: [45, 60],      // hunger and thirst you wake up with (random in [min, max])
    thirst: [40, 55],
    lossToastMs: 9000,     // the "skills weakened" toast stays this long
};
/**
 * Fishing (see "Fishing" in section 9). A fishing rod's stats come from the tier of the metal its hook is made of
 * (tin = tier 1 is the weakest rod):
 *   lure    = chance per second that something bites:  lureBase + lurePerTier * (tier - 1)
 *   success = chance a bite is caught (else it gets away): successBase + successPerTier * (tier - 1), at most successMax
 * Tin: 4% lure (a bite every ~25 s), 50% success.  Cobalt (tier 8): 21.5% lure (~5 s), 92% success.
 */
const FISHING = {
    range: 5,                         // the farthest water cell (in cells) you can cast at; needs a clear line, like an arrow
                                      // (the catch chance also shrinks with the cell's water: see fishSuccess)
    settle: 2,                        // seconds after a cast before anything can bite
    biteTime: 0.8,                    // seconds the bobber dips before the rod reels the catch in by itself
    lureBase: 0.04, lurePerTier: 0.025,
    successBase: 0.5, successPerTier: 0.06, successMax: 0.95,
    durabilityBase: 40, durabilityPerTier: 20,   // one use per bite (caught or not)
    // Conditions, added to the rod's success before the water level scales it (see fishChance):
    rainBase: 0.05, rainPerIntensity: 0.10,  // raining on the water: +5% + 10% x the weather's intensity (rain 0.6 -> +11%, storm 1 -> +15%); not snow / hail
    dayBonus: 0.05,                   // daylight: up to +5% (x how bright it is; dusk, storms and caves give less)
    nightLight: 0.15,                 // at night, torches / lamps / lit machines near the water: up to -15% (x the light there x how dark it is).
                                      // The player's own light doesn't count.
    minChance: 0.02, maxChance: 0.98, // the catch chance (before the water level) stays within these
    // Non-fish catches: this share of successful catches is something else (weight = how often each one comes up)
    junkChance: 0.12,
    junk: [
        { id:'#log',         weight:3 },              // a random log type
        { id:'#seeds',       weight:3 },              // a random crop's seeds
        { id:'leather',      weight:1 },
        { id:'stick',        weight:2, amount:[1, 3] },
        { id:'plant_fiber',  weight:2, amount:[1, 2] },
    ],
    junkXp: 1,
};
/** Drying rack: no fuel, input / output slots, one recipe at a time (see MACHINES.rack). */
const RACK = {
    input: 4, fuel: 1, output: 2,   // the fuel slot is unused (hidden)
    fuelSeconds: 0,
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
const CAVE_DARKNESS = 0.7;   // the deepest parts of a cave are this dark even at noon (torches light them up)
const CAVE_OUTSIDE_DARKNESS = 0.9;   // deep inside a cave, everything outside it gets this dark (the day outside is hard to see from in there)
/**
 * Cave darkness heat map: how far into a cave a cell is. A cave cell touching the outside is depth 1,
 * the next ring in 2, and so on. CaveDepth.shade(i) turns that into 0..1 of the full cave darkness:
 * `edge` at depth 1 rising smoothly to 1 at depth `full`, so the light fades out as you walk in
 * (and the outside fades from view the deeper you are). Cached; CaveDepth.reset() when biomes change.
 */
const CaveDepth = {
    edge: 0.35,    // share of CAVE_DARKNESS on a cave's edge cells
    full: 5,       // depth (cells) at which a cave is fully dark
    depth: null,
    reset(){ this.depth = null; },
    build(){
        const N = MAP_COLS * MAP_ROWS, d = new Float32Array(N).fill(Infinity), queue = [];
        for(let i = 0; i < N; i++) if(Theaya.biome[i] !== 'cave'){ d[i] = 0; queue.push(i); }
        for(let q = 0; q < queue.length; q++){
            const i = queue[q];
            for(const j of neighborIdx(i)) if(d[j] === Infinity){ d[j] = d[i] + 1; queue.push(j); }
        }
        for(let i = 0; i < N; i++) if(d[i] === Infinity) d[i] = this.full;   // a map that's all cave
        this.depth = d;
    },
    /** Cells into the cave (0 = not a cave cell). */
    at(i){ if(!this.depth) this.build(); return this.depth[i]; },
    /** 0 (outside) .. 1 (deep in): the share of CAVE_DARKNESS this cell gets. */
    shade(i){
        const d = this.at(i);
        if(d <= 0 || Theaya.foundations.has(i)) return 0;   // a foundation slab lifts the cave darkness off its cell
        const t =Math.max(0, Math.min(1, (d - 1) / Math.max(1, this.full - 1)));
        return this.edge + (1 - this.edge) * t * t * (3 - 2 * t);
    },
};
const ORE_HEART = {
    days: 1.05,           // in game days between ores a heart grows (randomized +-30%)
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
    grass:'#62a046', dirt:'#634529', gravel:'#5e5851', sand:'#dcc581', stone:'#808080', calcite:'#e6e1d3',
    clay:'#ca9179',
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
    rice:       { produce:'#f7eac2', plant:'#8fbf5a', form:'grain', shape:'grain' },
    corn:       { produce:'#f0cf3a', plant:'#6aa63a', form:'tall',  shape:'grain' },
    ginger:     { produce:'#d9b57a', plant:'#5e9c48', form:'stalk', shape:'root' },
    pepper:     { produce:'#d8302a', plant:'#3f7f36', form:'vine',  shape:'pepper' },
    pumpkin:    { produce:'#e8862a', plant:'#4c8a34', form:'vine',  shape:'round', big:true },
    lettuce:    { produce:'#8fd05a', plant:'#7cc04e', form:'leafy', shape:'leaf' },
    onion:      { produce:'#e28ed1', plant:'#6cae4a', form:'root',  shape:'round' },
    garlic:     { produce:'#f3d9ae', plant:'#7fb35a', form:'root',  shape:'round' },
    nuts:       { produce:'#9a6a3a', plant:'#3f7a3a', form:'bush',  shape:'round' },
    sugar_cane: { produce:'#b8d88a', plant:'#7fbf5a', form:'stalk', shape:'stalk' },
    hemp:       { produce:'#a7b86a', plant:'#5e8f3e', form:'tall',  shape:'leaf' },
};
const cropLook = id => CROP_LOOKS[id] ?? { produce:'#c9a16a', plant:'#5fae3f', form:'leafy', shape:'round' };
/** Colors of each naturalMaterials.logs type (tree, log, planks, sapling). */
const LOG_LOOKS = {
    oak:   { bark:'#6b4a2b', leaves:'#35af22', planks:'#b98d55' },
    ash:   { bark:'#8c8378', leaves:'#b2ee94', planks:'#d8c69c' },
    pine:  { bark:'#5a3d26', leaves:'#134b28', planks:'#caa36b', conifer:true },
    cedar: { bark:'#7b3f2a', leaves:'#66ff4b', planks:'#b8673e' },
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
for(const id of Object.keys(groundTypes)) translatedName(groundTypes[id], id);   // floor names follow the language

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
 * `floorResource` = what the biome's ground is made of: an emptied water cell
 * filled in with a shovel says "Fill with <it>" (a walkable soil block like
 * sand is placed on it; anything else just leaves bare floor). `waterBodies`
 * turns a share of the biome's cells into water: `lakes` (round pools) and
 * `rivers` (long winding lines), both kept away from camp.
 */
const biomes = {
    plains: {
        floor: FLOOR,
        floorResource: 'dirt',
        temprature:20,
        shoreClay:0.34,
        waterBodies: { lakes:0.035, rivers:0.04 },
        resources: { oak_tree:0.03, cedar_tree:0.02, ash_tree:0.006, berry_bush:0.025, fern:0.05, dirt:0.02, stone:0.012, gravel:0.006 },
    },
    forest: {
        floor: FLOOR, floorColor: '#4d8a39',
        floorResource: 'dirt',
        temprature:17,
        shoreClay:0.15,
        waterBodies: { lakes:0.045, rivers:0.045 },
        resources: { oak_tree:0.08, ash_tree:0.06, pine_tree:0.05, cedar_tree:0.025, berry_bush:0.03, fern:0.08, dirt:0.015 },
    },
    desert: {
        floor: FLOOR, floorColor: '#a7a25c',
        floorResource: 'sand',
        temprature:28,
        shoreClay:0.2,
        fill: { block:'sand', share:0.78 },
        dunes: { block:'sand_dune', share:0.22 },   // ridges of impassable dunes in the sand
        resources: { cedar_tree:0.03, fern:0.006, stone:0.02, gravel:0.02 },
    },
    ocean: {
        floor: 'water',
        floorResource: 'sand',
        temprature:16,
        resources: {},
    },
    cave: {
        within: ['plains', 'forest', 'desert'],
        temprature:15,
        floor: FLOOR, floorColor: '#dadada',
        floorResource: 'stone',
        waterBodies: { lakes:0.03, rivers:0.025 },   // underground pools and streams
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
/** Every metal ingot of material tier `tier` or lower (tier 3: tin, zinc, copper). Call it once the items exist. */
function ingotsUpToTier(tier){
    return Object.keys(materialList).filter(m => materialTier(m) <= tier && Items.has(`${m}_ingot`)).map(m => `${m}_ingot`);
}


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
        hunger:7,
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
        hunger:5, satruation:3, tier:0,
        rarity:1, biomes:['plains','forest'],
        growth:{ stages:[
            { yeild:0,     time:0.6 },
            { yeild:1,     time:1.4 },
            { yeild:[2,3], time:2.2, done:true },
            { yeild:0,     time:5,   rot:true },
        ]},
    },
    potato:{
        hunger:7, satruation:3, tier:0,
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
        hunger:6, satruation:3, tier:1,
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
        hunger:11, satruation:5, tier:2,
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
        rarity:3, biomes:['plains','forest'],
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
            produce: c.produce ?? id, water: c.water ?? FARM.cropWater, rarity: c.rarity ?? 1,
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

/** A drink's thirst: consuming it restores this much thirst (milk).   new Quench(amount) */
class Quench extends ItemComponent {
    static id = 'quench';
    constructor(amount = 0){ super(); this.amount = Number(amount) || 0; }
}
ItemComponent.register(Quench);
/** What's left after consuming it (a milk bucket gives back an empty bucket).   new ReturnsItem(itemId)
 *  (the field is itemId: `item` is the component's owner, set by the engine) */
class ReturnsItem extends ItemComponent {
    static id = 'returnsItem';
    constructor(itemId = null){ super(); this.itemId = itemId; }
}
ItemComponent.register(ReturnsItem);

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

/** A fishing rod's stats (see FISHING).   new FishingLine(tier) -> { tier, lure, success } */
class FishingLine extends ItemComponent {
    static id = 'fishing';
    constructor(tier = 1){
        super();
        this.tier    = Math.max(1, Math.floor(Number(tier) || 1));
        this.lure    = FISHING.lureBase + FISHING.lurePerTier * (this.tier - 1);
        this.success = Math.min(FISHING.successMax, FISHING.successBase + FISHING.successPerTier * (this.tier - 1));
    }
}
ItemComponent.register(FishingLine);

/**
 * A fishing rod. Its hook is made of a tool metal, and that metal's tier sets the rod's lure and catch chance.
 *   new FishingRod(name, material)   ('<material>_fishing_rod' when no name is given)
 */
class FishingRod extends Item {
    static TYPE = 'fishing_rod';
    constructor(name = null, material = null){
        checkMaterial(material, 'tool');
        const tier = material != null ? Math.max(1, materialTier(material)) : 1;
        super(name ?? (material != null ? `${material}_fishing_rod` : 'fishing_rod'));
        this.package(new MaxStack(1), new Durability(FISHING.durabilityBase + FISHING.durabilityPerTier * tier), new FishingLine(tier));
        if(material != null) this.package(new Resource(material, 'tool'));
        this.addTag('fishing_rod');
        this.meta.category = 'tool';
    }
    get fishing(){ return this.get('fishing'); }
}
for(const cls of [BlockItem, Canteen, Bucket, CropSeedItem, sPickaxe, FishingRod]) Item.registerClass(cls);

/**
 * Stack sizes. One rule decides every item's stack (instead of a number per definition); Items.define
 * applies it to every item, so new items need no stack number (unless they're an exception: STACK_OF).
 *   resources (materials, ores, ingots, logs, planks, seeds, ammo, natural blocks...) and wall blocks: STACK.resource
 *   food (anything you can eat, raw or cooked):                                                        STACK.food
 *   building blocks (stations, doors, torches, lamps, boats, chests...):                               STACK.building
 * Tools, weapons, armor, canteens and buckets don't stack (they stay 1).
 */
const STACK = { resource: 100, food: 24, building: 16 };
const BUILDING_KINDS = ['station', 'door', 'torch', 'lamp', 'boat'];   // everything else placeable (walls, glass, planks, saplings, soil...) is a resource
const STACK_OF = { glass: 16, torch: 50, grease_torch: 50 };   // single items that differ from their category
function stackFor(item){
    if(item.getMaxStack() <= 1) return null;
    if(STACK_OF[item.id] != null) return STACK_OF[item.id];
    if(item.has('consume')) return STACK.food;
    if(item instanceof BlockItem){
        const def = Blocks.get(item.block);
        if(def && (BUILDING_KINDS.includes(def.kind) || item.id === 'berry_bush')) return STACK.building;
    }
    return STACK.resource;
}
/** Wraps an item factory so what it makes gets its stack size from stackFor(). */
function withStack(make){
    return i => { const item = make(i), s = stackFor(item), m = item.get('maxStack'); if(s != null && m) m.size = s; return item; };
}

/**
 * Item registry: every item the game can create, by id.
 *   Items.define(id, id => new SomeItem(id, ...), { color, icon, accent })
 *   Items.create(id, count)
 * `look` is how the HUD draws it (icon = block, log, stick, raw, chunk, ingot,
 * pickaxe, axe, shovel, hoe, berries, bush, sapling, canteen, bucket, workbench,
 * furnace, produce, seeds, fiber, wall, door, chest, glass, food, torch, lamp, grease).
 * An `art` (or the item's id) that has an ICON_ART drawing takes priority over the icon family.
 */
const Items = {
    defs: new Map(),
    _max: new Map(),
    define(id, factory, look = {}){
        this.defs.set(id, { factory: withStack(factory), look: Object.assign({ color:'#cccccc', icon:'raw' }, look) });
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

/* ---------------------------------------------------------------------
 * 3a. Textures: optional images for game elements
 *   Any game element in the WORLD can be drawn from an image instead of its built-in look:
 *   blocks, terrain, ground floors, trees (trunk + canopy), saplings, crops, stations,
 *   creatures, the player and arrows in flight. The HUD (inventory, item icons, station
 *   menus, panels, buttons) is never textured.
 *   Nothing here is required. An element with no texture, or whose image hasn't loaded
 *   yet or failed to load, is drawn the original way, so missing files can't break the game.
 *
 *   Where to give a texture (the key is the element's id):
 *     - in a spec:        defineElement({ id:'stone_wall', ..., texture:'textures/stone_wall.png' })
 *     - in TEXTURES:      for anything, including generated elements (ores, trees, tools, crops,
 *                         ground floors 'grass' / 'water', creatures, the 'player')
 *     - from code:        Textures.set('iron_ore', 'textures/iron_ore.png')
 *   A spec's texture replaces a TEXTURES entry with the same id.
 *
 *   A texture is a path, or an object:
 *     texture: 'textures/door.png'
 *     texture: {
 *         src:'textures/door.png',                  the main image
 *         states:{ open:'textures/door_open.png' }, images for a state (list below); a missing state uses src
 *         canopy:'textures/oak_leaves.png',         trees: the leaves drawn over the player
 *         scale:1,                                  1 = fits the cell (blocks) or the body (creatures / player)
 *         offset:[0, 0],                            nudge in px
 *         fit:'contain',                            'contain' (keep aspect) | 'cover' (fill, crop) | 'stretch'
 *         clip:false,                               cut the image to the hex cell (floors default to true)
 *         over:false,                               true = draw the built-in look first, the image on top
 *         alpha:1,                                  opacity
 *         smooth:true,                              false = crisp pixel art
 *         rotate:true, angle:0,                     creatures / player / arrows: turn to face where they go.
 *                                                   angle = the way the image faces, in degrees (0 = right, 90 = down)
 *         frames:1, fps:8,                          a horizontal strip of animation frames. Creatures, the player and
 *                                                   canopies animate; cells (cached terrain) use frame 0
 *         eyes:false,                               zombie: true = keep the red eyes glowing at night over the image
 *     }
 *   src, every state and canopy can also be an object ({ src, scale, ... }) that overrides the
 *   options above for that image only.
 *
 *   States (the first one that has an image is used):
 *     ground floors   'dried', 'mud', 'low' (water under half full), then the biome id ('desert', 'cave'...)
 *     door            'open'          machines (forge, pot...)  'lit'          boat  'aboard'
 *     farmland        'flooded', 'wet' (over half watered)
 *     crops / plants  'rotten', 'ripe', 'stage<n>' (n = growth stage from 0), 'sprout' (not grown yet), 'growing'
 *                     (looked up on the plant block id first, e.g. 'wild_wheat' / 'berry_bush', then the crop id)
 *     creatures       'moving'       player  'moving'
 *   Farmland keeps its water gauge, plant and badges over its texture. Crack marks, weather (puddles,
 *   snow), torch flames and lighting are effects and stay drawn as they are.
 * --------------------------------------------------------------------- */
const TEXTURES = {
    // Examples (the paths are relative to the page):
    // grass:       { src:'textures/grass.png', states:{ desert:'textures/dry_grass.png', cave:'textures/cave_floor.png' } },
    // stone:       'textures/stone.png',
    // oak_tree:    { src:'textures/oak_trunk.png', canopy:{ src:'textures/oak_leaves.png', scale:1.4 } },
    // wheat:       { states:{ sprout:'textures/wheat_0.png', growing:'textures/wheat_1.png', ripe:'textures/wheat_2.png' } },
    // cow:         { src:'textures/cow.png', angle:-90 },          // an image of a cow facing up
    // player:      { src:'textures/player_walk.png', frames:4, fps:8, smooth:false },
};
const Textures = {
    byId: TEXTURES,
    _entries: new Map(),   // id -> normalized entry
    _images: new Map(),    // src -> HTMLImageElement
    failed: new Set(),     // srcs that didn't load
    /** Give an element a texture (null removes it). */
    set(id, tex){
        if(tex == null) delete this.byId[id]; else this.byId[id] = tex;
        this._entries.delete(id);
        this._redraw();
        return this;
    },
    has(id){ return this.byId[id] != null; },
    /** { main, canopy, states:{} }: each slot = { src, ...options } or null. */
    entry(id){
        if(id == null || this.byId[id] == null) return null;
        let e = this._entries.get(id);
        if(!e){
            const raw = this.byId[id], t = typeof raw === 'string' ? { src: raw } : raw;
            const { src, states, canopy, ...opts } = t;
            const slot = s => s == null ? null : Object.assign({}, opts, typeof s === 'string' ? { src: s } : s);
            e = { main: slot(src), canopy: slot(canopy), states: {} };
            for(const [k, v] of Object.entries(states ?? {})) e.states[k] = slot(v);
            this._entries.set(id, e);
        }
        return e;
    },
    /** The loaded image for a path, or null (starts loading it the first time). */
    image(src){
        let img = this._images.get(src);
        if(!img){
            img = new Image();
            img.onload = () => this._redraw();
            img.onerror = () => { this.failed.add(src); console.warn(`Texture '${src}' didn't load; using the built-in look.`); };
            img.src = src;
            this._images.set(src, img);
        }
        return img.complete && img.naturalWidth > 0 ? img : null;
    },
    /**
     * The image to draw for an element right now: { s (slot options), img } or null (draw the built-in look).
     * which = 'main' | 'canopy'; states = state names to try first (main only), falsy ones are skipped.
     */
    pick(id, which = 'main', states = null){
        const e = this.entry(id);
        if(!e) return null;
        let s = null;
        if(which === 'main' && states) for(const st of states) if(st && e.states[st]){ s = e.states[st]; break; }
        if(!s) s = e[which];
        if(!s || !s.src) return null;
        const img = this.image(s.src);
        return img ? { s, img } : null;
    },
    /** True when the element has an image that replaces its look (not `over`). */
    replaces(id, which = 'main', states = null){ const t = this.pick(id, which, states); return !!(t && !t.s.over); },
    /**
     * Draw a picked texture centered at (cx, cy) in a w x h box. g = a p5.Graphics, or null for the main canvas.
     * o = { angle (radians, the way it should face), animate, clip (polygon points), alpha }
     */
    draw(g, t, cx, cy, w, h, o = {}){
        const { s, img } = t, ctx = g ? g.drawingContext : drawingContext;
        const frames = Math.max(1, Math.floor(s.frames || 1));
        const fw = img.naturalWidth / frames, fh = img.naturalHeight;
        const f = o.animate && frames > 1 ? Math.floor(performance.now() / 1000 * (s.fps ?? 8)) % frames : 0;
        const k = s.scale ?? 1, off = s.offset ?? [0, 0];
        let dw = w * k, dh = h * k;
        const fit = s.fit ?? (o.clip ? 'cover' : 'contain');
        if(fit !== 'stretch'){
            const r = fit === 'cover' ? Math.max(dw / fw, dh / fh) : Math.min(dw / fw, dh / fh);
            dw = fw * r; dh = fh * r;
        }
        ctx.save();
        if(o.clip && o.clip.length){
            ctx.beginPath();
            o.clip.forEach((p, j) => j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.closePath(); ctx.clip();
        }
        ctx.globalAlpha *= (s.alpha ?? 1) * (o.alpha ?? 1);
        if(s.smooth === false) ctx.imageSmoothingEnabled = false;
        ctx.translate(cx + off[0], cy + off[1]);
        if(o.angle != null && s.rotate !== false) ctx.rotate(o.angle - (s.angle ?? 0) * Math.PI / 180);
        ctx.drawImage(img, f * fw, 0, fw, fh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    },
    /** Which way something drawn at (x, y) is going, from where it was last frame: { moving, angle }. */
    motion(obj, x, y){
        const m = obj._texMotion || (obj._texMotion = { x, y, angle: 0, at: 0 });
        const dx = x - m.x, dy = y - m.y, now = performance.now();
        if(dx * dx + dy * dy > 0.04){ m.angle = Math.atan2(dy, dx); m.at = now; }
        m.x = x; m.y = y;
        return { moving: now - m.at < 150, angle: m.angle };
    },
    /** A newly loaded / changed texture: redraw the cached terrain. */
    _redraw(){ if(typeof Theaya !== 'undefined' && Theaya) Theaya.fullRedraw = true; },
};
/** Scale a polygon about its center c by k. */
const scalePoly = (pts, k, c) => pts.map(p => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
/** Draw a picked texture over one hex cell (blocks, plants, floors). */
function drawCellTexture(g, t, c, poly, clip = false){
    Textures.draw(g, t, c.x, c.y, HEX_W, HEX_H, { clip: (clip || t.s.clip) && poly ? scalePoly(poly, 1.04, c) : null });
}

/* ----- Mouse cursors -----
 * The game's own cursor images (Assets/world_of_theaya/cursors, see its README): 32 px PNGs, plus 64 px ones
 * for high-DPI screens through CSS image-set. Cursor.set(kind) swaps the page's cursor (only when it changes);
 * the HUD picks the kind every frame (Cursor.update in hudLayer.render, from what is under the mouse).
 * `fallback` is the browser's own cursor, used while an image loads or if it can't.
 */
const Cursor = {
    dir: 'Assets/world_of_theaya/cursors/',
    /** On-screen size in CSS pixels: 24 or 32 (the folders that exist; each also needs its double for high-DPI screens). */
    size: 24,
    /** Hotspots are in 32 px coordinates (as in cursors.json `hotspot32`) and scale with `size`. */
    kinds: {
        default: { hotspot:[3, 3],   fallback:'default' },
        pointer: { hotspot:[12, 2],  fallback:'pointer' },      // buttons, item slots, recipes
        grab:    { hotspot:[16, 14], fallback:'grabbing' },     // dragging an item stack
        mine:    { hotspot:[4, 5],   fallback:'pointer' },      // pickaxe / shovel on a block or floor
        attack:  { hotspot:[3, 3],   fallback:'pointer' },      // melee attack on a creature
        chop:    { hotspot:[3, 8],   fallback:'pointer' },      // axe on a tree / wood
        farm:    { hotspot:[3, 13],  fallback:'pointer' },      // hoe / seeds
        build:   { hotspot:[5, 15],  fallback:'pointer' },      // placing a block
        aim:     { hotspot:[16, 16], fallback:'crosshair' },    // ranged attack, casting a fishing line
        wait:    { hotspot:[16, 16], fallback:'wait' },         // loading / reading a save
        blocked: { hotspot:[16, 16], fallback:'not-allowed' },  // the click can't do that right now
        text:    { hotspot:[16, 16], fallback:'text' },         // text boxes
    },
    current: null,
    _css: {},
    /** The CSS cursor value for a kind (image-set when the browser takes it, else the 32 px image). */
    css(kind){
        if(this._css[kind]) return this._css[kind];
        const k = this.kinds[kind] || this.kinds.default, s = this.size;
        const [hx, hy] = k.hotspot.map(v => Math.round(v * s / 32));
        const file = size => `url("${this.dir}${size}/cursor_${kind}.png")`;
        const tail = ` ${hx} ${hy}, ${k.fallback}`;
        const tryOn = document.createElement('div').style;   // keeps the first form this browser accepts
        for(const v of [`image-set(${file(s)} 1x, ${file(s * 2)} 2x)${tail}`, `-webkit-image-set(${file(s)} 1x, ${file(s * 2)} 2x)${tail}`, file(s) + tail]){
            tryOn.cursor = v;
            if(tryOn.cursor) return this._css[kind] = tryOn.cursor;   // as the browser writes it back (set compares with it)
        }
        return this._css[kind] = k.fallback;
    },
    set(kind){
        if(!this.kinds[kind]) kind = 'default';
        const pad = !!this.pad;   // (set by Pad.wake / Pad.sleep: Pad is declared further down)
        const v = pad ? 'none' : this.css(kind);   // with a controller the real cursor hides: padImage draws this one
        if(kind !== this.current || pad !== this._pad){ this.current = kind; this._pad = pad; document.documentElement.style.cursor = v; }
        // p5's cursor() writes on the canvas itself (the engine's uiTextBox does on hover): put ours back
        const cv = document.querySelector('canvas');
        if(cv && cv.style.cursor !== v) cv.style.cursor = v;
        this.padImage(pad ? kind : null);
    },
    /** The controller's cursor: the same image, as an <img> that follows Pad.x / Pad.y (null hides it). */
    padImage(kind){
        let el = this._padEl;
        if(!kind){ if(el) el.style.display = 'none'; return; }
        if(!el){
            el = this._padEl = document.createElement('img');
            Object.assign(el.style, { position: 'fixed', pointerEvents: 'none', zIndex: 999, width: this.size + 'px', height: this.size + 'px', left: '0', top: '0' });
            document.body.appendChild(el);
        }
        const k = this.kinds[kind] || this.kinds.default, [hx, hy] = k.hotspot.map(v => Math.round(v * this.size / 32));
        const src = `${this.dir}${this.size * 2}/cursor_${kind}.png`;
        if(el.dataset.kind !== kind){ el.dataset.kind = kind; el.src = src; }
        el.style.display = '';
        el.style.transform = `translate(${Math.round(this.padX - hx)}px, ${Math.round(this.padY - hy)}px)`;
    },
    /** Give an element (the start menu's seed <input>) a cursor of its own. */
    style(el, kind){ el.style.cursor = this.css(kind); },
    /** Load every image up front, so the first switch to a cursor doesn't flash the browser's one. */
    preload(){ for(const kind in this.kinds) for(const size of [this.size, this.size * 2]) new Image().src = `${this.dir}${size}/cursor_${kind}.png`; },

    /** What the mouse is over this frame. Called by the HUD after it laid out its regions. */
    update(){ this.set(this.pick()); },
    pick(){
        if(Menu.launching || !Loading.hidden || SaveGame.busy) return 'wait';
        if(GameUI.press && GameUI.press.dragging) return 'grab';
        const hit = uiHit(mouse.rawX, mouse.rawY);
        if(hit) return this.forRegion(hit);
        if(Menu.active || GameUI.paused || GameUI.wheel) return 'default';
        return GameUI.quick ? this.forAction(GameUI.quick.q, GameUI.quick.x, GameUI.quick.y) : 'default';
    },
    forRegion(r){
        if(r.text) return 'text';
        switch(r.kind){
            case 'button': case 'wheelOption': return (r.kind === 'button' ? r.enabled : r.option.enabled) === false ? 'blocked' : 'pointer';
            case 'slot': return refItem(r.ref) ? 'pointer' : 'default';
            case 'recipe': case 'clock': case 'scrollbar':
            case 'dumpSlider': case 'itemSlider': case 'slider': return 'pointer';
            default: return 'default';
        }
    },
    /** A left-click quick action (quickActionFor) on cell (x, y): which tool it uses. */
    forAction(q, x, y){
        if(q.reason) return 'blocked';
        if(q.cursor) return q.cursor;
        const held = heldItem();
        if(q.mob) return weaponInfo(held).kind === 'ranged' ? 'aim' : 'attack';
        if(rodStats(held)) return 'aim';
        if(held instanceof BlockItem) return 'build';
        if(held instanceof CropSeedItem || isHoe(held)) return 'farm';
        if(waterOf(held)) return 'pointer';
        const b = blockAt(x, y), def = b && Blocks.get(b.id);
        if(def && def.tool === 'axe') return 'chop';
        return held && typeof held.get === 'function' && held.get('mining') ? 'mine' : 'pointer';
    },
};
Cursor.preload();
Cursor.set('wait');   // the world is generated while the page loads

/* ---------------------------------------------------------------------
 * 3b. Game elements: defineElement(spec)
 *   ONE function creates every kind of game element from a plain spec object. The items, blocks,
 *   foods, stations, creatures and skills of the game are all written this way (search for
 *   defineElement(s) below). A spec (fields not listed for a type are ignored):
 *
 *   every element
 *     id          back-end id (required)          name   display name (default: prettified id)
 *     type        'item' | 'block' | 'terrain' | 'food' | 'crop' | 'creature' | 'workbench' | 'container' | 'skill' | 'upgrade' | 'structure'
 *     stack       stack size, only to override the category rule (STACK: resources 100, food 24, building blocks 16)
 *     tags        item tags ('#tag' in recipes)    color, accent, icon, shape   how it is drawn (item icons / blocks / creatures)
 *     art         an item icon drawing from ICON_ART (item icons; defaults to ICON_ART[id] when there is one), cooked:true = its cooked version
 *     texture     optional image(s) for how it looks in the world (see 3a. Textures); without one it uses color / accent...
 *     recipe      { at:'workbench', input:{ item_id: amount }, count:1, time }  (or a list of them) how the item is crafted (not for creatures / crops / skills)
 *
 *   item        tier (material tier), fuel (burn units: 1 plank, 2 log, 4 coal), build: id => Item (your own class)
 *   food        hunger, satruation, instantHealth, regen:[health/s, seconds], poison:{ chance, apply:[damage/s, seconds] },
 *               thirst (a drink: thirst restored), returns (item id given back after it's consumed: 'bucket')
 *               (tag 'drink' = it's drunk, not eaten: smoothies, teas, milk; a food with `thirst` but no 'drink' tag, like soup, quenches a little too)
 *   block       tool ('pickaxe'|'axe'|'shovel'|'hoe'), tier (tool tier needed, 0 = hands, -1 = unbreakable), hardness (1 = stone, <0 instant),
 *   terrain     drop ('self' | item id | [{ id, chance, amount:[min, max], linked, priority }]; `linked` entries can't drop together,
 *               the hit with the highest priority wins), cellBehavior ('empty'|'passable'|'entityPass'|'blocked'), emitLight (glow px),
 *               kind ('wall'|'door'|'glass'|'torch'|'lamp'|'campfire'|...), textureType ('block'|'hill'), siege, safe, passableFor, solid, grow, init...
 *               draw(g, def, block, c, poly, i) = its own look on the terrain (g = the terrain buffer, c = the cell's center)
 *               terrain also takes biome + spawn (fraction of that biome's free land cells it appears on). `item:false` = no item.
 *   crop        require ('farmland'|'none'|'water'), thirst (water per day), growth:{ stages:[{ yeild, time, done, rot }] },
 *               crop (the harvested item id, default: the id), seed, seeds:[min, max], tier (hoe tier), regrow, rarity, biomes + the food fields
 *   creature    hp, speed, size, mover, behaviour ('passive'|'hostile'|'neutral'), sight, damage, cooldown, biomes, count, xp, skittish, dark,
 *               ai ('dumb'|'smart'|'genius', or odds per level like { dumb:3, smart:1 }: rolled for each creature; see MOB_AI),
 *               teamwork ('selfish' = fights on its own, the default | 'group' = fights alongside others, see GROUP),
 *               roles:{ role:{ count | share, weapon:{ itemId: weight }, armor:{ set: weight }, pieces } } (the gear it carries, see ARMED),
 *               gearDrop (chance per piece of its gear that it drops), breaks, drops:[{ id, chance, amount, linked, priority }],
 *               lays:{ block, every:[min, max] s, radius, max } (lays that block where it stands, chickens -> 'egg'; see Mobs.layTick),
 *               actions:{ key:{ display:'Milk @', require:{ item:'bucket', empty:true }, result:{ item:'milk_bucket', count:1 }, cooldown:30 } }
 *               (@ = the creature; require.empty = only an empty bucket / canteen counts; require.consume:false = keep it)
 *   workbench   workbenchTag (recipe station key, default: id), recipes:[{ input:{}, output:{ id: n, ... }, time }],
 *   container   slots: n (a chest)  or  { input, output, fuel } (a machine: slots, one recipe at a time; no `fuel` = needs no fuel; no slots = craft menu),
 *               verb, also:['hand'], search:false (no recipe search bar; every station has one by default), draw(g, def, block, c, poly, i), machine:{ fuelSeconds, verb, idle, hint, accepts, light, fancyFirst, blurb, listTitle }
 *               panel:{ draw(s, block, L), w, h } = its own menu instead of recipes / slots (the heart stone), init(b), onPlace(x, y, b)
 *   skill       max, desc: level => text, onPick(level), onLose(level)  (onLose undoes onPick when dying costs a level; upgrade = a stat pick; both appear in the level-up choices)
 *   structure   something built into the world when it's generated (a goblin camp), see Structures:
 *               biomes (every cell it covers must be one of these), count:[min, max] per world, radius (cells it covers),
 *               minDist (cells from the player's camp), spacing (cells between two structures),
 *               parts:[{ at:[q, r] | ring:n | scatter:n | [min, max], block, ring:n | [min, max] (scatter: which rings), gaps, gapWidth,
 *               chance, apart, loot:[drop rows] }] (q / r = hex offsets from the center, r = rows down),
 *               heart (block id: while it stands its creatures come back; break it and the structure is abandoned),
 *               notice / abandonedNotice (text keys: said the first time you come within noticeDist cells / when its heart breaks),
 *               creatures:[{ id, count:[min, max], respawn (s), respawnDist (cells) }] (they live there: see Structures.tick),
 *               respawn:{ days, count, dist } (when none of this type is left standing for `days` game days, `count` new
 *               ones are built, at least `dist` cells from you; respawnNotice = a text key said when that happens),
 *               hostile:true (an enemy base: the difficulty scales its `count` and how fast it and its creatures come back, see DIFFICULTY)
 *
 *   A drop row can also be { choose:[ids], amount:[min, max], chance }: every unit is a random one of the ids.
 *
 *   defineElement(spec) / defineElements([spec, ...]) / defineRecipes(station, [[output, input, opts], ...])
 * --------------------------------------------------------------------- */
const BUILT_KINDS = ['station', 'wall', 'door', 'glass', 'planks', 'torch', 'lamp', 'farmland', 'boat'];   // kinds that count as "built by the player" (see `built`)
const Blocks = {
    defs: {},
    define(id, def){
        const d = this.defs[id] = Object.assign({
            id, name: prettify(id), kind:'block', tag:'stone', solid:true,
            hardness:1, tier:0, tool:null, drops:[[id, 1]], color:'#888888',
        }, def);
        if(d.built === undefined) d.built = BUILT_KINDS.includes(d.kind);
        return translatedName(d, id);   // d.name follows the language (see nameOf)
    },
    get(id){ return this.defs[id] ?? null; },
};
const Content = {
    ready: false, queue: [],
    /** Run fn once the Recipe class exists (now, when it already does). */
    later(fn){ if(this.ready) fn(); else this.queue.push(fn); },
    flush(){ this.ready = true; for(const fn of this.queue.splice(0)) fn(); },
};
const STATION_TITLES = {};   // station -> panel title
const CRAFT_STATIONS = [];   // stations that are plain recipe menus
const STATION_VERBS  = {};   // craft station -> button text ('Craft', 'Weave'...)
const STATION_ALSO   = {};   // craft station -> other recipe stations shown in its menu (workbench also lists 'hand')
const NO_RECIPE_SEARCH = new Set();   // recipe-menu stations without a search bar (the loom: `search:false` in its spec). Every other station has one.
const STATION_DRAW   = {};   // station -> (g, def, block, c, poly, cellIndex) custom drawing on the terrain buffer
const MACHINES       = {};   // machine station -> { cfg, cells(), verb, idle, fancyFirst, noFuel, light, hint, blurb, listTitle }
const PANEL_STATIONS = {};   // station -> { draw(s, block, L), w, h }: a station with its own menu (no slots, no recipes; see the heart stone)
const TERRAIN_SPAWNS = [];   // { id, biome, chance } custom terrain scattered by generateWorld
/** The cells (indexes) holding a placed machine of this kind. */
function machineSet(kind){ return Theaya.machines[kind] || (Theaya.machines[kind] = new Set()); }
/** Default input filter of a machine: anything that is an ingredient of one of its recipes. */
const acceptsFor = station => item => !!item && Recipe.for(station).some(r => Object.keys(r.inputs).some(k => Recipe.matches(item, k)));
/** Input / fuel / output slots of a machine (cfg = { input, fuel, output }). */
const machineState = (cfg, accepts) => ({
    input:  new Box(cfg.input,  accepts),
    fuel:   new Box(cfg.fuel,   item => fuelValue(item) > 0),
    output: new Box(cfg.output, () => false),
    selected: null,   // id of the recipe the player picked (see selectMachineRecipe): the machine only works on this one
    burn: 0, burnMax: 0, progress: 0, active: null, lit: false, status: '',   // set every tick (M.idle / working / needs fuel)
});

/** `look` for Items.define from a spec: only the keys that were given (so the defaults stay). */
function lookOf(o){
    const look = {};
    for(const k of ['color', 'icon', 'accent', 'shape', 'piece', 'art', 'cooked']) if(o[k] !== undefined) look[k] = o[k];
    return look;
}
/** A spec's `drop` as a drop list ('self' -> the element's own id). Legacy [id, min, max, chance, instead] rows pass through. */
function normDrops(drop, selfId){
    if(drop === undefined || drop === 'self') return [[selfId, 1]];
    if(drop === null || drop === 'none') return [];
    if(typeof drop === 'string') return [[drop, 1]];
    return drop.map(e => Array.isArray(e) ? e : Object.assign({}, e, { id: e.id === 'self' ? selfId : e.id }));
}
/** Recipe station + output from a spec's `recipe`: { at, input, count, time }. */
function addSpecRecipe(r, output){
    Content.later(() => Recipe.add(r.at ?? 'workbench', r.count > 1 ? `${output}:${r.count}` : output, r.input ?? r.inputs ?? {}, { time: r.time, id: r.recipeId }));
}
/** A station's `recipes`: [{ input, output:{ id: n, ... }, time }]. The first output is the result, a second one a chance byproduct. */
function addSpecRecipes(station, list){
    Content.later(() => {
        for(const r of list){
            const outs = Object.entries(r.output ?? {});
            if(!outs.length) continue;
            const [oid, n] = outs[0], opts = { time: r.time ?? r.fuel, id: r.recipeId };
            if(outs[1]) opts.byproduct = { id: outs[1][0], count: outs[1][1], chance: r.chance ?? 1 };
            Recipe.add(station, n > 1 ? `${oid}:${n}` : oid, r.input ?? r.inputs ?? {}, opts);
        }
    });
}
/** defineRecipes('workbench', [[output, inputs, opts], ...]): several Recipe.add at once. */
function defineRecipes(station, list){
    Content.later(() => { for(const [out, inputs, opts] of list) Recipe.add(station, out, inputs, opts); });
}

const ELEMENT_TYPES = {};
const ELEMENT_ALIASES = { terrian:'terrain', consumable:'food', crafting:'workbench' };
function defineElement(spec){
    if(!spec || !spec.id) throw new Error('defineElement: every element needs an id.');
    const type = ELEMENT_ALIASES[spec.type] ?? spec.type ?? 'item', handler = ELEMENT_TYPES[type];
    if(!handler) throw new Error(`defineElement('${spec.id}'): unknown type '${spec.type}' (use ${Object.keys(ELEMENT_TYPES).join(', ')}).`);
    if(spec.stack != null) STACK_OF[spec.id] = spec.stack;
    if(spec.texture != null) Textures.set(spec.id, spec.texture);
    if(spec.name && spec.name !== prettify(spec.id) && !ENGLISH_NAMES[spec.id]) ENGLISH_NAMES[spec.id] = spec.name;   // custom English name (see nameOf)
    handler(spec, type);
    if(spec.recipe && !['creature', 'crop', 'skill', 'upgrade'].includes(type)) for(const r of [].concat(spec.recipe)) addSpecRecipe(r, spec.id);
    return spec;
}
function defineElements(list){ for(const spec of list) defineElement(spec); return list; }

ELEMENT_TYPES.item = o => {
    Items.define(o.id, i => {
        const it = o.build ? o.build(i) : new Material(i, 64, o.tier ?? 0);
        if(o.fuel) it.package(new Fuel(o.fuel));
        if(o.tags && o.tags.length) it.addTag(...o.tags);
        return it;
    }, lookOf(o));
};
const POISON_DEFAULT = [1.5, 12];   // damage per second, seconds
ELEMENT_TYPES.food = o => {
    Items.define(o.id, i => {
        const it = new Consumable(i, o.hunger ?? 0, o.satruation ?? o.saturation ?? 0, o.instantHealth ?? 0).addTag('food', ...(o.tags ?? []));
        if(o.poison){
            const p = typeof o.poison === 'number' ? { chance: o.poison } : o.poison, [dps, secs] = p.apply ?? POISON_DEFAULT;
            it.package(new Poisonous(p.chance ?? 1, secs, dps));
        }
        if(o.regen) it.package(new Regeneration(o.regen[0], o.regen[1]));
        if(o.thirst) it.package(new Quench(o.thirst));          // a drink (milk)
        if(o.returns) it.package(new ReturnsItem(o.returns));    // what's left after (an empty bucket)
        return it;
    }, Object.assign({ icon:'food' }, lookOf(o)));
};

const TEXTURE_KIND = { block:'block', hill:'soil' };   // textureType -> how the block is drawn (a block `kind`)
const TOOL_TAG = { pickaxe:'stone', axe:'wood', shovel:'dirt', hoe:'plant' };
const BEHAVIOR = {   // cellBehavior -> Blocks fields
    empty:      { solid:false, replaceable:true },     // nothing in the way, placing a block just replaces it
    passable:   { solid:false },                       // a block you can walk through
    entityPass: { solid:true, passableFor:['animal', 'zombie'] },   // blocks you, creatures walk through
    blocked:    { solid:true, passableFor:[] },        // blocks everything
};
ELEMENT_TYPES.block = (o, type) => {
    const tool = o.tool ?? null;
    const def = {
        name: o.name ?? prettify(o.id), kind: o.kind ?? TEXTURE_KIND[o.textureType] ?? 'block', tool,
        tag: o.tag ?? TOOL_TAG[tool] ?? 'stone', color: o.color ?? '#888888',
        hardness: o.tier === -1 ? 10 : (o.hardness ?? 1), tier: Math.max(0, o.tier ?? 0),
        drops: normDrops(o.drop, o.id),
    };
    if(o.textureType && !TEXTURE_KIND[o.textureType] && !o.kind) console.warn(`defineElement('${o.id}'): textureType '${o.textureType}' can't be drawn for a custom block yet; using a plain block (set kind).`);
    Object.assign(def, BEHAVIOR[o.cellBehavior]);
    if(type === 'terrain') def.natural = true;   // creatures can dig through it (see siegeSeconds)
    if(o.emitLight) def.light = o.emitLight;
    for(const k of ['accent', 'siege', 'solid', 'passableFor', 'replaceable', 'grow', 'init', 'placeState', 'safe', 'built', 'dropsFor', 'biome', 'draw']) if(o[k] !== undefined) def[k] = o[k];
    Blocks.define(o.id, def);
    if(type === 'terrain' && o.biome && o.spawn) TERRAIN_SPAWNS.push({ id: o.id, biome: o.biome, chance: o.spawn });
    if(o.item !== false){
        Items.define(o.id, i => { const b = new BlockItem(i, o.id, 64); if(o.tags && o.tags.length) b.addTag(...o.tags); return b; },
            lookOf({ color: o.color ?? def.color, icon: o.icon ?? 'block', accent: o.accent, shape: o.shape }));
    }
};
ELEMENT_TYPES.terrain = ELEMENT_TYPES.block;

/** Registers a crop that is already in the `crops` table: its produce + seed items, then its wild plant block. */
function registerCropItems(id){
    const c = Crops.get(id), L = cropLook(id);
    Items.define(c.produce, i => c.edible
        ? new Consumable(i, c.hunger, c.saturation, c.health).addTag('crop', 'food')
        : new Material(i, 64, 1).addTag('crop'), { color:L.produce, icon: L.shape === 'berries' ? 'berries' : 'produce', shape:L.shape, accent:L.plant, art:id });
    if(c.seed === `${id}_seeds`) Items.define(c.seed, i => new CropSeedItem(i, id), { color:L.produce, icon:'seeds', accent:L.plant });
}
function registerCropBlock(id){
    if(id === 'berries') return;
    const c = Crops.get(id);
    Blocks.define(`wild_${id}`, {
        name:`Wild ${prettify(id)}`, kind:'plant', crop:id, tag:'plant', color:cropLook(id).plant, hardness:0.2, tool:'hoe', passableFor:['zombie'],
        drops: Items.has(c.seed) ? [[c.seed, 1]] : [],
        init(b){ if(!b.plant) b.plant = newPlant(id, c.ripeAge + Math.random() * 0.3 * (Math.min(c.rotAge, c.ripeAge * 2) - c.ripeAge)); },
    });
}
ELEMENT_TYPES.crop = o => {
    const entry = {
        hunger: o.hunger, satruation: o.satruation ?? o.saturation, health: o.instantHealth, edible: o.edible, tier: o.tier, regrow: o.regrow,
        seeds: o.seeds, seed: o.seed, farm: o.require === 'none' ? false : undefined, nearWater: o.require === 'water' ? true : o.nearWater,
        water: o.thirst, rarity: o.rarity, biomes: o.biomes, growth: o.growth, produce: o.crop,
    };
    for(const k of Object.keys(entry)) if(entry[k] === undefined) delete entry[k];
    crops[o.id] = entry;
    Crops._cache.delete(o.id);
    if(o.color) CROP_LOOKS[o.id] = { produce:o.color, plant:o.accent ?? '#5fae3f', form:o.form ?? 'leafy', shape:o.shape ?? 'round' };
    registerCropItems(o.id);
    registerCropBlock(o.id);
};

ELEMENT_TYPES.creature = o => {
    const { type, health, hp, drops, recipe, tags, ...rest } = o;
    if(rest.behavior && !rest.behaviour) rest.behaviour = rest.behavior;   // American spelling accepted too
    CREATURES[o.id] = translatedName(Object.assign({ name: prettify(o.id), teamwork: 'selfish' }, rest, { hp: hp ?? health ?? 10, drops: (drops ?? []).map(d => Array.isArray(d) ? d : Object.assign({}, d)) }), o.id);
};

/** Structure types (defineElement type:'structure'), built into the world by Structures.generate. */
const STRUCTURES = {};
ELEMENT_TYPES.structure = o => {
    const { type, recipe, ...rest } = o;
    STRUCTURES[o.id] = translatedName(Object.assign({ name: prettify(o.id), biomes: [], count: [1, 1], radius: 2, minDist: 10, spacing: 10, parts: [], creatures: [] }, rest), o.id);
};

ELEMENT_TYPES.workbench = (o, type) => {
    const station = o.workbenchTag || o.id, name = o.name ?? prettify(o.id), slots = o.slots, m = o.machine ?? {};
    Items.define(o.id, i => { const it = new BlockItem(i, o.id, 16); if(o.tags && o.tags.length) it.addTag(...o.tags); return it; }, lookOf({ color: o.color, icon: o.icon ?? o.id, accent: o.accent }));
    const def = Object.assign({
        name, kind:'station', station, tag: o.tag ?? 'wood', color: o.color ?? '#9b6b3d',
        hardness: o.hardness ?? 0.6, tool: o.tool ?? 'axe', passableFor: o.passableFor ?? ['zombie'],
    }, o.block);
    // the title follows the language: a custom `title` is used as is, otherwise the station's name (nameOf)
    Object.defineProperty(STATION_TITLES, station, { get: () => o.title ?? nameOf(o.id), enumerable: true, configurable: true });
    if(o.draw) STATION_DRAW[station] = o.draw;
    if(slots && typeof slots === 'object'){   // a machine
        const cfg = { input: slots.input ?? 4, fuel: slots.fuel ?? 1, output: slots.output ?? 2, fuelSeconds: m.fuelSeconds ?? 12 };
        const noFuel = m.noFuel ?? slots.fuel == null;
        // verb / idle / hint / blurb / listTitle: THEAYA_TEXT 'station.<station>.<field>' when it has one (see stationText),
        // else the spec's own text, else a generic one
        const txt = (field, own, generic, vars) => () => stationText(station, field, own, generic, vars);
        MACHINES[station] = { cfg, cells: () => machineSet(station), fancyFirst: !!m.fancyFirst, noFuel, light: m.light ?? 0 };
        for(const [field, fn] of Object.entries({
            verb:      txt('verb', m.verb, 'station.generic.verb'),
            idle:      txt('idle', m.idle, 'station.generic.idle'),
            hint:      txt('hint', m.hint, 'station.generic.hint'),
            blurb:     txt('blurb', m.blurb, noFuel ? 'station.generic.blurbNoFuel' : 'station.generic.blurb', { secs: cfg.fuelSeconds }),
            listTitle: () => stationText(station, 'listTitle', m.listTitle, 'station.generic.listTitle', { name: STATION_TITLES[station] }),
        })) Object.defineProperty(MACHINES[station], field, { get: fn, enumerable: true });
        const accepts = m.accepts ?? acceptsFor(station);
        def.init = b => { if(!b.input) Object.assign(b, machineState(cfg, accepts)); };
    } else if(typeof slots === 'number'){   // a chest
        def.init = b => { if(!b.box) b.box = new Box(slots); };
    } else if(o.panel){                     // its own menu: panel:{ draw(s, block, L), w, h }
        PANEL_STATIONS[station] = o.panel;
    } else {                                // a recipe menu
        CRAFT_STATIONS.push(station);
        Object.defineProperty(STATION_VERBS, station, { get: () => stationText(station, 'verb', o.verb, 'station.generic.craft'), enumerable: true, configurable: true });
        if(o.also) STATION_ALSO[station] = o.also;
        if(o.search === false) NO_RECIPE_SEARCH.add(station);
    }
    if(o.init && !def.init) def.init = o.init;
    if(o.onPlace) def.onPlace = o.onPlace;   // (x, y, block) after the player places it
    Blocks.define(o.id, def);
    if(o.recipes) addSpecRecipes(station, o.recipes);
};
ELEMENT_TYPES.container = ELEMENT_TYPES.workbench;

ELEMENT_TYPES.skill = (o, type) => {
    Skills.defs[o.id] = translatedName(Object.assign({ name: prettify(o.id), max: 5, color: '#cccccc' }, o, { kind: type === 'upgrade' ? 'upgrade' : 'skill' }), o.id);
};
ELEMENT_TYPES.upgrade = ELEMENT_TYPES.skill;

// Wood (one set per naturalMaterials.logs entry)
for(const t of logTypes){
    const L = logLook(t);
    Items.define(`${t}_log`,     id => new Material(id, 100, 1).package(new Fuel(2)).addTag('log', 'fuel', 'wood'), { color:L.bark, icon:'log', accent:L.planks });
    Items.define(`${t}_planks`,  id => new BlockItem(id, id, 100).package(new Fuel(1)).addTag('planks', 'fuel', 'wood'), { color:L.planks, icon:'block' });
    Items.define(`${t}_sapling`, id => new BlockItem(id, id, 100).addTag('sapling'), { color:L.leaves, icon:'sapling' });
}
Items.define('stick', id => new Material(id, 100, 0).addTag('stick'), { color:'#9a7146', icon:'stick' });

// Nature blocks (every naturalMaterials.nature entry that isn't a floor)
for(const [id, n] of Object.entries(naturalMaterials.nature)){
    if(n.passable) continue;
    Items.define(id, i => new BlockItem(i, i).addTag(toolClass(n.tool) === 'pickaxe' ? 'stone' : 'soil'), { color:NATURE_COLORS[id] ?? '#8a8a8a', icon:'block' });
}

// Ores and ingots (from materialList)
for(const m of oreMaterials){
    if(DIRECT_ORE_DROPS.includes(m)) continue;
    Items.define(`raw_${m}`, id => new sMaterial(id, m, 100).addTag('raw_ore'), { color:MATERIAL_COLORS[m], icon:'raw' });
}
Items.define('coal',   id => new sMaterial(id, 'coal', 100).package(new Fuel(4)).addTag('fuel'), { color:MATERIAL_COLORS.coal, icon:'chunk' });
Items.define('sulfer', id => new sMaterial(id, 'sulfer', 100), { color:MATERIAL_COLORS.sulfer, icon:'chunk' });
for(const m of Object.keys(materialList)){
    if(DIRECT_ORE_DROPS.includes(m)) continue;
    Items.define(`${m}_ingot`, id => new sMaterial(id, m, 100).addTag('ingot'), { color:MATERIAL_COLORS[m], icon:'ingot' });
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
// Fishing rods: one per tool metal (the hook). The metal's tier sets the lure and catch chance (see FISHING).
for(const m of materialsFor('tool')){
    Items.define(`${m}_fishing_rod`, id => new FishingRod(id, m), { color:MATERIAL_COLORS[m], icon:'rod', accent:'#e8e2d0' });
}



// Crops: produce (food, or a material when edible:false) + seeds, from the `crops` table
for(const id of Crops.ids()) registerCropItems(id);
Items.define('berry_bush',  id => new BlockItem(id, 'berry_bush', 24), { color:'#3c7a34', icon:'bush' });
defineElements([
    { id:'plant_fiber', type:'item', tier:0, tags:['fiber'],  color:'#8fb35a', icon:'fiber' },
    // Fibers and fabric (the loom refines them): plant fiber -> thread, hemp -> cloth -> silk
    { id:'flint',  type:'item', tier:1, tags:['flint'],  color:'#4a4a55', icon:'chunk' },
    { id:'thread', type:'item', tier:1, tags:['thread'], color:'#e8dfc4', icon:'thread' },
    { id:'cloth',  type:'item', tier:2, tags:['fabric'], color:'#cdb88e', icon:'cloth' },
    { id:'silk',   type:'item', tier:4, tags:['fabric'], color:'#f1eafc', icon:'cloth', accent:'#c9b8ff' },
]);

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
 * A bandage: using it heals `heal` health at once, then every bandage waits `cooldown` seconds
 * (player.bandageCd, one shared timer, see useItem / tickSurvival).   new Bandage(heal, cooldown)
 */
const BANDAGE = { heal: 15, cooldown: 8 };   // health restored, seconds before the next bandage can be used
class Bandage extends ItemComponent {
    static id = 'bandage';
    constructor(heal = 15, cooldown = 8){ super(); Object.assign(this, { heal, cooldown }); }
}
ItemComponent.register(Bandage);

/**
 * Meat from animals. raw / cooked = [hunger, saturation]; `poison` = chance
 * that eating it RAW poisons you (cook it in the cooking pot). `grease` =
 * chance that cooking one also leaves a grease in the pot's output.
 */
const MEATS = {
    venison:      { raw:[4, 1], cooked:[15, 7],  poison:0.15, grease:0.5,  color:'#a8423a', art:'haunch' },
    bear_meat:    { raw:[5, 1], cooked:[20, 9], poison:0.6,  grease:1,    color:'#8a3430', art:'slab' },
    rabbit:       { raw:[3, 1], cooked:[10, 4],  poison:0.3,  grease:0.3,  color:'#d07a70', art:'small_leg' },
    beef:         { raw:[4, 1], cooked:[17, 8],  poison:0.2,  grease:0.8,  color:'#b8403c', art:'steak' },
    pork:         { raw:[4, 1], cooked:[17, 7],  poison:0.5,  grease:1,    color:'#e39a9a', art:'chop' },
    chicken:      { raw:[3, 1], cooked:[12, 5],  poison:0.7,  grease:0.5,  color:'#f0c0b0', art:'drumstick' },
    bird_meat:    { raw:[2, 0], cooked:[8, 3],   poison:0.4,  grease:0.3,  color:'#c86a5a', art:'wing' },
    bacon:        { raw:[3, 1], cooked:[14, 7],  poison:0.3,  grease:1,    color:'#d9786e', art:'bacon' },   // dried from pork on the drying rack
    rotten_flesh: { raw:[4, 0], cooked:null,     poison:1,                 color:'#6f7f4a', art:'rotten' },
};
const rawMeatId    = k => k === 'rotten_flesh' ? k : `raw_${k}`;
const cookedMeatId = k => `cooked_${k}`;
// Raw and cooked meat for every MEATS entry. Raw meat can poison you (the default poison: 1.5 damage/s for 12 s).
for(const [k, m] of Object.entries(MEATS)){
    defineElement({ id: rawMeatId(k), type:'food', hunger: m.raw[0], satruation: m.raw[1], poison:{ chance: m.poison }, tags:['meat', 'raw_meat'], color: m.color, icon:'meat', art: m.art ?? 'steak' });
    if(m.cooked) defineElement({ id: cookedMeatId(k), type:'food', hunger: m.cooked[0], satruation: m.cooked[1], tags:['meat', 'cooked_meat'], color:'#8a5232', icon:'meat', accent: m.color, art: m.art ?? 'steak', cooked:true });
}

/**
 * Fish, caught with a fishing rod (see FISHING). raw / cooked = [hunger, saturation], `poison` = chance that eating it
 * raw poisons you, `heal` = health a cooked one restores, `grease` = chance cooking one leaves grease in the pot.
 * Which fish bites: weighted by `weight + perTier * (rod tier - 1)`, so better rods pull in the rarer fish more often.
 *   tin rod: cod 60%, salmon 30%, trout 10%      cobalt rod: cod 40%, salmon 39%, trout 21%
 */
const FISH = {
    cod:    { raw:[3, 1], cooked:[11, 5], poison:0.15, weight:60, perTier:0, color:'#b9ad8f', accent:'#e8e2d0' },
    salmon: { raw:[4, 1], cooked:[15, 7], poison:0.2,  weight:30, perTier:4, grease:0.4, color:'#e98a6c', accent:'#7d8a96' },
    trout:  { raw:[4, 2], cooked:[16, 7], poison:0.15, weight:10, perTier:3, heal:4, color:'#8fa36a', accent:'#d98aa0' },
};
const rawFishId    = k => `raw_${k}`;
const cookedFishId = k => `cooked_${k}`;
for(const [k, f] of Object.entries(FISH)){
    defineElement({ id: rawFishId(k), type:'food', hunger: f.raw[0], satruation: f.raw[1], poison:{ chance: f.poison }, tags:['fish', 'raw_fish'], color: f.color, accent: f.accent, icon:'fish', art:`fish_${k}` });
    defineElement({ id: cookedFishId(k), type:'food', hunger: f.cooked[0], satruation: f.cooked[1], instantHealth: f.heal ?? 0, tags:['fish', 'cooked_fish'], color:'#b07a45', accent: f.color, icon:'fish', art:`fish_${k}`, cooked:true });
}
/** A random fish id (raw) for a rod of this tier. */
function rollFish(tier = 1){
    const w = Object.entries(FISH).map(([k, f]) => [k, Math.max(0, f.weight + (f.perTier ?? 0) * (tier - 1))]);
    let roll = Math.random() * w.reduce((a, [, n]) => a + n, 0);
    for(const [k, n] of w){ roll -= n; if(roll <= 0) return rawFishId(k); }
    return rawFishId(w[0][0]);
}

defineElements([
    // Grease: left over from cooking meat. Makes better torches / lamps and better food.
    { id:'grease', type:'item', tier:1, tags:['grease'], color:'#e8d38a', icon:'grease' },

    // Leather and rubber. Animals drop raw (wet) leather, the drying rack dries it into leather,
    // and the loom works leather + grease into rubber (boats need it).
    { id:'raw_leather', type:'item', tier:0, tags:['hide'],    color:'#8a6a4a', icon:'hide', accent:'#5a4a8a' },
    { id:'leather',     type:'item', tier:1, tags:['leather'], color:'#b07a45', icon:'hide' },
    { id:'rubber',      type:'item', tier:1, tags:['rubber'],  color:'#3f3f46', icon:'rubber' },

    // Dried meat (drying rack): each is food, no poison risk.
    //   jerky = pork + beef dried together,  venison / bear / beef alone give their own kind
    { id:'jerky',         type:'food', hunger:22, satruation:9, tags:['meat', 'dried_meat'], color:'#7a4632', icon:'meat', accent:'#a8604a' },
    { id:'dried_beef',    type:'food', hunger:18, satruation:7,  tags:['meat', 'dried_meat'], color:'#8a4a3a', icon:'meat', accent:'#e8d8c0' },
    { id:'venison_jerky', type:'food', hunger:18, satruation:7,  tags:['meat', 'dried_meat'], color:'#7a3a32', icon:'meat', accent:'#e8d8c0' },
    { id:'bear_jerky',    type:'food', hunger:23, satruation:9, tags:['meat', 'dried_meat'], color:'#6a3028', icon:'meat', accent:'#e8d8c0' },

    // Food made in the cooking pot
    { id:'bread',          type:'food', hunger:18, satruation:7,  color:'#c98a45', icon:'food' },
    { id:'cooked_rice',    type:'food', hunger:15, satruation:7,  color:'#f3efe2', icon:'food', accent:'#8a5a3a' },
    { id:'baked_potato',   type:'food', hunger:13, satruation:6,  color:'#b8844a', icon:'produce', shape:'round', accent:'#6b4a2a' },
    { id:'vegetable_stew', type:'food', hunger:34, satruation:14, thirst:12, instantHealth:4, color:'#c9742e', icon:'food', accent:'#6b4a2a' },

    // Better food (cooked with grease): heals right away and / or regenerates health for a while.
    { id:'fried_potatoes', type:'food', hunger:24, satruation:10, instantHealth:8,  tags:['fine_food'],                  color:'#e0b050', accent:'#8a5a2a', icon:'produce', shape:'round' },
    { id:'garlic_bread',   type:'food', hunger:30, satruation:12, instantHealth:6,  tags:['fine_food'], regen:[0.5, 20], color:'#d9a050', accent:'#f3efe2', icon:'food' },
    { id:'fried_rice',     type:'food', hunger:28, satruation:14, instantHealth:4,  tags:['fine_food'], regen:[0.6, 25], color:'#f0d890', accent:'#c07a3a', icon:'food' },
    { id:'meat_pie',       type:'food', hunger:36, satruation:16, instantHealth:10, tags:['fine_food'], regen:[0.8, 20], color:'#b87838', accent:'#8a3a2a', icon:'food' },
    { id:'hearty_stew',    type:'food', hunger:44, satruation:20, thirst:10, instantHealth:6,  tags:['fine_food'], regen:[1.2, 30], color:'#a84a2a', accent:'#6b4a2a', icon:'food' },

    // Milk a cow with an empty bucket. Drinking it quenches thirst and gives the bucket back.
    { id:'milk_bucket', type:'food', hunger:8, satruation:4, thirst:30, returns:'bucket', stack:1, tags:['milk', 'drink'],
      color:'#9b6b3d', accent:'#f4f1e8', icon:'bucket' },
]);

/**
 * Kitchen food (no heat needed, made at the kitchen table) and more cooking pot dishes. The base foods
 * above are deliberately plain; the more ingredients a dish takes, the more it gives: `fine_food` dishes
 * heal at once (instantHealth) and / or regenerate health for a while (regen:[health/s, seconds]).
 * Recipes are in section 5 (search "Kitchen table").
 */
defineElements([
    // ingredients (made at the kitchen table)
    { id:'flour', type:'item', tier:1, tags:['flour'], color:'#efe6d0', icon:'chunk' },
    { id:'sugar', type:'item', tier:1, tags:['sugar'], color:'#f6f3ea', icon:'chunk', accent:'#d8d2c0' },

    // simple cold food
    { id:'trail_mix',    type:'food', hunger:16, satruation:6,  color:'#a8743a', accent:'#c0405a', icon:'food' },
    { id:'nut_bar',      type:'food', hunger:18, satruation:8,  color:'#b8843c', accent:'#6b4a2a', icon:'food' },
    { id:'berry_jam',    type:'food', hunger:10, satruation:5,  instantHealth:1, color:'#8a2a4a', accent:'#d8d2c0', icon:'food' },
    { id:'jam_sandwich', type:'food', hunger:24, satruation:10, instantHealth:2, color:'#c98a45', accent:'#8a2a4a', icon:'food' },
    { id:'onigiri',      type:'food', hunger:26, satruation:11, instantHealth:3, color:'#f3efe2', accent:'#2f3a30', icon:'food' },

    // salads and sandwiches
    { id:'garden_salad',    type:'food', hunger:22, satruation:9,  thirst:8,  instantHealth:5, tags:['fine_food'], regen:[0.4, 15], color:'#6fae4a', accent:'#d84a3a', icon:'food' },
    { id:'fruit_salad',     type:'food', hunger:20, satruation:8,  thirst:10,  instantHealth:4, tags:['fine_food'], regen:[0.5, 15], color:'#b8405a', accent:'#e8c860', icon:'food' },
    { id:'corn_salad',      type:'food', hunger:24, satruation:10, instantHealth:4, tags:['fine_food'], regen:[0.4, 20], color:'#e8c850', accent:'#d84a3a', icon:'food' },
    { id:'meat_sandwich',   type:'food', hunger:36, satruation:15, instantHealth:6, tags:['fine_food'],                  color:'#c98a45', accent:'#6fae4a', icon:'food' },
    { id:'fish_sandwich',   type:'food', hunger:32, satruation:13, instantHealth:6, tags:['fine_food'], regen:[0.5, 15], color:'#c98a45', accent:'#e98a6c', icon:'food' },
    { id:'no_bake_cake',    type:'food', name:'No-Bake Cake', hunger:42, satruation:18, instantHealth:10, tags:['fine_food'], regen:[1.3, 35], color:'#e8c8a0', accent:'#8a2a4a', icon:'food' },

    // sushi: rice + raw fish
    { id:'cod_sushi',       type:'food', hunger:18, satruation:8,  instantHealth:2, tags:['fine_food', 'sushi'],                  color:'#f3efe2', accent:'#b9ad8f', icon:'fish' },
    { id:'salmon_sushi',    type:'food', hunger:24, satruation:10, instantHealth:4, tags:['fine_food', 'sushi'], regen:[0.5, 15], color:'#f3efe2', accent:'#e98a6c', icon:'fish' },
    { id:'trout_sushi',     type:'food', hunger:26, satruation:11, instantHealth:6, tags:['fine_food', 'sushi'], regen:[0.6, 20], color:'#f3efe2', accent:'#8fa36a', icon:'fish' },
    { id:'sushi_platter',   type:'food', hunger:48, satruation:22, instantHealth:12, tags:['fine_food'], regen:[1.6, 40], color:'#f3efe2', accent:'#e98a6c', icon:'food' },

    // cooking pot: baking (flour and sugar from the kitchen table; grease stands in for butter)
    { id:'cookie',       type:'food', hunger:11, satruation:5,  instantHealth:1, color:'#b8843c', accent:'#4a3220', icon:'food' },
    { id:'pancakes',     type:'food', hunger:26, satruation:11, instantHealth:4, tags:['fine_food'], regen:[0.4, 15], color:'#d9a860', accent:'#8a5a2a', icon:'food' },
    { id:'pizza',        type:'food', hunger:46, satruation:20, instantHealth:8, tags:['fine_food'], regen:[1.0, 30], color:'#d9a050', accent:'#c0402a', icon:'food' },
    { id:'cake',         type:'food', hunger:44, satruation:20, instantHealth:8, tags:['fine_food'], regen:[1.2, 40], color:'#f0d8a8', accent:'#b8405a', icon:'food' },
    { id:'pumpkin_pie',  type:'food', hunger:40, satruation:18, instantHealth:8, tags:['fine_food'], regen:[1.0, 30], color:'#e8862a', accent:'#b87838', icon:'food' },
    { id:'berry_pie',    type:'food', hunger:38, satruation:16, instantHealth:8, tags:['fine_food'], regen:[1.0, 30], color:'#8a2a4a', accent:'#b87838', icon:'food' },
    { id:'dumplings',    type:'food', hunger:28, satruation:12, instantHealth:5, tags:['fine_food'], regen:[0.6, 20], color:'#efe6d0', accent:'#b87838', icon:'food' },

    // cooking pot: soups and stews
    { id:'tomato_soup',  type:'food', hunger:24, satruation:10, thirst:18, instantHealth:5, tags:['fine_food'],                  color:'#d03a2a', accent:'#f3efe2', icon:'food' },
    { id:'pumpkin_soup', type:'food', hunger:30, satruation:13, thirst:15, instantHealth:6, tags:['fine_food'], regen:[0.5, 20], color:'#e8862a', accent:'#f3efe2', icon:'food' },
    { id:'fish_stew',    type:'food', hunger:36, satruation:15, thirst:12, instantHealth:6, tags:['fine_food'], regen:[0.8, 25], color:'#c98a5a', accent:'#e98a6c', icon:'food' },
    { id:'corn_chowder', type:'food', hunger:40, satruation:17, thirst:10, instantHealth:6, tags:['fine_food'], regen:[0.9, 28], color:'#e8c850', accent:'#f3efe2', icon:'food' },
    { id:'curry_rice',   type:'food', hunger:56, satruation:26, instantHealth:10, tags:['fine_food'], regen:[1.6, 45], color:'#c98a2a', accent:'#f3efe2', icon:'food' },
]);

/**
 * Eggs. Chickens lay them where they stand (a creature's `lays`, see Mobs.layTick): an 'egg' block you walk
 * over (like a fern) holding up to EGGS.perCell eggs, picked up by hand (left click, or the wheel's "Pick up").
 * A raw egg is edible but can make you sick; cooked, they go into breakfasts, baking and egg dishes.
 */
const EGGS = { perCell: 3 };
defineElements([
    { id:'egg',         type:'food', hunger:3,  satruation:1, poison:{ chance:0.25 }, tags:['egg'], color:'#f1e6cf', accent:'#d8c8a8', icon:'food' },
    { id:'boiled_egg',  type:'food', hunger:9,  satruation:4, tags:['egg_dish'], color:'#f6f3ea', accent:'#f0c040', icon:'food', cooked:true },
    { id:'fried_egg',   type:'food', hunger:12, satruation:5, instantHealth:1, tags:['egg_dish'], color:'#f6f3ea', accent:'#f0b030', icon:'food', cooked:true },
    { id:'omelette',    type:'food', hunger:26, satruation:11, instantHealth:4, tags:['fine_food', 'egg_dish'], regen:[0.4, 15], color:'#f0d060', accent:'#d84a3a', icon:'food' },
    { id:'egg_fried_rice', type:'food', hunger:32, satruation:15, instantHealth:5, tags:['fine_food'], regen:[0.7, 25], color:'#f0d890', accent:'#f0c040', icon:'food' },
    { id:'egg_drop_soup',  type:'food', hunger:16, satruation:7, thirst:18, instantHealth:3, color:'#f0d890', accent:'#6fae4a', icon:'food' },
    { id:'quiche',      type:'food', hunger:34, satruation:15, instantHealth:6, tags:['fine_food'], regen:[0.8, 20], color:'#e8c060', accent:'#b87838', icon:'food' },
    { id:'muffin',      type:'food', hunger:16, satruation:7, instantHealth:2, color:'#c98a45', accent:'#8a2a4a', icon:'food' },
    // kitchen table
    { id:'egg_sandwich',  type:'food', hunger:24, satruation:10, instantHealth:3, color:'#c98a45', accent:'#f0c040', icon:'food' },
    { id:'deviled_eggs',  type:'food', hunger:18, satruation:8, instantHealth:3, tags:['fine_food'], regen:[0.3, 15], color:'#f6f3ea', accent:'#e8a040', icon:'food' },
    { id:'potato_salad',  type:'food', hunger:26, satruation:11, instantHealth:4, tags:['fine_food'], regen:[0.4, 15], color:'#efe6b8', accent:'#6fae4a', icon:'food' },
    // more pot food without eggs
    { id:'roasted_corn',  type:'food', hunger:10, satruation:4, color:'#e8b040', accent:'#7a9a40', icon:'food', cooked:true },
    { id:'popcorn',       type:'food', hunger:8,  satruation:3, color:'#fbf3d8', accent:'#c0402a', icon:'food' },
    { id:'stuffed_pepper',type:'food', hunger:30, satruation:13, instantHealth:5, tags:['fine_food'], regen:[0.5, 20], color:'#c0402a', accent:'#f3efe2', icon:'food' },
]);
// The egg a chicken lays: walk-over, like a fern, picked up by hand. b.count = eggs in the cell (1..EGGS.perCell).
Blocks.define('egg', {
    kind:'pickup', tag:'plant', solid:false, replaceable:false, color:'#f1e6cf', accent:'#d8c8a8', hardness:-1, tool:null,
    drops: [['egg', 1]],
    dropsFor: b => [['egg', Math.max(1, b.count || 1)]],
    init(b){ if(!b.count) b.count = 1; },
    draw(g, def, b, c){   // a little clutch on a tuft of straw
        g.noStroke(); g.fill(0, 0, 0, 40); g.ellipse(c.x + 1, c.y + 7, 24, 9);
        g.stroke('#b89a58'); g.strokeWeight(1.2);
        for(let k = -3; k <= 3; k++) g.line(c.x + k * 3, c.y + 8, c.x + k * 3.6 + (k % 2 ? 2 : -2), c.y + 3);
        const spots = [[0, 0], [-6, 2], [6, 1]];
        for(let k = 0; k < Math.min(EGGS.perCell, b.count || 1); k++){
            const [dx, dy] = spots[k];
            g.stroke(shade(def.color, -0.35)); g.strokeWeight(1); g.fill(def.color);
            g.ellipse(c.x + dx, c.y + dy, 8, 10);
            g.noStroke(); g.fill(255, 255, 255, 140); g.ellipse(c.x + dx - 1.5, c.y + dy - 2, 2.5, 3.5);
        }
    },
});

/**
 * Drinks (tag 'drink'): mostly thirst, a little food. Smoothies and juices are made cold at the kitchen
 * table, teas are brewed in the cooking pot. Both need water from a canteen / bucket ('@water').
 * Foods with a `thirst` field but no 'drink' tag (soups, stews, fruit salad) are eaten, and quench a bit too.
 */
defineElements([
    { id:'berry_smoothie', type:'food', hunger:6, satruation:3, thirst:30, instantHealth:2, tags:['drink', 'smoothie'], color:'#b8405a', accent:'#f3efe2', icon:'food', art:'smoothie' },
    { id:'green_smoothie', type:'food', hunger:7, satruation:3, thirst:30, instantHealth:3, tags:['drink', 'smoothie', 'fine_food'], regen:[0.3, 15], color:'#7fae4a', accent:'#f3efe2', icon:'food', art:'smoothie' },
    { id:'pumpkin_smoothie', type:'food', hunger:9, satruation:4, thirst:26, instantHealth:3, tags:['drink', 'smoothie'], color:'#e8862a', accent:'#f3efe2', icon:'food', art:'smoothie' },
    { id:'tomato_juice',   type:'food', hunger:4, satruation:2, thirst:28, instantHealth:1, tags:['drink', 'juice'], color:'#d03a2a', accent:'#6fae4a', icon:'food', art:'juice' },
    { id:'carrot_juice',   type:'food', hunger:4, satruation:2, thirst:28, instantHealth:1, tags:['drink', 'juice'], color:'#e87a2a', accent:'#6fae4a', icon:'food', art:'juice' },
    { id:'sugar_cane_juice', type:'food', hunger:3, satruation:1, thirst:32, tags:['drink', 'juice'], color:'#c8e0a0', accent:'#7fbf5a', icon:'food', art:'juice' },
    { id:'ginger_tea',     type:'food', hunger:2, satruation:1, thirst:34, instantHealth:3, tags:['drink', 'tea'], color:'#c8a050', accent:'#f3efe2', icon:'food', art:'tea' },
    { id:'berry_tea',      type:'food', hunger:2, satruation:1, thirst:34, instantHealth:2, tags:['drink', 'tea'], color:'#8a2a4a', accent:'#f3efe2', icon:'food', art:'tea' },
    { id:'corn_tea',       type:'food', hunger:3, satruation:1, thirst:34, tags:['drink', 'tea'], color:'#c89a40', accent:'#f3efe2', icon:'food', art:'tea' },
    { id:'spiced_tea',     type:'food', hunger:4, satruation:2, thirst:40, instantHealth:4, tags:['drink', 'tea', 'fine_food'], regen:[0.5, 20], color:'#a8602a', accent:'#f3efe2', icon:'food', art:'tea' },
]);
/** A drink (smoothie, tea, milk): drunk, not eaten (tag 'drink'). */
const isDrink = item => !!(item && item.hasTag && item.hasTag('drink'));

defineElements([
    // Biotics: hemp + rotten flesh brewed in the cooking pot. Not food, it's what bandages are made with.
    { id:'biotics', type:'item', tier:2, tags:['biotic'], color:'#7fae5a', icon:'grease', accent:'#3f6a3a' },
    // Bandage (loom): heals 15 at once. One cooldown is shared by every bandage, so you can't chain them.
    { id:'bandage', type:'item', stack:16, tags:['bandage'], color:'#efe6d0', accent:'#c0402a', icon:'bandage',
      build: id => new Material(id, 16, 2).package(new Bandage(BANDAGE.heal, BANDAGE.cooldown)) },
]);

// Melee weapons: one cell of reach (you must stand next to the target, like mining).
Items.define('wooden_sword', id => new Sword(id, 7, 4, 1, 0, 80).addTag('melee'), { color:'#b98d55', icon:'sword' });
for(const m of WEAPON_METALS){
    const t = gearTier(m);
    Items.define(`${m}_sword`, id => new sWeapon(id, m, 4 + 3 * t, 4, 1, 0, 90 + 45 * t).addTag('sword', 'melee'), { color:MATERIAL_COLORS[m], icon:'sword' });
}
// Ranged weapons: shoot arrows from a distance (range in cells).
Items.define('bow',      id => new Bow(id, 1, 25, 'arrow', 0, 800, 'arrow', 150, 20).package(new Launcher(5, 1.0, 1.0)), { color:'#9a6b3a', icon:'bow' });
Items.define('crossbow', id => new Bow(id, 1, 25, 'arrow', 0, 800, 'arrow', 260, 30).package(new Launcher(7, 1.6, 1.6)).addTag('crossbow'), { color:'#7a5a3a', icon:'crossbow' });
Items.define('flint_arrow', id => new Ammo(id, 'arrow', 5, 0, 100).addTag('arrow'), { color:'#4a4a55', icon:'arrow' });
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
Items.define('canteen', id => new Canteen(id, 3), { color:'#7a8f9a', icon:'canteen' });
Items.define('bucket',  id => new Bucket(id, 10),  { color:'#9b6b3d', icon:'bucket' });



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
        drops: id === 'gravel' ? [{ id:'gravel', linked:true, priority:0 }, { id:'flint', chance:0.5, linked:true, priority:1 }] : [[id, 1]],   // gravel: 50% flint, otherwise the gravel itself
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
for(const id of Crops.ids()) registerCropBlock(id);

// Ferns: walk-through ground cover. Gather them for plant fibers (and sometimes a seed).
Blocks.define('fern', {
    kind:'fern', tag:'plant', solid:false, replaceable:true, color:'#4f9a46', hardness:-1, tool:'hoe',
    drops: [['plant_fiber', 1]],
});

// Farmland: tilled grass that holds water (FARM.waterMax) and works like a container (open it with E or the wheel):
// FARM.slots seedling slots (one seed each, all the same crop, each grows on its own) and a water slot that pours
// a bucket / canteen into the soil. Solid for the player only, so the crops don't get trampled.
// State: b.water, b.seeds (Box), b.intake (Box, 1 slot), b.plants[k] = { crop, age, dry, item } for seed slot k.
Blocks.define('farmland', {
    kind:'farmland', tag:'farmland', station:'farmland', passableFor:['animal', 'zombie'], color:'#6b4a2e', hardness:0.3, tool:'hoe',
    drops: [],
    dropsFor: b => {   // the seeds in its slots come back
        const n = {};
        for(const it of (b.seeds ? b.seeds.items : [])) if(it) n[it.id] = (n[it.id] || 0) + it.count;
        return Object.entries(n);
    },
    init(b){ initFarmland(b); },
});
Object.defineProperty(STATION_TITLES, 'farmland', { get: () => nameOf('farmland'), enumerable: true, configurable: true });

// Stations, containers, base building and the boat. Each spec makes the item, the block and the recipe that crafts it
// (see defineElement). Zombies shamble through workbenches / looms / cooking pots / drying racks / chests (but not doors or the forge).
/*
 * Heart Stone: a station with its own menu. Placing it moves your spawn point next to it, and it slowly
 * repairs blocks monsters have damaged (their `cracks`) within its radius, continuously through the day.
 * Each upgrade has HEART_STONE.maxLevel levels; costs[k] is the price of going from level k+1 to k+2.
 */
const HEART_STONE = {
    maxLevel: 5,
    radius: [3, 4, 5, 6, 7],                   // repair radius in cells, per level
    rate:   [0.02, 0.05, 0.09, 0.14, 0.20],    // share of a block's health repaired per in game day, per level
    costs: {
        radius: [
            { oak_log:10, tin_ingot:4 },
            { pine_log:12, copper_ingot:5 },
            { ash_log:14, iron_ingot:6 },
            { cedar_log:16, steel_ingot:6, gold_ingot:2 },
        ],
        rate: [
            { cedar_log:10, zinc_ingot:4 },
            { oak_log:12, bronze_ingot:5 },
            { pine_log:14, nickel_ingot:6 },
            { ash_log:16, galvanized_steel_ingot:6, gold_ingot:2 },
        ],
    },
};

defineElements([
    // ----- stations -----
    // the stations' texts (verbs, idle text, blurbs...) are in THEAYA_TEXT: 'station.<station>.<field>'
    { id:'workbench', type:'workbench', icon:'workbench', color:'#9b6b3d', also:['hand'], recipe:{ at:'hand', input:{ '#planks':4 } } },
    { id:'loom',      type:'workbench', icon:'loom',      color:'#a8834f', search:false, recipe:{ input:{ plant_fiber:5, oak_log:4, stone:2 } } },
    {   // a recipe menu for food that needs no heat (see "Kitchen table" in section 5)
        id:'kitchen_table', type:'workbench', workbenchTag:'kitchen', icon:'kitchen', color:'#c9a878', accent:'#e8e2d0',
        draw(g, def, b, c){   // a counter with a cutting board, a knife and a bowl
            g.noStroke(); g.fill(shade(def.color, -0.35)); g.rect(c.x - 13, c.y + 5, 4, 8); g.rect(c.x + 9, c.y + 5, 4, 8);
            g.fill(def.color); g.stroke(shade(def.color, -0.4)); g.strokeWeight(1.2); g.rect(c.x - 16, c.y - 9, 32, 15, 2);
            g.noStroke(); g.fill('#8a6a3a'); g.rect(c.x - 12, c.y - 7, 14, 9, 2);                     // cutting board
            g.fill('#d8dde2'); g.rect(c.x - 9, c.y - 3, 8, 2); g.fill('#6b4a2a'); g.rect(c.x - 1, c.y - 3, 4, 2);   // knife
            g.fill('#e8e2d0'); g.ellipse(c.x + 8, c.y - 2, 10, 6);                                     // bowl
            g.fill('#6fae4a'); g.ellipse(c.x + 8, c.y - 3, 6, 3);
        },
        recipe:{ input:{ ash_planks:6, stick:2, stone:1 } },
    },
    {   // a cooking pot is a machine: slots + one recipe at a time + fuel
        id:'cooking_pot', type:'workbench', workbenchTag:'pot', icon:'pot', color:'#5a5f66', tag:'stone', hardness:0.8, tool:'pickaxe',
        slots:{ input:4, fuel:1, output:2 },
        machine:{ fuelSeconds:12, fancyFirst:true, light:70, accepts: isCookable },
        recipe:{ input:{ clay:3, stone:2, stick:2 } },
    },
    {
        id:'forge', type:'workbench', icon:'furnace', color:'#8a6656', tag:'stone', hardness:1, tool:'pickaxe', passableFor:[],
        slots:{ input:4, fuel:1, output:2 },
        machine:{ fuelSeconds:12, light:95, accepts: isSmeltable },
        recipe:{ input:{ stone:6, clay:4 } },
    },
    {   // no fuel slot = needs no fuel
        id:'drying_rack', type:'workbench', workbenchTag:'rack', icon:'rack', color:'#a8834f',
        slots:{ input:4, output:2 },
        machine:{ fancyFirst:true, accepts: isDryable },
        draw(g, def, b, c){   // a wooden frame with strips of meat and hide hanging on it
            g.stroke(shade(def.color, -0.5)); g.strokeWeight(3);
            g.line(c.x - 14, c.y + 13, c.x - 14, c.y - 12); g.line(c.x + 14, c.y + 13, c.x + 14, c.y - 12); g.line(c.x - 16, c.y - 10, c.x + 16, c.y - 10);
            g.line(c.x - 14, c.y + 13, c.x - 18, c.y + 14); g.line(c.x + 14, c.y + 13, c.x + 18, c.y + 14);
            g.noStroke();
            const full = !!b._full;
            g.fill('#9a4a3a'); g.rect(c.x - 10, c.y - 8, 5, full ? 14 : 10, 2);
            g.fill('#b07a45'); g.rect(c.x - 2, c.y - 8, 7, full ? 17 : 12, 2);
            g.fill('#7a3a32'); g.rect(c.x + 8, c.y - 8, 4, full ? 12 : 9, 2);
        },
        recipe:{ input:{ pine_planks:4, stick:4, plant_fiber:2 } },
    },
    { id:'chest', type:'container', icon:'chest', color:'#a0703a', slots: CHEST_SLOTS, recipe:{ input:{ '#planks':8 } } },
    {   // spawn point + slow repairs around it (see HEART_STONE, tickHeartStones, drawHeartStonePanel)
        id:'heart_stone', type:'workbench', icon:'heart_stone', color:'#7d7a86', accent:'#e0506e', tag:'stone', hardness:1.2, tool:'pickaxe',
        block:{ passableFor:[], light:40 },
        panel:{ w:470, h:300, draw: (s, b, L) => drawHeartStonePanel(s, b, L) },
        init(b){ if(b.radiusLvl == null) b.radiusLvl = 1; if(b.rateLvl == null) b.rateLvl = 1; },
        onPlace(x, y){ setHeartSpawn(cellIndex(x, y)); },
        draw(g, def, b, c){   // a stone plinth with a glowing heart-shaped crystal on top
            g.fill(shade(def.color, -0.15)); g.stroke(shade(def.color, -0.5)); g.strokeWeight(1.5);
            g.rect(c.x - 14, c.y + 2, 28, 11, 3);
            g.fill(def.color); g.rect(c.x - 10, c.y - 2, 20, 6, 2);
            g.noStroke(); g.fill(224, 80, 110, 70); g.ellipse(c.x, c.y - 9, 26, 24);   // glow
            g.fill(def.accent); g.stroke(shade(def.accent, -0.45)); g.strokeWeight(1.2);
            g.beginShape();
            g.vertex(c.x, c.y - 1);
            g.bezierVertex(c.x - 13, c.y - 9, c.x - 8, c.y - 20, c.x, c.y - 14);
            g.bezierVertex(c.x + 8, c.y - 20, c.x + 13, c.y - 9, c.x, c.y - 1);
            g.endShape(CLOSE);
            g.noStroke(); g.fill(255, 255, 255, 150); g.ellipse(c.x - 4, c.y - 12, 4, 3);
        },
        recipe:{ input:{ stone:12, clay:4, tin_ingot:2 } },
    },

    // ----- the boat: sits on a water cell. Step onto it from the shore and you're aboard: every water cell is walkable for you
    //       and the boat sails along with you. Step onto land and you leave it where it is. Break it (axe, by hand) to get it back.
    {
        id:'boat', type:'block', kind:'boat', tool:'axe', hardness:0.5, cellBehavior:'passable', color:'#a77b4a', icon:'boat', accent:'#3f3f46', tags:['boat'],
        recipe:{ input:{ '#planks':8, rubber:4 } },
    },

    // ----- base building -----
    { id:'wooden_wall', type:'block', kind:'wall', tool:'axe', tag:'wood', siege:'wood', hardness:0.8, color:'#a77b4a', icon:'wall', tags:['wall'],
      recipe:{ input:{ '#planks':3 }, count:2 } },
    { id:'stone_wall', type:'block', kind:'wall', tool:'pickaxe', tier:1, tag:'stone', siege:'stone', hardness:1.4, color:'#8d8d8d', icon:'wall', tags:['wall'],
      recipe:{ input:{ stone:3 }, count:2 } },
    { id:'wooden_door', type:'block', kind:'door', tool:'axe', tag:'wood', siege:'wood', hardness:0.6, passableFor:['player'], color:'#93683c', icon:'door', tags:['door'],
      recipe:{ input:{ '#planks':4, stick:2 } } },
    // stone door: monsters break it like a stone wall (siege 'stone'); only the player walks through
    { id:'stone_door', type:'block', kind:'door', tool:'pickaxe', tier:1, tag:'stone', siege:'stone', hardness:1.2, passableFor:['player'], color:'#8d8d8d', icon:'door', tags:['door'],
      recipe:{ input:{ stone:5, stick:2 } } },
    { id:'glass', type:'block', kind:'glass', tag:'stone', siege:'glass', hardness:0.3, color:'#bfe3ea', icon:'glass', stack:16,
      recipe:{ at:'forge', input:{ sand:1 }, time:8 } },

    // ----- lights -----
    // Torch: lights the area around it and stops hostile creatures spawning nearby. You walk over it.
    { id:'torch', type:'block', kind:'torch', tag:'wood', hardness:-1, cellBehavior:'passable', emitLight: TORCH.light, safe: TORCH.safe,
      color:'#ffb347', icon:'torch', tags:['torch', 'light'], stack:50,
      recipe:[ { at:'hand', input:{ stick:1, coal:1 }, count:4 },
               { at:'hand', input:{ stick:2, plant_fiber:2 }, count:2, recipeId:'hand:torch_fiber' } ] },   // before you have coal
    // Better lights made with grease: a brighter torch, and an oil lamp (brightest, keeps monsters furthest away)
    { id:'grease_torch', type:'block', kind:'torch', tag:'wood', hardness:-1, cellBehavior:'passable', emitLight: TORCH.greaseLight, safe: TORCH.greaseSafe,
      color:'#ffd27a', icon:'torch', accent:'#e8d38a', tags:['torch', 'light'], stack:50,
      recipe:{ at:'hand', input:{ stick:2, grease:1, plant_fiber:1 }, count:4 } },   // brighter, keeps monsters further away
    { id:'oil_lamp', type:'block', kind:'lamp', tag:'stone', hardness:-1, cellBehavior:'passable', emitLight: TORCH.lampLight, safe: TORCH.lampSafe,
      color:'#b0745a', icon:'lamp', tags:['lamp', 'light'],
      recipe:{ input:{ clay:2, grease:2, thread:1 } } },   // the brightest light
]);

/* ----- Goblin camp (a structure, see Structures and the 'goblin' creature) -----
 * Only found in forests: a clearing with a campfire, the camp's banner, hide tents and a stash, inside a
 * broken ring of palisade stakes. Its goblins live there and come back over time while the banner stands;
 * cut the banner down and the camp is abandoned. None of these blocks can be crafted or placed (item:false),
 * except the stash: break it once it's empty and you keep it as a chest.
 */
defineElements([
    { id:'goblin_tent', type:'block', kind:'tent', tool:'axe', tag:'wood', hardness:0.6, cellBehavior:'blocked', built:false, item:false,
      color:'#9a7a50', drop:[ { id:'leather', amount:[1, 2] }, { id:'stick', amount:[1, 2] } ],
      draw(g, def, b, c){   // a hide tent on crossed poles, a dark flap in front
          g.noStroke(); g.fill(0, 0, 0, 50); g.ellipse(c.x + 3, c.y + 11, 36, 10);
          g.fill(shade(def.color, -0.2)); g.stroke(shade(def.color, -0.5)); g.strokeWeight(1.4);
          g.triangle(c.x - 17, c.y + 11, c.x + 17, c.y + 11, c.x, c.y - 15);
          g.noStroke(); g.fill(def.color); g.triangle(c.x - 16, c.y + 10, c.x - 2, c.y + 10, c.x, c.y - 13);   // the sunlit side
          g.fill('#2a1d12'); g.triangle(c.x - 5, c.y + 11, c.x + 6, c.y + 11, c.x + 1, c.y - 3);                 // the way in
          g.stroke('#5a3d26'); g.strokeWeight(2); g.line(c.x - 2, c.y - 12, c.x - 6, c.y - 19); g.line(c.x + 2, c.y - 12, c.x + 6, c.y - 19);
      } },
    { id:'goblin_banner', type:'block', kind:'banner', tool:'axe', tag:'wood', hardness:0.7, cellBehavior:'blocked', built:false, item:false,
      color:'#4f7a2a', accent:'#c0392b', drop:[ { id:'stick', amount:[2, 3] }, { id:'leather', amount:1 } ],
      draw(g, def, b, c){   // a pole with a ragged war banner, a bone on top
          g.noStroke(); g.fill(0, 0, 0, 45); g.ellipse(c.x + 2, c.y + 11, 16, 6);
          g.stroke('#4a3220'); g.strokeWeight(3); g.line(c.x - 6, c.y + 11, c.x - 6, c.y - 18);
          g.noStroke(); g.fill(def.color);
          g.beginShape(); g.vertex(c.x - 5, c.y - 17); g.vertex(c.x + 13, c.y - 15); g.vertex(c.x + 9, c.y - 10); g.vertex(c.x + 14, c.y - 4); g.vertex(c.x - 5, c.y - 3); g.endShape(CLOSE);
          g.fill(def.accent); g.circle(c.x + 4, c.y - 10, 6);
          g.fill('#e8dcc0'); g.ellipse(c.x - 6, c.y - 20, 9, 4);
      } },
    { id:'goblin_campfire', type:'block', kind:'campfire', tool:'shovel', tag:'dirt', hardness:0.4, cellBehavior:'blocked', built:false, item:false,
      emitLight: 170, color:'#8d8a85', drop:[ { id:'coal', amount:[1, 2] }, { id:'stick', amount:1, chance:0.5 } ],
      draw(g, def, b, c){   // a ring of stones around crossed logs (the flames are drawn live, see worldOverlay)
          g.noStroke(); g.fill(0, 0, 0, 50); g.ellipse(c.x + 2, c.y + 6, 32, 14);
          g.fill('#2b2420'); g.ellipse(c.x, c.y + 2, 22, 13);
          g.stroke('#4a3220'); g.strokeWeight(4); g.line(c.x - 9, c.y + 6, c.x + 8, c.y - 2); g.line(c.x - 8, c.y - 2, c.x + 9, c.y + 6);
          g.stroke(shade(def.color, -0.4)); g.strokeWeight(1.2); g.fill(def.color);
          for(let k = 0; k < 8; k++){ const a = k * Math.PI / 4; g.circle(c.x + Math.cos(a) * 14, c.y + 2 + Math.sin(a) * 8, 6); }
      } },
    // a fence of stakes: it stops you, creatures and arrows, but not eyes (kind 'fence', not 'wall': see blocksSight).
    // Monsters hack through it like wood (siege 'wood'); it's the camp's, so it doesn't count as built by you
    { id:'goblin_palisade', type:'block', kind:'fence', tool:'axe', tag:'wood', siege:'wood', hardness:0.9, built:false, item:false,
      color:'#8a6238', drop:[ { id:'stick', amount:[1, 2] } ],
      draw(g, def, b, c){   // sharpened stakes lashed together
          g.noStroke(); g.fill(0, 0, 0, 45); g.ellipse(c.x + 2, c.y + 12, 34, 9);
          g.stroke(shade(def.color, -0.45)); g.strokeWeight(1.2);
          for(let k = -2; k <= 2; k++){
              const x0 = c.x + k * 6.5, top = c.y - 15 + Math.abs(k) * 1.5 - (k & 1 ? 2 : 0);
              g.fill(k & 1 ? shade(def.color, -0.12) : def.color);
              g.beginShape(); g.vertex(x0 - 3, c.y + 12); g.vertex(x0 - 3, top + 5); g.vertex(x0, top); g.vertex(x0 + 3, top + 5); g.vertex(x0 + 3, c.y + 12); g.endShape(CLOSE);
          }
          g.stroke('#5a4a2a'); g.strokeWeight(2); g.line(c.x - 15, c.y - 1, c.x + 15, c.y - 1);
      } },
    // the camp's loot (filled when the world is made, see the structure's `loot`)
    { id:'goblin_stash', type:'container', icon:'chest', color:'#6b5032', slots: 6 },
]);
defineElements([
    {   // goblins live here (see the 'goblin' creature): only in forests, a few per world, away from your camp
        id:'goblin_camp', type:'structure', biomes:['forest'], count:[2, 3], radius:4, minDist:14, spacing:14,
        hostile:true,                          // the difficulty sets how many there are and how fast they come back
        heart:'goblin_banner',
        notice:'camp.near', noticeDist:10,     // said once, the first time you come this close
        abandonedNotice:'camp.abandoned',      // said when its banner is cut down
        respawn:{ days:7, count:1, dist:24 },  // every camp's banner down for 7 game days: goblins build a new one, out of sight
        respawnNotice:'camp.returned',
        parts:[
            { at:[0, 0], block:'goblin_campfire' },
            { ring:4, block:'goblin_palisade', gaps:3, gapWidth:2, chance:0.85 },   // three ways in, and a few stakes down
            { scatter:1, block:'goblin_banner', ring:1 },
            { scatter:[2, 3], block:'goblin_tent', ring:[2, 3], apart:2 },
            { scatter:1, block:'goblin_stash', ring:[1, 2], loot:[
                { choose: ingotsUpToTier(3), amount:[2, 5] }, { id:'leather', amount:[1, 3] },
                { id:'flint_arrow', amount:[4, 10], chance:0.7 }, { id:'bandage', chance:0.35 },
            ] },
        ],
        creatures:[ { id:'goblin', count:[3, 5], respawn:240, respawnDist:14 } ],
    },
]);




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
        if(key === '@water') return T('recipe.water');
        return key.startsWith('#') ? T('recipe.anyTag', { tag: nameOf(key.slice(1)) }) : nameOf(key);
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
Content.flush();   // recipes queued by defineStation / defineBlock / defineRecipes (made before this class existed)

// Hand (inventory screen)
for(const t of logTypes) Recipe.add('hand', `${t}_planks:4`, { [`${t}_log`]:1 });
Recipe.add('hand', 'stick:4',   { '#planks':2 });
Recipe.add('hand', 'clay:2',    { dirt:1, gravel:1, '@water':1 });   // wet dirt + gravel = clay

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
// Fishing rods: one ingot for the hook, sticks for the rod, the tier's binding for the line.
for(const m of materialsFor('tool')) Recipe.add('workbench', `${m}_fishing_rod`, { [ingotOf(m)]:1, stick:3, ...bind(gearTier(m), 2) });
for(const m of WEAPON_METALS){
    Recipe.add('workbench', `${m}_sword`,   { [ingotOf(m)]:2, stick:1, ...bind(gearTier(m)) });
    Recipe.add('workbench', `${m}_arrow:6`, { [ingotOf(m)]:1, stick:2, ...bind(gearTier(m), 1) });
}
// Metal armor: ingots + a fabric lining (cloth up to tier 3, silk above).
for(const m of ARMOR_METALS){
    const t = gearTier(m), lining = t <= 3 ? 'cloth' : 'silk';
    ARMOR_PIECES.forEach((p, k) => Recipe.add('workbench', ARMOR_SETS[m].pieces[k], { [ingotOf(m)]: p.cost, [lining]: Math.ceil(p.cost / 2) }));
}
Recipe.add('workbench', 'canteen',        { '#planks':3 });
Recipe.add('workbench', 'bucket',         { '#planks':5, plant_fiber:3 });

// Loom: refine fibers and fabric, and sew fabric armor.
Recipe.add('loom', 'thread',  { plant_fiber:3 });
Recipe.add('loom', 'cloth',   { hemp:3 });
Recipe.add('loom', 'silk',    { cloth:2, thread:2 });
Recipe.add('loom', 'rubber:2', { leather:2, grease:1 });   // boats are sealed with it
Recipe.add('loom', 'bandage',  { cloth:3, biotics:1 });    // heals, with a cooldown (see BANDAGE)
for(const fab of ['cloth', 'silk']){
    ARMOR_PIECES.forEach((p, k) => Recipe.add('loom', ARMOR_SETS[fab].pieces[k], { [fab]: p.cost, thread: 1 }));
}

// Cooking pot (works like the forge: see POT). It only makes food. '@water' comes
// from a canteen / bucket put in its input slots. Meat can leave grease behind.
for(const [k, m] of Object.entries(MEATS)){
    if(!m.cooked) continue;
    Recipe.add('pot', cookedMeatId(k), { [rawMeatId(k)]:1 }, { time: 10, byproduct: m.grease ? { id:'grease', count:1, chance: m.grease } : null });
}
for(const [k, f] of Object.entries(FISH)){
    Recipe.add('pot', cookedFishId(k), { [rawFishId(k)]:1 }, { time: 8, byproduct: f.grease ? { id:'grease', count:1, chance: f.grease } : null });
}
Recipe.add('pot', 'bread',          { flour:3 },                                 { time: 12 });   // flour from the kitchen table (2 wheat -> 3 flour)
Recipe.add('pot', 'cooked_rice',    { rice:2, '@water':1 },                      { time: 12 });
Recipe.add('pot', 'baked_potato',   { potato:1 },                                { time: 8 });
Recipe.add('pot', 'vegetable_stew', { carrot:1, potato:1, onion:1, '@water':1 }, { time: 16 });
// Better food, cooked with grease (heals and / or regenerates health, see FINE_FOODS)
Recipe.add('pot', 'fried_potatoes', { potato:2, grease:1 },                      { time: 10 });
Recipe.add('pot', 'garlic_bread',   { bread:1, garlic:1, grease:1 },             { time: 10 });
Recipe.add('pot', 'fried_rice',     { cooked_rice:1, onion:1, grease:1 },        { time: 12 });
Recipe.add('pot', 'meat_pie',       { flour:2, '#cooked_meat':1, grease:1 },     { time: 18 });
// (a pot has 4 input slots and each kind of ingredient takes one, the canteen of water included: a recipe never has more than 4 kinds)
Recipe.add('pot', 'hearty_stew',    { '#cooked_meat':1, carrot:1, grease:1, '@water':1 }, { time: 20 });   // was 5 kinds, which never fit
// Baking (flour and sugar come from the kitchen table; grease stands in for butter)
Recipe.add('pot', 'cookie:3',       { flour:2, sugar:1, nuts:1 },                { time: 12 });
Recipe.add('pot', 'pancakes',       { flour:2, egg:1, sugar:1, grease:1 },       { time: 14 });
Recipe.add('pot', 'dumplings:2',    { flour:2, '#cooked_meat':1, onion:1, '@water':1 }, { time: 18 });
Recipe.add('pot', 'pizza',          { flour:3, tomato:2, '#cooked_meat':1, grease:1 },  { time: 24 });
Recipe.add('pot', 'cake',           { flour:3, sugar:2, egg:2, berries:2 },      { time: 26 });
Recipe.add('pot', 'pumpkin_pie',    { flour:2, pumpkin:1, sugar:1, egg:1 },      { time: 22 });
Recipe.add('pot', 'berry_pie',      { flour:2, berries:4, sugar:1, grease:1 },   { time: 22 });
// Soups and stews
Recipe.add('pot', 'tomato_soup',    { tomato:3, garlic:1, '@water':1 },          { time: 14 });
Recipe.add('pot', 'pumpkin_soup',   { pumpkin:1, onion:1, garlic:1, '@water':1 }, { time: 16 });
Recipe.add('pot', 'fish_stew',      { '#raw_fish':1, potato:1, onion:1, '@water':1 }, { time: 18 });
Recipe.add('pot', 'corn_chowder',   { corn:2, potato:1, '#cooked_meat':1, '@water':1 }, { time: 20 });
Recipe.add('pot', 'curry_rice',     { cooked_rice:2, '#cooked_meat':2, pepper:2, '@water':2 }, { time: 30 });
// Eggs (chickens lay them, see EGGS). The pot tries the dish with the most kinds first, so an egg with
// water boils, with grease fries, and with onion + pepper + grease makes an omelette.
// (No two pot recipes may use exactly the same kinds: the first one listed would always win.)
Recipe.add('pot', 'boiled_egg',     { egg:1, '@water':1 },                       { time: 8 });
Recipe.add('pot', 'fried_egg',      { egg:1, grease:1 },                         { time: 6 });
Recipe.add('pot', 'omelette',       { egg:2, onion:1, pepper:1, grease:1 },      { time: 14 });
Recipe.add('pot', 'egg_fried_rice', { cooked_rice:1, egg:1, onion:1, grease:1 }, { time: 14 });
Recipe.add('pot', 'egg_drop_soup',  { egg:1, onion:1, '@water':1 },              { time: 12 });
Recipe.add('pot', 'quiche',         { flour:2, egg:2, onion:1, grease:1 },       { time: 22 });
Recipe.add('pot', 'muffin:2',       { flour:2, egg:1, berries:2 },               { time: 16 });
// More from the pot
Recipe.add('pot', 'roasted_corn',   { corn:1 },                                  { time: 8 });
Recipe.add('pot', 'popcorn:3',      { corn:2, grease:1 },                        { time: 8 });
Recipe.add('pot', 'stuffed_pepper', { pepper:2, cooked_rice:1, '#cooked_meat':1, tomato:1 }, { time: 20 });
// Teas (drinks): brewed with water
Recipe.add('pot', 'ginger_tea:2',   { ginger:1, '@water':1 },                    { time: 8 });
Recipe.add('pot', 'corn_tea:2',     { corn:1, '@water':1 },                      { time: 8 });
Recipe.add('pot', 'berry_tea:2',    { berries:2, sugar:1, '@water':1 },          { time: 8 });
Recipe.add('pot', 'spiced_tea:2',   { ginger:1, pepper:1, sugar:1, '@water':1 }, { time: 10 });
{   // two pot recipes with the same kinds of ingredients: only the first could ever be made
    const seen = new Map();
    for(const r of Recipe.for('pot')){
        const k = Object.keys(r.inputs).sort().join('+');
        if(seen.has(k)) console.warn(`Cooking pot recipes '${seen.get(k)}' and '${r.id}' use the same ingredients: '${r.id}' can never be made.`);
        else seen.set(k, r.id);
    }
}
Recipe.add('pot', 'biotics',       { hemp:2, rotten_flesh:1 },                  { time: 45 });   // not food: the one thing the pot makes for bandages
for(const r of Recipe.for('pot')) if(r.output.id !== 'biotics' && !Items.create(r.output.id).has('consume')) console.warn(`Cooking pot recipe '${r.id}' doesn't make food: the pot only cooks food.`);

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

// Kitchen table: food that needs no heat. It's a plain recipe menu, so the ingredients come from your
// inventory and a dish is made at once. Cooked ingredients (rice, bread, meat) still come from the pot.
Recipe.add('kitchen', 'flour:3',          { wheat:2 });
Recipe.add('kitchen', 'sugar:3',          { sugar_cane:2 });
Recipe.add('kitchen', 'trail_mix:2',      { nuts:3, berries:2 });
Recipe.add('kitchen', 'nut_bar:2',        { nuts:2, sugar:1 });
Recipe.add('kitchen', 'berry_jam:2',      { berries:4, sugar:2 });
Recipe.add('kitchen', 'jam_sandwich',     { bread:1, berry_jam:1 });
Recipe.add('kitchen', 'onigiri:2',        { cooked_rice:2, '#cooked_fish':1 });
Recipe.add('kitchen', 'garden_salad',     { lettuce:2, tomato:1, carrot:1, onion:1 });
Recipe.add('kitchen', 'fruit_salad',      { berries:4, nuts:1, sugar:1 });
Recipe.add('kitchen', 'corn_salad',       { corn:2, tomato:1, onion:1, pepper:1 });
Recipe.add('kitchen', 'meat_sandwich',    { bread:1, lettuce:1, tomato:1, '#cooked_meat':1 });
Recipe.add('kitchen', 'fish_sandwich',    { bread:1, lettuce:1, onion:1, '#cooked_fish':1 });
// Sushi: cooked rice + a raw fish (the sushi itself is safe to eat). Three of them with ginger make a platter.
for(const k of Object.keys(FISH)) Recipe.add('kitchen', `${k}_sushi:2`, { cooked_rice:1, [rawFishId(k)]:1 });
Recipe.add('kitchen', 'sushi_platter',    { cod_sushi:1, salmon_sushi:1, trout_sushi:1, ginger:1 });
Recipe.add('kitchen', 'no_bake_cake',     { bread:2, berry_jam:2, nut_bar:1, sugar:2 });
// Egg dishes (boil the eggs in the pot first)
Recipe.add('kitchen', 'egg_sandwich',     { bread:1, boiled_egg:1, lettuce:1 });
Recipe.add('kitchen', 'deviled_eggs:2',   { boiled_egg:2, pepper:1 });
Recipe.add('kitchen', 'potato_salad',     { baked_potato:2, boiled_egg:1, onion:1 });
// Smoothies and juices (drinks): blended cold with water from a canteen / bucket
Recipe.add('kitchen', 'berry_smoothie',   { berries:3, sugar:1, '@water':1 });
Recipe.add('kitchen', 'green_smoothie',   { lettuce:1, berries:2, nuts:1, '@water':1 });
Recipe.add('kitchen', 'pumpkin_smoothie', { pumpkin:1, sugar:1, '@water':1 });
Recipe.add('kitchen', 'tomato_juice',     { tomato:2, '@water':1 });
Recipe.add('kitchen', 'carrot_juice',     { carrot:2, '@water':1 });
Recipe.add('kitchen', 'sugar_cane_juice', { sugar_cane:2, '@water':1 });
for(const r of Recipe.for('kitchen')) if(!Items.create(r.output.id).has('consume') && !['flour', 'sugar'].includes(r.output.id)) console.warn(`Kitchen recipe '${r.id}' doesn't make food.`);

// Drying rack (works like the cooking pot but burns nothing: see RACK). It picks the recipe
// that uses the most kinds of ingredients first, so pork + beef make jerky while pork alone
// makes raw bacon (cook it in the pot).
Recipe.add('rack', 'leather',       { raw_leather:1 },                  { time: 20 });
Recipe.add('rack', 'leather',       { rotten_flesh:5 },                 { time: 40, id: 'rack:leather_from_flesh' });   // dried-out rotten flesh cures into leather
Recipe.add('rack', 'jerky',         { raw_pork:1, raw_beef:1 },         { time: 30 });
Recipe.add('rack', 'raw_bacon',     { raw_pork:1 },                     { time: 24 });
Recipe.add('rack', 'dried_beef',    { raw_beef:1 },                     { time: 24 });
Recipe.add('rack', 'venison_jerky', { raw_venison:1 },                  { time: 24 });
Recipe.add('rack', 'bear_jerky',    { raw_bear_meat:1 },                { time: 28 });
/** Can this item go into a drying rack input slot (raw leather, raw meat that has a dried form)? */
function isDryable(item){
    if(!item) return false;
    return Recipe.for('rack').some(r => Object.keys(r.inputs).some(k => Recipe.matches(item, k)));
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
    give(item, hotbarFirst = false){
        if(!(item instanceof Item) || item.count <= 0) return 0;
        if(item.getMaxStack() > 1){
            for(const s of [...this.hotbarSlotList, ...this.backpackSlots]){
                const st = this[s];
                if(st && st !== item && st.canStackWith(item)) st.mergeFrom(item);
                if(item.count <= 0) break;
            }
        }
        if(item.count > 0){
            const s = (hotbarFirst ? this.hotbarSlotList.find(i => this[i] == null) : null) ?? this._firstEmpty();   // hotbarFirst: gear goes on the hotbar
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
 * box.slotMax = n limits every slot to n items (farmland seedlings: 1).
 */
class Box {
    constructor(size = 9, accept = null){
        this.size = Math.max(1, Math.floor(size));
        this.items = new Array(this.size).fill(null);
        this._accept = accept;
        this.slotMax = null;
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
        if(this.slotMax){   // limited slots: fill empty ones, slotMax each
            for(let k = 0; k < this.size && item.count > 0; k++){
                if(this.items[k]) continue;
                if(item.count <= this.slotMax){ this.items[k] = item; return 0; }
                this.items[k] = item.split(this.slotMax);
            }
            return Math.max(0, item.count);
        }
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
    if(!b.box.accepts(A) || (B && !a.box.accepts(B))){ notify(T('slot.cantGo'), '#ffb070'); return false; }
    // slots that hold at most slotMax (farmland seedlings: one seed each)
    const lim = b.box.slotMax, limA = a.box.slotMax;
    if(lim && B && B !== A && B.canStackWith(A)){ notify(T('slot.onlyPer', { n: lim }), '#ffb070'); return false; }
    if(limA && B && B.count > limA){ notify(T('slot.onlyPer', { n: limA }), '#ffb070'); return false; }
    if(lim && A.count > lim){
        if(B){ notify(T('slot.onlyPer', { n: lim }), '#ffb070'); return false; }
        b.box.setSlot(b.i, A.split(lim));   // move just slotMax of the stack
    }
    else if(B && B !== A && B.canStackWith(A) && !B.isFullStack()) B.mergeFrom(A);
    else { a.box.setSlot(a.i, B ?? null); b.box.setSlot(b.i, A); }
    a.box.changed({ event:'swap' });
    if(b.box !== a.box) b.box.changed({ event:'swap' });
    Tutorial.flags.moved = true;
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
    racks: new Set(),    // drying rack cells (ticked like forges, no fuel)
    machines: {},        // station kind -> Set of cell indexes (see machineSet; forges / pots / racks are the same sets)
    plants: new Set(),   // cells with a plant or farmland (ticked by tickPlants)
    trees: new Set(),
    lights: new Set(),   // cells with a block that glows (torches, ore hearts)
    hearts: new Set(),   // ore heart cells
    heartStones: new Set(), // heart stone cells (ticked by tickHeartStones)
    home: -1,            // the heart stone cell you respawn next to (-1 = camp, Theaya.spawn)
    built: new Set(),   // cells with something the player built (Blocks `built`)
    origin: [],          // natural block id each cell had when the world was made (regrowth)
    waterCells: [],      // every cell that started as water (dried ones included)
    dried: new Set(),    // water cells a drought turned into land
    puddles: new Map(),  // cell index -> water units in a rain puddle
    floorDug: new Map(), // cell index -> { left, since }: floor cells dug below FLOOR_STOCK.max (see floorStockAt)
    foundations: new Map(), // cell index -> foundation kind ('marble' | 'stone'): floor cells laid as a Foundation (see FOUNDATION)
    structures: [],      // placed structures (goblin camps), see Structures
    mud: new Set(),      // muddy grass cells
    snow: new Set(),     // snow covered cells
    dirty: new Set(),    // cells to redraw on the terrain buffer
    fullRedraw: true,
    spawn: { x:0, y:0 },
};

Theaya.machines.forge = Theaya.forges; Theaya.machines.pot = Theaya.pots; Theaya.machines.rack = Theaya.racks;   // the older names stay as aliases

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
    if(!g) return false;
    if(!g.passable){
        // water: only the player, and only on a boat (aboard: all water; ashore: just the cell the boat floats in)
        if(!(g.water && mover === 'player')) return false;
        const b = blockAt(x, y);
        if(!Boat.aboard && !(b && b.id === 'boat')) return false;
    }
    return !blocksMover(blockDefAt(x, y), mover);
}
/** Boating state: `aboard` = the player is in a boat (every water cell is walkable), `cell` = the cell index the boat floats in. */
const Boat = { aboard: false, cell: -1 };
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
    for(const set of Object.values(Theaya.machines)) set.delete(i);
    Theaya.plants.delete(i);
    Theaya.lights.delete(i);
    Theaya.hearts.delete(i);
    Theaya.heartStones.delete(i);
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
        if(MACHINES[def.station]) machineSet(def.station).add(i);
        if(def.station === 'heart_stone') Theaya.heartStones.add(i);
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
    if(ground !== FLOOR && Theaya.foundations.delete(i)) Theaya.dirty.add(i);   // a foundation only sits on floor
    if(groundTypes[ground].water){ Theaya.water[i] = Theaya.water[i] || 1; Theaya.mud.delete(i); Theaya.puddles.delete(i); Theaya.snow.delete(i); }
    syncCell(x, y);
}
/** The block in a cell is a container that still holds items. */
function containerBusy(b){
    if(!b) return false;
    if(b.box) return !b.box.isEmpty;
    if(b.intake) return !b.intake.isEmpty;   // farmland: take the bucket out first (its seeds drop when it's dug up)
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

/* ----- Hex layouts: axial offsets (q, r) on the pointy grid (odd rows shifted right, like hexDist) ----- */
const Hex = {
    toAxial: c => ({ q: c.x - (c.y - (c.y & 1)) / 2, r: c.y }),
    fromAxial: (q, r) => ({ x: q + (r - (r & 1)) / 2, y: r }),
    /** The cell `dq` / `dr` axial steps from c (dr = rows down). */
    offset(c, dq, dr){ const a = this.toAxial(c); return this.fromAxial(a.q + dq, a.r + dr); },
    /** The cells exactly `rad` steps from c, in order around it (rad 0 = c itself). */
    ring(c, rad){
        if(rad <= 0) return [{ x: c.x, y: c.y }];
        const D = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], a = this.toAxial(c), out = [];
        let q = a.q + D[4][0] * rad, r = a.r + D[4][1] * rad;
        for(let i = 0; i < 6; i++) for(let j = 0; j < rad; j++){ out.push(this.fromAxial(q, r)); q += D[i][0]; r += D[i][1]; }
        return out;
    },
    /** Every cell within `rad` steps of c. */
    disc(c, rad){ const out = []; for(let k = 0; k <= rad; k++) out.push(...this.ring(c, k)); return out; },
};

/**
 * Structures: things built into the world when it's generated (defineElement type:'structure', see 3b).
 * generate() places each type `count` times where EVERY cell it covers (`radius`) is dry land of one of
 * its `biomes` with nothing on it but plants / trees / loose soil, at least `minDist` cells from your camp
 * and `spacing` cells from other structures. It clears that ground and builds the `parts`.
 * Theaya.structures lists them: { type, x, y, heart (cell | -1), pop (creatures wanted per `creatures`
 * entry), timers, filled, abandoned, seen }.
 * tick() keeps their creatures: all at once the first time, then one every `respawn` seconds while the
 * `heart` block stands, you're `respawnDist` cells away and none of them is fighting. Break the heart and
 * the structure is abandoned: its creatures stay, but no more come. Its creatures' `home` is its index.
 * Nothing regrows inside a structure (Regrowth.quiet). They're saved with the game (capture / load).
 * A type with `respawn` comes back: once none of it is left standing (all abandoned, or none could be built),
 * `gone[type]` notes the game time, and after `respawn.days` game days respawnTick builds new ones away from you.
 */
const Structures = {
    cells: new Set(),   // every cell a structure covers
    gone: {},           // type -> Clock.elapsed when none of that type was left standing (respawn)
    _acc: 0,
    _retry: 0,          // seconds until the next try when there was no room for a respawn
    at(k){ return Number.isInteger(k) ? Theaya.structures[k] ?? null : null; },
    /** Can a structure of this type cover cell c? (its biome, dry floor, and only clearable natural things on it) */
    fits(def, c){
        const Th = Theaya;
        if(!Th.zone.inBounds(c.x, c.y)) return false;
        const i = cellIndex(c.x, c.y);
        if(!def.biomes.includes(Th.biome[i]) || Th.ground[i] !== FLOOR || Th.foundations.has(i)) return false;
        const b = Th.blocks[i], bd = b && Blocks.get(b.id);
        return !bd || (!bd.built && !bd.station && bd.hardness < 10 && !['stone', 'ore', 'ore_heart'].includes(bd.kind));
    },
    /** World generation (generateWorld): place every structure type. rng = the world's seeded random numbers. */
    generate(rng){
        Theaya.structures = [];
        this.cells.clear();
        this.gone = {};
        this._retry = 0;
        for(const [type, def] of Object.entries(STRUCTURES)){
            const [lo, hi = lo] = [].concat(def.count), n = randInt(lo, hi, rng);
            // hostile ones follow the difficulty (fewer goblin camps on easy), but a type that has any keeps at least one
            this.place(type, def, def.hostile && n > 0 ? Math.max(1, Math.round(n * Difficulty.mult('camps'))) : n, rng);
        }
    },
    /** How much longer (> 1) or shorter a hostile structure (and its creatures) takes to come back at this difficulty. */
    respawnMult(def){ return def.hostile ? Difficulty.mult('enemyRespawn') : 1; },
    /**
     * Build up to `want` structures of this type on random spots that fit. Returns how many were built.
     * live = the game is running (a respawn): no spot `away` cells or nearer to cell `from` (the player), and no
     * creature inside its area. (At world generation the creatures don't exist yet: Mobs is defined later.)
     */
    place(type, def, want, rng, { live = false, from = null, away = 0 } = {}){
        const Th = Theaya, N = MAP_COLS * MAP_ROWS;
        const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const home = Th.home >= 0 ? cellXY(Th.home) : null, spots = [];
        let made = 0;
        for(let i = 0; i < N; i++) if(def.biomes.includes(Th.biome[i])) spots.push(i);
        for(const i of shuffle(spots)){
            if(made >= want) break;
            const c = cellXY(i);
            if(hexDist(c, Th.spawn) < def.minDist || (home && hexDist(c, home) < def.minDist)) continue;
            if(from && hexDist(c, from) < away) continue;
            if(Th.structures.some(s => hexDist(s, c) < Math.max(def.spacing, def.radius + (STRUCTURES[s.type]?.radius ?? 0) + 2))) continue;
            const area = Hex.disc(c, def.radius);
            if(!area.every(a => this.fits(def, a) && !(live && Mobs.occ.has(cellIndex(a.x, a.y))))) continue;   // (no creature gets walled in)
            for(const a of area) Th.origin[cellIndex(a.x, a.y)] = null;   // a camp's clearing doesn't regrow (as at generation)
            this.build(type, def, c, area, rng, shuffle);
            made++;
        }
        return made;
    },
    /** Every second (from tick): types with `respawn` that have had none standing for `respawn.days` game days get new ones. */
    respawnTick(el){
        if(this._retry > 0){ this._retry -= el; return; }
        for(const [type, def] of Object.entries(STRUCTURES)){
            const r = def.respawn;
            if(!r) continue;
            if(Theaya.structures.some(s => s.type === type && !s.abandoned)){ delete this.gone[type]; continue; }
            if(this.gone[type] == null){ this.gone[type] = Clock.elapsed; continue; }   // the last one just fell: the wait starts
            if(Clock.elapsed - this.gone[type] < (r.days ?? 7) * Clock.day * this.respawnMult(def)) continue;
            const made = this.place(type, def, r.count ?? 1, Math.random, { live: true, from: playerCell(), away: r.dist ?? 24 });
            if(!made){ this._retry = 30; continue; }   // no room out of sight right now: try again in a bit
            delete this.gone[type];
            if(def.respawnNotice) notify(T(def.respawnNotice), '#ffb070', 8000);
        }
    },
    /** Clear the ground and build one structure of this type centered on c. */
    build(type, def, c, area, rng, shuffle){
        const Th = Theaya, mine = new Set(area.map(a => cellIndex(a.x, a.y))), used = new Set();
        const s = { type, x: c.x, y: c.y, heart: -1, filled: false, abandoned: false, seen: false,
                    pop: def.creatures.map(cr => { const [lo, hi = lo] = [].concat(cr.count ?? 1); return randInt(lo, hi, rng); }),
                    timers: def.creatures.map(cr => cr.respawn ?? 240) };
        for(const a of area){ const i = cellIndex(a.x, a.y); if(Th.blocks[i]) setBlock(a.x, a.y, null); Th.mud.delete(i); this.cells.add(i); }   // a clearing
        const put = (p, part) => {
            const i = cellIndex(p.x, p.y);
            if(!Th.zone.inBounds(p.x, p.y) || !mine.has(i) || used.has(i)) return false;
            setBlock(p.x, p.y, part.block);
            used.add(i);
            if(part.loot) this.fillLoot(Th.blocks[i], part.loot, rng);
            if(part.block === def.heart && s.heart < 0) s.heart = i;
            return true;
        };
        const span = r => { const [a, b = a] = [].concat(r ?? 1); return [a, b]; };
        for(const part of def.parts){
            if(!Blocks.get(part.block)){ console.warn(`Structure '${type}': there's no block '${part.block}'.`); continue; }
            if(part.at){ put(Hex.offset(c, part.at[0], part.at[1]), part); continue; }
            if(part.scatter != null){   // n blocks on random cells of the given rings (`apart`: at least this many cells between them)
                const [lo, hi] = span(part.scatter), [r0, r1] = span(part.ring), spots = [], placed = [];
                for(let r = r0; r <= r1; r++) spots.push(...Hex.ring(c, r));
                let n = randInt(lo, hi, rng);
                for(const p of shuffle(spots)){
                    if(n <= 0) break;
                    if(part.apart && placed.some(q => hexDist(q, p) < part.apart)) continue;
                    if(put(p, part)){ placed.push(p); n--; }
                }
                continue;
            }
            if(part.ring != null){   // a full ring, minus `gaps` openings `gapWidth` cells wide (and `chance` per cell)
                const ring = Hex.ring(c, part.ring), n = ring.length, open = new Set(), gaps = part.gaps ?? 0, start = Math.floor(rng() * n);
                for(let k = 0; k < gaps; k++){ const g0 = start + Math.floor(k * n / gaps); for(let w = 0; w < (part.gapWidth ?? 1); w++) open.add((g0 + w) % n); }
                ring.forEach((p, k) => { if(!open.has(k) && rng() < (part.chance ?? 1)) put(p, part); });
            }
        }
        Th.structures.push(s);
        return s;
    },
    /** A container block's loot (drop rows, rolled with the world's random numbers). */
    fillLoot(b, loot, rng){
        if(!b || !b.box) return;
        let slot = 0;
        for(const [id, n] of rollDropList(loot, rng)){
            if(!Items.has(id)){ console.warn(`Structure loot: there's no item '${id}'.`); continue; }
            for(let left = n; left > 0 && slot < b.box.size; slot++){ const k = Math.min(left, Items.maxStack(id)); b.box.setSlot(slot, Items.create(id, k)); left -= k; }
        }
    },
    /** Is its heart still standing (and it isn't abandoned)? */
    alive(s){
        const def = STRUCTURES[s.type];
        if(!def || s.abandoned) return false;
        if(!def.heart) return true;
        const b = s.heart >= 0 ? Theaya.blocks[s.heart] : null;
        return !!b && b.id === def.heart;
    },
    /** Every second (not in the tutorial): notices, abandoned camps, and their creatures coming back. */
    tick(dt){
        this._acc += dt;
        if(this._acc < 1) return;
        const el = this._acc;
        this._acc = 0;
        const pc = playerCell();
        Theaya.structures.forEach((s, k) => {
            const def = STRUCTURES[s.type];
            if(!def) return;
            if(!s.abandoned && !this.alive(s)){   // its heart was cut down
                s.abandoned = true;
                if(def.abandonedNotice && pc && hexDist(pc, s) <= 20) notify(T(def.abandonedNotice), '#a6f0a0', 7000);
            }
            if(!s.seen && !s.abandoned && pc && hexDist(pc, s) <= (def.noticeDist ?? 10)){
                s.seen = true;
                if(def.notice) notify(T(def.notice), '#ffb070', 7000);
            }
            if(s.abandoned) return;
            def.creatures.forEach((cr, j) => {
                const cdef = CREATURES[cr.id];
                if(!cdef) return;
                const members = Mobs.list.filter(m => m.alive && m.home === k && m.type === cr.id), want = s.pop[j] ?? 0;
                if(members.length >= want){ s.timers[j] = cr.respawn ?? 240; return; }
                if(!s.filled){ while(members.length < want && this.spawnFor(s, k, cr, members)); return; }   // the first time: all of them
                s.timers[j] = (s.timers[j] ?? 0) - el / this.respawnMult(def);   // (the difficulty: easy ones come back slower)
                const far = !pc || hexDist(pc, s) >= (cr.respawnDist ?? 12);
                if(s.timers[j] <= 0 && far && !members.some(m => m.chasing)){ this.spawnFor(s, k, cr, members); s.timers[j] = cr.respawn ?? 240; }
            });
            s.filled = true;
        });
        this.respawnTick(el);
    },
    /** One creature of entry `cr` at structure s (index k), on a free cell inside it. Returns it, or null when there's no room. */
    spawnFor(s, k, cr, members){
        const def = STRUCTURES[s.type], cdef = CREATURES[cr.id], pc = playerCell();
        const spots = Hex.disc(s, Math.max(1, def.radius - 1)).filter(c => Theaya.zone.inBounds(c.x, c.y)
            && (cdef.mover === 'bird' || isPassable(c.x, c.y, cdef.mover)) && !Mobs.occ.has(cellIndex(c.x, c.y)) && !(pc && pc.x === c.x && pc.y === c.y));
        if(!spots.length) return null;
        const c = spots[Math.floor(Math.random() * spots.length)];
        const m = Mobs.spawn(cr.id, c.x, c.y, { home: k, role: Mobs.nextRole(cdef, members, s.pop[def.creatures.indexOf(cr)] ?? 0) });
        members.push(m);
        return m;
    },
    /** For the save file (SaveGame.capture): { list, gone } (gone: game-clock times, saved as they are). */
    capture(){
        return {
            list: Theaya.structures.map(s => ({ type: s.type, x: s.x, y: s.y, heart: s.heart, pop: [...s.pop], timers: [...s.timers], filled: s.filled, abandoned: s.abandoned, seen: s.seen })),
            gone: Object.assign({}, this.gone),
        };
    },
    /** From a save (SaveGame.apply, after SAVE_PATCHES[1] turned an older plain list into { list, gone }). */
    load(saved){
        const Th = Theaya, num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
        const list = Array.isArray(saved) ? saved : saved && Array.isArray(saved.list) ? saved.list : [];
        Th.structures = [];
        this.cells.clear();
        this.gone = {};
        this._retry = 0;
        for(const [type, t] of Object.entries(saved && !Array.isArray(saved) && saved.gone || {})) if(STRUCTURES[type] && Number.isFinite(Number(t))) this.gone[type] = Number(t);
        for(const e of list){
            const def = e && STRUCTURES[e.type];
            if(!def || !Th.zone.inBounds(e.x, e.y)) continue;
            const pop = def.creatures.map((cr, j) => Math.max(0, Math.floor(num(e.pop && e.pop[j], 0))));
            const timers = def.creatures.map((cr, j) => num(e.timers && e.timers[j], cr.respawn ?? 240));
            Th.structures.push({ type: e.type, x: e.x, y: e.y, heart: Number.isInteger(e.heart) ? e.heart : -1, pop, timers,
                                filled: !!e.filled, abandoned: !!e.abandoned, seen: !!e.seen });
            for(const a of Hex.disc(e, def.radius)) if(Th.zone.inBounds(a.x, a.y)) this.cells.add(cellIndex(a.x, a.y));
        }
    },
};

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

    const elev = [], moist = [], cav = [], tun = [], oreN = [], dist = [], dune = [], lakeN = [], riverN = [];
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
        lakeN[i] = fbm(p.px * 0.11, p.py * 0.11, seed + 1301, 3);   // blobs: lakes
        const rv = fbm(p.px * 0.045, p.py * 0.045, seed + 1777, 3);
        riverN[i] = 1 - Math.abs(2 * rv - 1);  // ridges: long winding lines (rivers)
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
    // Biome `waterBodies`: lakes (highest lake noise) and rivers (highest river ridges), away from camp.
    const WATER_CLEAR = 4.5;   // no lakes / rivers this close to spawn
    const inlandWater = new Set();
    for(const [id, b] of Object.entries(biomes)){
        if(!b.waterBodies || groundTypes[b.floor].water) continue;
        const cells = [];
        for(let i = 0; i < N; i++) if(T.biome[i] === id && dist[i] > WATER_CLEAR) cells.push(i);
        if(!cells.length) continue;
        const { lakes = 0, rivers = 0 } = b.waterBodies;
        const lakeCut  = lakes  > 0 ? quantile(cells.map(i => lakeN[i]),  1 - lakes)  : Infinity;
        const riverCut = rivers > 0 ? quantile(cells.map(i => riverN[i]), 1 - rivers) : Infinity;
        for(const i of cells) if(lakeN[i] >= lakeCut || riverN[i] >= riverCut) inlandWater.add(i);
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
        if(inlandWater.has(i)){ T.ground[i] = 'water'; T.water[i] = WATER_UNITS; continue; }   // lake / river
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

    // Custom terrain (defineElement type:'terrain' with biome + spawn): scattered over its biome's free land.
    for(const t of TERRAIN_SPAWNS){
        for(const i of land) if(!T.blocks[i] && T.ground[i] === FLOOR && dist[i] > 3 && (t.biome === 'all' || T.biome[i] === t.biome) && rng() < t.chance){
            const { x, y } = cellXY(i);
            setBlock(x, y, t.id);
        }
    }

    // Make sure every ore exists somewhere it's allowed.
    for(const m of oreMaterials){
        const id = `${m}_ore`;
        if(T.blocks.some(b => b && b.id === id)) continue;
        const spots = caves.filter(i => T.blocks[i] && T.blocks[i].id === caveDef.wall && oreTierAt(dist[i]) >= materialTier(m))
            .sort((a, b) => dist[b] - dist[a]);
        const fallback = land.filter(i => !T.blocks[i] && !isWaterCell(i) && dist[i] > 8).sort((a, b) => dist[b] - dist[a]);
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

    // Structures (goblin camps): last, on top of the finished landscape
    Structures.generate(rng);

    // Remember what grew where, so the world can slowly grow back (see tickRegrowth). Nothing grows back inside a structure.
    for(let i = 0; i < N; i++) T.origin[i] = T.blocks[i] && !Structures.cells.has(i) ? T.blocks[i].id : null;

    // Sync every cell's reserved flag (setBlock already did the ones with blocks)
    for(let i = 0; i < N; i++){ const { x, y } = cellXY(i); syncCell(x, y); }
    T.fullRedraw = true;
}


/* ---------------------------------------------------------------------
 * 8. Player + survival
 * --------------------------------------------------------------------- */
const theayaScene = new Scene(SCENE_ID, '#1f4f80', { exe: (dt) => gameTick(dt) }, () => drawTerrain());
generateWorld(LAUNCH.seed);

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
// The 'player' texture (see 3a. Textures): drawn in a box twice the player's size, turned to where it walks.
{
    const engineRender = player.render;
    player.render = function(...args){
        const p = this.effectivePosition, mot = Textures.motion(this, p.x, p.y);
        const tex = Textures.pick('player', 'main', [mot.moving && 'moving']);
        if(!tex || tex.s.over) engineRender.apply(this, args);
        if(tex && this.active){
            const sc = this.transform.scale, size = Math.max(sc.x, sc.y) * 2;
            Textures.draw(null, tex, p.x, p.y, size, size, { angle: mot.angle, animate: true });
        }
    };
}
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
    const def = playerDefense(), dmg = amount * Difficulty.mult('damage') * ARMOR_SCALE / (ARMOR_SCALE + def) * (1 - 0.05 * skillLevel('thick_skin'));
    player.health -= dmg;
    for(const s of ARMOR_SLOTS){
        const it = player.gear[s].getSlot(0);
        if(!it) continue;
        it.wear(1);
        if(it.isBroken){ player.gear[s].setSlot(0, null); notify(T('notify.broke', { item: nameOf(it.id) }), '#ff8a7a'); }
    }
    GameUI.hurtAt = performance.now();
    if(source) GameUI.lastHurt = source;
    return dmg;
}

// Starting kit: a full canteen and a few berries on the hotbar.
// (() => {
//     const inv = player.inventory;
//     const canteen = Items.create('canteen');
//     canteen.water.value = canteen.water.capacity;
//     inv[inv.hotbarSlot(1)] = canteen;
//     inv[inv.hotbarSlot(2)] = Items.create('berries', 4);
//     inv._changed({ event:'kit' });
// })();

/** Add `count` of an item id, in max-size stacks. Returns how many didn't fit. */
function giveItems(id, count = 1, hotbarFirst = false){
    let left = count;
    while(left > 0){
        const n = Math.min(left, Items.maxStack(id));
        const rest = player.inventory.give(Items.create(id, n), hotbarFirst);
        left -= (n - rest);
        if(rest > 0) break;
    }
    return left;
}
function roomForItems(id){ return player.inventory.roomFor(Items.create(id, 1)); }

/* ----- Experience + levels (see XP) ----- */
const Levels = {
    level: 1,
    xp: 0,                                         // xp into the current level
    need(level = this.level){ const n = level - 1; return Math.round(XP.levelBase + XP.levelStep * n + XP.levelCurve * n * n); },
    get fraction(){ return this.xp / this.need(); },
    pending: 0,                                    // level-ups whose skill / upgrade choice hasn't been made yet
    flash: { text: '', until: 0 },                 // little "+N xp" / "Level up!" text on the HUD
};
/** Give the player experience (fractions are kept). Levels up as often as the xp allows. */
function gainXp(amount, what = ''){
    if(!(amount > 0)) return;
    amount *= 1 + 0.1 * skillLevel('quick_learner');
    Levels.xp += amount;
    let ups = 0;
    while(Levels.xp >= Levels.need()){ Levels.xp -= Levels.need(); Levels.level++; ups++; }
    const shown = Math.round(amount * 10) / 10;
    Levels.flash = { text: T('xp.gain', { n: shown }) + (what ? T('xp.kind', { kind: T('xp.' + what) }) : ''), until: performance.now() + 1800 };
    if(ups){
        player.maxHealth += XP.healthPerLevel * ups;
        player.health = Math.min(player.maxHealth, player.health + XP.healthPerLevel * ups);
        Levels.pending += ups;   // every level gives a skill / upgrade choice (see openChoice)
        notify(T('level.up', { level: Levels.level, hp: XP.healthPerLevel * ups }), '#ffd75e');
    }
}

/* ---------------------------------------------------------------------
 * Skills + upgrades. Every level up offers 3 random picks (skills and stat upgrades) that
 * aren't maxed yet. Picking one raises it a level (new ones start at level 1), so the same
 * pick can come back and get stronger. K shows what you have.
 *   Skills.defs[id] = { name, kind:'skill'|'upgrade', max, color, desc(level), info }
 *   `desc(level)` says what the skill does AT that level (the card shows the next one).
 * --------------------------------------------------------------------- */
const pct = v => `${Math.round(v * 100)}%`;
const Skills = {
    levels: {},
    defs: {},   // filled by the defineElements([...]) list after the helpers below
    level(id){ return this.levels[id] || 0; },
    maxed(id){ return this.level(id) >= this.defs[id].max; },
    /** Raise a skill one level. */
    take(id){
        const d = this.defs[id];
        if(!d || this.maxed(id)) return false;
        this.levels[id] = this.level(id) + 1;
        if(d.onPick) d.onPick(this.levels[id]);
        return true;
    },
    /** Lower a skill one level (never below 1). `onLose(level)` undoes what onPick did. */
    lose(id){
        const d = this.defs[id];
        if(!d || this.level(id) <= 1) return false;
        this.levels[id]--;
        if(d.onLose) d.onLose(this.levels[id]);
        return true;
    },
    /** Up to n random picks that aren't maxed. */
    roll(n = 3){
        const pool = Object.keys(this.defs).filter(id => !this.maxed(id));
        for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        return pool.slice(0, n);
    },
};
const skillLevel = id => Skills.level(id);
// Hunter: sneaking (hold Shift) slows you down and makes creatures notice you later
const sneakSpeed   = l => [1, 0.55, 0.65, 0.75][l] ?? 0.75;
const stealthSight = l => [1, 0.7, 0.5, 0.3][l] ?? 0.3;

// The skills and upgrades offered at every level up (desc(level) says what it does AT that level).
defineElements([
    // ----- skills -----
    { id:'active_runner', type:'skill', max:5, color:'#ffd75e',
      desc: l => T('skill.active_runner.desc', { a: pct(0.1 * l), b: pct(0.2 * l) }) },
    { id:'steel_stomach', type:'skill', max:5, color:'#9ad84a',
      desc: l => T('skill.steel_stomach.desc', { a: pct(0.12 * l), b: pct(0.05 * l) }) },
    { id:'hunter', type:'skill', max:3, color:'#c98a45',
      desc: l => T('skill.hunter.desc', { a: pct(1 - sneakSpeed(l)), b: pct(1 - stealthSight(l)) }) },
    { id:'green_thumb', type:'skill', max:5, color:'#5fc46a',
      desc: l => T('skill.green_thumb.desc', { a: pct(0.08 * l), b: pct(0.1 * l) }) },
    { id:'prospector', type:'skill', max:5, color:'#9aa3b8',
      desc: l => T('skill.prospector.desc', { a: pct(0.08 * l), b: pct(0.08 * l) }) },
    { id:'skinner', type:'skill', max:3, color:'#b07a45',
      desc: l => T('skill.skinner.desc', { a: pct(0.15 * l) }) },
    { id:'thick_skin', type:'skill', max:5, color:'#d9786e',
      desc: l => T('skill.thick_skin.desc', { a: pct(0.05 * l) }) },
    { id:'brawler', type:'skill', max:5, color:'#e05555',
      desc: l => T('skill.brawler.desc', { a: pct(0.08 * l) }) },
    { id:'regenerator', type:'skill', max:5, color:'#ff9ac0',
      desc: l => T('skill.regenerator.desc', { a: pct(0.2 * l) }) },
    { id:'weatherproof', type:'skill', max:3, color:'#7fc8e8',
      desc: l => T('skill.weatherproof.desc', { a: pct(0.25 * l) }) },
    { id:'quick_learner', type:'skill', max:3, color:'#d8ff9a',
      desc: l => T('skill.quick_learner.desc', { a: pct(0.1 * l) }) },
    // ----- stat upgrades -----
    { id:'vitality', type:'upgrade', max:10, color:'#e05555',
      desc: l => T('skill.vitality.desc', { a: 10 * l }), onPick(){ player.maxHealth += 10; player.health += 10; },
      onLose(){ player.maxHealth -= 10; player.health = Math.min(player.health, player.maxHealth); } },
    { id:'hydration', type:'upgrade', max:8, color:'#4aa3ff',
      desc: l => T('skill.hydration.desc', { a: pct(0.06 * l) }) },
    { id:'big_appetite', type:'upgrade', max:8, color:'#e0a040',
      desc: l => T('skill.big_appetite.desc', { a: pct(0.06 * l) }) },
]);
/** Hold the keyboard's sneak key, or toggle it with the controller's (Pad.sneak). */
function isSneaking(){ return skillLevel('hunter') > 0 && (Keys.down('default@sneak') || Pad.sneak) && !GameUI.inventoryOpen && !GameUI.station; }
/** Multiplier on how far creatures notice you (1 = normal). */
const stealthMult = () => isSneaking() ? stealthSight(skillLevel('hunter')) : 1;
const BASE_WALK_SPEED = 150;   // px / s (the tileMatrix's PathingAI speed)
function playerSpeed(){
    let s = BASE_WALK_SPEED * (1 + 0.1 * skillLevel('active_runner'));
    if(isSneaking()) s *= sneakSpeed(skillLevel('hunter'));
    return s;
}
const hungerSkillMult = () => Math.max(0.1, (1 - 0.05 * skillLevel('steel_stomach')) * (1 - 0.06 * skillLevel('big_appetite')));
const thirstSkillMult = () => Math.max(0.1, 1 - 0.06 * skillLevel('hydration'));
const poisonSkillMult = () => Math.max(0.1, 1 - 0.12 * skillLevel('steel_stomach'));
/** Does a `0.x * level` chance roll succeed? */
const skillChance = (id, perLevel) => Math.random() < perLevel * skillLevel(id);

/** Open the next level-up choice (when some are waiting). The world waits while it's open. */
function openChoice(){
    if(GameUI.choice || Levels.pending <= 0) return;
    const options = Skills.roll(3);
    if(!options.length){ Levels.pending = 0; return; }   // everything is maxed
    GameUI.choice = { options };
    GameUI.wheel = null; GameUI.press = null; GameUI.picked = null;
    theayaScene.pause = true;
}
/** A card was clicked (or its key pressed): ask to confirm it before it's taken (see drawChoiceConfirm). */
function selectChoice(id){
    if(!GameUI.choice || !GameUI.choice.options.includes(id)) return;
    GameUI.choice.confirm = id;
    GameUI.choice.confirmAt = performance.now();
}
/** Take the confirmed pick. */
function pickChoice(id){
    if(!GameUI.choice || !GameUI.choice.options.includes(id)) return;
    const d = Skills.defs[id];
    Skills.take(id);
    Levels.pending--;
    GameUI.choice = null;
    theayaScene.pause = GameUI.paused;
    notify(T(Skills.level(id) === 1 && d.kind === 'skill' ? 'skill.learned' : 'skill.raised', { name: d.name, level: Skills.level(id) }), d.color);
    openChoice();   // another level waiting? offer the next pick
}

/**
 * Boating. Step onto a placed boat (a 'boat' block on a water cell) to get in: every water cell
 * becomes walkable for you (the tileMatrix's reserved flags follow) and the boat sails along with
 * you, cell by cell. Step onto land and you're out; the boat stays on the last water cell.
 */
function setBoating(on, cell = -1){
    Boat.cell = on ? cell : -1;
    if(Boat.aboard === on) return;
    Boat.aboard = on;
    for(const i of Theaya.waterCells){
        if(!isWaterCell(i)) continue;
        const { x, y } = cellXY(i);
        Theaya.zone.setReserved(x, y, !isPassable(x, y, 'player'));
    }
    notify(T(on ? 'boat.in' : 'boat.out'), '#8fd0ff');
}
const boatHasPlayer = i => Boat.aboard && Boat.cell === i;
function tickBoat(){
    const pc = playerCell();
    if(!pc) return;
    const i = cellIndex(pc.x, pc.y), b = Theaya.blocks[i];
    if(!Boat.aboard){
        if(b && b.id === 'boat') setBoating(true, i);
        return;
    }
    if(i === Boat.cell) return;
    if(isWaterCell(i)){
        // sail: the boat moves into the new cell with you
        if(!Theaya.blocks[i]){   // (another boat already floating there: just climb into that one)
            const old = cellXY(Boat.cell), ob = Theaya.blocks[Boat.cell];
            if(ob && ob.id === 'boat') setBlock(old.x, old.y, null);
            setBlock(pc.x, pc.y, 'boat');
        }
        Boat.cell = i;
    } else setBoating(false);   // onto land: the boat stays where it floats
}

/** How much faster hunger / thirst drain right now (heat, cold, drought). */
function climateRates(){
    const temp = playerTemperature();
    let thirst = 1, hunger = 1;
    const hardy = 1 - 0.25 * skillLevel('weatherproof');   // Weatherproof shrinks the heat / cold penalty
    if(temp > SURVIVAL.hotAbove)  thirst *= 1 + SURVIVAL.hotThirst * (temp - SURVIVAL.hotAbove) * hardy;
    if(temp < SURVIVAL.coldBelow) hunger *= 1 + SURVIVAL.coldHunger * (SURVIVAL.coldBelow - temp) * hardy;
    thirst *= Weather.param('thirst', 1);
    return { thirst, hunger, temp };
}
function tickSurvival(dt){
    const p = player, rates = climateRates();
    const walking = areaZones.home.isMoving(p) ? SURVIVAL.moveHunger * Math.max(0, 1 - 0.2 * skillLevel('active_runner')) : 0;
    const drain = SURVIVAL.hungerRate * rates.hunger * (1 + walking) * hungerSkillMult() * Difficulty.mult('hunger') * dt;
    if(p.satruation > 0) p.satruation = Math.max(0, p.satruation - drain);
    else p.hunger = Math.max(0, p.hunger - drain);
    p.thirst = Math.max(0, p.thirst - SURVIVAL.thirstRate * rates.thirst * thirstSkillMult() * Difficulty.mult('thirst') * dt);
    p._damageOnNutrition(dt);
    if(p.poison){
        p.health -= p.poison.dps * dt;
        p.poison.left -= dt;
        if(p.poison.left <= 0){ p.poison = null; notify(T('poison.woreOff'), '#a6f0a0'); }
    }
    const wellFed = !p.poison && p.nutritionDamageRate() === 0 && p.hunger >= SURVIVAL.regenAbove && p.thirst >= SURVIVAL.regenAbove;
    if(wellFed && p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + SURVIVAL.regenRate * (1 + 0.2 * skillLevel('regenerator')) * Difficulty.mult('regen') * dt);
    // better food: fast regeneration for a while (works even while poisoned)
    if(p.regenBuff){
        p.health = Math.min(p.maxHealth, p.health + p.regenBuff.rate * dt);
        p.regenBuff.left -= dt;
        if(p.regenBuff.left <= 0) p.regenBuff = null;
    }
    if(p.bandageCd > 0) p.bandageCd = Math.max(0, p.bandageCd - dt);   // the cooldown shared by all bandages
    if(p.health <= 0 && !_devSecrets.immortal) respawn();
}
function respawn(){
    const home = heartSpawnCell();
    if(home === false) notify(T('heart.spawnLost'), '#ffb070');   // the heart stone was broken: back to camp
    const s = home || Theaya.spawn;
    // whatever you were doing ends where you fell: jobs, fights, the fishing line, open menus, the boat
    Act.job = null;
    Act.combat = null;
    reelIn(true);
    closeMenus();
    setBoating(false);
    if(!isPassable(s.x, s.y)) setBlock(s.x, s.y, null);
    areaZones.home.move(player, s.x, s.y);
    const rand = ([a, b]) => a + Math.random() * (b - a);
    Object.assign(player, { health: player.maxHealth, hunger: rand(DEATH.hunger), satruation: 5, thirst: rand(DEATH.thirst), poison: null, regenBuff: null, bandageCd: 0 });
    if(typeof Mobs !== 'undefined') Mobs.calmNear(s, 8);   // hostiles at camp give up the chase
    if(home !== false) notify(T(home ? 'death.respawnHeart' : 'death.respawn'), '#ff9a8a');   // (a lost heart stone already said "back at camp")
    deathPenalty();
}
/**
 * Take the price of dying (see DEATH): xp progress first, then skill levels with what's left.
 * Returns { xp, skills: { id: levelsLost } }.
 */
function deathPenalty(){
    const need = Levels.need();
    const owed = need * (DEATH.base + DEATH.perLevel * (Levels.level - 1));
    const xpLost = Math.min(Levels.xp, owed);
    Levels.xp -= xpLost;
    const rest = (owed - xpLost) / need / DEATH.perSkillLoss;
    let losses = Math.floor(rest) + (Math.random() < rest % 1 ? 1 : 0);
    losses = Math.min(DEATH.maxSkillLoss, losses);
    const lost = {};
    for(; losses > 0; losses--){
        // skills and upgrades above level 1, weighted by their level (re-weighed after every loss)
        const pool = Object.keys(Skills.defs).filter(id => Skills.level(id) > 1);
        if(!pool.length) break;
        let r = Math.random() * pool.reduce((t, id) => t + Skills.level(id), 0);
        const id = pool.find(id => (r -= Skills.level(id)) < 0) ?? pool[pool.length - 1];
        Skills.lose(id);
        lost[id] = (lost[id] || 0) + 1;
    }
    const shown = Math.round(xpLost * 10) / 10;
    if(shown > 0) notify(T('death.xpLost', { n: shown }), '#ffb070');
    const ids = Object.keys(lost);
    if(ids.length){
        const lines = ids.map(id => T('death.skillLine', { name: Skills.defs[id].name, n: lost[id], level: Skills.level(id) }));
        notify(T('death.skillsLost') + '\n' + lines.join('\n'), '#ff7070', DEATH.lossToastMs);
    }
    return { xp: xpLost, skills: lost };
}

/* ----- Heart Stone (see HEART_STONE): spawn point, slow repairs, upgrades ----- */
const isHeartStone = i => i >= 0 && !!Theaya.blocks[i] && Theaya.blocks[i].id === 'heart_stone';
/** Make the heart stone at cell i your spawn point. */
function setHeartSpawn(i){
    if(!isHeartStone(i)) return;
    Theaya.home = i;
    notify(T('heart.spawnSet'), '#ff9ab0');
}
/**
 * Where you respawn next to your heart stone: { x, y }, null when none is set (camp),
 * or false when it was set but the stone is gone (the spawn goes back to camp).
 */
function heartSpawnCell(){
    const i = Theaya.home;
    if(i < 0) return null;
    if(!isHeartStone(i)){ Theaya.home = -1; return false; }
    const near = Theaya.zone.neighbors(cellXY(i).x, cellXY(i).y);
    // a free cell next to it first, else any land cell next to it (respawn clears what's in the way)
    return near.find(n => isPassable(n.x, n.y) && groundAt(n.x, n.y).passable)
        ?? near.find(n => { const g = groundAt(n.x, n.y); return g && g.passable; })
        ?? null;
}
/** A heart stone's current { radius, rate, radiusLvl, rateLvl }. */
function heartStats(b){
    const H = HEART_STONE, rl = Math.max(1, Math.min(H.maxLevel, b.radiusLvl ?? 1)), sl = Math.max(1, Math.min(H.maxLevel, b.rateLvl ?? 1));
    return { radiusLvl: rl, rateLvl: sl, radius: H.radius[rl - 1], rate: H.rate[sl - 1] };
}
/** The price of the next level of `which` ('radius' | 'rate'), or null at max level. */
function heartUpgradeCost(b, which){
    const lvl = which === 'radius' ? heartStats(b).radiusLvl : heartStats(b).rateLvl;
    return lvl >= HEART_STONE.maxLevel ? null : HEART_STONE.costs[which][lvl - 1] ?? null;
}
const canAfford = cost => !!cost && Object.entries(cost).every(([k, n]) => player.inventory.countOf(k) >= n);
function upgradeHeartStone(x, y, which){
    const b = blockAt(x, y), cost = b && b.id === 'heart_stone' ? heartUpgradeCost(b, which) : null;
    if(!canAfford(cost)) return;
    for(const [k, n] of Object.entries(cost)) player.inventory.take(k, n);
    const key = which === 'radius' ? 'radiusLvl' : 'rateLvl';
    b[key] = (b[key] ?? 1) + 1;
    notify(T('heart.upgraded', { what: T('heart.what.' + which), lvl: b[key] }), '#ff9ab0');
}
/** Damaged blocks (monster cracks) within a heart stone's radius: [cell index]. */
function heartDamaged(i, radius){
    return cellsWithin(cellXY(i), radius).map(c => cellIndex(c.x, c.y)).filter(j => Theaya.blocks[j] && Theaya.blocks[j].cracks > 0);
}
/**
 * Every tick, each damaged block in a heart stone's radius gets back `rate` of its health per in game day,
 * a little at a time (so a full day heals exactly `rate`). Overlapping stones don't stack: the best rate wins.
 */
function tickHeartStones(dt){
    if(!Theaya.heartStones.size) return;
    const days = Clock.dayDelta(dt), best = new Map();
    for(const i of Theaya.heartStones){
        const b = Theaya.blocks[i];
        if(!b || b.id !== 'heart_stone'){ Theaya.heartStones.delete(i); continue; }
        const st = heartStats(b);
        for(const j of heartDamaged(i, st.radius)) best.set(j, Math.max(best.get(j) ?? 0, st.rate));
    }
    const marks = c => c > 0 ? Math.floor(c * 4) + 1 : 0;   // crack marks drawn (as in the block drawing)
    for(const [j, rate] of best){
        const b = Theaya.blocks[j], before = marks(b.cracks), def = Blocks.get(b.id);
        const onFoundation = isFoundation(j) && def && (def.kind === 'wall' || def.kind === 'door');
        b.cracks = Math.max(0, b.cracks - rate * (onFoundation ? FOUNDATION.repairMult : 1) * days);   // walls / doors on a foundation mend faster
        if(b.cracks <= 0) delete b.cracks;
        if(marks(b.cracks || 0) !== before) Theaya.dirty.add(j);
    }
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
// align:false = a new walk heads straight for its next cell. (With the engine default the player first walks back to the
// center of the cell it is in, so re-planning often, e.g. while fighting, made it jitter backwards.)
const pathOpts = () => ({ passable: (x, y) => isPassable(x, y), speed: playerSpeed(), align: false });

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
        onBlocked: () => notify(T('path.blocked'), '#ffb070'),
    }));
    if(!ok) notify(T('path.cantGet'), '#ffb070');
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
    if(!ap){ notify(T('path.cantReach'), '#ffb070'); return false; }
    return walkTo(ap.x, ap.y);
}
/** Run fn once the player stands next to `cell` (walking there first when needed). */
function doNear(cell, fn){
    const pc = playerCell();
    if(pc && hexDist(pc, cell) === 1){ fn(); return; }
    const ap = findApproach(cell);
    if(!ap){ notify(T('path.cantReach'), '#ffb070'); return; }
    walkTo(ap.x, ap.y, () => { const c = playerCell(); if(c && hexDist(c, cell) === 1) fn(); });
}

function verbFor(def){
    switch(def.kind){
        case 'tree': return T('verb.chop');
        case 'stone': case 'ore': return T('verb.mine');
        case 'soil': return T('verb.dig');
        case 'sapling': case 'plant': return T('verb.digUp');
        case 'farmland': return T('verb.clear');
        default: return T('verb.break');
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
    if(def.hardness >= 10) return { ok:false, fits, reason: T('mine.unbreakable') };
    if(def.tier > 0){
        if(!fits) return { ok:false, fits, reason: T('mine.needsTier', { tier: def.tier, tool: nameOf(def.tool) }) };
        if(m.tier < def.tier) return { ok:false, fits, reason: T('mine.needsTier', { tier: def.tier, tool: nameOf(def.tool) }) + T('tier.yours', { tier: m.tier }) };
    }
    if(def.hardness < 0) return { ok:true, fits, time: 0.1 };
    const speed = fits ? m.speed * (1 + 0.25 * Math.max(0, m.tier - def.tier)) : HAND_SPEED;
    const prospect = ['stone', 'ore', 'tree', 'ore_heart'].includes(def.kind) ? 1 - 0.08 * skillLevel('prospector') : 1;
    return { ok:true, fits, time: Math.max(0.08, MINE_TIME_SCALE * def.hardness * (1 + 0.15 * def.tier) / speed * prospect) };
}
/** A whole number from min to max (both included). A function declaration: world generation uses it before this line runs. */
function randInt(min, max, rand = Math.random){ return min + Math.floor(rand() * (max - min + 1)); }
function rollDrops(def, b = null){
    return rollDropList(def.dropsFor && b ? def.dropsFor(b) : def.drops);
}
/**
 * Rolls a drop list. A row is [id, min, max = min, chance = 1, insteadId] or an object
 * { id, chance = 1, amount: [min, max] | n, linked, priority } (see defineElement). `linked` rows ( true, or a group name) can't drop together:
 * of the ones whose chance hit, only the highest `priority` drops (gravel: itself at priority 0, flint at 50% priority 1).
 * { choose:[ids], amount, chance } drops `amount` items, each a random one of the ids (they can't be linked).
 * `rand` = the random numbers to use (world generation passes its seeded one, so a seed always rolls the same).
 * Chances below 1 follow the difficulty (Difficulty.luck: rare drops are likelier on easy, rarer on hard).
 */
function rollDropList(list, rand = Math.random){
    const out = [], groups = new Map();
    for(const e of list){
        if(Array.isArray(e)){
            const [id, min, max = min, chance = 1, instead = null] = e;
            if(chance < 1 && rand() >= Difficulty.luck(chance)){ if(instead) out.push([instead, 1]); continue; }
            out.push([id, randInt(min, max, rand)]);
            continue;
        }
        const [min, max] = Array.isArray(e.amount) ? [e.amount[0], e.amount[1] ?? e.amount[0]] : [e.amount ?? 1, e.amount ?? 1];
        const hit = (e.chance ?? 1) >= 1 || rand() < Difficulty.luck(e.chance);
        if(e.choose){   // every unit a random one of the ids: 3 of [tin, zinc, copper] ingots -> 2 tin + 1 copper
            const ids = [].concat(e.choose).filter(Boolean);
            if(!hit || !ids.length) continue;
            const counts = new Map();
            for(let k = randInt(min, max, rand); k > 0; k--){ const id = ids[Math.floor(rand() * ids.length)]; counts.set(id, (counts.get(id) || 0) + 1); }
            for(const [id, n] of counts) out.push([id, n]);
            continue;
        }
        if(e.linked){
            const g = e.linked === true ? '' : String(e.linked);
            if(!groups.has(g)) groups.set(g, []);
            groups.get(g).push({ e, hit, min, max });
        } else if(hit) out.push([e.id, randInt(min, max, rand)]);
    }
    for(const rows of groups.values()){
        const hits = rows.filter(r => r.hit).sort((p, q) => (q.e.priority ?? 0) - (p.e.priority ?? 0));
        if(hits.length) out.push([hits[0].e.id, randInt(hits[0].min, hits[0].max, rand)]);
    }
    return out;
}
/** One use of a tool on `tag` (wears it). Removes it when it breaks. */
function wearTool(tool, tag){
    if(!tool || typeof tool.mine !== 'function') return;
    tool.mine(tag, player);
    if(tool.isBroken){ player.inventory.removeRef(tool); notify(T('notify.broke', { item: nameOf(tool.id) }), '#ff8a7a'); }
}
const dropsText = drops => drops.filter(([, n]) => n > 0).map(([id, n]) => T('item.count', { n, name: nameOf(id) })).join(T('list.sep'));
function hasRoomFor(drops){ return drops.every(([id, n]) => n <= 0 || roomForItems(id) >= n); }

/* Timed jobs (mining, tilling): { x, y, time, elapsed, tool, verb, check(), done(job) } */
function startJob(job){ Act.job = Object.assign({ elapsed: 0 }, job); }
function startMine(x, y){
    const b = blockAt(x, y), def = b && Blocks.get(b.id);
    if(!def) return;
    const tool = heldItem();
    const info = miningInfo(def, tool);
    if(!info.ok){ notify(info.reason, '#ff8a7a'); return; }
    if(containerBusy(b)){ notify(T('container.emptyFirst', { name: def.name }), '#ff8a7a'); return; }
    if(boatHasPlayer(cellIndex(x, y))){ notify(T('boat.sittingIn'), '#ff8a7a'); return; }
    const id = b.id;
    startJob({ x, y, id, time: info.time, tool, verb: verbFor(def),
        check: () => { const c = blockAt(x, y); return !!(c && c.id === id); }, done: finishMine });
}
function tickJob(dt){
    const j = Act.job;
    if(!j) return;
    const pc = playerCell();
    if(!j.check() || !pc || hexDist(pc, j) > 1 || areaZones.home.isMoving(player)){ Act.job = null; return; }
    if(heldItem() !== j.tool){ Act.job = null; notify(T('job.switched'), '#ffb070'); return; }
    j.elapsed += dt;
    if(j.elapsed >= j.time){ Act.job = null; j.done(j); }
}
function finishMine(j){
    const b = blockAt(j.x, j.y), def = Blocks.get(j.id);
    const drops = rollDrops(def, b);
    if(def.kind === 'ore' && drops.length && drops[0][1] > 0 && skillChance('prospector', 0.08)) drops[0][1]++;   // Prospector: an extra ore
    if(!hasRoomFor(drops)){ notify(T('inv.full'), '#ff8a7a'); return; }
    if(j.tool && miningInfo(def, j.tool).fits) wearTool(j.tool, def.tag);
    setBlock(j.x, j.y, null);
    for(const [id, n] of drops) if(n > 0) giveItems(id, n);
    if(drops.length) notify(T('gain.items', { items: dropsText(drops) }), '#a6f0a0');
    // mining xp: ore pays by its tier, stone and trees a little, other blocks nothing
    if(def.kind === 'ore' || def.kind === 'ore_heart') gainXp(XP.ore + XP.oreTier * (def.tier || 0), 'mining');
    else if(def.kind === 'stone') gainXp(XP.stone, 'mining');
    else if(def.kind === 'tree') gainXp(XP.tree, 'chopping');
}

/* ----- Farming ----- */
const isHoe = item => !!(item && item.get && item.get('mining') && item.get('mining').classes.includes('hoe') && !item.isBroken);
/** Grass with nothing on it (ferns get cleared) that the player isn't standing on. */
function canTill(x, y){
    const g = groundAt(x, y), def = blockDefAt(x, y), pc = playerCell();
    if(!g || !g.passable || Theaya.ground[cellIndex(x, y)] !== FLOOR) return { ok:false, reason: T('till.onlyGrass') };
    if(def && !def.replaceable) return { ok:false, reason: T('cell.inTheWay') };
    if(isFoundation(cellIndex(x, y))) return { ok:false, reason: T('foundation.noTill') };
    if(pc && pc.x === x && pc.y === y) return { ok:false, reason: T('cell.standingHere') };
    return { ok:true };
}
function tillTime(tool){ const m = tool && tool.get('mining'); return Math.max(0.3, MINE_TIME_SCALE * 0.35 / (m ? m.speed : HAND_SPEED)); }
function startTill(x, y){
    const tool = heldItem();
    if(!isHoe(tool)){ notify(T('till.holdHoe'), '#ffb070'); return; }
    const can = canTill(x, y);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    startJob({ x, y, time: tillTime(tool), tool, verb: T('verb.till'), check: () => canTill(x, y).ok, done: finishTill });
}
function finishTill(j){
    const i = cellIndex(j.x, j.y);
    const wet = nextToWater(i) ? FARM.waterMax : (Theaya.puddles.get(i) || 0) * 15 + (Theaya.snow.has(i) ? 10 : 0) + (Theaya.mud.has(i) ? 10 : 0);
    wearTool(j.tool, 'grass');
    Theaya.puddles.delete(i); Theaya.mud.delete(i); Theaya.snow.delete(i);
    setBlock(j.x, j.y, 'farmland', { water: Math.min(FARM.waterMax, wet) });
    notify(T(nextToWater(i) ? 'till.doneIrrigated' : 'till.done'), '#c9e89a');
    gainXp(XP.till, 'farming');
}

/* Digging bare floor: the floor stays, but each cell only holds FLOOR_STOCK.max of its resource.
 * A dug cell regrows 1 resource every FLOOR_STOCK.regenDays in game days.
 * What you get depends on the biome:
 * cave floor -> stone (pickaxe), desert floor -> sand, everything else -> dirt (shovel or bare hands). */
const FLOOR_STOCK = {
    max: 5,          // resource a floor cell holds
    regenDays: 1,    // in game days for a dug cell to regrow 1 resource
};
/** Resource left in a floor cell. It regrows lazily: 1 per FLOOR_STOCK.regenDays since `since`. */
function floorStockAt(i){
    const s = Theaya.floorDug.get(i);
    if(!s) return FLOOR_STOCK.max;
    const step = FLOOR_STOCK.regenDays * Clock.day, gained = Math.floor((Clock.elapsed - s.since) / step);
    if(gained > 0){
        s.left = Math.min(FLOOR_STOCK.max, s.left + gained);
        s.since += gained * step;
        if(s.left >= FLOOR_STOCK.max){ Theaya.floorDug.delete(i); return FLOOR_STOCK.max; }
    }
    return s.left;
}
/** Take one resource from a floor cell; the regrow clock starts on the first dig from full. */
function takeFloorStock(i){
    const left = floorStockAt(i), s = Theaya.floorDug.get(i);
    if(s) s.left = Math.max(0, left - 1);
    else Theaya.floorDug.set(i, { left: Math.max(0, left - 1), since: Clock.elapsed });
}
const FLOOR_DIGS = {
    cave:   { item:'stone', tool:'pickaxe', tag:'stone', byHand:false, scale:1,   what:'stone' },
    desert: { item:'sand',  tool:'shovel',  tag:'sand',  byHand:true,  scale:0.6, what:'sand' },
    other:  { item:'dirt',  tool:'shovel',  tag:'dirt',  byHand:true,  scale:0.6, what:'dirt' },
};
const hasToolClass = (item, cls) => !!(item && item.get && item.get('mining') && item.get('mining').classes.includes(cls) && !item.isBroken);
const isShovel = item => hasToolClass(item, 'shovel');
/** The dig rule for a cell's floor (or null when it isn't diggable floor). */
function floorDigAt(x, y){
    const g = groundAt(x, y);
    if(!g || !g.passable || Theaya.ground[cellIndex(x, y)] !== FLOOR) return null;
    const b = Theaya.biome[cellIndex(x, y)];
    return FLOOR_DIGS[b] || FLOOR_DIGS.other;
}
/** Bare floor (no block on it). You can dig the cell you're standing on. */
function canDigGrass(x, y, tool){
    const r = floorDigAt(x, y);
    if(!r) return { ok:false, reason: T('dig.nothing') };
    if(blockAt(x, y)) return { ok:false, reason: T('cell.inTheWay') };
    if(isFoundation(cellIndex(x, y))) return { ok:false, reason: T('foundation.noDig') };
    if(floorStockAt(cellIndex(x, y)) <= 0) return { ok:false, reason: T('dig.depleted', { what: nameOf(r.what) }) };
    if(!r.byHand && !hasToolClass(tool ?? heldItem(), r.tool)) return { ok:false, reason: T('dig.needsTool', { tool: nameOf(r.tool), what: nameOf(r.what) }) };
    return { ok:true };
}
/** Like mining the matching block: the right tool is faster, bare hands work where allowed. */
function digGrassTime(tool, x, y){
    const r = (x === undefined ? FLOOR_DIGS.other : floorDigAt(x, y)) || FLOOR_DIGS.other;
    const m = hasToolClass(tool, r.tool) ? tool.get('mining') : null;
    return Math.max(0.3, MINE_TIME_SCALE * (Blocks.get(r.item)?.hardness ?? 1) * r.scale / (m ? m.speed : HAND_SPEED));
}
function digLabel(held, x, y){
    const r = floorDigAt(x, y); if(!r) return null;
    return T('dig.label', { what: nameOf(r.what), secs: digGrassTime(held, x, y).toFixed(1), hand: hasToolClass(held, r.tool) || !r.byHand ? '' : T('dig.byHand'),
                            n: floorStockAt(cellIndex(x, y)), max: FLOOR_STOCK.max });
}
function startDigGrass(x, y){
    const tool = heldItem(), can = canDigGrass(x, y, tool), r = floorDigAt(x, y);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    if(roomForItems(r.item) < 1){ notify(T('inv.full'), '#ff8a7a'); return; }
    startJob({ x, y, time: digGrassTime(tool, x, y), tool, verb: T('verb.dig'), check: () => canDigGrass(x, y, tool).ok, done: finishDigGrass });
}
function finishDigGrass(j){
    const r = floorDigAt(j.x, j.y); if(!r) return;
    const i = cellIndex(j.x, j.y);
    if(floorStockAt(i) <= 0){ notify(T('dig.depleted', { what: nameOf(r.what) }), '#ff8a7a'); return; }
    if(roomForItems(r.item) < 1){ notify(T('inv.full'), '#ff8a7a'); return; }
    if(hasToolClass(j.tool, r.tool)) wearTool(j.tool, r.tag);
    takeFloorStock(i);
    giveItems(r.item, 1);
    notify(T('gain.one', { name: nameOf(r.item) }) + T('dig.left', { n: floorStockAt(i), max: FLOOR_STOCK.max }), '#a6f0a0');
}

/* ----- Foundations -----
 * A floor cell dug down to 0/FLOOR_STOCK.max can be laid as a Foundation with a shovel. You pick the kind
 * (FOUNDATION.kinds): marble (dirt + calcite, a pale veined look) or stone (dirt + stone, grey concrete slabs).
 * Both work the same. On a foundation:
 *   - no creature spawns except hostiles, and those still only where it's dark (torches keep them off as usual)
 *   - nothing regrows (trees, ferns, wind-blown sand) and it can't be dug or tilled
 *   - walls and doors take monsters FOUNDATION.breakMult times longer to break, and a heart stone in range
 *     repairs them FOUNDATION.repairMult times faster
 * A pickaxe breaks it up again (some of the materials come back; the floor is left dug out).
 * Theaya.foundations: cell index -> kind id.
 */
const FOUNDATION = {
    dirt: 2,                         // dirt either kind uses
    mineral: 2,                      // plus this many of the kind's mineral
    kinds: {
        marble: { mineral: 'calcite' },
        stone:  { mineral: 'stone' },
    },
    work: 2.5,                       // dig-time units (like a block's hardness) it takes to lay / break one
    breakMult: 1.25,                 // walls / doors on a foundation: monsters take this much longer to break them
    repairMult: 1.25,                // ...and a heart stone repairs them this much faster
    refund: { dirt: 1, mineral: 1 }, // what breaking one up gives back (mineral = the kind's own)
    last: 'stone',                   // the kind a plain shovel click lays (the last one picked on the wheel)
};
const isFoundation = i => Theaya.foundations.has(i);
const foundationKind = i => Theaya.foundations.get(i) || null;
const foundationMineral = kind => (FOUNDATION.kinds[kind] || FOUNDATION.kinds.stone).mineral;
/** What laying a `kind` foundation takes: { dirt, <mineral> }, or null when the inventory doesn't have it. */
function foundationCost(kind){
    const inv = player.inventory, m = foundationMineral(kind);
    if(inv.countOf('dirt') < FOUNDATION.dirt || inv.countOf(m) < FOUNDATION.mineral) return null;
    return { dirt: FOUNDATION.dirt, [m]: FOUNDATION.mineral };
}
function canFoundation(x, y, tool, kind){
    const i = cellIndex(x, y), g = groundAt(x, y);
    if(!isShovel(tool ?? heldItem())) return { ok:false, reason: T('foundation.needsShovel') };
    if(!g || !g.passable || Theaya.ground[i] !== FLOOR) return { ok:false, reason: T('foundation.onlyFloor') };
    if(isFoundation(i)) return { ok:false, reason: T('foundation.already') };
    if(blockAt(x, y)) return { ok:false, reason: T('cell.inTheWay') };
    const dig = floorDigAt(x, y), left = floorStockAt(i);
    if(left > 0) return { ok:false, reason: T('foundation.digFirst', { what: nameOf(dig ? dig.what : 'dirt'), n: left, max: FLOOR_STOCK.max }) };
    if(!foundationCost(kind)) return { ok:false, reason: T('foundation.needs', { dirt: FOUNDATION.dirt, n: FOUNDATION.mineral, mineral: nameOf(foundationMineral(kind)) }) };
    return { ok:true };
}
/** The kind a plain shovel click lays: the last one picked, else whichever the inventory can pay for. */
function quickFoundationKind(){
    if(foundationCost(FOUNDATION.last)) return FOUNDATION.last;
    return Object.keys(FOUNDATION.kinds).find(k => foundationCost(k)) || FOUNDATION.last;
}
function foundationTime(tool){ const m = isShovel(tool) ? tool.get('mining') : null; return Math.max(0.5, MINE_TIME_SCALE * FOUNDATION.work / (m ? m.speed : HAND_SPEED)); }
function foundationLabel(held, kind){
    return T('foundation.label', { kind: T('foundation.kind.' + kind), secs: foundationTime(held).toFixed(1), dirt: FOUNDATION.dirt, n: FOUNDATION.mineral, mineral: nameOf(foundationMineral(kind)) });
}
function startFoundation(x, y, kind){
    const tool = heldItem(), can = canFoundation(x, y, tool, kind);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    FOUNDATION.last = kind;
    startJob({ x, y, kind, time: foundationTime(tool), tool, verb: T('verb.lay'), check: () => canFoundation(x, y, tool, kind).ok, done: finishFoundation });
}
function finishFoundation(j){
    if(!canFoundation(j.x, j.y, j.tool, j.kind).ok) return;
    const cost = foundationCost(j.kind), i = cellIndex(j.x, j.y);
    for(const [id, n] of Object.entries(cost)) player.inventory.take(id, n);
    wearTool(j.tool, 'dirt');
    Theaya.foundations.set(i, j.kind);
    Theaya.mud.delete(i);
    Theaya.dirty.add(i);
    for(const n of neighborIdx(i)) Theaya.dirty.add(n);   // neighbours redraw without their rim over the slab
    notify(T('foundation.laid', { kind: T('foundation.kind.' + j.kind), items: dropsText(Object.entries(cost)) }), '#a6f0a0');
}
/** Breaking a foundation back up: a pickaxe on an empty foundation cell. */
function canBreakFoundation(x, y, tool){
    const i = cellIndex(x, y);
    if(!isFoundation(i)) return { ok:false, reason: T('foundation.none') };
    if(blockAt(x, y)) return { ok:false, reason: T('cell.inTheWay') };
    if(!hasToolClass(tool ?? heldItem(), 'pickaxe')) return { ok:false, reason: T('foundation.needsPickaxe') };
    return { ok:true };
}
function breakFoundationTime(tool){ const m = hasToolClass(tool, 'pickaxe') ? tool.get('mining') : null; return Math.max(0.5, MINE_TIME_SCALE * FOUNDATION.work / (m ? m.speed : HAND_SPEED)); }
function startBreakFoundation(x, y){
    const tool = heldItem(), can = canBreakFoundation(x, y, tool);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    startJob({ x, y, time: breakFoundationTime(tool), tool, verb: T('verb.break'), check: () => canBreakFoundation(x, y, tool).ok, done: finishBreakFoundation });
}
function finishBreakFoundation(j){
    if(!canBreakFoundation(j.x, j.y, j.tool).ok) return;
    const i = cellIndex(j.x, j.y), mineral = foundationMineral(foundationKind(i));
    wearTool(j.tool, 'stone');
    Theaya.foundations.delete(i);
    Theaya.floorDug.set(i, { left: 0, since: Clock.elapsed });   // dug out underneath: it regrows from empty
    Theaya.dirty.add(i);
    for(const n of neighborIdx(i)) Theaya.dirty.add(n);
    const refund = Object.entries(FOUNDATION.refund).map(([id, n]) => [id === 'mineral' ? mineral : id, n]);
    const back = refund.map(([id, n]) => [id, n - giveItems(id, n)]).filter(([, n]) => n > 0);
    notify(T('foundation.broken') + (back.length ? T('gain.items', { items: dropsText(back) }) : ''), '#a6f0a0');
}
/** Monster break time multiplier for the block in cell i (walls / doors on a foundation hold out longer). */
function foundationBreakMult(i){
    const def = Theaya.blocks[i] && Blocks.get(Theaya.blocks[i].id);
    return isFoundation(i) && def && (def.kind === 'wall' || def.kind === 'door') ? FOUNDATION.breakMult : 1;
}

/** View of a plant state ({ crop, age }): { crop, stage, k, ripe, rot } or null. */
function plantInfoOf(p){
    if(!p) return null;
    const crop = Crops.get(p.crop);
    if(!crop) return null;
    const k = Crops.stageAt(crop, p.age), stage = k < 0 ? null : crop.stages[k];
    return { crop, stage, k, ripe: !!(stage && stage.done), rot: !!(stage && stage.rot) };
}
/** Plant view of a block with ONE plant (wild plants, berry bushes): see plantInfoOf. Farmland: see farmSeedlings. */
function plantInfo(b){ return b && b.plant ? plantInfoOf(b.plant) : null; }

/* ----- Farmland as a container ----- */
/** Gives a farmland block its slots (see the farmland block). */
function initFarmland(b){
    if(b.water == null) b.water = 0;
    if(!b.seeds){
        // one seed per slot, and every slot holds the same crop
        const seeds = new Box(FARM.slots, it => it instanceof CropSeedItem && seeds.items.every(o => !o || o === it || o.crop === it.crop));
        seeds.slotMax = 1;
        b.seeds = seeds;
    }
    if(!b.intake) b.intake = new Box(1, it => !!waterOf(it));
    if(!b.plants) b.plants = new Array(FARM.slots).fill(null);
    delete b.plant;
}
/** Matches b.plants to the seeds in the slots (a seed moved to another slot keeps its growth; one taken out is uprooted). True when something changed. */
function syncFarmland(b){
    const old = b.plants, next = new Array(b.seeds.size).fill(null);
    let changed = false;
    for(let k = 0; k < b.seeds.size; k++){
        const it = b.seeds.getSlot(k);
        if(it) next[k] = old.find(p => p && p.item === it) ?? Object.assign(newPlant(it.crop, 0), { item: it });
        if(next[k] !== old[k]) changed = true;
    }
    b.plants = next;
    return changed;
}
/** A farmland's seedlings: [{ k (slot), p (plant state), info (plantInfoOf) }]. */
function farmSeedlings(b){
    if(!b || !b.seeds) return [];
    syncFarmland(b);
    const out = [];
    b.plants.forEach((p, k) => { const info = plantInfoOf(p); if(info) out.push({ k, p, info }); });
    return out;
}
/** The crop growing on a farmland (from its seeds), or null. */
const farmCrop = b => { const it = b && b.seeds && b.seeds.items.find(Boolean); return it ? it.crop : null; };
/** Short state of one seedling ('sprout', 'stage 2', 'ripe', 'rotten'). */
const seedlingState = info => T(info.rot ? 'seedling.rotten' : info.ripe ? 'seedling.ripe' : info.k < 0 ? 'seedling.sprout' : 'seedling.stage', { n: info.k + 1 });
/**
 * What a harvest of this farmland takes: the ripe and rotten seedlings; when there are none, the
 * seedlings that would already give something (harvested early). { list, early }
 */
function farmHarvestPick(b){
    const list = farmSeedlings(b);
    const done = list.filter(e => e.info.ripe || e.info.rot);
    if(done.length) return { list: done, early: false };
    return { list: list.filter(e => e.info.stage && e.info.stage.yield[1] > 0), early: true };
}
/** The wheel / panel label of a farmland harvest, or null when there's nothing to harvest. */
function farmHarvestLabel(b){
    const { list, early } = farmHarvestPick(b);
    if(!list.length) return null;
    const name = nameOf(list[0].info.crop.id), rot = list.filter(e => e.info.rot).length, good = list.length - rot;
    if(!good) return T('farm.clearRotten', { n: rot, crop: name });
    return T('farm.harvestLabel', { n: good, crop: name, early: early ? T('farm.notRipe') : '', rot: rot ? T('farm.andClear', { n: rot }) : '' });
}
/** Harvest a farmland by hand (no hoe needed): every ripe / rotten seedling (or the early ones, see farmHarvestPick). */
function harvestFarmland(x, y){
    const b = blockAt(x, y);
    if(!b || !b.seeds) return;
    const { list } = farmHarvestPick(b);
    if(!list.length){ notify(T('farm.nothingYet'), '#ffb070'); return; }
    const crop = list[0].info.crop;
    let n = 0, seeds = 0, ripe = 0;
    for(const { info } of list){
        if(info.rot || !info.stage) continue;
        n += randInt(info.stage.yield[0], info.stage.yield[1]);
        if(info.stage.yield[1] > 0 && skillChance('green_thumb', 0.1)) n += randInt(info.stage.yield[0], info.stage.yield[1]);   // Green Thumb: bonus
        if(info.ripe){
            ripe++;
            if(Items.has(crop.seed) && crop.seed !== 'berry_bush') seeds += crop.regrow ? (Math.random() < 0.3 ? 1 : 0) : randInt(crop.seeds[0], crop.seeds[1]);
        }
    }
    const drops = [[crop.produce, n], [crop.seed, seeds]];
    if(!hasRoomFor(drops)){ notify(T('inv.full'), '#ff8a7a'); return; }
    for(const [id, c] of drops) if(c > 0) giveItems(id, c);
    for(const { k, p } of list){
        if(crop.regrow){ p.age = 0; p.dry = 0; }      // perennials grow back from the same seed
        else { b.seeds.setSlot(k, null); b.plants[k] = null; }   // the seed is used up, the slot is free again
    }
    Theaya.dirty.add(cellIndex(x, y));
    const allRotten = list.every(e => e.info.rot);
    notify(allRotten ? T('farm.clearedRotten', { crop: nameOf(crop.id) }) : T('gain.items', { items: dropsText(drops) }), allRotten ? '#d8c08a' : '#a6f0a0');
    if(n > 0 && ripe) gainXp(XP.harvest * ripe, 'farming');
}
/** Pours the water slot's bucket / canteen into the soil, one unit every FARM.intakeSeconds while a whole unit fits under waterMax. */
function farmIntake(b, dt){
    const w = waterOf(b.intake.getSlot(0));
    if(!w || w.value <= 0 || FARM.waterMax - b.water < FARM.bucketUnit){ b._intakeT = 0; return false; }
    b._intakeT = (b._intakeT || 0) + dt;
    if(b._intakeT < FARM.intakeSeconds) return false;
    b._intakeT = 0;
    w.value -= 1;
    b.water += FARM.bucketUnit;
    return true;
}
/** Crops with tier > 0 need a hoe of that tier to harvest. */
function canHarvestTier(crop, item){
    if(crop.tier <= 0) return { ok:true };
    const m = isHoe(item) ? item.get('mining') : null;
    if(m && m.tier >= crop.tier) return { ok:true, tool:item };
    return { ok:false, reason: T('mine.needsTier', { tier: crop.tier, tool: nameOf('hoe') }) + (m ? T('tier.yours', { tier: m.tier }) : '') };
}
function harvestPlant(x, y){
    const b = blockAt(x, y), info = plantInfo(b);
    if(!info) return;
    const { crop } = info, held = heldItem();
    const tier = canHarvestTier(crop, held);
    if(!info.rot && !tier.ok){ notify(tier.reason, '#ff8a7a'); return; }
    // wild plants and berry bushes (farmland is harvested by hand, see harvestFarmland)
    let n = 0, seeds = 0;
    if(!info.rot && info.stage) n += randInt(info.stage.yield[0], info.stage.yield[1]);
    if(!info.rot && info.stage && info.stage.yield[1] > 0 && skillChance('green_thumb', 0.1)) n += randInt(info.stage.yield[0], info.stage.yield[1]);   // Green Thumb: bonus
    if(info.ripe && Items.has(crop.seed) && crop.seed !== 'berry_bush') seeds += crop.regrow ? (Math.random() < 0.3 ? 1 : 0) : randInt(crop.seeds[0], crop.seeds[1]);
    const drops = [[crop.produce, n], [crop.seed, seeds]];
    if(!hasRoomFor(drops)){ notify(T('inv.full'), '#ff8a7a'); return; }
    if(tier.tool && n > 0) wearTool(tier.tool, 'plant');
    for(const [id, c] of drops) if(c > 0) giveItems(id, c);
    if(crop.regrow) b.plant.age = 0;                 // perennials grow back
    else setBlock(x, y, null);                       // a wild plant is gone
    Theaya.dirty.add(cellIndex(x, y));
    notify(info.rot ? T('farm.clearedRotten', { crop: nameOf(crop.id) }) : T('gain.items', { items: dropsText(drops) }), info.rot ? '#d8c08a' : '#a6f0a0');
    if(n > 0 && info.ripe) gainXp(XP.harvest, 'farming');
}
/** Ferns: always plant fibers, sometimes a crop seed (tier FARM.fernSeedMaxTier or lower). Then they're gone. */
function harvestFern(x, y){
    const drops = [['plant_fiber', randInt(1, 2)]];
    if(Math.random() < FARM.fernSeedChance){
        const id = Crops.random(c => c.farm && c.tier <= FARM.fernSeedMaxTier && Items.has(c.seed));
        if(id) drops.push([Crops.get(id).seed, 1]);
    }
    if(!hasRoomFor(drops)){ notify(T('inv.full'), '#ff8a7a'); return; }
    for(const [id, n] of drops) giveItems(id, n);
    setBlock(x, y, null);
    notify(T('gain.items', { items: dropsText(drops) }), '#a6f0a0');
}
/** A walk-over block you pick up by hand (kind 'pickup': eggs). It goes into your inventory whole. */
function pickUpBlock(x, y){
    const b = blockAt(x, y), def = b && Blocks.get(b.id);
    if(!def || def.kind !== 'pickup') return;
    const drops = def.dropsFor ? def.dropsFor(b) : def.drops;
    if(!hasRoomFor(drops)){ notify(T('inv.full'), '#ff8a7a'); return; }
    for(const [id, n] of drops) giveItems(id, n);
    setBlock(x, y, null);
    notify(T('gain.items', { items: dropsText(drops) }), '#a6f0a0');
}
/** "Pick up 2 eggs": the wheel / left-click label of a pickup block. */
function pickUpLabel(b){
    const def = Blocks.get(b.id), drops = def.dropsFor ? def.dropsFor(b) : def.drops;
    return T('wheel.pickUp', { items: dropsText(drops) });
}
function harvest(x, y){
    const def = blockDefAt(x, y);
    if(!def) return;
    if(def.kind === 'pickup') pickUpBlock(x, y);
    else if(def.kind === 'fern') harvestFern(x, y);
    else if(def.kind === 'farmland') harvestFarmland(x, y);
    else if(plantInfo(blockAt(x, y))) harvestPlant(x, y);
}
/** Plants one held seed in the farmland's first free seedling slot (the same as dropping it in a slot of its panel). */
function plantSeed(x, y){
    const item = heldItem(), b = blockAt(x, y);
    if(!(item instanceof CropSeedItem)){ notify(T('farm.holdSeeds'), '#ffb070'); return; }
    if(!b || !b.seeds){ notify(T('farm.seedsGoOnFarmland'), '#ffb070'); return; }
    const why = plantReason(b, item);
    if(why){ notify(why, '#ffb070'); return; }
    const k = b.seeds.items.findIndex(it => !it);
    b.seeds.setSlot(k, item.split(1));
    player.inventory._changed({ event:'plant' });
    syncFarmland(b);
    Theaya.dirty.add(cellIndex(x, y));
    const n = b.seeds.items.filter(Boolean).length, dry = b.water <= 0 && !nextToWater(cellIndex(x, y));
    notify(T('farm.planted', { crop: nameOf(item.crop), n, max: FARM.slots, dry: dry ? T('farm.plantedDry') : '' }), dry ? '#ffb070' : '#a6f0a0');
    gainXp(XP.plantRatio, 'farming');
}
/** Why this seed can't be planted on this farmland (null = it can). */
function plantReason(b, item){
    if(!(item instanceof CropSeedItem)) return T('farm.holdSeeds');
    const crop = farmCrop(b);
    if(crop && crop !== item.crop) return T('farm.oneCrop', { crop: nameOf(crop) });
    if(!b.seeds.items.some(it => !it)) return T('farm.full', { n: FARM.slots });
    return null;
}
function waterFarmland(x, y){
    const item = heldItem(), b = blockAt(x, y), w = waterOf(item);
    if(!(item instanceof Bucket)){ notify(T('water.holdBucketOfWater'), '#ffb070'); return; }
    if(!b || b.id !== 'farmland') return;
    if(w.empty){ notify(T('water.bucketEmpty'), '#ffb070'); return; }
    // Fills up to waterMax. Pouring on farmland that's already full floods it (up to FARM.floodMax).
    const flood = b.water >= FARM.waterMax, cap = flood ? FARM.floodMax : FARM.waterMax;
    const room = cap - b.water;
    if(room <= 0){ notify(T('farm.cantHoldMore'), '#ffb070'); return; }
    const units = Math.min(w.value, Math.ceil(room / FARM.bucketUnit));
    w.value -= units;
    b.water = Math.min(cap, b.water + units * FARM.bucketUnit);
    Theaya.dirty.add(cellIndex(x, y));
    const pond = FARM.waterMax * FARM.floodAt;
    notify(flood ? T('farm.flooded', { w: Math.round(b.water), max: FARM.waterMax, note: T(b.water > pond ? 'farm.floodNoteOver' : 'farm.floodNoteUnder', { pond }) })
                 : T('farm.watered', { w: Math.round(b.water), max: FARM.waterMax, v: w.value, c: w.capacity }), '#8fd0ff');
}
/**
 * Unflood: scoop the water above waterMax back into the held bucket, one bucket unit (FARM.bucketUnit) at a time.
 * The last unit can take the soil a little under waterMax (water is never created or lost).
 */
function unfloodFarmland(x, y){
    const item = heldItem(), b = blockAt(x, y), w = waterOf(item);
    if(!(item instanceof Bucket)){ notify(T('water.holdBucket'), '#ffb070'); return; }
    if(!b || b.id !== 'farmland') return;
    const why = unfloodReason(b, w);
    if(why){ notify(why, '#ffb070'); return; }
    const over = b.water - FARM.waterMax;
    const units = Math.min(w.capacity - w.value, Math.ceil(over / FARM.bucketUnit), Math.floor(b.water / FARM.bucketUnit));
    w.value += units;
    b.water = Math.max(0, b.water - units * FARM.bucketUnit);
    if(b.water <= FARM.waterMax * FARM.floodAt) b.flood = 0;   // no longer on its way to becoming a pond
    Theaya.dirty.add(cellIndex(x, y));
    notify(T('farm.scooped', { n: units, s: units > 1 ? 's' : '', w: Math.round(b.water), max: FARM.waterMax, still: b.water > FARM.waterMax ? T('farm.stillFlooded') : '', v: w.value, c: w.capacity }), '#8fd0ff');
}
/** Why the bucket can't unflood this farmland (null = it can). */
function unfloodReason(b, w){
    if(!w) return T('water.holdBucketShort');
    if(b.water <= FARM.waterMax) return T('farm.notFlooded');
    if(w.full) return T('water.bucketFull');
    if(b.water < FARM.bucketUnit) return T('farm.notEnoughToScoop');
    return null;
}
/** Farmland that stayed flooded long enough becomes a water cell (a pond you made). */
function floodToWater(i){
    const { x, y } = cellXY(i), b = Theaya.blocks[i];
    // the bucket / canteen in its water slot comes back to you (the seeds drown with the soil)
    const kept = b && b.intake && b.intake.getSlot(0);
    if(kept && player.inventory.give(kept) === 0) notify(T('farm.bucketBack', { item: nameOf(kept.id) }), '#8fd0ff');
    setBlock(x, y, null);
    Theaya.mud.delete(i);
    Theaya.water[i] = WATER_UNITS;
    setGround(x, y, 'water');
    Theaya.water[i] = WATER_UNITS;
    if(!Theaya.waterCells.includes(i)) Theaya.waterCells.push(i);
    Theaya.dried.delete(i);
    Theaya.origin[i] = null;
    notify(T('farm.becamePond'), '#8fd0ff');
}
/** The water cell next to cell i that irrigates it (the one with the most units left), or -1 when they're all dry. */
function irrigationSource(i){
    let best = -1;
    for(const n of neighborIdx(i)) if(isWaterCell(n) && (Theaya.water[n] ?? 0) > 0 && (best < 0 || Theaya.water[n] > Theaya.water[best])) best = n;
    return best;
}
/** Take one unit out of a water cell (it refills WATER_REFILL_SECONDS after running dry, like scooping it). */
function takeWaterUnit(n){
    Theaya.water[n] = Math.max(0, (Theaya.water[n] ?? 0) - 1);
    if(Theaya.water[n] <= 0 && WATER_REFILL_SECONDS > 0) Theaya.refilling.set(n, sceneTime() + WATER_REFILL_SECONDS);
    Theaya.dirty.add(n);
}
/** Irrigation text for farmland cell i: '' (not next to water), 'irrigated (water 12/15)' or 'irrigation dry'. */
function irrigationText(i){
    if(!nextToWater(i)) return '';
    const s = irrigationSource(i);
    return s < 0 ? T('irrigation.dry') : T('irrigation.on', { n: Theaya.water[s], max: WATER_UNITS });
}
/** One farmland, every tick: its water slot pours in, the soil drains, and each seedling grows (or dries out) on its own. */
function tickFarmland(i, b, dt, days, drain){
    if(!b.seeds) initFarmland(b);
    if(syncFarmland(b)) Theaya.dirty.add(i);   // seeds put in / taken out through the panel
    farmIntake(b, dt);
    const seedlings = farmSeedlings(b), living = seedlings.filter(e => !e.info.rot);
    const { x, y } = cellXY(i);
    const heat = temperatureAt(x, y) > SURVIVAL.hotAbove ? 1.5 : 1;
    const over = b.water > FARM.waterMax ? FARM.overflowDrain : 0;   // flood water soaks away faster
    // growing seedlings drink (each extra one adds FARM.stackThirst), bare soil just evaporates
    const thirst = living.length ? living[0].info.crop.water * (1 + FARM.stackThirst * (living.length - 1)) : FARM.evaporate;
    b.water = Math.max(0, b.water - (thirst + over) * days * drain * heat * (1 - 0.08 * skillLevel('green_thumb')));
    // next to a water cell the soil is irrigated: it stays full, no bucket needed. While crops grow it slowly
    // drinks the water cell (1 unit per FARM.irrigationPerUnit topped up); a dry water cell can't irrigate.
    if(nextToWater(i) && b.water < FARM.waterMax){
        const need = FARM.waterMax - b.water;
        if(!living.length) b.water = FARM.waterMax;                 // bare soil: just stays damp
        else if(irrigationSource(i) >= 0){
            b.water = FARM.waterMax;
            b._irrig = (b._irrig || 0) + need;
            while(b._irrig >= FARM.irrigationPerUnit){
                const s = irrigationSource(i);
                if(s < 0) break;
                takeWaterUnit(s);
                b._irrig -= FARM.irrigationPerUnit;
            }
        }
    }
    // kept flooded (over floodAt x waterMax) for floodDays: it becomes a water source
    if(b.water > FARM.waterMax * FARM.floodAt){
        b.flood = (b.flood || 0) + days;
        if(b.flood >= FARM.floodDays){ floodToWater(i); return; }
    } else b.flood = 0;
    const lvl = Math.ceil(b.water / (FARM.waterMax / 4));
    if(lvl !== b._lvl){ b._lvl = lvl; Theaya.dirty.add(i); }
    for(const { k, p, info } of seedlings){
        const crop = info.crop, before = info.k;
        if(b.water <= 0){
            p.dry += days;
            if(p.dry >= FARM.dryDays && p.age < crop.rotAge){   // withered
                if(crop.rotAge === Infinity){ b.seeds.setSlot(k, null); b.plants[k] = null; }
                else p.age = crop.rotAge;
                Theaya.dirty.add(i);
                continue;
            }
        } else {
            p.dry = 0;
            p.age += days;
        }
        if(Crops.stageAt(crop, p.age) !== before) Theaya.dirty.add(i);
    }
}
/** Grows plants and drains farmland water (every tick). */
function tickPlants(dt){
    const days = Clock.dayDelta(dt), drain = Weather.param('farmDrain', 1);
    for(const i of Theaya.plants){
        const b = Theaya.blocks[i];
        if(!b){ Theaya.plants.delete(i); continue; }
        if(b.id === 'farmland'){ tickFarmland(i, b, dt, days, drain); continue; }
        // wild plants and berry bushes: grow without water
        const p = b.plant, crop = p ? Crops.get(p.crop) : null;
        if(!crop) continue;
        const before = Crops.stageAt(crop, p.age);
        p.dry = 0;
        p.age += days;
        if(p.age >= crop.rotAge + 1) p.age = 0;   // wild plants rot away and sprout again
        if(Crops.stageAt(crop, p.age) !== before) Theaya.dirty.add(i);
    }
}

/* ----- Placing / water / using items ----- */
function placeBlock(x, y){
    const item = heldItem();
    if(!(item instanceof BlockItem)){ notify(T('place.holdBlock'), '#ffb070'); return; }
    const pc = playerCell(), g = groundAt(x, y), cur = blockDefAt(x, y), def = Blocks.get(item.block);
    if(def && def.kind === 'boat'){   // boats go on water, nothing else does
        if(!g || !g.water || cur){ notify(T('place.boatOnWater'), '#ff8a7a'); return; }
    } else if((cur && !cur.replaceable) || !g || !g.passable || !def){ notify(T('place.cantBuild'), '#ff8a7a'); return; }
    if(pc && pc.x === x && pc.y === y && blocksMover(def, 'player')){ notify(T('place.standingThere'), '#ff8a7a'); return; }
    setBlock(x, y, item.block, def.placeState ? def.placeState() : {});
    item.removeCount(1);
    player.inventory._changed({ event:'place' });
    if(def.onPlace) def.onPlace(x, y, blockAt(x, y));
}

/* Filling in a water cell: with a shovel, a water cell that has no water left (scooped dry or dried up)
 * can be filled in with its biome's floor resource (biomes[...].floorResource: sand by the ocean, dirt in
 * plains / forest, stone in caves) and never refills. Walkable soil (sand) is placed as a block; anything
 * else leaves bare floor. */
const fillResourceAt = i => biomes[Theaya.biome[i]]?.floorResource ?? 'sand';
const fillResourceAtXY = (x, y) => fillResourceAt(cellIndex(x, y));
function canFillWaterCell(x, y, tool){
    const g = groundAt(x, y), i = cellIndex(x, y);
    if(!g || !g.water) return { ok:false, reason: T('fill.notWater') };
    if(!hasToolClass(tool ?? heldItem(), 'shovel')) return { ok:false, reason: T('fill.needsShovel') };
    if((Theaya.water[i] ?? 0) > 0) return { ok:false, reason: T('fill.emptyFirst') };
    if(blockAt(x, y)) return { ok:false, reason: T('cell.inTheWay') };
    return { ok:true };
}
const fillWaterTime = (tool, res = 'sand') => Math.max(0.4, MINE_TIME_SCALE * (Blocks.get(res)?.hardness ?? 0.35) * 1.2 / (hasToolClass(tool, 'shovel') ? tool.get('mining').speed : HAND_SPEED));
/** "Fill with Dirt (1.2s)": the wheel label for filling in the water cell at (x, y). */
const fillWaterLabel = (x, y, tool) => { const res = fillResourceAtXY(x, y); return T('wheel.fillInWith', { item: nameOf(res), secs: fillWaterTime(tool, res).toFixed(1) }); };
function startFillWater(x, y){
    const tool = heldItem(), can = canFillWaterCell(x, y, tool);
    if(!can.ok){ notify(can.reason, '#ff8a7a'); return; }
    startJob({ x, y, time: fillWaterTime(tool, fillResourceAtXY(x, y)), tool, verb: T('verb.fillIn'), check: () => canFillWaterCell(x, y, tool).ok, done: finishFillWater });
}
function finishFillWater(j){
    const { x, y } = j, i = cellIndex(x, y), res = fillResourceAt(i);
    wearTool(j.tool, Blocks.get(res)?.tag ?? res);
    Theaya.water[i] = 0;
    Theaya.refilling.delete(i); Theaya.dried.delete(i);
    const k = Theaya.waterCells.indexOf(i); if(k >= 0) Theaya.waterCells.splice(k, 1);
    setGround(x, y, FLOOR);
    if(WALKABLE_SOIL.includes(res)) setBlock(x, y, res);
    Theaya.origin[i] = null;
    Theaya.dirty.add(i);
    notify(T('fill.done', { item: nameOf(res) }), '#e8d28a');
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
    if(!w){ notify(T('water.holdContainer'), '#ffb070'); return; }
    if(!src) return;
    if(src.left <= 0){ notify(T('water.sourceDry'), '#ffb070'); return; }
    if(w.full){ notify(T('water.alreadyFull', { item: nameOf(item.id) }), '#ffb070'); return; }
    const n = Math.min(src.left, w.capacity - w.value);
    w.value += n;
    if(src.kind === 'water'){
        Theaya.water[i] = src.left - n;
        if(Theaya.water[i] <= 0 && WATER_REFILL_SECONDS > 0) Theaya.refilling.set(i, sceneTime() + WATER_REFILL_SECONDS);
    } else if(src.left - n > 0) Theaya.puddles.set(i, src.left - n);
    else Theaya.puddles.delete(i);
    Theaya.dirty.add(i);
    notify(T(src.kind === 'water' ? 'water.filledFromSource' : 'water.filledFromPuddle', { item: nameOf(item.id), v: w.value, c: w.capacity, left: src.left - n }), '#8fd0ff');
}
/** Kept for older code: fillCanteen(x, y) = fillContainer(x, y). */
function fillCanteen(x, y){ fillContainer(x, y); }

/* ----- Fishing -----
 * Hold a fishing rod and click a water cell (or press F for the nearest one) to cast. The line stays out
 * while you stand still holding the rod. Each second something bites with the rod's `lure` chance; the
 * bobber dips and the rod reels it in by itself: caught with the rod's `success` chance times the cell's water
 * level (its water units / WATER_UNITS, read when the fish bites), otherwise it gets away. Empty cells can't be fished.
 * Rain, daylight and (at night) torch light near the water change the chance too: see fishChance / FISHING.
 * FISHING.junkChance of the catches are something other than a fish (logs, seeds, leather...: FISHING.junk).
 * Either way the line comes back in, so cast again to keep fishing. Click again (or F) to reel in early.
 * Walking off, switching items or the water drying up reels the line in too.
 *   Fishing.line = { x, y, rod, wait (s before bites can come), bite (s left of the dip, 0 = none), t0 }
 */
const Fishing = { line: null };
/** The held item's fishing stats (FishingLine), or null when it isn't a usable rod. */
function rodStats(item){
    const f = item && typeof item.get === 'function' ? item.get('fishing') : null;
    return f && !item.isBroken ? f : null;
}
const fishPct = v => Math.round(v * 1000) / 10;
/** Why (x, y) can't be fished in, or null when it can (ignores distance). */
function fishWaterReason(x, y){
    if(!Theaya.zone.inBounds(x, y)) return T('fish.notWater');
    const g = groundAt(x, y), i = cellIndex(x, y);
    if(!g || !g.water) return T('fish.notWater');
    if(blockAt(x, y)) return T('cell.inTheWay');
    if((Theaya.water[i] ?? 0) <= 0) return T('fish.dry');
    return null;
}
/** Can the player cast from cell `pc` to (x, y) without walking? (in range, not their own cell, clear line) */
function castReach(pc, x, y){
    const d = hexDist(pc, { x, y });
    return d >= 1 && d <= FISHING.range && lineClear(pc, { x, y }, blocksArrows);
}
/** The closest fishable water cell the player can cast to from where they stand, or null. */
function nearestFishingSpot(){
    const pc = playerCell();
    if(!pc) return null;
    let best = null;
    for(const c of cellsWithin(pc, FISHING.range)){
        if(fishWaterReason(c.x, c.y) || !castReach(pc, c.x, c.y)) continue;
        const d = hexDist(pc, c);
        if(!best || d < best.d) best = { x: c.x, y: c.y, d };
    }
    return best;
}
/** How full a water cell is, 0..1 (its water units / WATER_UNITS). */
function waterLevel(x, y){ return Math.max(0, Math.min(1, (Theaya.water[cellIndex(x, y)] ?? 0) / WATER_UNITS)); }
/** Is it raining (not snowing / hailing) on (x, y)? Its intensity 0..1, or 0. */
function rainOn(x, y){
    if(!Weather.current || !Weather.data().precipitation || Weather.type === 'hail' || Weather.current.hail) return 0;
    if(Theaya.biome[cellIndex(x, y)] === 'cave' || temperatureAt(x, y) <= 0) return 0;   // sheltered, or it's snow
    return Math.max(0, Math.min(1, Weather.param('intensity', 0.6)));
}
/** Daylight at (x, y), 0 (night) .. 1 (full sun): the clock's light, dimmed by storm clouds and caves. */
function daylightAt(x, y){
    const i = cellIndex(x, y), cave = Theaya.biome[i] === 'cave';
    return Clock.light() * (1 - (cave ? 0 : Weather.param('darkness', 0))) * (1 - CAVE_DARKNESS * CaveDepth.shade(i));   // darker the deeper in
}
/**
 * Artificial light reaching (x, y), 0..1: torches, lamps, ore hearts and lit machines, each fading out over
 * its glow radius (the same lights the night overlay uses). The player's own light isn't counted.
 */
function artificialLightAt(x, y){
    const at = Theaya.zone.toWorld(x, y);
    let sum = 0;
    const add = (i, r) => { const c = cellXY(i), p = Theaya.zone.toWorld(c.x, c.y), d = Math.hypot(p.x - at.x, p.y - at.y); if(r > 0 && d < r) sum += 1 - d / r; };
    for(const i of Theaya.lights){ const b = Theaya.blocks[i], def = b && Blocks.get(b.id); if(def && def.light) add(i, def.light); }
    for(const M of Object.values(MACHINES)) if(M.light) for(const i of M.cells()){ const b = Theaya.blocks[i]; if(b && b.lit) add(i, M.light); }
    return Math.min(1, sum);
}
/**
 * The chance a bite at (x, y) is caught with this rod, and why:
 *   (rod success + rain + daylight - light at night, kept within FISHING.minChance..maxChance) x the cell's water level
 * Returns { chance, base, rain, day, light, water } (rain / day / light are the added / taken percentages as 0..1).
 */
function fishChance(f, x, y){
    const rain = rainOn(x, y), daylight = daylightAt(x, y);
    const mods = {
        rain:  rain > 0 ? FISHING.rainBase + FISHING.rainPerIntensity * rain : 0,
        day:   FISHING.dayBonus * daylight,
        light: FISHING.nightLight * artificialLightAt(x, y) * (1 - daylight),
    };
    const base = Math.max(FISHING.minChance, Math.min(FISHING.maxChance, f.success + mods.rain + mods.day - mods.light));
    const water = waterLevel(x, y);
    return Object.assign({ chance: base * water, base, water }, mods);
}
/** The catch chance alone (see fishChance). */
function fishSuccess(f, x, y){ return fishChance(f, x, y).chance; }
/** What changed the catch chance, for the cast toast: ' (rain +11%, daylight +5%)' or ''. */
function fishModsText(c){
    const parts = [];
    if(c.rain >= 0.005)  parts.push(T('fish.mod.rain', { n: fishPct(c.rain) }));
    if(c.day >= 0.005)   parts.push(T('fish.mod.day', { n: fishPct(c.day) }));
    if(c.light >= 0.005) parts.push(T('fish.mod.light', { n: fishPct(c.light) }));
    return parts.length ? T('fish.mods', { list: parts.join(T('list.sep')) }) : '';
}
/** "Cast line (lure, catch)". With a cell: the catch chance there right now (water, weather, time of day, light). */
function castLabel(rod, x = null, y = null){
    const f = rodStats(rod);
    if(!f) return '';
    return T('fish.castLabel', { lure: fishPct(f.lure), success: fishPct(x == null ? f.success : fishSuccess(f, x, y)) });
}
/** A non-fish catch: [itemId, count] from FISHING.junk. */
function rollFishingJunk(){
    const list = FISHING.junk.filter(j => j.id.startsWith('#') || Items.has(j.id));
    let roll = Math.random() * list.reduce((a, j) => a + j.weight, 0), pick = list[list.length - 1];
    for(const j of list){ roll -= j.weight; if(roll <= 0){ pick = j; break; } }
    const any = ids => ids[Math.floor(Math.random() * ids.length)];
    let id = pick.id;
    if(id === '#log') id = any(logTypes.map(t => `${t}_log`));
    else if(id === '#seeds') id = any(Crops.ids().map(c => Crops.get(c).seed).filter(s => Items.has(s)));
    const [min, max] = Array.isArray(pick.amount) ? pick.amount : [pick.amount ?? 1, pick.amount ?? 1];
    return [id, randInt(min, max)];
}
/** Cast the held rod at (x, y). Walks next to it first when it's out of reach. */
function castLine(x, y){
    const rod = heldItem(), f = rodStats(rod);
    if(!f){ notify(T('fish.holdRod'), '#ffb070'); return; }
    const why = fishWaterReason(x, y);
    if(why){ notify(why, '#ffb070'); return; }
    const pc = playerCell();
    if(!pc) return;
    if(pc.x === x && pc.y === y){ notify(T('fish.tooClose'), '#ffb070'); return; }
    if(!castReach(pc, x, y)){ doNear({ x, y }, () => castLine(x, y)); return; }
    Act.job = null; Act.combat = null;
    areaZones.home.stopMove(player);
    Fishing.line = { x, y, rod, wait: FISHING.settle, bite: 0, t0: performance.now() };
    const c = fishChance(f, x, y);
    notify(T('fish.cast', { lure: fishPct(f.lure), success: fishPct(c.chance), w: Theaya.water[cellIndex(x, y)] ?? 0, max: WATER_UNITS }) + fishModsText(c), '#8fd0ff');
}
/** Pull the line back in. quiet = no toast. */
function reelIn(quiet = false){
    if(!Fishing.line) return;
    Fishing.line = null;
    if(!quiet) notify(T('fish.reeled'), '#cfd8e0');
}
/** F key with a rod: reel in, or cast at the nearest water in reach. */
function useRod(){
    if(Fishing.line){ reelIn(); return; }
    const spot = nearestFishingSpot();
    if(!spot){ notify(T('fish.noWaterNear', { n: FISHING.range }), '#ffb070'); return; }
    castLine(spot.x, spot.y);
}
/** The bobber went under: the rod reels it in by itself. Caught or not, the line comes back. */
function landCatch(L){
    Fishing.line = null;
    const rod = L.rod, f = rodStats(rod);
    if(!f) return;
    const at = Theaya.zone.toWorld(L.x, L.y);
    Mobs.fx.push({ kind:'poof', x: at.x, y: at.y, t0: performance.now(), dur: 450, color:'#bfe6ff' });
    rod.wear(1);
    if(rod.isBroken){ player.inventory.removeRef(rod); notify(T('notify.broke', { item: nameOf(rod.id) }), '#ff8a7a'); }
    if(Math.random() >= fishSuccess(f, L.x, L.y)){ notify(T('fish.gotAway'), '#ffb070'); return; }   // conditions as they are now, at the bite
    if(Math.random() < FISHING.junkChance){   // something that isn't a fish
        const [id, n] = rollFishingJunk();
        if(roomForItems(id) < n){ notify(T('fish.noRoom', { fish: nameOf(id) }), '#ff8a7a'); return; }
        giveItems(id, n);
        notify(T('fish.junk', { items: T('item.count', { n, name: nameOf(id) }) }), '#d8c8a0');
        gainXp(FISHING.junkXp, 'fishing');
        return;
    }
    const fish = rollFish(f.tier);
    if(roomForItems(fish) < 1){ notify(T('fish.noRoom', { fish: nameOf(fish) }), '#ff8a7a'); return; }
    giveItems(fish, 1);
    notify(T('fish.caught', { fish: nameOf(fish) }), '#a6f0a0');
    gainXp(XP.fish, 'fishing');
}
/** Every tick: keep the line out, roll for bites, land them. */
function tickFishing(dt){
    const L = Fishing.line;
    if(!L) return;
    const pc = playerCell();
    if(heldItem() !== L.rod || !rodStats(L.rod)){ reelIn(true); notify(T('fish.switched'), '#cfd8e0'); return; }
    if(!pc || areaZones.home.isMoving(player) || !castReach(pc, L.x, L.y)){ reelIn(true); notify(T('fish.walkedOff'), '#cfd8e0'); return; }
    if(fishWaterReason(L.x, L.y)){ reelIn(true); notify(T('fish.waterGone'), '#ffb070'); return; }
    if(L.bite > 0){
        L.bite -= dt;
        if(L.bite <= 0) landCatch(L);
        return;
    }
    if(L.wait > 0){ L.wait -= dt; return; }
    if(Math.random() < rodStats(L.rod).lure * dt){ L.bite = FISHING.biteTime; L.biteAt = performance.now(); }
}
/** World space: the line from the player's rod tip to the bobbing float. */
function drawFishingLine(){
    const L = Fishing.line;
    if(!L) return;
    const pp = player.transform.position, at = Theaya.zone.toWorld(L.x, L.y), t = performance.now() / 1000;
    const a = Math.atan2(at.y - pp.y, at.x - pp.x);
    const tipX = pp.x + Math.cos(a) * 16, tipY = pp.y + Math.sin(a) * 16 - 18;   // the rod points toward the water, raised
    const biting = L.bite > 0;
    const bx = at.x + (biting ? Math.sin(t * 40) * 1.5 : 0), by = at.y + (biting ? 3 : Math.sin(t * 2.4) * 1.5);
    // the rod
    stroke('#7a5532'); strokeWeight(2.5); line(pp.x + Math.cos(a) * 4, pp.y + Math.sin(a) * 4 - 4, tipX, tipY);
    // the line, sagging a little (taut while something bites)
    const sag = biting ? 0 : 14;
    noFill(); stroke(235, 235, 225, 210); strokeWeight(1);
    bezier(tipX, tipY, tipX + (bx - tipX) * 0.35, tipY + sag, tipX + (bx - tipX) * 0.7, by + sag * 0.6, bx, by);
    // ripples around the float
    const ring = (t * 0.8) % 1;
    stroke(220, 240, 255, 150 * (1 - ring)); ellipse(at.x, at.y + 4, 10 + 22 * ring, (10 + 22 * ring) * 0.45);
    if(biting){ const k = ((performance.now() - (L.biteAt || 0)) / 250) % 1; stroke(255, 255, 255, 220 * (1 - k)); ellipse(at.x, at.y + 4, 8 + 30 * k, (8 + 30 * k) * 0.45); }
    // the float: red over white (only the red top shows while it's pulled under)
    noStroke();
    if(!biting){ fill('#f4f1e8'); circle(bx, by + 2, 7); }
    fill('#e0483a'); circle(bx, by - 1, biting ? 5 : 7);
    if(biting){ fill(255, 230, 120); textSize(16); textStyle(BOLD); textAlign(CENTER, BOTTOM); text('!', at.x, at.y - 10); textStyle(NORMAL); }
}

function useLabel(item){
    if(!item) return null;
    if(item instanceof Canteen) return item.water.empty ? null : T('use.drinkWater', { v: item.water.value, c: item.water.capacity });
    if(item.has && item.has('consume')) return T(isDrink(item) ? 'use.drink' : 'use.eat', { item: nameOf(item.id) }) + (item.has('poisonous') ? T('use.rawMayPoison') : '');
    if(armorSlotOf(item)) return T('use.wear', { item: nameOf(item.id) });
    if(item instanceof BlockItem && Blocks.get(item.block) && Blocks.get(item.block).light) return T('use.placeHere', { item: nameOf(item.id) });
    if(rodStats(item)) return Fishing.line ? T('fish.reelLabel') : castLabel(item);
    return null;
}
/** F key / "Eat"/"Drink" action: use the held item on yourself (a fishing rod: cast / reel in). */
function useHeld(){
    const inv = player.inventory;
    if(rodStats(heldItem())){ useRod(); return; }
    useItem(heldItem(), slotRef(inv, inv.hotbarSlot(GameUI.hotbar)));
}
/** Use an item on yourself: eat / drink it, wear it, or put a torch down. ref = the slot it's in. */
function useItem(item, ref){
    const p = player, box = ref ? ref.box : p.inventory;
    if(!item){ notify(T('use.nothingInHand'), '#ffb070'); return; }
    if(item instanceof Canteen){
        if(item.water.empty){ notify(T('use.canteenEmpty'), '#ffb070'); return; }
        item.water.value--;
        p.thirst = Math.min(100, p.thirst + SURVIVAL.sip);
        notify(T('use.drankWater', { thirst: Math.round(p.thirst) }), '#8fd0ff');
        return;
    }
    if(item instanceof Bucket){ notify(T('use.bucketNotForDrinking'), '#ffb070'); return; }
    const bandage = item.get('bandage');
    if(bandage){   // heals at once, then every bandage has to wait (p.bandageCd)
        if(p.bandageCd > 0){ notify(T('use.bandageWait', { secs: Math.ceil(p.bandageCd) }), '#ffb070'); return; }
        if(p.health >= p.maxHealth){ notify(T('use.bandageFull'), '#ffb070'); return; }
        const before = p.health;
        p.health = Math.min(p.maxHealth, p.health + bandage.heal);
        p.bandageCd = bandage.cooldown;
        item.removeCount(1);
        if(box === p.inventory) p.inventory._changed({ event:'consume' }); else box.changed({ event:'consume' });
        notify(T('use.bandaged', { hp: Math.round(p.health - before), secs: bandage.cooldown }), '#a6f0a0');
        return;
    }
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
        const quench = item.get('quench'), ret = item.get('returnsItem');
        if(quench) p.thirst = Math.min(100, p.thirst + quench.amount);   // a drink (milk)
        item.removeCount(1);
        if(box === p.inventory) p.inventory._changed({ event:'consume' }); else box.changed({ event:'consume' });
        if(ret && ret.itemId && Items.has(ret.itemId)){   // the container comes back (milk bucket -> empty bucket), in the same slot when it's free
            if(ref && !box.getSlot(ref.i)){ box.setSlot(ref.i, Items.create(ret.itemId, 1)); if(box === p.inventory) p.inventory._changed({ event:'return' }); else box.changed(); }
            else if(giveItems(ret.itemId, 1) > 0) notify(T('use.noRoomFor', { item: nameOf(ret.itemId) }), '#ffb070');
        }
        const extras = (r.health ? T('use.ateHealth', { hp: r.health }) : '') + (regenC ? T('use.ateRegen', { rate: regenC.rate, secs: regenC.seconds }) : '');
        if(isDrink(item)){ notify(T('use.drank', { item: nameOf(item.id), thirst: Math.round(p.thirst), hunger: Math.round(p.hunger) }) + extras, '#8fd0ff'); return; }
        if(poison && Math.random() < Difficulty.bad(poison.chance)){
            // a second bad meal stacks the time, not the damage
            const pm = poisonSkillMult();   // Steel Stomach: shorter, weaker poison
            p.poison = { left: (p.poison ? p.poison.left : 0) + poison.seconds * pm, dps: Math.max(poison.dps * pm, p.poison ? p.poison.dps : 0) };
            notify(T('use.atePoisoned', { item: nameOf(item.id), secs: Math.ceil(p.poison.left) }), '#c6ff6a');
            return;
        }
        notify(T('use.ate', { item: nameOf(item.id), hunger: Math.round(p.hunger) })
            + (quench ? T('use.ateThirst', { thirst: Math.round(p.thirst) }) : '') + extras, '#a6f0a0');   // soups / stews quench a little too
        return;
    }
    if(armorSlotOf(item)){ equipArmor(ref); return; }
    if(item instanceof BlockItem && Blocks.get(item.block) && Blocks.get(item.block).light && !Blocks.get(item.block).solid){   // torch: put it down at your feet
        const pc = playerCell();
        if(pc) placeBlock(pc.x, pc.y);
        return;
    }
    notify(T('use.cantUse', { item: nameOf(item.id) }), '#ffb070');
}

function inspectCell(x, y){
    const i = cellIndex(x, y), b = blockAt(x, y), def = blockDefAt(x, y), g = groundAt(x, y);
    const biome = Theaya.biome[i] === 'cave' ? T('inspect.caveIn', { biome: nameOf(Theaya.parentBiome[i]) }) : nameOf(Theaya.biome[i]);
    const parts = [], sep = T('list.sep');
    if(def){
        let t = T('inspect.blockName', { name: def.name });
        if(def.hardness >= 10) t += T('inspect.unbreakable');
        else t += T('inspect.hardness', { h: def.hardness }) + (def.tier > 0 ? sep + T('mine.needsTier', { tier: def.tier, tool: nameOf(def.tool) }) : sep + T('inspect.byHand'));
        if(def.grow) t += sep + T('inspect.growing');
        if(!def.solid) t += sep + T('inspect.walkOver');
        parts.push(t);
        if(def.kind === 'farmland'){
            const over = Math.max(0, Math.round(b.water - FARM.waterMax)), irr = irrigationText(i);
            parts.push(T('inspect.farmWater', { w: Math.round(b.water), max: FARM.waterMax }) + (over ? T('inspect.overTop', { n: over }) : '') + (irr ? T('inspect.paren', { text: irr }) : ''));
            if(b.flood > 0) parts.push(T('inspect.floodedFor', { pct: (b.flood / FARM.floodDays * 100).toFixed(0) }));
            const sl = farmSeedlings(b);
            if(sl.length) parts.push(T('inspect.seedlings', { crop: nameOf(sl[0].info.crop.id), n: sl.length, max: FARM.slots,
                list: sl.map(e => seedlingState(e.info) + (e.p.dry > 0 ? T('inspect.dry') : '')).join(sep) }));
            else parts.push(T('inspect.noSeedlings', { max: FARM.slots }));
            const iw = waterOf(b.intake && b.intake.getSlot(0));
            if(iw) parts.push(T('inspect.waterSlot', { item: nameOf(b.intake.getSlot(0).id), v: iw.value, c: iw.capacity }));
        }
        if(def.kind === 'ore_heart') parts.push(T('inspect.oreHeart', { ore: nameOf(def.material) }));
        if(b.id === 'heart_stone'){
            const st = heartStats(b);
            parts.push(T('inspect.heartStone', { r: st.radius, pct: Math.round(st.rate * 100) }));
            if(Theaya.home === i) parts.push(T('heart.spawnHere'));
        }
        if(def.safe) parts.push(T('inspect.safe', { n: def.safe }));
        if(b.cracks > 0) parts.push(T('inspect.cracked', { pct: Math.round(b.cracks * 100) }));
        const info = plantInfo(b);
        if(info){
            parts.push(T('inspect.plant', { crop: nameOf(info.crop.id), state: seedlingState(info), days: b.plant.age.toFixed(2) }) + (b.plant.dry > 0 ? T('inspect.plantDry') : ''));
            if(info.crop.tier > 0) parts.push(T('inspect.harvestNeedsHoe', { tier: info.crop.tier }));
        }
        if(def.station === 'forge' || def.station === 'pot' || def.station === 'rack') parts.push(b.status);
        if(def.kind === 'boat') parts.push(T(boatHasPlayer(i) ? 'inspect.boatSailing' : 'inspect.boatStep'));
    } else if(g && g.water){
        parts.push(T('inspect.waterCell', { n: Theaya.water[i], max: WATER_UNITS }));
    } else {
        parts.push(g ? g.name : '?');
        if(Theaya.dried.has(i)) parts.push(T('inspect.driedWater'));
        const dig = floorDigAt(x, y);
        if(isFoundation(i)) parts.push(T('inspect.foundation', { kind: T('foundation.kind.' + foundationKind(i)) }));
        else if(dig) parts.push(T('inspect.floorStock', { what: nameOf(dig.what), n: floorStockAt(i), max: FLOOR_STOCK.max }));
    }
    if(blockAt(x, y) && isFoundation(i)) parts.push(T('inspect.foundation', { kind: T('foundation.kind.' + foundationKind(i)) }));
    if(Theaya.puddles.has(i)) parts.push(T('inspect.puddle', { n: Theaya.puddles.get(i) }));
    if(Theaya.mud.has(i)) parts.push(T('inspect.muddy'));
    if(Theaya.snow.has(i)) parts.push(T('inspect.snowy'));
    parts.push(`${Math.round(temperatureAt(x, y))}°C`);
    parts.push(biome);
    // one line per fact; stays 8 s, but fades out as soon as the player walks away from where they inspected it
    const toast = notify(parts.join('\n'), '#e8e8e8', 8000), pp = player.transform.position;
    toast.stayNear = { x: pp.x, y: pp.y };
}

/**
 * Options for the action wheel on cell (x, y):
 *   { label, enabled, reason?, warn?, run }
 * `warn` says the player walks to the cell first.
 */
/** Why a creature action can't be done right now (null = it can). act: { display, require:{ item }, result:{ item, count }, cooldown (s) }. */
/**
 * The inventory stack a creature action uses (its `require`), or null. require.empty = only an
 * empty canteen / bucket counts (milking needs an empty bucket, so no water is lost).
 */
function actionItem(act){
    const r = act.require, need = r && (r.item ?? r.id), inv = player.inventory;
    if(!need) return null;
    for(let k = 1; k <= inv.slots; k++){
        const it = inv[k];
        if(!it || it.id !== need || it.count < (r.count ?? 1)) continue;
        if(r.empty){ const w = waterOf(it); if(w && !w.empty) continue; }
        return it;
    }
    return null;
}
function creatureActionReason(m, key, act){
    const need = act.require && (act.require.item ?? act.require.id), it = actionItem(act);
    if(need && !it){
        if(act.require.empty && player.inventory.countOf(need) > 0) return T('action.needsEmptyDump', { item: nameOf(need) });
        return T(act.require.empty ? 'action.needsEmpty' : 'action.needs', { item: nameOf(need) });
    }
    const wait = ((m.actionAt && m.actionAt[key]) || 0) - Mobs.now;
    if(wait > 0) return T('action.wait', { secs: Math.ceil(wait) });
    const res = act.result && (act.result.item ?? act.result.id);
    const frees = it && act.require.consume !== false && it.count <= (act.require.count ?? 1);   // using it up frees its slot
    if(res && roomForItems(res) < (act.result.count ?? 1) && !(need && need === res) && !frees) return T('action.invFull');
    return null;
}
/** A creature action's wheel label: THEAYA_TEXT 'action.<creature>.<key>' ({creature} = its name), else the spec's `display` (@ = the creature). */
function creatureActionLabel(m, key, act){
    const k = `action.${m.type}.${key}`;
    if(THEAYA_TEXT[k]) return T(k, { creature: m.def.name });
    return (act.display ?? nameOf(key)).replace('@', m.def.name);
}
/**
 * Left-click quick action on a creature while holding the item one of its actions needs (a bucket on a cow:
 * milk it). { label, run } / { label, reason }, or null when the held item isn't used by any of its actions.
 */
function heldCreatureAction(m, held){
    if(!held || !m.alive) return null;
    for(const [key, act] of Object.entries(m.def.actions ?? {})){
        const need = act.require && (act.require.item ?? act.require.id);
        if(need !== held.id) continue;
        const label = creatureActionLabel(m, key, act), why = creatureActionReason(m, key, act);
        if(why) return { label, reason: why };
        return { label, cursor: 'pointer', run: () => {
            const pc = playerCell();
            if(pc && hexDist(pc, m) <= 1) doCreatureAction(m, key, act);
            else doNear({ x: m.x, y: m.y }, () => doCreatureAction(m, key, act));
        } };
    }
    return null;
}
function doCreatureAction(m, key, act){
    if(!m.alive) return;
    const pc = playerCell();
    if(!pc || hexDist(pc, m) > 1){ notify(T('action.stayNext', { creature: m.def.name }), '#ffb070'); return; }
    const why = creatureActionReason(m, key, act);
    if(why){ notify(why, '#ffb070'); return; }
    const need = act.require && (act.require.item ?? act.require.id), res = act.result && (act.result.item ?? act.result.id);
    if(need && act.require.consume !== false){   // use up the exact stack actionItem found (an empty bucket, not a full one)
        actionItem(act).removeCount(act.require.count ?? 1);
        player.inventory._changed({ event:'creatureAction' });
    }
    if(res) giveItems(res, act.result.count ?? 1);
    if(act.cooldown){ m.actionAt = m.actionAt || {}; m.actionAt[key] = Mobs.now + act.cooldown; }
    notify(res ? T('gain.items', { items: T('item.count', { n: act.result.count ?? 1, name: nameOf(res) }) }) : T('action.done', { action: nameOf(key) }), '#a6f0a0');
}

function buildActions(x, y){
    const opts = [];
    const pc = playerCell();
    if(!pc) return opts;
    const cell = { x, y }, i = cellIndex(x, y);
    const d = hexDist(pc, cell);
    const b = blockAt(x, y), def = b && Blocks.get(b.id), g = groundAt(x, y);
    const held = heldItem(), w = waterOf(held);
    const isBoatItem = held instanceof BlockItem && !!Blocks.get(held.block) && Blocks.get(held.block).kind === 'boat';
    let approach;
    const getApproach = () => approach !== undefined ? approach : (approach = findApproach(cell));

    // An action done from a neighbouring cell. Walks there first when needed.
    // extra.id = a stable name for the option (labels change with the language; the tutorial finds options by id)
    const nearAction = (label, run, extra = {}) => {
        const id = extra.id;
        if(extra.enabled === false) return { id, label, enabled:false, reason: extra.reason };
        if(d === 1) return { id, label, enabled:true, run: () => doNear(cell, run) };
        if(d === 0 && extra.here){ return { id, label, enabled:true, run } }
        const ap = getApproach();
        if(!ap) return { id, label, enabled:false, reason: T('wheel.cantReach') };
        const steps = ap.path.length;
        return { id, label, enabled:true, warn: T('wheel.walksFirst', { n: steps, s: steps === 1 ? '' : 's' }), run: () => doNear(cell, run) };
    };

    // Main action: move
    if(d > 0){
        if(isPassable(x, y)){
            const path = areaZones.home.findPath(pc, cell, pathOpts());
            opts.push(path ? { label: T('wheel.moveHere'), enabled:true, run: () => walkTo(x, y) }
                           : { label: T('wheel.moveHere'), enabled:false, reason: T('wheel.noPath') });
        } else if(d > 1){
            const ap = getApproach();
            opts.push(ap ? { label: T('wheel.moveNext'), enabled:true, run: () => walkTo(ap.x, ap.y) }
                         : { label: T('wheel.moveNext'), enabled:false, reason: T('wheel.noPath') });
        }
    }

    // A creature in the cell: attack it (walks into range first)
    const mob = Mobs.at(x, y);
    if(mob){
        const a = attackActionFor(mob);
        opts.push(a.reason ? { label: a.label, enabled:false, reason: a.reason } : { label: a.label, enabled:true, run: a.run });
        // actions a creature offers (its `actions`, see defineElement): milk a cow, shear a sheep...
        for(const [key, act] of Object.entries(mob.def.actions ?? {})){
            const why = creatureActionReason(mob, key, act), label = creatureActionLabel(mob, key, act);
            opts.push(nearAction(label, () => doCreatureAction(mob, key, act), { enabled: !why, reason: why }));
        }
    }

    if(def){
        if(def.station) opts.push(nearAction(T('wheel.open', { name: def.name }), () => openStation(x, y)));
        const info = plantInfo(b);
        if(info){
            const name = nameOf(info.crop.id), tier = canHarvestTier(info.crop, held);
            if(info.rot) opts.push(nearAction(T('wheel.clearRotten', { crop: name }), () => harvestPlant(x, y)));
            else if(info.stage && info.stage.yield[1] > 0){
                opts.push(nearAction(T('wheel.harvest', { crop: name }) + (info.ripe ? '' : T('farm.notRipe')), () => harvestPlant(x, y), { enabled: tier.ok, reason: tier.reason }));
            }
        }
        if(def.kind === 'fern') opts.push(nearAction(T('wheel.gatherFibers'), () => harvestFern(x, y), { here:true, id:'gather' }));
        if(def.kind === 'pickup') opts.push(nearAction(pickUpLabel(b), () => pickUpBlock(x, y), { here:true, id:'gather' }));
        if(def.kind === 'farmland'){
            // harvesting farmland needs no hoe
            const hl = farmHarvestLabel(b);
            if(hl) opts.push(nearAction(hl, () => harvestFarmland(x, y)));
            if(held instanceof CropSeedItem){
                const why = plantReason(b, held), n = b.seeds.items.filter(Boolean).length;
                opts.push(nearAction(T('wheel.plant', { crop: nameOf(held.crop), n, max: FARM.slots }), () => plantSeed(x, y), { enabled: !why, reason: why, id:'plant' }));
            }
            if(held instanceof Bucket){
                const full = b.water >= FARM.waterMax;   // full: pouring more floods it (a pond, given time)
                const reason = w.empty ? T('water.bucketEmptyShort') : b.water >= FARM.floodMax ? T('wheel.cantHoldMore') : undefined;
                opts.push(nearAction(T(full ? 'wheel.flood' : 'wheel.water', { w: Math.round(b.water), max: FARM.waterMax }), () => waterFarmland(x, y), { enabled: !reason, reason, id:'waterFarmland' }));
                if(b.water > FARM.waterMax){   // flooded: scoop the extra back into the bucket
                    const why = unfloodReason(b, w);
                    opts.push(nearAction(T('wheel.unflood', { w: Math.round(b.water), max: FARM.waterMax }), () => unfloodFarmland(x, y), { enabled: !why, reason: why }));
                }
            }
        }
        if(!def.replaceable){
            const mi = miningInfo(def, held), busy = containerBusy(b), sitting = boatHasPlayer(i);
            opts.push(nearAction(T('action.verbBlock', { verb: verbFor(def), block: def.name }) + (mi.ok ? T('wheel.secs', { secs: mi.time.toFixed(1) }) : ''),
                () => startMine(x, y),
                { enabled: mi.ok && !busy && !sitting, reason: !mi.ok ? mi.reason : busy ? T('wheel.emptyFirst') : sitting ? T('boat.sittingInShort') : undefined, here: !def.solid }));
        }
    }
    const floorish = !def || def.replaceable;
    // Fishing rod: reel in when the line is out, otherwise cast into this water cell
    if(rodStats(held)){
        if(Fishing.line){ if(d > 0) opts.push({ label: T('fish.reelLabel'), enabled:true, run: () => reelIn() }); }   // (own cell: the use option below)
        else if(g && g.water && d > 0){
            const why = fishWaterReason(x, y);
            const far = !why && !castReach(pc, x, y);
            opts.push(why ? { label: castLabel(held), enabled:false, reason: why }
                          : { label: castLabel(held, x, y), enabled:true, warn: far ? T('fish.walksCloser') : undefined, run: () => castLine(x, y) });
        }
    }
    if(isShovel(held) && !def && g && g.water){
        const can = canFillWaterCell(x, y, held);
        opts.push(nearAction(fillWaterLabel(x, y, held), () => startFillWater(x, y), { enabled: can.ok, reason: can.reason }));
    }
    const src = waterSourceAt(x, y);
    if(floorish && src && (src.kind === 'water' || w)){
        let reason;
        if(!w) reason = T('water.holdContainerShort');
        else if(src.left <= 0) reason = T('water.sourceDryShort');
        else if(w.full) reason = T('water.isFull', { item: nameOf(held.id) });
        const what = w ? nameOf(held.id) : nameOf('canteen');
        opts.push(nearAction(T(src.kind === 'puddle' ? 'wheel.fillPuddle' : 'wheel.fill', { item: what, n: src.left, max: src.max }), () => fillContainer(x, y), { enabled: !reason, reason, here: src.kind === 'puddle', id:'fill' }));
    }
    if(floorish && g && g.passable){
        if(isHoe(held)){
            const can = canTill(x, y);
            opts.push(nearAction(T('wheel.till', { secs: tillTime(held).toFixed(1) }), () => startTill(x, y), { enabled: can.ok, reason: can.reason }));
        }
        if(!def && Theaya.ground[i] === FLOOR && !isFoundation(i)){ const can = canDigGrass(x, y, held);
            opts.push(nearAction(digLabel(held, x, y), () => startDigGrass(x, y), { enabled: can.ok, reason: can.reason, here:true }));
        }
        // shovel on dug-out floor: lay a foundation; pickaxe on a foundation: break it up
        if(!def && Theaya.ground[i] === FLOOR && isShovel(held) && !isFoundation(i)){
            for(const kind of Object.keys(FOUNDATION.kinds)){   // one option per kind: marble (calcite) or stone
                const can = canFoundation(x, y, held, kind);
                opts.push(nearAction(foundationLabel(held, kind), () => startFoundation(x, y, kind), { enabled: can.ok, reason: can.reason, here:true }));
            }
        }
        if(!def && isFoundation(i) && hasToolClass(held, 'pickaxe')){ const can = canBreakFoundation(x, y, held);
            opts.push(nearAction(T('foundation.breakLabel', { secs: breakFoundationTime(held).toFixed(1) }), () => startBreakFoundation(x, y), { enabled: can.ok, reason: can.reason, here:true }));
        }
        // walk-over blocks (torches, sand) can go on your own cell
        const underfoot = held instanceof BlockItem && !blocksMover(Blocks.get(held.block), 'player');
        if((d > 0 || underfoot) && held instanceof BlockItem) opts.push(nearAction(T('wheel.place', { item: nameOf(held.id) }), () => placeBlock(x, y), { here: underfoot, id:'place' }));
    } else if(!def && d > 0 && held instanceof BlockItem){
        if(isBoatItem && g && g.water) opts.push(nearAction(T('wheel.place', { item: nameOf(held.id) }), () => placeBlock(x, y), { id:'place' }));
        else opts.push({ label: T('wheel.place', { item: nameOf(held.id) }), enabled:false, reason: isBoatItem ? T('wheel.boatOnWater') : T('wheel.cantBuild') });
    }

    if(d === 0){
        const use = useLabel(held);
        if(use) opts.push({ label: use, enabled:true, run: useHeld });
    }
    opts.push({ label: T('wheel.inspect'), enabled:true, run: () => inspectCell(x, y) });
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
    GameUI.inventoryOpen = true;   // a station menu always opens with the backpack next to it
}
/** Close the station menu. `andInventory` (default) closes the backpack with it. */
function closeStation(andInventory = true){
    GameUI.station = null;
    GameUI.picked = null;
    if(andInventory) GameUI.inventoryOpen = false;
}
/** Close every menu (station + backpack): Tab / E / Esc while a station is open, and the panels' close buttons. */
function closeMenus(){
    closeStation(true);
    GameUI.wheel = null; GameUI.itemMenu = null; GameUI.confirmDelete = null;
    resetRecipeSearch();
}
/** The station next to you ({ x, y }, the hovered one first) that passes `test(def)`, or null. */
function nearbyStation(test = () => true){
    const pc = playerCell();
    if(!pc) return null;
    const cands = areaZones.home.neighbors(pc.x, pc.y).filter(n => { const d = blockDefAt(n.x, n.y); return d && d.station && test(d); });
    if(!cands.length) return null;
    const hov = areaZones.home.toCell(mouse.x, mouse.y);
    return (hov && cands.find(c => c.x === hov.x && c.y === hov.y)) || cands[0];
}
/** E key: close the open menus, or open the station next to you (with the backpack). E never opens the backpack alone. */
function tryInteract(){
    if(GameUI.station){ closeMenus(); return; }
    if(!playerCell()) return;
    const st = nearbyStation();
    if(!st){ notify(T('station.noneNear'), '#ffb070'); return; }
    openStation(st.x, st.y);
}
/**
 * Tab key: close the open menus, or open the backpack, plus the workbench next to you if it's a plain
 * recipe menu (workbench, loom: CRAFT_STATIONS). Stations with slots (forge, chest, farmland...) and
 * the heart stone only open with E.
 */
function toggleInventory(){
    GameUI.picked = null; GameUI.wheel = null; GameUI.itemMenu = null; GameUI.confirmDelete = null;
    if(GameUI.station || GameUI.inventoryOpen){ closeMenus(); return; }
    const st = nearbyStation(def => CRAFT_STATIONS.includes(def.station));
    if(st) openStation(st.x, st.y);
    else GameUI.inventoryOpen = true;
}
/** Close the station menu when the station is gone or the player walked off (the backpack stays open). */
function checkStation(){
    const s = GameUI.station, pc = playerCell();
    const def = blockDefAt(s.x, s.y);
    if(!def || def.station !== s.kind || !pc || hexDist(pc, s) > 1) closeStation(false);
}

/** Gear = tools, weapons, buckets and building blocks: crafting these puts them on the hotbar first. */
function isGear(id){
    const it = Items.create(id, 1);
    return !!(it && (it instanceof BlockItem || it.get('mining') || it.get('attack') || it.get('firearm') || it.hasTag('bucket')));
}

function craft(recipe, times = 1){
    const inv = player.inventory;
    const missing = recipe.missing(inv, 1);
    if(missing.length){ notify(T('craft.missing', { list: missing.map(m => T('item.count', { n: m.need - m.have, name: Recipe.label(m.key) })).join(T('list.sep')) }), '#ff8a7a'); return false; }
    times = Math.max(1, Math.min(times, recipe.maxCrafts(inv)));
    const out = recipe.output;
    if(roomForItems(out.id) < out.count * times){ notify(T('craft.noRoom'), '#ff8a7a'); return false; }
    recipe.consume(inv, times);
    giveItems(out.id, out.count * times, isGear(out.id));   // new gear lands on the hotbar first
    notify(T('craft.crafted', { items: T('item.count', { n: out.count * times, name: nameOf(out.id) }) }), '#a6f0a0');
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
function machineRecipe(b, kind){
    // The machine only works on the recipe the player selected (selectMachineRecipe), never on whatever is in the slots.
    const r = b.selected ? Recipe.byId(b.selected) : null;
    if(!r || r.station !== kind || !r.canCraft(b.input)){ b.active = null; b.progress = 0; return null; }
    if(b.active !== r.id){ b.active = r.id; b.progress = 0; }
    return r;
}

/**
 * The ingredients of `times` batches of recipe r that the input slots still lack, taken from the player's
 * inventory: { parts: [{ item, n, whole }], ok }. Nothing is changed. `ok` is false when the inventory is
 * short or the input slots have no room for them. Water ('@water') moves whole canteens / buckets.
 */
function planMachineLoad(b, r, times){
    const inv = player.inventory, slots = [...inv.backpackSlots, ...inv.hotbarSlotList], parts = [];
    for(const [key, n] of Object.entries(r.inputs)){
        let need = n * times - b.input.countOf(key);
        for(const s of slots){
            if(need <= 0) break;
            const it = inv[s];
            if(!it) continue;
            if(key === '@water'){ const w = waterOf(it); if(w && w.value > 0){ parts.push({ item: it, n: 1, whole: true }); need -= w.value; } }
            else if(Recipe.matches(it, key)){ const k = Math.min(need, it.count); parts.push({ item: it, n: k, whole: false }); need -= k; }
        }
        if(need > 0) return { parts, ok: false };
    }
    // room: try the parts in a copy of the input slots
    const test = new Box(b.input.size);
    b.input.items.forEach((it, k) => { if(it) test.items[k] = it.clone(); });
    for(const p of parts){
        const c = p.item.clone(); c.count = p.n;
        if(test.give(c) > 0) return { parts, ok: false };
    }
    return { parts, ok: true };
}

/**
 * The player picked recipe r on a machine (forge, cooking pot, drying rack...): it becomes the machine's recipe,
 * and the ingredients for one batch (every batch that fits with `all`) are pulled from the inventory into its
 * input slots. Whatever was loaded for another recipe goes back to the inventory first.
 */
function selectMachineRecipe(b, kind, r, all = false){
    const inv = player.inventory;
    if(b.selected !== r.id){
        const fits = it => Object.keys(r.inputs).some(k => k === '@water' ? !!waterOf(it) : Recipe.matches(it, k));
        for(let k = 0; k < b.input.size; k++){
            const it = b.input.getSlot(k);
            if(!it || fits(it)) continue;
            if(inv.give(it) === 0) b.input.setSlot(k, null);
        }
        b.input.changed();
        if(!b.input.items.every(it => !it || fits(it))){ notify(T('craft.noRoom'), '#ff8a7a'); return false; }
        b.selected = r.id; b.active = null; b.progress = 0;
    }
    let times = r.maxCrafts(b.input) + 1;
    if(!planMachineLoad(b, r, times).ok){
        if(r.maxCrafts(b.input) > 0) return true;   // already stocked: nothing more to add
        const miss = r.missing({ countOf: k => inv.countOf(k) + b.input.countOf(k) }, 1);
        notify(miss.length ? T('craft.missing', { list: miss.map(m => T('item.count', { n: m.need - m.have, name: Recipe.label(m.key) })).join(T('list.sep')) }) : T('machine.noRoomIn'), '#ff8a7a');
        return false;
    }
    if(all) while(times < 64 && planMachineLoad(b, r, times + 1).ok) times++;
    for(const p of planMachineLoad(b, r, times).parts){
        if(p.whole) inv.removeRef(p.item);
        else { const part = p.item.split(p.n); if(!part) continue; b.input.give(part); continue; }
        b.input.give(p.item);
    }
    inv.changed({ event:'take' }); b.input.changed();
    return true;
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
            const sel = b.selected ? Recipe.byId(b.selected) : null;
            let status = sel ? T('machine.needsIngredients', { item: nameOf(sel.output.id) }) : M.idle;   // idle = no recipe picked yet
            if(r){
                const out = r.output;
                if(!machineHasRoom(b, r)) status = T('machine.outputFull');
                else {
                    if(b.burn <= 0 && !M.noFuel){
                        const f = b.fuel.getSlot(0), v = fuelValue(f);
                        if(v > 0){ f.removeCount(1); b.fuel.changed(); b.burn = b.burnMax = v * M.cfg.fuelSeconds; }
                    }
                    if(b.burn > 0 || M.noFuel){
                        status = T('machine.working', { verb: M.verb, item: nameOf(out.id) });
                        b.progress += dt;
                        if(b.progress >= r.time){
                            b.progress = 0;
                            r.consume(b.input);
                            b.output.give(Items.create(out.id, out.count));
                            const bp = r.byproduct;
                            if(bp && Math.random() < (bp.chance ?? 1)) b.output.give(Items.create(bp.id, bp.count ?? 1));
                            if(!r.canCraft(b.input)) b.active = null;
                        }
                    } else status = T('machine.needsFuel');
                }
            }
            if(b.burn > 0) b.burn = Math.max(0, b.burn - dt);
            b.status = status;
            const lit = b.burn > 0;
            if(lit !== b.lit){ b.lit = lit; Theaya.dirty.add(i); }
            if(M.noFuel){   // the rack draws more hanging when it holds something
                const full = !b.input.isEmpty || !b.output.isEmpty;
                if(full !== b._full){ b._full = full; Theaya.dirty.add(i); }
            }
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
        if(Mobs.occ.has(i) || isFoundation(i)) return false;   // nothing grows through a foundation
        if(Structures.cells.has(i)) return false;               // ...or inside a structure (a camp stays a clearing)
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
    /** The configured name of month m (an id: seasonMonths and set() use it). */
    monthKey(m){ return (this.cfg.monthNames && this.cfg.monthNames[m]) || null; },
    /** Month m's name on screen (THEAYA_NAMES gives the translations). */
    monthName(m){ const k = this.monthKey(m); return k ? nameOf(k) : T('calendar.month', { n: m + 1 }); },
    /** The new year day(s)' name on screen. */
    newYearName(){ return this.cfg.newYearDay ? nameOf(this.cfg.newYearDay) : T('calendar.newYear'); },
    advance(dt){ this.elapsed += dt * this.speed; },
    /** In game days that pass in dt real (scene) seconds. */
    dayDelta(dt){ return dt * this.speed / this.day; },
    get dayIndex(){ return Math.floor(this.elapsed / this.day); },
    /** 0 (sunrise) .. 1 */
    get timeOfDay(){ return (this.elapsed % this.day) / this.day; },
    get isDay(){ return (this.elapsed % this.day) < this.sunTime; },
    /** Real (scene) seconds until the sun is up, 0 while it is. */
    untilDay(){ const t = this.elapsed % this.day; return t < this.sunTime ? 0 : (this.day - t) / this.speed; },
    /** 24 hour clock, sunrise = 06:00. */
    get hour(){ return (6 + this.timeOfDay * 24) % 24; },
    timeText(){ const h = this.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
    /** { year, dayOfYear, month (-1 on a new year day), monthName, dayOfMonth, newYear } */
    date(){
        const D = this.dayIndex, Y = this.yearDays, doy = ((D % Y) + Y) % Y, extra = this.extraDays;
        const year = Math.floor(D / Y) + 1;
        if(doy < extra) return { year, dayOfYear: doy, month: -1, monthName: this.newYearName(), dayOfMonth: doy + 1, newYear: true };
        const m = Math.floor((doy - extra) / this.monthDays);
        return { year, dayOfYear: doy, month: m, monthName: this.monthName(m), dayOfMonth: (doy - extra) % this.monthDays + 1, newYear: false };
    },
    dateText(){ const d = this.date(); return T('calendar.date', { date: d.newYear ? d.monthName : T('calendar.monthDay', { month: d.monthName, day: d.dayOfMonth }), year: d.year }); },
    /** Season id for the current date. */
    season(){ const d = this.date(); return this.seasonOf(d.newYear ? -1 : d.month); },
    /** Season id of month m (0-based; -1 = the new year day(s), which belong to the last month's season). */
    seasonOf(m){
        const seasons = Object.keys(this.cfg.seasons || {});
        if(!seasons.length) return 'none';
        const month = m < 0 ? this.months - 1 : m, name = this.monthKey(month);
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

/**
 * Biome heat map: each cell's base temperature is a blend of the biome temperatures around it,
 * weighted by hex distance (gaussian, out to `radius` cells). Deep inside a biome it's that biome's
 * `temprature`; near an edge it leans toward the neighbour (plains next to a desert warm up as you
 * get closer to the sand). `cave` is the same blend of "how much of the area is cave", 0..1, which
 * shelters a cell from the season / day-night swing. Built per cell on first use and cached:
 * call BiomeHeat.reset() whenever biomes change (world generation, loading a save).
 */
const BiomeHeat = {
    radius: 4,     // cells looked at around each cell
    sigma: 2,      // how fast a neighbour's pull fades with distance (bigger = wider, softer edges)
    base: null, cave: null,
    reset(){ this.base = null; this.cave = null; },
    at(i){
        if(!this.base){ const N = MAP_COLS * MAP_ROWS; this.base = new Float32Array(N).fill(NaN); this.cave = new Float32Array(N); }
        if(Number.isNaN(this.base[i])){
            const c = cellXY(i), tempOf = j => (biomes[Theaya.biome[j]] || {}).temprature ?? 20;
            let sum = tempOf(i), cave = Theaya.biome[i] === 'cave' ? 1 : 0, wsum = 1;
            for(const n of cellsWithin(c, this.radius)){
                const j = cellIndex(n.x, n.y), d = hexDist(c, n), w = Math.exp(-(d * d) / (this.sigma * this.sigma));
                sum += tempOf(j) * w; cave += (Theaya.biome[j] === 'cave' ? 1 : 0) * w; wsum += w;
            }
            this.base[i] = sum / wsum; this.cave[i] = cave / wsum;
        }
        return { base: this.base[i], cave: this.cave[i] };
    },
};

/** Temperature (°C) of a cell: blended biome heat + season + time of day + weather. Caves are sheltered from the season / day swing. */
function temperatureAt(x, y){
    const { base, cave } = BiomeHeat.at(cellIndex(x, y));
    const seasonal = ((Clock.seasonData().temprature ?? 20) - 20) * (1 - 0.5 * cave);
    const t = Clock.timeOfDay * Clock.day, sun = Clock.sunTime;
    const daily = (1 - cave) * (t < sun ? 3 * Math.sin(Math.PI * t / sun) : -4 * Math.sin(Math.PI * (t - sun) / (Clock.day - sun)));
    return base + seasonal + daily + Weather.param('temprature', 0);   // weather reaches every biome, caves included
}
/** °C the player loses standing on snow / next to it (not used for the cell's own temperature, so snow doesn't keep itself frozen). */
const SNOW_CHILL = { on: 6, near: 3 };
function snowChillAt(x, y){
    const i = cellIndex(x, y);
    if(Theaya.snow.has(i)) return SNOW_CHILL.on;
    return neighborIdx(i).some(j => Theaya.snow.has(j)) ? SNOW_CHILL.near : 0;
}
/** The air temperature where the player stands (decides rain vs snow). */
const playerAmbient = () => { const pc = playerCell(); return pc ? temperatureAt(pc.x, pc.y) : 20; };
/** What the player feels: the air temperature minus the chill of snow underfoot / next to them. */
const playerTemperature = () => { const pc = playerCell(); return pc ? temperatureAt(pc.x, pc.y) - snowChillAt(pc.x, pc.y) : 20; };

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
    /** Do clouds hide the sun right now? (a weather with `shade`: rain, storms; the sun can't burn creatures of the dark) */
    shadesSun(){ return !!(this.current && this.data().shade); },
    /** Real (scene) seconds until the current weather ends, 0 when it's clear. */
    left(){ return this.current ? Math.max(0, (this.current.end - Clock.elapsed) / Clock.speed) : 0; },
    name(){
        if(!this.current) return nameOf('clear');
        // the game's weathers are named in THEAYA_NAMES; one added to _weatherControl without a translation uses its own `name`
        const W = this.data(), base = THEAYA_NAMES[this.type] ? nameOf(this.type) : (W.name || nameOf(this.type));
        if(this.current.hail && this.type !== 'hail') return T('weather.plusHail', { name: base });
        if(W.precipitation && playerAmbient() <= 0 && this.type !== 'hail') return nameOf(this.type === 'storm' ? 'snowstorm' : 'snow');
        return base;
    },
    /** Rolls today's weather from the season's list (first entry whose chance hits). */
    roll(){
        for(const w of Clock.seasonData().weather || []){
            const harsh = w.type === 'storm' || w.type === 'drought';   // the difficulty makes these likelier or rarer (rain and the rest stay)
            if(Math.random() >= (harsh ? Difficulty.bad(w.chance || 0) : (w.chance || 0))) continue;
            const [a, b] = w.duration || [0.1, 0.3];
            this.next = { type: w.type, start: Clock.elapsed + Math.random() * 0.6 * Clock.day, duration: (a + Math.random() * (b - a)) * Clock.day };
            return;
        }
    },
    /** Start a weather now. duration in game seconds. */
    begin(type, duration){
        const temp = playerAmbient(), hailMax = (_weatherControl.hail || {}).maxTemprature ?? 10;
        if(type === 'hail' && temp > hailMax) type = 'rain';
        if(!_weatherControl[type]){ console.warn(`Weather: unknown type '${type}'.`); return; }
        const W = _weatherControl[type];
        this.current = { type, start: Clock.elapsed, end: Clock.elapsed + duration,
            hail: type === 'hail' || (!!W.hailChance && temp <= hailMax && Math.random() < W.hailChance) };
        notify(T('weather.begin', { name: this.name() }), '#bcd6ff');
    },
    end(){ if(this.current) notify(T('weather.end', { name: this.name().toLowerCase() }), '#bcd6ff'); this.current = null; },
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
        const openFloor = i => T.biome[i] !== 'cave' && T.ground[i] === FLOOR && !blocksMover(Blocks.get(T.blocks[i] && T.blocks[i].id), 'animal') && !(T.blocks[i] && Blocks.get(T.blocks[i].id).kind === 'farmland');
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
                if(T.biome[i] === 'cave') continue;   // rain never reaches a cave
                if(T.dried.has(i)){
                    if(!T.blocks[i] && notPlayer(i)){ T.dried.delete(i); const { x, y } = cellXY(i); T.water[i] = 1; setGround(x, y, 'water'); }
                } else if(isWaterCell(i) && (T.water[i] ?? 0) < WATER_UNITS){
                    T.water[i] = (T.water[i] ?? 0) + 1; T.refilling.delete(i); T.dirty.add(i);
                }
            }
            if(W.farmWater){
                for(const i of T.plants){
                    const b = T.blocks[i];
                    if(b && b.id === 'farmland' && T.biome[i] !== 'cave' && b.water < FARM.waterMax) b.water = Math.min(FARM.waterMax, b.water + W.farmWater * k * (tempOf(i) <= 0 ? 0.3 : 1));
                }
            }
            for(let n = count(W.ferns); n > 0; n--){
                const i = randomCell(i => !T.blocks[i] && T.ground[i] === FLOOR && !T.foundations.has(i) && ['plains', 'forest'].includes(T.biome[i]) && notPlayer(i) && tempOf(i) > 0);
                if(i >= 0){ const { x, y } = cellXY(i); setBlock(x, y, 'fern'); }
            }
            for(let n = count(W.clay); n > 0; n--){
                const i = randomCell(i => T.biome[i] !== 'cave' && T.blocks[i] && T.blocks[i].id === 'dirt' && nextToWater(i), 60);
                if(i >= 0){ const { x, y } = cellXY(i); setBlock(x, y, 'clay'); }
            }
            if(this.current.hail){
                const H = _weatherControl.hail || {};
                for(const i of T.plants){
                    const b = T.blocks[i], info = plantInfo(b);
                    if(T.biome[i] === 'cave') continue;
                    if(info && !info.rot && b.plant.age > 0 && chance(H.cropDamage)){ b.plant.age = Math.max(0, b.plant.age - (H.setback ?? 0.25)); T.dirty.add(i); }
                    for(const { p, info: si } of farmSeedlings(b)){   // farmland: each seedling can be hit
                        if(!si.rot && p.age > 0 && chance(H.cropDamage)){ p.age = Math.max(0, p.age - (H.setback ?? 0.25)); T.dirty.add(i); }
                    }
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
        if(b && b.id === 'sand'){ setBlock(x, y, 'glass'); notify(T('weather.lightningGlass'), '#fff2a8'); }
        if(x === pc.x && y === pc.y){ damagePlayer(W.lightningDamage ?? 3, 'lightning'); notify(T('weather.struck'), '#ff8a7a'); }
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
 *   dark       only spawns in dark places (caves, or anywhere at night), burns in the sun out on the surface
 *              (HOSTILE.sunBurn) and keeps to its cave in daylight, except while rain clouds hide the sun
 *              (a weather with `shade`, see Mobs.sunOut): then it comes out and doesn't burn
 *   breaks     seconds it takes to break a block by its `siege` class ('wood' walls / doors /
 *              planks, 'stone' walls, 'glass') when it's chasing you and that's the way through.
 *              Walls (kind 'wall') take SIEGE.wallMult times that. `natural` = seconds per point
 *              of hardness for natural terrain (stone, dirt, gravel, clay, ores, dunes, custom
 *              terrain): stone (hardness 1) takes `natural` seconds, dirt (0.1) a tenth of it.
 *   drops      [[itemId, min, max = min, chance = 1], ...]
 *   teamwork   'selfish' (the default): it fights on its own; its AI level (MOB_AI) decides how it looks after itself.
 *              'group': it fights alongside the others (see GROUP): it calls its group when it spots you, the
 *              fighters wait for each other and then surround you, archers keep their distance, and a hurt one
 *              falls back to heal while another enemy (any enemy) keeps you busy.
 *   roles      the gear it carries (see ARMED): { role:{ count | share, weapon:{ itemId: weight },
 *              armor:{ ARMOR_SETS id: weight }, pieces (chance per armor slot) } }. A structure's creatures get
 *              `count` of a role first (a chief), then `share` of them (archers); a role with neither fills the rest.
 *              Its armor soaks your hits like yours does; a bow makes it an archer. gearDrop = chance per piece
 *              that you get it when it dies (worn, see ARMED.gearWear).
 * Hostiles that spot you keep chasing: they remember you for HOSTILE.memory
 * seconds after they lose sight of you (walls block sight).
 */
const CREATURES = {};   // filled by the defineElements list below (type:'creature')
const SIEGE = {
    wallMult: 4,                                    // walls take this many times a creature's `breaks` time
    naturalKinds: ['stone', 'soil', 'ore', 'tree'], // block kinds that count as natural terrain (plus type:'terrain' blocks)
    minSeconds: 1,                                  // the softest natural block still takes this long
};
/** Natural terrain a creature can dig through (not ore hearts or anything unbreakable). */
const isNaturalBlock = def => !!def && !def.built && !def.station && def.hardness < 10 && (def.natural || SIEGE.naturalKinds.includes(def.kind));
/**
 * Seconds creature type `c` (a CREATURES entry) needs to break a fresh block `def`, or null when it can't.
 * Siege blocks use its `breaks[siege]` (walls x SIEGE.wallMult); natural terrain uses `breaks.natural` x hardness.
 */
function siegeSeconds(c, def){
    const br = c && c.breaks;
    if(!br || !def) return null;
    if(def.siege) return br[def.siege] == null ? null : br[def.siege] * (def.kind === 'wall' ? SIEGE.wallMult : 1);
    if(br.natural != null && isNaturalBlock(def)) return Math.max(SIEGE.minSeconds, br.natural * def.hardness);
    return null;
}
defineElements([
    { id:'zombie', type:'creature', hp:30, speed:2, size:15, mover:'zombie', behaviour:'hostile', teamwork:'selfish', sight:4, damage:5, cooldown:1.2, color:'#5d7a4c', dark:true, xp:30,
      ai:{ dumb:70, smart:25, genius:5 },
      breaks:{ wood:15, stone:60, glass:10, natural:30 }, drops:[ { id:'rotten_flesh', chance:1, amount:[0, 2] } ] },
    // rare, daytime only (HOSTILE.orcChance): slower than a zombie, hits much harder but slowly
    { id:'orc', type:'creature', hp:100, speed:1.25, size:19, mover:'zombie', behaviour:'hostile', teamwork:'group', sight:7, damage:22, cooldown:2.5, color:'#56733a', xp:120,
      ai:{ smart:20, genius:80 },
      breaks:{ wood:7, stone:35, glass:5, natural:18 },
      drops:[ { id:'tin_ingot', chance:0.5, amount:[3, 5] }, { id:'coal', amount:[1, 3] }, { id:'flint', chance:0.5, amount:[1, 2] } ] },
    // lives in forest camps (the goblin_camp structure: that's the only place goblins come from) and fights as a group,
    // in armor, with swords and bows (see roles, GROUP, ARMED). `damage` = a punch; a sword adds to it.
    { id:'goblin', type:'creature', hp:30, speed:2, size:13, mover:'zombie', behaviour:'hostile', teamwork:'group', sight:7, damage:5, cooldown:1.7,
      color:'#7fa53f', biomes:['forest'], xp:40,
      ai:{ smart:65, genius:35 },
      breaks:{ wood:18, glass:6 },   // they hack through wooden walls / doors, never stone or rock
      roles:{
          chief:   { count:1,    weapon:{ copper_sword:3, zinc_sword:4, tin_sword:2 }, armor:{ copper:3, zinc:4, tin:2 }, pieces:0.9 },
          archer:  { share:0.35, weapon:{ bow:6, crossbow:1 }, armor:{ cloth:6, tin:2 }, pieces:0.35 },
          warrior: {             weapon:{ wooden_sword:4, tin_sword:4, zinc_sword:2, copper_sword:1 }, armor:{ cloth:5, tin:3, zinc:1.5, copper:0.5 }, pieces:0.5 },
      },
      gearDrop:0.15,   // a small chance for each piece of its armor / its weapon
      drops:[ { id:'leather', amount:[1, 2] }, { choose: ingotsUpToTier(3), amount:[1, 4] } ] },
    // neutral: leaves you alone until you hit it, then fights back (and calms down once it loses track of you)
    { id:'bear', type:'creature', hp:60, speed:1.8, size:20, mover:'animal', behaviour:'neutral', sight:4, damage:14, cooldown:1.8, color:'#5a3e2b', biomes:['forest'], count:4, xp:60,
      drops:[ { id:'raw_bear_meat', amount:[2, 4] }, { id:'raw_leather', amount:[1, 2] } ] },
    { id:'deer', type:'creature', hp:24, speed:2.8, size:15, mover:'animal', behaviour:'passive', skittish:4, color:'#a8743f', biomes:['forest', 'plains'], count:8, xp:5,
      drops:[ { id:'raw_venison', amount:[2, 3] }, { id:'raw_leather', chance:0.8 } ] },
    { id:'rabbit', type:'creature', hp:6, speed:3, size:8, mover:'animal', behaviour:'passive', skittish:3, color:'#c9bfb2', biomes:['plains', 'desert', 'forest'], count:8, xp:3,
      drops:[ { id:'raw_rabbit' }, { id:'raw_leather', chance:0.35 } ] },
    { id:'cow', type:'creature', hp:30, speed:1.7, size:18, mover:'animal', behaviour:'passive', color:'#f2efe8', biomes:['plains'], count:6, xp:5,
      drops:[ { id:'raw_beef', amount:[2, 4] }, { id:'raw_leather', amount:[1, 2] } ],
      actions:{ milk:{ display:'Milk @', require:{ item:'bucket', empty:true }, result:{ item:'milk_bucket', count:1 }, cooldown:60 } } },
    // neutral like the bear: tusks for when you start a fight
    { id:'boar', type:'creature', hp:22, speed:2.1, size:14, mover:'animal', behaviour:'neutral', sight:4, damage:6, cooldown:1.4, color:'#6b4a33', biomes:['plains', 'forest'], count:6, xp:8,
      drops:[ { id:'raw_pork', amount:[2, 3] }, { id:'raw_leather', chance:0.6 } ] },
    // lays an egg where it stands every 4-8 minutes (a game day is 15), see Mobs.layTick
    { id:'chicken', type:'creature', hp:6, speed:2.1, size:8, mover:'animal', behaviour:'passive', color:'#f6f3ea', biomes:['plains'], count:7,
      lays:{ block:'egg', every:[240, 480], radius:3, max:4 },
      drops:[ { id:'raw_chicken', amount:[1, 2] } ] },
    { id:'bird', type:'creature', hp:4, speed:3.6, size:7, mover:'bird', behaviour:'passive', skittish:3, color:'#3f5a8a', biomes:['plains', 'forest', 'desert'], count:8,
      drops:[ { id:'raw_bird_meat' } ] },
]);
/**
 * Hostile spawning: caps, seconds between spawn tries, min / max cells from the player, light
 * level that counts as dark, sun damage. `memory` = seconds a hostile keeps chasing after it
 * loses sight of you, `giveUp` = it stops when you're further than this many cells.
 * Orcs: `orcChance` per spawn try in daylight (every spawnEvery s), at most `maxOrcs` at once.
 * Nothing hostile spawns near a torch (TORCH.safe cells) or a lit forge (3 cells).
 */
const HOSTILE = { maxNight: 10, maxCave: 5, spawnEvery: 4, minDist: 8, maxDist: 16, darkLight: 0.35, sunBurn: 4,
                  memory: 30, giveUp: 6, orcChance: 0.006, maxOrcs: 5,
                  regenDelay: 10,    // every enemy (hostile / neutral) heals after this many seconds without taking damage (hits or sunburn)...
                  regenRate: 0.05 }; // ...this share of their max hp per second (sunburn stops it too)
/**
 * Enemy AI levels (a creature's `ai`, rolled at spawn and kept in m.ai):
 *   dumb    chases while it remembers you, gives up when you're too far, a dark creature
 *           follows you into daylight and only heads home once it loses you.
 *   smart   puts its own life first: it tracks the damage per second it's taking (hits and
 *           sunburn) and backs off (a dark one hides in its cave) when that rate would kill it within
 *           a few seconds or two more of your hits would, sprinting away faster than you walk
 *           (escapeSpeed), until the damage has stopped and it has healed. In daylight a dark one
 *           only comes out of its cave after you when you're within `sunChase` cells, and gives up
 *           and runs back in as soon as you back away or get further than that. It also only stays
 *           out while it has the health to reach you, fight and walk back to a cave, heads for a cave
 *           before the sun comes out (dawn, or the end of the rain hiding it) and won't step out of
 *           one when the sun is close. It re-plans its path far more often (stuck / walls) and can
 *           hit you mid-step.
 *   genius  decides like a player would (see GENIUS): it sizes up every fight (your weapon, armor and
 *           health against its own, the enemies already on you), waits for an opening when you're the
 *           stronger one, heads you off instead of following you, never pulls out of a kill, gets out
 *           of a fight it's losing while it still can (behind another enemy, to its cave, or away), and
 *           only comes back once it has healed to FULL health. It minds the sun like a smart one.
 */
const MOB_AI = {
    levels: ['dumb', 'smart', 'genius'],
    dpsWindow: 3,        // smart+: seconds of damage the damage-per-second estimate averages over
    fleeWithin: 4,       // smart: backs off when its damage per second would kill it within this many seconds,
    fleeHits: 2,         // ...or when this many hits like your last one would kill it (it backs off with a hit to spare;
                         //    group creatures fall back at this too, see GROUP.retreatAt)...
    hurtWary: 7,         // smart: while it's hurt and backing off it keeps at least this many cells from you (more than its sight:
                         //    it doesn't wait for you to walk up to it)
    escapeSpeed: 1.3,    // smart+: while getting away from you it sprints at least this share of your walking speed,
                         //    so a creature that runs isn't simply caught and cut down (cornered, it still fights)
    calmWithin: 2.5,     // ...and comes back once the rate has dropped so dying would take this many times longer...
    recoverAt: 0.7,      // ...and it has healed back to this share of its hp (a genius: all of it, see GENIUS)
    sunChase: 3,         // dark smart+: in daylight it only leaves its cave after you when you're this many cells away or closer
    sunGiveUpFor: 5,     // ...and after giving up it won't come out again for this many seconds
    awaySpeed: 0.3,      // ...you "run away" when you move away from it faster than this share of its speed
    allyRange: 8,        // genius: cells it looks for friends in
    sunReserve: 0.25,    // dark smart+: hp share it keeps in hand when working out how long it can stay in the sun
    fightTime: 2,        // ...cooldowns' worth of time it plans to spend hitting you
    dawnMargin: 20,      // ...extra seconds it gives itself to get home before sunrise
    stayIn: 45,          // ...doesn't leave a cave (unless chasing) when sunrise is closer than this many seconds
    maxLead: 2.5,        // genius: seconds ahead of you it aims at most
    restep: 0.25,        // smart+: seconds before it looks for a way again when it's stuck (dumb: 1)
    recheckWall: 0.5,    // smart+: seconds between "is there a better way than this wall" checks (dumb: 2)
};
/**
 * Genius creatures make their choices the way a player would (Mobs.geniusThink; group ones keep GROUP's
 * tactics, see there). It sizes the fight up from what it can see (Mobs.readFight): the weapon in your hand,
 * your armor and health, its own health and armor, the enemies already on you. It takes `reaction` seconds
 * to notice a change and make up its mind, and keeps to a plan (m.plan) until something makes it change:
 *   fight    it comes at you (heading you off) when it has the upper hand, when it gets an opening (you're
 *            busy: mining, fishing, in a menu, fighting something else; you're below `weakAt` of your health;
 *            another enemy is within `busyRange` cells of you), when you come for it, when you hold a bow
 *            (standing off in your line of fire is worse than going in) or when its `patience` runs out. It
 *            hurries for an opening or a kill. Once in it stays in while it's healthy, and it never pulls out
 *            of a kill: when it would outlast you, or you're `finishHits` of its hits from dying.
 *   wait     you're the stronger one and there's no opening: it keeps `stalkDist` cells from you, just out of
 *            your reach, ready to pounce (for `patience` seconds at most, each creature its own).
 *   recover  it's losing and it's hurt (below `bailAt` of its health, or `bailHits` of your hits from dying),
 *            or it's that hurt when it finds you: it gets away while it still can (out of the sun first, then
 *            behind another enemy, to its cave within `caveRange` cells, or just away), never toward you.
 *            Once it's `safeDist` cells from you (and out of your bow's range or behind cover) it waits there,
 *            watching you, until it's back to FULL health (HOSTILE.regenDelay / regenRate); only then does it
 *            hunt you again, waiting for an opening first. While it gets away it sprints (MOB_AI.escapeSpeed).
 *            It hits back only when it's cornered next to you (`caughtHits` hits without letting up for
 *            `shakeOff` seconds with no way out, or simply no step away).
 */
const GENIUS = {
    reaction: [0.2, 0.4],
    bailAt: 0.6, bailHits: 2.5, finishHits: 2,
    patience: [5, 12], stalkDist: 3, weakAt: 0.5, busyRange: 2,
    safeDist: 5, caveRange: 12, caughtHits: 2, shakeOff: 2.5,
};
/**
 * Group tactics: creatures with teamwork:'group' (goblins, orcs; see Mobs.groupThink). They replace a creature's
 * own self-preservation (MOB_AI's backing off); its AI level still decides how well it finds its way.
 *   call      one that's after you tells every friend of its group within `callRange` cells where you are
 *   cover     at `retreatAt` of its hp (or MOB_AI.fleeHits of your hits from dying) it wants to heal. It only
 *             starts falling back (to `safeDist` cells away, toward its home, sprinting: MOB_AI.escapeSpeed) while
 *             ANOTHER enemy, of any kind, is fighting you: within `coverRange` cells of you, or shooting at you.
 *             Once it has fallen back it stays back even when the cover is gone, heals (HOSTILE.regenDelay /
 *             regenRate) up to `returnAt` and comes back. With nobody to cover it, it fights on. A genius (see
 *             GENIUS) comes back only at FULL health; it hits back only when you corner it, and it never falls
 *             back from a kill (you're GENIUS.finishHits of its hits from dying).
 *   muster    fighters don't come at you one by one: each waits `holdDist` cells away until `musterSize` of
 *             the group (itself included) are within `musterRange` cells of it or next to you, for at most
 *             `musterTime` seconds (or until you come within 2 cells)
 *   surround  then each one goes for its own side of you, as far as it can from where the others stand
 *   archers   keep ARMED.archerMin..their bow's range cells away with a clear shot, and back off when you close in
 *   home      when it isn't fighting it stays within `leash` cells of its home (its camp), and walks back there
 */
const GROUP = {
    callRange: 10, callEvery: 3,
    retreatAt: 0.4, returnAt: 0.8, coverRange: 2, safeDist: 6,
    musterSize: 3, musterRange: 3, musterTime: 6, holdDist: 4,
    leash: 3,
};
/**
 * Creatures that carry gear (a `roles` table, see CREATURES): goblins.
 *   melee damage = its `damage` + its sword's damage x weaponScale, every `cooldown` seconds
 *   archers (holding a bow / crossbow) shoot every bow cooldown x shotEvery seconds: arrowDamage x the bow's
 *   power, missing missChance of the time; they keep at least archerMin cells from you
 *   gear the player gets from one keeps gearWear [min, max] of its durability (it's been used)
 */
const ARMED = {
    weaponScale: 0.3,
    shotEvery: 1.8, arrow: 'flint_arrow', arrowDamage: 5, missChance: 0.2, archerMin: 3,
    gearWear: [0.3, 0.8],
};

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
        // creatures of the dark don't leave a cave into the sun, unless they're chasing the player out of it
        // (a smart one doesn't step out either when the sun is close; while rain hides the sun they come and go)
        if(m.def.dark && !m.chasing && Theaya.biome[cellIndex(m.x, m.y)] === 'cave' && Theaya.biome[cellIndex(x, y)] !== 'cave'
            && (this.sunOut() || (this.aiOf(m) !== 'dumb' && this.sunIn() < MOB_AI.stayIn))) return false;
        const o = this.occ.get(cellIndex(x, y));
        if(o && o !== m) return false;
        const pc = playerCell();
        return !(pc && pc.x === x && pc.y === y);
    },
    /** Is the sun burning creatures of the dark out on the surface right now? (daylight, and no rain clouds hiding it: Weather.shadesSun) */
    sunOut(){ return Clock.light() > 0.5 && !Weather.shadesSun(); },
    /** Real seconds until it does (0 while it does): the next sunrise, or the end of the rain hiding the sun when that comes later. */
    sunIn(){
        if(this.sunOut()) return 0;
        return Math.max(Clock.light() > 0.5 ? 0 : Clock.untilDay(), Weather.shadesSun() ? Weather.left() : 0);
    },
    /**
     * A new creature at cell (x, y). opts: home (the index of the structure it lives at, see Structures),
     * role (for a creature with `roles`: which gear it gets; otherwise a random one).
     */
    spawn(type, x, y, opts = {}){
        const def = CREATURES[type];
        if(!def) throw new Error(`Mobs.spawn: unknown creature '${type}'.`);
        const w = Theaya.zone.toWorld(x, y);
        const m = { id: this.nextId++, type, def, hp: def.hp, x, y, px: w.x, py: w.y, next: null,
                    wait: Math.random() * 2, cooldown: 0, fleeUntil: 0, aggroUntil: 0, facing: Math.random() * Math.PI * 2,
                    hitAt: -1e9, alive: true, bob: Math.random() * 10, ai: this.rollAi(def), home: opts.home ?? null };
        if(def.roles){ m.role = opts.role && def.roles[opts.role] ? opts.role : this.randomRole(def); m.gear = this.rollGear(def, m.role); }
        this.list.push(m);
        this.occ.set(cellIndex(x, y), m);
        return m;
    },

    /* ----- gear (creatures with `roles`, see ARMED) ----- */
    /** A role for a creature spawned on its own: by the roles' `share` (the rest-role gets what's left; `count` roles never). */
    randomRole(def){
        const ids = Object.keys(def.roles), rest = ids.find(id => def.roles[id].count == null && def.roles[id].share == null);
        let r = Math.random();
        for(const id of ids){ const sh = def.roles[id].share; if(sh != null){ if(r < sh) return id; r -= sh; } }
        return rest ?? ids[ids.length - 1];
    },
    /** The role the next creature of a group of `want` gets, given who's there: `count` roles first, then `share` ones, then the rest. */
    nextRole(def, members = [], want = 0){
        if(!def.roles) return null;
        const ids = Object.keys(def.roles), total = Math.max(want, members.length + 1);
        const have = id => members.filter(m => m.role === id).length;
        for(const id of ids){
            const r = def.roles[id], target = r.count != null ? r.count : r.share != null ? Math.round(r.share * total) : null;
            if(target != null && have(id) < target) return id;
        }
        return ids.find(id => def.roles[id].count == null && def.roles[id].share == null) ?? ids[ids.length - 1];
    },
    /** Its weapon (from the role's weights) and armor (one set, each piece with `pieces` chance). */
    rollGear(def, role){
        const r = (def.roles && def.roles[role]) || {}, gear = { weapon: null };
        for(const s of ARMOR_SLOTS) gear[s] = null;
        const pick = table => {
            const opts = Object.entries(table).filter(([, w]) => w > 0);
            let x = Math.random() * opts.reduce((t, [, w]) => t + w, 0);
            for(const [id, w] of opts){ x -= w; if(x <= 0) return id; }
            return opts.length ? opts[opts.length - 1][0] : null;
        };
        const weapon = pick(Object.fromEntries(Object.entries(r.weapon || {}).filter(([id]) => Items.has(id))));
        if(weapon) gear.weapon = Items.create(weapon);
        const set = pick(Object.fromEntries(Object.entries(r.armor || {}).filter(([id]) => ARMOR_SETS[id])));
        if(set) ARMOR_PIECES.forEach((p, k) => { if(Math.random() < (r.pieces ?? 0.5)) gear[p.slot] = Items.create(ARMOR_SETS[set].pieces[k]); });
        return gear;
    },
    /** The armor it wears, added up (it soaks hits like the player's: see hurt). */
    defenseOf(m){
        let d = 0;
        if(m.gear) for(const s of ARMOR_SLOTS){ const it = m.gear[s]; if(it && it.getDefense) d += it.getDefense(); }
        return d;
    },
    /** weaponInfo() of what it holds, or null. */
    weaponOf(m){ const it = m.gear && m.gear.weapon; return it ? weaponInfo(it) : null; },
    isRanged(m){ const w = this.weaponOf(m); return !!w && w.kind === 'ranged'; },
    /** Its hit next to you: { damage, cooldown } (a sword adds to its punch, see ARMED). */
    meleeOf(m){
        const w = this.weaponOf(m), sword = w && w.kind === 'melee' && w.item ? w.damage * ARMED.weaponScale : 0;
        return { damage: m.def.damage + sword, cooldown: m.def.cooldown };
    },
    /** An archer's shot at the player (it's in range with a clear line). */
    shoot(m, w){
        const p = player.transform.position, hit = Math.random() >= ARMED.missChance, a = Math.random() * Math.PI * 2;
        this.face(m);
        m.cooldown = w.cooldown * ARMED.shotEvery;
        this.fx.push({ kind:'arrow', x0: m.px, y0: m.py, x1: p.x + (hit ? 0 : Math.cos(a) * 28), y1: p.y + (hit ? 0 : Math.sin(a) * 28),
                       t0: performance.now(), dur: 180, color:'#4a4a55', item: Items.has(ARMED.arrow) ? ARMED.arrow : null });
        if(!hit) return;
        const dmg = damagePlayer(ARMED.arrowDamage * (w.power || 1), m.def.name);
        notify(T('combat.shotYou', { creature: m.def.name.toLowerCase(), dmg: dmg.toFixed(1) }), '#ff8a7a');
    },
    face(m){ const p = player.transform.position; m.facing = Math.atan2(p.y - m.py, p.x - m.px); },
    remove(m){
        m.alive = false;
        this.list = this.list.filter(o => o !== m);
        for(const [k, o] of this.occ) if(o === m) this.occ.delete(k);
    },
    /** Damage a creature (from the player). Animals run, hostiles get angry. Kills give the drops. Worn armor soaks part of it. */
    hurt(m, dmg){
        if(!m.alive) return;
        const armor = this.defenseOf(m);
        if(armor > 0) dmg *= ARMOR_SCALE / (ARMOR_SCALE + armor);   // the same rule as the player's armor (damagePlayer)
        m.hp -= dmg;
        m.lastHitDmg = dmg;                                               // how hard you hit (smart+: MOB_AI.fleeHits)
        m.hitAt = performance.now();
        this.noteDamage(m, dmg);                                           // smart+: damage per second
        m.lastHurt = this.now;                                            // healing waits HOSTILE.regenDelay from here
        // a genius getting away: hits that keep coming mean you've caught it (GENIUS.caughtHits / shakeOff)
        if(m.retreatHeal) m.chasedHits = (this.now - (m.youHitAt ?? -1e9) <= GENIUS.shakeOff ? (m.chasedHits || 0) : 0) + 1;
        m.youHitAt = this.now;
        this.fx.push({ kind:'number', x: m.px, y: m.py - m.def.size, text: Math.round(dmg), t0: performance.now(), dur: 700 });
        if(m.def.behaviour === 'neutral') m.provoked = true;   // neutral creatures fight back once hurt
        if(m.def.behaviour === 'passive') m.fleeUntil = this.now + 6;
        else { m.aggroUntil = this.now + 12; m.seenAt = this.now; }   // hurt: it knows where you are
        if(m.hp <= 0) this.kill(m);
    },
    kill(m, byPlayer = true){
        this.remove(m);
        this.fx.push({ kind:'poof', x: m.px, y: m.py, t0: performance.now(), dur: 400, color: m.def.color });
        if(!byPlayer) return;
        const drops = rollDrops({ drops: m.def.drops }).filter(([, n]) => n > 0);
        for(const d of drops) if(skillChance('skinner', 0.15)) d[1]++;   // Skinner: more from every drop
        const kept = drops.map(([id, n]) => [id, n - giveItems(id, n)]);
        // its gear: a small chance for each piece, worn from use (see ARMED.gearWear)
        for(const it of Object.values(m.gear || {})){
            if(!it || Math.random() >= Difficulty.luck(m.def.gearDrop ?? 0)) continue;
            const dur = it.get('durability'), [lo, hi] = ARMED.gearWear;
            if(dur) dur.value = Math.max(1, Math.round(dur.max * (lo + Math.random() * (hi - lo))));
            if(player.inventory.give(it) === 0) kept.push([it.id, 1]);
        }
        notify(T('combat.defeated', { name: m.def.name }) + (kept.length ? T('combat.defeatedDrops', { items: dropsText(kept) }) : ''), '#a6f0a0');
        const animal = m.def.behaviour === 'passive' || m.def.behaviour === 'neutral';   // bears / boars count as hunting
        gainXp(m.def.xp ?? (m.def.behaviour === 'passive' ? XP.passive : XP.hostile), animal ? 'hunting' : 'slain');
    },
    /** Hostiles near a cell forget the player (respawn). */
    calmNear(cell, r){
        for(const m of [...this.list]){
            if(!this.isHostile(m) || hexDist(m, cell) > r) continue;
            if(m.def.behaviour === 'neutral'){ m.provoked = false; m.seenAt = -1e9; }   // an angry bear / boar just calms down
            else this.remove(m);
        }
    },

    /* ----- AI levels (see MOB_AI) ----- */
    /** Rolls a new creature's AI level from its def's `ai` (a level, or odds per level; odds are shifted by the difficulty: Difficulty.shiftAi). */
    rollAi(def){
        const a = def.ai;
        if(!a) return 'dumb';
        if(typeof a === 'string') return a;
        const opts = Object.entries(Difficulty.shiftAi(a, MOB_AI.levels)).filter(([k, w]) => MOB_AI.levels.includes(k) && w > 0);
        let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0);
        for(const [k, w] of opts){ r -= w; if(r <= 0) return k; }
        return opts.length ? opts[opts.length - 1][0] : 'dumb';
    },
    aiOf(m){ return MOB_AI.levels.includes(m.ai) ? m.ai : 'dumb'; },
    /** Damage taken lately, fading out over MOB_AI.dpsWindow seconds. */
    recentDamage(m){ return (m.recentDmg || 0) * Math.exp(-(this.now - (m.recentAt ?? -1e9)) / MOB_AI.dpsWindow); },
    /** Adds damage (hits or sunburn) to the creature's damage-per-second estimate. */
    noteDamage(m, dmg){ m.recentDmg = this.recentDamage(m) + dmg; m.recentAt = this.now; },
    /** Damage per second it's taking (a fading average: a steady rate r settles at r). */
    dps(m){ return this.recentDamage(m) / MOB_AI.dpsWindow; },
    /** Seconds until it dies at the damage rate it's taking now (Infinity when it isn't taking any). */
    timeToDie(m){ const r = this.dps(m); return r > 1e-3 ? Math.max(0, m.hp) / r : Infinity; },
    /** Smart+: was it hit lately, hard enough that MOB_AI.fleeHits more hits like that would kill it? */
    hitsFromDeath(m){
        return this.now - (m.youHitAt ?? -1e9) <= MOB_AI.dpsWindow * 2 && m.lastHitDmg > 0 && m.hp <= m.lastHitDmg * MOB_AI.fleeHits;
    },
    /** Is the player moving away from this creature (faster than MOB_AI.awaySpeed of its own speed)? */
    playerLeaving(m){
        const v = this.playerVel, p = player.transform.position;
        if(!v) return false;
        const dx = p.x - m.px, dy = p.y - m.py, dist = Math.hypot(dx, dy);
        if(dist < 1) return false;
        return (v.x * dx + v.y * dy) / dist > MOB_AI.awaySpeed * m.def.speed * HEX_W;
    },
    /**
     * Walking distance (cells) from every cell to the nearest cave cell for a mover, Infinity where
     * no cave can be reached. Rebuilt every few seconds (walls get built / broken).
     */
    caveField(mover){
        const f = (this._caveFields ||= {}), c = f[mover];
        if(c && this.now - c.at < 5) return c.dist;
        const N = MAP_COLS * MAP_ROWS, dist = new Float32Array(N).fill(Infinity), queue = [];
        const ok = i => { const { x, y } = cellXY(i); return mover === 'bird' || isPassable(x, y, mover); };
        for(let i = 0; i < N; i++) if(Theaya.biome[i] === 'cave' && ok(i)){ dist[i] = 0; queue.push(i); }
        for(let q = 0; q < queue.length; q++){
            const i = queue[q];
            for(const j of neighborIdx(i)) if(dist[j] === Infinity && ok(j)){ dist[j] = dist[i] + 1; queue.push(j); }
        }
        f[mover] = { at: this.now, dist };
        return dist;
    },
    caveDist(m, c = m){ return this.caveField(m.def.mover)[cellIndex(c.x, c.y)]; },
    /**
     * One step down the cave field (toward the closest cave). True when it moved or is waiting for the way to clear.
     * With `away` (a cell, the player's): only steps that don't lead toward it, false when there's none.
     */
    goHome(m, away = null){
        const field = this.caveField(m.def.mover), here = field[cellIndex(m.x, m.y)];
        if(!(here > 0) || here === Infinity) return false;
        let best = null, bd = here;
        for(const n of Theaya.zone.neighbors(m.x, m.y)){
            const v = field[cellIndex(n.x, n.y)];
            if(v < bd && this.canEnter(m, n.x, n.y) && !(away && this.awayness(m, away, n) < 0)){ bd = v; best = n; }
        }
        if(away && !best) return false;   // the way home runs past the player: run away from them instead
        m.running = true;
        if(best){ this.commit(m, best.x, best.y); return true; }
        m.wait = 0.3;   // someone's in the way: wait for them rather than wander off
        return true;
    },
    /**
     * How well stepping from the creature's cell into cell n leads directly away from `from` (the player):
     * 1 = straight away, 0 = sideways, -1 = straight at them. Uses the player's exact position when
     * `from` is the player's cell.
     */
    awayness(m, from, n){
        const z = Theaya.zone, a = z.toWorld(m.x, m.y), b = z.toWorld(n.x, n.y), pc = playerCell();
        const f = pc && pc.x === from.x && pc.y === from.y ? player.transform.position : z.toWorld(from.x, from.y);
        let ax = a.x - f.x, ay = a.y - f.y;
        const al = Math.hypot(ax, ay), sx = b.x - a.x, sy = b.y - a.y, sl = Math.hypot(sx, sy);
        if(sl < 1e-6) return 0;
        if(al < 1e-6) return 1;   // right on top of each other: any way is away
        return (ax * sx + ay * sy) / (al * sl);
    },
    /** Hit the player (it's next to them). */
    attackPlayer(m){
        m.facing = Math.atan2(player.transform.position.y - m.py, player.transform.position.x - m.px);
        if(m.cooldown > 0) return;
        const hit = this.meleeOf(m);
        const dmg = damagePlayer(hit.damage, m.def.name);
        m.cooldown = hit.cooldown;
        this.fx.push({ kind:'swing', x: player.transform.position.x, y: player.transform.position.y, t0: performance.now(), dur: 200, color:'#ff6a5a' });
        notify(T('combat.hitsYou', { creature: m.def.name.toLowerCase(), dmg: dmg.toFixed(1) }), '#ff8a7a');
    },
    /**
     * Genius, getting away: falling back to its friends. A free cell next to another enemy (within MOB_AI.allyRange,
     * on its side of you: nearer to it than to you, and not right next to you; not getting away too), out of your
     * reach (GENIUS.stalkDist cells from you), on its far side from you when it can be, or null.
     */
    shelterFor(m, pc){
        let ally = null, bs = Infinity;
        for(const o of this.list){
            if(o === m || !o.alive || !this.isHostile(o) || o.lowHp || o.retreatHeal) continue;
            const od = hexDist(o, pc), md = hexDist(m, o);
            if(od < 2 || md >= od || md > MOB_AI.allyRange) continue;   // not one in the thick of it, nor one past you
            const s = md - 0.5 * od;
            if(s < bs){ bs = s; ally = o; }
        }
        if(!ally) return null;
        let best = null, bScore = Infinity;
        for(const n of Theaya.zone.neighbors(ally.x, ally.y)){
            if(hexDist(n, pc) < GENIUS.stalkDist || (!(n.x === m.x && n.y === m.y) && !this.canEnter(m, n.x, n.y))) continue;
            const s = hexDist(m, n) + (hexDist(n, pc) > hexDist(ally, pc) ? 0 : 3);   // behind its friend when it can be
            if(s < bScore){ bScore = s; best = n; }
        }
        return best;
    },
    /** Genius: the cell the player is heading for (where to cut them off), or the player's cell. */
    interceptCell(m, pc, d){
        const v = this.playerVel;
        if(d <= 2 || !v || Math.hypot(v.x, v.y) < 8) return pc;
        const lead = Math.min(MOB_AI.maxLead, d / Math.max(0.1, m.def.speed) * 0.7), p = player.transform.position;
        for(const f of [1, 0.66, 0.33]){
            const c = Theaya.zone.toCell(p.x + v.x * lead * f, p.y + v.y * lead * f);
            if(c && Theaya.zone.inBounds(c.x, c.y) && this.passable(m, c.x, c.y) && hexDist(c, pc) >= 1 && hexDist(c, m) >= 2) return c;
        }
        return pc;
    },
    /**
     * Smart: looking after itself comes before the chase. May clear m.chasing. True when it used its turn.
     *   - taking damage fast enough to die within MOB_AI.fleeWithin seconds: back off (to its cave when it has
     *     one) until the damage has stopped and it has healed back to MOB_AI.recoverAt
     *   - a creature of the dark minds the sun (sunPlan)
     */
    selfPreserve(m, pc, d){
        const max = m.def.hp, ttd = this.timeToDie(m), fleeAt = MOB_AI.fleeWithin;
        if(ttd < fleeAt || this.hitsFromDeath(m)) m.lowHp = true;
        else if(m.lowHp && ttd >= fleeAt * MOB_AI.calmWithin && m.hp >= max * MOB_AI.recoverAt) m.lowHp = false;
        if(m.lowHp){
            // hurt: get away from the player. While they're close it never steps toward them; its cave
            // only wins when the way there also leads away
            m.chasing = false;
            m.escaping = true;   // sprints (MOB_AI.escapeSpeed)
            const near = d <= Math.max(m.def.sight, MOB_AI.hurtWary);
            if(m.def.dark && this.goHome(m, near ? pc : null)) return true;   // its cave is the safest place
            if(near){
                const s = this.getAway(m, pc);   // straight away from the player: they're north, it runs south (or around what's in the way)
                if(s){ m.running = true; this.commit(m, s.x, s.y); return true; }
                if(d <= 1){ this.attackPlayer(m); return true; }   // cornered: fight
            }
            return false;
        }
        return this.sunPlan(m, pc, d);
    },
    /**
     * Smart / genius creatures of the dark plan around the sun (sunOut: daylight that no rain clouds hide).
     * May clear m.chasing. True when it used its turn.
     *   - in the sun it only leaves its cave for a player within MOB_AI.sunChase cells, and gives up and
     *     runs home when the player backs off or gets further than that
     *   - it works out whether it can reach you, fight and get back to a cave before the sun burns it down,
     *     and heads home when it can't or when the sun is coming (sunrise, or the end of the rain: sunIn)
     */
    sunPlan(m, pc, d){
        if(!m.def.dark) return false;
        const max = m.def.hp, sunny = this.sunOut(), inCave = Theaya.biome[cellIndex(m.x, m.y)] === 'cave';
        // in the sun, player out on the surface: only step out for someone right by the cave, and give up
        // (and hurry back in) the moment they back off or get away
        if(sunny && m.chasing && Theaya.biome[cellIndex(pc.x, pc.y)] !== 'cave'){
            const sulking = this.now < (m.sunGiveUpUntil || 0);
            if(inCave){
                if(sulking || d > MOB_AI.sunChase){
                    m.chasing = false;   // canEnter keeps it inside now
                    if(d <= 1){ this.attackPlayer(m); return true; }   // still hits you at the cave mouth
                }
            } else if(sulking || d > MOB_AI.sunChase || (d > 1 && this.playerLeaving(m))){
                if(!sulking) m.sunGiveUpUntil = this.now + MOB_AI.sunGiveUpFor;
                m.chasing = false; m.retreating = true;
                if(this.goHome(m)) return true;
            }
        }
        const back = this.caveDist(m);
        if(back === Infinity) return false;   // no cave it can reach: nothing to plan around
        const sp = Math.max(0.1, m.def.speed), sunIn = this.sunIn();
        const budget = sunIn + Math.max(0, m.hp - max * MOB_AI.sunReserve) / HOSTILE.sunBurn;   // seconds it can afford away from shade
        if(m.chasing){
            let home = this.caveDist(m, pc);
            if(home === Infinity) home = back + d;
            const need = Math.max(0, d - 1) / sp + m.def.cooldown * MOB_AI.fightTime + home / sp;
            if(need > budget * (m.retreating ? 0.8 : 1)){ m.retreating = true; m.chasing = false; }   // too far to catch and still get home
            else m.retreating = false;
        }
        if(!m.chasing && back > 0 && (sunIn <= 0 || m.retreating || back / sp * 1.5 + MOB_AI.dawnMargin >= sunIn)) return this.goHome(m);
        return false;
    },

    /* ----- genius: it decides like a player would (see GENIUS) ----- */
    /** What a creature's attacks do to you: { hit, rate }: one hit after your armor, and the damage per second. */
    hitsOnPlayer(o){
        const cut = ARMOR_SCALE / (ARMOR_SCALE + playerDefense()), w = this.weaponOf(o);
        if(w && w.kind === 'ranged'){
            const hit = ARMED.arrowDamage * (w.power || 1) * cut;
            return { hit, rate: hit * (1 - ARMED.missChance) / Math.max(0.1, w.cooldown * ARMED.shotEvery) };
        }
        const h = this.meleeOf(o), hit = h.damage * cut;
        return { hit, rate: hit / Math.max(0.1, h.cooldown) };
    },
    /** Is this creature fighting you right now? (after you and within `range` cells of you, or an archer with a shot at you) */
    onPlayer(o, pc, range){
        if(!o.alive || !o.chasing || o.retreatHeal || !this.isHostile(o)) return false;
        const d = hexDist(o, pc);
        if(d <= range) return true;
        const w = this.weaponOf(o);
        return !!w && w.kind === 'ranged' && d <= w.range && hasLineOfSight(o, pc);
    },
    /**
     * Genius: the fight as a player would size it up, from what it can see: the weapon in your hand, your armor
     * and health, its own health and armor, and the enemies already on you.
     *   mine      seconds it would last against you (your weapon; the damage it's taking now when that's more)
     *   theirs    seconds you would last against it and every enemy fighting you
     *   hitsLeft  how many more of your hits it can take
     *   winning   it would outlast you;  finish: you're GENIUS.finishHits of its hits from dying
     *   opening   'busy' | 'hurt' | 'others' (see GENIUS) or null;  ranged: you're holding a bow / crossbow
     */
    readFight(m, pc){
        const w = weaponInfo(heldItem()), ranged = w.kind === 'ranged', arrow = ranged ? bestArrow() : null;
        const raw = ranged ? (arrow ? arrow.get('ammoStats').damage * w.power : 0) : w.damage;   // a bow with no arrows can't hurt it
        const yourHit = raw * (1 + 0.08 * skillLevel('brawler')) * ARMOR_SCALE / (ARMOR_SCALE + this.defenseOf(m));
        const yourRate = Math.max(this.dps(m), yourHit / Math.max(0.1, w.cooldown));
        const others = this.list.filter(o => o !== m && this.onPlayer(o, pc, GENIUS.busyRange));
        const me = this.hitsOnPlayer(m), rate = others.reduce((s, o) => s + this.hitsOnPlayer(o).rate, me.rate);
        const mine = yourRate > 1e-3 ? m.hp / yourRate : Infinity, theirs = Math.max(0, player.health) / Math.max(1e-3, rate);
        const busy = !!(Act.job || Fishing.line || GameUI.station || GameUI.inventoryOpen || (Act.combat && Act.combat.mob !== m));
        return {
            mine, theirs, winning: theirs < mine, finish: player.health <= me.hit * GENIUS.finishHits,
            hitsLeft: yourHit > 1e-3 ? m.hp / yourHit : Infinity, ranged,
            opening: busy ? 'busy' : player.health <= player.maxHealth * GENIUS.weakAt ? 'hurt' : others.length ? 'others' : null,
        };
    },
    /**
     * A genius's turn (selfish ones; a group one fights by groupThink): it sizes up the fight (readFight) and keeps to
     * a plan, m.plan (see GENIUS): 'fight', 'wait' for an opening, or 'recover' (get away and heal to full). It makes
     * up its mind again every GENIUS.reaction seconds. True when it used its turn; false leaves it to the usual chase
     * (it's fighting you) or to its idling (it isn't after you).
     */
    geniusThink(m, pc, d){
        if(this.now >= (m.decideAt ?? -1e9)){
            this.geniusDecide(m, pc, d);
            const [a, b] = GENIUS.reaction;
            m.decideAt = this.now + a + Math.random() * (b - a);
        }
        m.retreatHeal = m.plan === 'recover';   // (getting away: it isn't fighting you, and nobody hides behind it)
        if(m.retreatHeal) return this.geniusRecover(m, pc, d);
        if(this.sunPlan(m, pc, d)) return true;   // a creature of the dark minds the sun first
        if(!m.chasing) return false;
        if(!m.plan){ this.face(m); return true; }   // it has only just found you: a moment to make up its mind
        if(m.plan === 'wait'){
            m.chasing = false;   // waiting isn't fighting: no hits in passing, and it doesn't count as keeping you busy
            this.holdAt(m, pc, d, GENIUS.stalkDist);
            return true;
        }
        if(m.rush) m.running = true;   // an opening, or a kill: it hurries
        return false;
    },
    /** Genius: makes up its mind (see GENIUS). */
    geniusDecide(m, pc, d){
        const G = GENIUS, max = m.def.hp;
        if(m.plan === 'recover'){
            if(m.hp < max) return;                // it heals all the way before anything else
            m.plan = null; m.waitUntil = null;    // full health again: it can hunt you once more (an opening first)
        }
        if(!m.chasing){ m.plan = null; m.waitUntil = null; return; }   // it isn't after you
        const r = this.readFight(m, pc), keep = r.winning || r.finish;
        if(!keep && m.hp < max && (m.hp <= max * G.bailAt || r.hitsLeft <= G.bailHits)){
            m.plan = 'recover'; m.chasedHits = 0; m.rush = false;   // losing, and hurt: it gets out while it still can
            return;
        }
        if(m.plan !== 'fight'){
            const comingForIt = d <= 1 || !!(Act.combat && Act.combat.mob === m);
            if(!(keep || r.opening || r.ranged || comingForIt)){
                if(m.waitUntil == null){ const [a, b] = G.patience; m.waitUntil = this.now + a + Math.random() * (b - a); }
                if(this.now < m.waitUntil){ m.plan = 'wait'; return; }   // you're the stronger one: it waits for its moment
            }
            m.plan = 'fight';   // once it's in, it stays in (until it's losing and hurt)
        }
        m.rush = keep || !!r.opening;
    },
    /**
     * Genius, recovering (see GENIUS): it gets away from you to safety, then keeps out of your reach, watching you,
     * until it's back to full health. True when it used its turn (false: you're well away, it just idles).
     */
    geniusRecover(m, pc, d){
        const G = GENIUS, w = weaponInfo(heldItem()), ranged = w.kind === 'ranged';
        m.chasing = false;
        m.escaping = true;   // sprints (MOB_AI.escapeSpeed)
        if(m.def.dark && this.sunOut() && Theaya.biome[cellIndex(m.x, m.y)] !== 'cave' && this.goHome(m)) return true;   // out of the sun first: it can't heal while it burns
        const far = ranged ? Math.max(G.safeDist, w.range + 1) : G.safeDist;   // out of reach of what you hold
        if(d >= far || (ranged && d >= 3 && !hasLineOfSight(m, pc))){         // (or behind cover from your arrows)
            if(d > Math.max(far, m.def.sight) + 2) return false;   // you're well away: it waits it out
            this.face(m);                                           // safe: it gets its health back, watching you
            return true;
        }
        // you won't let it go (you're next to it and keep hitting it) and it has no way to run: it fights back
        // (with a way out it keeps running: it's faster than you while it gets away, MOB_AI.escapeSpeed)
        if(d <= 1 && (m.chasedHits || 0) >= G.caughtHits && this.now - (m.youHitAt ?? -1e9) <= G.shakeOff && !this.getAway(m, pc)){ this.attackPlayer(m); return true; }
        const near = d <= m.def.sight + 1, run = s => { m.running = true; this.commit(m, s.x, s.y); return true; };
        // back to its friends (behind one when it can), else its cave, else just away; never a step toward you
        const sh = this.shelterFor(m, pc);
        if(sh){
            if(sh.x !== m.x || sh.y !== m.y){
                const s = this.stepToward(m, sh, 0);
                if(s && !(near && this.awayness(m, pc, s) < 0)) return run(s);
            } else if(d >= 3){ this.face(m); return true; }   // with its friends and out of your reach: it rests there
        }
        if(m.def.dark && this.caveDist(m) <= G.caveRange && this.goHome(m, pc)) return true;
        const s = this.getAway(m, pc);
        if(s) return run(s);
        if(d <= 1){ this.attackPlayer(m); return true; }   // cornered: it fights back
        this.face(m);
        return true;
    },

    /* ----- group tactics (teamwork:'group', see GROUP) ----- */
    /** Where it lives (its structure's center), or null. */
    homeOf(m){ const s = Structures.at(m.home); return s ? { x: s.x, y: s.y } : null; },
    /** The rest of its group: the creatures of its home, or (without one) the same kind of group creature close by. */
    groupOf(m){
        if(m.home != null) return this.list.filter(o => o !== m && o.alive && o.home === m.home);
        return this.list.filter(o => o !== m && o.alive && o.type === m.type && o.def.teamwork === 'group' && hexDist(o, m) <= GROUP.callRange);
    },
    /** Another enemy (any kind) fighting the player right now: next to them (GROUP.coverRange) or shooting at them. Or null. */
    coverFor(m, pc){ return this.list.find(o => o !== m && this.onPlayer(o, pc, GROUP.coverRange)) ?? null; },
    /** A step that falls back from the player: never toward them, toward home when that's also away. Null when cornered. */
    retreatStep(m, pc){
        const home = this.homeOf(m);
        let best = null, bs = -Infinity;
        for(const n of Theaya.zone.neighbors(m.x, m.y)){
            if(!this.canEnter(m, n.x, n.y)) continue;
            const away = this.awayness(m, pc, n);
            if(away < -0.01) continue;
            const s = away + (home ? 0.6 * (hexDist(m, home) - hexDist(n, home)) : 0) + Math.random() * 0.05;
            if(s > bs){ bs = s; best = n; }
        }
        return best;
    },
    /** Its own side of the player: a free cell next to them, as far as it can be from where the others stand / are going. Null when none. */
    surroundSlot(m, pc){
        const taken = [];
        for(const o of this.list){
            if(o === m || !o.alive || !o.chasing || !this.isHostile(o)) continue;
            if(hexDist(o, pc) <= 1) taken.push({ x: o.x, y: o.y });
            else if(o.slot >= 0) taken.push(cellXY(o.slot));
        }
        let best = null, bs = Infinity;
        for(const n of Theaya.zone.neighbors(pc.x, pc.y)){
            const i = cellIndex(n.x, n.y), o = this.occ.get(i);
            if(!this.passable(m, n.x, n.y) || (o && o !== m) || taken.some(t => t.x === n.x && t.y === n.y)) continue;
            const spread = taken.length ? Math.min(...taken.map(t => hexDist(t, n))) : 2;
            const s = hexDist(m, n) - 2.5 * spread - (i === m.slot ? 0.75 : 0);   // spread out wins over a short walk; a little loyal to the side it picked
            if(s < bs){ bs = s; best = n; }
        }
        m.slot = best ? cellIndex(best.x, best.y) : -1;
        return best;
    },
    /** Wait about `dist` cells from the player, facing them (mustering). */
    holdAt(m, pc, d, dist){
        if(d < dist){ const s = this.stepAway(m, pc); if(s){ this.commit(m, s.x, s.y); return; } }
        else if(d > dist + 1 && this.now >= (m.stuckUntil || 0)){
            const s = this.chase(m, pc);
            if(s && !s.breakIt){ this.commit(m, s.x, s.y); return; }
            m.stuckUntil = this.now + 0.5;
        }
        this.face(m);
    },
    /** An archer: keeps its distance (ARMED.archerMin .. its range) with a clear shot, and shoots. */
    archerThink(m, pc, d, w){
        const clear = d >= 2 && d <= w.range && hasLineOfSight(m, pc);
        if(clear && m.cooldown <= 0){ this.shoot(m, w); return true; }
        if(d < ARMED.archerMin){   // too close: back off to shooting distance
            const s = this.stepAway(m, pc);
            if(s){ m.running = true; this.commit(m, s.x, s.y); return true; }
            if(d <= 1){ this.attackPlayer(m); return true; }   // cornered: it swings its bow at you
        }
        if(clear){ this.face(m); return true; }   // reloading
        if(this.now < (m.stuckUntil || 0)) return true;
        const s = this.chase(m, pc);   // no shot from here: closer, or around what's in the way
        if(s && !s.breakIt){ this.commit(m, s.x, s.y); return true; }
        m.stuckUntil = this.now + MOB_AI.restep * 2;
        return true;
    },
    /**
     * A group creature's turn while it's after the player (see GROUP). True when it used its turn; false
     * leaves it to the usual chase (when it has no clean way to its side of you, or has to break through).
     */
    groupThink(m, pc, d, genius){
        const G = GROUP, now = this.now;
        if(!m.chasing){ m.engaged = false; m.musterSince = null; m.retreatHeal = false; m.slot = -1; return false; }
        // call the group: the ones close enough join in (they know what it knows)
        if(now - (m.calledAt ?? -1e9) >= G.callEvery){
            m.calledAt = now;
            for(const o of this.groupOf(m)) if(this.isHostile(o) && hexDist(o, m) <= G.callRange) o.seenAt = Math.max(o.seenAt ?? -1e9, m.seenAt ?? -1e9);
        }
        // hurt: fall back and heal while another enemy keeps the player busy (with nobody to cover it, it fights on).
        // A genius heals to FULL before it comes back, keeps falling back once it has started (the cover may go),
        // fights back only when you catch it, and never leaves a kill.
        const share = m.hp / m.def.hp;
        if(share <= G.retreatAt || this.hitsFromDeath(m)) m.wantsHeal = true;   // (or a couple of your hits from dying, MOB_AI.fleeHits)
        else if(share >= (genius ? 1 : G.returnAt)){ m.wantsHeal = false; m.fellBack = false; }
        const kill = genius && player.health <= this.hitsOnPlayer(m).hit * GENIUS.finishHits;
        // (once it has started falling back it keeps going even when the cover is gone: chasing it away from its
        // friends mustn't turn it around into your sword)
        if(m.wantsHeal && !kill && (this.coverFor(m, pc) || m.fellBack)){
            if(!m.retreatHeal) m.chasedHits = 0;
            m.retreatHeal = true; m.slot = -1; m.engaged = false; m.musterSince = null;
            m.fellBack = true;
            if(genius){
                // you won't let it go (you're next to it and keep hitting it) and it has no way back: it fights back
                if(d <= 1 && (m.chasedHits || 0) >= GENIUS.caughtHits && now - (m.youHitAt ?? -1e9) <= GENIUS.shakeOff && !(this.retreatStep(m, pc) ?? this.escapeStep(m, pc))){ this.attackPlayer(m); return true; }
            }
            if(d < G.safeDist){
                const s = this.retreatStep(m, pc) ?? this.escapeStep(m, pc);   // (blocked: around what's in the way)
                if(s){ m.running = true; m.escaping = true; this.commit(m, s.x, s.y); return true; }
                if(d <= 1){ this.attackPlayer(m); return true; }   // cornered
            }
            this.face(m);   // out of reach: it gets its breath back (and its health, see HOSTILE.regenDelay) and watches
            return true;
        }
        m.retreatHeal = false;
        const w = this.weaponOf(m);
        if(w && w.kind === 'ranged') return this.archerThink(m, pc, d, w);
        // muster: wait for the others, so they close in together
        if(!m.engaged){
            // (hunting, not just chasing: a friend it called a moment ago counts before its own turn comes)
            const mates = this.groupOf(m).filter(o => this.hunting(o, hexDist(o, pc)) && !o.retreatHeal && !this.isRanged(o));
            const close = 1 + mates.filter(o => hexDist(o, m) <= G.musterRange || hexDist(o, pc) <= 2).length;
            if(m.musterSince == null) m.musterSince = now;
            if(close >= Math.min(G.musterSize, 1 + mates.length) || now - m.musterSince >= G.musterTime || d <= 2) m.engaged = true;
            else { this.holdAt(m, pc, d, G.holdDist); return true; }
        }
        // surround: its own side of the player, not the back of the queue
        if(d <= 1){ this.attackPlayer(m); return true; }
        if(genius && d > 3){   // a genius heads you off on the way
            const t = this.interceptCell(m, pc, d);
            if(t !== pc){ const s = this.chase(m, t); if(s && !s.breakIt){ this.commit(m, s.x, s.y); return true; } }
        }
        const slot = this.surroundSlot(m, pc);
        if(slot && now >= (m.stuckUntil || 0)){
            const s = this.chaseStep(m, slot, 1500, false, 0);
            if(s && !s.breakIt){ this.commit(m, s.x, s.y); return true; }
        }
        return false;
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
    /** First step toward the nearest cave cell (BFS, limited), or null. A dark creature caught out in daylight heads back in. */
    stepToCave(m, limit = 400){
        const start = cellIndex(m.x, m.y), prev = new Map([[start, -1]]), queue = [start];
        for(let q = 0; q < queue.length && prev.size < limit; q++){
            const i = queue[q];
            if(i !== start && Theaya.biome[i] === 'cave'){
                let k = i; while(prev.get(k) !== start) k = prev.get(k);
                return cellXY(k);
            }
            const c = cellXY(i);
            for(const n of Theaya.zone.neighbors(c.x, c.y)){
                const j = cellIndex(n.x, n.y);
                if(prev.has(j) || !this.canEnter(m, n.x, n.y)) continue;
                prev.set(j, i); queue.push(j);
            }
        }
        return null;
    },
    /**
     * The neighbour that leads most directly away from `from` (player north of it -> it goes south).
     * Sideways is allowed when the straight way is blocked, never a step toward them. Null when cornered.
     */
    stepAway(m, from){
        let best = null, bs = -0.01;
        for(const n of Theaya.zone.neighbors(m.x, m.y)){
            if(!this.canEnter(m, n.x, n.y)) continue;
            const s = this.awayness(m, from, n) + Math.random() * 0.05;   // a hint of randomness breaks exact ties
            if(s > bs){ bs = s; best = n; }
        }
        return best;
    },
    /**
     * When no single step leads away (trees, walls, a dead end): the first step of the shortest way to the
     * reachable cell farthest from the player (within `limit` cells searched), never through a cell next to
     * them. Null when there's nowhere farther to go: it's cornered.
     */
    escapeStep(m, pc, limit = 300){
        const start = cellIndex(m.x, m.y), prev = new Map([[start, -1]]), queue = [start];
        let best = -1, bestD = hexDist(m, pc);
        for(let q = 0; q < queue.length && prev.size < limit; q++){
            const i = queue[q], c = cellXY(i), dc = hexDist(c, pc);
            if(dc > bestD){ bestD = dc; best = i; }
            for(const n of Theaya.zone.neighbors(c.x, c.y)){
                const j = cellIndex(n.x, n.y);
                if(prev.has(j) || hexDist(n, pc) <= 1 || !this.canEnter(m, n.x, n.y)) continue;
                prev.set(j, i); queue.push(j);
            }
        }
        if(best < 0) return null;
        let k = best;
        while(prev.get(k) !== start) k = prev.get(k);
        return cellXY(k);
    },
    /** Getting away from the player: straight away (stepAway), or around what's in the way (escapeStep). Null when cornered. */
    getAway(m, pc){ return this.stepAway(m, pc) ?? this.escapeStep(m, pc); },
    wander(m){
        if(Math.random() < 0.5){ m.wait = 1 + Math.random() * 3; return; }
        const home = this.homeOf(m);   // one that lives somewhere (a camp) doesn't stray from it
        const opts = Theaya.zone.neighbors(m.x, m.y).filter(n => this.canEnter(m, n.x, n.y) && !(home && hexDist(n, home) > GROUP.leash));
        if(opts.length){ const n = opts[Math.floor(Math.random() * opts.length)]; this.commit(m, n.x, n.y); }
        m.wait = 0.5 + Math.random() * 2.5;
    },
    /** Seconds this creature needs to break the block at (x, y), or null when it can't / won't. */
    breakTime(m, x, y, natural = true){
        if(!m.def.breaks || !Theaya.zone.inBounds(x, y)) return null;
        const g = groundAt(x, y), b = blockAt(x, y), def = b && Blocks.get(b.id);
        if(!natural && !(def && def.siege)) return null;   // only walls / doors / glass
        const base = siegeSeconds(m.def, def);
        if(!g || !g.passable || base == null) return null;
        const secs = base * foundationBreakMult(cellIndex(x, y));   // walls / doors on a foundation hold out longer
        if(this.occ.has(cellIndex(x, y))) return null;
        return secs * (1 - (b.cracks || 0));
    },
    /**
     * Next step of a chase: the cheapest way to a cell next to `target`, where
     * breaking a wall / door costs its break time (in cells walked at the
     * creature's speed). Returns { x, y } to walk to, { x, y, breakIt:true }
     * when the way on is through that block, or null.
     */
    chase(m, target){
        // Natural terrain is a last resort: dig only when there's no way around (walls / doors still count as ways).
        return this.chaseStep(m, target, 1500, false) ?? this.chaseStep(m, target, 1500, true);
    },
    /** `reach` = how close to the target the way must end (1: next to it, 0: on it). */
    chaseStep(m, target, limit = 1500, natural = true, reach = 1){
        // A* (heuristic: hex distance to a cell within `reach` of the target)
        const start = cellIndex(m.x, m.y), cost = new Map([[start, 0]]), prev = new Map([[start, -1]]);
        const hOf = c => Math.max(0, hexDist(c, target) - reach);
        const heap = new MinHeap(), closed = new Set();
        heap.push(start, hOf(m));
        let found = -1;
        while(heap.size && closed.size < limit){
            const { key: i } = heap.pop();
            if(closed.has(i)) continue;
            closed.add(i);
            const c = cellXY(i), g = cost.get(i);
            if(i !== start && hexDist(c, target) <= reach){ found = i; break; }
            for(const n of Theaya.zone.neighbors(c.x, c.y)){
                const j = cellIndex(n.x, n.y);
                if(closed.has(j)) continue;
                let step;
                if(this.canEnter(m, n.x, n.y)) step = 1;
                else { const t = this.breakTime(m, n.x, n.y, natural); if(t == null) continue; step = 1 + Math.min(t * m.def.speed, 12) + t * 0.001; }   // a wall "costs" at most a 12 cell detour
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
    /** Hostile creatures, and neutral ones that were provoked (hurt by the player). */
    isHostile(m){ return m.def.behaviour === 'hostile' || (m.def.behaviour === 'neutral' && !!m.provoked); },
    hunting(m, d, now = this.now){
        return this.isHostile(m) && now - (m.seenAt ?? -1e9) < HOSTILE.memory && d <= HOSTILE.giveUp;
    },
    /** Chipping at a wall / door on the way to the player (every tick while it does). */
    breakTick(m, dt){
        const k = m.breaking, b = blockAt(k.x, k.y), def = b && Blocks.get(b.id);
        const pc = playerCell(), d = pc ? hexDist(m, pc) : 99;
        if(d <= m.def.sight) m.seenAt = this.now;   // it can hear you on the other side
        if(!b || b.id !== k.id || hexDist(m, k) !== 1 || !this.hunting(m, d) || d <= 1){ m.breaking = null; return false; }
        k.recheck -= dt;
        if(k.recheck <= 0){   // a quicker way may have opened up (a door left open, the player moved)
            k.recheck = this.aiOf(m) === 'dumb' ? 2 : MOB_AI.recheckWall;
            const step = this.chase(m, pc);
            if(!step || !step.breakIt){ m.breaking = null; return false; }   // another wall is no better: keep at this one
        }
        const i = cellIndex(k.x, k.y), level = Math.floor((b.cracks || 0) * 4);
        const base = siegeSeconds(m.def, def);
        if(base == null){ m.breaking = null; return false; }
        const secs = base * foundationBreakMult(i);   // walls / doors on a foundation hold out longer
        b.cracks = Math.min(1, (b.cracks || 0) + dt / secs);
        if(Math.floor(b.cracks * 4) !== level) Theaya.dirty.add(i);
        const w = Theaya.zone.toWorld(k.x, k.y);
        m.facing = Math.atan2(w.y - m.py, w.x - m.px);
        k.thump -= dt;
        if(k.thump <= 0){ k.thump = 0.9; this.fx.push({ kind:'swing', x: w.x, y: w.y, t0: performance.now(), dur: 200, color:'#ffcf8a' }); }
        if(b.cracks >= 1){
            setBlock(k.x, k.y, null);
            m.breaking = null;
            if(pc && hexDist(pc, k) <= 14 && def.siege) notify(T('combat.brokeThrough', { creature: m.def.name.toLowerCase(), block: def.name.toLowerCase() }), '#ff8a7a');
        }
        return true;
    },
    think(m){
        const pc = playerCell(), now = this.now, d = pc ? hexDist(m, pc) : 99;
        const ai = this.aiOf(m), smart = ai !== 'dumb', genius = ai === 'genius';
        m.running = false;
        m.escaping = false;
        m.chasing = false;
        if(this.isHostile(m) && pc){
            // spots you in its sight range (walls, doors and rock block its view). Once it's
            // after you it keeps track of you while you're in range, even behind walls.
            const was = this.hunting(m, d, now);
            if(d <= m.def.sight * stealthMult() && (was || lineClear(m, pc, blocksSight))) m.seenAt = now;   // sneaking (Hunter) shrinks how far it notices you
            if(m.provoked && !this.hunting(m, d, now)) m.provoked = false;   // a neutral creature that lost track of you calms down
            m.chasing = this.hunting(m, d, now);   // while it's after you, a zombie will follow you out of its cave into daylight
            if(m.def.teamwork === 'group'){ if(this.groupThink(m, pc, d, genius)) return; }   // fights as a group (GROUP decides when it falls back)
            else if(genius){ if(this.geniusThink(m, pc, d)) return; }                       // selfish, and it plays you like a player would (GENIUS)
            else if(smart && this.selfPreserve(m, pc, d)) return;                           // selfish: its own life first
            if(m.chasing){
                if(d <= 1){ this.attackPlayer(m); return; }
                if(now >= (m.stuckUntil || 0)){
                    const target = genius ? this.interceptCell(m, pc, d) : pc;   // a genius heads you off
                    const step = (target !== pc ? this.chase(m, target) : null) ?? this.chase(m, pc);
                    if(step && step.breakIt){
                        const b = blockAt(step.x, step.y);
                        m.breaking = { x: step.x, y: step.y, id: b.id, recheck: 2, thump: 0 };
                        if(Blocks.get(b.id).siege && hexDist(pc, step) <= 14 && now - (this._warned || -1e9) > 8){   // no notice for digging through natural terrain
                            this._warned = now;
                            notify(T('combat.breaking', { a: /^[aeiou]/i.test(m.def.name) ? 'An' : 'A', creature: m.def.name.toLowerCase(), block: Blocks.get(b.id).name.toLowerCase() }), '#ffb070');
                        }
                        return;
                    }
                    if(step){ this.commit(m, step.x, step.y); return; }
                    m.stuckUntil = now + (smart ? MOB_AI.restep : 1);   // no way to you right now: shuffle about, look again shortly
                }
            }
        } else if(pc){
            const scared = now < m.fleeUntil || (m.def.skittish && d <= m.def.skittish * stealthMult());
            if(scared){
                const step = this.stepAway(m, pc);
                if(step){ m.running = true; this.commit(m, step.x, step.y); return; }
            }
        }
        // lost you out in the sun: run back to the nearest cave (it burns until it gets there)
        // (smart ones also go before the sun comes out, at dawn or when the rain hiding it ends: with no player
        // around sunPlan doesn't run, so check here too)
        if(smart && m.def.dark && !m.chasing && Theaya.biome[cellIndex(m.x, m.y)] !== 'cave'
            && (this.sunOut() || m.retreating || this.caveDist(m) / Math.max(0.1, m.def.speed) * 1.5 + MOB_AI.dawnMargin >= this.sunIn())
            && this.goHome(m)) return;
        if(m.def.dark && !m.chasing && this.sunOut() && Theaya.biome[cellIndex(m.x, m.y)] !== 'cave' && now >= (m.noCaveUntil || 0)){
            const step = this.stepToCave(m);
            if(step){ m.running = true; this.commit(m, step.x, step.y); return; }
            m.noCaveUntil = now + 3;   // no cave in reach: don't search again every tick
        }
        // one that lives somewhere (a camp) walks back there after a fight
        if(!m.chasing && m.home != null && now >= (m.homeRetry || 0)){
            const h = this.homeOf(m);
            if(h && hexDist(m, h) > GROUP.leash){
                const s = this.stepToward(m, h, GROUP.leash - 1);
                if(s){ this.commit(m, s.x, s.y); return; }
                m.homeRetry = now + 2;   // no way home right now: look again later
            }
        }
        if(m.wait > 0) return;
        this.wander(m);
    },
    /**
     * A creature with `lays: { block, every:[min, max] s, radius, max }` (chickens) lays that block in its cell
     * when its timer is up and it's standing still there: on bare floor it starts a new one, on one of its own it
     * adds an egg (b.count, up to EGGS.perCell). Nothing is laid while `max` eggs already lie within `radius`
     * cells, so an untended flock doesn't bury the plains. The timer isn't saved: after a load it starts over.
     */
    layTick(m, now){
        const L = m.def.lays;
        const next = () => now + L.every[0] + Math.random() * (L.every[1] - L.every[0]);
        if(m.layAt == null){ m.layAt = next(); return; }
        if(now < m.layAt || m.next) return;
        m.layAt = next();
        const b = blockAt(m.x, m.y), g = groundAt(m.x, m.y);
        if(!g || !g.passable || g.water) return;
        if(b && (b.id !== L.block || (b.count || 1) >= EGGS.perCell)) return;
        let near = 0;
        for(const c of [{ x: m.x, y: m.y }, ...cellsWithin(m, L.radius ?? 3)]){
            const o = blockAt(c.x, c.y);
            if(o && o.id === L.block) near += o.count || 1;
        }
        if(near >= (L.max ?? 4)) return;
        if(b){ b.count = (b.count || 1) + 1; syncCell(m.x, m.y); }
        else setBlock(m.x, m.y, L.block);
    },
    tick(dt){
        this.now += dt;
        const T = Theaya, zone = T.zone, now = this.now;
        // the player's velocity (px/s, smoothed): genius creatures aim where you're going
        const pp = player.transform.position;
        if(this._pp && dt > 0){
            const k = Math.min(1, dt * 4), v = this.playerVel || { x: 0, y: 0 };
            let vx = (pp.x - this._pp.x) / dt, vy = (pp.y - this._pp.y) / dt;
            const sp = Math.hypot(vx, vy); if(sp > 600){ vx *= 600 / sp; vy *= 600 / sp; }   // a teleport isn't a run
            this.playerVel = { x: v.x + (vx - v.x) * k, y: v.y + (vy - v.y) * k };
        }
        this._pp = { x: pp.x, y: pp.y };
        const sun = this.sunOut();
        for(const m of [...this.list]){
            if(!m.alive) continue;
            m.cooldown = Math.max(0, m.cooldown - dt);
            m.wait -= dt;
            // zombies burn in the sun on the surface (not while rain clouds hide it)
            if(m.def.dark && sun && T.biome[cellIndex(m.x, m.y)] !== 'cave'){
                m.hp -= HOSTILE.sunBurn * dt;
                this.noteDamage(m, HOSTILE.sunBurn * dt);   // counts toward the damage per second smart+ creatures flee from
                m.lastHurt = now;  // burning is damage too: healing waits until it's been out of the sun regenDelay seconds
                if(m.hp <= 0){ this.kill(m, false); continue; }
            }
            // every enemy (hostile or neutral, whatever its AI) heals once it hasn't taken damage for HOSTILE.regenDelay seconds
            if(m.def.behaviour !== 'passive' && m.hp < m.def.hp && now - (m.lastHurt ?? -1e9) >= HOSTILE.regenDelay){
                m.hp = Math.min(m.def.hp, m.hp + m.def.hp * HOSTILE.regenRate * dt);
            }
            if(m.def.lays) this.layTick(m, now);
            // smart+: hits you as soon as you're in reach, even halfway between cells
            if(m.next && m.chasing && !m.retreatHeal && m.cooldown <= 0 && this.aiOf(m) !== 'dumb'
                && Math.hypot(pp.x - m.px, pp.y - m.py) <= HEX_W * 1.15) this.attackPlayer(m);
            if(m.next){
                const w = zone.toWorld(m.next.x, m.next.y);
                let speed = m.def.speed * HEX_W * (m.running ? 1.4 : 1) * (this.isHostile(m) && now < m.aggroUntil ? 1.2 : 1);
                if(m.escaping) speed = Math.max(speed, playerSpeed() * MOB_AI.escapeSpeed);   // getting away from you: it can outrun you
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
        if(this.spawnTimer <= 0){ this.spawnTimer = HOSTILE.spawnEvery / Difficulty.mult('spawns'); this.spawnHostiles(); }
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
        const Th = Theaya, inCave = i => Th.biome[i] === 'cave';   // (not `T`: that's the text function)
        const ok = (i, cave) => {
            const c = cellXY(i), d = hexDist(c, pc);
            if(inCave(i) !== cave || d < HOSTILE.minDist || d > HOSTILE.maxDist) return false;
            if(!isPassable(c.x, c.y, 'zombie') || this.occ.has(i) || this.lightSafe(c)) return false;
            if(isFoundation(i) && daylightAt(c.x, c.y) >= HOSTILE.darkLight) return false;   // a foundation only lets hostiles spawn in the dark (no daytime orcs)
            return true;
        };
        const dark = Clock.light() < HOSTILE.darkLight;
        const surface = this.count(m => m.def.dark && !inCave(cellIndex(m.x, m.y)));
        const cave = this.count(m => m.def.dark && inCave(cellIndex(m.x, m.y)));
        // the difficulty scales the caps (and how often this runs: tick, so orcs come more or less often too)
        const k = Difficulty.mult('spawns'), cap = n => Math.max(1, Math.round(n * k));
        if(dark && surface < cap(HOSTILE.maxNight)){ const c = this.randomCell(i => ok(i, false)); if(c) this.spawn('zombie', c.x, c.y); }
        if(cave < cap(HOSTILE.maxCave)){ const c = this.randomCell(i => ok(i, true), 120); if(c) this.spawn('zombie', c.x, c.y); }
        // orcs: a very rare daytime spawn on the surface
        if(Clock.light() >= 0.5 && this.count(m => m.type === 'orc') < cap(HOSTILE.maxOrcs) && Math.random() < HOSTILE.orcChance){
            const c = this.randomCell(i => ok(i, false));
            if(c){ this.spawn('orc', c.x, c.y); notify(T('combat.orcNear'), '#ffb070'); }
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
                    if(isFoundation(i)) return false;   // animals never spawn on a foundation
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
    if(L && !item.isBroken) return { kind:'ranged', range: L.range, cooldown: L.cooldown, power: L.power, item, name: nameOf(item.id) };
    const a = item && typeof item.get === 'function' ? item.get('attack') : null;
    if(a && !item.isBroken && item.hasTag('weapon')){
        return { kind:'melee', range:1, cooldown: item.hasTag('sword') ? 0.6 : 0.9, damage: a.damage, item, name: nameOf(item.id) };
    }
    return { kind:'melee', range:1, cooldown:0.7, damage:2, item:null, get name(){ return T('combat.fists'); } };
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
/**
 * How far a melee swing reaches a creature that's mid-step (px between you and it): the same reach creatures
 * hit you with mid-step (Mobs.tick). A creature only changes cell when it arrives in the next one, so the cell
 * check alone (inAttackRange) would let you keep hitting one that is already running away from the cell next to you.
 */
const MELEE_REACH = HEX_W * 1.15;
/** Is the creature within MELEE_REACH of the center of the player's cell? (the cell, not the exact spot: a walk that stops a little off-center doesn't shorten your arm) */
function meleeReaches(m){
    const pc = playerCell();
    if(!pc) return false;
    const c = Theaya.zone.toWorld(pc.x, pc.y);
    return Math.hypot(c.x - m.px, c.y - m.py) <= MELEE_REACH;
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
        if(!arrow){ notify(T('combat.noArrowsFor', { weapon: w.name }), '#ff8a7a'); return false; }
        dmg = arrow.get('ammoStats').damage * w.power;
        arrow.removeCount(1);
        player.inventory._changed({ event:'shoot' });
        Mobs.fx.push({ kind:'arrow', x0: pp.x, y0: pp.y, x1: m.px, y1: m.py, t0: performance.now(), dur: 160, color: Items.look(arrow).color, item: arrow.id });
    } else {
        dmg = w.damage;
        Mobs.fx.push({ kind:'swing', x: m.px, y: m.py, t0: performance.now(), dur: 200, color:'#ffffff' });
    }
    if(w.item){
        w.item.wear(1);
        if(w.item.isBroken){ player.inventory.removeRef(w.item); notify(T('notify.broke', { item: nameOf(w.item.id) }), '#ff8a7a'); }
    }
    Mobs.hurt(m, dmg * (1 + 0.08 * skillLevel('brawler')));   // Brawler
    return true;
}
function tickCombat(dt){
    Act.attackCd = Math.max(0, (Act.attackCd || 0) - dt);
    const c = Act.combat;
    if(!c) return;
    const m = c.mob, pc = playerCell(), zone = areaZones.home;
    if(!m.alive){ Act.combat = null; return; }
    if(!pc) return;
    const w = weaponInfo(heldItem()), melee = w.kind === 'melee';
    // melee: a creature that's mid-step has to be within arm's reach right now (one stepping away from you is
    // already out of it); one standing in the cell next to you always is
    if(inAttackRange(pc, m, w) && (!melee || !m.next || meleeReaches(m))){
        if(zone.isMoving(player)) zone.stopMove(player);
        if(Act.attackCd <= 0){
            if(!attackMob(m, w)){ Act.combat = null; return; }
            Act.attackCd = w.cooldown;
        }
        return;
    }
    // out of range: (re)plan a walk to the best spot every 0.4 s or when the target moved
    // (melee aims at the cell it's stepping into: the one it's leaving doesn't count any more)
    const goal = melee && m.next ? { x: m.next.x, y: m.next.y } : m;
    c.plan -= dt;
    const key = `${goal.x},${goal.y},${w.kind}`;
    if(c.plan > 0 && c.key === key && zone.isMoving(player)) return;
    c.plan = 0.4; c.key = key;
    const spot = attackCellFor(goal, w);
    if(!spot){ notify(T('combat.cantReach', { creature: m.def.name.toLowerCase() }), '#ffb070'); Act.combat = null; return; }
    if(spot.x === pc.x && spot.y === pc.y) return;
    zone.moveTo(player, spot.x, spot.y, pathOpts());
}
/** Quick action for a creature under the cursor (any held item; weapons hit harder). */
function attackActionFor(m){
    const w = weaponInfo(heldItem());
    const label = T('combat.attack', { creature: m.def.name, weapon: w.name }) + (w.kind === 'ranged' ? T('combat.range', { n: w.range }) : '') + T('combat.attackEnd');
    if(w.kind === 'ranged' && !bestArrow()) return { label, reason: T('combat.noArrows'), mob: m };
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
    const mot = Textures.motion(m, m.px, m.py);
    const tex = Textures.pick(m.type, 'main', [mot.moving && 'moving']);
    if(!tex || tex.s.over) switch(m.type){
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
        case 'goblin': {
            // what it wears and holds shows: its armor's colors, a sword or a bow; the chief has a red plume
            const gear = m.gear || {}, tint = it => it ? Items.look(it).color : null, w = gear.weapon;
            const bow = !!(w && w.get && w.get('launcher'));
            const hx = x - px * s * 0.58 + fx * s * 0.28, hy = y - py * s * 0.58 + fy * s * 0.28;   // its right hand
            for(const side of [-1, 1]){   // feet (boots show their color)
                stroke(shade(tint(gear.feet) || '#4a3a24', -0.35)); strokeWeight(1.2); fill(tint(gear.feet) || '#4a3a24');
                circle(x - fx * s * 0.32 + px * s * 0.3 * side, y - fy * s * 0.32 + py * s * 0.3 * side, s * 0.34);
            }
            if(w && !bow){
                const blade = tint(w) || '#b98d55';
                stroke(shade(blade, -0.3)); strokeWeight(3); line(hx, hy, hx + fx * s * 1.05, hy + fy * s * 1.05);
                stroke('#5a3d26'); strokeWeight(3); line(hx - px * s * 0.18, hy - py * s * 0.18, hx + px * s * 0.18, hy + py * s * 0.18);   // the hilt
            }
            const legs = tint(gear.legs), body = tint(gear.chest) || '#7a5a36';   // no chestplate: a leather jerkin
            stroke(shade(body, -0.4)); strokeWeight(1.2);
            if(legs){ fill(legs); ellipse(x - fx * s * 0.12, y - fy * s * 0.12, s * 1.05, s * 1.05); }
            fill(body); ellipse(x, y, s * 1.1, s * 0.95);
            if(bow){   // held across its front, string toward it
                const bx = x + fx * s * 0.62, by = y + fy * s * 0.62;
                noFill(); stroke(shade(tint(w) || '#9a6b3a', -0.2)); strokeWeight(2.4);
                arc(bx, by, s * 1.3, s * 1.3, m.facing - 1.1, m.facing + 1.1);
                stroke(230, 225, 210, 200); strokeWeight(1);
                line(bx + Math.cos(m.facing - 1.1) * s * 0.65, by + Math.sin(m.facing - 1.1) * s * 0.65, bx + Math.cos(m.facing + 1.1) * s * 0.65, by + Math.sin(m.facing + 1.1) * s * 0.65);
            }
            const kx = x + fx * s * 0.3, ky = y + fy * s * 0.3, skin = col;   // the head, ears out to the sides
            stroke(shade(skin, -0.4)); strokeWeight(1.2); fill(skin);
            for(const side of [-1, 1]) triangle(kx + px * s * 0.2 * side + fx * s * 0.08, ky + py * s * 0.2 * side + fy * s * 0.08,
                                                kx + px * s * 0.2 * side - fx * s * 0.14, ky + py * s * 0.2 * side - fy * s * 0.14,
                                                kx + px * s * 0.66 * side - fx * s * 0.12, ky + py * s * 0.66 * side - fy * s * 0.12);
            circle(kx, ky, s * 0.66);
            if(gear.head){ fill(tint(gear.head)); stroke(shade(tint(gear.head), -0.4)); arc(kx, ky, s * 0.7, s * 0.7, m.facing + Math.PI / 2, m.facing + Math.PI * 1.5, CHORD); }   // a cap over the back of its head
            if(m.role === 'chief'){ noStroke(); fill('#d8452f'); triangle(kx - fx * s * 0.2 + px * s * 0.08, ky - fy * s * 0.2 + py * s * 0.08, kx - fx * s * 0.2 - px * s * 0.08, ky - fy * s * 0.2 - py * s * 0.08, kx - fx * s * 0.75, ky - fy * s * 0.75); }
            noStroke(); fill('#ffe14a');
            for(const side of [-1, 1]) circle(kx + fx * s * 0.2 + px * s * 0.11 * side, ky + fy * s * 0.2 + py * s * 0.11 * side, 2.4);
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
        case 'boar':
            fill(col); ellipse(x, y, s * 1.5, s * 1.1);
            noStroke(); fill(shade(col, -0.3)); ellipse(x - fx * s * 0.1, y - fy * s * 0.1, s * 0.9, s * 0.35);   // bristly back
            stroke(dark); head(0.65, s * 0.7);
            noStroke(); fill('#8a6a5a'); circle(x + fx * s * 0.95, y + fy * s * 0.95, s * 0.32);                 // snout
            fill('#f2ead2');                                                                                    // tusks
            for(const side of [-1, 1]) triangle(x + fx * s * 0.85 + px * s * 0.12 * side, y + fy * s * 0.85 + py * s * 0.12 * side,
                                                x + fx * s * 0.85 + px * s * 0.24 * side, y + fy * s * 0.85 + py * s * 0.24 * side,
                                                x + fx * s * 1.12 + px * s * 0.22 * side, y + fy * s * 1.12 + py * s * 0.22 * side);
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
    if(tex) Textures.draw(null, tex, x, y, s * 2, s * 2, { angle: m.facing, animate: true });
    const since = performance.now() - m.hitAt;
    if(since < 160){ noStroke(); fill(255, 40, 40, 140 * (1 - since / 160)); circle(x, y, s * 1.6); }
    if(m.hp < m.def.hp){
        const w = Math.max(18, s * 1.6), bx = x - w / 2, by = y - s - 10;
        noStroke(); fill(0, 0, 0, 150); rect(bx, by, w, 4, 2);
        fill(Mobs.isHostile(m) ? '#ff6a5a' : '#7ddc6a'); rect(bx, by, w * Math.max(0, m.hp / m.def.hp), 4, 2);
    }
}
function drawCombatFx(){
    const now = performance.now();
    for(const f of Mobs.fx){
        const k = (now - f.t0) / f.dur;
        if(f.kind === 'arrow'){
            const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k, a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
            const tex = f.item && Textures.pick(f.item);   // the arrow item's texture (pointing right = angle 0)
            if(!tex || tex.s.over){
                stroke('#6b4a2a'); strokeWeight(2); line(x - Math.cos(a) * 12, y - Math.sin(a) * 12, x, y);
                stroke(f.color); strokeWeight(3); point(x, y);
            }
            if(tex) Textures.draw(null, tex, x - Math.cos(a) * 6, y - Math.sin(a) * 6, 16, 16, { angle: a });
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
        drawFishingLine();
        pop();
    },
};
theayaScene.addObject(mobLayer);
Mobs.repopulate(true);


/* ---------------------------------------------------------------------
 * 11. Input + GameUI state
 * --------------------------------------------------------------------- */
const GameUI = {
    choice: null,         // { options: [skill ids] } while the level-up pick is open (the world waits)
    skillsOpen: false,    // K: the skills panel
    hotbar: 1,            // selected hotbar position (1..7)
    inventoryOpen: false,
    station: null,        // { x, y, kind, openedInventory }
    wheel: null,          // { x, y, options, from }
    picked: null,         // click-to-swap: first slot clicked ({ box, i })
    press: null,          // { ref, x, y, dragging, shift }
    itemMenu: null,       // right-click menu on an inventory stack: { ref, x, y, amount, dragging }
    confirmDelete: null,  // { ref } while the delete pop-up is open
    regions: [],          // clickable screen areas, rebuilt every frame by the HUD
    scroll: { hand: 0, station: 0 },
    heartRadius: -1,      // the heart stone cell whose repair radius is shown in the world (-1 = none)
    scrollDrag: null,    // { key, grab } while a scroll bar thumb is held (grab = px from the thumb's top)
    craftFilter: 'all',   // crafting menus: 'all' recipes, or only the 'craftable' ones (the toggle next to the search bar)
    toasts: [],
    paused: false,        // pause menu open (P): the world stops
    pauseView: 'main',    // 'main' | 'controls' | 'restart'
    showHelp: false,      // the controls list on the right side of the HUD (off until turned on in the pause menu)
    settingsOpen: false,  // the settings menu (pause menu > Settings) is open
    calendar: null,       // { year, month } the calendar under the clock shows (month -1 = new year day), null = folded up
};

const _devSecrets = {
    immortal:false,
};

/**
 * The crafting menus' search bar (a uiTextBox from male/objects.js). The HUD draws it by hand inside
 * drawRecipeList (it isn't in the game scene), so it sits in the panel's draw order. While it has
 * focus the game's keys are off (getInput hides them); Enter / Esc / Tab or a click elsewhere leave it.
 */
const RecipeSearch = new uiTextBox(0, 0, 200, 26, { maxLength: 40, format: { text: { size: 12 } } }, 'theaya_hud');
RecipeSearch.on('input', () => { GameUI.scroll.hand = 0; GameUI.scroll.station = 0; });   // new results start at the top
/** Empty the search bar and leave it (when the menus close). */
function resetRecipeSearch(){ RecipeSearch.blur(); RecipeSearch.clear(); }

/* ----- Controls: the actions and their binds -----
 * Every action has a keyboard bind (THEAYA_BINDS) and a controller bind (THEAYA_PAD_BINDS). Both are kept in the
 * engine's bind system ({ keyboard, controller } per action): Binds.install(world) in setup() calls world.defineBinds
 * (replacing the engine's example binds), then puts the player's saved changes on top. The game reads an action
 * through Keys (Keys.pressed('default@inventory')), which checks BOTH devices, so the keyboard and a controller
 * work at the same time.
 * Settings > Controls rebinds them, one page per device (Binds.set). No two actions of a device share
 * a bind: taking a bind that another action uses swaps the two. Changes are saved with the settings
 * (Settings.data.binds / Settings.data.padBinds).
 * Not actions (always the same): clicking menus, slots and buttons (left mouse button, or the controller's `move`
 * bind), Shift+click / Shift+Craft (the Shift key) and the mouse wheel (hotbar). Using a held item on a cell and
 * attacking a creature are part of `move`: they follow its bind.
 * Controller only: `cursor` (a stick: moves the on-screen cursor, see Pad), `hotbarprev` / `hotbarnext`; sneaking
 * toggles (press once to start, again to stop) instead of being held. No double-click on a controller.
 * In menus the controller also works like a console game's (PadNav): the other stick jumps between the options,
 * slots and buttons, `interact` selects, and with a station open the bumpers switch between it and the backpack.
 * Action ids are lower case.
 */
const THEAYA_BINDS = {
    move:      'mouse@left',     // walk to the cell under the mouse (or use the held item there / attack a creature)
    wheel:     'mouse@right',    // the action wheel for the cell under the mouse
    interact:  'key@e',          // open the station next to you / close menus
    use:       'key@f',          // eat / drink / wear / place a torch / cast a rod
    inventory: 'key@tab',        // the inventory (and the workbench next to you) / close menus
    skills:    'key@k',
    sneak:     'key@shift',
    close:     'key@escape',     // close what's open, or pause
    pause:     'key@p',
    hotbar1: 'key@1', hotbar2: 'key@2', hotbar3: 'key@3', hotbar4: 'key@4', hotbar5: 'key@5', hotbar6: 'key@6', hotbar7: 'key@7',
};
/** The controller's binds (engine names: 'select' = A, 'back' = B, 'primary' = X, 'secondary' = Y on an Xbox layout). */
const THEAYA_PAD_BINDS = {
    cursor:     'stick@left',        // moves the on-screen cursor (a stick only)
    move:       'trigger@right',     // walk / use the held item / attack; also clicks menus (like the left mouse button)
    wheel:      'trigger@left',      // the action wheel; also right-clicks menus (a stack's item menu)
    interact:   'button@select',     // ...and in a menu: select what the cursor is on (PadNav)
    use:        'button@primary',
    inventory:  'button@secondary',
    skills:     'dpad@down',
    sneak:      'button@leftstick',  // toggles sneaking
    close:      'button@back',
    pause:      'button@menu',
    hotbarprev: 'bumper@left',       // (with a station open: switch between the backpack and the station, see PadNav)
    hotbarnext: 'bumper@right',
};
const BIND_DEFAULTS = { keyboard: THEAYA_BINDS, controller: THEAYA_PAD_BINDS };
/** Every controller input a bind can use. */
const PAD_INPUTS = [
    'button@select', 'button@back', 'button@primary', 'button@secondary', 'button@view', 'button@menu', 'button@leftstick', 'button@rightstick',
    'trigger@left', 'trigger@right', 'bumper@left', 'bumper@right', 'dpad@up', 'dpad@down', 'dpad@left', 'dpad@right',
    'stick@left', 'stick@right',
];
const HOTBAR_ACTIONS = [1, 2, 3, 4, 5, 6, 7].map(n => 'hotbar' + n);
const Binds = {
    actions: Object.keys(THEAYA_BINDS),         // the keyboard's actions
    padActions: Object.keys(THEAYA_PAD_BINDS),  // the controller's actions
    /** Every action read as a button (both devices; not the cursor stick). */
    get buttonActions(){ return this._buttons || (this._buttons = [...new Set([...this.actions, ...this.padActions])].filter(a => a !== 'cursor')); },
    pointerOnly: ['move', 'wheel'],   // the left / right mouse buttons only go to actions that point at a cell
    padFixed: ['pause'],              // controller binds that can't change (pause's button also cancels a rebind)
    listening: null,                  // the action waiting for a new bind in the Controls panel
    device: 'keyboard',               // ...on this device's page
    status: null,                     // { text, color, until }: the last change, shown in the panel
    actionsOf(device){ return device === 'controller' ? this.padActions : this.actions; },
    /** The current bind of an action on a device (an input string like 'key@e' / 'button@select'), or null. */
    get(action, device = 'keyboard'){
        const b = World.active && World.active.defaults.binds[action];
        let v = b && typeof b === 'object' && !Array.isArray(b) ? b[device] : (device === 'keyboard' ? b : undefined);
        if(Array.isArray(v)) v = v[0];
        return typeof v === 'string' ? v : (BIND_DEFAULTS[device][action] ?? null);
    },
    /** The bind the player sees for an action: the controller's while it's in use (when it has one), else the keyboard's. */
    shown(action){ return (Pad.active && this.padActions.includes(action) && this.get(action, 'controller')) || this.get(action); },
    valid(input, device = 'keyboard'){
        if(typeof input !== 'string') return false;
        return device === 'controller' ? PAD_INPUTS.includes(input) : /^(key@.+|mouse@(left|right|middle))$/.test(input);
    },
    allowed(action, input, device = 'keyboard'){
        if(device === 'controller') return input.startsWith('stick@') === (action === 'cursor');   // sticks only move the cursor
        return !/^mouse@(left|right)$/.test(input) || this.pointerOnly.includes(action);
    },
    /** The action of a device that uses this input, or null. */
    owner(input, except = null, device = 'keyboard'){ return this.actionsOf(device).find(a => a !== except && this.get(a, device) === input) ?? null; },
    /**
     * Bind an action to an input. When another action uses it, the two swap binds.
     * Returns { ok, other, old } or { ok:false, reason: 'mouse' | 'stick' | 'swap', other }.
     */
    set(action, input, save = true, device = 'keyboard'){
        const old = this.get(action, device);
        if(!this.actionsOf(device).includes(action) || !this.valid(input, device)) return { ok:false, reason:'invalid' };
        if(input === old) return { ok:true };
        // the controller's pause bind is fixed, and its button (also "cancel" while rebinding) can't go to anything else
        if(device === 'controller' && (this.padFixed.includes(action) || this.padFixed.some(a => THEAYA_PAD_BINDS[a] === input))) return { ok:false, reason:'reserved' };
        if(!this.allowed(action, input, device)) return { ok:false, reason: device === 'controller' ? 'stick' : 'mouse' };
        const other = this.owner(input, action, device);
        if(other && !this.allowed(other, old, device)) return { ok:false, reason:'swap', other };
        world.setBind(action, input, device);
        if(other) world.setBind(other, old, device);
        if(save) this.save();
        return { ok:true, other, old };
    },
    isDefault(device = 'keyboard'){ return this.actionsOf(device).every(a => this.get(a, device) === BIND_DEFAULTS[device][a]); },
    /** Every action of a device back to its defaults. */
    reset(device = 'keyboard'){
        for(const a of this.actionsOf(device)) world.setBind(a, BIND_DEFAULTS[device][a], device);
        this.save();
    },
    save(){
        for(const [device, key] of [['keyboard', 'binds'], ['controller', 'padBinds']]){
            const changed = {};
            for(const a of this.actionsOf(device)) if(this.get(a, device) !== BIND_DEFAULTS[device][a]) changed[a] = this.get(a, device);
            Settings.data[key] = changed;
        }
        Settings.save();
    },
    /** setup(): define the default binds through the engine, then put the player's saved changes on top. */
    install(w){
        const map = {};
        for(const a of new Set([...this.actions, ...this.padActions])){
            map[a] = {};
            if(THEAYA_BINDS[a]) map[a].keyboard = THEAYA_BINDS[a];
            if(THEAYA_PAD_BINDS[a]) map[a].controller = THEAYA_PAD_BINDS[a];
        }
        w.defineBinds(map, { replace: true });
        for(const [a, input] of Object.entries(Settings.data.binds || {})) this.set(a, input, false, 'keyboard');   // (set keeps them unique)
        for(const [a, input] of Object.entries(Settings.data.padBinds || {})) this.set(a, input, false, 'controller');
    },
    /** Controls panel: wait for the next key / mouse button (keyboard page) or controller button (controller page). */
    listen(action, device = 'keyboard'){
        this.listening = action; this.device = device; this.status = null;
        if(device === 'controller') Pad.startCapture();
    },
    cancel(){ this.listening = null; },
    /** The input pressed while listening. */
    capture(input){
        const action = this.listening, device = this.device;
        if(!action) return;
        const r = this.set(action, input, true, device);
        if(!r.ok){
            if(r.reason === 'mouse') this.flash(T('bind.mouseOnly', { left: bindLabel('mouse@left'), right: bindLabel('mouse@right') }), '#ffb070');
            else if(r.reason === 'stick') this.flash(T(action === 'cursor' ? 'bind.cursorStick' : 'bind.stickCursorOnly', { action: bindName('cursor') }), '#ffb070');
            else if(r.reason === 'reserved') this.flash(T('bind.padReserved', { key: bindLabel(input) }), '#ffb070');
            else if(r.reason === 'swap') this.flash(T('bind.cantSwap', { key: bindLabel(input), other: bindName(r.other) }), '#ffb070');
            return;   // keep listening: try another one
        }
        this.listening = null;
        Keys.mute.add(input);   // what was just pressed doesn't also do its new action
        if(r.other) this.flash(T('bind.swapped', { action: bindName(action), key: bindLabel(input), other: bindName(r.other), old: bindLabel(r.old) }), '#ffd75e');
        else this.flash(T('bind.set', { action: bindName(action), key: bindLabel(input) }), '#8fe39a');
    },
    flash(text, color){ this.status = { text, color, until: performance.now() + 5000 }; },
};
/** On-screen names of keys that don't read well as e.key (text keys: translated). */
const KEY_LABELS = {
    escape:'Esc', tab:'Tab', shift:'Shift', control:'Ctrl', alt:'Alt', meta:'Meta', enter:'Enter', backspace:'Backspace',
    delete:'Delete', insert:'Insert', home:'Home', end:'End', pageup:'Page Up', pagedown:'Page Down', capslock:'Caps Lock',
    arrowup:'↑', arrowdown:'↓', arrowleft:'←', arrowright:'→', space:'@key.space',
};
/** How a bind looks on screen: 'key@e' -> 'E', 'mouse@left' -> 'Left-click', 'trigger@left' -> 'LT' (THEAYA_TEXT 'pad.*'). */
function bindLabel(input){
    if(!input) return T('key.none');
    const at = input.indexOf('@'), dom = input.slice(0, at), name = input.slice(at + 1);
    if(dom === 'mouse') return T('key.mouse.' + name);
    if(['button', 'trigger', 'bumper', 'dpad', 'stick'].includes(dom)) return T(`pad.${dom}.${name}`);
    const known = KEY_LABELS[name];
    if(known) return known.startsWith('@') ? T(known.slice(1)) : known;
    return name.length === 1 ? name.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1);
}
/**
 * The current binds of the actions, as text placeholders: T('station.close', keyVars()) -> 'Tab / E / Esc to close'.
 * While the controller is in use, its buttons are shown instead (actions it has no bind for keep the keyboard's).
 */
const keyVars = () => Object.fromEntries(Binds.buttonActions.map(a => [a, bindLabel(Binds.shown(a))]));
/** An action's name in the Controls panel ('Hotbar slot 3'). */
const bindName = action => /^hotbar\d$/.test(action) ? T('bind.hotbar', { n: action.slice(6) }) : T('bind.' + action);
/** The hotbar keys, short: '1-7' for the defaults, else every key in order ('LB / RB' with a controller). */
function hotbarKeysLabel(){
    if(Pad.active) return `${bindLabel(Binds.get('hotbarprev', 'controller'))} / ${bindLabel(Binds.get('hotbarnext', 'controller'))}`;
    const keys = HOTBAR_ACTIONS.map(a => bindLabel(Binds.get(a)));
    return keys.join('') === '1234567' ? '1-7' : keys.join(' ');
}

/**
 * Which input device the game listens to (pause menu > Settings > Input device, saved as Settings.data.inputDevice):
 *   'auto'        both: the keyboard / mouse and the controller work, the game follows whichever was used last (the default);
 *   'keyboard'    only the keyboard and mouse: the controller is ignored (Pad never wakes, a drifting stick can't move the cursor);
 *   'controller'  only the controller: while one is connected the real mouse's events are stopped before the engine,
 *                 p5 or the game see them (they can't move mouse.rawX under the controller's cursor), and Keys ignores
 *                 the keyboard. With no controller connected the keyboard and mouse still work, so nobody is locked out.
 * The Controls panel can still catch a bind from either device (a key / mouse button on its keyboard page, a
 * controller button on its controller page), whatever is picked here.
 */
const InputDevice = {
    modes: ['auto', 'keyboard', 'controller'],
    labels: { auto: 'settings.device.auto', keyboard: 'controls.tab.keyboard', controller: 'controls.tab.controller' },   // THEAYA_TEXT keys
    get mode(){ const m = Settings.data.inputDevice; return this.modes.includes(m) ? m : 'auto'; },
    set(m){
        if(!this.modes.includes(m)) return;
        Settings.data.inputDevice = m;
        Settings.save();
        if(m === 'keyboard' && Pad.active) Pad.sleep();   // (for 'controller', Pad.update wakes the controller's cursor once one is connected)
    },
    /** The controller is listened to. */
    pad(){ return this.mode !== 'keyboard'; },
    /** The keyboard and mouse are listened to. */
    keyboard(){ return this.mode !== 'controller' || !Pad.connected(); },
    /** The real mouse's events are dropped right now (not while the debug console is open: it's clicked with the mouse). */
    blocksMouse(){ return !this.keyboard() && !(typeof DevConsole !== 'undefined' && DevConsole.enabled && DevConsole.open); },
};

/**
 * The controller: an on-screen cursor moved by the `cursor` stick (it stands in for the mouse: mouse.rawX / rawY
 * follow it; Cursor.padImage draws it with the game's cursor images), sneak toggling, list scrolling (push the cursor against a list's top / bottom edge),
 * the other stick (menu navigation in menus, see PadNav), and catching a button for the Controls panel.
 * It's "active" from the moment the controller is used until the real mouse moves; while active the game shows
 * its cursor and the controller's button names. The Input device setting changes that (InputDevice): 'keyboard'
 * keeps it asleep, 'controller' keeps it awake while a controller is connected.
 */
const Pad = {
    active: false,
    x: 0, y: 0,          // the cursor (screen px)
    sneak: false,        // sneaking, toggled with the controller's sneak bind
    wheelPick: null,     // the action wheel option the other stick picked (its index): the cursor stays on it (drawWheel)
    _t: 0, _scroll: 0, _captured: new Set(),
    connected(){ return typeof controller !== 'undefined' && !!controller && controller.connected; },
    /** A controller is connected and the Input device setting listens to it. */
    enabled(){ return this.connected() && InputDevice.pad(); },
    /** Keys.update(), every tick: move the cursor, wake up when the controller is used. */
    update(){
        const now = performance.now(), dt = Math.min(0.1, (now - (this._t || now)) / 1000);
        this._t = now;
        if(!this.enabled()){ if(this.active) this.sleep(); return; }
        const st = getInput(Binds.get('cursor', 'controller') + ':axis') || { x: 0, y: 0 };
        const sx = st.x || 0, sy = st.y || 0, m = Math.hypot(sx, sy), dz = 0.15;
        const pressing = (controller.buttons || []).some(b => b && b.pressed);
        if(!this.active && (m > dz || pressing || InputDevice.mode === 'controller')) this.wake();
        if(!this.active) return;
        let scroll = 0;   // list rows per second this tick (handleInput scrolls the list under the cursor)
        if(m > dz){
            this.wheelPick = null;   // the cursor leaves the wheel option the other stick picked
            const k = Math.pow((Math.min(1, m) - dz) / (1 - dz), 1.6) / m * Settings.cursorSpeed() * dt;   // gentle near the middle, for aiming
            this.x = Math.max(0, Math.min(width - 1, this.x + sx * k));
            let ny = Math.max(0, Math.min(height - 1, this.y + sy * k));
            // edge scrolling: pushing the cursor past a list's top / bottom edge scrolls it instead (until its end)
            const list = uiHitAll(this.x, this.y).find(r => r.kind === 'panel' && r.scroll);
            if(list && Math.abs(sy) > 0.3){
                const at = GameUI.scroll[list.scroll] || 0, edge = 14;
                if(sy < 0 && ny < list.y + edge && at > 0){ ny = list.y + edge; scroll = sy * 12; }
                else if(sy > 0 && ny > list.y + list.h - edge && at < (list.maxScroll || 0)){ ny = list.y + list.h - edge; scroll = sy * 12; }
            }
            this.y = ny;
        }
        // the other stick: in a menu it jumps to the next thing to select (PadNav), elsewhere it scrolls the list under the cursor
        const ns = getInput(`stick@${this.otherStick()}:axis`) || { x: 0, y: 0 };
        if(!PadNav.update(ns.x || 0, ns.y || 0) && Math.abs(ns.y || 0) > 0.35) scroll += ns.y * 14;
        if(scroll) this._scroll = Math.max(-2, Math.min(2, this._scroll + scroll * dt));
        else this._scroll = 0;
        this.moveTo(this.x, this.y);
    },
    /** The stick that doesn't move the cursor ('left' / 'right'): menu navigation (PadNav). */
    otherStick(){ return Binds.get('cursor', 'controller') === 'stick@right' ? 'left' : 'right'; },
    /** Put the cursor at (x, y) on screen; the mouse follows it. */
    moveTo(x, y){
        this.x = Math.max(0, Math.min(width - 1, x)); this.y = Math.max(0, Math.min(height - 1, y));
        mouse.rawX = Cursor.padX = this.x; mouse.rawY = Cursor.padY = this.y;
        mouse.x = this.x + World.camera.x; mouse.y = this.y + World.camera.y;
    },
    wake(){
        this.active = true;
        this.x = Math.max(0, Math.min(width - 1, mouse.rawX || width / 2));
        this.y = Math.max(0, Math.min(height - 1, mouse.rawY || height / 2));
        Cursor.pad = true;
    },
    sleep(){ this.active = false; this.wheelPick = null; Cursor.pad = false; },   // (Cursor.set shows the real cursor again and hides the controller's)
    /** Whole list rows the right stick scrolled since last asked. */
    takeScroll(){ const n = Math.trunc(this._scroll); this._scroll -= n; return n; },
    /** Controller inputs held right now (a stick counts when pushed most of the way). */
    held(){
        const out = new Set();
        if(!this.connected()) return out;
        for(const inp of PAD_INPUTS){
            if(inp.startsWith('stick@')){ const a = getInput(inp + ':axis'); if(a && Math.hypot(a.x || 0, a.y || 0) > 0.7) out.add(inp); }
            else if(getInput(inp)) out.add(inp);
        }
        return out;
    },
    /** The Controls panel starts listening: what's held now (the trigger that clicked the bind) doesn't count. */
    startCapture(){ this._captured = this.held(); },
    /** A controller input pressed since listening started (or since it was let go), or null. */
    capture(){
        const h = this.held();
        let got = null;
        for(const inp of h) if(!this._captured.has(inp)){ got = inp; break; }
        this._captured = h;
        return got;
    },
};
window.addEventListener('mousemove', e => { if(Pad.active && InputDevice.mode !== 'controller' && (e.movementX || e.movementY)) Pad.sleep(); });   // the real mouse takes over again
// Input device 'controller' (InputDevice.blocksMouse): the real mouse's events stop here, in the capture phase on window,
// before the engine's Mouse (mouse.rawX / rawY, buttons, wheel), p5, the text boxes and the game's own listeners get them.
// While the Controls panel waits for a keyboard-page bind, mouse buttons still get through (they can be bound).
for(const type of ['mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu']){
    window.addEventListener(type, e => {
        if(!InputDevice.blocksMouse()) return;
        if(Binds.listening && Binds.device === 'keyboard' && type !== 'mousemove' && type !== 'wheel') return;
        e.stopImmediatePropagation();
        if(type === 'contextmenu' || type === 'wheel' || (type === 'mousedown' && e.button === 1)) e.preventDefault();   // no menu, page scroll or auto-scroll either
    }, { capture: true, passive: false });
}

/**
 * Menus with a controller, the way console games do them. While a menu is open (the action wheel, the backpack,
 * a station, the item menu, the pause / settings menus, the level-up pick, the start menu), the stick that doesn't
 * move the cursor (the right stick by default, Pad.otherStick) puts the cursor on the next thing that can be selected:
 *   - the action wheel: the option in the direction the stick points (straight up = the option drawn straight above
 *     the cell), like an emote wheel. It stays picked when the stick is let go (Pad.wheelPick: drawWheel keeps the
 *     cursor on it while the wheel moves with the camera); moving the cursor stick drops it;
 *   - other menus: the nearest slot, button, slider or recipe row that way (held, it repeats). At the top / bottom row
 *     of a recipe list the list scrolls before the cursor leaves it; on a slider, left / right move it a step.
 * The controller's `interact` bind (A) selects what the cursor is on, like a left click (Keys.update). With only the
 * backpack / a station open and the cursor over the world, it still opens / closes stations as usual.
 * With a station open, the bumpers (`hotbarprev` / `hotbarnext`) switch between the backpack and the station instead
 * of changing the hotbar slot; each side keeps the slot it was left on.
 */
const PadNav = {
    dir: null, next: 0,   // the direction the stick is held ('L' 'R' 'U' 'D') and when it repeats (performance.now ms)
    last: {},             // where the cursor was left on each side ('inv' / 'station'): { ref } for a slot, else { x, y }
    sliders: ['slider', 'itemSlider', 'dumpSlider'],
    /** A menu the controller can go through is open. */
    open(){
        return !!(Menu.active || GameUI.paused || GameUI.choice || GameUI.wheel || GameUI.inventoryOpen || GameUI.station || GameUI.itemMenu || GameUI.confirmDelete);
    },
    on(){ return Pad.active && !Binds.listening && this.open(); },
    /** The controller's interact button selects (a left click) right now instead of interacting (see Keys.update). */
    clicks(){
        if(!this.on()) return false;
        if(Menu.active || GameUI.paused || GameUI.choice || GameUI.wheel || GameUI.itemMenu || GameUI.confirmDelete) return true;
        return !!uiHit(Pad.x, Pad.y);   // the backpack / a station: on the HUD it clicks, over the world it interacts as usual
    },
    /** A station is open with the backpack: the bumpers switch between the two (not the hotbar slot). */
    panels(){
        return !!(Pad.active && GameUI.station && GameUI.inventoryOpen && !GameUI.wheel && !GameUI.itemMenu && !GameUI.confirmDelete && !GameUI.paused && !GameUI.choice);
    },
    /** Pad.update, every tick, with the other stick's position. Returns true while it's going through a menu. */
    update(sx, sy){
        if(!GameUI.wheel) Pad.wheelPick = null;
        if(!this.on()){ this.dir = null; return false; }
        const m = Math.hypot(sx, sy), now = performance.now();
        if(GameUI.wheel){ this.dir = null; if(m > 0.5) this.pickWheel(sx, sy); return true; }
        if(m < 0.35) this.dir = null;
        else if(m > 0.6 || this.dir){
            let d = Math.abs(sx) >= Math.abs(sy) ? (sx > 0 ? 'R' : 'L') : (sy > 0 ? 'D' : 'U');
            const v = { L: -sx, R: sx, U: -sy, D: sy };
            if(this.dir && d !== this.dir && v[this.dir] > 0.35 && v[d] < v[this.dir] + 0.25) d = this.dir;   // near a diagonal: keep going the same way
            if(d !== this.dir){ this.dir = d; this.next = now + 320; this.step(d); }
            else if(now >= this.next){ this.next = now + 110; this.step(d); }
        }
        this.remember();
        return true;
    },
    /** One push of the stick in a menu ('L' 'R' 'U' 'D'). */
    step(d){
        const dx = d === 'R' ? 1 : d === 'L' ? -1 : 0, dy = d === 'D' ? 1 : d === 'U' ? -1 : 0;
        const list = this.targets();
        if(!list.length) return;
        const cur = this.at(list);
        if(!cur){   // not on anything yet: the nearest one that way when the cursor is on a menu, else where the menu starts
            const to = (uiHit(Pad.x, Pad.y) && this.toward({ x: Pad.x, y: Pad.y, w: 0, h: 0 }, list, dx, dy)) || this.landing(list);
            if(to) this.focus(to);
            return;
        }
        if(dx && this.sliders.includes(cur.kind)){ this.slide(cur, dx); return; }
        const to = this.toward(cur, list, dx, dy), box = dy ? this.listOf(cur) : null;
        if(box && (!to || this.listOf(to) !== box)){   // the end of a recipe list: it scrolls before the cursor leaves it
            const s = GameUI.scroll[box.scroll] || 0;
            if(dy < 0 ? s > 0 : s < (box.maxScroll || 0)){ GameUI.scroll[box.scroll] = s + dy; return; }
        }
        if(to) this.focus(to);
    },
    /** What the cursor can land on: the slots, buttons, sliders and recipe rows (of lists without craft buttons) of the menu on top. */
    targets(){
        const R = GameUI.regions;
        let from = 0;   // a pop-up (the pause menu, the level-up pick, the item menu...) hides what's under it
        for(let k = R.length - 1; k >= 0; k--) if(R[k].kind === 'pauseScreen' || R[k].kind === 'itemMenu'){ from = k; break; }
        const out = [];
        for(let k = from; k < R.length; k++){
            const r = R[k];
            if(r.kind === 'slot' || r.kind === 'button' || this.sliders.includes(r.kind) || (r.kind === 'recipe' && !r.hasButton)) out.push(r);
        }
        return out;
    },
    /** The target under the cursor (the top one), or null. */
    at(list){
        for(let k = list.length - 1; k >= 0; k--){
            const r = list[k];
            if(Pad.x >= r.x && Pad.x <= r.x + r.w && Pad.y >= r.y && Pad.y <= r.y + r.h) return r;
        }
        return null;
    },
    /** The next target from box `cur` in direction (dx, dy): the nearest one in line ahead, else the nearest that way. */
    toward(cur, list, dx, dy){
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        let best = null, bestScore = Infinity;
        for(const r of list){
            if(r === cur) continue;
            if((r.x + r.w / 2 - cx) * dx + (r.y + r.h / 2 - cy) * dy < 4) continue;   // its middle isn't that way
            // the gap between the two boxes that way, and beside it (0 when they share a row / column)
            const gap = Math.max(0, dx > 0 ? r.x - (cur.x + cur.w) : dx < 0 ? cur.x - (r.x + r.w) : dy > 0 ? r.y - (cur.y + cur.h) : cur.y - (r.y + r.h));
            const side = dx ? Math.max(0, Math.max(r.y, cur.y) - Math.min(r.y + r.h, cur.y + cur.h))
                            : Math.max(0, Math.max(r.x, cur.x) - Math.min(r.x + r.w, cur.x + cur.w));
            const off = dx ? Math.abs(r.y + r.h / 2 - cy) : Math.abs(r.x + r.w / 2 - cx);
            const score = (side <= gap * 1.2 + 4 ? 0 : 1e6) + gap + side * 2.5 + off * 0.01;   // ahead (within ~50°) first
            if(score < bestScore){ bestScore = score; best = r; }
        }
        return best;
    },
    /** The scrolling list (a recipe list) the target is in, or null. */
    listOf(r){
        const x = r.x + r.w / 2, y = r.y + r.h / 2;
        return GameUI.regions.find(p => p.kind === 'panel' && p.scroll && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) ?? null;
    },
    /** Put the cursor on a target (a slider: on its knob, so selecting it doesn't move it). */
    focus(r){ Pad.moveTo(this.knobX(r) ?? r.x + r.w / 2, r.y + r.h / 2); },
    knobX(r){
        if(r.kind === 'slider'){ const S = SLIDERS[r.id]; return r.sx + (S.get() - S.min) / (S.max - S.min) * r.sw; }
        const im = GameUI.itemMenu, it = im && refItem(im.ref);
        if(!it) return null;
        if(r.kind === 'itemSlider'){ const L = itemMenuLayout(im); return L.sx + (it.count > 2 ? (im.amount - 1) / (it.count - 2) : 0) * L.sw; }
        if(r.kind === 'dumpSlider' && im.dumpSlider){
            const w = waterOf(it), n = dumpAmount(im, w);
            return im.dumpSlider.sx + (w.value > 1 ? (n - 1) / (w.value - 1) : 1) * im.dumpSlider.sw;
        }
        return null;
    },
    /** Left / right on a slider: one step. */
    slide(r, dx){
        if(r.kind === 'slider'){
            const S = SLIDERS[r.id];
            S.set(Math.max(S.min, Math.min(S.max, S.get() + dx * S.step)));
            Settings.save();
        } else {
            const im = GameUI.itemMenu, it = im && refItem(im.ref);
            if(!it) return;
            if(r.kind === 'itemSlider') im.amount = Math.max(1, Math.min(it.count - 1, im.amount + dx));
            else { const w = waterOf(it); if(w && w.value > 0) im.dump = Math.max(1, Math.min(w.value, dumpAmount(im, w) + dx)); }
        }
        this.focus(r);
    },
    /** Where a menu starts: the open station's first slot, else the backpack's, else the first slot / button. */
    landing(list){
        if(this.panels()){ const r = this.sideTarget('station', list); if(r) return r; }
        const inv = player.inventory;
        return list.find(r => r.kind === 'slot' && r.ref.box === inv && !inv.isHotbarSlot(r.ref.i))
            || this.first(list.filter(r => r.kind === 'slot')) || this.first(list.filter(r => !r.close)) || list[0];
    },
    /** The first target in reading order (the top row, then left to right). */
    first(list){
        let best = null;
        for(const r of list) if(!best || r.y < best.y - 8 || (Math.abs(r.y - best.y) <= 8 && r.x < best.x)) best = r;
        return best;
    },
    /** Which side a target is on while a station is open: 'station', 'inv' (the backpack, gear and hotbar) or null. */
    sideOf(r, S = stationLayout(), I = inventoryLayout()){
        const x = r.x + r.w / 2, y = r.y + r.h / 2, inside = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
        if(inside(S)) return 'station';
        return inside({ x: I.x - 72, y: I.y, w: I.w + 72, h: I.h }) || inside(wheelHotbarRect()) ? 'inv' : null;
    },
    /** A side's target: where the cursor was left there, else its first slot (the backpack's first, on the backpack side). */
    sideTarget(side, list){
        const S = stationLayout(), I = inventoryLayout(), mine = list.filter(r => this.sideOf(r, S, I) === side), m = this.last[side];
        const back = m && (m.ref ? mine.find(r => r.kind === 'slot' && sameRef(r.ref, m.ref))
                                 : mine.find(r => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h));
        if(back) return back;
        const inv = player.inventory;
        return (side === 'inv' && mine.find(r => r.kind === 'slot' && r.ref.box === inv && !inv.isHotbarSlot(r.ref.i)))
            || this.first(mine.filter(r => r.kind === 'slot')) || this.first(mine.filter(r => !r.close)) || null;
    },
    /** A bumper with a station open: over to the other side (from neither side: LB goes to the backpack, RB to the station). */
    switchPanel(dir){
        const list = this.targets(), cur = this.at(list), side = cur ? this.sideOf(cur) : null;
        const r = this.sideTarget(side ? (side === 'inv' ? 'station' : 'inv') : (dir < 0 ? 'inv' : 'station'), list);
        if(r) this.focus(r);
    },
    /** Every tick in a menu: remember where the cursor is on each side (for switchPanel). */
    remember(){
        if(!this.panels()) return;
        const cur = this.at(this.targets()), side = cur && this.sideOf(cur);
        if(side) this.last[side] = cur.kind === 'slot' ? { ref: cur.ref } : { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 };
    },
    /** The action wheel: the option in the direction the stick points (by where each option is drawn around the cell). */
    pickWheel(sx, sy){
        const rs = GameUI.wheelRects;
        if(!rs || !rs.length) return;
        const a = Math.atan2(sy, sx);
        let k = 0, bd = Infinity;
        rs.forEach((r, j) => { const d = Math.abs(Math.atan2(Math.sin(a - r.a), Math.cos(a - r.a))); if(d < bd){ bd = d; k = j; } });
        Pad.wheelPick = k;
        Pad.moveTo(rs[k].x + rs[k].w / 2, rs[k].y + rs[k].h / 2);
    },
};

/**
 * Edge detection over getInput (pressed this tick / released this tick). Actions: 'default@<action>', true when
 * its keyboard bind OR its controller bind is down. The controller's `move` / `wheel` binds also count as the
 * left / right mouse buttons (menu clicks), and so does its `interact` bind in a menu (PadNav.clicks: then it isn't
 * `default@interact`); `realPressed` reads the real mouse only. The controller's sneak bind
 * toggles Pad.sneak instead of being held.
 */
const Keys = {
    fixed: ['key@shift', 'mouse@left', 'mouse@right', 'mouse@middle'],   // UI clicks and the Shift+click modifier
    now: {}, prev: {}, real: {}, realPrev: {}, pad: {}, padPrev: {},
    mute: new Set(),   // inputs ignored until they're let go (a key / button just bound in the Controls panel)
    update(){
        this.prev = this.now; this.now = {};
        this.realPrev = this.real; this.real = {};
        this.padPrev = this.pad; this.pad = {};
        for(const m of [...this.mute]) if(!getInput(m)) this.mute.delete(m);
        Pad.update();
        DoubleClick.check();
        const down = input => !!input && !this.mute.has(input) && !!getInput(input);
        const padOn = Pad.enabled(), kbOn = InputDevice.keyboard();   // the devices the Input device setting listens to
        // in a menu the controller's interact button selects (a left click), from its press until it's let go (PadNav.clicks)
        const sel = padOn && down(Binds.get('interact', 'controller'));
        if(!sel) this.select = false;
        else if(!this._selWas && PadNav.clicks()) this.select = true;
        this._selWas = sel;
        for(const a of Binds.buttonActions){
            const kb = kbOn && Binds.actions.includes(a) ? Binds.get(a) : null;
            const pb = padOn && Binds.padActions.includes(a) ? Binds.get(a, 'controller') : null;
            let v = down(kb) || (!!DoubleClick.press && kb === DoubleClick.press);
            this.pad[a] = down(pb) && !(a === 'interact' && this.select);
            if(a !== 'sneak') v = v || this.pad[a];
            this.now['default@' + a] = v;
        }
        for(const k of this.fixed){ this.real[k] = down(k); this.now[k] = kbOn && this.real[k]; }   // (real: the Controls panel catches mouse binds from it)
        this.now['mouse@left']  = this.now['mouse@left']  || !!this.pad.move || this.select;    // the controller clicks menus too
        this.now['mouse@right'] = this.now['mouse@right'] || !!this.pad.wheel;
        // the controller's sneak: press to start, press again to stop (it needs the Hunter skill)
        if(this.pad.sneak && !this.padPrev.sneak && skillLevel('hunter') > 0) Pad.sneak = !Pad.sneak;
    },
    down(k){ return !!this.now[k]; },
    pressed(k){ return !!this.now[k] && !this.prev[k]; },
    released(k){ return !this.now[k] && !!this.prev[k]; },
    /** The real mouse / keyboard only (not the controller standing in for the mouse buttons). */
    realPressed(k){ return !!this.real[k] && !this.realPrev[k]; },
};
/**
 * Double-click = right-click, for trackpads without a right button. A left click on the world
 * (not on a menu, slot or button, and not one that closes the wheel / calendar) waits `wait` ms:
 *   - a second click within that time -> only the action bound to 'mouse@right' is pressed
 *     (the action wheel by default); the first click does nothing;
 *   - otherwise -> the action bound to 'mouse@left' is pressed then (walking by default),
 *     at the spot that was clicked, even if the mouse has moved since.
 * Either way it's a one-tick press of the 'default@<action>' input (see Keys.update), and
 * DoubleClick.at holds the clicked world position for that tick. Menu clicks are never delayed.
 * The wait is a setting (pause menu > Settings, Settings.data.doubleClickMs); 0 turns it all off.
 */
const DoubleClick = {
    /** ms a world click waits for a second click (0 = no waiting and no double-click). */
    get wait(){ const R = Settings.doubleClickRange, v = Number(Settings.data.doubleClickMs); return Number.isFinite(v) ? Math.max(R.min, Math.min(R.max, v)) : 150; },
    clicks: [],     // left mousedown times since the last tick
    held: null,     // a world click waiting for its second click: { t, x, y } (world coords)
    press: null,    // this tick: 'mouse@left' | 'mouse@right', the button whose actions are pressed
    at: null,       // this tick, for a delayed left click: where it was clicked { x, y }
    /** Keys.update(): pair clicks up and decide what is pressed this tick. */
    check(){
        this.press = this.at = null;
        const t = this.clicks.length ? this.clicks[this.clicks.length - 1] : null;
        this.clicks.length = 0;
        const consoleBlocks = typeof DevConsole !== 'undefined' && DevConsole.blocksInput && DevConsole.blocksInput('mouse');
        const onWorld = !Menu.active && !GameUI.paused && !GameUI.choice && !GameUI.itemMenu && !GameUI.confirmDelete
            && !GameUI.wheel && !GameUI.calendar && !Binds.listening && !consoleBlocks && !uiHit(mouse.rawX, mouse.rawY);
        if(t != null){
            if(this.held && onWorld && t - this.held.t <= this.wait){   // the second click: right-click
                this.held = null;
                this.press = 'mouse@right';
                Keys.mute.add('mouse@left');
                return;
            }
            if(this.held) this.release();   // a click elsewhere: the waiting one goes through now
            if(onWorld && this.wait > 0){ this.held = { t, x: mouse.x, y: mouse.y }; Keys.mute.add('mouse@left'); }
            return;
        }
        if(this.held && performance.now() - this.held.t > this.wait) this.release();
    },
    /** The waiting click had no second one: it's a left click where it was made. */
    release(){
        this.press = 'mouse@left';
        this.at = { x: this.held.x, y: this.held.y };
        this.held = null;
    },
};
window.addEventListener('mousedown', e => { if(e.button === 0) DoubleClick.clicks.push(performance.now()); });
const _wheelInput = { steps: 0 };
window.addEventListener('wheel', e => { if(e.deltaY) _wheelInput.steps += Math.sign(e.deltaY); }, { passive: true });
window.addEventListener('keydown', e => {
    const name = e.key === ' ' ? 'space' : String(e.key).toLowerCase();
    if(Binds.listening){   // the Controls panel is waiting for a key: this one is the new bind
        e.preventDefault();
        if(Binds.device === 'controller'){ if(name === 'escape') Binds.cancel(); return; }   // (the controller page waits for a controller button)
        if(!e.repeat && !['dead', 'process', 'unidentified', 'compose'].includes(name)) Binds.capture('key@' + name);
        return;
    }
    const typing = typeof uiTextBox !== 'undefined' && uiTextBox.blocksInput('key');
    // keep Tab (and any key bound to an action) for the game instead of the browser
    if(e.key === 'Tab' || (!typing && !e.ctrlKey && !e.metaKey && Binds.owner('key@' + name))) e.preventDefault();
});
window.addEventListener('mousedown', e => { if(e.button === 1) e.preventDefault(); });   // the middle button can be bound: no auto-scroll

/** A toast. A newline (\n) in the text starts a new line; ms = how long it stays (default 3 s). */
function notify(text, color = '#ffffff', ms = 3000){
    const toast = { text, color, until: performance.now() + ms };
    GameUI.toasts.push(toast);
    if(GameUI.toasts.length > 5) GameUI.toasts.shift();
    return toast;
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
    if(!opt.enabled){ notify(opt.reason || T('wheel.notPossible'), '#ff8a7a'); return; }
    GameUI.wheel = null;
    Act.combat = null;
    opt.run();
}
/**
 * Left-click quick action for the held item: walk next to the cell and use it there, no wheel.
 *   - fishing rod on water: cast (any click reels in while the line is out)
 *   - a creature: its action when you hold what it needs (bucket on a cow: milk), otherwise attack
 *   - canteen / bucket on a water cell or puddle: fill it
 *   - seeds on farmland: plant one
 *   - a block item (walls, torches, workbenches, chests, boats on water...): place it
 *   - hoe on a crop / fern: harvest it (or clear it when rotten); hoe on bare grass: till it
 *   - shovel on an emptied water cell: fill it in; shovel on bare floor: dig dirt / sand
 *     (cave floor with a pickaxe is wheel only)
 *   - a tool on a block of its class: mine / chop / dig it (pickaxe -> stone / ore,
 *     axe -> trees / wood, shovel -> soil). Plants and farmland are left to the wheel (right click).
 * Returns { label, run } (doable), { label, reason } (not possible right now)
 * or null (nothing for this tool here, so left click just moves there: moveToward).
 */
function quickActionFor(x, y, wx = null, wy = null){
    // Fishing rod: with the line out any click reels it in; a click on water casts there (walking closer when out of reach)
    const rod = heldItem();
    if(rodStats(rod)){
        if(Fishing.line) return { label: T('fish.reelLabel'), run: () => reelIn() };
        const g = Theaya.zone.inBounds(x, y) ? groundAt(x, y) : null, pc = playerCell();
        if(g && g.water && pc && !(pc.x === x && pc.y === y)){
            const why = fishWaterReason(x, y);
            return why ? { label: castLabel(rod), reason: why } : { label: castLabel(rod, x, y), run: () => castLine(x, y) };
        }
    }
    // A creature: its own action when you hold what that action needs (a bucket on a cow: milk it), otherwise attack it
    const mob = wx != null ? (Mobs.nearPoint(wx, wy) || Mobs.at(x, y)) : (Theaya.zone.inBounds(x, y) ? Mobs.at(x, y) : null);
    if(mob) return heldCreatureAction(mob, heldItem()) || attackActionFor(mob);
    if(!Theaya.zone.inBounds(x, y)) return null;
    const pc = playerCell();
    if(!pc) return null;
    const held = heldItem(), cell = { x, y }, b = blockAt(x, y), def = b && Blocks.get(b.id);
    const near = fn => () => (hexDist(pc, cell) === 0 && !blocksMover(def, 'player')) ? fn() : doNear(cell, fn);
    // Something to pick up by hand (eggs): whatever you're holding
    if(def && def.kind === 'pickup') return { label: pickUpLabel(b), run: near(() => pickUpBlock(x, y)) };
    // Canteen / bucket on a water cell or puddle: walk over and fill it
    const w = waterOf(held);
    if(w && (!def || def.replaceable)){
        const src = waterSourceAt(x, y);
        if(src){
            const label = T(src.kind === 'puddle' ? 'wheel.fillPuddle' : 'wheel.fill', { item: nameOf(held.id), n: src.left, max: src.max });
            if(src.left <= 0) return { label, reason: T('water.sourceDryShort') };
            if(w.full) return { label, reason: T('water.isFull', { item: nameOf(held.id) }) };
            return { label, run: near(() => fillContainer(x, y)) };
        }
    }
    // Seeds on farmland: plant one
    if(held instanceof CropSeedItem && def && def.kind === 'farmland'){
        const why = plantReason(b, held), label = T('wheel.plant', { crop: nameOf(held.crop), n: b.seeds.items.filter(Boolean).length, max: FARM.slots });
        return why ? { label, reason: why } : { label, run: near(() => plantSeed(x, y)) };
    }
    // A block (walls, torches, workbenches, chests, boats...): place it there
    if(held instanceof BlockItem && Blocks.get(held.block)){
        const bd = Blocks.get(held.block), g = groundAt(x, y), label = T('wheel.place', { item: nameOf(held.id) });
        if(bd.kind === 'boat') return g && g.water && !def ? { label, run: near(() => placeBlock(x, y)) } : { label, reason: T('wheel.boatOnWater') };
        if(def && !def.replaceable) return null;   // something's there already: left click just walks over
        if(!g || !g.passable) return { label, reason: T('wheel.cantBuild') };
        if(hexDist(pc, cell) === 0 && blocksMover(bd, 'player')) return { label, reason: T('place.standingThere') };
        return { label, run: near(() => placeBlock(x, y)) };
    }
    const m = held && typeof held.get === 'function' ? held.get('mining') : null;
    if(!m || held.isBroken) return null;
    if(isHoe(held)){
        const info = plantInfo(b);
        if(info){
            const name = nameOf(info.crop.id);
            if(info.rot) return { label: T('wheel.clearRotten', { crop: name }), run: near(() => harvestPlant(x, y)) };
            if(info.stage && info.stage.yield[1] > 0){
                const tier = canHarvestTier(info.crop, held);
                return tier.ok ? { label: T('wheel.harvest', { crop: name }), run: near(() => harvestPlant(x, y)) } : { label: T('wheel.harvest', { crop: name }), reason: tier.reason };
            }
        }
        if(def && def.kind === 'farmland'){ const hl = farmHarvestLabel(b); if(hl) return { label: hl, run: near(() => harvestFarmland(x, y)) }; }
        if(def && def.kind === 'fern') return { label: T('wheel.gatherFibers'), run: near(() => harvestFern(x, y)) };
        if(!def || def.replaceable){
            const g = groundAt(x, y);
            if(g && g.passable){
                const can = canTill(x, y);
                return can.ok ? { label: T('quick.till'), run: near(() => startTill(x, y)) } : { label: T('quick.till'), reason: can.reason };
            }
        }
    }
    // Shovel on a water cell with no water left: fill it in with sand
    if(isShovel(held) && !def){ const gw = groundAt(x, y); if(gw && gw.water && (Theaya.water[cellIndex(x, y)] ?? 0) <= 0) return { label: fillWaterLabel(x, y, held), run: near(() => startFillWater(x, y)) }; }
    // Shovel on bare floor: dig up dirt or sand. (Cave floor needs a pickaxe and is only on the wheel: a pickaxe
    // click there would be too easy to do by accident while walking around a cave.)
    const fd = !def && floorDigAt(x, y), fi = cellIndex(x, y);
    // ...dug down to nothing: lay a foundation there instead
    if(fd && isShovel(held) && !isFoundation(fi) && floorStockAt(fi) <= 0){
        const kind = quickFoundationKind(), can = canFoundation(x, y, held, kind);   // the wheel offers both kinds
        return can.ok ? { label: foundationLabel(held, kind), run: near(() => startFoundation(x, y, kind)) } : { label: foundationLabel(held, kind), reason: can.reason };
    }
    if(fd && fd.tool !== 'pickaxe' && hasToolClass(held, fd.tool) && !isFoundation(fi)){
        return { label: digLabel(held, x, y), run: near(() => startDigGrass(x, y)) };
    }
    // Mining: only with the block's own tool class (an axe on trees, a pickaxe on stone...),
    // and never plants / farmland (crops would get dug up by accident; use the wheel for that).
    if(def && !def.replaceable && def.kind !== 'plant' && def.kind !== 'farmland' && def.tool && m.classes.includes(def.tool)){
        const label = T('action.verbBlock', { verb: verbFor(def), block: def.name }), info = miningInfo(def, held);
        if(!info.ok) return { label, reason: info.reason };
        if(!info.fits) return null;
        if(containerBusy(b)) return { label, reason: T('container.emptyFirstShort', { name: def.name }) };
        return { label: label + T('wheel.secs', { secs: info.time.toFixed(1) }), run: near(() => startMine(x, y)) };
    }
    return null;
}
function cancelAll(){
    reelIn();
    Act.combat = null;
    GameUI.wheel = null;
    Act.job = null;
    areaZones.home.stopMove(player);
}

/** The block of the open forge / chest, or null. */
function openContainer(){
    const s = GameUI.station;
    if(!s || CRAFT_STATIONS.includes(s.kind) || PANEL_STATIONS[s.kind]) return null;
    return blockAt(s.x, s.y);
}
/** Put on the armor at ref (swaps with what was worn). */
function equipArmor(ref){
    const item = refItem(ref), slot = armorSlotOf(item);
    if(!slot) return false;
    moveOrSwapRef(ref, slotRef(player.gear[slot], 0));
    notify(T('armor.wearing', { item: nameOf(item.id), def: playerDefense() }), '#a6f0a0');
    return true;
}
function unequipArmor(ref){
    const item = refItem(ref);
    if(!item) return false;
    if(player.inventory.give(item) !== 0){ notify(T('inv.noRoomBackpack'), '#ffb070'); return false; }
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
        else if(ref.box === inv){ inv.quickMove(ref.i); Tutorial.flags.moved = true; }
        return;
    }
    if(ref.box !== inv && ARMOR_SLOTS.some(s => player.gear[s] === ref.box)){ unequipArmor(ref); return; }
    if(ref.box !== inv){                                    // container -> inventory
        if(inv.give(item) === 0) ref.box.setSlot(ref.i, null);
        ref.box.changed();
        if(item.count > 0 && refItem(ref)) notify(T('inv.notEnoughRoom'), '#ffb070');
        return;
    }
    let targets;
    if(c.box) targets = [c.box];
    else if(c.seeds){   // farmland: seeds into the seedling slots (one each), a bucket / canteen into the water slot
        targets = [c.seeds.accepts(item) ? c.seeds : null, c.intake.accepts(item) ? c.intake : null].filter(Boolean);
        if(!targets.length && item instanceof CropSeedItem){ notify(plantReason(c, item) ?? T('farm.seedsCantGo'), '#ffb070'); return; }
    }
    else {
        const fuelOk = !(MACHINES[GameUI.station.kind] || {}).noFuel && c.fuel.accepts(item) && (!c.fuel.getSlot(0) || c.fuel.getSlot(0).canStackWith(item));
        targets = [fuelOk ? c.fuel : null, c.input.accepts(item) ? c.input : null].filter(Boolean);
    }
    if(!targets.length){ notify(T('station.cantGoIn', { station: STATION_TITLES[GameUI.station.kind].toLowerCase() }), '#ffb070'); return; }
    for(const box of targets){
        if(box.give(item) === 0){ inv.setSlot(ref.i, null); break; }
    }
    inv._changed({ event:'quickMove' });
    if(refItem(ref)) notify(T('inv.noRoomAll'), '#ffb070');
}

/* ----- Item menu (right-click a stack in the inventory): split slider, item actions (eat / drink, pour water
 *       bucket <-> canteen, see itemMenuActions) + delete (with a confirm pop-up) ----- */
/** Move `n` of the stack at ref into the first empty slot of the same container. */
function splitAmountRef(r, n){
    const it = refItem(r);
    if(!it || it.count < 2) return false;
    n = Math.max(1, Math.min(it.count - 1, Math.floor(n)));
    if(r.box === player.inventory){
        const inv = player.inventory, t = inv._firstEmpty();
        if(t == null) return false;
        inv[t] = it.split(n);
        inv._changed({ event:'split', slot:r.i, to:t });
        return true;
    }
    for(let k = r.box.firstSlot; k <= r.box.lastSlot; k++){
        if(!r.box.getSlot(k)){ r.box.setSlot(k, it.split(n)); r.box.changed(); return true; }
    }
    return false;
}
function openItemMenu(ref, mx, my){
    const it = refItem(ref);
    if(!it) return;
    GameUI.picked = null; GameUI.press = null;
    GameUI.itemMenu = { ref, x: mx, y: my, amount: Math.max(1, Math.floor(it.count / 2)), dragging: false };
}
function closeItemMenu(){ GameUI.itemMenu = null; GameUI.confirmDelete = null; }
function deleteRef(ref){
    const it = refItem(ref);
    if(!it) return;
    ref.box.setSlot(ref.i, null);
    ref.box.changed({ event:'delete' });
    notify(T('itemMenu.deleted', { items: it.count > 1 ? T('item.count', { n: it.count, name: nameOf(it.id) }) : nameOf(it.id) }), '#ffb070');
}
/** The first canteen / bucket (cls) in your inventory, other than `item`, that still has room for water; or null. */
function waterTarget(item, cls){
    const inv = player.inventory;
    for(let k = 1; k <= inv.slots; k++){ const it = inv[k], w = it instanceof cls && it !== item ? waterOf(it) : null; if(w && !w.full) return it; }
    return null;
}
/** Pour as much water as fits from one canteen / bucket into another. */
function pourWater(from, to){
    const a = waterOf(from), b = waterOf(to);
    if(!a || !b) return;
    const n = Math.min(a.value, b.capacity - b.value);
    if(n <= 0){ notify(a.empty ? T('water.isEmptyDot', { item: nameOf(from.id) }) : T('water.isFullDot', { item: nameOf(to.id) }), '#ffb070'); return; }
    a.value -= n; b.value += n;
    notify(T('water.poured', { n, to: nameOf(to.id), tv: b.value, tc: b.capacity, from: nameOf(from.id), fv: a.value, fc: a.capacity }), '#8fd0ff');
}
/** Extra buttons of the item menu for this item: [{ label, enabled, run, color }]. */
function itemMenuActions(it, ref){
    const acts = [], w = waterOf(it);
    if(it.has && it.has('consume')) acts.push({ label: T(isDrink(it) ? 'use.drink' : 'use.eat', { item: nameOf(it.id) }) + (it.has('poisonous') ? T('itemMenu.mayPoison') : ''), enabled: true, run: () => useItem(it, ref), color: '#3d6f8f' });
    if(it instanceof Canteen) acts.push({ label: w.empty ? T('itemMenu.drinkEmpty') : T('use.drinkWater', { v: w.value, c: w.capacity }), enabled: !w.empty, run: () => useItem(it, ref), color: '#3d6f8f' });
    if(it instanceof Bucket){   // bucket -> canteen
        const t = waterTarget(it, Canteen), tw = t && waterOf(t);
        acts.push({ label: !t ? T('itemMenu.refillNone') : w.empty ? T('itemMenu.refillBucketEmpty') : T('itemMenu.refill', { v: tw.value, c: tw.capacity }),
                    enabled: !!t && !w.empty, run: () => pourWater(it, t), color: '#3a6a8a' });
    }
    if(it instanceof Canteen){  // canteen -> bucket
        const t = waterTarget(it, Bucket), tw = t && waterOf(t);
        acts.push({ label: !t ? T('itemMenu.fillBucketNone') : w.empty ? T('itemMenu.fillBucketCanteenEmpty') : T('itemMenu.fillBucket', { v: tw.value, c: tw.capacity }),
                    enabled: !!t && !w.empty, run: () => pourWater(it, t), color: '#3a6a8a' });
    }
    return acts;
}
/** Position and slider geometry of the open item menu (shared by drawing and input). */
function itemMenuLayout(im){
    const it = refItem(im.ref), w = 230, canSplit = !!(it && it.count >= 2);
    const acts = it ? itemMenuActions(it, im.ref).length : 0, dump = it instanceof Bucket;
    const h = (canSplit ? 176 : 100) + acts * 32 + (dump ? 78 : 0);
    const x = Math.max(8, Math.min(width - w - 8, im.x + 6)), y = Math.max(8, Math.min(height - h - 8, im.y + 6));
    return { x, y, w, h, canSplit, dump, sx: x + 16, sw: w - 32, sy: y + 72 };
}
/** How much water the bucket's "Dump water" slider is set to: all of it until the slider is moved. */
function dumpAmount(im, w){
    if(!w || w.value <= 0) return 0;
    return im.dump == null ? w.value : Math.max(1, Math.min(w.value, im.dump));
}
function setDumpAmount(im, mx){
    const w = waterOf(refItem(im.ref)), s = im.dumpSlider;
    if(!w || !s || w.value <= 0) return;
    const k = Math.max(0, Math.min(1, (mx - s.sx) / s.sw));
    im.dump = 1 + Math.round(k * (w.value - 1));
}
/** Pour n water out of a bucket onto the ground (it's gone). */
function dumpWater(item, n){
    const w = waterOf(item);
    n = Math.min(n, w ? w.value : 0);
    if(n <= 0){ notify(T('water.isEmptyDot', { item: nameOf(item.id) }), '#ffb070'); return; }
    w.value -= n;
    notify(T('water.dumped', { n, item: nameOf(item.id), v: w.value, c: w.capacity }), '#8fd0ff');
}
function setItemMenuAmount(im, mx){
    const it = refItem(im.ref), L = itemMenuLayout(im);
    if(!it || it.count < 2) return;
    const k = Math.max(0, Math.min(1, (mx - L.sx) / L.sw));
    im.amount = 1 + Math.round(k * (it.count - 2));
}
/** Input while the item menu / delete confirmation is open. Returns true when it used the input. */
function handleItemMenuInput(hit, mx, my){
    if(Keys.pressed('default@inventory') || !GameUI.inventoryOpen){ closeItemMenu(); return false; }
    if(GameUI.confirmDelete){
        if(Keys.pressed('default@close')) GameUI.confirmDelete = null;
        else if(Keys.pressed('mouse@left') && hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
        return true;
    }
    const im = GameUI.itemMenu, it = refItem(im.ref);
    if(!it){ closeItemMenu(); return false; }
    im.amount = Math.max(1, Math.min(Math.max(1, it.count - 1), im.amount));
    if(Keys.pressed('default@close')){ closeItemMenu(); return true; }
    if(Keys.pressed('mouse@right')){
        if(hit && hit.kind === 'slot' && refItem(hit.ref)) openItemMenu(hit.ref, mx, my); else closeItemMenu();
        return true;
    }
    if(Keys.pressed('mouse@left')){
        if(hit && hit.kind === 'itemSlider'){ im.dragging = true; setItemMenuAmount(im, mx); }
        else if(hit && hit.kind === 'dumpSlider'){ im.dragging = 'dump'; setDumpAmount(im, mx); }
        else if(hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
        else if(!(hit && hit.kind === 'itemMenu')) closeItemMenu();
        return true;
    }
    if(im.dragging){
        if(!Keys.down('mouse@left')) im.dragging = false;
        else if(im.dragging === 'dump') setDumpAmount(im, mx);
        else setItemMenuAmount(im, mx);
    }
    return true;
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
    Binds.cancel();   // a rebind waiting in the Controls panel
    GameUI.settingsOpen = false; GameUI.settingsView = null;
    theayaScene.pause = on;
    if(on){ GameUI.wheel = null; GameUI.press = null; GameUI.itemMenu = null; GameUI.confirmDelete = null; }
}
const togglePause = () => setPaused(!GameUI.paused);
/** The player looked away (another window focused / tab hidden): open the pause menu if a game is being played. */
function pauseOnLeave(){
    if(!Theaya.ready || Menu.active || GameUI.choice) return;   // start menu / level-up pick: nothing is running anyway
    setPaused(true);
}

/** Input while paused: only the menu (the pause / close keys and clicks on its buttons). */
function handlePausedInput(hit){
    if(Binds.listening){   // the Controls panel waits for a new bind (keys come in through the keydown listener)
        const cancelClick = Keys.realPressed('mouse@left') && hit && hit.kind === 'button' && hit.cancelsBind;
        if(cancelClick) Binds.cancel();
        else if(Binds.device === 'controller'){   // the controller page: the next controller button (or a stick, for the cursor)
            const got = Pad.capture();
            if(got && got === Binds.get('pause', 'controller')) Binds.cancel();   // the pause button (Menu) cancels
            else if(got) Binds.capture(got);
        }
        else if(Keys.realPressed('mouse@left')) Binds.capture('mouse@left');
        else if(Keys.realPressed('mouse@right')) Binds.capture('mouse@right');
        else if(Keys.realPressed('mouse@middle')) Binds.capture('mouse@middle');
        return;
    }
    if(Keys.pressed('default@close')){
        if(GameUI.settingsOpen && GameUI.settingsView) closeControls();   // Controls goes back to the settings
        else if(GameUI.settingsOpen) closeSettings();   // the settings menu goes back to the pause menu
        else if(GameUI.pauseView !== 'main') GameUI.pauseView = 'main';
        else setPaused(false);
        return;
    }
    if(GameUI.sliderDrag){   // dragging a slider (settings: double-click wait; controls: cursor speed)
        if(Keys.down('mouse@left')) setSliderAt(GameUI.sliderDrag, mouse.rawX);
        else { GameUI.sliderDrag = null; Settings.save(); }
        return;
    }
    if(Keys.pressed('mouse@left') && hit && hit.kind === 'slider'){
        GameUI.sliderDrag = { id: hit.id, sx: hit.sx, sw: hit.sw };
        setSliderAt(GameUI.sliderDrag, mouse.rawX);
        return;
    }
    if(Keys.pressed('mouse@left') && hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
}

function handleInput(){
    Keys.update();
    const consoleBlocks = typeof DevConsole !== 'undefined' && DevConsole.blocksInput && DevConsole.blocksInput('mouse');
    const mx = mouse.rawX, my = mouse.rawY;
    const hits = uiHitAll(mx, my), hit = hits[0] ?? null;

    if(GameUI.choice){   // level-up pick: click a card or press the hotbar keys 1 / 2 / 3, then confirm it
        const c = GameUI.choice;
        if(c.confirm && Keys.pressed('default@close')){ c.confirm = null; return; }   // back to the cards
        c.options.forEach((id, k) => {
            if(!HOTBAR_ACTIONS[k] || !Keys.pressed('default@' + HOTBAR_ACTIONS[k])) return;
            if(c.confirm === id) pickChoice(id);   // the same key again: confirm
            else selectChoice(id);
        });
        if(GameUI.choice && Keys.pressed('mouse@left') && hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
        return;
    }
    if(Keys.pressed('default@pause') && !Binds.listening){ togglePause(); return; }
    if(!GameUI.paused && Keys.pressed('default@skills')) GameUI.skillsOpen = !GameUI.skillsOpen;
    if(GameUI.paused){ handlePausedInput(hit); return; }
    if((GameUI.itemMenu || GameUI.confirmDelete) && handleItemMenuInput(hit, mx, my)) return;   // the item menu / delete pop-up is modal

    if(Keys.pressed('default@inventory')) toggleInventory();
    // Calendar: clicking anywhere off the clock / calendar folds it back up (that click does nothing else)
    let clickTaken = false;
    if(GameUI.calendar && (Keys.pressed('mouse@left') || Keys.pressed('mouse@right') || Keys.pressed('default@move') || Keys.pressed('default@wheel'))
        && !hits.some(r => r.kind === 'clock' || r.kind === 'calendar')){
        GameUI.calendar = null;
        clickTaken = true;
    }
    if(Keys.pressed('default@close')){
        if(GameUI.calendar) GameUI.calendar = null;
        else if(GameUI.wheel) GameUI.wheel = null;
        else if(GameUI.station) closeMenus();
        else if(GameUI.inventoryOpen) closeMenus();
        else if(GameUI.skillsOpen) GameUI.skillsOpen = false;
        else { setPaused(true); return; }   // nothing open to close: it opens the pause menu (like the pause key)
    }
    if(Keys.pressed('default@interact')) tryInteract();
    if(Keys.pressed('default@use')) useHeld();
    HOTBAR_ACTIONS.forEach((a, k) => { if(Keys.pressed('default@' + a)) GameUI.hotbar = k + 1; });
    // the controller's bumpers: the hotbar slot, or with a station open, over to the backpack / the station (PadNav)
    if(Keys.pressed('default@hotbarprev')){ if(PadNav.panels()) PadNav.switchPanel(-1); else GameUI.hotbar = (GameUI.hotbar + 5) % 7 + 1; }
    if(Keys.pressed('default@hotbarnext')){ if(PadNav.panels()) PadNav.switchPanel(1); else GameUI.hotbar = GameUI.hotbar % 7 + 1; }

    // Mouse wheel: scroll a list under the mouse, otherwise change hotbar slot. The controller's other stick scrolls lists only.
    const steps = consoleBlocks ? 0 : _wheelInput.steps, padSteps = Pad.takeScroll();
    _wheelInput.steps = 0;
    if(steps || padSteps){
        const list = hits.find(r => r.scroll);
        if(list) GameUI.scroll[list.scroll] = Math.max(0, GameUI.scroll[list.scroll] + steps + padSteps);
        else if(steps && !GameUI.wheel) GameUI.hotbar = (((GameUI.hotbar - 1 + steps) % 7) + 7) % 7 + 1;
    }

    // Menus, slots and buttons always take the left mouse button; the world takes the `move` / `wheel` binds
    // (by default the same left / right buttons, so a click on a menu never also walks).
    let handled = false;
    if(Keys.pressed('mouse@left') && !clickTaken){
        if(GameUI.wheel){
            if(hit && hit.kind === 'wheelOption') chooseOption(hit.option);
            else GameUI.wheel = null;
            handled = true;
        } else if(hit){
            if(hit.kind === 'clock') toggleCalendar();
            else if(hit.kind === 'slot') GameUI.press = { ref: hit.ref, x: mx, y: my, dragging: false, shift: Keys.down('key@shift') };
            // scroll bar: grab the thumb where it was clicked, or (on the track) jump so the thumb centers on the mouse
            else if(hit.kind === 'scrollbar') GameUI.scrollDrag = { key: hit.key, grab: my >= hit.thumbY && my <= hit.thumbY + hit.thumbH ? my - hit.thumbY : hit.thumbH / 2 };
            else if(hit.kind === 'button' && hit.enabled !== false) hit.onClick(Keys.down('key@shift'));
            handled = true;
        }
    }
    // a delayed world click (see DoubleClick) acts where it was clicked, even if the mouse is now over a menu
    const at = DoubleClick.at, px = at ? at.x : mouse.x, py = at ? at.y : mouse.y;
    if(Keys.pressed('default@move') && !clickTaken && !handled && !GameUI.wheel && (at || !hit) && !consoleBlocks){
        // Walk to the cell under the mouse; holding a fitting tool -> walk over and use it; a creature -> attack it
        const c = areaZones.home.toCell(px, py);
        const q = c ? quickActionFor(c.x, c.y, px, py) : null;
        Act.combat = null;
        if(!q){ if(c) moveToward(c.x, c.y); }
        else if(q.reason) notify(q.reason, '#ff8a7a');
        else q.run();
        handled = true;
    }
    if(GameUI.scrollDrag && !Keys.down('mouse@left')) GameUI.scrollDrag = null;   // let go of the scroll bar
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
    // right-click a stack: its item menu (a menu click, like the left button's)
    if(Keys.pressed('mouse@right') && !clickTaken && !GameUI.wheel && hit && hit.kind === 'slot'){
        if(GameUI.inventoryOpen && refItem(hit.ref)) openItemMenu(hit.ref, mx, my);
        handled = true;
    }
    if(Keys.pressed('default@wheel') && !clickTaken){
        if(GameUI.wheel){ if(!handled) GameUI.wheel = null; }
        else if(!handled && (at || !hit) && !consoleBlocks) openWheelAt(px, py);   // the full action wheel
    }
}

/** Every game tick (scene script). */
function gameTick(dt){
    if(!Theaya.ready) return;
    if(Menu.active){ handleMenuInput(); return; }   // the start menu: the world behind it waits
    if(!GameUI.paused) openChoice();   // a level-up is waiting for its skill / upgrade pick
    handleInput();
    if(GameUI.paused || GameUI.choice) return;   // the pause menu / level-up pick is open: nothing in the world moves
    if(Tutorial.active) Tutorial.tick();
    // walking speed follows Active Runner and sneaking right away (not just when a walk starts)
    const walk = areaZones.home._linked && areaZones.home._linked.get(player);
    if(walk && walk.move && walk.move.settings) walk.move.settings.speed = playerSpeed();
    if(!Tutorial.active) Clock.advance(dt);   // the tutorial's clock stands still (no nightfall, no weather changes)
    Weather.tick(dt);
    if(!Tutorial.active) tickSurvival(dt);   // the tutorial is calm: no hunger, thirst or monsters
    tickJob(dt);
    tickFishing(dt);
    tickBoat();
    tickWorld();
    tickPlants(dt);
    tickForges(dt);
    tickHeartStones(dt);
    Regrowth.tick(dt);
    if(!Tutorial.active){ Mobs.tick(dt); Structures.tick(dt); }   // (the tutorial world is calm: no monsters, and its camps stay empty)
    tickCombat(dt);
    // doors are drawn open while the player stands in them
    const pc = playerCell(), here = pc ? cellIndex(pc.x, pc.y) : -1;
    if(here !== GameUI.lastCell){
        for(const i of [GameUI.lastCell, here]) if(i >= 0 && Theaya.blocks[i] && Blocks.get(Theaya.blocks[i].id).kind === 'door') Theaya.dirty.add(i);
        GameUI.lastCell = here;
    }
    if(GameUI.wheel) refreshWheel();
    if(GameUI.station) checkStation();
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
/** Texture states of a cell's floor, most specific first (see 3a. Textures). */
function groundStates(i){
    const gt = groundTypes[Theaya.ground[i]];
    return [
        Theaya.dried.has(i) && 'dried',
        Theaya.mud.has(i) && 'mud',
        gt.water && (Theaya.water[i] ?? WATER_UNITS) < WATER_UNITS / 2 && 'low',
        Theaya.biome[i],
    ];
}
/** Foundation looks: the slab fills the whole cell (no floor shows around it); `seam` is its edge line. */
const FOUNDATION_LOOK = {
    marble: { base:'#ebe7df', light:'#f6f3ee', vein:'#a9a39a', seam:'#c7c0b4' },
    stone:  { base:'#9b9a95', light:'#a9a8a3', dot:'#7f7e79', fleck:'#b8b7b2', joint:'#7c7b76', seam:'#73726d' },
};
/** A foundation slab over cell c: marble (pale, soft veins) or stone (grey concrete with speckles and joints). */
function drawFoundation(g, kind, c, poly, h){
    const L = FOUNDATION_LOOK[kind] || FOUNDATION_LOOK.stone;
    g.noStroke(); g.fill(L.base); polyShape(g, poly, 1.04, c);   // the whole cell, over the floor's edge too
    g.fill(L.light); polyShape(g, poly, 0.7, c);
    if(kind === 'marble'){
        // smooth polished marble: a few very faint, soft cloudy tints (no lines, so nothing reads as a crack)
        g.noStroke();
        for(let k = 0; k < 4; k++){
            const px = c.x - 9 + h(42 + k) * 18, py = c.y - 9 + h(46 + k) * 18, w = 14 + h(50 + k) * 8;
            for(let s = 3; s >= 1; s--){
                g.fill(169, 163, 154, 6);
                g.ellipse(px, py, w * s / 3 * 1.4, w * s / 3);
            }
        }
    } else {
        // concrete: speckles and a couple of slab joints
        g.noStroke();
        for(let k = 0; k < 9; k++){ g.fill(k % 3 ? L.dot : L.fleck); g.circle(c.x - 13 + h(60 + k) * 26, c.y - 13 + h(70 + k) * 26, 1.6 + h(80 + k) * 1.2); }
        g.stroke(L.joint); g.strokeWeight(1.2);
        const jy = c.y - 3 + h(90) * 6;
        g.line(c.x - 17, jy, c.x + 17, jy);
        const jx = c.x - 4 + h(91) * 8;
        g.line(jx, jy, jx + 1, c.y + 17);
    }
    g.noFill(); g.stroke(L.seam); g.strokeWeight(1); polyShape(g, poly, 1, c);   // its own edge instead of the floor's outline
}
/** Foundations, puddles, snow and dried cracks drawn over a cell's floor. */
function drawGroundCover(g, i, c, poly, h){
    if(Theaya.foundations.has(i)) drawFoundation(g, foundationKind(i), c, poly, h);
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
    const h = k => hash2(x * 7 + k, y * 13 + k, 99);
    const tex = Textures.pick(Theaya.ground[i], 'main', groundStates(i));
    // floor is drawn a bit oversized to hide seams, but not next to a foundation: it would show as a rim on the slab
    const grow = Theaya.foundations.size && !Theaya.foundations.has(i) && neighborIdx(i).some(j => Theaya.foundations.has(j)) ? 1 : 1.04;
    if(tex && !tex.s.over){
        g.noStroke(); g.fill(col); polyShape(g, poly, grow, c);   // under the image, in case it has see-through parts
        drawCellTexture(g, tex, c, poly, tex.s.clip !== false);
    } else {
        g.noStroke();
        g.fill(col);
        polyShape(g, poly, grow, c);
        // ground detail
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
        if(tex) drawCellTexture(g, tex, c, poly, tex.s.clip !== false);   // `over`: the image on top of the built-in look
    }
    drawGroundCover(g, i, c, poly, h);
    if(!Theaya.foundations.has(i)){ g.stroke(0, 0, 0, 28); g.strokeWeight(1); g.noFill(); polyShape(g, poly, 1, c); }   // (a foundation draws its own seam)

    const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
    if(def) drawBlockBody(g, def, b, c, poly, i);
}
/** Texture states of a plant (see 3a. Textures). */
const plantStates = info => !info ? ['sprout'] : [info.rot && 'rotten', info.ripe && 'ripe', 'stage' + Math.max(0, info.k), info.k < 0 ? 'sprout' : 'growing'];
/** A crop at its growth stage (sprout / growing / ripe / rotten), centered at c. blockId = the plant block (its texture wins over the crop's). */
function drawPlant(g, cropId, info, c, h, blockId = null){
    const st = plantStates(info);
    const tex = (blockId && Textures.pick(blockId, 'main', st)) || Textures.pick(cropId, 'main', st);
    if(tex && !tex.s.over){ drawCellTexture(g, tex, c, null); return; }
    drawPlantLook(g, cropId, info, c, h);
    if(tex) drawCellTexture(g, tex, c, null);
}
function drawPlantLook(g, cropId, info, c, h){
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
/** Where each farmland seedling slot is drawn in its cell (offsets from the cell center, px). */
const FARM_SPOTS = [[-9, -4], [9, -4], [0, 2], [-9, 8], [9, 8]];
/** Texture states of a placed block (see 3a. Textures). */
function blockStates(def, b, i){
    switch(def.kind){
        case 'door': { const pc = playerCell(); return [pc && cellIndex(pc.x, pc.y) === i && 'open']; }
        case 'station': return [b && b.lit && 'lit'];
        case 'boat': return [boatHasPlayer(i) && 'aboard'];
        case 'farmland': { const w = (b && b.water) || 0; return [w > FARM.waterMax && 'flooded', w > FARM.waterMax / 2 && 'wet']; }
        default: return null;
    }
}
function drawBlockBody(g, def, b, c, poly, i = -1){
    // plants are textured per growth stage in drawPlant; farmland draws its own texture under its gauge + plant
    const tex = def.kind === 'plant' ? null : Textures.pick(def.id, 'main', blockStates(def, b, i));
    if(tex && def.kind !== 'farmland'){
        if(tex.s.over) drawBlockLook(g, def, b, c, poly, i, null);
        drawCellTexture(g, tex, c, poly);
    } else drawBlockLook(g, def, b, c, poly, i, tex);
    drawBlockCracks(g, b, c);
}
/** The built-in look of a block. tex = farmland's texture (drawn under its gauge + plant), else null. */
function drawBlockLook(g, def, b, c, poly, i, tex){
    const h = k => hash2(Math.round(c.x) + k, Math.round(c.y) + k * 3, 7);
    g.strokeWeight(1.5);
    if(def.draw && def.kind !== 'station'){ def.draw(g, def, b, c, poly, i); return; }   // a block spec's own look (stations: STATION_DRAW)
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
            drawPlant(g, b.plant ? b.plant.crop : def.crop, plantInfo(b), c, h, def.id);
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
            if(!tex || tex.s.over){
                g.fill(soil); g.stroke(shade(def.color, -0.4)); polyShape(g, poly, 0.88, c);
                g.stroke(lerpColor(soil, color(0), 0.3)); g.strokeWeight(2);
                for(let k = -1; k <= 1; k++) g.line(c.x - 13, c.y + k * 7, c.x + 13, c.y + k * 7);
            }
            if(tex) drawCellTexture(g, tex, c, poly);
            // water gauge
            g.noStroke(); g.fill(0, 0, 0, 90); g.rect(c.x - 12, c.y + 13, 24, 3, 1);
            g.fill('#4aa3ff'); g.rect(c.x - 12, c.y + 13, 24 * wet, 3, 1);
            if(b.water > FARM.waterMax){   // flooded: standing water + an overflow gauge
                const fl = Math.min(1, (b.water - FARM.waterMax) / (FARM.floodMax - FARM.waterMax));
                g.fill(70, 130, 200, 90 + 90 * fl); g.ellipse(c.x, c.y, 18 + 10 * fl, 10 + 6 * fl);
                g.fill(0, 0, 0, 90); g.rect(c.x - 12, c.y + 9, 24, 3, 1);
                g.fill('#a8ecff'); g.rect(c.x - 12, c.y + 9, 24 * fl, 3, 1);
            }
            // each seedling at its own spot, at half size (the water amount is drawn live above the cell, see worldOverlay)
            const seedlings = farmSeedlings(b);
            for(const { k, p, info } of seedlings){
                const o = FARM_SPOTS[k % FARM_SPOTS.length];
                g.push(); g.translate(c.x + o[0], c.y + o[1]); g.scale(0.5);
                drawPlant(g, p.crop, info, { x: 0, y: 0 }, j => h(j + k * 17));
                g.pop();
            }
            if(seedlings.length && b.water <= 0){ g.noStroke(); g.fill('#ffb347'); g.textSize(11); g.textAlign(CENTER, CENTER); g.text('!', c.x + 13, c.y - 4); }
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
        case 'boat': {   // a little wooden rowboat floating on the water cell
            const aboard = boatHasPlayer(i);
            g.noStroke(); g.fill(0, 0, 40, 60); g.ellipse(c.x + 1, c.y + 8, 36, 12);                      // shadow on the water
            g.fill(shade(def.color, -0.25)); g.stroke(shade(def.color, -0.55)); g.strokeWeight(1.5);
            g.arc(c.x, c.y - 1, 34, 24, 0, Math.PI, CHORD);                                              // hull
            g.fill(def.color); g.ellipse(c.x, c.y - 1, 34, 11);                                          // deck
            g.noFill(); g.stroke('#3f3f46'); g.strokeWeight(2); g.ellipse(c.x, c.y - 1, 34, 11);         // rubber seal
            g.stroke(shade(def.color, -0.35)); g.strokeWeight(1);
            g.line(c.x - 7, c.y - 5, c.x - 7, c.y + 3); g.line(c.x + 5, c.y - 6, c.x + 5, c.y + 4);       // planks
            if(aboard){ g.noStroke(); g.fill(255, 255, 255, 60); g.ellipse(c.x, c.y - 1, 24, 6); }
            break;
        }
        case 'station':
            if(STATION_DRAW[def.station]) STATION_DRAW[def.station](g, def, b, c, poly, i);   // a custom look from defineStation
            else if(def.station === 'workbench'){
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
            } else if(b && b.box){   // a container (chest)
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
}
/** Cracks from monsters trying to break through (1..4 levels), over the block's look or texture. */
function drawBlockCracks(g, b, c){
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

const Render = { gfx: null, probeAt: 0, errored: false };
/**
 * The terrain is drawn once into an offscreen canvas and only changed cells are redrawn. Browsers
 * can throw such a canvas's pixels away (tab in the background, GPU reset, memory pressure), and
 * then every tile that isn't redrawn shows the blue scene color through (the "blue haze": a tile
 * came back only when something redrew it). So: probe a few cells now and then, and redraw
 * everything when the pixels are gone. Coming back to the tab also redraws.
 */
function terrainLost(g){
    try{
        const ctx = g.drawingContext, zone = Theaya.zone;
        for(const [x, y] of [[0, 0], [Math.floor(MAP_COLS / 2), Math.floor(MAP_ROWS / 2)], [MAP_COLS - 1, MAP_ROWS - 1]]){
            const c = zone.toWorld(x, y);
            if(ctx.getImageData(Math.round(c.x), Math.round(c.y), 1, 1).data[3] === 0) return true;   // every drawn cell is opaque at its center
        }
    } catch(e){ /* unreadable canvas: can't tell, leave it */ }
    return false;
}
for(const ev of ['visibilitychange', 'focus', 'pageshow']) window.addEventListener(ev, () => { if(ev !== 'visibilitychange' || !document.hidden) Theaya.fullRedraw = true; });
/** Draw one cell; a cell that throws is reported once and skipped so it can't stop the rest. */
function safeDrawCell(g, i){
    try{ drawCellOn(g, i); }
    catch(e){
        if(!Render.errored){ Render.errored = true; console.error(`drawCellOn failed for cell ${i}:`, e); }
    }
}
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
    const now = performance.now();
    if(!T.fullRedraw && now - Render.probeAt > 1000){
        Render.probeAt = now;
        if(terrainLost(g)) T.fullRedraw = true;
    }
    if(T.fullRedraw){
        T.fullRedraw = false;
        T.dirty.clear();
        g.clear();
        for(let i = 0; i < MAP_COLS * MAP_ROWS; i++) safeDrawCell(g, i);
    } else if(T.dirty.size){
        const cells = [...T.dirty];
        T.dirty.clear();
        for(const i of cells) safeDrawCell(g, i);
    }
    const o = zone.transform.position;
    push(); imageMode(CORNER); image(g, o.x, o.y); pop();
}

/**
 * The repair radius of the heart stone picked in its panel (GameUI.heartRadius): every covered cell tinted,
 * the edge ring outlined, damaged blocks being repaired outlined brighter. Stays on until hidden or the stone is gone.
 */
function drawHeartRadius(){
    const i = GameUI.heartRadius;
    if(i < 0) return;
    if(!isHeartStone(i)){ GameUI.heartRadius = -1; return; }
    const r = heartStats(Theaya.blocks[i]).radius, c = cellXY(i), zone = Theaya.zone;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
    push();
    for(const n of cellsWithin(c, r)){
        const poly = zone.cellPolygon(n.x, n.y);
        if(!poly.length) continue;
        noStroke(); fill(224, 80, 110, 34 + 16 * pulse);
        beginShape(); for(const p of poly) vertex(p.x, p.y); endShape(CLOSE);
        const b = blockAt(n.x, n.y);
        if(b && b.cracks > 0) cellOutline(n.x, n.y, '#ffd28a', 2.5);                       // being repaired
        else if(hexDist(c, n) === r) cellOutline(n.x, n.y, `rgba(255,154,176,${0.5 + 0.3 * pulse})`, 1.5);   // the edge
    }
    pop();
    cellOutline(c.x, c.y, '#ff9ab0', 3);   // the stone itself
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
        drawHeartRadius();
        if(Tutorial.active) Tutorial.drawWorld();
        if(!Menu.active && !GameUI.wheel && !uiHit(mouse.rawX, mouse.rawY)){
            const hc = zone.toCell(mouse.x, mouse.y);
            if(hc){
                const q = quickActionFor(hc.x, hc.y, mouse.x, mouse.y);   // gold = left click uses the tool here, red = it can't
                cellOutline(hc.x, hc.y, !q ? 'rgba(255,255,255,0.55)' : q.reason ? 'rgba(255,110,90,0.8)' : '#ffd75e', q ? 3 : 2);
            }
        }
        if(GameUI.wheel) cellOutline(GameUI.wheel.x, GameUI.wheel.y, '#ffd75e', 3);
        if(GameUI.station) cellOutline(GameUI.station.x, GameUI.station.y, '#8fd0ff', 2);
        // farmland water: the total amount, overflow included (light blue when it's over the top, orange when dry)
        push(); textSize(9); textAlign(CENTER, CENTER); textStyle(BOLD);
        for(const i of Theaya.plants){
            const b = Theaya.blocks[i];
            if(!b || b.id !== 'farmland') continue;
            const { x, y } = cellXY(i), w = zone.toWorld(x, y);
            if(w.x < cam.left || w.x > cam.right || w.y < cam.top || w.y > cam.bottom) continue;
            const t = String(Math.round(b.water)), tw = textWidth(t) + 8;
            noStroke(); fill(0, 0, 0, 150); rect(w.x - tw / 2, w.y - 20, tw, 11, 5);
            fill(b.water > FARM.waterMax ? '#a8ecff' : b.water <= 0 ? '#ffb070' : '#6fb8ff');
            text(t, w.x, w.y - 14.5);
        }
        pop();
        // torch flames (they flicker, so they're drawn live, not on the terrain buffer)
        push(); noStroke();
        const t = performance.now() / 1000;
        for(const i of Theaya.lights){
            const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
            if(!def || !['torch', 'lamp', 'campfire'].includes(def.kind)) continue;
            const { x, y } = cellXY(i), w = zone.toWorld(x, y);
            if(w.x < cam.left || w.x > cam.right || w.y < cam.top || w.y > cam.bottom) continue;
            const f = 0.85 + 0.15 * Math.sin(t * 13 + i) * Math.sin(t * 7.3 + i * 1.7);
            const k = def.light / TORCH.light;                      // brighter lights have a bigger flame
            const fx = def.kind === 'lamp' ? w.x + 15 : w.x, fy = def.kind === 'lamp' ? w.y - 4 : def.kind === 'campfire' ? w.y - 3 : w.y - 9;   // lamps burn at the spout, campfires on their logs
            const s = def.kind === 'lamp' ? 0.8 : def.kind === 'campfire' ? 1.7 : Math.min(1.3, k);
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
            const ctex = Textures.pick(def.id, 'canopy');
            const drawCanopyTex = () => Textures.draw(null, ctex, w.x, w.y - 22, HEX_W * 1.2, HEX_H * 1.2, { alpha: a / 255, animate: true });
            if(ctex && !ctex.s.over){ drawCanopyTex(); continue; }
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
            if(ctex) drawCanopyTex();   // `over`: the image on top of the built-in canopy
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
        const pc0 = playerCell();
        if(!cur || (pc0 && Theaya.biome[cellIndex(pc0.x, pc0.y)] === 'cave')) return;   // caves are sheltered: no weather visuals
        const W = Weather.data(), sp = World.camera.superPosition, t = performance.now() / 1000;
        if(Weather.type === 'drought'){ noStroke(); fill(255, 170, 70, 28 + 10 * Math.sin(t * 0.7)); rect(0, 0, width, height); return; }
        if(!W.precipitation) return;
        const snow = playerAmbient() <= 0 && Weather.type !== 'hail', hail = cur.hail, I = W.intensity ?? 0.6;
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
        const pcD = playerCell(), inCaveD = !!(pcD && Theaya.biome[cellIndex(pcD.x, pcD.y)] === 'cave');
        const dark = Math.min(0.82, (1 - Clock.light()) * 0.74 + (inCaveD ? 0 : Weather.param('darkness', 0)));   // storm clouds don't darken a cave
        // caves stay dark in daytime too: find the cave cells on screen
        const zone = Theaya.zone, cam = World.camera.getBounds(HEX_W), caves = [], outside = [];
        // standing in a cave: the world outside it fades toward black, more the deeper in you are (and fades back in when you leave)
        const pc = playerCell(), inCave = !!(pc && Theaya.biome[cellIndex(pc.x, pc.y)] === 'cave');
        const caveTarget = inCave ? CaveDepth.shade(cellIndex(pc.x, pc.y)) : 0;
        this.caveK = (this.caveK || 0) + (caveTarget - (this.caveK || 0)) * 0.12;
        if(!inCave && this.caveK < 0.01) this.caveK = 0;
        const outK = this.caveK, outDark = Math.max(dark, CAVE_OUTSIDE_DARKNESS * outK);
        if(dark < CAVE_DARKNESS || outK > 0){
            const a = zone.toCell(cam.left, cam.top), b = zone.toCell(cam.right, cam.bottom);
            const x0 = Math.max(0, (a ? a.x : 0) - 1), y0 = Math.max(0, (a ? a.y : 0) - 1);
            const x1 = Math.min(MAP_COLS - 1, (b ? b.x : MAP_COLS - 1) + 1), y1 = Math.min(MAP_ROWS - 1, (b ? b.y : MAP_ROWS - 1) + 1);
            for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
                const i = cellIndex(x, y);
                if(Theaya.biome[i] === 'cave'){ const td = CAVE_DARKNESS * CaveDepth.shade(i); if(dark < td) caves.push({ x, y, td }); }   // heat map: lighter near the mouth
                else if(outK > 0) outside.push({ x, y });
            }
        }
        if(dark < 0.01 && !caves.length && !outside.length) return;
        const sc = 0.5, w = Math.ceil(width * sc), h = Math.ceil(height * sc);
        if(!this.gfx || this.gfx.width !== w || this.gfx.height !== h){ this.gfx = createGraphics(w, h); this.gfx.pixelDensity(1); }
        const g = this.gfx, sp = World.camera.superPosition;
        g.clear(); g.noStroke(); g.fill(6, 10, 30, 255 * dark); g.rect(0, 0, w, h);
        if(caves.length){
            // extra darkness so each cave cell ends up its own depth's darkness (td) overall
            for(const c of caves){
                g.fill(6, 10, 30, 255 * (1 - (1 - c.td) / (1 - dark)));
                g.beginShape();
                for(const p of zone.cellPolygon(c.x, c.y)){ const k = 1.06, wc = zone.toWorld(c.x, c.y); g.vertex((wc.x + (p.x - wc.x) * k - sp.x) * sc, (wc.y + (p.y - wc.y) * k - sp.y) * sc); }
                g.endShape(CLOSE);
            }
        }
        if(outside.length && outDark > dark){
            // extra darkness so outside cells end up outDark dark overall
            g.fill(6, 10, 30, 255 * (1 - (1 - outDark) / (1 - dark)));
            for(const c of outside){
                g.beginShape();
                for(const p of zone.cellPolygon(c.x, c.y)){ const k = 1.04, wc = zone.toWorld(c.x, c.y); g.vertex((wc.x + (p.x - wc.x) * k - sp.x) * sc, (wc.y + (p.y - wc.y) * k - sp.y) * sc); }
                g.endShape(CLOSE);
            }
        }
        // holding a light (torch, grease torch, lamp) widens your own light: its glow x heldLight / light
        const held = heldItem(), heldDef = held instanceof BlockItem ? Blocks.get(held.block) : null;
        const holdsLight = !!(heldDef && heldDef.light && held.hasTag('light'));
        const heldR = holdsLight ? Math.max(120, heldDef.light * TORCH.heldLight / TORCH.light) : 120;
        const lights = [{ x: player.transform.position.x, y: player.transform.position.y, r: heldR, warm: holdsLight }];
        for(const M of Object.values(MACHINES)) for(const i of M.cells()){   // lit machines (forges, cooking pots...) glow by their `light`
            const b = Theaya.blocks[i];
            if(M.light && b && b.lit){ const { x, y } = cellXY(i), p = Theaya.zone.toWorld(x, y); lights.push({ x: p.x, y: p.y, r: M.light, warm: true }); }
        }
        const flick = performance.now() / 1000;
        for(const i of Theaya.lights){   // torches + ore hearts
            const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
            if(!def || !def.light) continue;
            const { x, y } = cellXY(i), p = Theaya.zone.toWorld(x, y);
            if(p.x < cam.left - def.light || p.x > cam.right + def.light || p.y < cam.top - def.light || p.y > cam.bottom + def.light) continue;
            const fire = def.kind === 'torch' || def.kind === 'lamp' || def.kind === 'campfire';
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
            if(m.type !== 'zombie' || (Textures.replaces('zombie') && !Textures.entry('zombie').main?.eyes)) continue;   // a texture draws its own eyes (eyes:true keeps the glow)
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
    return region(x, y, w, h, { kind:'button', enabled, onClick });
}

/* ----- Item icon art -----
 * A drawing of its own for items that would otherwise share a generic icon (every meat was one
 * oval, every dish one blob): a T-bone steak, a pork chop, a drumstick, a pizza slice, a bowl of
 * tomato soup... An item uses ICON_ART[look.art] (a spec's `art` field, see lookOf), else
 * ICON_ART[its id], else its `icon` family in drawItemIcon. `cooked: true` in the look draws the
 * cooked version of the same cut / fish (browned, grill marks, no raw marbling); a cooked meat's
 * look keeps the raw meat color as its `accent`.
 * Each entry is (cx, cy, r, look, item): r is half the icon box, keep the drawing within ~0.8 r.
 */
const _mixCache = new Map();
function mixColor(a, b, t){
    const key = a + '|' + b + '|' + t;
    let v = _mixCache.get(key);
    if(!v){ v = lerpColor(color(a), color(b), t).toString(); _mixCache.set(key, v); }
    return v;
}
const BONE = '#f4efe2', BONE_EDGE = '#a89e88';
const meatTone = L => L.cooked ? mixColor(L.accent ?? L.color, '#6e3a1c', 0.6) : L.color;
const fatTone  = L => L.cooked ? '#d9a865' : '#f6e6dc';
/** A closed smooth outline through [x, y] points (in r units around cx, cy). */
function iconBlob(cx, cy, r, pts){
    beginShape();
    for(let k = 0; k < pts.length + 3; k++){ const p = pts[k % pts.length]; curveVertex(cx + p[0] * r, cy + p[1] * r); }
    endShape(CLOSE);
}
function iconEllipse(x, y, w, h, a){ push(); translate(x, y); rotate(a); ellipse(0, 0, w, h); pop(); }
function iconDots(cx, cy, r, col, pts, d){ noStroke(); fill(col); for(const [x, y] of pts) circle(cx + x * r, cy + y * r, d * r); }
function iconSheen(x, y, w, h){ noStroke(); fill(255, 255, 255, 75); ellipse(x, y, w, h); }
/** Raw meat: thin pale streaks of fat. arcs = [x, y, width] in r units. */
function iconMarbling(cx, cy, r, arcs){
    noFill(); stroke(255, 238, 230, 200); strokeWeight(Math.max(1, r * 0.06));
    for(const [x, y, w] of arcs) arc(cx + x * r, cy + y * r, w * r, w * r * 0.45, 0.2, 2.8);
}
/** Cooked: dark diagonal grill marks. */
function iconGrill(cx, cy, r, span = 0.5, n = 3, gap = 0.26){
    stroke(55, 28, 12, 200); strokeWeight(Math.max(1.5, r * 0.09));
    for(let k = 0; k < n; k++){ const o = (k - (n - 1) / 2) * gap * r; line(cx + o - span * r * 0.35, cy + span * r * 0.5, cx + o + span * r * 0.35, cy - span * r * 0.5); }
}
function iconSteam(cx, cy, r, n = 2){
    noFill(); stroke(255, 255, 255, 150); strokeWeight(Math.max(1, r * 0.08));
    for(let k = 0; k < n; k++){
        const x = cx + (k - (n - 1) / 2) * r * 0.36;
        bezier(x, cy, x - r * 0.15, cy - r * 0.12, x + r * 0.15, cy - r * 0.26, x, cy - r * 0.4);
    }
}
function iconBone(x0, y0, x1, y1, r, knobs = true){
    stroke(BONE_EDGE); strokeWeight(r * 0.22); line(x0, y0, x1, y1);
    stroke(BONE); strokeWeight(r * 0.13); line(x0, y0, x1, y1);
    if(!knobs) return;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r * 0.11, ny = dx / l * r * 0.11;
    stroke(BONE_EDGE); strokeWeight(1.2); fill(BONE); circle(x1 + nx, y1 + ny, r * 0.24); circle(x1 - nx, y1 - ny, r * 0.24);
}
/** A cut with a fat rim: the rim, then the meat inside it (scaled by `inner`, nudged by dx / dy). */
function iconCut(cx, cy, r, L, pts, inner = 0.84, dx = 0, dy = 0){
    const fat = fatTone(L);
    stroke(shade(fat, -0.5)); strokeWeight(1.5); fill(fat); iconBlob(cx, cy, r, pts);
    noStroke(); fill(meatTone(L)); iconBlob(cx + dx * r, cy + dy * r, r * inner, pts);
}
/** A bowl whose rim is at cy, filled with `inside`; toppings go in the rim ellipse (1.5 r x 0.4 r). */
function iconBowl(cx, cy, r, inside, bowl = '#8a5a34', band = null){
    stroke(shade(bowl, -0.45)); strokeWeight(1.5); fill(shade(bowl, -0.15)); rect(cx - r * 0.28, cy + r * 0.52, r * 0.56, r * 0.16, 2);
    fill(bowl); arc(cx, cy, r * 1.56, r * 1.25, 0, Math.PI, CHORD);
    if(band){ noFill(); stroke(band); strokeWeight(r * 0.07); arc(cx, cy + r * 0.04, r * 1.4, r * 0.9, 0.35, Math.PI - 0.35); stroke(shade(bowl, -0.45)); strokeWeight(1.5); }
    fill(inside); ellipse(cx, cy, r * 1.56, r * 0.44);
}
/** A ragged strip (dried meat) from (x0, y0) to (x1, y1), w wide, all in r units. */
function iconStrip(cx, cy, r, x0, y0, x1, y1, w, col){
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2, n = 5;
    stroke(shade(col, -0.5)); strokeWeight(1.3); fill(col);
    beginShape();
    for(let k = 0; k <= n; k++){ const t = k / n, j = k % 2 ? 0.78 : 1.08; vertex(cx + (x0 + dx * t + nx * j) * r, cy + (y0 + dy * t + ny * j) * r); }
    for(let k = n; k >= 0; k--){ const t = k / n, j = k % 2 ? 1.1 : 0.82; vertex(cx + (x0 + dx * t - nx * j) * r, cy + (y0 + dy * t - ny * j) * r); }
    endShape(CLOSE);
}
/** A wavy band (lettuce, bacon) across x0..x1 at y, h tall. */
function iconWave(cx, cy, r, x0, x1, y, h, amp = 0.07, freq = 9, phase = 0){
    const n = 10, wv = x => Math.sin(x * freq + phase) * amp;
    beginShape();
    for(let k = 0; k <= n; k++){ const x = x0 + (x1 - x0) * k / n; vertex(cx + x * r, cy + (y - h / 2 + wv(x)) * r); }
    for(let k = n; k >= 0; k--){ const x = x0 + (x1 - x0) * k / n; vertex(cx + x * r, cy + (y + h / 2 + wv(x)) * r); }
    endShape(CLOSE);
}

/** Fish species: body / back / belly colors, how deep the body is, tail, markings. */
const ICON_FISH = {
    cod:    { body:'#b9ad8f', back:'#7f7358', belly:'#efe8d6', h:0.66, tail:'square', barbel:true, line:true,
              speckle:[[-0.32,-0.16],[-0.14,-0.22],[0.04,-0.18],[0.2,-0.13],[-0.22,-0.06],[0.1,-0.04]] },
    salmon: { body:'#e98a6c', back:'#7d8a96', belly:'#f8cbb6', h:0.48, tail:'fork', spots:[[-0.18,-0.15],[0.04,-0.17],[0.22,-0.1]] },
    trout:  { body:'#8fa36a', back:'#56683a', belly:'#ece6c6', h:0.56, tail:'square', stripe:'#d98aa0',
              spots:[[-0.3,-0.13],[-0.1,-0.19],[0.1,-0.15],[0.28,-0.08],[0.02,-0.06],[0.18,0.12],[-0.16,0.11]] },
};
function iconFish(cx, cy, r, P, cooked){
    const k = cooked ? 0.6 : 0, brown = '#a0612c';
    const body = mixColor(P.body, brown, k), back = mixColor(P.back, '#6a3a18', k), belly = mixColor(P.belly, '#d8a060', k);
    const bx = cx - r * 0.1, bw = r * 1.1, bh = r * P.h, edge = shade(body, -0.5);
    stroke(edge); strokeWeight(1.5); fill(back);
    triangle(bx - r * 0.24, cy - bh * 0.4, bx + r * 0.16, cy - bh * 0.4, bx - r * 0.1, cy - bh * 0.5 - r * 0.18);   // dorsal fin
    const tx = bx + bw * 0.42;
    if(P.tail === 'fork'){ beginShape(); vertex(tx, cy); vertex(tx + r * 0.38, cy - r * 0.36); vertex(tx + r * 0.25, cy); vertex(tx + r * 0.38, cy + r * 0.36); endShape(CLOSE); }
    else quad(tx, cy - r * 0.06, tx + r * 0.34, cy - r * 0.3, tx + r * 0.34, cy + r * 0.3, tx, cy + r * 0.06);
    fill(body); ellipse(bx, cy, bw, bh);
    noStroke(); fill(back); arc(bx, cy, bw * 0.9, bh * 0.8, Math.PI * 1.1, Math.PI * 1.9, CHORD);
    fill(belly); arc(bx, cy + bh * 0.05, bw * 0.78, bh * 0.62, Math.PI * 0.12, Math.PI * 0.88, CHORD);
    if(P.stripe){ fill(mixColor(P.stripe, brown, k)); ellipse(bx + r * 0.03, cy + bh * 0.02, bw * 0.8, bh * 0.2); }
    if(P.line){ noFill(); stroke(255, 255, 255, 150); strokeWeight(1); arc(bx + r * 0.05, cy + bh * 0.25, bw * 0.78, bh * 0.5, Math.PI * 1.12, Math.PI * 1.88); }
    if(P.speckle) iconDots(cx, cy, r, mixColor('#55493a', brown, k), P.speckle, 0.07);
    if(P.spots) iconDots(cx, cy, r, cooked ? '#3a2412' : '#262626', P.spots, 0.085);
    noFill(); stroke(shade(body, -0.45)); strokeWeight(1.2); arc(bx - bw * 0.24, cy, bh * 0.45, bh * 0.72, -Math.PI * 0.4, Math.PI * 0.4);   // gill
    if(P.barbel) line(bx - bw * 0.46, cy + bh * 0.18, bx - bw * 0.5, cy + bh * 0.42);
    noStroke(); fill(cooked ? '#efe9dc' : '#ffffff'); circle(bx - bw * 0.34, cy - bh * 0.12, r * 0.17);
    if(!cooked){ fill('#1e1e1e'); circle(bx - bw * 0.35, cy - bh * 0.12, r * 0.09); }
    else iconGrill(bx + r * 0.05, cy, r, 0.42, 3, 0.24);
}
/** Nigiri: a block of rice with a slice of fish draped over it (r = half its width). */
function iconNigiri(cx, cy, r, fish, opts = {}){
    stroke('#cbc4b0'); strokeWeight(1.3); fill('#f8f5ec'); rect(cx - r * 0.62, cy - r * 0.08, r * 1.24, r * 0.52, r * 0.24);
    iconDots(cx, cy, r, '#dcd5c2', [[-0.35,0.22],[0,0.3],[0.32,0.2],[-0.15,0.15],[0.18,0.12]], 0.08);
    stroke(shade(fish, -0.35)); strokeWeight(1.3); fill(fish);
    beginShape(); vertex(cx - r * 0.74, cy + r * 0.06);
    bezierVertex(cx - r * 0.5, cy - r * 0.48, cx + r * 0.42, cy - r * 0.52, cx + r * 0.76, cy - r * 0.04);
    bezierVertex(cx + r * 0.4, cy - r * 0.12, cx - r * 0.4, cy - r * 0.1, cx - r * 0.74, cy + r * 0.06);
    endShape(CLOSE);
    if(opts.stripes){ stroke(255, 255, 255, 190); strokeWeight(Math.max(1, r * 0.06)); for(const x of [-0.35, -0.05, 0.25]) line(cx + x * r, cy - r * 0.02, cx + (x + 0.14) * r, cy - r * 0.3); }
    if(opts.skin){ noFill(); stroke(opts.skin); strokeWeight(Math.max(1.5, r * 0.1)); bezier(cx - r * 0.66, cy - r * 0.06, cx - r * 0.45, cy - r * 0.44, cx + r * 0.4, cy - r * 0.46, cx + r * 0.7, cy - r * 0.08); }
    if(opts.nori){ noStroke(); fill('#22302a'); rect(cx - r * 0.1, cy - r * 0.38, r * 0.2, r * 0.82, 1); }
}
/** A slice of pie / cake seen from the side: top face, front face, crust. */
function iconSlice(cx, cy, r, top, front, crust, depth){
    const T = [-0.72, 0.12], B1 = [0.42, -0.48], B2 = [0.72, -0.04], P = ([x, y], dy = 0) => [cx + x * r, cy + (y + dy) * r];
    stroke(shade(front, -0.45)); strokeWeight(1.3);
    fill(front); beginShape(); for(const p of [P(T), P(B2), P(B2, depth), P(T, depth)]) vertex(...p); endShape(CLOSE);
    fill(crust); beginShape(); for(const p of [P(T, depth - 0.12), P(B2, depth - 0.12), P(B2, depth), P(T, depth)]) vertex(...p); endShape(CLOSE);
    fill(top); triangle(...P(T), ...P(B1), ...P(B2));
    stroke(shade(crust, -0.4)); strokeWeight(r * 0.16); line(...P(B1), ...P(B2));
    stroke(crust); strokeWeight(r * 0.1); line(...P(B1), ...P(B2));
}

const ICON_ART = {
    /* --- meat (raw / cooked) --- */
    steak(cx, cy, r, L){   // beef: a T-bone
        const pts = [[-0.74,-0.08],[-0.48,-0.52],[0.08,-0.62],[0.62,-0.4],[0.74,0.1],[0.44,0.52],[-0.14,0.58],[-0.62,0.36]];
        iconCut(cx, cy, r, L, pts, 0.8, 0.03, 0.02);
        if(!L.cooked) iconMarbling(cx, cy, r, [[-0.42,0.08,0.26],[0.38,0.12,0.24],[-0.3,0.32,0.18],[0.3,0.34,0.16]]);
        iconBone(cx - r * 0.42, cy - r * 0.28, cx + r * 0.38, cy - r * 0.28, r, false);
        iconBone(cx - r * 0.02, cy - r * 0.28, cx - r * 0.02, cy + r * 0.42, r, false);
        if(L.cooked){ iconGrill(cx - r * 0.38, cy + r * 0.12, r, 0.5, 2, 0.24); iconGrill(cx + r * 0.36, cy + r * 0.12, r, 0.5, 2, 0.24); }
    },
    chop(cx, cy, r, L){    // pork: a chop with a thick fat cap and a rib bone
        stroke(BONE_EDGE); strokeWeight(1.2); fill(BONE); rect(cx + r * 0.2, cy - r * 0.48, r * 0.58, r * 0.2, r * 0.1);
        const pts = [[-0.72,0.1],[-0.55,-0.4],[-0.1,-0.58],[0.32,-0.42],[0.44,0],[0.2,0.48],[-0.35,0.6]];
        iconCut(cx - r * 0.06, cy, r, L, pts, 0.7, 0.02, 0.12);
        noStroke(); fill(BONE); circle(cx + r * 0.08, cy - r * 0.12, r * 0.16);
        if(L.cooked) iconGrill(cx - r * 0.12, cy + r * 0.12, r, 0.45, 3, 0.22);
        else iconMarbling(cx - r * 0.1, cy + r * 0.1, r, [[-0.25,0.05,0.24],[0.1,0.25,0.2]]);
    },
    haunch(cx, cy, r, L){  // venison: a leg roast with the shank bone out the side
        iconBone(cx + r * 0.3, cy + r * 0.02, cx + r * 0.66, cy - r * 0.06, r);
        const m = meatTone(L), pts = [[-0.78,0.05],[-0.6,-0.4],[-0.1,-0.46],[0.32,-0.2],[0.4,0.1],[0.1,0.42],[-0.4,0.5],[-0.72,0.36]];
        stroke(shade(m, -0.5)); strokeWeight(1.5); fill(m); iconBlob(cx, cy, r, pts);
        noStroke(); fill(fatTone(L)); iconEllipse(cx - r * 0.55, cy - r * 0.02, r * 0.4, r * 0.74, 0.15);   // the cut face
        fill(L.cooked ? mixColor(L.accent ?? L.color, '#c08060', 0.4) : shade(m, 0.08)); iconEllipse(cx - r * 0.53, cy - r * 0.02, r * 0.28, r * 0.58, 0.15);
        if(L.cooked){ iconSheen(cx - r * 0.05, cy - r * 0.25, r * 0.4, r * 0.12); iconGrill(cx + r * 0.02, cy + r * 0.08, r, 0.4, 2, 0.24); }
        else iconMarbling(cx, cy, r, [[-0.1,-0.1,0.24],[0.12,0.18,0.2]]);
    },
    slab(cx, cy, r, L){    // bear: a thick boxy chunk with fat seams
        const m = meatTone(L), fat = fatTone(L), edge = shade(m, -0.55);
        stroke(edge); strokeWeight(1.5);
        fill(shade(m, -0.25)); quad(cx + r * 0.42, cy - r * 0.08, cx + r * 0.76, cy - r * 0.48, cx + r * 0.76, cy + r * 0.14, cx + r * 0.42, cy + r * 0.56);
        fill(m); quad(cx - r * 0.74, cy - r * 0.08, cx - r * 0.4, cy - r * 0.48, cx + r * 0.76, cy - r * 0.48, cx + r * 0.42, cy - r * 0.08);
        fill(shade(m, -0.1)); rect(cx - r * 0.74, cy - r * 0.08, r * 1.16, r * 0.64);
        noFill(); stroke(fat); strokeWeight(r * 0.09);
        bezier(cx - r * 0.7, cy + r * 0.14, cx - r * 0.3, cy + r * 0.04, cx, cy + r * 0.26, cx + r * 0.38, cy + r * 0.14);
        bezier(cx - r * 0.7, cy + r * 0.38, cx - r * 0.35, cy + r * 0.46, cx, cy + r * 0.3, cx + r * 0.38, cy + r * 0.4);
        if(L.cooked){ stroke(55, 28, 12, 200); strokeWeight(r * 0.09); for(const x of [-0.42, -0.08, 0.26]) line(cx + x * r, cy - r * 0.12, cx + (x + 0.26) * r, cy - r * 0.44); }
        else iconDots(cx, cy, r, fat, [[-0.3,-0.26],[0.1,-0.3],[0.42,-0.36],[-0.05,-0.18]], 0.08);
    },
    small_leg(cx, cy, r, L){   // rabbit: two slim legs, crossed
        const m = meatTone(L);
        for(const [ox, a] of [[-0.2, 0.38], [0.2, -0.38]]){
            push(); translate(cx + ox * r, cy + r * 0.1); rotate(a);
            iconBone(0, -r * 0.3, 0, -r * 0.68, r);
            stroke(shade(m, -0.5)); strokeWeight(1.3); fill(m); ellipse(0, r * 0.08, r * 0.36, r * 0.84);
            noStroke(); fill(255, 255, 255, 70); ellipse(-r * 0.06, -r * 0.05, r * 0.1, r * 0.4);
            if(L.cooked){ stroke(55, 28, 12, 190); strokeWeight(r * 0.07); line(-r * 0.12, r * 0.05, r * 0.12, -r * 0.1); line(-r * 0.12, r * 0.28, r * 0.12, r * 0.13); }
            pop();
        }
    },
    drumstick(cx, cy, r, L){   // chicken
        iconBone(cx + r * 0.05, cy - r * 0.05, cx + r * 0.52, cy - r * 0.52, r);
        const m = meatTone(L), pts = [[-0.74,0.3],[-0.62,-0.18],[-0.28,-0.38],[0.06,-0.26],[0.2,-0.08],[0.06,0.22],[-0.28,0.6],[-0.62,0.62]];
        stroke(shade(m, -0.45)); strokeWeight(1.5); fill(m); iconBlob(cx, cy, r, pts);
        iconDots(cx, cy, r, L.cooked ? shade(m, -0.28) : shade(m, 0.3), [[-0.5,0.12],[-0.3,-0.12],[-0.42,0.38],[-0.15,0.18],[-0.08,-0.12],[-0.22,0.4]], 0.08);
        iconSheen(cx - r * 0.42, cy - r * 0.08, r * 0.26, r * 0.14);
    },
    wing(cx, cy, r, L){        // bird: a wing bent at the elbow, drumette low, the flat and tip pointing up
        const m = meatTone(L);
        stroke(shade(m, -0.45)); strokeWeight(1.5); fill(m);
        triangle(cx + r * 0.36, cy - r * 0.5, cx + r * 0.66, cy - r * 0.84, cx + r * 0.62, cy - r * 0.38);   // the tip
        iconBlob(cx, cy, r, [[-0.06,0.34],[0.04,-0.04],[0.26,-0.42],[0.46,-0.6],[0.62,-0.42],[0.46,-0.04],[0.3,0.42]]);   // the flat
        iconBlob(cx, cy, r, [[-0.78,0.04],[-0.6,-0.2],[-0.2,-0.04],[0.12,0.16],[0.14,0.5],[-0.28,0.46],[-0.68,0.3]]);   // the drumette
        iconDots(cx, cy, r, L.cooked ? shade(m, -0.28) : shade(m, 0.3), [[-0.5,0.1],[-0.25,0.2],[-0.05,0.3],[0.3,-0.1],[0.38,-0.36],[0.25,0.2]], 0.08);
        if(L.cooked){ iconSheen(cx - r * 0.38, cy + r * 0.02, r * 0.3, r * 0.1); iconGrill(cx - r * 0.3, cy + r * 0.15, r, 0.3, 2, 0.22); }
    },
    bacon(cx, cy, r, L){       // two wavy strips, striped with fat
        const m = meatTone(L), fat = fatTone(L);
        for(const [y, ph] of [[-0.28, 0], [0.26, 1.7]]){
            stroke(shade(m, -0.5)); strokeWeight(1.3); fill(m); iconWave(cx, cy, r, -0.76, 0.76, y, 0.32, 0.09, 5, ph);
            noStroke(); fill(fat); iconWave(cx, cy, r, -0.72, 0.72, y - 0.04, 0.08, 0.09, 5, ph);
            fill(shade(fat, -0.1)); iconWave(cx, cy, r, -0.72, 0.72, y + 0.08, 0.04, 0.09, 5, ph);
        }
    },
    rotten(cx, cy, r, L){      // rotten flesh: a green lump, stink lines and a fly
        const m = L.color;
        stroke(shade(m, -0.5)); strokeWeight(1.5); fill(m);
        iconBlob(cx, cy + r * 0.12, r, [[-0.7,0.1],[-0.5,-0.3],[-0.1,-0.25],[0.2,-0.4],[0.6,-0.2],[0.66,0.2],[0.3,0.46],[-0.2,0.4],[-0.6,0.42]]);
        iconDots(cx, cy + r * 0.12, r, shade(m, -0.35), [[-0.4,0],[0.12,-0.1],[0.36,0.14],[-0.08,0.2]], 0.17);
        iconDots(cx, cy + r * 0.12, r, '#cfd88a', [[-0.22,-0.12],[0.4,-0.12],[0.06,0.12]], 0.09);
        noFill(); stroke(150, 200, 80, 190); strokeWeight(1.3);
        for(const x of [-0.38, 0.02]) bezier(cx + x * r, cy - r * 0.32, cx + (x - 0.12) * r, cy - r * 0.46, cx + (x + 0.12) * r, cy - r * 0.58, cx + x * r, cy - r * 0.76);
        noStroke(); fill(225, 235, 255, 190); ellipse(cx + r * 0.48, cy - r * 0.66, r * 0.2, r * 0.13); ellipse(cx + r * 0.64, cy - r * 0.66, r * 0.2, r * 0.13);
        fill('#1a1a1a'); circle(cx + r * 0.56, cy - r * 0.58, r * 0.13);
    },

    /* --- dried meat (drying rack) --- */
    jerky(cx, cy, r, L){           // pork + beef: a fan of strips in two shades
        const a = L.color, b = L.accent ?? shade(a, 0.2);
        iconStrip(cx, cy, r, -0.18, 0.66, -0.6, -0.5, 0.3, a);
        iconStrip(cx, cy, r, 0.18, 0.66, 0.62, -0.48, 0.3, a);
        iconStrip(cx, cy, r, 0, 0.7, 0.02, -0.66, 0.32, b);
        iconDots(cx, cy, r, '#2a1a12', [[-0.4,-0.2],[0.02,-0.3],[0.05,0.2],[0.42,-0.1],[-0.3,0.2]], 0.06);
    },
    dried_beef(cx, cy, r, L){      // one flat sheet, salted
        const c = L.color;
        stroke(shade(c, -0.5)); strokeWeight(1.3); fill(c);
        beginShape(); for(const [x, y] of [[-0.7,-0.3],[-0.4,-0.5],[-0.1,-0.38],[0.25,-0.56],[0.66,-0.36],[0.54,0],[0.7,0.36],[0.3,0.52],[-0.05,0.38],[-0.45,0.56],[-0.7,0.22],[-0.56,-0.02]]) vertex(cx + x * r, cy + y * r); endShape(CLOSE);
        stroke(shade(c, -0.3)); strokeWeight(1); for(const k of [-0.4, -0.1, 0.2]) line(cx + (k - 0.15) * r, cy + r * 0.3, cx + (k + 0.25) * r, cy - r * 0.3);
        iconDots(cx, cy, r, '#f6f1e6', [[-0.45,-0.2],[-0.15,0.05],[0.2,-0.25],[0.4,0.15],[0,0.3],[-0.4,0.3]], 0.07);
    },
    venison_jerky(cx, cy, r, L){   // a bundle of strips tied with twine
        const c = L.color;
        [[-0.36, -0.42], [-0.12, -0.14], [0.12, 0.14], [0.36, 0.42]].forEach(([b, t], k) => iconStrip(cx, cy, r, b * 0.55, 0.68, t, -0.66, 0.24, k % 2 ? shade(c, 0.12) : c));
        stroke('#a8905a'); strokeWeight(r * 0.14); line(cx - r * 0.42, cy + r * 0.08, cx + r * 0.42, cy + r * 0.02);
        stroke('#dcc68e'); strokeWeight(r * 0.08); line(cx - r * 0.42, cy + r * 0.08, cx + r * 0.42, cy + r * 0.02);
        strokeWeight(r * 0.06); line(cx + r * 0.08, cy + r * 0.05, cx + r * 0.2, cy + r * 0.32); line(cx + r * 0.08, cy + r * 0.05, cx - r * 0.06, cy + r * 0.32);
    },
    bear_jerky(cx, cy, r, L){      // thick chunky strips with a fat edge
        const c = L.color;
        for(const [y0, y1] of [[0.5, -0.06], [0.06, -0.56]]){
            iconStrip(cx, cy, r, -0.68, y0, 0.66, y1, 0.42, c);
            noFill(); stroke('#c89a6a'); strokeWeight(r * 0.07); line(cx - r * 0.6, cy + (y0 - 0.12) * r, cx + r * 0.58, cy + (y1 - 0.12) * r);
        }
    },

    /* --- sushi --- */
    cod_sushi(cx, cy, r){    iconNigiri(cx, cy + r * 0.1, r, '#efe6d6', { nori:true }); },
    salmon_sushi(cx, cy, r){ iconNigiri(cx, cy + r * 0.1, r, '#f2905e', { stripes:true }); },
    trout_sushi(cx, cy, r){  iconNigiri(cx, cy + r * 0.1, r, '#e8a0a8', { skin:'#7f9a5a' }); },
    sushi_platter(cx, cy, r){
        stroke('#5a3a1e'); strokeWeight(1.5); fill('#9b6b3d'); rect(cx - r * 0.8, cy - r * 0.1, r * 1.6, r * 0.7, 4);   // the board
        fill('#7a5232'); noStroke(); rect(cx - r * 0.7, cy + r * 0.6, r * 0.2, r * 0.1); rect(cx + r * 0.5, cy + r * 0.6, r * 0.2, r * 0.1);
        iconNigiri(cx - r * 0.42, cy + r * 0.12, r * 0.42, '#efe6d6', { nori:true });
        iconNigiri(cx + r * 0.02, cy + r * 0.12, r * 0.42, '#f2905e', { stripes:true });
        iconNigiri(cx + r * 0.46, cy + r * 0.12, r * 0.42, '#e8a0a8', { skin:'#7f9a5a' });
        for(const x of [-0.25, 0.25]){   // two maki rolls behind
            stroke('#101a14'); strokeWeight(1); fill('#22302a'); circle(cx + x * r, cy - r * 0.36, r * 0.44);
            noStroke(); fill('#f8f5ec'); circle(cx + x * r, cy - r * 0.36, r * 0.32); fill(x < 0 ? '#f2905e' : '#7fbf5a'); circle(cx + x * r, cy - r * 0.36, r * 0.13);
        }
    },

    /* --- fish dishes --- */
    fish_stew(cx, cy, r){
        stroke('#5a2a18'); strokeWeight(1.3); fill('#f2905e');   // a tail sticking out
        beginShape(); vertex(cx + r * 0.2, cy - r * 0.05); vertex(cx + r * 0.5, cy - r * 0.62); vertex(cx + r * 0.42, cy - r * 0.3); vertex(cx + r * 0.72, cy - r * 0.5); endShape(CLOSE);
        iconBowl(cx, cy, r, '#d8b080', '#6a7a8a');
        iconDots(cx, cy, r, '#f2a07e', [[-0.4,-0.02],[-0.1,0.05],[0.12,-0.05]], 0.2);
        iconDots(cx, cy, r, '#4f8a3a', [[-0.25,-0.08],[0.3,0.04]], 0.08);
        iconSteam(cx - r * 0.25, cy - r * 0.22, r);
    },
    fish_sandwich(cx, cy, r){   // a long bun, a grilled fillet with its tail out the end
        const bun = '#c98a45';
        stroke(shade(bun, -0.45)); strokeWeight(1.3); fill(bun); rect(cx - r * 0.72, cy + r * 0.12, r * 1.3, r * 0.3, 0, 0, 10, 10);
        stroke('#8a4a2a'); fill('#e8a070'); beginShape(); vertex(cx + r * 0.5, cy + r * 0.04); vertex(cx + r * 0.8, cy - r * 0.18); vertex(cx + r * 0.8, cy + r * 0.26); endShape(CLOSE);
        rect(cx - r * 0.74, cy - r * 0.04, r * 1.32, r * 0.18, 6);
        stroke('#3f7a2e'); fill('#6fae4a'); iconWave(cx, cy, r, -0.7, 0.55, -0.1, 0.1, 0.04, 14);
        stroke(shade(bun, -0.45)); fill(bun); arc(cx - r * 0.08, cy - r * 0.12, r * 1.36, r * 0.72, Math.PI, 0, CHORD);
        iconDots(cx, cy, r, '#f3e6c8', [[-0.4,-0.32],[-0.1,-0.4],[0.2,-0.34]], 0.07);
    },

    /* --- bread and baking --- */
    bread(cx, cy, r, L){
        const c = L.color;
        stroke(shade(c, -0.5)); strokeWeight(1.5); fill(c);
        beginShape(); vertex(cx - r * 0.75, cy + r * 0.42); bezierVertex(cx - r * 0.86, cy - r * 0.75, cx + r * 0.86, cy - r * 0.75, cx + r * 0.75, cy + r * 0.42); endShape(CLOSE);
        iconSheen(cx - r * 0.15, cy - r * 0.22, r * 0.8, r * 0.2);
        stroke(shade(c, -0.35)); strokeWeight(r * 0.08);
        for(const k of [-1, 0, 1]) line(cx + (k * 0.36 - 0.1) * r, cy + r * 0.02, cx + (k * 0.36 + 0.12) * r, cy - r * 0.26);
    },
    garlic_bread(cx, cy, r){       // three toasted slices with garlic and herbs
        for(const k of [-1, 0, 1]){
            const x = cx + k * r * 0.4, y = cy + k * r * 0.12;
            push(); translate(x, y); rotate(-0.35);
            stroke('#7a4a1e'); strokeWeight(1.3); fill('#b87838'); rect(-r * 0.28, -r * 0.5, r * 0.56, r * 0.96, r * 0.2);
            noStroke(); fill('#f0c860'); rect(-r * 0.2, -r * 0.42, r * 0.4, r * 0.8, r * 0.14);
            fill('#4f8a3a'); circle(-r * 0.06, -r * 0.2, r * 0.07); circle(r * 0.08, r * 0.1, r * 0.07); circle(-r * 0.04, r * 0.24, r * 0.06);
            fill('#fbf6e8'); circle(r * 0.06, -r * 0.08, r * 0.09); circle(-r * 0.08, r * 0.02, r * 0.07);
            pop();
        }
    },
    cookie(cx, cy, r, L){          // a chocolate chip cookie with a bite out of it
        const c = L.color, pts = [];
        for(let k = 0; k < 48; k++){
            const a = k / 48 * Math.PI * 2, d = Math.abs(Math.atan2(Math.sin(a + 0.8), Math.cos(a + 0.8)));
            const rr = d < 0.42 ? 0.44 + 0.08 * Math.abs(Math.cos(d * 11)) : 0.66;
            pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        stroke(shade(c, -0.45)); strokeWeight(1.5); fill(c); beginShape(); for(const [x, y] of pts) vertex(cx + x * r, cy + y * r); endShape(CLOSE);
        iconDots(cx, cy, r, shade(c, 0.18), [[-0.2,0.25],[0.25,0.2],[-0.35,-0.15]], 0.22);
        iconDots(cx, cy, r, L.accent ?? '#4a3220', [[-0.3,0.05],[0.05,-0.3],[0.15,0.08],[-0.05,0.35],[0.38,0.3],[-0.4,0.35],[0.3,-0.05]], 0.13);
    },
    pancakes(cx, cy, r, L){        // a stack with butter and syrup
        const c = L.color;
        stroke('#c8c8c8'); strokeWeight(1.3); fill('#fafafa'); ellipse(cx, cy + r * 0.5, r * 1.6, r * 0.42);
        for(let k = 0; k < 3; k++){
            const y = cy + r * (0.38 - k * 0.2);
            stroke(shade(c, -0.45)); fill(shade(c, -0.12)); ellipse(cx, y, r * 1.3, r * 0.4);
            noStroke(); fill(c); ellipse(cx, y - r * 0.06, r * 1.24, r * 0.3);
        }
        noStroke(); fill(168, 98, 26, 220); ellipse(cx, cy - r * 0.08, r * 0.9, r * 0.22);
        rect(cx + r * 0.3, cy - r * 0.08, r * 0.1, r * 0.34, 3); rect(cx - r * 0.42, cy - r * 0.08, r * 0.09, r * 0.22, 3);
        fill('#ffe680'); stroke('#d8b840'); strokeWeight(1); rect(cx - r * 0.14, cy - r * 0.26, r * 0.28, r * 0.18, 2);
    },
    pizza(cx, cy, r, L){           // a slice: crust, sauce, cheese, pepperoni
        noStroke(); fill('#c0402a'); triangle(cx - r * 0.6, cy - r * 0.42, cx + r * 0.6, cy - r * 0.42, cx, cy + r * 0.76);
        stroke('#c89a30'); strokeWeight(1.2); fill('#f2d06a'); triangle(cx - r * 0.52, cy - r * 0.4, cx + r * 0.52, cy - r * 0.4, cx, cy + r * 0.66);
        stroke('#8a5a22'); strokeWeight(1.5); fill(L.color); rect(cx - r * 0.66, cy - r * 0.66, r * 1.32, r * 0.28, r * 0.14);
        iconDots(cx, cy, r, L.accent ?? '#c0402a', [[-0.22,-0.18],[0.2,-0.14],[0,0.2]], 0.24);
        iconDots(cx, cy, r, '#3f7a2e', [[0.12,0.04],[-0.1,0.02]], 0.08);
    },
    cake(cx, cy, r, L){            // a whole layered cake with drippy icing and a cherry
        stroke('#c8c8c8'); strokeWeight(1.3); fill('#fafafa'); ellipse(cx, cy + r * 0.58, r * 1.6, r * 0.3);
        stroke(shade(L.color, -0.45)); fill(L.color); rect(cx - r * 0.64, cy - r * 0.22, r * 1.28, r * 0.78, 3);
        noStroke(); fill(L.accent ?? '#b8405a'); rect(cx - r * 0.64, cy + r * 0.14, r * 1.28, r * 0.1);
        fill('#fbe0ec'); stroke('#d8a8bc'); strokeWeight(1.2); rect(cx - r * 0.68, cy - r * 0.32, r * 1.36, r * 0.2, 4);
        noStroke(); for(const [x, h] of [[-0.48, 0.2], [-0.12, 0.3], [0.22, 0.16], [0.5, 0.26]]){ rect(cx + (x - 0.06) * r, cy - r * 0.14, r * 0.12, h * r, 0, 0, 4, 4); }
        stroke('#3f7a2e'); strokeWeight(1.2); line(cx, cy - r * 0.42, cx + r * 0.12, cy - r * 0.66);
        noStroke(); fill('#d0202a'); circle(cx, cy - r * 0.4, r * 0.22); fill(255, 255, 255, 140); circle(cx - r * 0.04, cy - r * 0.44, r * 0.07);
    },
    no_bake_cake(cx, cy, r, L){    // a cheesecake slice: biscuit base, cream, berry topping
        iconSlice(cx, cy, r, L.accent ?? '#8a2a4a', L.color, '#a8743a', 0.52);
        noStroke(); fill(L.accent ?? '#8a2a4a');
        rect(cx - r * 0.42, cy + r * 0.0, r * 0.08, r * 0.2, 0, 0, 4, 4); rect(cx + r * 0.2, cy - r * 0.1, r * 0.08, r * 0.26, 0, 0, 4, 4);
    },
    pumpkin_pie(cx, cy, r, L){     // a slice with whipped cream
        iconSlice(cx, cy, r, L.color, shade(L.color, -0.12), L.accent ?? '#b87838', 0.3);
        stroke('#d8d0c0'); strokeWeight(1); fill('#fffaf0'); circle(cx + r * 0.12, cy - r * 0.18, r * 0.3); circle(cx + r * 0.14, cy - r * 0.3, r * 0.2);
    },
    berry_pie(cx, cy, r, L){       // a whole pie from above with a lattice top
        const crust = L.accent ?? '#b87838';
        stroke(shade(crust, -0.45)); strokeWeight(1.5); fill(crust); circle(cx, cy, r * 1.5);
        noStroke(); fill(L.color); circle(cx, cy, r * 1.16);
        iconDots(cx, cy, r, shade(L.color, -0.3), [[-0.25,-0.15],[0.15,0.25],[0.28,-0.3],[-0.3,0.3]], 0.14);
        stroke(shade(crust, 0.12)); strokeWeight(r * 0.13);
        for(const t of [-0.3, 0, 0.3]){ const h = Math.sqrt(0.58 * 0.58 - t * t); line(cx + t * r, cy - h * r, cx + t * r, cy + h * r); line(cx - h * r, cy + t * r, cx + h * r, cy + t * r); }
        iconDots(cx, cy, r, shade(crust, 0.25), Array.from({ length: 12 }, (_, k) => [Math.cos(k * Math.PI / 6) * 0.68, Math.sin(k * Math.PI / 6) * 0.68]), 0.16);
    },
    meat_pie(cx, cy, r, L){        // a whole pie in its tin, domed crust, gravy at the vent
        stroke('#5a6068'); strokeWeight(1.3); fill('#9aa0a8'); quad(cx - r * 0.76, cy + r * 0.06, cx + r * 0.76, cy + r * 0.06, cx + r * 0.6, cy + r * 0.58, cx - r * 0.6, cy + r * 0.58);
        stroke(shade(L.color, -0.45)); fill(L.color); arc(cx, cy + r * 0.08, r * 1.5, r * 1.0, Math.PI, 0, CHORD);
        iconDots(cx, cy, r, shade(L.color, 0.2), Array.from({ length: 8 }, (_, k) => [-0.66 + k * 0.19, 0.06]), 0.18);
        stroke(shade(L.color, -0.45)); strokeWeight(r * 0.07); for(const x of [-0.25, 0.25]) line(cx + (x - 0.06) * r, cy - r * 0.26, cx + (x + 0.06) * r, cy - r * 0.18);
        noStroke(); fill(L.accent ?? '#6a2a1a'); ellipse(cx, cy - r * 0.32, r * 0.16, r * 0.1); rect(cx - r * 0.04, cy - r * 0.32, r * 0.08, r * 0.16, 0, 0, 4, 4);
        iconSteam(cx, cy - r * 0.42, r * 0.8, 1);
    },
    dumplings(cx, cy, r, L){       // three pleated dumplings in a bamboo steamer
        stroke('#8a6a30'); strokeWeight(1.3); fill('#c8a060'); ellipse(cx, cy + r * 0.3, r * 1.6, r * 0.72);
        fill('#a8823e'); ellipse(cx, cy + r * 0.22, r * 1.36, r * 0.5);
        for(const [x, y] of [[-0.36, 0.16], [0.36, 0.16], [0, 0.0]]){
            stroke(shade(L.color, -0.3)); strokeWeight(1.3); fill(L.color); arc(cx + x * r, cy + y * r, r * 0.62, r * 0.6, Math.PI, 0, CHORD);
            strokeWeight(1); for(const p of [-0.12, 0, 0.12]) line(cx + (x + p) * r, cy + (y - 0.26) * r, cx + (x + p * 1.4) * r, cy + (y - 0.12) * r);
        }
        iconSteam(cx, cy - r * 0.3, r);
    },

    /* --- cold food --- */
    trail_mix(cx, cy, r, L){       // an open paper bag of nuts and berries
        stroke('#8a6a3a'); strokeWeight(1.3); fill('#c9a46a'); rect(cx - r * 0.5, cy - r * 0.1, r, r * 0.78, 2);
        beginShape(); for(let k = 0; k <= 6; k++) vertex(cx + (-0.5 + k / 6) * r, cy + (k % 2 ? -0.18 : -0.06) * r); vertex(cx + r * 0.5, cy + r * 0.1); vertex(cx - r * 0.5, cy + r * 0.1); endShape(CLOSE);
        const bits = [[-0.3,-0.2,'#9a6a3a'],[0,-0.3,'#c0405a'],[0.28,-0.2,'#b8844a'],[-0.12,-0.42,'#5a2a3a'],[0.14,-0.46,'#e8d8a0'],[-0.38,-0.36,'#c0405a'],[0.38,-0.36,'#9a6a3a'],[0.02,-0.58,'#b8844a']];
        for(const [x, y, c] of bits){ stroke(shade(c, -0.4)); strokeWeight(1); fill(c); ellipse(cx + x * r, cy + y * r, r * 0.26, r * 0.2); }
    },
    nut_bar(cx, cy, r, L){         // a bar of pressed nuts, half in its wrapper
        push(); translate(cx, cy); rotate(-0.4);
        stroke(shade(L.color, -0.45)); strokeWeight(1.3); fill(L.color); rect(-r * 0.72, -r * 0.24, r * 1.3, r * 0.48, 4);
        iconDots(0, 0, r, L.accent ?? '#6b4a2a', [[-0.55,-0.08],[-0.35,0.1],[-0.2,-0.1],[-0.42,-0.14]], 0.14);
        iconDots(0, 0, r, '#e8d8b0', [[-0.48,0.08],[-0.25,0.06]], 0.1);
        stroke('#1f4a72'); fill('#3a7ab0'); rect(-r * 0.08, -r * 0.28, r * 0.78, r * 0.56, 2);
        noStroke(); fill('#f3efe2'); rect(r * 0.1, -r * 0.1, r * 0.4, r * 0.2, 2);
        stroke('#1f4a72'); strokeWeight(1); for(let k = 0; k < 4; k++) line(r * 0.6, -r * 0.24 + k * r * 0.16, r * 0.7, -r * 0.2 + k * r * 0.16);
        pop();
    },
    berry_jam(cx, cy, r, L){       // a jar with a gingham cloth lid
        stroke('#7a90a0'); strokeWeight(1.3); fill(L.color); rect(cx - r * 0.46, cy - r * 0.3, r * 0.92, r * 0.96, 7);
        noStroke(); fill('#f3efe2'); rect(cx - r * 0.3, cy + r * 0.02, r * 0.6, r * 0.34, 2);
        fill(L.color); circle(cx - r * 0.08, cy + r * 0.2, r * 0.12); circle(cx + r * 0.08, cy + r * 0.2, r * 0.12);
        fill(255, 255, 255, 110); rect(cx + r * 0.26, cy - r * 0.18, r * 0.08, r * 0.6, 3);
        stroke('#8a2a2a'); strokeWeight(1.2); fill('#d84a4a');
        beginShape(); vertex(cx - r * 0.56, cy - r * 0.26); vertex(cx - r * 0.4, cy - r * 0.6); vertex(cx + r * 0.4, cy - r * 0.6); vertex(cx + r * 0.56, cy - r * 0.26); vertex(cx + r * 0.3, cy - r * 0.34); vertex(cx, cy - r * 0.26); vertex(cx - r * 0.3, cy - r * 0.34); endShape(CLOSE);
        iconDots(cx, cy, r, '#f6e6e6', [[-0.25,-0.48],[0.05,-0.48],[0.3,-0.48],[-0.1,-0.38],[0.18,-0.38]], 0.09);
        stroke('#e8d8b0'); strokeWeight(r * 0.07); line(cx - r * 0.48, cy - r * 0.32, cx + r * 0.48, cy - r * 0.32);
    },
    jam_sandwich(cx, cy, r, L){    // a triangle sandwich, jam showing between the slices
        const crust = L.color, jam = L.accent ?? '#8a2a4a';
        const tri = (dx, dy) => triangle(cx + (-0.62 + dx) * r, cy + (0.5 + dy) * r, cx + (0.6 + dx) * r, cy + (0.5 + dy) * r, cx + (-0.62 + dx) * r, cy + (-0.62 + dy) * r);
        stroke(crust); strokeWeight(r * 0.12); fill('#f3e6c8'); tri(0.22, 0.18);
        stroke(jam); strokeWeight(r * 0.14); fill(jam); tri(0.11, 0.09);
        stroke(crust); strokeWeight(r * 0.12); fill('#f8eed6'); tri(0, 0);
        noStroke(); fill(jam); circle(cx - r * 0.02, cy - r * 0.02, r * 0.16); circle(cx + r * 0.3, cy + r * 0.22, r * 0.14); rect(cx + r * 0.27, cy + r * 0.22, r * 0.08, r * 0.2, 0, 0, 4, 4);   // jam squeezing out
    },
    onigiri(cx, cy, r, L){         // a rice ball with a strip of nori
        stroke('#cbc4b0'); strokeWeight(1.3); fill('#f8f5ec');
        iconBlob(cx, cy, r, [[0,-0.7],[0.24,-0.42],[0.62,0.26],[0.52,0.52],[0,0.56],[-0.52,0.52],[-0.62,0.26],[-0.24,-0.42]]);
        iconDots(cx, cy, r, '#dcd5c2', [[-0.2,-0.2],[0.15,-0.1],[0,-0.4],[-0.3,0.05],[0.3,0.12]], 0.07);
        noStroke(); fill(L.accent ?? '#22302a'); rect(cx - r * 0.28, cy + r * 0.1, r * 0.56, r * 0.48, 2);
    },
    meat_sandwich(cx, cy, r, L){   // a tall stacked sandwich
        const bun = L.color;
        stroke(shade(bun, -0.45)); strokeWeight(1.3); fill(shade(bun, -0.05)); rect(cx - r * 0.62, cy + r * 0.32, r * 1.24, r * 0.3, 0, 0, 10, 10);
        fill('#7a3a22'); stroke('#4a2012'); rect(cx - r * 0.68, cy + r * 0.12, r * 1.36, r * 0.22, 7);
        noStroke(); fill('#d84a3a'); rect(cx - r * 0.6, cy + r * 0.02, r * 1.2, r * 0.12, 3);
        stroke('#3f7a2e'); strokeWeight(1); fill(L.accent ?? '#6fae4a'); iconWave(cx, cy, r, -0.74, 0.74, -0.04, 0.12, 0.05, 14);
        stroke(shade(bun, -0.45)); strokeWeight(1.3); fill(bun); arc(cx, cy - r * 0.08, r * 1.3, r * 1.0, Math.PI, 0, CHORD);
        iconDots(cx, cy, r, '#f3e6c8', [[-0.3,-0.3],[0,-0.42],[0.3,-0.3],[-0.12,-0.2],[0.16,-0.18]], 0.07);
    },
    garden_salad(cx, cy, r){
        noStroke(); fill('#4f8a3a'); for(const [x, y, d] of [[-0.35,-0.12,0.42],[0.32,-0.1,0.42],[0,-0.24,0.5],[-0.12,-0.04,0.4],[0.16,-0.02,0.4]]) circle(cx + x * r, cy + y * r, d * r);
        iconBowl(cx, cy, r, '#6fae4a');
        iconDots(cx, cy, r, '#d84a3a', [[-0.3,-0.04],[0.28,0.02]], 0.2);
        iconDots(cx, cy, r, '#ee8a26', [[0.05,-0.1],[-0.05,0.06]], 0.1);
        iconDots(cx, cy, r, '#cfe8a8', [[0.48,-0.04],[-0.5,0.04]], 0.16);
    },
    fruit_salad(cx, cy, r){       // fruit in a glass bowl
        noStroke(); for(const [x, y, c] of [[-0.3,-0.12,'#c0304a'],[0.05,-0.22,'#e8c860'],[0.32,-0.1,'#6a3a8a'],[-0.08,-0.06,'#ee8a26']]){ fill(c); circle(cx + x * r, cy + y * r, r * 0.34); }
        stroke('#8ab0c0'); strokeWeight(1.3); fill(207, 230, 240, 150); arc(cx, cy, r * 1.56, r * 1.25, 0, Math.PI, CHORD);
        fill('#f0e0c0'); ellipse(cx, cy, r * 1.56, r * 0.44);
        noStroke(); for(const [x, y, c, d] of [[-0.45,0,'#c0304a',0.2],[-0.18,0.04,'#e8c860',0.18],[0.08,-0.02,'#7fbf5a',0.18],[0.32,0.04,'#6a3a8a',0.18],[0.5,-0.02,'#ee8a26',0.16]]){ fill(c); circle(cx + x * r, cy + y * r, d * r); }
        fill(255, 255, 255, 120); rect(cx - r * 0.52, cy + r * 0.12, r * 0.08, r * 0.3, 3);
        fill('#3f8a3a'); ellipse(cx + r * 0.05, cy - r * 0.38, r * 0.24, r * 0.12);
    },
    corn_salad(cx, cy, r){
        noStroke(); fill('#e8c850'); arc(cx, cy, r * 1.3, r * 0.6, Math.PI, 0, CHORD);
        iconBowl(cx, cy, r, '#f0d058', '#f2f2ee', '#3a7ab0');
        iconDots(cx, cy, r, '#f8e070', [[-0.35,-0.15],[-0.15,-0.22],[0.1,-0.24],[0.32,-0.14],[-0.05,-0.08],[0.2,-0.04]], 0.12);
        iconDots(cx, cy, r, '#d84a3a', [[-0.3,0.02],[0.12,0.04],[0.4,0.02],[-0.02,-0.18]], 0.12);
        iconDots(cx, cy, r, '#4f8a3a', [[0.25,-0.18],[-0.42,-0.04]], 0.1);
    },

    /* --- rice, potatoes, soups and stews --- */
    cooked_rice(cx, cy, r){
        iconBowl(cx, cy, r, '#f8f5ec', '#e4ecf4', '#4a72b0');
        stroke('#d8d2c0'); strokeWeight(1.2); fill('#f8f5ec'); arc(cx, cy + r * 0.02, r * 1.3, r * 0.9, Math.PI, 0, CHORD);
        iconDots(cx, cy, r, '#dcd5c2', [[-0.3,-0.12],[0,-0.28],[0.26,-0.1],[-0.1,-0.06],[0.12,-0.22]], 0.08);
        stroke('#a8743a'); strokeWeight(r * 0.07); line(cx + r * 0.12, cy - r * 0.2, cx + r * 0.72, cy - r * 0.72); line(cx + r * 0.24, cy - r * 0.16, cx + r * 0.8, cy - r * 0.62);
    },
    fried_rice(cx, cy, r){
        iconBowl(cx, cy, r, '#f0d890', '#5a2a22');
        stroke('#c8a850'); strokeWeight(1.2); fill('#f0d890'); arc(cx, cy + r * 0.02, r * 1.3, r * 0.8, Math.PI, 0, CHORD);
        iconDots(cx, cy, r, '#5fae3f', [[-0.3,-0.12],[0.25,-0.18],[0.05,-0.02],[-0.05,-0.3]], 0.1);
        iconDots(cx, cy, r, '#ee8a26', [[-0.12,-0.18],[0.32,-0.04],[-0.42,-0.02]], 0.09);
        iconDots(cx, cy, r, '#ffe680', [[0.1,-0.28],[-0.22,-0.02],[0.2,-0.08]], 0.12);
        iconSteam(cx, cy - r * 0.38, r);
    },
    curry_rice(cx, cy, r, L){      // rice on one side, curry on the other
        stroke('#c8c8c8'); strokeWeight(1.3); fill('#fafafa'); ellipse(cx, cy + r * 0.1, r * 1.6, r * 0.96);
        noFill(); stroke('#e4e4e4'); ellipse(cx, cy + r * 0.1, r * 1.3, r * 0.72);
        stroke('#d8d2c0'); fill('#f8f5ec'); iconBlob(cx, cy, r, [[-0.62,0.1],[-0.42,-0.22],[-0.05,-0.2],[0.02,0.1],[-0.1,0.4],[-0.45,0.36]]);
        noStroke(); fill(L.color); iconBlob(cx, cy, r, [[0.05,-0.18],[0.45,-0.2],[0.66,0.1],[0.45,0.4],[0.08,0.42],[-0.02,0.1]]);
        iconDots(cx, cy, r, '#ee8a26', [[0.3,-0.02],[0.18,0.24]], 0.14);
        iconDots(cx, cy, r, '#e8d090', [[0.45,0.15],[0.12,0.02]], 0.15);
        iconDots(cx, cy, r, '#6a3a22', [[0.36,0.3]], 0.15);
        iconSteam(cx + r * 0.3, cy - r * 0.3, r);
    },
    baked_potato(cx, cy, r, L){    // split open with butter melting in
        stroke(shade(L.color, -0.5)); strokeWeight(1.5); fill(L.color); ellipse(cx, cy + r * 0.15, r * 1.45, r * 0.86);
        iconDots(cx, cy, r, shade(L.color, -0.3), [[-0.5,0.25],[0.45,0.3],[-0.2,0.42],[0.25,0.45]], 0.07);
        stroke(shade(L.color, -0.4)); strokeWeight(1.2); fill('#f6e8b8'); ellipse(cx, cy + r * 0.02, r * 0.9, r * 0.34);
        noStroke(); fill('#ffe066'); rect(cx - r * 0.14, cy - r * 0.16, r * 0.28, r * 0.2, 2); fill(255, 224, 102, 160); ellipse(cx, cy + r * 0.06, r * 0.5, r * 0.12);
        iconSteam(cx, cy - r * 0.26, r);
    },
    fried_potatoes(cx, cy, r){     // fries in a red paper cup
        stroke('#b88a20'); strokeWeight(1); fill('#f0c858');
        for(let k = -3; k <= 3; k++){ const h = 0.6 + (k % 2 ? 0.12 : 0) + (k === 0 ? 0.08 : 0); rect(cx + (k * 0.13 - 0.06) * r, cy - h * r, r * 0.12, r * 0.6); }
        stroke('#7a1e18'); strokeWeight(1.5); fill('#c8342a'); quad(cx - r * 0.55, cy - r * 0.12, cx + r * 0.55, cy - r * 0.12, cx + r * 0.42, cy + r * 0.68, cx - r * 0.42, cy + r * 0.68);
        noStroke(); fill('#f3efe2'); circle(cx, cy + r * 0.26, r * 0.32); fill('#e8b830'); circle(cx, cy + r * 0.26, r * 0.16);
    },
    vegetable_stew(cx, cy, r, L){
        iconBowl(cx, cy, r, L.color);
        iconDots(cx, cy, r, '#ee8a26', [[-0.4,-0.02],[0.1,0.06],[0.42,-0.04]], 0.18);
        noStroke(); fill('#e8d090'); rect(cx - r * 0.15, cy - r * 0.1, r * 0.16, r * 0.14, 1); rect(cx + r * 0.22, cy - r * 0.02, r * 0.14, r * 0.12, 1);
        iconDots(cx, cy, r, '#5fae3f', [[-0.2,0.06],[0.3,-0.1],[-0.5,0.04]], 0.1);
        iconSteam(cx, cy - r * 0.2, r);
    },
    hearty_stew(cx, cy, r, L){     // a thick meat stew with a bone in it
        iconBone(cx + r * 0.25, cy - r * 0.02, cx + r * 0.6, cy - r * 0.55, r);
        iconBowl(cx, cy, r, L.color, '#5a3a22');
        noStroke(); fill('#6a2a18'); rect(cx - r * 0.45, cy - r * 0.08, r * 0.24, r * 0.18, 3); rect(cx - r * 0.08, cy - r * 0.02, r * 0.22, r * 0.16, 3);
        iconDots(cx, cy, r, '#ee8a26', [[-0.2,-0.08],[0.18,0.08]], 0.14);
        iconDots(cx, cy, r, '#5fae3f', [[0,-0.12],[-0.55,0.02]], 0.09);
        iconSteam(cx - r * 0.2, cy - r * 0.22, r);
    },
    tomato_soup(cx, cy, r, L){
        iconBowl(cx, cy, r, L.color, '#f2f2ee', '#c0402a');
        noFill(); stroke(L.accent ?? '#f3efe2'); strokeWeight(r * 0.07); arc(cx, cy, r * 0.6, r * 0.2, 0.4, Math.PI * 1.8); arc(cx + r * 0.05, cy, r * 0.3, r * 0.1, Math.PI, Math.PI * 2.6);
        noStroke(); fill('#3f8a3a'); iconEllipse(cx + r * 0.42, cy - r * 0.02, r * 0.24, r * 0.12, -0.4);
        iconSteam(cx - r * 0.1, cy - r * 0.2, r);
    },
    pumpkin_soup(cx, cy, r, L){    // served in a hollowed pumpkin
        stroke('#2f5a22'); strokeWeight(r * 0.12); line(cx + r * 0.55, cy - r * 0.02, cx + r * 0.66, cy - r * 0.3);
        stroke('#8a4a12'); strokeWeight(1.5); fill('#e8862a'); arc(cx, cy, r * 1.56, r * 1.3, 0, Math.PI, CHORD);
        noFill(); stroke('#b8601a'); strokeWeight(1.2); for(const w of [0.5, 1.0]) arc(cx, cy, r * w, r * 1.3, 0, Math.PI);
        stroke('#8a4a12'); strokeWeight(1.5); fill(shade(L.color, 0.15)); ellipse(cx, cy, r * 1.56, r * 0.44);
        noFill(); stroke(L.accent ?? '#f3efe2'); strokeWeight(r * 0.06); arc(cx - r * 0.1, cy, r * 0.6, r * 0.16, 0.2, Math.PI * 1.6);
        iconDots(cx, cy, r, '#f6eccc', [[0.25,-0.04],[0.35,0.04],[0.18,0.06]], 0.08);
        iconSteam(cx - r * 0.1, cy - r * 0.2, r);
    },
    corn_chowder(cx, cy, r, L){    // creamy, with kernels and a spoon
        stroke('#8a8a8a'); strokeWeight(r * 0.1); line(cx + r * 0.2, cy, cx + r * 0.7, cy - r * 0.6);
        iconBowl(cx, cy, r, '#f2e4a8', '#8a5a34');
        iconDots(cx, cy, r, L.color, [[-0.4,-0.02],[-0.2,0.06],[0,-0.06],[0.3,0.04],[-0.1,-0.1],[0.12,0.08],[0.45,-0.02]], 0.12);
        iconDots(cx, cy, r, '#4f8a3a', [[-0.3,-0.08],[0.22,-0.08]], 0.07);
        iconSteam(cx - r * 0.2, cy - r * 0.2, r);
    },

    egg_drop_soup(cx, cy, r, L){   // clear broth with ribbons of egg and green onion
        iconBowl(cx, cy, r, '#e8c868', '#f2f2ee', '#3f6a8a');
        noFill(); stroke('#fbf0b8'); strokeWeight(r * 0.09);
        bezier(cx - r * 0.5, cy, cx - r * 0.25, cy - r * 0.12, cx, cy + r * 0.1, cx + r * 0.3, cy - r * 0.04);
        iconDots(cx, cy, r, '#4f8a3a', [[-0.2,0.04],[0.35,0.02],[0.05,-0.08]], 0.1);
        iconSteam(cx - r * 0.1, cy - r * 0.2, r);
    },

    /* --- eggs --- */
    egg(cx, cy, r, L){             // a brown egg
        stroke(shade(L.color, -0.4)); strokeWeight(1.5); fill(L.color);
        ellipse(cx, cy + r * 0.05, r * 1.0, r * 1.3);
        iconSheen(cx - r * 0.18, cy - r * 0.25, r * 0.22, r * 0.36);
        iconDots(cx, cy, r, shade(L.color, -0.15), [[0.2,0.25],[0.1,-0.1],[-0.15,0.4]], 0.06);
    },
    boiled_egg(cx, cy, r, L){      // halved: white and a yolk
        stroke('#c8c0b0'); strokeWeight(1.5); fill('#fbfaf5');
        ellipse(cx, cy, r * 1.2, r * 1.45);
        noStroke(); fill(L.accent ?? '#f0c040'); circle(cx, cy + r * 0.1, r * 0.62);
        fill(255, 255, 255, 90); circle(cx - r * 0.1, cy, r * 0.2);
    },
    fried_egg(cx, cy, r, L){       // sunny side up
        stroke('#d8d0c0'); strokeWeight(1.5); fill('#fbfaf5');
        iconBlob(cx, cy, r, [[-0.7,0.1],[-0.5,-0.45],[0.0,-0.62],[0.55,-0.42],[0.72,0.1],[0.4,0.55],[-0.15,0.6],[-0.6,0.42]]);
        noStroke(); fill('#e8d8b0'); iconBlob(cx, cy, r * 0.9, [[-0.7,0.1],[-0.5,-0.45],[0.0,-0.62],[0.55,-0.42],[0.72,0.1],[0.4,0.55],[-0.15,0.6],[-0.6,0.42]]);
        fill('#fbfaf5'); iconBlob(cx, cy, r * 0.8, [[-0.7,0.1],[-0.5,-0.45],[0.0,-0.62],[0.55,-0.42],[0.72,0.1],[0.4,0.55],[-0.15,0.6],[-0.6,0.42]]);
        stroke(shade(L.accent ?? '#f0b030', -0.3)); strokeWeight(1); fill(L.accent ?? '#f0b030'); circle(cx + r * 0.05, cy - r * 0.02, r * 0.5);
        iconSheen(cx - r * 0.04, cy - r * 0.1, r * 0.16, r * 0.1);
    },
    omelette(cx, cy, r, L){        // a folded half moon with filling peeking out
        stroke(shade(L.color, -0.4)); strokeWeight(1.5); fill(L.color);
        arc(cx, cy - r * 0.1, r * 1.5, r * 1.3, 0, Math.PI, CHORD);
        noStroke(); fill(shade(L.color, 0.2)); arc(cx, cy - r * 0.1, r * 1.2, r * 0.9, 0.3, Math.PI - 0.3, CHORD);
        iconDots(cx, cy, r, L.accent ?? '#d84a3a', [[-0.45,-0.1],[0.1,-0.12],[0.5,-0.08]], 0.14);
        iconDots(cx, cy, r, '#4f8a3a', [[-0.2,-0.12],[0.3,-0.1]], 0.1);
    },

    /* --- drinks --- */
    smoothie(cx, cy, r, L){        // a tall glass with a straw
        stroke('#7a9aa6'); strokeWeight(1.5); fill(225, 240, 245, 140);
        quad(cx - r * 0.45, cy - r * 0.6, cx + r * 0.45, cy - r * 0.6, cx + r * 0.32, cy + r * 0.7, cx - r * 0.32, cy + r * 0.7);
        noStroke(); fill(L.color);
        quad(cx - r * 0.4, cy - r * 0.38, cx + r * 0.4, cy - r * 0.38, cx + r * 0.29, cy + r * 0.64, cx - r * 0.29, cy + r * 0.64);
        fill(shade(L.color, 0.25)); ellipse(cx, cy - r * 0.38, r * 0.8, r * 0.16);
        stroke(L.accent ?? '#f3efe2'); strokeWeight(r * 0.12); line(cx + r * 0.1, cy + r * 0.2, cx + r * 0.38, cy - r * 0.85);
        iconSheen(cx - r * 0.22, cy + r * 0.05, r * 0.1, r * 0.5);
    },
    juice(cx, cy, r, L){           // a short tumbler, with the fruit's leaf on the rim
        stroke('#7a9aa6'); strokeWeight(1.5); fill(225, 240, 245, 140);
        rect(cx - r * 0.45, cy - r * 0.35, r * 0.9, r * 1.0, 3);
        noStroke(); fill(L.color); rect(cx - r * 0.4, cy - r * 0.15, r * 0.8, r * 0.75, 2);
        fill(shade(L.color, 0.25)); rect(cx - r * 0.4, cy - r * 0.15, r * 0.8, r * 0.12, 2);
        fill(L.accent ?? '#6fae4a'); iconEllipse(cx + r * 0.42, cy - r * 0.42, r * 0.36, r * 0.18, -0.6);
        iconSheen(cx - r * 0.25, cy + r * 0.2, r * 0.1, r * 0.4);
    },
    tea(cx, cy, r, L){             // a steaming mug
        stroke('#8a8478'); strokeWeight(1.5); fill(L.accent ?? '#f3efe2');
        noFill(); strokeWeight(r * 0.14); arc(cx + r * 0.48, cy + r * 0.12, r * 0.5, r * 0.5, -Math.PI / 2, Math.PI / 2);
        strokeWeight(1.5); fill(L.accent ?? '#f3efe2'); rect(cx - r * 0.5, cy - r * 0.3, r * 0.95, r * 0.95, 0, 0, 4, 4);
        noStroke(); fill(L.color); ellipse(cx - r * 0.03, cy - r * 0.3, r * 0.85, r * 0.2);
        iconSteam(cx - r * 0.03, cy - r * 0.45, r);
    },

    /* --- ingredients --- */
    flour(cx, cy, r){              // a tied sack with a wheat mark
        stroke('#a89878'); strokeWeight(1.5); fill('#efe6d0');
        iconBlob(cx, cy, r, [[-0.56,0.62],[-0.62,0.1],[-0.32,-0.36],[-0.42,-0.64],[0.42,-0.64],[0.32,-0.36],[0.62,0.1],[0.56,0.62]]);
        stroke('#8a6a42'); strokeWeight(r * 0.09); line(cx - r * 0.34, cy - r * 0.38, cx + r * 0.34, cy - r * 0.38);
        stroke('#c9a040'); strokeWeight(1.3); line(cx, cy + r * 0.45, cx, cy - r * 0.1);
        noStroke(); fill('#c9a040'); for(let k = 0; k < 3; k++){ iconEllipse(cx - r * 0.08, cy + r * (0.25 - k * 0.14), r * 0.14, r * 0.08, -0.6); iconEllipse(cx + r * 0.08, cy + r * (0.25 - k * 0.14), r * 0.14, r * 0.08, 0.6); }
    },
    sugar(cx, cy, r){              // a little stack of sugar cubes
        const cube = (x, y, s) => {
            stroke('#b8b4a8'); strokeWeight(1);
            fill('#ffffff'); quad(x, y - s * 0.5, x + s * 0.5, y - s * 0.25, x, y, x - s * 0.5, y - s * 0.25);
            fill('#e6e2d6'); quad(x - s * 0.5, y - s * 0.25, x, y, x, y + s * 0.5, x - s * 0.5, y + s * 0.25);
            fill('#d4d0c4'); quad(x + s * 0.5, y - s * 0.25, x, y, x, y + s * 0.5, x + s * 0.5, y + s * 0.25);
        };
        cube(cx - r * 0.3, cy + r * 0.2, r * 0.66); cube(cx + r * 0.32, cy + r * 0.22, r * 0.66); cube(cx, cy - r * 0.26, r * 0.66);
        iconDots(cx, cy, r, '#ffffff', [[0.5,-0.5],[-0.55,-0.3]], 0.1);
    },
    biotics(cx, cy, r, L){         // a stoppered flask of bubbling green brew
        stroke('#7a9aa6'); strokeWeight(1.5); fill(225, 240, 245, 150);
        beginShape(); vertex(cx - r * 0.14, cy - r * 0.5); vertex(cx + r * 0.14, cy - r * 0.5); vertex(cx + r * 0.14, cy - r * 0.14); vertex(cx + r * 0.6, cy + r * 0.58); vertex(cx - r * 0.6, cy + r * 0.58); vertex(cx - r * 0.14, cy - r * 0.14); endShape(CLOSE);
        noStroke(); fill(L.color); beginShape(); vertex(cx - r * 0.36, cy + r * 0.18); vertex(cx + r * 0.36, cy + r * 0.18); vertex(cx + r * 0.54, cy + r * 0.52); vertex(cx - r * 0.54, cy + r * 0.52); endShape(CLOSE);
        iconDots(cx, cy, r, '#d8f0b0', [[-0.15,0.32],[0.12,0.4],[0.02,0.08],[-0.05,-0.12]], 0.1);
        fill(255, 255, 255, 120); rect(cx - r * 0.42, cy + r * 0.2, r * 0.06, r * 0.28, 2);
        stroke('#7a5432'); strokeWeight(1.2); fill('#b08a5a'); rect(cx - r * 0.18, cy - r * 0.7, r * 0.36, r * 0.24, 2);
    },

    /* --- crops (the produce item; keyed by crop id) --- */
    tomato(cx, cy, r, L){
        stroke(shade(L.color, -0.45)); strokeWeight(1.5); fill(L.color); ellipse(cx, cy + r * 0.08, r * 1.2, r * 1.05);
        noStroke(); fill(L.accent ?? '#4f8a3a'); for(let k = 0; k < 5; k++){ const a = -Math.PI / 2 + k * Math.PI * 2 / 5; iconEllipse(cx + Math.cos(a) * r * 0.14, cy - r * 0.4 + Math.sin(a) * r * 0.08, r * 0.3, r * 0.1, a); }
        stroke('#3f6a2a'); strokeWeight(r * 0.08); line(cx, cy - r * 0.42, cx + r * 0.05, cy - r * 0.62);
        iconSheen(cx - r * 0.25, cy - r * 0.08, r * 0.22, r * 0.3);
    },
    potato(cx, cy, r, L){
        stroke(shade(L.color, -0.45)); strokeWeight(1.5); fill(L.color);
        iconBlob(cx, cy, r, [[-0.7,0.05],[-0.45,-0.38],[0.05,-0.42],[0.55,-0.3],[0.72,0.1],[0.4,0.44],[-0.1,0.4],[-0.5,0.42]]);
        iconDots(cx, cy, r, shade(L.color, -0.35), [[-0.4,-0.1],[0.1,-0.2],[0.4,0.1],[-0.1,0.18],[0.25,-0.05]], 0.08);
        iconSheen(cx - r * 0.2, cy - r * 0.2, r * 0.4, r * 0.12);
    },
    onion(cx, cy, r, L){
        stroke('#c8a070'); strokeWeight(1.2); for(const x of [-0.1, 0, 0.1]) line(cx + x * r, cy + r * 0.56, cx + x * 1.6 * r, cy + r * 0.72);
        stroke(shade(L.color, -0.45)); strokeWeight(1.5); fill(L.color);
        beginShape(); vertex(cx, cy - r * 0.72); bezierVertex(cx + r * 0.1, cy - r * 0.3, cx + r * 0.75, cy - r * 0.2, cx + r * 0.6, cy + r * 0.25);
        bezierVertex(cx + r * 0.5, cy + r * 0.6, cx - r * 0.5, cy + r * 0.6, cx - r * 0.6, cy + r * 0.25);
        bezierVertex(cx - r * 0.75, cy - r * 0.2, cx - r * 0.1, cy - r * 0.3, cx, cy - r * 0.72); endShape(CLOSE);
        noFill(); stroke(shade(L.color, 0.3)); strokeWeight(1.2); for(const w of [0.5, 0.9]) arc(cx, cy + r * 0.12, r * w, r * 0.9, Math.PI * 1.15, Math.PI * 1.85);
        iconSheen(cx - r * 0.25, cy + r * 0.05, r * 0.15, r * 0.3);
    },
    garlic(cx, cy, r, L){
        stroke('#c8b080'); strokeWeight(1.2); for(const x of [-0.12, 0, 0.12]) line(cx + x * r, cy + r * 0.5, cx + x * 1.6 * r, cy + r * 0.68);
        stroke(shade(L.color, -0.4)); strokeWeight(1.5); fill(L.color);
        beginShape(); vertex(cx, cy - r * 0.7); bezierVertex(cx + r * 0.1, cy - r * 0.3, cx + r * 0.72, cy - r * 0.25, cx + r * 0.6, cy + r * 0.2);
        bezierVertex(cx + r * 0.48, cy + r * 0.56, cx - r * 0.48, cy + r * 0.56, cx - r * 0.6, cy + r * 0.2);
        bezierVertex(cx - r * 0.72, cy - r * 0.25, cx - r * 0.1, cy - r * 0.3, cx, cy - r * 0.7); endShape(CLOSE);
        noFill(); stroke(shade(L.color, -0.25)); strokeWeight(1.2);
        for(const x of [-0.3, 0, 0.3]) bezier(cx + x * 0.5 * r, cy - r * 0.3, cx + x * 1.2 * r, cy - r * 0.1, cx + x * 1.2 * r, cy + r * 0.3, cx + x * r, cy + r * 0.48);
    },
    nuts(cx, cy, r, L){            // two acorn-like nuts with caps
        for(const [x, y] of [[-0.28, 0.12], [0.3, 0.0]]){
            stroke(shade(L.color, -0.45)); strokeWeight(1.3); fill(L.color); ellipse(cx + x * r, cy + (y + 0.14) * r, r * 0.5, r * 0.62);
            fill(shade(L.color, -0.3)); arc(cx + x * r, cy + (y - 0.04) * r, r * 0.6, r * 0.42, Math.PI, 0, CHORD);
            stroke(shade(L.color, -0.5)); strokeWeight(r * 0.06); line(cx + x * r, cy + (y - 0.24) * r, cx + (x + 0.05) * r, cy + (y - 0.36) * r);
            iconSheen(cx + (x - 0.1) * r, cy + (y + 0.18) * r, r * 0.1, r * 0.22);
        }
    },
    pumpkin(cx, cy, r, L){
        stroke('#3f6a2a'); strokeWeight(r * 0.14); line(cx, cy - r * 0.32, cx + r * 0.08, cy - r * 0.6);
        noFill(); stroke(L.accent ?? '#4c8a34'); strokeWeight(1.2); bezier(cx + r * 0.06, cy - r * 0.5, cx + r * 0.3, cy - r * 0.7, cx + r * 0.45, cy - r * 0.4, cx + r * 0.3, cy - r * 0.42);
        stroke(shade(L.color, -0.45)); strokeWeight(1.5);
        fill(shade(L.color, -0.12)); ellipse(cx - r * 0.34, cy + r * 0.1, r * 0.66, r * 0.86); ellipse(cx + r * 0.34, cy + r * 0.1, r * 0.66, r * 0.86);
        fill(L.color); ellipse(cx, cy + r * 0.1, r * 0.64, r * 0.92);
        iconSheen(cx - r * 0.08, cy - r * 0.12, r * 0.12, r * 0.3);
    },
    corn(cx, cy, r, L){            // a cob in its husk
        stroke('#3f7a2e'); strokeWeight(1.3); fill(L.accent ?? '#6aa63a');
        beginShape(); vertex(cx - r * 0.05, cy + r * 0.7); vertex(cx - r * 0.55, cy - r * 0.1); vertex(cx - r * 0.2, cy + r * 0.2); endShape(CLOSE);
        beginShape(); vertex(cx + r * 0.05, cy + r * 0.7); vertex(cx + r * 0.55, cy - r * 0.05); vertex(cx + r * 0.2, cy + r * 0.25); endShape(CLOSE);
        stroke(shade(L.color, -0.45)); strokeWeight(1.5); fill(L.color); ellipse(cx, cy - r * 0.05, r * 0.6, r * 1.3);
        noStroke(); fill(shade(L.color, 0.25));
        for(let row = 0; row < 6; row++) for(const c of [-1, 0, 1]){ const y = cy + r * (-0.52 + row * 0.18), w = Math.sqrt(Math.max(0, 1 - ((y - cy + r * 0.05) / (r * 0.62)) ** 2)); if(w > 0.3) circle(cx + c * r * 0.15 * w, y, r * 0.11); }
        stroke('#3f7a2e'); strokeWeight(1.3); fill(L.accent ?? '#6aa63a');
        beginShape(); vertex(cx, cy + r * 0.72); vertex(cx - r * 0.3, cy + r * 0.05); vertex(cx - r * 0.05, cy + r * 0.3); endShape(CLOSE);
    },
    rice(cx, cy, r, L){            // a drooping rice stalk heavy with grains
        noFill(); stroke(L.accent ?? '#8fbf5a'); strokeWeight(1.8);
        bezier(cx - r * 0.35, cy + r * 0.72, cx - r * 0.3, cy - r * 0.3, cx + r * 0.2, cy - r * 0.7, cx + r * 0.55, cy - r * 0.1);
        for(let k = 0; k <= 8; k++){
            const t = 0.35 + k * 0.08, u = 1 - t;
            const x = u ** 3 * -0.35 + 3 * u * u * t * -0.3 + 3 * u * t * t * 0.2 + t ** 3 * 0.55, y = u ** 3 * 0.72 + 3 * u * u * t * -0.3 + 3 * u * t * t * -0.7 + t ** 3 * -0.1;
            stroke(shade(L.color, -0.35)); strokeWeight(1); fill(L.color);
            iconEllipse(cx + (x - 0.08) * r, cy + (y + 0.1) * r, r * 0.12, r * 0.22, 0.5); iconEllipse(cx + (x + 0.08) * r, cy + (y + 0.12) * r, r * 0.12, r * 0.22, -0.3);
        }
    },
    ginger(cx, cy, r, L){          // a knobbly root
        stroke(shade(L.color, -0.45)); strokeWeight(1.5); fill(L.color);
        for(const [x, y, w, h, a] of [[-0.25, 0.1, 0.9, 0.42, -0.2], [0.35, -0.1, 0.5, 0.34, 0.6], [-0.45, -0.25, 0.4, 0.3, -0.9], [0.2, 0.35, 0.44, 0.3, 0.3]]) iconEllipse(cx + x * r, cy + y * r, w * r, h * r, a);
        noFill(); stroke(shade(L.color, -0.3)); strokeWeight(1); for(const x of [-0.45, -0.15, 0.15]) arc(cx + x * r, cy + r * 0.1, r * 0.1, r * 0.3, -1.2, 1.2);
        iconDots(cx, cy, r, '#e8b890', [[0.52,-0.22],[-0.6,-0.36]], 0.1);
    },
    hemp(cx, cy, r, L){            // a fan of narrow serrated leaflets
        stroke(shade(L.color, -0.4)); strokeWeight(1.8); line(cx, cy + r * 0.72, cx, cy + r * 0.1);
        for(let k = 0; k < 7; k++){
            const a = -Math.PI / 2 + (k - 3) * 0.42, len = (k === 3 ? 0.86 : k === 2 || k === 4 ? 0.78 : k === 1 || k === 5 ? 0.64 : 0.48);
            const mx = cx + Math.cos(a) * len * r * 0.72, my = cy + r * 0.1 + Math.sin(a) * len * r * 0.72;
            stroke(shade(L.color, -0.35)); strokeWeight(1); fill(k % 2 ? L.color : shade(L.color, -0.1)); iconEllipse(mx, my, len * r, r * 0.2, a);
        }
    },
};
// raw / cooked fish: art 'fish_<kind>' for every ICON_FISH species (a FISH entry without one keeps the plain fish icon)
for(const [k, P] of Object.entries(ICON_FISH)) ICON_ART[`fish_${k}`] = (cx, cy, r, L) => iconFish(cx, cy, r, P, !!L.cooked);

/** Draws an item (instance or id) centered at (cx, cy) in a box of size s. */
function drawItemIcon(item, cx, cy, s){
    const look = Items.look(item), col = look.color, dk = shade(col, -0.4), r = s / 2;
    const art = ICON_ART[look.art] ?? ICON_ART[typeof item === 'string' ? item : item && item.id];
    push(); strokeWeight(1.5); stroke(dk); fill(col);
    if(art){ art(cx, cy, r, look, item); pop(); return; }
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
            noStroke(); fill(look.accent || (w && w.value > 0 ? '#4aa3ff' : shade(col, -0.3)));   // accent = what's in it (milk)
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
        case 'heart_stone': {   // like the placed block: a stone plinth with a glowing heart crystal on top
            const ac = look.accent || '#e0506e';
            fill(shade(col, -0.15)); rect(cx - r * 0.62, cy + r * 0.14, r * 1.24, r * 0.5, 3);
            fill(col); rect(cx - r * 0.44, cy - r * 0.06, r * 0.88, r * 0.26, 2);
            noStroke(); fill(224, 80, 110, 70); ellipse(cx, cy - r * 0.4, r * 1.2, r * 1.05);   // glow
            fill(ac); stroke(shade(ac, -0.45)); strokeWeight(1.2);
            beginShape();
            vertex(cx, cy - r * 0.04);
            bezierVertex(cx - r * 0.6, cy - r * 0.38, cx - r * 0.38, cy - r * 0.9, cx, cy - r * 0.62);
            bezierVertex(cx + r * 0.38, cy - r * 0.9, cx + r * 0.6, cy - r * 0.38, cx, cy - r * 0.04);
            endShape(CLOSE);
            noStroke(); fill(255, 255, 255, 150); ellipse(cx - r * 0.18, cy - r * 0.52, r * 0.18, r * 0.13);
            break;
        }
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
        case 'fish':   // raw: the fish's color; cooked: browned, with its color as the accent
            fill(col); ellipse(cx - r * 0.08, cy, r * 1.15, r * 0.6);
            triangle(cx + r * 0.42, cy, cx + r * 0.78, cy - r * 0.32, cx + r * 0.78, cy + r * 0.32);
            noStroke(); fill(look.accent || shade(col, 0.3)); ellipse(cx - r * 0.05, cy + r * 0.1, r * 0.7, r * 0.18);
            fill('#1e1e1e'); circle(cx - r * 0.45, cy - r * 0.06, r * 0.12);
            break;
        case 'rod':    // the rod, its line and the hook (the hook is the metal's color)
            strokeWeight(r * 0.16); stroke('#7a5532'); line(cx - r * 0.65, cy + r * 0.65, cx + r * 0.55, cy - r * 0.6);
            strokeWeight(1); stroke(look.accent || '#e8e2d0'); line(cx + r * 0.55, cy - r * 0.6, cx + r * 0.55, cy + r * 0.25);
            noFill(); strokeWeight(r * 0.12); stroke(col); arc(cx + r * 0.45, cy + r * 0.25, r * 0.22, r * 0.3, 0, Math.PI);
            strokeWeight(1.5); stroke(dk); fill(col); circle(cx - r * 0.35, cy + r * 0.35, r * 0.28);   // the reel
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
        case 'hide':   // a pelt: wet / raw ones have a bluish tint
            beginShape(); vertex(cx - r * 0.7, cy - r * 0.4); vertex(cx - r * 0.2, cy - r * 0.55); vertex(cx + r * 0.2, cy - r * 0.45); vertex(cx + r * 0.7, cy - r * 0.55);
            vertex(cx + r * 0.55, cy); vertex(cx + r * 0.75, cy + r * 0.5); vertex(cx + r * 0.1, cy + r * 0.4); vertex(cx - r * 0.3, cy + r * 0.6); vertex(cx - r * 0.5, cy + r * 0.1); endShape(CLOSE);
            if(look.accent){ noStroke(); fill(look.accent + '55'); ellipse(cx, cy, r * 0.9, r * 0.5); }
            break;
        case 'rubber':
            fill(col); rect(cx - r * 0.6, cy - r * 0.35, r * 1.2, r * 0.7, r * 0.3);
            noStroke(); fill(255, 255, 255, 60); ellipse(cx - r * 0.2, cy - r * 0.15, r * 0.5, r * 0.18);
            break;
        case 'rack':
            strokeWeight(r * 0.16); stroke('#6b4a2a');
            line(cx - r * 0.65, cy + r * 0.6, cx - r * 0.65, cy - r * 0.6); line(cx + r * 0.65, cy + r * 0.6, cx + r * 0.65, cy - r * 0.6); line(cx - r * 0.75, cy - r * 0.5, cx + r * 0.75, cy - r * 0.5);
            noStroke(); fill('#9a4a3a'); rect(cx - r * 0.45, cy - r * 0.45, r * 0.25, r * 0.7, 2); fill('#b07a45'); rect(cx - r * 0.08, cy - r * 0.45, r * 0.3, r * 0.9, 2); fill('#7a3a32'); rect(cx + r * 0.35, cy - r * 0.45, r * 0.2, r * 0.55, 2);
            break;
        case 'bandage':   // a rolled strip of cloth with a red cross
            fill(col); stroke(shade(col, -0.35)); strokeWeight(1.5); rect(cx - r * 0.7, cy - r * 0.3, r * 1.4, r * 0.6, r * 0.3);
            noStroke(); fill(look.accent || '#c0402a'); rect(cx - r * 0.07, cy - r * 0.22, r * 0.14, r * 0.44); rect(cx - r * 0.22, cy - r * 0.07, r * 0.44, r * 0.14);
            break;
        case 'kitchen':   // a counter with a cutting board and a bowl
            fill(shade(col, -0.35)); rect(cx - r * 0.6, cy + r * 0.25, r * 0.2, r * 0.4); rect(cx + r * 0.4, cy + r * 0.25, r * 0.2, r * 0.4);
            fill(col); stroke(shade(col, -0.4)); strokeWeight(1.5); rect(cx - r * 0.75, cy - r * 0.45, r * 1.5, r * 0.75, 3);
            noStroke(); fill('#8a6a3a'); rect(cx - r * 0.55, cy - r * 0.35, r * 0.65, r * 0.45, 2);
            fill(look.accent || '#e8e2d0'); ellipse(cx + r * 0.38, cy - r * 0.1, r * 0.5, r * 0.3);
            break;
        case 'boat':
            fill(shade(col, -0.2)); arc(cx, cy, r * 1.6, r * 1.1, 0, Math.PI, CHORD);
            fill(col); ellipse(cx, cy, r * 1.6, r * 0.5);
            noFill(); stroke(look.accent || '#3f3f46'); strokeWeight(2); ellipse(cx, cy, r * 1.6, r * 0.5);
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
    if(over && Pad.active){ noFill(); stroke(255, 255, 255, 190); strokeWeight(2); rect(x - 2, y - 2, SLOT + 4, SLOT + 4, 9); noStroke(); }   // the controller's cursor is on it
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
        const bd = player.bandageCd > 0 && item.get('bandage');
        if(bd){   // cooling down: a shade that shrinks, and the seconds left
            noStroke(); fill(18, 22, 30, 170); const sh = SLOT * Math.min(1, player.bandageCd / bd.cooldown); rect(x, y + SLOT - sh, SLOT, sh, 7);
            fill(255); textSize(14); textAlign(CENTER, CENTER); text(Math.ceil(player.bandageCd), x + SLOT / 2, y + SLOT / 2);
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
    if(rate > 0) extra.push([T('hud.starving', { rate: rate.toFixed(2) }), '#ff8a7a']);
    if(isSneaking()) extra.push([T('hud.sneaking', { pct: pct(1 - stealthSight(skillLevel('hunter'))) }), '#c9a86a']);
    if(p.poison) extra.push([T('hud.poisoned', { rate: p.poison.dps.toFixed(1), secs: Math.ceil(p.poison.left) }), '#c6ff6a']);
    if(p.regenBuff) extra.push([T('hud.wellFed', { rate: p.regenBuff.rate.toFixed(1), secs: Math.ceil(p.regenBuff.left) }), '#ff9ac0']);
    if(def > 0) extra.push([T('hud.armor', { def, pct: Math.round(100 - 100 * ARMOR_SCALE / (ARMOR_SCALE + def)) }), '#bcd6ff']);
    const bottom = 12 + 140 + extra.length * 18;
    panel(12, 12, 248, 140 + extra.length * 18);
    statBar(24, 24, 150, T('hud.health'), p.health, p.maxHealth, '#e05555');
    statBar(24, 46, 150, T('hud.hunger'), p.hunger, 100, '#e0a040', p.satruation, R.hunger.threshold);
    statBar(24, 68, 150, T('hud.thirst'), p.thirst, 100, '#4aa3ff', 0, R.thirst.threshold);
    // experience: the bar fills toward the next level
    // the level label sits above the bar, at the same size as the health / hunger / thirst labels
    noStroke(); fill(235); textAlign(LEFT, CENTER);
    const lvText = T('hud.level', { level: Levels.level, xp: Math.floor(Levels.xp), need: Levels.need() }), lvRoom = 248 - 24;
    let lvSize = 11;
    textSize(lvSize);
    while(lvSize > 7.5 && textWidth(lvText) > lvRoom) textSize(lvSize -= 0.5);
    text(lvText, 24, 96);
    fill(255, 255, 255, 25); rect(24, 108, 150, 12, 6);
    fill('#9ad84a'); rect(24, 108, 150 * Math.min(1, Levels.fraction), 12, 6);
    if(Levels.flash.until > performance.now()){ fill('#d8ff9a'); textSize(10.5); text(Levels.flash.text, 24, 130); }
    textSize(11); textAlign(LEFT, CENTER);
    extra.forEach(([t, c], k) => { fill(c); text(t, 24, 148 + k * 18); });
    return bottom;   // y of the panel's bottom edge
}
/** The level-up pick: three cards over a dimmed world. Click one or press 1 / 2 / 3. */
/** A coloured button for the item menu / confirm pop-up. */
function colorButton(x, y, w, h, label, enabled, onClick, base){
    const over = enabled && mouse.rawX >= x && mouse.rawX <= x + w && mouse.rawY >= y && mouse.rawY <= y + h;
    noStroke(); fill(enabled ? shade(base, over ? 0.15 : 0) : '#3a3d44'); rect(x, y, w, h, 6);
    fill(enabled ? 255 : 140); textSize(12); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2 + 1);
    return region(x, y, w, h, { kind:'button', enabled, onClick });
}
function drawItemMenu(){
    const im = GameUI.itemMenu, it = im && refItem(im.ref);
    if(!it){ GameUI.itemMenu = null; return; }
    im.amount = Math.max(1, Math.min(Math.max(1, it.count - 1), im.amount));
    const L = itemMenuLayout(im), { x, y, w, h } = L;
    panel(x, y, w, h, null, { kind:'itemMenu' });
    drawItemIcon(it, x + 28, y + 28, 34);
    noStroke(); fill(240); textAlign(LEFT, TOP); textStyle(BOLD); textSize(14); text(nameOf(it.id), x + 54, y + 12); textStyle(NORMAL);
    fill(170); textSize(11.5); text(T('itemMenu.inStack', { n: it.count }), x + 54, y + 32);
    let by = y + 58;
    if(L.canSplit){
        fill(220); textSize(12); textAlign(LEFT, TOP); text(T('itemMenu.splitOff'), x + 16, by);
        textAlign(RIGHT, TOP); fill('#ffd75e'); text(T('itemMenu.splitAmount', { n: im.amount, keep: it.count - im.amount }), x + w - 16, by);
        const k = it.count > 2 ? (im.amount - 1) / (it.count - 2) : 0, hx = L.sx + k * L.sw, ty = L.sy + 6;
        noStroke(); fill(60, 66, 80); rect(L.sx, ty - 3, L.sw, 6, 3);
        fill('#4f8f5a'); rect(L.sx, ty - 3, hx - L.sx, 6, 3);
        fill(im.dragging ? '#ffe9a0' : '#ffd75e'); stroke(20, 24, 32); strokeWeight(1.5); circle(hx, ty, 15); noStroke();
        region(L.sx - 8, L.sy - 6, L.sw + 16, 26, { kind:'itemSlider' });
        colorButton(x + 16, y + 104, w - 32, 26, T('itemMenu.splitButton', { n: im.amount }), true, () => {
            if(splitAmountRef(im.ref, im.amount)) closeItemMenu(); else notify(T('itemMenu.noFreeSlot'), '#ff8a7a');
        }, '#3d7347');
        by = y + 138;
    } else by = y + 62;
    for(const a of itemMenuActions(it, im.ref)){   // eat / drink / pour water between a bucket and a canteen
        colorButton(x + 16, by, w - 32, 26, a.label, a.enabled, a.run, a.color);
        by += 32;
    }
    if(L.dump){   // bucket: dump some or all of its water (the slider starts at all of it)
        const wv = waterOf(it), n = dumpAmount(im, wv), sx = x + 16, sw = w - 32, ty = by + 26;
        im.dumpSlider = { sx, sw };
        fill(220); noStroke(); textSize(12); textAlign(LEFT, TOP); text(T('itemMenu.dumpWater'), sx, by + 4);
        textAlign(RIGHT, TOP); fill('#8fd0ff'); text(wv.value > 0 ? T('itemMenu.nOf', { n, of: wv.value }) : T('itemMenu.empty'), x + w - 16, by + 4);
        const k = wv.value > 1 ? (n - 1) / (wv.value - 1) : wv.value > 0 ? 1 : 0, hx = sx + k * sw;
        noStroke(); fill(60, 66, 80); rect(sx, ty - 3, sw, 6, 3);
        fill('#3a7fb8'); rect(sx, ty - 3, hx - sx, 6, 3);
        if(wv.value > 0){
            fill(im.dragging === 'dump' ? '#d8f2ff' : '#8fd0ff'); stroke(20, 24, 32); strokeWeight(1.5); circle(hx, ty, 15); noStroke();
            region(sx - 8, ty - 12, sw + 16, 24, { kind:'dumpSlider' });
        }
        colorButton(sx, by + 42, sw, 26, wv.value > 0 ? T(n === wv.value ? 'itemMenu.dumpAll' : 'itemMenu.dumpN', { n }) : T('itemMenu.bucketEmpty'), wv.value > 0,
            () => { dumpWater(it, n); im.dump = null; }, '#356a96');
        by += 78;
    }
    colorButton(x + 16, by, w - 32, 26, T('itemMenu.delete'), true, () => { GameUI.confirmDelete = { ref: im.ref }; }, '#a2433e');
}
function drawConfirmDelete(){
    const cd = GameUI.confirmDelete, it = cd && refItem(cd.ref);
    if(!it){ GameUI.confirmDelete = null; return; }
    noStroke(); fill(6, 8, 14, 170); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the pop-up reacts
    const w = 320, h = 150, x = Math.round(width / 2 - w / 2), y = Math.round(height / 2 - h / 2);
    panel(x, y, w, h, T('itemMenu.deleteTitle'), { kind:'confirmDelete' });
    noStroke(); fill(225); textSize(13); textAlign(LEFT, TOP);
    text(T('itemMenu.deleteConfirm', { items: it.count > 1 ? T('item.count', { n: it.count, name: nameOf(it.id) }) : nameOf(it.id) }), x + 14, y + 40, w - 28, 44);
    colorButton(x + 14, y + h - 46, (w - 40) / 2, 32, T('itemMenu.delete'), true, () => { deleteRef(cd.ref); closeItemMenu(); }, '#a2433e');
    colorButton(x + 26 + (w - 40) / 2, y + h - 46, (w - 40) / 2, 32, T('ui.cancel'), true, () => { GameUI.confirmDelete = null; }, '#4a5568');
}
function drawChoice(){
    const c = GameUI.choice;
    noStroke(); fill(6, 8, 14, 190); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the cards reacts to the mouse
    const cw = 230, ch = 250, gap = 18, total = c.options.length * cw + (c.options.length - 1) * gap;
    const x0 = Math.round(width / 2 - total / 2), y0 = Math.round(height / 2 - ch / 2);
    textAlign(CENTER, TOP); noStroke(); fill('#ffd75e'); textStyle(BOLD); textSize(24);
    text(T('choice.level', { level: Levels.level }), width / 2, y0 - 72);
    textStyle(NORMAL); fill(220); textSize(13);
    text(T('choice.choose') + (Levels.pending > 1 ? T('choice.waiting', { n: Levels.pending }) : ''), width / 2, y0 - 40);
    c.options.forEach((id, k) => {
        const d = Skills.defs[id], lv = Skills.level(id), x = x0 + k * (cw + gap);
        const over = mouse.rawX >= x && mouse.rawX <= x + cw && mouse.rawY >= y0 && mouse.rawY <= y0 + ch;
        noStroke(); fill(over ? 'rgba(34,42,56,0.98)' : 'rgba(22,28,38,0.96)'); rect(x, y0, cw, ch, 12);
        stroke(over ? d.color : 'rgba(255,255,255,0.18)'); strokeWeight(over ? 2.5 : 1); noFill(); rect(x + 0.5, y0 + 0.5, cw - 1, ch - 1, 12);
        noStroke(); fill(d.color); rect(x, y0, cw, 6, 12, 12, 0, 0);
        fill(150); textSize(11); textAlign(LEFT, TOP); text(T(d.kind === 'skill' ? 'choice.skill' : 'choice.upgrade'), x + 16, y0 + 18);
        textAlign(RIGHT, TOP); text(`[${k + 1}]`, x + cw - 16, y0 + 18);
        fill(245); textAlign(LEFT, TOP); textStyle(BOLD); textSize(18); text(d.name, x + 16, y0 + 38); textStyle(NORMAL);
        fill(d.color); textSize(12.5); text(lv === 0 ? T('choice.new') : T('choice.levelUp', { from: lv, to: lv + 1 }), x + 16, y0 + 66);
        // level pips
        for(let p = 0; p < d.max; p++){ fill(p < lv ? d.color : p === lv ? shade(d.color, -0.1) : 'rgba(255,255,255,0.14)'); if(p === lv){ stroke(255, 255, 255, 120); strokeWeight(1); } else noStroke(); rect(x + 16 + p * Math.min(18, (cw - 32) / d.max), y0 + 88, Math.min(14, (cw - 32) / d.max - 3), 6, 2); }
        noStroke(); fill(215); textSize(12.5); textAlign(LEFT, TOP);
        text(d.desc(lv + 1), x + 16, y0 + 108, cw - 32, 80);
        if(lv > 0){ fill(130); textSize(11); text(T('choice.now', { text: d.desc(lv) }), x + 16, y0 + ch - 56, cw - 32, 44); }
        region(x, y0, cw, ch, { kind:'button', enabled:true, onClick: () => selectChoice(id) });
    });
    if(c.confirm) drawChoiceConfirm(c);
}
/** "Take this one?" over the level-up cards: Confirm takes it, Back returns to the cards. */
function drawChoiceConfirm(c){
    const id = c.confirm, k = c.options.indexOf(id), d = Skills.defs[id], lv = Skills.level(id);
    noStroke(); fill(6, 8, 14, 200); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // the cards wait under it
    textSize(12.5);
    const w = 380, body = d.desc(lv + 1), bodyH = Math.max(2, tutLineCount(body, w - 40)) * 17;
    const h = 160 + bodyH, x = Math.round(width / 2 - w / 2), y = Math.round(height / 2 - h / 2);
    panel(x, y, w, h);
    noStroke(); fill(d.color); rect(x, y, w, 6, 10, 10, 0, 0);
    textAlign(CENTER, TOP); fill(245); textStyle(BOLD); textSize(19); text(T('choice.confirmTitle', { name: d.name }), x + w / 2, y + 22); textStyle(NORMAL);
    fill(d.color); textSize(12.5); text(lv === 0 ? T('choice.new') : T('choice.levelUp', { from: lv, to: lv + 1 }), x + w / 2, y + 50);
    fill(215); textAlign(LEFT, TOP); textLeading(17); text(body, x + 20, y + 74, w - 40, bodyH + 17);
    // a fast double-click on a card doesn't also hit Confirm: the buttons wake up after a moment
    const ready = performance.now() - (c.confirmAt || 0) > 300;
    const bw = (w - 50) / 2, by = y + h - 50;
    colorButton(x + 20, by, bw, 32, T('choice.back'), ready, () => { c.confirm = null; }, '#4a5160');
    colorButton(x + 30 + bw, by, bw, 32, T('choice.confirm'), ready, () => pickChoice(id), '#3d7347');
    fill(140); textSize(10.5); textAlign(CENTER, TOP);
    text(Pad.active ? T('choice.confirmPad', { close: bindLabel(Binds.shown('close')) })
                    : T('choice.confirmKeys', { key: bindLabel(Binds.get(HOTBAR_ACTIONS[k])), close: bindLabel(Binds.get('close')) }), x + w / 2, by - 20);
}
/** K: every skill and upgrade, with its level. */
function drawSkills(){
    const ids = Object.keys(Skills.defs), w = 360, rowH = 38, h = 52 + ids.length * rowH + 14;
    const x = Math.round(width / 2 - w / 2), y = Math.max(12, Math.round(height / 2 - h / 2));
    panel(x, y, w, h, T('skills.title', { level: Levels.level }));
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(T('skills.close', keyVars()), x + w - 14, y + 13);
    ids.forEach((id, k) => {
        const d = Skills.defs[id], lv = Skills.level(id), ry = y + 40 + k * rowH;
        noStroke(); fill(lv ? 235 : 150); textSize(12.5); textAlign(LEFT, TOP); text(d.name, x + 14, ry);
        fill(lv ? 170 : 125); textSize(10.5); text(lv ? d.desc(lv) : T(d.kind === 'skill' ? 'skills.notLearned' : 'skills.notTaken'), x + 14, ry + 16, w - 28, 22);
        for(let p = 0; p < d.max; p++){ fill(p < lv ? d.color : 'rgba(255,255,255,0.14)'); rect(x + w - 14 - (d.max - p) * 9, ry + 3, 7, 7, 2); }
    });
}
/** Top-right: time, date, season, temperature and weather. Returns the panel's bottom y. */
function drawClock(){
    const w = 236, x = width - w - 12, y = 12, rates = climateRates();
    const effects = [];
    if(rates.thirst > 1.001) effects.push(T('clock.thirstRate', { x: rates.thirst.toFixed(2) }));
    if(rates.hunger > 1.001) effects.push(T('clock.hungerRate', { x: rates.hunger.toFixed(2) }));
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
    textStyle(NORMAL); textSize(11); fill(190); textAlign(RIGHT, CENTER); text(T('clock.day', { n: Math.max(1, Clock.dayIndex - Clock.startDay + 1) }), x + w - 12, iy);
    textAlign(LEFT, TOP); fill(225); textSize(11.5);
    text(Clock.dateText(), x + 14, y + 42);
    const season = Clock.season();
    fill('#c9e89a'); text(`${nameOf(season)}`, x + 14, y + 58);
    const t = Math.round(rates.temp);
    fill(t >= SURVIVAL.hotAbove ? '#ffb070' : t <= 0 ? '#9fd4ff' : t < SURVIVAL.coldBelow ? '#bcd6ff' : 225);
    text(`${t}°C`, x + 82, y + 58);
    fill(Weather.current ? '#bcd6ff' : 200); textAlign(RIGHT, TOP); text(Weather.name(), x + w - 12, y + 58);
    if(effects.length){ fill('#ffb070'); textAlign(LEFT, TOP); text(effects.join(T('list.sep')), x + 14, y + 76); }
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
    const name = c.month < 0 ? Clock.newYearName() : Clock.monthName(c.month);
    noStroke(); fill(255); textStyle(BOLD); textSize(14); textAlign(CENTER, TOP); text(name, x + w / 2, top + 10); textStyle(NORMAL);
    textSize(11); fill(scol); text(T('calendar.seasonYear', { season: nameOf(season), year: c.year }), x + w / 2, top + 30);
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
    text(T('calendar.today', { date: d.newYear ? d.monthName : T('calendar.monthDay', { month: d.monthName, day: d.dayOfMonth }), year: d.year }), x + 12, fy + 4);
    const later = Weather.next && Math.floor(Weather.next.start / Clock.day) === today ? T('calendar.later', { weather: nameOf(Weather.next.type).toLowerCase() }) : '';
    fill(200); text(T('weather.begin', { name: Weather.name() }) + later, x + 12, fy + 21);
    const onToday = c.year === d.year && c.month === (d.newYear ? -1 : d.month);
    button(x + w - 64, fy + 6, 52, 24, T('calendar.todayButton'), !onToday, () => { const t = Clock.date(); c.year = t.year; c.month = t.newYear ? -1 : t.month; }, true);
    noStroke(); fill('#8fd0ff'); circle(x + 16, fy + 44, 4);
    fill(150); textSize(10); textAlign(LEFT, CENTER); text(T('calendar.arrived'), x + 24, fy + 44);
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
        let label = nameOf(held.id);
        const m = held.get('mining'), w = waterOf(held);
        if(m) label += T('hotbar.tool', { tier: m.tier, tool: nameOf(m.classes[0]) });
        if(w) label += T('hotbar.water', { v: w.value, c: w.capacity });
        if(held instanceof CropSeedItem) label += T('hotbar.seed');
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
    panel(L.x, L.y, L.w, L.h, T('inv.backpack'));
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP);
    text(T('inv.tabClose', keyVars()), L.x + L.w - 42, L.y + 13);
    const slots = inv.backpackSlots;
    for(let k = 0; k < slots.length; k++){
        const cx = k % L.cols, cy = Math.floor(k / L.cols);
        drawSlot(L.x + 14 + cx * (SLOT + SLOT_GAP), L.y + 36 + cy * (SLOT + SLOT_GAP), slotRef(inv, slots[k]));
    }
    // worn armor, left of the backpack
    const gx = L.x - 72;
    panel(gx, L.y, 64, L.h);
    noStroke(); fill(200); textSize(11); textStyle(BOLD); textAlign(CENTER, TOP); text(T('inv.gear'), gx + 32, L.y + 11); textStyle(NORMAL);
    ARMOR_SLOTS.forEach((s, k) => drawSlot(gx + 9, L.y + 30 + k * (SLOT + 4), slotRef(player.gear[s], 0), { hint: T('armor.slot.' + s) }));
    fill('#bcd6ff'); textSize(10.5); textAlign(CENTER, BOTTOM); text(T('inv.def', { def: playerDefense() }), gx + 32, L.y + L.h - 7);
    noStroke(); fill(150); textSize(10.5); textAlign(LEFT, BOTTOM);
    const shiftHelp = openContainer() ? T('inv.shiftStation', { station: STATION_TITLES[GameUI.station.kind].toLowerCase() }) : T('inv.shiftDefault');
    const pb = a => bindLabel(Binds.get(a, 'controller'));   // with a controller: its way of moving stacks (PadNav)
    const panels = GameUI.station ? T('inv.helpPadPanels', { prev: pb('hotbarprev'), next: pb('hotbarnext'), station: STATION_TITLES[GameUI.station.kind].toLowerCase() }) : '';
    text(Pad.active ? T('inv.helpPad', { select: pb('interact'), nav: T('pad.stick.' + Pad.otherStick()), split: pb('wheel'), panels })
                    : T('inv.help', { shift: shiftHelp }), L.x + 14, L.y + L.h - 7);
    if(L.craft){
        const c = L.craft;
        panel(c.x, c.y, c.w, c.h, T('inv.handCrafting'));
        drawRecipeList(c.x + 10, c.y + 36, c.w - 20, c.h - 44, Recipe.for('hand'), 'hand', T('station.generic.craft'), (r, shift) => craft(r, shift ? 64 : 1));
    }
}

/** The × button in a menu panel's top right corner: closes the station menu and the backpack together. */
function drawCloseButton(L){
    button(L.x + L.w - 32, L.y + 9, 22, 20, '×', true, () => closeMenus(), true).close = true;   // (PadNav doesn't start a menu on it)
}
/** A station panel's "... to close" line. With a controller {interact} is left out: in menus it selects (PadNav). */
const stationCloseText = (craftMax = false) => T(Pad.active ? 'station.closePad' : craftMax ? 'station.closeCraftMax' : 'station.close', keyVars());

function stationLayout(){
    const st = GameUI.station, cb = st && blockAt(st.x, st.y), slots = cb && cb.box ? cb.box.size : 0;   // a container (chest) shows its slots in a grid
    const own = st && PANEL_STATIONS[st.kind];
    if(own){
        const w = own.w ?? 460, h = Math.min(height - 170, own.h ?? 300);
        return { x: GameUI.inventoryOpen ? width / 2 + 8 : width / 2 - w / 2, y: Math.max(12, hotbarLayout().y - 44 - h), w, h };
    }
    const farm = !!(cb && cb.seeds);  // farmland: seedling slots + water slot + water gauge
    const w = farm ? (FARM.slots + 1) * (SLOT + SLOT_GAP) + 70 : slots ? 8 * (SLOT + SLOT_GAP) - SLOT_GAP + 28 : 460;
    const h = farm ? 236 : slots ? Math.ceil(slots / 8) * (SLOT + SLOT_GAP) - SLOT_GAP + 62 : Math.min(height - 170, 560);
    const x = GameUI.inventoryOpen ? width / 2 + 8 : width / 2 - w / 2;
    return { x, y: Math.max(12, hotbarLayout().y - 44 - h), w, h };
}
function drawStation(){
    const s = GameUI.station, b = blockAt(s.x, s.y), L = stationLayout();
    if(!b) return;
    if(PANEL_STATIONS[s.kind]){ PANEL_STATIONS[s.kind].draw(s, b, L); return; }   // its own menu (the heart stone)
    if(CRAFT_STATIONS.includes(s.kind)){
        // workbench (+ hand recipes), loom...: recipe menus (see defineStation)
        const verb = STATION_VERBS[s.kind] ?? T('station.generic.craft');
        panel(L.x, L.y, L.w, L.h, STATION_TITLES[s.kind]);
        noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(stationCloseText(true), L.x + L.w - 42, L.y + 13);
        const list = Recipe.for(s.kind, ...(STATION_ALSO[s.kind] ?? []));
        drawRecipeList(L.x + 10, L.y + 38, L.w - 20, L.h - 48, list, 'station', verb, (r, shift) => craft(r, shift ? 64 : 1), null, !NO_RECIPE_SEARCH.has(s.kind));
        return;
    }
    if(b.box){
        panel(L.x, L.y, L.w, L.h, T('station.chestTitle', { name: STATION_TITLES[s.kind], n: b.box.size }));
        noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(stationCloseText(), L.x + L.w - 42, L.y + 13);
        for(let k = 0; k < b.box.size; k++){
            const cx = k % 8, cy = Math.floor(k / 8);
            drawSlot(L.x + 14 + cx * (SLOT + SLOT_GAP), L.y + 36 + cy * (SLOT + SLOT_GAP), slotRef(b.box, k));
        }
        button(L.x + L.w - 120, L.y + L.h - 26, 106, 20, T('station.takeAll'), !b.box.isEmpty, () => { b.box.emptyInto(player.inventory); }, true);
        return;
    }
    if(b.seeds){ drawFarmlandPanel(s, b, L); return; }
    // machines (forge, cooking pot, drying rack...): input -> fuel -> output (see defineStation)
    const M = MACHINES[s.kind], rack = M.noFuel;
    panel(L.x, L.y, L.w, L.h, STATION_TITLES[s.kind]);
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(stationCloseText(), L.x + L.w - 42, L.y + 13);
    const top = L.y + 40, row = SLOT + SLOT_GAP;
    fill(200); textSize(11); textAlign(LEFT, TOP);
    text(T('machine.input'), L.x + 16, top); if(!rack) text(T('machine.fuel'), L.x + 16 + 4 * row + 14, top); text(T('machine.output'), L.x + L.w - 16 - 2 * row + SLOT_GAP, top);
    for(let k = 0; k < b.input.size; k++) drawSlot(L.x + 16 + k * row, top + 16, slotRef(b.input, k), { hint: M.hint });
    const fx = L.x + 16 + 4 * row + 14;
    if(!rack) drawSlot(fx, top + 16, slotRef(b.fuel, 0), { hint: T('machine.fuelHint'), tint: b.lit ? 'rgba(255,150,46,0.25)' : null });
    for(let k = 0; k < b.output.size; k++) drawSlot(L.x + L.w - 16 - 2 * row + SLOT_GAP + k * row, top + 16, slotRef(b.output, k));
    // progress + fuel bars
    const r = b.active ? Recipe.byId(b.active) : null, by = top + 16 + SLOT + 12, bw = L.w - 32;
    noStroke(); fill(255, 255, 255, 25); rect(L.x + 16, by, bw, 10, 5);
    fill('#ff9a2e'); rect(L.x + 16, by, bw * (r ? Math.min(1, b.progress / r.time) : 0), 10, 5);
    if(!rack){
        fill(255, 255, 255, 25); rect(L.x + 16, by + 14, bw, 5, 3);
        fill('#ffd75e'); rect(L.x + 16, by + 14, bw * (b.burnMax ? b.burn / b.burnMax : 0), 5, 3);
    }
    const working = b.status.startsWith(M.verb);
    fill(working ? '#ffd28a' : 200); textSize(12); textAlign(LEFT, TOP);
    text(b.status + (r && working ? T('machine.eachTime', { secs: r.time.toFixed(0) }) : ''), L.x + 16, by + 26);
    fill(150); textSize(10.5);
    text(M.blurb, L.x + 16, by + 44);
    fill(210); textSize(12); text(M.listTitle, L.x + 16, by + 66);
    // ingredients count from the player's inventory plus what's already loaded in the input slots
    const have = { countOf: k => player.inventory.countOf(k) + b.input.countOf(k) };
    // picking a recipe makes it the machine's recipe and pulls its ingredients from the backpack into the input slots (shift: as many batches as fit)
    drawRecipeList(L.x + 10, by + 84, L.w - 20, L.y + L.h - by - 94, Recipe.for(s.kind), 'station', T('machine.select'),
        (r, shift) => selectMachineRecipe(b, s.kind, r, shift), have, true, b.selected);   // machines get the search bar too
}

/** The farmland panel: FARM.slots seedling slots (state + growth under each), the water slot, the water gauge and Harvest. */
function drawFarmlandPanel(s, b, L){
    const seedlings = farmSeedlings(b), byK = {};
    for(const e of seedlings) byK[e.k] = e;
    const crop = farmCrop(b);
    panel(L.x, L.y, L.w, L.h, nameOf('farmland') + (crop ? T('farmPanel.crop', { crop: nameOf(crop) }) : ''));
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(stationCloseText(), L.x + L.w - 42, L.y + 13);
    const top = L.y + 40, row = SLOT + SLOT_GAP, wx = L.x + 16 + FARM.slots * row + 22;
    fill(200); textSize(11); textAlign(LEFT, TOP);
    text(T('farmPanel.seedlings'), L.x + 16, top); text(T('farmPanel.waterIn'), wx, top);
    for(let k = 0; k < FARM.slots; k++){
        const sx = L.x + 16 + k * row, e = byK[k];
        const tint = !e ? null : e.info.rot ? 'rgba(140,100,40,0.35)' : e.info.ripe ? 'rgba(120,220,110,0.28)' : e.p.dry > 0 ? 'rgba(255,170,70,0.25)' : null;
        drawSlot(sx, top + 16, slotRef(b.seeds, k), { hint: T('farmPanel.seedHint'), tint });
        if(!e) continue;
        // growth toward ripe, and the state
        const c = e.info.crop, grown = e.info.ripe || e.info.rot ? 1 : Math.min(1, e.p.age / c.ripeAge);
        noStroke(); fill(255, 255, 255, 25); rect(sx, top + 16 + SLOT + 4, SLOT, 4, 2);
        fill(e.info.rot ? '#a08050' : e.info.ripe ? '#8fe39a' : '#d8e070'); rect(sx, top + 16 + SLOT + 4, SLOT * grown, 4, 2);
        fill(e.p.dry > 0 ? '#ffb070' : 200); textSize(10); textAlign(CENTER, TOP);
        text(e.p.dry > 0 && !e.info.rot ? T('farmPanel.dry') : seedlingState(e.info), sx + SLOT / 2, top + 16 + SLOT + 11);
    }
    drawSlot(wx, top + 16, slotRef(b.intake, 0), { hint: T('farmPanel.waterHint') });
    // water gauge: 0..waterMax, then the overflow above it (up to floodMax)
    const gy = top + 16 + SLOT + 34, bw = L.w - 32, over = Math.max(0, b.water - FARM.waterMax);
    noStroke(); fill(255, 255, 255, 25); rect(L.x + 16, gy, bw, 10, 5);
    fill('#4aa3ff'); rect(L.x + 16, gy, bw * Math.min(1, b.water / FARM.waterMax), 10, 5);
    if(over > 0){ fill('#a8ecff'); rect(L.x + 16, gy + 13, bw * Math.min(1, over / (FARM.floodMax - FARM.waterMax)), 4, 2); }
    fill(over > 0 ? '#a8ecff' : b.water <= 0 ? '#ffb070' : '#bfe3ff'); textSize(12); textAlign(LEFT, TOP);
    const ci = cellIndex(s.x, s.y), src = nextToWater(ci) ? irrigationSource(ci) : null;
    const irr = src == null ? '' : src < 0 ? T('farmPanel.irrigationDry') : T('farmPanel.irrigated', { n: Theaya.water[src], max: WATER_UNITS });
    text(T('farmPanel.water', { w: Math.round(b.water), max: FARM.waterMax }) + (over > 0 ? T('farmPanel.overTop', { n: Math.round(over) }) : '') + irr, L.x + 16, gy + 20);
    fill(150); textSize(10.5);
    text(T('farmPanel.waterSlotHelp', { unit: FARM.bucketUnit, max: FARM.waterMax }), L.x + 16, gy + 38);
    const hl = farmHarvestLabel(b);
    button(L.x + 16, L.y + L.h - 32, Math.min(bw, 280), 22, hl ?? T('farmPanel.nothingReady'), !!hl, () => harvestFarmland(s.x, s.y), true);
}

/** The heart stone panel: spawn point, what it's repairing, and the radius / speed upgrades with their costs. */
function drawHeartStonePanel(s, b, L){
    const st = heartStats(b), H = HEART_STONE, i = cellIndex(s.x, s.y), home = Theaya.home === i;
    panel(L.x, L.y, L.w, L.h, STATION_TITLES[s.kind]);
    noStroke(); fill(170); textSize(11); textAlign(RIGHT, TOP); text(stationCloseText(), L.x + L.w - 42, L.y + 13);
    let y = L.y + 40;
    fill(150); textSize(10.5); textAlign(LEFT, TOP); text(T('heart.blurb'), L.x + 16, y, L.w - 32); y += 32;
    // spawn point
    fill(home ? '#ff9ab0' : 200); textSize(12); text(T(home ? 'heart.spawnHere' : 'heart.spawnElsewhere'), L.x + 16, y + 4);
    button(L.x + L.w - 150, y, 134, 22, T('heart.setSpawn'), !home, () => setHeartSpawn(i), true);
    y += 34;
    // what it's doing right now
    const n = heartDamaged(i, st.radius).length, showing = GameUI.heartRadius === i;
    fill(n ? '#ffd28a' : 150); textSize(11.5); textAlign(LEFT, TOP);
    text(n ? T('heart.repairing', { n }) : T('heart.nothingDamaged'), L.x + 16, y + 4);
    button(L.x + L.w - 150, y, 134, 22, T(showing ? 'heart.hideRadius' : 'heart.showRadius'), true, () => { GameUI.heartRadius = showing ? -1 : i; }, true);
    y += 32;
    // the two upgrades
    const rows = [
        { which:'radius', lvl: st.radiusLvl, label:'heart.radius', fmt: v => T('heart.cells', { n: v }), table: H.radius },
        { which:'rate',   lvl: st.rateLvl,   label:'heart.rate',   fmt: v => T('heart.perDay', { pct: Math.round(v * 100) }), table: H.rate },
    ];
    for(const r of rows){
        const cost = heartUpgradeCost(b, r.which), maxed = r.lvl >= H.maxLevel;
        noStroke(); fill(255, 255, 255, 12); rect(L.x + 10, y, L.w - 20, 62, 6);
        fill(240); textSize(13); textAlign(LEFT, TOP);
        text(T(r.label, { lvl: r.lvl, max: H.maxLevel, v: r.fmt(r.table[r.lvl - 1]) }), L.x + 18, y + 7);
        // level pips
        for(let k = 0; k < H.maxLevel; k++){ fill(k < r.lvl ? '#e0506e' : 'rgba(255,255,255,0.15)'); rect(L.x + 18 + k * 16, y + 27, 12, 5, 2); }
        textSize(11);
        if(maxed){ fill('#8fe39a'); text(T('heart.maxed'), L.x + 18, y + 40); }
        else {
            fill('#bcd6ff'); let tx = L.x + 18;
            const nx = T('heart.next', { v: r.fmt(r.table[r.lvl]) });
            text(nx, tx, y + 40); tx += textWidth(nx) + 12;
            for(const [k, need] of Object.entries(cost ?? {})){
                const t = T('item.count', { n: need, name: Recipe.label(k) });
                fill(player.inventory.countOf(k) >= need ? '#8fe39a' : '#ff8a7a'); text(t, tx, y + 40); tx += textWidth(t) + 10;
            }
        }
        button(L.x + L.w - 96, y + 18, 80, 24, maxed ? T('heart.maxed') : T('heart.upgrade'), !maxed && canAfford(cost), () => upgradeHeartStone(s.x, s.y, r.which), true);
        y += 70;
    }
}

/**
 * Scrollable recipe rows: icon, name, ingredients (green = have, red = short),
 * and a button (none when onCraft is null). `source` = where ingredients are
 * counted from: anything with countOf(key) (default: the player's inventory; machines pass inventory + input slots).
 * Crafting menus (`search`, which defaults to "onCraft given") get a search bar (RecipeSearch: matches the
 * recipe's name, and in Japanese its reading, see NameSearch) and a toggle between all recipes and only the craftable ones.
 * Every station has one (hand crafting, workbench, kitchen table, forge, pot, rack) except the loom (`search:false`).
 */
function drawRecipeList(x, y, w, h, recipes, scrollKey, verb, onCraft, source = null, search = !!onCraft, selectedId = null){
    const inv = source || player.inventory, rowH = 46;
    let query = '', onlyCraftable = false;
    if(search){
        const bw = 128, sh = 26;
        onlyCraftable = GameUI.craftFilter === 'craftable';
        RecipeSearch.placeholder = T('craft.search');
        RecipeSearch.place(x, y, w - bw - 8, sh).render();
        region(x, y, w - bw - 8, sh, { kind:'panel', text: true });   // clicks here type, they don't reach the world
        button(x + w - bw, y + 1, bw, sh - 2, T(onlyCraftable ? 'craft.showCraftable' : 'craft.showAll'), true,
            () => { GameUI.craftFilter = onlyCraftable ? 'all' : 'craftable'; GameUI.scroll[scrollKey] = 0; }, true);
        query = RecipeSearch.value.trim();
        y += sh + 8; h -= sh + 8;
    }
    const listRegion = region(x, y, w, h, { kind:'panel', scroll: scrollKey, maxScroll: 0 });   // (maxScroll: the controller's edge scrolling, see Pad)
    const matches = NameSearch.matcher(query);   // by name, or in Japanese also by reading (斧 / おの / オノ / ono)
    const sorted = recipes.map((r, i) => ({ r, i, ok: r.canCraft(inv) }))
        .filter(e => (!onlyCraftable || e.ok) && matches(e.r.output.id))
        .sort((a, b) => (b.ok - a.ok) || (a.i - b.i));
    if(!sorted.length && search){
        noStroke(); fill(150); textSize(12); textAlign(CENTER, TOP);
        text(query ? T('craft.noMatch', { q: RecipeSearch.value.trim() }) : T('craft.noneCraftable'), x + w / 2, y + 14);
        return;
    }
    const visible = Math.max(1, Math.floor(h / rowH));
    const maxScroll = listRegion.maxScroll = Math.max(0, sorted.length - visible);
    // scroll bar thumb: dragging it (GameUI.scrollDrag, started in handleInput) sets the scroll from the mouse
    const th = maxScroll > 0 ? Math.max(18, h * visible / sorted.length) : h, track = Math.max(1, h - th);
    const drag = GameUI.scrollDrag && GameUI.scrollDrag.key === scrollKey ? GameUI.scrollDrag : null;
    if(drag && maxScroll > 0) GameUI.scroll[scrollKey] = Math.round(Math.max(0, Math.min(1, (mouse.rawY - drag.grab - y) / track)) * maxScroll);
    GameUI.scroll[scrollKey] = Math.min(GameUI.scroll[scrollKey], maxScroll);
    const start = GameUI.scroll[scrollKey];
    for(let k = 0; k < visible && start + k < sorted.length; k++){
        const { r, ok } = sorted[start + k], ry = y + k * rowH;
        noStroke(); fill(255, 255, 255, k % 2 ? 6 : 14); rect(x, ry, w, rowH - 4, 6);
        if(selectedId && r.id === selectedId){ noFill(); stroke('#ffd75e'); strokeWeight(1.5); rect(x, ry, w, rowH - 4, 6); noStroke(); }   // the machine's chosen recipe
        drawItemIcon(r.output.id, x + 22, ry + rowH / 2 - 2, 32);
        region(x, ry, onCraft ? w - 80 : w, rowH - 4, { kind:'recipe', itemId: r.output.id, recipe: r, scroll: scrollKey, hasButton: !!onCraft });
        fill(ok ? 245 : 175); textSize(13); textAlign(LEFT, TOP);
        text(`${nameOf(r.output.id)}${r.output.count > 1 ? ' x' + r.output.count : ''}`, x + 44, ry + 5);
        textSize(11);
        let tx = x + 44;
        const parts = Object.entries(r.inputs).map(([key, n]) => ({ t: T('item.count', { n, name: Recipe.label(key) }), ok: inv.countOf(key) >= n }));
        if(r.time) parts.push({ t: T('recipe.time', { secs: r.time.toFixed(0) }), ok: true, note: true });
        for(const p of parts){
            fill(p.note ? '#ffd28a' : p.ok ? '#8fe39a' : '#ff8a7a');
            text(p.t, tx, ry + 24);
            tx += textWidth(p.t) + 12;
        }
        if(onCraft) button(x + w - 72, ry + 9, 64, 24, verb, ok, (shift) => onCraft(r, shift), true);
    }
    if(maxScroll > 0){
        // grabbable: drag the thumb, or click the track to jump there (see handleInput: kind 'scrollbar')
        const ty = y + track * (start / maxScroll), bx = x + w + 1, bw = 9;
        const over = mouse.rawX >= bx && mouse.rawX <= bx + bw && mouse.rawY >= y && mouse.rawY <= y + h;
        noStroke(); fill(255, 255, 255, over || drag ? 18 : 8); rect(x + w + 3, y, 5, h, 3);                  // track
        fill(255, 255, 255, drag ? 150 : over ? 95 : 45); rect(x + w + 3, ty, 5, th, 3);                       // thumb
        region(bx, y, bw, h, { kind:'scrollbar', key: scrollKey, scroll: scrollKey, thumbY: ty, thumbH: th });
    }
}

/**
 * Push boxes ({ x, y, w, h }) apart until none overlaps another (with `gap` between them) or any of the fixed
 * `walls`, keeping them on screen. Each overlap is undone along its shorter axis; boxes share the move, walls
 * don't move. Stops when nothing moved (or after `iters` rounds, when the screen is too crowded).
 */
function separateBoxes(boxes, walls = [], gap = 6, iters = 150){
    const clamp = b => { b.x = Math.max(6, Math.min(width - b.w - 6, b.x)); b.y = Math.max(6, Math.min(height - b.h - 6, b.y)); };
    const push = (a, b, share, order) => {
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if(ox <= 0 || oy <= 0) return false;
        if(ox < oy){
            const s = Math.sign((a.x + a.w / 2) - (b.x + b.w / 2)) || order;
            a.x += s * ox * share; b.x -= s * ox * (1 - share);
        } else {
            const s = Math.sign((a.y + a.h / 2) - (b.y + b.h / 2)) || order;
            a.y += s * oy * share; b.y -= s * oy * (1 - share);
        }
        return true;
    };
    boxes.forEach(clamp);
    for(let it = 0; it < iters; it++){
        let moved = false;
        for(let i = 0; i < boxes.length; i++){
            for(let j = i + 1; j < boxes.length; j++) moved = push(boxes[i], boxes[j], 0.5, -1) || moved;
            for(const w of walls) if(w) moved = push(boxes[i], w, 1, 1) || moved;
        }
        boxes.forEach(clamp);
        if(!moved) break;
    }
    return boxes;
}
/** The hotbar's box. The action wheel doesn't split around it: the whole set of options is lifted above it (see drawWheel). */
function wheelHotbarRect(){
    const L = hotbarLayout();
    return { x: L.x - 9, y: L.y - 9, w: L.w + 18, h: SLOT + 18 };
}
/** What each action wheel option keeps clear of on its own: the HUD panels on screen (the stats, clock, open menus...). Not the hotbar (wheelHotbarRect). */
function wheelWalls(){
    const walls = [
        { x: 12, y: 12, w: 248, h: (GameUI.statsBottom ?? 134) - 12 },                 // player stats
        { x: width - 262, y: 12, w: 262, h: (GameUI.clockBottom ?? 100) - 12 },         // clock (+ calendar)
        GameUI.helpRect,   // (toasts are left out on purpose: they never push or get pushed by other HUD parts)
    ];
    if(GameUI.inventoryOpen){ const I = inventoryLayout(); walls.push({ x: I.x - 72, y: I.y, w: I.w + 72, h: I.h }); if(I.craft) walls.push(I.craft); }
    if(GameUI.station){ const S = stationLayout(); walls.push({ x: S.x, y: S.y, w: S.w, h: S.h }); }
    return walls;
}
function drawWheel(){
    const wl = GameUI.wheel, zone = Theaya.zone, sp = World.camera.superPosition;
    const wc = zone.toWorld(wl.x, wl.y), cx = wc.x - sp.x, cy = wc.y - sp.y;
    const opts = wl.options, n = opts.length;
    // center: what's in the cell
    const def = blockDefAt(wl.x, wl.y), g = groundAt(wl.x, wl.y);
    const title = def ? def.name : g ? g.name : '';
    textSize(12); const tw = textWidth(title) + 16;
    const titleBox = { x: cx - tw / 2, y: cy - 11, w: tw, h: 22 };
    // every option's size, then each one placed on its own: it starts on a small ring at its angle, and only
    // when it would touch an option already placed (or the title / HUD) does IT move further out along its
    // own direction (a small sideways nudge is tried at each distance first). Options don't share a radius,
    // so one crowded pair doesn't push the whole wheel out.
    const boxes = opts.map((o, k) => {
        const sub = !o.enabled ? o.reason : o.warn;
        textSize(13); let w = textWidth(o.label);
        if(sub){ textSize(10.5); w = Math.max(w, textWidth((o.enabled ? '! ' : '') + sub)); }
        return { o, k, sub, a: -Math.PI / 2 + k * Math.PI * 2 / n, w: w + 24, h: sub ? 38 : 26 };
    });
    const GAP = 6, walls = wheelWalls();
    const touches = (b, c) => !!c && Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x) > -GAP && Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y) > -GAP;
    const put = (b, r, a) => {   // a wide ellipse (the options are wide), kept on screen
        b.x = Math.max(6, Math.min(width - b.w - 6, cx + r * 1.35 * Math.cos(a) - b.w / 2));
        b.y = Math.max(6, Math.min(height - b.h - 6, cy + r * Math.sin(a) - b.h / 2));
    };
    const placed = [titleBox], R0 = 34, nudge = [0, 0.12, -0.12, 0.24, -0.24];
    for(const b of boxes){
        const home = b.a;
        let ok = false;
        for(let r = R0; r <= 420 && !ok; r += 6){
            for(const da of nudge){
                put(b, r, home + da);
                if(!placed.some(c => touches(b, c)) && !walls.some(c => touches(b, c))){ b.a = home + da; ok = true; break; }
            }
        }
        if(!ok) put(b, R0, home);   // no room anywhere on its line: separateBoxes below sorts it out
        placed.push(b);
    }
    separateBoxes(boxes, [titleBox, ...walls]);   // only what still overlaps (a very crowded screen) gets moved
    // the hotbar: if any option would touch it, every option moves up together by the same amount (the wheel keeps its shape)
    const hb = wheelHotbarRect();
    let lift = 0;
    for(const b of boxes){
        if(Math.min(b.x + b.w, hb.x + hb.w) - Math.max(b.x, hb.x) > -GAP) lift = Math.max(lift, b.y + b.h + GAP - hb.y);
    }
    if(lift > 0){
        lift = Math.min(lift, Math.min(...boxes.map(b => b.y)) - 6);   // ...but not off the top of the screen
        for(const b of boxes) b.y -= Math.max(0, lift);
    }
    // (the tutorial panel keeps clear of them; `a` = the direction from the cell to the option, for PadNav.pickWheel)
    GameUI.wheelRects = boxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, a: Math.atan2(b.y + b.h / 2 - cy, b.x + b.w / 2 - cx) }));
    // the option the controller's other stick picked: the cursor stays on it while the wheel moves with the camera
    const pick = Pad.active && Pad.wheelPick != null ? boxes[Pad.wheelPick] : null;
    if(pick) Pad.moveTo(pick.x + pick.w / 2, pick.y + pick.h / 2);
    else Pad.wheelPick = null;
    // lines first, so no line crosses over an option
    stroke(255, 255, 255, 60); strokeWeight(1.5);
    for(const b of boxes) line(cx + 16 * Math.cos(b.a), cy + 16 * Math.sin(b.a), b.x + b.w / 2, b.y + b.h / 2);
    noStroke(); fill(18, 22, 30, 230); rect(titleBox.x, titleBox.y, tw, 22, 11);
    fill(255); textAlign(CENTER, CENTER); text(title, cx, cy);
    boxes.forEach(({ o, sub, x: px, y: py, w, h }) => {
        const over = mouse.rawX >= px && mouse.rawX <= px + w && mouse.rawY >= py && mouse.rawY <= py + h;
        noStroke(); fill(over && o.enabled ? 'rgba(70,110,80,0.97)' : 'rgba(18,22,30,0.95)'); rect(px, py, w, h, 9);
        stroke(o.enabled ? (o.warn ? '#ffb347' : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.12)'); noFill(); rect(px, py, w, h, 9);
        noStroke(); fill(o.enabled ? 255 : 130); textSize(13); textAlign(CENTER, TOP); text(o.label, px + w / 2, py + 6);
        if(sub){ fill(o.enabled ? '#ffb347' : '#ff8a7a'); textSize(10.5); text((o.enabled ? '! ' : '') + sub, px + w / 2, py + 22); }
        region(px, py, w, h, { kind:'wheelOption', option: o });
    });
}

/** The middle of the newest toast's line (toasts stack upward from it, above the hotbar or the open inventory). */
function toastBaseY(){
    const y = hotbarLayout().y - 44 - (GameUI.inventoryOpen ? inventoryLayout().h + 26 : 0);
    return GameUI.inventoryOpen ? Math.max(140, y) : y;
}
function drawToasts(){
    const now = performance.now(), hb = hotbarLayout();
    const pp = player.transform.position;
    for(const t of GameUI.toasts) if(t.stayNear && t.until - now > 500 && Math.hypot(pp.x - t.stayNear.x, pp.y - t.stayNear.y) > 8) t.until = now + 500;   // walked away: fade out
    GameUI.toasts = GameUI.toasts.filter(t => t.until > now);
    let y = toastBaseY();
    textSize(13); textAlign(CENTER, CENTER);
    for(let k = GameUI.toasts.length - 1; k >= 0; k--){
        const t = GameUI.toasts[k], a = Math.min(1, (t.until - now) / 500), lines = String(t.text).split('\n'), n = lines.length;
        const w = Math.max(...lines.map(s => textWidth(s))) + 24, h = 24 + (n - 1) * 17;   // '\n' starts a new line in a toast
        noStroke(); fill(18, 22, 30, 210 * a); rect(width / 2 - w / 2, y - 12 - (n - 1) * 17, w, h, 12);
        const c = color(t.color); c.setAlpha(255 * a); fill(c);
        for(let j = 0; j < n; j++) text(lines[j], width / 2, y - (n - 1 - j) * 17);
        y -= h + 4;
    }
}
/**
 * Every control, shown on the HUD (right side): [key, what it does] in the current language, with the
 * player's current binds (see Binds). Using a held item / attacking a creature follow the `move` bind.
 */
function controlsList(){
    const key = a => bindLabel(Binds.shown(a)), walk = key('move'), pad = Pad.active;   // the controller's buttons while it's in use
    return [
        ...(pad ? [[bindLabel(Binds.get('cursor', 'controller')),    T('controls.cursor.what')]] : []),
        [walk,                                                       T('controls.move.what')],
        [T('controls.leftClickTool.key', { key: walk }),             T('controls.leftClickTool.what')],
        [key('wheel'),                                               T('controls.wheel.what')],
        [T('controls.leftClickCreature.key', { key: walk }),         T('controls.leftClickCreature.what')],
        [key('inventory'),                                           T('controls.inventory.what')],
        [key('interact'),                                            T('controls.interact.what')],
        [key('use'),                                                 T('controls.use.what')],
        [pad ? hotbarKeysLabel() : T('controls.hotbar.key', { keys: hotbarKeysLabel(), wheel: T('key.wheel') }), T('controls.hotbar.what')],
        [key('close'),                                               T('controls.close.what')],
        [key('skills'),                                              T('controls.skills.what')],
        [key('sneak'),                                               T(pad ? 'controls.sneakToggle.what' : 'controls.sneak.what')],
        [key('pause'),                                               T('controls.pause.what')],
    ];
}
function drawHelp(top = 12){
    GameUI.helpRect = null;
    if(!GameUI.showHelp) return;
    const lines = controlsList().map(([k, v]) => T('controls.line', { key: k, what: v }));
    textSize(11); textAlign(RIGHT, TOP); noStroke();
    const lw = Math.max(...lines.map(l => textWidth(l)));
    GameUI.helpRect = { x: width - 12 - lw, y: top, w: lw + 12, h: lines.length * 15 };   // where it is (the tutorial panel keeps clear)
    lines.forEach((l, k) => { fill(0, 0, 0, 130); text(l, width - 11, top + 1 + k * 15); fill(235); text(l, width - 12, top + k * 15); });
}

/*
 * The Controls panel (pause menu > Settings > Controls): two pages, picked with the tabs at the top: keyboard & mouse, and
 * controller. Click a bind, then press the new key / mouse button (or controller button) (Binds.listen /
 * Binds.capture). Rows marked `fixed` can't be changed: using a held item and attacking a creature follow the
 * Walk bind, and the mouse wheel always changes the hotbar slot. The controller page also has the cursor speed.
 */
const CONTROL_COLUMNS = {
    keyboard: [
        ['move', { fixed:'useHeld' }, { fixed:'creature' }, 'wheel', 'interact', 'use', 'inventory', 'skills', 'sneak', 'close', 'pause'],
        [...HOTBAR_ACTIONS, { fixed:'scroll' }],
    ],
    controller: [
        ['cursor', 'move', { fixed:'useHeld' }, { fixed:'creature' }, 'wheel', 'interact', 'use'],
        ['inventory', 'skills', 'sneak', 'close', { fixed:'pause' }, 'hotbarprev', 'hotbarnext'],   // pause can't change (see Binds.padFixed)
    ],
};
function drawControlsPanel(){
    const page = GameUI.controlsPage || 'keyboard', columns = CONTROL_COLUMNS[page];
    const rows = Math.max(...CONTROL_COLUMNS.keyboard.map(c => c.length));   // both pages are the keyboard page's size
    const colW = 330, w = colW * 2 + 40, top = 98;
    const rowH = Math.max(22, Math.min(30, Math.floor((height - 290) / rows)));
    const h = top + 4 + rows * rowH + 122;   // the footer: status / hint (up to 2 lines), the note (2 lines), the buttons
    const x = Math.round(width / 2 - w / 2), y = Math.max(8, Math.round(height / 2 - h / 2));
    panel(x, y, w, h);
    noStroke(); fill(255); textAlign(CENTER, TOP); textStyle(BOLD); textSize(22);
    text(T('pause.controlsTitle'), x + w / 2, y + 16);
    textStyle(NORMAL);
    // the tabs
    const tw = 200;
    [['keyboard', T('controls.tab.keyboard')], ['controller', T('controls.tab.controller')]].forEach(([id, label], k) => {
        const tx = x + w / 2 - tw - 5 + k * (tw + 10), ty = y + 52, on = id === page;
        if(on){ noStroke(); fill('#3d7347'); rect(tx, ty, tw, 30, 6); fill(255); textSize(12.5); textAlign(CENTER, CENTER); text(label, tx + tw / 2, ty + 16); }
        else colorButton(tx, ty, tw, 30, label, !Binds.listening, () => { GameUI.controlsPage = id; Binds.status = null; }, '#4a5160');
    });
    const dev = page, walk = bindLabel(Binds.get('move', dev));
    const fixedRow = id => id === 'scroll' ? { name: T('bind.scroll'), key: T('key.wheel') }
                         : id === 'pause' ? { name: bindName('pause'), key: bindLabel(Binds.get('pause', dev)) }
                                         : { name: T('bind.' + id, { walk: bindName('move') }), key: walk };
    columns.forEach((col, c) => {
        const cx = x + 20 + c * (colW + 0), kw = 140;
        col.forEach((entry, r) => {
            const ry = y + top + r * rowH, fixed = typeof entry === 'object';
            const name = fixed ? fixedRow(entry.fixed).name : bindName(entry);
            const listening = !fixed && Binds.listening === entry && Binds.device === dev;
            noStroke(); fill(listening ? 'rgba(255,215,94,0.14)' : r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)');
            rect(cx, ry, colW - 12, rowH - 3, 5);
            fill(fixed ? 140 : 225); textSize(12); textAlign(LEFT, CENTER);
            text(name, cx + 10, ry + (rowH - 3) / 2, colW - kw - 30);
            const bx = cx + colW - 12 - kw - 4, by = ry + 2, bh = rowH - 7;
            if(fixed){ button(bx, by, kw, bh, fixedRow(entry.fixed).key, false, null, false); return; }
            button(bx, by, kw, bh, listening ? T(dev === 'controller' ? 'bind.padPress' : 'bind.press') : bindLabel(Binds.get(entry, dev)), !Binds.listening, () => Binds.listen(entry, dev), true);
            if(listening){ noFill(); stroke('#ffd75e'); strokeWeight(2); rect(bx - 1, by - 1, kw + 2, bh + 2, 7); noStroke(); }
        });
    });
    if(page === 'controller'){
        // under the binds: is a controller there, and the cursor speed
        const ly = y + top + CONTROL_COLUMNS.controller[0].length * rowH + 6;
        noStroke(); textSize(11.5); textAlign(LEFT, TOP);
        fill(Pad.connected() ? '#8fe39a' : '#ffb070');
        text(Pad.connected() ? T('pad.connected', { name: String(controller.id || '').replace(/\s*\(.*$/, '') || T('pad.generic') }) : T('pad.none'), x + 20, ly, colW * 2 - 12);
        drawSettingSlider('cursorSpeed', x + 20, ly + 22, colW * 2 - 12, T('settings.cursorSpeed'), T('settings.cursorSpeedHelp'));
    }
    // what's going on: waiting for a key / the last change / how it works
    const sy = y + top + 4 + rows * rowH;
    const st = Binds.status && Binds.status.until > performance.now() ? Binds.status : null;
    const listeningHere = Binds.listening && Binds.device === dev;
    textAlign(CENTER, TOP); textSize(12);
    if(listeningHere){ fill('#ffd75e'); text(T(dev === 'controller' ? 'bind.padListening' : 'bind.listening', { action: bindName(Binds.listening), cancel: bindLabel(Binds.get('pause', 'controller')) }), x + 20, sy, w - 40); }
    if(st){ fill(st.color); text(st.text, x + 20, sy + (listeningHere ? 17 : 0), w - 40); }
    else if(!listeningHere){ fill(185); text(T(dev === 'controller' ? 'bind.padHint' : 'bind.hint'), x + 20, sy, w - 40); }
    const pl = a => bindLabel(Binds.get(a, 'controller'));
    fill(130); textSize(10.5); text(T(dev === 'controller' ? 'bind.padNote' : 'bind.fixedNote', { walk: bindName('move'), wheel: pl('wheel'), select: pl('interact'),
        stick: T('pad.stick.' + Pad.otherStick()), prev: pl('hotbarprev'), next: pl('hotbarnext') }), x + 20, sy + 40, w - 40);
    // buttons
    const bh = 32, bw = 180, by = y + h - bh - 14;
    if(Binds.listening){
        const r = button(x + w / 2 - bw / 2, by, bw, bh, T('ui.cancel'), true, () => Binds.cancel(), true);
        r.cancelsBind = true;   // a left click here cancels instead of becoming the bind (handlePausedInput)
        return;
    }
    button(x + w / 2 - bw - 6, by, bw, bh, T('bind.reset'), !Binds.isDefault(dev), () => { Binds.reset(dev); Binds.flash(T('bind.resetDone'), '#8fe39a'); }, true);
    button(x + w / 2 + 6, by, bw, bh, T('ui.back'), true, () => closeControls(), true);
}
/** The pause menu (P): Resume, Settings, Controls, show / hide the on-screen controls list, Restart. */
function drawPauseMenu(){
    noStroke(); fill(6, 8, 14, 165); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the menu reacts to the mouse
    const view = GameUI.pauseView, w = 320;
    // the main view's buttons: [label, onClick, enabled]
    const buttons = [
        [T('pause.resume', keyVars()), () => setPaused(false)],
        [T(Tutorial.active ? 'pause.saveTutorial' : 'pause.save'), () => SaveGame.download(), SaveGame.canSave()],   // see SaveGame (12c)
        [T('pause.load'), () => { GameUI.pauseView = 'load'; }, SaveGame.available()],
        [T('pause.settings'), () => openSettings()],   // a menu of its own (see drawSettingsMenu)
        [T(GameUI.showHelp ? 'pause.helpOn' : 'pause.helpOff'), () => { GameUI.showHelp = !GameUI.showHelp; }],
        [T('pause.restart'), () => { GameUI.pauseView = 'restart'; }],
        [T('pause.mainMenu'), () => relaunch('')],
        [T('pause.home'), () => { window.location.href = 'index.html'; }],   // the game picker
    ];
    const h = view === 'restart' ? 170 : view === 'load' ? 260 : 92 + buttons.length * 44 + 34;
    const x = Math.round(width / 2 - w / 2), y = Math.round(height / 2 - h / 2);
    panel(x, y, w, h);
    noStroke(); fill(255); textAlign(CENTER, TOP); textStyle(BOLD); textSize(22);
    text(T(view === 'restart' ? 'pause.restartTitle' : view === 'load' ? 'pause.loadTitle' : 'pause.title'), x + w / 2, y + 16);
    textStyle(NORMAL);
    const bx = x + 30, bw = w - 60, bh = 34;
    const st = SaveGame.shown();   // the last save / load message
    if(view === 'load'){   // load a saved game: this one ends (a bad file is refused and this game goes on)
        fill(215); textSize(12.5); textAlign(CENTER, TOP);
        text(T('pause.loadText'), x + 20, y + 54, w - 40);
        if(st){ fill(st.color); textSize(11.5); text(st.text, x + 16, y + h - bh - 62, w - 32); }
        const half = (bw - 10) / 2;
        button(bx, y + h - bh - 18, half, bh, T('ui.cancel'), true, () => { GameUI.pauseView = 'main'; }, true);
        button(bx + half + 10, y + h - bh - 18, half, bh, SaveGame.busy ? T('load.reading') : T('pause.chooseFile'), !SaveGame.busy, () => SaveGame.chooseAndLoad(), true);
        return;
    }
    if(view === 'restart'){
        fill(215); textSize(12.5); textAlign(CENTER, TOP);
        text(Tutorial.active ? T('pause.restartTutorial') : T('pause.restartWorld', { seed: LAUNCH.seed }), x + 20, y + 54, w - 40);
        const half = (bw - 10) / 2;
        button(bx, y + h - bh - 18, half, bh, T('ui.cancel'), true, () => { GameUI.pauseView = 'main'; }, true);
        button(bx + half + 10, y + h - bh - 18, half, bh, T('pause.restart'), true, () => location.reload(), true);
        return;
    }
    fill(190); textSize(12); textAlign(CENTER, TOP);
    text(T('pause.when', { date: Clock.dateText(), time: Clock.timeText(), day: Math.max(1, Clock.dayIndex - Clock.startDay + 1) }), x + w / 2, y + 48);
    fill(140); textSize(11); text(Tutorial.active ? T('pause.tutorial') : T('pause.seed', { seed: LAUNCH.seed }), x + w / 2, y + 66);
    let by = y + 92;
    for(const [label, fn, enabled = true] of buttons){ button(bx, by, bw, bh, label, enabled, fn, true); by += bh + 10; }
    if(st){ fill(st.color); textSize(11); textAlign(CENTER, TOP); text(st.text, x + 12, by - 2, w - 24); }
}

/* ----- Settings (pause menu > Settings): its own menu, the game stays paused while it's open ----- */
function openSettings(){ GameUI.settingsOpen = true; GameUI.settingsView = null; }
function closeSettings(){ GameUI.settingsOpen = false; GameUI.settingsView = null; }   // back to the pause menu
/** Settings > Controls (drawControlsPanel): opens on the device in use. */
function openControls(){ GameUI.settingsView = 'controls'; GameUI.controlsPage = Pad.active ? 'controller' : 'keyboard'; }
function closeControls(){ Binds.cancel(); GameUI.settingsView = null; }   // back to the settings
/** The settings menu: language, double-click wait, and the Controls panel. Saved between visits, see Settings. */
function drawSettingsMenu(){
    noStroke(); fill(6, 8, 14, 185); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the menu reacts to the mouse
    if(GameUI.settingsView === 'controls'){ drawControlsPanel(); return; }
    const w = 440, rowH = 40, devH = 126, diffH = 104, h = 284 + LANGUAGES.length * rowH + devH + diffH;
    const x = Math.round(width / 2 - w / 2), y = Math.max(8, Math.round(height / 2 - h / 2));
    panel(x, y, w, h);
    noStroke(); fill(255); textAlign(CENTER, TOP); textStyle(BOLD); textSize(22);
    text(T('settings.title'), x + w / 2, y + 16);
    textStyle(NORMAL);
    // language
    fill(220); textSize(13); textAlign(LEFT, TOP); text(T('settings.language'), x + 30, y + 58);
    fill(140); textSize(10.5); text(T('settings.languageHelp'), x + 30, y + 76);
    const cur = currentLanguage(), bx = x + 30, bw = w - 60;
    LANGUAGES.forEach((l, k) => {
        const by = y + 96 + k * rowH, on = l.id === cur;
        button(bx, by, bw, 32, (on ? '● ' : '○ ') + l.label, !on, () => Settings.setLanguage(l.id), true);
    });
    // input device (InputDevice): automatic / keyboard & mouse only / controller only; the picked one is drawn like a selected tab
    const iy = y + 96 + LANGUAGES.length * rowH + 8, mode = InputDevice.mode, sw = (bw - 16) / 3;
    fill(220); noStroke(); textSize(13); textAlign(LEFT, TOP); text(T('settings.inputDevice'), bx, iy);
    fill(140); textSize(10.5); text(T('settings.deviceHelp.' + mode), bx, iy + 18, bw);
    InputDevice.modes.forEach((m, k) => {
        const sx = bx + k * (sw + 8), sy = iy + 50, label = T(InputDevice.labels[m]);
        if(m !== mode){ colorButton(sx, sy, sw, 30, label, true, () => InputDevice.set(m), '#4a5160'); return; }
        noStroke(); fill('#3d7347'); rect(sx, sy, sw, 30, 6);
        fill(255); textSize(12); textAlign(CENTER, CENTER); text(label, sx + sw / 2, sy + 16);
    });
    if(mode === 'controller'){   // is there a controller to listen to? (without one the keyboard and mouse stay on)
        const on = Pad.connected();
        fill(on ? '#8fe39a' : '#ffb070'); textSize(10.5); textAlign(LEFT, TOP);
        text(on ? T('pad.connected', { name: String(controller.id || '').replace(/\s*\(.*$/, '') || T('pad.generic') }) : T('settings.deviceNoPad'), bx, iy + 88, bw);
    }
    // difficulty (see Difficulty)
    const fy = iy + devH;
    drawDifficultyPicker(bx, fy, bw);
    // double-click wait (see DoubleClick): a slider
    const dy = fy + diffH;
    drawSettingSlider('doubleClick', bx, dy, bw, T('settings.doubleClick'), T('settings.doubleClickHelp'));
    button(bx, y + h - 92, bw, 34, T('pause.controls'), true, () => openControls(), true);
    button(bx, y + h - 48, bw, 34, T('ui.back'), true, () => closeSettings(), true);
}
/**
 * The difficulty row (Settings menu, and the start menu's New Game screen): its name, a help line for the picked
 * level, then one button per level with the picked one drawn like a selected tab. y = its top; 88 px tall.
 */
function drawDifficultyPicker(x, y, w){
    const diff = Difficulty.id, n = Difficulty.levels.length, lw = (w - 8 * (n - 1)) / n;
    fill(220); noStroke(); textSize(13); textAlign(LEFT, TOP); text(T('settings.difficulty'), x, y);
    fill(140); textSize(10.5); text(T('settings.difficultyHelp.' + diff), x, y + 18, w);
    Difficulty.levels.forEach((d, k) => {
        const sx = x + k * (lw + 8), sy = y + 58, label = T('difficulty.' + d);
        if(d !== diff){ colorButton(sx, sy, lw, 30, label, true, () => Difficulty.set(d, true, Menu.active), '#4a5160'); return; }   // (no notice on the start menu)
        noStroke(); fill('#3d7347'); rect(sx, sy, lw, 30, 6);
        fill(255); textSize(12); textAlign(CENTER, CENTER); text(label, sx + lw / 2, sy + 16);
    });
}
/**
 * Menu sliders: id ->{ get(), set(v), min, max, step, show(v) }. Drag one with the left mouse button (or the
 * controller's click); the settings are saved when it's let go (handlePausedInput).
 */
const SLIDERS = {
    doubleClick: { get: () => DoubleClick.wait, set: v => { Settings.data.doubleClickMs = v; }, ...Settings.doubleClickRange,
                   show: v => v > 0 ? T('settings.ms', { n: v }) : T('settings.off') },
    cursorSpeed: { get: () => Settings.cursorSpeed(), set: v => { Settings.data.cursorSpeed = v; }, ...Settings.cursorSpeedRange,
                   show: v => T('settings.pxPerSec', { n: v }) },
};
/** A labelled slider row: the name and value on top, a help line, then the bar (y = its top; ~84 px tall). */
function drawSettingSlider(id, x, y, w, label, help){
    const S = SLIDERS[id], v = S.get();
    fill(220); noStroke(); textSize(13); textAlign(LEFT, TOP); text(label, x, y);
    textAlign(RIGHT, TOP); fill('#ffd75e'); text(S.show(v), x + w, y);
    fill(140); textSize(10.5); textAlign(LEFT, TOP); text(help, x, y + 18, w);
    const sx = x + 8, sw = w - 16, ty = y + 66, hx = sx + (v - S.min) / (S.max - S.min) * sw;
    noStroke(); fill(60, 66, 80); rect(sx, ty - 3, sw, 6, 3);
    fill('#4f8f5a'); rect(sx, ty - 3, hx - sx, 6, 3);
    const dragging = GameUI.sliderDrag && GameUI.sliderDrag.id === id;
    fill(dragging ? '#ffe9a0' : '#ffd75e'); stroke(20, 24, 32); strokeWeight(1.5); circle(hx, ty, 15); noStroke();
    region(sx - 10, ty - 12, sw + 20, 24, { kind:'slider', id, sx, sw });
}
/** Set a slider (a 'slider' region: { id, sx, sw }) from the mouse x. */
function setSliderAt(r, mx){
    const S = SLIDERS[r.id], k = Math.max(0, Math.min(1, (mx - r.sx) / r.sw));
    S.set(Math.round((S.min + k * (S.max - S.min)) / S.step) * S.step);
}
function itemInfoLines(item){
    const lines = [nameOf(item.id)];
    const m = item.get('mining'), d = item.get('durability'), f = item.get('fuel'), c = item.get('consume'), r = item.get('resource');
    const w = waterOf(item);
    if(m) lines.push(T('tip.tool', { tool: nameOf(m.classes[0]), tier: m.tier, speed: m.speed.toFixed(1) }));
    if(m && m.classes.includes('hoe')) lines.push(T('tip.hoe', { tier: m.tier }));
    if(m && m.classes.includes('shovel')) lines.push(T('tip.shovel'));
    if(d) lines.push(T('tip.durability', { v: Math.ceil(d.value), max: d.max }));
    if(w) lines.push(T('tip.water', { v: w.value, c: w.capacity }) + (item instanceof Bucket ? T('tip.forFarmland') : ''));
    if(c) lines.push(T('tip.food', { hunger: c.hunger, sat: c.saturation }) + (c.health ? T('use.ateHealth', { hp: c.health }) : ''));
    const q = item.get('quench');
    if(q) lines.push(T('tip.quench', { n: q.amount }));
    if(item instanceof CropSeedItem){
        const crop = Crops.get(item.crop);
        if(crop) lines.push(T('tip.ripeAfter', { days: crop.ripeAge }), crop.tier > 0 ? T('tip.harvestTier', { tier: crop.tier }) : T('tip.harvestHand'));
    }
    if(Crops.get(item.id) && !c) lines.push(T(item.id === 'hemp' ? 'tip.spinHemp' : 'tip.cookIt'));
    const pz = item.get('poisonous'), atk = item.get('attack'), L = item.get('launcher'), ammo = item.get('ammoStats');
    if(pz) lines.push(T('tip.raw', { pct: Math.round(Difficulty.bad(pz.chance) * 100) }));
    const rg = item.get('regeneration');
    if(rg) lines.push(T('tip.regen', { rate: rg.rate, secs: rg.seconds }));
    if(item.id === 'grease') lines.push(T('tip.grease1'), T('tip.grease2'));
    const bd = item.get('bandage');
    if(bd) lines.push(T('tip.bandage', { hp: bd.heal, secs: bd.cooldown }));
    if(item.id === 'biotics') lines.push(T('tip.biotics'));
    if(isCookable(item) && !waterOf(item)) lines.push(T('tip.cookable'));
    if(L) lines.push(T('tip.ranged', { range: L.range, power: L.power, cd: L.cooldown }));
    else if(atk && item.hasTag('weapon')) lines.push(T('tip.melee', { dmg: atk.damage }));
    if(ammo) lines.push(T('tip.arrow', { dmg: ammo.damage }));
    const fl = item.get('fishing');
    if(fl) lines.push(T('tip.fishing', { lure: fishPct(fl.lure), secs: Math.round(1 / fl.lure), success: fishPct(fl.success) }), T('tip.fishingHow'));
    if(item.getDefense && armorSlotOf(item)) lines.push(T('tip.armor', { slot: T('armor.slot.' + armorSlotOf(item)), def: item.getDefense() }));
    if(item instanceof BlockItem){
        const bd = Blocks.get(item.block);
        lines.push(T(bd && bd.passableFor && bd.passableFor.includes('player') ? 'tip.placeOnlyYou' : bd && !bd.solid ? 'tip.placeWalkOver' : 'tip.placeBlock'));
        if(bd && bd.safe) lines.push(T('tip.light', { n: bd.safe }), T('tip.lightF'));
        const zs = siegeSeconds(CREATURES.zombie, bd), os = siegeSeconds(CREATURES.orc, bd);
        if(zs != null && os != null) lines.push(T('tip.siege', { zombie: Math.round(zs), orc: Math.round(os) }));
    }
    if(r && r.material) lines.push(T('tip.material', { material: nameOf(r.material), tier: r.tier }));
    if(f) lines.push(T('tip.fuel', { n: f.ticks, secs: f.ticks * FORGE.fuelSeconds }));
    if(isSmeltable(item)) lines.push(T('tip.smeltable'));
    if(item.count > 1) lines.push(`x${item.count}`);
    return lines;
}
/** Next to the cursor: what a left click does with the held tool (when it does something). */
function drawQuickHint(){
    GameUI.quick = null;
    if(GameUI.wheel || (GameUI.press && GameUI.press.dragging) || uiHit(mouse.rawX, mouse.rawY)) return;
    const c = areaZones.home.toCell(mouse.x, mouse.y), q = c ? quickActionFor(c.x, c.y, mouse.x, mouse.y) : null;
    if(!q) return;
    GameUI.quick = { q, x: c.x, y: c.y };   // the mouse cursor shows the tool for it (Cursor.forAction)
    const t = q.reason ? T('quick.labelReason', { label: q.label, reason: q.reason }) : q.label;
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

/**
 * The HUD's font. Japanese: a font made for screens, since the browser's default Japanese sans-serif
 * (Yu Gothic on Windows) draws thin, hard-to-read kanji at small sizes. Meiryo (Windows), then Hiragino
 * (macOS, by PostScript name), then the default. The names have no spaces on purpose: p5's textFont quotes
 * a name with a space as one family, which would break the list.
 */
const HUD_FONTS = { english: 'sans-serif', japanese: 'Meiryo,HiraginoSans-W4,HiraKakuProN-W3,sans-serif' };
const hudFont = () => HUD_FONTS[currentLanguage()] || HUD_FONTS.english;
const hudLayer = {
    id: 'theaya_hud', isUI: true, scenes: [SCENE_ID], layer: 1000, _order: 1e9, deleted: false, tags: [],
    render(){
        if(!Theaya.ready){ Cursor.set('wait'); return; }
        if(!Loading.hidden) Loading.hide();   // the first frame is drawing: fade the loading screen away
        push();
        resetMatrix();
        resetDrawModes();
        GameUI.regions = [];
        textFont(hudFont());
        textWrap(currentLanguage() === 'japanese' ? CHAR : WORD);   // Japanese has no spaces: wrap boxed text between characters
        if(Menu.active){ drawMenu(); Cursor.update(); pop(); return; }
        const statsBottom = GameUI.statsBottom = drawStats();
        GameUI.wheelRects = null;   // (drawWheel fills it while the wheel is open)
        drawHotbar();
        if(GameUI.inventoryOpen){ drawInventory(); drawCloseButton(inventoryLayout()); }
        if(GameUI.station){ drawStation(); drawCloseButton(stationLayout()); }
        if(GameUI.wheel) drawWheel();
        drawToasts();
        if(GameUI.skillsOpen && !GameUI.choice) drawSkills();
        if(GameUI.choice) drawChoice();
        const clockBottom = drawClock();
        GameUI.clockBottom = GameUI.calendar ? drawCalendar(clockBottom + 6) : clockBottom;   // (the tutorial panel keeps clear of these)
        drawHelp(GameUI.clockBottom + 10);
        if(GameUI.itemMenu && GameUI.inventoryOpen) drawItemMenu();
        if(GameUI.confirmDelete) drawConfirmDelete();
        if(GameUI.press && GameUI.press.dragging && refItem(GameUI.press.ref)){
            drawItemIcon(refItem(GameUI.press.ref), mouse.rawX, mouse.rawY, SLOT * 0.85);
        }
        if(Tutorial.active) drawTutorial(statsBottom + 10);
        if(GameUI.paused) GameUI.settingsOpen ? drawSettingsMenu() : drawPauseMenu();   // settings replace the pause menu while open
        else { drawQuickHint(); drawTooltip(); }
        if(GameUI.paused) GameUI.quick = null;
        Cursor.update();
        pop();
    },
};
theayaScene.addObject(hudLayer);


/* ---------------------------------------------------------------------
 * 12b. Start menu + tutorial
 *   The page opens on the start menu (Tutorial / New Game, LAUNCH above).
 *   Choosing one sets the URL hash and reloads, so the world is generated
 *   once, from the right seed. The tutorial is a calm copy of the
 *   WORLD_SEED world (no hunger, thirst or monsters) with one task per
 *   step: move, the action wheel, the inventory, then workbenches.
 * --------------------------------------------------------------------- */
/**
 * The loading screen is the #loading div in world_of_theaya.html. It is on screen from the first moment the page
 * loads (the world is generated while the page loads, which blocks drawing), it is shown again right before the page
 * reloads for a new game / the tutorial, and it fades away on the first frame the game draws.
 */
const Loading = {
    el: () => document.getElementById('loading'),
    show(text, sub = ''){
        const el = this.el(); if(!el) return;
        const t = document.getElementById('loadingText'), s = document.getElementById('loadingSub');
        if(t) t.textContent = text;
        if(s) s.textContent = sub;
        el.style.display = 'flex'; el.style.opacity = '1';
    },
    hide(){
        const el = this.el(); if(!el || this.hidden) return;
        this.hidden = true;
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 400);
    },
};
/** What the loading screen says while the page reloads into `hash`. */
function loadingTextFor(hash){
    if(hash === 'tutorial') return [T('loading.tutorial'), T('loading.tutorialSub')];
    if(hash === 'load') return [T('loading.save'), SaveGame.pendingSub || ''];
    const m = /^seed=(-?\d+)$/.exec(hash);
    if(m) return [T('loading.world'), T('loading.seed', { seed: m[1] })];
    return [T('loading.loading'), ''];
}
/** Restart the page with a new URL hash ('' = back to the start menu). */
function relaunch(hash){
    if(Menu.launching) return;
    Menu.launching = true;
    Menu.hideInput();
    Loading.show(...loadingTextFor(hash));
    requestAnimationFrame(() => setTimeout(() => { location.hash = hash; location.reload(); }, 60));   // let the loading screen paint first
}

const Menu = {
    active: LAUNCH.mode === 'menu',
    view: LAUNCH.view || 'main',    // 'main' | 'new'
    launching: false,
    input: null,                    // the seed <input>, laid over the canvas
    _focused: false,
    ensureInput(){
        if(this.input) return this.input;
        const el = document.createElement('input');
        el.type = 'text'; el.maxLength = 40; el.placeholder = T('menu.seedPlaceholder'); el.autocomplete = 'off'; el.spellcheck = false;
        el.setAttribute('aria-label', T('menu.worldSeed'));
        Object.assign(el.style, {
            position:'fixed', display:'none', zIndex:'10', boxSizing:'border-box', padding:'0 12px', textAlign:'center',
            font:'16px sans-serif', color:'#fff', background:'#10141c', border:'1px solid rgba(255,255,255,0.35)', borderRadius:'6px', outline:'none',
        });
        // typing must not reach the game's key handling (E, Tab, P, number keys...)
        for(const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, e => e.stopPropagation());
        el.addEventListener('keydown', e => {
            if(e.key === 'Enter') Menu.startNew();
            else if(e.key === 'Escape') Menu.view = 'main';
        });
        Cursor.style(el, 'text');
        el.addEventListener('focus', () => { el.style.borderColor = '#8fe39a'; });
        el.addEventListener('blur',  () => { el.style.borderColor = 'rgba(255,255,255,0.35)'; });
        document.body.appendChild(el);
        return this.input = el;
    },
    /** Show the seed box over the canvas at (x, y, w, h) in canvas pixels. */
    placeInput(x, y, w, h){
        const el = this.ensureInput(), cv = document.querySelector('canvas');
        const r = cv ? cv.getBoundingClientRect() : { left:0, top:0, width, height };
        const sx = r.width / width, sy = r.height / height;
        Object.assign(el.style, { display:'block', left:(r.left + x * sx) + 'px', top:(r.top + y * sy) + 'px', width:(w * sx) + 'px', height:(h * sy) + 'px' });
        if(!this._focused){ this._focused = true; el.focus(); }
    },
    hideInput(){ if(this.input) this.input.style.display = 'none'; this._focused = false; },
    /** Blank seed = a random one. The seed goes in the URL, so Restart keeps the same world. */
    startNew(){ relaunch('seed=' + parseSeed(this.input ? this.input.value : '')); },
};
if(Menu.active) theayaScene.pause = true;   // the world behind the menu waits

function handleMenuInput(){
    Keys.update();
    const hit = uiHit(mouse.rawX, mouse.rawY);
    if(Keys.pressed('mouse@left') && hit && hit.kind === 'button' && hit.enabled !== false) hit.onClick(false);
    if(Keys.pressed('default@close') && Menu.view === 'new') Menu.view = 'main';
}

function drawMenu(){
    noStroke(); fill(6, 8, 14, 175); rect(0, 0, width, height);
    region(0, 0, width, height, { kind:'pauseScreen' });   // nothing under the menu reacts to the mouse
    const newView = Menu.view === 'new', w = 400, h = newView ? 390 : 440;
    const x = Math.round(width / 2 - w / 2), y = Math.round(height / 2 - h / 2);
    panel(x, y, w, h);
    noStroke(); fill('#ffd75e'); textAlign(CENTER, TOP); textStyle(BOLD); textSize(30);
    text(T('menu.title'), x + w / 2, y + 22);
    textStyle(NORMAL);
    fill(115); textSize(10); textAlign(RIGHT, BOTTOM); text(T('menu.version', { version: GAME_VERSION }), x + w - 10, y + h - 6);
    textAlign(CENTER, TOP);
    const bx = x + 40, bw = w - 80;
    if(!newView){
        Menu.hideInput();
        fill(190); textSize(13); text(T('menu.begin'), x + w / 2, y + 64);
        let by = y + 100;
        const entry = (label, desc, fn, enabled = true) => {
            button(bx, by, bw, 44, label, enabled, fn, true);
            noStroke(); fill(150); textSize(11); textAlign(CENTER, TOP); text(desc, bx, by + 50, bw);
            by += 82;
        };
        entry(T('menu.tutorial'), T('menu.tutorialDesc'), () => relaunch('tutorial'));
        entry(T('menu.newGame'), T('menu.newGameDesc'), () => { Menu.view = 'new'; });
        // a .malengine save file (or drop one on the page): see SaveGame in 12c
        entry(SaveGame.busy ? T('load.reading') : T('menu.load'), T('menu.loadDesc'), () => SaveGame.chooseAndLoad(), SaveGame.available() && !SaveGame.busy);
        const st = SaveGame.shown();
        if(st){ noStroke(); fill(st.color); textSize(12); textAlign(CENTER, TOP); text(st.text, bx - 20, y + h - 88, bw + 40); }
        button(bx, y + h - 52, bw - 110, 30, T('menu.home'), true, () => { window.location.href = 'index.html'; }, true);
        // the language can be picked here too, before a game starts (in a game: pause menu > Settings)
        const other = LANGUAGES[(LANGUAGES.findIndex(l => l.id === currentLanguage()) + 1) % LANGUAGES.length];
        button(bx + bw - 100, y + h - 52, 100, 30, other.label, true, () => Settings.setLanguage(other.id), true);
        return;
    }
    fill(190); textSize(13); text(T('menu.newGameTitle'), x + w / 2, y + 64);
    fill(225); textAlign(LEFT, TOP); text(T('menu.worldSeed'), bx, y + 92);
    Menu.placeInput(bx, y + 114, bw, 38);
    if(Menu.input) Menu.input.placeholder = T('menu.seedPlaceholder');   // follows a language switch
    fill(150); textSize(11); textAlign(CENTER, TOP);
    text(T('menu.seedHelp'), bx, y + 164, bw);
    // the new world's difficulty (the same setting as pause menu > Settings; it also decides how many goblin camps it gets)
    drawDifficultyPicker(bx, y + 210, bw);
    const half = (bw - 10) / 2;
    button(bx, y + h - 56, half, 36, T('ui.back'), true, () => { Menu.view = 'main'; }, true);
    button(bx + half + 10, y + h - 56, half, 36, T('menu.start'), true, () => Menu.startNew(), true);
}

/* ----- Tutorial ----- */
/**
 * Tutorial text: T() with the player's current keys filled in (they can be rebound in pause > Settings > Controls):
 * {inventory} {interact} {use} {close} {skills} {pause} ... (see keyVars), {hotbar} = the hotbar keys ("1-7"),
 * and for pointing at a cell {moveDo} / {wheelDo} ("Left-click" / "Right-click", or "Press Q on" when the
 * action is on a key; {moveDoLow} / {wheelDoLow} start in lower case, for the middle of a sentence).
 */
function TK(key, vars){ return T(key, Object.assign(tutKeyVars(), vars)); }
function tutKeyVars(){
    const v = keyVars();
    v.hotbar = hotbarKeysLabel();
    for(const a of ['move', 'wheel']){
        const b = Binds.shown(a), s = b.startsWith('mouse@') ? bindLabel(b) : T('tut.keyOn', { key: bindLabel(b) });
        v[a + 'Do'] = s;
        v[a + 'DoLow'] = s.charAt(0).toLowerCase() + s.slice(1);
    }
    return v;
}
/** The cell the mouse is over, or null. */
const tutHover = () => areaZones.home.toCell(mouse.x, mouse.y);
/* Screen-space highlight rectangles (the step's `focus`): { x, y, w, h } or null. */
const tutStatRow = k => ({ x: 17, y: 20 + k * 22, w: 232, h: 20 });   // the bars in drawStats: health, hunger, thirst, xp
function tutHotbarRect(){ const L = hotbarLayout(); return { x: L.x - 9, y: L.y - 9, w: L.w + 18, h: SLOT + 18 }; }
function tutBackpackRect(){ const L = inventoryLayout(); return { x: L.x, y: L.y, w: L.w, h: L.h }; }
function tutCraftRect(){ const c = inventoryLayout().craft; return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null; }
function tutStationRect(){ const L = stationLayout(); return { x: L.x, y: L.y, w: L.w, h: L.h }; }
/** The Gear column (armor slots) left of the backpack (see drawInventory). */
function tutGearRect(){ const L = inventoryLayout(); return { x: L.x - 72, y: L.y, w: 64, h: L.h }; }
/** One armor slot in the Gear column ('head', 'chest', 'legs', 'feet'). */
function tutGearSlotRect(slot){ const L = inventoryLayout(), k = Math.max(0, ARMOR_SLOTS.indexOf(slot)); return { x: L.x - 72 + 9, y: L.y + 30 + k * (SLOT + 4), w: SLOT, h: SLOT }; }
/** Is the farmland menu open? */
const tutFarmOpen = () => !!GameUI.station && GameUI.station.kind === 'farmland';
/** The farmland menu's seedling slots / its water slot (see drawFarmlandPanel). */
function tutFarmSlotsRect(){ const L = stationLayout(), row = SLOT + SLOT_GAP; return { x: L.x + 16, y: L.y + 56, w: FARM.slots * row - SLOT_GAP, h: SLOT }; }
function tutFarmWaterRect(){ const L = stationLayout(), row = SLOT + SLOT_GAP; return { x: L.x + 16 + FARM.slots * row + 22, y: L.y + 56, w: SLOT, h: SLOT }; }
/** Is there a stack of this item on the hotbar? */
function tutOnHotbar(id){
    const inv = player.inventory;
    for(let i = 1; i <= hotbarLayout().n; i++){ const it = inv.hotbarItem(i); if(it && it.id === id) return true; }
    return false;
}
/** Does the player carry any crop seeds? */
function tutHasSeeds(){
    const inv = player.inventory;
    for(let i = 1; i <= inv.slots; i++) if(inv[i] instanceof CropSeedItem) return true;
    return false;
}
/** Put 3 seeds of an easy crop in the backpack (quietly), for planting through the farmland menu. */
function tutGiveSeeds(){
    if(tutHasSeeds()) return;
    const id = Crops.random(c => c.farm && c.tier <= 0 && Items.has(c.seed)) ?? Crops.ids().find(i => Crops.get(i).farm && Items.has(Crops.get(i).seed));
    if(id) giveItems(Crops.get(id).seed, 3);
}
/** The text for opening a station at cell c: walk next to it, then hover it, then press E. */
function tutOpenText(c, walkKey, hoverKey, pressKey, vars = {}){
    const pc = playerCell();
    if(!pc || hexDist(pc, c) > 1) return TK(walkKey, vars);
    const h = tutHover();
    if(!h || h.x !== c.x || h.y !== c.y) return TK(hoverKey, vars);
    return TK(pressKey, vars);
}
/** The fern the gathering step points at: the current one while it's still there, else the nearest one (null = none left). */
function tutNextFern(){
    const c = Tutorial.cell, def = c && blockDefAt(c.x, c.y);
    if(!def || def.kind !== 'fern') Tutorial.cell = tutFernCell();
    return Tutorial.cell;
}
/** The action wheel option (on screen this frame) whose option matches `test`. */
function tutWheelOption(test){
    if(!GameUI.wheel) return null;
    const r = GameUI.regions.find(r => r.kind === 'wheelOption' && test(r.option));
    return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
}
/** The workbench the player placed (first one found), or null. */
function tutBench(){
    for(let i = 0; i < Theaya.blocks.length; i++){ const b = Theaya.blocks[i]; if(b && b.id === 'workbench') return cellXY(i); }
    return null;
}
/** A walkable cell 4 cells from the player that has a path. */
function tutWalkCell(){
    const pc = playerCell();
    if(!pc) return null;
    for(let dy = -4; dy <= 4; dy++) for(let dx = -6; dx <= 6; dx++){
        const c = { x: pc.x + dx, y: pc.y + dy };
        if(!Theaya.zone.inBounds(c.x, c.y) || hexDist(pc, c) !== 4 || !isPassable(c.x, c.y)) continue;
        if(areaZones.home.findPath(pc, c, pathOpts())) return c;
    }
    return null;
}
/** The nearest block the player can reach whose definition passes `test`, or null. */
function tutNearestBlock(test){
    const pc = playerCell();
    if(!pc) return null;
    let best = null;
    for(let i = 0; i < Theaya.blocks.length; i++){
        const b = Theaya.blocks[i], def = b && Blocks.get(b.id);
        if(!def || !test(def)) continue;
        const c = cellXY(i), d = hexDist(pc, c);
        if(d > 14 || (best && d >= best.d) || !findApproach(c)) continue;
        best = { x: c.x, y: c.y, d };
    }
    return best;
}
/** The nearest fern (gathered by hand from the wheel). */
const tutFernCell = () => tutNearestBlock(def => def.kind === 'fern');
/** Bare grass 2-4 cells away that can be tilled. */
function tutGrassCell(){
    const pc = playerCell();
    if(!pc) return null;
    for(let dy = -4; dy <= 4; dy++) for(let dx = -5; dx <= 5; dx++){
        const c = { x: pc.x + dx, y: pc.y + dy }, d = hexDist(pc, c);
        if(!Theaya.zone.inBounds(c.x, c.y) || d < 2 || d > 4 || blockAt(c.x, c.y) || !isPassable(c.x, c.y) || !canTill(c.x, c.y).ok) continue;
        return c;
    }
    return null;
}
/** The first farmland cell (that has a plant when `planted`), or null. */
function tutFarmland(planted = false){
    for(let i = 0; i < Theaya.blocks.length; i++){ const b = Theaya.blocks[i]; if(b && b.id === 'farmland' && (!planted || (b.seeds && !b.seeds.isEmpty))) return cellXY(i); }
    return null;
}
/** Select the hotbar slot holding this item id. */
function tutHold(id){
    const inv = player.inventory;
    for(let i = 1; i <= hotbarLayout().n; i++){ const it = inv.hotbarItem(i); if(it && it.id === id){ GameUI.hotbar = i; return true; } }
    return false;
}
/**
 * Give a tool / gear / seeds straight onto the hotbar and select it. Uses the first empty hotbar slot;
 * when the hotbar is full, the last slot's item moves to the backpack to make room.
 */
function tutGive(id, count = 1){
    const inv = player.inventory, n = hotbarLayout().n;
    let slot = 0;
    for(let i = 1; i <= n && !slot; i++) if(!inv.hotbarItem(i)) slot = i;
    if(!slot){
        slot = n;
        const old = inv.hotbarItem(slot);
        inv.setSlot(inv.hotbarSlot(slot), null);
        if(old && inv.give(old) !== 0) inv.setSlot(inv.hotbarSlot(slot), old);   // no room anywhere: swap isn't possible, keep it
    }
    if(inv.hotbarItem(slot)){ giveItems(id, count); tutHold(id); return; }
    inv.setSlot(inv.hotbarSlot(slot), Items.create(id, count));
    inv._changed({ event:'tutorial' });
    GameUI.hotbar = slot;
}
/** A water cell for the water lesson: one within a few cells that can be reached, or a new one dug out of the grass nearby (3+ cells from farmland, so it doesn't irrigate it). */
function tutWaterCell(){
    const pc = playerCell();
    if(!pc) return null;
    const farm = tutFarmland(), farFromFarm = c => !farm || hexDist(c, farm) >= 3;
    let best = null;
    for(let i = 0; i < Theaya.ground.length; i++){
        if(!isWaterCell(i) || Theaya.water[i] <= 0) continue;
        const c = cellXY(i), d = hexDist(pc, c);
        if(d <= 6 && (!best || d < best.d) && farFromFarm(c) && findApproach(c)) best = { x: c.x, y: c.y, d };
    }
    if(best) return best;
    for(let dy = -5; dy <= 5; dy++) for(let dx = -6; dx <= 6; dx++){
        const c = { x: pc.x + dx, y: pc.y + dy }, d = hexDist(pc, c);
        if(!Theaya.zone.inBounds(c.x, c.y) || d < 3 || d > 5 || blockAt(c.x, c.y) || Theaya.ground[cellIndex(c.x, c.y)] !== FLOOR || !farFromFarm(c)) continue;
        const i = cellIndex(c.x, c.y);
        Theaya.water[i] = WATER_UNITS;
        setGround(c.x, c.y, 'water');
        Theaya.water[i] = WATER_UNITS;
        if(!Theaya.waterCells.includes(i)) Theaya.waterCells.push(i);
        Theaya.mud.delete(i); Theaya.dried.delete(i); Theaya.origin[i] = null;
        if(!findApproach(c)){ setGround(c.x, c.y, FLOOR); Theaya.waterCells = Theaya.waterCells.filter(j => j !== i); continue; }   // walled in: undo and try the next cell
        return c;
    }
    return null;
}
/** Move a crafted item (anywhere in the backpack) onto the hotbar and select it. The last hotbar slot swaps when it is full. */
function tutToHotbar(id){
    if(tutHold(id)) return true;
    const inv = player.inventory, n = hotbarLayout().n;
    let from = 0;
    for(let i = 1; i <= inv.slots && !from; i++){ const it = inv[i]; if(it && it.id === id) from = i; }
    if(!from) return false;
    let slot = 0;
    for(let i = 1; i <= n && !slot; i++) if(!inv.hotbarItem(i)) slot = i;
    if(!slot) slot = n;
    const item = inv[from], old = inv.hotbarItem(slot);
    inv.setSlot(from, old ?? null);
    inv.setSlot(inv.hotbarSlot(slot), item);
    inv._changed({ event:'tutorial' });
    GameUI.hotbar = slot;
    return true;
}
/** Make sure the player has at least n of an item (a safety net in case materials were used elsewhere). 'planks' = the tutorial's planks. */
function tutEnsure(key, n){
    const id = key === 'planks' ? Tutorial.planks : key, have = player.inventory.countOf(id);
    if(have < n) giveItems(id, n - have);
}
/**
 * A step that has the player craft `id` at the workbench. `title` / `cost` are text keys (the cost is shown in the
 * instructions), `ensure` = [[item, amount], ...] topped up on entry.
 */
function tutCraftStep(id, title, cost, ensure){
    return {
        title,
        text(){
            const v = { name: nameOf(id), cost: TK(cost) };
            if(GameUI.station && GameUI.station.kind === 'workbench') return TK('tut.craft.listed', v);
            const b = tutBench(), pc = playerCell();
            if(!b) return TK('tut.placeBenchFirst');
            if(!pc || hexDist(pc, b) > 1) return TK('tut.craft.walk', v);
            return TK('tut.craft.hover', v);
        },
        enter(){ for(const [k, n] of ensure) tutEnsure(k, n); },
        target: () => GameUI.station ? null : tutBench(),
        focus: () => [GameUI.station ? tutStationRect() : null],
        done: () => player.inventory.countOf(id) > 0,
    };
}
/** Does the player carry a bucket with water in it? */
function tutWaterBucket(){
    const inv = player.inventory;
    for(let i = 1; i <= inv.slots; i++){ const it = inv[i], w = it instanceof Bucket ? waterOf(it) : null; if(w && w.value > 0) return true; }
    return false;
}
const tutHolding = id =>{ const h = heldItem(); return !!h && h.id === id; };
/**
 * An empty cell out in the open, minD-maxD cells from the player: no block or creature in it, every neighbor walkable
 * and free of creatures, and the player can walk up to it. `mover` must also be able to stand in it. Nearest first;
 * the range widens (up to 10) when nothing fits.
 */
function tutOpenCell(minD, maxD, mover = 'player'){
    const pc = playerCell();
    if(!pc) return null;
    const free = (x, y) => Theaya.zone.inBounds(x, y) && !blockAt(x, y) && !Mobs.occ.has(cellIndex(x, y)) && isPassable(x, y) && isPassable(x, y, mover);
    for(let hi = maxD; hi <= Math.max(maxD, 10); hi++){
        const found = [];
        for(let dy = -hi; dy <= hi; dy++) for(let dx = -hi - 1; dx <= hi + 1; dx++){
            const c = { x: pc.x + dx, y: pc.y + dy }, d = hexDist(pc, c);
            if(d < minD || d > hi || !free(c.x, c.y)) continue;
            const ns = areaZones.home.neighbors(c.x, c.y);
            if(ns.length < 6 || !ns.every(n => (n.x === pc.x && n.y === pc.y) || free(n.x, n.y))) continue;
            found.push({ c, d });
        }
        found.sort((a, b) => a.d - b.d);
        for(const { c } of found) if(findApproach(c)) return c;
    }
    return null;
}
/** A stone placed out in the open (2-4 cells away) to mine, so it's never buried in a rock face. Falls back to the nearest reachable stone. */
function tutPlaceStone(){
    const c = Blocks.get('stone') ? tutOpenCell(2, 4) : null;
    if(!c) return tutNearestBlock(def => def.kind === 'stone');
    setBlock(c.x, c.y, 'stone');
    return c;
}
/** A zombie to practice on, 3-5 cells away in an open cell (walkable all around it). It stands still: the tutorial world is calm. */
function tutSpawnDummy(){
    const c = tutOpenCell(3, 5, 'zombie');
    return c ? Mobs.spawn('zombie', c.x, c.y) : null;
}

const Tutorial = {
    active: LAUNCH.mode === 'tutorial',
    step: 0,
    flags: {},          // moved: an item was moved in the inventory
    cell: null,         // the cell the current step points at
    fibers: 0,          // plant fibers owned when the wheel step began
    // Plant fibers the player gathers: what the tutorial's recipes use (pickaxe 2 + hoe 2 + bucket 3 + sword 2)
    fiberGoal: 9,
    planks: `${logTypes[0]}_planks`,
    farm: null,         // the farmland the farming steps use
    waterCell: null,    // the water cell the bucket is filled at
    waterBase: 0,       // the farmland's water before the bucket went in its water slot
    /** Each step: title, text() (the instruction; may change as you progress), enter() (set up), target() (cell to highlight), done() (finished?). */
    steps: [
        // title = a text key; text() returns the instruction (it may change as you progress). All text: 'tut.*' in THEAYA_TEXT.
        // ----- stats -----
        {
            title: 'tut.health.title',
            manual: true,
            focus: () => [tutStatRow(0)],
            text: () => TK('tut.health.text', { n: SURVIVAL.regenAbove }),
        },
        {
            title: 'tut.death.title',
            manual: true,
            focus: () => [tutStatRow(0), tutStatRow(3)],
            text: () => TK('tut.death.text', { max: DEATH.maxSkillLoss }),
        },
        {
            title: 'tut.needs.title',
            manual: true,
            focus: () => [tutStatRow(1), tutStatRow(2)],
            text: () => TK('tut.needs.text'),
        },
        {
            title: 'tut.low.title',
            manual: true,
            focus: () => [tutStatRow(0), tutStatRow(1), tutStatRow(2)],
            text: () => TK('tut.low.text', { hunger: player.nutritionRules.hunger.threshold, thirst: player.nutritionRules.thirst.threshold }),
        },
        {
            title: 'tut.xp.title',
            manual: true,
            focus: () => [tutStatRow(3)],
            text: () => TK('tut.xp.text'),
        },
        // ----- moving, the action wheel, gathering -----
        {
            title: 'tut.move.title',
            text: () => TK('tut.move.text'),
            enter(){ Tutorial.cell = tutWalkCell(); },
            target: () => Tutorial.cell,
            done(){ const pc = playerCell(); return !Tutorial.cell || (pc && hexDist(pc, Tutorial.cell) === 0); },
        },
        {
            title: 'tut.wheel.title',
            text: () => TK('tut.wheel.text') + (!Pad.active && Binds.get('wheel') === 'mouse@right' && DoubleClick.wait > 0 ? TK('tut.wheel.doubleClick') : ''),
            enter(){ Tutorial.cell = tutFernCell(); },
            target: () => Tutorial.cell,
            done(){ const w = GameUI.wheel, c = Tutorial.cell; return !c || (w && w.x === c.x && w.y === c.y); },
        },
        {
            title: 'tut.choose.title',
            text: () => TK(GameUI.wheel ? 'tut.choose.open' : 'tut.choose.closed', { gather: TK('wheel.gatherFibers'), walks: TK('tut.walksFirst') }),
            enter(){ Tutorial.fibers = player.inventory.countOf('plant_fiber'); },
            target: () => Tutorial.cell,
            focus: () => [tutWheelOption(o => o.id === 'gather')],
            done(){ return !Tutorial.cell || player.inventory.countOf('plant_fiber') > Tutorial.fibers; },
        },
        {   // the fibers the tutorial's tools need are gathered, not given (no ferns in reach: the craft steps top them up)
            title: 'tut.fibers.title',
            text: () => TK('tut.fibers.text', { n: Math.min(Tutorial.fiberGoal, player.inventory.countOf('plant_fiber')), goal: Tutorial.fiberGoal, gather: TK('wheel.gatherFibers') }),
            enter(){ tutNextFern(); },
            target: () => Tutorial.cell,
            focus: () => [tutWheelOption(o => o.id === 'gather')],
            done: () => player.inventory.countOf('plant_fiber') >= Tutorial.fiberGoal || !tutNextFern(),
        },
        // ----- the inventory: backpack, hotbar, the item in your hand, armor -----
        {
            title: 'tut.inventory.title',
            text: () => TK('tut.inventory.text'),
            enter(){ giveItems(Tutorial.planks, 30); giveItems('flint', 2); },   // quietly: the backpack just has them
            focus: () => [GameUI.inventoryOpen ? null : tutHotbarRect()],
            done: () => GameUI.inventoryOpen,
        },
        {
            title: 'tut.backpack.title',
            manual: true,
            text: () => TK('tut.backpack.text') + (GameUI.inventoryOpen ? '' : TK('tut.tabToSee')),
            focus: () => [GameUI.inventoryOpen ? tutBackpackRect() : null],
        },
        {
            title: 'tut.hotbar.title',
            manual: true,
            text: () => TK('tut.hotbar.text', { n: hotbarLayout().n }),
            focus: () => [tutHotbarRect()],
        },
        {
            title: 'tut.moveItems.title',
            text: () => TK(GameUI.inventoryOpen ? 'tut.moveItems.open' : 'tut.moveItems.closed'),
            enter(){ tutEnsure('planks', 30); },
            focus: () => GameUI.inventoryOpen ? [tutBackpackRect(), tutHotbarRect()] : [],
            done: () => tutOnHotbar(Tutorial.planks),
        },
        {
            title: 'tut.hand.title',
            text: () => TK('tut.hand.text', { n: hotbarLayout().n }),
            focus: () => [tutHotbarRect()],
            done: () => tutHolding(Tutorial.planks),
        },
        {
            title: 'tut.handUse.title',
            manual: true,
            text: () => TK('tut.handUse.text'),
            focus: () => [tutHotbarRect()],
        },
        {
            title: 'tut.tricks.title',
            manual: true,
            text: () => TK('tut.tricks.text') + (GameUI.inventoryOpen ? '' : TK('tut.tabToSee')),
            focus: () => [GameUI.inventoryOpen ? tutBackpackRect() : null],
        },
        {
            title: 'tut.gear.title',
            text: () => TK(GameUI.inventoryOpen ? 'tut.gear.open' : 'tut.gear.closed', { item: nameOf('cloth_hood') }),
            enter(){ if(!player.gear.head.getSlot(0) && !player.inventory.countOf('cloth_hood')) giveItems('cloth_hood', 1); },
            focus: () => GameUI.inventoryOpen ? [tutGearRect(), tutGearSlotRect('head')] : [],
            done: () => !!player.gear.head.getSlot(0),
        },
        {
            title: 'tut.armor.title',
            manual: true,
            text: () => TK('tut.armor.text') + (GameUI.inventoryOpen ? '' : TK('tut.tabToSee')),
            focus: () => [GameUI.inventoryOpen ? tutGearRect() : null],
        },
        // ----- crafting and workbenches -----
        {
            title: 'tut.handCraft.title',
            text: () => TK(GameUI.inventoryOpen && !GameUI.station ? 'tut.handCraft.open' : 'tut.handCraft.closed'),
            enter(){ tutEnsure('planks', 4); },
            focus: () => [GameUI.inventoryOpen ? tutCraftRect() : null],
            done: () => player.inventory.countOf('workbench') > 0 || !!tutBench(),
        },
        {
            title: 'tut.placeBench.title',
            text: () => TK(tutHolding('workbench') ? 'tut.placeBench.holding' : 'tut.placeBench.select', { place: TK('wheel.place', { item: nameOf('workbench') }) }),
            focus: () => [tutHolding('workbench') ? tutWheelOption(o => o.id === 'place') : tutHotbarRect()],
            done: () => !!tutBench(),
        },
        {
            title: 'tut.useBench.title',
            text(){
                const b = tutBench();
                if(!b) return TK('tut.placeBenchFirst');
                return tutOpenText(b, 'tut.useBench.walk', 'tut.useBench.hover', 'tut.useBench.pressE', { open: TK('wheel.open', { name: nameOf('workbench') }) });
            },
            target: () => tutBench(),
            done: () => !!GameUI.station && GameUI.station.kind === 'workbench',
        },
        {
            title: 'tut.benchCraft.title',
            text: () => TK(GameUI.station ? 'tut.benchCraft.open' : 'tut.benchCraft.closed'),
            enter(){ tutEnsure('planks', 3); },
            target: () => GameUI.station ? null : tutBench(),
            focus: () => [GameUI.station ? tutStationRect() : null],
            done: () => player.inventory.countOf('canteen') > 0,
        },
        {
            title: 'tut.sticks.title',
            text: () => TK(GameUI.inventoryOpen || GameUI.station ? 'tut.sticks.open' : 'tut.sticks.closed'),
            enter(){ tutEnsure('planks', 4); },
            focus: () => [GameUI.station ? tutStationRect() : GameUI.inventoryOpen ? tutCraftRect() : null],
            done: () => player.inventory.countOf('stick') >= 5,
        },
        // ----- mining -----
        tutCraftStep('wooden_pickaxe', 'tut.pickaxe.title', 'tut.pickaxe.cost', [['planks', 3], ['plant_fiber', 2], ['stick', 2]]),
        {
            title: 'tut.mining.title',
            text(){
                if(!Tutorial.cell) return TK('tut.mining.noCell');
                return TK(tutHolding('wooden_pickaxe') ? 'tut.mining.holding' : 'tut.mining.select');
            },
            enter(){
                tutToHotbar('wooden_pickaxe');
                Tutorial.cell = tutPlaceStone();
                Tutorial.cellId = Tutorial.cell && blockAt(Tutorial.cell.x, Tutorial.cell.y).id;
            },
            target: () => Tutorial.cell,
            focus: () => [tutHolding('wooden_pickaxe') ? null : tutHotbarRect()],
            done(){ const c = Tutorial.cell, b = c && blockAt(c.x, c.y); return !c || !b || b.id !== Tutorial.cellId; },
        },
        {
            title: 'tut.tiers.title',
            manual: true,
            text: () => TK('tut.tiers.text'),
            focus: () => [tutHotbarRect()],
        },
        // ----- farming: till, the farmland menu, seeds, water, harvest -----
        tutCraftStep('wooden_hoe', 'tut.hoe.title', 'tut.hoe.cost', [['planks', 2], ['plant_fiber', 2], ['stick', 2]]),
        {
            title: 'tut.till.title',
            text: () => TK(tutHolding('wooden_hoe') ? 'tut.till.holding' : 'tut.till.select'),
            enter(){ tutToHotbar('wooden_hoe'); Tutorial.cell = tutGrassCell(); },
            target: () => tutFarmland() || Tutorial.cell,
            focus: () => [tutHolding('wooden_hoe') ? null : tutHotbarRect()],
            done: () => !Tutorial.cell || !!tutFarmland(),
        },
        {
            title: 'tut.farmOpen.title',
            text(){
                const f = Tutorial.farm;
                if(!f) return TK('tut.farm.none');
                return tutOpenText(f, 'tut.farmOpen.walk', 'tut.farmOpen.hover', 'tut.farmOpen.pressE', { open: TK('wheel.open', { name: nameOf('farmland') }) });
            },
            enter(){ Tutorial.farm = tutFarmland(); tutGiveSeeds(); },
            target: () => tutFarmOpen() ? null : Tutorial.farm,
            done: () => !Tutorial.farm || tutFarmOpen(),
        },
        {
            title: 'tut.plant.title',
            text(){
                if(!Tutorial.farm) return TK('tut.farm.none');
                if(!tutFarmOpen()) return TK('tut.plant.closed');
                return TK('tut.plant.open', { slots: FARM.slots });
            },
            enter(){ Tutorial.farm = Tutorial.farm || tutFarmland(); tutGiveSeeds(); },
            target: () => tutFarmOpen() ? null : Tutorial.farm,
            focus: () => tutFarmOpen() ? [tutFarmSlotsRect(), tutBackpackRect()] : [],
            done(){
                const f = Tutorial.farm, b = f && blockAt(f.x, f.y);
                if(!b || !b.seeds) return true;
                if(b.seeds.isEmpty && !tutHasSeeds()) tutGiveSeeds();   // the seeds went somewhere else: more, quietly
                return tutFarmOpen() && !b.seeds.isEmpty;
            },
        },
        tutCraftStep('bucket', 'tut.bucket.title', 'tut.bucket.cost', [['planks', 5], ['plant_fiber', 3]]),
        {
            title: 'tut.water.title',
            text(){
                if(!Tutorial.cell) return TK('tut.water.noCell');
                if(!tutHolding('bucket')) return TK('tut.water.select');
                return TK(GameUI.wheel ? 'tut.water.wheel' : 'tut.water.closed', { fill: TK('tut.fillWord', { item: nameOf('bucket') }) });
            },
            enter(){
                tutToHotbar('bucket');
                Tutorial.farm = tutFarmland(true) || tutFarmland();
                Tutorial.cell = Tutorial.waterCell = tutWaterCell();
            },
            target: () => tutWaterBucket() ? null : Tutorial.cell,
            focus: () => [!tutHolding('bucket') ? tutHotbarRect() : tutWheelOption(o => o.id === 'fill')],
            done: () => !Tutorial.cell || tutWaterBucket(),
        },
        {
            title: 'tut.pour.title',
            text(){
                const f = Tutorial.farm, b = f && blockAt(f.x, f.y);
                if(!b || !b.intake) return TK('tut.farm.none');
                if(b.intake.isEmpty && !tutWaterBucket()) return TK('tut.pour.refill');
                if(!tutFarmOpen()) return tutOpenText(f, 'tut.pour.walk', 'tut.pour.hover', 'tut.pour.pressE');
                return TK(b.intake.isEmpty ? 'tut.pour.open' : 'tut.pour.pouring', { unit: FARM.bucketUnit, max: FARM.waterMax, secs: FARM.intakeSeconds });
            },
            enter(){
                Tutorial.farm = tutFarmland(true) || tutFarmland();
                const b = Tutorial.farm && blockAt(Tutorial.farm.x, Tutorial.farm.y);
                Tutorial.waterBase = b ? b.water : 0;
            },
            target(){
                const f = Tutorial.farm, b = f && blockAt(f.x, f.y);
                if(b && b.intake && b.intake.isEmpty && !tutWaterBucket()) return Tutorial.waterCell;
                return tutFarmOpen() ? null : f;
            },
            focus: () => tutFarmOpen() ? [tutFarmWaterRect()] : [],
            done(){
                // done once water flows in from the water slot. While the slot is empty the starting level follows the
                // soil (it dries a little, or was watered from the wheel), so only the slot counts.
                const f = Tutorial.farm, b = f && blockAt(f.x, f.y);
                if(!b || !b.intake) return true;
                if(b.intake.isEmpty){ Tutorial.waterBase = b.water; return false; }
                return b.water > Tutorial.waterBase || FARM.waterMax - b.water < FARM.bucketUnit;   // (or the soil is too full to take more)
            },
        },
        {
            title: 'tut.harvest.title',
            manual: true,
            text: () => TK('tut.harvest.text'),
            target: () => tutFarmOpen() ? null : Tutorial.farm,
            focus: () => tutFarmOpen() ? [tutFarmSlotsRect()] : [],
        },
        // ----- combat -----
        tutCraftStep('wooden_sword', 'tut.sword.title', 'tut.sword.cost', [['planks', 2], ['plant_fiber', 2], ['flint', 1], ['stick', 1]]),
        {
            title: 'tut.combat.title',
            text(){
                if(!Tutorial.mob) return TK('tut.combat.noMob');
                return TK(tutHolding('wooden_sword') ? 'tut.combat.holding' : 'tut.combat.select');
            },
            enter(){ tutToHotbar('wooden_sword'); Tutorial.mob = tutSpawnDummy(); },
            target: () => Tutorial.mob && Tutorial.mob.alive ? { x: Tutorial.mob.x, y: Tutorial.mob.y } : null,
            focus: () => [tutHolding('wooden_sword') ? null : tutHotbarRect()],
            done: () => !Tutorial.mob || !Tutorial.mob.alive,
        },
        {
            title: 'tut.weapons.title',
            manual: true,
            text: () => TK('tut.weapons.text'),
            focus: () => [tutHotbarRect()],
        },
        {
            title: 'tut.monsters.title',
            manual: true,
            text: () => TK('tut.monsters.text'),
        },
        // ----- more to find out there -----
        {
            title: 'tut.fishing.title',
            manual: true,
            text: () => TK('tut.fishing.text', { range: FISHING.range }),
        },
        {
            title: 'tut.heart.title',
            manual: true,
            text: () => TK('tut.heart.text'),
        },
        {
            title: 'tut.complete.title',
            text: () => TK('tut.complete.text'),
            done: () => false,
        },
    ],
    get current(){ return this.steps[this.step]; },
    begin(){
        this.cell = null;
        this.flags.next = false;
        const s = this.current;
        if(s.enter) s.enter();
    },
    tick(){
        if(!this.started){ this.started = true; this.begin(); return; }   // the player is placed by now
        const now = performance.now();
        Mobs.fx = Mobs.fx.filter(f => now - f.t0 < f.dur);   // Mobs.tick (which does this) doesn't run in the tutorial
        if(this.step >= this.steps.length - 1) return;
        const s = this.current;
        if(s.manual ? !this.flags.next : !s.done()) return;   // manual steps wait for the Next button
        if(!s.manual) notify(TK('tut.done'), '#8fe39a');
        this.step++;
        this.begin();
    },
    /** Cell to highlight for the current step. */
    target(){ const s = this.current; return s.target ? s.target() : null; },
    /** World overlay: a pulsing outline and a bobbing arrow over the target cell. */
    drawWorld(){
        const c = this.target();
        if(!c) return;
        const t = performance.now() / 1000, k = 0.5 + 0.5 * Math.sin(t * 5), w = Theaya.zone.toWorld(c.x, c.y);
        cellOutline(c.x, c.y, `rgba(143,227,154,${0.55 + 0.45 * k})`, 3 + 2 * k);
        push(); noStroke(); fill('#8fe39a');
        const ay = w.y - 34 - 5 * k;
        triangle(w.x - 8, ay - 10, w.x + 8, ay - 10, w.x, ay);
        pop();
    },
};
if(Tutorial.active){
    Mobs.list = []; Mobs.occ.clear();   // a calm world: no creatures at all
}

/** Screen areas other HUD parts use right now (the tutorial panel stays out of them). */
function tutObstacles(statsBottom){
    const hb = tutHotbarRect();
    const o = [
        { x: 12, y: 12, w: 248, h: statsBottom - 12 },                 // player stats
        { x: hb.x, y: hb.y - 34, w: hb.w, h: hb.h + 34 },              // hotbar + held item name
        { x: width - 262, y: 12, w: 262, h: (GameUI.clockBottom ?? 100) - 12 },   // clock (+ calendar)
    ];   // (toasts are left out on purpose: they never push or get pushed by other HUD parts)
    if(GameUI.helpRect) o.push(GameUI.helpRect);                       // the controls list (right side)
    if(GameUI.wheelRects) o.push(...GameUI.wheelRects);                // the action wheel's options
    if(GameUI.inventoryOpen){
        const L = inventoryLayout();
        o.push({ x: L.x, y: L.y, w: L.w, h: L.h });
        o.push(tutGearRect());                                         // the armor slots left of it
        if(L.craft) o.push({ x: L.craft.x, y: L.craft.y, w: L.craft.w, h: L.craft.h });
    }
    if(GameUI.station) o.push(tutStationRect());
    if(GameUI.skillsOpen){ const n = Object.keys(Skills.defs).length, h = 66 + n * 38; o.push({ x: width / 2 - 180, y: Math.max(12, height / 2 - h / 2), w: 360, h }); }
    return o;
}
/** Where the tutorial panel goes: the first free spot (left under the stats, top middle, bottom left, ...), or the least covered one. */
function tutPanelSpot(w, h, statsBottom){
    const obs = tutObstacles(statsBottom), pad = 10;
    const cands = [
        { x: 12, y: statsBottom + 10 },                                 // left, under the stats
        { x: 12 + 248 + 12, y: 12 },                                    // top, right next to the stats (left of the middle: clear of toasts and the controls list)
        { x: Math.round(width / 2 - w / 2), y: 12 },                    // top middle
        { x: 12, y: Math.round(height - h - 12) },                      // bottom left
        { x: Math.round(width - w - 274), y: 12 },                      // left of the clock
    ];
    let best = null;
    for(const c of cands){
        c.x = Math.max(0, Math.min(width - w, c.x)); c.y = Math.max(0, Math.min(height - h, c.y));
        let cover = 0;
        for(const r of obs){
            const ox = Math.min(c.x + w + pad, r.x + r.w) - Math.max(c.x - pad, r.x);
            const oy = Math.min(c.y + h + pad, r.y + r.h) - Math.max(c.y - pad, r.y);
            if(ox > 0 && oy > 0) cover += ox * oy;
        }
        if(cover === 0) return c;
        if(!best || cover < best.cover) best = { x: c.x, y: c.y, cover };
    }
    return best;
}
/**
 * How many lines `str` takes when boxed text wraps it to width `w` at the current text size: between words,
 * or between characters in Japanese (like the textWrap the HUD sets).
 */
function tutLineCount(str, w){
    const byChar = currentLanguage() === 'japanese';
    let lines = 0;
    for(const para of String(str).split('\n')){
        const tokens = byChar ? Array.from(para) : (para.match(/\S+\s*/g) || ['']);
        let cur = 0;
        lines++;
        for(const t of tokens){
            const tw = textWidth(t);
            if(cur > 0 && cur + textWidth(t.trimEnd()) > w){ lines++; cur = tw; }
            else cur += tw;
        }
    }
    return lines;
}
/** The tutorial panel: left side, under the player stats (`top` = y just below them); it moves aside when another part of the HUD needs the space. */
function drawTutorial(top = 150){
    const Tu = Tutorial, s = Tu.current, n = Tu.steps.length, last = Tu.step === n - 1;   // (not `T`: that's the text function)
    // highlight what the step is about (pulsing green box, on top of the HUD)
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    for(const r of (s.focus ? s.focus() : [])){
        if(!r) continue;
        noStroke(); fill(143, 227, 154, 22 + 28 * k); rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
        noFill(); stroke(143, 227, 154, 150 + 105 * k); strokeWeight(2 + 1.5 * k); rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
    }
    // the panel grows with the instruction (some steps explain a lot)
    const w = 360, body = s.text(), lead = 19;
    textStyle(NORMAL); textSize(14.5);
    const bodyH = Math.max(3, tutLineCount(body, w - 28)) * lead;
    const h = 58 + bodyH + (last ? 70 : 50);
    const at = tutPanelSpot(w, h, top - 10);
    // glide to the spot (it moves when the inventory etc. opens) instead of jumping
    const P = Tu.pos || (Tu.pos = { x: at.x, y: at.y });
    P.x += (at.x - P.x) * 0.25; P.y += (at.y - P.y) * 0.25;
    if(Math.abs(at.x - P.x) < 0.5) P.x = at.x;
    if(Math.abs(at.y - P.y) < 0.5) P.y = at.y;
    const x = Math.round(P.x), y = Math.round(P.y);
    panel(x, y, w, h);
    noStroke(); textAlign(LEFT, TOP);
    fill('#8fe39a'); textSize(12); textStyle(BOLD); text(TK('tut.header', { n: Tu.step + 1, total: n }), x + 14, y + 11);
    fill(255); textSize(19); text(TK(s.title), x + 14, y + 28);
    textStyle(NORMAL); fill(230); textSize(14.5); textLeading(lead); text(body, x + 14, y + 58, w - 28, bodyH + lead);
    const pw = (w - 28 - (n - 1) * 3) / n;
    for(let k = 0; k < n; k++){ fill(k < Tu.step ? '#8fe39a' : k === Tu.step ? '#ffd75e' : 'rgba(255,255,255,0.18)'); rect(x + 14 + k * (pw + 3), y + h - 10, pw, 4, 2); }
    if(last){
        const bw = (w - 28 - 10) / 2;
        button(x + 14, y + h - 52, bw, 32, TK('menu.newGame'), true, () => relaunch('new'), true);
        button(x + 24 + bw, y + h - 52, bw, 32, TK('tut.keepExploring'), true, () => { Tu.active = false; Mobs.repopulate(true); }, true);
    } else {
        button(x + 14, y + h - 36, 92, 20, TK('tut.skip'), true, () => relaunch(''), true);
        if(s.manual) button(x + w - 94, y + h - 38, 80, 24, TK('tut.next'), true, () => { Tu.flags.next = true; }, true);
    }
}


/* ---------------------------------------------------------------------
 * 12c. Saved games (.malengine files)
 *   Save: pause menu > Save Game downloads the running game as a .malengine file, made with the engine's
 *   male/MALEngine_Encryption.js: compressed, encrypted and sealed with SAVE_FILE.key, so a file that was
 *   edited in any way won't load.
 *   Load: start menu > Load Saved Game, pause menu > Load Game, or dropping a file on the page. The file is
 *   checked right away (a bad one is refused with a message), kept in SaveStash, and the page reloads into
 *   '#load': the world is generated from the save's seed, then SaveGame.apply lays the saved state over it
 *   (the last lines of this file), before the first frame.
 *   Inside, a save is plain JSON (SaveGame.capture): every cell (ground, water, blocks with their state,
 *   containers and machines), the clock, weather, player, inventory, armor, levels, skills and creatures.
 *   Items keep only what differs from a new one (durability, water...), so balance changes reach old saves.
 *   Every save carries GAME_VERSION (data.gameVersion). A save from an older 0.5.x patch is brought up to date
 *   by SAVE_PATCHES on load (SaveVersion.upgrade, in start), so small changes to its contents go there.
 *   Bump SAVE_FILE.version when the layout changes in a way older code can't read.
 * --------------------------------------------------------------------- */
const SaveGame = {
    status: null,     // { text, color, until }: the last save / load message (start menu, pause menu)
    busy: false,      // a save file is being read
    pendingSub: '',   // the loading screen's second line while the page reloads into a save
    _fresh: new Map(),
    _mobSkip: new Set(['id', 'type', 'def', 'x', 'y', 'px', 'py', 'next', 'breaking', 'alive', 'hitAt', 'chasing']),

    available(){ return typeof MALEngine_Encryption !== 'undefined'; },
    canSave(){ return this.available() && !Tutorial.active; },
    flash(text, color = '#e8e8e8', ms = 8000){ this.status = { text, color, until: performance.now() + ms }; },
    /** The message to show right now, or null. */
    shown(){ return this.status && this.status.until > performance.now() ? this.status : null; },

    /* ----- saving ----- */
    /** Pause menu > Save Game: download the running game as a .malengine file. */
    download(){
        if(!this.canSave()) return;
        try {
            const data = this.capture();
            const { file } = MALEngine_Encryption.save(data, `world-of-theaya_v${GAME_VERSION}_day-${data.day}_seed-${data.seed}`, saveOpts());
            this.flash(T('save.done', { file }), '#8fe39a', 10000);
        } catch(e){
            console.error('Saving the game failed:', e);
            this.flash(T('save.failed'), '#ff8a7a', 10000);
        }
    },
    /** Everything that makes up the running game, as plain JSON (see apply). */
    capture(){
        const Th = Theaya, N = MAP_COLS * MAP_ROWS, now = sceneTime();
        this._fresh.clear();
        const perCell = arr => Array.from({ length: N }, (_, i) => arr[i] ?? null);
        const left = map => [...map].map(([i, t]) => [i, Math.max(0, t - now)]);   // scene-clock times -> seconds from now (the scene clock restarts with the page)
        const pc = playerCell(), inv = player.inventory, gear = {};
        for(const s of ARMOR_SLOTS) gear[s] = this.packItem(player.gear[s].getSlot(0));
        return {
            game: SAVE_FILE.game, version: SAVE_FILE.version, gameVersion: GAME_VERSION, savedAt: new Date().toISOString(),
            seed: LAUNCH.seed, day: Math.max(1, Clock.dayIndex - Clock.startDay + 1), map: [MAP_COLS, MAP_ROWS],
            difficulty: Difficulty.id,
            world: {
                ground: perCell(Th.ground), biome: perCell(Th.biome), parentBiome: perCell(Th.parentBiome),
                water: perCell(Th.water), origin: perCell(Th.origin),
                blocks: Array.from({ length: N }, (_, i) => Th.blocks[i] ? this.packBlock(Th.blocks[i]) : null),
                waterCells: [...Th.waterCells], dried: [...Th.dried], puddles: [...Th.puddles],
                floorDug: [...Th.floorDug].map(([i, s]) => [i, s.left, s.since]),
                foundations: [...Th.foundations],   // [[cell, kind], ...]
                mud: [...Th.mud], snow: [...Th.snow], growing: left(Th.growing), refilling: left(Th.refilling), home: Th.home,
            },
            clock: { elapsed: Clock.elapsed, startDay: Clock.startDay },
            weather: { current: Weather.current, next: Weather.next, lastDay: Weather.lastDay, acc: Weather.acc },
            player: {
                cell: pc ? { x: pc.x, y: pc.y } : null,
                health: player.health, maxHealth: player.maxHealth, hunger: player.hunger, thirst: player.thirst,
                satruation: player.satruation, poison: player.poison, regenBuff: player.regenBuff,
                inventory: Array.from({ length: inv.slots }, (_, k) => this.packItem(inv[k + 1])),
                gear, hotbar: GameUI.hotbar, boat: { aboard: Boat.aboard, cell: Boat.cell },
            },
            levels: { level: Levels.level, xp: Levels.xp, pending: Levels.pending },
            skills: Object.assign({}, Skills.levels),
            mobs: { now: Mobs.now, spawnTimer: Mobs.spawnTimer, repopTimer: Mobs.repopTimer, list: Mobs.list.filter(m => m.alive).map(m => this.packMob(m)) },
            structures: Structures.capture(),   // goblin camps: where they are, their creatures' timers, abandoned or not, and when each type ran out
            regrowth: { timer: Regrowth.timer },
        };
    },

    /* ----- items ----- */
    /** A new item's toJSON(), per id: a saved item keeps only what differs from it. */
    fresh(id){
        if(!this._fresh.has(id)) this._fresh.set(id, Items.create(id).toJSON());
        return this._fresh.get(id);
    },
    /**
     * An item -> its save form, only the parts that differ from a new one: { id, n (count), c: { component:
     * changed values }, add: { component: values }, rm: [components it lost], tags, meta, name (its own name),
     * x (extra values) }. An item the game doesn't define keeps the engine's whole toJSON() as { full }.
     */
    packItem(it){
        if(!(it instanceof Item)) return null;
        const j = it.toJSON();
        if(!Items.has(j.id)) return { full: j };
        const f = this.fresh(j.id), out = { id: j.id }, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        if(j.count !== 1) out.n = j.count;
        const c = {}, add = {};
        for(const [cid, vals] of Object.entries(j.components)){
            const base = f.components[cid];
            if(!base){ add[cid] = vals; continue; }
            const diff = {};
            for(const [k, v] of Object.entries(vals)) if(!same(v, base[k])) diff[k] = v;
            if(Object.keys(diff).length) c[cid] = diff;
        }
        const rm = Object.keys(f.components).filter(cid => !(cid in j.components));
        if(Object.keys(c).length) out.c = c;
        if(Object.keys(add).length) out.add = add;
        if(rm.length) out.rm = rm;
        if(!same(j.tags, f.tags)) out.tags = j.tags;
        if(!same(j.meta, f.meta)) out.meta = j.meta;
        if(j.displayName) out.name = j.displayName;
        if(!same(j.extras, f.extras)) out.x = j.extras;
        return out;
    },
    /** packItem() backwards: a new item with the saved changes laid over it. null for an item the game no longer has. */
    unpackItem(p){
        if(!p) return null;
        if(p.full) return Item.fromJSON(p.full);
        if(!Items.has(p.id)) return null;
        const it = Items.create(p.id, 1);
        for(const cid of p.rm || []) it.unpackage(cid);
        for(const [cid, vals] of Object.entries(p.c || {})) if(it.has(cid)) it.get(cid).load(vals);
        for(const [cid, vals] of Object.entries(p.add || {})){ const C = ItemComponent.get(cid); if(C) it.package(C.fromJSON(vals)); }
        if(p.tags) it.tags = new Set(p.tags);
        if(p.meta) it.meta = p.meta;
        if(p.name) it.displayName = p.name;
        for(const [k, v] of Object.entries(p.x || {})){ it[k] = v; it._extras.add(k); }
        it.count = Math.max(1, Math.floor(Number(p.n ?? 1)) || 1);
        return it;
    },

    /* ----- blocks and creatures ----- */
    /** A block -> its id when it has no state, else { id, s: { field: value } } (see packValue). */
    packBlock(b){
        const s = {}, ctx = { items: new Map() };
        for(const k of Object.keys(b)){
            if(k === 'id') continue;
            const v = this.packValue(b[k], ctx);
            if(v !== undefined) s[k] = v;
        }
        return Object.keys(s).length ? { id: b.id, s } : b.id;
    },
    /**
     * A block's state value -> JSON. An item becomes { $item, $k } the first time and { $ref: k } after that, so
     * two fields holding the same item (a farmland seedling and the seed in its slot) still share it after a
     * load. A Box becomes { $box: [items] }, a Map / Set { $map } / { $set }, Infinity / NaN { $num }.
     */
    packValue(v, ctx){
        if(v === undefined || typeof v === 'function') return undefined;
        if(typeof v === 'number') return Number.isFinite(v) ? v : { $num: String(v) };
        if(v === null || typeof v !== 'object') return v;
        if(v instanceof Item){
            if(ctx.items.has(v)) return { $ref: ctx.items.get(v) };
            const k = ctx.items.size;
            ctx.items.set(v, k);
            return { $item: this.packItem(v), $k: k };
        }
        if(v instanceof Box) return { $box: v.items.map(it => this.packValue(it, ctx) ?? null) };
        if(v instanceof Map) return { $map: [...v].map(([k, x]) => [this.packValue(k, ctx) ?? null, this.packValue(x, ctx) ?? null]) };
        if(v instanceof Set) return { $set: [...v].map(x => this.packValue(x, ctx) ?? null) };
        if(Array.isArray(v)) return v.map(x => this.packValue(x, ctx) ?? null);
        const o = {};
        for(const k of Object.keys(v)){ const p = this.packValue(v[k], ctx); if(p !== undefined) o[k] = p; }
        return o;
    },
    /** packValue() backwards (a $box comes back as a new Box; unpackBlock moves its items into the block's own). */
    unpackValue(p, ctx){
        if(p === null || typeof p !== 'object') return p;
        if(Array.isArray(p)) return p.map(x => this.unpackValue(x, ctx));
        if('$item' in p){ const it = this.unpackItem(p.$item); ctx.items[p.$k] = it; return it; }
        if('$ref' in p) return ctx.items[p.$ref] ?? null;
        if('$num' in p) return Number(p.$num);
        if('$box' in p){
            const items = p.$box.map(x => this.unpackValue(x, ctx)), box = new Box(Math.max(1, items.length));
            items.forEach((it, k) => box.setSlot(k, it instanceof Item ? it : null));
            return box;
        }
        if('$map' in p) return new Map(p.$map.map(([k, x]) => [this.unpackValue(k, ctx), this.unpackValue(x, ctx)]));
        if('$set' in p) return new Set(p.$set.map(x => this.unpackValue(x, ctx)));
        const o = {};
        for(const k of Object.keys(p)) o[k] = this.unpackValue(p[k], ctx);
        return o;
    },
    /** Puts a saved block back in cell (x, y). False when that block no longer exists. */
    unpackBlock(x, y, p){
        const id = typeof p === 'string' ? p : p && p.id;
        if(!id || !Blocks.get(id)) return false;
        const ctx = { items: [] }, state = {}, boxes = {};
        for(const [k, v] of Object.entries((p && p.s) || {})){
            const val = this.unpackValue(v, ctx);
            if(val instanceof Box) boxes[k] = val; else state[k] = val;
        }
        setBlock(x, y, id, state);     // init() makes the boxes the block needs (with their slot rules)...
        const b = blockAt(x, y);
        Object.assign(b, state);       // ...and may reset values (a machine starts out cold): the saved ones win
        for(const [k, box] of Object.entries(boxes)){
            const live = b[k];
            if(live instanceof Box) for(let s = 0; s < live.size; s++) live.setSlot(s, box.getSlot(s));
            else b[k] = box;
        }
        // the saved field order (which item comes first decides $item / $ref), so saving it again gives the same file
        for(const k of Object.keys((p && p.s) || {})){ const v = b[k]; delete b[k]; b[k] = v; }
        return true;
    },
    /** A creature -> { type, x, y, ...its plain values, gear } (its type's definition and its motion aren't saved). */
    packMob(m){
        const out = { type: m.type, x: m.x, y: m.y };
        for(const [k, v] of Object.entries(m)){
            if(this._mobSkip.has(k)) continue;
            if(typeof v === 'number' ? Number.isFinite(v) : (v === null || typeof v === 'string' || typeof v === 'boolean')) out[k] = v;
        }
        if(m.gear) out.gear = Object.fromEntries(Object.entries(m.gear).map(([slot, it]) => [slot, this.packItem(it)]));   // a goblin's weapon and armor
        return out;
    },

    /* ----- loading ----- */
    /**
     * Lays saved data over the world that was just generated from its seed (at load, before the first frame).
     * Returns how many saved blocks / items no longer exist in this version (they're left out).
     */
    apply(data){
        const Th = Theaya, N = MAP_COLS * MAP_ROWS, W = data.world, now = sceneTime();
        if(!Array.isArray(data.map) || data.map[0] !== MAP_COLS || data.map[1] !== MAP_ROWS || W.blocks.length !== N) throw new Error('the map size is different');
        const at = (a, i) => Array.isArray(a) ? a[i] ?? null : null;
        const num = (v, d) => v != null && Number.isFinite(Number(v)) ? Number(v) : d;
        let lost = 0;
        // the ground first: whether a cell can be walked on depends on it
        for(let i = 0; i < N; i++){
            const g = at(W.ground, i), bio = at(W.biome, i), pb = at(W.parentBiome, i), w = at(W.water, i);
            if(g && groundTypes[g]) Th.ground[i] = g;
            if(bio) Th.biome[i] = bio;
            if(pb) Th.parentBiome[i] = pb; else delete Th.parentBiome[i];
            if(w == null) delete Th.water[i]; else Th.water[i] = num(w, 0);
            Th.origin[i] = at(W.origin, i);
        }
        BiomeHeat.reset(); CaveDepth.reset();   // the biomes may differ from the freshly generated ones
        // the blocks: empty every cell and its trackers, then put the saved ones back (setBlock rebuilds the trackers)
        Th.blocks.fill(null, 0, N);
        for(const set of [Th.trees, Th.plants, Th.lights, Th.hearts, Th.heartStones, Th.built, ...Object.values(Th.machines)]) set.clear();
        for(let i = 0; i < N; i++){
            const p = W.blocks[i];
            if(p == null) continue;
            const { x, y } = cellXY(i);
            try { if(!this.unpackBlock(x, y, p)) lost++; }
            catch(e){ console.warn(`SaveGame: the block at ${x},${y} couldn't be loaded:`, p, e); Th.blocks[i] = null; lost++; }
        }
        // the rest of the cells' state (after the blocks: setBlock clears puddles / snow and starts its own timers)
        const ints = a => (Array.isArray(a) ? a : []).filter(i => Number.isInteger(i) && i >= 0 && i < N);
        const pairs = a => (Array.isArray(a) ? a : []).filter(e => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && e[0] < N);
        const refill = (set, list) => { set.clear(); for(const i of list) set.add(i); };
        Th.waterCells = ints(W.waterCells);
        refill(Th.dried, ints(W.dried)); refill(Th.mud, ints(W.mud)); refill(Th.snow, ints(W.snow));
        Th.puddles.clear(); for(const [i, n] of pairs(W.puddles)) Th.puddles.set(i, num(n, 1));
        Th.floorDug.clear(); for(const [i, l, since] of pairs(W.floorDug)) Th.floorDug.set(i, { left: num(l, 0), since: num(since, 0) });
        // (older saves have none; the first ones were plain cell numbers: those become stone)
        Th.foundations.clear();
        for(const e of Array.isArray(W.foundations) ? W.foundations : []){
            const [i, kind] = Array.isArray(e) ? e : [e, 'stone'];
            if(Number.isInteger(i) && i >= 0 && i < N && Th.ground[i] === FLOOR) Th.foundations.set(i, FOUNDATION.kinds[kind] ? kind : 'stone');
        }
        Th.growing.clear(); for(const [i, t] of pairs(W.growing)) Th.growing.set(i, now + num(t, 0));
        Th.refilling.clear(); for(const [i, t] of pairs(W.refilling)) Th.refilling.set(i, now + num(t, 0));
        Th.home = Number.isInteger(W.home) ? W.home : -1;
        for(let i = 0; i < N; i++){ const { x, y } = cellXY(i); syncCell(x, y); }
        Th.fullRedraw = true;
        // the difficulty the world was saved on (it becomes the current setting; it can be changed in Settings)
        if(DIFFICULTY[data.difficulty]) Difficulty.set(data.difficulty, true, true);
        // time and weather
        const C = data.clock || {}, Wd = data.weather || {};
        Clock.elapsed = num(C.elapsed, Clock.elapsed);
        Clock.startDay = num(C.startDay, Clock.startDay);
        Weather.current = Wd.current && _weatherControl[Wd.current.type] ? Wd.current : null;
        Weather.next = Wd.next && _weatherControl[Wd.next.type] ? Wd.next : null;
        Weather.lastDay = num(Wd.lastDay, -1);
        Weather.acc = num(Wd.acc, 0);
        // levels and skills (unknown skills are left out)
        const L = data.levels || {};
        Levels.level = Math.max(1, Math.floor(num(L.level, 1)));
        Levels.xp = Math.max(0, num(L.xp, 0));
        Levels.pending = Math.max(0, Math.floor(num(L.pending, 0)));   // a level-up choice that was waiting opens again
        Skills.levels = {};
        for(const [id, lv] of Object.entries(data.skills || {})) if(Skills.defs[id]) Skills.levels[id] = Math.max(0, Math.min(Skills.defs[id].max, Math.floor(num(lv, 0))));
        // the player
        const P = data.player;
        for(const k of ['maxHealth', 'health', 'hunger', 'thirst', 'satruation']) player[k] = num(P[k], player[k]);
        player.poison = P.poison && Number.isFinite(P.poison.left) ? { left: P.poison.left, dps: num(P.poison.dps, 0) } : null;
        player.regenBuff = P.regenBuff && Number.isFinite(P.regenBuff.left) ? { left: P.regenBuff.left, rate: num(P.regenBuff.rate, 0) } : null;
        const loadItem = p => {
            let it = null;
            try { it = this.unpackItem(p); } catch(e){ console.warn('SaveGame: an item couldn\'t be loaded:', p, e); }
            if(p && !it) lost++;
            return it;
        };
        const inv = player.inventory;
        for(let s = 1; s <= inv.slots; s++) inv[s] = loadItem(at(P.inventory, s - 1));
        inv._changed({ event:'load' });
        for(const s of ARMOR_SLOTS) player.gear[s].setSlot(0, loadItem(P.gear && P.gear[s]));
        GameUI.hotbar = Math.max(1, Math.min(inv.hotbar.slots, Math.floor(num(P.hotbar, 1))));
        Act.job = null; Act.combat = null; Fishing.line = null;
        const boat = P.boat || {}, c = P.cell;
        if(boat.aboard && Number.isInteger(boat.cell) && Th.blocks[boat.cell] && Th.blocks[boat.cell].id === 'boat') setBoating(true, boat.cell);
        const placed = c && Th.zone.inBounds(c.x, c.y) && isPassable(c.x, c.y) && areaZones.home.move(player, c.x, c.y);
        if(!placed){ if(Boat.aboard) setBoating(false); areaZones.home.move(player, Th.spawn.x, Th.spawn.y); }   // its cell is blocked now: back at camp
        // structures (goblin camps; an older save has none, and none of their blocks either)
        Structures.load(data.structures);
        // the creatures (a type this version doesn't have is left out; the world tops animals up by itself)
        const M = data.mobs || {};
        Mobs.list = []; Mobs.occ.clear();
        Mobs.now = num(M.now, 0); Mobs.spawnTimer = num(M.spawnTimer, 0); Mobs.repopTimer = num(M.repopTimer, 15);
        for(const s of Array.isArray(M.list) ? M.list : []){
            if(!s || !CREATURES[s.type] || !Th.zone.inBounds(s.x, s.y) || Mobs.occ.has(cellIndex(s.x, s.y))) continue;
            const m = Mobs.spawn(s.type, s.x, s.y, { home: Number.isInteger(s.home) ? s.home : null, role: s.role });
            for(const [k, v] of Object.entries(s)) if(!this._mobSkip.has(k) && (v === null || typeof v !== 'object')) m[k] = v;
            if(s.gear && typeof s.gear === 'object'){   // its own gear, not the new roll
                const gear = { weapon: null };
                for(const slot of ARMOR_SLOTS) gear[slot] = null;
                for(const slot of Object.keys(gear)) gear[slot] = s.gear[slot] ? loadItem(s.gear[slot]) : null;
                m.gear = gear;
            }
        }
        Regrowth.timer = num(data.regrowth && data.regrowth.timer, Regrowth.timer);
        return lost;
    },
    /** '#load': apply the save (the last lines of this file). One that breaks halfway goes back to the start menu with a message. */
    start(data){
        let lost = 0, madeIn = GAME_VERSION;
        try { madeIn = SaveVersion.upgrade(data); lost = this.apply(data); }
        catch(e){
            console.error('Loading the saved game failed:', e);
            SaveStash.setError('apply');
            Loading.show(T('loading.loading'));
            location.hash = '';
            location.reload();
            return;
        }
        // the address bar names the seed now: Restart (or reloading the page) starts a fresh copy of it, not this save again
        const hash = '#seed=' + LAUNCH.seed;
        try { history.replaceState(null, '', hash); } catch(e){ try { location.replace(hash); } catch(e2){} }
        notify(T('load.done', { day: data.day ?? 1 }), '#8fe39a', 5000);
        if(madeIn !== GAME_VERSION) notify(T('load.upgraded', { from: madeIn, to: GAME_VERSION }), '#a6d8ff', 8000);
        if(lost) notify(T('load.lost', { n: lost, s: lost === 1 ? '' : 's' }), '#ffb070', 9000);
    },
    /** Start menu / pause menu: pick a .malengine file and load it. */
    async chooseAndLoad(){
        if(!this.available()){ this.flash(T('load.err.noTool'), '#ff8a7a'); return; }
        if(this.busy || Menu.launching) return;
        let file = null;
        try { file = await MALEngine_Encryption.pickFile(); }
        catch(e){ this.flash(T('load.err.read'), '#ff8a7a'); return; }
        if(file) await this.loadFile(file);
    },
    /** A save file (picked or dropped): check it, then reload the page into it. A bad file stays here with a message. */
    async loadFile(file){
        if(!this.available() || this.busy || Menu.launching) return;
        this.busy = true;
        this.flash(T('load.reading'), '#bcd6ff', 60000);
        try {
            const bytes = await MALEngine_Encryption.readFile(file);
            if(bytes.length > SAVE_FILE.maxBytes){ this.flash(T('load.err.tooBig'), '#ff8a7a'); return; }
            const data = MALEngine_Encryption.decode(bytes, saveOpts());
            let why = saveProblem(data);
            if(!why && (!Array.isArray(data.map) || data.map[0] !== MAP_COLS || data.map[1] !== MAP_ROWS)) why = 'map';
            if(why){ this.flash(T('load.err.' + why), '#ff8a7a', 10000); return; }
            if(!SaveStash.put(bytes)){ this.flash(T('load.err.storage'), '#ff8a7a', 10000); return; }
            this.status = null;
            this.pendingSub = T('loading.saveSub', { day: data.day ?? 1, seed: data.seed });
            relaunch('load');
        } catch(e){
            if(saveErrorCode(e) === 'read') console.error('Reading the save file failed:', e);
            this.flash(T('load.err.' + saveErrorCode(e)), '#ff8a7a', 10000);
        } finally {
            this.busy = false;
        }
    },
    /** Can a save file dropped on the page be loaded right now? (the start menu, or pause menu > Load Game) */
    dropOk(){ return (Menu.active && Menu.view === 'main' && !Menu.launching) || (GameUI.paused && !GameUI.settingsOpen && GameUI.pauseView === 'load'); },
};
// Dropping a save file on the page loads it (start menu, pause menu > Load Game). Any other time it only says where
// to go: the browser would otherwise open the dropped file in place of the game.
{
    const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
    window.addEventListener('dragover', e => {
        if(!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('drop', e => {
        if(!hasFiles(e)) return;
        e.preventDefault();
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if(!file) return;
        if(SaveGame.dropOk()) SaveGame.loadFile(file);
        else if(GameUI.paused || Menu.active) SaveGame.flash(T('load.dropHint'), '#ffd75e');
        else notify(T('load.dropHint'), '#ffd75e');
    });
}


/* ---------------------------------------------------------------------
 * 13. Scene
 * --------------------------------------------------------------------- */

// A saved game ('#load', see 12c): lay it over the world generated from its seed, before the first frame.
if(LAUNCH.save) SaveGame.start(LAUNCH.save);
else if(LAUNCH.loadError) SaveGame.flash(T('load.err.' + LAUNCH.loadError), '#ff8a7a', 15000);   // shown in the start menu

Scene.setScene(SCENE_ID);
Theaya.ready = true;
