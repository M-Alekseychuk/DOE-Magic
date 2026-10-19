import re

with open('src/components/ProjectAnalysis.tsx', 'r') as f:
    content = f.read()

# 1. Add Download to lucide-react imports
content = re.sub(r"import { BarChart,", r"import { Download } from 'lucide-react';\nimport { BarChart,", content)

# 2. Add handleDownloadSvg inside ProjectAnalysis
func_str = """
  const handleDownloadSvg = (containerId: string, filename: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Check if it is a Plotly graph and has the download button
    const plotlyBtn = container.querySelector('.modebar-btn[data-title*="Download"]');
    if (plotlyBtn) {
      (plotlyBtn as HTMLElement).click();
      return;
    }

    const svg = container.querySelector('svg');
    if (!svg) {
      alert('Could not find SVG element to export.');
      return;
    }
    
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    
    // Attempt to inline some basic styles for Recharts
    clonedSvg.style.backgroundColor = 'white';
    clonedSvg.style.fontFamily = 'sans-serif';
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clonedSvg);
    
    if(!source.match(/^<svg[^>]+xmlns="http\\:\\/\\/www\\.w3\\.org\\/2000\\/svg"/)){
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    source = '<?xml version="1.0" standalone="no"?>\\r\\n' + source;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = filename + ".svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
"""
content = re.sub(r"export default function ProjectAnalysis\(\{ project \}: Props\) \{", r"export default function ProjectAnalysis({ project }: Props) {\n" + func_str, content)

# 3. Pareto Chart
content = re.sub(
    r"\{\/\* Pareto Chart \*\/.*?<div className=\"bg-white",
    r"{/* Pareto Chart */}\n        <div id=\"pareto-chart\" className=\"bg-white",
    content,
    flags=re.DOTALL
)
content = re.sub(
    r"(Pareto: Standardized Effects.*?<\/p>.*?<\/div>)",
    r"\1\n            <button onClick={() => handleDownloadSvg('pareto-chart', `${project.name}_Pareto_Chart`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>",
    content,
    flags=re.DOTALL|re.IGNORECASE
)
# We need a flex header to put the button to the right. Let's fix the header wrapper.
content = re.sub(
    r"(<div id=\"pareto-chart\"[^>]+>\s*)<div>\s*(<h3)",
    r"\1<div className=\"flex justify-between items-start mb-4\">\n            <div>\n              \2",
    content
)
content = re.sub(
    r"(Pareto: Standardized Effects.*?<\/p>\s*)<\/div>",
    r"\1</div>\n            <button onClick={() => handleDownloadSvg('pareto-chart', `${project.name}_Pareto_Chart`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>\n          </div>",
    content
)
# Remove the old mb-4 from p
content = content.replace('<p className="text-[10px] text-slate-500 mb-4">Shows the absolute', '<p className="text-[10px] text-slate-500">Shows the absolute')


# 4. Half Normal Plot
content = re.sub(
    r"\{\/\* Half Normal Plot \*\/.*?<div className=\"bg-white",
    r"{/* Half Normal Plot */}\n        <div id=\"half-normal-plot\" className=\"bg-white",
    content,
    flags=re.DOTALL
)
content = re.sub(
    r"(<div id=\"half-normal-plot\"[^>]+>\s*)<div>\s*(<h3)",
    r"\1<div className=\"flex justify-between items-start mb-4\">\n            <div>\n              \2",
    content
)
content = re.sub(
    r"(Half-Normal Plot of Effects.*?<\/p>\s*)<\/div>",
    r"\1</div>\n            <button onClick={() => handleDownloadSvg('half-normal-plot', `${project.name}_Half_Normal_Plot`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>\n          </div>",
    content
)
content = content.replace('<p className="text-[10px] text-slate-500 mb-4">Helps identify', '<p className="text-[10px] text-slate-500">Helps identify')

