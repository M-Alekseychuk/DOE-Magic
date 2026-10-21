import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(process.cwd(), 'data.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

import { sampleProjects, sampleFolders } from './src/core/sampleProject';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createDoeMcpServer, handleDirectJsonRpc, mcpActivityLogs } from './src/server/mcp/doeMcpServer';

// Load data with realistic default experiments
let db: any = { projects: [], folders: [] };
if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (!db.projects) db.projects = [];
    if (!db.folders) db.folders = [];
  } catch (e) {
    console.error("Failed to parse data.json", e);
  }
}

// Seed default experiments if empty, or ensure the new demo project is included
if (!db.projects || db.projects.length === 0) {
  db.projects = [...sampleProjects];
} else {
  // Ensure all sample projects exist in db
  sampleProjects.forEach(sp => {
    if (!db.projects.some((p: any) => p.id === sp.id)) {
      db.projects.push(sp);
    }
  });
}

if (!db.folders || db.folders.length === 0) {
  db.folders = [...sampleFolders];
} else {
  sampleFolders.forEach(sf => {
    if (!db.folders.some((f: any) => f.id === sf.id)) {
      db.folders.push(sf);
    }
  });
}

// Purge deprecated sample datasets if present in database
db.projects = (db.projects || []).filter((p: any) => p.id !== 'proj-api-synthesis-01');
db.folders = (db.folders || []).filter((f: any) => f.id !== 'folder-synthesis');

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Failed to save data.json", e);
  }
}

