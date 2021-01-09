import * as Y from 'yjs'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as binary from 'lib0/binary.js'
import * as promise from 'lib0/promise.js'
// @ts-ignore
import defaultLevel from 'level'
import { Buffer } from 'buffer'
// import AWS from 'aws-sdk'

// TODO configure aws
// AWS.config.update({
//   region: 'us-east-1',
//   endpoint: 'http://localhost:8000',
// })

// var docClient = new AWS.DynamoDB.DocumentClient()

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

export const getCurrentUpdateClock = (db, docName) => db.query({
  TableName: process.env.TABLE_NAME,
  ScanIndexForward: false,
  Limit: 1,
  ProjectionExpression: 'Key',
  KeyConditionExpression: 'Key >= :gte and Key < :lt',
  ExpressionAttributeValues: {
    ':gte': createDocumentUpdateKey(docName, 0),
    ':lt': createDocumentUpdateKey(docName, binary.BITS32),
  },
}).promise().then(response => {
  if (response.Items.length === 0) {
    return -1
  } else {
    return Number(response.Items[0].Key.S.split('update').slice(-1)[0])
  }
})

/**
 * Create a unique key for a update message.
 * We encode the result using `keyEncoding` which expects an array.
 *
 * @param {string} docName
 * @param {number} clock must be unique
 * @return {string}
 */
const createDocumentUpdateKey = (docName, clock) => ['v1', docName, 'update', clock].join('')

/**
 * We have a separate state vector key so we can iterate efficiently over all documents
 * @param {string} docName
 * @return {string}
 */
const createDocumentStateVectorKey = (docName) => ['v1_sv', docName].join('')

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
  await db.putItem({
    TableName: process.env.TABLE_NAME,
    Item: {
      PartitionKey: {
        S: docName,
      },
      Key: {
        S: createDocumentStateVectorKey(docName),
      },
      Value: {
        B: Buffer.from(encoding.toUint8Array(encoder)),
      },
    },
  }).promise()
}

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} update
 * @return {Promise<number>} Returns the clock of the stored update
 */
const storeUpdate = async (db, docName, update) => {
  // NOTE this means writes are 3 round trips to dynamodb (45ms?)
  const clock = await getCurrentUpdateClock(db, docName)
  if (clock === -1) {
    // make sure that a state vector is aways written, so we can search for available documents
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, update)
    const sv = Y.encodeStateVector(ydoc)
    await writeStateVector(db, docName, sv, 0)
  }
  await db.putItem({
    TableName: process.env.TABLE_NAME,
    Item: {
      PartitionKey: {
        S: docName,
      },
      Key: {
        S: createDocumentUpdateKey(docName, clock + 1),
      },
      Value: {
        B: Buffer.from(update),
      },
    },
  }).promise()
  return clock + 1
}

export class DynamoDBPersistence {
  /**
   * @param {string} location
   * @param {object} [opts]
   * @param {any} [opts.level] Level-compatible adapter. E.g. leveldown, level-rem, level-indexeddb, Defaults to `level`
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
   * @return {Promise<Y.Doc>}
   */
  getYDoc (docName) {
    return this._transact(async db => {
      const { Items } = await db.query({
        TableName: process.env.TABLE_NAME,
        ProjectionExpression: 'Value',
        KeyConditionExpression: 'Key >= :gte and Key < :lt',
        ExpressionAttributeValues: {
          ':gte': createDocumentUpdateKey(docName, 0),
          ':lt': createDocumentUpdateKey(docName, binary.BITS32),
        },
      }).promise()
      const ydoc = new Y.Doc()
      ydoc.transact(() => {
        for (let i = 0; i < Items.length; i++) {
          Y.applyUpdate(ydoc, Items[i].map(item => item.Value.B)) // TODO make sure this is a uint8array
        }
      })
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
}

const dynamoPeristence = new DynamoDBPersistence('TODOremove')

const bindState = async (docName, ydoc) => {
  const persistedYdoc = await dynamoPeristence.getYDoc(docName)
  const newUpdates = Y.encodeStateAsUpdate(ydoc)
  dynamoPeristence.storeUpdate(docName, newUpdates)
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
  ydoc.on('update', update => {
    dynamoPeristence.storeUpdate(docName, update)
  })
}

export const persistence = {
  bindState,
  writeState: async (docName, ydoc) => {} // eslint-disable-line
}