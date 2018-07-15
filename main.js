const {app, net, path, shell, BrowserWindow, ipcMain, Tray, Menu} = require('electron');
let fs = require('fs');
let http = require('http');
let request = require('request');
let progress = require('request-progress');
let packageJson = require('./package.json');
let DecompressZip = require('decompress-zip');

let ICON_PATH = './icon.png';

let win = null; // This needs to be global, or it'll be garbage collected.
let trayIcon = null;

let libraryInfo = {};

function loadSettings()
{
	
}

function downloadFile(source, destination, callback)
{
	let p = progress(request(source), {});
	p.on('progress', function (state)
	{
		console.log('progress', state);
	});
	p.on('error', function (err)
	{
		console.log('error', err);
	});
	p.on('end', callback).pipe(fs.createWriteStream(destination));
};

function createWindow()
{
	win = new BrowserWindow({
		width: 800,
		height: 600,
		title: packageJson.name,
		icon:ICON_PATH
	});
	
	win.loadFile('index.html');
	win.webContents.openDevTools();
	win.on('closed', () =>
	{
		win = null; // Garbage collect it.
	});
	
	loadSettings();
	
	win.webContents.on('did-finish-load', () =>
	{
		win.webContents.send("update-about", packageJson);
		refreshLibrary();
	});
	
	win.on('close', function(event)
	{
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

function handleGamedef(filePath)
{
	//console.log(`WE ARE REQUESTING THE FOLLOWING GAMEDEF: ${filePath}`);
	//console.log(`This is a gamedef: ${filePath}`);
	let request = net.request(filePath);
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
				win.webContents.send("games-list-addition", JSON.parse(body));
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
	//console.log(`WE ARE REQUESTING THE FOLLOWING PATH: ${filePath}`);
	let request = net.request(filePath);
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

function GetBaseDir()
{
	return app.getPath('userData');
}

ipcMain.on('download-file', function (event, gameId, downloadUrl)
{
	console.log(`download-file: ${gameId}, ${downloadUrl}`);
	
	if (!fs.existsSync(GetBaseDir() + "/Downloads"))
	{
		fs.mkdirSync(GetBaseDir() + "/Downloads");
	}
	
	if (!fs.existsSync(GetBaseDir() + "/Games"))
	{
		fs.mkdirSync(GetBaseDir() + "/Games");
	}
	
	if (!fs.existsSync(GetBaseDir() + `/Games/${gameId}`))
	{
		fs.mkdirSync(GetBaseDir() + `/Games/${gameId}`);
	}
	
	downloadFile(downloadUrl, GetBaseDir() + `/Downloads/${gameId}.ZIP`, function()
	{
		console.log("Finished downloading the file!");
		console.log("Start extract.");
		
		console.log("Should write to: " + GetBaseDir() + `/Games/${gameId}`);

		let unzipper = new DecompressZip(GetBaseDir() + `/Downloads/${gameId}.ZIP`);
		unzipper.on('error', function (err) {
			console.log('Error: ', err);
		});

		unzipper.on('extract', function (log) {
			console.log('End extract: ', log);
		});

		unzipper.on('progress', function (fileIndex, fileCount) {
			console.log(`Progress: Extracted ${fileIndex + 1}/${fileCount}.`);
		});

		unzipper.extract({
			path: GetBaseDir() + `/Games/${gameId}`
		});
	});
});
