const project = {
    factors: [
        { name: "THF" },
        { name: "Temperature" },
        { name: "THA" },
        { name: "621-F" }
    ]
};

const estimates = [
    { term: "Intercept", estimate: 90 },
    { term: "THF", estimate: 5 },
    { term: "Temperature", estimate: -2 },
    { term: "THA", estimate: 3 },
    { term: "621-F", estimate: 1 },
    { term: "THF*Temperature", estimate: 2 }
];

function predict(coded_arr, estimates) {
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
            console.log("term:", term, "idx:", idx);
            if (idx >= 0) y += est.estimate * coded_arr[idx];
        }
    });
    return y;
}

const coded = [1, 0, 1, 0];
console.log(predict(coded, estimates));
