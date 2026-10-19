const X = [ [20, 0.8], [40, 0.8], [20, 3], [40, 3], [30, 1.9] ];
const Z = [ 53.35, 40.2, 83.37, 29.82, 46.44 ];

const minX = Math.min(...X.map(x => x[0]));
const maxX = Math.max(...X.map(x => x[0]));
const minY = Math.min(...X.map(x => x[1]));
const maxY = Math.max(...X.map(x => x[1]));

const gridSize = 20;
const gridX = Array.from({length: gridSize}, (_, i) => minX + (maxX - minX) * i / (gridSize - 1));
const gridY = Array.from({length: gridSize}, (_, i) => minY + (maxY - minY) * i / (gridSize - 1));

// simple IDW or Bilinear
// ...
console.log(gridX.slice(0, 3));
