/**
 * - Fetch fresh YouTube data for each channel in channels.json
 * - Update channel name, description & thumbnail
 * - Reorder channels in alphabetical order
 */

const https = require('https')
const fsp = require('fs').promises
const path = require('path')
const { apiKey } = require('../.apikey.js')

const channelsPath = path.join(__dirname, '../channels.json')

try {
  run()
} catch(error) {
  console.log(`Run error: ${error.message}`)
}

async function run() {
  const channelsJson = JSON.parse(await fsp.readFile(channelsPath, 'utf8'))
  const consolidatedChannels = []
  for (const [index, channel] of channelsJson.entries()) {
    process.stdout.write(`Fetching channel ${index + 1}/${channelsJson.length}\r`)
    const freshChannelData = await fetchChannelData(channel.id)
    channel.thumbnail = freshChannelData.snippet.thumbnails.medium.url
    channel.name = freshChannelData.snippet.localized.title
    channel.description = freshChannelData.snippet.localized.description
    channel.country = freshChannelData.snippet.country || ''
    consolidatedChannels.push(channel)
  }
  consolidatedChannels.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    return aName > bName ? 1 : (aName < bName ? -1 : 0)
  })
  await fsp.writeFile(channelsPath, JSON.stringify(consolidatedChannels, null, 2), 'utf8')
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
