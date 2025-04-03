import {
  REST,
  Routes,
  type ApplicationCommandData,
  type Client,
} from 'discord.js';
import pingHandler from './utils/pingHandler';
import statsHandler from './users/statsHandler';
import gWeaponHandler from './games/gWeaponHandler';
import gArmorHandler from './games/gArmorHandler';
import timeoutHandler from './users/timeoutHandler';

const commandRegister = async (client: Client<boolean>) => {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is not defined in .env file');
  }
  if (!process.env.DISCORD_APPLICATION_ID) {
    throw new Error('DISCORD_APPLICATION_ID is not defined in .env file');
  }
  if (!process.env.DISCORD_GUILD_ID) {
    throw new Error('DISCORD_GUILD_ID is not defined in .env file');
  }

  const commandRegister = [];

  commandRegister.push(pingHandler);
  commandRegister.push(statsHandler);
  commandRegister.push(gWeaponHandler);
  commandRegister.push(gArmorHandler);
  commandRegister.push(timeoutHandler);

  const commands = [];

  for (const command of commandRegister) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = (await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_APPLICATION_ID,
        process.env.DISCORD_GUILD_ID
      ),
      {
        body: commands,
      }
    )) as ApplicationCommandData[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
};

export default commandRegister;
