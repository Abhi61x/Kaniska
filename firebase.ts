import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB_npxvXYc39W7kFRLS3Fd61sTfivRhODA",
  authDomain: "abhi-dashboard.firebaseapp.com",
  databaseURL: "https://abhi-dashboard-default-rtdb.firebaseio.com",
  projectId: "abhi-dashboard",
  storageBucket: "abhi-dashboard.firebasestorage.app",
  messagingSenderId: "370999830866",
  appId: "1:370999830866:web:ce72f3e9835ac3cc84328b",
  measurementId: "G-NSP8P7BP1M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
