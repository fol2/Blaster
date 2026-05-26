(function initialiseBlasterData(global) {
  const MAX_LEVEL = 500;
  const ENEMY_COIN_REWARD = 3;
  const ENEMY_RENDER_STYLE = "pixel-art";
  const ENEMY_ANIMATION_STYLE = "rpg-sprite-sheet";
  const TERRAIN_RENDER_STYLE = "pixel-art";

  const terrainThemes = [
    {
      id: "wild-meadow",
      name: "Wild Meadow",
      feature: "meadow",
      base: "#77ad24",
      mid: "#8fc832",
      light: "#b5dc45",
      shadow: "#4f7d22",
      dark: "#31511d",
      earth: "#815b31",
      stone: "#8b8f82",
      accent: "#f8fafc",
      glow: "#f472b6"
    },
    {
      id: "sunbaked-badlands",
      name: "Sunbaked Badlands",
      feature: "desert",
      base: "#c87520",
      mid: "#d88a2c",
      light: "#eca33d",
      shadow: "#9b561b",
      dark: "#6f3a16",
      earth: "#b1651f",
      stone: "#a45f23",
      accent: "#d8a23a",
      glow: "#fef08a"
    },
    {
      id: "crystal-depths",
      name: "Crystal Depths",
      feature: "crystal",
      base: "#2f2350",
      mid: "#49306f",
      light: "#6942a4",
      shadow: "#201737",
      dark: "#120d25",
      earth: "#3d2948",
      stone: "#5b3a6e",
      accent: "#8b5cf6",
      glow: "#38bdf8"
    },
    {
      id: "moonlit-thicket",
      name: "Moonlit Thicket",
      feature: "forest",
      base: "#12243a",
      mid: "#18334a",
      light: "#25543a",
      shadow: "#0b1727",
      dark: "#07101e",
      earth: "#4a2e2d",
      stone: "#475569",
      accent: "#22c55e",
      glow: "#60a5fa"
    }
  ];

  const moneyPickups = [
    {
      id: "bronze-coin",
      name: "Bronze Coin",
      value: 5,
      colour: "#f59e0b",
      accent: "#fde68a",
      radius: 10
    },
    {
      id: "silver-stack",
      name: "Silver Stack",
      value: 12,
      colour: "#e5e7eb",
      accent: "#94a3b8",
      radius: 12
    },
    {
      id: "gold-pouch",
      name: "Gold Pouch",
      value: 25,
      colour: "#facc15",
      accent: "#92400e",
      radius: 14
    },
    {
      id: "royal-gem",
      name: "Royal Gem",
      value: 60,
      colour: "#38bdf8",
      accent: "#f0abfc",
      radius: 13
    }
  ];

  const characters = [
    {
      id: "nova-runner",
      name: "Nova Runner",
      role: "Fast starter",
      cost: 0,
      colour: "#38bdf8",
      accent: "#facc15",
      visual: {
        hair: "#7c4a22",
        skin: "#f0c7a5",
        tunic: "#1d4f91",
        trim: "#f6c34a",
        cape: "#173f73",
        metal: "#cbd5e1",
        boots: "#6b3f1d",
        scarf: "#1e3a8a",
        hairStyle: "messy",
        outfit: "knight"
      },
      maxHealth: 110,
      speed: 300,
      damageBonus: 0,
      ability: {
        id: "dash",
        name: "Star Dash",
        cooldown: 4,
        duration: 0.45,
        speedMultiplier: 2.4
      }
    },
    {
      id: "mender",
      name: "Mender",
      role: "Survival healer",
      cost: 700,
      colour: "#22c55e",
      accent: "#fef08a",
      visual: {
        hair: "#d8b75a",
        skin: "#f2c9a7",
        tunic: "#275936",
        trim: "#d9b34c",
        cape: "#1f4b2d",
        metal: "#c8c1a7",
        boots: "#65401f",
        scarf: "#31442e",
        hairStyle: "short",
        outfit: "ranger"
      },
      maxHealth: 135,
      speed: 255,
      damageBonus: -2,
      ability: {
        id: "heal-wave",
        name: "Heal Wave",
        cooldown: 9,
        heal: 42
      }
    },
    {
      id: "frost-scout",
      name: "Frost Scout",
      role: "Slows baddies",
      cost: 1650,
      colour: "#67e8f9",
      accent: "#ffffff",
      visual: {
        hair: "#d9dde2",
        skin: "#f0c7a5",
        tunic: "#40236f",
        trim: "#f0b84d",
        cape: "#23245f",
        metal: "#d4d7dc",
        boots: "#6b3f1d",
        scarf: "#5b2c82",
        hairStyle: "long",
        outfit: "mage"
      },
      maxHealth: 120,
      speed: 280,
      damageBonus: 2,
      ability: {
        id: "frost-burst",
        name: "Frost Burst",
        cooldown: 8,
        radius: 190,
        freezeDuration: 3.4,
        damage: 18
      }
    },
    {
      id: "astra-warden",
      name: "Astra Warden",
      role: "Force field legend",
      cost: 5200,
      colour: "#a855f7",
      accent: "#fb7185",
      visual: {
        hair: "#2a201b",
        skin: "#e7b98f",
        tunic: "#263428",
        trim: "#9aa458",
        cape: "#33402f",
        metal: "#8e977d",
        boots: "#31271e",
        scarf: "#6e3b3b",
        hairStyle: "hood",
        outfit: "warden"
      },
      maxHealth: 170,
      speed: 245,
      damageBonus: 5,
      ability: {
        id: "force-field",
        name: "Force Field",
        cooldown: 5,
        duration: 17,
        radius: 230,
        bossDamagePerSecond: 78
      }
    }
  ];

  const weapons = [
    {
      id: "pulse-pistol",
      name: "Pulse Pistol",
      cost: 0,
      colour: "#38bdf8",
      damage: 18,
      cooldown: 0.42,
      range: 360,
      projectileSpeed: 720,
      pellets: 1,
      spread: 0,
      freezeDuration: 0
    },
    {
      id: "spark-carbine",
      name: "Spark Carbine",
      cost: 420,
      colour: "#facc15",
      damage: 25,
      cooldown: 0.34,
      range: 410,
      projectileSpeed: 790,
      pellets: 1,
      spread: 0,
      freezeDuration: 0
    },
    {
      id: "freezy-knife",
      name: "Freezy Knife",
      cost: 350,
      colour: "#67e8f9",
      damage: 34,
      cooldown: 0.3,
      range: 142,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 2.6,
      melee: true
    },
    {
      id: "storm-splitter",
      name: "Storm Splitter",
      cost: 1250,
      colour: "#f97316",
      damage: 18,
      cooldown: 0.5,
      range: 340,
      projectileSpeed: 650,
      pellets: 4,
      spread: 0.38,
      freezeDuration: 0
    },
    {
      id: "solar-lance",
      name: "Solar Lance",
      cost: 3200,
      colour: "#fb7185",
      damage: 52,
      cooldown: 0.62,
      range: 520,
      projectileSpeed: 910,
      pellets: 1,
      spread: 0,
      pierce: 1,
      freezeDuration: 0
    },
    {
      id: "silver-sword",
      name: "Silver Sword",
      cost: 180,
      colour: "#e5e7eb",
      damage: 28,
      cooldown: 0.38,
      range: 118,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "guard-broadsword",
      name: "Guard Broadsword",
      cost: 760,
      colour: "#cbd5e1",
      damage: 42,
      cooldown: 0.54,
      range: 158,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "twin-axe",
      name: "Twin Axe",
      cost: 980,
      colour: "#94a3b8",
      damage: 38,
      cooldown: 0.47,
      range: 132,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "royal-spear",
      name: "Royal Spear",
      cost: 1150,
      colour: "#d97706",
      damage: 36,
      cooldown: 0.44,
      range: 190,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true,
      pierce: 1
    },
    {
      id: "oak-longbow",
      name: "Oak Longbow",
      cost: 1500,
      colour: "#b45309",
      damage: 31,
      cooldown: 0.36,
      range: 610,
      projectileSpeed: 980,
      pellets: 1,
      spread: 0,
      pierce: 1,
      freezeDuration: 0
    },
    {
      id: "castle-crossbow",
      name: "Castle Crossbow",
      cost: 2100,
      colour: "#60a5fa",
      damage: 64,
      cooldown: 0.86,
      range: 680,
      projectileSpeed: 1040,
      pellets: 1,
      spread: 0,
      pierce: 2,
      freezeDuration: 0
    },
    {
      id: "crystal-staff",
      name: "Crystal Staff",
      cost: 2600,
      colour: "#a855f7",
      damage: 36,
      cooldown: 0.48,
      range: 520,
      projectileSpeed: 760,
      pellets: 3,
      spread: 0.24,
      freezeDuration: 0.8
    },
    {
      id: "emerald-rod",
      name: "Emerald Rod",
      cost: 2900,
      colour: "#22c55e",
      damage: 30,
      cooldown: 0.32,
      range: 490,
      projectileSpeed: 820,
      pellets: 2,
      spread: 0.18,
      freezeDuration: 0
    },
    {
      id: "spiked-mace",
      name: "Spiked Mace",
      cost: 2350,
      colour: "#64748b",
      damage: 72,
      cooldown: 0.78,
      range: 124,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "war-hammer",
      name: "War Hammer",
      cost: 3400,
      colour: "#d1d5db",
      damage: 92,
      cooldown: 1,
      range: 148,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0.4,
      melee: true
    },
    {
      id: "chain-flail",
      name: "Chain Flail",
      cost: 3800,
      colour: "#9ca3af",
      damage: 58,
      cooldown: 0.58,
      range: 224,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "reaper-scythe",
      name: "Reaper Scythe",
      cost: 4550,
      colour: "#e5e7eb",
      damage: 70,
      cooldown: 0.68,
      range: 210,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      pierce: 1,
      freezeDuration: 0,
      melee: true
    },
    {
      id: "ice-crystal-blade",
      name: "Ice Crystal Blade",
      cost: 6100,
      colour: "#7dd3fc",
      damage: 82,
      cooldown: 0.64,
      range: 250,
      projectileSpeed: 0,
      pellets: 1,
      spread: 0,
      freezeDuration: 3.2,
      melee: true
    }
  ];

  const armour = [
    {
      id: "training-vest",
      name: "Training Vest",
      cost: 0,
      colour: "#94a3b8",
      healthBonus: 0,
      damageReduction: 0
    },
    {
      id: "iron-jacket",
      name: "Iron Jacket",
      cost: 650,
      colour: "#cbd5e1",
      healthBonus: 28,
      damageReduction: 0.1
    },
    {
      id: "ember-mail",
      name: "Ember Mail",
      cost: 1600,
      colour: "#f97316",
      healthBonus: 48,
      damageReduction: 0.16
    },
    {
      id: "titan-shell",
      name: "Titan Shell",
      cost: 3600,
      colour: "#22c55e",
      healthBonus: 85,
      damageReduction: 0.24
    },
    {
      id: "scout-cloak",
      name: "Scout Cloak",
      cost: 520,
      colour: "#365a3a",
      healthBonus: 12,
      damageReduction: 0.06
    },
    {
      id: "silver-plate",
      name: "Silver Plate",
      cost: 2300,
      colour: "#d7dde5",
      healthBonus: 62,
      damageReduction: 0.2
    },
    {
      id: "royal-tabard",
      name: "Royal Tabard",
      cost: 4200,
      colour: "#f8fafc",
      healthBonus: 72,
      damageReduction: 0.22
    },
    {
      id: "dragon-guard",
      name: "Dragon Guard",
      cost: 7200,
      colour: "#dc2626",
      healthBonus: 120,
      damageReduction: 0.3
    }
  ];

  const items = [
    {
      id: "pocket-magnet",
      name: "Pocket Magnet",
      cost: 280,
      colour: "#38bdf8",
      effect: "pickupRange",
      value: 70
    },
    {
      id: "lucky-core",
      name: "Lucky Core",
      cost: 900,
      colour: "#facc15",
      effect: "coinBonus",
      value: 1
    },
    {
      id: "field-battery",
      name: "Field Battery",
      cost: 1450,
      colour: "#a855f7",
      effect: "cooldownMultiplier",
      value: 0.88
    },
    {
      id: "nano-plaster",
      name: "Nano Plaster",
      cost: 1200,
      colour: "#22c55e",
      effect: "healBonus",
      value: 18
    },
    {
      id: "swift-boots",
      name: "Swift Boots",
      cost: 720,
      colour: "#b45309",
      effect: "speedBonus",
      value: 26
    },
    {
      id: "whetstone",
      name: "Whetstone",
      cost: 820,
      colour: "#94a3b8",
      effect: "damageBonus",
      value: 4
    },
    {
      id: "hawk-lens",
      name: "Hawk Lens",
      cost: 1100,
      colour: "#60a5fa",
      effect: "rangeMultiplier",
      value: 1.14
    },
    {
      id: "guard-charm",
      name: "Guard Charm",
      cost: 1700,
      colour: "#f59e0b",
      effect: "damageReductionBonus",
      value: 0.05
    },
    {
      id: "life-rune",
      name: "Life Rune",
      cost: 2400,
      colour: "#34d399",
      effect: "healOnKill",
      value: 4
    },
    {
      id: "boss-sigil",
      name: "Boss Sigil",
      cost: 3100,
      colour: "#fb7185",
      effect: "bossDamageMultiplier",
      value: 1.12
    },
    {
      id: "silver-quiver",
      name: "Silver Quiver",
      cost: 2700,
      colour: "#e5e7eb",
      effect: "projectileSpeedMultiplier",
      value: 1.18
    },
    {
      id: "battle-banner",
      name: "Battle Banner",
      cost: 4600,
      colour: "#facc15",
      effect: "damageBonus",
      value: 8
    }
  ];

  const enemies = [
    {
      id: "rush-rabbit",
      name: "Bandit Runner",
      colour: "#b45309",
      accent: "#ef4444",
      shape: "bandit",
      visual: {
        hair: "#2b2924",
        skin: "#d6a06f",
        tunic: "#5b2b1f",
        trim: "#c2410c",
        cape: "#3f1f1a",
        metal: "#78716c",
        boots: "#2f2118",
        scarf: "#7f1d1d",
        hairStyle: "messy",
        outfit: "raider"
      },
      spriteWeapon: {
        id: "raider-dagger",
        colour: "#d1d5db",
        melee: true
      },
      baseHealth: 42,
      speed: 118,
      radius: 17,
      touchDamage: 10,
      unlockLevel: 1
    },
    {
      id: "battle-boar",
      name: "Iron Brute",
      colour: "#1f2937",
      accent: "#ef4444",
      shape: "brute",
      visual: {
        hair: "#7c4a22",
        skin: "#c08457",
        tunic: "#1f2937",
        trim: "#dc2626",
        cape: "#581c1c",
        metal: "#4b5563",
        boots: "#1f1a17",
        scarf: "#7f1d1d",
        hairStyle: "bald",
        outfit: "brute"
      },
      spriteWeapon: {
        id: "iron-fists",
        colour: "#9ca3af",
        melee: true
      },
      baseHealth: 100,
      speed: 75,
      radius: 24,
      touchDamage: 18,
      unlockLevel: 3
    },
    {
      id: "venom-toad",
      name: "Void Witch",
      colour: "#4c1d95",
      accent: "#c084fc",
      shape: "void-mage",
      visual: {
        hair: "#2e2148",
        skin: "#e9c9a6",
        tunic: "#21152f",
        trim: "#a855f7",
        cape: "#1b1028",
        metal: "#fbbf24",
        boots: "#111827",
        scarf: "#5b21b6",
        hairStyle: "long",
        outfit: "mage"
      },
      spriteWeapon: {
        id: "void-staff",
        colour: "#a855f7"
      },
      baseHealth: 68,
      speed: 92,
      radius: 19,
      touchDamage: 8,
      unlockLevel: 6,
      shoots: true,
      shootCooldown: 2.3
    },
    {
      id: "shadow-bat",
      name: "Hooded Rogue",
      colour: "#253123",
      accent: "#8b5cf6",
      shape: "rogue",
      visual: {
        hair: "#111827",
        skin: "#c08a63",
        tunic: "#162116",
        trim: "#8b5cf6",
        cape: "#253123",
        metal: "#374151",
        boots: "#111827",
        scarf: "#1f2937",
        hairStyle: "hood",
        outfit: "rogue"
      },
      spriteWeapon: {
        id: "shadow-blade",
        colour: "#a78bfa",
        melee: true
      },
      baseHealth: 76,
      speed: 104,
      radius: 20,
      touchDamage: 12,
      unlockLevel: 10,
      splits: true
    },
    {
      id: "shellback-turtle",
      name: "Frost Guard",
      colour: "#0f3b57",
      accent: "#7dd3fc",
      shape: "frost-guard",
      visual: {
        hair: "#d8efff",
        skin: "#d8b18f",
        tunic: "#0f2f45",
        trim: "#7dd3fc",
        cape: "#123249",
        metal: "#93c5fd",
        boots: "#0b1727",
        scarf: "#1e3a8a",
        hairStyle: "long",
        outfit: "guard"
      },
      spriteWeapon: {
        id: "ice-sabre",
        colour: "#7dd3fc",
        melee: true
      },
      baseHealth: 160,
      speed: 62,
      radius: 27,
      touchDamage: 22,
      unlockLevel: 18,
      armour: 0.18
    }
  ];

  const bosses = [
    {
      id: "scrap-king",
      name: "War Chief",
      colour: "#7c2d12",
      accent: "#f97316",
      shape: "war-chief",
      visual: {
        hair: "#2b2924",
        skin: "#d19a69",
        tunic: "#3b221f",
        trim: "#f97316",
        cape: "#7f1d1d",
        metal: "#71717a",
        boots: "#2f2118",
        scarf: "#991b1b",
        hairStyle: "messy",
        outfit: "raider"
      },
      spriteWeapon: {
        id: "war-chief-fists",
        colour: "#f97316",
        melee: true
      },
      baseHealth: 520,
      speed: 72,
      radius: 58,
      touchDamage: 24,
      bulletColour: "#fb7185"
    },
    {
      id: "crystal-witch",
      name: "Crystal Sorceress",
      colour: "#a855f7",
      accent: "#67e8f9",
      shape: "crystal-sorceress",
      visual: {
        hair: "#dbeafe",
        skin: "#f0c7a5",
        tunic: "#0f2f45",
        trim: "#67e8f9",
        cape: "#123249",
        metal: "#bae6fd",
        boots: "#0b1727",
        scarf: "#164e63",
        hairStyle: "long",
        outfit: "mage"
      },
      spriteWeapon: {
        id: "crystal-staff",
        colour: "#67e8f9"
      },
      baseHealth: 450,
      speed: 88,
      radius: 52,
      touchDamage: 18,
      bulletColour: "#67e8f9"
    },
    {
      id: "iron-colossus",
      name: "Iron Warlord",
      colour: "#94a3b8",
      accent: "#ef4444",
      shape: "iron-warlord",
      visual: {
        hair: "#8b5e34",
        skin: "#c08457",
        tunic: "#111827",
        trim: "#ef4444",
        cape: "#7f1d1d",
        metal: "#374151",
        boots: "#1f1a17",
        scarf: "#991b1b",
        hairStyle: "bald",
        outfit: "brute"
      },
      spriteWeapon: {
        id: "spiked-gauntlet",
        colour: "#9ca3af",
        melee: true
      },
      baseHealth: 690,
      speed: 54,
      radius: 66,
      touchDamage: 32,
      bulletColour: "#f97316"
    },
    {
      id: "void-oracle",
      name: "Void Oracle",
      colour: "#312e81",
      accent: "#f0abfc",
      shape: "void-oracle",
      visual: {
        hair: "#221833",
        skin: "#e7b98f",
        tunic: "#171022",
        trim: "#c084fc",
        cape: "#24113f",
        metal: "#fbbf24",
        boots: "#111827",
        scarf: "#581c87",
        hairStyle: "long",
        outfit: "mage"
      },
      spriteWeapon: {
        id: "void-orb",
        colour: "#c084fc"
      },
      baseHealth: 575,
      speed: 78,
      radius: 60,
      touchDamage: 22,
      bulletColour: "#c084fc"
    }
  ];

  function clampLevel(level) {
    return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
  }

  function bossReward(level) {
    const safeLevel = clampLevel(level);
    return Math.round(100 + ((safeLevel - 1) * 900) / (MAX_LEVEL - 1));
  }

  function terrainForLevel(level) {
    const safeLevel = clampLevel(level);
    return terrainThemes[(safeLevel - 1) % terrainThemes.length];
  }

  function levelConfig(level) {
    const safeLevel = clampLevel(level);
    const difficulty = 1 + safeLevel * 0.055;
    const starterBossEase = Math.max(0, 1 - (safeLevel - 1) / 30);
    const bossAttackMultiplier = 1 - starterBossEase * 0.38;

    return {
      level: safeLevel,
      difficulty,
      spawnInterval: Math.max(0.42, 1.45 - safeLevel * 0.002),
      maxEnemies: Math.min(58, 9 + Math.floor(safeLevel / 8)),
      bossSpawnSeconds: Math.max(18, 32 - Math.floor(safeLevel / 30)),
      enemyHealthMultiplier: difficulty,
      enemyDamageMultiplier: 1 + safeLevel * 0.026,
      enemySpeedMultiplier: 1 + safeLevel * 0.004,
      bossHealthMultiplier: (1 + safeLevel * 0.075) * (1 - starterBossEase * 0.42),
      bossDamageMultiplier: (1 + safeLevel * 0.026) * bossAttackMultiplier,
      bossSpeedMultiplier: 1 + safeLevel * 0.002 - starterBossEase * 0.16,
      bossShotCount: starterBossEase > 0.66 ? 3 : starterBossEase > 0.33 ? 4 : 5,
      bossShotCooldown: 1.25 + starterBossEase * 0.65,
      bossBulletSpeedMultiplier: 1 - starterBossEase * 0.18,
      starterBossEase,
      bossReward: bossReward(safeLevel)
    };
  }

  function availableEnemies(level) {
    const safeLevel = clampLevel(level);
    return enemies.filter((enemy) => enemy.unlockLevel <= safeLevel);
  }

  function bossForLevel(level) {
    const safeLevel = clampLevel(level);
    return bosses[(safeLevel - 1) % bosses.length];
  }

  global.BlasterData = {
    MAX_LEVEL,
    ENEMY_COIN_REWARD,
    ENEMY_RENDER_STYLE,
    ENEMY_ANIMATION_STYLE,
    TERRAIN_RENDER_STYLE,
    terrainThemes,
    moneyPickups,
    characters,
    weapons,
    armour,
    items,
    enemies,
    bosses,
    bossReward,
    terrainForLevel,
    levelConfig,
    availableEnemies,
    bossForLevel
  };
})(window);
