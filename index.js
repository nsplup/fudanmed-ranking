const crawler = require('./crawler')
const extract = require('./extract')

function main () {
  crawler().then(() => extract())
}

main()