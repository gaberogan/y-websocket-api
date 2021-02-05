import React from 'react'
import ReactDOM from 'react-dom'
import { css } from '@emotion/css'
import SlateEditor from './components/SlateEditor'
import ConnectionForm from './components/ConnectionForm'

const pageStyle = css`
  margin: 24px;
`

const App = () => (
  <div className={pageStyle}>
    <ConnectionForm /> 
    <SlateEditor />
  </div>
)

ReactDOM.render(<App />, document.getElementById('root'))
