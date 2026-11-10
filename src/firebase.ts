// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBDeGcBqs0-0ZEIWY77NYC7DotyrAQCq6Y",
  authDomain: "piper-app-4e58f.firebaseapp.com",
  projectId: "piper-app-4e58f",
  storageBucket: "piper-app-4e58f.firebasestorage.app",
  messagingSenderId: "274690521000",
  appId: "1:274690521000:web:152cd8297529e6cec14f9d",
  measurementId: "G-5VYSJP8WYM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
