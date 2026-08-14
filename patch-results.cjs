const fs = require('fs');

let content = fs.readFileSync('src/components/ResultsView.tsx', 'utf8');

content = content.replace(
  "return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {\\n            question: flashcardData.flashcardQuestion || m.question,\\n            answer: flashcardData.flashcardAnswer || m.answer,\\n            explanation: flashcardData.explanation || m.explanation || '',\\n            tag: info.topic,\\n            subtag: info.subtopic,\\n            createdAt: new Date().toISOString(),\\n            needsReview: true,\\n            lastReviewed: null\\n          });",
  "return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {\n            question: flashcardData.flashcardQuestion || m.question,\n            answer: flashcardData.flashcardAnswer || m.answer,\n            explanation: flashcardData.explanation || m.explanation || '',\n            tag: results.title || info.topic || 'Caderno de Erros',\n            subtag: 'Erros',\n            createdAt: new Date().toISOString(),\n            needsReview: true,\n            lastReviewed: null\n          });"
);

// Fallback logic
content = content.replace(
  "return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {\\n            question: m.question,\\n            answer: m.answer,\\n            explanation: m.explanation || '',\\n            tag: info.topic,\\n            subtag: info.subtopic,\\n            createdAt: new Date().toISOString(),\\n            needsReview: true,\\n            lastReviewed: null\\n          });",
  "return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {\n            question: m.question,\n            answer: m.answer,\n            explanation: m.explanation || '',\n            tag: results.title || info.topic || 'Caderno de Erros',\n            subtag: 'Erros',\n            createdAt: new Date().toISOString(),\n            needsReview: true,\n            lastReviewed: null\n          });"
);

fs.writeFileSync('src/components/ResultsView.tsx', content);
console.log('Results patched');
