const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require("electron");
const path = require("path");
const Store = require("electron-store");
const locales = require("./locales");
const store = new Store();
const username = store.get("username");
const token = store.get("token");
const roomname = store.get("roomname");
const roompass = store.get("roompass");
const playercnt = store.get("playercnt");
const restcnt = store.get("restcnt");
var arrConfig = { username, token };
var arrRoom = { roomname, roompass, playercnt, restcnt };
let mainWindow = null;
let portWindow = null;
let signOutItem = null;

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

ipcMain.on("logged-in", () => {
  if (signOutItem) signOutItem.enabled = true;
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

function buildMenu(lang) {
  const locale = locales[lang] || locales['ja'];
  const wasEnabled = signOutItem ? signOutItem.enabled : false;

  signOutItem = new MenuItem({
    label: locale['menu.signOut'],
    enabled: wasEnabled,
    click: () => {
      store.delete("username");
      store.delete("token");
      arrConfig = { username: undefined, token: undefined };
      signOutItem.enabled = false;
      mainWindow.webContents.send('sign-out');
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: locale['menu.file'],
      submenu: [
        signOutItem,
        { type: 'separator' },
        {
          label: locale['menu.language'],
          submenu: [
            {
              label: '日本語',
              type: 'radio',
              checked: lang === 'ja',
              click: () => {
                store.set('language', 'ja');
                buildMenu('ja');
                mainWindow.reload();
              }
            },
            {
              label: 'English',
              type: 'radio',
              checked: lang === 'en',
              click: () => {
                store.set('language', 'en');
                buildMenu('en');
                mainWindow.reload();
              }
            }
          ]
        },
        { type: 'separator' },
        { role: 'quit', label: locale['menu.quit'] }
      ]
    },
    {
      label: locale['menu.settings'],
      submenu: [
        {
          label: locale['label.helpToggle'],
          type: 'checkbox',
          checked: store.get('tglHelp', true),
          click: (menuItem) => {
            store.set('tglHelp', menuItem.checked);
            mainWindow.webContents.send('toggle-help', menuItem.checked);
          }
        },
        {
          label: locale['menu.portSettings'],
          click: () => {
            if (portWindow) {
              portWindow.focus();
              return;
            }
            portWindow = new BrowserWindow({
              width: 350,
              height: 200,
              parent: mainWindow,
              modal: true,
              autoHideMenuBar: true,
              icon: __dirname + "/icon.ico",
              webPreferences: {
                nodeIntegration: true,
              }
            });
            portWindow.loadFile(path.join(__dirname, 'port.html'));
            portWindow.on('closed', () => {
              portWindow = null;
            });
          }
        }
      ]
    }
  ]);
  mainWindow.setMenu(menu);
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 750,
    minWidth: 750,
    maxWidth: 750,
    height: 650,
    minHeight: 650,
    maxHeight: 650,
    icon: __dirname + "/icon.ico",
    webPreferences: {
      nodeIntegration: true,
    },
  });

  buildMenu(store.get('language', 'ja'));
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.webContents.openDevTools()
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
