with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

bad1 = """          {folderId !== 'archive' && (
                        <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700"
            >
              <Upload size={14} />
              Import
            </button>
            <button
              className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium flex items-center justify-center gap-1 text-[11px]"
            >
              <Plus size={14} />
              New Experiment
            </button>
          )}"""

good1 = """          {folderId !== 'archive' && (
            <div className="flex gap-2">
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700"
              >
                <Upload size={14} />
                Import
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium flex items-center justify-center gap-1 text-[11px]"
              >
                <Plus size={14} />
                New Experiment
              </button>
            </div>
          )}"""

content = content.replace(bad1, good1)

bad2 = """            <div className="mt-4">
                          <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium inline-flex items-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700 mr-2"
              >
                <Upload size={14} />
                Import
              </button>
              <button items-center gap-1 text-[11px]"
              >
                <Plus size={14} />
                New Experiment
              </button>
            </div>"""

good2 = """            <div className="mt-4 flex gap-2 justify-center">
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium inline-flex items-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700"
              >
                <Upload size={14} />
                Import
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium inline-flex items-center gap-1 text-[11px]"
              >
                <Plus size={14} />
                New Experiment
              </button>
            </div>"""

content = content.replace(bad2, good2)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