# 5. Main Effects Plot
content = re.sub(
    r"\{\/\* Main Effects Plot \*\/.*?<div className=\"bg-white",
    r"{/* Main Effects Plot */}\n        <div id=\"main-effects-plot\" className=\"bg-white",
    content,
    flags=re.DOTALL
)
content = re.sub(
    r"(<div id=\"main-effects-plot\"[^>]+>\s*)<div>\s*(<h3)",
    r"\1<div className=\"flex justify-between items-start mb-4\">\n            <div>\n              \2",
    content
)
content = re.sub(
    r"(Main Effects Plot \(Data Means\).*?<\/p>\s*)<\/div>",
    r"\1</div>\n            <button onClick={() => handleDownloadSvg('main-effects-plot', `${project.name}_Main_Effects_Plot`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>\n          </div>",
    content
)
content = content.replace('<p className="text-[10px] text-slate-500 mb-4">Shows how', '<p className="text-[10px] text-slate-500">Shows how')

# 6. Interaction Plot
content = re.sub(
    r"\{\/\* Interaction Plot \*\/.*?<div className=\"bg-white",
    r"{/* Interaction Plot */}\n        <div id=\"interaction-plot\" className=\"bg-white",
    content,
    flags=re.DOTALL
)
content = re.sub(
    r"(<div id=\"interaction-plot\"[^>]+>\s*)<div className=\"flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4\">\n\s*<div>\s*(<h3)",
    r"\1<div className=\"flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-4\">\n              <div>\n                \2",
    content
)
# Add button to Interaction Plot right side
content = re.sub(
    r"(<span className=\"text-\[10px\] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest\">F2:<\/span>\s*<select.*?(<\/select>\s*<\/div>\s*<\/div>))",
    r"\1\n              <button onClick={() => handleDownloadSvg('interaction-plot', `${project.name}_Interaction_Plot`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>",
    content,
    flags=re.DOTALL
)

# 7. DOE Mean Plot
content = re.sub(
    r"\{\/\* DOE Mean Plot \*\/.*?<div className=\"bg-white",
    r"{/* DOE Mean Plot */}\n        <div id=\"doe-mean-plot\" className=\"bg-white",
    content,
    flags=re.DOTALL
)
content = re.sub(
    r"(<div id=\"doe-mean-plot\"[^>]+>\s*)<div>\s*(<h3)",
    r"\1<div className=\"flex justify-between items-start mb-4\">\n            <div>\n              \2",
    content
)
content = re.sub(
    r"(DOE Mean Plot \(Run Means\).*?<\/p>\s*)<\/div>",
    r"\1</div>\n            <button onClick={() => handleDownloadSvg('doe-mean-plot', `${project.name}_DOE_Mean_Plot`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>\n          </div>",
    content
)
content = content.replace('<p className="text-[10px] text-slate-500 mb-4">Displays the', '<p className="text-[10px] text-slate-500">Displays the')

# 8. Contour Plot
content = re.sub(
    r"\{\/\* Contour & Response Surface Plots \*\/.*?<div className=\"lg:col-span-2 bg-white",
    r"{/* Contour & Response Surface Plots */}\n        {plotData && project.factors.length >= 2 && (\n          <div id=\"contour-plot\" className=\"lg:col-span-2 bg-white",
    content,
    flags=re.DOTALL
)

# Replace config
content = content.replace("config={{ responsive: true, displayModeBar: true }}", "config={{ responsive: true, displayModeBar: true, toImageButtonOptions: { format: 'svg', filename: `${project.name}_Response_Surface` } }}")

content = re.sub(
    r"(<span className=\"text-\[10px\] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest\">Y-Axis:<\/span>\s*<select.*?(<\/select>\s*<\/div>\s*<\/div>))",
    r"\1\n               <button onClick={() => handleDownloadSvg('contour-plot', `${project.name}_Response_Surface`)} className=\"p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors\" title=\"Download SVG\"><Download size={14} /></button>",
    content,
    flags=re.DOTALL
)


with open('src/components/ProjectAnalysis.tsx', 'w') as f:
    f.write(content)

