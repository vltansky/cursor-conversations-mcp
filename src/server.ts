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

const server = new McpServer({
  name: 'cursor-conversations-mcp',
  version: '0.1.0',
});

// Simplified: List conversations with essential filters only
server.tool(
  'list_conversations',
  'List Cursor conversations with basic filtering. Returns conversation summaries ordered by most recent first.',
  {
    limit: z.number().min(1).max(100).optional().default(10),
    minLength: z.number().min(0).optional().default(100),
    format: z.enum(['legacy', 'modern', 'both']).optional().default('both'),
    hasCodeBlocks: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    projectPath: z.string().optional(),
    filePattern: z.string().optional(),
    relevantFiles: z.array(z.string()).optional(),
    includeEmpty: z.boolean().optional().default(false)
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
        includeEmpty: input.includeEmpty
      };

      const result = await listConversations(mappedInput);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
  'Retrieve the full content of a specific Cursor conversation by ID, including messages, code blocks, and file references.',
  {
    conversationId: z.string().min(1),
    includeMetadata: z.boolean().optional().default(false)
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
          text: JSON.stringify(result, null, 2)
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

// Simplified: Search conversations with essential options
server.tool(
  'search_conversations',
  'Search through Cursor conversation content using exact keyword matching (like grep, not semantic search). Use specific terms that would literally appear in conversations: function names, library names, file extensions, error messages, or code snippets. For broader results, try multiple searches with different related keywords rather than complex phrases.',
  {
    query: z.string().min(1),
    searchType: z.enum(['all', 'project', 'files', 'code']).optional().default('all'),
    maxResults: z.number().min(1).max(50).optional().default(10),
    includeCode: z.boolean().optional().default(true)
  },
  async (input) => {
    try {
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
        minRelevanceScore: 1,
        orderBy: 'recency' as const,
        includeDebugInfo: false
      };
      const result = await searchConversations(fullInput);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
  'Get conversations for a specific project path, or get recent conversations if no project specified.',
  {
    projectPath: z.string().optional(),
    limit: z.number().min(1).max(100).optional().default(20),
    filePattern: z.string().optional()
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
            text: JSON.stringify(result, null, 2)
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
            text: JSON.stringify(result, null, 2)
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
  'Get comprehensive analytics and statistics about Cursor conversations including usage patterns, file activity, programming language distribution, and temporal trends. Use this when you need to understand conversation patterns, analyze coding activity across projects, identify most frequently discussed files/languages, or generate statistical reports about conversation data.',
  {
    scope: z.enum(['all', 'recent', 'project']).optional().default('all'),
    projectPath: z.string().optional(),
    recentDays: z.number().min(1).max(365).optional().default(30),
    includeBreakdowns: z.array(z.enum(['files', 'languages', 'temporal', 'size'])).optional().default(['files', 'languages'])
  },
  async (input) => {
    try {
      const result = await getConversationAnalytics(input);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
    referenceConversationId: z.string().min(1),
    relationshipTypes: z.array(z.enum(['files', 'folders', 'languages', 'size', 'temporal'])).optional().default(['files']),
    maxResults: z.number().min(1).max(50).optional().default(10),
    minScore: z.number().min(0).max(1).optional().default(0.1),
    includeScoreBreakdown: z.boolean().optional().default(false)
  },
  async (input) => {
    try {
      const result = await findRelatedConversations(input);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
    conversationIds: z.array(z.string()).optional(),
    elements: z.array(z.enum(['files', 'folders', 'languages', 'codeblocks', 'metadata', 'structure'])).optional().default(['files', 'codeblocks']),
    includeContext: z.boolean().optional().default(false),
    groupBy: z.enum(['conversation', 'element', 'none']).optional().default('conversation'),
    filters: z.object({
      minCodeLength: z.number().optional(),
      fileExtensions: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional()
    }).optional()
  },
  async (input) => {
    try {
      const result = await extractConversationElements(input);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
  'Export conversation data in various formats (JSON, CSV, Graph) for external analysis, visualization, or integration with other tools. Use this to create datasets for machine learning, generate reports for stakeholders, prepare data for visualization tools like Gephi or Tableau, or backup conversation data in structured formats.',
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
    }).optional()
  },
  async (input) => {
    try {
      const result = await exportConversationData(input);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
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
