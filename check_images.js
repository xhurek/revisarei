import { initializeApp } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const q = query(collectionGroup(db, 'flashcards'), limit(20));
    const querySnapshot = await getDocs(q);
    let output = '';
    output += `Total cards: ${querySnapshot.size}\n`;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      output += `\n--- Card ID: ${doc.id} (Tag: ${data.tag}) ---\n`;
      output += `Question has img: ${data.question?.includes('<img')}\n`;
      output += `Answer has img: ${data.answer?.includes('<img')}\n`;
      
      const qImgs = [];
      const aImgs = [];
      
      if (data.question) {
        const matches = data.question.match(/<img[^>]+src="([^"]+)"/gi);
        if (matches) {
          matches.forEach(m => {
            const srcMatch = m.match(/src="([^"]+)"/i);
            if (srcMatch) qImgs.push(srcMatch[1]);
          });
        }
      }
      if (data.answer) {
        const matches = data.answer.match(/<img[^>]+src="([^"]+)"/gi);
        if (matches) {
          matches.forEach(m => {
            const srcMatch = m.match(/src="([^"]+)"/i);
            if (srcMatch) aImgs.push(srcMatch[1]);
          });
        }
      }
      
      output += `Question image srcs: ${JSON.stringify(qImgs.map(s => s.slice(0, 100) + '...'))}\n`;
      output += `Answer image srcs: ${JSON.stringify(aImgs.map(s => s.slice(0, 100) + '...'))}\n`;
    });
    fs.writeFileSync('images_output.txt', output);
    console.log("Written output to images_output.txt");
  } catch (err) {
    fs.writeFileSync('images_output.txt', err.toString());
  }
}

run();
