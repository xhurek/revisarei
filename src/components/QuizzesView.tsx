import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, Plus, BookOpen, Brain, Tag, Download, Globe, Lock, Folder, ArrowLeft, Palette, X, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quiz } from '../types';
import { handleFirestoreError, OperationType, auth, db, apiFetch, parseJsonResponse } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { AddQuestionsView } from './QuestionBankView';

export const PREDEFINED_MAIN_TAGS = [
  "Cardiologia",
  "Cirurgia Geral",
  "Clínica Médica",
  "Dermatologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Ginecologia e Obstetrícia",
  "Infectologia",
  "Medicina de Família e Comunidade",
  "Medicina de Urgência",
  "Neurologia",
  "Ortopedia",
  "Otorrinolaringologia",
  "Pediatria",
  "Pneumologia",
  "Psiquiatria",
  "Reumatologia",
  "Outra"
];

export const PREDEFINED_SUBTAGS = [
  "Asma", "AVC", "Cefaleia", "Diabetes", "Depressão", "DRGE", "Epilepsia", "Febre Reumática",
  "Hipertensão", "HAS", "Infarto", "IAM", "Insuficiência Cardíaca", "ITU", "Pneumonia", "Síndromes Cerebelares",
  "Síndromes do Tronco Encefálico", "Tuberculose"
];

interface QuizzesViewProps {
  onQuizStart: (quiz: Quiz) => void;
  onQuizGenerated: (quiz: Quiz, skipReview: boolean) => void;
}



