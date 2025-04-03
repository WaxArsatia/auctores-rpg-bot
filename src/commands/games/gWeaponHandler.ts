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
import weaponData from '../../../items/weapon.json';
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

// Helper function to roll a random weapon based on rarity
function getRandomWeapon() {
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

  // Filter weapons by rarity
  const weaponsOfRarity = weaponData.filter(
    (weapon) => weapon.WeaponRarity === selectedRarity
  );

  // Return a random weapon from that rarity
  return weaponsOfRarity[Math.floor(Math.random() * weaponsOfRarity.length)];
}

// Function to add weapon to inventory AND equip it properly
function addWeaponToInventoryAndEquip(
  userId: string,
  weaponId: number
): boolean {
  const db = readUserDatabase();
  const userIndex = db.users.findIndex((user) => user.id === userId);

  if (userIndex === -1) return false;

  // Add to inventory if not already there
  if (!db.users[userIndex]!.inventory.weapons.includes(weaponId)) {
    db.users[userIndex]!.inventory.weapons.push(weaponId);
  }

  // Set as equipped
  db.users[userIndex]!.equippedWeaponId = weaponId;
  db.users[userIndex]!.lastUpdated = Date.now();

  // Write changes to database
  writeUserDatabase(db);
  return true;
}

const data = new SlashCommandBuilder()
  .setName('gweapon')
  .setDescription('Roll for a random weapon');

const execute = async (interaction: ChatInputCommandInteraction) => {
  // Check if user has rolls remaining
  const remainingRolls = getRemainingRolls(interaction.user.id);

  if (remainingRolls <= 0) {
    await interaction.reply({
      content: '❌ You have no rolls remaining. Rolls reset every hour!',
    });
    return;
  }

  // Roll for a random weapon
  const weapon = getRandomWeapon();

  if (!weapon) {
    await interaction.reply({
      content: '❌ Error getting a weapon. Please try again.',
    });
    return;
  }

  // Create embed to show the result
  const embed = new EmbedBuilder()
    .setColor(getRarityColor(weapon.WeaponRarity))
    .setTitle(`${interaction.user.username} rolled ${weapon.name}!`)
    .setDescription(`This weapon is **${weapon.WeaponRarity}** rarity!`)
    .addFields({
      name: '⚔️ Weapon Stats',
      value:
        `**Damage:** ${weapon.WeaponDamage}\n` +
        `**Critical Chance:** ${weapon.WeaponCritical}%\n` +
        `**Attack Speed:** ${weapon.WeaponAttackSpeed}`,
      inline: false,
    })
    .setFooter({
      text: `Rolls remaining: ${
        remainingRolls - 1
      }/5 • Claim expires in 30 seconds`,
    });

  // Create a claim button
  const claimButton = new ButtonBuilder()
    .setCustomId('claim_weapon')
    .setLabel('Claim Weapon')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⚔️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton);

  // Send the message with the button
  await interaction.reply({
    embeds: [embed],
    components: [row],
  });

  const response = await interaction.fetchReply();

  // Save the roll result with the message ID
  addRollResult(interaction.user.id, 'weapon', weapon.id, response.id);

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
      const success = addWeaponToInventoryAndEquip(i.user.id, weapon.id);

      if (!success) {
        await i.reply({
          content:
            'There was an error claiming this weapon. Please try again later.',
        });
        return;
      }

      // Create embed to show the claim
      const claimEmbed = new EmbedBuilder()
        .setColor(getRarityColor(weapon.WeaponRarity))
        .setTitle(`${i.user.username} claimed ${weapon.name}!`)
        .setDescription(
          `This **${weapon.WeaponRarity}** weapon has been equipped!${
            i.user.id !== interaction.user.id
              ? `\nOriginally rolled by ${interaction.user.username}`
              : ''
          }`
        )
        .addFields({
          name: '⚔️ Weapon Stats',
          value:
            `**Damage:** ${weapon.WeaponDamage}\n` +
            `**Critical Chance:** ${weapon.WeaponCritical}%\n` +
            `**Attack Speed:** ${weapon.WeaponAttackSpeed}`,
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
        content: `✅ You've successfully claimed ${weapon.name}!`,
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
          'There was an error claiming this weapon. Please try again later.',
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
