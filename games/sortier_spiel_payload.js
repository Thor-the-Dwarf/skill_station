/**
 * ============================================================================
 * sortier_spiel_payload.js - JSON-zu-DOM Mapping für Sortier-Spiel
 * ============================================================================
 * 
 * ZWECK:
 * Interpretiert das JSON-Payload für das Drag & Drop Sortier-Spiel.
 * 
 * JSON-FORMAT:
 * {
 *   "game_type": "sortier_spiel",
 *   "title": "...",
 *   "columns": [{
 *     "id": "gmbh",
 *     "title": "GmbH",
 *     "subtitle": "Kapitalges."
 *   }],
 *   "cards": [{
 *     "id": "card1",
 *     "text": "Eigenschaft...",
 *     "correctForms": ["gmbh", "ug"]
 *   }]
 * }
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wendet das JSON-Payload auf das Sortier-Spiel an
     * 
     * @param {SortierSpiel} game - Die SortierSpiel-Instanz
     * @param {Object} data - Das JSON-Payload
     */
    function applyPayloadToGame(game, data) {
        // Columns laden
        if (Array.isArray(data.columns)) {
            game.columns = data.columns;
        }

        // Cards laden
        if (Array.isArray(data.cards)) {
            game.cards = data.cards;
        }

        // Titel setzen
        if (data.title && typeof data.title === 'string') {
            const titleEl = document.querySelector('.title-block h1');
            if (titleEl) {
                titleEl.textContent = data.title;
            }
            document.title = data.title + ' – Sortier-Spiel';
        }

        // Beschreibung (optional)
        if (data.description && typeof data.description === 'string') {
            const descEl = document.querySelector('.title-block p');
            if (descEl) {
                descEl.textContent = data.description;
            }
        }
    }

    /**
     * Öffentliche API
     */
    window.SortierSpielPayload = {
        applyPayloadToGame
    };
})();
