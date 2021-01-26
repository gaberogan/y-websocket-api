import React, { useEffect } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from '../../services/y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import 'quill/dist/quill.snow.css'
import { YJS_ENDPOINT } from '../../services/state.js'

const QuillEditor = () => {

  useEffect(() => {
    Quill.register('modules/cursors', QuillCursors)

    const ydoc = new Y.Doc()
    const provider = new WebsocketProvider(YJS_ENDPOINT, '?doc=my-quill-doc2', ydoc)
    const type = ydoc.getText('quill')

    const editor = new Quill('#editor-container', {
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline'],
          ['image', 'code-block']
        ]
      },
      placeholder: 'Start collaborating...',
      theme: 'snow' // or 'bubble',
    })

    // Optionally specify an Awareness instance, if supported by the Provider
    const binding = new QuillBinding(type, editor, provider.awareness)
  }, [])

  return (
    <div id='editor-container' />
  )
}

export default QuillEditor
