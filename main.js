const {app, net, shell, BrowserWindow, ipcMain, Tray, Menu} = require('electron');
const execFile = require('child_process').execFile;
const path = require('path');
let fs = require('fs-extra');
let http = require('http');
let request = require('request');
let progress = require('request-progress');
let packageJson = require('./package.json');
let DecompressZip = require('decompress-zip');
let Store = require('electron-store');

let ICON_PATH = './icon.png';

let win = null; // This needs to be global, or it'll be garbage collected.
let gameWin = null;
let trayIcon = null;

let libraryStore = new Store({ name: "library" });
let settingsStore = new Store({ name: "settings" });

let downloadInfo = new Map();

function setSettingDefault(setting, defaultValue)
{
	if (!settingsStore.has(setting))
	{
		settingsStore.set(setting, defaultValue);
	}
}

function loadSettings()
{
	console.log("libraryStore:");
	console.log(libraryStore.store);
	console.log("settingsStore:");
	console.log(settingsStore.store);
	
	setSettingDefault("StartMaximized", true);
	setSettingDefault("CloseToTray", true);
	setSettingDefault("AutoUpdateGames", true);
	setSettingDefault("DefaultTab", "Library");
	setSettingDefault("DeveloperTools", false);
	setSettingDefault("LastView", "Library");
	setSettingDefault("DebugProxying", false);
	setSettingDefault("OpenBrowserGamesExternally", false);
}

function downloadFile(gameId, source, destination, callback)
{
	let p = progress(request(source), {});
	p.on('progress', function (state)
	{
		console.log('progress', state);
		
		let dNfo = downloadInfo.get(gameId);
		dNfo.downloadProgress = state.percent * 100;
		SendProgressReport(gameId);
	});
	p.on('error', function (err)
	{
		console.log('error', err);
	});
	p.on('end', callback).pipe(fs.createWriteStream(destination));
};

function createWindow()
{
	loadSettings();
	
	win = new BrowserWindow({
		width: 800,
		height: 600,
		minHeight: 500,
		minWidth: 500,
		title: packageJson.name,
		icon:ICON_PATH,
		webPreferences: {
			nodeIntegration: false,
			preload: path.join(__dirname, "preload.js")
		}
	});
	
	if (settingsStore.get("StartMaximized") != false)
	{
		win.maximize();
	}
	
	win.loadFile('index.html');
	if (settingsStore.get("DeveloperTools"))
	{
		win.webContents.openDevTools();
	}
	win.on('closed', () =>
	{
		win = null; // Garbage collect it.
	});
	
	win.webContents.on('did-finish-load', () =>
	{
		win.webContents.send("update-about", packageJson);
		refreshLibrary();
		refreshSettings();
	});
	
	win.on('close', function(event)
	{
		if (settingsStore.get("CloseToTray") == false)
		{
			app.isQuiting = true;
			app.quit();
		}
		
		if (!app.isQuiting)
		{
			event.preventDefault();
			win.hide();
		}
		
		return false;
	});
	
	win.on('page-title-updated', function(event)
	{
		event.preventDefault();
		return false;
	});
	
	win.webContents.on('new-window', function(e, url)
	{
		e.preventDefault();
		// Come on, there has to be a better way to do this. -- Walter Barrett
		shell.openExternal(url);
	});
}

app.on('ready', startup);

function startup()
{
	createWindow();
	setupMainMenu();
	createTrayIcon();
}

function setupMainMenu()
{
	let mainMenuTemplate = [
	{
		label: 'File',
		submenu:
		[
			{
				label: 'Exit',
				click: () =>
				{
					app.isQuiting = true;
					app.quit();
				}
			}
		]
	},
	{
		label: 'View',
		submenu:
		[
			{role: 'reload'},
			{role: 'forcereload'},
			{role: 'toggledevtools'},
			{type: 'separator'},
			{role: 'togglefullscreen'}
		]
	},
	{
		label: 'Help',
		submenu:
		[
			{
				label: 'About',
				click: () =>
				{
					win.webContents.send("change-view", "About");
				}
			}
		]
	}
	];

	if (process.platform === 'darwin')
	{
		mainMenuTemplate.unshift({
			label: app.getName(),
			submenu:
			[
				{role: 'about'},
				{type: 'separator'},
				{role: 'services', submenu: []},
				{type: 'separator'},
				{role: 'hide'},
				{role: 'hideothers'},
				{role: 'unhide'},
				{type: 'separator'},
				{role: 'quit'}
			]
		});
	}

	let mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
	Menu.setApplicationMenu(mainMenu);
}

