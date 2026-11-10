import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBDeGcBqs0-0ZEIWY77NYC7DotyrAQCq6Y",
  authDomain: "YOUR_EXISTING_AUTH_DOMAIN",
  projectId: "YOUR_EXISTING_PROJECT_ID",
  storageBucket: "YOUR_EXISTING_STORAGE_BUCKET",
  messagingSenderId: "YOUR_EXISTING_MESSAGING_SENDER_ID",
  appId: "YOUR_EXISTING_APP_ID"
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);
