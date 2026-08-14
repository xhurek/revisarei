const fs = require('fs');
let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// We will replace the entire AnimatePresence block for Fast Check
const oldModalRegex = /<AnimatePresence>[\s\S]*?\{isFastCheckOpen && \([\s\S]*?<\/AnimatePresence>/;

const newModal = `
      <AnimatePresence>
        {isFastCheckOpen && (
          <FastCheckModal 
            missingImageQuestions={missingImageQuestions}
            onUpdateStaging={updateStaging}
            onClose={() => setIsFastCheckOpen(false)}
          />
        )}
      </AnimatePresence>
`;

content = content.replace(oldModalRegex, newModal.trim());

// Hide staging list when fast check is open
content = content.replace(
  '{staging.length > 0 && (',
  '{staging.length > 0 && !isFastCheckOpen && ('
);

// We need to define FastCheckModal outside of AddQuestionsView but inside the same file, or just above AddQuestionsView.
// Let's add it right before AddQuestionsView.

const fastCheckModalComponent = `
function FastCheckModal({ 
  missingImageQuestions, 
  onUpdateStaging, 
  onClose 
}: { 
  missingImageQuestions: BankQuestion[], 
  onUpdateStaging: (id: string, updates: Partial<BankQuestion>) => void,
  onClose: () => void 
}) {
  const [fastCheckImage, setFastCheckImage] = useState<string | null>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                setFastCheckImage(ev.target.result as string);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (missingImageQuestions.length > 0) {
          const q = missingImageQuestions[0];
          if (fastCheckImage) {
            onUpdateStaging(q.id!, { images: [fastCheckImage] });
            setFastCheckImage(null);
          } else {
            onUpdateStaging(q.id!, { ignoreImageWarning: true });
          }
          if (missingImageQuestions.length === 1) {
            onClose();
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [missingImageQuestions, fastCheckImage, onUpdateStaging, onClose]);

  if (missingImageQuestions.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl p-12 text-center flex flex-col items-center max-w-sm w-full shadow-2xl"
        >
          <Check className="w-12 h-12 text-emerald-500 mb-4" />
          <h3 className="text-xl font-black text-slate-900">Tudo verificado!</h3>
          <p className="text-slate-500 mt-2">Não há mais questões com avisos de imagem.</p>
          <button 
            onClick={onClose}
            className="mt-6 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition"
          >
            Fechar
          </button>
        </motion.div>
      </div>
    );
  }

  const q = missingImageQuestions[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col relative shadow-2xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-full bg-slate-50 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-amber-500" /> Checagem Rápida de Imagens
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Questões pendentes: <strong className="text-amber-600">{missingImageQuestions.length}</strong>
          </p>
          <div className="mt-4 flex gap-2 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 flex-wrap">
            <div className="flex items-center gap-1"><span className="px-2 py-0.5 bg-white border border-slate-200 rounded shadow-sm">Ctrl+V</span> Colar imagem globalmente</div>
            <div className="flex items-center gap-1"><span className="px-2 py-0.5 bg-white border border-slate-200 rounded shadow-sm">Enter</span> Confirmar e avançar</div>
            <div className="flex items-center gap-1"><span className="px-2 py-0.5 bg-white border border-slate-200 rounded shadow-sm">Esc</span> Sair</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-indigo-100 text-indigo-700 font-black text-xs px-2 py-1 rounded-md">Q. {q.questionNumber || '?'}</span>
              <span className="text-xs font-bold text-slate-400">{q.institution} {q.year}</span>
            </div>
            <p className="text-slate-800 whitespace-pre-wrap font-medium leading-relaxed">{q.text}</p>
            
            {q.options && q.options.length > 0 && (
              <div className="mt-4 space-y-2">
                {q.options.map((opt, i) => (
                  <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[200px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden transition-all hover:bg-slate-100/50">
            {fastCheckImage ? (
              <>
                <img src={fastCheckImage} alt="Pasted preview" className="max-h-[300px] object-contain rounded-lg shadow-sm" />
                <button 
                  onClick={() => setFastCheckImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="text-center">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Pressione <strong className="text-slate-700">Ctrl+V</strong> para colar a imagem associada</p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">Ou pressione <strong className="text-slate-600">Enter</strong> para ignorar e marcar que a questão não necessita de imagem.</p>
              </div>
            )}
          </div>
          
          <button 
             onClick={() => {
                if (fastCheckImage) {
                  onUpdateStaging(q.id!, { images: [fastCheckImage] });
                  setFastCheckImage(null);
                } else {
                  onUpdateStaging(q.id!, { ignoreImageWarning: true });
                }
                if (missingImageQuestions.length === 1) {
                  onClose();
                }
             }}
             className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
             {fastCheckImage ? "Confirmar Imagem e Avançar" : "Marcar como Sem Imagem e Avançar"} (Enter)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
`;

content = content.replace(
  'function parseStructuredText(',
  fastCheckModalComponent + '\nfunction parseStructuredText('
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('patched fast check fix');
