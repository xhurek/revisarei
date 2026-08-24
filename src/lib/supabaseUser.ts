import { supabase } from './supabase';
import { UserProfile } from '../types';

/**
 * Salva ou sincroniza o perfil do usuário no Supabase (tabela users).
 */
export async function syncUserProfileToSupabase(user: Partial<UserProfile> & { uid: string }): Promise<void> {
  try {
    const payload: any = {
      id: user.uid,
      updated_at: new Date().toISOString()
    };

    if (user.name !== undefined) payload.name = user.name;
    if (user.email !== undefined) payload.email = user.email;
    if (user.photo !== undefined || user.photoURL !== undefined) {
      payload.photo_url = user.photo || user.photoURL;
    }
    if (user.title !== undefined) payload.title = user.title;
    if (user.earnedTitles !== undefined && Array.isArray(user.earnedTitles)) {
      payload.earned_titles = user.earnedTitles;
    }
    if (user.streak !== undefined || user.streak_days !== undefined) {
      payload.streak_days = user.streak || user.streak_days || 0;
    }
    if (user.xp !== undefined) {
      payload.xp = user.xp;
    }
    if (user.folderColors !== undefined) {
      payload.folder_colors = user.folderColors;
    }
    if (user.authorized !== undefined) {
      payload.authorized = user.authorized;
    }

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Erro ao sincronizar usuário no Supabase:', error);
    }
  } catch (err) {
    console.warn('Exceção ao sincronizar usuário no Supabase:', err);
  }
}

/**
 * Salva as cores customizadas das pastas de cadernos no Supabase.
 */
export async function updateFolderColorsInSupabase(uid: string, folderColors: Record<string, string>): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ folder_colors: folderColors, updated_at: new Date().toISOString() })
      .eq('id', uid);
    if (error) {
      console.warn('Erro ao atualizar folder_colors no Supabase:', error);
    }
  } catch (err) {
    console.warn('Exceção ao atualizar folder_colors no Supabase:', err);
  }
}

/**
 * Atualiza preferências secundárias do usuário no Supabase.
 */
