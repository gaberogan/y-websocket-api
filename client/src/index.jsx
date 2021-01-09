import React from 'react'
import ReactDOM from 'react-dom'
import { css } from '@emotion/css'
import QuillEditor from './components/QuillEditor'
import SlateEditor from './components/SlateEditor'

const pageStyle = css`
  margin: 24px;
`

const App = () => (
  <React.Fragment>
    <div className={pageStyle}>
      <h1>Slate</h1>
      <SlateEditor />
      <h1>Quill</h1>
      <QuillEditor />
    </div>
  </React.Fragment>
)

ReactDOM.render(<App />, document.getElementById('root'))
