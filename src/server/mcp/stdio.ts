#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import { createDoeMcpServer } from './doeMcpServer';
import { sampleProjects, sampleFolders } from '../../core/sampleProject';

const DATA_FILE = path.join(process.cwd(), 'data.json');

let db: any = { projects: [], folders: [] };
if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (!db.projects) db.projects = [];
    if (!db.folders) db.folders = [];
  } catch (e) {
    console.error('Failed to parse data.json in stdio server', e);
  }
}

if (!db.projects || db.projects.length === 0) {
  db.projects = [...sampleProjects];
}

if (!db.folders || db.folders.length === 0) {
  db.folders = [...sampleFolders];
}

db.projects = (db.projects || []).filter((p: any) => p.id !== 'proj-api-synthesis-01');
db.folders = (db.folders || []).filter((f: any) => f.id !== 'folder-synthesis');

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to save data.json in stdio server', e);
  }
}

const context = {
  getProjects: () => db.projects,
  getFolders: () => db.folders,
  saveProject: (p: any) => {
    const idx = db.projects.findIndex((x: any) => x.id === p.id);
    if (idx !== -1) {
      db.projects[idx] = p;
    } else {
      db.projects.push(p);
    }
    saveData();
  },
  deleteProject: (id: string) => {
    db.projects = db.projects.filter((p: any) => p.id !== id);
    saveData();
  },
  saveData,
  broadcastSync: () => {},
};

async function runStdio() {
  const mcpServer = createDoeMcpServer(context);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('DOE Magic MCP Server running on stdio');
}

runStdio().catch((err) => {
  console.error('Fatal error in DOE Magic stdio MCP server:', err);
  process.exit(1);
});
