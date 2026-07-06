// The deck in 3/4 view — the plan is top-down (that's where the pawns walk),
// but the ship has depth: hull sides drop to the waterline, the mast rises
// with a hanging sail, stations stand upright, and everything on deck is
// y-sorted so nearer things overlap farther ones. Local coordinates: bow
// points right, DECK.W x DECK.H, drawn at a per-scene origin.

let DECK = null;
let _deckKey = null;

// Deck size per hull level: the skiff is a big canoe; every hull after is
// noticeably longer and broader in the beam.
const HULL_SIZES = [[112, 42], [160, 60], [204, 72], [240, 80]];

// Hull footprint segments [x, y, w, h, sideDepth] for a hull W long and H
// abeam — floor plan plus how far each segment's side drops to the water.
// Small hulls get a stubbier bow.
function hullSegs(W, H) {
  const cy = Math.round(H / 2);
  if (H < 50) {
    return [
      [8, 6, W - 38, H - 12, 9],
      [4, 12, 6, H - 24, 7],
      [W - 30, 10, 10, H - 20, 8],
      [W - 20, 14, 8, H - 28, 6],
      [W - 12, cy - 5, 8, 10, 5],
    ];
  }
  return [
    [10, 6, W - 52, H - 12, 12],
    [4, 14, 10, H - 28, 9],
    [W - 42, 10, 12, H - 20, 10],
    [W - 30, 16, 10, H - 32, 8],
    [W - 20, 24, 8, H - 48, 7],
    [W - 12, cy - 6, 6, 12, 5],
  ];
}

function buildDeck() {
  const hull = Game.upgrades.hull;
  const key = [hull, Game.upgrades.archers, Game.modules.join(",")].join("|");
  if (DECK && _deckKey === key) return;
  _deckKey = key;

  const [W, H] = HULL_SIZES[Math.min(hull, HULL_SIZES.length - 1)];
  const cy = Math.round(H / 2);

  const stations = [];
  stations.push({ id: "helm", name: "HELM", x: 14, y: cy - 7, w: 14, h: 14, skill: "sailing", cap: 1 });
  stations.push({ id: "mast", name: "SAILS", x: Math.round(W / 2) - 5, y: cy - 7, w: 14, h: 14, skill: "sailing", cap: 1 });
  // The archer post: a two-man stand on small hulls, a four-man platform later.
  if (Game.archerCap >= 4) {
    stations.push({ id: "archers", name: "ARCHER POST", x: W - 62, y: cy - 14, w: 28, h: 28, skill: "arms", cap: 4, weapon: "archers" });
  } else {
    stations.push({ id: "archers", name: "ARCHER POST", x: W - 40, y: cy - 7, w: 20, h: 14, skill: "arms", cap: 2, weapon: "archers" });
  }

  // One pair of benches per oar row, laid between the quarters and the mast.
  for (let i = 0; i < Game.oarsLevel; i++) {
    stations.push({ id: "benchT" + i, name: "OAR BENCH", x: 62 + i * 16, y: 8, w: 12, h: 9, bench: true, cap: 1 });
    stations.push({ id: "benchB" + i, name: "OAR BENCH", x: 62 + i * 16, y: H - 17, w: 12, h: 9, bench: true, cap: 1 });
  }

  // Module mounts, one per hull level, tucked clear of the working deck:
  // stern-port corner, then forward of the mast, then the foredeck.
  const MOUNT_AT = [
    { x: 16, y: H - 20 },
    { x: Math.round(W / 2) + 12, y: 8 },
    { x: W - 78, y: cy - 7 },
  ];
  const mounts = [];
  for (let i = 0; i < Game.slots && i < MOUNT_AT.length; i++) {
    const pos = MOUNT_AT[i];
    const mod = Game.modules[i];
    if (mod) {
      const st = {
        id: "mod" + i, name: MODULES[mod].name, module: mod,
        x: pos.x, y: pos.y, w: 14, h: 14, cap: 1,
      };
      if (MODULE_WEAPONS[mod]) { st.skill = "arms"; st.weapon = mod; }
      stations.push(st);
    } else {
      mounts.push({ x: pos.x, y: pos.y, w: 14, h: 14 });
    }
  }

  const fw = hull >= 1 ? 24 : 14, fh = hull >= 1 ? 12 : 9;
  DECK = {
    W, H, cy,
    segs: hullSegs(W, H),
    stations,
    emptyMounts: mounts,
    quarters: { x: 32, y: 8, w: fw, h: fh },
    cargo: { x: 32, y: H - 8 - fh, w: fw, h: fh },
  };
}

