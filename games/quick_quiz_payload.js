/**
 * ============================================================================
 * quick_quiz_payload.js - JSON-zu-DOM Mapping für Quick-Quiz
 * ============================================================================
 * 
 * ZWECK:
 * Interpretiert das JSON-Payload und wendet es auf das Quiz an.
 * 
 * JSON-FORMAT:
 * {
 *   "game_type": "quick_quiz",
 *   "title": "Quick Quiz - Thema",
 *   "answerLabels": ["Option 1", "Option 2", ...],
 *   "questions": [{text: "...", correct: "..."}],
 *   "timePerQuestionSeconds": 12
 * }
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wendet das JSON-Payload auf das Quick-Quiz an
     * 
     * @param {QuickQuiz} game - Die QuickQuiz-Instanz
     * @param {Object} data - Das JSON-Payload
     */
    function applyPayloadToGame(game, data) {
        // Answer Labels laden
        if (Array.isArray(data.answerLabels)) {
            game.answerLabels = data.answerLabels;
        }

        // Questions laden
        if (Array.isArray(data.questions)) {
            game.questions = data.questions;
        }

        // Zeit pro Frage
        if (typeof data.timePerQuestionSeconds === 'number') {
            game.timePerQuestion = data.timePerQuestionSeconds;
        }

        // Titel setzen
        if (data.title && typeof data.title === 'string') {
            const titleEl = document.querySelector('.game-title');
            if (titleEl) {
                titleEl.textContent = data.title;
            }
            document.title = data.title + ' – Quick Quiz';
        }

        // Intro-Text (optional)
        if (data.introText && typeof data.introText === 'string') {
            const questionTextEl = document.getElementById('question-text');
            if (questionTextEl) {
                questionTextEl.textContent = data.introText;
            }
        }

        // Subline-Text (optional)
        if (data.sublineText && typeof data.sublineText === 'string') {
            const sublineEl = document.getElementById('subline');
            if (sublineEl) {
                sublineEl.textContent = data.sublineText;
            }
        }
    }

    /**
     * Öffentliche API
     */
    window.QuickQuizPayload = {
        applyPayloadToGame
    };
})();
