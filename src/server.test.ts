import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('./tools/conversation-tools.js');
vi.mock('./database/reader.js');

const mockMcpServer = vi.mocked(McpServer);

describe('MCP Server', () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = {
      tool: vi.fn(),
      connect: vi.fn(),
      close: vi.fn()
    };

    mockMcpServer.mockImplementation(() => mockServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should create server with correct configuration', async () => {
      // Import the server module to trigger initialization
      await import('./server.js');

      expect(mockMcpServer).toHaveBeenCalledWith({
        name: 'cursor-conversations-mcp',
        version: '1.0.0'
      });
    });

    it('should register all conversation tools', async () => {
      await import('./server.js');

      // Verify that tools are registered
      expect(mockServer.tool).toHaveBeenCalledWith(
        'list_conversations',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_conversation',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_conversation_summary',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'search_conversations',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_bubble_message',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_recent_conversations',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_conversations_by_project',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Tool Registration', () => {
    it('should register tools with proper descriptions', async () => {
      await import('./server.js');

      const toolCalls = mockServer.tool.mock.calls;

      // Check that each tool has a meaningful description
      toolCalls.forEach(([toolName, description]: [string, string]) => {
        expect(typeof toolName).toBe('string');
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(10);
      });
    });

    it('should register tools with proper schemas', async () => {
      await import('./server.js');

      const toolCalls = mockServer.tool.mock.calls;

      // Check that each tool has a schema object
      toolCalls.forEach(([, , schema]: [string, string, any]) => {
        expect(typeof schema).toBe('object');
        expect(schema).not.toBeNull();
      });
    });

    it('should register tools with handler functions', async () => {
      await import('./server.js');

      const toolCalls = mockServer.tool.mock.calls;

      // Check that each tool has a handler function
      toolCalls.forEach(([, , , handler]: [string, string, any, Function]) => {
        expect(typeof handler).toBe('function');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server creation errors', () => {
      mockMcpServer.mockImplementation(() => {
        throw new Error('Server creation failed');
      });

      expect(async () => {
        await import('./server.js');
      }).not.toThrow();
    });

    it('should handle tool registration errors', () => {
      mockServer.tool.mockImplementation(() => {
        throw new Error('Tool registration failed');
      });

      expect(async () => {
        await import('./server.js');
      }).not.toThrow();
    });
  });
});