function createTrayIcon()
{
	trayIcon = new Tray(ICON_PATH);
	let trayMenu = Menu.buildFromTemplate([
		{
			label: 'Show',
			click: () =>
			{
				win.show();
			}
		},
		{
			type: 'separator'
		},
		{
			label: 'Library',
			click: () =>
			{
				win.show();
				win.webContents.send("change-view", "Library");
			}
		},
		{
			label: 'Settings',
			click: () =>
			{
				win.show();
				win.webContents.send("change-view", "Settings");
			}
		},
		{
			label: 'About',
			click: () =>
			{
				win.show();
				win.webContents.send("change-view", "About");
			}
		},
		{
			type: 'separator'
		},
		{
			label: 'Exit',
			click: () =>
			{
				app.isQuiting = true;
				app.quit();
			}
		}
	]);
	
	trayIcon.on('click', () =>
	{
		win.show();
	});
	
	trayIcon.setContextMenu(trayMenu);
	trayIcon.setToolTip(packageJson.name);
	trayIcon.setTitle(packageJson.name);
	if (process.platform === 'darwin')
	{
		trayIcon.setIgnoreDoubleClickEvents(true);
	}
}

app.on('window-all-closed', () =>
{
	app.isQuiting = true;
	app.quit();
});

function getFile(filePath)
{
	return fs.readFileSync(filePath, 'utf-8');
}

function readTextFile(filePath)
{
	let data = getFile(filePath);
	return data;
}

function HandleDebugProxy(filePath)
{
	if (settingsStore.get("DebugProxying"))
	{
		return filePath.replace("https://raw.githubusercontent.com/OpenDistribution/od-gamelist/master/", "http://localhost/Capstone-proxy-gamelist/");
	}
	else
	{
		return filePath;
	}
}

function handleGamedef(filePath)
{
	filePath = HandleDebugProxy(filePath);
	//console.log(`WE ARE REQUESTING THE FOLLOWING GAMEDEF: ${filePath}`);
	//console.log(`This is a gamedef: ${filePath}`);
	let request = net.request(filePath);
	request.setHeader("Cache-Control", "no-cache");
	let body = '';
	request.on('response', (response) =>
	{
		//console.log(`STATUS: ${response.statusCode}`);
		//console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
		response.on('data', (chunk) =>
		{
			//console.log(`BODY: ${chunk}`);
			body += chunk.toString();
		});
		response.on('end', () =>
		{
			//console.log(`END REQUEST`);
			//console.log(`BODY: ${body}`);
			
			if (body != null && body != '')
			{
				//gameLibrary.set(gameJSON.id, JSON.parse(body));
				
				try
				{
					let passedData = JSON.parse(body);
					let gameId = passedData.id;
					if (passedData.hasOwnProperty("version"))
					{
						let latestVersion = passedData.version;
						delete passedData["version"];
						passedData["latestVersion"] = latestVersion;
						
						if (libraryStore.has(gameId))
						{
							if (libraryStore.has(`${gameId}.Version`))
							{
								passedData["installedVersion"] = libraryStore.get(`${gameId}.Version`);
							}
						}
					}
					
					if (passedData.hasOwnProperty("screenshots"))
					{
						for (let i = 0; i < passedData.screenshots.length; i++)
						{
							passedData.screenshots[i] = HandleDebugProxy(passedData.screenshots[i]);
						}
					}
					
					win.webContents.send("games-list-addition", passedData);
				}
				catch(e)
				{
					LogError(`Error parsing .gamedef @ "${filePath}": ${e.message}`);
				}
			}
		});
		response.on('error', (error) =>
		{
			console.log("[==");
			console.log(`REQUEST URL: ${filePath}`);
			console.log(`STATUS: ${response.statusCode}`);
			console.log(`ERROR: ${JSON.stringify(error)}`);
			console.log("==]");
		});
	})
	request.end();
}

