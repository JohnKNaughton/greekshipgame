// Ship-to-ship combat from above, FTL-with-pawns: your deck bottom-left,
// the enemy's dark hull closing from the upper right. Real time, pausable
// (SPACE or the button top-right) — and orders still flow while paused.
// Boarders storm your deck as pawns: mercenaries meet them automatically,
// and you can draft any named sailor onto a boarder by hand.

const MODULE_WEAPONS = {
  ballista:  { name: "BALLISTA",   dmg: 3, cd: 5 },
  catapult:  { name: "CATAPULT",   dmg: 5, cd: 8 },
  greekfire: { name: "GREEK FIRE", dmg: 4, cd: 7 },
};

const CBT_DECK_X = 24;

class CombatScene {
  constructor(voyage, enemy) {
    this.music = "battle";
    this.voyage = voyage;
    this.enemy = enemy;
    this.enemyHp = enemy.hull;
    this.enemyTimer = enemy.cd * 0.9;

    // Enemy deck geometry (the boss's flagship dwarfs everything).
    this.eW = enemy.boss ? 200 : 150;
    this.eH = enemy.boss ? 64 : 50;
    this.eX = VIRTUAL_W - this.eW - (enemy.boss ? 12 : 24);
    this.eY = 40;

    // Your battery: archers always; weaponized modules add their mounts.
    this.weapons = [{ name: "ARCHERS", station: "archers", dmg: 2, cd: 4, timer: 2 }];
    Game.modules.forEach((id, i) => {
      if (MODULE_WEAPONS[id]) {
        this.weapons.push({ ...MODULE_WEAPONS[id], station: "mod" + i, timer: 1.5 });
      }
    });

    this.paused = false;
    this.over = null;
    this.projectiles = [];
    this.floaters = [];
    this.impacts = [];
    this.boarders = [];
    this.boardTimer = enemy.boarders > 0 ? (enemy.boss ? 8 : 10 + Math.random() * 6) : -1;
    this.surrenderTimer = 1;

    this.pauseBtn = new Button(446, 20, 28, 16, () => (this.paused ? ">" : "II"), 1);
    this.contBtn = new Button(190, 168, 100, 20, "CONTINUE", 1);
    buildDeck();
    this.dy = Math.round(164 - DECK.H / 2);
    // The enemy holds the upper right, so the stations panel drops low.
    CrewUI.panelAnchor = "bottom";
  }

  float(x, y, txt, color) {
    this.floaters.push({ x, y, txt, color, life: 1.2 });
  }

  get dodge() {
    let d = 0;
    const helm = CrewUI.manned("helm");
    if (helm) d += 0.1 + skillOf(helm, "sailing") * 0.02;
    d += Math.min(0.06, CrewUI.benchesManned() * 0.015);
    if (Game.modules.includes("poseidon")) d += 0.1;
    return d;
  }

  finish(won, lines) {
    this.over = { won, lines };
  }

  update(dt, t) {
    for (const f of this.floaters) { f.y -= 10 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const im of this.impacts) im.life -= dt;
    this.impacts = this.impacts.filter((im) => im.life > 0);

    if (this.over) {
      if (this.contBtn.clicked() || Input.pressed("Enter")) {
        if (!this.over.won) {
          Scenes.change(new DeathScene(this.over.lines[0]));
        } else if (this.enemy.boss) {
          Game.bossDefeated = true;
          Scenes.change(new VictoryScene());
        } else {
          this.voyage.eventDone();
          Scenes.change(this.voyage);
        }
      }
      return;
    }

    if (this.pauseBtn.clicked() || Input.pressed("Space")) {
      this.paused = !this.paused;
    }

    // Orders flow even while time stands still — that's what pausing is for.
    CrewUI.update(this.paused ? 0 : dt, { threats: this.boarders, training: !this.paused });
    if (CrewUI.handleClick(CBT_DECK_X, this.dy, this.boarders)) return;

    if (this.paused) return;

    // --- Your battery: every body at a mount speeds it; the archer post
    // fires true volleys, one bolt per archer manning the platform. ---
    for (const w of this.weapons) {
      const occ = CrewUI.occupants(w.station); // named crew (skill + xp)
      const st = CrewUI.stationById(w.station);
      const heads = st ? CrewUI.stationCount(st) : 0; // crew + merc garrison
      let rate = 1;
      if (heads) {
        const best = occ.length ? Math.max(...occ.map((c) => skillOf(c, "arms"))) : 0;
        // Archers gain volume through volley size; mounts gain reload speed.
        rate = (w.station === "archers" ? 1.2 : 1.5) + best * 0.12;
      }
      w.timer -= dt * rate;
      if (w.timer <= 0) {
        w.timer = w.cd;
        const p = st ? stationCenter(st) : { x: 160, y: 36 };
        const shots = w.station === "archers" ? Math.max(1, heads) : 1;
        for (let s = 0; s < shots; s++) {
          this.projectiles.push({
            x: CBT_DECK_X + p.x + (s % 2) * 6 - 3, y: this.dy + p.y + (s % 3) * 4 - 4,
            tx: this.eX + 20 + Math.random() * (this.eW - 40),
            ty: this.eY + 8 + Math.random() * (this.eH - 12),
            f: -s * 0.06, dmg: w.dmg, target: "enemy",
            fire: st && st.module === "greekfire",
          });
        }
        for (const c of occ) c.xp.arms += 1;
      }
    }

    // --- Their reply ---
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0) {
      this.enemyTimer = this.enemy.cd;
      this.projectiles.push({
        x: this.eX + 8, y: this.eY + this.eH / 2,
        tx: CBT_DECK_X + 30 + Math.random() * (DECK.W - 60),
        ty: this.dy + 12 + Math.random() * (DECK.H - 24),
        f: 0, dmg: this.enemy.dmg, target: "player",
      });
    }

