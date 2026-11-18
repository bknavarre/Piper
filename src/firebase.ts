import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBDeGcBqs0-0ZEIWY77NYC7DotyrAQCq6Y',
  authDomain: 'piper-app-4e58f.firebaseapp.com',
  projectId: 'piper-app-4e58f',
  storageBucket: 'piper-app-4e58f.firebasestorage.app',
  messagingSenderId: '274690521000',
  appId: '1:274690521000:web:152cd8297529e6cec14f9d'
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalAutoDetectLongPolling: true
});
