/**
 * ============================================================================
 * drive_interpreter.js - Google Drive zu Spiel-Interpreter
 * ============================================================================
 *
 * Lädt JSON aus Drive, erkennt game_type (oder leitet ihn ab) und lädt das
 * passende Spiel-HTML im iframe. Payload wird in sessionStorage gespeichert:
 * Key: 'game_payload_' + fileId
 */

(function () {
    'use strict';

    const JSON_SESSION_PREFIX = 'game_payload_';

    function _normalizeBasePath(basePath) {
        const p = (basePath || 'games').trim();
        if (!p) return 'games';
        return p.endsWith('/') ? p.slice(0, -1) : p;
    }

    function _normalizeGameType(gameType) {
        return String(gameType || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_');
    }

    function _extractGameType(payload) {
        if (!payload || typeof payload !== 'object') return '';
        return payload.game_type || payload.gameType || '';
    }

    function _inferGameType(payload) {
        if (!payload || typeof payload !== 'object') return '';

        // escape_game: sections[]
        if (Array.isArray(payload.sections)) return 'escape_game';

        // quick_quiz: questions[] + answerLabels[]
        if (Array.isArray(payload.questions) && Array.isArray(payload.answerLabels)) return 'quick_quiz';

        // wer_bin_ich: legalForms[]
        if (Array.isArray(payload.legalForms)) return 'wer_bin_ich';

        // what_and_why: cases[]
        if (Array.isArray(payload.cases)) return 'what_and_why';

        // matching_puzzle: sets[] + columnTitles
        if (Array.isArray(payload.sets) && payload.columnTitles && typeof payload.columnTitles === 'object') return 'matching_puzzle';

        return '';
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
        const type = _normalizeGameType(gameType);

        console.log(`[DriveInterpreter] Resolving game type: "${type}"`);

        if (type === 'escape_game' || type === 'escape' || type === 'escape_room') return `${base}/Escape-Game.html`;
        if (type === 'matching_puzzle' || type === 'matching') return `${base}/matching_puzzle.html`;
        if (type === 'wer_bin_ich' || type === 'werbinich') return `${base}/wer_bin_ich.html`;
        if (type === 'quick_quiz' || type === 'quickquiz') return `${base}/quick_quiz.html`;
        if (type === 'what_and_why' || type === 'whatwhy') return `${base}/what_and_why.html`;
        if (type === 'sortier_spiel' || type === 'sortierspiel') return `${base}/sortier_spiel.html`;

        throw new Error(`Unbekannter game_type: "${String(gameType || '').trim()}"`);
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

    function _dropStoredPayload(fileId) {
        try {
            sessionStorage.removeItem(JSON_SESSION_PREFIX + fileId);
        } catch (_) { }
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

        // 1) sessionStorage Cache
        let payload = _readStoredPayload(fileId);

        // Cache wegwerfen, wenn game_type leer/unknown/unmappbar
        if (payload) {
            const t = _extractGameType(payload);
            const norm = _normalizeGameType(t);
            if (!norm || norm === 'unknown') {
                _dropStoredPayload(fileId);
                payload = null;
            } else {
                try {
                    _resolveGameHtmlByType(t, basePath);
                } catch (_) {
                    _dropStoredPayload(fileId);
                    payload = null;
                }
            }
        }

        // 2) Drive fetch wenn nötig
        if (!payload) {
            payload = await _fetchDriveJson(fileId, apiKey, driveFilesEndpoint);
            _storePayload(fileId, payload);
        }

        // 3) game_type prüfen / ableiten
        let gameType = _extractGameType(payload);
        let normType = _normalizeGameType(gameType);

        if (!normType || normType === 'unknown') {
            const inferred = _inferGameType(payload);
            if (inferred) {
                payload.game_type = inferred; // wichtig: damit GameBase expectedGameType passt
                gameType = inferred;
                normType = _normalizeGameType(inferred);
                _storePayload(fileId, payload);
            }
        }

        if (!normType || normType === 'unknown') {
            throw new Error('Im JSON fehlt ein gültiger "game_type" (und konnte nicht abgeleitet werden).');
        }

        const gameHtml = _resolveGameHtmlByType(gameType, basePath);

        containerEl.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = opts.iframeClassName || 'game-iframe';
        iframe.src = `${gameHtml}?fileId=${encodeURIComponent(fileId)}`;
        containerEl.appendChild(iframe);

        iframe.onload = () => _applyThemeToIframe(iframe);

        return { gameType: normType, gameHtml, iframe, payload };
    }

    window.DriveInterpreter = { loadGame };
})();
