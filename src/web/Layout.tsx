import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useProjects } from './state/ProjectContext';
import { useTranslation } from './i18n/LanguageContext';
import { useBranding } from './state/BrandingContext';
import LanguageSelector from './i18n/LanguageSelector';
import McpModal from './features/mcp-panel/McpModal';
import BrandingModal from './shared/BrandingModal';
import { Folder as FolderIcon, Plus, Minus, Trash2, Home, Moon, Sun, BookOpen, Bot, Pencil } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function Layout() {
  const { projects, folders, saveFolder, deleteFolder } = useProjects();
  const { t, locale } = useTranslation();
  const { activeLogo, openBrandingModal, logoWidth, setLogoWidth } = useBranding();
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

  const [logoAspect, setLogoAspect] = useState<number>(2.41);

  useEffect(() => {
    if (activeLogo) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setLogoAspect(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = activeLogo;
    }
  }, [activeLogo]);

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

  // Adapt white box size to match the logo proportions and user width preference
  // Sidebar is w-56 (224px), with p-4 available width is 192px
  const maxAvailableWidth = 192;
  const paddingBorder = 12; // 6px padding on each side (p-1.5)
  const targetBoxWidth = Math.max(60, (maxAvailableWidth * logoWidth) / 100);
  const maxAllowedImgHeight = 125;

  const aspect = logoAspect > 0 ? logoAspect : 2.41;
  let targetImgWidth = targetBoxWidth - paddingBorder;
  let targetImgHeight = targetImgWidth / aspect;

  if (targetImgHeight > maxAllowedImgHeight) {
    targetImgHeight = maxAllowedImgHeight;
    targetImgWidth = targetImgHeight * aspect;
  }

  const fittedBoxWidth = Math.round(targetImgWidth + paddingBorder);
  const fittedBoxHeight = Math.round(targetImgHeight + paddingBorder);

  return (
    <div className="h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-row overflow-hidden text-[11px] font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <div className="w-56 bg-gradient-to-b from-blue-950 to-emerald-950 flex flex-col border-r border-slate-700 shrink-0">
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex flex-col items-center gap-2 mb-4 w-full">
            <div className="relative group flex items-center justify-center">
              <div 
                onClick={openBrandingModal}
                className="bg-white dark:bg-slate-900 rounded-md shadow-xs p-1.5 flex items-center justify-center overflow-hidden border border-white/20 dark:border-slate-800 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all duration-150"
                style={{
                  width: `${fittedBoxWidth}px`,
                  height: `${fittedBoxHeight}px`,
                }}
                title={locale === 'zh' ? '点击修改品牌与报告 Logo / 调整宽度' : 'Click to customize branding and report logo / adjust width'}
              >
                <img 
                  src={activeLogo} 
                  alt="Organization Logo" 
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setLogoAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                  className="object-contain block transition-all"
                  style={{
                    width: `${Math.round(targetImgWidth)}px`,
                    height: `${Math.round(targetImgHeight)}px`,
                  }} 
                />
              </div>

              {/* Quick resize and edit controls on hover */}
              <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLogoWidth(Math.max(40, logoWidth - 10));
                  }}
                  disabled={logoWidth <= 40}
                  className="w-5 h-5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-md flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
                  title={locale === 'zh' ? '减小 Logo 宽度 (-10%)' : 'Decrease logo width (-10%)'}
                  aria-label="Decrease logo width"
                >
                  <Minus size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLogoWidth(Math.min(100, logoWidth + 10));
                  }}
                  disabled={logoWidth >= 100}
                  className="w-5 h-5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-md flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
                  title={locale === 'zh' ? '增加 Logo 宽度 (+10%)' : 'Increase logo width (+10%)'}
                  aria-label="Increase logo width"
                >
                  <Plus size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openBrandingModal();
                  }}
                  className="w-5 h-5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-md flex items-center justify-center cursor-pointer transition-colors"
                  title={locale === 'zh' ? '自定义品牌 Logo 与设置' : 'Customize branding logo & settings'}
                  aria-label="Customize logo"
                >
                  <Pencil size={10} />
                </button>
              </div>

              {/* Subtle width badge when customized */}
              {logoWidth < 100 && (
                <span className="absolute -bottom-2 right-0 text-[9px] font-mono px-1 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {logoWidth}%
                </span>
              )}
            </div>

            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="text-white font-bold text-lg tracking-tight text-center">{t('app_name', 'DOE Magic')}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">{t('app_version', 'v1.0.0')}</span>
            </Link>
          </div>
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

      {/* Custom Organization Branding Logo Modal */}
      <BrandingModal />
    </div>
  );
}
