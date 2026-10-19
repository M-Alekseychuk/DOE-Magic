import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Plus, Pencil, X, Check, Trash2, Download, Upload, 
  ArrowRight, ExternalLink, ChevronUp, ChevronDown, Sparkles 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { useTranslation } from '../context/LanguageContext';

export interface SopStep {
  id: string;
  badge: string;
  badgeColor?: string; // e.g. blue, cyan, emerald, purple, amber
  title: string;
  description: string;
  guidelines: string[];
  moduleName?: string;
  moduleTarget?: 'setup' | 'design' | 'analysis' | 'compare' | 'robustness' | 'optimization';
}

const STORAGE_KEY = 'axiom_doe_sop_steps_v1';

const DEFAULT_STEPS: SopStep[] = [];

const BADGE_COLOR_MAP: Record<string, { badgeBg: string; badgeText: string; dotBg: string; lineBorder: string }> = {
  blue: {
    badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
    badgeText: 'text-blue-700 dark:text-blue-300',
    dotBg: 'bg-blue-600',
    lineBorder: 'border-blue-400 dark:border-blue-500'
  },
  cyan: {
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/50',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    dotBg: 'bg-cyan-500',
    lineBorder: 'border-cyan-400 dark:border-cyan-500'
  },
  emerald: {
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    dotBg: 'bg-emerald-500',
    lineBorder: 'border-emerald-400 dark:border-emerald-500'
  },
  purple: {
    badgeBg: 'bg-purple-100 dark:bg-purple-900/50',
    badgeText: 'text-purple-700 dark:text-purple-300',
    dotBg: 'bg-purple-500',
    lineBorder: 'border-purple-400 dark:border-purple-500'
  },
  amber: {
    badgeBg: 'bg-amber-100 dark:bg-amber-900/50',
    badgeText: 'text-amber-700 dark:text-amber-300',
    dotBg: 'bg-amber-500',
    lineBorder: 'border-amber-400 dark:border-amber-500'
  }
};

