const path = require("path")
const TelegramBot = require("node-telegram-bot-api")
const { searchSongs, downloadById, loadConfig } = require("./download")
const { batchDownload, isSpotifyUrl } = require("./spotdl")

const config = loadConfig()

if (!config.telegramToken) {
  console.error("set telegramToken in config.json before running the bot")
  process.exit(1)
}

const SEARCH_COUNT = 24
const PAGE_SIZE = 6

const allowed = config.allowedUsers || []
const bot = new TelegramBot(config.telegramToken, { polling: true })
const sessions = new Map()

function permitted(msg) {
  if (allowed.length === 0) return true
  return allowed.includes(msg.from && msg.from.id)
}

function editText(text, chatId, messageId, markup) {
  const options = { chat_id: chatId, message_id: messageId }
  if (markup !== undefined) options.reply_markup = markup
  return bot.editMessageText(text, options).catch((error) => {
    const message = String((error && error.message) || "")
    if (!message.includes("message is not modified")) {
      console.error("edit failed: " + message)
    }
  })
}

function truncate(value, max) {
  if (value.length <= max) return value
  return value.slice(0, max - 3) + "..."
}

function label(result) {
  const time = result.duration ? "[" + result.duration + "] " : ""
  const who = result.uploader ? "  -  " + result.uploader : ""
  return truncate(time + result.title + who, 62)
}

function resultsKeyboard(results, page) {
  const start = page * PAGE_SIZE
  const slice = results.slice(start, start + PAGE_SIZE)
  const rows = slice.map((result, offset) => [
    { text: label(result), callback_data: "p:" + (start + offset) }
  ])
  const nav = []
  if (page > 0) nav.push({ text: "Prev", callback_data: "b" })
  if (start + PAGE_SIZE < results.length) nav.push({ text: "More", callback_data: "n" })
  if (nav.length) rows.push(nav)
  rows.push([{ text: "Cancel", callback_data: "x" }])
  return { inline_keyboard: rows }
}

function qualityKeyboard(index) {
  return {
    inline_keyboard: [
      [{ text: "Best (320 kbps)", callback_data: "q:" + index + ":320K" }],
      [{ text: "High (192 kbps)", callback_data: "q:" + index + ":192K" }],
      [{ text: "Normal (128 kbps)", callback_data: "q:" + index + ":128K" }],
      [{ text: "Back", callback_data: "back" }]
    ]
  }
}

bot.on("message", async (msg) => {
  const text = (msg.text || "").trim()

  if (text === "/start" || text === "/help") {
    bot.sendMessage(msg.chat.id, "Send me a song name and I will show you matches to choose from.")
    return
  }

  if (!text || text.startsWith("/")) return

  if (!permitted(msg)) {
    bot.sendMessage(msg.chat.id, "You are not allowed to use this bot.")
    return
  }

  if (isSpotifyUrl(text)) {
    const batchStatus = await bot.sendMessage(msg.chat.id, "Downloading from Spotify. This can take a while for albums and discographies...")
    try {
      const result = await batchDownload(text)
      editText("Added " + result.downloaded + " tracks to your library.", msg.chat.id, batchStatus.message_id)
    } catch (error) {
      editText("Batch download failed: " + error.message, msg.chat.id, batchStatus.message_id)
    }
    return
  }

  const status = await bot.sendMessage(msg.chat.id, "Searching for " + text)

  let results
  try {
    results = await searchSongs(text, SEARCH_COUNT)
  } catch (error) {
    editText("Search failed: " + error.message, msg.chat.id, status.message_id)
    return
  }

  if (!results.length) {
    editText("No results found for " + text, msg.chat.id, status.message_id)
    return
  }

  const key = msg.chat.id + ":" + status.message_id
  sessions.set(key, { results, page: 0, query: text })
  editText("Results for: " + text, msg.chat.id, status.message_id, resultsKeyboard(results, 0))
})

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const key = chatId + ":" + messageId
  const data = query.data || ""

  bot.answerCallbackQuery(query.id).catch(() => undefined)

  const session = sessions.get(key)

  if (data === "x") {
    sessions.delete(key)
    editText("Cancelled", chatId, messageId)
    return
  }

  if (!session) {
    editText("This search expired. Send the song name again.", chatId, messageId)
    return
  }

  if (data === "n" || data === "b") {
    const maxPage = Math.ceil(session.results.length / PAGE_SIZE) - 1
    const target = session.page + (data === "n" ? 1 : -1)
    if (target < 0 || target > maxPage) return
    session.page = target
    editText("Results for: " + session.query, chatId, messageId, resultsKeyboard(session.results, session.page))
    return
  }

  if (data === "back") {
    editText("Results for: " + session.query, chatId, messageId, resultsKeyboard(session.results, session.page))
    return
  }

  if (data.startsWith("p:")) {
    const index = parseInt(data.slice(2), 10)
    const choice = session.results[index]
    if (!choice) return
    editText("Choose quality for: " + truncate(choice.title, 80), chatId, messageId, qualityKeyboard(index))
    return
  }

  if (data.startsWith("q:")) {
    const parts = data.split(":")
    const index = parseInt(parts[1], 10)
    const bitrate = parts[2] || "0"
    const choice = session.results[index]
    if (!choice) return
    sessions.delete(key)

    editText("Downloading: " + truncate(choice.title, 80), chatId, messageId, { inline_keyboard: [] })

    try {
      const file = await downloadById(choice.id, bitrate)
      const name = file ? path.basename(file) : choice.title
      editText("Added to your library: " + name, chatId, messageId)
    } catch (error) {
      editText("Could not download: " + error.message, chatId, messageId)
    }
  }
})

console.log("arashmusic downloader bot is running")
