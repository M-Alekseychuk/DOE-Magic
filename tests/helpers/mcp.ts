// An in-process MCP client for src/server/mcp/doeMcpServer.ts, over the SDK's InMemoryTransport.
// The store is an in-memory array, so tests never touch data.json.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDoeMcpServer, type McpDatabaseContext } from '../../src/server/mcp/doeMcpServer';
import type { Project } from '../../src/core/types';

export async function connectMcp(projects: Project[]) {
  const store = [...projects];
  const context: McpDatabaseContext = {
    getProjects: () => store,
    getFolders: () => [],
    saveProject: (p) => {
      const i = store.findIndex((x) => x.id === p.id);
      if (i === -1) store.push(p);
      else store[i] = p;
    },
    deleteProject: (id) => {
      const i = store.findIndex((x) => x.id === id);
      if (i !== -1) store.splice(i, 1);
    },
    saveData: () => {},
    broadcastSync: () => {},
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createDoeMcpServer(context);
  await server.connect(serverTransport);
  const client = new Client({ name: 'doe-magic-tests', version: '0.0.0' });
  await client.connect(clientTransport);

  // Calls a tool and returns its text content (parsed as JSON when it is JSON) and the error flag.
  async function callTool(name: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string; json: any }> {
    const res: any = await client.callTool({ name, arguments: args });
    const text = (res.content ?? []).map((c: any) => c.text ?? '').join('');
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON (error messages are plain text)
    }
    return { isError: Boolean(res.isError), text, json };
  }

  return { client, callTool, store, close: () => client.close() };
}
