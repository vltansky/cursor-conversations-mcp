import type { ConversationSummary } from '../database/types.js';

/**
 * Relationship detection and similarity scoring algorithms
 */

export interface RelationshipScore {
  sharedFiles?: string[];
  sharedFolders?: string[];
  sharedLanguages?: string[];
  sizeSimilarity?: number;
  temporalProximity?: number;
}

export interface RelatedConversation {
  composerId: string;
  relationshipScore: number;
  relationships: RelationshipScore;
  summary: string;
  scoreBreakdown?: Record<string, number>;
}

export interface RelationshipOptions {
  relationshipTypes: Array<'files' | 'folders' | 'languages' | 'size' | 'temporal'>;
  maxResults: number;
  minScore: number;
  includeScoreBreakdown: boolean;
}

/**
 * Find conversations related to a reference conversation
 */
export function findRelatedConversations(
  referenceSummary: ConversationSummary,
  allSummaries: ConversationSummary[],
  conversationIds: string[],
  options: RelationshipOptions
): RelatedConversation[] {
  const related: RelatedConversation[] = [];

  // Get reference conversation index for temporal calculations
  const referenceIndex = conversationIds.indexOf(referenceSummary.composerId);

  for (const summary of allSummaries) {
    // Skip the reference conversation itself
    if (summary.composerId === referenceSummary.composerId) {
      continue;
    }

    const relationships = calculateRelationships(
      referenceSummary,
      summary,
      conversationIds,
      referenceIndex,
      options.relationshipTypes
    );

    const score = calculateCompositeScore(relationships, options.relationshipTypes);

    if (score >= options.minScore) {
      related.push({
        composerId: summary.composerId,
        relationshipScore: score,
        relationships,
        summary: summary.firstMessage || 'No preview available',
        scoreBreakdown: options.includeScoreBreakdown ?
          calculateScoreBreakdown(relationships, options.relationshipTypes) : undefined
      });
    }
  }

  // Sort by score and limit results
  return related
    .sort((a, b) => b.relationshipScore - a.relationshipScore)
    .slice(0, options.maxResults);
}

/**
 * Calculate relationships between two conversations
 */
function calculateRelationships(
  reference: ConversationSummary,
  candidate: ConversationSummary,
  conversationIds: string[],
  referenceIndex: number,
  relationshipTypes: string[]
): RelationshipScore {
  const relationships: RelationshipScore = {};

  if (relationshipTypes.includes('files')) {
    relationships.sharedFiles = calculateSharedItems(
      reference.relevantFiles,
      candidate.relevantFiles
    );
  }

  if (relationshipTypes.includes('folders')) {
    relationships.sharedFolders = calculateSharedItems(
      reference.attachedFolders,
      candidate.attachedFolders
    );
  }

  if (relationshipTypes.includes('languages')) {
    // Extract languages from both conversations (would need code block data)
    // For now, we'll use a placeholder - this would be enhanced with actual language extraction
    relationships.sharedLanguages = [];
  }

  if (relationshipTypes.includes('size')) {
    relationships.sizeSimilarity = calculateSizeSimilarity(
      reference.conversationSize,
      candidate.conversationSize
    );
  }

  if (relationshipTypes.includes('temporal')) {
    const candidateIndex = conversationIds.indexOf(candidate.composerId);
    relationships.temporalProximity = calculateTemporalProximity(
      referenceIndex,
      candidateIndex,
      conversationIds.length
    );
  }

  return relationships;
}

/**
 * Calculate shared items between two arrays
 */
function calculateSharedItems(array1: string[], array2: string[]): string[] {
  const set1 = new Set(array1);
  return array2.filter(item => set1.has(item));
}

/**
 * Calculate size similarity between two conversations
 */
function calculateSizeSimilarity(size1: number, size2: number): number {
  if (size1 === 0 && size2 === 0) return 1;
  if (size1 === 0 || size2 === 0) return 0;

  const maxSize = Math.max(size1, size2);
  const minSize = Math.min(size1, size2);

  return minSize / maxSize;
}

/**
 * Calculate temporal proximity based on ROWID distance
 */
function calculateTemporalProximity(
  index1: number,
  index2: number,
  totalConversations: number
): number {
  if (index1 === -1 || index2 === -1) return 0;

  const distance = Math.abs(index1 - index2);
  const maxDistance = totalConversations - 1;

  if (maxDistance === 0) return 1;

  // Closer conversations get higher scores
  return 1 - (distance / maxDistance);
}

