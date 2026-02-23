import { initializeApp } from "firebase/app";
import { getAuth, GithubAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = !!firebaseConfig.apiKey;

// Initialize Firebase only if configured to prevent fatal crashes
const app = isConfigured ? initializeApp(firebaseConfig) : null;

// Export null services if it fails to configure
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Auth Providers
export const githubProvider = new GithubAuthProvider();
// We can ask for specific scopes if needed later (e.g. repo level access)
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

export const googleProvider = new GoogleAuthProvider();
