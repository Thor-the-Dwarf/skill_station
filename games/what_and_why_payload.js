/**
 * ============================================================================
 * what_and_why_payload.js - JSON-zu-DOM Mapping für What & Why
 * ============================================================================
 * 
 * ZWECK:
 * Interpretiert das JSON-Payload für das zweistufige What & Why Spiel.
 * 
 * JSON-FORMAT:
 * {
 *   "game_type": "what_and_why",
 *   "title": "...",
 *   "cases": [{
 *     "id": "...",
 *     "profile": "Fallbeschreibung...",
 *     "tags": ["Tag1", "Tag2"],
 *     "options": [{
 *       "id": "...",
 *       "label": "What-Option",
 *       "isCorrect": true/false,
 *       "whys": [{
 *         "id": "...",
 *         "text": "Why-Begründung",
 *         "correct": true/false
 *       }]
 *     }],
 *     "solution": "Lösungshinweis..."
 *   }]
 * }
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wendet das JSON-Payload auf das What & Why Spiel an
     * 
     * @param {WhatAndWhy} game - Die WhatAndWhy-Instanz
     * @param {Object} data - Das JSON-Payload
     */
    function applyPayloadToGame(game, data) {
        // Cases laden
        if (Array.isArray(data.cases)) {
            game.cases = data.cases;
        }

        // Titel setzen
        if (data.title && typeof data.title === 'string') {
            const titleEl = document.querySelector('.title-block h1');
            if (titleEl) {
                titleEl.textContent = data.title;
            }
            document.title = data.title + ' – What & Why';
        }

        // Beschreibungstext (optional)
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
    window.WhatAndWhyPayload = {
        applyPayloadToGame
    };
})();
