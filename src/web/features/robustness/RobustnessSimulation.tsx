import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project } from '../../../core/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Play, Info, AlertTriangle } from 'lucide-react';
import { computeAnalysis, predictModelResponse } from '../../../core/analysis/analysisCore';
import { useTranslation } from '../../i18n/LanguageContext';
import { useIsDarkMode, getChartAxisProps, getGridStroke } from '../../shared/chartTheme';

interface RobustnessSimulationProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export default function RobustnessSimulation({ project, updateProject }: RobustnessSimulationProps) {
  const { t, locale } = useTranslation();
  const isDark = useIsDarkMode();
  const defaultState = project.robustnessState || {};

  const [selectedResponseId, setSelectedResponseId] = useState<string>(
    defaultState.selectedResponseId || (project.responses[0]?.id || '')
  );

  // Default nominal settings to center points or first categorical level
  const [nominalSettings, setNominalSettings] = useState<Record<string, string>>(() => {
    if (defaultState.nominalSettings) return defaultState.nominalSettings;
    const init: Record<string, string> = {};
    project.factors.forEach(f => {
      if (f.type === 'categorical') {
        init[f.id] = f.levels && f.levels.length > 0 ? f.levels[0] : 'Level 1';
      } else {
        init[f.id] = String((f.min + f.max) / 2);
      }
    });
    return init;
  });

  // Default SDs to 2% of range (or 0 for categorical)
  const [standardDeviations, setStandardDeviations] = useState<Record<string, string>>(() => {
    if (defaultState.standardDeviations) return defaultState.standardDeviations;
    const init: Record<string, string> = {};
    project.factors.forEach(f => {
      if (f.type === 'categorical') {
        init[f.id] = '0';
      } else {
        const defaultSd = Number(((f.max - f.min) * 0.02).toFixed(4));
        init[f.id] = String(defaultSd);
      }
    });
    return init;
  });

  const [specLimits, setSpecLimits] = useState<Record<string, { lsl: string; usl: string }>>(() => {
    if (defaultState.specLimits) return defaultState.specLimits;
    const init: Record<string, { lsl: string; usl: string }> = {};
    project.responses.forEach(r => {
      init[r.id] = { lsl: '', usl: '' };
    });
    return init;
  });

  const [numSimulations, setNumSimulations] = useState<string>(defaultState.numSimulations || '10000');
  const [includeResidualNoise, setIncludeResidualNoise] = useState<boolean>(defaultState.includeResidualNoise ?? false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulationResults, setSimulationResults] = useState<any>(defaultState.simulationResults || null);

  let activeResponse = project.responses.find(r => r.id === selectedResponseId);
  if (!activeResponse && selectedResponseId !== 'joint' && project.responses.length > 0) {
    activeResponse = project.responses[0];
  }


  const allModels = useMemo(() => {
    return project.responses.reduce((acc, r) => {
      acc[r.id] = computeAnalysis(project, r, r.excludedTerms || [], r.goal, r.targetValue);
      return acc;
    }, {} as Record<string, any>);
  }, [project]);


