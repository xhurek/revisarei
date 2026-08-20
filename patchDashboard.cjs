const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const importSupabase = "import { supabase } from '../lib/supabase';";
if (!code.includes(importSupabase)) {
  code = code.replace("import { doc,", importSupabase + "\nimport { doc,");
}

code = code.replace(/const statsRef = doc\(db, 'users', auth\.currentUser\.uid, 'stats', 'main'\);\s*const unsubscribe = onSnapshot\(statsRef, \(statsDoc\) => \{/g, 
`const statsRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
    
    // Tentativa inicial de ler do Supabase
    (async () => {
      try {
        const { data: supaStats, error: supaErr } = await supabase.from('user_stats').select('*').eq('user_id', auth.currentUser!.uid).single();
        if (!supaErr && supaStats) {
          console.log("Stats carregados do Supabase");
          // Format from Supabase snake_case to app camelCase
          const hasCategoryStats = Object.keys(supaStats.category_stats || {}).length > 0;
          const totalCorrectFromCategories = Object.values(supaStats.category_stats || {}).reduce((acc: number, curr: any) => acc + (curr.correct || 0), 0) as number;
          
          setStats({
            answered: supaStats.questions_answered || 0,
            progression: supaStats.progression_questions || 0,
            correct: hasCategoryStats ? totalCorrectFromCategories : Math.min(supaStats.questions_answered || 0, Math.floor(supaStats.questions_correct || 0)),
            reviewed: supaStats.flashcards_reviewed || 0,
            weekly: supaStats.weekly_question_count || 0,
            streak: supaStats.streak || 0,
            dailyGoalsMet: supaStats.daily_goals_met || 0,
            weeklyGoalsMet: supaStats.weekly_goals_met || 0,
            daily: supaStats.last_activity_date === new Date().toISOString().split('T')[0] ? (supaStats.daily_question_count || 0) : 0,
            responses_total: supaStats.responses_total || 0,
            saves_total: supaStats.saves_total || 0,
            categoryStats: supaStats.category_stats || {}
          });
          setLoading(false);
          return; // Skip Firebase if Supabase succeeds
        }
      } catch (e) {
        console.warn("Supabase user_stats error, falling back to Firebase");
      }
      
      // Fallback para Firebase
      const unsubscribe = onSnapshot(statsRef, (statsDoc) => {`);

code = code.replace(/console\.warn\("Stats subscription closed \(permission-denied\)\. Expected during logout\."\);\s*\} else \{\s*console\.error\("Error fetching stats:", err\);\s*setLoading\(false\);\s*\}\s*\}\);\s*return \(\) => unsubscribe\(\);/g, 
`console.warn("Stats subscription closed (permission-denied). Expected during logout.");
      } else {
        console.error("Error fetching stats:", err);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
    })(); // Fim da IIFE de fallback do Supabase
`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
