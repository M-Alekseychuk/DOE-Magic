import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Project, Factor, Response, Run, DesignType, Folder } from '../../core/types';
import { generateDesign } from '../../core/design/doeGenerator';
import { computeAnalysis, predictModelResponse, resolveExcludedTerms } from '../../core/analysis/analysisCore';
import { fitProjectModelsById, countMeasuredValues } from '../../core/analysis/projectModels';
import { buildCompleteSearchCandidates } from '../../core/optimization/optimize';

export interface McpDatabaseContext {
  getProjects: () => Project[];
  getFolders: () => Folder[];
  saveProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  saveData: () => void;
  broadcastSync: () => void;
}

// In-memory audit log of MCP interactions for UI inspection
export interface McpActivityLog {
  id: string;
  timestamp: number;
  type: 'tool' | 'resource' | 'prompt';
  name: string;
  params?: any;
  resultSummary?: string;
  success: boolean;
  durationMs: number;
}

export const mcpActivityLogs: McpActivityLog[] = [];

export function recordMcpActivity(log: Omit<McpActivityLog, 'id' | 'timestamp'>) {
  const entry: McpActivityLog = {
    id: uuidv4(),
    timestamp: Date.now(),
    ...log,
  };
  mcpActivityLogs.unshift(entry);
  if (mcpActivityLogs.length > 100) {
    mcpActivityLogs.length = 100;
  }
}

/**
 * Creates and configures the DOE Magic Model Context Protocol (MCP) server
 */
