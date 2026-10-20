import { generateExportHTML } from '../features/export/htmlExport';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjects } from '../state/ProjectContext';
import { useTranslation } from '../i18n/LanguageContext';
import { ArrowLeft, Settings2, Table2, LineChart, Cpu, Download, FileSpreadsheet, Edit2, Check, X, Activity, Layers } from 'lucide-react';
import ProjectSetup from '../features/setup/ProjectSetup';
import ProjectDesign from '../features/design/ProjectDesign';
import ProjectAnalysis from '../features/analysis/ProjectAnalysis';
import ProjectOptimization from '../features/optimization/ProjectOptimization';
import RobustnessSimulation from '../features/robustness/RobustnessSimulation';
import CompareResponses from '../features/compare/CompareResponses';
import { getRunPattern } from '../../core/design/doePatterns';
import { computeAnalysis } from '../../core/analysis/analysisCore';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { projects, saveProject } = useProjects();
  const { t, locale } = useTranslation();
  const project = projects.find(p => p.id === id);
  const [activeTab, setActiveTab] = useState<'setup' | 'design' | 'analysis' | 'compare' | 'optimization' | 'robustness'>('setup');
  const [selectedAnalysisResponseId, setSelectedAnalysisResponseId] = useState<string>('');
  
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  if (!project) return <div className="p-8 text-center text-slate-500 dark:text-slate-300 text-[11px] bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-600">{t('experiment_not_found', 'Experiment not found')}</div>;

  const handleSaveEdit = () => {
    if (editName.trim()) {
      saveProject({ ...project, name: editName, description: editDesc });
    }
    setIsEditingProject(false);
  };

  const handleStartEdit = () => {
    setEditName(project.name);
    setEditDesc(project.description || '');
    setIsEditingProject(true);
  };

  
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", project.name.replace(/\s+/g, '_') + "_DOE_Export.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

    const handleExportExcel = () => {
    import('xlsx-js-style').then(({ utils, writeFile }) => {
      const designTypeNames: Record<string, string> = {
        'factorial_2level': 'Two-Level Factorial Design',
        'custom_d_optimal': 'D-Optimal Custom Design',
        'dsd': 'Definitive Screening Design (DSD)',
        'ccd': 'Central Composite Design (CCD)',
        'bbd': 'Box-Behnken Design (BBD)',
        'plackett_burman': 'Plackett-Burman Design (PB)'
      };
      
      const boldStyle = { font: { bold: true } };
      const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
      const headerBorder = { bottom: { style: 'medium', color: { rgb: '000000' } } };

      const hasCategoricalFactors = project.factors.some(f => f.type === 'categorical');
      
      const factorHeaderCells = [
        { v: 'Name', s: { font: { bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: headerBorder } },
        { v: 'Type', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
        { v: 'Min', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
        { v: 'Max', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
        ...(hasCategoricalFactors ? [
          { v: 'Levels', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } }
        ] : []),
        { v: 'Unit', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } }
      ];

      const setupData: any[][] = [
        [{ v: 'Experiment Name:', s: boldStyle }, project.name],
        [{ v: 'Description:', s: boldStyle }, { v: project.description || '', s: { alignment: { wrapText: true } } }],
        [{ v: 'Design Type:', s: boldStyle }, designTypeNames[project.designType || 'factorial_2level'] || 'Not specified'],
        [],
        [{ v: 'Factors', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } } }],
        [],
        factorHeaderCells
      ];
      
      project.factors.forEach(f => {
        if (f.type === 'categorical') {
          const levelsText = f.levels && f.levels.length > 0 ? f.levels.join(', ') : '-';
          setupData.push([
            f.name,
            { v: 'Categorical', s: centerStyle },
            { v: '-', s: centerStyle },
            { v: '-', s: centerStyle },
            ...(hasCategoricalFactors ? [{ v: levelsText, s: centerStyle }] : []),
            { v: f.unit || '', s: centerStyle }
          ]);
        } else {
          setupData.push([
            f.name,
            { v: 'Numeric', s: centerStyle },
            { v: f.min, s: centerStyle },
            { v: f.max, s: centerStyle },
            ...(hasCategoricalFactors ? [{ v: '-', s: centerStyle }] : []),
            { v: f.unit || '', s: centerStyle }
          ]);
        }
      });

      setupData.push([]);
      setupData.push([{ v: 'Responses', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } } }, '', '']);
      setupData.push([]);
      
      setupData.push([
        { v: 'Name', s: { font: { bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: headerBorder } },
        { v: 'Goal', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
        { v: 'Unit', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } }
      ]);
      
      project.responses.forEach(res => {
        setupData.push([
          res.name,
          { v: res.goal, s: centerStyle },
          { v: res.unit || '', s: centerStyle }
        ]);
      });

      const setupWs = utils.aoa_to_sheet(setupData);
      
      const factorsHeaderRowIndex = 4;
      const factorColsCount = hasCategoricalFactors ? 6 : 5;
      const responsesHeaderRowIndex = 4 + 1 + 1 + 1 + project.factors.length + 1;
      
      setupWs['!merges'] = [
        { s: { r: factorsHeaderRowIndex, c: 0 }, e: { r: factorsHeaderRowIndex, c: factorColsCount - 1 } },
        { s: { r: responsesHeaderRowIndex, c: 0 }, e: { r: responsesHeaderRowIndex, c: 2 } }
      ];
      
      setupWs['!cols'] = [
        { wch: Math.max(20, ...project.factors.map(f => f.name.length), ...project.responses.map(res => res.name.length)) + 2 },
        { wch: 25 },
        { wch: 12 },
        { wch: 12 },
        ...(hasCategoricalFactors ? [
          { wch: Math.max(25, ...project.factors.map(f => (f.levels ? f.levels.join(', ').length : 0)), 20) }
        ] : []),
        { wch: 12 }
      ];

      // Design Matrix Sheet
      const runHeaders = ['Run', 'Pattern', 'Standard Order', ...project.factors.map(f=>f.name), ...project.responses.map(r=>r.name)];
      
      const headerRow = runHeaders.map(h => ({
        v: h, 
        s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder }
      }));
      
      const runData = project.runs.map(run => {
        const pattern = getRunPattern(run, project.factors);
        const fvals = project.factors.map(f => {
          const rawVal = run.factors[f.id];
          if (rawVal === undefined || rawVal === null || rawVal === '') return { v: '', s: centerStyle };
          if (f.type === 'categorical') {
            let displayVal = String(rawVal);
            if (f.levels && f.levels.length > 0) {
              if (typeof rawVal === 'number' && f.levels[rawVal] !== undefined) {
                displayVal = f.levels[rawVal];
              } else if (typeof rawVal === 'string') {
                if (f.levels.includes(rawVal)) {
                  displayVal = rawVal;
                } else {
                  const numIdx = Number(rawVal);
                  if (!isNaN(numIdx) && Number.isInteger(numIdx) && f.levels[numIdx] !== undefined) {
                    displayVal = f.levels[numIdx];
                  }
                }
              }
            }
            return { v: displayVal, s: centerStyle };
          } else {
            const num = Number(rawVal);
            return { v: isNaN(num) ? String(rawVal) : num, s: centerStyle };
          }
        });
        const rvals = project.responses.map(r => {
          const val = run.responses[r.id];
          if (val === undefined || val === null || val === ('' as any)) return { v: '', s: centerStyle };
          const num = Number(val);
          return { v: isNaN(num) ? String(val) : num, s: centerStyle };
        });
        return [
          { v: run.runOrder, s: centerStyle }, 
          { v: pattern, s: centerStyle },
          { v: run.stdOrder, s: centerStyle }, 
          ...fvals, 
          ...rvals
        ];
      });

      const runWs = utils.aoa_to_sheet([headerRow, ...runData]);
      runWs['!cols'] = runHeaders.map((h, colIdx) => {
        let maxLen = h.length;
        runData.forEach(row => {
          const cell = row[colIdx];
          if (cell && cell.v !== undefined && cell.v !== null) {
            maxLen = Math.max(maxLen, String(cell.v).length);
          }
        });
        return { wch: Math.max(14, maxLen + 4) };
      });

      const wb = utils.book_new();
      utils.book_append_sheet(wb, setupWs, "Setup");
      utils.book_append_sheet(wb, runWs, "Design Matrix");
      
      // Add Analysis sheets for each response
      project.responses.forEach(res => {
        const analysis = computeAnalysis(project, res, res.excludedTerms || [], res.goal, res.targetValue);
        if (!analysis || !analysis.effectSummary) return;
        
        let wsData: any[][] = [];
        
        const formatNumber = (num: number, decimals=5) => isNaN(num) || num === null || num === undefined ? '' : Number(num.toFixed(decimals));
        const formatPVal = (pval: number) => {
          if (pval === undefined || pval === null || isNaN(pval)) return '';
          return pval < 0.0001 ? '<.0001*' : (pval <= 0.05 ? pval.toFixed(5) + '*' : pval.toFixed(5));
        };
        const pvalStyle = (pval: number) => {
          if (pval <= 0.05) return { font: { color: { rgb: 'B91C1C' } }, alignment: { horizontal: 'right' } };
          return { alignment: { horizontal: 'right' } };
        };
        
        wsData.push([{ v: `Analysis for ${res.name}`, s: { font: { bold: true, sz: 14 } } }]);
        wsData.push([]);
        
        // Effect Summary
        wsData.push([{ v: 'Effect Summary', s: { font: { bold: true, sz: 12 } } }]);
        wsData.push([
          { v: 'Source', s: { font: { bold: true }, border: headerBorder } },
          { v: 'Status', s: { font: { bold: true }, border: headerBorder } },
          { v: 'LogWorth', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
          { v: 'PValue', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } }
        ]);
        
        analysis.effectSummary.forEach((ef: any) => {
          wsData.push([
            { v: ef.name + (ef.isExcluded ? ' (Excluded)' : '') + (ef.isAliased ? ' (Aliased)' : ''), s: { font: { strike: ef.isExcluded, color: ef.isExcluded ? {rgb: '94A3B8'} : {rgb: '000000'} } } },
            { v: ef.isExcluded ? 'Excluded' : 'Active', s: { font: { strike: ef.isExcluded, color: ef.isExcluded ? {rgb: '94A3B8'} : {rgb: '000000'} } } },
            { v: formatNumber(ef.logworth, 3), s: { alignment: { horizontal: 'right' }, font: { strike: ef.isExcluded, color: ef.isExcluded ? {rgb: '94A3B8'} : {rgb: '000000'} } } },
            { v: formatPVal(ef.pVal), s: ef.isExcluded ? { alignment: { horizontal: 'right' }, font: { strike: true, color: {rgb: '94A3B8'} } } : pvalStyle(ef.pVal) }
          ]);
        });
        wsData.push([]);
        
        // Parameter Estimates
        if (analysis.parameterEstimates) {
          wsData.push([{ v: 'Parameter Estimates', s: { font: { bold: true, sz: 12 } } }]);
          wsData.push([
            { v: 'Term', s: { font: { bold: true }, border: headerBorder } },
            { v: 'Estimate', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Std Error', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 't Ratio', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Prob>|t|', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } }
          ]);
          
          analysis.parameterEstimates.filter((pe: any) => !pe.isAliased).forEach((pe: any) => {
            wsData.push([
              pe.term,
              { v: formatNumber(pe.estimate, 5), s: { alignment: { horizontal: 'right' } } },
              { v: formatNumber(pe.stdError, 5), s: { alignment: { horizontal: 'right' } } },
              { v: formatNumber(pe.tRatio, 2), s: { alignment: { horizontal: 'right' } } },
              { v: formatPVal(pe.pVal), s: pvalStyle(pe.pVal) }
            ]);
          });
          wsData.push([]);
        }

        // Effect Tests
        if (analysis.effectSummary) {
          wsData.push([{ v: 'Effect Tests', s: { font: { bold: true, sz: 12 } } }]);
          wsData.push([
            { v: 'Source', s: { font: { bold: true }, border: headerBorder } },
            { v: 'Nparm', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'DF', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Sum of Squares', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'F Ratio', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Prob > F', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } }
          ]);
          
          analysis.effectSummary.filter((ef: any) => !ef.isExcluded && !ef.isAliased).forEach((ef: any) => {
            wsData.push([
              ef.name,
              { v: 1, s: { alignment: { horizontal: 'right' } } },
              { v: 1, s: { alignment: { horizontal: 'right' } } },
              { v: formatNumber(ef.ss, 6), s: { alignment: { horizontal: 'right' } } },
              { v: formatNumber(ef.fRatio, 4), s: { alignment: { horizontal: 'right' } } },
              { v: formatPVal(ef.pVal), s: pvalStyle(ef.pVal) }
            ]);
          });
          wsData.push([]);
        }

        // Lack of Fit
        if (analysis.lackOfFit && analysis.lackOfFit.df_lof > 0) {
          wsData.push([{ v: 'Lack Of Fit', s: { font: { bold: true, sz: 12 } } }]);
          wsData.push([
            { v: 'Source', s: { font: { bold: true }, border: headerBorder } },
            { v: 'DF', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Sum of Squares', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Mean Square', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'F Ratio', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } },
            { v: 'Prob > F', s: { font: { bold: true }, alignment: { horizontal: 'right' }, border: headerBorder } }
          ]);
          
          const lof = analysis.lackOfFit;
          wsData.push([
            'Lack Of Fit',
            { v: lof.df_lof, s: { alignment: { horizontal: 'right' } } },
            { v: formatNumber(lof.ss_lof, 6), s: { alignment: { horizontal: 'right' } } },
            { v: formatNumber(lof.ms_lof, 6), s: { alignment: { horizontal: 'right' } } },
            { v: lof.f_lof === Infinity ? 'Inf' : formatNumber(lof.f_lof, 4), s: { alignment: { horizontal: 'right' } } },
            { v: formatPVal(lof.p_lof), s: pvalStyle(lof.p_lof) }
          ]);
          wsData.push([
            'Pure Error',
            { v: lof.df_pure, s: { alignment: { horizontal: 'right' } } },
            { v: formatNumber(lof.ss_pure, 6), s: { alignment: { horizontal: 'right' } } },
            { v: formatNumber(lof.ms_pure, 6), s: { alignment: { horizontal: 'right' } } },
            '', ''
          ]);
          wsData.push([
            'Total Error',
            { v: lof.df_error, s: { alignment: { horizontal: 'right' } } },
            { v: formatNumber(lof.sse, 6), s: { alignment: { horizontal: 'right' } } },
            '', '', ''
          ]);
        }
        
        let anWs = utils.aoa_to_sheet(wsData);
        anWs['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        let sheetName = res.name.substring(0, 25) + ' Analysis';
        utils.book_append_sheet(wb, anWs, sheetName);
      });
      
      writeFile(wb, `${project.name.replace(/\s+/g, '_')}_DOE_Export.xlsx`);
    });
  };

  const handleExportHTML = () => {
    const htmlContent = generateExportHTML(project);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_DOE_Export.html`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const tabs = [
    { id: 'setup', name: t('tab_setup', 'Setup'), icon: Settings2 },
    { id: 'design', name: t('tab_design', 'Design Matrix'), icon: Table2 },
    { id: 'analysis', name: t('tab_analysis', 'Analysis'), icon: LineChart },
    { id: 'compare', name: t('tab_compare', 'Compare Responses'), icon: Layers },
    { id: 'robustness', name: t('tab_robustness', 'Robustness / Monte Carlo'), icon: Activity },
    { id: 'optimization', name: t('tab_optimization', 'Bayesian Optimization'), icon: Cpu },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            {isEditingProject ? (
              <div 
                className="flex flex-col gap-2"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    handleSaveEdit();
                  }
                }}
              >
                <input
                  type="text"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-2 py-1 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
                  placeholder={t('project_name_label', 'Experiment Name')}
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100"
                  placeholder={t('project_desc_label', 'Description (Optional)')}
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={handleSaveEdit} className="p-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingProject(false)} className="p-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{project.name}</h2>
                <button onClick={handleStartEdit} title={t('edit_experiment_details', 'Edit details')} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity">
                  <Edit2 size={12} />
                </button>
              </div>
            )}
            {!isEditingProject && (
              <div className="flex gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                <span>{project.factors.length} {t('factors', 'Factors')}</span>
                <span>&middot;</span>
                <span>{project.responses.length} {t('responses', 'Responses')}</span>
                <span>&middot;</span>
                <span>{project.runs.length} {t('runs', 'Runs')}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          
          <button 
            onClick={handleExportJSON}
            className="px-3 py-1.5 bg-slate-600 text-white rounded hover:bg-slate-700 font-medium flex items-center gap-1 text-[11px]"
          >
            <Download size={12} />
            {t('export_json', 'Export JSON')}
          </button>
          <button 
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 font-medium flex items-center gap-1 text-[11px]"
          >
            <FileSpreadsheet size={12} />
            {t('export_excel', 'Export Excel')}
          </button>
          <button 
            onClick={handleExportHTML}
            className="px-3 py-1.5 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium flex items-center gap-1 text-[11px]"
          >
            <Download size={12} />
            {t('export_html', 'Export HTML')}
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-600">
        <nav className="-mb-px flex space-x-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-[11px] flex items-center gap-1.5 transition-colors uppercase tracking-widest
                  ${isActive ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:border-slate-600'}
                `}
              >
                <Icon size={14} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-2">
        {activeTab === 'setup' && <ProjectSetup project={project} updateProject={saveProject} />}
        {activeTab === 'design' && <ProjectDesign project={project} updateProject={saveProject} />}
        {activeTab === 'analysis' && <ProjectAnalysis project={project} selectedResponseId={selectedAnalysisResponseId} onResponseChange={setSelectedAnalysisResponseId} onUpdateProject={saveProject} onNavigateTab={setActiveTab} />}
        {activeTab === 'compare' && <CompareResponses project={project} />}
        {activeTab === 'optimization' && <ProjectOptimization project={project} updateProject={saveProject} />}
        {activeTab === 'robustness' && <RobustnessSimulation project={project} updateProject={saveProject} />}
      </div>
    </div>
  );
}
