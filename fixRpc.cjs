const fs = require('fs');
let code = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf-8');

code = code.replace(
  /supabase\.rpc\('increment_flashcards_reviewed', \{ user_id: uid \}\)\.catch\(err => \{[\s\S]*?\}\);/m,
  `supabase.rpc('increment_flashcards_reviewed', { user_id: uid }).then(({ error }) => { if (error) console.warn("Supabase stats update error:", error); });`
);

fs.writeFileSync('src/components/FlashcardsRoom.tsx', code);
