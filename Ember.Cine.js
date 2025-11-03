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

const authContainer = document.getElementById('auth-container');
const userContent = document.getElementById('user-content');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const addAnimeForm = document.getElementById('add-anime-form');

const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const logoutButton = document.getElementById('logout-button');

const animeList = document.getElementById('anime-list');
const animeTitleInput = document.getElementById('anime-title-input');

const showSignupLink = document.getElementById('show-signup-link');
const showLoginLink = document.getElementById('show-login-link');

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.remove('hidden');
    showLoginLink.classList.remove('hidden');
    document.querySelector('.signup-prompt').classList.add('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    showLoginLink.classList.add('hidden');
    document.querySelector('.signup-prompt').classList.remove('hidden');
});

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => alert('Conta criada! Faça o login para continuar.'))
        .catch(error => alert('Erro: ' + error.message));
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert('Erro: ' + error.message));
});

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

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
        .catch(error => console.error("Error adding document: ", error));
    }
});

function loadAnimes(userId) {
    db.collection('animes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          animeList.innerHTML = '';
          if (snapshot.empty) {
              animeList.innerHTML = '<li>Nenhum anime na sua lista. Faça seu primeiro "commit"!</li>';
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

auth.onAuthStateChanged(user => {
    if (user) {
        authContainer.classList.add('hidden');
        userContent.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
        loadAnimes(user.uid);
    } else {
        authContainer.classList.remove('hidden');
        userContent.classList.add('hidden');
        userInfo.classList.add('hidden');
        userEmailSpan.textContent = '';
        animeList.innerHTML = '';
        
        signupForm.classList.add('hidden');
        showLoginLink.classList.add('hidden');
        document.querySelector('.signup-prompt').classList.remove('hidden');
    }
});
