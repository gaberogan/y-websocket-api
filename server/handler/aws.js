// TODO handle connections like with chat app. link to onConnect etc... that's it?
// @aws-sdk/client-dynamodb
import * as yjs from 'yjs'

console.log(yjs)

export const handler = (event, context) => {
  const {
    requestContext: { connectionId, routeKey },
  } = event
    
  if (routeKey === '$connect') {
    // handle new connection
    return {
      statusCode: 200
    }
  }
    
  if (routeKey === '$disconnect') {
    // handle disconnection
    return {
      statusCode: 200
    }
  }
    
  // $default handler
  return {
    statusCode: 200
  }    
}
