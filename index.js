const https = require('https')
var fs = require("fs");
var fsh = require("@pdulvp/fsh");
var httph = require("@pdulvp/httph");

var CUSTOM_CONFIGS = {
	"jellyfin-qnap-intel": "jellyfin/qpkg.cfg"
}

var github = {
	
	getRepositoriesByTopic: function(topic) {
		return new Promise((resolve, reject) => {
			//we suppose that there is at most 3 pages of milestones
			return Promise.all([1, 2, 3].map(m => httph.get("api.github.com", '/search/repositories?q=topic:'+topic+'&sort=stars&order=desc&page='+m))).then(e => {
				let resultPages = e.reduce(function (arr, row) {
					return arr.concat(JSON.parse(row).items);
				  }, []);
				resolve(resultPages);
			}).catch(e => {
				reject(e);
			});
		});
	},
	
	filterByOwner: function(repositories, owner) {
		return Promise.resolve(repositories.filter(t => t.owner.login == owner));
	},
	
	releases: function(repository) {
		return new Promise((resolve, reject) => {
			//we suppose that there is at most 3 pages of releases
			return httph.get("api.github.com", `/repos/${repository.full_name}/releases`).then(e => {
				repository.releases = JSON.parse(e);
				resolve(repository);
			}).catch(e => {
				reject(e);
			});
		});
	},
	
	fileFromTag: function(repository, tag, file) {
		return `/${repository.full_name}/${tag}/${file}`
	}
};

const concat = (x,y) => x.concat(y)

//From an array of values and a function returning a promise from a value
//Execute promises sequentially (Promise.all doesn't run sequentially)
function consecutive(values, fPromise) {
	return values.reduce((p, value) => {
		return p.then(() => {
			return fPromise(value);
		}).catch(error => {
			console.log(error);
		});
	}, Promise.resolve());
};

var qpkg = {
	toValue: function(value) {
		return value.substring(1, value.length - 1);
	},
	toJson: function(configuration) {
		let res = configuration.split("\n");
		res = res.filter(x => x.includes("="));
		res = res.filter(x => x[0]!='#');
		let obj = {};
		res.forEach(r => obj[r.split("=")[0]]=qpkg.toValue(r.split("=")[1]));
		return obj;
	},
	
	toRepoMetadata: function (repository) {
		if (repository.latestRelease == null) {
			return null;
		}
		let tag = repository.latestRelease.tag_name;
		let item = {};
		item.name = repository.configuration["QPKG_DISPLAY_NAME"];
		item.internalName = repository.configuration["QPKG_NAME"];
		item.changeLog = repository.latestRelease.html_url;
		item.category = "pdulvp";
		item.type = "Outils";
		item.icon80 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/icons/${item.internalName}_80.gif`;
		item.icon100 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/icons/${item.internalName}.gif`;
		item._description = repository.configuration["QPKG_SUMMARY"];
		item.fwVersion = repository.configuration["QTS_MINI_VERSION"];
		item.version = repository.configuration["QPKG_VER"];
		item.platform = { };
		item.platform.platformID = "TS-NASX86";
		item.platform.location = repository.latestRelease.assets[0].browser_download_url;
		item.publishedDate = repository.latestRelease.created_at.substring(0, 10).replace(/-/g, '/');
		item._maintainer = repository.configuration["QPKG_AUTHOR"];
		item._developer = repository.configuration["QPKG_AUTHOR"];
		item._forumLink = repository.configuration["QPKG_AUTHOR"];
		item._language = "English";
		item.snapshot = "";
		item.bannerImg = "";
		item.changeLog = "";
		item._tutorialLink = "";
		return item;
	}
};

var xml = {
	toXml: function (object, key="", pad="") {
		if (object == null || object == undefined){
			return "";
		}
		if (typeof object === 'string' || object instanceof String) {
			if (key[0]=='_') {
				let k = key.substring(1);
				return `${pad}<${k}><![CDATA[${object}]]></${k}>`;
			}
			return `${pad}<${key}>${object}</${key}>`;
		}
		if (Array.isArray(object)){
			return object.map(k => {
				return xml.toXml(k, key, pad);
			}).join(`\n`);
		}
		let result = ``;
		let childs = `\n`+Object.keys(object).map(k => {
			return xml.toXml(object[k], k, pad+" ");
		}).join(`\n`);
		
		if (key.length == 0) {
			result += `${childs}`;
		} else {
			result += `${pad}<${key}>${childs}\n${pad}</${key}>`;
		}
		return result;
	}
}

//Load configuration and proceed
fsh.read("config.json").then(e => proceed(JSON.parse(e))).catch(e => { console.log(e); });

function proceed(config) {
	httph.user = config.user;
	httph.password = config.password;

	github.getRepositoriesByTopic("qnap-store").then(e => {
		return github.filterByOwner(e, "pdulvp");
		
	}).then(repositories => {
		// compute releases
		return new Promise((resolve, reject) => {
			return Promise.all(repositories.map(r => github.releases(r))).then(e => {
				resolve(e.reduce(function (arr, row) {
					return arr.concat(row);
				}, []));
			}).catch(e => {
				reject(e);
			});
		});
		
	}).then(repositories => {
		// retrieve qpkg.cfg url
		repositories.forEach(r => {
			let config = "qpkg.cfg";
			if (CUSTOM_CONFIGS[r.name] != null) {
				config = CUSTOM_CONFIGS[r.name];
			}
			console.log(r);
			r.latestRelease = r.releases.filter(r => !r.prerelease && !r.draft)[0];
			r.configName = github.fileFromTag(r, r.latestRelease.tag_name, config);
		});
		return Promise.resolve(repositories);
		
	}).then(repositories => {
		// fetch and parse qpkg.cfg
		return new Promise((resolve, reject) => {
			return Promise.all(repositories.map(r => httph.get("raw.githubusercontent.com", r.configName).then(e => {
				r.configuration = qpkg.toJson(e);
				return Promise.resolve(r);
				
			}))).then(e => {
				resolve(e.reduce(function (arr, row) {
					return arr.concat(row);
				}, []));
				
			}).catch(e => {
				reject(e);
			});
		});
		
	}).then(repositories => {
		// retrieve qpkg.cfg url
		repositories.forEach(r => {
			r.item = qpkg.toRepoMetadata(r);
		});
		return Promise.resolve(repositories);
		
	}).then(repositories => {
		let cachechk = new Date().toISOString().replace(/-/g, '').replace(/[T\\:]/g, '').replace(/\..+/, '');
		let result = { 
			plugins : {
				cachechk: cachechk,
				item: repositories.map(r => r.item)
			}
		};
		result.plugins.item = result.plugins.item.filter(item => item != null);
		console.log(JSON.stringify(result, null, " "));
		fsh.write("repos.xml", `<?xml version="1.0" encoding="utf-8"?>\n`+xml.toXml(result));
	});
}
