const https = require('https');
var fs = require("fs");
var fsh = require("./fsh");
var httph = require("./httph");
var githubh = require("./githubh");

var CUSTOM_CONFIGS = {
  "jellyfin-qnap": ["packaging/qpkg.cfg", "packaging-opencl/qpkg.cfg"],
  "jellyfin-qnap-hd": ["jellyfin/qpkg.cfg"],
  "plex-qnap-hd": ["plex/qpkg.cfg"],
  "qnap-standby": ["qpkg.cfg"]
};
var SNAPSHOTS = {
  "jellyfin": "https://user-images.githubusercontent.com/1305249/51093385-b520ed00-17ee-11e9-98e9-abae759a71d3.PNG"
};
var ICON_PATH = {
  "jellyfin-opencl": "packaging-opencl/icons",
  "jellyfin": "packaging/icons",
  "Jellyfin_HD": "jellyfin/shared/icons",
  "Plex_HD": "plex/shared/icons"
};
var github = {

  getRepositoriesByTopic: async function (topic) {
    // we suppose that there is at most 3 pages of repositories
    const pages = await Promise.all([1, 2, 3].map(m => 
      githubh.searchRepositoriesByTopic(topic, m)
    ));
    
    const resultPages = pages.reduce(function (arr, row) {
      return arr.concat(JSON.parse(row).items);
    }, []);
    
    return resultPages;
  },

  filterByOwner: function (repositories, owner) {
    return repositories.filter(t => t.owner.login == owner);
  },

  releases: async function (repository) {
    // we suppose that there is at most 3 pages of releases
    const data = await githubh.getReleases(repository.full_name);
    repository.releases = JSON.parse(data);
    
    const reactions = await Promise.all(
      repository.releases.map(r => 
        githubh.getReleaseReactions(repository.full_name, r.id)
      )
    );
    
    repository.releases.forEach((r, i) => {
      let reacts = JSON.parse(reactions[i] == null ? "[]" : reactions[i]);
      r.reactions = reacts.filter(r => r.user.login == "pdulvp").map(x => x.content);
      r.sname = Number(r.name.replace(/[^\d]/g, ""));
      r.sname = r.sname < 10000 ? r.sname * 100 : r.sname;
    });
    
    return repository;
  },

  fileFromTag: function (fullname, tag, file) {
    return `/${fullname}/${tag}/${file}`;
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
      item._description += "  WARNING: This is a major release; please read changelog above";
    }

    item.fwVersion = release.configuration["QTS_MINI_VERSION"];
    item.version = release.name;
    item.platform = {};
    item.platform.platformID = "TS-NASX86";
    item.platform.location = release.assets.filter(a => a.name.startsWith(`${item.internalName}_`) && !a.isArm)[0].location;
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
};

// Main entry point using async/await
(async function main() {
  try {
    // Load configuration
    const configData = await fsh.read("config.json");
    const config = JSON.parse(configData);
    httph.user = config.user;
    httph.password = config.password;
    githubh.user = config.user;
    githubh.password = config.password;

    // Get repositories by topic
    let repositories = await github.getRepositoriesByTopic("qnap-store");
    repositories = github.filterByOwner(repositories, "pdulvp");

    // Compute releases for all repositories
    repositories = await Promise.all(repositories.map(r => github.releases(r)));
    repositories = repositories.reduce(function (arr, row) {
      return arr.concat(row);
    }, []);

    // Retrieve qpkg.cfg url for each repository/config pair
    repositories = repositories.map(r => {
      return CUSTOM_CONFIGS[r.name].map(c => {
        let latestRelease = r.releases.find(a => !a.prerelease && !a.draft);
        let latestPrerelease = r.releases.find(a => a.prerelease && !a.draft && a.reactions.includes("rocket") && latestRelease && latestRelease.sname < a.sname);
        
        let toRelease = (a) => {
          return a == null ? null : {
            name: r.name,
            sname: a.sname,
            fullname: r.full_name,
            tag: a.tag_name,
            configuration: a.configuration,
            html_url: a.html_url,
            name: a.name,
            created_at: a.created_at,
            assets: a.assets.filter(asset => asset.name.endsWith(".qpkg")).map(asset => { 
              return { name: asset.name, isArm: asset.name.includes("arm64"), location: asset.browser_download_url }; 
            })
          };
        };
        
        return {
          latestRelease: toRelease(latestRelease),
          latestPrerelease: toRelease(latestPrerelease),
          config: c
        };
      });
    }).flat(1);

    // Fetch and parse qpkg.cfg files
    await Promise.all([
      ...repositories.filter(r => r.latestRelease != null).map(async r => {
        const data = await githubh.getFileFromTag(r.latestRelease.fullname, r.latestRelease.tag, r.config);
        r.latestRelease.configuration = qpkg.toJson(data);
        if (r.latestRelease.configuration["QPKG_NAME"] == null) {
          r.latestRelease = null;
        }
      }),
      ...repositories.filter(r => r.latestPrerelease != null).map(async r => {
        const data = await githubh.getFileFromTag(r.latestRelease.fullname, r.latestPrerelease.tag, r.config);
        r.latestPrerelease.configuration = qpkg.toJson(data);
        if (r.latestPrerelease.configuration["QPKG_NAME"] == null) {
          r.latestPrerelease = null;
        }
      })
    ]);

    // Log first repository for debugging
    console.log(JSON.stringify(repositories[0], null, " "));

    // Generate stable repos XML
    let items = repositories.map(r => qpkg.toRepoMetadata(r.latestRelease)).filter(r => r != null);
    let repos = toRepos(items);
    await fsh.write("repos.xml", `<?xml version="1.0" encoding="utf-8" ?>\n` + xml.toXml(repos));

    // Generate prerelease repos XML
    items = repositories.map(r => qpkg.toRepoMetadata(r.latestPrerelease != null ? r.latestPrerelease : r.latestRelease)).filter(r => r != null);
    repos = toRepos(items);
    await fsh.write("repos-prereleases.xml", `<?xml version="1.0" encoding="utf-8" ?>\n` + xml.toXml(repos));

  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();

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
