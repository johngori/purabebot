const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const store = new Store();
const username = store.get("username");
const token = store.get("token");
const roomname = store.get("roomname");
const roompass = store.get("roompass");
const playercnt = store.get("playercnt");
const restcnt = store.get("restcnt");
var arrConfig = { username, token };
var arrRoom = { roomname, roompass, playercnt, restcnt };

ipcMain.on("asynchronous-message", (event, arg) => {
  event.reply("asynchronous-reply", arrConfig);
});

ipcMain.on("sendData", (event, arg) => {
  event.reply("getData", arrConfig);
  store.set("username", arg["username"]);
  store.set("token", arg["token"]);
});

ipcMain.on("asynchronous-message2", (event, arg) => {
  event.reply("asynchronous-reply2", arrRoom);
});

ipcMain.on("sendRoomInfo", (event, arg) => {
  event.reply("getRoomInfo", arrRoom);
  store.set("roomname", arg["roomname"]);
  store.set("roompass", arg["roompass"]);
  store.set("playercnt", arg["playercnt"]);
  store.set("restcnt", arg["restcnt"]);
});



if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 750,
    minWidth: 750,
    maxWidth: 750,
    height: 700,
    minHeight: 700,
    maxHeight: 700,
    icon: __dirname + "/icon.ico",
    webPreferences: {
      nodeIntegration: true,
      devTools: true,
    },
  });
  //Menuバーの非表示
  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
