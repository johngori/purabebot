const btConnect = document.getElementById("btn-connect");
const fmBotName = document.getElementById("bot-name");
const fmMyChannel = document.getElementById("channel-name");
const fmOAuth = document.getElementById("oauth-pass");
const pGetToken = document.getElementById("get-token");
const form = document.getElementById('connect-form');
const textError = document.getElementById("text-error");
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
const restMemberList = document.getElementById("rest-id")
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
var arrConfig = {'botname': '', 'mychannel': '', 'oauth': ''};
var arrRoom = {'roomname': '', 'roompass': '', 'playercnt': '', 'restcnt': ''};
const tmi = require('tmi.js');
var client;
var channelName;
var currentRestCnt = 0;
var currentRestMembers = [];
var restMemberQueue = [];

//ipcでconfig.jsからデータ取得
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
    //ipcでindex.jsにデータ送信
    let botChannel = fmBotName.value;
    channelName = fmMyChannel.value;
    let authpass = fmOAuth.value;
    arrConfig = {'botname': botChannel, 'mychannel': channelName, 'oauth': authpass}
    connectTwitch(botChannel, channelName, authpass);
};

//部屋立て、部屋削除
//v1.1.0 部屋立て時、初期から自分を参加させるように変更
btnRoom.onclick = function() {
    var msg = "";

    this.disabled = true;

    if(info["open"]){
        connectLog.innerText = initData();
        connectLog.classList.remove("err");
        this.disabled = false;
        this.innerText = "部屋立て"
        btnRefresh.disabled = true;
        btnClose.disabled = true;
        btnShare.disabled = true;
        btnClose.innerText ="受付終了";
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

//リセットボタン処理
btnReset.onclick = function() {
    initRestMember();
    info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
    io.emit('refresh', info);
}

//次へボタン処理
btnNext.onclick = function() {
    setCurrentRestMemberCnt();
    restMemberList.innerText = ""
    currentRestMembers.length = 0
    for(var i=0; i<currentRestCnt; i++) {
        addRest();
    }
    info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers};
    io.emit('refresh', info);
}

//ツイートで募集ボタン
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
    shell.openExternal('https://twitter.com/intent/tweet?text=' + tweetText + url)
}

//URL押下処理
serverUrl.onclick = function() {
    urlopen(this.innerText);
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



function connectTwitch(botUserName, channelName, botOAuth){

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
        }
    });
    client.on('message', (channel, tags, message, self) => {
        if(self) return;
        if(message.toLowerCase() === '!join' || message.toLowerCase() === '!j' ) {
            client.say(channel, addMember(tags.username));
            checkStart();
        }
        if(message.toLowerCase() === '!leave' || message.toLowerCase() === '!l' ) {
            client.say(channel, removeMember(tags.username));
        }
        if(message.toLowerCase() === '!help' || message.toLowerCase() === '!h' ) {
            client.say(channel, responseHelp());
        }
        if(!message.toLowerCase().indexOf('!add ') && tags.username === channelName){
            client.say(channel, addMember(message.split(' ')[1]));
            checkStart();
        }
        if(!message.toLowerCase().indexOf('!remove ') && tags.username === channelName){
            client.say(channel, removeMember(message.split(' ')[1]));
        }
        if(!message.toLowerCase().indexOf('!open ') && tags.username === channelName) {
            client.say(channel, openMatch(message.split(' ')[1], message.split(' ')[2]));
        }
        if(message.toLowerCase() === '!close' && tags.username === channelName) {
            client.say(channel, closeMatch());
        }
        if(message.toLowerCase() === '!clear' && tags.username === channelName) {
            client.say(channel, initData());
        }
        if(message.toLowerCase() === '!room' || message.toLowerCase() === '!r' ) {
            client.say(channel, displayRoom());
        }
        if(!message.toLowerCase().indexOf('!room ') && tags.username === channelName) {
            client.say(channel, setRoomName(message.split(' ')[1]));
        }
        if(!message.toLowerCase().indexOf('!pass ') && tags.username === channelName) {
            client.say(channel, setPassword(message.split(' ')[1]));
        }
    });
}
function addMember(user){
    var message = '';
    if (members.find(element => element == user) === undefined && members.length < maxMember && joinable){
        members.push(user);
        // console.log(members);
        message = '@' + user + ' さんの参加を受け付けました！';
        info = {open, joinable, roomName, password, minMember, maxMember, members, currentRestMembers}
        io.emit('add', user);
        setMemberList();
        connectLog.classList.remove("err");
        if(members.length < minMember){
            message += 'あと' + (minMember - members.length) + '人集まればプラべ開始です！'
        }else if (members.length >= minMember && members.length != maxMember){
            message += 'あと' + (maxMember - members.length) + '人まで参加可能です！'
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
        } else {
            password = pa;
        }
        message = 'プラべの受付を開始します！　部屋名：' + roomName + '、パス：' + password +'　参加される方は「!join」、参加をキャンセルされる方は「!leave」と入力ください。';
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
function fncAddMember(){
    var text = "";
    if(fmAddMember.value == "") {
        connectLog.classList.add("err");
        connectLog.innerText = "追加する方の名前を入力してください。"
        return false;
    }
    text = addMember(fmAddMember.value);
    if(text.indexOf('参加を受け付けました') != -1){
        client.say(channelName, text);
    } else {
        connectLog.innerText = text;
    }
    fmAddMember.value = "";
    checkStart();
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

cron.schedule('*/10 * * * *', ()=> {
    console.log('TEST 定期')
    if(info.joinable){
        client.say(channelName, responseHelp());
    }
})
