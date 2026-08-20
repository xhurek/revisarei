const fs = require('fs');
let code = fs.readFileSync('src/components/QuizzesView.tsx', 'utf-8');

const regex = /const docRef = await addDoc\(collection\(db, 'quizzes'\), quizData\);\s*const savedQuiz = \{ \.\.\.quizData, id: docRef\.id \};/m;

const replacement = `const uniqueId = toValidUUID(\`quiz_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`);
                   await supabase.from('quizzes').insert({
                     id: uniqueId,
                     user_id: quizData.userId,
                     title: quizData.title,
                     discipline: quizData.mainTag,
                     theme: quizData.tag,
                     tags: quizData.subtags,
                     questions: quizData.questions,
                     is_public: quizData.isPublic,
                     author_name: quizData.authorName,
                     author_photo: quizData.authorPhoto,
                     author_title: quizData.authorTitle,
                     created_at: quizData.createdAt
                   });
                   const savedQuiz = { ...quizData, id: uniqueId };`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/QuizzesView.tsx', code);