    // --- Bolts in the air ---
    for (const p of this.projectiles) p.f += dt / 0.8;
    for (const p of this.projectiles.filter((p) => p.f >= 1)) {
      if (p.target === "enemy") {
        if (Math.random() < this.enemy.dodge) {
          this.float(p.tx, p.ty - 8, "MISS", PAL.seaFoam);
        } else {
          this.enemyHp -= p.dmg;
          this.impacts.push({ x: p.tx, y: p.ty, life: 0.35, fire: p.fire });
          this.float(p.tx, p.ty - 8, "-" + p.dmg, PAL.yellow);
        }
      } else {
        if (Math.random() < this.dodge) {
          this.float(p.tx, p.ty - 8, "MISS", PAL.seaFoam);
        } else {
          Game.hull -= p.dmg;
          this.impacts.push({ x: p.tx, y: p.ty, life: 0.35 });
          this.float(p.tx, p.ty - 8, "-" + p.dmg, PAL.red);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.f < 1);

    // --- Boarding: they leap aboard at the bow and hunt your pawns. ---
    if (this.boardTimer > 0) {
      this.boardTimer -= dt;
      if (this.boardTimer <= 0 && this.enemyHp > 0) {
        for (let i = 0; i < this.enemy.boarders; i++) {
          const hp = this.enemy.boss ? 4 : 3;
          this.boarders.push({
            x: DECK.W - 18 + (i % 2) * 8, y: DECK.cy - 10 + (i % 4) * 7,
            hp, hpMax: hp, swing: 0.8 + Math.random() * 0.5,
          });
        }
        this.float(CBT_DECK_X + 170, this.dy - 8, "BOARDERS!", PAL.red);
      }
    }
    this.updateMelee(dt);

    // --- Endings ---
    if (Game.hull <= 0) {
      Game.hull = 0;
      this.finish(false, ["YOUR SHIP SLIPPED BENEATH THE WAVES."]);
      return;
    }
    if (Game.crew.length === 0) {
      this.finish(false, ["YOUR CREW WAS SLAIN TO THE LAST HAND."]);
      return;
    }
    if (this.enemyHp <= 0) {
      if (this.enemy.boss) {
        this.finish(true, ["THE DEVOURER'S FLAGSHIP BURNS TO THE WATERLINE.", "FIFTY YEARS OF GRIEF, ANSWERED."]);
        return;
      }
      const loot = this.rollLoot(1);
      this.finish(true, ["THE " + this.enemy.name + " GOES DOWN BY THE BOW!", "+" + loot + " COPPER FISHED FROM THE WRECK"]);
      return;
    }
    if (!this.enemy.boss && this.enemyHp < this.enemy.hull * 0.3) {
      this.surrenderTimer -= dt;
      if (this.surrenderTimer <= 0) {
        this.surrenderTimer = 1;
        if (Math.random() < 0.15) {
          const loot = this.rollLoot(1.4);
          this.finish(true, ["HER CAPTAIN STRIKES HIS COLORS!", "+" + loot + " COPPER IN TRIBUTE"]);
        }
      }
    }
  }

  // Positional deck fight: boarders walk at the nearest pawn; adjacent
  // pairs trade blows on their swing timers.
  updateMelee(dt) {
    const defenders = CrewUI.allPawns().filter((p) => p.hp > 0);
    for (const b of this.boarders) {
      if (b.hp <= 0) continue;
      let near = null, best = 1e9;
      for (const d of defenders) {
        const dist = Math.hypot(d.x - b.x, d.y - b.y);
        if (dist < best) { best = dist; near = d; }
      }
      if (!near) break;
      if (best > 8) {
        b.x += ((near.x - b.x) / best) * 18 * dt;
        b.y += ((near.y - b.y) / best) * 18 * dt;
      } else {
        b.swing -= dt;
        if (b.swing <= 0) {
          b.swing = 1;
          near.hp -= 1;
          this.float(CBT_DECK_X + near.x, this.dy + near.y - 8, "-1", PAL.red);
          if (near.hp <= 0) this.killDefender(near);
        }
      }
    }
    // Defenders strike back at any boarder in reach.
    for (const d of defenders) {
      if (d.hp <= 0) continue;
      d.swing -= dt;
      if (d.swing > 0) continue;
      for (const b of this.boarders) {
        if (b.hp > 0 && Math.hypot(d.x - b.x, d.y - b.y) < 9) {
          d.swing = 1;
          const dmg = 1 + Math.floor(skillOf(d, "arms") / 2) +
            (Game.modules.includes("athena") ? 1 : 0);
          b.hp -= dmg;
          if (d.kind === "crew") d.xp.arms += 4;
          if (b.hp <= 0) {
            this.float(CBT_DECK_X + b.x, this.dy + b.y - 8, "FOE DOWN", PAL.green);
            if (!this.boarders.some((o) => o.hp > 0)) {
              this.float(CBT_DECK_X + 100, this.dy - 8, "DECK CLEARED!", PAL.green);
            }
          }
          break;
        }
      }
    }
    this.boarders = this.boarders.filter((b) => b.hp > 0);
  }

  killDefender(pawn) {
    if (pawn.kind === "crew") {
      Game.crew = Game.crew.filter((c) => c !== pawn);
      this.float(CBT_DECK_X + pawn.x, this.dy + pawn.y - 12, pawn.name + " FALLS", PAL.red);
    } else if (pawn.kind === "merc") {
      Game.mercs--;
      this.float(CBT_DECK_X + pawn.x, this.dy + pawn.y - 12, "MERC SLAIN", PAL.red);
    } else {
      Game.rowers--;
      this.float(CBT_DECK_X + pawn.x, this.dy + pawn.y - 12, "ROWER SLAIN", PAL.red);
    }
  }

  rollLoot(mult) {
    const [lo, hi] = this.enemy.loot;
    const loot = Math.round((lo + Math.random() * (hi - lo)) * mult);
    Game.resources.coins += loot;
    return loot;
  }

  draw(ctx, t) {
    drawTopSea(ctx, t, 0);

    // Enemy deck, closing from upwind
    drawEnemyDeck(ctx, this.eX + Math.round(Math.sin(t * 0.8) * 2), this.eY, this.eW, this.eH, t, {
      boss: this.enemy.boss,
      charge: 1 - this.enemyTimer / this.enemy.cd,
    });
    // Enemy crew milling about
    for (let i = 0; i < Math.min(5, 2 + (this.enemy.boarders || 0)); i++) {
      drawPawnTop(ctx, this.eX + 30 + i * 18 + Math.round(Math.sin(t * 1.5 + i) * 3),
        this.eY + 14 + (i % 3) * 12, t, { tunic: "#5a4a63" });
    }

    // Your deck and everyone on it, friend and boarder alike
    drawDeckShip(ctx, CBT_DECK_X, this.dy, t, { rowing: false });
    drawDeckUprights(ctx, CBT_DECK_X, this.dy, t, { boarders: this.boarders });

    // Bolts arc between the hulls with little shadows
    for (const p of this.projectiles) {
      if (p.f < 0) continue; // staggered volley shots not yet loosed
      const x = p.x + (p.tx - p.x) * p.f;
      const y = p.y + (p.ty - p.y) * p.f - Math.sin(Math.PI * p.f) * 22;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(Math.round(x), Math.round(p.y + (p.ty - p.y) * p.f), 3, 1);
      ctx.fillStyle = p.fire ? PAL.sailStripe : PAL.ink;
      ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
    }
    // Impact flashes
    for (const im of this.impacts) {
      ctx.fillStyle = im.fire ? PAL.sun : PAL.seaFoam;
      const r = Math.round((0.35 - im.life) * 14);
      ctx.fillRect(Math.round(im.x - r / 2), Math.round(im.y - 1), r, 2);
    }

    // Name plates + hull bars
    this.drawHullBar(ctx, CBT_DECK_X + DECK.W / 2, 112, Game.shipName.slice(0, 16), Game.hull, Game.hullMax, PAL.green);
    this.drawHullBar(ctx, this.eX + this.eW / 2, 30, this.enemy.name, this.enemyHp, this.enemy.hull, PAL.red);

    // Weapon cooldowns
    const wy = VIRTUAL_H - 12 - this.weapons.length * 12;
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      const y = wy + i * 12;
      const st = CrewUI.stationById(w.station);
      const heads = st ? CrewUI.stationCount(st) : 0;
      drawText(ctx, w.name, 8, y, 1, heads ? PAL.gold : PAL.white);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(78, y, 42, 5);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(78, y, Math.round(42 * (1 - w.timer / w.cd)), 5);
    }
    drawText(ctx, "DODGE " + Math.round(this.dodge * 100) + "%", 8, wy - 12, 1, PAL.seaFoam);

    for (const f of this.floaters) {
      drawTextC(ctx, f.txt, f.x, Math.round(f.y), 1, f.color);
    }

    if (this.boarders.length > 0) {
      drawTextC(ctx, "BOARDERS ON DECK: " + this.boarders.length, VIRTUAL_W / 2, 100, 1, PAL.red);
    }

    const info = CrewUI.hoverInfo();
    if (info) drawTooltip(ctx, info, Input.mx, Input.my - 14);

    this.pauseBtn.draw(ctx);
    if (this.paused && !this.over) {
      drawTextC(ctx, "PAUSED - GIVE YOUR ORDERS", VIRTUAL_W / 2, 118, 2, PAL.parchment);
    }

    if (this.over) {
      const w = 260;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect((VIRTUAL_W - w) / 2 + 3, 113, w, 84);
      ctx.fillStyle = PAL.parchment;
      ctx.fillRect((VIRTUAL_W - w) / 2, 110, w, 84);
      drawTextC(ctx, this.over.won ? "VICTORY" : "DISASTER", VIRTUAL_W / 2, 120, 2,
        this.over.won ? PAL.green : PAL.red);
      this.over.lines.forEach((ln, i) => {
        drawTextC(ctx, ln, VIRTUAL_W / 2, 140 + i * 11, 1, PAL.ink);
      });
      this.contBtn.draw(ctx);
    }

    CrewUI.drawRoster(ctx, t);
    if (!this.over) CrewUI.drawStationPanel(ctx, t);
    CrewUI.drawDrag(ctx);
    drawResourceBar(ctx, t);
  }