// Walkable = anywhere on the hull footprint, a hair in from the rails.
function deckWalkable(x, y) {
  if (!DECK) buildDeck();
  for (const [sx, sy, sw, sh] of DECK.segs) {
    if (x >= sx + 2 && x < sx + sw - 2 && y >= sy + 2 && y < sy + sh - 2) return true;
  }
  return false;
}

function stationCenter(st) {
  return { x: st.x + st.w / 2, y: st.y + st.h / 2 };
}

// --- The flat pass: hull sides, deck floor, tiles. ---

function drawDeckShip(ctx, ox, oy, t, opts) {
  opts = opts || {};
  buildDeck();
  ox = Math.round(ox); oy = Math.round(oy);
  const W = DECK.W, H = DECK.H;

  // Shadow on the water below the near side
  ctx.fillStyle = PAL.seaDeep;
  ctx.fillRect(ox + 8, oy + H + 8, W - 24, 4);
  ctx.fillRect(ox + W - 36, oy + H - 4, 30, 4);

  // Hull sides dropping to the waterline (drawn segment by segment)
  for (const [x, y, w, h, d] of DECK.segs) {
    const top = oy + y + h + 2;
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(ox + x, top, w, d);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(ox + x, top + 2, w, 1);
    ctx.fillRect(ox + x, top + d - 2, w, 2);
    // Waterline foam
    ctx.fillStyle = PAL.seaFoam;
    ctx.fillRect(ox + x, top + d, w, 1);
  }

  // Deck floor: gunwale ring then planking
  const hull = (grow, color) => {
    ctx.fillStyle = color;
    for (const [x, y, w, h] of DECK.segs) {
      ctx.fillRect(ox + x - grow, oy + y - grow, w + grow * 2, h + grow * 2);
    }
  };
  hull(2, PAL.hullDark);
  hull(0, PAL.hullLight);

  // Far rail: a taller dark lip along the top edges for depth
  ctx.fillStyle = PAL.hullDark;
  for (const i of [0, 2, 3, 4]) {
    const [x, y, w] = DECK.segs[i];
    ctx.fillRect(ox + x - 2, oy + y - 3, w + 4, 4);
  }

  // Plank seams
  ctx.fillStyle = PAL.hull;
  for (let y = 14; y < H - 8; y += 8) {
    ctx.fillRect(ox + 8, oy + y, W - 34, 1);
  }
  // The painted eye on the bow side, watching the waves
  const eyeY = H < 50 ? H - 13 : H - 21;
  ctx.fillStyle = PAL.eyeWhite;
  ctx.fillRect(ox + W - 20, oy + eyeY, 6, 4);
  ctx.fillStyle = PAL.eyeDark;
  ctx.fillRect(ox + W - 18, oy + eyeY + 1, 2, 2);

  // Quarters bedrolls and cargo hatch (flat furnishings)
  const q = DECK.quarters;
  ctx.fillStyle = PAL.hull;
  ctx.fillRect(ox + q.x, oy + q.y, q.w, q.h);
  ctx.fillStyle = PAL.sail;
  ctx.fillRect(ox + q.x + 3, oy + q.y + 3, 8, 4);
  ctx.fillRect(ox + q.x + 15, oy + q.y + 6, 8, 4);
  const cg = DECK.cargo;
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(ox + cg.x, oy + cg.y, cg.w, cg.h);
  ctx.fillStyle = PAL.hull;
  for (let i = 1; i < 4; i++) ctx.fillRect(ox + cg.x + i * 6, oy + cg.y + 1, 1, cg.h - 2);
  ctx.fillRect(ox + cg.x + 1, oy + cg.y + 6, cg.w - 2, 1);

  // Station floor plates
  for (const st of DECK.stations) {
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(ox + st.x, oy + st.y, st.w, st.h);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(ox + st.x, oy + st.y, st.w, 1);
    ctx.fillRect(ox + st.x, oy + st.y + st.h - 1, st.w, 1);
    ctx.fillRect(ox + st.x, oy + st.y, 1, st.h);
    ctx.fillRect(ox + st.x + st.w - 1, oy + st.y, 1, st.h);
    if (st.bench) {
      ctx.fillStyle = PAL.hullDark;
      ctx.fillRect(ox + st.x + 2, oy + st.y + Math.floor(st.h / 2) - 1, st.w - 4, 3);
    }
  }
  for (const m of DECK.emptyMounts) {
    ctx.fillStyle = PAL.hullDark;
    for (let i = 0; i < m.w; i += 3) {
      ctx.fillRect(ox + m.x + i, oy + m.y, 2, 1);
      ctx.fillRect(ox + m.x + i, oy + m.y + m.h - 1, 2, 1);
    }
    for (let i = 0; i < m.h; i += 3) {
      ctx.fillRect(ox + m.x, oy + m.y + i, 1, 2);
      ctx.fillRect(ox + m.x + m.w - 1, oy + m.y + i, 1, 2);
    }
  }
}

