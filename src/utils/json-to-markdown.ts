import json2md from 'json2md';

/**
 * Converts any JSON object to markdown using the robust json2md library
 * This eliminates the formatting bugs we had with our custom formatter
 */
export function convertJsonToMarkdown(data: any): string {
  try {
    // Handle null or undefined
    if (data === null || data === undefined) {
      return '**No data available**';
    }

    // Handle primitive types
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }

    // Handle arrays
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '**Empty array**';
      }

      // If array of objects, create a table
      if (data.every(item => typeof item === 'object' && item !== null)) {
        const firstItem = data[0];
        const headers = Object.keys(firstItem);

        return json2md([
          {
            table: {
              headers: headers,
              rows: data.map(item => headers.map(header => String(item[header] || '')))
            }
          }
        ]);
      }

      // If array of primitives, create a list
      return json2md([
        {
          ul: data.map(item => String(item))
        }
      ]);
    }

    // Handle objects
    if (typeof data === 'object') {
      const markdownElements: any[] = [];

      for (const [key, value] of Object.entries(data)) {
        // Add heading for the key
        markdownElements.push({ h2: key });

        if (value === null || value === undefined) {
          markdownElements.push({ p: '*No value*' });
        } else if (typeof value === 'string') {
          markdownElements.push({ p: value });
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          markdownElements.push({ p: String(value) });
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            markdownElements.push({ p: '*Empty array*' });
          } else if (value.every(item => typeof item === 'object' && item !== null)) {
            // Array of objects - create table
            const firstItem = value[0];
            const headers = Object.keys(firstItem);
            markdownElements.push({
              table: {
                headers: headers,
                rows: value.map(item => headers.map(header => String(item[header] || '')))
              }
            });
          } else {
            // Array of primitives - create list
            markdownElements.push({
              ul: value.map(item => String(item))
            });
          }
        } else if (typeof value === 'object') {
          // Nested object - recursively convert
          const nestedMarkdown = convertJsonToMarkdown(value);
          markdownElements.push({ p: nestedMarkdown });
        }
      }

      return json2md(markdownElements);
    }

    // Fallback for any other type
    return String(data);

  } catch (error) {
    console.error('Error converting JSON to markdown:', error);
    return `**Error converting data to markdown:** ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}