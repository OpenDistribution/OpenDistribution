const {ipcRenderer} = require('electron');
let fs = require('fs');

let selectedGameId = null;
let gameLibrary = new Map();
let downloadInfo = new Map();

function closeTabs()
{
	CloseAllModals();
	let tabBodies = document.getElementsByClassName('tabBody');
	
	for (let i = 0; i < tabBodies.length; i++)
	{
		tabBodies[i].style.display = 'none';
	}
	
	let tabs = document.getElementsByClassName('activeTab');

	for (i = 0; i < tabs.length; i++)
	{
		tabs[i].classList.remove("activeTab");
	}
}

function openTab(tabName)
{
	closeTabs();
	let tabBody = document.getElementById('tabBody'+tabName);
	tabBody.style.display = 'block';
	let tab = document.getElementById('tab'+tabName);
	tab.classList.add("activeTab");
	ipcRenderer.send("updated-view", tabName);
}

function onLoad()
{
	ipcRenderer.send("request-default-view");
}

function DisplayGameProgress(gameId)
{
	// Always:
	UpdateGameEntryVisuals(document.getElementById(`gameEntry${gameId}`));
	
	// Only if we're currently looking at this game entry:
	if (gameId == selectedGameId)
	{
		let selectedGame = gameLibrary.get(gameId);
		
		let gameDownload = document.getElementById('gameDownloadButton');
		gameDownload.classList.remove('na');
		gameDownload.classList.remove('inprogress');
		
		let gameOptions = document.getElementById('gameOptionsButton');
		gameOptions.classList.remove('na');
		gameOptions.onclick = function() {};
		
		let gameUpdate = document.getElementById('gameUpdateButton');
		gameUpdate.style.display = 'none';
		
		if (IsGameDownloading(gameId))
		{
			gameDownload.classList.add('inprogress');
			gameDownload.onclick = function() {};
			
			gameOptions.classList.add('na');
			
			let dNfo = downloadInfo.get(gameId);
			
			if (dNfo.extractionProgress > 0)
			{
				gameDownload.innerHTML = `Extracting (${+dNfo.extractionProgress.toFixed(2)}%)`;
			}
			else
			{
				gameDownload.innerHTML = `Downloading (${+dNfo.downloadProgress.toFixed(2)}%)`;
			}
		}
		else if (IsGameInstalled(gameId))
		{
			// The game is installed.
			gameOptions.onclick = function()
			{
				OpenOptionsModal();
			};
			
			if (selectedGame.latestVersion != selectedGame.installedVersion)
			{
				gameUpdate.style.display = 'block';
				gameUpdate.onclick = function()
				{
					gameUpdate.style.display = 'none';
					gameDownload.classList.add('inprogress');
					console.log("update-game");
					ipcRenderer.send("update-game", gameId, selectedGame.download, selectedGame.latestVersion);
				};
			}
			
			if (IsNullOrEmpty(selectedGame.launch) || (!IsNullOrEmpty(selectedGame.launch) && selectedGame.launch.length == 0))
			{
				gameDownload.innerHTML = "Can't Launch";
				gameDownload.classList.add('na');
				gameDownload.onclick = function() {};
			}
			else
			{
				gameDownload.innerHTML = "&#x25B6; Play";
				//console.log(selectedGame.launch);
				if (Object.keys(selectedGame.launch).length == 1)
				{
					let command = selectedGame.launch[Object.keys(selectedGame.launch)[0]];
					gameDownload.onclick = function()
					{
						ipcRenderer.send("play-game", gameId, command);
					};
				}
				else
				{
					gameDownload.onclick = function()
					{
						let modal = document.getElementById('modalLaunchOptions');
						modal.innerHTML = "";
						for (i = 0; i < Object.keys(selectedGame.launch).length; i++)
						{
							let command = selectedGame.launch[Object.keys(selectedGame.launch)[i]];
							let launch = document.createElement('button');
							launch.innerHTML = Object.keys(selectedGame.launch)[i];
							launch.setAttribute("type", "button");
							launch.onclick = function()
							{
								ipcRenderer.send("play-game", gameId, command);
								CloseAllModals();
							}
							
							let launchHolder = document.createElement('li');
							launchHolder.appendChild(launch);
							modal.appendChild(launchHolder);
						}
						OpenLaunchModal();
					};
				}
			}
		}
		else
		{
			// The game is not installed.
			gameOptions.classList.add('na');
			
			if (!IsNullOrEmpty(selectedGame.download))
			{
				gameDownload.innerHTML = "Download";
				gameDownload.onclick = function()
				{
					console.log("download-file");
					gameDownload.classList.add('inprogress');
					ipcRenderer.send("download-file", gameId, selectedGame.download, selectedGame.latestVersion);
					gameDownload.onclick = function() {};
				};
			}
			else
			{
				gameDownload.innerHTML = "Download Unavailable";
				gameDownload.classList.add('na');
				gameDownload.onclick = function() {};
			}
		}
	}
}

