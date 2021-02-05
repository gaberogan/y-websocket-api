import { useState, useCallback, useEffect } from '../../_snowpack/pkg/react.js'
import { Text, Range, Path } from '../../_snowpack/pkg/slate.js'

// Apply slate cursor to YJS
export const applySlateCursor = (editor, awareness, cursorOptions) => {
  const selection = editor.selection
  const localCursor = awareness.getLocalState().cursor

  if (selection) {
    const updatedCursor = Object.assign(
      {},
      localCursor,
      selection,
      cursorOptions,
      {
        isForward: Range.isForward(selection)
      }
    )

    // Broadcast cursor
    if (JSON.stringify(updatedCursor) !== JSON.stringify(localCursor)) {
      awareness.setLocalStateField('cursor', updatedCursor)
    }
  } else {
    // Broadcast remove cursor
    awareness.setLocalStateField('cursor', null)
  }
}

const useCursor = (editor, awareness, cursorOptions) => {
  const [cursors, setCursors] = useState([])

  useEffect(() => {
    const oldOnChange = editor.onChange

    editor.onChange = () => {
      if (!editor.isRemote) {
        applySlateCursor(editor, awareness, cursorOptions)
      }
  
      if (oldOnChange) {
        oldOnChange()
      }
    }
  
    awareness.on('change', () => {
      const localState = awareness.getLocalState()
      if (!localState) return // page is closing
      // Pull cursors from awareness
      setCursors(
        [...awareness.getStates().values()]
          .filter(_ => _ !== localState)
          .map(_ => _.cursor)
          .filter(_ => _)
      )
    })
  }, [])

  // Supply decorations to slate leaves
  const decorate = useCallback(
    ([node, path]) => {
      const ranges = []

      if (Text.isText(node) && cursors?.length) {
        cursors.forEach(cursor => {
          if (Range.includes(cursor, path)) {
            const { focus, anchor, isForward } = cursor

            const isFocusNode = Path.equals(focus.path, path)
            const isAnchorNode = Path.equals(anchor.path, path)

            ranges.push({
              ...cursor,
              isCaret: isFocusNode,
              anchor: {
                path,
                offset: isAnchorNode
                  ? anchor.offset
                  : isForward
                  ? 0
                  : node.text.length
              },
              focus: {
                path,
                offset: isFocusNode
                  ? focus.offset
                  : isForward
                  ? node.text.length
                  : 0
              }
            })
          }
        })
      }

      return ranges
    },
    [cursors]
  )

  return {
    cursors,
    decorate
  }
}

export default useCursor
