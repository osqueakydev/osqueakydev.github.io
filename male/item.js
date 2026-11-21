/**
 * General-purpose inventory with three containers:
 *   - inventory (the object itself, slots 1..this.slots)
 *   - hotbar    (this.hotbar, slots 1..this.hotbar.slots)
 *   - skills    (this.skills, slots 1..this.skills.slots)
 *
 * An empty slot is always `null`.
 *
 * Both `hotbar` and `skills` are "entry containers": every populated slot
 * holds an entry of the form
 *     { inventorySlot: <int 1..this.slots>, item: <this[inventorySlot]> }
 * so the entry always references a live inventory slot. Use
 * appendHotbar / appendSkill (and removeHotbar / removeSkill /
 * syncHotbar / syncSkills) to keep them consistent.
 *
 * Events (see .on): 'add' 'remove' 'set' 'swap' 'move' 'transfer'
 *                   'clear' 'sort' 'compact' 'change'
 */
class Inventory {
    constructor(inv, hotbar, skills){
        inv    = Number(inv);
        hotbar = Number(hotbar);
        skills = Number(skills);
        if(!Number.isInteger(inv)    || inv    < 1) throw new Error('Inventory: inv size must be a positive integer.');
        if(!Number.isInteger(hotbar) || hotbar < 0) throw new Error('Inventory: hotbar size must be a non-negative integer.');
        if(!Number.isInteger(skills) || skills < 0) throw new Error('Inventory: skills size must be a non-negative integer.');

        this.slots = inv;

        this.hotbar = {
            slots: hotbar,
            get length(){
                let l = 0;
                for(let i = 1; i <= this.slots; i++) if(this[i] != null) l++;
                return l;
            }
        };
        this.skills = {
            slots: skills,
            get length(){
                let l = 0;
                for(let i = 1; i <= this.slots; i++) if(this[i] != null) l++;
                return l;
            }
        };

        this.trashed = [];   // overflow disposed by the 'trash' policy
        this.push    = [];   // overflow disposed by the 'push' policy  (plain data array)

        this.appendMode = 'shift'; // 'shift' or anything else

        for(let i = 1; i <= inv;    i++) this[i]        = null;
        for(let i = 1; i <= hotbar; i++) this.hotbar[i] = null;
        for(let i = 1; i <= skills; i++) this.skills[i] = null;

        this._listeners = Object.create(null);
    }

    /* ================================================================== *
     * Events
     * ================================================================== */

    on(event, callback){
        (this._listeners[event] ||= []).push(callback);
        return () => this.off(event, callback);
    }
    off(event, callback){
        const arr = this._listeners[event];
        if(!arr) return;
        const i = arr.indexOf(callback);
        if(i >= 0) arr.splice(i, 1);
    }
    once(event, callback){
        const wrapper = (payload) => { this.off(event, wrapper); callback(payload); };
        return this.on(event, wrapper);
    }
    _emit(event, payload = {}){
        const fire = (name) => {
            const arr = this._listeners[name];
            if(!arr || arr.length === 0) return;
            for(const cb of arr.slice()){
                try { cb(payload); }
                catch(e){ console.error(`Inventory: error in '${name}' listener:`, e); }
            }
        };
        fire(event);
        if(event !== 'change') fire('change');
    }

    /* ================================================================== *
     * Container helpers
     * ================================================================== */

    container(name = 'inventory'){ return this._resolveTarget(name); }
    get containers(){
        return { inventory: this, hotbar: this.hotbar, skills: this.skills };
    }

    _resolveTarget(destination){
        switch(String(destination).toLowerCase()){
            case 'skill':
            case 'skills': return this.skills;
            case 'hotbar': return this.hotbar;
            default:       return this;
        }
    }
    _validateSlot(target, slot){
        return Number.isInteger(slot) && slot >= 1 && slot <= target.slots;
    }
    _firstFreeSlot(target){
        for(let i = 1; i <= target.slots; i++) if(target[i] == null) return i;
        return 0;
    }
    _overflowMode(overflow){
        return overflow == null ? 'trash' : String(overflow).toLowerCase();
    }

    /* ================================================================== *
     * Basic state
     * ================================================================== */

    get length(){
        let l = 0;
        for(let i = 1; i <= this.slots; i++) if(this[i] != null) l++;
        return l;
    }
    get inventory(){
        const inv = {};
        for(let i = 1; i <= this.slots; i++) inv[i] = this[i] ?? null;
        return inv;
    }

    isEmpty(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) return false;
        return true;
    }
    isFull(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = 1; i <= t.slots; i++) if(t[i] == null) return false;
        return true;
    }
    count(predicate){
        let n = 0;
        for(let i = 1; i <= this.slots; i++){
            if(this[i] != null && (predicate ? predicate(this[i], i) : true)) n++;
        }
        return n;
    }
    countIn(destination = 'inventory', predicate){
        const t = this._resolveTarget(destination);
        let n = 0;
        for(let i = 1; i <= t.slots; i++){
            if(t[i] != null && (predicate ? predicate(t[i], i) : true)) n++;
        }
        return n;
    }

    /* ================================================================== *
     * Lookup
     * ================================================================== */

    get(slot, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        if(!this._validateSlot(t, slot)) return undefined;
        return t[slot];
    }
    has(itemOrPredicate){
        if(typeof itemOrPredicate === 'function') return this.find(itemOrPredicate) !== null;
        for(let i = 1; i <= this.slots; i++) if(this[i] === itemOrPredicate) return true;
        return false;
    }
    find(predicate){
        for(let i = 1; i <= this.slots; i++){
            if(this[i] != null && predicate(this[i], i)) return { slot: i, item: this[i] };
        }
        return null;
    }
    findAll(predicate){
        const out = [];
        for(let i = 1; i <= this.slots; i++){
            if(this[i] != null && predicate(this[i], i)) out.push({ slot: i, item: this[i] });
        }
        return out;
    }
    first(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) return { slot: i, item: t[i] };
        return null;
    }
    last(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = t.slots; i >= 1; i--) if(t[i] != null) return { slot: i, item: t[i] };
        return null;
    }
    random(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        const items = [];
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) items.push({ slot: i, item: t[i] });
        return items.length ? items[Math.floor(Math.random() * items.length)] : null;
    }
    firstEmpty(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = 1; i <= t.slots; i++) if(t[i] == null) return i;
        return null;
    }
    lastEmpty(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = t.slots; i >= 1; i--) if(t[i] == null) return i;
        return null;
    }

    /* ================================================================== *
     * Raw mutation (inventory only — for hotbar/skills use the entry API)
     * ================================================================== */

    set(slot, item, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        if(!this._validateSlot(t, slot)){
            new Message(`Inventory|Set: slot ${slot} is out of range (1-${t.slots}).`);
            return false;
        }
        const old = t[slot];
        t[slot] = item ?? null;
        this._emit('set', { destination, slot, old, new: item ?? null });
        return true;
    }

    remove(slot, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        if(!this._validateSlot(t, slot)) return null;
        const item = t[slot];
        if(item == null) return null;
        t[slot] = null;
        this._emit('remove', { destination, slot, item });
        return item;
    }

    removeItem(valueOrPredicate, limit = Infinity){
        const match = typeof valueOrPredicate === 'function'
            ? valueOrPredicate
            : ((v) => v === valueOrPredicate);
        const removed = [];
        for(let i = 1; i <= this.slots && removed.length < limit; i++){
            if(this[i] != null && match(this[i], i)){
                const item = this[i];
                this[i] = null;
                removed.push({ slot: i, item });
                this._emit('remove', { destination: 'inventory', slot: i, item });
            }
        }
        return removed;
    }

    clear(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        const cleared = [];
        for(let i = 1; i <= t.slots; i++){
            if(t[i] != null){
                cleared.push({ slot: i, item: t[i] });
                t[i] = null;
            }
        }
        if(cleared.length) this._emit('clear', { destination, cleared });
        return cleared;
    }

    swap(a, b, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        if(!this._validateSlot(t, a) || !this._validateSlot(t, b)) return false;
        if(a === b) return true;
        const itemA = t[a], itemB = t[b];
        t[a] = itemB;
        t[b] = itemA;
        this._emit('swap', { destination, a, b, itemA, itemB });
        return true;
    }

    move(from, to, destination = 'inventory', { overwrite = false } = {}){
        const t = this._resolveTarget(destination);
        if(!this._validateSlot(t, from) || !this._validateSlot(t, to)) return false;
        if(from === to) return true;
        if(t[to] != null && !overwrite){
            new Message(`Inventory|Move: slot ${to} is occupied.`);
            return false;
        }
        const item = t[from];
        const overwritten = t[to];
        t[to] = item;
        t[from] = null;
        this._emit('move', { destination, from, to, item, overwritten });
        return true;
    }

    transfer(fromSlot, toSlot, fromDest = 'inventory', toDest = 'inventory', { overwrite = false } = {}){
        const from = this._resolveTarget(fromDest);
        const to   = this._resolveTarget(toDest);
        if(!this._validateSlot(from, fromSlot) || !this._validateSlot(to, toSlot)) return false;
        if(from === to && fromSlot === toSlot) return true;
        if(to[toSlot] != null && !overwrite){
            new Message(`Inventory|Transfer: ${toDest} slot ${toSlot} is occupied.`);
            return false;
        }
        const item = from[fromSlot];
        const overwritten = to[toSlot];
        to[toSlot] = item;
        from[fromSlot] = null;
        this._emit('transfer', { fromDest, fromSlot, toDest, toSlot, item, overwritten });
        return true;
    }

    compact(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        const items = [];
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) items.push(t[i]);
        for(let i = 1; i <= t.slots; i++) t[i] = items[i - 1] ?? null;
        this._emit('compact', { destination });
        return this;
    }

    sort(comparator, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        const items = [];
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) items.push(t[i]);
        items.sort(comparator);
        for(let i = 1; i <= t.slots; i++) t[i] = items[i - 1] ?? null;
        this._emit('sort', { destination });
        return this;
    }

    /* ================================================================== *
     * append(): insert a raw value into inventory; delegate to entry
     * logic for hotbar/skills so the result is always a valid entry.
     * ================================================================== */

    append(n, slot = (this.appendMode == 'shift' ? 0 : null), overflow = 'trash', destination = 'inventory'){
        const target = this._resolveTarget(destination);
        if(target === this.hotbar) return this._appendEntry(this.hotbar, n, slot ?? 0, overflow, 'hotbar');
        if(target === this.skills) return this._appendEntry(this.skills, n, slot ?? 0, overflow, 'skills');

        if(slot != null && typeof slot != 'number'){
            new Message(`Inventory|Append: failed to append item due to invalid slot number!`);
            return false;
        }
        const max = target.slots;
        if(max < 1) return false;
        const mode = this._overflowMode(overflow);

        /* shift-insert at slot 1 */
        if(this.appendMode === 'shift' && (slot == null || slot === 0)){
            const overflowItem = target[max];
            for(let i = max; i > 1; i--) target[i] = target[i - 1];
            target[1] = n;
            if(overflowItem != null){
                switch(mode){
                    case 'push': this.push.push(overflowItem); break;
                    case 'pop':
                        this._emit('add', { destination, slot: 1, item: n, shifted: true, displaced: overflowItem });
                        return overflowItem;
                    case 'trash':
                    default: this.trashed.push({ slot: max, item: overflowItem });
                }
            }
            this._emit('add', { destination, slot: 1, item: n, shifted: true, displaced: overflowItem });
            return true;
        }

        if(slot == null || slot === 0){
            slot = this._firstFreeSlot(target);
            if(slot === 0){
                new Message(`Inventory|Append: ${destination} is full and no slot was given.`);
                return false;
            }
        }
        if(!this._validateSlot(target, slot)){
            new Message(`Inventory|Append: slot ${slot} is out of range (1-${max}).`);
            return false;
        }
        if(target[slot] == null){
            target[slot] = n;
            this._emit('add', { destination, slot, item: n });
            return true;
        }
        switch(mode){
            case 'push':
                this.push.push(target[slot]);
                target[slot] = n;
                this._emit('add', { destination, slot, item: n, displaced: target[slot] });
                return true;
            case 'pop': {
                const popped = target[slot];
                target[slot] = n;
                this._emit('add', { destination, slot, item: n, displaced: popped });
                return popped;
            }
            case 'trash':
            default:
                this.trashed.push({ slot, item: target[slot] });
                this._emit('add', { destination, slot, item: n, displaced: target[slot] });
                target[slot] = n;
                return true;
        }
    }

    /* ================================================================== *
     * Generic entry-container internals
     * ================================================================== */

    _disposeEntry(entry, slot, mode){
        switch(mode){
            case 'push': this.push.push(entry); return true;
            case 'pop':  return entry;
            case 'trash':
            default:     this.trashed.push({ slot, item: entry }); return true;
        }
    }

    /* Shared body for appendHotbar / appendSkill.
     * source: inventory slot number | inventory value | {inventorySlot, item}
     * slot:   0/null => shift (if appendMode === 'shift') or first free
     * overflow: 'trash' | 'push' | 'pop'
     */
    _appendEntry(target, source, slot, overflow, destName){
        if(source == null){
            new Message(`Inventory|${destName}: no item supplied.`);
            return false;
        }

        let inventorySlot, suppliedItem;
        if(typeof source === 'number'){
            inventorySlot = source;
        }else if(typeof source === 'object' && !Array.isArray(source) &&
                 'inventorySlot' in source && 'item' in source){
            inventorySlot = source.inventorySlot;
            suppliedItem  = source.item;
        }else{
            for(let i = 1; i <= this.slots; i++){
                if(this[i] === source){ inventorySlot = i; break; }
            }
            if(inventorySlot === undefined){
                new Message(`Inventory|${destName}: value not found in inventory.`);
                return false;
            }
        }

        if(!this._validateSlot(this, inventorySlot)){
            new Message(`Inventory|${destName}: inventory slot ${inventorySlot} is out of range (1-${this.slots}).`);
            return false;
        }
        const liveItem = this[inventorySlot];
        if(liveItem == null){
            new Message(`Inventory|${destName}: inventory slot ${inventorySlot} is empty.`);
            return false;
        }
        if(suppliedItem !== undefined && suppliedItem !== liveItem){
            new Message(`Inventory|${destName}: item does not match inventory slot ${inventorySlot}.`);
            return false;
        }

        const entry = { inventorySlot, item: liveItem };
        const max   = target.slots;
        const mode  = this._overflowMode(overflow);
        if(max < 1) return false;

        /* shift-insert at slot 1 */
        if((slot == null || slot === 0) && this.appendMode === 'shift'){
            const overflowEntry = target[max];
            for(let i = max; i > 1; i--) target[i] = target[i - 1];
            target[1] = entry;
            if(overflowEntry != null){
                const result = this._disposeEntry(overflowEntry, max, mode);
                this._emit('add', { destination: destName, slot: 1, item: entry, shifted: true, displaced: overflowEntry });
                return result;
            }
            this._emit('add', { destination: destName, slot: 1, item: entry, shifted: true });
            return true;
        }

        /* auto slot */
        if(slot == null || slot === 0){
            slot = this._firstFreeSlot(target);
            if(slot === 0){
                new Message(`Inventory|${destName}: ${destName} is full.`);
                return false;
            }
        }
        if(!this._validateSlot(target, slot)){
            new Message(`Inventory|${destName}: slot ${slot} is out of range (1-${max}).`);
            return false;
        }
        if(target[slot] == null){
            target[slot] = entry;
            this._emit('add', { destination: destName, slot, item: entry });
            return true;
        }
        const displaced = target[slot];
        target[slot] = entry;
        const result = this._disposeEntry(displaced, slot, mode);
        this._emit('add', { destination: destName, slot, item: entry, displaced });
        return result;
    }

    _removeEntry(target, slot, destName){
        if(!this._validateSlot(target, slot)) return null;
        const e = target[slot];
        if(e == null) return null;
        target[slot] = null;
        this._emit('remove', { destination: destName, slot, item: e });
        return e;
    }

    _getEntryItem(target, slot){
        const e = target[slot];
        if(e == null || typeof e !== 'object') return null;
        if(!Number.isInteger(e.inventorySlot)) return null;
        return this[e.inventorySlot] ?? null;
    }

    _isEntryValid(target, slot){
        const e = target[slot];
        if(e == null || typeof e !== 'object') return false;
        if(!Number.isInteger(e.inventorySlot)) return false;
        return this[e.inventorySlot] != null && this[e.inventorySlot] === e.item;
    }

    _syncEntries(target, destName, { follow = true } = {}){
        const dropped = [];
        for(let i = 1; i <= target.slots; i++){
            const e = target[i];
            if(e == null) continue;

            if(this[e.inventorySlot] === e.item) continue;

            if(follow){
                let found = 0;
                for(let j = 1; j <= this.slots; j++){
                    if(this[j] === e.item){ found = j; break; }
                }
                if(found){ e.inventorySlot = found; continue; }
            }

            dropped.push({ container: destName, slot: i, entry: e });
            target[i] = null;
        }
        if(dropped.length) this._emit('change', { event: 'sync', container: destName, dropped });
        return dropped;
    }

    /* ================================================================== *
     * Hotbar
     * ================================================================== */

    appendHotbar(source, hotbarSlot = 0, overflow = 'trash'){
        return this._appendEntry(this.hotbar, source, hotbarSlot, overflow, 'hotbar');
    }
    removeHotbar(hotbarSlot){ return this._removeEntry(this.hotbar, hotbarSlot, 'hotbar'); }
    getHotbarItem(hotbarSlot){ return this._getEntryItem(this.hotbar, hotbarSlot); }
    isHotbarEntryValid(hotbarSlot){ return this._isEntryValid(this.hotbar, hotbarSlot); }
    syncHotbar(opts = {}){ return this._syncEntries(this.hotbar, 'hotbar', opts); }

    /* ================================================================== *
     * Skills
     * ================================================================== */

    appendSkill(source, skillSlot = 0, overflow = 'trash'){
        return this._appendEntry(this.skills, source, skillSlot, overflow, 'skills');
    }
    removeSkill(skillSlot){ return this._removeEntry(this.skills, skillSlot, 'skills'); }
    getSkillItem(skillSlot){ return this._getEntryItem(this.skills, skillSlot); }
    isSkillEntryValid(skillSlot){ return this._isEntryValid(this.skills, skillSlot); }
    syncSkills(opts = {}){ return this._syncEntries(this.skills, 'skills', opts); }

    /* Sync both entry containers at once. */
    syncEntries(opts = {}){
        return [
            ...this._syncEntries(this.hotbar, 'hotbar', opts),
            ...this._syncEntries(this.skills, 'skills', opts)
        ];
    }

    /* ================================================================== *
     * Validation
     * ================================================================== */

    validate(){
        const errors = [];
        if(!Number.isInteger(this.slots) || this.slots < 1)             errors.push('slots must be a positive integer');
        if(!Number.isInteger(this.hotbar.slots) || this.hotbar.slots < 0) errors.push('hotbar.slots must be >= 0');
        if(!Number.isInteger(this.skills.slots) || this.skills.slots < 0) errors.push('skills.slots must be >= 0');

        const checkEntries = (target, name) => {
            for(let i = 1; i <= target.slots; i++){
                const e = target[i];
                if(e == null) continue;
                if(typeof e !== 'object' || !('inventorySlot' in e) || !('item' in e)){
                    errors.push(`${name}[${i}] is not a valid entry`);
                    continue;
                }
                if(!this._validateSlot(this, e.inventorySlot)){
                    errors.push(`${name}[${i}].inventorySlot ${e.inventorySlot} is out of range`);
                    continue;
                }
                if(this[e.inventorySlot] !== e.item){
                    errors.push(`${name}[${i}] item does not match inventory slot ${e.inventorySlot}`);
                }
            }
        };
        checkEntries(this.hotbar, 'hotbar');
        checkEntries(this.skills, 'skills');
        return errors;
    }

    /* ================================================================== *
     * Iteration
     * ================================================================== */

    *[Symbol.iterator](){
        for(let i = 1; i <= this.slots; i++) yield [i, this[i]];
    }
    forEach(callback, destination = 'inventory'){
        const t = this._resolveTarget(destination);
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) callback(t[i], i, t);
    }
    entries(destination = 'inventory'){
        const t = this._resolveTarget(destination);
        const out = [];
        for(let i = 1; i <= t.slots; i++) if(t[i] != null) out.push([i, t[i]]);
        return out;
    }
    values(destination = 'inventory'){
        return this.entries(destination).map(([, v]) => v);
    }

    /* ================================================================== *
     * Serialisation
     * ================================================================== */

    toJSON(){
        const packEntries = (target) => Array.from({ length: target.slots }, (_, i) => {
            const e = target[i + 1];
            // store only inventorySlot; item is re-derived on load so it stays shared
            return e == null ? null : { inventorySlot: e.inventorySlot };
        });

        return {
            slots: this.slots,
            inventory: Array.from({ length: this.slots }, (_, i) => this[i + 1] ?? null),
            hotbar: { slots: this.hotbar.slots, entries: packEntries(this.hotbar) },
            skills: { slots: this.skills.slots, entries: packEntries(this.skills) },
            appendMode: this.appendMode
        };
    }

    static fromJSON(data){
        const inv = new Inventory(data.slots, data.hotbar.slots, data.skills.slots);
        inv.appendMode = data.appendMode ?? 'shift';

        for(let i = 0; i < data.inventory.length; i++){
            inv[i + 1] = data.inventory[i] ?? null;
        }

        const unpackEntries = (target, entries) => {
            for(let i = 0; i < entries.length; i++){
                const e = entries[i];
                if(e == null){ target[i + 1] = null; continue; }
                if(Number.isInteger(e.inventorySlot) && inv[e.inventorySlot] != null){
                    target[i + 1] = { inventorySlot: e.inventorySlot, item: inv[e.inventorySlot] };
                }else{
                    target[i + 1] = null;
                }
            }
        };
        unpackEntries(inv.hotbar, data.hotbar.entries);
        unpackEntries(inv.skills, data.skills.entries);
        return inv;
    }

    clone(){
        const c = new Inventory(this.slots, this.hotbar.slots, this.skills.slots);
        c.appendMode = this.appendMode;

        for(let i = 1; i <= this.slots; i++) c[i] = this[i];

        const cloneEntries = (src, dst) => {
            for(let i = 1; i <= src.slots; i++){
                const e = src[i];
                dst[i] = e == null ? null : { inventorySlot: e.inventorySlot, item: c[e.inventorySlot] };
            }
        };
        cloneEntries(this.hotbar, c.hotbar);
        cloneEntries(this.skills, c.skills);
        return c;
    }
}


