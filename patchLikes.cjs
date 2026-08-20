const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityView.tsx', 'utf-8');

// remove firestore like sync for quizzes
code = code.replace(/\/\/ Firestore fallback sync[\s\S]*?\}\s*catch \(err\) \{\s*console\.error\("Error toggling quiz like:", err\);\s*\}/m, '');

// remove firestore like sync for notes
code = code.replace(/\/\/ Firestore fallback sync[\s\S]*?\}\s*catch \(err\) \{\s*console\.error\("Error toggling note like:", err\);\s*\}/m, '');

fs.writeFileSync('src/components/CommunityView.tsx', code);
