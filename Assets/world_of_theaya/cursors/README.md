# World of Theaya cursors

Custom mouse cursors in the game's style: earthy wood, iron, gold and leaf colors, with dark outlines like the item icons. Each one has a soft drop shadow so it stays visible on dark panels, grass, sand and light backgrounds (see `preview.png`).

`world_of_theaya.js` uses them through its `Cursor` module (section 3a, "Mouse cursors"). That module keeps its own copy of the hotspots, so if you move a hotspot, change it there too.

| Folder | Contents |
| --- | --- |
| `svg/` | Vector sources (32×32 viewBox). Edit these. |
| `24/` | 24×24 PNGs, the size the game uses (`Cursor.size` in `world_of_theaya.js`). |
| `48/` | 48×48 PNGs: the 24 px cursors for high-DPI screens. |
| `32/` | 32×32 PNGs, the standard cursor size. |
| `64/` | 64×64 PNGs: the 32 px cursors for high-DPI screens. |
| `cursors.json` | Each cursor's hotspot at every size, and what it is meant for. |
| `preview.png` | All cursors on the four test backgrounds. |

## Cursors and hotspots (32 px; at 24 px they are ¾ of these, rounded)

The hotspot is the pixel that does the clicking.

| Cursor | Hotspot | Intended use |
| --- | --- | --- |
| `cursor_default` | 3, 3 | Normal pointer: a carved wooden arrow |
| `cursor_pointer` | 12, 2 | Over a button, item slot or anything clickable: a gloved hand with a green cuff |
| `cursor_grab` | 16, 14 | Dragging an item stack in the inventory: a closed glove |
| `cursor_mine` | 4, 5 | Over a block the held pickaxe can mine |
| `cursor_attack` | 3, 3 | Over a creature you can attack with a weapon |
| `cursor_chop` | 3, 8 | Over a tree or wood block while holding an axe |
| `cursor_farm` | 3, 13 | Over ground you can till or plant (hoe or seeds) |
| `cursor_build` | 5, 15 | Placing a block |
| `cursor_aim` | 16, 16 | Aiming a ranged weapon |
| `cursor_wait` | 16, 16 | Loading, saving or busy |
| `cursor_blocked` | 16, 16 | Not allowed (out of reach, wrong tool, full inventory) |
| `cursor_text` | 16, 16 | Over a text box |
