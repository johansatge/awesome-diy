/**
 * - Fetch fresh YouTube data for new channels in channels.json (ones with an ID only)
 *   (or all channels with "--fetch-all" option)
 * - Update channel name, description & thumbnail
 * - Reorder channels in alphabetical order
 * - Update table in readme.md
 */

const https = require('https')
const fsp = require('fs').promises
const path = require('path')
const { apiKey } = require('./.apikey.js')

const channelsPath = path.join(__dirname, 'channels.json')
const readmePath = path.join(__dirname, 'readme.md')
const fetchAll = process.argv.includes('--fetch-all')

;(async () => {
  try {
    const channels = await consolidateChannelsJson()
    await writeReadme(channels)
  } catch(error) {
    console.log(`Run error: ${error.message}`)
  }
})()

async function consolidateChannelsJson() {
  const channelsJson = JSON.parse(await fsp.readFile(channelsPath, 'utf8'))
  const consolidatedChannels = []
  for (const [index, channel] of channelsJson.entries()) {
    const readablePosition = `${index + 1}/${channelsJson.length}`
    if (channel.name && !fetchAll) {
      consolidatedChannels.push(channel)
      process.stdout.write(`Skipping channel ${readablePosition}\r`)
      continue
    }
    process.stdout.write(`Fetching channel ${readablePosition}\r`)
    const freshChannelData = await fetchChannelData(channel.id)
    consolidatedChannels.push({
      id: channel.id,
      name: freshChannelData.snippet.localized.title,
      thumbnail: freshChannelData.snippet.thumbnails.medium.url,
      description: freshChannelData.snippet.localized.description,
      country: freshChannelData.snippet.country || '',
    })
  }
  consolidatedChannels.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    return aName > bName ? 1 : (aName < bName ? -1 : 0)
  })
  await fsp.writeFile(channelsPath, JSON.stringify(consolidatedChannels, null, 2), 'utf8')
  return consolidatedChannels
}

async function writeReadme(channels) {
  process.stdout.write('\nWriting readme.md\n')
  const tableMarkdown = []
  tableMarkdown.push('📷|Channel|Description')
  tableMarkdown.push('---|---|---')
  for (const channel of channels) {
    const country = channel.country.length > 0 ? `(${channel.country})` : ''
    const line = [
      `<img src="${channel.thumbnail}" width="100px" alt="${channel.id}">`,
      `[${channel.name}](https://www.youtube.com/channel/${channel.id}) ${country}`,
      descriptionMarkup(channel.description),
    ]
    tableMarkdown.push(line.join('|'))
  }
  const fileMarkdown = await fsp.readFile(readmePath, 'utf8')
  const tableRegex = /<!-- CHANNELS -->\n.+\n<!-- \/CHANNELS -->/s
  const newTableMarkdown = `<!-- CHANNELS -->\n${tableMarkdown.join('\n')}\n<!-- \/CHANNELS -->`
  await fsp.writeFile(readmePath, fileMarkdown.replace(tableRegex, newTableMarkdown), 'utf8')
}

function descriptionMarkup(rawDescription) {
  const maxLength = 120
  const oneLine = (text) => text.replaceAll('\n', ' ')
  if (rawDescription.length === 0) {
    return '_No description_'
  }
  if (rawDescription.length <= maxLength) {
    return oneLine(rawDescription)
  }
  const space = rawDescription.indexOf(' ', maxLength)
  const summary = rawDescription.substring(0, space)
  const rest = rawDescription.substring(space + 1)
  return `<details><summary>${oneLine(summary)} [...]</summary>${oneLine(rest)}</details>`
}

function fetchChannelData(channelId) {
  const options = {
    hostname: 'www.googleapis.com',
    path: `/youtube/v3/channels?key=${apiKey}&id=${channelId}&part=snippet&maxResults=1`,
    method: 'GET',
  }
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = ''
      response.on('data', (chunk) => {
        data += chunk
      })
      response.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (!json.items || json.items.length === 0) {
            reject(new Error(`Channel not found in response`))
            return
          }
          resolve(json.items[0])
        } catch(error) {
          reject(new Error(`Could not parse response (${error.message})`))
        }
      })
    })
    request.on('error', error => {
      reject(error)
    })
    request.end()
  })
}
