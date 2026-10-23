import React, { useState } from 'react';
import { Project, Factor, Response } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
}

export default function ProjectSetup({ project, updateProject }: Props) {
  const { t, locale } = useTranslation();
  const [newFactorName, setNewFactorName] = useState('');
  const [newFactorType, setNewFactorType] = useState<'numeric' | 'categorical'>('numeric');
  const [newFactorLevels, setNewFactorLevels] = useState<string[]>(['Solvent A', 'Solvent B', 'Solvent C']);
  const [newFactorMin, setNewFactorMin] = useState<string>('');
  const [newFactorMax, setNewFactorMax] = useState<string>('');
  const [newFactorUnit, setNewFactorUnit] = useState('');

  const [newResponseName, setNewResponseName] = useState('');
  const [newResponseGoal, setNewResponseGoal] = useState<'maximize'|'minimize'|'target'>('maximize');
  const [newResponseUnit, setNewResponseUnit] = useState('');
  const [newResponseTargetValue, setNewResponseTargetValue] = useState<string>('');

  const [editingFactorId, setEditingFactorId] = useState<string | null>(null);
  const [editFactorData, setEditFactorData] = useState<{
    name?: string;
    type?: 'numeric' | 'categorical';
    levels?: string[];
    min?: string | number;
    max?: string | number;
    unit?: string;
  }>({});

  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editResponseData, setEditResponseData] = useState<Partial<Response>>({});

  // Helper for numeric inputs that converts comma to dot and allows - and decimal values
  const handleNumericInput = (val: string, setter: (v: string) => void) => {
    const clean = val.replace(/,/g, '.');
    // Allow empty, minus/plus sign, dots, or valid numbers
    if (clean === '' || clean === '-' || clean === '+' || clean === '.' || clean === '-.' || clean === '+.' || /^[+-]?\d*(\.\d*)?$/.test(clean)) {
      setter(clean);
    }
  };

  const startEditFactor = (factor: Factor) => {
    setEditingFactorId(factor.id);
    setEditFactorData({
      name: factor.name,
      type: factor.type || 'numeric',
      levels: factor.levels ? [...factor.levels] : ['Level 1', 'Level 2'],
      min: factor.min,
      max: factor.max,
      unit: factor.unit
    });
  };

  const saveFactorEdit = () => {
    if (editingFactorId) {
      if (editFactorData.name && editFactorData.name.trim()) {
        const isCat = editFactorData.type === 'categorical';
        const cleanLevels = (editFactorData.levels || []).map(l => l.trim()).filter(l => l !== '');
        const finalLevels = cleanLevels.length >= 2 ? cleanLevels : ['Level 1', 'Level 2'];
        const parsedMin = editFactorData.min === undefined || editFactorData.min === ('' as any) || isNaN(Number(editFactorData.min)) ? 0 : Number(editFactorData.min);
        const parsedMax = editFactorData.max === undefined || editFactorData.max === ('' as any) || isNaN(Number(editFactorData.max)) ? 100 : Number(editFactorData.max);
        
        updateProject({
          ...project,
          factors: project.factors.map(f => f.id === editingFactorId ? {
            ...f,
            name: editFactorData.name!.trim(),
            type: isCat ? 'categorical' : 'numeric',
            levels: isCat ? finalLevels : undefined,
            min: isCat ? 0 : parsedMin,
            max: isCat ? finalLevels.length - 1 : parsedMax,
            unit: editFactorData.unit || ''
          } as Factor : f)
        });
      }
      setEditingFactorId(null);
    }
  };

  const startEditResponse = (response: Response) => {
    setEditingResponseId(response.id);
    setEditResponseData(response);
  };

  const saveResponseEdit = () => {
    if (editingResponseId) {
      if (editResponseData.name) {
        updateProject({
          ...project,
          responses: project.responses.map(r => r.id === editingResponseId ? { ...r, ...editResponseData } as Response : r)
        });
      }
      setEditingResponseId(null);
    }
  };

  const addFactor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactorName.trim()) return;

    let factor: Factor;
    if (newFactorType === 'categorical') {
      const cleanLevels = newFactorLevels.map(l => l.trim()).filter(l => l !== '');
      const finalLevels = cleanLevels.length >= 2 ? cleanLevels : ['Level 1', 'Level 2'];
      factor = {
        id: uuidv4(),
        name: newFactorName.trim(),
        type: 'categorical',
        min: 0,
        max: finalLevels.length - 1,
        levels: finalLevels,
        unit: newFactorUnit.trim()
      };
    } else {
      const parsedMin = newFactorMin === '' || isNaN(Number(newFactorMin)) ? 0 : Number(newFactorMin);
      const parsedMax = newFactorMax === '' || isNaN(Number(newFactorMax)) ? 100 : Number(newFactorMax);
      factor = {
        id: uuidv4(),
        name: newFactorName.trim(),
        type: 'numeric',
        min: parsedMin,
        max: parsedMax,
        unit: newFactorUnit.trim()
      };
    }

    updateProject({ ...project, factors: [...project.factors, factor] });
    setNewFactorName('');
    setNewFactorMin('');
    setNewFactorMax('');
    setNewFactorUnit('');
    setNewFactorLevels(['Solvent A', 'Solvent B']);
  };

  const deleteFactor = (id: string) => {
    updateProject({ ...project, factors: project.factors.filter(f => f.id !== id) });
  };

  const addResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResponseName) return;
    const response: Response = {
      id: uuidv4(),
      name: newResponseName,
      goal: newResponseGoal,
      unit: newResponseUnit,
      ...(newResponseGoal === 'target' && newResponseTargetValue !== '' ? { targetValue: Number(newResponseTargetValue) } : {})
    };
    updateProject({ ...project, responses: [...project.responses, response] });
    setNewResponseName('');
    setNewResponseUnit('');
    setNewResponseTargetValue('');
  };

  const deleteResponse = (id: string) => {
    updateProject({ ...project, responses: project.responses.filter(r => r.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
          {locale === 'zh' ? '全局实验设计设置' : 'Global Design Settings'}
        </h3>
        <div className="flex items-center gap-4">
          <div className="max-w-xs w-full">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">
              {locale === 'zh' ? '中心点数量 (Center Points)' : 'Number of Center Points'}
            </label>
            <input 
              type="text" 
              inputMode="numeric"
              value={project.centerPoints ?? 0} 
              onChange={e => {
                const clean = e.target.value.replace(/,/g, '.').replace(/[^0-9]/g, '');
                updateProject({...project, centerPoints: clean === '' ? 0 : Number(clean)});
              }} 
              className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" 
            />
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-300 max-w-sm mt-3 leading-relaxed">
            {locale === 'zh' ? '在实验矩阵中加入中心点有助于检测非线性弯曲 (Curvature) 效应，并评估统计模型的纯误差 (Pure Error)。' : 'Adding center points to your design matrix enables the detection of non-linearity (curvature) and helps estimate pure error.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Factors */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
          {locale === 'zh' ? '输入因素 (Factors)' : 'Factors (Inputs)'}
          <span className="text-[10px] font-mono font-normal text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded">{project.factors.length}</span>
        </h3>
        
        <div className="space-y-2 mb-4">
          {project.factors.map(factor => (
            <div key={factor.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
              {editingFactorId === factor.id ? (
                <div 
                  className="flex-1 grid grid-cols-2 gap-2 mr-2"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      saveFactorEdit();
                    }
                  }}
                >
                  <div className="col-span-2 flex items-center justify-between gap-2">
                    <input autoFocus type="text" value={editFactorData.name || ''} onChange={e => setEditFactorData({...editFactorData, name: e.target.value})} className="flex-1 rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" placeholder={locale === 'zh' ? '因素名称' : 'Name'} />
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                        <input type="radio" name={`editFactorType-${factor.id}`} checked={editFactorData.type === 'numeric'} onChange={() => setEditFactorData({...editFactorData, type: 'numeric'})} />
                        <span className="text-slate-700 dark:text-slate-300">{locale === 'zh' ? '数值变量' : 'Numeric'}</span>
                      </label>
                      <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                        <input type="radio" name={`editFactorType-${factor.id}`} checked={editFactorData.type === 'categorical'} onChange={() => setEditFactorData({...editFactorData, type: 'categorical', levels: editFactorData.levels && editFactorData.levels.length >= 2 ? editFactorData.levels : ['Level 1', 'Level 2', 'Level 3']})} />
                        <span className="text-purple-700 dark:text-purple-300 font-semibold">{locale === 'zh' ? '类别变量' : 'Categorical'}</span>
                      </label>
                    </div>
                  </div>
                  {editFactorData.type === 'categorical' ? (
                    <div className="col-span-2 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-slate-400">{locale === 'zh' ? '水平取值 (英文逗号分隔):' : 'Levels (comma-separated):'}</div>
                      <input
                        type="text"
                        value={editFactorData.levels?.join(', ') || ''}
                        onChange={e => setEditFactorData({
                          ...editFactorData,
                          levels: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                        })}
                        className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono"
                        placeholder={locale === 'zh' ? '例如：乙醇, 甲苯, 丙酮' : 'e.g. Ethanol, Toluene, Acetone'}
                      />
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={editFactorData.min ?? ''} 
                        onChange={e => handleNumericInput(e.target.value, v => setEditFactorData({...editFactorData, min: v}))} 
                        className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" 
                        placeholder={locale === 'zh' ? '最小值' : 'Min'} 
                      />
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={editFactorData.max ?? ''} 
                        onChange={e => handleNumericInput(e.target.value, v => setEditFactorData({...editFactorData, max: v}))} 
                        className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" 
                        placeholder={locale === 'zh' ? '最大值' : 'Max'} 
                      />
                    </>
                  )}
                  <div className="col-span-2">
                    <input type="text" value={editFactorData.unit || ''} onChange={e => setEditFactorData({...editFactorData, unit: e.target.value})} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" placeholder={locale === 'zh' ? '单位 (可选)' : 'Unit (optional)'} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">{factor.name} {factor.unit && <span className="text-slate-500 dark:text-slate-300 font-normal font-mono">({factor.unit})</span>}</p>
                    {factor.type === 'categorical' ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {locale === 'zh' ? `类别变量 (${factor.levels?.length || 2} 个水平)` : `Categorical (${factor.levels?.length || 2} levels)`}
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {locale === 'zh' ? '连续数值' : 'Numeric'}
                      </span>
                    )}
                  </div>
                  {factor.type === 'categorical' ? (
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {locale === 'zh' ? '水平取值: ' : 'Levels: '}{factor.levels?.join(', ')}
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-300 mt-0.5">
                      {locale === 'zh' ? '操作范围: ' : 'Range: '}{factor.min} ~ {factor.max}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center flex-col gap-1 shrink-0">
                {editingFactorId === factor.id ? (
                  <button onClick={saveFactorEdit} className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                    <Check size={14} />
                  </button>
                ) : (
                  <button onClick={() => startEditFactor(factor)} className="p-1 text-slate-400 hover:text-brand-500 transition-colors">
                    <Edit2 size={14} />
                  </button>
                )}
                <button onClick={() => deleteFactor(factor.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {project.factors.length === 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-300 italic text-center py-4 border border-dashed border-slate-200 dark:border-slate-600 rounded">
              {locale === 'zh' ? '暂未定义任何实验因素。' : 'No factors defined yet.'}
            </p>
          )}
        </div>

        <form onSubmit={addFactor} className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-blue-400">
              {locale === 'zh' ? '添加新实验因素' : 'Add New Factor'}
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10.5px] cursor-pointer">
                <input type="radio" name="newFactorType" checked={newFactorType === 'numeric'} onChange={() => setNewFactorType('numeric')} />
                <span className="font-medium text-slate-700 dark:text-slate-300">{locale === 'zh' ? '数值变量' : 'Numeric'}</span>
              </label>
              <label className="flex items-center gap-1 text-[10.5px] cursor-pointer">
                <input type="radio" name="newFactorType" checked={newFactorType === 'categorical'} onChange={() => setNewFactorType('categorical')} />
                <span className="font-medium text-purple-700 dark:text-purple-300 font-semibold">{locale === 'zh' ? '类别变量 (文本)' : 'Categorical (Text)'}</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input 
                type="text" 
                placeholder={newFactorType === 'categorical' ? (locale === 'zh' ? '因素名称 (例如：溶剂种类、催化剂类型)' : "Name (e.g. Solvent, Catalyst Type)") : (locale === 'zh' ? '因素名称 (例如：反应温度)' : "Name (e.g. Temperature)")} 
                required 
                value={newFactorName} 
                onChange={e=>setNewFactorName(e.target.value)} 
                className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" 
              />
            </div>

            {newFactorType === 'categorical' ? (
              <div className="col-span-2 space-y-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    {locale === 'zh' ? '水平取值列表 (水平项)' : 'Factor Levels (Text Inputs)'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setNewFactorLevels([...newFactorLevels, `Level ${newFactorLevels.length + 1}`])}
                    className="text-[9.5px] text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
                  >
                    <Plus size={12} /> {locale === 'zh' ? '添加水平' : 'Add Level'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {newFactorLevels.map((lvl, lIdx) => (
                    <div key={lIdx} className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-slate-400 w-3">{lIdx + 1}.</span>
                      <input
                        type="text"
                        required
                        value={lvl}
                        onChange={(e) => {
                          const updated = [...newFactorLevels];
                          updated[lIdx] = e.target.value;
                          setNewFactorLevels(updated);
                        }}
                        placeholder={`Level ${lIdx + 1} (e.g. Ethanol)`}
                        className="flex-1 rounded border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-[10.5px] font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      {newFactorLevels.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewFactorLevels(newFactorLevels.filter((_, idx) => idx !== lIdx))}
                          className="p-1 text-slate-400 hover:text-red-500"
                          title="Remove level"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder={locale === 'zh' ? '最小值' : 'Min'} 
                    value={newFactorMin} 
                    onChange={e => handleNumericInput(e.target.value, setNewFactorMin)} 
                    className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" 
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder={locale === 'zh' ? '最大值' : 'Max'} 
                    value={newFactorMax} 
                    onChange={e => handleNumericInput(e.target.value, setNewFactorMax)} 
                    className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" 
                  />
                </div>
              </>
            )}

            <div className="col-span-2 flex gap-2">
              <input type="text" placeholder={locale === 'zh' ? '物理单位（可选，如 ℃、rpm）' : 'Unit (optional)'} value={newFactorUnit} onChange={e=>setNewFactorUnit(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" />
              <button type="submit" className="px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium flex items-center gap-1 text-[11px] whitespace-nowrap">
                <Plus size={14} /> {locale === 'zh' ? '添加因素' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Responses */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
          {locale === 'zh' ? '输出响应 (Responses)' : 'Responses (Outputs)'}
          <span className="text-[10px] font-mono font-normal text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded">{project.responses.length}</span>
        </h3>

        <div className="space-y-2 mb-4">
          {project.responses.map(resp => (
            <div key={resp.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
              {editingResponseId === resp.id ? (
                <div 
                  className="flex-1 space-y-2 mr-2"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      saveResponseEdit();
                    }
                  }}
                >
                  <input autoFocus type="text" value={editResponseData.name || ''} onChange={e => setEditResponseData({...editResponseData, name: e.target.value})} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" placeholder="Name" />
                  <div className="flex gap-2">
                    <select value={editResponseData.goal || 'maximize'} onChange={e => {
                      const newGoal = e.target.value as any;
                      setEditResponseData({...editResponseData, goal: newGoal, ...(newGoal !== 'target' ? { targetValue: undefined } : {})});
                    }} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                      <option value="maximize">{t('goal_maximize', 'Maximize')}</option>
                      <option value="minimize">{t('goal_minimize', 'Minimize')}</option>
                      <option value="target">{t('goal_target', 'Target')}</option>
                    </select>
                    {editResponseData.goal === 'target' && (
                      <input 
                        type="text" 
                        placeholder={locale === 'zh' ? '目标数值' : 'Target Value'}
                        value={editResponseData.targetValue !== undefined ? editResponseData.targetValue : ''}
                        onChange={e => handleNumericInput(e.target.value, v => setEditResponseData({...editResponseData, targetValue: v === '' ? undefined : Number(v)}))} 
                        className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" 
                      />
                    )}
                    <input type="text" value={editResponseData.unit || ''} onChange={e => setEditResponseData({...editResponseData, unit: e.target.value})} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] font-mono" placeholder={locale === 'zh' ? '单位' : 'Unit'} />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">{resp.name} {resp.unit && <span className="text-slate-500 dark:text-slate-300 font-normal font-mono">({resp.unit})</span>}</p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-300 mt-0.5 capitalize">
                    {locale === 'zh' ? '目标: ' : 'Goal: '}
                    {resp.goal === 'maximize' ? (locale === 'zh' ? '最大化' : 'Maximize') : resp.goal === 'minimize' ? (locale === 'zh' ? '最小化' : 'Minimize') : (locale === 'zh' ? '目标值' : 'Target')} 
                    {resp.goal === 'target' && resp.targetValue !== undefined && ` (${resp.targetValue})`}
                  </p>
                </div>
              )}
              <div className="flex items-center flex-col gap-1 shrink-0">
                {editingResponseId === resp.id ? (
                  <button onClick={saveResponseEdit} className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                    <Check size={14} />
                  </button>
                ) : (
                  <button onClick={() => startEditResponse(resp)} className="p-1 text-slate-400 hover:text-brand-500 transition-colors">
                    <Edit2 size={14} />
                  </button>
                )}
                <button onClick={() => deleteResponse(resp.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {project.responses.length === 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-300 italic text-center py-4 border border-dashed border-slate-200 dark:border-slate-600 rounded">
              {locale === 'zh' ? '暂未定义任何输出响应。' : 'No responses defined yet.'}
            </p>
          )}
        </div>

        <form onSubmit={addResponse} className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-blue-400">
            {locale === 'zh' ? '添加新输出响应' : 'Add New Response'}
          </h4>
          <div className="space-y-1.5">
            <input type="text" placeholder={locale === 'zh' ? '响应名称 (例如：收率、纯度、异构体比例)' : 'Name (e.g. Yield)'} required value={newResponseName} onChange={e=>setNewResponseName(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" />
            <div className="flex gap-2">
              <select value={newResponseGoal} onChange={e=>{
                const newGoal = e.target.value as any;
                setNewResponseGoal(newGoal);
                if (newGoal !== 'target') setNewResponseTargetValue('');
              }} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                <option value="maximize">{t('goal_maximize', 'Maximize')}</option>
                <option value="minimize">{t('goal_minimize', 'Minimize')}</option>
                <option value="target">{t('goal_target', 'Target')}</option>
              </select>
              {newResponseGoal === 'target' && (
                <input 
                  type="text" 
                  placeholder={locale === 'zh' ? '目标数值' : 'Target Value'} 
                  value={newResponseTargetValue} 
                  onChange={e => handleNumericInput(e.target.value, setNewResponseTargetValue)} 
                  className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" 
                />
              )}
              <input type="text" placeholder={locale === 'zh' ? '单位 (如 %、mg/mL)' : 'Unit'} value={newResponseUnit} onChange={e=>setNewResponseUnit(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 font-mono" />
            </div>
            <button type="submit" className="w-full justify-center px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium flex items-center gap-1 text-[11px]">
              <Plus size={14} /> {locale === 'zh' ? '添加响应' : 'Add Response'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
