-- Drop old policies
DROP POLICY IF EXISTS "Allow all operations for now" ON public.users;
DROP POLICY IF EXISTS "Allow all operations for now" ON public.quizzes;
DROP POLICY IF EXISTS "Allow all operations for now" ON public.flashcards;
DROP POLICY IF EXISTS "Allow all operations for now" ON public.study_notes;
DROP POLICY IF EXISTS "Allow all operations for now" ON public.likes;

-- Create correct policies that allow INSERT as well
CREATE POLICY "Allow all operations for now" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON public.quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON public.flashcards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON public.study_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON public.likes FOR ALL USING (true) WITH CHECK (true);
