// Import des SDK Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBAuJkFTlYHoKyZiHiAAi-VxcNpZ-FAA9k",
  authDomain: "empire-des-finances.firebaseapp.com",
  projectId: "empire-des-finances",
  storageBucket: "empire-des-finances.firebasestorage.app",
  messagingSenderId: "276513960656",
  appId: "1:276513960656:web:b4440b88b797a4a6fa64d5",
  measurementId: "G-2FFFNKS95D"
};

// Initialisation Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
