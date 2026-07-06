// Run bookends: naming your ship, the burning of home, and — for the few
// who last fifty years and win — vengeance.

const SHIP_NAME_OMENS = [
  "EMBER", "LAST LIGHT", "ASHBORN", "SEA WREN", "GULL", "PHOENIX",
  "SALTBORN", "WAVE EATER", "MYRTLE", "VENGEANCE", "DAWNCHASER", "KINGFISHER",
];

class NameScene {
  constructor() {
    this.music = "calm";
    this.name = SHIP_NAME_OMENS[Math.floor(Math.random() * SHIP_NAME_OMENS.length)];
    this.confirmBtn = new Button(150, 196, 100, 22, "CONFIRM", 1);
    this.omenBtn = new Button(262, 196, 100, 22, "NEW OMEN", 1);
  }

  update(dt, t) {
    for (const ch of Input.typed) {
      if (/[a-zA-Z0-9 '\-]/.test(ch) && this.name.length < 14) {
        this.name += ch.toUpperCase();
      }
    }
    if (Input.pressed("Backspace")) this.name = this.name.slice(0, -1);
    if (this.omenBtn.clicked()) {
      this.name = SHIP_NAME_OMENS[Math.floor(Math.random() * SHIP_NAME_OMENS.length)];
    }
    if ((this.confirmBtn.clicked() || Input.pressed("Enter")) && this.name.trim().length) {
      Game.shipName = this.name.trim();
      Scenes.change(new IntroScene());
    }
  }

  draw(ctx, t) {
    drawSeascape(ctx, VIRTUAL_W, VIRTUAL_H, t);
    ctx.save();
    ctx.translate(VIRTUAL_W / 2, HORIZON + 60);
    ctx.scale(2, 2);
    drawShip(ctx, 0, 0, t, { oars: false });
    ctx.restore();

    const r = { x: 110, y: 36, w: 260, h: 120 };
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(r.x + 3, r.y + 3, r.w, r.h);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawTextC(ctx, "NAME YOUR SHIP", VIRTUAL_W / 2, r.y + 10, 2, PAL.ink);
    drawTextC(ctx, "SHE IS ALL THAT REMAINS OF HOME", VIRTUAL_W / 2, r.y + 26, 1, PAL.sailStripe);

    // Input line with a blinking caret
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(r.x + 30, r.y + 46, r.w - 60, 22);
    const caret = Math.sin(t * 5) > 0 ? "'" : " ";
    drawTextC(ctx, this.name + caret, VIRTUAL_W / 2, r.y + 52, 2, PAL.ink);
    drawTextC(ctx, "TYPE TO CHANGE HER NAME - ENTER TO LAUNCH", VIRTUAL_W / 2, r.y + 78, 1, PAL.inkSoft);

    this.confirmBtn.draw(ctx);
    this.omenBtn.draw(ctx);
  }
}

class IntroScene {
  constructor() {
    this.music = null; // silence, but for the waves
    this.t0 = 0;
    this.lines = [
      "775 BC.",
      "THE DEVOURER CAME AT DAWN. BY DUSK, " + CITIES.home.name + " WAS ASH.",
      "EVERYONE YOU KNEW AND LOVED IS GONE.",
      "ONLY THE " + Game.shipName + " REMAINS, AND THE OPEN SEA.",
      "IN FIFTY YEARS HE WILL RETURN TO FINISH WHAT HE BEGAN.",
      "SURVIVE. TRADE. GROW STRONG. BE READY.",
    ];
  }

  update(dt, t) {
    this.t0 += dt;
    if (Input.clicked || Input.pressed("Enter") || Input.pressed("Space")) {
      if (this.t0 < this.lines.length * 1.3) this.t0 = this.lines.length * 1.3;
      else Scenes.change(new PortScene());
    }
  }

  draw(ctx, t) {
    // Night. Home burns on the horizon; you do not look back for long.
    ctx.fillStyle = "#11203a";
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.fillStyle = PAL.white;
    for (let i = 0; i < 24; i++) {
      const sx = (i * 97) % VIRTUAL_W;
      const sy = (i * 53) % 110;
      if (Math.sin(t * 2 + i) > -0.6) ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.fillStyle = "#0c1830";
    ctx.fillRect(0, 150, VIRTUAL_W, VIRTUAL_H - 150);
    // The burning town, far off on the left
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(0, 128, 90, 22);
    ctx.fillRect(10, 118, 30, 12);
    ctx.fillRect(48, 122, 22, 10);
    for (let i = 0; i < 6; i++) {
      const fx = 8 + i * 13;
      const flick = Math.sin(t * 7 + i * 2.3) * 2;
      ctx.fillStyle = i % 2 ? PAL.sun : PAL.sailStripe;
      ctx.fillRect(fx, 116 - flick, 3, 4 + flick);
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(fx - 1, 96 - ((t * 9 + i * 11) % 18), 2, 2); // smoke
    }
    ctx.fillStyle = "#d8683c";
    ctx.fillRect(0, 148, 96, 2); // fireglow on the water
    // Your ship, small, sailing away east
    ctx.save();
    ctx.translate(330, 168);
    ctx.globalAlpha = 0.85;
    drawShip(ctx, 0, 0, t, { oars: false });
    ctx.restore();
    ctx.globalAlpha = 1;

    const shown = Math.floor(this.t0 / 1.3);
    this.lines.slice(0, shown + 1).forEach((ln, i) => {
      drawTextC(ctx, ln, VIRTUAL_W / 2, 196 + i * 11, 1,
        i === 0 ? PAL.parchment : i >= 4 ? PAL.sailStripe : PAL.seaFoam);
    });
    if (shown >= this.lines.length) {
      if (Math.sin(t * 3) > -0.3) {
        drawTextC(ctx, "CLICK TO BEGIN", VIRTUAL_W / 2, 24, 1, PAL.gold);
      }
    }
  }
}

class VictoryScene {
  constructor() {
    this.music = "calm";
  }

  update(dt, t) {
    if (Input.clicked || Input.pressed("Enter")) {
      Scenes.change(new TitleScene());
    }
  }

  draw(ctx, t) {
    drawSeascape(ctx, VIRTUAL_W, VIRTUAL_H, t);
    ctx.save();
    ctx.translate(VIRTUAL_W / 2, HORIZON + 55);
    ctx.scale(2, 2);
    drawShip(ctx, 0, 0, t);
    ctx.restore();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.globalAlpha = 1;

    drawTextC(ctx, "VENGEANCE", VIRTUAL_W / 2 + 2, 34 + 2, 5, PAL.ink);
    drawTextC(ctx, "VENGEANCE", VIRTUAL_W / 2, 34, 5, PAL.gold);
    drawTextC(ctx, "IN 725 BC YOU MET THE DEVOURER'S FLAGSHIP AND BROKE IT.",
      VIRTUAL_W / 2, 84, 1, PAL.ink);
    drawTextC(ctx, "THE DEAD OF " + CITIES.home.name + " MAY REST.",
      VIRTUAL_W / 2, 96, 1, PAL.ink);
    drawTextC(ctx, "THE " + Game.shipName + " SAILS HOME WITH " +
      Game.resources.coins + " COPPER AND " + Game.bunksUsed + " SOULS ABOARD.",
      VIRTUAL_W / 2, 116, 1, PAL.inkSoft);
    if (Math.sin(t * 3) > -0.3) {
      drawTextC(ctx, "CLICK TO RETURN TO THE TITLE", VIRTUAL_W / 2, VIRTUAL_H - 24, 1, PAL.parchment);
    }
  }
}
