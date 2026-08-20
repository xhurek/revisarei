const fs = require('fs');
let code = fs.readFileSync('src/components/ReviewQuiz.tsx', 'utf-8');

code = code.replace(/\/\/ 2\. Save \/ Update in Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore save in ReviewQuiz error:", fireErr\);\s*\}/m, '');

fs.writeFileSync('src/components/ReviewQuiz.tsx', code);
