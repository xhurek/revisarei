import re

with open('src/components/QuizzesView.tsx', 'r') as f:
    qv = f.read()

# Update import statement
qv = qv.replace(
    "import { collection, query, where, getDocs, orderBy, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';",
    "import { collection, query, where, getDocs, orderBy, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';"
)

# Replace useEffect dynamic import
effect_orig = """  useEffect(() => {
    import('firebase/firestore').then(({ collection, onSnapshot, getDocs }) => {
      const qTags = collection(db, 'bankTags');
      const unsubTags = onSnapshot(qTags, (snap) => {
        if (!snap.empty) {
          const loadedTags = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          loadedTags.sort((a, b) => a.name.localeCompare(b.name));
          setAvailableTags(loadedTags);
        }
      });
      
      getDocs(collection(db, 'questionBank')).then(snap => {
        setBankQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      return () => unsubTags();
    });
  }, []);"""

effect_new = """  useEffect(() => {
    const qTags = collection(db, 'bankTags');
    const unsubTags = onSnapshot(qTags, (snap) => {
      if (!snap.empty) {
        const loadedTags = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        loadedTags.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableTags(loadedTags);
      }
    });
    
    getDocs(collection(db, 'questionBank')).then(snap => {
      setBankQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubTags();
  }, []);"""
qv = qv.replace(effect_orig, effect_new)

# Replace save dynamic import
save_orig = """                   const { addDoc, collection } = await import('firebase/firestore');
                   const docRef = await addDoc(collection(db, 'quizzes'), quizData);"""
save_new = """                   const docRef = await addDoc(collection(db, 'quizzes'), quizData);"""
qv = qv.replace(save_orig, save_new)

# User says: Retire essa div, coloque tudo na mesma cor da div do processar lote de questões
# which has: "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
# Currently in QuizzesView it's:
div_orig = '<div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200">'
div_new = '<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">'
qv = qv.replace(div_orig, div_new)

with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)
