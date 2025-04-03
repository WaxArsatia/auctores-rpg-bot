import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ButtonInteraction,
} from 'discord.js';
import armorData from '../../../items/armor.json';
import {
  getRemainingRolls,
  addRollResult,
  hasUserClaimed,
  expireRollByMessageId,
} from '../../databases/timeoutDatabase';
import {
  readUserDatabase,
  writeUserDatabase,
} from '../../databases/userDatabase';

// Helper function to roll a random armor based on rarity
function getRandomArmor() {
  // Define probabilities for each rarity
  const rarityProbabilities = {
    Common: 0.6, // 60% chance
    Uncommon: 0.25, // 25% chance
    Rare: 0.1, // 10% chance
    Epic: 0.04, // 4% chance
    Legendary: 0.008, // 0.8% chance
    Mythic: 0.002, // 0.2% chance
    Divine: 0.0002, // 0.02% chance
  };

  // Roll for rarity
  const rarityRoll = Math.random();
  let cumulativeProbability = 0;
  let selectedRarity = 'Common';

  for (const [rarity, probability] of Object.entries(rarityProbabilities)) {
    cumulativeProbability += probability;
    if (rarityRoll <= cumulativeProbability) {
      selectedRarity = rarity;
      break;
    }
  }

  // Filter armors by rarity
  const armorsOfRarity = armorData.filter(
    (armor) => armor.WeaponRarity === selectedRarity
  );

  // Return a random armor from that rarity
  return armorsOfRarity[Math.floor(Math.random() * armorsOfRarity.length)];
}

// Function to add armor to inventory AND equip it properly
function addArmorToInventoryAndEquip(userId: string, armorId: number): boolean {
  const db = readUserDatabase();
  const userIndex = db.users.findIndex((user) => user.id === userId);

  if (userIndex === -1) return false;

  // Add to inventory if not already there
  if (!db.users[userIndex]!.inventory.armors.includes(armorId)) {
    db.users[userIndex]!.inventory.armors.push(armorId);
  }

  // Set as equipped
  db.users[userIndex]!.equippedArmorId = armorId;
  db.users[userIndex]!.lastUpdated = Date.now();

  // Write changes to database
  writeUserDatabase(db);
  return true;
}

const data = new SlashCommandBuilder()
  .setName('garmor')
  .setDescription('Roll for a random armor');

const execute = async (interaction: ChatInputCommandInteraction) => {
  // Check if user has rolls remaining from the shared pool
  const remainingRolls = getRemainingRolls(interaction.user.id);

  if (remainingRolls <= 0) {
    await interaction.reply({
      content: '❌ You have no rolls remaining. Rolls reset every hour!',
    });
    return;
  }

  // Roll for a random armor
  const armor = getRandomArmor();

  if (!armor) {
    await interaction.reply({
      content: '❌ Error getting armor. Please try again.',
    });
    return;
  }

  // Create embed to show the result
  const embed = new EmbedBuilder()
    .setColor(getRarityColor(armor.WeaponRarity))
    .setTitle(`${interaction.user.username} rolled ${armor.name}!`)
    .setDescription(`This armor is **${armor.WeaponRarity}** rarity!`)
    .addFields({
      name: '🛡️ Armor Stats',
      value:
        `**Defense:** ${armor.ArmorDefend}\n` +
        `**Damage Reduction:** ${armor.ArmorDamageReduction}%\n` +
        `**HP Bonus:** ${armor.ArmorHP}`,
      inline: false,
    })
    .setFooter({
      text: `Rolls remaining: ${
        remainingRolls - 1
      }/5 • Claim expires in 30 seconds`,
    });

  // Create a claim button
  const claimButton = new ButtonBuilder()
    .setCustomId('claim_armor')
    .setLabel('Claim Armor')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🛡️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton);

  // Send the message with the button
  await interaction.reply({
    embeds: [embed],
    components: [row],
  });

  const response = await interaction.fetchReply();

  // Save the roll result with the message ID
  addRollResult(interaction.user.id, 'armor', armor.id, response.id);

  // Create a collector for the button interaction
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000, // 30 seconds
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    // Check if the user has already claimed in this period
    if (hasUserClaimed(i.user.id)) {
      await i.reply({
        content:
          '❌ You have already claimed an item during this period. Claims reset every 3 hours!',
      });
      return;
    }

    try {
      // Use the new function to ensure both inventory update and equipping
      const success = addArmorToInventoryAndEquip(i.user.id, armor.id);

      if (!success) {
        await i.reply({
          content:
            'There was an error claiming this armor. Please try again later.',
        });
        return;
      }

      // Create embed to show the claim
      const claimEmbed = new EmbedBuilder()
        .setColor(getRarityColor(armor.WeaponRarity))
        .setTitle(`${i.user.username} claimed ${armor.name}!`)
        .setDescription(
          `This **${armor.WeaponRarity}** armor has been equipped!${
            i.user.id !== interaction.user.id
              ? `\nOriginally rolled by ${interaction.user.username}`
              : ''
          }`
        )
        .addFields({
          name: '🛡️ Armor Stats',
          value:
            `**Defense:** ${armor.ArmorDefend}\n` +
            `**Damage Reduction:** ${armor.ArmorDamageReduction}%\n` +
            `**HP Bonus:** ${armor.ArmorHP}`,
          inline: false,
        })
        .setFooter({
          text: `You've used your claim for this period. Claims reset every 3 hours.`,
        });

      // Update the original message
      await interaction.editReply({
        embeds: [claimEmbed],
        components: [], // Remove the button
      });

      // Let the user know they've claimed it
      await i.reply({
        content: `✅ You've successfully claimed ${armor.name}!`,
      });

      // Mark as claimed in database
      if (response.id) {
        const claimResult = await import(
          '../../databases/timeoutDatabase'
        ).then((module) => module.claimRollByMessageId(response.id, i.user.id));

        if (!claimResult) {
          console.error('Failed to mark roll as claimed in database');
        }
      }

      // Stop the collector
      collector.stop();
    } catch (error) {
      console.error('Error during claim:', error);
      await i.reply({
        content:
          'There was an error claiming this armor. Please try again later.',
      });
    }
  });

  collector.on('end', async (collected) => {
    // If the button wasn't clicked (no interactions collected)
    if (collected.size === 0) {
      // Mark as expired in database
      if (response.id) {
        expireRollByMessageId(response.id);
      }

      // Update the message to show it expired
      const expiredEmbed = EmbedBuilder.from(embed)
        .setColor(0x888888) // Gray color
        .setDescription(
          `~~${embed.data.description}~~\n\n**This roll has expired!**`
        )
        .setFooter({
          text: `This roll has expired and can no longer be claimed.`,
        });

      await interaction.editReply({
        embeds: [expiredEmbed],
        components: [], // Remove the button
      });
    }
  });
};

// Helper function to get color based on rarity
function getRarityColor(rarity: string): number {
  switch (rarity) {
    case 'Common':
      return 0x888888; // Gray
    case 'Uncommon':
      return 0x00ff00; // Green
    case 'Rare':
      return 0x0000ff; // Blue
    case 'Epic':
      return 0xaa00ff; // Purple
    case 'Legendary':
      return 0xff8000; // Orange
    case 'Mythic':
      return 0xff0000; // Red
    case 'Divine':
      return 0xffff00; // Gold
    default:
      return 0x888888; // Default gray
  }
}

export default { data, execute };
