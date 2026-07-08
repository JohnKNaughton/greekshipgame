// Pawns — RimWorld-style crew management on the 3/4-view deck. Click a
// sailor (or drag a box around several), then click a station (assign), any
// open deck (move), or an enemy boarder (attack). Rowers auto-man benches,
// mercs auto-defend. Skills grow with use: SAILING at helm/mast, ARMS at
// weapons and in melee. Hovering a pawn or a station tells you about it.

const CREW_NAMES = [
  "AKAMAS", "HANNO", "KADMOS", "ELISSA", "SAKON", "MAGON", "BITIAS",
  "ITTOBAAL", "PUMAY", "ABIBAAL", "DIDO", "PHILISTOS", "BODASHTART", "TANIT",
];

function randomCrewName() {
  const used = Game.crew ? Game.crew.map((c) => c.name) : [];
  const free = CREW_NAMES.filter((n) => !used.includes(n));
  const pool = free.length ? free : CREW_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeCrew(name) {
  return {
    kind: "crew",
    name: name || randomCrewName(),
    station: null,   // station id, or null (free)
    x: null, y: null, tx: null, ty: null, // deck-local position and goal
    hp: 8, hpMax: 8,
    xp: { sailing: 0, arms: 0 },
    attack: null,    // a boarder this pawn has been ordered onto
    swing: 0,
    walking: false,
  };
}

function skillOf(c, key) {
  return Math.min(5, Math.floor((c.xp[key] || 0) / 25));
}

const PAWN_SPEED = 26; // deck px per second
// Pawns stand a step south of their station's gear, so the wheel/ballista
// stays visible behind them and the y-sort puts the sailor in front.
const STAND_OFF = 5;
// Multi-crew stations arrange their occupants in a loose square.
const SLOT_OFFS = [[-8, -2], [8, -2], [-8, 10], [8, 10]];

function standPoint(st, slot) {
  const p = stationCenter(st);
  if ((st.cap || 1) > 1) {
    const o = SLOT_OFFS[(slot || 0) % SLOT_OFFS.length];
    return { x: p.x + o[0], y: p.y + o[1] };
  }
  return { x: p.x, y: p.y + STAND_OFF };
}

// What each post does, for tooltips everywhere.
function stationDesc(st) {
  if (st.bench) return "SPEEDS THE CROSSING, +10% DODGE PER MANNED OAR ROW";
  if (st.id === "helm") return "ENABLES MOVEMENT, +10% DODGE WHEN MANNED";
  if (st.id === "mast") return "FASTER TRAVEL, +10% DODGE PER SAIL LEVEL WHEN MANNED";
  if (st.id === "archers") return "UNITS SHOOT ENEMIES WITH VOLLEYS OF ARROWS";
  if (st.module && MODULE_WEAPONS[st.module]) return MODULES[st.module].desc + ", GUNNER SPEEDS RELOAD";
  if (st.module) return MODULES[st.module].desc + " WHILE FITTED";
  return "THE GODS APPRECIATE COMPANY";
}

// Ship dodge: 10% per level of each manned Helm, Sails, and Oars. A manned
// helm is one level; a manned SAILS station counts the sail level; each oar
// row counts when both of its benches are pulled. Shown live on the top bar
// and rolled against every incoming projectile in combat.
function currentDodge() {
  buildDeck();
  const standing = (st) => {
    const p = standPoint(st);
    return CrewUI.allPawns().some((pw) =>
      pw.hp > 0 && Math.abs(pw.x - p.x) < 5 && Math.abs(pw.y - p.y) < 5);
  };
  let d = 0;
  if (CrewUI.manned("helm")) d += 10;
  if (CrewUI.manned("mast")) d += 10 * Game.upgrades.sails;
  for (let i = 0; i < Game.oarsLevel; i++) {
    const top = CrewUI.stationById("benchT" + i);
    const bottom = CrewUI.stationById("benchB" + i);
    if (top && bottom && standing(top) && standing(bottom)) d += 10;
  }
  return d;
}

const CrewUI = {
  sel: [],            // selected named crew (multi-select)
  drag: null,         // {x0, y0, x1, y1} screen-space selection box
  mercPawns: [],
  rowerPawns: [],
  hoverPawn: null,
  hoverStation: null, // station (or {empty:true}) under the cursor
  panelAnchor: "top", // stations panel: "top" (port/voyage) or "bottom" (combat)

  isSelected(c) {
    return this.sel.includes(c);
  },

  cancelDrag() {
    this.drag = null;
  },

  // All friendly pawns that stand on the deck.
  allPawns() {
    return Game.crew.concat(this.mercPawns, this.rowerPawns);
  },

  reset() {
    this.sel = [];
    this.drag = null;
    this.mercPawns = [];
    this.rowerPawns = [];
  },

  makeAuto(kind) {
    const q = DECK.quarters;
    return {
      kind, name: kind === "merc" ? "MERCENARY" : "ROWER",
      station: null, hp: 4, hpMax: 4, xp: { sailing: 0, arms: 0 },
      x: q.x + 4 + Math.random() * (q.w - 8), y: q.y + 4 + Math.random() * (q.h - 6),
      tx: null, ty: null, attack: null, swing: 0, walking: false,
    };
  },

  // Keep visual auto-pawn squads in sync with the stock counts.
  syncPawns() {
    buildDeck();
    while (this.mercPawns.length < Game.mercs) this.mercPawns.push(this.makeAuto("merc"));
    while (this.mercPawns.length > Game.mercs) this.mercPawns.pop();
    while (this.rowerPawns.length < Game.rowers) this.rowerPawns.push(this.makeAuto("rower"));
    while (this.rowerPawns.length > Game.rowers) this.rowerPawns.pop();
    for (const c of Game.crew) {
      if (c.x === null || c.x === undefined) {
        const st = c.station && DECK.stations.find((s) => s.id === c.station);
        const p = st ? standPoint(st) : { x: DECK.quarters.x + 12, y: DECK.quarters.y + 20 };
        c.x = p.x; c.y = p.y;
      }
    }
  },

  stationById(id) {
    return DECK.stations.find((s) => s.id === id) || null;
  },

  assigneesOf(id) {
    return Game.crew.filter((c) => c.station === id);
  },

  // Crew assigned to the station AND standing at their post.
  occupants(id) {
    const st = this.stationById(id);
    if (!st) return [];
    const list = this.assigneesOf(id);
    return list.filter((c, i) => {
      const p = standPoint(st, i);
      return c.hp > 0 && Math.abs(c.x - p.x) < 5 && Math.abs(c.y - p.y) < 5;
    });
  },

  assign(c, st) {
    if (c.station === st.id) return;
    const cap = st.cap || 1;
    const others = this.assigneesOf(st.id).filter((o) => o !== c);
    // Full house: the longest-standing occupant gets bumped to the deck.
    if (others.length >= cap) others[0].station = null;
    c.station = st.id;
    c.attack = null;
    // tx/ty follow the slot each frame in update()
  },

  // First live pawn standing at this station (for effects that need one).
  manned(id) {
    return this.occupants(id)[0] || null;
  },

  // Heads at a station including mercenary garrisons (combat posts only).
  stationCount(st) {
    let n = this.occupants(st.id).length;
    if (st.weapon) {
      for (const m of this.mercPawns) {
        if (m.hp > 0 && m.x >= st.x - 1 && m.x < st.x + st.w + 1 &&
            m.y >= st.y - 2 && m.y < st.y + st.h + STAND_OFF + 4) n++;
      }
    }
    return n;
  },

  // A group fills a station's free slots; a lone sailor bumps someone if full.
  assignGroup(group, st) {
    const cap = st.cap || 1;
    if (group.length === 1) {
      this.assign(group[0], st);
      return;
    }
    for (const c of group) {
      if (this.assigneesOf(st.id).filter((o) => o !== c).length >= cap) break;
      this.assign(c, st);
    }
  },

  benchesManned() {
    let n = 0;
    for (const st of DECK.stations) {
      if (!st.bench) continue;
      const p = standPoint(st);
      for (const pw of this.allPawns()) {
        if (pw.hp > 0 && Math.abs(pw.x - p.x) < 5 && Math.abs(pw.y - p.y) < 5) { n++; break; }
      }
    }
    return n;
  },

  // --- Per-frame movement + auto behavior. threats = enemy boarders array.
  update(dt, opts) {
    opts = opts || {};
    this.syncPawns();
    const threats = (opts.threats || []).filter((b) => b.hp > 0);

    // Rowers spread across benches, skipping any bench a named sailor holds.
    const benches = DECK.stations.filter((s) => s.bench &&
      !Game.crew.some((c) => c.station === s.id));
    this.rowerPawns.forEach((r, i) => {
      const st = benches.length ? benches[i % benches.length] : null;
      if (st) { const p = standPoint(st); r.tx = p.x; r.ty = p.y; }
      else { r.tx = DECK.quarters.x + 6 + i * 6; r.ty = DECK.quarters.y + 18; }
    });
    // Mercenaries are soldiers, not sailors: they garrison open combat
    // positions (archer post, weapon mounts) left free by your crew, and
    // leap at any boarders. They take no other orders.
    const mercSlots = [];
    for (const st of DECK.stations) {
      if (!st.weapon) continue;
      const cap = st.cap || 1;
      for (let s = this.assigneesOf(st.id).length; s < cap; s++) {
        mercSlots.push(standPoint(st, s));
      }
    }
    this.mercPawns.forEach((m, i) => {
      if (threats.length) {
        const b = threats[i % threats.length];
        m.tx = b.x - 6; m.ty = b.y;
      } else if (mercSlots[i]) {
        m.tx = mercSlots[i].x; m.ty = mercSlots[i].y;
      } else {
        m.tx = DECK.cargo.x + 4 + i * 7; m.ty = DECK.cargo.y - 6;
      }
    });
    for (const c of Game.crew) {
      if (c.attack) {
        if (c.attack.hp <= 0) { c.attack = null; }
        else { c.tx = c.attack.x - 6; c.ty = c.attack.y; }
      } else if (c.station) {
        // Stationed crew hold their slot (slots shuffle up as people leave).
        const st = this.stationById(c.station);
        if (!st) { c.station = null; continue; }
        const slot = this.assigneesOf(c.station).indexOf(c);
        const p = standPoint(st, slot);
        c.tx = p.x; c.ty = p.y;
      }
    }

    for (const pw of this.allPawns()) {
      if (pw.tx === null || pw.tx === undefined) { pw.walking = false; continue; }
      const dx = pw.tx - pw.x, dy = pw.ty - pw.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.5) {
        pw.x += (dx / d) * PAWN_SPEED * dt;
        pw.y += (dy / d) * PAWN_SPEED * dt;
        pw.walking = true;
      } else {
        pw.walking = false;
      }
    }

    if (opts.training) {
      for (const c of Game.crew) {
        const st = c.station && this.stationById(c.station);
        if (st && !c.walking && st.skill) c.xp[st.skill] += dt * (st.skill === "sailing" ? 0.6 : 0.8);
      }
    }

    this.sel = this.sel.filter((c) => Game.crew.includes(c));
  },

  // --- Stations panel (upper right; lower right in combat) ---

  stationRows() {
    buildDeck();
    const rows = [];
    for (const st of DECK.stations) {
      if (st.bench) continue;
      const occ = this.occupants(st.id);
      rows.push({
        type: "st", st, label: st.name,
        count: this.stationCount(st), cap: st.cap || 1,
        occupant: occ[0] || null,
        critical: st.id === "helm",
      });
    }
    const benches = DECK.stations.filter((s) => s.bench);
    if (benches.length) {
      rows.push({
        type: "bench", label: "OARS",
        count: this.benchesManned(), cap: benches.length,
      });
    }
    return rows;
  },

  stationPanelRect(rows) {
    const h = 16 + rows.length * 10 + 3;
    const y = this.panelAnchor === "bottom" ? VIRTUAL_H - h - 6 : 19;
    return { x: 380, y, w: 98, h };
  },

  freeBench() {
    for (const st of DECK.stations) {
      if (!st.bench) continue;
      if (Game.crew.some((c) => c.station === st.id)) continue;
      const p = standPoint(st);
      const standing = this.allPawns().some((pw) =>
        pw.hp > 0 && Math.abs(pw.x - p.x) < 5 && Math.abs(pw.y - p.y) < 5);
      if (!standing) return st;
    }
    return null;
  },

  handleStationPanelClick() {
    const rows = this.stationRows();
    const r = this.stationPanelRect(rows);
    if (Input.mx < r.x || Input.mx >= r.x + r.w || Input.my < r.y || Input.my >= r.y + r.h) {
      return false;
    }
    const idx = Math.floor((Input.my - r.y - 14) / 10);
    const row = rows[idx];
    if (row) {
      if (this.sel.length) {
        if (row.type === "st") {
          this.assignGroup(this.sel, row.st);
        } else {
          // Spread the whole selection across free benches.
          for (const c of this.sel) {
            const st = this.freeBench() || DECK.stations.find((s) => s.bench);
            if (st) this.assign(c, st);
          }
        }
        this.sel = [];
      } else if (row.type === "st" && row.occupant) {
        this.sel = [row.occupant];
      }
    }
    return true; // clicks inside the panel never fall through to the deck
  },

  drawStationPanel(ctx, t) {
    const rows = this.stationRows();
    const r = this.stationPanelRect(rows);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    drawText(ctx, "STATIONS", r.x + 4, r.y + 3, 1, PAL.parchment);

    let tip = null;
    rows.forEach((row, i) => {
      const y = r.y + 14 + i * 10;
      const hovered = Input.mx >= r.x && Input.mx < r.x + r.w &&
        Input.my >= y && Input.my < y + 10;
      if (hovered && this.sel.length) {
        ctx.fillStyle = PAL.parchment;
        ctx.fillRect(r.x + 2, y - 1, r.w - 4, 10);
      }
      const boxColor = row.count > 0 ? PAL.green :
        row.critical ? PAL.red : PAL.yellow;
      const txtColor = hovered && this.sel.length ? PAL.ink : PAL.white;
      drawText(ctx, row.label.slice(0, 12), r.x + 4, y, 1, txtColor);
      drawText(ctx, row.count + "/" + row.cap, r.x + 64, y, 1,
        hovered && this.sel.length ? PAL.inkSoft : PAL.seaFoam);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(r.x + r.w - 12, y - 1, 9, 9);
      ctx.fillStyle = boxColor;
      ctx.fillRect(r.x + r.w - 11, y, 7, 7);
      if (hovered) tip = this.stationTip(row);
    });
    if (tip) drawTooltip(ctx, tip, Input.mx - 30, r.y + r.h + 3);
  },

  // "HELM 1/1 ENABLES MOVEMENT, GIVES DODGE WHEN MANNED"
  stationTip(row) {
    if (row.type === "bench") {
      return "OARS " + row.count + "/" + row.cap + " ROWERS SPEED THE CROSSING AND AID DODGE";
    }
    return row.st.name + " " + row.count + "/" + row.cap + " " + stationDesc(row.st);
  },

  // --- Input. Returns true if the click was crew business. ---
  handleClick(ox, oy, threats) {
    // Hover bookkeeping happens every frame (used for tooltips). Sprites
    // stand ~10px above their feet, so the hitbox leans upward.
    this.hoverPawn = null;
    this.hoverStation = null;
    for (const pw of this.allPawns()) {
      if (Math.abs(Input.mx - (ox + pw.x)) < 5 &&
          Input.my > oy + pw.y - 13 && Input.my < oy + pw.y + 4) {
        this.hoverPawn = pw;
        break;
      }
    }
    if (!this.hoverPawn && DECK) {
      const lx = Input.mx - ox, ly = Input.my - oy;
      for (const st of DECK.stations) {
        if (lx >= st.x - 1 && lx < st.x + st.w + 1 && ly >= st.y - 1 && ly < st.y + st.h + 1) {
          this.hoverStation = st;
          break;
        }
      }
      if (!this.hoverStation) {
        for (const m of DECK.emptyMounts) {
          if (lx >= m.x && lx < m.x + m.w && ly >= m.y && ly < m.y + m.h) {
            this.hoverStation = { empty: true };
            break;
          }
        }
      }
    }

    // An in-progress selection box eats all input until the button lifts.
    if (this.drag) {
      if (Input.down) {
        this.drag.x1 = Input.mx;
        this.drag.y1 = Input.my;
        return true;
      }
      const bx = Math.min(this.drag.x0, this.drag.x1), bw = Math.abs(this.drag.x1 - this.drag.x0);
      const by = Math.min(this.drag.y0, this.drag.y1), bh = Math.abs(this.drag.y1 - this.drag.y0);
      this.drag = null;
      if (bw > 5 || bh > 5) {
        this.sel = Game.crew.filter((c) =>
          ox + c.x >= bx && ox + c.x <= bx + bw &&
          oy + c.y - 6 >= by - 6 && oy + c.y <= by + bh + 4);
        return true;
      }
      return false;
    }

    if (!Input.clicked) return false;
    if (this.handleStationPanelClick()) return true;
    const hit = this.rosterHitTest(Input.mx, Input.my);
    if (hit) {
      this.sel = this.sel.length === 1 && this.sel[0] === hit ? [] : [hit];
      return true;
    }
    const lx = Input.mx - ox, ly = Input.my - oy;

    // Click a named pawn to select
    for (const c of Game.crew) {
      if (Math.abs(lx - c.x) < 5 && ly > c.y - 13 && ly < c.y + 4) {
        this.sel = this.sel.length === 1 && this.sel[0] === c ? [] : [c];
        return true;
      }
    }

    if (this.sel.length) {
      // Onto a boarder: draft the whole selection into the melee.
      if (threats) {
        for (const b of threats) {
          if (b.hp > 0 && Math.abs(lx - b.x) < 6 && ly > b.y - 13 && ly < b.y + 5) {
            for (const c of this.sel) {
              c.attack = b;
              c.station = null;
            }
            this.sel = [];
            return true;
          }
        }
      }
      // Onto a station: the selection fills it up to capacity
      for (const st of DECK.stations) {
        if (lx >= st.x - 1 && lx < st.x + st.w + 1 && ly >= st.y - 1 && ly < st.y + st.h + 1) {
          if (st.bench && this.sel.length > 1) {
            for (const c of this.sel) {
              const b = this.freeBench() || st;
              this.assign(c, b);
            }
          } else {
            this.assignGroup(this.sel, st);
          }
          this.sel = [];
          return true;
        }
      }
      // Anywhere walkable: the group moves in a loose knot
      if (deckWalkable(lx, ly)) {
        this.sel.forEach((c, i) => {
          c.station = null;
          c.attack = null;
          const dx = (i % 3 - 1) * 7, dy = (Math.floor(i / 3) - 1) * 6;
          c.tx = deckWalkable(lx + dx, ly + dy) ? lx + dx : lx;
          c.ty = deckWalkable(lx + dx, ly + dy) ? ly + dy : ly;
        });
        this.sel = [];
        return true;
      }
    }

    // Nothing claimed the press: it may become a selection box.
    this.drag = { x0: Input.mx, y0: Input.my, x1: Input.mx, y1: Input.my };
    return false;
  },

  drawDrag(ctx) {
    if (!this.drag) return;
    const bx = Math.round(Math.min(this.drag.x0, this.drag.x1));
    const by = Math.round(Math.min(this.drag.y0, this.drag.y1));
    const bw = Math.round(Math.abs(this.drag.x1 - this.drag.x0));
    const bh = Math.round(Math.abs(this.drag.y1 - this.drag.y0));
    if (bw < 3 && bh < 3) return;
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(bx, by, bw, 1);
    ctx.fillRect(bx, by + bh - 1, bw, 1);
    ctx.fillRect(bx, by, 1, bh);
    ctx.fillRect(bx + bw - 1, by, 1, bh);
  },

  // --- Roster panel (top-left) ---

  rosterRows() {
    return Game.crew.map((c, i) => ({ y: 32 + i * 11, crew: c }));
  },

  rosterHitTest(mx, my) {
    if (mx < 2 || mx > 88) return null;
    for (const r of this.rosterRows()) {
      if (my >= r.y - 1 && my < r.y + 9) return r.crew;
    }
    return null;
  },

  drawRoster(ctx, t) {
    const h = 14 + Game.crew.length * 11 + (this.sel.length ? 34 : 24);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(2, 19, 86, h);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(2, 19 + h - 2, 86, 2);
    drawText(ctx, "CREW " + Game.bunksUsed + "/" + Game.crewCap, 6, 22, 1, PAL.parchment);
    for (const r of this.rosterRows()) {
      const c = r.crew;
      const sel = this.isSelected(c);
      if (sel) {
        ctx.fillStyle = PAL.parchment;
        ctx.fillRect(4, r.y - 1, 82, 10);
      }
      const hurt = c.hp < c.hpMax;
      drawText(ctx, c.name.slice(0, 8), 6, r.y + 1, 1,
        sel ? PAL.ink : hurt ? PAL.yellow : PAL.white);
      drawText(ctx, "S" + skillOf(c, "sailing"), 52, r.y + 1, 1, sel ? PAL.inkSoft : PAL.seaLight);
      drawText(ctx, "A" + skillOf(c, "arms"), 64, r.y + 1, 1, sel ? PAL.inkSoft : PAL.sailStripe);
      const st = c.station && this.stationById(c.station);
      drawText(ctx, c.attack ? "!" : st ? st.name[0] : "-", 79, r.y + 1, 1,
        sel ? PAL.sailStripe : PAL.gold);
    }
    let sy = 32 + Game.crew.length * 11 + 2;
    drawText(ctx, "ROWERS  X" + Game.rowers, 6, sy, 1, Game.rowers ? PAL.white : PAL.inkSoft);
    drawText(ctx, "MERCS   X" + Game.mercs, 6, sy + 10, 1, Game.mercs ? PAL.white : PAL.inkSoft);
    if (this.sel.length) {
      drawText(ctx, this.sel.length > 1 ? this.sel.length + " SELECTED" : "CLICK DECK/STATION",
        6, sy + 20, 1, PAL.gold);
    }
  },

  // Tooltip line for whatever the cursor rests on: pawn first, then station.
  hoverInfo() {
    const pw = this.hoverPawn;
    if (pw) {
      if (pw.kind !== "crew") return pw.name + "  HP " + pw.hp + "/" + pw.hpMax;
      const st = pw.station && this.stationById(pw.station);
      return pw.name + "  HP " + pw.hp + "/" + pw.hpMax +
        "  SAIL " + skillOf(pw, "sailing") + " ARMS " + skillOf(pw, "arms") +
        (st ? "  AT " + st.name : "");
    }
    const hs = this.hoverStation;
    if (hs) {
      if (hs.empty) return "EMPTY MOUNT 0/1 FIT A MODULE AT A SHIPWRIGHT";
      if (hs.bench) {
        const p = standPoint(hs);
        const taken = this.allPawns().some((pw) =>
          pw.hp > 0 && Math.abs(pw.x - p.x) < 5 && Math.abs(pw.y - p.y) < 5);
        return "OAR BENCH " + (taken ? 1 : 0) + "/1 " + stationDesc(hs);
      }
      return this.stationTip({
        type: "st", st: hs,
        count: this.stationCount(hs), cap: hs.cap || 1,
      });
    }
    return null;
  },
};

