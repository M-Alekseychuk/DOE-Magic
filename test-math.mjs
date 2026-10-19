const allAverages = [ 95.25, 98.33, 98.27, 95.31, 97.10, 96.48, 97.17, 96.41 ];
const minAvg = Math.min(...allAverages);
const maxAvg = Math.max(...allAverages);
const yRange = maxAvg - minAvg;
const yPadding = yRange === 0 ? 1 : yRange * 0.1;
const yMin = minAvg - yPadding;
const yMax = maxAvg + yPadding;
const tickRange = yMax - yMin;
const yTicks = [
  yMin,
  yMin + tickRange * 0.25,
  yMin + tickRange * 0.5,
  yMin + tickRange * 0.75,
  yMax
];
console.log(yTicks);
