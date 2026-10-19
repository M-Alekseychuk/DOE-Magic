import React from 'react';
import { designMatrix } from './designMatrixData';
import { useTranslation } from '../context/LanguageContext';

interface Props {
  factorsCount: number;
  selectedRuns: number | '';
  onSelectRuns: (runs: number) => void;
}

export default function TwoLevelDesignSelector({ factorsCount, selectedRuns, onSelectRuns }: Props) {
  const { t, locale } = useTranslation();
  const runsOptions = [4, 8, 16, 32, 64, 128, 256, 512];
  const cols = Array.from({ length: 15 }, (_, i) => i + 2); // 2 to 16

  const getCellData = (runs: number, factors: number) => {
    // If it's a full factorial
    if (Math.pow(2, factors) === runs) {
      return { type: 'full', text: `2^${factors}`, color: 'bg-white dark:bg-slate-300', textColor: 'text-slate-900 dark:text-slate-900' };
    }
    // If it's invalid
    if (Math.pow(2, factors) < runs || runs < 4) {
      return { type: 'invalid', color: 'bg-slate-200/60 dark:bg-slate-800/40' };
    }
    // Fractional factorial lookup
    const lookup = (designMatrix as any)[runs.toString()]?.[factors.toString()];
    if (lookup) {
      let colorClass = 'bg-slate-400';
      let textColor = 'text-white';
      if (lookup.color === 'R') {
        colorClass = 'bg-red-600 hover:bg-red-500';
        textColor = 'text-white';
      } else if (lookup.color === 'Y') {
        colorClass = 'bg-amber-400 hover:bg-amber-300';
        textColor = 'text-slate-950';
      } else if (lookup.color === 'G') {
        colorClass = 'bg-emerald-600 hover:bg-emerald-500';
        textColor = 'text-white';
      } else if (lookup.color === 'B') {
        colorClass = 'bg-slate-900 hover:bg-slate-800';
        textColor = 'text-red-400';
      }
      return { type: 'fractional', p: lookup.p, res: lookup.res, color: colorClass, textColor };
    }
    return { type: 'invalid', color: 'bg-slate-200/60 dark:bg-slate-800/40' };
  };

  return (
    <div className="mb-3 font-sans select-none">
      <div className="mb-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-0.5">
          {locale === 'zh' ? '标准两水平析因设计导引表' : 'Regular Two-Level Factorial Design'}
        </h2>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight max-w-4xl">
          {locale === 'zh'
            ? '适用于 2 至 16 个因素（每个因素均为 2 个水平）的实验方案。可用于精准估计主效应与交互作用。部分析因设计能在最少实验次数下快速筛选出关键少数因素。'
            : 'Design for 2 to 16 factors where each factor is set to 2 levels. Useful for estimating main effects and interactions. Fractional factorials can be used for screening many factors to find the significant few.'}
        </p>
        
        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[9px] font-semibold">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            <span className="w-2 h-2 rounded-xs bg-white dark:bg-slate-300 border border-slate-400"></span>
            <span>{locale === 'zh' ? '全因子 (Full Factorial)' : 'Full Factorial'}</span>
          </div>
          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-xs bg-emerald-600"></span>
            <span>{locale === 'zh' ? '分辨率 V+ (表征试验)' : 'Res V+ (Characterization)'}</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            <span className="w-2 h-2 rounded-xs bg-amber-400"></span>
            <span>{locale === 'zh' ? '分辨率 IV (筛选试验)' : 'Res IV (Screening)'}</span>
          </div>
          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
            <span className="w-2 h-2 rounded-xs bg-red-600"></span>
            <span>{locale === 'zh' ? '分辨率 III (耐用性试验)' : 'Res III (Ruggedness testing)'}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-slate-300 dark:border-slate-700 shadow-xs bg-white dark:bg-slate-900">
        <table className="w-full text-center text-[10px] border-collapse" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
              <th colSpan={2} className="w-12 border-r border-slate-300 dark:border-slate-700"></th>
              <th colSpan={cols.length} className="py-0.5 font-bold uppercase tracking-wider text-[9px] text-slate-700 dark:text-slate-300">
                {locale === 'zh' ? '因素数量 (Factors)' : 'Number of Factors'}
              </th>
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
              <th colSpan={2} className="py-0.5 px-1 text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-slate-300 dark:border-slate-700">
                {locale === 'zh' ? '实验运行数' : 'Runs'}
              </th>
              {cols.map(c => {
                const isCurrent = c === factorsCount;
                return (
                  <th 
                    key={c} 
                    className={`py-0.5 border-r last:border-r-0 border-slate-300 dark:border-slate-700 text-[11px] transition-colors ${
                      isCurrent 
                        ? 'bg-blue-600 text-white font-bold shadow-inner' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {c}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {runsOptions.map((runs, rIdx) => (
              <tr key={runs} className="border-b last:border-b-0 border-slate-300 dark:border-slate-700">
                {/* Vertical Runs Axis Label spanning all rows on the left */}
                {rIdx === 0 && (
                  <td 
                    rowSpan={runsOptions.length} 
                    className="w-5 bg-slate-100 dark:bg-slate-800/80 border-r border-slate-300 dark:border-slate-700 p-0 text-center align-middle"
                  >
                    <div 
                      className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 inline-block"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {locale === 'zh' ? '实验次数 (Runs)' : 'Runs'}
                    </div>
                  </td>
                )}
                
                {/* Run count number */}
                <td className="w-10 py-2.5 px-1 font-mono font-bold text-[11px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700 text-center align-middle">
                  {runs}
                </td>

                {cols.map(c => {
                  const cell = getCellData(runs, c);
                  const isSelectable = cell.type !== 'invalid';
                  const isCurrentFactorCount = c === factorsCount;
                  const isSelected = selectedRuns === runs && isCurrentFactorCount;

                  if (!isSelectable) {
                    return (
                      <td 
                        key={c} 
                        className={`border-r last:border-r-0 border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 ${
                          isCurrentFactorCount ? 'bg-blue-100/50 dark:bg-blue-900/30' : ''
                        }`}
                      />
                    );
                  }

                  let content = null;
                  if (cell.type === 'full') {
                    content = (
                      <div className="text-[13px] font-bold leading-none py-2">
                        2<sup>{c}</sup>
                      </div>
                    );
                  } else if (cell.type === 'fractional') {
                    content = (
                      <div className="flex flex-col items-center justify-center leading-none py-1.5">
                        <div className="text-[12px] font-bold tracking-tight">
                          2<sup>{c}-{cell.p}</sup>
                        </div>
                        <div className="text-[9px] font-mono uppercase tracking-tighter opacity-90 leading-none mt-0.5">{cell.res}</div>
                      </div>
                    );
                  }

                  return (
                    <td 
                      key={c} 
                      onClick={() => { if (isCurrentFactorCount && isSelectable) onSelectRuns(runs); }}
                      title={isCurrentFactorCount 
                        ? (locale === 'zh' ? `点击为 ${c} 个因素生成 ${runs} 次实验方案` : `Click to generate design with ${runs} runs for ${c} factors`) 
                        : (locale === 'zh' ? `${c} 个因素需 ${runs} 次实验` : `${runs} runs for ${c} factors`)}
                      className={`
                        border-r last:border-r-0 border-slate-300 dark:border-slate-700 align-middle relative transition-all duration-150 p-0
                        ${cell.color} ${cell.textColor || 'text-white'}
                        ${isCurrentFactorCount ? 'cursor-pointer hover:brightness-110 hover:shadow-md' : 'opacity-90'}
                        ${isSelected ? 'ring-2 ring-blue-500 ring-inset font-bold z-10 shadow-lg brightness-110' : ''}
                      `}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
