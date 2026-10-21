import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Plus, Pencil, X, Check, Trash2, Download, Upload, 
  ChevronUp, ChevronDown, AlertTriangle, RotateCcw, BookmarkCheck 
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

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

export const DEFAULT_STEPS: SopStep[] = [
  {
    id: 'step-1',
    badge: 'STEP 1',
    badgeColor: 'blue',
    title: 'Plan your factors and responces',
    description: `Plan which variables/factors (equivalents of reagents, temperature, reaction time, catalyst loading etc.) you want to investigate, and what you expect to change (responses) in your product (purity, yield, pH, impurity formation etc.)
More factors to investigate means more reactions are generated to cover the various points of data, which means more work. Carefully consider which factors make sense and which might be too much.`,
    guidelines: [
      'Check potential factors to investigate',
      'Determine all responses you are interested in'
    ]
  }
];

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
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Form edit states
  const [formBadge, setFormBadge] = useState('');
  const [formBadgeColor, setFormBadgeColor] = useState('blue');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGuidelines, setFormGuidelines] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let initialSteps: SopStep[] = DEFAULT_STEPS;
    let hasStored = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isOldDefault =
            parsed.length === 3 &&
            parsed[0]?.id === 'step-1' &&
            parsed[0]?.title === 'Reaction Scheme & Factor Setup';
          if (!isOldDefault) {
            initialSteps = parsed;
            hasStored = true;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load steps from storage:', e);
    }
    setSteps(initialSteps);

    // Sync with server:
    // If the client has existing steps in localStorage, sync them as the server's default.
    // If client has no stored steps, load whatever software default is on the server.
    fetch('/api/guide/default')
      .then(res => res.json())
      .then(data => {
        if (hasStored && initialSteps.length > 0) {
          fetch('/api/guide/default', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: initialSteps })
          }).catch(() => {});
        } else if (Array.isArray(data.steps) && data.steps.length > 0) {
          setSteps(data.steps);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.steps));
        }
      })
      .catch(() => {});
  }, []);

  const saveSteps = (updated: SopStep[]) => {
    setSteps(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Persist to server as software default
    fetch('/api/guide/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: updated })
    }).catch(() => {});
  };

  const handleSaveAsDefault = async () => {
    try {
      const res = await fetch('/api/guide/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps })
      });
      if (res.ok) {
        showToast(locale === 'zh' ? '当前指南已成功保存为系统软件默认！' : 'Current guide saved as software default!');
      } else {
        showToast(locale === 'zh' ? '保存失败，请稍后重试。' : 'Failed to save software default.');
      }
    } catch {
      showToast(locale === 'zh' ? '保存失败，请稍后重试。' : 'Failed to save software default.');
    }
  };

  const handleResetToDefault = () => {
    fetch('/api/guide/default')
      .then(res => res.json())
      .then(data => {
        const defaultSteps = (Array.isArray(data.steps) && data.steps.length > 0) ? data.steps : DEFAULT_STEPS;
        saveSteps(defaultSteps);
        setEditingStepId(null);
        setIsAddingNew(false);
        showToast(locale === 'zh' ? '已恢复为系统软件默认指南' : 'Reset to software default guide');
      })
      .catch(() => {
        saveSteps(DEFAULT_STEPS);
        showToast(locale === 'zh' ? '已恢复为系统软件默认指南' : 'Reset to software default guide');
      });
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
    setFormGuidelines((step.guidelines || []).join('\n'));
  };

  const handleStartNewStep = () => {
    setIsAddingNew(true);
    setEditingStepId(null);
    const stepNumber = steps.length + 1;
    const colors = ['blue', 'cyan', 'emerald', 'purple', 'amber'];
    const assignedColor = colors[(stepNumber - 1) % colors.length];

    setFormBadge(`STEP ${stepNumber}`);
    setFormBadgeColor(assignedColor);
    setFormTitle('');
    setFormDescription('');
    setFormGuidelines('');
  };

  const handleCancelEdit = () => {
    setIsAddingNew(false);
    setEditingStepId(null);
  };

  const handleSaveForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formTitle.trim()) {
      showToast(locale === 'zh' ? '请输入步骤标题。' : 'Please enter a step title.');
      return;
    }

    const guidelinesArray = formGuidelines
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (isAddingNew) {
      const stepNumber = steps.length + 1;
      const newStep: SopStep = {
        id: `step-${Date.now()}`,
        badge: formBadge.trim() || `STEP ${stepNumber}`,
        badgeColor: formBadgeColor,
        title: formTitle.trim(),
        description: formDescription.trim(),
        guidelines: guidelinesArray,
      };
      const updated = [...steps, newStep];
      saveSteps(updated);
      setIsAddingNew(false);
      showToast(locale === 'zh' ? '已添加新执行步骤' : 'New execution step added');
    } else if (editingStepId) {
      const updated = steps.map(s => {
        if (s.id === editingStepId) {
          return {
            ...s,
            badge: formBadge.trim() || s.badge,
            badgeColor: formBadgeColor,
            title: formTitle.trim(),
            description: formDescription.trim(),
            guidelines: guidelinesArray,
          };
        }
        return s;
      });
      saveSteps(updated);
      setEditingStepId(null);
      showToast(locale === 'zh' ? '步骤已成功更新' : 'Step updated successfully');
    }
  };

  const handleDeleteStep = (id: string) => {
    const updated = steps.filter(s => s.id !== id);
    saveSteps(updated);
    if (editingStepId === id) setEditingStepId(null);
    showToast(locale === 'zh' ? '步骤已删除' : 'Step deleted');
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

  const handleRequestClear = () => {
    if (steps.length === 0) return;
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setLastCleared([...steps]);
    saveSteps([]);
    setEditingStepId(null);
    setIsAddingNew(false);
    setShowClearConfirm(false);
    showToast(locale === 'zh' ? '已清空所有步骤' : 'Guide cleared to blank page');
  };

  const handleUndoClear = () => {
    if (lastCleared && lastCleared.length > 0) {
      saveSteps(lastCleared);
      setLastCleared(null);
      showToast(locale === 'zh' ? '已恢复步骤' : 'Restored steps');
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
    showToast(locale === 'zh' ? '已下载步骤文件' : 'Guide downloaded');
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
          showToast(locale === 'zh' ? `已导入 ${parsed.length} 个步骤` : `Imported ${parsed.length} steps from file`);
        } else {
          showToast(locale === 'zh' ? '上传的 JSON 必须包含步骤数组' : 'Uploaded JSON must contain an array of SOP steps.');
        }
      } catch {
        showToast(locale === 'zh' ? '解析 JSON 文件失败' : 'Failed to parse uploaded JSON file');
      }
    };
    reader.readAsText(file);
  };

  // Render inline editor component directly inside the timeline step card
  const renderInlineEditor = (isNew: boolean) => {
    return (
      <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/80 dark:border-blue-500/80 rounded-2xl shadow-md p-5 sm:p-6 animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <Pencil size={14} />
            <span>
              {isNew 
                ? (locale === 'zh' ? '创建新步骤' : 'Create Step') 
                : (locale === 'zh' ? '编辑步骤' : 'Edit Step')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer transition-colors"
            title={locale === 'zh' ? '取消' : 'Cancel'}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                {locale === 'zh' ? '阶段标签 (Badge Tag)' : 'Badge Tag'}
              </label>
              <input
                type="text"
                value={formBadge}
                onChange={e => setFormBadge(e.target.value)}
                placeholder={locale === 'zh' ? '如：STEP 1' : 'e.g. STEP 1'}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                {locale === 'zh' ? '主题颜色' : 'Color Theme'}
              </label>
              <select
                value={formBadgeColor}
                onChange={e => setFormBadgeColor(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="blue">{locale === 'zh' ? '蓝色 (默认)' : 'Blue (Default)'}</option>
                <option value="cyan">{locale === 'zh' ? '青色' : 'Cyan'}</option>
                <option value="emerald">{locale === 'zh' ? '翡翠绿' : 'Emerald Green'}</option>
                <option value="purple">{locale === 'zh' ? '紫色' : 'Purple'}</option>
                <option value="amber">{locale === 'zh' ? '琥珀橙' : 'Amber / Orange'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
              {locale === 'zh' ? '步骤标题' : 'Step Title'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder={locale === 'zh' ? '如：确定自变量与响应指标' : 'e.g. Plan your factors and responses'}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
              {locale === 'zh' ? '步骤描述' : 'Step Description'}
            </label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder={locale === 'zh' ? '输入在此步骤的操作说明与规范（支持回车换行）...' : 'Describe what needs to be conducted in this stage (line breaks are preserved)...'}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y whitespace-pre-wrap leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
              {locale === 'zh' ? '质控指南与检查要点' : 'Guidelines & Checkpoints'} <span className="font-normal text-slate-400">({locale === 'zh' ? '每行一项' : 'one per line'})</span>
            </label>
            <textarea
              value={formGuidelines}
              onChange={e => setFormGuidelines(e.target.value)}
              placeholder={locale === 'zh' ? '检查潜在考察因素&#10;确定关注的所有响应值' : 'Check potential factors to investigate&#10;Determine all responses you are interested in'}
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md font-medium text-xs transition-colors cursor-pointer"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {isNew ? (locale === 'zh' ? '添加步骤' : 'Add Step') : (locale === 'zh' ? '保存更改' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    );
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

      {/* Header bar */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-xs transition-colors shadow-xs cursor-pointer"
            title={locale === 'zh' ? '导入 JSON 格式自定义指南' : 'Upload a custom SOP guide in JSON format'}
          >
            <Upload size={13} />
            <span>{locale === 'zh' ? '导入指南' : 'Upload Guide'}</span>
          </button>

          {/* Download JSON */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-xs transition-colors shadow-xs cursor-pointer"
            title={locale === 'zh' ? '下载当前 SOP 执行流程 JSON' : 'Download the current SOP execution timeline'}
          >
            <Download size={13} />
            <span>{locale === 'zh' ? '下载 JSON' : 'Download'}</span>
          </button>

          {/* Save as Software Default */}
          <button
            type="button"
            onClick={handleSaveAsDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-md font-medium text-xs transition-colors shadow-xs cursor-pointer"
            title={locale === 'zh' ? '将当前指南保存为系统软件默认模板' : 'Save current Step-by-Step guide as software default'}
          >
            <BookmarkCheck size={13} />
            <span>{locale === 'zh' ? '设为软件默认' : 'Save as Default'}</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleRequestClear}
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

          {/* Insert New Step Button */}
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
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>{locale === 'zh' ? '加载软件默认指南' : 'Load Software Default'}</span>
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
          const isLast = idx === steps.length - 1 && !isAddingNew;
          const isEditing = editingStepId === step.id;

          return (
            <div key={step.id} className="relative flex items-stretch group">
              {/* Left Column: Numbered Circle and Connecting Line */}
              <div className="w-14 sm:w-16 shrink-0 relative flex flex-col items-center">
                {/* Numbered Pill Circle */}
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${isEditing ? 'bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/60' : theme.dotBg} text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-sm z-10 select-none transition-all`}
                >
                  {stepNumber}
                </div>

                {/* Continuous Connecting Line to the next step */}
                {!isLast && (
                  <div className="w-[2px] bg-blue-300 dark:bg-blue-600/60 flex-1 my-1.5" />
                )}
              </div>

              {/* Right Column: Step Card Content (Inline Editor or Display Card) */}
              <div className="flex-1 pb-4">
                {isEditing ? (
                  renderInlineEditor(false)
                ) : (
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
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer transition-colors"
                            title={locale === 'zh' ? '上移步骤' : 'Move step up'}
                          >
                            <ChevronUp size={14} />
                          </button>
                        )}
                        {idx < steps.length - 1 && (
                          <button
                            onClick={() => handleMoveStep(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer transition-colors"
                            title={locale === 'zh' ? '下移步骤' : 'Move step down'}
                          >
                            <ChevronDown size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(step)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title={locale === 'zh' ? '编辑步骤' : 'Edit step'}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title={locale === 'zh' ? '删除步骤' : 'Delete step'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Step Description: whitespace-pre-line to respect line breaks */}
                    {step.description && (
                      <div className="whitespace-pre-line text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                        {step.description}
                      </div>
                    )}

                    {/* Guidelines & Checkpoints Section */}
                    {step.guidelines && step.guidelines.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
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
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Inline editor when creating a new step at the end of the timeline */}
        {isAddingNew && (
          <div className="relative flex items-stretch group animate-in fade-in duration-200">
            {/* Left Column: Numbered Circle */}
            <div className="w-14 sm:w-16 shrink-0 relative flex flex-col items-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md ring-4 ring-blue-100 dark:ring-blue-900/60 z-10 select-none">
                {String(steps.length + 1).padStart(2, '0')}
              </div>
            </div>

            {/* Right Column: In-place form */}
            <div className="flex-1 pb-4">
              {renderInlineEditor(true)}
            </div>
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowClearConfirm(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {locale === 'zh' ? '确认清空所有步骤？' : 'Clear all steps?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {locale === 'zh' 
                    ? `您确定要清空当前的 ${steps.length} 个操作步骤吗？此操作将重置指南为空白页面。` 
                    : `Are you sure you want to clear all ${steps.length} step${steps.length > 1 ? 's' : ''}? This will reset the guide to a blank page.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  handleResetToDefault();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                title={locale === 'zh' ? '重置为软件默认执行指南' : 'Reset to software default guide'}
              >
                {locale === 'zh' ? '重置为软件默认' : 'Reset to Software Default'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  {locale === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  {locale === 'zh' ? '清空为空白' : 'Clear to Blank'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
