import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Search, 
  Tag, 
  User as UserIcon, 
  BookOpen, 
  Download, 
  Heart, 
  Play, 
  FileText, 
  CheckCircle2, 
  X, 
  ListOrdered, 
  Check, 
  Sparkles, 
  Layers, 
  ArrowUpDown, 
  RotateCcw,
  Eye,
  Clock,
  Flame,
  Bookmark
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, setDoc, doc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Quiz, StudyNote } from '../types';
import { cn } from '../lib/utils';
import { PREDEFINED_MAIN_TAGS } from './QuizzesView';
import { UserTitleBadge } from './UserTitleBadge';

interface CommunityViewProps {
  onSelectQuiz?: (quiz: Quiz) => void;
}

type ContentFilterType = 'all' | 'notes' | 'quizzes';

interface CombinedCommunityItem {
  id: string;
  itemType: 'studyNote' | 'quiz';
  title: string;
  category: string;
  subtags: string[];
  authorName: string;
  authorPhoto?: string;
  authorTitle?: string;
  createdAt: string;
  likes: string[];
  // Specific data
  studyNote?: StudyNote;
  quiz?: Quiz;
}

export function CommunityView({ onSelectQuiz }: CommunityViewProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ContentFilterType>('all');
  const [filterMainTag, setFilterMainTag] = useState('');
  const [filterSubtag, setFilterSubtag] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'likes'>('recent');
  
  // Reading modal for study notes
  const [readingNote, setReadingNote] = useState<StudyNote | null>(null);
  const [readingToc, setReadingToc] = useState<{ id: string; text: string }[]>([]);
  
  // Toast notifications
  const [toastInfo, setToastInfo] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCommunityData();
  }, []);

  // Lock background scrolling when reader modal is active
  useEffect(() => {
    if (readingNote) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [readingNote]);

  const fetchCommunityData = async () => {
    setLoading(true);
    try {
      // 1. Fetch public quizzes
      const qQuizzes = query(
        collection(db, 'quizzes'),
        where('isPublic', '==', true)
      );
      const quizSnapshot = await getDocs(qQuizzes);
      let fetchedQuizzes: Quiz[] = quizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      setQuizzes(fetchedQuizzes);

      // 2. Fetch public study notes
      const qNotes = collection(db, 'publicStudyNotes');
      const notesSnapshot = await getDocs(qNotes);
      let fetchedNotes: StudyNote[] = notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyNote));
      setStudyNotes(fetchedNotes);

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'community');
      console.error("Error fetching community data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async (item: CombinedCommunityItem) => {
    if (!auth.currentUser) {
      alert('Faça login para curtir cadernos!');
      return;
    }
    const uid = auth.currentUser.uid;
    const isLiked = item.likes.includes(uid);

    if (item.itemType === 'quiz') {
      setQuizzes(prev => prev.map(q => {
        if (q.id !== item.id) return q;
        const currentLikes = q.likes || [];
        const updatedLikes = isLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid];
        return { ...q, likes: updatedLikes };
      }));

      try {
        const quizRef = doc(db, 'quizzes', item.id);
        await setDoc(quizRef, {
          likes: isLiked ? arrayRemove(uid) : arrayUnion(uid)
        }, { merge: true });
      } catch (err) {
        console.error("Error toggling quiz like:", err);
      }
    } else {
      setStudyNotes(prev => prev.map(n => {
        if (n.id !== item.id) return n;
        const currentLikes = n.likes || [];
        const updatedLikes = isLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid];
        return { ...n, likes: updatedLikes };
      }));

      try {
        const noteRef = doc(db, 'publicStudyNotes', item.id);
        await setDoc(noteRef, {
          likes: isLiked ? arrayRemove(uid) : arrayUnion(uid)
        }, { merge: true });
      } catch (err) {
        console.error("Error toggling note like:", err);
      }
    }
  };

  const handleExportQuiz = (quiz: Quiz) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'quiz'}.revisarei`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportStudyNote = (note: StudyNote) => {
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${note.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h2, h3 { color: #334155; margin-top: 24px; }
    ul, ol { padding-left: 24px; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
  ${note.content || ''}
</body>
</html>`;
    const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(fullHtml);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'caderno'}.html`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSaveQuizToMyQuizzes = async (quiz: Quiz) => {
    if (!auth.currentUser) {
      alert('Faça login para salvar cadernos!');
      return;
    }
    try {
      const newQuiz = { 
        ...quiz, 
        userId: auth.currentUser.uid, 
        isPublic: false, 
        createdAt: new Date().toISOString() 
      };
      delete newQuiz.id;
      
      await addDoc(collection(db, 'quizzes'), newQuiz);

      try {
        const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
        await updateDoc(statsRef, { saves_total: increment(1) });
      } catch (statErr) {
        console.error("Error updating saves stat", statErr);
      }

      setSavedIds(prev => new Set(prev).add(quiz.id!));
      setToastInfo('Teste adicionado a "Meus testes"! Você pode praticar e editá-lo à vontade.');
      setTimeout(() => setToastInfo(null), 4000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'quizzes');
      alert('Erro ao salvar caderno: ' + err.message);
    }
  };

  const handleSaveStudyNoteToMyNotes = async (note: StudyNote) => {
    if (!auth.currentUser) {
      alert('Faça login para salvar este caderno de estudo!');
      return;
    }
    try {
      const forkedNote: StudyNote = {
        title: note.title,
        content: note.content,
        folder: note.folder || 'Importados',
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid,
        isPublic: false,
        originalNoteId: note.id
      };

      await addDoc(collection(db, `users/${auth.currentUser.uid}/studyNotes`), forkedNote);

      try {
        const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
        await updateDoc(statsRef, { saves_total: increment(1) });
      } catch (statErr) {
        console.error("Error updating saves stat", statErr);
      }

      if (note.id) {
        setSavedIds(prev => new Set(prev).add(note.id!));
      }
      setToastInfo('Caderno salvo em "Cadernos de Estudo"! Você pode editar sua cópia sem alterar o original.');
      setTimeout(() => setToastInfo(null), 5000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `users/${auth.currentUser.uid}/studyNotes`);
      alert('Erro ao salvar caderno: ' + err.message);
    }
  };

  const handleOpenReader = (note: StudyNote) => {
    setReadingNote(note);
    if (note.content) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = note.content;
      const items: { id: string; text: string }[] = [];
      tempDiv.querySelectorAll('[id^="toc-"]').forEach(el => {
        if (el.textContent?.trim()) {
          items.push({ id: el.id, text: el.textContent.trim() });
        }
      });
      setReadingToc(items);
    } else {
      setReadingToc([]);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterMainTag('');
    setFilterSubtag('');
    setSortBy('recent');
  };

  const isAnyFilterActive = searchQuery !== '' || filterType !== 'all' || filterMainTag !== '' || filterSubtag !== '' || sortBy !== 'recent';

  // Convert quizzes and study notes into unified items
  const combinedItems: CombinedCommunityItem[] = [
    ...studyNotes.map(n => ({
      id: n.id || Math.random().toString(),
      itemType: 'studyNote' as const,
      title: n.title || 'Caderno de Estudo',
      category: n.folder || 'Geral',
      subtags: [],
      authorName: n.authorName || 'Estudante',
      authorPhoto: n.authorPhoto,
      authorTitle: n.authorTitle || 'Estudante',
      createdAt: n.createdAt || '',
      likes: n.likes || [],
      studyNote: n
    })),
    ...quizzes.map(q => ({
      id: q.id || Math.random().toString(),
      itemType: 'quiz' as const,
      title: q.title || 'Caderno sem título',
      category: q.mainTag || q.tag || 'Geral',
      subtags: Array.isArray(q.subtags) ? q.subtags : 
               (typeof q.subtags === 'object' && q.subtags !== null) ? Object.values(q.subtags) : 
               ((q as any).subtag ? [(q as any).subtag] : []),
      authorName: (q as any).authorName || 'Estudante',
      authorPhoto: (q as any).authorPhoto,
      authorTitle: (q as any).authorTitle || 'Estudante',
      createdAt: q.createdAt || '',
      likes: q.likes || [],
      quiz: q
    }))
  ];

  // Dynamic subtags for filter
  const allSubtags = Array.from(new Set(
    quizzes.flatMap(q => q.subtags || ((q as any).subtag ? [(q as any).subtag] : []))
  )).filter((t): t is string => typeof t === 'string' && t.trim() !== '');

  // Filter items
  const filteredItems = combinedItems.filter(item => {
    if (filterType === 'notes' && item.itemType !== 'studyNote') return false;
    if (filterType === 'quizzes' && item.itemType !== 'quiz') return false;

    if (filterMainTag && item.category !== filterMainTag) return false;

    if (filterSubtag && !item.subtags.includes(filterSubtag)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchAuthor = item.authorName.toLowerCase().includes(q);
      const matchSub = item.subtags.some(s => s.toLowerCase().includes(q));
      if (!matchTitle && !matchCat && !matchAuthor && !matchSub) return false;
    }

    return true;
  });

  // Sorting
  filteredItems.sort((a, b) => {
    if (sortBy === 'likes') {
      return (b.likes.length) - (a.likes.length);
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // Strip html for clean preview
  const getExcerpt = (html?: string) => {
    if (!html) return 'Sem conteúdo disponível.';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().slice(0, 150) + (text.length > 150 ? '...' : '');
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto font-sans pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastInfo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold text-sm shadow-2xl z-[150] flex items-center gap-2.5 max-w-md text-center pointer-events-none"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastInfo}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reader Modal for Study Notes (Rendered via createPortal to cover 100% of the screen without bottom gaps) */}
      {readingNote && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 min-h-screen min-h-[100dvh] w-screen h-screen bg-slate-950/75 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReadingNote(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[92vh] max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Top Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                      Caderno de Estudo
                    </span>
                    <span className="text-xs font-bold text-slate-500 truncate">{readingNote.folder}</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5">{readingNote.title}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSaveStudyNoteToMyNotes(readingNote)}
                  className={cn(
                    "font-bold px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm",
                    readingNote.id && savedIds.has(readingNote.id)
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                  title="Salva uma cópia independente nos seus cadernos"
                >
                  {readingNote.id && savedIds.has(readingNote.id) ? (
                    <><Check className="w-4 h-4" /> <span className="hidden sm:inline">Salvo</span></>
                  ) : (
                    <><Bookmark className="w-4 h-4" /> <span className="hidden sm:inline">Salvar Cópia</span></>
                  )}
                </button>

                <button
                  onClick={() => handleExportStudyNote(readingNote)}
                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-200 rounded-xl transition border border-slate-200"
                  title="Baixar HTML"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setReadingNote(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
                  title="Fechar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Author Info Strip */}
            <div className="px-5 sm:px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {readingNote.authorPhoto ? (
                    <img src={readingNote.authorPhoto} alt={readingNote.authorName || 'Autor'} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <span className="font-bold text-slate-800 truncate">{readingNote.authorName || 'Estudante'}</span>
                <UserTitleBadge title={readingNote.authorTitle || 'Estudante'} />
              </div>

              <div className="flex items-center gap-3 text-slate-400 font-medium text-[11px]">
                <span>{readingNote.createdAt ? `Publicado em ${new Date(readingNote.createdAt).toLocaleDateString()}` : ''}</span>
              </div>
            </div>

            {/* Modal Body & TOC */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
              {readingToc.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-2xs">
                  <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs flex items-center gap-2 mb-3">
                    <ListOrdered className="w-4 h-4 text-emerald-600" /> Sumário do Caderno
                  </h3>
                  <ul className="space-y-2">
                    {readingToc.map(item => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="text-emerald-700 hover:text-emerald-900 font-bold text-sm hover:underline"
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formatted Content */}
              <div 
                className="study-editor-content prose prose-slate max-w-none text-slate-800 leading-relaxed text-sm sm:text-base"
                dangerouslySetInnerHTML={{ __html: readingNote.content || '<p>Caderno sem conteúdo.</p>' }}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <p className="text-xs text-slate-500 hidden sm:block">
                💡 Ao salvar, uma cópia independente é criada nos seus cadernos de estudo.
              </p>
              <button
                onClick={() => setReadingNote(null)}
                className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition text-xs sm:text-sm ml-auto"
              >
                Fechar Leitura
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Header */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Comunidade</h2>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">
          Mundo do Conhecimento
        </h1>
      </div>

      {/* Main Filter & Controls Section */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
        
        {/* Row 1: Content Type Selector Tabs + Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Segmented Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer",
                filterType === 'all'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px]",
                filterType === 'all' ? "bg-slate-200 text-slate-800 font-bold" : "bg-slate-200/60 text-slate-500"
              )}>
                {combinedItems.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('notes')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer",
                filterType === 'notes'
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-emerald-700"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cadernos de Estudo</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px]",
                filterType === 'notes' ? "bg-emerald-700 text-white font-bold" : "bg-slate-200/60 text-slate-500"
              )}>
                {studyNotes.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('quizzes')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer",
                filterType === 'quizzes'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-indigo-700"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Testes</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px]",
                filterType === 'quizzes' ? "bg-indigo-700 text-white font-bold" : "bg-slate-200/60 text-slate-500"
              )}>
                {quizzes.length}
              </span>
            </button>
          </div>

          {/* Sort Selector Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-1.5 px-3 outline-none focus:border-indigo-500 font-bold text-slate-700 text-xs shadow-2xs cursor-pointer transition"
            >
              <option value="recent">Mais Recentes</option>
              <option value="likes">Mais Curtidos</option>
            </select>
          </div>
        </div>

        {/* Row 2: Search Input & Category Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por título, autor, assunto ou tag..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-9 outline-none focus:border-indigo-500 focus:bg-white font-medium text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grande Área Selector */}
          <div className="md:col-span-3">
            <select 
              value={filterMainTag}
              onChange={(e) => setFilterMainTag(e.target.value)}
              className={cn(
                "w-full border rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 font-medium text-xs sm:text-sm cursor-pointer transition",
                filterMainTag 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              )}
            >
              <option value="">Todas as Grandes Áreas</option>
              {PREDEFINED_MAIN_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Subtags / Assunto Selector */}
          <div className="md:col-span-3">
            <select 
              value={filterSubtag}
              onChange={(e) => setFilterSubtag(e.target.value)}
              disabled={allSubtags.length === 0}
              className={cn(
                "w-full border rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 font-medium text-xs sm:text-sm cursor-pointer transition disabled:opacity-50",
                filterSubtag 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              )}
            >
              <option value="">Todos os Assuntos (Subtags)</option>
              {allSubtags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Active Filters Strip & Reset Button (if active) */}
        {isAnyFilterActive && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-400">Filtros ativos:</span>

              {filterType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-bold">
                  {filterType === 'notes' ? 'Cadernos de Estudo' : 'Testes'}
                  <button onClick={() => setFilterType('all')} className="hover:text-slate-950"><X className="w-3 h-3" /></button>
                </span>
              )}

              {filterMainTag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold">
                  Área: {filterMainTag}
                  <button onClick={() => setFilterMainTag('')} className="hover:text-indigo-950"><X className="w-3 h-3" /></button>
                </span>
              )}

              {filterSubtag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold">
                  Assunto: {filterSubtag}
                  <button onClick={() => setFilterSubtag('')} className="hover:text-indigo-950"><X className="w-3 h-3" /></button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-bold">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-slate-950"><X className="w-3 h-3" /></button>
                </span>
              )}

              <span className="text-slate-400 font-medium ml-1">
                ({filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''})
              </span>
            </div>

            <button
              onClick={clearAllFilters}
              className="font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="text-center text-slate-500 font-medium py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Globe className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="font-bold text-slate-700">Carregando cadernos da comunidade...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Nenhum caderno encontrado</h3>
          <p className="text-slate-500 font-medium text-xs sm:text-sm max-w-md mx-auto">
            Não encontramos nenhum material com os filtros selecionados. Tente ajustar os termos ou redefinir os filtros.
          </p>
          {isAnyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Redefinir Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredItems.map((item) => {
            const isNote = item.itemType === 'studyNote';
            const likesArr = item.likes;
            const isLiked = auth.currentUser ? likesArr.includes(auth.currentUser.uid) : false;
            const isSaved = savedIds.has(item.id);

            return (
              <div 
                key={`${item.itemType}-${item.id}`} 
                className={cn(
                  "bg-white p-5 sm:p-6 rounded-3xl border transition-all flex flex-col h-full shadow-sm hover:shadow-md",
                  isNote ? "hover:border-emerald-300 border-slate-200" : "hover:border-indigo-300 border-slate-200"
                )}
              >
                {/* Header Tag Bar */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  {/* Type Badge */}
                  {isNote ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-black uppercase tracking-wider">
                      <FileText className="w-3 h-3 text-emerald-600" />
                      Estudo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                      Teste
                    </span>
                  )}

                  {/* Category Tag */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {item.category}
                  </span>

                  {/* Subtags */}
                  {item.subtags.map((t, idx) => (
                    <span key={`${item.id}-sub-${idx}`} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {t}
                    </span>
                  ))}

                  <span className="ml-auto text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5 leading-snug line-clamp-2">
                  {item.title}
                </h3>

                {/* Excerpt or Info */}
                {isNote && item.studyNote ? (
                  <p className="text-slate-500 font-normal text-xs leading-relaxed mb-4 line-clamp-2">
                    {getExcerpt(item.studyNote.content)}
                  </p>
                ) : item.quiz ? (
                  <p className="text-slate-500 font-medium text-xs mb-4 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 
                    <span>{item.quiz.questions.length} questões com gabarito e comentários</span>
                  </p>
                ) : null}

                {/* Author Info Strip */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 mb-4 mt-auto">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-200 border border-white shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
                      {item.authorPhoto ? (
                        <img src={item.authorPhoto} alt={item.authorName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 truncate leading-tight">{item.authorName}</p>
                    </div>
                  </div>
                  <UserTitleBadge title={item.authorTitle || 'Estudante'} />
                </div>

                {/* Card Action Buttons Bar */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                  {/* Like Button */}
                  <button 
                    onClick={() => handleToggleLike(item)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0",
                      isLiked 
                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    )}
                    title={isLiked ? "Descurtir" : "Curtir"}
                  >
                    <Heart className={cn("w-3.5 h-3.5", isLiked ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                    <span>{likesArr.length}</span>
                  </button>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {isNote && item.studyNote ? (
                      <>
                        <button
                          onClick={() => handleOpenReader(item.studyNote!)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
                          title="Ler caderno completo"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ler</span>
                        </button>

                        <button 
                          onClick={() => handleSaveStudyNoteToMyNotes(item.studyNote!)}
                          className={cn(
                            "font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-2xs",
                            isSaved 
                              ? "bg-emerald-700 text-white" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                          title="Salvar cópia nos seus cadernos de estudo"
                        >
                          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          <span>{isSaved ? 'Salvo' : 'Salvar'}</span>
                        </button>

                        <button 
                          onClick={() => handleExportStudyNote(item.studyNote!)}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold p-1.5 rounded-xl border border-slate-200 transition"
                          title="Baixar HTML"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : item.quiz ? (
                      <>
                        {onSelectQuiz && (
                          <button
                            onClick={() => onSelectQuiz(item.quiz!)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
                            title="Praticar teste agora"
                          >
                            <Play className="w-3.5 h-3.5 fill-indigo-600" />
                            <span>Praticar</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleSaveQuizToMyQuizzes(item.quiz!)}
                          className={cn(
                            "font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-2xs",
                            isSaved 
                              ? "bg-indigo-800 text-white" 
                              : "bg-indigo-600 hover:bg-indigo-700 text-white"
                          )}
                          title="Salvar em Meus Testes"
                        >
                          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          <span>{isSaved ? 'Salvo' : 'Salvar'}</span>
                        </button>
                        <button 
                          onClick={() => handleExportQuiz(item.quiz!)}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold p-1.5 rounded-xl border border-slate-200 transition"
                          title="Baixar (.revisarei)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