/* =====================================================================
 * Item — component-based item system.
 *
 * An item is a plain object plus a bag of COMPONENTS. A component is a small
 * named piece of data ("durability", "attack", "placeable"...) that may also
 * carry HOOKS: functions the item calls at certain moments (can I use this?
 * use it, place it, tick). Adding or removing components is how an item's
 * behaviour is built; subclasses are only presets of components.
 *
 *   Item.components        STATIC registry of component definitions
 *   item.components        PER-INSTANCE data, one entry per component
 *   item._recipe           the arguments each component was created with
 *                          (kept so clone() can rebuild function arguments)
 *
 * A component definition is either a plain function
 *     (self, ...args) => data | undefined
 * or an object:
 *     {
 *       create(self, ...args) -> data       builds the per-item data
 *       attach(self, data)                  after it is added
 *       detach(self, data)                  before it is removed
 *       hooks: {
 *         canUse(item, data, user, target, ctx) -> false | 'reason' | undefined
 *         use(item, data, user, target, ctx)    -> any value (shown in result.hooks)
 *         place(item, data, obj, ctx)           after a placeable spawned `obj`
 *         tick(item, data, dt)                  from item.tick(dt)
 *       }
 *     }
 *   Add your own with Item.register('name', definition).
 *
 * SUBCLASSES. Three ways to make your own item type:
 *
 *   1. By hand with `class` (it registers itself the first time it is built):
 *
 *        class Ring extends Item {
 *            static TYPE = 'ring';                    // registry key / item.type
 *            static DEFAULTS = {                      // applied by the constructor
 *                components: { stackable: [false], rarity: ['rare'], glint: [true] },
 *                tags: ['ring'],
 *                meta: { category: 'jewelry' },
 *            };
 *            // optional override points (all of them can be left out):
 *            allowUse(user, target, ctx)  { return true; }   // false cancels use()
 *            handleUse(user, target, ctx) { return 'ring used'; }
 *            handlePlace(obj, ctx)        {}
 *            handleBreak()                {}
 *            handleTick(dt)               {}
 *        }
 *        Item.registerClass(Ring);   // optional here, but needed before the first
 *                                    // Item.create({type:'ring'}) / fromJSON
 *
 *   2. In one call with no class syntax:
 *
 *        Item.defineType('ring', {
 *            extends: 'tool',                         // a TYPE or a class (default: Item)
 *            defaults: { components: {...}, tags: [...], meta: {...} },
 *            methods:  { shine() { return 1; } },     // added to the prototype
 *        });
 *
 *   3. No subclass at all, just a one-off preset:
 *
 *        Item.define({ id: 'iron_sword', type: 'sword', name: 'Iron Sword',
 *                      components: { durability: [500] } });
 *        const s = Item.spawn('iron_sword');
 *
 *   Subclass constructors must accept (id, name, overrides) as their first
 *   arguments (pass them on with super(...)); create / clone / fromJSON rely on it.
 *   In DEFAULTS a component set to `null` removes one a parent class added.
 *
 * CREATING WITH VALUES (every item class, built in or your own):
 *
 *   Every class has a list of main values (its PARAMS) that the constructor takes in order, after
 *   the name, the way the old Gun class did:
 *
 *     //        name           damage speed reach knockback durability
 *     new Sword('iron_sword',  8,     4,    3.5,  0,        500);
 *     //        name   dmg range vel rate type burst burstTime reload mag ammo bulletSize
 *     new Gun('m4',    15, 600,  150, 16, 2,   1,    1,        3.5,   30,  120, { x: 12, y: 7 });
 *     new Block('glass', 20, 20, 'cyan', false);        // width height color solid ...
 *     new Food('pie', 8, 2);                            // hunger saturation ...
 *
 *   `undefined` keeps a value's default, and trailing values can be left out. After the values
 *   comes an optional object for everything else:
 *
 *     new Sword('iron_sword', 8, 4, 3.5, 0, 500, { displayName: 'Iron Sword', tags: ['metal'] });
 *     new Sword('iron_sword', 8, undefined, undefined, undefined, undefined, { components: { ... } });
 *
 *   `name` is also the id (null = a generated id; `{ id: ... }` in the object sets it separately).
 *   Item.paramNames('sword') lists a class's values in order; the same names work as keys in
 *   the object and in Item.create({ type: 'sword', damage: 8 }). Your own class declares them:
 *
 *     class Ring extends Item {
 *         static TYPE   = 'ring';
 *         static PARAMS = ['power', 'durability'];            // new Ring('luck', 5, 100)
 *         static STATS  = { power: ['skill', 'power'] };      // see below
 *     }
 *
 *   Besides `components`, `tags`, `meta` and `displayName` (which work on every
 *   item), the overrides take STATS: short names that each class maps onto the
 *   fields of its components. A class lists them in `static STATS`:
 *
 *     static STATS = {
 *         damage:     ['attack', 'damage'],      // [component, field]  -> attack.damage
 *         durability: ['durability', 0],         // [component, n]       -> durability's 1st argument
 *         solid:      ['placeable', 'collision.solid'],   // dotted = a field inside a field
 *     };
 *
 *   STATS are inherited (a subclass adds to, or replaces, its parent's; `name: null`
 *   hides an inherited one). A stat wins over the same value in `components` and
 *   over the class DEFAULTS. A stat for a component the item doesn't have adds it.
 *   An unknown name is reported with console.warn. List what a class accepts with
 *   Item.statNames('sword').
 * ===================================================================== */
class Item {

