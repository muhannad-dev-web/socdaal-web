console.log('INDEX.JS WUU SHAQEYNAYAA — TIJAABO');

// ==================== GLOBAL ERROR HANDLER ====================
function friendlyError(err) {
    if (!err) return 'Wax khalad ah ayaa dhacay. Isku day mar kale.';
    const msg = (err.message || err.code || String(err)).toLowerCase();
    if (msg.includes('network') || msg.includes('offline') || msg.includes('unavailable')) return 'Internet-ka xiriirka ka eeg oo isku day mar kale.';
    if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('unauthenticated')) return 'Fasax uma lihid falkan. Dib u soo gal.';
    if (msg.includes('not-found') || msg.includes('no such')) return 'Xogta la doondooney lama helin.';
    if (msg.includes('quota') || msg.includes('resource-exhausted')) return 'Adeeska hadda waa culus. Daqiiqad ka dib isku day.';
    if (msg.includes('timeout') || msg.includes('deadline')) return 'Xiriirku waa gaabis. Isku day mar kale.';
    if (msg.includes('upload') || msg.includes('storage')) return 'Faylka diridda way fashilantay. Cabbirka hubi oo isku day.';
    if (msg.includes('failed-precondition') || msg.includes('index')) return 'Nidaamka waa la cusbooneysiinayaa. Daqiiqad ka dib isku day.';
    return 'Wax khalad ah ayaa dhacay. Isku day mar kale.';
}

// Catch unhandled JS errors — ha u muuqan user-ka technical errors
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise:', e.reason);
    e.preventDefault();
});

// ==================== FIREBASE CONFIG ====================
let app = null;
let auth = null;
let db = null;
let storage = null;
let fv = null;
let googleProvider = null;

async function initApp() {
    let config = window.firebaseConfig;

    // Try fetching from API endpoint if no global config
    if (!config) {
        try {
            const res = await fetch('/api/firebase-config');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            config = data;
        } catch (err) {
            console.error('Firebase config fetch failed:', err);
        }
    }

    if (!config) {
        console.error('Firebase config ma jiro!');
        alert('Firebase ma loo diyaarin karo. Fadlan hubi xiriirka.');
        return false;
    }

    app = firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    fv = firebase.firestore.FieldValue;
    googleProvider = new firebase.auth.GoogleAuthProvider();

    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
        console.error('Persistence error:', err);
    });

    return true;
}

// ==================== SUPABASE STORAGE CONFIG ====================
const SUPABASE_URL = 'https://zjvulempswddsbwnyykk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdnVsZW1wc3dkZHNid255eWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Nzc4MjIsImV4cCI6MjA5ODQ1MzgyMn0.Eo2ixIVRtJMZuj6LuJCP4J0dep5Pt4YUOhybrJ0euJs';

// ==================== IMAGE COMPRESSION ====================
async function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                URL.revokeObjectURL(url);
                resolve(blob || file);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

async function uploadToSupabase(fileBlob, folder, filename) {
    const path = `${folder}/${filename}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/socdaal-media/${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': fileBlob.type || 'application/octet-stream',
            'x-upsert': 'true'
        },
        body: fileBlob
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error('Upload fashilantay: ' + res.status + ' ' + errText);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/socdaal-media/${path}`;
}

// ==================== STATE ====================
let currentUser = null;
let currentUserProfile = null;
let isAdmin = false;
let activeChatId = 'group';
let activeChatType = 'group';
let activeReplyIndex = null;
let contextMenuIndex = null;
let forwardIndex = null;
let voiceRecorder = null;
let voiceChunks = [];
let isRecording = false;
let videoStream = null;
let editorImageBase64 = null;
let editorImageObj = null;
let editorCanvasCtx = null;
let editorTool = 'none';

// MOTION SENSOR STATE
let isTrackingMotion = false;
let lastAcc = { x: 0, y: 0, z: 0 };
let stepCooldown = false;
let stepThreshold = 11.5; // Upper threshold for peak detection
let autoSaveInterval = null;
let syncedStepCount = 0; // Steps already synced to Firestore
let accelBuffer = [];
const BUFFER_SIZE = 10;
let lastMouseY = 0;
let mouseStepCooldown = false;
let todayTotalSteps = 0; // Total steps for today (persists across pause/resume)
let DAILY_STEP_GOAL = 10000; // Default daily step goal

let dbUsersCache = [];
let dbGroupsCache = [];
let globalMessagesCache = [];
let directMessagesCache = [];
let challengeCache = { title: 'Tartanka Nabadda & Caafimaadka', goal: 50000 };
let unsubGlobalMessages = null;
let unsubGroups = null;
let unsubUsers = null;
let unsubChallenge = null;
let unsubDirectMessages = null;
let calcFormData = null;
let chatFontSize = 13;
let currentFollowRequests = [];
let lastStepDate = null;

// ==================== UTILITIES ====================
function showToast(msg, success = true) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    toastMsg.textContent = msg;
    toastIcon.className = success ? "fa-solid fa-circle-check text-brand text-lg" : "fa-solid fa-triangle-exclamation text-red-500 text-lg";
    toast.classList.remove('translate-y-[-150%]');
    toast.classList.add('translate-y-[0]');
    setTimeout(() => { toast.classList.remove('translate-y-[0]'); toast.classList.add('translate-y-[-150%]'); }, 3000);
}

function showLoading(text = 'LOADING...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = text;
    if (overlay) { overlay.classList.remove('hidden'); overlay.style.opacity = '1'; }
    setTimeout(() => hideLoading(), 800);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.classList.add('hidden'), 300); }
}

function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const authIcon = document.getElementById('themeIconAuth');
    const portalIcon = document.getElementById('themeIconPortal');
    if (authIcon) authIcon.className = isDark ? "fa-solid fa-sun text-brand text-lg" : "fa-solid fa-moon text-slate-800 text-lg";
    if (portalIcon) portalIcon.className = isDark ? "fa-solid fa-sun text-brand" : "fa-solid fa-moon text-slate-800";
}

function getSyntheticEmail(username) {
    return `${username.toLowerCase().replace(/\s+/g, '')}@socdaal.app`;
}

function getCountryFlag(country) {
    const flags = { 'Somalia': '🇸🇴', 'Kenya': '🇰🇪', 'Ethiopia': '🇪🇹', 'Djibouti': '🇩🇯', 'USA': '🇺🇸', 'UK': '🇬🇧', 'Canada': '🇨🇦', 'UAE': '🇦🇪', 'Other': '🌍' };
    return flags[country] || '🌍';
}

function formatVoiceTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(ts) {
    if (!ts) return '--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('so-SO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(ts) {
    if (!ts) return '--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('so-SO', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name) {
    return (name || 'U').charAt(0).toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== AUTHENTICATION ====================
async function handleSignIn(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { showToast('Buuxi dhamaan meelaha!', false); return; }
    showLoading('Soo galaya...');
    try {
        await auth.signInWithEmailAndPassword(getSyntheticEmail(username), password);
        showToast('Soo galidda waa guul!', true);
    } catch (err) {
        const errDiv = document.getElementById('authError');
        const errText = document.getElementById('authErrorText');
        let friendlyMsg = '';
        switch (err.code) {
            case 'auth/user-not-found':
                friendlyMsg = 'Account-kan ma jiro! Username-kan lama diiwaangelin. Fadlan isticmaal Sign Up.';
                break;
            case 'auth/wrong-password':
                friendlyMsg = 'Password-ku waa khalad! Fadlan isku day mar kale.';
                break;
            case 'auth/invalid-credential':
                friendlyMsg = 'Username ama Password-ku waa khalad! Fadlan hubi labadaba.';
                break;
            case 'auth/invalid-email':
                friendlyMsg = 'Username-kaagu wuxuu ka kooban yahay xarfo aan la oggolayn.';
                break;
            case 'auth/too-many-requests':
                friendlyMsg = 'Wax badan ayaad isku daydey! Fadlan sug yar kadib isku day mar kale.';
                break;
            default:
                friendlyMsg = 'Soo galidda way fashilantay. Fadlan hubi xiriirka internet-ka.';
        }
        errText.textContent = friendlyMsg;
        errDiv.classList.remove('hidden');
        showToast(friendlyMsg, false);
    } finally {
        hideLoading();
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim().replace(/\s+/g, '');
    const password = document.getElementById('regPassword').value;
    const country = document.getElementById('regCountry').value;
    if (!username || !password || password.length < 6) { showToast('Buuxi dhamaan meelaha si sax ah!', false); return; }
    showLoading('Account la abuurayo...');
    try {
        const cred = await auth.createUserWithEmailAndPassword(getSyntheticEmail(username), password);
        await db.collection('users').doc(cred.user.uid).set({
            username: username,
            displayName: username,
            country: country,
            photoURL: null,
            steps: 0,
            weeklySteps: 0,
            todaySteps: 0,
            lastStepDate: null,
            createdAt: fv.serverTimestamp(),
            followers: [],
            following: [],
            followRequests: [],
            dailyHistory: []
        });
        await cred.user.updateProfile({ displayName: username });
        showToast('Account-ka waa la abuuray!', true);
    } catch (err) {
        const errDiv = document.getElementById('authError');
        const errText = document.getElementById('authErrorText');
        let friendlyMsg = err.code === 'auth/email-already-in-use'
            ? 'Username-kan horey ayuu u jiray! Fadlan dooro mid kale ama isticmaal Sign In.'
            : 'Diiwaangelinta way fashilantay. Fadlan hubi xiriirka internet-ka.';
        errText.textContent = friendlyMsg;
        errDiv.classList.remove('hidden');
        showToast(friendlyMsg, false);
    } finally {
        hideLoading();
    }
}

async function handleGoogleSignIn() {
    showLoading('Gmail loo socdaa...');
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        const userDocRef = db.collection('users').doc(user.uid);
        const snap = await userDocRef.get();

        if (!snap.exists) {
            let baseUsername = (user.email || 'user').split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            if (!baseUsername) baseUsername = 'user' + Math.floor(Math.random() * 10000);
            await userDocRef.set({
                username: baseUsername,
                displayName: user.displayName || baseUsername,
                country: 'Other',
                photoURL: user.photoURL || null,
                email: user.email || null,
                authProvider: 'google',
                steps: 0,
                weeklySteps: 0,
                todaySteps: 0,
                lastStepDate: null,
                createdAt: fv.serverTimestamp(),
                followers: [],
                following: [],
                followRequests: [],
                dailyHistory: []
            });
            showToast('Ku soo dhowow! Account-kaaga Gmail waa la abuuray.', true);
        } else {
            showToast('Gmail-kaaga si guul leh ayaad ugu soo gashay!', true);
        }
    } catch (err) {
        if (err.code === 'auth/popup-closed-by-user') {
            showToast('Gmail login waa la joojiyay.', false);
        } else {
            showToast(friendlyError(err), false);
        }
    } finally {
        hideLoading();
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    if (!username || !password) { showToast('Buuxi admin credentials!', false); return; }
    showLoading('Admin login...');
    try {
        await auth.signInWithEmailAndPassword(getSyntheticEmail(username), password);
        const snap = await db.collection('users').where('username', '==', username).get();
        if (!snap.empty && snap.docs[0].data().role === 'admin') {
            isAdmin = true;
            showToast('Admin login waa guul!', true);
        } else {
            isAdmin = false;
            showToast('Ma aha admin!', false);
            await auth.signOut();
        }
    } catch (err) {
        showToast(friendlyError(err), false);
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        const loginUsername = document.getElementById('loginUsername');
        const loginPassword = document.getElementById('loginPassword');
        if (loginUsername) loginUsername.value = '';
        if (loginPassword) loginPassword.value = '';
        await auth.signOut();
        showToast('Waa la ka baxay!', true);
    } catch (err) {
        showToast('Ka bixidda way fashilantay!', false);
    }
}

function showAuthView(show) {
    document.getElementById('authView').classList.toggle('hidden', !show);
    document.getElementById('portalView').classList.toggle('hidden', show);
}

function updateProfileUI() {
    if (!currentUserProfile) return;
    const initials = getInitials(currentUserProfile.displayName || currentUserProfile.username);
    const navImg = document.getElementById('navProfileImg');
    const navInitial = document.getElementById('navProfileInitial');
    const drawerImg = document.getElementById('drawerProfileImg');
    const drawerInitial = document.getElementById('drawerProfileInitial');
    const editUsername = document.getElementById('editUsername');
    if (currentUserProfile.photoURL) {
        navImg.src = currentUserProfile.photoURL; navImg.classList.remove('hidden'); navInitial.classList.add('hidden');
        drawerImg.src = currentUserProfile.photoURL; drawerImg.classList.remove('hidden'); drawerInitial.classList.add('hidden');
    } else {
        navImg.classList.add('hidden'); navInitial.classList.remove('hidden'); navInitial.textContent = initials;
        drawerImg.classList.add('hidden'); drawerInitial.classList.remove('hidden'); drawerInitial.textContent = initials;
    }
    if (editUsername) editUsername.value = currentUserProfile.username || '';
}

// ==================== REALTIME LISTENERS ====================
function listenToRealtimeData() {
    listenToUsers();
    listenToGroups();
    listenToChallenge();
    listenToGlobalMessages();
    listenToFollowRequests();
}

function detachListeners() {
    if (unsubGlobalMessages) { unsubGlobalMessages(); unsubGlobalMessages = null; }
    if (unsubGroups) { unsubGroups(); unsubGroups = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    if (unsubChallenge) { unsubChallenge(); unsubChallenge = null; }
    if (unsubDirectMessages) { unsubDirectMessages(); unsubDirectMessages = null; }
}

function listenToUsers() {
    unsubUsers = db.collection('users').onSnapshot(snap => {
        dbUsersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFriendsList();
        renderAdminUserList();
        renderAdminLeaderboard();
    });
}

function listenToGroups() {
    unsubGroups = db.collection('groups').onSnapshot(snap => {
        dbGroupsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFriendsList();
        renderAdminGroupList();
    });
}

function listenToChallenge() {
    unsubChallenge = db.collection('challenges').doc('weekly').onSnapshot(snap => {
        if (snap.exists) {
            challengeCache = snap.data();
            updateChallengeUI();
        }
    });
}

function listenToGlobalMessages() {
    if (unsubGlobalMessages) { unsubGlobalMessages(); }
    unsubGlobalMessages = db.collection('messages').where('type', '==', 'global').orderBy('timestamp', 'asc').onSnapshot(snap => {
        globalMessagesCache = snap.docs.map((d, i) => ({ index: i, id: d.id, ...d.data() }));
        if (activeChatType === 'group') {
            renderMessages(globalMessagesCache);
        }
    });
}

function listenToDirectMessages(otherUserId) {
    if (unsubDirectMessages) { unsubDirectMessages(); }
    const me = currentUser.uid;
    const ids = [me, otherUserId].sort();
    const convoId = ids.join('_');
    unsubDirectMessages = db.collection('directMessages').doc(convoId).collection('messages').orderBy('timestamp', 'asc').onSnapshot(snap => {
        directMessagesCache = snap.docs.map((d, i) => ({ index: i, id: d.id, ...d.data() }));
        if (activeChatType === 'direct' && activeChatId === otherUserId) {
            renderMessages(directMessagesCache);
        }
    });
}

function listenToFollowRequests() {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).onSnapshot(snap => {
        if (snap.exists) {
            const data = snap.data();
            currentFollowRequests = data.followRequests || [];
            updateFollowBadge();
        }
    });
}

function updateFollowBadge() {
    const badge = document.getElementById('followBadgeNumber');
    const count = currentFollowRequests.length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ==================== ANALYTICS ====================
function incrementSiteViews() {
    db.collection('analytics').doc('siteViews').get().then(snap => {
        if (snap.exists) {
            db.collection('analytics').doc('siteViews').update({ count: fv.increment(1) });
        } else {
            db.collection('analytics').doc('siteViews').set({ count: 1 });
        }
    }).catch(() => {});
}

// ==================== UI RENDERING ====================
function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-slate-400 py-10">Fariin ma jiro hadda. Qor farriin cusub!</div>`;
        return;
    }
    messages.forEach((msg, i) => {
        const isMe = msg.senderId === (currentUser ? currentUser.uid : '');
        const isImage = msg.messageType === 'image';
        const isVoice = msg.messageType === 'voice';
        const isReply = msg.replyTo != null;
        const replyHtml = isReply ? `<div class="bg-brand/10 rounded-lg px-2 py-1 mb-1 text-[10px] text-brand border-l-2 border-brand"><span class="font-bold">${escapeHtml(msg.replyToSender || 'Qof')}: </span>${escapeHtml(msg.replyToText || '').substring(0, 50)}</div>` : '';
        const contentHtml = isImage ? `<img src="${escapeHtml(msg.content)}" class="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition" onclick="window.open('${escapeHtml(msg.content)}','_blank')">` :
            isVoice ? `<div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2"><button class="text-brand" onclick="playAudio('${escapeHtml(msg.content)}')"><i class="fa-solid fa-play"></i></button><span class="text-xs">${msg.voiceDuration || '0:00'}</span></div>` :
            `<p class="text-xs leading-relaxed">${escapeHtml(msg.content)}</p>`;
        const html = `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} group" data-index="${i}">
                <div class="max-w-[75%] ${isMe ? 'bg-brand text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100'} rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer message-bubble" style="font-size: ${chatFontSize}px;">
                    ${!isMe ? `<div class="text-[10px] font-bold mb-1 opacity-70">${escapeHtml(msg.senderName || 'Qof')}</div>` : ''}
                    ${replyHtml}
                    ${contentHtml}
                    <div class="text-[9px] opacity-50 mt-1 text-right">${formatTime(msg.timestamp)}</div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
    container.scrollTop = container.scrollHeight;

    container.querySelectorAll('.message-bubble').forEach((bubble, idx) => {
        bubble.addEventListener('click', () => {
            contextMenuIndex = idx;
            showMessageContextMenu(idx);
        });
    });
}

function playAudio(url) {
    const a = new Audio(url);
    a.play();
}

function renderFriendsList() {
    const list = document.getElementById('friendsList');
    if (!list) return;
    list.innerHTML = '';

    const globalBtn = document.createElement('div');
    globalBtn.className = `flex items-center space-x-2 p-2 rounded-xl cursor-pointer transition ${activeChatType === 'group' && activeChatId === 'group' ? 'bg-brand/10 text-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
    globalBtn.innerHTML = `<div class="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">G</div><div><div class="text-xs font-bold">Group-ka Guud</div><div class="text-[10px] text-slate-400">Dhammaan</div></div>`;
    globalBtn.onclick = () => switchChat('group', 'group');
    list.appendChild(globalBtn);

    if (dbGroupsCache.length > 0) {
        const groupsLabel = document.createElement('div');
        groupsLabel.className = 'text-[10px] text-slate-400 font-bold px-2 mt-2 mb-1 uppercase';
        groupsLabel.textContent = 'Kooxaha';
        list.appendChild(groupsLabel);
    }
    dbGroupsCache.forEach(g => {
        const isActive = activeChatType === 'group' && activeChatId === g.id;
        const div = document.createElement('div');
        div.className = `flex items-center space-x-2 p-2 rounded-xl cursor-pointer transition ${isActive ? 'bg-brand/10 text-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
        div.innerHTML = `<div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">K</div><div><div class="text-xs font-bold">${escapeHtml(g.name)}</div><div class="text-[10px] text-slate-400">${(g.members || []).length} xubnood</div></div>`;
        div.onclick = () => switchChat('group', g.id);
        list.appendChild(div);
    });

    const myFollowing = currentUserProfile ? (currentUserProfile.following || []) : [];
    const friends = dbUsersCache.filter(u => u.id !== currentUser.uid && myFollowing.includes(u.id));
    const others = dbUsersCache.filter(u => u.id !== currentUser.uid && !myFollowing.includes(u.id));

    if (friends.length > 0) {
        const friendsLabel = document.createElement('div');
        friendsLabel.className = 'text-[10px] text-slate-400 font-bold px-2 mt-2 mb-1 uppercase';
        friendsLabel.textContent = 'Saaxiibada';
        list.appendChild(friendsLabel);
        friends.forEach(u => {
            const isActive = activeChatType === 'direct' && activeChatId === u.id;
            const div = document.createElement('div');
            div.className = `flex items-center space-x-2 p-2 rounded-xl cursor-pointer transition ${isActive ? 'bg-brand/10 text-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
            const avatar = u.photoURL 
                ? `<img src="${u.photoURL}" class="w-8 h-8 rounded-full object-cover" />`
                : `<div class="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">${getInitials(u.displayName || u.username)}</div>`;
            div.innerHTML = `${avatar}<div><div class="text-xs font-bold">${escapeHtml(u.displayName || u.username)}</div><div class="text-[10px] text-slate-400">${getCountryFlag(u.country)} ${u.country || ''}</div></div>`;
            div.onclick = () => switchChat('direct', u.id);
            list.appendChild(div);
        });
    }

    if (others.length > 0) {
        const othersLabel = document.createElement('div');
        othersLabel.className = 'text-[10px] text-slate-400 font-bold px-2 mt-3 mb-1 uppercase border-t border-slate-200 dark:border-slate-700 pt-2';
        othersLabel.textContent = 'Isticmaalayaasha Kale';
        list.appendChild(othersLabel);
        others.forEach(u => {
            const isActive = activeChatType === 'direct' && activeChatId === u.id;
            const div = document.createElement('div');
            div.className = `flex items-center space-x-2 p-2 rounded-xl cursor-pointer transition opacity-60 ${isActive ? 'bg-brand/10 text-brand opacity-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:opacity-100'}`;
            const avatar = u.photoURL
                ? `<img src="${u.photoURL}" class="w-8 h-8 rounded-full object-cover" />`
                : `<div class="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">${getInitials(u.displayName || u.username)}</div>`;
            div.innerHTML = `${avatar}<div><div class="text-xs font-bold">${escapeHtml(u.displayName || u.username)}</div><div class="text-[10px] text-slate-400">${getCountryFlag(u.country)} ${u.country || ''}</div></div>`;
            div.onclick = () => switchChat('direct', u.id);
            list.appendChild(div);
        });
    }
}

function switchChat(type, id) {
    activeChatType = type;
    activeChatId = id;
    activeReplyIndex = null;
    document.getElementById('replyPreviewContainer').classList.add('hidden');
    if (unsubDirectMessages) { unsubDirectMessages(); unsubDirectMessages = null; }

    const usersPanel = document.getElementById('chatUsersPanel');
    const messagesPanel = document.getElementById('chatMessagesPanel');
    const isDesktop = window.innerWidth >= 1024;
    if (!isDesktop) {
        if (usersPanel) usersPanel.classList.add('hidden');
        if (messagesPanel) { messagesPanel.classList.remove('hidden'); messagesPanel.classList.add('flex'); }
    } else {
        if (messagesPanel) { messagesPanel.classList.remove('hidden'); messagesPanel.classList.add('flex'); }
    }
    
    const activeChatName = document.getElementById('activeChatName');
    const activeChatMeta = document.getElementById('activeChatMeta');
    const activeChatAvatar = document.getElementById('activeChatAvatar');
    const leaveBtn = document.getElementById('leaveChatBtn');
    
    if (type === 'group') {
        if (id === 'group') {
            activeChatName.textContent = 'Group-ka Guud';
            activeChatMeta.textContent = 'Dhammaan saaxiibbada';
            activeChatAvatar.textContent = 'G';
            activeChatAvatar.className = 'w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm';
            leaveBtn.classList.add('hidden');
            listenToGlobalMessages();
        } else {
            const group = dbGroupsCache.find(g => g.id === id);
            activeChatName.textContent = group ? group.name : 'Koox';
            activeChatMeta.textContent = `${(group ? group.members : []).length} xubnood`;
            activeChatAvatar.textContent = 'K';
            activeChatAvatar.className = 'w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm';
            leaveBtn.classList.remove('hidden');
        }
    } else {
        const user = dbUsersCache.find(u => u.id === id);
        activeChatName.textContent = user ? (user.displayName || user.username) : 'Saaxiib';
        activeChatMeta.textContent = 'Direct Message';
        activeChatAvatar.textContent = getInitials(user ? (user.displayName || user.username) : 'S');
        activeChatAvatar.className = 'w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm';
        leaveBtn.classList.add('hidden');
        listenToDirectMessages(id);
    }
    renderFriendsList();
}

function updateChallengeUI() {
    const title = document.getElementById('weeklyChallengeTitle');
    const progressText = document.getElementById('weeklyProgressText');
    const percentage = document.getElementById('weeklyPercentage');
    const bar = document.getElementById('weeklyProgressBar');
    if (!title || !progressText || !percentage || !bar) return;
    
    const goal = challengeCache.goal || 50000;
    const myWeekly = currentUserProfile ? (currentUserProfile.weeklySteps || 0) : 0;
    const pct = Math.min(100, Math.round((myWeekly / goal) * 100));
    title.textContent = challengeCache.title || 'Tartanka Toddobaadkan';
    progressText.textContent = `${myWeekly.toLocaleString()} / ${goal.toLocaleString()} steps`;
    percentage.textContent = `${pct}%`;
    bar.style.width = `${pct}%`;
}

function renderAdminLeaderboard() {
    const list = document.getElementById('adminLeaderboard');
    if (!list) return;
    const sorted = [...dbUsersCache].sort((a, b) => (b.weeklySteps || 0) - (a.weeklySteps || 0)).slice(0, 10);
    list.innerHTML = sorted.map((u, i) => `
        <div class="flex items-center justify-between py-2">
            <div class="flex items-center space-x-2">
                <span class="text-brand font-black text-xs">#${i + 1}</span>
                <span class="text-xs font-bold">${escapeHtml(u.displayName || u.username)}</span>
            </div>
            <span class="text-xs text-brand font-bold">${(u.weeklySteps || 0).toLocaleString()} steps</span>
        </div>
    `).join('');
}

function renderAdminUserList() {
    const tbody = document.getElementById('adminUserList');
    const badge = document.getElementById('adminUserCountBadge');
    if (!tbody) return;
    badge.textContent = dbUsersCache.length;
    tbody.innerHTML = dbUsersCache.map(u => `
        <tr class="border-b border-slate-100 dark:border-slate-800">
            <td class="p-3 font-bold text-xs">${escapeHtml(u.displayName || u.username)}</td>
            <td class="p-3 text-xs">${(u.steps || 0).toLocaleString()}</td>
            <td class="p-3 text-xs">${(u.weeklySteps || 0).toLocaleString()}</td>
            <td class="p-3 text-xs">${getCountryFlag(u.country)} ${u.country}</td>
            <td class="p-3 text-right">
                <button class="text-red-500 text-xs font-bold hover:underline" onclick="deleteUser('${u.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
    const views = document.getElementById('adminSiteViews');
    const totalUsers = document.getElementById('adminTotalUsers');
    const totalGroups = document.getElementById('adminTotalGroups');
    if (totalUsers) totalUsers.textContent = dbUsersCache.length;
    if (totalGroups) totalGroups.textContent = dbGroupsCache.length;
    const countries = {};
    dbUsersCache.forEach(u => { countries[u.country] = (countries[u.country] || 0) + 1; });
    const countriesList = document.getElementById('adminCountriesList');
    if (countriesList) {
        countriesList.innerHTML = Object.entries(countries).map(([c, n]) => `<div>${getCountryFlag(c)} ${c}: ${n}</div>`).join('');
    }
    const lastUpdated = document.getElementById('adminLastUpdated');
    if (lastUpdated) lastUpdated.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

function renderAdminGroupList() {
    const list = document.getElementById('adminGroupList');
    if (!list) return;
    list.innerHTML = dbGroupsCache.map(g => `
        <div class="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl flex justify-between items-center">
            <div>
                <div class="text-xs font-bold">${escapeHtml(g.name)}</div>
                <div class="text-[10px] text-slate-400">${(g.members || []).length} xubnood</div>
            </div>
            <button class="text-red-500 text-xs font-bold" onclick="deleteGroup('${g.id}')">Delete</button>
        </div>
    `).join('');
}

async function deleteUser(uid) {
    if (!confirm('Ma hubtaa inaad tirtiro user-kaan?')) return;
    try {
        await db.collection('users').doc(uid).delete();
        showToast('User waa la tirtiray!', true);
    } catch (e) {
        showToast('Tirtirka fashilantay!', false);
    }
}

async function deleteGroup(gid) {
    if (!confirm('Ma hubtaa inaad tirtiro kooxdan?')) return;
    try {
        await db.collection('groups').doc(gid).delete();
        showToast('Kooxda waa la tirtiray!', true);
    } catch (e) {
        showToast('Tirtirka fashilantay!', false);
    }
}

// ==================== ADMIN DASHBOARD ====================
function setupAdminChallengeForm() {
    const form = document.getElementById('adminChallengeForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('adminChallengeTitle').value;
        const steps = parseInt(document.getElementById('adminChallengeSteps').value);
        showLoading('Saving...');
        try {
            await db.collection('challenges').doc('weekly').set({ title, goal: steps, updatedAt: fv.serverTimestamp() });
            showToast('Challenge waa la cusbooneysiiyay!', true);
        } catch (err) {
            showToast(friendlyError(err), false);
        } finally {
            hideLoading();
        }
    });
}

// ==================== CHAT MESSAGE SENDING ====================
async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('textMessageInput');
    const text = input.value.trim();
    if (!text) return;
    if (!currentUser) return;

    const msgData = {
        senderId: currentUser.uid,
        senderName: currentUserProfile ? (currentUserProfile.displayName || currentUserProfile.username) : 'User',
        content: text,
        messageType: 'text',
        timestamp: fv.serverTimestamp(),
        replyTo: activeReplyIndex != null ? activeReplyIndex : null,
        replyToText: activeReplyIndex != null && globalMessagesCache[activeReplyIndex] ? globalMessagesCache[activeReplyIndex].content : null,
        replyToSender: activeReplyIndex != null && globalMessagesCache[activeReplyIndex] ? globalMessagesCache[activeReplyIndex].senderName : null
    };

    try {
        if (activeChatType === 'group') {
            if (activeChatId === 'group') {
                msgData.type = 'global';
                await db.collection('messages').add(msgData);
            } else {
                msgData.type = 'group';
                msgData.groupId = activeChatId;
                await db.collection('messages').add(msgData);
            }
        } else {
            const me = currentUser.uid;
            const ids = [me, activeChatId].sort();
            const convoId = ids.join('_');
            await db.collection('directMessages').doc(convoId).collection('messages').add(msgData);
        }
        input.value = '';
        activeReplyIndex = null;
        document.getElementById('replyPreviewContainer').classList.add('hidden');
    } catch (err) {
        showToast(friendlyError(err), false);
    }
}

async function sendImageMessage(base64) {
    if (!currentUser) return;
    showToast('Sawirka waa la dirayo...', true);
    try {
        const fetchRes = await fetch(base64);
        const rawBlob = await fetchRes.blob();
        const blob = await compressImage(rawBlob, 1200, 0.75);
        const url = await uploadToSupabase(blob, 'chatImages', `${Date.now()}.jpg`);
        const msgData = {
            senderId: currentUser.uid,
            senderName: currentUserProfile ? (currentUserProfile.displayName || currentUserProfile.username) : 'User',
            content: url,
            messageType: 'image',
            timestamp: fv.serverTimestamp()
        };
        if (activeChatType === 'group') {
            msgData.type = activeChatId === 'group' ? 'global' : 'group';
            if (activeChatId !== 'group') msgData.groupId = activeChatId;
            await db.collection('messages').add(msgData);
        } else {
            const me = currentUser.uid;
            const ids = [me, activeChatId].sort();
            const convoId = ids.join('_');
            await db.collection('directMessages').doc(convoId).collection('messages').add(msgData);
        }
        showToast('Sawirka waa la diray!', true);
    } catch (err) {
        showToast(friendlyError(err), false);
    } finally {
        hideLoading();
        document.getElementById('imageEditorModal').classList.add('hidden');
    }
}

async function sendVoiceMessage(blob) {
    if (!currentUser || !blob) return;
    showToast('Codka waa la dirayo...', true);
    try {
        const url = await uploadToSupabase(blob, 'voiceMessages', `${Date.now()}.webm`);
        const duration = formatVoiceTime(Math.round(blob.size / 1000));
        const msgData = {
            senderId: currentUser.uid,
            senderName: currentUserProfile ? (currentUserProfile.displayName || currentUserProfile.username) : 'User',
            content: url,
            messageType: 'voice',
            voiceDuration: duration,
            timestamp: fv.serverTimestamp()
        };
        if (activeChatType === 'group') {
            msgData.type = activeChatId === 'group' ? 'global' : 'group';
            if (activeChatId !== 'group') msgData.groupId = activeChatId;
            await db.collection('messages').add(msgData);
        } else {
            const me = currentUser.uid;
            const ids = [me, activeChatId].sort();
            const convoId = ids.join('_');
            await db.collection('directMessages').doc(convoId).collection('messages').add(msgData);
        }
        showToast('Codka waa la diray!', true);
    } catch (err) {
        showToast(friendlyError(err), false);
    } finally {
        hideLoading();
    }
}

// ==================== CONTEXT MENU & ACTIONS ====================
function showMessageContextMenu(index) {
    const msg = activeChatType === 'group' ? globalMessagesCache[index] : directMessagesCache[index];
    if (!msg) return;
    const menu = document.getElementById('messageContextMenu');
    const copyLabel = document.getElementById('menuCopyLabel');
    const copyImageBtn = document.getElementById('menuCopyImageBtn');
    if (msg.messageType === 'image') {
        copyLabel.textContent = 'Koobee Link-ka Sawirka';
        copyImageBtn.classList.remove('hidden');
    } else {
        copyLabel.textContent = 'Koobee (Copy)';
        copyImageBtn.classList.add('hidden');
    }
    menu.classList.remove('hidden');
}

function hideMessageContextMenu() {
    document.getElementById('messageContextMenu').classList.add('hidden');
    contextMenuIndex = null;
}

function handleReply(index) {
    activeReplyIndex = index;
    const msg = activeChatType === 'group' ? globalMessagesCache[index] : directMessagesCache[index];
    if (!msg) return;
    document.getElementById('replyPreviewText').textContent = msg.content.substring(0, 40) + (msg.content.length > 40 ? '...' : '');
    document.getElementById('replyPreviewContainer').classList.remove('hidden');
    hideMessageContextMenu();
}

function handleCopy() {
    const msg = activeChatType === 'group' ? globalMessagesCache[contextMenuIndex] : directMessagesCache[contextMenuIndex];
    if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => showToast('Waa la koobiyay!', true));
    hideMessageContextMenu();
}

function handleCopyImage() {
    const msg = activeChatType === 'group' ? globalMessagesCache[contextMenuIndex] : directMessagesCache[contextMenuIndex];
    if (!msg || msg.messageType !== 'image') return;
    navigator.clipboard.writeText(msg.content).then(() => showToast('Sawirka waa la koobiyay!', true));
    hideMessageContextMenu();
}

function handleForward(index) {
    forwardIndex = index;
    const modal = document.getElementById('forwardModal');
    const list = document.getElementById('forwardTargetsList');
    list.innerHTML = '';
    dbUsersCache.forEach(u => {
        if (u.id === currentUser.uid) return;
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer';
        div.innerHTML = `<input type="checkbox" class="accent-brand forward-target" data-id="${u.id}" data-type="direct"><span class="text-xs">${escapeHtml(u.displayName || u.username)}</span>`;
        list.appendChild(div);
    });
    dbGroupsCache.forEach(g => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer';
        div.innerHTML = `<input type="checkbox" class="accent-brand forward-target" data-id="${g.id}" data-type="group"><span class="text-xs">${escapeHtml(g.name)} (Koox)</span>`;
        list.appendChild(div);
    });
    modal.classList.remove('hidden');
    hideMessageContextMenu();
}

async function confirmForward() {
    const msg = activeChatType === 'group' ? globalMessagesCache[forwardIndex] : directMessagesCache[forwardIndex];
    if (!msg) { hideForwardModal(); return; }
    const checkboxes = document.querySelectorAll('.forward-target:checked');
    if (checkboxes.length === 0) { hideForwardModal(); return; }
    showLoading('Forward...');
    try {
        for (const cb of checkboxes) {
            const targetId = cb.dataset.id;
            const targetType = cb.dataset.type;
            const fwdMsg = {
                senderId: currentUser.uid,
                senderName: currentUserProfile ? (currentUserProfile.displayName || currentUserProfile.username) : 'User',
                content: msg.content,
                messageType: msg.messageType || 'text',
                voiceDuration: msg.voiceDuration || null,
                timestamp: fv.serverTimestamp(),
                forwardedFrom: msg.senderName
            };
            if (targetType === 'group') {
                if (targetId === 'group') {
                    fwdMsg.type = 'global';
                } else {
                    fwdMsg.type = 'group';
                    fwdMsg.groupId = targetId;
                }
                await db.collection('messages').add(fwdMsg);
            } else {
                const me = currentUser.uid;
                const ids = [me, targetId].sort();
                const convoId = ids.join('_');
                await db.collection('directMessages').doc(convoId).collection('messages').add(fwdMsg);
            }
        }
        showToast('Fariinta waa la forward gareeyay!', true);
    } catch (e) {
        showToast(friendlyError(e), false);
    } finally {
        hideLoading();
        hideForwardModal();
    }
}

function hideForwardModal() {
    document.getElementById('forwardModal').classList.add('hidden');
    forwardIndex = null;
}

function handleDeleteForMe(index) {
    const msg = activeChatType === 'group' ? globalMessagesCache[index] : directMessagesCache[index];
    if (!msg) return;
    hideMessageContextMenu();
    showToast('Fariinta laga masaxay adiga!', true);
}

async function handleDeleteForAll(index) {
    const msg = activeChatType === 'group' ? globalMessagesCache[index] : directMessagesCache[index];
    if (!msg || !msg.id) return;
    hideMessageContextMenu();
    showLoading('Tirtiraya...');
    try {
        await db.collection('messages').doc(msg.id).delete();
        showToast('Fariinta waa la tirtiray dhammaan!', true);
    } catch (e) {
        showToast('Tirtirka fashilantay!', false);
    } finally {
        hideLoading();
    }
}

// ==================== FOLLOW REQUESTS ====================
function renderFollowRequests() {
    const list = document.getElementById('followRequestsModalList');
    if (!list) return;
    list.innerHTML = '';
    if (currentFollowRequests.length === 0) {
        list.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">Codsiyo ma jiraan.</div>';
        return;
    }
    currentFollowRequests.forEach(req => {
        const user = dbUsersCache.find(u => u.id === req.from);
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-xl';
        div.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">${getInitials(user ? (user.displayName || user.username) : 'U')}</div>
                <span class="text-xs font-bold">${escapeHtml(user ? (user.displayName || user.username) : 'Qof')}</span>
            </div>
            <div class="flex space-x-1">
                <button class="bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-lg" onclick="acceptFollow('${req.from}')">Aqbal</button>
                <button class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-1 rounded-lg" onclick="rejectFollow('${req.from}')">Diid</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function acceptFollow(fromUid) {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).update({
            followers: fv.arrayUnion(fromUid),
            followRequests: firebase.firestore.FieldValue.arrayRemove({ from: fromUid, timestamp: Date.now() })
        });
        await db.collection('users').doc(fromUid).update({ following: fv.arrayUnion(currentUser.uid) });
        showToast('Waa la aqbalay!', true);
    } catch (e) {
        showToast(friendlyError(e), false);
    }
}

async function rejectFollow(fromUid) {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).update({
            followRequests: firebase.firestore.FieldValue.arrayRemove({ from: fromUid, timestamp: Date.now() })
        });
        showToast('Waa la diiday!', true);
    } catch (e) {
        showToast(friendlyError(e), false);
    }
}

async function sendFollowRequest(targetUid) {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(targetUid).update({
            followRequests: fv.arrayUnion({ from: currentUser.uid, timestamp: Date.now() })
        });
        showToast('Codsiga Follow-ka waa la diray!', true);
    } catch (e) {
        showToast('Codsiga diridda fashilantay!', false);
    }
}

async function sendDirectMessageFromSearch(targetUid) {
    switchTab('tabChats');
    switchChat('direct', targetUid);
    document.getElementById('navSearchResults').classList.add('hidden');
    document.getElementById('navSearchInput').value = '';
}

// ==================== GROUP CREATION ====================
function setupGroupCreation() {
    const openBtn = document.getElementById('openGroupModalBtn');
    const closeBtn = document.getElementById('closeGroupModal');
    const createBtn = document.getElementById('createGroupFinalBtn');
    const modal = document.getElementById('groupModal');
    const selection = document.getElementById('groupFriendsSelection');
    
    if (!openBtn) return;
    openBtn.addEventListener('click', () => {
        selection.innerHTML = '';
        const friends = dbUsersCache.filter(u => u.id !== currentUser.uid);
        if (friends.length === 0) {
            selection.innerHTML = '<div class="text-xs text-slate-400 text-center">Saaxiibo ma jiraan.</div>';
        } else {
            friends.forEach(f => {
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer';
                div.innerHTML = `<input type="checkbox" class="accent-brand group-member-check" data-id="${f.id}"><span class="text-xs">${escapeHtml(f.displayName || f.username)}</span>`;
                selection.appendChild(div);
            });
        }
        modal.classList.remove('hidden');
    });
    
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (createBtn) createBtn.addEventListener('click', async () => {
        const name = document.getElementById('newGroupName').value.trim();
        if (!name) { showToast('Magaca kooxda geli!', false); return; }
        const checks = document.querySelectorAll('.group-member-check:checked');
        if (checks.length < 1) { showToast('Ugu yaraan hal xubin dooro!', false); return; }
        const members = [currentUser.uid, ...Array.from(checks).map(c => c.dataset.id)];
        showLoading('Koox la abuurayo...');
        try {
            await db.collection('groups').add({
                name: name,
                members: members,
                createdBy: currentUser.uid,
                createdAt: fv.serverTimestamp()
            });
            showToast('Kooxda waa la abuuray!', true);
            modal.classList.add('hidden');
            document.getElementById('newGroupName').value = '';
        } catch (e) {
            showToast('Abuurista fashilantay!', false);
        } finally {
            hideLoading();
        }
    });
}

// ==================== SEARCH ====================
function setupSearch() {
    const input = document.getElementById('navSearchInput');
    const results = document.getElementById('navSearchResults');
    const closeBtn = document.getElementById('navSearchClose');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { results.classList.add('hidden'); return; }
        const user = dbUsersCache.find(u => u.username && u.username.toLowerCase().includes(q) && u.id !== currentUser.uid);
        if (user) {
            results.classList.remove('hidden');
            document.getElementById('navSearchName').textContent = user.displayName || user.username;
            document.getElementById('navSearchSteps').textContent = `${user.steps || 0} steps`;
            document.getElementById('navSearchAvatar').textContent = getInitials(user.displayName || user.username);
            const followBtn = document.getElementById('navSearchFollowBtn');
            const msgBtn = document.getElementById('navSearchMessageBtn');
            followBtn.onclick = () => sendFollowRequest(user.id);
            msgBtn.onclick = () => sendDirectMessageFromSearch(user.id);
        } else {
            results.classList.add('hidden');
        }
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { results.classList.add('hidden'); input.value = ''; });
}

