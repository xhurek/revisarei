const fs = require('fs');
let code = fs.readFileSync('src/components/QuizRoom.tsx', 'utf-8');

code = code.replace(/supabase\.from\('quizzes'\)\.update\(\{ progress: null \}\)\.eq\('id', toValidUUID\(quiz\.id\)\)\.catch\(console\.error\);/g, 
`supabase.from('quizzes').update({ progress: null }).eq('id', toValidUUID(quiz.id)).then(({error}) => { if(error) console.error(error); });`);

fs.writeFileSync('src/components/QuizRoom.tsx', code);
