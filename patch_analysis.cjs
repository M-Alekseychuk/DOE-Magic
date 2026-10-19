const fs = require('fs');

let pa = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// We need to add allAnalysisResults computation just after analysisResults
const allAnalysisResultsStr = `
  const allAnalysisResults = useMemo(() => {
    if (!hasData) return [];
    return project.responses.map(resp => {
      // For responses other than active, we use default goal and target, and NO excluded terms 
      // (a real app would track excluded terms per response, but for now we just use full models)
      const isAct = resp.id === activeResponseId;
      const ex = isAct ? excludedTerms : [];
      const goal = isAct && customOptConfig.goal ? customOptConfig.goal : resp.goal;
      const target = isAct && customOptConfig.targetValue !== '' ? Number(customOptConfig.targetValue) : resp.targetValue;
      return computeAnalysis(project, resp, ex, goal, target);
    }).filter(r => r !== null);
  }, [project, hasData, activeResponseId, excludedTerms, customOptConfig]);
`;

pa = pa.replace(
  '  const analysisResults = useMemo(() => {',
  allAnalysisResultsStr + '\n  const analysisResults = useMemo(() => {'
);

pa = pa.replace(
  '<PredictionProfiler project={project} analysisResults={analysisResults} />',
  '<PredictionProfiler project={project} allAnalysisResults={allAnalysisResults} />'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', pa);
