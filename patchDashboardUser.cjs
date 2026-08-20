const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

code = code.replace(/\/\/ 2\. Firestore User Sync[\s\S]*?console\.warn\("Firestore save profile backup error:", fireErr\);\s*\}/m, '');

fs.writeFileSync('src/components/Dashboard.tsx', code);
