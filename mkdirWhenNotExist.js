const path = require('path')
const { accessSync, constants, mkdirSync } = require('fs')

module.exports = function mkdirWhenNotExist (dirPath) {
  let [root, ...dirs] = path.resolve(dirPath).split(path.sep)
  for (let i = 0, len = dirs.length; i < len; i++) {
    root = path.join(root, dirs[i])
    
    try {
      accessSync(root, constants.R_OK)
    } catch (e) {
      if (e.code === 'ENOENT') {
        mkdirSync(root)
      } else {
        console.error(e)
      }
    }
  }
}