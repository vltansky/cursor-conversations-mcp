import type {
  ConversationSummary,
  ConversationAnalytics,
  RelatedConversationsResult,
  ExtractedElements,
  ExportedData
} from '../database/types.js';

// Output format types
export type OutputFormat = 'json' | 'compact-json' | 'compact' | 'table' | 'markdown';

// Environment-controlled format selection
export function getOutputFormat(): OutputFormat {
  const format = process.env.MCP_OUTPUT_FORMAT || 'markdown';
  return format as OutputFormat;
}

// Central formatting function
export function formatResponse(data: any, format?: OutputFormat): string {
  const outputFormat = format || getOutputFormat();

  if (outputFormat === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (outputFormat === 'compact-json') {
    return JSON.stringify(data);
  }

  // Intelligently detect data type and call appropriate formatter
  if (data.conversations && Array.isArray(data.conversations)) {
    return formatConversationList(data, outputFormat);
  }

  if (data.conversationId || data.composerId) {
    return formatConversationDetail(data, outputFormat);
  }

  if (data.overview && data.breakdowns) {
    return formatAnalytics(data as ConversationAnalytics, outputFormat);
  }

  if (data.reference && data.related) {
    return formatRelatedConversations(data as RelatedConversationsResult, outputFormat);
  }

  if (data.conversations && data.conversations[0]?.elements) {
    return formatExtractedElements(data as ExtractedElements, outputFormat);
  }

  if (data.format && data.data && data.metadata) {
    return formatExportedData(data as ExportedData, outputFormat);
  }

  // Search results
  if (data.results && Array.isArray(data.results)) {
    return formatSearchResults(data, outputFormat);
  }

  // Fallback for unknown types
  return formatAsCompactText(data);
}

// Format conversation lists (list_conversations)
function formatConversationList(data: any, format: OutputFormat): string {
  const { conversations, totalFound } = data;

  switch (format) {
    case 'table':
      return formatListAsTable(conversations, totalFound);
    case 'compact':
      return formatListAsStructuredText(conversations, totalFound);
    case 'markdown':
    default:
      return formatListAsMarkdown(conversations, totalFound);
  }
}

// Format individual conversation details (get_conversation)
function formatConversationDetail(data: any, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatConversationAsTable(data);
    case 'compact':
      return formatConversationAsStructuredText(data);
    case 'markdown':
    default:
      return formatConversationAsMarkdown(data);
  }
}

// Format analytics data
function formatAnalytics(data: ConversationAnalytics, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatAnalyticsAsTable(data);
    case 'compact':
      return formatAnalyticsAsStructuredText(data);
    case 'markdown':
    default:
      return formatAnalyticsAsMarkdown(data);
  }
}

// Format related conversations
function formatRelatedConversations(data: RelatedConversationsResult, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatRelatedAsTable(data);
    case 'compact':
      return formatRelatedAsStructuredText(data);
    case 'markdown':
    default:
      return formatRelatedAsMarkdown(data);
  }
}

// Format extracted elements
function formatExtractedElements(data: ExtractedElements, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatElementsAsTable(data);
    case 'compact':
      return formatElementsAsStructuredText(data);
    case 'markdown':
    default:
      return formatElementsAsMarkdown(data);
  }
}

// Format exported data
function formatExportedData(data: ExportedData, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatExportAsTable(data);
    case 'compact':
      return formatExportAsStructuredText(data);
    case 'markdown':
    default:
      return formatExportAsMarkdown(data);
  }
}

// Format search results
function formatSearchResults(data: any, format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatSearchAsTable(data);
    case 'compact':
      return formatSearchAsStructuredText(data);
    case 'markdown':
    default:
      return formatSearchAsMarkdown(data);
  }
}

// Structured text formatters
function formatListAsStructuredText(conversations: ConversationSummary[], totalFound?: number): string {
  let output = `CONVERSATIONS${totalFound ? ` (${totalFound} total)` : ''}:\n`;

  for (const conv of conversations) {
    const files = (conv.relevantFiles || []).slice(0, 3).join(',');
    const hasMore = (conv.relevantFiles || []).length > 3 ? '+' : '';
    const title = conv.title ? ` "${conv.title}"` : '';

    output += `${conv.composerId}${title} | ${conv.messageCount || 0}msg | `;
    output += `${conv.hasCodeBlocks ? '+code' : '-code'} | `;
    output += `${files}${hasMore}\n`;
  }

  return output;
}

