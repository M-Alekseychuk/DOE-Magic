import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

const lofOld = `                // 4. Lack of Fit
                let lofHtml = '';
                if (data.lackOfFit) {
                    let lof = data.lackOfFit;
                    let pStr = lof.pValue < 0.0001 ? "<.0001*" : (lof.pValue <= 0.05 ? lof.pValue.toFixed(4) + "*" : lof.pValue.toFixed(4));
                    let color = lof.pValue <= 0.05 ? "color: #b91c1c;" : "";
                    lofHtml = '<table><thead><tr><th>Source</th><th style="text-align:right">DF</th><th style="text-align:right">Sum of Squares</th><th style="text-align:right">Mean Square</th><th style="text-align:right">F Ratio</th><th style="text-align:right">Prob &gt; F</th></tr></thead><tbody>' +
                        '<tr><td>Lack of Fit</td><td style="text-align:right">' + lof.dfLOF + '</td><td style="text-align:right">' + lof.ssLOF.toFixed(6) + '</td><td style="text-align:right">' + lof.msLOF.toFixed(6) + '</td><td style="text-align:right">' + lof.fRatio.toFixed(4) + '</td><td style="text-align:right;' + color + '">' + pStr + '</td></tr>' +
                        '<tr><td>Pure Error</td><td style="text-align:right">' + lof.dfPE + '</td><td style="text-align:right">' + lof.ssPE.toFixed(6) + '</td><td style="text-align:right">' + lof.msPE.toFixed(6) + '</td><td></td><td></td></tr>' +
                        '<tr><td>Total Error</td><td style="text-align:right">' + (lof.dfLOF + lof.dfPE) + '</td><td style="text-align:right">' + (lof.ssLOF + lof.ssPE).toFixed(6) + '</td><td></td><td></td><td></td></tr>' +
                        '</tbody></table>';
                } else {
                    lofHtml = '<p style="color: #64748b; margin-top: 8px;">Not enough degrees of freedom to calculate lack of fit.</p>';
                }
                document.getElementById('table-lack-of-fit').innerHTML = lofHtml;`;

const lofNew = `                // 4. Lack of Fit
                let lofHtml = '';
                if (data.lackOfFit && typeof data.lackOfFit.df_lof !== 'undefined') {
                    let lof = data.lackOfFit;
                    let pStr = lof.p_lof !== null ? (lof.p_lof < 0.0001 ? "<.0001*" : (lof.p_lof <= 0.05 ? lof.p_lof.toFixed(4) + "*" : lof.p_lof.toFixed(4))) : '-';
                    let color = (lof.p_lof !== null && lof.p_lof <= 0.05) ? "color: #b91c1c;" : "";
                    let fRatioStr = lof.f_lof === Infinity || lof.f_lof === null ? 'Inf' : lof.f_lof.toFixed(4);
                    lofHtml = '<table><thead><tr><th>Source</th><th style="text-align:right">DF</th><th style="text-align:right">Sum of Squares</th><th style="text-align:right">Mean Square</th><th style="text-align:right">F Ratio</th><th style="text-align:right">Prob &gt; F</th></tr></thead><tbody>' +
                        '<tr><td>Lack of Fit</td><td style="text-align:right">' + lof.df_lof + '</td><td style="text-align:right">' + lof.ss_lof.toFixed(6) + '</td><td style="text-align:right">' + lof.ms_lof.toFixed(6) + '</td><td style="text-align:right">' + fRatioStr + '</td><td style="text-align:right;' + color + '">' + pStr + '</td></tr>' +
                        '<tr><td>Pure Error</td><td style="text-align:right">' + lof.df_pure + '</td><td style="text-align:right">' + lof.ss_pure.toFixed(6) + '</td><td style="text-align:right">' + lof.ms_pure.toFixed(6) + '</td><td></td><td></td></tr>' +
                        '<tr><td>Total Error</td><td style="text-align:right">' + (lof.df_error || 0) + '</td><td style="text-align:right">' + lof.sse.toFixed(6) + '</td><td></td><td></td><td></td></tr>' +
                        '</tbody></table>';
                } else {
                    lofHtml = '<p style="color: #64748b; margin-top: 8px;">Not enough degrees of freedom to calculate lack of fit.</p>';
                }
                document.getElementById('table-lack-of-fit').innerHTML = lofHtml;`;

// Fallback search replace using index because tabs/spaces might differ
const regexLOF = /\/\/ 4\. Lack of Fit[\s\S]*?document\.getElementById\('table-lack-of-fit'\)\.innerHTML = lofHtml;/;
content = content.replace(regexLOF, lofNew);

fs.writeFileSync('src/utils/htmlExport.ts', content);
