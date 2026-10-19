import { jStat } from 'jstat';

const K_XX = [[1, 0.5], [0.5, 1]];
const y = [[1], [2]];
const K_inv = jStat.inv(K_XX);
const alpha = jStat.multiply(K_inv, y);
const k_star = [[0.5, 0.2]];
const result = jStat.multiply(k_star, alpha);
console.log(result);
