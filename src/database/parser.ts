import type {
  CursorConversation,
  LegacyCursorConversation,
  ModernCursorConversation,
  ConversationMessage,
  BubbleMessage,
  CodeBlock
} from './types.js';
import {
  isLegacyConversation,
  isModernConversation
} from './types.js';

export class ConversationParser {
  /**
   * Parse conversation JSON data
   */
  parseConversationJSON(rawData: string): CursorConversation {
    try {
      const parsed = JSON.parse(rawData);

      if (!this.isValidConversation(parsed)) {
        throw new Error('Invalid conversation format');
      }

      return parsed as CursorConversation;
    } catch (error) {
      throw new Error(`Failed to parse conversation JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate conversation structure
   */
  private isValidConversation(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (typeof data.composerId !== 'string') {
      return false;
    }

    if (Array.isArray(data.conversation)) {
      return this.isValidLegacyConversation(data);
    }

    if (typeof data._v === 'number' && Array.isArray(data.fullConversationHeadersOnly)) {
      return this.isValidModernConversation(data);
    }

    return false;
  }

  /**
   * Validate legacy conversation format
   */
  private isValidLegacyConversation(data: any): boolean {
    if (!Array.isArray(data.conversation)) {
      return false;
    }

    for (const message of data.conversation) {
      if (!this.isValidMessage(message)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate modern conversation format
   */
  private isValidModernConversation(data: any): boolean {
    if (!Array.isArray(data.fullConversationHeadersOnly)) {
      return false;
    }

    for (const header of data.fullConversationHeadersOnly) {
      if (!this.isValidConversationHeader(header)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate message structure
   */
  private isValidMessage(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'number' &&
      typeof message.bubbleId === 'string' &&
      typeof message.text === 'string'
    );
  }

  /**
   * Validate conversation header structure
   */
  private isValidConversationHeader(header: any): boolean {
    return (
      header &&
      typeof header === 'object' &&
      typeof header.type === 'number' &&
      typeof header.bubbleId === 'string'
    );
  }

  /**
   * Extract messages from conversation (legacy format only)
   */
  extractMessages(conversation: CursorConversation): ConversationMessage[] {
    if (isLegacyConversation(conversation)) {
      return conversation.conversation;
    }

    // For modern format, messages need to be resolved separately
    return [];
  }

  /**
   * Extract code blocks from conversation
   */
  extractCodeBlocks(conversation: CursorConversation): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];

    if (isLegacyConversation(conversation)) {
      for (const message of conversation.conversation) {
        if (message.suggestedCodeBlocks) {
          codeBlocks.push(...message.suggestedCodeBlocks);
        }
      }
    }

    return codeBlocks;
  }

  /**
   * Extract file references from conversation
   */
  extractFileReferences(conversation: CursorConversation): string[] {
    const files: string[] = [];

    if (isLegacyConversation(conversation)) {
      for (const message of conversation.conversation) {
        if (message.relevantFiles) {
          files.push(...message.relevantFiles);
        }
      }
    }

    return Array.from(new Set(files));
  }

  /**
   * Extract attached folder references from conversation
   */
  extractAttachedFolders(conversation: CursorConversation): string[] {
    const folders: string[] = [];

    if (isLegacyConversation(conversation)) {
      for (const message of conversation.conversation) {
        if (message.attachedFoldersNew) {
          folders.push(...message.attachedFoldersNew);
        }
      }
    }

    return Array.from(new Set(folders));
  }

  /**
   * Extract timestamps from conversation (limited availability)
   */
  extractTimestamps(conversation: CursorConversation): Date[] {
    const timestamps: Date[] = [];

    if (isLegacyConversation(conversation)) {
      for (const message of conversation.conversation) {
        if (message.timestamp) {
          try {
            const date = new Date(message.timestamp);
            if (!isNaN(date.getTime())) {
              timestamps.push(date);
            }
          } catch (error) {
            // Skip invalid timestamps
          }
        }
      }
    }

    return timestamps;
  }

  /**
   * Get conversation metadata
   */
  getConversationMetadata(conversation: CursorConversation): {
    format: 'legacy' | 'modern';
    messageCount: number;
    hasCodeBlocks: boolean;
    codeBlockCount: number;
    fileCount: number;
    folderCount: number;
    hasStoredSummary: boolean;
    size: number;
  } {
    const format = isLegacyConversation(conversation) ? 'legacy' : 'modern';
    const size = JSON.stringify(conversation).length;

    let messageCount = 0;
    let codeBlockCount = 0;
    let fileCount = 0;
    let folderCount = 0;

    if (isLegacyConversation(conversation)) {
      messageCount = conversation.conversation.length;

      for (const message of conversation.conversation) {
        if (message.suggestedCodeBlocks) {
          codeBlockCount += message.suggestedCodeBlocks.length;
        }
        if (message.relevantFiles) {
          fileCount += message.relevantFiles.length;
        }
        if (message.attachedFoldersNew) {
          folderCount += message.attachedFoldersNew.length;
        }
      }
    } else if (isModernConversation(conversation)) {
      messageCount = conversation.fullConversationHeadersOnly.length;
      // Note: For modern format, accurate counts would require resolving bubble messages
    }

    const hasCodeBlocks = codeBlockCount > 0;
    const hasStoredSummary = !!(conversation.text || conversation.richText || (conversation as any).storedSummary);

    return {
      format,
      messageCount,
      hasCodeBlocks,
      codeBlockCount,
      fileCount,
      folderCount,
      hasStoredSummary,
      size
    };
  }

  /**
   * Extract user messages only
   */
  extractUserMessages(conversation: CursorConversation): ConversationMessage[] {
    if (isLegacyConversation(conversation)) {
      return conversation.conversation.filter(message => message.type === 1);
    }

    return [];
  }

  /**
   * Extract AI messages only
   */
  extractAIMessages(conversation: CursorConversation): ConversationMessage[] {
    if (isLegacyConversation(conversation)) {
      return conversation.conversation.filter(message => message.type === 2);
    }

    return [];
  }

  /**
   * Get first user message
   */
  getFirstUserMessage(conversation: CursorConversation): ConversationMessage | null {
    if (isLegacyConversation(conversation)) {
      const userMessages = conversation.conversation.filter(message => message.type === 1);
      return userMessages.length > 0 ? userMessages[0] : null;
    }

    return null;
  }

  /**
   * Get last message
   */
  getLastMessage(conversation: CursorConversation): ConversationMessage | null {
    if (isLegacyConversation(conversation)) {
      const messages = conversation.conversation;
      return messages.length > 0 ? messages[messages.length - 1] : null;
    }

    return null;
  }

  /**
   * Search for text within conversation messages
   */
  searchInConversation(conversation: CursorConversation, query: string, caseSensitive: boolean = false): {
    messageIndex: number;
    message: ConversationMessage;
    matchPositions: number[];
  }[] {
    const results: {
      messageIndex: number;
      message: ConversationMessage;
      matchPositions: number[];
    }[] = [];

    if (isLegacyConversation(conversation)) {
      const searchQuery = caseSensitive ? query : query.toLowerCase();

      conversation.conversation.forEach((message, index) => {
        const text = caseSensitive ? message.text : message.text.toLowerCase();
        const matchPositions: number[] = [];

        let position = 0;
        while (position < text.length) {
          const found = text.indexOf(searchQuery, position);
          if (found === -1) break;

          matchPositions.push(found);
          position = found + 1;
        }

        if (matchPositions.length > 0) {
          results.push({
            messageIndex: index,
            message,
            matchPositions
          });
        }
      });
    }

    return results;
  }

  /**
   * Check if conversation contains summarization content
   */
  containsSummarization(conversation: CursorConversation): boolean {
    const summarizationKeywords = ['summarization', 'summarize', 'summary'];

    if (isLegacyConversation(conversation)) {
      for (const message of conversation.conversation) {
        const text = message.text.toLowerCase();
        if (summarizationKeywords.some(keyword => text.includes(keyword))) {
          return true;
        }
      }
    }

    // Also check stored summary fields
    const text = conversation.text?.toLowerCase() || '';
    const richText = conversation.richText?.toLowerCase() || '';

    return summarizationKeywords.some(keyword =>
      text.includes(keyword) || richText.includes(keyword)
    );
  }

  /**
   * Parse bubble message JSON
   */
  parseBubbleMessage(rawData: string): BubbleMessage {
    try {
      const parsed = JSON.parse(rawData);

      if (!this.isValidBubbleMessage(parsed)) {
        throw new Error('Invalid bubble message format');
      }

      return parsed as BubbleMessage;
    } catch (error) {
      throw new Error(`Failed to parse bubble message JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate bubble message structure
   */
  private isValidBubbleMessage(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.type === 'number' &&
      typeof data.text === 'string'
    );
    }
}