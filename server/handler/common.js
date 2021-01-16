// abstracted from aws or native websockets

import * as Y from 'yjs'
// @ts-ignore
import syncProtocol from 'y-protocols/dist/sync.cjs'
// @ts-ignore
import awarenessProtocol from 'y-protocols/dist/awareness.cjs'
// @ts-ignore
import encoding from 'lib0/dist/encoding.cjs'
// @ts-ignore
import decoding from 'lib0/dist/decoding.cjs'
// @ts-ignore
import mutex from 'lib0/dist/mutex.cjs'
import { persistence } from '../db/local.js'

export const externals = {
  send: null,
}

const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'

const messageSync = 0
const messageAwareness = 1

// NOTE
// 1. callbackWaitsForEmptyEventLoop = true should allow the doc to sync?
// 2. can we sync it instantly?
// 3. use pure functions for connect/message/disconnect
// 4. ensure data is interpreted as arraybuffer not blob
// 5. sometimes locally initial sync is slow maybe we can force it?

export const onConnect = ({ conn, doc }) => {
  // send sync step 1, initiating connection?
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  externals.send(doc, conn, encoding.toUint8Array(encoder))
  const awarenessStates = doc.awareness.getStates()
  // on connect send awareness from other users (will be different with AWS because this needed to be stateful)
  // we probably don't want to persist awareness since we can send updates client side every couple seconds or something
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
    externals.send(doc, conn, encoding.toUint8Array(encoder))
  }
  
  return doc
}

export const onMessage = (conn, doc, message) => {
  const encoder = encoding.createEncoder()
  const decoder = decoding.createDecoder(message)
  const messageType = decoding.readVarUint(decoder)
  switch (messageType) {
  // Case sync1: Read SyncStep1 message and reply with SyncStep2 (write input to output and format as syncstep2 to all clientsf)
  // Case sync2 or yjsUpdate: Read and apply Structs and then DeleteStore to a y instance (append to db)
  case messageSync:
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.readSyncMessage(decoder, encoder, doc, null)
    if (encoding.length(encoder) > 1) {
      externals.send(doc, conn, encoding.toUint8Array(encoder))
    }
    break
  // Client sent its awareness state. Store locally and emit to allow broadcast to fire
  // Seems like deletions aren't transmitted, just assumed if the client didn't get an update in the past X mins
  // Seems like we can just broadcast each update and not worry about storing it.
  case messageAwareness: {
    awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
    break
  }
  }
}

// Cleanup (+ tell others we disconnected via awareness)
export const onDisconnect = ({ doc, conn }) => {
  if (doc.conns.has(conn)) {
    /**
     * @type {Set<number>}
     */
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0 && persistence !== null) {
      // if persisted, we store state and destroy ydocument
      persistence.writeState(doc.name, doc).then(() => {
        doc.destroy()
      })
    }
  }
  conn.close()
}

export class WSSharedDoc extends Y.Doc {
  constructor (name) {
    super({ gc: gcEnabled })
    this.name = name
    this.mux = mutex.createMutex()
    this.conns = new Map()
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
  
    /**
     * On receiving awareness change, broadcast list of stringified states of changed clients
     * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
     * @param {Object | null} conn Origin is the connection that made the change
     */
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = /** @type {Set<number>} */ (this.conns.get(conn))
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => { connControlledIDs.add(clientID) })
          removed.forEach(clientID => { connControlledIDs.delete(clientID) })
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => {
        externals.send(this, c, buff)
      })
    }
  
    // Setup listeners for awareness change and doc update that send state to client (no persistence logic)
    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler)
  }
}

// Encode update arg and send it to all clients
const updateHandler = (update, origin, doc) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => externals.send(doc, conn, message))
}
