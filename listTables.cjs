const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  const tables = ['users', 'questions', 'quizzes', 'study_notes', 'flashcards', 'likes', 'comments', 'question_comments', 'quiz_comments', 'planner', 'user_stats', 'notifications', 'error_reports'];
  
  Promise.all(tables.map(async t => {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    return { table: t, exists: !error, error: error?.message };
  })).then(res => {
    console.log(JSON.stringify(res, null, 2));
  });
}
