// Polyreme — boot, game loop, input, and scene management.

const VIRTUAL_W = 480;
const VIRTUAL_H = 270;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// --- Display scaling: largest integer multiple of 480x270 that fits the window ---
function fitCanvas() {
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / VIRTUAL_W),
    Math.floor(window.innerHeight / VIRTUAL_H)
  ));
  canvas.style.width = VIRTUAL_W * scale + "px";
  canvas.style.height = VIRTUAL_H * scale + "px";
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// --- Input: mouse in virtual pixels, per-frame click + key-press flags ---
const Input = {
  mx: -1,
  my: -1,
  clicked: false,       // true for exactly one frame after a mousedown
  down: false,          // button currently held (for drag boxes)
  released: false,      // true for exactly one frame after a mouseup
  _pressed: new Set(),  // key codes pressed since last frame
  _held: new Set(),     // key codes currently held down
  typed: [],            // printable characters typed since last frame
  pressed(code) {
    return this._pressed.has(code);
  },
  held(code) {
    return this._held.has(code);
  },
  endFrame() {
    this.clicked = false;
    this.released = false;
    this._pressed.clear();
    this.typed = [];
  },
};

function toVirtual(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * VIRTUAL_W,
    y: ((e.clientY - r.top) / r.height) * VIRTUAL_H,
  };
}

canvas.addEventListener("mousemove", (e) => {
  const p = toVirtual(e);
  Input.mx = p.x;
  Input.my = p.y;
});
canvas.addEventListener("mousedown", (e) => {
  const p = toVirtual(e);
  Input.mx = p.x;
  Input.my = p.y;
  Input.clicked = true;
  Input.down = true;
  // Browsers unlock audio only on a gesture.
  Music.init();
});
window.addEventListener("mouseup", () => {
  Input.down = false;
  Input.released = true;
});
window.addEventListener("keydown", (e) => {
  if (!e.repeat) Input._pressed.add(e.code);
  Input._held.add(e.code);
  if (e.key && e.key.length === 1) Input.typed.push(e.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  Input._held.delete(e.code);
});

// --- Scene manager with a fade-to-ink transition ---
const Scenes = {
  current: null,
  next: null,
  fade: 0,        // 0 = clear, 1 = fully faded
  fadeDir: 0,     // 1 fading out, -1 fading in
  change(scene) {
    if (this.fadeDir !== 0) return;
    this.next = scene;
    this.fadeDir = 1;
  },
  update(dt, t) {
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * 3;
      if (this.fade >= 1) {
        this.fade = 1;
        this.current = this.next;
        this.next = null;
        this.fadeDir = -1;
        Music.setTrack(this.current.music === undefined ? "calm" : this.current.music);
      } else if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    } else if (this.current) {
      this.current.update(dt, t);
    }
  },
  draw(ctx, t) {
    if (this.current) this.current.draw(ctx, t);
    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      ctx.globalAlpha = 1;
    }
  },
};

// --- Main loop ---
Game.newGame();
// Debug helper: ?scene=port|map|depart|voyage|market|dock|shipwright|tavern|temple|barracks
const bootScene = new URLSearchParams(location.search).get("scene");
if (bootScene === "port") {
  Scenes.current = new PortScene();
} else if (bootScene === "map" || bootScene === "depart") {
  Scenes.current = new MapScene(new PortScene(), bootScene === "map" ? "view" : "depart");
} else if (bootScene === "mapeast" || bootScene === "mapat") {
  const at = new URLSearchParams(location.search).get("city");
  Game.currentPort = CITIES[at] ? at : "sinope";
  Scenes.current = new MapScene(new PortScene(), "view");
} else if (bootScene === "voyage") {
  Scenes.current = new VoyageScene("tyre", "kition");
} else if (["market", "dock", "tavern", "temple", "barracks", "ship"].includes(bootScene)) {
  const p = new PortScene();
  p.openPanel(bootScene);
  Scenes.current = p;
} else if (bootScene === "combat" || bootScene === "combatmed") {
  // A kitted-out test rig: liburnian, garrison, and a ballista.
  Game.upgrades = { hull: 1, sails: 2, archers: 2, quarters: 2 };
  Game.modules = ["ballista"];
  Game.mercs = 3;
  Game.rowers = 2;
  Scenes.current = new CombatScene(new VoyageScene("tyre", "kition"),
    pickEnemy(bootScene === "combat" ? "easy" : "medium"));
} else if (bootScene === "story") {
  Scenes.current = new StoryScene(new VoyageScene("tyre", "kition"), pickStory());
} else if (bootScene === "death") {
  Scenes.current = new DeathScene("YOUR SHIP SLIPPED BENEATH THE WAVES.");
} else if (bootScene === "name") {
  Scenes.current = new NameScene();
} else if (bootScene === "intro") {
  Game.shipName = "EMBER";
  Scenes.current = new IntroScene();
} else if (bootScene === "victory") {
  Scenes.current = new VictoryScene();
} else if (bootScene === "boss") {
  Scenes.current = new CombatScene(null, makeBoss());
} else if (bootScene === "port2") {
  Game.currentPort = "syracuse";
  Scenes.current = new PortScene();
} else {
  Scenes.current = new TitleScene();
}
Music.setTrack(Scenes.current.music === undefined ? "calm" : Scenes.current.music);

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const t = now / 1000;

  if (Input.pressed("KeyN")) Music.toggle();

  Scenes.update(dt, t);
  Scenes.draw(ctx, t);
  Input.endFrame();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
