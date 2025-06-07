/**
 * Validation utilities for MCP tool parameters
 */

import { z } from 'zod';
import {
  ValidationError,
  MissingParameterError,
  InvalidParameterError
} from './errors.js';

/**
 * Validates that a required parameter is present and not empty
 */
export function validateRequired<T>(
  value: T | undefined | null,
  paramName: string
): T {
  if (value === undefined || value === null) {
    throw new MissingParameterError(paramName);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new InvalidParameterError(paramName, value, 'non-empty string');
  }

  return value;
}

/**
 * Validates that a string parameter meets minimum length requirements
 */
export function validateStringLength(
  value: string | undefined,
  paramName: string,
  minLength: number = 1,
  maxLength?: number
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new InvalidParameterError(paramName, value, 'string');
  }

  if (value.length < minLength) {
    throw new InvalidParameterError(
      paramName,
      value,
      `string with at least ${minLength} characters`
    );
  }

  if (maxLength && value.length > maxLength) {
    throw new InvalidParameterError(
      paramName,
      value,
      `string with at most ${maxLength} characters`
    );
  }

  return value;
}

/**
 * Validates that a number parameter is within acceptable range
 */
export function validateNumberRange(
  value: number | undefined,
  paramName: string,
  min?: number,
  max?: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidParameterError(paramName, value, 'number');
  }

  if (min !== undefined && value < min) {
    throw new InvalidParameterError(
      paramName,
      value,
      `number >= ${min}`
    );
  }

  if (max !== undefined && value > max) {
    throw new InvalidParameterError(
      paramName,
      value,
      `number <= ${max}`
    );
  }

  return value;
}

/**
 * Validates that an array parameter meets length requirements
 */
export function validateArrayLength<T>(
  value: T[] | undefined,
  paramName: string,
  minLength: number = 0,
  maxLength?: number
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new InvalidParameterError(paramName, value, 'array');
  }

  if (value.length < minLength) {
    throw new InvalidParameterError(
      paramName,
      value,
      `array with at least ${minLength} items`
    );
  }

  if (maxLength && value.length > maxLength) {
    throw new InvalidParameterError(
      paramName,
      value,
      `array with at most ${maxLength} items`
    );
  }

  return value;
}

/**
 * Validates that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: T | undefined,
  paramName: string,
  allowedValues: readonly T[]
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!allowedValues.includes(value)) {
    throw new InvalidParameterError(
      paramName,
      value,
      `one of: ${allowedValues.join(', ')}`
    );
  }

  return value;
}

/**
 * Validates that a conversation ID has the correct format
 */
export function validateConversationId(conversationId: string): string {
  if (!conversationId || conversationId.trim() === '') {
    throw new MissingParameterError('conversationId');
  }

  validateStringLength(conversationId, 'conversationId', 1, 100);

  // Basic format validation - should be alphanumeric with possible hyphens/underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(conversationId)) {
    throw new InvalidParameterError(
      'conversationId',
      conversationId,
      'alphanumeric string with optional hyphens and underscores'
    );
  }

  return conversationId;
}

/**
 * Validates that a bubble ID has the correct format
 */
export function validateBubbleId(bubbleId: string): string {
  if (!bubbleId || bubbleId.trim() === '') {
    throw new MissingParameterError('bubbleId');
  }

  validateStringLength(bubbleId, 'bubbleId', 1, 100);

  // Basic format validation - should be alphanumeric with possible hyphens/underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(bubbleId)) {
    throw new InvalidParameterError(
      'bubbleId',
      bubbleId,
      'alphanumeric string with optional hyphens and underscores'
    );
  }

  return bubbleId;
}

/**
 * Validates search query parameters
 */
export function validateSearchQuery(query: string): string {
  if (!query || query.trim() === '') {
    throw new MissingParameterError('query');
  }

  validateStringLength(query, 'query', 1, 1000);

  // Ensure query is not just whitespace
  if (query.trim().length === 0) {
    throw new InvalidParameterError(
      'query',
      query,
      'non-empty search query'
    );
  }

  return query.trim();
}

/**
 * Validates file path parameters
 */
export function validateFilePath(path: string | undefined, paramName: string): string | undefined {
  if (path === undefined) {
    return undefined;
  }

  validateStringLength(path, paramName, 1, 1000);

  // Basic path validation - should not contain null bytes or other dangerous characters
  if (path.includes('\0')) {
    throw new InvalidParameterError(
      paramName,
      path,
      'valid file path without null bytes'
    );
  }

  return path;
}

/**
 * Validates project path parameters
 */
export function validateProjectPath(projectPath: string): string {
  if (!projectPath || projectPath.trim() === '') {
    throw new MissingParameterError('projectPath');
  }

  validateStringLength(projectPath, 'projectPath', 1, 1000);

  // Basic path validation
  if (projectPath.includes('\0')) {
    throw new InvalidParameterError(
      'projectPath',
      projectPath,
      'valid project path without null bytes'
    );
  }

  return projectPath;
}

/**
 * Validates and sanitizes input using a Zod schema
 */
export function validateWithSchema<T>(
  input: unknown,
  schema: z.ZodSchema<T>,
  context: string = 'input'
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      const path = firstIssue.path.join('.');
      const field = path || 'root';

      throw new ValidationError(
        `Validation error in ${context}: ${firstIssue.message} at ${field}`,
        field,
        'received' in firstIssue ? firstIssue.received : undefined
      );
    }

    throw new ValidationError(
      `Validation error in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates boolean parameters with proper type checking
 */
export function validateBoolean(
  value: boolean | undefined,
  paramName: string
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new InvalidParameterError(paramName, value, 'boolean');
  }

  return value;
}

/**
 * Validates limit parameters commonly used in pagination
 */
export function validateLimit(limit: number | undefined, defaultLimit: number = 10): number {
  if (limit === undefined) {
    return defaultLimit;
  }

  return validateNumberRange(limit, 'limit', 1, 1000) ?? defaultLimit;
}

/**
 * Validates offset parameters commonly used in pagination
 */
export function validateOffset(offset: number | undefined): number {
  if (offset === undefined) {
    return 0;
  }

  return validateNumberRange(offset, 'offset', 0) ?? 0;
}

/**
 * Validates context lines parameter for search results
 */
export function validateContextLines(contextLines: number | undefined): number {
  if (contextLines === undefined) {
    return 3;
  }

  return validateNumberRange(contextLines, 'contextLines', 0, 10) ?? 3;
}