import { getRunPattern } from '../../../core/design/doePatterns';
import { logoBase64 } from './logoBase64';
import { Project } from '../../../core/types';
import { computeAnalysis } from '../../../core/analysis/analysisCore';
import { buildProjectSurfaceGrids } from '../../../core/analysis/surfaceGrid';

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateExportHTML(
  project: Project, 
  initialLocale: string = 'en',
  customLogo?: string
): string {
  const reportLogo = customLogo || (typeof window !== 'undefined' ? (localStorage.getItem('app_custom_logo') || localStorage.getItem('app_default_logo')) : null) || logoBase64;
  const analysisData: Record<string, any> = {};
  for (const resp of project.responses) {
    const res = computeAnalysis(project, resp, resp.excludedTerms || [], resp.goal, resp.targetValue);
    if (res) {
      analysisData[resp.id] = {
        effectSummary: res.effectSummary,
        lackOfFit: res.lackOfFit,
        parameterEstimates: res.parameterEstimates,
        actualByPredicted: res.actualByPredicted,
        studentizedResiduals: res.studentizedResiduals,
        optimalConditions: res.optimalConditions,
        rSquared: res.rSquared,
        adjRSquared: res.adjRSquared,
        rmse: res.rmse,
        effects: res.effects,
        paretoData: res.paretoData,
        halfNormalData: res.halfNormalData,
        halfNormalLine: res.halfNormalLine,
        tLimitPareto: res.tLimitPareto,
        bonferroniLimitPareto: res.bonferroniLimitPareto,
        p: res.p,
        dfModel: res.dfModel,
        modelPValue: res.modelPValue,
        surfaceGrids: buildProjectSurfaceGrids(res, project, undefined, 25, 15)
      };
    }
  }

  const designTypeNames: Record<string, { en: string; zh: string }> = {
    'factorial_2level': { en: 'Two-Level Factorial Design', zh: '两水平因子设计' },
    'custom_d_optimal': { en: 'D-Optimal Custom Design', zh: 'D-最优定制设计' },
    'dsd': { en: 'Definitive Screening Design (DSD)', zh: '确定性筛选设计 (DSD)' },
    'ccd': { en: 'Central Composite Design (CCD)', zh: '中心复合设计 (CCD)' },
    'bbd': { en: 'Box-Behnken Design (BBD)', zh: 'Box-Behnken 设计 (BBD)' },
    'plackett_burman': { en: 'Plackett-Burman Design (PB)', zh: 'Plackett-Burman 设计 (PB)' }
  };
  const designInfo = designTypeNames[project.designType || 'factorial_2level'] || { en: 'Not specified', zh: '未指定' };
  const designName = designInfo.en;

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = new Date();
  const dateStr = d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();

  const safeLocale = initialLocale === 'zh' ? 'zh' : 'en';

  let html = `<!DOCTYPE html>
<html lang="${escapeHtml(safeLocale)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Experiment Export: ${escapeHtml(project.name)}</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
        h1 { font-size: 1.5rem; color: #0f172a; margin-bottom: 8px; font-weight: normal; }
        h1 strong { font-weight: 700; }
        h2 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        h3 { font-size: 0.75rem; font-weight: 700; color: #0c75b3; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
        th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; white-space: nowrap !important; }
        .col-pval { text-align: right !important; white-space: nowrap !important; min-width: 85px !important; width: 85px !important; }
        .badge-sig { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: monospace; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; white-space: nowrap !important; line-height: 1.2; word-break: keep-all; }
        .badge-ns { display: inline-block; padding: 2px 6px; font-size: 10px; font-family: monospace; color: #64748b; white-space: nowrap !important; line-height: 1.2; word-break: keep-all; }
        .badge-warn { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: monospace; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; white-space: nowrap !important; line-height: 1.2; word-break: keep-all; }
        .solvent-btn { padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; border: 1px solid #cbd5e1; background: white; color: #475569; cursor: pointer; transition: all 0.15s ease; user-select: none; }
        .solvent-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
        .solvent-btn.active { background: #7c3aed; color: white; border-color: #6d28d9; box-shadow: 0 1px 2px rgba(124, 58, 237, 0.3); }
        select { border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 0.875rem; background: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
        @media print {
            body { background: white; color: black; padding: 0; }
            .card { box-shadow: none; border: 1px solid #cbd5e1; break-inside: avoid; }
            #report-lang-select { display: none; }
            img { max-width: 100% !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="max-w-7xl mx-auto">
        <!-- Top Header Card matching standard format with Language Selector underneath Design Used -->
        <div class="card" style="display: flex; justify-content: space-between; align-items: stretch; min-height: 120px;">
            <div style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h1><strong data-i18n="experiment_label">Experiment:</strong> ${escapeHtml(project.name)}</h1>
                    <p class="text-slate-600 mb-1">${escapeHtml(project.description || 'Axiom DOE Export')}</p>
                    <p class="text-sm text-slate-400 mb-4">${escapeHtml(dateStr)}</p>
                </div>
                <div>
                    <p class="text-sm" style="margin-bottom: 8px;">
                        <strong data-i18n="design_used_label">Design Used:</strong> <span id="design-type-display">${escapeHtml(designName)}</span>${project.randomSeed !== undefined ? ` <span class="text-xs text-slate-400" style="margin-left: 8px; font-family: monospace;">(Seed: ${escapeHtml(project.randomSeed)})</span>` : ''}
                    </p>
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <strong class="text-sm text-slate-700" data-i18n="language_label">Language:</strong>
                        <select id="report-lang-select" onchange="setReportLanguage(this.value)" style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 0.8125rem; background: white; color: #1e293b; cursor: pointer; outline: none;">
                            <option value="en">English (Default)</option>
                            <option value="zh">简体中文 (Chinese)</option>
                        </select>
                    </div>
                </div>
            </div>
            ${reportLogo ? `<div style="display: flex; align-items: center; justify-content: center; padding: 4px;"><img src="${escapeHtml(reportLogo)}" alt="Logo" style="height: auto; max-height: 90px; width: auto; max-width: 280px; object-fit: contain; align-self: center;"></div>` : ''}
        </div>

        <div class="grid-2">
            <!-- Factors Card -->
            <div class="card">
                <h2 data-i18n="factors_title">Factors</h2>
                <table>
                    <thead>
                        <tr>
                            <th data-i18n="th_name">Name</th>
                            <th data-i18n="th_type">Type</th>
                            <th data-i18n="th_min">Min</th>
                            <th data-i18n="th_max">Max</th>
                            ${project.factors.some(f => f.type === 'categorical') ? '<th data-i18n="th_levels">Levels</th>' : ''}
                            <th data-i18n="th_unit">Unit</th>
                        </tr>
                    </thead>
                    <tbody>`;
                    
  const hasCatFactors = project.factors.some(f => f.type === 'categorical');
  project.factors.forEach(f => {
    if (f.type === 'categorical') {
      const levelsText = f.levels && f.levels.length > 0 ? f.levels.join(', ') : '-';
      html += `<tr><td>${escapeHtml(f.name)}</td><td><span data-i18n-type="categorical">Categorical</span></td><td>-</td><td>-</td>${hasCatFactors ? `<td>${escapeHtml(levelsText)}</td>` : ''}<td>${escapeHtml(f.unit || '-')}</td></tr>`;
    } else {
      html += `<tr><td>${escapeHtml(f.name)}</td><td><span data-i18n-type="numeric">Numeric</span></td><td>${escapeHtml(f.min)}</td><td>${escapeHtml(f.max)}</td>${hasCatFactors ? '<td>-</td>' : ''}<td>${escapeHtml(f.unit || '-')}</td></tr>`;
    }
  });

  html += `</tbody>
                </table>
            </div>

            <!-- Responses Card -->
            <div class="card">
                <h2 data-i18n="responses_title">Responses</h2>
                <table>
                    <thead>
                        <tr>
                            <th data-i18n="th_name">Name</th>
                            <th data-i18n="th_goal">Goal</th>
                            <th data-i18n="th_target">Target</th>
                            <th data-i18n="th_unit">Unit</th>
                        </tr>
                    </thead>
                    <tbody>`;
                    
  project.responses.forEach(r => {
    html += `<tr><td>${escapeHtml(r.name)}</td><td><span data-i18n-goal="${escapeHtml(r.goal)}">${escapeHtml(r.goal)}</span></td><td>${escapeHtml(r.targetValue ?? '-')}</td><td>${escapeHtml(r.unit || '-')}</td></tr>`;
  });

  html += `</tbody>
                </table>
            </div>
        </div>

        <!-- Design Matrix & Results -->
        <div class="card overflow-x-auto">
            <h2 data-i18n="design_matrix_title">Design Matrix & Results</h2>
            <table>
                <thead>
                    <tr>
                        <th data-i18n="th_run">Run</th>
                        <th data-i18n="th_pattern">Pattern</th>`;
                        
  project.factors.forEach(f => {
    html += `<th>${escapeHtml(f.name)}</th>`;
  });
  project.responses.forEach(r => {
    html += `<th>${escapeHtml(r.name)}</th>`;
  });

  html += `</tr>
                </thead>
                <tbody>`;
                
  project.runs.forEach((r, i) => {
    const pattern = getRunPattern(r, project.factors);
    const isCenter = project.factors.every(f => {
      const val = Number(r.factors[f.id]);
      if (isNaN(val)) return false;
      const center = (f.min + f.max) / 2;
      return Math.abs(val - center) < 1e-6;
    });
    const centerIndicator = isCenter ? ' <span data-i18n-center style="color:#64748b; font-size:10px;">(Center)</span>' : '';
    const rowStyle = isCenter ? ' style="background-color: #f1f5f9;"' : '';
    html += `<tr${rowStyle}><td>${i + 1}</td><td>${escapeHtml(pattern)}${centerIndicator}</td>`;
    project.factors.forEach(f => {
      html += `<td>${escapeHtml(r.factors[f.id])}</td>`;
    });
    project.responses.forEach(res => {
      html += `<td>${r.responses[res.id] !== null && r.responses[res.id] !== undefined ? escapeHtml(r.responses[res.id]) : '-'}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody>
            </table>
        </div>

        <!-- Analysis & Optimization Card -->
        <div class="card">
            <h2 data-i18n="analysis_title">Analysis & Optimization</h2>
            <div class="mb-6 flex items-center gap-3 bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                <label class="font-semibold text-sm text-blue-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                    <span data-i18n="select_response_label">Select Response to View:</span>
                </label>
                <select id="response-select" onchange="updateView()" class="border border-blue-200 rounded-md py-1.5 px-3 bg-white text-blue-900 font-semibold shadow-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors min-w-[150px]">`;
                
  project.responses.forEach(r => {
    html += `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`;
  });

  html += `</select>
            </div>

            <!-- Model Statistics Cards -->
            <div id="stats-container" class="grid grid-cols-4 gap-4 mb-6"></div>

            <!-- Main Effects Plot -->
            <div class="border border-slate-200 rounded p-4 mb-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 style="margin-bottom: 0;" data-i18n="main_effects_title">Main Effects Plot (Data Means)</h3>
                    <div id="main-effects-filter-container"></div>
                </div>
                <div id="main-effects-container" style="display: flex; gap: 16px; flex-wrap: wrap;"></div>
            </div>

            <!-- Effects Plot (Pareto & Half-Normal) -->
            <div class="border border-slate-200 rounded p-4 mb-6">
                <h3 data-i18n="effects_plot_title">Effects Plot</h3>
                <div class="grid-2">
                    <div id="plot-pareto" style="height: 350px;"></div>
                    <div id="plot-half-normal" style="height: 350px;"></div>
                </div>
                <div id="effects-legend" style="margin-top: 16px;"></div>
            </div>

            <!-- Effect Summary & Parameter Estimates -->
            <div class="grid-2 mb-6">
                <div class="border border-slate-200 rounded p-4">
                    <h3 data-i18n="effect_summary_title">Effect Summary</h3>
                    <div id="table-effect-summary" class="overflow-x-auto text-xs"></div>
                </div>
                <div class="border border-slate-200 rounded p-4">
                    <h3 data-i18n="parameter_estimates_title">Parameter Estimates</h3>
                    <div id="table-parameter-estimates" class="overflow-x-auto text-xs"></div>
                </div>
            </div>

            <!-- Effect Tests & Lack of Fit -->
            <div class="grid-2 mb-6">
                <div class="border border-slate-200 rounded p-4">
                    <h3 data-i18n="effect_tests_title">Effect Tests</h3>
                    <div id="table-effect-tests" class="overflow-x-auto text-xs"></div>
                </div>
                <div class="border border-slate-200 rounded p-4">
                    <h3 data-i18n="lack_of_fit_title">Lack of Fit</h3>
                    <div id="table-lack-of-fit" class="overflow-x-auto text-xs"></div>
                </div>
            </div>

            <!-- Actual vs Predicted & Studentized Residuals -->
            <div class="grid-2 mb-6">
                <div class="border border-slate-200 rounded p-2">
                    <h3 data-i18n="actual_pred_title">Actual by Predicted</h3>
                    <div id="plot-actual-pred" style="height: 300px;"></div>
                </div>
                <div class="border border-slate-200 rounded p-2">
                    <h3 data-i18n="residuals_title">Studentized Residuals</h3>
                    <div id="plot-residuals" style="height: 300px;"></div>
                </div>
            </div>

            <!-- Interaction Plot -->
            <div class="border border-slate-200 rounded p-4 mb-6">
                <div class="flex justify-between items-center mb-2">
                    <h3 data-i18n="interaction_title">Interaction Plot</h3>
                    <div class="flex gap-4">
                        <label class="text-xs"><span data-i18n="int_f1_label">Factor 1 (X-Axis):</span> 
                            <select id="int-f1" onchange="updateInteractionPlot()"></select>
                        </label>
                        <label class="text-xs"><span data-i18n="int_f2_label">Factor 2 (Legend):</span> 
                            <select id="int-f2" onchange="updateInteractionPlot()"></select>
                        </label>
                    </div>
                </div>
                <div id="plot-interaction" style="height: 400px;"></div>
            </div>

            <!-- Contour & Response Surface Plot -->
            <div class="border border-slate-200 rounded p-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 data-i18n="contour_surface_title">Contour & Response Surface Plot</h3>
                    <div class="flex gap-4 items-center">
                        <label class="text-xs"><span data-i18n="surf_type_label">Type:</span> 
                            <select id="surf-type" onchange="updateSurfacePlot()">
                                <option value="mesh3d">Surface 3D (Mesh)</option>
                                <option value="scatter3d">Scatter 3D (Raw Data)</option>
                                <option value="contour">Contour 2D</option>
                            </select>
                        </label>
                        <label class="text-xs"><span data-i18n="surf_x_label">X-Axis:</span> 
                            <select id="surf-x" onchange="updateSurfacePlot()"></select>
                        </label>
                        <label class="text-xs"><span data-i18n="surf_y_label">Y-Axis:</span> 
                            <select id="surf-y" onchange="updateSurfacePlot()"></select>
                        </label>
                    </div>
                </div>
                <div id="plot-surface" style="height: 500px;"></div>
            </div>
        </div>
    </div>

    <script>
        const project = ${JSON.stringify(project).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')};
        const analysisData = ${JSON.stringify(analysisData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')};

        function escapeHtmlJS(val) {
            if (val === null || val === undefined) return '';
            return String(val)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        const I18N = {
            en: {
                language_label: 'Language:',
                experiment_label: 'Experiment:',
                design_used_label: 'Design Used:',
                factors_title: 'Factors',
                th_name: 'Name',
                th_type: 'Type',
                th_min: 'Min',
                th_max: 'Max',
                th_levels: 'Levels',
                th_unit: 'Unit',
                responses_title: 'Responses',
                th_goal: 'Goal',
                th_target: 'Target',
                design_matrix_title: 'Design Matrix & Results',
                th_run: 'Run',
                th_pattern: 'Pattern',
                analysis_title: 'Analysis & Optimization',
                select_response_label: 'Select Response to View:',
                main_effects_title: 'Main Effects Plot (Data Means)',
                effects_plot_title: 'Effects Plot',
                effect_summary_title: 'Effect Summary',
                parameter_estimates_title: 'Parameter Estimates',
                effect_tests_title: 'Effect Tests',
                lack_of_fit_title: 'Lack of Fit',
                actual_pred_title: 'Actual by Predicted',
                residuals_title: 'Studentized Residuals',
                interaction_title: 'Interaction Plot',
                contour_surface_title: 'Contour & Response Surface Plot',
                int_f1_label: 'Factor 1 (X-Axis):',
                int_f2_label: 'Factor 2 (Legend):',
                surf_type_label: 'Type:',
                surf_x_label: 'X-Axis:',
                surf_y_label: 'Y-Axis:',
                design_types: {
                    factorial_2level: 'Two-Level Factorial Design',
                    custom_d_optimal: 'D-Optimal Custom Design',
                    dsd: 'Definitive Screening Design (DSD)',
                    ccd: 'Central Composite Design (CCD)',
                    bbd: 'Box-Behnken Design (BBD)',
                    plackett_burman: 'Plackett-Burman Design (PB)'
                }
            },
            zh: {
                language_label: '报告语言:',
                experiment_label: '实验名称:',
                design_used_label: '所用设计类型:',
                factors_title: '试验因素 (Factors)',
                th_name: '因素名称',
                th_type: '变量类型',
                th_min: '最小值',
                th_max: '最大值',
                th_levels: '水平列表',
                th_unit: '单位',
                responses_title: '响应指标 (Responses)',
                th_goal: '优化目标',
                th_target: '目标值',
                design_matrix_title: '设计矩阵与试验结果',
                th_run: '运行序号',
                th_pattern: '符号模式 (Pattern)',
                analysis_title: '统计分析与响应面建模',
                select_response_label: '选择分析的响应指标:',
                main_effects_title: '主效应均值图 (数据均值)',
                effects_plot_title: '效应图 (Effects Plot)',
                effect_summary_title: '效应汇总 (Effect Summary)',
                parameter_estimates_title: '参数估算表 (Regression Coefficients)',
                effect_tests_title: '效应检验 (ANOVA 方差分析)',
                lack_of_fit_title: '失拟项分析 (Lack of Fit)',
                actual_pred_title: '实际值 vs 预测值 (Actual by Predicted)',
                residuals_title: '外学生化残差散点图 (Residuals)',
                interaction_title: '二阶交互作用图 (Interaction Plot)',
                contour_surface_title: '等高线与 3D 响应曲面图 (RSM)',
                int_f1_label: '因素 1 (X 轴):',
                int_f2_label: '因素 2 (图例):',
                surf_type_label: '图表类型:',
                surf_x_label: 'X 轴因素:',
                surf_y_label: 'Y 轴因素:',
                design_types: {
                    factorial_2level: '两水平因子设计',
                    custom_d_optimal: 'D-最优定制设计',
                    dsd: '确定性筛选设计 (DSD)',
                    ccd: '中心复合设计 (CCD)',
                    bbd: 'Box-Behnken 设计 (BBD)',
                    plackett_burman: 'Plackett-Burman 设计 (PB)'
                }
            }
        };

        let currentLang = '${safeLocale}';

        function setReportLanguage(lang) {
            currentLang = lang;
            document.documentElement.lang = lang;
            const selectEl = document.getElementById('report-lang-select');
            if (selectEl && selectEl.value !== lang) {
                selectEl.value = lang;
            }

            // Update all static elements with data-i18n
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (I18N[lang] && I18N[lang][key]) {
                    el.innerHTML = I18N[lang][key];
                }
            });

            // Update design type name
            const designKey = project.designType || 'factorial_2level';
            const designEl = document.getElementById('design-type-display');
            if (designEl) {
                designEl.innerText = (I18N[lang].design_types && I18N[lang].design_types[designKey]) 
                    || (I18N['en'].design_types && I18N['en'].design_types[designKey]) 
                    || designKey;
            }

            // Update factor types
            document.querySelectorAll('[data-i18n-type]').forEach(el => {
                const t = el.getAttribute('data-i18n-type');
                el.innerText = t === 'categorical' 
                    ? (lang === 'zh' ? '分类变量' : 'Categorical')
                    : (lang === 'zh' ? '数值连续型' : 'Numeric');
            });

            // Update response goals
            document.querySelectorAll('[data-i18n-goal]').forEach(el => {
                const g = el.getAttribute('data-i18n-goal');
                if (g === 'maximize') el.innerText = lang === 'zh' ? '最大化' : 'maximize';
                else if (g === 'minimize') el.innerText = lang === 'zh' ? '最小化' : 'minimize';
                else if (g === 'target') el.innerText = lang === 'zh' ? '目标值' : 'target';
            });

            // Update center points in design matrix
            document.querySelectorAll('[data-i18n-center]').forEach(el => {
                el.innerText = lang === 'zh' ? '(中心点)' : '(Center)';
            });

            // Update surface type dropdown options
            const surfTypeEl = document.getElementById('surf-type');
            if (surfTypeEl) {
                const currentVal = surfTypeEl.value;
                surfTypeEl.innerHTML = 
                    '<option value="mesh3d">' + (lang === 'zh' ? '3D 响应曲面 (网格)' : 'Surface 3D (Mesh)') + '</option>' +
                    '<option value="scatter3d">' + (lang === 'zh' ? '3D 散点图 (原始数据)' : 'Scatter 3D (Raw Data)') + '</option>' +
                    '<option value="contour">' + (lang === 'zh' ? '2D 等高线图' : 'Contour 2D') + '</option>';
                surfTypeEl.value = currentVal;
            }

            // Re-render plots and dynamic tables
            updateView();
        }

        function matchesCat(val, lvl, lvlIdx) {
            if (val === null || val === undefined) return false;
            const s = String(val).trim();
            if (s.toLowerCase() === String(lvl).trim().toLowerCase()) return true;
            if (s === String(lvlIdx)) return true;
            return false;
        }

        function getFactorNumeric(f, rawVal) {
            if (f.type === 'categorical') {
                const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
                let idx = levels.findIndex(l => l.trim().toLowerCase() === String(rawVal).trim().toLowerCase());
                if (idx < 0) {
                    const n = Number(rawVal);
                    if (!isNaN(n) && n >= 0 && n < levels.length) idx = n;
                }
                return idx >= 0 ? idx : 0;
            }
            const n = Number(rawVal);
            return isFinite(n) ? n : (typeof f.min === 'number' && isFinite(f.min) ? f.min : 0);
        }

        function getFactorBounds(f) {
            if (f.type === 'categorical') {
                const count = Math.max(2, f.levels ? f.levels.length : 2);
                return { min: 0, max: count - 1 };
            }
            const min = typeof f.min === 'number' && isFinite(f.min) ? f.min : 0;
            const max = typeof f.max === 'number' && isFinite(f.max) ? f.max : (min + 1);
            return { min: min, max: max <= min ? min + 1 : max };
        }

        window.activeCatFilter = null;

        function setCatFilter(level) {
            window.activeCatFilter = level;
            const respId = document.getElementById('response-select').value;
            updateCatFilterButtons();
            renderMainEffects(respId, window.activeCatFilter);
        }

        function setCatFilterIndex(idx) {
            const catFactor = project.factors.find(f => f.type === 'categorical');
            if (idx === null || idx === undefined || idx < 0 || !catFactor || !catFactor.levels || !catFactor.levels[idx]) {
                setCatFilter(null);
            } else {
                setCatFilter(catFactor.levels[idx]);
            }
        }

        function updateCatFilterButtons() {
            const catFactor = project.factors.find(f => f.type === 'categorical');
            const catFilterContainer = document.getElementById('main-effects-filter-container');
            if (!catFilterContainer) return;
            catFilterContainer.textContent = '';
            if (catFactor && catFactor.levels && catFactor.levels.length > 0) {
                const filterLabel = currentLang === 'zh' ? ('按 ' + catFactor.name + ' 筛选:') : ('Filter by ' + catFactor.name + ':');
                const allLabel = currentLang === 'zh' ? ('全部 ' + catFactor.name) : ('All ' + catFactor.name + 's');
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '6px';
                wrapper.style.flexWrap = 'wrap';

                const labelSpan = document.createElement('span');
                labelSpan.style.fontSize = '10px';
                labelSpan.style.fontWeight = '700';
                labelSpan.style.color = '#475569';
                labelSpan.style.textTransform = 'uppercase';
                labelSpan.textContent = filterLabel;
                wrapper.appendChild(labelSpan);

                const allBtn = document.createElement('button');
                allBtn.className = 'solvent-btn ' + (!window.activeCatFilter ? 'active' : '');
                allBtn.textContent = allLabel;
                allBtn.addEventListener('click', function() { setCatFilterIndex(-1); });
                wrapper.appendChild(allBtn);

                catFactor.levels.forEach((lvl, idx) => {
                    const isActive = window.activeCatFilter === lvl;
                    const btn = document.createElement('button');
                    btn.className = 'solvent-btn ' + (isActive ? 'active' : '');
                    btn.textContent = lvl;
                    btn.addEventListener('click', function() { setCatFilterIndex(idx); });
                    wrapper.appendChild(btn);
                });
                catFilterContainer.appendChild(wrapper);
            }
        }

        function renderMainEffects(respId, filterLvl) {
            const data = analysisData[respId];
            if (!data) return;

            const catFactor = project.factors.find(f => f.type === 'categorical');
            const validRuns = project.runs.filter(r => {
                const v = r.responses[respId];
                return v !== null && v !== undefined && String(v) !== '' && !isNaN(Number(v));
            });

            // If a specific categorical level filter is selected, filter continuous runs to that subset
            const targetRuns = (filterLvl && catFactor)
                ? validRuns.filter(r => matchesCat(r.factors[catFactor.id], filterLvl, catFactor.levels ? catFactor.levels.indexOf(filterLvl) : -1))
                : validRuns;

            const allAverages = [];
            const plotsToRender = [];

            project.factors.forEach((f, idx) => {
                const plotId = 'plot-main-effect-' + idx;
                if (f.type === 'categorical') {
                    const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
                    const ys = [];
                    levels.forEach((lvl, lIdx) => {
                        const matched = validRuns.filter(r => matchesCat(r.factors[f.id], lvl, lIdx));
                        if (matched.length > 0) {
                            const avg = matched.reduce((s, r) => s + Number(r.responses[respId]), 0) / matched.length;
                            ys.push(avg);
                            allAverages.push(avg);
                        } else {
                            ys.push(null);
                        }
                    });
                    plotsToRender.push({ id: plotId, factor: f, isCat: true, levels, ys });
                } else {
                    const midX = (f.min + f.max) / 2;
                    const halfRange = Math.abs(f.max - f.min) / 2;
                    let lowSum = 0, lowCount = 0;
                    let highSum = 0, highCount = 0;
                    let centerSum = 0, centerCount = 0;

                    targetRuns.forEach(r => {
                        const val = Number(r.factors[f.id]);
                        const resp = Number(r.responses[respId]);
                        if (halfRange > 1e-9 && Math.abs(val - midX) <= halfRange * 0.15) {
                            centerSum += resp; centerCount++;
                        } else if (val > midX + 1e-6) {
                            highSum += resp; highCount++;
                        } else if (val < midX - 1e-6) {
                            lowSum += resp; lowCount++;
                        }
                    });

                    const lowAvg = lowCount > 0 ? lowSum / lowCount : null;
                    const centerAvg = centerCount > 0 ? centerSum / centerCount : null;
                    const highAvg = highCount > 0 ? highSum / highCount : null;

                    const xs = [f.min];
                    const ys = [lowAvg];
                    if (lowAvg != null) allAverages.push(lowAvg);
                    if (centerAvg != null) {
                        xs.push(midX);
                        ys.push(centerAvg);
                        allAverages.push(centerAvg);
                    }
                    xs.push(f.max);
                    ys.push(highAvg);
                    if (highAvg != null) allAverages.push(highAvg);

                    plotsToRender.push({ id: plotId, factor: f, isCat: false, midX, xs, ys, lowAvg, centerAvg, highAvg });
                }
            });

            if (allAverages.length === 0) {
                document.getElementById('main-effects-container').innerHTML = '<p style="color: #64748b; margin-top: 8px;">' + (currentLang === 'zh' ? '暂无可用数据。' : 'No data available.') + '</p>';
                return;
            }

            const minAvg = Math.min(...allAverages);
            const maxAvg = Math.max(...allAverages);
            const yRange = maxAvg - minAvg;
            const yPadding = yRange === 0 ? 1 : yRange * 0.1;
            const yDomain = [minAvg - yPadding, maxAvg + yPadding];
            const tickRange = yDomain[1] - yDomain[0];
            const yTicks = [
                yDomain[0],
                yDomain[0] + tickRange * 0.25,
                yDomain[0] + tickRange * 0.5,
                yDomain[0] + tickRange * 0.75,
                yDomain[1]
            ];

            let htmlStr = '';
            plotsToRender.forEach(p => {
                const borderStyle = p.isCat ? 'border: 1px solid #e9d5ff; background: #faf5ff;' : 'border: 1px solid #f1f5f9; background: white;';
                htmlStr += '<div style="flex: 1; min-width: 210px; height: 260px; ' + borderStyle + ' border-radius: 6px; padding: 6px;"><div id="' + p.id + '" style="height: 100%;"></div></div>';
            });
            document.getElementById('main-effects-container').innerHTML = htmlStr;

            plotsToRender.forEach(p => {
                if (p.isCat) {
                    const trace = {
                        x: p.levels,
                        y: p.ys,
                        mode: 'lines+markers',
                        type: 'scatter',
                        name: p.factor.name,
                        line: { color: '#8b5cf6', width: 2.5 },
                        marker: { size: 9, color: '#8b5cf6' }
                    };
                    const factorTitle = escapeHtmlJS(p.factor.name) + ' ' + (currentLang === 'zh' ? '<span style="font-size:10px; color:#8b5cf6;">(分类变量)</span>' : '<span style="font-size:10px; color:#8b5cf6;">(Categorical)</span>');
                    Plotly.newPlot(p.id, [trace], {
                        title: { text: factorTitle, font: { size: 12, color: '#6b21a8' } },
                        margin: { t: 30, l: 45, r: 15, b: 35 },
                        xaxis: { type: 'category', zeroline: false },
                        yaxis: {
                            range: yDomain,
                            tickvals: yTicks,
                            tickformat: '.2f',
                            zeroline: false
                        },
                        showlegend: false
                    }, { displayModeBar: false });
                } else {
                    const xRange = Math.abs(p.factor.max - p.factor.min);
                    const xPadding = xRange === 0 ? 1 : xRange * 0.1;
                    const trace = {
                        x: p.xs,
                        y: p.ys,
                        mode: 'lines+markers',
                        type: 'scatter',
                        name: p.factor.name,
                        line: { color: '#82ca9d', width: 2.5 },
                        marker: { size: 8, color: 'white', line: { color: '#82ca9d', width: 2 } }
                    };
                    const factorTitle = escapeHtmlJS(p.factor.name) + (filterLvl ? ' (' + escapeHtmlJS(filterLvl) + ')' : '');
                    Plotly.newPlot(p.id, [trace], {
                        title: { text: factorTitle, font: { size: 12, color: '#334155' } },
                        margin: { t: 30, l: 45, r: 15, b: 35 },
                        xaxis: {
                            tickvals: [p.factor.min, p.midX, p.factor.max],
                            ticktext: [p.factor.min, p.midX, p.factor.max],
                            range: [p.factor.min - xPadding, p.factor.max + xPadding],
                            zeroline: false
                        },
                        yaxis: {
                            range: yDomain,
                            tickvals: yTicks,
                            tickformat: '.2f',
                            zeroline: false
                        },
                        showlegend: false,
                        shapes: [{ type: 'line', x0: p.midX, x1: p.midX, y0: yDomain[0], y1: yDomain[1], line: { color: '#94a3b8', dash: 'dash' } }]
                    }, { displayModeBar: false });
                }
            });
        }

        function populateSelects() {
            const selects = [
                document.getElementById('int-f1'),
                document.getElementById('int-f2'),
                document.getElementById('surf-x'),
                document.getElementById('surf-y')
            ];
            selects.forEach(sel => {
                if (!sel) return;
                sel.textContent = '';
                project.factors.forEach((f, i) => {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = f.name;
                    sel.appendChild(opt);
                });
            });
            
            if (project.factors.length > 1) {
                if (selects[1]) selects[1].selectedIndex = 1;
                if (selects[3]) selects[3].selectedIndex = 1;
            }
        }

        function updateView() {
            const respSelect = document.getElementById('response-select');
            if (!respSelect) return;
            const respId = respSelect.value;
            const data = analysisData[respId];
            if (!data) return;

            try {
                // Stats Cards
                const r2Label = currentLang === 'zh' ? 'R² 决定系数' : 'R²';
                const adjR2Label = currentLang === 'zh' ? '调整后 R²' : 'Adj R²';
                const rmseLabel = currentLang === 'zh' ? '均方根误差 (RMSE)' : 'RMSE';
                const pLabel = currentLang === 'zh' ? '模型显著性 p 值' : 'Model p-value';

                document.getElementById('stats-container').innerHTML = 
                    '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
                    '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">' + r2Label + '</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + (data.rSquared != null ? data.rSquared.toFixed(4) : '-') + '</div></div>' +
                    '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
                    '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">' + adjR2Label + '</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + (data.adjRSquared != null ? data.adjRSquared.toFixed(4) : '-') + '</div></div>' +
                    '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
                    '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">' + rmseLabel + '</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + (data.rmse != null ? data.rmse.toFixed(4) : '-') + '</div></div>' +
                    '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
                    '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">' + pLabel + '</div>' +
                    '<div class="text-lg font-bold text-slate-800">' + (data.modelPValue != null ? (data.modelPValue < 0.0001 ? "<0.0001" : data.modelPValue.toFixed(4)) : '—') + '</div></div>';

                // Main Effects Plot with Interactive Categorical Filter
                updateCatFilterButtons();
                renderMainEffects(respId, window.activeCatFilter);

                // Pareto Plot
                if (data.paretoData && data.paretoData.length > 0) {
                    const sortedPareto = [...data.paretoData].sort((a,b) => a.tRatio - b.tRatio);
                    const yNames = sortedPareto.map(d => d.factor ? d.factor.name : d.term || d.name);
                    const xValues = sortedPareto.map(d => d.tRatio);
                    const colors = sortedPareto.map(d => {
                        const isSig = d.tRatio > data.tLimitPareto;
                        return isSig ? (d.direction === 'Positive' ? '#2563eb' : '#dc2626') : (d.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                    });
                    
                    const paretoTrace = {
                        x: xValues,
                        y: yNames,
                        type: 'bar',
                        orientation: 'h',
                        marker: { color: colors }
                    };

                    const tVal = data.tLimitPareto || 0;
                    const bVal = data.bonferroniLimitPareto || 0;
                    const isClose = Math.abs(bVal - tVal) < 1.2;

                    const paretoTitle = currentLang === 'zh' ? 'Pareto 帕累托图 (标准化效应)' : 'Pareto (Standardized)';
                    const paretoXTitle = currentLang === 'zh' ? 't 比率 (t-Ratio)' : 't-Ratio';
                    const tLimitText = (currentLang === 'zh' ? 't 限值 (' : 't-Limit (') + (data.tLimitPareto ? data.tLimitPareto.toFixed(2) : '') + ')';
                    const bonfText = (currentLang === 'zh' ? 'Bonferroni 限值 (' : 'Bonferroni (') + (data.bonferroniLimitPareto ? data.bonferroniLimitPareto.toFixed(2) : '') + ')';

                    const paretoLayout = {
                        title: { text: paretoTitle, font: {size: 12} },
                        margin: { t: 60, l: 200, r: 35, b: 45 },
                        xaxis: { title: paretoXTitle, zeroline: false, automargin: true },
                        yaxis: { automargin: true },
                        shapes: [
                            { type: 'line', x0: data.tLimitPareto, x1: data.tLimitPareto, y0: -0.5, y1: yNames.length - 0.5, line: { color: '#16a34a', dash: 'dash', width: 2 } },
                            { type: 'line', x0: data.bonferroniLimitPareto, x1: data.bonferroniLimitPareto, y0: -0.5, y1: yNames.length - 0.5, line: { color: '#9333ea', dash: 'dash', width: 2 } }
                        ],
                        annotations: [
                            { 
                                x: data.tLimitPareto, 
                                y: 1, 
                                xref: 'x', 
                                yref: 'paper', 
                                text: tLimitText, 
                                showarrow: false, 
                                xanchor: isClose ? 'right' : 'center', 
                                yanchor: 'bottom', 
                                xshift: isClose ? -4 : 0,
                                yshift: 4, 
                                font: { color: '#16a34a', size: 10, weight: 600 } 
                            },
                            { 
                                x: data.bonferroniLimitPareto, 
                                y: 1, 
                                xref: 'x', 
                                yref: 'paper', 
                                text: bonfText, 
                                showarrow: false, 
                                xanchor: isClose ? 'left' : 'center', 
                                yanchor: 'bottom', 
                                xshift: isClose ? 4 : 0,
                                yshift: isClose ? 20 : 4, 
                                font: { color: '#9333ea', size: 10, weight: 600 } 
                            }
                        ]
                    };
                    Plotly.newPlot('plot-pareto', [paretoTrace], paretoLayout, {displayModeBar: false});
                }

                // Half-Normal Plot
                if (data.halfNormalData && data.halfNormalData.length > 0) {
                    const hnX = data.halfNormalData.map(d => d.expected);
                    const hnY = data.halfNormalData.map(d => d.tRatio);
                    const hnColors = data.halfNormalData.map(d => {
                        return d.significant ? (d.direction === 'Positive' ? '#2563eb' : '#dc2626') : (d.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                    });
                    const hnTexts = data.halfNormalData.map(d => d.term || d.name);

                    const hnScatter = {
                        x: hnY,
                        y: hnX,
                        mode: 'markers',
                        type: 'scatter',
                        text: hnTexts,
                        marker: { color: hnColors, size: 8, symbol: 'square', line: {color: '#000', width: 0.5} }
                    };
                    
                    const hnTitle = currentLang === 'zh' ? '半正态概率图 (Half-Normal)' : 'Half-Normal';
                    const hnXTitle = currentLang === 'zh' ? '|标准化效应值|' : '|Standardized Effect|';
                    const hnYTitle = currentLang === 'zh' ? '半正态累积概率 (%)' : 'Half-Normal % Probability';

                    const hnLayout = {
                        title: { text: hnTitle, font: {size: 12} },
                        margin: { t: 30, l: 40, r: 20, b: 40 },
                        xaxis: { title: hnXTitle, zeroline: false },
                        yaxis: { 
                            title: hnYTitle,
                            tickvals: [0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576],
                            ticktext: ['0', '20', '30', '50', '70', '80', '90', '95', '99'],
                            range: [-0.1, 2.7],
                            zeroline: false
                        }
                    };

                    if (data.halfNormalLine && data.halfNormalLine.length >= 2) {
                        hnLayout.shapes = [{
                            type: 'line',
                            x0: data.halfNormalLine[0].x,
                            y0: data.halfNormalLine[0].y,
                            x1: data.halfNormalLine[1].x,
                            y1: data.halfNormalLine[1].y,
                            line: { color: '#f87171', width: 2 }
                        }];
                    }

                    Plotly.newPlot('plot-half-normal', [hnScatter], hnLayout, {displayModeBar: false});
                }
                
                // Add legend and significance thresholds explanation
                const sigPos = currentLang === 'zh' ? '显著正效应 (正向促进)' : 'Significant (Positive)';
                const sigNeg = currentLang === 'zh' ? '显著负效应 (负向抑制)' : 'Significant (Negative)';
                const nsPos = currentLang === 'zh' ? '不显著 (正向)' : 'Not Significant (Positive)';
                const nsNeg = currentLang === 'zh' ? '不显著 (负向)' : 'Not Significant (Negative)';
                const threshTitle = currentLang === 'zh' ? '显著性阈值判定' : 'Significance Thresholds';
                const tLimitDesc = currentLang === 'zh' 
                    ? '<strong>t 限值 (' + (data.tLimitPareto ? data.tLimitPareto.toFixed(2) : '-') + '):</strong> 统计显著性的基准判定阈值 (通常 α = 0.05)。超出此绿色虚线的效应项对响应指标具有显著影响。'
                    : '<strong>t-Limit (' + (data.tLimitPareto ? data.tLimitPareto.toFixed(2) : '-') + '):</strong> The standard threshold for statistical significance (usually α = 0.05). Effects extending beyond this dashed green line have a meaningful impact on the response.';
                const bonfDesc = currentLang === 'zh'
                    ? '<strong>Bonferroni 联合控制限 (' + (data.bonferroniLimitPareto ? data.bonferroniLimitPareto.toFixed(2) : '-') + '):</strong> 针对多重假设检验校正的保守严格阈值。超出此紫色虚线的效应项达到极高显著水平。'
                    : '<strong>Bonferroni Limit (' + (data.bonferroniLimitPareto ? data.bonferroniLimitPareto.toFixed(2) : '-') + '):</strong> A stricter, conservative threshold that corrects for multiple testing. Effects extending beyond this dashed purple line are highly significant.';

                const legendHtml = '<div style="font-size: 10px; color: #64748b; margin-top: 16px;">' +
                    '<div style="display: flex; gap: 16px; justify-content: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; flex-wrap: wrap;">' +
                    '<div style="display: flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background: #2563eb; border: 1px solid rgba(0,0,0,0.1);"></div> ' + sigPos + '</div>' +
                    '<div style="display: flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background: #dc2626; border: 1px solid rgba(0,0,0,0.1);"></div> ' + sigNeg + '</div>' +
                    '<div style="display: flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background: #bae6fd; border: 1px solid rgba(0,0,0,0.1);"></div> ' + nsPos + '</div>' +
                    '<div style="display: flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background: #fecaca; border: 1px solid rgba(0,0,0,0.1);"></div> ' + nsNeg + '</div>' +
                    '</div>' +
                    '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">' +
                    '<h5 style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px;">' + threshTitle + '</h5>' +
                    '<div style="display: flex; flex-direction: column; gap: 8px; font-size: 11px; line-height: 1.5; color: #475569;">' +
                    '<div style="display: flex; align-items: flex-start; gap: 8px;"><div style="width: 8px; height: 8px; border-radius: 4px; background: #16a34a; margin-top: 4px; flex-shrink: 0;"></div><div>' + tLimitDesc + '</div></div>' +
                    '<div style="display: flex; align-items: flex-start; gap: 8px;"><div style="width: 8px; height: 8px; border-radius: 4px; background: #9333ea; margin-top: 4px; flex-shrink: 0;"></div><div>' + bonfDesc + '</div></div>' +
                    '</div></div></div>';
                document.getElementById('effects-legend').innerHTML = legendHtml;

                // 1. Effect Summary
                const thFactorSource = currentLang === 'zh' ? '因素 / 效应来源' : 'Factor / Source';
                const thLogWorth = currentLang === 'zh' ? 'LogWorth 显著性得分 [-log₁₀(p)]' : 'LogWorth <span style="font-size:9px;color:#94a3b8;">[-log₁₀(p)]</span>';
                const thPVal = currentLang === 'zh' ? 'p 值' : 'p-Value';

                let effSumHtml = '<table style="width: 100%;"><thead><tr><th style="white-space: nowrap;">' + thFactorSource + '</th><th style="white-space: nowrap;">' + thLogWorth + '</th><th class="col-pval">' + thPVal + '</th></tr></thead><tbody>';
                if (data.effectSummary) {
                    let activeEffects = data.effectSummary.filter(ef => !ef.isExcluded && !ef.isAliased);
                    let maxLw = Math.max(2.6, ...activeEffects.map(ef => ef.logworth || 0));
                    let maxScale = Math.ceil(maxLw * 1.2 * 10) / 10;
                    let thresholdPct = Math.min(85, Math.max(15, (1.30103 / maxScale) * 100));

                    activeEffects.forEach(ef => {
                        let isSig = ef.logworth >= 1.30103;
                        let pStr = ef.pVal < 0.0001 ? "< 0.0001" : ef.pVal.toFixed(4);
                        let pDisplay = isSig 
                            ? '<span class="badge-sig">' + pStr + '</span>'
                            : '<span class="badge-ns">' + pStr + '</span>';
                        let val = ef.logworth || 0;
                        let barPercent = Math.min(100, Math.max(0, (val / maxScale) * 100));
                        let baseWidth = Math.min(barPercent, thresholdPct);
                        let surplusWidth = Math.max(0, barPercent - thresholdPct);
                        
                        let surplusBar = isSig 
                            ? '<div style="height:100%; width:' + surplusWidth + '%; background:#059669;"></div>' 
                            : '';

                        effSumHtml += '<tr>' +
                            '<td style="font-weight:500; white-space:nowrap;">' + escapeHtmlJS(ef.name) + '</td>' +
                            '<td><div style="display:flex; align-items:center; gap:8px;"><span style="font-family:monospace; width:35px; text-align:right; font-size:10px; color:#475569;">' + (ef.logworth > 0 ? ef.logworth.toFixed(3) : '—') + '</span><div style="flex:1; background:#f1f5f9; height:8px; border-radius:3px; position:relative; overflow:hidden; border:1px solid #e2e8f0; display:flex;"><div style="height:100%; width:' + baseWidth + '%; background:#cbd5e1;"></div><div style="position:absolute; top:0; bottom:0; width:1px; background:#94a3b8; left:' + thresholdPct + '%; opacity:0.75;" title="' + (currentLang === 'zh' ? 'p = 0.05 阈值线' : 'p = 0.05 threshold') + '"></div>' + surplusBar + '</div></div></td>' +
                            '<td class="col-pval">' + pDisplay + '</td>' +
                            '</tr>';
                    });
                }
                effSumHtml += '</tbody></table>';
                document.getElementById('table-effect-summary').innerHTML = effSumHtml;

                // 2. Parameter Estimates
                const thTerm = currentLang === 'zh' ? '模型项' : 'Model Term';
                const thEst = currentLang === 'zh' ? '回归系数 (β)' : 'Estimate (β)';
                const thSE = currentLang === 'zh' ? '标准误差' : 'Std Error';
                const thTRatio = currentLang === 'zh' ? 't 比率' : 't Ratio';
                const interceptLabel = currentLang === 'zh' ? '<strong>截距项 (β₀)</strong>' : '<strong>Intercept (β₀)</strong>';

                let parmEstHtml = '<table style="width: 100%; min-width: 480px;"><thead><tr><th style="white-space: nowrap;">' + thTerm + '</th><th style="text-align:right; white-space:nowrap;">' + thEst + '</th><th style="text-align:right; white-space:nowrap;">' + thSE + '</th><th style="text-align:right; white-space:nowrap;">' + thTRatio + '</th><th class="col-pval">' + thPVal + '</th></tr></thead><tbody>';
                if (data.parameterEstimates) {
                    data.parameterEstimates.filter(pe => !pe.isAliased).forEach(pe => {
                        let isSig = pe.pVal !== undefined && pe.pVal !== null && pe.pVal <= 0.05;
                        let isIntercept = pe.term.toLowerCase().indexOf('intercept') !== -1;
                        let pStr = pe.pVal !== undefined && pe.pVal !== null ? (pe.pVal < 0.0001 ? "< 0.0001" : pe.pVal.toFixed(4)) : "—";
                        let pDisplay = isSig 
                            ? '<span class="badge-sig">' + pStr + '</span>'
                            : '<span class="badge-ns">' + pStr + '</span>';
                        let estStr = pe.estimate !== undefined && pe.estimate !== null ? (pe.estimate >= 0 ? '+' + pe.estimate.toFixed(5) : pe.estimate.toFixed(5)) : '—';
                        let seStr = pe.stdError !== undefined && pe.stdError !== null ? pe.stdError.toFixed(6) : '—';
                        let tStr = pe.tRatio !== undefined && pe.tRatio !== null ? pe.tRatio.toFixed(2) : '—';
                        let termDisplay = isIntercept ? interceptLabel : escapeHtmlJS(pe.term);
                        parmEstHtml += '<tr>' +
                            '<td style="white-space:nowrap;">' + termDisplay + '</td>' +
                            '<td style="text-align:right; font-family:monospace; font-weight:500; white-space:nowrap;">' + estStr + '</td>' +
                            '<td style="text-align:right; font-family:monospace; color:#64748b; white-space:nowrap;">' + seStr + '</td>' +
                            '<td style="text-align:right; font-family:monospace; font-weight:600; white-space:nowrap;">' + tStr + '</td>' +
                            '<td class="col-pval">' + pDisplay + '</td>' +
                            '</tr>';
                    });
                }
                parmEstHtml += '</tbody></table>';
                document.getElementById('table-parameter-estimates').innerHTML = parmEstHtml;

                // 3. Effect Tests
                const thEffSource = currentLang === 'zh' ? '效应来源' : 'Source';
                const thNparm = currentLang === 'zh' ? '参数数 (Nparm)' : 'Nparm';
                const thDF = currentLang === 'zh' ? '自由度 (DF)' : 'DF';
                const thSS = currentLang === 'zh' ? '离差平方和 (SS)' : 'Sum of Squares';
                const thFRatio = currentLang === 'zh' ? 'F 比率' : 'F Ratio';

                let effTestHtml = '<table style="width: 100%; min-width: 480px;"><thead><tr><th style="white-space: nowrap;">' + thEffSource + '</th><th style="text-align:right; white-space:nowrap;">' + thNparm + '</th><th style="text-align:right; white-space:nowrap;">' + thDF + '</th><th style="text-align:right; white-space:nowrap;">' + thSS + '</th><th style="text-align:right; white-space:nowrap;">' + thFRatio + '</th><th class="col-pval">' + thPVal + '</th></tr></thead><tbody>';
                if (data.effectSummary) {
                    data.effectSummary.filter(ef => !ef.isExcluded && !ef.isAliased).forEach(ef => {
                        let isSig = ef.pVal <= 0.05;
                        let pStr = ef.pVal < 0.0001 ? "< 0.0001" : ef.pVal.toFixed(4);
                        let pDisplay = isSig 
                            ? '<span class="badge-sig">' + pStr + '</span>'
                            : '<span class="badge-ns">' + pStr + '</span>';
                        effTestHtml += '<tr>' +
                            '<td style="font-weight:500; white-space:nowrap;">' + escapeHtmlJS(ef.name) + '</td>' +
                            '<td style="text-align:right; font-family:monospace; color:#64748b; white-space:nowrap;">' + (ef.nparm || ef.df || 1) + '</td>' +
                            '<td style="text-align:right; font-family:monospace; color:#64748b; white-space:nowrap;">' + (ef.df || 1) + '</td>' +
                            '<td style="text-align:right; font-family:monospace; white-space:nowrap;">' + ef.ss.toFixed(6) + '</td>' +
                            '<td style="text-align:right; font-family:monospace; font-weight:600; white-space:nowrap;">' + ef.fRatio.toFixed(4) + '</td>' +
                            '<td class="col-pval">' + pDisplay + '</td>' +
                            '</tr>';
                    });
                }
                effTestHtml += '</tbody></table>';
                document.getElementById('table-effect-tests').innerHTML = effTestHtml;

                // 4. Lack of Fit
                const thErrSource = currentLang === 'zh' ? '误差来源' : 'Error Source';
                const thMeanSquare = currentLang === 'zh' ? '均方 (MS)' : 'Mean Square';
                const lofLabel = currentLang === 'zh' ? '失拟项 (Lack of Fit)' : 'Lack of Fit';
                const pureErrLabel = currentLang === 'zh' ? '纯误差 <span style="font-size:10px; color:#94a3b8;">(重复试验)</span>' : 'Pure Error <span style="font-size:10px; color:#94a3b8;">(Replicates)</span>';
                const totalErrLabel = currentLang === 'zh' ? '总误差 <span style="font-size:10px; color:#94a3b8;">(残差)</span>' : 'Total Error <span style="font-size:10px; color:#94a3b8;">(Residual)</span>';

                let lofHtml = '';
                if (data.lackOfFit && typeof data.lackOfFit.df_lof !== 'undefined') {
                    let lof = data.lackOfFit;
                    let pVal = lof.p_lof;
                    let pDisplay = '-';
                    if (pVal !== null && typeof pVal !== 'undefined') {
                        let pStr = pVal < 0.0001 ? "< 0.0001" : pVal.toFixed(4);
                        if (pVal <= 0.05) {
                            pDisplay = '<span class="badge-warn">' + pStr + '</span>';
                        } else {
                            pDisplay = '<span class="badge-sig">' + pStr + '</span>';
                        }
                    }
                    let fRatioStr = lof.f_lof === Infinity || lof.f_lof === null ? 'Inf' : (typeof lof.f_lof !== 'undefined' ? lof.f_lof.toFixed(4) : '—');
                    let dfErr = Math.max(0, lof.df_error || 0);
                    let msErr = dfErr > 0 ? (lof.sse / dfErr).toFixed(6) : '—';
                    let noteText = (pVal !== null && pVal >= 0.05)
                        ? (currentLang === 'zh'
                            ? '<div style="margin-top:8px; padding:8px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; font-size:11px; color:#065f46;"><strong>✓ 拟合充分:</strong> 失拟检验不显著 (p = ' + (pVal !== null ? pVal.toFixed(4) : '') + ' &gt; 0.05)。当前模型结构能够充分描述试验数据，未见未建模的二次曲率迹象。</div>'
                            : '<div style="margin-top:8px; padding:8px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; font-size:11px; color:#065f46;"><strong>✓ Adequate Fit:</strong> Lack of Fit is not significant (p = ' + (pVal !== null ? pVal.toFixed(4) : '') + ' &gt; 0.05). The current model structure adequately represents the data without evidence of unaccounted curvature.</div>')
                        : (currentLang === 'zh'
                            ? '<div style="margin-top:8px; padding:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:11px; color:#92400e;"><strong>⚠ 注意:</strong> 失拟检验显著 (p = ' + (pVal !== null ? pVal.toFixed(4) : '') + ' ≤ 0.05)。表明可能存在未建模的二次非线性曲率或高阶交互作用。</div>'
                            : '<div style="margin-top:8px; padding:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:11px; color:#92400e;"><strong>⚠ Notice:</strong> Lack of Fit is statistically significant (p = ' + (pVal !== null ? pVal.toFixed(4) : '') + ' ≤ 0.05). Unmodeled curvature or higher-order interactions may be present.</div>');

                    lofHtml = '<table style="width: 100%; min-width: 480px;"><thead><tr><th style="white-space: nowrap;">' + thErrSource + '</th><th style="text-align:right; white-space:nowrap;">' + thDF + '</th><th style="text-align:right; white-space:nowrap;">' + thSS + '</th><th style="text-align:right; white-space:nowrap;">' + thMeanSquare + '</th><th style="text-align:right; white-space:nowrap;">' + thFRatio + '</th><th class="col-pval">' + thPVal + '</th></tr></thead><tbody>' +
                        '<tr><td style="font-weight:600; white-space:nowrap;">' + lofLabel + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.df_lof + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.ss_lof.toFixed(6) + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.ms_lof.toFixed(6) + '</td><td style="text-align:right; font-family:monospace; font-weight:600; white-space:nowrap;">' + fRatioStr + '</td><td class="col-pval">' + pDisplay + '</td></tr>' +
                        '<tr><td style="white-space:nowrap;">' + pureErrLabel + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.df_pure + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.ss_pure.toFixed(6) + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.ms_pure.toFixed(6) + '</td><td style="text-align:right; color:#94a3b8; white-space:nowrap;">—</td><td class="col-pval" style="color:#94a3b8;">—</td></tr>' +
                        '<tr style="background:#f8fafc;"><td style="font-weight:500; white-space:nowrap;">' + totalErrLabel + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + dfErr + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + lof.sse.toFixed(6) + '</td><td style="text-align:right; font-family:monospace; white-space:nowrap;">' + msErr + '</td><td style="text-align:right; color:#94a3b8; white-space:nowrap;">—</td><td class="col-pval" style="color:#94a3b8;">—</td></tr>' +
                        '</tbody></table>' + noteText;
                } else {
                    lofHtml = '<p style="color: #64748b; margin-top: 8px;">' + (currentLang === 'zh' ? '计算失拟检验的纯误差自由度需要包含重复试验运行。' : 'Replicate runs are required to compute Pure Error degrees of freedom for the Lack of Fit test.') + '</p>';
                }
                document.getElementById('table-lack-of-fit').innerHTML = lofHtml;

                // Actual by Predicted Plot
                if (data.actualByPredicted && data.actualByPredicted.length > 0) {
                    const actPred = data.actualByPredicted;
                    const actual = actPred.map(d => d.actual);
                    const pred = actPred.map(d => d.predicted);
                    const minVal = Math.min(...actual, ...pred);
                    const maxVal = Math.max(...actual, ...pred);
                    
                    const actPredXTitle = currentLang === 'zh' ? '模型预测值 (Predicted)' : 'Predicted';
                    const actPredYTitle = currentLang === 'zh' ? '实际测量值 (Actual)' : 'Actual';
                    const actPredDataName = currentLang === 'zh' ? '试验数据点' : 'Data';
                    const actPredFitName = currentLang === 'zh' ? '理想吻合线 (Y = X)' : 'Perfect Fit';

                    Plotly.newPlot('plot-actual-pred', [
                        { x: pred, y: actual, mode: 'markers', type: 'scatter', name: actPredDataName, marker: { color: '#0ea5e9' } },
                        { x: [minVal, maxVal], y: [minVal, maxVal], mode: 'lines', type: 'scatter', name: actPredFitName, line: { color: '#ef4444', dash: 'dash' } }
                    ], { margin: { t: 20, l: 40, r: 20, b: 40 }, xaxis: { title: actPredXTitle }, yaxis: { title: actPredYTitle }, showlegend: false });
                }

                // Studentized Residuals
                if (data.studentizedResiduals && data.studentizedResiduals.length > 0) {
                    const resid = data.studentizedResiduals;
                    const resX = resid.map(d => d.run);
                    const resY = resid.map(d => d.studentized);
                    const limit = resid[0]?.limit || 2.5;
                    const bonferroniLimit = resid[0]?.bonferroniLimit || limit + 1;
                    const maxAbsResid = Math.max(...resY.map(y => Math.abs(y || 0)));
                    const yMax = Math.max(bonferroniLimit + 0.5, maxAbsResid + 0.5, 4);

                    const residXTitle = currentLang === 'zh' ? '试验运行序 (Run Number)' : 'Run Number';
                    const residYTitle = currentLang === 'zh' ? '外学生化残差' : 'Studentized Residual';

                    Plotly.newPlot('plot-residuals', [
                        { x: resX, y: resY, mode: 'markers', type: 'scatter', marker: { color: '#1e293b' } }
                    ], {
                        margin: { t: 20, l: 60, r: 20, b: 40 },
                        xaxis: { title: residXTitle },
                        yaxis: { title: residYTitle, range: [-yMax, yMax] },
                        shapes: [
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: 0, y1: 0, line: { color: '#3b82f6' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: limit, y1: limit, line: { color: '#22c55e' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: -limit, y1: -limit, line: { color: '#22c55e' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: bonferroniLimit, y1: bonferroniLimit, line: { color: '#ef4444' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: -bonferroniLimit, y1: -bonferroniLimit, line: { color: '#ef4444' } }
                        ]
                    });
                }

                updateInteractionPlot();
                updateSurfacePlot();
            } catch (err) {
                console.error("Error updating view:", err);
            }
        }

        function updateInteractionPlot() {
            try {
                const respId = document.getElementById('response-select').value;
                const data = analysisData[respId];
                if (!data) return;

                const intF1El = document.getElementById('int-f1');
                const intF2El = document.getElementById('int-f2');
                if (!intF1El || !intF2El) return;

                const f1Idx = parseInt(intF1El.value) || 0;
                let f2Idx = parseInt(intF2El.value);
                if (isNaN(f2Idx) || f2Idx === f1Idx) {
                    f2Idx = project.factors.findIndex((f, idx) => idx !== f1Idx);
                    if (f2Idx < 0) f2Idx = 0;
                    intF2El.value = f2Idx;
                }

                const f1 = project.factors[f1Idx];
                const f2 = project.factors[f2Idx];
                if (!f1 || !f2) return;

                const validRuns = project.runs.filter(r => {
                    const v = r.responses[respId];
                    return v !== null && v !== undefined && String(v) !== '' && !isNaN(Number(v));
                });

                const colors = ['#0d89d1', '#3ab9a0', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
                const traces = [];

                // Configure lines for f2
                const f2IsCat = f2.type === 'categorical';
                const f2Levels = f2IsCat ? (f2.levels && f2.levels.length > 0 ? f2.levels : ['Level 1', 'Level 2']) : [];

                const f2Lines = [];
                if (f2IsCat) {
                    f2Levels.forEach((lvl, idx) => {
                        f2Lines.push({
                            name: f2.name + ' [' + lvl + ']',
                            color: colors[idx % colors.length],
                            filterFn: (r) => matchesCat(r.factors[f2.id], lvl, idx)
                        });
                    });
                } else {
                    const f2Mid = (f2.min + f2.max) / 2;
                    f2Lines.push({
                        name: f2.name + ' = ' + (currentLang === 'zh' ? '低水平 (' : 'Low (') + f2.min + ')',
                        color: '#0d89d1',
                        filterFn: (r) => Number(r.factors[f2.id]) <= f2Mid + 1e-6
                    });
                    f2Lines.push({
                        name: f2.name + ' = ' + (currentLang === 'zh' ? '高水平 (' : 'High (') + f2.max + ')',
                        color: '#3ab9a0',
                        filterFn: (r) => Number(r.factors[f2.id]) > f2Mid - 1e-6
                    });
                }

                const f1IsCat = f1.type === 'categorical';
                let xVals = [];
                let xTicks = [];
                let xTickLabels = [];

                if (f1IsCat) {
                    const f1Levels = f1.levels && f1.levels.length > 0 ? f1.levels : ['Level 1', 'Level 2'];
                    xVals = f1Levels;
                    f2Lines.forEach(line => {
                        const yVals = f1Levels.map((lvl, lIdx) => {
                            const matched = validRuns.filter(r => matchesCat(r.factors[f1.id], lvl, lIdx) && line.filterFn(r));
                            return matched.length > 0 ? matched.reduce((s, r) => s + Number(r.responses[respId]), 0) / matched.length : null;
                        });
                        traces.push({
                            x: xVals,
                            y: yVals,
                            mode: 'lines+markers',
                            type: 'scatter',
                            name: line.name,
                            line: { color: line.color, width: 2.5 },
                            marker: { size: 7, color: line.color }
                        });
                    });
                } else {
                    const f1Mid = (f1.min + f1.max) / 2;
                    xVals = [f1.min, f1.max];
                    xTicks = [f1.min, f1Mid, f1.max];
                    xTickLabels = [f1.min.toString(), f1Mid.toString(), f1.max.toString()];

                    f2Lines.forEach(line => {
                        const lowRuns = validRuns.filter(r => Number(r.factors[f1.id]) <= f1Mid + 1e-6 && line.filterFn(r));
                        const highRuns = validRuns.filter(r => Number(r.factors[f1.id]) > f1Mid - 1e-6 && line.filterFn(r));
                        const yLow = lowRuns.length > 0 ? lowRuns.reduce((s, r) => s + Number(r.responses[respId]), 0) / lowRuns.length : null;
                        const yHigh = highRuns.length > 0 ? highRuns.reduce((s, r) => s + Number(r.responses[respId]), 0) / highRuns.length : null;

                        traces.push({
                            x: xVals,
                            y: [yLow, yHigh],
                            mode: 'lines+markers',
                            type: 'scatter',
                            name: line.name,
                            line: { color: line.color, width: 2.5 },
                            marker: { size: 7, color: line.color }
                        });
                    });
                }

                const intYTitle = currentLang === 'zh' ? '实际响应均值' : 'Actual Response Means';
                const layout = {
                    margin: { t: 25, l: 45, r: 25, b: 45 },
                    xaxis: f1IsCat ? {
                        title: f1.name,
                        type: 'category',
                        categoryorder: 'array',
                        categoryarray: xVals,
                        zeroline: false
                    } : {
                        title: f1.name,
                        tickvals: xTicks,
                        ticktext: xTickLabels,
                        zeroline: false
                    },
                    yaxis: { title: intYTitle, zeroline: false },
                    legend: { orientation: 'h', y: -0.25, x: 0 }
                };

                Plotly.newPlot('plot-interaction', traces, layout, { displayModeBar: false });
            } catch (err) {
                console.error("Error updating interaction plot:", err);
            }
        }

        function updateSurfacePlot() {
            try {
                const respId = document.getElementById('response-select').value;
                const data = analysisData[respId];
                if (!data) return;

                const typeEl = document.getElementById('surf-type');
                const surfXEl = document.getElementById('surf-x');
                const surfYEl = document.getElementById('surf-y');
                if (!typeEl || !surfXEl || !surfYEl) return;

                const type = typeEl.value;
                const f1Idx = parseInt(surfXEl.value) || 0;
                let f2Idx = parseInt(surfYEl.value);
                if (isNaN(f2Idx) || f2Idx === f1Idx) {
                    f2Idx = project.factors.findIndex((f, idx) => idx !== f1Idx);
                    if (f2Idx < 0) f2Idx = 0;
                    surfYEl.value = f2Idx;
                }

                const f1 = project.factors[f1Idx];
                const f2 = project.factors[f2Idx];
                if (!f1 || !f2) return;

                const validRuns = project.runs.filter(r => {
                    const v = r.responses[respId];
                    return v !== null && v !== undefined && String(v) !== '' && !isNaN(Number(v));
                });
                
                if (validRuns.length === 0) return;

                const xBounds = getFactorBounds(f1);
                const yBounds = getFactorBounds(f2);

                const directKey = f1.id + '__' + f2.id;
                const reverseKey = f2.id + '__' + f1.id;
                const precomputed = data && data.surfaceGrids ? data.surfaceGrids[directKey] : null;
                const reversedPrecomputed = !precomputed && data && data.surfaceGrids ? data.surfaceGrids[reverseKey] : null;

                let gridX = [];
                let gridY = [];
                let zGrid = [];
                let minZ = Infinity;
                let maxZ = -Infinity;

                if (precomputed) {
                    gridX = precomputed.gridX;
                    gridY = precomputed.gridY;
                    zGrid = precomputed.zGrid;
                    minZ = precomputed.minZ;
                    maxZ = precomputed.maxZ;
                } else if (reversedPrecomputed) {
                    gridX = reversedPrecomputed.gridY;
                    gridY = reversedPrecomputed.gridX;
                    zGrid = reversedPrecomputed.gridY.map((_, rowIdx) =>
                        reversedPrecomputed.gridX.map((__, colIdx) => reversedPrecomputed.zGrid[colIdx][rowIdx])
                    );
                    minZ = reversedPrecomputed.minZ;
                    maxZ = reversedPrecomputed.maxZ;
                } else {
                    const meanY = validRuns.reduce((s, r) => s + Number(r.responses[respId]), 0) / validRuns.length;
                    gridX = [xBounds.min, xBounds.max];
                    gridY = [yBounds.min, yBounds.max];
                    zGrid = [[meanY, meanY], [meanY, meanY]];
                    minZ = meanY;
                    maxZ = meanY;
                }

                if (!isFinite(minZ) || !isFinite(maxZ)) { minZ = 0; maxZ = 1; }
                if (minZ === maxZ) { minZ -= 1; maxZ += 1; }

                const resp = project.responses.find(r => r.id === respId);
                const respTitle = resp ? (resp.name + (resp.unit ? ' (' + resp.unit + ')' : '')) : (currentLang === 'zh' ? '响应值' : 'Response');

                Plotly.purge('plot-surface');

                if (type === 'scatter3d') {
                    const xVals = validRuns.map(r => getFactorNumeric(f1, r.factors[f1.id]));
                    const yVals = validRuns.map(r => getFactorNumeric(f2, r.factors[f2.id]));
                    const zVals = validRuns.map(r => Number(r.responses[respId]));

                    Plotly.newPlot('plot-surface', [{
                        x: xVals,
                        y: yVals,
                        z: zVals,
                        type: 'scatter3d',
                        mode: 'markers',
                        marker: { size: 8, color: zVals, colorscale: 'Viridis', opacity: 0.8 }
                    }], {
                        margin: { t: 20, l: 0, r: 0, b: 0 },
                        scene: {
                            xaxis: {
                                title: f1.name,
                                range: [xBounds.min, xBounds.max],
                                ...(f1.type === 'categorical' && f1.levels ? {
                                    tickmode: 'array',
                                    tickvals: f1.levels.map((_, i) => i),
                                    ticktext: f1.levels
                                } : {})
                            },
                            yaxis: {
                                title: f2.name,
                                range: [yBounds.min, yBounds.max],
                                ...(f2.type === 'categorical' && f2.levels ? {
                                    tickmode: 'array',
                                    tickvals: f2.levels.map((_, i) => i),
                                    ticktext: f2.levels
                                } : {})
                            },
                            zaxis: { title: respTitle }
                        }
                    });
                } else if (type === 'mesh3d') {
                    const zSpan = maxZ - minZ;
                    const zFloor = minZ - (zSpan > 0 ? zSpan * 0.12 : 0.5);
                    const zCeil = maxZ + (zSpan > 0 ? zSpan * 0.04 : 0.5);
                    Plotly.newPlot('plot-surface', [{
                        x: gridX,
                        y: gridY,
                        z: zGrid,
                        type: 'surface',
                        colorscale: 'Viridis',
                        cmin: minZ,
                        cmax: maxZ,
                        opacity: 1,
                        contours: { z: { show: true, usecolormap: false, project: { z: true } } }
                    }], {
                        margin: { t: 20, l: 0, r: 0, b: 0 },
                        scene: {
                            xaxis: {
                                title: f1.name,
                                range: [xBounds.min, xBounds.max],
                                ...(f1.type === 'categorical' && f1.levels ? {
                                    tickmode: 'array',
                                    tickvals: f1.levels.map((_, i) => i),
                                    ticktext: f1.levels
                                } : {})
                            },
                            yaxis: {
                                title: f2.name,
                                range: [yBounds.min, yBounds.max],
                                ...(f2.type === 'categorical' && f2.levels ? {
                                    tickmode: 'array',
                                    tickvals: f2.levels.map((_, i) => i),
                                    ticktext: f2.levels
                                } : {})
                            },
                            zaxis: { 
                                title: respTitle,
                                range: [zFloor, zCeil]
                            }
                        }
                    });
                } else {
                    Plotly.newPlot('plot-surface', [{
                        x: gridX,
                        y: gridY,
                        z: zGrid,
                        type: 'contour',
                        colorscale: 'Viridis'
                    }], {
                        margin: { t: 20, l: 45, r: 20, b: 40 },
                        xaxis: {
                            title: f1.name,
                            range: [xBounds.min, xBounds.max],
                            ...(f1.type === 'categorical' && f1.levels ? {
                                tickmode: 'array',
                                tickvals: f1.levels.map((_, i) => i),
                                ticktext: f1.levels
                            } : {})
                        },
                        yaxis: {
                            title: f2.name,
                            range: [yBounds.min, yBounds.max],
                            ...(f2.type === 'categorical' && f2.levels ? {
                                tickmode: 'array',
                                tickvals: f2.levels.map((_, i) => i),
                                ticktext: f2.levels
                            } : {})
                        }
                    });
                }
            } catch (err) {
                console.error("Error updating surface plot:", err);
            }
        }

        // Initialize
        try {
            populateSelects();
            if ('${safeLocale}' === 'zh') {
                setReportLanguage('zh');
            } else {
                updateView();
            }
        } catch (err) {
            console.error("Error initializing:", err);
        }
    </script>
</body>
</html>`;

  return html;
}
