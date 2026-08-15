import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, orderBy, where, addDoc } from 'firebase/firestore';
import { UserProfile, ErrorReport, TitleDefinition, TitleCriteria } from '../types';
import { 
  User, Stethoscope, Users, AlertTriangle, CheckCircle, X, Shield, ShieldCheck, Trash2, Edit3, 
  Tag as TagIcon, Mail, Clock, Plus, Target, Flame, Calendar, Award, 
  Zap, Star, Trophy, Sparkles, Brain, Lightbulb, GraduationCap, Upload, RefreshCcw
} from 'lucide-react';
import { cn } from '../lib/utils';

const ICON_OPTIONS = [
  { name: 'Target', icon: <Target className="w-4 h-4" /> },
  { name: 'Flame', icon: <Flame className="w-4 h-4" /> },
  { name: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
  { name: 'Award', icon: <Award className="w-4 h-4" /> },
  { name: 'Zap', icon: <Zap className="w-4 h-4" /> },
  { name: 'Star', icon: <Star className="w-4 h-4" /> },
  { name: 'Trophy', icon: <Trophy className="w-4 h-4" /> },
  { name: 'Sparkles', icon: <Sparkles className="w-4 h-4" /> },
  { name: 'Brain', icon: <Brain className="w-4 h-4" /> },
  { name: 'Lightbulb', icon: <Lightbulb className="w-4 h-4" /> },
  { name: 'GraduationCap', icon: <GraduationCap className="w-4 h-4" /> },
  { name: 'User', icon: <User className="w-4 h-4" /> },
  { name: 'Stethoscope', icon: <Stethoscope className="w-4 h-4" /> }
];

const COLOR_OPTIONS = [
  { name: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  { name: 'Amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  { name: 'Emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  { name: 'Rose', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
  { name: 'Cyan', bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
  { name: 'Violet', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { name: 'Orange', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' }
];

const CRITERIA_LABELS: Record<TitleCriteria, string> = {
  total_questions: 'Total de Questões',
  daily_questions: 'Questões Diárias',
  weekly_questions: 'Questões Semanais',
  flashcards_reviewed: 'Flashcards Revisados',
  streak_days: 'Dias Seguidos (Streak)',
  daily_goals_met: 'Metas Diárias Batidas',
  weekly_goals_met: 'Metas Semanais Batidas',
  responses_total: 'Total de Respostas',
  saves_total: 'Total de Salvamentos',
  correctAnswers: 'Questões corretas',
  quizzesCompleted: 'Provas concluídas',
  studyHours: 'Horas de estudo',
  daysStreak: 'Dias de ofensiva'
};

export function AdminView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [titles, setTitles] = useState<TitleDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'titles'>('users');
  const [loading, setLoading] = useState(true);

  // New Title Form State
  const [newTitleName, setNewTitleName] = useState('');
  const [newTitleReq, setNewTitleReq] = useState<number>(0);
  const [newTitleCriteria, setNewTitleCriteria] = useState<TitleCriteria>('total_questions');
  const [selectedIconName, setSelectedIconName] = useState('Award');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [customIconUrl, setCustomIconUrl] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleFormError, setTitleFormError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers = usersSnap.docs.map(doc => {
         const data = doc.data();
         return { 
           uid: doc.id, 
           ...data,
           earnedTitles: data.earnedTitles || []
         } as UserProfile;
      });
      setUsers(fetchedUsers);

      // Fetch reports
      const reportsQuery = query(collection(db, 'error_reports'), orderBy('createdAt', 'desc'));
      const reportsSnap = await getDocs(reportsQuery);
      setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ErrorReport)));

      // Fetch titles
      const titlesSnap = await getDocs(query(collection(db, 'titles'), orderBy('requirement', 'asc')));
      const rawTitles = titlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TitleDefinition));

      // De-duplicate by name and clean up duplicates from Firestore if any exist
      const seenNames = new Set<string>();
      const uniqueTitlesList: TitleDefinition[] = [];
      const duplicateIdsToDelete: string[] = [];

      for (const t of rawTitles) {
        const key = (t.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          uniqueTitlesList.push(t);
        } else if (t.id) {
          duplicateIdsToDelete.push(t.id);
        }
      }

      // Automatically clean up duplicate docs from Firestore
      if (duplicateIdsToDelete.length > 0) {
        for (const dupId of duplicateIdsToDelete) {
          try {
            await deleteDoc(doc(db, 'titles', dupId));
          } catch (e) {
            console.warn('Failed to delete duplicate title doc:', dupId, e);
          }
        }
      }

      setTitles(uniqueTitlesList);

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'admin/data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleAuth = async (user: UserProfile) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { authorized: !user.authorized });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, authorized: !user.authorized } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateTitle = async (user: UserProfile, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const currentEarned = user.earnedTitles || [];
      const updatedEarned = currentEarned.includes(newTitle) ? currentEarned : [...currentEarned, newTitle];
      
      await updateDoc(userRef, { 
        title: newTitle,
        earnedTitles: updatedEarned
      });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, title: newTitle, earnedTitles: updatedEarned } : u));
      // removed alert
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      // removed alert
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomIconUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  
  const handleAddTitleDef = async () => {
    setTitleFormError(null);
    const trimmedName = newTitleName.trim();
    if (!trimmedName) {
      setTitleFormError('O nome do título não pode estar em branco.');
      return;
    }
    if (newTitleReq < 0) {
      setTitleFormError('O requisito deve ser um número maior ou igual a zero.');
      return;
    }

    // Check if title with same name already exists
    const isDuplicate = titles.some(
      t => t.name.trim().toLowerCase() === trimmedName.toLowerCase() && t.id !== editingTitleId
    );

    if (isDuplicate) {
      setTitleFormError(`Já existe uma conquista com o nome "${trimmedName}". Cada título deve ter um nome único.`);
      return;
    }

    try {
      const colorObj = COLOR_OPTIONS[selectedColorIndex] || COLOR_OPTIONS[0];
      const colorStr = `${colorObj.bg}|${colorObj.text}|${colorObj.border}`;
      
      const titleData = {
        name: trimmedName,
        requirement: newTitleReq,
        criteria: newTitleCriteria,
        icon: customIconUrl.trim() || selectedIconName,
        color: colorStr
      };

      if (editingTitleId) {
        await updateDoc(doc(db, 'titles', editingTitleId), titleData);
        setTitles(prev => prev.map(t => t.id === editingTitleId ? { id: editingTitleId, ...titleData } : t).sort((a, b) => a.requirement - b.requirement));
        setEditingTitleId(null);
      } else {
        const docRef = await addDoc(collection(db, 'titles'), titleData);
        setTitles(prev => [...prev, { id: docRef.id, ...titleData }].sort((a, b) => a.requirement - b.requirement));
      }
      
      setNewTitleName('');
      setNewTitleReq(0);
      setCustomIconUrl('');
      setSelectedIconName('Award');
      setSelectedColorIndex(0);
      setTitleFormError(null);
    } catch (err) {
      handleFirestoreError(err, editingTitleId ? OperationType.UPDATE : OperationType.CREATE, 'titles');
    }
  };

  const handleEditTitleDef = (t: TitleDefinition) => {
    setTitleFormError(null);
    setEditingTitleId(t.id || null);
    setNewTitleName(t.name);
    setNewTitleReq(t.requirement);
    setNewTitleCriteria(t.criteria);
    
    if (t.icon && t.icon.startsWith('http')) {
      setCustomIconUrl(t.icon);
      setSelectedIconName('');
    } else {
      setSelectedIconName(t.icon || 'Award');
      setCustomIconUrl('');
    }

    if (t.color) {
      const idx = COLOR_OPTIONS.findIndex(c => t.color!.includes(c.bg));
      setSelectedColorIndex(idx >= 0 ? idx : 0);
    } else {
      setSelectedColorIndex(0);
    }
    
    // Scroll to top or form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  const handleRestoreDefaults = async () => {
    // removed confirm
    try {
      const snap = await getDocs(collection(db, 'titles'));
      const deletions = snap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletions);
      
      const defaults = [
        { name: 'Calouro', requirement: 0, criteria: 'total_questions', icon: 'User', color: 'bg-slate-50|text-slate-600|border-slate-200' },
        { name: 'Café-com-leite', requirement: 250, criteria: 'total_questions', icon: 'Sparkles', color: 'bg-orange-50|text-orange-600|border-orange-100' },
        { name: 'Aprendiz', requirement: 500, criteria: 'total_questions', icon: 'GraduationCap', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
        { name: 'Estudante', requirement: 1000, criteria: 'total_questions', icon: 'Brain', color: 'bg-blue-50|text-blue-600|border-blue-100' },
        { name: 'Interno de Plantão', requirement: 2000, criteria: 'total_questions', icon: 'Stethoscope', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
        { name: 'Sabe muito', requirement: 4000, criteria: 'total_questions', icon: 'Flame', color: 'bg-rose-50|text-rose-600|border-rose-100' },
        { name: 'Lenda', requirement: 7000, criteria: 'total_questions', icon: 'Trophy', color: 'bg-amber-50|text-amber-600|border-amber-100' },
        { name: 'Gênio', requirement: 10000, criteria: 'total_questions', icon: 'Zap', color: 'bg-violet-50|text-violet-600|border-violet-100' }
      ];

      for (const t of defaults) {
        await addDoc(collection(db, 'titles'), t);
      }
      
      // removed alert
      await fetchAdminData();
    } catch (err) {
      console.error(err);
      // removed alert
    }
  };

  const handleDeleteTitleDef = async (id: string) => {
    // removed confirm
    try {
      await deleteDoc(doc(db, 'titles', id));
      setTitles(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `titles/${id}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // removed confirm
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(prev => prev.filter(u => u.uid !== userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'error_reports', reportId), { status: 'resolved' });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `error_reports/${reportId}`);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'error_reports', reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `error_reports/${reportId}`);
    }
  };

  const renderTitleIcon = (iconName: string) => {
    if (iconName.startsWith('http')) {
        return <img src={iconName} alt="Title Icon" className="w-5 h-5 object-contain" />;
    }
    const option = ICON_OPTIONS.find(o => o.name === iconName);
    return option ? React.cloneElement(option.icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : <Award className="w-5 h-5" />;
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">GERENCIAMENTO DO SISTEMA</h2>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Painel do Administrador</h1>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'users', label: 'Usuários', icon: <Users className="w-4 h-4" />, count: users.length },
          { id: 'titles', label: 'Conquistas', icon: <TagIcon className="w-4 h-4" />, count: titles.length },
          { id: 'reports', label: 'Erros', icon: <AlertTriangle className="w-4 h-4" />, count: reports.filter(r => r.status === 'pending').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "pb-4 px-2 text-sm font-bold transition-all relative shrink-0",
              activeTab === tab.id ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center gap-2">
              {tab.icon}
              {tab.label} ({tab.count})
            </div>
            {activeTab === tab.id && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </motion.div>
        ) : activeTab === 'users' ? (
          <motion.div key="users" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="grid gap-4">
            {users.map(user => (
              <div key={user.uid} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{user.name}</h4>
                    {user.email === 'rmourari@ufpi.edu.br' && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                    {user.title && (
                        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-100">
                           {user.title}
                        </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {user.earnedTitles?.map((t, i) => (
                        <span key={i} className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100 uppercase font-bold">
                            {t}
                        </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select 
                    className="bg-slate-100 border-none rounded-xl text-xs px-3 py-2 font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-600/10"
                    onChange={(e) => {
                        if (e.target.value) handleUpdateTitle(user, e.target.value);
                    }}
                    value=""
                  >
                    <option value="">Atribuir Título...</option>
                    {titles.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => handleToggleAuth(user)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                      user.authorized ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                    )}
                    disabled={user.email === 'rmourari@ufpi.edu.br'}
                  >
                    {user.authorized ? 'Revogar' : 'Autorizar'}
                  </button>

                  <button
                    onClick={() => handleDeleteUser(user.uid)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    disabled={user.email === 'rmourari@ufpi.edu.br'}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : activeTab === 'titles' ? (
          <motion.div key="titles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-6">
            
            <div className="flex justify-end mb-4">
               <button onClick={handleRestoreDefaults} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 px-4 py-2 rounded-xl">
                 <RefreshCcw className="w-4 h-4" /> Restaurar Conquistas do Sistema
               </button>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {editingTitleId ? <Edit3 className="w-5 h-5 text-amber-600" /> : <Plus className="w-5 h-5 text-indigo-600" />} {editingTitleId ? "Editar Conquista" : "Nova Conquista"}
              </h3>

              {titleFormError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{titleFormError}</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase px-1">Nome</label>
                  <input type="text" value={newTitleName} onChange={e => setNewTitleName(e.target.value)} placeholder="Ex: Mestre Supremo" className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase px-1">Tipo de Meta</label>
                  <select 
                    value={newTitleCriteria} 
                    onChange={e => setNewTitleCriteria(e.target.value as TitleCriteria)}
                    className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/10 appearance-none"
                  >
                    {Object.entries(CRITERIA_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase px-1">Requisito (Qtd)</label>
                  <input type="number" value={newTitleReq} onChange={e => setNewTitleReq(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium" />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase px-1">Ícone Customizado</label>
                   <div className="flex gap-2">
                     <input type="text" value={customIconUrl} onChange={e => setCustomIconUrl(e.target.value)} placeholder="URL ou base64..." className="flex-1 bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium" />
                     <label className="bg-slate-100 p-4 rounded-2xl cursor-pointer hover:bg-slate-200 transition">
                        <Upload className="w-5 h-5 text-slate-500" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />
                     </label>
                   </div>
                </div>
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold text-slate-500 uppercase px-1">Ícone</label>
                 <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map(opt => (
                        <button 
                            key={opt.name}
                            onClick={() => setSelectedIconName(opt.name)}
                            className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                                selectedIconName === opt.name ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                            )}
                        >
                            {opt.icon}
                        </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold text-slate-500 uppercase px-1">Esquema de Cores</label>
                 <div className="flex flex-wrap gap-3">
                    {COLOR_OPTIONS.map((opt, i) => (
                        <button 
                            key={i}
                            onClick={() => setSelectedColorIndex(i)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all border-2",
                                opt.bg, opt.text, opt.border,
                                selectedColorIndex === i ? "scale-105 shadow-md shadow-indigo-100 ring-2 ring-indigo-600 ring-offset-2" : "opacity-60"
                            )}
                        >
                            {opt.name}
                        </button>
                    ))}
                 </div>
              </div>

              
  <div className="flex gap-4">
    <button onClick={handleAddTitleDef} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-indigo-600 transition shadow-lg shadow-slate-200">
      {editingTitleId ? "Salvar Alterações" : "Criar Conquista"}
    </button>
    {editingTitleId && (
      <button onClick={() => {
        setEditingTitleId(null);
        setNewTitleName('');
        setNewTitleReq(0);
        setCustomIconUrl('');
      }} className="px-6 bg-white text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-50 border border-slate-200 transition">
        Cancelar
      </button>
    )}
  </div>
  
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {titles.map(title => {
                  const colorParts = title.color?.split('|') || ['bg-indigo-50', 'text-indigo-600', 'border-indigo-100'];
                  return (
                    <div key={title.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border", colorParts[0], colorParts[1], colorParts[2])}>
                          {renderTitleIcon(title.icon || 'Award')}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{title.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {CRITERIA_LABELS[title.criteria]} &ge; {title.requirement}
                          </p>
                        </div>
                      </div>
                      
  <div className="flex items-center gap-1">
    <button onClick={() => handleEditTitleDef(title)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Editar">
      <Edit3 className="w-5 h-5" />
    </button>
    <button onClick={() => handleDeleteTitleDef(title.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Excluir">
      <Trash2 className="w-5 h-5" />
    </button>
  </div>

                    </div>
                  );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="reports" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="grid gap-6">
            {reports.map(report => (
              <div key={report.id} className={cn("bg-white p-6 rounded-3xl border shadow-sm transition-all relative overflow-hidden", report.status === 'resolved' ? "border-slate-100 opacity-60" : "border-red-100")}>
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", report.status === 'resolved' ? "bg-slate-100 text-slate-400" : "bg-red-100 text-red-600")}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 leading-tight pr-20">{report.message}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-400 uppercase font-bold tracking-wider pt-1">
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(report.createdAt).toLocaleString()}</span>
                           <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {report.userName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      {report.status === 'pending' && (
                        <button onClick={() => handleResolveReport(report.id!)} className="flex-1 bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm">Resolvido</button>
                      )}
                      <button onClick={() => handleDeleteReport(report.id!)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition"><Trash2 className="w-5 h-5" /></button>
                    </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
