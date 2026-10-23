import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useTranslation } from '../i18n/LanguageContext';

import { useIsDarkMode, getChartAxisProps, getAxisLabelProps } from './chartTheme';

export function ActualByPredictedPlot({ actualByPredicted, projectName }: { actualByPredicted: any[], projectName: string }) {
  const { t, locale } = useTranslation();
  const isDark = useIsDarkMode();
  const handleDownload = () => {
    const el = document.getElementById('actual-by-predicted');
    if (!el) return;
    const buttons = el.querySelectorAll('button');
    buttons.forEach(b => (b as HTMLElement).style.display = 'none');

    toPng(el, { 
      backgroundColor: isDark ? '#0f172a' : '#ffffff', 
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
      .then(dataUrl => {
        const a = document.createElement('a');
        a.download = `${projectName}_Actual_by_Predicted.png`;
        a.href = dataUrl;
        a.click();
      })
      .finally(() => {
        buttons.forEach(b => (b as HTMLElement).style.display = '');
      });
  };

  const minVal = Math.min(...actualByPredicted.map(d => Math.min(d.actual, d.predicted)));
  const maxVal = Math.max(...actualByPredicted.map(d => Math.max(d.actual, d.predicted)));
  const padding = (maxVal - minVal) * 0.1 || 1;
  const domain = [minVal - padding, maxVal + padding];

  return (
    <div id="actual-by-predicted" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/60 relative group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
            {locale === 'zh' ? '实际值 vs 预测值散点图 (Actual by Predicted)' : 'Actual by Predicted Plot'}
          </h3>
          <p className="text-[10px] text-slate-500">
            {locale === 'zh' ? '评估模型拟合优度。点越贴合对角线，预测精度越高。' : 'Shows model fit. Points close to the line indicate good prediction.'}
          </p>
        </div>
        <button data-export-hide="true" onClick={handleDownload} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all" title={locale === 'zh' ? '下载高清 PNG 图片' : 'Download PNG'}>
          <Download size={14} />
        </button>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 65 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
            <XAxis 
              type="number" 
              dataKey="predicted" 
              name="Predicted" 
              domain={domain} 
              {...getChartAxisProps(isDark)}
              tickFormatter={(val) => val.toFixed(2)} 
              label={getAxisLabelProps(isDark, locale === 'zh' ? '预测值 (Predicted)' : 'Predicted', { position: 'insideBottom', offset: -10 })} 
            />
            <YAxis 
              type="number" 
              dataKey="actual" 
              name="Actual" 
              domain={domain} 
              {...getChartAxisProps(isDark)}
              tickFormatter={(val) => val.toFixed(2)} 
              width={65} 
              label={getAxisLabelProps(isDark, locale === 'zh' ? '实际测量值 (Actual)' : 'Actual', { angle: -90, position: 'center', dx: -15 })} 
            />
            <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f8fafc' : '#0f172a'}} formatter={(value: number) => value.toFixed(3)} />
            <Scatter name="Runs" data={actualByPredicted} fill={isDark ? "#38bdf8" : "#2563eb"} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={1.2} />
            <ReferenceLine segment={[{ x: domain[0], y: domain[0] }, { x: domain[1], y: domain[1] }]} stroke="#3ab9a0" strokeWidth={2} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StudentizedResidualsPlot({ studentizedResiduals, projectName }: { studentizedResiduals: any[], projectName: string }) {
  const { t, locale } = useTranslation();
  const isDark = useIsDarkMode();
  const handleDownload = () => {
    const el = document.getElementById('studentized-residuals');
    if (!el) return;
    const buttons = el.querySelectorAll('button');
    buttons.forEach(b => (b as HTMLElement).style.display = 'none');

    toPng(el, { 
      backgroundColor: isDark ? '#0f172a' : '#ffffff', 
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
      .then(dataUrl => {
        const a = document.createElement('a');
        a.download = `${projectName}_Studentized_Residuals.png`;
        a.href = dataUrl;
        a.click();
      })
      .finally(() => {
        buttons.forEach(b => (b as HTMLElement).style.display = '');
      });
  };

  const limit = studentizedResiduals[0]?.limit || 2.5;
  const bonferroniLimit = studentizedResiduals[0]?.bonferroniLimit || limit + 1;
  const maxAbsResid = Math.max(...studentizedResiduals.map(d => Math.abs(d.studentized || 0)));
  const yMax = Math.max(bonferroniLimit + 0.5, maxAbsResid + 0.5, 4);

  const getPointColors = (entry: any) => {
    const val = Math.abs(entry.studentized ?? 0);
    const bLimit = entry.bonferroniLimit || bonferroniLimit;
    const indLimit = entry.limit || limit;

    // Outlier beyond Bonferroni simultaneous limits (Red)
    if (val >= bLimit) {
      return {
        fill: isDark ? '#f87171' : '#ef4444',
        stroke: isDark ? '#0f172a' : '#ffffff'
      };
    }
    // Warning beyond individual 95% limit (Amber)
    if (val >= indLimit) {
      return {
        fill: isDark ? '#fbbf24' : '#f59e0b',
        stroke: isDark ? '#0f172a' : '#ffffff'
      };
    }
    // Influential point (Purple)
    if (entry.isInfluential) {
      return {
        fill: isDark ? '#c084fc' : '#a855f7',
        stroke: isDark ? '#0f172a' : '#ffffff'
      };
    }
    // Normal in-control run point (Vibrant Sky Blue - high contrast against dark navy and white)
    return {
      fill: isDark ? '#38bdf8' : '#0284c7',
      stroke: isDark ? '#0f172a' : '#ffffff'
    };
  };

  return (
    <div id="studentized-residuals" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/60 relative group flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1">
            {locale === 'zh' ? '外学生化残差图 (Studentized Residuals)' : 'Studentized Residuals'}
          </h3>
          <p className="text-[10px] text-slate-500">
            {locale === 'zh' ? '检测异常值。超出红色限值的实验点建议排查。' : 'Detects outliers. Points beyond the red limits may require investigation.'}
          </p>
        </div>
        <button data-export-hide="true" onClick={handleDownload} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all" title={locale === 'zh' ? '下载高清 PNG 图片' : 'Download PNG'}>
          <Download size={14} />
        </button>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 65 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
            <XAxis 
              type="number" 
              dataKey="run" 
              name="Run" 
              {...getChartAxisProps(isDark)}
              tickFormatter={(val) => val.toFixed(0)} 
              label={getAxisLabelProps(isDark, locale === 'zh' ? '实验序号 (Run)' : 'Run Number', { position: 'insideBottom', offset: -10 })} 
            />
            <YAxis 
              type="number" 
              dataKey="studentized" 
              name="Studentized Residual" 
              domain={[-yMax, yMax]} 
              {...getChartAxisProps(isDark)}
              tickFormatter={(val) => val.toFixed(2)} 
              width={65} 
              label={getAxisLabelProps(isDark, locale === 'zh' ? '学生化残差' : 'Studentized Residual', { angle: -90, position: 'center', dx: -15 })} 
            />
            <Tooltip 
              cursor={{strokeDasharray: '3 3'}} 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xs text-white p-2 rounded-md shadow-xl text-[10px] space-y-1 border border-slate-700/80 leading-tight">
                      <div className="font-bold border-b border-slate-700 pb-0.5 flex justify-between gap-3">
                        <span>{locale === 'zh' ? `实验 #${data.run}` : `Run #${data.run}`}</span>
                        {data.isInfluential && <span className="text-[8.5px] px-1 py-0 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">{locale === 'zh' ? '高影响点' : 'Influential'}</span>}
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-300">{locale === 'zh' ? '学生化残差:' : 'Studentized Residual:'}</span>
                        <strong className={Math.abs(data.studentized) > 2.5 ? "text-amber-400 font-mono" : "text-emerald-400 font-mono"}>
                          {data.studentized?.toFixed(3)}
                        </strong>
                      </div>
                      {data.cooksDistance !== undefined && (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-300">{locale === 'zh' ? '库克距离 (Cook\'s D):' : 'Cook\'s Distance (D):'}</span>
                          <strong className={data.isInfluential ? "text-amber-400 font-mono" : "text-slate-200 font-mono"}>
                            {data.cooksDistance?.toFixed(3)}
                          </strong>
                        </div>
                      )}
                      {data.leverage !== undefined && (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-300">{locale === 'zh' ? '杠杆值 (Leverage h):' : 'Leverage (h):'}</span>
                          <strong className={data.isHighLeverage ? "text-amber-400 font-mono" : "text-slate-200 font-mono"}>
                            {data.leverage?.toFixed(3)}
                          </strong>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Runs" data={studentizedResiduals} fill={isDark ? '#38bdf8' : '#0284c7'}>
              {studentizedResiduals.map((entry: any, index: number) => {
                const { fill: pFill, stroke: pStroke } = getPointColors(entry);
                return (
                  <Cell 
                    key={`resid-point-${index}`} 
                    fill={pFill} 
                    stroke={pStroke} 
                    strokeWidth={1.5} 
                  />
                );
              })}
            </Scatter>
            <ReferenceLine y={0} stroke="#3b82f6" />
            <ReferenceLine y={limit} stroke="#22c55e" />
            <ReferenceLine y={-limit} stroke="#22c55e" />
            <ReferenceLine y={bonferroniLimit} stroke="#ef4444" />
            <ReferenceLine y={-bonferroniLimit} stroke="#ef4444" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400 border border-slate-900/40 dark:border-slate-900 shrink-0"></span>
            {locale === 'zh' ? '正常点' : 'In-Control'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 border border-slate-900/40 dark:border-slate-900 shrink-0"></span>
            {locale === 'zh' ? '单检验限' : 'Warning (±t)'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 dark:bg-red-400 border border-slate-900/40 dark:border-slate-900 shrink-0"></span>
            {locale === 'zh' ? '离群值 (联合限)' : 'Outlier (±Bonf)'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 border border-slate-900/40 dark:border-slate-900 shrink-0"></span>
            {locale === 'zh' ? '高影响点' : 'Influential'}
          </span>
        </div>
        <span className="text-slate-400 dark:text-slate-500 font-mono text-[9px]">{locale === 'zh' ? '悬停查看 Cook\'s D 与杠杆值' : 'Hover points for Cook\'s D & Leverage'}</span>
      </div>
    </div>
  );
}
