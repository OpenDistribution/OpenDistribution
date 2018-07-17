const {ipcRenderer} = require('electron');
let fs = require('fs');

let selectedGameId = null;
let gameLibrary = new Map();

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
	ipcRenderer.send("request-view");
}

function softSelectGameInLibrary(gameId)
{
	selectedGameId = gameId;
	let selectedGame = gameLibrary.get(gameId);
	
	let entries = document.getElementsByClassName('activeGameEntry');
	for (let i = 0; i < entries.length; i++) { entries[i].classList.remove("activeGameEntry"); }
	
	let gameEntry = document.getElementById('gameEntry'+gameId);
	if (gameEntry !== null)
	{
		gameEntry.classList.add("activeGameEntry");
	}
	
	let gameInfoName = document.getElementById('gameInfoName');
	gameInfoName.innerHTML = selectedGame.name;
	
	let gameDownload = document.getElementById('gameDownloadButton');
	gameDownload.classList.remove('na');
	gameDownload.classList.remove('inprogress');
	
	if (selectedGame.installedVersion !== null && selectedGame.installedVersion !== undefined)
	{
		// The game is installed.
		if (selectedGame.latestVersion != selectedGame.installedVersion)
		{
			gameDownload.innerHTML = "Update";
			gameDownload.onclick = function()
			{
				gameDownload.classList.add('inprogress');
				console.log("update-game");
				ipcRenderer.send("update-game", gameId, selectedGame.download, selectedGame.latestVersion);
			};
		}
		else
		{
			gameDownload.innerHTML = "&#x25B6; Play";
			gameDownload.onclick = function()
			{
				console.log("play-game");
				ipcRenderer.send("play-game", gameId);
			};
		}
	}
	else
	{
		// The game is not installed.
		if (selectedGame.download !== null && selectedGame.download !== undefined)
		{
			gameDownload.innerHTML = "Download";
			gameDownload.onclick = function()
			{
				console.log("download-file");
				gameDownload.classList.add('inprogress');
				ipcRenderer.send("download-file", gameId, selectedGame.download, selectedGame.latestVersion);
			};
		}
		else
		{
			gameDownload.innerHTML = "Download Unavailable";
			gameDownload.classList.add('na');
			gameDownload.onclick = function() {};
		}
	}
	
	let gameDescription = document.getElementById('gameDescription');
	gameDescription.innerHTML = "";
	if (selectedGame.description !== null && selectedGame.description !== undefined)
	{
		gameDescription.innerHTML = selectedGame.description;
	}
	
	let gameInfoScreenshots = document.getElementById('gameInfoScreenshots');
	gameInfoScreenshots.innerHTML = "";
	if (selectedGame.screenshots !== null && selectedGame.screenshots !== undefined)
	{
		for (i = 0; i < selectedGame.screenshots.length; i++)
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

ipcRenderer.on('games-list-refreshing', (event, message) =>
{
	console.log('games-list-refreshing');
	let gamesList = document.getElementById('gamesList');
	gamesList.innerHTML = "<li><b>Refreshing</b></li>";
	gamesList.classList.add("refreshing");
});

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
	
	let gameEntry = document.createElement('li');
	gameEntry.appendChild(document.createTextNode(gameJSON.name));
	gamesList.appendChild(gameEntry);
	gameEntry.onclick = function() { selectGameInLibrary(gameJSON.id); };
	gameEntry.setAttribute("id", "gameEntry"+gameJSON.id);
	
	gameLibrary.set(gameJSON.id, gameJSON);
	
	if (selectedGameId === null)
	{
		softSelectGameInLibrary(gameJSON.id);
	}
});

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
		if (author.url !== undefined && author.url !== null && author.url !== '')
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
	if (srcInput.type == "radio")
	{
		console.log(`${srcInput.name} = ${srcInput.value}`);
	}
	else if (srcInput.type == "checkbox")
	{
		console.log(`${srcInput.name} = ${srcInput.checked}`);
	}
	console.log(srcInput);
}

function CloseAllModals()
{
	let backdrop = document.getElementById('libraryBackdrop');
	let modalLaunch = document.getElementById('modalLaunch');
	let modalOptions = document.getElementById('modalOptions');
	backdrop.style.display = 'none';
	modalLaunch.style.display = 'none';
	modalOptions.style.display = 'none';
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