// --- The upright pass: everything with height, y-sorted with the pawns. ---

function drawDeckUprights(ctx, ox, oy, t, opts) {
  opts = opts || {};
  ox = Math.round(ox); oy = Math.round(oy);
  const items = [];

  for (const st of DECK.stations) {
    const c = stationCenter(st);
    const baseY = st.y + st.h - 2;
    if (st.id === "mast") {
      // Mast, yard, and the sail hanging like a stage backdrop.
      items.push({ y: baseY, f: () => drawMastUpright(ctx, ox + c.x, oy + st.y, t, opts) });
    } else if (st.id === "helm") {
      items.push({ y: baseY, f: () => drawWheelUpright(ctx, ox + c.x, oy + baseY, t) });
    } else if (st.id === "archers") {
      // The arrow rack stands mid-platform; archers cluster around it.
      items.push({ y: c.y + 2, f: () => drawArcherUpright(ctx, ox + c.x, oy + c.y + 4) });
    } else if (st.module === "ballista") {
      items.push({ y: baseY, f: () => drawBallistaUpright(ctx, ox + c.x, oy + baseY) });
    } else if (st.module === "catapult") {
      items.push({ y: baseY, f: () => drawCatapultUpright(ctx, ox + c.x, oy + baseY) });
    } else if (st.module === "greekfire") {
      items.push({ y: baseY, f: () => drawBrazierUpright(ctx, ox + c.x, oy + baseY, t) });
    } else if (st.module === "poseidon" || st.module === "athena") {
      items.push({ y: baseY, f: () => drawShrineUpright(ctx, ox + c.x, oy + baseY, st.module) });
    } else if (st.bench) {
      // Oars: top-row blades reach past the far rail; bottom-row blades
      // sweep across the hull side into the near water.
      const topRow = st.y < 30;
      const stroke = opts.rowing ? Math.round(Math.sin(t * 3) * 3) : 0;
      if (topRow) {
        items.push({ y: st.y - 6, f: () => {
          ctx.fillStyle = PAL.oar;
          ctx.fillRect(ox + c.x - 1 + stroke, oy - 5, 2, 12);
          if (opts.rowing) {
            ctx.fillStyle = PAL.seaFoam;
            ctx.fillRect(ox + c.x - 2 + stroke, oy - 6, 4, 1);
          }
        }});
      } else {
        items.push({ y: 900, f: () => {
          ctx.fillStyle = PAL.oar;
          ctx.fillRect(ox + c.x - 1 - stroke, oy + DECK.H - 8, 2, 17);
          if (opts.rowing) {
            ctx.fillStyle = PAL.seaFoam;
            ctx.fillRect(ox + c.x - 2 - stroke, oy + DECK.H + 9, 4, 1);
          }
        }});
      }
    }
  }

  // Pawns (yours) and any boarders, standing figures sorted by their feet.
  for (const pw of CrewUI.allPawns()) {
    if (pw.x === null || pw.x === undefined) continue;
    const tunic = pw.kind === "merc" ? PAL.red : pw.kind === "rower" ? PAL.sandShade : PAL.seaLight;
    items.push({ y: pw.y, f: () => drawPawnTop(ctx, ox + pw.x, oy + pw.y, t, {
      tunic, walking: pw.walking,
      selected: CrewUI.isSelected(pw),
      hpFrac: pw.hp < pw.hpMax ? pw.hp / pw.hpMax : null,
    })});
  }
  for (const b of (opts.boarders || [])) {
    if (b.hp <= 0) continue;
    items.push({ y: b.y, f: () => drawPawnTop(ctx, ox + b.x, oy + b.y, t, {
      tunic: "#7a2f2f", helmet: true, walking: true,
      hpFrac: b.hp < b.hpMax ? b.hp / b.hpMax : null,
    })});
  }

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();

  // Destination flags for selected pawns still on their way
  for (const sel of CrewUI.sel) {
    if (sel.tx !== null && sel.walking) {
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(Math.round(ox + sel.tx), Math.round(oy + sel.ty) - 5, 1, 5);
      ctx.fillRect(Math.round(ox + sel.tx), Math.round(oy + sel.ty) - 5, 3, 2);
    }
  }
}

