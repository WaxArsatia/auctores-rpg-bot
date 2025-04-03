import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.reply('Pong!');
};

const pingHandler = {
  data,
  execute,
};

export default pingHandler;
