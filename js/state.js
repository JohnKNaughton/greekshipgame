// Run state: the ship, her stores, the markets, and the shifting dangers
// of the routes. Copper coins are the coin of the realm.

// --- Trade goods (bought and sold at city markets) ---
const GOODS = {
  lumber:   { name: "LUMBER",   base: 8 },
  pottery:  { name: "POTTERY",  base: 12 },
  textiles: { name: "TEXTILES", base: 20 },
  silver:   { name: "SILVER",   base: 45 },
  gold:     { name: "GOLD",     base: 90 },
};
const GOOD_IDS = Object.keys(GOODS);

// Famous producers sell their specialty cheap — reliable arbitrage anchors.
const PRICE_BIAS = {
  byblos:  { lumber: 0.5 },    // the cedar trade
  tyre:    { textiles: 0.55 }, // tyrian purple
  gadir:   { silver: 0.5 },    // iberian mines
  thonis:  { gold: 0.55 },     // gold of the pharaohs
  chalcis: { pottery: 0.6 },   // euboean kilns
  athens:  { pottery: 0.55 },  // attic ware
  pella:   { lumber: 0.6 },    // macedonian timber
  colchis: { gold: 0.6 },      // the golden fleece country
  saguntum: { silver: 0.6 },   // more iberian veins
};

// --- Ship hulls and upgrades: a simple visible tree. A bigger hull makes
// the ship physically larger, adds stations, doubles her hull points, and
// unlocks the next tier of purchases in the upgrade grid.
// Hull costs climb fivefold per tier.
const HULL_LEVELS = [
  { name: "SKIFF",     cost: 0 },    // a big canoe with a sail
  { name: "LIBURNIAN", cost: 100 },  // + oars 1, slot 1, unlocks tier 2
  { name: "BIREME",    cost: 500 },  // + oars 2, slot 2 (tier 3 upgrades later)
  { name: "TRIREME",   cost: 2500 }, // + oars 3, slot 3 (tier 4 upgrades later)
];

// Tier-2 purchases, unlocked by the Liburnian hull.
const SHIP_UPGRADE_DEFS = {
  sails:    { name: "SAILS 2",       cost: 75, needHull: 1 },
  archers:  { name: "ARCHER POST 2", cost: 60, needHull: 1 },
  quarters: { name: "QUARTERS 2",    cost: 80, needHull: 1 },
};

// --- Modular systems that fill the ship's module spots ---
// Greek fire and the shrines are warehoused until a later tier.
const MODULES = {
  ballista:  { name: "BALLISTA",           cost: 150, desc: "HURLS IRON BOLTS" },
  catapult:  { name: "CATAPULT",           cost: 300, desc: "FLINGS STONES" },
  greekfire: { name: "GREEK FIRE",         cost: 800, desc: "BURNS FOES AT SEA" },
  poseidon:  { name: "SHRINE OF POSEIDON", cost: 200, desc: "CALMS THE DEEP" },
  athena:    { name: "SHRINE OF ATHENA",   cost: 200, desc: "SHARPENS THE CREW" },
};
const AVAILABLE_MODULES = ["ballista", "catapult"];

// --- Route events ---
// Odds that a rolled enemy comes from each pool. Year one: 50% easy, 50%
// medium, 0% hard — then the sea grows crueler as the years pass.
function currentTierOdds() {
  const e = Game.elapsed || 0;
  const hard = Math.min(0.5, Math.max(0, (e - 12) * 0.02));
  const easy = Math.max(0.1, 0.5 - e * 0.01);
  return { easy, medium: Math.max(0, 1 - easy - hard), hard };
}

function rollEnemyTier() {
  const odds = currentTierOdds();
  const r = Math.random();
  if (r < odds.easy) return "easy";
  if (r < odds.easy + odds.medium) return "medium";
  return "hard";
}

// The Devourer's westward march: from year 20 of the run he burns one port
// after another, starting in the Levant. (Order and pace are placeholders.)
const VILLAIN_PATH = ["almina", "arwad", "byblos", "kition", "sidon", "tyre"];
const VILLAIN_RETURN_YEAR = 725;   // 50 years after the fall of home
const VILLAIN_MARCH_START = 20;    // elapsed years before ports start burning
const VILLAIN_MARCH_PACE = 3;      // one port every N years

