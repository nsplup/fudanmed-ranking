const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const mkdir = require('./mkdirWhenNotExist')
const { ASPX, DATAS } = require('./constants')

function main () {
  const files = fs.readdirSync(path.resolve(ASPX))
  for (let i = 0, len = files.length; i < len; i++) {
    const file = files[i]
    const fileName = file.split('_')[0]
    const filePath = path.join(ASPX, file)
    const content = fs.readFileSync(filePath, { encoding: 'utf-8' })
    let results = []

    if (fileName.includes('综合')) {
      results = general(content)
    } else {
      results = specialized(content)
    }
    /** 保存数据 */
    mkdir(DATAS)
    const outputPath = path.join(DATAS, `${ fileName }.json`)
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 4), { encoding: 'utf-8' })
    console.log(`已保存：${ outputPath }`)
  }
}

function specialized (content) {
  const results = []
  const $ = cheerio.load(content)
  let result = []
  let temp = []
  $('tr')
    .map((i, el) => $(el).text().replace(/[\s\n]+/g, ' '))
    .toArray()
    .forEach(line => {
      /** 数据分块 */
      line = line.trim()
      if (line.endsWith('声誉值')) {
        result.push(temp)
        temp = []
      }
      if (line.length > 0) { temp.push(line) }
    })
  /** 去掉尾部无用部分 */
  for (let j = 0, tLen = temp.length; j < tLen; j++) {
    const tLine = temp[j]
    if (tLine.startsWith('版权声明') || tLine.endsWith('排行榜')) {
      temp = temp.slice(0, j)
      break
    }
  }
  result.push(temp)
  /** 去掉头部无用部分 */
  result = result.slice(1)
  for (let k = 0, rLen = result.length; k < rLen; k++) {
    const current = result[k]
    /** 提取科室名称 */
    const nav = current[0]
    const endIndex = nav.indexOf('医院')
    const department = nav.slice(0, endIndex).replace(/\s+/g, '')
    /** 提取排名信息 */
    const rankingRaw = []
    const ranking = []
    let rankingTemp = []
    const exce = []
    let exceRanking = []
    for (let l = 1, lLen = current.length - 1; l < lLen; l++) {
      const line = current[l]
      if (line.startsWith('其中')) {
        ranking.push(rankingTemp)
        rankingTemp = []
      }
      rankingTemp.push(line)
    }
    ranking.push(rankingTemp)
    const sfn = v => rankingRaw.push(splitRank(v))
    let nominate = null
    /** 处理例外行「其中*」 */
    if (ranking.length > 1) {
      for (let n = 0, nLen = ranking.length; n < nLen; n++) {
        let cRanking = ranking[n]
        const fLine = cRanking[0]
        if (fLine.startsWith('其中')) {
          const eResult = {}
          cRanking.forEach((v, i) => {
            if (i === 0) {
              const [ignore, eDep, ...rest] = v.split(/\s+/g)
              eResult.department = eDep
              exceRanking.push(splitRank(rest.join(' ')))
            } else {
              exceRanking.push(splitRank(v))
            }
          })
          eResult.ranking = exceRanking
          eResult.nominate = null
          exceRanking = []
          exce.push(eResult)
        } else {
          const lLine = cRanking[cRanking.length - 1]
          if (lLine.startsWith('获提名')) {
            cRanking = cRanking.slice(0, -1)
            nominate = lLine
          }
          cRanking.forEach(sfn)
        }
      }
    } else {
      (ranking[0]).forEach(sfn)
    }
    /** 提取提名医院 */
    let startIndex = 1
    nominate = (nominate || current[current.length - 1])
      .split(/\s+/g)
    if (nominate[1] === '医院') { startIndex = 2 }
    nominate = nominate
      .slice(startIndex)
      .join('')
      .split(/\s*、\s*/)
      .filter(v => v.length > 0)
      .map(v => rp(v))
    results.push({
      department,
      ranking: rankingRaw,
      nominate
    })
    if (exce.length > 0) { results.push(...exce) }
  }

  return results
}

function general (content) {
  const results = []
  const $ = cheerio.load(content)
  let result = []
  let temp = []
  $('tr')
    .map((i, el) => $(el).text().replace(/[\s\n]+/g, ' '))
    .toArray()
    .forEach(line => {
      /** 数据分块 */
      line = line.trim()
      if (line.endsWith('得分')) {
        result.push(temp)
        temp = []
      }
      if (line.length > 0 && !line.startsWith('说明')) { temp.push(line) }
    })
  /** 去掉尾部无用部分 */
  for (let j = 0, tLen = temp.length; j < tLen; j++) {
    const tLine = temp[j]
    if (tLine.startsWith('版权声明') || tLine.endsWith('排行榜')) {
      temp = temp.slice(0, j)
      break
    }
  }
  result.push(temp)
  /** 去掉头部无用部分 */
  result = result.slice(1)
  for (let k = 0, rLen = result.length; k < rLen; k++) {
    const current = result[k]
    /** 提取科室名称 */
    const nav = current[0]
    const endIndex = nav.indexOf('医院')
    let department = nav.slice(0, endIndex).replace(/\s+/g, '')
    if (department === '排名') { department = '综合排名' }
    const ranking = []
    /** 提取排名信息 */
    current.slice(1).forEach(v => ranking.push(splitRankG(v)))
    results.push({
      department,
      ranking,
    })
  }
  return results
}

function splitRank (line) {
  let rank, name, avgRep, ignore
  let fragments = rp(line).split(/\s+/g)
  switch (fragments.length) {
    case 2:
    case 3:
      [rank, name, avgRep] = fragments
      break
    case 4:
      [rank, name, ignore, avgRep] = fragments
      break
  }
  rank = rank.match(/\d+/)[0]
  avgRep = avgRep || null
  return { rank, name, avgRep }
}
function splitRankG (line) {
  let rank, name, name2, rep, sci, total
  let fragments = rp(line)
    .replace('*', '')
    .split(/\s+/g)
  switch (fragments.length) {
    case 5:
      [rank, name, rep, sci, total] = fragments
      break
    case 6:
      [rank, name, name2, rep, sci, total] = fragments
      name += name2
      break
  }
  rank = rank.match(/\d+/)[0]
  return { rank, name, rep, sci, total }
}
function rp (line) {
  return line.replace('•', '・')
}

module.exports = main