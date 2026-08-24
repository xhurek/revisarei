import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, CheckCircle2, RefreshCw, Trophy, Brain, Lightbulb, AlertCircle, Sparkles, User, GraduationCap, Edit2, X, Flame, Calendar, Zap, Star, Award } from 'lucide-react';
import { auth } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { supabase } from '../lib/supabase';
import { UserProfile, TitleDefinition, TitleCriteria } from '../types';
import { getMainArea, DEFAULT_MAIN_AREAS } from '../lib/categories';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { PlannerWidget } from './PlannerWidget';
import { cn } from '../lib/utils';
import { syncUserProfileToSupabase, getUserStatsFromSupabase } from '../lib/supabaseUser';

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

  const fetchStats = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const statusData = await getUserStatsFromSupabase(uid);
      if (statusData) {
        const catStats = statusData.categoryStats || {};
        const hasCategoryStats = Object.keys(catStats).length > 0;
        const totalCorrectFromCategories = Object.values(catStats).reduce((acc: number, curr: any) => acc + (curr.correct || 0), 0) as number;

        let reviewedTotal = statusData.flashcardsReviewed || 0;

        // Verificação complementar: se a contagem estiver em 0 ou precisar de sincronização, verifica flashcards já revisados (interval > 0 ou alterados)
        try {
          const { data: deckRows } = await supabase.from('flashcards').select('cards').eq('user_id', uid);
          if (deckRows && deckRows.length > 0) {
            let activeCardsReviewed = 0;
            deckRows.forEach((row: any) => {
              if (Array.isArray(row.cards)) {
                row.cards.forEach((c: any) => {
                  if (c && (c.interval > 0 || c.easeFactor !== 2.5 || (c.nextReview && new Date(c.nextReview).getTime() > Date.now()))) {
                    activeCardsReviewed++;
                  }
                });
              }
            });
            reviewedTotal = Math.max(reviewedTotal, activeCardsReviewed);
          }
        } catch (cardErr) {
          console.warn("Aviso ao ler flashcards para estatística:", cardErr);
        }

        setStats({
          answered: statusData.questionsAnswered || 0,
          progression: statusData.progressionQuestions || 0,
          correct: hasCategoryStats ? totalCorrectFromCategories : (isNaN(statusData.questionsCorrect) ? 0 : statusData.questionsCorrect),
          reviewed: reviewedTotal,
          weekly: statusData.weeklyQuestionCount || 0,
          streak: statusData.streak || userData?.streak || 1,
          dailyGoalsMet: statusData.dailyGoalsMet || 0,
          weeklyGoalsMet: statusData.weeklyGoalsMet || 0,
          daily: statusData.lastActivityDate === new Date().toISOString().split('T')[0] ? (statusData.dailyQuestionCount || 0) : 0,
          responses_total: statusData.responses_total || 0,
          saves_total: statusData.saves_total || 0,
          categoryStats: catStats
        });
      }
    } catch (e) {
      console.warn("Supabase stats error in Dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    
    fetchStats();
  }, []);

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    setSavingProfile(true);
    try {
      const finalName = editName || auth.currentUser.displayName || 'Usuário';
      const finalPhoto = editPhotoUrl || auth.currentUser.photoURL || undefined;

      await updateProfile(auth.currentUser, {
        displayName: editName || auth.currentUser.displayName,
        photoURL: editPhotoUrl || auth.currentUser.photoURL
      });

      // 1. Supabase User Sync
      try {
        await syncUserProfileToSupabase({
          uid: auth.currentUser.uid,
          name: finalName,
          photo: finalPhoto,
          title: selectedTitle || undefined
        });
      } catch (supaErr) {
        console.warn("Supabase save profile error:", supaErr);
      }

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
    return ICON_MAP[iconName] ? React.cloneElement(ICON_MAP[iconName] as React.ReactElement<any>, { className }) : <Award className={className} />;
  };

  const getNextTitleInfo = () => {
    const rawList = titlesList.length > 0 ? titlesList : [
      { id: 't1', name: 'Estudante de Medicina', requirement: 0, criteria: 'total_questions', icon: 'GraduationCap', color: 'bg-blue-50|text-blue-600|border-blue-100' },
      { id: 't2', name: 'Interno de Medicina', requirement: 50, criteria: 'total_questions', icon: 'Brain', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
      { id: 't3', name: 'Residente Especialista', requirement: 150, criteria: 'total_questions', icon: 'Target', color: 'bg-violet-50|text-violet-600|border-violet-100' },
      { id: 't4', name: 'Preceptor Clínico', requirement: 300, criteria: 'total_questions', icon: 'Award', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
      { id: 't5', name: 'Mestre da Medicina', requirement: 500, criteria: 'total_questions', icon: 'Star', color: 'bg-amber-50|text-amber-600|border-amber-100' },
      { id: 't6', name: 'Lenda Médica', requirement: 1000, criteria: 'total_questions', icon: 'Trophy', color: 'bg-rose-50|text-rose-600|border-rose-100' }
    ] as TitleDefinition[];

    const activeList = [...rawList].sort((a, b) => a.requirement - b.requirement);

    const getVal = (criteria: TitleCriteria) => {
      switch(criteria) {
        case 'total_questions': return stats.answered;
        case 'daily_questions': return stats.daily;
        case 'weekly_questions': return stats.weekly;
        case 'flashcards_reviewed': return stats.reviewed;
        case 'streak_days': return stats.streak;
        case 'daily_goals_met': return stats.dailyGoalsMet;
        case 'weekly_goals_met': return stats.weeklyGoalsMet;
        case 'responses_total': return stats.responses_total;
        case 'saves_total': return stats.saves_total;
        default: return stats.answered;
      }
    };

    const earnedSet = new Set<string>(userData?.earnedTitles || []);
    if (activeList.length > 0) {
      earnedSet.add(activeList[0].name);
    }

    activeList.forEach(t => {
      if (getVal(t.criteria) >= t.requirement) {
        earnedSet.add(t.name);
      }
    });

    let currentTitleObj = activeList[0];
    for (let i = activeList.length - 1; i >= 0; i--) {
      if (earnedSet.has(activeList[i].name)) {
        currentTitleObj = activeList[i];
        break;
      }
    }

    if (userData?.title && activeList.some(t => t.name === userData.title)) {
      const selectedObj = activeList.find(t => t.name === userData.title);
      if (selectedObj) currentTitleObj = selectedObj;
    }

    const nextTitleObj = activeList.find(t => t.requirement > currentTitleObj.requirement && !earnedSet.has(t.name)) 
      || activeList.find(t => t.requirement > currentTitleObj.requirement);

    if (!nextTitleObj) {
      return { 
        currentTitle: currentTitleObj.name, 
        nextTitle: 'Nível Máximo', 
        req: currentTitleObj.requirement, 
        prevReq: currentTitleObj.requirement,
        criteria: currentTitleObj.criteria, 
        currentVal: getVal(currentTitleObj.criteria), 
        icon: <Trophy className="w-5 h-5 text-amber-500" />, 
        color: currentTitleObj.color || 'bg-amber-50|text-amber-600|border-amber-100',
        progress: 100
      };
    }

    const currentVal = getVal(nextTitleObj.criteria);
    const prevReq = currentTitleObj.requirement;
    const nextReq = nextTitleObj.requirement;

    const progressRange = nextReq - prevReq;
    const progressVal = currentVal - prevReq;
    const progress = progressRange > 0 
      ? Math.min(100, Math.max(0, (progressVal / progressRange) * 100))
      : 100;

    return {
      currentTitle: currentTitleObj.name,
      nextTitle: nextTitleObj.name,
      req: nextReq,
      prevReq,
      criteria: nextTitleObj.criteria,
      currentVal,
      icon: renderIcon(nextTitleObj.icon),
      color: nextTitleObj.color || 'bg-indigo-50|text-indigo-600|border-indigo-100',
      progress
    };
  };

  const nextTitleInfo = getNextTitleInfo();
  const progressToNext = nextTitleInfo.progress;
  
  const currentTitleDef = titlesList.find(t => t.name === (userData?.title || nextTitleInfo.currentTitle));
  const colorParts = currentTitleDef?.color?.split('|') || ['bg-slate-50', 'text-slate-600', 'border-slate-100'];

  const performanceData = [
    { name: 'Acertos', value: stats.correct || 0, color: '#10b981' },
    { name: 'Erros', value: Math.max(0, stats.answered - stats.correct), color: '#ef4444' }
  ];

  const dailyGoal = 50;
  const weeklyGoal = 300;
  const dailyProgress = stats.daily;
  const weeklyProgress = stats.weekly;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">DESEMPENHO E ESTATÍSTICAS</h2>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Avaliação Geral</h1>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          title="Atualizar Estatísticas"
        >
          <RefreshCw className={cn("w-4 h-4 text-indigo-600", loading && "animate-spin")} />
          <span>Atualizar</span>
        </button>
      </div>

      
      {/* Slim Profile Div */}
      <div className="bg-white rounded-2xl p-4 sm:px-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative overflow-hidden">
        <button 
          onClick={() => {
            setEditName(auth.currentUser?.displayName || "");
            setEditPhotoUrl(auth.currentUser?.photoURL || "");
            setSelectedTitle(userData?.title || "");
            setIsEditingProfile(true);
          }}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        
        <div className="relative shrink-0 ml-1 sm:ml-2">
          <div className="w-16 h-16 bg-slate-100 rounded-full border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>
          {currentTitleDef && (
            <div className={cn("absolute -top-1 -right-1 p-1 rounded-full shadow-sm border", colorParts[0], colorParts[2])}>
                {renderIcon(currentTitleDef.icon, cn("w-3.5 h-3.5", colorParts[1]))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">Olá, {auth.currentUser?.displayName?.split(' ')[0] || 'Estudante'}!</h2>
              <span className={cn("inline-flex items-center whitespace-nowrap text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs shrink-0", colorParts[0], colorParts[1], colorParts[2])}>
                {userData?.title || nextTitleInfo.currentTitle}
              </span>
            </div>
            {auth.currentUser?.email === 'rmourari@ufpi.edu.br' && (
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Soberano Administrador</p>
            )}
          </div>
          
          <div className="w-full md:w-1/3 space-y-1 mt-2 md:mt-0 mr-4">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
               <span>Nível: <strong className="text-indigo-600">{nextTitleInfo.currentTitle}</strong></span>
               <span>Próximo: <strong className="text-slate-800">{nextTitleInfo.nextTitle}</strong> ({Math.floor(progressToNext)}%)</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-px">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progressToNext}%` }}
                 className="h-full bg-indigo-600 rounded-full shadow-xs shadow-indigo-200"
               />
            </div>
            <p className="text-[9px] font-extrabold text-slate-400 text-right uppercase tracking-wider">
               {nextTitleInfo.nextTitle !== 'Nível Máximo' ? `${nextTitleInfo.currentVal} / ${nextTitleInfo.req} (${Math.max(0, nextTitleInfo.req - nextTitleInfo.currentVal)} faltam)` : 'Máximo!'}
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
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", s.bg, s.color)}>
                {s.icon}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.val}</p>
            </div>
          ))}
        </div>

        <div className="w-full">
          <PlannerWidget />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
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
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
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

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6">Desempenho por Grande Área</h3>
        <div className="space-y-4">
          {(() => {
            const aggregatedCategoryStats: Record<string, { correct: number, total: number }> = {};
            
            DEFAULT_MAIN_AREAS.forEach(area => {
              aggregatedCategoryStats[area] = { correct: 0, total: 0 };
            });

            Object.entries(stats.categoryStats || {}).forEach(([catKey, catData]) => {
              const data = catData as { correct?: number; total?: number };
              const mainArea = getMainArea(catKey);
              if (!aggregatedCategoryStats[mainArea]) {
                aggregatedCategoryStats[mainArea] = { correct: 0, total: 0 };
              }
              aggregatedCategoryStats[mainArea].correct += data.correct || 0;
              aggregatedCategoryStats[mainArea].total += data.total || 0;
            });

            const displayAreas = Array.from(new Set([
              ...DEFAULT_MAIN_AREAS,
              ...Object.keys(aggregatedCategoryStats).filter(a => aggregatedCategoryStats[a].total > 0)
            ]));

            return displayAreas.map(area => {
              const areaStats = aggregatedCategoryStats[area] || { correct: 0, total: 0 };
              const percentage = areaStats.total > 0 ? Math.round((areaStats.correct / areaStats.total) * 100) : 0;
              return (
                <div key={area} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-700">{area}</span>
                    <span className="text-xs font-bold text-slate-500">
                      <span className="text-emerald-600 font-bold">{areaStats.correct}</span> / {areaStats.total} questões ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        percentage >= 70 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : areaStats.total > 0 ? "bg-indigo-500" : "bg-slate-300"
                      )}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
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
