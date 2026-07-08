// Small shared UI pieces — pixel buttons, tooltips, the resource bar,
// and map event icons.

class Button {
  constructor(x, y, w, h, label, scale) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label; // string or () => string
    this.scale = scale || 2;
  }

  get text() {
    return typeof this.label === "function" ? this.label() : this.label;
  }

  get hovered() {
    return Input.mx >= this.x && Input.mx < this.x + this.w &&
           Input.my >= this.y && Input.my < this.y + this.h;
  }

  clicked() {
    return this.hovered && Input.clicked;
  }

  draw(ctx, opts) {
    opts = opts || {};
    const hot = (this.hovered && !opts.disabled) || opts.forceHot;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(this.x + 2, this.y + 2, this.w, this.h);
    ctx.fillStyle = hot ? PAL.parchment : PAL.inkSoft;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = hot ? PAL.parchDark : PAL.ink;
    ctx.fillRect(this.x, this.y + this.h - 3, this.w, 3);
    const iconW = opts.icon ? 16 : 0;
    const ty = this.y + Math.floor((this.h - 3 - FONT_H * this.scale) / 2);
    const color = opts.disabled ? PAL.mapLocked : hot ? PAL.ink : PAL.parchment;
    drawTextC(ctx, this.text, this.x + this.w / 2 + iconW / 2, ty, this.scale, color);
    if (opts.icon) {
      opts.icon(ctx, this.x + 10, this.y + Math.floor((this.h - 2) / 2), hot);
    }
  }
}

// Little ink box with a line of text, clamped on-screen.
function drawTooltip(ctx, text, x, y) {
  const w = textWidth(text, 1) + 8;
  const tx = Math.max(2, Math.min(VIRTUAL_W - w - 2, Math.round(x - w / 2)));
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(tx, Math.round(y), w, 11);
  drawText(ctx, text, tx + 4, Math.round(y) + 3, 1, PAL.parchment);
}

// --- Resource bar: always across the top of every game screen ---

const RES_ICONS = {
  hull(ctx, x, y) {
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(x, y + 3, 7, 3);
    ctx.fillRect(x + 1, y + 6, 5, 1);
    ctx.fillStyle = PAL.hullLight;
    ctx.fillRect(x + 6, y + 1, 1, 3);
    ctx.fillRect(x, y + 2, 1, 2);
    ctx.fillStyle = PAL.eyeDark;
    ctx.fillRect(x + 5, y + 4, 1, 1);
  },
  water(ctx, x, y) {
    ctx.fillStyle = PAL.seaLight;
    ctx.fillRect(x + 2, y + 2, 3, 4);
    ctx.fillRect(x + 3, y + 1, 1, 1);
    ctx.fillStyle = PAL.seaFoam;
    ctx.fillRect(x + 2, y + 4, 1, 1);
  },
  provisions(ctx, x, y) {
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(x + 1, y + 3, 5, 4);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(x + 2, y + 2, 3, 1);
    ctx.fillStyle = PAL.sandShade;
    ctx.fillRect(x + 2, y + 5, 3, 1);
  },
  coins(ctx, x, y) {
    ctx.fillStyle = PAL.copper;
    ctx.fillRect(x + 1, y + 2, 5, 5);
    ctx.fillRect(x + 2, y + 1, 3, 7);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + 2, y + 3, 2, 2);
  },
  lumber(ctx, x, y) {
    ctx.fillStyle = PAL.hull;
    ctx.fillRect(x, y + 2, 7, 2);
    ctx.fillRect(x + 1, y + 5, 6, 2);
    ctx.fillStyle = PAL.hullLight;
    ctx.fillRect(x, y + 2, 1, 2);
    ctx.fillRect(x + 1, y + 5, 1, 2);
  },
  pottery(ctx, x, y) {
    ctx.fillStyle = PAL.copper;
    ctx.fillRect(x + 2, y + 3, 3, 4);
    ctx.fillRect(x + 1, y + 4, 5, 2);
    ctx.fillStyle = PAL.hullDark;
    ctx.fillRect(x + 1, y + 2, 5, 1);
  },
  textiles(ctx, x, y) {
    ctx.fillStyle = PAL.purple;
    ctx.fillRect(x, y + 3, 7, 4);
    ctx.fillStyle = "#b57fd0";
    ctx.fillRect(x, y + 4, 7, 1);
  },
  silver(ctx, x, y) {
    ctx.fillStyle = PAL.silverBar;
    ctx.fillRect(x + 1, y + 4, 6, 3);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x + 2, y + 3, 4, 1);
  },
  gold(ctx, x, y) {
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + 1, y + 4, 6, 3);
    ctx.fillStyle = PAL.sunCore;
    ctx.fillRect(x + 2, y + 3, 4, 1);
  },
};

