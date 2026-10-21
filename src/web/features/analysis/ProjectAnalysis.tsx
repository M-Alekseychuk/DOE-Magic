import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, Factor } from '../../../core/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { Download, ChevronRight, ChevronDown, Sparkles, AlertTriangle, CheckCircle2, Info, Lightbulb, HelpCircle, FlaskConical, Table, RefreshCw, BarChart2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import createPlotlyComponent from 'react-plotly.js/factory';
import { ActualByPredictedPlot, StudentizedResidualsPlot } from '../../shared/ResidualsPlots';
import { PredictionProfiler } from './PredictionProfiler';
const Plot = createPlotlyComponent((window as any).Plotly);
// @ts-ignore
import jstat from 'jstat';
const jStat = (jstat as any).default || jstat;


interface Props {
  project: Project;
  selectedResponseId: string;
  onResponseChange: (id: string) => void;
  onUpdateProject: (project: Project) => void;
  onNavigateTab?: (tab: 'setup' | 'design' | 'analysis' | 'compare' | 'optimization' | 'robustness') => void;
}

// Normal inverse CDF approximation



import { computeAnalysis, predictModelResponse } from "../../../core/analysis/analysisCore";
import { PlotlyErrorBoundary } from "../../shared/PlotlyErrorBoundary";
import { useTranslation } from '../../i18n/LanguageContext';

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

