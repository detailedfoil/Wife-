# Shore layout: how it works and how to add new things

The things you place on the shore ("For the shore" in the shop) each have a fixed spot. They are laid out so
**all of them can be out at once** without touching, and the home camera **steps back by itself** to fit
whatever is out. This folder has the tools used to design that layout, so new cosmetics can be added
without starting over.

## Where things live in the code

- `norppa/js/data.js`, `DECOR`: the list of shore items (id, name, price, category). `swap` = two items share one
  place (only fairy lights / bunting). `hidden: true` = the sauna, always out.
- `norppa/js/world.js`
  - `SPOTS`: `id: [x, z, turn]` for every free-standing item. Grouped by zone, with comments.
  - `ON_DEN`: items that sit on the den itself (rugs, cushions, curtain, candles, balloons, torches, lantern, stool),
    in the den's own space. These overlap on purpose (rug under, curtain on the door) and are not part of the layout puzzle.
  - `landD()`: the land. A straight near shore plus three ellipses: `d2` the den's wooded point (left back),
    `d3` the sauna island (back), `d4` the little headland on the right (the camp).
  - Tree list in `buildLand` (`tree(...)`), and the boulders just after it.
  - `AVOID`: places poo will not land (items near the seal's home spot).
  - Camera: `solveFit()` and `updateCamera()`, see below.
- Fixed spots that the layout works around: seal home `W.HOME` (0.15, 0.3), den `W.DEN` (-2.45, -3.2),
  fishing hole `W.HOLE` (2, -2.9), ball `W.BALL` (-0.95, 1.35).

## Coordinates

The camera looks south across the lake, toward **-z**. **+x is right**, **+z is toward the camera**.
`turn` is three.js `rotation.y` (radians). Local item +z maps to world (sin turn, cos turn).

## The zones (current design)

| Zone | Roughly | What goes there |
|---|---|---|
| Front porch | z 1.5 to 5, x -3.5 to 3.5 | small, low things only (they must not hide the seal) |
| Left of the door | z -1.5 to 2, x -4.5 to -2.5 | snowman, bird table, squirrel |
| Den's wooded point | z -4.5 to -9, x -6 to -1.5 | tall things are fine here: tree, flag, star, reindeer, hare |
| Right headland | z -1.5 to -8, x 3.3 to 7.7 | the camp: campfire, tent |
| Lake | z -4.5 to -11, x -3.5 to 5 | low things only: ice heart, snow seal, sled, swan, ice fishing, boat |
| Sauna island | z -10 to -15.8, x -3.3 to 7.7 | sauna, hot tub, snow castle, jetty, otter (the tall things are at the back) |

Rules of thumb that came out of testing:

- **Portrait phones are the tight case.** The view is a wedge: narrow at the front, wider further back. At the
  full wide view the usable half-width is about 2.9 at z = 4, 3.9 at z = 0, 4.6 at z = -3, 5.3 at z = -6,
  5.9 at z = -9, 6.6 at z = -12. Anything wider makes the camera back off further.
- **Tall things hide what is behind them.** At the wide angle (about 32 degrees down) an item of height h hides
  about 1.6 x h of ground behind it. Put tall things at the back or the sides. The balloons on the den hide a
  strip behind the den (x about -2 to -3), so do not put small things there.
- Items whose centre is on the lake (`!W.isLand`) are **hidden when the ice melts** unless the prop returns
  `float: true` (boat, swan, jetty). Put things that should show all year on land.
- Items with z > -2.5 are "front" and are **hidden during mini-games** (`W.stage`).
- If you add an item near the seal's home spot, add it to `AVOID` too.

## The camera (auto zoom)

`solveFit()` takes the bounding box corners of every visible placed item (not the sauna, which is always there;
the top quarter of tall items may slip under the top bar), and finds the distance at which they all fit inside the
part of the screen not covered by the HUD (`lim`, separate values for portrait and landscape), centred. As it backs
off it also tilts down (`el` boost: up to +0.45 rad portrait, +0.2 landscape), which makes the shore read like a model.
It is recomputed only when what is visible, the screen shape or the seal's size changes.

`cam.zoom` is a share of that wide view: 1 = everything in frame (double-tap resets to it). Pinching in goes all the
way to the old close-up on the seal (`zoomMin`), and the aim slides from the middle of the shore to the seal as you
zoom in (`cam.t`, 0 = close-up, 1 = wide). Shadows widen and fog thins as `cam.t` grows. Orbit is +-1.35 rad sideways.

## Adding new shore items: the workflow

1. Add the item to `DECOR` in `data.js` and its model to `props.js` as usual.
2. Serve the repo: `python3 -m http.server 8123 --bind 127.0.0.1` (from the repo root).
3. `node tools/shore-layout/measure.js` to refresh `feet.json` (every item's footprint).
4. Give the new item a spot in `layout.json` (`spots`), and `"where": "land"` or `"ice"` if it matters.
   You can move trees (`trees`, last 7 are the far ones and are left alone), boulders (`rocks`) and the land
   ellipses (`land.ell`, in the order den point, island, headland) too.
5. `python3 tools/shore-layout/planner.py tools/shore-layout/layout.json` lists every clash (item x item, item x
   tree, item x den / hole / seal / the seal's paths) and draws `plan.png`. Add
   `CAM="24,0.565,0.4,0.6,-4,0.462,58"` in front to draw the portrait view wedge on the plan
   (dist, tilt, aim x/y/z, aspect, fov). `matto x DOOR` is expected (the rug lies under the seal on her path).
6. Add the new id to a group in `SPOTS` in `world.js` (any numbers; the next step fills them in), then
   `python3 tools/shore-layout/apply_layout.py tools/shore-layout/layout.json norppa/js/world.js`
   writes every spot, the land ellipses, the near trees and the boulders into `world.js`.
7. `node tools/shore-layout/shots.js 390x844,844x390,768x1024` puts everything out and screenshots the auto-framed
   view into `shots/`. Look for anything hidden behind something taller, and anything that looks odd.
8. Bump `CACHE` in `norppa/sw.js` and `PN.UPDATED` in `data.js`, then ship.

If there are too many things to fit nicely one day, a cap on how many can be out at once is the fallback.
detailedfoil's call was to only add a cap if the full shore looks bad.