function formatConversationAsStructuredText(data: any): string {
  let output = `CONVERSATION: ${data.conversationId || data.composerId}\n`;

  if (data.title) {
    output += `TITLE: ${data.title}\n`;
  }

  if (data.aiGeneratedSummary) {
    output += `SUMMARY: ${data.aiGeneratedSummary}\n`;
  }

  output += `MESSAGES: ${data.messageCount || data.messages?.length || 0}\n`;
  output += `CODE_BLOCKS: ${data.codeBlockCount || 0}\n`;

  if (data.relevantFiles?.length > 0) {
    output += `FILES: ${data.relevantFiles.join(', ')}\n`;
  }

  if (data.messages && data.messages.length > 0) {
    output += '\nMESSAGES:\n';
    for (let i = 0; i < Math.min(data.messages.length, 5); i++) {
      const msg = data.messages[i];
      const type = msg.type === 1 ? 'USER' : 'AI';
      const preview = msg.text.substring(0, 100).replace(/\n/g, ' ');
      output += `  ${i + 1}. [${type}] ${preview}${msg.text.length > 100 ? '...' : ''}\n`;
    }
    if (data.messages.length > 5) {
      output += `  ... and ${data.messages.length - 5} more messages\n`;
    }
  }

  return output;
}

function formatAnalyticsAsStructuredText(data: ConversationAnalytics): string {
  let output = 'CONVERSATION ANALYTICS:\n';

  const { overview } = data;
  output += `TOTAL_CONVERSATIONS: ${overview.totalConversations}\n`;
  output += `TOTAL_MESSAGES: ${overview.totalMessages}\n`;
  output += `TOTAL_CODE_BLOCKS: ${overview.totalCodeBlocks}\n`;
  output += `AVG_SIZE: ${Math.round(overview.averageConversationSize)} bytes\n`;

  if (data.breakdowns.files) {
    output += '\nTOP_FILES:\n';
    for (const file of data.breakdowns.files.slice(0, 10)) {
      output += `  ${file.file} (${file.mentions}x)\n`;
    }
  }

  if (data.breakdowns.languages) {
    output += '\nTOP_LANGUAGES:\n';
    for (const lang of data.breakdowns.languages.slice(0, 10)) {
      output += `  ${lang.language} (${lang.codeBlocks} blocks)\n`;
    }
  }

  return output;
}

function formatRelatedAsStructuredText(data: RelatedConversationsResult): string {
  let output = `RELATED TO: ${data.reference.composerId}\n`;
  output += `REFERENCE_FILES: ${data.reference.files.join(', ')}\n`;
  output += `FOUND: ${data.related.length} related conversations\n\n`;

  for (const rel of data.related) {
    output += `${rel.composerId} (score: ${rel.relationshipScore.toFixed(2)})\n`;
    if (rel.relationships.sharedFiles?.length) {
      output += `  shared_files: ${rel.relationships.sharedFiles.slice(0, 3).join(', ')}\n`;
    }
    if (rel.summary) {
      const summary = rel.summary.substring(0, 100).replace(/\n/g, ' ');
      output += `  summary: ${summary}${rel.summary.length > 100 ? '...' : ''}\n`;
    }
    output += '\n';
  }

  return output;
}

function formatElementsAsStructuredText(data: ExtractedElements): string {
  let output = `EXTRACTED ELEMENTS (${data.conversations.length} conversations):\n\n`;

  for (const conv of data.conversations) {
    output += `${conv.composerId}:\n`;

    if (conv.elements.files) {
      output += `  FILES (${conv.elements.files.length}): ${conv.elements.files.slice(0, 5).map(f => f.path).join(', ')}\n`;
    }

    if (conv.elements.languages) {
      output += `  LANGUAGES: ${conv.elements.languages.map(l => `${l.language}(${l.codeBlocks})`).join(', ')}\n`;
    }

    if (conv.elements.codeblocks) {
      output += `  CODE_BLOCKS: ${conv.elements.codeblocks.length} total\n`;
    }

    output += '\n';
  }

  return output;
}

