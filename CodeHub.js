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
const userActions = document.getElementById('user-actions');

const routes = {
    '/': { templateId: 'template-home', isPublic: true, title: 'Home' },
    '/Scripts': { templateId: 'template-home', isPublic: true, title: 'Explorar Scripts' },
    '/Login': { templateId: 'template-login', isPublic: true, title: 'Login' },
    '/Cadastro': { templateId: 'template-cadastro', isPublic: true, title: 'Cadastro' },
    '/Submit': { templateId: 'template-submit', isPublic: false, title: 'Enviar Script' },
    '/script/:id': { templateId: 'template-script-view', isPublic: true, title: 'Visualizando Script' }
};

function render(templateId, data = {}) {
    const template = document.getElementById(templateId);
    let html = template.innerHTML;
    for (const key in data) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
    }
    appRoot.innerHTML = html;
}

async function router() {
    const path = window.location.hash.slice(1) || '/';
    const user = auth.currentUser;
    
    let route, params;
    const pathParts = path.split('/');
    if (pathParts[1] === 'script' && pathParts[2]) {
        route = routes['/script/:id'];
        params = { id: pathParts[2] };
    } else {
        route = routes[path] || routes['/404'];
    }

    if (!route) {
        render('template-404');
        return;
    }

    if (!route.isPublic && !user) {
        window.location.hash = '/Login';
        return;
    }

    render(route.templateId);
    document.title = `CodeHub - ${route.title}`;
    await attachEventListeners(path, params);
}

async function attachEventListeners(path, params) {
    if (path === '/' || path === '/Scripts') {
        loadRecentScripts();
    } else if (path === '/Login') {
        document.getElementById('login-form').addEventListener('submit', handleLogin);
    } else if (path === '/Cadastro') {
        document.getElementById('signup-form').addEventListener('submit', handleSignup);
    } else if (path === '/Submit') {
        document.getElementById('submit-script-form').addEventListener('submit', handleSubmitScript);
    } else if (route.path === '/script/:id' && params) {
        await loadScriptDetails(params.id);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
}

function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    db.collection('users').where('username', '==', username).get().then(snapshot => {
        if (!snapshot.empty) {
            alert('Este nome de usuário já existe.');
            return;
        }
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => {
                return db.collection('users').doc(cred.user.uid).set({ username: username });
            })
            .then(() => {
                alert('Conta criada com sucesso!');
                window.location.hash = '/';
            })
            .catch(err => alert(err.message));
    });
}

function handleSubmitScript(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const title = document.getElementById('script-title').value;
    const description = document.getElementById('script-description').value;
    const code = document.getElementById('script-code').value;

    if (user && title && description && code) {
        db.collection('scripts').add({
            title,
            description,
            code,
            authorId: user.uid,
            authorUsername: user.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            views: 0
        }).then(docRef => {
            window.location.hash = `/script/${docRef.id}`;
        }).catch(err => alert(err.message));
    }
}

async function loadRecentScripts() {
    const grid = document.getElementById('scripts-grid');
    if (!grid) return;
    const snapshot = await db.collection('scripts').orderBy('createdAt', 'desc').limit(12).get();
    grid.innerHTML = '';
    snapshot.forEach(doc => {
        const script = doc.data();
        const card = document.createElement('div');
        card.className = 'script-card';
        card.dataset.id = doc.id;
        card.innerHTML = `
            <h4>${script.title}</h4>
            <p>por <strong>${script.authorUsername || 'Anônimo'}</strong></p>
        `;
        card.addEventListener('click', () => {
            window.location.hash = `/script/${doc.id}`;
        });
        grid.appendChild(card);
    });
}

async function loadScriptDetails(scriptId) {
    const contentArea = document.getElementById('script-details-content');
    const docRef = db.collection('scripts').doc(scriptId);
    const doc = await docRef.get();

    if (!doc.exists) {
        window.location.hash = '/404';
        return;
    }

    const script = doc.data();
    contentArea.innerHTML = `
        <h2>${script.title}</h2>
        <p class="author-info">Enviado por <strong>${script.authorUsername || 'Anônimo'}</strong></p>
        <h3>Descrição</h3>
        <p class="description">${script.description.replace(/\n/g, '<br>')}</p>
        <h3>Código</h3>
        <pre><code class="language-lua">${script.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
    `;
    hljs.highlightAll();
}

function updateUserUI(user) {
    if (user) {
        userActions.innerHTML = `
            <span>${user.displayName || user.email}</span>
            <button id="logout-button" class="btn btn-secondary btn-sm">Sair</button>
        `;
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    } else {
        userActions.innerHTML = `
            <a href="#/Login" class="btn btn-secondary btn-sm">Login</a>
        `;
    }
}

auth.onAuthStateChanged(async user => {
    if (user) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            await user.updateProfile({ displayName: userDoc.data().username });
        }
    }
    updateUserUI(user);
    router();
});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
