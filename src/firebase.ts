// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBlu_flfohiNyKn1PL8jXqLlh7MCrWXwJA",
  authDomain: "piper-app-4e58f.firebaseapp.com",
  projectId: "piper-app-4e58f",
  storageBucket: "piper-app-4e58f.firebasestorage.app",
  messagingSenderId: "274690521000",
  appId: "1:274690521000:web:f720b3b1338d4e2ac14f9d",
  measurementId: "G-N3ZJN8Q0V9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
