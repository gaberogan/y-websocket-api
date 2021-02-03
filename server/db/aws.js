import { DynamoDBClient, PutItemCommand, QueryCommand, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import * as Y from 'yjs'

const ddb = new DynamoDBClient({
  apiVersion: '2012-08-10',
  region: process.env.REGION,
  endpoint: process.env.DYNAMODB_ENDPOINT,
})

export async function addConnection (id, docName) {
  await ddb.send(new PutItemCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    Item: {
      PartitionKey: {
        S: id,
      },
      DocName: {
        S: docName,
      },
    },
  }))
}

export async function getConnection (id) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    KeyConditionExpression: 'PartitionKey = :partitionkeyval',
    ExpressionAttributeValues: {
      ':partitionkeyval': {
        S: id,
      },
    },
  }))

  const connection = Items[0]

  if (!connection) {
    await removeConnection(id)
    throw new Error(`Connection not found: ${id}`)
  }

  return connection
}

export async function getConnectionIds (docName) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    IndexName: 'DocNameIndex',
    KeyConditionExpression: 'DocName = :docnameval',
    ExpressionAttributeValues: {
      ':docnameval': {
        S: docName,
      },
    },
  }))
  return Items.map(item => item.PartitionKey.S)
}

export async function removeConnection (id) {
  await ddb.send(new DeleteItemCommand({
    TableName: process.env.CONNECTIONS_TABLE_NAME,
    Key: {
      PartitionKey: {
        S: id,
      },
    },
  }))
}

const splitCharacter = '___'

export async function getOrCreateDoc (docName) {
  let loadUntilOperation = false
  let docNameToUse = docName
  let loadUntilOperationNo = 0
  if (docName.includes(splitCharacter)) {
    loadUntilOperation = true
    const [docNameId, operationNo] = docName.split(splitCharacter)
    docNameToUse = docNameId
    loadUntilOperationNo = operationNo
  }


  const { Items } = await ddb.send(new QueryCommand({
    TableName: process.env.DOCS_TABLE_NAME,
    KeyConditionExpression: 'PartitionKey = :partitionkeyval',
    ExpressionAttributeValues: {
      ':partitionkeyval': {
        S: docNameToUse,
      },
    },
  }))

  let dbDoc = Items[0]

  // Doc not found, create doc
  if (!dbDoc) {
    await ddb.send(new PutItemCommand({
      TableName: process.env.DOCS_TABLE_NAME,
      Item: {
        PartitionKey: {
          S: docNameToUse,
        },
        Updates: {
          L: [],
        },
      },
    }))
    dbDoc = {
      Updates: { L: [] }
    }
  }

  // @ts-ignore
  const updates = dbDoc.Updates.L.map(_ => new Uint8Array(Buffer.from(_.B, 'base64')))

  const ydoc = new Y.Doc()

  console.log('MICHAL: updates.length', updates.length)
  let loadUntil = loadUntilOperation ? loadUntilOperationNo : updates.length
  loadUntil = loadUntil > updates.length ? updates.length : loadUntil
  console.log('PINGWING: 121 loadUntil', loadUntil)

  for (let i = 0; i < loadUntil; i++) {
    Y.applyUpdate(ydoc, updates[i])
  }

  ydoc.getArray('content').forEach(c => console.log([...c.entries()]))

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
        L: [{ B: update }],
      },
    },
  }))
}