const RES_BAR_ITEMS = [
  { key: "hull", value: () => Game.hull + "/" + Game.hullMax,
    color: () => Game.hull <= Game.hullMax * 0.35 ? PAL.red : Game.hull < Game.hullMax ? PAL.yellow : PAL.white,
    tip: () => "HULL - REPAIR AT ANY DOCK" },
  { key: "water", value: () => Game.resources.water + "/" + Game.waterMax,
    tip: () => "FRESH WATER" },
  { key: "provisions", value: () => Game.resources.provisions + "/" + Game.provisionsMax,
    tip: () => "PROVISIONS" },
  { key: "coins",      tip: () => "COPPER COINS" },
  { key: "lumber",     tip: () => "LUMBER (CARGO)" },
  { key: "pottery",    tip: () => "POTTERY (CARGO)" },
  { key: "textiles",   tip: () => "TEXTILES (CARGO)" },
  { key: "silver",     tip: () => "SILVER (CARGO)" },
  { key: "gold",       tip: () => "GOLD (CARGO)" },
];

const RES_BAR_H = 16;

function drawResourceBar(ctx, t) {
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(0, 0, VIRTUAL_W, RES_BAR_H);
  ctx.fillStyle = PAL.inkSoft;
  ctx.fillRect(0, RES_BAR_H - 1, VIRTUAL_W, 1);

  let tip = null;
  let x = 4;
  for (const item of RES_BAR_ITEMS) {
    // Divider: essentials on the left, tradable cargo on the right.
    if (item.key === "lumber") {
      drawText(ctx, "CARGO:", x + 2, 6, 1, PAL.parchDark);
      x += textWidth("CARGO:", 1) + 8;
    }
    const val = item.value ? item.value() : String(Game.resources[item.key]);
    RES_ICONS[item.key](ctx, x, 4);
    const isGood = GOODS[item.key] !== undefined;
    drawText(ctx, val, x + 10, 6, 1,
      item.color ? item.color() :
      isGood && Game.resources[item.key] === 0 ? PAL.inkSoft : PAL.white);
    const w = 10 + textWidth(val, 1) + 9;
    if (Input.my < RES_BAR_H && Input.mx >= x - 2 && Input.mx < x + w - 4) tip = item.tip();
    x += w;
  }

  // Year and weather, right-aligned like a ship's log heading.
  const yearStr = Game.year + " BC";
  const yx = VIRTUAL_W - textWidth(yearStr, 1) - 5;
  drawText(ctx, yearStr, yx, 6, 1, PAL.parchment);
  const wx = yx - textWidth(Game.weather, 1) - 16;

  // Dodge, right of the cargo counters: the manned-stations formula, live.
  const dodgeStr = "DODGE: " + currentDodge() + "%";
  const ddx = Math.min(x + 6, wx - textWidth(dodgeStr, 1) - 8);
  drawText(ctx, dodgeStr, ddx, 6, 1, PAL.seaFoam);
  if (Input.my < RES_BAR_H && Input.mx >= ddx && Input.mx < wx - 2) {
    tip = "10% PER MANNED LEVEL OF HELM, SAILS, AND OARS";
  }
  ctx.fillStyle = PAL.sun;
  ctx.fillRect(wx + 1, 5, 5, 5);
  ctx.fillRect(wx, 6, 7, 3);
  ctx.fillStyle = PAL.sunCore;
  ctx.fillRect(wx + 2, 6, 3, 3);
  drawText(ctx, Game.weather, wx + 10, 6, 1, PAL.white);
  if (Input.my < RES_BAR_H && Input.mx >= wx) {
    const left = Game.year - VILLAIN_RETURN_YEAR;
    tip = Input.mx >= yx - 2
      ? (left > 0 ? "THE DEVOURER RETURNS IN " + left + (left === 1 ? " YEAR" : " YEARS") : "THE HOUR HAS COME")
      : "WEATHER: FAIR SEAS AHEAD";
  }

  if (tip) drawTooltip(ctx, tip, Input.mx, RES_BAR_H + 3);
}

