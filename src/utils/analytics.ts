import type { ConversationSummary } from '../database/types.js';

/**
 * Statistical calculations for conversation analytics
 */

export interface AnalyticsOverview {
  totalConversations: number;
  totalMessages: number;
  totalCodeBlocks: number;
  averageConversationSize: number;
  averageMessagesPerConversation: number;
  totalFiles: number;
  totalFolders: number;
}

export interface FileBreakdown {
  file: string;
  mentions: number;
  conversations: string[];
  extension: string;
  projectPath?: string;
}

export interface LanguageBreakdown {
  language: string;
  codeBlocks: number;
  conversations: string[];
  averageCodeLength: number;
}

export interface TemporalBreakdown {
  period: string;
  conversationCount: number;
  messageCount: number;
  averageSize: number;
}

export interface SizeDistribution {
  distribution: number[];
  percentiles: Record<string, number>;
  bins: Array<{ range: string; count: number }>;
}

/**
 * Calculate basic overview statistics from conversation summaries
 */
export function calculateOverview(summaries: ConversationSummary[]): AnalyticsOverview {
  const totalConversations = summaries.length;
  const totalMessages = summaries.reduce((sum, s) => sum + s.messageCount, 0);
  const totalCodeBlocks = summaries.reduce((sum, s) => sum + s.codeBlockCount, 0);
  const totalSize = summaries.reduce((sum, s) => sum + s.conversationSize, 0);

  // Collect unique files and folders
  const allFiles = new Set<string>();
  const allFolders = new Set<string>();

  summaries.forEach(summary => {
    summary.relevantFiles.forEach(file => allFiles.add(file));
    summary.attachedFolders.forEach(folder => allFolders.add(folder));
  });

  return {
    totalConversations,
    totalMessages,
    totalCodeBlocks,
    averageConversationSize: totalConversations > 0 ? totalSize / totalConversations : 0,
    averageMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
    totalFiles: allFiles.size,
    totalFolders: allFolders.size
  };
}

/**
 * Calculate file breakdown with mentions and conversations
 */
export function calculateFileBreakdown(summaries: ConversationSummary[]): FileBreakdown[] {
  const fileMap = new Map<string, { mentions: number; conversations: string[]; extension: string }>();

  for (const summary of summaries) {
    const files = new Set([
      ...(summary.relevantFiles || []),
      ...(summary.attachedFolders || [])
    ]);

    for (const file of files) {
      if (!fileMap.has(file)) {
        fileMap.set(file, {
          mentions: 0,
          conversations: [],
          extension: getFileExtension(file)
        });
      }

      const entry = fileMap.get(file)!;
      entry.mentions++;
      entry.conversations.push(summary.composerId);
    }
  }

  return Array.from(fileMap.entries())
    .map(([file, data]) => ({
      file,
      mentions: data.mentions,
      conversations: data.conversations,
      extension: data.extension
    }))
    .sort((a, b) => b.mentions - a.mentions);
}

/**
 * Calculate language breakdown from code blocks
 */
export function calculateLanguageBreakdown(
  conversationsWithCode: Array<{
    composerId: string;
    codeBlocks: Array<{ language: string; code: string }>;
  }>
): LanguageBreakdown[] {
  const languageMap = new Map<string, {
    codeBlocks: number;
    conversations: Set<string>;
    totalCodeLength: number;
  }>();

  conversationsWithCode.forEach(({ composerId, codeBlocks }) => {
    codeBlocks.forEach(block => {
      const language = normalizeLanguage(block.language);
      if (!languageMap.has(language)) {
        languageMap.set(language, {
          codeBlocks: 0,
          conversations: new Set(),
          totalCodeLength: 0
        });
      }
      const entry = languageMap.get(language)!;
      entry.codeBlocks++;
      entry.conversations.add(composerId);
      entry.totalCodeLength += block.code.length;
    });
  });

  return Array.from(languageMap.entries())
    .map(([language, data]) => ({
      language,
      codeBlocks: data.codeBlocks,
      conversations: Array.from(data.conversations),
      averageCodeLength: data.codeBlocks > 0 ? data.totalCodeLength / data.codeBlocks : 0
    }))
    .sort((a, b) => b.codeBlocks - a.codeBlocks);
}

/**
 * Calculate temporal breakdown using ROWID ordering as proxy for time
 */
export function calculateTemporalBreakdown(
  summaries: ConversationSummary[],
  conversationIds: string[]
): TemporalBreakdown[] {
  const totalConversations = conversationIds.length;
  const binsCount = Math.min(10, Math.max(3, Math.floor(totalConversations / 10)));
  const conversationsPerBin = Math.ceil(totalConversations / binsCount);

  const bins: TemporalBreakdown[] = [];

  for (let i = 0; i < binsCount; i++) {
    const startIndex = i * conversationsPerBin;
    const endIndex = Math.min(startIndex + conversationsPerBin, totalConversations);
    const binIds = conversationIds.slice(startIndex, endIndex);

    const binSummaries = summaries.filter(s => binIds.includes(s.composerId));
    const totalSize = binSummaries.reduce((sum, s) => sum + s.conversationSize, 0);
    const averageSize = binSummaries.length > 0 ? totalSize / binSummaries.length : 0;

    bins.push({
      period: `Period ${i + 1}`,
      conversationCount: binSummaries.length,
      messageCount: binSummaries.reduce((sum, s) => sum + s.messageCount, 0),
      averageSize: Math.round(averageSize)
    });
  }

  return bins;
}

/**
 * Calculate size distribution with percentiles and bins
 */
export function calculateSizeDistribution(summaries: ConversationSummary[]): SizeDistribution {
  const sizes = summaries.map(s => s.conversationSize).sort((a, b) => a - b);

  if (sizes.length === 0) {
    return {
      distribution: [],
      percentiles: {},
      bins: []
    };
  }

  // Calculate percentiles
  const percentiles = {
    p10: calculatePercentile(sizes, 10),
    p25: calculatePercentile(sizes, 25),
    p50: calculatePercentile(sizes, 50),
    p75: calculatePercentile(sizes, 75),
    p90: calculatePercentile(sizes, 90),
    p95: calculatePercentile(sizes, 95),
    p99: calculatePercentile(sizes, 99)
  };

  // Create size bins
  const minSize = sizes[0];
  const maxSize = sizes[sizes.length - 1];
  const binCount = 10;
  const binSize = (maxSize - minSize) / binCount;

  const bins: Array<{ range: string; count: number }> = [];
  for (let i = 0; i < binCount; i++) {
    const binStart = minSize + (i * binSize);
    const binEnd = i === binCount - 1 ? maxSize : binStart + binSize;
    const count = sizes.filter(size => size >= binStart && size <= binEnd).length;

    bins.push({
      range: `${formatSize(binStart)} - ${formatSize(binEnd)}`,
      count
    });
  }

  return {
    distribution: sizes,
    percentiles,
    bins
  };
}

/**
 * Calculate percentile value from sorted array
 */
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;

  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedArray[lower];
  }

  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Extract file extension from file path
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

  if (lastDot > lastSlash && lastDot !== -1) {
    return filePath.substring(lastDot + 1).toLowerCase();
  }

  return '';
}

/**
 * Extract project path from file path (first few directories)
 */
function extractProjectPath(filePath: string): string | undefined {
  const parts = filePath.split(/[/\\]/);
  if (parts.length > 2) {
    return parts.slice(0, 2).join('/');
  }
  return undefined;
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
 * Format size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }