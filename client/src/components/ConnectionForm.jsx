import React from 'react'
import { css } from '@emotion/css'
import useLocalStorage from '../services/useLocalStorage.js'

const inputGroup = css`
  display: flex;
  gap: 10px;
`

const submitBtn = css`
  background: #2185d0;
  white-space: nowrap;
  color: white;
  font-weight: bold;
  border: none;
  padding: 10px 15px;
  font-size: 14px;
  cursor: pointer;
`

export default () => {
  const [storedValue, setStoredValue] = useLocalStorage('document', `doc-${Math.round(Math.random() * 1e4)}`)

  return (
    <div className={inputGroup}>
      <input type='text' name='Document' value={storedValue} onChange={e => setStoredValue(e.target.value)} />
      <div className={submitBtn} onClick={() => location.reload()}>Update Document</div>
    </div>
  )
}