function formatExportAsStructuredText(data: ExportedData): string {
  let output = `EXPORT DATA (${data.format.toUpperCase()}):\n`;
  output += `EXPORTED: ${data.metadata.exportedCount} items\n`;
  output += `TOTAL_AVAILABLE: ${data.metadata.totalAvailable}\n`;
  output += `TIMESTAMP: ${data.metadata.exportTimestamp}\n`;

  if (Object.keys(data.metadata.filters).length > 0) {
    output += `FILTERS: ${JSON.stringify(data.metadata.filters)}\n`;
  }

  // For non-JSON exports, show a preview
  if (data.format !== 'json') {
    const preview = typeof data.data === 'string' ? data.data.substring(0, 500) : JSON.stringify(data.data).substring(0, 500);
    output += `\nPREVIEW:\n${preview}${preview.length >= 500 ? '...' : ''}\n`;
  }

  return output;
}

function formatSearchAsStructuredText(data: any): string {
  const { results, totalFound, query, keywords, likePattern } = data;

  let output = 'SEARCH RESULTS:\n';
  if (query) output += `QUERY: "${query}"\n`;
  if (keywords) output += `KEYWORDS: ${keywords.join(', ')}\n`;
  if (likePattern) output += `PATTERN: "${likePattern}"\n`;
  output += `FOUND: ${totalFound || results.length} conversations\n\n`;

  for (const result of results) {
    output += `${result.composerId}\n`;
    if (result.matches && result.matches.length > 0) {
      const match = result.matches[0];
      const preview = match.text.substring(0, 100).replace(/\n/g, ' ');
      output += `  match: ${preview}${match.text.length > 100 ? '...' : ''}\n`;
    }
    if (result.relevantFiles?.length > 0) {
      output += `  files: ${result.relevantFiles.slice(0, 3).join(', ')}\n`;
    }
    output += '\n';
  }

  return output;
}

// Table formatters
function formatListAsTable(conversations: ConversationSummary[], totalFound?: number): string {
  let output = `CONVERSATIONS${totalFound ? ` (${totalFound} total)` : ''}\n`;
  output += `${'ID'.padEnd(20)} | MSGS | CODE | FILES\n`;
  output += `${'-'.repeat(20)} | ---- | ---- | -----\n`;

  for (const conv of conversations) {
    const id = conv.composerId.padEnd(20);
    const msgs = conv.messageCount.toString().padStart(4);
    const code = conv.hasCodeBlocks ? 'yes ' : 'no  ';
    const files = (conv.relevantFiles || []).slice(0, 2).join(',');

    output += `${id} | ${msgs} | ${code} | ${files}\n`;
  }

  return output;
}

function formatConversationAsTable(data: any): string {
  let output = `CONVERSATION DETAILS\n`;
  output += `${'Field'.padEnd(15)} | Value\n`;
  output += `${'-'.repeat(15)} | -----\n`;

  output += `${'ID'.padEnd(15)} | ${data.conversationId || data.composerId}\n`;
  if (data.title) output += `${'Title'.padEnd(15)} | ${data.title}\n`;
  output += `${'Messages'.padEnd(15)} | ${data.messageCount || data.messages?.length || 0}\n`;
  output += `${'Code Blocks'.padEnd(15)} | ${data.codeBlockCount || 0}\n`;
  output += `${'Files'.padEnd(15)} | ${data.relevantFiles?.length || 0}\n`;

  return output;
}

function formatAnalyticsAsTable(data: ConversationAnalytics): string {
  let output = 'ANALYTICS OVERVIEW\n';
  output += `${'Metric'.padEnd(20)} | Value\n`;
  output += `${'-'.repeat(20)} | -----\n`;

  const { overview } = data;
  output += `${'Conversations'.padEnd(20)} | ${overview.totalConversations}\n`;
  output += `${'Messages'.padEnd(20)} | ${overview.totalMessages}\n`;
  output += `${'Code Blocks'.padEnd(20)} | ${overview.totalCodeBlocks}\n`;
  output += `${'Avg Size'.padEnd(20)} | ${Math.round(overview.averageConversationSize)} bytes\n`;

  return output;
}

function formatRelatedAsTable(data: RelatedConversationsResult): string {
  let output = `RELATED CONVERSATIONS\n`;
  output += `${'ID'.padEnd(20)} | Score | Shared Files\n`;
  output += `${'-'.repeat(20)} | ----- | ------------\n`;

  for (const rel of data.related) {
    const id = rel.composerId.padEnd(20);
    const score = rel.relationshipScore.toFixed(2).padStart(5);
    const files = rel.relationships.sharedFiles?.slice(0, 2).join(',') || '';

    output += `${id} | ${score} | ${files}\n`;
  }

  return output;
}

