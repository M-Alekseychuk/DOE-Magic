import { Project, Folder } from '../types';

export const demoFolder: Folder = {
  id: 'folder-coupling',
  name: 'Catalytic Coupling Development',
  createdAt: 1712000000000,
};

// Comprehensive Mixed-Level General Factorial (Numerical & Categorical Factors)
export const demoCatalyticProject: Project = {
  id: 'proj-suzuki-cross-coupling',
  folderId: 'folder-coupling',
  name: 'Suzuki-Miyaura Cross-Coupling API Optimization',
  description: 'Industrial mixed-level Factorial DOE investigating Reaction Temperature (70–95 °C), Catalyst Loading (0.5–2.5 mol%), Reaction Time (2–6 h), and Solvent System (3-level Categorical: Ethanol, 2-MeTHF, Toluene) on Crude Yield (%) and HPLC Purity (%). Includes replicated center points for Pure Error and Lack of Fit evaluation.',
  centerPoints: 3,
  designType: 'factorial_2level',
  createdAt: 1712000000000,
  updatedAt: 1712000000000,
  factors: [
    {
      id: 'f1',
      name: 'Temperature',
      type: 'numeric',
      min: 70,
      max: 95,
      unit: '°C'
    },
    {
      id: 'f2',
      name: 'Catalyst Loading',
      type: 'numeric',
      min: 0.5,
      max: 2.5,
      unit: 'mol%'
    },
    {
      id: 'f3',
      name: 'Reaction Time',
      type: 'numeric',
      min: 2.0,
      max: 6.0,
      unit: 'h'
    },
    {
      id: 'f4',
      name: 'Solvent',
      type: 'categorical',
      min: 0,
      max: 2,
      levels: ['Ethanol', '2-MeTHF', 'Toluene'],
      unit: ''
    }
  ],
  responses: [
    {
      id: 'r1',
      name: 'Yield',
      goal: 'maximize',
      targetValue: 96.0,
      unit: '%'
    },
    {
      id: 'r2',
      name: 'Purity',
      goal: 'maximize',
      targetValue: 99.5,
      unit: '%'
    }
  ],
  runs: [
    {
      id: 'run-1',
      stdOrder: 1,
      runOrder: 23,
      factors: { f1: 70, f2: 0.5, f3: 2.0, f4: 'Ethanol' },
      responses: { r1: 60.0, r2: 99.8 }
    },
    {
      id: 'run-2',
      stdOrder: 2,
      runOrder: 11,
      factors: { f1: 70, f2: 0.5, f3: 6.0, f4: 'Ethanol' },
      responses: { r1: 66.6, r2: 99.8 }
    },
    {
      id: 'run-3',
      stdOrder: 3,
      runOrder: 4,
      factors: { f1: 70, f2: 2.5, f3: 2.0, f4: 'Ethanol' },
      responses: { r1: 73.6, r2: 99.8 }
    },
    {
      id: 'run-4',
      stdOrder: 4,
      runOrder: 19,
      factors: { f1: 70, f2: 2.5, f3: 6.0, f4: 'Ethanol' },
      responses: { r1: 80.3, r2: 98.8 }
    },
    {
      id: 'run-5',
      stdOrder: 5,
      runOrder: 6,
      factors: { f1: 95, f2: 0.5, f3: 2.0, f4: 'Ethanol' },
      responses: { r1: 74.7, r2: 98.4 }
    },
    {
      id: 'run-6',
      stdOrder: 6,
      runOrder: 26,
      factors: { f1: 95, f2: 0.5, f3: 6.0, f4: 'Ethanol' },
      responses: { r1: 82.0, r2: 98.4 }
    },
    {
      id: 'run-7',
      stdOrder: 7,
      runOrder: 13,
      factors: { f1: 95, f2: 2.5, f3: 2.0, f4: 'Ethanol' },
      responses: { r1: 81.6, r2: 98.2 }
    },
    {
      id: 'run-8',
      stdOrder: 8,
      runOrder: 22,
      factors: { f1: 95, f2: 2.5, f3: 6.0, f4: 'Ethanol' },
      responses: { r1: 89.0, r2: 97.0 }
    },
    {
      id: 'run-9',
      stdOrder: 9,
      runOrder: 2,
      factors: { f1: 70, f2: 0.5, f3: 2.0, f4: '2-MeTHF' },
      responses: { r1: 70.9, r2: 99.8 }
    },
    {
      id: 'run-10',
      stdOrder: 10,
      runOrder: 10,
      factors: { f1: 70, f2: 0.5, f3: 6.0, f4: '2-MeTHF' },
      responses: { r1: 77.9, r2: 99.8 }
    },
    {
      id: 'run-11',
      stdOrder: 11,
      runOrder: 27,
      factors: { f1: 70, f2: 2.5, f3: 2.0, f4: '2-MeTHF' },
      responses: { r1: 84.8, r2: 99.8 }
    },
    {
      id: 'run-12',
      stdOrder: 12,
      runOrder: 1,
      factors: { f1: 70, f2: 2.5, f3: 6.0, f4: '2-MeTHF' },
      responses: { r1: 91.4, r2: 98.8 }
    },
    {
      id: 'run-13',
      stdOrder: 13,
      runOrder: 3,
      factors: { f1: 95, f2: 0.5, f3: 2.0, f4: '2-MeTHF' },
      responses: { r1: 87.4, r2: 97.9 }
    },
    {
      id: 'run-14',
      stdOrder: 14,
      runOrder: 24,
      factors: { f1: 95, f2: 0.5, f3: 6.0, f4: '2-MeTHF' },
      responses: { r1: 93.8, r2: 98.1 }
    },
    {
      id: 'run-15',
      stdOrder: 15,
      runOrder: 21,
      factors: { f1: 95, f2: 2.5, f3: 2.0, f4: '2-MeTHF' },
      responses: { r1: 94.5, r2: 97.7 }
    },
    {
      id: 'run-16',
      stdOrder: 16,
      runOrder: 15,
      factors: { f1: 95, f2: 2.5, f3: 6.0, f4: '2-MeTHF' },
      responses: { r1: 98.8, r2: 96.6 }
    },
    {
      id: 'run-17',
      stdOrder: 17,
      runOrder: 12,
      factors: { f1: 70, f2: 0.5, f3: 2.0, f4: 'Toluene' },
      responses: { r1: 65.6, r2: 99.4 }
    },
    {
      id: 'run-18',
      stdOrder: 18,
      runOrder: 16,
      factors: { f1: 70, f2: 0.5, f3: 6.0, f4: 'Toluene' },
      responses: { r1: 72.4, r2: 99.2 }
    },
    {
      id: 'run-19',
      stdOrder: 19,
      runOrder: 5,
      factors: { f1: 70, f2: 2.5, f3: 2.0, f4: 'Toluene' },
      responses: { r1: 78.6, r2: 99.2 }
    },
    {
      id: 'run-20',
      stdOrder: 20,
      runOrder: 9,
      factors: { f1: 70, f2: 2.5, f3: 6.0, f4: 'Toluene' },
      responses: { r1: 85.9, r2: 97.9 }
    },
    {
      id: 'run-21',
      stdOrder: 21,
      runOrder: 14,
      factors: { f1: 95, f2: 0.5, f3: 2.0, f4: 'Toluene' },
      responses: { r1: 84.9, r2: 94.9 }
    },
    {
      id: 'run-22',
      stdOrder: 22,
      runOrder: 7,
      factors: { f1: 95, f2: 0.5, f3: 6.0, f4: 'Toluene' },
      responses: { r1: 91.7, r2: 95.0 }
    },
    {
      id: 'run-23',
      stdOrder: 23,
      runOrder: 18,
      factors: { f1: 95, f2: 2.5, f3: 2.0, f4: 'Toluene' },
      responses: { r1: 92.1, r2: 94.6 }
    },
    {
      id: 'run-24',
      stdOrder: 24,
      runOrder: 20,
      factors: { f1: 95, f2: 2.5, f3: 6.0, f4: 'Toluene' },
      responses: { r1: 98.6, r2: 93.4 }
    },
    {
      id: 'run-25',
      stdOrder: 25,
      runOrder: 17,
      factors: { f1: 82.5, f2: 1.5, f3: 4.0, f4: '2-MeTHF' },
      responses: { r1: 89.2, r2: 98.9 }
    },
    {
      id: 'run-26',
      stdOrder: 26,
      runOrder: 25,
      factors: { f1: 82.5, f2: 1.5, f3: 4.0, f4: '2-MeTHF' },
      responses: { r1: 88.6, r2: 99.1 }
    },
    {
      id: 'run-27',
      stdOrder: 27,
      runOrder: 8,
      factors: { f1: 82.5, f2: 1.5, f3: 4.0, f4: '2-MeTHF' },
      responses: { r1: 89.4, r2: 98.8 }
    }
  ]
};

export const sampleProjects: Project[] = [
  demoCatalyticProject
];

export const sampleFolders: Folder[] = [
  demoFolder
];

// Alias for backwards compatibility
export const sampleProject = demoCatalyticProject;
export const sampleFolder = demoFolder;
