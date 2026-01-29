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

    function _normalizeBasePath(basePath) {
        const p = (basePath || 'games').trim();
        if (!p) return 'games';
        return p.endsWith('/') ? p.slice(0, -1) : p;
    }

    async function _fetchDriveJson(fileId, apiKey, driveFilesEndpoint) {
        const params = new URLSearchParams({ key: apiKey, alt: 'media' });
        const url = `${driveFilesEndpoint}/${encodeURIComponent(fileId)}?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) {
            let msg = res.statusText;
            try {
                const errData = await res.json();
                msg = (errData && errData.error && errData.error.message) ? errData.error.message : msg;
            } catch (_) { }
            throw new Error(`${res.status} ${msg}`);
        }

        const json = await res.json();
        if (!json || typeof json !== 'object') {
            throw new Error('Ungültiges JSON: leer oder kein Objekt.');
        }
        return json;
    }

    function _resolveGameHtmlByType(gameType, basePath) {
        const base = _normalizeBasePath(basePath);
        const type = String(gameType).trim();

        console.log(`[DriveInterpreter] Resolving game type: "${type}"`);

        if (type === 'escape_game') return `${base}/Escape-Game.html`;
        if (type === 'matching_puzzle' || type === 'matching-puzzle') return `${base}/matching_puzzle.html`;
        if (type === 'wer_bin_ich' || type === 'wer-bin-ich') return `${base}/wer_bin_ich.html`;
        if (type === 'quick_quiz' || type === 'quick-quiz') return `${base}/quick_quiz.html`;
        if (type === 'what_and_why' || type === 'what-and-why') return `${base}/what_and_why.html`;
        if (type === 'sortier_spiel' || type === 'sortier-spiel') return `${base}/sortier_spiel.html`;

        throw new Error(`Unbekannter game_type: "${type}"`);
    }

    function _storePayload(fileId, payload) {
        try {
            sessionStorage.setItem(JSON_SESSION_PREFIX + fileId, JSON.stringify(payload));
        } catch (e) {
            console.warn('Konnte Payload nicht in sessionStorage speichern:', e);
        }
    }

    function _readStoredPayload(fileId) {
        try {
            const raw = sessionStorage.getItem(JSON_SESSION_PREFIX + fileId);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function _applyThemeToIframe(iframe) {
        const isLight = document.documentElement.classList.contains('theme-light');
        try {
            const doc = iframe.contentDocument;
            if (!doc) return;

            if (isLight) doc.documentElement.classList.add('theme-light');
            else doc.documentElement.classList.remove('theme-light');
        } catch (_) { }
    }

    async function loadGame(options) {
        const opts = options || {};
        const fileId = String(opts.fileId || '');
        const apiKey = String(opts.apiKey || '');
        const driveFilesEndpoint = String(opts.driveFilesEndpoint || '');
        const containerEl = opts.containerEl;
        const basePath = opts.basePath || 'games';

        if (!fileId) throw new Error('fileId fehlt.');
        if (!apiKey) throw new Error('API-Key fehlt.');
        if (!driveFilesEndpoint) throw new Error('driveFilesEndpoint fehlt.');
        if (!containerEl) throw new Error('containerEl fehlt.');

        // 1) Cache zuerst (kein Drive)
        let payload = _readStoredPayload(fileId);

        // 2) Nur wenn nicht da: von Drive holen
        if (!payload) {
            payload = await _fetchDriveJson(fileId, apiKey, driveFilesEndpoint);
            _storePayload(fileId, payload);
        }

        const gameType = payload.game_type || payload.gameType || null;
        if (!gameType) throw new Error('Im JSON fehlt das Feld "game_type".');

        const gameHtml = _resolveGameHtmlByType(gameType, basePath);

        containerEl.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = opts.iframeClassName || 'game-iframe';

        iframe.src = `${gameHtml}?fileId=${encodeURIComponent(fileId)}`;
        containerEl.appendChild(iframe);

        iframe.onload = () => _applyThemeToIframe(iframe);

        return { gameType, gameHtml, iframe, payload };
    }

    window.DriveInterpreter = {
        loadGame
    };
})();
