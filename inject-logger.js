const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(() => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      fs.appendFileSync('/Users/santferal/Desktop/dev_learn/ui-forge/electron-console.log', `[${level}] ${message}\n`);
    });
    win.reload();
  }
});
