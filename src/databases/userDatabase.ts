import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Import weapon and armor data
import weaponData from '../../items/weapon.json';
import armorData from '../../items/armor.json';

// Type definitions for proper type safety
export interface UserStats {
  STR: number;
  DEX: number;
  AGI: number;
  VIT: number;
}

export interface Weapon {
  id: number;
  name: string;
  WeaponDamage: number;
  WeaponCritical: number;
  WeaponAttackSpeed: number;
  WeaponRarity: string;
}

export interface Armor {
  id: number;
  name: string;
  ArmorDefend: number;
  ArmorDamageReduction: number;
  ArmorHP: number;
  WeaponRarity: string;
}

export interface UserData {
  id: string;
  username: string;
  stats: UserStats;
  level: number;
  experience: number;
  gold: number;
  equippedWeaponId: number;
  equippedArmorId: number;
  inventory: {
    weapons: number[];
    armors: number[];
  };
  lastUpdated: number;
}

// Database configuration
const DB_DIR = path.join(process.cwd(), 'data');
const USER_DB_PATH = path.join(DB_DIR, 'users.json');

// Default values for new users
const DEFAULT_STATS_VALUE = 5;
const DEFAULT_WEAPON_ID = 1; // Wooden Sword
const DEFAULT_ARMOR_ID = 1; // Wooden Armor

// Initialize the database directory and file if they don't exist
export function initializeDatabase(): void {
  try {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
      console.log(`Created database directory at ${DB_DIR}`);
    }

    if (!existsSync(USER_DB_PATH)) {
      writeFileSync(USER_DB_PATH, JSON.stringify({ users: [] }), 'utf-8');
      console.log(`Created new users database file at ${USER_DB_PATH}`);
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw new Error('Failed to initialize database');
  }
}

// Read all user data from the database
export function readUserDatabase(): { users: UserData[] } {
  try {
    initializeDatabase();
    const data = readFileSync(USER_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading user database:', error);
    return { users: [] };
  }
}

// Write user data to the database
export function writeUserDatabase(data: { users: UserData[] }): void {
  try {
    initializeDatabase();
    writeFileSync(USER_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to user database:', error);
    throw new Error('Failed to write to database');
  }
}

// Get a user by their Discord ID, creating a new entry if they don't exist
export function getUserData(userId: string, username: string): UserData {
  const db = readUserDatabase();
  let userData = db.users.find((user) => user.id === userId);

  if (!userData) {
    userData = createNewUser(userId, username);
    db.users.push(userData);
    writeUserDatabase(db);
    console.log(`Created new user: ${username} (${userId})`);
  } else if (userData.username !== username) {
    // Update username if it changed
    userData.username = username;
    writeUserDatabase(db);
  }

  return userData;
}

// Create a new user with default values
export function createNewUser(userId: string, username: string): UserData {
  return {
    id: userId,
    username: username,
    stats: {
      STR: DEFAULT_STATS_VALUE,
      DEX: DEFAULT_STATS_VALUE,
      AGI: DEFAULT_STATS_VALUE,
      VIT: DEFAULT_STATS_VALUE,
    },
    level: 1,
    experience: 0,
    gold: 100,
    equippedWeaponId: DEFAULT_WEAPON_ID,
    equippedArmorId: DEFAULT_ARMOR_ID,
    inventory: {
      weapons: [DEFAULT_WEAPON_ID],
      armors: [DEFAULT_ARMOR_ID],
    },
    lastUpdated: Date.now(),
  };
}

// Get the equipped weapon for a user
export function getEquippedWeapon(
  userId: string,
  username: string
): Weapon | undefined {
  const userData = getUserData(userId, username);
  return weaponData.find((weapon) => weapon.id === userData.equippedWeaponId);
}

// Get the equipped armor for a user
export function getEquippedArmor(
  userId: string,
  username: string
): Armor | undefined {
  const userData = getUserData(userId, username);
  return armorData.find((armor) => armor.id === userData.equippedArmorId);
}

// Update user stats
export function updateUserStats(
  userId: string,
  stats: Partial<UserStats>
): void {
  const db = readUserDatabase();
  const userIndex = db.users.findIndex((user) => user.id === userId);

  if (userIndex !== -1) {
    db.users[userIndex]!.stats = {
      ...db.users[userIndex]!.stats,
      ...stats,
    };
    db.users[userIndex]!.lastUpdated = Date.now();
    writeUserDatabase(db);
  }
}

// Equip a weapon for a user
export function equipWeapon(userId: string, weaponId: number): boolean {
  const db = readUserDatabase();
  const userIndex = db.users.findIndex((user) => user.id === userId);

  if (
    userIndex !== -1 &&
    db.users[userIndex]!.inventory.weapons.includes(weaponId)
  ) {
    db.users[userIndex]!.equippedWeaponId = weaponId;
    db.users[userIndex]!.lastUpdated = Date.now();
    writeUserDatabase(db);
    return true;
  }

  return false;
}

// Equip an armor for a user
export function equipArmor(userId: string, armorId: number): boolean {
  const db = readUserDatabase();
  const userIndex = db.users.findIndex((user) => user.id === userId);

  if (
    userIndex !== -1 &&
    db.users[userIndex]!.inventory.armors.includes(armorId)
  ) {
    db.users[userIndex]!.equippedArmorId = armorId;
    db.users[userIndex]!.lastUpdated = Date.now();
    writeUserDatabase(db);
    return true;
  }

  return false;
}

// Calculate total health points based on VIT and armor
export function calculateTotalHP(userId: string, username: string): number {
  const userData = getUserData(userId, username);
  const armor = getEquippedArmor(userId, username);

  const baseHP = 50 + userData.stats.VIT * 10;
  const armorHP = armor ? armor.ArmorHP : 0;

  return baseHP + armorHP;
}

// Initialize database on module load
initializeDatabase();
