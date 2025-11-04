// ==================================================
// == CONFIGURAÇÃO DO SUPABASE
// ==================================================
const SUPABASE_URL = 'https://iesrugsrfyxuefxpaiab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllc3J1Z3NyZnl4dWVmeHBhaWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMTU5ODgsImV4cCI6MjA3Nzc5MTk4OH0.KanOZORxKv20715jx6ogUxUBNG-BC5klZMg9Uxxo8Do';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================================================
// == ELEMENTOS GLOBAIS E ROTAS
// ==================================================
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

// ==================================================
// == FUNÇÕES UTILITÁRIAS E DE ROTEAMENTO
// ==================================================
function showNotification(message, isError = true) {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? '' : 'success'}`;
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

function render(templateId) {
    const template = document.getElementById(templateId);
    appRoot.innerHTML = template ? template.innerHTML : document.getElementById('template-404').innerHTML;
}

async function router() {
    const path = window.location.hash.slice(1) || '/';
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

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

// ==================================================
// == FUNÇÕES DE AUTENTICAÇÃO
// ==================================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showNotification(error.message);
}

async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username } }
    });
    if (error) showNotification(error.message);
    else showNotification('Cadastro realizado! Verifique seu e-mail para confirmar a conta.', false);
}

function updateUserUI(user) {
    const mainNav = document.getElementById('main-nav');
    if (user) {
        const username = user.user_metadata?.username || user.email;
        userActions.innerHTML = `
            <a href="#/${user.id}/${username}" class="user-display">${username}</a>
            <a href="#/settings" class="btn btn-secondary"><i class="fa-solid fa-gear"></i></a>
            <button id="logout-button" class="btn btn-secondary">Sair</button>
        `;
        document.getElementById('logout-button').addEventListener('click', () => supabase.auth.signOut());
        mainNav.querySelector('a[href="#/Upload"]').classList.remove('hidden');
    } else {
        userActions.innerHTML = `<a href="#/Login" class="btn btn-secondary">Login</a><a href="#/Cadastro" class="btn btn-primary">Criar Conta</a>`;
        mainNav.querySelector('a[href="#/Upload"]').classList.add('hidden');
    }
}

// ==================================================
// == FUNÇÕES DE SCRIPTS
// ==================================================
async function handleSubmitScript(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Publicando...';

    const scriptData = {
        title: document.getElementById('script-title').value,
        game_id: document.getElementById('script-game-id').value,
        tags: document.getElementById('script-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        thumbnail_url: document.getElementById('script-thumbnail-url').value,
        description: document.getElementById('script-description').value,
        code: document.getElementById('script-code').value,
        author_id: user.id
    };

    const { data, error } = await supabase.from('scripts').insert(scriptData).select().single();
    if (error) {
        showNotification('Erro ao publicar o script: ' + error.message);
        submitButton.disabled = false;
        submitButton.textContent = 'Publicar';
    } else {
        window.location.hash = `/${data.id}`;
    }
}

async function loadRecentScripts() {
    const grid = document.getElementById('scripts-grid');
    if (!grid) return;
    
    const { data: scripts, error } = await supabase
        .from('scripts')
        .select(`*, users (username)`)
        .order('created_at', { ascending: false })
        .limit(9);

    if (error) { console.error(error); return; }

    grid.innerHTML = '';
    scripts.forEach(script => {
        const card = document.createElement('a');
        card.className = 'script-card';
        card.href = `#/${script.id}`;
        card.innerHTML = `
            <img src="${script.thumbnail_url}" alt="${script.title}" class="script-card-thumbnail" onerror="this.style.display='none'">
            <div class="script-card-content">
                <h3>${script.title}</h3>
                <p>${script.description.substring(0, 80)}${script.description.length > 80 ? '...' : ''}</p>
            </div>
            <div class="script-card-footer">
                <div class="author-info"><i class="fa-regular fa-user"></i><span>${script.users.username || 'Anônimo'}</span></div>
                <div class="star-button"><i class="fa-regular fa-star"></i><span class="star-count">${script.star_count || 0}</span></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadScriptDetails(scriptId) {
    const { data: script, error } = await supabase
        .from('scripts')
        .select(`*, users (username)`)
        .eq('id', scriptId)
        .single();

    if (error || !script) { window.location.hash = '/404'; return; }

    document.getElementById('script-details-content').innerHTML = `
        <div class="title-header">
            <div>
                <h1 class="title">${script.title}</h1>
                <p class="author">Enviado por <a href="#/${script.author_id}/${script.users.username}">${script.users.username || 'Anônimo'}</a></p>
            </div>
            <button class="star-button large" id="details-star-button"><i class="fa-regular fa-star"></i><span class="star-count">${script.star_count || 0}</span></button>
        </div>
        <div class="box"><div class="box-header"><span>Código Fonte</span><div class="action-buttons"><button class="btn btn-secondary" id="copy-script-btn"><i class="fa-regular fa-copy"></i> Copiar</button></div></div><div class="box-body"><pre><code class="language-lua hljs">${script.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre></div></div>
    `;
    document.getElementById('copy-script-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(script.code);
        showNotification('Código copiado!', false);
    });
    hljs.highlightAll();
    
    document.getElementById('tags-box').classList.add('hidden');
    document.getElementById('comments-box').classList.add('hidden');
}

// ==================================================
// == FUNÇÕES DE PERFIL E CONFIGURAÇÕES
// ==================================================
async function loadUserProfile(userId) {
    const profileContent = document.getElementById('profile-content');
    if (!profileContent) return;

    const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
    if (userError) { window.location.hash = '/404'; return; }

    profileContent.innerHTML = `<div class="profile-header"><h1>${userData.username}</h1></div><h2>Scripts Enviados</h2><div id="user-scripts-grid" class="scripts-grid"></div>`;
    
    const { data: scripts, error: scriptsError } = await supabase.from('scripts').select('*').eq('author_id', userId).order('created_at', { ascending: false });
    const grid = document.getElementById('user-scripts-grid');
    grid.innerHTML = '';
    if (scriptsError || scripts.length === 0) { grid.innerHTML = '<p>Este usuário ainda não publicou nenhum script.</p>'; return; }
    
    scripts.forEach(script => {
        const card = document.createElement('a');
        card.className = 'script-card';
        card.href = `#/${script.id}`;
        card.innerHTML = `<img src="${script.thumbnail_url}" alt="${script.title}" class="script-card-thumbnail" onerror="this.style.display='none'"><div class="script-card-content"><h3>${script.title}</h3></div>`;
        grid.appendChild(card);
    });
}

function setupSettingsPage() {
    document.getElementById('update-username-form').addEventListener('submit', handleUpdateUsername);
    document.getElementById('update-password-form').addEventListener('submit', handleUpdatePassword);
}

async function handleUpdateUsername(e) {
    e.preventDefault();
    const newUsername = document.getElementById('new-username').value.trim();
    if (!newUsername) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', user.id);
    
    if (error) showNotification('Erro ao atualizar o nome de usuário: ' + error.message);
    else showNotification('Nome de usuário atualizado com sucesso!', false);
}

async function handleUpdatePassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    if (!newPassword) return;

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) showNotification('Erro ao atualizar a senha: ' + error.message);
    else {
        showNotification('Senha atualizada com sucesso!', false);
        document.getElementById('new-password').value = '';
    }
}

// ==================================================
// == INICIALIZAÇÃO
// ==================================================
supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    updateUserUI(user);
    router();
});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
