// Shared Mediterranean scenery painting — sky, sun, clouds, islands, sea, ship.
// Used by the title screen now; scenes later in development reuse these pieces.

const HORIZON = 150;

// Deterministic pseudo-random for stable sparkle/star layouts.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawSky(ctx, W) {
  ctx.fillStyle = PAL.skyHigh;
  ctx.fillRect(0, 0, W, 60);
  ctx.fillStyle = PAL.skyMid;
  ctx.fillRect(0, 60, W, 55);
  ctx.fillStyle = PAL.skyLow;
  ctx.fillRect(0, 115, W, HORIZON - 115);
}

function drawSun(ctx, x, y, t) {
  // Rotating rays, banded 8-bit sun.
  ctx.fillStyle = PAL.sun;
  for (let i = 0; i < 8; i++) {
    const a = t * 0.15 + (i * Math.PI) / 4;
    const rx = Math.round(x + Math.cos(a) * 22);
    const ry = Math.round(y + Math.sin(a) * 22);
    ctx.fillRect(rx - 1, ry - 1, 3, 3);
  }
  ctx.fillStyle = PAL.sun;
  ctx.fillRect(x - 8, y - 12, 16, 24);
  ctx.fillRect(x - 12, y - 8, 24, 16);
  ctx.fillStyle = PAL.sunCore;
  ctx.fillRect(x - 5, y - 8, 10, 16);
  ctx.fillRect(x - 8, y - 5, 16, 10);
}

function drawCloud(ctx, x, y, size) {
  x = Math.round(x);
  ctx.fillStyle = PAL.cloud;
  ctx.fillRect(x, y, 14 * size, 5);
  ctx.fillRect(x + 3 * size, y - 3, 8 * size, 4);
  ctx.fillStyle = PAL.cloudShade;
  ctx.fillRect(x + 2, y + 4, 14 * size - 4, 2);
}

function drawClouds(ctx, W, t) {
  const clouds = [
    { y: 28, s: 1.4, v: 4.0, o: 0 },
    { y: 52, s: 1.0, v: 6.5, o: 190 },
    { y: 40, s: 0.8, v: 9.0, o: 330 },
    { y: 74, s: 1.1, v: 5.2, o: 460 },
  ];
  for (const c of clouds) {
    const span = W + 60;
    const x = ((c.o + t * c.v) % span) - 40;
    drawCloud(ctx, x, c.y, c.s);
  }
}

function drawIsland(ctx, cx, baseY, w, h, color) {
  // Simple stepped-pyramid island silhouette.
  ctx.fillStyle = color;
  let y = baseY;
  let ww = w;
  while (ww > 2 && y > baseY - h) {
    ctx.fillRect(Math.round(cx - ww / 2), y - 2, Math.round(ww), 2);
    ww *= 0.72;
    y -= 2;
  }
}

function drawIslands(ctx, W, scroll) {
  scroll = scroll || 0;
  const span = W + 240;
  const wrap = (x) => ((x + 120 - scroll) % span + span) % span - 120;
  drawIsland(ctx, wrap(70), HORIZON, 90, 14, PAL.islandFar);
  drawIsland(ctx, wrap(395), HORIZON, 130, 20, PAL.islandFar);
  drawIsland(ctx, wrap(430), HORIZON, 70, 12, PAL.islandNear);
  drawIsland(ctx, wrap(620), HORIZON, 110, 16, PAL.islandFar);
  // A sandy shoal
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(Math.round(wrap(52)), HORIZON - 2, 40, 2);
}

function drawSea(ctx, W, H, t) {
  ctx.fillStyle = PAL.seaMid;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  ctx.fillStyle = PAL.seaDeep;
  ctx.fillRect(0, HORIZON + 60, W, H - HORIZON - 60);

  // Rolling wave bands — dashes sliding on sine offsets, wider apart near the camera.
  ctx.fillStyle = PAL.seaLight;
  for (let i = 0; i < 14; i++) {
    const y = HORIZON + 4 + i * 8 + Math.round(i * i * 0.16);
    if (y >= H) break;
    const drift = Math.sin(t * 0.9 + i * 1.7) * 6 + t * (4 + i * 0.8);
    for (let x = -24; x < W + 24; x += 24 + i) {
      const dx = Math.round(x + (drift % (24 + i)));
      ctx.fillRect(dx, y, 8 + i, 2);
    }
  }

  // Foam sparkles twinkling near the horizon.
  for (let i = 0; i < 60; i++) {
    const sx = Math.floor(hash2(i, 7) * W);
    const sy = HORIZON + 2 + Math.floor(hash2(i, 13) * 46);
    const tw = Math.sin(t * 2.2 + i * 2.9);
    if (tw > 0.55) {
      ctx.fillStyle = tw > 0.85 ? PAL.sparkle : PAL.seaFoam;
      ctx.fillRect(sx, sy, 2, 1);
    }
  }
}

