#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  listConversations,
  getConversation,
  searchConversations,
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

// Enhanced: List conversations with project relevance scoring
server.tool(
  'list_conversations',
  'Lists Cursor chats with summaries, titles, and metadata ordered by recency. Includes AI-generated summaries by default to help identify relevant discussions efficiently. When projectPath is specified, adds relevance scoring for project-specific filtering. Use this to browse and discover conversations before retrieving full content with get_conversation.',
  {
    limit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of conversations to return (1-100)'),
    minLength: z.number().min(0).optional().default(100).describe('Minimum conversation length in characters to include'),
    hasCodeBlocks: z.boolean().optional().describe('Filter to conversations that contain code blocks'),
    keywords: z.array(z.string()).optional().describe('Filter conversations containing any of these keywords'),
    projectPath: z.string().optional().describe('Filter conversations related to this project path'),
    filePattern: z.string().optional().describe('Filter conversations mentioning files matching this pattern (e.g., "*.tsx")'),
    relevantFiles: z.array(z.string()).optional().describe('Filter conversations that reference any of these specific files'),
    includeEmpty: z.boolean().optional().default(false).describe('Include conversations with no messages'),
    includeAiSummaries: z.boolean().optional().default(true).describe('Include AI-generated conversation summaries'),
    includeRelevanceScore: z.boolean().optional().default(false).describe('Include relevance scores when filtering by projectPath'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      // If projectPath is specified and relevance scoring is requested, use project-specific logic
      if (input.projectPath && input.includeRelevanceScore) {
        const projectInput = {
          projectPath: input.projectPath,
          filePattern: input.filePattern,
          orderBy: 'recency' as const,
          limit: input.limit,
          fuzzyMatch: false
        };
        const result = await getConversationsByProject(projectInput);

        // Transform to match list_conversations format
        const transformedResult = {
          conversations: result.conversations.map(conv => ({
            ...conv,
            title: undefined, // Project results don't include titles
            aiGeneratedSummary: undefined, // Project results don't include AI summaries
            relevanceScore: conv.relevanceScore
          })),
          totalFound: result.totalFound,
          filters: {
            limit: input.limit ?? 10,
            minLength: input.minLength ?? 100,
            hasCodeBlocks: input.hasCodeBlocks,
            keywords: input.keywords,
            projectPath: input.projectPath,
            filePattern: input.filePattern,
            relevantFiles: input.relevantFiles,
            includeAiSummaries: input.includeAiSummaries
          }
        };

        return {
          content: [{
            type: 'text',
            text: formatResponse(transformedResult, input.outputMode)
          }]
        };
      } else {
        // Use standard list_conversations logic
        const mappedInput = {
          limit: input.limit,
          minLength: input.minLength,
          format: 'both' as const,
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

// Simplified: Get conversation with sensible defaults
server.tool(
  'get_conversation',
  'Retrieves the complete content of a specific Cursor conversation including all messages, code blocks, file references, title, and AI summary. This provides full conversation details and should be used when you need to analyze specific conversations identified through list_conversations or search_conversations. Use summaryOnly=true to get enhanced summary data without full message content when appropriate.',
  {
    conversationId: z.string().min(1).describe('Unique identifier of the conversation to retrieve'),
    summaryOnly: z.boolean().optional().default(false).describe('Return only enhanced summary data without full message content'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      // Use sensible defaults for most users
      const fullInput = {
        ...input,
        includeCodeBlocks: true,
        includeFileReferences: true,
        includeMetadata: false,
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
  'Searches through Cursor chat content using multiple powerful methods to find relevant discussions. Supports simple text queries, multi-keyword searches with AND/OR operators, and SQL LIKE patterns for advanced matching. Returns conversation summaries and metadata - use get_conversation for full content of specific matches.\n\nSearch methods:\n1. Simple query: Basic text search (e.g., "react hooks")\n2. Multi-keyword: Use keywords array with keywordOperator for precise matching\n3. LIKE patterns: Advanced pattern matching with SQL wildcards (% = any chars, _ = single char)\n\nExamples: likePattern="%useState(%" for function calls, keywords=["typescript","interface"] with AND operator for specific combinations.',
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



// Analytics: Get comprehensive conversation analytics
server.tool(
  'get_conversation_analytics',
  'Get comprehensive analytics and statistics about Cursor chats including usage patterns, file activity, programming language distribution, and temporal trends. Use this when you need to understand conversation patterns, analyze coding activity across projects, identify most frequently discussed files/languages, or generate statistical reports about chat data.',
  {
    scope: z.enum(['all', 'recent', 'project']).optional().default('all').describe('Analysis scope: all conversations, recent only, or project-specific'),
    projectPath: z.string().optional().describe('Project path for project-scoped analysis'),
    recentDays: z.number().min(1).max(365).optional().default(30).describe('Number of recent days to analyze (1-365)'),
    includeBreakdowns: z.array(z.enum(['files', 'languages', 'temporal', 'size'])).optional().default(['files', 'languages']).describe('Types of breakdowns to include in the analysis'),
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
  'Find conversations related to a reference conversation based on shared files, folders, programming languages, similar size, or temporal proximity. Use this to discover related discussions, find conversations about the same codebase/project, identify similar problem-solving sessions, or trace the evolution of ideas across multiple conversations.',
  {
    referenceConversationId: z.string().min(1).describe('ID of the conversation to find related conversations for'),
    relationshipTypes: z.array(z.enum(['files', 'folders', 'languages', 'size', 'temporal'])).optional().default(['files']).describe('Types of relationships to consider when finding related conversations'),
    maxResults: z.number().min(1).max(50).optional().default(10).describe('Maximum number of related conversations to return (1-50)'),
    minScore: z.number().min(0).max(1).optional().default(0.1).describe('Minimum similarity score threshold (0.0-1.0)'),
    includeScoreBreakdown: z.boolean().optional().default(false).describe('Include detailed breakdown of how similarity scores were calculated'),
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
  'Extract specific elements from conversations such as file references, code blocks, programming languages, folder paths, metadata, or conversation structure. Use this to build knowledge bases, analyze code patterns, extract reusable snippets, understand project file usage, or prepare data for further analysis and documentation.',
  {
    conversationIds: z.array(z.string()).optional().describe('Specific conversation IDs to extract elements from (if not provided, extracts from all conversations)'),
    elements: z.array(z.enum(['files', 'folders', 'languages', 'codeblocks', 'metadata', 'structure'])).optional().default(['files', 'codeblocks']).describe('Types of elements to extract from conversations'),
    includeContext: z.boolean().optional().default(false).describe('Include surrounding context for extracted elements'),
    groupBy: z.enum(['conversation', 'element', 'none']).optional().default('conversation').describe('How to group the extracted elements in the output'),
    filters: z.object({
      minCodeLength: z.number().optional().describe('Minimum length for code blocks to include'),
      fileExtensions: z.array(z.string()).optional().describe('Only include files with these extensions'),
      languages: z.array(z.string()).optional().describe('Only include code blocks in these programming languages')
    }).optional().describe('Filters to apply when extracting elements'),
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
  'Export chat data in various formats (JSON, CSV, Graph) for external analysis, visualization, or integration with other tools. Use this to create datasets for machine learning, generate reports for stakeholders, prepare data for visualization tools like Gephi or Tableau, or backup chat data in structured formats.',
  {
    conversationIds: z.array(z.string()).optional().describe('Specific conversation IDs to export (if not provided, exports all conversations)'),
    format: z.enum(['json', 'csv', 'graph']).optional().default('json').describe('Export format: JSON for structured data, CSV for spreadsheets, Graph for network analysis'),
    includeContent: z.boolean().optional().default(false).describe('Include full conversation content in the export'),
    includeRelationships: z.boolean().optional().default(false).describe('Include relationship data between conversations'),
    flattenStructure: z.boolean().optional().default(false).describe('Flatten nested structures for easier processing'),
    filters: z.object({
      minSize: z.number().optional().describe('Minimum conversation size to include'),
      hasCodeBlocks: z.boolean().optional().describe('Only include conversations with code blocks'),
      projectPath: z.string().optional().describe('Only include conversations related to this project path')
    }).optional().describe('Filters to apply when selecting conversations to export'),
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
