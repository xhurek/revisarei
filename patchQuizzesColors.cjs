const fs = require('fs');
let code = fs.readFileSync('src/components/QuizzesView.tsx', 'utf-8');

// replace getDoc userRef
const userRefMatch = /const userRef = doc\(db, 'users', uid\);\s*const userDoc = await getDoc\(userRef\);\s*if \(userDoc\.exists\(\) && userDoc\.data\(\)\.folderColors\) \{\s*setFolderColors\(userDoc\.data\(\)\.folderColors\);\s*\}/m;
const userRefRepl = `const { data: supaUser } = await supabase.from('users').select('folder_colors').eq('id', uid).single();
      if (supaUser && supaUser.folder_colors) {
         setFolderColors(supaUser.folder_colors);
      }`;
code = code.replace(userRefMatch, userRefRepl);

// replace setDoc folder colors
const setDocMatch = /await setDoc\(doc\(db, 'users', auth\.currentUser\.uid\), \{ folderColors: newColors \}, \{ merge: true \}\);/m;
const setDocRepl = `await supabase.from('users').update({ folder_colors: newColors }).eq('id', auth.currentUser.uid);`;
code = code.replace(setDocMatch, setDocRepl);

// replace userDoc fetching for author info
const userDocMatch = /const userDoc = await getDoc\(doc\(db, 'users', auth\.currentUser\.uid\)\);\s*const userData = userDoc\.exists\(\) \? userDoc\.data\(\) : \{\};/g;
const userDocRepl = `const { data: supaUserData } = await supabase.from('users').select('*').eq('id', auth.currentUser.uid).single();\nconst userData = supaUserData || {};`;
code = code.replace(userDocMatch, userDocRepl);

fs.writeFileSync('src/components/QuizzesView.tsx', code);
