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
const storage = firebase.storage();

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

function showNotification(message, isError = true) {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
    notification.className = 'notification';
    if (!isError) {
        notification.style.backgroundColor = 'var(--color-accent-secondary)';
    }
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

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
    if (!route.isPublic && !user) { window.location.hash = '/Login'; return; }
    render(route.templateId);
    document.title = `CodeHub - ${route.title}`;
    await attachEventListeners(routeKey, params);
}

async function attachEventListeners(routeKey, params) {
    if (routeKey === '/' || routeKey === '/Scripts') { await loadRecentScripts(); }
    else if (routeKey === '/Login') { document.getElementById('login-form').addEventListener('submit', handleLogin); }
    else if (routeKey === '/Cadastro') { document.getElementById('signup-form').addEventListener('submit', handleSignup); }
    else if (routeKey === '/Submit') { setupSubmitForm(); }
    else if (routeKey === '/script/:id' && params) { await loadScriptDetails(params.id); }
}

function handleLogin(e) {
    e.preventDefault();
    auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value)
        .catch(err => showNotification(err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' ? 'Email ou senha inválidos.' : 'Ocorreu um erro.'));
}

function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    db.collection('users').where('username', '==', username).get().then(snapshot => {
        if (!snapshot.empty) { showNotification('Este nome de usuário já existe.'); return; }
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({ username: username }))
            .then(() => { showNotification('Conta criada com sucesso!', false); window.location.hash = '/'; })
            .catch(err => showNotification(err.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' : 'Ocorreu um erro no cadastro.'));
    });
}

function setupSubmitForm() {
    const form = document.getElementById('submit-script-form');
    const uploadBox = document.getElementById('image-upload-box');
    const fileInput = document.getElementById('script-thumbnail-input');
    const preview = document.getElementById('thumbnail-preview');
    let fileToUpload = null;

    uploadBox.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => uploadBox.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(eventName => uploadBox.addEventListener(eventName, () => uploadBox.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(eventName => uploadBox.addEventListener(eventName, () => uploadBox.classList.remove('dragover')));
    
    function handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            fileToUpload = file;
            const reader = new FileReader();
            reader.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); };
            reader.readAsDataURL(file);
        } else { showNotification('Por favor, selecione um arquivo de imagem.'); }
    }

    uploadBox.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    form.addEventListener('submit', (e) => handleSubmitScript(e, fileToUpload));
}

async function handleSubmitScript(e, file) {
    e.preventDefault();
    const user = auth.currentUser;
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Publicando...';

    if (!file) {
        showNotification('Por favor, adicione uma imagem de thumbnail.');
        submitButton.disabled = false;
        submitButton.textContent = 'Publicar';
        return;
    }

    const title = document.getElementById('script-title').value;
    const gameId = document.getElementById('script-game-id').value;
    const tags = document.getElementById('script-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
    const description = document.getElementById('script-description').value;
    const code = document.getElementById('script-code').value;

    try {
        const filePath = `thumbnails/${user.uid}/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        await fileRef.put(file);
        const thumbnailUrl = await fileRef.getDownloadURL();

        const docRef = await db.collection('scripts').add({
            title, gameId, tags, description, code, thumbnailUrl,
            authorId: user.uid,
            authorUsername: user.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            starCount: 0
        });
        
        window.location.hash = `/script/${docRef.id}`;
    } catch (err) {
        showNotification('Erro ao publicar o script.');
        submitButton.disabled = false;
        submitButton.textContent = 'Publicar';
    }
}

async function handleStarClick(scriptId) {
    const user = auth.currentUser;
    if (!user) { showNotification('Você precisa estar logado para dar uma estrela.'); window.location.hash = '/Login'; return; }
    const scriptRef = db.collection('scripts').doc(scriptId);
    const starRef = scriptRef.collection('stars').doc(user.uid);
    const starDoc = await starRef.get();
