// Title screen — POLYREME wordmark over a living Mediterranean, with the main menu.

class TitleScene {
  constructor() {
    this.items = [
      { label: "PLAY",         action: () => { Game.newGame(); Scenes.change(new NameScene()); } },
      { label: "SETTINGS",     action: () => this.toast("THE SHIPWRIGHT IS STILL CARVING THIS.") },
      { label: "HALL OF FAME", action: () => this.toast("NO LEGENDS YET. SAIL AND BECOME ONE!") },
      { label: "EXIT",         action: () => this.tryExit() },
    ];
    this.selected = 0;
    this.toastMsg = null;
    this.toastTimer = 0;
    this.menuTop = 132;
    this.rowH = 26;
    this.btnW = 150;
    this.btnH = 20;
  }

  toast(msg) {
    this.toastMsg = msg;
    this.toastTimer = 2.6;
  }

  tryExit() {
    window.close();
    // Browsers usually refuse to close a tab a script didn't open.
    this.toast("THE GODS WILL NOT RELEASE YOU. CLOSE THE TAB, MORTAL.");
  }

  buttonRect(i) {
    return {
      x: (VIRTUAL_W - this.btnW) / 2,
      y: this.menuTop + i * this.rowH,
      w: this.btnW,
      h: this.btnH,
    };
  }

  update(dt, t) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMsg = null;
    }

    // Mouse hover selects; click activates.
    for (let i = 0; i < this.items.length; i++) {
      const r = this.buttonRect(i);
      if (Input.mx >= r.x && Input.mx < r.x + r.w && Input.my >= r.y && Input.my < r.y + r.h) {
        this.selected = i;
        if (Input.clicked) this.items[i].action();
      }
    }

    // Keyboard: arrows/WS to move, Enter/Space to choose.
    if (Input.pressed("ArrowDown") || Input.pressed("KeyS")) {
      this.selected = (this.selected + 1) % this.items.length;
    }
    if (Input.pressed("ArrowUp") || Input.pressed("KeyW")) {
      this.selected = (this.selected + this.items.length - 1) % this.items.length;
    }
    if (Input.pressed("Enter") || Input.pressed("Space")) {
      this.items[this.selected].action();
    }
  }

  draw(ctx, t) {
    drawSeascape(ctx, VIRTUAL_W, VIRTUAL_H, t);
    drawShip(ctx, 402, HORIZON + 42, t);

    // Wordmark: each letter bobs on its own wave.
    const title = "POLYREME";
    const scale = 6;
    let x = (VIRTUAL_W - textWidth(title, scale)) / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const dy = Math.sin(t * 1.8 + i * 0.55) * 2.5;
      drawText(ctx, ch, x + 2, 26 + dy + 2, scale, PAL.ink);
      drawText(ctx, ch, x, 26 + dy, scale, i % 2 === 0 ? PAL.parchment : PAL.gold);
      x += textWidth(ch, scale) + scale;
    }
    drawTextC(ctx, "TRADE. ROW. SURVIVE THE WINE-DARK SEA.", VIRTUAL_W / 2, 74, 1, PAL.ink);

    // Menu buttons
    for (let i = 0; i < this.items.length; i++) {
      const r = this.buttonRect(i);
      const hot = i === this.selected;
      // Panel
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
      ctx.fillStyle = hot ? PAL.parchment : PAL.inkSoft;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = hot ? PAL.parchDark : PAL.ink;
      ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
      // Label
      const ty = r.y + Math.floor((r.h - 3 - FONT_H * 2) / 2);
      drawTextC(ctx, this.items[i].label, VIRTUAL_W / 2, ty, 2, hot ? PAL.ink : PAL.parchment);
      // Selection oars
      if (hot) {
        const wob = Math.round(Math.sin(t * 5) * 2);
        drawText(ctx, ">", r.x - 12 + wob, ty, 2, PAL.gold);
        drawText(ctx, "<", r.x + r.w + 6 - wob, ty, 2, PAL.gold);
      }
    }

    // Toast banner
    if (this.toastMsg) {
      const w = textWidth(this.toastMsg, 1) + 12;
      const bx = (VIRTUAL_W - w) / 2;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(bx, VIRTUAL_H - 30, w, 12);
      drawTextC(ctx, this.toastMsg, VIRTUAL_W / 2, VIRTUAL_H - 27, 1, PAL.parchment);
    }

    drawText(ctx, "V0.1", 4, VIRTUAL_H - 8, 1, PAL.seaFoam);
    const credit = "VIBECODED WITH BRADY + FABLE";
    drawText(ctx, credit, VIRTUAL_W - textWidth(credit, 1) - 4, VIRTUAL_H - 8, 1, PAL.seaFoam);
  }
}
