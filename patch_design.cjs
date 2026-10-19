const fs = require('fs');

let pd = fs.readFileSync('src/components/ProjectDesign.tsx', 'utf8');

// 1. Add imports
pd = pd.replace(
  `import { Plus, Trash2, Settings2, Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';`,
  `import { Plus, Trash2, Settings2, Upload, X, AlertCircle, CheckCircle2, ChevronDown, Copy, CircleDot, Star } from 'lucide-react';`
);

// 2. Add state
pd = pd.replace(
  `const [targetRuns, setTargetRuns] = useState<number | ''>(recommendedRuns);`,
  `const [targetRuns, setTargetRuns] = useState<number | ''>(recommendedRuns);
  const [showAugmentMenu, setShowAugmentMenu] = useState(false);`
);

// 3. Add augmentation functions just before addEmptyRun
const augmentCode = `
  const addCenterPoints = (count: number = 1) => {
    const newRuns: Run[] = [];
    const maxOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    for (let i = 0; i < count; i++) {
      const f: Record<string, string | number> = {};
      project.factors.forEach(fac => {
        f[fac.id] = fac.type === 'categorical' ? (fac.levels ? fac.levels[0] : '') : (fac.min + fac.max) / 2;
      });
      const r: Record<string, null> = {};
      project.responses.forEach(res => r[res.id] = null);
      newRuns.push({
        id: uuidv4(),
        runOrder: maxOrder + i + 1,
        stdOrder: maxOrder + i + 1,
        factors: f,
        responses: r
      });
    }
    updateProject({ ...project, runs: [...project.runs, ...newRuns] });
    setShowAugmentMenu(false);
  };

  const addAxialPoints = () => {
    const newRuns: Run[] = [];
    let currentOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    
    project.factors.forEach(axialFactor => {
      if (axialFactor.type === 'categorical') return;
      
      const fLow: Record<string, string | number> = {};
      project.factors.forEach(fac => {
        if (fac.id === axialFactor.id) fLow[fac.id] = fac.min;
        else fLow[fac.id] = fac.type === 'categorical' ? (fac.levels ? fac.levels[0] : '') : (fac.min + fac.max) / 2;
      });
      const rLow: Record<string, null> = {};
      project.responses.forEach(res => rLow[res.id] = null);
      currentOrder++;
      newRuns.push({
        id: uuidv4(), runOrder: currentOrder, stdOrder: currentOrder,
        factors: fLow, responses: rLow
      });

      const fHigh: Record<string, string | number> = {};
      project.factors.forEach(fac => {
        if (fac.id === axialFactor.id) fHigh[fac.id] = fac.max;
        else fHigh[fac.id] = fac.type === 'categorical' ? (fac.levels ? fac.levels[0] : '') : (fac.min + fac.max) / 2;
      });
      const rHigh: Record<string, null> = {};
      project.responses.forEach(res => rHigh[res.id] = null);
      currentOrder++;
      newRuns.push({
        id: uuidv4(), runOrder: currentOrder, stdOrder: currentOrder,
        factors: fHigh, responses: rHigh
      });
    });
    updateProject({ ...project, runs: [...project.runs, ...newRuns] });
    setShowAugmentMenu(false);
  };

  const replicateDesign = () => {
    let currentOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    const newRuns: Run[] = project.runs.map(run => {
      currentOrder++;
      return {
        ...run,
        id: uuidv4(),
        runOrder: currentOrder,
        stdOrder: currentOrder,
        responses: Object.keys(run.responses).reduce((acc, key) => ({ ...acc, [key]: null }), {})
      };
    });
    updateProject({ ...project, runs: [...project.runs, ...newRuns] });
    setShowAugmentMenu(false);
  };

  const addEmptyRun = () => {`;

pd = pd.replace(`  const addEmptyRun = () => {`, augmentCode);


// 4. Add UI to the header toolbar
const uiCode = `            <div className="relative">
              <button 
                onClick={() => setShowAugmentMenu(!showAugmentMenu)}
                className="text-[11px] font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-2.5 py-1.5 rounded transition-colors inline-flex items-center gap-1 shadow-sm"
                title="Augment Design"
              >
                Augment Design <ChevronDown size={14} />
              </button>
              {showAugmentMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <button onClick={replicateDesign} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <Copy size={13} className="text-slate-400" /> Replicate Design
                  </button>
                  <button onClick={() => addCenterPoints(3)} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <CircleDot size={13} className="text-slate-400" /> Add 3 Center Points
                  </button>
                  <button onClick={addAxialPoints} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <Star size={13} className="text-slate-400" /> Add Axial Points (Face-Centered)
                  </button>
                </div>
              )}
            </div>
            <button onClick={addEmptyRun}`;

pd = pd.replace(`<button onClick={addEmptyRun}`, uiCode);

fs.writeFileSync('src/components/ProjectDesign.tsx', pd);
