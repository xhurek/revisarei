const fs = require('fs');
let code = fs.readFileSync('src/components/QuizRoom.tsx', 'utf-8');

// First block
code = code.replace(/try \{\s*await updateDoc\(doc\(db, 'quizzes', quiz\.id\), \{[\s\S]*?\}\s*catch \(err\) \{\s*console\.error\(err\);\s*\}/m, '');

// Second block: updateDoc(doc(db, 'quizzes', quiz.id), { progress: null }).catch(console.error);
const repl2 = `supabase.from('quizzes').update({ progress: null }).eq('id', toValidUUID(quiz.id)).catch(console.error);`;
code = code.replace(/updateDoc\(doc\(db, 'quizzes', quiz\.id\), \{ progress: null \}\)\.catch\(console\.error\);/g, repl2);

fs.writeFileSync('src/components/QuizRoom.tsx', code);
