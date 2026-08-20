-- ==============================================================================
-- SCRIPT SQL PARA ATUALIZAR O SUPABASE COM COLUNAS DE STATS E PLANNER
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Adicionar colunas de estatísticas e personalização na tabela USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS progression_questions INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flashcards_reviewed INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_question_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_question_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_week DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_goals_met INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_goals_met INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS responses_total INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS saves_total INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS category_stats JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS folder_colors JSONB DEFAULT '{}'::jsonb;

-- 2. Criar tabela de Cronograma e Metas (PLANNER)
CREATE TABLE IF NOT EXISTS public.planner (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,
  tasks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela de Estatísticas (USER_STATS)
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

-- 4. Habilitar Row Level Security (RLS) e Políticas
ALTER TABLE public.planner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'planner' AND policyname = 'Allow all operations for now') THEN
    CREATE POLICY "Allow all operations for now" ON public.planner FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_stats' AND policyname = 'Allow all operations for now') THEN
    CREATE POLICY "Allow all operations for now" ON public.user_stats FOR ALL USING (true);
  END IF;
END $$;