    /* ==================================================================
     * Component registry
     * ================================================================== */
    static components = {

        /* ---------------- durability ----------------
         * create(self, max = 1, value = max, perUse = 1)
         * Every use() wears the item by `perUse` (or ctx.wear; ctx.noWear skips it).
         * A broken item (value 0) can't be used until repaired.
         */
        durability: {
            create(self, max = 1, value = null, perUse = 1) {
                max = Math.max(1, Number(max) || 1);
                const data = {
                    max,
                    value: value == null ? max : limit(Number(value), 0, max),
                    perUse: Math.max(0, Number(perUse) || 0),
                    wear(v = data.perUse) {
                        v = Number(v);
                        if (!Number.isFinite(v)) return data.value;
                        const before = data.value;
                        data.value = limit(before - Math.max(0, v), 0, data.max);
                        if (before > 0 && data.value <= 0) data._break();
                        return data.value;
                    },
                    repair(v) {
                        data.value = limit(data.value + Math.max(0, Number(v) || 0), 0, data.max);
                        if (data.value > 0) self.isBroken = false;
                        return data.value;
                    },
                    set(v) {
                        const before = data.value;
                        data.value = limit(Number(v) || 0, 0, data.max);
                        if (data.value > 0) self.isBroken = false;
                        else if (before > 0) data._break();
                        return data.value;
                    },
                    percent() { return data.max > 0 ? data.value / data.max : 0; },
                    _break() {
                        self.isBroken = true;
                        self._emit('break', { item: self });
                        self.handleBreak();
                    }
                };
                data.exe = data.wear;       // old name
                return data;
            },
            attach(self, data) { self.isBroken = data.value <= 0; },
            detach(self)       { self.isBroken = false; },
            hooks: {
                canUse(item)  { return item.isBroken ? 'broken' : undefined; },
                use(item, data, user, target, ctx) {
                    if (ctx.noWear) return undefined;
                    data.wear(ctx.wear ?? data.perUse);
                    return { value: data.value, max: data.max };
                }
            }
        },

        /* ---------------- onUse ----------------
         * create(self, trigger, ...handlers)
         * trigger:  function(item, user, target, ctx)  -> run on use
         *           string                              -> fires a 'trigger' event with that name
         * handlers: extra functions with the same arguments.
         */
        onUse: {
            create(self, trigger, ...handlers) {
                if (typeof trigger !== 'function' && typeof trigger !== 'string') trigger = 'default@use';
                return { trigger, handlers: handlers.filter(h => typeof h === 'function') };
            }
        },

        /* ---------------- stack / size ---------------- */
        stackable: { create(self, can = true)  { return { can: !!can }; } },
        maxStack:  { create(self, size = 64)   { return { size: Math.max(1, Math.floor(Number(size) || 1)) }; } },

        /* ---------------- cooldown ----------------
         * Blocks use() for `ticks` game ticks after each use. Counts down in item.tick().
         */
        cooldown: {
            create(self, ticks = 30) {
                const data = {
                    ticks: Math.max(0, Math.floor(Number(ticks) || 0)),
                    remaining: 0,
                    ready()   { return data.remaining <= 0; },
                    trigger() { data.remaining = data.ticks; },
                };
                return data;
            },
            hooks: {
                canUse(item, data) { return data.remaining > 0 ? 'cooldown' : undefined; },
                use(item, data)    { data.trigger(); return { remaining: data.remaining }; },
                tick(item, data)   { if (data.remaining > 0) data.remaining--; }
            }
        },

        /* ---------------- food / potions / scrolls ---------------- */
        consume: {
            create(self, opts = {}) {
                const data = {
                    hunger:     Math.max(0, Number(opts.hunger)     || 0),
                    saturation: Math.max(0, Number(opts.saturation) || 0),
                    health:     Number(opts.health) || 0,
                    effects:    Array.isArray(opts.effects) ? [...opts.effects] : [],
                    duration:   Math.max(0, Number(opts.duration)   || 0),
                    animation:  opts.animation || 'eat',
                    consumesItem: opts.consumesItem !== false,   // caller should remove one from the stack
                    apply(user = null, target = null, ctx = {}) {
                        const out = {
                            action: data.animation, hunger: data.hunger, saturation: data.saturation,
                            health: data.health, effects: data.effects.slice(), duration: data.duration,
                            animation: data.animation, consumesItem: data.consumesItem,
                        };
                        self._emit('consumed', { item: self, user, target, ctx, result: out });
                        return out;
                    }
                };
                return data;
            },
            hooks: {
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'consume') return undefined;
                    return data.apply(user, target, ctx);
                }
            }
        },

        /* ---------------- melee ---------------- */
        attack: {
            create(self, opts = {}) {
                return {
                    damage:    Number(opts.damage)    || 1,
                    speed:     Number(opts.speed)     || 4,
                    reach:     Number(opts.reach)     || 3,
                    knockback: Number(opts.knockback) || 0,
                    sweep:     !!opts.sweep,            // hits everything in reach, not just one target
                };
            },
            hooks: {
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'attack') return undefined;
                    return { action: 'attack', damage: data.damage, reach: data.reach,
                             speed: data.speed, knockback: data.knockback, sweep: data.sweep };
                }
            }
        },

        /* ---------------- mining / tool use ---------------- */
        tool: {
            create(self, opts = {}) {
                return {
                    tier:      Number(opts.tier)  || 0,
                    speed:     Number(opts.speed) || 1,
                    classes:   Array.isArray(opts.classes)   ? [...opts.classes]   : ['pickaxe'],
                    effective: Array.isArray(opts.effective) ? [...opts.effective] : [],
                    cost:      Number(opts.cost)  || 1,
                };
            },
            hooks: {
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'mine') return undefined;
                    const block = ctx.block ?? null;
                    const effective = block == null || data.effective.length === 0 || data.effective.includes(block);
                    return { action: 'mine', block, effective, tier: data.tier,
                             speed: effective ? data.speed : 1 };
                }
            }
        },

        /* ---------------- ranged ----------------
         * ammoType: item type the caller should take from the inventory (null = none needed).
         * magazine: 0 = no magazine; > 0 = internal ammo that reload() refills.
         */
        ranged: {
            create(self, opts = {}) {
                const magazine = Math.max(0, Math.floor(Number(opts.magazine) || 0));
                const data = {
                    ammoType:   opts.ammoType ?? null,
                    projectile: opts.projectile ?? 'bullet',
                    speed:      Number(opts.speed)  || 20,
                    damage:     Number(opts.damage) || 1,
                    spread:     Number(opts.spread) || 0,     // degrees
                    range:      Number(opts.range)  || 600,
                    count:      Math.max(1, Math.floor(Number(opts.count) || 1)),   // projectiles per shot
                    magazine,
                    ammo:       opts.ammo != null ? limit(Math.floor(Number(opts.ammo) || 0), 0, magazine || Infinity) : magazine,
                    reloadTicks: Math.max(0, Math.floor(Number(opts.reloadTicks) || 0)),
                    reload(n = Infinity) {
                        if (!data.magazine) return 0;
                        const add = Math.min(data.magazine - data.ammo, n);
                        data.ammo += add;
                        return add;
                    },
                    empty() { return data.magazine > 0 && data.ammo <= 0; },
                };
                return data;
            },
            hooks: {
                canUse(item, data) { return data.empty() ? 'empty' : undefined; },
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'fire') return undefined;
                    if (data.magazine > 0) data.ammo--;
                    return { action: 'fire', projectile: data.projectile, speed: data.speed,
                             damage: data.damage, spread: data.spread, range: data.range,
                             count: data.count, ammoType: data.ammoType, ammo: data.ammo };
                }
            }
        },

        /* ---------------- firearm ----------------
         * The full stat block of a gun (used by the Gun class). Everything that
         * changes while playing (_mag, ammo, fireType) lives here so it is saved
         * and cloned with the item.
         *
         *   damage      per bullet (falls off past `range`)
         *   range       px before damage starts to fall off
         *   velocity    bullet speed
         *   firerate    shots per second (semi / full auto)
         *   fireType    1 = semi auto, 2 = full auto, 3 = burst
         *   burst       bullets per burst         burstTime  seconds between bullets in a burst
         *   reloadTime  seconds                   mag        rounds per magazine
         *   ammo        reserve rounds (outside the magazine)
         *   size        { width, height } of the bullet (or pass `a: { x, y }`)
         *   ammoType    label only ('5.56', '9mm'...)
         *
         * Timing (reload, fire rate, burst, fire-mode switch) runs on the scene clock,
         * so it stops while the gun's scene is paused. See Gun._now().
         */
        firearm: {
            create(self, opts = {}) {
                const num  = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
                const size = opts.size ?? (opts.a ? { width: opts.a.x, height: opts.a.y } : { width: 12, height: 7 });
                const base = {
                    damage:     num(opts.damage, 10),
                    range:      Math.max(1, num(opts.range, 600)),
                    velocity:   num(opts.velocity, 150),
                    firerate:   Math.max(0.01, num(opts.firerate, 5)),
                    fireType:   [1, 2, 3].includes(Number(opts.fireType)) ? Number(opts.fireType) : 1,
                    burst:      Math.max(1, Math.floor(num(opts.burst, 1))),
                    burstTime:  Math.max(0, num(opts.burstTime, 0.1)),
                    reloadTime: Math.max(0, num(opts.reloadTime, 2)),
                    mag:        Math.max(1, Math.floor(num(opts.mag, 30))),
                    ammo:       0,
                };
                base.ammo = Math.max(0, num(opts.ammo, base.mag * 4));
                return {
                    ...base,
                    original: { ...base },
                    _mag: Math.min(base.mag, num(opts._mag, base.mag)),
                    size: { width: num(size.width, 12), height: num(size.height, 7) },
                    ammoType: opts.ammoType ?? null,
                    attachments: { muzzle: null, barrel: null, mag: null, underBarrel: null },
                };
            },
            hooks: {
                canUse(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'fire') return undefined;
                    if (typeof item.fireBlockedReason !== 'function') return undefined;
                    return item.fireBlockedReason() ?? undefined;       // 'reloading' | 'empty' | 'cooldown' | 'trigger'
                },
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'fire') return undefined;
                    if (typeof item.shoot !== 'function') return undefined;
                    const fired = item.shoot(user ?? item.owner, ctx);
                    return { action: 'fire', fired, mag: data._mag, ammo: data.ammo };
                },
                tick(item) { if (typeof item._pump === 'function') item._pump(); }
            }
        },

        /* ---------------- ammo (the thing a ranged weapon fires) ---------------- */
        ammo: {
            create(self, opts = {}) {
                return { type: opts.type ?? 'bullet', damage: Number(opts.damage) || 0, pierce: Math.max(0, Math.floor(Number(opts.pierce) || 0)) };
            }
        },

        /* ---------------- thrown ---------------- */
        throwable: {
            create(self, opts = {}) {
                return { damage: Number(opts.damage) || 1, radius: Number(opts.radius) || 0,
                         speed: Number(opts.speed) || 12, fuse: Math.max(0, Math.floor(Number(opts.fuse) || 0)),
                         consumesItem: opts.consumesItem !== false };
            },
            hooks: {
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'throw') return undefined;
                    return { action: 'throw', damage: data.damage, radius: data.radius, speed: data.speed,
                             fuse: data.fuse, consumesItem: data.consumesItem };
                }
            }
        },

        /* ---------------- skills / spells ----------------
         * create(self, { passive, fn, useCondition, cost, costType, power, element, range, castTicks })
         *
         *   passive       true  = fires by itself every time it can, while the skill is ACTIVE
         *                         (see Skill.activate / Skill.tickSkills)
         *   fn            function(item, target, deltaTime) run each time the skill is used.
         *                 `item` is the skill item, `target` is the object using it and
         *                 `deltaTime` is the length of the current game tick in seconds
         *                 (from item.tick(dt); for a manual cast, ctx.deltaTime or one tick).
         *   useCondition  function(item, target) -> true / false. The skill can only be used
         *                 (by hand or automatically) while it returns true.
         */
        skill: {
            create(self, opts = {}) {
                const data = {
                    passive:      !!opts.passive,
                    fn:           typeof opts.fn === 'function' ? opts.fn : null,
                    useCondition: typeof opts.useCondition === 'function' ? opts.useCondition : null,
                    cost:      Number(opts.cost) || 0,
                    costType:  opts.costType || 'mana',
                    power:     Number(opts.power) || 1,
                    element:   opts.element || null,
                    range:     Number(opts.range) || 0,
                    castTicks: Math.max(0, Math.floor(Number(opts.castTicks) || 0)),
                    active:    false,
                    /** Turn the skill on for `user` (the object that owns / uses it). */
                    activate(user = null) {
                        data.active = true;
                        if (user) self._skillUser = user;
                        return self;
                    },
                    deactivate() {
                        data.active = false;
                        self._skillUser = null;
                        return self;
                    },
                    /** true when there is no useCondition, or it returns true for `user`. */
                    check(user = null) {
                        if (!data.useCondition) return true;
                        try { return !!data.useCondition(self, user); }
                        catch (e) { console.error(`Skill '${self.id}' useCondition failed:`, e); return false; }
                    },
                };
                return data;
            },
            detach(self) { self._skillUser = null; },
            hooks: {
                canUse(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'cast') return undefined;
                    return data.check(user ?? target) ? undefined : 'condition';
                },
                use(item, data, user, target, ctx) {
                    if (ctx.action && ctx.action !== 'cast') return undefined;
                    const out = { action: 'cast', passive: data.passive, cost: data.cost, costType: data.costType,
                                  power: data.power, element: data.element, range: data.range,
                                  castTicks: data.castTicks };
                    if (data.fn) out.result = data.fn(item, user ?? target, ctx.deltaTime ?? Item._defaultDelta());
                    return out;
                },
                // A passive skill that is active uses itself whenever it is allowed to.
                tick(item, data, dt) {
                    if (!data.passive || !data.active) return;
                    const user = item._skillUser;
                    if (!user) return;
                    const ctx = { action: 'cast', passive: true, deltaTime: dt };
                    if (item.checkUse(user, null, ctx) !== null) return;   // condition / cooldown / broken: wait
                    item.use(user, null, ctx);
                }
            }
        },

        /* ---------------- wearable ----------------
         * equippable: which slot the item goes in ('head','chest','legs','feet',
         *             'mainhand','offhand','accessory', or your own).
         * armor:      the protection it gives while worn.
         */
        equippable: {
            create(self, opts = {}) {
                if (typeof opts === 'string') opts = { slot: opts };
                return { slot: opts.slot || 'mainhand' };
            },
            hooks: {
                use(item, data, user, target, ctx) {
                    if (ctx.action !== 'equip') return undefined;
                    return { action: 'equip', slot: data.slot };
                }
            }
        },
        armor: {
            create(self, opts = {}) {
                return { defense: Number(opts.defense) || 0, toughness: Number(opts.toughness) || 0,
                         resist: { ...(opts.resist || {}) } };
            }
        },

        /* ---------------- enchant ---------------- */
        enchantable: {
            create(self, opts = {}) {
                return { allowed: Array.isArray(opts.allowed) ? [...opts.allowed] : [],
                         maxLevel: Number(opts.maxLevel) || 3, enchantments: {} };
            }
        },
        glint: { create(self, enabled = true) { return { enabled: !!enabled }; } },

        /* ---------------- lore / rarity / value ---------------- */
        lore: {
            create(self, lines = []) { return { lines: Array.isArray(lines) ? [...lines] : [String(lines)] }; }
        },
        rarity: {
            create(self, level = 'common') {
                const valid = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
                return { level: valid.includes(level) ? level : 'common' };
            }
        },
        value: {
            create(self, opts = {}) {
                if (typeof opts === 'number') opts = { amount: opts };
                return { amount: Number(opts.amount) || 0, currency: opts.currency || 'coin' };
            }
        },

        /* ---------------- misc ---------------- */
        fuel:  { create(self, ticks = 0) { return { ticks: Math.max(0, Math.floor(Number(ticks) || 0)) }; } },
        key:   { create(self, lock = 'any') { return { lock: String(lock) }; } },
        light: {
            create(self, opts = {}) {
                return { radius: Number(opts.radius) || 100, color: opts.color || '#ffd27a',
                         intensity: limit(Number(opts.intensity ?? 1), 0, 1) };
            }
        },
        plantable: {
            create(self, opts = {}) {
                return { crop: opts.crop ?? null, growTicks: Math.max(1, Math.floor(Number(opts.growTicks) || 600)),
                         soil: Array.isArray(opts.soil) ? [...opts.soil] : ['dirt'] };
            }
        },

        /* ---------------- container ----------------
         * When the item is placed, the new object gets obj.meta.inventory (an Inventory).
         */
        container: {
            create(self, opts = {}) {
                if (typeof opts === 'number') opts = { slots: opts };
                return { slots: Math.max(1, Math.floor(Number(opts.slots) || 12)), locked: !!opts.locked };
            },
            hooks: {
                place(item, data, obj) {
                    obj.meta = obj.meta || {};
                    obj.meta.inventory = new Inventory(data.slots, 0, 0);
                    obj.meta.locked = data.locked;
                }
            }
        },

        /* ---------------- placeable ----------------
         * Turns the item into a gameObject (from objects.js) when placed.
         *
         *   placeable: [{
         *      // ---- which scenes the object is added to ----
         *      scenes:  ['play'],          // [] / omitted = the scene that is active when placed
         *      // ---- position (gameObject x / y are the CENTRE of the object) ----
         *      x: null, y: null,           // fixed spawn point; null = use place(x, y)
         *      offsetX: 0, offsetY: 0,     // added to the spawn point
         *      anchor: 'center',           // which point of the object sits at the spawn point:
         *                                  //   'center' | 'top' | 'bottom' | 'left' | 'right' |
         *                                  //   'topleft' | 'topright' | 'bottomleft' | 'bottomright'
         *      snap: 0,                    // > 0 snaps the spawn point to that grid size (px)
         *      // ---- scale ----
         *      width: 40, height: 40,
         *      // ---- collision (gameObject.collision) ----
         *      collision: { enabled: true, solid: true, static: true, resolve: true,
         *                   pushable: false, excluded: [] },
         *      // ---- physics (gameObject.physicsToggles) ----
         *      physics:   { enabled: true, gravity: false, friction: false },
         *      // ---- looks (gameObject.rendering) ----
         *      color: 'white', outline: undefined /* [width, color] | number | false *\/,
         *      shape: 'rect', texture: null, visible: true, layer: null, ignoreCamera: false,
         *      // ---- extras ----
         *      mass: null, bounciness: null,
         *      tags: [], meta: {},
         *      onPlace: (obj, item, ctx) => {},
         *      factory: null,              // escape hatch: (item, x, y, ctx, cfg) => gameObject
         *                                  // (or a name from Item.registerPlaceFactory); when set,
         *                                  // the settings above are NOT applied to what it returns
         *      onUsePlace: true,           // use() places the item when ctx.x / ctx.y are given
         *   }]
         *
         * Everything is stored on item.getComponent('placeable') and can be edited later.
         * place() / use() accept ctx.scenes and ctx.placeable (same shape, merged over this).
         */
        placeable: {
            create(self, opts = {}) {
                const c = opts.collision ?? {};
                const f = opts.physics ?? {};
                const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
                return {
                    scenes:  Item._normScenes(opts.scenes),
                    x: opts.x == null ? null : num(opts.x, 0),
                    y: opts.y == null ? null : num(opts.y, 0),
                    offsetX: num(opts.offsetX, 0),
                    offsetY: num(opts.offsetY, 0),
                    anchor:  opts.anchor || 'center',
                    snap:    Math.max(0, num(opts.snap, 0)),
                    width:   Math.max(1, num(opts.width,  40)),
                    height:  Math.max(1, num(opts.height, 40)),
                    collision: {
                        enabled:  c.enabled  !== false,
                        solid:    c.solid    !== false,
                        static:   c.static   !== false,
                        resolve:  c.resolve  !== false,
                        pushable: !!c.pushable,
                        excluded: Array.isArray(c.excluded) ? [...c.excluded] : [],
                    },
                    physics: {
                        enabled:  f.enabled !== false,
                        gravity:  !!f.gravity,
                        friction: !!f.friction,
                    },
                    color:   opts.color ?? 'white',
                    outline: opts.outline,
                    shape:   opts.shape ?? 'rect',
                    texture: opts.texture ?? null,
                    visible: opts.visible !== false,
                    layer:   opts.layer ?? null,
                    ignoreCamera: !!opts.ignoreCamera,
                    mass:       opts.mass ?? null,
                    bounciness: opts.bounciness ?? null,
                    tags: Array.isArray(opts.tags) ? [...opts.tags] : [],
                    meta: { ...(opts.meta || {}) },
                    onPlace: typeof opts.onPlace === 'function' ? opts.onPlace : null,
                    factory: opts.factory ?? null,
                    onUsePlace: opts.onUsePlace !== false,
                };
            }
        },
    };

    /* ==================================================================
     * Static registries / helpers
     * ================================================================== */

    /* ---- stats every item accepts ---- */
    static STATS = {
        durability:      ['durability', 0],      // max durability
        durabilityValue: ['durability', 1],      // starting durability (default: full)
        wearPerUse:      ['durability', 2],
        stackable:       ['stackable', 0],
        maxStack:        ['maxStack', 0],
        cooldown:        ['cooldown', 0],        // ticks
        rarity:          ['rarity', 0],
        glint:           ['glint', 0],
        lore:            ['lore', 0],
        fuel:            ['fuel', 0],
        value:           ['value', 'amount'],
        currency:        ['value', 'currency'],
    };
    static PARAMS = [];      // base Item: new Item(name, extra)
    static _RESERVED = new Set(['id', 'type', 'name', 'components', 'tags', 'meta', 'displayName', 'stats']);

    static _prototypes       = new Map();   // id    -> prototype item
    static _classes          = new Map();   // type  -> Item subclass
    static _placeFactories   = new Map();   // name  -> (item, x, y, ctx, cfg) => gameObject
    static _nextId           = 1;

    /** One game tick in seconds (the engine's tick length, or 1/60 when there is no World). */
    static _defaultDelta() {
        return (typeof World !== 'undefined' && World.tickLength > 0) ? World.tickLength / 1000 : 1 / 60;
    }

    static _generateId(prefix = 'item') {
        return `${prefix}_${(Item._nextId++).toString(36)}_${Date.now().toString(36)}`;
    }
    static _normScenes(s) {
        if (s == null || s === 'active') return [];
        return (Array.isArray(s) ? s : [s]).filter(v => typeof v === 'string' && v && v !== 'active');
    }
    static _copy(v) {
        try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
    }

    static register(name, definition) {
        if (!name || typeof name !== 'string') {
            throw new Error('Item.register: name must be a non-empty string.');
        }
        if (typeof definition === 'function') {
            Item.components[name] = { create: definition };
        } else if (definition && typeof definition.create === 'function') {
            Item.components[name] = definition;
        } else {
            throw new Error(`Item.register: invalid definition for '${name}'.`);
        }
        return Item;
    }
    static unregister(name) {
        delete Item.components[name];
        return Item;
    }
    static hasComponentType(name) {
        return Object.prototype.hasOwnProperty.call(Item.components, name);
    }

    /* ---- place factories: named builders used by placeable.factory ---- */
    static registerPlaceFactory(name, factory) {
        if (typeof factory !== 'function') throw new Error('Item.registerPlaceFactory: factory must be a function.');
        Item._placeFactories.set(name, factory);
        return Item;
    }

    /* ---- prototype system: define once, spawn many ---- */
    static define(def) {
        const proto = Item.create(def);
        Item._prototypes.set(proto.id, proto);
        return proto;
    }
    static getPrototype(id) { return Item._prototypes.get(id) ?? null; }

    static spawn(id, overrides = {}) {
        const proto = Item._prototypes.get(id);
        if (!proto) throw new Error(`Item.spawn: unknown item '${id}'.`);
        const item = proto.clone({ newId: true });
        item._applyOverrides(overrides);
        return item;
    }

    /* ---- subclass registry ---- */
    /** Item.registerClass(MyItem)  (uses MyItem.TYPE)   or   Item.registerClass('name', MyItem) */
    static registerClass(nameOrClass, maybeClass) {
        const cls  = typeof nameOrClass === 'function' ? nameOrClass : maybeClass;
        const name = typeof nameOrClass === 'function' ? nameOrClass.TYPE : nameOrClass;
        if (typeof cls !== 'function' || (cls !== Item && !(cls.prototype instanceof Item))) {
            throw new Error(`Item.registerClass: '${name}' must be an Item subclass.`);
        }
        if (!name || typeof name !== 'string') {
            throw new Error('Item.registerClass: the class needs a static TYPE string (or pass a name).');
        }
        Item._classes.set(name, cls);
        return Item;
    }
    static getClass(name) { return Item._classes.get(name) ?? null; }
    static types()        { return [...Item._classes.keys()]; }

    /**
     * Build and register a subclass without `class` syntax.
     *   Item.defineType('ring', {
     *       extends:  'tool' | SomeClass,           // default Item
     *       defaults: { components, tags, meta, displayName },
     *       methods:  { name(...) { ... } },        // prototype methods (can override handleUse etc.)
     *       params:   ['power', 'durability'],      // positional constructor values: new Ring(name, 5, 100)
     *       stats:    { power: ['skill', 'power'] },// names those values (and `extra`) can use
     *       statics:  { name: value },
     *   });
     * Returns the class, so `new (Item.getClass('ring'))()` and `new Ring()` both work.
     */
    static defineType(type, spec = {}) {
        if (!type || typeof type !== 'string') throw new Error('Item.defineType: type must be a non-empty string.');
        const Base = typeof spec.extends === 'function' ? spec.extends
                   : spec.extends ? Item._classes.get(spec.extends) : Item;
        if (!Base) throw new Error(`Item.defineType: unknown base type '${spec.extends}'.`);
        const cls = class extends Base {};
        Object.defineProperty(cls, 'name', { value: spec.className || type.replace(/(^|[_\-\s]+)(\w)/g, (m, a, c) => c.toUpperCase()) });
        cls.TYPE     = type;
        cls.DEFAULTS = spec.defaults ?? { components: spec.components, tags: spec.tags, meta: spec.meta, displayName: spec.displayName };
        for (const [k, fn] of Object.entries(spec.methods ?? {})) {
            Object.defineProperty(cls.prototype, k, { value: fn, writable: true, configurable: true });
        }
        if (Array.isArray(spec.params)) cls.PARAMS = spec.params;        // positional constructor values
        if (spec.stats) cls.STATS = spec.stats;                           // see Item.STATS
        Object.assign(cls, spec.statics ?? {});
        Item.registerClass(type, cls);
        return cls;
    }

    /* ==================================================================
     * Construction
     * ================================================================== */
    /**
     * new Sword(name, ...the class's main values, extra?)
     *
     *   name    the item's name; it is also its id (like the old Gun class). null = generate an id.
     *   values  the class's main values, in the order its PARAMS list gives (see Item.paramNames('sword')).
     *           Pass `undefined` to keep a value's default; trailing values can simply be left out.
     *   extra   (optional, after the values) { components, tags, meta, displayName, id } and/or
     *           more STATS by name:  { reach: 4, solid: false }
     *
     *   new Sword('iron_sword', 8, 4, 3.5, 0, 500);          // damage speed reach knockback durability
     *   new Sword('iron_sword', 8, undefined, 3.5);          // keep the default speed
     *   new Sword('iron_sword', 8, 4, 3.5, 0, 500, { displayName: 'Iron Sword', tags: ['metal'] });
     *   new Gun('m4', 15, 600, 150, 16, 2, 1, 1, 3.5, 30, 120, { x: 12, y: 7 });
     *
     * Your own subclass can declare `static PARAMS = ['power', 'durability']` and is then built the
     * same way. If you write your own constructor, call super(name, ...values) and keep per-instance
     * setup in `_afterBuild()` (clone / fromJSON / Item.create build items without calling the constructor).
     */
    constructor(name = null, ...args) {
        const cls    = this.constructor;
        const params = Item._params(cls);

        // positional values -> stats; the object after them holds the extras
        const given = {};
        params.forEach((p, i) => { if (args[i] !== undefined) given[p] = args[i]; });
        const extra     = Item._isPlain(args[params.length]) ? args[params.length] : {};
        const overrides = { ...extra, ...given };                      // a positional value beats the same name in `extra`

        this._setup(extra.id ?? name ?? null, name ?? extra.id ?? null);
        Item._autoRegister(cls);
        this._applyDefaults(cls !== Item ? Item._mergeDefaults(cls) : {}, overrides);
        this._afterBuild();
    }

    /** Per-instance setup that must also happen for clones / loaded / Item.create items. Override it, call super. */
    _afterBuild() {}

    /** The order of a class's positional constructor values (nearest PARAMS up the class chain). */
    static _params(cls) {
        let c = cls;
        while (c) {
            if (Object.prototype.hasOwnProperty.call(c, 'PARAMS') && Array.isArray(c.PARAMS)) return c.PARAMS;
            if (c === Item) break;
            c = Object.getPrototypeOf(c);
        }
        return [];
    }
    /** Item.paramNames('sword') -> ['damage', 'speed', 'reach', 'knockback', 'durability'] */
    static paramNames(typeOrClass) {
        const cls = typeof typeOrClass === 'function' ? typeOrClass : (Item._classes.get(typeOrClass) ?? Item);
        return [...Item._params(cls)];
    }

    /** A hand-written subclass with its own TYPE registers itself the first time one is built. */
    static _autoRegister(cls) {
        if (cls !== Item && Object.prototype.hasOwnProperty.call(cls, 'TYPE') &&
            typeof cls.TYPE === 'string' && !Item._classes.has(cls.TYPE)) {
            Item._classes.set(cls.TYPE, cls);
        }
    }

    _setup(id, name) {
        this.id          = id ?? Item._generateId();
        this.name        = name ?? this.id;
        this.type        = this.constructor.TYPE ?? 'item';
        this.displayName = null;
        this.tags        = new Set();
        this.meta        = {};
        this.components  = {};
        this._recipe     = {};
        this.isBroken    = false;
        this._listeners  = Object.create(null);
    }

    /** The stat table of a class: its own STATS on top of every parent's (null hides one). */
    static _mergeStats(cls) {
        const chain = [];
        let c = cls;
        while (c) {
            if (Object.prototype.hasOwnProperty.call(c, 'STATS') && c.STATS) chain.unshift(c.STATS);
            if (c === Item) break;
            c = Object.getPrototypeOf(c);
        }
        const merged = {};
        for (const t of chain) Object.assign(merged, t);
        for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
        return merged;
    }

    /** Names a class accepts as creation values: Item.statNames('gun'), Item.statNames(Sword). */
    static statNames(typeOrClass) {
        const cls = typeof typeOrClass === 'function' ? typeOrClass : (Item._classes.get(typeOrClass) ?? Item);
        return Object.keys(Item._mergeStats(cls));
    }

    static _isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

    /** Write `value` at `key` inside a component's argument list (copying what it touches). */
    static _setPath(args, key, value) {
        if (typeof key === 'number') { args[key] = value; return; }
        const parts = String(key).split('.');
        let obj = Item._isPlain(args[0]) ? { ...args[0] } : {};
        args[0] = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            obj[parts[i]] = Item._isPlain(obj[parts[i]]) ? { ...obj[parts[i]] } : {};
            obj = obj[parts[i]];
        }
        const last = parts[parts.length - 1];
        obj[last] = (Item._isPlain(obj[last]) && Item._isPlain(value)) ? { ...obj[last], ...value } : value;
    }

    /**
     * Fold the stats found in `source` (flat keys and/or source.stats) into `comps`
     * ({ componentName: args }). Touched components get a NEW args array.
     */
    static _applyStats(cls, comps, source) {
        if (!source) return comps;
        const table = Item._mergeStats(cls);
        const given = { ...(Item._isPlain(source.stats) ? source.stats : {}) };
        for (const [k, v] of Object.entries(source)) if (!Item._RESERVED.has(k)) given[k] = v;

        for (const [k, v] of Object.entries(given)) {
            const path = table[k];
            if (!path) {
                console.warn(`Item '${cls.TYPE ?? 'item'}': unknown stat '${k}'. Known: ${Object.keys(table).join(', ')}`);
                continue;
            }
            const [comp, key] = path;
            let args = comps[comp];
            args = args == null ? [] : (Array.isArray(args) ? [...args] : [args]);
            Item._setPath(args, key, v);
            comps[comp] = args;
        }
        return comps;
    }

    static _mergeDefaults(cls) {
        const chain = [];
        let c = cls;
        while (c && c !== Item) {
            if (Object.prototype.hasOwnProperty.call(c, 'DEFAULTS') && c.DEFAULTS) chain.unshift(c.DEFAULTS);
            c = Object.getPrototypeOf(c);
        }
        const merged = { components: {}, tags: [], meta: {}, displayName: null };
        for (const d of chain) {
            Object.assign(merged.components, d.components ?? {});
            merged.tags.push(...(d.tags ?? []));
            Object.assign(merged.meta, d.meta ?? {});
            if (d.displayName) merged.displayName = d.displayName;
        }
        return merged;
    }

    _applyDefaults(defaults, overrides = {}) {
        const comps = { ...(defaults.components ?? {}), ...(overrides.components ?? {}) };
        Item._applyStats(this.constructor, comps, overrides);                  // flat stats: { damage: 9, ... }
        for (const [name, args] of Object.entries(comps)) {
            if (args === null) { this.removeComponent(name); continue; }      // null = "not on this item"
            if (Array.isArray(args)) this.addComponent(name, ...args);
            else this.addComponent(name, args);
        }
        for (const t of [...(defaults.tags ?? []), ...(overrides.tags ?? [])]) this.addTag(t);
        this.meta = { ...(defaults.meta ?? {}), ...(overrides.meta ?? {}) };
        const dn = overrides.displayName ?? defaults.displayName;
        if (dn) this.setName(dn);
        return this;
    }

    _applyOverrides(o = {}) {
        for (const [name, args] of Object.entries(o.components ?? {})) {
            if (args === null) this.removeComponent(name);
            else if (Array.isArray(args)) this.addComponent(name, ...args);
            else this.addComponent(name, args);
        }
        // flat stats ({ damage: 9 }): rebuild only the components they touch
        const before = { ...this._recipe };
        const after  = Item._applyStats(this.constructor, { ...before }, o);
        for (const name of Object.keys(after)) {
            if (after[name] !== before[name]) this.addComponent(name, ...after[name]);
        }
        (o.tags ?? []).forEach(t => this.addTag(t));
        if (o.meta)        Object.assign(this.meta, o.meta);
        if (o.displayName) this.setName(o.displayName);
        return this;
    }

    /* ==================================================================
     * Component management
     * ================================================================== */
    hasComponent(name) { return Object.prototype.hasOwnProperty.call(this.components, name); }
    getComponent(name) { return this.components[name] ?? null; }

    addComponent(name, ...args) {
        const def = Item.components[name];
        if (!def) throw new Error(`Item.addComponent: unknown component '${name}'.`);
        if (this.hasComponent(name)) this.removeComponent(name);

        const result = def.create(this, ...args);
        this.components[name] = result !== undefined ? result : true;
        this._recipe[name] = args;

        if (typeof def.attach === 'function') def.attach(this, this.components[name]);
        this._emit('component:added', { item: this, name, data: this.components[name] });
        return this;
    }

    removeComponent(name) {
        if (!this.hasComponent(name)) return this;
        const def  = Item.components[name];
        const data = this.components[name];
        if (def && typeof def.detach === 'function') def.detach(this, data);
        delete this.components[name];
        delete this._recipe[name];
        this._emit('component:removed', { item: this, name, data });
        return this;
    }

    /** Names of the components that have a given hook (in insertion order). */
    _hooked(hook) {
        const out = [];
        for (const [name, data] of Object.entries(this.components)) {
            const fn = Item.components[name]?.hooks?.[hook];
            if (typeof fn === 'function') out.push({ name, data, fn, def: Item.components[name] });
        }
        return out;
    }

    /* ==================================================================
     * Identity / naming / tags
     * ================================================================== */
    getDisplayName() { return this.displayName ?? this.name; }
    setName(name)    { this.displayName = name; return this; }
    addTag(tag)      { this.tags.add(tag);      return this; }
    removeTag(tag)   { this.tags.delete(tag);   return this; }
    hasTag(tag)      { return this.tags.has(tag); }
    is(type)         {
        const cls = Item._classes.get(type);
        return !!cls && this instanceof cls;
    }

    /* ==================================================================
     * Durability
     * ================================================================== */
    isUnbreakable()     { return !this.hasComponent('durability'); }
    isDamaged()         {
        const d = this.getComponent('durability');
        return !!d && d.value > 0 && d.value < d.max;
    }
    damage(amount)      { const d = this.getComponent('durability'); return d ? d.wear(amount) : 0; }
    wear(amount)        { const d = this.getComponent('durability'); return d ? d.wear(amount) : 0; }   // same as damage(); use this on a Gun
    repair(amount)      { const d = this.getComponent('durability'); return d ? d.repair(amount) : 0; }
    durabilityPercent() { const d = this.getComponent('durability'); return d ? d.percent() : 1; }

    /* ==================================================================
     * Stacking
     * ================================================================== */
    getMaxStack() {
        const stackable = this.getComponent('stackable');
        const maxStack  = this.getComponent('maxStack');
        if (stackable && !stackable.can) return 1;
        if (maxStack)  return maxStack.size;
        if (stackable) return 64;
        return 1;
    }
    canStackWith(other) {
        if (!(other instanceof Item)) return false;
        if (this === other) return true;
        if (this.id !== other.id) return false;
        if (this.getMaxStack() <= 1) return false;
        const a = this.getComponent('durability');
        const b = other.getComponent('durability');
        if (!!a !== !!b) return false;
        if (a && b && a.value !== b.value) return false;
        const keys = new Set([...Object.keys(this.components), ...Object.keys(other.components)]);
        for (const k of keys) {
            if (k === 'durability' || k === 'cooldown') continue;
            try {
                if (JSON.stringify(this.components[k]) !== JSON.stringify(other.components[k])) return false;
            } catch { return false; }
        }
        return true;
    }

    /* ==================================================================
     * Override points for subclasses (all optional)
     * ================================================================== */
    /** Return false to stop use() before anything happens. */
    allowUse(user, target, ctx)   { return true; }
    /** Runs during use(); a returned value ends up in result.effects. */
    handleUse(user, target, ctx)  { return undefined; }
    /** Runs after place() created `obj`. */
    handlePlace(obj, ctx)         {}
    /** Runs when durability reaches 0. */
    handleBreak()                 {}
    /** Runs from item.tick(dt). */
    handleTick(dt)                {}

    /* ==================================================================
     * Tick (cooldowns etc.). Call once per game tick for items that matter
     * (the held item, the hotbar...).
     * ================================================================== */
    tick(dt = Item._defaultDelta()) {
        for (const h of this._hooked('tick')) {
            try { h.fn.call(h.def, this, h.data, dt); }
            catch (e) { console.error(`Item '${this.id}' tick hook '${h.name}' failed:`, e); }
        }
        this.handleTick(dt);
        return this;
    }

    /* ==================================================================
     * Placement (spawns a gameObject from objects.js)
     * ================================================================== */
    /**
     * Spawn the gameObject this item represents, using the `placeable` component.
     * (x, y) is the spawn point; leave them out to use the component's own x / y.
     * ctx.scenes and ctx.placeable can override the component for this one call.
     * Returns the gameObject, or null when the item isn't placeable.
     */
    place(x = null, y = null, ctx = {}) {
        const p = this.getComponent('placeable');
        if (!p) return null;

        const cfg = Item._mergePlaceable(p, ctx.placeable);
        const sc  = ctx.scenes != null ? Item._normScenes(ctx.scenes) : cfg.scenes;
        const obj = Item._buildPlaced(this, cfg, sc, x, y, ctx);
        if (!obj) return null;

        // Make sure every scene the object belongs to knows about it right away.
        if (typeof Scene !== 'undefined' && Scene.getScene && Array.isArray(obj.scenes)) {
            obj.scenes.forEach(id => { const s = Scene.getScene(id); if (s && s.addObject) s.addObject(obj); });
        }

        for (const h of this._hooked('place')) {
            try { h.fn.call(h.def, this, h.data, obj, ctx); }
            catch (e) { console.error(`Item '${this.id}' place hook '${h.name}' failed:`, e); }
        }
        try { this.handlePlace(obj, ctx); }
        catch (e) { console.error(`Item '${this.id}' handlePlace failed:`, e); }
        if (typeof cfg.onPlace === 'function') {
            try { cfg.onPlace(obj, this, ctx); }
            catch (e) { console.error(`Item '${this.id}' placeable.onPlace failed:`, e); }
        }

        this._emit('place', { item: this, object: obj, x, y, ctx });
        return obj;
    }

    static _mergePlaceable(p, o) {
        if (!o) return p;
        return {
            ...p, ...o,
            scenes:    o.scenes != null ? Item._normScenes(o.scenes) : p.scenes,
            collision: { ...p.collision, ...(o.collision || {}) },
            physics:   { ...p.physics,   ...(o.physics   || {}) },
            tags:      [...p.tags, ...(o.tags || [])],
            meta:      { ...p.meta, ...(o.meta || {}) },
        };
    }

    static _buildPlaced(item, cfg, scenes, x, y, ctx) {
        if (typeof gameObject === 'undefined') {
            console.warn('Item.place: gameObject is not defined (objects.js not loaded).');
            return null;
        }

        /* ---- position: spawn point -> snap -> offset -> anchor ---- */
        let px = Number.isFinite(x) ? x : (cfg.x ?? 0);
        let py = Number.isFinite(y) ? y : (cfg.y ?? 0);
        if (cfg.snap > 0) { px = Math.round(px / cfg.snap) * cfg.snap; py = Math.round(py / cfg.snap) * cfg.snap; }
        px += cfg.offsetX; py += cfg.offsetY;
        const a = String(cfg.anchor || 'center').toLowerCase();
        if (a.includes('left'))   px += cfg.width  / 2;
        if (a.includes('right'))  px -= cfg.width  / 2;
        if (a.includes('top'))    py += cfg.height / 2;
        if (a.includes('bottom')) py -= cfg.height / 2;

        /* ---- custom factory (escape hatch) ---- */
        let factory = cfg.factory;
        if (typeof factory === 'string') factory = Item._placeFactories.get(factory);
        if (typeof factory === 'function') {
            const made = factory(item, px, py, ctx, cfg);
            if (made) {
                made.meta = { ...(made.meta || {}), source: item.id, itemType: item.type };
            }
            return made || null;
        }

        /* ---- scenes: none given -> the scene that is active right now ---- */
        let sc = scenes.length ? [...scenes]
               : [typeof Scene !== 'undefined' && Scene.activeScene ? Scene.activeScene : 'blank'];

        const obj = new gameObject(px, py, cfg.width, cfg.height, ...sc);

        /* ---- collision ---- */
        const c = cfg.collision;
        obj.collision.enabled  = c.enabled;
        obj.collision.solid    = c.solid;
        obj.collision.static   = c.static;
        obj.collision.resolve  = c.resolve;
        obj.collision.pushable = c.pushable;
        if (c.excluded.length) obj.collision.excluded.push(...c.excluded);

        /* ---- physics ---- */
        obj.physicsToggles.enabled  = cfg.physics.enabled;
        obj.physicsToggles.gravity  = cfg.physics.gravity;
        obj.physicsToggles.friction = cfg.physics.friction;
        if (cfg.mass != null)       { obj.mass = Number(cfg.mass) || obj.mass; obj.massArea = false; }
        if (cfg.bounciness != null) { obj.bounciness = obj.bounce = Number(cfg.bounciness) || 0; }

        /* ---- looks ---- */
        obj.rendering.color         = cfg.color;
        obj.rendering.visible       = cfg.visible;
        obj.rendering.draw.shape    = cfg.shape;
        obj.rendering.draw.texture  = cfg.texture;
        if (cfg.outline === false)               obj.rendering.outline = false;
        else if (typeof cfg.outline === 'number') obj.rendering.outline = [cfg.outline, 'black'];
        else if (Array.isArray(cfg.outline))      obj.rendering.outline = [...cfg.outline];
        if (cfg.layer != null) obj.layer = cfg.layer;
        obj.ignoreCamera = cfg.ignoreCamera;

        /* ---- tags / meta ---- */
        cfg.tags.forEach(t => { if (!obj.tags.includes(t)) obj.tags.push(t); });
        obj.meta = { ...(obj.meta || {}), source: item.id, itemType: item.type, ...cfg.meta };
        return obj;
    }

    /* ==================================================================
     * Use
     * ================================================================== */
    /**
     * Would use() go through right now? Returns null when it would, otherwise the
     * reason ('denied', 'broken', 'cooldown', 'empty', 'condition', ...). Changes nothing.
     */
    checkUse(user = null, target = null, ctx = {}) {
        try { if (this.allowUse(user, target, ctx) === false) return 'denied'; }
        catch (e) { console.error(`Item '${this.id}' allowUse failed:`, e); return 'error'; }
        for (const h of this._hooked('canUse')) {
            const r = h.fn.call(h.def, this, h.data, user, target, ctx);
            if (r === false) return 'denied';
            if (typeof r === 'string') return r;
        }
        return null;
    }

    /**
     * Use the item.
     *   user    who uses it (any object you like, passed through to handlers)
     *   target  what it is used on (optional)
     *   ctx     { x, y }   place it there if it is placeable
     *           { action } pick one behaviour: 'attack' | 'mine' | 'fire' | 'throw' |
     *                      'cast' | 'consume' | 'equip'. Without it every component
     *                      that applies to a plain "use" responds.
     *           { block }  block tag for tools ('stone', 'wood'...)
     *           { wear }   durability cost for this use (noWear: true skips it)
     *
     * Order: gate (allowUse + every canUse hook) -> placement -> handleUse()
     *        -> onUse component -> every component's `use` hook.
     *
     * Returns { used, cancelled, reason, placed?, trigger?, effects[], hooks{name: value} }.
     * `reason` is set when cancelled ('broken', 'cooldown', 'empty', 'denied', ...).
     */
    use(user = null, target = null, ctx = {}) {
        const results = { used: false, cancelled: false, reason: null, effects: [], hooks: {} };

        /* ---- gate ---- */
        const blocked = this.checkUse(user, target, ctx);
        if (blocked) {
            results.cancelled = true;
            results.reason = blocked;
            this._emit('use:blocked', { item: this, user, target, ctx, reason: blocked });
            return results;
        }

        /* ---- placement ---- */
        const placeable = this.getComponent('placeable');
        if (placeable && placeable.onUsePlace !== false &&
            Number.isFinite(ctx.x) && Number.isFinite(ctx.y)) {
            const obj = this.place(ctx.x, ctx.y, { user, ...ctx });
            if (obj) { results.used = true; results.placed = obj; }
        }

        /* ---- subclass handler ---- */
        try {
            const r = this.handleUse(user, target, ctx);
            if (r !== undefined) { results.used = true; results.effects.push(r); }
        } catch (e) { results.handleError = e; }

        /* ---- onUse component ---- */
        const u = this.getComponent('onUse');
        if (u) {
            results.used    = true;
            results.trigger = u.trigger;
            if (typeof u.trigger === 'function') {
                try { results.effects.push(u.trigger(this, user, target, ctx)); }
                catch (e) { results.triggerError = e; }
            } else if (typeof u.trigger === 'string') {
                this._emit('trigger', { trigger: u.trigger, item: this, user, target, ctx, results });
            }
            for (const fn of u.handlers) {
                try { results.effects.push(fn(this, user, target, ctx)); }
                catch (e) { results.effects.push({ error: e }); }
            }
        }

        /* ---- component hooks ---- */
        for (const h of this._hooked('use')) {
            try {
                const r = h.fn.call(h.def, this, h.data, user, target, ctx);
                if (r !== undefined) { results.hooks[h.name] = r; results.used = true; }
            } catch (e) { results.hooks[h.name] = { error: e }; }
        }

        this._emit('use', { item: this, user, target, ctx, results });
        return results;
    }

    /* ==================================================================
     * Identity / cloning / serialisation
     * ================================================================== */
    equals(other) {
        if (!(other instanceof Item)) return false;
        if (this.id !== other.id) return false;
        if (this.getDisplayName() !== other.getDisplayName()) return false;
        return this.canStackWith(other);
    }

    /**
     * A new instance of `cls` carrying its class defaults, built WITHOUT calling the
     * constructor (so classes with their own positional constructors work).
     */
    static _blank(cls, id, name) {
        const item = Object.create(cls.prototype);
        item._setup(id, name);
        Item._autoRegister(cls);
        item._applyDefaults(cls !== Item ? Item._mergeDefaults(cls) : {}, {});
        item._afterBuild();
        return item;
    }

    /** Copy the saved STATE (numbers, strings...) onto a component, leaving its functions alone. */
    static _overlay(target, saved) {
        if (!target || typeof target !== 'object' || !saved || typeof saved !== 'object') return;
        for (const [k, v] of Object.entries(saved)) {
            if (typeof target[k] === 'function') continue;
            target[k] = v;
        }
    }

    /**
     * Deep copy. Components are rebuilt from the arguments they were created with
     * (so function arguments survive), then the live state is copied over.
     */
    clone({ newId = false } = {}) {
        const copy = Item._blank(this.constructor, newId ? Item._generateId() : this.id, this.name);
        for (const n of Object.keys(copy.components)) if (!this.hasComponent(n)) copy.removeComponent(n);
        for (const [name, data] of Object.entries(this.components)) {
            if (!Item.components[name]) { copy.components[name] = Item._copy(data); continue; }
            if (!copy.hasComponent(name) || !Array.isArray(copy._recipe[name]) || copy._recipe[name] !== this._recipe[name]) {
                copy.addComponent(name, ...(this._recipe[name] ?? []));
            }
            Item._overlay(copy.components[name], Item._copy(data));
        }
        copy.displayName = this.displayName;
        copy.tags        = new Set(this.tags);
        copy.meta        = Item._copy(this.meta);
        copy.isBroken    = this.isBroken;
        return copy;
    }

    toJSON() {
        const components = {}, recipe = {};
        for (const [name, data] of Object.entries(this.components)) {
            if (data && typeof data === 'object') {
                const plain = {};
                for (const [k, v] of Object.entries(data)) {
                    if (typeof v === 'function') continue;
                    plain[k] = Item._copy(v);
                }
                components[name] = plain;
            } else {
                components[name] = data;
            }
            const args = this._recipe[name];
            if (Array.isArray(args) && !args.some(a => typeof a === 'function')) {
                const safe = Item._copy(args);
                if (JSON.stringify(safe) !== '[]') recipe[name] = safe;
            }
        }
        return {
            id:          this.id,
            type:        this.type,
            name:        this.name,
            displayName: this.displayName,
            tags:        [...this.tags],
            meta:        Item._copy(this.meta),
            isBroken:    this.isBroken,
            components,
            recipe,
        };
    }

    /**
     * Rebuild an item from toJSON() data. The class's DEFAULTS are applied first
     * (that is where function-valued settings come back from), then the saved
     * components and their state are laid over them.
     */
    static fromJSON(data) {
        const cls  = Item._classes.get(data.type) ?? Item;
        const item = Item._blank(cls, data.id, data.name);

        for (const n of Object.keys(item.components)) if (!(n in (data.components ?? {}))) item.removeComponent(n);
        for (const [name, saved] of Object.entries(data.components ?? {})) {
            const def = Item.components[name];
            if (!def) { item.components[name] = saved; continue; }
            if (!item.hasComponent(name)) item.addComponent(name, ...((data.recipe ?? {})[name] ?? []));
            Item._overlay(item.components[name], saved);
        }
        item.type        = data.type ?? item.type;
        item.displayName = data.displayName ?? null;
        item.tags        = new Set(data.tags ?? []);
        item.meta        = data.meta ?? {};
        item.isBroken    = !!data.isBroken;
        return item;
    }

    /* ==================================================================
     * Events:  'component:added' 'component:removed' 'use' 'use:blocked'
     *          'trigger' 'place' 'break' 'consumed'
     * ================================================================== */
    on(event, cb) {
        (this._listeners[event] ||= []).push(cb);
        return () => this.off(event, cb);
    }
    off(event, cb) {
        const arr = this._listeners[event];
        if (!arr) return;
        const i = arr.indexOf(cb);
        if (i >= 0) arr.splice(i, 1);
    }
    _emit(event, payload) {
        const arr = this._listeners[event];
        if (!arr) return;
        for (const cb of arr.slice()) {
            try { cb(payload); }
            catch (e) { console.error(`Item event '${event}' error:`, e); }
        }
    }

    /* ==================================================================
     * Static factory
     * ================================================================== */
    /**
     * Create an item from a definition object. `type` picks a registered class
     * (default: plain Item); its DEFAULTS are applied, then the definition on top.
     *
     *   Item.create({ type: 'sword', name: 'Iron Sword',
     *                 components: { attack: [{ damage: 10 }] }, tags: ['metal'] });
     */
    static create(def = {}) {
        const cls  = def.type ? (Item._classes.get(def.type) ?? Item) : Item;
        const item = Item._blank(cls, def.id ?? null, def.name ?? null);
        item._applyOverrides(def);
        return item;
    }

    toString() { return `[Item ${this.type}:${this.id} "${this.getDisplayName()}"]`; }
}


