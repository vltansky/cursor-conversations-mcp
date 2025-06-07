import { z } from 'zod';
import { CursorDatabaseReader } from '../database/reader.js';
import type {
  ExtractedElements,
  ExportedData,
  ConversationFilters
} from '../database/types.js';
import {
  exportAsJSON,
  exportAsCSV,
  exportAsGraph,
  createExportMetadata
} from '../utils/exporters.js';
import { DatabaseError } from '../utils/errors.js';

// Schema definitions
export const extractConversationElementsSchema = z.object({
  conversationIds: z.array(z.string()).optional(),
  elements: z.array(z.enum(['files', 'folders', 'languages', 'codeblocks', 'metadata', 'structure'])).optional().default(['files', 'codeblocks']),
  includeContext: z.boolean().optional().default(false),
  groupBy: z.enum(['conversation', 'element', 'none']).optional().default('conversation'),
  filters: z.object({
    minCodeLength: z.number().optional(),
    fileExtensions: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional()
  }).optional()
});

export const exportConversationDataSchema = z.object({
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
});

export type ExtractConversationElementsInput = z.infer<typeof extractConversationElementsSchema>;
export type ExportConversationDataInput = z.infer<typeof exportConversationDataSchema>;

/**
 * Extract specific elements from conversations
 */
export async function extractConversationElements(
  input: ExtractConversationElementsInput
): Promise<ExtractedElements> {
  const reader = new CursorDatabaseReader();

  try {
    await reader.connect();

    // Get conversation IDs to process
    let conversationIds = input.conversationIds;
    if (!conversationIds || conversationIds.length === 0) {
      // Get all conversation IDs if none specified
      conversationIds = await reader.getConversationIds({
        format: 'both',
        minLength: 1000
      });
    }

    // Extract elements from conversations
    const extractedData = await reader.extractConversationElements(
      conversationIds,
      input.elements,
      {
        includeContext: input.includeContext,
        filters: input.filters
      }
    );

    // Group data based on groupBy parameter
    if (input.groupBy === 'conversation') {
      return { conversations: extractedData };
    } else if (input.groupBy === 'element') {
      // Group by element type
      const groupedData: Record<string, any[]> = {};

      for (const elementType of input.elements) {
        groupedData[elementType] = [];

        for (const conversation of extractedData) {
          if (conversation.elements[elementType]) {
            if (Array.isArray(conversation.elements[elementType])) {
              groupedData[elementType].push(...conversation.elements[elementType]);
            } else {
              groupedData[elementType].push(conversation.elements[elementType]);
            }
          }
        }
      }

      return { conversations: groupedData } as any;
    } else {
      // Flatten all data
      const flatData: any[] = [];

      for (const conversation of extractedData) {
        for (const elementType of input.elements) {
          if (conversation.elements[elementType]) {
            if (Array.isArray(conversation.elements[elementType])) {
              flatData.push(...conversation.elements[elementType].map((item: any) => ({
                ...item,
                conversationId: conversation.composerId,
                elementType
              })));
            } else {
              flatData.push({
                ...conversation.elements[elementType],
                conversationId: conversation.composerId,
                elementType
              });
            }
          }
        }
      }

      return { conversations: flatData } as any;
    }

  } catch (error) {
    throw new DatabaseError(`Failed to extract conversation elements: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    reader.close();
  }
}

/**
 * Export conversation data in various formats
 */
export async function exportConversationData(
  input: ExportConversationDataInput
): Promise<ExportedData> {
  const reader = new CursorDatabaseReader();

  try {
    await reader.connect();

    // Build filters
    const filters: ConversationFilters = {
      format: 'both',
      minLength: input.filters?.minSize || 1000
    };

    if (input.filters?.hasCodeBlocks !== undefined) {
      filters.hasCodeBlocks = input.filters.hasCodeBlocks;
    }

    if (input.filters?.projectPath) {
      filters.projectPath = input.filters.projectPath;
    }

    // Get conversation IDs to export
    let conversationIds = input.conversationIds;
    if (!conversationIds || conversationIds.length === 0) {
      conversationIds = await reader.getConversationIds(filters);
    }

    // Get conversation summaries
    const summaries = await reader.getConversationSummariesForAnalytics(conversationIds);

    // Get full conversation data if needed
    let conversationData: Map<string, any> | undefined;
    if (input.includeContent) {
      conversationData = new Map();
      for (const id of conversationIds) {
        try {
          const conversation = await reader.getConversationById(id);
          if (conversation) {
            conversationData.set(id, conversation);
          }
        } catch (error) {
          console.error(`Failed to get full conversation data for ${id}:`, error);
        }
      }
    }

    // Export in requested format
    let exportedData: any;

    switch (input.format) {
      case 'json':
        exportedData = exportAsJSON(summaries, input.includeContent, conversationData);
        break;

      case 'csv':
        exportedData = exportAsCSV(summaries, input.flattenStructure);
        break;

      case 'graph':
        exportedData = exportAsGraph(summaries, input.includeRelationships);
        break;

      default:
        exportedData = exportAsJSON(summaries, input.includeContent, conversationData);
    }

    // Create metadata
    const metadata = createExportMetadata(
      summaries.length,
      conversationIds.length,
      input.filters || {}
    );

    return {
      format: input.format,
      data: exportedData,
      metadata
    };

  } catch (error) {
    throw new DatabaseError(`Failed to export conversation data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    reader.close();
  }
}