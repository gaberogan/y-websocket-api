import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as Y from 'yjs'
import { LeveldbPersistence } from 'y-leveldb'

// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// disable gc when using snapshots!
const persistenceDir = `${__dirname}/dbDir`
/**
 * @type {{bindState: function(string, import('../handler/common').WSSharedDoc):void,
 * writeState:function(string, import('../handler/common').WSSharedDoc):Promise<any>, provider: any}|null}
 */
console.info('Persisting documents to "' + persistenceDir + '"')
const ldb = new LeveldbPersistence(persistenceDir)
export const persistence = {
  provider: ldb,
  bindState: async (docName, ydoc) => {
    const persistedYdoc = await ldb.getYDoc(docName)
    const newUpdates = Y.encodeStateAsUpdate(ydoc)
    ldb.storeUpdate(docName, newUpdates)
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))
    ydoc.on('update', update => {
      ldb.storeUpdate(docName, update)
    })
  },
  writeState: async (docName, ydoc) => {} // eslint-disable-line
}