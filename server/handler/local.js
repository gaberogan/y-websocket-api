import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as Y from 'yjs'

// @ts-ignore
import { externals, onDisconnect, onConnect, onMessage } from './common.js'

import { LeveldbPersistence } from 'y-leveldb'
import WebSocket from 'ws'
import http from 'http'

const wss = new WebSocket.Server({ noServer: true })
const port = process.env.PORT || 9000
const pingTimeout = 30000

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

wss.on('connection', (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'

  const doc = onConnect({ conn, docName, gc })

  // listen and reply to events
  conn.on('message', /** @param {ArrayBuffer} message */ message => onMessage(conn, doc, new Uint8Array(message)))

  // Check if connection is still alive
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        onDisconnect({ doc, conn })
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        onDisconnect({ doc, conn })
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)
  conn.on('close', () => {
    onDisconnect({ doc, conn })
    clearInterval(pingInterval)
  })
  conn.on('pong', () => {
    pongReceived = true
  })
})

server.on('upgrade', (request, socket, head) => {
  // You may check auth of request here..
  /**
   * @param {any} ws
   */
  const handleAuth = ws => {
    wss.emit('connection', ws, request)
  }
  wss.handleUpgrade(request, socket, head, handleAuth)
})

server.listen(port)

console.log('running on port', port)


// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// disable gc when using snapshots!
const persistenceDir = `${__dirname}/dbDir`
/**
 * @type {{bindState: function(string, import('./common').WSSharedDoc):void,
 * writeState:function(string, import('./common').WSSharedDoc):Promise<any>, provider: any}|null}
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

externals.persistence = persistence

/**
 * @param {import('./common').WSSharedDoc} doc
 * @param {any} conn
 * @param {Uint8Array} m
 */
const send = (doc, conn, m) => {
  // not connecting (0) or open (1)
  if (conn.readyState !== 0 && conn.readyState !== 1) {
    onDisconnect({ doc, conn })
  }
  try {
    conn.send(m, /** @param {any} err */ err => { err != null && onDisconnect({ doc, conn }) })
  } catch (e) {
    onDisconnect({ doc, conn })
  }
}

externals.send = send