// A standing pawn in 3/4 view, feet at (x, y). ~10px tall with a shadow,
// so decks read with depth and nearer pawns overlap farther ones.
function drawPawnTop(ctx, x, y, t, o) {
  o = o || {};
  x = Math.round(x); y = Math.round(y);
  const step = o.walking ? (Math.floor(t * 9) % 2) : 0;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 3, y - 1, 7, 2);
  if (o.selected) {
    // A bobbing green arrow: this is the one you have selected.
    const bob = Math.floor(t * 4) % 2;
    ctx.fillStyle = PAL.green;
    ctx.fillRect(x - 2, y - 18 + bob, 5, 2);
    ctx.fillRect(x - 1, y - 16 + bob, 3, 2);
    ctx.fillRect(x, y - 14 + bob, 1, 2);
  }
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x - 1, y - 3, 1, 3 - step);
  ctx.fillRect(x + 1, y - 3, 1, 3 - (o.walking ? 1 - step : 0));
  ctx.fillStyle = o.tunic || PAL.seaLight;
  ctx.fillRect(x - 2, y - 7, 5, 4);
  ctx.fillStyle = "#e8b48a";
  ctx.fillRect(x - 1, y - 10, 3, 3);
  ctx.fillStyle = o.helmet ? PAL.silverBar : "#5a4028";
  ctx.fillRect(x - 1, y - 11, 3, 2);
  if (o.hpFrac !== null && o.hpFrac !== undefined) {
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 3, y + 1, 7, 2);
    ctx.fillStyle = o.hpFrac > 0.5 ? PAL.green : PAL.red;
    ctx.fillRect(x - 2, y + 1, Math.max(1, Math.round(5 * o.hpFrac)), 1);
  }
}