function RefreshActiveGameEntry()
{
	let entries = document.getElementsByClassName('activeGameEntry');
	for (let i = 0; i < entries.length; i++)
	{
		entries[i].classList.remove("activeGameEntry");
	}
	
	let gameEntry = document.getElementById('gameEntry'+selectedGameId);
	if (gameEntry !== null)
	{
		gameEntry.classList.add("activeGameEntry");
	}
}

// TODO: Make this handle arrays as well, in case, say, there's multiple community options (i.e. forums and Skype or Discord)
function SetGameLink(linkId, value)
{
	let gameLink = document.getElementById(linkId);
	if (IsNullOrEmpty(value))
	{
		gameLink.href = "javascript:void(0)";
		gameLink.disabled = true;
		gameLink.classList.add("disabled");
	}
	else
	{
		gameLink.href = value;
		gameLink.classList.remove("disabled");
	}
}

function softSelectGameInLibrary(gameId)
{
	selectedGameId = gameId;
	let selectedGame = gameLibrary.get(gameId);
	
	RefreshActiveGameEntry();
	
	let gameInfoName = document.getElementById('gameInfoName');
	gameInfoName.innerHTML = selectedGame.name;
	
	let uninstallGameName = document.getElementById('uninstallGameName');
	uninstallGameName.innerHTML = selectedGame.name;
	
	DisplayGameProgress(gameId);
	
	SetGameLink('gameWebsiteButton', selectedGame.website);
	SetGameLink('gameCommunityButton', selectedGame.community);
	SetGameLink('gameWikiButton', selectedGame.wiki);
	SetGameLink('gameManualButton', selectedGame.manual);
	SetGameLink('gameIssuesButton', selectedGame.issues);
	SetGameLink('gameSourceCodeButton', selectedGame.repository);
	SetGameLink('gameDonateButton', selectedGame.donate);
	
	let gameDescription = document.getElementById('gameDescription');
	gameDescription.innerHTML = "";
	if (!IsNullOrEmpty(selectedGame.description))
	{
		gameDescription.innerHTML = selectedGame.description;
	}
	
	let gameInfoScreenshots = document.getElementById('gameInfoScreenshots');
	gameInfoScreenshots.innerHTML = "";
	if (!IsNullOrEmpty(selectedGame.screenshots))
	{
		for (let i = 0; i < selectedGame.screenshots.length; i++)
		{
			let screenshot = document.createElement('img');
			screenshot.setAttribute("src", selectedGame.screenshots[i]);
			gameInfoScreenshots.appendChild(screenshot);
		}
	}
}

function selectGameInLibrary(gameId)
{
	openTab('Library');
	
	softSelectGameInLibrary(gameId);
}

let refreshingList = [];

ipcRenderer.on('games-list-refreshing', (event, message) =>
{
	console.log('games-list-refreshing');
	let gamesList = document.getElementById('gamesList');
	gamesList.innerHTML = "<li><b>Refreshing</b></li>";
	gamesList.classList.add("refreshing");
});

function gamesListRefreshed()
{
	//console.log('games-list-refreshed');
	let gamesList = document.getElementById('gamesList');
	
	refreshingList.sort(function(a, b)
	{
		return a.textContent.localeCompare(b.textContent);
	});
	
	for (let i = 0; i < refreshingList.length; i++)
	{
		//console.log(`games-list-refreshed: ${i}`);
		gamesList.appendChild(refreshingList[i]);
	}
	
	RefreshActiveGameEntry();
}

