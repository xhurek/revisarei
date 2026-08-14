const fs = require('fs');
let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// Add state
content = content.replace(
  "const [filterYear, setFilterYear] = useState('');",
  "const [filterYear, setFilterYear] = useState('');\n  const [filterImageText, setFilterImageText] = useState('');"
);

// Update filter
const filterLogic = `
  const filtered = questions.filter(q => {
    if (search && !q.text.toLowerCase().includes(search.toLowerCase()) && !q.subtag?.toLowerCase().includes(search.toLowerCase()) && !q.subtags?.some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterMainTag && q.mainTag !== filterMainTag) return false;
    if (filterSubtag && !(q.subtags?.includes(filterSubtag) || q.subtag === filterSubtag)) return false;
    if (filterInstitution && q.institution !== filterInstitution) return false;
    if (filterYear && q.year !== filterYear) return false;
    
    if (filterImageText) {
      const imageKeywordsRegex = /\\b(imagem|figura|gr[áa]fico|radiografia|ecocardiograma|ecg|esquema|foto|exame)\\b/i;
      const hasImageText = imageKeywordsRegex.test(q.text);
      if (filterImageText === 'true' && !hasImageText) return false;
      if (filterImageText === 'false' && hasImageText) return false;
    }
    
    return true;
  });
`;

content = content.replace(
  /const filtered = questions\.filter\(q => \{[\s\S]*?return true;\n  \}\);/,
  filterLogic.trim()
);

// Add select to UI
const uiSelect = `
            <select 
              value={filterImageText}
              onChange={e => setFilterImageText(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Status da Imagem (Todos)</option>
              <option value="true">Com menção à imagem/exame</option>
              <option value="false">Sem menção à imagem</option>
            </select>
          </div>
`;

content = content.replace(
  /<\/select>\s*<\/div>/,
  `</select>${uiSelect}`
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('patched image text filter');