export async function updateUserPreferencesInSupabase(uid: string, preferences: Record<string, any>): Promise<void> {
  try {
    const payload: any = {
      ...preferences,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', uid);
    if (error) {
      console.warn('Erro ao atualizar preferências no Supabase:', error);
    }
  } catch (err) {
    console.warn('Exceção ao atualizar preferências no Supabase:', err);
  }
}

/**
 * Atualiza o progresso, XP, ofensiva (streak) e títulos conquistados pelo usuário no Supabase.
 */
export async function updateUserProgressInSupabase(
  uid: string,
  progress: {
    xpIncrement?: number;
    streak?: number;
    lastStudyDate?: string;
    title?: string;
    earnedTitles?: string[];
    rawStats?: any;
  }
): Promise<void> {
  try {
    let currentXp = 0;
    if (progress.xpIncrement) {
      const { data } = await supabase.from('users').select('xp').eq('id', uid).maybeSingle();
      if (data && typeof data.xp === 'number') {
        currentXp = data.xp;
      }
    }

    const storageKey = `revisarei_user_stats_${uid}`;
    let existingStats: any = {};
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) existingStats = JSON.parse(saved);
    } catch (e) {
      // ignore
    }

    // Se o localStorage não possuir os dados completos, busca direto do banco (users e user_stats) para não sobrescrever
    if (!existingStats || Object.keys(existingStats).length === 0 || existingStats.questions_answered === undefined) {
      try {
        const { data: dbUser } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
        if (dbUser) {
          existingStats = {
            questions_answered: dbUser.questions_answered || 0,
            progression_questions: dbUser.progression_questions || 0,
            questions_correct: dbUser.questions_correct || 0,
            flashcards_reviewed: dbUser.flashcards_reviewed || 0,
            daily_question_count: dbUser.daily_question_count || 0,
            weekly_question_count: dbUser.weekly_question_count || 0,
            current_week: dbUser.current_week || null,
            last_activity_date: dbUser.last_activity_date || null,
            streak: dbUser.streak_days || dbUser.streak || 0,
            daily_goals_met: dbUser.daily_goals_met || 0,
            weekly_goals_met: dbUser.weekly_goals_met || 0,
            responses_total: dbUser.responses_total || 0,
            saves_total: dbUser.saves_total || 0,
            category_stats: dbUser.category_stats || {}
          };
        } else {
          const { data: dbStats } = await supabase.from('user_stats').select('*').eq('user_id', uid).maybeSingle();
          if (dbStats) {
            existingStats = dbStats;
          }
        }
      } catch (dbErr) {
        console.warn("Aviso ao carregar stats prévios do banco:", dbErr);
      }
    }

    if (progress.rawStats) {
      const prevAnswered = existingStats.questions_answered || 0;
      const prevProgression = existingStats.progression_questions || 0;
      const prevCorrect = existingStats.questions_correct || 0;
      const prevReviewed = existingStats.flashcards_reviewed || 0;
      const prevDaily = existingStats.daily_question_count || 0;
      const prevWeekly = existingStats.weekly_question_count || 0;
      const prevResponses = existingStats.responses_total || 0;
      const prevSaves = existingStats.saves_total || 0;
      const prevCatStats = existingStats.category_stats || {};

      let today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      const currentMonday = new Date(today);
      const day = currentMonday.getDay();
      const diffToMonday = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
      currentMonday.setDate(diffToMonday);
      const currentWeekStr = new Date(currentMonday.getTime() - currentMonday.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      const lastDate = existingStats.last_activity_date || '';
      let dailyCount = lastDate === todayStr ? prevDaily : 0;
      let weeklyCount = (existingStats.current_week === currentWeekStr) ? prevWeekly : 0;

      const newAddAnswered = progress.rawStats.questionsAnswered || 0;
      const newAddCorrect = (!isNaN(progress.rawStats.questionsCorrect) ? progress.rawStats.questionsCorrect : 0);
      const newAddReviewed = progress.rawStats.flashcardsReviewed || 0;

      dailyCount += newAddAnswered;
      weeklyCount += newAddAnswered;

      const newCategoryStats = { ...prevCatStats };
      if (progress.rawStats.categoryStats) {
        Object.keys(progress.rawStats.categoryStats).forEach(cat => {
          if (!newCategoryStats[cat]) {
            newCategoryStats[cat] = { correct: 0, total: 0 };
          }
          newCategoryStats[cat].correct += progress.rawStats.categoryStats[cat].correct || 0;
          newCategoryStats[cat].total += progress.rawStats.categoryStats[cat].total || 0;
        });
      }

      const statsPayload = {
        user_id: uid,
        questions_answered: prevAnswered + newAddAnswered,
        progression_questions: prevProgression + Math.min(newAddAnswered, Math.max(0, 50 - (lastDate === todayStr ? prevDaily : 0))),
        questions_correct: prevCorrect + newAddCorrect,
        flashcards_reviewed: prevReviewed + newAddReviewed,
        daily_question_count: dailyCount,
        weekly_question_count: weeklyCount,
        current_week: currentWeekStr,
        last_activity_date: todayStr,
        streak: progress.streak !== undefined ? progress.streak : (existingStats.streak || 1),
        daily_goals_met: (dailyCount >= 50 && ((lastDate === todayStr ? prevDaily : 0) < 50)) ? (existingStats.daily_goals_met || 0) + 1 : (existingStats.daily_goals_met || 0),
        weekly_goals_met: (weeklyCount >= 300 && (prevWeekly < 300)) ? (existingStats.weekly_goals_met || 0) + 1 : (existingStats.weekly_goals_met || 0),
        responses_total: prevResponses + 1,
        saves_total: prevSaves,
        category_stats: newCategoryStats,
        updated_at: new Date().toISOString()
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(statsPayload));
        await supabase.from('user_stats').upsert(statsPayload);
        
        // Also update directly into users table so it appears in the users table columns without modifying other fields like authorized
        await supabase.from('users').update({
          questions_answered: statsPayload.questions_answered,
          progression_questions: statsPayload.progression_questions,
          questions_correct: statsPayload.questions_correct,
          flashcards_reviewed: statsPayload.flashcards_reviewed,
          daily_question_count: statsPayload.daily_question_count,
          weekly_question_count: statsPayload.weekly_question_count,
          current_week: statsPayload.current_week,
          last_activity_date: statsPayload.last_activity_date,
          daily_goals_met: statsPayload.daily_goals_met,
          weekly_goals_met: statsPayload.weekly_goals_met,
          responses_total: statsPayload.responses_total,
          saves_total: statsPayload.saves_total,
          category_stats: statsPayload.category_stats,
          streak_days: statsPayload.streak,
          updated_at: new Date().toISOString()
        }).eq('id', uid);
      } catch (e) {
        console.warn("Erro ao salvar user_stats:", e);
      }
    }

    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (progress.xpIncrement) {
      payload.xp = currentXp + progress.xpIncrement;
    }
    if (progress.streak !== undefined) {
      payload.streak_days = progress.streak;
    }
    if (progress.lastStudyDate) {
      payload.last_study_date = progress.lastStudyDate;
    }
    if (progress.title) {
      payload.title = progress.title;
    }
    if (progress.earnedTitles && Array.isArray(progress.earnedTitles)) {
      payload.earned_titles = progress.earnedTitles;
    }

    await supabase.from('users').update(payload).eq('id', uid);
  } catch (err) {
    console.warn('Erro ao atualizar progresso do usuário no Supabase:', err);
  }
}

