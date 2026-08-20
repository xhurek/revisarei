const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

// For user profiles:
code = code.replace(/getDoc\(doc\(db, 'users', auth.currentUser!\.uid\)\)\.then\(snap => \{/g, 
`supabase.from('users').select('*').eq('id', auth.currentUser!.uid).single().then(({ data: snap }) => {`);

code = code.replace(/getDoc\(doc\(db, 'users', auth.currentUser\.uid\)\)\.then\(snap => \{/g, 
`supabase.from('users').select('*').eq('id', auth.currentUser!.uid).single().then(({ data: snap }) => {`);

code = code.replace(/if \(snap.exists\(\)\)/g, `if (snap)`);
code = code.replace(/snap.data\(\)/g, `snap`);

code = code.replace(/await updateDoc\(doc\(db, 'questionBank', q.id!\), \{ \.\.\.updatedQ \}\);/g, 
`await supabase.from('question_bank').update(updatedQ).eq('id', q.id!);`);

code = code.replace(/await updateDoc\(doc\(db, 'questionBank', q.id!\), \{ \.\.\.sanitized \}\);/g, 
`await supabase.from('question_bank').update(sanitized).eq('id', q.id!);`);

// And for tags, it looks like it missed some updateDocs because they had single-line matching. Let's do it globally.
code = code.replace(/await updateDoc\(doc\(db, 'bankTags', id\), \{\s*name: newName\.trim\(\)\s*\}\);/g, 
`await supabase.from('bank_tags').update({ name: newName.trim() }).eq('id', id);`);

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', tagId\), \{\s*subtags: currentTag\.subtags\.filter\(\(s: string\) => s !== subtag\)\s*\}\);/g, 
`await supabase.from('bank_tags').update({ subtags: currentTag.subtags.filter((s: string) => s !== subtag) }).eq('id', tagId);`);

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', tagId\), \{\s*subtags: \[\.\.\.currentTag\.subtags, newSubtag\.trim\(\)\]\s*\}\);/g, 
`await supabase.from('bank_tags').update({ subtags: [...currentTag.subtags, newSubtag.trim()] }).eq('id', tagId);`);

// And remove commentRef
code = code.replace(/const commentRef = doc\(db, 'comments', commentId\);/g, '');


fs.writeFileSync('src/components/QuestionBankView.tsx', code);
