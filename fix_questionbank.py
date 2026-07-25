import re

with open('src/components/QuestionBankView.tsx', 'r') as f:
    c = f.read()

# 1. missingImageQuestions update
c = c.replace(
    'const missingImageQuestions = staging.filter(q => q.hasImageWarning && (!q.images || q.images.length === 0));',
    'const missingImageQuestions = staging.filter(q => q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0));'
)

c = c.replace(
    'const hasMissingImage = q.hasImageWarning && (!q.images || q.images.length === 0);',
    'const hasMissingImage = q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0);'
)

# 2. Add checkbox in QuestionEditor
editor_warning_original = """      {q.hasImageWarning && (!q.images || q.images.length === 0) && (
        <div className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-100/60 border border-rose-200 p-3 rounded-xl">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-0.5">
            <div className="text-rose-800 font-extrabold flex items-center gap-1.5">
              <span>⚠️ Upload Manual de Imagem Requerido</span>
              {q.questionNumber && (
                <span className="bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded text-[11px] font-black">
                  Questão #{q.questionNumber}
                </span>
              )}
            </div>
            <div className="font-medium text-rose-700">
              Por favor, anexe a imagem desta questão clicando em "Adicionar Imagem" abaixo para liberar a gravação no banco de questões.
            </div>
          </div>
        </div>
      )}"""

editor_warning_replacement = """      {q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0) && (
        <div className="flex flex-col gap-3 bg-rose-100/60 border border-rose-200 p-3 rounded-xl">
          <div className="flex items-start gap-2 text-xs font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-rose-800 font-extrabold flex items-center gap-1.5">
                <span>⚠️ Upload Manual de Imagem Requerido</span>
                {q.questionNumber && (
                  <span className="bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded text-[11px] font-black">
                    Questão #{q.questionNumber}
                  </span>
                )}
              </div>
              <div className="font-medium text-rose-700">
                Por favor, anexe a imagem desta questão clicando em "Adicionar Imagem" abaixo para liberar a gravação no banco de questões.
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-rose-900 font-bold cursor-pointer hover:opacity-80 transition-opacity self-start bg-rose-200/50 py-1.5 px-3 rounded-lg border border-rose-300">
            <input 
              type="checkbox" 
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer" 
              checked={q.ignoreImageWarning || false} 
              onChange={e => setQ({ ...q, ignoreImageWarning: e.target.checked })} 
            />
            <span>A questão não possui imagem (ignorar aviso)</span>
          </label>
        </div>
      )}"""

c = c.replace(editor_warning_original, editor_warning_replacement)

# 3. Add questions.length to header
header_original = """            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">EXPLORE E RESPONDA</h2>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Banco de Questões</h1>
            </div>"""

header_replacement = """            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">EXPLORE E RESPONDA</h2>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4">Banco de Questões</h1>
                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-black">{questions.length} Questões</span>
              </div>
            </div>"""

c = c.replace(header_original, header_replacement)

with open('src/components/QuestionBankView.tsx', 'w') as f:
    f.write(c)
