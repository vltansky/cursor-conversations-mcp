#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  listConversations,
  getConversation,
  searchConversations,
  getRecentConversations,
  getConversationsByProject
} from './tools/conversation-tools.js';
import {
  getConversationAnalytics,
  findRelatedConversations
} from './tools/analytics-tools.js';
import {
  extractConversationElements,
  exportConversationData
} from './tools/extraction-tools.js';
import { z } from 'zod';
import { formatResponse } from './utils/formatter.js';

const server = new McpServer({
  name: 'cursor-chat-history-mcp',
  version: '0.1.0',
});

// Simplified: List conversations with essential filters only
server.tool(
  'list_conversations',
  'Lists Cursor chats with summaries, titles, and metadata ordered by recency. Includes AI-generated summaries by default to help identify relevant discussions efficiently. Use this to browse and discover conversations before retrieving full content with get_conversation.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    limit: z.number().min(1).max(100).optional().default(10),
    minLength: z.number().min(0).optional().default(100),
    format: z.enum(['legacy', 'modern', 'both']).optional().default('both'),
    hasCodeBlocks: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    projectPath: z.string().optional(),
    filePattern: z.string().optional(),
    relevantFiles: z.array(z.string()).optional(),
    includeEmpty: z.boolean().optional().default(false),
    includeAiSummaries: z.boolean().optional().default(true),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      const mappedInput = {
        limit: input.limit,
        minLength: input.minLength,
        format: input.format,
        hasCodeBlocks: input.hasCodeBlocks,
        keywords: input.keywords,
        projectPath: input.projectPath,
        filePattern: input.filePattern,
        relevantFiles: input.relevantFiles,
        includeEmpty: input.includeEmpty,
        includeAiSummaries: input.includeAiSummaries
      };

      const result = await listConversations(mappedInput);
      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Simplified: Get conversation with sensible defaults
server.tool(
  'get_conversation',
  'Retrieves the complete content of a specific Cursor conversation including all messages, code blocks, file references, title, and AI summary. This provides full conversation details and should be used when you need to analyze specific conversations identified through list_conversations or search_conversations. Use summaryOnly=true to get enhanced summary data without full message content when appropriate.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    conversationId: z.string().min(1),
    includeMetadata: z.boolean().optional().default(false),
    summaryOnly: z.boolean().optional().default(false),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      // Use sensible defaults for most users
      const fullInput = {
        ...input,
        includeCodeBlocks: true,
        includeFileReferences: true,
        resolveBubbles: true
      };
      const result = await getConversation(fullInput);

      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Enhanced: Search conversations with multi-keyword and LIKE pattern support
server.tool(
  'search_conversations',
  'Searches through Cursor chat content using multiple powerful methods to find relevant discussions. Supports simple text queries, multi-keyword searches with AND/OR operators, and SQL LIKE patterns for advanced matching. Returns conversation summaries and metadata - use get_conversation for full content of specific matches.\n\nSearch methods:\n1. Simple query: Basic text search (e.g., "react hooks")\n2. Multi-keyword: Use keywords array with keywordOperator for precise matching\n3. LIKE patterns: Advanced pattern matching with SQL wildcards (% = any chars, _ = single char)\n\nExamples: likePattern="%useState(%" for function calls, keywords=["typescript","interface"] with AND operator for specific combinations.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    // Simple query (backward compatible)
    query: z.string().optional().describe('Basic text search - use for simple searches like "react hooks" or "error handling"'),

    // Multi-keyword search
    keywords: z.array(z.string().min(1)).optional().describe('Array of keywords for precise matching - use with keywordOperator to find conversations with specific combinations'),
    keywordOperator: z.enum(['AND', 'OR']).optional().default('OR').describe('How to combine keywords: "AND" = all keywords must be present, "OR" = any keyword can be present'),

    // LIKE pattern search (database-level)
    likePattern: z.string().optional().describe('SQL LIKE pattern for advanced searches - use % for any characters, _ for single character. Examples: "%useState(%" for function calls, "%.tsx%" for file types'),

    // Search options
    searchType: z.enum(['all', 'project', 'files', 'code']).optional().default('all').describe('Focus search on specific content types'),
    maxResults: z.number().min(1).max(50).optional().default(10).describe('Maximum number of conversations to return'),
    includeCode: z.boolean().optional().default(true).describe('Include code blocks in search results'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      // Validate that at least one search method is provided
      if (!input.query && !input.keywords && !input.likePattern) {
        throw new Error('At least one of query, keywords, or likePattern must be provided');
      }

      // Map to full search schema with sensible defaults
      const fullInput = {
        ...input,
        contextLines: 2,
        searchBubbles: true,
        format: 'both' as const,
        highlightMatches: true,
        // Project search settings
        projectSearch: input.searchType === 'project',
        fuzzyMatch: input.searchType === 'project',
        includePartialPaths: input.searchType === 'project',
        includeFileContent: false,
        minRelevanceScore: 0.1,
        orderBy: 'recency' as const
      };
      const result = await searchConversations(fullInput);

      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Consolidated: Get conversations by project (replaces get_recent_conversations and get_conversations_by_project)
server.tool(
  'get_project_conversations',
  'Retrieves conversations filtered by project path or returns recent conversations when no project is specified. Useful for finding discussions related to specific codebases or getting an overview of recent activity. Returns conversation summaries with file and folder context.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    projectPath: z.string().optional(),
    limit: z.number().min(1).max(100).optional().default(20),
    filePattern: z.string().optional(),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      if (input.projectPath) {
        const fullInput = {
          projectPath: input.projectPath,
          filePattern: input.filePattern,
          orderBy: 'recency' as const,
          limit: input.limit,
          fuzzyMatch: false
        };
        const result = await getConversationsByProject(fullInput);
        return {
          content: [{
            type: 'text',
            text: formatResponse(result, input.outputMode)
          }]
        };
      } else {
        const fullInput = {
          limit: input.limit,
          includeEmpty: false,
          format: 'both' as const,
          includeFirstMessage: true,
          maxFirstMessageLength: 150,
          includeMetadata: false
        };
        const result = await getRecentConversations(fullInput);
        return {
          content: [{
            type: 'text',
            text: formatResponse(result, input.outputMode)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Analytics: Get comprehensive conversation analytics
server.tool(
  'get_conversation_analytics',
  'Get comprehensive analytics and statistics about Cursor chats including usage patterns, file activity, programming language distribution, and temporal trends. Use this when you need to understand conversation patterns, analyze coding activity across projects, identify most frequently discussed files/languages, or generate statistical reports about chat data.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    scope: z.enum(['all', 'recent', 'project']).optional().default('all'),
    projectPath: z.string().optional(),
    recentDays: z.number().min(1).max(365).optional().default(30),
    includeBreakdowns: z.array(z.enum(['files', 'languages', 'temporal', 'size'])).optional().default(['files', 'languages']),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      const result = await getConversationAnalytics(input);
      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Analytics: Find related conversations
server.tool(
  'find_related_conversations',
  'Find conversations related to a reference conversation based on shared files, folders, programming languages, similar size, or temporal proximity. Use this to discover related discussions, find conversations about the same codebase/project, identify similar problem-solving sessions, or trace the evolution of ideas across multiple conversations.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    referenceConversationId: z.string().min(1),
    relationshipTypes: z.array(z.enum(['files', 'folders', 'languages', 'size', 'temporal'])).optional().default(['files']),
    maxResults: z.number().min(1).max(50).optional().default(10),
    minScore: z.number().min(0).max(1).optional().default(0.1),
    includeScoreBreakdown: z.boolean().optional().default(false),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      const result = await findRelatedConversations(input);
      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Extraction: Extract conversation elements
server.tool(
  'extract_conversation_elements',
  'Extract specific elements from conversations such as file references, code blocks, programming languages, folder paths, metadata, or conversation structure. Use this to build knowledge bases, analyze code patterns, extract reusable snippets, understand project file usage, or prepare data for further analysis and documentation.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    conversationIds: z.array(z.string()).optional(),
    elements: z.array(z.enum(['files', 'folders', 'languages', 'codeblocks', 'metadata', 'structure'])).optional().default(['files', 'codeblocks']),
    includeContext: z.boolean().optional().default(false),
    groupBy: z.enum(['conversation', 'element', 'none']).optional().default('conversation'),
    filters: z.object({
      minCodeLength: z.number().optional(),
      fileExtensions: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional()
    }).optional(),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      const mappedInput = {
        conversationIds: input.conversationIds,
        elements: input.elements,
        includeContext: input.includeContext,
        groupBy: input.groupBy,
        filters: input.filters
      };

      const result = await extractConversationElements(mappedInput);
      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

// Export: Export conversation data in various formats
server.tool(
  'export_conversation_data',
  'Export chat data in various formats (JSON, CSV, Graph) for external analysis, visualization, or integration with other tools. Use this to create datasets for machine learning, generate reports for stakeholders, prepare data for visualization tools like Gephi or Tableau, or backup chat data in structured formats.\n\nOutput Formats: Use "markdown" (default) for human-readable results with proper formatting. Use "json" only when you need to programmatically process the data. Markdown is strongly recommended for AI-human collaboration.',
  {
    conversationIds: z.array(z.string()).optional(),
    format: z.enum(['json', 'csv', 'graph']).optional().default('json'),
    includeContent: z.boolean().optional().default(false),
    includeRelationships: z.boolean().optional().default(false),
    flattenStructure: z.boolean().optional().default(false),
    filters: z.object({
      minSize: z.number().optional(),
      hasCodeBlocks: z.boolean().optional(),
      projectPath: z.string().optional()
    }).optional(),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      const mappedInput = {
        conversationIds: input.conversationIds,
        format: input.format,
        includeContent: input.includeContent,
        includeRelationships: input.includeRelationships,
        flattenStructure: input.flattenStructure,
        filters: input.filters
      };

      const result = await exportConversationData(mappedInput);
      return {
        content: [{
          type: 'text',
          text: formatResponse(result, input.outputMode)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }]
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
