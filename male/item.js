// ============================================================
// item.js
// ------------------------------------------------------------
// Item component system. Items are plain data bags with
// named components (durability, onUse, ...). Each component
// can be an executable function or a config object.
//
// Item format:
//   components: {
//     <id>: {
//       <values...>,
//       exe: <function>
//     },
//     ...
//   }
// ============================================================

class Item {
    static init() {
        Item.components = {
            /**
             * Adds a durability component. The returned object's
             * exe(amount) decrements durability and sets isBroken
             * to true once it hits 0.
             */
            durability: (self) => {
                self.durability = {
                    max: 1,
                    value: 1,
                    exe: (v) => {
                        // FIX: original had "nubmer" typo, which made
                        // every call fall through to returning the value
                        // without ever applying damage.
                        if (typeof v != 'number') return self.durability.value;
                        let dur = self.durability.value - v;
                        self.durability.value = limit(dur, 0, self.durability.max);
                        if (dur <= 0) self.isBroken = true;
                        return self.durability.value;
                    }
                };
                if (self.components.onUse) {
                    self.components.onUse.exeList.push('durability');
                }
                self.isBroken = false;
                return self.durability;
            },

            /**
             * Registers an onUse component. `trigger` can be a
             * function, or a bind string like 'default@use'.
             * Extra arguments are executable names to run.
             */
            onUse: (self, trigger, ...exes) => {
                switch (typeof trigger) {
                    case 'function': break; // valid
                    case 'string':   break; // valid
                    default: trigger = 'defualt@use';
                }
                self.components.onUse = {
                    exeList: [...exes],
                    // triggers:
                    //   function : (self) => {}
                    //   bind     : '<domain>@<control>:<attribute>[...]'
                    trigger,
                };
            }
        };
    }

    constructor() {
        // Intentionally empty - Item is a data container that
        // gets its components attached by factory code.
    }
}