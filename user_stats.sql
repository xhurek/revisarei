CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  questions_answered INTEGER DEFAULT 0,
  progression_questions INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  daily_question_count INTEGER DEFAULT 0,
  weekly_question_count INTEGER DEFAULT 0,
  current_week DATE,
  last_activity_date DATE,
  streak INTEGER DEFAULT 0,
  daily_goals_met INTEGER DEFAULT 0,
  weekly_goals_met INTEGER DEFAULT 0,
  responses_total INTEGER DEFAULT 0,
  saves_total INTEGER DEFAULT 0,
  category_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