ipcRenderer.on('games-list-addition', (event, message) =>
{
	console.log(`games-list-addition: ${message}`);
	let gamesList = document.getElementById('gamesList');
	
	let refreshingGamesList = document.getElementsByClassName('refreshing');
	for (let i = 0; i < refreshingGamesList.length; i++)
	{
		refreshingGamesList[i].innerHTML = "";
		refreshingGamesList[i].classList.remove("refreshing");
	}
	
	let gameJSON = message;
	gameLibrary.set(gameJSON.id, gameJSON);
	
	let gameEntry = document.createElement('li');
	gameEntry.appendChild(document.createTextNode(gameJSON.name));
	gameEntry.onclick = function() { selectGameInLibrary(gameJSON.id); };
	gameEntry.setAttribute("id", "gameEntry"+gameJSON.id);
	gameEntry.setAttribute("for", gameJSON.id);
	UpdateGameEntryVisuals(gameEntry);
	
	refreshingList.push(gameEntry);
	
	if (selectedGameId === null)
	{
		softSelectGameInLibrary(gameJSON.id);
	}
	
	gamesListRefreshed();
});

function UpdateGameEntryVisuals(gameEntry)
{
	if (gameEntry !== null)
	{
		let gameId = gameEntry.getAttribute("for");
		let gameJSON = gameLibrary.get(gameId);
		
		if (IsGameDownloading(gameId))
		{
			let dNfo = downloadInfo.get(gameId);
			gameEntry.innerHTML = `${gameJSON.name} (${+((dNfo.downloadProgress * 0.95) + (dNfo.extractionProgress * 0.05)).toFixed(2)}%)`;
			//gameEntry.innerHTML = `${gameJSON.name} (${dNfo.downloadProgress}%, ${dNfo.extractionProgress}%)`;
			gameEntry.classList.remove("installed");
			gameEntry.classList.remove("uninstalled");
			gameEntry.classList.add("downloading");
		}
		else
		{
			gameEntry.innerHTML = gameJSON.name;
			if (IsGameInstalled(gameId))
			{
				gameEntry.classList.add("installed");
				gameEntry.classList.remove("uninstalled");
				gameEntry.classList.remove("downloading");
			}
			else
			{
				gameEntry.classList.remove("installed");
				gameEntry.classList.add("uninstalled");
				gameEntry.classList.remove("downloading");
			}
		}
	}
}

ipcRenderer.on('change-view', (event, message) =>
{
	openTab(message);
});

ipcRenderer.on('update-about', (event, message) =>
{
	let tabBodyAbout = document.getElementById('tabBodyAbout');
	
	let authorsList = message.contributors;
	authorsList.push(message.author);
	// We don't have a good way of sorting by last name yet.
	authorsList.sort(function(a, b)
	{
		return a.name.localeCompare(b.name);
	});
	
	let authors = "";
	for(let i = 0; i < authorsList.length; i++)
	{
		let author = authorsList[i];
		if (!IsNullOrEmpty(author.url))
		{
			authors += `<li><a href="${author.url}" target="_blank">${authorsList[i].name}</a></li>`;
		}
		else
		{
			authors += `<li>${authorsList[i].name}</li>`;
		}
	}
	
	tabBodyAbout.innerHTML = `<h1>${message.name}</h1>
	<p>
		${message.description}<br/>
		License: ${message.license}
	</p>
	
	<h2>Developers</h2>
	<ul>
		${authors}
	</ul>
	
	<h2>Using</h2>
	<ul>
		<li>node ${process.versions.node}</li>
		<li>Chromium ${process.versions.chrome}</li>
		<li>Electron ${process.versions.electron}</li>
	</ul>
	
	<h2>Contribute</h2>
	<ul>
		<li><a href="${message.homepage}" target="_blank">View project on Github.</a></li>
		<li><a href="${message.bugs.url}" target="_blank">Post a new issue.</a></li>
	</ul>`;
});

