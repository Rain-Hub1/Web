const firebaseConfig = {
  apiKey: "AIzaSyD-mHbd5e5zzS7sGnFtMbeFii5nyXxD3MI",
  authDomain: "ember-cine.firebaseapp.com",
  projectId: "ember-cine",
  storageBucket: "ember-cine.firebasestorage.app",
  messagingSenderId: "1071616566981",
  appId: "1:1071616566981:web:5a08c0aea216a4c37ef2ac"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Seletores de Elementos ---
const authContainer = document.getElementById('auth-container');
const userContent = document.getElementById('user-content');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const addAnimeForm = document.getElementById('add-anime-form');

const logoutButton = document.getElementById('logout-button');
const animeList = document.getElementById('anime-list');
const animeTitleInput = document.getElementById('anime-title-input');

// --- Abas de Login/Cadastro ---
const showLoginTab = document.getElementById('show-login-tab');
const showSignupTab = document.getElementById('show-signup-tab');

showLoginTab.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    showLoginTab.classList.add('active');
    showSignupTab.classList.remove('active');
});

showSignupTab.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    showLoginTab.classList.remove('active');
    showSignupTab.classList.add('active');
});

// --- Lógica de Autenticação ---
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => alert('Cadastro realizado com sucesso! Faça o login.'))
        .catch(error => alert('Erro no cadastro: ' + error.message));
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert('Erro no login: ' + error.message));
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

// --- Lógica do Firestore ---
addAnimeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const animeTitle = animeTitleInput.value.trim();

    if (user && animeTitle) {
        db.collection('animes').add({
            title: animeTitle,
            userId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            animeTitleInput.value = '';
        })
        .catch(error => console.error("Erro ao adicionar anime: ", error));
    }
});

function loadAnimes(userId) {
    db.collection('animes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          animeList.innerHTML = '';
          if (snapshot.empty) {
              animeList.innerHTML = '<li>Sua lista está vazia. Adicione seu primeiro anime!</li>';
              return;
          }
          snapshot.forEach(doc => {
              const anime = doc.data();
              const li = document.createElement('li');
              li.textContent = anime.title;
              
              const deleteButton = document.createElement('button');
              deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
              deleteButton.className = 'btn-delete';
              deleteButton.onclick = () => db.collection('animes').doc(doc.id).delete();
              
              li.appendChild(deleteButton);
              animeList.appendChild(li);
          });
      });
}

// --- Gerenciador de Estado da UI ---
auth.onAuthStateChanged(user => {
    if (user) {
        // Logado
        authContainer.classList.add('hidden');
        userContent.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
        loadAnimes(user.uid);
    } else {
        // Deslogado
        authContainer.classList.remove('hidden');
        userContent.classList.add('hidden');
        userInfo.classList.add('hidden');
        userEmailSpan.textContent = '';
        animeList.innerHTML = '';
    }
});
