import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signInWithGoogle, testConnection, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, increment, collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { View, Quiz, UserProfile, TitleDefinition } from './types';
import { LoginView } from './components/LoginView';
import { Dashboard } from './components/Dashboard';
import { QuestionBankView } from './components/QuestionBankView';
import { QuizzesView } from './components/QuizzesView';
import { ReviewQuiz } from './components/ReviewQuiz';
import { QuizRoom } from './components/QuizRoom';
import { ResultsView } from './components/ResultsView';
import { FlashcardsRoom } from './components/FlashcardsRoom';
import { CommunityView } from './components/CommunityView';
import { AdminView } from './components/AdminView';
import { ReportErrorModal } from './components/ReportErrorModal';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, BookOpen, Brain, FileText, LayoutDashboard, Tablet, Globe, Bell, User as UserIcon, Layers, Shield, MessageSquare, AlertCircle, Database } from 'lucide-react';
import { cn } from './lib/utils';

export const DEFAULT_TITLES: TitleDefinition[] = [
  { id: 't1', name: 'Calouro', requirement: 0, criteria: 'total_questions', icon: 'User', color: 'bg-slate-50|text-slate-600|border-slate-200' },
  { id: 't2', name: 'Café-com-leite', requirement: 250, criteria: 'total_questions', icon: 'Sparkles', color: 'bg-orange-50|text-orange-600|border-orange-100' },
  { id: 't3', name: 'Aprendiz', requirement: 500, criteria: 'total_questions', icon: 'GraduationCap', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
  { id: 't4', name: 'Estudante', requirement: 1000, criteria: 'total_questions', icon: 'Brain', color: 'bg-blue-50|text-blue-600|border-blue-100' },
  { id: 't5', name: 'Interno de Plantão', requirement: 2000, criteria: 'total_questions', icon: 'Stethoscope', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
  { id: 't6', name: 'Sabe muito', requirement: 4000, criteria: 'total_questions', icon: 'Flame', color: 'bg-rose-50|text-rose-600|border-rose-100' },
  { id: 't7', name: 'Lenda', requirement: 7000, criteria: 'total_questions', icon: 'Trophy', color: 'bg-amber-50|text-amber-600|border-amber-100' },
  { id: 't8', name: 'Gênio', requirement: 10000, criteria: 'total_questions', icon: 'Zap', color: 'bg-violet-50|text-violet-600|border-violet-100' }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [titlesList, setTitlesList] = useState<TitleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem('currentView');
      return (saved as View) || View.DASHBOARD;
    } catch { return View.DASHBOARD; }
  });
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(() => {
    try {
      const saved = sessionStorage.getItem('activeQuiz');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [lastResults, setLastResults] = useState<{ score: number, total: number, missed: any[], tag?: string, title?: string, timeElapsed?: number } | null>(() => {
    try {
      const saved = sessionStorage.getItem('lastResults');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    sessionStorage.setItem('currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (activeQuiz) {
      sessionStorage.setItem('activeQuiz', JSON.stringify(activeQuiz));
    } else {
      sessionStorage.removeItem('activeQuiz');
    }
  }, [activeQuiz]);

  useEffect(() => {
    if (lastResults) {
      sessionStorage.setItem('lastResults', JSON.stringify(lastResults));
    } else {
      sessionStorage.removeItem('lastResults');
    }
  }, [lastResults]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(true);

  useEffect(() => {
    let prevScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If we are near the top, always show the menu
      if (currentScrollY < 50) {
        setMenuVisible(true);
      } else if (currentScrollY > prevScrollY) {
        // Scrolling down -> hide the menu
        setMenuVisible(false);
      } else {
        // Scrolling up -> show the menu
        setMenuVisible(true);
      }
      
      prevScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const notifRef = useRef<HTMLDivElement>(null);
  
  // Horizontal drag state for top menu
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!menuScrollRef.current) return;
    setIsDraggingMenu(true);
    setStartX(e.pageX - menuScrollRef.current.offsetLeft);
    setScrollLeft(menuScrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseUp = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMenu || !menuScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - menuScrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast
    menuScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const isAdmin = user?.email === 'rmourari@ufpi.edu.br';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    let unsubscribeNotifs: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Cleanup previous notifications subscription if user changed
      if (unsubscribeNotifs) {
        unsubscribeNotifs();
        unsubscribeNotifs = undefined;
      }

      if (u) {
        // Fetch titles definitions once per session
        try {
          const titlesSnap = await getDocs(query(collection(db, 'titles'), orderBy('requirement', 'asc')));
          if (titlesSnap.empty) {
            setTitlesList(DEFAULT_TITLES);
          } else {
            setTitlesList(titlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TitleDefinition)));
          }
        } catch (err) {
          console.error("Error fetching titles definitions:", err);
          setTitlesList(DEFAULT_TITLES);
        }

        // Subscribe to user profile in real-time
        const userRef = doc(db, 'users', u.uid);
        const unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserData({ uid: snap.id, ...data, earnedTitles: data.earnedTitles || [] } as UserProfile);
          } else {
            // First time login logic moved outside onSnapshot to avoid loops
            initializeUser(u);
          }
        }, (err: any) => {
          if (err.code === 'permission-denied') {
            console.warn("User profile subscription closed (permission-denied). This is expected during logout.");
          } else {
            console.error("User profile subscription error:", err);
          }
        });

        // Add to cleanups
        const originalCleanup = unsubscribeNotifs;
        unsubscribeNotifs = () => {
          if (originalCleanup) originalCleanup();
          unsubscribeUser();
        };

        // Subscribe to notifications for THIS user
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', u.uid),
          orderBy('createdAt', 'desc')
        );
        unsubscribeNotifs = onSnapshot(q, (snapshot) => {
          setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err: any) => {
          if (err.code === 'permission-denied') {
            console.warn("Notifications subscription closed (permission-denied). Expected during logout.");
          } else {
            handleFirestoreError(err, OperationType.GET, 'notifications');
          }
        });

      } else {
        setUserData(null);
        setTitlesList([]);
        setNotifications([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeNotifs) unsubscribeNotifs();
    };
  }, []); // Run only once on mount

  const initializeUser = async (u: User) => {
    const userRef = doc(db, 'users', u.uid);
    const isAdm = u.email === 'rmourari@ufpi.edu.br';
    const newUser: UserProfile = {
      uid: u.uid,
      name: u.displayName || 'Usuário',
      email: u.email || '',
      authorized: isAdm,
      earnedTitles: [],
      folderColors: {}
    };
    await setDoc(userRef, newUser);
  };

  const handleQuizGenerated = (quiz: Quiz, skipReview: boolean) => {
    setActiveQuiz(quiz);
    if (skipReview) {
      setCurrentView(View.QUIZ);
    } else {
      setCurrentView(View.REVIEW);
    }
  };

  const handleQuizStart = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentView(View.QUIZ);
  };

  const handleReviewConfirm = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentView(View.QUIZ);
  };

  const handleQuizFinished = async (score: number, total: number, missed: any[], categoryStats?: Record<string, { correct: number, total: number }>, timeElapsed?: number) => {
    setLastResults({ score, total, missed, tag: activeQuiz?.tag, title: activeQuiz?.title, timeElapsed });
    setCurrentView(View.RESULTS);

    if (auth.currentUser && userData) {
      const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      try {
        const docSnap = await getDoc(statsRef);
        let updatedStats: any = {};
        let today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        const currentMonday = new Date(today);
        const day = currentMonday.getDay();
        const diffToMonday = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
        currentMonday.setDate(diffToMonday);
        const currentWeekStr = new Date(currentMonday.getTime() - currentMonday.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        if (docSnap.exists()) {
          const s = docSnap.data();
          const lastDate = s.lastActivityDate || '';
          
          let dailyCount = lastDate === todayStr ? (s.dailyQuestionCount || 0) : 0;
          let weeklyCount = 0;
          if (s.currentWeek === currentWeekStr) {
            weeklyCount = s.weeklyQuestionCount || 0;
          } else if (lastDate && lastDate >= currentWeekStr) {
            weeklyCount = s.weeklyQuestionCount || 0;
          }
          
          let lastActivity = new Date(0);
          if (lastDate) {
            const [y, m, d] = lastDate.split('-');
            lastActivity = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
          }
          
          const diffTime = today.getTime() - lastActivity.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          const allowedToday = Math.max(0, 50 - dailyCount);
          const progressionToApply = Math.min(total, allowedToday);
          
          let streak = s.streak || 0;
          if (lastDate !== todayStr) {
            if (diffDays === 1) streak += 1;
            else if (diffDays > 1) streak = 1;
          }

          const newDailyCount = dailyCount + total;
          const newWeeklyCount = weeklyCount + total;
          
          let dailyGoalsMet = s.dailyGoalsMet || 0;
          if (dailyCount < 50 && newDailyCount >= 50) dailyGoalsMet += 1;
          
          let weeklyGoalsMet = s.weeklyGoalsMet || 0;
          if (weeklyCount < 300 && newWeeklyCount >= 300) weeklyGoalsMet += 1;

          let responsesTotal = s.responses_total || 0;
          responsesTotal += 1;

          let existingCategoryStats = s.categoryStats || {};
          if (categoryStats) {
            Object.keys(categoryStats).forEach(cat => {
              if (!existingCategoryStats[cat]) {
                existingCategoryStats[cat] = { correct: 0, total: 0 };
              }
              existingCategoryStats[cat].correct += categoryStats[cat].correct;
              existingCategoryStats[cat].total += categoryStats[cat].total;
            });
          }

          updatedStats = {
            questionsAnswered: increment(total),
            progressionQuestions: increment(progressionToApply),
            questionsCorrect: increment(score),
            dailyQuestionCount: newDailyCount,
            weeklyQuestionCount: newWeeklyCount,
            lastActivityDate: todayStr,
            currentWeek: currentWeekStr,
            streak,
            dailyGoalsMet,
            weeklyGoalsMet,
            responses_total: responsesTotal,
            categoryStats: existingCategoryStats
          };
          
          await updateDoc(statsRef, updatedStats);
          
          // Use localized latest values for check
          const latestStats = {
             ...s,
             ...updatedStats,
             questionsAnswered: (s.questionsAnswered || 0) + total,
             progressionQuestions: (s.progressionQuestions || 0) + progressionToApply,
             questionsCorrect: (s.questionsCorrect || 0) + score
          };

          const earned = userData.earnedTitles || [];
          let newlyEarned = false;
          const activeList = titlesList.length > 0 ? titlesList : DEFAULT_TITLES;
          
          activeList.forEach(t => {
            let val = 0;
            switch(t.criteria) {
              case 'total_questions': val = latestStats.questionsAnswered; break;
              case 'daily_questions': val = latestStats.dailyQuestionCount; break;
              case 'weekly_questions': val = latestStats.weeklyQuestionCount; break;
              case 'streak_days': val = latestStats.streak; break;
              case 'daily_goals_met': val = latestStats.dailyGoalsMet; break;
              case 'weekly_goals_met': val = latestStats.weeklyGoalsMet; break;
              case 'flashcards_reviewed': val = latestStats.flashcardsReviewed || 0; break;
              case 'responses_total': val = latestStats.responses_total || 0; break;
              case 'saves_total': val = latestStats.saves_total || 0; break;
            }

            if (val >= t.requirement && !earned.includes(t.name)) {
              earned.push(t.name);
              newlyEarned = true;
            }
          });
          
          if (newlyEarned || (!userData.title && earned.length > 0)) {
            const currentTitle = earned[earned.length - 1] || 'Estudante de Medicina';
            await updateDoc(userRef, { earnedTitles: earned, title: currentTitle });
            setUserData({ ...userData, earnedTitles: earned, title: currentTitle });
          }

      } else {
          // New stats
          const statsData = {
            questionsAnswered: total,
            progressionQuestions: Math.min(total, 50),
            questionsCorrect: score,
            flashcardsReviewed: 0,
            dailyQuestionCount: total,
            weeklyQuestionCount: total,
            lastActivityDate: todayStr,
            currentWeek: currentWeekStr,
            streak: 1,
            dailyGoalsMet: total >= 50 ? 1 : 0,
            weeklyGoalsMet: total >= 300 ? 1 : 0,
            responses_total: 1,
            saves_total: 0,
            categoryStats: categoryStats || {}
          };
          await setDoc(statsRef, statsData);

          const earned = userData.earnedTitles || [];
          let newlyEarned = false;
          
          titlesList.forEach(t => {
            let val = 0;
            switch(t.criteria) {
              case 'total_questions': val = statsData.questionsAnswered; break;
              case 'daily_questions': val = statsData.dailyQuestionCount; break;
              case 'weekly_questions': val = statsData.weeklyQuestionCount; break;
              case 'streak_days': val = statsData.streak; break;
              case 'daily_goals_met': val = statsData.dailyGoalsMet; break;
              case 'weekly_goals_met': val = statsData.weeklyGoalsMet; break;
              case 'responses_total': val = statsData.responses_total; break;
              case 'saves_total': val = statsData.saves_total; break;
            }
            if (val >= t.requirement && !earned.includes(t.name)) {
              earned.push(t.name);
              newlyEarned = true;
            }
          });

          if (newlyEarned) {
            await updateDoc(userRef, { earnedTitles: earned });
            setUserData({ ...userData, earnedTitles: earned });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'stats');
        console.error("Error updating stats", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (userData && !userData.authorized && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
         <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md space-y-6">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
               <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-bold text-slate-900">Acesso Pendente</h2>
               <p className="text-slate-500">Olá, <b>{userData.name}</b>. Seu acesso ainda não foi autorizado por um administrador.</p>
               <p className="text-sm text-slate-400">Por favor, entre em contato com o administrador ou aguarde a aprovação.</p>
            </div>
            <button
               onClick={() => auth.signOut()}
               className="text-slate-400 hover:text-slate-600 font-bold flex items-center gap-2 mx-auto pt-4"
            >
               <LogOut className="w-4 h-4" /> Sair
            </button>
         </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white overflow-x-hidden flex flex-col">
      {/* Sidebar / Navigation */}
      <div className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm pointer-events-auto">
        <nav className="w-full max-w-6xl mx-auto">
          <div 
            ref={menuScrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex items-center overflow-x-auto justify-start sm:justify-center gap-2 lg:gap-8 py-3 px-4 w-full touch-pan-x select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="w-4 lg:w-6 shrink-0" aria-hidden="true" />
            <NavButton
              active={currentView === View.DASHBOARD}
              onClick={() => setCurrentView(View.DASHBOARD)}
              icon={<Brain className="w-5 h-5" />}
              label="Avaliação Geral"
            />
            <NavButton
              active={currentView === View.BANK}
              onClick={() => setCurrentView(View.BANK)}
              icon={<Database className="w-5 h-5" />}
              label="Banco de Questões"
            />
            <NavButton
              active={currentView === View.LANDING}
              onClick={() => setCurrentView(View.LANDING)}
              icon={<FileText className="w-5 h-5" />}
              label="Cadernos"
            />
            <NavButton
              active={currentView === View.FLASHCARDS}
              onClick={() => setCurrentView(View.FLASHCARDS)}
              icon={<Layers className="w-5 h-5" />}
              label="Flashcards"
            />
            <NavButton
              active={currentView === View.COMMUNITY}
              onClick={() => setCurrentView(View.COMMUNITY)}
              icon={<Globe className="w-5 h-5" />}
              label="Mundo"
            />
            
            {isAdmin && (
              <NavButton
                active={currentView === View.ADMIN}
                onClick={() => setCurrentView(View.ADMIN)}
                icon={<Shield className="w-5 h-5" />}
                label="Admin"
              />
            )}

            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            
            <div className="relative flex items-center justify-center shrink-0" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative"
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1">
                    {notifications.filter(n => !n.read).length > 10 ? '10+' : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-14 right-0 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-900">Notificações</h3>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          {notifications.filter(n => !n.read).length} nova{notifications.filter(n => !n.read).length !== 1 && 's'}
                        </span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-3">
                          <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                            <Bell className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-slate-900 font-bold">Tudo em dia!</p>
                            <p className="text-xs text-slate-500 font-medium">Você não tem novas notificações no momento.</p>
                          </div>
                        </div>
                      ) : (
                        notifications.map((notif, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                               if (notif.quiz) setActiveQuiz(notif.quiz);
                               if (notif.view) setCurrentView(notif.view);
                               setShowNotifications(false);
                            }}
                            className="p-4 border-b border-slate-50 hover:bg-slate-50 transition flex gap-3 cursor-pointer group"
                          >
                            <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shrink-0 transition-colors">
                              <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 font-medium leading-snug group-hover:text-indigo-900 transition-colors">{notif.message}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1.5">{notif.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => auth.signOut()}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-4 lg:w-6 shrink-0" aria-hidden="true" />
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto pt-6 pb-12 px-6">
        <AnimatePresence mode="wait">
          {currentView === View.DASHBOARD && (
            <motion.div
              key="dashboard"
              className="w-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Dashboard onNavigate={setCurrentView} userData={userData} titlesList={titlesList} />
            </motion.div>
          )}

          {currentView === View.BANK && (
            <motion.div
              key="bank"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <QuestionBankView isAdmin={isAdmin} />
            </motion.div>
          )}
          {currentView === View.LANDING && (
            <motion.div
              key="landing"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <QuizzesView onQuizGenerated={handleQuizGenerated} onQuizStart={handleQuizStart} isAdmin={isAdmin} />
            </motion.div>
          )}

          {currentView === View.REVIEW && activeQuiz && (
            <motion.div
              key="review"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ReviewQuiz quiz={activeQuiz} onConfirm={handleReviewConfirm} />
            </motion.div>
          )}

          {currentView === View.QUIZ && activeQuiz && (
            <motion.div
              key="quiz"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <QuizRoom quiz={activeQuiz} userData={userData} onFinish={handleQuizFinished} onCancel={() => setCurrentView(View.LANDING)} />
            </motion.div>
          )}

          {currentView === View.RESULTS && lastResults && (
            <motion.div
              key="results"
              className="w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ResultsView
                results={lastResults}
                onDone={() => setCurrentView(View.LANDING)}
                onRetry={() => setCurrentView(View.QUIZ)}
              />
            </motion.div>
          )}

          {currentView === View.COMMUNITY && (
            <motion.div
              key="community"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CommunityView 
                onSelectQuiz={(q) => {
                  setActiveQuiz(q);
                  setCurrentView(View.QUIZ);
                }}
              />
            </motion.div>
          )}

          {currentView === View.FLASHCARDS && (
            <motion.div
              key="flashcards"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FlashcardsRoom />
            </motion.div>
          )}

          {currentView === View.ADMIN && isAdmin && (
            <motion.div
              key="admin"
              className="w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AdminView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button for Error Reporting */}
      {!isAdmin && (
        <button
          onClick={() => setShowReportModal(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-[60]"
          title="Reportar Erro"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      <ReportErrorModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
        currentPage={currentView} 
      />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors duration-200 shrink-0",
        active ? "bg-slate-50 text-indigo-600 px-3 sm:px-4" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
      )}
    >
      {icon}
      {active && (
        <span className="text-sm font-bold">
          {label}
        </span>
      )}
    </button>
  );
}
