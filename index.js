const https = require('https');
var fs = require("fs");
var fsh = require("./fsh");
var httph = require("./httph");
var repoh = require("./repoh");

// Main entry point using async/await
(async function main() {
  try {
    // Load configuration
    const configData = await fsh.read("config.json");
    const config = JSON.parse(configData);
    httph.user = config.user;
    httph.password = config.password;

    const { stableXml, prereleaseXml } = await repoh.generateXml();

    // Write XML files
    await fsh.write("repos.xml", stableXml);
    await fsh.write("repos-prereleases.xml", prereleaseXml);

  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