// ==================== PROFILE DRAWER ====================
function setupProfileDrawer() {
    const drawerBtn = document.getElementById('profileDrawerBtn');
    const drawer = document.getElementById('userProfileDrawer');
    const closeBtn = document.getElementById('closeProfileDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const saveBtn = document.getElementById('saveProfileChangesBtn');
    const picInput = document.getElementById('profilePicInput');
    const triggerPic = document.getElementById('triggerProfilePicBtn');
    
    if (!drawerBtn) return;
    drawerBtn.addEventListener('click', () => {
        drawer.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    });
    function closeDrawer() {
        drawer.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
    if (triggerPic) triggerPic.addEventListener('click', () => picInput.click());
    if (picInput) picInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading('Sawirka la upload gareynayo...');
        try {
            const compressed = await compressImage(file, 400, 0.75);
            const url = await uploadToSupabase(compressed, 'profilePics', currentUser.uid);
            await db.collection('users').doc(currentUser.uid).update({ photoURL: url });
            await currentUser.updateProfile({ photoURL: url });
            currentUserProfile.photoURL = url;
            const navImg = document.getElementById('navProfileImg');
            const navInitial = document.getElementById('navProfileInitial');
            const drawerImg = document.getElementById('drawerProfileImg');
            const drawerInitial = document.getElementById('drawerProfileInitial');
            navImg.src = url; navImg.classList.remove('hidden'); navInitial.classList.add('hidden');
            drawerImg.src = url; drawerImg.classList.remove('hidden'); drawerInitial.classList.add('hidden');
            showToast('Sawirka waa la cusbooneysiiyay!', true);
        } catch (err) {
            showToast(friendlyError(err), false);
        } finally {
            hideLoading();
        }
    });
    if (saveBtn) saveBtn.addEventListener('click', async () => {
        const newUsername = document.getElementById('editUsername').value.trim();
        const newPassword = document.getElementById('editPassword').value;
        showLoading('Isbeddelka la kaydinayo...');
        try {
            if (newUsername && newUsername !== currentUserProfile.username) {
                await db.collection('users').doc(currentUser.uid).update({ displayName: newUsername, username: newUsername });
                await currentUser.updateProfile({ displayName: newUsername });
            }
            if (newPassword && newPassword.length >= 6) {
                await currentUser.updatePassword(newPassword);
            }
            updateProfileUI();
            showToast('Isbeddelka waa la kaydiyay!', true);
        } catch (err) {
            showToast(friendlyError(err), false);
        } finally {
            hideLoading();
        }
    });
}

