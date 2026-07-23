import { initializeApp } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("Database ID:", firebaseConfig.firestoreDatabaseId);
  try {
    console.log("Querying flashcards...");
    const q = query(collectionGroup(db, 'flashcards'), limit(5));
    const querySnapshot = await getDocs(q);
    console.log("Total cards found:", querySnapshot.size);
    querySnapshot.forEach((doc) => {
      console.log(`\n--- Card ID: ${doc.id} (Tag: ${doc.data().tag}) ---`);
      console.log("Question (first 200 chars):", doc.data().question?.slice(0, 200));
      console.log("Answer (first 200 chars):", doc.data().answer?.slice(0, 200));
      console.log("Has img tag in Question?:", doc.data().question?.includes('<img'));
      console.log("Has img tag in Answer?:", doc.data().answer?.includes('<img'));
      if (doc.data().question?.includes('<img')) {
         const match = doc.data().question.match(/<img[^>]+src="([^"]+)"/);
         console.log("Question img src (first 100):", match ? match[1].slice(0, 100) : "not found");
      }
      if (doc.data().answer?.includes('<img')) {
         const match = doc.data().answer.match(/<img[^>]+src="([^"]+)"/);
         console.log("Answer img src (first 100):", match ? match[1].slice(0, 100) : "not found");
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
