import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorDatabaseReader } from './reader.js';
import Database from 'better-sqlite3';

// Mock better-sqlite3
vi.mock('better-sqlite3');

const mockDatabase = vi.mocked(Database);

describe('CursorDatabaseReader', () => {
  let mockDb: any;
  let reader: CursorDatabaseReader;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
      close: vi.fn(),
      exec: vi.fn()
    };

    mockDatabase.mockReturnValue(mockDb);

    reader = new CursorDatabaseReader({
      dbPath: '/test/path/cursor.db',
      minConversationSize: 1000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create reader with default options', () => {
      const defaultReader = new CursorDatabaseReader({ dbPath: '/test/cursor.db' });
      expect(defaultReader).toBeDefined();
    });

    it('should create reader with custom options', () => {
      const customReader = new CursorDatabaseReader({
        dbPath: '/custom/path.db',
        minConversationSize: 5000,
        cacheEnabled: false
      });
      expect(customReader).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);

      await reader.connect();

      expect(mockDatabase).toHaveBeenCalledWith('/test/path/cursor.db', { readonly: true });
      expect(mockDb.exec).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
    });

    it('should handle connection errors', async () => {
      mockDatabase.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(reader.connect()).rejects.toThrow('Database connection failed');
    });

    it('should handle connection with cache disabled', async () => {
      const noCacheReader = new CursorDatabaseReader({
        dbPath: '/test/cursor.db',
        cacheEnabled: false
      });

      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 5 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);

      await noCacheReader.connect();

      expect(mockDatabase).toHaveBeenCalledWith('/test/cursor.db', { readonly: true });
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      reader['db'] = mockDb;
      reader.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle close when not connected', () => {
      expect(() => reader.close()).not.toThrow();
    });
  });

  describe('getConversationIds', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 }),
        all: vi.fn().mockReturnValue([
          { composerId: 'conv1' },
          { composerId: 'conv2' }
        ])
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should get conversation IDs with default filters', async () => {
      const result = await reader.getConversationIds({});

      expect(result).toEqual(['conv1', 'conv2']);
    });

    it('should apply minLength filter', async () => {
      const mockStmt = {
        all: vi.fn().mockReturnValue([{ composerId: 'conv1' }])
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationIds({ minLength: 2000 });

      expect(result).toEqual(['conv1']);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LENGTH(text) >= ?')
      );
    });

    it('should apply keywords filter', async () => {
      const mockStmt = {
        all: vi.fn().mockReturnValue([{ composerId: 'conv1' }])
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationIds({ keywords: ['test', 'query'] });

      expect(result).toEqual(['conv1']);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('text LIKE ?')
      );
    });

    it('should apply format filter', async () => {
      const mockStmt = {
        all: vi.fn().mockReturnValue([{ composerId: 'conv1' }])
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationIds({ format: 'modern' });

      expect(result).toEqual(['conv1']);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('_v IS NOT NULL')
      );
    });
  });

  describe('getConversationById', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should get conversation by ID', async () => {
      const mockConversation = {
        composerId: 'conv1',
        text: 'conversation text',
        conversation: JSON.stringify([{ type: 1, text: 'hello' }])
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockConversation)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationById('conv1');

      expect(result).toEqual({
        composerId: 'conv1',
        text: 'conversation text',
        conversation: [{ type: 1, text: 'hello' }]
      });
      expect(mockStmt.get).toHaveBeenCalledWith('conv1');
    });

    it('should return null for non-existent conversation', async () => {
      const mockStmt = {
        get: vi.fn().mockReturnValue(undefined)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockConversation = {
        composerId: 'conv1',
        text: 'conversation text',
        conversation: 'invalid json'
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockConversation)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationById('conv1');

      expect(result).toEqual({
        composerId: 'conv1',
        text: 'conversation text',
        conversation: []
      });
    });
  });

  describe('getConversationSummary', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should get conversation summary with default options', async () => {
      const mockConversation = {
        composerId: 'conv1',
        text: 'stored summary',
        richText: 'rich text',
        conversation: JSON.stringify([
          { type: 1, text: 'first message' },
          { type: 2, text: 'second message' }
        ])
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockConversation)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationSummary('conv1');

      expect(result).toEqual({
        composerId: 'conv1',
        format: 'legacy',
        messageCount: 2,
        hasCodeBlocks: false,
        conversationSize: expect.any(Number),
        relevantFiles: [],
        attachedFolders: []
      });
    });

    it('should include first message when requested', async () => {
      const mockConversation = {
        composerId: 'conv1',
        conversation: JSON.stringify([
          { type: 1, text: 'This is the first message' }
        ])
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockConversation)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationSummary('conv1', {
        includeFirstMessage: true,
        maxFirstMessageLength: 50
      });

      expect(result?.firstMessage).toBe('This is the first message');
    });

    it('should detect code blocks', async () => {
      const mockConversation = {
        composerId: 'conv1',
        conversation: JSON.stringify([
          {
            type: 1,
            text: 'message',
            suggestedCodeBlocks: [{ language: 'js', code: 'console.log()' }]
          }
        ])
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockConversation)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationSummary('conv1', {
        includeCodeBlockCount: true
      });

      expect(result?.hasCodeBlocks).toBe(true);
      expect(result?.codeBlockCount).toBe(1);
    });

    it('should return null for non-existent conversation', async () => {
      const mockStmt = {
        get: vi.fn().mockReturnValue(undefined)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationSummary('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getBubbleMessage', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should get bubble message', async () => {
      const mockBubble = {
        bubbleId: 'bubble1',
        type: 1,
        text: 'bubble text',
        relevantFiles: JSON.stringify(['file1.ts']),
        suggestedCodeBlocks: JSON.stringify([]),
        attachedFoldersNew: JSON.stringify(['folder1'])
      };

      const mockStmt = {
        get: vi.fn().mockReturnValue(mockBubble)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getBubbleMessage('conv1', 'bubble1');

      expect(result).toEqual({
        bubbleId: 'bubble1',
        type: 1,
        text: 'bubble text',
        relevantFiles: ['file1.ts'],
        suggestedCodeBlocks: [],
        attachedFoldersNew: ['folder1']
      });
    });

    it('should return null for non-existent bubble', async () => {
      const mockStmt = {
        get: vi.fn().mockReturnValue(undefined)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getBubbleMessage('conv1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchConversations', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should search conversations', async () => {
      const mockResults = [
        {
          composerId: 'conv1',
          text: 'conversation with search term',
          conversation: JSON.stringify([
            { type: 1, text: 'message with search term' }
          ])
        }
      ];

      const mockStmt = {
        all: vi.fn().mockReturnValue(mockResults)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.searchConversations('search term');

      expect(result).toHaveLength(1);
      expect(result[0].composerId).toBe('conv1');
      expect(result[0].matches).toBeDefined();
    });

    it('should apply search options', async () => {
      const mockStmt = {
        all: vi.fn().mockReturnValue([])
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await reader.searchConversations('query', {
        maxResults: 5,
        searchType: 'code',
        format: 'modern'
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 5')
      );
    });
  });

  describe('getConversationIdsByProject', () => {
    beforeEach(async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 10 })
      });
      mockDb.prepare.mockReturnValue(mockPrepare);
      await reader.connect();
    });

    it('should get conversations by project path', async () => {
      const mockResults = [
        { composerId: 'conv1', relevanceScore: 0.9 },
        { composerId: 'conv2', relevanceScore: 0.7 }
      ];

      const mockStmt = {
        all: vi.fn().mockReturnValue(mockResults)
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await reader.getConversationIdsByProject('/project/path');

      expect(result).toEqual(mockResults);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('attachedFoldersNew LIKE ?')
      );
    });

    it('should apply project search options', async () => {
      const mockStmt = {
        all: vi.fn().mockReturnValue([])
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await reader.getConversationIdsByProject('/project', {
        filePattern: '*.ts',
        limit: 10,
        orderBy: 'relevance'
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('relevantFiles LIKE ?')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockStmt = {
        get: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        })
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await reader.connect();

      await expect(reader.getConversationById('conv1')).rejects.toThrow('Database error');
    });

    it('should handle missing database connection', async () => {
      const unconnectedReader = new CursorDatabaseReader({ dbPath: '/test/cursor.db' });

      await expect(unconnectedReader.getConversationIds({})).rejects.toThrow();
    });
  });
});