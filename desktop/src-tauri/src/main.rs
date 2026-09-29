#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

const SETUP_URL: &str = if cfg!(windows) {
    "http://tauri.localhost/index.html"
} else {
    "tauri://localhost/index.html"
};

// the page's own media key handling is turned off so a key press is not
// handled twice (once by WebView2, once by the global shortcut below)
const BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,HardwareMediaKeyHandling";

fn server_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("server.txt"))
}

fn saved_server(app: &AppHandle) -> Option<url::Url> {
    let text = fs::read_to_string(server_file(app)?).ok()?;
    url::Url::parse(text.trim()).ok()
}

#[tauri::command]
fn set_server(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("only http and https addresses work".into());
    }
    let file = server_file(&app).ok_or("no config folder")?;
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(&file, parsed.as_str()).map_err(|e| e.to_string())?;
    let window = app.get_webview_window("main").ok_or("no window")?;
    window.navigate(parsed).map_err(|e| e.to_string())
}

fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn media(app: &AppHandle, action: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&format!("window.amusicMedia && window.amusicMedia.{action}()"));
    }
}

fn change_server(app: &AppHandle) {
    if let Some(file) = server_file(app) {
        let _ = fs::remove_file(file);
    }
    if let (Some(window), Ok(setup)) = (app.get_webview_window("main"), url::Url::parse(SETUP_URL)) {
        let _ = window.navigate(setup);
    }
    show(app);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show(app)))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let action = match shortcut.key {
                        Code::MediaPlayPause => "toggle",
                        Code::MediaTrackNext => "next",
                        Code::MediaTrackPrevious => "prev",
                        _ => return,
                    };
                    media(app, action);
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_server])
        .setup(|app| {
            let handle = app.handle().clone();
            let start = match saved_server(&handle) {
                Some(url) => WebviewUrl::External(url),
                None => WebviewUrl::App("index.html".into()),
            };
            WebviewWindowBuilder::new(app, "main", start)
                .title("arashmusic")
                .inner_size(1200.0, 800.0)
                .min_inner_size(380.0, 600.0)
                .additional_browser_args(BROWSER_ARGS)
                .build()?;

            for key in [Code::MediaPlayPause, Code::MediaTrackNext, Code::MediaTrackPrevious] {
                // another player may already own a media key; the app still works without it
                let _ = app.global_shortcut().register(Shortcut::new(None, key));
            }

            let show_item = MenuItem::with_id(app, "show", "Show arashmusic", true, None::<&str>)?;
            let play_item = MenuItem::with_id(app, "toggle", "Play / pause", true, None::<&str>)?;
            let next_item = MenuItem::with_id(app, "next", "Next track", true, None::<&str>)?;
            let server_item = MenuItem::with_id(app, "server", "Change server", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &play_item, &next_item, &server_item, &quit_item])?;

            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().cloned().ok_or("missing app icon")?)
                .tooltip("arashmusic")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show(app),
                    "toggle" => media(app, "toggle"),
                    "next" => media(app, "next"),
                    "server" => change_server(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // closing hides to the tray so music keeps playing; Quit lives in the tray menu
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start arashmusic");
}
