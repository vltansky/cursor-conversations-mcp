import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateStringLength,
  validateNumberRange,
  validateArrayLength,
  validateEnum,
  validateConversationId,
  validateBubbleId,
  validateSearchQuery,
  validateFilePath,
  validateProjectPath,
  validateWithSchema,
  validateBoolean,
  validateLimit,
  validateOffset,
  validateContextLines
} from './validation.js';
import {
  MissingParameterError,
  InvalidParameterError,
  ValidationError
} from './errors.js';
import { z } from 'zod';

describe('Validation Utils', () => {
  describe('validateRequired', () => {
    it('should return value when present', () => {
      expect(validateRequired('test', 'param')).toBe('test');
      expect(validateRequired(123, 'param')).toBe(123);
      expect(validateRequired(false, 'param')).toBe(false);
      expect(validateRequired([], 'param')).toEqual([]);
    });

    it('should throw MissingParameterError for undefined', () => {
      expect(() => validateRequired(undefined, 'param')).toThrow(MissingParameterError);
      expect(() => validateRequired(undefined, 'param')).toThrow('Missing required parameter: param');
    });

    it('should throw MissingParameterError for null', () => {
      expect(() => validateRequired(null, 'param')).toThrow(MissingParameterError);
      expect(() => validateRequired(null, 'param')).toThrow('Missing required parameter: param');
    });

    it('should throw InvalidParameterError for empty string', () => {
      expect(() => validateRequired('', 'param')).toThrow(InvalidParameterError);
      expect(() => validateRequired('   ', 'param')).toThrow(InvalidParameterError);
    });
  });

  describe('validateStringLength', () => {
    it('should return undefined for undefined input', () => {
      expect(validateStringLength(undefined, 'param')).toBeUndefined();
    });

    it('should validate string length correctly', () => {
      expect(validateStringLength('test', 'param', 1, 10)).toBe('test');
      expect(validateStringLength('a', 'param', 1, 10)).toBe('a');
      expect(validateStringLength('1234567890', 'param', 1, 10)).toBe('1234567890');
    });

    it('should throw for non-string input', () => {
      expect(() => validateStringLength(123 as any, 'param')).toThrow(InvalidParameterError);
      expect(() => validateStringLength([] as any, 'param')).toThrow(InvalidParameterError);
    });

    it('should throw for string too short', () => {
      expect(() => validateStringLength('', 'param', 1)).toThrow(InvalidParameterError);
      expect(() => validateStringLength('ab', 'param', 3)).toThrow(InvalidParameterError);
    });

    it('should throw for string too long', () => {
      expect(() => validateStringLength('toolong', 'param', 1, 5)).toThrow(InvalidParameterError);
    });

    it('should use default minLength of 1', () => {
      expect(() => validateStringLength('', 'param')).toThrow(InvalidParameterError);
      expect(validateStringLength('a', 'param')).toBe('a');
    });
  });

  describe('validateNumberRange', () => {
    it('should return undefined for undefined input', () => {
      expect(validateNumberRange(undefined, 'param')).toBeUndefined();
    });

    it('should validate number range correctly', () => {
      expect(validateNumberRange(5, 'param', 1, 10)).toBe(5);
      expect(validateNumberRange(1, 'param', 1, 10)).toBe(1);
      expect(validateNumberRange(10, 'param', 1, 10)).toBe(10);
    });

    it('should throw for non-number input', () => {
      expect(() => validateNumberRange('5' as any, 'param')).toThrow(InvalidParameterError);
      expect(() => validateNumberRange(NaN, 'param')).toThrow(InvalidParameterError);
    });

    it('should throw for number too small', () => {
      expect(() => validateNumberRange(0, 'param', 1)).toThrow(InvalidParameterError);
      expect(() => validateNumberRange(-5, 'param', 0, 10)).toThrow(InvalidParameterError);
    });

    it('should throw for number too large', () => {
      expect(() => validateNumberRange(11, 'param', 1, 10)).toThrow(InvalidParameterError);
    });

    it('should work with only min or max specified', () => {
      expect(validateNumberRange(5, 'param', 1)).toBe(5);
      expect(validateNumberRange(5, 'param', undefined, 10)).toBe(5);
    });
  });

  describe('validateArrayLength', () => {
    it('should return undefined for undefined input', () => {
      expect(validateArrayLength(undefined, 'param')).toBeUndefined();
    });

    it('should validate array length correctly', () => {
      expect(validateArrayLength([1, 2, 3], 'param', 1, 5)).toEqual([1, 2, 3]);
      expect(validateArrayLength([], 'param', 0, 5)).toEqual([]);
      expect(validateArrayLength([1], 'param', 1, 1)).toEqual([1]);
    });

    it('should throw for non-array input', () => {
      expect(() => validateArrayLength('not array' as any, 'param')).toThrow(InvalidParameterError);
      expect(() => validateArrayLength(123 as any, 'param')).toThrow(InvalidParameterError);
    });

    it('should throw for array too short', () => {
      expect(() => validateArrayLength([], 'param', 1)).toThrow(InvalidParameterError);
      expect(() => validateArrayLength([1], 'param', 2)).toThrow(InvalidParameterError);
    });

    it('should throw for array too long', () => {
      expect(() => validateArrayLength([1, 2, 3], 'param', 0, 2)).toThrow(InvalidParameterError);
    });

    it('should use default minLength of 0', () => {
      expect(validateArrayLength([], 'param')).toEqual([]);
    });
  });

  describe('validateEnum', () => {
    const allowedValues = ['option1', 'option2', 'option3'] as const;

    it('should return undefined for undefined input', () => {
      expect(validateEnum(undefined, 'param', allowedValues)).toBeUndefined();
    });

    it('should validate enum values correctly', () => {
      expect(validateEnum('option1', 'param', allowedValues)).toBe('option1');
      expect(validateEnum('option2', 'param', allowedValues)).toBe('option2');
      expect(validateEnum('option3', 'param', allowedValues)).toBe('option3');
    });

    it('should throw for invalid enum value', () => {
      expect(() => validateEnum('invalid' as any, 'param', allowedValues)).toThrow(InvalidParameterError);
      expect(() => validateEnum('invalid' as any, 'param', allowedValues))
        .toThrow('one of: option1, option2, option3');
    });
  });

  describe('validateConversationId', () => {
    it('should validate correct conversation IDs', () => {
      expect(validateConversationId('abc123')).toBe('abc123');
      expect(validateConversationId('conversation-id')).toBe('conversation-id');
      expect(validateConversationId('conv_123')).toBe('conv_123');
      expect(validateConversationId('ABC123')).toBe('ABC123');
    });

    it('should throw for empty or missing conversation ID', () => {
      expect(() => validateConversationId('')).toThrow(MissingParameterError);
    });

    it('should throw for invalid characters', () => {
      expect(() => validateConversationId('conv@123')).toThrow(InvalidParameterError);
      expect(() => validateConversationId('conv 123')).toThrow(InvalidParameterError);
      expect(() => validateConversationId('conv.123')).toThrow(InvalidParameterError);
    });

    it('should throw for too long conversation ID', () => {
      const longId = 'a'.repeat(101);
      expect(() => validateConversationId(longId)).toThrow(InvalidParameterError);
    });
  });

  describe('validateBubbleId', () => {
    it('should validate correct bubble IDs', () => {
      expect(validateBubbleId('bubble123')).toBe('bubble123');
      expect(validateBubbleId('bubble-id')).toBe('bubble-id');
      expect(validateBubbleId('bubble_123')).toBe('bubble_123');
    });

    it('should throw for empty or missing bubble ID', () => {
      expect(() => validateBubbleId('')).toThrow(MissingParameterError);
    });

    it('should throw for invalid characters', () => {
      expect(() => validateBubbleId('bubble@123')).toThrow(InvalidParameterError);
      expect(() => validateBubbleId('bubble 123')).toThrow(InvalidParameterError);
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate correct search queries', () => {
      expect(validateSearchQuery('test query')).toBe('test query');
      expect(validateSearchQuery('a')).toBe('a');
    });

    it('should throw for empty query', () => {
      expect(() => validateSearchQuery('')).toThrow(MissingParameterError);
    });

    it('should throw for too long query', () => {
      const longQuery = 'a'.repeat(1001);
      expect(() => validateSearchQuery(longQuery)).toThrow(InvalidParameterError);
    });
  });

  describe('validateFilePath', () => {
    it('should return undefined for undefined input', () => {
      expect(validateFilePath(undefined, 'param')).toBeUndefined();
    });

    it('should validate correct file paths', () => {
      expect(validateFilePath('/path/to/file.txt', 'param')).toBe('/path/to/file.txt');
      expect(validateFilePath('relative/path.js', 'param')).toBe('relative/path.js');
      expect(validateFilePath('file.ts', 'param')).toBe('file.ts');
    });

    it('should throw for empty path', () => {
      expect(() => validateFilePath('', 'param')).toThrow(InvalidParameterError);
    });

    it('should throw for too long path', () => {
      const longPath = 'a'.repeat(1001);
      expect(() => validateFilePath(longPath, 'param')).toThrow(InvalidParameterError);
    });
  });

  describe('validateProjectPath', () => {
    it('should validate correct project paths', () => {
      expect(validateProjectPath('/project/path')).toBe('/project/path');
      expect(validateProjectPath('relative/project')).toBe('relative/project');
    });

    it('should throw for empty path', () => {
      expect(() => validateProjectPath('')).toThrow(MissingParameterError);
    });

    it('should throw for too long path', () => {
      const longPath = 'a'.repeat(1001);
      expect(() => validateProjectPath(longPath)).toThrow(InvalidParameterError);
    });
  });

  describe('validateWithSchema', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().min(0)
    });

    it('should validate correct input', () => {
      const input = { name: 'John', age: 30 };
      expect(validateWithSchema(input, testSchema)).toEqual(input);
    });

    it('should throw ValidationError for invalid input', () => {
      const input = { name: 'John', age: -5 };
      expect(() => validateWithSchema(input, testSchema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing fields', () => {
      const input = { name: 'John' };
      expect(() => validateWithSchema(input, testSchema)).toThrow(ValidationError);
    });

    it('should include context in error message', () => {
      const input = { name: 'John', age: -5 };
      expect(() => validateWithSchema(input, testSchema, 'user data'))
        .toThrow('Validation error in user data');
    });
  });

  describe('validateBoolean', () => {
    it('should return undefined for undefined input', () => {
      expect(validateBoolean(undefined, 'param')).toBeUndefined();
    });

    it('should validate boolean values', () => {
      expect(validateBoolean(true, 'param')).toBe(true);
      expect(validateBoolean(false, 'param')).toBe(false);
    });

    it('should throw for non-boolean input', () => {
      expect(() => validateBoolean('true' as any, 'param')).toThrow(InvalidParameterError);
      expect(() => validateBoolean(1 as any, 'param')).toThrow(InvalidParameterError);
    });
  });

  describe('validateLimit', () => {
    it('should return default limit for undefined input', () => {
      expect(validateLimit(undefined)).toBe(10);
      expect(validateLimit(undefined, 20)).toBe(20);
    });

    it('should validate correct limits', () => {
      expect(validateLimit(5)).toBe(5);
      expect(validateLimit(100)).toBe(100);
    });

    it('should throw for invalid limits', () => {
      expect(() => validateLimit(0)).toThrow(InvalidParameterError);
      expect(() => validateLimit(-5)).toThrow(InvalidParameterError);
      expect(() => validateLimit(1001)).toThrow(InvalidParameterError);
    });
  });

  describe('validateOffset', () => {
    it('should return 0 for undefined input', () => {
      expect(validateOffset(undefined)).toBe(0);
    });

    it('should validate correct offsets', () => {
      expect(validateOffset(0)).toBe(0);
      expect(validateOffset(50)).toBe(50);
    });

    it('should throw for negative offset', () => {
      expect(() => validateOffset(-1)).toThrow(InvalidParameterError);
    });
  });

  describe('validateContextLines', () => {
    it('should return 3 for undefined input', () => {
      expect(validateContextLines(undefined)).toBe(3);
    });

    it('should validate correct context lines', () => {
      expect(validateContextLines(0)).toBe(0);
      expect(validateContextLines(5)).toBe(5);
      expect(validateContextLines(10)).toBe(10);
    });

    it('should throw for invalid context lines', () => {
      expect(() => validateContextLines(-1)).toThrow(InvalidParameterError);
      expect(() => validateContextLines(11)).toThrow(InvalidParameterError);
    });
  });
});