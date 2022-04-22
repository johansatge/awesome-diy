/**
 * Generate a markdown table from the local channels.json file
 */

const fsp = require('fs').promises
const path = require('path')

const channelsPath = path.join(__dirname, '../channels.json')

try {
  run()
} catch(error) {
  console.log(`Run error: ${error.message}`)
}

async function run() {
  const channelsJson = JSON.parse(await fsp.readFile(channelsPath, 'utf8'))
  const markdown = []
  markdown.push('📷|Channel|Description')
  markdown.push('---|---|---')
  for (const channel of channelsJson) {
    const country = channel.country.length > 0 ? `(${channel.country})` : ''
    const line = [
      `<img src="${channel.thumbnail}" width="100px" alt="${channel.id}">`,
      `[${channel.name}](https://www.youtube.com/channel/${channel.id}) ${country}`,
      descriptionMarkup(channel.description),
    ]
    markdown.push(line.join('|'))
  }
  console.log(markdown.join('\n'))
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