function InputChange(srcInput)
{
	if (srcInput.type == "checkbox")
	{
		ipcRenderer.send("change-setting", srcInput.name, srcInput.checked);
		//console.log(`${srcInput.name} = ${srcInput.checked}`);
	}
	else if (srcInput.type == "radio")
	{
		ipcRenderer.send("change-setting", srcInput.name, srcInput.value);
		//console.log(`${srcInput.name} = ${srcInput.value}`);
	}
	else if (srcInput.type == "text")
	{
		ipcRenderer.send("change-setting", srcInput.name, srcInput.value);
		//console.log(`${srcInput.name} = ${srcInput.value}`);
	}
}

// Options Modals

function CloseAllModals()
{
	let backdrop = document.getElementById('libraryBackdrop');
	let modalLaunch = document.getElementById('modalLaunch');
	let modalOptions = document.getElementById('modalOptions');
	backdrop.style.display = 'none';
	modalLaunch.style.display = 'none';
	modalOptions.style.display = 'none';
	CloseAYSModals();
}

function OpenLaunchModal()
{
	let backdrop = document.getElementById('libraryBackdrop');
	let modalLaunch = document.getElementById('modalLaunch');
	let modalOptions = document.getElementById('modalOptions');
	backdrop.style.display = 'block';
	modalLaunch.style.display = 'block';
	modalOptions.style.display = 'none';
}

function OpenOptionsModal()
{
	let backdrop = document.getElementById('libraryBackdrop');
	let modalLaunch = document.getElementById('modalLaunch');
	let modalOptions = document.getElementById('modalOptions');
	backdrop.style.display = 'block';
	modalLaunch.style.display = 'none';
	modalOptions.style.display = 'block';
}

// "Are You Sure?" Modals

function CloseAYSModals()
{
	let backdrop = document.getElementById('areyousureBackdrop');
	let modalUninstall = document.getElementById('modalLaunch');
	backdrop.style.display = 'none';
	modalUninstall.style.display = 'none';
}

function OpenUninstallModal()
{
	let backdrop = document.getElementById('areyousureBackdrop');
	let modalUninstall = document.getElementById('modalLaunch');
	backdrop.style.display = 'block';
	modalUninstall.style.display = 'block';
}

ipcRenderer.on('settings-list', (event, message) =>
{
	let tabBodySettings = document.getElementById('tabBodySettings');
	let inputs = tabBodySettings.getElementsByTagName("input");
	
	//console.log("settings-list:");
	//console.log(message);
	//console.log(inputs);
	
	for(let i = 0; i < inputs.length; i++)
	{
		let input = inputs[i];
		if (input.type == "checkbox")
		{
			input.checked = message[input.name];
		}
		else if (input.type == "radio")
		{
			if (message[input.name] == input.value)
			{
				input.checked = true;
			}
			else
			{
				input.checked = false;
			}
		}
		else if (input.type == "text")
		{
			input.value = message[input.name];
		}
		else
		{
			console.log(`Unknown input type "${input.type}" with name "${input.name}" and value "${input.value}".`);
		}
		input.onchange = function()
		{
			InputChange(input);
		}
	}
});

function UninstallGame(gameId)
{
	if (IsNullOrEmpty(gameId))
	{
		gameId = selectedGameId;
	}
	
	console.log(`uninstall-game: ${gameId}`);
	ipcRenderer.send("uninstall-game", gameId);
	CloseAllModals();
}

ipcRenderer.on('progress-report', (event, gameId, message) =>
{
	let currentVersion = gameLibrary.get(gameId);
	currentVersion.installedVersion = message.installedVersion;
	if (IsNullOrEmpty(message.downloadProgress))
	{
		downloadInfo.delete(gameId);
	}
	else
	{
		downloadInfo.set(gameId, message);
	}
	DisplayGameProgress(gameId);
	console.log("progress-report:");
	console.log(message);
});

ipcRenderer.on('error-occurred', (event, message) =>
{
	console.log(`Node.js Error: ${message}`);
});

function IsGameDownloading(gameId)
{
	return downloadInfo.has(gameId);
}

function IsGameInstalled(gameId)
{
	let gameJSON = gameLibrary.get(gameId);
	
	return !IsNullOrEmpty(gameJSON.installedVersion);
}

function IsNullOrEmpty(str)
{
	return str === undefined || str === null || str === "";
}

function SendTestErrorMessages()
{
	ipcRenderer.send("request-error-message-test");
}
