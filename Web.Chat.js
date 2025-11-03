const firebaseConfig = {
    apiKey: "AIzaSyDJN4ylUCR3GFY-6G-oHIdOKlrLPLYb0OE",
    authDomain: "chat-conversation-71277.firebaseapp.com",
    projectId: "chat-conversation-71277",
    storageBucket: "chat-conversation-71277.appspot.com",
    messagingSenderId: "995855170501",
    appId: "1:995855170501:web:6d51bd110f166fb93469ac"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentGroupId = null;
let messageListener = null;
let allGroups = [];

const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const authContainer = document.getElementById('auth-container');
const groupsContainer = document.getElementById('groups-container');
const headerTitle = document.getElementById('header-title');
const groupSettingsBtn = document.getElementById('group-settings-btn');
const mainContent = document.getElementById('main-content');
const placeholderScreen = document.getElementById('placeholder-screen');
const requestsContainer = document.getElementById('requests-container');
const chatContainer = document.getElementById('chat-container');
const inputArea = document.getElementById('input-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const groupList = document.getElementById('group-list');
const searchGroupInput = document.getElementById('search-group-input');

const getGroupIdFromHash = () => {
    const match = window.location.hash.match(/#\/group\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
};

const toggleSidebar = (forceClose = false) => {
    const isOpen = sidebar.classList.contains('open');
    if (forceClose || isOpen) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('visible');
    } else {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('visible');
    }
};

const showDialog = (modalId, content) => {
    const dialog = document.getElementById(modalId);
    dialog.innerHTML = `<div class="modal-content">${content}</div>`;
    dialog.classList.add('active');
    
    const close = () => dialog.classList.remove('active');
    const closeBtn = dialog.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.addEventListener('click', close);
    
    return { dialog, close };
};

const updateUIForAuthState = (user) => {
    authContainer.classList.toggle('hidden', !!user);
    groupsContainer.classList.toggle('hidden', !user);
    headerTitle.textContent = user ? (getGroupIdFromHash() ? headerTitle.textContent : "Grupos") : "Login";
    if (!user) resetChatView();
};

const resetChatView = () => {
    if (messageListener) messageListener();
    currentGroupId = null;
    placeholderScreen.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    inputArea.classList.add('hidden');
    requestsContainer.classList.add('hidden');
    groupSettingsBtn.classList.add('hidden');
    headerTitle.textContent = auth.currentUser ? "Grupos" : "Login";
    window.location.hash = '';
};

auth.onAuthStateChanged(user => {
    updateUIForAuthState(user);
    if (user) {
        loadAllGroups();
        handleRouting();
    } else {
        authContainer.innerHTML = `
            <div class="sidebar-header"><h2>Login</h2><button id="close-sidebar-btn-auth" class="action-btn">&times;</button></div>
            <div class="auth-view">
                <div id="login-view" class="form-group">
                    <label for="login-email">Email</label><input type="email" id="login-email">
                    <label for="login-password">Senha</label><input type="password" id="login-password">
                    <button id="login-button" class="primary-btn">Entrar</button>
                    <button id="google-login-button" class="secondary-btn">Entrar com Google</button>
                    <p>Não tem conta? <a id="show-register">Cadastre-se</a></p>
                </div>
                <div id="register-view" class="form-group hidden">
                    <label for="register-name">Nome</label><input type="text" id="register-name">
                    <label for="register-email">Email</label><input type="email" id="register-email">
                    <label for="register-password">Senha</label><input type="password" id="register-password">
                    <button id="register-button" class="primary-btn">Cadastrar</button>
                    <p>Já tem conta? <a id="show-login">Faça Login</a></p>
                </div>
            </div>`;
        attachAuthListeners();
    }
});

function attachAuthListeners() {
    document.getElementById('close-sidebar-btn-auth')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('show-register')?.addEventListener('click', () => {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('register-view').classList.remove('hidden');
    });
    document.getElementById('show-login')?.addEventListener('click', () => {
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('register-view').classList.add('hidden');
    });
    document.getElementById('login-button')?.addEventListener('click', () => {
        auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value).catch(err => alert(err.message));
    });
    document.getElementById('google-login-button')?.addEventListener('click', () => {
        auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(err => alert(err.message));
    });
    document.getElementById('register-button')?.addEventListener('click', () => {
        const name = document.getElementById('register-name').value;
        if (!name) {
            alert("Por favor, insira um nome.");
            return;
        }
        auth.createUserWithEmailAndPassword(document.getElementById('register-email').value, document.getElementById('register-password').value)
            .then(cred => cred.user.updateProfile({ displayName: name, photoURL: `https://ui-avatars.com/api/?name=${name.replace(/ /g, '+')}&background=random&color=fff` }))
            .catch(err => alert(err.message));
    });
}

const loadAllGroups = () => {
    db.collection('grupos').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        allGroups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterAndRenderGroups();
    });
};

