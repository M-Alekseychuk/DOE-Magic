import React, { useState, useRef, useEffect } from 'react';
import { Project, Run, DesignType } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Settings2, Upload, X, AlertCircle, CheckCircle2, ChevronDown, Copy, CircleDot, Star, Sparkles, Layers, Sliders, Info } from 'lucide-react';
import TwoLevelDesignSelector from './TwoLevelDesignSelector';
import DesignCube from './DesignCube';
import { read, utils } from 'xlsx';
import { getRunPattern } from '../../../core/design/doePatterns';
import { generateDOptimalSubset } from '../../../core/design/dOptimal';
import { buildDSD } from '../../../core/design/dsd';
import { buildRegularFraction } from '../../../core/design/fractions';
import { buildCenterPointRuns, buildAxialPointRuns, getSafeCategoricalLevels } from '../../../core/design/centerPoints';
import { randomize, generateRandomSeed } from '../../../core/design/randomize';
import { countMeasuredValues } from '../../../core/analysis/projectModels';
import ConfirmDialog from '../../shared/ConfirmDialog';
import { useTranslation } from '../../i18n/LanguageContext';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
}

interface DecimalInputProps {
  value: number | string | null | undefined;
  onChange: (val: number | null) => void;
  className?: string;
  placeholder?: string;
  title?: string;
}

