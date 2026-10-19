import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const X: number\[\]\[\] = \[\];[\s\S]*?const numTerms = X\[0\]\.length;/m;
const match = code.match(regex);
if (match) {
  console.log("Found match!");
  // console.log(match[0]);
} else {
  console.log("Not found.");
}
