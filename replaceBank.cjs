const fs = require('fs');

let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

// fetchAdminQuestions: remove the fallback to firebase
const fetchAdminQuestionsStart = code.indexOf('const fetchAdminQuestions = async');
const fetchAdminQuestionsEnd = code.indexOf('const fetchQuestions = () => {');

let fetchAdminCode = code.substring(fetchAdminQuestionsStart, fetchAdminQuestionsEnd);

fetchAdminCode = fetchAdminCode.replace(/} else \{\s+if \(\!isLoadMore\).*?(?=setLoading\(false\);)/s, '}');
code = code.substring(0, fetchAdminQuestionsStart) + fetchAdminCode + code.substring(fetchAdminQuestionsEnd);

// handleUserSearch: remove the fallback to firebase
const handleUserSearchStart = code.indexOf('const handleUserSearch = async');
const handleFixAllLigaturesStart = code.indexOf('const [isFixingLigatures');

let handleUserSearchCode = code.substring(handleUserSearchStart, handleFixAllLigaturesStart);
handleUserSearchCode = handleUserSearchCode.replace(/if \(\!usedSupabase\).*?(?=\} catch \(err: any\))/s, '');
code = code.substring(0, handleUserSearchStart) + handleUserSearchCode + code.substring(handleFixAllLigaturesStart);

// handleFixAllLigatures: switch to Supabase
// wait, we can just replace the Firebase loop with a Supabase loop
const handleFixStart = code.indexOf('const handleFixAllLigatures');
const toggleRevealStart = code.indexOf('const toggleReveal');

let fixCode = code.substring(handleFixStart, toggleRevealStart);
fixCode = fixCode.replace(/const snap = await getDocs\(collection\(db, 'questionBank'\)\);.*?for \(const docSnap of snap\.docs\) \{.*?const q = \{ id: docSnap\.id, \.\.\.docSnap\.data\(\) \} as BankQuestion;/s, 
`const { data: snap } = await supabase.from('question_bank').select('*');
      if (!snap) return;
      for (const docSnap of snap) {
        const q = { id: docSnap.id, ...docSnap, correctAnswer: docSnap.correct_answer, mainTag: docSnap.main_tag } as any;`);
fixCode = fixCode.replace(/await updateDoc\(doc\(db, 'questionBank', q\.id\!\), updateObj\);/g, 
`await supabase.from('question_bank').update(updateObj).eq('id', q.id!);`);
code = code.substring(0, handleFixStart) + fixCode + code.substring(toggleRevealStart);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
