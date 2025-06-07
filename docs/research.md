# Cursor Chat Storage Guide

## Overview

Cursor stores all chat conversations in a SQLite database located in your system's application support directory. This guide explains where to find your chats and how to access them.

## Storage Location

Your Cursor chat conversations are stored at:

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

**Full Path**: `/Users/[username]/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

## Database Details

- **Type**: SQLite 3.x database
- **Size**: ~1.5GB (varies based on chat history)
- **Format**: Key-value store in table `cursorDiskKV`
- **Structure**: Binary BLOB values with text keys

## Data Organization

### Main Tables
- `cursorDiskKV` - Primary key-value storage
- `ItemTable` - Additional metadata storage

### Key Types in cursorDiskKV

| Key Pattern | Description | Example |
|-------------|-------------|---------|
| `composerData:UUID` | Complete conversation data | `composerData:0003f899-8807-4f86-ab1b-a48f985cb580` |
| `messageRequestContext:UUID:UUID` | Message context and metadata | `messageRequestContext:013273b7-92e9-409a-816c-b671052557ea:89911dfd-87c3-4124-928f-d7c00fd7e273` |
| `bubbleId:UUID:UUID` | Individual message/bubble data | `bubbleId:00624634-f10c-4427-b2d1-52caef4e19cf:01cdaaf8-3c72-4984-8397-fb8079ad04fc` |
| `checkpointId:UUID` | Conversation checkpoints | `checkpointId:UUID` |
| `codeBlockDiff:UUID` | Code block differences | `codeBlockDiff:UUID` |

## Summarization Data Storage

**Location**: Summarization data is stored within the conversation JSON in `composerData:UUID` records.

**How to Find Conversations with Summarization**:
```sql
-- Find conversations containing summarization content
SELECT key FROM cursorDiskKV
WHERE key LIKE 'composerData:%'
AND value LIKE '%summarization%';
```

**Storage Format**: The summarization content appears to be embedded within the conversation data structure, likely in:
- Message text content
- Tool call parameters and results
- Conversation metadata

**Example Query to Extract Summarization Content**:
```sql
-- Get conversations with summarization and show first 500 characters
SELECT key, substr(value, 1, 500) FROM cursorDiskKV
WHERE key LIKE 'composerData:%'
AND value LIKE '%summarization%'
LIMIT 5;
```

**Note**: Summarization data is not stored in a separate table but is integrated into the regular conversation flow as part of the chat history. This means summarization requests and responses are treated as regular messages within the conversation structure.

## Accessing Your Chats

### Using SQLite Command Line

1. **Open Terminal** and navigate to the database:
   ```bash
   cd ~/Library/Application\ Support/Cursor/User/globalStorage/
   ```

2. **Open the database**:
   ```bash
   sqlite3 state.vscdb
   ```

3. **Basic queries**:

   **List all conversations:**
   ```sql
   SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%';
   ```

   **Count total conversations:**
   ```sql
   SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';
   ```

   **Get conversation data (replace UUID with actual ID):**
   ```sql
   SELECT value FROM cursorDiskKV WHERE key = 'composerData:UUID';
   ```

   **Check conversation size:**
   ```sql
   SELECT key, length(value) as size_bytes
   FROM cursorDiskKV
   WHERE key LIKE 'composerData:%'
   ORDER BY size_bytes DESC
   LIMIT 10;
   ```

   **⭐ Find most recent conversations (by insertion order):**
   ```sql
   SELECT key FROM cursorDiskKV
   WHERE key LIKE 'composerData:%' AND length(value) > 5000
   ORDER BY ROWID DESC LIMIT 10;
   ```

   **Extract user messages from conversations:**
   ```sql
   SELECT value FROM cursorDiskKV
   WHERE key = 'bubbleId:COMPOSER_UUID:BUBBLE_UUID';
   ```

### Data Format

Conversations are stored as JSON objects with different format versions:

#### Legacy Format (older conversations)
```json
{
  "composerId": "UUID",
  "richText": "",
  "hasLoaded": true,
  "text": "",
  "conversation": [
    {
      "type": 1,
      "attachedFoldersNew": [],
      "bubbleId": "UUID",
      "suggestedCodeBlocks": [],
      "relevantFiles": ["file1.tsx", "file2.css"],
      "text": "user message content..."
    }
  ]
}
```

#### Modern Format (newer conversations)
```json
{
  "_v": 3,
  "composerId": "UUID",
  "richText": "",
  "hasLoaded": true,
  "text": "",
  "fullConversationHeadersOnly": [
    {
      "bubbleId": "UUID",
      "type": 1
    },
    {
      "bubbleId": "UUID",
      "type": 2,
      "serverBubbleId": "UUID"
    }
  ]
}
```

**Key Differences:**
- Modern format uses `_v` version field
- Individual messages stored separately with `bubbleId:` keys
- `fullConversationHeadersOnly` contains message references
- Type 1 = User message, Type 2 = AI response

## Finding Recent Conversations

⚠️ **Important**: UUID ordering is NOT chronological! Use these methods instead:

### Method 1: ROWID Ordering (Most Reliable)
```sql
-- Get most recent conversations with content
SELECT key FROM cursorDiskKV
WHERE key LIKE 'composerData:%' AND length(value) > 5000
ORDER BY ROWID DESC LIMIT 5;
```

### Method 2: Extract User Messages
```bash
# Get user message text from a bubble
sqlite3 state.vscdb "SELECT value FROM cursorDiskKV WHERE key = 'bubbleId:COMPOSER_UUID:BUBBLE_UUID';" | grep -o '"text":"[^"]*"'
```

### Method 3: File Modification Time
```bash
# Check when database was last modified
ls -la ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb
```

## Statistics Example

Based on a typical Cursor installation:
- **Total conversations**: ~3,294
- **Database size**: ~1.5GB
- **Total records**: ~48,485
- **Average conversation size**: ~100-400KB

## Backup Recommendations

### Manual Backup
```bash
# Create a backup of your chat database
cp ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb ~/Desktop/cursor-chats-backup.db
```

### Export Conversations
```bash
# Export all conversation keys to a text file
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
"SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%';" > ~/Desktop/conversation-list.txt
```

### Export Recent Conversations with Content
```bash
# Export recent conversations with their sizes
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
"SELECT key, length(value) FROM cursorDiskKV WHERE key LIKE 'composerData:%' ORDER BY ROWID DESC LIMIT 20;" > ~/Desktop/recent-conversations.txt
```

## Important Notes

⚠️ **Warnings:**
- The database is actively used by Cursor - close Cursor before making changes
- Always backup before modifying the database
- The database format may change with Cursor updates
- UUID-based sorting does NOT reflect chronological order

💡 **Tips:**
- Use SQLite browser tools for easier exploration
- The database contains sensitive information - handle with care
- Large conversations may take time to load/export
- Use ROWID for finding recent conversations
- Modern conversations split messages into separate bubble records

## Troubleshooting

### Database Locked Error
If you get "database is locked" error:
1. Close Cursor completely
2. Wait a few seconds
3. Try the SQLite command again

### File Not Found
If the database file doesn't exist:
- Check if Cursor has been used for chats
- Verify the correct path for your OS
- Look for similar `.vscdb` files in the directory

### Empty Conversations
Some conversations may appear empty because:
- They use the modern format with separate bubble storage
- The conversation was just started but not used
- Messages are stored in `bubbleId:` keys instead of inline

## Alternative Tools

### SQLite Browser Applications
- **DB Browser for SQLite** (Free, cross-platform)
- **SQLiteStudio** (Free, cross-platform)
- **Navicat for SQLite** (Paid)

### Command Line Tools
```bash
# Install sqlite3 if not available
brew install sqlite3  # macOS with Homebrew

# View database schema
sqlite3 state.vscdb ".schema"

# Export entire database to SQL
sqlite3 state.vscdb ".dump" > backup.sql
```

## Practical Examples

### Find Your Last 5 Conversations
```bash
# Step 1: Find recent conversation IDs
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
"SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND length(value) > 5000 ORDER BY ROWID DESC LIMIT 5;"

# Step 2: Get user message from first bubble (replace UUIDs)
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
"SELECT value FROM cursorDiskKV WHERE key = 'bubbleId:COMPOSER_UUID:FIRST_BUBBLE_UUID';" | grep -o '"text":"[^"]*"'
```

### Search Conversations by Content
```bash
# Find conversations mentioning specific terms (requires extracting JSON)
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
"SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND value LIKE '%your_search_term%';"
```

---

*Last updated: Based on Cursor's current storage implementation with format version 3*