import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationParser } from './parser.js';

describe('ConversationParser', () => {
  let parser: ConversationParser;

  beforeEach(() => {
    parser = new ConversationParser();
  });

  describe('parseConversationJSON', () => {
    it('should parse valid legacy conversation JSON', () => {
      const legacyConversationJson = JSON.stringify({
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Hello, world!',
            relevantFiles: ['file1.ts'],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      });

      const result = parser.parseConversationJSON(legacyConversationJson);

      expect(result.composerId).toBe('legacy-123');
      expect('conversation' in result).toBe(true);
    });

    it('should parse valid modern conversation JSON', () => {
      const modernConversationJson = JSON.stringify({
        composerId: 'modern-123',
        _v: 2,
        hasLoaded: true,
        text: '',
        richText: '',
        fullConversationHeadersOnly: [
          {
            type: 1,
            bubbleId: 'bubble-1'
          }
        ]
      });

      const result = parser.parseConversationJSON(modernConversationJson);

      expect(result.composerId).toBe('modern-123');
      expect('_v' in result).toBe(true);
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parser.parseConversationJSON(invalidJson))
        .toThrow('Failed to parse conversation JSON');
    });

    it('should throw error for missing composerId', () => {
      const invalidConversation = JSON.stringify({
        conversation: []
      });

      expect(() => parser.parseConversationJSON(invalidConversation))
        .toThrow('Invalid conversation format');
    });

    it('should throw error for invalid conversation structure', () => {
      const invalidConversation = JSON.stringify({
        composerId: 'test',
        conversation: 'not an array'
      });

      expect(() => parser.parseConversationJSON(invalidConversation))
        .toThrow('Invalid conversation format');
    });
  });

  describe('extractMessages', () => {
    it('should extract messages from legacy conversation', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'First message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Second message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const messages = parser.extractMessages(legacyConversation);

      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe('First message');
      expect(messages[1].text).toBe('Second message');
    });

    it('should return empty array for modern conversation', () => {
      const modernConversation = {
        composerId: 'modern-123',
        _v: 2,
        hasLoaded: true,
        text: '',
        richText: '',
        fullConversationHeadersOnly: [
          {
            type: 1,
            bubbleId: 'bubble-1'
          }
        ]
      };

      const messages = parser.extractMessages(modernConversation);

      expect(messages).toHaveLength(0);
    });
  });

  describe('extractCodeBlocks', () => {
    it('should extract code blocks from legacy conversation', () => {
      const codeBlock = {
        language: 'typescript',
        code: 'console.log("Hello");',
        filename: 'test.ts'
      };

      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Message with code',
            relevantFiles: [],
            suggestedCodeBlocks: [codeBlock],
            attachedFoldersNew: []
          }
        ]
      };

      const codeBlocks = parser.extractCodeBlocks(legacyConversation);

      expect(codeBlocks).toHaveLength(1);
      expect(codeBlocks[0]).toEqual(codeBlock);
    });

    it('should return empty array when no code blocks exist', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Message without code',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const codeBlocks = parser.extractCodeBlocks(legacyConversation);

      expect(codeBlocks).toHaveLength(0);
    });

    it('should return empty array for modern conversation', () => {
      const modernConversation = {
        composerId: 'modern-123',
        _v: 2,
        hasLoaded: true,
        text: '',
        richText: '',
        fullConversationHeadersOnly: []
      };

      const codeBlocks = parser.extractCodeBlocks(modernConversation);

      expect(codeBlocks).toHaveLength(0);
    });
  });

  describe('extractFileReferences', () => {
    it('should extract file references from legacy conversation', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'First message',
            relevantFiles: ['file1.ts', 'file2.js'],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Second message',
            relevantFiles: ['file3.py', 'file1.ts'], // Duplicate file1.ts
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const files = parser.extractFileReferences(legacyConversation);

      expect(files).toHaveLength(3);
      expect(files).toContain('file1.ts');
      expect(files).toContain('file2.js');
      expect(files).toContain('file3.py');
      // Should remove duplicates
      expect(files.filter(f => f === 'file1.ts')).toHaveLength(1);
    });

    it('should return empty array when no file references exist', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Message without files',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const files = parser.extractFileReferences(legacyConversation);

      expect(files).toHaveLength(0);
    });
  });

  describe('extractAttachedFolders', () => {
    it('should extract attached folders from legacy conversation', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'First message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: ['src/', 'tests/']
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Second message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: ['docs/', 'src/'] // Duplicate src/
          }
        ]
      };

      const folders = parser.extractAttachedFolders(legacyConversation);

      expect(folders).toHaveLength(3);
      expect(folders).toContain('src/');
      expect(folders).toContain('tests/');
      expect(folders).toContain('docs/');
      // Should remove duplicates
      expect(folders.filter(f => f === 'src/')).toHaveLength(1);
    });

    it('should return empty array when no attached folders exist', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Message without folders',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const folders = parser.extractAttachedFolders(legacyConversation);

      expect(folders).toHaveLength(0);
    });
  });

  describe('extractTimestamps', () => {
    it('should extract valid timestamps from legacy conversation', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'First message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: [],
            timestamp: '2023-01-01T12:00:00Z'
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Second message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: [],
            timestamp: '2023-01-01T13:00:00Z'
          }
        ]
      };

      const timestamps = parser.extractTimestamps(legacyConversation);

      expect(timestamps).toHaveLength(2);
      expect(timestamps[0]).toEqual(new Date('2023-01-01T12:00:00Z'));
      expect(timestamps[1]).toEqual(new Date('2023-01-01T13:00:00Z'));
    });

    it('should skip invalid timestamps', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'First message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: [],
            timestamp: 'invalid-date'
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Second message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: [],
            timestamp: '2023-01-01T13:00:00Z'
          }
        ]
      };

      const timestamps = parser.extractTimestamps(legacyConversation);

      expect(timestamps).toHaveLength(1);
      expect(timestamps[0]).toEqual(new Date('2023-01-01T13:00:00Z'));
    });
  });

  describe('getConversationMetadata', () => {
    it('should return metadata for legacy conversation', () => {
      const codeBlock = {
        language: 'typescript',
        code: 'console.log("Hello");',
        filename: 'test.ts'
      };

      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        storedSummary: 'This is a summary',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Message with code',
            relevantFiles: ['file1.ts', 'file2.js'],
            suggestedCodeBlocks: [codeBlock],
            attachedFoldersNew: ['src/']
          }
        ]
      };

      const metadata = parser.getConversationMetadata(legacyConversation);

      expect(metadata.format).toBe('legacy');
      expect(metadata.messageCount).toBe(1);
      expect(metadata.hasCodeBlocks).toBe(true);
      expect(metadata.codeBlockCount).toBe(1);
      expect(metadata.fileCount).toBe(2);
      expect(metadata.folderCount).toBe(1);
      expect(metadata.hasStoredSummary).toBe(true);
      expect(metadata.size).toBeGreaterThan(0);
    });

    it('should return metadata for modern conversation', () => {
      const modernConversation = {
        composerId: 'modern-123',
        _v: 2,
        hasLoaded: true,
        text: '',
        richText: '',
        fullConversationHeadersOnly: [
          { type: 1, bubbleId: 'bubble-1' },
          { type: 2, bubbleId: 'bubble-2' }
        ]
      };

      const metadata = parser.getConversationMetadata(modernConversation);

      expect(metadata.format).toBe('modern');
      expect(metadata.messageCount).toBe(2);
      expect(metadata.hasCodeBlocks).toBe(false);
      expect(metadata.codeBlockCount).toBe(0);
      expect(metadata.fileCount).toBe(0);
      expect(metadata.folderCount).toBe(0);
      expect(metadata.hasStoredSummary).toBe(false);
      expect(metadata.size).toBeGreaterThan(0);
    });
  });

  describe('searchInConversation', () => {
    it('should find matches in conversation text', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'This is a test message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          },
          {
            type: 2,
            bubbleId: 'bubble-2',
            text: 'Another test with different content',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const results = parser.searchInConversation(legacyConversation, 'test');

      expect(results).toHaveLength(2);
      expect(results[0].messageIndex).toBe(0);
      expect(results[0].message.text).toBe('This is a test message');
      expect(results[0].matchPositions).toContain(10); // Position of 'test'
      expect(results[1].messageIndex).toBe(1);
      expect(results[1].message.text).toBe('Another test with different content');
    });

    it('should handle case sensitive search', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'This is a Test message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const caseSensitiveResults = parser.searchInConversation(legacyConversation, 'test', true);
      const caseInsensitiveResults = parser.searchInConversation(legacyConversation, 'test', false);

      expect(caseSensitiveResults).toHaveLength(0);
      expect(caseInsensitiveResults).toHaveLength(1);
    });
  });

  describe('containsSummarization', () => {
    it('should return true when conversation contains summarization keywords', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'Please summarize this document',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const result = parser.containsSummarization(legacyConversation);

      expect(result).toBe(true);
    });

    it('should return false when conversation does not contain summarization keywords', () => {
      const legacyConversation = {
        composerId: 'legacy-123',
        hasLoaded: true,
        text: '',
        richText: '',
        conversation: [
          {
            type: 1,
            bubbleId: 'bubble-1',
            text: 'This is a regular message',
            relevantFiles: [],
            suggestedCodeBlocks: [],
            attachedFoldersNew: []
          }
        ]
      };

      const result = parser.containsSummarization(legacyConversation);

      expect(result).toBe(false);
    });
  });

  describe('parseBubbleMessage', () => {
    it('should parse valid bubble message JSON', () => {
      const bubbleMessage = {
        type: 1,
        bubbleId: 'bubble-123',
        text: 'Hello from bubble',
        relevantFiles: ['file1.ts'],
        suggestedCodeBlocks: []
      };

      const jsonString = JSON.stringify(bubbleMessage);
      const result = parser.parseBubbleMessage(jsonString);

      expect(result).toEqual(bubbleMessage);
    });

    it('should throw error for invalid bubble message JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parser.parseBubbleMessage(invalidJson))
        .toThrow('Failed to parse bubble message JSON');
    });

    it('should throw error for invalid bubble message structure', () => {
      const invalidBubble = {
        text: 'Missing required fields'
      };

      const jsonString = JSON.stringify(invalidBubble);

      expect(() => parser.parseBubbleMessage(jsonString))
        .toThrow('Invalid bubble message format');
    });
  });
});