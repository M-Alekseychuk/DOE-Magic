import jStat from 'jstat';
const K_XX = [[1, 0.5], [0.5, 1]];
const y = [[1], [2]];
const K_inv = jStat.inv(K_XX);
console.log("K_inv:", K_inv);
const alpha = jStat.multiply(K_inv, y);
console.log("alpha:", alpha);
