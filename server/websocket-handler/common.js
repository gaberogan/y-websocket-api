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

import debounce from 'lodash.debounce'

import http from 'http'

export const externals = {
  send: null,
}

const CALLBACK_DEBOUNCE_WAIT = parseInt(process.env.CALLBACK_DEBOUNCE_WAIT) || 2000
const CALLBACK_DEBOUNCE_MAXWAIT = parseInt(process.env.CALLBACK_DEBOUNCE_MAXWAIT) || 10000

const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'

const messageSync = 0
const messageAwareness = 1
// const messageAuth = 2

// TODO
// Think of the below code as 'connect' hook
//   ensure doc sync to db (use await all!)
// think of onMessage as 'message' hook
//   fetch doc via id (use await all!)
// think of closeConn as async 'disconnect' hook
//   ensure doc + connection are removed from db (use await all!)
// other
//   callbackWaitsForEmptyEventLoop = true should allow the doc to sync?
//   can we sync it instantly?
//   use pure functions for connect/message/disconnect
//   ensure data is interpreted as arraybuffer not blob
//   sometimes locally initial sync is slow maybe we can force it?
export const onConnect = ({ conn, docName, gc, getYDoc }) => {
  // TODO handle auth here (can throw)
  // get doc, initialize if it does not exist yet
  const doc = getYDoc(docName, gc) // TODO move getYDoc to peristence!
  doc.conns.set(conn, new Set())

  // send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  externals.send(doc, conn, encoding.toUint8Array(encoder))
  const awarenessStates = doc.awareness.getStates()
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
    externals.send(doc, conn, encoding.toUint8Array(encoder))
  }
  
  return doc
}

/**
 * Common code for handling a message from the websocket
 * @param {any} conn
 * @param {WSSharedDoc} doc
 * @param {Uint8Array} message
 */
export const onMessage = (conn, doc, message) => {
  const encoder = encoding.createEncoder()
  const decoder = decoding.createDecoder(message)
  const messageType = decoding.readVarUint(decoder)
  switch (messageType) {
  case messageSync:
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.readSyncMessage(decoder, encoder, doc, null)
    if (encoding.length(encoder) > 1) {
      externals.send(doc, conn, encoding.toUint8Array(encoder))
    }
    break
  case messageAwareness: {
    awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
    break
  }
  }
}

export const onDisconnect = ({ doc, conn, persistence }) => { // TODO pull out persistence!
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
  /**
   * @param {string} name
   */
  constructor (name) {
    super({ gc: gcEnabled })
    this.name = name
    this.mux = mutex.createMutex()
    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     * @type {Map<Object, Set<number>>}
     */
    this.conns = new Map()
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    /**
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
    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler)
    if (isCallbackSet) {
      this.on('update', debounce(
        callbackHandler,
        CALLBACK_DEBOUNCE_WAIT,
        { maxWait: CALLBACK_DEBOUNCE_MAXWAIT }
      ))
    }
  }
}

const updateHandler = (update, origin, doc) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => externals.send(doc, conn, message))
}





// used to be callback.js -------------------------------------------------

const CALLBACK_URL = process.env.CALLBACK_URL ? new URL(process.env.CALLBACK_URL) : null
const CALLBACK_TIMEOUT = process.env.CALLBACK_TIMEOUT || 5000
const CALLBACK_OBJECTS = process.env.CALLBACK_OBJECTS ? JSON.parse(process.env.CALLBACK_OBJECTS) : {}

const isCallbackSet = !!CALLBACK_URL

/**
 * @param {Uint8Array} update
 * @param {any} origin
 * @param {any} doc
 */
const callbackHandler = (update, origin, doc) => {
  const room = doc.name
  const dataToSend = {
    room: room,
    data: {}
  }
  const sharedObjectList = Object.keys(CALLBACK_OBJECTS)
  sharedObjectList.forEach(sharedObjectName => {
    const sharedObjectType = CALLBACK_OBJECTS[sharedObjectName]
    dataToSend.data[sharedObjectName] = {
      type: sharedObjectType,
      content: getContent(sharedObjectName, sharedObjectType, doc).toJSON()
    }
  })
  // @ts-ignore
  callbackRequest(CALLBACK_URL, CALLBACK_TIMEOUT, dataToSend)
}

/**
 * @param {URL} url
 * @param {number} timeout
 * @param {Object} data
 */
const callbackRequest = (url, timeout, data) => {
  data = JSON.stringify(data)
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    timeout: timeout,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  }
  var req = http.request(options)
  req.on('timeout', () => {
    console.warn('Callback request timed out.')
    req.abort()
  })
  req.on('error', (e) => {
    console.error('Callback request error.', e)
    req.abort()
  })
  req.write(data)
  req.end()
}

/**
 * @param {string} objName
 * @param {string} objType
 * @param {any} doc
 */
const getContent = (objName, objType, doc) => {
  switch (objType) {
  case 'Array': return doc.getArray(objName)
  case 'Map': return doc.getMap(objName)
  case 'Text': return doc.getText(objName)
  case 'XmlFragment': return doc.getXmlFragment(objName)
  case 'XmlElement': return doc.getXmlElement(objName)
  default : return {}
  }
}
