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
    '/Login': { templateId: 'template-login', isPublic: true, title: 'Login' },
    '/Cadastro': { templateId: 'template-cadastro', isPublic: true, title: 'Cadastro' },
    '/Upload': { templateId: 'template-submit', isPublic: false, title: 'Enviar Script' },
    '/settings': { templateId: 'template-settings', isPublic: false, title: 'Configurações' },
    '/:scriptId': { templateId: 'template-script-view', isPublic: true, title: 'Visualizando Script' },
    '/:userId/:username': { templateId: 'template-user-profile', isPublic: true, title: 'Perfil de Usuário' }
};

function showNotification(message, isError = true) {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
    notification.className = 'notification';
    if (!isError) { notification.classList.add('success'); }
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => { notification.remove(); }, 4000);
}

function render(templateId) {
    const template = document.getElementById(templateId);
    if (template) { appRoot.innerHTML = template.innerHTML; }
    else { appRoot.innerHTML = document.getElementById('template-404').innerHTML; }
}

async function router() {
    const path = window.location.hash.slice(1) || '/';
    const user = auth.currentUser;
    let matchedRoute = null;
    let params = {};
    const pathParts = path.split('/').filter(p => p);

    if (path === '/') { matchedRoute = routes['/']; }
    else if (routes[path]) { matchedRoute = routes[path]; }
    else if (pathParts.length === 2 && routes['/:userId/:username']) { matchedRoute = routes['/:userId/:username']; params = { userId: pathParts[0], username: pathParts[1] }; }
    else if (pathParts.length === 1 && routes['/:scriptId']) { matchedRoute = routes['/:scriptId']; params = { scriptId: pathParts[0] }; }

    const route = matchedRoute || { templateId: 'template-404', isPublic: true, title: 'Não Encontrado' };
    if (!route.isPublic && !user) { window.location.hash = '/Login'; return; }
    render(route.templateId);
    document.title = `CodeHub - ${route.title}`;
    await attachEventListeners(path, params);
}

async function attachEventListeners(path, params) {
    if (path === '/') { await loadRecentScripts(); }
    else if (path === '/Login') { document.getElementById('login-form').addEventListener('submit', handleLogin); }
    else if (path === '/Cadastro') { document.getElementById('signup-form').addEventListener('submit', handleSignup); }
    else if (path === '/Upload') { document.getElementById('submit-script-form').addEventListener('submit', handleSubmitScript); }
    else if (path === '/settings') { setupSettingsPage(); }
    else if (params.scriptId) { await loadScriptDetails(params.scriptId); }
    else if (params.userId) { await loadUserProfile(params.userId); }
}

