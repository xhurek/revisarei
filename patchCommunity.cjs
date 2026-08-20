const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityView.tsx', 'utf-8');

code = code.replace(/await addDoc\(collection\(db, 'quizzes'\), newQuiz\);/g, '');

fs.writeFileSync('src/components/CommunityView.tsx', code);
