import { r as round, k as exp10, l as log10, f as floor } from './math-91bb74dc.js';

/**
 * Utility module to convert metric values.
 *
 * @module metric
 */

const prefixUp = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const prefixDown = ['', 'm', 'μ', 'n', 'p', 'f', 'a', 'z', 'y'];

/**
 * Calculate the metric prefix for a number. Assumes E.g. `prefix(1000) = { n: 1, prefix: 'k' }`
 *
 * @param {number} n
 * @param {number} [baseMultiplier] Multiplier of the base (10^(3*baseMultiplier)). E.g. `convert(time, -3)` if time is already in milli seconds
 * @return {{n:number,prefix:string}}
 */
const prefix = (n, baseMultiplier = 0) => {
  const nPow = n === 0 ? 0 : log10(n);
  let mult = 0;
  while (nPow < mult * 3 && baseMultiplier > -8) {
    baseMultiplier--;
    mult--;
  }
  while (nPow >= 3 + mult * 3 && baseMultiplier < 8) {
    baseMultiplier++;
    mult++;
  }
  const prefix = baseMultiplier < 0 ? prefixDown[-baseMultiplier] : prefixUp[baseMultiplier];
  return {
    n: round((mult > 0 ? n / exp10(mult * 3) : n * exp10(mult * -3)) * 1e12) / 1e12,
    prefix
  }
};

/**
 * Utility module to work with time.
 *
 * @module time
 */

/**
 * Return current time.
 *
 * @return {Date}
 */
const getDate = () => new Date();

/**
 * Return current unix time.
 *
 * @return {number}
 */
const getUnixTime = Date.now;

/**
 * Transform time (in ms) to a human readable format. E.g. 1100 => 1.1s. 60s => 1min. .001 => 10μs.
 *
 * @param {number} d duration in milliseconds
 * @return {string} humanized approximation of time
 */
const humanizeDuration = d => {
  if (d < 60000) {
    const p = prefix(d, -1);
    return round(p.n * 100) / 100 + p.prefix + 's'
  }
  d = floor(d / 1000);
  const seconds = d % 60;
  const minutes = floor(d / 60) % 60;
  const hours = floor(d / 3600) % 24;
  const days = floor(d / 86400);
  if (days > 0) {
    return days + 'd' + ((hours > 0 || minutes > 30) ? ' ' + (minutes > 30 ? hours + 1 : hours) + 'h' : '')
  }
  if (hours > 0) {
    /* istanbul ignore next */
    return hours + 'h' + ((minutes > 0 || seconds > 30) ? ' ' + (seconds > 30 ? minutes + 1 : minutes) + 'min' : '')
  }
  return minutes + 'min' + (seconds > 0 ? ' ' + seconds + 's' : '')
};

export { getUnixTime as a, getDate as g, humanizeDuration as h };
