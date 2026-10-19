import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

const targetUI = `        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Surrogate Model 
            <span className="ml-2 text-emerald-400 font-normal lowercase">(industry standard)</span>
          </label>
          <div className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded px-2 py-1.5 cursor-not-allowed opacity-80">
            Gaussian Process (Matern 5/2)
          </div>
          <div className="text-[10px] text-slate-500 italic mt-1 leading-tight">
            Automatically optimizes hyperparameters (length-scale, noise) via Marginal Likelihood maximization. Provides robust uncertainty estimates and Expected Improvement (EI).
          </div>
        </div>
      </div>

      <div className="mb-4 text-slate-400 text-[10px] leading-relaxed border-b border-slate-800 pb-4">
        <strong>Bayesian Parameter Optimization</strong> is a strategy for the global optimization of black-box functions. It builds a probabilistic model of the objective function and uses it to select the most promising factor settings to evaluate next. In the context of Design of Experiments, it helps navigate the experimental space efficiently to find the optimal factor conditions with as few runs as possible, carefully balancing <em>exploration</em> (learning more about uncertain areas) and <em>exploitation</em> (focusing on known optimal areas).
      </div>`;

const newUI = `      </div>

      <div className="mb-4 space-y-2 text-slate-400 text-[10px] leading-relaxed border-b border-slate-800 pb-4">
        <p><strong>Bayesian Parameter Optimization</strong> is a strategy for the global optimization of black-box functions. It builds a probabilistic model of the objective function and uses it to select the most promising factor settings to evaluate next. In the context of Design of Experiments, it helps navigate the experimental space efficiently to find the optimal factor conditions with as few runs as possible, carefully balancing <em>exploration</em> (learning more about uncertain areas) and <em>exploitation</em> (focusing on known optimal areas).</p>
        <p>This implementation uses the industry standard <strong>Gaussian Process (Matern 5/2)</strong> surrogate model. It automatically optimizes hyperparameters (length-scale, noise) via Marginal Likelihood maximization and evaluates candidates using the Expected Improvement (EI) acquisition function.</p>
      </div>`;

content = content.replace(targetUI, newUI);
fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
console.log('done 4');
