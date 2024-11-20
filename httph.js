/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/
const fs = require('fs');
const http = require('http');
const https = require('https');

//helpers for http requests
var httph = {

  request: function (host, path, object, method, user, password) {
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
        headers: {}
      };
      if (data != undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      if (user) {
        options.headers["User-Agent"] = user;
      }
      if (password) {
        options.headers["Authorization"] = "Basic " + Buffer.from(user + ":" + password).toString("base64");
      }

      var req = https.request(options, function (res) {
        let body = '';
        res.on('data', function (chunk) {
          body += chunk;
        });
        res.on('end', function () {
          result = body;

          if (result != undefined && result.message != undefined && result.message.includes("Bad credentials")) {
            reject(result);
          } else {
            resolve(result);
          }
        });

      }).on('error', function (e) {
        console.log("Got error: " + e.message);
        reject(e);
      });

      if (data != undefined) {
        req.write(data);
      }
      req.end();
    });
  },

  downloadFile: function (host, path, outputFile) {
    return new Promise((resolve, reject) => {
      var options = {
        host: host,
        port: 443,
        path: path
      };

      var file = fs.createWriteStream(outputFile);
      https.get(options, function (res) {
        res.on('data', function (data) {
          file.write(data);
        }).on('end', function () {
          file.end();
          resolve(outputFile);
        });
      }).on('error', function (e) {
        console.log("Got error: " + e.message);
        reject(e);
      });
    });
  },

  get: function (host, path) {
    return httph.request(host, path, undefined, "GET", httph.user, httph.password);
  }
};

module.exports = httph;
