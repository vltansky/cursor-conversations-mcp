export type OutputFormat = 'json' | 'compact-json';

export function formatResponse(data: any, format?: OutputFormat): string {
  try {
    switch (format) {
      case 'compact-json':
        return JSON.stringify(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  } catch (error) {
    console.error('Formatting failed, falling back to JSON:', error);
    return JSON.stringify(data, null, 2);
  }
}