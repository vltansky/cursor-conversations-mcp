import { homedir, platform } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type { CursorDatabasePaths, DatabaseConfig } from '../database/types.js';

// Platform-specific database paths (lazy-loaded to support testing)
export function getCursorDatabasePaths(): CursorDatabasePaths {
  return {
    macOS: join(homedir(), 'Library/Application Support/Cursor/User/globalStorage/state.vscdb'),
    windows: join(homedir(), 'AppData/Roaming/Cursor/User/globalStorage/state.vscdb'),
    linux: join(homedir(), '.config/Cursor/User/globalStorage/state.vscdb')
  };
}

/**
 * Detect the current operating system
 * @returns The detected operating system as a string
 */
export function detectOperatingSystem(): 'macOS' | 'windows' | 'linux' | 'unknown' {
  const currentPlatform = platform();

  switch (currentPlatform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

/**
 * Get the default database path for a specific operating system
 * @param os The operating system identifier
 * @returns The default database path for the OS
 */
export function getDefaultDatabasePath(os: string): string {
  const paths = getCursorDatabasePaths();
  switch (os) {
    case 'macOS':
    case 'darwin':
      return paths.macOS;
    case 'windows':
    case 'win32':
      return paths.windows;
    case 'linux':
      return paths.linux;
    default:
      // Fallback to Linux path for unknown operating systems
      return paths.linux;
  }
}

/**
 * Check if the database file exists at the specified path
 * @param path The path to verify
 * @returns Object with verification result and optional error message
 */
export function verifyDatabasePath(path: string): { exists: boolean; error?: string } {
  try {
    if (!path) {
      return { exists: false, error: 'Database path is empty' };
    }

    const resolvedPath = resolve(path);
    const exists = existsSync(resolvedPath);

    if (!exists) {
      console.warn(`Database file not found at: ${resolvedPath}`);
      return {
        exists: false,
        error: `Database file not found at: ${resolvedPath}. Make sure Cursor is installed and has been used to create conversations.`
      };
    }

    return { exists: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      exists: false,
      error: `Error verifying database path: ${errorMessage}`
    };
  }
}

/**
 * Get user-configured database path from environment variables or configuration
 * @returns The user-configured path if found, null otherwise
 */
export function getUserConfiguredDatabasePath(): string | null {
  // Check environment variable first
  const envPath = process.env.CURSOR_DB_PATH;
  if (envPath) {
    const resolvedPath = resolve(envPath.replace(/^~/, homedir()));
    const verification = verifyDatabasePath(resolvedPath);
    if (verification.exists) {
      return resolvedPath;
    } else {
      console.warn(`User-configured database path is invalid: ${verification.error}`);
    }
  }

  return null;
}

/**
 * Main function to detect the appropriate Cursor database path
 * Combines all detection mechanisms with proper fallback handling
 * @returns The resolved database path
 * @throws Error if no valid database path can be determined
 */
export function detectDatabasePath(): string {
  // 1. Check for user-configured path first
  const userConfiguredPath = getUserConfiguredDatabasePath();
  if (userConfiguredPath) {
    return userConfiguredPath;
  }

  // 2. Detect OS and use default path
  const os = detectOperatingSystem();
  const defaultPath = getDefaultDatabasePath(os);
  const resolvedPath = resolve(defaultPath);

  // 3. Verify the default path exists
  const verification = verifyDatabasePath(resolvedPath);
  if (verification.exists) {
    return resolvedPath;
  }

  // 4. Implement fallback mechanisms
  console.warn(`Default database path verification failed: ${verification.error}`);

  // Try alternative common locations as fallbacks
  const fallbackPaths = getFallbackDatabasePaths(os);
  for (const fallbackPath of fallbackPaths) {
    const resolvedFallback = resolve(fallbackPath);
    const fallbackVerification = verifyDatabasePath(resolvedFallback);
    if (fallbackVerification.exists) {
      console.log(`Using fallback database path: ${resolvedFallback}`);
      return resolvedFallback;
    }
  }

  // If no valid path found, throw descriptive error
  throw new Error(
    `Unable to locate Cursor database file. Tried:\n` +
    `- User configured: ${process.env.CURSOR_DB_PATH || 'Not set'}\n` +
    `- Default (${os}): ${resolvedPath}\n` +
    `- Fallback paths: ${fallbackPaths.join(', ')}\n\n` +
    `Please ensure Cursor is installed and has been used to create conversations, ` +
    `or set the CURSOR_DB_PATH environment variable to the correct database location.`
  );
}

/**
 * Get fallback database paths for the given operating system
 * @param os The operating system identifier
 * @returns Array of fallback paths to try
 */
function getFallbackDatabasePaths(os: string): string[] {
  const fallbacks: string[] = [];

  switch (os) {
    case 'macOS':
    case 'darwin':
      fallbacks.push(
        join(homedir(), 'Library/Application Support/Cursor/cursor.db'),
        join(homedir(), 'Library/Application Support/Cursor/User/cursor.db'),
        join(homedir(), 'Library/Application Support/Cursor/state.vscdb')
      );
      break;
    case 'windows':
    case 'win32':
      fallbacks.push(
        join(homedir(), 'AppData/Roaming/Cursor/cursor.db'),
        join(homedir(), 'AppData/Roaming/Cursor/User/cursor.db'),
        join(homedir(), 'AppData/Roaming/Cursor/state.vscdb')
      );
      break;
    case 'linux':
      fallbacks.push(
        join(homedir(), '.config/Cursor/cursor.db'),
        join(homedir(), '.config/Cursor/User/cursor.db'),
        join(homedir(), '.config/Cursor/state.vscdb')
      );
      break;
    default:
      // For unknown OS, try Linux-style paths
      fallbacks.push(
        join(homedir(), '.config/Cursor/cursor.db'),
        join(homedir(), '.config/Cursor/User/cursor.db'),
        join(homedir(), '.config/Cursor/state.vscdb')
      );
  }

  return fallbacks;
}

/**
 * Automatically detect the Cursor database path for the current platform
 * @deprecated Use detectDatabasePath() instead for more robust detection
 */
export function detectCursorDatabasePath(): string {
  return detectDatabasePath();
}

/**
 * Validate that the database path exists and is accessible
 * @deprecated Use verifyDatabasePath() instead for consistent error handling
 */
export function validateDatabasePath(dbPath: string): { valid: boolean; error?: string } {
  const verification = verifyDatabasePath(dbPath);
  return {
    valid: verification.exists,
    error: verification.error
  };
}

/**
 * Create default database configuration
 */
export function createDefaultDatabaseConfig(customDbPath?: string): DatabaseConfig {
  const dbPath = customDbPath || detectDatabasePath();

  return {
    dbPath,
    maxConversations: 1000,
    cacheEnabled: true,
    minConversationSize: 100, // Reduced from 5000 to capture more conversations
    resolveBubblesAutomatically: true
  };
}

/**
 * Extract composer ID from a composerData key
 */
export function extractComposerIdFromKey(key: string): string | null {
  const match = key.match(/^composerData:(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract bubble ID components from a bubbleId key
 */
export function extractBubbleIdComponents(key: string): { composerId: string; bubbleId: string } | null {
  const match = key.match(/^bubbleId:([^:]+):(.+)$/);
  return match ? { composerId: match[1], bubbleId: match[2] } : null;
}

/**
 * Generate a bubbleId key for modern format message lookup
 */
export function generateBubbleIdKey(composerId: string, bubbleId: string): string {
  return `bubbleId:${composerId}:${bubbleId}`;
}

/**
 * Check if a key is a composerData key
 */
export function isComposerDataKey(key: string): boolean {
  return key.startsWith('composerData:');
}

/**
 * Check if a key is a bubbleId key
 */
export function isBubbleIdKey(key: string): boolean {
  return key.startsWith('bubbleId:');
}

/**
 * Sanitize and validate conversation size filter
 */
export function sanitizeMinConversationSize(size?: number): number {
  if (typeof size !== 'number' || size < 0) {
    return 100; // Default minimum size (reduced from 5000)
  }
  return Math.floor(size);
}

/**
 * Sanitize and validate limit parameter
 */
export function sanitizeLimit(limit?: number, maxLimit: number = 1000): number {
  if (typeof limit !== 'number' || limit <= 0) {
    return maxLimit; // Default to max limit instead of 10
  }
  return Math.min(Math.floor(limit), maxLimit);
}

/**
 * Create SQL LIKE pattern for file pattern matching
 */
export function createFilePatternLike(pattern: string): string {
  // Escape SQL special characters and convert glob patterns
  return pattern
    .replace(/[%_]/g, '\\$&')  // Escape SQL wildcards
    .replace(/\*/g, '%')       // Convert * to SQL %
    .replace(/\?/g, '_');      // Convert ? to SQL _
}

/**
 * Validate and sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    throw new Error('Search query must be a string');
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new Error('Search query cannot be empty');
  }

  if (trimmed.length > 1000) {
    throw new Error('Search query is too long (max 1000 characters)');
  }

  return trimmed;
}