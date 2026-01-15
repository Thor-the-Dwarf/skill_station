/**
 * ============================================================================
 * game_base.js - Basis-Klasse für alle Spiele
 * ============================================================================
 * 
 * ZWECK:
 * ------
 * Diese Datei stellt eine wiederverwendbare Basis-Klasse für alle Spiele bereit.
 * Sie übernimmt die technischen Details wie:
 * - Laden des JSON-Payloads aus sessionStorage oder Drive
 * - Theme-Verwaltung (Dark/Light Mode)
 * - Validierung der Spiel-Daten
 * - Fehlerbehandlung
 * 
 * VERWENDUNG IN EINEM SPIEL:
 * ---------------------------
 * 1. Binde diese Datei in dein Spiel-HTML ein:
 *    <script src="game_base.js"></script>
 * 
 * 2. Erstelle eine Subklasse von GameBase:
 *    class MeinSpiel extends GameBase {
 *        constructor() {
 *            super({ expectedGameType: 'mein_spiel_typ' });
 *        }
 * 
 *        onDataLoaded(data) {
 *            // Hier kommt deine Spiel-Logik
 *            console.log('Spiel-Daten:', data);
 *        }
 *    }
 * 
 * 3. Initialisiere dein Spiel:
 *    const game = new MeinSpiel();
 *    game.init();
 * 
 * DATENFLUSS:
 * -----------
 * 1. GameBase.init() wird aufgerufen
 * 2. URL-Parameter werden gelesen (fileId)
 * 3. Payload wird aus sessionStorage geladen (oder von Drive)
 * 4. Payload wird validiert (game_type prüfen)
 * 5. onDataLoaded() der Subklasse wird mit validen Daten aufgerufen
 * 
 * ERWARTETE URL-PARAMETER:
 * ------------------------
 * - fileId: Die Google Drive File-ID des JSON-Payloads (PFLICHT)
 * - game_type: Optional, für zusätzliche Validierung
 * 
 * BEISPIEL:
 * ---------
 * Escape-Game.html?fileId=1abc...xyz
 * 
 * JSON-FORMAT:
 * ------------
 * Das JSON muss mindestens folgende Felder enthalten:
 * {
 *     "game_type": "escape_game",  // Identifiziert den Spieltyp
 *     "title": "Mein Spiel",       // Optional: Titel für den Browser-Tab
 *     "schema_version": "1.0",     // Optional: Schema-Version
 *     ... // Weitere spiel-spezifische Daten
 * }
 * 
 * SESSION STORAGE:
 * ----------------
 * Der drive_interpreter.js speichert das Payload:
 * - Key: 'game_payload_' + fileId
 * - Value: JSON.stringify(payload)
 * 
 * Falls sessionStorage leer ist, lädt GameBase direkt von Drive nach.
 * 
 * THEME-SYSTEM:
 * -------------
 * GameBase verwaltet automatisch das Dark/Light Theme:
 * - Liest Theme aus localStorage ('globalTheme_v1')
 * - Setzt die Klasse 'theme-light' am <html>-Element
 * - Bindet einen Theme-Toggle-Button (ID: 'theme-toggle')
 * 
 * FEHLERBEHANDLUNG:
 * -----------------
 * Bei kritischen Fehlern zeigt GameBase eine formatierte Fehlermeldung an
 * und verhindert das Laden des Spiels. Fehler werden in die Console geloggt.
 * 
 * ENTWICKLER-HINWEISE:
 * --------------------
 * - Überschreibe IMMER onDataLoaded() in deiner Subklasse
 * - Nutze this.payload für Zugriff auf die Spiel-Daten
 * - Nutze this.fileId für die Drive File-ID
 * - Nutze this._fatal(msg) für kritische Fehler
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    // Fallback auf globales AppConfig, falls vorhanden
    const GLOBAL_CONFIG = window.AppConfig || {};
    const DEFAULT_API_KEY = GLOBAL_CONFIG.apiKey || '';
    const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const THEME_KEY = 'globalTheme_v1';
    const JSON_SESSION_PREFIX = 'game_payload_';

    class GameBase {
        /**
         * @param {Object} options
         * @param {string} options.expectedGameType  erwarteter game_type (z. B. "what_and_why")
         * @param {string} [options.rootElementId]   ID des Containers für das Spiel
         * @param {string} [options.apiKey]          Google API-Key (Fallback: DEFAULT_API_KEY)
         */
        constructor(options) {
            const opts = options || {};
            this.expectedGameType = opts.expectedGameType || null;
            this.rootElementId = opts.rootElementId || 'game-root';
            this.apiKey = opts.apiKey || DEFAULT_API_KEY;

            this.fileId = null;
            this.gameTypeFromQuery = null;
            this.payload = null;

            this.rootEl = null;
            this.themeToggleBtn = null;
        }

        // ================================================================
        // Öffentlicher Einstiegspunkt
        // ================================================================
        async init() {
            this.rootEl = document.getElementById(this.rootElementId) || document.body;
            // Theme-Toggle (optional - AppBar hat bereits einen)
            this.themeToggleBtn = document.getElementById('theme-toggle');

            this._initTheme();
            this._wireThemeToggle();

            const params = new URLSearchParams(window.location.search);
            this.fileId = params.get('fileId');
            this.gameTypeFromQuery = params.get('game_type');

            if (!this.fileId) {
                this._fatal('In der URL fehlt der Parameter "fileId".');
                return;
            }

            try {
                this.payload = await this._loadPayload();
            } catch (err) {
                console.error(err);
                this._fatal('Die Spieldaten konnten nicht geladen werden:\n' + String(err && err.message ? err.message : err));
                return;
            }

            const headerOk = this._validateHeader();
            if (!headerOk) {
                return;
            }

            // Option: Seitentitel aus JSON-Header setzen
            if (this.payload && typeof this.payload.title === 'string' && this.payload.title.trim() !== '') {
                document.title = this.payload.title + ' – Spiel';
            }

            // An Subklasse übergeben
            try {
                this.onDataLoaded(this.payload);
            } catch (err) {
                console.error(err);
                this._fatal('Fehler beim Initialisieren des Spiels:\n' + String(err && err.message ? err.message : err));
            }
        }

        /**
         * Muss von der Subklasse überschrieben werden.
         * @param {Object} data - Vollständiges JSON-Payload (inkl. Header)
         */
        // eslint-disable-next-line no-unused-vars
        onDataLoaded(data) {
            this._fatal('onDataLoaded(data) ist in der Subklasse nicht implementiert.');
        }

        // ================================================================
        // Theme / Layout
        // ================================================================
        _initTheme() {
            let stored = null;
            try {
                stored = localStorage.getItem(THEME_KEY);
            } catch (_) { }

            const initial = stored === 'light' || stored === 'dark' ? stored : 'dark';

            this._applyTheme(initial);
        }

        _applyTheme(theme) {
            const rootEl = document.documentElement;
            if (theme === 'light') {
                rootEl.classList.add('theme-light');
            } else {
                rootEl.classList.remove('theme-light');
            }

            if (this.themeToggleBtn) {
                this.themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
            }
        }

        _toggleTheme() {
            const isLight = document.documentElement.classList.contains('theme-light');
            const next = isLight ? 'dark' : 'light';
            this._applyTheme(next);
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (_) { }
        }

        _wireThemeToggle() {
            if (!this.themeToggleBtn) return;
            this.themeToggleBtn.addEventListener('click', () => {
                this._toggleTheme();
            });
        }

        // ================================================================
        // Payload laden (sessionStorage → Fallback Drive)
        // ================================================================
        async _loadPayload() {
            const storageKey = JSON_SESSION_PREFIX + this.fileId;

            // 1) Versuch: aus sessionStorage (vom Index/Tree gesetzt)
            try {
                const raw = sessionStorage.getItem(storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Konnte Payload nicht aus sessionStorage lesen:', e);
            }

            // 2) Fallback: direkt von Drive nachladen
            if (!this.apiKey) {
                throw new Error('Kein API-Key für Drive-Fallback verfügbar.');
            }

            const params = new URLSearchParams({
                alt: 'media',
                key: this.apiKey
            });
            const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(this.fileId)}?${params.toString()}`;

            const res = await fetch(url);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Drive-API-Fehler (${res.status}): ${text || res.statusText}`);
            }

            const data = await res.json();
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(data));
            } catch (e) {
                console.warn('Konnte Payload nicht im sessionStorage speichern:', e);
            }

            return data;
        }

        // ================================================================
        // Header-Validierung
        // ================================================================
        _validateHeader() {
            const data = this.payload;
            if (!data || typeof data !== 'object') {
                this._fatal('Ungültige Spieldaten: JSON ist leer oder kein Objekt.');
                return false;
            }

            const actualType = data.game_type || data.gameType || null;
            if (!actualType) {
                this._fatal('Im JSON fehlt das Feld "game_type".');
                return false;
            }

            if (this.expectedGameType && actualType !== this.expectedGameType) {
                const msg = [
                    'Unerwarteter game_type im JSON.',
                    `Erwartet: "${this.expectedGameType}"`,
                    `Gefunden: "${actualType}"`,
                    `Geladenes HTML: ${window.location.pathname.split('/').pop()}`
                ].join('\n');
                this._fatal(msg);
                return false;
            }

            // Optionale Schema-Prüfung
            if (data.schema_version && typeof data.schema_version !== 'string') {
                console.warn('schema_version ist vorhanden, aber kein String:', data.schema_version);
            }

            return true;
        }

        // ================================================================
        // Helpers
        // ================================================================
        _fatal(message) {
            console.error('[GameBase FATAL]', message);
            if (!this.rootEl) return;
            this.rootEl.innerHTML = `
        <div style="
          max-width: 720px;
          margin: 2rem auto;
          padding: 1.2rem 1.4rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(248, 113, 113, 0.6);
          background: rgba(30, 64, 175, 0.1);
          color: #fecaca;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          white-space: pre-wrap;
          font-size: 0.9rem;
        ">
          <h2 style="margin-top:0;margin-bottom:0.5rem;font-size:1.05rem;color:#fecaca;">
            Spiel konnte nicht gestartet werden
          </h2>
          <p style="margin:0;">${this._escapeHtml(String(message))}</p>
        </div>
      `;
        }

        _escapeHtml(str) {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
    }

    // global verfügbar machen
    window.GameBase = GameBase;
})();
