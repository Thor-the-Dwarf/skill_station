/**
 * ============================================================================
 * matching_puzzle_payload.js - JSON-zu-DOM Mapping für Matching Puzzle
 * ============================================================================
 * 
 * ZWECK:
 * Interpretiert das JSON-Payload und wendet es auf das Spiel an.
 * Ähnlich wie Escape-Game_payload.js, aber für Matching-Puzzle.
 * 
 * VERWENDUNG:
 * Wird automatisch von game_base.js geladen, wenn das Spiel startet.
 * Die Funktion applyPayloadToGame() wird mit dem Game-Objekt und den
 * JSON-Daten aufgerufen.
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wendet das JSON-Payload auf das Matching-Puzzle-Spiel an
     * 
     * @param {MatchingPuzzle} game - Die MatchingPuzzle-Instanz
     * @param {Object} data - Das JSON-Payload aus Drive
     */
    function applyPayloadToGame(game, data) {
        // Sets aus JSON lesen und an Spiel übergeben
        if (Array.isArray(data.sets)) {
            game.sets = data.sets;
            game.totalSets = data.sets.length;
        }

        // Titel setzen
        if (data.title && typeof data.title === 'string') {
            const titleEl = document.querySelector('.game-title');
            if (titleEl) {
                titleEl.textContent = data.title;
            }
            // Auch Browser-Tab-Titel
            document.title = data.title + ' – Matching-Puzzle';
        }

        // Spalten-Titel anpassen (optional)
        if (data.columnTitles) {
            if (data.columnTitles.column1) {
                const col1Title = document.querySelector('#col-names')?.previousElementSibling;
                if (col1Title && col1Title.classList.contains('column-title')) {
                    col1Title.textContent = '1 · ' + data.columnTitles.column1;
                }
            }
            if (data.columnTitles.column2) {
                const col2Title = document.querySelector('#col-descriptions')?.previousElementSibling;
                if (col2Title && col2Title.classList.contains('column-title')) {
                    col2Title.textContent = '2 · ' + data.columnTitles.column2;
                }
            }
            if (data.columnTitles.column3) {
                const col3Title = document.querySelector('#col-examples')?.previousElementSibling;
                if (col3Title && col3Title.classList.contains('column-title')) {
                    col3Title.textContent = '3 · ' + data.columnTitles.column3;
                }
            }
        }

        // Spalten-Hints anpassen (optional)
        if (data.columnHints) {
            if (data.columnHints.column1) {
                const col1Hint = document.querySelectorAll('.column-hint')[0];
                if (col1Hint) col1Hint.textContent = data.columnHints.column1;
            }
            if (data.columnHints.column2) {
                const col2Hint = document.querySelectorAll('.column-hint')[1];
                if (col2Hint) col2Hint.textContent = data.columnHints.column2;
            }
            if (data.columnHints.column3) {
                const col3Hint = document.querySelectorAll('.column-hint')[2];
                if (col3Hint) col3Hint.textContent = data.columnHints.column3;
            }
        }

        // Untertitel anpassen (optional)
        if (data.subtitle && typeof data.subtitle === 'string') {
            const subtitleEl = document.querySelector('.subtitle');
            if (subtitleEl) {
                subtitleEl.textContent = data.subtitle;
            }
        }
    }

    /**
     * Öffentliche API
     */
    window.MatchingPuzzlePayload = {
        applyPayloadToGame
    };
})();
