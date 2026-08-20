const fs = require('fs');
let code = fs.readFileSync('src/lib/supabaseUser.ts', 'utf-8');

// The first occurrence of `// Salva na user_stats de forma passiva` and `const payload: any = {`
const brokenBlock = `
    // Salva na user_stats de forma passiva
    if (progress.rawStats) {
      const statsPayload = {
        user_id: uid,
        questions_answered: progress.rawStats.questionsAnswered || 0,
        progression_questions: progress.rawStats.progressionQuestions || 0,
        questions_correct: progress.rawStats.questionsCorrect || 0,
        flashcards_reviewed: progress.rawStats.flashcardsReviewed || 0,
        daily_question_count: progress.rawStats.dailyQuestionCount || 0,
        weekly_question_count: progress.rawStats.weeklyQuestionCount || 0,
        current_week: progress.rawStats.currentWeek || null,
        last_activity_date: progress.rawStats.lastActivityDate || null,
        streak: progress.rawStats.streak || 0,
        daily_goals_met: progress.rawStats.dailyGoalsMet || 0,
        weekly_goals_met: progress.rawStats.weeklyGoalsMet || 0,
        responses_total: progress.rawStats.responses_total || 0,
        saves_total: progress.rawStats.saves_total || 0,
        category_stats: progress.rawStats.categoryStats || {},
        updated_at: new Date().toISOString()
      };
      // Não damos throw aqui para não travar a aplicação caso a tabela ainda não exista
      supabase.from('user_stats').upsert(statsPayload).then(({error}) => {
         if (error) console.warn("Erro ao salvar user_stats:", error.message);
      });
    }

    const payload: any = {`;

code = code.replace(brokenBlock, `const payload: any = {`);

// Now insert it in updateUserProgressInSupabase
const targetMethod = "export async function updateUserProgressInSupabase(";
const targetIndex = code.indexOf(targetMethod);

// Find the first `const payload: any = {` AFTER targetIndex
const payloadIndex = code.indexOf('const payload: any = {', targetIndex);

code = code.substring(0, payloadIndex) + brokenBlock + code.substring(payloadIndex + 'const payload: any = {'.length);

fs.writeFileSync('src/lib/supabaseUser.ts', code);
