// // abstracted from aws or native websockets

// // NOTES
// // - ensure data is interpreted as arraybuffer not blob

// const connect = ({ connectionId, docName }) => {
//   // TODO handle auth here (can throw)
//   // add connection to doc
//   // get doc, initialize if it does not exist yet
//   const doc = getYDoc(docName, gc)
//   doc.conns.set(conn, new Set())
// }



import http from 'http'

const CALLBACK_URL = process.env.CALLBACK_URL ? new URL(process.env.CALLBACK_URL) : null
const CALLBACK_TIMEOUT = process.env.CALLBACK_TIMEOUT || 5000
const CALLBACK_OBJECTS = process.env.CALLBACK_OBJECTS ? JSON.parse(process.env.CALLBACK_OBJECTS) : {}

export const isCallbackSet = !!CALLBACK_URL

/**
 * @param {Uint8Array} update
 * @param {any} origin
 * @param {any} doc
 */
export const callbackHandler = (update, origin, doc) => {
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
