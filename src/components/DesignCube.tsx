import React from 'react';
import { DesignType } from '../types';

interface Props {
  designType: DesignType;
  isFractional?: boolean;
}

type PointType = 'corner' | 'center' | 'axial' | 'edge';

export default function DesignCube({ designType, isFractional }: Props) {
  const width = 240;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2;
  const scale = 55;
  
  // 3D Rotation (better than isometric to prevent overlaps)
  const rotX = 25 * Math.PI / 180; // Tilt down
  const rotY = 35 * Math.PI / 180; // Pan right

  const project = (x: number, y: number, z: number) => {
    // Rotate around Y
    const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
    const z1 = x * Math.sin(rotY) + z * Math.cos(rotY);
    const y1 = y;
    
    // Rotate around X
    const x2 = x1;
    const y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
    
    // Project to 2D
    const px = cx + x2 * scale;
    const py = cy - y2 * scale;
    
    return { px, py, z: z2 };
  };

  const getPoints = () => {
    const points: {x: number, y: number, z: number, type: PointType}[] = [];
    
    if (designType !== 'plackett_burman') {
      points.push({ x: 0, y: 0, z: 0, type: 'center' });
    }

    const corners = [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
    ];
    
    const midEdges = [
      [-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0],
      [-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1],
      [0, -1, -1], [0, 1, -1], [0, -1, 1], [0, 1, 1]
    ];

    if (designType === 'factorial_2level' || designType === 'ccd' || designType === 'plackett_burman') {
      if ((designType === 'factorial_2level' && isFractional) || designType === 'plackett_burman') {
        // Half-fraction representation (matches Plackett-Burman screenshot)
        points.push(
          { x: -1, y: 1, z: 1, type: 'corner' },
          { x: 1, y: 1, z: -1, type: 'corner' },
          { x: -1, y: -1, z: -1, type: 'corner' },
          { x: 1, y: -1, z: 1, type: 'corner' }
        );
      } else {
        corners.forEach(([x, y, z]) => points.push({ x, y, z, type: 'corner' }));
      }
    }
    
    if (designType === 'ccd') {
      const alpha = 2.0; // Further out for better visibility
      const axials = [
        [alpha, 0, 0], [-alpha, 0, 0],
        [0, alpha, 0], [0, -alpha, 0],
        [0, 0, alpha], [0, 0, -alpha]
      ];
      axials.forEach(([x, y, z]) => points.push({ x, y, z, type: 'axial' }));
    }
    
    if (designType === 'custom_d_optimal') {
      points.push({ x: 0, y: 0, z: 0, type: 'center' });
      // Representative subset of points
      points.push(
        { x: -1, y: 1, z: 1, type: 'corner' },
        { x: 1, y: 1, z: -1, type: 'corner' },
        { x: -1, y: -1, z: -1, type: 'corner' },
        { x: 1, y: -1, z: 1, type: 'corner' },
        { x: 1, y: 1, z: 1, type: 'corner' }
      );
    }

    if (designType === 'bbd' || designType === 'dsd') {
      midEdges.forEach(([x, y, z]) => points.push({ x, y, z, type: 'edge' }));
    }

    return points;
  };

  const points = getPoints();
  
  // Painter's algorithm: sort by depth (z) ascending
  const projectedPoints = points.map(p => ({
    ...p,
    ...project(p.x, p.y, p.z)
  })).sort((a, b) => a.z - b.z);

  const edges = [
    [[-1, -1, -1], [1, -1, -1]], [[-1, -1, -1], [-1, 1, -1]], [[-1, -1, -1], [-1, -1, 1]],
    [[1, 1, 1], [1, 1, -1]], [[1, 1, 1], [1, -1, 1]], [[1, 1, 1], [-1, 1, 1]],
    [[-1, 1, -1], [1, 1, -1]], [[1, -1, -1], [1, 1, -1]],
    [[-1, 1, -1], [-1, 1, 1]], [[1, -1, -1], [1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1]]
  ];

  // Determine which point types to show in legend
  const hasCorner = points.some(p => p.type === 'corner');
  const hasEdge = points.some(p => p.type === 'edge');
  const hasAxial = points.some(p => p.type === 'axial');
  const hasCenter = points.some(p => p.type === 'center');

  const drawAxialLine = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    const p1 = project(x1, y1, z1);
    const p2 = project(x2, y2, z2);
    return (
      <line 
        x1={p1.px} y1={p1.py} 
        x2={p2.px} y2={p2.py} 
        stroke="currentColor" 
        className="text-slate-400 dark:text-slate-400" 
        strokeWidth="2" 
        strokeDasharray="4 4" 
      />
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <svg width={width} height={height} className="overflow-visible">
        {/* Draw axes if CCD */}
        {designType === 'ccd' && (
          <>
            {drawAxialLine(-2.0, 0, 0, 2.0, 0, 0)}
            {drawAxialLine(0, -2.0, 0, 0, 2.0, 0)}
            {drawAxialLine(0, 0, -2.0, 0, 0, 2.0)}
          </>
        )}

        {/* Draw wireframe */}
        {edges.map((edge, i) => {
          const p1 = project(edge[0][0], edge[0][1], edge[0][2]);
          const p2 = project(edge[1][0], edge[1][1], edge[1][2]);
          return (
            <line 
              key={`edge-${i}`} 
              x1={p1.px} y1={p1.py} 
              x2={p2.px} y2={p2.py} 
              stroke="currentColor" 
              className="text-slate-300 dark:text-slate-600"
              strokeWidth="1.5"
            />
          );
        })}
        
        {/* Draw points */}
        {projectedPoints.map((p, i) => {
          let fill = "#94a3b8";
          let stroke = "#64748b";
          let r = 4.5;
          
          if (p.type === 'center') {
            fill = "#3b82f6"; // blue-500
            stroke = "#2563eb";
            r = 5.5;
          } else if (p.type === 'axial') {
            fill = "#ef4444"; // red-500
            stroke = "#dc2626";
            r = 5;
          } else if (p.type === 'edge') {
            fill = "#f59e0b"; // amber-500
            stroke = "#d97706";
            r = 4.5;
          }

          return (
            <circle 
              key={`point-${i}`}
              cx={p.px}
              cy={p.py}
              r={r}
              fill={fill}
              stroke={stroke}
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
        {hasCorner && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span> Factorial (Corner)</span>}
        {hasEdge && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> {designType === 'dsd' ? 'Foldover Edge' : 'Edge Point'}</span>}
        {hasCenter && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Center</span>}
        {hasAxial && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Axial</span>}
      </div>
    </div>
  );
}
