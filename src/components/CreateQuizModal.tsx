import React, { useState, useEffect } from 'react';
import { Search, Folder, Palette, FolderPlus, Loader2, Filter, X, Check } from 'lucide-react';
import { supabase, toValidUUID } from '../lib/supabase';
import { updateFolderColorsInSupabase } from '../lib/supabaseUser';

export function CreateQuizModal({ 
  isOpen, 
  onClose, 
  questions = [], 
  userFolders = {}, 
  uniqueMainTags = [], 
  uniqueSubtags = [], 
  uniqueInstitutions = [], 
  uniqueYears = [], 
  auth, 
  db 
}: any) {
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizColor, setNewQuizColor] = useState('bg-indigo-500');
  const [selectedFolderOption, setSelectedFolderOption] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [modalFilters, setModalFilters] = useState<{mainTags: string[], subtags: string[], institutions: string[], years: string[]}>({ mainTags: [], subtags: [], institutions: [], years: [] });
  const [searchMainTags, setSearchMainTags] = useState('');
  const [searchSubtags, setSearchSubtags] = useState('');
  const [searchInstitutions, setSearchInstitutions] = useState('');
  const [searchYears, setSearchYears] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loadedQuestions, setLoadedQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Always ensure all bank questions are fetched when the modal opens
  useEffect(() => {
    if (isOpen) {
      if (loadedQuestions.length === 0 && questions.length <= 40) {
        setIsLoadingQuestions(true);
        (async () => {
          try {
            const { data, error } = await supabase.from('question_bank').select('*').limit(10000);
            if (!error && data && data.length > 0) {
              const list = data.map((d: any) => ({
                id: d.id,
                ...d,
                mainTag: d.main_tag || d.mainTag,
                subtags: d.subtags || (d.subtag ? [d.subtag] : []),
                correctAnswer: d.correct_answer !== undefined ? d.correct_answer : d.correctAnswer
              }));
              setLoadedQuestions(list);
              setIsLoadingQuestions(false);
              return;
            }
          } catch (supaErr) {
            console.warn("Supabase question bank load for modal fallback:", supaErr);
          }
          
          setIsLoadingQuestions(false);
        })();
      }
    }
  }, [isOpen, db, questions.length, loadedQuestions.length]);

  const handleToggleFilter = (type: 'mainTags' | 'subtags' | 'institutions' | 'years', value: string) => {
    setFormError(null);
    setModalFilters(prev => {
      const current = prev[type];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const handleClearFilters = () => {
    setModalFilters({ mainTags: [], subtags: [], institutions: [], years: [] });
    setSearchMainTags('');
    setSearchSubtags('');
    setSearchInstitutions('');
    setSearchYears('');
  };

  if (!isOpen) return null;

  const poolOfQuestions = loadedQuestions.length > 0 ? loadedQuestions : (questions || []);

  // Compute all available tags dynamically from all pool questions + props
  const computedMainTags = Array.from(new Set([
    ...(uniqueMainTags || []),
    ...poolOfQuestions.map((q: any) => q.mainTag)
  ])).filter((t): t is string => typeof t === 'string' && t.trim() !== '').sort();

  const computedSubtags = Array.from(new Set([
    ...(uniqueSubtags || []),
    ...poolOfQuestions.flatMap((q: any) => {
      if (Array.isArray(q.subtags)) return q.subtags;
      if (typeof q.subtags === 'string') return [q.subtags];
      if (q.subtag) return [q.subtag];
      return [];
    })
  ])).filter((t): t is string => typeof t === 'string' && t.trim() !== '').sort();

  const computedInstitutions = Array.from(new Set([
    ...(uniqueInstitutions || []),
    ...poolOfQuestions.map((q: any) => q.institution)
  ])).filter((t): t is string => typeof t === 'string' && t.trim() !== '').sort();

  const computedYears = Array.from(new Set([
    ...(uniqueYears || []),
    ...poolOfQuestions.map((q: any) => String(q.year || ''))
  ])).filter((t): t is string => typeof t === 'string' && t.trim() !== '').sort((a, b) => Number(b) - Number(a));

  const filteredQuestions = poolOfQuestions.filter((q: any) => {
    if (modalFilters.mainTags.length > 0 && !modalFilters.mainTags.includes(q.mainTag)) return false;
    
    if (modalFilters.subtags.length > 0) {
      const qSubtags = Array.isArray(q.subtags) ? q.subtags : 
                       (typeof q.subtags === 'string' ? [q.subtags] : 
                       (q.subtag ? [q.subtag] : []));
      const match = qSubtags.some((s: string) => modalFilters.subtags.includes(s));
      if (!match) return false;
    }
    
    if (modalFilters.institutions.length > 0 && !modalFilters.institutions.includes(q.institution || '')) return false;
    if (modalFilters.years.length > 0 && !modalFilters.years.includes(String(q.year || ''))) return false;
    return true;
  });

  const hasActiveFilters = modalFilters.mainTags.length > 0 || 
                           modalFilters.subtags.length > 0 || 
                           modalFilters.institutions.length > 0 || 
                           modalFilters.years.length > 0;

  const handleCreate = async () => {
    setFormError(null);
    if (!newQuizTitle.trim()) {
      setFormError('Preencha o nome do caderno.');
      return;
    }
    if (filteredQuestions.length === 0) {
      setFormError('Nenhuma questão selecionada com esses filtros.');
      return;
    }
    if (!auth.currentUser) {
      setFormError('Você precisa estar autenticado para criar um caderno.');
      return;
    }

    let finalFolder = '';
    if (selectedFolderOption === '__NEW_FOLDER__') {
      if (!newFolderName.trim()) {
        setFormError('Por favor, digite o nome da nova pasta ou selecione "Sem Pasta".');
        return;
      }
      finalFolder = newFolderName.trim();
    } else {
      finalFolder = selectedFolderOption.trim();
    }

    try {
      setIsSubmitting(true);

      const quizQuestions = filteredQuestions.map((q: any) => {
        const item: any = {
          id: Math.random().toString(36).substring(2, 10),
          type: q.type || 'multiple_choice',
          text: q.text || '',
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || '',
          category: q.mainTag || ''
        };
        const imgs = q.images || (q.image ? [q.image] : []);
        if (imgs && imgs.length > 0) {
          item.images = imgs;
        }
        return item;
      });

      const uniqueId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const qData: any = {
        id: uniqueId,
        title: newQuizTitle.trim(),
        questions: quizQuestions,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };

      if (finalFolder) {
        qData.tag = finalFolder;
      }
      if (modalFilters.mainTags.length > 0) {
        qData.mainTag = modalFilters.mainTags[0];
      }
      if (modalFilters.subtags.length > 0) {
        qData.subtags = modalFilters.subtags;
      }

      // 1. Insert into Supabase
      try {
        await supabase.from('quizzes').insert({
          id: toValidUUID(uniqueId),
          user_id: auth.currentUser.uid,
          title: qData.title,
          discipline: qData.mainTag || finalFolder || 'Geral',
          theme: finalFolder || qData.mainTag || 'Geral',
          tags: qData.subtags || [],
          questions: quizQuestions,
          is_public: false,
          author_name: auth.currentUser.displayName || 'Estudante',
          author_photo: auth.currentUser.photoURL || '',
          created_at: qData.createdAt
        });
      } catch (supaErr) {
        console.warn("Supabase insert quiz error:", supaErr);
      }

      
      
      if (finalFolder) {
        try {
          const { data: supaUser } = await supabase.from('users').select('folder_colors').eq('id', auth.currentUser.uid).maybeSingle();
          const currentColors = supaUser?.folder_colors || {};
          const newColors = { ...currentColors, [finalFolder]: newQuizColor };
          await updateFolderColorsInSupabase(auth.currentUser.uid, newColors);
        } catch (colorErr) {
          console.warn("Could not save folder color to user profile:", colorErr);
        }
      }

      setIsSubmitting(false);
      const createdTitle = newQuizTitle.trim();
      const createdCount = quizQuestions.length;
      setNewQuizTitle('');
      setSelectedFolderOption('');
      setNewFolderName('');
      setModalFilters({ mainTags: [], subtags: [], institutions: [], years: [] });
      onClose();
      
      // Dispatch event to inform other components and trigger top/bottom toast notification
      window.dispatchEvent(new CustomEvent('quiz_created', {
        detail: {
          title: createdTitle,
          count: createdCount
        }
      }));
    } catch (e: any) {
      setIsSubmitting(false);
      console.error("Error creating quiz:", e);
      setFormError(`Erro ao criar caderno: ${e?.message || 'Falha de comunicação'}`);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90dvh] rounded-2xl p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-900">Criar Caderno de Questões</h2>
            {isLoadingQuestions && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando banco de questões...
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold flex items-center justify-between">
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">✕</button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <div className="space-y-6">
            {/* INFORMAÇÕES DO CADERNO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Detalhes do Caderno</h3>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome do Caderno</label>
                <input 
                  type="text" 
                  value={newQuizTitle}
                  onChange={e => setNewQuizTitle(e.target.value)}
                  placeholder="Ex: Revisão Geral R1 2026"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-sm focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pasta (Opcional)</label>
                <select 
                  value={selectedFolderOption}
                  onChange={e => setSelectedFolderOption(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-sm focus:border-indigo-500"
                >
                  <option value="">Sem Pasta</option>
                  {Object.keys(userFolders || {}).map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                  <option value="__NEW_FOLDER__">+ Criar Nova Pasta...</option>
                </select>

                {selectedFolderOption === '__NEW_FOLDER__' && (
                  <div className="pt-2">
                    <label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1 mb-1">
                      <FolderPlus className="w-3.5 h-3.5" /> Nome da Nova Pasta
                    </label>
                    <input 
                      type="text"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      placeholder="Ex: Cardiologia, Prova R1, Pediatria..."
                      autoFocus
                      className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg p-2.5 outline-none font-medium text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1"><Palette className="w-3 h-3"/> Cor da Capa</label>
                <div className="flex flex-wrap gap-2">
                  {['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500', 'bg-pink-500'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewQuizColor(color)}
                      className={`w-8 h-8 rounded-full ${color} transition-transform hover:scale-110 ${newQuizColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* FILTROS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Selecionar Questões do Banco ({poolOfQuestions.length} disponíveis)
                </h3>
                {hasActiveFilters && (
                  <button 
                    onClick={handleClearFilters}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Grandes Áreas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Grandes Áreas</label>
                    {modalFilters.mainTags.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 rounded">
                        {modalFilters.mainTags.length}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar área..."
                      value={searchMainTags}
                      onChange={e => setSearchMainTags(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {computedMainTags.filter((t: string) => t.toLowerCase().includes(searchMainTags.toLowerCase())).map((tag: string, i: number) => {
                      const countInPool = poolOfQuestions.filter((q: any) => q.mainTag === tag).length;
                      return (
                        <label key={i} className="flex items-center justify-between text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                          <span className="flex items-center gap-2 truncate">
                            <input 
                              type="checkbox" 
                              checked={modalFilters.mainTags.includes(tag)}
                              onChange={() => handleToggleFilter('mainTags', tag)}
                              className="text-indigo-600 rounded border-slate-300"
                            />
                            <span className="truncate">{tag}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">({countInPool})</span>
                        </label>
                      );
                    })}
                    {computedMainTags.length === 0 && (
                      <p className="text-xs text-slate-400 p-2 text-center">Nenhuma área encontrada</p>
                    )}
                  </div>
                </div>

                {/* Assuntos (Subtags) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Assuntos</label>
                    {modalFilters.subtags.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 rounded">
                        {modalFilters.subtags.length}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar assunto..."
                      value={searchSubtags}
                      onChange={e => setSearchSubtags(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {computedSubtags.filter((t: string) => t.toLowerCase().includes(searchSubtags.toLowerCase())).map((tag: string, i: number) => {
                      const countInPool = poolOfQuestions.filter((q: any) => {
                        const qSubtags = Array.isArray(q.subtags) ? q.subtags : 
                                         (typeof q.subtags === 'string' ? [q.subtags] : 
                                         (q.subtag ? [q.subtag] : []));
                        return qSubtags.includes(tag);
                      }).length;
                      return (
                        <label key={i} className="flex items-center justify-between text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                          <span className="flex items-center gap-2 truncate">
                            <input 
                              type="checkbox" 
                              checked={modalFilters.subtags.includes(tag)}
                              onChange={() => handleToggleFilter('subtags', tag)}
                              className="text-indigo-600 rounded border-slate-300"
                            />
                            <span className="truncate">{tag}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">({countInPool})</span>
                        </label>
                      );
                    })}
                    {computedSubtags.length === 0 && (
                      <p className="text-xs text-slate-400 p-2 text-center">Nenhum assunto encontrado</p>
                    )}
                  </div>
                </div>

                {/* Bancas (Instituições) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bancas</label>
                    {modalFilters.institutions.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 rounded">
                        {modalFilters.institutions.length}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar banca..."
                      value={searchInstitutions}
                      onChange={e => setSearchInstitutions(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {computedInstitutions.filter((inst: string) => inst.toLowerCase().includes(searchInstitutions.toLowerCase())).map((inst: string, i: number) => {
                      const countInPool = poolOfQuestions.filter((q: any) => q.institution === inst).length;
                      return (
                        <label key={i} className="flex items-center justify-between text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                          <span className="flex items-center gap-2 truncate">
                            <input 
                              type="checkbox" 
                              checked={modalFilters.institutions.includes(inst)}
                              onChange={() => handleToggleFilter('institutions', inst)}
                              className="text-indigo-600 rounded border-slate-300"
                            />
                            <span className="truncate">{inst}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">({countInPool})</span>
                        </label>
                      );
                    })}
                    {computedInstitutions.length === 0 && (
                      <p className="text-xs text-slate-400 p-2 text-center">Nenhuma banca encontrada</p>
                    )}
                  </div>
                </div>
                
                {/* Anos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Anos</label>
                    {modalFilters.years.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 rounded">
                        {modalFilters.years.length}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar ano..."
                      value={searchYears}
                      onChange={e => setSearchYears(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {computedYears.filter((yr: string) => String(yr).toLowerCase().includes(searchYears.toLowerCase())).map((yr: string, i: number) => {
                      const countInPool = poolOfQuestions.filter((q: any) => String(q.year || '') === String(yr)).length;
                      return (
                        <label key={i} className="flex items-center justify-between text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition">
                          <span className="flex items-center gap-2 truncate">
                            <input 
                              type="checkbox" 
                              checked={modalFilters.years.includes(String(yr))}
                              onChange={() => handleToggleFilter('years', String(yr))}
                              className="text-indigo-600 rounded border-slate-300"
                            />
                            <span className="truncate">{yr}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">({countInPool})</span>
                        </label>
                      );
                    })}
                    {computedYears.length === 0 && (
                      <p className="text-xs text-slate-400 p-2 text-center">Nenhum ano encontrado</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* FOOTER */}
        <div className="pt-6 mt-auto border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span className="text-indigo-600 font-extrabold text-base">{filteredQuestions.length}</span> 
            <span>questão(ões) selecionada(s) de <strong className="text-slate-900">{poolOfQuestions.length}</strong> no total</span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreate}
              disabled={isSubmitting || filteredQuestions.length === 0}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Criando...
                </>
              ) : (
                'Criar Caderno'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
