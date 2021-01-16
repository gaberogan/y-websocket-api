// @ts-ignore
import syncProtocol from 'y-protocols/dist/sync.cjs'
// @ts-ignore
import awarenessProtocol from 'y-protocols/dist/awareness.cjs'
// @ts-ignore
import encoding from 'lib0/dist/encoding.cjs'
// @ts-ignore
import decoding from 'lib0/dist/decoding.cjs'
import PostToConnection from 'aws-post-to-connection'
import { addConnection, getConnections, removeConnection, getOrCreateDoc } from '../db/aws'

const messageSync = 0
const messageAwareness = 1

// TODO make sure input/output are correct (b64?) format and that it parses to uint8array properly
// TODO setup local dynamodb & https://www.npmjs.com/package/aws-lambda-ws-server

export const handler = async (event, context) => { // eslint-disable-line
  const postToSameGateway = PostToConnection(event)
  const { connectionId, routeKey } = event.requestContext
  const docName = event.queryStringParameters.doc

  // handle new connection
  if (routeKey === '$connect') {
    // handle connectionId
    await addConnection(docName, connectionId)

    // get doc from db
    // create new doc with no updates if no doc exists
    const doc = await getOrCreateDoc(docName)

    // writeSyncStep1 (send sv)
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    await postToSameGateway({ message: encoding.toUint8Array(encoder) }, connectionId)
  
    // DONE
    return
  }
    
  // handle disconnection
  if (routeKey === '$disconnect') {

    // handle connectionId
    await removeConnection(docName, connectionId)

    // DONE
    return
  }
    
  // $default handler

  // handle connectionId
  const connections = await getConnections(docName)

  // (leveraging readSyncMessage)
  // on sync1, use getDoc+message to send back update defined by writeSyncStep2
  // on sync2/update, append to db and broadcastALL
  // on awareness, broadcastALL
  const message = new Uint8Array(event.body)
  const doc = await getOrCreateDoc(docName)

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
      await postToSameGateway({ message: encoding.toUint8Array(encoder) }, connectionId)
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

  // DONE
  return
}
