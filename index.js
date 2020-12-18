const https = require('https')
var fs = require("fs");

//helpers for files manipulation
var fsquery = {
		
	write: function (filename, data) {
		return new Promise(function(resolve, reject) {
			fs.writeFile(filename, data, 'UTF-8', function(err) {
				if (err) reject(err);
				else resolve(data);
			});
		});
	},
	
	read: function(filename) {
		return new Promise(function(resolve, reject) {
			fs.readFile(filename, 'UTF-8', function(err, data){
				if (err) 
					reject(err); 
				else 
					resolve(data);
			});
		});
	}
};

//helpers for http requests
var httpq = {
	
	downloadFile : function(host, path, outputFile) {
		return new Promise((resolve, reject) => {
			var options = {
				host: host,
				port: 443,
				path: path
			};
		
			var file = fs.createWriteStream(outputFile);
			https.get(options, function(res) {
			res.on('data', function(data) {
				file.write(data);
			}).on('end', function() {
				file.end();
				resolve(outputFile);
			});
			}).on('error', function(e) {
				console.log("Got error: " + e.message);
				reject(e);
			});
		});
	},

	request: function(host, path, kind, object, method, user, password) {
		return new Promise((resolve, reject) => {
			
			var data = undefined; 
			if (object != undefined) {
				data = JSON.stringify(object);
			}
			var options = {
				host: host,
				port: 443,
				path: path,
				method: method,
				headers: { }
			};
			if (data != undefined) {
				options.headers['Content-Type'] = 'application/json';
				options.headers['Content-Length'] = Buffer.byteLength(data);
			}
			
			if (user) {
				options.headers["User-Agent"] = user;
			}
			if (password) {
				options.headers["Authorization"] = "Basic "+Buffer.from(user+":"+password).toString("base64");
			}
			
			var req = https.request(options, function(res) {
			    let body = '';
			    res.on('data', function(chunk) {
			    	body += chunk;
			    });
			    res.on('end', function() {
					//console.log(JSON.stringify(res.headers, null, " "));
					if (kind == "json") {
						result = JSON.parse(body);
					} else {
						result = body;
					}
					if (result != undefined && result.message != undefined && result.message.includes("Bad credentials")) {
						reject(result);
					} else {
						resolve(result);
					}
			    });
				
			}).on('error', function(e) {
				console.log("Got error: " + e.message);
				reject(e);
			});

			if (data != undefined) {
				req.write(data);
			}
			req.end();
		});
	},
	
	get: function(host, path) {
		return httpq.request(host, path, "json", undefined, "GET", httpq.user, httpq.password);
	},
	
	getFile: function(host, path) {
		return httpq.request(host, path, undefined, undefined, "GET", httpq.user, httpq.password);
	},
};

var github = {
	
	getRepositoriesByTopic: function(topic) {
		return new Promise((resolve, reject) => {
			//we suppose that there is at most 3 pages of milestones
			return Promise.all([1, 2, 3].map(m => httpq.get("api.github.com", '/search/repositories?q=topic:'+topic+'&sort=stars&order=desc&page='+m))).then(e => {
				let resultPages = e.reduce(function (arr, row) {
					return arr.concat(row.items);
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
	
	releases: function(repository) {https://api.github.com/repos/pdulvp/qnap-standby/releases
		return new Promise((resolve, reject) => {
			//we suppose that there is at most 3 pages of releases
			return httpq.get("api.github.com", `/repos/${repository.full_name}/releases`).then(e => {
				repository.releases = e;
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
		let tag = repository.releases[0].tag_name;
		let item = {};
		item.name = repository.configuration["QPKG_DISPLAY_NAME"];
		item.internalName = repository.configuration["QPKG_NAME"];
		item.changeLog = repository.releases[0].html_url;
		item.category = "pdulvp addon";
		item.type = "Outils de dévelopement";
		item.icon80 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/icons/${item.internalName}_80.gif`;
		item.icon100 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/icons/${item.internalName}.gif`;
		item._description = repository.configuration["QPKG_SUMMARY"];
		item.fwVersion = repository.configuration["QTS_MINI_VERSION"];
		item.version = repository.configuration["QPKG_VER"];
		item.platform = { };
		item.platform.platformID = "TS-X51";
		item.platform.location = repository.releases[0].assets[0].browser_download_url;
		item.publishedDate = repository.releases[0].created_at.substring(0, 8);
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
fsquery.read("config.json").then(e => proceed(JSON.parse(e))).catch(e => { console.log(e); });

function proceed(config) {
	httpq.user = config.user;
	httpq.password = config.password;

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
			r.configName = github.fileFromTag(r, r.releases[0].tag_name, "qpkg.cfg");
		});
		return Promise.resolve(repositories);
		
	}).then(repositories => {
		// fetch and parse qpkg.cfg
		return new Promise((resolve, reject) => {
			return Promise.all(repositories.map(r => httpq.getFile("raw.githubusercontent.com", r.configName).then(e => {
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
		let result = { 
			plugins : {
				cachechk: "2020",
				item: repositories.map(r => r.item)
			}
		};
		
		fsquery.write("repos.xml", `<?xml version="1.0" encoding="utf-8"?>\n`+xml.toXml(result));
	});

}

	