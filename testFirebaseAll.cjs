const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, signInWithEmailAndPassword, getAuth } = require('firebase/firestore');
// Actually, I can't sign in without password.
// But wait! Is there a way to bypass it locally? No.
