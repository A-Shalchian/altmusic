const { downloadSong } = require("./download")

const query = process.argv.slice(2).join(" ").trim()

if (!query) {
  console.log("usage: node src/cli.js <song name>")
  process.exit(1)
}

console.log("searching: " + query)

downloadSong(query, (text) => process.stdout.write(text))
  .then((file) => {
    console.log("")
    console.log("saved: " + file)
  })
  .catch((error) => {
    console.error("failed: " + error.message)
    process.exit(1)
  })
