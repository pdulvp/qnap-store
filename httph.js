/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/

// helpers for http requests using modern fetch API (Node 18+)
const httph = {
  user: null,
  password: null,

  request: async function (host, path, object, method, user, password) {
    const url = `https://${host}${path}`;
    
    const headers = {};
    let body = undefined;
    
    if (object !== undefined) {
      body = JSON.stringify(object);
      headers['Content-Type'] = 'application/json';
    }

    if (user) {
      headers["User-Agent"] = user;
    }
    if (password) {
      headers["Authorization"] = "Basic " + Buffer.from(user + ":" + password).toString("base64");
    }

    const options = {
      method: method || 'GET',
      headers: headers
    };
    
    if (body !== undefined) {
      options.body = body;
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const result = await response.text();
      if (result != undefined && result.message != undefined && result.message.includes("Bad credentials")) {
        throw new Error(result);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
  },

  downloadFile: async function (host, path, outputFile) {
    const fs = require('fs/promises');
    const url = `https://${host}${path}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.arrayBuffer();
    await fs.writeFile(outputFile, Buffer.from(data));
    return outputFile;
  },

  get: async function (host, path) {
    return httph.request(host, path, undefined, "GET", httph.user, httph.password);
  }
};

module.exports = httph;
