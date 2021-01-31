// @ts-nocheck
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import isHotkey from 'is-hotkey'
import { Editable, withReact, useSlate, Slate } from 'slate-react'
import {
  Editor,
  Transforms,
  createEditor,
  Element as SlateElement,
} from 'slate'
import { withHistory } from 'slate-history'
import * as Y from 'yjs'
import { withYjs, toSharedType } from 'slate-yjs'
import randomColor from 'randomcolor'
import { WebsocketProvider } from '../../services/y-websocket'
import { cx, css } from '@emotion/css'
import { Button, Icon, Toolbar } from './components'
import { YJS_ENDPOINT } from '../../services/state.js'
import useCursor from '../../services/useCursor.js'

const HOTKEYS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
}

const LIST_TYPES = ['numbered-list', 'bulleted-list']

const SlateEditor = () => {
  const [value, setValue] = useState([])
  const [editable, setEditable] = useState(false)

  const [sharedType, provider] = useMemo(() => {
    const doc = new Y.Doc()
    const sharedType = doc.getArray('content')
    const provider = new WebsocketProvider(YJS_ENDPOINT, '?doc=my-slate-doc429', doc)
    return [sharedType, provider]
  }, [])

  const editor = useMemo(() => {
    const editor = withYjs(
      withReact(withHistory(createEditor())),
      sharedType
    )

    return editor
  }, [])

  const color = useMemo(
    () =>
      randomColor({
        luminosity: 'dark',
        format: 'rgba',
        alpha: 1
      }),
    []
  )

  const cursorOptions = {
    name: `User ${Math.round(Math.random() * 1000)}`,
    color,
    alphaColor: color.slice(0, -2) + '0.2)'
  }

  const { decorate } = useCursor(editor, provider.awareness, cursorOptions)

  const renderElement = useCallback(props => <Element {...props} />, [])
  const renderLeaf = useCallback((props) => <Leaf {...props} />, [decorate])

  useEffect(() => {
    provider.on('status', ({ status }) => {
      setEditable(true)
    })

    // Super hacky way to provide a initial value from the client, if
    // you plan to use y-websocket in prod you probably should provide the
    // initial state from the server.
    provider.on('sync', (isSynced) => {
      if (isSynced && sharedType.length === 0) {
        toSharedType(sharedType, [
          { type: 'paragraph', children: [{ text: '' }] },
        ])
      }
    })

    return () => {
      provider.disconnect()
    }
  }, [])

  return (
    <ExampleContent>
      <Slate editor={editor} value={value} onChange={value => setValue(value)}>
        <Toolbar>
          <MarkButton format="bold" icon="format_bold" />
          <MarkButton format="italic" icon="format_italic" />
          <MarkButton format="underline" icon="format_underlined" />
          <MarkButton format="code" icon="code" />
          <BlockButton format="heading-one" icon="looks_one" />
          <BlockButton format="heading-two" icon="looks_two" />
          <BlockButton format="block-quote" icon="format_quote" />
          <BlockButton format="numbered-list" icon="format_list_numbered" />
          <BlockButton format="bulleted-list" icon="format_list_bulleted" />
        </Toolbar>
        {!editable && (
          <div>Loading...</div>
        )}
        {editable && (
          <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            decorate={decorate}
            placeholder="Enter some rich text…"
            spellCheck
            // autoFocus // NOTE this breaks it!
            onKeyDown={event => {
              for (const hotkey in HOTKEYS) {
                if (isHotkey(hotkey, event)) {
                  event.preventDefault()
                  const mark = HOTKEYS[hotkey]
                  toggleMark(editor, mark)
                }
              }
            }}
          />
        )}
      </Slate>
    </ExampleContent>
  )
}

const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(editor, format)
  const isList = LIST_TYPES.includes(format)

  Transforms.unwrapNodes(editor, {
    match: n =>
      LIST_TYPES.includes(
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
      ),
    split: true,
  })
  const newProperties = {
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  }
  Transforms.setNodes(editor, newProperties)

  if (!isActive && isList) {
    const block = { type: format, children: [] }
    Transforms.wrapNodes(editor, block)
  }
}

const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format)

  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}

const isBlockActive = (editor, format) => {
  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
  })

  return !!match
}

const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor)
  return marks ? marks[format] === true : false
}

const Element = ({ attributes, children, element }) => {
  switch (element.type) {
  case 'block-quote':
    return <blockquote {...attributes}>{children}</blockquote>
  case 'bulleted-list':
    return <ul {...attributes}>{children}</ul>
  case 'heading-one':
    return <h1 {...attributes}>{children}</h1>
  case 'heading-two':
    return <h2 {...attributes}>{children}</h2>
  case 'list-item':
    return <li {...attributes}>{children}</li>
  case 'numbered-list':
    return <ol {...attributes}>{children}</ol>
  default:
    return <p {...attributes}>{children}</p>
  }
}

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }

  if (leaf.code) {
    children = <code>{children}</code>
  }

  if (leaf.italic) {
    children = <em>{children}</em>
  }

  if (leaf.underline) {
    children = <u>{children}</u>
  }

  return (
    <span
      {...attributes}
      style={
        {
          position: 'relative',
          backgroundColor: leaf.alphaColor
        }
      }
    >
      {leaf.isCaret ? <Caret {...leaf} /> : null}
      {children}
    </span>
  )
}

const BlockButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isBlockActive(editor, format)}
      onMouseDown={event => {
        event.preventDefault()
        toggleBlock(editor, format)
      }}
    >
      <Icon>{icon}</Icon>
    </Button>
  )
}

const MarkButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isMarkActive(editor, format)}
      onMouseDown={event => {
        event.preventDefault()
        toggleMark(editor, format)
      }}
    >
      <Icon>{icon}</Icon>
    </Button>
  )
}

const Wrapper = ({ className, ...props }) => (
  <div
    {...props}
    className={cx(
      className,
      css`
        margin: 20px auto;
        padding: 20px;
      `
    )}
  />
)

const ExampleContent = props => (
  <Wrapper
    {...props}
    className={css`
      background: #fff;
    `}
  />
)

// Cursor Caret
const Caret = ({ color, isForward, name }) => {
  const cursorStyles = {
    ...cursorStyleBase,
    background: color,
    left: isForward ? '100%' : '0%'
  }
  const caretStyles = {
    ...caretStyleBase,
    background: color,
    left: isForward ? '100%' : '0%'
  }

  caretStyles[isForward ? 'bottom' : 'top'] = 0

  return (
    <>
      <span contentEditable={false} style={caretStyles}>
        <span style={{ position: 'relative' }}>
          <span contentEditable={false} style={cursorStyles}>
            {name}
          </span>
        </span>
      </span>
    </>
  )
}

const cursorStyleBase = {
  position: 'absolute',
  top: -2,
  pointerEvents: 'none',
  userSelect: 'none',
  transform: 'translateY(-100%)',
  fontSize: 10,
  color: 'white',
  background: 'palevioletred',
  whiteSpace: 'nowrap'
}

const caretStyleBase = {
  position: 'absolute',
  pointerEvents: 'none',
  userSelect: 'none',
  height: '1.2em',
  width: 2,
  background: 'palevioletred'
}

export default SlateEditor
