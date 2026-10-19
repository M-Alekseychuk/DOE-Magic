import fs from 'fs';

let he = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

const oldPredict = `        function predict(coded_arr, estimates) {
            let y = 0;
            estimates.forEach(est => {
                const term = est.term;
                if (term === 'Intercept') {
                    y += est.estimate;
                } else if (term.includes('*')) {
                    const parts = term.split('*');
                    const idx1 = project.factors.findIndex(f => f.name === parts[0]);
                    const idx2 = project.factors.findIndex(f => f.name === parts[1]);
                    if (idx1 >= 0 && idx2 >= 0) y += est.estimate * coded_arr[idx1] * coded_arr[idx2];
                } else {
                    const idx = project.factors.findIndex(f => f.name === term);
                    if (idx >= 0) y += est.estimate * coded_arr[idx];
                }
            });
            return y;
        }`;
        
const newPredict = `        function predict(coded_arr, estimates) {
            let y = 0;
            estimates.forEach(est => {
                const term = est.term;
                if (term === 'Intercept') {
                    y += est.estimate;
                } else if (term.includes('*')) {
                    const parts = term.split('*');
                    const idx1 = project.factors.findIndex(f => f.name === parts[0]);
                    const idx2 = project.factors.findIndex(f => f.name === parts[1]);
                    if (idx1 >= 0 && idx2 >= 0) y += est.estimate * coded_arr[idx1] * coded_arr[idx2];
                } else {
                    const idx = project.factors.findIndex(f => term.startsWith(f.name + '(') || f.name === term);
                    if (idx >= 0) y += est.estimate * coded_arr[idx];
                }
            });
            return y;
        }`;

he = he.replace(oldPredict, newPredict);
fs.writeFileSync('src/utils/htmlExport.ts', he);
