import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import {
  getUserData,
  getEquippedWeapon,
  getEquippedArmor,
  calculateTotalHP,
} from '../../databases/userDatabase';

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Shows detailed character stats information')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to check stats for (leave empty to check your own)')
      .setRequired(false)
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  // Check if a user was specified, otherwise use the command issuer
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  // Check if target is a bot
  if (targetUser.bot) {
    await interaction.reply({
      content: '❌ Bot accounts do not have stats!',
      ephemeral: true,
    });
    return;
  }

  try {
    // Get user data from database
    const userData = getUserData(targetUser.id, targetUser.username);
    const weapon = getEquippedWeapon(targetUser.id, targetUser.username);
    const armor = getEquippedArmor(targetUser.id, targetUser.username);
    const totalHP = calculateTotalHP(targetUser.id, targetUser.username);

    // Create a rich embed for better presentation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`${targetUser.username}'s Character Stats`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .addFields({
        name: '📊 Character Stats',
        value:
          `**Level:** ${userData.level}\n` +
          `**STR:** ${userData.stats.STR} (Strength - Increases damage)\n` +
          `**DEX:** ${userData.stats.DEX} (Dexterity - Increases critical chance)\n` +
          `**AGI:** ${userData.stats.AGI} (Agility - Increases dodge chance)\n` +
          `**VIT:** ${userData.stats.VIT} (Vitality - Increases health)\n` +
          `**HP:** ${totalHP} (Total health points)`,
        inline: false,
      });

    // Add weapon information if available
    if (weapon) {
      embed.addFields({
        name: '⚔️ Equipped Weapon',
        value:
          `**${weapon.name}** (${weapon.WeaponRarity})\n` +
          `**Damage:** ${weapon.WeaponDamage}\n` +
          `**Critical:** ${weapon.WeaponCritical}%\n` +
          `**Attack Speed:** ${weapon.WeaponAttackSpeed}`,
        inline: true,
      });
    }

    // Add armor information if available
    if (armor) {
      embed.addFields({
        name: '🛡️ Equipped Armor',
        value:
          `**${armor.name}** (${armor.WeaponRarity})\n` +
          `**Defense:** ${armor.ArmorDefend}\n` +
          `**Damage Reduction:** ${armor.ArmorDamageReduction}%\n` +
          `**HP Bonus:** ${armor.ArmorHP}`,
        inline: true,
      });
    }

    // Add inventory summary
    embed.addFields({
      name: '💰 Resources',
      value:
        `**Gold:** ${userData.gold}\n` +
        `**Experience:** ${userData.experience}`,
      inline: false,
    });

    // Add footer with timestamp
    embed.setFooter({
      text: isSelf
        ? 'Your character stats'
        : `Requested by ${interaction.user.username}`,
    });
    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching stats:', error);
    await interaction.reply({
      content:
        'There was an error retrieving character stats. Please try again later.',
    });
  }
};

export default { data, execute };
