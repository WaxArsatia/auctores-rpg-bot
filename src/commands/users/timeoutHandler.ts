import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import {
  getRemainingRolls,
  hasUserClaimed,
  getTimeUntilRollReset,
  getTimeUntilClaimReset,
  formatTimeRemaining,
} from '../../databases/timeoutDatabase';

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Shows detailed gacha timeout information');

const execute = async (interaction: ChatInputCommandInteraction) => {
  const targetUser = interaction.user;

  try {
    // Get timeout information
    const remainingRolls = getRemainingRolls(targetUser.id);
    const hasClaimedThisPeriod = hasUserClaimed(targetUser.id);
    const timeUntilRollReset = getTimeUntilRollReset();
    const timeUntilClaimReset = getTimeUntilClaimReset();

    // Create a rich embed for better presentation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`${targetUser.username}'s Gacha Timeouts`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .addFields({
        name: '🎲 Rolls (Shared between Weapon & Armor)',
        value:
          `**Remaining Rolls:** ${remainingRolls}/5\n` +
          `**Reset In:** ${formatTimeRemaining(timeUntilRollReset)}`,
        inline: false,
      })
      .addFields({
        name: '🏆 Claims',
        value:
          `**Claim Available:** ${
            !hasClaimedThisPeriod ? 'Yes ✅' : 'No ❌'
          }\n` +
          `**Reset In:** ${
            hasClaimedThisPeriod
              ? formatTimeRemaining(timeUntilClaimReset)
              : 'Available now'
          }`,
        inline: false,
      });

    // Add note about 30-second expiry
    embed.setDescription('Note: Unclaimed rolls expire after 30 seconds!');

    // Add footer with timestamp
    embed.setFooter({
      text: 'Your gacha timeouts',
    });
    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching timeout info:', error);
    await interaction.reply({
      content:
        'There was an error retrieving gacha timeout information. Please try again later.',
    });
  }
};

export default { data, execute };
