import 'dotenv/config';
import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import commandRegister from './commands/commandRegister';

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is not defined in .env file');
}

type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

await commandRegister(client);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
