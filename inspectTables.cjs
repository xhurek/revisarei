const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  const tables = ['users', 'quizzes', 'study_notes', 'flashcards', 'likes', 'notifications'];
  (async () => {
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      console.log(`=== ${t} ===`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else if (data) {
        console.log('(empty, no rows)');
      } else {
        console.log('Error:', error);
      }
    }
  })();
}
