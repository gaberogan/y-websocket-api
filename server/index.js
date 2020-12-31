import cors from 'cors'
import express from 'express'
import http from 'http'
import WebSocket from 'ws'
import { WSManager } from './server.js'

const defaultValue = [
  {
    type: 'paragraph',
    children: [
      {
        text: '',
      },
    ],
  },
]

const run = () => {
  const port = process.env.PORT || 9000

  const app = express().use(cors())
  const server = http.createServer(app)
  const wss = new WebSocket.Server({ server })

  const manager = new WSManager({
    loadDocument: () => defaultValue,
  })

  wss.on('connection', (socket, request) => {
    manager.setupWSConnection(socket, request)
  })

  server.listen(port)
  console.log(`Listening on ::${port}`)
}

run()