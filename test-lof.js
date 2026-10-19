const jstat = require('jstat');

// 4 corners, 1 rep each
// Center point, 6 reps
// Let's invent some responses
const Y = [
  92, 94, // low,low ; high,low
  96, 98, // low,high; high,high
  97.5, 97.4, 97.2, 97.8, 97.7, 97.5 // 6 center points
];

const X = [
  [1, -1, -1, 1],
  [1, 1, -1, -1],
  [1, -1, 1, -1],
  [1, 1, 1, 1],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
];

// Calculate SS pure
let ss_pure = 0;
// center group
const center_mean = (97.5 + 97.4 + 97.2 + 97.8 + 97.7 + 97.5) / 6;
const center_group = [97.5, 97.4, 97.2, 97.8, 97.7, 97.5];
ss_pure += center_group.reduce((a, b) => a + Math.pow(b - center_mean, 2), 0);
console.log("SS Pure:", ss_pure); // matches 2.50395? wait...
// If SS Pure = 2.50395, let's see. 