function formatElementsAsTable(data: ExtractedElements): string {
  let output = `EXTRACTED ELEMENTS\n`;
  output += `${'Conversation'.padEnd(20)} | Files | Languages | Code\n`;
  output += `${'-'.repeat(20)} | ----- | --------- | ----\n`;

  for (const conv of data.conversations) {
    const id = conv.composerId.padEnd(20);
    const files = conv.elements.files?.length.toString().padStart(5) || '0'.padStart(5);
    const langs = conv.elements.languages?.length.toString().padStart(9) || '0'.padStart(9);
    const code = conv.elements.codeblocks?.length.toString().padStart(4) || '0'.padStart(4);

    output += `${id} | ${files} | ${langs} | ${code}\n`;
  }

  return output;
}

function formatExportAsTable(data: ExportedData): string {
  let output = `EXPORT SUMMARY\n`;
  output += `${'Field'.padEnd(15)} | Value\n`;
  output += `${'-'.repeat(15)} | -----\n`;

  output += `${'Format'.padEnd(15)} | ${data.format}\n`;
  output += `${'Exported'.padEnd(15)} | ${data.metadata.exportedCount}\n`;
  output += `${'Available'.padEnd(15)} | ${data.metadata.totalAvailable}\n`;
  output += `${'Timestamp'.padEnd(15)} | ${data.metadata.exportTimestamp}\n`;

  return output;
}

function formatSearchAsTable(data: any): string {
  const { results, totalFound } = data;

  let output = `SEARCH RESULTS (${totalFound || results.length} found)\n`;
  output += `${'ID'.padEnd(20)} | Matches | Files\n`;
  output += `${'-'.repeat(20)} | ------- | -----\n`;

  for (const result of results) {
    const id = result.composerId.padEnd(20);
    const matches = result.matches?.length.toString().padStart(7) || '0'.padStart(7);
    const files = result.relevantFiles?.length.toString() || '0';

    output += `${id} | ${matches} | ${files}\n`;
  }

  return output;
}

// Markdown formatters
function formatListAsMarkdown(conversations: ConversationSummary[], totalFound?: number): string {
  let output = `# Conversations${totalFound ? ` (${totalFound} total)` : ''}\n\n`;

  for (const conv of conversations) {
    output += `## ${conv.composerId}\n`;
    if (conv.title) output += `**Title**: ${conv.title}\n\n`;
    output += `- **Messages**: ${conv.messageCount}\n`;
    output += `- **Code blocks**: ${conv.hasCodeBlocks ? 'Yes' : 'No'}\n`;
    if (conv.relevantFiles?.length > 0) {
      output += `- **Files**: ${conv.relevantFiles.slice(0, 5).join(', ')}\n`;
    }
    if (conv.aiGeneratedSummary) {
      output += `- **Summary**: ${conv.aiGeneratedSummary}\n`;
    }
    output += '\n';
  }

  return output;
}

function formatConversationAsMarkdown(data: any): string {
  let output = `# Conversation: ${data.conversationId || data.composerId}\n\n`;

  if (data.title) {
    output += `**Title**: ${data.title}\n\n`;
  }

  if (data.aiGeneratedSummary) {
    output += `## Summary\n${data.aiGeneratedSummary}\n\n`;
  }

  output += `## Details\n`;
  output += `- **Messages**: ${data.messageCount || data.messages?.length || 0}\n`;
  output += `- **Code Blocks**: ${data.codeBlockCount || 0}\n`;
  output += `- **Files**: ${data.relevantFiles?.length || 0}\n\n`;

  if (data.relevantFiles?.length > 0) {
    output += `## Files\n`;
    for (const file of data.relevantFiles) {
      output += `- \`${file}\`\n`;
    }
    output += '\n';
  }

  return output;
}

function formatAnalyticsAsMarkdown(data: ConversationAnalytics): string {
  let output = '# Conversation Analytics\n\n';

  const { overview } = data;
  output += '## Overview\n';
  output += `- **Total Conversations**: ${overview.totalConversations}\n`;
  output += `- **Total Messages**: ${overview.totalMessages}\n`;
  output += `- **Total Code Blocks**: ${overview.totalCodeBlocks}\n`;
  output += `- **Average Size**: ${Math.round(overview.averageConversationSize)} bytes\n\n`;

  if (data.breakdowns.files) {
    output += '## Top Files\n';
    for (const file of data.breakdowns.files.slice(0, 10)) {
      output += `- \`${file.file}\` (${file.mentions} mentions)\n`;
    }
    output += '\n';
  }

  if (data.breakdowns.languages) {
    output += '## Top Languages\n';
    for (const lang of data.breakdowns.languages.slice(0, 10)) {
      output += `- **${lang.language}**: ${lang.codeBlocks} code blocks\n`;
    }
    output += '\n';
  }

  return output;
}

