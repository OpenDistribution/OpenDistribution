const {ipcRenderer} = require('electron');
process.once('loaded', () => {
	global.ipcRenderer = ipcRenderer;
	global.processVersions = process.versions;
});
