// The Map Scroll — a large parchment chart of the Middle Sea and the Euxine,
// bigger than its window: drag (or arrow-key) to scroll it under the frame.
// mode "view" just consults the chart; mode "depart" lets the captain pick
// an available neighboring port and confirm the crossing.

const MAP_W = 880, MAP_H = 460;
const MAP_VIEW = { x: 19, y: 42, w: 442, h: 194 };

class MapScene {
  constructor(returnScene, mode) {
    this.returnScene = returnScene;
    this.mode = mode || "view";
    this.hoverCity = null;
    this.confirm = null; // city id awaiting confirmation
    this.note = null;
    this.noteTimer = 0;
    this.press = null;   // mousedown bookkeeping for pan-vs-click
    this.panning = false;

    // Open centered on wherever the ship lies.
    const here = CITIES[Game.currentPort];
    this.camX = Math.max(0, Math.min(MAP_W - MAP_VIEW.w, here.x - MAP_VIEW.w / 2));
    this.camY = Math.max(0, Math.min(MAP_H - MAP_VIEW.h, here.y - MAP_VIEW.h / 2));

    this.closeBtn = new Button(438, 24, 18, 16, "X", 1);
    this.confirmBtn = new Button(158, 156, 74, 20, "CONFIRM", 1);
    this.cancelBtn = new Button(248, 156, 74, 20, "CANCEL", 1);
  }

  say(msg) {
    this.note = msg;
    this.noteTimer = 2.4;
  }

  close() {
    Scenes.change(this.returnScene);
  }

  inView(mx, my) {
    return mx >= MAP_VIEW.x && mx < MAP_VIEW.x + MAP_VIEW.w &&
           my >= MAP_VIEW.y && my < MAP_VIEW.y + MAP_VIEW.h;
  }

  clampCam() {
    this.camX = Math.max(0, Math.min(MAP_W - MAP_VIEW.w, this.camX));
    this.camY = Math.max(0, Math.min(MAP_H - MAP_VIEW.h, this.camY));
  }

  update(dt, t) {
    if (this.noteTimer > 0) {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0) this.note = null;
    }

    // Confirmation panel captures all input while open.
    if (this.confirm) {
      if (this.confirmBtn.clicked() || Input.pressed("Enter")) {
        Game.depart(this.confirm);
      } else if (this.cancelBtn.clicked() || Input.pressed("Escape")) {
        this.confirm = null;
      }
      return;
    }

    if (this.closeBtn.clicked() || Input.pressed("Escape") || Input.pressed("KeyM")) {
      this.close();
      return;
    }

    // Arrow keys scroll the chart.
    const panSpeed = 220 * dt;
    if (Input.held("ArrowLeft")) this.camX -= panSpeed;
    if (Input.held("ArrowRight")) this.camX += panSpeed;
    if (Input.held("ArrowUp")) this.camY -= panSpeed;
    if (Input.held("ArrowDown")) this.camY += panSpeed;
    this.clampCam();

    // Drag to scroll; a press that never moves is a click on release.
    if (Input.clicked && this.inView(Input.mx, Input.my)) {
      this.press = { mx: Input.mx, my: Input.my, camX: this.camX, camY: this.camY };
      this.panning = false;
    }
    if (this.press && Input.down) {
      const dx = Input.mx - this.press.mx, dy = Input.my - this.press.my;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.panning = true;
      if (this.panning) {
        this.camX = this.press.camX - dx;
        this.camY = this.press.camY - dy;
        this.clampCam();
      }
    }

    // Hover: nearest city to the quill, in world space.
    const wx = Input.mx - MAP_VIEW.x + this.camX;
    const wy = Input.my - MAP_VIEW.y + this.camY;
    this.hoverCity = null;
    if (this.inView(Input.mx, Input.my)) {
      let best = 144; // 12px squared
      for (const id in CITIES) {
        const c = CITIES[id];
        const d = (wx - c.x) ** 2 + (wy - c.y) ** 2;
        if (d < best) { best = d; this.hoverCity = id; }
      }
    }

