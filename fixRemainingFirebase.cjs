const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/getDocs\(collection\(db, 'questionBank'\)\).then\(snap => \{/g, 
`supabase.from('question_bank').select('*').limit(100).then(({ data: snap }) => {
        if (!snap) return;`);

code = code.replace(/const list = snap.docs.map\(doc => \(\{ id: doc.id, \.\.\.doc.data\(\) \} as BankQuestion\)\);/g, 
`const list = snap.map((doc: any) => ({ id: doc.id, ...doc, correctAnswer: doc.correct_answer, mainTag: doc.main_tag } as any));`);

code = code.replace(/getCountFromServer\(collection\(db, 'questionBank'\)\).then\(snap => \{/g, 
`supabase.from('question_bank').select('*', { count: 'exact', head: true }).then(snap => {`);

code = code.replace(/setTotalQuestionsCount\(snap.data\(\).count\);/g, 
`setTotalQuestionsCount(snap.count);`);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
