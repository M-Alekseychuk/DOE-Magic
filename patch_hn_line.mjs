import fs from 'fs';

let he = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

const oldLine = `                        hnLayout.shapes = [{
                            type: 'line',
                            x0: data.halfNormalLine[0].y,
                            y0: data.halfNormalLine[0].x,
                            x1: data.halfNormalLine[1].y,
                            y1: data.halfNormalLine[1].x,
                            line: { color: '#f87171', width: 2 }
                        }];`;

const newLine = `                        hnLayout.shapes = [{
                            type: 'line',
                            x0: data.halfNormalLine[0].x,
                            y0: data.halfNormalLine[0].y,
                            x1: data.halfNormalLine[1].x,
                            y1: data.halfNormalLine[1].y,
                            line: { color: '#f87171', width: 2 }
                        }];`;

he = he.replace(oldLine, newLine);
fs.writeFileSync('src/utils/htmlExport.ts', he);
