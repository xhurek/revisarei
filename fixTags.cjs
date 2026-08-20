const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/const docRef = await supabase.from\('bank_tags'\)\.insert\(\[\{\s*name: newTagName\.trim\(\),\s*subtags: \[\]\s*\}\]\)\.select\(\);\s*const docRef = \{ id: 'new-tag' \}; \/\/ Need to fix this manually/g, 
`const { data: tagData, error: tagErr } = await supabase.from('bank_tags').insert([{ name: newTagName.trim(), subtags: [] }]).select();
      if (tagErr) throw tagErr;
      const docRef = { id: tagData[0].id };`);

// For update tags:
code = code.replace(/await updateDoc\(doc\(db, 'bankTags', id\), \{\s*name: newName\.trim\(\)\s*\}\);/g, 
`await supabase.from('bank_tags').update({ name: newName.trim() }).eq('id', id);`);

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', tagId\), \{\s*subtags: currentTag\.subtags\.filter\(\(s: string\) => s !== subtag\)\s*\}\);/g, 
`await supabase.from('bank_tags').update({ subtags: currentTag.subtags.filter((s: string) => s !== subtag) }).eq('id', tagId);`);

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', tagId\), \{\s*subtags: \[\.\.\.currentTag\.subtags, newSubtag\.trim\(\)\]\s*\}\);/g, 
`await supabase.from('bank_tags').update({ subtags: [...currentTag.subtags, newSubtag.trim()] }).eq('id', tagId);`);

code = code.replace(/await deleteDoc\(doc\(db, 'bankTags', id\)\);/g, 
`await supabase.from('bank_tags').delete().eq('id', id);`);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