// ==================== TAB SWITCHING ====================
function switchTab(tabId) {
    ['tabSocodka', 'tabCalculator', 'tabChats', 'tabAdmin'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(tabId).classList.remove('hidden');
    ['navBtnSocod', 'navBtnCalc', 'navBtnChat'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('text-brand');
        if (btn) btn.classList.add('text-slate-400');
    });
    ['deskBtnSocod', 'deskBtnCalc', 'deskBtnChat'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('bg-brand/10', 'text-brand');
        if (btn) btn.classList.add('text-slate-400');
    });
    if (tabId === 'tabSocodka') {
        const b = document.getElementById('navBtnSocod'); if (b) { b.classList.add('text-brand'); b.classList.remove('text-slate-400'); }
        const d = document.getElementById('deskBtnSocod'); if (d) { d.classList.add('bg-brand/10', 'text-brand'); d.classList.remove('text-slate-400'); }
    } else if (tabId === 'tabCalculator') {
        const b = document.getElementById('navBtnCalc'); if (b) { b.classList.add('text-brand'); b.classList.remove('text-slate-400'); }
        const d = document.getElementById('deskBtnCalc'); if (d) { d.classList.add('bg-brand/10', 'text-brand'); d.classList.remove('text-slate-400'); }
    } else if (tabId === 'tabChats') {
        const b = document.getElementById('navBtnChat'); if (b) { b.classList.add('text-brand'); b.classList.remove('text-slate-400'); }
        const d = document.getElementById('deskBtnChat'); if (d) { d.classList.add('bg-brand/10', 'text-brand'); d.classList.remove('text-slate-400'); }
        const isDesktop = window.innerWidth >= 1024;
        if (!isDesktop) {
            const usersPanel = document.getElementById('chatUsersPanel');
            const messagesPanel = document.getElementById('chatMessagesPanel');
            if (usersPanel) usersPanel.classList.remove('hidden');
            if (messagesPanel) { messagesPanel.classList.add('hidden'); messagesPanel.classList.remove('flex'); }
        }
    }
    if (tabId === 'tabAdmin') {
        const d = document.getElementById('deskBtnAdmin'); if (d) { d.classList.add('bg-red-500/10', 'text-red-500'); d.classList.remove('text-slate-400'); }
    }
}

