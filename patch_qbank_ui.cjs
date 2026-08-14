const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// I will replace from "<div className="flex items-center justify-between">\n          <h2 className="text-xl font-black text-slate-900 tracking-tight">Processar Lote de Questões</h2>"
// all the way down to the manual editor.

const startToken = '<div className="flex items-center justify-between">\n          <h2 className="text-xl font-black text-slate-900 tracking-tight">Processar Lote de Questões</h2>';
const endToken = '<div className="space-y-1">\n          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Enunciado(s) e Alternativas (Cole imagens também)</label>';

const startIdx = code.indexOf(startToken);
const endIdx = code.indexOf(endToken);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Processar Lote de Questões</h2>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 mb-6">
          <h3 className="text-sm font-bold text-slate-800">Configurações Globais (Aplicado ao Lote PDF e Manual)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Instituição (Opcional)</label>
              <input type="text" value={globalInstitution} onChange={e => setGlobalInstitution(e.target.value)} placeholder="Ex: USP, SUS-SP..." className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ano (Opcional)</label>
              <input type="text" value={globalYear} onChange={e => setGlobalYear(e.target.value)} placeholder="Ex: 2024" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="predef" checked={usePredefinedTags} onChange={e => setUsePredefinedTags(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <label htmlFor="predef" className="text-sm font-bold text-slate-700">Atribuir Tags Predefinidas (pular IA de categoria)</label>
          </div>
          
          {usePredefinedTags && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tag Principal</label>
                <select 
                  value={globalMainTag} 
                  onChange={e => setGlobalMainTag(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500"
                >
                  {availableTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Subtags (Digite e pressione enter ou vírgula)</label>
                <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                  {globalSubtags.map(sub => (
                    <span key={sub} className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      {sub}
                      <button type="button" onClick={() => setGlobalSubtags(globalSubtags.filter(s => s !== sub))} className="hover:text-rose-600 transition">&times;</button>
                    </span>
                  ))}
                  <input 
                    type="text" 
                    value={globalSubtagInput}
                    onChange={e => setGlobalSubtagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = globalSubtagInput.trim().replace(/,$/, '').trim();
                        if (val && !globalSubtags.includes(val)) {
                          setGlobalSubtags([...globalSubtags, val]);
                          setGlobalSubtagInput('');
                        }
                      }
                    }}
                    className="flex-1 outline-none text-sm min-w-[120px]"
                    placeholder="Adicionar subtag..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <AdvancedPdfBatchImport 
          existingQuestions={existingQuestions} 
          availableTags={availableTags}
          institution={globalInstitution}
          year={globalYear}
          mainTag={usePredefinedTags ? globalMainTag : ''}
          batchSubtags={usePredefinedTags ? globalSubtags : []}
          onQuestionsExtracted={(questions) => {
            setStaging(prev => [...prev, ...questions]);
          }} 
        />
        
        <button 
          onClick={() => setIsManualModeOpen(!isManualModeOpen)}
          className="w-full bg-white text-slate-700 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2 mb-4"
        >
          {isManualModeOpen ? 'Ocultar Criação Manual / IA de Texto' : 'Criar Questão Manualmente / Texto com IA'} <Plus className="w-4 h-4" />
        </button>
        {isManualModeOpen && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
  `;
  
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/components/QuestionBankView.tsx', code);
}
