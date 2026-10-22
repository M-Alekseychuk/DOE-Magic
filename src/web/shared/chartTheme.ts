import { useState, useEffect } from 'react';

/**
 * Hook to reactively track whether dark mode is currently active.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => 
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Common axis styling props for Recharts XAxis and YAxis to ensure
 * high-contrast white axes, ticks, and labels in dark mode.
 */
export function getChartAxisProps(isDark: boolean, options: {
  fontSize?: number;
  angle?: number;
  textAnchor?: 'start' | 'middle' | 'end';
} = {}) {
  // Use a softer, less pronounced stroke for axis lines so they don't look harsh,
  // while keeping tick numbers crisp and legible.
  const axisLineColor = isDark ? 'rgba(255, 255, 255, 0.35)' : '#cbd5e1';
  const tickLineColor = isDark ? 'rgba(255, 255, 255, 0.45)' : '#94a3b8';
  const textColor = isDark ? '#ffffff' : '#334155';

  return {
    axisLine: { stroke: axisLineColor, strokeWidth: 1 },
    tickLine: { stroke: tickLineColor, strokeWidth: 1 },
    tick: {
      fontSize: options.fontSize ?? 10,
      fill: textColor,
      ...(options.angle !== undefined ? { angle: options.angle } : {}),
      ...(options.textAnchor !== undefined ? { textAnchor: options.textAnchor } : {})
    }
  };
}

/**
 * Grid line stroke for Recharts CartesianGrid
 */
export function getGridStroke(isDark: boolean): string {
  return isDark ? '#334155' : '#e2e8f0';
}

/**
 * High contrast axis label props for Recharts
 */
export function getAxisLabelProps(isDark: boolean, text: string, options: Record<string, any> = {}) {
  return {
    value: text,
    fill: isDark ? '#ffffff' : '#1e293b',
    fontSize: 10,
    ...options
  };
}
