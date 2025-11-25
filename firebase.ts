import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC2a8qp-FMXLydF89nhB0cXTJTFt_kegPg",
  authDomain: "ak-assistance-a313d.firebaseapp.com",
  databaseURL: "https://ak-assistance-a313d-default-rtdb.firebaseio.com",
  projectId: "ak-assistance-a313d",
  storageBucket: "ak-assistance-a313d.firebasestorage.app",
  messagingSenderId: "489673056611",
  appId: "1:489673056611:web:6e54ef3c6979db2a09b356",
  measurementId: "G-L8QEZZHXTE"
};

let app;
let auth = null;
let db = null;

// Enable Firebase if an API key is present.
// Basic validation to prevent crashing if the key is obviously placeholder or empty
const isKeyValid = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10;

if (isKeyValid) {
  try {
    // Check if firebase app is already initialized to avoid errors during hot reload
    if (getApps().length > 0) {
        app = getApp();
    } else {
        app = initializeApp(firebaseConfig);
    }
    
    // Initialize services
    if (app) {
        // Initialize Auth
        try {
            auth = getAuth(app);
        } catch (authError) {
            console.error("Firebase Auth initialization failed:", authError);
        }

        // Initialize Firestore
        try {
            db = getFirestore(app);
        } catch (dbError) {
            console.error("Firebase Firestore initialization failed:", dbError);
        }
    }
    
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase API key is missing or invalid. Auth and DB services are disabled.");
}

export { auth, db, app };