    if (this.press && Input.released) {
      const wasPan = this.panning;
      this.press = null;
      this.panning = false;
      if (!wasPan && this.hoverCity && this.mode === "depart") {
        const id = this.hoverCity;
        if (id === Game.currentPort) {
          this.say("YOU ARE ALREADY MOORED HERE, CAPTAIN.");
        } else {
          const edge = edgeBetween(Game.currentPort, id);
          if (!edge) {
            this.say("NO ROUTE LINKS " + CITIES[Game.currentPort].name + " TO " + CITIES[id].name + ".");
          } else if (!CrewUI.manned("helm")) {
            this.say("NO HAND AT THE HELM. MAN IT BEFORE CASTING OFF.");
          } else {
            const st = Game.routeStatus(edge);
            if (!st.powered) this.say("YOUR HULL IS TOO WEAK FOR THAT CROSSING.");
            else if (!st.fed) this.say("NOT ENOUGH PROVISIONS FOR THE CREW.");
            else if (!st.watered) this.say("NOT ENOUGH FRESH WATER FOR THE CREW.");
            else this.confirm = id;
          }
        }
      }
    }
  }

  draw(ctx, t) {
    // The world behind the scroll, dimmed.
    this.returnScene.draw(ctx, t);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.globalAlpha = 1;

    // Parchment with wooden rollers.
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(4, 20, 12, 246);
    ctx.fillRect(464, 20, 12, 246);
    ctx.fillStyle = PAL.hullLight;
    ctx.fillRect(7, 20, 3, 246);
    ctx.fillRect(467, 20, 3, 246);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(16, 24, 448, 238);
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(16, 24, 448, 3);
    ctx.fillRect(16, 259, 448, 3);
    ctx.fillRect(16, 27, 3, 232);
    ctx.fillRect(461, 27, 3, 232);

    // The chart itself, scrolling under the window.
    ctx.save();
    ctx.beginPath();
    ctx.rect(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.w, MAP_VIEW.h);
    ctx.clip();
    ctx.translate(MAP_VIEW.x - Math.round(this.camX), MAP_VIEW.y - Math.round(this.camY));

    // Sea wash and coastlines
    ctx.fillStyle = "#c3d4bf";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    this.drawLand(ctx);
    this.drawFlourishes(ctx, t);

    for (const e of EDGES) this.drawRoute(ctx, e, t);
    for (const e of EDGES) this.drawHubs(ctx, e);
    for (const id in CITIES) this.drawCity(ctx, id, t);

    ctx.restore();

    // Header and trim (screen space)
    drawTextC(ctx, "THE MIDDLE SEA", 240, 28, 2, PAL.ink);
    drawText(ctx, "HULL " + Game.shipPower + "  PROV " + Game.resources.provisions +
      "  WATER " + Game.resources.water, 24, 30, 1, PAL.inkSoft);
    this.closeBtn.draw(ctx);

    this.drawLegend(ctx);

    // Bottom info line: notes take priority, then hover details, then a hint.
    let line = null;
    if (this.note) line = this.note;
    else if (this.hoverCity) line = this.hoverLine();
    else if (this.mode === "depart") line = "CLICK A CONNECTED PORT TO SET SAIL - DRAG TO SCROLL";
    else line = "DRAG OR ARROW KEYS TO SCROLL THE CHART - ESC TO CLOSE";
    drawTextC(ctx, line, 240, 241, 1, this.note ? PAL.sailStripe : PAL.inkSoft);

    if (this.confirm) this.drawConfirm(ctx, t);

    drawResourceBar(ctx, t);
  }

  hoverLine() {
    const id = this.hoverCity;
    const c = CITIES[id];
    const ruinTag = Game.isRuined(id) ? " (RUINS)" : "";
    if (id === Game.currentPort) return c.name + " - YOUR SHIP LIES AT ANCHOR HERE";
    const edge = edgeBetween(Game.currentPort, id);
    if (!edge) return c.name + ruinTag + ", " + c.region;
    const st = Game.routeStatus(edge);
    const base = c.name + ruinTag + ": " + edge.hubs + (edge.hubs > 1 ? " STOPS" : " STOP") +
      ", " + edge.cost + " PROV, " + Game.waterCost(edge) + " WATER, HULL " + edge.power;
    if (st.ok) return base;
    if (!st.powered) return base + " - HULL TOO WEAK";
    if (!st.fed) return base + " - TOO FEW PROVISIONS";
    return base + " - TOO LITTLE WATER";
  }

  // Stylized coastlines in world coordinates, after the real Mediterranean —
  // every port on its shore. (Vertices hand-laid from Hessong's chart.)
  drawLand(ctx) {
    const LANDS = [
      // Iberia: east coast down to the narrow strait at Gibraltar
      [[0, 128], [36, 138], [62, 152], [84, 170], [100, 190], [112, 205], [118, 222],
       [110, 238], [96, 252], [76, 262], [58, 272], [50, 276], [42, 284], [30, 282],
       [18, 288], [0, 284]],
      // Gaul: the Gulf of Lion sweeping up to Massilia, Liguria beyond
      [[0, 0], [336, 0], [330, 28], [318, 50], [304, 70], [288, 88], [272, 100],
       [264, 102], [250, 120], [234, 134], [215, 145], [196, 150], [176, 158],
       [158, 168], [142, 178], [135, 185], [124, 196], [110, 188], [84, 166],
       [52, 148], [24, 136], [0, 130]],
      // Italy: Tyrrhenian coast, toe, heel, and the Adriatic side
      [[264, 102], [284, 94], [306, 86], [326, 84], [344, 90], [360, 100], [370, 118],
       [374, 142], [380, 164], [388, 184], [396, 200], [404, 212], [414, 220],
       [418, 228], [412, 236], [404, 240], [396, 244], [400, 252], [390, 254],
       [380, 246], [372, 234], [365, 220], [356, 212], [342, 202], [330, 190],
       [326, 182], [318, 168], [312, 158], [308, 140], [313, 118], [308, 98], [296, 92]],
      // Illyria and the steppe: Dalmatian coast, the Black Sea's north shore
      [[356, 0], [880, 0], [880, 40], [820, 34], [772, 28], [730, 24], [700, 22],
       [664, 28], [638, 42], [620, 68], [604, 94], [586, 122], [568, 140], [552, 150],
       [534, 150], [516, 148], [500, 140], [486, 148], [470, 164], [458, 150],
       [446, 128], [434, 104], [422, 80], [408, 58], [392, 38], [374, 20]],
      // Thrace, holding the Bosporus at Byzantium
      [[566, 138], [582, 120], [600, 105], [612, 122], [614, 150], [590, 152], [572, 146]],
      // Hellas: the isthmus at Corinth, the Peloponnese below the gulf
      [[500, 140], [516, 156], [508, 172], [524, 178], [545, 182], [558, 192],
       [546, 206], [536, 214], [530, 226], [525, 236], [522, 248], [520, 258],
       [510, 262], [500, 258], [492, 262], [502, 272], [498, 286], [486, 294],
       [472, 288], [462, 274], [466, 262], [458, 252], [470, 246], [464, 236],
       [452, 240], [448, 228], [460, 222], [472, 224], [478, 212], [470, 196],
       [476, 180], [470, 166], [486, 150]],
      // Crimea, and the Taman shore across the strait
      [[716, 34], [742, 30], [762, 34], [780, 42], [788, 52], [772, 60], [752, 56],
       [740, 44], [726, 42]],
      [[790, 44], [818, 48], [812, 70], [786, 64]],
      // Anatolia and the Levant, one great sweep to the map's edge
      [[612, 150], [618, 140], [640, 130], [664, 122], [690, 117], [715, 112],
       [732, 110], [756, 112], [788, 110], [820, 106], [852, 103], [880, 108],
       [880, 410], [846, 392], [816, 376], [796, 366], [801, 355], [806, 346],
       [812, 333], [812, 322], [810, 310], [806, 298], [802, 284], [798, 272],
       [792, 258], [772, 250], [748, 254], [724, 250], [700, 246], [676, 252],
       [654, 246], [636, 238], [622, 230], [610, 218], [606, 204], [612, 192],
       [604, 180], [596, 168], [604, 158]],
      // North Africa: the strait, Cape Bon, both gulfs of Syrtis, the
      // Cyrenaica bulge, and the Nile delta
      [[0, 306], [22, 300], [36, 306], [58, 310], [92, 304], [128, 300], [168, 297],
       [210, 294], [248, 296], [270, 299], [288, 305], [281, 317], [300, 328],
       [314, 338], [322, 352], [334, 364], [352, 372], [376, 378], [398, 388],
       [414, 398], [428, 404], [446, 408], [462, 404], [478, 396], [494, 390],
       [510, 384], [528, 388], [548, 386], [566, 390], [586, 398], [606, 406],
       [626, 410], [640, 404], [650, 396], [660, 394], [672, 398], [678, 406],
       [700, 404], [740, 404], [780, 406], [820, 407], [880, 410], [880, 460], [0, 460]],
      // Corsica and Sardinia
      [[268, 124], [280, 118], [284, 142], [276, 154], [266, 146]],
      [[264, 170], [278, 164], [284, 188], [280, 212], [266, 216], [258, 192]],
      // The Baleares
      [[150, 240], [172, 236], [176, 246], [156, 251]],
      // Sicily — Syracuse on her flank, the ruins of home at her tip
      [[350, 262], [382, 256], [408, 260], [398, 278], [382, 298], [362, 292], [346, 276]],
      // Crete: Knossos north, Gortyna south
      [[528, 314], [546, 304], [564, 302], [582, 306], [592, 314], [578, 322],
       [562, 324], [550, 322], [536, 320]],
      // Cyprus
      [[698, 314], [726, 310], [744, 317], [728, 328], [712, 326], [700, 322]],
      // Rhodes, close under the Anatolian corner; Lesbos off Mytilene
      [[644, 266], [660, 268], [656, 278], [642, 274]],
      [[580, 220], [596, 218], [598, 230], [582, 232]],
      // A scatter of Cyclades
      [[540, 278], [546, 276], [547, 282], [541, 283]],
      [[558, 264], [564, 262], [565, 268], [559, 269]],
      [[598, 262], [604, 260], [605, 266], [599, 267]],
    ];
    for (const pts of LANDS) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = "#e9d8a6";
      ctx.fill();
      ctx.strokeStyle = "#8a6c42";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // The Nile, winding south from the delta
    ctx.strokeStyle = "#9db8ab";
    ctx.beginPath();
    ctx.moveTo(658.5, 400);
    ctx.quadraticCurveTo(650, 420, 656.5, 438);
    ctx.quadraticCurveTo(660, 448, 654.5, 460);
    ctx.stroke();
  }

  drawRoute(ctx, e, t) {
    const st = Game.routeStatus(e);
    const touchesHere = e.a === Game.currentPort || e.b === Game.currentPort;
    let color = st.ok ? PAL.hullDark : PAL.mapLocked;
    if (this.mode === "depart" && touchesHere && st.ok) color = PAL.green;
    ctx.fillStyle = color;
    const steps = Math.ceil(e.dist / 5);
    for (let i = 1; i < steps; i++) {
      if (!st.ok && i % 2 === 0) continue; // locked routes fade to sparse dots
      const p = routePoint(e, i / steps);
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
  }

  drawHubs(ctx, e) {
    const st = Game.routeStatus(e);
    const events = Game.routeEvents[e.id] || [];
    if (!st.ok) ctx.globalAlpha = 0.45;
    for (let i = 0; i < events.length; i++) {
      const p = routePoint(e, (i + 1) / (events.length + 1));
      drawEventIcon(ctx, p.x, p.y, events[i]);
    }
    ctx.globalAlpha = 1;
  }

  drawCity(ctx, id, t) {
    const c = CITIES[id];
    const here = id === Game.currentPort;
    const hovered = id === this.hoverCity;
    const ruined = Game.isRuined(id);
    const isNeighbor = !!edgeBetween(Game.currentPort, id);
    const canGo = this.mode === "depart" && isNeighbor &&
      Game.routeStatus(edgeBetween(Game.currentPort, id)).ok;

    // Node diamond (ruins are grey husks with a thread of smoke)
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(c.x - 2, c.y - 4, 5, 9);
    ctx.fillRect(c.x - 4, c.y - 2, 9, 5);
    ctx.fillStyle = here ? PAL.gold : ruined ? PAL.stoneDark : canGo ? PAL.green : PAL.parchment;
    ctx.fillRect(c.x - 1, c.y - 3, 3, 7);
    ctx.fillRect(c.x - 3, c.y - 1, 7, 3);
    if (ruined) {
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(c.x + Math.round(Math.sin(t * 1.5 + c.x) * 1), c.y - 8 - ((t * 5 + c.x) % 5), 1, 2);
    }

    // Pulse ring around where you are (and hovered/depart candidates).
    if (here || hovered || canGo) {
      const r = here ? 6 + Math.round(Math.sin(t * 3) * 1.5) : 6;
      ctx.fillStyle = here ? PAL.gold : canGo ? PAL.green : PAL.inkSoft;
      ctx.fillRect(c.x - r, c.y, 2, 1);
      ctx.fillRect(c.x + r - 1, c.y, 2, 1);
      ctx.fillRect(c.x, c.y - r, 1, 2);
      ctx.fillRect(c.x, c.y + r - 1, 1, 2);
    }

    drawText(ctx, c.name, c.x + c.lx, c.y + c.ly, 1,
      here ? PAL.sailStripe : ruined ? PAL.mapLocked : hovered ? PAL.ink : PAL.inkSoft);
  }

  drawFlourishes(ctx, t) {
    // Compass rose in the western sea
    const cx = 195, cy = 208;
    ctx.fillStyle = PAL.parchDark;
    for (let i = 1; i <= 7; i++) {
      ctx.fillRect(cx - i, cy - i, 1, 1);
      ctx.fillRect(cx + i, cy - i, 1, 1);
      ctx.fillRect(cx - i, cy + i, 1, 1);
      ctx.fillRect(cx + i, cy + i, 1, 1);
    }
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(cx - 9, cy, 19, 1);
    ctx.fillRect(cx, cy - 9, 1, 19);
    ctx.fillStyle = PAL.sailStripe;
    ctx.fillRect(cx, cy - 9, 1, 4);
    drawText(ctx, "N", cx - 1, cy - 17, 1, PAL.inkSoft);

    // Idle wave doodles on the open sea
    ctx.fillStyle = "#9db8ab";
    const waves = [[190, 252], [398, 122], [250, 238], [610, 350], [700, 80], [460, 330],
      [240, 178], [740, 180], [660, 60], [170, 300], [560, 360], [420, 288]];
    for (const [wx, wy] of waves) {
      ctx.fillRect(wx, wy, 3, 1);
      ctx.fillRect(wx + 4, wy - 1, 3, 1);
      ctx.fillRect(wx + 8, wy, 3, 1);
    }

    // Here be monsters — a serpent in the Ionian deeps.
    const sx = 438, sy = 306 + Math.round(Math.sin(t * 1.4) * 1.5);
    ctx.fillStyle = PAL.islandNear;
    ctx.fillRect(sx, sy, 2, 2);
    ctx.fillRect(sx + 2, sy - 2, 2, 2);
    ctx.fillRect(sx + 4, sy, 2, 2);
    ctx.fillRect(sx + 8, sy - 2, 2, 2);
    ctx.fillRect(sx + 10, sy, 2, 2);
    ctx.fillRect(sx + 14, sy - 3, 3, 4);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(sx + 17, sy - 2, 2, 1);
  }

  drawLegend(ctx) {
    const y = 251;
    let x = 26;
    const item = (drawer, label) => {
      drawer(ctx, x + 4, y + 2);
      drawText(ctx, label, x + 11, y, 1, PAL.inkSoft);
      x += 11 + textWidth(label, 1) + 12;
    };
    item((c, ix, iy) => drawEnemyIcon(c, ix, iy, "easy"), "EASY FOE");
    item((c, ix, iy) => drawEnemyIcon(c, ix, iy, "medium"), "TOUGH FOE");
    item((c, ix, iy) => drawStoryIcon(c, ix, iy), "STORY");
    item((c, ix, iy) => drawUnknownIcon(c, ix, iy), "UNKNOWN");
    drawText(ctx, this.mode === "depart" ? "ESC CANCEL" : "ESC CLOSE", 396, y, 1, PAL.inkSoft);
  }

  drawConfirm(ctx, t) {
    const edge = edgeBetween(Game.currentPort, this.confirm);
    const c = CITIES[this.confirm];
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(134, 102, 216, 80);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(130, 98, 216, 80);
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(130, 98, 216, 3);
    ctx.fillRect(130, 175, 216, 3);
    drawTextC(ctx, "SET SAIL FOR " + c.name + "?", 238, 108, 1, PAL.ink);
    drawTextC(ctx, edge.hubs + (edge.hubs > 1 ? " STOPS" : " STOP") + " AHEAD, " +
      edge.cost + " PROVISIONS, " + Game.waterCost(edge) + " WATER", 238, 122, 1, PAL.inkSoft);
    const events = Game.routeEvents[edge.id] || [];
    let ix = 238 - (events.length - 1) * 8;
    for (const ev of events) {
      drawEventIcon(ctx, ix, 138, ev);
      ix += 16;
    }
    this.confirmBtn.draw(ctx);
    this.cancelBtn.draw(ctx);
  }
}