function handleGamelist(filePath)
{
	filePath = HandleDebugProxy(filePath);
	//console.log(`WE ARE REQUESTING THE FOLLOWING PATH: ${filePath}`);
	let request = net.request(filePath);
	request.setHeader("Cache-Control", "no-cache");
	let body = '';
	request.on('response', (response) =>
	{
		//console.log(`STATUS: ${response.statusCode}`);
		//console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
		response.on('data', (chunk) =>
		{
			//console.log(`BODY: ${chunk}`);
			body += chunk.toString();
		});
		response.on('end', () =>
		{
			//console.log(`END REQUEST`);
			//console.log(`BODY: ${body}`);
			
			if (body != null && body != '')
			{
				let gamedefs = body.split(/[\r\n]+/);
				for (let j = 0; j < gamedefs.length; j++)
				{
					let gamedef = gamedefs[j];
					if (gamedef != null && gamedef != "")
					{
						handleGamedef(gamedef);
					}
				}
			}
		});
		response.on('error', (error) =>
		{
			console.log("[==");
			console.log(`REQUEST URL: ${filePath}`);
			console.log(`STATUS: ${response.statusCode}`);
			console.log(`ERROR: ${JSON.stringify(error)}`);
			console.log("==]");
		});
	});
	request.end();
}

function refreshLibrary()
{
	let gamelists = readTextFile("gamelists.txt").split(/[\r\n]+/);
	
	win.webContents.send("games-list-refreshing");
	
	for (let j = 0; j < gamelists.length; j++)
	{
		let gamelist = gamelists[j];
		if (gamelist != null && gamelist != "")
		{
			handleGamelist(gamelists[j]);
		}
	}
}

function refreshSettings()
{
	win.webContents.send("settings-list", settingsStore.store);
}

function GetBaseDir(filePath)
{
	return app.getPath('userData') + filePath;
}

ipcMain.on('download-file', function (event, gameId, downloadUrl, version)
{
	downloadUrl = HandleDebugProxy(downloadUrl);

	console.log(`download-file: ${gameId}, ${downloadUrl}`);
	libraryStore.delete(`${gameId}.Version`);
	downloadInfo.set(gameId, {"downloadProgress": 0, "extractionProgress": 0});
	
	if (!fs.existsSync(GetBaseDir("/Downloads")))
	{
		fs.mkdirSync(GetBaseDir("/Downloads"));
	}
	
	if (!fs.existsSync(GetBaseDir("/Games")))
	{
		fs.mkdirSync(GetBaseDir("/Games"));
	}
	
	if (!fs.existsSync(GetBaseDir(`/Games/${gameId}`)))
	{
		fs.mkdirSync(GetBaseDir(`/Games/${gameId}`));
	}
	
	downloadFile(gameId, downloadUrl, GetBaseDir(`/Downloads/${gameId}.ZIP`), function()
	{
		//libraryStore.set(`${gameId}.Version`, version);
		
		let dNfo = downloadInfo.get(gameId);
		dNfo.downloadProgress = 100;
		SendProgressReport(gameId);
		
		console.log("Finished downloading the file!");
		console.log("Start extract.");
		
		console.log("Should write to: " + GetBaseDir(`/Games/${gameId}`));

		let lastExtractUpdate = 0;

		let tempDownloadLocation = GetBaseDir(`/Downloads/${gameId}.ZIP`)
		let unzipper = new DecompressZip(tempDownloadLocation);
		unzipper.on('error', function (err)
		{
			console.log('Error: ', err);
		});

		unzipper.on('extract', function (log)
		{
			//console.log(`Extraction finished: ${log}`);
			fs.unlink(tempDownloadLocation, function(err)
			{
				if (err !== undefined && err !== null && err !== '')
				{
					console.log(`Error deleting file ${tempDownloadLocation} after extraction: ${err}`);
				}
				else
				{
					console.log(`Extracted and deleted ${tempDownloadLocation}.`);
					
					libraryStore.set(`${gameId}.Version`, version);
					
					downloadInfo.delete(gameId);
					SendProgressReport(gameId);
				}
			});
		});

		unzipper.on('progress', function (fileIndex, fileCount)
		{
			//libraryStore.set(`${gameId}.Version`, version);
			
			let dateNow = Date.now();
			
			if(dateNow >= lastExtractUpdate + 3000)
			{
				lastExtractUpdate = dateNow;
				let dNfo = downloadInfo.get(gameId);
				dNfo.extractionProgress = (fileIndex/fileCount) * 100;
				SendProgressReport(gameId);
			}
			
			
			//console.log(`Progress: Extracted ${fileIndex + 1}/${fileCount}.`);
		});

		unzipper.extract({ path: GetBaseDir(`/Games/${gameId}`) });
	});
});

