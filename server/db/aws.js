import * as Y from 'yjs'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as binary from 'lib0/binary.js'
import * as promise from 'lib0/promise.js'
// @ts-ignore
import defaultLevel from 'level'
import { Buffer } from 'buffer'

export const PREFERRED_TRIM_SIZE = 500

const YEncodingString = 0
const YEncodingUint32 = 1

const valueEncoding = {
  buffer: true,
  type: 'y-value',
  encode: /** @param {any} data */ data => data,
  decode: /** @param {any} data */ data => data
}

/**
 * Write two bytes as an unsigned integer in big endian order.
 * (most significant byte first)
 *
 * @function
 * @param {encoding.Encoder} encoder
 * @param {number} num The number that is to be encoded.
 */
export const writeUint32BigEndian = (encoder, num) => {
  for (let i = 3; i >= 0; i--) {
    encoding.write(encoder, (num >>> (8 * i)) & binary.BITS8)
  }
}

/**
 * Read 4 bytes as unsigned integer in big endian order.
 * (most significant byte first)
 *
 * @todo use lib0/decoding instead
 *
 * @function
 * @param {decoding.Decoder} decoder
 * @return {number} An unsigned integer.
 */
export const readUint32BigEndian = decoder => {
  const uint =
    (decoder.arr[decoder.pos + 3] +
    (decoder.arr[decoder.pos + 2] << 8) +
    (decoder.arr[decoder.pos + 1] << 16) +
    (decoder.arr[decoder.pos] << 24)) >>> 0
  decoder.pos += 4
  return uint
}

export const keyEncoding = {
  buffer: true,
  type: 'y-keys',
  /* istanbul ignore next */
  encode: /** @param {Array<string|number>} arr */  arr => {
    const encoder = encoding.createEncoder()
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      if (typeof v === 'string') {
        encoding.writeUint8(encoder, YEncodingString)
        encoding.writeVarString(encoder, v)
      } else /* istanbul ignore else */ if (typeof v === 'number') {
        encoding.writeUint8(encoder, YEncodingUint32)
        writeUint32BigEndian(encoder, v)
      } else {
        throw new Error('Unexpected key value')
      }
    }
    return Buffer.from(encoding.toUint8Array(encoder))
  },
  decode: /** @param {Uint8Array} buf */ buf => {
    const decoder = decoding.createDecoder(buf)
    const key = []
    while (decoding.hasContent(decoder)) {
      switch (decoding.readUint8(decoder)) {
      case YEncodingString:
        key.push(decoding.readVarString(decoder))
        break
      case YEncodingUint32:
        key.push(readUint32BigEndian(decoder))
        break
      }
    }
    return key
  }
}

/**
 * Level expects a Buffer, but in Yjs we typically work with Uint8Arrays.
 *
 * Since Level thinks that these are two entirely different things,
 * we transform the Uint8array to a Buffer before storing it.
 *
 * @param {any} db
 * @param {any} key
 * @param {Uint8Array} val
 */
const levelPut = async (db, key, val) => db.put(key, Buffer.from(val))

/**
 * A "bulkier" implementation of level streams. Returns the result in one flush.
 *
 * @param {any} db
 * @param {object} opts
 * @return {Promise<Array<any>>}
 */
export const getLevelBulkData = (db, opts) => promise.create((resolve, reject) => {
  /**
   * @type {Array<any>} result
   */
  const result = []
  db.createReadStream(
    opts
  ).on('data', /** @param {any} data */ data =>
    result.push(data)
  ).on('end', () =>
    resolve(result)
  ).on('error', reject)
})

/**
 * Get all document updates for a specific document.
 *
 * @param {any} db
 * @param {string} docName
 * @param {any} [opts]
 * @return {Promise<Array<Buffer>>}
 */
export const getLevelUpdates = (db, docName, opts = { values: true, keys: false }) => getLevelBulkData(db, {
  gte: createDocumentUpdateKey(docName, 0),
  lt: createDocumentUpdateKey(docName, binary.BITS32),
  ...opts
})

/**
 * @param {any} db
 * @param {string} docName
 * @return {Promise<number>} Returns -1 if this document doesn't exist yet
 */
export const getCurrentUpdateClock = (db, docName) => getLevelUpdates(db, docName, { keys: true, values: false, reverse: true, limit: 1 }).then(keys => {
  if (keys.length === 0) {
    return -1
  } else {
    return keys[0][3]
  }
})

/**
 * @param {any} db
 * @param {Array<string|number>} gte Greater than or equal
 * @param {Array<string|number>} lt lower than (not equal)
 * @return {Promise<void>}
 */
const clearRange = async (db, gte, lt) => {
  /* istanbul ignore else */
  if (db.supports.clear) {
    await db.clear({ gte, lt })
  } else {
    const keys = await getLevelBulkData(db, { values: false, keys: true, gte, lt })
    const ops = keys.map(key => ({ type: 'del', key }))
    await db.batch(ops)
  }
}

/**
 * @param {any} db
 * @param {string} docName
 * @param {number} from Greater than or equal
 * @param {number} to lower than (not equal)
 * @return {Promise<void>}
 */
const clearUpdatesRange = async (db, docName, from, to) => clearRange(db, createDocumentUpdateKey(docName, from), createDocumentUpdateKey(docName, to))

/**
 * Create a unique key for a update message.
 * We encode the result using `keyEncoding` which expects an array.
 *
 * @param {string} docName
 * @param {number} clock must be unique
 * @return {Array<string|number>}
 */
