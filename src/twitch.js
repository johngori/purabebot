const btnLoginTwitch = document.getElementById("btn-login-twitch");

const form = document.getElementById('connect-form');
const splashScreen = document.getElementById('splash-screen');
const logPanel = document.getElementById("log-panel");
const logHeader = document.getElementById("log-header");
const btnToggleLog = document.getElementById("btn-toggle-log");
const connectLog = document.getElementById("connect-log");
const serverUrl = document.getElementById("server-url");
const btnShare = document.getElementById("btn-share");
const connectContents = document.getElementById("connect-contents");
const btnRoom = document.getElementById("btn-room");
const btnRefresh = document.getElementById("btn-refresh");
const btnClose = document.getElementById("btn-close");
const fmRoom = document.getElementById("fm-room-name");
const fmPass = document.getElementById("fm-room-pass");
const cntPlayer = document.getElementById("fm-play-count");
const cntRest = document.getElementById("fm-rest-count");
const memberList = document.getElementById("member-list");
const fmAddMember = document.getElementById("fm-add-member");
const btnAddMember = document.getElementById("btn-add");
const btnNext = document.getElementById("btn-next");
const btnReset = document.getElementById("btn-init");
const restMemberList = document.getElementById("rest-id");
var restList = document.getElementById("rest-id").children;
var liMenberList = document.getElementById("member-list").children;

// i18n setup
const Store = require('electron-store');
const _lang = new Store().get('language', 'ja');
const _locales = require('./locales');
const locale = _locales[_lang] || _locales['ja'];

function t(key, ...args) {
    const val = locale[key];
    if (typeof val === 'function') return val(...args);
    return val !== undefined ? val : key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = t(el.getAttribute('data-i18n'));
    });
}

applyTranslations();

const { ipcRenderer } = require('electron');
const { shell } = require('electron');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const cron = require('node-cron');
var io = require('socket.io')(server);
const port = new Store().get('port', 3000);

app.use(express.json());
app.use(express.static(__dirname + '/view'));