// Socket IO real time sync
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial data
  socket.emit('sync_data', db);

  // Client updates project
  socket.on('update_project', (project: any) => {
    const index = db.projects.findIndex((p: any) => p.id === project.id);
    if (index !== -1) {
      db.projects[index] = project;
    } else {
      db.projects.push(project);
    }
    saveData();
    socket.broadcast.emit('sync_data', db);
  });

  socket.on('delete_project', (id: string) => {
    db.projects = db.projects.filter((p: any) => p.id !== id);
    saveData();
    socket.broadcast.emit('sync_data', db);
  });

  socket.on('update_folder', (folder: any) => {
    const index = db.folders.findIndex((f: any) => f.id === folder.id);
    if (index !== -1) {
      db.folders[index] = folder;
    } else {
      db.folders.push(folder);
    }
    saveData();
    socket.broadcast.emit('sync_data', db);
  });

  socket.on('delete_folder', (id: string) => {
    db.folders = db.folders.filter((f: any) => f.id !== id);
    // Move projects out of the folder
    db.projects = db.projects.map((p: any) => {
      if (p.folderId === id) return { ...p, folderId: undefined };
      return p;
    });
    saveData();
    socket.broadcast.emit('sync_data', db);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Gemini API integration for DOE suggestions and optimization removed to run entirely locally

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// REST API endpoints for rock-solid HTTP synchronization
app.get('/api/data', (req, res) => {
  res.json(db);
});

app.get('/api/projects', (req, res) => {
  res.json(db.projects || []);
});

app.post('/api/projects', (req, res) => {
  const project = req.body;
  if (!project || !project.id) {
    return res.status(400).json({ error: 'Invalid project payload' });
  }
  project.updatedAt = Date.now();
  const index = db.projects.findIndex((p: any) => p.id === project.id);
  if (index !== -1) {
    db.projects[index] = project;
  } else {
    db.projects.push(project);
  }
  saveData();
  io.emit('sync_data', db);
  res.json({ success: true, project });
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  db.projects = db.projects.filter((p: any) => p.id !== id);
  saveData();
  io.emit('sync_data', db);
  res.json({ success: true });
});

app.get('/api/folders', (req, res) => {
  res.json(db.folders || []);
});

app.post('/api/folders', (req, res) => {
  const folder = req.body;
  if (!folder || !folder.id) {
    return res.status(400).json({ error: 'Invalid folder payload' });
  }
  const index = db.folders.findIndex((f: any) => f.id === folder.id);
  if (index !== -1) {
    db.folders[index] = folder;
  } else {
    db.folders.push(folder);
  }
  saveData();
  io.emit('sync_data', db);
  res.json({ success: true, folder });
});

app.delete('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  db.folders = db.folders.filter((f: any) => f.id !== id);
  db.projects = db.projects.map((p: any) => {
    if (p.folderId === id) return { ...p, folderId: undefined };
    return p;
  });
  saveData();
  io.emit('sync_data', db);
  res.json({ success: true });
});

app.post('/api/reset-sample', (req, res) => {
  db = {
    projects: [...sampleProjects],
    folders: [...sampleFolders]
  };
  saveData();
  io.emit('sync_data', db);
  res.json({ success: true, data: db });
});

// ==========================================
// Model Context Protocol (MCP) Integration
// ==========================================
const mcpContext = {
  getProjects: () => db.projects || [],
  getFolders: () => db.folders || [],
  saveProject: (project: any) => {
    project.updatedAt = Date.now();
    const index = db.projects.findIndex((p: any) => p.id === project.id);
    if (index !== -1) {
      db.projects[index] = project;
    } else {
      db.projects.push(project);
    }
    saveData();
    io.emit('sync_data', db);
  },
  deleteProject: (id: string) => {
    db.projects = db.projects.filter((p: any) => p.id !== id);
    saveData();
    io.emit('sync_data', db);
  },
  saveData,
  broadcastSync: () => io.emit('sync_data', db),
};

const directMcpServer = createDoeMcpServer(mcpContext);
const mcpTransports = new Map<string, SSEServerTransport>();

// 1. MCP Server-Sent Events (SSE) Endpoint
const handleSseConnection = async (req: express.Request, res: express.Response) => {
  try {
    const clientServer = createDoeMcpServer(mcpContext);
    const transport = new SSEServerTransport('/api/mcp/messages', res);
    const sessionId = transport.sessionId;
    mcpTransports.set(sessionId, transport);

    req.on('close', () => {
      console.log(`MCP SSE client disconnected (session ${sessionId})`);
      mcpTransports.delete(sessionId);
    });

    await clientServer.connect(transport);
    console.log(`MCP client connected via SSE (session ${sessionId})`);
  } catch (err: any) {
    console.error('Error establishing MCP SSE connection:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};

app.get('/mcp/sse', handleSseConnection);
app.get('/api/mcp/sse', handleSseConnection);

// 2. MCP Client Message POST Endpoint
const handlePostMessage = async (req: express.Request, res: express.Response) => {
  const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string);
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId query parameter' });
  }

  const transport = mcpTransports.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: `MCP session '${sessionId}' not found or expired` });
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err: any) {
    console.error(`Error handling MCP POST message for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};

app.post('/mcp/messages', handlePostMessage);
app.post('/api/mcp/messages', handlePostMessage);

// 3. Direct JSON-RPC endpoint for one-shot tool calls or UI playground testing
const handleDirectMcp = async (req: express.Request, res: express.Response) => {
  try {
    const result = await handleDirectJsonRpc(directMcpServer, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err.message },
    });
  }
};

app.post('/mcp', handleDirectMcp);
app.post('/api/mcp', handleDirectMcp);

// 4. MCP Info & Discovery Endpoint
const handleMcpInfo = (req: express.Request, res: express.Response) => {
  // @ts-ignore
  const toolMap = (directMcpServer as any)._registeredTools || {};
  const tools = Object.entries(toolMap).map(([name, tool]: [string, any]) => ({
    name,
    description: tool.description,
    parameters: tool.inputSchema || tool.parameters || {},
  }));

  // @ts-ignore
  const resMap = (directMcpServer as any)._registeredResources || {};
  const resources = Object.keys(resMap);

  // @ts-ignore
  const promptMap = (directMcpServer as any)._registeredPrompts || {};
  const prompts = Object.entries(promptMap).map(([name, p]: [string, any]) => ({
    name,
    description: p.description,
  }));

  res.json({
    status: 'online',
    name: 'doe-magic-mcp',
    version: '1.5.2',
    protocolVersion: '2024-11-05',
    activeSessions: mcpTransports.size,
    endpoints: {
      sse: '/mcp/sse',
      apiSse: '/api/mcp/sse',
      messages: '/mcp/messages',
      apiMessages: '/api/mcp/messages',
      jsonRpc: '/api/mcp',
    },
    toolsCount: tools.length,
    tools,
    resources,
    prompts,
  });
};

app.get('/mcp/info', handleMcpInfo);
app.get('/api/mcp/info', handleMcpInfo);

// 5. MCP Activity Logs for UI
app.get('/api/mcp/logs', (req, res) => {
  res.json(mcpActivityLogs);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const isCloudRun = !!process.env.K_SERVICE || !!process.env.APP_URL;
    const clientPort = isCloudRun ? 443 : 3000;
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : {
          server: httpServer,
          clientPort: clientPort,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