const filterAndRenderGroups = () => {
    const searchTerm = searchGroupInput.value.toLowerCase();
    const filteredGroups = allGroups.filter(group => group.name.toLowerCase().includes(searchTerm));
    renderGroupList(filteredGroups);
};

const renderGroupList = (groupsToRender) => {
    groupList.innerHTML = '';
    const user = auth.currentUser;
    if (!user) return;

    groupsToRender.forEach(group => {
        const li = document.createElement('li');
        li.className = 'group-item';
        li.dataset.groupId = group.id;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-item-name';
        nameSpan.textContent = group.name;
        li.appendChild(nameSpan);

        if (user.uid === group.creatorId) {
            db.collection('grupos').doc(group.id).collection('pedidos').onSnapshot(reqSnap => {
                const existingBadge = li.querySelector('.notification-badge');
                if (existingBadge) existingBadge.remove();
                if (!reqSnap.empty) {
                    const badge = document.createElement('div');
                    badge.className = 'notification-badge';
                    badge.textContent = reqSnap.size;
                    li.appendChild(badge);
                }
            });
        }

        if (group.id === currentGroupId) li.classList.add('active');
        li.addEventListener('click', () => handleGroupClick(group));
        groupList.appendChild(li);
    });
};

const handleGroupClick = (group) => {
    const user = auth.currentUser;
    const isMember = group.members && group.members.includes(user.uid);
    const isCreator = user.uid === group.creatorId;

    if (isMember || isCreator) {
        window.location.hash = `/group/${group.id}`;
        toggleSidebar(true);
    } else {
        const { close } = showDialog('custom-dialog', `
            <div class="modal-header"><h2>Entrar no Grupo</h2></div>
            <div class="modal-body"><p>Você gostaria de pedir para entrar no grupo "${group.name}"?</p></div>
            <div class="modal-footer">
                <button id="cancel-join" class="secondary-btn">Cancelar</button>
                <button id="confirm-join" class="primary-btn">Pedir para Entrar</button>
            </div>
        `);
        document.getElementById('cancel-join').addEventListener('click', close);
        document.getElementById('confirm-join').addEventListener('click', () => {
            requestToJoinGroup(group.id);
            close();
        });
    }
};

const requestToJoinGroup = (groupId) => {
    const user = auth.currentUser;
    if (!user) return;
    db.collection('grupos').doc(groupId).collection('pedidos').doc(user.uid).set({
        displayName: user.displayName,
        photoURL: user.photoURL,
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Seu pedido para entrar no grupo foi enviado!");
    }).catch(err => {
        console.error("Erro ao enviar pedido:", err);
        alert("Erro ao enviar pedido: " + err.message);
    });
};

const selectGroup = async (groupId) => {
    if (!auth.currentUser) return;
    if (messageListener) messageListener();
    currentGroupId = groupId;
    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
    requestsContainer.classList.add('hidden');
    requestsContainer.innerHTML = '';
    groupSettingsBtn.classList.add('hidden');

    if (groupId) {
        try {
            const groupDoc = await db.collection('grupos').doc(groupId).get();
            if (!groupDoc.exists) { resetChatView(); return; }
            
            const groupData = groupDoc.data();
            headerTitle.textContent = groupData.name;
            document.querySelector(`.group-item[data-group-id="${groupId}"]`)?.classList.add('active');
            
            const isCreator = auth.currentUser.uid === groupData.creatorId;
            const isMember = groupData.members && groupData.members.includes(auth.currentUser.uid);

            if (!isCreator && !isMember) {
                resetChatView();
                alert("Você não tem permissão para ver este grupo.");
                return;
            }

            if (isCreator) {
                renderJoinRequests(groupId);
                groupSettingsBtn.classList.remove('hidden');
            }

            placeholderScreen.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            inputArea.classList.remove('hidden');
            renderMessages(groupId);
        } catch (error) {
            console.error("Erro ao selecionar grupo:", error);
            resetChatView();
        }
    } else {
        resetChatView();
    }
};

const renderJoinRequests = (groupId) => {
    db.collection('grupos').doc(groupId).collection('pedidos').onSnapshot(snapshot => {
        if (snapshot.empty) {
            requestsContainer.classList.add('hidden');
            requestsContainer.innerHTML = '';
            return;
        }
        requestsContainer.classList.remove('hidden');
        requestsContainer.innerHTML = '<h3>Pedidos para entrar:</h3>';
        snapshot.forEach(doc => {
            const request = doc.data();
            const item = document.createElement('div');
            item.className = 'request-item';
            item.innerHTML = `
                <span>${request.displayName}</span>
                <div>
                    <button class="primary-btn" data-uid="${doc.id}" data-name="${request.displayName}">Aceitar</button>
                    <button class="danger-btn" data-uid="${doc.id}">Recusar</button>
                </div>`;
            requestsContainer.appendChild(item);
        });
    });
};

