// Configuração do Firebase (use a sua)
const firebaseConfig = {
    apiKey: "AIzaSyDJN4ylUCR3GFY-6G-oHIdOKlrLPLYb0OE",
    authDomain: "chat-conversation-71277.firebaseapp.com",
    projectId: "chat-conversation-71277",
    storageBucket: "chat-conversation-71277.appspot.com",
    messagingSenderId: "995855170501",
    appId: "1:995855170501:web:6d51bd110f166fb93469ac"
};

// Inicialização do Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const messagesCollection = db.collection('mensagens');

// Elementos da UI
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const settingsContainer = document.getElementById('settings-container');

const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');

// Funções para trocar de tela
const showChatView = () => {
    authContainer.classList.add('hidden');
    settingsContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
};

const showAuthView = () => {
    chatContainer.classList.add('hidden');
    settingsContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
};

const showSettingsView = () => {
    chatContainer.classList.add('hidden');
    authContainer.classList.add('hidden');
    settingsContainer.classList.remove('hidden');
    
    const user = auth.currentUser;
    if (user) {
        document.getElementById('settings-photo').src = user.photoURL || 'https://via.placeholder.com/100';
        document.getElementById('settings-email').textContent = user.email;
        document.getElementById('settings-name').value = user.displayName || '';
        document.getElementById('settings-photo-url').value = user.photoURL || '';
    }
};

// --- LÓGICA DE AUTENTICAÇÃO ---

// Observador de estado de autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        // Usuário está logado
        document.getElementById('welcome-message').textContent = `Bem-vindo, ${user.displayName || user.email}!`;
        showChatView();
        listenForMessages();
    } else {
        // Usuário está deslogado
        showAuthView();
    }
});

// Trocar entre login e registro
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginView.classList.add('hidden');
    registerView.classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerView.classList.add('hidden');
    loginView.classList.remove('hidden');
});

// Cadastro com E-mail/Senha
document.getElementById('register-button').addEventListener('click', () => {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Atualiza o perfil com o nome
            return userCredential.user.updateProfile({
                displayName: name,
                photoURL: `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random`
            });
        })
        .then(() => {
            console.log("Usuário cadastrado e perfil atualizado!");
        })
        .catch(error => alert(error.message));
});

// Login com E-mail/Senha
document.getElementById('login-button').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
});

// Login com Google
document.getElementById('google-login-button').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => alert(error.message));
});

// Logout
document.getElementById('logout-button').addEventListener('click', () => {
    auth.signOut();
});

// --- LÓGICA DO CHAT ---

const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Enviar mensagem
const sendMessage = () => {
    const text = messageInput.value.trim();
    const user = auth.currentUser;

    if (text === '' || !user) return;

    messagesCollection.add({
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL
    })
    .then(() => {
        messageInput.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(error => console.error("Erro ao enviar mensagem:", error));
};

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Ouvir mensagens
let unsubscribeMessages = null;
function listenForMessages() {
    // Cancela o listener anterior para não duplicar
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    unsubscribeMessages = messagesCollection.orderBy('timestamp').onSnapshot(snapshot => {
        chatBox.innerHTML = '';
        snapshot.forEach(doc => {
            const message = doc.data();
            const messageElement = document.createElement('div');
            
            const currentUser = auth.currentUser;
            const messageClass = (currentUser && message.uid === currentUser.uid) ? 'sent' : 'received';
            
            messageElement.classList.add('message', messageClass);
            
            messageElement.innerHTML = `
                <img src="${message.photoURL || 'https://via.placeholder.com/40'}" alt="Foto" class="profile-pic">
                <div class="message-content">
                    <strong>${message.displayName || 'Anônimo'}</strong>
                    <div>${message.text}</div>
                </div>
            `;
            chatBox.appendChild(messageElement);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// --- LÓGICA DAS CONFIGURAÇÕES ---

document.getElementById('settings-button').addEventListener('click', showSettingsView);
document.getElementById('back-to-chat-button').addEventListener('click', showChatView);

document.getElementById('update-profile-button').addEventListener('click', () => {
    const user = auth.currentUser;
    const newName = document.getElementById('settings-name').value;
    const newPhotoURL = document.getElementById('settings-photo-url').value;

    if (user) {
        user.updateProfile({
            displayName: newName,
            photoURL: newPhotoURL
        }).then(() => {
            alert("Perfil atualizado com sucesso!");
            document.getElementById('welcome-message').textContent = `Bem-vindo, ${newName}!`;
            showChatView();
        }).catch(error => alert(error.message));
    }
});
