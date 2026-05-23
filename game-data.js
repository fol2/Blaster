(function initialiseBlasterData(global) {
  const MAX_LEVEL = 500;
  const ENEMY_COIN_REWARD = 3;

  const characters = [
    {
      id: "nova-runner",
      name: "Nova Runner",
      role: "Fast starter",
      cost: 0,
      colour: "#38bdf8",
      accent: "#facc15",
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
    }
  ];

  const enemies = [
    {
      id: "skitter",
      name: "Skitter",
      colour: "#ef4444",
      accent: "#fecaca",
      shape: "circle",
      baseHealth: 42,
      speed: 118,
      radius: 17,
      touchDamage: 10,
      unlockLevel: 1
    },
    {
      id: "bruiser",
      name: "Bruiser",
      colour: "#f97316",
      accent: "#fed7aa",
      shape: "square",
      baseHealth: 100,
      speed: 75,
      radius: 24,
      touchDamage: 18,
      unlockLevel: 3
    },
    {
      id: "spitter",
      name: "Spitter",
      colour: "#84cc16",
      accent: "#ecfccb",
      shape: "triangle",
      baseHealth: 68,
      speed: 92,
      radius: 19,
      touchDamage: 8,
      unlockLevel: 6,
      shoots: true,
      shootCooldown: 2.3
    },
    {
      id: "splitter",
      name: "Splitter",
      colour: "#e879f9",
      accent: "#fae8ff",
      shape: "diamond",
      baseHealth: 76,
      speed: 104,
      radius: 20,
      touchDamage: 12,
      unlockLevel: 10,
      splits: true
    },
    {
      id: "bulwark",
      name: "Bulwark",
      colour: "#64748b",
      accent: "#e2e8f0",
      shape: "hex",
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
      name: "Scrap King",
      colour: "#f97316",
      accent: "#facc15",
      shape: "crowned",
      baseHealth: 520,
      speed: 72,
      radius: 58,
      touchDamage: 24,
      bulletColour: "#fb7185"
    },
    {
      id: "crystal-witch",
      name: "Crystal Witch",
      colour: "#a855f7",
      accent: "#67e8f9",
      shape: "star",
      baseHealth: 450,
      speed: 88,
      radius: 52,
      touchDamage: 18,
      bulletColour: "#67e8f9"
    },
    {
      id: "iron-colossus",
      name: "Iron Colossus",
      colour: "#94a3b8",
      accent: "#ef4444",
      shape: "fortress",
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
      shape: "eye",
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

  function levelConfig(level) {
    const safeLevel = clampLevel(level);
    const difficulty = 1 + safeLevel * 0.055;

    return {
      level: safeLevel,
      difficulty,
      spawnInterval: Math.max(0.42, 1.45 - safeLevel * 0.002),
      maxEnemies: Math.min(58, 9 + Math.floor(safeLevel / 8)),
      bossSpawnSeconds: Math.max(18, 32 - Math.floor(safeLevel / 30)),
      enemyHealthMultiplier: difficulty,
      enemyDamageMultiplier: 1 + safeLevel * 0.026,
      enemySpeedMultiplier: 1 + safeLevel * 0.004,
      bossHealthMultiplier: 1 + safeLevel * 0.075,
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
    characters,
    weapons,
    armour,
    items,
    enemies,
    bosses,
    bossReward,
    levelConfig,
    availableEnemies,
    bossForLevel
  };
})(window);