  drawHullBar(ctx, cx, y, name, hp, max, color) {
    drawTextC(ctx, name, cx, y - 9, 1, PAL.white);
    const w = 70;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 7);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(cx - w / 2, y, w, 5);
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, y, Math.max(0, Math.round(w * hp / max)), 5);
    drawTextC(ctx, Math.max(0, Math.ceil(hp)) + "/" + max, cx, y + 8, 1, PAL.white);
  }
}

// The long swim down.
class DeathScene {
  constructor(reason) {
    this.music = null;
    this.reason = reason;
  }

  update(dt, t) {
    if (Input.clicked || Input.pressed("Enter") || Input.pressed("Escape")) {
      Scenes.change(new TitleScene());
    }
  }

  draw(ctx, t) {
    ctx.fillStyle = "#0a1626";
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.save();
    ctx.translate(240, 120 + Math.sin(t * 0.8) * 4);
    ctx.rotate(0.35);
    ctx.scale(1.5, 1.5);
    ctx.globalAlpha = 0.4;
    drawShip(ctx, 0, 0, 0, { furled: true, oars: false });
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.seaLight;
    for (let i = 0; i < 8; i++) {
      const by = (270 - ((t * 24 + i * 47) % 290));
      ctx.fillRect(210 + (i * 37) % 90, by, 2, 2);
    }
    drawTextC(ctx, "THE SEA CLAIMS YOU", VIRTUAL_W / 2, 56, 3, PAL.seaFoam);
    drawTextC(ctx, this.reason, VIRTUAL_W / 2, 92, 1, PAL.white);
    drawTextC(ctx, "YOU SAILED UNTIL " + Game.year + " BC WITH " +
      Game.resources.coins + " COPPER ABOARD", VIRTUAL_W / 2, 200, 1, PAL.seaLight);
    if (Math.sin(t * 3) > -0.3) {
      drawTextC(ctx, "CLICK TO RETURN TO THE TITLE", VIRTUAL_W / 2, 226, 1, PAL.parchment);
    }
  }
}