requestsContainer.addEventListener('click', e => {
    const uid = e.target.dataset.uid;
    if (!uid || !currentGroupId) return;

    if (e.target.classList.contains('primary-btn')) {
        const name = e.target.dataset.name;
        const { close } = showDialog('custom-dialog', `
            <div class="modal-header"><h2>Confirmar Ação</h2></div>
            <div class="modal-body"><p>Você tem certeza que deseja aceitar <strong>${name}</strong> no grupo?</p></div>
            <div class="modal-footer">
                <button id="cancel-action" class="secondary-btn">Cancelar</button>
                <button id="confirm-action" class="primary-btn">Aceitar</button>
            </div>
        `);
        document.getElementById('cancel-action').addEventListener('click', close);
        document.getElementById('confirm-action').addEventListener('click', () => {
            db.collection('grupos').doc(currentGroupId).update({
                members: firebase.firestore.FieldValue.arrayUnion(uid)
            }).then(() => {
                db.collection('grupos').doc(currentGroupId).collection('pedidos').doc(uid).delete();
            });
            close();
        });
    } else if (e.target.classList.contains('danger-btn')) {
        db.collection('grupos').doc(currentGroupId).collection('pedidos').doc(uid).delete();
    }
});

const renderMessages = (groupId) => {
    messageListener = db.collection('grupos').doc(groupId).collection('mensagens').orderBy('timestamp').onSnapshot(snapshot => {
        chatContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const user = auth.currentUser;
            const isCurrentUser = user && user.uid === msg.uid;
            const msgEl = document.createElement('div');
            msgEl.className = `message ${isCurrentUser ? 'user' : 'other'}`;
            
            const displayName = msg.displayName || 'Usuário';
            const avatar = msg.photoURL ? `<img src="${msg.photoURL}" alt="avatar">` : displayName.charAt(0).toUpperCase();
            
            const deleteBtnHtml = isCurrentUser ? `<button class="delete-msg-btn" data-msg-id="${doc.id}"><i class="fa-solid fa-trash"></i></button>` : '';
            const messageBodyHtml = `<div class="message-body">${deleteBtnHtml}<div class="message-sender">${displayName}</div><div class="message-content">${msg.text}</div></div>`;
            const avatarHtml = `<div class="message-avatar">${avatar}</div>`;

            msgEl.innerHTML = isCurrentUser ? messageBodyHtml + avatarHtml : avatarHtml + messageBodyHtml;
            chatContainer.appendChild(msgEl);
        });
        mainContent.scrollTop = mainContent.scrollHeight;
    }, error => {
        console.error("Erro ao carregar mensagens: ", error);
        chatContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Não foi possível carregar as mensagens. Verifique suas regras de segurança do Firestore.</p>`;
    });
};

const handleSend = () => {
    const text = messageInput.value.trim();
    const user = auth.currentUser;
    if (text === '' || !user || !currentGroupId) return;
    db.collection('grupos').doc(currentGroupId).collection('mensagens').add({
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL
    }).catch(error => {
        console.error("Erro ao enviar mensagem: ", error);
        alert("Não foi possível enviar a mensagem. Verifique suas permissões.");
    });
    messageInput.value = '';
};

chatContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-msg-btn');
    if (deleteBtn && currentGroupId) {
        const messageId = deleteBtn.dataset.msgId;
        if (confirm("Tem certeza que deseja apagar esta mensagem?")) {
            db.collection('grupos').doc(currentGroupId).collection('mensagens').doc(messageId).delete()
                .catch(err => alert("Erro ao apagar mensagem: " + err.message));
        }
    }
});

menuBtn.addEventListener('click', () => toggleSidebar());
sidebarOverlay.addEventListener('click', () => toggleSidebar(true));

document.getElementById('create-group-btn').addEventListener('click', () => {
    const groupName = prompt("Digite o nome do novo grupo:");
    const user = auth.currentUser;
    if (groupName && user) {
        db.collection('grupos').add({
            name: groupName,
            creatorId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            members: [user.uid]
        }).then(docRef => {
            window.location.hash = `/group/${docRef.id}`;
        });
    }
});

document.getElementById('settings-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return;

    const { dialog, close } = showDialog('settings-modal', `
        <div class="modal-header">
            <h2>Configurações</h2>
            <button class="action-btn close-modal-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group photo-preview-container">
                <img id="photo-preview" src="${user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName?.replace(/ /g, '+') || 'A'}&background=random&color=fff`}" alt="Preview da foto">
            </div>
            <div class="form-group">
                <label for="settings-photo-url">URL da Foto</label>
                <input type="text" id="settings-photo-url" value="${user.photoURL || ''}">
            </div>
            <div class="form-group">
                <label for="settings-name">Nome de Exibição</label>
                <input type="text" id="settings-name" value="${user.displayName || ''}">
            </div>
            <div class="form-group">
                <button id="update-profile-btn" class="primary-btn">Salvar Alterações</button>
            </div>
            <div class="form-group">
                <button id="logout-btn" class="danger-btn">Sair (Logout)</button>
            </div>
        </div>
    `);

    const photoPreview = dialog.querySelector('#photo-preview');
    const photoUrlInput = dialog.querySelector('#settings-photo-url');

    photoUrlInput.addEventListener('input', () => {
        const newUrl = photoUrlInput.value.trim();
        const displayName = dialog.querySelector('#settings-name').value || 'A';
        if (newUrl) {
            photoPreview.src = newUrl;
        } else {
            photoPreview.src = `https://ui-avatars.com/api/?name=${displayName.replace(/ /g, '+')}&background=random&color=fff`;
        }
    });

    dialog.querySelector('#logout-btn').addEventListener('click', () => {
        auth.signOut();
        close();
    });

    dialog.querySelector('#update-profile-btn').addEventListener('click', async () => {
        const newName = dialog.querySelector('#settings-name').value;
        const newPhotoURL = dialog.querySelector('#settings-photo-url').value.trim();
        const updateButton = dialog.querySelector('#update-profile-btn');
        updateButton.disabled = true;
        updateButton.textContent = 'Salvando...';

        try {
            if (newName !== user.displayName || newPhotoURL !== user.photoURL) {
                await user.updateProfile({ displayName: newName, photoURL: newPhotoURL });
            }
            alert("Perfil atualizado com sucesso!");
            close();
        } catch (err) {
            alert("Erro ao atualizar perfil: " + err.message);
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = 'Salvar Alterações';
        }
    });
});

