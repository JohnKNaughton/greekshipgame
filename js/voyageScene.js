// The crossing, seen from above — your deck holds the center of the screen
// while the sea streams past. Each leg is ~20s of downtime to walk your
// pawns between stations before the next charted event. Manned benches and
// the mast make the legs pass faster; the helm keeps her ready to dodge.

const LEG_DURATION = 20;

class VoyageScene {
  constructor(fromId, toId) {
    this.music = "calm";
    this.from = fromId;
    this.to = toId;
    this.edge = edgeBetween(fromId, toId);
    this.events = (Game.routeEvents[this.edge.id] || []).slice();
    this.legs = this.events.length + 1;
    this.legIndex = 0;
    this.legTime = 0;
    this.pending = false;
    this.arriving = false;
    this.notice = null;
    this.noticeTimer = 0;
    this.splashes = [];
    this.splashTimer = 2;
    this.drift = 0;

    this.mapBtn = new Button(392, 234, 80, 28, "MAP", 2);
    // Time is the captain's to command: pause, sail, or borrow the god's sandals.
    this.speed = 1;
    this.pauseBtn = new Button(8, 240, 20, 18, "II", 1);
    this.playBtn = new Button(30, 240, 20, 18, ">", 1);
    this.hermesBtn = new Button(52, 240, 74, 18, "HERMES MODE", 1);
    buildDeck();
    // Center the deck whatever her hull length is.
    this.dx = Math.round((VIRTUAL_W - DECK.W) / 2);
    this.dy = Math.round(154 - DECK.H / 2);
    CrewUI.panelAnchor = "top";
  }

  get progress() {
    return Math.min(1, (this.legIndex + Math.min(this.legTime / LEG_DURATION, 1)) / this.legs);
  }

  say(msg) {
    this.notice = msg;
    this.noticeTimer = 3;
  }

  eventDone() {
    this.pending = false;
    this.legIndex++;
    this.legTime = 0;
    this.say(this.legIndex < this.events.length ?
      "THE CREW BREATHES AGAIN. MORE TROUBLE CHARTED AHEAD." :
      "CLEAR WATER FROM HERE TO " + CITIES[this.to].name + ".");
  }

  launchEvent() {
    this.pending = true;
    let ev = this.events[this.legIndex];
    if (ev.fixed) {
      Scenes.change(new StoryScene(this, FIXED_STORIES[ev.fixed]));
      return;
    }
    if (ev.type === "unknown") {
      ev = Math.random() < 0.5 ? { type: "enemy", tier: rollEnemyTier() } : { type: "story" };
      this.events[this.legIndex] = ev;
    }
    if (ev.type === "enemy") {
      Scenes.change(new CombatScene(this, pickEnemy(ev.tier)));
    } else {
      Scenes.change(new StoryScene(this, pickStory()));
    }
  }

  update(dt, t) {
    if (this.pauseBtn.clicked() || Input.pressed("Space")) {
      this.speed = this.speed === 0 ? 1 : 0;
    }
    if (this.playBtn.clicked()) this.speed = 1;
    if (this.hermesBtn.clicked()) this.speed = 5;
    dt *= this.speed;

    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;
      if (this.noticeTimer <= 0) this.notice = null;
    }

    CrewUI.update(dt, { training: true });
    if (CrewUI.handleClick(this.dx, this.dy)) return;

    if (this.mapBtn.clicked() || Input.pressed("KeyM")) {
      Scenes.change(new MapScene(this, "view"));
      return;
    }
    const helmed = !!CrewUI.manned("helm");

    // Fish break the surface out on the open water.
    this.splashTimer -= dt;
    if (this.splashTimer <= 0) {
      this.splashTimer = 1.5 + Math.random() * 3.5;
      const lane = Math.random() < 0.5;
      this.splashes.push({
        x: 40 + Math.random() * 400,
        y: lane ? 78 + Math.random() * 34 : 204 + Math.random() * 28,
        p: 0,
      });
    }
    for (const s of this.splashes) s.p += dt / 1.4;
    this.splashes = this.splashes.filter((s) => s.p < 1);

    if (this.pending) return;

    // No hand on the wheel, no way on the ship: she just drifts.
    if (!helmed) return;

    // Way on the ship: oars and a manned mast shorten the leg.
    const rowBonus = 0.06 * CrewUI.benchesManned();
    const mastBonus = CrewUI.manned("mast") ? 0.2 : 0;
    const speed = 1 + rowBonus + mastBonus;
    this.legTime += dt * speed;
    this.drift += dt * speed * 30;

