const jStat = require('jstat');
const fRatio = 5;
const df1 = 1;
const df2 = 10;
const pValue = 1 - jStat.centralF.cdf(fRatio, df1, df2);
console.log(pValue, -Math.log10(pValue));
