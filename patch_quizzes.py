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
qv = qv.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n' + tags_state)

# Import AddQuestionsView
qv = qv.replace('import { cn } from \'../lib/utils\';', 'import { cn } from \'../lib/utils\';\nimport { AddQuestionsView } from \'./QuestionBankView\';')

# Now let's change the Create section
create_orig = """          <div className="flex items-center justify-between mb-4">
             <h3 className="text-xl font-bold text-slate-800">Criar novo</h3>
             <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 font-bold">Voltar</button>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl font-medium">{error}</div>}

           <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Tag className="w-4 h-4"/> Tag Principal (Grande Área)</label>
                   <select 
                     value={quizMainTag}
                     onChange={(e) => setQuizMainTag(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:border-indigo-500 font-bold appearance-none cursor-pointer"
                   >
                     <option value="" disabled>Selecione a área principal</option>
                     {PREDEFINED_MAIN_TAGS.map(tag => (
                       <option key={tag} value={tag}>{tag}</option>
                     ))}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Tag className="w-4 h-4"/> Subtags (Assuntos)</label>
                   <div className="flex flex-col gap-2">
                     <select 
                       onChange={(e) => {
                         const val = e.target.value;
                         if (val && !quizSubtags.includes(val)) {
                           setQuizSubtags(prev => [...prev, val]);
                         }
                         e.target.value = '';
                       }}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:border-indigo-500 font-bold appearance-none cursor-pointer"
                     >
                       <option value="">Selecione um assunto...</option>
                       {PREDEFINED_SUBTAGS[quizMainTag as keyof typeof PREDEFINED_SUBTAGS]?.map(tag => (
                         <option key={tag} value={tag}>{tag}</option>
                       ))}
                     </select>
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
                         placeholder="Ou digite outra e tecle Enter/Vírgula..."
                         className="w-full bg-transparent outline-none text-slate-700 font-bold text-sm"
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

             <div className="space-y-1">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Enunciado(s) e Alternativas (Cole imagens também)</label>
               <textarea 
                 value={text} 
                 onChange={e => setText(e.target.value)} 
                 placeholder="Cole o texto das questões aqui..." 
                 className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none font-medium resize-none focus:ring-2 focus:ring-indigo-600/20" 
               />
             </div>
              
             {images.length > 0 && (
               <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                 {images.map((img, i) => (
                   <div key={i} className="relative w-24 h-24 shrink-0 rounded-lg border border-slate-200 overflow-hidden group">
                     <img src={img} alt="Pasted" className="w-full h-full object-cover bg-white" />
                     <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-white/80 p-1 rounded-md text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                 ))}
               </div>
             )}

             <button
                disabled={!text.trim() || !quizMainTag || isProcessing}
                onClick={handleUpload}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold tracking-tight shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors relative overflow-hidden"
              >
                {isProcessing && <div className="absolute inset-0 bg-indigo-800 transition-all duration-300" style={{ width: `${progress}%` }} />}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isProcessing ? <>Processando com IA... {progress}%</> : 'Gerar caderno extraído'}
                </span>
             </button>
           </div>"""

create_new = """          <div className="flex items-center justify-between mb-4">
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
                onSaveBase={async (staging) => {
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
                   
                   const docRef = await import('firebase/firestore').then(({ addDoc, collection }) => addDoc(collection(db, 'quizzes'), quizData));
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
          </div>"""

qv = qv.replace(create_orig, create_new)

with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)