// --- Map event hub icons ---

const TIER_COLORS = { easy: PAL.green, medium: PAL.yellow, hard: PAL.red };

// Crossbones X in the enemy pool's color.
function drawEnemyIcon(ctx, x, y, tier) {
  ctx.fillStyle = PAL.ink;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(x - 3 + i, y - 3 + i, 2, 2);
    ctx.fillRect(x + 2 - i, y - 3 + i, 2, 2);
  }
  ctx.fillStyle = TIER_COLORS[tier] || PAL.red;
  for (let i = 1; i < 6; i++) {
    ctx.fillRect(x - 3 + i, y - 3 + i, 1, 1);
    ctx.fillRect(x + 2 - i, y - 3 + i, 1, 1);
  }
}

// A little papyrus scroll.
function drawStoryIcon(ctx, x, y) {
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x - 4, y - 5, 9, 11);
  ctx.fillStyle = PAL.eyeWhite;
  ctx.fillRect(x - 3, y - 4, 7, 9);
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(x - 4, y - 5, 9, 2);
  ctx.fillRect(x - 4, y + 4, 9, 2);
  ctx.fillStyle = PAL.inkSoft;
  ctx.fillRect(x - 2, y - 2, 5, 1);
  ctx.fillRect(x - 2, y, 5, 1);
  ctx.fillRect(x - 2, y + 2, 3, 1);
}

// A grey enigma.
function drawUnknownIcon(ctx, x, y) {
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x - 4, y - 4, 9, 9);
  ctx.fillStyle = "#8d99a6";
  ctx.fillRect(x - 3, y - 3, 7, 7);
  drawTextC(ctx, "?", x + 1, y - 2, 1, PAL.white);
}

function drawEventIcon(ctx, x, y, ev) {
  x = Math.round(x); y = Math.round(y);
  if (ev.type === "enemy") drawEnemyIcon(ctx, x, y, ev.tier);
  else if (ev.type === "story") drawStoryIcon(ctx, x, y);
  else drawUnknownIcon(ctx, x, y);
}

// Rolled-papyrus icon for the Map Scroll button.
function drawScrollButtonIcon(ctx, x, y, hot) {
  const fg = hot ? PAL.ink : PAL.parchment;
  ctx.fillStyle = fg;
  ctx.fillRect(x - 5, y - 6, 10, 12);
  ctx.fillStyle = hot ? PAL.parchDark : PAL.hullLight;
  ctx.fillRect(x - 7, y - 7, 3, 14);
  ctx.fillRect(x + 4, y - 7, 3, 14);
  ctx.fillStyle = hot ? PAL.parchment : PAL.ink;
  ctx.fillRect(x - 3, y - 3, 6, 1);
  ctx.fillRect(x - 3, y, 6, 1);
  ctx.fillRect(x - 3, y + 3, 4, 1);
}
