import React, { useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Upload, Trash2, ArrowRight, Search, FolderInput, ArchiveRestore, Sparkles } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useTranslation } from '../context/LanguageContext';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../types';

export default function Dashboard() {
  const { projects, folders, saveProject, deleteProject, resetSampleData, loading } = useProjects();
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
    return `${d.getDate()}. ${new Intl.DateTimeFormat(dateLocale, { month: 'long' }).format(d)} ${d.getFullYear()}`;
  };

  const location = useLocation();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [movingProject, setMovingProject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [importError, setImportError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const folderId = searchParams.get('folder');

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (folderId === 'archive') {
      filtered = filtered.filter(p => p.isArchived);
    } else {
      filtered = filtered.filter(p => !p.isArchived);
      if (folderId) {
        filtered = filtered.filter(p => p.folderId === folderId);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q)
      );
    }

    // Sort projects
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = a.createdAt - b.createdAt;
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt - b.updatedAt;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [projects, folderId, searchQuery, sortBy, sortOrder]);

  const currentFolder = folderId === 'archive' ? { id: 'archive', name: t('archive', 'Archive'), createdAt: 0 } : folders.find(f => f.id === folderId);

  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Validate JSON
        if (!json || typeof json !== 'object' || !Array.isArray(json.factors) || !Array.isArray(json.responses) || !Array.isArray(json.runs)) {
          setImportError(locale === 'zh' ? '项目文件格式无效，缺少核心 DOE 结构。' : 'Invalid project file format. The file is missing essential DOE structures.');
          return;
        }
        // generate a new id to prevent clashes
        const importedProject = {
          ...json,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        saveProject(importedProject);
        setImportError(null);
      } catch (err) {
        setImportError(locale === 'zh' ? '解析导入的 JSON 文件失败。' : 'Failed to parse imported JSON file.');
      }
    };
    reader.readAsText(file);
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newProject: Project = {
      id: uuidv4(),
      folderId: folderId || undefined,
      name,
      description: desc,
      factors: [],
      responses: [],
      runs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveProject(newProject);
    navigate(`/project/${newProject.id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400 gap-3 animate-in fade-in duration-300">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium tracking-wide">{t('loading', 'Loading experiments...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {importError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="font-bold ml-4 hover:underline">{t('close', 'Dismiss')}</button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {currentFolder ? (currentFolder.id === 'archive' ? (locale === 'zh' ? '已归档实验' : 'Archived Experiments') : `${currentFolder.name}`) : t('all_experiments', 'All Experiments')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">{t('dashboard_subtitle', 'Manage your design of experiments and optimize processes.')}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'createdAt' | 'updatedAt')}
              className="h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-slate-100 flex items-center"
            >
              <option value="updatedAt">{t('sort_updated', 'Last Edited')}</option>
              <option value="createdAt">{t('sort_created', 'Date Created')}</option>
              <option value="name">{t('sort_name', 'Name')}</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 shrink-0"
              title={sortOrder === 'asc' ? t('sort_asc', 'Ascending') : t('sort_desc', 'Descending')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('search_experiments', 'Search experiments...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 min-w-[200px] text-slate-900 dark:text-slate-100"
            />
          </div>
          {folderId !== 'archive' && (
            <div className="flex items-center gap-2">
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={resetSampleData}
                title={locale === 'zh' ? '加载九洲药业标准实验设计示例 (铃木偶联工艺优化)' : 'Load standard demo study (Mixed-Level Suzuki-Miyaura Coupling)'}
                className="h-8 px-3 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-md hover:bg-brand-100 dark:hover:bg-brand-900 font-medium flex items-center justify-center gap-1.5 text-[11px] transition-colors shrink-0"
              >
                <Sparkles size={14} className="text-amber-500" />
                {locale === 'zh' ? '示例项目' : 'Demo Studies'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700 shrink-0"
              >
                <Upload size={14} />
                {t('import_project', 'Import')}
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="h-8 px-3 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium flex items-center justify-center gap-1 text-[11px] shrink-0"
              >
                <Plus size={14} />
                {t('new_experiment', 'New Experiment')}
              </button>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
          <form onSubmit={handleCreate} className="space-y-3 max-w-md">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">{t('project_name_label', 'Experiment Name')}</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono"
                placeholder={locale === 'zh' ? '例如：铃木偶联反应产率与纯度工艺优化' : 'e.g. Yield Optimization phase 1'}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">{t('project_desc_label', 'Description')}</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono"
                placeholder={locale === 'zh' ? '简要描述实验目的、反应类型与研究背景...' : 'Brief description of the experiment...'}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium text-[11px]">
                {t('create_and_continue', 'Create')}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 font-medium text-[11px]">
                {t('cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map(project => (
          <div key={project.id} className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden flex flex-col hover:border-brand-300 transition-colors group">
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3 gap-2">
                <Link to={`/project/${project.id}`} className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-brand-600 transition-colors line-clamp-1 flex-1">
                  {project.name}
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  {project.isArchived ? (
                    <button 
                      onClick={(e) => { e.preventDefault(); saveProject({ ...project, isArchived: false, updatedAt: Date.now() }); }}
                      className="text-slate-400 hover:text-green-500 transition-colors p-0.5"
                      title={t('unarchive_experiment', 'Restore from Archive')}
                    >
                      <ArchiveRestore size={14} />
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.preventDefault(); setMovingProject(project.id); }}
                      className="text-slate-400 hover:text-blue-500 transition-colors p-0.5"
                      title={t('move_to_folder', 'Move to Folder')}
                    >
                      <FolderInput size={14} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.preventDefault(); deleteProject(project.id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                    title={project.isArchived ? t('delete_experiment', 'Delete permanently') : t('archive_experiment', 'Archive experiment')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {movingProject === project.id && (
                <div className="mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <select
                    autoFocus
                    className="w-full text-[11px] p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                    onChange={(e) => {
                      saveProject({ ...project, folderId: e.target.value || undefined, updatedAt: Date.now() });
                      setMovingProject(null);
                    }}
                    onBlur={() => setMovingProject(null)}
                    defaultValue={project.folderId || ""}
                  >
                    <option value="">{t('no_folder', 'No Folder (Root)')}</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-300 line-clamp-2 mb-3">{project.description || (locale === 'zh' ? '暂无项目描述。' : 'No description provided.')}</p>
              
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-3 space-y-0.5 font-mono">
                <div>{locale === 'zh' ? '创建时间: ' : 'Created: '}{formatDate(project.createdAt)}</div>
                <div>{locale === 'zh' ? '修改时间: ' : 'Last Edited: '}{formatDate(project.updatedAt)}</div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-auto">
                <span className="inline-flex items-center rounded bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 text-[10px] font-mono text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                  {project.factors.length} {t('factors', 'Factors')}
                </span>
                {project.factors.some(f => f.type === 'categorical') && (
                  <span className="inline-flex items-center rounded bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 text-[10px] font-mono text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold">
                    {locale === 'zh' ? '类别+数值' : 'Categorical + Numeric'}
                  </span>
                )}
                <span className="inline-flex items-center rounded bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-mono text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {project.responses.length} {t('responses', 'Responses')}
                </span>
                <span className="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {project.runs.length} {t('runs', 'Runs')}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/60 p-2 px-4">
              <Link to={`/project/${project.id}`} className="flex items-center justify-between text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                {t('open_experiment', 'Open Experiment')}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
        {filteredProjects.length === 0 && !showNew && (
          <div className="col-span-full border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 rounded-lg p-10 text-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('empty_projects_title', 'No experiments')}</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">{t('empty_projects_desc', 'Get started by creating a new design of experiments or loading a sample study.')}</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium inline-flex items-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700"
              >
                <Upload size={14} />
                {t('import_project', 'Import')}
              </button>
              <button
                onClick={resetSampleData}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700/50 rounded hover:bg-brand-50 dark:hover:bg-brand-950 font-medium inline-flex items-center gap-1 text-[11px]"
              >
                <Sparkles size={14} className="text-amber-500" />
                {locale === 'zh' ? '加载示例项目' : 'Load Demo Experiments'}
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium inline-flex items-center gap-1 text-[11px]"
              >
                <Plus size={14} />
                {t('new_experiment', 'New Experiment')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