app.get('/auth', (req, res) => {
    res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Twitch認証</title>
        <style>body{font-family:sans-serif; text-align:center; padding-top:50px;}</style>
      </head>
      <body>
        <h2 id="msg">認証処理中です...</h2>
        <p>このウィンドウは自動的に閉じます。</p>
        <script>
          const hash = window.location.hash;
          if (hash) {
            fetch('/auth-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hash: hash })
            }).then(() => {
              document.getElementById('msg').innerText = '認証が完了しました！アプリに戻ってください。';
              setTimeout(() => window.close(), 2000);
            });
          } else {
            document.getElementById('msg').innerText = 'エラー: 認証トークンが見つかりません。';
          }
        </script>
      </body>
    </html>
  `);
});

app.post('/auth-token', (req, res) => {
    const hash = req.body.hash;
    if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        if (accessToken) {
            handleLoginSuccess(accessToken);
            return res.sendStatus(200);
        }
    }
    res.sendStatus(400);
});

io.on('connection', function (socket) {
    io.emit('refresh', info);
});

server.listen(port, function () {
    console.log('server listening. Port:' + port);
});

var minMember;
var maxMember;
var joinable = false;
var roomName = '';
var channelName = '';
var password = '';
var members = [];
var open = false;
var currentRestCnt = 0;
var currentRestMembers = [];
var restMemberQueue = [];
var tglHelp = new Store().get('tglHelp', true);
var isQkCoolTime = false;
var arrConfig = { 'username': '', 'token': '' };
var arrRoom = { 'roomname': '', 'roompass': '', 'playercnt': '', 'restcnt': '' };
const tmi = require('tmi.js');
var client;
var info;

function updateInfo() {
    info = { open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers };
    return info;
}
updateInfo();

logHeader.onclick = function () {
    logPanel.classList.toggle('hidden');
    btnToggleLog.innerText = logPanel.classList.contains('hidden') ? t('log.show') : t('log.hide');
};

function addLog(message) {
    if (logPanel.style.display === "none") {
        logPanel.style.display = "flex";
        logPanel.classList.remove('hidden');
        btnToggleLog.innerText = t('log.hide');
    }

    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0') + ':' +
        now.getSeconds().toString().padStart(2, '0');

    const line = document.createElement('div');
    line.className = 'log-line';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.innerText = `[${timeStr}]`;

    const msgSpan = document.createElement('span');
    msgSpan.innerText = message;

    line.appendChild(timeSpan);
    line.appendChild(msgSpan);

    connectLog.appendChild(line);
    connectLog.scrollTop = connectLog.scrollHeight;
}

ipcRenderer.on('toggle-help', (event, checked) => {
    tglHelp = checked;
});

ipcRenderer.send('asynchronous-message', 'getData');
ipcRenderer.on('asynchronous-reply', (event, arg) => {
    if (arg['username'] && arg['token']) {
        arrConfig.username = arg['username'];
        arrConfig.token = arg['token'];
        btnLoginTwitch.disabled = true;
        addLog(t('log.autoConnecting'));
        connectTwitch(arrConfig.username, arrConfig.username, `oauth:${arrConfig.token}`);
    } else {
        splashScreen.style.display = "none";
        form.style.display = "block";
    }
});

ipcRenderer.send('asynchronous-message2', 'getRoomInfo');
ipcRenderer.on('asynchronous-reply2', (event, arg) => {
    if (arg['roomname'] !== undefined) {
        fmRoom.value = arg['roomname'];
    }
    if (arg['roompass'] !== undefined) {
        fmPass.value = arg['roompass'];
    }
    cntPlayer.value = Number.isInteger(parseInt(arg['playercnt'])) ? parseInt(arg['playercnt']) : 6;
    cntRest.value = Number.isInteger(parseInt(arg['restcnt'])) ? parseInt(arg['restcnt']) : 3;
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;

ipcRenderer.on('sign-out', () => {
    if (client) {
        client.disconnect().catch(() => {});
        client = undefined;
    }
    arrConfig = { username: '', token: '' };
    channelName = '';
    members = [];
    open = false;
    joinable = false;
    password = '';
    roomName = '';
    restMemberQueue = [];
    currentRestCnt = 0;
    currentRestMembers = [];
    isQkCoolTime = false;
    io.emit('refresh', updateInfo());
    connectContents.classList.remove("on");
    form.style.display = "block";
    form.style.height = "";
    btnLoginTwitch.disabled = false;
    btnRoom.disabled = false;
    btnRoom.innerText = t('btn.createRoom');
    btnRefresh.disabled = true;
    btnClose.disabled = true;
    btnClose.innerText = t('btn.closeAcceptance');
    btnShare.disabled = true;
    memberList.innerHTML = '';
    restMemberList.innerHTML = '';
    addLog(t('log.signedOut'));
});

btnLoginTwitch.onclick = function () {
    this.disabled = true;
    addLog(t('log.openingBrowser'));
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/auth&response_type=token&scope=chat:read+chat:edit`;
    shell.openExternal(authUrl);
};

function handleLoginSuccess(accessToken) {
    addLog(t('log.fetchingUser'));
    fetch('https://api.twitch.tv/helix/users', {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Client-Id': CLIENT_ID
        }
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.data && data.data.length > 0) {
                const userLogin = data.data[0].login.toLowerCase();
                arrConfig = { 'username': userLogin, 'token': accessToken };
                connectTwitch(userLogin, userLogin, `oauth:${accessToken}`);
            } else {
                throw new Error();
            }
        })
        .catch(() => {
            addLog(t('log.fetchUserError'));
            btnLoginTwitch.disabled = false;
            addLog(t('log.authFailed'));
        });
}

btnRoom.onclick = function () {
    var msg = "";
    this.disabled = true;

    if (info["open"]) {
        connectLog.innerText = initData();
    } else {
        msg = roomCheck();
        if (msg == "") {
            roomName = fmRoom.value;
            password = fmPass.value;
            client.say(channelName, openMatch(roomName, password, cntPlayer.value, cntRest.value));
            addMember(channelName);
            addLog(t('log.roomOpened'));
            this.disabled = false;
            this.innerText = t('btn.deleteRoom');
            btnRefresh.disabled = false;
            btnClose.disabled = false;
            btnShare.disabled = false;
            btnClose.innerText = t('btn.closeAcceptance');
        } else {
            this.disabled = false;
            addLog(msg);
        }
    }
};

