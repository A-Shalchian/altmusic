# arashmusic

Your own self-hosted music: a Navidrome server, a custom PWA player (arashmusic), and a Telegram bot that downloads songs by name. Everything runs locally on one machine and is reachable from anywhere over Tailscale. No subscriptions.

## What is in here

| Folder | What it is |
|---|---|
| `arashmusic/` | The player (React + Vite PWA). Builds to static files. |
| `arashmusic-downloader/` | Telegram bot (download by name) + a small management server (delete songs) + lyrics fetcher. |
| `navidrome/` | The music server. Holds your music (`navidrome/music`) and database (`navidrome/data`). |
| `Caddyfile` | Serves the built app and proxies the APIs on a single origin (`:9000`). |
| `setup.ps1` | One command that downloads every binary, writes configs, installs deps, and builds the app. |

The binaries (yt-dlp, ffmpeg, Navidrome, Caddy), your music, the database, and your token are NOT in the repo. `setup.ps1` fetches the binaries; your music and config are created locally.

## Requirements

- Windows 10/11
- Node.js 20+ (includes npm)
- Git

## Install (clone and run)

```powershell
git clone <your-repo-url> arashmusic
cd arashmusic
npm run setup
```

`npm run setup` downloads yt-dlp, ffmpeg, Navidrome, and Caddy, writes `navidrome/navidrome.toml` and `arashmusic-downloader/config.json` with the right paths for this machine, installs all dependencies, and builds the app.

### Add your Telegram bot token

1. In Telegram, message **@BotFather**, send `/newbot`, follow the prompts, copy the token.
2. Open `arashmusic-downloader/config.json` and paste it into `"telegramToken"`.
3. Optional safety: put your numeric Telegram user id (from **@userinfobot**) into `"allowedUsers"` so only you can use the bot. Leave `[]` to allow anyone with the bot link.

## Run

```powershell
npm start
```

That launches everything in one terminal (color-labeled): **nav** (Navidrome), **web** (Caddy serving the built app on `:9000`), **bot**, **server**. One Ctrl+C stops all of it.

First run only: create your Navidrome admin user at **http://localhost:4533** (one-time web form).

Then open the player at **http://localhost:9000**, leave the server field blank, and sign in with your Navidrome username/password.

## Access from anywhere (Tailscale)

1. Install Tailscale on this machine and on your phone, sign in to the same account on both: https://tailscale.com/download
2. Expose the app over HTTPS on your private network:
   ```powershell
   tailscale serve --bg https / http://localhost:9000
   ```
3. Find your address:
   ```powershell
   tailscale status
   ```
   Your URL is `https://<this-machine-name>.<your-tailnet>.ts.net`. It is the same at home and on mobile data.

Open that URL on your phone, then "Add to Home Screen" to install it like a real app.

## Getting music

### Discover feed (no typing)

The Home screen shows "Because you listen to ..." and "Because you searched for ..." sections built from your listening history and recent searches (via the free Deezer API). Tap a card and the song downloads and starts playing — the top picks are pre-downloaded in the background so it is instant. Tap the X on a card to never see that song again; deleting a song from your library also blocks it from future recommendations.

Every night at 4am the server also downloads the top 12 recommendations by itself and refreshes a **Discover Mix** playlist, so there is new music every morning without touching anything. Set `"discover": false` in `arashmusic-downloader/config.json` to turn that off.

### From the app (fastest)

Type a song name in the player's Search screen. Below your library results, a "From the internet" section lists matches from YouTube. Tap **Get** and the song downloads at 320 kbps with cover art and lyrics, then appears in your library within seconds (the app triggers a Navidrome scan when the download finishes).

### From Telegram

In your bot's Telegram chat, send a song name (e.g. `lose you to love me`). The bot shows matching results, you tap one, choose a quality (320 / 192 / 128 kbps), and it downloads into your library with cover art and lyrics. Navidrome auto-imports it. You can also paste a Spotify track/album/playlist/artist link to batch-download it.

## Music and lyrics

- Music lives in `navidrome/music`. Drop files/folders there and they import automatically.
- Lyrics are fetched from LRCLIB at download time and saved as `.lrc` files next to each song.
- To fetch lyrics for songs that do not have them yet:
  ```powershell
  cd arashmusic-downloader
  npm run lyrics
  ```

## Fixing bad metadata

Songs downloaded from YouTube often have uploader channels as the artist ("Rubik Music") or no album. A nightly job (5am) finds those files and asks Claude Code (`claude -p`, uses your Claude subscription login — no API key) for the correct artist/title/album, then rewrites the tags with ffmpeg. Run it manually with:

```powershell
cd arashmusic-downloader
npm run fixtags
```

Requires the Claude Code CLI installed and signed in on this machine. Set `"fixTags": false` in `config.json` to disable the nightly run.

## Develop

```powershell
npm run dev
```

Runs Navidrome + the Vite dev server (hot reload) + bot + server. The player is at **http://localhost:5173** during development.

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time install: fetch binaries, write configs, install, build |
| `npm start` | Run the production stack (Navidrome + Caddy + bot + server) |
| `npm run dev` | Run the dev stack (Navidrome + Vite dev server + bot + server) |
| `npm run build` | Rebuild the app after code changes |
| `npm run autostart` | Launch the whole stack automatically at every logon (hidden) |
| `npm run autostart:remove` | Turn off auto-start |

## Auto-start on boot

To make the laptop bring the whole stack up by itself, run once:

```powershell
npm run autostart
```

This registers a Windows Scheduled Task that launches `npm start` hidden at every logon, so Navidrome + Caddy + the bot + the management server come up without you opening a terminal. Remove it any time with `npm run autostart:remove`. (Set the laptop to never sleep so it stays reachable.)

## Notes

- After changing app code, run `npm run build` so the Caddy-served version updates.
- Keep this machine awake (disable sleep) so it stays reachable.
