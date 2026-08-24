import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Check, 
  Sparkles, 
  Layers, 
  ArrowUpDown, 
  RotateCcw,
  Eye,
  Clock,
  Flame,
  Bookmark,
  ChevronRight,
  ExternalLink,
  BookMarked
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { supabase, toValidUUID } from '../lib/supabase';
import { Quiz, StudyNote, Flashcard } from '../types';
import { cn } from '../lib/utils';
import { PREDEFINED_MAIN_TAGS } from './QuizzesView';
import { UserTitleBadge } from './UserTitleBadge';
import { importFlashcardsBatchToSupabase } from '../lib/supabaseFlashcards';

interface CommunityViewProps {
  onSelectQuiz?: (quiz: Quiz) => void;
  onSelectFlashcardDeck?: (deckTitle: string, cards: Flashcard[]) => void;
}

type ContentFilterType = 'all' | 'notes' | 'quizzes' | 'flashcards';

interface PublicFlashcardDeck {
  id: string;
  userId: string;
  title: string;
  description?: string;
  tags: string[];
  cards: Flashcard[];
  isPublic: boolean;
  authorName: string;
  authorPhoto?: string;
  authorTitle?: string;
  createdAt: string;
  likes: string[];
}

interface CombinedCommunityItem {
  id: string;
  itemType: 'studyNote' | 'quiz' | 'flashcard';
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
  flashcardDeck?: PublicFlashcardDeck;
}

