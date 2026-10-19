import jstat from 'jstat';
const jStat = jstat.default || jstat;

const N = 8;
const p = 3; // factors
const sse = 10;
const df_error = N - p - 1; // 4

// simulate pure error
const ss_pure = 2;
const df_pure = 2; // say 2 center points
const ss_lof = sse - ss_pure;
const df_lof = df_error - df_pure;

const ms_lof = df_lof > 0 ? ss_lof / df_lof : 0;
const ms_pure = df_pure > 0 ? ss_pure / df_pure : 0;
const f_lof = ms_pure > 0 ? ms_lof / ms_pure : 0;

const p_lof = (df_lof > 0 && df_pure > 0) ? 1 - jStat.centralF.cdf(f_lof, df_lof, df_pure) : null;
console.log({ f_lof, p_lof });
