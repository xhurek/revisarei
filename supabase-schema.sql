-- Schema for Revisarei (Supabase / PostgreSQL) - UPDATED FOR FIREBASE MIGRATION
-- IDs are TEXT to match Firebase's 20-character string IDs perfectly.

-- Drop existing tables to recreate with TEXT IDs (since they are currently empty)
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.study_notes CASCADE;
DROP TABLE IF EXISTS public.flashcards CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Users Table (Linked to Firebase Auth UID)
CREATE TABLE public.users (
  id TEXT PRIMARY KEY, -- Firebase UID
  email TEXT,
  name TEXT,
  photo_url TEXT,
  xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_study_date TIMESTAMP WITH TIME ZONE,
  title TEXT DEFAULT 'Calouro',
  earned_titles JSONB DEFAULT '[]'::jsonb,
  questions_answered INTEGER DEFAULT 0,
  progression_questions INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  daily_question_count INTEGER DEFAULT 0,
  weekly_question_count INTEGER DEFAULT 0,
  current_week DATE,
  last_activity_date DATE,
  daily_goals_met INTEGER DEFAULT 0,
  weekly_goals_met INTEGER DEFAULT 0,
  responses_total INTEGER DEFAULT 0,
  saves_total INTEGER DEFAULT 0,
  category_stats JSONB DEFAULT '{}'::jsonb,
  folder_colors JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Quizzes Table
CREATE TABLE public.quizzes (
  id TEXT PRIMARY KEY, -- Firebase Document ID
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  sub_subject TEXT,
  discipline TEXT,
  theme TEXT,
  subtheme TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  author_name TEXT,
  author_photo TEXT,
  author_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Flashcards Table
CREATE TABLE public.flashcards (
  id TEXT PRIMARY KEY, -- Firebase Document ID
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  cards JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  author_name TEXT,
  author_photo TEXT,
  author_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Study Notes Table
CREATE TABLE public.study_notes (
  id TEXT PRIMARY KEY, -- Firebase Document ID
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  author_name TEXT,
  author_photo TEXT,
  author_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Likes Table (To prevent duplicate likes and track them)
CREATE TABLE public.likes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, -- References quiz_id, flashcard_id, or study_note_id
  item_type TEXT NOT NULL, -- 'quiz', 'flashcard', 'study_note'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, item_id, item_type)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Open policies for migration
CREATE POLICY "Allow all operations for now" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all operations for now" ON public.quizzes FOR ALL USING (true);
CREATE POLICY "Allow all operations for now" ON public.flashcards FOR ALL USING (true);
CREATE POLICY "Allow all operations for now" ON public.study_notes FOR ALL USING (true);
CREATE POLICY "Allow all operations for now" ON public.likes FOR ALL USING (true);