/* =====================================================================
 * BASE CATEGORIES  (extend these, or Item itself, for your own types)
 * ===================================================================== */

/** Used on blocks / resources: pickaxes, axes, shovels, hoes, rods... */
class Tool extends Item {
    static TYPE = 'tool';
    static PARAMS = ['tier', 'speed', 'durability', 'effective', 'damage'];   // new Pickaxe(name, tier, speed, durability, effective, damage)
    static STATS = {
        // tool.*  (damage / reach... = what it does as a weapon)
        tier: ['tool', 'tier'],
        speed: ['tool', 'speed'],
        classes: ['tool', 'classes'],
        effective: ['tool', 'effective'],
        cost: ['tool', 'cost'],
        damage: ['attack', 'damage'],
        attackSpeed: ['attack', 'speed'],
        reach: ['attack', 'reach'],
        knockback: ['attack', 'knockback'],
    };
    static DEFAULTS = {
        components: {
            stackable:  [false],
            maxStack:   [1],
            durability: [100],
            tool:       [{}],
        },
        tags: ['tool'],
        meta: { category: 'tool', slot: 'mainhand' },
    };

    getEffective()   { const t = this.getComponent('tool'); return t ? t.effective : []; }
    getTier()        { const t = this.getComponent('tool'); return t ? t.tier : 0; }
    getMiningSpeed() { const t = this.getComponent('tool'); return t ? t.speed : 1; }

