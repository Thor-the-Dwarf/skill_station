/**
 * ============================================================================
 * drive_interpreter.js - Google Drive zu Spiel-Interpreter
 * ============================================================================
 * 
 * ZWECK:
 * Dieses Modul ist die Brücke zwischen Google Drive und den Spiel-Dateien.
 * Es lädt JSON-Konfigurationen aus Drive, interpretiert sie und lädt das
 * entsprechende Spiel in einem iframe.
 * 
 * DATENFLUSS:
 * -----------
 * 1. Benutzer wählt eine JSON-Datei aus dem Drive-Tree aus
 * 2. drive_interpreter.js lädt die JSON-Datei über die Drive API
 * 3. JSON wird analysiert und der game_type extrahiert
 * 4. JSON wird in sessionStorage gespeichert (Key: 'game_payload_' + fileId)
 * 5. Das entsprechende Spiel-HTML wird in ein iframe geladen
 * 6. game_base.js im iframe liest das Payload aus sessionStorage
 * 7. Das Spiel wird mit den Daten aus dem JSON konfiguriert
 * 
 * UNTERSTÜTZTE SPIELTYPEN:
 * ------------------------
 * - 'escape_game': Zeitbasiertes Rätselspiel mit mehreren Aufgaben
 * - Weitere Spieltypen können in _resolveGameHtmlByType() hinzugefügt werden
 * 
 * VERWENDUNG:
 * -----------
 * const result = await window.DriveInterpreter.loadGame({
 *     fileId: 'GOOGLE_DRIVE_FILE_ID',
 *     apiKey: 'DEIN_API_KEY',
 *     driveFilesEndpoint: 'https://www.googleapis.com/drive/v3/files',
 *     containerEl: document.getElementById('game-container'),
 *     basePath: 'games',
 *     iframeClassName: 'game-iframe'
 * });
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Prefix für sessionStorage-Keys
     * Alle Spiel-Payloads werden unter diesem Prefix gespeichert
     * @constant {string}
     */
    const JSON_SESSION_PREFIX = 'game_payload_';

    /**
     * Normalisiert den Basis-Pfad für Spiel-Dateien
     * 
     * ZWECK:
     * Stellt sicher, dass der basePath einheitlich formatiert ist:
     * - Leerzeichen werden entfernt
     * - Trailing Slashes werden entfernt
     * - Fallback auf 'games' wenn leer
     * 
     * @private
     * @param {string} basePath - Der zu normalisierende Pfad
     * @returns {string} Normalisierter Pfad ohne trailing slash
     * 
     * @example
     * _normalizeBasePath('games/') // => 'games'
     * _normalizeBasePath('  ') // => 'games'
     * _normalizeBasePath('my-games') // => 'my-games'
     */
    function _normalizeBasePath(basePath) {
        const p = (basePath || 'games').trim();
        if (!p) return 'games';
        return p.endsWith('/') ? p.slice(0, -1) : p;
    }

    /**
     * Lädt eine JSON-Datei aus Google Drive
     * 
     * FUNKTIONSWEISE:
     * ---------------
     * 1. Baut die Drive API URL mit der fileId zusammen
     * 2. Verwendet 'alt=media' um den Dateiinhalt direkt zu erhalten
     * 3. Führt einen fetch-Request aus
     * 4. Validiert die Antwort
     * 5. Parst und gibt das JSON-Objekt zurück
     * 
     * FEHLERBEHANDLUNG:
     * -----------------
     * - HTTP-Fehler werden abgefangen und mit aussagekräftigen Meldungen versehen
     * - Ungültiges JSON wird erkannt und abgelehnt
     * 
     * @private
     * @async
     * @param {string} fileId - Google Drive File-ID
     * @param {string} apiKey - Google Drive API-Schlüssel
     * @param {string} driveFilesEndpoint - Drive API Endpoint URL
     * @returns {Promise<Object>} Das geparste JSON-Objekt aus Drive
     * @throws {Error} Bei HTTP-Fehlern oder ungültigem JSON
     * 
     * @example
     * const json = await _fetchDriveJson(
     *     '1abc...xyz',
     *     'AIza...123',
     *     'https://www.googleapis.com/drive/v3/files'
     * );
     */
    async function _fetchDriveJson(fileId, apiKey, driveFilesEndpoint) {
        // API-Parameter zusammenstellen
        // 'alt=media' gibt den Dateiinhalt direkt zurück (nicht Metadaten)
        const params = new URLSearchParams({ key: apiKey, alt: 'media' });
        const url = `${driveFilesEndpoint}/${encodeURIComponent(fileId)}?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) {
            // Versuche, detaillierte Fehlermeldung aus der API-Antwort zu extrahieren
            let msg = res.statusText;
            try {
                const errData = await res.json();
                msg = (errData && errData.error && errData.error.message) ? errData.error.message : msg;
            } catch (_) { /* ignore - Fehler beim Parsen der Fehlerantwort */ }
            throw new Error(`${res.status} ${msg}`);
        }

        // JSON parsen und validieren
        const json = await res.json();
        if (!json || typeof json !== 'object') {
            throw new Error('Ungültiges JSON: leer oder kein Objekt.');
        }
        return json;
    }

    /**
     * Ermittelt den HTML-Dateipfad basierend auf dem Spieltyp
     * 
     * SPIELTYP-MAPPING:
     * -----------------
     * Diese Funktion bildet die Brücke zwischen dem abstrakten 'game_type'
     * im JSON und der konkreten HTML-Datei, die geladen werden soll.
     * 
     * NEUE SPIELTYPEN HINZUFÜGEN:
     * ---------------------------
     * Um einen neuen Spieltyp zu unterstützen:
     * 1. Erstelle die HTML-Datei im games-Ordner (z.B. 'quiz.html')
     * 2. Füge hier einen neuen if-Block hinzu:
     *    if (gameType === 'quiz') return `${base}/quiz.html`;
     * 3. Das Spiel muss game_base.js inkludieren, um das Payload zu laden
     * 
     * @private
     * @param {string} gameType - Der Spieltyp aus dem JSON (z.B. 'escape_game')
     * @param {string} basePath - Der Basis-Pfad für Spiel-Dateien
     * @returns {string} Vollständiger Pfad zur Spiel-HTML-Datei
     * @throws {Error} Wenn der Spieltyp unbekannt ist
     * 
     * @example
     * _resolveGameHtmlByType('escape_game', 'games') // => 'games/Escape-Game.html'
     */
    function _resolveGameHtmlByType(gameType, basePath) {
        const base = _normalizeBasePath(basePath);

        // Mapping: game_type => HTML-Datei
        // WICHTIG: Hier neue Spieltypen hinzufügen!
        if (gameType === 'escape_game') return `${base}/Escape-Game.html`;
        if (gameType === 'matching_puzzle') return `${base}/matching_puzzle.html`;
        if (gameType === 'wer_bin_ich') return `${base}/wer_bin_ich.html`;
        if (gameType === 'quick_quiz') return `${base}/quick_quiz.html`;

        // Weitere Spieltypen können hier hinzugefügt werden:
        // if (gameType === 'sortier_spiel') return `${base}/sortier_spiel.html`;

        // Unbekannter Spieltyp -> Fehler werfen
        throw new Error(`Unbekannter game_type: "${String(gameType)}"`);
    }

    /**
     * Speichert das Spiel-Payload im sessionStorage
     * 
     * ZWECK:
     * ------
     * Das Payload wird in sessionStorage gespeichert, damit das Spiel im iframe
     * darauf zugreifen kann. SessionStorage ist ideal, da:
     * - Es pro Browser-Tab isoliert ist
     * - Es bei Tab-Close automatisch gelöscht wird
     * - Es vom iframe gleicher Origin gelesen werden kann
     * 
     * STORAGE-KEY:
     * ------------
     * Der Key hat das Format: 'game_payload_' + fileId
     * Dies ermöglicht es, mehrere Spiele parallel zu laden.
     * 
     * FEHLERBEHANDLUNG:
     * -----------------
     * Wenn sessionStorage voll oder blockiert ist, wird nur eine Warnung ausgegeben.
     * Das Spiel könnte dann als Fallback das Payload direkt von Drive laden.
     * 
     * @private
     * @param {string} fileId - Die Drive File-ID (wird Teil des Storage-Keys)
     * @param {Object} payload - Das zu speichernde JSON-Objekt
     * 
     * @example
     * _storePayload('1abc...xyz', { game_type: 'escape_game', ... });
     * // Speichert unter: 'game_payload_1abc...xyz'
     */
    function _storePayload(fileId, payload) {
        try {
            // JSON in String konvertieren und speichern
            sessionStorage.setItem(JSON_SESSION_PREFIX + fileId, JSON.stringify(payload));
        } catch (e) {
            // sessionStorage kann voll/gesperrt sein
            // Dann läuft Drive-Fallback in game_base.js
            console.warn('Konnte Payload nicht in sessionStorage speichern:', e);
        }
    }

    /**
     * Wendet das aktuelle Theme auf das Spiel-iframe an
     * 
     * THEME-SYNCHRONISATION:
     * ----------------------
     * Wenn der Benutzer das Theme in der Hauptanwendung wechselt,
     * soll das Spiel im iframe das gleiche Theme verwenden.
     * 
     * FUNKTIONSWEISE:
     * ---------------
     * 1. Prüft, ob das Haupt-Document die Klasse 'theme-light' hat
     * 2. Setzt diese Klasse im iframe-Document entsprechend
     * 3. Das Spiel-CSS reagiert auf diese Klasse mit CSS-Variablen
     * 
     * FEHLERBEHANDLUNG:
     * -----------------
     * Cross-Origin-iframes können nicht manipuliert werden.
     * Da unsere Spiele gleicher Origin sind, sollte dies funktionieren.
     * 
     * @private
     * @param {HTMLIFrameElement} iframe - Das iframe-Element
     * 
     * @example
     * iframe.onload = () => _applyThemeToIframe(iframe);
     */
    function _applyThemeToIframe(iframe) {
        // Theme vom Haupt-Document lesen
        const isLight = document.documentElement.classList.contains('theme-light');
        try {
            const doc = iframe.contentDocument;
            if (!doc) return; // iframe noch nicht fertig geladen

            // Theme auf iframe anwenden
            if (isLight) doc.documentElement.classList.add('theme-light');
            else doc.documentElement.classList.remove('theme-light');
        } catch (_) {
            // Cross-origin oder andere Fehler ignorieren
        }
    }

    /**
     * Hauptfunktion: Lädt ein Spiel aus Google Drive
     * 
     * ABLAUF:
     * -------
     * 1. Validiert alle erforderlichen Parameter
     * 2. Lädt das JSON-Payload von Google Drive
     * 3. Extrahiert den game_type aus dem JSON
     * 4. Speichert das Payload in sessionStorage
     * 5. Ermittelt die passende HTML-Datei für den Spieltyp
     * 6. Erstellt ein iframe-Element
     * 7. Lädt das Spiel im iframe mit fileId als URL-Parameter
     * 8. Wendet das Theme auf das iframe an
     * 
     * URL-PARAMETER:
     * --------------
     * Das Spiel erhält die fileId als URL-Parameter (?fileId=...).
     * Das Spiel kann damit:
     * - Das Payload aus sessionStorage laden
     * - Bei Bedarf zusätzliche Ressourcen von Drive nachladen
     * 
     * @public
     * @async
     * @param {Object} options - Konfigurationsobjekt
     * @param {string} options.fileId - Google Drive File-ID der JSON-Datei
     * @param {string} options.apiKey - Google Drive API-Schlüssel
     * @param {string} options.driveFilesEndpoint - Drive API Endpoint
     * @param {HTMLElement} options.containerEl - Container für das iframe
     * @param {string} [options.basePath='games'] - Basis-Pfad für Spiel-Dateien
     * @param {string} [options.iframeClassName='game-iframe'] - CSS-Klasse für iframe
     * @returns {Promise<Object>} Objekt mit gameType, gameHtml, iframe, payload
     * @throws {Error} Bei fehlenden Parametern oder Fehlern beim Laden
     * 
     * @example
     * const result = await window.DriveInterpreter.loadGame({
     *     fileId: '1abc...xyz',
     *     apiKey: 'AIza...123',
     *     driveFilesEndpoint: 'https://www.googleapis.com/drive/v3/files',
     *     containerEl: document.getElementById('game-container'),
     *     basePath: 'games',
     *     iframeClassName: 'game-iframe'
     * });
     * console.log('Spiel geladen:', result.gameType);
     */
    async function loadGame(options) {
        // Parameter-Normalisierung und Validierung
        const opts = options || {};
        const fileId = String(opts.fileId || '');
        const apiKey = String(opts.apiKey || '');
        const driveFilesEndpoint = String(opts.driveFilesEndpoint || '');
        const containerEl = opts.containerEl;
        const basePath = opts.basePath || 'games';

        // Pflichtparameter prüfen
        if (!fileId) throw new Error('fileId fehlt.');
        if (!apiKey) throw new Error('API-Key fehlt.');
        if (!driveFilesEndpoint) throw new Error('driveFilesEndpoint fehlt.');
        if (!containerEl) throw new Error('containerEl fehlt.');

        // 1. JSON-Payload von Drive laden
        const payload = await _fetchDriveJson(fileId, apiKey, driveFilesEndpoint);

        // 2. Spieltyp extrahieren
        // Unterstützt beide Schreibweisen: game_type und gameType
        const gameType = payload.game_type || payload.gameType || null;
        if (!gameType) throw new Error('Im JSON fehlt das Feld "game_type".');

        // 3. Payload für das Spiel speichern
        _storePayload(fileId, payload);

        // 4. Passende HTML-Datei für den Spieltyp ermitteln
        const gameHtml = _resolveGameHtmlByType(gameType, basePath);

        // 5. Container leeren und iframe erstellen
        containerEl.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = opts.iframeClassName || 'game-iframe';

        // fileId als URL-Parameter übergeben, damit das Spiel weiß, welches Payload es laden soll
        iframe.src = `${gameHtml}?fileId=${encodeURIComponent(fileId)}`;
        containerEl.appendChild(iframe);

        // 6. Theme synchronisieren, sobald iframe geladen ist
        iframe.onload = () => _applyThemeToIframe(iframe);

        // 7. Rückgabe mit allen relevanten Informationen
        return { gameType, gameHtml, iframe, payload };
    }

    /**
     * Öffentliche API des DriveInterpreter-Moduls
     * 
     * VERWENDUNG:
     * -----------
     * window.DriveInterpreter.loadGame({ ... });
     * 
     * VERFÜGBARE METHODEN:
     * --------------------
     * - loadGame(options): Lädt und startet ein Spiel aus Google Drive
     */
    window.DriveInterpreter = {
        loadGame
    };
})();
