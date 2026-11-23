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
 *                   'clear' 'sort' 'compact' 'stack' 'split' 'change'
 *
 * Stacks: append() first pours an Item into the stacks it can join (see
 * Item.canStackWith / item.count); only what's left takes a slot. Turn this off
 * with inv.autoStack = false. inv.split(slot, amount, toSlot) splits a stack.
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
        this.autoStack  = true;    // append() merges Items into matching stacks before using a slot

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

        /* merge into matching stacks first (the given slot, then every other one) */
        if(this.autoStack && this._isStackable(n)){
            if(this._mergeIntoStacks(n, slot, destination)) return true;
            // A given slot that holds a matching (now full) stack mustn't be displaced
            // by the leftover: put the leftover in the first empty slot instead.
            if(this._validateSlot(target, slot) && target[slot] != null && target[slot] !== n &&
               target[slot].canStackWith?.(n)){
                slot = this._firstFreeSlot(target);
                if(slot === 0){
                    new Message(`Inventory|Append: no room for the remaining ${n.count}.`);
                    return false;
                }
            }
        }

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
     * Stacks (Item.count / MaxStack)
     * ================================================================== */

    _isStackable(item){
        return typeof Item !== 'undefined' && item instanceof Item && item.getMaxStack() > 1;
    }

    /* Pour `item` into the stacks it can join: `slot` first (if it holds one),
     * then every other slot in order. Returns true when nothing is left of it. */
    _mergeIntoStacks(item, slot, destination){
        if(!this._isStackable(item) || item.count <= 0) return false;
        const order = [];
        if(this._validateSlot(this, slot)) order.push(slot);
        for(let i = 1; i <= this.slots; i++) if(i !== slot) order.push(i);

        for(const i of order){
            const stack = this[i];
            if(stack == null || stack === item || !stack.canStackWith?.(item)) continue;
            const moved = stack.mergeFrom(item);
            if(moved > 0) this._emit('stack', { destination, slot: i, item: stack, from: item, moved });
            if(item.count <= 0) return true;
        }
        return false;
    }

    /**
     * Split the stack in `slot` in two. `amount` (default: half, rounded down) moves to
     * `toSlot`, which must be empty or hold a stack it can join. Without `toSlot` it goes
     * to the first empty slot. At least one item always stays behind.
     * Returns { slot, item, moved } for the receiving stack, or null when it can't split
     * (not a stack, count < 2, no room, ...).
     */
    split(slot, amount = null, toSlot = null){
        if(!this._validateSlot(this, slot)){
            new Message(`Inventory|Split: slot ${slot} is out of range (1-${this.slots}).`);
            return null;
        }
        const stack = this[slot];
        if(!this._isStackable(stack) || stack.count < 2) return null;

        amount = amount == null ? Math.floor(stack.count / 2) : Math.floor(Number(amount) || 0);
        amount = Math.min(amount, stack.count - 1);
        if(amount < 1) return null;

        if(toSlot == null || toSlot === 0){
            toSlot = this._firstFreeSlot(this);
            if(toSlot === 0){
                new Message(`Inventory|Split: no empty slot to split into.`);
                return null;
            }
        }
        if(!this._validateSlot(this, toSlot) || toSlot === slot){
            new Message(`Inventory|Split: can't split slot ${slot} into slot ${toSlot}.`);
            return null;
        }

        const dest = this[toSlot];
        if(dest == null){
            const part = stack.split(amount);
            this[toSlot] = part;
            this._emit('split', { slot, toSlot, item: stack, part, moved: amount, merged: false });
            return { slot: toSlot, item: part, moved: amount };
        }
        if(!dest.canStackWith?.(stack) || dest.spaceLeft() < 1){
            new Message(`Inventory|Split: slot ${toSlot} can't take items from slot ${slot}.`);
            return null;
        }
        const moved = Math.min(amount, dest.spaceLeft());
        stack.removeCount(moved);
        dest.addCount(moved);
        this._emit('split', { slot, toSlot, item: stack, part: dest, moved, merged: true });
        return { slot: toSlot, item: dest, moved };
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
            appendMode: this.appendMode,
            autoStack: this.autoStack
        };
    }

    static fromJSON(data){
        const inv = new Inventory(data.slots, data.hotbar.slots, data.skills.slots);
        inv.appendMode = data.appendMode ?? 'shift';
        inv.autoStack  = data.autoStack ?? true;

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
        c.autoStack  = this.autoStack;

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
 * An item is a name plus a set of COMPONENTS. Every component is an instance
 * of a small class (a subclass of ItemComponent) that holds its own values and
 * the methods that work on them. Components are added with item.package(...),
 * the same way Entity.package(...) adds behaviour bundles to an entity:
 *
 *   const stick = new Item('stick').package(
 *       new Durability(50),              // max
 *       new Attack(2, 6, 1.5),           // damage speed reach
 *       new MaxStack(1),
 *   );
 *   stick.get('attack').damage = 3;      // same as stick.components.attack / stick.get(Attack)
 *   stick.package(new Attack(5));        // same id: replaces the old one
 *   stick.unpackage('attack');           // or unpackage(Attack)
 *
 * item.package(...) accepts:
 *   - component instances             new Durability(500)
 *   - component classes               Glint            (built with its defaults)
 *   - arrays                          Item.Packages.melee(8, 4, 3.5)
 *   - plain objects (Entity style)    { shine() {...}, _packageInit(item) {...} }
 *     Their keys are copied onto the item; `tags` and `meta` keys are merged instead,
 *     and every `_packageInit(item)` runs once everything in the call is added.
 * A component instance belongs to one item. Packaging one that is already on
 * another item packages a clone of it.
 *
 * ---- Writing a component ----
 *
 *   class Charges extends ItemComponent {
 *       static id = 'charges';                  // key in item.components
 *       constructor(max = 10, value = max) {    // EVERY parameter needs a default
 *           super();
 *           this.max   = max;
 *           this.value = value;
 *       }
 *       canUse()        { return this.value > 0 ? undefined : 'empty'; }   // a string blocks use()
 *       onUse()         { this.value--; return { charges: this.value }; }  // -> result.hooks.charges
 *       recharge(n = 1) { this.value = Math.min(this.max, this.value + n); }
 *   }
 *
 *   Fields (this.x = ...) are cloned, saved and loaded automatically. Functions in
 *   fields are kept by clone() but not saved by toJSON(). `this.item` is the item
 *   the component is on (null until packaged). Components register themselves by
 *   their `id` the first time they are packaged (Item.fromJSON needs that).
 *
 *   Hooks (all optional):
 *     attach(item) / detach(item)     right after being packaged / before being removed
 *     canUse(user, target, ctx)       return a reason string (or false) to block use()
 *     onUse(user, target, ctx)        the return value lands in result.hooks[id]
 *     onTick(dt)                      from item.tick(dt)
 *     onPlace(obj, ctx)               after item.place() spawned `obj`
 *     onBreak()                       durability reached 0
 *     onWhatever(...args)             item.emit('whatever', ...args) calls it
 *   static priority = 0               higher runs first (ties: packaging order)
 *   static requires = ['durability']  console.warn when packaged without these
 *
 * ---- Writing an item type ----
 *
 *   class Wand extends Item {
 *       static TYPE = 'wand';                            // registry key / item.type
 *       constructor(name, damage = 4, charges = 10) {   // every value after `name` needs a default
 *           super(name);
 *           this.package(new Ranged(damage, 18, 'spark'), new Charges(charges), new MaxStack(1));
 *           this.addTag('wand', 'magic');
 *       }
 *   }
 *   const w = new Wand('fire_wand', 6, 20);
 *
 *   Subclass a subclass the same way (class FireWand extends Wand { ... super(name, 9, 5) ... }).
 *   Optional override points: allowUse, handleUse, handlePlace, handleBreak, handleTick,
 *   and _afterBuild() for runtime state that clones need too (clone() does NOT call the
 *   constructor; Item.fromJSON calls `new Type(name)` and then loads the saved values).
 *
 * ---- Bundles ----
 *   Item.Packages holds functions that return arrays of components, like Entity.Packages:
 *     item.package(Item.Packages.melee(8, 4, 3.5, 0, 500));
 *   Add your own: Item.Packages.wand = (dmg) => [new Ranged(dmg), new Charges(10)];
 *
 * ---- Data-style creation (optional) ----
 *   Item.create({ type: 'sword', name: 'iron_sword', args: [8, 4],    // constructor values after name
 *                 components: { attack: { reach: 4 },                 // object: change fields
 *                               glint:  [true],                       // array: new Glint(true)
 *                               durability: null },                   // null: remove
 *                 tags: ['metal'], meta: {}, displayName: 'Iron Sword' });
 *   Item.define(def) / Item.spawn(id, overrides)   define once, spawn copies
 *   item.toJSON() / Item.fromJSON(data)            save / load
 * ===================================================================== */


/* =====================================================================
 * ItemComponent — base class of every item component
 * ===================================================================== */
class ItemComponent {
    static id       = null;   // key on the item (item.components[id]); required
    static priority = 0;      // hook order: higher first
    static requires = [];     // ids of components this one needs

    static _registry = new Map();   // id -> component class

    /** Make a component class known by its id (needed before Item.fromJSON meets it). */
    static register(cls) {
        if (typeof cls !== 'function' || !(cls.prototype instanceof ItemComponent)) {
            throw new Error('ItemComponent.register: expected an ItemComponent subclass.');
        }
        if (!Object.prototype.hasOwnProperty.call(cls, 'id') || !cls.id || typeof cls.id !== 'string') {
            throw new Error(`ItemComponent.register: '${cls.name}' needs its own static id string.`);
        }
        ItemComponent._registry.set(cls.id, cls);
        return cls;
    }
    /** The component class registered under `id` (or null). */
    static get(id) { return ItemComponent._registry.get(id) ?? null; }
    /** Every registered component id. */
    static types() { return [...ItemComponent._registry.keys()]; }

    /** Deep copy of plain objects / arrays; anything else (functions, class instances) is kept as is. */
    static _copy(v) {
        if (Array.isArray(v)) return v.map(ItemComponent._copy);
        if (v && typeof v === 'object') {
            const proto = Object.getPrototypeOf(v);
            if (proto !== Object.prototype && proto !== null) return v;
            const out = {};
            for (const k of Object.keys(v)) out[k] = ItemComponent._copy(v[k]);
            return out;
        }
        return v;
    }
    /** JSON-safe copy (functions dropped). */
    static _plain(v) {
        try { return JSON.parse(JSON.stringify(v)); } catch { return undefined; }
    }

    constructor() {
        // not enumerable, so it is never cloned or saved
        Object.defineProperty(this, 'item', { value: null, writable: true, configurable: true, enumerable: false });
    }

    /** Same as the class's static id. */
    get id() { return this.constructor.id; }

    attach(item) {}
    detach(item) {}

    /** A copy with the same values, not attached to any item. */
    clone() {
        const copy = new this.constructor();
        for (const k of Object.keys(this)) copy[k] = ItemComponent._copy(this[k]);
        return copy;
    }

    /** The component's values (functions left out). */
    toJSON() {
        const out = {};
        for (const k of Object.keys(this)) {
            if (typeof this[k] === 'function') continue;
            const v = ItemComponent._plain(this[k]);
            if (v !== undefined) out[k] = v;
        }
        return out;
    }

    /** Copy saved values onto this component (leaves function fields alone). Returns this. */
    load(data = {}) {
        for (const [k, v] of Object.entries(data ?? {})) {
            if (typeof this[k] === 'function') continue;
            this[k] = ItemComponent._copy(v);
        }
        return this;
    }

    /** new Component() with the saved values laid over it. */
    static fromJSON(data) { return new this().load(data); }

    toString() { return `[ItemComponent ${this.id}]`; }
}


/* =====================================================================
 * BUILT-IN COMPONENTS
 * ===================================================================== */

/**
 * Wears down on use; a broken item (value 0) can't be used until repaired.
 *   new Durability(max = 100, value = max, perUse = 1)
 * ctx.wear sets the cost of one use, ctx.noWear skips it.
 */
class Durability extends ItemComponent {
    static id = 'durability';
    static priority = -10;          // wear after everything else ran
    constructor(max = 100, value = max, perUse = 1) {
        super();
        this.max    = Math.max(1, Number(max) || 1);
        this.value  = Math.min(this.max, Math.max(0, Number(value ?? this.max) || 0));
        this.perUse = Math.max(0, Number(perUse) || 0);
    }
    canUse()          { return this.value <= 0 ? 'broken' : undefined; }
    onUse(u, t, ctx)  {
        if (ctx.noWear) return undefined;
        this.wear(ctx.wear ?? this.perUse);
        return { value: this.value, max: this.max };
    }
    /** Take `n` durability off. Breaking the item calls its onBreak hooks / handleBreak. */
    wear(n = this.perUse) {
        n = Number(n);
        if (!Number.isFinite(n)) return this.value;
        const before = this.value;
        this.value = Math.min(this.max, Math.max(0, before - Math.max(0, n)));
        if (before > 0 && this.value <= 0 && this.item) this.item._break();
        return this.value;
    }
    repair(n = this.max) { this.value = Math.min(this.max, this.value + Math.max(0, Number(n) || 0)); return this.value; }
    set(v) {
        const before = this.value;
        this.value = Math.min(this.max, Math.max(0, Number(v) || 0));
        if (before > 0 && this.value <= 0 && this.item) this.item._break();
        return this.value;
    }
    percent() { return this.max > 0 ? this.value / this.max : 0; }
    isBroken() { return this.value <= 0; }
}

/**
 * Runs code when the item is used.
 *   new OnUse(trigger = 'default@use', ...handlers)
 *   trigger:  function(item, user, target, ctx)  run on use
 *             string                              fires a 'trigger' event with that name
 *   handlers: more functions with the same arguments
 */
class OnUse extends ItemComponent {
    static id = 'onUse';
    static priority = 5;
    constructor(trigger = 'default@use', ...handlers) {
        super();
        this.trigger  = (typeof trigger === 'function' || typeof trigger === 'string') ? trigger : 'default@use';
        this.handlers = handlers.filter(h => typeof h === 'function');
    }
    onUse(user, target, ctx) {
        const item = this.item, out = { trigger: this.trigger, results: [] };
        if (typeof this.trigger === 'function') out.results.push(this.trigger(item, user, target, ctx));
        else item._emit('trigger', { trigger: this.trigger, item, user, target, ctx });
        for (const fn of this.handlers) {
            try { out.results.push(fn(item, user, target, ctx)); }
            catch (e) { out.results.push({ error: e }); }
        }
        return out;
    }
}

/** How many fit in one stack (the cap on item.count). 1 = doesn't stack.   new MaxStack(size = 64) */
class MaxStack extends ItemComponent {
    static id = 'maxStack';
    constructor(size = 64) {
        super();
        this.size = Math.max(1, Math.floor(Number(size) || 1));
    }
}

/** Blocks use() for `ticks` game ticks after each use; counts down in item.tick().   new Cooldown(ticks = 30) */
class Cooldown extends ItemComponent {
    static id = 'cooldown';
    constructor(ticks = 30) {
        super();
        this.ticks     = Math.max(0, Math.floor(Number(ticks) || 0));
        this.remaining = 0;
    }
    ready()   { return this.remaining <= 0; }
    trigger() { this.remaining = this.ticks; }
    reset()   { this.remaining = 0; }
    canUse()  { return this.remaining > 0 ? 'cooldown' : undefined; }
    onUse()   { this.trigger(); return { remaining: this.remaining }; }
    onTick()  { if (this.remaining > 0) this.remaining--; }
}

/**
 * Food / potions / scrolls.
 *   new Consume(hunger = 0, saturation = 0, health = 0, effects = [], duration = 0,
 *               animation = 'eat', consumesItem = true)
 * Using it (ctx.action 'consume' or none) returns what the game should apply.
 * Removing one from the stack is the caller's job (see consumesItem).
 */
class Consume extends ItemComponent {
    static id = 'consume';
    constructor(hunger = 0, saturation = 0, health = 0, effects = [], duration = 0, animation = 'eat', consumesItem = true) {
        super();
        this.hunger       = Math.max(0, Number(hunger) || 0);
        this.saturation   = Math.max(0, Number(saturation) || 0);
        this.health       = Number(health) || 0;
        this.effects      = Array.isArray(effects) ? [...effects] : [];
        this.duration     = Math.max(0, Number(duration) || 0);
        this.animation    = animation || 'eat';
        this.consumesItem = consumesItem !== false;
    }
    apply(user = null, target = null, ctx = {}) {
        const out = {
            action: this.animation, hunger: this.hunger, saturation: this.saturation,
            health: this.health, effects: this.effects.slice(), duration: this.duration,
            animation: this.animation, consumesItem: this.consumesItem,
        };
        if (this.item) this.item._emit('consumed', { item: this.item, user, target, ctx, result: out });
        return out;
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'consume') return undefined;
        return this.apply(user, target, ctx);
    }
}

