import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add import icon and ref
content = re.sub(r"import { Plus,", r"import { Plus, Upload,", content)
content = re.sub(r"import { Project } from '../types';", r"import { Project } from '../types';\nimport { useRef } from 'react';", content)

# Add file input ref
content = re.sub(r"const navigate = useNavigate\(\);", r"const navigate = useNavigate();\n  const fileInputRef = useRef<HTMLInputElement>(null);\n", content)

# Add handleImport function
handle_import = """
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // generate a new id to prevent clashes
        const importedProject = {
          ...json,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        saveProject(importedProject);
      } catch (err) {
        alert('Failed to parse imported file.');
      }
    };
    reader.readAsText(file);
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
"""
content = re.sub(r"const handleCreate = \(e: React\.FormEvent\) => \{", handle_import + r"\n  const handleCreate = (e: React.FormEvent) => {", content)

# Add Import button next to New Experiment
import_btn = """
            <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700"
            >
              <Upload size={14} />
              Import
            </button>
            <button
"""
content = re.sub(r"<button\s*onClick=\{\(\) => setShowNew\(true\)\}", import_btn, content, count=1)


# Also the one down below if empty
import_btn_empty = """
            <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 font-medium inline-flex items-center gap-1 text-[11px] border border-slate-200 dark:border-slate-700 mr-2"
              >
                <Upload size={14} />
                Import
              </button>
              <button
"""
content = re.sub(r"<button\s*onClick=\{\(\) => setShowNew\(true\)\}\s*className=\"px-3 py-1\.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium inline-flex", import_btn_empty, content)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

