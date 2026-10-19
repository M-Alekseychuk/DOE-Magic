import jstat from 'jstat';
const jStat = (jstat).default || jstat;

const A = [[1, 2], [3, 4]];
const B = [[1], [2]];
console.log(jStat.multiply(A, B));

const k_star = [[1, 2]];
const alpha = [[3], [4]];
console.log(jStat.multiply(k_star, alpha));

