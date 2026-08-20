const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/supabase\.from\('question_bank'\)\.select\('\*'\)\.limit\(100\)\.then/g, 
`supabase.from('question_bank').select('*').limit(100).then`);
// better yet, just convert it to an async function inside useEffect
