const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.example', 'utf-8');
// let's read from src/lib/supabase.ts to get url and key
const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('flashcards').select('*').limit(1).then(({ data, error }) => {
    console.log('Flashcards sample:', data, error);
  });
  supabase.from('likes').select('*').limit(1).then(({ data, error }) => {
    console.log('Likes sample:', data, error);
  });
  supabase.from('comments').select('*').limit(1).then(({ data, error }) => {
    console.log('Comments sample:', data, error);
  });
}
