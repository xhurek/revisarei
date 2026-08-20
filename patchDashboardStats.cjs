const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// remove firebase snapshot listener
const firebaseBlockMatch = /\/\/ Fallback se não tiver no Supabase[\s\S]*?return \(\) => \{\s*unsubscribe\(\);\s*\};/m;
code = code.replace(firebaseBlockMatch, '');

fs.writeFileSync('src/components/Dashboard.tsx', code);
