import { i as writeVarUint, k as writeVarString } from '../common/encoding-7fdf95b6.js';
import { l as readVarUint, q as readVarString } from '../common/decoding-6e54b617.js';
import '../common/buffer-551584fe.js';
import '../common/process-2545f00a.js';
import '../common/map-c5ea9815.js';
import '../common/math-91bb74dc.js';
import '../common/binary-e1a1f68b.js';

const messagePermissionDenied = 0;

/**
 * @param {encoding.Encoder} encoder
 * @param {string} reason
 */
const writePermissionDenied = (encoder, reason) => {
  writeVarUint(encoder, messagePermissionDenied);
  writeVarString(encoder, reason);
};

/**
 * @callback PermissionDeniedHandler
 * @param {any} y
 * @param {string} reason
 */

/**
 *
 * @param {decoding.Decoder} decoder
 * @param {Y.Doc} y
 * @param {PermissionDeniedHandler} permissionDeniedHandler
 */
const readAuthMessage = (decoder, y, permissionDeniedHandler) => {
  switch (readVarUint(decoder)) {
    case messagePermissionDenied: permissionDeniedHandler(y, readVarString(decoder));
  }
};

export { messagePermissionDenied, readAuthMessage, writePermissionDenied };
