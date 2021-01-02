import * as Y from 'yjs'
// @ts-ignore
import map from 'lib0/dist/map.cjs'

// @ts-ignore
import { externals, WSSharedDoc, onDisconnect, onConnect, onMessage } from './common.js'

import { LeveldbPersistence } from 'y-leveldb'

// disable gc when using snapshots!
const persistenceDir = `${__dirname}/dbDir`
/**
 * @type {{bindState: function(string,WSSharedDoc):void, writeState:function(string,WSSharedDoc):Promise<any>, provider: any}|null}
 */
let persistence = null
if (typeof persistenceDir === 'string') {
  console.info('Persisting documents to "' + persistenceDir + '"')
  const ldb = new LeveldbPersistence(persistenceDir)
  persistence = {
    provider: ldb,
    bindState: async (docName, ydoc) => {
      const persistedYdoc = await ldb.getYDoc(docName)
      const newUpdates = Y.encodeStateAsUpdate(ydoc)
      ldb.storeUpdate(docName, newUpdates)
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
      ydoc.on('update', update => {
        ldb.storeUpdate(docName, update)
      })
    },
    writeState: async (docName, ydoc) => {} // eslint-disable-line
  }
}

/**
 * @param {{bindState: function(string,WSSharedDoc):void,
 * writeState:function(string,WSSharedDoc):Promise<any>,provider:any}|null} persistence_
 */
export const setPersistence = persistence_ => {
  persistence = persistence_
}

/**
 * @return {null|{bindState: function(string,WSSharedDoc):void,
  * writeState:function(string,WSSharedDoc):Promise<any>}|null} used persistence layer
  */
export const getPersistence = () => persistence

/**
 * @type {Map<string,WSSharedDoc>}
 */
export const docs = new Map()

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param {string} docname - the name of the Y.Doc to find or create
 * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
 * @return {WSSharedDoc}
 */
export const getYDoc = (docname, gc = true) => map.setIfUndefined(docs, docname, () => {
  const doc = new WSSharedDoc(docname)
  doc.gc = gc
  if (persistence !== null) {
    persistence.bindState(docname, doc)
  }
  docs.set(docname, doc)
  return doc
})

/**
 * @param {WSSharedDoc} doc
 * @param {any} conn
 * @param {Uint8Array} m
 */
const send = (doc, conn, m) => {
  // not connecting (0) or open (1)
  if (conn.readyState !== 0 && conn.readyState !== 1) {
    onDisconnect({ doc, conn, persistence, docs })
  }
  try {
    conn.send(m, /** @param {any} err */ err => { err != null && onDisconnect({ doc, conn, persistence, docs }) })
  } catch (e) {
    onDisconnect({ doc, conn, persistence, docs })
  }
}

externals.send = send

const pingTimeout = 30000

/**
 * @param {any} conn
 * @param {any} req
 * @param {any} opts
 */
export const setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'

  const doc = onConnect({ conn, docName, gc, getYDoc })

  // listen and reply to events
  conn.on('message', /** @param {ArrayBuffer} message */ message => onMessage(conn, doc, new Uint8Array(message)))

  // Check if connection is still alive
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        onDisconnect({ doc, conn, persistence, docs })
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        onDisconnect({ doc, conn, persistence, docs })
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)
  conn.on('close', () => {
    onDisconnect({ doc, conn, persistence, docs })
    clearInterval(pingInterval)
  })
  conn.on('pong', () => {
    pongReceived = true
  })
}
