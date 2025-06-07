import type { ConversationSummary } from '../database/types.js';

/**
 * Format conversion utilities for exporting conversation data
 */

export interface ExportMetadata {
  exportedCount: number;
  totalAvailable: number;
  exportTimestamp: string;
  filters: Record<string, any>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'conversation';
  attributes: {
    messageCount: number;
    size: number;
    hasCodeBlocks: boolean;
    format: 'legacy' | 'modern';
    fileCount: number;
    folderCount: number;
  };
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'shared_files' | 'shared_folders' | 'similar_size' | 'temporal_proximity';
  weight: number;
  attributes: {
    sharedItems?: string[];
    similarity?: number;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Export conversation data as JSON
 */
export function exportAsJSON(
  summaries: ConversationSummary[],
  includeContent: boolean,
  conversationData?: Map<string, any>
): any {
  if (!includeContent) {
    return summaries;
  }

  // Include full conversation content if available
  return summaries.map(summary => ({
    ...summary,
    fullContent: conversationData?.get(summary.composerId) || null
  }));
}

/**
 * Export conversation data as CSV
 */
export function exportAsCSV(
  summaries: ConversationSummary[],
  flattenStructure: boolean
): string {
  if (summaries.length === 0) {
    return 'No data to export';
  }

  const headers = [
    'composerId',
    'format',
    'messageCount',
    'hasCodeBlocks',
    'codeBlockCount',
    'conversationSize',
    'fileCount',
    'folderCount',
    'firstMessage',
    'relevantFiles',
    'attachedFolders'
  ];

  const rows = summaries.map(summary => [
    escapeCSVField(summary.composerId),
    escapeCSVField(summary.format),
    summary.messageCount.toString(),
    summary.hasCodeBlocks.toString(),
    summary.codeBlockCount.toString(),
    summary.conversationSize.toString(),
    summary.relevantFiles.length.toString(),
    summary.attachedFolders.length.toString(),
    escapeCSVField(summary.firstMessage || ''),
    escapeCSVField(flattenStructure ?
      summary.relevantFiles.join('; ') :
      JSON.stringify(summary.relevantFiles)
    ),
    escapeCSVField(flattenStructure ?
      summary.attachedFolders.join('; ') :
      JSON.stringify(summary.attachedFolders)
    )
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Export conversation data as graph format for visualization tools
 */
export function exportAsGraph(
  summaries: ConversationSummary[],
  includeRelationships: boolean
): GraphData {
  const nodes: GraphNode[] = summaries.map(summary => ({
    id: summary.composerId,
    label: summary.firstMessage?.substring(0, 50) || summary.composerId,
    type: 'conversation',
    attributes: {
      messageCount: summary.messageCount,
      size: summary.conversationSize,
      hasCodeBlocks: summary.hasCodeBlocks,
      format: summary.format,
      fileCount: summary.relevantFiles.length,
      folderCount: summary.attachedFolders.length
    }
  }));

  const edges: GraphEdge[] = [];

  if (includeRelationships) {
    // Calculate relationships between conversations
    for (let i = 0; i < summaries.length; i++) {
      for (let j = i + 1; j < summaries.length; j++) {
        const summary1 = summaries[i];
        const summary2 = summaries[j];

        // Shared files relationship
        const sharedFiles = calculateSharedItems(summary1.relevantFiles, summary2.relevantFiles);
        if (sharedFiles.length > 0) {
          edges.push({
            source: summary1.composerId,
            target: summary2.composerId,
            type: 'shared_files',
            weight: sharedFiles.length,
            attributes: {
              sharedItems: sharedFiles
            }
          });
        }

        // Shared folders relationship
        const sharedFolders = calculateSharedItems(summary1.attachedFolders, summary2.attachedFolders);
        if (sharedFolders.length > 0) {
          edges.push({
            source: summary1.composerId,
            target: summary2.composerId,
            type: 'shared_folders',
            weight: sharedFolders.length,
            attributes: {
              sharedItems: sharedFolders
            }
          });
        }

        // Size similarity relationship
        const sizeSimilarity = calculateSizeSimilarity(
          summary1.conversationSize,
          summary2.conversationSize
        );
        if (sizeSimilarity > 0.7) { // Only include high similarity
          edges.push({
            source: summary1.composerId,
            target: summary2.composerId,
            type: 'similar_size',
            weight: sizeSimilarity,
            attributes: {
              similarity: sizeSimilarity
            }
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Create export metadata
 */
export function createExportMetadata(
  exportedCount: number,
  totalAvailable: number,
  filters: Record<string, any>
): ExportMetadata {
  return {
    exportedCount,
    totalAvailable,
    exportTimestamp: new Date().toISOString(),
    filters
  };
}

/**
 * Escape CSV field to handle commas, quotes, and newlines
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
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
 * Convert graph data to Gephi-compatible GEXF format
 */
export function exportAsGEXF(graphData: GraphData): string {
  const { nodes, edges } = graphData;

  let gexf = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>Cursor Conversations MCP</creator>
    <description>Conversation relationship graph</description>
  </meta>
  <graph mode="static" defaultedgetype="undirected">
    <attributes class="node">
      <attribute id="0" title="messageCount" type="integer"/>
      <attribute id="1" title="size" type="integer"/>
      <attribute id="2" title="hasCodeBlocks" type="boolean"/>
      <attribute id="3" title="format" type="string"/>
      <attribute id="4" title="fileCount" type="integer"/>
      <attribute id="5" title="folderCount" type="integer"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="type" type="string"/>
      <attribute id="1" title="sharedItems" type="string"/>
      <attribute id="2" title="similarity" type="float"/>
    </attributes>
    <nodes>`;

  // Add nodes
  nodes.forEach(node => {
    gexf += `
      <node id="${escapeXML(node.id)}" label="${escapeXML(node.label)}">
        <attvalues>
          <attvalue for="0" value="${node.attributes.messageCount}"/>
          <attvalue for="1" value="${node.attributes.size}"/>
          <attvalue for="2" value="${node.attributes.hasCodeBlocks}"/>
          <attvalue for="3" value="${escapeXML(node.attributes.format)}"/>
          <attvalue for="4" value="${node.attributes.fileCount}"/>
          <attvalue for="5" value="${node.attributes.folderCount}"/>
        </attvalues>
      </node>`;
  });

  gexf += `
    </nodes>
    <edges>`;

  // Add edges
  edges.forEach((edge, index) => {
    gexf += `
      <edge id="${index}" source="${escapeXML(edge.source)}" target="${escapeXML(edge.target)}" weight="${edge.weight}">
        <attvalues>
          <attvalue for="0" value="${escapeXML(edge.type)}"/>
          <attvalue for="1" value="${escapeXML(edge.attributes.sharedItems?.join(', ') || '')}"/>
          <attvalue for="2" value="${edge.attributes.similarity || 0}"/>
        </attvalues>
      </edge>`;
  });

  gexf += `
    </edges>
  </graph>
</gexf>`;

  return gexf;
}

/**
 * Convert graph data to Cytoscape.js format
 */
export function exportAsCytoscape(graphData: GraphData): any {
  const { nodes, edges } = graphData;

  return {
    elements: [
      ...nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          ...node.attributes
        }
      })),
      ...edges.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          type: edge.type,
          ...edge.attributes
        }
      }))
    ]
  };
}

/**
 * Escape XML special characters
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}