function drawMastUpright(ctx, cx, tileY, t, opts) {
  cx = Math.round(cx);
  // A canoe carries a modest sail; bigger hulls spread more cloth.
  const sw = DECK.W < 140 ? 12 : 18; // sail half-width
  // Pole rising from the deck
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(cx - 1, tileY - 24, 3, 30);
  // Yard
  ctx.fillRect(cx - sw - 3, tileY - 24, sw * 2 + 7, 2);
  ctx.fillStyle = PAL.hullLight;
  ctx.fillRect(cx - 1, tileY - 26, 3, 2);
  if (opts.sailFull) {
    const billow = Math.round(Math.sin(t * 1.3) * 2);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PAL.sail;
    ctx.fillRect(cx - sw, tileY - 22, sw * 2 + 1, 15 + billow);
    ctx.fillStyle = PAL.sailShade;
    ctx.fillRect(cx - sw, tileY - 22, 3, 15 + billow);
    ctx.fillStyle = PAL.sailStripe;
    ctx.fillRect(cx - sw, tileY - 14, sw * 2 + 1, 3);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = PAL.sailShade;
    ctx.fillRect(cx - sw - 1, tileY - 23, sw * 2 + 3, 4);
  }
  // Pennant
  ctx.fillStyle = PAL.sailStripe;
  ctx.fillRect(cx + 2, tileY - 29, 4 + Math.round(Math.sin(t * 2) * 2), 2);
}

function drawWheelUpright(ctx, cx, baseY, t) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 2;
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(cx - 1, baseY - 4, 2, 4);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - 3, baseY - 11, 7, 1);
  ctx.fillRect(cx - 3, baseY - 5, 7, 1);
  ctx.fillRect(cx - 4, baseY - 10, 1, 5);
  ctx.fillRect(cx + 3, baseY - 10, 1, 5);
  ctx.fillRect(cx - 1, baseY - 10, 2, 5);
  ctx.fillRect(cx - 3, baseY - 8, 6, 1);
}

function drawArcherUpright(ctx, cx, baseY) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 1;
  ctx.fillStyle = PAL.hull;
  ctx.fillRect(cx - 3, baseY - 4, 7, 4);
  ctx.fillStyle = PAL.oar;
  ctx.fillRect(cx - 2, baseY - 9, 1, 6);
  ctx.fillRect(cx, baseY - 10, 1, 7);
  ctx.fillRect(cx + 2, baseY - 9, 1, 6);
  ctx.fillStyle = PAL.silverBar;
  ctx.fillRect(cx - 2, baseY - 10, 1, 1);
  ctx.fillRect(cx, baseY - 11, 1, 1);
  ctx.fillRect(cx + 2, baseY - 10, 1, 1);
}

function drawBallistaUpright(ctx, cx, baseY) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 1;
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(cx - 1, baseY - 7, 3, 7);
  ctx.fillRect(cx - 5, baseY - 8, 11, 2);
  ctx.fillStyle = PAL.hullLight;
  ctx.fillRect(cx - 5, baseY - 10, 2, 3);
  ctx.fillRect(cx + 4, baseY - 10, 2, 3);
  ctx.fillStyle = PAL.silverBar;
  ctx.fillRect(cx + 1, baseY - 8, 5, 1);
}

function drawCatapultUpright(ctx, cx, baseY) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 1;
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(cx - 4, baseY - 3, 9, 3);
  ctx.fillRect(cx - 1, baseY - 10, 2, 8);
  ctx.fillStyle = PAL.stone;
  ctx.fillRect(cx - 2, baseY - 13, 4, 4);
}

function drawBrazierUpright(ctx, cx, baseY, t) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 1;
  ctx.fillStyle = PAL.copper;
  ctx.fillRect(cx - 3, baseY - 5, 7, 5);
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(cx - 2, baseY - 1, 5, 1);
  const f = Math.floor(t * 6) % 2;
  ctx.fillStyle = f ? PAL.sun : PAL.sailStripe;
  ctx.fillRect(cx - 1, baseY - 8 - f, 3, 3 + f);
}

function drawShrineUpright(ctx, cx, baseY, kind) {
  cx = Math.round(cx); baseY = Math.round(baseY) - 1;
  ctx.fillStyle = PAL.eyeWhite;
  ctx.fillRect(cx - 3, baseY - 4, 7, 4);
  ctx.fillRect(cx - 2, baseY - 7, 5, 3);
  ctx.fillStyle = kind === "poseidon" ? PAL.seaLight : PAL.gold;
  ctx.fillRect(cx - 1, baseY - 10, 3, 3);
}

