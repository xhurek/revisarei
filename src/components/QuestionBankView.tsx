import { CreateQuizModal } from './CreateQuizModal';
import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, orderBy, limit, onSnapshot, getDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, apiFetch, parseJsonResponse } from '../lib/firebase';
import { BankQuestion } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Save, Trash2, X, Edit2, Check, UploadCloud, Eye, Image as ImageIcon, Brain, Tag, AlertTriangle, BookOpen, Wand2, Compass, Heart, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { AdvancedPdfBatchImport } from './AdvancedPdfBatchImport';
import { fixPdfLigatures, sanitizeQuestionFields, checkQuestionFormatting } from '../lib/textSanitizer';
import { getCachedBankTags, setCachedBankTags, hasCachedBankTags, BankTagItem, DEFAULT_BANK_TAGS } from '../lib/staticCache';

let memoryCachedQuestions: BankQuestion[] | null = null;

export function QuestionBankView({ isAdmin }: { isAdmin: boolean }) {
  const [questions, setQuestions] = useState<BankQuestion[]>(() => {
    if (memoryCachedQuestions && memoryCachedQuestions.length > 0) return memoryCachedQuestions;
    try {
      const stored = sessionStorage.getItem('cached_questionBank');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });
  const [loading, setLoading] = useState(!memoryCachedQuestions || memoryCachedQuestions.length === 0);
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Real-time dynamic tags list from localStorage
  const [availableTags, setAvailableTags] = useState<BankTagItem[]>(() => getCachedBankTags());
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Search/Filter state
  const [search, setSearch] = useState('');
  const [filterMainTag, setFilterMainTag] = useState('');
  const [filterSubtag, setFilterSubtag] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterImageText, setFilterImageText] = useState('');
  const [isCreateQuizModalOpen, setIsCreateQuizModalOpen] = useState(false);
                const [userFolders, setUserFolders] = useState<Record<string, string>>({});
  const [selectedQuestionForComments, setSelectedQuestionForComments] = useState<BankQuestion | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (isCreateQuizModalOpen) {
        getDoc(doc(db, 'users', auth.currentUser!.uid)).then(snap => {
            if (snap.exists()) {
                setUserFolders(snap.data().folderColors || {});
                setUserData(snap.data());
            }
        });
    } else if (auth.currentUser && !userData) {
        getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
            if (snap.exists()) setUserData(snap.data());
        });
    }
  }, [isCreateQuizModalOpen, auth.currentUser]);

  useEffect(() => {
    if (selectedQuestionForComments) {
      setComments([]);
      const fetchComments = async () => {
        try {
          const q = query(
            collection(db, 'comments'),
            where('questionId', '==', selectedQuestionForComments.id)
          );
          const snapshot = await getDocs(q);
          const fetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          fetched.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setComments(fetched);
        } catch (err) {
          console.error(err);
        }
      };
      fetchComments();
    }
  }, [selectedQuestionForComments]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedQuestionForComments || !auth.currentUser) return;
    try {
      const commentData = {
        quizId: 'bank',
        questionId: selectedQuestionForComments.id,
        quizTitle: 'Banco de Questões',
        text: newComment.trim(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Usuário',
        userPhoto: auth.currentUser.photoURL || '',
        userTitle: userData?.title || 'Estudante de Medicina',
        likes: [],
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'comments'), commentData);
      setComments(prev => [...prev, { ...commentData, id: docRef.id }]);
      setNewComment('');
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar comentário.');
    }
  };

  const handleToggleLikeComment = async (commentId: string, currentLikes: string[] = []) => {
    if (!auth.currentUser) {
      alert('Faça login para curtir comentários!');
      return;
    }
    const uid = auth.currentUser.uid;
    const isLiked = currentLikes.includes(uid);

    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const newLikes = isLiked
        ? (c.likes || []).filter((id: string) => id !== uid)
        : [...(c.likes || []), uid];
      return { ...c, likes: newLikes };
    }));

    try {
      const commentRef = doc(db, 'comments', commentId);
      if (isLiked) {
        await updateDoc(commentRef, { likes: currentLikes.filter(id => id !== uid) });
      } else {
        await updateDoc(commentRef, { likes: [...currentLikes, uid] });
      }
    } catch (err) {
      console.error("Error toggling comment like:", err);
    }
  };
  
  ;


  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check memory cache first
    if (memoryCachedQuestions && memoryCachedQuestions.length > 0) {
      setQuestions(memoryCachedQuestions);
      setLoading(false);
    } else {
      // Try to load from sessionStorage
      try {
        const stored = sessionStorage.getItem('cached_questionBank');
        if (stored) {
          const parsed = JSON.parse(stored);
          memoryCachedQuestions = parsed;
          setQuestions(parsed);
          setLoading(false);
        } else {
          // If neither, fetch from Firestore
          fetchQuestions();
        }
      } catch {
        fetchQuestions();
      }
    }

    if (!hasCachedBankTags()) {
      getDocs(collection(db, 'bankTags')).then(snap => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankTagItem));
          setAvailableTags(list);
          setCachedBankTags(list);
        } else {
          setAvailableTags(DEFAULT_BANK_TAGS);
          setCachedBankTags(DEFAULT_BANK_TAGS);
        }
      }).catch(err => {
        console.warn("Could not load bankTags from Firestore, using default:", err);
      });
    }

    const handleTagsUpdated = (e: any) => {
      if (e.detail) {
        setAvailableTags(e.detail);
      } else {
        setAvailableTags(getCachedBankTags());
      }
    };
    window.addEventListener('bank_tags_updated', handleTagsUpdated);

    return () => {
      window.removeEventListener('bank_tags_updated', handleTagsUpdated);
    };
  }, []);

  const fetchQuestions = async () => {
    try {
      const snap = await getDocs(collection(db, 'questionBank'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankQuestion));
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      memoryCachedQuestions = list;
      try {
        sessionStorage.setItem('cached_questionBank', JSON.stringify(list));
      } catch {
        // ignore
      }
      setQuestions(list);
      setLoading(false);
      setQuotaExceeded(false);
    } catch (err: any) {
      console.error("Error refreshing questionBank:", err);
      if (err?.message?.includes('Quota limit exceeded')) {
        setQuotaExceeded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const [isFixingLigatures, setIsFixingLigatures] = useState(false);

  const handleFixAllLigatures = async () => {
    if (!confirm('Deseja executar o saneamento automático de texto em TODO o banco de dados?\n\nIsso irá varrer todas as questões salvas e corrigir:\n1. Erros de OCR da letra "V" substituindo "FL"/"FI" (ex: "INVAMAÇÃO" -> "INFLAMAÇÃO", "VUTUAÇÃO" -> "FLUTUAÇÃO", "REVUXO" -> "REFLUXO")\n2. Substituições do caractere "+" por "fi"/"fl" (ex: "ultrassonográ+ca" -> "ultrassonográfica")\n3. Acentos e cedilhas isolados ou separados de letras (ex: "c ̧ a ̃ o" -> "ção", "mama ́ rio" -> "mamário", "+ ́ sico" -> "físico")\n4. Remoção de sujeira e cabeçalhos no início do enunciado (ex: "2024 - USP - Questão 12 -")\n5. Separação automática de alternativas coladas dentro do enunciado.')) {
      return;
    }
    setIsFixingLigatures(true);
    try {
      let fixedCount = 0;
      const snap = await getDocs(collection(db, 'questionBank'));
      for (const docSnap of snap.docs) {
        const q = { id: docSnap.id, ...docSnap.data() } as BankQuestion;
        const sanitized = sanitizeQuestionFields(q);
        
        const textChanged = sanitized.text !== q.text;
        const optionsChanged = JSON.stringify(sanitized.options) !== JSON.stringify(q.options);
        const answerChanged = sanitized.correctAnswer !== q.correctAnswer;
        const explanationChanged = sanitized.explanation !== q.explanation;
        const instChanged = sanitized.institution !== q.institution;
        const yearChanged = sanitized.year !== q.year;
        const subtagChanged = sanitized.subtag !== q.subtag || JSON.stringify(sanitized.subtags) !== JSON.stringify(q.subtags);
        
        if (textChanged || optionsChanged || answerChanged || explanationChanged || instChanged || yearChanged || subtagChanged) {
          const updateObj: any = {
            text: sanitized.text,
            options: sanitized.options || [],
            correctAnswer: sanitized.correctAnswer || '',
            explanation: sanitized.explanation || '',
            institution: sanitized.institution || ''
          };
          if (sanitized.year) updateObj.year = sanitized.year;
          if (sanitized.subtag !== undefined) updateObj.subtag = sanitized.subtag;
          if (sanitized.subtags !== undefined) updateObj.subtags = sanitized.subtags;

          await updateDoc(doc(db, 'questionBank', q.id!), updateObj);
          fixedCount++;
        }
      }
      
      await fetchQuestions();
      if (fixedCount > 0) {
        alert(`Saneamento concluído com sucesso! ${fixedCount} questão(ões) no banco foram corrigidas.`);
      } else {
        alert('Saneamento concluído! Nenhuma questão no banco precisou de correção no momento.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao realizar saneamento do banco: ' + err.message);
    } finally {
      setIsFixingLigatures(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const uniqueMainTags = Array.from(new Set([...questions.map(q => q.mainTag), ...availableTags.map(t => t.name)])).filter((x): x is string => Boolean(x)).sort();
  const uniqueSubtags = Array.from(new Set(questions.flatMap(q => q.subtags || (q.subtag ? [q.subtag] : [])))).filter((x): x is string => Boolean(x)).sort();
  const uniqueInstitutions = Array.from(new Set(questions.map(q => q.institution))).filter((x): x is string => Boolean(x)).sort();
  const uniqueYears = Array.from(new Set(questions.map(q => q.year))).filter((x): x is string => Boolean(x)).sort();

  const filtered = questions.filter(q => {
    if (search && !q.text.toLowerCase().includes(search.toLowerCase()) && !q.subtag?.toLowerCase().includes(search.toLowerCase()) && !q.subtags?.some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterMainTag && q.mainTag !== filterMainTag) return false;
    if (filterSubtag && !(q.subtags?.includes(filterSubtag) || q.subtag === filterSubtag)) return false;
    if (filterInstitution && q.institution !== filterInstitution) return false;
    if (filterYear && q.year !== filterYear) return false;
    
    if (filterImageText) {
      const imageKeywordsRegex = /\b(imagem|figura|gr[áa]fico|radiografia|ecocardiograma|ecg|esquema|foto|exame)\b/i;
      const hasImageText = imageKeywordsRegex.test(q.text);
      if (filterImageText === 'true' && !hasImageText) return false;
      if (filterImageText === 'false' && hasImageText) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      
      
            
      <CreateQuizModal 
        isOpen={isCreateQuizModalOpen}
        onClose={() => setIsCreateQuizModalOpen(false)}
        questions={questions}
        userFolders={userFolders}
        uniqueMainTags={uniqueMainTags}
        uniqueSubtags={uniqueSubtags}
        uniqueInstitutions={uniqueInstitutions}
        uniqueYears={uniqueYears}
        auth={auth}
        db={db}
      />



      {isManagingTags ? (
        <TagManagerView 
          availableTags={availableTags} 
          onClose={() => setIsManagingTags(false)} 
        />
      ) : !isAdding ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">EXPLORE E RESPONDA</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4">Banco de Questões</h1>
                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-black whitespace-nowrap shrink-0">{questions.length} <span className="hidden sm:inline">Questões</span></span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
              <button 
                onClick={() => setIsCreateQuizModalOpen(true)}
                className="w-full sm:w-auto min-w-[70%] sm:min-w-0 flex items-center justify-center gap-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-6 py-3 rounded-xl font-bold border border-indigo-200 transition shadow-sm"
              >
                <BookOpen className="w-5 h-5 shrink-0" />
                <span className="text-sm sm:text-base whitespace-nowrap">Novo caderno</span>
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full sm:w-auto min-w-[70%] sm:min-w-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition text-sm sm:text-base whitespace-nowrap"
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  <span>Adicionar Questões</span>
                </button>
              )}
            </div>

          </div>

          
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-[2] min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar no enunciado ou subárea..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
            <select 
              value={filterMainTag}
              onChange={e => setFilterMainTag(e.target.value)}
              className="flex-1 min-w-[180px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Todas as Grandes Áreas</option>
              {availableTags.map(tag => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
            <select 
              value={filterSubtag}
              onChange={e => setFilterSubtag(e.target.value)}
              className="flex-1 min-w-[180px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Todas as Subtags</option>
              {uniqueSubtags.map((sub, i) => (
                <option key={i} value={sub}>{sub}</option>
              ))}
            </select>
            <select 
              value={filterInstitution}
              onChange={e => setFilterInstitution(e.target.value)}
              className="flex-1 min-w-[180px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Todas as Bancas</option>
              {uniqueInstitutions.map((inst, i) => (
                <option key={i} value={inst}>{inst}</option>
              ))}
            </select>
            <select 
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Todos os Anos</option>
              {uniqueYears.map((yr, i) => (
                <option key={i} value={yr}>{yr}</option>
              ))}
            </select>
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




          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400 text-center py-10 font-bold">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-slate-400 text-center py-10 font-bold">Nenhuma questão encontrada.</p>
            ) : (
              filtered.map(q => {
                if (editingId === q.id) {
                  return (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      availableTags={availableTags}
                      onCancel={() => setEditingId(null)}
                      onSave={async (updatedQ) => {
                        try {
                          await updateDoc(doc(db, 'questionBank', q.id!), { ...updatedQ });
                          setQuestions(questions.map(x => x.id === q.id ? updatedQ : x));
                          setEditingId(null);
                        } catch (err: any) {
                          handleFirestoreError(err, OperationType.UPDATE, `questionBank/${q.id}`);
                        }
                      }}
                    />
                  );
                }
                const formatIssue = checkQuestionFormatting(q);
                return (
                <div key={q.id} id={`bank-q-${q.id}`} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 transition-all duration-300">
                  {formatIssue.hasIssue && (
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl mb-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <div className="font-extrabold text-amber-900">⚠️ Alerta na Questão</div>
                          <div className="font-medium text-amber-800 text-[11px]">{formatIssue.details.join(' • ')}</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const sanitized = sanitizeQuestionFields(q);
                          const validOpts = Array.isArray(sanitized.options) ? sanitized.options.filter((o: any) => String(o).replace(/^[a-eA-E][\)\.\-\s]+/, '').trim().length > 0) : [];
                          if (validOpts.length < 2 && (q.type || 'multiple_choice') === 'multiple_choice') {
                            if (!sanitized.options || sanitized.options.length < 4) {
                              sanitized.options = ['A) ', 'B) ', 'C) ', 'D) '];
                            }
                            try {
                              await updateDoc(doc(db, 'questionBank', q.id!), { ...sanitized });
                              setQuestions(questions.map(x => x.id === q.id ? { ...x, ...sanitized } : x));
                            } catch (e) {
                              console.error(e);
                            }
                            setEditingId(q.id!);
                          } else {
                            try {
                              await updateDoc(doc(db, 'questionBank', q.id!), { ...sanitized });
                              setQuestions(questions.map(x => x.id === q.id ? { ...x, ...sanitized } : x));
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] px-3 py-1.5 rounded-lg font-bold transition shadow-sm shrink-0 flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        Corrigir Questão
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-[10px] uppercase font-black tracking-widest px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md">
                      {q.mainTag}
                    </span>
                    {q.subtag && !q.subtags?.length && (
                      <span className="text-[10px] uppercase font-black tracking-widest px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                        {q.subtag}
                      </span>
                    )}
                    {q.subtags && q.subtags.map((sub, idx) => (
                      <span key={idx} className="text-[10px] uppercase font-black tracking-widest px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                        {sub}
                      </span>
                    ))}
                    {(q.institution || q.year) && (
                      <span className="text-[10px] uppercase font-black tracking-widest px-2 py-1 bg-amber-50 text-amber-700 rounded-md">
                        {q.institution} {q.year}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 font-medium mb-4 whitespace-pre-wrap">{q.text}</p>
                  
                  {q.images && q.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-4 p-2 bg-slate-50 rounded-lg">
                      {q.images.map((img, i) => (
                        <div key={i} className="relative w-32 h-32 shrink-0 rounded-lg border border-slate-200 overflow-hidden">
                          <img src={img} alt="Imagem da questão" className="w-full h-full object-contain bg-white" />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.options && q.options.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className="p-2 rounded-lg text-sm border bg-slate-50 border-slate-200 text-slate-700">
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Neutral, Interactive Gabarito Reveal (Non-green) */}
                  {revealedAnswers[q.id!] ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm mb-4">
                      <strong>Gabarito Oficial:</strong> {q.correctAnswer}
                    </div>
                  ) : (
                    <button 
                      onClick={() => toggleReveal(q.id!)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 mb-4 transition bg-slate-50 hover:bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                      <Eye className="w-4 h-4" /> Ver Gabarito
                    </button>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                     <button
                       onClick={() => setSelectedQuestionForComments(q)}
                       className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
                     >
                       <BookOpen className="w-4 h-4" /> Comentários e Curtidas
                     </button>
                     
                     {isAdmin && (
                       <div className="flex justify-end gap-2">
                         <button 
                           onClick={() => setEditingId(q.id!)}
                           className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                           title="Editar"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={async () => {
                             if (confirm('Excluir esta questão?')) {
                               try {
                                 await deleteDoc(doc(db, 'questionBank', q.id!));
                                 setQuestions(questions.filter(x => x.id !== q.id));
                               } catch (err: any) {
                                 handleFirestoreError(err, OperationType.DELETE, `questionBank/${q.id}`);
                               }
                             }
                           }}
                           className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                           title="Excluir"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </>
      ) : (
        <AddQuestionsView 
          onCancel={() => setIsAdding(false)} 
          onAdded={() => { setIsAdding(false); fetchQuestions(); }} 
          availableTags={availableTags}
          existingQuestions={questions}
        />
      )}

      {selectedQuestionForComments && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl p-6 shadow-2xl flex flex-col relative overflow-hidden">
             <button 
               onClick={() => setSelectedQuestionForComments(null)}
               className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-50 transition"
             >
               <X className="w-5 h-5" />
             </button>
             
             <div className="mb-6 border-b border-slate-100 pb-4">
               <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                 <BookOpen className="w-5 h-5 text-indigo-500" />
                 Comentários e Curtidas
               </h2>
               <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                 {selectedQuestionForComments.mainTag}
               </p>
               <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 line-clamp-3">{selectedQuestionForComments.text}</p>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 pr-2">
               {comments.length === 0 ? (
                 <p className="text-center text-sm font-medium text-slate-400 py-8">
                   Nenhum comentário ainda. Seja o primeiro a comentar!
                 </p>
               ) : (
                 comments.map(c => {
                   const likesArr = Array.isArray(c.likes) ? c.likes : [];
                   const isLikedByMe = auth.currentUser ? likesArr.includes(auth.currentUser.uid) : false;

                   return (
                     <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex items-center gap-3">
                           {c.userPhoto ? (
                             <img src={c.userPhoto} alt="User" className="w-8 h-8 rounded-full shadow-sm" />
                           ) : (
                             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-sm">
                               <UserIcon className="w-4 h-4" />
                             </div>
                           )}
                           <div>
                             <p className="text-sm font-bold text-slate-900 leading-none">{c.userName || 'Usuário'}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{c.userTitle}</p>
                           </div>
                        </div>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{c.text}</p>
                        <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                           <span className="text-[10px] font-bold text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                           <button
                             onClick={() => handleToggleLikeComment(c.id, likesArr)}
                             className={cn(
                               "flex items-center gap-1.5 text-xs font-bold transition-colors px-2 py-1 rounded-lg",
                               isLikedByMe ? "text-rose-600 bg-rose-50" : "text-slate-500 hover:bg-slate-200"
                             )}
                           >
                             <Heart className={cn("w-4 h-4", isLikedByMe && "fill-rose-600")} />
                             {likesArr.length}
                           </button>
                        </div>
                     </div>
                   );
                 })
               )}
             </div>
             
             <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicione um comentário..." 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-colors" 
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                  />
                  <button 
                    onClick={handleSendComment} 
                    className="bg-indigo-600 text-white px-5 font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Enviar
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseQuestionsFromText(
  rawInputText: string, 
  currentMainTag?: string, 
  currentSubtag?: string, 
  currentInstitution?: string, 
  currentYear?: string
): BankQuestion[] {
  const rawText = fixPdfLigatures(rawInputText);
  const lines = rawText.split('\n');
  const parsedQuestions: BankQuestion[] = [];
  let currentQuestion: Partial<BankQuestion> | null = null;
  let currentOptions: string[] = [];

  // Matches lines starting with numbers like "1.", "1 -", "01)", "Questão 1:"
  const questionRegex = /^\s*(?:Quest[ãa]o\s+)?(\d+)\s*[\.\-\)\:]/i;
  // Matches letters like "a)", "b)", "C -", "d." at start of option
  const optionRegex = /^\s*([a-eA-E])\s*[\)\.\-\s]\s*(.*)/;
  const imageKeywords = /\b(imagem|figura|gr[áa]fico|radiografia|ecocardiograma|ecg|esquema|foto)\b/i;
  const gabaritoKeywords = /\b(gabarito|tabela de gabarito|respostas do simulado)\b/i;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a new question starting
    const qMatch = line.match(questionRegex);
    if (qMatch) {
      if (currentQuestion && currentQuestion.text) {
        currentQuestion.options = currentOptions;
        parsedQuestions.push(sanitizeQuestionFields(currentQuestion as BankQuestion));
      }
      const qNum = qMatch[1];
      const restText = line.replace(questionRegex, '').trim();
      currentQuestion = {
        id: 'docx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        questionNumber: qNum,
        text: restText,
        type: 'multiple_choice',
        correctAnswer: '',
        mainTag: currentMainTag || 'Clínica Médica',
        subtag: currentSubtag ? currentSubtag.split(',')[0].trim() : '',
        subtags: currentSubtag ? currentSubtag.split(',').map(s=>s.trim()).filter(Boolean) : [],
        institution: currentInstitution || '',
        year: currentYear || '',
        hasImageWarning: imageKeywords.test(restText) && !gabaritoKeywords.test(restText),
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'unknown'
      };
      currentOptions = [];
      continue;
    }

    // Check if it's an option line
    const optMatch = line.match(optionRegex);
    if (optMatch && currentQuestion) {
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      currentOptions.push(`${letter}) ${text}`);
      continue;
    }

    // Append to question text or append to last option if it's multiline
    if (currentQuestion) {
      if (imageKeywords.test(trimmed) && !gabaritoKeywords.test(trimmed)) {
        currentQuestion.hasImageWarning = true;
      }
      if (currentOptions.length > 0) {
        currentOptions[currentOptions.length - 1] += ' ' + trimmed;
      } else {
        currentQuestion.text += '\n' + trimmed;
      }
    }
  }

  // Push final question
  if (currentQuestion && currentQuestion.text) {
    currentQuestion.options = currentOptions;
    parsedQuestions.push(sanitizeQuestionFields(currentQuestion as BankQuestion));
  }

  // Filter out any item that is actually the gabarito at the end
  const filtered = parsedQuestions.filter(q => {
    const textLower = (q.text || '').toLowerCase();
    const numLower = String(q.questionNumber || '').toLowerCase();
    if (numLower.includes('gabarito')) return false;
    if (textLower.includes('tabela de gabarito') || textLower.includes('gabarito oficial')) return false;
    if (/^(?:\s*\d+[\.\-\s]+[A-E]\s*){3,}$/i.test(q.text.trim())) return false;
    return true;
  });

  // Fallback if no structured questions found: insert entire text as one discursive question
  if (filtered.length === 0 && rawText.trim().length > 10) {
    filtered.push({
      id: 'docx_fallback_' + Date.now(),
      text: rawText.trim(),
      type: 'discursive',
      correctAnswer: '',
      mainTag: currentMainTag || 'Clínica Médica',
      subtag: currentSubtag || '',
      institution: currentInstitution || '',
      year: currentYear || '',
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.uid || 'unknown'
    });
  }

  return filtered;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\r\n\t]+/g, ' ').trim();
}



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

function parseStructuredText(rawText: string, currentMainTag: string, currentSubtag: string, currentInstitution: string, currentYear: string, currentUserUid: string): BankQuestion[] {
  const blocks = rawText.split(/(?=^QUESTÃO:)/im).map(s => s.trim()).filter(Boolean);
  const questions: BankQuestion[] = [];
  
  for (const block of blocks) {
    if (!block.toUpperCase().startsWith("QUESTÃO:")) continue;
    
    const questionMatch = block.match(/^QUESTÃO:\s*(.*)$/im);
    const anoMatch = block.match(/^ANO:\s*(.*)$/im);
    const bancaMatch = block.match(/^BANCA:\s*(.*)$/im);
    const imagemMatch = block.match(/^POSSUI IMAGEM NO PDF:\s*(.*)$/im);
    const gabaritoMatch = block.match(/^GABARITO DA QUESTÃO:\s*(.*)$/im);
    
    const enunciadoMatch = block.match(/\[ENUNCIADO\]([\s\S]*?)\[ALTERNATIVAS\]/i);
    let alternativasMatch = block.match(/\[ALTERNATIVAS\]([\s\S]*?)$/i);
    let alternativasText = alternativasMatch ? alternativasMatch[1].trim() : '';
    alternativasText = alternativasText.replace(/={10,}[\s\S]*$/, '').replace(/-{10,}[\s\S]*$/, '').trim();
    
    if (questionMatch && enunciadoMatch) {
      questions.push({
        id: 'struct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        questionNumber: questionMatch[1].trim(),
        year: anoMatch ? anoMatch[1].trim() : currentYear || '',
        institution: bancaMatch ? bancaMatch[1].trim() : currentInstitution || '',
        hasImageWarning: imagemMatch ? ['SIM', 'S', 'YES', 'TRUE'].includes(imagemMatch[1].trim().toUpperCase()) : false,
        correctAnswer: gabaritoMatch ? gabaritoMatch[1].trim() : '',
        text: enunciadoMatch[1].trim(),
        options: alternativasText.split('\n').map(l => l.trim()).filter(Boolean),
        type: 'multiple_choice',
        mainTag: currentMainTag || 'Clínica Médica',
        subtag: currentSubtag ? currentSubtag.split(',')[0].trim() : '',
        subtags: currentSubtag ? currentSubtag.split(',').map(s=>s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
        createdBy: currentUserUid || 'unknown'
      });
    }
  }
  return questions;
}

export function AddQuestionsView({ 
  onCancel, 
  onAdded, 
  availableTags,
  existingQuestions,
  onSaveToDatabase,
  submitLabel = 'Salvar no Banco'
}: { 
  onCancel: () => void, 
  onAdded: () => void, 
  availableTags: { id: string, name: string, subtags: string[] }[],
  existingQuestions: BankQuestion[],
  onSaveToDatabase?: (staging: BankQuestion[]) => Promise<void>,
  submitLabel?: string
}) {
  const [text, setText] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [globalInstitution, setGlobalInstitution] = useState('');
  const [globalYear, setGlobalYear] = useState('');
  const [editingStagingId, setEditingStagingId] = useState<string | null>(null);
  
  const [usePredefinedTags, setUsePredefinedTags] = useState(false);
  const [globalMainTag, setGlobalMainTag] = useState('Clínica Médica');
  const [globalSubtags, setGlobalSubtags] = useState<string[]>([]);
  const [globalSubtagInput, setGlobalSubtagInput] = useState('');
  
  const [images, setImages] = useState<string[]>([]);
  const [staging, setStaging] = useState<BankQuestion[]>([]);
  const [processing, setProcessing] = useState(false);
  const [docxParsing, setDocxParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isManualModeOpen, setIsManualModeOpen] = useState(false);
  const [isFastCheckOpen, setIsFastCheckOpen] = useState(false);
  const [fastCheckImage, setFastCheckImage] = useState<string | null>(null);


  // Helper to determine if a question in staging is a duplicate
  const checkDuplicate = (q: BankQuestion) => {
    if (!q.text) return { isDup: false, type: null };
    const qNorm = normalizeText(q.text);
    
    // Check against existing questions in the database
    const inDb = existingQuestions.some(eq => eq.text && normalizeText(eq.text) === qNorm);
    if (inDb) return { isDup: true, type: 'db' };
    
    // Check against other questions in staging with different IDs
    const inStaging = staging.some(sq => sq.id !== q.id && sq.text && normalizeText(sq.text) === qNorm);
    if (inStaging) return { isDup: true, type: 'staging' };
    
    return { isDup: false, type: null };
  };

  const missingImageQuestions = staging.filter(q => q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0));
  const missingImageNumbers = Array.from(new Set(missingImageQuestions.map(q => q.questionNumber).filter(Boolean)));

  const hasAnyDuplicate = staging.some(q => checkDuplicate(q).isDup);
  const hasAnyMissingImage = missingImageQuestions.length > 0;

  // Initialize mainTag with first available tag if exists
  useEffect(() => {
    if (availableTags.length > 0) {
      setGlobalMainTag(availableTags[0].name);
    }
  }, [availableTags]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setImages(prev => [...prev, e.target!.result as string]);
            }
          };
          reader.readAsDataURL(file as Blob);
        }
      }
    }
  };

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setDocxParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ arrayBuffer });
          const rawText = result.value;
          
          if (!rawText.trim()) {
            alert('Não foi possível extrair nenhum texto deste arquivo .docx. Verifique se ele contém texto.');
            return;
          }

          const parseDirectly = confirm(
            "Arquivo .docx lido com sucesso!\n\n" +
            "Deseja extrair as questões DIRETAMENTE (Sem usar IA, sem classificar categoria ou gabarito) e colocá-las na fila de edição?\n\n" +
            "Clique em 'OK' para Extrair Diretamente ou 'Cancelar' para carregar o texto na área de edição para usar a extração por IA."
          );

          if (parseDirectly) {
            const parsed = parseQuestionsFromText(rawText, globalMainTag, globalSubtags[0], globalInstitution, globalYear);
            if (parsed.length > 0) {
              setStaging(prev => [...prev, ...parsed]);
              alert(`${parsed.length} questão(ões) extraída(s) com sucesso na fila!`);
            } else {
              alert("Não conseguimos separar as questões automaticamente. O texto foi colado na área de edição.");
              setText(rawText);
            }
          } else {
            setText(rawText);
          }
        } catch (err: any) {
          console.error(err);
          alert('Erro ao converter arquivo Word: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      alert('Erro ao ler arquivo: ' + err.message);
    } finally {
      setDocxParsing(false);
      e.target.value = '';
    }
  };


  const processQuestions = async () => {
    if (!text.trim()) return alert('Insira o texto das questões.');
    setProcessing(true);
    try {
      // Fast path for structured format
      if (text.includes("QUESTÃO:") && text.includes("[ENUNCIADO]") && text.includes("[ALTERNATIVAS]")) {
        const parsed = parseStructuredText(text, usePredefinedTags ? globalMainTag : 'Clínica Médica', usePredefinedTags ? (globalSubtags[0] || '') : '', globalInstitution, globalYear, auth.currentUser?.uid || '');
        if (parsed.length > 0) {
          setStaging(prev => [...prev, ...parsed]);
          setText('');
          setAnswerKeyText('');
          setImages([]);
          setProcessing(false);
          return;
        }
      }

      let data;

      try {
        const res = await apiFetch('/api/extract-bank-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            answerKeyText,
            institution: globalInstitution,
            year: globalYear,
            images,
            predefinedTags: usePredefinedTags ? { usePredefined: true, mainTag: globalMainTag, subtags: globalSubtags } : { usePredefined: false }
          })
        });
        data = await parseJsonResponse(res);
      } catch (err: any) {
        throw new Error(`Processamento falhou: ${err.message}`);
      }
      
      if (data.error) throw new Error(data.error);
      if (data.questions) {
        setStaging(prev => [...prev, ...data.questions]);
        setText('');
        setAnswerKeyText('');
        setImages([]);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao processar');
    } finally {
      setProcessing(false);
    }
  };

  const saveToBank = async () => {
    if (staging.length === 0) return;
    if (hasAnyDuplicate) {
      alert('Por favor, remova as questões duplicadas (em vermelho) antes de salvar.');
      return;
    }
    if (hasAnyMissingImage) {
      const numsStr = missingImageNumbers.length > 0 ? ` (#${missingImageNumbers.join(', #')})` : '';
      alert(`Atenção: A(s) questão(ões)${numsStr} possui(em) aviso de imagem pendente. Por favor, anexe a imagem correspondente em cada questão destacada em vermelho (ou remova a questão) antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      if (onSaveToDatabase) {
        await onSaveToDatabase(staging);
        onAdded();
      } else {
        for (const q of staging) {
          const docData = sanitizeQuestionFields({ ...q });
          delete docData.id;
          docData.createdAt = new Date().toISOString();
          docData.createdBy = auth.currentUser?.uid || 'unknown';
          await addDoc(collection(db, 'questionBank'), docData);
        }
        onAdded();
      }
    } catch (err: any) {
      if (!onSaveToDatabase) {
        handleFirestoreError(err, OperationType.CREATE, 'questionBank');
      } else {
        alert(err.message || 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeStaging = (id: string) => {
    setStaging(staging.filter(s => s.id !== id));
  };

  const updateStaging = (id: string, updates: Partial<BankQuestion>) => {
    setStaging(staging.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addManualQuestion = () => {
    const newId = 'manual_' + Date.now();
    setStaging([{
      id: newId,
      text: '',
      type: 'multiple_choice',
      options: ['A) ', 'B) ', 'C) ', 'D) '],
      correctAnswer: '',
      mainTag: usePredefinedTags ? globalMainTag : 'Clínica Médica',
      subtags: usePredefinedTags ? [...globalSubtags] : [],
      subtag: usePredefinedTags ? (globalSubtags[0] || '') : '',
      institution: globalInstitution,
      year: globalYear
    }, ...staging]);
    setEditingStagingId(newId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onCancel} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" /> Cancelar Adição
        </button>
        <div className="flex items-center gap-3">
          {(hasAnyDuplicate || hasAnyMissingImage) && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              {hasAnyDuplicate 
                ? 'Remova as duplicadas para salvar!' 
                : missingImageNumbers.length > 0
                  ? `Upload de imagem pendente na(s) Questão(ões) #${missingImageNumbers.join(', #')}!`
                  : 'Anexe as imagens pendentes para salvar!'}
            </span>
          )}
          
          {missingImageQuestions.length > 0 && (
            <button
              onClick={() => setIsFastCheckOpen(true)}
              className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm border border-amber-200"
            >
              <Check className="w-4 h-4" /> Checagem Rápida
            </button>
          )}
          <button 
            onClick={saveToBank}
            disabled={saving || staging.length === 0 || hasAnyDuplicate || hasAnyMissingImage}
            className={cn(
              "text-white px-5 py-2 rounded-xl font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-lg",
              (hasAnyDuplicate || hasAnyMissingImage)
                ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
            )}
          >
            {saving ? 'Salvando...' : submitLabel} <Save className="w-4 h-4" />
          </button>
        </div>
      </div>


      <AnimatePresence>
        {isFastCheckOpen && (
          <FastCheckModal 
            missingImageQuestions={missingImageQuestions}
            onUpdateStaging={updateStaging}
            onClose={() => setIsFastCheckOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        
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
          onQuestionsExtracted={(extractedQuestions) => {
            setStaging(prev => [...prev, ...extractedQuestions.map(q => sanitizeQuestionFields(q))]);
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
  <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Enunciado(s) e Alternativas (Cole imagens também)</label>
          <textarea 
            value={text} 
            onChange={e => setText(e.target.value)} 
            onPaste={handlePaste}
            placeholder="Cole as questões aqui para processamento com IA ou utilize o upload de .docx acima..." 
            className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none font-medium resize-none focus:ring-2 focus:ring-indigo-600/20" 
          />
        </div>
        
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 rounded-lg">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 shrink-0 rounded-lg border border-slate-200 overflow-hidden group">
                <img src={img} alt="Pasted" className="w-full h-full object-cover" />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Gabarito (Ex: 1-A, 2-B, 3-C)</label>
          <textarea 
            value={answerKeyText} 
            onChange={e => setAnswerKeyText(e.target.value)} 
            placeholder="Cole o gabarito aqui para a extração com IA..." 
            className="w-full h-16 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none font-medium resize-none focus:ring-2 focus:ring-indigo-600/20" 
          />
        </div>

        <button 
          onClick={processQuestions}
          disabled={processing || !text.trim()}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing ? 'Analisando e Extraindo...' : 'Extrair Questões'} <Brain className="w-4 h-4" />
        </button>
        <button 
          onClick={addManualQuestion}
          className="w-full bg-white text-slate-700 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2"
        >
          Adicionar à Fila Manualmente <Plus className="w-4 h-4" />
        </button>
          </div>
        )}
      
      </div>

      {staging.length > 0 && !isFastCheckOpen && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Questões na Fila de Adição ({staging.length})</h3>
            
            {staging.some(s => checkQuestionFormatting(s).hasIssue) && (
              <button
                onClick={() => {
                  setStaging(prev => prev.map(item => sanitizeQuestionFields(item)));
                }}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-700" />
                Corrigir Formatação de Toda a Fila
              </button>
            )}
          </div>

          {(() => {
            const flaggedStagingQuestions = staging.filter(s => {
              const fmt = checkQuestionFormatting(s);
              const missingImg = s.hasImageWarning && !s.ignoreImageWarning && (!s.images || s.images.length === 0);
              return fmt.hasIssue || missingImg;
            });

            const scrollToQuestion = (qId: string) => {
              const el = document.getElementById(`q-card-${qId}`) || document.getElementById(`staging-q-${qId}`) || document.getElementById(`bank-q-${qId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-amber-400', 'ring-offset-2');
                setTimeout(() => {
                  el.classList.remove('ring-4', 'ring-amber-400', 'ring-offset-2');
                }, 3000);
              }
            };

            return (
              <>
                {flaggedStagingQuestions.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-extrabold text-xs text-amber-900">⚠️ Questões com Alerta na Fila ({flaggedStagingQuestions.length})</div>
                          <div className="text-xs font-medium text-amber-800">
                            Identificamos questões com alertas de formatação, ano no início, referência a imagem ou falta de alternativas.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setStaging(prev => prev.map(item => sanitizeQuestionFields(item)));
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition shadow-sm shrink-0 flex items-center gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Corrigir Todas
                      </button>
                    </div>

                    {/* Quick navigation buttons to flagged questions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-200/70">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider mr-1">Ir diretamente para:</span>
                      {flaggedStagingQuestions.map((qItem, idx) => {
                        const qNum = qItem.questionNumber ? `#${qItem.questionNumber}` : `Q${idx + 1}`;
                        const fmt = checkQuestionFormatting(qItem);
                        let badgeLabel = qNum;
                        if (fmt.hasMissingOptions) badgeLabel += ' (sem alt.)';
                        else if (fmt.hasMissingImageWarning) badgeLabel += ' (imagem)';
                        else if (fmt.hasYearStartIssue) badgeLabel += ' (ano)';

                        return (
                          <button
                            key={qItem.id}
                            onClick={() => scrollToQuestion(qItem.id!)}
                            className="bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-amber-300/80 flex items-center gap-1 transition shadow-xs"
                          >
                            <Compass className="w-3 h-3 text-amber-700" />
                            {badgeLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {staging.map(q => {
                  const { isDup, type: dupType } = checkDuplicate(q);
                  const hasMissingImage = q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0);
                  const formatIssue = checkQuestionFormatting(q);
                  
                  if (editingStagingId === q.id) {
                    return (
                      <QuestionEditor
                        key={q.id}
                        question={q}
                        availableTags={availableTags}
                        onCancel={() => setEditingStagingId(null)}
                        onSave={(updatedQ) => {
                          updateStaging(q.id!, updatedQ);
                          setEditingStagingId(null);
                        }}
                      />
                    );
                  }
                  return (
                    <div 
                      key={q.id} 
                      id={`staging-q-${q.id}`}
                      className={cn(
                        "p-5 rounded-2xl border shadow-sm relative group animate-fade-in transition-all duration-300 space-y-3",
                        (isDup || hasMissingImage) 
                          ? "border-rose-300 bg-rose-50/40" 
                          : formatIssue.hasIssue
                          ? "border-amber-300 bg-amber-50/20"
                          : "border-indigo-100 bg-white"
                      )}
                    >
                      {formatIssue.hasIssue && !isDup && !hasMissingImage && (
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-900 bg-amber-50/90 border border-amber-200 p-3 rounded-xl">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              <div className="font-extrabold text-amber-900">⚠️ Alerta na Questão</div>
                              <div className="font-medium text-amber-800 text-[11px]">{formatIssue.details.join(' • ')}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const sanitized = sanitizeQuestionFields(q);
                              const validOpts = Array.isArray(sanitized.options) ? sanitized.options.filter((o: any) => String(o).replace(/^[a-eA-E][\)\.\-\s]+/, '').trim().length > 0) : [];
                              if (validOpts.length < 2 && (q.type || 'multiple_choice') === 'multiple_choice') {
                                if (!sanitized.options || sanitized.options.length < 4) {
                                  sanitized.options = ['A) ', 'B) ', 'C) ', 'D) '];
                                }
                                updateStaging(q.id!, sanitized);
                                setEditingStagingId(q.id!);
                              } else {
                                updateStaging(q.id!, sanitized);
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition shadow-sm shrink-0 flex items-center gap-1"
                          >
                            <Wand2 className="w-3 h-3" />
                            Corrigir Questão
                          </button>
                        </div>
                      )}
                {isDup && (
                  <div className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-100/60 border border-rose-200 p-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-0.5">
                      <div>
                        {dupType === 'db' 
                          ? 'Esta questão já está registrada no Banco de Questões!' 
                          : 'Esta questão possui uma duplicata na sua fila de adição atual!'}
                      </div>
                      <div className="font-medium text-rose-600/80">
                        Não é permitido salvar duplicadas. Por favor, remova ou edite esta questão para prosseguir.
                      </div>
                    </div>
                  </div>
                )}
                
                {hasMissingImage && !isDup && (
                  <div className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-100/60 border border-rose-200 p-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-rose-800 font-extrabold flex items-center gap-1.5">
                        <span>⚠️ Upload manual de imagem obrigatório</span>
                        {q.questionNumber && (
                          <span className="bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded text-[11px] font-black">
                            Questão #{q.questionNumber}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-rose-700">
                        Esta questão contém ou faz referência a uma imagem. Clique no ícone de edição (lápis) para anexar a imagem e liberar a gravação no banco.
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mb-1 items-center">
                  <span className={cn(
                    "text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-md",
                    (isDup || hasMissingImage) ? "bg-rose-100 text-rose-800" : "bg-indigo-50 text-indigo-700"
                  )}>
                    {q.mainTag}
                  </span>
                  {q.subtag && !q.subtags?.length && (
                    <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                      {q.subtag}
                    </span>
                  )}
                  {q.subtags && q.subtags.map((sub, idx) => (
                    <span key={idx} className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                      {sub}
                    </span>
                  ))}
                  {(q.institution || q.year) && (
                    <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md">
                      {q.institution} {q.year}
                    </span>
                  )}
                  
                  <div className="flex-1" />

                  {/* Inline Optional Subtags Input */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Subárea(s) (Opcional):</span>
                    <input
                      type="text"
                      placeholder="Ex: Neurologia, AVC"
                      value={q.subtags?.join(', ') || q.subtag || ''}
                      onChange={e => {
                        const val = e.target.value;
                        updateStaging(q.id!, {
                          subtag: val.split(',')[0]?.trim() || '',
                          subtags: val.split(',').map(s => s.trim()).filter(Boolean)
                        });
                      }}
                      className="bg-transparent text-slate-700 text-xs font-bold focus:outline-none w-40 sm:w-48 uppercase tracking-wider"
                      list={`subtags-datalist-staging-${q.id}`}
                    />
                    <datalist id={`subtags-datalist-staging-${q.id}`}>
                      {availableTags.find(t => t.name === q.mainTag)?.subtags.map(sub => (
                        <option key={sub} value={sub} />
                      ))}
                    </datalist>
                  </div>

                  <button onClick={() => setEditingStagingId(q.id!)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded ms-1" title="Editar"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => removeStaging(q.id!)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="text-sm text-slate-700 font-medium mb-1 whitespace-pre-wrap">{q.text}</div>
                {q.images && q.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto my-2 p-2 bg-slate-50/50 rounded-lg">
                    {q.images.map((img, i) => (
                      <div key={i} className="relative w-24 h-24 shrink-0 rounded-lg border border-slate-200 overflow-hidden">
                        <img src={img} alt="Imagem" className="w-full h-full object-contain bg-white" />
                      </div>
                    ))}
                  </div>
                )}
                {q.options && q.options.length > 0 && (
                  <div className="space-y-1">
                    {q.options.map((opt, i) => (
                      <div key={i} className="p-1.5 rounded text-xs text-slate-600 bg-slate-50/70 border border-slate-200">
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.correctAnswer && (
                  <div className="text-xs font-bold text-slate-500 bg-slate-50/70 px-2.5 py-1.5 rounded-lg inline-block border border-slate-100">
                    Gabarito: {q.correctAnswer}
                  </div>
                )}
              </div>
            );
          })}
        </>
      );
    })()}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ 
  question, 
  onSave, 
  onCancel,
  availableTags
}: { 
  key?: any,
  question: BankQuestion, 
  onSave: (q: BankQuestion) => void, 
  onCancel: () => void,
  availableTags: { id: string, name: string, subtags: string[] }[]
}) {
  const [q, setQ] = useState<BankQuestion>({ ...question });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImageClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const items = await navigator.clipboard.read();
      let imageFound = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                setQ(prev => ({
                  ...prev,
                  images: [...(prev.images || []), ev.target!.result as string]
                }));
              }
            };
            reader.readAsDataURL(blob as Blob);
            imageFound = true;
            break;
          }
        }
        if (imageFound) break;
      }
      if (!imageFound) {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.warn("Clipboard read failed, opening file picker", err);
      fileInputRef.current?.click();
    }
  };

  // Safety fallback for options if they are undefined
  useEffect(() => {
    if (!q.options) {
      setQ(prev => ({ ...prev, options: [] }));
    }
  }, [q.options]);

  const mainTagExists = availableTags.some(t => t.name === q.mainTag);

  return (
    <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Área Médica</label>
          <select 
            value={q.mainTag} 
            onChange={e => {
              const val = e.target.value;
              const tagObj = availableTags.find(t => t.name === val);
              setQ({ 
                ...q, 
                mainTag: val, 
                subtag: tagObj && tagObj.subtags.length > 0 ? tagObj.subtags[0] : '' 
              });
            }} 
            className="w-full bg-indigo-50 text-indigo-700 rounded-lg p-2.5 outline-none font-bold text-xs uppercase tracking-wider"
          >
            {availableTags.map(tag => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
            {!mainTagExists && q.mainTag && <option value={q.mainTag}>{q.mainTag}</option>}
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Subárea(s) (separadas por vírgula)</label>
          <input 
            type="text" 
            placeholder="Ex: Neurologia, AVC, AVCi" 
            value={q.subtags?.join(', ') || q.subtag || ''} 
            onChange={e => setQ({ ...q, subtag: e.target.value.split(',')[0].trim(), subtags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
            className="w-full bg-slate-100 text-slate-600 rounded-lg p-2.5 outline-none font-bold text-xs uppercase tracking-wider" 
            list={`subtags-datalist-${q.id}`}
          />
          <datalist id={`subtags-datalist-${q.id}`}>
            {availableTags.find(t => t.name === q.mainTag)?.subtags.map(sub => (
              <option key={sub} value={sub} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Banca / Instituição</label>
          <input type="text" placeholder="Instituição" value={q.institution || ''} onChange={e => setQ({ ...q, institution: e.target.value })} className="w-full bg-amber-50/50 text-amber-900 font-medium text-xs rounded-lg p-2.5 outline-none" />
        </div>
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Ano</label>
          <input type="text" placeholder="Ano" value={q.year || ''} onChange={e => setQ({ ...q, year: e.target.value })} className="w-full bg-amber-50/50 text-amber-900 font-medium text-xs rounded-lg p-2.5 outline-none" />
        </div>
      </div>
      
      <div className="space-y-1">
        <label className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Enunciado da Questão</label>
        <textarea value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-medium text-sm resize-none focus:ring-2 focus:ring-indigo-600/20" placeholder="Enunciado" />
      </div>

      {q.hasImageWarning && !q.ignoreImageWarning && (!q.images || q.images.length === 0) && (
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
      )}

      <div className="space-y-2">
         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
           <span>Imagens da Questão</span>
           <button
             type="button"
             onClick={handleAddImageClick}
             className="text-[9px] lowercase font-medium text-indigo-500 cursor-pointer hover:underline flex items-center gap-1 bg-transparent border-none p-0 focus:outline-none"
           >
             <UploadCloud className="w-3 h-3" /> Adicionar Imagem
           </button>
           <input
             type="file"
             ref={fileInputRef}
             accept="image/*"
             multiple
             className="hidden"
             onChange={e => {
                const files = e.target.files;
                if (!files) return;
                Array.from(files).forEach(file => {
                   const reader = new FileReader();
                   reader.onload = (ev) => {
                      if (ev.target?.result) {
                         setQ(prev => ({ ...prev, images: [...(prev.images || []), ev.target!.result as string] }));
                      }
                   };
                   reader.readAsDataURL(file as Blob);
                });
                e.target.value = '';
             }}
           />
         </label>

           <textarea 
             placeholder="Ou clique aqui e pressione Ctrl+V para colar uma imagem"
             onPaste={(e) => {
                 e.preventDefault();
                 const items = e.clipboardData?.items;
                 if (items) {
                     for (let i = 0; i < items.length; i++) {
                         if (items[i].type.indexOf('image') !== -1) {
                             const blob = items[i].getAsFile();
                             if (blob) {
                                 const reader = new FileReader();
                                 reader.onload = (ev) => {
                                     if (ev.target?.result) {
                                         setQ(prev => ({ ...prev, images: [...(prev.images || []), ev.target.result as string] }));
                                     }
                                 };
                                 reader.readAsDataURL(blob);
                             }
                         }
                     }
                 }
             }}
             className="w-full h-12 mt-2 bg-slate-50 border border-slate-200 border-dashed rounded-lg p-3 text-xs text-slate-500 font-medium resize-none focus:outline-none focus:border-indigo-500 flex items-center justify-center"
           />
         {q.images && q.images.length > 0 && (
           <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 rounded-lg">
             {q.images.map((img, i) => (
               <div key={i} className="relative w-20 h-20 shrink-0 rounded-lg border border-slate-200 overflow-hidden group">
                 <img src={img} alt="Imagem" className="w-full h-full object-cover" />
                 <button type="button" onClick={() => setQ(prev => ({ ...prev, images: prev.images!.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
               </div>
             ))}
           </div>
         )}
      </div>

      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo de Questão</label>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => setQ({ ...q, type: 'multiple_choice', options: q.options && q.options.length > 0 ? q.options : ['A) ', 'B) ', 'C) ', 'D) '] })}
              className={cn("px-3 py-1 rounded-lg text-xs font-bold transition", q.type === 'multiple_choice' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
            >
              Múltipla Escolha
            </button>
            <button 
              type="button" 
              onClick={() => setQ({ ...q, type: 'discursive', options: [] })}
              className={cn("px-3 py-1 rounded-lg text-xs font-bold transition", q.type === 'discursive' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
            >
              Discursiva
            </button>
          </div>
        </div>
      </div>

      {q.type === 'multiple_choice' && (
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
            <span>Alternativas</span>
            <span className="text-[9px] lowercase font-medium text-slate-400">(Marque o rádio para selecionar a resposta correta)</span>
          </label>
          {q.options?.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input 
                type="radio" 
                name={`correct-${q.id}`} 
                checked={q.correctAnswer === opt && opt !== ''} 
                onChange={() => setQ({ ...q, correctAnswer: opt })} 
                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
              />
              <input 
                type="text" 
                value={opt} 
                onChange={e => {
                  const newOptions = [...(q.options || [])];
                  newOptions[i] = e.target.value;
                  // If this option was correct, update correctAnswer as well
                  const wasCorrect = q.correctAnswer === opt;
                  setQ({ 
                    ...q, 
                    options: newOptions,
                    correctAnswer: wasCorrect ? e.target.value : q.correctAnswer 
                  });
                }} 
                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none font-medium text-slate-700 focus:border-indigo-500" 
              />
              <button 
                type="button"
                onClick={() => {
                  const newOptions = q.options?.filter((_, idx) => idx !== i);
                  setQ({ ...q, options: newOptions });
                }} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button 
            type="button"
            onClick={() => {
              const letter = String.fromCharCode(65 + (q.options?.length || 0)); // A, B, C, D...
              setQ({ ...q, options: [...(q.options || []), `${letter}) `] });
            }} 
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
          >
            <Plus className="w-3 h-3" /> Adicionar Alternativa
          </button>
        </div>
      )}

      {q.type === 'multiple_choice' && (
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Gabarito Direto (Texto)</label>
          <input 
            type="text" 
            placeholder="Ex: A, B ou o texto exato da resposta" 
            value={q.correctAnswer} 
            onChange={e => setQ({ ...q, correctAnswer: e.target.value })} 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none font-medium" 
          />
        </div>
      )}

      {q.type === 'discursive' && (
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Gabarito Esperado</label>
          <textarea value={q.correctAnswer} onChange={e => setQ({ ...q, correctAnswer: e.target.value })} className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-medium text-sm resize-none" />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
        <button onClick={() => onSave(q)} className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
      </div>
    </div>
  );
}

function TagManagerView({ 
  availableTags, 
  onClose 
}: { 
  availableTags: { id: string, name: string, subtags: string[] }[], 
  onClose: () => void 
}) {
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  
  const [newSubtagName, setNewSubtagName] = useState('');
  const [activeTagForSubtags, setActiveTagForSubtags] = useState<string | null>(null);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'bankTags'), {
        name: newTagName.trim(),
        subtags: []
      });
      const updated = [...availableTags, { id: docRef.id, name: newTagName.trim(), subtags: [] }].sort((a, b) => a.name.localeCompare(b.name));
      setCachedBankTags(updated);
      setNewTagName('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'bankTags');
    }
  };

  const handleRenameTag = async (id: string) => {
    if (!editingTagName.trim()) return;
    try {
      await updateDoc(doc(db, 'bankTags', id), {
        name: editingTagName.trim()
      });
      const updated = availableTags.map(t => t.id === id ? { ...t, name: editingTagName.trim() } : t).sort((a, b) => a.name.localeCompare(b.name));
      setCachedBankTags(updated);
      setEditingTagId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `bankTags/${id}`);
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir a área "${name}"? Isso não apagará as questões do banco, mas removerá a tag de seleção.`)) {
      try {
        await deleteDoc(doc(db, 'bankTags', id));
        const updated = availableTags.filter(t => t.id !== id);
        setCachedBankTags(updated);
        if (activeTagForSubtags === id) setActiveTagForSubtags(null);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `bankTags/${id}`);
      }
    }
  };

  const handleAddSubtag = async (tagId: string) => {
    if (!newSubtagName.trim()) return;
    const tag = availableTags.find(t => t.id === tagId);
    if (!tag) return;
    if (tag.subtags.includes(newSubtagName.trim())) {
      alert('Esta subtag já existe nesta área!');
      return;
    }
    try {
      const newSubtags = [...tag.subtags, newSubtagName.trim()];
      await updateDoc(doc(db, 'bankTags', tagId), {
        subtags: newSubtags
      });
      const updated = availableTags.map(t => t.id === tagId ? { ...t, subtags: newSubtags } : t);
      setCachedBankTags(updated);
      setNewSubtagName('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `bankTags/${tagId}`);
    }
  };

  const handleDeleteSubtag = async (tagId: string, subtagToDelete: string) => {
    const tag = availableTags.find(t => t.id === tagId);
    if (!tag) return;
    try {
      const newSubtags = tag.subtags.filter(s => s !== subtagToDelete);
      await updateDoc(doc(db, 'bankTags', tagId), {
        subtags: newSubtags
      });
      const updated = availableTags.map(t => t.id === tagId ? { ...t, subtags: newSubtags } : t);
      setCachedBankTags(updated);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `bankTags/${tagId}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Gerenciar Áreas e Subtags</h2>
          <p className="text-xs text-slate-500 font-medium">Crie, edite e exclua as áreas médicas e suas especialidades.</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Tags (Areas) */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Áreas de Questões (Tags Principais)</h3>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nova Área (ex: Medicina Preventiva)" 
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-medium text-sm focus:ring-2 focus:ring-indigo-600/20"
            />
            <button 
              onClick={handleAddTag}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shrink-0"
            >
              Adicionar
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {availableTags.map(tag => (
              <div 
                key={tag.id} 
                onClick={() => setActiveTagForSubtags(tag.id)}
                className={cn(
                  "p-3 rounded-xl border transition cursor-pointer flex items-center justify-between",
                  activeTagForSubtags === tag.id 
                    ? "border-indigo-600 bg-indigo-50/50" 
                    : "border-slate-200 hover:bg-slate-50"
                )}
              >
                {editingTagId === tag.id ? (
                  <div className="flex items-center gap-2 flex-1 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <input 
                      type="text" 
                      value={editingTagName} 
                      onChange={e => setEditingTagName(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-sm outline-none font-medium"
                    />
                    <button onClick={() => handleRenameTag(tag.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingTagId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-slate-700 text-sm">{tag.name}</span>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }} 
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Renomear"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTag(tag.id, tag.name)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Subtags */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest font-bold">
            {activeTagForSubtags 
              ? `Subtags para "${availableTags.find(t => t.id === activeTagForSubtags)?.name}"` 
              : "Selecione uma área para gerenciar subtags"}
          </h3>

          {activeTagForSubtags ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nova Subtag (ex: Hepatologia)" 
                  value={newSubtagName}
                  onChange={e => setNewSubtagName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-medium text-sm focus:ring-2 focus:ring-indigo-600/20"
                />
                <button 
                  onClick={() => handleAddSubtag(activeTagForSubtags)}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shrink-0"
                >
                  Adicionar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto">
                {availableTags.find(t => t.id === activeTagForSubtags)?.subtags.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold py-4">Nenhuma subtag cadastrada nesta área ainda.</p>
                ) : (
                  availableTags.find(t => t.id === activeTagForSubtags)?.subtags.map(sub => (
                    <span 
                      key={sub} 
                      className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
                    >
                      {sub}
                      <button 
                        onClick={() => handleDeleteSubtag(activeTagForSubtags, sub)}
                        className="text-slate-400 hover:text-red-600 transition"
                        title="Excluir"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-medium">
              Clique em uma área médica da lista ao lado para ver, adicionar, renomear ou remover suas especialidades.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