export function QuizzesView({ onQuizStart, onQuizGenerated }: QuizzesViewProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<{ id: string, name: string, subtags: string[] }[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);

  useEffect(() => {
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
  }, []);

  
  // Calculate dynamic subtags
  const allExistingSubtags = Array.from(new Set(quizzes.flatMap(q => {
    const subtags = Array.isArray(q.subtags) ? q.subtags : 
                    (typeof q.subtags === 'object' && q.subtags !== null) ? Object.values(q.subtags) : 
                    (q.subtag ? [q.subtag] : []);
    return subtags;
  }))).filter((t: any) => t && typeof t === 'string' && t.trim() !== '');
  const availableSubtags = Array.from(new Set([...PREDEFINED_SUBTAGS, ...allExistingSubtags])).sort();
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [files, setFiles] = useState<{ support: File[] }>({ support: [] });
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pastedKeyText, setPastedKeyText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [quizMainTag, setQuizMainTag] = useState('');
  const [quizSubtags, setQuizSubtags] = useState<string[]>([]);
  const [subtagInput, setSubtagInput] = useState('');

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderColors, setFolderColors] = useState<{ [key: string]: string }>({});
  
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMainTag, setEditMainTag] = useState('');
  const [editSubtags, setEditSubtags] = useState<string[]>([]);
  const [editSubtagInput, setEditSubtagInput] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);
  
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const supportInputRef = useRef<HTMLInputElement>(null);
  const fileReaderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isCreating) return;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const res = ev.target?.result;
                if (typeof res === 'string') {
                  setImages(prev => [...prev, res]);
                }
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isCreating]);

  const fetchQuizzes = async () => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && userDoc.data().folderColors) {
         setFolderColors(userDoc.data().folderColors);
      }

      const q = query(collection(db, 'quizzes'), where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const fetchedQuizzes: Quiz[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      fetchedQuizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuizzes(fetchedQuizzes);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'quizzes/users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateFolderColor = async (folderName: string, color: string) => {
    if (!auth.currentUser) return;
    const newColors = { ...folderColors, [folderName]: color };
    setFolderColors(newColors);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), { folderColors: newColors }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 90) return 90;
          return p + Math.floor(Math.random() * 10) + 1;
        });
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleUpload = async () => {
    if (!text.trim() || !quizMainTag.trim()) {
      setError('Enunciado das questões e Tag principal são obrigatórios!');
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/extract-bank-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          answerKeyText: pastedKeyText,
          images,
          predefinedTags: { usePredefined: true, mainTag: quizMainTag, subtag: quizSubtags[0] || '' }
        })
      });

      setProgress(100);
      const data = await parseJsonResponse(response);
      
      const questionsData = data.questions || [];
      const mappedQuestions = questionsData.map((q: any) => ({
        id: q.id || Math.random().toString(36).substring(7),
        type: q.type || 'multiple_choice',
        text: q.text,
        options: q.options,
        correctAnswer: q.answer,
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
        tag: quizMainTag.trim(), // backward compatibility use as folder
        isPublic: isPublic,
        userId: auth.currentUser?.uid || 'anon',
        createdAt: new Date().toISOString()
      };
      
      try {
        const docRef = await addDoc(collection(db, 'quizzes'), quizData);
        const savedQuiz = { ...quizData, id: docRef.id };
        
        setTimeout(() => {
          onQuizGenerated(savedQuiz, true);
        }, 500);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'quizzes');
        throw err;
      }

    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const [uploadingToQuiz, setUploadingToQuiz] = useState<string | null>(null);

  const handleUploadKnowledge = async (quiz: Quiz, e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !quiz.id) return;
    
    setUploadingToQuiz(quiz.id);
    const formData = new FormData();
    for (let i=0; i<files.length; i++) {
       formData.append('files', files[i]);
    }
    
    try {
      const res = await apiFetch('/api/upload-context', {
         method: 'POST',
         body: formData
      });
      
      const data = await parseJsonResponse(res);
      
      if (data.files) {
         const newKB = [...(quiz.knowledgeBase || []), ...data.files];
         await updateDoc(doc(db, 'quizzes', quiz.id), {
           knowledgeBase: newKB
         });
         
         // Update local state
         setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, knowledgeBase: newKB } : q));
      }
    } catch (err) {
       console.error("Failed to upload context files", err);
       alert("Erro ao enviar arquivos de contexto.");
    } finally {
       setUploadingToQuiz(null);
       e.target.value = '';
    }
  };

  const removeKnowledgeFile = async (quiz: Quiz, fileIndex: number) => {
     if (!quiz.id || !quiz.knowledgeBase) return;
     const newKB = [...quiz.knowledgeBase];
     newKB.splice(fileIndex, 1);
     try {
       await updateDoc(doc(db, 'quizzes', quiz.id), {
         knowledgeBase: newKB
       });
       setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, knowledgeBase: newKB } : q));
     } catch(err) {
       console.error("Failed to remove context file", err);
     }
  };
  const handleExport = (quiz: Quiz) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'quiz'}.revisarei`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDeleteQuiz = async () => {
    if (!deletingQuiz || !deletingQuiz.id) return;
    try {
      await deleteDoc(doc(db, 'quizzes', deletingQuiz.id));
      setQuizzes(prev => prev.filter(q => q.id !== deletingQuiz.id));
    } catch (err) {
      console.error("Failed to delete quiz", err);
    } finally {
      setDeletingQuiz(null);
    }
  };

  const handleEditQuizSave = async () => {
    if (!editingQuiz || !editingQuiz.id) return;
    try {
      await updateDoc(doc(db, 'quizzes', editingQuiz.id), {
        title: editTitle,
        mainTag: editMainTag,
        subtags: editSubtags,
        isPublic: editIsPublic,
        tag: editMainTag // backward compat
      });
      setQuizzes(prev => prev.map(q => q.id === editingQuiz.id ? { ...q, title: editTitle, mainTag: editMainTag, subtags: editSubtags, isPublic: editIsPublic, tag: editMainTag } : q));
    } catch (err) {
      console.error("Failed to edit quiz", err);
    } finally {
      setEditingQuiz(null);
    }
  };

  const handleEditFolderSave = async () => {
    if (!editingFolder || !editFolderName.trim() || editingFolder === editFolderName) {
      setEditingFolder(null);
      return;
    }
    try {
      const qsToUpdate = quizzes.filter(q => (q.mainTag || q.tag || "Sem assunto") === editingFolder);
      const updatePromises = qsToUpdate.map(q => updateDoc(doc(db, 'quizzes', q.id!), { mainTag: editFolderName, tag: editFolderName }));
      await Promise.all(updatePromises);
      
      setQuizzes(prev => prev.map(q => (q.mainTag || q.tag || "Sem assunto") === editingFolder ? { ...q, mainTag: editFolderName, tag: editFolderName } : q));
    } catch (err) {
      console.error("Failed to edit folder", err);
    } finally {
      setEditingFolder(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolder) return;
    try {
      const qsToDelete = quizzes.filter(q => (q.mainTag || q.tag || "Sem assunto") === deletingFolder);
      const deletePromises = qsToDelete.map(q => {
        if (q.id) return deleteDoc(doc(db, 'quizzes', q.id));
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
      
      setQuizzes(prev => prev.filter(q => (q.mainTag || q.tag || "Sem assunto") !== deletingFolder));
    } catch (err) {
      console.error("Failed to delete folder", err);
    } finally {
      setDeletingFolder(null);
    }
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const quizData: Quiz = JSON.parse(content);
        if (!quizData.questions || !auth.currentUser) throw new Error("Invalid format");
        
        // Remove old IDs and reset ownership
        delete quizData.id;
        quizData.userId = auth.currentUser.uid;
        quizData.createdAt = new Date().toISOString();
        
        try {
          await addDoc(collection(db, 'quizzes'), quizData);
          await fetchQuizzes();
          alert("Importado com sucesso!");
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'quizzes');
          throw err;
        }
      } catch (err) {
        alert("Arquivo .revisarei inválido");
      }
      if (fileReaderRef.current) fileReaderRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Cadernos de Questões</h2>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Meus testes</h1>
        </div>
        {!isCreating && (
          <div className="flex gap-2">
            <button 
              onClick={() => fileReaderRef.current?.click()}
              className="bg-slate-100 text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition shadow-sm border border-slate-200"
            >
              <Download className="w-5 h-5" /> Importar
              <input type="file" ref={fileReaderRef} onChange={handleImport} className="hidden" accept=".revisarei,application/json" />
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" /> Novo caderno
            </button>
          </div>
        )}
      </header>

      {isCreating ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between mb-4">
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
                   
                   const docRef = await addDoc(collection(db, 'quizzes'), quizData);
                   const savedQuiz = { ...quizData, id: docRef.id };
                   setTimeout(() => {
                     onQuizGenerated(savedQuiz, true);
                   }, 500);
                }}
                onAdded={() => { setIsCreating(false); }}
                availableTags={availableTags}
                existingQuestions={bankQuestions}
                submitLabel="Criar Caderno com Estas Questões"
             />
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-slate-500 font-medium py-12">Carregando cadernos...</motion.div>
          ) : quizzes.length === 0 ? (
             <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16 bg-slate-50/50 rounded-3xl border border-slate-200">
                <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhum caderno ainda</h3>
                <p className="text-slate-500 font-medium mt-1">Crie ou importe seu primeiro caderno.</p>
             </motion.div>
          ) : selectedFolder === null ? (
            <motion.div
              key="folder-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {Array.from<string>(new Set(quizzes.map(q => q.mainTag || q.tag || "Sem assunto"))).map(folder => {
                const count = quizzes.filter(q => (q.mainTag || q.tag || "Sem assunto") === folder).length;
                const defaultColors = ['bg-indigo-500', 'bg-blue-500', 'bg-teal-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-amber-500'];
                const colorStr = folderColors[folder] || defaultColors[folder.length % defaultColors.length];
                
                return (
                  <div key={folder} className={`${colorStr} text-white p-6 rounded-3xl shadow-md cursor-pointer hover:scale-[1.02] hover:shadow-lg transition flex flex-col justify-between min-h-[160px] relative group`} onClick={(e) => {
                    // Prevent default if clicking color picker
                    if ((e.target as HTMLElement).closest('.color-picker')) return;
                    setSelectedFolder(folder);
                  }}>
                    <div className="flex justify-between items-start">
                      <Folder className="w-8 h-8 text-white/80" />
                      
                      <div className="color-picker flex gap-1 relative opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           className="p-1.5 hover:bg-white/20 rounded-md" 
                           title="Editar pasta" 
                           onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setEditFolderName(folder); setActiveColorPicker(null); }}
                         >
                           <Pencil className="w-4 h-4 text-white" />
                         </button>
                         <button 
                           className="p-1.5 hover:bg-white/20 rounded-md" 
                           title="Mudar cor" 
                           onClick={(e) => { e.stopPropagation(); setActiveColorPicker(activeColorPicker === folder ? null : folder); }}
                         >
                           <Palette className="w-4 h-4 text-white" />
                         </button>
                         <button 
                           className="p-1.5 hover:bg-white/20 rounded-md" 
                           title="Excluir pasta" 
                           onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); setActiveColorPicker(null); }}
                         >
                           <Trash2 className="w-4 h-4 text-white" />
                         </button>
                         {activeColorPicker === folder && (
                           <div className="absolute right-0 top-full mt-1 p-2 bg-white rounded-xl shadow-xl flex gap-1 z-10 w-max">
                             {defaultColors.map(color => (
                               <button 
                                 key={color} 
                                 onClick={(e) => { e.stopPropagation(); updateFolderColor(folder, color); setActiveColorPicker(null); }} 
                                 className={`w-5 h-5 rounded-full ${color}`} 
                               />
                             ))}
                           </div>
                         )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-bold text-lg leading-tight mb-1 truncate" title={folder}>{folder}</h3>
                      <p className="text-sm font-medium opacity-80">{count} teste{count !== 1 && 's'}</p>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="quiz-list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <button onClick={() => setSelectedFolder(null)} className="p-2 hover:bg-slate-200 text-slate-500 rounded-lg transition"><ArrowLeft className="w-5 h-5"/></button>
                 <div>
                   <h3 className="text-sm font-bold text-slate-400 tracking-widest uppercase">Pasta</h3>
                   <h2 className="text-xl font-bold text-slate-800">{selectedFolder}</h2>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.filter(q => (q.mainTag || q.tag || "Sem assunto") === selectedFolder).map((q) => (
                  <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-full relative group">
                    <div className="absolute top-4 right-4 flex gap-1 bg-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEditingQuiz(q); setEditTitle(q.title); setEditMainTag(q.mainTag || q.tag || ''); setEditSubtags((Array.isArray(q.subtags) ? q.subtags : (typeof q.subtags === 'object' && q.subtags !== null ? Object.values(q.subtags) : (q.subtag ? [q.subtag] : []))).filter(t => t && typeof t === 'string' && t.trim() !== '')); setEditIsPublic(!!q.isPublic) }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar pasta ou nome">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleExport(q); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Exportar (.revisarei)">
                        <Upload className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingQuiz(q); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remover permanentemente">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
  
                    <div className="flex flex-wrap gap-1 mb-3 items-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest">
                        <Tag className="w-3 h-3" />
                        {q.mainTag || q.tag || "Sem assunto"}
                      </span>
                    {((Array.isArray(q.subtags) ? q.subtags : (typeof q.subtags === 'object' && q.subtags !== null ? Object.values(q.subtags) : (q.subtag ? [q.subtag] : []))) || []).filter(t => t && typeof t === 'string' && t.trim() !== '').map((t, idx) => (
                        <span key={`${q.id}-subtag-${t}-${idx}`} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs font-bold tracking-tight">
                          {t}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] font-bold text-slate-400">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight flex-1">{q.title || "Caderno sem título"}</h3>
                    <p className="text-slate-500 font-medium text-sm mb-4">{q.questions.length} questões</p>
                    
                    {/* Knowledge Base Section */}
                    <div className="mb-6 space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> Materiais de Estudo</span>
                         <label className={cn(
                           "text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded cursor-pointer hover:bg-indigo-100 transition",
                           uploadingToQuiz === q.id && "opacity-50 cursor-not-allowed"
                         )}>
                            {uploadingToQuiz === q.id ? "Enviando..." : "+ Novo"}
                            <input type="file" multiple className="hidden" onChange={(e) => handleUploadKnowledge(q, e)} disabled={uploadingToQuiz === q.id} />
                         </label>
                       </div>
                       
                       {q.knowledgeBase && q.knowledgeBase.length > 0 ? (
                         <div className="space-y-1">
                           {q.knowledgeBase.map((kb, i) => (
                             <div key={i} className="flex flex-col gap-0.5 p-2 bg-slate-50 rounded border border-slate-100">
                               <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-indigo-700 truncate block w-4/5" title={kb.displayName}>{kb.displayName}</span>
                                  <button onClick={(e) => { e.stopPropagation(); removeKnowledgeFile(q, i); }} className="text-slate-400 hover:text-red-500">
                                     <X className="w-3 h-3" />
                                  </button>
                               </div>
                               <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{kb.expiresAt < Date.now() ? "Expirado" : "Analisa PDF/Audio/Doc"}</span>
                             </div>
                           ))}
                         </div>
                       ) : null}
                    </div>

                    <button 
                      onClick={() => onQuizStart(q)}
                      className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors mt-auto"
                    >
                      Estudar agora
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6 font-sans">Editar Caderno</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Título</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-slate-800 font-medium"
                    placeholder="Ex: Biologia Molecular"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tag Principal (Grande Área)</label>
                  <select 
                    value={editMainTag}
                    onChange={(e) => setEditMainTag(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 font-bold appearance-none cursor-pointer text-slate-800"
                  >
                     <option value="" disabled>Selecione a área principal</option>
                     {PREDEFINED_MAIN_TAGS.map(tag => (
                       <option key={tag} value={tag}>{tag}</option>
                     ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Subtags (Assuntos)</label>
                   <div className="flex flex-col gap-2">
                     <select 
                       value=""
                       onChange={(e) => {
                         const val = e.target.value.trim();
                         if (val && !editSubtags.includes(val)) {
                           setEditSubtags(prev => [...prev, val]);
                         }
                       }}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-indigo-500 font-bold appearance-none cursor-pointer"
                     >
                       <option value="" disabled>Adicionar da lista...</option>
                       {availableSubtags.filter(t => !editSubtags.includes(t)).map(tag => (
                         <option key={tag} value={tag}>{tag}</option>
                       ))}
                     </select>
                     <div className="flex bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-indigo-500 transition-colors">
                       <input 
                         type="text" 
                         value={editSubtagInput}
                         onChange={(e) => setEditSubtagInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' || e.key === ',') {
                             e.preventDefault();
                             const val = editSubtagInput.trim().replace(/,$/, '');
                             if (val && !editSubtags.includes(val)) {
                               setEditSubtags(prev => [...prev, val]);
                             }
                             setEditSubtagInput('');
                           }
                         }}
                         placeholder="Ou digite outra e tecle Enter/Vírgula..."
                         className="w-full bg-transparent outline-none text-slate-700 font-bold text-sm"
                       />
                     </div>
                     {editSubtags.length > 0 && (
                       <div className="flex flex-wrap gap-2 mt-1">
                         {editSubtags.map((tag, idx) => {
                           console.log("Rendering edit subtag:", tag, typeof tag);
                           return (
                             <span key={`${tag}-${idx}`} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                               {tag}
                               <button onClick={() => setEditSubtags(prev => prev.filter(t => t !== tag))} className="hover:text-indigo-900 ml-1"><X className="w-4 h-4" /></button>
                             </span>
                           );
                         })}
                       </div>
                     )}
                   </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100">
                  <input 
                    type="checkbox" 
                    id="edit-public-toggle"
                    checked={editIsPublic} 
                    onChange={(e) => setEditIsPublic(e.target.checked)} 
                    className="w-4 h-4 accent-indigo-600 rounded" 
                  />
                  <label htmlFor="edit-public-toggle" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                    Tornar teste público
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditingQuiz(null)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleEditQuizSave} className="px-4 py-2 font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Quiz Modal */}
      {deletingQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2 font-sans">Tem certeza?</h2>
              <p className="text-slate-600 font-medium text-sm">
                Isso removerá permanentemente o caderno <strong>{deletingQuiz.title}</strong>.{' '}
                Você não poderá desfazer essa ação.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button 
                onClick={handleDeleteQuiz} 
                className="w-full font-bold bg-red-600 text-white hover:bg-red-700 py-3 rounded-lg transition-colors shadow-sm"
              >
                Sim, excluir arquivo
              </button>
              <button 
                onClick={() => setDeletingQuiz(null)} 
                className="w-full font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6 font-sans">Editar Nome da Pasta</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Novo Nome</label>
                  <input 
                    type="text" 
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-slate-800 font-medium"
                    placeholder="Ex: Física Quântica"
                  />
                  <p className="text-xs text-slate-500 mt-2">Isso atualizará o nome (grade área) para todos os cadernos dentro desta pasta.</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditingFolder(null)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleEditFolderSave} className="px-4 py-2 font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {deletingFolder && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2 font-sans">Excluir Pasta?</h2>
              <p className="text-slate-600 font-medium text-sm">
                Isso removerá permanentemente a pasta <strong>{deletingFolder}</strong> e <strong>TODOS</strong> os cadernos dentro dela.{' '}
                Você não poderá desfazer essa ação.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button 
                onClick={handleDeleteFolder} 
                className="w-full font-bold bg-red-600 text-white hover:bg-red-700 py-3 rounded-lg transition-colors shadow-sm"
              >
                Sim, excluir tudo
              </button>
              <button 
                onClick={() => setDeletingFolder(null)} 
                className="w-full font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
