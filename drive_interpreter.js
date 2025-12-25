/* drive_interpreter.js
 *
 * Lädt JSON-Payload aus Google Drive, speichert es in sessionStorage
 * und entscheidet anhand von json.game_type, welches Spiel in ein Iframe geladen wird.
 *
 * Erwartung: game_base.js liest payload aus sessionStorage:
 *   key = 'game_payload_' + fileId
 */

(function () {
    'use strict';

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
            } catch (_) { /* ignore */ }
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

        // Aktuell nur Escape-Game unterstützt
        if (gameType === 'escape_game') return `${base}/Escape-Game.html`;

        throw new Error(`Unbekannter game_type: "${String(gameType)}"`);
    }

    function _storePayload(fileId, payload) {
        try {
            sessionStorage.setItem(JSON_SESSION_PREFIX + fileId, JSON.stringify(payload));
        } catch (e) {
            // sessionStorage kann voll/gesperrt sein – dann läuft Drive-Fallback in game_base.js
            console.warn('Konnte Payload nicht in sessionStorage speichern:', e);
        }
    }

    function _applyThemeToIframe(iframe) {
        const isLight = document.documentElement.classList.contains('theme-light');
        try {
            const doc = iframe.contentDocument;
            if (!doc) return;
            if (isLight) doc.documentElement.classList.add('theme-light');
            else doc.documentElement.classList.remove('theme-light');
        } catch (_) { /* ignore */ }
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

        const payload = await _fetchDriveJson(fileId, apiKey, driveFilesEndpoint);

        const gameType = payload.game_type || payload.gameType || null;
        if (!gameType) throw new Error('Im JSON fehlt das Feld "game_type".');

        _storePayload(fileId, payload);

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
