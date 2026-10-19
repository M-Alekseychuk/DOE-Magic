import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

const targetStr = `
  // Filter out points too close to existing runs
  const threshold = 0.1; // in normalized distance
  const novelCandidates = candidates.filter(c => c.uncertainty > threshold);
  
  // Pick top N diverse candidates
  const bestCandidates: typeof candidates = [];
  for (const c of novelCandidates) {
    if (bestCandidates.length >= numSuggestions) break;
    let tooClose = false;
    for (const b of bestCandidates) {
      let dSq = 0;
      for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - b.x[j], 2);
      if (Math.sqrt(dSq) < 0.25) { tooClose = true; break; }
    }
    if (!tooClose) bestCandidates.push(c);
  }
  
  if (bestCandidates.length === 0) bestCandidates.push(...candidates.slice(0, numSuggestions)); // fallback

  let md = \`### Local Bayesian Parameter Optimization Results\\n\\n\`;
  md += \`Analysis completed for response **\${activeResponse.name}** (Goal: \${activeResponse.goal}).\\n\\n\`;
  
  const modelNames: Record<string, string> = {
    gp: 'Gaussian Process (GP)',
    rf: 'Random Forest',
    nn: 'Neural Network',
    idw: 'Inverse Distance Weighting (IDW)'
  };
  
  md += \`#### Surrogate Model\\n\`;
  md += \`A **\${modelNames[surrogateModel] || surrogateModel}** surrogate model was built using \${validRuns.length} data points to predict the response across the unexplored factor space. Model uncertainty is estimated via spatial distance in the experimental region.\\n\\n\`;

  md += \`#### Recommended Next Runs\\n\`;
  md += \`The optimizer suggests the following conditions to balance *exploration* (high uncertainty) and *exploitation* (high predicted performance) using an Upper Confidence Bound (UCB) acquisition strategy:\\n\\n\`;
`.trim();

const replaceStr = `
  // Pick top N diverse candidates
  const bestCandidates: typeof candidates = [];
  for (const c of candidates) {
    if (bestCandidates.length >= numSuggestions) break;
    let tooClose = false;
    for (const b of bestCandidates) {
      let dSq = 0;
      for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - b.x[j], 2);
      if (Math.sqrt(dSq) < 0.15) { tooClose = true; break; } // Diversity constraint
    }
    // Also avoid being too close to existing runs
    if (!tooClose) {
      for (const r of X) {
        let dSq = 0;
        for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - r[j], 2);
        if (Math.sqrt(dSq) < 0.05) { tooClose = true; break; }
      }
    }
    
    if (!tooClose) bestCandidates.push(c);
  }
  
  if (bestCandidates.length < numSuggestions) {
     for (const c of candidates) {
         if (bestCandidates.length >= numSuggestions) break;
         if (!bestCandidates.includes(c)) bestCandidates.push(c);
     }
  }

  let md = \`### Bayesian Parameter Optimization Results\\n\\n\`;
  md += \`Analysis completed for response **\${activeResponse.name}** (Goal: \${activeResponse.goal}).\\n\\n\`;
  
  md += \`#### Surrogate Model\\n\`;
  md += \`\${modelInfo}\\n\\n\`;

  md += \`#### Recommended Next Runs\\n\`;
  md += \`The optimizer suggests the following conditions to balance *exploration* (uncertain areas) and *exploitation* (optimal areas) using the industry-standard **Expected Improvement (EI)** acquisition function:\\n\\n\`;
`.trim();

if (!content.includes(targetStr)) {
  console.log("Target not found exactly. Check formatting.");
} else {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
  console.log("Replaced successfully!");
}
