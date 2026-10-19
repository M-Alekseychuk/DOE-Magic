import jstat from 'jstat';
const jStat = (jstat).default || jstat;
console.log("pdf", jStat.normal.pdf(0, 0, 1));
console.log("cdf", jStat.normal.cdf(0, 0, 1));
