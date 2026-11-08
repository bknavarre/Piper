import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBlu_flfohiNyKn1PL8jXqLlh7MCrWXwJA',
  authDomain: 'piper-app-4e58f.firebaseapp.com',
  projectId: 'piper-app-4e58f',
  storageBucket: 'piper-app-4e58f.firebasestorage.app',
  messagingSenderId: '274690521000',
  appId: '1:274690521000:web:f720b3b1338d4e2ac14f9d',
  measurementId: 'G-N3ZJN8Q0V9'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
