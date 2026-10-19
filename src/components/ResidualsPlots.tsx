import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useTranslation } from '../context/LanguageContext';

export function ActualByPredictedPlot({ actualByPredicted, projectName }: { actualByPredicted: any[], projectName: string }) {
  const { t, locale } = useTranslation();
  const handleDownload = () => {
    const el = document.getElementById('actual-by-predicted');
    if (!el) return;
    const buttons = el.querySelectorAll('button');
    buttons.forEach(b => (b as HTMLElement).style.display = 'none');

    toPng(el, { 
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
    <div id="actual-by-predicted" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 relative group">
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="predicted" name="Predicted" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} label={{ value: locale === 'zh' ? '预测值 (Predicted)' : 'Predicted', position: 'insideBottom', offset: -10, fontSize: 10 }} />
            <YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={65} label={{ value: locale === 'zh' ? '实际测量值 (Actual)' : 'Actual', angle: -90, position: 'center', dx: -15, fontSize: 10 }} />
            <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px'}} formatter={(value: number) => value.toFixed(3)} />
            <Scatter name="Runs" data={actualByPredicted} fill="#3b82f6" />
            <ReferenceLine segment={[{ x: domain[0], y: domain[0] }, { x: domain[1], y: domain[1] }]} stroke="#3ab9a0" strokeWidth={2} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StudentizedResidualsPlot({ studentizedResiduals, projectName }: { studentizedResiduals: any[], projectName: string }) {
  const { t, locale } = useTranslation();
  const handleDownload = () => {
    const el = document.getElementById('studentized-residuals');
    if (!el) return;
    const buttons = el.querySelectorAll('button');
    buttons.forEach(b => (b as HTMLElement).style.display = 'none');

    toPng(el, { 
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

  return (
    <div id="studentized-residuals" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 relative group flex flex-col">
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(0)} label={{ value: locale === 'zh' ? '实验序号 (Run)' : 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} />
            <YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={65} label={{ value: locale === 'zh' ? '学生化残差' : 'Studentized Residual', angle: -90, position: 'center', dx: -15, fontSize: 10 }} />
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
            <Scatter name="Runs" data={studentizedResiduals} fill="#1e293b" />
            <ReferenceLine y={0} stroke="#3b82f6" />
            <ReferenceLine y={limit} stroke="#22c55e" />
            <ReferenceLine y={-limit} stroke="#22c55e" />
            <ReferenceLine y={bonferroniLimit} stroke="#ef4444" />
            <ReferenceLine y={-bonferroniLimit} stroke="#ef4444" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[9px] text-slate-500 flex items-center justify-between">
        <span>{locale === 'zh' ? '带 95% 显著性限的外学生化残差（红色为 Bonferroni 联合控制限，绿色为单检验限）' : 'Externally studentized residuals with 95% simultaneous limits (Bonferroni in red, individual in green).'}</span>
        <span className="text-slate-400 font-mono">{locale === 'zh' ? '悬停查看 Cook\'s D 与杠杆值' : 'Hover points for Cook\'s D & Leverage'}</span>
      </div>
    </div>
  );
}
