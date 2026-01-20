// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';
// @ts-ignore
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCBTHcih-7WjW72rA_AiLGSRVBCoohGV-4",
  authDomain: "kaniska-f827d.firebaseapp.com",
  databaseURL: "https://kaniska-f827d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kaniska-f827d",
  storageBucket: "kaniska-f827d.firebasestorage.app",
  messagingSenderId: "283233457469",
  appId: "1:283233457469:web:fa03e4aa52385552b6e154",
  measurementId: "G-DGLQPHJF9C"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);
