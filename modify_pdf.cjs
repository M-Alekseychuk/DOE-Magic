const fs = require('fs');
let content = fs.readFileSync('src/pages/ProjectView.tsx', 'utf8');

const pdfStart = content.indexOf('    // Design / Runs');
const pdfEnd = content.indexOf('    doc.save(`DOE_Experiment_${project.name.replace(/\\s+/g, \'_\')}.pdf`);');

let newPdfCode = `
    // Design / Runs
    doc.addPage();
    doc.text('Design Matrix & Results', 14, 20);
    const runHeaders = ['Run', 'Pattern', ...project.factors.map(f=>f.name), ...project.responses.map(r=>r.name)];
    const runData = project.runs.map(run => {
      const pattern = getRunPattern(run, project.factors);
      const fvals = project.factors.map(f => (run.factors[f.id] !== undefined && run.factors[f.id] !== null) ? run.factors[f.id] : '');
      const rvals = project.responses.map(r => (run.responses[r.id] !== undefined && run.responses[r.id] !== null) ? run.responses[r.id] : '');
      return [run.runOrder, pattern, ...fvals, ...rvals];
    });
    autoTable(doc, { startY: 25, head: [runHeaders], body: runData });

    // Analysis for each response
    project.responses.forEach(res => {
      const analysis = computeAnalysis(project, res, res.excludedTerms || [], res.goal, res.targetValue);
      if (!analysis || !analysis.effectSummary) return;

      doc.addPage();
      doc.text(\`Analysis for \${res.name}\`, 14, 20);

      let currentY = 25;
      const formatNumber = (num) => isNaN(num) || num === null || num === undefined ? '' : Number(num.toFixed(5));
      const formatPVal = (pval) => {
        if (pval === undefined || pval === null || isNaN(pval)) return '';
        return pval < 0.0001 ? '<.0001*' : (pval <= 0.05 ? pval.toFixed(4) + '*' : pval.toFixed(4));
      };

      // Effect Summary
      doc.setFontSize(10);
      doc.text('Effect Summary', 14, currentY + 5);
      
      const effectSummaryData = analysis.effectSummary.map(ef => [
        ef.name + (ef.isExcluded ? ' (Excluded)' : '') + (ef.isAliased ? ' (Aliased)' : ''),
        ef.isExcluded ? 'Excluded' : 'Active',
        formatNumber(ef.logWorth, 3),
        formatPVal(ef.pVal)
      ]);
      
      autoTable(doc, {
        startY: currentY + 8,
        head: [['Source', 'Status', 'LogWorth', 'PValue']],
        body: effectSummaryData,
        headStyles: { fillColor: [71, 85, 105] }
      });
      currentY = doc.lastAutoTable.finalY + 5;

      // Parameter Estimates
      if (analysis.parameterEstimates) {
        doc.text('Parameter Estimates', 14, currentY + 5);
        const paramData = analysis.parameterEstimates.filter(pe => !pe.isAliased).map(pe => [
          pe.term,
          formatNumber(pe.estimate, 5),
          formatNumber(pe.stdError, 5),
          formatNumber(pe.tRatio, 2),
          formatPVal(pe.pVal)
        ]);
        autoTable(doc, {
          startY: currentY + 8,
          head: [['Term', 'Estimate', 'Std Error', 't Ratio', 'Prob>|t|']],
          body: paramData,
          headStyles: { fillColor: [71, 85, 105] }
        });
        currentY = doc.lastAutoTable.finalY + 5;
      }

      // Effect Tests
      if (analysis.effectSummary) {
        doc.text('Effect Tests', 14, currentY + 5);
        const effectTestsData = analysis.effectSummary.filter(ef => !ef.isExcluded && !ef.isAliased).map(ef => [
          ef.name,
          1,
          1,
          formatNumber(ef.ss, 6),
          formatNumber(ef.fRatio, 4),
          formatPVal(ef.pVal)
        ]);
        autoTable(doc, {
          startY: currentY + 8,
          head: [['Source', 'Nparm', 'DF', 'Sum of Squares', 'F Ratio', 'Prob > F']],
          body: effectTestsData,
          headStyles: { fillColor: [71, 85, 105] }
        });
        currentY = doc.lastAutoTable.finalY + 5;
      }

      // Lack Of Fit
      if (analysis.lackOfFit && analysis.lackOfFit.df_lof > 0) {
        doc.text('Lack Of Fit', 14, currentY + 5);
        const lof = analysis.lackOfFit;
        const lofData = [
          ['Lack Of Fit', lof.df_lof, formatNumber(lof.ss_lof, 6), formatNumber(lof.ms_lof, 6), lof.f_lof === Infinity ? 'Inf' : formatNumber(lof.f_lof, 4), formatPVal(lof.p_lof)],
          ['Pure Error', lof.df_pure, formatNumber(lof.ss_pure, 6), formatNumber(lof.ms_pure, 6), '', ''],
          ['Total Error', lof.df_error, formatNumber(lof.ss_error, 6), '', '', '']
        ];
        autoTable(doc, {
          startY: currentY + 8,
          head: [['Source', 'DF', 'Sum of Squares', 'Mean Square', 'F Ratio', 'Prob > F']],
          body: lofData,
          headStyles: { fillColor: [71, 85, 105] }
        });
      }
      doc.setFontSize(12);
    });
`;

content = content.substring(0, pdfStart) + newPdfCode + content.substring(pdfEnd);
fs.writeFileSync('src/pages/ProjectView.tsx', content);
