// AUTH.JS — Gestion complète de l'inscription & connexion
// Stockage local + sécurité basique + redirection

// === Vérifie si un utilisateur est déjà connecté ===
function checkLogged() {
  const user = localStorage.getItem("edf_user");
  if (user) {
    window.location.href = "dashboard.html";
  }
}
checkLogged();

// === Récupération des éléments UI ===
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");

const regEmail = document.getElementById("register-email");
const regPassword = document.getElementById("register-password");
const regConfirm = document.getElementById("register-confirm");

// === Création de compte ===
registerBtn.addEventListener("click", () => {
  const email = regEmail.value.trim();
  const pass = regPassword.value.trim();
  const confirm = regConfirm.value.trim();

  if (!email || !pass || !confirm) {
    alert("Remplis tous les champs !");
    return;
  }

  if (pass !== confirm) {
    alert("Les mots de passe ne correspondent pas !");
    return;
  }

  if (localStorage.getItem("edf_user")) {
    alert("Un compte existe déjà sur cet appareil !");
    return;
  }

  const user = {
    email,
    password: pass,
    capital: 10000,
    liquidites: 5000,
    revenus: 50,
    biens: 0,
    chateau: 1
  };

  localStorage.setItem("edf_user", JSON.stringify(user));
  alert("Compte créé avec succès !");
  window.location.href = "dashboard.html";
});

// === Connexion ===
loginBtn.addEventListener("click", () => {
  const email = loginEmail.value.trim();
  const pass = loginPassword.value.trim();

  if (!email || !pass) {
    alert("Remplis tous les champs !");
    return;
  }

  const saved = JSON.parse(localStorage.getItem("edf_user"));

  if (!saved) {
    alert("Aucun compte trouvé !");
    return;
  }

  if (saved.email === email && saved.password === pass) {
    alert("Connexion réussie !");
    window.location.href = "dashboard.html";
  } else {
    alert("Email ou mot de passe incorrect.");
  }
});
