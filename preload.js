const {ipcRenderer} = require('electron');
const packageJson = require('./package.json');
const fs = require('fs-extra');
const path = require('path');

function IsNullOrEmpty(str)
{
	return str === undefined || str === null || str === "";
}

function GetUsings()
{
	let usings = [];
	let dependencies = Object.keys(packageJson.dependencies).concat(Object.keys(packageJson.devDependencies));
	for(let i = 0; i < dependencies.length; i++)
	{
		let dependency = JSON.parse(fs.readFileSync(path.join(__dirname, `node_modules/${dependencies[i]}/package.json`), 'utf-8'));
		//console.log(dependency);
		let dependencyHomepage = dependency.homepage;
		if (IsNullOrEmpty(dependencyHomepage))
		{
			dependencyHomepage = `https://www.npmjs.com/package/${dependencies[i]}`;
		}
		
		let using = {
			"id": dependencies[i],
			"name": dependency.name,
			"version": dependency.version,
			"license": dependency.license,
			"homepage": dependencyHomepage,
			"description": dependency.description
		};
		usings.push(using);
	}
	
	usings.push({
		"id": "chromium",
		"name": "Chromium",
		"version": process.versions.chrome,
		"license": "BSD-3-Clause",
		"homepage": "https://www.chromium.org/Home",
		"description": "Chromium is an open-source browser project that aims to build a safer, faster, and more stable way for all Internet users to experience the web."
	});
	
	usings.push({
		"id": "node",
		"name": "Node.js",
		"version": process.versions.node,
		"license": "MIT",
		"homepage": "https://nodejs.org/",
		"description": "Node.js&reg; is a JavaScript runtime built on Chrome's V8 JavaScript engine."
	});
	
	usings.sort(function(a, b)
	{
		return a.name.localeCompare(b.name);
	});
	
	return usings;
}

process.once('loaded', () => {
	global.ipcRenderer = ipcRenderer;
	global.using = GetUsings();
	global.license = {
		"parse": function(license)
		{
			let name = license;
			if (license == "MIT")
			{
				name = "MIT License";
			}
			else if (license == "BSD-3-Clause")
			{
				name = "BSD 3-Clause License"; //'BSD 3-Clause "New" or "Revised" License';
			}
			else if (license == "Apache-2.0")
			{
				name = "Apache License 2.0";
			}
			return `<a href="https://spdx.org/licenses/${license}.html" target="_blank">${name}</a>`;
		}
	};
});