// What you tore off the burning quay: a random mix of tradables worth
// 200-240 copper at base prices, so every run starts with a comparable stake
// no matter which goods the fire spared.
function rollStartingCargo() {
  for (let tries = 0; tries < 80; tries++) {
    const bundle = {};
    let units = 0, value = 0;
    while (value < 200 && units < 10) {
      const g = GOOD_IDS[Math.floor(Math.random() * GOOD_IDS.length)];
      bundle[g] = (bundle[g] || 0) + 1;
      units++;
      value += GOODS[g].base;
    }
    if (value >= 200 && value <= 240) return bundle;
  }
  return { gold: 2, silver: 1 }; // 225 coppers of fallback
}

// One event hub: enemy (with a visible tier color), story, or unknown.
// Unknown resolves into enemy-or-story only when the ship reaches it.
function rollHubEvent() {
  const r = Math.random();
  if (r < 0.40) return { type: "enemy", tier: rollEnemyTier() };
  if (r < 0.75) return { type: "story" };
  return { type: "unknown" };
}

const Game = {
  year: 775, // BC — each crossing takes a year, so the number counts down
  weather: "SUNNY",
  currentPort: "home",
  shipName: "NAMELESS",
  resources: {},
  waterMax: 20,
  provisionsMax: 20,
  upgrades: {},
  modules: [],
  prices: {},      // cityId -> goodId -> current price (float, dynamic)
  anchors: {},     // cityId -> goodId -> the price that market drifts toward
  routeEvents: {}, // edge id -> array of hub events
  crew: [],        // named members (walkable, FTL-style)
  rowers: 0,       // stock crew: identical oarsmen
  mercs: 0,        // stock crew: identical fighters
  hull: 20,
  recruit: null,   // named sailor waiting in this port's tavern
  openingDone: false,
  bossDefeated: false,
  ruinedPorts: null, // Set of ports the Devourer has burned this run
  news: [],
  scavenged: false,  // one scavenge per visit to a ruin
  begged: false,     // one plea for alms per port visit

  get elapsed() { return 775 - this.year; },
  // Everything the hull provides is derived from its level: each hull adds
  // a row of oars and a module slot.
  get oarsLevel() { return this.upgrades.hull; },
  get slots() { return this.upgrades.hull; },
  get shipPower() { return this.upgrades.sails + this.oarsLevel; },
  get hullMax() { return 20 * Math.pow(2, this.upgrades.hull); }, // doubles per hull
  get cargoCap() { return 10 + this.upgrades.hull * 6; },
  get crewCap() { return this.upgrades.quarters * 4; },   // quarters 1 = 4, 2 = 8
  get archerCap() { return this.upgrades.archers * 2; },  // post 1 = 2, 2 = 4
  get cargoUsed() {
    return GOOD_IDS.reduce((n, g) => n + this.resources[g], 0);
  },
  get freeSlots() { return this.slots - this.modules.length; },
  get bunksUsed() { return this.crew.length + this.rowers + this.mercs; },

  newGame() {
    this.year = 775;
    this.weather = "SUNNY";
    this.currentPort = "home";
    this.shipName = "NAMELESS";
    // You escape the sack of your hometown with half-filled stores, no
    // coin, and a scavenged jumble of goods worth 200-240 copper.
    this.resources = {
      water: 10, provisions: 10, coins: 0,
      lumber: 0, pottery: 0, textiles: 0, silver: 0, gold: 0,
    };
    const salvage = rollStartingCargo(); // 200-240 coppers' worth, mixed
    for (const g in salvage) this.resources[g] = salvage[g];
    this.waterMax = 20;
    this.provisionsMax = 20;
    // Barebones: a level-0 skiff. Helm, one sail, a two-man archer post,
    // and quarters for four. No oars, no module spots until a bigger hull.
    this.upgrades = { hull: 0, sails: 1, archers: 1, quarters: 1 };
    this.modules = [];
    this.hull = this.hullMax;
    this.openingDone = false;
    this.bossDefeated = false;
    this.ruinedPorts = new Set();
    this.news = [];
    this.scavenged = false;
    this.begged = false;
    // Your captain: one soul with a randomized name, sent straight to the helm.
    this.crew = [];
    const captain = makeCrew();
    captain.station = "helm";
    this.crew.push(captain);
    this.rowers = 0;
    this.mercs = 0;
    this.recruit = null; // no tavern stands in the ashes of home
    CrewUI.reset();
    this.generatePrices();
    this.regenerateEvents();
  },

  isRuined(id) {
    return !!CITIES[id].ruined || (this.ruinedPorts && this.ruinedPorts.has(id));
  },

  // Markets are living things (AoE2-style): each city's prices start near a
  // rolled anchor, your own trading pushes them, and every year at sea they
  // drift — pulled slowly home to their anchor, shoved randomly by the wider
  // Aegean economy. Anchors keep the famous producers famously cheap.
  generatePrices() {
    this.prices = {};  // cityId -> goodId -> current price (float; rounded on display)
    this.anchors = {}; // cityId -> goodId -> where that market "wants" to sit
    for (const cityId in CITIES) {
      const bias = PRICE_BIAS[cityId] || {};
      const table = {}, anchors = {};
      for (const g of GOOD_IDS) {
        const mult = bias[g] || 0.65 + Math.random() * 0.85;
        anchors[g] = GOODS[g].base * mult;
        table[g] = anchors[g];
      }
      this.prices[cityId] = table;
      this.anchors[cityId] = anchors;
    }
  },

  clampPrice(g, p) {
    return Math.min(GOODS[g].base * 2.5, Math.max(GOODS[g].base * 0.4, p));
  },

  // Every unit you trade moves the local price: buying makes it dearer,
  // selling floods the stalls and softens it.
  bumpPrice(g, dir) {
    const table = this.prices[this.currentPort];
    table[g] = this.clampPrice(g, table[g] * (1 + dir * 0.05) + dir * 0.4);
  },

  // A year passes with every crossing; every market in the world breathes.
  driftPrices() {
    for (const cityId in CITIES) {
      for (const g of GOOD_IDS) {
        let p = this.prices[cityId][g];
        p += (this.anchors[cityId][g] - p) * 0.10;   // slow pull toward home
        p *= 1 + (Math.random() * 2 - 1) * 0.10;     // the unpredictable sea
        this.prices[cityId][g] = this.clampPrice(g, p);
      }
    }
  },

  // Lean years: everything costs a little more as the world darkens.
  priceOf(cityId, goodId) {
    return Math.max(2, Math.round(this.prices[cityId][goodId] * (1 + this.elapsed * 0.008)));
  },

  priceTag(cityId, goodId) {
    const ratio = this.prices[cityId][goodId] / GOODS[goodId].base;
    if (ratio <= 0.85) return "cheap";
    if (ratio >= 1.15) return "dear";
    return null;
  },

  // --- Trade & purchases (return a message on failure, null on success) ---
  buyGood(goodId) {
    const price = this.priceOf(this.currentPort, goodId);
    if (this.resources.coins < price) return "NOT ENOUGH COPPER.";
    if (this.cargoUsed >= this.cargoCap) return "THE CARGO HOLD IS FULL.";
    this.resources.coins -= price;
    this.resources[goodId]++;
    this.bumpPrice(goodId, +1);
    return null;
  },

  sellGood(goodId) {
    if (this.resources[goodId] < 1) return "YOU CARRY NONE.";
    this.resources[goodId]--;
    this.resources.coins += this.priceOf(this.currentPort, goodId);
    this.bumpPrice(goodId, -1);
    return null;
  },

  buyStock(kind, count) {
    const price = kind === "water" ? 1 : 2;
    const max = kind === "water" ? this.waterMax : this.provisionsMax;
    const space = max - this.resources[kind];
    const affordable = Math.floor(this.resources.coins / price);
    const n = Math.min(count, space, affordable);
    if (space < 1) return "YOUR STORES ARE FULL.";
    if (n < 1) return "NOT ENOUGH COPPER.";
    this.resources[kind] += n;
    this.resources.coins -= n * price;
    return null;
  },

  // Is every cell of this hull row green? (Upgrades bought, slot fitted.)
  // The next hull only goes on sale once the current row is complete.
  rowComplete(lvl) {
    if (this.upgrades.hull < lvl) return false;
    if (lvl === 0) return true;
    if (lvl === 1) {
      return this.upgrades.sails >= 2 && this.upgrades.archers >= 2 &&
        this.upgrades.quarters >= 2 && !!this.modules[0];
    }
    return !!this.modules[lvl - 1]; // higher tiers: just fill the slot (for now)
  },

  // Buy a hull ("hull") or a tier-2 upgrade ("sails"/"archers"/"quarters").
  buyShipUpgrade(kind) {
    if (kind === "hull") {
      if (this.upgrades.hull >= HULL_LEVELS.length - 1) return "NO GREATER HULL IS KNOWN YET.";
      if (!this.rowComplete(this.upgrades.hull)) return "FIT OUT HER CURRENT HULL FIRST - EVERY CELL GREEN.";
      const cost = HULL_LEVELS[this.upgrades.hull + 1].cost;
      if (this.resources.coins < cost) return "NOT ENOUGH COPPER.";
      this.resources.coins -= cost;
      this.upgrades.hull++;
      this.hull += 20; // the stouter frame is sound from the day she launches
      return null;
    }
    const def = SHIP_UPGRADE_DEFS[kind];
    if (!def) return "THE SHIPWRIGHT SHRUGS.";
    if (this.upgrades[kind] >= 2) return "ALREADY ABOARD.";
    if (this.upgrades.hull < def.needHull) return "HER HULL CANNOT TAKE IT. BUY THE LIBURNIAN FIRST.";
    if (this.resources.coins < def.cost) return "NOT ENOUGH COPPER.";
    this.resources.coins -= def.cost;
    this.upgrades[kind] = 2;
    return null;
  },

  buyModule(id) {
    if (!AVAILABLE_MODULES.includes(id)) return "NOT SOLD IN THIS AGE.";
    if (this.freeSlots < 1) return "NO FREE MODULE SPOT.";
    const m = MODULES[id];
    if (this.resources.coins < m.cost) return "NOT ENOUGH COPPER.";
    this.resources.coins -= m.cost;
    this.modules.push(id);
    return null;
  },

  // --- Hiring and repairs ---
  hireSailor() {
    if (!this.recruit) return "NO ONE SEEKS A BERTH TONIGHT.";
    if (this.bunksUsed >= this.crewCap) return "NO BUNKS FREE.";
    if (this.resources.coins < 30) return "NOT ENOUGH COPPER.";
    this.resources.coins -= 30;
    this.crew.push(makeCrew(this.recruit));
    this.recruit = null;
    return null;
  },

  hireMerc() {
    if (this.bunksUsed >= this.crewCap) return "NO BUNKS FREE.";
    if (this.resources.coins < 25) return "NOT ENOUGH COPPER.";
    this.resources.coins -= 25;
    this.mercs++;
    return null;
  },

  hireRower() {
    if (this.bunksUsed >= this.crewCap) return "NO BUNKS FREE.";
    if (this.resources.coins < 15) return "NOT ENOUGH COPPER.";
    this.resources.coins -= 15;
    this.rowers++;
    return null;
  },

  // One-click refit at the dock: mend every plank, fill water and larder.
  replenishCost() {
    return (this.hullMax - this.hull) * 2 +
      (this.waterMax - this.resources.water) +
      (this.provisionsMax - this.resources.provisions) * 2;
  },

  replenishAll() {
    const cost = this.replenishCost();
    if (cost <= 0) return "SHE WANTS FOR NOTHING.";
    if (this.resources.coins < cost) return "NOT ENOUGH COPPER - " + cost + "C TO REFIT HER FULLY.";
    this.resources.coins -= cost;
    this.hull = this.hullMax;
    this.resources.water = this.waterMax;
    this.resources.provisions = this.provisionsMax;
    return null;
  },

  repairHull(n) {
    if (this.hull >= this.hullMax) return "HER PLANKS ARE SOUND.";
    const count = Math.min(n, this.hullMax - this.hull, Math.floor(this.resources.coins / 2));
    if (count < 1) return "NOT ENOUGH COPPER.";
    this.hull += count;
    this.resources.coins -= count * 2;
    return null;
  },

  // Anti-softlock: a destitute captain can beg once per port visit.
  begAlms() {
    if (this.begged) return "THE HARBORMASTER HAS GIVEN ENOUGH.";
    if (this.resources.coins >= 5 || this.resources.provisions >= 4) {
      return "YOU ARE NOT SO DESPERATE AS THAT.";
    }
    this.begged = true;
    this.resources.provisions = Math.min(this.provisionsMax, this.resources.provisions + 4);
    this.resources.water = Math.min(this.waterMax, this.resources.water + 2);
    return null;
  },

  // Picking through a ruined port, once per visit.
  scavengeRuins() {
    if (this.scavenged) return "YOU HAVE PICKED THESE ASHES CLEAN.";
    this.scavenged = true;
    const roll = Math.random();
    if (roll < 0.35) { this.resources.provisions = Math.min(this.provisionsMax, this.resources.provisions + 2); return "A SEALED JAR OF GRAIN AMONG THE ASHES. +2 PROVISIONS"; }
    if (roll < 0.6) { this.resources.water = Math.min(this.waterMax, this.resources.water + 2); return "A CISTERN THE FIRE COULD NOT TOUCH. +2 WATER"; }
    if (roll < 0.85) { this.resources.coins += 4; return "COINS FUSED IN A BURNED STRONGBOX. +4 COPPER"; }
    return "ONLY BONES AND BLACKENED STONE.";
  },

  // --- Routes ---
  waterCost(edge) {
    return Math.ceil(edge.cost / 2);
  },

  routeStatus(edge) {
    const powered = this.shipPower >= edge.power;
    const fed = this.resources.provisions >= edge.cost;
    const watered = this.resources.water >= this.waterCost(edge);
    return { powered, fed, watered, ok: powered && fed && watered };
  },

  // Called on every arrival — the sea reshuffles what waits on every route.
  regenerateEvents() {
    this.routeEvents = {};
    for (const e of EDGES) {
      const hubs = [];
      for (let i = 0; i < e.hubs; i++) hubs.push(rollHubEvent());
      this.routeEvents[e.id] = hubs;
    }
    // The first crossing out of the ashes always carries the opening choice.
    if (!this.openingDone) {
      this.routeEvents[edgeIdFor("home", "syracuse")] = [{ type: "story", fixed: "opening" }];
    }
  },

  depart(toId) {
    const edge = edgeBetween(this.currentPort, toId);
    this.resources.provisions -= edge.cost;
    this.resources.water -= this.waterCost(edge);
    Scenes.change(new VoyageScene(this.currentPort, toId));
  },

  arriveAt(cityId) {
    this.currentPort = cityId;
    this.year--; // a year of a captain's life per crossing
    for (const c of this.crew) c.hp = c.hpMax; // shore leave heals all wounds
    this.scavenged = false;
    this.begged = false;
    this.driftPrices();
    this.villainMarch();
    this.recruit = this.isRuined(cityId) ? null : randomCrewName();
    this.regenerateEvents();
  },

  // From year 20, the Devourer burns his way west along VILLAIN_PATH.
  villainMarch() {
    if (this.elapsed < VILLAIN_MARCH_START) return;
    const target = Math.min(VILLAIN_PATH.length,
      Math.floor((this.elapsed - VILLAIN_MARCH_START) / VILLAIN_MARCH_PACE) + 1);
    for (const id of VILLAIN_PATH) {
      if (this.ruinedPorts.size >= target) break;
      if (this.ruinedPorts.has(id) || id === this.currentPort) continue;
      this.ruinedPorts.add(id);
      this.news.push("WORD ARRIVES: " + CITIES[id].name + " HAS BURNED. THE DEVOURER SAILS WEST.");
    }
  },
};
