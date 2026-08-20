const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  // Test some common names
  const testNames = ['users', 'quizzes', 'study_notes', 'flashcards', 'likes', 'notifications', 'comments', 'comments_list', 'feed', 'notes', 'tags'];
  testNames.forEach(async (t) => {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) console.log('TABLE EXISTS:', t);
  });
}