export function CommunityView({ onSelectQuiz, onSelectFlashcardDeck }: CommunityViewProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [flashcardDecks, setFlashcardDecks] = useState<PublicFlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ContentFilterType>('all');
  const [filterMainTag, setFilterMainTag] = useState('');
  const [filterSubtag, setFilterSubtag] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'likes'>('recent');
  
  // Reading modal for study notes
  const [readingNote, setReadingNote] = useState<StudyNote | null>(null);
  const [readingToc, setReadingToc] = useState<{ id: string; text: string }[]>([]);

  // Preview modal for flashcard decks
  const [previewDeck, setPreviewDeck] = useState<PublicFlashcardDeck | null>(null);
  
  // Toast notifications & saved items state
  const [toastInfo, setToastInfo] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCommunityData();
  }, []);

  // Lock background scrolling when modal is active
  useEffect(() => {
    if (readingNote || previewDeck) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [readingNote, previewDeck]);

  const fetchCommunityData = async () => {
    setLoading(true);
    try {
      const [qRes, nRes, fRes, lRes, uRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('is_public', true),
        supabase.from('study_notes').select('*').eq('is_public', true),
        supabase.from('flashcards').select('*').eq('is_public', true),
        supabase.from('likes').select('*'),
        supabase.from('users').select('*')
      ]);

      const userMap: Record<string, any> = {};
      if (uRes.data) {
        uRes.data.forEach((u: any) => { userMap[u.id] = u; });
      }

      const likesMap: Record<string, string[]> = {};
      if (lRes.data) {
        lRes.data.forEach((l: any) => {
          if (!likesMap[l.item_id]) likesMap[l.item_id] = [];
          likesMap[l.item_id].push(l.user_id);
        });
      }

      // 1. Quizzes
      const mappedQuizzes: Quiz[] = (qRes.data || []).map((row: any) => {
        const author = userMap[row.user_id];
        return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          description: row.description || '',
          subject: row.subject || '',
          tag: row.theme || row.discipline || '',
          mainTag: row.discipline || row.theme || '',
          subtags: Array.isArray(row.tags) ? row.tags : [],
          questions: Array.isArray(row.questions) ? row.questions : [],
          isPublic: true,
          likes: likesMap[row.id] || [],
          authorName: author?.name || row.author_name || 'Estudante',
          authorPhoto: author?.photo_url || row.author_photo,
          authorTitle: author?.title || row.author_title || 'Calouro',
          createdAt: row.created_at
        } as Quiz;
      });

      // 2. Study Notes
      const mappedNotes: StudyNote[] = (nRes.data || []).map((row: any) => {
        const author = userMap[row.user_id];
        return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          content: row.content,
          folder: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags[0] : (row.summary || 'Geral'),
          isPublic: true,
          likes: likesMap[row.id] || [],
          authorName: author?.name || row.author_name || 'Estudante',
          authorPhoto: author?.photo_url || row.author_photo,
          authorTitle: author?.title || row.author_title || 'Calouro',
          createdAt: row.created_at
        } as StudyNote;
      });

      // 3. Flashcards
      const mappedDecks: PublicFlashcardDeck[] = (fRes.data || []).map((row: any) => {
        const author = userMap[row.user_id];
        return {
          id: row.id,
          userId: row.user_id,
          title: row.title || 'Baralho sem título',
          description: row.description || '',
          tags: Array.isArray(row.tags) ? row.tags : [],
          cards: Array.isArray(row.cards) ? row.cards : [],
          isPublic: true,
          likes: likesMap[row.id] || [],
          authorName: author?.name || row.author_name || 'Estudante',
          authorPhoto: author?.photo_url || row.author_photo,
          authorTitle: author?.title || row.author_title || 'Calouro',
          createdAt: row.created_at
        };
      });

      setQuizzes(mappedQuizzes);
      setStudyNotes(mappedNotes);
      setFlashcardDecks(mappedDecks);
    } catch (err) {
      console.error("Error fetching community data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async (item: CombinedCommunityItem) => {
    if (!auth.currentUser) {
      alert('Faça login para curtir cadernos e conteúdos!');
      return;
    }
    const uid = auth.currentUser.uid;
    const isLiked = item.likes.includes(uid);
    const validUUID = toValidUUID(item.id);

    // Optimistic UI updates
    if (item.itemType === 'quiz') {
      setQuizzes(prev => prev.map(q => {
        if (q.id !== item.id) return q;
        const currentLikes = q.likes || [];
        const updatedLikes = isLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid];
        return { ...q, likes: updatedLikes };
      }));

      try {
        if (isLiked) {
          await supabase.from('likes').delete().match({ user_id: uid, item_id: validUUID, item_type: 'quiz' });
          await supabase.from('quizzes').update({ likes_count: Math.max(0, item.likes.length - 1) }).eq('id', validUUID);
        } else {
          await supabase.from('likes').upsert({ id: toValidUUID(`${uid}_${item.id}_quiz`), user_id: uid, item_id: validUUID, item_type: 'quiz' });
          await supabase.from('quizzes').update({ likes_count: item.likes.length + 1 }).eq('id', validUUID);
        }
      } catch (supaLikeErr) {
        console.warn("Supabase like sync error:", supaLikeErr);
      }
    } else if (item.itemType === 'studyNote') {
      setStudyNotes(prev => prev.map(n => {
        if (n.id !== item.id) return n;
        const currentLikes = n.likes || [];
        const updatedLikes = isLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid];
        return { ...n, likes: updatedLikes };
      }));

      try {
        if (isLiked) {
          await supabase.from('likes').delete().match({ user_id: uid, item_id: validUUID, item_type: 'study_note' });
          await supabase.from('study_notes').update({ likes_count: Math.max(0, item.likes.length - 1) }).eq('id', validUUID);
        } else {
          await supabase.from('likes').upsert({ id: toValidUUID(`${uid}_${item.id}_study_note`), user_id: uid, item_id: validUUID, item_type: 'study_note' });
          await supabase.from('study_notes').update({ likes_count: item.likes.length + 1 }).eq('id', validUUID);
        }
      } catch (supaLikeErr) {
        console.warn("Supabase like sync error:", supaLikeErr);
      }
    } else if (item.itemType === 'flashcard') {
      setFlashcardDecks(prev => prev.map(f => {
        if (f.id !== item.id) return f;
        const currentLikes = f.likes || [];
        const updatedLikes = isLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid];
        return { ...f, likes: updatedLikes };
      }));

      try {
        if (isLiked) {
          await supabase.from('likes').delete().match({ user_id: uid, item_id: validUUID, item_type: 'flashcard' });
          await supabase.from('flashcards').update({ likes_count: Math.max(0, item.likes.length - 1) }).eq('id', validUUID);
        } else {
          await supabase.from('likes').upsert({ id: toValidUUID(`${uid}_${item.id}_flashcard`), user_id: uid, item_id: validUUID, item_type: 'flashcard' });
          await supabase.from('flashcards').update({ likes_count: item.likes.length + 1 }).eq('id', validUUID);
        }
      } catch (supaLikeErr) {
        console.warn("Supabase like sync error:", supaLikeErr);
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
      const uniqueId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await supabase.from('quizzes').insert({
        id: toValidUUID(uniqueId),
        user_id: auth.currentUser.uid,
        title: quiz.title,
        description: (quiz as any).description || '',
        subject: (quiz as any).subject || '',
        discipline: quiz.mainTag || '',
        theme: quiz.tag || '',
        tags: Array.isArray(quiz.subtags) ? quiz.subtags : [],
        questions: quiz.questions || [],
        is_public: false,
        author_name: auth.currentUser.displayName || 'Estudante',
        created_at: new Date().toISOString()
      });

      supabase.rpc('increment_saves_total', { user_id: auth.currentUser.uid }).then(({ error }) => {
        if (error) console.warn("Error updating saves stat:", error);
      });

      if (quiz.id) {
        setSavedIds(prev => new Set(prev).add(quiz.id!));
      }
      setToastInfo('Teste adicionado a "Meus testes"! Você pode praticar e editá-lo à vontade.');
      setTimeout(() => setToastInfo(null), 4000);
    } catch (err: any) {
      alert('Erro ao salvar caderno: ' + err.message);
    }
  };

  const handleSaveStudyNoteToMyNotes = async (note: StudyNote) => {
    if (!auth.currentUser) {
      alert('Faça login para salvar este caderno de estudo!');
      return;
    }
    try {
      const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await supabase.from('study_notes').insert({
        id: toValidUUID(uniqueId),
        user_id: auth.currentUser.uid,
        title: note.title,
        content: note.content,
        tags: note.folder ? [note.folder] : ['Importados'],
        is_public: false,
        author_name: auth.currentUser.displayName || 'Estudante',
        created_at: new Date().toISOString()
      });

      supabase.rpc('increment_saves_total', { user_id: auth.currentUser.uid }).then(({ error }) => {
        if (error) console.warn("Error updating saves stat:", error);
      });

      if (note.id) {
        setSavedIds(prev => new Set(prev).add(note.id!));
      }
      setToastInfo('Caderno salvo em "Cadernos de Estudo"! Você pode editar sua cópia sem alterar o original.');
      setTimeout(() => setToastInfo(null), 5000);
    } catch (err: any) {
      alert('Erro ao salvar caderno: ' + err.message);
    }
  };

  const handleSaveFlashcardDeck = async (deck: PublicFlashcardDeck) => {
    if (!auth.currentUser) {
      alert('Faça login para salvar baralhos de flashcards!');
      return;
    }
    try {
      const cardsToImport = deck.cards.map(c => ({
        ...c,
        id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tag: deck.title,
        userId: auth.currentUser?.uid,
        nextReview: new Date().toISOString(),
        interval: 0,
        easeFactor: 2.5
      }));

      await importFlashcardsBatchToSupabase(auth.currentUser.uid, cardsToImport);
      supabase.rpc('increment_saves_total', { user_id: auth.currentUser.uid }).then(({ error }) => {
        if (error) console.warn("Error updating saves stat:", error);
      });

      setSavedIds(prev => new Set(prev).add(deck.id));
      setToastInfo(`Baralho "${deck.title}" com ${cardsToImport.length} flashcards salvo nos seus Flashcards!`);
      setTimeout(() => setToastInfo(null), 5000);
    } catch (err: any) {
      alert('Erro ao salvar baralho: ' + err.message);
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

  // Convert quizzes, notes, and flashcards into unified feed items
  const combinedItems: CombinedCommunityItem[] = [
    ...studyNotes.map(n => ({
      id: n.id || Math.random().toString(),
      itemType: 'studyNote' as const,
      title: n.title || 'Caderno de Estudo',
      category: n.folder || 'Geral',
      subtags: [],
      authorName: n.authorName || 'Estudante',
      authorPhoto: n.authorPhoto,
      authorTitle: n.authorTitle || 'Calouro',
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
      authorTitle: (q as any).authorTitle || 'Calouro',
      createdAt: q.createdAt || '',
      likes: q.likes || [],
      quiz: q
    })),
    ...flashcardDecks.map(f => ({
      id: f.id,
      itemType: 'flashcard' as const,
      title: f.title,
      category: f.tags[0] || 'Geral',
      subtags: f.tags.slice(1),
      authorName: f.authorName,
      authorPhoto: f.authorPhoto,
      authorTitle: f.authorTitle || 'Calouro',
      createdAt: f.createdAt,
      likes: f.likes || [],
      flashcardDeck: f
    }))
  ];

  // Dynamic subtags for filter
  const allSubtags = Array.from(new Set([
    ...quizzes.flatMap(q => q.subtags || ((q as any).subtag ? [(q as any).subtag] : [])),
    ...flashcardDecks.flatMap(f => f.tags)
  ])).filter((t): t is string => typeof t === 'string' && t.trim() !== '');

  // Filter items
  const filteredItems = combinedItems.filter(item => {
    if (filterType === 'notes' && item.itemType !== 'studyNote') return false;
    if (filterType === 'quizzes' && item.itemType !== 'quiz') return false;
    if (filterType === 'flashcards' && item.itemType !== 'flashcard') return false;

    if (filterMainTag && (item.category || '').toLowerCase().trim() !== filterMainTag.toLowerCase().trim()) return false;
    if (filterSubtag && !(item.subtags || []).some(st => (st || '').toLowerCase().trim() === filterSubtag.toLowerCase().trim())) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchSubtag = item.subtags.some(st => st.toLowerCase().includes(q));
      const matchAuthor = item.authorName.toLowerCase().includes(q);
      if (!matchTitle && !matchCategory && !matchSubtag && !matchAuthor) return false;
    }

    return true;
  });

  // Sort items
  filteredItems.sort((a, b) => {
    if (sortBy === 'likes') {
      return (b.likes.length || 0) - (a.likes.length || 0);
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const getExcerpt = (html?: string) => {
    if (!html) return '';
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 140 ? plain.substring(0, 140) + '...' : plain;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastInfo && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 text-sm font-medium"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastInfo}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reader Modal */}
      {readingNote && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                    Caderno de Estudo
                  </span>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {readingNote.folder || 'Geral'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  {readingNote.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500 font-medium">Por {readingNote.authorName || 'Estudante'}</span>
                  {readingNote.authorTitle && <UserTitleBadge title={readingNote.authorTitle} />}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveStudyNoteToMyNotes(readingNote)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Salvar Cópia</span>
                </button>
                <button
                  onClick={() => setReadingNote(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content & TOC */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
              {readingToc.length > 0 && (
                <div className="md:col-span-1 border-r border-slate-100 pr-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Sumário</h4>
                  <nav className="space-y-1">
                    {readingToc.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          const el = document.getElementById(t.id);
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-left w-full text-xs text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg font-medium transition truncate block"
                      >
                        {t.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
              <div className={cn("prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed", readingToc.length > 0 ? "md:col-span-3" : "col-span-full")}>
                <div dangerouslySetInnerHTML={{ __html: readingNote.content || '<p className="text-slate-400">Sem conteúdo.</p>' }} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Flashcard Deck Preview Modal */}
      {previewDeck && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider">
                    Baralho de Flashcards
                  </span>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-500" /> {previewDeck.cards.length} cards
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 truncate">
                  {previewDeck.title}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Criado por {previewDeck.authorName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveFlashcardDeck(previewDeck)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Importar Baralho</span>
                </button>
                <button
                  onClick={() => setPreviewDeck(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cards List in Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {previewDeck.cards.map((c, i) => (
                <div key={c.id || i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>Card #{i + 1}</span>
                    {c.subtag && <span className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-[10px]">{c.subtag}</span>}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Pergunta / Frente:</span>
                    <div className="text-sm font-bold text-slate-900" dangerouslySetInnerHTML={{ __html: c.question }} />
                  </div>
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Resposta / Verso:</span>
                    <div className="text-xs font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: c.answer }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{previewDeck.cards.length} flashcards prontos para repetição espaçada</span>
              <button
                onClick={() => {
                  if (onSelectFlashcardDeck) {
                    onSelectFlashcardDeck(previewDeck.title, previewDeck.cards);
                    setPreviewDeck(null);
                  } else {
                    handleSaveFlashcardDeck(previewDeck);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Praticar Este Baralho</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Filter and Search Bar Card */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        {/* Top Row: Content Types & Sorting */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Content Type Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl overflow-x-auto max-w-full">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap",
                filterType === 'all'
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              )}
            >
              <Layers className="w-4 h-4 text-slate-700" />
              <span>Todos</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-700">
                {combinedItems.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('notes')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap",
                filterType === 'notes'
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              )}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Cadernos de Estudo</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-700">
                {studyNotes.length}
              </span>
            </button>

            <button
              onClick={() => setFilterType('quizzes')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap",
                filterType === 'quizzes'
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              )}
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Testes</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-700">
                {quizzes.length}
              </span>
            </button>

            {flashcardDecks.length > 0 && (
              <button
                onClick={() => setFilterType('flashcards')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap",
                  filterType === 'flashcards'
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                )}
              >
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Flashcards</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/80 text-slate-700">
                  {flashcardDecks.length}
                </span>
              </button>
            )}
          </div>

          {/* Sorting Dropdown */}
          <div className="flex items-center gap-2 text-slate-500 font-medium text-xs sm:text-sm shrink-0 self-end sm:self-auto">
            <span className="flex items-center gap-1 text-slate-500 font-medium text-xs sm:text-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Ordenar:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
            >
              <option value="recent">Mais Recentes</option>
              <option value="likes">Mais Curtidos</option>
            </select>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Bottom Row: Search & Category Selects */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-[2] min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, autor, assunto ou tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Grande Área Select */}
          <div className="flex-1 min-w-[190px]">
            <select
              value={filterMainTag}
              onChange={(e) => {
                setFilterMainTag(e.target.value);
                setFilterSubtag('');
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs cursor-pointer"
            >
              <option value="">Todas as Grandes Áreas</option>
              {PREDEFINED_MAIN_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Subtópicos Select */}
          <div className="flex-1 min-w-[190px]">
            <select
              value={filterSubtag}
              onChange={(e) => setFilterSubtag(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs cursor-pointer"
            >
              <option value="">Todos os Assuntos (Subtópicos)</option>
              {allSubtags.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Carregando feed da comunidade...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <Globe className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Nenhum caderno encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não encontramos nenhum conteúdo público com os filtros selecionados. Tente buscar por outros termos ou categorias.
          </p>
          {isAnyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition inline-flex items-center gap-1.5 mt-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Redefinir Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredItems.map((item) => {
            const isNote = item.itemType === 'studyNote';
            const isQuiz = item.itemType === 'quiz';
            const isDeck = item.itemType === 'flashcard';
            const likesArr = item.likes;
            const isLiked = auth.currentUser ? likesArr.includes(auth.currentUser.uid) : false;
            const isSaved = savedIds.has(item.id);

            return (
              <div 
                key={`${item.itemType}-${item.id}`} 
                className={cn(
                  "bg-white p-5 sm:p-6 rounded-3xl border transition-all flex flex-col h-full shadow-sm hover:shadow-md",
                  isNote ? "hover:border-emerald-300 border-slate-200" :
                  isQuiz ? "hover:border-indigo-300 border-slate-200" :
                  "hover:border-amber-300 border-slate-200"
                )}
              >
                {/* Header Tag Bar */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  {/* Type Badge */}
                  {isNote && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-black uppercase tracking-wider">
                      <FileText className="w-3 h-3 text-emerald-600" />
                      Resumo
                    </span>
                  )}
                  {isQuiz && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                      Teste
                    </span>
                  )}
                  {isDeck && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-black uppercase tracking-wider">
                      <Layers className="w-3 h-3 text-amber-600" />
                      Flashcards
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
                {isNote && item.studyNote && (
                  <p className="text-slate-500 font-normal text-xs leading-relaxed mb-4 line-clamp-2">
                    {getExcerpt(item.studyNote.content)}
                  </p>
                )}
                {isQuiz && item.quiz && (
                  <p className="text-slate-500 font-medium text-xs mb-4 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 
                    <span>{item.quiz.questions.length} questões com gabarito e comentários</span>
                  </p>
                )}
                {isDeck && item.flashcardDeck && (
                  <p className="text-slate-500 font-medium text-xs mb-4 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{item.flashcardDeck.cards.length} cards para memorização ativa</span>
                  </p>
                )}

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
                  <UserTitleBadge title={item.authorTitle || 'Calouro'} />
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
                    {isNote && item.studyNote && (
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
                    )}

                    {isQuiz && item.quiz && (
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
                    )}

                    {isDeck && item.flashcardDeck && (
                      <>
                        <button
                          onClick={() => setPreviewDeck(item.flashcardDeck!)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
                          title="Visualizar flashcards do baralho"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>Ver Cards</span>
                        </button>

                        <button
                          onClick={() => handleSaveFlashcardDeck(item.flashcardDeck!)}
                          className={cn(
                            "font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-2xs",
                            isSaved
                              ? "bg-amber-700 text-white"
                              : "bg-amber-600 hover:bg-amber-700 text-white"
                          )}
                          title="Importar para meus flashcards"
                        >
                          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          <span>{isSaved ? 'Salvo' : 'Importar'}</span>
                        </button>
                      </>
                    )}
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
