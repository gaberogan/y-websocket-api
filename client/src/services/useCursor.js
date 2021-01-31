import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, Range, Path } from 'slate'

// Apply slate cursor to YJS
export const applySlateCursor = (editor, awareness, cursorOptions) => {
  const selection = editor.selection
  const localCursor = awareness.getLocalState().cursor

  if (selection) {
    const operations = editor.operations
    const cursorOps = operations.filter((op) => op.type === 'set_selection')
    const newCursor = cursorOps[cursorOps.length - 1]?.newProperties || {} // TODO not sure if we care about newProperties

    const newCursorData = Object.assign(
      {},
      localCursor,
      newCursor,
      selection,
      cursorOptions,
      {
        isForward: Range.isForward(selection)
      }
    )

    if (JSON.stringify(newCursorData) !== JSON.stringify(localCursor)) {
      awareness.setLocalStateField('cursor', newCursorData)
    }
  } else {
    awareness.setLocalStateField('cursor', null)
  }
}

const useCursor = (editor, awareness, cursorOptions) => {
  const [cursorData, setCursorData] = useState([])

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
  
    awareness.on('change', ({ added, updated, removed }) => {
      const localCursor = awareness.getLocalState().cursor
      setCursorData(
        [...awareness.getStates().values()]
          .map(_ => _.cursor)
          .filter(cursor => cursor && cursor !== localCursor)
      )
    })
  }, [])

  // TODO this isn't necessary?
  const cursors = useMemo(() => cursorData, [cursorData])

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
