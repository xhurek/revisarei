const fs = require('fs');
let code = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf-8');

const regex = /const statsRef = doc\(db, 'users', uid, 'stats', 'main'\);[\s\S]*?console\.error\("Error updating stats", err\);\s*\}\);/m;

const replacement = `// 2. Update stats in Supabase
    supabase.rpc('increment_flashcards_reviewed', { user_id: uid }).catch(err => {
       console.warn("Supabase stats update error:", err);
    });`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/FlashcardsRoom.tsx', code);