const DecimalInput = React.memo(function DecimalInput({ 
  value, 
  onChange, 
  className, 
  placeholder, 
  title 
}: DecimalInputProps) {
  const [localText, setLocalText] = useState<string>(() => {
    if (value === null || value === undefined || value === '') return '';
    return String(value);
  });
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalText(value === null || value === undefined || value === '' ? '' : String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Replace comma with dot automatically
    const clean = raw.replace(/,/g, '.');

    // Allow empty, minus/plus signs, single dot, intermediate scientific notation or valid numbers
    if (
      clean === '' ||
      clean === '-' ||
      clean === '+' ||
      clean === '.' ||
      clean === '-.' ||
      clean === '+.' ||
      /^[+-]?\d*(\.\d*)?([eE][+-]?\d*)?$/.test(clean)
    ) {
      setLocalText(clean);

      // Only notify parent when it's an empty cell or a complete, valid number
      // If it ends with '.', '-', 'e', etc. it's an in-progress typing state: DO NOT notify parent yet
      if (clean === '') {
        onChange(null);
      } else if (
        clean === '-' ||
        clean === '+' ||
        clean === '.' ||
        clean === '-.' ||
        clean === '+.' ||
        clean.endsWith('.') ||
        clean.endsWith('e') ||
        clean.endsWith('E') ||
        clean.endsWith('e-') ||
        clean.endsWith('e+') ||
        clean.endsWith('E-') ||
        clean.endsWith('E+')
      ) {
        // Incomplete intermediate number: preserve local input without triggering parent re-render
      } else {
        const parsed = Number(clean);
        if (!isNaN(parsed) && Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const clean = localText.replace(/,/g, '.').trim();
    if (
      clean === '' ||
      clean === '-' ||
      clean === '+' ||
      clean === '.' ||
      clean === '-.' ||
      clean === '+.'
    ) {
      setLocalText('');
      onChange(null);
    } else {
      const parsed = Number(clean);
      if (!isNaN(parsed) && Number.isFinite(parsed)) {
        // If it ended with a dangling dot like "34.", normalize to "34" on blur
        const formatted = clean.endsWith('.') ? String(parsed) : clean;
        setLocalText(formatted);
        onChange(parsed);
      } else {
        setLocalText('');
        onChange(null);
      }
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      title={title}
    />
  );
});

export default function ProjectDesign({ project, updateProject }: Props) {
  const { t, locale } = useTranslation();
  const hasCategorical = project.factors.some(f => f.type === 'categorical');
  const allCategoricalAre2Level = project.factors
    .filter(f => f.type === 'categorical')
    .every(f => !f.levels || f.levels.length === 2);
  const hasMultiLevelCategorical = hasCategorical && !allCategoricalAre2Level;

  const fullRuns = project.factors.length > 0 
    ? project.factors.reduce((acc, f) => acc * (f.type === 'categorical' && f.levels ? f.levels.length : 2), 1)
    : 0;

  const continuousFactors = project.factors.filter(f => f.type !== 'categorical');
  const categoricalFactors = project.factors.filter(f => f.type === 'categorical');

  const pMain = 1 + project.factors.reduce((acc, f) => {
    return acc + (f.type === 'categorical' && f.levels ? Math.max(1, f.levels.length - 1) : 1);
  }, 0);

  const catCombinationsCount = categoricalFactors.length > 0
    ? categoricalFactors.reduce((acc, f) => acc * (f.levels && f.levels.length > 0 ? f.levels.length : 2), 1)
    : 1;

  const continuousCCDRuns = continuousFactors.length > 0
    ? Math.pow(2, continuousFactors.length) + 2 * continuousFactors.length + 1
    : 0;
  const totalStratifiedCCDRuns = continuousCCDRuns * catCombinationsCount;

  const continuousBBDRuns = continuousFactors.length >= 3
    ? 2 * continuousFactors.length * (continuousFactors.length - 1) + 1
    : 0;
  const totalStratifiedBBDRuns = continuousBBDRuns * catCombinationsCount;

  const recommendedRuns = project.designType === 'custom_d_optimal'
    ? Math.min(fullRuns, Math.max(pMain + 3, 12))
    : project.designType === 'plackett_burman'
    ? (project.factors.length <= 11 ? 12 : 20)
    : project.designType === 'ccd'
    ? (hasCategorical ? totalStratifiedCCDRuns : continuousCCDRuns)
    : project.designType === 'bbd'
    ? (hasCategorical ? totalStratifiedBBDRuns : continuousBBDRuns)
    : hasCategorical ? fullRuns : (project.factors.length > 4 ? Math.max(8, Math.pow(2, project.factors.length - 1)) : fullRuns);
  
  const [targetRuns, setTargetRuns] = useState<number | ''>(recommendedRuns);
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<{
    designName: string;
    runsCount: number;
    dEfficiency?: number | null;
    randomSeed?: number;
    notes?: string;
  } | null>(null);
  const [showAugmentMenu, setShowAugmentMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<
    | { type: 'generate'; measuredCount: number }
    | { type: 'import'; measuredCount: number; runs: Run[]; sheetName: string; warnings: string[] }
    | null
  >(null);

  const commitImportedRuns = (newRuns: Run[], sheetName: string, warningMessages: string[]) => {
    updateProject({
      ...project,
      runs: newRuns,
      updatedAt: Date.now(),
    });

    if (warningMessages.length > 0) {
      setImportStatus({
        type: 'warning',
        message: `Loaded ${newRuns.length} runs. Warning: ${warningMessages.join(' ')}`,
      });
    } else {
      setImportStatus({
        type: 'success',
        message: `Successfully loaded ${newRuns.length} runs from worksheet "${sheetName}"!`,
      });
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Could not read file data");

        const workbook = read(data, { type: 'binary' });
        
        // Find the sheet
        // 1. Try to find a sheet with "design" or "matrix" or "runs" in its name
        let sheetName = workbook.SheetNames.find(name => {
          const n = name.toLowerCase();
          return n.includes('design') || n.includes('matrix') || n.includes('run');
        });
        
        // 2. Fallback to first sheet
        if (!sheetName && workbook.SheetNames.length > 0) {
          sheetName = workbook.SheetNames[0];
        }

        if (!sheetName) {
          throw new Error("No worksheets found in the Excel file");
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length === 0) {
          throw new Error("The selected worksheet is empty");
        }

        // We need to find the header row.
        // We look for a row that has the most matching factors/responses names or standard columns.
        let bestHeaderIdx = 0;
        let maxMatches = -1;
        const norm = (val: any) => String(val || '').trim().toLowerCase();

        // Scan the first 10 rows to locate the header row
        const searchLimit = Math.min(10, rows.length);
        for (let rIdx = 0; rIdx < searchLimit; rIdx++) {
          const row = rows[rIdx];
          if (!row || !Array.isArray(row)) continue;

          let matches = 0;
          row.forEach(cell => {
            const cellStr = norm(cell);
            if (cellStr === 'run' || cellStr === 'run order' || cellStr === 'runorder' || cellStr === 'run_order') matches += 2;
            if (cellStr === 'standard order' || cellStr === 'std order' || cellStr === 'stdorder' || cellStr === 'standard_order' || cellStr === 'std_order') matches += 2;
            
            // Check matching factors
            const isFactor = project.factors.some(f => norm(f.name) === cellStr);
            if (isFactor) matches += 3;

            // Check matching responses
            const isResponse = project.responses.some(res => norm(res.name) === cellStr);
            if (isResponse) matches += 3;
          });

          if (matches > maxMatches) {
            maxMatches = matches;
            bestHeaderIdx = rIdx;
          }
        }

        const headerRow = rows[bestHeaderIdx];
        if (!headerRow || maxMatches <= 0) {
          throw new Error("Could not find column headers (e.g., Run, Standard Order, Factor names, Response names) in the Excel sheet.");
        }

        // Map column indices
        let runOrderColIdx = -1;
        let stdOrderColIdx = -1;
        const factorColMap: Record<string, number> = {}; // factorId -> colIdx
        const responseColMap: Record<string, number> = {}; // responseId -> colIdx

        headerRow.forEach((cell, cellIdx) => {
          const cellStr = norm(cell);
          if (cellStr === 'run' || cellStr === 'run order' || cellStr === 'runorder' || cellStr === 'run_order') {
            runOrderColIdx = cellIdx;
          } else if (cellStr === 'standard order' || cellStr === 'std order' || cellStr === 'stdorder' || cellStr === 'std_order' || cellStr === 'standard_order') {
            stdOrderColIdx = cellIdx;
          } else {
            // Match factors
            const factor = project.factors.find(f => norm(f.name) === cellStr);
            if (factor) {
              factorColMap[factor.id] = cellIdx;
            } else {
              // Match responses
              const response = project.responses.find(res => norm(res.name) === cellStr);
              if (response) {
                responseColMap[response.id] = cellIdx;
              }
            }
          }
        });

        // Parse data rows
        const newRuns: Run[] = [];
        let warningMessages: string[] = [];

        // Check if any factors or responses are missing in the import
        project.factors.forEach(f => {
          if (factorColMap[f.id] === undefined) {
            warningMessages.push(`Factor "${f.name}" column not found.`);
          }
        });
        project.responses.forEach(r => {
          if (responseColMap[r.id] === undefined) {
            warningMessages.push(`Response "${r.name}" column not found.`);
          }
        });

        // Start from bestHeaderIdx + 1
        let runCount = 0;
        for (let rIdx = bestHeaderIdx + 1; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          if (!row || row.length === 0) continue;
          
          // If the entire row is empty or only has empty strings, skip it
          const hasData = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
          if (!hasData) continue;

          runCount++;
          
          // Parse Run Order
          let runOrder = runCount;
          if (runOrderColIdx !== -1) {
            const roVal = Number(row[runOrderColIdx]);
            if (!isNaN(roVal) && roVal > 0) {
              runOrder = roVal;
            }
          }

          // Parse Std Order
          let stdOrder = runOrder;
          if (stdOrderColIdx !== -1) {
            const soVal = Number(row[stdOrderColIdx]);
            if (!isNaN(soVal) && soVal > 0) {
              stdOrder = soVal;
            }
          }

          // Parse factors
          const runFactors: Record<string, string | number> = {};
          project.factors.forEach(f => {
            const colIdx = factorColMap[f.id];
            if (colIdx !== undefined && colIdx < row.length) {
              const rawVal = row[colIdx];
              if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                // If categorical, keep string
                if (f.type === 'categorical') {
                  runFactors[f.id] = String(rawVal).trim();
                } else {
                  const cleanedStr = String(rawVal).trim().replace(/,/g, '.');
                  const numVal = Number(cleanedStr);
                  runFactors[f.id] = isNaN(numVal) ? cleanedStr : numVal;
                }
              } else {
                runFactors[f.id] = 0; // default for empty numeric
              }
            } else {
              runFactors[f.id] = f.min;
            }
          });

          // Parse responses
          const runResponses: Record<string, number | null> = {};
          project.responses.forEach(res => {
            const colIdx = responseColMap[res.id];
            if (colIdx !== undefined && colIdx < row.length) {
              const rawVal = row[colIdx];
              if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                const cleanedStr = String(rawVal).trim().replace(/,/g, '.');
                const numVal = Number(cleanedStr);
                runResponses[res.id] = isNaN(numVal) ? null : numVal;
              } else {
                runResponses[res.id] = null;
              }
            } else {
              runResponses[res.id] = null;
            }
          });

          newRuns.push({
            id: uuidv4(),
            runOrder,
            stdOrder,
            factors: runFactors,
            responses: runResponses
          });
        }

        if (newRuns.length === 0) {
          throw new Error("No valid data rows found below the headers in the sheet.");
        }

        // Sort runs by runOrder to maintain order
        newRuns.sort((a, b) => a.runOrder - b.runOrder);

        const existingMeasuredCount = countMeasuredValues(project);
        if (existingMeasuredCount > 0) {
          setPendingOverwrite({
            type: 'import',
            measuredCount: existingMeasuredCount,
            runs: newRuns,
            sheetName,
            warnings: warningMessages,
          });
        } else {
          commitImportedRuns(newRuns, sheetName, warningMessages);
        }

      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: `Failed to load Excel: ${err.message || err}`
        });
      }

      // Reset the file input so the same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Error reading the file'
      });
    };

    reader.readAsBinaryString(file);
  };
  
  // Keep the target runs in sync with factor additions if unchanged
  React.useEffect(() => {
    setTargetRuns(recommendedRuns);
  }, [recommendedRuns]);

  const executeGenerateRuns = () => {
    if (project.factors.length === 0) return;
    
    let newRuns: Run[] = [];
    const fCount = project.factors.length;
    const currentDesignType = project.designType || 'factorial_2level';

    // Helper: Cartesian product of factor levels into run factor maps
    const getCartesianRuns = (candidateLevelsMap: (string | number)[][]): Record<string, string | number>[] => {
      let combs: (string | number)[][] = [[]];
      for (const levels of candidateLevelsMap) {
        const nextComb: (string | number)[][] = [];
        for (const comb of combs) {
          for (const lvl of levels) {
            nextComb.push([...comb, lvl]);
          }
        }
        combs = nextComb;
      }
      return combs.map(comb => {
        const runSettings: Record<string, string | number> = {};
        project.factors.forEach((f, idx) => {
          runSettings[f.id] = comb[idx];
        });
        return runSettings;
      });
    };

    if (currentDesignType === 'custom_d_optimal') {
      // D-Optimal Custom Design:
      // Provide candidate grid (with center points for continuous if <= 5 factors)
      const candidateLevelsList: (string | number)[][] = project.factors.map(f => {
        if (f.type === 'categorical') {
          return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        } else {
          return fCount <= 5 ? [f.min, (f.min + f.max) / 2, f.max] : [f.min, f.max];
        }
      });
      const allCandidateRuns = getCartesianRuns(candidateLevelsList);
      const runsToGen = targetRuns === '' || Number(targetRuns) <= 0 
        ? Math.min(allCandidateRuns.length, Math.max(pMain + 3, 12)) 
        : Math.min(allCandidateRuns.length, Number(targetRuns));

      const { selectedIndices, dEfficiency } = generateDOptimalSubset(allCandidateRuns, project.factors, runsToGen);

      selectedIndices.forEach((idx, i) => {
        const runResponses: Record<string, null> = {};
        project.responses.forEach(r => runResponses[r.id] = null);
        newRuns.push({
          id: uuidv4(),
          runOrder: i + 1,
          stdOrder: i + 1,
          factors: { ...allCandidateRuns[idx] },
          responses: runResponses
        });
      });

      setLastGeneratedInfo({
        designName: 'D-Optimal Custom Design',
        runsCount: newRuns.length,
        dEfficiency,
        notes: `Selected ${newRuns.length} statistically optimal treatment runs from ${allCandidateRuns.length} candidates`
      });
    } else if (currentDesignType === 'ccd') {
      // Central Composite Design (CCD) / Stratified RSM
      if (hasCategorical) {
        if (continuousFactors.length === 0) {
          setImportStatus({
            type: 'warning',
            message: 'Central Composite Design requires continuous factors for curvature (axial points). Generated D-Optimal design instead.'
          });
          const candidateLevelsList = project.factors.map(f => f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2']);
          const allCandidateRuns = getCartesianRuns(candidateLevelsList);
          const runsToGen = targetRuns === '' ? Math.min(allCandidateRuns.length, 12) : Number(targetRuns);
          const { selectedIndices, dEfficiency } = generateDOptimalSubset(allCandidateRuns, project.factors, runsToGen);
          selectedIndices.forEach((idx, i) => {
            const runResponses: Record<string, null> = {};
            project.responses.forEach(r => runResponses[r.id] = null);
            newRuns.push({ id: uuidv4(), runOrder: i + 1, stdOrder: i + 1, factors: { ...allCandidateRuns[idx] }, responses: runResponses });
          });
          setLastGeneratedInfo({
            designName: 'D-Optimal Design',
            runsCount: newRuns.length,
            dEfficiency,
            notes: 'Generated D-Optimal design for categorical factors'
          });
        } else {
          // Stratified CCD: Continuous CCD core replicated across each categorical level combination
          const ccdContinuousRuns: Record<string, number>[] = [];
          const cNum = continuousFactors.length;
          const numRuns = Math.pow(2, cNum);

          // 1. Continuous Cube points
          for (let i = 0; i < numRuns; i++) {
            const runFactors: Record<string, number> = {};
            continuousFactors.forEach((f, idx) => {
              const isHi = (i & (1 << idx)) !== 0;
              runFactors[f.id] = isHi ? f.max : f.min;
            });
            ccdContinuousRuns.push(runFactors);
          }

          // 2. Continuous Axial points (Face Centered alpha = 1)
          continuousFactors.forEach(fAxis => {
            const runFactorsLow: Record<string, number> = {};
            continuousFactors.forEach(f => {
              runFactorsLow[f.id] = (f.id === fAxis.id) ? f.min : ((f.min + f.max) / 2);
            });
            ccdContinuousRuns.push(runFactorsLow);

            const runFactorsHi: Record<string, number> = {};
            continuousFactors.forEach(f => {
              runFactorsHi[f.id] = (f.id === fAxis.id) ? f.max : ((f.min + f.max) / 2);
            });
            ccdContinuousRuns.push(runFactorsHi);
          });

          // 3. Continuous Center points (honouring project.centerPoints including 0, P1.20 / DES-6)
          const ccdCenterCount = project.centerPoints !== undefined ? Math.max(0, project.centerPoints) : 1;
          for (let cpIdx = 0; cpIdx < ccdCenterCount; cpIdx++) {
            const runFactorsCenter: Record<string, number> = {};
            continuousFactors.forEach(f => {
              runFactorsCenter[f.id] = (f.min + f.max) / 2;
            });
            ccdContinuousRuns.push(runFactorsCenter);
          }

          // Categorical combinations
          const catLevelsList = categoricalFactors.map(f => getSafeCategoricalLevels(f));
          let catCombs: (string | number)[][] = [[]];
          for (const levels of catLevelsList) {
            const nextComb: (string | number)[][] = [];
            for (const comb of catCombs) {
              for (const lvl of levels) {
                nextComb.push([...comb, lvl]);
              }
            }
            catCombs = nextComb;
          }

          let order = 1;
          for (const catComb of catCombs) {
            const catSettings: Record<string, string | number> = {};
            categoricalFactors.forEach((cf, cIdx) => {
              catSettings[cf.id] = catComb[cIdx];
            });

            for (const contRun of ccdContinuousRuns) {
              const runFactors: Record<string, string | number> = { ...contRun, ...catSettings };
              const runResponses: Record<string, null> = {};
              project.responses.forEach(r => runResponses[r.id] = null);
              newRuns.push({
                id: uuidv4(),
                runOrder: order,
                stdOrder: order,
                factors: runFactors,
                responses: runResponses
              });
              order++;
            }
          }

          setLastGeneratedInfo({
            designName: 'Stratified Central Composite Design (CCD)',
            runsCount: newRuns.length,
            notes: `${ccdContinuousRuns.length} continuous RSM points (cube, axial${ccdCenterCount > 0 ? `, ${ccdCenterCount} center` : ''}) replicated across ${catCombs.length} categorical level combination(s)`
          });
        }
      } else {
        // Continuous CCD (alpha = 1)
        const ccdRuns: Run[] = [];
        const numRuns = Math.pow(2, fCount);
        for (let i = 0; i < numRuns; i++) {
          const runFactors: Record<string, number> = {};
          project.factors.forEach((f, idx) => {
            const isHi = (i & (1 << idx)) !== 0;
            runFactors[f.id] = isHi ? f.max : f.min;
          });
          const runResponses: Record<string, null> = {};
          project.responses.forEach(r => runResponses[r.id] = null);
          ccdRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: runFactors, responses: runResponses });
        }
        project.factors.forEach(fAxis => {
          const runFactorsLow: Record<string, number> = {};
          project.factors.forEach(f => {
            runFactorsLow[f.id] = (f.id === fAxis.id) ? f.min : ((f.min + f.max) / 2);
          });
          const runResponsesLow: Record<string, null> = {};
          project.responses.forEach(r => runResponsesLow[r.id] = null);
          ccdRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: runFactorsLow, responses: runResponsesLow });

          const runFactorsHi: Record<string, number> = {};
          project.factors.forEach(f => {
            runFactorsHi[f.id] = (f.id === fAxis.id) ? f.max : ((f.min + f.max) / 2);
          });
          const runResponsesHi: Record<string, null> = {};
          project.responses.forEach(r => runResponsesHi[r.id] = null);
          ccdRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: runFactorsHi, responses: runResponsesHi });
        });
        const ccdCenterCount = project.centerPoints !== undefined ? Math.max(0, project.centerPoints) : 1;
        const cpResult = buildCenterPointRuns(project.factors, project.responses, ccdCenterCount, ccdRuns.length + 1);
        ccdRuns.push(...cpResult.runs);

        newRuns = ccdRuns;
        setLastGeneratedInfo({
          designName: 'Central Composite Design (CCD)',
          runsCount: newRuns.length,
          notes: `Full response surface: factorial cube, axial star points (alpha = 1)${ccdCenterCount > 0 ? `, and ${ccdCenterCount} center point(s)` : ''}`
        });
      }
    } else if (currentDesignType === 'bbd') {
      // Box-Behnken Design (BBD)
      if (hasCategorical) {
        if (continuousFactors.length < 3) {
          setImportStatus({
            type: 'warning',
            message: `Box-Behnken Design requires at least 3 continuous factors (found ${continuousFactors.length}). Generated D-Optimal response surface design instead.`
          });
          const candidateLevelsList: (string | number)[][] = project.factors.map(f => {
            if (f.type === 'categorical') return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
            return [f.min, (f.min + f.max) / 2, f.max];
          });
          const allCandidateRuns = getCartesianRuns(candidateLevelsList);
          const runsToGen = targetRuns === '' ? Math.min(allCandidateRuns.length, 16) : Number(targetRuns);
          const { selectedIndices, dEfficiency } = generateDOptimalSubset(allCandidateRuns, project.factors, runsToGen);
          selectedIndices.forEach((idx, i) => {
            const runResponses: Record<string, null> = {};
            project.responses.forEach(r => runResponses[r.id] = null);
            newRuns.push({ id: uuidv4(), runOrder: i + 1, stdOrder: i + 1, factors: { ...allCandidateRuns[idx] }, responses: runResponses });
          });
          setLastGeneratedInfo({
            designName: 'D-Optimal RSM Design (BBD Alternative)',
            runsCount: newRuns.length,
            dEfficiency,
            notes: 'Generated D-optimal response surface design because Box-Behnken requires at least 3 continuous factors'
          });
        } else {
          // Stratified BBD across categorical combinations
          const bbdContinuousRuns: Record<string, number>[] = [];
          const cCount = continuousFactors.length;
          for (let i = 0; i < cCount - 1; i++) {
            for (let j = i + 1; j < cCount; j++) {
              const combos = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
              combos.forEach(combo => {
                const runFactors: Record<string, number> = {};
                continuousFactors.forEach((f, idx) => {
                  if (idx === i) runFactors[f.id] = combo[0] === 1 ? f.max : f.min;
                  else if (idx === j) runFactors[f.id] = combo[1] === 1 ? f.max : f.min;
                  else runFactors[f.id] = (f.min + f.max) / 2;
                });
                bbdContinuousRuns.push(runFactors);
              });
            }
          }
          const bbdCenterCount = project.centerPoints !== undefined ? Math.max(0, project.centerPoints) : 1;
          for (let cpIdx = 0; cpIdx < bbdCenterCount; cpIdx++) {
            const cpContinuous: Record<string, number> = {};
            continuousFactors.forEach(f => cpContinuous[f.id] = (f.min + f.max) / 2);
            bbdContinuousRuns.push(cpContinuous);
          }

          const catLevelsList = categoricalFactors.map(f => getSafeCategoricalLevels(f));
          let catCombs: (string | number)[][] = [[]];
          for (const levels of catLevelsList) {
            const nextComb: (string | number)[][] = [];
            for (const comb of catCombs) {
              for (const lvl of levels) {
                nextComb.push([...comb, lvl]);
              }
            }
            catCombs = nextComb;
          }

          let order = 1;
          for (const catComb of catCombs) {
            const catSettings: Record<string, string | number> = {};
            categoricalFactors.forEach((cf, cIdx) => {
              catSettings[cf.id] = catComb[cIdx];
            });

            for (const contRun of bbdContinuousRuns) {
              const runFactors: Record<string, string | number> = { ...contRun, ...catSettings };
              const runResponses: Record<string, null> = {};
              project.responses.forEach(r => runResponses[r.id] = null);
              newRuns.push({
                id: uuidv4(),
                runOrder: order,
                stdOrder: order,
                factors: runFactors,
                responses: runResponses
              });
              order++;
            }
          }

          setLastGeneratedInfo({
            designName: 'Stratified Box-Behnken Design (BBD)',
            runsCount: newRuns.length,
            notes: `${bbdContinuousRuns.length} continuous BBD points replicated across ${catCombs.length} categorical level combination(s)`
          });
        }
      } else {
        // Continuous BBD
        const bbdRuns: Run[] = [];
        for (let i = 0; i < fCount - 1; i++) {
          for (let j = i + 1; j < fCount; j++) {
            const combinations = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            combinations.forEach(combo => {
              const runFactors: Record<string, number> = {};
              project.factors.forEach((f, idx) => {
                if (idx === i) runFactors[f.id] = combo[0] === 1 ? f.max : f.min;
                else if (idx === j) runFactors[f.id] = combo[1] === 1 ? f.max : f.min;
                else runFactors[f.id] = (f.min + f.max) / 2;
              });
              const runResponses: Record<string, null> = {};
              project.responses.forEach(r => runResponses[r.id] = null);
              bbdRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: runFactors, responses: runResponses });
            });
          }
        }
        const bbdCenterCount = project.centerPoints !== undefined ? Math.max(0, project.centerPoints) : 1;
        const cpResult = buildCenterPointRuns(project.factors, project.responses, bbdCenterCount, bbdRuns.length + 1);
        bbdRuns.push(...cpResult.runs);

        newRuns = bbdRuns;
        setLastGeneratedInfo({
          designName: 'Box-Behnken Design (BBD)',
          runsCount: newRuns.length,
          notes: `Spherical 3-level response surface design avoiding extreme corners${bbdCenterCount > 0 ? ` (${bbdCenterCount} center pts)` : ''}`
        });
      }
    } else if (currentDesignType === 'plackett_burman') {
      // Plackett-Burman Design (PB)
      if (allCategoricalAre2Level) {
        let seedRow: number[] = [];
        if (fCount <= 11) seedRow = [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1];
        else seedRow = [1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, 1, -1, -1, -1, -1, 1, 1, -1];

        const N = seedRow.length + 1;
        const pbRuns: Run[] = [];

        for (let i = 0; i < N - 1; i++) {
          const runFactors: Record<string, string | number> = {};
          project.factors.forEach((f, idx) => {
            const isHi = idx < seedRow.length ? (seedRow[(idx - i + seedRow.length) % seedRow.length] === 1) : false;
            if (f.type === 'categorical') {
              const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
              runFactors[f.id] = isHi ? (lvls[1] || lvls[0]) : lvls[0];
            } else {
              runFactors[f.id] = isHi ? f.max : f.min;
            }
          });
          const runResponses: Record<string, null> = {};
          project.responses.forEach(r => runResponses[r.id] = null);
          pbRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: runFactors, responses: runResponses });
        }

        const lastRowFactors: Record<string, string | number> = {};
        project.factors.forEach(f => {
          if (f.type === 'categorical') {
            const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
            lastRowFactors[f.id] = lvls[0];
          } else {
            lastRowFactors[f.id] = f.min;
          }
        });
        const lastRowResponses: Record<string, null> = {};
        project.responses.forEach(r => lastRowResponses[r.id] = null);
        pbRuns.push({ id: uuidv4(), runOrder: 0, stdOrder: 0, factors: lastRowFactors, responses: lastRowResponses });

        newRuns = pbRuns;
        setLastGeneratedInfo({
          designName: 'Plackett-Burman Design (PB)',
          runsCount: newRuns.length,
          notes: `Orthogonal 2-level screening matrix (${N} runs)`
        });
      } else {
        // Multi-level categorical: generate 12-run D-optimal screening array (Taguchi equivalent)
        const candidateLevelsList = project.factors.map(f => {
          if (f.type === 'categorical') return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
          return [f.min, f.max];
        });
        const allCandidateRuns = getCartesianRuns(candidateLevelsList);
        const runsToGen = 12;
        const { selectedIndices, dEfficiency } = generateDOptimalSubset(allCandidateRuns, project.factors, runsToGen);
        selectedIndices.forEach((idx, i) => {
          const runResponses: Record<string, null> = {};
          project.responses.forEach(r => runResponses[r.id] = null);
          newRuns.push({ id: uuidv4(), runOrder: i + 1, stdOrder: i + 1, factors: { ...allCandidateRuns[idx] }, responses: runResponses });
        });
        setLastGeneratedInfo({
          designName: '12-Run Screening Design (D-Optimal PB Equivalent)',
          runsCount: newRuns.length,
          dEfficiency,
          notes: 'Orthogonal screening array adapted for 3+ level categorical factors'
        });
      }
    } else if (currentDesignType === 'dsd') {
      // Definitive Screening Design (DSD) from conference matrices (P0.12 / DES-3, P1.20 / DES-6)
      const dsdCp = project.centerPoints !== undefined ? Math.max(0, project.centerPoints) : 1;
      const dsdResult = buildDSD(project.factors, project.responses, dsdCp);
      newRuns = dsdResult.runs;
      if (dsdResult.warning) {
        setImportStatus({ type: 'warning', message: dsdResult.warning });
      }
      setLastGeneratedInfo({
        designName: dsdResult.designName,
        runsCount: newRuns.length,
        dEfficiency: dsdResult.dEfficiency,
        notes: dsdResult.notes
      });
    } else {
      // Two-Level / General Factorial Design (supporting regular 2^(k-p) fractions and mixed-level D-optimal subsets)
      const factorLevelsList: (string | number)[][] = project.factors.map(f => {
        if (f.type === 'categorical') {
          return getSafeCategoricalLevels(f);
        } else {
          return [f.min, f.max];
        }
      });
      const allCandidateRuns = getCartesianRuns(factorLevelsList);
      const numRuns = allCandidateRuns.length;
      const runsToGen = targetRuns === '' ? numRuns : Number(targetRuns);

      if (runsToGen > 0 && runsToGen < numRuns) {
        const regular = buildRegularFraction(project.factors, project.responses, runsToGen, 0);
        if (regular) {
          newRuns = regular.runs;
          setLastGeneratedInfo({
            designName: regular.designName,
            runsCount: newRuns.length,
            notes: regular.notes
          });
        } else {
          // Mixed-level or irregular run count: use D-Optimal subset selection
          const { selectedIndices, dEfficiency, warning } = generateDOptimalSubset(allCandidateRuns, project.factors, runsToGen);
          if (warning) {
            setImportStatus({ type: 'warning', message: warning });
          }
          selectedIndices.forEach((idx, i) => {
            const runResponses: Record<string, null> = {};
            project.responses.forEach(r => runResponses[r.id] = null);
            newRuns.push({
              id: uuidv4(),
              runOrder: i + 1,
              stdOrder: i + 1,
              factors: { ...allCandidateRuns[idx] },
              responses: runResponses
            });
          });
          setLastGeneratedInfo({
            designName: 'D-Optimal Subset Design',
            runsCount: newRuns.length,
            dEfficiency,
            notes: `D-optimal subset of ${runsToGen} runs from ${numRuns} candidate treatments`
          });
        }
      } else {
        // Full Factorial
        allCandidateRuns.forEach((settings, i) => {
          const runResponses: Record<string, null> = {};
          project.responses.forEach(r => runResponses[r.id] = null);
          newRuns.push({
            id: uuidv4(),
            runOrder: i + 1,
            stdOrder: i + 1,
            factors: settings,
            responses: runResponses
          });
        });
        setLastGeneratedInfo({
          designName: hasMultiLevelCategorical ? 'General Mixed-Level Factorial Design' : 'Full Factorial Design',
          runsCount: newRuns.length,
          notes: `Complete orthogonal matrix covering all ${numRuns} treatment combinations`
        });
      }
    }

    // Add Center points for factorial_2level, custom_d_optimal, or plackett_burman using buildCenterPointRuns (P1.20 / DES-6, DES-19, DES-21)
    const cpCount = project.centerPoints || 0;
    if (
      cpCount > 0 &&
      (currentDesignType === 'factorial_2level' ||
        currentDesignType === 'custom_d_optimal' ||
        currentDesignType === 'plackett_burman')
    ) {
      const cpResult = buildCenterPointRuns(project.factors, project.responses, cpCount, newRuns.length + 1);
      if (cpResult.warning) {
        setImportStatus({ type: 'warning', message: cpResult.warning });
      }
      newRuns.push(...cpResult.runs);
    }

    // Assign unique sequential stdOrder = 1..N before Fisher-Yates randomisation (P1.19 / DES-7)
    const stdOrderedRuns = newRuns.map((r, idx) => ({
      ...r,
      stdOrder: idx + 1,
      runOrder: idx + 1,
    }));
    const seed = generateRandomSeed();
    const randomizedRuns = randomize(stdOrderedRuns, seed);

    setLastGeneratedInfo(prev =>
      prev ? { ...prev, runsCount: randomizedRuns.length, randomSeed: seed } : null
    );
    updateProject({ ...project, runs: randomizedRuns, randomSeed: seed });
  };

  const generateRuns = () => {
    if (project.factors.length === 0) return;
    const existingMeasuredCount = countMeasuredValues(project);
    if (existingMeasuredCount > 0) {
      setPendingOverwrite({ type: 'generate', measuredCount: existingMeasuredCount });
      return;
    }
    executeGenerateRuns();
  };


  const addCenterPoints = (count: number = 1) => {
    const maxOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    const cpResult = buildCenterPointRuns(project.factors, project.responses, count, maxOrder + 1);
    if (cpResult.warning) {
      setImportStatus({ type: 'warning', message: cpResult.warning });
    }
    if (cpResult.runs.length > 0) {
      updateProject({ ...project, runs: [...project.runs, ...cpResult.runs] });
    }
    setShowAugmentMenu(false);
  };

  const addAxialPoints = () => {
    const maxOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    const axialResult = buildAxialPointRuns(project.factors, project.responses, maxOrder + 1);
    if (axialResult.warning) {
      setImportStatus({ type: 'warning', message: axialResult.warning });
    }
    if (axialResult.runs.length > 0) {
      updateProject({ ...project, runs: [...project.runs, ...axialResult.runs] });
    }
    setShowAugmentMenu(false);
  };

  const replicateDesign = () => {
    let currentOrder = Math.max(0, ...project.runs.map(r => r.runOrder));
    const newRuns: Run[] = project.runs.map(run => {
      currentOrder++;
      return {
        ...run,
        id: uuidv4(),
        runOrder: currentOrder,
        stdOrder: currentOrder,
        responses: Object.keys(run.responses).reduce((acc, key) => ({ ...acc, [key]: null }), {})
      };
    });
    updateProject({ ...project, runs: [...project.runs, ...newRuns] });
    setShowAugmentMenu(false);
  };

  const addEmptyRun = () => {
    const f: Record<string, string | number> = {};
    project.factors.forEach(fac => {
      f[fac.id] = fac.type === 'categorical' ? getSafeCategoricalLevels(fac)[0] : fac.min;
    });
    const r: Record<string, null> = {};
    project.responses.forEach(res => r[res.id] = null);
    
    const newRun: Run = {
      id: uuidv4(),
      runOrder: project.runs.length + 1,
      stdOrder: project.runs.length + 1,
      factors: f,
      responses: r
    };
    updateProject({ ...project, runs: [...project.runs, newRun] });
  };


  const updateRunResponse = (runId: string, respId: string, value: number | string | null) => {
    let val: number | null;
    if (value === null || value === undefined || value === '') {
      val = null;
    } else if (typeof value === 'number') {
      val = isNaN(value) ? null : value;
    } else {
      const clean = String(value).replace(/,/g, '.');
      const num = parseFloat(clean);
      val = isNaN(num) ? null : num;
    }
    const newRuns = project.runs.map(run => {
      if (run.id === runId) {
        return { ...run, responses: { ...run.responses, [respId]: val } };
      }
      return run;
    });
    updateProject({ ...project, runs: newRuns });
  };

  const updateRunFactor = (runId: string, factorId: string, value: string | number | null) => {
    const factor = project.factors.find(f => f.id === factorId);
    let val: string | number;
    if (factor?.type === 'categorical') {
      val = String(value ?? '');
    } else {
      if (typeof value === 'number') {
        val = isNaN(value) ? (factor?.min ?? 0) : value;
      } else if (value === null || value === undefined || value === '') {
        val = factor?.min ?? 0;
      } else {
        const clean = String(value).replace(/,/g, '.');
        const num = parseFloat(clean);
        val = isNaN(num) ? (factor?.min ?? 0) : num;
      }
    }
    const newRuns = project.runs.map(run => {
      if (run.id === runId) {
        return { ...run, factors: { ...run.factors, [factorId]: val } };
      }
      return run;
    });
    updateProject({ ...project, runs: newRuns });
  };

  const deleteRun = (id: string) => {
    updateProject({ ...project, runs: project.runs.filter(r => r.id !== id) });
  };

  if (project.factors.length === 0) {
    return <div className="p-8 text-center text-[11px] text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">
      {locale === 'zh' ? '请先在“参数设置”页面定义实验因素。' : 'Please define factors in the Setup tab first.'}
    </div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Design Configuration Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Settings2 size={16} className="text-brand-600" /> {locale === 'zh' ? '实验设计方案配置' : 'Design Configuration'}
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6 mb-4">
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-2">
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">
                  {locale === 'zh' ? '实验设计类型' : 'Design Type'}
                </label>
                <select 
                  value={project.designType || 'factorial_2level'} 
                  onChange={e => {
                    const newType = e.target.value as DesignType;
                    let newTarget: number | '' = recommendedRuns;
                    if (newType === 'custom_d_optimal') {
                      newTarget = Math.min(fullRuns, Math.max(pMain + 3, 12));
                    } else if (newType === 'plackett_burman') {
                      newTarget = project.factors.length <= 11 ? 12 : 20;
                    } else if (newType === 'ccd') {
                      newTarget = hasCategorical ? totalStratifiedCCDRuns : continuousCCDRuns;
                    } else if (newType === 'bbd') {
                      newTarget = hasCategorical ? totalStratifiedBBDRuns : continuousBBDRuns;
                    } else {
                      newTarget = fullRuns;
                    }
                    setTargetRuns(newTarget);
                    updateProject({ ...project, designType: newType });
                  }}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="factorial_2level">{locale === 'zh' ? '两水平析因设计 (Two-Level / Factorial)' : 'Two-Level / General Factorial Design'}</option>
                  <option value="dsd">{locale === 'zh' ? '确定性筛选设计 (DSD)' : 'Definitive Screening Design (DSD)'}</option>
                  <option value="ccd">{locale === 'zh' ? '中心复合响应面设计 (CCD) / 分层 RSM' : 'Central Composite Design (CCD) / Stratified RSM'}</option>
                  <option value="bbd">{locale === 'zh' ? 'Box-Behnken 响应面设计 (BBD) / 分层 RSM' : 'Box-Behnken Design (BBD) / Stratified RSM'}</option>
                  <option value="plackett_burman">{locale === 'zh' ? 'Plackett-Burman 快速筛选 (PB)' : 'Plackett-Burman Design (PB)'}</option>
                  <option value="custom_d_optimal">{locale === 'zh' ? 'D-最优定制设计 (D-Optimal，推荐混合/多水平类别)' : 'D-Optimal Custom Design (Recommended for Mixed / Categorical)'}</option>
                </select>
              </div>
              <div className="shrink-0 flex items-center">
                <button onClick={generateRuns} className="w-full md:w-auto text-[11px] font-bold uppercase tracking-widest text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded transition-colors shadow-sm h-[32px]">
                  {locale === 'zh' ? '生成实验矩阵' : 'Generate Design Matrix'}
                </button>
              </div>
            </div>
            
            <p className="text-[9px] text-slate-500 dark:text-slate-300 mt-2">
              {locale === 'zh' ? '选择生成试验批次所采用的统计实验设计方法。' : 'Select the statistical design methodology to use for generating runs.'}
              {project.designType === 'custom_d_optimal' && (
                <span className="block mt-1 text-purple-700 dark:text-purple-300">
                  <strong>{locale === 'zh' ? 'D-最优定制设计 (D-Optimal):' : 'D-Optimal Custom Design:'}</strong> {locale === 'zh' ? '混合连续与类别因素实验的业界黄金标准。采用坐标交换算法，在所有可能的处理组合中精确挑选统计信息量最大 (|XᵀX| D-效率) 的试验子集，允许用户定制试验批次预算。' : 'The gold standard for experiments with mixed continuous and categorical factors. It uses coordinate exchange algorithms to select the exact subset of runs that maximizes statistical information (|XᵀX| D-efficiency), allowing a customized run budget instead of a large full factorial.'}
                </span>
              )}
              {project.designType === 'ccd' && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400">
                  <strong>{locale === 'zh' ? '中心复合响应面设计 (CCD):' : 'Central Composite Design:'}</strong> {locale === 'zh' ? '用于拟合二阶二次多项式响应曲面 (RSM)。' : 'Fits a second-order quadratic model for Response Surface Methodology (RSM).'} {hasCategorical ? (locale === 'zh' ? '针对包含类别变量的实验，生成分层 CCD 设计（在各个分类水平组合下重复连续变量的立方体、轴向星号与中心点试验）。' : 'For experiments with categorical factors, it generates a Stratified CCD (continuous cube, axial, and center points evaluated across categorical factor levels).') : (locale === 'zh' ? '结合析因角点、星号轴向点与中心点。' : 'Combines factorial corner points, axial star points, and center points.')}
                </span>
              )}
              {project.designType === 'bbd' && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400">
                  <strong>{locale === 'zh' ? 'Box-Behnken 响应面设计 (BBD):' : 'Box-Behnken Design:'}</strong> {locale === 'zh' ? '一种球形三水平响应面设计，有效避开极端的角点工况。' : 'A 3-level spherical response surface design avoiding extreme corners.'} {hasCategorical ? (locale === 'zh' ? '连续因素构成 BBD 结构，并在各个类别水平下分层展开。' : 'Continuous factors form the BBD structure, replicated across categorical levels.') : (locale === 'zh' ? '数学上要求至少包含 3 个连续变量因素。' : 'Requires at least 3 continuous factors.')}
                </span>
              )}
              {project.designType === 'plackett_burman' && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400">
                  <strong>{locale === 'zh' ? 'Plackett-Burman 筛选设计 (PB):' : 'Plackett-Burman Design:'}</strong> {locale === 'zh' ? '高效的两水平正交筛选矩阵（批次数为 4 的倍数，如 12 批次）。' : 'Efficient screening design in run sizes of multiples of 4 (e.g. 12 runs).'} {hasMultiLevelCategorical ? (locale === 'zh' ? '通过 D-最优算法自动适配 3 个或更多水平的类别变量（12 批次等效）。' : 'Adapted via D-Optimal screening to support 3+ level categorical factors in 12 runs.') : (locale === 'zh' ? '原生高效筛选连续变量与两水平类别变量。' : 'Natively screens continuous and 2-level categorical factors.')}
                </span>
              )}
              {project.designType === 'dsd' && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400">
                  <strong>{locale === 'zh' ? '确定性筛选设计 (DSD):' : 'Definitive Screening Design:'}</strong> {locale === 'zh' ? '每个连续因素包含三个水平并配合折叠对 (Foldover Pairs)，在不混杂二阶交互作用的前提下有效检测曲率弯曲效应。' : 'Uses three levels per continuous factor with foldover pairs to detect curvature without two-factor interaction confounding.'}
                </span>
              )}
              {(!project.designType || project.designType === 'factorial_2level') && (
                <span className="block mt-1 text-slate-600 dark:text-slate-400">
                  <strong>{locale === 'zh' ? '通用析因设计 (Factorial):' : 'General Factorial Design:'}</strong> {hasMultiLevelCategorical ? (locale === 'zh' ? `构建全部 ${fullRuns} 个连续与多水平类别因素正交处理组合，或生成分辨率最优的部分析因方案。` : `Constructs all ${fullRuns} treatment combinations across your continuous and multi-level categorical factors, or generates resolution-optimal fractional subsets.`) : (locale === 'zh' ? '标准两水平析因设计，用于精确估算主效应与所有二阶交互效应。' : 'Standard two-level factorial design for estimating main effects and all interactions.')}
                </span>
              )}
            </p>

            {/* Design Type Specific Controls & Information */}
            {project.designType === 'custom_d_optimal' ? (
              <div className="mt-4 p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 text-[11px]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-200">
                    <Sparkles size={15} className="text-purple-600" />
                    <span>{locale === 'zh' ? 'D-最优定制试验批次预算选择' : 'D-Optimal Run Budget Selection'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                    {locale === 'zh' ? `最少需 ${pMain} 次试验 (主效应模型)` : `Min Required: ${pMain} runs (Main Effects)`}
                  </span>
                </div>
                
                <p className="text-purple-800 dark:text-purple-300 text-[10.5px] leading-relaxed mb-3">
                  {locale === 'zh' 
                    ? `请选择计划开展的试验次数。坐标交换算法将从所有 ${fullRuns} 个可能组合中挑选信息量最大、统计效能最高的试验子集：` 
                    : `Choose how many runs you want to conduct. The algorithm will mathematically select the most informative subset from all ${fullRuns} possible treatment combinations:`}
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                    {locale === 'zh' ? '预设方案:' : 'Presets:'}
                  </span>
                  {[
                    { label: locale === 'zh' ? `极简 (${pMain})` : `Min (${pMain})`, val: pMain },
                    { label: locale === 'zh' ? `推荐 (${Math.min(fullRuns, Math.max(pMain + 3, 12))})` : `Recommended (${Math.min(fullRuns, Math.max(pMain + 3, 12))})`, val: Math.min(fullRuns, Math.max(pMain + 3, 12)) },
                    ...(pMain <= 12 && 12 < fullRuns && Math.max(pMain + 3, 12) !== 12 ? [{ label: locale === 'zh' ? '12 批次' : '12 Runs', val: 12 }] : []),
                    ...(pMain <= 16 && 16 < fullRuns ? [{ label: locale === 'zh' ? '16 批次' : '16 Runs', val: 16 }] : []),
                    ...(pMain <= 20 && 20 < fullRuns ? [{ label: locale === 'zh' ? '20 批次' : '20 Runs', val: 20 }] : []),
                    ...(pMain <= 24 && 24 < fullRuns ? [{ label: locale === 'zh' ? '24 批次' : '24 Runs', val: 24 }] : []),
                    { label: locale === 'zh' ? `全因子 (${fullRuns})` : `Full (${fullRuns})`, val: fullRuns }
                  ].map((preset, pIdx) => {
                    const isSelected = targetRuns === preset.val;
                    return (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setTargetRuns(preset.val)}
                        className={`px-2.5 py-1 rounded text-[10.5px] font-semibold transition-all ${
                          isSelected 
                            ? 'bg-purple-700 text-white shadow-xs' 
                            : 'bg-white dark:bg-slate-800 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                  <label className="text-[10.5px] font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Sliders size={13} className="text-purple-600" /> {locale === 'zh' ? '自定义试验次数:' : 'Custom Run Count:'}
                  </label>
                  <input
                    type="number"
                    min={pMain}
                    max={fullRuns}
                    value={targetRuns}
                    onChange={e => setTargetRuns(e.target.value === '' ? '' : Math.max(pMain, Number(e.target.value)))}
                    className="w-20 rounded border border-purple-300 dark:border-purple-600 px-2 py-1 text-[11px] font-mono font-bold text-center bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-purple-700 dark:text-purple-300">
                    ({locale === 'zh' ? `最大值: ${fullRuns} 次` : `Max: ${fullRuns} runs`})
                  </span>
                </div>
              </div>
            ) : project.designType === 'ccd' && hasCategorical ? (
              <div className="mt-4 p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                    <Layers size={15} className="text-blue-600" />
                    <span>{locale === 'zh' ? '分层中心复合响应面设计 (含类别因素 RSM)' : 'Stratified Central Composite Design (RSM with Categorical Factors)'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded font-bold">
                    {totalStratifiedCCDRuns} {locale === 'zh' ? '次试验' : 'Total Runs'}
                  </span>
                </div>
                <p className="text-blue-800 dark:text-blue-300/90 text-[10.5px] leading-relaxed">
                  {locale === 'zh' 
                    ? `响应面法 (CCD) 需要连续因素通过轴向星号点评估曲率弯曲。该方案将在全部 ${catCombinationsCount} 个分类水平组合下，分层运行连续变量的 RSM 矩阵（${continuousCCDRuns} 个试验点：立方体角点、轴向点与中心点）。` 
                    : `Response Surface Methodology (CCD) requires continuous factors to evaluate curvature via axial star points. This design runs the continuous RSM matrix (${continuousCCDRuns} points: cube, axial, center) replicated across all ${catCombinationsCount} categorical treatment combination(s).`}
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                  <span className="text-[10px] text-blue-700 dark:text-blue-300">
                    {locale === 'zh' ? '需要更精简的试验批次预算？' : 'Need a smaller run budget?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateProject({ ...project, designType: 'custom_d_optimal' });
                      setTargetRuns(Math.min(fullRuns, Math.max(pMain + 3, 12)));
                    }}
                    className="text-[10.5px] font-bold text-purple-700 hover:text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2.5 py-1 rounded border border-purple-200 dark:border-purple-700 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} /> {locale === 'zh' ? `切换至 D-最优定制设计 (${Math.min(fullRuns, Math.max(pMain + 3, 12))} 次)` : `Switch to D-Optimal Design (${Math.min(fullRuns, Math.max(pMain + 3, 12))} runs)`}
                  </button>
                </div>
              </div>
            ) : project.designType === 'bbd' && hasCategorical ? (
              <div className="mt-4 p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-[11px]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <Layers size={15} className="text-amber-600" />
                    <span>{locale === 'zh' ? '分层 Box-Behnken 响应面设计' : 'Stratified Box-Behnken Design'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-bold">
                    {continuousFactors.length >= 3 ? `${totalStratifiedBBDRuns} ${locale === 'zh' ? '次试验' : 'Total Runs'}` : (locale === 'zh' ? '要求 3 个及以上连续因素' : 'Requires 3+ Continuous Factors')}
                  </span>
                </div>
                {continuousFactors.length >= 3 ? (
                  <p className="text-amber-800 dark:text-amber-300/90 text-[10.5px] leading-relaxed">
                    {locale === 'zh' 
                      ? `${continuousFactors.length} 个连续因素构成球形 Box-Behnken 棱中点与中心点（${continuousBBDRuns} 次试验），在每个分类水平组合（共 ${catCombinationsCount} 组）下分层展开。` 
                      : `Continuous factors (${continuousFactors.length}) form spherical Box-Behnken edge points and center points (${continuousBBDRuns} runs), evaluated across each of the ${catCombinationsCount} categorical level combination(s).`}
                  </p>
                ) : (
                  <p className="text-amber-800 dark:text-amber-300/90 text-[10.5px] leading-relaxed">
                    {locale === 'zh' 
                      ? `Box-Behnken 在数学上要求至少 3 个连续变量（当前为 ${continuousFactors.length} 个）。点击生成将自动创建 D-最优响应面设计，或可切换至中心复合响应面设计 (CCD)。` 
                      : `Box-Behnken mathematically requires at least 3 continuous factors (currently ${continuousFactors.length}). Clicking generate will create a D-Optimal Response Surface Design or you can switch to Central Composite Design (CCD).`}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      updateProject({ ...project, designType: 'custom_d_optimal' });
                      setTargetRuns(Math.min(fullRuns, Math.max(pMain + 3, 12)));
                    }}
                    className="text-[10.5px] font-bold text-purple-700 hover:text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2.5 py-1 rounded border border-purple-200 dark:border-purple-700 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} /> {locale === 'zh' ? '采用 D-最优定制设计' : 'Use D-Optimal Custom Design'}
                  </button>
                </div>
              </div>
            ) : project.designType === 'plackett_burman' && hasMultiLevelCategorical ? (
              <div className="mt-4 p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                    <Info size={15} className="text-blue-600" />
                    <span>{locale === 'zh' ? 'Plackett-Burman 快速筛选 (含 3+ 水平类别因素)' : 'Plackett-Burman Screening (with 3+ Level Categorical Factor)'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded font-bold">
                    {locale === 'zh' ? '12 次试验' : '12 Runs'}
                  </span>
                </div>
                <p className="text-blue-800 dark:text-blue-300/90 text-[10.5px] leading-relaxed">
                  {locale === 'zh' 
                    ? '经典 PB 设计为纯两水平正交表。由于本实验包含多水平类别变量，系统将自动基于 D-最优算法构建 12 批次等效筛选矩阵，具备最优统计正交性。' 
                    : 'Classical Plackett-Burman designs are strictly 2-level orthogonal arrays. Because your experiment has a 3-level categorical factor, generating will construct a 12-run D-Optimal Screening Design (the exact multi-level equivalent of Plackett-Burman / Taguchi arrays) with maximum statistical orthogonality.'}
                </p>
              </div>
            ) : (!project.designType || project.designType === 'factorial_2level') && allCategoricalAre2Level ? (
              <div className="mt-4">
                <TwoLevelDesignSelector 
                  factorsCount={project.factors.length} 
                  selectedRuns={targetRuns} 
                  onSelectRuns={(runs) => setTargetRuns(runs)} 
                />
              </div>
            ) : (!project.designType || project.designType === 'factorial_2level') && hasMultiLevelCategorical ? (
              <div className="mt-4 p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 text-[11px]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-200">
                    <Layers size={15} className="text-purple-600" />
                    <span>{locale === 'zh' ? '通用混合水平全因子设计' : 'General Mixed-Level Factorial Design'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded font-bold">
                    {fullRuns} {locale === 'zh' ? '个处理组合' : 'Treatment Combinations'}
                  </span>
                </div>
                <p className="text-purple-800 dark:text-purple-300/90 text-[10.5px] leading-relaxed mb-2.5">
                  {locale === 'zh' 
                    ? `实验包含 3 个或更多水平的类别变量。全因子设计将构建全部 ${fullRuns} 个正交处理组合。` 
                    : `Your experiment contains categorical factor(s) with 3+ levels. Full Factorial will construct all ${fullRuns} orthogonal treatment combinations.`}
                </p>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                  <span className="text-[10px] text-purple-700 dark:text-purple-300">
                    {locale === 'zh' ? '想要精确控制更少试验批次（如 12 或 16 批次）？' : 'Want an exact reduced run budget (e.g. 12 or 16 runs)?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateProject({ ...project, designType: 'custom_d_optimal' });
                      setTargetRuns(Math.min(fullRuns, Math.max(pMain + 3, 12)));
                    }}
                    className="text-[10.5px] font-bold text-purple-700 hover:text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2.5 py-1 rounded border border-purple-300 dark:border-purple-700 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} className="text-purple-600" /> {locale === 'zh' ? '选择 D-最优定制批次数' : 'Select D-Optimal Custom Runs'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          
          <div className="flex items-center justify-center shrink-0">
            <DesignCube 
              designType={project.designType || 'factorial_2level'} 
              isFractional={typeof targetRuns === 'number' && targetRuns < fullRuns}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col flex-1">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
              {locale === 'zh' ? '实验矩阵与试验结果录入' : 'Design Matrix Results'}
            </span>
            {project.randomSeed !== undefined && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                title={t('random_seed')}
              >
                {t('random_seed')}: {project.randomSeed}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded transition-colors inline-flex items-center gap-1 shadow-sm"
              title={locale === 'zh' ? '从 Excel 表格导入试验批次与响应数据' : 'Import runs and values from an Excel spreadsheet'}
            >
              <Upload size={14} /> {locale === 'zh' ? '导入 Excel' : 'Load Excel'}
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowAugmentMenu(!showAugmentMenu)}
                className="text-[11px] font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-2.5 py-1.5 rounded transition-colors inline-flex items-center gap-1 shadow-sm"
                title={locale === 'zh' ? '拓展实验设计' : 'Augment Design'}
              >
                {locale === 'zh' ? '拓展实验设计' : 'Augment Design'} <ChevronDown size={14} />
              </button>
              {showAugmentMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <button onClick={replicateDesign} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <Copy size={13} className="text-slate-400" /> {locale === 'zh' ? '复制完整试验批次' : 'Replicate Design'}
                  </button>
                  <button onClick={() => addCenterPoints(3)} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <CircleDot size={13} className="text-slate-400" /> {locale === 'zh' ? '添加 3 个中心点' : 'Add 3 Center Points'}
                  </button>
                  <button onClick={addAxialPoints} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                    <Star size={13} className="text-slate-400" /> {locale === 'zh' ? '添加星号轴向点 (Face-Centered)' : 'Add Axial Points (Face-Centered)'}
                  </button>
                </div>
              )}
            </div>
            <button onClick={addEmptyRun} className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded transition-colors inline-flex items-center gap-1 shadow-sm">
              <Plus size={14} /> {locale === 'zh' ? '添加空试验批次' : 'Add Empty Run'}
            </button>
          </div>
        </div>

        {importStatus && (
          <div className={`p-3 border-b text-[11px] flex items-center justify-between gap-2 ${
            importStatus.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/50' 
              : importStatus.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-100 dark:border-amber-900/50'
                : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-100 dark:border-red-900/50'
          }`}>
            <div className="flex items-center gap-2">
              {importStatus.type === 'success' ? (
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={14} className={`shrink-0 ${importStatus.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`} />
              )}
              <span>{importStatus.message}</span>
            </div>
            <button onClick={() => setImportStatus(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        {lastGeneratedInfo && (
          <div className="p-2.5 px-3 bg-purple-50/80 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800/60 flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">{lastGeneratedInfo.designName}:</span>{' '}
                <span className="text-slate-600 dark:text-slate-300">
                  {locale === 'zh' ? `已生成 ${lastGeneratedInfo.runsCount} 次试验批次。` : `Generated ${lastGeneratedInfo.runsCount} experimental runs.`}
                </span>
                {lastGeneratedInfo.dEfficiency !== undefined && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    {lastGeneratedInfo.dEfficiency !== null
                      ? `${lastGeneratedInfo.dEfficiency}% ${locale === 'zh' ? 'D-效率' : 'D-Efficiency'}`
                      : `${locale === 'zh' ? 'D-效率' : 'D-Efficiency'}: ${t('not_estimable')}`}
                  </span>
                )}
                {lastGeneratedInfo.randomSeed !== undefined && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    {t('random_seed')}: {lastGeneratedInfo.randomSeed}
                  </span>
                )}
                {lastGeneratedInfo.notes && (
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{lastGeneratedInfo.notes}</span>
                )}
              </div>
            </div>
            <button onClick={() => setLastGeneratedInfo(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 font-mono text-[10px]">
              <tr>
                <th scope="col" className="p-2 border-r font-medium w-12 text-center">{locale === 'zh' ? '批次' : 'Run'}</th>
                <th scope="col" className="p-2 border-r border-slate-200 dark:border-slate-600 font-medium text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/30 text-center w-24">{locale === 'zh' ? '编码模式' : 'Pattern'}</th>
                {project.factors.map(f => (
                  <th key={f.id} scope="col" className="p-2 border-r border-slate-200 dark:border-slate-600 font-medium text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-900/30">
                    {f.name} {f.type === 'categorical' ? (
                      <span className="text-[9px] text-purple-600 dark:text-purple-300 font-normal">({f.levels?.length || 2} {locale === 'zh' ? '水平' : 'levels'})</span>
                    ) : (
                      <span className="text-[9px] text-brand-500 dark:text-brand-400 font-normal">({f.min}-{f.max})</span>
                    )}
                  </th>
                ))}
                {project.responses.map(r => (
                  <th key={r.id} scope="col" className="p-2 border-r border-slate-200 dark:border-slate-600 font-medium text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/30">
                    {r.name}
                  </th>
                ))}
                <th scope="col" className="p-2 font-medium w-8 border-slate-200 dark:border-slate-600"></th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-slate-100 dark:divide-slate-700 text-[11px]">
              {project.runs.map((run) => {
                const pattern = getRunPattern(run, project.factors);
                const isCenter = project.factors.every(f => {
                  if (f.type === 'categorical') return true;
                  const val = Number(run.factors[f.id]);
                  if (isNaN(val)) return false;
                  const center = (f.min + f.max) / 2;
                  return Math.abs(val - center) < 1e-6;
                });
                return (
                <tr key={run.id} className={`transition-colors ${isCenter ? 'bg-amber-100/80 dark:bg-amber-900/40 hover:bg-amber-200/80 dark:hover:bg-amber-900/60' : 'hover:bg-brand-50/50 dark:hover:bg-brand-900/30'}`}>
                  <td className={`p-2 border-r border-slate-200 dark:border-slate-600 relative text-center ${isCenter ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-300'}`}>
                    {String(run.runOrder).padStart(2, '0')}
                    {isCenter && <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/50 shadow-sm" title={locale === 'zh' ? '中心点 (Center Point)' : 'Center Point'} />}
                  </td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-600 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                    <span 
                      className="inline-block px-1.5 py-0.5 rounded bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/50 text-[11px] tracking-widest cursor-default select-all"
                      title={locale === 'zh' ? `试验模式: ${pattern} (+: 高, -: 低, ○: 中心点)` : `Run Pattern: ${pattern} (+: High, -: Low, ○: Center)`}
                    >
                      {pattern}
                    </span>
                  </td>
                  {project.factors.map(f => (
                    <td key={f.id} className="p-2 border-r border-slate-200 dark:border-slate-600">
                      {f.type === 'categorical' ? (
                        <select
                          value={String(run.factors[f.id] ?? (f.levels ? f.levels[0] : ''))}
                          onChange={e => updateRunFactor(run.id, f.id, e.target.value)}
                          className="w-24 bg-transparent border-b border-purple-300 dark:border-purple-600 px-1 py-0.5 focus:outline-none focus:border-brand-500 text-purple-700 dark:text-purple-300 font-medium text-[10.5px]"
                        >
                          {(f.levels || ['Level 1', 'Level 2']).map((lvl, lIdx) => (
                            <option key={lIdx} value={lvl} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {lvl}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <DecimalInput 
                          key={`${run.id}_${f.id}`}
                          value={run.factors[f.id]} 
                          onChange={val => updateRunFactor(run.id, f.id, val)}
                          className="w-16 border-b border-slate-300 dark:border-slate-600 bg-transparent px-1 py-0.5 focus:border-brand-500 dark:focus:border-brand-400 focus:outline-none dark:text-slate-100 font-mono text-[11px]"
                          placeholder="0"
                        />
                      )}
                    </td>
                  ))}
                  {project.responses.map(r => (
                    <td key={r.id} className="p-2 border-r border-slate-200 dark:border-slate-600">
                      <DecimalInput 
                        key={`${run.id}_${r.id}`}
                        value={run.responses[r.id]} 
                        onChange={val => updateRunResponse(run.id, r.id, val)}
                        className="w-20 border border-purple-200 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/30 rounded px-1.5 py-0.5 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none font-bold text-brand-600 dark:text-brand-400 dark:placeholder-slate-500 font-mono text-[11px]"
                        placeholder={locale === 'zh' ? '待录入...' : 'Pending...'}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button onClick={() => deleteRun(run.id)} className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                );
              })}
              {project.runs.length === 0 && (
                <tr>
                  <td colSpan={project.factors.length + project.responses.length + 3} className="p-4 text-center text-slate-500 dark:text-slate-300">
                    {locale === 'zh' ? '暂未生成试验批次。请点击“生成实验矩阵”或“添加空试验批次”。' : 'No runs defined. Generate a design or add an empty run.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pendingOverwrite !== null}
        title={t('confirm_overwrite_runs_title')}
        message={
          pendingOverwrite?.type === 'import'
            ? t('confirm_overwrite_import_msg')
                .replace('{sheet}', pendingOverwrite.sheetName)
                .replace('{count}', String(pendingOverwrite.measuredCount))
            : t('confirm_overwrite_generate_msg').replace(
                '{count}',
                String(pendingOverwrite?.measuredCount ?? 0)
              )
        }
        confirmLabel={t('confirm_overwrite_button')}
        cancelLabel={t('cancel')}
        destructive={true}
        onConfirm={() => {
          if (!pendingOverwrite) return;
          if (pendingOverwrite.type === 'generate') {
            executeGenerateRuns();
          } else {
            commitImportedRuns(
              pendingOverwrite.runs,
              pendingOverwrite.sheetName,
              pendingOverwrite.warnings
            );
          }
          setPendingOverwrite(null);
        }}
        onCancel={() => setPendingOverwrite(null)}
      />
    </div>
  );
}
