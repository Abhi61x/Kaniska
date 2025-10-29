// Using Firebase v9 compat libraries to allow for the older v8 database syntax (e.g., db.ref()) with the v10+ SDK loaded in index.html.
import firebase from "firebase/compat/app";
import "firebase/compat/database";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNhEByxDJ_pNK0Vd2TJVhsYvj_6jBewmg",
  authDomain: "jarvis-dashboard-60b7c.firebaseapp.com",
  databaseURL: "https://jarvis-dashboard-60b7c-default-rtdb.firebaseio.com",
  projectId: "jarvis-dashboard-60b7c",
  storageBucket: "jarvis-dashboard-60b7c.appspot.com",
  messagingSenderId: "1050277696511",
  appId: "1:1050277696511:web:68dbfd43467f198d280dca",
  measurementId: "G-D8PM6Y1EV5"
};

// Initialize Firebase
// Use Firebase v9 compat syntax for initialization, preventing re-initialization.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Use Firebase v9 compat syntax to get database instance.
export const db = firebase.database();
