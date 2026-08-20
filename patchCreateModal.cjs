const fs = require('fs');
let code = fs.readFileSync('src/components/CreateQuizModal.tsx', 'utf-8');

code = code.replace(/\/\/ 2\. Backup in Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore backup quiz error:", fireErr\);\s*\}/m, '');

fs.writeFileSync('src/components/CreateQuizModal.tsx', code);
