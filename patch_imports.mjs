import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Add imports
const importsTarget = `import createPlotlyComponent from 'react-plotly.js/factory';`;
const importsNew = `import createPlotlyComponent from 'react-plotly.js/factory';
import { ActualByPredictedPlot, StudentizedResidualsPlot } from './ResidualsPlots';
import { PredictionProfiler } from './PredictionProfiler';`;

content = content.replace(importsTarget, importsNew);

// Add components after Main Effects Plot
const insertionTarget = `                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>`;
        
const insertionNew = `                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Prediction Profiler */}
        <PredictionProfiler project={project} analysisResults={analysisResults} />

        {/* Diagnostic Plots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActualByPredictedPlot actualByPredicted={analysisResults.actualByPredicted} projectName={project.name} />
          <StudentizedResidualsPlot studentizedResiduals={analysisResults.studentizedResiduals} projectName={project.name} />
        </div>`;

content = content.replace(insertionTarget, insertionNew);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('done updating ProjectAnalysis.tsx');
