/**
 * ============================================================================
 * wer_bin_ich.js - Wer-bin-ich? Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Hauptlogik für das "Wer bin ich?"-Ratespiel. Erweitert GameBase.
 * 
 * SPIELPRINZIP:
 * - System wählt geheime Rechtsform
 * - Spieler stellt Ja/Nein-Fragen aus Katalog
 * - System antwortet basierend auf Attributen
 * - Historie der Fragen wird angezeigt
 * - Spieler rät die Rechtsform
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Wer-bin-ich Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class WerBinIch extends GameBase {
        constructor() {
            super({
                expectedGameType: 'wer_bin_ich',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.legalForms = [];     // Array von {id, name, attributes: {...}}
            this.questions = [];      // Array von {id, text, hotkey, attributeKey}

            // Spiel-State
            this.secretForm = null;   // Aktuell geheime Rechtsform
            this.questionCount = 0;   // Anzahl gestellter Fragen
            this.gameOver = false;    // Spiel gewonnen?

            // DOM-Referenzen
            this.questionListEl = null;
            this.questionCountEl = null;
            this.answerTextEl = null;
            this.historyListEl = null;
            this.answerButtons = null;
            this.newGameBtn = null;
            this.guessInput = null;
            this.guessBtn = null;
            this.guessFeedbackEl = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         * @param {Object} data - Das JSON-Payload
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.questionListEl = document.getElementById('question-list');
            this.questionCountEl = document.getElementById('question-count');
            this.answerTextEl = document.getElementById('answer-text');
            this.historyListEl = document.getElementById('history-list');
            this.answerButtons = document.querySelectorAll('.answer-btn');
            this.newGameBtn = document.getElementById('new-game-btn');
            this.guessInput = document.getElementById('guess-input');
            this.guessBtn = document.getElementById('guess-btn');
            this.guessFeedbackEl = document.getElementById('guess-feedback');

            // Payload-Daten anwenden
            if (window.WerBinIchPayload) {
                window.WerBinIchPayload.applyPayloadToGame(this, data);
            }

            // Event-Listener
            this.newGameBtn.addEventListener('click', () => this.startNewGame());
            this.guessBtn.addEventListener('click', () => this.handleGuess());
            this.guessInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.handleGuess();
                }
            });

            // Spiel initialisieren
            this.initQuestionButtons();
            this.startNewGame();
        }

        /**
         * Wählt zufällige Rechtsform aus
         * @returns {Object} Zufällige Rechtsform
         */
        pickRandomForm() {
            const idx = Math.floor(Math.random() * this.legalForms.length);
            return this.legalForms[idx];
        }

        /**
         * Setzt Antwort-Buttons zurück
         */
        resetAnswerButtons() {
            this.answerButtons.forEach(btn => btn.classList.remove('active'));
        }

        /**
         * Aktiviert Antwort-Button (Ja/Nein)
         * @param {string} type - 'yes' oder 'no'
         */
        setActiveAnswerButton(type) {
            this.resetAnswerButtons();
            const btn = document.querySelector(`.answer-btn[data-type="${type}"]`);
            if (btn) {
                btn.classList.add('active');
            }
        }

        /**
         * Aktualisiert Fragen-Zähler
         */
        updateQuestionCount() {
            this.questionCountEl.textContent = String(this.questionCount);
        }

        /**
         * Fügt Eintrag zur Historie hinzu
         * @param {Object} question - Die gestellte Frage
         * @param {boolean} answerIsYes - Ob Antwort "Ja" ist
         */
        addHistoryEntry(question, answerIsYes) {
            const li = document.createElement('li');
            li.className = 'history-item';

            const qSpan = document.createElement('span');
            qSpan.className = 'history-question';
            qSpan.textContent = question.text;

            const pill = document.createElement('span');
            pill.className = 'pill ' + (answerIsYes ? 'pill-yes' : 'pill-no');
            pill.textContent = answerIsYes ? 'Ja' : 'Nein';

            li.appendChild(qSpan);
            li.appendChild(pill);

            // Neueste Frage oben
            this.historyListEl.prepend(li);
        }

        /**
         * Stellt eine Frage und zeigt Antwort
         * @param {Object} question - Die Frage
         * @param {HTMLElement} [btnEl] - Der Button (optional)
         */
        askQuestion(question, btnEl) {
            if (!this.secretForm || this.gameOver) {
                return;
            }

            // Button ausblenden
            if (btnEl) {
                btnEl.classList.add('used');
            }

            this.questionCount++;
            this.updateQuestionCount();

            // Antwort evaluieren basierend auf attributeKey
            const answerIsYes = this.evaluateQuestion(question, this.secretForm);

            // Antwort-Button aktivieren
            this.setActiveAnswerButton(answerIsYes ? 'yes' : 'no');

            // Antwort-Text setzen
            this.answerTextEl.textContent =
                (answerIsYes ? 'Ja' : 'Nein') + ' – ' + question.text;

            // Zur Historie hinzufügen
            this.addHistoryEntry(question, answerIsYes);
        }

        /**
         * Evaluiert eine Frage gegen eine Rechtsform
         * @param {Object} question - Die Frage mit attributeKey
         * @param {Object} form - Die Rechtsform mit attributes
         * @returns {boolean} Ob Antwort "Ja" ist
         */
        evaluateQuestion(question, form) {
            // Für JSON-kompatibilität: attributeKey direkt prüfen
            if (question.attributeKey && form.attributes) {
                return !!form.attributes[question.attributeKey];
            }

            // Fallback: evaluate-Funktion (für hardcoded Data)
            if (typeof question.evaluate === 'function') {
                return !!question.evaluate(form);
            }

            return false;
        }

        /**
         * Initialisiert Fragen-Buttons
         */
        initQuestionButtons() {
            this.questionListEl.innerHTML = '';

            this.questions.forEach(q => {
                const btn = document.createElement('button');
                btn.className = 'question-btn';
                btn.type = 'button';

                const spanText = document.createElement('span');
                spanText.className = 'text';
                spanText.textContent = q.text;

                const spanHotkey = document.createElement('span');
                spanHotkey.className = 'hotkey';
                spanHotkey.textContent = 'Frage #' + (q.hotkey || '');

                btn.appendChild(spanText);
                btn.appendChild(spanHotkey);

                btn.addEventListener('click', (e) => this.askQuestion(q, e.currentTarget));

                this.questionListEl.appendChild(btn);
            });
        }

        /**
         * Bereinigt Eingabe für Vergleich
         * @param {string} value - Die Eingabe
         * @returns {string} Bereinigte Eingabe
         */
        sanitizeGuess(value) {
            return value
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[().-]/g, '');
        }

        /**
         * Findet Rechtsform basierend auf Eingabe
         * @param {string} value - Die Eingabe
         * @returns {Object|null} Gefundene Rechtsform oder null
         */
        findFormByGuess(value) {
            const sanitized = this.sanitizeGuess(value);
            if (!sanitized) return null;

            return this.legalForms.find(form => {
                const formNameSanitized = this.sanitizeGuess(form.name);
                return formNameSanitized === sanitized;
            }) || null;
        }

        /**
         * Behandelt Rate-Versuch
         */
        handleGuess() {
            if (!this.secretForm) return;

            const guess = this.guessInput.value.trim();

            if (!guess) {
                this.guessFeedbackEl.textContent = 'Gib eine Rechtsform ein, bevor du rätst.';
                this.guessFeedbackEl.className = 'error';
                return;
            }

            const guessedForm = this.findFormByGuess(guess);

            if (!guessedForm) {
                this.guessFeedbackEl.textContent =
                    'Diese Rechtsform ist nicht im Pool. Nutze die Liste als Orientierung.';
                this.guessFeedbackEl.className = 'error';
                return;
            }

            if (guessedForm.id === this.secretForm.id) {
                // Gewonnen!
                this.gameOver = true;
                this.guessFeedbackEl.textContent =
                    `Richtig! Die gesuchte Rechtsform war: ${this.secretForm.name}. ` +
                    `Starte eine neue Runde mit „Neue Runde".`;
                this.guessFeedbackEl.className = 'success';
            } else {
                // Falsch geraten
                this.guessFeedbackEl.textContent =
                    'Leider falsch. Gesucht ist eine andere Rechtsform. ' +
                    'Stelle weitere Fragen und versuche es erneut.';
                this.guessFeedbackEl.className = 'error';
            }
        }

        /**
         * Aktiviert/Deaktiviert Fragen-Buttons
         * @param {boolean} disabled - true = disable
         */
        setQuestionButtonsDisabled(disabled) {
            const buttons = document.querySelectorAll('.question-btn');
            buttons.forEach(btn => {
                if (disabled) {
                    btn.classList.add('disabled');
                } else {
                    btn.classList.remove('disabled');
                }
            });
        }

        /**
         * Startet neues Spiel
         */
        startNewGame() {
            if (this.legalForms.length === 0) {
                this.answerTextEl.textContent = 'Keine Rechtsformen verfügbar.';
                return;
            }

            // Neue geheime Form wählen
            this.secretForm = this.pickRandomForm();

            // State zurücksetzen
            this.questionCount = 0;
            this.gameOver = false;

            // UI zurücksetzen
            this.updateQuestionCount();
            this.resetAnswerButtons();
            this.historyListEl.innerHTML = '';
            this.answerTextEl.textContent = 'Neue Runde gestartet. Stelle eine Frage aus dem Katalog.';
            this.guessInput.value = '';
            this.guessFeedbackEl.textContent = '';
            this.guessFeedbackEl.className = '';

            // Buttons resetten
            this.setQuestionButtonsDisabled(false);
            const usedButtons = document.querySelectorAll('.question-btn.used');
            usedButtons.forEach(btn => btn.classList.remove('used'));
        }
    }

    // Spiel initialisieren, wenn DOM geladen
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new WerBinIch();
            game.init();
        });
    } else {
        const game = new WerBinIch();
        game.init();
    }
})();
