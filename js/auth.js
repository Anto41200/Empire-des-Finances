import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Références DOM
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const regEmail = document.getElementById("register-email");
const regPassword = document.getElementById("register-password");
const regConfirm = document.getElementById("register-confirm");

// Register
registerBtn.addEventListener('click', async () => {
  try {
    if(regPassword.value !== regConfirm.value) return alert("Mots de passe différents !");
    const cred = await createUserWithEmailAndPassword(auth, regEmail.value, regPassword.value);
    await setDoc(doc(db, 'users', cred.user.uid), {
      capital: 10000,
      liquidites: 5000,
      revenus: 50,
      biens: 0,
      chateau: 1,
      entreprises: []
    });
    window.location.href = "dashboard.html";
  } catch(e){ alert(e.message); }
});

// Login
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
    window.location.href = "dashboard.html";
  } catch(e){ alert(e.message); }
});
