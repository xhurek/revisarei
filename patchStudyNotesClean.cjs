const fs = require('fs');
let code = fs.readFileSync('src/components/StudyNotesSection.tsx', 'utf-8');

// 1. Remove firestore fallback in useEffect
const fallbackRegex = /\/\/ Fallback to Firestore only if Supabase fails[\s\S]*?\}\);/m;
code = code.replace(fallbackRegex, '');

// 2. Remove firestore delete in handleDeleteFolder
const delFolderRegex = /\/\/ Delete in Firestore[\s\S]*?return deleteDoc\(doc\(db, `users\/\$\{auth\.currentUser\?\.uid\}\/studyNotes`, n\.id!\)\);\s*\}\)\);/m;
code = code.replace(delFolderRegex, '');

// 3. Remove firestore update in handleRenameFolder
const renFolderRegex = /\/\/ Update in Firestore[\s\S]*?return updateDoc\(doc\(db, `users\/\$\{auth\.currentUser\?\.uid\}\/studyNotes`, n\.id!\), \{ folder: editFolderName \}\);\s*\}\)\);/m;
code = code.replace(renFolderRegex, '');

// 4. Remove firestore insert in handleCreateNewNote
const createNoteRegex = /\/\/ 2\. Save to Firestore[\s\S]*?console\.warn\("Firestore insert note backup error:", fireErr\);\s*\}/m;
code = code.replace(createNoteRegex, '');

// 5. Remove firestore update in handleSaveNote
const saveNoteRegex = /\/\/ 2\. Update in Firestore[\s\S]*?catch \(e\) \{\}\s*\}/m;
code = code.replace(saveNoteRegex, '');

// 6. Remove firestore delete in handleDeleteNote
const deleteNoteRegex = /\/\/ 2\. Delete from Firestore[\s\S]*?await deleteDoc\(doc\(db, `users\/\$\{auth\.currentUser\?\.uid\}\/studyNotes`, note\.id\)\);/m;
code = code.replace(deleteNoteRegex, '');

// 7. Remove firestore insert in handleImport
const importNoteRegex = /\/\/ Save to Firestore[\s\S]*?console\.warn\("Firestore import note backup error:", fireErr\);\s*\}/m;
code = code.replace(importNoteRegex, '');

fs.writeFileSync('src/components/StudyNotesSection.tsx', code);
console.log('StudyNotesSection cleaned');
