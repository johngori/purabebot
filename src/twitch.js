const btConnect = document.getElementById("btn-connect");
const fmBotName = document.getElementById("bot-name");
const fmMyChannel = document.getElementById("channel-name");
const fmOAuth = document.getElementById("oauth-pass");
const fmRconPass = document.getElementById("rcon-pass")
const tglRcon = document.getElementById("tgl-rcon")
const pGetToken = document.getElementById("get-token");
const form = document.getElementById('connect-form');
const textError = document.getElementById("text-error");
const connectLog = document.getElementById("connect-log");
const serverUrl = document.getElementById("server-url");
const pluginUrl = document.getElementById("plugin-url")
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
const restMemberList = document.getElementById("rest-id")
const btnBlueInGoal = document.getElementById("blue-in-goal")
const btnBlueLeftBack = document.getElementById("blue-left-back")
const btnOrangeInGoal = document.getElementById("orange-in-goal")
const btnOrangeLeftBack = document.getElementById("orange-left-back")
const btnCenterHighSky = document.getElementById("center-high-sky")
const btnCenterLowSky = document.getElementById("center-low-sky")
const btnCenterCam = document.getElementById("center-cam")
var restList = document.getElementById("rest-id").children
var liMenberList = document.getElementById("member-list").children

const { ipcRenderer, remote } = require('electron');
const { shell } = require('electron');
const express = require('express');
const { stringify } = require('querystring');
const app = express();
const server = require('http').createServer(app);
const cron = require('node-cron');
var io = require('socket.io')(server);
const port = 3000;
var minMember;
var maxMember;
var joinable = false;
var roomName = '';
var password = '';
var members = [];
var open = false;
var info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
var arrConfig = {'botname': '', 'mychannel': '', 'oauth': '', 'rconpass':''};
var arrRoom = {'roomname': '', 'roompass': '', 'playercnt': '', 'restcnt': ''};
const tmi = require('tmi.js');
var client;
var channelName;
var currentRestCnt = 0;
var currentRestMembers = [];
var restMemberQueue = [];
var tglHelp = true;
var isQkCoolTime = false;


//RCON関連=====================================
const SPECTATE_CAMERA_MODE = {
    FLY_BALL: "SpectateSetCameraFlyBall",
    FLY_NO_TARGET: "SpectateSetCameraFlyNoTarget",
};

const CAMERA_FOV = {
    DEFAULT: "SpectateSetCameraFOV 60",
    WIDE: "SpectateSetCameraFOV 100",
};