// ==================== AUTH FORMS & EVENTS ====================
function setupAuthForms() {
    document.getElementById('signInForm').addEventListener('submit', handleSignIn);
    document.getElementById('signUpForm').addEventListener('submit', handleSignUp);
    document.getElementById('adminForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('googleSignInBtn').addEventListener('click', handleGoogleSignIn);
    document.getElementById('tabSignIn').addEventListener('click', () => {
        document.getElementById('signInForm').classList.remove('hidden');
        document.getElementById('signUpForm').classList.add('hidden');
        document.getElementById('tabSignIn').classList.add('text-brand', 'border-brand');
        document.getElementById('tabSignIn').classList.remove('text-slate-400', 'border-transparent');
        document.getElementById('tabSignUp').classList.remove('text-brand', 'border-brand');
        document.getElementById('tabSignUp').classList.add('text-slate-400', 'border-transparent');
    });
    document.getElementById('tabSignUp').addEventListener('click', () => {
        document.getElementById('signInForm').classList.add('hidden');
        document.getElementById('signUpForm').classList.remove('hidden');
        document.getElementById('tabSignUp').classList.add('text-brand', 'border-brand');
        document.getElementById('tabSignUp').classList.remove('text-slate-400', 'border-transparent');
        document.getElementById('tabSignIn').classList.remove('text-brand', 'border-brand');
        document.getElementById('tabSignIn').classList.add('text-slate-400', 'border-transparent');
    });
    document.getElementById('adminLoginBtn').addEventListener('click', () => {
        document.getElementById('userAuthCard').classList.add('hidden');
        document.getElementById('adminAuthCard').classList.remove('hidden');
    });
    document.getElementById('backToUserAuth').addEventListener('click', () => {
        document.getElementById('adminAuthCard').classList.add('hidden');
        document.getElementById('userAuthCard').classList.remove('hidden');
    });
}

// ==================== CHAT FORM ====================
function setupChatForm() {
    document.getElementById('sendMessageForm').addEventListener('submit', sendMessage);
    document.getElementById('cancelReplyBtn').addEventListener('click', () => {
        activeReplyIndex = null;
        document.getElementById('replyPreviewContainer').classList.add('hidden');
    });
}

// ==================== IMAGE UPLOAD & EDITOR ====================
function setupImageUpload() {
    const trigger = document.getElementById('triggerImageBtn');
    const input = document.getElementById('imageInput');
    const modal = document.getElementById('imageEditorModal');
    const canvas = document.getElementById('editorCanvas');
    const closeBtn = document.getElementById('closeImageEditorBtn');
    const cancelBtn = document.getElementById('cancelImageEditorBtn');
    const sendBtn = document.getElementById('sendEditedImageBtn');
    const cropBtn = document.getElementById('editorToolCrop');
    const textBtn = document.getElementById('editorToolText');
    const drawBtn = document.getElementById('editorToolDraw');
    const clearBtn = document.getElementById('editorToolClear');
    const textArea = document.getElementById('editorTextInputArea');
    const textInput = document.getElementById('editorTextInput');
    const applyTextBtn = document.getElementById('editorApplyTextBtn');
    const cropControls = document.getElementById('editorCropControls');
    const applyCropBtn = document.getElementById('editorApplyCropBtn');
    const cropOverlay = document.getElementById('cropOverlay');
    
    if (!trigger) return;
    trigger.addEventListener('click', () => input.click());
    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            editorImageBase64 = ev.target.result;
            const img = new Image();
            img.onload = () => {
                editorImageObj = img;
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                editorCanvasCtx = ctx;
                ctx.drawImage(img, 0, 0);
                modal.classList.remove('hidden');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (sendBtn) sendBtn.addEventListener('click', () => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        sendImageMessage(dataUrl);
    });
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (editorImageObj && editorCanvasCtx) {
            editorCanvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            editorCanvasCtx.drawImage(editorImageObj, 0, 0);
        }
    });
    if (textBtn) textBtn.addEventListener('click', () => { textArea.classList.remove('hidden'); cropControls.classList.add('hidden'); cropOverlay.classList.add('hidden'); });
    if (applyTextBtn) applyTextBtn.addEventListener('click', () => {
        const text = textInput.value;
        if (!text || !editorCanvasCtx) return;
        editorCanvasCtx.font = 'bold 40px Inter, sans-serif';
        editorCanvasCtx.fillStyle = '#22c55e';
        editorCanvasCtx.fillText(text, 50, 50);
        textInput.value = '';
        textArea.classList.add('hidden');
    });
    if (cropBtn) cropBtn.addEventListener('click', () => { cropOverlay.classList.remove('hidden'); cropControls.classList.remove('hidden'); textArea.classList.add('hidden'); });
    if (applyCropBtn) applyCropBtn.addEventListener('click', () => {
        if (!editorCanvasCtx) return;
        const rect = cropOverlay.querySelector('#cropRect');
        const left = parseFloat(rect.style.left) / 100;
        const top = parseFloat(rect.style.top) / 100;
        const width = parseFloat(rect.style.width) / 100;
        const height = parseFloat(rect.style.height) / 100;
        const sx = left * canvas.width;
        const sy = top * canvas.height;
        const sw = width * canvas.width;
        const sh = height * canvas.height;
        const imageData = editorCanvasCtx.getImageData(sx, sy, sw, sh);
        canvas.width = sw;
        canvas.height = sh;
        editorCanvasCtx.putImageData(imageData, 0, 0);
        cropOverlay.classList.add('hidden');
        cropControls.classList.add('hidden');
    });
    if (drawBtn) {
        let isDrawing = false;
        drawBtn.addEventListener('click', () => {
            textArea.classList.add('hidden');
            cropControls.classList.add('hidden');
            cropOverlay.classList.add('hidden');
            canvas.style.cursor = 'crosshair';
        });
        canvas.addEventListener('mousedown', e => {
            if (canvas.style.cursor !== 'crosshair') return;
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            editorCanvasCtx.beginPath();
            editorCanvasCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        });
        canvas.addEventListener('mousemove', e => {
            if (!isDrawing) return;
            const rect = canvas.getBoundingClientRect();
            editorCanvasCtx.strokeStyle = '#22c55e';
            editorCanvasCtx.lineWidth = 3;
            editorCanvasCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            editorCanvasCtx.stroke();
        });
        canvas.addEventListener('mouseup', () => { isDrawing = false; });
    }
}