// Simplified enemy deck, bow pointing left toward you, with hull depth.
function drawEnemyDeck(ctx, ox, oy, w, h, t, opts) {
  opts = opts || {};
  ox = Math.round(ox); oy = Math.round(oy);
  const dark = "#4a3a2a", mid = "#6b543a", light = "#83694a";
  // Water shadow + hull side below
  ctx.fillStyle = PAL.seaDeep;
  ctx.fillRect(ox + 8, oy + h + 12, w - 14, 4);
  ctx.fillStyle = mid;
  ctx.fillRect(ox + 6, oy + h + 2, w - 10, 9);
  ctx.fillStyle = dark;
  ctx.fillRect(ox + 6, oy + h + 8, w - 10, 3);
  ctx.fillStyle = PAL.seaFoam;
  ctx.fillRect(ox + 6, oy + h + 11, w - 10, 1);
  // Deck plan
  ctx.fillStyle = dark;
  ctx.fillRect(ox + 12, oy + 2, w - 18, h);
  ctx.fillRect(ox + w - 8, oy + 8, 8, h - 12);
  ctx.fillRect(ox + 4, oy + 8, 10, h - 12);
  ctx.fillRect(ox - 2, oy + h / 2 - 6, 8, 12);
  ctx.fillStyle = light;
  ctx.fillRect(ox + 14, oy + 4, w - 22, h - 4);
  ctx.fillRect(ox + 6, oy + 10, 10, h - 16);
  ctx.fillStyle = mid;
  for (let y = 10; y < h - 4; y += 7) ctx.fillRect(ox + 8, oy + y, w - 18, 1);
  // Mast rising with a dark sail hanging across the deck
  const mx = ox + Math.round(w / 2);
  ctx.fillStyle = dark;
  ctx.fillRect(mx - 1, oy - 4, 3, 14);
  ctx.fillRect(mx - 14, oy - 4, 29, 2);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#5a4a63";
  ctx.fillRect(mx - 12, oy - 2, 25, 12);
  if (opts.boss) {
    ctx.fillStyle = PAL.red;
    ctx.fillRect(mx - 12, oy + 3, 25, 3);
  }
  ctx.globalAlpha = 1;
  // Their forward mount, glowing when about to fire
  ctx.fillStyle = opts.charge > 0.75 ? PAL.sailStripe : dark;
  ctx.fillRect(ox + 8, oy + h / 2 - 2, 6, 5);
}

// --- Top-down sea, shared by voyage and combat ---

function drawTopSea(ctx, t, drift) {
  drift = drift || 0;
  ctx.fillStyle = PAL.seaMid;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  ctx.fillStyle = PAL.seaDeep;
  ctx.fillRect(0, 0, VIRTUAL_W, 34);
  ctx.fillRect(0, VIRTUAL_H - 30, VIRTUAL_W, 30);
  ctx.fillStyle = PAL.seaLight;
  for (let row = 0; row < 14; row++) {
    const y = 10 + row * 19;
    const speed = 26 + (row % 3) * 9;
    const gap = 34 + (row % 4) * 7;
    const off = ((t * speed + drift + row * 13) % gap);
    for (let x = -gap; x < VIRTUAL_W + gap; x += gap) {
      ctx.fillRect(Math.round(x - off), y, 10, 2);
    }
  }
  for (let i = 0; i < 40; i++) {
    const sx = Math.floor(hash2(i, 31) * VIRTUAL_W);
    const sy = Math.floor(hash2(i, 57) * VIRTUAL_H);
    if (Math.sin(t * 2 + i * 1.7) > 0.72) {
      ctx.fillStyle = PAL.seaFoam;
      ctx.fillRect(sx, sy, 2, 1);
    }
  }
}

// A small island seen from above, drifting by.
function drawTopIsland(ctx, cx, cy, r, t) {
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = PAL.seaFoam;
  ctx.fillRect(cx - r - 2, cy - Math.round(r * 0.5) - 1, (r + 2) * 2, r + 2);
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(cx - r, cy - Math.round(r * 0.5), r * 2, r);
  ctx.fillRect(cx - r + 2, cy - Math.round(r * 0.5) - 1, r * 2 - 4, r + 2);
  ctx.fillStyle = PAL.islandNear;
  ctx.fillRect(cx - r + 3, cy - Math.round(r * 0.3), r * 2 - 6, Math.round(r * 0.6));
  // A palm with a little height, for the depth of it
  ctx.fillStyle = PAL.hullLight;
  ctx.fillRect(cx, cy - Math.round(r * 0.4) - 3, 1, 4);
  ctx.fillStyle = PAL.islandFar;
  ctx.fillRect(cx - 2, cy - Math.round(r * 0.4) - 5, 5, 3);
}
