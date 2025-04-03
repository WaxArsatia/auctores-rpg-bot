import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Type definitions for proper type safety
export interface RollResult {
  id: string; // ID of the user who rolled
  item: {
    type: 'weapon' | 'armor';
    itemId: number;
  };
  timestamp: number; // When the roll was performed
  claimed: boolean;
  expired: boolean; // Whether the roll has expired
  claimedBy?: string; // ID of the user who claimed the roll, if any
  claimedAt?: number; // When the roll was claimed, if at all
  messageId?: string; // ID of the message containing the roll result
}

export interface TimeoutData {
  lastRollReset: number; // Timestamp of the last roll reset
  lastClaimReset: number; // Timestamp of the last claim reset
  rollResults: RollResult[]; // All roll results that haven't been claimed yet
}

// Database configuration
const DB_DIR = path.join(process.cwd(), 'data');
const TIMEOUT_DB_PATH = path.join(DB_DIR, 'timeouts.json');

// Constants
export const ROLLS_PER_HOUR = 5;
export const ROLL_RESET_MS = 60 * 60 * 1000; // 1 hour in milliseconds
export const CLAIM_RESET_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
export const ROLL_EXPIRY_MS = 30 * 1000; // 30 seconds in milliseconds
export const MAX_ROLL_HISTORY = 100; // Maximum number of rolls to keep in history

// Initialize the database directory and file if they don't exist
export function initializeTimeoutDatabase(): void {
  try {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
      console.log(`Created database directory at ${DB_DIR}`);
    }

    if (!existsSync(TIMEOUT_DB_PATH)) {
      const initialData: TimeoutData = {
        lastRollReset: Date.now(),
        lastClaimReset: Date.now(),
        rollResults: [],
      };
      writeFileSync(
        TIMEOUT_DB_PATH,
        JSON.stringify(initialData, null, 2),
        'utf-8'
      );
      console.log(`Created new timeout database file at ${TIMEOUT_DB_PATH}`);
    }
  } catch (error) {
    console.error('Error initializing timeout database:', error);
    throw new Error('Failed to initialize timeout database');
  }
}

