// Type definitions for Cursor chat data
// Supports both legacy and modern conversation formats

export interface CursorDiskKV {
  key: string;
  value: string;
}

// Key patterns in the Cursor database
export type CursorKeyPatterns = {
  composerData: `composerData:${string}`;
  bubbleId: `bubbleId:${string}:${string}`;
  messageRequestContext: `messageRequestContext:${string}:${string}`;
  checkpointId: `checkpointId:${string}`;
  codeBlockDiff: `codeBlockDiff:${string}`;
};

// Legacy format conversation structure
export interface LegacyCursorConversation {
  composerId: string;
  conversation: ConversationMessage[];
  hasLoaded: boolean;
  text: string;                        // May contain conversation summary (often empty)
  richText: string;                    // May contain formatted summary (often empty)
}

// Modern format conversation structure
export interface ModernCursorConversation {
  _v: number;                          // Version field (e.g., 3)
  composerId: string;
  richText: string;                    // May contain formatted summary (often empty)
  hasLoaded: boolean;
  text: string;                        // May contain conversation summary (often empty)
  fullConversationHeadersOnly: ConversationHeader[];
  name?: string;                       // Conversation title (Modern format only)
  latestConversationSummary?: {        // AI-generated summary structure
    summary: {
      summary: string;                 // The actual AI-generated summary text
    };
  };
}

// Union type for both conversation formats
export type CursorConversation = LegacyCursorConversation | ModernCursorConversation;

// Message structure for legacy format
export interface ConversationMessage {
  type: number;                        // 1 = user, 2 = AI
  bubbleId: string;
  attachedFoldersNew: string[];
  suggestedCodeBlocks: CodeBlock[];
  relevantFiles: string[];
  text: string;                        // Message content
  timestamp?: string;
}

// Header structure for modern format
export interface ConversationHeader {
  bubbleId: string;
  type: number;                        // 1 = user, 2 = AI
  serverBubbleId?: string;             // For AI responses
}

// Individual message for modern format (stored separately)
export interface BubbleMessage {
  text: string;                        // Message content
  type: number;
  attachedFoldersNew?: string[];
  suggestedCodeBlocks?: CodeBlock[];
  relevantFiles?: string[];
  timestamp?: string;
}

// Code block structure
export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

// Conversation summary data
export interface ConversationSummary {
  composerId: string;
  format: 'legacy' | 'modern';
  messageCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  relevantFiles: string[];
  attachedFolders: string[];
  firstMessage?: string;               // Truncated first user message
  lastMessage?: string;                // Last message in conversation
  storedSummary?: string;              // From text field if available
  storedRichText?: string;             // From richText field if available
  title?: string;                      // From 'name' field (Modern format only)
  aiGeneratedSummary?: string;         // From 'latestConversationSummary.summary.summary'
  conversationSize: number;            // Size in bytes
}

// Search result structure
export interface ConversationSearchResult {
  composerId: string;
  format: 'legacy' | 'modern';
  matches: SearchMatch[];
  relevantFiles: string[];
  attachedFolders: string[];
  maxLastMessageLength?: number;             // Max length for last message
  includeStoredSummary?: boolean;            // Include text/richText fields
  includeFileList?: boolean;                 // Include relevant files
  includeCodeBlockCount?: boolean;           // Count code blocks
  includeAttachedFolders?: boolean;          // Include attached folders
  includeMetadata?: boolean;                 // Include metadata information
  includeTitle?: boolean;                    // Include conversation title (Modern format)
  includeAIGeneratedSummary?: boolean;       // Include AI-generated summary (Modern format)
}

export interface SearchMatch {
  messageIndex?: number;               // For legacy format
  bubbleId?: string;                   // For modern format
  text: string;
  context: string;                     // Surrounding text
  type: number;                        // 1 = user, 2 = AI
}

// Statistics structure
export interface ConversationStats {
  totalConversations: number;
  legacyFormatCount: number;
  modernFormatCount: number;
  averageConversationSize: number;
  totalConversationsWithCode: number;
  mostCommonFiles: Array<{ file: string; count: number }>;
  mostCommonFolders: Array<{ folder: string; count: number }>;
}

// Filter options for conversation queries
export interface ConversationFilters {
  dateRange?: { start: Date; end: Date };    // ⚠️ Limited - no reliable timestamps
  minLength?: number;                        // Filter by conversation size
  keywords?: string[];                       // Search in conversation content
  projectPath?: string;                      // Filter by attached folders
  relevantFiles?: string[];                  // Filter by specific files mentioned
  filePattern?: string;                      // Filter by file pattern (e.g., "*.tsx")
  hasCodeBlocks?: boolean;                   // Filter conversations with code
  format?: 'legacy' | 'modern' | 'both';    // Filter by conversation format
}

