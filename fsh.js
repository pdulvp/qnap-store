/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/
const fs = require('fs');

var fsh = {
  
    delete: function (filename) {
      return new Promise(function(resolve, reject) {
          fs.unlink(filename, function(err) {
              resolve(filename);
          });
      });
    },
  
    move: function (oldPath, newPath) {
      return new Promise(function(resolve, reject) {
          fs.rename(oldPath, newPath, function (err) {
              if (err) reject(err);
              else resolve(newPath);
          });
      });
    },
  
    write: function (filename, data) {
        return new Promise(function(resolve, reject) {
            if (!(typeof data === 'string' || data instanceof String)) {
                data = JSON.stringify(data, null, " ");
            }
            fs.writeFile(filename, data, 'UTF-8', function(err) {
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
    
    writeIfChange: function (filename, data) {
        if (!(typeof data === 'string' || data instanceof String)) {
            data = JSON.stringify(data, null, " ");
        }
        if (fsh.fileExists(filename)) {
            return fsh.read(filename).then(e => {
                if (e != data) {
                    return fsh.write(filename, data);
                } else {
                    return Promise.resolve(filename);
                }
            })
        } else {
            return fsh.write(filename, data);
        }
    },

    read: function(filename) {
        return new Promise(function(resolve, reject) {
            fs.readFile(filename, 'UTF-8', function(err, data){
                if (err) {
                    reject(err); 
                }
                else 
                    resolve(data);
            });
        });
    },
  
    fileExists: function(filename) {
        try
        {
            return fs.statSync(filename).isFile();
        }
        catch (err)
        {
            if (err.code == 'ENOENT') { // no such file or directory. File really does not exist
                console.log("File does not exist.");
                return false;
            }
            //console.log("Exception fs.statSync (" + path + "): " + err);
            return false; // something else went wrong, we don't have rights, ...
        }
    }	
  
  };

  module.exports = fsh;