    /** True when the tool works on a block with this tag (an empty `effective` list means anything). */
    canMine(blockTag) {
        const eff = this.getEffective();
        return eff.length === 0 || blockTag == null || eff.includes(blockTag);
    }

    /**
     * One swing at a block. Wears the tool by tool.cost.
     * Returns { mined, speed, tier, reason?, result }.
     */
    mine(blockTag = null, user = null, ctx = {}) {
        if (!this.canMine(blockTag)) return { mined: false, reason: 'ineffective', speed: 1, tier: this.getTier() };
        const t = this.getComponent('tool');
        const result = this.use(user, null, { ...ctx, action: 'mine', block: blockTag, wear: t ? t.cost : 1 });
        return { mined: !result.cancelled, reason: result.reason, speed: this.getMiningSpeed(), tier: this.getTier(), result };
    }
}

/** Hits things up close: swords, daggers, spears... */
class Weapon extends Item {
    static TYPE = 'weapon';
    static PARAMS = ['damage', 'speed', 'reach', 'knockback', 'durability'];   // new Sword(name, damage, speed, reach, knockback, durability)
    static STATS = {
        // attack.*
        damage: ['attack', 'damage'],
        speed: ['attack', 'speed'],
        reach: ['attack', 'reach'],
        knockback: ['attack', 'knockback'],
        sweep: ['attack', 'sweep'],
    };
    static DEFAULTS = {
        components: {
            stackable:  [false],
            maxStack:   [1],
            durability: [100],
            attack:     [{ damage: 4 }],
        },
        tags: ['weapon'],
        meta: { category: 'combat', slot: 'mainhand' },
    };

