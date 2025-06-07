import { z } from 'zod';
import { CursorDatabaseReader } from '../database/reader.js';
import type {
  ConversationAnalytics,
  RelatedConversationsResult,
  ConversationFilters
} from '../database/types.js';
import {
  calculateOverview,
  calculateFileBreakdown,
  calculateLanguageBreakdown,
  calculateTemporalBreakdown,
  calculateSizeDistribution
} from '../utils/analytics.js';
import {
  findRelatedConversations as findRelatedConversationsUtil,
  extractLanguagesFromCodeBlocks
} from '../utils/relationships.js';
import { DatabaseError } from '../utils/errors.js';

// Schema definitions
export const getConversationAnalyticsSchema = z.object({
  scope: z.enum(['all', 'recent', 'project']).optional().default('all'),
  projectPath: z.string().optional(),
  recentDays: z.number().min(1).max(365).optional().default(30),
  includeBreakdowns: z.array(z.enum(['files', 'languages', 'temporal', 'size'])).optional().default(['files', 'languages']),
  includeConversationDetails: z.boolean().optional().default(false)
});

export const findRelatedConversationsSchema = z.object({
  referenceConversationId: z.string().min(1),
  relationshipTypes: z.array(z.enum(['files', 'folders', 'languages', 'size', 'temporal'])).optional().default(['files']),
  maxResults: z.number().min(1).max(50).optional().default(10),
  minScore: z.number().min(0).max(1).optional().default(0.1),
  includeScoreBreakdown: z.boolean().optional().default(false)
});

export type GetConversationAnalyticsInput = z.infer<typeof getConversationAnalyticsSchema>;
export type FindRelatedConversationsInput = z.infer<typeof findRelatedConversationsSchema>;

/**
 * Get comprehensive analytics and statistics about Cursor conversations
 */
export async function getConversationAnalytics(
  input: GetConversationAnalyticsInput
): Promise<ConversationAnalytics> {
  const reader = new CursorDatabaseReader();

  try {
    await reader.connect();

    // Build filters based on scope
    const filters: ConversationFilters = {
      format: 'both',
      minLength: 100 // Filter out only very small conversations (reduced from 1000)
    };

    if (input.scope === 'project' && input.projectPath) {
      filters.projectPath = input.projectPath;
    }

    // Get conversation IDs
    const conversationIds = await reader.getConversationIds(filters);

    // Apply recent filter if needed
    let filteredIds = conversationIds;
    if (input.scope === 'recent') {
      // Take the most recent conversations (ROWID ordering)
      const recentCount = Math.min(conversationIds.length, Math.floor(conversationIds.length * 0.3));
      filteredIds = conversationIds.slice(0, recentCount);
    }

    // Get conversation summaries
    const summaries = await reader.getConversationSummariesForAnalytics(filteredIds);

    // Calculate overview
    const overview = calculateOverview(summaries);

    // Calculate breakdowns
    const breakdowns: any = {};

    if (input.includeBreakdowns.includes('files')) {
      breakdowns.files = calculateFileBreakdown(summaries);
    }

    if (input.includeBreakdowns.includes('languages')) {
      // Get conversations with code blocks for language analysis
      const conversationsWithCode = await reader.getConversationsWithCodeBlocks(filteredIds);
      breakdowns.languages = calculateLanguageBreakdown(conversationsWithCode);
    }

    if (input.includeBreakdowns.includes('temporal')) {
      breakdowns.temporal = calculateTemporalBreakdown(summaries, filteredIds);
    }

    if (input.includeBreakdowns.includes('size')) {
      breakdowns.size = calculateSizeDistribution(summaries);
    }

    return {
      overview,
      breakdowns,
      scope: {
        type: input.scope,
        projectPath: input.projectPath,
        recentDays: input.scope === 'recent' ? input.recentDays : undefined,
        totalScanned: filteredIds.length
      },
      // Only include conversation details when requested (to control response size)
      conversationIds: input.includeConversationDetails ? filteredIds : [],
      conversations: input.includeConversationDetails ? summaries.map(s => ({
        composerId: s.composerId,
        messageCount: s.messageCount,
        size: s.conversationSize,
        files: s.relevantFiles.slice(0, 2), // Top 2 files only
        hasCodeBlocks: s.codeBlockCount > 0
      })) : []
    };

  } catch (error) {
    throw new DatabaseError(`Failed to get conversation analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    reader.close();
  }
}

/**
 * Find conversations related to a reference conversation
 */
export async function findRelatedConversations(
  input: FindRelatedConversationsInput
): Promise<RelatedConversationsResult> {
  const reader = new CursorDatabaseReader();

  try {
    await reader.connect();

    // Get reference conversation summary
    const referenceSummary = await reader.getConversationSummary(input.referenceConversationId, {
      includeFirstMessage: true,
      includeCodeBlockCount: true,
      includeFileList: true,
      includeAttachedFolders: true,
      maxFirstMessageLength: 150
    });

    if (!referenceSummary) {
      throw new DatabaseError(`Reference conversation ${input.referenceConversationId} not found`);
    }

    // Get all conversation IDs for comparison
    const allConversationIds = await reader.getConversationIds({
      format: 'both',
      minLength: 100
    });

    // Get summaries for all conversations
    const allSummaries = await reader.getConversationSummariesForAnalytics(allConversationIds);

    // Extract languages from reference conversation if needed
    let referenceLanguages: string[] = [];
    if (input.relationshipTypes.includes('languages')) {
      const conversationsWithCode = await reader.getConversationsWithCodeBlocks([input.referenceConversationId]);
      if (conversationsWithCode.length > 0) {
        referenceLanguages = extractLanguagesFromCodeBlocks(conversationsWithCode[0].codeBlocks);
      }
    }

    // Find related conversations
    const related = findRelatedConversationsUtil(
      referenceSummary,
      allSummaries,
      allConversationIds,
      {
        relationshipTypes: input.relationshipTypes,
        maxResults: input.maxResults,
        minScore: input.minScore,
        includeScoreBreakdown: input.includeScoreBreakdown
      }
    );

    return {
      reference: {
        composerId: referenceSummary.composerId,
        files: referenceSummary.relevantFiles,
        folders: referenceSummary.attachedFolders,
        languages: referenceLanguages,
        messageCount: referenceSummary.messageCount,
        size: referenceSummary.conversationSize
      },
      related
    };

  } catch (error) {
    throw new DatabaseError(`Failed to find related conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    reader.close();
  }
}