btnRefresh.onclick = function () {
    this.disabled = true;
    var msg = roomCheck();
    if (msg == "") {
        roomName = fmRoom.value;
        password = fmPass.value;
        minMember = parseInt(cntPlayer.value);
        maxMember = minMember + parseInt(cntRest.value);
        io.emit('refresh', updateInfo());
        addLog(t('log.updated'));
        this.disabled = false;
    } else {
        addLog(msg);
        this.disabled = false;
    }
};

btnClose.onclick = function () {
    this.disabled = true;
    if (info["joinable"]) {
        client.say(channelName, closeMatch());
        this.innerText = t('btn.reopenAcceptance');
    } else {
        client.say(channelName, restartMatch());
        this.innerText = t('btn.closeAcceptance');
    }
    this.disabled = false;
};


btnReset.onclick = function () {
    initRestMember();
    io.emit('refresh', updateInfo());
};

btnNext.onclick = function () {
    nextRestMember();
};

btnShare.onclick = function () {
    var tweetText = t('tweet.body', info.members.length, info.minMember, info.maxMember);
    var url = '%0A%0Ahttps://www.twitch.tv/' + channelName;
    shell.openExternal('https://twitter.com/intent/tweet?text=' + tweetText + url + '&hashtags=ぷらべぼっと');
};

serverUrl.onclick = function () {
    shell.openExternal(this.innerText);
};

fmAddMember.onkeypress = (e) => {
    const key = e.keyCode || e.charCode || 0;
    if (key == 13) {
        fncAddMember();
    }
};

btnAddMember.onclick = function () {
    fncAddMember();
};

function connectTwitch(botUserName, connectChannel, botOAuth) {
    channelName = connectChannel;

    client = new tmi.Client({
        options: { debug: true, messagesLogLevel: "info" },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: botUserName,
            password: botOAuth
        },
        channels: [channelName]
    });
    client.connect().catch(function (err) {
        splashScreen.style.display = "none";
        form.style.display = "block";
        console.error(err);
        if (err == 'Invalid NICK.') {
            addLog(t('log.invalidNick'));
        } else if (err == 'Improperly formatted auth') {
            addLog(t('log.badAuth'));
        } else if (err == 'Login authentication failed') {
            addLog(t('log.authFailed'));
        }
        btnLoginTwitch.disabled = false;
    }).then(function (token) {
        if (token !== undefined) {
            splashScreen.style.display = "none";
            form.style.display = "none";
            form.style.height = "0";
            addLog(t('log.connected', channelName));
            serverUrl.style.display = "block";
            serverUrl.innerText = "http://localhost:" + port + "/";
            btnShare.style.display = "block";
            connectContents.classList.add("on");
            ipcRenderer.send('sendData', arrConfig);
            ipcRenderer.send('logged-in');
        }
    });
    client.on('message', (channel, tags, message, self) => {
        const msg = message.toLowerCase();
        if (self) return;
        switch (msg) {
            case '!j':
            case '!join':
                if (members.length === minMember - 1) {
                    client.say(channel, addMember(tags.username));
                    checkStart();
                } else {
                    client.say(channel, addMember(tags.username));
                }
                break;
            case '!l':
            case '!leave':
                client.say(channel, removeMember(tags.username));
                break;
            case '!h':
            case '!help':
                client.say(channel, responseHelp());
                break;
            case '!r':
            case '!room':
                client.say(channel, displayRoom());
                break;
            case '!close':
                if (tags.username === channelName || tags.mod) {
                    client.say(channel, closeMatch());
                    btnClose.innerText = t('btn.reopenAcceptance');
                }
                break;
            case '!restart':
                if (tags.username === channelName || tags.mod) {
                    client.say(channel, restartMatch());
                    btnClose.innerText = t('btn.closeAcceptance');
                }
                break;
            case '!clear':
                if (tags.username === channelName || tags.mod) {
                    client.say(channel, initData());
                }
                break;
            case '!qk':
                if (tags.username === channelName || tags.mod) {
                    if (members.length <= minMember) return;
                    if (!isQkCoolTime) {
                        isQkCoolTime = true;
                        nextRestMember();
                        client.say(channel, t('chat.rotated', tags.username));
                        setTimeout(() => {
                            isQkCoolTime = false;
                        }, 10000);
                    }
                }
                break;
        }
        if (tags.username === channelName || tags.mod) {
            if (!msg.indexOf('!add ')) {
                if (members.length === minMember - 1) {
                    client.say(channel, addMember(message.split(' ')[1]));
                    checkStart();
                } else {
                    client.say(channel, addMember(message.split(' ')[1]));
                }
            }
            if (!msg.indexOf('!remove ')) {
                client.say(channel, removeMember(message.split(' ')[1]));
            }
            if (!msg.indexOf('!open ')) {
                client.say(channel, openMatch(message.split(' ')[1], message.split(' ')[2]));
            }
            if (!msg.indexOf('!room ')) {
                client.say(channel, setRoomName(message.split(' ')[1]));
            }
            if (!msg.indexOf('!pass ')) {
                client.say(channel, setPassword(message.split(' ')[1]));
            }
        }
    });
}

