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

function GetGoodSize(size)
{
	// Credit: https://stackoverflow.com/a/20732091/827326
	let i = Math.floor( Math.log(size) / Math.log(1024) );
	return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
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
			
			/*console.log(gameId);
			console.log(selectedGame.latestVersion);
			console.log(selectedGame.installedVersion);*/
			if (selectedGame.latestVersion != selectedGame.installedVersion)
			{
				gameUpdate.style.display = 'inline-block';
				gameUpdate.onclick = function()
				{
					gameUpdate.onclick = function() {};
					gameUpdate.style.display = 'none';
					
					console.log("download-game");
					gameDownload.classList.add('inprogress');
					ipcRenderer.send("download-game", gameId);
					gameDownload.onclick = function() {};
				};
			}
			
			if (IsNullOrEmpty(selectedGame.cachedLaunch) || (!IsNullOrEmpty(selectedGame.cachedLaunch) && selectedGame.cachedLaunch.length == 0))
			{
				gameDownload.innerHTML = "Can't Launch";
				gameDownload.classList.add('na');
				gameDownload.onclick = function() {};
			}
			else
			{
				gameDownload.innerHTML = "&#x25B6; Play";
				//console.log(selectedGame.cachedLaunch);
				if (Object.keys(selectedGame.cachedLaunch).length == 1)
				{
					let command = selectedGame.cachedLaunch[Object.keys(selectedGame.cachedLaunch)[0]];
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
						for (i = 0; i < Object.keys(selectedGame.cachedLaunch).length; i++)
						{
							let command = selectedGame.cachedLaunch[Object.keys(selectedGame.cachedLaunch)[i]];
							let launch = document.createElement('button');
							launch.innerHTML = Object.keys(selectedGame.cachedLaunch)[i];
							launch.setAttribute("type", "button");
							launch.onclick = function()
							{
								ipcRenderer.send("play-game", gameId, command, selectedGame);
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
				if (IsNullOrEmpty(selectedGame.extractedsizeinbytes))
				{
					gameDownload.innerHTML = "Download";
				}
				else
				{
					gameDownload.innerHTML = `Download (${GetGoodSize(selectedGame.extractedsizeinbytes)})`;
					
				}
				gameDownload.onclick = function()
				{
					console.log("download-game");
					gameDownload.classList.add('inprogress');
					ipcRenderer.send("download-game", gameId);
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
	let screenshotThing = new Siema({selector: "#gameInfoScreenshots", loop: "true", perPage: 1});
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
	let librarySidebar = document.getElementById('librarySidebar');
	gamesList.innerHTML = "<li><b>Refreshing</b></li>";
	librarySidebar.classList.add("refreshing");
	librarySidebar.classList.remove("na");
});

ipcRenderer.on('games-list-unavailable', (event, message) =>
{
	console.log('games-list-unavailable');
	if (refreshingList.length == 0)
	{
		let gamesList = document.getElementById('gamesList');
		let librarySidebar = document.getElementById('librarySidebar');
		gamesList.innerHTML = "<li><b>Unavailable</b></li>";
		librarySidebar.classList.remove("refreshing");
		librarySidebar.classList.add("na");
	}
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
	let librarySidebar = document.getElementById('librarySidebar');
	let gamesList = document.getElementById('gamesList');
	
	if (librarySidebar.classList.contains('refreshing'))
	{
		gamesList.innerHTML = '';
		librarySidebar.classList.remove('na');
		librarySidebar.classList.remove('refreshing');
	}
	
	let gameJSON = message;
	gameLibrary.set(gameJSON.id, gameJSON);
	
	let gameEntry;
	for (let i = 0; i < refreshingList.length; i++)
	{
		if (refreshingList[i].getAttribute("for") == gameJSON.id)
		{
			gameEntry = refreshingList[i];
			DisplayGameProgress(gameJSON.id);
		}
	}
	
	if (IsNullOrEmpty(gameEntry))
	{
		gameEntry = document.createElement('li');
		gameEntry.appendChild(document.createTextNode(gameJSON.name));
		gameEntry.onclick = function() { selectGameInLibrary(gameJSON.id); };
		gameEntry.setAttribute("id", "gameEntry"+gameJSON.id);
		gameEntry.setAttribute("for", gameJSON.id);
		UpdateGameEntryVisuals(gameEntry);
		
		refreshingList.push(gameEntry);
	}
	
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
			authors += `<li><a href="${author.url}" target="_blank">${author.name}</a></li>`;
		}
		else
		{
			authors += `<li>${author.name}</li>`;
		}
	}
	
	let npmmodules = "";
	for(let i = 0; i < using.length; i++)
	{
		let dependency = using[i];
		npmmodules += `<li>
			<a href="${dependency.homepage}" target="_blank">${dependency.name}</a> ${dependency.version} (${license.parse(dependency.license)})
			<ul>
				<li>${dependency.description}</li>
			</ul>
		</li>`;
	}
	
	tabBodyAbout.innerHTML = `<h1>${message.name} ${message.version}</h1>
	<p>
		${message.description}<br/>
		License: ${license.parse(message.license)}
	</p>
	
	<h2>Developers</h2>
	<ul>
		${authors}
	</ul>
	
	<h2>Using</h2>
	<ul>
		${npmmodules}
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
	/*console.log("progress-report:");
	console.log(message);*/
});

ipcRenderer.on('error-occurred', (event, message) =>
{
	console.log(`Node.js Error: ${message}`);
});

ipcRenderer.on('send-message', (event, message) =>
{
	console.log(`Node.js says: ${message}`);
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

function OpenGameDirectory(gameId)
{
	if (IsNullOrEmpty(gameId))
	{
		gameId = selectedGameId;
	}
	
	console.log(`open-game-directory: ${gameId}`);
	ipcRenderer.send("open-game-directory", gameId);
	CloseAllModals();
}
