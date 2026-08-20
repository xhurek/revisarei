const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

code = code.replace(/\/\/ Fallback para Firebase([\s\S]*?)return \(\) => unsubscribe\(\);\s*\}\)\(\); \/\/ Fim da IIFE de fallback do Supabase/g, 
`// Fallback para Firebase
      const unsubscribe = onSnapshot(statsRef, (statsDoc) => {
        if (statsDoc.exists()) {
          const data = statsDoc.data();
          let localToday = new Date();
          localToday.setHours(0, 0, 0, 0);
          const todayStr = new Date(localToday.getTime() - localToday.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          
          const currentMonday = new Date(localToday);
          const day = currentMonday.getDay();
          const diffToMonday = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
          currentMonday.setDate(diffToMonday);
          const currentWeekStr = new Date(currentMonday.getTime() - currentMonday.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          
          let weeklyCount = 0;
          if (data.currentWeek === currentWeekStr) {
            weeklyCount = data.weeklyQuestionCount || 0;
          } else if (data.lastActivityDate && data.lastActivityDate >= currentWeekStr) {
            weeklyCount = data.weeklyQuestionCount || 0;
          }
          const totalCorrectFromCategories = Object.values(data.categoryStats || {}).reduce((acc: number, curr: any) => acc + (curr.correct || 0), 0) as number;
          const hasCategoryStats = Object.keys(data.categoryStats || {}).length > 0;
          setStats({
            answered: data.questionsAnswered || 0,
            progression: data.progressionQuestions || 0,
            correct: hasCategoryStats ? totalCorrectFromCategories : Math.min(data.questionsAnswered || 0, Math.floor(data.questionsCorrect || 0)),
            reviewed: data.flashcardsReviewed || 0,
            weekly: weeklyCount,
            streak: data.streak || 0,
            dailyGoalsMet: data.dailyGoalsMet || 0,
            weeklyGoalsMet: data.weeklyGoalsMet || 0,
            daily: data.lastActivityDate === todayStr ? (data.dailyQuestionCount || 0) : 0,
            responses_total: data.responses_total || 0,
            saves_total: data.saves_total || 0,
            categoryStats: data.categoryStats || {}
          });
        }
        setLoading(false);
      }, (err) => {
        if (err.code === 'permission-denied') {
          console.warn("Stats subscription closed (permission-denied). Expected during logout.");
        } else {
          console.error("Error fetching stats:", err);
          setLoading(false);
        }
      });
      
      return () => unsubscribe();
    })(); // Fim da IIFE de fallback do Supabase`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
