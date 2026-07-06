// A story encounter — scripted tale on a parchment, choices that reach into
// your stores, then back to the open sea.

class StoryScene {
  constructor(voyage, story) {
    this.music = "calm";
    this.voyage = voyage;
    this.story = story;
    this.outcome = null;

    this.choiceBtns = story.choices.map((ch, i) =>
      new Button(120, 150 + i * 26, 240, 20, ch.label + storyNeedLabel(ch.need), 1));
    this.contBtn = new Button(190, 196, 100, 20, "CONTINUE", 1);
  }

  update(dt, t) {
    if (this.outcome) {
      if (this.contBtn.clicked() || Input.pressed("Enter")) {
        this.voyage.eventDone();
        Scenes.change(this.voyage);
      }
      return;
    }
    for (let i = 0; i < this.story.choices.length; i++) {
      const ch = this.story.choices[i];
      if (this.choiceBtns[i].clicked()) {
        if (!storyNeedMet(ch.need)) return;
        this.outcome = ch.resolve();
      }
    }
  }

  draw(ctx, t) {
    drawSeascape(ctx, VIRTUAL_W, VIRTUAL_H, t);
    ctx.save();
    ctx.translate(VIRTUAL_W / 2, HORIZON + 48);
    ctx.scale(2, 2);
    drawShip(ctx, 0, 0, t);
    ctx.restore();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.globalAlpha = 1;

    // The tale, on parchment
    const r = { x: 96, y: 42, w: 288, h: 190 };
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(r.x + 3, r.y + 3, r.w, r.h);
    ctx.fillStyle = PAL.parchment;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PAL.parchDark;
    ctx.fillRect(r.x, r.y, r.w, 3);
    ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);

    drawStoryIcon(ctx, r.x + 18, r.y + 16);
    drawTextC(ctx, this.story.title, r.x + r.w / 2, r.y + 10, 2, PAL.ink);

    if (this.outcome) {
      const lines = wrapText(this.outcome, r.w - 40, 1);
      lines.forEach((ln, i) => {
        drawTextC(ctx, ln, r.x + r.w / 2, r.y + 62 + i * 11, 1, PAL.ink);
      });
      this.contBtn.draw(ctx);
    } else {
      const lines = wrapText(this.story.text, r.w - 32, 1);
      lines.forEach((ln, i) => {
        drawTextC(ctx, ln, r.x + r.w / 2, r.y + 34 + i * 11, 1, PAL.inkSoft);
      });
      this.story.choices.forEach((ch, i) => {
        this.choiceBtns[i].draw(ctx, { disabled: !storyNeedMet(ch.need) });
      });
    }

    drawResourceBar(ctx, t);
  }
}
