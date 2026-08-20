const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityView.tsx', 'utf-8');

code = code.replace(/try \{\s*const statsRef = doc\(db, 'users', auth\.currentUser\.uid, 'stats', 'main'\);[\s\S]*?console\.error\("Error updating saves stat", statErr\);\s*\}/g, 
`try {
        await supabase.rpc('increment_saves_total', { user_id: auth.currentUser.uid });
      } catch (statErr) {
        console.error("Error updating saves stat", statErr);
      }`);

fs.writeFileSync('src/components/CommunityView.tsx', code);
