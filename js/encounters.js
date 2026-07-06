// Placeholder encounter content — enemy pools and scripted stories.
// These get curated one by one later; the machinery around them is real.

const ENEMIES = {
  easy: [
    { name: "PIRATE SKIFF",       hull: 10, dmg: 1, cd: 3.5, boarders: 0, dodge: 0,    loot: [15, 30] },
    { name: "SEA RAIDERS",        hull: 12, dmg: 2, cd: 4.5, boarders: 2, dodge: 0,    loot: [20, 40] },
  ],
  medium: [
    { name: "PIRATE PENTEKONTER", hull: 18, dmg: 3, cd: 4.0, boarders: 2, dodge: 0.1,  loot: [45, 80] },
    { name: "TYRRHENIAN CORSAIR", hull: 16, dmg: 2, cd: 3.0, boarders: 4, dodge: 0.1,  loot: [50, 90] },
  ],
  hard: [
    { name: "WARLORD'S TRIREME",  hull: 30, dmg: 4, cd: 3.0, boarders: 6, dodge: 0.15, loot: [120, 220] },
  ],
};

// Enemies stiffen as the years pass (placeholder curve: +2% per year).
function pickEnemy(tier) {
  const pool = ENEMIES[tier] || ENEMIES.easy;
  const def = pool[Math.floor(Math.random() * pool.length)];
  const m = 1 + Game.elapsed * 0.02;
  return {
    ...def, tier,
    hull: Math.round(def.hull * m),
    dmg: Math.round(def.dmg * (1 + Game.elapsed * 0.012)),
    loot: [Math.round(def.loot[0] * m), Math.round(def.loot[1] * m)],
  };
}

// The villain himself, waiting at the end of the fifty years.
// (Name, stats, and everything else about him is placeholder for curation.)
function makeBoss() {
  return {
    name: "THE DEVOURER", boss: true,
    hull: 60, dmg: 6, cd: 2.6, boarders: 8, dodge: 0.15, loot: [0, 0],
  };
}

// Story choices: optional `need` (resource requirements shown and enforced;
// "space" means free cargo room), and resolve() applies effects and returns
// the outcome line.
const STORIES = [
  {
    title: "THE CASTAWAY",
    text: "A MAN CLINGS TO A SHATTERED MAST, WAVING WEAKLY AS THE SWELL LIFTS HIM IN AND OUT OF SIGHT.",
    choices: [
      {
        label: "PULL HIM ABOARD",
        resolve() {
          if (Game.bunksUsed < Game.crewCap) {
            const c = makeCrew();
            Game.crew.push(c);
            return c.name + " JOINS YOUR CREW, SWEARING LIFELONG THANKS.";
          }
          Game.resources.coins += 15;
          return "NO BUNKS FREE - HE SHARES THE SECRET OF A SMUGGLERS' COVE INSTEAD. +15 COPPER";
        },
      },
      {
        label: "SEARCH THE WRECKAGE FIRST",
        resolve() {
          if (Math.random() < 0.5) {
            Game.resources.coins += 12;
            return "LASHED TO THE SPARS: A DEAD MAN'S PURSE. +12 COPPER";
          }
          Game.hull = Math.max(1, Game.hull - 1);
          return "HIDDEN NAILS GOUGE YOUR PLANKS AS YOU GRAPPLE IT. -1 HULL";
        },
      },
      {
        label: "SAIL PAST",
        resolve() { return "HIS CRIES FADE BEHIND YOU. THE GODS REMEMBER SUCH THINGS."; },
      },
    ],
  },
  {
    title: "DRIFTING AMPHORAE",
    text: "A DOZEN SEALED AMPHORAE BOB IN YOUR PATH, STILL ROPED TO A SPLINTER OF DECK. NO SHIP IN SIGHT.",
    choices: [
      {
        label: "HAUL THEM UP",
        need: { space: 2 },
        resolve() {
          if (Math.random() < 0.7) {
            Game.resources.pottery += 2;
            return "FINE GLAZED WARE, WORTH GOOD COPPER. +2 POTTERY";
          }
          Game.resources.provisions = Math.max(0, Game.resources.provisions - 1);
          return "SOUR WINE AND ANGRY WASPS. THE CREW EATS DOUBLE TO FORGET. -1 PROVISIONS";
        },
      },
      {
        label: "SMASH THEM FOR SPORT",
        resolve() { return "THE CREW CHEERS EVERY THROW. NOTHING GAINED, NOTHING LOST."; },
      },
    ],
  },
  {
    title: "THE BECALMED MERCHANT",
    text: "A FAT MERCHANTMAN LIES BECALMED, SAILS SLACK. HER CAPTAIN CALLS ACROSS THE WATER: 'WATER, FRIENDS! NAME YOUR PRICE!'",
    choices: [
      {
        label: "SELL 3 WATER",
        need: { water: 3 },
        resolve() {
          Game.resources.water -= 3;
          Game.resources.coins += 30;
          return "HE PAYS IN GOOD PHOENICIAN WEIGHT. +30 COPPER";
        },
      },
      {
        label: "GIVE A SKIN FREELY",
        need: { water: 1 },
        resolve() {
          Game.resources.water -= 1;
          Game.resources.coins += 5;
          return "HE BLESSES YOUR NAME AND PRESSES A COIN ON YOU ANYWAY. +5 COPPER";
        },
      },
      {
        label: "DEMAND HER CARGO",
        resolve() {
          if (Math.random() < 0.5) {
            Game.resources.textiles += 1;
            Game.resources.coins += 10;
            return "HER CREW YIELDS A BALE AND A PURSE TO BE RID OF YOU. +1 TEXTILES, +10 COPPER";
          }
          Game.hull = Math.max(1, Game.hull - 2);
          return "HER GUARDS ANSWER WITH FIRE ARROWS. YOU SHEER OFF, SMOKING. -2 HULL";
        },
      },
    ],
  },
  {
    title: "POSEIDON'S DOLPHINS",
    text: "DOLPHINS RACE YOUR BOW WAVE, LEAPING IN PAIRS. THE OLDEST HAND SAYS THE SEA GOD'S EYE IS ON YOU.",
    choices: [
      {
        label: "CAST 10 COPPER TO THE WAVES",
        need: { coins: 10 },
        resolve() {
          Game.resources.coins -= 10;
          Game.hull = Math.min(Game.hullMax, Game.hull + 4);
          return "THE SEA HOLDS YOUR SHIP GENTLY. SPRUNG SEAMS CLOSE OF THEMSELVES. +4 HULL";
        },
      },
      {
        label: "SAIL ON",
        resolve() { return "THE DOLPHINS PEEL AWAY. THE WIND TURNS A LITTLE COLDER."; },
      },
    ],
  },
];

