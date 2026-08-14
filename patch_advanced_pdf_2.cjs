const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

const startIndex = code.indexOf('<div className="space-y-1">\n              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Instituição (Opcional)</label>');

if (startIndex !== -1) {
  const endIndex = code.indexOf('<div className="flex justify-end gap-2">', startIndex);
  if (endIndex !== -1) {
    code = code.substring(0, startIndex) + '</div>\n          ' + code.substring(endIndex);
  }
}

fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', code);
