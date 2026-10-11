/** 
 This Code is published under the terms and conditions of the CC-BY-NC-ND-4.0
 (https://creativecommons.org/licenses/by-nc-nd/4.0)
 
 Please contribute to the current project.
 
 SPDX-License-Identifier: CC-BY-NC-ND-4.0
 @author: pdulvp@laposte.net
*/

const httph = require("./httph");

const API_HOST = "api.github.com";
const RAW_HOST = "raw.githubusercontent.com";

const githubh = {
  /**
   * Search repositories by topic
   * @param {string} topic - The topic to search for
   * @param {number} page - Page number
   * @returns {Promise<string>} JSON string of search results
   */
  searchRepositoriesByTopic: async function (topic, page) {
    const path = `/search/repositories?q=topic:${topic}&sort=stars&order=desc&page=${page}`;
    return httph.get(API_HOST, path);
  },

  /**
   * Get releases for a repository
   * @param {string} fullname - Repository full name (owner/repo)
   * @returns {Promise<string>} JSON string of releases
   */
  getReleases: async function (fullname) {
    return httph.get(API_HOST, `/repos/${fullname}/releases`);
  },

  /**
   * Get reactions for a release
   * @param {string} fullname - Repository full name (owner/repo)
   * @param {number} releaseId - Release ID
   * @returns {Promise<string>} JSON string of reactions
   */
  getReleaseReactions: async function (fullname, releaseId) {
    return httph.get(API_HOST, `/repos/${fullname}/releases/${releaseId}/reactions`);
  },

  /**
   * Get a file from a repository at a specific tag
   * @param {string} fullname - Repository full name (owner/repo)
   * @param {string} tag - Git tag
   * @param {string} filePath - Path to the file in the repository
   * @returns {Promise<string>} File content
   */
  getFileFromTag: async function (fullname, tag, filePath) {
    return httph.get(RAW_HOST, `/${fullname}/${tag}/${filePath}`);
  }
};

module.exports = githubh;
