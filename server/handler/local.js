import { externals, onDisconnect, onConnect, onMessage } from './common.js'
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

  // ping for heartbeat and handle disconnect
  heartbeat(doc, conn)
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


const heartbeat = (doc, conn) => {
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
}
