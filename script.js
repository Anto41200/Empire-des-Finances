// ==========================
// GLOBALS
// ==========================
let player = {
    email: "",
    username: "",
    capital: 300000,
    liquidite: 50000,
    biens: [],
    entreprises: [],
    historique: []
};

let currentPage = "accueil";

// ==========================
// UTILITIES
// ==========================
function show(elementId) {
    document.querySelectorAll(".card").forEach(c => c.classList.add("hidden"));
    document.getElementById(elementId).classList.remove("hidden");
}

function updatePlayerDisplay() {
    document.getElementById("emailDisplay").innerText = player.email;
    document.getElementById("usernameDisplay").innerText = player.username;
    document.getElementById("capitalDisplay").innerText = player.capital.toLocaleString();
    document.getElementById("liquiditeDisplay").innerText = player.liquidite.toLocaleString();
    document.getElementById("nbBiensDisplay").innerText = player.biens.length;
    document.getElementById("nbEntreprisesDisplay").innerText = player.entreprises.length;
}

// ==========================
// LOGIN
// ==========================
document.getElementById("loginBtn").onclick = function() {
    const email = document.getElementById("emailInput").value.trim();
    const username = document.getElementById("usernameInput").value.trim();
    if (!email || !username) {
        alert("Merci de remplir tous les champs !");
        return;
    }
    player.email = email;
    player.username = username;
    show("playerCard");
    show("menuCard");
    show("content");
    updatePlayerDisplay();
    showAccueil();
};

document.getElementById("loginGoogleBtn").onclick = async function() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        player.email = user.email;
        player.username = user.displayName || user.email.split("@")[0];
        show("playerCard");
        show("menuCard");
        show("content");
        updatePlayerDisplay();
        showAccueil();
    } catch (error) {
        alert("Erreur connexion Google : " + error.message);
    }
};

function logout() {
    player = {
        email: "",
        username: "",
        capital: 300000,
        liquidite: 50000,
        biens: [],
        entreprises: [],
        historique: []
    };
    show("loginCard");
    document.getElementById("emailInput").value = "";
    document.getElementById("usernameInput").value = "";
}

// ==========================
// PAGES
// ==========================
function showAccueil() {
    currentPage = "accueil";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Accueil</h2>
        <p>Bienvenue ${player.username} ! Capital initial : ${player.capital.toLocaleString()} €</p>
    `;
}

function showProprietes() {
    currentPage = "proprietes";
    show("content");
    const biens = ["Appartement", "Maison", "Villa", "Loft", "Manoir", "Château"];
    let html = "<h2>Propriétés</h2>";
    html += "<ul>";
    biens.forEach((bien, idx) => {
        const possede = player.biens.includes(bien);
        html += `<li>${bien} 
        <button class="btn" onclick="acheterBien('${bien}')">${possede ? 'Déjà acquis' : 'Acheter'}</button>`;
        if (bien === "Château" && possede) {
            html += ` <button class="btn" onclick="modeTourisme('${bien}')">Mettre en mode tourisme</button>`;
            html += ` <button class="btn" onclick="optionsChateau('${bien}')">Options château</button>`;
        }
        html += "</li>";
    });
    html += "</ul>";
    document.getElementById("content").innerHTML = html;
}

function showEntreprises() {
    currentPage = "entreprises";
    show("content");
    const types = ["Ferme", "Commerce", "Industrie", "Pétrolier"];
    let html = "<h2>Entreprises</h2>";
    html += "<ul>";
    types.forEach(type => {
        html += `<li>${type} 
        <button class="btn" onclick="acheterEntreprise('${type}')">Acheter</button>
        <button class="btn" onclick="dissoudreEntreprise('${type}')">Dissoudre</button></li>`;
    });
    html += "</ul>";
    document.getElementById("content").innerHTML = html;
}

function showBanque() {
    currentPage = "banque";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Banque</h2>
        <p>Fonctionnalités bancaires à venir : prêts, dépôt, retrait</p>
    `;
}

function showFinances() {
    currentPage = "finances";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Finances</h2>
        <p>Graphiques et historique du patrimoine à venir</p>
    `;
}

function showChat() {
    currentPage = "chat";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Chat Global</h2>
        <div id="chatBox" style="height:300px; overflow-y:auto; border:1px solid #ccc; padding:5px;"></div>
        <input id="chatInput" type="text" placeholder="Écrire un message" />
        <button class="btn" onclick="envoyerMessage()">Envoyer</button>
    `;
}

function showDemocratie() {
    currentPage = "democratie";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Démocratie</h2>
        <p>Page vide - fonctionnalités à implémenter.</p>
    `;
}

function showOptions() {
    currentPage = "options";
    show("content");
    document.getElementById("content").innerHTML = `
        <h2>Options</h2>
        <p>Paramètres de langue, devise, auto-save et autres réglages.</p>
    `;
}

// ==========================
// BIENS
// ==========================
function acheterBien(bien) {
    if (!player.biens.includes(bien)) {
        const prix = bien === "Château" ? 200000 : 50000;
        if (player.capital >= prix) {
            player.capital -= prix;
            player.biens.push(bien);
            updatePlayerDisplay();
            showProprietes();
        } else alert("Pas assez de capital !");
    }
}

function modeTourisme(bien) {
    alert(`${bien} est maintenant en mode tourisme !`);
}

function optionsChateau(bien) {
    alert(`Options disponibles pour ${bien} : \n- Monument historique\n- Entretien jardins\n- Organisation d'événements`);
}

// ==========================
// ENTREPRISES
// ==========================
function acheterEntreprise(type) {
    if (!player.entreprises.includes(type)) {
        const prix = 100000;
        if (player.capital >= prix) {
            player.capital -= prix;
            player.entreprises.push(type);
            updatePlayerDisplay();
            showEntreprises();
        } else alert("Pas assez de capital !");
    }
}

function dissoudreEntreprise(type) {
    const idx = player.entreprises.indexOf(type);
    if (idx >= 0) {
        player.entreprises.splice(idx, 1);
        alert(`${type} dissoute.`);
        updatePlayerDisplay();
        showEntreprises();
    }
}

// ==========================
// CHAT
// ==========================
let chatHistory = [];
function envoyerMessage() {
    const input = document.getElementById("chatInput");
    const msg = input.value.trim();
    if (!msg) return;
    chatHistory.push({user: player.username, text: msg});
    afficherChat();
    input.value = "";
}

function afficherChat() {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;
    chatBox.innerHTML = chatHistory.map(m => `<p><b>${m.user}:</b> ${m.text}</p>`).join("");
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ==========================
// INITIAL DISPLAY
// ==========================
show("loginCard");
