import { describe, it, expect } from 'vitest';
import {
  MCPError,
  DatabaseError,
  DatabaseConnectionError,
  ConversationNotFoundError,
  BubbleMessageNotFoundError,
  ValidationError,
  MissingParameterError,
  InvalidParameterError,
  FileSystemError,
  DatabasePathNotFoundError,
  ConversationParseError,
  SearchError,
  CacheError,
  isMCPError,
  getErrorInfo
} from './errors.js';

describe('Error Utils', () => {
  describe('MCPError', () => {
    it('should create basic MCP error', () => {
      const error = new MCPError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('MCP_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('MCPError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create MCP error with custom code and status', () => {
      const error = new MCPError('Custom message', 'CUSTOM_CODE', 400);

      expect(error.message).toBe('Custom message');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
    });

    it('should maintain proper stack trace', () => {
      const error = new MCPError('Test message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MCPError');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error without original error', () => {
      const error = new DatabaseError('Connection failed');

      expect(error.message).toBe('Database error: Connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error).toBeInstanceOf(MCPError);
      expect(error).toBeInstanceOf(DatabaseError);
    });

    it('should create database error with original error', () => {
      const originalError = new Error('Original error message');
      const error = new DatabaseError('Connection failed', originalError);

      expect(error.message).toBe('Database error: Connection failed. Original: Original error message');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.stack).toContain('Caused by:');
    });

    it('should handle original error without stack', () => {
      const originalError = new Error('Original error message');
      originalError.stack = undefined;
      const error = new DatabaseError('Connection failed', originalError);

      expect(error.message).toBe('Database error: Connection failed. Original: Original error message');
    });
  });

  describe('DatabaseConnectionError', () => {
    it('should create database connection error', () => {
      const dbPath = '/path/to/database.db';
      const error = new DatabaseConnectionError(dbPath);

      expect(error.message).toBe(`Database error: Failed to connect to database at path: ${dbPath}`);
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error).toBeInstanceOf(DatabaseError);
    });

    it('should create database connection error with original error', () => {
      const dbPath = '/path/to/database.db';
      const originalError = new Error('Permission denied');
      const error = new DatabaseConnectionError(dbPath, originalError);

      expect(error.message).toContain('Failed to connect to database at path: /path/to/database.db');
      expect(error.message).toContain('Permission denied');
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
    });
  });

  describe('ConversationNotFoundError', () => {
    it('should create conversation not found error', () => {
      const conversationId = 'conv123';
      const error = new ConversationNotFoundError(conversationId);

      expect(error.message).toBe('Conversation not found: conv123');
      expect(error.code).toBe('CONVERSATION_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.conversationId).toBe(conversationId);
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('BubbleMessageNotFoundError', () => {
    it('should create bubble message not found error', () => {
      const composerId = 'composer123';
      const bubbleId = 'bubble456';
      const error = new BubbleMessageNotFoundError(composerId, bubbleId);

      expect(error.message).toBe('Bubble message not found: bubble456 in conversation composer123');
      expect(error.code).toBe('BUBBLE_MESSAGE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.composerId).toBe(composerId);
      expect(error.bubbleId).toBe(bubbleId);
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error without field info', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Validation error: Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid email format', 'email', 'invalid-email');

      expect(error.message).toBe('Validation error: Invalid email format');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
    });
  });

  describe('MissingParameterError', () => {
    it('should create missing parameter error', () => {
      const error = new MissingParameterError('username');

      expect(error.message).toBe('Validation error: Missing required parameter: username');
      expect(error.code).toBe('MISSING_PARAMETER');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('username');
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('InvalidParameterError', () => {
    it('should create invalid parameter error without expected type', () => {
      const error = new InvalidParameterError('age', 'not-a-number');

      expect(error.message).toBe("Validation error: Invalid parameter 'age': not-a-number");
      expect(error.code).toBe('INVALID_PARAMETER');
      expect(error.field).toBe('age');
      expect(error.value).toBe('not-a-number');
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should create invalid parameter error with expected type', () => {
      const error = new InvalidParameterError('age', 'not-a-number', 'number');

      expect(error.message).toBe("Validation error: Invalid parameter 'age': expected number, got string");
      expect(error.code).toBe('INVALID_PARAMETER');
      expect(error.field).toBe('age');
      expect(error.value).toBe('not-a-number');
    });
  });

  describe('FileSystemError', () => {
    it('should create file system error without original error', () => {
      const path = '/path/to/file';
      const error = new FileSystemError('File not found', path);

      expect(error.message).toBe('File system error: File not found');
      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.path).toBe(path);
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create file system error with original error', () => {
      const path = '/path/to/file';
      const originalError = new Error('Permission denied');
      const error = new FileSystemError('File not found', path, originalError);

      expect(error.message).toBe('File system error: File not found. Original: Permission denied');
      expect(error.path).toBe(path);
      expect(error.stack).toContain('Caused by:');
    });
  });

  describe('DatabasePathNotFoundError', () => {
    it('should create database path not found error', () => {
      const attemptedPaths = ['/path1/db', '/path2/db', '/path3/db'];
      const error = new DatabasePathNotFoundError(attemptedPaths);

      expect(error.message).toBe('File system error: Could not find Cursor database. Attempted paths: /path1/db, /path2/db, /path3/db');
      expect(error.code).toBe('DATABASE_PATH_NOT_FOUND');
      expect(error.path).toBe('/path1/db');
      expect(error).toBeInstanceOf(FileSystemError);
    });

    it('should handle empty attempted paths array', () => {
      const error = new DatabasePathNotFoundError([]);

      expect(error.message).toContain('Could not find Cursor database. Attempted paths: ');
      expect(error.path).toBe('unknown');
    });
  });

  describe('ConversationParseError', () => {
    it('should create conversation parse error without conversation ID', () => {
      const error = new ConversationParseError('Invalid JSON format');

      expect(error.message).toBe('Parse error: Invalid JSON format');
      expect(error.code).toBe('CONVERSATION_PARSE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.conversationId).toBeUndefined();
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create conversation parse error with conversation ID', () => {
      const conversationId = 'conv123';
      const error = new ConversationParseError('Invalid JSON format', conversationId);

      expect(error.message).toBe('Parse error: Invalid JSON format');
      expect(error.conversationId).toBe(conversationId);
    });

    it('should create conversation parse error with original error', () => {
      const originalError = new Error('JSON syntax error');
      const error = new ConversationParseError('Invalid JSON format', 'conv123', originalError);

      expect(error.message).toBe('Parse error: Invalid JSON format. Original: JSON syntax error');
      expect(error.stack).toContain('Caused by:');
    });
  });

  describe('SearchError', () => {
    it('should create search error without original error', () => {
      const query = 'test query';
      const error = new SearchError('Search failed', query);

      expect(error.message).toBe('Search error: Search failed');
      expect(error.code).toBe('SEARCH_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.query).toBe(query);
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create search error with original error', () => {
      const query = 'test query';
      const originalError = new Error('Database timeout');
      const error = new SearchError('Search failed', query, originalError);

      expect(error.message).toBe('Search error: Search failed. Original: Database timeout');
      expect(error.query).toBe(query);
      expect(error.stack).toContain('Caused by:');
    });
  });

  describe('CacheError', () => {
    it('should create cache error without key', () => {
      const operation = 'get';
      const error = new CacheError('Cache miss', operation);

      expect(error.message).toBe('Cache error: Cache miss');
      expect(error.code).toBe('CACHE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.operation).toBe(operation);
      expect(error.key).toBeUndefined();
      expect(error).toBeInstanceOf(MCPError);
    });

    it('should create cache error with key', () => {
      const operation = 'set';
      const key = 'cache-key';
      const error = new CacheError('Cache write failed', operation, key);

      expect(error.message).toBe('Cache error: Cache write failed');
      expect(error.operation).toBe(operation);
      expect(error.key).toBe(key);
    });

    it('should create cache error with original error', () => {
      const originalError = new Error('Memory full');
      const error = new CacheError('Cache write failed', 'set', 'key', originalError);

      expect(error.message).toBe('Cache error: Cache write failed. Original: Memory full');
      expect(error.stack).toContain('Caused by:');
    });
  });

  describe('isMCPError', () => {
    it('should return true for MCP errors', () => {
      expect(isMCPError(new MCPError('test'))).toBe(true);
      expect(isMCPError(new DatabaseError('test'))).toBe(true);
      expect(isMCPError(new ValidationError('test'))).toBe(true);
      expect(isMCPError(new ConversationNotFoundError('test'))).toBe(true);
    });

    it('should return false for non-MCP errors', () => {
      expect(isMCPError(new Error('test'))).toBe(false);
      expect(isMCPError(new TypeError('test'))).toBe(false);
      expect(isMCPError('not an error')).toBe(false);
      expect(isMCPError(null)).toBe(false);
      expect(isMCPError(undefined)).toBe(false);
    });

    it('should return false for objects that look like MCP errors', () => {
      const fakeError = {
        message: 'test',
        code: 'TEST_ERROR',
        statusCode: 400
      };
      expect(isMCPError(fakeError)).toBe(false);
    });
  });

  describe('getErrorInfo', () => {
    it('should extract info from MCP errors', () => {
      const error = new DatabaseError('Database connection failed');
      const info = getErrorInfo(error);

      expect(info.message).toBe('Database error: Database connection failed');
      expect(info.code).toBe('DATABASE_ERROR');
      expect(info.statusCode).toBe(500);
      expect(info.stack).toBeDefined();
      expect(info.originalError).toBeUndefined();
    });

    it('should extract info from regular errors', () => {
      const error = new Error('Regular error');
      const info = getErrorInfo(error);

      expect(info.message).toBe('Regular error');
      expect(info.code).toBe('UNKNOWN_ERROR');
      expect(info.statusCode).toBe(500);
      expect(info.stack).toBeDefined();
    });

    it('should handle non-error objects', () => {
      const info = getErrorInfo('string error');

      expect(info.message).toBe('string error');
      expect(info.code).toBe('UNKNOWN_ERROR');
      expect(info.statusCode).toBe(500);
      expect(info.stack).toBeUndefined();
    });

    it('should handle null and undefined', () => {
      expect(getErrorInfo(null).message).toBe('Unknown error occurred');
      expect(getErrorInfo(undefined).message).toBe('Unknown error occurred');
    });

    it('should handle objects with toString method', () => {
      const obj = {
        toString: () => 'Custom error message'
      };
      const info = getErrorInfo(obj);

      expect(info.message).toBe('Custom error message');
      expect(info.code).toBe('UNKNOWN_ERROR');
    });

    it('should include original error info for nested errors', () => {
      const originalError = new Error('Original error');
      const error = new DatabaseError('Wrapper error', originalError);
      const info = getErrorInfo(error);

      expect(info.originalError).toBe('Original error');
    });
  });
});