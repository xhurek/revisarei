const fs = require('fs');
let code = fs.readFileSync('src/components/QuizzesView.tsx', 'utf-8');

// 1. In fetchQuizzes, remove the fallback to Firestore
// Around line 175
const fetchQuizzesMatch = /if \(memoryCachedQuizzes\[uid\]\) \{[\s\S]*?\} finally \{/m;
const fetchQuizzesReplacement = `if (memoryCachedQuizzes[uid]) {
        setQuizzes(memoryCachedQuizzes[uid]);
      } else {
        const { data, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        if (error) {
          console.warn("Supabase fetch quizzes error:", error);
        } else if (data) {
          const loadedQuizzes = data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description || '',
            subject: row.subject || '',
            tag: row.theme || row.discipline || '',
            mainTag: row.discipline || row.theme || '',
            subtags: Array.isArray(row.tags) ? row.tags : [],
            questions: row.questions || [],
            isPublic: !!row.is_public,
            authorName: row.author_name || 'Estudante',
            authorPhoto: row.author_photo || '',
            authorTitle: row.author_title || '',
            progress: row.progress || undefined,
            knowledgeBase: row.knowledge_base || [],
            createdAt: row.created_at
          } as Quiz));
          memoryCachedQuizzes[uid] = loadedQuizzes;
          setQuizzes(loadedQuizzes);
        }
      }
    } catch (err) {
      console.error("Error in fetchQuizzes", err);
    } finally {`;
code = code.replace(fetchQuizzesMatch, fetchQuizzesReplacement);

// 2. In handleSaveEdit, remove Firestore updateDoc
code = code.replace(/\/\/ 2\. Update in Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore update quiz error:", fireErr\);\s*\}/m, '');

// 3. In handleRenameFolder, remove Firestore updatePromises
code = code.replace(/const updatePromises = qsToUpdate\.map\(q => updateDoc[\s\S]*?await Promise\.all\(updatePromises\);/m, '');

// 4. In handleDeleteFolder, remove Firestore deletePromises
code = code.replace(/const deletePromises = qsToDelete\.map\([\s\S]*?await Promise\.all\(deletePromises\);/m, '');

// 5. In handleCreateQuiz (create quiz from modal), remove Firestore setDoc
code = code.replace(/\/\/ 2\. Save to Firestore[\s\S]*?\}\s*catch \(err\) \{\s*console\.warn\("Firestore backup quiz error:", err\);\s*\}/m, '');

// 6. In handleImport, remove Firestore setDoc
code = code.replace(/\/\/ 2\. Save to Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore import quiz error:", fireErr\);\s*\}/m, '');

// 7. In upload-context handler, remove Firestore updateDoc
code = code.replace(/\/\/ Update Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore update knowledge error:", fireErr\);\s*\}/m, '');

// 8. In removeKnowledgeFile, remove Firestore updateDoc
code = code.replace(/await updateDoc\(doc\(db, 'quizzes', quiz\.id\), \{[\s\S]*?knowledgeBase: newKB[\s\S]*?\}\);/m, '');

// 9. In handleDeleteQuiz, remove Firestore deleteDoc
code = code.replace(/\/\/ 2\. Delete from Firestore[\s\S]*?\}\s*catch \(fireErr\) \{\s*console\.warn\("Firestore delete quiz error:", fireErr\);\s*\}/m, '');

fs.writeFileSync('src/components/QuizzesView.tsx', code);
