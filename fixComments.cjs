const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf-8');

code = code.replace(/const q = query\(\s*collection\(db, 'comments'\),\s*where\('questionId', '==', selectedQuestionForComments.id\)\s*\);\s*const snapshot = await getDocs\(q\);\s*const fetched = snapshot.docs.map\(d => \(\{ \.\.\.d.data\(\), id: d.id \}\)\);/g, 
`const { data: cData } = await supabase.from('comments').select('*').eq('question_id', selectedQuestionForComments.id);
          const fetched = (cData || []).map((d: any) => ({ 
            id: d.id, 
            quizId: d.quiz_id, 
            questionId: d.question_id, 
            quizTitle: d.quiz_title, 
            text: d.text, 
            userId: d.user_id, 
            userName: d.user_name, 
            userPhoto: d.user_photo, 
            userTitle: d.user_title, 
            likes: d.likes || [], 
            createdAt: d.created_at 
          }));`);

code = code.replace(/const docRef = await addDoc\(collection\(db, 'comments'\), commentData\);/g, 
`const { data: inserted } = await supabase.from('comments').insert([{
        quiz_id: commentData.quizId,
        question_id: commentData.questionId,
        quiz_title: commentData.quizTitle,
        text: commentData.text,
        user_id: commentData.userId,
        user_name: commentData.userName,
        user_photo: commentData.userPhoto,
        user_title: commentData.userTitle,
        likes: commentData.likes,
        created_at: commentData.createdAt
      }]).select();
      const docRef = { id: inserted?.[0]?.id || 'unknown' };`);

// Update likes on comment
code = code.replace(/const commentRef = doc\(db, 'comments', commentId\);\s*if \(currentLikes.includes\(uid\)\) \{\s*await updateDoc\(commentRef, \{ likes: currentLikes.filter\(id => id !== uid\) \}\);\s*setComments\(comments.map\(c => c.id === commentId \? \{ \.\.\.c, likes: currentLikes.filter\(id => id !== uid\) \} : c\)\);\s*\} else \{\s*await updateDoc\(commentRef, \{ likes: \[\.\.\.currentLikes, uid\] \}\);\s*setComments\(comments.map\(c => c.id === commentId \? \{ \.\.\.c, likes: \[\.\.\.currentLikes, uid\] \} : c\)\);\s*\}/g,
`if (currentLikes.includes(uid)) {
        const newLikes = currentLikes.filter(id => id !== uid);
        await supabase.from('comments').update({ likes: newLikes }).eq('id', commentId);
        setComments(comments.map(c => c.id === commentId ? { ...c, likes: newLikes } : c));
      } else {
        const newLikes = [...currentLikes, uid];
        await supabase.from('comments').update({ likes: newLikes }).eq('id', commentId);
        setComments(comments.map(c => c.id === commentId ? { ...c, likes: newLikes } : c));
      }`);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
