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

The Home screen shows "Because you listen to ..." and "Because you searched for ..." sections built from your listening history and recent searches (via the free Deezer API). Tap a card and the song downloads and starts playing. The top picks are pre-downloaded in the background, so it is instant. Tap the X on a card to never see that song again; deleting a song from your library also blocks it from future recommendations.

Every night at 4am the server downloads the top 12 recommendations for each person. The next time they open the app, those songs land in their own **Discover Mix** playlist. Set `"discover": false` in `arashmusic-downloader/config.json` to turn that off.

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

Songs downloaded from YouTube often have uploader channels as the artist ("Rubik Music") or no album. The server lists those songs, and Claude Code (`claude -p`, on your Claude subscription login, no API key) works out the correct artist, title and album. The server then rewrites the tags with ffmpeg.

Claude Code does not need to be on the music host. Run the fixer from any laptop that has Claude Code signed in:

1. In `arashmusic-downloader`, copy `remote.example.json` to `remote.json`. Fill in the host address (your Tailscale URL) and your admin username and password.
2. Run it once with `npm run fixtags:remote`.
3. Schedule it with `npm run fixtags:schedule`. It then runs daily at 21:00 and at logon, and logs to `fixtags-remote.log`. To pick another time, run `powershell -File fixtags-schedule.ps1 -At 23:00`. Remove the schedule with `npm run fixtags:unschedule`.

If the host itself has Claude Code, set `"fixTags": "local"` in its `config.json` and the server runs the fixer at 5am on its own.

## Users

Everyone shares one library. Each person has their own likes, playlists, stats, "not interested" list, recommendations and Discover Mix.

- Sign in as the admin (the Navidrome account you created first) and open **Settings > Manage users**. From there you can add someone, change their password, or remove them.
- Send the new person the app address, their username and their password.
- Only admins can delete songs from the library. A deleted song is also blocked from everyone's recommendations.
- The server checks every `/manage` request against Navidrome. A request without a valid login gets a 401.

## Backups

Every night at 3am the server copies `navidrome.db` (users, likes, playlists, play history), `app.db` (searches, "not interested" lists, Discover Mix) and `config.json` into `arashmusic-downloader/backups/<date>/`, and keeps 14 days. Run `npm run backup` in `arashmusic-downloader` for a copy right now. Set `"backupDir"` in `config.json` to a USB drive or synced folder so a dead disk does not take the backups with it. Music files are not included, so copy `navidrome/music` somewhere yourself.

## Desktop app (Windows)

`desktop/` is a small Tauri app, a 1.1 MB installer. It opens your server in its own window, so it always shows the latest version of the player without reinstalling.

- Build it with `npm run desktop:build`. This needs Rust. The installer lands in `desktop/src-tauri/target/release/bundle/nsis/`.
- On first launch it asks for the server address, which is your Tailscale URL. Leave it empty to use `http://localhost:9000`. Change it later from the tray icon ("Change server").
- Closing the window hides it to the tray and the music keeps playing. Quit from the tray menu.
- The play/pause, next and previous media keys work while the window is in the background.

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
| `npm run desktop:build` | Build the Windows desktop app installer |
| `npm --prefix arashmusic-downloader run backup` | Back up the databases and config now |
| `npm --prefix arashmusic-downloader run fixtags:remote` | Fix bad tags on the host using Claude Code on this laptop |

## Auto-start on boot

To make the laptop bring the whole stack up by itself, run once:

```powershell
npm run autostart
```

This registers a Windows Scheduled Task that launches `npm start` hidden at every logon, so Navidrome + Caddy + the bot + the management server come up without you opening a terminal. Remove it any time with `npm run autostart:remove`. (Set the laptop to never sleep so it stays reachable.)

## Notes

- After changing app code, run `npm run build` so the Caddy-served version updates.
- Keep this machine awake (disable sleep) so it stays reachable.
