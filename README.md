# Polyreme

An 8th-century BC Mediterranean trading game — a spiritual blend of FTL and
Tradewinds. Building a game with John Kieran, Brady, and Fable.

## Run it

No build step. Open `index.html` in any browser, or serve the folder:

```
python -m http.server 8000
```

then visit http://localhost:8000.

## Dev notes

- Vanilla JS + HTML5 canvas, classic script tags (no modules, works from `file://`).
- Renders at a virtual 480x270 and integer-scales up for crisp pixels.
- All text uses the built-in pixel font in `js/pixelfont.js`.
- Colors live in `js/palette.js`; shared scenery painting in `js/seascape.js`.
- Scenes are classes with `update(dt, t)` / `draw(ctx, t)`, managed by `Scenes` in `js/main.js`.
- World data (cities, routes, services) in `js/world.js`; run state, economy,
  and event randomization in `js/state.js`; buttons/icons/resource bar in `js/ui.js`.
- 3/4-view deck (top-down plan with visible hull depth, y-sorted uprights,
  FTL/RimWorld-style) in `js/deck.js` — layout is built from upgrades.
  Pawns, skills, and orders in `js/crew.js`; enemies and stories in
  `js/encounters.js`; chiptune engine in `js/music.js` (N mutes).
- Run structure (hometown, villain march, boss year) is tunable at the top of
  `js/state.js`; run bookends (naming, intro, victory) in `js/startScenes.js`.
- Debug: `index.html?scene=port|port2|map|depart|voyage|combat|combatmed|story|
  death|name|intro|victory|boss` or a port panel
  (`market|dock|shipwright|tavern|temple|barracks|ship`).
