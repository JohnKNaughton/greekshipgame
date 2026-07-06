// Port view — the city climbs the hill on the left, your ship lies docked on
// the right. Hover buildings to see what they offer; click to step inside.
// DEPART and the Map Scroll live in the bottom right.

const SERVICES = {
  dock:     { name: "DOCK",     hint: "REPAIRS AND SHIP UPGRADES" },
  market:   { name: "MARKET",   hint: "GOODS, STORES, AND HANDS" },
  tavern:   { name: "TAVERN",   hint: "QUESTS AND RUMORS" },
  temple:   { name: "TEMPLE",   hint: "PRIESTS AND BLESSINGS" },
  barracks: { name: "BARRACKS", hint: "SOLDIERS AND SIEGECRAFT" },
};

// The waterfront holds the two core buildings every port shares — the dock
// nearest your ship, the market beside it. The changing civic buildings
// stand above them on the acropolis terrace; empty spots become houses.
const SERVICE_SLOTS = {
  dock:     { x: 146, y: 170, w: 60, h: 46 },
  market:   { x: 82,  y: 172, w: 56, h: 44 },
  tavern:   { x: 18,  y: 96,  w: 46, h: 40 },
  temple:   { x: 74,  y: 86,  w: 54, h: 50 },
  barracks: { x: 136, y: 92,  w: 48, h: 44 },
};

class PortScene {
  constructor() {
    this.city = CITIES[Game.currentPort];
    this.ruined = Game.isRuined(Game.currentPort);
    this.buildings = Object.keys(SERVICE_SLOTS).map((id) => ({
      id,
      here: !this.ruined && this.city.services.includes(id),
      ...SERVICE_SLOTS[id],
    }));
    this.panel = null;      // service id, or "ship"
    this.pButtons = [];     // [{ btn, action }]
    this.hover = null;
    this.toastMsg = null;
    this.toastTimer = 0;

    this.mapBtn = new Button(340, 226, 132, 36, "MAP/DEPART", 2);
    this.shipBtn = new Button(340, 204, 132, 18, "SHIP", 1);
    this.scavengeBtn = new Button(8, 238, 88, 24, "SCAVENGE", 1);
    this.panelClose = new Button(360, 44, 16, 14, "X", 1);
    buildDeck();
    // Moor the deck against the pier, whatever her size.
    this.deckX = Math.min(262, VIRTUAL_W - DECK.W - 8);
    this.deckY = Math.min(122, 196 - DECK.H);
    CrewUI.panelAnchor = "top";

    // Grim tidings travel with you.
    if (Game.news.length) this.toast(Game.news.shift());

    // Ruins are not quite dead: fires gutter, walls give way, boars root
    // through what the people left behind.
    if (this.ruined) {
      this.boars = [0, 1, 2].map((i) => ({
        x: 40 + i * 60, y: 140 + (i % 2) * 30,
        tx: 40 + i * 60, ty: 140 + (i % 2) * 30,
        state: "root", timer: 1 + i,
      }));
      this.debris = [];
      this.collapseTimer = 2 + Math.random() * 4;
      this.slump = {}; // per-slot extra collapse, grows as walls give way
    }
  }

  toast(msg) {
    this.toastMsg = msg;
    this.toastTimer = 2.4;
  }

  // --- Update ---