/**
 * Carrega o perfil do usuário do Supabase.
 */
export async function getUserProfileFromSupabase(uid: string): Promise<Partial<UserProfile> | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error || !data) return null;

    return {
      uid: data.id,
      name: data.name || '',
      email: data.email || '',
      photo: data.photo_url || '',
      title: data.title || 'Calouro',
      earnedTitles: Array.isArray(data.earned_titles) ? data.earned_titles : [],
      streak: data.streak_days || 0,
      xp: data.xp || 0,
      folderColors: data.folder_colors || {},
      authorized: data.authorized === true || data.email === 'rmourari@ufpi.edu.br'
    };
  } catch (err) {
    console.warn('Erro ao buscar perfil do usuário no Supabase:', err);
    return null;
  }
}

/**
 * Exclui o usuário do Supabase (para uso administrativo).
 */
export async function deleteUserFromSupabase(uid: string): Promise<void> {
  try {
    await supabase.from('users').delete().eq('id', uid);
  } catch (err) {
    console.warn('Erro ao excluir usuário no Supabase:', err);
  }
}

export async function getUserStatsFromSupabase(uid: string): Promise<any> {
  try {
    // 1. Check users table first where all stats are now stored alongside profile
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (userData && (userData.questions_answered !== undefined || userData.category_stats !== undefined)) {
      return {
        questionsAnswered: userData.questions_answered || 0,
        progressionQuestions: userData.progression_questions || 0,
        questionsCorrect: userData.questions_correct || 0,
        flashcardsReviewed: userData.flashcards_reviewed || 0,
        dailyQuestionCount: userData.daily_question_count || 0,
        weeklyQuestionCount: userData.weekly_question_count || 0,
        currentWeek: userData.current_week || null,
        lastActivityDate: userData.last_activity_date || null,
        streak: userData.streak_days || userData.streak || 0,
        dailyGoalsMet: userData.daily_goals_met || 0,
        weeklyGoalsMet: userData.weekly_goals_met || 0,
        responses_total: userData.responses_total || 0,
        saves_total: userData.saves_total || 0,
        categoryStats: userData.category_stats || {}
      };
    }

    // 2. Check user_stats table
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (data) {
      return {
        questionsAnswered: data.questions_answered || 0,
        progressionQuestions: data.progression_questions || 0,
        questionsCorrect: data.questions_correct || 0,
        flashcardsReviewed: data.flashcards_reviewed || 0,
        dailyQuestionCount: data.daily_question_count || 0,
        weeklyQuestionCount: data.weekly_question_count || 0,
        currentWeek: data.current_week || null,
        lastActivityDate: data.last_activity_date || null,
        streak: data.streak || userData?.streak_days || 0,
        dailyGoalsMet: data.daily_goals_met || 0,
        weeklyGoalsMet: data.weekly_goals_met || 0,
        responses_total: data.responses_total || 0,
        saves_total: data.saves_total || 0,
        categoryStats: data.category_stats || {}
      };
    }

    const storageKey = `revisarei_user_stats_${uid}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      return {
        questionsAnswered: data.questions_answered || 0,
        progressionQuestions: data.progression_questions || 0,
        questionsCorrect: data.questions_correct || 0,
        flashcardsReviewed: data.flashcards_reviewed || 0,
        dailyQuestionCount: data.daily_question_count || 0,
        weeklyQuestionCount: data.weekly_question_count || 0,
        currentWeek: data.current_week || null,
        lastActivityDate: data.last_activity_date || null,
        streak: data.streak || userData?.streak_days || 0,
        dailyGoalsMet: data.daily_goals_met || 0,
        weeklyGoalsMet: data.weekly_goals_met || 0,
        responses_total: data.responses_total || 0,
        saves_total: data.saves_total || 0,
        categoryStats: data.category_stats || {}
      };
    }
    
    return {
      questionsAnswered: 0,
      progressionQuestions: 0,
      questionsCorrect: 0,
      flashcardsReviewed: 0,
      dailyQuestionCount: 0,
      weeklyQuestionCount: 0,
      currentWeek: null,
      lastActivityDate: null,
      streak: userData?.streak_days || 1,
      dailyGoalsMet: 0,
      weeklyGoalsMet: 0,
      responses_total: 0,
      saves_total: 0,
      categoryStats: {}
    };
  } catch (err) {
    console.warn("Exceção ao buscar user stats do Supabase:", err);
    return null;
  }
}

/**
 * Incrementa de forma atômica e segura a contagem de flashcards revisados pelo usuário.
 */
export async function incrementFlashcardsReviewedInSupabase(uid: string, count: number = 1): Promise<void> {
  try {
    await updateUserProgressInSupabase(uid, {
      rawStats: {
        flashcardsReviewed: count
      }
    });
  } catch (err) {
    console.warn("Erro ao incrementar flashcards revisados:", err);
  }
}
