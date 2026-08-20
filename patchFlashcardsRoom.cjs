const fs = require('fs');
let code = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf-8');

// 1. Remove Firestore fetch block in fetchCards
const fetchCardsMatch = /if \(fetchedCards\.length === 0\) \{\s*const q = query\([\s\S]*?fetchedCards\.sort[\s\S]*?\}/m;
code = code.replace(fetchCardsMatch, '');

// 2. Remove Firestore updateDoc in handleGrade (around line 395)
const gradeMatch = /\/\/ 2\. Backup in Firestore\s*updateDoc\(doc\(db, 'users', uid, 'flashcards', cardId\), \{[\s\S]*?\}\)\.catch\(error => \{\s*console\.error\("Error updating flashcard:", error\);\s*\}\);/m;
code = code.replace(gradeMatch, '');

// 3. Remove Firestore setDoc in processImport (batch backup)
const importMatch = /\/\/ 2\. Firestore Backup\s*const promises = preparedCards\.map\(\(cardItem\) => \{[\s\S]*?await Promise\.all\(promises\);/m;
code = code.replace(importMatch, '');

// 4. Remove Firestore batch backup in saveDeckEdit
const editDeckMatch = /\/\/ 2\. Firestore batch backup\s*let batch = writeBatch\(db\);[\s\S]*?if \(count > 0 && count % 500 !== 0\) \{\s*await batch\.commit\(\);\s*\}/m;
code = code.replace(editDeckMatch, '');

// 5. Remove Firestore backup in saveCardEdit
const editCardMatch = /\/\/ 2\. Firestore backup\s*const docRef = doc\(db, 'users', auth\.currentUser\.uid, 'flashcards', card\.id\);\s*await updateDoc\(docRef, \{[\s\S]*?\}\);/m;
code = code.replace(editCardMatch, '');

// 6. Remove Firestore batch delete in deleteDeck
const deleteDeckMatch = /\/\/ 2\. Firestore batch delete\s*const cardsToDelete = allCards\.filter[\s\S]*?if \(count > 0 && count % 500 !== 0\) \{\s*await batch\.commit\(\);\s*\}/m;
code = code.replace(deleteDeckMatch, '');

// 7. Remove Firestore delete in processDeleteCard
const deleteCardMatch = /\/\/ 2\. Firestore delete\s*await deleteDoc\(doc\(db, 'users', auth\.currentUser\.uid, 'flashcards', cardId\)\);/m;
code = code.replace(deleteCardMatch, '');

fs.writeFileSync('src/components/FlashcardsRoom.tsx', code);
