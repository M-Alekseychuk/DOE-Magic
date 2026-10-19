const fs = require('fs');
let content = fs.readFileSync('src/pages/ProjectView.tsx', 'utf8');

// Replace handleExportExcel
const excelStart = content.indexOf('const handleExportExcel = () => {');
const excelEnd = content.indexOf('  const handleExportPDF = () => {');
let excelCode = `  const handleExportExcel = () => {
    import('xlsx-js-style').then(({ utils, writeFile }) => {
      const designTypeNames: Record<string, string> = {
        'factorial_2level': 'Two-Level Factorial Design',
        'dsd': 'Definitive Screening Design (DSD)',
        'ccd': 'Central Composite Design (CCD)',
        'bbd': 'Box-Behnken Design (BBD)',
        'plackett_burman': 'Plackett-Burman Design (PB)'
      };
      
      const boldStyle = { font: { bold: true } };
      const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
      const headerBorder = { bottom: { style: 'medium', color: { rgb: '000000' } } };
      
      const setupData: any[][] = [
        [{ v: 'Experiment Name:', s: boldStyle }, project.name],
        [{ v: 'Description:', s: boldStyle }, project.description || ''],
        [{ v: 'Design Type:', s: boldStyle }, designTypeNames[project.designType || 'factorial_2level'] || 'Not specified'],
        [],
        [{ v: 'Factors', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } } }, '', '', '', ''],
        [],
        [
          { v: 'Name', s: { font: { bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: headerBorder } },
          { v: 'Type', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
          { v: 'Min', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
          { v: 'Max', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } },
          { v: 'Unit', s: { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: headerBorder } }
        ]
      ];
      
      project.factors.forEach(f => {
        setupData.push([
          f.name,
          { v: f.type, s: centerStyle },
          { v: f.min, s: centerStyle },
          { v: f.max, s: centerStyle },
          { v: f.unit || '', s: centerStyle }
        ]);
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
      const responsesHeaderRowIndex = 4 + 1 + 1 + 1 + project.factors.length + 1;
      
      setupWs['!merges'] = [
        { s: { r: factorsHeaderRowIndex, c: 0 }, e: { r: factorsHeaderRowIndex, c: 4 } },
        { s: { r: responsesHeaderRowIndex, c: 0 }, e: { r: responsesHeaderRowIndex, c: 2 } }
      ];
      
      setupWs['!cols'] = [
        { wch: Math.max(20, ...project.factors.map(f => f.name.length), ...project.responses.map(res => res.name.length)) + 2 },
        { wch: Math.max(25, project.name.length, project.description.length, 20) },
        { wch: 12 },
        { wch: 12 },
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
          const val = run.factors[f.id];
          if (val === undefined || val === null || val === '') return { v: '', s: centerStyle };
          return { v: Number(val), s: centerStyle };
        });
        const rvals = project.responses.map(r => {
          const val = run.responses[r.id];
          if (val === undefined || val === null || val === ('' as any)) return { v: '', s: centerStyle };
          return { v: Number(val), s: centerStyle };
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
      runWs['!cols'] = runHeaders.map(h => ({ wch: Math.max(14, h.length + 4) }));

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
          return pval < 0.0001 ? '<.0001*' : (pval <= 0.05 ? pval.toFixed(4) + '*' : pval.toFixed(4));
        };
        const pvalStyle = (pval: number) => {
          if (pval <= 0.05) return { font: { color: { rgb: 'B91C1C' } }, alignment: { horizontal: 'right' } };
          return { alignment: { horizontal: 'right' } };
        };
        
        wsData.push([{ v: \`Analysis for \${res.name}\`, s: { font: { bold: true, sz: 14 } } }]);
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
            { v: formatNumber(ef.logWorth, 3), s: { alignment: { horizontal: 'right' }, font: { strike: ef.isExcluded, color: ef.isExcluded ? {rgb: '94A3B8'} : {rgb: '000000'} } } },
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
            { v: formatNumber(lof.ss_error, 6), s: { alignment: { horizontal: 'right' } } },
            '', '', ''
          ]);
        }
        
        let anWs = utils.aoa_to_sheet(wsData);
        anWs['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        let sheetName = res.name.substring(0, 25) + ' Analysis';
        utils.book_append_sheet(wb, anWs, sheetName);
      });
      
      writeFile(wb, \`DOE_Experiment_\${project.name.replace(/\\s+/g, '_')}.xlsx\`);
    });
  };
`
content = content.substring(0, excelStart) + excelCode + content.substring(excelEnd);
fs.writeFileSync('src/pages/ProjectView.tsx', content);
