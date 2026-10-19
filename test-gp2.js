const { jStat } = require('jstat'); // Wait, the first one used const jStat = require('jstat');

const jS = require('jstat');
const K_XX = [[1, 0.5], [0.5, 1]];
const y = [[1], [2]];
const K_inv = jS.inv(K_XX);
const alpha = jS.multiply(K_inv, y);
const k_star = [[0.5, 0.2]];
const result = jS.multiply(k_star, alpha);
console.log(result);
