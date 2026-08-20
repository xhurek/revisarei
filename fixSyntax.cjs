const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/\} catch \(err\) \{\s*console\.error\("Error loading questions for quiz modal:", err\);\s*\}\);/g, 
`}).catch(err => {
        console.error("Error loading questions for quiz modal:", err);
      });`);
fs.writeFileSync('src/components/QuestionBankView.tsx', code);