// ==================== VOICE RECORDING ====================
function setupVoiceRecording() {
    const trigger = document.getElementById('triggerVoiceBtn');
    const icon = document.getElementById('voiceIcon');
    const indicator = document.getElementById('recordingIndicator');
    if (!trigger) return;
    trigger.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                voiceRecorder = new MediaRecorder(stream);
                voiceChunks = [];
                voiceRecorder.ondataavailable = e => { if (e.data.size > 0) voiceChunks.push(e.data); };
                voiceRecorder.onstop = () => {
                    const blob = new Blob(voiceChunks, { type: 'audio/webm' });
                    sendVoiceMessage(blob);
                    stream.getTracks().forEach(t => t.stop());
                };
                voiceRecorder.start();
                isRecording = true;
                icon.className = 'fa-solid fa-stop text-red-500';
                indicator.classList.remove('hidden');
            } catch (e) {
                showToast('Codka qabashada fashilantay!', false);
            }
        } else {
            voiceRecorder.stop();
            isRecording = false;
            icon.className = 'fa-solid fa-microphone';
            indicator.classList.add('hidden');
        }
    });
}

// ==================== MOTION SENSOR (iOS/Android + Auto-save + localStorage) ====================
function setupMotionSensor() {
    const startBtn = document.getElementById('startMotionBtn');
    const status = document.getElementById('sensorStatus');
    const stepsEl = document.getElementById('liveSteps');
    const kmEl = document.getElementById('liveKm');
    const calEl = document.getElementById('liveCalories');
    if (!startBtn) return;

    // Load today's steps when app starts
    loadTodaySteps();

    startBtn.addEventListener('click', async () => {
        if (!isTrackingMotion) {
            await startTracking();
        } else {
            await stopTracking();
        }
    });

    async function startTracking() {
        // HTTPS check
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            showToast('Motion sensor wuxuu u baahan yahay HTTPS. Fadlan isticmaal HTTPS.', false);
            return;
        }

        // Check if user is logged in
        if (!currentUser) {
            showToast('Fadlan marka hore soo gal si aad tallaabooyinka u kaydiso!', false);
            return;
        }

        let permissionGranted = false;

        if ('DeviceMotionEvent' in window) {
            // iOS 13+ requires explicit permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    permissionGranted = permission === 'granted';
                    if (!permissionGranted) {
                        showToast('Fadlan oggolow Motion & Orientation! Safari > Settings > Motion & Orientation Access.', false);
                        return;
                    }
                } catch (err) {
                    console.error('Permission error:', err);
                    showToast('Kamarada/iskaan sensor-ka lama helin! Chrome isticmaal ama hubi settings-ka.', false);
                    return;
                }
            } else {
                // Android or older iOS
                permissionGranted = true;
            }
        }

        if (permissionGranted && 'DeviceMotionEvent' in window) {
            window.addEventListener('devicemotion', handleDeviceMotion);
            isTrackingMotion = true;
            status.classList.remove('hidden');
            status.innerHTML = '<i class="fa-solid fa-heart-pulse mr-1"></i> Dareemaha socodka waa firfircoonyahay. Telefoonkaaga jeebka ama gacanta ha ku taagin...';
            startBtn.innerHTML = '<i class="fa-solid fa-stop"></i><span>JOOJI SOCODKA</span>';
            startBtn.classList.remove('bg-brand', 'hover:bg-green-600');
            startBtn.classList.add('bg-red-500', 'hover:bg-red-600');
            showToast('Socodka waa la bilaabay! Socod dhab ah bilaaw.', true);
            
            // Start auto-save every 20 seconds
            autoSaveInterval = setInterval(saveStepsToFirestore, 20000);
            
            // Reset buffer
            accelBuffer = [];
        } else if (!('DeviceMotionEvent' in window)) {
            // Desktop fallback
            showToast('Motion sensor ma jiro telefoonkan. Desktop test mode waa la bilaabay.', false);
            document.addEventListener('mousemove', handleMouseMotion);
            isTrackingMotion = true;
            status.classList.remove('hidden');
            status.innerHTML = '<i class="fa-solid fa-computer mr-1"></i> Desktop test mode: Mouse ku isticmaal';
            startBtn.innerHTML = '<i class="fa-solid fa-stop"></i><span>JOOJI TEST-KA</span>';
            startBtn.classList.remove('bg-brand', 'hover:bg-green-600');
            startBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        }
    }

    async function stopTracking() {
        window.removeEventListener('devicemotion', handleDeviceMotion);
        document.removeEventListener('mousemove', handleMouseMotion);
        isTrackingMotion = false;
        
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
        }
        
        status.classList.add('hidden');
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>BILOW SOCODKA (Real Sensor)</span>';
        startBtn.classList.add('bg-brand', 'hover:bg-green-600');
        startBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        
        // Final sync to Firestore
        const finalSteps = todayTotalSteps;
        await saveStepsToFirestore();
        showToast(`Waa la kaydiyay! ${finalSteps} tallaabo maanta.`, true);
    }

    function handleDeviceMotion(e) {
        // Try to get acceleration without gravity first (more accurate)
        let acc = e.acceleration;
        let x, y, z;
        
        if (acc && (acc.x !== null || acc.y !== null || acc.z !== null)) {
            x = acc.x || 0;
            y = acc.y || 0;
            z = acc.z || 0;
        } else {
            // Fallback to accelerationIncludingGravity
            const accG = e.accelerationIncludingGravity;
            if (!accG) return;
            x = accG.x || 0;
            y = accG.y || 0;
            z = accG.z || 0;
        }

        // Calculate magnitude of acceleration
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        // Add to buffer for smoothing
        accelBuffer.push(magnitude);
        if (accelBuffer.length > BUFFER_SIZE) accelBuffer.shift();
        
        // Calculate moving average
        const avg = accelBuffer.reduce((a, b) => a + b, 0) / accelBuffer.length;
        
        // Step detection: detect peaks when magnitude exceeds gravity + threshold
        // Average gravity is ~9.8, we look for peaks above 11.5 or below 8.5
        const upperThreshold = 11.5;
        const lowerThreshold = 8.0;
        
        if (!stepCooldown) {
            // Check if we have a peak (above upper threshold and coming from below)
            const prev = accelBuffer[accelBuffer.length - 2] || 9.8;
            
            if (avg > upperThreshold && prev <= avg) {
                syncedStepCount++;
                todayTotalSteps++;
                stepCooldown = true;
                setTimeout(() => { stepCooldown = false; }, 450); // 450ms min between steps (max ~130 steps/min)
                updateMotionDisplay();
            }
        }
    }

    function handleMouseMotion(e) {
        if (Math.abs(e.clientY - lastMouseY) > 50) {
            if (!mouseStepCooldown) {
                syncedStepCount++;
                todayTotalSteps++;
                mouseStepCooldown = true;
                setTimeout(() => mouseStepCooldown = false, 400);
                updateMotionDisplay();
            }
        }
        lastMouseY = e.clientY;
    }

    function updateMotionDisplay() {
        stepsEl.textContent = todayTotalSteps.toLocaleString();
        const km = (todayTotalSteps * 0.000762).toFixed(2);
        kmEl.textContent = km;
        const calories = Math.round(todayTotalSteps * 0.04);
        calEl.textContent = calories.toLocaleString();
        
        // Update localStorage for session resilience
        localStorage.setItem('socodka_today_steps', todayTotalSteps);
        localStorage.setItem('socodka_last_date', new Date().toISOString().split('T')[0]);
        updateStepProgressCircle();
    }
}

