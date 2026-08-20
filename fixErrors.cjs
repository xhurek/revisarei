const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

// Fix getCount import
code = code.replace(/getCount, /g, '');

// Fix PromiseLike .catch issues by using async/await syntax or await
code = code.replace(/supabase\.from\('question_bank'\)\.select\('\*'\)\.limit\(100\)\.then\(\(\{ data: snap \}\) => \{/g, 
`(async () => {
        try {
          const { data: snap } = await supabase.from('question_bank').select('*').limit(100);`);

code = code.replace(/\}\)\.catch\(err => \{\s*console\.error\("Error loading questions for quiz modal:", err\);\s*\}\);/g, 
`} catch(err) {
          console.error("Error loading questions for quiz modal:", err);
        }
      })();`);

code = code.replace(/supabase\.from\('users'\)\.select\('\*'\)\.eq\('id', auth\.currentUser!\.uid\)\.single\(\)\.then\(\(\{ data: snap \}\) => \{/g, 
`(async () => {
          const { data: snap } = await supabase.from('users').select('*').eq('id', auth.currentUser!.uid).single();`);
code = code.replace(/setUserData\(snap\);\s*\}\s*\}\)\;/g, 
`setUserData(snap);
            }
        })();`);

code = code.replace(/supabase\.from\('question_bank'\)\.select\('\*', \{ count: 'exact', head: true \}\)\.then\(snap => \{/g, 
`(async () => {
      try {
        const snap = await supabase.from('question_bank').select('*', { count: 'exact', head: true });`);
code = code.replace(/\}\)\.catch\(err => \{\s*console\.warn\("Could not load total questions count:", err\);\s*\}\);/g, 
`} catch(err) {
        console.warn("Could not load total questions count:", err);
      }
    })();`);

code = code.replace(/supabase\.from\('bank_tags'\)\.select\('\*'\)\.then\(snap => \{/g, 
`(async () => {
        try {
          const snap = await supabase.from('bank_tags').select('*');`);

code = code.replace(/\}\)\.catch\(err => \{\s*console\.warn\("Could not load bankTags from Firestore, using default:", err\);\s*\}\);/g, 
`} catch (err) {
          console.warn("Could not load bankTags from Firestore, using default:", err);
        }
      })();`);


fs.writeFileSync('src/components/QuestionBankView.tsx', code);
