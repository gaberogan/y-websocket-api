module.exports = {
  'env': {
    'es2021': true
  },
  'extends': [
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module',
    'ecmaFeatures': {
      'jsx': true
    },
  },
  'rules': {
    'indent': [
      'error',
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    'quotes': [
      'error',
      'single'
    ],
    'semi': [
      'error',
      'never'
    ],
    'react/prop-types': 0
  },
  'ignorePatterns': ['build']
}