async function saveStepsToFirestore() {
    if (!currentUser || syncedStepCount === 0) return;
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const today = new Date().toISOString().split('T')[0];
        await userRef.update({
            steps: fv.increment(syncedStepCount),
            weeklySteps: fv.increment(syncedStepCount),
            todaySteps: todayTotalSteps,
            lastStepDate: today
        });
        const historyEntry = {
            date: today,
            steps: syncedStepCount,
            km: parseFloat((syncedStepCount * 0.000762).toFixed(2)),
            calories: Math.round(syncedStepCount * 0.04)
        };
        await userRef.update({ dailyHistory: fv.arrayUnion(historyEntry) });
        showToast(`${syncedStepCount} tallaabo waa la kaydiyay!`, true);
        syncedStepCount = 0;
        updateMotionDisplayUI();
        localStorage.setItem('socodka_today_steps', todayTotalSteps);
    } catch (e) {
        showToast(friendlyError(e), false);
    }
}

async function loadTodaySteps() {
    const saved = localStorage.getItem('socodka_today_steps');
    const savedDate = localStorage.getItem('socodka_last_date');
    const today = new Date().toISOString().split('T')[0];

    if (saved && savedDate === today) {
        todayTotalSteps = parseInt(saved) || 0;
        syncedStepCount = 0;
        updateMotionDisplayUI();
    }

    if (!currentUser) return;

    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const snap = await userRef.get();

        if (snap.exists) {
            const data = snap.data();
            lastStepDate = data.lastStepDate || null;

            if (lastStepDate !== today) {
                // New day - reset
                if (lastStepDate && data.todaySteps > 0) {
                    const historyEntry = {
                        date: lastStepDate,
                        steps: data.todaySteps,
                        km: parseFloat((data.todaySteps * 0.000762).toFixed(2)),
                        calories: Math.round(data.todaySteps * 0.04)
                    };
                    await userRef.update({
                        dailyHistory: fv.arrayUnion(historyEntry),
                        todaySteps: 0,
                        lastStepDate: today
                    });
                } else {
                    await userRef.update({ todaySteps: 0, lastStepDate: today });
                }
                syncedStepCount = 0;
                updateMotionDisplayUI();
            } else {
                todayTotalSteps = Math.max(todayTotalSteps, data.todaySteps || 0);
                syncedStepCount = 0;
                updateMotionDisplayUI();
            }
        }
    } catch (e) {
        console.error('Load today steps error:', e);
    }
}

function updateMotionDisplayUI() {
    const stepsEl = document.getElementById('liveSteps');
    const kmEl = document.getElementById('liveKm');
    const calEl = document.getElementById('liveCalories');
    if (!stepsEl) return;
    stepsEl.textContent = todayTotalSteps.toLocaleString();
    kmEl.textContent = (todayTotalSteps * 0.000762).toFixed(2);
    calEl.textContent = Math.round(todayTotalSteps * 0.04).toLocaleString();
    updateStepProgressCircle();
}

function updateStepProgressCircle() {
    let wrapper = document.getElementById('stepProgressWrapper');
    if (!wrapper) {
        const stepsEl = document.getElementById('liveSteps');
        if (!stepsEl) return;
        const container = stepsEl.parentElement;
        if (!container) return;
        wrapper = document.createElement('div');
        wrapper.id = 'stepProgressWrapper';
        wrapper.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;margin:8px auto;';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '120');
        svg.setAttribute('height', '120');
        svg.style.cssText = 'transform:rotate(-90deg);';
        const r = 50;
        const c = 2 * Math.PI * r;
        svg.innerHTML = '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e0e0e0" stroke-width="10" /><circle id="stepProgressArc" cx="60" cy="60" r="' + r + '" fill="none" stroke="#4CAF50" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" />';
        const text = document.createElement('div');
        text.id = 'stepProgressLabel';
        text.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-size:12px;';
        wrapper.appendChild(svg);
        wrapper.appendChild(text);
        container.insertBefore(wrapper, stepsEl);
    }
    const r = 50;
    const c = 2 * Math.PI * r;
    const progress = Math.min(todayTotalSteps / DAILY_STEP_GOAL, 1);
    const offset = c - (progress * c);
    const arc = document.getElementById('stepProgressArc');
    if (arc) arc.setAttribute('stroke-dashoffset', offset);
    const label = document.getElementById('stepProgressLabel');
    if (label) {
        const remaining = Math.max(DAILY_STEP_GOAL - todayTotalSteps, 0);
        label.innerHTML = '<span style="font-size:20px;font-weight:700;">' + todayTotalSteps.toLocaleString() + '</span><br><span style="font-size:10px;color:#666;">' + (remaining > 0 ? remaining.toLocaleString() + ' remaining' : 'Goal reached!') + '</span>';
    }
}

// ==================== HISTORY TOGGLE ====================
function setupHistoryToggle() {
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    const closeBtn = document.getElementById('closeHistoryTable');
    const wrapper = document.getElementById('historyTableWrapper');
    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
        wrapper.classList.remove('hidden');
        renderUserHistory();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => wrapper.classList.add('hidden'));
}

function renderUserHistory() {
    const tbody = document.getElementById('userHistoryBody');
    if (!tbody || !currentUserProfile) return;
    const history = currentUserProfile.dailyHistory || [];
    tbody.innerHTML = history.slice(-30).reverse().map(h => `
        <tr class="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
            <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${h.date}</td>
            <td class="py-3 text-brand font-bold">${(h.steps || 0).toLocaleString()}</td>
            <td class="py-3">${h.km || 0} km</td>
            <td class="py-3 text-right text-red-400">${h.calories || 0} kcal</td>
        </tr>
    `).join('');
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400">Ma jiraan taariikh hadda</td></tr>';
    }
}

// ==================== CALCULATOR ====================
function setupCalculator() {
    const formTab = document.getElementById('calcSubTabForm');
    const cameraTab = document.getElementById('calcSubTabCamera');
    const outputTab = document.getElementById('calcSubTabOutput');
    const viewForm = document.getElementById('calcViewForm');
    const viewCamera = document.getElementById('calcViewCamera');
    const viewOutput = document.getElementById('calcViewOutput');
    const form = document.getElementById('calculatorForm');

    if (!formTab) return;

    function showCalcView(view) {
        [viewForm, viewCamera, viewOutput].forEach(v => v.classList.add('hidden'));
        view.classList.remove('hidden');
        [formTab, cameraTab, outputTab].forEach(t => {
            t.classList.remove('bg-brand', 'text-white');
            t.classList.add('text-slate-400');
        });
    }

    formTab.addEventListener('click', () => {
        showCalcView(viewForm);
        formTab.classList.add('bg-brand', 'text-white');
        formTab.classList.remove('text-slate-400');
    });
    cameraTab.addEventListener('click', () => {
        showCalcView(viewCamera);
        cameraTab.classList.add('bg-brand', 'text-white');
        cameraTab.classList.remove('text-slate-400');
    });
    outputTab.addEventListener('click', () => {
        showCalcView(viewOutput);
        outputTab.classList.add('bg-brand', 'text-white');
        outputTab.classList.remove('text-slate-400');
    });

    form.addEventListener('submit', e => {
        e.preventDefault();
        calcFormData = {
            gender: form.querySelector('input[name="gender"]:checked').value,
            age: parseInt(document.getElementById('calcAge').value),
            height: parseInt(document.getElementById('calcHeight').value),
            weight: parseInt(document.getElementById('calcWeight').value),
            neighborhood: document.getElementById('calcNeighborhood').value,
            foodDeficit: parseInt(document.getElementById('calcFood').value),
            stepsGoal: parseInt(document.getElementById('calcStepsGoal').value)
        };
        calculatePredictions();
        showCalcView(viewOutput);
        outputTab.classList.add('bg-brand', 'text-white');
        outputTab.classList.remove('text-slate-400');
    });
}