const createDocumentUpdateKey = (docName, clock) => ['v1', docName, 'update', clock]

/**
 * We have a separate state vector key so we can iterate efficiently over all documents
 * @param {string} docName
 */
const createDocumentStateVectorKey = (docName) => ['v1_sv', docName]

// const emptyStateVector = (() => Y.encodeStateVector(new Y.Doc()))()

/**
 * For now this is a helper method that creates a Y.Doc and then re-encodes a document update.
 * In the future this will be handled by Yjs without creating a Y.Doc (constant memory consumption).
 *
 * @param {Array<Uint8Array>} updates
 * @return {{update:Uint8Array, sv: Uint8Array}}
 */
const mergeUpdates = (updates) => {
  const ydoc = new Y.Doc()
  ydoc.transact(() => {
    for (let i = 0; i < updates.length; i++) {
      Y.applyUpdate(ydoc, updates[i])
    }
  })
  return { update: Y.encodeStateAsUpdate(ydoc), sv: Y.encodeStateVector(ydoc) }
}

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} sv state vector
 * @param {number} clock current clock of the document so we can determine when this statevector was created
 */
const writeStateVector = async (db, docName, sv, clock) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, clock)
  encoding.writeVarUint8Array(encoder, sv)
  await levelPut(db, createDocumentStateVectorKey(docName), encoding.toUint8Array(encoder))
}

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} stateAsUpdate
 * @param {Uint8Array} stateVector
 * @return {Promise<number>} returns the clock of the flushed doc
 */
const flushDocument = async (db, docName, stateAsUpdate, stateVector) => {
  const clock = await storeUpdate(db, docName, stateAsUpdate)
  await writeStateVector(db, docName, stateVector, clock)
  await clearUpdatesRange(db, docName, 0, clock) // intentionally not waiting for the promise to resolve!
  return clock
}

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} update
 * @return {Promise<number>} Returns the clock of the stored update
 */
const storeUpdate = async (db, docName, update) => {
  const clock = await getCurrentUpdateClock(db, docName)
  if (clock === -1) {
    // make sure that a state vector is aways written, so we can search for available documents
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, update)
    const sv = Y.encodeStateVector(ydoc)
    await writeStateVector(db, docName, sv, 0)
  }
  await levelPut(db, createDocumentUpdateKey(docName, clock + 1), update)
  return clock + 1
}

export class DynamoDBPersistence {
  /**
   * @param {string} location
   * @param {object} [opts]
   * @param {any} [opts.level] Level-compatible adapter. E.g. leveldown, level-rem, level-indexeddb. Defaults to `level`
   * @param {object} [opts.levelOptions] Options that are passed down to the level instance
   */
  constructor (location, /* istanbul ignore next */ { level = defaultLevel, levelOptions = {} } = {}) {
    const db = level(location, { ...levelOptions, valueEncoding, keyEncoding })
    this.tr = promise.resolve()
    /**
     * Execute an transaction on a database. This will ensure that other processes are currently not writing.
     *
     * This is a private method and might change in the future.
     *
     * @todo only transact on the same room-name. Allow for concurrency of different rooms.
     *
     * @template T
     *
     * @param {function(any):Promise<T>} f A transaction that receives the db object
     * @return {Promise<T>}
     */
    this._transact = f => {
      const currTr = this.tr
      this.tr = (async () => {
        await currTr
        let res = /** @type {any} */ (null)
        try {
          res = await f(db)
        } catch (err) {
          /* istanbul ignore next */
          console.warn('Error during y-leveldb transaction', err)
        }
        return res
      })()
      return this.tr
    }
  }

  /**
   * @param {string} docName
   */
  flushDocument (docName) {
    return this._transact(async db => {
      const updates = await getLevelUpdates(db, docName)
      const { update, sv } = mergeUpdates(updates)
      await flushDocument(db, docName, update, sv)
    })
  }

  /**
   * @param {string} docName
   * @return {Promise<Y.Doc>}
   */
  getYDoc (docName) {
    return this._transact(async db => {
      const updates = await getLevelUpdates(db, docName)
      const ydoc = new Y.Doc()
      ydoc.transact(() => {
        for (let i = 0; i < updates.length; i++) {
          Y.applyUpdate(ydoc, updates[i])
        }
      })
      if (updates.length > PREFERRED_TRIM_SIZE) {
        await flushDocument(db, docName, Y.encodeStateAsUpdate(ydoc), Y.encodeStateVector(ydoc))
      }
      return ydoc
    })
  }

  /**
   * @param {string} docName
   * @param {Uint8Array} update
   * @return {Promise<number>} Returns the clock of the stored update
   */
  storeUpdate (docName, update) {
    return this._transact(db => storeUpdate(db, docName, update))
  }

  /**
   * Close connection to a leveldb database and discard all state and bindings
   *
   * @return {Promise<void>}
   */
  destroy () {
    return this._transact(db => db.close())
  }

  /**
   * Delete all data in database.
   */
  clearAll () {
    return this._transact(async db => db.clear())
  }
}

const ldb = new DynamoDBPersistence('TODOremove')

const bindState = async (docName, ydoc) => {
  const persistedYdoc = await ldb.getYDoc(docName)
  const newUpdates = Y.encodeStateAsUpdate(ydoc)
  ldb.storeUpdate(docName, newUpdates)
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
  ydoc.on('update', update => {
    ldb.storeUpdate(docName, update)
  })
}

export const persistence = {
  bindState,
  writeState: async (docName, ydoc) => {} // eslint-disable-line
}