/** Melee hit.   new Attack(damage = 1, speed = 4, reach = 3, knockback = 0, sweep = false) */
class Attack extends ItemComponent {
    static id = 'attack';
    constructor(damage = 1, speed = 4, reach = 3, knockback = 0, sweep = false) {
        super();
        this.damage    = Number(damage) || 0;
        this.speed     = Number(speed) || 0;
        this.reach     = Number(reach) || 0;
        this.knockback = Number(knockback) || 0;
        this.sweep     = !!sweep;           // hits everything in reach, not just one target
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'attack') return undefined;
        return { action: 'attack', damage: this.damage, reach: this.reach,
                 speed: this.speed, knockback: this.knockback, sweep: this.sweep };
    }
}

/**
 * Breaking blocks / gathering.
 *   new Mining(tier = 0, speed = 1, effective = [], classes = ['pickaxe'], cost = 1)
 *   effective: block tags it works well on ([] = everything); cost: durability per swing.
 */
class Mining extends ItemComponent {
    static id = 'mining';
    constructor(tier = 0, speed = 1, effective = [], classes = ['pickaxe'], cost = 1) {
        super();
        this.tier      = Number(tier) || 0;
        this.speed     = Number(speed) || 1;
        this.effective = Array.isArray(effective) ? [...effective] : [];
        this.classes   = Array.isArray(classes) ? [...classes] : [String(classes)];
        this.cost      = Number(cost) || 1;
    }
    worksOn(block) { return block == null || this.effective.length === 0 || this.effective.includes(block); }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'mine') return undefined;
        const block = ctx.block ?? null, effective = this.worksOn(block);
        return { action: 'mine', block, effective, tier: this.tier, speed: effective ? this.speed : 1 };
    }
}

/**
 * Fires projectiles (bows, staffs...). The caller builds the projectile from the result.
 *   new Ranged(damage = 1, speed = 20, projectile = 'bullet', spread = 0, range = 600,
 *              ammoType = null, count = 1, magazine = 0, ammo = magazine, reloadTicks = 0)
 *   ammoType: item type the caller should take from the inventory (null = none needed)
 *   magazine: 0 = no magazine; > 0 = internal ammo that reload() refills
 */
class Ranged extends ItemComponent {
    static id = 'ranged';
    constructor(damage = 1, speed = 20, projectile = 'bullet', spread = 0, range = 600,
                ammoType = null, count = 1, magazine = 0, ammo = magazine, reloadTicks = 0) {
        super();
        this.damage      = Number(damage) || 0;
        this.speed       = Number(speed) || 0;
        this.projectile  = projectile ?? 'bullet';
        this.spread      = Number(spread) || 0;                  // degrees
        this.range       = Number(range) || 0;
        this.ammoType    = ammoType ?? null;
        this.count       = Math.max(1, Math.floor(Number(count) || 1));   // projectiles per shot
        this.magazine    = Math.max(0, Math.floor(Number(magazine) || 0));
        this.ammo        = Math.min(this.magazine || Infinity, Math.max(0, Math.floor(Number(ammo ?? this.magazine) || 0)));
        this.reloadTicks = Math.max(0, Math.floor(Number(reloadTicks) || 0));
    }
    reload(n = Infinity) {
        if (!this.magazine) return 0;
        const add = Math.min(this.magazine - this.ammo, n);
        this.ammo += add;
        return add;
    }
    empty() { return this.magazine > 0 && this.ammo <= 0; }
    canUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'fire') return undefined;
        return this.empty() ? 'empty' : undefined;
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'fire') return undefined;
        if (this.magazine > 0) this.ammo--;
        return { action: 'fire', projectile: this.projectile, speed: this.speed, damage: this.damage,
                 spread: this.spread, range: this.range, count: this.count,
                 ammoType: this.ammoType, ammo: this.ammo };
    }
}

/**
 * The full stat block of a gun (used by the Gun class). What changes while playing
 * (_mag, ammo, fireType) lives here so it is saved and cloned with the item.
 *   new Firearm(damage = 10, range = 600, velocity = 150, firerate = 5, fireType = 1,
 *               burst = 1, burstTime = 0.1, reloadTime = 2, mag = 30, ammo = mag * 4,
 *               size = { width: 12, height: 7 }, ammoType = null)
 *
 *   damage      per bullet (falls off past `range`)    range       px before damage falls off
 *   velocity    bullet speed                           firerate    shots per second
 *   fireType    1 = semi auto, 2 = full auto, 3 = burst
 *   burst       bullets per burst                      burstTime   seconds between them
 *   reloadTime  seconds                                mag         rounds per magazine
 *   ammo        reserve rounds (outside the magazine)  size        bullet { width, height } (or { x, y })
 *   ammoType    label only ('5.56', '9mm'...)
 * The timing itself runs on the Gun (see Gun._now()).
 */