    if (this.legTime >= LEG_DURATION) {
      if (this.legIndex < this.events.length) {
        this.launchEvent();
      } else if (!this.arriving) {
        this.arriving = true;
        Game.arriveAt(this.to);
        if (!Game.bossDefeated && Game.year <= VILLAIN_RETURN_YEAR) {
          Scenes.change(new CombatScene(null, makeBoss()));
        } else {
          Scenes.change(new PortScene());
        }
      }
    }
  }

  draw(ctx, t) {
    drawTopSea(ctx, t, this.drift);

    // Islands slipping by in the outer lanes
    const span = VIRTUAL_W + 260;
    const wrap = (x) => ((x - this.progress * 900) % span + span) % span - 130;
    drawTopIsland(ctx, wrap(340), 88, 20, t);
    drawTopIsland(ctx, wrap(720), 214, 16, t);
    drawTopIsland(ctx, wrap(1020), 94, 11, t);

    // Splashes: rings, and a silver flash mid-leap
    for (const s of this.splashes) {
      const r = Math.round(s.p * 7);
      ctx.fillStyle = PAL.seaFoam;
      ctx.fillRect(Math.round(s.x - r), Math.round(s.y), r * 2, 1);
      if (s.p > 0.25 && s.p < 0.6) {
        ctx.fillStyle = PAL.silverBar;
        ctx.fillRect(Math.round(s.x - 2), Math.round(s.y - 3), 4, 2);
      }
    }

    // Wake streaming from the stern
    ctx.fillStyle = PAL.seaFoam;
    for (let i = 0; i < 6; i++) {
      const wx = this.dx - 4 - i * 16 - ((t * 44) % 16);
      if (wx > 0) {
        ctx.fillRect(Math.round(wx), this.dy + DECK.cy - 14 - i, 9 - i, 1);
        ctx.fillRect(Math.round(wx), this.dy + DECK.cy + 14 + i, 9 - i, 1);
      }
    }
    // Bow spray
    ctx.fillRect(this.dx + DECK.W - 2 + Math.round(Math.sin(t * 6) * 2), this.dy + DECK.cy - 3, 4, 2);
    ctx.fillRect(this.dx + DECK.W - 2 + Math.round(Math.sin(t * 6 + 2) * 2), this.dy + DECK.cy + 3, 4, 2);

    const deckOpts = { sailFull: true, rowing: CrewUI.benchesManned() > 0 };
    drawDeckShip(ctx, this.dx, this.dy, t, deckOpts);
    drawDeckUprights(ctx, this.dx, this.dy, t, deckOpts);

    // Route banner
    drawTextC(ctx, CITIES[this.from].name + " TO " + CITIES[this.to].name,
      VIRTUAL_W / 2, 24, 2, PAL.parchment);

    // Progress chart
    const rx = 110, rw = 260, ry = 48;
    ctx.fillStyle = PAL.ink;
    for (let x = rx; x <= rx + rw; x += 6) ctx.fillRect(x, ry, 3, 1);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(rx - 2, ry - 2, 4, 5);
    ctx.fillRect(rx + rw - 2, ry - 2, 4, 5);
    for (let i = 0; i < this.events.length; i++) {
      const hx = rx + ((i + 1) / this.legs) * rw;
      if (i < this.legIndex) ctx.globalAlpha = 0.4;
      drawEventIcon(ctx, hx, ry, this.events[i]);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(Math.round(rx + this.progress * rw) - 1, ry - 4, 3, 3);

    if (this.speed === 0) {
      drawTextC(ctx, "PAUSED", VIRTUAL_W / 2, 66, 1, PAL.parchment);
    } else if (!this.pending && !CrewUI.manned("helm")) {
      if (Math.sin(t * 3) > -0.5) {
        drawTextC(ctx, "NO HAND AT THE HELM - THE SHIP DRIFTS", VIRTUAL_W / 2, 66, 1, PAL.red);
      }
    } else if (this.notice) {
      drawTextC(ctx, this.notice, VIRTUAL_W / 2, 66, 1, PAL.parchment);
    } else if (this.legIndex < this.events.length) {
      const ev = this.events[this.legIndex];
      const what = ev.type === "enemy" ? "A SAIL" : ev.type === "story" ? "SOMETHING" : "AN OMEN";
      drawTextC(ctx, what + " ON THE HORIZON - MAKE READY", VIRTUAL_W / 2, 66, 1, PAL.parchment);
    }

    const info = CrewUI.hoverInfo();
    if (info) drawTooltip(ctx, info, Input.mx, Input.my - 14);

    this.pauseBtn.draw(ctx, { forceHot: this.speed === 0 });
    this.playBtn.draw(ctx, { forceHot: this.speed === 1 });
    this.hermesBtn.draw(ctx, { forceHot: this.speed === 5 });
    this.mapBtn.draw(ctx, { icon: drawScrollButtonIcon });
    CrewUI.drawRoster(ctx, t);
    CrewUI.drawStationPanel(ctx, t);
    CrewUI.drawDrag(ctx);
    drawResourceBar(ctx, t);
  }
}