export function createDoeMcpServer(context: McpDatabaseContext) {
  const server = new McpServer(
    {
      name: 'doe-magic-mcp',
      version: '1.5.2',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Exact lookup for write tools and unambiguous resolution (P1.14 / MCP-4):
  // - Rejects empty or whitespace-only identifiers
  // - Matches exact project ID first, then unique case-insensitive exact project name
  // - Throws an "ambiguous" error listing candidate IDs when multiple projects share the same name
  // - Never matches partial substrings
  const findProjectExact = (identifier: string): Project => {
    const raw = String(identifier ?? '');
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('Invalid projectId: identifier cannot be empty or whitespace.');
    }
    const projects = context.getProjects();
    const exactId = projects.find(p => p.id === raw || p.id === trimmed);
    if (exactId) return exactId;

    const lower = trimmed.toLowerCase();
    const nameMatches = projects.filter(p => p.name.trim().toLowerCase() === lower);
    if (nameMatches.length === 1) {
      return nameMatches[0];
    }
    if (nameMatches.length > 1) {
      const candidates = nameMatches.map(p => `'${p.name}' (id: ${p.id})`).join(', ');
      throw new Error(
        `Ambiguous project identifier '${identifier}' matches ${nameMatches.length} projects: ${candidates}. Specify the exact project ID.`
      );
    }
    throw new Error(`Project '${identifier}' not found`);
  };

  // Read-only lookup: exact ID or unique exact name first, then unique substring match
  const findProject = (identifier: string): Project | undefined => {
    const raw = String(identifier ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const projects = context.getProjects();
    const exactId = projects.find(p => p.id === raw || p.id === trimmed);
    if (exactId) return exactId;
    const lower = trimmed.toLowerCase();
    const exactNameMatches = projects.filter(p => p.name.trim().toLowerCase() === lower);
    if (exactNameMatches.length === 1) return exactNameMatches[0];
    if (exactNameMatches.length > 1) {
      const candidates = exactNameMatches.map(p => `'${p.name}' (id: ${p.id})`).join(', ');
      throw new Error(
        `Ambiguous project identifier '${identifier}' matches ${exactNameMatches.length} projects: ${candidates}. Specify the exact project ID.`
      );
    }
    const substrMatches = projects.filter(p => p.name.toLowerCase().includes(lower));
    if (substrMatches.length === 1) return substrMatches[0];
    return undefined;
  };

  // Helper to resolve factor ID by factor name or ID
  const resolveFactorId = (project: Project, key: string): string => {
    const fById = project.factors.find(f => f.id === key);
    if (fById) return fById.id;
    const lower = key.toLowerCase().trim();
    const fByName = project.factors.find(f => f.name.toLowerCase().trim() === lower);
    return fByName ? fByName.id : key;
  };

  // Exact response lookup for write tools (P1.14 / MCP-4): rejects partial keys like 'Yie'
  const resolveResponseExact = (project: Project, key: string): Response => {
    const raw = String(key ?? '');
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('Invalid response key: identifier cannot be empty or whitespace.');
    }
    const rById = project.responses.find(r => r.id === raw || r.id === trimmed);
    if (rById) return rById;

    const lower = trimmed.toLowerCase();
    const matches = project.responses.filter(r => r.name.trim().toLowerCase() === lower);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous response key '${key}' matches multiple responses: ${matches.map(r => `${r.name} (${r.id})`).join(', ')}`
      );
    }
    throw new Error(
      `Response '${key}' not found in project '${project.name}'. Valid responses are: ${project.responses.map(r => `${r.name} (${r.id})`).join(', ')}`
    );
  };

  // Helper to resolve response by ID or exact name (for read tools)
  const resolveResponse = (project: Project, key: string): Response | undefined => {
    const trimmed = String(key ?? '').trim();
    if (!trimmed) return undefined;
    const rById = project.responses.find(r => r.id === key || r.id === trimmed);
    if (rById) return rById;
    const lower = trimmed.toLowerCase();
    return project.responses.find(r => r.name.toLowerCase().trim() === lower);
  };

  // ==========================================
  // MCP TOOLS
  // ==========================================

  // Tool 1: list_projects
  server.tool(
    'list_projects',
    'List all DOE (Design of Experiments) projects, their status, factor counts, response goals, and run counts',
    {
      folderId: z.string().optional().describe('Optional folder ID to filter projects'),
      includeArchived: z.boolean().optional().describe('Whether to include archived projects (default false)'),
    },
    async ({ folderId, includeArchived }) => {
      const startTime = Date.now();
      try {
        let projects = context.getProjects();
        if (!includeArchived) {
          projects = projects.filter(p => !p.isArchived);
        }
        if (folderId) {
          projects = projects.filter(p => p.folderId === folderId);
        }

        const projectSummaries = projects.map(p => {
          const completedRuns = p.runs.filter(r =>
            p.responses.some(resp => r.responses[resp.id] !== null && r.responses[resp.id] !== undefined)
          ).length;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            designType: p.designType || 'factorial_2level',
            factorsCount: p.factors.length,
            factors: p.factors.map(f => ({ name: f.name, type: f.type, unit: f.unit, range: [f.min, f.max] })),
            responsesCount: p.responses.length,
            responses: p.responses.map(r => ({ name: r.name, goal: r.goal, unit: r.unit, target: r.targetValue })),
            totalRuns: p.runs.length,
            completedRuns,
            updatedAt: new Date(p.updatedAt).toISOString(),
          };
        });

        recordMcpActivity({
          type: 'tool',
          name: 'list_projects',
          params: { folderId, includeArchived },
          resultSummary: `Found ${projectSummaries.length} projects`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total: projectSummaries.length,
                projects: projectSummaries,
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'list_projects',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error listing projects: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: get_project
  server.tool(
    'get_project',
    'Get complete details for a specific DOE project, including factors, responses, experimental run matrix, and optimization status',
    {
      projectId: z.string().describe('The project ID or exact project name'),
    },
    async ({ projectId }) => {
      const startTime = Date.now();
      try {
        const project = findProject(projectId);
        if (!project) {
          throw new Error(`Project '${projectId}' not found`);
        }

        recordMcpActivity({
          type: 'tool',
          name: 'get_project',
          params: { projectId },
          resultSummary: `Retrieved project '${project.name}' (${project.runs.length} runs)`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'get_project',
          params: { projectId },
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error retrieving project: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: create_project
  server.tool(
    'create_project',
    'Create a new Design of Experiments (DOE) project with factors, responses, and optional auto-generated design runs',
    {
      name: z.string().describe('Name of the experimental project'),
      description: z.string().optional().describe('Detailed description or research hypothesis'),
      folderId: z.string().optional().describe('Folder ID to organize this project'),
      factors: z.array(
        z.object({
          name: z.string(),
          type: z.enum(['numeric', 'categorical']).default('numeric'),
          min: z.number().default(0),
          max: z.number().default(100),
          levels: z.array(z.string()).optional(),
          unit: z.string().default(''),
        })
      ).describe('List of experimental factors (input variables)'),
      responses: z.array(
        z.object({
          name: z.string(),
          goal: z.enum(['maximize', 'minimize', 'target']).default('maximize'),
          targetValue: z.number().optional(),
          unit: z.string().default(''),
        })
      ).describe('List of measured experimental responses (output variables)'),
      designType: z.enum(['factorial_2level', 'dsd', 'ccd', 'bbd', 'plackett_burman', 'custom_d_optimal']).optional().default('factorial_2level'),
      centerPoints: z.number().optional().default(3).describe('Number of replicate center points for curvature / pure error testing'),
      autoGenerateRuns: z.boolean().optional().default(true).describe('Whether to automatically generate the design runs table'),
      randomize: z.boolean().optional().default(true).describe('Whether to randomise the generated runOrder (default: true)'),
      randomSeed: z.number().optional().describe('Optional integer seed for reproducible Fisher-Yates randomisation'),
    },
    async ({ name, description, folderId, factors: inputFactors, responses: inputResponses, designType, centerPoints, autoGenerateRuns, randomize, randomSeed }) => {
      const startTime = Date.now();
      try {
        const projectId = uuidv4();
        const factors: Factor[] = inputFactors.map(f => ({
          id: uuidv4(),
          name: f.name,
          type: f.type,
          min: f.min,
          max: f.max,
          levels: f.levels,
          unit: f.unit || '',
        }));

        const responses: Response[] = inputResponses.map(r => ({
          id: uuidv4(),
          name: r.name,
          goal: r.goal,
          targetValue: r.targetValue,
          unit: r.unit || '',
        }));

        let runs: Run[] = [];
        let designInfo = '';
        let usedSeed: number | undefined = randomSeed;

        if (autoGenerateRuns && factors.length > 0) {
          const generated = generateDesign(factors, responses, designType as DesignType, {
            centerPoints,
            randomize,
            randomSeed,
          });
          runs = generated.runs;
          usedSeed = generated.randomSeed;
          designInfo = `${generated.designName}: ${generated.notes}`;
        }

        const newProject: Project = {
          id: projectId,
          name,
          description: description || '',
          folderId,
          factors,
          responses,
          runs,
          centerPoints,
          randomSeed: usedSeed,
          designType: designType as DesignType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        context.saveProject(newProject);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'create_project',
          params: { name, designType, factorsCount: factors.length, responsesCount: responses.length },
          resultSummary: `Created project '${name}' with ${runs.length} runs`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Project '${name}' created successfully`,
                project: newProject,
                designSummary: designInfo,
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'create_project',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error creating project: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: update_project
  server.tool(
    'update_project',
    'Update project metadata, name, description, or archived status',
    {
      projectId: z.string().describe('The project ID or name to update'),
      name: z.string().optional().describe('New name for project'),
      description: z.string().optional().describe('New description'),
      folderId: z.string().optional().describe('Folder ID to move into'),
      isArchived: z.boolean().optional().describe('Archive / unarchive project'),
      designType: z.enum(['factorial_2level', 'dsd', 'ccd', 'bbd', 'plackett_burman', 'custom_d_optimal']).optional(),
    },
    async ({ projectId, name, description, folderId, isArchived, designType }) => {
      const startTime = Date.now();
      try {
        const project = findProjectExact(projectId);

        if (name !== undefined) project.name = name;
        if (description !== undefined) project.description = description;
        if (folderId !== undefined) project.folderId = folderId;
        if (isArchived !== undefined) project.isArchived = isArchived;
        if (designType !== undefined) project.designType = designType as DesignType;
        project.updatedAt = Date.now();

        context.saveProject(project);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'update_project',
          params: { projectId, name },
          resultSummary: `Updated project '${project.name}'`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: `Project '${project.name}' updated successfully`, project }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'update_project',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error updating project: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: delete_project
  server.tool(
    'delete_project',
    'Archive or permanently delete a project from the DOE Magic workspace (archives first if not yet archived)',
    {
      projectId: z.string().describe('The exact project ID or unique exact project name to delete'),
      permanent: z.boolean().optional().describe('Set to true to permanently delete immediately even if not yet archived'),
    },
    async ({ projectId, permanent }) => {
      const startTime = Date.now();
      try {
        const project = findProjectExact(projectId);

        if (!project.isArchived && !permanent) {
          project.isArchived = true;
          project.updatedAt = Date.now();
          context.saveProject(project);
          context.broadcastSync();

          recordMcpActivity({
            type: 'tool',
            name: 'delete_project',
            params: { projectId, archivedFirst: true },
            resultSummary: `Archived project '${project.name}'`,
            success: true,
            durationMs: Date.now() - startTime,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  message: `Project '${project.name}' (${project.id}) has been archived for safety. Call delete_project again (or pass permanent: true) to permanently delete it.`,
                  archived: true,
                  deleted: false,
                  projectId: project.id,
                }),
              },
            ],
          };
        }

        context.deleteProject(project.id);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'delete_project',
          params: { projectId, permanent: true },
          resultSummary: `Deleted project '${project.name}'`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Project '${project.name}' (${project.id}) deleted permanently`,
                archived: false,
                deleted: true,
                projectId: project.id,
              }),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'delete_project',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error deleting project: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: generate_doe_design
  server.tool(
    'generate_doe_design',
    'Generate or regenerate the experimental design matrix for a project (2-Level Full/Fractional Factorial, DSD, CCD, BBD, Plackett-Burman, or D-Optimal)',
    {
      projectId: z.string().describe('The exact project ID or unique exact project name'),
      designType: z.enum(['factorial_2level', 'dsd', 'ccd', 'bbd', 'plackett_burman', 'custom_d_optimal']).optional().describe('DOE design architecture'),
      centerPoints: z.number().optional().describe('Number of replicate center points (0 is honoured)'),
      targetRuns: z.number().optional().describe('Target number of runs for fractional or D-optimal designs'),
      randomize: z.boolean().optional().describe('Whether to randomise the generated runOrder (default: true)'),
      randomSeed: z.number().optional().describe('Optional integer seed for reproducible Fisher-Yates randomisation'),
      force: z.boolean().optional().describe('Set to true to overwrite existing measured response values'),
    },
    async ({ projectId, designType, centerPoints, targetRuns, randomize, randomSeed, force }) => {
      const startTime = Date.now();
      try {
        const project = findProjectExact(projectId);
        if (project.factors.length === 0) throw new Error('Cannot generate design: Project has 0 factors defined.');

        const existingMeasuredCount = countMeasuredValues(project);
        if (existingMeasuredCount > 0 && !force) {
          throw new Error(
            `Refusing to regenerate design: project '${project.name}' has ${existingMeasuredCount} recorded response measurement(s). Pass force: true to overwrite them.`
          );
        }

        const effectiveDesignType = designType || project.designType || 'factorial_2level';
        const defaultCp = effectiveDesignType === 'dsd' ? 1 : effectiveDesignType === 'ccd' || effectiveDesignType === 'bbd' ? 3 : 0;
        const effectiveCenterPoints =
          centerPoints !== undefined
            ? centerPoints
            : project.centerPoints !== undefined
            ? project.centerPoints
            : defaultCp;

        const generated = generateDesign(
          project.factors,
          project.responses,
          effectiveDesignType as DesignType,
          { centerPoints: effectiveCenterPoints, targetRuns, randomize, randomSeed }
        );

        project.runs = generated.runs;
        project.designType = effectiveDesignType as DesignType;
        project.centerPoints = effectiveCenterPoints;
        project.randomSeed = generated.randomSeed;
        project.updatedAt = Date.now();

        context.saveProject(project);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'generate_doe_design',
          params: { projectId, designType: effectiveDesignType, runsCount: project.runs.length, force },
          resultSummary: `Generated ${project.runs.length} runs for '${project.name}'`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        const formattedDEff =
          generated.dEfficiency !== null && generated.dEfficiency !== undefined
            ? `${generated.dEfficiency.toFixed(1)}%`
            : 'not estimable';

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Successfully generated ${project.runs.length} runs for '${project.name}'`,
                designName: generated.designName,
                notes: generated.notes,
                dEfficiency: formattedDEff,
                dEfficiencyValue: generated.dEfficiency ?? null,
                randomSeed: generated.randomSeed,
                warnings: generated.warnings,
                runsCount: project.runs.length,
                discardedValuesCount: existingMeasuredCount,
                sampleRuns: project.runs.slice(0, 5).map(r => ({
                  runOrder: r.runOrder,
                  stdOrder: r.stdOrder,
                  factors: r.factors,
                })),
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'generate_doe_design',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error generating design: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: add_run_results
  server.tool(
    'add_run_results',
    'Record experimental measurements and observed response values for experimental runs',
    {
      projectId: z.string().describe('The exact project ID or unique exact project name'),
      runs: z.array(
        z.object({
          runOrder: z.number().optional().describe('Run order index (1-based)'),
          runId: z.string().optional().describe('Run ID if known'),
          responses: z.record(z.string(), z.union([z.number(), z.null()])).describe('Map of exact responseId or responseName to measured numeric value'),
        })
      ).describe('List of run results to record'),
    },
    async ({ projectId, runs: inputRuns }) => {
      const startTime = Date.now();
      try {
        const project = findProjectExact(projectId);

        let updatedCount = 0;

        for (const inputRun of inputRuns) {
          const targetRun = project.runs.find(r =>
            (inputRun.runId && r.id === inputRun.runId) ||
            (inputRun.runOrder && r.runOrder === inputRun.runOrder)
          );

          if (targetRun) {
            // Map keys in inputRun.responses to matching response IDs (rejecting partial keys per P1.14 / MCP-4)
            for (const [key, val] of Object.entries(inputRun.responses)) {
              const resp = resolveResponseExact(project, key);
              targetRun.responses[resp.id] = (val as any) ?? null;
            }
            updatedCount++;
          }
        }

        project.updatedAt = Date.now();
        context.saveProject(project);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'add_run_results',
          params: { projectId, updatedRuns: updatedCount },
          resultSummary: `Updated results for ${updatedCount} run(s) in '${project.name}'`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Successfully updated measurements for ${updatedCount} run(s)`,
                totalRuns: project.runs.length,
                completedRuns: project.runs.filter(r =>
                  project.responses.some(resp => r.responses[resp.id] !== null && r.responses[resp.id] !== undefined)
                ).length,
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'add_run_results',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error updating run results: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 8: run_analysis
  server.tool(
    'run_analysis',
    'Fit multiple linear regression (OLS) and compute ANOVA, Lack of Fit, model terms, p-values, t-ratios, and R-squared for a response',
    {
      projectId: z.string().describe('The project ID or name'),
      responseId: z.string().optional().describe('Response ID or response name to analyze (defaults to first response)'),
      excludedTerms: z.array(z.string()).optional().describe('Optional list of model term names or IDs to exclude from regression equation'),
    },
    async ({ projectId, responseId, excludedTerms }) => {
      const startTime = Date.now();
      try {
        const project = findProject(projectId);
        if (!project) throw new Error(`Project '${projectId}' not found`);

        const resp = responseId ? resolveResponse(project, responseId) : project.responses[0];
        if (!resp) throw new Error(`Response '${responseId || 'default'}' not found in project`);

        const validRuns = project.runs.filter(
          (r) =>
            r.responses[resp.id] !== null &&
            r.responses[resp.id] !== undefined &&
            String(r.responses[resp.id]).trim() !== '' &&
            !isNaN(Number(r.responses[resp.id]))
        );

        const rawExclusions = excludedTerms !== undefined ? excludedTerms : (resp.excludedTerms || []);
        const resolvedExclusions = resolveExcludedTerms(project, validRuns, rawExclusions);

        if (excludedTerms !== undefined && resolvedExclusions.unknownTerms.length > 0) {
          throw new Error(
            `Unknown model term(s) in excludedTerms: ${resolvedExclusions.unknownTerms.join(', ')}. Valid terms are: ${resolvedExclusions.validTerms.map((t) => t.name).join(', ')}`
          );
        }

        const analysis = computeAnalysis(project, resp, resolvedExclusions.excludedIds, resp.goal, resp.targetValue);
        if (!analysis) {
          throw new Error(`Insufficient measured data to analyze response '${resp.name}'`);
        }

        // Format terms with null-safe rounding for reference/aliased rows (MCP-9)
        const formattedTerms = (analysis.parameterEstimates || []).map((t) => ({
          term: t.term,
          estimate: t.estimate !== null && t.estimate !== undefined ? Number(t.estimate.toFixed(4)) : null,
          stdError: t.stdError !== null && t.stdError !== undefined ? Number(t.stdError.toFixed(4)) : null,
          tRatio: t.tRatio !== null && t.tRatio !== undefined ? Number(t.tRatio.toFixed(3)) : null,
          pValue: t.pVal !== null && t.pVal !== undefined ? Number(t.pVal.toFixed(5)) : null,
          significant: t.pVal !== null && t.pVal !== undefined ? t.pVal < 0.05 : false,
          vif: t.vif !== null && t.vif !== undefined && Number.isFinite(t.vif) ? Number(t.vif.toFixed(2)) : null,
          ...(t.isReference ? { isReference: true } : {}),
          ...(t.isAliased ? { isAliased: true } : {}),
        }));

        const lof = analysis.lackOfFit;
        const lofPayload =
          lof && lof.p_lof !== null && lof.p_lof !== undefined
            ? {
                testable: true,
                dfLackOfFit: lof.df_lof,
                dfPureError: lof.df_pure,
                fRatio: Number((lof.f_lof ?? 0).toFixed(3)),
                pValue: Number(lof.p_lof.toFixed(4)),
                significant: lof.p_lof < 0.05,
                interpretation:
                  lof.p_lof < 0.05
                    ? 'Warning: Lack of Fit is statistically significant (p < 0.05). Consider adding interaction or quadratic terms.'
                    : 'Lack of Fit is not significant (p >= 0.05). The current model structure adequately explains the data.',
              }
            : {
                testable: false,
                dfLackOfFit: lof?.df_lof ?? 0,
                dfPureError: lof?.df_pure ?? 0,
                fRatio: null,
                pValue: null,
                significant: null,
                reason:
                  (lof?.df_pure ?? 0) === 0
                    ? 'No replicate runs to estimate pure error (dfPureError = 0).'
                    : (lof?.df_lof ?? 0) === 0
                    ? 'Saturated model with no lack-of-fit degrees of freedom (dfLackOfFit = 0).'
                    : 'Pure error mean square is zero.',
              };

        const resultPayload = {
          project: project.name,
          response: {
            id: resp.id,
            name: resp.name,
            goal: resp.goal,
            targetValue: resp.targetValue,
            unit: resp.unit,
          },
          excludedTerms: resolvedExclusions.appliedTerms.map((t) => t.name),
          summary: {
            rSquared: Number((analysis.rSquared ?? 0).toFixed(4)),
            adjRSquared: Number((analysis.adjRSquared ?? 0).toFixed(4)),
            rmse: Number((analysis.rmse ?? 0).toFixed(4)),
            dfModel: analysis.dfModel,
            dfError: analysis.dfError,
            fRatio: analysis.dfError > 0 && analysis.fRatio !== undefined ? Number(analysis.fRatio.toFixed(3)) : null,
            pValue:
              analysis.modelPValue !== null && analysis.modelPValue !== undefined
                ? Number(analysis.modelPValue.toFixed(6))
                : null,
            runsAnalyzed: analysis.nRuns || validRuns.length,
            adequatePrecision: analysis.adequatePrecision ? Number(analysis.adequatePrecision.toFixed(2)) : null,
          },
          lackOfFit: lofPayload,
          excludedRuns: analysis.excludedRuns,
          warnings: analysis.warnings,
          modelTerms: formattedTerms,
          paretoRanking: (analysis.paretoData || []).slice(0, 8).map((p) => ({
            term: p.name,
            effectMagnitude: Number((p.absEffect ?? 0).toFixed(4)),
            tRatio: Number((p.tRatio ?? 0).toFixed(3)),
            direction: p.direction,
            significant: (p.tRatio ?? 0) > (analysis.tLimitPareto ?? Infinity),
          })),
        };

        recordMcpActivity({
          type: 'tool',
          name: 'run_analysis',
          params: { projectId, response: resp.name },
          resultSummary: `Analyzed ${resp.name}: R2=${resultPayload.summary.rSquared}, RMSE=${resultPayload.summary.rmse}`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultPayload, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'run_analysis',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error running analysis: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 9: predict_response
  server.tool(
    'predict_response',
    'Calculate predicted response value for given factor settings using the fitted regression model',
    {
      projectId: z.string().describe('The project ID or name'),
      responseId: z.string().optional().describe('Response ID or response name (defaults to first response)'),
      factorSettings: z.record(z.string(), z.union([z.number(), z.string()])).describe('Factor values to predict at (e.g. { "Temperature": 65, "pH": 7.2 })'),
    },
    async ({ projectId, responseId, factorSettings }) => {
      const startTime = Date.now();
      try {
        const project = findProject(projectId);
        if (!project) throw new Error(`Project '${projectId}' not found`);

        const resp = responseId ? resolveResponse(project, responseId) : project.responses[0];
        if (!resp) throw new Error(`Response '${responseId || 'default'}' not found`);

        const model = computeAnalysis(project, resp, resp.excludedTerms || [], resp.goal, resp.targetValue);

        // Convert factorSettings keys from name to id if needed
        const resolvedSettings: Record<string, any> = {};
        for (const [key, val] of Object.entries(factorSettings)) {
          const fid = resolveFactorId(project, key);
          resolvedSettings[fid] = val;
        }

        const predictedValue = predictModelResponse(model, resolvedSettings, project);

        recordMcpActivity({
          type: 'tool',
          name: 'predict_response',
          params: { projectId, response: resp.name, settings: factorSettings },
          resultSummary: `Predicted ${resp.name} = ${predictedValue.toFixed(4)}`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                project: project.name,
                response: resp.name,
                unit: resp.unit,
                predictedValue: Number(predictedValue.toFixed(4)),
                rmse: Number((model.rmse ?? 0).toFixed(4)),
                rSquared: Number((model.rSquared ?? 0).toFixed(4)),
                factorSettingsUsed: factorSettings,
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'predict_response',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error predicting response: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 10: optimize_desirability
  server.tool(
    'optimize_desirability',
    'Multi-response desirability optimization (Derringer-Suich) to find optimal Pareto factor settings meeting all response targets',
    {
      projectId: z.string().describe('The project ID or name'),
      gridPointsPerFactor: z.number().optional().default(10).describe('Search resolution per continuous factor (default: 10)'),
      weights: z.record(z.string(), z.number()).optional().describe('Optional response importance weights (1 to 5)'),
    },
    async ({ projectId, gridPointsPerFactor = 10, weights = {} }) => {
      const startTime = Date.now();
      try {
        const project = findProjectExact(projectId);
        if (project.responses.length === 0) throw new Error('No responses defined in project');

        // Fit models for all responses using each response's saved excludedTerms (P0.6)
        const models = fitProjectModelsById(project);

        // Generate search grid without factor truncation (P0.8 / MCP-11)
        const effectiveGridPoints = typeof gridPointsPerFactor === 'number' && !isNaN(gridPointsPerFactor) ? gridPointsPerFactor : 10;
        const resolution = Math.max(5, Math.min(25, effectiveGridPoints));
        const factorGrids: { id: string; name: string; values: (number | string)[] }[] = project.factors.map(f => {
          if (f.type === 'categorical') {
            return {
              id: f.id,
              name: f.name,
              values: f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'],
            };
          } else {
            const step = (f.max - f.min) / (resolution - 1);
            const vals = Array.from({ length: resolution }, (_, i) => Number((f.min + i * step).toFixed(4)));
            return { id: f.id, name: f.name, values: vals };
          }
        });

        // Compute response range statistics across runs for desirability bounds
        const bounds: Record<string, { min: number; max: number; target?: number; goal: string }> = {};
        for (const r of project.responses) {
          const vals = project.runs
            .map(run => run.responses[r.id])
            .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

          const minVal = vals.length > 0 ? Math.min(...vals) : 0;
          const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
          bounds[r.id] = {
            min: minVal,
            max: maxVal === minVal ? minVal + 1 : maxVal,
            target: r.targetValue,
            goal: r.goal,
          };
        }

        // Calculate desirability d_i in [0, 1]
        const calcDesirability = (y: number, rId: string): number => {
          const b = bounds[rId];
          if (!b) return 1;
          if (b.goal === 'maximize') {
            if (y <= b.min) return 0;
            if (y >= b.max) return 1;
            return (y - b.min) / (b.max - b.min);
          } else if (b.goal === 'minimize') {
            if (y >= b.max) return 0;
            if (y <= b.min) return 1;
            return (b.max - y) / (b.max - b.min);
          } else {
            // Target
            const target = b.target !== undefined ? b.target : (b.min + b.max) / 2;
            if (y === target) return 1;
            if (y < target) {
              return y <= b.min ? 0 : (y - b.min) / (target - b.min);
            } else {
              return y >= b.max ? 0 : (b.max - y) / (b.max - target);
            }
          }
        };

        const evaluateCombination = (comb: Record<string, number | string>) => {
          const predicted: Record<string, number> = {};
          const indDes: Record<string, number> = {};
          let weightedSum = 0;
          let weightTotal = 0;
          let hasZero = false;

          for (const r of project.responses) {
            const pred = predictModelResponse(models[r.id], comb, project);
            predicted[r.name] = Number(pred.toFixed(3));
            const d = calcDesirability(pred, r.id);
            indDes[r.name] = Number(d.toFixed(4));
            if (d <= 0.0001) hasZero = true;

            const w = weights[r.id] || weights[r.name] || 1;
            weightedSum += w * Math.log(Math.max(1e-6, d));
            weightTotal += w;
          }

          const overallDesirability = hasZero ? 0 : Math.exp(weightedSum / weightTotal);
          const namedFactors: Record<string, number | string> = {};
          project.factors.forEach(f => {
            namedFactors[f.name] = comb[f.id];
          });

          return {
            rawFactors: { ...comb },
            factors: namedFactors,
            predicted,
            individualDesirabilities: indDes,
            overallDesirability: Number(overallDesirability.toFixed(4)),
            rawOverallDesirability: overallDesirability,
          };
        };

        // Complete-factor candidate set (never truncates later factors)
        const combinations = buildCompleteSearchCandidates(project.factors, resolution, 5000);
        const evaluated = combinations.map(evaluateCombination);
        evaluated.sort((a, b) => b.rawOverallDesirability - a.rawOverallDesirability);

        // Coordinate-ascent refinement on the top 3 candidates when the full grid was sampled
        if (combinations.length >= 5000 && evaluated.length > 0) {
          for (let s = 0; s < Math.min(3, evaluated.length); s++) {
            let cur = evaluated[s];
            for (let pass = 0; pass < 4; pass++) {
              let improved = false;
              for (const fg of factorGrids) {
                for (const v of fg.values) {
                  if (cur.rawFactors[fg.id] === v) continue;
                  const nextEval = evaluateCombination({ ...cur.rawFactors, [fg.id]: v });
                  if (nextEval.rawOverallDesirability > cur.rawOverallDesirability + 1e-9) {
                    cur = nextEval;
                    improved = true;
                  }
                }
              }
              if (!improved) break;
            }
            evaluated[s] = cur;
          }
          evaluated.sort((a, b) => b.rawOverallDesirability - a.rawOverallDesirability);
        }

        const topCandidates = evaluated.slice(0, 5).map(({ factors, predicted, individualDesirabilities, overallDesirability }) => ({
          factors,
          predicted,
          individualDesirabilities,
          overallDesirability,
        }));
        const best = topCandidates[0];

        // Store top optimization candidates back to project
        project.optimizationCandidates = topCandidates.map(c => {
          const rawSetting: Record<string, string | number> = {};
          project.factors.forEach(f => {
            rawSetting[f.id] = c.factors[f.name];
          });
          return rawSetting;
        });
        project.optimizationResults = `Optimal Multi-Response Desirability: ${best.overallDesirability.toFixed(4)} across ${project.responses.length} responses.`;
        context.saveProject(project);
        context.broadcastSync();

        recordMcpActivity({
          type: 'tool',
          name: 'optimize_desirability',
          params: { projectId },
          resultSummary: `Found optimal D = ${best.overallDesirability}`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Multi-response optimization completed successfully for '${project.name}'`,
                bestOperatingRecipe: best,
                topCandidates,
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'optimize_desirability',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error in optimization: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 11: simulate_robustness
  server.tool(
    'simulate_robustness',
    'Run Monte Carlo process capability and robustness simulation (Cpk, Ppk, defect PPM, pass rate) accounting for factor variation and model uncertainty',
    {
      projectId: z.string().describe('The project ID or name'),
      responseId: z.string().optional().describe('Response ID or response name to simulate (defaults to first response)'),
      nominalSettings: z.record(z.string(), z.union([z.number(), z.string()])).describe('Nominal operating recipe (e.g. { "Temperature": 65, "pH": 7.0 })'),
      factorStdDevs: z.record(z.string(), z.number()).describe('Standard deviation of process variation for each factor (e.g. { "Temperature": 1.5, "pH": 0.1 })'),
      specLimits: z.object({
        lsl: z.number().optional().describe('Lower specification limit (LSL)'),
        usl: z.number().optional().describe('Upper specification limit (USL)'),
      }).describe('Specification acceptance limits'),
      numSimulations: z.number().optional().default(5000).describe('Number of Monte Carlo iterations (default: 5000)'),
      includeResidualNoise: z.boolean().optional().default(true).describe('Whether to inject regression residual noise (RMSE) into simulation'),
    },
    async ({ projectId, responseId, nominalSettings, factorStdDevs, specLimits, numSimulations = 5000, includeResidualNoise = true }) => {
      const startTime = Date.now();
      try {
        const project = findProject(projectId);
        if (!project) throw new Error(`Project '${projectId}' not found`);

        const resp = responseId ? resolveResponse(project, responseId) : project.responses[0];
        if (!resp) throw new Error(`Response '${responseId || 'default'}' not found`);

        const model = computeAnalysis(project, resp, resp.excludedTerms || [], resp.goal, resp.targetValue);
        if (!model) {
          throw new Error(`Insufficient measured data to simulate response '${resp.name}'`);
        }
        const rmse = model.rmse || 0;

        // Box-Muller Gaussian random number generator
        const boxMuller = () => {
          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };

        const runsCount = Math.max(500, Math.min(25000, numSimulations));
        const simResults: number[] = [];
        let outOfSpecCount = 0;
        let belowLslCount = 0;
        let aboveUslCount = 0;

        const hasLsl = specLimits.lsl !== undefined && specLimits.lsl !== null;
        const hasUsl = specLimits.usl !== undefined && specLimits.usl !== null;
        const lsl = hasLsl ? Number(specLimits.lsl) : -Infinity;
        const usl = hasUsl ? Number(specLimits.usl) : Infinity;

        for (let i = 0; i < runsCount; i++) {
          const simSettings: Record<string, any> = {};
          project.factors.forEach(f => {
            const factorKey = Object.keys(nominalSettings).find(k => k === f.id || k.toLowerCase() === f.name.toLowerCase());
            const nomVal = factorKey ? nominalSettings[factorKey] : (f.min + f.max) / 2;

            if (f.type === 'categorical') {
              simSettings[f.id] = nomVal;
            } else {
              const sdKey = Object.keys(factorStdDevs).find(k => k === f.id || k.toLowerCase() === f.name.toLowerCase());
              const sd = sdKey ? Number(factorStdDevs[sdKey]) : 0;
              const val = Number(nomVal) + boxMuller() * sd;
              simSettings[f.id] = val;
            }
          });

          let val = predictModelResponse(model, simSettings, project);
          if (includeResidualNoise && rmse > 0) {
            val += boxMuller() * rmse;
          }

          simResults.push(val);

          let oos = false;
          if (hasLsl && val < lsl) {
            belowLslCount++;
            oos = true;
          }
          if (hasUsl && val > usl) {
            aboveUslCount++;
            oos = true;
          }
          if (oos) outOfSpecCount++;
        }

        const mean = simResults.reduce((a, b) => a + b, 0) / runsCount;
        const variance = simResults.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (runsCount - 1);
        const sd = Math.sqrt(variance);

        // Process Capability Indices (Cpk, Ppk)
        let cpk: number | null = null;
        if (sd > 0) {
          if (hasLsl && hasUsl) {
            const cpu = (usl - mean) / (3 * sd);
            const cpl = (mean - lsl) / (3 * sd);
            cpk = Math.min(cpu, cpl);
          } else if (hasLsl) {
            cpk = (mean - lsl) / (3 * sd);
          } else if (hasUsl) {
            cpk = (usl - mean) / (3 * sd);
          }
        }

        const defectRate = (outOfSpecCount / runsCount) * 100;
        const defectPpm = Math.round((outOfSpecCount / runsCount) * 1_000_000);
        const passRate = 100 - defectRate;

        let capabilityAssessment = 'Normal Process';
        if (cpk !== null) {
          if (cpk >= 1.67) capabilityAssessment = 'Excellent (Six Sigma Level)';
          else if (cpk >= 1.33) capabilityAssessment = 'Robust / Capable (4-Sigma Industry Standard)';
          else if (cpk >= 1.0) capabilityAssessment = 'Marginal Capability (Risk of Defect on Drift)';
          else capabilityAssessment = 'Inadequate (High Process Defect Rate)';
        }

        const resultPayload = {
          project: project.name,
          response: resp.name,
          simulations: runsCount,
          statistics: {
            mean: Number(mean.toFixed(4)),
            standardDeviation: Number(sd.toFixed(4)),
            rmseResidualNoiseIncluded: includeResidualNoise,
          },
          capability: {
            cpk: cpk !== null ? Number(cpk.toFixed(3)) : null,
            assessment: capabilityAssessment,
            defectRatePercent: Number(defectRate.toFixed(3)),
            defectPPM: defectPpm,
            passRatePercent: Number(passRate.toFixed(3)),
          },
          specificationLimits: {
            lsl: hasLsl ? lsl : null,
            usl: hasUsl ? usl : null,
            outOfSpecCount,
            belowLslCount,
            aboveUslCount,
          },
        };

        recordMcpActivity({
          type: 'tool',
          name: 'simulate_robustness',
          params: { projectId, response: resp.name, cpk },
          resultSummary: `Simulated ${runsCount} trials: Cpk = ${cpk?.toFixed(2) || 'N/A'}, Pass = ${passRate.toFixed(1)}%`,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultPayload, null, 2),
            },
          ],
        };
      } catch (err: any) {
        recordMcpActivity({
          type: 'tool',
          name: 'simulate_robustness',
          resultSummary: err.message,
          success: false,
          durationMs: Date.now() - startTime,
        });
        return {
          content: [{ type: 'text', text: `Error in robustness simulation: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // MCP RESOURCES
  // ==========================================

  // Resource 1: doe://projects
  server.resource(
    'doe-projects-list',
    'doe://projects',
    async (uri) => {
      const projects = context.getProjects().map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        designType: p.designType,
        factorsCount: p.factors.length,
        responsesCount: p.responses.length,
        runsCount: p.runs.length,
      }));

      recordMcpActivity({
        type: 'resource',
        name: uri.href,
        resultSummary: `Read ${projects.length} projects`,
        success: true,
        durationMs: 5,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    }
  );

  // Resource 2: doe://project/{id}
  server.resource(
    'doe-project-detail',
    new ResourceTemplate('doe://project/{id}', { list: undefined }),
    async (uri, { id }) => {
      const project = findProject(id as string);
      if (!project) {
        throw new Error(`Project ${id} not found`);
      }

      recordMcpActivity({
        type: 'resource',
        name: uri.href,
        resultSummary: `Read project '${project.name}'`,
        success: true,
        durationMs: 5,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    }
  );

  // Resource 3: doe://analysis/{projectId}/{responseId}
  server.resource(
    'doe-analysis-detail',
    new ResourceTemplate('doe://analysis/{projectId}/{responseId}', { list: undefined }),
    async (uri, { projectId, responseId }) => {
      const project = findProject(projectId as string);
      if (!project) throw new Error(`Project ${projectId} not found`);
      const resp = resolveResponse(project, responseId as string);
      if (!resp) throw new Error(`Response ${responseId} not found`);

      const analysis = computeAnalysis(project, resp, resp.excludedTerms || [], resp.goal, resp.targetValue);

      recordMcpActivity({
        type: 'resource',
        name: uri.href,
        resultSummary: `Read analysis for '${resp.name}' in '${project.name}'`,
        success: true,
        durationMs: 5,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    }
  );

  // ==========================================
  // MCP PROMPTS
  // ==========================================

  server.prompt(
    'interpret_doe_results',
    'Generate systematic expert interpretation of ANOVA, Lack of Fit, Pareto effects, and recommend next-step DOE strategy',
    {
      projectId: z.string().describe('The project ID or name'),
      responseId: z.string().optional().describe('Response name or ID to interpret'),
    },
    async ({ projectId, responseId }) => {
      const project = findProject(projectId);
      const resp = responseId && project ? resolveResponse(project, responseId) : project?.responses[0];
      const projectName = project ? project.name : projectId;
      const respName = resp ? resp.name : (responseId || 'primary response');

      return {
        description: `Interpret DOE regression and ANOVA for response ${respName} in project ${projectName}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please act as a senior pharmaceutical formulation & statistical DOE specialist. Analyze the experimental results for response '${respName}' in project '${projectName}'.

Follow this structured protocol:
1. First, call the 'run_analysis' tool for project '${projectName}' and response '${respName}'.
2. Review Model Quality:
   - Is R-squared and Adjusted R-squared high (> 0.80)?
   - Is the Overall Model ANOVA F-ratio significant (p < 0.05)?
3. Lack of Fit Assessment:
   - Check the Lack of Fit p-value. If p < 0.05, explain why curvature or missing interaction terms may be present.
4. Pareto & Term Significance:
   - Identify which main factors and 2-way interactions exceed the significance threshold (p < 0.05).
5. Actionable Recommendations:
   - If in screening phase: recommend factors to fix/eliminate vs factors to carry into a Response Surface Design (CCD or Box-Behnken).
   - If in optimization phase: recommend the optimal operating sweet-spot and path of steepest ascent.`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    'recommend_doe_design',
    'Recommend the most statistically efficient DOE design architecture based on factor count, types, and experimental budget',
    {
      factorCount: z.string().describe('Number of experimental factors'),
      objective: z.string().describe('Objective: screening, response_surface_optimization, or robustness'),
      experimentalRunBudget: z.string().optional().describe('Maximum number of runs affordable'),
    },
    async ({ factorCount, objective, experimentalRunBudget }) => {
      return {
        description: `Recommend optimal DOE design architecture for ${factorCount} factors with objective: ${objective}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need guidance on selecting the best Design of Experiments (DOE) strategy.
- Factors count: ${factorCount}
- Primary objective: ${objective}
- Run budget limit: ${experimentalRunBudget || 'standard'}

Please evaluate:
1. If screening: Compare 2-Level Fractional Factorial vs Plackett-Burman vs Definitive Screening Design (DSD).
2. If optimization: Compare Central Composite Design (CCD) vs Box-Behnken (BBD) vs D-Optimal coordinate exchange.
3. Recommend specific center points for detecting non-linear curvature and measuring pure experimental error.
4. Show the exact parameters to pass to 'create_project' and 'generate_doe_design' tools.`,
            },
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Direct JSON-RPC request dispatcher for HTTP POST /api/mcp and /mcp
 */
export async function handleDirectJsonRpc(server: McpServer, body: any): Promise<any> {
  const { jsonrpc = '2.0', id = 1, method, params = {} } = body || {};

  if (!method) {
    return {
      jsonrpc,
      id,
      error: { code: -32600, message: 'Invalid Request: missing method' },
    };
  }

  // Handle standard JSON-RPC MCP methods
  try {
    if (method === 'initialize') {
      return {
        jsonrpc,
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'doe-magic-mcp',
            version: '1.5.2',
          },
        },
      };
    }

    if (method === 'tools/list') {
      // @ts-ignore - access internal registered tools
      const toolMap = (server as any)._registeredTools || (server as any).registeredTools || {};
      const tools = Object.entries(toolMap).map(([name, tool]: [string, any]) => {
        return {
          name,
          description: tool.description,
          inputSchema: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
        };
      });

      return {
        jsonrpc,
        id,
        result: { tools },
      };
    }

    if (method === 'tools/call') {
      const toolName = params.name;
      const toolArgs = params.arguments || {};

      // @ts-ignore
      const toolMap = (server as any)._registeredTools || (server as any).registeredTools || {};
      const tool = toolMap[toolName];

      if (!tool) {
        return {
          jsonrpc,
          id,
          error: { code: -32601, message: `Tool '${toolName}' not found` },
        };
      }

      // Execute tool handler
      const result = await tool.handler(toolArgs);
      return {
        jsonrpc,
        id,
        result,
      };
    }

    if (method === 'resources/list') {
      // @ts-ignore
      const resMap = (server as any)._registeredResources || (server as any).registeredResources || {};
      const resources = Object.entries(resMap).map(([uri, res]: [string, any]) => ({
        uri,
        name: res.name || uri,
        description: res.description,
        mimeType: res.mimeType || 'application/json',
      }));

      return {
        jsonrpc,
        id,
        result: { resources },
      };
    }

    if (method === 'prompts/list') {
      // @ts-ignore
      const promptMap = (server as any)._registeredPrompts || (server as any).registeredPrompts || {};
      const prompts = Object.entries(promptMap).map(([name, prompt]: [string, any]) => ({
        name,
        description: prompt.description,
        arguments: prompt.arguments || [],
      }));

      return {
        jsonrpc,
        id,
        result: { prompts },
      };
    }

    if (method === 'ping') {
      return {
        jsonrpc,
        id,
        result: {},
      };
    }

    return {
      jsonrpc,
      id,
      error: { code: -32601, message: `Method '${method}' not implemented in direct dispatcher` },
    };
  } catch (err: any) {
    return {
      jsonrpc,
      id,
      error: { code: -32603, message: `Internal error: ${err.message}` },
    };
  }
}