function addMember(user) {
    var message = '';
    if (members.find(element => element == user) === undefined && members.length < maxMember && joinable) {
        members.push(user);
        message = t('chat.joinAccepted', user);
        if (members.length < minMember) {
            message += t('chat.joinNeedMore', minMember - members.length);
        } else if (members.length >= minMember && members.length != maxMember) {
            message += t('chat.joinCanJoinMore', maxMember - members.length);
        }
        updateInfo();
        io.emit('add', user);
        setMemberList();
        connectLog.classList.remove("err");
    } else if (joinable === false) {
        connectLog.classList.add("err");
        message = t('chat.joinClosed');
    } else if (members.find(element => element == user) !== undefined) {
        connectLog.classList.add("err");
        message = t('chat.joinAlready', user);
    } else {
        connectLog.classList.add("err");
        message = t('chat.joinFull');
    }
    return message;
}

function removeMember(user) {
    var message = '';
    if (members.find(element => element == user) !== undefined) {
        members = members.filter(n => n != user);
        message = t('chat.leaveSuccess', user);
        setMemberList();
        removeUserRestQueue(user);
        io.emit('refresh', updateInfo());
    } else {
        message = t('chat.leaveNotFound', user);
    }
    return message;
}

function responseHelp() {
    if (joinable) {
        if (members.length === maxMember) {
            return t('chat.helpFull');
        }
        return t('chat.helpOpen');
    } else {
        return t('chat.helpClosed');
    }
}

function openMatch(rn, pa, min, rest) {
    var message = '';
    if (rn === undefined) return t('chat.openNoRoom');
    if (joinable) {
        message = t('chat.openAlready');
    } else {
        open = true;
        joinable = true;
        roomName = rn;
        members = [];
        minMember = parseInt(min);
        maxMember = minMember + parseInt(rest);
        if (pa === undefined || pa === "") {
            password = '';
            message = t('chat.openSuccessNoPass', roomName);
        } else {
            password = pa;
            message = t('chat.openSuccessWithPass', roomName, password);
        }
        setMemberList();
        io.emit('refresh', updateInfo());
        arrRoom = { 'roomname': roomName, 'roompass': password, 'playercnt': minMember, 'restcnt': parseInt(rest) };
        ipcRenderer.send('sendRoomInfo', arrRoom);
    }
    return message;
}

function closeMatch() {
    var message = '';
    if (!joinable) {
        message = t('chat.closeNotOpen');
    } else {
        joinable = false;
        message = t('chat.closeSuccess');
        io.emit('refresh', updateInfo());
    }
    return message;
}

function restartMatch() {
    var message = '';
    if (joinable) {
        message = t('chat.restartAlready');
    } else {
        joinable = true;
        message = t('chat.restartSuccess', roomName, password);
        io.emit('refresh', updateInfo());
    }
    return message;
}

function initData() {
    open = false;
    joinable = false;
    roomName = '';
    password = '';
    members.length = 0;
    io.emit('refresh', updateInfo());
    setMemberList();
    connectLog.classList.remove("err");
    btnRoom.disabled = false;
    btnRoom.innerText = t('btn.createRoom');
    btnRefresh.disabled = true;
    btnClose.disabled = true;
    btnShare.disabled = true;
    btnClose.innerText = t('btn.closeAcceptance');
    return t('chat.initSuccess');
}

