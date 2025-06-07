# Cursor Conversations MCP Server

**Give AI assistants access to your Cursor conversation history.**

A Model Context Protocol (MCP) server that allows Claude, GPT, and other AI assistants to read and analyze your Cursor conversation data. This enables personalized coding assistance based on your actual development patterns and history.

## What This Enables

Ask your AI assistant to:

- Analyze your conversation history to understand your coding patterns and usage statistics
- Generate project-specific rules based on your actual development discussions
- Extract insights from past problem-solving sessions and find related conversations
- Create documentation based on real conversations about your code
- Export conversation data for external analysis and visualization
- Find and apply solutions you've already worked through

## Key Benefits

**Generate Personalized Rules**: Create coding standards based on your actual development patterns, not generic best practices.

**Learn from Your History**: Extract insights from past conversations to improve future development.

**Context-Aware Assistance**: Get help that's informed by your specific projects and coding style.

**Pattern Recognition**: Identify recurring themes and solutions in your development work.

## Quick Start

### 1. Configure MCP
Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cursor-conversations": {
      "command": "npx",
      "args": ["-y", "--package=cursor-conversations-mcp", "cursor-conversations-mcp"]
    }
  }
}
```

### 2. Start Using
```
"Analyze my React conversations and create component guidelines"
"Look at my debugging sessions and create troubleshooting rules"
"Generate TypeScript coding standards based on my actual usage patterns"
```

## Available Tools

### Core Tools

- **`list_conversations`** - Browse conversations with filtering options
- **`get_conversation`** - Retrieve full conversation content with code and file references
- **`search_conversations`** - Enhanced search with multi-keyword, LIKE patterns, and text search
- **`get_project_conversations`** - Get project-specific conversations or recent activity

### Analytics & Data Extraction Tools

- **`get_conversation_analytics`** - Comprehensive analytics including usage patterns, file activity, programming language distribution, and temporal trends
- **`find_related_conversations`** - Find conversations related by shared files, folders, languages, size, or temporal proximity
- **`extract_conversation_elements`** - Extract files, code blocks, languages, metadata, and conversation structure with flexible grouping
- **`export_conversation_data`** - Export conversation data in JSON, CSV, or Graph formats for external analysis and visualization

## Common Use Cases

### Generate Coding Rules
```
"Search for TypeScript interface discussions and create naming conventions"
"Find all conversations about error handling patterns and create guidelines"
"Use keywords=['typescript', 'interface'] with AND operator to find interface discussions"
```

### Extract Best Practices
```
"Search with likePattern='%useState(%' to find all React hook usage examples"
"Use keywords=['react', 'state', 'management'] to find state management patterns"
"Search for '%class %extends%' pattern to analyze inheritance usage"
```

### Advanced Search Examples
```
"Find conversations about specific functions: likePattern='%useEffect(%'"
"Search for file-specific discussions: likePattern='%.tsx%' or likePattern='%.py%'"
"Multi-keyword AND search: keywords=['typescript', 'generic', 'interface']"
"Multi-keyword OR search: keywords=['react', 'vue', 'angular'] to compare frameworks"
```

### Create Project Documentation
```
"Generate API documentation based on conversations about the user service"
"Export conversation data about the auth module for technical documentation"
```

### Learn from Past Solutions
```
"Analyze my debugging conversations and create a troubleshooting guide"
"Find conversations related to performance optimization and extract insights"
```

### Data Analysis & Insights
```
"Get comprehensive analytics on my coding patterns over the last 3 months"
"Export all conversations with React code to CSV for analysis"
"Find conversations similar to this database migration discussion"
```

## Privacy & Security

- **Runs locally** - Your conversation data never leaves your machine
- **No external services** - Direct access to your local Cursor database
- **No API keys required** - No data sharing with external services
- **Full control** - You decide what data to access and when

## Installation

### For Development
```bash
git clone https://github.com/vltansky/cursor-conversations-mcp
cd cursor-conversations-mcp
yarn install
yarn build
```

### For Use
The npx configuration above handles installation automatically.

## Tool Reference

### Core Tools

**`list_conversations`**
- `limit` (default: 20) - Number of conversations to return
- `projectPath` - Filter by project path
- `hasCodeBlocks` - Filter conversations with/without code
- `keywords` - Search by keywords

**`get_conversation`**
- `conversationId` (required) - Conversation to retrieve
- `includeMetadata` (default: false) - Include additional metadata

**`search_conversations`** - Enhanced search with multiple methods
- **Simple Query**: `query` - Basic text search (backward compatible)
- **Multi-keyword**: `keywords` array with `keywordOperator` ('AND'/'OR')
- **LIKE Patterns**: `likePattern` - SQL LIKE patterns (% = any chars, _ = single char)
- `searchType` (default: 'all') - 'all', 'project', 'files', 'code'
- `maxResults` (default: 10) - Maximum results
- `includeCode` (default: true) - Include code blocks

Examples:
```json
// Simple search
{"query": "react hooks"}

// Multi-keyword AND
{"keywords": ["react", "typescript"], "keywordOperator": "AND"}

// LIKE pattern for function calls
{"likePattern": "%useState(%useEffect%"}
```

**`get_project_conversations`**
- `projectPath` - Project to filter by (optional - returns recent if omitted)
- `limit` (default: 20) - Number of results
- `filePattern` - File pattern filter

### Analytics & Data Extraction Tools

**`get_conversation_analytics`**
- `scope` (default: 'all') - 'all', 'recent', 'project'
- `projectPath` - Focus on specific project (required when scope='project')
- `recentDays` (default: 30) - Time window for recent scope
- `includeBreakdowns` (default: ['files', 'languages']) - Analysis types: 'files', 'languages', 'temporal', 'size'

**`find_related_conversations`**
- `referenceConversationId` (required) - Starting conversation
- `relationshipTypes` (default: ['files']) - 'files', 'folders', 'languages', 'size', 'temporal'
- `maxResults` (default: 10) - Number of results
- `minScore` (default: 0.1) - Minimum similarity score (0-1)
- `includeScoreBreakdown` (default: false) - Show individual relationship scores

**`extract_conversation_elements`**
- `conversationIds` - Specific conversations (optional, processes all if empty)
- `elements` (default: ['files', 'codeblocks']) - 'files', 'folders', 'languages', 'codeblocks', 'metadata', 'structure'
- `includeContext` (default: false) - Include surrounding message text
- `groupBy` (default: 'conversation') - 'conversation', 'element', 'none'
- `filters` - Filter by code length, file extensions, or languages

**`export_conversation_data`**
- `conversationIds` - Specific conversations (optional, exports all if empty)
- `format` (default: 'json') - 'json', 'csv', 'graph'
- `includeContent` (default: false) - Include full message text
- `includeRelationships` (default: false) - Calculate file/folder connections
- `flattenStructure` (default: false) - Flatten for CSV compatibility
- `filters` - Filter by size, code blocks, or project path

## Database Paths

Auto-detected locations:
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- **Windows**: `%APPDATA%/Cursor/User/globalStorage/state.vscdb`
- **Linux**: `~/.config/Cursor/User/globalStorage/state.vscdb`

## Technical Notes

- Supports both legacy and modern Cursor conversation formats
- Uses SQLite to access Cursor's conversation database
- Close Cursor before running to avoid database lock issues
- Conversations filtered by size (>1000 bytes) to exclude empty ones
- Uses ROWID for chronological ordering (UUIDs are not chronological)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT