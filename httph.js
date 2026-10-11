/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/

// helpers for http GET requests using modern fetch API (Node 18+)

const httph = {
  user: null,
  password: null,

  /**
   * Perform a GET request to a host and path
   * @param {string} host - The host (e.g., "api.github.com")
   * @param {string} path - The path (e.g., "/repos/owner/repo")
   * @returns {Promise<string>} The response body as text
   */
  get: async function (host, path) {
    const url = `https://${host}${path}`;
    
    const headers = {};
    
    if (httph.user) {
      headers["User-Agent"] = httph.user;
    }
    if (httph.password) {
      headers["Authorization"] = "Basic " + Buffer.from(httph.user + ":" + httph.password).toString("base64");
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const result = await response.text();
      if (result != undefined && result.message != undefined && result.message.includes("Bad credentials")) {
        throw new Error(result);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
  }
};

module.exports = httph;
