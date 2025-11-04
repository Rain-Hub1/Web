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

function render(templateId) {
    const template = document.getElementById(templateId);
    appRoot.innerHTML = template.innerHTML;
}

async function router() {
    const path = window.location.hash.slice(1) || '/';
    const user = auth.currentUser;
    
    let routeKey = path;
    let params;
    const pathParts = path.split('/');

    if (pathParts[1] === 'script' && pathParts[2]) {
        routeKey = '/script/:id';
        params = { id: pathParts[2] };
    }
    
    const route = routes[routeKey] || { templateId: 'template-404', isPublic: true, title: 'Não Encontrado' };

    if (!route.isPublic && !user) {
        window.location.hash = '/Login';
        return;
    }

    render(route.templateId);
    document.title = `CodeHub - ${route.title}`;
    await attachEventListeners(routeKey, params);
}

async function attachEventListeners(routeKey, params) {
    if (routeKey === '/' || routeKey === '/Scripts') {
        await loadRecentScripts();
    } else if (routeKey === '/Login') {
        document.getElementById('login-form').addEventListener('submit', handleLogin);
    } else if (routeKey === '/Cadastro') {
        document.getElementById('signup-form').addEventListener('submit', handleSignup);
    } else if (routeKey === '/Submit') {
        document.getElementById('submit-script-form').addEventListener('submit', handleSubmitScript);
    } else if (routeKey === '/script/:id' && params) {
        await loadScriptDetails(params.id);
    }
}

function handleLogin(e) { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value).catch(err => alert(err.message)); }

function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    db.collection('users').where('username', '==', username).get().then(snapshot => {
        if (!snapshot.empty) { alert('Este nome de usuário já existe.'); return; }
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({ username: username }))
            .then(() => { alert('Conta criada com sucesso!'); window.location.hash = '/'; })
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
        db.collection('scripts').add({ title, description, code, authorId: user.uid, authorUsername: user.displayName, createdAt: firebase.firestore.FieldValue.serverTimestamp(), starCount: 0 })
            .then(docRef => { window.location.hash = `/script/${docRef.id}`; })
            .catch(err => alert(err.message));
    }
}

async function handleStarClick(scriptId) {
    const user = auth.currentUser;
    if (!user) {
        alert('Você precisa estar logado para dar uma estrela.');
        window.location.hash = '/Login';
        return;
    }

    const scriptRef = db.collection('scripts').doc(scriptId);
    const starRef = scriptRef.collection('stars').doc(user.uid);
    const starDoc = await starRef.get();

    const transaction = db.runTransaction(async (t) => {
        const scriptDoc = await t.get(scriptRef);
        const currentStarCount = scriptDoc.data().starCount || 0;

        if (starDoc.exists) {
            t.delete(starRef);
            t.update(scriptRef, { starCount: currentStarCount - 1 });
        } else {
            t.set(starRef, { starredAt: firebase.firestore.FieldValue.serverTimestamp() });
            t.update(scriptRef, { starCount: currentStarCount + 1 });
        }
    });
}

async function loadRecentScripts() {
    const grid = document.getElementById('scripts-grid');
    if (!grid) return;
    const snapshot = await db.collection('scripts').orderBy('createdAt', 'desc').limit(9).get();
    grid.innerHTML = '';
    snapshot.forEach(doc => {
        const script = doc.data();
        const card = document.createElement('div');
        card.className = 'script-card';
        
        card.innerHTML = `
            <div class="script-card-glow"></div>
            <div class="script-card-content">
                <a href="#/script/${doc.id}" class="script-link"><h3>${script.title}</h3></a>
                <p>${script.description.substring(0, 80)}${script.description.length > 80 ? '...' : ''}</p>
            </div>
            <div class="script-card-footer">
                <div class="author-info">
                    <i class="fa-regular fa-user"></i>
                    <span>${script.authorUsername || 'Anônimo'}</span>
                </div>
                <button class="star-button" data-script-id="${doc.id}">
                    <i class="fa-regular fa-star"></i>
                    <span class="star-count">${script.starCount || 0}</span>
                </button>
            </div>
        `;
        
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });

        const starButton = card.querySelector('.star-button');
        starButton.addEventListener('click', (e) => {
            e.stopPropagation();
            handleStarClick(doc.id);
        });

        grid.appendChild(card);
    });
}

async function loadScriptDetails(scriptId) {
    const contentArea = document.getElementById('script-details-content');
    const scriptRef = db.collection('scripts').doc(scriptId);
    
    scriptRef.onSnapshot(async (doc) => {
        if (!doc.exists) { window.location.hash = '/404'; return; }

        const script = doc.data();
        const user = auth.currentUser;
        let userHasStarred = false;

        if (user) {
            const starDoc = await scriptRef.collection('stars').doc(user.uid).get();
            userHasStarred = starDoc.exists;
        }

        contentArea.innerHTML = `
            <div class="title-header">
                <div>
                    <h1 class="title">${script.title}</h1>
                    <p class="author">Enviado por <strong>${script.authorUsername || 'Anônimo'}</strong></p>
                </div>
                <button class="star-button large ${userHasStarred ? 'starred' : ''}" id="details-star-button">
                    <i class="fa-${userHasStarred ? 'solid' : 'regular'} fa-star"></i>
                    <span class="star-count">${script.starCount || 0}</span>
                </button>
            </div>
            <div class="box">
                <div class="box-header">Descrição</div>
                <div class="box-body">${script.description.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="box">
                <div class="box-header">Código Fonte</div>
                <div class="box-body">
                    <pre><code class="language-lua hljs">${script.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                </div>
            </div>
        `;
        
        document.getElementById('details-star-button').addEventListener('click', () => handleStarClick(scriptId));
        hljs.highlightAll();
    });
}

function updateUserUI(user) {
    if (user) {
        userActions.innerHTML = `
            <span class="user-display">${user.displayName || user.email}</span>
            <button id="logout-button" class="btn btn-secondary">Sair</button>
        `;
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    } else {
        userActions.innerHTML = `
            <a href="#/Login" class="btn btn-secondary">Login</a>
            <a href="#/Cadastro" class="btn btn-primary">Criar Conta</a>
        `;
    }
}

auth.onAuthStateChanged(async user => {
    if (user && !user.displayName) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) { await user.updateProfile({ displayName: userDoc.data().username }); }
    }
    updateUserUI(user);
    router();
});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