const cameraPlacePresets = {
    blueInGoal: {
        description: "ブルーゴール内",
        pos: [10.584334, -5899.654785, 200.723129],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.WIDE,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
    orangeInGoal: {
        description: "オレンジゴール内",
        pos: [16.639233, 5881.547852, 210.352936],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.WIDE,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
    center: {
        description: "真ん中",
        pos: [-3593.823242, 6.488967, 403.777679],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.DEFAULT,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
    blueLeftBack: {
        description: "ブルー左後ろ",
        pos: [3445.395508, -4409.955566, 253.91632],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.DEFAULT,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
    orangeLeftBack: {
        description: "オレンジ左後ろ",
        pos: [-3167.162598, 4745.558006, 269.075203],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.DEFAULT,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
    kickoffHighSky: {
        description: "キックオフ上空",
        pos: [-2822.076172, -1610.922119, 4676.012695],
        rot: [-59.809569, 30.102538, 0.0],
        fov: CAMERA_FOV.WIDE,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_NO_TARGET,
    },
    kickoffLowSky: {
        description: "キックオフ低空",
        pos: [-1480.37439, 1.962628, 44.586998],
        rot: [0.0, 0.0, 0.0],
        fov: CAMERA_FOV.DEFAULT,
        camera_mode: SPECTATE_CAMERA_MODE.FLY_BALL,
    },
};


// const RCON = new WebSocket("ws://localhost:9002");
let RCON

function ws_connect(){
    RCON = new WebSocket("ws://localhost:9002");
    RCON.onopen = function open() {
        RCON.send(`rcon_password ${arrConfig.rconpass}`);
        RCON.send("rcon_refresh_allowed");
        RCON.send("replay_gui hud 0");
        connectLog.classList.remove("err");
        connectLog.innerText = "RCONへ接続しました。"
    };

    RCON.onerror = (err) => {
        connectLog.classList.add("err");
        connectLog.innerText = "RCONへ接続できません。"
    };

    RCON.onclose = (close) => {
        ws_connect()
    }
}

function setPosition(placeName) {
    RCON.send("Spectate_EnableRestoration 0")
    const targetPreset = cameraPlacePresets[placeName];
    // カメラのモードをセットする
    RCON.send(targetPreset.camera_mode);
    //sleep
    RCON.send('sleep 1')
    // FOVをセットする
    RCON.send(targetPreset.fov);
    // カメラの位置をセットする
    RCON.send(`SpectateSetCameraPosition ${targetPreset.pos.join(" ")}`);
    if (targetPreset.camera_mode === SPECTATE_CAMERA_MODE.FLY_NO_TARGET) {
        // カメラの角度をセットする
        RCON.send(`SpectateSetCameraRotation ${targetPreset.rot.join(" ")}`);
    }
}
//=====================================RCON関連


//ipcでconfig.jsonからデータ取得
ipcRenderer.send('asynchronous-message', 'getData');
ipcRenderer.on('asynchronous-reply', (event, arg) => {
    if(arg['botname'] !== undefined){
        fmBotName.value = arg['botname'];
    }
    if(arg['mychannel'] !== undefined){
        fmMyChannel.value = arg['mychannel'];
    }
    if(arg['oauth'] !== undefined){
        fmOAuth.value = arg['oauth'];
    }
    if(arg['rcon'] !== undefined) {
        tglRcon.checked = arg['rcon']
        if(arg['rcon']) {
            fmRconPass.disabled = false
        } else {
            fmRconPass.disabled = true
        }
    }
    if(arg['rconpass'] !== undefined){
        fmRconPass.value = arg['rconpass']
    }
})

ipcRenderer.send('asynchronous-message2', 'getRoomInfo');
ipcRenderer.on('asynchronous-reply2', (event, arg) => {
    if(arg['roomname'] !== undefined) {
        fmRoom.value = arg['roomname'];
    }
    if(arg['roompass'] !== undefined) {
        fmPass.value = arg['roompass'];
    }
    if(Number.isInteger(parseInt(arg['playercnt']))){
        cntPlayer.value = parseInt(arg['playercnt']);
    } else {
        cntPlayer.value = 6;
    }
    if(Number.isInteger(parseInt(arg['restcnt']))){
        cntRest.value = parseInt(arg['restcnt']);
    } else {
        cntRest.value = 3;
    }
})

//トークン取得クリック処理
pGetToken.onclick = function() {
    urlopen('https://twitchapps.com/tmi/');
}

//接続ボタン処理
btConnect.onclick = function() {
    //ボタン無効化
    this.disabled = true;
    document.getElementById("text-error").style.display = "none";
    fmBotName.setAttribute("disabled", true);
    fmMyChannel.setAttribute("disabled", true);
    fmOAuth.setAttribute("disabled", true);
    fmRconPass.setAttribute("disabled", true);
    //ipcでindex.jsにデータ送信
    let botChannel = fmBotName.value.toLowerCase();
    channelName = fmMyChannel.value.toLowerCase();
    let authpass = fmOAuth.value;
    let rconpass = fmRconPass.value;
    let rconChk = tglRcon.checked;
    arrConfig = {'botname': botChannel, 'mychannel': channelName, 'oauth': authpass, 'rcon': rconChk,'rconpass': rconpass}
    connectTwitch(botChannel, channelName, authpass, rconChk);
};

//部屋立て、部屋削除
//v1.1.0 部屋立て時、初期から自分を参加させるように変更
btnRoom.onclick = function() {
    var msg = "";

    this.disabled = true;

    if(info["open"]){
        connectLog.innerText = initData();
    } else {
        msg = roomCheck();
        if(msg == "") {
            roomName = fmRoom.value;
            password = fmPass.value;
            client.say(channelName, openMatch(roomName, password, cntPlayer.value, cntRest.value));
            addMember(channelName);
            connectLog.classList.remove("err");
            connectLog.innerText = "受付を開始しました！"
            this.disabled = false;
            this.innerText = "部屋削除"
            btnRefresh.disabled = false;
            btnClose.disabled = false;
            btnShare.disabled = false;
            btnClose.innerText = "受付終了";
    } else {
            this.disabled = false;
            connectLog.innerText = msg;
            connectLog.classList.add("err");
        }
    }
}

//更新ボタン処理
btnRefresh.onclick = function() {
    this.disabled = true;
    msg = roomCheck();
    if(msg == "") {
        roomName = fmRoom.value;
        password = fmPass.value;
        minMember = parseInt(cntPlayer.value);
        maxMember = minMember + parseInt(cntRest.value);
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
        io.emit('refresh', info);
        connectLog.classList.remove("err");
        connectLog.innerHTML = "更新しました。"
        this.disabled = false;
    } else {
        connectLog.innerText = msg;
        connectLog.classList.add("err");
    }
}

//受付終了、受付再開
btnClose.onclick = function() {
    this.disabled = true;
    if(info["joinable"]) {
        client.say(channelName, closeMatch());
        this.innerText ="受付再開";
    } else {
        client.say(channelName, restartMatch());
        this.innerText = "受付終了";
    }
    this.disabled = false;
}

function rconCheck(checked) {
    if(checked) {
        fmRconPass.disabled = false
    } else {
        fmRconPass.disabled = true
    }
}

//v1.2.1 ヘルプのチャットを自動投稿するかのチェックの確認
function helpChange(checked) {
    tglHelp = checked;
}

//リセットボタン処理
btnReset.onclick = function() {
    initRestMember();
    info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
    io.emit('refresh', info);
}

//次へボタン処理
btnNext.onclick = function() {
    nextRestMember();
}

//スペクテーターカメラ
//青ゴール内
btnBlueInGoal.onclick = function() {
    setPosition("blueInGoal")
}
//青左後ろ
btnBlueLeftBack.onclick = function() {
    setPosition("blueLeftBack")
}
//橙ゴール内
btnOrangeInGoal.onclick = function() {
    setPosition("orangeInGoal")
}
//橙左後ろ
btnOrangeLeftBack.onclick = function() {
    setPosition("orangeLeftBack")
}
//中央上空
btnCenterHighSky.onclick = function() {
    setPosition("kickoffHighSky")
}
//中央低空
btnCenterLowSky.onclick = function() {
    setPosition("kickoffLowSky")
}
//中央カメラ
btnCenterCam.onclick = function() {
    setPosition("center")
}

//v1.2.0 ツイートで募集ボタン
//v1.2.1 ハッシュタグ追加
btnShare.onclick = function() {
    var tweetText = 'ただいまプラべ募集中！'
    if(info.members.length == info.maxMember){
        tweetText = 'ただいまプラべ満席です…%0A空き次第のご案内となります。'
    } else if(info.members.length < info.minMember){
        tweetText += '@ ' + (info.minMember - info.members.length) + '～' + (info.maxMember - info.members.length)
    } else {
        tweetText += '休憩枠 @ ' + (info.maxMember - info.members.length)
    }
    var url = '%0A%0Ahttps://www.twitch.tv/' + arrConfig.mychannel
    shell.openExternal('https://twitter.com/intent/tweet?text=' + tweetText + url + '&hashtags=ぷらべぼっと')
}

//URL押下処理
serverUrl.onclick = function() {
    urlopen(this.innerText);
}

pluginUrl.onclick = function() {
    urlopen("https://note.com/johngori/n/ne7dcd4773534")
}

//inputのEnter処理
fmAddMember.onkeypress = (e) => {
    const key = e.keyCode || e.charCode || 0;
    // 13はEnterキーのキーコード
    if (key == 13) {
        fncAddMember();
    }
}

//追加ボタン処理
btnAddMember.onclick = function() {
    fncAddMember();
}


// v1.3.1 モデレータ権限でも全ての制御を可能に変更
function connectTwitch(botUserName, channelName, botOAuth, isConnectRcon){

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
        channels: [ channelName ]
    });
    client.connect().catch(function(err){
        //エラー時処理
        textError.style.display = "block";
        console.error(err);
        if (err == 'Invalid NICK.') {
            textError.innerHTML = '項目を入力してください。';
        } else if (err == 'Improperly formatted auth') {
            textError.innerHTML = 'Twitch Chat OAuth Passwordを入力して下さい。';
        } else if (err == 'Login authentication failed'){
            textError.innerHTML = '認証に失敗しました。';
        }
        btConnect.disabled = false;
        fmBotName.removeAttribute("disabled");
        fmMyChannel.removeAttribute("disabled");
        fmOAuth.removeAttribute("disabled");
    }).then(function(token){
        if(token !== undefined){
            form.style.display="none";
            form.style.height="0";
            btConnect.style.display="none";
            btConnect.style.height="0";
            connectLog.style.display = "block";
            connectLog.innerText = arrConfig['mychannel'] + "に接続しました。";
            serverUrl.style.display = "block";
            serverUrl.innerText = "http://localhost:" + port + "/";
            btnShare.style.display = "block";
            connectContents.classList.add("on");
            setServer();
            ipcRenderer.send('sendData', arrConfig);
            if(isConnectRcon) {
                btnBlueInGoal.disabled = false
                btnBlueLeftBack.disabled = false
                btnOrangeInGoal.disabled = false
                btnOrangeLeftBack.disabled = false
                btnCenterHighSky.disabled = false
                btnCenterLowSky.disabled = false
                btnCenterCam.disabled = false
                ws_connect();
            }
        }
    });
    client.on('message', (channel, tags, message, self) => {
        const msg = message.toLowerCase();
        if(self) return;
        switch(msg){
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
                if(tags.username === channelName || tags.mod){
                    client.say(channel, closeMatch());
                    btnClose.innerText ="受付再開";
                }
                break;
            case '!restart':
                if(tags.username === channelName || tags.mod){
                    client.say(channel, restartMatch());
                    btnClose.innerText ="受付終了";
                }
                break;
            case '!clear':
                if(tags.username === channelName || tags.mod){
                    client.say(channel, initData());
                }
                break;
            case '!qk':
                if(tags.username === channelName || tags.mod){
                    if (members.length <= minMember) return;
                    if(!isQkCoolTime) {
                        isQkCoolTime = true;
                        nextRestMember();
                        client.say(channel, `${tags.username} さんが休憩を回しました。`)
                        setTimeout(()=>{
                            isQkCoolTime = false;
                        }, 10000)
                    }
                }
                break;
        }
        if(tags.username === channelName || tags.mod){
            if(!msg.indexOf('!add ')){
                if (members.length === minMember - 1) {
                    client.say(channel, addMember(message.split(' ')[1]));
                    checkStart();
                } else {
                    client.say(channel, addMember(message.split(' ')[1]));
                }
            }
            if(!msg.indexOf('!remove ')){
                client.say(channel, removeMember(message.split(' ')[1]));
            }
            if(!msg.indexOf('!open ')) {
                client.say(channel, openMatch(message.split(' ')[1], message.split(' ')[2]));
            }
            if(!msg.indexOf('!room ')) {
                client.say(channel, setRoomName(message.split(' ')[1]));
            }
            if(!msg.indexOf('!pass ')) {
                client.say(channel, setPassword(message.split(' ')[1]));
            }
        }
    });
}
function addMember(user){
    var message = '';
    if (members.find(element => element == user) === undefined && members.length < maxMember && joinable){
        members.push(user);
        // console.log(members);
        message = '@' + user + ' さんの参加を受け付けました。';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('add', user);
        setMemberList();
        connectLog.classList.remove("err");
        if(members.length < minMember){
            message += 'あと' + (minMember - members.length) + '人集まればプラべ開始です。'
        }else if (members.length >= minMember && members.length != maxMember){
            message += 'あと' + (maxMember - members.length) + '人まで参加可能です。'
        }
    } else if(joinable === false){
        connectLog.classList.add("err");
        message = '現在プラべの参加を受け付けておりません。';
    } else if(members.find(element => element == user) !== undefined){
        connectLog.classList.add("err");
        message = '@' + user + ' さんは既に参加済みです。';
    } else{
        connectLog.classList.add("err");
        message = 'ただいま満席となっております。しばらくお待ちください。';
    }

    return message;
}
function removeMember(user){
    var message = '';
    if(members.find(element => element == user) !== undefined){
        members = members.filter(n => n != user);
        message = '@' + user + ' さんの参加を取り消しました。';
        setMemberList();
        removeUserRestQueue(user);
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('refresh', info);
    }else {
        message = '@' + user + ' さんはまだ参加していません。';
    }
    return message;
}
function responseHelp(){
    if(joinable){
        if (members.length === maxMember) {
            return 'ただいま満席となっております。参加取消は「!leave」とチャットしてください。'
        }
        return '参加は「!join」、参加取消は「!leave」とチャットしてください。'
    } else {
        return '現在プラべを開催していません。'
    }
}
function openMatch(rn, pa, min, rest){
    var message = '';
    if(rn === undefined) return '部屋名を入力してください。';
    if(joinable){
        message = '既に受付を開始しています。';
    } else {
        open = true;
        joinable = true;
        roomName = rn;
        members = [];
        minMember = parseInt(min);
        maxMember = minMember + parseInt(rest);
        if (pa === undefined || pa === ""){
            password = '';
            message = 'プラべの受付を開始します！　部屋名：' + roomName + '、パス：なし　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
        } else {
            password = pa;
            message = 'プラべの受付を開始します！　部屋名：' + roomName + '、パス：' + password +'　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
        }
        setMemberList();
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
        io.emit('refresh', info);
        arrRoom = {'roomname': roomName, 'roompass': password, 'playercnt': minMember, 'restcnt': parseInt(rest)};
        ipcRenderer.send('sendRoomInfo', arrRoom);
    }
    return message;
}
function closeMatch(){
    var message = '';
    if(!joinable){
        message = '受付を開始していません。';
    } else {
        joinable = false;
        message = 'プラべの受付を終了します。ご参加ありがとうございました。';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('refresh', info);
    }
    return message;
}
function restartMatch(){
    var message = '';
    if(joinable){
        message = 'すでに受付を開始しています。';
    } else {
        joinable = true;
        message = 'プラべの受付を再開します！部屋名：' + roomName + '、パス：' + password +'　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('refresh', info);
    }
    return message;
}
function initData(){
    open = false;
    joinable = false;
    roomName = '';
    password = '';
    members.length = 0;
    info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
    io.emit('refresh', info);
    setMemberList();
    connectLog.classList.remove("err");
    btnRoom.disabled = false;
    btnRoom.innerText = "部屋立て"
    btnRefresh.disabled = true;
    btnClose.disabled = true;
    btnShare.disabled = true;
    btnClose.innerText ="受付終了";
    return 'プラべの受付データを初期化しました。'
}
function displayRoom(){
    var message = '';
    if(!open){
        message = '受付を開始していません。';
    } else {
        if(info.password == ''){
            message = '部屋名「' + info.roomName + '」、パスワードはありません。'
        } else {
            message = '部屋名「' + info.roomName + '」、パスワード「' + info.password + '」'
        }
    }
    return message;
}
function setRoomName(rn){
    var message = '';
    if(!open){
        message = '受付を開始していません。';
    } else {
        roomName = rn;
        message = '部屋名を「' + roomName + '」に変更しました。';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('refresh', info);
    }
    return message;
}
function setPassword(pa){
    var message = '';
    if(!open){
        message = '受付を開始していません。';
    } else {
        if (pa === undefined){
            password = 'なし';
        } else {
            password = pa;
        }
        message = 'パスワードを「' + roomName + '」に変更しました。';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('refresh', info);
    }
    return message;
}

//var1.5.0 休憩を次に回す処理
function nextRestMember() {
    setCurrentRestMemberCnt();
    restMemberList.innerText = ""
    currentRestMembers.length = 0
    for(var i=0; i<currentRestCnt; i++) {
        addRest();
    }
    info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
    io.emit('refresh', info);
}
//ブラウザでURLを開く
function urlopen(url){
    const {shell} = require('electron');
    shell.openExternal(url);
}
//部屋立て前にチェック
function roomCheck(){
    //部屋名なしはNG
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
//memberリスト作成
function setMemberList(){
    memberList.innerHTML = "";
    members.forEach((elem, index) => {
        var li = document.createElement('li');
        var text = document.createTextNode(elem);
        li.appendChild(text);
        memberList.appendChild(li);
    });
    //メンバー削除処理
    for (var i=0; i<liMenberList.length; i++) {
        liMenberList[i].addEventListener('click', function() {
            client.say(channelName, removeMember(this.innerText));
        });
    };
}
//コンソールでメンバー追加処理
//v1.0.1 チャットで参加通知を表示
//v1.2.1 trimを追加→手入力時に削除されないバグを解消
function fncAddMember(){
    var text = "";
    var addUserName = fmAddMember.value
    addUserName = addUserName.trim()
    if(addUserName == "") {
        connectLog.classList.add("err");
        connectLog.innerText = "追加する方の名前を入力してください。"
        return false;
    }
    text = addMember(addUserName);
    if(text.indexOf('参加を受け付けました') != -1){
        client.say(channelName, text);
        checkStart();
    } else {
        connectLog.innerText = text;
    }
    fmAddMember.value = "";
}
function setCurrentRestMemberCnt(){
    currentRestCnt = info["members"].length - parseInt(info["minMember"]);
    if(currentRestCnt < 0 || !Number.isInteger(currentRestCnt)) { currentRestCnt = 0; }
}
function initRestMember(){
    restMemberQueue.length = 0;
    currentRestMembers.length = 0;
    currentRestCnt = 0;
    restMemberList.innerText = ""

    setCurrentRestMemberCnt();
    if(currentRestCnt > 0){
        for(var i=0; i<currentRestCnt; i++){
            addRest();
        };
    } else {
        currentRestCnt = 0;
    }
}
function addRest() {
    if(restMemberQueue.length == 0) { restMemberQueue = info["members"].slice(); }
    var restUser = restMemberQueue.shift();
    var li = document.createElement('li');
    var text = document.createTextNode(restUser);
    li.appendChild(text);
    currentRestMembers.push(restUser);
    restMemberList.appendChild(li);
    restList[restList.length-1].addEventListener('click', function() {
        removeRestMember(this.innerText);
        this.remove();
        addRest();
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
        io.emit('refresh', info);
    });
}
function removeUserRestQueue(user) {
    restMemberQueue.forEach((restUser, index)=>{
        if(restUser == user) {
            restMemberQueue.splice(index,1);
            return false;
        }
    })
}
function removeRestMember(user) {
    currentRestMembers.forEach((restUser, index) => {
        if(restUser == user) {
            currentRestMembers.splice(index, 1);
            return false;
        }
    })
}
//v1.0.1 プラベ開始可能になった時にメンバーに通知
function checkStart(){
    var text = ""
    if(members.length == minMember) {
        members.forEach((member, index) => {
            text += "@" + member + " "
        });
        text += "お待たせしました。プラべが開催できますのでご準備お願いします！"
    }
    client.say(channelName, text);
}
//front
function setServer(){
    app.use(express.static(__dirname + '/view'));

    io.on('connection',function(socket){
        io.emit('refresh', info);
    });

    server.listen(port, function(){
        console.log('server listening. Port:' + port);
    })

}

//v1.2.0 10分毎にHELP実行
//v1.2.1 15分毎に変更
//v1.2.1 helpのトグルボタン対応
cron.schedule('*/15 * * * *', ()=> {
    if(tglHelp && info.joinable){
        client.say(channelName, responseHelp());
    }
})
