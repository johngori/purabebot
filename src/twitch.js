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

const { ipcRenderer } = require('electron');
const { shell } = require('electron');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const cron = require('node-cron');
var io = require('socket.io')(server);
const port = 3000;

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
var tglHelp = true;
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
    btnToggleLog.innerText = logPanel.classList.contains('hidden') ? '▲ 表示' : '▼ 隠す';
};

function addLog(message) {
    if (logPanel.style.display === "none") {
        logPanel.style.display = "flex";
        logPanel.classList.remove('hidden');
        btnToggleLog.innerText = '▼ 隠す';
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

ipcRenderer.send('asynchronous-message', 'getData');
ipcRenderer.on('asynchronous-reply', (event, arg) => {
    if (arg['username'] && arg['token']) {
        arrConfig.username = arg['username'];
        arrConfig.token = arg['token'];
        btnLoginTwitch.disabled = true;
        addLog("保存された情報で自動接続しています...");
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
    btnRoom.innerText = "部屋立て";
    btnRefresh.disabled = true;
    btnClose.disabled = true;
    btnClose.innerText = "受付終了";
    btnShare.disabled = true;
    memberList.innerHTML = '';
    restMemberList.innerHTML = '';
    addLog("サインアウトしました。");
});

btnLoginTwitch.onclick = function () {
    this.disabled = true;
    addLog("ブラウザでTwitch認証を行ってください...");
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/auth&response_type=token&scope=chat:read+chat:edit`;
    shell.openExternal(authUrl);
};

function handleLoginSuccess(accessToken) {
    addLog("ユーザー情報を取得しています...");
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
                throw new Error("ユーザー情報の取得に失敗しました");
            }
        })
        .catch(err => {
            addLog("Twitchアカウント情報の取得に失敗しました。");
            btnLoginTwitch.disabled = false;
            addLog("認証に失敗しました。");
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
            addLog("受付を開始しました！");
            this.disabled = false;
            this.innerText = "部屋削除";
            btnRefresh.disabled = false;
            btnClose.disabled = false;
            btnShare.disabled = false;
            btnClose.innerText = "受付終了";
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
        addLog("更新しました。");
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
        this.innerText = "受付再開";
    } else {
        client.say(channelName, restartMatch());
        this.innerText = "受付終了";
    }
    this.disabled = false;
};

function helpChange(checked) {
    tglHelp = checked;
}

btnReset.onclick = function () {
    initRestMember();
    io.emit('refresh', updateInfo());
};

btnNext.onclick = function () {
    nextRestMember();
};

btnShare.onclick = function () {
    var tweetText = 'ただいまプラべ募集中！';
    if (info.members.length == info.maxMember) {
        tweetText = 'ただいまプラべ満席です…%0A空き次第のご案内となります。';
    } else if (info.members.length < info.minMember) {
        tweetText += '@ ' + (info.minMember - info.members.length) + '～' + (info.maxMember - info.members.length);
    } else {
        tweetText += '休憩枠 @ ' + (info.maxMember - info.members.length);
    }
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
            addLog("Twitchアカウント情報を取得できませんでした。正しく入力されているか確認して下さい。");
        } else if (err == 'Improperly formatted auth') {
            addLog("Twitch Chat OAuth Passwordを入力して下さい。");
        } else if (err == 'Login authentication failed') {
            addLog("認証に失敗しました。");
        }
        btnLoginTwitch.disabled = false;
    }).then(function (token) {
        if (token !== undefined) {
            splashScreen.style.display = "none";
            form.style.display = "none";
            form.style.height = "0";
            addLog(channelName + "に接続しました。");
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
                    btnClose.innerText = "受付再開";
                }
                break;
            case '!restart':
                if (tags.username === channelName || tags.mod) {
                    client.say(channel, restartMatch());
                    btnClose.innerText = "受付終了";
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
                        client.say(channel, `${tags.username} さんが休憩を回しました。`);
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
        message = '@' + user + ' さんの参加を受け付けました。';
        updateInfo();
        io.emit('add', user);
        setMemberList();
        connectLog.classList.remove("err");
        if (members.length < minMember) {
            message += 'あと' + (minMember - members.length) + '人集まればプラべ開始です。';
        } else if (members.length >= minMember && members.length != maxMember) {
            message += 'あと' + (maxMember - members.length) + '人まで参加可能です。';
        }
    } else if (joinable === false) {
        connectLog.classList.add("err");
        message = '現在プラべの参加を受け付けておりません。';
    } else if (members.find(element => element == user) !== undefined) {
        connectLog.classList.add("err");
        message = '@' + user + ' さんは既に参加済みです。';
    } else {
        connectLog.classList.add("err");
        message = 'ただいま満席となっております。しばらくお待ちください。';
    }
    return message;
}

function removeMember(user) {
    var message = '';
    if (members.find(element => element == user) !== undefined) {
        members = members.filter(n => n != user);
        message = '@' + user + ' さんの参加を取り消しました。';
        setMemberList();
        removeUserRestQueue(user);
        io.emit('refresh', updateInfo());
    } else {
        message = '@' + user + ' さんはまだ参加していません。';
    }
    return message;
}

function responseHelp() {
    if (joinable) {
        if (members.length === maxMember) {
            return 'ただいま満席となっております。参加取消は「!leave」とチャットしてください。';
        }
        return '参加は「!join」、参加取消は「!leave」とチャットしてください。';
    } else {
        return '現在プラべを開催していません。';
    }
}

function openMatch(rn, pa, min, rest) {
    var message = '';
    if (rn === undefined) return '部屋名を入力してください。';
    if (joinable) {
        message = '既に受付を開始しています。';
    } else {
        open = true;
        joinable = true;
        roomName = rn;
        members = [];
        minMember = parseInt(min);
        maxMember = minMember + parseInt(rest);
        if (pa === undefined || pa === "") {
            password = '';
            message = 'プラべの受付を開始します！　部屋名：' + roomName + '、パス：なし　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
        } else {
            password = pa;
            message = 'プラべの受付を開始します！　部屋名：' + roomName + '、パス：' + password + '　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
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
        message = '受付を開始していません。';
    } else {
        joinable = false;
        message = 'プラべの受付を終了します。ご参加ありがとうございました。';
        io.emit('refresh', updateInfo());
    }
    return message;
}

function restartMatch() {
    var message = '';
    if (joinable) {
        message = 'すでに受付を開始しています。';
    } else {
        joinable = true;
        message = 'プラべの受付を再開します！部屋名：' + roomName + '、パス：' + password + '　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
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
    btnRoom.innerText = "部屋立て";
    btnRefresh.disabled = true;
    btnClose.disabled = true;
    btnShare.disabled = true;
    btnClose.innerText = "受付終了";
    return 'プラべの受付データを初期化しました。';
}

function displayRoom() {
    var message = '';
    if (!open) {
        message = '受付を開始していません。';
    } else {
        if (info.password == '') {
            message = '部屋名「' + info.roomName + '」、パスワードはありません。';
        } else {
            message = '部屋名「' + info.roomName + '」、パスワード「' + info.password + '」';
        }
    }
    return message;
}

function setRoomName(rn) {
    var message = '';
    if (!open) {
        message = '受付を開始していません。';
    } else {
        roomName = rn;
        message = '部屋名を「' + roomName + '」に変更しました。';
        io.emit('refresh', updateInfo());
    }
    return message;
}

function setPassword(pa) {
    var message = '';
    if (!open) {
        message = '受付を開始していません。';
    } else {
        password = pa === undefined ? 'なし' : pa;
        message = 'パスワードを「' + password + '」に変更しました。';
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
        return "部屋名を入力してください。";
    }
    if (cntPlayer.value == "") {
        return "プレイ人数を入力してください。";
    }
    if (!Number.isInteger(parseFloat(cntPlayer.value)) || parseFloat(cntPlayer.value) <= 0) {
        return "プレイ人数には１以上の整数値を入力してください";
    }
    if (!Number.isInteger(parseFloat(cntRest.value)) || parseFloat(cntRest.value) < 0) {
        return "休憩枠には０以上の整数値を入力してください";
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
        connectLog.innerText = "追加する方の名前を入力してください。";
        return false;
    }
    var text = addMember(addUserName);
    if (text.indexOf('参加を受け付けました') != -1) {
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
        var text = members.map(m => "@" + m).join(" ");
        text += " お待たせしました。プラべが開催できますのでご準備お願いします！";
        client.say(channelName, text);
    }
}

cron.schedule('*/15 * * * *', () => {
    if (tglHelp && info.joinable && client) {
        client.say(channelName, responseHelp());
    }
});