function drawGulls(ctx, W, t) {
  ctx.fillStyle = PAL.white;
  const gulls = [
    { y: 62, v: 14, o: 40, p: 0 },
    { y: 84, v: 11, o: 260, p: 2 },
    { y: 50, v: 17, o: 150, p: 4 },
  ];
  for (const g of gulls) {
    const span = W + 40;
    const x = Math.round(((g.o + t * g.v) % span) - 20);
    const flap = Math.sin(t * 6 + g.p) > 0 ? 0 : 1;
    // Tiny "m" bird, wings up or down
    ctx.fillRect(x, g.y + flap, 2, 1);
    ctx.fillRect(x + 2, g.y + 1 - flap, 2, 1);
    ctx.fillRect(x + 4, g.y + flap, 2, 1);
  }
}

// The player's humble starting galley, bobbing and rowing.
// (x, y) is the center of the hull at the waterline.
function drawShip(ctx, x, y, t, opts) {
  opts = opts || {};
  const bob = Math.round(Math.sin(t * 1.6) * 2);
  const sway = Math.sin(t * 1.6 + 1.2);
  x = Math.round(x);
  y = Math.round(y) + bob;

  // Oars (3 per visible side), sweeping with the stroke cycle.
  const stroke = Math.sin(t * 2.4);
  ctx.strokeStyle = PAL.oar;
  ctx.lineWidth = 1;
  for (let i = -1; opts.oars !== false && i <= 1; i++) {
    const ox = x + i * 12;
    const dip = stroke * 4;
    ctx.beginPath();
    ctx.moveTo(ox + 0.5, y - 2.5);
    ctx.lineTo(ox + 6.5 + dip, y + 7.5);
    ctx.stroke();
    // Splash where the blade meets the water on the pull
    if (stroke > 0.6) {
      ctx.fillStyle = PAL.seaFoam;
      ctx.fillRect(Math.round(ox + 6 + dip), y + 7, 3, 1);
    }
  }

  // Hull — curved bilge with raised prow (right) and stern (left).
  ctx.fillStyle = PAL.hull;
  ctx.fillRect(x - 26, y - 4, 52, 6);
  ctx.fillRect(x - 22, y + 2, 44, 3);
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(x - 20, y + 5, 40, 2);
  // Prow post with a ram hint
  ctx.fillStyle = PAL.hullLight;
  ctx.fillRect(x + 24, y - 10, 4, 8);
  ctx.fillRect(x + 26, y - 13, 3, 5);
  // Stern curling up like a scorpion tail
  ctx.fillRect(x - 28, y - 10, 4, 8);
  ctx.fillRect(x - 30, y - 13, 3, 5);
  // Gunwale trim
  ctx.fillStyle = PAL.hullLight;
  ctx.fillRect(x - 24, y - 5, 48, 2);

  // The painted eye — every good Greek ship watches the waves.
  ctx.fillStyle = PAL.eyeWhite;
  ctx.fillRect(x + 17, y - 3, 5, 3);
  ctx.fillStyle = PAL.eyeDark;
  ctx.fillRect(x + 19, y - 3, 2, 3);

  // Mast, yard, and square sail with a stripe.
  const lean = Math.round(sway);
  ctx.fillStyle = PAL.hullDark;
  ctx.fillRect(x - 1 + lean, y - 34, 2, 30);
  ctx.fillRect(x - 12 + lean, y - 33, 24, 2);
  const sailC = opts.sail || PAL.sail;
  const sailShadeC = opts.sailShade || PAL.sailShade;
  const stripeC = opts.stripe || PAL.sailStripe;
  const billow = opts.furled ? 0 : Math.round(2 + Math.sin(t * 1.1) * 1.5);
  if (!opts.furled) {
    ctx.fillStyle = sailC;
    ctx.fillRect(x - 11 + lean, y - 31, 22, 18 + billow);
    ctx.fillStyle = sailShadeC;
    ctx.fillRect(x - 11 + lean, y - 31, 3, 18 + billow);
    ctx.fillStyle = stripeC;
    ctx.fillRect(x - 11 + lean, y - 24, 22, 3);
  } else {
    ctx.fillStyle = sailShadeC;
    ctx.fillRect(x - 12 + lean, y - 32, 24, 4);
  }
  // Pennant streaming from the masthead
  ctx.fillStyle = stripeC;
  ctx.fillRect(x + 1 + lean, y - 36, 5 + Math.round(sway * 2), 2);

  // Wake foam at the waterline
  ctx.fillStyle = PAL.seaFoam;
  ctx.fillRect(x - 27, y + 4 - bob, 6, 2);
  ctx.fillRect(x + 22, y + 4 - bob, 7, 2);
}

// One call paints the whole backdrop.
function drawSeascape(ctx, W, H, t, opts) {
  opts = opts || {};
  drawSky(ctx, W);
  drawSun(ctx, 62, 40, t);
  drawClouds(ctx, W, t);
  drawIslands(ctx, W, opts.islandScroll);
  drawSea(ctx, W, H, t);
  drawGulls(ctx, W, t);
}
