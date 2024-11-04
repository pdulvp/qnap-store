const https = require('https')
var fs = require("fs");
var fsh = require("@pdulvp/fsh");
var httph = require("@pdulvp/httph");

var CUSTOM_CONFIGS = {
  "jellyfin-qnap": "packaging/qpkg.cfg",
  "jellyfin-qnap-hd": "jellyfin/qpkg.cfg",
  "plex-qnap-hd": "plex/qpkg.cfg",
  "qnap-standby": "qpkg.cfg"
}
var SNAPSHOTS = {
  "jellyfin-qnap": "https://user-images.githubusercontent.com/1305249/51093385-b520ed00-17ee-11e9-98e9-abae759a71d3.PNG"
}
var ICON_PATH = {
  "jellyfin-qnap": "packaging/icons",
  "jellyfin-qnap-hd": "jellyfin/shared/icons",
  "plex-qnap-hd": "plex/shared/icons"
}
var github = {

  getRepositoriesByTopic: function (topic) {
    return new Promise((resolve, reject) => {
      //we suppose that there is at most 3 pages of milestones
      return Promise.all([1, 2, 3].map(m => httph.get("api.github.com", '/search/repositories?q=topic:' + topic + '&sort=stars&order=desc&page=' + m))).then(e => {
        let resultPages = e.reduce(function (arr, row) {
          return arr.concat(JSON.parse(row).items);
        }, []);
        resolve(resultPages);
      }).catch(e => {
        reject(e);
      });
    });
  },

  filterByOwner: function (repositories, owner) {
    return Promise.resolve(repositories.filter(t => t.owner.login == owner));
  },

  releases: function (repository) {
    return new Promise((resolve, reject) => {
      //we suppose that there is at most 3 pages of releases
      return httph.get("api.github.com", `/repos/${repository.full_name}/releases`).then(e => {
        repository.releases = JSON.parse(e);
        return Promise.resolve(repository);
      }).then(repository => {
        Promise.all(repository.releases.map(r => httph.get("api.github.com", `/repos/${repository.full_name}/releases/${r.id}/reactions`))).then(reactions => {
          repository.releases.forEach((r, i) => {
            let reacts = JSON.parse(reactions[i] == null ? "[]" : reactions[i]);
            r.reactions = reacts.filter(r => r.user.login == "pdulvp").map(x => x.content);
          });
          return Promise.resolve(repository);
        }).then(e => {
          resolve(repository);
        })
      }).catch(e => {
        reject(e);
      });
    });
  },

  fileFromTag: function (repository, tag, file) {
    return `/${repository.full_name}/${tag}/${file}`
  }
};

const concat = (x, y) => x.concat(y)

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
  toValue: function (value) {
    return value.substring(1, value.length - 1);
  },
  toJson: function (configuration) {
    let res = configuration.split("\n");
    res = res.filter(x => x.includes("="));
    res = res.filter(x => x[0] != '#');
    let obj = {};
    res.forEach(r => obj[r.split("=")[0]] = qpkg.toValue(r.split("=")[1]));
    return obj;
  },
  toRepoMetadata: function (repository, release) {
    if (release == null) {
      return null;
    }
    let tag = release.tag_name;
    let item = {};
    let iconPath = ICON_PATH[repository.name] != null ? ICON_PATH[repository.name] : "icons";

    item.name = release.configuration["QPKG_DISPLAY_NAME"];
    item.internalName = release.configuration["QPKG_NAME"];
    item.changeLog = release.html_url;
    item.category = "pdulvp";
    item.type = "Outils";
    item.icon80 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/${iconPath}/${item.internalName}_80.gif`;
    item.icon100 = `https://raw.githubusercontent.com/${repository.full_name}/${tag}/${iconPath}/${item.internalName}.gif`;
    item._description = release.configuration["QPKG_SUMMARY"];
    item.fwVersion = release.configuration["QTS_MINI_VERSION"];
    item.version = release.name;
    item.platform = {};
    item.platform.platformID = "TS-NASX86";
    item.platform.location = release.assets[0].browser_download_url;
    item.publishedDate = release.created_at.substring(0, 10).replace(/-/g, '/');
    item._maintainer = release.configuration["QPKG_AUTHOR"];
    item._developer = release.configuration["QPKG_AUTHOR"];
    item._forumLink = "https://github.com/pdulvp";
    item._language = "English";
    item.snapshot = SNAPSHOTS[repository.name] != null ? SNAPSHOTS[repository.name] : "";
    item.bannerImg = "";
    item.changeLog = release.html_url;
    item._tutorialLink = "";
    return item;
  }
};

var xml = {
  toXml: function (object, key = "", pad = "") {
    if (object == null || object == undefined) {
      return "";
    }
    if (typeof object === 'string' || object instanceof String) {
      if (key[0] == '_') {
        let k = key.substring(1);
        return `${pad}<${k}><![CDATA[${object}]]></${k}>`;
      }
      return `${pad}<${key}>${object}</${key}>`;
    }
    if (Array.isArray(object)) {
      return object.map(k => {
        return xml.toXml(k, key, pad);
      }).join(`\n`);
    }
    let result = ``;
    let childs = `\n` + Object.keys(object).map(k => {
      return xml.toXml(object[k], k, pad + " ");
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
      r.latestRelease = r.releases.find(r => !r.prerelease && !r.draft);
      r.latestPrerelease = r.releases.find(r => r.prerelease && !r.draft && r.reactions.includes("rocket"));
      r.config = CUSTOM_CONFIGS[r.name] != null ? CUSTOM_CONFIGS[r.name] : "qpkg.cfg";
    });
    return Promise.resolve(repositories);

  }).then(repositories => {

    // fetch and parse qpkg.cfg
    return new Promise((resolve, reject) => {
      let allStables = repositories.filter(r => r.latestRelease != null).map(r => httph.get("raw.githubusercontent.com", github.fileFromTag(r, r.latestRelease.tag_name, r.config)).then(e => {
        r.latestRelease.configuration = qpkg.toJson(e);
      }));
      let allPrereleases = repositories.filter(r => r.latestPrerelease != null).map(r => httph.get("raw.githubusercontent.com", github.fileFromTag(r, r.latestPrerelease.tag_name, r.config)).then(e => {
        r.latestPrerelease.configuration = qpkg.toJson(e);
      }));
      return Promise.all([...allStables, ...allPrereleases])
        .then(e => {
          resolve(repositories);

        }).catch(e => {
          reject(e);
        });
    });

  }).then(repositories => {
    repositories.forEach(r => {
      r.item = qpkg.toRepoMetadata(r, r.latestRelease);
    });
    let repos = toRepos(repositories);
    console.log(JSON.stringify(repositories[0], null, " "));
    fsh.write("repos.xml", `<?xml version="1.0" encoding="utf-8"?>\n` + xml.toXml(repos));

    repositories.forEach(r => {
      r.item = qpkg.toRepoMetadata(r, r.latestPrerelease != null ? r.latestPrerelease : r.latestRelease);
    });
    repos = toRepos(repositories);
    fsh.write("repos-prereleases.xml", `<?xml version="1.0" encoding="utf-8"?>\n` + xml.toXml(repos));
  });
}

function toRepos(repositories) {
  let cachechk = new Date().toISOString().replace(/-/g, '').replace(/[T\\:]/g, '').replace(/\..+/, '');
  let result = {
    plugins: {
      cachechk: cachechk,
      item: repositories.map(r => r.item)
    }
  };
  result.plugins.item = result.plugins.item.filter(item => item != null);
  return result;
}