// Read timeout data from the database
export function readTimeoutDatabase(): TimeoutData {
  try {
    initializeTimeoutDatabase();
    const data = readFileSync(TIMEOUT_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading timeout database:', error);
    // Return default data if there's an error
    return {
      lastRollReset: Date.now(),
      lastClaimReset: Date.now(),
      rollResults: [],
    };
  }
}

// Write timeout data to the database
export function writeTimeoutDatabase(data: TimeoutData): void {
  try {
    initializeTimeoutDatabase();
    writeFileSync(TIMEOUT_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to timeout database:', error);
    throw new Error('Failed to write to timeout database');
  }
}

// Check if rolls need to be reset and update the timestamp if needed
export function checkAndUpdateRollReset(): void {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();

  // If more than ROLL_RESET_MS has passed since the last reset
  if (now - timeoutData.lastRollReset > ROLL_RESET_MS) {
    timeoutData.lastRollReset = now;
    writeTimeoutDatabase(timeoutData);
    console.log('Roll count reset for all users');
  }
}

// Check if claims need to be reset and update the timestamp if needed
export function checkAndUpdateClaimReset(): void {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();

  // If more than CLAIM_RESET_MS has passed since the last reset
  if (now - timeoutData.lastClaimReset > CLAIM_RESET_MS) {
    timeoutData.lastClaimReset = now;
    writeTimeoutDatabase(timeoutData);
    console.log('Claim availability reset for all users');
  }
}

// Get the number of rolls a user has used in the current period
export function getUserRollCount(userId: string): number {
  checkAndUpdateRollReset();
  const timeoutData = readTimeoutDatabase();

  return timeoutData.rollResults.filter(
    (result) =>
      result.id === userId && result.timestamp > timeoutData.lastRollReset
  ).length;
}

// Get if a user has claimed in the current period
export function hasUserClaimed(userId: string): boolean {
  checkAndUpdateClaimReset();
  const timeoutData = readTimeoutDatabase();

  return timeoutData.rollResults.some(
    (result) =>
      result.claimedBy === userId &&
      (result.claimedAt ?? 0) > timeoutData.lastClaimReset
  );
}

// Get the number of rolls remaining for a user
export function getRemainingRolls(userId: string): number {
  const usedRolls = getUserRollCount(userId);
  return Math.max(0, ROLLS_PER_HOUR - usedRolls);
}

// Add a roll result to the database
export function addRollResult(
  userId: string,
  itemType: 'weapon' | 'armor',
  itemId: number,
  messageId?: string
): RollResult {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();

  // Create the roll result
  const rollResult: RollResult = {
    id: userId,
    item: {
      type: itemType,
      itemId: itemId,
    },
    timestamp: now,
    claimed: false,
    expired: false,
    messageId,
  };

  // Add to the beginning of the array (most recent first)
  timeoutData.rollResults.unshift(rollResult);

  // Trim the array if it gets too long
  if (timeoutData.rollResults.length > MAX_ROLL_HISTORY) {
    timeoutData.rollResults = timeoutData.rollResults.slice(
      0,
      MAX_ROLL_HISTORY
    );
  }

  writeTimeoutDatabase(timeoutData);
  return rollResult;
}

// Get unclaimed roll results for all users, sorted by most recent
export function getUnclaimedRolls(): RollResult[] {
  const timeoutData = readTimeoutDatabase();
  return timeoutData.rollResults
    .filter((result) => !result.claimed && !result.expired)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Check and expire rolls that are older than ROLL_EXPIRY_MS
export function checkAndExpireRolls(): void {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();
  let updated = false;

  timeoutData.rollResults.forEach((roll) => {
    if (
      !roll.claimed &&
      !roll.expired &&
      now - roll.timestamp > ROLL_EXPIRY_MS
    ) {
      roll.expired = true;
      updated = true;
    }
  });

  if (updated) {
    writeTimeoutDatabase(timeoutData);
  }
}

// Get a specific roll by message ID
export function getRollByMessageId(messageId: string): RollResult | null {
  const timeoutData = readTimeoutDatabase();
  return (
    timeoutData.rollResults.find((roll) => roll.messageId === messageId) || null
  );
}

// Claim a roll result by message ID
export function claimRollByMessageId(
  messageId: string,
  claimerId: string
): RollResult | null {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();

  const rollIndex = timeoutData.rollResults.findIndex(
    (roll) => roll.messageId === messageId && !roll.claimed && !roll.expired
  );

  if (rollIndex === -1) {
    return null;
  }

  // Update the roll
  timeoutData.rollResults[rollIndex]!.claimed = true;
  timeoutData.rollResults[rollIndex]!.claimedBy = claimerId;
  timeoutData.rollResults[rollIndex]!.claimedAt = now;

  writeTimeoutDatabase(timeoutData);
  return timeoutData.rollResults[rollIndex]!;
}

// Mark a roll as expired by message ID
export function expireRollByMessageId(messageId: string): boolean {
  const timeoutData = readTimeoutDatabase();

  const rollIndex = timeoutData.rollResults.findIndex(
    (roll) => roll.messageId === messageId && !roll.claimed && !roll.expired
  );

  if (rollIndex === -1) {
    return false;
  }

  // Mark as expired
  timeoutData.rollResults[rollIndex]!.expired = true;

  writeTimeoutDatabase(timeoutData);
  return true;
}

// Claim a roll result
export function claimRollResult(
  rollIndex: number,
  claimerId: string
): RollResult | null {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();

  // Find unclaimed rolls
  const unclaimedRolls = getUnclaimedRolls();

  // Check if the index is valid
  if (rollIndex < 0 || rollIndex >= unclaimedRolls.length) {
    return null;
  }

  // Get the roll to claim
  const rollToClaim = unclaimedRolls[rollIndex];

  // Find the actual index in the main array
  const actualIndex = timeoutData.rollResults.findIndex(
    (r) =>
      r.id === rollToClaim!.id &&
      r.timestamp === rollToClaim!.timestamp &&
      !r.claimed
  );

  if (actualIndex === -1) {
    return null;
  }

  // Update the roll
  timeoutData.rollResults[actualIndex]!.claimed = true;
  timeoutData.rollResults[actualIndex]!.claimedBy = claimerId;
  timeoutData.rollResults[actualIndex]!.claimedAt = now;

  writeTimeoutDatabase(timeoutData);
  return timeoutData.rollResults[actualIndex]!;
}

// Get time remaining until next roll reset
export function getTimeUntilRollReset(): number {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();
  const nextReset = timeoutData.lastRollReset + ROLL_RESET_MS;
  return Math.max(0, nextReset - now);
}

// Get time remaining until next claim reset
export function getTimeUntilClaimReset(): number {
  const timeoutData = readTimeoutDatabase();
  const now = Date.now();
  const nextReset = timeoutData.lastClaimReset + CLAIM_RESET_MS;
  return Math.max(0, nextReset - now);
}

// Format milliseconds into human-readable time
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) {
    return 'Available now';
  }

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

// Initialize database on module load
initializeTimeoutDatabase();