// Summary options
export interface SummaryOptions {
  includeFirstMessage?: boolean;             // Include truncated first message
  includeLastMessage?: boolean;              // Include last message
  maxFirstMessageLength?: number;            // Max length for first message
  maxLastMessageLength?: number;             // Max length for last message
  includeStoredSummary?: boolean;            // Include text/richText fields
  includeFileList?: boolean;                 // Include relevant files
  includeCodeBlockCount?: boolean;           // Count code blocks
  includeAttachedFolders?: boolean;          // Include attached folders
  includeMetadata?: boolean;                 // Include metadata information
  includeTitle?: boolean;                    // Include conversation title (Modern format)
  includeAIGeneratedSummary?: boolean;       // Include AI-generated summary (Modern format)
}

// Database configuration
export interface DatabaseConfig {
  dbPath: string;
  maxConversations?: number;                 // Limit for performance
  cacheEnabled?: boolean;                    // Cache frequently accessed data
  minConversationSize?: number;              // Minimum size to consider valid
  resolveBubblesAutomatically?: boolean;     // Auto-resolve bubble messages
}

// Platform-specific database paths
export interface CursorDatabasePaths {
  macOS: string;
  windows: string;
  linux: string;
}

// Type guards for format detection
export function isLegacyConversation(conversation: any): conversation is LegacyCursorConversation {
  return conversation &&
         typeof conversation.composerId === 'string' &&
         Array.isArray(conversation.conversation) &&
         !conversation._v;
}

export function isModernConversation(conversation: any): conversation is ModernCursorConversation {
  return conversation &&
         typeof conversation.composerId === 'string' &&
         typeof conversation._v === 'number' &&
         Array.isArray(conversation.fullConversationHeadersOnly);
}

// New types for analytics tools

export interface ConversationAnalytics {
  overview: {
    totalConversations: number;
    totalMessages: number;
    totalCodeBlocks: number;
    averageConversationSize: number;
    averageMessagesPerConversation: number;
    totalFiles: number;
    totalFolders: number;
  };
  breakdowns: {
    files?: Array<{
      file: string;
      mentions: number;
      conversations: string[];
      extension: string;
      projectPath?: string;
    }>;
    languages?: Array<{
      language: string;
      codeBlocks: number;
      conversations: string[];
      averageCodeLength: number;
    }>;
    temporal?: Array<{
      period: string;
      conversationCount: number;
      messageCount: number;
      averageSize: number;
      conversationIds: string[];
    }>;
    size?: {
      distribution: number[];
      percentiles: Record<string, number>;
      bins: Array<{ range: string; count: number }>;
    };
  };
  scope: {
    type: string;
    projectPath?: string;
    recentDays?: number;
    totalScanned: number;
  };
  // Include conversation IDs for follow-up analysis
  conversationIds: string[];
  // Include basic conversation info for immediate access
  conversations: Array<{
    composerId: string;
    messageCount: number;
    size: number;
    files: string[];
    hasCodeBlocks: boolean;
  }>;
}

export interface RelatedConversationsResult {
  reference: {
    composerId: string;
    files: string[];
    folders: string[];
    languages: string[];
    messageCount: number;
    size: number;
  };
  related: Array<{
    composerId: string;
    relationshipScore: number;
    relationships: {
      sharedFiles?: string[];
      sharedFolders?: string[];
      sharedLanguages?: string[];
      sizeSimilarity?: number;
      temporalProximity?: number;
    };
    summary: string;
    scoreBreakdown?: Record<string, number>;
  }>;
}

export interface ExtractedElements {
  conversations: Array<{
    composerId: string;
    format: 'legacy' | 'modern';
    elements: {
      files?: Array<{
        path: string;
        extension: string;
        context?: string;
        messageType: 'user' | 'assistant';
      }>;
      folders?: Array<{
        path: string;
        context?: string;
      }>;
      languages?: Array<{
        language: string;
        codeBlocks: number;
        totalLines: number;
        averageLength: number;
      }>;
      codeblocks?: Array<{
        language: string;
        code: string;
        filename?: string;
        lineCount: number;
        messageType: 'user' | 'assistant';
        context?: string;
      }>;
      metadata?: {
        messageCount: number;
        size: number;
        format: 'legacy' | 'modern';
        userMessages: number;
        assistantMessages: number;
        hasCodeBlocks: boolean;
        hasFileReferences: boolean;
      };
      structure?: {
        messageFlow: Array<{ type: 'user' | 'assistant'; length: number; hasCode: boolean }>;
        conversationPattern: string;
        averageMessageLength: number;
        longestMessage: number;
      };
    };
  }>;
}

export interface ExportedData {
  format: string;
  data: any;
  metadata: {
    exportedCount: number;
    totalAvailable: number;
    exportTimestamp: string;
    filters: Record<string, any>;
  };
}