  update(dt, t) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMsg = null;
    }

    if (this.ruined) this.updateRuins(dt, t);

    if (this.panel) {
      if (this.panelClose.clicked() || Input.pressed("Escape")) {
        this.panel = null;
        return;
      }
      for (const { btn, action } of this.pButtons) {
        if (btn.clicked()) {
          const err = action();
          if (err) this.toast(err);
        }
      }
      return;
    }

    if (this.mapBtn.clicked() || Input.pressed("KeyM") || Input.pressed("KeyD")) {
      Scenes.change(new MapScene(this, "depart"));
      return;
    }
    if (Input.pressed("Escape")) {
      Scenes.change(new TitleScene());
      return;
    }

    if (this.shipBtn.clicked()) {
      this.openPanel("ship");
      return;
    }

    // Crew: pawns walk the docked deck even in port.
    CrewUI.update(dt);
    if (CrewUI.handleClick(this.deckX, this.deckY)) return;

    if (this.ruined && this.scavengeBtn.clicked()) {
      const msg = Game.scavengeRuins();
      this.toast(msg || "");
      return;
    }

    // Hover: city buildings.
    this.hover = null;
    for (const b of this.buildings) {
      if (b.here && Input.mx >= b.x && Input.mx < b.x + b.w &&
          Input.my >= b.y && Input.my < b.y + b.h) {
        this.hover = b.id;
      }
    }

    if (Input.clicked) {
      if (this.hover) this.openPanel(this.hover);
      else if (this.ruined && Input.mx < 230 && Input.my > 90) {
        this.toast("ONLY ASHES REMAIN.");
      }
    }
  }

  // --- Panels ---

  openPanel(kind) {
    this.panel = kind;
    this.pButtons = [];
    CrewUI.cancelDrag();
    const add = (btn, action) => this.pButtons.push({ btn, action });

    if (kind === "market") {
      // Trade goods, then ship's stores, then dockside hands.
      GOOD_IDS.forEach((g, i) => {
        const y = 72 + i * 20;
        add(new Button(288, y, 32, 16, "BUY", 1), () => Game.buyGood(g));
        add(new Button(326, y, 36, 16, "SELL", 1), () => Game.sellGood(g));
      });
      [["water", 176], ["provisions", 194]].forEach(([kd, y]) => {
        add(new Button(276, y, 38, 16, "+1", 1), () => Game.buyStock(kd, 1));
        add(new Button(320, y, 42, 16, "+5", 1), () => Game.buyStock(kd, 5));
      });
      // Mercy for captains with empty purses and empty larders.
      if (Game.resources.coins < 5 && Game.resources.provisions < 4) {
        add(new Button(100, 212, 80, 16, "BEG ALMS", 1), () => Game.begAlms());
      }
    } else if (kind === "tavern") {
      add(new Button(240, 148, 122, 18, "HIRE FOR 30C", 1), () => Game.hireSailor());
      add(new Button(240, 176, 122, 18, "ROWER FOR 15C", 1), () => Game.hireRower());
    } else if (kind === "barracks") {
      add(new Button(240, 148, 122, 18, "HIRE FOR 25C", 1), () => Game.hireMerc());
    } else if (kind === "dock") {
      // Hull repairs up top, then invisible hit-areas over the grid's cells.
      add(new Button(282, 56, 34, 14, "+1", 1), () => Game.repairHull(1));
      add(new Button(322, 56, 40, 14, "+5", 1), () => Game.repairHull(5));
      const g = this.gridGeom();
      const rowY = (i) => g.gy + g.headerH + i * g.rowH;
      const cellX = (c) => g.gx + g.labelW + 4 + c * g.colW;
      const hidden = (btn, action) => this.pButtons.push({ btn, action, hidden: true });
      // Each hull row header buys that hull — one size at a time, and only
      // once the row above is fully fitted out (hidden rows ignore clicks).
      for (let lvl = 1; lvl < HULL_LEVELS.length; lvl++) {
        hidden(new Button(g.gx, rowY(lvl), g.labelW, g.rowH - 4, ""), () => {
          if (Game.upgrades.hull >= lvl) return "SHE ALREADY WEARS THAT HULL.";
          if (lvl !== Game.upgrades.hull + 1 || !Game.rowComplete(Game.upgrades.hull)) return null;
          return Game.buyShipUpgrade("hull");
        });
      }
      hidden(new Button(cellX(1), rowY(1), g.colW - 3, g.rowH - 4, ""), () => Game.buyShipUpgrade("sails"));
      hidden(new Button(cellX(2), rowY(1), g.colW - 3, g.rowH - 4, ""), () => Game.buyShipUpgrade("archers"));
      hidden(new Button(cellX(3), rowY(1), g.colW - 3, g.rowH - 4, ""), () => Game.buyShipUpgrade("quarters"));
      // Module fillers for open slots.
      add(new Button(102, 212, 130, 16, () => "FIT BALLISTA " + MODULES.ballista.cost + "C", 1),
        () => Game.buyModule("ballista"));
      add(new Button(240, 212, 130, 16, () => "FIT CATAPULT " + MODULES.catapult.cost + "C", 1),
        () => Game.buyModule("catapult"));
    }
  }

  // Geometry of the hull-by-category upgrade grid.
  gridGeom() {
    const r = this.panelRect();
    return { gx: r.x + 8, gy: r.y + 32, labelW: 58, colW: 45, rowH: 32, headerH: 10 };
  }

  panelRect() {
    return { x: 88, y: 40, w: 296, h: 196 };
  }

  // --- Draw ---

  draw(ctx, t) {
    drawSeascape(ctx, VIRTUAL_W, VIRTUAL_H, t);
    this.drawCitySide(ctx, t);

    // Pier reaching out to the moored deck.
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(208, 150, 58, 3);
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(208, 153, 58, 10);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(216, 163, 3, 12);
    ctx.fillRect(244, 163, 3, 14);

    // Your ship from above, moored stern-to against the pier. Walk the crew.
    drawDeckShip(ctx, this.deckX, this.deckY, t, {});
    drawDeckUprights(ctx, this.deckX, this.deckY, t, {});
    // Mooring line pier -> stern
    ctx.strokeStyle = PAL.hullDark;
    ctx.beginPath();
    ctx.moveTo(this.deckX + 0.5, 156.5);
    ctx.quadraticCurveTo(this.deckX - 4, 162, this.deckX + 4.5, 166.5);
    ctx.stroke();

    // City banner
    const title = (this.ruined ? "RUINS OF " : "PORT OF ") + this.city.name;
    const sub = this.city.ruined ? "YOUR HOME, DESTROYED IN 775 BC" :
      this.ruined ? "BURNED BY THE DEVOURER" : this.city.region;
    const bw = Math.max(textWidth(title, 2), textWidth(sub, 1)) + 20;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect((VIRTUAL_W - bw) / 2 + 2, 22, bw, 28);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect((VIRTUAL_W - bw) / 2, 20, bw, 28);
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect((VIRTUAL_W - bw) / 2, 45, bw, 3);
    drawTextC(ctx, title, VIRTUAL_W / 2, 25, 2, PAL.ink);
    drawTextC(ctx, sub, VIRTUAL_W / 2, 38, 1, this.ruined ? PAL.red : PAL.sailStripe);

    // The clock is always ticking.
    const yearsLeft = Game.year - VILLAIN_RETURN_YEAR;
    if (Game.elapsed >= 38 && yearsLeft > 0) {
      drawTextC(ctx, "THE DEVOURER RETURNS IN " + yearsLeft +
        (yearsLeft === 1 ? " YEAR" : " YEARS"), VIRTUAL_W / 2, 54, 1, PAL.red);
    }

    this.shipBtn.draw(ctx);
    this.mapBtn.draw(ctx, { icon: drawScrollButtonIcon });
    if (this.ruined) this.scavengeBtn.draw(ctx);

    // Hover labels
    const pawnInfo = CrewUI.hoverInfo();
    if (pawnInfo) {
      drawTooltip(ctx, pawnInfo, Input.mx, Input.my - 14);
    } else if (this.hover) {
      const s = SERVICES[this.hover];
      drawTooltip(ctx, s.name + " - " + s.hint, Input.mx, Input.my - 14);
    }

    if (this.panel) this.drawPanel(ctx, t);

    CrewUI.drawRoster(ctx, t);
    if (!this.panel) CrewUI.drawStationPanel(ctx, t);
    CrewUI.drawDrag(ctx);
    drawResourceBar(ctx, t);

    if (this.toastMsg) {
      const w = textWidth(this.toastMsg, 1) + 12;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect((VIRTUAL_W - w) / 2, 246, w, 12);
      drawTextC(ctx, this.toastMsg, VIRTUAL_W / 2, 249, 1, PAL.parchment);
    }
  }

  drawCitySide(ctx, t) {
    // The hill the city climbs (scorched, if the city is gone).
    ctx.fillStyle = this.ruined ? "#6e7a5a" : PAL.islandFar;
    ctx.fillRect(0, 78, 214, 134);
    ctx.fillStyle = this.ruined ? "#55614a" : PAL.islandNear;
    ctx.fillRect(0, 160, 218, 52);

    // The acropolis terrace: a stone retaining wall holds the upper town.
    ctx.fillStyle = this.ruined ? "#5f6b52" : PAL.islandFar;
    ctx.fillRect(6, 84, 206, 54);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(6, 138, 206, 7);
    ctx.fillStyle = PAL.stoneDark;
    ctx.fillRect(6, 143, 206, 3);
    for (let x = 14; x < 208; x += 26) {
      ctx.fillRect(x, 139, 2, 5);
    }
    // Stairs down from the acropolis to the waterfront
    ctx.fillStyle = this.ruined ? PAL.sandShade : PAL.sand;
    for (let s = 0; s < 7; s++) {
      ctx.fillRect(118 - s, 138 + s * 4, 22 + s * 2, 4);
    }

    // Quay
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(0, 196, 216, 4);
    ctx.fillStyle = this.ruined ? PAL.sandShade : PAL.sand;
    ctx.fillRect(0, 200, 216, 70);
    for (let x = 14; x < 210; x += 38) {
      ctx.fillStyle = this.ruined ? "#b3985e" : PAL.sandShade;
      ctx.fillRect(x, 204, 2, 66);
    }

    if (this.ruined) {
      this.drawRuins(ctx, t);
      return;
    }

    // Buildings (or humble houses where a civic service is absent).
    for (const b of this.buildings) {
      if (b.here) this.drawBuilding(ctx, b, t);
      else this.drawHouse(ctx, b.x + 8, b.y + b.h - 22);
    }
    // The fourth acropolis lot is always somebody's home.
    this.drawHouse(ctx, 188, 116);

    // A palm for the tropics.
    this.drawPalm(ctx, 224, 200, t);
  }

  updateRuins(dt, t) {
    // Boars wander the hillside, pausing to root in the ash.
    for (const b of this.boars) {
      b.timer -= dt;
      if (b.state === "walk") {
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 2 || b.timer <= 0) {
          b.state = "root";
          b.timer = 1.5 + Math.random() * 2.5;
        } else {
          b.x += (dx / d) * 9 * dt;
          b.y += (dy / d) * 9 * dt;
        }
      } else if (b.timer <= 0) {
        b.tx = 15 + Math.random() * 180;
        b.ty = 128 + Math.random() * 58;
        b.state = "walk";
        b.timer = 8;
      }
    }

    // Now and then another wall lets go: stones fall, dust rises.
    this.collapseTimer -= dt;
    if (this.collapseTimer <= 0) {
      this.collapseTimer = 4 + Math.random() * 6;
      const ids = Object.keys(SERVICE_SLOTS);
      const id = ids[Math.floor(Math.random() * ids.length)];
      const s = SERVICE_SLOTS[id];
      this.slump[id] = Math.min(6, (this.slump[id] || 0) + 1);
      const base = s.y + s.h;
      for (let i = 0; i < 10; i++) {
        this.debris.push({
          x: s.x + 4 + Math.random() * (s.w - 8), y: base - 8 - Math.random() * 6,
          vx: (Math.random() - 0.5) * 34, vy: -12 - Math.random() * 22,
          life: 0.7 + Math.random() * 0.4, ground: base + Math.random() * 2,
          color: Math.random() < 0.5 ? PAL.stone : PAL.stoneDark,
        });
      }
      for (let i = 0; i < 6; i++) {
        this.debris.push({
          x: s.x + Math.random() * s.w, y: base - 4 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 6,
          life: 1 + Math.random() * 0.8, dust: true,
          color: Math.random() < 0.5 ? "#8a8a90" : "#6f6f78",
        });
      }
    }
    for (const p of this.debris) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.dust) {
        p.vy += 130 * dt;
        if (p.y >= p.ground) { p.y = p.ground; p.vx = 0; p.vy = 0; }
      }
    }
    this.debris = this.debris.filter((p) => p.life > 0);
  }

  drawRuins(ctx, t) {
    // What the Devourer leaves behind: stumps, char, fire, and smoke.
    Object.entries(SERVICE_SLOTS).forEach(([id, b], slot) => {
      const base = b.y + b.h;
      const slump = (this.slump && this.slump[id]) || 0;
      // Broken wall stubs, a little lower after every collapse
      const h1 = Math.max(3, 10 - slump);
      const h2 = Math.max(2, 6 - slump);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(b.x + 4, base - h1, 14, h1);
      ctx.fillRect(b.x + 26, base - h2, 18, h2);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(b.x + 4, base - h1 - 2, 14, 3);
      // Charred beams leaning
      ctx.fillStyle = "#2b2320";
      ctx.fillRect(b.x + 20, base - 16 + slump, 2, 16 - slump);
      ctx.fillRect(b.x + 23, base - 12 + Math.min(slump, 4), 2, 12 - Math.min(slump, 4));
      // Rubble, deeper as the walls come down
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(b.x + 34, base - 3, 5 + slump, 3);
      ctx.fillRect(b.x + 12, base - 3, 4 + slump, 3);
      // Fires still eating at every other ruin — tall, greedy flames
      if (slot % 2 === 0) {
        const fx = b.x + 26, fy = base - h2;
        const flick = Math.round(Math.sin(t * 8 + slot * 2.1) * 3);
        const flick2 = Math.round(Math.sin(t * 6.3 + slot) * 2);
        ctx.fillStyle = PAL.sailStripe;
        ctx.fillRect(fx, fy - 8 - flick, 5, 8 + flick);
        ctx.fillRect(fx + 6, fy - 5 + flick2, 4, 5 - flick2);
        ctx.fillRect(fx - 3, fy - 4 - flick2, 3, 4 + flick2);
        ctx.fillStyle = PAL.sun;
        ctx.fillRect(fx + 1, fy - 6 - flick, 3, 6 + flick);
        ctx.fillRect(fx + 7, fy - 3 + flick2, 2, 3 - flick2);
        ctx.fillStyle = PAL.sunCore;
        ctx.fillRect(fx + 2, fy - 3 - Math.max(0, flick), 2, 3);
        if (Math.sin(t * 11 + slot) > 0.1) ctx.fillRect(fx + 2, fy - 10 - flick, 1, 2);
        if (Math.sin(t * 13 + slot * 3) > 0.5) ctx.fillRect(fx + 7, fy - 7 + flick2, 1, 1);
        // Ember glow on the ground
        ctx.fillStyle = PAL.sailStripe;
        ctx.fillRect(fx - 2, base - 1, 12, 1);
      }
    });
    // Where the temple stood: one column still standing, its brothers down.
    const tp = SERVICE_SLOTS.temple;
    const tbase = tp.y + tp.h - 6;
    ctx.fillStyle = PAL.eyeWhite;
    ctx.fillRect(tp.x + 16, tp.y + 20, 5, tp.h - 26);
    ctx.fillRect(tp.x + 14, tp.y + 16, 9, 4);
    // A snapped column, leaning drum still on its stump
    ctx.fillRect(tp.x + 34, tbase - 12, 5, 12);
    ctx.fillRect(tp.x + 32, tbase - 15, 8, 4);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(tp.x + 33, tbase - 12, 7, 1);
    // Fallen drums lying where they rolled
    const drums = [
      [tp.x - 14, tbase + 4], [tp.x - 5, tbase + 5], [tp.x + 44, tbase + 2],
      [SERVICE_SLOTS.market.x + 18, SERVICE_SLOTS.market.y + SERVICE_SLOTS.market.h + 2],
      [SERVICE_SLOTS.barracks.x - 10, SERVICE_SLOTS.barracks.y + SERVICE_SLOTS.barracks.h - 2],
    ];
    for (const [dx, dy] of drums) {
      ctx.fillStyle = PAL.eyeWhite;
      ctx.fillRect(dx, dy, 9, 5);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(dx + 3, dy, 1, 5);
      ctx.fillRect(dx + 6, dy, 1, 5);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(dx, dy + 4, 9, 1);
    }
    // Column stumps sheared at ankle height
    ctx.fillStyle = PAL.eyeWhite;
    ctx.fillRect(tp.x + 4, tbase - 4, 5, 4);
    ctx.fillRect(tp.x + 26, tbase - 3, 5, 3);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(tp.x + 4, tbase - 4, 5, 1);
    ctx.fillRect(tp.x + 26, tbase - 3, 5, 1);
    // Smoke, still rising after all this time
    for (let i = 0; i < 4; i++) {
      const sx = 30 + i * 50;
      const rise = (t * 9 + i * 13) % 46;
      ctx.fillStyle = i % 2 ? "#8a8a90" : "#6f6f78";
      ctx.fillRect(sx + Math.round(Math.sin(t + i) * 2), 150 - rise, 2, 3);
      ctx.fillRect(sx + 1, 158 - rise * 0.7, 2, 2);
    }
    // A charred palm trunk, fronds gone
    ctx.fillStyle = "#2b2320";
    ctx.fillRect(224, 176, 3, 24);
    ctx.fillRect(226, 170, 2, 8);

    // Falling stones and rising dust from the latest collapse
    for (const p of this.debris) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.dust ? Math.min(1, p.life) : 1;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      ctx.globalAlpha = 1;
    }

    // The boars have the run of the place now
    for (const b of this.boars) {
      drawBoar(ctx, b.x, b.y, t, b.tx >= b.x ? 1 : -1, b.state === "root", b.state === "walk");
    }
  }

  drawBuilding(ctx, b, t) {
    const hot = this.hover === b.id;
    const base = b.y + b.h;
    const fns = {
      dock: () => this.drawDockB(ctx, b, base),
      market: () => this.drawMarketB(ctx, b, base),
      tavern: () => this.drawTavernB(ctx, b, base),
      temple: () => this.drawTempleB(ctx, b, base),
      barracks: () => this.drawBarracksB(ctx, b, base),
    };
    fns[b.id]();
    if (hot) {
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(b.x, b.y - 2, b.w, 1);
      ctx.fillRect(b.x, base + 1, b.w, 1);
    }
    drawTextC(ctx, SERVICES[b.id].name, b.x + b.w / 2, b.y - 9, 1,
      hot ? PAL.gold : PAL.white);
  }

  drawHouse(ctx, x, y) {
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(x, y, 20, 18);
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(x - 2, y - 4, 24, 5);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 8, y + 8, 5, 10);
    ctx.fillStyle = PAL.sun;
    ctx.fillRect(x + 3, y + 4, 3, 3);
  }

  drawDockB(ctx, b, base) {
    // The dock is a working shipyard: a hull on the slipway under an
    // A-frame, with a barrel of pitch and a coil of rope.
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(b.x + 6, b.y + 2, 3, b.h - 6);
    ctx.fillRect(b.x + 46, b.y + 2, 3, b.h - 6);
    ctx.fillRect(b.x + 6, b.y, 43, 3);
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(b.x + 10, b.y + 30, 36, 5);
    ctx.fillRect(b.x + 14, b.y + 35, 28, 4);
    ctx.fillStyle = PAL.hullLight;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(b.x + 13 + i * 7, b.y + 18, 2, 13);
    }
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(b.x + 10, b.y + 16, 36, 2);
    // Hanging tackle
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(b.x + 27, b.y + 3, 1, 8);
    ctx.fillRect(b.x + 25, b.y + 11, 5, 4);
    // Barrel and rope coil
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(b.x + 52, b.y + 32, 8, 11);
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(b.x + 52, b.y + 36, 8, 2);
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(b.x - 2, b.y + 36, 7, 5);
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(b.x, b.y + 37, 3, 3);
  }

  drawMarketB(ctx, b, base) {
    // Striped awning on poles over a laden table.
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(b.x + 2, b.y + 8, 3, b.h - 10);
    ctx.fillRect(b.x + b.w - 5, b.y + 8, 3, b.h - 10);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? PAL.sail : PAL.sailStripe;
      ctx.fillRect(b.x + i * 9 - 1, b.y + 2 + (i % 2), 10, 7);
    }
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(b.x + 6, b.y + 26, b.w - 12, 4);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(b.x + 8, b.y + 30, 3, 12);
    ctx.fillRect(b.x + b.w - 11, b.y + 30, 3, 12);
    // Wares
    ctx.fillStyle = PAL.copper;
    ctx.fillRect(b.x + 10, b.y + 20, 5, 6);
    ctx.fillStyle = PAL.purple;
    ctx.fillRect(b.x + 20, b.y + 22, 8, 4);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(b.x + 33, b.y + 23, 6, 3);
  }

  drawTavernB(ctx, b, base) {
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(b.x + 4, b.y + 10, b.w - 8, b.h - 10);
    ctx.fillStyle = PAL.sailStripe;
    ctx.fillRect(b.x, b.y + 4, b.w, 7);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(b.x, b.y + 9, b.w, 2);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(b.x + 8, b.y + 22, 8, 20);
    ctx.fillStyle = PAL.sun;
    ctx.fillRect(b.x + 26, b.y + 20, 6, 6);
    // Hanging amphora sign
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(b.x + b.w - 8, b.y + 12, 1, 6);
    ctx.fillStyle = PAL.copper;
    ctx.fillRect(b.x + b.w - 11, b.y + 18, 6, 8);
  }

  drawTempleB(ctx, b, base) {
    // Steps, columns, pediment — the gods keep the high ground.
    ctx.fillStyle = PAL.stoneDark;
    ctx.fillRect(b.x, base - 6, b.w, 4);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(b.x + 4, base - 10, b.w - 8, 4);
    ctx.fillStyle = PAL.eyeWhite;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(b.x + 8 + i * 11, b.y + 16, 5, b.h - 26);
    }
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(b.x + 4, b.y + 12, b.w - 8, 4);
    // Pediment triangle
    ctx.fillStyle = PAL.eyeWhite;
    ctx.fillRect(b.x + 6, b.y + 8, b.w - 12, 4);
    ctx.fillRect(b.x + 14, b.y + 4, b.w - 28, 4);
    ctx.fillRect(b.x + 22, b.y, b.w - 44, 4);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(b.x + b.w / 2 - 2, b.y + 1, 4, 2);
  }

  drawBarracksB(ctx, b, base) {
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(b.x + 2, b.y + 8, b.w - 4, b.h - 8);
    ctx.fillStyle = PAL.stoneDark;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(b.x + 2 + i * 12, b.y + 4, 7, 6);
    }
    ctx.fillRect(b.x + 2, b.y + 20, b.w - 4, 2);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(b.x + 18, b.y + 24, 9, 18);
    // Shield and spears by the door
    ctx.fillStyle = PAL.green;
    ctx.fillRect(b.x + 33, b.y + 26, 7, 7);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(b.x + 35, b.y + 28, 3, 3);
    ctx.fillStyle = PAL.hullLight;
    ctx.fillRect(b.x + 8, b.y + 18, 1, 24);
    ctx.fillRect(b.x + 11, b.y + 16, 1, 26);
    ctx.fillStyle = PAL.silverBar;
    ctx.fillRect(b.x + 7, b.y + 14, 3, 4);
    ctx.fillRect(b.x + 10, b.y + 12, 3, 4);
  }

  drawPalm(ctx, x, baseY, t) {
    const sway = Math.round(Math.sin(t * 1.2) * 1.5);
    ctx.fillStyle = PAL.hullLight;
    ctx.fillRect(x, baseY - 12, 3, 12);
    ctx.fillRect(x + 1, baseY - 24, 3, 12);
    ctx.fillStyle = PAL.islandNear;
    const tx = x + 2 + sway, ty = baseY - 26;
    ctx.fillRect(tx - 10, ty - 2, 9, 2);
    ctx.fillRect(tx + 2, ty - 2, 9, 2);
    ctx.fillRect(tx - 7, ty - 5, 6, 2);
    ctx.fillRect(tx + 2, ty - 5, 6, 2);
    ctx.fillRect(tx - 1, ty - 7, 3, 3);
    ctx.fillStyle = PAL.islandFar;
    ctx.fillRect(tx - 10, ty - 4, 4, 2);
    ctx.fillRect(tx + 7, ty - 4, 4, 2);
  }

  // --- Panel drawing ---

  drawPanel(ctx, t) {
    const r = this.panelRect();
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(r.x + 3, r.y + 3, r.w, r.h);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(r.x, r.y, r.w, 3);
    ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
    this.panelClose.draw(ctx);

    const title = this.panel === "ship" ? "THE " + Game.shipName : SERVICES[this.panel].name;
    drawTextC(ctx, title, r.x + r.w / 2, r.y + 8, 2, PAL.ink);

    const draws = {
      market: () => this.drawMarketPanel(ctx, r),
      dock: () => this.drawDockPanel(ctx, r),
      tavern: () => this.drawTavernPanel(ctx, r),
      temple: () => this.drawFlavorPanel(ctx, r,
        "INCENSE CURLS TOWARD PAINTED GODS.",
        "PRIESTS AND BLESSINGS ARRIVE WITH A LATER PAGE."),
      barracks: () => this.drawBarracksPanel(ctx, r),
      ship: () => this.drawShipPanel(ctx, r),
    };
    draws[this.panel]();

    for (const p of this.pButtons) {
      if (!p.hidden) p.btn.draw(ctx);
    }
  }

  drawMarketPanel(ctx, r) {
    drawText(ctx, "CARGO " + Game.cargoUsed + "/" + Game.cargoCap +
      "  COPPER " + Game.resources.coins, r.x + 12, r.y + 10, 1, PAL.inkSoft);
    drawText(ctx, "GOOD", r.x + 14, r.y + 22, 1, PAL.inkSoft);
    drawText(ctx, "PRICE", r.x + 92, r.y + 22, 1, PAL.inkSoft);
    drawText(ctx, "NOTE", r.x + 134, r.y + 22, 1, PAL.inkSoft);
    drawText(ctx, "HAVE", r.x + 172, r.y + 22, 1, PAL.inkSoft);
    GOOD_IDS.forEach((g, i) => {
      const y = r.y + 36 + i * 20;
      RES_ICONS[g](ctx, r.x + 12, y - 2);
      drawText(ctx, GOODS[g].name, r.x + 24, y, 1, PAL.ink);
      drawText(ctx, Game.priceOf(Game.currentPort, g) + "C", r.x + 92, y, 1, PAL.ink);
      const tag = Game.priceTag(Game.currentPort, g);
      if (tag === "cheap") drawText(ctx, "CHEAP!", r.x + 134, y, 1, PAL.green);
      if (tag === "dear") drawText(ctx, "DEAR!", r.x + 134, y, 1, PAL.red);
      drawText(ctx, String(Game.resources[g]), r.x + 178, y, 1, PAL.inkSoft);
    });
    // Ship's stores and dockside hands below the trade table.
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(r.x + 10, r.y + 130, r.w - 20, 2);
    RES_ICONS.water(ctx, r.x + 12, r.y + 138);
    drawText(ctx, "FRESH WATER", r.x + 24, r.y + 140, 1, PAL.ink);
    drawText(ctx, "1C", r.x + 104, r.y + 140, 1, PAL.inkSoft);
    drawText(ctx, Game.resources.water + "/" + Game.waterMax, r.x + 134, r.y + 140, 1, PAL.ink);
    RES_ICONS.provisions(ctx, r.x + 12, r.y + 156);
    drawText(ctx, "PROVISIONS", r.x + 24, r.y + 158, 1, PAL.ink);
    drawText(ctx, "2C", r.x + 104, r.y + 158, 1, PAL.inkSoft);
    drawText(ctx, Game.resources.provisions + "/" + Game.provisionsMax, r.x + 134, r.y + 158, 1, PAL.ink);
  }

  drawDockPanel(ctx, r) {
    drawText(ctx, "COPPER " + Game.resources.coins, r.x + 12, r.y + 10, 1, PAL.inkSoft);
    drawText(ctx, "HULL " + Game.hull + "/" + Game.hullMax + " - MEND 2C EACH",
      r.x + 14, r.y + 19, 1, Game.hull < Game.hullMax ? PAL.red : PAL.ink);
    this.drawUpgradeGrid(ctx);
  }

  // One row per hull class, one column per category; green cells are
  // aboard, grey cells are waiting for your copper.
  drawUpgradeGrid(ctx, gyOverride) {
    const g = this.gridGeom();
    const gy = gyOverride || g.gy;
    const cellX = (c) => g.gx + g.labelW + 4 + c * g.colW;
    const cellW = g.colW - 3, cellH = g.rowH - 4;
    const u = Game.upgrades;
    const h1 = u.hull >= 1;

    const headers = ["OARS", "SAILS", "ARCHERS", "QUARTERS", "MODULE"];
    drawText(ctx, "HULL", g.gx + 2, gy, 1, PAL.inkSoft);
    headers.forEach((hd, c) => {
      drawTextC(ctx, hd, cellX(c) + cellW / 2, gy, 1, PAL.inkSoft);
    });

    // Tier-2 purchase cell helper (sails/archers/quarters on the Liburnian row).
    const tier2 = (key, t, ownedSub) => ({
      t, sub: u[key] >= 2 ? ownedSub : SHIP_UPGRADE_DEFS[key].cost + "C",
      state: u[key] >= 2 ? "owned" : h1 ? "buy" : "locked",
    });

    const rows = HULL_LEVELS.map((hl, lvl) => {
      const owned = u.hull >= lvl;
      // A row stays completely hidden until the row above it is all green —
      // the player only ever sees one locked frontier at a time.
      if (!owned && !(lvl === u.hull + 1 && Game.rowComplete(u.hull))) return null;
      const cells = [];
      // OARS: one row of oars per hull level
      cells.push(lvl === 0 ? null :
        { t: "OARS " + lvl, sub: owned ? "OWNED" : "W/ HULL", state: owned ? "owned" : "locked" });
      // SAILS / ARCHERS / QUARTERS tiers (3+ are warehoused for later)
      if (lvl === 0) {
        cells.push({ t: "SAILS 1", sub: "OWNED", state: "owned" });
        cells.push({ t: "POST 1", sub: "2 MEN", state: "owned" });
        cells.push({ t: "QTRS 1", sub: "4 BUNKS", state: "owned" });
      } else if (lvl === 1) {
        cells.push(tier2("sails", "SAILS 2", "OWNED"));
        cells.push(tier2("archers", "POST 2", "4 MEN"));
        cells.push(tier2("quarters", "QTRS 2", "8 BUNKS"));
      } else {
        cells.push({ t: "SAILS " + (lvl + 1), sub: "SOON", state: "locked" });
        cells.push({ t: "POST " + (lvl + 1), sub: "SOON", state: "locked" });
        cells.push({ t: "QTRS " + (lvl + 1), sub: "SOON", state: "locked" });
      }
      // MODULE: slot n comes with hull n; shows what is fitted in it
      const mod = Game.modules[lvl - 1];
      cells.push(lvl === 0 ? null : {
        t: mod ? MODULES[mod].name.slice(0, 8) : "SLOT " + lvl,
        sub: mod ? "FITTED" : owned ? "EMPTY" : "W/ HULL",
        state: mod ? "owned" : owned ? "buy" : "locked",
      });
      return {
        label: hl.name, lvl,
        sub: owned ? "OWNED" : hl.cost + "C",
        state: owned ? "owned" : "buy",
        cells,
      };
    });

    const paint = (x, y, w, h, state) => {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = state === "owned" ? PAL.green :
        state === "buy" ? PAL.parchDark : PAL.mapLocked;
      ctx.fillRect(x, y, w, h);
    };

    rows.forEach((row, i) => {
      if (!row) return; // hidden future tiers
      const y = gy + g.headerH + i * g.rowH;
      paint(g.gx, y, g.labelW, cellH, row.state);
      drawText(ctx, row.label, g.gx + 3, y + 4, 1, PAL.ink);
      drawText(ctx, "LV" + i + " " + row.sub, g.gx + 3, y + 16, 1,
        row.state === "owned" ? PAL.ink : PAL.sailStripe);
      row.cells.forEach((cell, c) => {
        const x = cellX(c);
        if (!cell) {
          drawTextC(ctx, "-", x + cellW / 2, y + 10, 1, PAL.parchDark);
          return;
        }
        paint(x, y, cellW, cellH, cell.state);
        drawTextC(ctx, cell.t, x + cellW / 2, y + 4, 1,
          cell.state === "locked" ? PAL.inkSoft : PAL.ink);
        drawTextC(ctx, cell.sub, x + cellW / 2, y + 16, 1,
          cell.state === "buy" ? PAL.sailStripe : cell.state === "locked" ? PAL.inkSoft : PAL.ink);
      });
    });
  }

  drawFlavorPanel(ctx, r, line1, line2) {
    drawTextC(ctx, line1, r.x + r.w / 2, r.y + 70, 1, PAL.ink);
    drawTextC(ctx, line2, r.x + r.w / 2, r.y + 92, 1, PAL.sailStripe);
  }

  drawTavernPanel(ctx, r) {
    drawTextC(ctx, "THE WINE IS SWEET, THE SAILORS LOUD.", r.x + r.w / 2, r.y + 34, 1, PAL.inkSoft);
    if (Game.recruit) {
      drawPawnTop(ctx, r.x + 72, r.y + 70, 0, { tunic: PAL.purple });
      drawText(ctx, "A SAILOR, " + Game.recruit + ", SEEKS A BERTH.", r.x + 82, r.y + 68, 1, PAL.ink);
      drawText(ctx, "A STEADY HAND FOR HELM, MAST, OR WAR.", r.x + 82, r.y + 80, 1, PAL.inkSoft);
    } else {
      drawTextC(ctx, "THE BENCHES ARE EMPTY TONIGHT.", r.x + r.w / 2, r.y + 72, 1, PAL.ink);
    }
    // The strong backs drinking in the corner
    drawPawnTop(ctx, r.x + 72, r.y + 142, 0, { tunic: PAL.sandShade });
    drawText(ctx, "ROWERS PULL THE OARS AND ASK NO NAME.", r.x + 82, r.y + 132, 1, PAL.ink);
    drawText(ctx, "X" + Game.rowers + " ABOARD NOW.", r.x + 82, r.y + 144, 1, PAL.inkSoft);
    drawTextC(ctx, "QUESTS ARRIVE WITH A LATER PAGE.", r.x + r.w / 2, r.y + 162, 1, PAL.sailStripe);
    drawText(ctx, "COPPER " + Game.resources.coins + "   BUNKS " + Game.bunksUsed + "/" + Game.crewCap,
      r.x + 14, r.y + r.h - 16, 1, PAL.inkSoft);
  }

  drawBarracksPanel(ctx, r) {
    drawTextC(ctx, "SPEARMEN DRILL IN THE DUST.", r.x + r.w / 2, r.y + 34, 1, PAL.inkSoft);
    drawPawnTop(ctx, r.x + 72, r.y + 70, 0, { tunic: PAL.red });
    drawText(ctx, "MERCENARIES FIGHT OFF BOARDERS AT SEA.", r.x + 82, r.y + 68, 1, PAL.ink);
    drawText(ctx, "X" + Game.mercs + " ABOARD NOW.", r.x + 82, r.y + 80, 1, PAL.inkSoft);
    drawTextC(ctx, "SIEGE WEAPONS ARRIVE WITH A LATER PAGE.", r.x + r.w / 2, r.y + 168, 1, PAL.sailStripe);
    drawText(ctx, "COPPER " + Game.resources.coins + "   BUNKS " + Game.bunksUsed + "/" + Game.crewCap,
      r.x + 14, r.y + r.h - 16, 1, PAL.inkSoft);
  }

  drawShipPanel(ctx, r) {
    drawTextC(ctx, HULL_LEVELS[Game.upgrades.hull].name +
      "  HULL " + Game.hull + "/" + Game.hullMax +
      "  RANGE " + Game.shipPower +
      "  CARGO " + Game.cargoUsed + "/" + Game.cargoCap +
      "  BUNKS " + Game.bunksUsed + "/" + Game.crewCap,
      r.x + r.w / 2, r.y + 22, 1, PAL.ink);
    this.drawUpgradeGrid(ctx, r.y + 38);
    drawTextC(ctx, "UPGRADES AND REPAIRS ARE DONE AT ANY DOCK", r.x + r.w / 2, r.y + 178, 1, PAL.inkSoft);
    const manifest = GOOD_IDS.filter((g) => Game.resources[g] > 0)
      .map((g) => GOODS[g].name + " " + Game.resources[g]).join(", ");
    drawText(ctx, "IN THE HOLD: " + (manifest || "NOTHING BUT HOPE"),
      r.x + 14, r.y + r.h - 16, 1, PAL.inkSoft);
  }
}

