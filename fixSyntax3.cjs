const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/setUserData\(snap\);\s*\}\);\s*\}\s*\},/g, 
`setUserData(snap);
        })();
    }
  },`);
fs.writeFileSync('src/components/QuestionBankView.tsx', code);