    getDamage()    { const a = this.getComponent('attack'); return a ? a.damage    : 1; }
    getReach()     { const a = this.getComponent('attack'); return a ? a.reach     : 3; }
    getSpeed()     { const a = this.getComponent('attack'); return a ? a.speed     : 4; }
    getKnockback() { const a = this.getComponent('attack'); return a ? a.knockback : 0; }

    /** One swing: wears the weapon (via use()) and returns the damage dealt, 0 if it couldn't swing. */
    swing(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'attack' });
        return r.cancelled ? 0 : this.getDamage();
    }
}

/** Fires projectiles: bows, guns, staffs. */
class RangedWeapon extends Weapon {
    static TYPE = 'ranged';
    static PARAMS = ['damage', 'speed', 'projectile', 'spread', 'range', 'ammoType', 'durability'];   // new Bow(name, damage, speed, projectile, spread, range, ammoType, durability)
    static STATS = {
        // ranged.*  (damage / speed are the SHOT; meleeDamage is the bash)
        damage: ['ranged', 'damage'],
        meleeDamage: ['attack', 'damage'],
        speed: ['ranged', 'speed'],
        projectile: ['ranged', 'projectile'],
        spread: ['ranged', 'spread'],
        range: ['ranged', 'range'],
        count: ['ranged', 'count'],
        magazine: ['ranged', 'magazine'],
        ammo: ['ranged', 'ammo'],
        reloadTicks: ['ranged', 'reloadTicks'],
        ammoType: ['ranged', 'ammoType'],
    };
    static DEFAULTS = {
        components: {
            attack: [{ damage: 1, reach: 2 }],     // what a melee bash does
            ranged: [{}],
        },
        tags: ['ranged'],
    };

    /**
     * Fire once. Returns { fired, reason, shot } where `shot` is the data to build
     * the projectile from ({ projectile, speed, damage, spread, count, ammoType }).
     * If shot.ammoType is set, taking that ammo from the inventory is up to the caller.
     */
    fire(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'fire' });
        return { fired: !r.cancelled && !!r.hooks.ranged, reason: r.reason, shot: r.hooks.ranged ?? null, result: r };
    }
    reload(n = Infinity) { const r = this.getComponent('ranged'); return r ? r.reload(n) : 0; }
    ammoLeft()           { const r = this.getComponent('ranged'); return r ? r.ammo : 0; }
    magazineSize()       { const r = this.getComponent('ranged'); return r ? r.magazine : 0; }
}

/** Worn in an equipment slot: helmets, chestplates, shields... */
class Armor extends Item {
    static TYPE = 'armor';
    static PARAMS = ['defense', 'toughness', 'durability', 'slot'];   // new Helmet(name, defense, toughness, durability, slot)
    static STATS = {
        defense: ['armor', 'defense'],
        toughness: ['armor', 'toughness'],
        resist: ['armor', 'resist'],
        slot: ['equippable', 'slot'],
    };
    static DEFAULTS = {
        components: {
            stackable:  [false],
            maxStack:   [1],
            durability: [200],
            equippable: [{ slot: 'chest' }],
            armor:      [{ defense: 1 }],
        },
        tags: ['armor'],
        meta: { category: 'armor' },
    };
    getDefense()   { const a = this.getComponent('armor'); return this.isBroken || !a ? 0 : a.defense; }
    getToughness() { const a = this.getComponent('armor'); return a ? a.toughness : 0; }
    getSlot()      { const e = this.getComponent('equippable'); return e ? e.slot : null; }
}

/** Worn for effects rather than protection: rings, amulets, charms. */
class Accessory extends Item {
    static TYPE = 'accessory';
    static PARAMS = ['rarity', 'slot'];   // new Ring(name, rarity, slot)
    static STATS = {
        slot: ['equippable', 'slot'],
    };
    static DEFAULTS = {
        components: {
            stackable:  [false],
            maxStack:   [1],
            equippable: [{ slot: 'accessory' }],
        },
        tags: ['accessory'],
        meta: { category: 'accessory' },
    };
    getSlot() { const e = this.getComponent('equippable'); return e ? e.slot : null; }
}

/** Used up on use: food, potions, scrolls. */
class Consumable extends Item {
    static TYPE = 'consumable';
    static PARAMS = ['hunger', 'saturation', 'health', 'effects', 'duration'];   // new Food(name, hunger, saturation, health, effects, duration)
    static STATS = {
        hunger: ['consume', 'hunger'],
        saturation: ['consume', 'saturation'],
        health: ['consume', 'health'],
        effects: ['consume', 'effects'],
        duration: ['consume', 'duration'],
        animation: ['consume', 'animation'],
        consumesItem: ['consume', 'consumesItem'],
    };
    static DEFAULTS = {
        components: {
            stackable: [true],
            maxStack:  [16],
            consume:   [{}],
        },
        tags: ['consumable'],
        meta: { category: 'consumable' },
    };

    /**
     * Eat / drink / read it. Returns what the game should apply
     * ({ hunger, saturation, health, effects, duration, consumesItem... }) or null.
     * Removing one from the stack is the caller's job.
     */
    consume(user = null, target = null, ctx = {}) {
        const c = this.getComponent('consume');
        return c ? c.apply(user, target, ctx) : null;
    }
}

/** Placed into the world as a gameObject. Configure it with the `placeable` component. */
class Placeable extends Item {
    static TYPE = 'placeable';
    static PARAMS = ['width', 'height', 'color', 'solid', 'static', 'resolve', 'pushable', 'scenes'];   // new Block(name, width, height, color, solid, static, resolve, pushable, scenes)
    static STATS = {
        // placeable.*  (collision.* fields are flat here: solid, static, resolve, pushable, enabled)
        scenes: ['placeable', 'scenes'],
        x: ['placeable', 'x'],
        y: ['placeable', 'y'],
        offsetX: ['placeable', 'offsetX'],
        offsetY: ['placeable', 'offsetY'],
        anchor: ['placeable', 'anchor'],
        snap: ['placeable', 'snap'],
        width: ['placeable', 'width'],
        height: ['placeable', 'height'],
        enabled: ['placeable', 'collision.enabled'],
        solid: ['placeable', 'collision.solid'],
        static: ['placeable', 'collision.static'],
        resolve: ['placeable', 'collision.resolve'],
        pushable: ['placeable', 'collision.pushable'],
        excluded: ['placeable', 'collision.excluded'],
        collision: ['placeable', 'collision'],
        gravity: ['placeable', 'physics.gravity'],
        physicsFriction: ['placeable', 'physics.friction'],
        physics: ['placeable', 'physics'],
        color: ['placeable', 'color'],
        outline: ['placeable', 'outline'],
        shape: ['placeable', 'shape'],
        texture: ['placeable', 'texture'],
        visible: ['placeable', 'visible'],
        layer: ['placeable', 'layer'],
        ignoreCamera: ['placeable', 'ignoreCamera'],
        mass: ['placeable', 'mass'],
        bounciness: ['placeable', 'bounciness'],
        objectTags: ['placeable', 'tags'],
        objectMeta: ['placeable', 'meta'],
        onPlace: ['placeable', 'onPlace'],
        factory: ['placeable', 'factory'],
        onUsePlace: ['placeable', 'onUsePlace'],
    };
    static DEFAULTS = {
        components: {
            stackable: [true],
            maxStack:  [64],
            placeable: [{}],
        },
        tags: ['placeable'],
        meta: { category: 'block' },
    };
}

/** Raw crafting material: wood, stone, ore, ingots, cloth. */
class Material extends Item {
    static TYPE = 'material';
    static PARAMS = ['maxStack', 'value', 'rarity'];   // new Material(name, maxStack, value, rarity)
    static DEFAULTS = {
        components: { stackable: [true], maxStack: [64] },
        tags: ['material'],
        meta: { category: 'material' },
    };
}

/** Projectile supply for ranged weapons. */
class Ammo extends Item {
    static TYPE = 'ammo';
    static PARAMS = ['type', 'damage', 'pierce', 'maxStack'];   // new Arrow(name, type, damage, pierce, maxStack)
    static STATS = {
        type: ['ammo', 'type'],
        damage: ['ammo', 'damage'],
        pierce: ['ammo', 'pierce'],
    };
    static DEFAULTS = {
        components: { stackable: [true], maxStack: [99], ammo: [{}] },
        tags: ['ammo'],
        meta: { category: 'ammo' },
    };
    getAmmoType() { const a = this.getComponent('ammo'); return a ? a.type : null; }
}

/** Thrown on use: grenades, throwing knives, bombs. */
class Throwable extends Item {
    static TYPE = 'throwable';
    static PARAMS = ['damage', 'radius', 'speed', 'fuse', 'maxStack'];   // new Grenade(name, damage, radius, speed, fuse, maxStack)
    static STATS = {
        damage: ['throwable', 'damage'],
        radius: ['throwable', 'radius'],
        speed: ['throwable', 'speed'],
        fuse: ['throwable', 'fuse'],
        consumesItem: ['throwable', 'consumesItem'],
    };
    static DEFAULTS = {
        components: { stackable: [true], maxStack: [16], throwable: [{}] },
        tags: ['throwable'],
        meta: { category: 'throwable' },
    };
    /** Returns { thrown, shot } — shot = { damage, radius, speed, fuse, consumesItem }. */
    throwIt(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'throw' });
        return { thrown: !r.cancelled && !!r.hooks.throwable, shot: r.hooks.throwable ?? null, result: r };
    }
}

/** Opens locks. The `key` component names the lock it fits ('any' fits everything). */
class Key extends Item {
    static TYPE = 'key';
    static PARAMS = ['lock'];   // new Key(name, lock)
    static STATS = {
        lock: ['key', 0],
    };
    static DEFAULTS = {
        components: { stackable: [false], maxStack: [1], key: ['any'] },
        tags: ['key'],
        meta: { category: 'key' },
    };
    opens(lock) { const k = this.getComponent('key'); return !!k && (k.lock === 'any' || k.lock === lock); }
}

/** Money. Stacks high and carries a `value`. */
class Currency extends Item {
    static TYPE = 'currency';
    static PARAMS = ['amount', 'maxStack'];   // new Coin(name, amount, maxStack)
    static STATS = {
        amount: ['value', 'amount'],
    };
    static DEFAULTS = {
        components: { stackable: [true], maxStack: [9999], value: [{ amount: 1 }] },
        tags: ['currency'],
        meta: { category: 'currency' },
    };
}

/** Story / quest objects. Can't be dropped or sold by default (meta flags for your game to read). */
class QuestItem extends Item {
    static TYPE = 'quest';
    static PARAMS = ['rarity'];   // new QuestItem(name, rarity)
    static DEFAULTS = {
        components: { stackable: [false], maxStack: [1], rarity: ['rare'], glint: [true] },
        tags: ['quest'],
        meta: { category: 'quest', droppable: false, sellable: false },
    };
}

/**
 * A learnable / equippable ability. Fits the Inventory's `skills` container.
 *
 *   //        name    passive fn                                   useCondition
 *   new Skill('regen', true,
 *       (item, target, deltaTime) => { target.health += 5 * deltaTime; },   // fn (5 health per second)
 *       (item, target) => target.health < target.maxHealth,                 // useCondition
 *       0, 'mana', 1, null, 0, 60);                                  // cost costType power element range cooldown(ticks)
 *
 *   skill.cast(player)            use it by hand (useCondition and cooldown still apply)
 *   skill.activate(player)        a passive skill now uses itself on every item.tick()
 *   Skill.tickSkills(inv, player) activates + ticks every skill in inv.skills (call once per game tick)
 *
 * `target` in fn / useCondition is always the object that is using the skill.
 * `deltaTime` (fn only) is the game tick length in seconds: skill.tick(dt) / Skill.tickSkills(inv, owner, dt)
 * pass it in for passive skills, and skill.cast(user, null, { deltaTime }) for a manual cast (default: one tick).
 * A passive skill only runs fn when its cooldown is ready, so use cooldown 0 for an effect that should
 * run every tick (scale it by deltaTime), or a longer cooldown for a pulse every so often.
 */
class Skill extends Item {
    static TYPE = 'skill';
    static PARAMS = ['passive', 'fn', 'useCondition', 'cost', 'costType', 'power', 'element', 'range', 'cooldown'];   // new Skill(name, passive, fn, useCondition, cost, costType, power, element, range, cooldown)
    static STATS = {
        passive: ['skill', 'passive'],
        fn: ['skill', 'fn'],
        useCondition: ['skill', 'useCondition'],
        cost: ['skill', 'cost'],
        costType: ['skill', 'costType'],
        power: ['skill', 'power'],
        element: ['skill', 'element'],
        range: ['skill', 'range'],
        castTicks: ['skill', 'castTicks'],
    };
    static DEFAULTS = {
        components: { stackable: [false], maxStack: [1], skill: [{}], cooldown: [30] },
        tags: ['skill'],
        meta: { category: 'skill' },
    };

    /** true = the skill uses itself automatically while active. */
    get passive()  { const s = this.getComponent('skill'); return !!s && s.passive; }
    set passive(v) { const s = this.getComponent('skill'); if (s) s.passive = !!v; }
    get active()   { const s = this.getComponent('skill'); return !!s && s.active; }

