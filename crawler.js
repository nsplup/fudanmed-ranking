const superagent = require('superagent')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const mkdir = require('./mkdirWhenNotExist')
const { ASPX } = require('./constants')

const BASE_URL = 'http://www.fudanmed.com/institute'
const MAIN_URL = `${ BASE_URL }/news222.aspx`
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
const DELAY = 30 /** 抓取间隔，单位：秒 */
const CACHE_EXPIRY = 24 /** 缓存有效期，单位：小时 */
const RADIX = 36

function main () {
  return new Promise(async function (res, rej) {
    const result = await superagent.get(MAIN_URL)
      .set('User-Agent', USER_AGENT)
    const html = result.text
    const $ = cheerio.load(html)
    const urlList = []
  
    /** 获取排行表地址列表 */
    $('a:contains("年度")').each((i, el) => {
      let name = $(el).text().trim()
      let href = $(el).attr('href')
  
      if (!name.includes('专科') && !name.includes('综合')) { name += '专科排行榜' }
      urlList.push({ name, href })
    })
  
    mkdir(ASPX)
    const files = fs.readdirSync(path.resolve(ASPX))
    const checkAndFetch = async function () {
      const item = urlList.shift()
      if (item) {
        const { name, href } = item
        let fileName = null
        let shouldFetch = false
  
        /** 匹配文件名 */
        for (let i = 0, len = files.length; i < len; i++) {
          const current = files[i]
          if (current.includes(name)) {
            fileName = current
            break
          }
        }
  
        /** 匹配时比对时间戳决定是否更新 */
        if (fileName) {
          const timeStamp = fileName.split('_')[1].slice(0, -5)
          const pureTimeStamp = parseInt(timeStamp, RADIX)
          shouldFetch = compareTime(pureTimeStamp)
          console.log(
            shouldFetch ?
              `\x1b[31m已找到\x1b[0m：${ name }，需要更新` :
              `\x1b[32m已找到\x1b[0m：${ name }，无需更新`
          )
          /** 删除过期文件 */
          if (shouldFetch) {
            const filePath = path.join(ASPX, fileName)
            fs.unlinkSync(filePath)
            console.log(`已删除：${ filePath }`)
          }
        } else {
          console.log(`未找到：${ name }`)
          shouldFetch = true
        }
  
        /** 抓取 */
        if (shouldFetch) {
          const res = await superagent.get(`${ BASE_URL }/${ href }`)
            .set('User-Agent', USER_AGENT)
          const content = res.text
          const timeStamp = Date.now().toString(RADIX)
          const filePath = path.join(ASPX, `${ name }_${ timeStamp }.aspx`)
          console.log(`已保存：${ filePath }`)
          fs.writeFileSync(filePath, content, { encoding: 'utf-8' })
        }
        /** 循环 */
        if (urlList.length > 0) {
          setTimeout(
            checkAndFetch,
            shouldFetch ?
              DELAY * 1000 :
              0
          )
        } else {
          res()
        }
      }
    }
    checkAndFetch()
  })
}

function compareTime(time, exp = CACHE_EXPIRY) {
  let inputTime = time + (exp * 60 * 60 * 1000)
  let expiryTime = Date.now()

  return inputTime < expiryTime
}

module.exports = main