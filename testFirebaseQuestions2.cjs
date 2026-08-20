const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "ai-studio-79b25bbf-15f2-48a2-985b-898266548ba6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const snap = await getDocs(collection(db, 'questionBank'));
    console.log(`Found ${snap.docs.length} questions in questionBank`);
    if (snap.docs.length > 0) {
      console.log('Sample:', snap.docs[0].id, snap.docs[0].data());
    }
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
