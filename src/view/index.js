var txts = $('.text');
var txtIndex = -1;
var socketio = io();
var min, max, mem;

txts.hide()
showNextTxt();

$(function(){
    socketio.on('refresh', function(info){
      if (info['open']) { //ぷらべぼっとを開いている
        $('.info').addClass('on');
        // $('#status').text('参加者募集中！')
        min = info['minMember'];
        max = info['maxMember'];
        mem = info['members'].length;
        if (mem < min){
          $('#text1').text('参加者募集中 ＠' + (min - mem) + '～' + (max - mem));
        } else {
          $('#text1').text('対戦中！ ＠' + (max - mem));
        }
        $('#text2').text('参加 !join / 取消 !leave');
        
        $('#status').addClass('open');
        $('#member').addClass('on');
        $('#member').height(60 * max - 10);
        $('#member').text('');
        for (var i=0; i<max; i++) {
          $('#member').append($('<li>'));
        }
        if (mem == max) {
          $('#text1').text('ただいま満席です…');
          $('#text2').text('取消 !leave');
          $('#status').addClass('full');
        } else {
          $('#status').removeClass('full');
        }
        if (info['joinable'] == false) {
          $('#status').removeClass('open');
          $('#text1').text('受付終了しました。');
          $('#text2').text('取消 !leave');
          $('#status').addClass('close');
          $('.info').removeClass('on');
        }
      } else { //閉じてる
        $('.info').removeClass('on');
        $('#text1').text('ぷらべぼっと！');
        $('#text2').text('made by johngori');
        $('#status').removeClass('open');
        $('#status').removeClass('close');
        $('#member li').text('');
        $('#member li').removeClass('on');
        $('#member').height(0);
        $('#member').removeClass('on');
      }
      $.each($('#member').children('li'), function(index, li){
        if(info['members'][index] !== undefined){
          var text = "";
          text = info['members'][index]
          $.each(info['currentRestMembers'], function(index, value){
            if(text == value){
              text = '休憩 : ' + text
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
        $('#text1').text('ただいま満席です…');
        $('#text2').text('取消 !leave');
        $('#status').addClass('full');
      } else {
        if (mem < min){
          $('#text1').text('参加者募集中 ＠' + (min - mem) + '～' + (max - mem));
        } else {
          $('#text1').text('対戦中！ ＠' + (max - mem));
        }
        $('#text2').text('参加 !join / 取消 !leave');
      }
    });
});


function showNextTxt() {
  txtIndex++;
  txts.eq(txtIndex % txts.length).fadeIn(2000).delay(2000).fadeOut(2000, showNextTxt);
}