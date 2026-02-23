const { app, BrowserWindow } = require('electron');
app.on('ready', () => {
  const win = new BrowserWindow({ show: false });
  win.loadURL('http://localhost:3000');
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      document.querySelector('iframe').contentWindow.postMessage({
        type: 'FORCE_STATE', state: 'hover', componentCSS: '.btn:hover { color: red; }'
      }, '*');
      setTimeout(() => app.quit(), 2000);
    `);
  });
});