ipcMain.on('request-default-view', function (event)
{
	if (settingsStore.get("DefaultTab") == "Last")
	{
		win.webContents.send("change-view", settingsStore.get("LastView"));
	}
	else
	{
		win.webContents.send("change-view", settingsStore.get("DefaultTab"));
	}
});

ipcMain.on('updated-view', function (event, message)
{
	settingsStore.set("LastView", message);
});

ipcMain.on('play-game', function (event, gameId, command, gameJSON)
{
	if (!IsNullOrEmpty(command.page))
	{
		if (settingsStore.get("OpenBrowserGamesExternally"))
		{
			shell.openExternal(GetBaseDir(`/Games/${gameId}/${command.page}`));
		}
		else
		{
			let gameRoot = GetBaseDir(`/Games/${gameId}/`);
			let winFavicon = ICON_PATH;
			
			if (fs.existsSync(`${gameRoot}favicon.ico`))
			{
				winFavicon = `${gameRoot}favicon.ico`;
			}
			
			// TODO: Check if it has a favicon.
			gameWin = new BrowserWindow({
				width: 800,
				height: 600,
				minHeight: 500,
				minWidth: 500,
				title: gameJSON.name,
				icon: winFavicon,
				webPreferences: {
					nodeIntegration: false,
					contextIsolation: true,
					sandbox: true,
					partition: `persist:${gameJSON.id}`
				}
			});
			
			gameWin.setMenu(null);
			
			if (settingsStore.get("StartMaximized") != false)
			{
				gameWin.maximize();
			}
			
			gameWin.loadFile(`${gameRoot}${command.page}`)
			
			gameWin.on('closed', () =>
			{
				gameWin = null; // Garbage collect it.
			});
		}
	}
	else
	{
		execFile(command.cmd, command.args,
		{
			"cwd": GetBaseDir(`/Games/${gameId}`)
		});
	}
});

ipcMain.on('update-game', function (event, gameId)
{
	console.log("Received unimplemented \"update-game\" event!");
});

ipcMain.on('change-setting', function (event, settingName, settingValue)
{
	console.log(`${settingName} = ${settingValue}`);
	settingsStore.set(settingName, settingValue);
	
	if (settingName == "DeveloperTools")
	{
		if (settingsStore.get("DeveloperTools"))
		{
			win.webContents.openDevTools();
		}
		else
		{
			win.webContents.closeDevTools();
		}
	}
});

ipcMain.on('uninstall-game', function (event, gameId)
{
	console.log(`uninstall-game: ${gameId}`);
	let pathToUninstall = GetBaseDir(`/Games/${gameId}`);
	fs.remove(pathToUninstall, function(err)
	{
		if (err !== undefined && err !== null && err !== '')
		{
			console.log(`Error deleting directory ${pathToUninstall}: ${err}`);
		}
		else
		{
			console.log(`Deleted directory ${pathToUninstall}.`);
			libraryStore.delete(`${gameId}.Version`);
			SendProgressReport(gameId);
		}
	});
});

function SendProgressReport(gameId)
{
	let dNfo = downloadInfo.get(gameId);
	if (dNfo !== undefined && dNfo !== null)
	{
		win.webContents.send("progress-report", gameId, dNfo);
	}
	else
	{
		win.webContents.send("progress-report", gameId, {
			"installedVersion": libraryStore.get(`${gameId}.Version`)
		});
	}
}

function LogError(errorMessage)
{
	console.log(`error-occurred: ${errorMessage}`);
	win.webContents.send("error-occurred", errorMessage);
}

ipcMain.on('request-error-message-test', function (event)
{
	LogError(`Error parsing .gamedef @ "http://localhost/Capstone-proxy-gamelist/games/vegastrike.gamedef": Unexpected token h in JSON at position 856`);
});

function IsNullOrEmpty(str)
{
	return str === undefined || str === null || str === "";
}