// A wild boar in 3/4 view, feet at (x, y). It walks, it roots, it owns
// the ruins now.
function drawBoar(ctx, x, y, t, dir, rooting, walking) {
  x = Math.round(x); y = Math.round(y);
  const step = walking ? (Math.floor(t * 8) % 2) : 0;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 5, y - 1, 10, 2);
  // Legs
  ctx.fillStyle = "#31241a";
  ctx.fillRect(x - 4, y - 2, 1, 2 - step);
  ctx.fillRect(x - 1, y - 2, 1, 2 - (walking ? 1 - step : 0));
  ctx.fillRect(x + 2, y - 2, 1, 2 - step);
  // Body with a bristly ridge
  ctx.fillStyle = "#4f3a26";
  ctx.fillRect(x - 5, y - 6, 10, 4);
  ctx.fillStyle = "#3a2a1b";
  ctx.fillRect(x - 5, y - 7, 9, 1);
  // Head (drops when rooting), snout, tusk, eye
  const hx = dir > 0 ? x + 4 : x - 7;
  const hy = y - 6 + (rooting ? 2 : 0);
  ctx.fillStyle = "#4f3a26";
  ctx.fillRect(hx, hy, 3, 3);
  ctx.fillStyle = "#3a2a1b";
  ctx.fillRect(dir > 0 ? hx + 2 : hx, hy + 2, 1, 1);
  ctx.fillStyle = PAL.eyeWhite;
  ctx.fillRect(dir > 0 ? hx + 3 : hx - 1, hy + 1, 1, 1); // tusk
  // Tail flick
  ctx.fillStyle = "#3a2a1b";
  ctx.fillRect(dir > 0 ? x - 6 : x + 5, y - 6 - (Math.floor(t * 3) % 2), 1, 2);
  // Rooting kicks up a little ash
  if (rooting && Math.sin(t * 9) > 0.4) {
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(dir > 0 ? hx + 3 : hx - 2, y - 1, 2, 1);
  }
}
