const https = require('https')
var fs = require("fs");
var fsh = require("./fsh");
var httph = require("./httph");

var CUSTOM_CONFIGS = {
  "jellyfin-qnap": ["packaging/qpkg.cfg", "packaging-opencl/qpkg.cfg"],
  "jellyfin-qnap-hd": ["jellyfin/qpkg.cfg"],
  "plex-qnap-hd": ["plex/qpkg.cfg"],
  "qnap-standby": ["qpkg.cfg"]
}
var SNAPSHOTS = {
  "jellyfin": "https://user-images.githubusercontent.com/1305249/51093385-b520ed00-17ee-11e9-98e9-abae759a71d3.PNG"
}
var ICON_PATH = {
  "jellyfin-opencl": "packaging-opencl/icons",
  "jellyfin": "packaging/icons",
  "Jellyfin_HD": "jellyfin/shared/icons",
  "Plex_HD": "plex/shared/icons"
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
            r.sname = Number(r.name.replace(/[^\d]/g, ""))
            r.sname = r.sname < 10000 ? r.sname * 100 : r.sname
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

  fileFromTag: function (fullname, tag, file) {
    return `/${fullname}/${tag}/${file}`
  }
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
  toRepoMetadata: function (release) {
    if (release == null) {
      return null;
    }

    let tag = release.tag;
    let item = {};
    let iconPath = ICON_PATH[release.configuration["QPKG_NAME"]] != null ? ICON_PATH[release.configuration["QPKG_NAME"]] : "icons";

    item.name = release.configuration["QPKG_DISPLAY_NAME"];
    item.internalName = release.configuration["QPKG_NAME"];
    item.changeLog = release.html_url;
    item.category = "pdulvp";
    item.type = "Outils";
    item.icon80 = `https://raw.githubusercontent.com/${release.fullname}/${tag}/${iconPath}/${item.internalName}_80.gif`;
    item.icon100 = `https://raw.githubusercontent.com/${release.fullname}/${tag}/${iconPath}/${item.internalName}.gif`;
    item._description = release.configuration["QPKG_SUMMARY"];

    if (item.name == "jellyfin") {
      item._description += "  WARNING: This is a major release; please read changelog above"
    }

    item.fwVersion = release.configuration["QTS_MINI_VERSION"];
    item.version = release.name;
    item.platform = {};
    item.platform.platformID = "TS-NASX86";
    item.platform.location = release.downloadUrl;
    item.publishedDate = release.created_at.substring(0, 10).replace(/-/g, '/');
    item._maintainer = release.configuration["QPKG_AUTHOR"];
    item._developer = release.configuration["QPKG_AUTHOR"];
    item._forumLink = "https://github.com/pdulvp";
    item._language = "English";
    item.snapshot = SNAPSHOTS[release.configuration["QPKG_NAME"]] != null ? SNAPSHOTS[release.configuration["QPKG_NAME"]] : "";
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
    repositories = repositories.map(r => {
      return CUSTOM_CONFIGS[r.name].map(c => {
        let latestRelease = r.releases.filter(a => !a.prerelease && !a.draft).map(a => {
          return {
            name: r.name,
            sname: a.sname,
            fullname: r.full_name,
            tag: a.tag_name,
            configuration: a.configuration,
            html_url: a.html_url,
            name: a.name,
            created_at: a.created_at,
            downloadUrl: a.assets[0].browser_download_url
          }
        }).find(a => true)
        let latestPrerelease = r.releases.filter(a => a.prerelease && !a.draft && a.reactions.includes("rocket") && latestRelease.sname < a.sname).map(a => {
          return {
            name: r.name,
            sname: a.sname,
            fullname: r.full_name,
            tag: a.tag_name,
            configuration: a.configuration,
            html_url: a.html_url,
            name: a.name,
            created_at: a.created_at,
            downloadUrl: a.assets[0].browser_download_url
          }
        }).find(a => true);
        return {
          latestRelease: latestRelease,
          latestPrerelease: latestPrerelease,
          config: c,
        };
      })
    }).flat(1);
    return Promise.resolve(repositories);

  }).then(repositories => {

    // fetch and parse qpkg.cfg
    return new Promise((resolve, reject) => {
      let allStables = repositories.filter(r => r.latestRelease != null).map(r => httph.get("raw.githubusercontent.com", github.fileFromTag(r.latestRelease.fullname, r.latestRelease.tag, r.config)).then(e => {
        r.latestRelease.configuration = qpkg.toJson(e);
        if (r.latestRelease.configuration["QPKG_NAME"] == null) {
          r.latestRelease = null;
        }
      }));
      let allPrereleases = repositories.filter(r => r.latestPrerelease != null).map(r => httph.get("raw.githubusercontent.com", github.fileFromTag(r.latestRelease.fullname, r.latestPrerelease.tag, r.config)).then(e => {
        r.latestPrerelease.configuration = qpkg.toJson(e);
        if (r.latestPrerelease.configuration["QPKG_NAME"] == null) {
          r.latestPrerelease = null;
        }
      }));
      return Promise.all([...allStables, ...allPrereleases])
        .then(e => {
          resolve(repositories);

        }).catch(e => {
          reject(e);
        });
    });

  }).then(repositories => {
    console.log(JSON.stringify(repositories[0], null, " "));

    let items = repositories.map(r => {
      return qpkg.toRepoMetadata(r.latestRelease);
    }).filter(r => r != null);
    let repos = toRepos(items);
    fsh.write("repos.xml", `<? xml version = "1.0" encoding = "utf-8" ?>\n` + xml.toXml(repos));

    items = repositories.map(r => {
      return qpkg.toRepoMetadata(r.latestPrerelease != null ? r.latestPrerelease : r.latestRelease);
    }).filter(r => r != null);
    repos = toRepos(items);
    fsh.write("repos-prereleases.xml", `<? xml version = "1.0" encoding = "utf-8" ?>\n` + xml.toXml(repos));
  });
}

function toRepos(items) {
  let cachechk = new Date().toISOString().replace(/-/g, '').replace(/[T\\:]/g, '').replace(/\..+/, '');
  let result = {
    plugins: {
      cachechk: cachechk,
      item: items
    }
  };
  result.plugins.item = result.plugins.item.filter(item => item != null);
  result.plugins.item.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}