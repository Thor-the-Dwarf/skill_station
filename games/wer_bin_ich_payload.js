/**
 * ============================================================================
 * wer_bin_ich_payload.js - JSON-zu-DOM Mapping für Wer-bin-ich?
 * ============================================================================
 * 
 * ZWECK:
 * Interpretiert das JSON-Payload und wendet es auf das Spiel an.
 * 
 * JSON-FORMAT:
 * {
 *   "game_type": "wer_bin_ich",
 *   "title": "Unternehmensformen-Edition",
 *   "legalForms": [...],  // Array von Rechtsformen mit Attributen
 *   "questions": [...]     // Array von Fragen mit evaluate-Logic
 * }
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wendet das JSON-Payload auf das Wer-bin-ich-Spiel an
     * 
     * @param {WerBinIch} game - Die WerBinIch-Instanz
     * @param {Object} data - Das JSON-Payload
     */
    function applyPayloadToGame(game, data) {
        // Legal Forms aus JSON lesen
        if (Array.isArray(data.legalForms)) {
            game.legalForms = data.legalForms;
        }

        // Questions aus JSON lesen
        if (Array.isArray(data.questions)) {
            game.questions = data.questions;
        }

        // Titel setzen
        if (data.title && typeof data.title === 'string') {
            const titleEl = document.querySelector('.game-title');
            if (titleEl) {
                titleEl.textContent = data.title;
            }
            document.title = data.title + ' – Wer bin ich?';
        }

        // Pool-Liste aktualisieren (optional)
        if (data.poolListHtml && typeof data.poolListHtml === 'string') {
            const poolList = document.querySelector('.info-list');
            if (poolList) {
                poolList.innerHTML = data.poolListHtml;
            }
        } else if (Array.isArray(data.legalForms)) {
            // Automatisch aus legalForms generieren
            const poolList = document.querySelector('.info-list');
            if (poolList) {
                poolList.innerHTML = data.legalForms
                    .map(form => `<li>${form.name}</li>`)
                    .join('');
            }
        }

        // Secret Hint Text (optional)
        if (data.secretHintText) {
            const hintEl = document.querySelector('.secret-hint');
            if (hintEl) {
                const secretNameSpan = hintEl.querySelector('.secret-name');
                const originalSecretName = secretNameSpan ? secretNameSpan.textContent : 'Rechtsform';
                hintEl.innerHTML = data.secretHintText.replace(
                    '{SECRET_NAME}',
                    `<span class="secret-name">${originalSecretName}</span>`
                );
            }
        }
    }

    /**
     * Öffentliche API
     */
    window.WerBinIchPayload = {
        applyPayloadToGame
    };
})();
