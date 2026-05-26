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
    shopBalance: document.getElementById("shopBalance"),
    shopStartAction: document.getElementById("shopStartAction"),
    characterShop: document.getElementById("characterShop"),
    weaponShop: document.getElementById("weaponShop"),
    armourShop: document.getElementById("armourShop"),
    itemShop: document.getElementById("itemShop")
  };

  const ARENA = { width: 2800, height: 1900 };
  const TERRAIN_TILE_SIZE = 1024;
  const TERRAIN_PIXEL = 4;
  const keys = new Set();
  let lastTime = performance.now();
  let canvasScale = 1;
  const terrainPatternCache = new Map();

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

  function shadeColour(hex, amount) {
    const clean = hex.replace("#", "");
    const number = parseInt(clean, 16);
    const red = clamp((number >> 16) + amount, 0, 255);
    const green = clamp(((number >> 8) & 255) + amount, 0, 255);
    const blue = clamp((number & 255) + amount, 0, 255);
    return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
  }

  function createCreatureVariant(type, scale, boss) {
    const markings = boss
      ? ["crown-spots", "glow-ridges", "war-paint", "moon-mask"]
      : ["spots", "stripes", "mask", "tail-tip", "crest"];

    return {
      colour: shadeColour(type.colour, Math.round(rand(-26, 26))),
      accent: shadeColour(type.accent || "#ffffff", Math.round(rand(-18, 18))),
      marking: markings[Math.floor(rand(0, markings.length))],
      scaleX: clamp(rand(0.88, 1.16) * Math.sqrt(scale || 1), 0.75, 1.32),
      scaleY: clamp(rand(0.9, 1.12) * Math.sqrt(scale || 1), 0.75, 1.28),
      detail: rand(0, Math.PI * 2),
      spotCount: Math.floor(rand(2, 6))
    };
  }

  function creatureColour(enemy) {
    return enemy.variant?.colour || enemy.type.colour;
  }

  function creatureAccent(enemy) {
    return enemy.variant?.accent || enemy.type.accent;
  }

  function itemBonus(effect) {
    return DATA.items.reduce((total, item) => {
      return item.effect === effect && state.owned.items.has(item.id) ? total + item.value : total;
    }, 0);
  }

  function itemMultiplier(effect) {
    return DATA.items.reduce((total, item) => {
      return item.effect === effect && state.owned.items.has(item.id) ? total * item.value : total;
    }, 1);
  }

  function selectedStats() {
    const character = byId(DATA.characters, state.selectedCharacter);
    const baseWeapon = byId(DATA.weapons, state.selectedWeapon);
    const armour = byId(DATA.armour, state.selectedArmour);
    const weapon = {
      ...baseWeapon,
      range: Math.round(baseWeapon.range * itemMultiplier("rangeMultiplier")),
      projectileSpeed: baseWeapon.projectileSpeed
        ? Math.round(baseWeapon.projectileSpeed * itemMultiplier("projectileSpeedMultiplier"))
        : baseWeapon.projectileSpeed
    };

    return {
      character,
      weapon,
      armour,
      maxHealth: character.maxHealth + armour.healthBonus,
      speed: character.speed + itemBonus("speedBonus"),
      damage: Math.max(1, weapon.damage + character.damageBonus + itemBonus("damageBonus")),
      cooldown: weapon.cooldown * itemMultiplier("cooldownMultiplier"),
      damageReduction: clamp(armour.damageReduction + itemBonus("damageReductionBonus"), 0, 0.7)
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
      facing: "down",
      moving: false,
      walkTime: 0,
      attackTime: 0,
      castTime: 0,
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
    scatterMoneyPickups();
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

  function refreshPreviewLoadout() {
    if (state.screen === "playing" || state.screen === "dying") {
      return;
    }
    state.player = createPlayer();
    updateCamera();
  }

  function showMenu() {
    resetArenaPreview();
    state.screen = "menu";
    showOverlay(
      "Blaster",
      "Arena ready.",
      { label: "Start", action: startLevel },
      { label: "Shop", action: openShop }
    );
    renderShops();
  }

  function openShop() {
    resetArenaPreview();
    state.screen = "shop";
    refs.overlay.classList.add("hidden");
    renderShops();
  }

  function endGame() {
    state.screen = "gameover";
    showOverlay(
      "GAME OVER!",
      "Your character hit the ground before the boss went down.",
      { label: "Retry", action: startLevel },
      { label: "Shop", action: openShop }
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
      {
        label: "Shop",
        action: () => {
          if (state.level < DATA.MAX_LEVEL) {
            state.level += 1;
          }
          openShop();
        }
      }
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
      variant: createCreatureVariant(type, enemyScale, false),
      facing: "down",
      moving: false,
      walkTime: rand(0, 1),
      attackTime: 0,
      castTime: 0,
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
      speed: bossType.speed * config.bossSpeedMultiplier,
      touchDamage: bossType.touchDamage * config.bossDamageMultiplier,
      shootTimer: 1.1,
      freezeTimer: 0,
      variant: createCreatureVariant(bossType, 1, true),
      facing: "down",
      moving: false,
      walkTime: rand(0, 1),
      attackTime: 0,
      castTime: 0,
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
      value: type === "heal" ? 34 + itemBonus("healBonus") : 1,
      life: 18
    });
  }

  function spawnMoneyPickup(x, y, moneyType) {
    state.pickups.push({
      x,
      y,
      type: "money",
      moneyType,
      radius: moneyType.radius,
      value: moneyType.value,
      life: Infinity
    });
  }

  function chooseMoneyPickupType() {
    const roll = Math.random();
    const types = DATA.moneyPickups;
    if (roll < 0.46) return types[0];
    if (roll < 0.76) return types[1];
    if (roll < 0.94) return types[2];
    return types[3];
  }

  function randomArenaPoint(minDistanceFromPlayer) {
    let point = { x: ARENA.width / 2, y: ARENA.height / 2 };
    for (let i = 0; i < 30; i += 1) {
      point = {
        x: rand(90, ARENA.width - 90),
        y: rand(90, ARENA.height - 90)
      };
      if (!state.player || Math.hypot(point.x - state.player.x, point.y - state.player.y) >= minDistanceFromPlayer) {
        return point;
      }
    }
    return point;
  }

  function scatterMoneyPickups() {
    const count = 12 + Math.min(10, Math.floor(state.level / 35));
    for (let i = 0; i < count; i += 1) {
      const moneyType = i < DATA.moneyPickups.length ? DATA.moneyPickups[i] : chooseMoneyPickupType();
      const point = randomArenaPoint(i < DATA.moneyPickups.length ? 180 : 260);
      spawnMoneyPickup(point.x, point.y, moneyType);
    }
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
    const bossMultiplier = enemy.boss ? itemMultiplier("bossDamageMultiplier") : 1;
    enemy.health -= amount * bossMultiplier * (1 - armourReduction);
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
    const coinBonus = itemBonus("coinBonus");
    state.coins += DATA.ENEMY_COIN_REWARD + coinBonus;
    if (state.player && itemBonus("healOnKill") > 0) {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + itemBonus("healOnKill"));
    }

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

  function facingFromVector(x, y) {
    if (Math.abs(x) > Math.abs(y)) {
      return x < 0 ? "left" : "right";
    }
    if (y < 0) {
      return "up";
    }
    return "down";
  }

  function playerAttack() {
    const weapon = state.player.stats.weapon;
    const target = nearestEnemy(weapon.range);
    if (!target) {
      return;
    }

    const baseAngle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    state.player.angle = baseAngle;
    state.player.facing = facingFromVector(Math.cos(baseAngle), Math.sin(baseAngle));
    state.player.attackTime = weapon.melee ? 0.26 : 0.18;

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
    const cooldown = ability.cooldown * itemMultiplier("cooldownMultiplier");
    state.abilityCooldown = cooldown;
    state.player.castTime = 0.5;

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
    player.attackTime = Math.max(0, player.attackTime - dt);
    player.castTime = Math.max(0, player.castTime - dt);

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
      player.facing = facingFromVector(dir.x, dir.y);
      player.moving = true;
      player.walkTime += dt * (dash > 1 ? 1.8 : 1);
    } else {
      player.moving = false;
      player.walkTime = 0;
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
      enemy.attackTime = Math.max(0, (enemy.attackTime || 0) - dt);
      enemy.castTime = Math.max(0, (enemy.castTime || 0) - dt);

      if (enemy.freezeTimer > 0) {
        enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
        enemy.moving = false;
      } else {
        const dir = normalise(player.x - enemy.x, player.y - enemy.y);
        const desiredDistance = enemy.type.shoots && !enemy.boss ? 280 : 0;
        const currentDistance = distance(player, enemy);
        const moveSign = currentDistance < desiredDistance ? -0.42 : 1;
        const previousX = enemy.x;
        const previousY = enemy.y;
        enemy.facing = facingFromVector(dir.x, dir.y);
        enemy.x = clamp(enemy.x + dir.x * enemy.speed * moveSign * dt, enemy.radius, ARENA.width - enemy.radius);
        enemy.y = clamp(enemy.y + dir.y * enemy.speed * moveSign * dt, enemy.radius, ARENA.height - enemy.radius);
        enemy.moving = Math.hypot(enemy.x - previousX, enemy.y - previousY) > 0.05;
        if (enemy.moving) {
          enemy.walkTime = (enemy.walkTime || 0) + dt * (enemy.boss ? 0.72 : 1.05);
        }
      }

      if (distance(player, enemy) < player.radius + enemy.radius) {
        enemy.attackTime = Math.max(enemy.attackTime || 0, enemy.boss ? 0.32 : 0.2);
        takeDamage(enemy.touchDamage * dt);
      }

      if (enemy.type.shoots || enemy.boss) {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && enemy.freezeTimer <= 0) {
          shootAtPlayer(enemy);
          enemy.shootTimer = enemy.boss ? state.config.bossShotCooldown : enemy.type.shootCooldown;
        }
      }
    }
  }

  function shootAtPlayer(enemy) {
    const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
    enemy.facing = facingFromVector(Math.cos(angle), Math.sin(angle));
    enemy.castTime = enemy.type.shoots || !enemy.type.spriteWeapon?.melee ? 0.36 : 0;
    enemy.attackTime = enemy.type.spriteWeapon?.melee ? 0.24 : enemy.attackTime || 0;
    const shots = enemy.boss ? state.config.bossShotCount : 1;
    for (let i = 0; i < shots; i += 1) {
      const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * 0.18;
      const shotAngle = angle + offset;
      state.enemyShots.push({
        x: enemy.x + Math.cos(shotAngle) * enemy.radius,
        y: enemy.y + Math.sin(shotAngle) * enemy.radius,
        vx: Math.cos(shotAngle) * (enemy.boss ? 300 * state.config.bossBulletSpeedMultiplier : 250),
        vy: Math.sin(shotAngle) * (enemy.boss ? 300 * state.config.bossBulletSpeedMultiplier : 250),
        radius: enemy.boss ? 8 : 6,
        damage: enemy.boss ? 18 * state.config.bossDamageMultiplier : 10 * state.config.enemyDamageMultiplier,
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
    const pickupRange = 42 + itemBonus("pickupRange");
    for (const pickup of state.pickups) {
      if (Number.isFinite(pickup.life)) {
        pickup.life -= dt;
      }
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
        } else if (pickup.type === "money") {
          state.coins += pickup.value;
          burst(pickup.x, pickup.y, pickup.moneyType.colour, pickup.value >= 25 ? 22 : 12);
          renderShops();
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

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let next = value;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }

  function terrainChoice(rng, entries) {
    return entries[Math.floor(rng() * entries.length)];
  }

  function terrainCount(base, size) {
    return Math.round(base * (size / 512) * (size / 512));
  }

  function terrainBlock(tileCtx, x, y, width, height, colour) {
    tileCtx.fillStyle = colour;
    tileCtx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function terrainCluster(tileCtx, rng, x, y, radius, count, colours) {
    for (let i = 0; i < count; i += 1) {
      const px = x + Math.round((rng() - 0.5) * radius / TERRAIN_PIXEL) * TERRAIN_PIXEL;
      const py = y + Math.round((rng() - 0.5) * radius / TERRAIN_PIXEL) * TERRAIN_PIXEL;
      const size = terrainChoice(rng, [TERRAIN_PIXEL, TERRAIN_PIXEL, TERRAIN_PIXEL * 2]);
      terrainBlock(tileCtx, px, py, size, size, terrainChoice(rng, colours));
    }
  }

  function drawPixelPebble(tileCtx, rng, theme, x, y, scale = 1) {
    const unit = TERRAIN_PIXEL * scale;
    terrainBlock(tileCtx, x, y + unit, unit * 4, unit * 2, theme.shadow);
    terrainBlock(tileCtx, x + unit, y, unit * 3, unit * 2, theme.stone);
    terrainBlock(tileCtx, x + unit * 2, y, unit, unit, shadeColour(theme.stone, 28));
    terrainBlock(tileCtx, x + unit, y + unit * 2, unit * 3, unit, shadeColour(theme.stone, -22));
  }

  function drawPixelCrack(tileCtx, rng, theme, x, y, length, glow) {
    let px = x;
    let py = y;
    for (let i = 0; i < length; i += 1) {
      const colour = glow && i % 3 === 0 ? theme.glow : theme.dark;
      terrainBlock(tileCtx, px, py, TERRAIN_PIXEL * 2, TERRAIN_PIXEL, colour);
      px += terrainChoice(rng, [-TERRAIN_PIXEL, TERRAIN_PIXEL, TERRAIN_PIXEL * 2]);
      py += TERRAIN_PIXEL;
    }
  }

  function drawPixelGrass(tileCtx, rng, theme, x, y, tall = false) {
    const height = tall ? TERRAIN_PIXEL * 4 : TERRAIN_PIXEL * 3;
    const blade = theme.feature === "desert" ? theme.accent : theme.light;
    terrainBlock(tileCtx, x, y + TERRAIN_PIXEL, TERRAIN_PIXEL, height, theme.dark);
    terrainBlock(tileCtx, x + TERRAIN_PIXEL, y, TERRAIN_PIXEL, height + TERRAIN_PIXEL, blade);
    terrainBlock(tileCtx, x + TERRAIN_PIXEL * 2, y + TERRAIN_PIXEL, TERRAIN_PIXEL, height, theme.shadow);
    if (rng() > 0.55) {
      terrainBlock(tileCtx, x - TERRAIN_PIXEL, y + TERRAIN_PIXEL * 2, TERRAIN_PIXEL, height - TERRAIN_PIXEL, shadeColour(blade, -18));
    }
  }

  function drawPixelFlower(tileCtx, rng, theme, x, y) {
    const petal = terrainChoice(rng, [theme.accent, theme.glow, "#fef08a", "#f8fafc"]);
    terrainBlock(tileCtx, x, y, TERRAIN_PIXEL, TERRAIN_PIXEL, petal);
    terrainBlock(tileCtx, x + TERRAIN_PIXEL, y + TERRAIN_PIXEL, TERRAIN_PIXEL, TERRAIN_PIXEL, "#fef3c7");
    terrainBlock(tileCtx, x - TERRAIN_PIXEL, y + TERRAIN_PIXEL, TERRAIN_PIXEL, TERRAIN_PIXEL, petal);
    terrainBlock(tileCtx, x, y + TERRAIN_PIXEL * 2, TERRAIN_PIXEL, TERRAIN_PIXEL, theme.dark);
  }

  function drawPixelCrystal(tileCtx, rng, theme, x, y, large = false) {
    const unit = TERRAIN_PIXEL;
    const height = large ? 10 : 6;
    const glow = rng() > 0.45 ? theme.glow : theme.accent;
    terrainBlock(tileCtx, x - unit * 4, y + unit * 5, unit * 10, unit * 3, theme.shadow);
    terrainBlock(tileCtx, x - unit * 2, y + unit * 2, unit * 3, unit * height, glow);
    terrainBlock(tileCtx, x - unit, y, unit, unit * 2, shadeColour(glow, 40));
    terrainBlock(tileCtx, x + unit, y + unit * 3, unit * 3, unit * (height - 2), theme.accent);
    terrainBlock(tileCtx, x + unit * 2, y + unit, unit, unit * 2, shadeColour(theme.accent, 34));
    terrainBlock(tileCtx, x - unit * 4, y + unit * 4, unit * 2, unit * 4, shadeColour(glow, -28));
    terrainBlock(tileCtx, x - unit * 3, y + unit * 3, unit, unit, shadeColour(glow, 38));
  }

  function drawTerrainTexture(tileCtx, rng, theme, size) {
    tileCtx.fillStyle = theme.base;
    tileCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < terrainCount(1550, size); i += 1) {
      const pixel = terrainChoice(rng, [2, 2, TERRAIN_PIXEL]);
      const x = Math.floor(rng() * size / pixel) * pixel;
      const y = Math.floor(rng() * size / pixel) * pixel;
      const colour = terrainChoice(rng, [theme.base, theme.mid, theme.shadow, theme.light, theme.earth]);
      terrainBlock(tileCtx, x, y, pixel, pixel, colour);
    }

    for (let i = 0; i < terrainCount(18, size); i += 1) {
      terrainCluster(
        tileCtx,
        rng,
        rng() * size,
        rng() * size,
        56 + rng() * 62,
        22,
        [theme.mid, theme.earth, shadeColour(theme.earth, -18), theme.shadow]
      );
    }
  }

  function drawTerrainFeatures(tileCtx, rng, theme, size) {
    if (theme.feature === "desert") {
      for (let i = 0; i < terrainCount(24, size); i += 1) drawPixelPebble(tileCtx, rng, theme, rng() * size, rng() * size, terrainChoice(rng, [0.7, 1, 1.35]));
      for (let i = 0; i < terrainCount(10, size); i += 1) drawPixelCrack(tileCtx, rng, theme, rng() * size, rng() * size, 8 + Math.floor(rng() * 10), false);
      for (let i = 0; i < terrainCount(10, size); i += 1) drawPixelGrass(tileCtx, rng, theme, rng() * size, rng() * size, rng() > 0.6);
      return;
    }

    if (theme.feature === "crystal") {
      for (let i = 0; i < terrainCount(22, size); i += 1) drawPixelPebble(tileCtx, rng, theme, rng() * size, rng() * size, terrainChoice(rng, [1, 1.4, 2]));
      for (let i = 0; i < terrainCount(10, size); i += 1) drawPixelCrystal(tileCtx, rng, theme, rng() * size, rng() * size, rng() > 0.45);
      for (let i = 0; i < terrainCount(8, size); i += 1) drawPixelCrack(tileCtx, rng, theme, rng() * size, rng() * size, 6 + Math.floor(rng() * 9), true);
      return;
    }

    if (theme.feature === "forest") {
      for (let i = 0; i < terrainCount(55, size); i += 1) drawPixelGrass(tileCtx, rng, theme, rng() * size, rng() * size, rng() > 0.55);
      for (let i = 0; i < terrainCount(16, size); i += 1) drawPixelPebble(tileCtx, rng, theme, rng() * size, rng() * size, terrainChoice(rng, [0.8, 1.2]));
      for (let i = 0; i < terrainCount(18, size); i += 1) drawPixelFlower(tileCtx, rng, theme, rng() * size, rng() * size);
      return;
    }

    for (let i = 0; i < terrainCount(55, size); i += 1) drawPixelGrass(tileCtx, rng, theme, rng() * size, rng() * size, rng() > 0.68);
    for (let i = 0; i < terrainCount(14, size); i += 1) drawPixelPebble(tileCtx, rng, theme, rng() * size, rng() * size, terrainChoice(rng, [0.65, 0.9, 1.15]));
    for (let i = 0; i < terrainCount(26, size); i += 1) drawPixelFlower(tileCtx, rng, theme, rng() * size, rng() * size);
  }

  function terrainPattern(theme) {
    if (terrainPatternCache.has(theme.id)) {
      return terrainPatternCache.get(theme.id);
    }

    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = TERRAIN_TILE_SIZE;
    tileCanvas.height = TERRAIN_TILE_SIZE;
    const tileCtx = tileCanvas.getContext("2d");
    tileCtx.imageSmoothingEnabled = false;
    const rng = seededRandom(hashString(theme.id));
    drawTerrainTexture(tileCtx, rng, theme, TERRAIN_TILE_SIZE);
    drawTerrainFeatures(tileCtx, rng, theme, TERRAIN_TILE_SIZE);

    const pattern = ctx.createPattern(tileCanvas, "repeat");
    const cacheEntry = { pattern, tileCanvas };
    terrainPatternCache.set(theme.id, cacheEntry);
    return cacheEntry;
  }

  function renderGrid() {
    const vw = viewWidth();
    const vh = viewHeight();
    const theme = DATA.terrainForLevel(state.level);
    const terrain = terrainPattern(theme);

    ctx.fillStyle = theme.dark;
    ctx.fillRect(0, 0, vw, vh);

    if (terrain.pattern) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(-(state.camera.x % TERRAIN_TILE_SIZE), -(state.camera.y % TERRAIN_TILE_SIZE));
      ctx.fillStyle = terrain.pattern;
      ctx.fillRect(0, 0, vw + TERRAIN_TILE_SIZE, vh + TERRAIN_TILE_SIZE);
      ctx.restore();
    }

    const vignette = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.2, vw / 2, vh / 2, Math.max(vw, vh) * 0.76);
    vignette.addColorStop(0, "rgba(255, 255, 255, 0.03)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.14)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);
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

  function enemySpriteStats(enemy) {
    const visual = enemy.type.visual || {
      hair: shadeColour(enemy.type.colour, -42),
      skin: "#d6a06f",
      tunic: enemy.type.colour,
      trim: enemy.type.accent || "#f8fafc",
      cape: shadeColour(enemy.type.colour, -34),
      metal: "#71717a",
      boots: "#1f1a17",
      scarf: shadeColour(enemy.type.colour, -22),
      hairStyle: "messy",
      outfit: "raider"
    };

    return {
      character: {
        ...enemy.type,
        visual,
        colour: creatureColour(enemy),
        accent: creatureAccent(enemy)
      },
      weapon: enemy.type.spriteWeapon || {
        id: enemy.type.shoots || enemy.boss ? "enemy-staff" : "enemy-claws",
        colour: enemy.type.accent || "#e5e7eb",
        melee: !enemy.type.shoots && !enemy.boss
      }
    };
  }

  function drawEnemySprite(enemy) {
    const frame = Math.sin((enemy.walkTime || 0) * 13);
    const scale = enemy.boss
      ? clamp(enemy.radius / 34, 1.45, 2.15)
      : clamp(enemy.radius / 22, 0.72, 1.16);

    ctx.save();
    ctx.scale(scale, scale);
    drawPixelAdventurer(enemySpriteStats(enemy), {
      attacking: (enemy.attackTime || 0) > 0,
      casting: (enemy.castTime || 0) > 0,
      facing: enemy.facing || "down",
      frame,
      moving: Boolean(enemy.moving)
    });
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const pos = worldToScreen(enemy);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(enemy.boss ? Math.sin(state.elapsed * 1.4) * 0.08 : 0);
    ctx.globalAlpha = enemy.freezeTimer > 0 ? 0.72 : 1;
    ctx.filter = enemy.hitFlash ? "brightness(1.85)" : "none";
    ctx.shadowColor = enemy.boss ? creatureAccent(enemy) : "transparent";
    ctx.shadowBlur = enemy.boss ? 18 : 0;
    drawEnemySprite(enemy);
    ctx.filter = "none";
    ctx.restore();
    drawHealthBar(enemy, enemy.boss ? 150 : undefined);
  }

  function drawPixelBlock(unit, x, y, width, height, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x * unit, y * unit, width * unit, height * unit);
  }

  function drawPixelEye(unit, x, y) {
    drawPixelBlock(unit, x, y, 1, 1, "#ffffff");
    drawPixelBlock(unit, x, y, 0.55, 0.55, "#020617");
  }

  function drawOutlinedPixelBlock(unit, x, y, width, height, colour) {
    drawPixelBlock(unit, x - 0.18, y - 0.18, width + 0.36, height + 0.36, "#020617");
    drawPixelBlock(unit, x, y, width, height, colour);
  }

  function characterVisual(character) {
    return character.visual || {
      hair: "#7c4a22",
      skin: "#f0c7a5",
      tunic: character.colour,
      trim: character.accent,
      cape: shadeColour(character.colour, -40),
      metal: "#cbd5e1",
      boots: "#6b3f1d",
      scarf: shadeColour(character.colour, -20),
      hairStyle: "messy",
      outfit: "knight"
    };
  }

  function drawPixelAdventurer(stats, animation) {
    const unit = 2.7;
    const facing = animation.facing || "down";
    const sideFacing = facing === "left" || facing === "right";
    if (animation.fallen) {
      drawFallenAdventurer(unit, stats, facing);
      return;
    }

    ctx.save();
    if (facing === "left") {
      ctx.scale(-1, 1);
    }

    if (sideFacing) {
      drawSideAdventurer(unit, stats, animation);
    } else if (facing === "up") {
      drawBackAdventurer(unit, stats, animation);
    } else {
      drawFrontAdventurer(unit, stats, animation);
    }
    ctx.restore();
  }

  function drawFrontAdventurer(unit, stats, animation) {
    const visual = characterVisual(stats.character);
    const trim = visual.trim || stats.character.accent;
    const cape = visual.cape || shadeColour(stats.character.colour, -40);
    const metal = visual.metal || "#cbd5e1";
    const step = animation.moving ? animation.frame : 0;
    const leftStep = step > 0 ? 1 : 0;
    const rightStep = step < 0 ? 1 : 0;
    const casting = animation.casting;
    const attacking = animation.attacking;

    drawOutlinedPixelBlock(unit, -6, -1, 12, 12, cape);
    drawPixelBlock(unit, -4, 8, 8, 2, shadeColour(cape, -22));

    drawOutlinedPixelBlock(unit, -4, 6 + leftStep, 3, 5, shadeColour(visual.tunic, -18));
    drawOutlinedPixelBlock(unit, 1, 6 + rightStep, 3, 5, shadeColour(visual.tunic, -18));
    drawOutlinedPixelBlock(unit, -4, 10 + leftStep, 3, 2, visual.boots);
    drawOutlinedPixelBlock(unit, 1, 10 + rightStep, 3, 2, visual.boots);

    drawOutlinedPixelBlock(unit, -6, -3, 12, 10, visual.tunic);
    drawOutlinedPixelBlock(unit, -4, -2, 8, 8, shadeColour(visual.tunic, 12));
    drawPixelBlock(unit, -5, -3, 10, 1, trim);
    drawPixelBlock(unit, -5, 5.7, 10, 1, trim);
    drawPixelBlock(unit, -0.5, -2.5, 1, 8, trim);
    drawPixelBlock(unit, -2, 2, 4, 1.6, "#111827");
    drawPixelBlock(unit, -0.6, 2.2, 1.2, 1.2, trim);

    if (visual.outfit === "mage") {
      drawOutlinedPixelBlock(unit, -6, -4, 12, 12, visual.tunic);
      drawPixelBlock(unit, -5, -3.2, 10, 0.8, trim);
      drawPixelBlock(unit, -4, 7, 8, 0.8, trim);
    }

    drawArm(unit, -8, attacking ? -3 : casting ? -2 : 0, visual, trim, attacking || casting);
    drawArm(unit, 6, attacking ? -3 : casting ? -2 : 0, visual, trim, attacking || casting);
    drawShoulders(unit, visual, metal, trim);

    drawHead(unit, visual, "front");
    drawHair(unit, visual, "front");

    if (casting) {
      drawMagicSpark(unit, 8.8, -5.2, trim);
      drawMagicSpark(unit, -8.8, -5.2, trim);
    } else {
      drawSpriteWeapon(unit, stats.weapon, trim, attacking ? "attack" : "idle", "front");
    }
  }

  function drawBackAdventurer(unit, stats, animation) {
    const visual = characterVisual(stats.character);
    const trim = visual.trim || stats.character.accent;
    const cape = visual.cape || shadeColour(stats.character.colour, -40);
    const metal = visual.metal || "#cbd5e1";
    const step = animation.moving ? animation.frame : 0;

    drawOutlinedPixelBlock(unit, -6, -2, 12, 15, cape);
    drawPixelBlock(unit, -1, 2, 2, 5, trim);
    drawPixelBlock(unit, -2, 6, 4, 1, trim);
    drawOutlinedPixelBlock(unit, -4, 9 + (step > 0 ? 1 : 0), 3, 3, visual.boots);
    drawOutlinedPixelBlock(unit, 1, 9 + (step < 0 ? 1 : 0), 3, 3, visual.boots);
    drawShoulders(unit, visual, metal, trim);
    drawArm(unit, -8, 0, visual, trim, false);
    drawArm(unit, 6, 0, visual, trim, false);
    drawOutlinedPixelBlock(unit, -4, -10, 8, 8, visual.hair);

    if (visual.hairStyle === "hood") {
      drawOutlinedPixelBlock(unit, -5, -11, 10, 10, cape);
      drawPixelBlock(unit, -3, -9, 6, 6, shadeColour(cape, -12));
    } else if (visual.hairStyle === "long") {
      drawOutlinedPixelBlock(unit, -5, -10, 10, 12, visual.hair);
      drawPixelBlock(unit, -3, -8.5, 6, 1, shadeColour(visual.hair, 18));
      drawPixelBlock(unit, -4, 0, 8, 1, shadeColour(visual.hair, -18));
    } else {
      drawHair(unit, visual, "back");
    }
  }

  function drawSideAdventurer(unit, stats, animation) {
    const visual = characterVisual(stats.character);
    const trim = visual.trim || stats.character.accent;
    const cape = visual.cape || shadeColour(stats.character.colour, -40);
    const metal = visual.metal || "#cbd5e1";
    const step = animation.moving ? animation.frame : 0;
    const casting = animation.casting;
    const attacking = animation.attacking;

    drawOutlinedPixelBlock(unit, -7, -1, 6, 12, cape);
    drawPixelBlock(unit, -8, 2, 3, 4, shadeColour(cape, -22));

    drawOutlinedPixelBlock(unit, -3, 6 + (step > 0 ? 1 : 0), 3, 5, shadeColour(visual.tunic, -18));
    drawOutlinedPixelBlock(unit, 1, 6 + (step < 0 ? 1 : 0), 3, 5, shadeColour(visual.tunic, -18));
    drawOutlinedPixelBlock(unit, -4, 10 + (step > 0 ? 1 : 0), 3, 2, visual.boots);
    drawOutlinedPixelBlock(unit, 1, 10 + (step < 0 ? 1 : 0), 3, 2, visual.boots);

    drawOutlinedPixelBlock(unit, -4, -3, 9, 10, visual.tunic);
    drawPixelBlock(unit, -3, -2.2, 7, 1, trim);
    drawPixelBlock(unit, -3, 5.6, 7, 1, trim);
    drawPixelBlock(unit, 0, 2, 3, 1.6, "#111827");
    drawPixelBlock(unit, 1, 2.2, 1, 1.2, trim);
    drawOutlinedPixelBlock(unit, -5, -6, 3, 3, metal);
    drawOutlinedPixelBlock(unit, 1, -6, 3, 3, metal);

    if (visual.hairStyle === "long") {
      drawOutlinedPixelBlock(unit, -1, -9, 7, 12, shadeColour(visual.hair, -12));
    }

    drawHead(unit, visual, "side");
    drawHair(unit, visual, "side");

    drawArm(unit, attacking ? 4 : casting ? 3 : 2, attacking ? -3 : 0, visual, trim, attacking || casting);
    if (casting) {
      drawMagicSpark(unit, 9, -4, trim);
    } else {
      drawSpriteWeapon(unit, stats.weapon, trim, attacking ? "attack" : "idle", "side");
    }
  }

  function drawFallenAdventurer(unit, stats, facing) {
    const visual = characterVisual(stats.character);
    const trim = visual.trim || stats.character.accent;
    const cape = visual.cape || shadeColour(stats.character.colour, -40);

    ctx.save();
    if (facing === "left") {
      ctx.scale(-1, 1);
    }
    drawOutlinedPixelBlock(unit, -9, 3, 15, 5, cape);
    drawOutlinedPixelBlock(unit, -7, 0, 10, 5, visual.tunic);
    drawPixelBlock(unit, -6, 1, 8, 1, trim);
    drawOutlinedPixelBlock(unit, 1, -3, 8, 6, visual.skin);
    drawPixelBlock(unit, 5, -2, 1, 1, "#ffffff");
    drawPixelBlock(unit, 5.4, -1.7, 0.5, 0.5, "#1d4ed8");
    drawOutlinedPixelBlock(unit, 0, -5, 9, 4, visual.hair);
    drawOutlinedPixelBlock(unit, -9, 7, 4, 2, visual.boots);
    drawOutlinedPixelBlock(unit, 4, 6, 5, 2, visual.boots);
    ctx.restore();
  }

  function drawShoulders(unit, visual, metal, trim) {
    drawOutlinedPixelBlock(unit, -8, -4, 4, 4, metal);
    drawOutlinedPixelBlock(unit, 4, -4, 4, 4, metal);
    drawPixelBlock(unit, -7.2, -3.3, 2.4, 1.2, trim);
    drawPixelBlock(unit, 4.8, -3.3, 2.4, 1.2, trim);
  }

  function drawArm(unit, x, y, visual, trim, raised) {
    const armY = y + (raised ? -1 : 0);
    drawOutlinedPixelBlock(unit, x, armY, 3, raised ? 5 : 6, visual.skin);
    drawOutlinedPixelBlock(unit, x + 0.4, armY - 1, 2.2, 2.4, trim);
    drawOutlinedPixelBlock(unit, x + 0.5, armY + (raised ? -2.4 : 5), 2, 2, visual.boots);
  }

  function drawHead(unit, visual, facing) {
    if (visual.hairStyle === "hood") {
      drawOutlinedPixelBlock(unit, -5, -12, 10, 10, visual.cape);
      drawOutlinedPixelBlock(unit, -3.8, -10, 7.6, 6.8, visual.skin);
    } else {
      const x = facing === "side" ? 1 : -4;
      drawOutlinedPixelBlock(unit, x, -11, 8, 8, visual.skin);
    }

    if (facing === "front") {
      drawEyePixel(unit, -2.4, -7.6);
      drawEyePixel(unit, 2, -7.6);
    } else if (facing === "side") {
      drawEyePixel(unit, 6.3, -7.7);
    }
  }

  function drawHair(unit, visual, facing) {
    if (visual.hairStyle === "bald") {
      const x = facing === "side" ? 5.2 : 1.8;
      drawPixelBlock(unit, x, -10.2, 1.6, 1.2, shadeColour(visual.skin, 24));
      return;
    }

    if (visual.hairStyle === "hood") {
      drawPixelBlock(unit, -4.5, -11, 9, 1.2, shadeColour(visual.cape, -18));
      drawPixelBlock(unit, -4.5, -4.5, 9, 1.2, shadeColour(visual.cape, -18));
      drawPixelBlock(unit, -3.8, -10, 1.4, 5.8, visual.hair);
      return;
    }

    if (facing === "side") {
      drawOutlinedPixelBlock(unit, 0, -12, 8, 5, visual.hair);
      drawOutlinedPixelBlock(unit, -1, -9, 4, 6, shadeColour(visual.hair, -12));
      drawPixelBlock(unit, 4, -12.8, 2, 1.3, shadeColour(visual.hair, 18));
      drawPixelBlock(unit, 7, -8.2, 1.5, 2.2, shadeColour(visual.hair, -10));
      return;
    }

    if (visual.hairStyle === "long") {
      drawOutlinedPixelBlock(unit, -5, -13, 10, 12, visual.hair);
      drawPixelBlock(unit, -4, -12, 8, 1.2, shadeColour(visual.hair, 18));
      drawPixelBlock(unit, -5, -3, 10, 1.2, shadeColour(visual.hair, -18));
      return;
    }

    drawOutlinedPixelBlock(unit, -5, -13, 10, 5, visual.hair);
    drawOutlinedPixelBlock(unit, -4, -10, 8, 3, visual.hair);
    if (visual.hairStyle === "messy") {
      drawPixelBlock(unit, -5.8, -13.8, 2, 2, shadeColour(visual.hair, 18));
      drawPixelBlock(unit, -1, -14.2, 2.2, 2, shadeColour(visual.hair, -8));
      drawPixelBlock(unit, 3.4, -13.8, 2.4, 1.8, shadeColour(visual.hair, 12));
    }
  }

  function drawEyePixel(unit, x, y) {
    drawPixelBlock(unit, x, y, 1.1, 1.5, "#ffffff");
    drawPixelBlock(unit, x + 0.38, y + 0.3, 0.55, 0.8, "#1d4ed8");
  }

  function drawMagicSpark(unit, x, y, colour) {
    drawPixelBlock(unit, x, y, 1.6, 1.6, "#fff7ed");
    drawPixelBlock(unit, x - 1.6, y + 0.5, 1.2, 0.6, colour);
    drawPixelBlock(unit, x + 2, y + 0.5, 1.2, 0.6, colour);
    drawPixelBlock(unit, x + 0.5, y - 1.6, 0.6, 1.2, colour);
    drawPixelBlock(unit, x + 0.5, y + 2, 0.6, 1.2, colour);
  }

  function drawSpriteWeapon(unit, weapon, trim, pose, facing) {
    const metal = weapon.colour || "#dbeafe";
    const attack = pose === "attack";
    if (weapon.melee) {
      const y = facing === "front" ? -4 : -3;
      drawOutlinedPixelBlock(unit, 7, attack ? y : -1, attack ? 7 : 4.5, 1.3, trim);
      drawOutlinedPixelBlock(unit, attack ? 12.8 : 10.5, attack ? y - 0.8 : -1.8, 5.2, 2.8, metal);
      drawPixelBlock(unit, attack ? 17.2 : 14.8, attack ? y : -1, 1.3, 0.8, "#f8fafc");
      return;
    }

    if (weapon.id.includes("bow") || weapon.id.includes("crossbow")) {
      drawOutlinedPixelBlock(unit, 7, -5, 1.2, 8, trim);
      drawOutlinedPixelBlock(unit, 8, -4.5, 1.2, 7, metal);
      drawPixelBlock(unit, 9, -1, attack ? 8 : 5, 0.8, metal);
      return;
    }

    if (weapon.id.includes("staff") || weapon.id.includes("rod")) {
      drawOutlinedPixelBlock(unit, 7, attack ? -4 : -1, 7, 1, "#7c4a22");
      drawOutlinedPixelBlock(unit, 13, attack ? -5.2 : -2.2, 2.8, 3.8, metal);
      drawMagicSpark(unit, 15.8, attack ? -4.4 : -1.4, metal);
      return;
    }

    drawOutlinedPixelBlock(unit, 7, attack ? -3.5 : -1.2, attack ? 9 : 7.6, 1.6, metal);
    drawPixelBlock(unit, attack ? 15.5 : 13.2, attack ? -3 : -0.7, 2.8, 0.6, "#dbeafe");
  }

  function drawCreatureMarkings(enemy) {
    const variant = enemy.variant;
    if (!variant) {
      return;
    }

    const unit = Math.max(2.2, enemy.radius / 5.5);
    const accent = creatureAccent(enemy);

    ctx.save();
    ctx.globalAlpha *= 0.8;
    if (variant.marking === "spots" || variant.marking === "crown-spots") {
      for (let i = 0; i < variant.spotCount; i += 1) {
        const x = Math.round(Math.cos(variant.detail + i * 1.7) * 2);
        const y = Math.round(Math.sin(variant.detail + i * 1.4) * 1.5);
        drawPixelBlock(unit, x, y, 1, 1, accent);
      }
    } else if (variant.marking === "stripes" || variant.marking === "glow-ridges") {
      drawPixelBlock(unit, -3, -1, 6, 0.55, accent);
      drawPixelBlock(unit, -2, 1, 5, 0.55, accent);
    } else if (variant.marking === "mask" || variant.marking === "moon-mask") {
      drawPixelBlock(unit, -2, -2, 4, 1, accent);
    } else if (variant.marking === "tail-tip" || variant.marking === "war-paint") {
      drawPixelBlock(unit, -5, 2, 2, 1, accent);
    } else if (variant.marking === "crest") {
      drawPixelBlock(unit, -1, -5, 2, 2, accent);
    }
    ctx.restore();
  }

  function drawRabbit(enemy) {
    const unit = Math.max(2.2, enemy.radius / 5.5);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -3, -5, 1, 4, body);
    drawPixelBlock(unit, 2, -5, 1, 4, body);
    drawPixelBlock(unit, -2.7, -4, 0.5, 2, accent);
    drawPixelBlock(unit, 2.2, -4, 0.5, 2, accent);
    drawPixelBlock(unit, -3, -2, 6, 4, body);
    drawPixelBlock(unit, -2, 2, 4, 2, body);
    drawPixelEye(unit, -2, -1);
    drawPixelEye(unit, 1, -1);
    drawPixelBlock(unit, -1, 1, 2, 1, accent);
    drawPixelBlock(unit, -4, 3, 2, 1, body);
    drawPixelBlock(unit, 2, 3, 2, 1, body);
  }

  function drawBoar(enemy) {
    const unit = Math.max(2.4, enemy.radius / 5.8);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -5, -2, 10, 5, body);
    drawPixelBlock(unit, -4, -4, 2, 2, body);
    drawPixelBlock(unit, 2, -4, 2, 2, body);
    drawPixelBlock(unit, -3, 1, 6, 2, accent);
    drawPixelBlock(unit, -2, 2, 1, 1, "#020617");
    drawPixelBlock(unit, 1, 2, 1, 1, "#020617");
    drawPixelEye(unit, -3, -1);
    drawPixelEye(unit, 2, -1);
    drawPixelBlock(unit, -5, 2, 2, 1, "#fff7ed");
    drawPixelBlock(unit, 3, 2, 2, 1, "#fff7ed");
    drawPixelBlock(unit, -6, 0, 1, 2, body);
  }

  function drawToad(enemy) {
    const unit = Math.max(2.2, enemy.radius / 5.5);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -4, -1, 8, 5, body);
    drawPixelBlock(unit, -3, -3, 2, 2, accent);
    drawPixelBlock(unit, 1, -3, 2, 2, accent);
    drawPixelEye(unit, -2.7, -2.7);
    drawPixelEye(unit, 1.3, -2.7);
    drawPixelBlock(unit, -2, 1, 4, 1, "#052e16");
    drawPixelBlock(unit, -5, 3, 2, 1, body);
    drawPixelBlock(unit, 3, 3, 2, 1, body);
    drawPixelBlock(unit, -1, 3, 1, 1, accent);
    drawPixelBlock(unit, 2, 0, 1, 1, accent);
  }

  function drawBat(enemy) {
    const unit = Math.max(2.1, enemy.radius / 5.7);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -7, -2, 3, 2, body);
    drawPixelBlock(unit, -6, 0, 3, 2, body);
    drawPixelBlock(unit, 4, -2, 3, 2, body);
    drawPixelBlock(unit, 3, 0, 3, 2, body);
    drawPixelBlock(unit, -3, -2, 6, 5, body);
    drawPixelBlock(unit, -1, -4, 1, 2, accent);
    drawPixelBlock(unit, 1, -4, 1, 2, accent);
    drawPixelEye(unit, -2, -1);
    drawPixelEye(unit, 1, -1);
    drawPixelBlock(unit, -1, 1, 2, 1, accent);
  }

  function drawTurtle(enemy) {
    const unit = Math.max(2.4, enemy.radius / 6);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -5, -2, 10, 5, body);
    drawPixelBlock(unit, -3, -1, 6, 3, accent);
    drawPixelBlock(unit, -1, -4, 3, 2, body);
    drawPixelEye(unit, -0.5, -3.7);
    drawPixelEye(unit, 1.2, -3.7);
    drawPixelBlock(unit, -5, 3, 2, 1, body);
    drawPixelBlock(unit, 3, 3, 2, 1, body);
    drawPixelBlock(unit, -6, 0, 1, 2, body);
    drawPixelBlock(unit, 5, 0, 1, 2, body);
  }

  function drawLion(enemy) {
    const unit = Math.max(3.6, enemy.radius / 8);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -5, -5, 10, 10, accent);
    drawPixelBlock(unit, -4, -4, 2, 2, body);
    drawPixelBlock(unit, 2, -4, 2, 2, body);
    drawPixelBlock(unit, -3, -3, 6, 7, body);
    drawPixelEye(unit, -2, -1);
    drawPixelEye(unit, 1, -1);
    drawPixelBlock(unit, -1, 1, 2, 2, "#fff7ed");
    drawPixelBlock(unit, -6, 1, 1, 3, accent);
    drawPixelBlock(unit, 5, 1, 1, 3, accent);
  }

  function drawSerpent(enemy) {
    const unit = Math.max(3.2, enemy.radius / 8);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -6, 2, 4, 2, body);
    drawPixelBlock(unit, -3, 0, 4, 2, body);
    drawPixelBlock(unit, 0, -2, 4, 2, body);
    drawPixelBlock(unit, 3, -4, 4, 3, body);
    drawPixelBlock(unit, -5, 2.5, 2, 1, accent);
    drawPixelBlock(unit, -2, 0.5, 2, 1, accent);
    drawPixelBlock(unit, 1, -1.5, 2, 1, accent);
    drawPixelEye(unit, 4, -3);
    drawPixelEye(unit, 6, -3);
    drawPixelBlock(unit, 7, -2, 1, 1, "#facc15");
  }

  function drawMammoth(enemy) {
    const unit = Math.max(3.8, enemy.radius / 8.5);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -5, -3, 10, 7, body);
    drawPixelBlock(unit, -6, -2, 2, 4, accent);
    drawPixelBlock(unit, 4, -2, 2, 4, accent);
    drawPixelBlock(unit, -2, 3, 4, 4, body);
    drawPixelBlock(unit, -5, 1, 2, 1, "#fff7ed");
    drawPixelBlock(unit, 3, 1, 2, 1, "#fff7ed");
    drawPixelEye(unit, -2, -1);
    drawPixelEye(unit, 1, -1);
    drawPixelBlock(unit, -5, 4, 2, 1, "#111827");
    drawPixelBlock(unit, 3, 4, 2, 1, "#111827");
  }

  function drawOwl(enemy) {
    const unit = Math.max(3.4, enemy.radius / 8);
    const body = creatureColour(enemy);
    const accent = creatureAccent(enemy);
    drawPixelBlock(unit, -4, -4, 8, 9, body);
    drawPixelBlock(unit, -5, -5, 2, 2, body);
    drawPixelBlock(unit, 3, -5, 2, 2, body);
    drawPixelBlock(unit, -3, -2, 3, 3, accent);
    drawPixelBlock(unit, 0, -2, 3, 3, accent);
    drawPixelEye(unit, -2, -1);
    drawPixelEye(unit, 1, -1);
    drawPixelBlock(unit, -1, 1, 2, 1, "#facc15");
    drawPixelBlock(unit, -5, 0, 2, 4, body);
    drawPixelBlock(unit, 3, 0, 2, 4, body);
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
    const frame = Math.sin((player.walkTime || 0) * 15);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.shadowColor = stats.character.accent;
    ctx.shadowBlur = state.activeAbility?.id === "dash" ? 24 : 0;
    drawPixelAdventurer(stats, {
      attacking: (player.attackTime || 0) > 0,
      casting: (player.castTime || 0) > 0,
      facing: player.facing || "down",
      fallen: fall > 0.2,
      frame,
      moving: Boolean(player.moving)
    });
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
      if (pickup.type === "money") {
        drawMoneyPickup(pickup, pos);
        continue;
      }

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

  function drawMoneyPickup(pickup, pos) {
    const moneyType = pickup.moneyType;
    const unit = Math.max(2.2, pickup.radius / 4);
    const bob = Math.sin(state.elapsed * 3 + pickup.x * 0.01) * 1.4;

    ctx.save();
    ctx.translate(pos.x, pos.y + bob);
    ctx.imageSmoothingEnabled = false;

    if (moneyType.id === "gold-pouch") {
      drawPixelBlock(unit, -2.5, -2, 5, 4, moneyType.colour);
      drawPixelBlock(unit, -2, -3, 4, 1, moneyType.accent);
      drawPixelBlock(unit, -1.2, -0.6, 2.4, 1.2, "#fff7ed");
      drawPixelBlock(unit, -0.5, -0.2, 1, 0.8, moneyType.accent);
    } else if (moneyType.id === "royal-gem") {
      drawPixelBlock(unit, -1.5, -3, 3, 1, "#e0f2fe");
      drawPixelBlock(unit, -2.5, -2, 5, 2, moneyType.colour);
      drawPixelBlock(unit, -1.5, 0, 3, 2, moneyType.accent);
      drawPixelBlock(unit, -0.5, 2, 1, 1, "#e0f2fe");
    } else {
      drawPixelBlock(unit, -2.2, -2, 4.4, 1.5, "#020617");
      drawPixelBlock(unit, -2.5, -1.4, 5, 3, moneyType.colour);
      drawPixelBlock(unit, -1.7, -2.4, 4, 2, moneyType.accent);
      drawPixelBlock(unit, -0.8, -1.8, 1.4, 1, "#fff7ed");
      if (moneyType.id === "silver-stack") {
        drawPixelBlock(unit, -3.2, 0.8, 6.4, 1.2, moneyType.colour);
        drawPixelBlock(unit, -2.2, 1.8, 4.4, 1.2, moneyType.accent);
      }
    }

    ctx.font = "700 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(2, 6, 23, 0.86)";
    ctx.fillStyle = "#fff7ed";
    ctx.strokeText(String(pickup.value), 0, -pickup.radius - 9);
    ctx.fillText(String(pickup.value), 0, -pickup.radius - 9);
    ctx.restore();
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
    const cooldownLength = ability.cooldown * itemMultiplier("cooldownMultiplier");
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
          refreshPreviewLoadout();
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
          refreshPreviewLoadout();
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
        refreshPreviewLoadout();
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
      return entry.melee
        ? `${entry.damage} damage, melee ${entry.range}`
        : `${entry.damage} damage, ${entry.range} range`;
    }
    return `+${entry.healthBonus} HP, ${Math.round(entry.damageReduction * 100)}% guard`;
  }

  function itemSummary(item) {
    if (item.effect === "pickupRange") return "Wider pickup pull";
    if (item.effect === "coinBonus") return "+1 coin per baddie";
    if (item.effect === "cooldownMultiplier") return "Faster abilities";
    if (item.effect === "healBonus") return "Stronger healing";
    if (item.effect === "speedBonus") return `+${item.value} speed`;
    if (item.effect === "damageBonus") return `+${item.value} damage`;
    if (item.effect === "rangeMultiplier") return "Longer reach";
    if (item.effect === "damageReductionBonus") return "Extra guard";
    if (item.effect === "healOnKill") return "Heal on takedown";
    if (item.effect === "bossDamageMultiplier") return "More boss damage";
    if (item.effect === "projectileSpeedMultiplier") return "Faster shots";
    return "Useful upgrade";
  }

  function renderShops() {
    const lockedByArena = state.screen === "playing" || state.screen === "dying";
    refs.shopBalance.textContent = `${state.coins} coins available`;
    refs.shopStartAction.textContent = state.level >= DATA.MAX_LEVEL ? "Start level 500" : `Start level ${state.level}`;
    refs.shopStartAction.disabled = lockedByArena;
    refs.shopStartAction.className = lockedByArena ? "in-arena" : "";
    refs.shopStartAction.onclick = startLevel;

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
