const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

// handleSaveStaging
code = code.replace(/await updateDoc\(doc\(db, 'questionBank', newId\), docData\)\.catch\(\(\) => setDoc\(doc\(db, 'questionBank', newId\), docData\)\);/g, '');

// onDeleteStaging
code = code.replace(/await deleteDoc\(doc\(db, 'questionBank', q\.id\!\)\);/g, 
`await supabase.from('question_bank').delete().eq('id', q.id!);`);

// onUpdateStaging
code = code.replace(/await updateDoc\(doc\(db, 'questionBank', q\.id\!\), updateObj\);/g, 
`await supabase.from('question_bank').update(updateObj).eq('id', q.id!);`);

// update tags / bankTags
// For tags, let's replace all bankTags operations with supabase.from('bank_tags')
code = code.replace(/getDocs\(collection\(db, 'bankTags'\)\)/g, 
`supabase.from('bank_tags').select('*')`);
code = code.replace(/if \(!snap.empty\) \{/g, `if (snap.data && snap.data.length > 0) {`);
code = code.replace(/snap.docs.map\(doc => \(\{ id: doc.id, \.\.\.doc.data\(\) \} as BankTagItem\)\)/g, 
`snap.data.map((doc: any) => ({ id: doc.id, ...doc }) as BankTagItem)`);

code = code.replace(/await addDoc\(collection\(db, 'bankTags'\), \{(.*?)\}\);/gs, 
`await supabase.from('bank_tags').insert([{$1}]).select();
      const docRef = { id: 'new-tag' }; // Need to fix this manually`);

// Let's write the file back and manually check the bankTags logic
fs.writeFileSync('src/components/QuestionBankView.tsx', code);
