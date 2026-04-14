# Auctores RPG Bot

Discord RPG bot built with Bun + TypeScript + discord.js. It registers guild slash commands on startup and stores RPG state in local JSON files.

## Overview

The bot currently focuses on:

- character stats viewing
- weapon/armor gacha rolls
- roll and claim cooldown tracking
- automatic equip on successful claim

## Features

- `/ping`: health check command
- `/stats [user]`: shows level, core stats (STR/DEX/AGI/VIT), HP, equipped weapon/armor, gold, and experience
- `/gweapon`: rolls a random weapon and shows a claim button (30 second claim window)
- `/garmor`: rolls a random armor and shows a claim button (30 second claim window)
- `/timeout`: shows remaining shared rolls and claim availability
- Shared roll pool: 5 rolls per user per hour across both gacha commands
- Claim cooldown: one successful claim per user every 3 hours

## Tech Stack

- Runtime: Bun
- Language: TypeScript (ESM)
- Discord SDK: discord.js v14
- Env loading: dotenv
- Linting: ESLint + typescript-eslint
- Local persistence: JSON files under `data/`

## Setup and Run

1. Install dependencies:

```bash
bun install
```

2. Create `.env` from `.env.example` and set values:

```env
DISCORD_TOKEN=""
DISCORD_APPLICATION_ID=""
DISCORD_GUILD_ID=""
```

3. Start the bot:

```bash
bun start
```

The start script runs `src/index.ts`, logs in the bot, and refreshes guild slash commands.

## Project Structure

```text
src/
  commands/
    games/
    users/
    utils/
    commandRegister.ts
  databases/
    userDatabase.ts
    timeoutDatabase.ts
  index.ts
items/
  weapon.json
  armor.json
data/                 # auto-created at runtime (ignored by git)
```

## Contribution

No formal contribution guide is included yet. Small, focused pull requests are easiest to review.

## License

This repository does not currently include a license file.
