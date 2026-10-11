/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/
const fs = require('fs/promises');

const fsh = {

  delete: async function (filename) {
    await fs.unlink(filename);
    return filename;
  },

  move: async function (oldPath, newPath) {
    await fs.rename(oldPath, newPath);
    return newPath;
  },

  write: async function (filename, data) {
    if (!(typeof data === 'string' || data instanceof String)) {
      data = JSON.stringify(data, null, " ");
    }
    await fs.writeFile(filename, data, 'UTF-8');
    return data;
  },

  writeIfChange: async function (filename, data) {
    if (!(typeof data === 'string' || data instanceof String)) {
      data = JSON.stringify(data, null, " ");
    }
    if (await fsh.fileExists(filename)) {
      const existing = await fsh.read(filename);
      if (existing !== data) {
        return fsh.write(filename, data);
      } else {
        return filename;
      }
    } else {
      return fsh.write(filename, data);
    }
  },

  read: async function (filename) {
    return await fs.readFile(filename, 'UTF-8');
  },

  fileExists: async function (filename) {
    try {
      const stats = await fs.stat(filename);
      return stats.isFile();
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      }
      return false;
    }
  }
};

module.exports = fsh;
