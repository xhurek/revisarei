const fs = require('fs');

let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

content = content.replace(
  "import { AdvancedPdfBatchImport } from './AdvancedPdfBatchImport';",
  "import { AdvancedPdfBatchImport } from './AdvancedPdfBatchImport';\nimport { ZipBatchImport } from './ZipBatchImport';"
);

content = content.replace(
  "const [filterYear, setFilterYear] = useState('');",
  "const [filterYear, setFilterYear] = useState('');\n  const [batchMode, setBatchMode] = useState<'pdf' | 'zip'>('pdf');"
);

content = content.replace(
  "        <h2 className=\"text-xl font-black text-slate-900 tracking-tight\">Processar Lote de Questões</h2>",
  "        <div className=\"flex items-center justify-between\">\n          <h2 className=\"text-xl font-black text-slate-900 tracking-tight\">Processar Lote de Questões</h2>\n          <div className=\"flex bg-slate-100 p-1 rounded-lg\">\n            <button \n              onClick={() => setBatchMode('pdf')} \n              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${batchMode === 'pdf' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}\n            >\n              Lote PDF (Várias Páginas)\n            </button>\n            <button \n              onClick={() => setBatchMode('zip')} \n              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${batchMode === 'zip' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}\n            >\n              Lote ZIP (Vários PDFs)\n            </button>\n          </div>\n        </div>"
);

content = content.replace(
  "        <AdvancedPdfBatchImport ",
  "        {batchMode === 'pdf' ? (\n        <AdvancedPdfBatchImport "
);

content = content.replace(
  "          }}\n        />",
  "          }}\n        />\n        ) : (\n        <ZipBatchImport \n          existingQuestions={existingQuestions} \n          availableTags={availableTags}\n          onQuestionsExtracted={(questions) => {\n            setStaging(prev => [...prev, ...questions]);\n          }} \n        />\n        )}"
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('Patched QuestionBankView.tsx');
