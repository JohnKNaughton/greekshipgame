// Tiny built-in pixel font (5 px tall, variable width).
// Every piece of text in the game is drawn with this so the whole UI stays 8-bit.
const FONT = {
  "A": [".##.", "#..#", "####", "#..#", "#..#"],
  "B": ["###.", "#..#", "###.", "#..#", "###."],
  "C": [".###", "#...", "#...", "#...", ".###"],
  "D": ["###.", "#..#", "#..#", "#..#", "###."],
  "E": ["####", "#...", "###.", "#...", "####"],
  "F": ["####", "#...", "###.", "#...", "#..."],
  "G": [".###", "#...", "#.##", "#..#", ".##."],
  "H": ["#..#", "#..#", "####", "#..#", "#..#"],
  "I": ["###", ".#.", ".#.", ".#.", "###"],
  "J": ["..##", "...#", "...#", "#..#", ".##."],
  "K": ["#..#", "#.#.", "##..", "#.#.", "#..#"],
  "L": ["#...", "#...", "#...", "#...", "####"],
  "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  "N": ["#..#", "##.#", "#.##", "#..#", "#..#"],
  "O": [".##.", "#..#", "#..#", "#..#", ".##."],
  "P": ["###.", "#..#", "###.", "#...", "#..."],
  "Q": [".##.", "#..#", "#..#", "#.#.", ".#.#"],
  "R": ["###.", "#..#", "###.", "#.#.", "#..#"],
  "S": [".###", "#...", ".##.", "...#", "###."],
  "T": ["###", ".#.", ".#.", ".#.", ".#."],
  "U": ["#..#", "#..#", "#..#", "#..#", ".##."],
  "V": ["#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  "X": ["#..#", "#..#", ".##.", "#..#", "#..#"],
  "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
  "Z": ["####", "...#", ".##.", "#...", "####"],
  "0": [".##.", "#.##", "##.#", "#..#", ".##."],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###.", "...#", ".##.", "#...", "####"],
  "3": ["###.", "...#", ".##.", "...#", "###."],
  "4": ["#..#", "#..#", "####", "...#", "...#"],
  "5": ["####", "#...", "###.", "...#", "###."],
  "6": [".###", "#...", "###.", "#..#", ".##."],
  "7": ["####", "...#", "..#.", ".#..", ".#.."],
  "8": [".##.", "#..#", ".##.", "#..#", ".##."],
  "9": [".##.", "#..#", ".###", "...#", "###."],
  ".": [".", ".", ".", ".", "#"],
  ",": [".", ".", ".", "#", "#"],
  "!": ["#", "#", "#", ".", "#"],
  "?": ["###.", "...#", ".##.", "....", ".#.."],
  ":": [".", "#", ".", "#", "."],
  ";": [".", "#", ".", "#", "#"],
  "-": ["...", "...", "###", "...", "..."],
  "%": ["#...#", "...#.", "..#..", ".#...", "#...#"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "'": ["#", "#", ".", ".", "."],
  "/": ["...#", "..#.", ".##.", "#...", "#..."],
  "(": [".#", "#.", "#.", "#.", ".#"],
  "<": ["..#", ".#.", "#..", ".#.", "..#"],
  ">": ["#..", ".#.", "..#", ".#.", "#.."],
  ")": ["#.", ".#", ".#", ".#", "#."],
  " ": ["...", "...", "...", "...", "..."],
};

const FONT_H = 5;

function glyphFor(ch) {
  return FONT[ch.toUpperCase()] || FONT["?"];
}

function textWidth(str, scale) {
  scale = scale || 1;
  let w = 0;
  for (const ch of str) w += (glyphFor(ch)[0].length + 1) * scale;
  return w > 0 ? w - scale : 0; // trim trailing letter-space
}

function drawText(ctx, str, x, y, scale, color) {
  scale = scale || 1;
  ctx.fillStyle = color || PAL.white;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of str) {
    const g = glyphFor(ch);
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === "#") {
          ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
        }
      }
    }
    cx += (g[0].length + 1) * scale;
  }
}

// Centered horizontally on cx.
function drawTextC(ctx, str, cx, y, scale, color) {
  drawText(ctx, str, cx - textWidth(str, scale) / 2, y, scale, color);
}

// Text with a 1px (scaled) drop shadow/outline for readability over scenery.
function drawTextShadow(ctx, str, x, y, scale, color, shadowColor) {
  const s = scale || 1;
  drawText(ctx, str, x + s, y + s, s, shadowColor || PAL.ink);
  drawText(ctx, str, x, y, s, color);
}

// Greedy word wrap into lines that fit maxW pixels at the given scale.
function wrapText(str, maxW, scale) {
  const words = str.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? line + " " + w : w;
    if (textWidth(tryLine, scale) <= maxW) line = tryLine;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
