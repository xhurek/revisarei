const fs = require('fs');
let code = fs.readFileSync('src/components/FlashcardCreator.tsx', 'utf-8');

code = code.replace(/\/\/ 2\. Save in Firestore\s*await setDoc\(doc\(db, 'users', auth\.currentUser\.uid, 'flashcards', newCardId\), cardData\);/m, '');

fs.writeFileSync('src/components/FlashcardCreator.tsx', code);
