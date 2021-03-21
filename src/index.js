const { app, BrowserWindow } = require('electron');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const { ipcMain } = require('electron');
const botname = store.get("botname");
const mychannel = store.get("mychannel");
const oauth = store.get("oauth");
const roomname = store.get("roomname");
const roompass = store.get("roompass");
const playercnt = store.get("playercnt");
const restcnt = store.get("restcnt");
var arrConfig = { botname, mychannel, oauth}
var arrRoom = {roomname, roompass, playercnt, restcnt};

ipcMain.on('asynchronous-message', (event, arg) => {  // channel名は「asynchronous-message」
  event.reply('asynchronous-reply', arrConfig);
})

ipcMain.on('sendData', (event, arg) => {  // channel名は「asynchronous-message」
  event.reply('getData', arrConfig);
  store.set("botname", arg['botname']);
  store.set("mychannel", arg['mychannel']);
  store.set("oauth", arg['oauth']);
})

ipcMain.on('asynchronous-message2', (event, arg) => {  // channel名は「asynchronous-message」
  event.reply('asynchronous-reply2', arrRoom);
})

ipcMain.on('sendRoomInfo', (event, arg) => {  // channel名は「asynchronous-message」
  event.reply('getRoomInfo', arrRoom);
  store.set("roomname", arg['roomname']);
  store.set("roompass", arg['roompass']);
  store.set("playercnt", arg['playercnt']);
  store.set("restcnt", arg['restcnt']);
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 750,
    minWidth: 750,
    maxWidth: 750,
    height: 600,
    minHeight: 600,
    maxHeight: 600,
    icon: __dirname + '/icon.ico',
    webPreferences:{
      nodeIntegration: true,
      devTools: false
    }
  });
  //Menuバーの非表示
  mainWindow.setMenu(null);
  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.



