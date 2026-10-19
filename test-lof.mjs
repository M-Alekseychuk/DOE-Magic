import jstat from 'jstat';

const center_group = [97.5, 97.4, 97.2, 97.8, 97.7, 97.5];
const center_mean = center_group.reduce((a, b) => a + b) / center_group.length;
const ss_pure = center_group.reduce((a, b) => a + Math.pow(b - center_mean, 2), 0);
console.log("SS Pure:", ss_pure); 
