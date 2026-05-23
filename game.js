(function initialiseBlasterGame(global) {
  const DATA = global.BlasterData;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const refs = {
    levelChip: document.getElementById("levelChip"),
    coinChip: document.getElementById("coinChip"),
    healthChip: document.getElementById("healthChip"),
    bossChip: document.getElementById("bossChip"),
    abilityMeter: document.getElementById("abilityMeter"),
    abilityFill: document.getElementById("abilityFill"),
    abilityText: document.getElementById("abilityText"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayBody: document.getElementById("overlayBody"),
    primaryAction: document.getElementById("primaryAction"),
    secondaryAction: document.getElementById("secondaryAction"),
    selectedCharacterName: document.getElementById("selectedCharacterName"),
    selectedCharacterMeta: document.getElementById("selectedCharacterMeta"),
    healthMeter: document.getElementById("healthMeter"),
    chargeMeter: document.getElementById("chargeMeter"),
    characterShop: document.getElementById("characterShop"),
    weaponShop: document.getElementById("weaponShop"),
    armourShop: document.getElementById("armourShop"),
    itemShop: document.getElementById("itemShop")
  };

  const ARENA = { width: 2800, height: 1900 };
  const keys = new Set();
  let lastTime = performance.now();
  let canvasScale = 1;

  const state = {
    screen: "menu",
    level: 1,
    coins: 0,
    totalKills: 0,
    selectedCharacter: DATA.characters[0].id,
    selectedWeapon: DATA.weapons[0].id,
    selectedArmour: DATA.armour[0].id,
    owned: {
      characters: new Set([DATA.characters[0].id]),
      weapons: new Set([DATA.weapons[0].id]),
      armour: new Set([DATA.armour[0].id]),
      items: new Set()
    },
    player: null,
    enemies: [],
    projectiles: [],
    enemyShots: [],
    pickups: [],
    particles: [],
    camera: { x: 0, y: 0 },
    elapsed: 0,
    spawnTimer: 0,
    bossSpawned: false,
    bossDefeated: false,
    boss: null,
    bossRewardLast: 0,
    deathTimer: 0,
    attackTimer: 0,
    abilityCooldown: 0,
    activeAbility: null,
    config: DATA.levelConfig(1),
    flash: 0
  };

  function byId(collection, id) {
    return collection.find((entry) => entry.id === id) || collection[0];
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(1, Math.min(2, global.devicePixelRatio || 1));
    const width = Math.max(640, Math.floor(rect.width * scale));
    const height = Math.max(420, Math.floor(rect.height * scale));
    if (canvas.width === width && canvas.height === height && canvasScale === scale) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    canvasScale = scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function viewWidth() {
    return canvas.width / canvasScale;
  }

  function viewHeight() {
    return canvas.height / canvasScale;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalise(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function hasItem(effect) {
    return DATA.items.find((item) => item.effect === effect && state.owned.items.has(item.id));
  }

  function selectedStats() {
    const character = byId(DATA.characters, state.selectedCharacter);
    const weapon = byId(DATA.weapons, state.selectedWeapon);
    const armour = byId(DATA.armour, state.selectedArmour);
    const cooldownItem = hasItem("cooldownMultiplier");

    return {
      character,
      weapon,
      armour,
      maxHealth: character.maxHealth + armour.healthBonus,
      speed: character.speed,
      damage: Math.max(1, weapon.damage + character.damageBonus),
      cooldown: weapon.cooldown * (cooldownItem ? cooldownItem.value : 1),
      damageReduction: armour.damageReduction
    };
  }

  function createPlayer() {
    const stats = selectedStats();
    return {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      radius: 22,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      speed: stats.speed,
      fall: 0,
      angle: 0,
      stats
    };
  }

  function startLevel() {
    state.config = DATA.levelConfig(state.level);
    state.player = createPlayer();
    state.enemies = [];
    state.projectiles = [];
    state.enemyShots = [];
    state.pickups = [];
    state.particles = [];
    state.elapsed = 0;
    state.spawnTimer = 0;
    state.bossSpawned = false;
    state.bossDefeated = false;
    state.boss = null;
    state.deathTimer = 0;
    state.attackTimer = 0;
    state.abilityCooldown = 0;
    state.activeAbility = null;
    state.flash = 0;
    state.screen = "playing";
    refs.overlay.classList.add("hidden");
    renderShops();
  }

  function showOverlay(title, body, primary, secondary) {
    refs.overlayTitle.textContent = title;
    refs.overlayBody.textContent = body;
    refs.overlayKicker.textContent = `Level ${state.level}`;
    refs.primaryAction.textContent = primary.label;
    refs.secondaryAction.textContent = secondary.label;
    refs.primaryAction.onclick = primary.action;
    refs.secondaryAction.onclick = secondary.action;
    refs.overlay.classList.remove("hidden");
  }

  function resetArenaPreview() {
    state.player = createPlayer();
    state.enemies = [];
    state.projectiles = [];
    state.enemyShots = [];
    state.pickups = [];
    state.particles = [];
    state.boss = null;
    state.bossSpawned = false;
    state.activeAbility = null;
    state.abilityCooldown = 0;
    updateCamera();
  }

  function showMenu() {
    resetArenaPreview();
    state.screen = "menu";
    showOverlay(
      "Blaster",
      "Arena ready.",
      { label: "Start", action: startLevel },
      { label: "Shop", action: () => refs.overlay.classList.add("hidden") }
    );
  }

  function endGame() {
    state.screen = "gameover";
    showOverlay(
      "GAME OVER!",
      "Your character hit the ground before the boss went down.",
      { label: "Retry", action: startLevel },
      { label: "Shop", action: showMenu }
    );
  }

  function clearLevel() {
    state.screen = "cleared";
    state.bossRewardLast = DATA.bossReward(state.level);
    state.coins += state.bossRewardLast;
    state.boss = null;
    state.enemyShots = [];
    renderShops();
    showOverlay(
      "YOU CLEARED THE LEVEL!",
      `Boss defeated. You gained ${state.bossRewardLast} coins.`,
      {
        label: state.level >= DATA.MAX_LEVEL ? "Level 500" : "Next Level",
        action: () => {
          if (state.level < DATA.MAX_LEVEL) {
            state.level += 1;
          }
          startLevel();
        }
      },
      { label: "Shop", action: showMenu }
    );
  }

  function spawnEnemy(type, x, y, scale) {
    const config = state.config;
    const enemyScale = scale || 1;
    const health = type.baseHealth * config.enemyHealthMultiplier * enemyScale;
    const enemy = {
      id: global.crypto && typeof global.crypto.randomUUID === "function"
        ? global.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      type,
      x,
      y,
      radius: type.radius * Math.sqrt(enemyScale),
      health,
      maxHealth: health,
      speed: type.speed * config.enemySpeedMultiplier,
      touchDamage: type.touchDamage * config.enemyDamageMultiplier,
      shootTimer: rand(0.2, type.shootCooldown || 1.4),
      freezeTimer: 0,
      scale: enemyScale,
      boss: false
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function spawnEnemyAwayFromPlayer() {
    const available = DATA.availableEnemies(state.level);
    const type = available[Math.floor(Math.random() * available.length)];
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = rand(80, ARENA.width - 80);
      y = 70;
    } else if (side === 1) {
      x = ARENA.width - 70;
      y = rand(80, ARENA.height - 80);
    } else if (side === 2) {
      x = rand(80, ARENA.width - 80);
      y = ARENA.height - 70;
    } else {
      x = 70;
      y = rand(80, ARENA.height - 80);
    }

    if (state.player && Math.hypot(x - state.player.x, y - state.player.y) < 520) {
      x = ARENA.width - x;
      y = ARENA.height - y;
    }

    spawnEnemy(type, x, y);
  }

  function spawnBoss() {
    const bossType = DATA.bossForLevel(state.level);
    const config = state.config;
    const angle = rand(0, Math.PI * 2);
    const x = clamp(state.player.x + Math.cos(angle) * 650, 100, ARENA.width - 100);
    const y = clamp(state.player.y + Math.sin(angle) * 650, 100, ARENA.height - 100);
    const health = bossType.baseHealth * config.bossHealthMultiplier;
    const boss = {
      id: `boss-${state.level}`,
      type: bossType,
      x,
      y,
      radius: bossType.radius,
      health,
      maxHealth: health,
      speed: bossType.speed * (1 + state.level * 0.002),
      touchDamage: bossType.touchDamage * config.enemyDamageMultiplier,
      shootTimer: 1.1,
      freezeTimer: 0,
      boss: true,
      pulse: 0
    };
    state.boss = boss;
    state.bossSpawned = true;
    state.enemies.push(boss);
    burst(x, y, bossType.accent, 34);
  }

  function spawnPickup(x, y, type) {
    state.pickups.push({
      x,
      y,
      type,
      radius: type === "heal" ? 15 : 10,
      value: type === "heal" ? 34 + (hasItem("healBonus")?.value || 0) : 1,
      life: 18
    });
  }

  function burst(x, y, colour, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(60, 250);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour,
        life: rand(0.3, 0.9),
        maxLife: 0.9,
        radius: rand(2, 5)
      });
    }
  }

  function damageEnemy(enemy, amount, source) {
    const armourReduction = enemy.type.armour || 0;
    enemy.health -= amount * (1 - armourReduction);
    enemy.hitFlash = 0.12;

    if (enemy.health <= 0) {
      killEnemy(enemy, source);
    }
  }

  function killEnemy(enemy, source) {
    const index = state.enemies.indexOf(enemy);
    if (index >= 0) {
      state.enemies.splice(index, 1);
    }

    burst(enemy.x, enemy.y, enemy.type.accent || enemy.type.colour, enemy.boss ? 80 : 18);

    if (enemy.boss) {
      state.bossDefeated = true;
      clearLevel();
      return;
    }

    state.totalKills += 1;
    const coinBonus = hasItem("coinBonus") ? hasItem("coinBonus").value : 0;
    state.coins += DATA.ENEMY_COIN_REWARD + coinBonus;

    if (enemy.type.splits && enemy.scale >= 0.9) {
      for (let i = 0; i < 2; i += 1) {
        spawnEnemy(enemy.type, enemy.x + rand(-24, 24), enemy.y + rand(-24, 24), 0.46);
      }
    }

    if (Math.random() < 0.18 || source === "boss-minion") {
      spawnPickup(enemy.x + rand(-16, 16), enemy.y + rand(-16, 16), "heal");
    }

    renderShops();
  }

  function takeDamage(amount) {
    if (!state.player || state.screen !== "playing") {
      return;
    }
    const reduced = amount * (1 - state.player.stats.damageReduction);
    state.player.health -= reduced;
    state.flash = 0.16;
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.screen = "dying";
      state.deathTimer = 0;
      refs.overlay.classList.add("hidden");
    }
  }

  function nearestEnemy(range) {
    let best = null;
    let bestDistance = range;
    for (const enemy of state.enemies) {
      const d = distance(state.player, enemy) - enemy.radius;
      if (d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    }
    return best;
  }

  function playerAttack() {
    const weapon = state.player.stats.weapon;
    const target = nearestEnemy(weapon.range);
    if (!target) {
      return;
    }

    const baseAngle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    state.player.angle = baseAngle;

    if (weapon.melee) {
      damageEnemy(target, state.player.stats.damage, "player");
      target.freezeTimer = Math.max(target.freezeTimer, weapon.freezeDuration);
      burst(target.x, target.y, weapon.colour, 10);
      return;
    }

    const pellets = weapon.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      const offset = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * weapon.spread;
      const angle = baseAngle + offset;
      state.projectiles.push({
        x: state.player.x + Math.cos(angle) * 24,
        y: state.player.y + Math.sin(angle) * 24,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        radius: weapon.pierce ? 6 : 5,
        damage: state.player.stats.damage,
        life: weapon.range / weapon.projectileSpeed,
        colour: weapon.colour,
        freezeDuration: weapon.freezeDuration,
        pierce: weapon.pierce || 0,
        hit: new Set()
      });
    }
  }

  function activateAbility() {
    if (!state.player || state.screen !== "playing" || state.abilityCooldown > 0 || state.activeAbility) {
      return;
    }

    const ability = state.player.stats.character.ability;
    const cooldownItem = hasItem("cooldownMultiplier");
    const cooldown = ability.cooldown * (cooldownItem ? cooldownItem.value : 1);
    state.abilityCooldown = cooldown;

    if (ability.id === "dash") {
      state.activeAbility = { id: "dash", time: ability.duration, maxTime: ability.duration };
      burst(state.player.x, state.player.y, state.player.stats.character.accent, 18);
    }

    if (ability.id === "heal-wave") {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + ability.heal);
      burst(state.player.x, state.player.y, "#22c55e", 26);
    }

    if (ability.id === "frost-burst") {
      for (const enemy of state.enemies) {
        if (distance(state.player, enemy) <= ability.radius + enemy.radius) {
          enemy.freezeTimer = Math.max(enemy.freezeTimer, ability.freezeDuration);
          damageEnemy(enemy, ability.damage, "ability");
        }
      }
      burst(state.player.x, state.player.y, "#67e8f9", 34);
    }

    if (ability.id === "force-field") {
      state.activeAbility = {
        id: "force-field",
        time: ability.duration,
        maxTime: ability.duration,
        radius: ability.radius,
        bossDamagePerSecond: ability.bossDamagePerSecond
      };
      burst(state.player.x, state.player.y, state.player.stats.character.accent, 40);
    }
  }

  function updateAbility(dt) {
    if (state.abilityCooldown > 0) {
      state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);
    }

    if (!state.activeAbility) {
      return;
    }

    state.activeAbility.time -= dt;

    if (state.activeAbility.id === "dash" && state.activeAbility.time <= 0) {
      state.activeAbility = null;
    }

    if (state.activeAbility && state.activeAbility.id === "force-field") {
      for (const enemy of [...state.enemies]) {
        if (distance(state.player, enemy) <= state.activeAbility.radius + enemy.radius) {
          if (enemy.boss) {
            damageEnemy(enemy, state.activeAbility.bossDamagePerSecond * dt, "force-field");
          } else {
            damageEnemy(enemy, enemy.health + 999, "force-field");
          }
        }
      }

      if (state.activeAbility && state.activeAbility.time <= 0) {
        state.activeAbility = null;
      }
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    let mx = 0;
    let my = 0;
    if (keys.has("arrowup") || keys.has("w")) my -= 1;
    if (keys.has("arrowdown") || keys.has("s")) my += 1;
    if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
    if (keys.has("arrowright") || keys.has("d")) mx += 1;

    if (mx || my) {
      const dir = normalise(mx, my);
      const dash = state.activeAbility?.id === "dash" ? state.player.stats.character.ability.speedMultiplier : 1;
      player.x = clamp(player.x + dir.x * player.speed * dash * dt, player.radius, ARENA.width - player.radius);
      player.y = clamp(player.y + dir.y * player.speed * dash * dt, player.radius, ARENA.height - player.radius);
      player.angle = Math.atan2(dir.y, dir.x);
    }

    state.attackTimer -= dt;
    if (state.attackTimer <= 0) {
      playerAttack();
      state.attackTimer = player.stats.cooldown;
    }
  }

  function updateEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.hitFlash) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      }

      if (enemy.freezeTimer > 0) {
        enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
      } else {
        const dir = normalise(player.x - enemy.x, player.y - enemy.y);
        const desiredDistance = enemy.type.shoots && !enemy.boss ? 280 : 0;
        const currentDistance = distance(player, enemy);
        const moveSign = currentDistance < desiredDistance ? -0.42 : 1;
        enemy.x = clamp(enemy.x + dir.x * enemy.speed * moveSign * dt, enemy.radius, ARENA.width - enemy.radius);
        enemy.y = clamp(enemy.y + dir.y * enemy.speed * moveSign * dt, enemy.radius, ARENA.height - enemy.radius);
      }

      if (distance(player, enemy) < player.radius + enemy.radius) {
        takeDamage(enemy.touchDamage * dt);
      }

      if (enemy.type.shoots || enemy.boss) {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && enemy.freezeTimer <= 0) {
          shootAtPlayer(enemy);
          enemy.shootTimer = enemy.boss ? 1.25 : enemy.type.shootCooldown;
        }
      }
    }
  }

  function shootAtPlayer(enemy) {
    const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
    const shots = enemy.boss ? 5 : 1;
    for (let i = 0; i < shots; i += 1) {
      const offset = shots === 1 ? 0 : (i - 2) * 0.18;
      const shotAngle = angle + offset;
      state.enemyShots.push({
        x: enemy.x + Math.cos(shotAngle) * enemy.radius,
        y: enemy.y + Math.sin(shotAngle) * enemy.radius,
        vx: Math.cos(shotAngle) * (enemy.boss ? 300 : 250),
        vy: Math.sin(shotAngle) * (enemy.boss ? 300 : 250),
        radius: enemy.boss ? 8 : 6,
        damage: enemy.boss ? 18 * state.config.enemyDamageMultiplier : 10 * state.config.enemyDamageMultiplier,
        life: 3.4,
        colour: enemy.type.bulletColour || enemy.type.accent
      });
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of [...state.projectiles]) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;

      for (const enemy of [...state.enemies]) {
        if (projectile.hit.has(enemy.id)) {
          continue;
        }
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          damageEnemy(enemy, projectile.damage, "projectile");
          enemy.freezeTimer = Math.max(enemy.freezeTimer, projectile.freezeDuration || 0);
          projectile.hit.add(enemy.id);
          if (projectile.pierce > 0) {
            projectile.pierce -= 1;
          } else {
            projectile.life = 0;
            break;
          }
        }
      }
    }

    state.projectiles = state.projectiles.filter((projectile) => {
      return projectile.life > 0 && projectile.x > -50 && projectile.y > -50 && projectile.x < ARENA.width + 50 && projectile.y < ARENA.height + 50;
    });

    for (const shot of state.enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (distance(shot, state.player) <= shot.radius + state.player.radius) {
        shot.life = 0;
        takeDamage(shot.damage);
      }
    }

    state.enemyShots = state.enemyShots.filter((shot) => shot.life > 0);
  }

  function updatePickups(dt) {
    const pickupRange = 42 + (hasItem("pickupRange")?.value || 0);
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      const d = distance(pickup, state.player);
      if (d < pickupRange) {
        const dir = normalise(state.player.x - pickup.x, state.player.y - pickup.y);
        pickup.x += dir.x * 460 * dt;
        pickup.y += dir.y * 460 * dt;
      }
      if (d <= pickup.radius + state.player.radius) {
        pickup.life = 0;
        if (pickup.type === "heal") {
          state.player.health = Math.min(state.player.maxHealth, state.player.health + pickup.value);
          burst(pickup.x, pickup.y, "#22c55e", 12);
        }
      }
    }
    state.pickups = state.pickups.filter((pickup) => pickup.life > 0);
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateCamera() {
    const vw = viewWidth();
    const vh = viewHeight();
    state.camera.x = clamp(state.player.x - vw / 2, 0, ARENA.width - vw);
    state.camera.y = clamp(state.player.y - vh / 2, 0, ARENA.height - vh);
  }

  function updatePlaying(dt) {
    state.elapsed += dt;
    state.flash = Math.max(0, state.flash - dt);
    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0 && state.enemies.length < state.config.maxEnemies) {
      spawnEnemyAwayFromPlayer();
      state.spawnTimer = state.config.spawnInterval;
    }

    if (!state.bossSpawned && state.elapsed >= state.config.bossSpawnSeconds) {
      spawnBoss();
    }

    updatePlayer(dt);
    updateAbility(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateCamera();
  }

  function updateDying(dt) {
    state.deathTimer += dt;
    state.player.fall = Math.min(1, state.deathTimer / 1.15);
    updateParticles(dt);
    updateCamera();
    if (state.deathTimer > 1.25) {
      endGame();
    }
  }

  function update(dt) {
    if (state.screen === "playing") {
      updatePlaying(dt);
    } else if (state.screen === "dying") {
      updateDying(dt);
    } else {
      updateParticles(dt);
    }
  }

  function worldToScreen(entity) {
    return {
      x: entity.x - state.camera.x,
      y: entity.y - state.camera.y
    };
  }

  function renderGrid() {
    const vw = viewWidth();
    const vh = viewHeight();
    ctx.fillStyle = "#0b1018";
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);
    ctx.fillStyle = "#121925";
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.strokeStyle = "#223047";
    ctx.lineWidth = 1;

    const step = 100;
    const startX = Math.floor(state.camera.x / step) * step;
    const startY = Math.floor(state.camera.y / step) * step;
    for (let x = startX; x < state.camera.x + vw + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, state.camera.y - 20);
      ctx.lineTo(x, state.camera.y + vh + 20);
      ctx.stroke();
    }
    for (let y = startY; y < state.camera.y + vh + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(state.camera.x - 20, y);
      ctx.lineTo(state.camera.x + vw + 20, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, ARENA.width, ARENA.height);
    ctx.restore();
  }

  function drawHealthBar(entity, width) {
    const pos = worldToScreen(entity);
    const barWidth = width || entity.radius * 2.2;
    const pct = clamp(entity.health / entity.maxHealth, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(pos.x - barWidth / 2, pos.y - entity.radius - 16, barWidth, 5);
    ctx.fillStyle = pct > 0.45 ? "#22c55e" : "#ef4444";
    ctx.fillRect(pos.x - barWidth / 2, pos.y - entity.radius - 16, barWidth * pct, 5);
  }

  function drawEnemy(enemy) {
    const pos = worldToScreen(enemy);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(enemy.boss ? Math.sin(state.elapsed * 1.4) * 0.08 : 0);
    ctx.globalAlpha = enemy.freezeTimer > 0 ? 0.72 : 1;
    ctx.fillStyle = enemy.hitFlash ? "#ffffff" : enemy.type.colour;
    ctx.strokeStyle = enemy.freezeTimer > 0 ? "#bfdbfe" : enemy.type.accent;
    ctx.lineWidth = enemy.boss ? 5 : 3;

    if (enemy.type.shape === "square") {
      ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
      ctx.strokeRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    } else if (enemy.type.shape === "triangle") {
      pathPolygon(3, enemy.radius);
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type.shape === "diamond") {
      pathPolygon(4, enemy.radius, Math.PI / 4);
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type.shape === "hex") {
      pathPolygon(6, enemy.radius);
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type.shape === "star") {
      pathStar(enemy.radius, enemy.radius * 0.48, 7);
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type.shape === "fortress") {
      ctx.fillRect(-enemy.radius, -enemy.radius * 0.75, enemy.radius * 2, enemy.radius * 1.5);
      ctx.strokeRect(-enemy.radius, -enemy.radius * 0.75, enemy.radius * 2, enemy.radius * 1.5);
      ctx.fillStyle = enemy.type.accent;
      ctx.fillRect(-enemy.radius * 0.45, -enemy.radius * 1.1, enemy.radius * 0.9, enemy.radius * 0.45);
    } else if (enemy.type.shape === "eye") {
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.radius, enemy.radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = enemy.type.accent;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type.shape === "crowned") {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = enemy.type.accent;
      pathPolygon(3, enemy.radius * 0.52, -Math.PI / 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    drawHealthBar(enemy, enemy.boss ? 150 : undefined);
  }

  function pathPolygon(sides, radius, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const angle = rotation + (i / sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function pathStar(outer, inner, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPlayer() {
    const player = state.player || createPlayer();
    const stats = player.stats || selectedStats();
    const pos = worldToScreen(player);
    const fall = player.fall || 0;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(player.angle + fall * Math.PI * 0.5);
    ctx.scale(1 + fall * 0.25, 1 - fall * 0.55);
    ctx.shadowColor = stats.character.accent;
    ctx.shadowBlur = state.activeAbility?.id === "dash" ? 24 : 0;
    ctx.fillStyle = stats.character.colour;
    ctx.strokeStyle = stats.character.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = stats.weapon.colour;
    ctx.fillRect(4, -5, 28, 10);
    ctx.restore();

    if (state.activeAbility?.id === "force-field") {
      const radius = state.activeAbility.radius;
      const pulse = 0.88 + Math.sin(state.elapsed * 6) * 0.04;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.92)";
      ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawHealthBar(player, 72);
  }

  function renderProjectiles() {
    for (const projectile of state.projectiles) {
      const pos = worldToScreen(projectile);
      ctx.fillStyle = projectile.colour;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const shot of state.enemyShots) {
      const pos = worldToScreen(shot);
      ctx.fillStyle = shot.colour;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, shot.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderPickups() {
    for (const pickup of state.pickups) {
      const pos = worldToScreen(pickup);
      ctx.fillStyle = pickup.type === "heal" ? "#22c55e" : "#facc15";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (pickup.type === "heal") {
        ctx.fillStyle = "#052e16";
        ctx.fillRect(pos.x - 2, pos.y - 8, 4, 16);
        ctx.fillRect(pos.x - 8, pos.y - 2, 16, 4);
      }
    }
  }

  function renderParticles() {
    for (const particle of state.particles) {
      const pos = worldToScreen(particle);
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.colour;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    resizeCanvas();
    if (state.player) {
      updateCamera();
    }
    renderGrid();
    renderPickups();
    renderProjectiles();
    for (const enemy of state.enemies) {
      drawEnemy(enemy);
    }
    drawPlayer();
    renderParticles();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${state.flash * 0.8})`;
      ctx.fillRect(0, 0, viewWidth(), viewHeight());
    }

    renderHud();
  }

  function renderHud() {
    const player = state.player;
    const healthPct = player ? Math.round((player.health / player.maxHealth) * 100) : 100;
    const levelCap = state.level >= DATA.MAX_LEVEL ? "MAX" : state.level;
    refs.levelChip.textContent = `Level ${levelCap}`;
    refs.coinChip.textContent = `${state.coins} coins`;
    refs.healthChip.textContent = `Health ${healthPct}%`;
    refs.bossChip.textContent = state.boss
      ? `${state.boss.type.name} ${Math.max(0, Math.round((state.boss.health / state.boss.maxHealth) * 100))}%`
      : state.bossSpawned
        ? "Boss defeated"
        : `Boss ${Math.max(0, Math.ceil(state.config.bossSpawnSeconds - state.elapsed))}s`;

    refs.healthMeter.value = healthPct;

    const liveStats = player?.stats || selectedStats();
    const ability = liveStats.character.ability;
    const cooldownItem = hasItem("cooldownMultiplier");
    const cooldownLength = ability.cooldown * (cooldownItem ? cooldownItem.value : 1);
    let charge = 100;
    let text = `${ability.name} ready`;
    if (state.activeAbility) {
      charge = (state.activeAbility.time / state.activeAbility.maxTime) * 100;
      text = `${ability.name} active`;
    } else if (state.abilityCooldown > 0) {
      charge = 100 - (state.abilityCooldown / cooldownLength) * 100;
      text = `${ability.name} ${Math.ceil(state.abilityCooldown)}s`;
    }
    refs.chargeMeter.value = clamp(charge, 0, 100);
    refs.abilityFill.style.transform = `scaleX(${clamp(charge, 0, 100) / 100})`;
    refs.abilityText.textContent = text;
  }

  function renderShopList(container, entries, ownedSet, selectedId, onEquip, typeName) {
    container.replaceChildren();
    const lockedByArena = state.screen === "playing" || state.screen === "dying";
    for (const entry of entries) {
      const owned = ownedSet.has(entry.id);
      const selected = selectedId === entry.id;
      const affordable = state.coins >= entry.cost;
      const card = document.createElement("div");
      card.className = "shop-card";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = entry.colour;

      const copy = document.createElement("span");
      copy.className = "shop-copy";
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const meta = document.createElement("span");
      meta.textContent = owned ? typeSummary(entry, typeName) : `${entry.cost} coins`;
      copy.append(name, meta);

      const action = document.createElement("button");
      action.type = "button";
      if (selected) {
        action.textContent = "Equipped";
        action.className = "equipped";
      } else if (owned) {
        action.textContent = "Equip";
        action.disabled = lockedByArena;
        action.onclick = () => {
          onEquip(entry.id);
          renderShops();
        };
      } else {
        action.textContent = "Buy";
        action.className = affordable && !lockedByArena ? "" : "locked";
        action.disabled = !affordable || lockedByArena;
        action.onclick = () => {
          state.coins -= entry.cost;
          ownedSet.add(entry.id);
          onEquip(entry.id);
          renderShops();
        };
      }

      card.append(swatch, copy, action);
      container.append(card);
    }
  }

  function renderItemShop() {
    refs.itemShop.replaceChildren();
    const lockedByArena = state.screen === "playing" || state.screen === "dying";
    for (const item of DATA.items) {
      const owned = state.owned.items.has(item.id);
      const affordable = state.coins >= item.cost;
      const card = document.createElement("div");
      card.className = "shop-card";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = item.colour;

      const copy = document.createElement("span");
      copy.className = "shop-copy";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const meta = document.createElement("span");
      meta.textContent = owned ? itemSummary(item) : `${item.cost} coins`;
      copy.append(name, meta);

      const action = document.createElement("button");
      action.type = "button";
      action.textContent = owned ? "Owned" : "Buy";
      action.disabled = owned || !affordable || lockedByArena;
      action.className = owned ? "equipped" : affordable && !lockedByArena ? "" : "locked";
      action.onclick = () => {
        state.coins -= item.cost;
        state.owned.items.add(item.id);
        renderShops();
      };

      card.append(swatch, copy, action);
      refs.itemShop.append(card);
    }
  }

  function typeSummary(entry, typeName) {
    if (typeName === "character") {
      return `${entry.role}, ${entry.maxHealth} HP`;
    }
    if (typeName === "weapon") {
      return `${entry.damage} damage, ${entry.range} range`;
    }
    return `+${entry.healthBonus} HP, ${Math.round(entry.damageReduction * 100)}% guard`;
  }

  function itemSummary(item) {
    if (item.effect === "pickupRange") return "Wider pickup pull";
    if (item.effect === "coinBonus") return "+1 coin per baddie";
    if (item.effect === "cooldownMultiplier") return "Faster abilities";
    return "Stronger healing";
  }

  function renderShops() {
    renderShopList(refs.characterShop, DATA.characters, state.owned.characters, state.selectedCharacter, (id) => {
      state.selectedCharacter = id;
    }, "character");
    renderShopList(refs.weaponShop, DATA.weapons, state.owned.weapons, state.selectedWeapon, (id) => {
      state.selectedWeapon = id;
    }, "weapon");
    renderShopList(refs.armourShop, DATA.armour, state.owned.armour, state.selectedArmour, (id) => {
      state.selectedArmour = id;
    }, "armour");
    renderItemShop();

    const character = byId(DATA.characters, state.selectedCharacter);
    refs.selectedCharacterName.textContent = character.name;
    refs.selectedCharacterMeta.textContent = `${character.role} - ${character.ability.name}`;
    renderHud();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  global.addEventListener("keydown", (event) => {
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === "e") {
      activateAbility();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }
  });

  global.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  global.addEventListener("resize", resizeCanvas);
  refs.primaryAction.onclick = startLevel;
  refs.secondaryAction.onclick = showMenu;

  resizeCanvas();
  state.player = createPlayer();
  updateCamera();
  renderShops();
  showMenu();
  requestAnimationFrame(loop);

  global.BlasterGame = {
    state,
    startLevel,
    clearLevel,
    selectedStats,
    activateAbility
  };
})(window);
