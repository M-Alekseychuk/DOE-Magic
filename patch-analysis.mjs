import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// We will add excludedTerms state
code = code.replace(
  "const [effectsPlotType, setEffectsPlotType] = useState<'pareto' | 'half-normal'>('pareto');",
  "const [effectsPlotType, setEffectsPlotType] = useState<'pareto' | 'half-normal'>('pareto');\n  const [excludedTerms, setExcludedTerms] = useState<string[]>([]);"
);

// We need to change the dependency array of analysisResults to include excludedTerms
code = code.replace(
  "  }, [project, hasData, activeResponse, effectsLevelFilter]);",
  "  }, [project, hasData, activeResponse, effectsLevelFilter, excludedTerms]);"
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