/**
 * Calculate composite score from relationships
 */
function calculateCompositeScore(
  relationships: RelationshipScore,
  relationshipTypes: string[]
): number {
  let totalScore = 0;
  let weightSum = 0;

  // Define weights for different relationship types
  const weights = {
    files: 0.4,
    folders: 0.3,
    languages: 0.2,
    size: 0.05,
    temporal: 0.05
  };

  if (relationshipTypes.includes('files') && relationships.sharedFiles) {
    const score = Math.min(relationships.sharedFiles.length / 5, 1); // Cap at 5 shared files
    totalScore += score * weights.files;
    weightSum += weights.files;
  }

  if (relationshipTypes.includes('folders') && relationships.sharedFolders) {
    const score = Math.min(relationships.sharedFolders.length / 3, 1); // Cap at 3 shared folders
    totalScore += score * weights.folders;
    weightSum += weights.folders;
  }

  if (relationshipTypes.includes('languages') && relationships.sharedLanguages) {
    const score = Math.min(relationships.sharedLanguages.length / 3, 1); // Cap at 3 shared languages
    totalScore += score * weights.languages;
    weightSum += weights.languages;
  }

  if (relationshipTypes.includes('size') && relationships.sizeSimilarity !== undefined) {
    totalScore += relationships.sizeSimilarity * weights.size;
    weightSum += weights.size;
  }

  if (relationshipTypes.includes('temporal') && relationships.temporalProximity !== undefined) {
    totalScore += relationships.temporalProximity * weights.temporal;
    weightSum += weights.temporal;
  }

  return weightSum > 0 ? totalScore / weightSum : 0;
}

/**
 * Calculate individual score breakdown for debugging
 */
function calculateScoreBreakdown(
  relationships: RelationshipScore,
  relationshipTypes: string[]
): Record<string, number> {
  const breakdown: Record<string, number> = {};

  if (relationshipTypes.includes('files') && relationships.sharedFiles) {
    breakdown.files = Math.min(relationships.sharedFiles.length / 5, 1);
  }

  if (relationshipTypes.includes('folders') && relationships.sharedFolders) {
    breakdown.folders = Math.min(relationships.sharedFolders.length / 3, 1);
  }

  if (relationshipTypes.includes('languages') && relationships.sharedLanguages) {
    breakdown.languages = Math.min(relationships.sharedLanguages.length / 3, 1);
  }

  if (relationshipTypes.includes('size') && relationships.sizeSimilarity !== undefined) {
    breakdown.size = relationships.sizeSimilarity;
  }

  if (relationshipTypes.includes('temporal') && relationships.temporalProximity !== undefined) {
    breakdown.temporal = relationships.temporalProximity;
  }

  return breakdown;
}

/**
 * Extract languages from code blocks in conversation data
 */
export function extractLanguagesFromCodeBlocks(
  codeBlocks: Array<{ language: string; code: string }>
): string[] {
  const languages = new Set<string>();

  codeBlocks.forEach(block => {
    if (block.language && block.language.trim()) {
      languages.add(normalizeLanguage(block.language));
    }
  });

  return Array.from(languages);
}

/**
 * Normalize language names for consistency
 */
function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase().trim();

  // Common language mappings
  const mappings: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'yml': 'yaml',
    'md': 'markdown',
    'dockerfile': 'docker'
  };

  return mappings[normalized] || normalized;
}

/**
 * Calculate file overlap score between two conversations
 */
export function calculateFileOverlapScore(files1: string[], files2: string[]): number {
  if (files1.length === 0 && files2.length === 0) return 1;
  if (files1.length === 0 || files2.length === 0) return 0;

  const set1 = new Set(files1);
  const intersection = files2.filter(file => set1.has(file));
  const union = new Set([...files1, ...files2]);

  return intersection.length / union.size; // Jaccard similarity
}

/**
 * Calculate folder overlap score between two conversations
 */
export function calculateFolderOverlapScore(folders1: string[], folders2: string[]): number {
  if (folders1.length === 0 && folders2.length === 0) return 1;
  if (folders1.length === 0 || folders2.length === 0) return 0;

  const set1 = new Set(folders1);
  const intersection = folders2.filter(folder => set1.has(folder));
  const union = new Set([...folders1, ...folders2]);

  return intersection.length / union.size; // Jaccard similarity
}