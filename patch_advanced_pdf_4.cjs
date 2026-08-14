const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

const regexToRemove = /<div className="space-y-1">\s*<label className="text-\[10px\] font-black uppercase text-slate-500 tracking-widest">Instituição \(Opcional\)<\/label>[\s\S]*?<div className="flex justify-end gap-2">/;

code = code.replace(regexToRemove, '<div className="flex justify-end gap-2">');

fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', code);
