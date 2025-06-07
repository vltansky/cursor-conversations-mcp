#!/usr/bin/env node

/*
 * WORKFLOW GUIDANCE FOR AI ASSISTANTS:
 *
 * 1. DISCOVERY: Use list_conversations or search_conversations to find relevant conversations
 * 2. ANALYTICS: Use get_conversation_analytics with ["files", "languages"] breakdowns
 *    - Files/languages breakdowns contain conversation IDs in their arrays!
 * 3. DEEP DIVE: Use get_conversation with specific conversation IDs from step 1 or 2
 * 4. ANALYSIS: Use analytics tools (find_related, extract_elements) for insights
 * 5. DATE FILTERING: Use get_system_info first when applying date filters to search_conversations
 *
 * COMMON PATTERN:
 * - get_conversation_analytics(includeBreakdowns: ["files", "languages"])
 * - Extract conversation IDs from files/languages.conversations arrays
 * - get_conversation(conversationId: "id-from-breakdown") for each relevant conversation
 */

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

server.tool(
  'list_conversations',
  'Lists Cursor chats with summaries, titles, and metadata ordered by recency. Returns conversation IDs that you can use with get_conversation tool. WORKFLOW TIP: Use this for browsing/discovery, then call get_conversation with specific IDs from the results. Includes AI-generated summaries by default to help identify relevant discussions efficiently. When projectPath is specified, adds relevance scoring for project-specific filtering. Supports date range filtering (YYYY-MM-DD format - note: timestamps may be unreliable).',
  {
    limit: z.number().min(1).max(100).optional().default(10).describe('Maximum number of conversations to return (1-100)'),
    minLength: z.number().min(0).optional().default(100).describe('Minimum conversation length in characters to include'),
    hasCodeBlocks: z.boolean().optional().describe('Filter to conversations that contain code blocks'),
    keywords: z.array(z.string()).optional().describe('Filter conversations containing any of these exact keywords (literal text matching)'),
    projectPath: z.string().optional().describe('Filter conversations related to this project path'),
    filePattern: z.string().optional().describe('Filter conversations mentioning files matching this pattern (e.g., "*.tsx")'),
    relevantFiles: z.array(z.string()).optional().describe('Filter conversations that reference any of these specific files'),
    startDate: z.string().optional().describe('Start date for filtering (YYYY-MM-DD). Note: Timestamps may be unreliable.'),
    endDate: z.string().optional().describe('End date for filtering (YYYY-MM-DD). Note: Timestamps may be unreliable.'),
    includeEmpty: z.boolean().optional().default(false).describe('Include conversations with no messages'),
    includeAiSummaries: z.boolean().optional().default(true).describe('Include AI-generated conversation summaries'),
    includeRelevanceScore: z.boolean().optional().default(false).describe('Include relevance scores when filtering by projectPath'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      if (input.projectPath && input.includeRelevanceScore) {
        const projectInput = {
          projectPath: input.projectPath,
          filePattern: input.filePattern,
          orderBy: 'recency' as const,
          limit: input.limit,
          fuzzyMatch: false
        };
        const result = await getConversationsByProject(projectInput);

        const transformedResult = {
          conversations: result.conversations.map(conv => ({
            ...conv,
            title: undefined,
            aiGeneratedSummary: undefined,
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
        const mappedInput = {
          limit: input.limit,
          minLength: input.minLength,
          format: 'both' as const,
          hasCodeBlocks: input.hasCodeBlocks,
          keywords: input.keywords,
          projectPath: input.projectPath,
          filePattern: input.filePattern,
          relevantFiles: input.relevantFiles,
          startDate: input.startDate,
          endDate: input.endDate,
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

server.tool(
  'get_conversation',
  'Retrieves the complete content of a specific Cursor conversation including all messages, code blocks, file references, title, and AI summary. WORKFLOW TIP: Use conversation IDs from list_conversations, search_conversations, or analytics breakdowns (files/languages arrays contain conversation IDs). Use summaryOnly=true to get enhanced summary data without full message content when you need to conserve context.',
  {
    conversationId: z.string().min(1).describe('Conversation ID from list_conversations, search_conversations, or analytics breakdowns'),
    summaryOnly: z.boolean().optional().default(false).describe('Return only enhanced summary data without full message content'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
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

server.tool(
  'search_conversations',
  'Searches through Cursor chat content using exact text matching (NOT semantic search) to find relevant discussions. Returns conversation summaries with IDs - ALWAYS follow up with get_conversation for specific conversations of interest. WORKFLOW TIP: This tool gives you conversation IDs in the results - use them directly with get_conversation to examine full content.\n\nSearch methods (all use exact/literal text matching):\n1. Simple text matching: Use query parameter for literal string matching (e.g., "react hooks")\n2. Multi-keyword: Use keywords array with keywordOperator for exact matching\n3. LIKE patterns: Advanced pattern matching with SQL wildcards (% = any chars, _ = single char)\n4. Date range: Filter by message timestamps (YYYY-MM-DD format - note: timestamps may be unreliable)\n\nIMPORTANT: When using date filters, call get_system_info first to know today\'s date, as AI assistants may not have access to current date information.\n\nExamples: likePattern="%useState(%" for function calls, keywords=["typescript","interface"] with AND operator for specific combinations.',
  {
    query: z.string().optional().describe('Exact text matching - searches for literal string occurrences in conversation content (e.g., "react hooks" finds conversations containing those exact words)'),
    keywords: z.array(z.string().min(1)).optional().describe('Array of keywords for exact text matching - use with keywordOperator to find conversations with specific combinations'),
    keywordOperator: z.enum(['AND', 'OR']).optional().default('OR').describe('How to combine keywords: "AND" = all keywords must be present, "OR" = any keyword can be present'),
    likePattern: z.string().optional().describe('SQL LIKE pattern for advanced searches - use % for any characters, _ for single character. Examples: "%useState(%" for function calls, "%.tsx%" for file types'),
    startDate: z.string().optional().describe('Start date for search (YYYY-MM-DD). Note: Timestamps may be unreliable.'),
    endDate: z.string().optional().describe('End date for search (YYYY-MM-DD). Note: Timestamps may be unreliable.'),
    searchType: z.enum(['all', 'project', 'files', 'code']).optional().default('all').describe('Focus search on specific content types'),
    maxResults: z.number().min(1).max(50).optional().default(10).describe('Maximum number of conversations to return'),
    includeCode: z.boolean().optional().default(true).describe('Include code blocks in search results'),
    outputMode: z.enum(['compact', 'table', 'markdown', 'json', 'compact-json']).optional().default('markdown').describe('Output format: "markdown" for human-readable results (recommended), "json" for programmatic processing only')
  },
  async (input) => {
    try {
      if (!input.query && !input.keywords && !input.likePattern) {
        throw new Error('At least one of query, keywords, or likePattern must be provided');
      }

      const fullInput = {
        ...input,
        contextLines: 2,
        searchBubbles: true,
        format: 'both' as const,
        highlightMatches: true,
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

server.tool(
  'get_conversation_analytics',
  'Get comprehensive analytics and statistics about Cursor chats including usage patterns, file activity, programming language distribution, and temporal trends. WORKFLOW TIP: Always include "files" and "languages" in breakdowns - these contain conversation IDs in their arrays that you can immediately use with get_conversation tool. For example, files breakdown shows which conversations mention specific files. Use includeConversationDetails=true when you need the full conversation ID list and basic metadata for follow-up analysis. Use this when you need to understand conversation patterns, analyze coding activity across projects, identify most frequently discussed files/languages, or generate statistical reports about chat data.',
  {
    scope: z.enum(['all', 'recent', 'project']).optional().default('all').describe('Analysis scope: all conversations, recent only, or project-specific'),
    projectPath: z.string().optional().describe('Project path for project-scoped analysis'),
    recentDays: z.number().min(1).max(365).optional().default(30).describe('Number of recent days to analyze (1-365)'),
    includeBreakdowns: z.array(z.enum(['files', 'languages', 'temporal', 'size'])).optional().default(['files', 'languages']).describe('Types of breakdowns to include in the analysis. IMPORTANT: "files" and "languages" breakdowns contain conversation IDs in their arrays - use these for follow-up analysis!'),
    includeConversationDetails: z.boolean().optional().default(false).describe('Include full conversation ID list and basic metadata (increases response size significantly)'),
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

server.tool(
  'get_system_info',
  'Get system information and utilities for AI assistants. Provides current date, timezone, and other helpful context that AI assistants may not have access to. Use this when you need reference information for date filtering, time-based queries, or other system context.',
  {
    info: z.enum(['date', 'timezone', 'all']).optional().default('all').describe('Type of system information to retrieve: "date" for current date only, "timezone" for timezone info, "all" for everything')
  },
  async (input) => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let response = '';

    if (input.info === 'date') {
      response = `Current date: ${currentDate}`;
    } else if (input.info === 'timezone') {
      response = `Timezone: ${timezone}`;
    } else {
      response = [
        `Current date: ${currentDate}`,
        `Current time: ${currentTime}`,
        `Timezone: ${timezone}`,
        ``,
        `Use this date information when applying date filters to search_conversations.`,
        `Date format for filters: YYYY-MM-DD (e.g., "${currentDate}")`
      ].join('\n');
    }

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
