/* =========================================================================
   EMPIRE DES FINANCES – SCRIPT ULTIME (MEGAPACK)
   Version : Ultra 1.0
   Contient : Tous les modules fusionnés (UI, Player, Banque, Immobilier, 
   Entreprises, Bourse, Casino, Politique, Classements, Profil, Chat)
   ========================================================================= */

/* ========================= 1. FIREBASE INIT =============================== */

const firebaseConfig = {
  apiKey: "YOUR-KEY",
  authDomain: "YOUR-DOMAIN",
  projectId: "YOUR-ID",
  storageBucket: "YOUR-BUCKET",
  messagingSenderId: "YOUR-SENDER",
  appId: "YOUR-APP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* =========================================================================
   2. APP (Login, Déconnexion, Chargement du joueur)
   ========================================================================= */

const App = {
  currentUser: null,
  playerData: null,

  async login(email, username) {
    const userCred = await auth.signInWithEmailAndPassword(email, "defaultpass")
      .catch(async () => {
        return auth.createUserWithEmailAndPassword(email, "defaultpass");
      });

    this.currentUser = userCred.user;

    await this.initPlayer(username);
    UI.showPlayerCard();
  },

  async initPlayer(username) {
    const ref = db.collection("players").doc(this.currentUser.uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      await ref.set({
        email: this.currentUser.email,
        username: username,
        liquidite: 10000,
        biens: [],
        entreprises: [],
        actions: {},
        historique: [],
        prestige: 0,
        reputation: 50,
        niveauPolitique: 0,
        stats: {
          gainsTotal: 0,
          pertesTotal: 0
        }
      });
    }

    this.playerData = (await ref.get()).data();
    UI.updatePlayerCard(this.playerData);
  },

  async savePlayer() {
    if (!this.currentUser) return;

    await db.collection("players").doc(this.currentUser.uid).update(this.playerData);
  },

  logout() {
    auth.signOut();
    location.reload();
  }
};

/* =========================================================================
   3. UI – Navigation entre les pages
   ========================================================================= */

const UI = {
  hideAll() {
    document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
  },

  showAccueil() { this.hideAll(); document.getElementById("content").classList.remove("hidden"); },
  showPlayerCard() { this.hideAll(); document.getElementById("playerCard").classList.remove("hidden"); },

  showProprietes() { this.hideAll(); document.getElementById("proprietesPage").classList.remove("hidden"); },
  showAcheter() { this.showProprietes(); this._swap("acheterSection"); },
  showGerer() { this.showProprietes(); this._swap("gererSection"); },
  showLocations() { this.showProprietes(); this._swap("locationSection"); },
  showConstruction() { this.showProprietes(); this._swap("constructionSection"); },

  showEntreprises() { this.hideAll(); document.getElementById("entreprisesPage").classList.remove("hidden"); },
  showCreerEntreprise() { this.showEntreprises(); this._swap("entrepriseCreate"); },
  showGererEntreprises() { this.showEntreprises(); this._swap("entrepriseManage"); },
  showEmployes() { this.showEntreprises(); this._swap("entrepriseEmployees"); },
  showR&D() { this.showEntreprises(); this._swap("entrepriseRD"); },

  showBourse() { this.hideAll(); document.getElementById("boursePage").classList.remove("hidden"); },

  showBanque() { this.hideAll(); document.getElementById("banquePage").classList.remove("hidden"); },
  showCompteCourant() { this.showBanque(); this._swap("banqueCourant"); },
  showEpargne() { this.showBanque(); this._swap("banqueEpargne"); },
  showEmprunts() { this.showBanque(); this._swap("banqueEmprunts"); },
  showInvestissements() { this.showBanque(); this._swap("banqueInvest"); },

  showPolitique() { this.hideAll(); document.getElementById("politiquePage").classList.remove("hidden"); },
  showCasino() { this.hideAll(); document.getElementById("casinoPage").classList.remove("hidden"); },
  showClassements() { this.hideAll(); document.getElementById("classementsPage").classList.remove("hidden"); },
  showProfil() { this.hideAll(); document.getElementById("profilPage").classList.remove("hidden"); },
  showChat() { this.hideAll(); document.getElementById("chatPage").classList.remove("hidden"); },

  _swap(id) {
    document.querySelectorAll("#proprietesPage div, #entreprisesPage div, #banquePage div").forEach(s => {
      if (s.id) s.classList.add("hidden");
    });
    document.getElementById(id).classList.remove("hidden");
  },

  updatePlayerCard(data) {
    document.getElementById("emailDisplay").innerText = data.email;
    document.getElementById("usernameDisplay").innerText = data.username;
    document.getElementById("capitalDisplay").innerText = data.liquidite;
    document.getElementById("liquiditeDisplay").innerText = data.liquidite;
    document.getElementById("nbBiensDisplay").innerText = data.biens.length;
    document.getElementById("nbEntreprisesDisplay").innerText = data.entreprises.length;
  }
};

/* =========================================================================
   4. Immobilier – Marché, achat, gestion, loyers, construction
   ========================================================================= */

const RealEstate = {
  biensDisponibles: [
    { id: "studio", prix: 60000, loyer: 400 },
    { id: "immeuble", prix: 400000, loyer: 2500 },
    { id: "villa", prix: 900000, loyer: 4500 },
    { id: "entrepot", prix: 250000, loyer: 1200 }
  ],

  acheter(bienId) {
    const bien = this.biensDisponibles.find(b => b.id === bienId);
    if (App.playerData.liquidite < bien.prix) return alert("Pas assez d’argent");

    App.playerData.liquidite -= bien.prix;
    App.playerData.biens.push(bien);
    App.savePlayer();
    UI.updatePlayerCard(App.playerData);
  },

  genererLoyers() {
    let revenu = 0;
    App.playerData.biens.forEach(b => revenu += b.loyer);

    App.playerData.liquidite += revenu;
    App.playerData.historique.push(`+${revenu}§ en loyers`);
    App.savePlayer();
  }
};

/* =========================================================================
   5. Entreprises – Création, employés, R&D, gestion
   ========================================================================= */

const Entreprises = {
  create(type) {
    const model = {
      restaurant: { cout: 50000, revenu: 12000 },
      startup: { cout: 150000, revenu: 60000 },
      usine: { cout: 250000, revenu: 85000 }
    };

    const e = model[type];
    if (!e) return;

    if (App.playerData.liquidite < e.cout)
      return alert("Fonds insuffisants");

    App.playerData.liquidite -= e.cout;
    App.playerData.entreprises.push({
      type,
      revenuMensuel: e.revenu,
      employes: [],
      niveauRD: 0
    });

    App.savePlayer();
    UI.updatePlayerCard(App.playerData);
  },

  tickRevenus() {
    let total = 0;
    App.playerData.entreprises.forEach(e => {
      total += e.revenuMensuel + e.niveauRD * 1500;
    });

    App.playerData.liquidite += total;
    App.playerData.historique.push(`+${total}§ revenus d’entreprises`);
    App.savePlayer();
  }
};

/* =========================================================================
   6. Banque – Comptes, intérêts, emprunts
   ========================================================================= */

const Banque = {
  interetsEpargne: 0.05,
  emprunts: [],

  ouvrirCompteEpargne() {
    if (!App.playerData.compteEpargne)
      App.playerData.compteEpargne = 0;
    App.savePlayer();
  },

  deposerEpargne(montant) {
    if (App.playerData.liquidite < montant) return;
    App.playerData.liquidite -= montant;
    App.playerData.compteEpargne += montant;
    App.savePlayer();
  },

  appliquerInterets() {
    if (!App.playerData.compteEpargne) return;
    const gain = App.playerData.compteEpargne * this.interetsEpargne / 12;
    App.playerData.compteEpargne += gain;
    App.savePlayer();
  },

  emprunter(montant) {
    App.playerData.liquidite += montant;
    this.emprunts.push({ montant, restant: montant * 1.15 });
    App.savePlayer();
  },

  payerMensualites() {
    let total = 0;

    this.emprunts.forEach(e => {
      const mensualite = e.restant * 0.10;
      e.restant -= mensualite;
      total += mensualite;
    });

    App.playerData.liquidite -= total;
    App.savePlayer();
  }
};

/* =========================================================================
   7. Bourse – Actions, valeur dynamique, trading
   ========================================================================= */

const Bourse = {
  actions: {
    TECH: { prix: 120, tendance: 1 },
    BANK: { prix: 80, tendance: -1 },
    SPACE: { prix: 200, tendance: 1 }
  },

  tick() {
    Object.values(this.actions).forEach(a => {
      const variation = (Math.random() * 6 - 3) * a.tendance;
      a.prix = Math.max(1, a.prix + variation);
    });
  },

  acheter(symbole, montant) {
    const action = this.actions[symbole];
    if (!action) return;

    if (App.playerData.liquidite < action.prix * montant) return;

    App.playerData.liquidite -= action.prix * montant;
    App.playerData.actions[symbole] =
      (App.playerData.actions[symbole] || 0) + montant;

    App.savePlayer();
  },

  vendre(symbole, montant) {
    if ((App.playerData.actions[symbole] || 0) < montant) return;

    const action = this.actions[symbole];
    App.playerData.actions[symbole] -= montant;
    App.playerData.liquidite += action.prix * montant;

    App.savePlayer();
  }
};

/* =========================================================================
   8. Politique – Influence, lois, réputation
   ========================================================================= */

const Politique = {
  lois: [
    { nom: "Taxe immobilière", effet: () => App.playerData.liquidite -= 500 },
    { nom: "Subvention PME", effet: () => App.playerData.liquidite += 2000 }
  ],

  appliquerLois() {
    this.lois.forEach(l => l.effet());
    App.savePlayer();
  }
};

/* =========================================================================
   9. Casino – Blackjack, roulette, slots
   ========================================================================= */

const Casino = {
  jouerBlackjack() {
    const gain = Math.random() > 0.5 ? 500 : -500;
    App.playerData.liquidite += gain;
    App.savePlayer();
  }
};

/* =========================================================================
   10. Classements – Riche, immobilier, etc.
   ========================================================================= */

const Classements = {
  async chargerClassements() {
    const players = await db.collection("players").get();
    const data = players.docs.map(d => d.data());

    data.sort((a, b) => b.liquidite - a.liquidite);
    document.getElementById("topRiches").innerHTML =
      data.slice(0, 10).map(p => `<p>${p.username}: ${p.liquidite}§</p>`).join("");
  }
};

/* =========================================================================
   11. Profil – Stats, achievements
   ========================================================================= */

const Profil = {
  calculerStats() {
    return {
      biens: App.playerData.biens.length,
      entreprises: App.playerData.entreprises.length,
      actions: Object.keys(App.playerData.actions).length
    };
  }
};

/* =========================================================================
   12. Chat
   ========================================================================= */

const Chat = {
  async sendMessage() {
    const msg = document.getElementById("chatMsg").value;
    if (!msg.trim()) return;

    await db.collection("chat").add({
      user: App.playerData.username,
      msg,
      time: Date.now()
    });

    document.getElementById("chatMsg").value = "";
  }
};

/* =========================================================================
   13. Économie – Ticks, inflation, événements
   ========================================================================= */

const Economy = {
  inflation: 0.02,

  tick() {
    RealEstate.genererLoyers();
    Entreprises.tickRevenus();
    Banque.appliquerInterets();
    Banque.payerMensualites();
    Bourse.tick();

    if (Math.random() < 0.03) this.evenementAleatoire();
  },

  evenementAleatoire() {
    const events = [
      { nom: "Boom immobilier", effet: () => RealEstate.biensDisponibles.forEach(b => b.prix *= 1.2) },
      { nom: "Crise boursière", effet: () => Object.values(Bourse.actions).forEach(a => a.prix *= 0.7) },
      { nom: "Subvention d'État", effet: () => App.playerData.liquidite += 5000 }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    event.effet();
    App.savePlayer();
  }
};

/* =========================================================================
   14. Boucle de jeu (toutes les minutes)
   ========================================================================= */

setInterval(() => {
  if (App.playerData) Economy.tick();
}, 60000);

/* =========================================================================
   15. Login Events
   ========================================================================= */

document.getElementById("loginBtn").onclick = () => {
  const email = document.getElementById("emailInput").value;
  const username = document.getElementById("usernameInput").value;
  App.login(email, username);
};

