# Auctores RPG Bot

A Discord bot that provides RPG gameplay mechanics including character stats, equipment gacha, and inventory management.

## Features

- **Character Stats System**: Track and view character statistics including STR, DEX, AGI, and VIT
- **Equipment Gacha**: Roll for random weapons and armor with varying rarities
- **Equipment Management**: Equip and manage your weapons and armor
- **Timeout System**: Balanced gacha mechanics with hourly roll resets and 3-hour claim cooldowns

## Prerequisites

- [Bun](https://bun.sh) (v1.2.8 or higher)
- Discord Bot Token
- Discord Application ID
- Discord Guild ID

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/auctores-rpg-bot.git
cd auctores-rpg-bot
```

2. Install dependencies:

```bash
bun install
```

3. Create a `.env` file in the project root and add your Discord credentials:

```
DISCORD_TOKEN="your-discord-bot-token"
DISCORD_APPLICATION_ID="your-discord-application-id"
DISCORD_GUILD_ID="your-discord-guild-id"
```

## Running the Bot

Start the bot with:

```bash
bun start
```

## Available Commands

- `/ping` - Check if the bot is online
- `/stats [user]` - View character stats for yourself or another user
- `/timeout` - Check your gacha roll and claim cooldowns
- `/gweapon` - Roll for a random weapon (5 rolls per hour)
- `/garmor` - Roll for a random armor (5 rolls per hour)

## Rarity System

Items come in different rarities with varying probabilities:

- Common (60%)
- Uncommon (25%)
- Rare (10%)
- Epic (4%)
- Legendary (0.8%)
- Mythic (0.2%)
- Divine (0.02%)

## Development

### Project Structure

- `/src` - Source code
  - `/commands` - Bot commands
  - `/databases` - Database management
- `/data` - Local JSON database storage
- `/items` - Equipment data

### Adding New Commands

1. Create a new handler in the appropriate folder under `/src/commands/`
2. Register your command in `/src/commands/commandRegister.ts`
