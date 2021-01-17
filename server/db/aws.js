import { DynamoDBClient, PutItemCommand, QueryCommand, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import * as Y from 'yjs'

const ddb = new DynamoDBClient({
  apiVersion: '2012-08-10',
  region: process.env.REGION,
  endpoint: process.env.DYNAMODB_ENDPOINT,
})

export async function addConnection (docName, connectionId) {
  await ddb.send(new PutItemCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    Item: {
      PartitionKey: {
        S: docName,
      },
      SortKey: {
        S: connectionId,
      },
    },
  }))
}

export async function getConnectionIds (docName) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    KeyConditionExpression: 'PartitionKey = :partitionkeyval',
    ExpressionAttributeValues: {
      ':partitionkeyval': docName,
    },
  }))
  return Items.map(item => item.SortKey.S)
}

export async function removeConnection (docName, connectionId) {
  await ddb.send(new DeleteItemCommand({
    TableName: process.env.DOCS_TABLE_NAME,
    Key: {
      PartitionKey: {
        S: docName,
      },
      SortKey: {
        S: connectionId,
      },
    },
  }))
}

export async function getOrCreateDoc (docName) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: process.env.DOCS_TABLE_NAME,
    KeyConditionExpression: 'PartitionKey = :partitionkeyval',
    ExpressionAttributeValues: {
      ':partitionkeyval': docName,
    },
  }))

  const dbDoc = Items[0]

  // Doc not found, create doc
  if (!dbDoc) {
    await ddb.send(new PutItemCommand({
      TableName: process.env.DOCS_TABLE_NAME,
      Item: {
        PartitionKey: {
          S: docName,
        },
        Updates: {
          BS: [],
        },
      },
    }))
  }

  const updates = dbDoc.Updates.BS

  const ydoc = new Y.Doc()

  for (let i = 0; i < updates.length; i++) {
    Y.applyUpdate(ydoc, updates[i])
  }

  return ydoc
}

export async function updateDoc (docName, update) {
  await ddb.send(new UpdateItemCommand({
    TableName: process.env.DOCS_TABLE_NAME,
    UpdateExpression: 'SET Updates = list_append(Updates, :attrValue)',
    Key: {
      PartitionKey: {
        S: docName,
      },
    },
    ExpressionAttributeValues: {
      ':attrValue': {
        BS: [update],
      },
    },
  }))
}
