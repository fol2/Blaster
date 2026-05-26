---
title: Survival Shooter Level Game
status: completed
created: 2026-05-23
origin: Direct LFG request
---

# Survival Shooter Level Game Plan

## Problem Frame

Build the first playable version of Blaster as a browser shooting game. The player chooses a character, moves freely around a large arena, automatically attacks nearby baddies, survives escalating waves, defeats a final boss, and sees a clear win or loss state. Progression should support 500 increasingly difficult levels through scaling rules rather than hand-authored level files.

## Scope

This plan targets a dependency-free static Canvas game that can run from `index.html`. The first version will include playable combat, several characters with distinct abilities, enemy and boss variants, healing pickups, coin rewards, an upgrade shop, armour/weapons/items, and procedural difficulty scaling across 500 levels.

### In Scope

- A browser-rendered top-down arena game with keyboard movement and camera-following play space.
- Automatic shooting when enemies are close enough.
- Multiple playable characters with different looks, stats, prices, and abilities.
- A high-cost character whose ability activates with `E`, creates a force field, lasts 15-20 seconds, has a 5 second cooldown, and kills baddies inside it.
- Different baddie types with distinct visuals and behaviours.
- Boss encounters that spawn near the end of each level and must be defeated to clear the level.
- GAME OVER state where the character falls to the ground before the overlay appears.
- YOU CLEARED THE LEVEL state with boss coin rewards from roughly 100 to 1000 coins based on level.
- Coin rewards of 3 coins for normal baddies.
- Healing pickups.
- Shop/progression catalogue for weapons, characters, armour, and useful items such as a freezing knife.
- Difficulty scaling up to level 500.

### Out of Scope

- Networked multiplayer, saved cloud accounts, or online leaderboards.
- Hand-made artwork for all 500 levels.
- Manual bespoke boss design for every level.
- Real-money purchases.

## Existing Repo Context

- `README.md` is the only current source file and describes the repo as "blast all the baddies."
- No package manifest or framework exists.
- System `node.exe` is not usable from PATH and `npm` is unavailable, so the implementation should not depend on installing packages.

## Key Decisions

1. Use a static Canvas architecture.
   - Rationale: the repo is empty, the game needs real-time movement/combat, and a single static page avoids dependency and tooling issues.

2. Use procedural level scaling instead of 500 static level definitions.
   - Rationale: the request asks for 500 levels, and formula-based health, speed, spawn rate, and reward scaling keeps the game maintainable.

3. Keep content data-driven inside JavaScript arrays and factory functions.
   - Rationale: characters, weapons, armour, items, enemy types, and bosses need clear cost/stat differences without scattering magic values through the game loop.

4. Implement the first version as one complete playable level loop, then scale it by level number.
   - Rationale: level progression, win/loss states, rewards, and upgrades are the core loop; bespoke content can be added later without changing that loop.

## Implementation Units

### U1 - Static App Shell and Layout

Files:
- `index.html`
- `styles.css`
- `README.md`

Create the browser entry point with a full-screen Canvas, HUD, character/shop panels, start/next-level controls, and overlay states. Update the README with local run instructions.

Test scenarios:
- Opening `index.html` shows the game screen without console-visible missing asset references.
- The initial view offers character selection and a start action.
- HUD text is readable at desktop and narrow viewport sizes.

### U2 - Game Configuration and Progression Data

Files:
- `game-data.js`

Define character, weapon, armour, item, enemy, boss, level scaling, and reward data. Include the force-field character and the freezing knife item. Expose helper functions for boss rewards, level difficulty, and item availability.

Test scenarios:
- Level 1 boss rewards are near 100 coins.
- Level 500 boss rewards are capped near 1000 coins.
- Normal enemy kills award exactly 3 coins.
- The force-field character is among the most expensive characters and has the requested cooldown/duration behaviour in its data.

### U3 - Core Game State and Loop

Files:
- `game.js`

Implement the Canvas render loop, player movement, camera, arena bounds, enemy spawning, collision checks, health, pickups, automatic targeting/shooting, boss spawn timing, level clear, and death/fall animation.

Test scenarios:
- The player can move freely around a larger-than-screen arena.
- Enemies spawn and move towards the player.
- The player automatically shoots nearby enemies.
- Killing normal enemies adds 3 coins.
- Healing pickups restore health without exceeding max health.
- Death triggers a falling player animation and then GAME OVER.
- Killing the boss triggers YOU CLEARED THE LEVEL.

### U4 - Characters, Abilities, Weapons, Armour, and Items

Files:
- `game.js`
- `game-data.js`

Wire shop purchases and equipment into gameplay. Characters should alter speed, health, damage, or special behaviour. Weapons and items should change attacks, including the freezing knife slowing or freezing enemies. Armour should improve survivability.

Test scenarios:
- Locked shop entries cannot be equipped without enough coins.
- Purchased entries can be equipped and affect gameplay stats.
- Pressing `E` for the force-field character creates a visible field, kills normal baddies inside it, respects a 5 second cooldown, and expires after 15-20 seconds.
- A non-force-field character either uses their own ability or shows the ability as unavailable.

### U5 - Visual Variety and Feedback

Files:
- `styles.css`
- `game.js`

Render distinct looks for characters, enemies, projectiles, pickups, weapons/effects, and bosses using Canvas shapes, colours, labels, particles, and health bars. Add readable overlays for GAME OVER and YOU CLEARED THE LEVEL.

Test scenarios:
- Different enemy types and bosses are visually distinguishable.
- The boss is noticeably larger and more dramatic than ordinary enemies.
- The player, enemies, coins/rewards, health pickups, and force field are visually clear.
- End-state overlays are centred and legible.

### U6 - Verification Helpers

Files:
- `test-game-data.html`

Add a tiny browser-based smoke test page for deterministic data checks that do not need Node. It should report pass/fail for reward scaling, content catalogue constraints, and key requested constants.

Test scenarios:
- The test page reports all checks as passing in a browser.
- A failed assertion is visible on the page.

## Verification Plan

- Manually open `index.html` in a browser and play one level through either boss defeat or death.
- Open `test-game-data.html` to verify catalogue and scaling checks.
- Use the in-app browser to inspect the local game visually after implementation.
- If a local static server becomes available, run the same files through that server; otherwise verify direct file opening.

## Risks and Mitigations

- The requested content volume is large. Mitigation: ship a complete systemic catalogue and procedural scaling first, leaving hand-authored content expansion as future work.
- Browser-game timing bugs can be hard to verify without automated browser tooling. Mitigation: keep deterministic constants in `game-data.js` and add a browser smoke test page for the most important scaling rules.
- A dependency-free implementation can grow messy. Mitigation: separate data from loop logic and keep rendering helpers grouped by responsibility.

## Deferred Follow-Up Work

- Save progress to `localStorage`.
- Add sound effects and music.
- Add more hand-drawn or generated art assets.
- Add more boss patterns and biome backgrounds.
- Add keyboard/controller remapping.
