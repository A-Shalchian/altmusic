const { batchDownload } = require("./spotdl")

const input = process.argv.slice(2).join(" ").trim()

if (!input) {
  console.log('usage: node src/grab.js "<spotify artist/album/playlist url or search>"')
  process.exit(1)
}

console.log("grabbing: " + input)

batchDownload(input, (text) => process.stdout.write(text))
  .then((result) => {
    console.log("")
    console.log("done. downloaded " + result.downloaded + " tracks")
  })
  .catch((error) => {
    console.error("failed: " + error.message)
    process.exit(1)
  })
