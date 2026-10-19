const fs = require('fs');

let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

// 1. Update the useMemo for models to calculate all models
const modelMemoStart = content.indexOf('  const model = useMemo(() => {');
const modelMemoEnd = content.indexOf('  }, [project, activeResponse]);') + 32;

const newModelMemo = `
  const allModels = useMemo(() => {
    return project.responses.reduce((acc, r) => {
      acc[r.id] = computeAnalysis(project, r, r.excludedTerms || [], r.goal, r.targetValue);
      return acc;
    }, {} as Record<string, any>);
  }, [project]);
`;
content = content.substring(0, modelMemoStart) + newModelMemo + content.substring(modelMemoEnd);

// 2. Add 'joint' to the select dropdown
content = content.replace(
  '<option key={r.id} value={r.id}>{r.name}</option>',
  '<option key={r.id} value={r.id}>{r.name}</option>\n              ))}\n              <option value="joint">All Responses (Joint Defect Rate)</option>'
);
// fix the above replace since it replaces inside a map...
content = content.replace(
  '{project.responses.map(r => (\n                <option key={r.id} value={r.id}>{r.name}</option>\n              ))}',
  '{project.responses.map(r => (\n                <option key={r.id} value={r.id}>{r.name}</option>\n              ))}\n              <option value="joint" className="font-bold">All Responses (Joint Defect Rate)</option>'
);

// 3. Update the runSimulation function
const runSimStart = content.indexOf('  const runSimulation = () => {');
const runSimEnd = content.indexOf('  if (!project.responses.length || !project.factors.length) {');

