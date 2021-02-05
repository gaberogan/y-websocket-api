import { useState } from 'react'

/**
 * 
 * @param {*} key 
 * @param {*} initialValue 
 * @returns {*}
 */
export default function useLocalStorage(key, initialValue) {
  // Init synchronously
  if (!window.localStorage.getItem(key)) {
    window.localStorage.setItem(key, initialValue)
  }

  const [value, setValue] = useState(window.localStorage.getItem(key))

  const setValueWrapper = (value) => {
    window.localStorage.setItem(key, value)
    setValue(value)
  }

  return [value, setValueWrapper];
}
