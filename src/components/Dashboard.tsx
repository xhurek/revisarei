import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, CheckCircle2, RefreshCw, Trophy, Brain, Lightbulb, AlertCircle, Sparkles, User, GraduationCap, Edit2, X, Flame, Calendar, Zap, Star, Award } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, TitleDefinition, TitleCriteria } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '../lib/utils';

const ICON_MAP: Record<string, React.ReactNode> = {
  Target: <Target className="w-5 h-5" />,
  Flame: <Flame className="w-5 h-5" />,
  Calendar: <Calendar className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Star: <Star className="w-5 h-5" />,
  Trophy: <Trophy className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Brain: <Brain className="w-5 h-5 text-indigo-500" />,
  Lightbulb: <Lightbulb className="w-5 h-5 text-yellow-500" />,
  GraduationCap: <GraduationCap className="w-5 h-5 text-purple-500" />
};

interface DashboardProps {
  onNavigate: (view: any) => void;
  userData: UserProfile | null;
  titlesList: TitleDefinition[];
}

export function Dashboard({ onNavigate, userData, titlesList }: DashboardProps) {
  const [stats, setStats] = useState({ 
    answered: 0, 
    progression: 0, 
    daily: 0, 
    correct: 0, 
    reviewed: 0,
    weekly: 0,
    streak: 0,
    dailyGoalsMet: 0,
    weeklyGoalsMet: 0,
    responses_total: 0,
    saves_total: 0,
    categoryStats: {} as Record<string, { correct: number, total: number }>
  });
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [selectedTitle, setSelectedTitle] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;
      try {
        const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
        const statsDoc = await getDoc(statsRef);
        
        if (statsDoc.exists()) {
          const data = statsDoc.data();
          const today = new Date().toISOString().split('T')[0];
          
          setStats({
            answered: data.questionsAnswered || 0,
            progression: data.progressionQuestions || 0,
            correct: data.questionsCorrect || 0,
            reviewed: data.flashcardsReviewed || 0,
            weekly: data.weeklyQuestionCount || 0,
            streak: data.streak || 0,
            dailyGoalsMet: data.dailyGoalsMet || 0,
            weeklyGoalsMet: data.weeklyGoalsMet || 0,
            daily: data.lastActivityDate === today ? (data.dailyQuestionCount || 0) : 0,
            responses_total: data.responses_total || 0,
            saves_total: data.saves_total || 0,
            categoryStats: data.categoryStats || {}
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setSavingProfile(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: editName || auth.currentUser.displayName,
        photoURL: editPhotoUrl || auth.currentUser.photoURL
      });

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: editName || auth.currentUser.displayName || 'Usuário',
        title: selectedTitle
      });

      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProfile(false);
    }
  };

  const renderIcon = (iconName: string | undefined, className = "w-5 h-5") => {
    if (!iconName) return <Award className={className} />;
    if (iconName.startsWith('http')) return <img src={iconName} className={cn("object-contain", className)} />;
    return ICON_MAP[iconName] ? React.cloneElement(ICON_MAP[iconName] as React.ReactElement, { className }) : <Award className={className} />;
  };

  const getNextTitleInfo = () => {
    if (titlesList.length === 0) return { title: 'Lenda', nextTitle: 'Fim', req: 9999, criteria: 'total_questions', currentVal: stats.answered, icon: <Sparkles className="w-5 h-5" />, color: 'bg-indigo-50|text-indigo-600|border-indigo-100' };

    const earned = userData?.earnedTitles || [];
    const next = titlesList.find(t => !earned.includes(t.name));
    
    if (!next) return { title: 'Elite', nextTitle: 'Fim', req: 0, criteria: 'total_questions', currentVal: stats.answered, icon: <Trophy className="w-5 h-5" />, color: 'bg-amber-50|text-amber-600|border-amber-100' };

    let currentVal = 0;
    switch(next.criteria) {
      case 'total_questions': currentVal = stats.answered; break;
      case 'daily_questions': currentVal = stats.daily; break;
      case 'weekly_questions': currentVal = stats.weekly; break;
      case 'flashcards_reviewed': currentVal = stats.reviewed; break;
      case 'streak_days': currentVal = stats.streak; break;
      case 'daily_goals_met': currentVal = stats.dailyGoalsMet; break;
      case 'weekly_goals_met': currentVal = stats.weeklyGoalsMet; break;
      case 'responses_total': currentVal = stats.responses_total; break;
      case 'saves_total': currentVal = stats.saves_total; break;
    }

    return {
      nextTitle: next.name,
      req: next.requirement,
      criteria: next.criteria,
      currentVal,
      icon: renderIcon(next.icon),
      color: next.color || 'bg-indigo-50|text-indigo-600|border-indigo-100'
    };
  };

  const nextTitleInfo = getNextTitleInfo();
  const progressToNext = nextTitleInfo.req === 0 ? 100 : Math.min(100, (nextTitleInfo.currentVal / nextTitleInfo.req) * 100);
  
  const currentTitleDef = titlesList.find(t => t.name === (userData?.title || ''));
  const colorParts = currentTitleDef?.color?.split('|') || ['bg-slate-50', 'text-slate-600', 'border-slate-100'];

  const performanceData = [
    { name: 'Acertos', value: stats.correct || 0, color: '#10b981' },
    { name: 'Erros', value: Math.max(0, stats.answered - stats.correct), color: '#ef4444' }
  ];

  const dailyGoal = 50;
  const weeklyGoal = 300;
  const dailyProgress = Math.min(stats.daily, dailyGoal);
  const weeklyProgress = Math.min(stats.weekly, weeklyGoal);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <button 
          onClick={() => {
            setEditName(auth.currentUser?.displayName || "");
            setEditPhotoUrl(auth.currentUser?.photoURL || "");
            setSelectedTitle(userData?.title || "");
            setIsEditingProfile(true);
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        
        <div className="relative">
          <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-white shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-slate-400" />
            )}
          </div>
          {currentTitleDef && (
            <div className={cn("absolute -top-3 -right-3 p-2 rounded-full shadow-md border", colorParts[0], colorParts[2])}>
                {renderIcon(currentTitleDef.icon, cn("w-5 h-5", colorParts[1]))}
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Olá, {auth.currentUser?.displayName?.split(' ')[0] || 'Estudante'}!</h1>
              {userData?.title && (
                <span className={cn("inline-flex text-[10px] font-black uppercase px-2 py-0.5 rounded-full border", colorParts[0], colorParts[1], colorParts[2])}>
                  {userData.title}
                </span>
              )}
            </div>
            {auth.currentUser?.email === 'rmourari@ufpi.edu.br' && (
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Soberano Administrador</p>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
               <span>Próximo Nível: {nextTitleInfo.nextTitle}</span>
               <span>{Math.floor(progressToNext)}%</span>
            </div>
            <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progressToNext}%` }}
                 className="h-full bg-indigo-500 rounded-full shadow-sm shadow-indigo-100"
               />
            </div>
            <p className="text-[9px] text-slate-300 font-bold text-right uppercase tracking-wider">
               {nextTitleInfo.req > 0 ? `Faltam ${Math.max(0, nextTitleInfo.req - nextTitleInfo.currentVal)} p/ meta` : 'Meta de Conquistas Atingida!'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Questões', val: stats.answered, icon: <Target className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Acertos', val: stats.correct, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Streak', val: stats.streak, icon: <Flame className="w-5 h-5" />, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Revisados', val: stats.reviewed, icon: <RefreshCw className="w-5 h-5" />, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.bg, s.color)}>
              {s.icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Aproveitamento</h3>
          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.answered > 0 ? performanceData : [{ name: '?', value: 1, color: '#f8fafc' }]}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5}
                  dataKey="value" stroke="none"
                >
                  {(stats.answered > 0 ? performanceData : [{ name: '?', value: 1, color: '#f8fafc' }]).map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-500">Acertos</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] font-bold text-slate-500">Erros</span></div>
          </div>
        </div>

        {[
          { label: 'Meta Diária', val: dailyProgress, max: dailyGoal, color: '#6366f1', sub: 'hoje' },
          { label: 'Meta Semanal', val: weeklyProgress, max: weeklyGoal, color: '#8b5cf6', sub: 'semana' }
        ].map((meta, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{meta.label}</h3>
            <div className="w-full h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ value: meta.val }, { value: Math.max(0, meta.max - meta.val) }]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={2}
                    dataKey="value" stroke="none" startAngle={90} endAngle={-270}
                  >
                    <Cell fill={meta.color} />
                    <Cell fill="#f1f5f9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <span className="text-xl font-bold text-slate-900">{meta.val}</span>
              <span className="text-xs font-bold text-slate-400"> / {meta.max} {meta.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mt-6">
        <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6">Desempenho por Grande Área</h3>
        <div className="space-y-4">
          {['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia', 'Obstetrícia', 'Medicina de Família e Comunidade'].map(area => {
            const areaStats = stats.categoryStats[area] || { correct: 0, total: 0 };
            const percentage = areaStats.total > 0 ? Math.round((areaStats.correct / areaStats.total) * 100) : 0;
            return (
              <div key={area} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700">{area}</span>
                  <span className="text-xs font-bold text-slate-500">
                    {areaStats.correct} / {areaStats.total} ({percentage}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-white"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Personalize seu Perfil</h2>
                <button onClick={() => setIsEditingProfile(false)} className="bg-slate-50 text-slate-400 hover:text-slate-900 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-2xl p-4 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-600/10 transition" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Foto (URL)</label>
                  <input type="text" value={editPhotoUrl} onChange={(e) => setEditPhotoUrl(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-2xl p-4 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-600/10 transition" />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título Ativo</label>
                   <select value={selectedTitle} onChange={(e) => setSelectedTitle(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-2xl p-4 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-600/10 transition appearance-none">
                     <option value="">Nenhum</option>
                     {userData?.title && !userData.earnedTitles?.includes(userData.title) && (
                       <option value={userData.title}>{userData.title} (Ativo)</option>
                     )}
                     {userData?.earnedTitles?.map((t: string, i: number) => (
                       <option key={i} value={t}>{t}</option>
                     ))}
                   </select>
                </div>

                <button 
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 mt-4"
                >
                  {savingProfile ? "Processando..." : "Salvar Alterações"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
