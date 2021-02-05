import { m as map } from '../common/object-034d355c.js';

/**
 * Utility module to work with urls.
 *
 * @module url
 */

/**
 * Parse query parameters from an url.
 *
 * @param {string} url
 * @return {Object<string,string>}
 */
const decodeQueryParams = url => {
  /**
   * @type {Object<string,string>}
   */
  const query = {};
  const urlQuerySplit = url.split('?');
  const pairs = urlQuerySplit[urlQuerySplit.length - 1].split('&');
  for (var i = 0; i < pairs.length; i++) {
    const item = pairs[i];
    if (item.length > 0) {
      const pair = item.split('=');
      query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
  }
  return query
};

/**
 * @param {Object<string,string>} params
 * @return {string}
 */
const encodeQueryParams = params =>
  map(params, (val, key) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join('&');

export { decodeQueryParams, encodeQueryParams };