class Firearm extends ItemComponent {
    static id = 'firearm';
    constructor(damage = 10, range = 600, velocity = 150, firerate = 5, fireType = 1, burst = 1,
                burstTime = 0.1, reloadTime = 2, mag = 30, ammo = null, size = null, ammoType = null) {
        super();
        const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
        this.damage     = num(damage, 10);
        this.range      = Math.max(1, num(range, 600));
        this.velocity   = num(velocity, 150);
        this.firerate   = Math.max(0.01, num(firerate, 5));
        this.fireType   = [1, 2, 3].includes(Number(fireType)) ? Number(fireType) : 1;
        this.burst      = Math.max(1, Math.floor(num(burst, 1)));
        this.burstTime  = Math.max(0, num(burstTime, 0.1));
        this.reloadTime = Math.max(0, num(reloadTime, 2));
        this.mag        = Math.max(1, Math.floor(num(mag, 30)));
        this.ammo       = Math.max(0, num(ammo, this.mag * 4));
        this.original   = { damage: this.damage, range: this.range, velocity: this.velocity, firerate: this.firerate,
                            fireType: this.fireType, burst: this.burst, burstTime: this.burstTime,
                            reloadTime: this.reloadTime, mag: this.mag, ammo: this.ammo };
        this._mag       = this.mag;           // rounds in the magazine
        const s = size ?? {};
        this.size       = { width: num(s.width ?? s.x, 12), height: num(s.height ?? s.y, 7) };
        this.ammoType   = ammoType ?? null;
        this.attachments = { muzzle: null, barrel: null, mag: null, underBarrel: null };
    }
    canUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'fire') return undefined;
        const it = this.item;
        return (it && typeof it.fireBlockedReason === 'function') ? (it.fireBlockedReason() ?? undefined) : undefined;
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'fire') return undefined;
        const it = this.item;
        if (!it || typeof it.shoot !== 'function') return undefined;
        const fired = it.shoot(user ?? it.owner, ctx);
        return { action: 'fire', fired, mag: this._mag, ammo: this.ammo };
    }
    onTick() { const it = this.item; if (it && typeof it._pump === 'function') it._pump(); }
}

/** What a piece of ammo is.   new AmmoStats(type = 'bullet', damage = 0, pierce = 0) */
class AmmoStats extends ItemComponent {
    static id = 'ammoStats';
    constructor(type = 'bullet', damage = 0, pierce = 0) {
        super();
        this.type   = type ?? 'bullet';
        this.damage = Number(damage) || 0;
        this.pierce = Math.max(0, Math.floor(Number(pierce) || 0));
    }
}

/** Thrown on use.   new Thrown(damage = 1, radius = 0, speed = 12, fuse = 0, consumesItem = true) */
class Thrown extends ItemComponent {
    static id = 'thrown';
    constructor(damage = 1, radius = 0, speed = 12, fuse = 0, consumesItem = true) {
        super();
        this.damage       = Number(damage) || 0;
        this.radius       = Number(radius) || 0;
        this.speed        = Number(speed) || 0;
        this.fuse         = Math.max(0, Math.floor(Number(fuse) || 0));   // ticks
        this.consumesItem = consumesItem !== false;
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'throw') return undefined;
        return { action: 'throw', damage: this.damage, radius: this.radius, speed: this.speed,
                 fuse: this.fuse, consumesItem: this.consumesItem };
    }
}

/**
 * A skill / spell.
 *   new Ability(passive = false, fn = null, useCondition = null, cost = 0, costType = 'mana',
 *               power = 1, element = null, range = 0, castTicks = 0)
 *
 *   passive       true = fires by itself whenever it can while ACTIVE (see activate / Skill.tickSkills)
 *   fn            function(item, target, deltaTime), run on every use. `target` is the object using
 *                 the skill; deltaTime is the tick length in seconds.
 *   useCondition  function(item, target) -> true / false; the skill only works while it returns true.
 */
class Ability extends ItemComponent {
    static id = 'ability';
    constructor(passive = false, fn = null, useCondition = null, cost = 0, costType = 'mana',
                power = 1, element = null, range = 0, castTicks = 0) {
        super();
        this.passive      = !!passive;
        this.fn           = typeof fn === 'function' ? fn : null;
        this.useCondition = typeof useCondition === 'function' ? useCondition : null;
        this.cost         = Number(cost) || 0;
        this.costType     = costType || 'mana';
        this.power        = Number(power) || 0;
        this.element      = element ?? null;
        this.range        = Number(range) || 0;
        this.castTicks    = Math.max(0, Math.floor(Number(castTicks) || 0));
        this.active       = false;
        // who it is active for: runtime only (not cloned or saved)
        Object.defineProperty(this, 'user', { value: null, writable: true, configurable: true, enumerable: false });
    }
    activate(user = null) { this.active = true; if (user) this.user = user; return this; }
    deactivate()          { this.active = false; this.user = null; return this; }
    /** true when there is no useCondition, or it returns true for `user`. */
    check(user = null) {
        if (!this.useCondition) return true;
        try { return !!this.useCondition(this.item, user); }
        catch (e) { console.error(`Skill '${this.item?.id}' useCondition failed:`, e); return false; }
    }
    detach() { this.user = null; }
    canUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'cast') return undefined;
        return this.check(user ?? target) ? undefined : 'condition';
    }
    onUse(user, target, ctx) {
        if (ctx.action && ctx.action !== 'cast') return undefined;
        const out = { action: 'cast', passive: this.passive, cost: this.cost, costType: this.costType,
                      power: this.power, element: this.element, range: this.range, castTicks: this.castTicks };
        if (this.fn) out.result = this.fn(this.item, user ?? target, ctx.deltaTime ?? Item._defaultDelta());
        return out;
    }
    // An active passive skill uses itself whenever it is allowed to.
    onTick(dt) {
        if (!this.passive || !this.active || !this.user || !this.item) return;
        const ctx = { action: 'cast', passive: true, deltaTime: dt };
        if (this.item.checkUse(this.user, null, ctx) !== null) return;   // condition / cooldown / broken: wait
        this.item.use(this.user, null, ctx);
    }
}

/** Which equipment slot it goes in ('head', 'chest', 'legs', 'feet', 'mainhand', 'offhand', 'accessory'...). */
class Equippable extends ItemComponent {
    static id = 'equippable';
    constructor(slot = 'mainhand') {
        super();
        this.slot = slot || 'mainhand';
    }
    onUse(user, target, ctx) {
        if (ctx.action !== 'equip') return undefined;
        return { action: 'equip', slot: this.slot };
    }
}

/** Protection while worn.   new Protection(defense = 0, toughness = 0, resist = {}) */
class Protection extends ItemComponent {
    static id = 'protection';
    constructor(defense = 0, toughness = 0, resist = {}) {
        super();
        this.defense   = Number(defense) || 0;
        this.toughness = Number(toughness) || 0;
        this.resist    = { ...(resist || {}) };
    }
}

/** new Enchantable(allowed = [], maxLevel = 3); enchantments live in .enchantments { name: level } */
class Enchantable extends ItemComponent {
    static id = 'enchantable';
    constructor(allowed = [], maxLevel = 3) {
        super();
        this.allowed      = Array.isArray(allowed) ? [...allowed] : [];
        this.maxLevel     = Number(maxLevel) || 3;
        this.enchantments = {};
    }
    canEnchant(name) { return this.allowed.length === 0 || this.allowed.includes(name); }
    enchant(name, level = 1) {
        if (!this.canEnchant(name)) return false;
        this.enchantments[name] = Math.min(this.maxLevel, Math.max(1, Math.floor(Number(level) || 1)));
        return true;
    }
    disenchant(name) { delete this.enchantments[name]; return this; }
}

/** Shiny look.   new Glint(enabled = true) */
class Glint extends ItemComponent {
    static id = 'glint';
    constructor(enabled = true) { super(); this.enabled = !!enabled; }
}

/** Flavour text.   new Lore('line one', 'line two') or new Lore(['line one', 'line two']) */
class Lore extends ItemComponent {
    static id = 'lore';
    constructor(...lines) {
        super();
        this.lines = lines.flat().filter(l => l != null).map(String);
    }
}

/** new Rarity(level = 'common'): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' */
class Rarity extends ItemComponent {
    static id = 'rarity';
    static LEVELS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    constructor(level = 'common') {
        super();
        this.level = Rarity.LEVELS.includes(level) ? level : 'common';
    }
}

/** Worth.   new Value(amount = 0, currency = 'coin') */
class Value extends ItemComponent {
    static id = 'value';
    constructor(amount = 0, currency = 'coin') {
        super();
        this.amount   = Number(amount) || 0;
        this.currency = currency || 'coin';
    }
}

/** Burns in a furnace for `ticks`.   new Fuel(ticks = 0) */
class Fuel extends ItemComponent {
    static id = 'fuel';
    constructor(ticks = 0) { super(); this.ticks = Math.max(0, Math.floor(Number(ticks) || 0)); }
}

/** Opens a lock ('any' fits everything).   new Unlocks(lock = 'any') */
class Unlocks extends ItemComponent {
    static id = 'unlocks';
    constructor(lock = 'any') { super(); this.lock = String(lock); }
    opens(lock) { return this.lock === 'any' || this.lock === lock; }
}

/** Gives off light.   new Light(radius = 100, color = '#ffd27a', intensity = 1) */
class Light extends ItemComponent {
    static id = 'light';
    constructor(radius = 100, color = '#ffd27a', intensity = 1) {
        super();
        this.radius    = Number(radius) || 0;
        this.color     = color || '#ffd27a';
        this.intensity = Math.min(1, Math.max(0, Number(intensity ?? 1)));
    }
}

/** What grows from it.   new Plantable(crop = null, growTicks = 600, soil = ['dirt']) */
class Plantable extends ItemComponent {
    static id = 'plantable';
    constructor(crop = null, growTicks = 600, soil = ['dirt']) {
        super();
        this.crop      = crop ?? null;
        this.growTicks = Math.max(1, Math.floor(Number(growTicks) || 600));
        this.soil      = Array.isArray(soil) ? [...soil] : [String(soil)];
    }
}

/** Storage. When the item is placed, the object gets obj.meta.inventory (an Inventory).   new Container(slots = 12, locked = false) */
class Container extends ItemComponent {
    static id = 'container';
    constructor(slots = 12, locked = false) {
        super();
        this.slots  = Math.max(1, Math.floor(Number(slots) || 12));
        this.locked = !!locked;
    }
    onPlace(obj) {
        obj.meta = obj.meta || {};
        obj.meta.inventory = new Inventory(this.slots, 0, 0);
        obj.meta.locked = this.locked;
    }
}

/**
 * Turns the item into a gameObject (objects.js) when placed.
 *   new Placement(width = 40, height = 40, color = 'white', opts = {})
 *
 * opts (all optional; every value ends up as a field you can change later):
 *   scenes: ['play']             [] = the scene that is active when placed
 *   x, y: null                   fixed spawn point; null = use place(x, y)
 *   offsetX, offsetY: 0          added to the spawn point
 *   anchor: 'center'             which point sits at the spawn point: 'center' | 'top' | 'bottom' |
 *                                'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'
 *   snap: 0                      > 0 snaps the spawn point to that grid size (px)
 *   collision: { enabled, solid, static, resolve, pushable, excluded }   (gameObject.collision)
 *   physics:   { enabled, gravity, friction }                            (gameObject.physicsToggles)
 *   outline, shape: 'rect', texture, visible: true, layer, ignoreCamera   (looks)
 *   mass, bounciness, tags: [], meta: {}
 *   onPlace: (obj, item, ctx) => {}   stored as .placeCallback
 *   factory: null                (item, x, y, ctx, cfg) => gameObject, or a name from
 *                                Item.registerPlaceFactory; the settings above are NOT applied to it
 *   onUsePlace: true             use() places the item when ctx.x / ctx.y are given
 */
