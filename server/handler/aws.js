import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

const ddb = new DynamoDBClient({ apiVersion: '2012-08-10', region: process.env.REGION })

export const handler = async (event, context) => { // eslint-disable-line
  const {
    requestContext: { connectionId, routeKey },
  } = event
    
  // handle new connection
  if (routeKey === '$connect') {
    await ddb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: { connectionId },
    }))

    // get doc from db
    // create new doc with no updates if no doc exists
    // writeSyncStep1 (send sv)
    // DONE

    return { statusCode: 200 }
  }
    
  // handle disconnection
  if (routeKey === '$disconnect') {

    // handle connection stuff
    // DONE

    return { statusCode: 200 }
  }
    
  // $default handler

  // handle connection stuff
  // (leveraging readSyncMessage)
  // on sync1, use getYDoc+message to send back update defined by writeSyncStep2
  // on sync2/update, append to db and broadcastALL
  // on awareness, broadcastALL
  // DONE

  return { statusCode: 200 }
}
