// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
  apiKey: "AIzaSyBjxyD3nHMK3BUvQG4MIH_lSAu1dbSkWvc",
  authDomain: "frontdesk-demo.firebaseapp.com",
  projectId: "frontdesk-demo",
  storageBucket: "frontdesk-demo.firebasestorage.app",
  messagingSenderId: "197627643423",
  appId: "1:197627643423:web:2037f03209ebadbbf5b72a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