class Placement extends ItemComponent {
    static id = 'placement';
    static priority = 10;          // placing happens before the other use hooks
    constructor(width = 40, height = 40, color = 'white', opts = {}) {
        super();
        opts = opts || {};
        const c = opts.collision ?? {}, f = opts.physics ?? {};
        const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
        this.scenes  = Item._normScenes(opts.scenes);
        this.x       = opts.x == null ? null : num(opts.x, 0);
        this.y       = opts.y == null ? null : num(opts.y, 0);
        this.offsetX = num(opts.offsetX, 0);
        this.offsetY = num(opts.offsetY, 0);
        this.anchor  = opts.anchor || 'center';
        this.snap    = Math.max(0, num(opts.snap, 0));
        this.width   = Math.max(1, num(width,  40));
        this.height  = Math.max(1, num(height, 40));
        this.collision = {
            enabled:  c.enabled  !== false,
            solid:    c.solid    !== false,
            static:   c.static   !== false,
            resolve:  c.resolve  !== false,
            pushable: !!c.pushable,
            excluded: Array.isArray(c.excluded) ? [...c.excluded] : [],
        };
        this.physics = { enabled: f.enabled !== false, gravity: !!f.gravity, friction: !!f.friction };
        this.color        = color ?? 'white';
        this.outline      = opts.outline;
        this.shape        = opts.shape ?? 'rect';
        this.texture      = opts.texture ?? null;
        this.visible      = opts.visible !== false;
        this.layer        = opts.layer ?? null;
        this.ignoreCamera = !!opts.ignoreCamera;
        this.mass         = opts.mass ?? null;
        this.bounciness   = opts.bounciness ?? null;
        this.tags         = Array.isArray(opts.tags) ? [...opts.tags] : [];
        this.meta         = { ...(opts.meta || {}) };
        this.placeCallback = typeof opts.onPlace === 'function' ? opts.onPlace : null;   // opts.onPlace
        this.factory      = opts.factory ?? null;
        this.onUsePlace   = opts.onUsePlace !== false;
    }
    onUse(user, target, ctx) {
        if (!this.onUsePlace || !this.item || !Number.isFinite(ctx.x) || !Number.isFinite(ctx.y)) return undefined;
        const obj = this.item.place(ctx.x, ctx.y, { user, ...ctx });
        return obj ? { action: 'place', object: obj } : undefined;
    }
}


/* =====================================================================
 * Item
 * ===================================================================== */
class Item {

    /**
     * Bundles of components, like Entity.Packages. Each returns an array for item.package(...).
     * Add your own: Item.Packages.myBundle = (...values) => [new X(...), new Y(...)];
     */
    static Packages = {
        /** Doesn't stack. */
        single:   ()                => [new MaxStack(1)],
        /** Stacks up to `size`. */
        stack:    (size = 64)       => [new MaxStack(size)],
        /** Swords, daggers, spears... */
        melee:    (damage = 4, speed = 4, reach = 3, knockback = 0, durability = 100) =>
                      [new MaxStack(1), new Durability(durability), new Attack(damage, speed, reach, knockback)],
        /** Pickaxes, axes...  (damage is what it does when you hit something with it) */
        tool:     (tier = 0, speed = 1, effective = [], durability = 100, damage = 1, classes = ['pickaxe']) =>
                      [new MaxStack(1), new Durability(durability), new Mining(tier, speed, effective, classes),
                       new Attack(damage)],
        /** Bows, staffs... (with a weak melee bash) */
        ranged:   (damage = 1, speed = 20, projectile = 'bullet', spread = 0, range = 600, ammoType = null, durability = 100) =>
                      [new MaxStack(1), new Durability(durability), new Attack(1, 4, 2),
                       new Ranged(damage, speed, projectile, spread, range, ammoType)],
        /** Helmets, chestplates... */
        armor:    (defense = 1, toughness = 0, slot = 'chest', durability = 200) =>
                      [new MaxStack(1), new Durability(durability), new Equippable(slot), new Protection(defense, toughness)],
        /** Food, potions... */
        food:     (hunger = 0, saturation = 0, health = 0, effects = [], duration = 0, stack = 16) =>
                      [new MaxStack(stack), new Consume(hunger, saturation, health, effects, duration)],
        /** Things placed into the world. */
        placeable:(width = 40, height = 40, color = 'white', opts = {}, stack = 64) =>
                      [new MaxStack(stack), new Placement(width, height, color, opts)],
    };

