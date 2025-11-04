const firebaseConfig = {
  apiKey: "AIzaSyD-mHbd5e5zzS7sGnFtMbeFii5nyXxD3MI",
  authDomain: "ember-cine.firebaseapp.com",
  projectId: "ember-cine",
  storageBucket: "ember-cine.appspot.com",
  messagingSenderId: "1071616566981",
  appId: "1:1071616566981:web:5a08c0aea216a4c37ef2ac"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const appRoot = document.getElementById('app-root');
const mainNav = document.getElementById('main-nav');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');

const routes = {
    '/Login': { templateId: 'template-login', isPublic: true },
    '/Cadastro': { templateId: 'template-cadastro', isPublic: true },
    '/Animes': { templateId: 'template-animes', isPublic: false },
    '/404': { templateId: 'template-404', isPublic: true }
};

function router(event) {
    const path = window.location.hash.slice(1) || '/';
    const user = auth.currentUser;

    let route;
    if (path === '/') {
        route = user ? routes['/Animes'] : routes['/Login'];
    } else {
        route = routes[path] || routes['/404'];
    }

    if (!route.isPublic && !user) {
        window.location.hash = '/Login';
        return;
    }

    const template = document.getElementById(route.templateId);
    appRoot.innerHTML = template.innerHTML;
    
    attachEventListeners(path);
}

function attachEventListeners(path) {
    if (path === '/Login' || (path === '/' && !auth.currentUser)) {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', handleLogin);
    }
    if (path === '/Cadastro') {
        const signupForm = document.getElementById('signup-form');
        signupForm.addEventListener('submit', handleSignup);
    }
    if (path === '/Animes' || (path === '/' && auth.currentUser)) {
        const addAnimeForm = document.getElementById('add-anime-form');
        addAnimeForm.addEventListener('submit', handleAddAnime);
        loadAnimes(auth.currentUser.uid);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert('Erro: ' + error.message));
}

function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            alert('Conta criada! Faça o login para continuar.');
            window.location.hash = '/Login';
        })
        .catch(error => alert('Erro: ' + error.message));
}

function handleAddAnime(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const animeTitleInput = document.getElementById('anime-title-input');
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
}

function loadAnimes(userId) {
    const animeList = document.getElementById('anime-list');
    db.collection('animes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          if (!animeList) return;
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

logoutButton.addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged(user => {
    if (user) {
        mainNav.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
    } else {
        mainNav.classList.add('hidden');
        userInfo.classList.add('hidden');
        userEmailSpan.textContent = '';
    }
    router();
});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
