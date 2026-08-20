const fs = require('fs');
let code = fs.readFileSync('src/components/StudyNotesSection.tsx', 'utf-8');

// Replace the useEffect
code = code.replace(/useEffect\(\(\) => \{[\s\S]*?return \(\) => unsubscribe\(\);\s*\}, \[\]\);/m, 
`useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    // Fetch folder colors from Firestore (or Supabase user profile)
    getDoc(doc(db, 'users', uid)).then(docSnap => {
      if (docSnap.exists() && docSnap.data().folderColors) {
        setFolderColors(docSnap.data().folderColors);
      }
    });

    // Try loading from Supabase first
    loadNotesFromSupabase(uid).then((success) => {
      // Fallback to Firestore only if Supabase fails or is empty AND we haven't loaded yet
      if (!success) {
        getDocs(query(collection(db, \`users/\${uid}/studyNotes\`), orderBy('createdAt', 'desc'))).then(snapshot => {
          const notesData: StudyNote[] = [];
          snapshot.forEach((doc) => {
            notesData.push({ id: doc.id, ...doc.data() } as StudyNote);
          });
          setNotes(notesData);
          setLoading(false);
        }).catch(err => {
          console.error("Error fetching study notes from Firestore:", err);
          setLoading(false);
        });
      }
    });
  }, []);`);

fs.writeFileSync('src/components/StudyNotesSection.tsx', code);
