const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityView.tsx', 'utf-8');

code = code.replace(/\/\/ Fallback: Fetch from Firestore[\s\S]*?setStudyNotes\(fetchedNotes\);\n/m, 
`setQuizzes(supabaseQuizzes);
      setStudyNotes(supabaseNotes);
      setLoading(false);
      `);

fs.writeFileSync('src/components/CommunityView.tsx', code);
