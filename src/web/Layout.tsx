import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useProjects } from './state/ProjectContext';
import { useTranslation } from './i18n/LanguageContext';
import LanguageSelector from './i18n/LanguageSelector';
import McpModal from './features/mcp-panel/McpModal';
import { Folder as FolderIcon, Plus, Trash2, Home, Moon, Sun, BookOpen, Bot } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import logoUrl from './assets/logo.png';

export default function Layout() {
  const { projects, folders, saveFolder, deleteFolder } = useProjects();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentProjectId = location.pathname.startsWith('/project/') 
    ? location.pathname.split('/')[2] 
    : null;
    
  const currentProject = projects.find(p => p.id === currentProjectId);

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder = { id: uuidv4(), name: newFolderName, createdAt: Date.now() };
    saveFolder(folder);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const confirmDeleteFolder = (id: string) => {
    deleteFolder(id);
  };

  return (
    <div className="h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-row overflow-hidden text-[11px] font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <div className="w-56 bg-gradient-to-b from-blue-950 to-emerald-950 flex flex-col border-r border-slate-700 shrink-0">
        <div className="p-4 border-b border-slate-800/50">
          <Link to="/" className="flex flex-col items-center gap-2 mb-4 hover:opacity-90 transition-opacity">
            <div className="w-40 bg-white rounded-md shadow-sm flex items-center justify-center overflow-hidden border border-white/20 p-1">
              <img src={logoUrl} alt="Jiuzhou Pharmaceutical" className="w-full h-auto object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg tracking-tight text-center">{t('app_name', 'DOE Magic')}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">{t('app_version', 'v.1.5.2')}</span>
            </div>
          </Link>
          <div className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">{t('current_experiment', 'Current Experiment')}</div>
          <div className="text-white font-medium truncate">
            {currentProject ? currentProject.name : t('none_selected', 'None Selected')}
          </div>
        </div>
        
        <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-2">
          <Link to="/" className={`px-2 py-2 flex items-center gap-2 rounded ${location.pathname === '/' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800/50'}`}>
            <Home size={14} />
            {t('all_experiments', 'All Experiments')}
          </Link>

          <div className="mt-4 px-2 text-slate-400 font-bold uppercase text-[9px] tracking-widest flex justify-between items-center group">
            <span>{t('folders', 'Folders')}</span>
            <button onClick={() => setIsCreatingFolder(true)} className="text-slate-500 dark:text-slate-300 hover:text-white p-0.5"><Plus size={12}/></button>
          </div>

          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="px-2 py-1 mt-1">
              <input 
                type="text" 
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder={t('folder_name_placeholder', 'Folder name...')}
                autoFocus
                onBlur={() => { if(!newFolderName) setIsCreatingFolder(false); }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-[11px] focus:outline-none focus:border-brand-500"
              />
            </form>
          )}

          {folders.map(folder => {
            const isActive = location.pathname === `/?folder=${folder.id}` || location.search.includes(`folder=${folder.id}`);
            return (
              <div key={folder.id} className={`group flex items-center justify-between px-2 py-1.5 rounded ${isActive ? 'bg-slate-800/50 text-white' : 'text-slate-400 hover:bg-slate-800/50'}`}>
                <Link to={`/?folder=${folder.id}`} className="flex items-center gap-2 flex-1 truncate">
                  <FolderIcon size={14} className={isActive ? "text-brand-400" : ""} />
                  <span className="truncate">{folder.name}</span>
                </Link>
                <button 
                  onClick={() => confirmDeleteFolder(folder.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-300 hover:text-red-400 transition-opacity p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          
          <div className="mt-2">
            <Link to="/?folder=archive" className={`group flex items-center justify-between px-2 py-1.5 rounded ${location.search.includes('folder=archive') ? 'bg-slate-800/50 text-white' : 'text-slate-400 hover:bg-slate-800/50'}`}>
              <div className="flex items-center gap-2 flex-1 truncate">
                <FolderIcon size={14} className={location.search.includes('folder=archive') ? "text-brand-400" : ""} />
                <span className="truncate">{t('archive', 'Archive')}</span>
              </div>
            </Link>
          </div>
          
          {currentProject && (
            <>
              <div className="mt-4 px-2 py-2 text-slate-400 font-bold uppercase text-[9px] tracking-widest">{t('design_construction', 'Design Construction')}</div>
              <Link to={`/project/${currentProject.id}`} className={`px-2 py-2 flex items-center gap-2 rounded ${location.pathname === `/project/${currentProject.id}` ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800/50'}`}>
                 {t('experiment_setup_matrix', 'Experiment Setup & Matrix')}
              </Link>
            </>
          )}
        </div>
        
        <div className="p-3 border-t border-slate-800/50 flex flex-col gap-2">
          <Link 
            to="/guide" 
            className={`px-2 py-2 flex items-center gap-2 rounded ${
              location.pathname === '/guide' 
                ? 'bg-brand-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <BookOpen size={14} />
            {t('step_by_step_guide', 'Step-by-Step Guide')}
          </Link>

          {/* Language Switcher Dropdown Menu at bottom of sidebar */}
          <LanguageSelector />

          {/* MCP Server Endpoint Quick Access */}
          <button
            onClick={() => setIsMcpModalOpen(true)}
            className="w-full px-2 py-2 flex items-center gap-2 rounded text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors text-left"
            title="Model Context Protocol (MCP) Server Endpoint"
          >
            <Bot size={14} className="text-emerald-400" />
            <span>{t('mcp_server', 'MCP Server')}</span>
          </button>

          <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-800/40">
            <span className="text-slate-400 flex items-center gap-2">
              {isDarkMode ? <Moon size={14} /> : <Sun size={14} />}
              {t('dark_mode', 'Dark Mode')}
            </span>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-8 h-4 rounded-full transition-colors relative ${isDarkMode ? 'bg-brand-500' : 'bg-slate-700'}`}
              aria-label={t('dark_mode', 'Dark Mode')}
            >
              <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Grid */}
        <div className="flex-1 overflow-auto p-4 transition-colors duration-200">
          <Outlet />
        </div>
      </div>

      {/* Interactive MCP Server Endpoint Modal */}
      <McpModal isOpen={isMcpModalOpen} onClose={() => setIsMcpModalOpen(false)} />
    </div>
  );
}
