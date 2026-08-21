import React, { useState, useEffect, useRef } from 'react';
import { auth, signInWithGoogle, testConnection } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

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
import { InstallAppModal } from './components/InstallAppModal';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, BookOpen, Brain, FileText, LayoutDashboard, Tablet, Globe, Bell, User as UserIcon, Layers, Shield, MessageSquare, AlertCircle, Database, X, CheckCircle2, Trophy, Sparkles, Info, Download } from 'lucide-react';
import { cn } from './lib/utils';
import { DEFAULT_TITLES, getCachedTitles, setCachedTitles, hasCachedTitles } from './lib/staticCache';
import { syncUserProfileToSupabase, updateUserProgressInSupabase, getUserProfileFromSupabase } from './lib/supabaseUser';
import { supabase } from './lib/supabase';

export { DEFAULT_TITLES };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [titlesList, setTitlesList] = useState<TitleDefinition[]>(() => getCachedTitles());
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(true);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    description: string;
    icon?: 'trophy' | 'book' | 'check' | 'bell' | 'sparkles' | 'info';
  } | null>(null);

  useEffect(() => {
    let timer: any = null;

    const handleToast = (e: any) => {
      const detail = e.detail || {};
      setToastNotification({
        id: detail.id || Math.random().toString(),
        title: detail.title || '',
        description: detail.description || '',
        icon: detail.icon || 'check'
      });

      if (timer) clearTimeout(timer);
      const duration = detail.duration || 3000;
      timer = setTimeout(() => {
        setToastNotification(null);
      }, duration);
    };

    const handleQuizCreated = (e: any) => {
      const detail = e.detail || {};
      const title = detail.title ? `Caderno "${detail.title}" criado!` : 'Caderno criado com sucesso!';
      const description = detail.count ? `${detail.count} questões prontas para resolver` : 'Pronto para estudar';
      
      setToastNotification({
        id: Math.random().toString(),
        title,
        description,
        icon: 'book'
      });

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setToastNotification(null);
      }, 3000);
    };

    window.addEventListener('app_toast', handleToast);
    window.addEventListener('quiz_created', handleQuizCreated);
    return () => {
      window.removeEventListener('app_toast', handleToast);
      window.removeEventListener('quiz_created', handleQuizCreated);
      if (timer) clearTimeout(timer);
    };
  }, []);

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
  
  // Horizontal drag state for top menu (desktop mouse drag)
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingMenuRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!menuScrollRef.current) return;
    isDraggingMenuRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - menuScrollRef.current.offsetLeft;
    scrollLeftRef.current = menuScrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingMenuRef.current = false;
    setTimeout(() => { hasDraggedRef.current = false; }, 50);
  };

  const handleMouseUp = () => {
    isDraggingMenuRef.current = false;
    setTimeout(() => { hasDraggedRef.current = false; }, 50);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMenuRef.current || !menuScrollRef.current) return;
    const x = e.pageX - menuScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(x - startXRef.current) > 6) {
      hasDraggedRef.current = true;
    }
    menuScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleNavClick = (view: View) => {
    if (hasDraggedRef.current) return;
    setCurrentView(view);
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
    let userChannel: any;
    let notifChannel: any;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (userChannel) {
        supabase.removeChannel(userChannel);
        userChannel = null;
      }
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
        notifChannel = null;
      }

      if (u) {
        if (hasCachedTitles()) {
          setTitlesList(getCachedTitles());
        } else {
          try {
            const { data, error } = await supabase.from('titles').select('*').order('requirement', { ascending: true });
            if (error || !data || data.length === 0) {
              setCachedTitles(DEFAULT_TITLES);
              setTitlesList(DEFAULT_TITLES);
            } else {
              setCachedTitles(data);
              setTitlesList(data);
            }
          } catch (err) {
            console.error("Error fetching titles definitions:", err);
            setTitlesList(DEFAULT_TITLES);
          }
        }

        const fetchAndSetUser = async () => {
          let prof = await getUserProfileFromSupabase(u.uid);
          if (!prof) {
            await initializeUser(u);
            prof = await getUserProfileFromSupabase(u.uid);
          }
          if (prof) {
            const isAdm = u.email === 'rmourari@ufpi.edu.br';
            setUserData({ 
              ...prof, 
              uid: u.uid,
              authorized: prof.authorized === true || isAdm
            } as UserProfile);
          }
        };
        
        await fetchAndSetUser();

        userChannel = supabase.channel(`public:users:id=eq.${u.uid}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${u.uid}` }, (payload) => {
            const data = payload.new as any;
            if (data) {
              const isAdm = data.email === 'rmourari@ufpi.edu.br';
              const prof = { 
                uid: data.id, 
                name: data.name, 
                email: data.email, 
                photo: data.photo_url, 
                title: data.title || 'Calouro',
                earnedTitles: data.earned_titles || [],
                xp: data.xp || 0,
                streak: data.streak_days || 0,
                folderColors: data.folder_colors || {},
                authorized: data.authorized === true || isAdm
              } as UserProfile;
              setUserData(prof);
            }
          }).subscribe();

        const fetchNotifs = async () => {
          const { data } = await supabase.from('notifications').select('*').eq('user_id', u.uid).order('created_at', { ascending: false }).limit(50);
          if (data) {
            setNotifications(data.map((n: any) => ({
              id: n.id,
              userId: n.user_id,
              title: n.title,
              message: n.message,
              type: n.type,
              read: n.is_read,
              createdAt: n.created_at,
              metadata: n.metadata
            })));
          }
        };
        
        await fetchNotifs();

        notifChannel = supabase.channel(`public:notifications:user_id=eq.${u.uid}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${u.uid}` }, () => {
             fetchNotifs();
          }).subscribe();

      } else {
        setUserData(null);
        setTitlesList([]);
        setNotifications([]);
      }
      setLoading(false);
    });

    const handleTitlesUpdated = (e: any) => {
      if (e.detail) {
        setTitlesList(e.detail);
      } else {
        setTitlesList(getCachedTitles());
      }
    };
    window.addEventListener('titles_updated', handleTitlesUpdated);

    return () => {
      unsubscribeAuth();
      if (userChannel) supabase.removeChannel(userChannel);
      if (notifChannel) supabase.removeChannel(notifChannel);
      window.removeEventListener('titles_updated', handleTitlesUpdated);
    };
  }, []); // Run only once on mount

  const initializeUser = async (u: User) => {
    const isAdm = u.email === 'rmourari@ufpi.edu.br';
    const newUser: UserProfile = {
      uid: u.uid,
      name: u.displayName || 'Usuário',
      email: u.email || '',
      authorized: isAdm,
      earnedTitles: [],
      folderColors: {}
    };
    
    // 1. Supabase User Sync
    try {
      await syncUserProfileToSupabase({
        uid: u.uid,
        name: newUser.name,
        email: newUser.email,
        photo: u.photoURL || undefined,
        title: 'Calouro',
        earnedTitles: [],
        streak: 0,
        xp: 0,
        folderColors: {},
        authorized: isAdm
      });
    } catch (sErr) {
      console.warn("Supabase initialize user error:", sErr);
    }
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
      try {
        const xpGained = (score * 10) + ((total - score) * 3);
        const earned = userData.earnedTitles || [];
        const currentTitle = earned[earned.length - 1] || userData.title || 'Estudante de Medicina';
        
        await updateUserProgressInSupabase(auth.currentUser.uid, {
          xpIncrement: xpGained,
          streak: (userData.streak || 0) + 1,
          lastStudyDate: new Date().toISOString(),
          title: currentTitle,
          earnedTitles: earned,
          rawStats: {
            questionsAnswered: total,
            questionsCorrect: score,
            categoryStats: categoryStats || {}
          }
        });
      } catch (err) {
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
            
            
            
            className="flex items-center overflow-x-auto justify-start sm:justify-center gap-2 lg:gap-8 py-3 px-4 w-full touch-pan-x select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] overscroll-x-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="w-2 sm:w-4 shrink-0" aria-hidden="true" />
            <NavButton
              active={currentView === View.DASHBOARD}
              onClick={() => handleNavClick(View.DASHBOARD)}
              icon={<Brain className="w-5 h-5 shrink-0" />}
              label="Avaliação Geral"
            />
            <NavButton
              active={currentView === View.BANK}
              onClick={() => handleNavClick(View.BANK)}
              icon={<Database className="w-5 h-5 shrink-0" />}
              label="Banco de Questões"
            />
            <NavButton
              active={currentView === View.LANDING}
              onClick={() => handleNavClick(View.LANDING)}
              icon={<FileText className="w-5 h-5 shrink-0" />}
              label="Cadernos"
            />
            <NavButton
              active={currentView === View.FLASHCARDS}
              onClick={() => handleNavClick(View.FLASHCARDS)}
              icon={<Layers className="w-5 h-5 shrink-0" />}
              label="Flashcards"
            />
            <NavButton
              active={currentView === View.COMMUNITY}
              onClick={() => handleNavClick(View.COMMUNITY)}
              icon={<Globe className="w-5 h-5 shrink-0" />}
              label="Mundo"
            />
            
            {isAdmin && (
              <NavButton
                active={currentView === View.ADMIN}
                onClick={() => handleNavClick(View.ADMIN)}
                icon={<Shield className="w-5 h-5 shrink-0" />}
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
              onClick={() => {
                if (deferredPrompt) {
                  handleTriggerInstall();
                } else {
                  setShowInstallModal(true);
                }
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative shrink-0"
              title="Instalar / Fixar na Área de Trabalho e Barra de Tarefas"
            >
              <Download className="w-5 h-5" />
            </button>

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
                onSelectFlashcardDeck={() => {
                  setCurrentView(View.FLASHCARDS);
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

      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />

      {/* Floating Animated Toast Notification */}
      <div className="fixed bottom-6 left-0 right-0 z-[9999] flex justify-center pointer-events-none px-4">
        <AnimatePresence>
          {toastNotification && (
            <motion.div 
              key={toastNotification.id}
              initial={{ opacity: 0, y: 40, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-xl shadow-emerald-950/10 flex items-center gap-4 pointer-events-auto"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border border-emerald-200">
                {toastNotification.icon === 'trophy' && <Trophy className="w-5 h-5 text-emerald-700" />}
                {toastNotification.icon === 'book' && <BookOpen className="w-5 h-5 text-emerald-700" />}
                {toastNotification.icon === 'bell' && <Bell className="w-5 h-5 text-emerald-700" />}
                {toastNotification.icon === 'sparkles' && <Sparkles className="w-5 h-5 text-emerald-700" />}
                {toastNotification.icon === 'info' && <Info className="w-5 h-5 text-emerald-700" />}
                {(!toastNotification.icon || toastNotification.icon === 'check') && <CheckCircle2 className="w-5 h-5 text-emerald-700" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-950 text-sm truncate">{toastNotification.title}</p>
                <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider truncate">{toastNotification.description}</p>
              </div>
              <button 
                onClick={() => setToastNotification(null)} 
                className="p-1.5 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors duration-200 shrink-0 touch-manipulation select-none",
        active 
          ? "bg-slate-50 text-indigo-600 px-3 sm:px-4" 
          : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
      )}
    >
      {icon}
      {active && (
        <span className="text-sm font-bold whitespace-nowrap">
          {label}
        </span>
      )}
    </button>
  );
}