function formatRelatedAsMarkdown(data: RelatedConversationsResult): string {
  let output = `# Related Conversations\n\n`;
  output += `**Reference**: ${data.reference.composerId}\n\n`;

  for (const rel of data.related) {
    output += `## ${rel.composerId}\n`;
    output += `**Similarity Score**: ${rel.relationshipScore.toFixed(2)}\n\n`;

    if (rel.relationships.sharedFiles?.length) {
      output += `**Shared Files**: ${rel.relationships.sharedFiles.join(', ')}\n\n`;
    }

    if (rel.summary) {
      output += `**Summary**: ${rel.summary}\n\n`;
    }
  }

  return output;
}

function formatElementsAsMarkdown(data: ExtractedElements): string {
  let output = `# Extracted Elements\n\n`;
  output += `Processed ${data.conversations.length} conversations.\n\n`;

  for (const conv of data.conversations) {
    output += `## ${conv.composerId}\n\n`;

    if (conv.elements.files) {
      output += `### Files (${conv.elements.files.length})\n`;
      for (const file of conv.elements.files.slice(0, 10)) {
        output += `- \`${file.path}\`\n`;
      }
      if (conv.elements.files.length > 10) {
        output += `- ... and ${conv.elements.files.length - 10} more\n`;
      }
      output += '\n';
    }

    if (conv.elements.languages) {
      output += `### Languages\n`;
      for (const lang of conv.elements.languages) {
        output += `- **${lang.language}**: ${lang.codeBlocks} blocks\n`;
      }
      output += '\n';
    }
  }

  return output;
}

function formatExportAsMarkdown(data: ExportedData): string {
  let output = `# Export Summary\n\n`;
  output += `- **Format**: ${data.format}\n`;
  output += `- **Exported**: ${data.metadata.exportedCount} items\n`;
  output += `- **Total Available**: ${data.metadata.totalAvailable}\n`;
  output += `- **Timestamp**: ${data.metadata.exportTimestamp}\n\n`;

  if (Object.keys(data.metadata.filters).length > 0) {
    output += `## Filters Applied\n`;
    for (const [key, value] of Object.entries(data.metadata.filters)) {
      output += `- **${key}**: ${value}\n`;
    }
    output += '\n';
  }

  return output;
}

function formatSearchAsMarkdown(data: any): string {
  const { results, totalFound, query, keywords, likePattern } = data;

  let output = '# Search Results\n\n';
  if (query) output += `**Query**: "${query}"\n\n`;
  if (keywords) output += `**Keywords**: ${keywords.join(', ')}\n\n`;
  if (likePattern) output += `**Pattern**: \`${likePattern}\`\n\n`;
  output += `Found ${totalFound || results.length} conversations.\n\n`;

  for (const result of results) {
    output += `## ${result.composerId}\n\n`;

    if (result.matches && result.matches.length > 0) {
      output += `**Matches**: ${result.matches.length}\n\n`;
      const match = result.matches[0];
      output += `> ${match.text.substring(0, 200)}${match.text.length > 200 ? '...' : ''}\n\n`;
    }

    if (result.relevantFiles?.length > 0) {
      output += `**Files**: ${(result.relevantFiles || []).slice(0, 5).join(', ')}\n\n`;
    }
  }

  return output;
}

// Fallback formatter for unknown data types
function formatAsCompactText(data: any): string {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return `ARRAY (${data.length} items):\n${data.slice(0, 5).map((item, i) => `  ${i + 1}. ${JSON.stringify(item)}`).join('\n')}${data.length > 5 ? `\n  ... and ${data.length - 5} more` : ''}`;
  }

  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    let output = `OBJECT (${keys.length} fields):\n`;
    for (const key of keys.slice(0, 10)) {
      const value = data[key];
      const valueStr = typeof value === 'object' ? `[${typeof value}]` : String(value).substring(0, 50);
      output += `  ${key}: ${valueStr}\n`;
    }
    if (keys.length > 10) {
      output += `  ... and ${keys.length - 10} more fields\n`;
    }
    return output;
  }

  return String(data);
}