    static _prototypes     = new Map();   // id   -> prototype item  (Item.define)
    static _classes        = new Map();   // type -> Item subclass
    static _placeFactories = new Map();   // name -> (item, x, y, ctx, cfg) => gameObject
    static _nextId         = 1;
    static _PROTECTED      = new Set(['components', 'tags', 'meta', 'type', 'count', '_extras', '_listeners']);

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
    static _isPlain(v) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
        const p = Object.getPrototypeOf(v);
        return p === Object.prototype || p === null;
    }
    /** 'durability' | Durability | a component instance -> 'durability' */
    static _idOf(c) {
        if (typeof c === 'string') return c;
        if (typeof c === 'function') return c.id ?? null;
        if (c instanceof ItemComponent) return c.id;
        return null;
    }

    /* ---- item type registry ---- */
    /** Item.registerClass(MyItem) (uses MyItem.TYPE)   or   Item.registerClass('name', MyItem) */
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

    /** A subclass with its own TYPE registers itself the first time one is built. */
    static _autoRegister(cls) {
        if (cls !== Item && Object.prototype.hasOwnProperty.call(cls, 'TYPE') &&
            typeof cls.TYPE === 'string' && !Item._classes.has(cls.TYPE)) {
            Item._classes.set(cls.TYPE, cls);
        }
    }

    /* ---- place factories: named builders used by Placement.factory ---- */
    static registerPlaceFactory(name, factory) {
        if (typeof factory !== 'function') throw new Error('Item.registerPlaceFactory: factory must be a function.');
        Item._placeFactories.set(name, factory);
        return Item;
    }

    /* ==================================================================
     * Construction
     * ================================================================== */
    /**
     * new Item(name, ...packages)
     *   name      the item's name; it is also its id. null = generate an id.
     *   packages  anything item.package() accepts.
     * Subclasses: constructor(name, ...values with defaults) { super(name); this.package(...); }
     */
    constructor(name = null, ...packages) {
        this._setup(name, name);
        Item._autoRegister(this.constructor);
        this._afterBuild();
        if (packages.length) this.package(...packages);
    }

    _setup(id, name) {
        this.id          = id ?? Item._generateId();
        this.name        = name ?? this.id;
        this.type        = this.constructor.TYPE ?? 'item';
        this.displayName = null;
        this.count       = 1;                         // how many are in this stack (see Stacking)
        this.tags        = new Set();
        this.meta        = {};
        this.components  = {};
        this._extras     = new Set();                 // keys copied on by plain-object packages
        this._listeners  = Object.create(null);
    }

    /** Per-instance runtime setup that clones and loaded items also need. Override it and call super. */
    _afterBuild() {}

    /* ==================================================================
     * Components
     * ================================================================== */
    /**
     * Add components (see the top of this section). Returns the item.
     *   item.package(new Durability(500), new Attack(8), Glint, Item.Packages.single(), { extraMethod() {} })
     */
    package(...things) {
        const added = [], inits = [];
        const add = (t) => {
            if (t == null || t === false) return;
            if (Array.isArray(t)) { t.forEach(add); return; }
            if (typeof t === 'function' && t.prototype instanceof ItemComponent) t = new t();
            if (t instanceof ItemComponent) { added.push(this._attach(t)); return; }
            if (Item._isPlain(t)) {
                for (const [k, v] of Object.entries(t)) {
                    if (k === '_packageInit') { if (typeof v === 'function') inits.push(v); continue; }
                    if (k === 'tags') { [].concat(v).forEach(tag => this.addTag(tag)); continue; }
                    if (k === 'meta') { Object.assign(this.meta, v); continue; }
                    if (Item._PROTECTED.has(k)) { console.warn(`Item.package: '${k}' can't be set by a package.`); continue; }
                    this[k] = v;
                    this._extras.add(k);
                }
                return;
            }
            throw new Error(`Item.package: can't package ${String(t)} (expected a component, a component class, an array or a plain object).`);
        };
        things.forEach(add);

        for (const c of added) {
            for (const req of c.constructor.requires ?? []) {
                if (!this.has(req)) console.warn(`Item '${this.id}': component '${c.id}' needs '${req}'.`);
            }
        }
        inits.forEach(fn => fn(this));
        return this;
    }

    _attach(comp) {
        const cls = comp.constructor;
        if (!Object.prototype.hasOwnProperty.call(cls, 'id') || !cls.id) {
            throw new Error(`Item.package: component class '${cls.name}' needs its own static id.`);
        }
        if (ItemComponent.get(cls.id) !== cls) ItemComponent.register(cls);
        if (comp.item && comp.item !== this) comp = comp.clone();      // one item per component instance
        if (this.has(cls.id)) this.unpackage(cls.id);
        this.components[cls.id] = comp;
        comp.item = this;
        comp.attach(this);
        this._emit('component:added', { item: this, name: cls.id, component: comp });
        return comp;
    }

    /** Remove components by id, class or instance. Returns the item. */
    unpackage(...which) {
        for (const w of which) {
            const id = Item._idOf(w);
            const comp = id != null ? this.components[id] : null;
            if (!comp) continue;
            comp.detach(this);
            delete this.components[id];
            comp.item = null;
            this._emit('component:removed', { item: this, name: id, component: comp });
        }
        return this;
    }

    /** The component with this id / class (or null).   item.get('attack'), item.get(Attack) */
    get(which) { const id = Item._idOf(which); return (id != null && this.components[id]) || null; }
    /** true when the item has that component. */
    has(which) { const id = Item._idOf(which); return id != null && Object.prototype.hasOwnProperty.call(this.components, id); }
    /** Every component, in packaging order. */
    list()     { return Object.values(this.components); }

    /** Components that define `method`, by priority (higher first, then packaging order). */
    _hooked(method) {
        return this.list()
            .filter(c => typeof c[method] === 'function')
            .map((c, i) => ({ c, i, p: Number(c.constructor.priority) || 0 }))
            .sort((a, b) => (b.p - a.p) || (a.i - b.i))
            .map(e => e.c);
    }

    /**
     * Call `on<Event>(...args)` on every component that has it.
     *   item.emit('equip', player)  ->  calls comp.onEquip(player)
     * Returns { componentId: returned value } (undefined results left out).
     */
    emit(event, ...args) {
        const method = 'on' + String(event).charAt(0).toUpperCase() + String(event).slice(1);
        const out = {};
        for (const c of this._hooked(method)) {
            try {
                const r = c[method](...args);
                if (r !== undefined) out[c.id] = r;
            } catch (e) { console.error(`Item '${this.id}' ${method} on '${c.id}' failed:`, e); }
        }
        return out;
    }

    /* ==================================================================
     * Identity / naming / tags
     * ================================================================== */
    getDisplayName() { return this.displayName ?? this.name; }
    setName(name)    { this.displayName = name; return this; }
    addTag(...tags)  { tags.flat().forEach(t => this.tags.add(t)); return this; }
    removeTag(tag)   { this.tags.delete(tag); return this; }
    hasTag(tag)      { return this.tags.has(tag); }
    /** item.is('weapon'): true when the item is that registered type or a subclass of it. */
    is(type) {
        const cls = Item._classes.get(type);
        return !!cls && this instanceof cls;
    }

    /* ==================================================================
     * Durability shortcuts
     * ================================================================== */
    get isBroken()      { const d = this.get('durability'); return !!d && d.value <= 0; }
    isUnbreakable()     { return !this.has('durability'); }
    isDamaged()         { const d = this.get('durability'); return !!d && d.value > 0 && d.value < d.max; }
    wear(amount)        { const d = this.get('durability'); return d ? d.wear(amount) : 0; }
    repair(amount)      { const d = this.get('durability'); return d ? d.repair(amount) : 0; }
    durabilityPercent() { const d = this.get('durability'); return d ? d.percent() : 1; }

    /** Called by Durability when it reaches 0. */
    _break() {
        this.emit('break');
        this._emit('break', { item: this });
        try { this.handleBreak(); }
        catch (e) { console.error(`Item '${this.id}' handleBreak failed:`, e); }
    }

    /* ==================================================================
     * Stacking
     *   item.count is how many of this item the stack holds (default 1). It stays
     *   between 0 and getMaxStack() when changed through the methods below.
     *   A stack that reaches 0 fires 'empty'; removing it from its inventory is
     *   the owner's job.
     *   Events: 'count' { item, old, count }   'empty' { item }
     * ================================================================== */
    getMaxStack() { const m = this.get('maxStack'); return m ? m.size : 1; }
    getCount()    { return this.count; }
    /** How many more fit in this stack. */
    spaceLeft()   { return Math.max(0, this.getMaxStack() - this.count); }
    isFullStack() { return this.count >= this.getMaxStack(); }
    isEmptyStack(){ return this.count <= 0; }

    /** Set the count, clamped to 0..maxStack. Returns the item. */
    setCount(n) {
        n = Math.floor(Number(n));
        if (!Number.isFinite(n)) return this;
        this._changeCount(Math.min(this.getMaxStack(), Math.max(0, n)));
        return this;
    }
    /** Add up to `n` to the stack. Returns how many did NOT fit. */
    addCount(n = 1) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        const added = Math.min(n, this.spaceLeft());
        if (added) this._changeCount(this.count + added);
        return n - added;
    }
    /** Take up to `n` off the stack. Returns how many were actually taken. */
    removeCount(n = 1) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        const taken = Math.min(n, this.count);
        if (taken) this._changeCount(this.count - taken);
        return taken;
    }
    /**
     * Take `n` off this stack and return them as a new stack (a clone with count n),
     * or null when nothing could be taken. The copy keeps the id, so the two still stack.
     */
    split(n = 1) {
        n = Math.min(Math.max(0, Math.floor(Number(n) || 0)), this.count);
        if (n <= 0) return null;
        const part = this.clone();
        part.count = n;
        this.removeCount(n);
        return part;
    }
    /** Move as many as fit from `other` into this stack. Returns how many moved. */
    mergeFrom(other) {
        if (other === this || !this.canStackWith(other)) return 0;
        const moved = Math.min(other.count, this.spaceLeft());
        if (moved <= 0) return 0;
        other.removeCount(moved);
        this._changeCount(this.count + moved);
        return moved;
    }
    _changeCount(next) {
        const old = this.count;
        if (next === old) return;
        this.count = next;
        this._emit('count', { item: this, old, count: next });
        if (next <= 0) this._emit('empty', { item: this });
    }

    canStackWith(other) {
        if (!(other instanceof Item)) return false;
        if (this === other) return true;
        if (this.id !== other.id || this.constructor !== other.constructor) return false;
        if (this.getMaxStack() <= 1) return false;
        const keys = new Set([...Object.keys(this.components), ...Object.keys(other.components)]);
        for (const k of keys) {
            if (k === 'cooldown') continue;
            const a = this.components[k], b = other.components[k];
            if (!a || !b) return false;
            if (JSON.stringify(a.toJSON()) !== JSON.stringify(b.toJSON())) return false;
        }
        return true;
    }
    equals(other) {
        return other instanceof Item && this.id === other.id &&
               this.getDisplayName() === other.getDisplayName() && this.canStackWith(other);
    }

    /* ==================================================================
     * Override points for subclasses (all optional)
     * ================================================================== */
    /** Return false to stop use() before anything happens. */
    allowUse(user, target, ctx)  { return true; }
    /** Runs during use(), before the components' onUse; a returned value ends up in result.effects. */
    handleUse(user, target, ctx) { return undefined; }
    /** Runs after place() created `obj`. */
    handlePlace(obj, ctx)        {}
    /** Runs when durability reaches 0. */
    handleBreak()                {}
    /** Runs from item.tick(dt). */
    handleTick(dt)               {}

    /* ==================================================================
     * Tick: call once per game tick for items that matter (held item, hotbar, skills...)
     * ================================================================== */
    tick(dt = Item._defaultDelta()) {
        this.emit('tick', dt);
        try { this.handleTick(dt); }
        catch (e) { console.error(`Item '${this.id}' handleTick failed:`, e); }
        return this;
    }

    /* ==================================================================
     * Use
     * ================================================================== */
    /**
     * Would use() go through right now? null when it would, otherwise the reason
     * ('denied', 'broken', 'cooldown', 'empty', 'condition', ...). Changes nothing.
     */
    checkUse(user = null, target = null, ctx = {}) {
        try { if (this.allowUse(user, target, ctx) === false) return 'denied'; }
        catch (e) { console.error(`Item '${this.id}' allowUse failed:`, e); return 'error'; }
        for (const c of this._hooked('canUse')) {
            let r;
            try { r = c.canUse(user, target, ctx); }
            catch (e) { console.error(`Item '${this.id}' canUse on '${c.id}' failed:`, e); return 'error'; }
            if (r === false) return 'denied';
            if (typeof r === 'string') return r;
        }
        return null;
    }

    /**
     * Use the item.
     *   user    who uses it (passed through to the components)
     *   target  what it is used on (optional)
     *   ctx     { x, y }   place it there if it has a Placement
     *           { action } pick one behaviour: 'attack' | 'mine' | 'fire' | 'throw' | 'cast' |
     *                      'consume' | 'equip'. Without it every component that responds to a
     *                      plain use does.
     *           { block }  block tag for Mining ('stone', 'wood'...)
     *           { wear }   durability cost of this use (noWear: true skips it)
     *
     * Order: gate (allowUse + every canUse) -> handleUse() -> every onUse (by priority).
     * Returns { used, cancelled, reason, placed?, effects[], hooks{ componentId: value } }.
     */
    use(user = null, target = null, ctx = {}) {
        const results = { used: false, cancelled: false, reason: null, effects: [], hooks: {} };

        const blocked = this.checkUse(user, target, ctx);
        if (blocked) {
            results.cancelled = true;
            results.reason = blocked;
            this._emit('use:blocked', { item: this, user, target, ctx, reason: blocked });
            return results;
        }

        try {
            const r = this.handleUse(user, target, ctx);
            if (r !== undefined) { results.used = true; results.effects.push(r); }
        } catch (e) { results.handleError = e; }

        for (const c of this._hooked('onUse')) {
            try {
                const r = c.onUse(user, target, ctx);
                if (r !== undefined) { results.hooks[c.id] = r; results.used = true; }
            } catch (e) { results.hooks[c.id] = { error: e }; }
        }
        if (results.hooks.placement) results.placed = results.hooks.placement.object;

        this._emit('use', { item: this, user, target, ctx, results });
        return results;
    }

    /* ==================================================================
     * Placement (spawns a gameObject from objects.js)
     * ================================================================== */
    /**
     * Spawn the gameObject this item represents, using its Placement component.
     * (x, y) is the spawn point; leave them out to use the component's own x / y.
     * ctx.scenes and ctx.placement (same shape as the component) override it for this one call.
     * Returns the gameObject, or null when the item has no Placement.
     */
    place(x = null, y = null, ctx = {}) {
        const p = this.get('placement');
        if (!p) return null;

        const cfg = Item._mergePlacement(p, ctx.placement);
        const sc  = ctx.scenes != null ? Item._normScenes(ctx.scenes) : cfg.scenes;
        const obj = Item._buildPlaced(this, cfg, sc, x, y, ctx);
        if (!obj) return null;

        // Make sure every scene the object belongs to knows about it right away.
        if (typeof Scene !== 'undefined' && Scene.getScene && Array.isArray(obj.scenes)) {
            obj.scenes.forEach(id => { const s = Scene.getScene(id); if (s && s.addObject) s.addObject(obj); });
        }

        this.emit('place', obj, ctx);
        try { this.handlePlace(obj, ctx); }
        catch (e) { console.error(`Item '${this.id}' handlePlace failed:`, e); }
        if (typeof cfg.placeCallback === 'function') {
            try { cfg.placeCallback(obj, this, ctx); }
            catch (e) { console.error(`Item '${this.id}' placement onPlace failed:`, e); }
        }

        this._emit('place', { item: this, object: obj, x, y, ctx });
        return obj;
    }

    static _mergePlacement(p, o) {
        const base = { ...p };                       // own fields of the component (not `item`)
        if (!o) return base;
        return {
            ...base, ...o,
            scenes:    o.scenes != null ? Item._normScenes(o.scenes) : base.scenes,
            collision: { ...base.collision, ...(o.collision || {}) },
            physics:   { ...base.physics,   ...(o.physics   || {}) },
            tags:      [...base.tags, ...(o.tags || [])],
            meta:      { ...base.meta, ...(o.meta || {}) },
            placeCallback: typeof o.onPlace === 'function' ? o.onPlace : base.placeCallback,
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
            if (made) made.meta = { ...(made.meta || {}), source: item.id, itemType: item.type };
            return made || null;
        }

        /* ---- scenes: none given -> the scene that is active right now ---- */
        const sc = scenes.length ? [...scenes]
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
        if (cfg.outline === false)                obj.rendering.outline = false;
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
     * Cloning / saving
     * ================================================================== */
    /** Deep copy (the constructor is NOT called; _afterBuild is). newId: true gives the copy a fresh id. */
    clone({ newId = false } = {}) {
        const copy = Object.create(this.constructor.prototype);
        copy._setup(newId ? Item._generateId() : this.id, this.name);
        copy._afterBuild();
        copy.package(this.list().map(c => c.clone()));
        copy.displayName = this.displayName;
        copy.count       = this.count;
        copy.tags        = new Set(this.tags);
        copy.meta        = ItemComponent._copy(this.meta);
        for (const k of this._extras) { copy[k] = ItemComponent._copy(this[k]); copy._extras.add(k); }
        return copy;
    }

    toJSON() {
        const components = {};
        for (const c of this.list()) components[c.id] = c.toJSON();
        const extras = {};
        for (const k of this._extras) {
            if (typeof this[k] === 'function') continue;
            const v = ItemComponent._plain(this[k]);
            if (v !== undefined) extras[k] = v;
        }
        return {
            id:          this.id,
            type:        this.type,
            name:        this.name,
            displayName: this.displayName,
            count:       this.count,
            tags:        [...this.tags],
            meta:        ItemComponent._plain(this.meta) ?? {},
            components,
            extras,
        };
    }

    /**
     * Rebuild an item from toJSON() data. `new Type(name)` runs first (that is where
     * function-valued settings come back from), then the saved values are laid over it.
     */
    static fromJSON(data) {
        const cls = Item._classes.get(data.type) ?? Item;
        let item;
        try { item = new cls(data.name ?? data.id ?? null); }
        catch (e) {
            console.warn(`Item.fromJSON: new ${cls.name}(name) failed, loading without the constructor.`, e);
            item = Object.create(cls.prototype);
            item._setup(data.id, data.name);
            item._afterBuild();
        }
        item.id = data.id ?? item.id;
        const saved = data.components ?? {};
        for (const id of Object.keys(item.components)) if (!(id in saved)) item.unpackage(id);
        for (const [id, values] of Object.entries(saved)) {
            if (item.has(id)) { item.get(id).load(values); continue; }
            const C = ItemComponent.get(id);
            if (C) item.package(C.fromJSON(values));
            else console.warn(`Item.fromJSON: unknown component '${id}' on '${item.id}' was skipped.`);
        }
        item.displayName = data.displayName ?? null;
        item.count       = Number.isFinite(data.count) ? Math.max(0, Math.floor(data.count)) : 1;
        item.tags        = new Set(data.tags ?? []);
        item.meta        = data.meta ?? {};
        for (const [k, v] of Object.entries(data.extras ?? {})) { item[k] = v; item._extras.add(k); }
        return item;
    }

    /* ==================================================================
     * Data-style creation
     * ================================================================== */
    /**
     * Item.create({ type, name, id, args, components, tags, meta, displayName, count })
     *   type        registered type (default: plain Item)
     *   args        constructor values after the name: Item.create({ type: 'sword', args: [8, 4] })
     *   components  { id: [constructor args] | { fields to change } | component | null (remove) }
     *               or an array of anything item.package() accepts
     */
    static create(def = {}) {
        const cls  = def.type ? (Item._classes.get(def.type) ?? Item) : Item;
        if (def.type && cls === Item) console.warn(`Item.create: unknown type '${def.type}', using Item.`);
        const item = new cls(def.name ?? def.id ?? null, ...(Array.isArray(def.args) ? def.args : []));
        if (def.id != null) item.id = def.id;
        return item._applyOverrides(def);
    }

    _applyOverrides(o = {}) {
        if (Array.isArray(o.components)) this.package(...o.components);
        else {
            for (const [id, v] of Object.entries(o.components ?? {})) {
                if (v === null) { this.unpackage(id); continue; }
                if (v instanceof ItemComponent || Array.isArray(v)) {
                    if (v instanceof ItemComponent) { this.package(v); continue; }
                    const C = ItemComponent.get(id);
                    if (!C) { console.warn(`Item: unknown component '${id}'.`); continue; }
                    this.package(new C(...v));
                    continue;
                }
                if (Item._isPlain(v)) {
                    if (!this.has(id)) {
                        const C = ItemComponent.get(id);
                        if (!C) { console.warn(`Item: unknown component '${id}'.`); continue; }
                        this.package(new C());
                    }
                    this.get(id).load(v);
                }
            }
        }
        (o.tags ?? []).forEach(t => this.addTag(t));
        if (o.meta)        Object.assign(this.meta, o.meta);
        if (o.displayName) this.setName(o.displayName);
        if (o.count != null) this.setCount(o.count);
        return this;
    }

    /** Define once, spawn many:  Item.define({ id: 'iron_sword', type: 'sword', args: [8] }); Item.spawn('iron_sword') */
    static define(def) {
        const proto = Item.create(def);
        Item._prototypes.set(proto.id, proto);
        return proto;
    }
    static getPrototype(id) { return Item._prototypes.get(id) ?? null; }
    static spawn(id, overrides = {}) {
        const proto = Item._prototypes.get(id);
        if (!proto) throw new Error(`Item.spawn: unknown item '${id}'.`);
        return proto.clone({ newId: true })._applyOverrides(overrides);
    }

    /* ==================================================================
     * Events (listeners):  'component:added' 'component:removed' 'use' 'use:blocked'
     *                      'trigger' 'place' 'break' 'consumed' 'count' 'empty'  (+ Gun: 'shoot' 'reload:start' 'reload:end')
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
    once(event, cb) {
        const wrapper = (payload) => { this.off(event, wrapper); cb(payload); };
        return this.on(event, wrapper);
    }
    _emit(event, payload) {
        const arr = this._listeners[event];
        if (!arr) return;
        for (const cb of arr.slice()) {
            try { cb(payload); }
            catch (e) { console.error(`Item event '${event}' error:`, e); }
        }
    }

    toString() { return `[Item ${this.type}:${this.id} "${this.getDisplayName()}"]`; }
}


/* =====================================================================
 * BASE CATEGORIES  (extend these, or Item itself, for your own types)
 *
 * Every constructor takes the item's name first, then its main values in
 * order. Every value has a default, so trailing ones can be left out and
 * `undefined` keeps a default:   new Sword('iron_sword', 8, undefined, 3.5)
 * ===================================================================== */

/** Used on blocks / resources: pickaxes, axes, shovels, hoes...
 *  new Tool(name, tier, speed, durability, effective, damage) */
class Tool extends Item {
    static TYPE = 'tool';
    constructor(name = null, tier = 0, speed = 1, durability = 100, effective = [], damage = 1) {
        super(name);
        this.package(Item.Packages.tool(tier, speed, effective, durability, damage));
        this.addTag('tool');
        Object.assign(this.meta, { category: 'tool', slot: 'mainhand' });
    }
    get mining()     { return this.get('mining'); }
    getEffective()   { const t = this.mining; return t ? t.effective : []; }
    getTier()        { const t = this.mining; return t ? t.tier : 0; }
    getMiningSpeed() { const t = this.mining; return t ? t.speed : 1; }

    /** True when the tool works on a block with this tag (an empty `effective` list means anything). */
    canMine(blockTag) { const t = this.mining; return !t || t.worksOn(blockTag); }

    /**
     * One swing at a block. Wears the tool by mining.cost.
     * Returns { mined, speed, tier, reason?, result }.
     */
    mine(blockTag = null, user = null, ctx = {}) {
        if (!this.canMine(blockTag)) return { mined: false, reason: 'ineffective', speed: 1, tier: this.getTier() };
        const t = this.mining;
        const result = this.use(user, null, { ...ctx, action: 'mine', block: blockTag, wear: t ? t.cost : 1 });
        return { mined: !result.cancelled, reason: result.reason, speed: this.getMiningSpeed(), tier: this.getTier(), result };
    }
}

/** Hits things up close: swords, daggers, spears...
 *  new Weapon(name, damage, speed, reach, knockback, durability) */
class Weapon extends Item {
    static TYPE = 'weapon';
    constructor(name = null, damage = 4, speed = 4, reach = 3, knockback = 0, durability = 100) {
        super(name);
        this.package(Item.Packages.melee(damage, speed, reach, knockback, durability));
        this.addTag('weapon');
        Object.assign(this.meta, { category: 'combat', slot: 'mainhand' });
    }
    get attack()   { return this.get('attack'); }
    getDamage()    { const a = this.attack; return a ? a.damage    : 1; }
    getReach()     { const a = this.attack; return a ? a.reach     : 3; }
    getSpeed()     { const a = this.attack; return a ? a.speed     : 4; }
    getKnockback() { const a = this.attack; return a ? a.knockback : 0; }

    /** One swing: wears the weapon (via use()) and returns the damage dealt, 0 if it couldn't swing. */
    swing(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'attack' });
        return r.cancelled ? 0 : this.getDamage();
    }
}

