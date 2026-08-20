const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/\} catch \(err\) \{\s*console\.warn\("Could not load total questions count:", err\);\s*\}\);/g, 
`}).catch(err => {
      console.warn("Could not load total questions count:", err);
    });`);

code = code.replace(/\} catch \(err\) \{\s*console\.warn\("Could not load bankTags from Firestore, using default:", err\);\s*\}\);/g, 
`}).catch(err => {
      console.warn("Could not load bankTags from Firestore, using default:", err);
    });`);
fs.writeFileSync('src/components/QuestionBankView.tsx', code);
