/**
 * Custom error classes for the Cursor Conversations MCP server
 */

/**
 * Base error class for all MCP-related errors
 */
export class MCPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'MCP_ERROR', statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends MCPError {
  constructor(message: string, originalError?: Error) {
    super(
      originalError ? `Database error: ${message}. Original: ${originalError.message}` : `Database error: ${message}`,
      'DATABASE_ERROR',
      500
    );

    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Error thrown when database connection fails
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(dbPath: string, originalError?: Error) {
    super(
      `Failed to connect to database at path: ${dbPath}`,
      originalError
    );
    // Override the code property by redefining it
    Object.defineProperty(this, 'code', {
      value: 'DATABASE_CONNECTION_ERROR',
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}

/**
 * Error thrown when a conversation is not found
 */
export class ConversationNotFoundError extends MCPError {
  public readonly conversationId: string;

  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`, 'CONVERSATION_NOT_FOUND', 404);
    this.conversationId = conversationId;
  }
}

/**
 * Error thrown when a bubble message is not found
 */
export class BubbleMessageNotFoundError extends MCPError {
  public readonly composerId: string;
  public readonly bubbleId: string;

  constructor(composerId: string, bubbleId: string) {
    super(
      `Bubble message not found: ${bubbleId} in conversation ${composerId}`,
      'BUBBLE_MESSAGE_NOT_FOUND',
      404
    );
    this.composerId = composerId;
    this.bubbleId = bubbleId;
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends MCPError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(`Validation error: ${message}`, 'VALIDATION_ERROR', 400);
    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when required parameters are missing
 */
export class MissingParameterError extends ValidationError {
  constructor(parameterName: string) {
    super(`Missing required parameter: ${parameterName}`, parameterName);
    Object.defineProperty(this, 'code', {
      value: 'MISSING_PARAMETER',
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}

/**
 * Error thrown when parameter values are invalid
 */
export class InvalidParameterError extends ValidationError {
  constructor(parameterName: string, value: any, expectedType?: string) {
    const message = expectedType
      ? `Invalid parameter '${parameterName}': expected ${expectedType}, got ${typeof value}`
      : `Invalid parameter '${parameterName}': ${value}`;

    super(message, parameterName, value);
    Object.defineProperty(this, 'code', {
      value: 'INVALID_PARAMETER',
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends MCPError {
  public readonly path: string;

  constructor(message: string, path: string, originalError?: Error) {
    super(
      originalError ? `File system error: ${message}. Original: ${originalError.message}` : `File system error: ${message}`,
      'FILESYSTEM_ERROR',
      500
    );
    this.path = path;

    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Error thrown when database path cannot be detected
 */
export class DatabasePathNotFoundError extends FileSystemError {
  constructor(attemptedPaths: string[]) {
    super(
      `Could not find Cursor database. Attempted paths: ${attemptedPaths.join(', ')}`,
      attemptedPaths[0] || 'unknown'
    );
    Object.defineProperty(this, 'code', {
      value: 'DATABASE_PATH_NOT_FOUND',
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}

/**
 * Error thrown when parsing conversation data fails
 */
export class ConversationParseError extends MCPError {
  public readonly conversationId?: string;

  constructor(message: string, conversationId?: string, originalError?: Error) {
    super(
      originalError ? `Parse error: ${message}. Original: ${originalError.message}` : `Parse error: ${message}`,
      'CONVERSATION_PARSE_ERROR',
      500
    );
    this.conversationId = conversationId;

    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Error thrown when search operations fail
 */
export class SearchError extends MCPError {
  public readonly query: string;

  constructor(message: string, query: string, originalError?: Error) {
    super(
      originalError ? `Search error: ${message}. Original: ${originalError.message}` : `Search error: ${message}`,
      'SEARCH_ERROR',
      500
    );
    this.query = query;

    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends MCPError {
  public readonly operation: string;
  public readonly key?: string;

  constructor(message: string, operation: string, key?: string, originalError?: Error) {
    super(
      originalError ? `Cache error: ${message}. Original: ${originalError.message}` : `Cache error: ${message}`,
      'CACHE_ERROR',
      500
    );
    this.operation = operation;
    this.key = key;

    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Utility function to check if an error is an instance of MCPError
 */
export function isMCPError(error: any): error is MCPError {
  return error instanceof MCPError;
}

/**
 * Utility function to extract error information for logging
 */
export function getErrorInfo(error: any): {
  message: string;
  code: string;
  statusCode: number;
  stack?: string;
  originalError?: string;
} {
  // Handle null and undefined
  if (error === null || error === undefined) {
    return {
      message: 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  if (isMCPError(error)) {
    const result: any = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    };

    // Extract original error info for nested errors
    if (error instanceof DatabaseError ||
        error instanceof FileSystemError ||
        error instanceof ConversationParseError ||
        error instanceof SearchError ||
        error instanceof CacheError) {
      // Check if the error message contains "Original: " which indicates a nested error
      const originalMatch = error.message.match(/Original: (.+)$/);
      if (originalMatch) {
        result.originalError = originalMatch[1];
      }
    }

    return result;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      stack: error.stack,
    };
  }

  // Handle objects with toString method
  if (error && typeof error === 'object' && typeof error.toString === 'function') {
    return {
      message: error.toString(),
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}