const fs = require('fs');
let code = fs.readFileSync('src/components/ResultsView.tsx', 'utf-8');

code = code.replace(/\/\/ 2\. Backup in Firestore[\s\S]*?await Promise\.all\(promises\);/m, '');

fs.writeFileSync('src/components/ResultsView.tsx', code);
