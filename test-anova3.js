import jstat from 'jstat';
const fRatio = 5;
const df1 = 1;
const df2 = 10;
const pValue = 1 - jstat.centralF.cdf(fRatio, df1, df2);
console.log(pValue, -Math.log10(pValue));