const newRunSim = `  const runSimulation = () => {
    const isJoint = selectedResponseId === 'joint';
    const runsCount = numSimulations.trim() === '' ? 0 : (parseInt(numSimulations, 10) || 0);
    if (runsCount <= 0) {
      setErrorMessage('Please enter at least 1 simulation run (recommended: 5,000 – 10,000).');
      return;
    }
    
    if (!isJoint && !activeResponse) return;
    
    setErrorMessage(null);

    const boxMuller = () => {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2.0 * Math.log(u1 || 1e-9)) * Math.cos(2.0 * Math.PI * u2);
    };

    if (isJoint) {
      const resultsByResponse: Record<string, number[]> = {};
      project.responses.forEach(r => resultsByResponse[r.id] = []);
      const individualOOS: Record<string, any> = {};
      project.responses.forEach(r => individualOOS[r.id] = { outOfSpecCount: 0, belowLSL: 0, aboveUSL: 0 });
      let jointOutOfSpec = 0;

      for (let i = 0; i < runsCount; i++) {
         const simSettings: Record<string, number> = {};
         project.factors.forEach(f => {
            const nomStr = nominalSettings[f.id];
            const nominal = (nomStr === '' || nomStr === undefined || isNaN(Number(nomStr))) ? 0 : Number(nomStr);
            const sdStr = standardDeviations[f.id];
            const sd = (sdStr === '' || sdStr === undefined || isNaN(Number(sdStr))) ? 0 : Math.max(0, Number(sdStr));
            simSettings[f.id] = nominal + boxMuller() * sd;
         });
         
         let runFailed = false;
         project.responses.forEach(r => {
            const val = predictAt(simSettings, allModels[r.id]);
            resultsByResponse[r.id].push(val);
            
            const lslStr = specLimits[r.id]?.lsl;
            const uslStr = specLimits[r.id]?.usl;
            const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
            const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
            const lsl = hasLsl ? Number(lslStr) : null;
            const usl = hasUsl ? Number(uslStr) : null;
            
            let failedResp = false;
            if (lsl !== null && val < lsl) { individualOOS[r.id].outOfSpecCount++; individualOOS[r.id].belowLSL++; failedResp = true; }
            if (usl !== null && val > usl) { individualOOS[r.id].outOfSpecCount++; individualOOS[r.id].aboveUSL++; failedResp = true; }
            
            if (failedResp) runFailed = true;
         });
         
         if (runFailed) jointOutOfSpec++;
      }

      const individualStats: Record<string, any> = {};
      project.responses.forEach(r => {
         const results = resultsByResponse[r.id];
         results.sort((a,b) => a-b);
         const mean = results.reduce((a,b) => a+b, 0) / runsCount;
         const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runsCount;
         const sd = Math.sqrt(variance);
         
         const lslStr = specLimits[r.id]?.lsl;
         const uslStr = specLimits[r.id]?.usl;
         const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
         const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
         
         individualStats[r.id] = {
           mean, sd,
           defectRate: (individualOOS[r.id].outOfSpecCount / runsCount) * 100,
           belowLSL: individualOOS[r.id].belowLSL,
           aboveUSL: individualOOS[r.id].aboveUSL,
           lsl: hasLsl ? Number(lslStr) : null,
           usl: hasUsl ? Number(uslStr) : null
         };
      });

      setSimulationResults({
         isJoint: true,
         runsCount,
         defectRate: (jointOutOfSpec / runsCount) * 100,
         jointOutOfSpec,
         individualStats
      });

    } else {
      const results = [];
      const singleModel = allModels[activeResponse!.id];
      for (let i = 0; i < runsCount; i++) {
        const simSettings: Record<string, number> = {};
        project.factors.forEach(f => {
          const nomStr = nominalSettings[f.id];
          const nominal = (nomStr === '' || nomStr === undefined || isNaN(Number(nomStr))) ? 0 : Number(nomStr);
          const sdStr = standardDeviations[f.id];
          const sd = (sdStr === '' || sdStr === undefined || isNaN(Number(sdStr))) ? 0 : Math.max(0, Number(sdStr));
          simSettings[f.id] = nominal + boxMuller() * sd;
        });
        results.push(predictAt(simSettings, singleModel));
      }

      results.sort((a, b) => a - b);

      const mean = results.reduce((a, b) => a + b, 0) / runsCount;
      const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runsCount;
      const sd = Math.sqrt(variance);

      const lslStr = specLimits[activeResponse!.id]?.lsl;
      const uslStr = specLimits[activeResponse!.id]?.usl;
      const hasLsl = lslStr !== '' && lslStr !== undefined && !isNaN(Number(lslStr));
      const hasUsl = uslStr !== '' && uslStr !== undefined && !isNaN(Number(uslStr));
      const lsl = hasLsl ? Number(lslStr) : null;
      const usl = hasUsl ? Number(uslStr) : null;

      let outOfSpecCount = 0;
      let belowLSL = 0;
      let aboveUSL = 0;

      results.forEach(val => {
        if (lsl !== null && val < lsl) {
          outOfSpecCount++;
          belowLSL++;
        }
        if (usl !== null && val > usl) {
          outOfSpecCount++;
          aboveUSL++;
        }
      });

      const defectRate = (outOfSpecCount / runsCount) * 100;

      const bins = 40;
      const minVal = results[0];
      const maxVal = results[results.length - 1];
      const binWidth = (maxVal - minVal) / bins || 1;
      const histogram = Array.from({ length: bins }, (_, i) => ({
        x0: minVal + i * binWidth,
        x1: minVal + (i + 1) * binWidth,
        mid: minVal + (i + 0.5) * binWidth,
        count: 0
      }));

      results.forEach(val => {
        const binIdx = Math.min(Math.floor((val - minVal) / binWidth), bins - 1);
        if (histogram[binIdx]) {
          histogram[binIdx].count++;
        }
      });

      setSimulationResults({
        isJoint: false,
        mean,
        sd,
        defectRate,
        belowLSL,
        aboveUSL,
        histogram,
        lsl,
        usl,
      });
    }
  };

`;
content = content.substring(0, runSimStart) + newRunSim + content.substring(runSimEnd);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