function calculatePredictions() {
    if (!calcFormData) return;
    const { gender, age, height, weight, foodDeficit, stepsGoal } = calcFormData;
    
    let bmr;
    if (gender === 'Male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    
    const activityFactor = stepsGoal >= 10000 ? 1.725 : stepsGoal >= 6000 ? 1.55 : stepsGoal >= 4000 ? 1.375 : 1.2;
    const tdee = bmr * activityFactor;
    
    const stepCalories = (stepsGoal * 0.04);
    const totalDailyDeficit = foodDeficit + stepCalories;
    const weeklyDeficit = totalDailyDeficit * 7;
    const weeklyLossKg = weeklyDeficit / 7700;
    
    const bmi = weight / ((height / 100) ** 2);
    let bodyFat = (1.20 * bmi) + (0.23 * age) - (10.8 * (gender === 'Male' ? 1 : 0)) - 5.4;
    if (gender === 'Female') bodyFat = (1.20 * bmi) + (0.23 * age) - 5.4 - 10.8;
    if (bodyFat < 5) bodyFat = 12;
    if (bodyFat > 50) bodyFat = 35;
    
    const statsDiv = document.getElementById('predictionStats');
    statsDiv.innerHTML = `
        <div class="bg-brand/10 p-4 rounded-xl text-center">
            <div class="text-xs text-slate-400">BMR</div>
            <div class="text-lg font-black text-brand">${Math.round(bmr)}</div>
            <div class="text-[10px] text-slate-400">kcal/day</div>
        </div>
        <div class="bg-blue-500/10 p-4 rounded-xl text-center">
            <div class="text-xs text-slate-400">TDEE</div>
            <div class="text-lg font-black text-blue-500">${Math.round(tdee)}</div>
            <div class="text-[10px] text-slate-400">kcal/day</div>
        </div>
        <div class="bg-red-500/10 p-4 rounded-xl text-center">
            <div class="text-xs text-slate-400">Mugga Baruurta</div>
            <div class="text-lg font-black text-red-500">${bodyFat.toFixed(1)}%</div>
            <div class="text-[10px] text-slate-400">Body Fat</div>
        </div>
    `;
    
    const tbody = document.getElementById('predictionTableBody');
    let currentWeight = weight;
    let currentFat = bodyFat;
    let html = '';
    for (let week = 1; week <= 8; week++) {
        currentWeight -= weeklyLossKg;
        currentFat -= (weeklyLossKg * 0.3);
        if (currentFat < 5) currentFat = 5;
        html += `
            <tr>
                <td class="p-3 font-bold">Usbuuca ${week}</td>
                <td class="p-3">${currentWeight.toFixed(1)} kg</td>
                <td class="p-3">${currentFat.toFixed(1)}%</td>
                <td class="p-3 text-brand font-bold">${(weight - currentWeight).toFixed(1)} kg</td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// ==================== CAMERA ====================
function setupCamera() {
    const openBtn = document.getElementById('openCameraBtn');
    const captureBtn = document.getElementById('capturePhotoBtn');
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const placeholder = document.getElementById('cameraPlaceholder');
    const scanner = document.getElementById('scannerOverlay');
    if (!openBtn) return;

    openBtn.addEventListener('click', async () => {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            video.srcObject = videoStream;
            video.classList.remove('hidden');
            placeholder.classList.add('hidden');
            scanner.classList.remove('hidden');
            captureBtn.disabled = false;
        } catch (e) {
            showToast('Kamarada lama helin!', false);
        }
    });

    captureBtn.addEventListener('click', () => {
        if (!videoStream) return;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        video.classList.add('hidden');
        canvas.classList.remove('hidden');
        scanner.classList.add('hidden');
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
        showToast('Scan waa la dhammeystiray! Eeg natiijada.', true);
        document.getElementById('calcSubTabOutput').click();
    });
}

// ==================== ZOOM CHAT ====================
function setupChatZoom() {
    const zoomIn = document.getElementById('zoomInChatBtn');
    const zoomOut = document.getElementById('zoomOutChatBtn');
    const container = document.getElementById('messagesContainer');
    if (!zoomIn) return;
    zoomIn.addEventListener('click', () => {
        chatFontSize = Math.min(20, chatFontSize + 1);
        container.style.fontSize = chatFontSize + 'px';
    });
    zoomOut.addEventListener('click', () => {
        chatFontSize = Math.max(10, chatFontSize - 1);
        container.style.fontSize = chatFontSize + 'px';
    });
}

// ==================== THEME TOGGLE ====================
function setupThemeToggle() {
    const authToggle = document.getElementById('themeToggleAuth');
    const portalToggle = document.getElementById('themeTogglePortal');
    function toggle() {
        document.documentElement.classList.toggle('dark');
        updateThemeIcons();
    }
    if (authToggle) authToggle.addEventListener('click', toggle);
    if (portalToggle) portalToggle.addEventListener('click', toggle);
}

// ==================== CONTEXT MENU EVENTS ====================
function setupContextMenuEvents() {
    document.getElementById('menuCopyBtn').addEventListener('click', handleCopy);
    document.getElementById('menuCopyImageBtn').addEventListener('click', handleCopyImage);
    document.getElementById('menuReplyBtn').addEventListener('click', () => handleReply(contextMenuIndex));
    document.getElementById('menuForwardBtn').addEventListener('click', () => handleForward(contextMenuIndex));
    document.getElementById('menuDeleteMeBtn').addEventListener('click', () => handleDeleteForMe(contextMenuIndex));
    document.getElementById('menuDeleteAllBtn').addEventListener('click', () => handleDeleteForAll(contextMenuIndex));
    document.getElementById('closeContextMenuBtn').addEventListener('click', hideMessageContextMenu);
}

// ==================== FORWARD EVENTS ====================
function setupForwardEvents() {
    document.getElementById('cancelForwardBtn').addEventListener('click', hideForwardModal);
    document.getElementById('confirmForwardBtn').addEventListener('click', confirmForward);
}

// ==================== FOLLOW REQUESTS EVENTS ====================
function setupFollowRequestsEvents() {
    const openBtn = document.getElementById('openFollowRequestsBtn');
    const closeBtn = document.getElementById('closeFollowRequestsModal');
    const modal = document.getElementById('followRequestsModal');
    if (!openBtn) return;
    openBtn.addEventListener('click', () => {
        renderFollowRequests();
        modal.classList.remove('hidden');
    });
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
}

// ==================== ADMIN REFRESH ====================
function setupAdminRefresh() {
    const btn = document.getElementById('adminRefreshBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        renderAdminUserList();
        renderAdminLeaderboard();
        renderAdminGroupList();
        showToast('Xogta waa la cusbooneysiiyay!', true);
    });
}

// ==================== NAVIGATION EVENTS ====================
function setupNavigation() {
    document.getElementById('navBtnSocod').addEventListener('click', () => switchTab('tabSocodka'));
    document.getElementById('navBtnCalc').addEventListener('click', () => switchTab('tabCalculator'));
    document.getElementById('navBtnChat').addEventListener('click', () => switchTab('tabChats'));
    document.getElementById('deskBtnSocod').addEventListener('click', () => switchTab('tabSocodka'));
    document.getElementById('deskBtnCalc').addEventListener('click', () => switchTab('tabCalculator'));
    document.getElementById('deskBtnChat').addEventListener('click', () => switchTab('tabChats'));
    document.getElementById('deskBtnAdmin').addEventListener('click', () => switchTab('tabAdmin'));
    const mobileLogout = document.getElementById('logoutBtnMobile');
    if (mobileLogout) mobileLogout.addEventListener('click', handleLogout);
    const backBtn = document.getElementById('backToUsersBtn');
    if (backBtn) backBtn.addEventListener('click', () => {
        const usersPanel = document.getElementById('chatUsersPanel');
        const messagesPanel = document.getElementById('chatMessagesPanel');
        if (usersPanel) usersPanel.classList.remove('hidden');
        if (messagesPanel) { messagesPanel.classList.add('hidden'); messagesPanel.classList.remove('flex'); }
    });
}

// ==================== BOOT APP ====================
async function bootApp() {
    try {
        const res = await fetch('/api/firebase-config.mjs');
        if (!res.ok) throw new Error('Config fetch failed: ' + res.status);
        window.firebaseConfig = await res.json();
    } catch (err) {
        console.error('Khalad ayaa dhacay marka config-ka la soo raray:', err);
        document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;font-family:sans-serif;">Khalad ayaa dhacay marka app-ka la furayo. Fadlan dib u isku day.</div>';
        return;
    }
    const script = document.createElement('script');
    script.src = 'index.js';
    document.body.appendChild(script);
}

// ==================== WINDOW LOAD ====================
(async () => {
    const ok = await initApp();
    if (!ok) return;

    updateThemeIcons();
    setupAuthForms();
    setupChatForm();
    setupImageUpload();
    setupVoiceRecording();
    setupMotionSensor();
    setupCalculator();
    setupCamera();
    setupHistoryToggle();
    setupProfileDrawer();
    setupSearch();
    setupGroupCreation();
    setupAdminChallengeForm();
    setupThemeToggle();
    setupContextMenuEvents();
    setupForwardEvents();
    setupFollowRequestsEvents();
    setupChatZoom();
    setupAdminRefresh();
    setupNavigation();

    // ==================== AUTH STATE LISTENER ====================
    auth.onAuthStateChanged(async user => {
        const splash = document.getElementById('splashScreen');
        if (user) {
            currentUser = user;
            showAuthView(false);
            if (splash) splash.classList.add('hidden');
            const snap = await db.collection('users').doc(user.uid).get();
            if (snap.exists) {
                currentUserProfile = snap.data();
                if (!currentUserProfile.role) currentUserProfile.role = 'user';
                isAdmin = currentUserProfile.role === 'admin';
            }
            updateProfileUI();
            listenToRealtimeData();
            incrementSiteViews();
            if (isAdmin) {
                document.getElementById('deskBtnAdmin').classList.remove('hidden');
            }
            // Load today steps when user is authenticated
            loadTodaySteps();
        } else {
            currentUser = null;
            currentUserProfile = null;
            isAdmin = false;
            if (splash) splash.classList.add('hidden');
            showAuthView(true);
            detachListeners();
        }
    });
    
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
    }
})();

const origToggle = document.getElementById('themeToggleAuth');
const origTogglePortal = document.getElementById('themeTogglePortal');
function saveTheme() {
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
if (origToggle) origToggle.addEventListener('click', saveTheme);
if (origTogglePortal) origTogglePortal.addEventListener('click', saveTheme);

// Handle page unload - save any remaining steps
window.addEventListener('beforeunload', () => {
    if (isTrackingMotion && currentUser) {
        saveStepsToFirestore();
    }
});
