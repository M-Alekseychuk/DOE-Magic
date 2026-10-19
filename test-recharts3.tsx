import React from 'react';
import { renderToString } from 'react-dom/server';
import { LineChart, Line, XAxis, YAxis } from 'recharts';

const data = [{x: 10, value: 95}, {x: 20, value: 98}];
const html = renderToString(
  <LineChart width={400} height={400} data={data}>
    <XAxis dataKey="x" />
    <YAxis domain={[90, 100]} />
    <Line type="linear" dataKey="value" stroke="red" isAnimationActive={false} />
  </LineChart>
);
console.log(html.includes('path class="recharts-curve"'));