/** Fires projectiles: bows, staffs.  (Gun is its own class.)
 *  new RangedWeapon(name, damage, speed, projectile, spread, range, ammoType, durability) */
class RangedWeapon extends Item {
    static TYPE = 'ranged';
    constructor(name = null, damage = 1, speed = 20, projectile = 'bullet', spread = 0, range = 600,
                ammoType = null, durability = 100) {
        super(name);
        this.package(Item.Packages.ranged(damage, speed, projectile, spread, range, ammoType, durability));
        this.addTag('weapon', 'ranged');
        Object.assign(this.meta, { category: 'combat', slot: 'mainhand' });
    }
    get ranged() { return this.get('ranged'); }

    /**
     * Fire once. Returns { fired, reason, shot } where `shot` is the data to build
     * the projectile from ({ projectile, speed, damage, spread, count, ammoType }).
     * If shot.ammoType is set, taking that ammo from the inventory is up to the caller.
     */
    fire(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'fire' });
        return { fired: !r.cancelled && !!r.hooks.ranged, reason: r.reason, shot: r.hooks.ranged ?? null, result: r };
    }
    reload(n = Infinity) { const r = this.ranged; return r ? r.reload(n) : 0; }
    ammoLeft()           { const r = this.ranged; return r ? r.ammo : 0; }
    magazineSize()       { const r = this.ranged; return r ? r.magazine : 0; }
}

/** Worn in an equipment slot: helmets, chestplates, shields...
 *  new Armor(name, defense, toughness, durability, slot) */
class Armor extends Item {
    static TYPE = 'armor';
    constructor(name = null, defense = 1, toughness = 0, durability = 200, slot = 'chest') {
        super(name);
        this.package(Item.Packages.armor(defense, toughness, slot, durability));
        this.addTag('armor');
        this.meta.category = 'armor';
    }
    getDefense()   { const a = this.get('protection'); return this.isBroken || !a ? 0 : a.defense; }
    getToughness() { const a = this.get('protection'); return a ? a.toughness : 0; }
    getSlot()      { const e = this.get('equippable'); return e ? e.slot : null; }
}

/** Worn for effects rather than protection: rings, amulets, charms.
 *  new Accessory(name, rarity, slot) */
