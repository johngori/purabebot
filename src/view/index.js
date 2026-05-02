var txts = $('.text');
var txtIndex = -1;
var socketio = io();
var min, max, mem;
var browserLocales = {
  recruiting: '参加者募集中 ＠{0}～{1}',
  inGame: '対戦中！ ＠{0}',
  helpJoinLeave: '参加 !join / 取消 !leave',
  full: 'ただいま満席です…',
  helpLeave: '取消 !leave',
  closed: '受付終了しました。',
  standbyTitle: 'ぷらべぼっと！',
  standbySub: 'made by johngori',
  restPrefix: '休憩 : {0}'
};

function formatString(str, ...args) {
    if (!str) return '';
    let res = str;
    for (let i = 0; i < args.length; i++) {
        res = res.replace(new RegExp(`\\{${i}\\}`, 'g'), args[i]);
    }
    return res;
}

txts.hide()
showNextTxt();

$(function(){
    socketio.on('refresh', function(info){
      if (info.browserLocales) {
        browserLocales = Object.assign(browserLocales, info.browserLocales);
      }
      
      if (info['open']) { //ぷらべぼっとを開いている
        $('.info').addClass('on');
        min = info['minMember'];
        max = info['maxMember'];
        mem = info['members'].length;
        if (mem < min){
          $('#text1').text(formatString(browserLocales.recruiting, min - mem, max - mem));
        } else {
          $('#text1').text(formatString(browserLocales.inGame, max - mem));
        }
        $('#text2').text(browserLocales.helpJoinLeave);
        
        $('#status').addClass('open');
        $('#member').addClass('on');
        $('#member').height(60 * max - 10);
        $('#member').text('');
        for (var i=0; i<max; i++) {
          $('#member').append($('<li>'));
        }
        if (mem == max) {
          $('#text1').text(browserLocales.full);
          $('#text2').text(browserLocales.helpLeave);
          $('#status').addClass('full');
        } else {
          $('#status').removeClass('full');
        }
        if (info['joinable'] == false) {
          $('#status').removeClass('open');
          $('#text1').text(browserLocales.closed);
          $('#text2').text(browserLocales.helpLeave);
          $('#status').addClass('close');
          $('.info').removeClass('on');
        }
      } else { //閉じてる
        $('.info').removeClass('on');
        $('#text1').text(browserLocales.standbyTitle);
        $('#text2').text(browserLocales.standbySub);
        $('#status').removeClass('open');
        $('#status').removeClass('close');
        $('#member li').text('');
        $('#member li').removeClass('on');
        $('#member').height(0);
        $('#member').removeClass('on');
      }
      $.each($('#member').children('li'), function(index, li){
        if(info['members'][index] !== undefined){
          var text = info['members'][index];
          $.each(info['currentRestMembers'], function(index, value){
            if(text == value){
              text = formatString(browserLocales.restPrefix, text);
            }
          });
          $('#member').children('li').eq(index).text(text);
          requestAnimationFrame(()=>$(this).addClass('on'));
        }
      })
      $('#room-name').text(info['roomName']);
      $('#room-pass').text(info['password']);
      if(info['password'] == '') {
        $('.info').addClass("passoff");
      } else {
        $('.info').removeClass("passoff");
      }
    });

    socketio.on('add', function(user){
      $.each($('#member').children('li'), function(index, li){
        if ($(this).text() == ''){
          $(this).text(user);
          requestAnimationFrame(()=>$(this).addClass('on'));
          return false;
        }
      });
      mem++;
      if($('#member li:last').text() !== ''){
        $('#text1').text(browserLocales.full);
        $('#text2').text(browserLocales.helpLeave);
        $('#status').addClass('full');
      } else {
        if (mem < min){
          $('#text1').text(formatString(browserLocales.recruiting, min - mem, max - mem));
        } else {
          $('#text1').text(formatString(browserLocales.inGame, max - mem));
        }
        $('#text2').text(browserLocales.helpJoinLeave);
      }
    });
});


function showNextTxt() {
  txtIndex++;
  txts.eq(txtIndex % txts.length).fadeIn(2000).delay(2000).fadeOut(2000, showNextTxt);
}