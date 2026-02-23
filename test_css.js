const { app, BrowserWindow } = require('electron');
app.on('ready', () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: false, nodeIntegration: true } });
  win.loadURL('http://localhost:3000');
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      new Promise(resolve => {
        const iframe = document.querySelector('iframe');
        if (!iframe) return resolve("no iframe");
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const style = doc.getElementById('component-styles');
        resolve(style ? style.sheet.cssRules.length : "no style");
      })
    `).then(res => {
      console.log("RULES LENGTH:", res);
      app.quit();
    }).catch(e => { console.log(e); app.quit(); });
  });
});
