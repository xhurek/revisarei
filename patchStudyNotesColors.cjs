const fs = require('fs');
let code = fs.readFileSync('src/components/StudyNotesSection.tsx', 'utf-8');

// replace getDoc for colors
const getDocMatch = /\/\/ Fetch folder colors from Firestore \(or Supabase user profile\)[\s\S]*?\}\);/m;
const getDocRepl = `// Fetch folder colors from Supabase user profile
    supabase.from('users').select('folder_colors').eq('id', uid).single().then(({ data, error }) => {
      if (!error && data && data.folder_colors) {
        setFolderColors(data.folder_colors);
      }
    });`;
code = code.replace(getDocMatch, getDocRepl);

// replace setDoc for colors update 1
const setDocMatch1 = /await setDoc\(doc\(db, 'users', auth\.currentUser\.uid\), \{ folderColors: newColors \}, \{ merge: true \}\);/g;
const setDocRepl1 = `await supabase.from('users').update({ folder_colors: newColors }).eq('id', auth.currentUser.uid);`;
code = code.replace(setDocMatch1, setDocRepl1);

// replace userDoc fetching for author info
const userDocMatch = /const userDoc = await getDoc\(doc\(db, 'users', auth\.currentUser\.uid\)\);\s*const userData = userDoc\.exists\(\) \? userDoc\.data\(\) : \{\};/m;
const userDocRepl = `const { data: supaUserData } = await supabase.from('users').select('*').eq('id', auth.currentUser.uid).single();
      const userData = supaUserData || {};`;
code = code.replace(userDocMatch, userDocRepl);

fs.writeFileSync('src/components/StudyNotesSection.tsx', code);