function handleLogin(e) { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value).catch(err => showNotification(err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' ? 'Email ou senha inválidos.' : 'Ocorreu um erro.')); }

function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    db.collection('users').where('username', '==', username).get().then(snapshot => {
        if (!snapshot.empty) { showNotification('Este nome de usuário já existe.'); return; }
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({ username: username, createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
            .then(() => { showNotification('Conta criada com sucesso!', false); window.location.hash = '/'; })
            .catch(err => showNotification(err.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' : 'Ocorreu um erro no cadastro.'));
    });
}

async function handleSubmitScript(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Publicando...';
    const title = document.getElementById('script-title').value;
    const gameId = document.getElementById('script-game-id').value;
    const tags = document.getElementById('script-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const thumbnailUrl = document.getElementById('script-thumbnail-url').value;
    const description = document.getElementById('script-description').value;
    const code = document.getElementById('script-code').value;
    if (!thumbnailUrl) { showNotification('Por favor, adicione a URL de uma imagem.'); submitButton.disabled = false; submitButton.textContent = 'Publicar'; return; }
    try {
        const docRef = await db.collection('scripts').add({ title, gameId, tags, description, code, thumbnailUrl, authorId: user.uid, authorUsername: user.displayName, createdAt: firebase.firestore.FieldValue.serverTimestamp(), starCount: 0 });
        window.location.hash = `/${docRef.id}`;
    } catch (err) {
        showNotification('Erro ao publicar o script.');
        submitButton.disabled = false;
        submitButton.textContent = 'Publicar';
    }
}

function setupSettingsPage() {
    document.getElementById('update-username-form').addEventListener('submit', handleUpdateUsername);
    document.getElementById('update-password-form').addEventListener('submit', handleUpdatePassword);
}

async function handleUpdateUsername(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const newUsername = document.getElementById('new-username').value.trim();
    if (!user || !newUsername) return;

    try {
        await user.updateProfile({ displayName: newUsername });
        await db.collection('users').doc(user.uid).update({ username: newUsername });
        showNotification('Nome de usuário atualizado com sucesso!', false);
    } catch (error) {
        showNotification('Erro ao atualizar o nome de usuário.');
    }
}

async function handleUpdatePassword(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const newPassword = document.getElementById('new-password').value;
    if (!user || !newPassword) return;

    try {
        await user.updatePassword(newPassword);
        showNotification('Senha atualizada com sucesso!', false);
        document.getElementById('new-password').value = '';
    } catch (error) {
        showNotification('Erro ao atualizar a senha. Pode ser necessário fazer login novamente.');
    }
}

async function handleStarClick(scriptId) {
    const user = auth.currentUser;
    if (!user) { showNotification('Você precisa estar logado para dar uma estrela.'); window.location.hash = '/Login'; return; }
    const scriptRef = db.collection('scripts').doc(scriptId);
    const starRef = scriptRef.collection('stars').doc(user.uid);
    const starDoc = await starRef.get();
    db.runTransaction(async (t) => {
        const scriptDoc = await t.get(scriptRef);
        const currentStarCount = scriptDoc.data().starCount || 0;
        if (starDoc.exists) { t.delete(starRef); t.update(scriptRef, { starCount: currentStarCount - 1 }); }
        else { t.set(starRef, { starredAt: firebase.firestore.FieldValue.serverTimestamp() }); t.update(scriptRef, { starCount: currentStarCount + 1 }); }
    }).catch(err => showNotification('Erro ao processar a estrela.'));
}

async function loadRecentScripts() {
    const grid = document.getElementById('scripts-grid');
    if (!grid) return;
    const snapshot = await db.collection('scripts').orderBy('createdAt', 'desc').limit(9).get();
    grid.innerHTML = '';
    snapshot.forEach(doc => {
        const script = doc.data();
        const card = document.createElement('a');
        card.className = 'script-card';
        card.href = `#/${doc.id}`;
        card.innerHTML = `
            <img src="${script.thumbnailUrl}" alt="${script.title}" class="script-card-thumbnail" onerror="this.style.display='none'">
            <div class="script-card-content">
                <h3>${script.title}</h3>
                <p>${script.description.substring(0, 80)}${script.description.length > 80 ? '...' : ''}</p>
            </div>
            <div class="script-card-footer">
                <div class="author-info">
                    <i class="fa-regular fa-user"></i>
                    <span>${script.authorUsername || 'Anônimo'}</span>
                </div>
                <div class="star-button">
                    <i class="fa-regular fa-star"></i>
                    <span class="star-count">${script.starCount || 0}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadScriptDetails(scriptId) {
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
        document.getElementById('script-details-content').innerHTML = `
            <div class="title-header">
                <div>
                    <h1 class="title">${script.title}</h1>
                    <p class="author">Enviado por <a href="#/${script.authorId}/${script.authorUsername}">${script.authorUsername || 'Anônimo'}</a></p>
                </div>
                <button class="star-button large ${userHasStarred ? 'starred' : ''}" id="details-star-button">
                    <i class="fa-${userHasStarred ? 'solid' : 'regular'} fa-star"></i>
                    <span class="star-count">${script.starCount || 0}</span>
                </button>
            </div>
            <div class="box">
                <div class="box-header">
                    <span>Código Fonte</span>
                    <div class="action-buttons">
                        <button class="btn btn-secondary" id="copy-script-btn"><i class="fa-regular fa-copy"></i> Copiar</button>
                    </div>
                </div>
                <div class="box-body">
                    <pre><code class="language-lua hljs" id="script-code-block">${script.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                </div>
            </div>
        `;
        document.getElementById('details-star-button').addEventListener('click', () => handleStarClick(scriptId));
        document.getElementById('copy-script-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(script.code);
            showNotification('Código copiado para a área de transferência!', false);
        });
        hljs.highlightAll();
        loadComments(scriptId);
    });
}

async function loadComments(scriptId) {
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const tagsContainer = document.getElementById('tags-container');
    const scriptDoc = await db.collection('scripts').doc(scriptId).get();
    const scriptData = scriptDoc.data();

    if (scriptData.tags && scriptData.tags.length > 0) {
        tagsContainer.innerHTML = scriptData.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        document.getElementById('tags-box').classList.remove('hidden');
    } else {
        document.getElementById('tags-box').classList.add('hidden');
    }

    commentForm.addEventListener('submit', (e) => handleCommentSubmit(e, scriptId));
    db.collection('scripts').doc(scriptId).collection('comments').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            commentsList.innerHTML = '';
            if (snapshot.empty) {
                commentsList.innerHTML = '<p>Nenhum comentário ainda. Seja o primeiro!</p>';
                return;
            }
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                const time = comment.createdAt ? comment.createdAt.toDate().toLocaleString('pt-BR') : '';
                commentEl.innerHTML = `
                    <div>
                        <p><strong class="comment-author">${comment.authorUsername}</strong> <span class="comment-time">${time}</span></p>
                        <p class="comment-body">${comment.text}</p>
                    </div>
                `;
                commentsList.appendChild(commentEl);
            });
        });
}

function handleCommentSubmit(e, scriptId) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) { showNotification('Você precisa estar logado para comentar.'); return; }
    const commentInput = document.getElementById('comment-input');
    const text = commentInput.value.trim();
    if (text) {
        db.collection('scripts').doc(scriptId).collection('comments').add({
            text: text,
            authorId: user.uid,
            authorUsername: user.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            commentInput.value = '';
        }).catch(err => showNotification('Erro ao enviar comentário.'));
    }
}

async function loadUserProfile(userId) {
    const profileContent = document.getElementById('profile-content');
    if (!profileContent) return;
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) { window.location.hash = '/404'; return; }
    
    const userData = userDoc.data();
    profileContent.innerHTML = `
        <div class="profile-header">
            <h1>${userData.username}</h1>
            <p>Membro desde: ${userData.createdAt ? userData.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A'}</p>
        </div>
        <h2>Scripts Enviados</h2>
        <div id="user-scripts-grid" class="scripts-grid"></div>
    `;
    
    const scriptsSnapshot = await db.collection('scripts').where('authorId', '==', userId).orderBy('createdAt', 'desc').get();
    const grid = document.getElementById('user-scripts-grid');
    grid.innerHTML = '';
    
    if (scriptsSnapshot.empty) {
        grid.innerHTML = '<p>Este usuário ainda não publicou nenhum script.</p>';
        return;
    }
    
    scriptsSnapshot.forEach(doc => {
        const script = doc.data();
        const card = document.createElement('a');
        card.className = 'script-card';
        card.href = `#/${doc.id}`;
        card.innerHTML = `
            <img src="${script.thumbnailUrl}" alt="${script.title}" class="script-card-thumbnail" onerror="this.style.display='none'">
            <div class="script-card-content"><h3>${script.title}</h3></div>
        `;
        grid.appendChild(card);
    });
}

function updateUserUI(user) {
    const mainNav = document.getElementById('main-nav');
    if (user) {
        userActions.innerHTML = `
            <a href="#/${user.uid}/${user.displayName}" class="user-display">${user.displayName || user.email}</a>
            <a href="#/settings" class="btn btn-secondary"><i class="fa-solid fa-gear"></i></a>
            <button id="logout-button" class="btn btn-secondary">Sair</button>
        `;
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
        mainNav.querySelector('a[href="#/Upload"]').classList.remove('hidden');
    } else {
        userActions.innerHTML = `
            <a href="#/Login" class="btn btn-secondary">Login</a>
            <a href="#/Cadastro" class="btn btn-primary">Criar Conta</a>
        `;
        mainNav.querySelector('a[href="#/Upload"]').classList.add('hidden');
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