    /** Turn the skill on for `user`. A passive skill then fires from item.tick(). */
    activate(user = null) { const s = this.getComponent('skill'); if (s) s.activate(user); return this; }
    deactivate()          { const s = this.getComponent('skill'); if (s) s.deactivate();   return this; }

    /** true when cast(user) would work right now (condition, cooldown, durability...). */
    canCast(user = null, ctx = {}) { return this.checkUse(user, null, { ...ctx, action: 'cast' }) === null; }

    /**
     * Use the skill. `user` is the object using it; it is what fn / useCondition receive as `target`.
     * Returns { cast, reason, spell, value, result }:
     *   spell  = { cost, costType, power, element, range, castTicks, passive }
     *   value  = whatever fn returned
     */
    cast(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'cast' });
        const spell = r.hooks.skill ?? null;
        return { cast: !r.cancelled && !!spell, reason: r.reason, spell, value: spell ? spell.result : undefined, result: r };
    }

    /**
     * Per-tick helper for a character's skills container: every skill in
     * inventory.skills belongs to `owner`, passive ones are switched on, and all of
     * them are ticked (cooldowns, passive firing).
     */
    static tickSkills(inventory, owner, dt = Item._defaultDelta()) {
        if (!inventory || !inventory.skills) return;
        for (let i = 1; i <= inventory.skills.slots; i++) {
            const e = inventory.skills[i];
            const item = e && e.item;
            if (!(item instanceof Skill)) continue;
            if (item.passive && !item.active) item.activate(owner);
            else if (item.active && !item._skillUser) item.activate(owner);
            item.tick(dt);
        }
    }
}


/* =====================================================================
 * CONCRETE SUBCLASSES
 * ===================================================================== */

/* ---------- Melee weapons ---------- */

class Sword extends Weapon {
    static TYPE = 'sword';
    static DEFAULTS = {
        components: {
            durability: [250],
            attack:     [{ damage: 6, speed: 4, reach: 3 }],
        },
        tags: ['sword', 'melee'],
    };
}

class Dagger extends Weapon {
    static TYPE = 'dagger';
    static DEFAULTS = {
        components: {
            durability: [150],
            attack:     [{ damage: 3, speed: 8, reach: 1.5 }],
        },
        tags: ['dagger', 'melee'],
    };
}

class Spear extends Weapon {
    static TYPE = 'spear';
    static DEFAULTS = {
        components: {
            durability: [200],
            attack:     [{ damage: 5, speed: 3, reach: 5, knockback: 2 }],
        },
        tags: ['spear', 'melee'],
    };
}

/* ---------- Ranged weapons ---------- */

class Bow extends RangedWeapon {
    static TYPE = 'bow';
    static DEFAULTS = {
        components: {
            durability: [300],
            ranged:     [{ ammoType: 'arrow', projectile: 'arrow', speed: 25, damage: 5, spread: 1, range: 800 }],
            cooldown:   [20],
        },
        tags: ['bow'],
    };
}

/**
 * Gun — a firearm with semi / full-auto / burst fire, a magazine plus reserve
 * ammo, reloading, attachments and real bullet objects (gameObjects) that fall
 * off in damage with distance. Stats live in the `firearm` component.
 *
 *   const m4 = new Gun('m4', 15, 600, 150, 16, 2, 1, 1, 3.5, 30, 120, { x: 12, y: 7 });
 *   //               name dmg rng vel  rate type burst burstTime reload mag ammo bulletSize
 *   // (add { displayName, tags, components... } after the bullet size if you need more; a
 *   //  gun wears out only if you give it durability: { durability: 500 })
 *
 *   m4.owner   = player;                 // who shoots it (the default `user`)
 *   m4.sceneId = 'play';                 // the scene whose clock times it (default: owner's first scene)
 *   m4.settings.aim = () => ({ x: mouse.x, y: mouse.y });   // where to shoot
 *
 *   m4.update();                         // once per tick (or item.tick())
 *   m4.shoot();   m4.reload();   m4.toggleFireType();
 *   m4.use(player, null, { action: 'fire', angle: 0 });     // the Item way: gated by canUse hooks
 *
 * TIMING. Reload, fire rate, burst spacing and the fire-mode switch are all
 * measured on the scene clock (scene.time, see scene.js), not real time, and
 * nothing is scheduled with setTimeout. When the scene is paused its clock
 * stops, so a reload in progress, a cooldown or half a burst simply waits and
 * carries on after the resume.
 *
 * `gun.damage` is the damage STAT here (it replaces Item.damage(amount), the
 * durability call); use gun.wear(amount) if you ever give a gun durability.
 *
 * settings (all optional):
 *   aim(gun, owner) -> {x, y}   point to shoot at (or pass { aim } / { angle } to shoot())
 *   ignore(other, bullet)       true = bullets pass through `other` (e.g. the owner's melee box)
 *   friendlyFire, friendlyDamage (multiplier), friendlyMinDist (px a bullet must fly before it can hit the owner)
 *   damageDisplay               array handed to applyDamage(amount, damageDisplay)
 */
class Gun extends RangedWeapon {
    static TYPE = 'gun';
    static PARAMS = ['damage', 'range', 'velocity', 'firerate', 'fireType', 'burst', 'burstTime', 'reloadTime', 'mag', 'ammo', 'a'];   // the old Gun constructor, after the name
    static STATS = {
        // firearm.*  (the ranged.* names from RangedWeapon don't apply to a Gun)
        damage: ['firearm', 'damage'],
        range: ['firearm', 'range'],
        velocity: ['firearm', 'velocity'],
        firerate: ['firearm', 'firerate'],
        fireType: ['firearm', 'fireType'],
        burst: ['firearm', 'burst'],
        burstTime: ['firearm', 'burstTime'],
        reloadTime: ['firearm', 'reloadTime'],
        mag: ['firearm', 'mag'],
        ammo: ['firearm', 'ammo'],
        size: ['firearm', 'size'],
        a: ['firearm', 'a'],
        ammoType: ['firearm', 'ammoType'],
        _mag: ['firearm', '_mag'],
        projectile: null,
        spread: null,
        count: null,
        magazine: null,
        reloadTicks: null,
    };
    static DEFAULTS = {
        components: {
            durability: null,        // guns don't wear out unless you add one
            ranged:     null,        // replaced by `firearm`
            firearm:    [{}],
        },
        tags: ['gun', 'firearm'],
    };

    /** Every bullet object that is in flight (shared by all guns). */
    static bullets = [];

    /** Same as new Gun(name, damage, range, ...). Kept for the earlier demo code. */
    static fromStats(name, ...values) { return new Gun(name, ...values); }

    /** Runtime state: set up for every gun, including clones and loaded ones. Not saved. */
    _afterBuild() {
        super._afterBuild();
        this.owner    = null;
        this.sceneId  = null;
        this.settings = { aim: null, ignore: null, friendlyFire: false, friendlyDamage: 1,
                          friendlyMinDist: 300, damageDisplay: null };
        this.canShoot     = true;
        this._burst       = 0;        // bullets fired in the current burst cycle
        this._canBurst    = true;
        this._burstToggle = false;    // true = a burst needs a fresh trigger pull
        this._t = { lastShot: -Infinity, reloadEnd: null, toggleEnd: null,
                    nextShot: null, burstLeft: 0, cycleEnd: null, burstUser: null, burstOpts: null };
    }

    get firearm() { return this.components.firearm ?? null; }

    /* ---------------- clock ---------------- */

    /** Seconds on the clock of the scene this gun lives in (stops while that scene is paused). */
    _now() {
        const id = this.sceneId ?? (this.owner && this.owner.scenes ? this.owner.scenes[0] : null);
        if (typeof Scene !== 'undefined' && Scene.getScene) {
            const sc = id ? Scene.getScene(id) : Scene.getScene();
            if (sc && typeof sc.time === 'number') return sc.time;
        }
        return (typeof clock === 'function') ? clock() : performance.now() / 1000;
    }

    /* ---------------- state ---------------- */

    get reloading()     { this._pump(); return this._t.reloadEnd != null; }
    set reloading(v)    { if (!v) this._t.reloadEnd = null; }          // false cancels a reload
    get togglingFire()  { this._pump(); return this._t.toggleEnd != null; }
    set togglingFire(v) { if (!v) this._t.toggleEnd = null; }

    /**
     * Bring the timers up to date: finish a reload, end the fire-mode lockout,
     * fire the bullets of a burst that are due and end the burst cycle.
     * Call it once per tick (update() / item.tick() do); it is also called
     * before every state check, so it never falls behind.
     */
    _pump() {
        const fa = this.firearm, t = this._t;
        if (!fa) return;
        const now = this._now();

        if (t.reloadEnd != null && now >= t.reloadEnd) this._finishReload();
        if (t.toggleEnd != null && now >= t.toggleEnd) t.toggleEnd = null;

        while (t.burstLeft > 0 && t.nextShot != null && now >= t.nextShot) {
            if (fa._mag <= 0) { t.burstLeft = 0; break; }              // ran dry mid-burst
            fa._mag -= 1;
            this.canShoot  = false;
            this._canBurst = false;
            this._burst++;
            t.burstLeft--;
            t.nextShot += fa.burstTime;
            this._fireBullet(t.burstUser, t.burstOpts || {});
        }
        if (t.cycleEnd != null && now >= t.cycleEnd && t.burstLeft <= 0) {
            t.cycleEnd     = null;
            this._burst    = 0;
            this._canBurst = true;
            if (!this._burstToggle) this.canShoot = true;
        }
    }

    update() { this._pump(); }

    /* ---------------- firing ---------------- */

    /** Seconds between shots in semi / full auto. A burst weapon that is switched to semi fires faster. */
    _shotInterval() {
        const fa = this.firearm;
        const k = fa.original.fireType === 3 ? fa.burst / fa.burstTime / 5 : 1;
        return 1 / (fa.firerate * k);
    }

    /** null when the gun can shoot right now, otherwise why not: 'reloading' | 'empty' | 'cooldown' | 'trigger'. */
    fireBlockedReason() {
        this._pump();
        const fa = this.firearm, t = this._t;
        if (!fa) return 'no firearm';
        if (t.reloadEnd != null) return 'reloading';
        if (fa._mag <= 0) return 'empty';
        if (fa.fireType === 3) {
            if (!this._canBurst || this._burst >= fa.burst || t.burstLeft > 0) return 'cooldown';
            return this.canShoot ? null : 'trigger';
        }
        if (!this.canShoot) return 'trigger';                           // semi auto: release the trigger first
        if (this._now() - t.lastShot < this._shotInterval()) return 'cooldown';
        return null;
    }
    canFire() { return this.fireBlockedReason() === null; }

    /**
     * Pull the trigger. `user` is who shoots (default: this.owner).
     * opts: { angle } direction in radians (0 = right), or { aim: {x, y} } a point to shoot at;
     *       otherwise settings.aim() is used.
     * Returns true if a shot (or the first bullet of a burst) left the barrel.
     */
    shoot(user = this.owner, opts = {}) {
        if (this.fireBlockedReason() !== null) return false;
        if (!user) { console.warn(`Gun '${this.id}': shoot() needs an owner / user.`); return false; }
        const fa = this.firearm, t = this._t, now = this._now();

        if (fa.fireType === 3) {
            t.burstLeft = fa.burst;
            t.nextShot  = now;
            t.cycleEnd  = now + 1 / (fa.firerate * fa.burst);
            t.burstUser = user;
            t.burstOpts = opts;
            this._canBurst = false;
            this._pump();                                               // first bullet leaves now
            this._emit('shoot', { item: this, user, burst: true });
            return true;
        }

        t.lastShot = now;
        fa._mag -= 1;
        this.canShoot = false;
        this._fireBullet(user, opts);
        if (fa.fireType !== 1) this.canShoot = true;                    // full auto re-arms itself; semi waits for the release
        this._emit('shoot', { item: this, user, burst: false });
        return true;
    }

    /** Call when the trigger is let go: re-arms semi auto (and burst weapons that need a fresh pull). */
    releaseTrigger() {
        const fa = this.firearm;
        if (!fa) return;
        if (fa.fireType === 1 || (fa.fireType === 3 && this._burstToggle)) this.canShoot = true;
    }

