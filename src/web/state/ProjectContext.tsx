import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Project, Folder } from '../../core/types';
import { sampleProjects, sampleFolders, demoCatalyticProject, demoFolder, createDemoProjectCopy, createDemoFolder } from '../../core/sampleProject';

interface ProjectContextType {
  projects: Project[];
  folders: Folder[];
  socket: Socket | null;
  saveProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  saveFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
  resetSampleData: () => Promise<boolean>;
  loadDemoProject: () => string;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const LOCAL_PROJECTS_KEY = 'doe_magic_projects';
const LOCAL_FOLDERS_KEY = 'doe_magic_folders';

function getInitialProjects(): Project[] {
  try {
    const saved = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out removed dataset
        const cleaned = parsed.filter(p => p && p.id !== 'proj-api-synthesis-01');
        const isValid = cleaned.every(p => p && p.id && Array.isArray(p.factors) && Array.isArray(p.responses) && Array.isArray(p.runs));
        if (isValid && cleaned.length > 0) {
          const hasDemo = cleaned.some(p => p.id === demoCatalyticProject.id);
          const result = hasDemo ? cleaned : [demoCatalyticProject, ...cleaned];
          try {
            localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(result));
          } catch (e) {}
          return result;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached projects:', e);
  }
  return [...sampleProjects];
}

function getInitialFolders(): Folder[] {
  try {
    const saved = localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter(f => f && f.id !== 'folder-synthesis');
        const hasDemoFolder = cleaned.some(f => f.id === demoFolder.id);
        const result = hasDemoFolder ? cleaned : [demoFolder, ...cleaned];
        try {
          localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(result));
        } catch (e) {}
        return result.length > 0 ? result : [demoFolder];
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached folders:', e);
  }
  return [...sampleFolders];
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(getInitialProjects);
  const [folders, setFolders] = useState<Folder[]>(getInitialFolders);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Sync data from server via HTTP and Socket.IO
  useEffect(() => {
    isMountedRef.current = true;

    // 1. Fetch via reliable HTTP REST API
    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(db => {
        if (!isMountedRef.current) return;
        if (db && Array.isArray(db.projects) && db.projects.length > 0) {
          setProjects(db.projects);
          setFolders(db.folders || []);
          try {
            localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(db.projects));
            localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(db.folders || []));
          } catch (e) {}
        } else if (db && Array.isArray(db.projects) && db.projects.length === 0) {
          // If server has no projects yet, sync our initial sample project to server
          const initP = getInitialProjects();
          const initF = getInitialFolders();
          setProjects(initP);
          setFolders(initF);
          if (initP[0]) {
            fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(initP[0])
            }).catch(() => {});
          }
          if (initF[0]) {
            fetch('/api/folders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(initF[0])
            }).catch(() => {});
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('HTTP data fetch failed, using local/fallback data:', err);
        setLoading(false);
      });

    // 2. Setup Socket.IO for real-time live sync if available
    let newSocket: Socket | null = null;
    try {
      newSocket = io({
        transports: ['polling', 'websocket'],
        timeout: 4000,
        reconnectionAttempts: 3
      });
      setSocket(newSocket);

      newSocket.on('sync_data', (db: { projects: Project[], folders?: Folder[] }) => {
        if (!isMountedRef.current) return;
        if (db && Array.isArray(db.projects) && db.projects.length > 0) {
          setProjects(db.projects);
          setFolders(db.folders || []);
          try {
            localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(db.projects));
            localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(db.folders || []));
          } catch (e) {}
        }
        setLoading(false);
      });

      newSocket.on('connect_error', (e) => {
        console.warn('Socket connect error (falling back to HTTP/local):', e.message);
        setLoading(false);
      });
    } catch (err) {
      console.warn('Socket init failed:', err);
      setLoading(false);
    }

    // Safety timeout: loading must never block the UI
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      if (newSocket) {
        newSocket.close();
      }
    };
  }, []);

  const saveProject = (project: Project) => {
    project.updatedAt = Date.now();
    setProjects((prev) => {
      const idx = prev.findIndex(p => p.id === project.id);
      const next = idx !== -1 ? [...prev] : [...prev, project];
      if (idx !== -1) next[idx] = project;
      try {
        localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Save to server via HTTP
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    }).catch(e => console.warn('Failed to save project via HTTP:', e));

    // Also broadcast via socket if connected
    if (socket && socket.connected) {
      socket.emit('update_project', project);
    }
  };

  const deleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    if (project.isArchived) {
      setProjects(prev => {
        const next = prev.filter(p => p.id !== id);
        try {
          localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      fetch(`/api/projects/${id}`, { method: 'DELETE' })
        .catch(e => console.warn('Failed to delete project via HTTP:', e));

      if (socket && socket.connected) {
        socket.emit('delete_project', id);
      }
    } else {
      const updatedProject = { ...project, isArchived: true, updatedAt: Date.now() };
      saveProject(updatedProject);
    }
  };

  const saveFolder = (folder: Folder) => {
    setFolders((prev) => {
      const idx = prev.findIndex(f => f.id === folder.id);
      const next = idx !== -1 ? [...prev] : [...prev, folder];
      if (idx !== -1) next[idx] = folder;
      try {
        localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(folder)
    }).catch(e => console.warn('Failed to save folder via HTTP:', e));

    if (socket && socket.connected) {
      socket.emit('update_folder', folder);
    }
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => {
      const next = prev.filter(f => f.id !== id);
      try {
        localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setProjects(prev => {
      const next = prev.map(p => p.folderId === id ? { ...p, folderId: undefined } : p);
      try {
        localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    fetch(`/api/folders/${id}`, { method: 'DELETE' })
      .catch(e => console.warn('Failed to delete folder via HTTP:', e));

    if (socket && socket.connected) {
      socket.emit('delete_folder', id);
    }
  };

  // Deletes every project and folder for every user, so only call it after the user confirmed (DATA-1).
  // Local state changes only once the server has reset; resolves to false if it did not.
  const resetSampleData = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/reset-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      setProjects(data.projects);
      setFolders(data.folders);
      try {
        localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(data.projects));
        localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(data.folders));
      } catch (e) {}
      return true;
    } catch (e) {
      console.warn('Failed to reset sample data on server:', e);
      return false;
    }
  };

  // Adds a fresh copy of the demo study and keeps every existing project. Returns the new project's id.
  const loadDemoProject = (): string => {
    const demo = createDemoProjectCopy(projects);
    if (demo.folderId && !folders.some(f => f.id === demo.folderId)) {
      saveFolder(createDemoFolder());
    }
    saveProject(demo);
    return demo.id;
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      folders,
      socket,
      saveProject,
      deleteProject,
      saveFolder,
      deleteFolder,
      resetSampleData,
      loadDemoProject,
      loading
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

