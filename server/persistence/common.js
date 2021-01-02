// // abstracted from leveldb or dynamo

// import * as Y from 'yjs'

// // @ts-ignore
// import map from 'lib0/dist/map.cjs'

// /**
//  * Gets a Y.Doc by name, whether in memory or on disk
//  *
//  * @param {string} docname - the name of the Y.Doc to find or create
//  * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
//  * @return {WSSharedDoc}
//  */
// export const getYDoc = (docname, gc = true) => map.setIfUndefined(docs, docname, () => {
//   const doc = new WSSharedDoc(docname)
//   doc.gc = gc
//   if (persistence !== null) {
//     persistence.bindState(docname, doc)
//   }
//   docs.set(docname, doc)
//   return doc
// })

// class WSSharedDoc extends Y.Doc {
//   /**
//    * @param {string} name
//    */
//   constructor (name) {
//     super({ gc: gcEnabled })
//     this.name = name
//     this.mux = mutex.createMutex()
//     /**
//      * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
//      * @type {Map<Object, Set<number>>}
//      */
//     this.conns = new Map()
//     /**
//      * @type {awarenessProtocol.Awareness}
//      */
//     this.awareness = new awarenessProtocol.Awareness(this)
//     this.awareness.setLocalState(null)
//     /**
//      * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
//      * @param {Object | null} conn Origin is the connection that made the change
//      */
//     const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
//       const changedClients = added.concat(updated, removed)
//       if (conn !== null) {
//         const connControlledIDs = /** @type {Set<number>} */ (this.conns.get(conn))
//         if (connControlledIDs !== undefined) {
//           added.forEach(clientID => { connControlledIDs.add(clientID) })
//           removed.forEach(clientID => { connControlledIDs.delete(clientID) })
//         }
//       }
//       // broadcast awareness update
//       const encoder = encoding.createEncoder()
//       encoding.writeVarUint(encoder, messageAwareness)
//       encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
//       const buff = encoding.toUint8Array(encoder)
//       this.conns.forEach((_, c) => {
//         send(this, c, buff)
//       })
//     }
//     this.awareness.on('update', awarenessChangeHandler)
//     this.on('update', updateHandler)
//     if (isCallbackSet) {
//       this.on('update', debounce(
//         callbackHandler,
//         CALLBACK_DEBOUNCE_WAIT,
//         { maxWait: CALLBACK_DEBOUNCE_MAXWAIT }
//       ))
//     }
//   }
// }// // abstracted from leveldb or dynamo

// import * as Y from 'yjs'

// // @ts-ignore
// import map from 'lib0/dist/map.cjs'

// /**
//  * Gets a Y.Doc by name, whether in memory or on disk
//  *
//  * @param {string} docname - the name of the Y.Doc to find or create
//  * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
//  * @return {WSSharedDoc}
//  */
// export const getYDoc = (docname, gc = true) => map.setIfUndefined(docs, docname, () => {
//   const doc = new WSSharedDoc(docname)
//   doc.gc = gc
//   if (persistence !== null) {
//     persistence.bindState(docname, doc)
//   }
//   docs.set(docname, doc)
//   return doc
// })

// class WSSharedDoc extends Y.Doc {
//   /**
//    * @param {string} name
//    */
//   constructor (name) {
//     super({ gc: gcEnabled })
//     this.name = name
//     this.mux = mutex.createMutex()
//     /**
//      * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
//      * @type {Map<Object, Set<number>>}
//      */
//     this.conns = new Map()
//     /**
//      * @type {awarenessProtocol.Awareness}
//      */
//     this.awareness = new awarenessProtocol.Awareness(this)
//     this.awareness.setLocalState(null)
//     /**
//      * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
//      * @param {Object | null} conn Origin is the connection that made the change
//      */
//     const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
//       const changedClients = added.concat(updated, removed)
//       if (conn !== null) {
//         const connControlledIDs = /** @type {Set<number>} */ (this.conns.get(conn))
//         if (connControlledIDs !== undefined) {
//           added.forEach(clientID => { connControlledIDs.add(clientID) })
//           removed.forEach(clientID => { connControlledIDs.delete(clientID) })
//         }
//       }
//       // broadcast awareness update
//       const encoder = encoding.createEncoder()
//       encoding.writeVarUint(encoder, messageAwareness)
//       encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
//       const buff = encoding.toUint8Array(encoder)
//       this.conns.forEach((_, c) => {
//         send(this, c, buff)
//       })
//     }
//     this.awareness.on('update', awarenessChangeHandler)
//     this.on('update', updateHandler)
//     if (isCallbackSet) {
//       this.on('update', debounce(
//         callbackHandler,
//         CALLBACK_DEBOUNCE_WAIT,
//         { maxWait: CALLBACK_DEBOUNCE_MAXWAIT }
//       ))
//     }
//   }
// }