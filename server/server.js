import { toSyncDoc } from 'slate-yjs'
import * as Y from 'yjs'

// @ts-ignore
import syncProtocol from 'y-protocols/dist/sync.cjs'
// @ts-ignore
import awarenessProtocol from 'y-protocols/dist/awareness.cjs'

// @ts-ignore
import encoding from 'lib0/dist/encoding.cjs'
// @ts-ignore
import decoding from 'lib0/dist/decoding.cjs'

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2
const wsReadyStateClosed = 3

const messageSync = 0
const messageAwareness = 1
// const messageAuth = 2

export class WSManager {
  constructor(opts) {
    this.docs = new Map()
    this.loadDocument = opts.loadDocument
    this.pingTimeout = opts.pingTimeout ?? 30000
  }

  async setupWSConnection (
    conn,
    req,
    { docName = req.url?.slice(1).split('?')[0] || '', gc = true } = {}
  ) {
    let doc = this.docs.get(docName)

    // Doc is already loaded => connect it to the socket.
    if (doc === undefined) {
      const content = this.loadDocument(docName)
      doc = new WSSharedDoc({
        name: docName,
        manager: this,
        pingTimeout: this.pingTimeout,
      })
      toSyncDoc(doc.getArray('content'), content)
      this.docs.set(docName, doc)
    }

    doc.connectSocket(conn)
  }
}

export class WSSharedDoc extends Y.Doc {
  constructor(opts) {
    super({ gc: opts.gcEnabled ?? true, gcFilter: opts.gcFilter ?? (() => false) })
    this.conns = new Map()
    this.name = opts.name
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    this.pingTimeout = opts.pingTimeout
    this.manager = opts.manager
    this.updateHandler = this.updateHandler.bind(this)
    this.send = this.send.bind(this)
    this.closeConn = this.closeConn.bind(this)
    this.connectSocket = this.connectSocket.bind(this)
    this.messageListener = this.messageListener.bind(this)

    const awarenessChangeHandler = (
      {
        added,
        updated,
        removed,
      },
      conn
    ) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn)
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => {
            connControlledIDs.add(clientID)
          })
          removed.forEach((clientID) => {
            connControlledIDs.delete(clientID)
          })
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      )
      const buff = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => {
        this.send(c, buff)
      })
    }

    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', this.updateHandler)
  }

  updateHandler(update, origin) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const message = encoding.toUint8Array(encoder)
    this.conns.forEach((_, conn) => this.send(conn, message))
  }

  send(conn, m) {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
      this.closeConn(conn)
    }
    try {
      conn.send(m)
    } catch (e) {
      this.closeConn(conn)
    }
  }

  closeConn(conn) {
    if (this.conns.has(conn)) {
      const controlledIds = this.conns.get(conn) // TODO this is asserted
      this.conns.delete(conn)
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlledIds), null)
    }
    conn.close()
  }

  connectSocket(conn) {
    conn.binaryType = 'arraybuffer'

    this.conns.set(conn, new Set())

    // listen and reply to events
    conn.on('message', (message) => this.messageListener(conn, new Uint8Array(message)))

    conn.on('close', () => {
      this.closeConn(conn)
    })

    // Check if connection is still alive
    let pongReceived = true
    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        if (this.conns.has(conn)) {
          this.closeConn(conn)
        }
        clearInterval(pingInterval)
      } else if (this.conns.has(conn)) {
        pongReceived = false
        try {
          conn.ping()
        } catch (e) {
          this.closeConn(conn)
        }
      }
    }, this.pingTimeout)

    conn.on('pong', () => {
      pongReceived = true
    })

    // send sync step 1
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, this)
    this.send(conn, encoding.toUint8Array(encoder))
    const awarenessStates = this.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(awarenessStates.keys()))
      )
      this.send(conn, encoding.toUint8Array(encoder))
    }
  }

  messageListener(conn, message) {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
    case messageSync:
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.readSyncMessage(decoder, encoder, this, null)
      if (encoding.length(encoder) > 1) {
        this.send(conn, encoding.toUint8Array(encoder))
      }
      break
    case messageAwareness: {
      awarenessProtocol.applyAwarenessUpdate(
        this.awareness,
        decoding.readVarUint8Array(decoder),
        conn
      )
      break
    }
    }
  }
}