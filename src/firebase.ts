import { initializeApp } from 'firebase/app';

import {
  getAuth,
  initializeAuth,
  browserLocalPersistence
} from 'firebase/auth';

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

const isNativeBuild = import.meta.env.MODE === 'native';

// Web Piper keeps its existing Firebase Auth initialization.
// Native Piper gets only the persistence dependency that
// email/password authentication actually needs.
export const auth = isNativeBuild
  ? initializeAuth(app, {
      persistence: browserLocalPersistence
    })
  : getAuth(app);

// Web Piper keeps its existing multi-tab Firestore cache.
// Native Piper uses a persistent single-WebView cache.
export const db = initializeFirestore(app, {
  localCache: isNativeBuild
    ? persistentLocalCache()
    : persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
  experimentalAutoDetectLongPolling: true
});
