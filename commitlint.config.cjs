module.exports = {
  rules: {
    // lower severity to warning to allow longer lines
    'body-max-line-length': [1, 'always', 120]
  },
  extends: ['@commitlint/config-conventional']
}