function displayRoom() {
    var message = '';
    if (!open) {
        message = t('chat.roomNotOpen');
    } else {
        if (info.password == '') {
            message = t('chat.roomInfoNoPass', info.roomName);
        } else {
            message = t('chat.roomInfoWithPass', info.roomName, info.password);
        }
    }
    return message;
}

function setRoomName(rn) {
    var message = '';
    if (!open) {
        message = t('chat.renameNotOpen');
    } else {
        roomName = rn;
        message = t('chat.renameSuccess', roomName);
        io.emit('refresh', updateInfo());
    }
    return message;
}

function setPassword(pa) {
    var message = '';
    if (!open) {
        message = t('chat.passwordNotOpen');
    } else {
        password = pa === undefined ? 'なし' : pa;
        message = t('chat.passwordSuccess', password);
        io.emit('refresh', updateInfo());
    }
    return message;
}

function nextRestMember() {
    setCurrentRestMemberCnt();
    restMemberList.innerText = "";
    currentRestMembers.length = 0;
    for (var i = 0; i < currentRestCnt; i++) {
        addRest();
    }
    io.emit('refresh', updateInfo());
}

function roomCheck() {
    if (fmRoom.value == "") {
        return t('validate.noRoomName');
    }
    if (cntPlayer.value == "") {
        return t('validate.noPlayerCount');
    }
    if (!Number.isInteger(parseFloat(cntPlayer.value)) || parseFloat(cntPlayer.value) <= 0) {
        return t('validate.invalidPlayerCount');
    }
    if (!Number.isInteger(parseFloat(cntRest.value)) || parseFloat(cntRest.value) < 0) {
        return t('validate.invalidRestSlots');
    }
    return "";
}

function setMemberList() {
    memberList.innerHTML = "";
    members.forEach((elem) => {
        var li = document.createElement('li');
        li.appendChild(document.createTextNode(elem));
        memberList.appendChild(li);
    });
    for (var i = 0; i < liMenberList.length; i++) {
        liMenberList[i].addEventListener('click', function () {
            client.say(channelName, removeMember(this.innerText));
        });
    }
}

function fncAddMember() {
    var addUserName = fmAddMember.value.trim();
    if (addUserName == "") {
        connectLog.classList.add("err");
        connectLog.innerText = t('validate.noAddName');
        return false;
    }
    var text = addMember(addUserName);
    if (members.includes(addUserName)) {
        client.say(channelName, text);
        checkStart();
    } else {
        connectLog.innerText = text;
    }
    fmAddMember.value = "";
}

function setCurrentRestMemberCnt() {
    currentRestCnt = info["members"].length - parseInt(info["minMember"]);
    if (currentRestCnt < 0 || !Number.isInteger(currentRestCnt)) { currentRestCnt = 0; }
}

function initRestMember() {
    restMemberQueue.length = 0;
    currentRestMembers.length = 0;
    currentRestCnt = 0;
    restMemberList.innerText = "";
    setCurrentRestMemberCnt();
    if (currentRestCnt > 0) {
        for (var i = 0; i < currentRestCnt; i++) {
            addRest();
        }
    }
}

function addRest() {
    if (restMemberQueue.length == 0) { restMemberQueue = info["members"].slice(); }
    var restUser = restMemberQueue.shift();
    var li = document.createElement('li');
    li.appendChild(document.createTextNode(restUser));
    currentRestMembers.push(restUser);
    restMemberList.appendChild(li);
    restList[restList.length - 1].addEventListener('click', function () {
        removeRestMember(this.innerText);
        this.remove();
        addRest();
        io.emit('refresh', updateInfo());
    });
}

function removeUserRestQueue(user) {
    restMemberQueue.forEach((restUser, index) => {
        if (restUser == user) {
            restMemberQueue.splice(index, 1);
            return false;
        }
    });
}

function removeRestMember(user) {
    currentRestMembers.forEach((restUser, index) => {
        if (restUser == user) {
            currentRestMembers.splice(index, 1);
            return false;
        }
    });
}

function checkStart() {
    if (members.length == minMember) {
        var mentions = members.map(m => "@" + m).join(" ");
        client.say(channelName, t('chat.startReady', mentions));
    }
}

cron.schedule('*/15 * * * *', () => {
    if (tglHelp && info.joinable && client) {
        client.say(channelName, responseHelp());
    }
});