class Accessory extends Item {
    static TYPE = 'accessory';
    constructor(name = null, rarity = 'common', slot = 'accessory') {
        super(name);
        this.package(new MaxStack(1), new Equippable(slot), new Rarity(rarity));
        this.addTag('accessory');
        this.meta.category = 'accessory';
    }
    getSlot() { const e = this.get('equippable'); return e ? e.slot : null; }
}

/** Used up on use: food, potions, scrolls.
 *  new Consumable(name, hunger, saturation, health, effects, duration) */
class Consumable extends Item {
    static TYPE = 'consumable';
    constructor(name = null, hunger = 0, saturation = 0, health = 0, effects = [], duration = 0) {
        super(name);
        this.package(Item.Packages.food(hunger, saturation, health, effects, duration));
        this.addTag('consumable');
        this.meta.category = 'consumable';
    }
    /**
     * Eat / drink / read it. Returns what the game should apply
     * ({ hunger, saturation, health, effects, duration, consumesItem... }) or null.
     * Removing one from the stack is the caller's job.
     */
    consume(user = null, target = null, ctx = {}) {
        const c = this.get('consume');
        return c ? c.apply(user, target, ctx) : null;
    }
}

/** Placed into the world as a gameObject (see the Placement component).
 *  new Placeable(name, width, height, color, solid, static, resolve, pushable, scenes) */
class Placeable extends Item {
    static TYPE = 'placeable';
    constructor(name = null, width = 40, height = 40, color = 'white', solid = true, isStatic = true,
                resolve = true, pushable = false, scenes = []) {
        super(name);
        this.package(Item.Packages.placeable(width, height, color, {
            scenes, collision: { solid, static: isStatic, resolve, pushable },
        }));
        this.addTag('placeable');
        this.meta.category = 'block';
    }
    get placement() { return this.get('placement'); }
}

/** Raw crafting material: wood, stone, ore, ingots, cloth.
 *  new Material(name, maxStack, value, rarity) */
class Material extends Item {
    static TYPE = 'material';
    constructor(name = null, maxStack = 64, value = 0, rarity = 'common') {
        super(name);
        this.package(new MaxStack(maxStack), new Value(value), new Rarity(rarity));
        this.addTag('material');
        this.meta.category = 'material';
    }
}

/** Projectile supply for ranged weapons.
 *  new Ammo(name, type, damage, pierce, maxStack) */
class Ammo extends Item {
    static TYPE = 'ammo';
    constructor(name = null, type = 'bullet', damage = 0, pierce = 0, maxStack = 99) {
        super(name);
        this.package(new MaxStack(maxStack), new AmmoStats(type, damage, pierce));
        this.addTag('ammo');
        this.meta.category = 'ammo';
    }
    getAmmoType() { const a = this.get('ammoStats'); return a ? a.type : null; }
}

/** Thrown on use: grenades, throwing knives, bombs.
 *  new Throwable(name, damage, radius, speed, fuse, maxStack) */
class Throwable extends Item {
    static TYPE = 'throwable';
    constructor(name = null, damage = 1, radius = 0, speed = 12, fuse = 0, maxStack = 16) {
        super(name);
        this.package(new MaxStack(maxStack), new Thrown(damage, radius, speed, fuse));
        this.addTag('throwable');
        this.meta.category = 'throwable';
    }
    /** Returns { thrown, shot } — shot = { damage, radius, speed, fuse, consumesItem }. */
    throwIt(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'throw' });
        return { thrown: !r.cancelled && !!r.hooks.thrown, shot: r.hooks.thrown ?? null, result: r };
    }
}

/** Opens locks ('any' fits everything).   new Key(name, lock) */
class Key extends Item {
    static TYPE = 'key';
    constructor(name = null, lock = 'any') {
        super(name);
        this.package(new MaxStack(1), new Unlocks(lock));
        this.addTag('key');
        this.meta.category = 'key';
    }
    opens(lock) { const k = this.get('unlocks'); return !!k && k.opens(lock); }
}

/** Money. Stacks high and carries a Value.   new Currency(name, amount, maxStack) */
class Currency extends Item {
    static TYPE = 'currency';
    constructor(name = null, amount = 1, maxStack = 9999, currency = 'coin') {
        super(name);
        this.package(new MaxStack(maxStack), new Value(amount, currency));
        this.addTag('currency');
        this.meta.category = 'currency';
    }
}

/** Story / quest objects. Can't be dropped or sold by default (meta flags for your game to read).
 *  new QuestItem(name, rarity) */
class QuestItem extends Item {
    static TYPE = 'quest';
    constructor(name = null, rarity = 'rare') {
        super(name);
        this.package(new MaxStack(1), new Rarity(rarity), new Glint(true));
        this.addTag('quest');
        Object.assign(this.meta, { category: 'quest', droppable: false, sellable: false });
    }
}

/**
 * A learnable / equippable ability. Fits the Inventory's `skills` container.
 *
 *   //        name    passive fn                                   useCondition
 *   new Skill('regen', true,
 *       (item, target, deltaTime) => { target.health += 5 * deltaTime; },   // fn (5 health per second)
 *       (item, target) => target.health < target.maxHealth,                 // useCondition
 *       0, 'mana', 1, null, 0, 60);                       // cost costType power element range cooldown(ticks)
 *
 *   skill.cast(player)            use it by hand (useCondition and cooldown still apply)
 *   skill.activate(player)        a passive skill now uses itself on every item.tick()
 *   Skill.tickSkills(inv, player) activates + ticks every skill in inv.skills (call once per game tick)
 *
 * `target` in fn / useCondition is always the object that is using the skill. A passive
 * skill only runs fn when its cooldown is ready, so use cooldown 0 for an effect that should
 * run every tick (scale it by deltaTime), or a longer cooldown for a pulse every so often.
 */
class Skill extends Item {
    static TYPE = 'skill';
    constructor(name = null, passive = false, fn = null, useCondition = null, cost = 0, costType = 'mana',
                power = 1, element = null, range = 0, cooldown = 30) {
        super(name);
        this.package(new MaxStack(1),
                     new Ability(passive, fn, useCondition, cost, costType, power, element, range),
                     new Cooldown(cooldown));
        this.addTag('skill');
        this.meta.category = 'skill';
    }
    get ability()  { return this.get('ability'); }
    /** true = the skill uses itself automatically while active. */
    get passive()  { const s = this.ability; return !!s && s.passive; }
    set passive(v) { const s = this.ability; if (s) s.passive = !!v; }
    get active()   { const s = this.ability; return !!s && s.active; }

    /** Turn the skill on for `user`. A passive skill then fires from item.tick(). */
    activate(user = null) { const s = this.ability; if (s) s.activate(user); return this; }
    deactivate()          { const s = this.ability; if (s) s.deactivate();   return this; }

    /** true when cast(user) would work right now (condition, cooldown, durability...). */
    canCast(user = null, ctx = {}) { return this.checkUse(user, null, { ...ctx, action: 'cast' }) === null; }

    /**
     * Use the skill. `user` is the object using it; it is what fn / useCondition receive as `target`.
     * Returns { cast, reason, spell, value, result }:
     *   spell = { cost, costType, power, element, range, castTicks, passive },  value = what fn returned
     */
    cast(user = null, target = null, ctx = {}) {
        const r = this.use(user, target, { ...ctx, action: 'cast' });
        const spell = r.hooks.ability ?? null;
        return { cast: !r.cancelled && !!spell, reason: r.reason, spell, value: spell ? spell.result : undefined, result: r };
    }

    /**
     * Per-tick helper for a character's skills container: every skill in inventory.skills
     * belongs to `owner`, passive ones are switched on, and all of them are ticked.
     */
    static tickSkills(inventory, owner, dt = Item._defaultDelta()) {
        if (!inventory || !inventory.skills) return;
        for (let i = 1; i <= inventory.skills.slots; i++) {
            const e = inventory.skills[i];
            const item = e && e.item;
            if (!(item instanceof Skill)) continue;
            const a = item.ability;
            if (a && ((a.passive && !a.active) || (a.active && !a.user))) item.activate(owner);
            item.tick(dt);
        }
    }
}


/* =====================================================================
 * CONCRETE SUBCLASSES
 * Each one is its category with different default values and extra tags.
 * ===================================================================== */

/* ---------- Melee weapons:  (name, damage, speed, reach, knockback, durability) ---------- */

class Sword extends Weapon {
    static TYPE = 'sword';
    constructor(name = null, damage = 6, speed = 4, reach = 3, knockback = 0, durability = 250) {
        super(name, damage, speed, reach, knockback, durability);
        this.addTag('sword', 'melee');
    }
}
class Dagger extends Weapon {
    static TYPE = 'dagger';
    constructor(name = null, damage = 3, speed = 8, reach = 1.5, knockback = 0, durability = 150) {
        super(name, damage, speed, reach, knockback, durability);
        this.addTag('dagger', 'melee');
    }
}
class Spear extends Weapon {
    static TYPE = 'spear';
    constructor(name = null, damage = 5, speed = 3, reach = 5, knockback = 2, durability = 200) {
        super(name, damage, speed, reach, knockback, durability);
        this.addTag('spear', 'melee');
    }
}

/* ---------- Ranged weapons:  (name, damage, speed, projectile, spread, range, ammoType, durability) ---------- */

class Bow extends RangedWeapon {
    static TYPE = 'bow';
    constructor(name = null, damage = 5, speed = 25, projectile = 'arrow', spread = 1, range = 800,
                ammoType = 'arrow', durability = 300, cooldown = 20) {
        super(name, damage, speed, projectile, spread, range, ammoType, durability);
        this.package(new Cooldown(cooldown));
        this.addTag('bow');
    }
}
class Staff extends RangedWeapon {
    static TYPE = 'staff';
    constructor(name = null, damage = 6, speed = 18, projectile = 'bolt', spread = 0, range = 500,
                ammoType = null, durability = 200, cooldown = 30) {
        super(name, damage, speed, projectile, spread, range, ammoType, durability);   // no ammoType: uses no ammo
        this.package(new Cooldown(cooldown), new Enchantable());
        this.addTag('staff', 'magic');
    }
}

/**
 * Gun — a firearm with semi / full-auto / burst fire, a magazine plus reserve
 * ammo, reloading, attachments and real bullet objects (gameObjects) that fall
 * off in damage with distance. Stats live in the Firearm component.
 *
 *   const m4 = new Gun('m4', 15, 600, 150, 16, 2, 1, 1, 3.5, 30, 120, { x: 12, y: 7 });
 *   //               name dmg rng vel  rate type burst burstTime reload mag ammo bulletSize
 *   // A gun doesn't wear out unless you give it one: m4.package(new Durability(500))
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
 * gun.damage, gun.ammo, gun._mag, gun.fireType... read and write the Firearm component.
 *
 * settings (all optional):
 *   aim(gun, owner) -> {x, y}   point to shoot at (or pass { aim } / { angle } to shoot())
 *   ignore(other, bullet)       true = bullets pass through `other` (e.g. the owner's melee box)
 *   friendlyFire, friendlyDamage (multiplier), friendlyMinDist (px a bullet must fly before it can hit the owner)
 *   damageDisplay               array handed to applyDamage(amount, damageDisplay)
 */
