// @ts-ignore
import syncProtocol from 'y-protocols/dist/sync.cjs'
// @ts-ignore
import encoding from 'lib0/dist/encoding.cjs'
// @ts-ignore
import decoding from 'lib0/dist/decoding.cjs'
import { addConnection, getConnectionIds, removeConnection, getOrCreateDoc, updateDoc } from '../db/aws.js'
import ws from 'aws-lambda-ws-server'

const messageSync = 0
const messageAwareness = 1

const getDocName = (event) => {
  const qs = event.multiValueQueryStringParameters

  if (!qs.doc) {
    throw new Error('must specify ?doc=DOC_NAME')
  }

  return qs.doc[0]
}

const send = ({ context, docName, message, id }) => {
  return context.postToConnection(Buffer.from(message), id)
    .catch(() => removeConnection(docName, id))
}

// TODO make sure input/output are correct (b64?) format and that it parses
// to uint8array properly (esp getOrCreateDoc, updateDoc)
export const handler = ws(
  ws.handler({
    // Connect
    async connect ({ id, event, context, ...other }) {
      const docName = getDocName(event)
  
      console.log('connection %s', id)

      await addConnection(docName, id)

      // get doc from db
      // create new doc with no updates if no doc exists
      const doc = await getOrCreateDoc(docName)

      // writeSyncStep1 (send sv)
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeSyncStep1(encoder, doc)
      await send({ context, docName, message: encoding.toUint8Array(encoder), id })

      return { statusCode: 200 }
    },
  
    // Disconnect
    async disconnect ({ id, event }) {
      const docName = getDocName(event)
  
      console.log('disconnect %s', id)

      await removeConnection(docName, id)

      return { statusCode: 200 }
    },
  
    // Message
    async default ({ message, id, event, context }) {
      const docName = getDocName(event)
      console.log('message', message, id)

      const connectionIds = await getConnectionIds(docName)
      const otherConnectionIds = connectionIds.filter(_ => _ !== id)
      const broadcast = (message) => {
        return Promise.all(otherConnectionIds.map(id => {
          return send({ context, docName, message, id }) 
        }))
      }

      message = new Uint8Array(message)
      const doc = await getOrCreateDoc(docName)

      const encoder = encoding.createEncoder()
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
  
      switch (messageType) {
        // Case sync1: Read SyncStep1 message and reply with SyncStep2 (send doc to client wrt state vector input)
        // Case sync2 or yjsUpdate: Read and apply Structs and then DeleteStore to a y instance (append to db, send to all clients)
        case messageSync:
          encoding.writeVarUint(encoder, messageSync)

          // syncProtocol.readSyncMessage
          const messageType = decoding.readVarUint(decoder)
          switch (messageType) {
            case syncProtocol.messageYjsSyncStep1:
              syncProtocol.readSyncStep1(decoder, encoder, doc)
              break
            case syncProtocol.messageYjsSyncStep2:
            case syncProtocol.messageYjsUpdate:
              syncProtocol.readSyncStep2(decoder, doc, null)
              await updateDoc(docName, message)
              await broadcast(message)
              break
            default:
              throw new Error('Unknown message type')
          }

          // Reply with our state
          if (encoding.length(encoder) > 1) {
            await send({ context, docName, message: encoding.toUint8Array(encoder), id })
          }

          break
        case messageAwareness: {
          await broadcast(message)
          break
        }
      }

      return { statusCode: 200 }
    },
  })
)
