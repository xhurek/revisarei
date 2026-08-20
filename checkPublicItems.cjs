const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  Promise.all([
    supabase.from('quizzes').select('id, title, is_public, user_id'),
    supabase.from('study_notes').select('id, title, is_public, user_id'),
    supabase.from('flashcards').select('id, title, is_public, user_id'),
    supabase.from('likes').select('*')
  ]).then(([q, s, f, l]) => {
    console.log('Quizzes total:', q.data?.length, 'Public:', q.data?.filter(x => x.is_public).length);
    console.log('StudyNotes total:', s.data?.length, 'Public:', s.data?.filter(x => x.is_public).length);
    console.log('Flashcards total:', f.data?.length, 'Public:', f.data?.filter(x => x.is_public).length);
    console.log('Likes total:', l.data?.length);
  });
}