class Gun extends Item {
    static TYPE = 'gun';

    /** Every bullet object that is in flight (shared by all guns). */
    static bullets = [];

    constructor(name = null, damage = 10, range = 600, velocity = 150, firerate = 5, fireType = 1, burst = 1,
                burstTime = 0.1, reloadTime = 2, mag = 30, ammo = null, a = null, ammoType = null) {
        super(name);
        this.package(new MaxStack(1),
                     new Firearm(damage, range, velocity, firerate, fireType, burst, burstTime,
                                 reloadTime, mag, ammo, a, ammoType));
        this.addTag('weapon', 'ranged', 'gun', 'firearm');
        Object.assign(this.meta, { category: 'combat', slot: 'mainhand' });
    }

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

/* ---------- Tools:  (name, tier, speed, durability, effective, damage) ---------- */

class Pickaxe extends Tool {
    static TYPE = 'pickaxe';
    constructor(name = null, tier = 1, speed = 2, durability = 200, effective = ['stone', 'ore'], damage = 2) {
        super(name, tier, speed, durability, effective, damage);
        this.get('mining').classes = ['pickaxe'];
        this.addTag('pickaxe', 'mining');
    }
}
class Axe extends Tool {
    static TYPE = 'axe';
    constructor(name = null, tier = 1, speed = 2, durability = 200, effective = ['wood'], damage = 7) {
        super(name, tier, speed, durability, effective, damage);
        this.get('mining').classes = ['axe'];
        this.addTag('axe', 'mining', 'weapon');
    }
}
class Shovel extends Tool {
    static TYPE = 'shovel';
    constructor(name = null, tier = 1, speed = 2, durability = 200, effective = ['dirt', 'sand', 'gravel'], damage = 2) {
        super(name, tier, speed, durability, effective, damage);
        this.get('mining').classes = ['shovel'];
        this.addTag('shovel', 'mining');
    }
}
class Hoe extends Tool {
    static TYPE = 'hoe';
    constructor(name = null, tier = 1, speed = 1, durability = 150, effective = ['dirt', 'grass'], damage = 1) {
        super(name, tier, speed, durability, effective, damage);
        this.get('mining').classes = ['hoe'];
        this.addTag('hoe', 'farming');
    }
}

/* ---------- Armor:  (name, defense, toughness, durability, slot) ---------- */

class Helmet extends Armor {
    static TYPE = 'helmet';
    constructor(name = null, defense = 2, toughness = 0, durability = 200, slot = 'head') {
        super(name, defense, toughness, durability, slot);
        this.addTag('helmet');
    }
}
class Chestplate extends Armor {
    static TYPE = 'chestplate';
    constructor(name = null, defense = 5, toughness = 0, durability = 200, slot = 'chest') {
        super(name, defense, toughness, durability, slot);
        this.addTag('chestplate');
    }
}
class Leggings extends Armor {
    static TYPE = 'leggings';
    constructor(name = null, defense = 4, toughness = 0, durability = 200, slot = 'legs') {
        super(name, defense, toughness, durability, slot);
        this.addTag('leggings');
    }
}
class Boots extends Armor {
    static TYPE = 'boots';
    constructor(name = null, defense = 2, toughness = 0, durability = 200, slot = 'feet') {
        super(name, defense, toughness, durability, slot);
        this.addTag('boots');
    }
}
class Shield extends Armor {
    static TYPE = 'shield';
    constructor(name = null, defense = 3, toughness = 0, durability = 336, slot = 'offhand') {
        super(name, defense, toughness, durability, slot);
        this.addTag('shield');
    }
}

/* ---------- Accessories:  (name, rarity, slot) ---------- */

class Ring extends Accessory {
    static TYPE = 'ring';
    constructor(name = null, rarity = 'uncommon', slot = 'accessory') { super(name, rarity, slot); this.addTag('ring'); }
}
class Amulet extends Accessory {
    static TYPE = 'amulet';
    constructor(name = null, rarity = 'uncommon', slot = 'accessory') { super(name, rarity, slot); this.addTag('amulet'); }
}

/* ---------- Consumables:  (name, hunger, saturation, health, effects, duration) ---------- */

class Food extends Consumable {
    static TYPE = 'food';
    constructor(name = null, hunger = 4, saturation = 2, health = 0, effects = [], duration = 0) {
        super(name, hunger, saturation, health, effects, duration);
        this.addTag('food');
        this.meta.category = 'food';
    }
}
class Potion extends Consumable {
    static TYPE = 'potion';
    constructor(name = null, hunger = 0, saturation = 0, health = 0, effects = [], duration = 10) {
        super(name, hunger, saturation, health, effects, duration);
        this.get('consume').animation = 'drink';
        this.get('maxStack').size = 8;
        this.addTag('potion', 'magic');
        this.meta.category = 'potion';
    }
}
class Scroll extends Consumable {
    static TYPE = 'scroll';
    constructor(name = null, hunger = 0, saturation = 0, health = 0, effects = [], duration = 0) {
        super(name, hunger, saturation, health, effects, duration);
        this.get('consume').animation = 'read';
        this.get('maxStack').size = 8;
        this.package(new Rarity('uncommon'));
        this.addTag('scroll', 'magic');
        this.meta.category = 'scroll';
    }
}

/* ---------- Placeables:  (name, width, height, color, solid, static, resolve, pushable, scenes) ---------- */

class Block extends Placeable {
    static TYPE = 'block';
    constructor(name = null, width = 40, height = 40, color = '#8d8d8d', solid = true, isStatic = true,
                resolve = true, pushable = false, scenes = []) {
        super(name, width, height, color, solid, isStatic, resolve, pushable, scenes);
        this.addTag('block');
    }
}

/** Placed crafting station. After placing, obj.meta.crafting = { recipes, open() } (recipes from item.meta.recipes). */
class Workbench extends Placeable {
    static TYPE = 'workbench';
    constructor(name = null, width = 50, height = 50, color = '#8a5a2b', solid = true, isStatic = true,
                resolve = true, pushable = false, scenes = []) {
        super(name, width, height, color, solid, isStatic, resolve, pushable, scenes);
        this.get('maxStack').size = 16;
        this.addTag('workbench', 'station');
        Object.assign(this.meta, { category: 'station', recipes: [] });
    }
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
    constructor(name = null, width = 60, height = 60, color = '#b08850', solid = false, isStatic = true,
                resolve = false, pushable = false, scenes = []) {
        super(name, width, height, color, solid, isStatic, resolve, pushable, scenes);
        this.addTag('furniture');
        this.meta.category = 'furniture';
    }
}

/** Placed storage: the object gets obj.meta.inventory (an Inventory).
 *  new Chest(name, slots, width, height, color, locked) */
class Chest extends Placeable {
    static TYPE = 'chest';
    constructor(name = null, slots = 18, width = 40, height = 32, color = '#a06a2c', locked = false) {
        super(name, width, height, color, true, true, true, false);
        this.get('maxStack').size = 16;
        this.package(new Container(slots, locked));
        this.addTag('chest', 'container');
        this.meta.category = 'container';
    }
}

/** A light source you can walk through.   new Torch(name, lightRadius, lightColor, width, height) */
class Torch extends Placeable {
    static TYPE = 'torch';
    constructor(name = null, lightRadius = 140, lightColor = '#ffd27a', width = 8, height = 28) {
        super(name, width, height, '#ffb347', false, true, false, false);
        this.get('placement').anchor = 'bottom';
        this.package(new Light(lightRadius, lightColor));
        this.addTag('torch', 'light');
        this.meta.category = 'light';
    }
    handlePlace(obj) {
        const l = this.get('light');
        if (l) obj.meta.light = l.toJSON();
    }
}

/** Placed door. obj.meta.toggle() opens / closes it (an open door isn't solid). */
class Door extends Placeable {
    static TYPE = 'door';
    constructor(name = null, width = 20, height = 80, color = '#7a4f24') {
        super(name, width, height, color, true, true, true, false);
        this.get('placement').anchor = 'bottom';
        this.get('maxStack').size = 16;
        this.addTag('door');
        this.meta.category = 'door';
    }
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

/** Planted on soil. The Plantable component says what grows from it.   new Seed(name, crop, growTicks, soil) */
class Seed extends Placeable {
    static TYPE = 'seed';
    constructor(name = null, crop = null, growTicks = 600, soil = ['dirt']) {
        super(name, 10, 10, '#6bbf59', false, true, false, false);
        this.get('placement').anchor = 'bottom';
        this.package(new Plantable(crop, growTicks, soil));
        this.addTag('seed', 'farming');
        this.meta.category = 'seed';
    }
    handlePlace(obj) {
        const p = this.get('plantable');
        if (p) obj.meta.plant = { crop: p.crop, growTicks: p.growTicks, age: 0, soil: [...p.soil] };
    }
}

/* ---------- Ammo / throwables / money / skills ---------- */

class Arrow extends Ammo {
    static TYPE = 'arrow';
    constructor(name = null, type = 'arrow', damage = 1, pierce = 0, maxStack = 99) {
        super(name, type, damage, pierce, maxStack);
        this.addTag('arrow');
    }
}
class Bullet extends Ammo {
    static TYPE = 'bullet';
    constructor(name = null, type = 'bullet', damage = 1, pierce = 0, maxStack = 200) {
        super(name, type, damage, pierce, maxStack);
        this.addTag('bullet');
    }
}
class Grenade extends Throwable {
    static TYPE = 'grenade';
    constructor(name = null, damage = 20, radius = 80, speed = 10, fuse = 90, maxStack = 16) {
        super(name, damage, radius, speed, fuse, maxStack);
        this.addTag('grenade', 'explosive');
    }
}
class Coin extends Currency {
    static TYPE = 'coin';
    constructor(name = null, amount = 1, maxStack = 9999) {
        super(name, amount, maxStack, 'coin');
        this.addTag('coin');
    }
}
class Spell extends Skill {
    static TYPE = 'spell';
    constructor(name = null, passive = false, fn = null, useCondition = null, cost = 10, costType = 'mana',
                power = 5, element = null, range = 0, cooldown = 45) {
        super(name, passive, fn, useCondition, cost, costType, power, element, range, cooldown);
        this.addTag('spell', 'magic');
    }
}


/* =====================================================================
 * REGISTRATION
 * Built-in components and item types are registered here. Your own register
 * themselves the first time they are used, or call ItemComponent.register(MyComponent)
 * / Item.registerClass(MyItem) up front (needed before Item.fromJSON / Item.create
 * meets one that hasn't been built yet).
 * ===================================================================== */
[
    Durability, OnUse, MaxStack, Cooldown, Consume, Attack, Mining, Ranged, Firearm, AmmoStats,
    Thrown, Ability, Equippable, Protection, Enchantable, Glint, Lore, Rarity, Value, Fuel,
    Unlocks, Light, Plantable, Container, Placement,
].forEach(cls => ItemComponent.register(cls));

[
    Item,
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
].forEach(cls => Item.registerClass(cls.TYPE ?? 'item', cls));
