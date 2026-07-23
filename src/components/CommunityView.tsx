import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Globe, Search, Tag, User as UserIcon, BookOpen, Download } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { Quiz } from '../types';
import { cn } from '../lib/utils';
import { PREDEFINED_MAIN_TAGS } from './QuizzesView';

export function CommunityView() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMainTag, setFilterMainTag] = useState('');

  const [filterSubtag, setFilterSubtag] = useState('');
  
  // Calculate unique subtags dynamically from all quizzes
  const allSubtags = Array.from(new Set(quizzes.flatMap(q => q.subtags || (q.subtag ? [q.subtag] : [])))).filter(t => t && (t as string).trim() !== '');

  useEffect(() => {
    fetchCommunityQuizzes();
  }, []);

  const fetchCommunityQuizzes = async () => {
    setLoading(true);
    try {
      // Find where isPublic == true
      const q = query(
        collection(db, 'quizzes'),
        where('isPublic', '==', true)
      );
      const snapshot = await getDocs(q);
      let fetchedQuizzes: Quiz[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      
      // Sort descending by date locally
      fetchedQuizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuizzes(fetchedQuizzes);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'quizzes/public');
      console.error("Error fetching community quizzes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (quiz: Quiz) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'quiz'}.revisarei`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSaveToMyQuizzes = async (quiz: Quiz) => {
    if (!auth.currentUser) return;
    try {
      const newQuiz = { ...quiz, userId: auth.currentUser.uid, isPublic: false, createdAt: new Date().toISOString() };
      delete newQuiz.id; // remove original id
      
      await addDoc(collection(db, 'quizzes'), newQuiz);

      // Increment stats
      try {
        const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
        await updateDoc(statsRef, { saves_total: increment(1) });
      } catch (statErr) {
        console.error("Error updating saves stat", statErr);
      }

      alert('Caderno salvo em "Meus testes" com sucesso!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'quizzes');
      alert('Erro ao salvar caderno: ' + err.message);
    }
  };

  const filteredQuizzes = quizzes.filter(q => {
    const matchesMainTag = filterMainTag ? (q.mainTag || q.tag) === filterMainTag : true;
    
    let subs = '';
    const qSubtags = q.subtags?.length ? q.subtags : (q.subtag ? [q.subtag] : []);
    if (qSubtags.length > 0) subs = qSubtags.join(' ').toLowerCase();
    
    const matchesSubtag = filterSubtag ? qSubtags.includes(filterSubtag) : true;
    
    const lowerQuery = searchQuery.toLowerCase();
    const matchesQuery = lowerQuery === '' || 
      (q.title?.toLowerCase() || '').includes(lowerQuery) ||
      (q.mainTag?.toLowerCase() || '').includes(lowerQuery) ||
      subs.includes(lowerQuery) ||
      (q.tag?.toLowerCase() || '').includes(lowerQuery);

    return matchesMainTag && matchesSubtag && matchesQuery;
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Comunidade</h2>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Explorar Cadernos</h1>
        </div>
        <div className="flex-1 w-full flex flex-col md:flex-row gap-2">
          <select 
            value={filterMainTag}
            onChange={(e) => setFilterMainTag(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-indigo-500 font-medium appearance-none cursor-pointer text-slate-700 md:w-48 shrink-0"
          >
            <option value="">Grandes áreas</option>
            {PREDEFINED_MAIN_TAGS.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <select 
            value={filterSubtag}
            onChange={(e) => setFilterSubtag(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-indigo-500 font-medium appearance-none cursor-pointer text-slate-700 md:w-48 shrink-0"
          >
            <option value="">Assuntos (Subtags)</option>
            {allSubtags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por tag, título..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 font-medium"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="text-center text-slate-500 font-medium py-12">Carregando cadernos da comunidade...</div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-3xl border border-slate-200">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Nenhum caderno encontrado</h3>
          <p className="text-slate-500 font-medium mt-1">Tente ajustar sua busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuizzes.map((q) => (
            <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-full">
              <div className="flex flex-wrap gap-1 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest">
                  <Tag className="w-3.5 h-3.5" />
                  {q.mainTag || q.tag || "Sem assunto"}
                </span>
                {((Array.isArray(q.subtags) ? q.subtags : (typeof q.subtags === 'object' && q.subtags !== null ? Object.values(q.subtags) : (q.subtag ? [q.subtag] : []))) || []).filter(t => {
                   return t && typeof t === 'string' && t.trim() !== '';
                }).map((t, idx) => (
                  <span key={`${q.id}-subtag-${t}-${idx}`} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-xs font-bold tracking-tight">
                    {t}
                  </span>
                ))}
                <span className="ml-auto text-xs font-bold text-slate-400 self-center">
                  {new Date(q.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight flex-1">{q.title || "Caderno sem título"}</h3>
              <p className="text-slate-500 font-medium text-sm mb-6 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> {q.questions.length} questões
              </p>
              
              <div className="flex gap-2 w-full mt-auto">
                <button 
                  onClick={() => handleSaveToMyQuizzes(q)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Salvar
                </button>
                <button 
                  onClick={() => handleExport(q)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2"
                  title="Baixar (.revisarei)"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
