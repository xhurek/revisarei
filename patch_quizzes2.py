import re

with open('src/components/QuizzesView.tsx', 'r') as f:
    qv = f.read()

# Add availableTags state and loading effect
tags_state = """  const [availableTags, setAvailableTags] = useState<{ id: string, name: string, subtags: string[] }[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);

  useEffect(() => {
    import('firebase/firestore').then(({ collection, onSnapshot, getDocs }) => {
      const qTags = collection(db, 'bankTags');
      const unsubTags = onSnapshot(qTags, (snap) => {
        if (!snap.empty) {
          const loadedTags = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          loadedTags.sort((a, b) => a.name.localeCompare(b.name));
          setAvailableTags(loadedTags);
        }
      });
      
      getDocs(collection(db, 'questionBank')).then(snap => {
        setBankQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      return () => unsubTags();
    });
  }, []);
"""
if "const [availableTags" not in qv:
    qv = qv.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n' + tags_state)

# Import AddQuestionsView
if "AddQuestionsView" not in qv[:1000]:
    qv = qv.replace("import { cn } from '../lib/utils';", "import { cn } from '../lib/utils';\nimport { AddQuestionsView } from './QuestionBankView';")


# We want to replace from `<div className="flex items-center justify-between mb-4">`
# down to the end of the `isCreating` div which is `</button>\n          </div>\n        </motion.div>`
start_idx = qv.find('<div className="flex items-center justify-between mb-4">')
end_str = '</button>\n          </div>\n        </motion.div>'
end_idx = qv.find(end_str, start_idx) + len(end_str)

create_new = """<div className="flex items-center justify-between mb-4">
             <h3 className="text-xl font-bold text-slate-800">Criar novo Caderno</h3>
             <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 font-bold">Voltar</button>
          </div>

          <div className="space-y-4 mb-6 pb-6 border-b border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Tag className="w-4 h-4"/> Título do Caderno (Área)</label>
                   <input 
                     type="text"
                     value={quizMainTag}
                     onChange={(e) => setQuizMainTag(e.target.value)}
                     placeholder="Ex: Cardiologia"
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:border-indigo-500 font-bold"
                   />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Tag className="w-4 h-4"/> Assuntos (Tags)</label>
                   <div className="flex flex-col gap-2">
                     <div className="relative">
                       <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                         type="text" 
                         value={subtagInput}
                         onChange={(e) => setSubtagInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' || e.key === ',') {
                             e.preventDefault();
                             if (subtagInput.trim() && !quizSubtags.includes(subtagInput.trim())) {
                               setQuizSubtags(prev => [...prev, subtagInput.trim()]);
                             }
                             setSubtagInput('');
                           }
                         }}
                         placeholder="Digite e tecle Enter..."
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pl-10 text-slate-700 outline-none focus:border-indigo-500 font-bold"
                       />
                     </div>
                     {quizSubtags.length > 0 && (
                       <div className="flex flex-wrap gap-2 mt-1">
                         {quizSubtags.map((tag, idx) => (
                           <span key={`${tag}-${idx}`} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                             {tag}
                             <button onClick={() => setQuizSubtags(prev => prev.filter(t => t !== tag))} className="hover:text-indigo-900 ml-1"><X className="w-4 h-4" /></button>
                           </span>
                         ))}
                       </div>
                     )}
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-2 mt-4">
                <input 
                  type="checkbox" 
                  id="create-public-toggle"
                  checked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)} 
                  className="w-4 h-4 accent-indigo-600 rounded" 
                />
                <label htmlFor="create-public-toggle" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Tornar teste público (visível na aba Comunidade)
                </label>
             </div>
          </div>

          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
             <AddQuestionsView
                onCancel={() => setIsCreating(false)}
                onSaveToDatabase={async (staging) => {
                   if (!quizMainTag.trim()) {
                     alert("Por favor, preencha o Título do Caderno (Área) acima.");
                     throw new Error("Missing title");
                   }
                   const mappedQuestions = staging.map((q: any) => ({
                     id: Math.random().toString(36).substring(7),
                     type: q.type || 'multiple_choice',
                     text: q.text,
                     options: q.options,
                     correctAnswer: q.correctAnswer || '',
                     explanation: q.explanation || '',
                     category: quizMainTag.trim(),
                     images: q.images || [],
                     answerImages: q.answerImages || [],
                     explanationImages: q.explanationImages || []
                   }));
                   
                   const quizData: Quiz = {
                     title: `Caderno de ${quizMainTag}`,
                     questions: mappedQuestions,
                     mainTag: quizMainTag.trim(),
                     subtags: quizSubtags,
                     tag: quizMainTag.trim(),
                     isPublic: isPublic,
                     userId: auth.currentUser?.uid || 'anon',
                     createdAt: new Date().toISOString()
                   };
                   
                   const { addDoc, collection } = await import('firebase/firestore');
                   const docRef = await addDoc(collection(db, 'quizzes'), quizData);
                   const savedQuiz = { ...quizData, id: docRef.id };
                   setTimeout(() => {
                     onQuizGenerated(savedQuiz, false);
                   }, 500);
                }}
                onAdded={() => { setIsCreating(false); }}
                availableTags={availableTags}
                existingQuestions={bankQuestions}
                submitLabel="Criar Caderno com Estas Questões"
             />
          </div>
        </motion.div>"""

qv = qv[:start_idx] + create_new + qv[end_idx:]

with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)

