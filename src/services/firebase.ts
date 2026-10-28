import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Default config fallback matching the Oikonomos project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForDevelopment12345678",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "oikonomos-84b69.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "oikonomos-84b69",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "oikonomos-84b69.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "297923978630",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:297923978630:web:8a7660f4c86a9f3666b807"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with ignoreUndefinedProperties to prevent WriteBatch.set / setDoc crashes on undefined fields
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

