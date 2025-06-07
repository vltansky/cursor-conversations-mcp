import { convertJsonToMarkdown } from './json-to-markdown.js';

export type OutputFormat = 'json' | 'compact-json' | 'compact' | 'table' | 'markdown';

export function getOutputFormat(): OutputFormat {
  const format = process.env.MCP_OUTPUT_FORMAT || 'markdown';
  return format as OutputFormat;
}

export function formatResponse(data: any, format?: OutputFormat): string {
  const outputFormat = format || getOutputFormat();

  try {
    switch (outputFormat) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'compact-json':
        return JSON.stringify(data);
      case 'markdown':
        return convertJsonToMarkdown(data);
      case 'table':
        return convertJsonToMarkdown(data);
      case 'compact':
        return JSON.stringify(data, null, 1);
      default:
        return convertJsonToMarkdown(data);
    }
  } catch (error) {
    console.error('Formatting failed, falling back to JSON:', error);
    return JSON.stringify(data, null, 2);
  }
}