function pickStory() {
  return STORIES[Math.floor(Math.random() * STORIES.length)];
}

// Scripted, guaranteed stories keyed by id. The opening one always waits on
// the first crossing from home: a second pair of hands, or a second cache.
const FIXED_STORIES = {
  opening: {
    title: "SMOKE ON THE WATER",
    text: "HALF A DAY OUT, A SINKING RAFT: A NEIGHBOR'S SON WHO SWAM THE HARBOR, AND A ROPED CACHE SOMEONE DIED SAVING. THE RAFT GOES UNDER. YOU CAN TAKE ONE ABOARD.",
    choices: [
      {
        label: "SAVE THE SURVIVOR",
        resolve() {
          Game.openingDone = true;
          const c = makeCrew();
          Game.crew.push(c);
          return c.name + " CLIMBS ABOARD, EYES STILL FULL OF THE FIRE. YOU ARE TWO NOW.";
        },
      },
      {
        label: "HAUL UP THE CACHE",
        resolve() {
          Game.openingDone = true;
          const g = GOOD_IDS[Math.floor(Math.random() * GOOD_IDS.length)];
          Game.resources[g] += 20; // crams the hold past its beams — sell soon
          return "TWENTY MEASURES OF " + GOODS[g].name +
            ", LASHED WHEREVER THEY FIT. THE BOY'S FACE FOLLOWS YOU IN DREAMS.";
        },
      },
    ],
  },
};

function storyNeedMet(need) {
  if (!need) return true;
  for (const k in need) {
    if (k === "space") {
      if (Game.cargoCap - Game.cargoUsed < need[k]) return false;
    } else if ((Game.resources[k] || 0) < need[k]) return false;
  }
  return true;
}

function storyNeedLabel(need) {
  if (!need) return "";
  const parts = [];
  for (const k in need) {
    parts.push(need[k] + " " + (k === "space" ? "CARGO ROOM" : k.toUpperCase()));
  }
  return " (NEEDS " + parts.join(", ") + ")";
}
