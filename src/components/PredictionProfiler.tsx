import React, { useState, useEffect, useMemo } from 'react';
import { Project, Factor, Response } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { predictModelResponse } from '../utils/analysisCore';
import { useTranslation } from '../context/LanguageContext';

interface Props {
  project: Project;
  allAnalysisResults: any[];
}

// Desirability function calculators
function calculateDesirability(y: number, response: Response, results: any) {
  // Find empirical bounds from data to scale the desirability
  const yData = results.actualByPredicted.map((d: any) => d.actual);
  const min = Math.min(...yData);
  const max = Math.max(...yData);
  
  const L = min;
  const U = max;
  
  const goal = response.goal;
  
  if (goal === 'maximize') {
    if (y <= L) return 0;
    if (y >= U) return 1;
    return (y - L) / (U - L);
  } else if (goal === 'minimize') {
    if (y <= L) return 1;
    if (y >= U) return 0;
    return (U - y) / (U - L);
  } else if (goal === 'target') {
    const T = response.targetValue ?? ((L + U) / 2);
    if (y < L || y > U) return 0;
    if (y === T) return 1;
    if (y < T) return (y - L) / (T - L);
    return (U - y) / (U - T);
  }
  return 0;
}

export function PredictionProfiler({ project, allAnalysisResults }: Props) {
  const { t, locale } = useTranslation();
  const [settings, setSettings] = useState<Record<string, string | number>>({});

  useEffect(() => {
    // Initialize settings to center points / first level if empty
    if (Object.keys(settings).length === 0 && project.factors.length > 0) {
      const initSettings: Record<string, string | number> = {};
      project.factors.forEach(f => {
        if (f.type === 'categorical') {
          initSettings[f.id] = f.levels && f.levels.length > 0 ? f.levels[0] : 'Level 1';
        } else {
          initSettings[f.id] = (f.min + f.max) / 2;
        }
      });
      setSettings(initSettings);
    }
  }, [project, settings]);

  const predictAt = (currentSettings: Record<string, string | number>, analysisResult: any) => {
    return predictModelResponse(analysisResult, currentSettings, project);
  };

  const handleSettingChange = (factorId: string, val: string | number) => {
    setSettings(prev => ({ ...prev, [factorId]: val }));
  };

  const currentPredictions = useMemo(() => {
    return allAnalysisResults.map(res => {
      const pred = predictAt(settings, res);
      const desirability = calculateDesirability(pred, res.response, res);
      return { response: res.response, pred, desirability };
    });
  }, [settings, allAnalysisResults, project]);

  const globalDesirability = useMemo(() => {
    if (currentPredictions.length === 0) return 0;
    let prod = 1;
    currentPredictions.forEach(cp => {
      prod *= Math.max(0, cp.desirability);
    });
    return Math.pow(prod, 1 / currentPredictions.length);
  }, [currentPredictions]);

  if (!allAnalysisResults || allAnalysisResults.length === 0 || Object.keys(settings).length === 0) return null;

  const formatGoal = (goal: string, targetVal?: number) => {
    if (locale === 'zh') {
      if (goal === 'maximize') return '最大化';
      if (goal === 'minimize') return '最小化';
      if (goal === 'target') return `目标值 (${targetVal ?? ''})`;
      return goal;
    }
    return `${goal} ${goal === 'target' && targetVal !== undefined ? `(${targetVal})` : ''}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
      <div className="mb-6 flex flex-wrap justify-between items-start gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-sm uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
            {locale === 'zh' ? '多响应交互式预测刻画器 (Prediction Profiler)' : 'Multi-Response Prediction Profiler'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {locale === 'zh' ? '交互式响应预测模型。拖动下方滑块调节工艺参数，实时优化总满意度函数 (Global Desirability)。' : 'Interactive prediction model. Drag the sliders below to optimize the global desirability function.'}
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 text-center min-w-[140px] shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
            {locale === 'zh' ? '总满意度 (Desirability)' : 'Global Desirability'}
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {globalDesirability.toFixed(3)}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto pb-4">
        <div 
          className="grid gap-x-6 gap-y-3 min-w-max" 
          style={{ gridTemplateColumns: `220px repeat(${project.factors.length}, minmax(180px, 1fr))` }}
        >
          {/* Header Row: Factor Names */}
          <div className="font-bold text-[11px] uppercase tracking-widest text-slate-400 flex items-end pb-2">
            {locale === 'zh' ? '响应指标' : 'Responses'}
          </div>
          {project.factors.map(factor => (
            <div key={factor.id} className="text-center pb-2">
              <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate" title={factor.name}>
                {factor.name}
              </div>
              {factor.type === 'categorical' ? (
                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                  {locale === 'zh' ? `离散类别 (${factor.levels?.length || 2} 水平)` : `Discrete (${factor.levels?.length || 2} levels)`}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  [{factor.min}, {factor.max}] {factor.unit}
                </div>
              )}
            </div>
          ))}

          {/* Response Rows */}
          {allAnalysisResults.map(analysisResult => {
            const resp = analysisResult.response;
            const cp = currentPredictions.find(p => p.response.id === resp.id);

            return (
              <React.Fragment key={resp.id}>
                {/* Response Info Column */}
                <div className="flex flex-col justify-center pr-6 py-2 border-r border-slate-200 dark:border-slate-700">
                  <div className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate" title={resp.name}>{resp.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                    {formatGoal(resp.goal, resp.targetValue)}
                  </div>
                  
                  <div className="mt-auto space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-medium text-slate-500">{locale === 'zh' ? '预测值:' : 'Pred:'}</span>
                      <span className="text-[12px] font-bold text-brand-600 dark:text-brand-400">{cp?.pred.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 rounded border border-emerald-100 dark:border-emerald-800/30">
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500">{locale === 'zh' ? '满意度:' : 'Desirability:'}</span>
                      <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{cp?.desirability.toFixed(3)}</span>
                    </div>
                  </div>
                </div>

                {/* Factor Charts for this Response */}
                {project.factors.map(factor => {
                  if (factor.type === 'categorical') {
                    const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
                    const curveData = levels.map(lvl => {
                      const testSettings = { ...settings, [factor.id]: lvl };
                      const pred = predictAt(testSettings, analysisResult);
                      return { x: String(lvl), y: Number.isFinite(pred) ? pred : 0 };
                    });

                    const rawVal = settings[factor.id];
                    const currentVal = (rawVal !== undefined && levels.includes(String(rawVal))) ? String(rawVal) : String(levels[0]);

                    const yVals = curveData.map(d => d.y);
                    if (cp?.pred !== undefined && Number.isFinite(cp.pred)) yVals.push(cp.pred);
                    const minY = yVals.length > 0 ? Math.min(...yVals) : 0;
                    const maxY = yVals.length > 0 ? Math.max(...yVals) : 1;
                    const pad = Math.max((maxY - minY) * 0.15, 0.5);
                    const safeYDomain: [number, number] = [minY - pad, maxY + pad];

                    return (
                      <div key={`${resp.id}-${factor.id}`} className="h-32 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-2 relative shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={curveData} margin={{ top: 8, right: 12, left: -12, bottom: 2 }}>
                            <XAxis 
                              type="category" 
                              dataKey="x" 
                              tick={{ fontSize: 9, fill: '#64748b' }} 
                              axisLine={false} 
                              tickLine={false} 
                              padding={{ left: 16, right: 16 }}
                            />
                            <YAxis 
                              type="number" 
                              domain={safeYDomain} 
                              tick={{ fontSize: 9, fill: '#94a3b8' }} 
                              tickFormatter={(v) => Number.isInteger(v) ? v.toString() : v.toFixed(1)} 
                              axisLine={false} 
                              tickLine={false} 
                            />
                            <Tooltip 
                              contentStyle={{ fontSize: '11px', borderRadius: '6px', padding: '6px 10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                              labelFormatter={(l) => `${factor.name}: ${l}`} 
                              formatter={(val: number) => [val.toFixed(3), locale === 'zh' ? '预测值' : 'Prediction']}
                            />
                            <Line type="linear" dataKey="y" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 5, fill: '#8b5cf6' }} activeDot={{ r: 7 }} isAnimationActive={false} />
                            <ReferenceLine x={currentVal} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" />
                            {cp?.pred !== undefined && Number.isFinite(cp.pred) && (
                              <ReferenceLine y={cp.pred} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  }

                  const curveData = [];
                  const steps = 30;
                  for (let i = 0; i <= steps; i++) {
                    const val = factor.min + (i / steps) * (factor.max - factor.min);
                    const testSettings = { ...settings, [factor.id]: val };
                    const pred = predictAt(testSettings, analysisResult);
                    curveData.push({ x: val, y: Number.isFinite(pred) ? pred : 0 });
                  }
                  const currentVal = Number(settings[factor.id] ?? (factor.min + factor.max) / 2);

                  const yVals = curveData.map(d => d.y);
                  if (cp?.pred !== undefined && Number.isFinite(cp.pred)) yVals.push(cp.pred);
                  const minY = yVals.length > 0 ? Math.min(...yVals) : 0;
                  const maxY = yVals.length > 0 ? Math.max(...yVals) : 1;
                  const pad = Math.max((maxY - minY) * 0.15, 0.5);
                  const safeYDomain: [number, number] = [minY - pad, maxY + pad];

                  return (
                    <div key={`${resp.id}-${factor.id}`} className="h-32 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-2 relative shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={curveData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <XAxis type="number" dataKey="x" domain={[factor.min, factor.max]} hide />
                          <YAxis 
                            type="number" 
                            domain={safeYDomain} 
                            tick={{ fontSize: 9, fill: '#94a3b8' }} 
                            tickFormatter={(v) => Number.isInteger(v) ? v.toString() : v.toFixed(1)} 
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: '11px', borderRadius: '6px', padding: '6px 10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                            labelFormatter={(l) => `${factor.name}: ${Number(l).toFixed(2)}`} 
                            formatter={(val: number) => [val.toFixed(3), locale === 'zh' ? '预测值' : 'Prediction']}
                          />
                          <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <ReferenceLine x={currentVal} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" />
                          {cp?.pred !== undefined && Number.isFinite(cp.pred) && (
                            <ReferenceLine y={cp.pred} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Footer Row: Sliders / Selectors */}
          <div className="font-bold text-[11px] uppercase tracking-widest text-slate-400 flex items-center pt-6 border-t border-slate-200 dark:border-slate-700 mt-2">
            {locale === 'zh' ? '工艺因素设定 (Factor Settings)' : 'Factor Settings'}
          </div>
          {project.factors.map(factor => {
            if (factor.type === 'categorical') {
              const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
              const currentVal = String(settings[factor.id] ?? levels[0]);
              return (
                <div key={`slider-${factor.id}`} className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-2 px-1 flex flex-col items-center">
                  <div className="flex flex-wrap gap-1 justify-center w-full">
                    {levels.map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleSettingChange(factor.id, lvl)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          currentVal === lvl
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-center font-mono">
                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded border border-purple-200 dark:border-purple-800">
                      {currentVal}
                    </span>
                  </div>
                </div>
              );
            }

            const currentVal = Number(settings[factor.id] ?? (factor.min + factor.max) / 2);
            return (
              <div key={`slider-${factor.id}`} className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-2 px-1">
                <input
                  type="range"
                  min={factor.min}
                  max={factor.max}
                  step={(factor.max - factor.min) / 200}
                  value={currentVal}
                  onChange={e => handleSettingChange(factor.id, parseFloat(e.target.value))}
                  className="w-full accent-brand-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer hover:accent-brand-500"
                />
                <div className="mt-3 flex justify-between items-center font-mono">
                  <span className="text-[10px] text-slate-400">{factor.min}</span>
                  <span className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded border border-red-100 dark:border-red-900/30">
                    {currentVal?.toFixed(3)}
                  </span>
                  <span className="text-[10px] text-slate-400">{factor.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