export default function ProjectAnalysis({ project, selectedResponseId, onResponseChange, onUpdateProject, onNavigateTab }: Props) {
  const { t, locale } = useTranslation();
  const handleDownloadSvg = (containerId: string, filename: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const plotlyBtn = container.querySelector('.modebar-btn[data-title*="Download"]');
    if (plotlyBtn) {
      (plotlyBtn as HTMLElement).click();
      return;
    }

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
  const [effectsPlotType, setEffectsPlotType] = useState<'pareto' | 'half-normal'>('pareto');
  const [tableTab, setTableTab] = useState<'all' | 'summary' | 'estimates' | 'tests' | 'lof'>('all');
  const [xAxisFactorId, setXAxisFactorId] = useState<string>('');
  const [yAxisFactorId, setYAxisFactorId] = useState<string>('');
  const [interactionF1Id, setInteractionF1Id] = useState<string>('');
  const [interactionF2Id, setInteractionF2Id] = useState<string>('');
  const [plot3dType, setPlot3dType] = useState<'scatter3d' | 'mesh3d' | 'contour'>('mesh3d');
  const [showFloorProjection, setShowFloorProjection] = useState<boolean>(true);
  const [customOptConfig, setCustomOptConfig] = useState<{responseId: string, goal?: 'maximize' | 'minimize' | 'target', targetValue: string}>({ responseId: '', targetValue: '' });
  const [selectedMainEffectCatFilter, setSelectedMainEffectCatFilter] = useState<string | null>(null);

  const hasData = project.runs.length > 0 && project.responses.length > 0 && project.factors.length > 0;
  const activeResponseId = selectedResponseId || (hasData ? project.responses[0].id : '');
  const activeResponse = project.responses.find(r => r.id === activeResponseId);
  const excludedTerms = activeResponse?.excludedTerms || [];

  const effectiveGoal = customOptConfig.responseId === activeResponseId && customOptConfig.goal ? customOptConfig.goal : activeResponse?.goal;
  const effectiveTargetValue = customOptConfig.responseId === activeResponseId && customOptConfig.targetValue !== '' ? Number(customOptConfig.targetValue) : activeResponse?.targetValue;

  const validRunsCount = activeResponse 
    ? project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && String(r.responses[activeResponse.id]).trim() !== '').length
    : 0;

  const handleSimulateSampleData = () => {
    if (!activeResponse) return;
    
    const updatedRuns = project.runs.map((run, idx) => {
      let baseVal = 72.5;
      
      project.factors.forEach((f, fIdx) => {
        const factorVal = run.factors[f.id];
        if (f.type === 'categorical') {
          const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
          const lvlIdx = levels.indexOf(String(factorVal));
          const contrast = (lvlIdx === 0 ? -1 : (lvlIdx === 1 ? 1 : 0));
          baseVal += (fIdx % 2 === 0 ? 8.4 : -6.2) * contrast;
        } else {
          const mid = (f.min + f.max) / 2;
          const range = (f.max - f.min) || 1;
          const coded = (Number(factorVal) - mid) / (range / 2);
          baseVal += (fIdx % 2 === 0 ? 11.5 : -8.3) * Math.max(-2, Math.min(2, coded));
        }
      });
      
      if (project.factors.length >= 2) {
        const f1 = project.factors[0];
        const f2 = project.factors[1];
        const c1 = f1.type === 'categorical' ? (run.factors[f1.id] === (f1.levels?.[0] ?? '') ? -1 : 1) : (Number(run.factors[f1.id]) - (f1.min + f1.max) / 2) / (((f1.max - f1.min) / 2) || 1);
        const c2 = f2.type === 'categorical' ? (run.factors[f2.id] === (f2.levels?.[0] ?? '') ? -1 : 1) : (Number(run.factors[f2.id]) - (f2.min + f2.max) / 2) / (((f2.max - f2.min) / 2) || 1);
        baseVal += 4.5 * c1 * c2;
      }
      
      const pseudoNoise = ((idx * 13 + 5) % 17 - 8) * 0.4;
      let finalVal = Number((baseVal + pseudoNoise).toFixed(2));
      if (finalVal < 0) finalVal = Math.abs(finalVal);

      return {
        ...run,
        responses: {
          ...run.responses,
          [activeResponse.id]: finalVal
        }
      };
    });

    onUpdateProject({
      ...project,
      runs: updatedRuns
    });
  };

  const handleQuickResponseChange = (runId: string, val: string) => {
    if (!activeResponse) return;
    const trimmed = val.trim();
    const numVal = trimmed === '' ? null : Number(trimmed);
    const updatedRuns = project.runs.map(r => {
      if (r.id === runId) {
        return {
          ...r,
          responses: {
            ...r.responses,
            [activeResponse.id]: (trimmed === '' || isNaN(numVal as any)) ? null : numVal
          }
        };
      }
      return r;
    });
    onUpdateProject({ ...project, runs: updatedRuns });
  };

  // Compute effects and predictive model (Robust OLS Matrix Inversion with Aliasing Detection)
  const allAnalysisResults = useMemo(() => {
    if (!hasData) return [];
    try {
      return project.responses.map(resp => {
        const isAct = resp.id === activeResponseId;
        const ex = isAct ? excludedTerms : [];
        const goal = isAct && customOptConfig.goal ? customOptConfig.goal : resp.goal;
        const target = isAct && customOptConfig.targetValue !== '' ? Number(customOptConfig.targetValue) : resp.targetValue;
        return computeAnalysis(project, resp, ex, goal, target);
      }).filter(r => r !== null);
    } catch (e) {
      console.error("Error computing all analysis results:", e);
      return [];
    }
  }, [project, hasData, activeResponseId, excludedTerms, customOptConfig]);

  const analysisResults = useMemo(() => {
    if (!hasData || !activeResponse) return null;
    try {
      return computeAnalysis(project, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue);
    } catch (e) {
      console.error("Error computing analysis:", e);
      return null;
    }
  }, [project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue]);

  const interactionData = useMemo(() => {
    if (!hasData || project.factors.length < 2 || !activeResponse) return null;
    const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null);
    
    let f1 = project.factors.find(f => f.id === interactionF1Id);
    let f2 = project.factors.find(f => f.id === interactionF2Id);
    
    if (!f1 || !f2 || f1.id === f2.id) {
      const topInt = analysisResults?.effectSummary?.find((e: any) => e.name.includes('*') && !e.isExcluded && !e.isAliased);
      if (topInt) {
        const parts = topInt.name.split('*');
        const match1 = project.factors.find(f => f.name.toLowerCase() === parts[0]?.trim().toLowerCase());
        const match2 = project.factors.find(f => f.name.toLowerCase() === parts[1]?.trim().toLowerCase());
        if (match1 && match2 && match1.id !== match2.id) {
          if (!interactionF1Id) f1 = match1;
          if (!interactionF2Id) f2 = match2;
        }
      }
    }

    if (!f1) f1 = project.factors[0];
    if (!f2 || f2.id === f1.id) {
       f2 = project.factors.find(f => f.id !== f1?.id) || project.factors[1];
    }
    if (!f1 || !f2) return null;

    const colors = ['#0d89d1', '#3ab9a0', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
    const lines: { key: string; name: string; stroke: string }[] = [];

    if (f2.type === 'categorical') {
      const f2Levels = f2.levels && f2.levels.length > 0 ? f2.levels : ['Level 1', 'Level 2'];
      f2Levels.forEach((lvl, idx) => {
        lines.push({
          key: `level_${idx}`,
          name: `${f2.name} [${lvl}]`,
          stroke: colors[idx % colors.length]
        });
      });
    } else {
      lines.push(
        { key: 'low', name: `${f2.name} Low`, stroke: '#0d89d1' },
        { key: 'high', name: `${f2.name} High`, stroke: '#3ab9a0' }
      );
    }

    let data: any[] = [];
    if (f1.type === 'categorical') {
      const f1Levels = f1.levels && f1.levels.length > 0 ? f1.levels : ['Level 1', 'Level 2'];
      data = f1Levels.map(f1Lvl => {
        const point: any = { x: f1Lvl };
        if (f2.type === 'categorical') {
          const f2Levels = f2.levels && f2.levels.length > 0 ? f2.levels : ['Level 1', 'Level 2'];
          f2Levels.forEach((f2Lvl, idx) => {
            const matches = validRuns.filter(r => String(r.factors[f1.id]) === f1Lvl && String(r.factors[f2.id]) === f2Lvl);
            point[`level_${idx}`] = matches.length > 0
              ? matches.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / matches.length
              : null;
          });
        } else {
          const f2Mid = (f2.min + f2.max) / 2;
          const lowRuns = validRuns.filter(r => String(r.factors[f1.id]) === f1Lvl && Number(r.factors[f2.id]) <= f2Mid);
          const highRuns = validRuns.filter(r => String(r.factors[f1.id]) === f1Lvl && Number(r.factors[f2.id]) > f2Mid);
          point.low = lowRuns.length > 0 ? lowRuns.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / lowRuns.length : null;
          point.high = highRuns.length > 0 ? highRuns.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / highRuns.length : null;
        }
        return point;
      });
    } else {
      const f1Mid = (f1.min + f1.max) / 2;
      const xPoints = [
        { label: f1.min, isLow: (v: number) => v <= f1Mid },
        { label: f1.max, isLow: (v: number) => v > f1Mid }
      ];
      data = xPoints.map(xp => {
        const point: any = { x: xp.label };
        if (f2.type === 'categorical') {
          const f2Levels = f2.levels && f2.levels.length > 0 ? f2.levels : ['Level 1', 'Level 2'];
          f2Levels.forEach((f2Lvl, idx) => {
            const matches = validRuns.filter(r => xp.isLow(Number(r.factors[f1.id])) && String(r.factors[f2.id]) === f2Lvl);
            point[`level_${idx}`] = matches.length > 0
              ? matches.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / matches.length
              : null;
          });
        } else {
          const f2Mid = (f2.min + f2.max) / 2;
          const lowRuns = validRuns.filter(r => xp.isLow(Number(r.factors[f1.id])) && Number(r.factors[f2.id]) <= f2Mid);
          const highRuns = validRuns.filter(r => xp.isLow(Number(r.factors[f1.id])) && Number(r.factors[f2.id]) > f2Mid);
          point.low = lowRuns.length > 0 ? lowRuns.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / lowRuns.length : null;
          point.high = highRuns.length > 0 ? highRuns.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / highRuns.length : null;
        }
        return point;
      });
    }

    return {
      f1, f2,
      data,
      lines,
      isF1Categorical: f1.type === 'categorical'
    };
  }, [project, hasData, activeResponse, interactionF1Id, interactionF2Id]);

  // DOE Mean plot data
  const doeMeanData = useMemo(() => {
    if (!hasData || !activeResponse) return null;
    return project.runs
      .filter(r => r.responses[activeResponse.id] !== null)
      .map((r, i) => ({
        run: `Run ${i + 1}`,
        value: r.responses[activeResponse.id]
      }));
  }, [project, hasData, activeResponse]);

  // 3D Plot data
  const plotData = useMemo(() => {
    if (!hasData || project.factors.length < 2 || !activeResponse) return null;
    
    const xFactor = project.factors.find(f => f.id === xAxisFactorId) || project.factors[0];
    const yFactor = project.factors.find(f => f.id === yAxisFactorId && f.id !== xFactor.id) || project.factors.find(f => f.id !== xFactor.id) || project.factors[1] || project.factors[0];
    
    const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && Number.isFinite(Number(r.responses[activeResponse.id])));
    if (validRuns.length < 2) return null;

    const getFactorNumeric = (f: Factor, rawVal: any): number => {
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const idx = levels.indexOf(String(rawVal));
        return idx >= 0 ? idx : 0;
      }
      const n = Number(rawVal);
      return Number.isFinite(n) ? n : (typeof f.min === 'number' && Number.isFinite(f.min) ? f.min : 0);
    };

    const getFactorBounds = (f: Factor): { min: number; max: number } => {
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
      const zValues = validRuns.map(r => Number(r.responses[activeResponse.id]));

      let minZ = Math.min(...zValues);
      let maxZ = Math.max(...zValues);
      if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) { minZ = 0; maxZ = 1; }
      if (minZ === maxZ) { minZ -= 1; maxZ += 1; }

      return {
        xFactor, yFactor, activeResponse,
        xBounds, yBounds, zBounds: { min: minZ, max: maxZ },
        data: [{
          x: xValues,
          y: yValues,
          z: zValues,
          type: 'scatter3d',
          mode: 'markers',
          marker: { size: 8, color: zValues, colorscale: 'Viridis', opacity: 0.8 }
        }]
      };
    }

    // For surface and contour, build a surrogate model and evaluate on a grid
    const k = project.factors.length;
    const X = validRuns.map(r => project.factors.map(f => getFactorNumeric(f, r.factors[f.id])));
    const Y = validRuns.map(r => Number(r.responses[activeResponse.id]));
    
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
      let cov = 0;
      let varX = 0;
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
      if (analysisResults) {
        const settingsMap: Record<string, any> = {};
        project.factors.forEach((f, idx) => {
          settingsMap[f.id] = x_vec[idx];
          settingsMap[f.name] = x_vec[idx];
        });
        const pred = predictModelResponse(analysisResults, settingsMap, project);
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
        
        const p = predict(x_vec);
        const safeP = Number.isFinite(p) ? p : meanY;
        if (safeP < minZ) minZ = safeP;
        if (safeP > maxZ) maxZ = safeP;
        row.push(safeP);
      }
      zGrid.push(row);
    }

    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) { minZ = 0; maxZ = 1; }
    if (minZ === maxZ) { minZ -= 1; maxZ += 1; }

    const zBounds = { min: minZ, max: maxZ };

    if (plot3dType === 'mesh3d') {
      const zSpan = maxZ - minZ;
      // Add bottom padding so the surface floats cleanly above the floor plane,
      // eliminating coplanar depth fighting and polygon clipping with the projected 2D contours
      const zFloor = showFloorProjection ? minZ - (zSpan > 0 ? zSpan * 0.12 : 0.5) : minZ;
      const zCeil = maxZ + (zSpan > 0 ? zSpan * 0.04 : 0.5);
      const zBounds = { min: zFloor, max: zCeil };

      return {
        xFactor, yFactor, activeResponse,
        xBounds, yBounds, zBounds,
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
              project: { z: showFloorProjection }
            }
          }
        }]
      };
    } else if (plot3dType === 'contour') {
      return {
        xFactor, yFactor, activeResponse,
        xBounds, yBounds, zBounds,
        data: [{
          x: gridX,
          y: gridY,
          z: zGrid,
          type: 'contour',
          colorscale: 'Viridis',
        }]
      };
    }
    
    return null;
  }, [project, hasData, activeResponse, xAxisFactorId, yAxisFactorId, plot3dType, showFloorProjection, analysisResults]);

  const renderDeterministicSummary = () => {
    if (!analysisResults || !activeResponse) return null;
    
    const rSquared = analysisResults.rSquared;
    const adjRSquared = analysisResults.adjRSquared;
    const dfError = analysisResults.dfError;
    const pLof = analysisResults.lackOfFit?.p_lof;
    const studentizedResiduals = analysisResults.studentizedResiduals || [];
    const effectSummary = analysisResults.effectSummary || [];
    const parameterEstimates = analysisResults.parameterEstimates || [];
    const goal = effectiveGoal || activeResponse.goal;

    const insights = [];

    // 1. Saturated Model / Overfitting
    if (dfError === 0) {
      insights.push({
        type: 'error',
        title: locale === 'zh' ? '饱和模型 (0 误差自由度)' : 'Saturated Model (0 df Error)',
        text: locale === 'zh' 
          ? '您的模型误差自由度为 0，意味着它完全连结了每个数据点而无法估计真实方差。100% 的 R² 属于假象。建议将不显著的高阶交互项归入误差项以获取有效模型。'
          : 'Your model has 0 degrees of freedom for error, meaning it perfectly connects every point without estimating true variance. The 100% R² is an illusion. You must pool insignificant higher-order interactions into the error term to get a valid model.'
      });
    } else if (rSquared > 0.7 && (rSquared - adjRSquared) > 0.15) {
      insights.push({
        type: 'warning',
        title: locale === 'zh' ? '检测到过拟合 (Overfitting)' : 'Overfitting Detected',
        text: locale === 'zh'
          ? `R² (${(rSquared*100).toFixed(1)}%) 与调整后 R² (${(adjRSquared*100).toFixed(1)}%) 差距较大。模型中可能包含未能增加预测力却虚增 R² 的弱效应项。建议剔除 p > 0.10 的项。`
          : `There is a large gap between your R² (${(rSquared*100).toFixed(1)}%) and Adjusted R² (${(adjRSquared*100).toFixed(1)}%). Your model likely contains weak terms that artificially inflate R² without adding predictive power. Consider removing terms with p > 0.10.`
      });
    } else if (rSquared < 0.5 && dfError > 0) {
      insights.push({
        type: 'warning',
        title: locale === 'zh' ? '预测能力较低' : 'Low Predictive Power',
        text: locale === 'zh'
          ? `该模型仅解释了 ${(rSquared*100).toFixed(1)}% 的变异。可能遗漏了关键因素，或工艺本身具有较高固有随机噪声。`
          : `This model explains only ${(rSquared*100).toFixed(1)}% of the variance. It may lack important factors or the process has high inherent noise.`
      });
    }

    // 2. Lack of Fit & Curvature
    if (pLof !== undefined && pLof !== null && !isNaN(pLof)) {
      if (pLof < 0.05) {
        insights.push({
          type: 'warning',
          title: locale === 'zh' ? '失拟显著 (Significant Lack of Fit)' : 'Significant Lack of Fit',
          text: locale === 'zh'
            ? `失拟检验显著 (p = ${pLof.toFixed(4)})，表明简单的线性/交互模型不足以描述数据。如果试验包含中心点，这提示存在显著曲率。建议将设计拓展为响应面 (RSM) 模型。`
            : `The Lack of Fit is significant (p = ${pLof.toFixed(4)}), indicating a simple linear/interaction model is inadequate. If center points were used, this suggests curvature. Consider augmenting your design to a Response Surface model.`
        });
      }
    } else if (dfError > 0 && !pLof) {
      // Check for replicates
      const runs = project.runs.map(r => {
        return project.factors.map(f => r.factors[f.id]).join(',');
      });
      const uniqueRuns = new Set(runs);
      if (uniqueRuns.size === runs.length && runs.length > 0) {
        insights.push({
          type: 'info',
          title: locale === 'zh' ? '未包含重复试验' : 'No Replicates',
          text: locale === 'zh'
            ? '此设计不包含重复试验，模型误差纯粹通过合并高阶交互项估计。建议在未来试验中加入中心点以获得纯误差的真实度量。'
            : 'This design has no replicates. The model error is estimated purely by pooling higher-order interactions. Consider adding center points in future experiments to get a true measure of pure error.'
        });
      }
    }

    // 3. Outlier & Influence Identification (Studentized Residuals + Cook's Distance + Leverage)
    const nTotalRuns = analysisResults.nRuns || 1;
    const cooksCutoff = nTotalRuns > 25 ? (4 / nTotalRuns) : 1.0;
    const outliers = studentizedResiduals.filter((r: any) => Math.abs(r.studentized) > 2.5);
    const influentialRuns = studentizedResiduals.filter((r: any) => r.cooksDistance > cooksCutoff);

    if (outliers.length > 0 || influentialRuns.length > 0) {
      const outlierRuns = outliers.map((o: any) => `#${o.run} (|t|=${Math.abs(o.studentized).toFixed(2)})`).join(', ');
      const infRuns = influentialRuns.map((o: any) => `#${o.run} (D=${o.cooksDistance.toFixed(2)})`).join(', ');
      
      let textDesc = "";
      if (outliers.length > 0 && influentialRuns.length > 0) {
        textDesc = locale === 'zh'
          ? `残差异常点 (|t| > 2.5): 运行 ${outlierRuns}。强影响试验 (Cook 距离 D > ${cooksCutoff.toFixed(2)}): 运行 ${infRuns}。这些试验对模型系数具有不成比例的强影响，请核实试验条件或原始测量记录。`
          : `Outlier residuals (|t| > 2.5): Run(s) ${outlierRuns}. Influential points (Cook's D > ${cooksCutoff.toFixed(2)}): Run(s) ${infRuns}. These runs exert disproportionate pull on model coefficients; verify experimental conditions or raw measurements.`;
      } else if (outliers.length > 0) {
        textDesc = locale === 'zh'
          ? `运行 ${outlierRuns} 具有异常偏高的学生化残差 (|t| > 2.5)。请核查这些试验的实验记录本或数据录入。`
          : `Run(s) ${outlierRuns} have unusually high studentized residuals (|t| > 2.5). Please verify lab notes or data entry for these runs.`;
      } else {
        textDesc = locale === 'zh'
          ? `运行 ${infRuns} 具有较高的库克距离 (D > ${cooksCutoff.toFixed(2)})，表明它们对回归系数具有不成比例的强影响。`
          : `Run(s) ${infRuns} have high Cook's Distance (D > ${cooksCutoff.toFixed(2)}), indicating they exert disproportionate influence on regression coefficients.`;
      }

      insights.push({
        type: outliers.length > 0 ? 'error' : 'warning',
        title: locale === 'zh'
          ? (outliers.length > 0 ? '异常点与强影响试验' : '强影响点 (库克距离 Cook’s Distance)')
          : (outliers.length > 0 ? 'Outliers & Influential Points' : 'Influential Points (Cook’s Distance)'),
        text: textDesc
      });
    }

    // 4. Signal-to-Noise Ratio (Adequate Precision)
    const adeqPrec = analysisResults.adequatePrecision;
    if (adeqPrec !== undefined && adeqPrec !== null && !isNaN(adeqPrec) && dfError > 0) {
      if (adeqPrec >= 4.0) {
        insights.push({
          type: 'success',
          title: locale === 'zh' ? `信噪比 / 精度充足: ${adeqPrec.toFixed(2)}` : `Adequate Precision: ${adeqPrec.toFixed(2)}`,
          text: locale === 'zh'
            ? `信噪比 (Adequate Precision) 为 ${adeqPrec.toFixed(2)} (远超 4.0 临界值)。模型具有充分的信号辨别力，可可靠用于设计空间探索与最优值预测。`
            : `The signal-to-noise ratio is ${adeqPrec.toFixed(2)} (comfortably above the 4.0 threshold). The model has sufficient signal discrimination to navigate the design space and predict response optima.`
        });
      } else {
        insights.push({
          type: 'warning',
          title: locale === 'zh' ? `信噪比偏低: ${adeqPrec.toFixed(2)} (< 4.0)` : `Low Adequate Precision: ${adeqPrec.toFixed(2)} (< 4.0)`,
          text: locale === 'zh'
            ? `信噪比为 ${adeqPrec.toFixed(2)} (低于理想基准 4.0)。与模型效应跨度相比，背景实验变异较大。`
            : `The signal-to-noise ratio is ${adeqPrec.toFixed(2)} (below the desirable 4.0 benchmark). Background experimental variation is relatively large compared to model effect spans.`
        });
      }
    }

    // 5. Multicollinearity & Variance Inflation Factors (VIF)
    const activeTermsWithVif = parameterEstimates.filter((p: any) => !p.isAliased && p.cleanTerm !== 'Intercept' && p.vif !== undefined);
    const severeVifs = activeTermsWithVif.filter((p: any) => p.vif > 10);
    const moderateVifs = activeTermsWithVif.filter((p: any) => p.vif > 5 && p.vif <= 10);

    if (severeVifs.length > 0) {
      const termList = severeVifs.map((p: any) => `${p.cleanTerm} (VIF = ${p.vif.toFixed(1)})`).join(', ');
      insights.push({
        type: 'warning',
        title: locale === 'zh' ? '严重多重共线性 (VIF > 10)' : 'Severe Multicollinearity (VIF > 10)',
        text: locale === 'zh'
          ? `在以下项中检测到高方差膨胀: ${termList}。共线性会放大参数标准误并不稳定系数，建议剔除相关项。`
          : `High variance inflation detected in: ${termList}. Collinearity inflates parameter standard errors and destabilizes coefficients. Consider removing correlated terms.`
      });
    } else if (moderateVifs.length > 0) {
      const termList = moderateVifs.map((p: any) => `${p.cleanTerm} (VIF = ${p.vif.toFixed(1)})`).join(', ');
      insights.push({
        type: 'info',
        title: locale === 'zh' ? '中度多重共线性 (VIF > 5)' : 'Moderate Multicollinearity (VIF > 5)',
        text: locale === 'zh'
          ? `中度方差膨胀: ${termList}。标准误存在中等相关性，解释系数时应结合相关矩阵。`
          : `Moderate variance inflation in: ${termList}. Standard errors are moderately correlated; interpret coefficients in conjunction with the correlation structure.`
      });
    } else if (activeTermsWithVif.length > 1 && activeTermsWithVif.every((p: any) => Math.abs(p.vif - 1.0) < 0.05)) {
      insights.push({
        type: 'success',
        title: locale === 'zh' ? '理想正交设计 (VIF = 1.0)' : 'Ideal Orthogonality (VIF = 1.0)',
        text: locale === 'zh'
          ? '所有有效模型项的 VIF 均为 1.00。该设计完全正交，自变量效应之间零方差膨胀。'
          : 'All active model terms have VIF = 1.00. The design is perfectly orthogonal with zero variance inflation between predictor effects.'
      });
    }

    // 6. Directional Guidance / Strongest Drivers
    const significantEffects = effectSummary.filter((ef: any) => !ef.isExcluded && ef.pVal <= 0.05 && !ef.isAliased);
    if (significantEffects.length > 0) {
      const sortedEffects = [...significantEffects].sort((a, b) => Math.abs(b.tRatio) - Math.abs(a.tRatio));
      
      const mainEffects = sortedEffects.filter(ef => !ef.name.includes('*'));
      const intEffects = sortedEffects.filter(ef => ef.name.includes('*'));
      
      if (mainEffects.length > 0) {
        insights.push({
          type: 'success',
          title: locale === 'zh' 
            ? (mainEffects.length > 1 ? '核心驱动因素识别' : '核心驱动因素识别') 
            : (mainEffects.length > 1 ? 'Key Drivers Identified' : 'Key Driver Identified'),
          text: (
            <div className="space-y-1.5">
              <p>{locale === 'zh' ? '为优化此响应变量，建议采取以下主要因素调整策略:' : 'To optimize the response, consider the following main factor adjustments:'}</p>
              <ul className="list-disc pl-4 space-y-1">
                {mainEffects.map(effect => {
                  const f = project.factors.find(fact => fact.id === effect.id || fact.name === effect.name || effect.name.startsWith(fact.name));
                  const cleanName = effect.name.split('(')[0];

                  if (f && f.type === 'categorical') {
                    const catEffect = analysisResults.effects.find((e: any) => e.factor?.id === f.id);
                    if (catEffect?.levelAverages && catEffect.levelAverages.length > 0) {
                      const validLvls = [...catEffect.levelAverages].filter((la: any) => la.avg !== null && Number.isFinite(la.avg));
                      if (validLvls.length > 0) {
                        validLvls.sort((a, b) => b.avg - a.avg);
                        const bestLvl = goal === 'minimize' ? validLvls[validLvls.length - 1] : validLvls[0];
                        const worstLvl = goal === 'minimize' ? validLvls[0] : validLvls[validLvls.length - 1];
                        return (
                          <li key={effect.name}>
                            <strong>{cleanName} {locale === 'zh' ? '(分类变量)' : '(Categorical)'}</strong>: {locale === 'zh' ? `水平 "${bestLvl.level}" 获得最优平均响应 (${bestLvl.avg.toFixed(2)} 对比 ${worstLvl.level}: ${worstLvl.avg.toFixed(2)})。` : `Level "${bestLvl.level}" yields the best average response (${bestLvl.avg.toFixed(2)} vs ${worstLvl.level}: ${worstLvl.avg.toFixed(2)}).`}
                            <span className="ml-1 text-emerald-700 dark:text-emerald-400 font-medium">{locale === 'zh' ? `建议: 设为 ${bestLvl.level}` : `Action: Set to ${bestLvl.level}`}</span>
                          </li>
                        );
                      }
                    }
                  }

                  const paramEstimate = parameterEstimates.find((p: any) => p.term === effect.name || p.cleanTerm === cleanName);
                  if (!paramEstimate) return null;
                  
                  const increases = paramEstimate.estimate > 0;
                  
                  let actionText = "";
                  if (goal === 'maximize') actionText = increases ? "Increase" : "Decrease";
                  else if (goal === 'minimize') actionText = increases ? "Decrease" : "Increase";
                  
                  return (
                    <li key={effect.name}>
                      <strong>{cleanName}</strong>: {locale === 'zh' ? `增大该因素水平将${increases ? '提升' : '降低'}响应值。` : `Increasing this factor ${increases ? 'increases' : 'decreases'} the response.`}
                      {actionText && (
                        <span className="ml-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          {locale === 'zh' ? `建议: ${actionText === 'Increase' ? '调高' : '调低'}` : `Action: ${actionText}`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        });
      }
      
      if (intEffects.length > 0) {
        const topInt = intEffects[0];
        const hasCategorical = project.factors.some(f => f.type === 'categorical' && topInt.name.includes(f.name));
        insights.push({
          type: 'success',
          title: locale === 'zh'
            ? (hasCategorical ? '检测到分类变量交互作用' : '存在显著交互作用')
            : (hasCategorical ? 'Categorical Interaction Detected' : 'Strong Interaction Present'),
          text: locale === 'zh'
            ? `检测到显著二阶交互作用 (${topInt.name}, p = ${topInt.pVal.toFixed(4)})。${
                hasCategorical
                  ? '由于涉及分类变量，最优工艺设定取决于所选的离散类别。请查阅交互作用图选择最佳组合。'
                  : '单一因素的影响取决于另一因素的设定值。请查看交互作用图确定最优组合。'
              }`
            : `A significant interaction (${topInt.name}) is present (p = ${topInt.pVal.toFixed(4)}). ${
                hasCategorical
                  ? `Because this interaction involves a categorical factor, the optimal factor setting depends on which discrete level is selected. Check the Interaction Plot to choose the best combination.`
                  : `The effect of one factor depends on the setting of the other. View the Interaction Plot to find the optimal combination.`
              }`
        });
      }
    } else {
      if (dfError > 0) {
        insights.push({
          type: 'info',
          title: locale === 'zh' ? '未发现显著因素' : 'No Significant Factors',
          text: locale === 'zh'
            ? '在 0.05 显著性水平下未发现个别因素或交互项具有统计显著性。当前考察的因素可能对响应没有实质性影响。'
            : 'No individual factors or interactions were found to be statistically significant at the 0.05 level. The current factors may not meaningfully impact the response.'
        });
      }
    }
    
    // 5. Hierarchical Integrity Checks
    const activeTerms = effectSummary.filter((ef: any) => !ef.isExcluded).map((ef: any) => ef.name.replace(' (Aliased)', ''));
    const interactionTerms = activeTerms.filter((t: string) => t.includes('*'));
    let hierarchyViolations: string[] = [];
    
    interactionTerms.forEach((intTerm: string) => {
      const parts = intTerm.split('*');
      parts.forEach((part: string) => {
        const mainEffectExists = activeTerms.some((t: string) => t === part || t.startsWith(`${part}(`));
        if (!mainEffectExists) {
           hierarchyViolations.push(`${intTerm} is active but main effect ${part} is excluded`);
        }
      });
    });
    
    if (hierarchyViolations.length > 0) {
       insights.push({
         type: 'warning',
         title: locale === 'zh' ? '违反模型层阶性准则' : 'Hierarchy Violation',
         text: locale === 'zh'
           ? `模型层阶性不完整: ${hierarchyViolations[0]}。通常若模型中保留了交互项，其对应的父项主效应也应保留在模型中。`
           : `Model hierarchy is broken: ${hierarchyViolations[0]}. Generally, if an interaction is kept in the model, its parent main effects should also be included.`
       });
    }

    // 7. Numerical Box-Cox Transformation Analysis
    const boxCox = analysisResults.boxCox;
    if (boxCox && dfError > 1) {
      if (!boxCox.isOneInCi) {
        insights.push({
          type: 'info',
          title: locale === 'zh' ? `Box-Cox 变换建议: ${boxCox.recommendedTransform}` : `Box-Cox Recommendation: ${boxCox.recommendedTransform}`,
          text: locale === 'zh'
            ? `Box-Cox 对数似然轮廓估计最优 λ = ${boxCox.optimalLambda.toFixed(1)} (95% 置信区间: [${boxCox.ciLow.toFixed(1)}, ${boxCox.ciHigh.toFixed(1)}])。由于 λ = 1.0 (无变换) 落在该区间之外，从统计学上建议应用 ${boxCox.recommendedTransform} 变换以稳定残差方差。`
            : `Numerical Box-Cox profile log-likelihood estimates optimal λ = ${boxCox.optimalLambda.toFixed(1)} (95% CI: [${boxCox.ciLow.toFixed(1)}, ${boxCox.ciHigh.toFixed(1)}]). Because λ = 1.0 (no transform) falls outside this range, applying a ${boxCox.recommendedTransform} transformation is mathematically recommended to stabilize residual variance.`
        });
      } else {
        insights.push({
          type: 'success',
          title: locale === 'zh' ? '最优响应尺度 (Box-Cox)' : 'Optimal Response Scale (Box-Cox)',
          text: locale === 'zh'
            ? `Box-Cox 对数似然轮廓估计最优 λ = ${boxCox.optimalLambda.toFixed(1)} (95% 置信区间: [${boxCox.ciLow.toFixed(1)}, ${boxCox.ciHigh.toFixed(1)}])。当前尺度 (λ = 1.0) 位于 95% 置信区间内；无需进行幂变换。`
            : `Box-Cox profile log-likelihood estimates optimal λ = ${boxCox.optimalLambda.toFixed(1)} (95% CI: [${boxCox.ciLow.toFixed(1)}, ${boxCox.ciHigh.toFixed(1)}]). The current scale (λ = 1.0) is within the 95% confidence interval; no power transformation is required.`
        });
      }
    } else {
      const activeTermsCount = effectSummary.filter((ef: any) => !ef.isExcluded).length;
      const significantCount = effectSummary.filter((ef: any) => !ef.isExcluded && ef.pVal <= 0.05).length;
      if (activeTermsCount >= 5 && (significantCount / activeTermsCount) > 0.6) {
        insights.push({
          type: 'info',
          title: locale === 'zh' ? '效应密集 (效应稀疏性检查)' : 'Dense Effect Profile (Sparsity Check)',
          text: locale === 'zh'
            ? `${activeTermsCount} 个有效项中有 ${significantCount} 个显著效应。依据效应稀疏性原理，可考虑应用 Box-Cox 变换以精简模型。`
            : `You have ${significantCount} significant effects out of ${activeTermsCount} active terms. By the Sparsity of Effects principle, consider applying a Box-Cox transformation to simplify the model.`
        });
      }
    }

    // 8. Aliased Terms Warning
    const activeAliased = effectSummary.filter((ef: any) => !ef.isExcluded && ef.isAliased);
    if (activeAliased.length > 0) {
       insights.push({
         type: 'warning',
         title: locale === 'zh' ? '混杂 (别名) 效应' : 'Confounded (Aliased) Effects',
         text: locale === 'zh'
           ? `您的模型包含 ${activeAliased.length} 个活动的混杂别名项 (如 ${activeAliased[0].name.replace(' (Aliased)', '')})。此设计在数学上无法区分该效应与其别名。请依据领域专业知识判断，或安排补充增广试验。`
           : `Your model includes ${activeAliased.length} active aliased term(s) (e.g., ${activeAliased[0].name.replace(' (Aliased)', '')}). This design mathematically cannot distinguish between this effect and its alias. Rely on subject-matter expertise to decide which effect is real, or run augmenting experiments.`
       });
    }

    // 9. Categorical Factor Insights & Design Balance
    const categoricalFactors = project.factors.filter(f => f.type === 'categorical');
    if (categoricalFactors.length > 0) {
      const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && !isNaN(Number(r.responses[activeResponse.id])));

      categoricalFactors.forEach(cf => {
        const levels = cf.levels && cf.levels.length > 0 ? cf.levels : ['Level 1', 'Level 2'];
        const effTests = (analysisResults as any).effectTests || [];
        const effTest = effTests.find((et: any) => et.source === cf.name || et.source.startsWith(cf.name)) || effectSummary.find((es: any) => es.name === cf.name || es.name.startsWith(cf.name));
        const catEff = (analysisResults.effects || []).find((e: any) => e.factor?.id === cf.id);
        
        // Run distribution per level
        const levelCounts = levels.map(lvl => ({
          level: lvl,
          count: validRuns.filter(r => String(r.factors[cf.id] ?? '').trim().toLowerCase() === String(lvl).trim().toLowerCase()).length
        }));
        const minCount = Math.min(...levelCounts.map(lc => lc.count));
        const maxCount = Math.max(...levelCounts.map(lc => lc.count));
        const isBalanced = minCount === maxCount && minCount > 0;

        if (minCount === 0) {
          insights.push({
            type: 'error',
            title: locale === 'zh' ? `未观测水平: ${cf.name}` : `Unobserved Level: ${cf.name}`,
            text: locale === 'zh'
              ? `因素 ${cf.name} 包含 0 次完成运行的水平 (${levelCounts.map(lc => `${lc.level}: ${lc.count}`).join(', ')})。无法估计未观测水平的对比。`
              : `Factor ${cf.name} contains one or more levels with 0 completed experimental runs (${levelCounts.map(lc => `${lc.level}: ${lc.count}`).join(', ')}). Contrasts for unobserved levels cannot be estimated.`
          });
        } else if (!isBalanced) {
          insights.push({
            type: 'info',
            title: locale === 'zh' ? `因素水平不均衡: ${cf.name}` : `Unbalanced Factor: ${cf.name}`,
            text: locale === 'zh'
              ? `因素 ${cf.name} 在各水平间的试验样本数不相等 (${levelCounts.map(lc => `${lc.level}: ${lc.count} 次`).join(', ')})。虽然仍可有效估计，但非平衡设计会降低样本较少水平对比的统计精度。`
              : `Factor ${cf.name} has unequal sample sizes across its levels (${levelCounts.map(lc => `${lc.level}: ${lc.count} runs`).join(', ')}). While validly estimable, unbalanced designs reduce statistical precision for under-sampled contrasts.`
          });
        } else {
          insights.push({
            type: 'success',
            title: locale === 'zh' ? `均衡因素: ${cf.name}` : `Balanced Factor: ${cf.name}`,
            text: locale === 'zh'
              ? `因素 ${cf.name} 的全部 ${levels.length} 个水平具有均匀重复数 (${minCount} 次运行/水平)，确保了正交对比和最大检验效率。`
              : `All ${levels.length} levels of ${cf.name} are evenly replicated (${minCount} runs/level), ensuring orthogonal contrasts and maximal test efficiency.`
          });
        }

        // Statistical impact across discrete levels
        if (effTest) {
          if (effTest.pVal <= 0.05) {
            const avgValues = catEff?.levelAverages ? catEff.levelAverages.filter((la: any) => la.avg !== null && Number.isFinite(la.avg)) : [];
            const spanText = avgValues.length >= 2 
              ? (locale === 'zh' 
                  ? ` 各水平间，平均 ${activeResponse.name} 介于 ${Math.min(...avgValues.map((la: any) => la.avg)).toFixed(2)} 至 ${Math.max(...avgValues.map((la: any) => la.avg)).toFixed(2)}。`
                  : ` Across levels, average ${activeResponse.name} ranges from ${Math.min(...avgValues.map((la: any) => la.avg)).toFixed(2)} to ${Math.max(...avgValues.map((la: any) => la.avg)).toFixed(2)}.`)
              : '';
            insights.push({
              type: 'success',
              title: locale === 'zh' ? `显著因素: ${cf.name}` : `Significant Factor: ${cf.name}`,
              text: locale === 'zh'
                ? `因素 ${cf.name} 具有统计显著的总体效应 (F = ${effTest.fRatio?.toFixed(2)}, p = ${effTest.pVal.toFixed(4)})。${spanText} 离散因素选择是工艺表现的关键决定项。`
                : `Factor ${cf.name} has a statistically significant overall effect (F = ${effTest.fRatio?.toFixed(2)}, p = ${effTest.pVal.toFixed(4)}).${spanText} Discrete factor choice is a primary determinant of performance.`
            });
          } else {
            insights.push({
              type: 'info',
              title: locale === 'zh' ? `水平等效: ${cf.name}` : `Equivalent Levels: ${cf.name}`,
              text: locale === 'zh'
                ? `因素 ${cf.name} 各水平间无统计显著差异 (F = ${effTest.fRatio?.toFixed(2)}, p = ${effTest.pVal.toFixed(4)} > 0.05)。您可灵活选择更经济或易操作的方案 (${levels.join(' 对比 ')})，而不会牺牲 ${activeResponse.name}。`
                : `Factor ${cf.name} shows no statistically significant performance difference between its levels (F = ${effTest.fRatio?.toFixed(2)}, p = ${effTest.pVal.toFixed(4)} > 0.05). You have flexibility to select the most practical or cost-effective option (${levels.join(' vs ')}) without sacrificing ${activeResponse.name}.`
            });
          }
        }
      });

      // Total Degrees of Freedom Check for Categorical Factors
      const totalCatDf = categoricalFactors.reduce((acc, f) => acc + ((f.levels?.length || 2) - 1), 0);
      if (dfError > 0 && dfError < 4) {
        insights.push({
          type: 'warning',
          title: locale === 'zh' ? `残差自由度偏低 (df = ${dfError})` : `Low Error Degrees of Freedom (df = ${dfError})`,
          text: locale === 'zh'
            ? `模型仅剩余 ${dfError} 个残差误差自由度。分类变量共消耗 ${totalCatDf} 个自由度 (${categoricalFactors.map(f => `${f.name}: ${(f.levels?.length || 2) - 1} DF`).join(', ')})。建议补充试验或合并非显著交互项以增强检验效能。`
            : `The model has only ${dfError} residual error degree(s) of freedom remaining. Categorical factors consume ${totalCatDf} DF total (${categoricalFactors.map(f => `${f.name}: ${(f.levels?.length || 2) - 1} DF`).join(', ')}). Consider augmenting with additional runs or pooling inactive interaction terms to improve test power.`
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
         type: 'success',
         title: locale === 'zh' ? '模型状态良好' : 'Model looks healthy',
         text: locale === 'zh'
           ? `模型解释了 ${(rSquared*100).toFixed(1)}% 的变异，未发现异常点、饱和度或大失拟等警告信号。`
           : `The model explains ${(rSquared*100).toFixed(1)}% of the variance with no major warning signs (outliers, saturation, or large lack of fit).`
      });
    }

    return (
      <details className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg group" open>
        <summary className="p-4 cursor-pointer list-none flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors rounded-lg group-open:rounded-b-none">
          <h4 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 flex items-center gap-1.5 m-0">
            <Lightbulb className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            {locale === 'zh' ? '诊断分析与工程洞察 (Diagnostics & Insights)' : 'Diagnostics & Insights'}
          </h4>
          <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, idx) => {
            let Icon = Info;
            let colors = "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300";
            let iconColor = "text-blue-600 dark:text-blue-600 dark:text-blue-400";
            
            if (insight.type === 'warning') {
              Icon = AlertTriangle;
              colors = "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300";
              iconColor = "text-amber-600 dark:text-amber-500";
            } else if (insight.type === 'error') {
              Icon = AlertTriangle;
              colors = "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-300";
              iconColor = "text-red-600 dark:text-red-500";
            } else if (insight.type === 'success') {
              Icon = CheckCircle2;
              colors = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300";
              iconColor = "text-emerald-600 dark:text-emerald-500";
            }

            return (
              <div key={idx} className={`p-3 rounded-md border ${colors} flex flex-col gap-1.5`}>
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  <h5 className="text-[11px] font-bold uppercase tracking-wide">{insight.title}</h5>
                </div>
                <div className="text-[11.5px] leading-relaxed opacity-90">
                  {insight.text}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    );
  };

  if (!hasData) {
    return (
      <div className="p-8 text-center text-[11px] text-slate-500 dark:text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
        {locale === 'zh' ? '数据不足，无法开展统计分析。请先添加因素、响应变量并填报试验运行结果。' : 'Insufficient data for analysis. Please add factors, responses, and run results.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analysis Controls */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-wrap items-center gap-6">
        {project.responses.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 dark:text-slate-300 uppercase tracking-widest">
              {locale === 'zh' ? '分析响应变量:' : 'Analyze Response:'}
            </span>
            <select 
              value={activeResponseId} 
              onChange={e => onResponseChange(e.target.value)}
              className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {project.responses.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.goal === 'maximize' ? (locale === 'zh' ? '最大化' : 'maximize') : r.goal === 'minimize' ? (locale === 'zh' ? '最小化' : 'minimize') : (locale === 'zh' ? '目标值' : 'target')})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500 dark:text-slate-300 uppercase tracking-wider">
            {locale === 'zh' ? '评估效应阶数:' : 'Effects Evaluated:'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-500 dark:text-slate-300 font-medium text-[11px] border border-slate-200 dark:border-slate-700">
            {locale === 'zh' ? '全部效应 (主效应 + 二阶交互)' : 'All (Primary + Secondary)'}
          </span>
        </div>
      </div>

      {!analysisResults ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 mt-0.5">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {locale === 'zh' ? '暂未录入测量数据' : 'No Measurements Recorded Yet'}
                  {activeResponse && (
                    <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                      {locale === 'zh' ? `(响应: ${activeResponse.name})` : `for ${activeResponse.name}`}
                    </span>
                  )}
                  <span className="text-[10px] font-normal px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-mono">
                    {locale === 'zh'
                      ? `已测 ${validRunsCount} / 共 ${project.runs.length} 运行`
                      : `${validRunsCount} of ${project.runs.length} runs measured`}
                  </span>
                </h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {locale === 'zh'
                    ? `您的试验设计矩阵当前包含 ${project.runs.length} 次运行。统计回归建模、方差分析 (ANOVA)、帕累托效应图以及响应面优化均需要试验响应测量数据。`
                    : `Your design matrix currently contains ${project.runs.length} experimental runs. Statistical regression, ANOVA decomposition, Pareto effect plots, and response surface optimization require experimental response measurements.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
              <button
                type="button"
                onClick={handleSimulateSampleData}
                className="px-3.5 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded font-medium text-[11px] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title={locale === 'zh' ? '根据试验因子生成逼真的模拟测量值' : 'Populate runs with realistic simulation values based on experimental factors'}
              >
                <Sparkles size={14} />
                {locale === 'zh' ? '模拟生成样本数据' : 'Simulate Sample Data'}
              </button>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('design')}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Table size={14} />
                  {locale === 'zh' ? '前往设计矩阵' : 'Go to Design Matrix'}
                </button>
              )}
            </div>
          </div>

          {/* Quick Response Entry Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {locale === 'zh' 
                  ? `快速测量录入 (${activeResponse?.name} ${activeResponse?.unit ? `[${activeResponse.unit}]` : ''})`
                  : `Quick Measurement Entry (${activeResponse?.name} ${activeResponse?.unit ? `[${activeResponse.unit}]` : ''})`}
              </span>
              <span className="text-[10px] text-slate-400">
                {locale === 'zh'
                  ? '直接在下方表格中输入数值，或点击上方“模拟生成样本数据”'
                  : 'Type measurement values directly below or click "Simulate Sample Data"'}
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3 text-center w-12">{locale === 'zh' ? '运行' : 'Run'}</th>
                    <th className="py-2 px-3 text-center w-12">{locale === 'zh' ? '标准序' : 'Std'}</th>
                    {project.factors.map(f => (
                      <th key={f.id} className="py-2 px-3 text-center">{f.name}</th>
                    ))}
                    <th className="py-2 px-3 text-center bg-brand-50/60 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-bold">
                      {activeResponse?.name} ({activeResponse?.unit || activeResponse?.goal})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {project.runs.slice(0, 16).map(run => {
                    const currentVal = run.responses[activeResponse?.id || ''];
                    return (
                      <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-center text-slate-500">{run.runOrder}</td>
                        <td className="py-1.5 px-3 text-center text-slate-400">{run.stdOrder}</td>
                        {project.factors.map(f => (
                          <td key={f.id} className="py-1.5 px-3 text-center text-slate-700 dark:text-slate-300">
                            {f.type === 'categorical' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {String(run.factors[f.id] ?? '')}
                              </span>
                            ) : (
                              Number(run.factors[f.id])
                            )}
                          </td>
                        ))}
                        <td className="py-1.5 px-3 text-center bg-brand-50/30 dark:bg-brand-950/10">
                          <input
                            type="number"
                            step="any"
                            placeholder={locale === 'zh' ? '输入数值' : 'Enter value'}
                            value={currentVal !== null && currentVal !== undefined ? currentVal : ''}
                            onChange={e => handleQuickResponseChange(run.id, e.target.value)}
                            className="w-28 text-center px-2 py-1 text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {project.runs.length > 16 && (
                <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  {locale === 'zh'
                    ? `显示前 16 次运行 (共 ${project.runs.length} 次)。如需完整编辑，请切换至“设计矩阵”标签页。`
                    : `Showing first 16 runs of ${project.runs.length}. Switch to the Design Matrix tab for complete editing.`}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {renderDeterministicSummary()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Effects Plot (Merged Pareto & Half-Normal) */}
        <div id="effects-plot" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400">
                  {locale === 'zh' ? '效应图 (Effects Plot)' : 'Effects Plot'} <span className="normal-case font-normal">({activeResponse?.name})</span>
                </h3>
                <select 
                  value={effectsPlotType}
                  onChange={e => setEffectsPlotType(e.target.value as 'pareto' | 'half-normal')}
                  className="rounded border border-slate-300 dark:border-slate-600 px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="pareto">{locale === 'zh' ? 'Pareto 图: 标准化效应' : 'Pareto: Standardized'}</option>
                  <option value="half-normal">{locale === 'zh' ? '半正态概率图 (Half-Normal)' : 'Half-Normal'}</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500">
                {effectsPlotType === 'pareto' 
                  ? (locale === 'zh' ? '展示各效应的绝对大小。条形越长表示对响应的影响越显著。' : 'Shows the absolute size of each effect. Bars extending further indicate a stronger impact on the response.')
                  : (locale === 'zh' ? '辅助识别显著效应。偏离对角参考线最远的点代表具有显著实际影响的因素。' : 'Helps identify significant effects. Points that deviate furthest from the line represent factors with a meaningful impact.')}
              </p>
            </div>
            <button
              data-export-hide="true"
              onClick={() => handleDownloadSvg('effects-plot', `${project.name}_${effectsPlotType}_Plot`)}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Download PNG"
            >
              <Download size={14} />
            </button>
          </div>
          
          <div className="h-64 w-full relative">
            {effectsPlotType === 'pareto' ? (
              analysisResults?.paretoData && analysisResults.paretoData.length > 0 ? (() => {
                const paretoMax = Math.max(
                  ...(analysisResults.paretoData || []).map((d: any) => d.tRatio || 0),
                  analysisResults.tLimitPareto || 0,
                  analysisResults.bonferroniLimitPareto || 0
                );
                const paretoDomain = [0, Number.isFinite(paretoMax) && paretoMax > 0 ? Math.ceil(paretoMax * 1.18 * 10) / 10 : 5];

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysisResults.paretoData} layout="vertical" margin={{ top: 35, right: 35, left: 40, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" dataKey="tRatio" name="t-Ratio" domain={paretoDomain} tick={{fontSize: 10}} />
                      <YAxis type="category" dataKey="factor.name" width={100} interval={0} tick={{fontSize: 10}} />
                      <ReferenceLine 
                        x={analysisResults.tLimitPareto} 
                        stroke="#16a34a" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                        label={{ 
                          position: 'top', 
                          value: locale === 'zh' ? `t 显著性限 (${analysisResults.tLimitPareto?.toFixed(2)})` : `t-Limit (${analysisResults.tLimitPareto?.toFixed(2)})`, 
                          fill: '#16a34a', 
                          fontSize: 10, 
                          fontWeight: 600, 
                          dy: -6 
                        }} 
                      />
                      <ReferenceLine 
                        x={analysisResults.bonferroniLimitPareto} 
                        stroke="#9333ea" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                        label={{ 
                          position: 'top', 
                          value: locale === 'zh' ? `Bonferroni 阈值 (${analysisResults.bonferroniLimitPareto?.toFixed(2)})` : `Bonferroni (${analysisResults.bonferroniLimitPareto?.toFixed(2)})`, 
                          fill: '#9333ea', 
                          fontSize: 10, 
                          fontWeight: 600, 
                          dy: -20 
                        }} 
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }} 
                        contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                        formatter={(value: number, name: string, props: any) => [
                          `${value.toFixed(3)} (${props.payload.direction === 'Positive' ? (locale === 'zh' ? '正向' : 'Positive') : (locale === 'zh' ? '负向' : 'Negative')})`, 
                          locale === 'zh' ? '效应大小' : 'Effect Size'
                        ]}
                      />
                      <Bar dataKey="tRatio" name="t-Ratio" radius={[0, 4, 4, 0]}>
                        {analysisResults.paretoData.map((entry: any, index: number) => {
                            const isSig = entry.tRatio > analysisResults.tLimitPareto;
                            let color = isSig ? (entry.direction === 'Positive' ? '#2563eb' : '#dc2626') : (entry.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                            return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                  {locale === 'zh' ? '暂无可用的试验数据' : 'No valid run data available.'}
                </div>
              )
            ) : (
              analysisResults?.halfNormalData && analysisResults.halfNormalData.length > 0 ? (
                <>
                
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      dataKey="tRatio" 
                      name="|Standardized Effect|" 
                      tick={{fontSize: 10}} 
                      label={{ 
                        value: locale === 'zh' ? '|标准化效应值|' : '|Standardized Effect|', 
                        position: 'insideBottom', 
                        offset: -15, 
                        fontSize: 11, 
                        fill: '#334155' 
                      }} 
                    />
                    
                    <YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={65}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ 
                        value: locale === 'zh' ? '半正态累计概率 (%)' : 'Half-Normal % Probability', 
                        angle: -90, 
                        position: 'center', 
                        dx: -15, 
                        fontSize: 11, 
                        fill: '#334155' 
                      }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}
                      tickFormatter={(val) => {
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
                      }}
                    />
                    
                    <ZAxis type="category" dataKey="factor.name" name="Factor" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                      formatter={(value: number, name: string, props: any) => [
                        name === 'Factor' || name === 'factor.name' ? props.payload.name : value.toFixed(3),
                        name === 'Factor' || name === 'factor.name' ? (locale === 'zh' ? '因素' : 'Factor') : (props.payload.direction ? (props.payload.direction === 'Positive' ? (locale === 'zh' ? '正向效应' : 'Positive Effect') : (locale === 'zh' ? '负向效应' : 'Negative Effect')) : (locale === 'zh' ? '数值' : 'Value'))
                      ]}
                      labelFormatter={(label, payload) => {
                         if (payload && payload.length > 0) {
                            return payload[0].payload.name;
                         }
                         return '';
                      }}
                    />
                    <Scatter data={analysisResults.halfNormalData} shape="square" stroke="#000" strokeWidth={0.5}>
                      {analysisResults.halfNormalData.map((entry: any, index: number) => {
                          let color = entry.significant ? (entry.direction === 'Positive' ? '#2563eb' : '#dc2626') : (entry.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                          return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Scatter>
                    <ReferenceLine segment={[{x: 0, y: 0}, {x: analysisResults.halfNormalLine?.[1]?.x || 10, y: analysisResults.halfNormalLine?.[1]?.y || 10}]} stroke="#f87171" strokeWidth={2} />
                  </ScatterChart>
                </ResponsiveContainer>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                  {locale === 'zh' ? '暂无可用的试验数据' : 'No valid run data available.'}
                </div>
              )
            )}
          </div>
          {effectsPlotType === 'pareto' && (
            <div className="flex flex-col gap-6 mt-4">
              <div className="flex flex-col gap-2 items-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-500 dark:text-slate-300 font-bold">
                <div className="flex gap-4 justify-center">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/10"></div> {locale === 'zh' ? '显著正效应 (正向促进)' : 'Significant (Positive)'}</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/10"></div> {locale === 'zh' ? '显著负效应 (负向抑制)' : 'Significant (Negative)'}</div>
                </div>
                <div className="flex gap-4 justify-center">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/10"></div> {locale === 'zh' ? '不显著 (正向)' : 'Not Significant (Positive)'}</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/10"></div> {locale === 'zh' ? '不显著 (负向)' : 'Not Significant (Negative)'}</div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mx-4 mb-2">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">
                  {locale === 'zh' ? '显著性判定阈值' : 'Significance Thresholds'}
                </h5>
                <div className="flex flex-col gap-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-500 mt-1 shrink-0"></div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-500 dark:text-slate-300">
                        {locale === 'zh' ? `t 显著性限 (${analysisResults?.tLimitPareto?.toFixed(2)}):` : `t-Limit (${analysisResults?.tLimitPareto?.toFixed(2)}):`}
                      </strong> 
                      {locale === 'zh' 
                        ? '统计学显著性的标准临界值 (通常 α = 0.05)。超过此绿线的效应表示对响应有实质性显著影响。' 
                        : 'The standard threshold for statistical significance (usually α = 0.05). Effects extending beyond this dark green line have a meaningful impact on the response.'}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-500 mt-1 shrink-0"></div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-500 dark:text-slate-300">
                        {locale === 'zh' ? `Bonferroni 阈值 (${analysisResults?.bonferroniLimitPareto?.toFixed(2)}):` : `Bonferroni Limit (${analysisResults?.bonferroniLimitPareto?.toFixed(2)}):`}
                      </strong> 
                      {locale === 'zh' 
                        ? '多重比较校正的更严格保守阈值。超过此紫线的效应具有极高显著性。' 
                        : 'A stricter, conservative threshold that corrects for multiple testing. Effects extending beyond this purple line are highly significant.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {effectsPlotType === 'half-normal' && (
            <div className="flex flex-col gap-2 mt-4 items-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/20"></div> {locale === 'zh' ? '显著正效应 (正向促进)' : 'Significant (Positive)'}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/20"></div> {locale === 'zh' ? '显著负效应 (负向抑制)' : 'Significant (Negative)'}</div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/20"></div> {locale === 'zh' ? '不显著 (正向)' : 'Not Significant (Positive)'}</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/20"></div> {locale === 'zh' ? '不显著 (负向)' : 'Not Significant (Negative)'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Model Evaluation & Statistical Inference Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          {/* Section Header with Segmented Navigation */}
          <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[10.5px] uppercase tracking-widest font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                Model Estimates & Inference
              </h3>
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono">
                ({activeResponse?.name})
              </span>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center p-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 text-[9.5px]">
              <button
                type="button"
                onClick={() => setTableTab('all')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${tableTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {locale === 'zh' ? '完整表格' : 'All Tables'}
              </button>
              <button
                type="button"
                onClick={() => setTableTab('summary')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${tableTab === 'summary' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {locale === 'zh' ? '效应摘要 (LogWorth)' : 'Effect Summary'}
              </button>
              <button
                type="button"
                onClick={() => setTableTab('estimates')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${tableTab === 'estimates' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {locale === 'zh' ? '参数估算 (Estimates)' : 'Estimates'}
              </button>
              <button
                type="button"
                onClick={() => setTableTab('tests')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${tableTab === 'tests' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {locale === 'zh' ? '效应检验 (ANOVA)' : 'Effect Tests'}
              </button>
              <button
                type="button"
                onClick={() => setTableTab('lof')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${tableTab === 'lof' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {locale === 'zh' ? '失拟分析 (Lack of Fit)' : 'Lack of Fit'}
              </button>
            </div>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto">
            {/* 1. Effect Summary */}
            {(tableTab === 'all' || tableTab === 'summary') && (
              <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
                <div className="px-2.5 py-1 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
                      {locale === 'zh' ? '效应汇总 (Effect Summary)' : 'Effect Summary'}
                    </span>
                    <TableHelpTooltip title="Effect Summary & LogWorth">
                      <p><strong className="text-white">LogWorth:</strong> Computed as <code className="text-emerald-300">-log₁₀(p)</code>. Ranks factors by statistical influence on the response.</p>
                      <p><strong className="text-white">Threshold:</strong> Cutoff at <code className="text-emerald-300">p = 0.05</code> corresponds to LogWorth = 1.301 (marked by the hairline notch).</p>
                      <p><strong className="text-white">Dual-Tone Bar:</strong> The neutral slate base spans up to 1.301; the <span className="text-emerald-400 font-medium">emerald green surplus</span> highlights how far the factor exceeds significance.</p>
                      <p><strong className="text-white">Include/Exclude:</strong> Click to remove terms from the prediction model for parsimony.</p>
                    </TableHelpTooltip>
                    <span className="text-[9px] text-slate-400">
                      {locale === 'zh' ? '按 LogWorth 排序' : 'Ranked by LogWorth'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {analysisResults?.effectSummary?.filter((e: any) => !e.isExcluded).length || 0} / {analysisResults?.effectSummary?.length || 0} {locale === 'zh' ? '项已启用' : 'active'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">{locale === 'zh' ? '因素 / 来源' : 'Factor / Source'}</th>
                        <th className="py-1 px-2 w-48">LogWorth <span className="text-[8.5px] font-mono lowercase text-slate-400">[-log₁₀(p)]</span></th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                        <th className="py-1 px-2 text-center w-16">{locale === 'zh' ? '状态' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const effSummary = analysisResults?.effectSummary || [];
                        const maxEffectLogworth = Math.max(...effSummary.map((e: any) => (!e.isExcluded && e.logworth > 0 ? e.logworth : 0)), 1.4);
                        const maxScale = Math.max(2.6, Math.ceil(maxEffectLogworth * 1.2 * 10) / 10);
                        const thresholdPct = Math.min(85, Math.max(15, (1.30103 / maxScale) * 100));

                        return effSummary.map((ef: any) => {
                          const isSig = ef.logworth >= 1.30103;
                          const val = !ef.isExcluded && ef.logworth > 0 ? ef.logworth : 0;
                          const barPercent = Math.min(100, Math.max(0, (val / maxScale) * 100));

                          return (
                            <tr 
                              key={ef.id} 
                              className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${ef.isExcluded ? 'bg-slate-50/30 dark:bg-slate-800/20 text-slate-400' : ''}`}
                            >
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
                                      <span className="text-[7.5px] text-slate-400 italic">{locale === 'zh' ? '已排除' : 'excluded'}</span>
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex-1 h-2 rounded-xs bg-slate-100 dark:bg-slate-800 relative overflow-hidden border border-slate-200/70 dark:border-slate-700/70 flex"
                                      title={`LogWorth: ${val.toFixed(3)} | Threshold p=0.05 at ${thresholdPct.toFixed(1)}%`}
                                    >
                                      {/* Neutral slate base up to threshold or value */}
                                      <div 
                                        className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-150"
                                        style={{ width: `${Math.min(barPercent, thresholdPct)}%` }}
                                      />
                                      {/* Subtle threshold hairline demarcation */}
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
                            <td className="py-0.5 px-2 text-center">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (activeResponse) {
                                    let newExcluded = [...(activeResponse.excludedTerms || [])];
                                    if (ef.isExcluded) {
                                      newExcluded = newExcluded.filter(item => item !== ef.id);
                                    } else {
                                      newExcluded.push(ef.id);
                                    }
                                    const updatedProject = {
                                      ...project,
                                      responses: project.responses.map(r => r.id === activeResponse.id ? { ...r, excludedTerms: newExcluded } : r)
                                    };
                                    onUpdateProject(updatedProject);
                                  }
                                }}
                                className={`text-[8.5px] px-1.5 py-0 leading-tight h-4 rounded border font-medium transition-all ${
                                  ef.isExcluded 
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/80 hover:bg-amber-100' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {ef.isExcluded ? (locale === 'zh' ? '包含' : 'Include') : (locale === 'zh' ? '排除' : 'Exclude')}
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Parameter Estimates */}
            {(tableTab === 'all' || tableTab === 'estimates') && (
              <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
                <div className="px-2.5 py-1 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
                      {locale === 'zh' ? '参数估计 (Parameter Estimates)' : 'Parameter Estimates'}
                    </span>
                    <TableHelpTooltip title="Parameter Estimates">
                      <p><strong className="text-white">Estimate (β):</strong> Regression coefficient. Indicates response change per 1-unit coded step (-1 to +1).</p>
                      <p><strong className="text-white">Std Error:</strong> Standard error measuring estimation uncertainty.</p>
                      <p><strong className="text-white">t Ratio:</strong> Estimate divided by Std Error (tests H₀: β = 0).</p>
                      <p><strong className="text-white">p-Value:</strong> Values ≤ 0.05 (green) indicate the effect is statistically distinguishable from random noise.</p>
                      <p><strong className="text-white">VIF (Multicollinearity):</strong> 1.0 = orthogonal (ideal), 1–5 = low/moderate, &gt;10 = severe collinearity.</p>
                      <p><strong className="text-white">Adeq Precision:</strong> Signal-to-noise ratio. Values &gt; 4.0 confirm adequate model discrimination.</p>
                    </TableHelpTooltip>
                    <span className="text-[9px] text-slate-400">
                      {locale === 'zh' ? '回归系数' : 'Regression Coefficients'}
                    </span>
                  </div>
                  {analysisResults?.rSquared !== undefined && (
                    <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-slate-500">
                      <span>R²: <strong className="text-slate-800 dark:text-slate-200">{analysisResults.rSquared.toFixed(4)}</strong></span>
                      <span>•</span>
                      <span>Adj R²: <strong className="text-slate-800 dark:text-slate-200">{analysisResults.adjRSquared.toFixed(4)}</strong></span>
                      {analysisResults?.adequatePrecision !== undefined && (
                        <>
                          <span>•</span>
                          <span title="Adequate Precision: Signal-to-noise ratio (> 4.0 is desirable)">
                            Adeq Prec: <strong className={analysisResults.adequatePrecision >= 4 ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-amber-700 dark:text-amber-400 font-bold"}>
                              {analysisResults.adequatePrecision.toFixed(2)}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">{locale === 'zh' ? '模型项' : 'Model Term'}</th>
                        <th className="py-1 px-2 text-right">{locale === 'zh' ? '估计值 (β)' : 'Estimate (β)'}</th>
                        <th className="py-1 px-2 text-right">{locale === 'zh' ? '标准误' : 'Std Error'}</th>
                        <th className="py-1 px-2 text-right">t Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                        <th className="py-1 px-2 text-right w-14" title="Variance Inflation Factor (1.0 = orthogonal, >5 = moderate, >10 = severe)">VIF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysisResults?.parameterEstimates?.filter((pe: any) => !pe.isAliased).map((pe: any, idx: number) => {
                        const isSig = pe.pVal !== undefined && pe.pVal !== null && pe.pVal <= 0.05;
                        const isIntercept = pe.term.toLowerCase().includes('intercept');
                        return (
                          <tr key={idx} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-0.5 px-2">
                              {isIntercept ? (
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {locale === 'zh' ? '截距 (β₀)' : 'Intercept (β₀)'}
                                </span>
                              ) : (
                                <span className="font-medium text-slate-800 dark:text-slate-200">{pe.term}</span>
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
                            <td className="py-0.5 px-2 text-right font-mono text-[9.5px]">
                              {isIntercept ? (
                                <span className="text-slate-400">—</span>
                              ) : pe.vif !== undefined && pe.vif !== null ? (
                                pe.vif > 10 ? (
                                  <span className="text-red-600 dark:text-red-400 font-bold" title="Severe multicollinearity (VIF > 10)">
                                    {pe.vif.toFixed(2)}
                                  </span>
                                ) : pe.vif > 5 ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold" title="Moderate multicollinearity (VIF > 5)">
                                    {pe.vif.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 dark:text-slate-400">
                                    {pe.vif.toFixed(2)}
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
            )}

            {/* 3. Effect Tests */}
            {(tableTab === 'all' || tableTab === 'tests') && (
              <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
                <div className="px-2.5 py-1 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
                      {locale === 'zh' ? '效应检验 (Effect Tests)' : 'Effect Tests'}
                    </span>
                    <TableHelpTooltip title="Effect Tests (ANOVA)">
                      <p><strong className="text-white">Sum of Squares:</strong> Type III partial sum of squares testing the unique contribution of each effect after adjusting for all other model terms.</p>
                      <p><strong className="text-white">F Ratio:</strong> Mean square of the effect divided by residual mean square error.</p>
                      <p><strong className="text-white">p-Value:</strong> Values ≤ 0.05 confirm the factor has a statistically significant effect on the response.</p>
                    </TableHelpTooltip>
                    <span className="text-[9px] text-slate-400">
                      {locale === 'zh' ? 'ANOVA 方差分解' : 'ANOVA Decomposition'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">Type III SS</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">{locale === 'zh' ? '变异来源' : 'Source'}</th>
                        <th className="py-1 px-2 text-right">Nparm</th>
                        <th className="py-1 px-2 text-right">DF</th>
                        <th className="py-1 px-2 text-right">{locale === 'zh' ? '离差平方和 (SS)' : 'Sum of Squares'}</th>
                        <th className="py-1 px-2 text-right">F Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysisResults?.effectSummary?.filter((ef: any) => !ef.isExcluded && !ef.isAliased).map((ef: any, idx: number) => {
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
            )}

            {/* 4. Lack of Fit */}
            {(tableTab === 'all' || tableTab === 'lof') && (
              <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
                <div className="px-2.5 py-1 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200">
                      {locale === 'zh' ? '失拟检验 (Lack of Fit)' : 'Lack of Fit'}
                    </span>
                    <TableHelpTooltip title="Lack of Fit Test">
                      <p><strong className="text-white">Purpose:</strong> Tests whether the model form adequately describes the data or if higher-order curvature/interactions are missing.</p>
                      <p><strong className="text-white">Pure Error:</strong> Experimental noise measured from replicate runs (e.g. repeated center points).</p>
                      <p><strong className="text-white">p &gt; 0.05 (Green):</strong> Adequate fit! The model captures the response surface without significant unmodeled curvature.</p>
                      <p><strong className="text-white">p ≤ 0.05 (Amber):</strong> Significant lack of fit. Suggests expanding to quadratic or higher-order response surface model.</p>
                    </TableHelpTooltip>
                    <span className="text-[9px] text-slate-400">
                      {locale === 'zh' ? '模型弯曲性与纯误差' : 'Model Curvature & Pure Error'}
                    </span>
                  </div>
                  {analysisResults?.lackOfFit?.p_lof !== null && analysisResults?.lackOfFit?.p_lof !== undefined && (
                    analysisResults.lackOfFit.p_lof >= 0.05 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {locale === 'zh' ? '拟合充分' : 'Adequate Fit'} (p = {analysisResults.lackOfFit.p_lof.toFixed(4)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {locale === 'zh' ? '失拟显著' : 'Significant LOF'} (p = {analysisResults.lackOfFit.p_lof.toFixed(4)})
                      </span>
                    )
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-1 px-2">{locale === 'zh' ? '误差来源' : 'Error Source'}</th>
                        <th className="py-1 px-2 text-right">DF</th>
                        <th className="py-1 px-2 text-right">{locale === 'zh' ? '离差平方和 (SS)' : 'Sum of Squares'}</th>
                        <th className="py-1 px-2 text-right">{locale === 'zh' ? '均方 (MS)' : 'Mean Square'}</th>
                        <th className="py-1 px-2 text-right">F Ratio</th>
                        <th className="py-1 px-2 text-right">p-Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Lack of Fit Row */}
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-0.5 px-2 font-semibold text-slate-800 dark:text-slate-200">
                          {locale === 'zh' ? '失拟 (Lack of Fit)' : 'Lack of Fit'}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{analysisResults?.lackOfFit?.df_lof ?? 0}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysisResults?.lackOfFit?.ss_lof || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysisResults?.lackOfFit?.ms_lof || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {analysisResults?.lackOfFit?.f_lof === Infinity ? 'Inf' : (analysisResults?.lackOfFit?.f_lof !== null && analysisResults?.lackOfFit?.f_lof !== undefined ? analysisResults.lackOfFit.f_lof.toFixed(4) : '—')}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono">
                          {analysisResults?.lackOfFit?.p_lof !== null && analysisResults?.lackOfFit?.p_lof !== undefined ? (
                            analysisResults.lackOfFit.p_lof <= 0.05 ? (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70">
                                {analysisResults.lackOfFit.p_lof.toFixed(4)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                                {analysisResults.lackOfFit.p_lof.toFixed(4)}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Pure Error Row */}
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-0.5 px-2 font-medium text-slate-700 dark:text-slate-300">
                          {locale === 'zh' ? '纯误差' : 'Pure Error'} <span className="text-[9px] text-slate-400 font-normal">({locale === 'zh' ? '重复试验' : 'Replicates'})</span>
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{analysisResults?.lackOfFit?.df_pure ?? 0}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysisResults?.lackOfFit?.ss_pure || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{(analysisResults?.lackOfFit?.ms_pure || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                      </tr>

                      {/* Total Residual Row */}
                      <tr className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-slate-50/30 dark:bg-slate-800/20 font-medium">
                        <td className="py-0.5 px-2 text-slate-800 dark:text-slate-200">Total Error <span className="text-[9px] text-slate-400 font-normal">(Residual)</span></td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{Math.max(0, analysisResults?.lackOfFit?.df_error || 0)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{(analysisResults?.lackOfFit?.sse || 0).toFixed(6)}</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-800 dark:text-slate-200">
                          {(analysisResults?.lackOfFit?.df_error || 0) > 0 ? ((analysisResults?.lackOfFit?.sse || 0) / (analysisResults?.lackOfFit?.df_error || 1)).toFixed(6) : '—'}
                        </td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                        <td className="py-0.5 px-2 text-right font-mono text-slate-400">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Interpretive note */}
                <div className="px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  {analysisResults?.lackOfFit?.p_lof !== null && analysisResults?.lackOfFit?.p_lof !== undefined ? (
                    analysisResults.lackOfFit.p_lof >= 0.05 ? (
                      <div className="flex items-center gap-1.5 text-[9.5px] text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Lack of Fit is not significant (p = {analysisResults.lackOfFit.p_lof.toFixed(4)} &gt; 0.05). Model fits response surface adequately.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9.5px] text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Lack of Fit is significant (p = {analysisResults.lackOfFit.p_lof.toFixed(4)} ≤ 0.05). Curvature or higher-order terms suggested.</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 dark:text-slate-400">
                      <Info className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Replicate runs (center points) required to separate Pure Error from Lack of Fit.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Effects Plot */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
                {locale === 'zh' ? '主效应图 (数据均值 Main Effects Plot)' : 'Main Effects Plot (Data Means)'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {locale === 'zh' 
                  ? '展示各单一因素水平变化对响应均值的影响。斜率越陡峭表示主效应越强。' 
                  : 'Shows how changing a single factor changes the response on average. Steeper lines indicate stronger main effects.'}
              </p>
            </div>
            {/* Interactive Categorical Factor Selector / Switcher */}
            {(() => {
              const catFactor = project.factors.find(f => f.type === 'categorical');
              if (!catFactor || !catFactor.levels || catFactor.levels.length === 0) return null;
              return (
                <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mr-1">
                    {catFactor.name}:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMainEffectCatFilter(null)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      selectedMainEffectCatFilter === null
                        ? 'bg-purple-600 text-white shadow-xs font-semibold'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {locale === 'zh' ? `全部 ${catFactor.name}` : `All ${catFactor.name}s`}
                  </button>
                  {catFactor.levels.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedMainEffectCatFilter(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        selectedMainEffectCatFilter === lvl
                          ? 'bg-purple-600 text-white shadow-xs font-semibold'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const catFactor = project.factors.find(f => f.type === 'categorical');
              const validRuns = project.runs.filter(r => {
                if (!activeResponse) return false;
                const v = r.responses[activeResponse.id];
                return v !== null && v !== undefined && String(v).trim() !== '' && !isNaN(Number(v));
              });

              // When a categorical level filter is selected, filter runs for continuous factor averages
              const filteredRuns = (selectedMainEffectCatFilter && catFactor)
                ? validRuns.filter(r => {
                    const factorVal = r.factors[catFactor.id];
                    const lvlIdx = catFactor.levels ? catFactor.levels.indexOf(selectedMainEffectCatFilter) : -1;
                    const valStr = String(factorVal ?? '').trim().toLowerCase();
                    const targetStr = selectedMainEffectCatFilter.trim().toLowerCase();
                    return valStr === targetStr || (lvlIdx !== -1 && (valStr === String(lvlIdx) || valStr === String(lvlIdx + 1)));
                  })
                : validRuns;

              // Compute effects dynamically based on current filter selection
              const computedEffects = project.factors.map(factor => {
                if (factor.type === 'categorical') {
                  const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
                  const levelAverages = levels.map((lvl, lIdx) => {
                    const matching = validRuns.filter(r => {
                      const v = r.factors[factor.id];
                      const valStr = String(v ?? '').trim().toLowerCase();
                      return valStr === lvl.trim().toLowerCase() || valStr === String(lIdx) || valStr === String(lIdx + 1);
                    });
                    const count = matching.length;
                    const avg = count > 0 && activeResponse ? matching.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / count : null;
                    return { level: lvl, avg, count };
                  });
                  return {
                    factor,
                    levelAverages,
                    lowAvg: levelAverages[0]?.avg ?? null,
                    centerAvg: null,
                    highAvg: levelAverages[levelAverages.length - 1]?.avg ?? null
                  };
                } else {
                  const runsToUse = filteredRuns.length > 0 ? filteredRuns : validRuns;
                  const mid = (factor.min + factor.max) / 2;
                  const halfRange = Math.abs(factor.max - factor.min) / 2;

                  let lowSum = 0, lowCount = 0;
                  let highSum = 0, highCount = 0;
                  let centerSum = 0, centerCount = 0;

                  runsToUse.forEach(r => {
                    if (!activeResponse) return;
                    const v = Number(r.factors[factor.id]);
                    const resp = Number(r.responses[activeResponse.id]);
                    if (isNaN(v) || isNaN(resp)) return;

                    if (halfRange > 1e-9 && Math.abs(v - mid) <= halfRange * 0.15) {
                      centerSum += resp;
                      centerCount++;
                    } else if (v > mid + 1e-6) {
                      highSum += resp;
                      highCount++;
                    } else if (v < mid - 1e-6) {
                      lowSum += resp;
                      lowCount++;
                    }
                  });

                  return {
                    factor,
                    lowAvg: lowCount > 0 ? lowSum / lowCount : null,
                    centerAvg: centerCount > 0 ? centerSum / centerCount : null,
                    highAvg: highCount > 0 ? highSum / highCount : null
                  };
                }
              });

              const allAverages = computedEffects.flatMap(e => {
                if (e.factor.type === 'categorical') {
                  return (e.levelAverages || []).map((la: any) => la.avg).filter((v: any) => v != null);
                }
                return [e.lowAvg, e.centerAvg, e.highAvg].filter(v => v != null);
              });

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

              return computedEffects.map(effect => {
                if (effect.factor.type === 'categorical') {
                  const chartData = (effect.levelAverages || []).map((la: any) => ({
                    x: la.level,
                    value: la.avg
                  }));
                  return (
                    <div id={`main-effect-${effect.factor.id}`} key={effect.factor.id} className="h-48 border border-purple-100 dark:border-purple-900/40 rounded bg-purple-50/20 dark:bg-purple-950/20 p-2 relative group">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 truncate flex-1">
                          {effect.factor.name} <span className="font-normal text-[9px] text-purple-500">{locale === 'zh' ? '(分类变量)' : '(Categorical)'}</span>
                        </p>
                        <button
                          data-export-hide="true"
                          onClick={() => handleDownloadSvg(`main-effect-${effect.factor.id}`, `${project.name}_Main_Effect_${effect.factor.name}`)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-all"
                          title="Download PNG"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                      <div className="h-[calc(100%-1.5rem)] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="category" dataKey="x" tick={{fontSize: 9}} interval={0} />
                            <YAxis domain={[yMin, yMax]} ticks={yTicks} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} allowDataOverflow={true} type="number" />
                            <Tooltip contentStyle={{fontSize: '10px'}} labelFormatter={(val) => `${effect.factor.name}: ${val}`} />
                            <Line 
                              type="linear" 
                              dataKey="value" 
                              stroke="#8b5cf6" 
                              strokeWidth={2.5} 
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (cx == null || cy == null) return null;
                                const isSelected = selectedMainEffectCatFilter === payload.x;
                                return (
                                  <circle
                                    key={payload.x}
                                    cx={cx}
                                    cy={cy}
                                    r={isSelected ? 6 : 4.5}
                                    fill={isSelected ? "#7c3aed" : "white"}
                                    stroke="#8b5cf6"
                                    strokeWidth={isSelected ? 2.5 : 2}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedMainEffectCatFilter(isSelected ? null : payload.x)}
                                  />
                                );
                              }} 
                              activeDot={{ r: 6, fill: "#8b5cf6" }} 
                              isAnimationActive={false} 
                              connectNulls 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                }

                const midX = (effect.factor.min + effect.factor.max) / 2;
                const xRange = effect.factor.max - effect.factor.min;
                const xPadding = xRange === 0 ? 1 : xRange * 0.1;
                const xDomain = [effect.factor.min - xPadding, effect.factor.max + xPadding];

                return (
                  <div id={`main-effect-${effect.factor.id}`} key={effect.factor.id} className="h-48 border border-slate-100 rounded bg-slate-50 dark:bg-slate-800 p-2 relative group">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-bold text-slate-600 truncate flex-1">
                        {effect.factor.name}
                        {selectedMainEffectCatFilter && (
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-normal ml-1">
                            ({selectedMainEffectCatFilter})
                          </span>
                        )}
                      </p>
                      <button
                        data-export-hide="true"
                        onClick={() => handleDownloadSvg(`main-effect-${effect.factor.id}`, `${project.name}_Main_Effect_${effect.factor.name}`)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-all"
                        title="Download PNG"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                    <div className="h-[calc(100%-1.5rem)] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          ...(effect.lowAvg != null ? [{ x: effect.factor.min, value: effect.lowAvg }] : []),
                          ...(effect.centerAvg != null ? [{ x: midX, value: effect.centerAvg }] : []),
                          ...(effect.highAvg != null ? [{ x: effect.factor.max, value: effect.highAvg }] : [])
                        ]} margin={{ top: 15, right: 15, left: 5, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" dataKey="x" domain={xDomain} ticks={[effect.factor.min, midX, effect.factor.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} />
                          <YAxis domain={[yMin, yMax]} ticks={yTicks} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} allowDataOverflow={true} type="number" />
                          <Tooltip contentStyle={{fontSize: '10px'}} labelFormatter={(val) => `${effect.factor.name}: ${val}`} />
                          <ReferenceLine x={midX} stroke="#94a3b8" strokeDasharray="3 3" />
                          <Line type="linear" dataKey="value" stroke="#82ca9d" strokeWidth={2.5} dot={{ r: 4.5, fill: "white", stroke: "#82ca9d", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#82ca9d" }} isAnimationActive={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>



        {/* Interaction Plot */}
        {interactionData && (
          <div id="interaction-plot" className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
              <div>
                <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
                  {locale === 'zh' ? '二阶交互作用图 (Interaction Plot)' : 'Interaction Plot'}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {locale === 'zh' ? '展示两两因素间的协同或拮抗作用。非平行交叉折线表示存在显著的交互效应。' : 'Shows how two factors work together. Non-parallel lines indicate an interaction.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {locale === 'zh' ? '因素 1:' : 'Factor 1:'}
                  </span>
                  <select 
                    value={interactionData.f1.id} 
                    onChange={e => setInteractionF1Id(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] focus:outline-none"
                  >
                    {project.factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {locale === 'zh' ? '因素 2:' : 'Factor 2:'}
                  </span>
                  <select 
                    value={interactionData.f2.id} 
                    onChange={e => setInteractionF2Id(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] focus:outline-none"
                  >
                    {project.factors.filter(f => f.id !== interactionData.f1.id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <button
                  data-export-hide="true"
                  onClick={() => handleDownloadSvg('interaction-plot', `${project.name}_Interaction_Plot`)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  title="Download PNG"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
            <div className="h-64 w-full flex justify-center">
              <div className="w-full max-w-lg">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interactionData.data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    {interactionData.isF1Categorical ? (
                      <XAxis type="category" dataKey="x" tick={{fontSize: 10}} height={40} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    ) : (
                      <XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} height={40} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    )}
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} />
                    <Tooltip contentStyle={{fontSize: '11px'}} labelFormatter={(val) => `${interactionData.f1.name}: ${val}`} />
                    {!interactionData.isF1Categorical && (
                      <ReferenceLine x={(interactionData.f1.min + interactionData.f1.max) / 2} stroke="#cbd5e1" strokeDasharray="3 3" />
                    )}
                    <Legend verticalAlign="top" wrapperStyle={{fontSize: '11px', paddingBottom: '15px'}} />
                    {interactionData.lines.map((line: any) => (
                      <Line 
                        key={line.key} 
                        type="linear" 
                        name={line.name} 
                        dataKey={line.key} 
                        stroke={line.stroke} 
                        strokeWidth={2} 
                        dot={{ r: 4 }} 
                        connectNulls={true} 
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic Plots */}
        {analysisResults?.actualByPredicted && analysisResults?.studentizedResiduals && (
          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActualByPredictedPlot actualByPredicted={analysisResults.actualByPredicted} projectName={project.name} />
            <StudentizedResidualsPlot studentizedResiduals={analysisResults.studentizedResiduals} projectName={project.name} />
          </div>
        )}

        {/* DOE Mean Plot */}
        <div id="doe-mean-plot" className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
                {locale === 'zh' ? 'DOE 运行均值图 (Run Means)' : 'DOE Mean Plot (Run Means)'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {locale === 'zh' 
                  ? '展示每个试验运行的平均响应值，便于识别总体趋势或异常点。' 
                  : 'Displays the average response for each experimental run to spot trends or anomalies.'}
              </p>
            </div>
            <button
              data-export-hide="true"
              onClick={() => handleDownloadSvg('doe-mean-plot', `${project.name}_DOE_Mean_Plot`)}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="run" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tick={{fontSize: 10}} 
                    width={65} 
                    label={{ 
                      value: locale === 'zh' ? '平均响应值' : 'Mean Response', 
                      angle: -90, 
                      position: 'center', 
                      dx: -15, 
                      fontSize: 10 
                    }} 
                  />
                  <Tooltip contentStyle={{fontSize: '11px'}} />
                  <Line type="monotone" dataKey="value" name={locale === 'zh' ? '平均响应' : 'Response Value'} stroke="#3ab9a0" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">
                {locale === 'zh' ? '暂无可用的试验数据' : 'No valid run data available.'}
              </div>
            )}
          </div>
        </div>

        {/* Contour & Response Surface Plots */}
        {plotData && project.factors.length >= 2 && (
          <div id="surface-plot-container" className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
               <div>
                 <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
                   {locale === 'zh' ? '等高线与 3D 响应曲面图 (Response Surface)' : 'Contour & Response Surface Plots'}
                 </h3>
                 <p className="text-[10px] text-slate-500">
                   {locale === 'zh' ? '可视化预测响应面在双自变量维度的变化曲面，辅助锁定最优操作窗口。' : 'Visualizes the predicted response surface across two factors, helping locate optimal operating regions.'}
                 </p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'zh' ? '类型:' : 'Type:'}</span>
                   <select 
                     value={plot3dType} 
                     onChange={e => setPlot3dType(e.target.value as any)}
                     className="rounded border border-slate-300 px-2 py-1 text-[11px] focus:outline-none"
                   >
                     <option value="scatter3d">{locale === 'zh' ? '3D 散点图' : 'Scatter 3D'}</option>
                     <option value="mesh3d">{locale === 'zh' ? '3D 响应曲面 (网格)' : 'Surface 3D (Mesh)'}</option>
                     <option value="contour">{locale === 'zh' ? '2D 等高线图' : 'Contour 2D'}</option>
                   </select>
                 </div>
                 {plot3dType === 'mesh3d' && (
                   <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase cursor-pointer select-none bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                     <input 
                       type="checkbox" 
                       checked={showFloorProjection} 
                       onChange={e => setShowFloorProjection(e.target.checked)}
                       className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                     />
                     <span>{locale === 'zh' ? '底面投影等高线' : 'Floor Contours'}</span>
                   </label>
                 )}
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 dark:text-slate-300 uppercase tracking-widest">{locale === 'zh' ? 'X 轴:' : 'X-Axis:'}</span>
                   <select 
                     value={plotData.xFactor.id} 
                     onChange={e => setXAxisFactorId(e.target.value)}
                     className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500"
                   >
                     {project.factors.map(f => (
                       <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                   </select>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 dark:text-slate-300 uppercase tracking-widest">{locale === 'zh' ? 'Y 轴:' : 'Y-Axis:'}</span>
                   <select 
                     value={plotData.yFactor.id} 
                     onChange={e => setYAxisFactorId(e.target.value)}
                     className="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500"
                   >
                     {project.factors.map(f => (
                       <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                   </select>
                 </div>
                 <button
                    data-export-hide="true"
                    onClick={() => handleDownloadSvg('surface-plot-container', `${project.name}_Response_Surface`)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Download PNG"
                  >
                    <Download size={14} />
                  </button>
               </div>
            </div>
            
            <div className="h-[400px] w-full border border-slate-100 rounded bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
               <PlotlyErrorBoundary
                 resetKey={`${plot3dType}-${plotData.xFactor.id}-${plotData.yFactor.id}-${activeResponse?.id}`}
                 onResetTo2D={() => setPlot3dType('contour')}
               >
                 <Plot
                  data={plotData.data}
                  layout={{
                    autosize: true,
                    margin: plot3dType === 'contour' ? { l: 60, r: 30, b: 60, t: 30 } : { l: 0, r: 0, b: 0, t: 0 },
                    ...(plot3dType === 'contour' ? {
                      xaxis: {
                        title: { text: plotData.xFactor.name, font: { size: 12, color: '#64748b' } },
                        tickfont: { size: 10, color: '#94a3b8' },
                        range: [plotData.xBounds.min, plotData.xBounds.max],
                        ...(plotData.xFactor.type === 'categorical' && plotData.xFactor.levels ? {
                          tickmode: 'array',
                          tickvals: plotData.xFactor.levels.map((_, i) => i),
                          ticktext: plotData.xFactor.levels
                        } : {})
                      },
                      yaxis: {
                        title: { text: plotData.yFactor.name, font: { size: 12, color: '#64748b' } },
                        tickfont: { size: 10, color: '#94a3b8' },
                        range: [plotData.yBounds.min, plotData.yBounds.max],
                        ...(plotData.yFactor.type === 'categorical' && plotData.yFactor.levels ? {
                          tickmode: 'array',
                          tickvals: plotData.yFactor.levels.map((_, i) => i),
                          ticktext: plotData.yFactor.levels
                        } : {})
                      }
                    } : {
                      scene: {
                        xaxis: {
                          title: { text: `${plotData.xFactor.name}${plotData.xFactor.unit ? ` (${plotData.xFactor.unit})` : ''}` },
                          range: [plotData.xBounds.min, plotData.xBounds.max],
                          ...(plotData.xFactor.type === 'categorical' && plotData.xFactor.levels ? {
                            tickmode: 'array',
                            tickvals: plotData.xFactor.levels.map((_, i) => i),
                            ticktext: plotData.xFactor.levels
                          } : {})
                        },
                        yaxis: {
                          title: { text: `${plotData.yFactor.name}${plotData.yFactor.unit ? ` (${plotData.yFactor.unit})` : ''}` },
                          range: [plotData.yBounds.min, plotData.yBounds.max],
                          ...(plotData.yFactor.type === 'categorical' && plotData.yFactor.levels ? {
                            tickmode: 'array',
                            tickvals: plotData.yFactor.levels.map((_, i) => i),
                            ticktext: plotData.yFactor.levels
                          } : {})
                        },
                        zaxis: {
                          title: { text: `${plotData.activeResponse?.name}${plotData.activeResponse?.unit ? ` (${plotData.activeResponse.unit})` : ''}` },
                          range: [plotData.zBounds.min, plotData.zBounds.max]
                        }
                      }
                    }),
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent'
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                  config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'svg', filename: `${project.name}_Response_Surface` } }}
                />
               </PlotlyErrorBoundary>
            </div>
          </div>
        )}

        {/* Prediction Profiler */}
        <div className="lg:col-span-2">
          <PredictionProfiler project={project} allAnalysisResults={allAnalysisResults} />
        </div>

        
        {/* Predictive Model & Optimal Conditions */}
        {analysisResults?.optimalConditions && (
          <div className="lg:col-span-2 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-5 shadow-sm flex flex-col text-slate-800 dark:text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-400">
                  {locale === 'zh' ? '预测模型：最优操作条件' : 'Predictive Model: Optimal Conditions'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {locale === 'zh' ? '经验 OLS 响应面模型优化' : 'Empirical OLS response surface optimization'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-blue-900/40 border border-slate-300 dark:border-blue-700/60 rounded px-2.5 py-1">
                  <span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider">
                    {locale === 'zh' ? '优化目标:' : 'Goal:'}
                  </span>
                  <div className="relative">
                    <select 
                      className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 rounded pl-2 pr-5 py-0.5 appearance-none cursor-pointer transition-colors"
                      value={effectiveGoal}
                      onChange={e => setCustomOptConfig(prev => ({ ...prev, responseId: activeResponse!.id, goal: e.target.value as any, targetValue: prev.responseId === activeResponse!.id ? prev.targetValue : (activeResponse!.targetValue?.toString() || '') }))}
                    >
                      <option value="maximize" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-700 dark:text-slate-200">{locale === 'zh' ? '最大化' : 'Maximize'}</option>
                      <option value="minimize" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-700 dark:text-slate-200">{locale === 'zh' ? '最小化' : 'Minimize'}</option>
                      <option value="target" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-700 dark:text-slate-200">{locale === 'zh' ? '目标值' : 'Target'}</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-blue-300 pointer-events-none" size={12} />
                  </div>
                  <span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider hidden sm:inline">{activeResponse?.name}</span>
                  {effectiveGoal === 'target' && (
                    <div className="flex items-center gap-1 ml-1 sm:ml-2 border-l border-slate-300 dark:border-blue-700/60 pl-1 sm:pl-2">
                      <span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider">{locale === 'zh' ? '数值:' : 'Value:'}</span>
                      <input 
                        type="number" 
                        className="bg-white dark:bg-blue-950/50 border border-slate-300 dark:border-blue-700/60 rounded px-1.5 py-0.5 text-slate-800 dark:text-blue-200 font-mono w-16 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:focus:ring-blue-500 text-[10px]"
                        value={customOptConfig.responseId === activeResponse?.id && customOptConfig.targetValue !== '' ? customOptConfig.targetValue : (activeResponse?.targetValue ?? '')}
                        onChange={e => setCustomOptConfig(prev => ({ ...prev, responseId: activeResponse!.id, targetValue: e.target.value }))}
                        placeholder={locale === 'zh' ? '目标值' : 'Target'}
                      />
                    </div>
                  )}
                </div>
                <span className={`px-2.5 py-1.5 rounded border font-semibold uppercase tracking-wider ${
                  (analysisResults.optimalConditions.desirability ?? 0) >= 0.9 
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200' 
                    : (analysisResults.optimalConditions.desirability ?? 0) >= 0.7 
                    ? 'bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700/60 text-blue-800 dark:text-blue-200' 
                    : 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-200'
                }`}>
                  {locale === 'zh' ? '总合意度 (Desirability): ' : 'Desirability: '}{((analysisResults.optimalConditions.desirability ?? 0) * 100).toFixed(1)}% ({(analysisResults.optimalConditions.desirability ?? 0).toFixed(3)})
                </span>
              </div>
            </div>

            {/* Primary Predicted Response & Confidence Intervals Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  {locale === 'zh' ? '预测响应值 (Ŷ)' : 'Predicted Response (Ŷ)'}
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {analysisResults.optimalConditions.expectedY !== undefined ? analysisResults.optimalConditions.expectedY.toFixed(2) : '—'} <span className="text-xs font-normal text-slate-500 dark:text-slate-300">{activeResponse?.unit}</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {locale === 'zh' ? '标准误 (SE): ±' : 'Standard Error: ±'}{analysisResults.optimalConditions.seFit !== undefined ? analysisResults.optimalConditions.seFit.toFixed(2) : '—'}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  {locale === 'zh' ? '95% 置信区间 (均值 CI)' : '95% Confidence Interval (Mean CI)'}
                </div>
                <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-300 mt-0.5">
                  [{analysisResults.optimalConditions.ciLower !== undefined ? analysisResults.optimalConditions.ciLower.toFixed(2) : '—'}, {analysisResults.optimalConditions.ciUpper !== undefined ? analysisResults.optimalConditions.ciUpper.toFixed(2) : '—'}]
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {locale === 'zh' 
                    ? `最优点重复试验均值的置信区间 (t = ±${analysisResults.optimalConditions.tCrit !== undefined ? analysisResults.optimalConditions.tCrit.toFixed(2) : '1.96'})`
                    : `Expected mean of repeated runs at optimum (t = ±${analysisResults.optimalConditions.tCrit !== undefined ? analysisResults.optimalConditions.tCrit.toFixed(2) : '1.96'})`}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  {locale === 'zh' ? '95% 预测区间 (单次 PI)' : '95% Prediction Interval (Single PI)'}
                </div>
                <div className="text-sm font-bold font-mono text-fuchsia-600 dark:text-fuchsia-300 mt-0.5">
                  [{analysisResults.optimalConditions.piLower !== undefined ? analysisResults.optimalConditions.piLower.toFixed(2) : '—'}, {analysisResults.optimalConditions.piUpper !== undefined ? analysisResults.optimalConditions.piUpper.toFixed(2) : '—'}]
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {locale === 'zh' ? '未来单次验证试验的预期波动范围' : 'Expected range for a single future confirmation run'}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded p-3">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  {locale === 'zh' ? '模型拟合优度' : 'Model Goodness-of-Fit'}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                  <span>R²: <strong className="text-slate-800 dark:text-white">{analysisResults.rSquared !== undefined ? analysisResults.rSquared.toFixed(3) : '—'}</strong></span>
                  <span className="text-slate-500">|</span>
                  <span>Adj R²: <strong className="text-slate-800 dark:text-white">{analysisResults.adjRSquared !== undefined ? analysisResults.adjRSquared.toFixed(3) : '—'}</strong></span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                  RMSE: {analysisResults.optimalConditions.rmse !== undefined ? analysisResults.optimalConditions.rmse.toFixed(2) : '—'} | {locale === 'zh' ? '杠杆值 h' : 'Leverage h'}: {analysisResults.optimalConditions.leverage !== undefined ? analysisResults.optimalConditions.leverage.toFixed(3) : '—'}
                </div>
              </div>
            </div>

            {/* Optimal Factor Settings Table with Profiler Sensitivity */}
            <div className="overflow-x-auto">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2">
                {locale === 'zh' ? '推荐最优工艺操作参数与边际灵敏度 (Prediction Profiler)' : 'Optimal Factor Operating Coordinates & Sensitivity (Prediction Profiler)'}
              </div>
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="pb-2 font-semibold">{locale === 'zh' ? '因素' : 'Factor'}</th>
                    <th className="pb-2 font-semibold text-center">{locale === 'zh' ? '实验考察范围' : 'Experimental Range'}</th>
                    <th className="pb-2 font-semibold text-center">{locale === 'zh' ? '编码水平' : 'Coded Setting'}</th>
                    <th className="pb-2 font-semibold text-right">{locale === 'zh' ? '推荐最优操作值' : 'Optimal Operating Value'}</th>
                    <th className="pb-2 font-semibold text-right" title="Marginal derivative of response with respect to factor at the optimum (slope in JMP Prediction Profiler)">
                      {locale === 'zh' ? '边际灵敏度斜率 (∂Ŷ/∂X)' : 'Marginal Sensitivity (∂Ŷ/∂X)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                  {analysisResults.optimalConditions.factors?.map((opt: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 text-slate-800 dark:text-white font-sans font-medium">
                        {opt.factor.name}
                      </td>
                      <td className="py-2.5 text-center text-slate-500 dark:text-slate-400 text-[10px]">
                        {opt.factor.type === 'categorical'
                          ? (opt.factor.levels?.join(', ') || (locale === 'zh' ? '分类变量' : 'Categorical'))
                          : `${opt.factor.min} - ${opt.factor.max} ${opt.factor.unit || ''}`}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                          {locale === 'zh' 
                            ? (opt.codedLabel?.replace('High', '高水平')?.replace('Low', '低水平')?.replace('Center', '中心点') || opt.codedLabel) 
                            : opt.codedLabel}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-block font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs shadow-sm">
                          {opt.optimalValue} {opt.factor.type === 'categorical' ? '' : (opt.factor.unit || '')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {opt.factor.type === 'categorical' || opt.naturalSlope === null ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 bg-slate-100 dark:bg-slate-800/40">
                            {locale === 'zh' ? '离散类别水平' : 'Discrete Level'}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                            Math.abs(opt.naturalSlope) < 1e-4 
                              ? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40' 
                              : opt.naturalSlope > 0 
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40' 
                              : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40'
                          }`}>
                            {opt.naturalSlope > 0 ? '+' : ''}{opt.naturalSlope.toFixed(3)} {activeResponse?.unit ? `${activeResponse.unit}/` : ''}{opt.factor.unit || 'unit'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
}
