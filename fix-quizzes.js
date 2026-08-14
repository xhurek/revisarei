import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
initializeApp({ projectId: config.projectId });
const db = getFirestore(config.firestoreDatabaseId);
db.settings({ ignoreUndefinedProperties: true });

async function fix() {
  const quizzesSnap = await db.collection("quizzes").get();
  let updatedCount = 0;

  for (const doc of quizzesSnap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const newQuestions = (data.questions || []).map(q => {
      let correct = q.correctAnswer;
      if (!correct && q.answer) {
        correct = q.answer;
        needsUpdate = true;
      }
      if (q.correctAnswer !== (correct || '')) {
         needsUpdate = true;
      }
      return { ...q, correctAnswer: correct || '' };
    });

    if (needsUpdate) {
      await doc.ref.update({ questions: newQuestions });
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} quizzes.`);
}

fix().then(() => process.exit(0)).catch(console.error);
