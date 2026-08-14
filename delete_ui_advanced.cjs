const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

const startStr = '<div className="space-y-1">\n              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Instituição (Opcional)</label>';
const endStr = '          </div>\n          <div className="flex justify-end gap-2">';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex);
}

fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', code);
