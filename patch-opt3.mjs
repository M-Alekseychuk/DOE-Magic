import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

content = content.replace(/surrogateModel: string = 'idw'/g, "");
content = content.replace(/, surrogateModel/g, "");

const removeBlockStr = `
const surrogateModels = [
  { id: 'gp', name: 'Gaussian Process', desc: 'Best for small, noise-free datasets (<50 runs). Provides robust uncertainty estimates.' },
  { id: 'rf', name: 'Random Forest', desc: 'Handles non-linearities well. Good for medium datasets (50-200 runs) with noise.' },
  { id: 'nn', name: 'Neural Network', desc: 'Best for very large datasets (>200 runs) with complex factor spaces.' },
  { id: 'idw', name: 'Inverse Distance Weighting', desc: 'Simple, fast deterministic interpolator for sparse data.' }
];
`.trim();
if (content.includes(removeBlockStr)) {
  content = content.replace(removeBlockStr, "");
}

content = content.replace(/const recommendedModel = validRunsCount < 50 \? 'gp' : validRunsCount <= 200 \? 'rf' : 'nn';\n/g, "");
content = content.replace(/const \[surrogateModel, setSurrogateModel\] = useState<string>\(recommendedModel\);\n/g, "");

fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
