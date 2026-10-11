/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/
const fs = require('fs/promises');

const fsh = {

  read: async function (filename) {
    return await fs.readFile(filename, 'UTF-8');
  },

  write: async function (filename, data) {
    if (!(typeof data === 'string' || data instanceof String)) {
      data = JSON.stringify(data, null, " ");
    }
    await fs.writeFile(filename, data, 'UTF-8');
    return data;
  }
};

module.exports = fsh;