    reload() {
        this._pump();
        const fa = this.firearm, t = this._t;
        if (!fa || fa._mag >= fa.mag || fa.ammo <= 0 || t.reloadEnd != null) return false;
        fa.ammo += fa._mag;                                             // the magazine goes back into the reserve...
        fa._mag  = 0;
        t.reloadEnd = this._now() + fa.reloadTime;                      // ...and the new one is ready after reloadTime
        this._emit('reload:start', { item: this });
        return true;
    }
    _finishReload() {
        const fa = this.firearm;
        this._t.reloadEnd = null;
        fa.ammo -= fa.mag;
        fa._mag  = fa.mag;
        if (fa.ammo < 0) { fa._mag += fa.ammo; fa.ammo = 0; }
        this._emit('reload:end', { item: this });
    }
    /** Rounds left in the magazine / reserve. */
    ammoLeft()     { const fa = this.firearm; return fa ? fa._mag : 0; }
    magazineSize() { const fa = this.firearm; return fa ? fa.mag : 0; }
    /** Item-style fire: { fired, reason, shot }. */
    fire(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'fire' });
        const h = r.hooks.firearm;
        return { fired: !r.cancelled && !!(h && h.fired), reason: r.reason, shot: h ?? null, result: r };
    }

    getMode() {
        const fa = this.firearm;
        switch (fa.fireType) {
            case 1: return 'Semi Auto';
            case 2: return 'Full Auto';
            case 3: return `${fa.burst} Burst`;
        }
        return '';
    }

    /** Semi <-> the gun's own mode. Locks out further toggles for `wait` seconds. Returns true if it switched. */
    toggleFireType(wait = 0.5) {
        this._pump();
        const fa = this.firearm, t = this._t;
        if (!fa || t.toggleEnd != null || fa.original.fireType === 1) return false;
        if (fa.fireType === 1) { fa.fireType = fa.original.fireType; this.canShoot = true; }
        else                   { fa.fireType = 1; }
        t.toggleEnd = this._now() + wait;
        return true;
    }

    /* ---------------- stats / attachments ---------------- */

    resetStats() {
        const fa = this.firearm, o = fa.original;
        for (const k of ['damage', 'firerate', 'fireType', 'burst', 'burstTime', 'range',
                         'velocity', 'ammo', 'mag', 'reloadTime']) fa[k] = o[k];
    }

    /** Recompute the stats from `original` plus the attachments (each stat is a fraction, 0.1 = +10%). */
    applyAttachments() {
        const fa = this.firearm, a = fa.attachments, s = fa.original;
        const f = (v) => Number(v) || 0;
        this.resetStats();
        if (a.mag) {
            fa.damage     += s.damage     * f(a.mag.damage);
            fa.firerate   += s.firerate   * f(a.mag.firerate);
            fa.range      += s.range      * f(a.mag.range);
            fa.velocity   += s.velocity   * f(a.mag.velocity);
            fa.ammo       += s.ammo       * f(a.mag.ammo);
            fa.reloadTime += s.reloadTime * f(a.mag.reloadTime);
            fa.mag        += s.mag        * f(a.mag.mag);
            fa.burst      += s.burst      * f(a.mag.burst);
            fa.burstTime  += s.burstTime  * f(a.mag.burstTime);
        }
        for (const slot of ['barrel', 'muzzle']) {
            if (!a[slot]) continue;
            fa.firerate += s.firerate * f(a[slot].firerate);
            fa.range    += s.range    * f(a[slot].range);
            fa.velocity += s.velocity * f(a[slot].velocity);
        }
        if (a.underBarrel) fa.range += s.range * f(a.underBarrel.range);
    }

    /** Back to a fresh gun: original stats, full magazine, nothing in progress. */
    reset() {
        this.resetStats();
        const fa = this.firearm, t = this._t;
        fa._mag = fa.mag;
        t.reloadEnd = null; t.toggleEnd = null; t.burstLeft = 0; t.nextShot = null; t.cycleEnd = null; t.lastShot = -Infinity;
        this._burst = 0;
        this._canBurst = true;
        this.canShoot = true;
    }

    /* ---------------- bullets ---------------- */

    _hit(other, amount) {
        const S = this.settings;
        if (typeof other.applyDamage === 'function') other.applyDamage(amount, S.damageDisplay);
        else if (typeof other.health === 'number')   other.health -= amount;
    }

    /** Create one bullet gameObject and send it off. Used by shoot() and by the burst pump. */
    _fireBullet(user, opts = {}) {
        if (typeof gameObject === 'undefined' || !user) return null;
        const fa = this.firearm, S = this.settings, gun = this;

        /* ---- direction ---- */
        const p = typeof user.position === 'function' ? user.position(true) : { x: user.x, y: user.y };
        let slope;                       // the engine's convention: the bullet travels along (slope - PI)
        if (opts.angle != null) {
            slope = Number(opts.angle) + Math.PI;
        } else {
            const aim = opts.aim ?? (typeof S.aim === 'function' ? S.aim(this, user) : null);
            slope = aim ? findSlope(p.x, p.y, aim.x, aim.y) : Math.PI;
        }

        /* ---- the bullet ---- */
        const sc = (user.scenes && user.scenes.length) ? [...user.scenes]
                 : [typeof Scene !== 'undefined' && Scene.activeScene ? Scene.activeScene : 'blank'];
        const bullet = new gameObject(p.x, p.y, fa.size.width, fa.size.height, ...sc);
        bullet.processCollisions();
        bullet.isBullet = true;
        bullet.gun = this;
        bullet.ignoreCamera = user.ignoreCamera;
        bullet.massArea = false;
        bullet.mass = fa.velocity / 8;
        bullet.physicsToggles.gravity = true;
        bullet.collision.solid = false;
        bullet.startPosition = typeof user.position === 'function' ? user.position() : { x: user.x, y: user.y };
        bullet.totalDist = 0;

        // The stats this bullet was fired with (switching weapons mid-flight changes nothing).
        const damage = fa.damage, range = fa.range;
        const ignored = (o, self) => typeof S.ignore === 'function' && S.ignore(o, self);

        /* ---- the bullet's own script: fly, lose damage with distance, hit things, despawn ---- */
        bullet.scripts.push((self) => {
            self.ignoreCamera = user.ignoreCamera;
            self.processCollisions();

            const prv = self.previousPosition, vel = self.velocity(), srt = self.startPosition;
            const tl = World.tickLength;
            self.totalDist += dist(
                srt.x + vel.x / tl, srt.y + vel.y / tl,
                prv.x - vel.x / tl, prv.y - vel.y / tl);
            self.startPosition = self.position();

            const div = range / self.totalDist;
            const dmg = limit(div <= 1 ? damage * Math.pow(range / self.totalDist, 1.25) : damage, damage / 10, damage);

            updateRotationSmooth(self, World.tickLength / 1000, 10000);

            const bounds = World.camera.getBounds(100);
            if (self.x < bounds.left || self.x > bounds.right || self.y > bounds.bottom) self.delete();
            if (self.deleted) return;
            if (!Object.values(self.collision.sides).some(e => e)) return;

            const others = self.collisions.map(e => e.other).filter(o => !ignored(o, self));
            if (others.some(o => o.isBullet && o !== self && !o.deleted)) return;    // bullets pass through bullets
            if (others.includes(user)) {                                             // the shooter
                if (S.friendlyFire && self.totalDist > (S.friendlyMinDist ?? 300) && typeof user.applyDamage === 'function') {
                    user.applyDamage(dmg * (S.friendlyDamage ?? 1), S.damageDisplay);
                    self.delete();
                }
                return;
            }
            const target = others.find(o => o.health);
            if (target) gun._hit(target, dmg);
            self.delete();
        });

        /* ---- point blank: already overlapping something when it leaves the barrel ---- */
        bullet.processCollisions();
        const origin = bullet.hitbox[0];
        const scene  = (typeof Scene !== 'undefined') ? (Scene.getScene(sc[0]) || Scene.getScene()) : null;
        if (scene) {
            for (const o of scene.objects) {
                if (o.deleted || o === bullet || o === user || o.isBullet || !o.hitbox || !o.hitbox[0]) continue;
                if (ignored(o, bullet)) continue;
                if (origin.collidesWith(o.hitbox[0], 1)) {
                    this._hit(o, damage);
                    bullet.delete();
                    break;
                }
            }
        }

        bullet.transform.rotation = slope;
        bullet.setVelocity(fa.velocity, slope - Math.PI);

        const list = Gun.bullets;                                  // forget the ones that are gone
        for (let i = list.length - 1; i >= 0; i--) if (list[i].deleted) list.splice(i, 1);
        list.push(bullet);
        return bullet;
    }
}

// The stats are read and written straight through to the `firearm` component:
//   gun.damage, gun.ammo, gun._mag, gun.fireType ... (what the old Gun class exposed)
['damage', 'range', 'velocity', 'firerate', 'fireType', 'burst', 'burstTime', 'reloadTime',
 'mag', 'ammo', '_mag', 'ammoType', 'size', 'original', 'attachments'].forEach((k) => {
    // _mag and ammo change when a reload finishes, so settle the timers before reading them.
    const live = (k === '_mag' || k === 'ammo');
    Object.defineProperty(Gun.prototype, k, {
        get()  { if (live && this._t) this._pump(); const f = this.components && this.components.firearm; return f ? f[k] : undefined; },
        set(v) { const f = this.components && this.components.firearm; if (f) f[k] = v; },
        configurable: true,
    });
});

class Staff extends RangedWeapon {
    static TYPE = 'staff';
    static DEFAULTS = {
        components: {
            durability: [200],
            ranged:     [{ projectile: 'bolt', speed: 18, damage: 6, range: 500 }],   // no ammoType: uses no ammo
            cooldown:   [30],
            enchantable: [{}],
        },
        tags: ['staff', 'magic'],
    };
}

/* ---------- Tools ---------- */

class Pickaxe extends Tool {
    static TYPE = 'pickaxe';
    static DEFAULTS = {
        components: {
            durability: [200],
            tool:       [{ tier: 1, speed: 2, classes: ['pickaxe'], effective: ['stone', 'ore'] }],
            attack:     [{ damage: 2 }],
        },
        tags: ['pickaxe', 'mining'],
    };
}

class Axe extends Tool {
    static TYPE = 'axe';
    static DEFAULTS = {
        components: {
            durability: [200],
            tool:       [{ tier: 1, speed: 2, classes: ['axe'], effective: ['wood'] }],
            attack:     [{ damage: 7 }],
        },
        tags: ['axe', 'mining', 'weapon'],
    };
}

class Shovel extends Tool {
    static TYPE = 'shovel';
    static DEFAULTS = {
        components: {
            durability: [200],
            tool:       [{ tier: 1, speed: 2, classes: ['shovel'], effective: ['dirt', 'sand', 'gravel'] }],
            attack:     [{ damage: 2 }],
        },
        tags: ['shovel', 'mining'],
    };
}

class Hoe extends Tool {
    static TYPE = 'hoe';
    static DEFAULTS = {
        components: {
            durability: [150],
            tool:       [{ tier: 1, speed: 1, classes: ['hoe'], effective: ['dirt', 'grass'] }],
        },
        tags: ['hoe', 'farming'],
    };
}

/* ---------- Armor ---------- */

class Helmet extends Armor {
    static TYPE = 'helmet';
    static DEFAULTS = {
        components: { equippable: [{ slot: 'head' }], armor: [{ defense: 2 }] },
        tags: ['helmet'],
    };
}
class Chestplate extends Armor {
    static TYPE = 'chestplate';
    static DEFAULTS = {
        components: { equippable: [{ slot: 'chest' }], armor: [{ defense: 5 }] },
        tags: ['chestplate'],
    };
}
class Leggings extends Armor {
    static TYPE = 'leggings';
    static DEFAULTS = {
        components: { equippable: [{ slot: 'legs' }], armor: [{ defense: 4 }] },
        tags: ['leggings'],
    };
}
class Boots extends Armor {
    static TYPE = 'boots';
    static DEFAULTS = {
        components: { equippable: [{ slot: 'feet' }], armor: [{ defense: 2 }] },
        tags: ['boots'],
    };
}
class Shield extends Armor {
    static TYPE = 'shield';
    static DEFAULTS = {
        components: { equippable: [{ slot: 'offhand' }], armor: [{ defense: 3 }], durability: [336] },
        tags: ['shield'],
    };
}

/* ---------- Accessories ---------- */

class Ring extends Accessory {
    static TYPE = 'ring';
    static DEFAULTS = { components: { rarity: ['uncommon'] }, tags: ['ring'] };
}
class Amulet extends Accessory {
    static TYPE = 'amulet';
    static DEFAULTS = { components: { rarity: ['uncommon'] }, tags: ['amulet'] };
}

/* ---------- Consumables ---------- */

class Food extends Consumable {
    static TYPE = 'food';
    static DEFAULTS = {
        components: { consume: [{ hunger: 4, saturation: 2, animation: 'eat' }] },
        tags: ['food'],
        meta: { category: 'food' },
    };
}

class Potion extends Consumable {
    static TYPE = 'potion';
    static DEFAULTS = {
        components: {
            maxStack: [8],
            consume:  [{ effects: [], duration: 10, animation: 'drink' }],
        },
        tags: ['potion', 'magic'],
        meta: { category: 'potion' },
    };
}

class Scroll extends Consumable {
    static TYPE = 'scroll';
    static DEFAULTS = {
        components: {
            maxStack: [8],
            consume:  [{ effects: [], animation: 'read' }],
            rarity:   ['uncommon'],
        },
        tags: ['scroll', 'magic'],
        meta: { category: 'scroll' },
    };
}

/* ---------- Placeables (the gameObject comes from the `placeable` component) ---------- */

class Block extends Placeable {
    static TYPE = 'block';
    static DEFAULTS = {
        components: {
            placeable: [{ width: 40, height: 40, color: '#8d8d8d',
                          collision: { solid: true, static: true, resolve: true, pushable: false } }],
        },
        tags: ['block'],
    };
}

/** Placed crafting station. After placing, obj.meta.crafting = { recipes, open() }. */
class Workbench extends Placeable {
    static TYPE = 'workbench';
    static DEFAULTS = {
        components: {
            maxStack:  [16],
            placeable: [{ width: 50, height: 50, color: '#8a5a2b',
                          collision: { solid: true, static: true, resolve: true } }],
        },
        tags: ['workbench', 'station'],
        meta: { category: 'station', recipes: [] },
    };
    handlePlace(obj) {
        obj.meta.kind = 'workbench';
        obj.meta.crafting = {
            recipes: Array.isArray(this.meta.recipes) ? [...this.meta.recipes] : [],
            open: () => { if (typeof obj._emit === 'function') obj._emit('open'); },
        };
    }
}

/** Decoration you can walk through by default. */
class Furniture extends Placeable {
    static TYPE = 'furniture';
    static DEFAULTS = {
        components: {
            placeable: [{ width: 60, height: 60, color: '#b08850',
                          collision: { solid: false, static: true, resolve: false } }],
        },
        tags: ['furniture'],
        meta: { category: 'furniture' },
    };
}

/** Placed storage: the object gets obj.meta.inventory (an Inventory). */
class Chest extends Placeable {
    static TYPE = 'chest';
    static PARAMS = ['slots', 'width', 'height', 'color', 'locked'];   // new Chest(name, slots, width, height, color, locked)
    static STATS = {
        slots: ['container', 'slots'],
        locked: ['container', 'locked'],
    };
    static DEFAULTS = {
        components: {
            maxStack:  [16],
            container: [{ slots: 18 }],
            placeable: [{ width: 40, height: 32, color: '#a06a2c',
                          collision: { solid: true, static: true, resolve: true } }],
        },
        tags: ['chest', 'container'],
        meta: { category: 'container' },
    };
}

/** A light source you can walk through. */
class Torch extends Placeable {
    static TYPE = 'torch';
    static PARAMS = ['lightRadius', 'lightColor', 'width', 'height'];   // new Torch(name, lightRadius, lightColor, width, height)
    static STATS = {
        lightRadius: ['light', 'radius'],
        lightColor: ['light', 'color'],
        lightIntensity: ['light', 'intensity'],
    };
    static DEFAULTS = {
        components: {
            light:     [{ radius: 140 }],
            placeable: [{ width: 8, height: 28, color: '#ffb347', anchor: 'bottom',
                          collision: { solid: false, static: true, resolve: false } }],
        },
        tags: ['torch', 'light'],
        meta: { category: 'light' },
    };
    handlePlace(obj) {
        const l = this.getComponent('light');
        if (l) obj.meta.light = { ...l };
    }
}

/** Placed door. obj.meta.toggle() opens / closes it (an open door isn't solid). */
class Door extends Placeable {
    static TYPE = 'door';
    static DEFAULTS = {
        components: {
            maxStack:  [16],
            placeable: [{ width: 20, height: 80, color: '#7a4f24', anchor: 'bottom',
                          collision: { solid: true, static: true, resolve: true } }],
        },
        tags: ['door'],
        meta: { category: 'door' },
    };
    handlePlace(obj) {
        const closedColor = obj.rendering.color;
        obj.meta.open = false;
        obj.meta.toggle = () => {
            obj.meta.open = !obj.meta.open;
            obj.collision.solid = !obj.meta.open;
            obj.rendering.color = obj.meta.open ? '#4a3014' : closedColor;
            return obj.meta.open;
        };
    }
}

/** Planted on soil. The `plantable` component says what grows from it. */
class Seed extends Placeable {
    static TYPE = 'seed';
    static PARAMS = ['crop', 'growTicks', 'soil'];   // new Seed(name, crop, growTicks, soil)
    static STATS = {
        crop: ['plantable', 'crop'],
        growTicks: ['plantable', 'growTicks'],
        soil: ['plantable', 'soil'],
    };
    static DEFAULTS = {
        components: {
            plantable: [{ crop: null, growTicks: 600, soil: ['dirt'] }],
            placeable: [{ width: 10, height: 10, color: '#6bbf59', anchor: 'bottom',
                          collision: { solid: false, static: true, resolve: false } }],
        },
        tags: ['seed', 'farming'],
        meta: { category: 'seed' },
    };
    handlePlace(obj) {
        const p = this.getComponent('plantable');
        if (p) obj.meta.plant = { crop: p.crop, growTicks: p.growTicks, age: 0, soil: [...p.soil] };
    }
}

/* ---------- Ammo / throwables / keys / money / quest / skills ---------- */

class Arrow extends Ammo {
    static TYPE = 'arrow';
    static DEFAULTS = { components: { ammo: [{ type: 'arrow', damage: 1 }] }, tags: ['arrow'] };
}
class Bullet extends Ammo {
    static TYPE = 'bullet';
    static DEFAULTS = { components: { maxStack: [200], ammo: [{ type: 'bullet', damage: 1 }] }, tags: ['bullet'] };
}
class Grenade extends Throwable {
    static TYPE = 'grenade';
    static DEFAULTS = {
        components: { throwable: [{ damage: 20, radius: 80, speed: 10, fuse: 90 }] },
        tags: ['grenade', 'explosive'],
    };
}
class Coin extends Currency {
    static TYPE = 'coin';
    static DEFAULTS = { components: { value: [{ amount: 1, currency: 'coin' }] }, tags: ['coin'] };
}
class Spell extends Skill {
    static TYPE = 'spell';
    static DEFAULTS = {
        components: { skill: [{ cost: 10, costType: 'mana', power: 5 }], cooldown: [45] },
        tags: ['spell', 'magic'],
    };
}


/* =====================================================================
 * REGISTRATION
 * Built-in classes are registered here. Classes you write yourself
 * register on first construction, or with Item.registerClass(MyClass).
 * ===================================================================== */
[
    // categories
    Tool, Weapon, RangedWeapon, Armor, Accessory, Consumable, Placeable,
    Material, Ammo, Throwable, Key, Currency, QuestItem, Skill,
    // melee / ranged / tools
    Sword, Dagger, Spear, Bow, Gun, Staff, Pickaxe, Axe, Shovel, Hoe,
    // wearable
    Helmet, Chestplate, Leggings, Boots, Shield, Ring, Amulet,
    // consumable
    Food, Potion, Scroll,
    // placeable
    Block, Workbench, Furniture, Chest, Torch, Door, Seed,
    // misc
    Arrow, Bullet, Grenade, Coin, Spell,
].forEach(cls => Item.registerClass(cls));