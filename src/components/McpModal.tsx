import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Cpu, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  Activity, 
  Play, 
  RefreshCw, 
  X, 
  Code, 
  BookOpen, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function McpModal({ isOpen, onClose }: McpModalProps) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'resources' | 'logs'>('overview');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [selectedToolName, setSelectedToolName] = useState<string>('list_projects');
  const [toolArgsJson, setToolArgsJson] = useState<string>('{}');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const sseUrl = `${baseUrl}/mcp/sse`;
  const postUrl = `${baseUrl}/api/mcp`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const res = await fetch('/api/mcp/info');
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
      }
      const logsRes = await fetch('/api/mcp/logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (e) {
      console.error('Failed to fetch MCP info:', e);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInfo();
    }
  }, [isOpen]);

  // Pre-fill arguments when tool changes in playground
  const defaultToolArgs: Record<string, any> = {
    list_projects: {},
    get_project: { projectId: 'proj-suzuki-cross-coupling' },
    create_project: {
      name: 'AI Generated Catalyst Screen',
      description: 'Screening 4 ligand variants and temperature across 12 runs',
      factors: [
        { name: 'Temperature', type: 'numeric', min: 60, max: 100, unit: '°C' },
        { name: 'Ligand Type', type: 'categorical', levels: ['XPhos', 'SPhos', 'RuPhos'] },
      ],
      responses: [
        { name: 'Conversion', goal: 'maximize', unit: '%' },
      ],
      designType: 'factorial_2level',
    },
    update_project: { projectId: 'proj-suzuki-cross-coupling', description: 'Updated via MCP server endpoint' },
    delete_project: { projectId: 'sample-project-id' },
    generate_doe_design: { projectId: 'proj-suzuki-cross-coupling', designType: 'factorial_2level', centerPoints: 3 },
    add_run_results: {
      projectId: 'proj-suzuki-cross-coupling',
      runs: [{ runOrder: 1, responses: { Yield: 88.5, Purity: 97.2 } }],
    },
    run_analysis: { projectId: 'proj-suzuki-cross-coupling' },
    predict_response: {
      projectId: 'proj-suzuki-cross-coupling',
      factorSettings: { Temperature: 85, 'Catalyst Loading': 2.0, 'Reaction Time': 4.5, Solvent: 'Ethanol' },
    },
    optimize_desirability: { projectId: 'proj-suzuki-cross-coupling', gridPointsPerFactor: 8 },
    simulate_robustness: {
      projectId: 'proj-suzuki-cross-coupling',
      nominalSettings: { Temperature: 82.5, 'Catalyst Loading': 1.5, 'Reaction Time': 4.0, Solvent: '2-MeTHF' },
      factorStdDevs: { Temperature: 1.5, 'Catalyst Loading': 0.1, 'Reaction Time': 0.2 },
      specLimits: { lsl: 80, usl: 100 },
      numSimulations: 2500,
    },
  };

  const handleSelectTool = (name: string) => {
    setSelectedToolName(name);
    const initialArgs = defaultToolArgs[name] || {};
    setToolArgsJson(JSON.stringify(initialArgs, null, 2));
    setExecutionResult(null);
    setExecutionTimeMs(null);
  };

  const handleExecuteTool = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    const start = performance.now();
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch (e: any) {
        setExecutionResult({ error: `Invalid JSON payload: ${e.message}` });
        setIsExecuting(false);
        return;
      }

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: selectedToolName,
            arguments: parsedArgs,
          },
        }),
      });

      const data = await res.json();
      setExecutionTimeMs(Math.round(performance.now() - start));
      setExecutionResult(data);
      // Refresh logs
      fetchInfo();
    } catch (err: any) {
      setExecutionTimeMs(Math.round(performance.now() - start));
      setExecutionResult({ error: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'doe-magic': {
          url: sseUrl,
        },
      },
    },
    null,
    2
  );

  const stdioConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'doe-magic': {
          command: 'npm',
          args: ['run', 'mcp'],
        },
      },
    },
    null,
    2
  );

  const curlSnippet = `curl -X POST ${postUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900/10 via-emerald-900/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {locale === 'zh' ? 'Model Context Protocol (MCP) 端点集成中心' : 'Model Context Protocol (MCP) Server Endpoint'}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  v.1.5.2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {locale === 'zh' 
                  ? '让 Claude Desktop、Cursor、Gemini 及任何外部 AI Agent 实时调用 DOE 实验设计、ANOVA 回归分析、多响应联合优化与稳健性模拟' 
                  : 'Connect Claude Desktop, Cursor, Gemini, and AI Agents directly to DOE Magic for autonomous experimental design, ANOVA modeling, desirability optimization, and simulation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInfo}
              disabled={isLoadingInfo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={isLoadingInfo ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-6 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Cpu size={14} />
            {locale === 'zh' ? '连接配置与概览' : 'Connection & Overview'}
          </button>
          <button
            onClick={() => {
              setActiveTab('tools');
              if (!selectedToolName) handleSelectTool('list_projects');
            }}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'tools'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Code size={14} />
            {locale === 'zh' ? '工具目录与实时测试 (11 Tools)' : 'Tools & Live Playground (11 Tools)'}
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'resources'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers size={14} />
            {locale === 'zh' ? '资源与提示词 (Resources & Prompts)' : 'Resources & Prompts'}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Activity size={14} />
            {locale === 'zh' ? '调用审计日志' : 'Activity Logs'}
            {logs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-500/20 text-brand-400 font-mono">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Endpoint URLs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>SSE Endpoint</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">GET</span>
                  </div>
                  <div className="font-mono text-xs text-slate-900 dark:text-slate-200 truncate select-all">{sseUrl}</div>
                  <button
                    onClick={() => copyToClipboard(sseUrl, 'sse')}
                    className="mt-2.5 w-full text-[11px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copiedKey === 'sse' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedKey === 'sse' ? (locale === 'zh' ? '已复制' : 'Copied!') : (locale === 'zh' ? '复制 SSE 链接' : 'Copy SSE URL')}
                  </button>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>JSON-RPC Direct POST</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">POST</span>
                  </div>
                  <div className="font-mono text-xs text-slate-900 dark:text-slate-200 truncate select-all">{postUrl}</div>
                  <button
                    onClick={() => copyToClipboard(postUrl, 'post')}
                    className="mt-2.5 w-full text-[11px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copiedKey === 'post' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedKey === 'post' ? (locale === 'zh' ? '已复制' : 'Copied!') : (locale === 'zh' ? '复制 POST 链接' : 'Copy POST URL')}
                  </button>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Protocol Spec</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">Standard</span>
                  </div>
                  <div className="font-mono text-xs text-slate-900 dark:text-slate-200">Model Context Protocol 2024-11-05</div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    {serverInfo ? `${serverInfo.toolsCount} Tools, 1 Resource, 2 Prompts` : '11 Tools Ready'}
                  </div>
                </div>
              </div>

              {/* Claude Desktop Configuration */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-brand-500" />
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {locale === 'zh' ? 'Claude Desktop 配置文件 (Remote SSE 接入)' : 'Claude Desktop Configuration (Remote SSE)'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(claudeConfigSnippet, 'claude')}
                    className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                  >
                    {copiedKey === 'claude' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'claude' ? (locale === 'zh' ? '已复制配置' : 'Copied') : (locale === 'zh' ? '复制 claude_desktop_config.json' : 'Copy Config')}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  {locale === 'zh'
                    ? '在 macOS 的 ~/Library/Application Support/Claude/claude_desktop_config.json 或 Windows 的 %APPDATA%/Claude/claude_desktop_config.json 中粘贴此配置：'
                    : 'Paste into ~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%/Claude/claude_desktop_config.json (Windows):'}
                </p>
                <pre className="p-3 rounded bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {claudeConfigSnippet}
                </pre>
              </div>

              {/* Local CLI / Stdio Option */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-amber-500" />
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {locale === 'zh' ? '命令行 Stdio 接入 (Local CLI / Cursor / Windsurf)' : 'Local Stdio Execution (Cursor / Cline / CLI)'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(stdioConfigSnippet, 'stdio')}
                    className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {copiedKey === 'stdio' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'stdio' ? (locale === 'zh' ? '已复制' : 'Copied') : (locale === 'zh' ? '复制 Stdio 配置' : 'Copy Stdio Config')}
                  </button>
                </div>
                <pre className="p-3 rounded bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {stdioConfigSnippet}
                </pre>
              </div>

              {/* cURL Example */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code size={15} className="text-blue-500" />
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {locale === 'zh' ? 'cURL / HTTP 测试指令' : 'cURL HTTP Test Command'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(curlSnippet, 'curl')}
                    className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {copiedKey === 'curl' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'curl' ? (locale === 'zh' ? '已复制' : 'Copied') : (locale === 'zh' ? '复制 cURL' : 'Copy cURL')}
                  </button>
                </div>
                <pre className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                  {curlSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: TOOLS & LIVE PLAYGROUND */}
          {activeTab === 'tools' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[480px]">
              {/* Tool Selector List */}
              <div className="md:col-span-4 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col bg-slate-50/50 dark:bg-slate-900/40">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === 'zh' ? '可用 MCP 工具列表' : 'Registered MCP Tools'}
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  {[
                    { id: 'list_projects', name: 'list_projects', tag: 'Project', desc: 'List all DOE projects & status' },
                    { id: 'get_project', name: 'get_project', tag: 'Project', desc: 'Get full project schema & runs' },
                    { id: 'create_project', name: 'create_project', tag: 'Design', desc: 'Create new project with factors' },
                    { id: 'update_project', name: 'update_project', tag: 'Project', desc: 'Update metadata or archive' },
                    { id: 'delete_project', name: 'delete_project', tag: 'Project', desc: 'Delete project from workspace' },
                    { id: 'generate_doe_design', name: 'generate_doe_design', tag: 'Design', desc: 'Generate 2-level, DSD, CCD, BBD' },
                    { id: 'add_run_results', name: 'add_run_results', tag: 'Data', desc: 'Record experimental measurements' },
                    { id: 'run_analysis', name: 'run_analysis', tag: 'ANOVA', desc: 'Fit regression & Lack of Fit' },
                    { id: 'predict_response', name: 'predict_response', tag: 'Model', desc: 'Predict response at coordinates' },
                    { id: 'optimize_desirability', name: 'optimize_desirability', tag: 'Opt', desc: 'Multi-response Derringer-Suich' },
                    { id: 'simulate_robustness', name: 'simulate_robustness', tag: 'Sim', desc: 'Monte Carlo Cpk process capability' },
                  ].map(tool => {
                    const isSelected = selectedToolName === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleSelectTool(tool.id)}
                        className={`w-full text-left p-3 flex items-start justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <div className="text-xs font-mono font-bold flex items-center gap-1.5">
                            {tool.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{tool.desc}</div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {tool.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Execution Workspace */}
              <div className="md:col-span-8 flex flex-col gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                        {selectedToolName}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">JSON-RPC Arguments</span>
                    </div>
                    <button
                      onClick={handleExecuteTool}
                      disabled={isExecuting}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Play size={12} className={isExecuting ? 'animate-spin' : ''} />
                      {isExecuting ? (locale === 'zh' ? '执行中...' : 'Executing...') : (locale === 'zh' ? '立即执行工具调用' : 'Execute Tool Call')}
                    </button>
                  </div>

                  <textarea
                    value={toolArgsJson}
                    onChange={e => setToolArgsJson(e.target.value)}
                    rows={7}
                    className="w-full p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Output Result Viewer */}
                <div className="flex-1 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col min-h-[220px]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-semibold">{locale === 'zh' ? '执行响应结果' : 'Execution Response'}</span>
                      {executionTimeMs !== null && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                          {executionTimeMs} ms
                        </span>
                      )}
                    </div>
                    {executionResult && (
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(executionResult, null, 2), 'result')}
                        className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px]"
                      >
                        {copiedKey === 'result' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        {locale === 'zh' ? '复制结果' : 'Copy'}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto">
                    {executionResult ? (
                      <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(executionResult, null, 2)}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs py-8">
                        <Terminal size={24} className="mb-2 opacity-40" />
                        <span>{locale === 'zh' ? '点击“立即执行工具调用”以测试 MCP 工具' : 'Click "Execute Tool Call" to trigger the MCP endpoint'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESOURCES & PROMPTS */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Layers size={14} className="text-brand-500" />
                  {locale === 'zh' ? '可订阅 MCP 资源 URI' : 'Exposed MCP Resource URIs'}
                </h3>
                <div className="space-y-2">
                  {[
                    { uri: 'doe://projects', desc: 'JSON list of all projects, factor/response summary counts, and run counts' },
                    { uri: 'doe://project/{id}', desc: 'Full project document with factor specifications, response targets, and run matrix' },
                    { uri: 'doe://analysis/{projectId}/{responseId}', desc: 'Computed ANOVA, Lack of Fit, R-squared, and regression coefficients' },
                  ].map(res => (
                    <div key={res.uri} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{res.uri}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{res.desc}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        application/json
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <BookOpen size={14} className="text-emerald-500" />
                  {locale === 'zh' ? '专家级分析与设计提示词 (Prompts)' : 'Expert Workflow Prompts'}
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">interpret_doe_results</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {locale === 'zh'
                        ? '指导 AI 模型系统审查方差分析 (ANOVA)、模型项 p 值、Lack of Fit 失拟检验，并给出陡度上升路线或二阶曲面优化建议。'
                        : 'Guides an LLM to evaluate ANOVA statistical significance, Lack of Fit, Pareto rankings, and suggest next experimental steps.'}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">recommend_doe_design</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {locale === 'zh'
                        ? '根据因素数量、分类/连续类型及实验批次预算，推荐最经济的筛选设计 (DSD / Plackett-Burman) 或响应曲面设计 (CCD / BBD)。'
                        : 'Recommends the most statistically efficient DOE design architecture based on factor count, types, and experimental budget.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{locale === 'zh' ? `共记录 ${logs.length} 次 MCP 调用` : `Total ${logs.length} MCP calls logged`}</span>
                <button
                  onClick={fetchInfo}
                  className="flex items-center gap-1 text-[11px] text-brand-500 hover:underline"
                >
                  <RefreshCw size={11} />
                  {locale === 'zh' ? '刷新日志' : 'Refresh Logs'}
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
                  {locale === 'zh' ? '暂无调用记录。使用上方测试工具或外部 Agent 发起调用后将实时显示。' : 'No calls recorded yet. Execute tools from the playground or via Claude to see live audit logs.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  {logs.map(log => (
                    <div key={log.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        {log.success ? (
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle size={15} className="text-rose-500 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{log.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {log.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{log.resultSummary}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="font-mono text-[10px] text-emerald-500">{log.durationMs}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end text-xs text-slate-500">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium transition-colors"
          >
            {locale === 'zh' ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
