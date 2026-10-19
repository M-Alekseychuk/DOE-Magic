export type FactorType = 'numeric' | 'categorical';
export type DesignType = 'factorial_2level' | 'dsd' | 'ccd' | 'bbd' | 'plackett_burman' | 'custom_d_optimal';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Factor {
  id: string;
  name: string;
  type: FactorType;
  min: number;
  max: number;
  levels?: string[]; // for categorical
  unit: string;
}

export interface Response {
  id: string;
  name: string;
  goal: 'maximize' | 'minimize' | 'target';
  targetValue?: number;
  unit: string;
  excludedTerms?: string[];
}

export interface Run {
  id: string;
  runOrder: number;
  stdOrder: number;
  factors: Record<string, string | number>;
  responses: Record<string, number | null>;
}

export interface Project {
  id: string;
  folderId?: string;
  name: string;
  description: string;
  factors: Factor[];
  responses: Response[];
  runs: Run[];
  centerPoints?: number;
  designType?: DesignType;
  optimizationResults?: string;
  optimizationCandidates?: Record<string, string | number>[];
  robustnessState?: any;
  isArchived?: boolean;
  createdAt: number;
  updatedAt: number;
}
