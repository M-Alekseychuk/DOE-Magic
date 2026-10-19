import re

with open('src/pages/ProjectView.tsx', 'r') as f:
    content = f.read()

# Add JSON export function
export_json = """
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", project.name + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportExcel = () => {
"""

content = re.sub(r"const handleExportExcel = \(\) => \{", export_json, content)

# Add Download icon import
# Wait, Download is already imported from lucide-react

export_btn = """
          <button 
            onClick={handleExportJSON}
            className="px-3 py-1.5 bg-slate-600 text-white rounded hover:bg-slate-700 font-medium flex items-center gap-1 text-[11px]"
          >
            <Download size={12} />
            Export JSON
          </button>
          <button 
"""

content = re.sub(r"<button\s*onClick=\{handleExportExcel\}", export_btn, content)

with open('src/pages/ProjectView.tsx', 'w') as f:
    f.write(content)