groupSettingsBtn.addEventListener('click', async () => {
    if (!currentGroupId) return;
    const groupDoc = await db.collection('grupos').doc(currentGroupId).get();
    const groupData = groupDoc.data();

    const { dialog, close } = showDialog('group-settings-modal', `
        <div class="modal-header">
            <h2>Configurações do Grupo</h2>
            <button class="action-btn close-modal-btn">&times;</button>
        </div>
        <div class="modal-tabs">
            <button class="tab-btn active" data-tab="members">Membros</button>
            <button class="tab-btn" data-tab="info">Informações</button>
        </div>
        <div class="modal-body">
            <div id="members-tab" class="tab-content active"></div>
            <div id="info-tab" class="tab-content">
                <p><strong>Nome do Grupo:</strong> ${groupData.name}</p>
                <p><strong>ID do Grupo:</strong> ${currentGroupId}</p>
            </div>
        </div>
    `);

    const membersTab = dialog.querySelector('#members-tab');
    const memberPromises = groupData.members.map(uid => db.collection('users').doc(uid).get().catch(() => null));
    const memberDocs = await Promise.all(memberPromises);
    
    membersTab.innerHTML = '<div class="member-list"></div>';
    const memberListEl = membersTab.querySelector('.member-list');

    memberDocs.forEach(memberDoc => {
        if (!memberDoc || !memberDoc.exists) return;
        const memberData = memberDoc.data();
        const memberEl = document.createElement('div');
        memberEl.className = 'member-item';
        const isCreator = memberData.uid === groupData.creatorId;
        const canBeKicked = auth.currentUser.uid === groupData.creatorId && !isCreator;

        memberEl.innerHTML = `
            <div class="member-info">
                <img src="${memberData.photoURL || `https://ui-avatars.com/api/?name=${memberData.displayName.replace(/ /g, '+')}`}" alt="avatar">
                <span>${memberData.displayName} ${isCreator ? '(Dono)' : ''}</span>
            </div>
            ${canBeKicked ? `<button class="kick-btn" data-uid="${memberData.uid}" data-name="${memberData.displayName}"><i class="fa-solid fa-times"></i></button>` : ''}
        `;
        memberListEl.appendChild(memberEl);
    });

    dialog.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            dialog.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            dialog.querySelector(`#${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    dialog.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uidToKick = e.currentTarget.dataset.uid;
            const nameToKick = e.currentTarget.dataset.name;
            if (confirm(`Tem certeza que deseja remover ${nameToKick} do grupo?`)) {
                db.collection('grupos').doc(currentGroupId).update({
                    members: firebase.firestore.FieldValue.arrayRemove(uidToKick)
                }).then(() => {
                    alert(`${nameToKick} foi removido.`);
                    close();
                });
            }
        });
    });
});

sendButton.addEventListener('click', handleSend);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
searchGroupInput.addEventListener('input', filterAndRenderGroups);

const handleRouting = () => selectGroup(getGroupIdFromHash());
window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', () => {
    attachAuthListeners();
    handleRouting();
});