  // Persist state to project.robustnessState whenever it changes
  useEffect(() => {
    const currentState = {
      selectedResponseId,
      nominalSettings,
      standardDeviations,
      specLimits,
      numSimulations,
      includeResidualNoise,
      simulationResults
    };
    
    const isDifferent = JSON.stringify(currentState) !== JSON.stringify(project.robustnessState || {});
    
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateProject({
          ...project,
          robustnessState: currentState
        });
      }, 500); // Debounce to avoid rapid saves while typing
      return () => clearTimeout(timer);
    }
  }, [selectedResponseId, nominalSettings, standardDeviations, specLimits, numSimulations, includeResidualNoise, simulationResults, project, updateProject]);

  const runSimulation = () => {
    const isJoint = selectedResponseId === 'joint';
    const runsCount = numSimulations.trim() === '' ? 0 : (parseInt(numSimulations, 10) || 0);
    if (runsCount <= 0) {
      setErrorMessage('Please enter at least 1 simulation run (recommended: 5,000 – 10,000).');
      return;
    }
    
    if (!isJoint && !activeResponse) return;
    
    setErrorMessage(null);

    const boxMuller = () => {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2.0 * Math.log(u1 || 1e-9)) * Math.cos(2.0 * Math.PI * u2);
    };

    if (isJoint) {
      const resultsByResponse: Record<string, number[]> = {};
      project.responses.forEach(r => resultsByResponse[r.id] = []);
      const individualOOS: Record<string, any> = {};
      project.responses.forEach(r => individualOOS[r.id] = { outOfSpecCount: 0, belowLSL: 0, aboveUSL: 0 });
      let jointOutOfSpec = 0;

      for (let i = 0; i < runsCount; i++) {
         const simSettings: Record<string, string | number> = {};
         project.factors.forEach(f => {
            if (f.type === 'categorical') {
              simSettings[f.id] = nominalSettings[f.id] || (f.levels ? f.levels[0] : 'Level 1');
            } else {
              const nomStr = nominalSettings[f.id];
              const nominal = (nomStr === '' || nomStr === undefined || isNaN(Number(nomStr))) ? 0 : Number(nomStr);
              const sdStr = standardDeviations[f.id];
              const sd = (sdStr === '' || sdStr === undefined || isNaN(Number(sdStr))) ? 0 : Math.max(0, Number(sdStr));
              simSettings[f.id] = nominal + boxMuller() * sd;
            }
         });
         
         let runFailed = false;
         project.responses.forEach(r => {
            const model = allModels[r.id];
            const baseVal = predictModelResponse(model, simSettings, project);
            const rmse = model?.rmse || 0;
            const val = baseVal + (includeResidualNoise && rmse > 0 ? boxMuller() * rmse : 0);
            resultsByResponse[r.id].push(val);
            
            const lslStr = specLimits[r.id]?.lsl;
            const uslStr = specLimits[r.id]?.usl;
            const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
            const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
            const lsl = hasLsl ? Number(lslStr) : null;
            const usl = hasUsl ? Number(uslStr) : null;
            
            let failedResp = false;
            if (lsl !== null && val < lsl) { individualOOS[r.id].outOfSpecCount++; individualOOS[r.id].belowLSL++; failedResp = true; }
            if (usl !== null && val > usl) { individualOOS[r.id].outOfSpecCount++; individualOOS[r.id].aboveUSL++; failedResp = true; }
            
            if (failedResp) runFailed = true;
         });
         
         if (runFailed) jointOutOfSpec++;
      }

      const individualStats: Record<string, any> = {};
      project.responses.forEach(r => {
         const results = resultsByResponse[r.id];
         results.sort((a,b) => a-b);
         const mean = results.reduce((a,b) => a+b, 0) / runsCount;
         const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runsCount;
         const sd = Math.sqrt(variance);
         
         const lslStr = specLimits[r.id]?.lsl;
         const uslStr = specLimits[r.id]?.usl;
         const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
         const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
         
         individualStats[r.id] = {
           mean, sd,
           defectRate: (individualOOS[r.id].outOfSpecCount / runsCount) * 100,
           belowLSL: individualOOS[r.id].belowLSL,
           aboveUSL: individualOOS[r.id].aboveUSL,
           lsl: hasLsl ? Number(lslStr) : null,
           usl: hasUsl ? Number(uslStr) : null
         };
      });

      setSimulationResults({
         isJoint: true,
         runsCount,
         defectRate: (jointOutOfSpec / runsCount) * 100,
         jointOutOfSpec,
         individualStats,
         includeResidualNoise
      });

    } else {
      const results = [];
      const singleModel = allModels[activeResponse!.id];
      const rmse = singleModel?.rmse || 0;
      for (let i = 0; i < runsCount; i++) {
        const simSettings: Record<string, string | number> = {};
        project.factors.forEach(f => {
          if (f.type === 'categorical') {
            simSettings[f.id] = nominalSettings[f.id] || (f.levels ? f.levels[0] : 'Level 1');
          } else {
            const nomStr = nominalSettings[f.id];
            const nominal = (nomStr === '' || nomStr === undefined || isNaN(Number(nomStr))) ? 0 : Number(nomStr);
            const sdStr = standardDeviations[f.id];
            const sd = (sdStr === '' || sdStr === undefined || isNaN(Number(sdStr))) ? 0 : Math.max(0, Number(sdStr));
            simSettings[f.id] = nominal + boxMuller() * sd;
          }
        });
        const baseVal = predictModelResponse(singleModel, simSettings, project);
        const val = baseVal + (includeResidualNoise && rmse > 0 ? boxMuller() * rmse : 0);
        results.push(val);
      }

      results.sort((a, b) => a - b);

      const mean = results.reduce((a, b) => a + b, 0) / runsCount;
      const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runsCount;
      const sd = Math.sqrt(variance);

      const lslStr = specLimits[activeResponse!.id]?.lsl;
      const uslStr = specLimits[activeResponse!.id]?.usl;
      const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
      const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
      const lsl = hasLsl ? Number(lslStr) : null;
      const usl = hasUsl ? Number(uslStr) : null;

      let outOfSpecCount = 0;
      let belowLSL = 0;
      let aboveUSL = 0;

      results.forEach(val => {
        if (lsl !== null && val < lsl) {
          outOfSpecCount++;
          belowLSL++;
        }
        if (usl !== null && val > usl) {
          outOfSpecCount++;
          aboveUSL++;
        }
      });

      const defectRate = (outOfSpecCount / runsCount) * 100;

      const bins = 40;
      const minVal = results[0];
      const maxVal = results[results.length - 1];
      const binWidth = (maxVal - minVal) / bins || 1;
      const histogram = Array.from({ length: bins }, (_, i) => ({
        x0: minVal + i * binWidth,
        x1: minVal + (i + 1) * binWidth,
        mid: minVal + (i + 0.5) * binWidth,
        count: 0
      }));

      results.forEach(val => {
        const binIdx = Math.min(Math.floor((val - minVal) / binWidth), bins - 1);
        if (histogram[binIdx]) {
          histogram[binIdx].count++;
        }
      });

      setSimulationResults({
        isJoint: false,
        mean,
        sd,
        defectRate,
        belowLSL,
        aboveUSL,
        histogram,
        lsl,
        usl,
        includeResidualNoise
      });
    }
  };

  if (!project.responses.length || !project.factors.length) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-lg shadow-sm border border-slate-200">
        {locale === 'zh' ? '请先在参数设置中添加因素、响应指标并录入试验结果以使用鲁棒性模拟器。' : 'Please add factors, responses, and runs to use the simulator.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Configuration Panel */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Activity size={16} className="text-brand-600" />
            {locale === 'zh' ? '蒙特卡洛模拟设置' : 'Simulation Setup'}
          </h3>
          
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {locale === 'zh' ? '目标响应指标' : 'Target Response'}
            </label>
            <select
              value={selectedResponseId}
              onChange={(e) => setSelectedResponseId(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {project.responses.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
              <option value="joint" className="font-bold">
                {locale === 'zh' ? '全部响应 (联合超标率/OOS)' : 'All Responses (Joint Defect Rate)'}
              </option>
            </select>
          </div>

          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
              {locale === 'zh' ? '工艺因素设定与设备波动 (标准差 σ)' : 'Factor Settings & Noise (standard deviation)'}
            </h4>
            <div className="space-y-3">
              {project.factors.map(f => {
                if (f.type === 'categorical') {
                  const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
                  return (
                    <div key={f.id} className="grid grid-cols-2 gap-2 items-center">
                      <div className="col-span-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 ml-1.5 font-medium">
                          {locale === 'zh' ? `(${levels.length} 个水平, 类别变量)` : `(${levels.length} levels, Categorical)`}
                        </span>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                          {locale === 'zh' ? '设定水平' : 'Nominal Level'}
                        </label>
                        <select
                          value={nominalSettings[f.id] ?? levels[0]}
                          onChange={(e) => setNominalSettings(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-full text-xs border border-purple-300 dark:border-purple-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          {levels.map((lvl, lIdx) => (
                            <option key={lIdx} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-400 block mb-0.5">
                          {locale === 'zh' ? '波动噪声 (σ)' : 'Noise (σ)'}
                        </label>
                        <div className="text-[11px] text-slate-400 italic py-1 px-1.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
                          {locale === 'zh' ? '固定值 (离散类别)' : 'Fixed (Discrete)'}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={f.id} className="grid grid-cols-2 gap-2 items-center">
                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
                      <span className="text-[10px] text-black dark:text-slate-200 ml-1.5 font-medium">({f.min} - {f.max})</span>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                        {locale === 'zh' ? '基准设定值' : 'Nominal'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={nominalSettings[f.id] ?? ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '.');
                          if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                            setNominalSettings(prev => ({ ...prev, [f.id]: val }));
                          }
                        }}
                        className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                        {locale === 'zh' ? '标准差 (σ)' : 'standard deviation (σ)'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={standardDeviations[f.id] ?? ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '.');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setStandardDeviations(prev => ({ ...prev, [f.id]: val }));
                          }
                        }}
                        className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
              {locale === 'zh' ? '质量规格限 (Specification Limits)' : 'Specification Limits'}
            </h4>
            {selectedResponseId === 'joint' ? (
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                {project.responses.map(r => (
                  <div key={r.id} className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{r.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                          {locale === 'zh' ? '规格下限 (LSL)' : 'LSL (Lower)'}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={specLimits[r.id]?.lsl ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '.');
                            if (val === '' || /^\-?\d*\.?\d*$/.test(val)) {
                              setSpecLimits(prev => ({
                                ...prev,
                                [r.id]: { lsl: val, usl: prev[r.id]?.usl ?? "" }
                              }));
                            }
                          }}
                          className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder={locale === 'zh' ? '可选' : 'Optional'}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                          {locale === 'zh' ? '规格上限 (USL)' : 'USL (Upper)'}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={specLimits[r.id]?.usl ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '.');
                            if (val === '' || /^\-?\d*\.?\d*$/.test(val)) {
                              setSpecLimits(prev => ({
                                ...prev,
                                [r.id]: { lsl: prev[r.id]?.lsl ?? "", usl: val }
                              }));
                            }
                          }}
                          className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder={locale === 'zh' ? '可选' : 'Optional'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                    {locale === 'zh' ? '规格下限 (LSL)' : 'LSL (Lower)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={specLimits[activeResponse?.id || '']?.lsl ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '.');
                      if (val === '' || /^\-?\d*\.?\d*$/.test(val)) {
                        setSpecLimits(prev => ({
                          ...prev,
                          [activeResponse!.id]: { lsl: val, usl: prev[activeResponse!.id]?.usl ?? "" }
                        }));
                      }
                    }}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder={locale === 'zh' ? '可选' : 'Optional'}
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">
                    {locale === 'zh' ? '规格上限 (USL)' : 'USL (Upper)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={specLimits[activeResponse?.id || '']?.usl ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '.');
                      if (val === '' || /^\-?\d*\.?\d*$/.test(val)) {
                        setSpecLimits(prev => ({
                          ...prev,
                          [activeResponse!.id]: { lsl: prev[activeResponse!.id]?.lsl ?? "", usl: val }
                        }));
                      }
                    }}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder={locale === 'zh' ? '可选' : 'Optional'}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1 font-semibold">
              {locale === 'zh' ? '模拟样本量 (Simulations)' : 'Simulations'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={numSimulations}
              placeholder="e.g. 10000"
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, '');
                if (val === '' || /^\d*$/.test(val)) {
                  setNumSimulations(val);
                }
              }}
              className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
              {locale === 'zh' 
                ? '推荐: 5,000 至 10,000 次模拟以获得高置信度的超标率预估（最高可至 50,000 次）。' 
                : 'Recommended: 5,000 to 10,000 runs for reliable defect rate estimates (up to 50,000 for high precision).'}
            </p>
          </div>

          <div className="mb-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeResidualNoise}
                onChange={(e) => setIncludeResidualNoise(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {locale === 'zh' ? '计入过程残差未解释误差 (RMSE)' : 'Include Process Residual Error (RMSE)'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                  {selectedResponseId === 'joint' 
                    ? (locale === 'zh' ? '为每个响应添加未被模型解释的实验噪声波动 (RMSE)。' : 'Adds unexplained experimental process variation (model RMSE) to each response.')
                    : (locale === 'zh' ? `计入实验过程未解释波动 (模型残差 RMSE: ±${(allModels[activeResponse?.id || '']?.rmse || 0).toFixed(3)})。若未勾选，仅计算因素传递噪声。` : `Adds unexplained process variation (Model RMSE: ±${(allModels[activeResponse?.id || '']?.rmse || 0).toFixed(3)}). When unchecked, models transmitted factor noise only.`)}
                </p>
              </div>
            </label>
          </div>

          {errorMessage && (
            <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0 text-amber-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            onClick={runSimulation}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors cursor-pointer"
          >
            <Play size={16} />
            {locale === 'zh' ? '运行蒙特卡洛鲁棒性模拟' : 'Run Monte Carlo Simulation'}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {simulationResults ? (
          simulationResults.isJoint ? (
            <div className="flex flex-col gap-4">
              <div className={`p-6 rounded-lg shadow-sm border ${
                simulationResults.defectRate === 0 
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : simulationResults.defectRate > 5 
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              }`}>
                <div className={`text-xs uppercase tracking-widest font-bold mb-2 flex items-center gap-1 ${
                  simulationResults.defectRate === 0 ? 'text-emerald-700 dark:text-emerald-400' : simulationResults.defectRate > 5 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  <AlertTriangle size={16} /> {locale === 'zh' ? '联合超标缺陷率 (任一响应超出规格)' : 'Joint Defect Rate (OOS in ANY Response)'}
                </div>
                <div className={`text-4xl font-bold font-mono ${
                  simulationResults.defectRate === 0 ? 'text-emerald-800 dark:text-emerald-300' : simulationResults.defectRate > 5 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {simulationResults.defectRate.toFixed(2)}%
                </div>
                {simulationResults.defectRate > 0 && (
                  <div className={`text-xs mt-2 ${simulationResults.defectRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {(simulationResults.defectRate / 100 * 1000000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} DPMO
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{locale === 'zh' ? '响应指标' : 'Response'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{locale === 'zh' ? '模拟均值' : 'Mean'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{locale === 'zh' ? '标准差 (σ)' : 'Std Dev (σ)'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{locale === 'zh' ? '低于下限' : 'Below LSL'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{locale === 'zh' ? '高于上限' : 'Above USL'}</th>
                      <th className="px-4 py-3 font-semibold text-right">{locale === 'zh' ? '超标率' : 'Defect Rate'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {project.responses.map(r => {
                      const stats = simulationResults.individualStats?.[r.id];
                      if (!stats) return null;
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{stats.mean.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right font-mono">{stats.sd.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-500">{stats.belowLSL > 0 ? stats.belowLSL.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-500">{stats.aboveUSL > 0 ? stats.aboveUSL.toLocaleString() : '-'}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${stats.defectRate > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {stats.defectRate.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-1">
                  {locale === 'zh' ? '模拟响应均值' : 'Simulated Mean'}
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                  {simulationResults.mean?.toFixed(3)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-1">
                  {locale === 'zh' ? '模拟标准差 (σ)' : 'Simulated standard deviation (σ)'}
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                  {simulationResults.sd?.toFixed(3)}
                </div>
              </div>
              <div className={`p-4 rounded-lg shadow-sm border ${
                simulationResults.defectRate === 0 
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : simulationResults.defectRate > 5 
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              }`}>
                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1 ${
                  simulationResults.defectRate === 0 ? 'text-emerald-700 dark:text-emerald-400' : simulationResults.defectRate > 5 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  <AlertTriangle size={12} /> {locale === 'zh' ? '超标缺陷率 (OOS)' : 'Defect Rate (OOS)'}
                </div>
                <div className={`text-2xl font-bold font-mono ${
                  simulationResults.defectRate === 0 ? 'text-emerald-800 dark:text-emerald-300' : simulationResults.defectRate > 5 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {simulationResults.defectRate?.toFixed(2)}%
                </div>
                {simulationResults.defectRate > 0 && (
                  <div className={`text-[10px] mt-1 ${simulationResults.defectRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {(simulationResults.defectRate / 100 * 1000000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} DPMO
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {locale === 'zh' ? '响应分布直方图' : 'Response Distribution'}
                </h3>
                <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {simulationResults.includeResidualNoise 
                    ? (locale === 'zh' ? '传递噪声 + 残差未解释误差 (RMSE)' : 'Transmitted Noise + Residual Error (RMSE)') 
                    : (locale === 'zh' ? '因素波动传递误差' : 'Transmitted Factor Variation')}
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulationResults.histogram} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke(isDark)} />
                    <XAxis 
                      dataKey="mid" 
                      tickFormatter={(val) => val.toFixed(2)} 
                      {...getChartAxisProps(isDark, { fontSize: 11 })} 
                      type="number"
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis {...getChartAxisProps(isDark, { fontSize: 11 })} />
                    <Tooltip 
                      contentStyle={{ 
                        fontSize: '11px', 
                        borderRadius: '4px', 
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? '#475569' : '#e2e8f0',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelFormatter={(val) => `${locale === 'zh' ? '响应值' : 'Response'}: ~${Number(val).toFixed(2)}`}
                    />
                    <Bar dataKey="count" fill="#0c75b3" radius={[2, 2, 0, 0]} />
                    {simulationResults.lsl !== null && (
                      <ReferenceLine x={simulationResults.lsl} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'LSL', position: 'top', fill: '#ef4444', fontSize: 11 }} />
                    )}
                    {simulationResults.usl !== null && (
                      <ReferenceLine x={simulationResults.usl} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'USL', position: 'top', fill: '#ef4444', fontSize: 11 }} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {simulationResults.lsl !== null && (
                   <div className="text-[11px] text-slate-500">
                     <span className="font-bold text-red-500">{locale === 'zh' ? '低于规格下限 (Below LSL):' : 'Below LSL:'}</span> {simulationResults.belowLSL?.toLocaleString()} {locale === 'zh' ? '批次' : 'runs'}
                   </div>
                )}
                {simulationResults.usl !== null && (
                   <div className="text-[11px] text-slate-500">
                     <span className="font-bold text-red-500">{locale === 'zh' ? '高于规格上限 (Above USL):' : 'Above USL:'}</span> {simulationResults.aboveUSL?.toLocaleString()} {locale === 'zh' ? '批次' : 'runs'}
                   </div>
                )}
              </div>
            </div>
          </>
          )
        ) : (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col items-center justify-center text-center">
            <Activity size={48} className="text-slate-200 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
              {locale === 'zh' ? '准备执行模拟' : 'Ready to Simulate'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              {locale === 'zh' 
                ? '在左侧配置基准操作点、因素公差标准差和质量规格限，然后点击“运行蒙特卡洛鲁棒性模拟”预测工艺超标率与生产能力。' 
                : 'Configure your nominal operating point, factor noise, and spec limits on the left, then click Run Simulation to predict your process defect rate.'}
            </p>
          </div>
        )}

        {/* How it Works Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1.5">
            <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <h4 className="text-[11px] font-bold text-brand-700 dark:text-blue-400 uppercase tracking-widest">
              {locale === 'zh' ? '方法原理与指南' : 'How it Works'}
            </h4>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            {locale === 'zh'
              ? '蒙特卡洛鲁棒性模拟器通过数学回归模型运行数千批次虚拟试验，向基准因素设定注入正态分布噪声（设备控制公差与工艺波动），以预测实际放量生产中的变异情况与超出规格限 (OOS) 的缺陷率。请根据实际车间或实验室设备的控制能力设定标准差，并输入质量标准上下限（LSL / USL）以评估制程能力与缺陷率 (DPMO)。'
              : 'The Monte Carlo simulator runs virtual batches through your regression model, injecting normally distributed noise (standard deviation) into nominal factor settings to predict real-world variability and defect rates. Configure your settings on the left and click "Run Monte Carlo Simulation". Ensure you set realistic standard deviations based on your equipment capabilities and set specification limits (LSL / USL) to accurately determine the out-of-specification (OOS) defect rate.'}
          </p>
        </div>
      </div>
    </div>
  );
}
