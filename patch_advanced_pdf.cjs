const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

// Update the props interface
code = code.replace(
  /availableTags: \{ id: string, name: string, subtags: string\[\] \}\[\]\n\}\) \{/,
  `availableTags: { id: string, name: string, subtags: string[] }[],
  institution: string,
  year: string,
  mainTag: string,
  batchSubtags: string[]
}) {`
);

// Remove the state declarations
code = code.replace(/const \[institution, setInstitution\] = useState\(''\);\n/, '');
code = code.replace(/const \[year, setYear\] = useState\(''\);\n/, '');
code = code.replace(/const \[mainTag, setMainTag\] = useState\('Clínica Médica'\);\n/, '');
code = code.replace(/const \[batchSubtags, setBatchSubtags\] = useState<string\[\]>\(\[\]\);\n/, '');
code = code.replace(/const \[subtagInput, setSubtagInput\] = useState\(''\);\n/, '');

// Remove the UI for Institution, Year, MainTag, Subtags
const uiToRemoveRegex = /<div className="space-y-1">\s*<label className="text-\[10px\] font-black uppercase text-slate-500 tracking-widest">Instituição \(Opcional\)<\/label>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<div className="flex justify-end gap-2">/;

code = code.replace(uiToRemoveRegex, '</div>\n          <div className="flex justify-end gap-2">');

fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', code);
