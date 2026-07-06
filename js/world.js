// The Middle Sea and the Euxine beyond — city states and the sea routes
// between them. Coordinates are positions on the large map scroll
// (MAP_W x MAP_H world pixels; the view window scrolls across it).

// services: every city has a dock and market; the acropolis extras are a
// fixed sampling that never changes over a run.
// "home" is your hometown — razed in 775 BC, permanently in ruins, and
// linked only to nearby Syracuse. (Name is a placeholder for curation.)
const CITIES = {
  home:       { name: "ZANCLE",            region: "YOUR HOME",  x: 405, y: 262, lx: 7,   ly: -4,
                services: [], ruined: true },
  // --- The West ---
  gadir:      { name: "GADIR",             region: "IBERIA",     x: 40,  y: 285, lx: -10, ly: 9,
                services: ["dock", "market", "barracks"] },
  saguntum:   { name: "SAGUNTUM",          region: "IBERIA",     x: 118, y: 222, lx: -20, ly: 9,
                services: ["dock", "market", "barracks"] },
  massilia:   { name: "MASSILIA",          region: "GAUL",       x: 215, y: 145, lx: -18, ly: -12,
                services: ["dock", "market", "tavern"] },
  veii:       { name: "VEII",              region: "ETRURIA",    x: 318, y: 168, lx: -8,  ly: -12,
                services: ["dock", "market", "tavern"] },
  rome:       { name: "ROME",              region: "LATIUM",     x: 330, y: 190, lx: 7,   ly: -2,
                services: ["dock", "market", "barracks", "temple"] },
  neapolis:   { name: "NEAPOLIS",          region: "CAMPANIA",   x: 365, y: 220, lx: 7,   ly: -4,
                services: ["dock", "market", "tavern", "temple"] },
  syracuse:   { name: "SYRACUSE",          region: "SICILY",     x: 378, y: 295, lx: -42, ly: 2,
                services: ["dock", "market", "tavern", "temple"] },
  utica:      { name: "UTICA",             region: "LIBYA",      x: 288, y: 305, lx: -26, ly: -10,
                services: ["dock", "market", "tavern"] },
  carthage:   { name: "CARTHAGE",          region: "LIBYA",      x: 300, y: 328, lx: -18, ly: 9,
                services: ["dock", "market", "barracks", "temple"] },
  cyrene:     { name: "CYRENE",            region: "CYRENAICA",  x: 528, y: 388, lx: -14, ly: 9,
                services: ["dock", "market", "temple"] },
  thonis:     { name: "THONIS-HERACLEION", region: "EGYPT",      x: 660, y: 398, lx: -38, ly: 9,
                services: ["dock", "market", "temple", "tavern"] },
  // --- Hellas and the Aegean ---
  corinth:    { name: "CORINTH",           region: "CORINTHIA",  x: 492, y: 262, lx: -33, ly: 2,
                services: ["dock", "market", "tavern", "barracks"] },
  athens:     { name: "ATHENS",            region: "ATTICA",     x: 520, y: 258, lx: 4,   ly: 7,
                services: ["dock", "market", "temple", "tavern", "barracks"] },
  chalcis:    { name: "CHALCIS",           region: "EUBOEA",     x: 525, y: 236, lx: 4,   ly: -8,
                services: ["dock", "market", "barracks", "tavern"] },
  pella:      { name: "PELLA",             region: "MACEDON",    x: 508, y: 172, lx: -22, ly: -4,
                services: ["dock", "market", "barracks", "temple"] },
  amphipolis: { name: "AMPHIPOLIS",        region: "THRACE",     x: 545, y: 182, lx: -8,  ly: -12,
                services: ["dock", "market", "barracks"] },
  mytilene:   { name: "MYTILENE",          region: "LESBOS",     x: 588, y: 225, lx: 8,   ly: 2,
                services: ["dock", "market", "tavern"] },
  rhodes:     { name: "RHODES",            region: "RHODES",     x: 652, y: 272, lx: 8,   ly: 4,
                services: ["dock", "market", "temple", "tavern"] },
  knossos:    { name: "KNOSSOS",           region: "CRETE",      x: 560, y: 306, lx: -14, ly: -12,
                services: ["dock", "market", "temple"] },
  gortyna:    { name: "GORTYNA",           region: "CRETE",      x: 550, y: 322, lx: -16, ly: 9,
                services: ["dock", "market", "tavern"] },
  // --- The Euxine (Black Sea) ---
  byzantium:  { name: "BYZANTIUM",         region: "THRACE",     x: 612, y: 150, lx: -16, ly: -12,
                services: ["dock", "market", "tavern", "barracks"] },
  sinope:     { name: "SINOPE",            region: "PONTUS",     x: 732, y: 112, lx: -12, ly: 8,
                services: ["dock", "market", "tavern"] },
  colchis:    { name: "COLCHIS",           region: "COLCHIS",    x: 852, y: 105, lx: -14, ly: 9,
                services: ["dock", "market", "temple"] },
  panticapaeum: { name: "PANTICAPAEUM",    region: "TAURICA",    x: 748, y: 48,  lx: -32, ly: -10,
                services: ["dock", "market", "barracks"] },
  phanagoria: { name: "PHANAGORIA",        region: "TAURICA",    x: 782, y: 58,  lx: 6,   ly: 6,
                services: ["dock", "market", "tavern"] },
  // --- Cyprus and the Levant ---
  kition:     { name: "KITION",            region: "CYPRUS",     x: 722, y: 325, lx: -12, ly: 9,
                services: ["dock", "market", "temple", "barracks"] },
  almina:     { name: "AL MINA",           region: "SYRIA",      x: 798, y: 272, lx: -34, ly: -3,
                services: ["dock", "market", "tavern"] },
  arwad:      { name: "ARWAD",             region: "PHOENICIA",  x: 806, y: 298, lx: 7,   ly: -3,
                services: ["dock", "market", "barracks"] },
  byblos:     { name: "BYBLOS",            region: "PHOENICIA",  x: 812, y: 322, lx: 7,   ly: -2,
                services: ["dock", "market", "temple", "tavern"] },
  sidon:      { name: "SIDON",             region: "PHOENICIA",  x: 806, y: 346, lx: 7,   ly: -2,
                services: ["dock", "market", "barracks"] },
  tyre:       { name: "TYRE",              region: "PHOENICIA",  x: 794, y: 366, lx: -22, ly: 8,
                services: ["dock", "market", "temple", "tavern"] },
};

