import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../../../core/types';
import { computeAnalysis, predictModelResponse } from '../../../core/analysis/analysisCore';
import { fitProjectModelsById } from '../../../core/analysis/projectModels';
import { ActualByPredictedPlot, StudentizedResidualsPlot } from '../../shared/ResidualsPlots';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, ScatterChart, Scatter, ZAxis, Legend, Cell } from 'recharts';
import { Download, HelpCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import createPlotlyComponent from 'react-plotly.js/factory';
import { PlotlyErrorBoundary } from '../../shared/PlotlyErrorBoundary';
import { useTranslation } from '../../i18n/LanguageContext';
import { useIsDarkMode, getChartAxisProps, getGridStroke, getAxisLabelProps, getChartTooltipProps } from '../../shared/chartTheme';
const Plot = createPlotlyComponent((window as any).Plotly);

function TableHelpTooltip({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const tooltipWidth = 300;
    const tooltipHeightApprox = 210;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < tooltipHeightApprox && rect.top > tooltipHeightApprox;

    const left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 16, rect.left - 8));
    const top = placeAbove ? rect.top - 6 : rect.bottom + 6;

    setCoords({ top, left, placeAbove });
  };

  const handleOpen = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Help: ${title}`}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) handleClose();
          else handleOpen();
        }}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 rounded focus:outline-hidden cursor-help inline-flex items-center"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && coords && createPortal(
        <div
          className="fixed w-76 p-3 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-100 rounded-lg shadow-2xl border border-slate-700/80 text-[10px] leading-relaxed pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
          style={{
            zIndex: 999999,
            left: `${coords.left}px`,
            top: coords.placeAbove ? 'auto' : `${coords.top}px`,
            bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
          }}
        >
          <div className="font-semibold text-white mb-1.5 border-b border-slate-700/60 pb-1 flex items-center justify-between">
            <span>{title}</span>
            <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Guide</span>
          </div>
          <div className="space-y-1.5 text-slate-200">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

interface Props {
  project: Project;
}

export default function CompareResponses({ project }: Props) {
  const { t, locale } = useTranslation();
  const isDark = useIsDarkMode();
  const [selectedPlot, setSelectedPlot] = useState<'main-effects' | 'actual-vs-predicted' | 'studentized-residuals' | 'effects-plot' | 'effect-summary' | 'parameter-estimates' | 'effect-tests' | 'lack-of-fit' | 'interaction-plot' | 'doe-mean-plot' | 'contour-surface'>('effects-plot');

  const [effectsPlotType, setEffectsPlotType] = useState<'pareto' | 'half-normal'>('pareto');
  const [xAxisFactorId, setXAxisFactorId] = useState<string>('');
  const [yAxisFactorId, setYAxisFactorId] = useState<string>('');
  const [interactionF1Id, setInteractionF1Id] = useState<string>('');
  const [interactionF2Id, setInteractionF2Id] = useState<string>('');
  const [plot3dType, setPlot3dType] = useState<'scatter3d' | 'mesh3d' | 'contour'>('scatter3d');
  const [syncCamera, setSyncCamera] = useState(false);
  const [cameraState, setCameraState] = useState<any>(null);

  const hasData = project.runs.length > 0 && project.responses.length > 0 && project.factors.length > 0;

  const allAnalysis = useMemo(() => {
    if (!hasData) return [];
    const fittedById = fitProjectModelsById(project);
    return project.responses.map(resp => {
      const analysis = fittedById[resp.id] ?? null;
      
      // Compute interactionData
      let interactionData = null;
      if (project.factors.length >= 2) {
        const validRuns = project.runs.filter(r => r.responses[resp.id] !== null);
        let f1 = project.factors.find(f => f.id === interactionF1Id) || project.factors[0];
        let f2 = project.factors.find(f => f.id === interactionF2Id);
        if (!f2 || f2.id === f1.id) f2 = project.factors.find(f => f.id !== f1.id) || project.factors[1];
        
        if (f1 && f2) {
          const f1Mid = (f1.min + f1.max) / 2;
          const f2Mid = (f2.min + f2.max) / 2;
          let llSum = 0, llCount = 0, lhSum = 0, lhCount = 0, hlSum = 0, hlCount = 0, hhSum = 0, hhCount = 0;
          validRuns.forEach(run => {
            const v1 = Number(run.factors[f1.id]);
            const v2 = Number(run.factors[f2.id]);
            const res = Number(run.responses[resp.id]);
            if (v1 < f1Mid - 1e-6 && v2 < f2Mid - 1e-6) { llSum += res; llCount++; }
            if (v1 < f1Mid - 1e-6 && v2 > f2Mid + 1e-6) { lhSum += res; lhCount++; }
            if (v1 > f1Mid + 1e-6 && v2 < f2Mid - 1e-6) { hlSum += res; hlCount++; }
            if (v1 > f1Mid + 1e-6 && v2 > f2Mid + 1e-6) { hhSum += res; hhCount++; }
          });
          interactionData = {
            f1, f2,
            data: [
              { x: f1.min, low: llCount > 0 ? llSum / llCount : null, high: lhCount > 0 ? lhSum / lhCount : null },
              { x: f1.max, low: hlCount > 0 ? hlSum / hlCount : null, high: hhCount > 0 ? hhSum / hhCount : null },
            ]
          };
        }
      }

      // Compute doeMeanData
      const doeMeanData = project.runs
        .filter(r => r.responses[resp.id] !== null)
        .map((r, i) => ({ run: `Run ${i + 1}`, value: r.responses[resp.id] }));

      // Compute plotData (Contour / Surface)
      let plotData = null;
      if (project.factors.length >= 2) {
        const xFactor = project.factors.find(f => f.id === xAxisFactorId) || project.factors[0];
        const yFactor = project.factors.find(f => f.id === yAxisFactorId && f.id !== xFactor.id) || project.factors.find(f => f.id !== xFactor.id) || project.factors[1] || project.factors[0];
        const validRuns = project.runs.filter(r => r.responses[resp.id] !== null && r.responses[resp.id] !== undefined && Number.isFinite(Number(r.responses[resp.id])));
        
        if (validRuns.length >= 2) {
          const getFactorNumeric = (f: any, rawVal: any): number => {
            if (f.type === 'categorical') {
              const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
              const idx = levels.indexOf(String(rawVal));
              return idx >= 0 ? idx : 0;
            }
            const n = Number(rawVal);
            return Number.isFinite(n) ? n : (typeof f.min === 'number' && Number.isFinite(f.min) ? f.min : 0);
          };

          const getFactorBounds = (f: any): { min: number; max: number } => {
            if (f.type === 'categorical') {
              const count = Math.max(2, f.levels?.length || 2);
              return { min: 0, max: count - 1 };
            }
            const min = typeof f.min === 'number' && Number.isFinite(f.min) ? f.min : 0;
            const max = typeof f.max === 'number' && Number.isFinite(f.max) ? f.max : (min + 1);
            return { min, max: max <= min ? min + 1 : max };
          };

          const xBounds = getFactorBounds(xFactor);
          const yBounds = getFactorBounds(yFactor);

          if (plot3dType === 'scatter3d') {
            const xValues = validRuns.map(r => getFactorNumeric(xFactor, r.factors[xFactor.id]));
            const yValues = validRuns.map(r => getFactorNumeric(yFactor, r.factors[yFactor.id]));
            const zValues = validRuns.map(r => Number(r.responses[resp.id]));

            let minZ = Math.min(...zValues);
            let maxZ = Math.max(...zValues);
            if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) { minZ = 0; maxZ = 1; }
            if (minZ === maxZ) { minZ -= 1; maxZ += 1; }

            plotData = {
              xFactor, yFactor, activeResponse: resp,
              xBounds, yBounds, zBounds: { min: minZ, max: maxZ },
              data: [{ x: xValues, y: yValues, z: zValues, type: 'scatter3d', mode: 'markers', marker: { size: 8, color: zValues, colorscale: 'Viridis', opacity: 0.8 } }]
            };
          } else {
            const k = project.factors.length;
            const X = validRuns.map(r => project.factors.map(f => getFactorNumeric(f, r.factors[f.id])));
            const Y = validRuns.map(r => Number(r.responses[resp.id]));
            const meanX = Array(k).fill(0);
            let meanY = 0;
            for (let i = 0; i < X.length; i++) {
              meanY += Y[i];
              for (let j = 0; j < k; j++) meanX[j] += X[i][j];
            }
            meanY /= X.length;
            for (let j = 0; j < k; j++) meanX[j] /= X.length;

            const beta = Array(k).fill(0);
            for (let j = 0; j < k; j++) {
              let cov = 0, varX = 0;
              for (let i = 0; i < X.length; i++) {
                cov += (X[i][j] - meanX[j]) * (Y[i] - meanY);
                varX += Math.pow(X[i][j] - meanX[j], 2);
              }
              beta[j] = varX > 1e-10 ? cov / varX : 0;
            }

            const getTrend = (x: number[]) => {
              let y = meanY;
              for (let j = 0; j < k; j++) y += beta[j] * (x[j] - meanX[j]);
              return y;
            };
            const predict = (x_vec: number[]) => {
              if (analysis) {
                const settingsMap: Record<string, any> = {};
                project.factors.forEach((f, idx) => {
                  settingsMap[f.id] = x_vec[idx];
                  settingsMap[f.name] = x_vec[idx];
                });
                const pred = predictModelResponse(analysis, settingsMap, project);
                if (Number.isFinite(pred)) return pred;
              }
              return getTrend(x_vec);
            };
            
            const gridSize = 35;
            const xMin = xBounds.min;
            const xMax = xBounds.max;
            const yMin = yBounds.min;
            const yMax = yBounds.max;

            const gridX = Array.from({length: gridSize}, (_, i) => xMin + (xMax - xMin) * i / (gridSize - 1));
            const gridY = Array.from({length: gridSize}, (_, i) => yMin + (yMax - yMin) * i / (gridSize - 1));
            const zGrid: number[][] = [];
            let minZ = Infinity;
            let maxZ = -Infinity;
            
            for (let i = 0; i < gridSize; i++) {
              const row: number[] = [];
              const currentY = gridY[i];
              for (let j = 0; j < gridSize; j++) {
                const currentX = gridX[j];
                const x_vec = project.factors.map(f => {
                  if (f.id === xFactor.id) return currentX;
                  if (f.id === yFactor.id) return currentY;
                  const fb = getFactorBounds(f);
                  return (fb.min + fb.max) / 2;
                });
                const pred = predict(x_vec);
                const safePred = Number.isFinite(pred) ? pred : meanY;
                if (safePred < minZ) minZ = safePred;
                if (safePred > maxZ) maxZ = safePred;
                row.push(safePred);
              }
              zGrid.push(row);
            }

            if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) { minZ = 0; maxZ = 1; }
            if (minZ === maxZ) { minZ -= 1; maxZ += 1; }

            const zBounds = { min: minZ, max: maxZ };

            if (plot3dType === 'mesh3d') {
              const zSpan = maxZ - minZ;
              const zFloor = minZ - (zSpan > 0 ? zSpan * 0.12 : 0.5);
              const zCeil = maxZ + (zSpan > 0 ? zSpan * 0.04 : 0.5);
              plotData = {
                xFactor, yFactor, activeResponse: resp,
                xBounds, yBounds, zBounds: { min: zFloor, max: zCeil },
                data: [{ 
                  x: gridX, 
                  y: gridY, 
                  z: zGrid, 
                  type: 'surface', 
                  colorscale: 'Viridis', 
                  cmin: minZ,
                  cmax: maxZ,
                  opacity: 1,
                  contours: { 
                    z: { 
                      show: true, 
                      usecolormap: false, 
                      color: "#334155", 
                      highlightcolor: "#0f172a", 
                      project: { z: true } 
                    } 
                  } 
                }]
              };
            } else if (plot3dType === 'contour') {
              plotData = {
                xFactor, yFactor, activeResponse: resp,
                xBounds, yBounds, zBounds,
                data: [{ x: gridX, y: gridY, z: zGrid, type: 'contour', colorscale: 'Viridis' }]
              };
            }
          }
        }
      }

      return {
        response: resp,
        analysis,
        interactionData,
        doeMeanData,
        plotData
      };
    }).filter(r => r.analysis !== null);
  }, [project, hasData, interactionF1Id, interactionF2Id, plot3dType, xAxisFactorId, yAxisFactorId]);

  const handleDownloadSvg = (containerId: string, filename: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Temporarily hide all download buttons so they don't appear in the image
    const buttons = container.querySelectorAll('button');
    buttons.forEach(b => (b as HTMLElement).style.display = 'none');

    toPng(container, { 
      backgroundColor: '#ffffff', 
      pixelRatio: 2,
      filter: (node) => {
        if (node instanceof Element) {
          if (
            node.tagName === 'BUTTON' ||
            node.closest('button') ||
            node.getAttribute('data-export-hide') === 'true' ||
            node.closest('[data-export-hide="true"]') ||
            node.getAttribute('title')?.toLowerCase().includes('download')
          ) {
            return false;
          }
        }
        return true;
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = filename + '.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Oops, something went wrong!', err);
        alert('Failed to generate image.');
      })
      .finally(() => {
        // Restore buttons
        buttons.forEach(b => (b as HTMLElement).style.display = '');
      });
  };

  if (!hasData) {
    return <div className="p-8 text-center text-[11px] text-slate-500 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
      {locale === 'zh' ? '暂无足够数据进行对比。请先在参数设置、实验矩阵中添加因素、响应并录入试验结果。' : 'Insufficient data for comparison. Please add factors, responses, and run results.'}
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Dropdown for plot selection */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">
            {locale === 'zh' ? '选择对比图表/模型视图:' : 'Select Plot to Compare:'}
          </span>
          <select 
            value={selectedPlot} 
            onChange={e => setSelectedPlot(e.target.value as any)}
            className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="effects-plot">{locale === 'zh' ? '效应图 (Pareto / 半正态)' : 'Effects Plot (Pareto / Half-Normal)'}</option>
            <option value="effect-summary">{locale === 'zh' ? '效应摘要 (LogWorth 排名)' : 'Effect Summary'}</option>
            <option value="parameter-estimates">{locale === 'zh' ? '参数估算表 (Regression Coefficients)' : 'Parameter Estimates'}</option>
            <option value="effect-tests">{locale === 'zh' ? '效应检验 (ANOVA 方差分析)' : 'Effect Tests'}</option>
            <option value="lack-of-fit">{locale === 'zh' ? '失拟项分析 (Lack of Fit)' : 'Lack of Fit'}</option>
            <option value="main-effects">{locale === 'zh' ? '主效应均值图 (Main Effects)' : 'Main Effects Plot'}</option>
            <option value="interaction-plot">{locale === 'zh' ? '二阶交互作用图 (Interaction)' : 'Interaction Plot'}</option>
            <option value="actual-vs-predicted">{locale === 'zh' ? '实际值 vs 预测值 (Actual by Predicted)' : 'Actual by Predicted Plot'}</option>
            <option value="studentized-residuals">{locale === 'zh' ? '学生化残差散点图 (Residuals)' : 'Studentized Residuals Plot'}</option>
            <option value="doe-mean-plot">{locale === 'zh' ? 'DOE 水平响应均值图' : 'DOE Mean Plot'}</option>
            <option value="contour-surface">{locale === 'zh' ? '等高线与 3D 响应曲面 (RSM)' : 'Contour & Response Surface'}</option>
          </select>
        </div>

        {selectedPlot === 'effects-plot' && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">
              {locale === 'zh' ? '图表类型:' : 'Plot Type:'}
            </span>
            <select 
              value={effectsPlotType}
              onChange={e => setEffectsPlotType(e.target.value as 'pareto' | 'half-normal')}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="pareto">{locale === 'zh' ? 'Pareto: 标准化效应' : 'Pareto: Standardized'}</option>
              <option value="half-normal">{locale === 'zh' ? '半正态概率图 (Half-Normal)' : 'Half-Normal'}</option>
            </select>
          </div>
        )}

        {selectedPlot === 'interaction-plot' && project.factors.length >= 2 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? '因素 1:' : 'Factor 1:'}</span>
              <select 
                value={interactionF1Id || project.factors[0]?.id || ''} 
                onChange={e => setInteractionF1Id(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {project.factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? '因素 2:' : 'Factor 2:'}</span>
              <select 
                value={interactionF2Id || (project.factors.find(f => f.id !== interactionF1Id)?.id || project.factors[1]?.id) || ''} 
                onChange={e => setInteractionF2Id(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {project.factors.filter(f => f.id !== (interactionF1Id || project.factors[0]?.id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {selectedPlot === 'contour-surface' && project.factors.length >= 2 && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? '类型:' : 'Type:'}</span>
              <select 
                value={plot3dType} 
                onChange={e => setPlot3dType(e.target.value as any)}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="scatter3d">{locale === 'zh' ? '3D 散点图' : 'Scatter 3D'}</option>
                <option value="mesh3d">{locale === 'zh' ? '3D 响应曲面 (网格)' : 'Surface 3D (Mesh)'}</option>
                <option value="contour">{locale === 'zh' ? '2D 等高线图' : 'Contour 2D'}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? 'X 轴:' : 'X-Axis:'}</span>
              <select 
                value={xAxisFactorId || project.factors[0]?.id || ''} 
                onChange={e => setXAxisFactorId(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {project.factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? 'Y 轴:' : 'Y-Axis:'}</span>
              <select 
                value={yAxisFactorId || project.factors[1]?.id || ''} 
                onChange={e => setYAxisFactorId(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                {project.factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            
            {(plot3dType === 'scatter3d' || plot3dType === 'mesh3d') && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                <input 
                  type="checkbox" 
                  id="syncCamera"
                  checked={syncCamera}
                  onChange={(e) => {
                    setSyncCamera(e.target.checked);
                    if (!e.target.checked) setCameraState(null);
                  }}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3 h-3"
                />
                <label htmlFor="syncCamera" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">
                  {locale === 'zh' ? '同步 3D 视角' : 'Sync Camera'}
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Render selected plot for all responses */}
      <div className={`grid ${['main-effects'].includes(selectedPlot) ? 'grid-cols-1 gap-6' : 'grid-cols-1 lg:grid-cols-2 gap-4'}`}>
        {allAnalysis.map(({ response, analysis, interactionData, doeMeanData, plotData }) => {
          if (!analysis) return null;

          if (selectedPlot === 'actual-vs-predicted') {
            return (
              <div key={response.id} className="flex flex-col">
                <h4 className="text-[12px] font-bold mb-2 text-brand-700 dark:text-blue-400 pl-1">{response.name}</h4>
                <ActualByPredictedPlot actualByPredicted={analysis.actualByPredicted} projectName={project.name} />
              </div>
            );
          }

          if (selectedPlot === 'studentized-residuals') {
            return (
              <div key={response.id} className="flex flex-col">
                <h4 className="text-[12px] font-bold mb-2 text-brand-700 dark:text-blue-400 pl-1">{response.name}</h4>
                <StudentizedResidualsPlot studentizedResiduals={analysis.studentizedResiduals} projectName={project.name} />
              </div>
            );
          }

          if (selectedPlot === 'effects-plot') {
             return (
               <div key={response.id} id={`compare-effects-${response.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="text-[12px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">{response.name}</h3>
                   </div>
                   <button
                     data-export-hide="true"
                     onClick={() => handleDownloadSvg(`compare-effects-${response.id}`, `${project.name}_${response.name}_Effects`)}
                     className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                     title="Download PNG"
                   >
                     <Download size={14} />
                   </button>
                 </div>
                 <div className="h-64 w-full relative">
                   {effectsPlotType === 'pareto' ? (
                     analysis.paretoData && analysis.paretoData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={analysis.paretoData} layout="vertical" margin={{ top: 25, right: 30, left: 40, bottom: 10 }}>
                           <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke(isDark)} />
                           <XAxis type="number" dataKey="tRatio" {...getChartAxisProps(isDark)} />
                           <YAxis type="category" dataKey="factor.name" width={100} interval={0} {...getChartAxisProps(isDark)} />
                           <ReferenceLine x={analysis.tLimitPareto} stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'top', value: 't-Limit', fill: '#16a34a', fontSize: 10, fontWeight: 600 }} />
                           <ReferenceLine x={analysis.bonferroniLimitPareto} stroke="#9333ea" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'bottom', value: 'Bonferroni', fill: '#9333ea', fontSize: 10, fontWeight: 600 }} />
                           <Tooltip {...getChartTooltipProps(isDark)} formatter={(value: number, name: string, props: any) => [`${value.toFixed(3)} (${props.payload.direction})`, 'Effect Size']} />
                           <Bar dataKey="tRatio" radius={[0, 4, 4, 0]}>
                             {analysis.paretoData.map((entry: any, index: number) => {
                                 const isSig = entry.tRatio > analysis.tLimitPareto;
                                 let color = isSig ? (entry.direction === 'Positive' ? '#2563eb' : '#dc2626') : (entry.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                                 return <Cell key={`cell-${index}`} fill={color} />;
                             })}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
                     )
                   ) : (
                     analysis.halfNormalData && analysis.halfNormalData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <ScatterChart margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} />
                           <XAxis type="number" dataKey="tRatio" {...getChartAxisProps(isDark)} />
                           <YAxis type="number" dataKey="expected" width={45} {...getChartAxisProps(isDark)} domain={[-0.1, 2.7]} ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]} tickFormatter={(val) => {
                             if (Math.abs(val - 0) < 0.05) return '0';
                             if (Math.abs(val - 0.253) < 0.05) return '20';
                             if (Math.abs(val - 0.385) < 0.05) return '30';
                             if (Math.abs(val - 0.674) < 0.05) return '50';
                             if (Math.abs(val - 1.036) < 0.05) return '70';
                             if (Math.abs(val - 1.282) < 0.05) return '80';
                             if (Math.abs(val - 1.645) < 0.05) return '90';
                             if (Math.abs(val - 1.96) < 0.05) return '95';
                             if (Math.abs(val - 2.576) < 0.05) return '99';
                             return '';
                           }} />
                           <ZAxis type="category" dataKey="factor.name" name="Factor" />
                           <Tooltip {...getChartTooltipProps(isDark)} cursor={{ strokeDasharray: '3 3', stroke: isDark ? 'rgba(255, 255, 255, 0.3)' : '#cbd5e1' }} formatter={(value: number, name: string, props: any) => [name === 'Factor' || name === 'factor.name' ? props.payload.name : value.toFixed(3), name === 'Factor' || name === 'factor.name' ? 'Factor' : (props.payload.direction ? `${props.payload.direction} Effect` : 'Value')]} labelFormatter={(label, payload) => payload && payload.length > 0 ? payload[0].payload.name : ''} />
                           <Scatter data={analysis.halfNormalData} shape="square" stroke="#000" strokeWidth={0.5}>
                             {analysis.halfNormalData.map((entry: any, index: number) => {
                                 let color = entry.significant ? (entry.direction === 'Positive' ? '#2563eb' : '#dc2626') : (entry.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                                 return <Cell key={`cell-${index}`} fill={color} />;
                             })}
                           </Scatter>
                           <ReferenceLine segment={[{x: 0, y: 0}, {x: analysis.halfNormalLine?.[1]?.x || 10, y: analysis.halfNormalLine?.[1]?.y || 10}]} stroke="#f87171" strokeWidth={2} />
                         </ScatterChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
                     )
                   )}
                 </div>
               </div>
             );
          }

          if (selectedPlot === 'effect-summary') {
            return (
              <div key={response.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    {response.name} — Effect Summary
                    <TableHelpTooltip title="Effect Summary & LogWorth">
                      <p><strong className="text-white">LogWorth:</strong> Computed as <code className="text-emerald-300">-log₁₀(p)</code>. Ranks factors by statistical influence on the response.</p>
                      <p><strong className="text-white">Threshold:</strong> Cutoff at <code className="text-emerald-300">p = 0.05</code> corresponds to LogWorth = 1.301 (marked by the hairline notch).</p>
                      <p><strong className="text-white">Dual-Tone Bar:</strong> The neutral slate base spans up to 1.301; the <span className="text-emerald-400 font-medium">emerald green surplus</span> highlights how far the factor exceeds significance.</p>
                    </TableHelpTooltip>
                  </h3>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {analysis.effectSummary?.filter((e: any) => !e.isExcluded).length || 0} Active
                  </span>
                </div>
                <div className="overflow-x-auto flex-1 rounded border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">Factor / Source</th>
                        <th className="py-1 px-2 w-40">LogWorth <span className="text-[8.5px] font-mono lowercase text-slate-400">[-log₁₀(p)]</span></th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const effSummary = analysis.effectSummary || [];
                        const maxVal = Math.max(...effSummary.map((e: any) => (!e.isExcluded && e.logworth > 0 ? e.logworth : 0)), 1.4);
                        const maxScale = Math.max(2.6, Math.ceil(maxVal * 1.2 * 10) / 10);
                        const thresholdPct = Math.min(85, Math.max(15, (1.30103 / maxScale) * 100));

                        return effSummary.map((ef: any) => {
                          const isSig = ef.logworth >= 1.30103;
                          const val = !ef.isExcluded && ef.logworth > 0 ? ef.logworth : 0;
                          const barPercent = Math.min(100, Math.max(0, (val / maxScale) * 100));

                          return (
                            <tr key={ef.id} className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${ef.isExcluded ? 'bg-slate-50/30 dark:bg-slate-800/20 text-slate-400' : ''}`}>
                              <td className="py-0.5 px-2 font-medium">
                                <span className={ef.isExcluded ? 'line-through text-slate-400 text-[9.5px]' : 'text-slate-800 dark:text-slate-200'}>
                                  {ef.name}
                                </span>
                              </td>
                              <td className="py-0.5 px-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-7 text-right font-mono text-[9.5px] text-slate-600 dark:text-slate-400">
                                    {!ef.isExcluded && ef.logworth > 0 ? ef.logworth.toFixed(3) : '—'}
                                  </span>
                                  {ef.isExcluded || val === 0 ? (
                                    <div className="flex-1 h-2 rounded-xs bg-slate-100 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center">
                                      <span className="text-[7.5px] text-slate-400 italic">excluded</span>
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex-1 h-2 rounded-xs bg-slate-100 dark:bg-slate-800 relative overflow-hidden border border-slate-200/70 dark:border-slate-700/70 flex"
                                      title={`LogWorth: ${val.toFixed(3)} | Threshold p=0.05 at ${thresholdPct.toFixed(1)}%`}
                                    >
                                      {/* Neutral base up to threshold or value */}
                                      <div 
                                        className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-150"
                                        style={{ width: `${Math.min(barPercent, thresholdPct)}%` }}
                                      />
                                      {/* Subtle threshold demarcation line */}
                                      <div 
                                        className="absolute top-0 bottom-0 w-[1px] bg-slate-400 dark:bg-slate-500 z-10 opacity-70"
                                        style={{ left: `${thresholdPct}%` }}
                                      />
                                      {/* Significant surplus extending beyond threshold in emerald green */}
                                      {isSig && (
                                        <div 
                                          className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-150"
                                          style={{ width: `${Math.max(0, barPercent - thresholdPct)}%` }}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-0.5 px-2 text-right font-mono">
                                {!ef.isExcluded && ef.pVal < 1 ? (
                                  <span className={ef.pVal <= 0.05 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}>
                                    {ef.pVal < 0.0001 ? '< 0.0001' : ef.pVal.toFixed(4)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (selectedPlot === 'parameter-estimates') {
            return (
              <div key={response.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    {response.name} — Parameter Estimates
                    <TableHelpTooltip title="Parameter Estimates">
                      <p><strong className="text-white">Estimate (β):</strong> Regression coefficient indicating response change per 1-unit coded factor step.</p>
                      <p><strong className="text-white">Std Error:</strong> Standard error measuring coefficient uncertainty.</p>
                      <p><strong className="text-white">t Ratio:</strong> Estimate divided by Std Error (tests H₀: β = 0).</p>
                      <p><strong className="text-white">p-Value:</strong> Values ≤ 0.05 (green) indicate significant deviation from zero.</p>
                      <p><strong className="text-white">R²:</strong> Proportion of variance explained by model.</p>
                    </TableHelpTooltip>
                  </h3>
                  {analysis.rSquared !== undefined && (
                    <span className="text-[9.5px] font-mono text-slate-500">
                      R²: <strong className="text-slate-800 dark:text-slate-200">{analysis.rSquared.toFixed(4)}</strong>
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto rounded border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">Model Term</th>
                        <th className="py-1 px-2 text-right">Estimate (β)</th>
                        <th className="py-1 px-2 text-right">Std Error</th>
                        <th className="py-1 px-2 text-right">t Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysis.parameterEstimates?.filter((pe: any) => !pe.isAliased).map((pe: any, idx: number) => {
                        const isSig = pe.pVal <= 0.05;
                        const isIntercept = pe.term.toLowerCase().includes('intercept');
                        return (
                          <tr key={idx} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-0.5 px-2 font-medium">
                              {isIntercept ? (
                                <span className="font-semibold text-slate-900 dark:text-slate-100">Intercept (β₀)</span>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200">{pe.term}</span>
                              )}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                              {pe.estimate !== undefined && pe.estimate !== null 
                                ? (pe.estimate >= 0 ? `+${pe.estimate.toFixed(5)}` : pe.estimate.toFixed(5)) 
                                : '—'}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                              {pe.stdError !== undefined && pe.stdError !== null ? pe.stdError.toFixed(6) : '—'}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {pe.tRatio !== undefined && pe.tRatio !== null ? pe.tRatio.toFixed(2) : '—'}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono">
                              {pe.pVal !== undefined && pe.pVal !== null ? (
                                isSig ? (
                                  <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                                    {pe.pVal < 0.0001 ? '< 0.0001' : pe.pVal.toFixed(4)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {pe.pVal.toFixed(4)}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (selectedPlot === 'effect-tests') {
            return (
              <div key={response.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    {response.name} — Effect Tests
                    <TableHelpTooltip title="Effect Tests (ANOVA)">
                      <p><strong className="text-white">Sum of Squares:</strong> Type III partial sum of squares testing the unique contribution of each effect.</p>
                      <p><strong className="text-white">F Ratio:</strong> Mean square effect divided by residual error variance.</p>
                      <p><strong className="text-white">p-Value:</strong> Values ≤ 0.05 confirm a statistically significant effect.</p>
                    </TableHelpTooltip>
                  </h3>
                  <span className="text-[9px] text-slate-500 font-mono">Type III SS</span>
                </div>
                <div className="overflow-x-auto rounded border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">Source</th>
                        <th className="py-1 px-2 text-right">Nparm</th>
                        <th className="py-1 px-2 text-right">DF</th>
                        <th className="py-1 px-2 text-right">Sum of Squares</th>
                        <th className="py-1 px-2 text-right">F Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysis.effectSummary?.filter((ef: any) => !ef.isExcluded && !ef.isAliased).map((ef: any, idx: number) => {
                        const isSig = ef.pVal <= 0.05;
                        return (
                          <tr key={idx} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-0.5 px-2 font-medium text-slate-800 dark:text-slate-200">{ef.name}</td>
                            <td className="py-0.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{ef.nparm ?? ef.df ?? 1}</td>
                            <td className="py-0.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{ef.df ?? 1}</td>
                            <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{ef.ss.toFixed(6)}</td>
                            <td className="py-0.5 px-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">{ef.fRatio.toFixed(4)}</td>
                            <td className="py-0.5 px-2 text-right font-mono">
                              {isSig ? (
                                <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                                  {ef.pVal < 0.0001 ? '< 0.0001' : ef.pVal.toFixed(4)}
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {ef.pVal.toFixed(4)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (selectedPlot === 'lack-of-fit') {
            return (
              <div key={response.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    {response.name} — Lack Of Fit
                    <TableHelpTooltip title="Lack of Fit Test">
                      <p><strong className="text-white">Purpose:</strong> Tests whether the model form adequately describes the data or if higher-order curvature/interactions are missing.</p>
                      <p><strong className="text-white">Pure Error:</strong> Experimental noise measured from replicate runs (e.g. repeated center points).</p>
                      <p><strong className="text-white">p &gt; 0.05 (Green):</strong> Adequate fit! No evidence of model misspecification.</p>
                      <p><strong className="text-white">p ≤ 0.05 (Amber):</strong> Significant lack of fit. Curvature or higher-order terms suggested.</p>
                    </TableHelpTooltip>
                  </h3>
                  {analysis.lackOfFit?.p_lof !== null && analysis.lackOfFit?.p_lof !== undefined && (
                    analysis.lackOfFit.p_lof >= 0.05 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Adequate Fit (p = {analysis.lackOfFit.p_lof.toFixed(4)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Significant LOF (p = {analysis.lackOfFit.p_lof.toFixed(4)})
                      </span>
                    )
                  )}
                </div>
                <div className="overflow-x-auto rounded border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">Error Source</th>
                        <th className="py-1 px-2 text-right">DF</th>
                        <th className="py-1 px-2 text-right">Sum of Squares</th>
                        <th className="py-1 px-2 text-right">Mean Square</th>
                        <th className="py-1 px-2 text-right">F Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-0.5 px-2 font-semibold text-slate-800 dark:text-slate-200">Lack Of Fit</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{analysis.lackOfFit?.df_lof ?? 0}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysis.lackOfFit?.ss_lof || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysis.lackOfFit?.ms_lof || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {analysis.lackOfFit?.f_lof === Infinity ? 'Inf' : (analysis.lackOfFit?.f_lof !== null && analysis.lackOfFit?.f_lof !== undefined ? analysis.lackOfFit.f_lof.toFixed(4) : '—')}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono">
                          {analysis.lackOfFit?.p_lof !== null && analysis.lackOfFit?.p_lof !== undefined ? (
                            analysis.lackOfFit.p_lof <= 0.05 ? (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70">
                                {analysis.lackOfFit.p_lof.toFixed(4)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                                {analysis.lackOfFit.p_lof.toFixed(4)}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-0.5 px-2 font-medium text-slate-700 dark:text-slate-300">Pure Error <span className="text-[9px] text-slate-400 font-normal">(Replicates)</span></td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{analysis.lackOfFit?.df_pure ?? 0}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysis.lackOfFit?.ss_pure || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysis.lackOfFit?.ms_pure || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                      </tr>
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-slate-50/30 dark:bg-slate-800/20 font-medium">
                        <td className="py-0.5 px-2 text-slate-800 dark:text-slate-200">Total Error <span className="text-[9px] text-slate-400 font-normal">(Residual)</span></td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{Math.max(0, analysis.lackOfFit?.df_error || 0)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{(analysis.lackOfFit?.sse || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">
                          {(analysis.lackOfFit?.df_error || 0) > 0 ? ((analysis.lackOfFit?.sse || 0) / (analysis.lackOfFit?.df_error || 1)).toFixed(6) : '—'}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (selectedPlot === 'main-effects') {
             return (
               <div key={response.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
                  <div className="mb-4">
                    <h3 className="text-[12px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
                      {response.name}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const allAverages = analysis.effects.flatMap((e: any) => [e.lowAvg, e.centerAvg, e.highAvg].filter((v: any) => v != null)) || [];
                      const minAvg = allAverages.length > 0 ? Math.min(...allAverages) : 0;
                      const maxAvg = allAverages.length > 0 ? Math.max(...allAverages) : 0;
                      const yRange = maxAvg - minAvg;
                      const yPadding = yRange === 0 ? 1 : yRange * 0.1;
                      const yMin = minAvg - yPadding;
                      const yMax = maxAvg + yPadding;
                      const tickRange = yMax - yMin;
                      const yTicks = [
                        yMin,
                        yMin + tickRange * 0.25,
                        yMin + tickRange * 0.5,
                        yMin + tickRange * 0.75,
                        yMax
                      ];

                      return analysis.effects.map((effect: any) => {
                        const midX = (effect.factor.min + effect.factor.max) / 2;
                        const xRange = effect.factor.max - effect.factor.min;
                        const xPadding = xRange === 0 ? 1 : xRange * 0.1;
                        const xDomain = [effect.factor.min - xPadding, effect.factor.max + xPadding];

                        return (
                          <div id={`compare-main-effect-${response.id}-${effect.factor.id}`} key={effect.factor.id} className="h-48 border border-slate-200/70 dark:border-slate-700/50 rounded bg-slate-50/60 dark:bg-slate-800/60 p-2 relative group">
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-200 truncate flex-1">{effect.factor.name}</p>
                              <button
                                data-export-hide="true"
                                onClick={() => handleDownloadSvg(`compare-main-effect-${response.id}-${effect.factor.id}`, `${project.name}_${response.name}_Main_Effect_${effect.factor.name}`)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-all"
                                title="Download PNG"
                              >
                                <Download size={12} />
                              </button>
                            </div>
                            <div className="h-[calc(100%-1.5rem)] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={[
                                  { x: effect.factor.min, value: effect.lowAvg },
                                  ...(effect.centerAvg != null ? [{ x: midX, value: effect.centerAvg }] : []),
                                  { x: effect.factor.max, value: effect.highAvg }
                                ]} margin={{ top: 15, right: 15, left: 5, bottom: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} />
                                  <XAxis type="number" dataKey="x" domain={xDomain} ticks={[effect.factor.min, midX, effect.factor.max]} {...getChartAxisProps(isDark)} tickFormatter={(val) => val.toString()} />
                                  <YAxis domain={[yMin, yMax]} ticks={yTicks} {...getChartAxisProps(isDark)} tickFormatter={(val) => val.toFixed(2)} width={45} allowDataOverflow={true} type="number" />
                                  <Tooltip {...getChartTooltipProps(isDark, { fontSize: '10px' })} labelFormatter={(val) => `${effect.factor.name}: ${val}`} />
                                  <ReferenceLine x={midX} stroke="#94a3b8" strokeDasharray="3 3" />
                                  <Line type="linear" dataKey="value" stroke="#82ca9d" strokeWidth={2.5} dot={{ r: 4.5, fill: "white", stroke: "#82ca9d", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#82ca9d" }} isAnimationActive={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
               </div>
             );
          }

          if (selectedPlot === 'interaction-plot' && interactionData) {
            return (
              <div key={response.id} id={`compare-interaction-${response.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[12px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">{response.name} - Interaction</h3>
                  <button
                    data-export-hide="true"
                    onClick={() => handleDownloadSvg(`compare-interaction-${response.id}`, `${project.name}_${response.name}_Interaction`)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Download PNG"
                  >
                    <Download size={14} />
                  </button>
                </div>
                <div className="h-64 w-full flex justify-center">
                  <div className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={interactionData.data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} />
                        <XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} {...getChartAxisProps(isDark)} tickFormatter={(val) => val.toString()} height={40} label={getAxisLabelProps(isDark, interactionData.f1.name, { position: 'insideBottom', offset: -5 })} />
                        <YAxis domain={['auto', 'auto']} {...getChartAxisProps(isDark)} tickFormatter={(val) => val.toFixed(2)} width={45} />
                        <Tooltip {...getChartTooltipProps(isDark)} labelFormatter={(val) => `${interactionData.f1.name}: ${val}`} />
                        <ReferenceLine x={(interactionData.f1.min + interactionData.f1.max) / 2} stroke="#cbd5e1" strokeDasharray="3 3" />
                        <Legend verticalAlign="top" wrapperStyle={{fontSize: '11px', paddingBottom: '15px'}} />
                        <Line type="linear" name={`${interactionData.f2.name} Low`} dataKey="low" stroke="#0d89d1" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
                        <Line type="linear" name={`${interactionData.f2.name} High`} dataKey="high" stroke="#3ab9a0" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" connectNulls={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }

          if (selectedPlot === 'doe-mean-plot') {
            return (
              <div key={response.id} id={`compare-doe-mean-${response.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[12px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">{response.name} - DOE Mean</h3>
                  <button
                    data-export-hide="true"
                    onClick={() => handleDownloadSvg(`compare-doe-mean-${response.id}`, `${project.name}_${response.name}_DOE_Mean`)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Download PNG"
                  >
                    <Download size={14} />
                  </button>
                </div>
                <div className="h-64 w-full">
                  {doeMeanData && doeMeanData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} />
                        <XAxis dataKey="run" {...getChartAxisProps(isDark, { angle: -45, textAnchor: 'end' })} />
                        <YAxis domain={['auto', 'auto']} {...getChartAxisProps(isDark)} width={65} label={getAxisLabelProps(isDark, 'Mean Response', { angle: -90, position: 'center', dx: -15 })} />
                        <Tooltip {...getChartTooltipProps(isDark)} />
                        <Line type="monotone" dataKey="value" name="Response Value" stroke="#3ab9a0" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
                  )}
                </div>
              </div>
            );
          }

          if (selectedPlot === 'contour-surface' && plotData) {
            return (
              <div key={response.id} id={`compare-surface-${response.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[12px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">{response.name} - Contour & Surface</h3>
                  <button
                    data-export-hide="true"
                    onClick={() => handleDownloadSvg(`compare-surface-${response.id}`, `${project.name}_${response.name}_Surface`)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Download PNG"
                  >
                    <Download size={14} />
                  </button>
                </div>
                <div className="h-[400px] w-full border border-slate-200/70 dark:border-slate-700/50 rounded bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-center overflow-hidden">
                  <PlotlyErrorBoundary
                    resetKey={`${plot3dType}-${plotData.xFactor.id}-${plotData.yFactor.id}-${response.id}`}
                    onResetTo2D={() => setPlot3dType('contour')}
                  >
                    <Plot
                      data={plotData.data}
                      layout={{
                        autosize: true,
                        margin: plot3dType === 'contour' ? { l: 60, r: 30, b: 60, t: 30 } : { l: 0, r: 0, b: 0, t: 0 },
                        ...(plot3dType === 'contour' ? {
                          xaxis: {
                            title: { text: plotData.xFactor.name, font: { size: 12, color: isDark ? '#ffffff' : '#1e293b' } },
                            tickfont: { size: 10, color: isDark ? '#ffffff' : '#334155' },
                            color: isDark ? '#ffffff' : '#94a3b8',
                            linecolor: isDark ? '#ffffff' : '#cbd5e1',
                            gridcolor: isDark ? '#334155' : '#e2e8f0',
                            range: [plotData.xBounds.min, plotData.xBounds.max],
                            ...(plotData.xFactor.type === 'categorical' && plotData.xFactor.levels ? {
                              tickmode: 'array',
                              tickvals: plotData.xFactor.levels.map((_: any, i: number) => i),
                              ticktext: plotData.xFactor.levels
                            } : {})
                          },
                          yaxis: {
                            title: { text: plotData.yFactor.name, font: { size: 12, color: isDark ? '#ffffff' : '#1e293b' } },
                            tickfont: { size: 10, color: isDark ? '#ffffff' : '#334155' },
                            color: isDark ? '#ffffff' : '#94a3b8',
                            linecolor: isDark ? '#ffffff' : '#cbd5e1',
                            gridcolor: isDark ? '#334155' : '#e2e8f0',
                            range: [plotData.yBounds.min, plotData.yBounds.max],
                            ...(plotData.yFactor.type === 'categorical' && plotData.yFactor.levels ? {
                              tickmode: 'array',
                              tickvals: plotData.yFactor.levels.map((_: any, i: number) => i),
                              ticktext: plotData.yFactor.levels
                            } : {})
                          }
                        } : {
                          scene: {
                            xaxis: {
                              title: { text: `${plotData.xFactor.name}${plotData.xFactor.unit ? ` (${plotData.xFactor.unit})` : ''}`, font: { color: isDark ? '#ffffff' : '#1e293b', size: 11 } },
                              tickfont: { color: isDark ? '#ffffff' : '#334155', size: 10 },
                              color: isDark ? '#ffffff' : '#64748b',
                              gridcolor: isDark ? '#334155' : '#e2e8f0',
                              zerolinecolor: isDark ? '#475569' : '#cbd5e1',
                              range: [plotData.xBounds.min, plotData.xBounds.max],
                              ...(plotData.xFactor.type === 'categorical' && plotData.xFactor.levels ? {
                                tickmode: 'array',
                                tickvals: plotData.xFactor.levels.map((_: any, i: number) => i),
                                ticktext: plotData.xFactor.levels
                              } : {})
                            },
                            yaxis: {
                              title: { text: `${plotData.yFactor.name}${plotData.yFactor.unit ? ` (${plotData.yFactor.unit})` : ''}`, font: { color: isDark ? '#ffffff' : '#1e293b', size: 11 } },
                              tickfont: { color: isDark ? '#ffffff' : '#334155', size: 10 },
                              color: isDark ? '#ffffff' : '#64748b',
                              gridcolor: isDark ? '#334155' : '#e2e8f0',
                              zerolinecolor: isDark ? '#475569' : '#cbd5e1',
                              range: [plotData.yBounds.min, plotData.yBounds.max],
                              ...(plotData.yFactor.type === 'categorical' && plotData.yFactor.levels ? {
                                tickmode: 'array',
                                tickvals: plotData.yFactor.levels.map((_: any, i: number) => i),
                                ticktext: plotData.yFactor.levels
                              } : {})
                            },
                            zaxis: {
                              title: { text: `${plotData.activeResponse?.name}${plotData.activeResponse?.unit ? ` (${plotData.activeResponse.unit})` : ''}`, font: { color: isDark ? '#ffffff' : '#1e293b', size: 11 } },
                              tickfont: { color: isDark ? '#ffffff' : '#334155', size: 10 },
                              color: isDark ? '#ffffff' : '#64748b',
                              gridcolor: isDark ? '#334155' : '#e2e8f0',
                              zerolinecolor: isDark ? '#475569' : '#cbd5e1',
                              range: [plotData.zBounds.min, plotData.zBounds.max]
                            },
                            camera: (syncCamera && cameraState) ? cameraState : undefined
                          }
                        }),
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent'
                      }}
                      onRelayout={(e: any) => {
                        if (syncCamera && e && e['scene.camera']) {
                          const cam = e['scene.camera'];
                          if (cam && typeof cam === 'object' && cam.eye && Number.isFinite(cam.eye.x) && Number.isFinite(cam.eye.y) && Number.isFinite(cam.eye.z)) {
                            setCameraState(cam);
                          }
                        }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'svg', filename: `${project.name}_${response.name}_Surface` } }}
                    />
                  </PlotlyErrorBoundary>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Global legend for effects-plot */}
      {selectedPlot === 'effects-plot' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-2 items-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
            <div className="flex gap-4 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/10"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/10"></div> Significant (Negative)</div>
            </div>
            <div className="flex gap-4 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/10"></div> Not Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/10"></div> Not Significant (Negative)</div>
            </div>
          </div>
          {effectsPlotType === 'pareto' && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mx-auto max-w-2xl w-full">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">Significance Thresholds</h5>
              <div className="flex flex-col gap-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-500 mt-1 shrink-0"></div>
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300">t-Limit (Dark Green):</strong> 
                    The standard threshold for statistical significance (usually α = 0.05). Effects extending beyond this dark green line have a meaningful impact on the response.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-500 mt-1 shrink-0"></div>
                  <div>
                    <strong className="text-slate-700 dark:text-slate-300">Bonferroni Limit (Purple):</strong> 
                    A stricter, conservative threshold that corrects for multiple testing. Effects extending beyond this purple line are highly significant.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
