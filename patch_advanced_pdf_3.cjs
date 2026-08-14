const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

const instStart = code.indexOf('<label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Instituição (Opcional)</label>');
if (instStart !== -1) {
  // Find the parent div of this label
  const divStart = code.lastIndexOf('<div className="space-y-1">', instStart);
  if (divStart !== -1) {
    const endDiv = code.indexOf('<div className="flex justify-end gap-2">', divStart);
    if (endDiv !== -1) {
      code = code.substring(0, divStart) + '</div>\n          ' + code.substring(endDiv);
    }
  }
}

fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', code);