// Each city links to 2-3 of its nearest neighbors (home only to Syracuse).
// bow curves the drawn route sideways (perpendicular px) so it hugs coasts
// and stays off the land.
const EDGE_DEFS = [
  ["home", "syracuse", -10],
  // West
  ["gadir", "saguntum"],
  ["gadir", "utica", -8],
  ["saguntum", "massilia"],
  ["massilia", "veii"],
  ["veii", "rome"],
  ["rome", "neapolis"],
  ["neapolis", "syracuse", 8],
  ["syracuse", "carthage"],
  ["utica", "carthage"],
  ["carthage", "cyrene", -14],
  ["cyrene", "thonis", -12],
  ["cyrene", "gortyna"],
  // Hellas and the Aegean
  ["corinth", "athens"],
  ["corinth", "gortyna"],
  ["athens", "chalcis"],
  ["athens", "knossos"],
  ["chalcis", "pella"],
  ["chalcis", "mytilene"],
  ["pella", "amphipolis"],
  ["amphipolis", "byzantium"],
  ["mytilene", "byzantium", -6],
  ["mytilene", "rhodes", 8],
  ["knossos", "rhodes"],
  ["knossos", "gortyna"],
  // The Euxine
  ["byzantium", "sinope", -14],
  ["sinope", "colchis", -8],
  ["sinope", "panticapaeum"],
  ["panticapaeum", "phanagoria"],
  ["phanagoria", "colchis"],
  // Cyprus and the Levant
  ["rhodes", "kition"],
  ["kition", "tyre"],
  ["kition", "almina"],
  ["almina", "arwad"],
  ["arwad", "byblos"],
  ["byblos", "sidon"],
  ["sidon", "tyre"],
  ["tyre", "thonis"],
];

function edgeIdFor(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

// Built once: every route with its length-derived difficulty numbers.
const EDGES = EDGE_DEFS.map(([a, b, bow]) => {
  const A = CITIES[a], B = CITIES[b];
  const dx = B.x - A.x, dy = B.y - A.y;
  const dist = Math.hypot(dx, dy);
  // Control point for the drawn arc (quadratic bezier).
  const bw = bow || 0;
  const cx = (A.x + B.x) / 2 - (dy / dist) * bw;
  const cy = (A.y + B.y) / 2 + (dx / dist) * bw;
  return {
    a, b,
    id: edgeIdFor(a, b),
    dist,
    cx, cy,
    hubs: dist < 110 ? 1 : dist < 200 ? 2 : 3,          // event hubs along the way
    power: dist < 110 ? 1 : dist < 150 ? 2 : dist < 210 ? 3 : 4, // hull power needed
    cost: Math.max(2, Math.round(dist / 22)),           // crew provisions consumed
  };
});

function edgeBetween(a, b) {
  const id = edgeIdFor(a, b);
  return EDGES.find((e) => e.id === id) || null;
}

function neighborsOf(cityId) {
  const out = [];
  for (const e of EDGES) {
    if (e.a === cityId) out.push(e.b);
    else if (e.b === cityId) out.push(e.a);
  }
  return out;
}

// Point along a route's drawn arc, u in [0, 1] from e.a to e.b.
function routePoint(e, u) {
  const A = CITIES[e.a], B = CITIES[e.b];
  const v = 1 - u;
  return {
    x: v * v * A.x + 2 * v * u * e.cx + u * u * B.x,
    y: v * v * A.y + 2 * v * u * e.cy + u * u * B.y,
  };
}
