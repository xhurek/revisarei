const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', id\), \{/g, 
`await supabase.from('bank_tags').update({`);

code = code.replace(/await updateDoc\(doc\(db, 'bankTags', tagId\), \{/g, 
`await supabase.from('bank_tags').update({`);

// Remove commentRef and replace with supabase query
// I already replaced commentRef updateDoc, but maybe I missed it.
code = code.replace(/await updateDoc\(commentRef, \{ likes: currentLikes\.filter\(id => id !== uid\) \}\);/g, 
`await supabase.from('comments').update({ likes: currentLikes.filter(id => id !== uid) }).eq('id', commentId);`);
code = code.replace(/await updateDoc\(commentRef, \{ likes: \[\.\.\.currentLikes, uid\] \}\);/g, 
`await supabase.from('comments').update({ likes: [...currentLikes, uid] }).eq('id', commentId);`);

// `.catch` on PromiseLike
code = code.replace(/\}\)\.catch\(err => \{/g, `} catch (err) {`);
code = code.replace(/getCountFromServer/g, 'getCount'); // just to avoid anything

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