export default function GuideView() {
  const { t, locale } = useTranslation();
  const [steps, setSteps] = useState<SopStep[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastCleared, setLastCleared] = useState<SopStep[] | null>(null);

  // Form edit states
  const [formBadge, setFormBadge] = useState('');
  const [formBadgeColor, setFormBadgeColor] = useState('blue');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGuidelines, setFormGuidelines] = useState('');
  const [formModuleName, setFormModuleName] = useState('');
  const [formModuleTarget, setFormModuleTarget] = useState<'setup' | 'design' | 'analysis' | 'compare' | 'robustness' | 'optimization'>('setup');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { projects } = useProjects();
  const currentProject = projects[0];

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // If the stored data was the previous 3-step default, reset to empty default
          const isOldDefault =
            parsed.length === 3 &&
            parsed[0]?.id === 'step-1' &&
            parsed[0]?.title === 'Reaction Scheme & Factor Setup';
          if (!isOldDefault) {
            setSteps(parsed);
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load steps from storage:', e);
    }
    // Default initial steps is the empty version
    setSteps(DEFAULT_STEPS);
  }, []);

  const saveSteps = (updated: SopStep[]) => {
    setSteps(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleStartEdit = (step: SopStep) => {
    setEditingStepId(step.id);
    setIsAddingNew(false);
    setFormBadge(step.badge);
    setFormBadgeColor(step.badgeColor || 'blue');
    setFormTitle(step.title);
    setFormDescription(step.description);
    setFormGuidelines(step.guidelines.join('\n'));
    setFormModuleName(step.moduleName || '');
    setFormModuleTarget(step.moduleTarget || 'setup');
  };

  const handleStartNewStep = () => {
    setIsAddingNew(true);
    setEditingStepId(null);
    const stepNumber = steps.length + 1;
    const colors = ['blue', 'cyan', 'emerald', 'purple', 'amber'];
    const assignedColor = colors[(stepNumber - 1) % colors.length];

    setFormBadge(`STEP ${stepNumber} PROTOCOL`);
    setFormBadgeColor(assignedColor);
    setFormTitle(`Execution Step ${stepNumber}`);
    setFormDescription('Provide standard operating instructions and specifications for this experimental stage.');
    setFormGuidelines('Check initial conditions and calibration\nRecord physical observation and timestamps\nVerify sensor readouts and tolerances');
    setFormModuleName('Launch Module');
    setFormModuleTarget('setup');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Please enter a step title.');
      return;
    }

    const guidelinesArray = formGuidelines
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (isAddingNew) {
      const newStep: SopStep = {
        id: `step-${Date.now()}`,
        badge: formBadge.trim() || 'STEP',
        badgeColor: formBadgeColor,
        title: formTitle.trim(),
        description: formDescription.trim(),
        guidelines: guidelinesArray,
        moduleName: formModuleName.trim() || undefined,
        moduleTarget: formModuleTarget
      };
      const updated = [...steps, newStep];
      saveSteps(updated);
      setIsAddingNew(false);
      showToast('New execution step inserted');
    } else if (editingStepId) {
      const updated = steps.map(s => {
        if (s.id === editingStepId) {
          return {
            ...s,
            badge: formBadge.trim() || 'STEP',
            badgeColor: formBadgeColor,
            title: formTitle.trim(),
            description: formDescription.trim(),
            guidelines: guidelinesArray,
            moduleName: formModuleName.trim() || undefined,
            moduleTarget: formModuleTarget
          };
        }
        return s;
      });
      saveSteps(updated);
      setEditingStepId(null);
      showToast('Step updated successfully');
    }
  };

  const handleDeleteStep = (id: string) => {
    const updated = steps.filter(s => s.id !== id);
    saveSteps(updated);
    if (editingStepId === id) setEditingStepId(null);
    showToast('Step deleted');
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const copy = [...steps];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    saveSteps(copy);
  };

  const handleClearAll = () => {
    if (steps.length === 0) return;
    setLastCleared([...steps]);
    saveSteps([]);
    setEditingStepId(null);
    setIsAddingNew(false);
    showToast('Guide cleared to blank page');
  };

  const handleUndoClear = () => {
    if (lastCleared && lastCleared.length > 0) {
      saveSteps(lastCleared);
      setLastCleared(null);
      showToast('Restored steps');
    }
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(steps, null, 2));
    const dlNode = document.createElement('a');
    dlNode.setAttribute('href', dataStr);
    dlNode.setAttribute('download', 'DOE_SOP_Execution_Steps.json');
    document.body.appendChild(dlNode);
    dlNode.click();
    dlNode.remove();
    showToast('Guide downloaded');
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          saveSteps(parsed);
          showToast(`Imported ${parsed.length} steps from file`);
        } else {
          showToast('Uploaded JSON must contain an array of SOP steps.');
        }
      } catch {
        showToast('Failed to parse uploaded JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleLaunchModule = (target?: string) => {
    if (!currentProject) {
      navigate('/');
      return;
    }
    navigate(`/project/${currentProject.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Header bar matching the user's reference screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {locale === 'zh' ? 'DOE 分步操作指南与标准作业程序 (SOP)' : 'DOE Step-by-Step Guide'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {locale === 'zh' ? '实验设计系统操作指南、研发规范与统计分析步骤' : 'A short description on how to run a DOE and use the Software'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Upload JSON */}
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-xs transition-colors shadow-xs"
            title={locale === 'zh' ? '导入 JSON 格式自定义指南' : 'Upload a custom SOP guide in JSON format'}
          >
            <Upload size={13} />
            <span>{locale === 'zh' ? '导入指南' : 'Upload Guide'}</span>
          </button>

          {/* Download JSON */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-xs transition-colors shadow-xs"
            title={locale === 'zh' ? '下载当前 SOP 执行流程 JSON' : 'Download the current SOP execution timeline'}
          >
            <Download size={13} />
            <span>{locale === 'zh' ? '下载 JSON' : 'Download'}</span>
          </button>

          {/* Clear Button (button 3) */}
          <button
            type="button"
            onClick={handleClearAll}
            disabled={steps.length === 0}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium text-xs transition-all ${
              steps.length === 0
                ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 cursor-pointer'
            }`}
            title={steps.length === 0 ? 'Guide is already blank' : 'Clear all steps into a blank canvas'}
          >
            <Trash2 size={13} />
            <span>{locale === 'zh' ? '清空' : 'Clear'}</span>
          </button>

          {/* Insert New Step Button (Vibrant Blue matching reference) */}
          <button
            type="button"
            onClick={handleStartNewStep}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold text-xs transition-colors shadow-xs cursor-pointer ml-1"
          >
            <Plus size={15} className="stroke-[2.5]" />
            <span>{locale === 'zh' ? '新增执行步骤' : 'Insert New Step'}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="mt-4 flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 py-2.5 px-3.5 rounded-md animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          {lastCleared && (
            <button
              type="button"
              onClick={handleUndoClear}
              className="ml-3 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Editor Modal / Drawer Form when adding or editing */}
      {(isAddingNew || editingStepId !== null) && (
        <div className="mt-6 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-6 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Pencil size={15} className="text-blue-600" />
              {isAddingNew 
                ? (locale === 'zh' ? '插入新 SOP 执行步骤' : 'Insert New SOP Step') 
                : (locale === 'zh' ? '编辑 SOP 执行步骤' : 'Edit SOP Step')}
            </h3>
            <button
              onClick={() => { setIsAddingNew(false); setEditingStepId(null); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {locale === 'zh' ? '阶段标签 (Badge Tag)' : 'Badge Tag'}
                </label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={e => setFormBadge(e.target.value)}
                  placeholder={locale === 'zh' ? '如：化学计量与建模' : 'e.g. STOICHIOMETRY & MODELING'}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {locale === 'zh' ? '主题颜色' : 'Color Theme'}
                </label>
                <select
                  value={formBadgeColor}
                  onChange={e => setFormBadgeColor(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="blue">{locale === 'zh' ? '蓝色 (默认)' : 'Blue (Default)'}</option>
                  <option value="cyan">{locale === 'zh' ? '青色' : 'Cyan'}</option>
                  <option value="emerald">{locale === 'zh' ? '翡翠绿' : 'Emerald Green'}</option>
                  <option value="purple">{locale === 'zh' ? '紫色' : 'Purple'}</option>
                  <option value="amber">{locale === 'zh' ? '琥珀橙' : 'Amber / Orange'}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {locale === 'zh' ? '操作按钮文字' : 'Action Button Text'}
                </label>
                <input
                  type="text"
                  value={formModuleName}
                  onChange={e => setFormModuleName(e.target.value)}
                  placeholder={locale === 'zh' ? '如：前往实验矩阵' : 'e.g. Launch scheme Module'}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {locale === 'zh' ? '步骤标题' : 'Step Title'}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder={locale === 'zh' ? '如：反应条件与自变量筛选' : 'e.g. Reaction Scheme Formulation'}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {locale === 'zh' ? '步骤描述' : 'Step Description'}
              </label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder={locale === 'zh' ? '描述在此阶段需要进行的具体实验或分析流程...' : 'Describe what needs to be conducted in this stage...'}
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-y"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {locale === 'zh' ? '质控指南与检查要点 (每行一项)' : 'Guidelines & Checkpoints'} <span className="font-normal text-slate-400">({locale === 'zh' ? '每行一项' : 'one per line'})</span>
              </label>
              <textarea
                value={formGuidelines}
                onChange={e => setFormGuidelines(e.target.value)}
                placeholder="Specify starting concentrations in M or mM&#10;Mark catalytic or buffered species as constant&#10;Verify baseline resolution on HPLC"
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none resize-y"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsAddingNew(false); setEditingStepId(null); }}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-medium text-xs transition-colors"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs transition-colors shadow-xs"
              >
                {isAddingNew ? (locale === 'zh' ? '添加步骤' : 'Add Step') : (locale === 'zh' ? '保存更改' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blank State if user deleted all steps or default empty */}
      {steps.length === 0 && !isAddingNew && (
        <div className="py-20 text-center flex flex-col items-center justify-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl mt-8">
          <BookOpen size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {locale === 'zh' ? 'DOE 分步操作指南当前为空白' : 'DOE Step-by-Step Guide is currently blank'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
            {locale === 'zh' ? '点击上方“新增执行步骤”定制您的实验标准作业程序 (SOP)。' : 'Click "Insert New Step" above to create your step-by-step procedure.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNewStep}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {locale === 'zh' ? '创建第一项步骤' : 'Insert First Step'}
            </button>
          </div>
        </div>
      )}

      {/* TIMELINE LIST: Connected by a vertical line on the left */}
      <div className="mt-8 space-y-6">
        {steps.map((step, idx) => {
          const stepNumber = String(idx + 1).padStart(2, '0');
          const colorKey = step.badgeColor && BADGE_COLOR_MAP[step.badgeColor] ? step.badgeColor : 'blue';
          const theme = BADGE_COLOR_MAP[colorKey];
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="relative flex items-stretch group">
              {/* Left Column: Numbered Circle and Connecting Line */}
              <div className="w-14 sm:w-16 shrink-0 relative flex flex-col items-center">
                {/* Numbered Pill Circle (exactly like reference: solid circular badge with "01", "02") */}
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${theme.dotBg} text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-sm z-10 select-none`}
                >
                  {stepNumber}
                </div>

                {/* Continuous Connecting Line to the next step */}
                {!isLast && (
                  <div className={`w-[2px] bg-blue-300 dark:bg-blue-600/60 flex-1 my-1.5`} />
                )}
              </div>

              {/* Right Column: Step Card Content */}
              <div className="flex-1 pb-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 sm:p-6 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  {/* Card Header: Badge Tag + Title + Edit/Delete Icons */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Pill Badge */}
                      <span className={`px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${theme.badgeBg} ${theme.badgeText}`}>
                        {step.badge}
                      </span>
                      {/* Bold Step Title */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </h3>
                    </div>

                    {/* Action Controls on top right: Move up/down, Edit, Delete */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveStep(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="Move step up"
                        >
                          <ChevronUp size={14} />
                        </button>
                      )}
                      {idx < steps.length - 1 && (
                        <button
                          onClick={() => handleMoveStep(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="Move step down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleStartEdit(step)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit step content"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Delete step"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Step Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    {step.description}
                  </p>

                  {/* Guidelines & Checkpoints Section */}
                  {step.guidelines && step.guidelines.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mb-4">
                      <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-2">
                        {locale === 'zh' ? '质控要点与检查清单 (Checkpoints):' : 'Guidelines & Checkpoints:'}
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {step.guidelines.map((guide, gIdx) => (
                          <li key={gIdx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 mt-1.5 shrink-0" />
                            <span>{guide}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bottom Footer: "Integrated Workspace" + Launch Module Link Button */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {locale === 'zh' ? '一体化工作流' : 'Integrated Workspace'}
                    </span>

                    {step.moduleName ? (
                      <button
                        type="button"
                        onClick={() => handleLaunchModule(step.moduleTarget)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 font-semibold text-xs rounded-lg transition-colors group/btn cursor-pointer"
                      >
                        <span>{step.moduleName}</span>
                        <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLaunchModule('setup')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 font-semibold text-xs rounded-lg transition-colors group/btn cursor-pointer"
                      >
                        <span>{locale === 'zh' ? '前往工作模块' : 'Launch Module'}</span>
                        <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
