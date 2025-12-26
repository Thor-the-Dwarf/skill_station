/**
 * ============================================================================
 * quick_quiz.js - Quick-Quiz Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Zeitbasiertes Quiz-Spiel mit Score-Tracking und Highscore.
 * Erweitert GameBase für JSON-Loading und Theme-Support.
 * 
 * SPIELPRINZIP:
 * - Frage wird angezeigt mit Timer
 * - Spieler wählt Antwort aus Buttons
 * - Bei korrekter Antwort: Score++ und Streak++
 * - Bei falscher Antwort oder Timeout: Streak = 0
 * - Nächste Frage automatisch nach kurzer Pause
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Quick-Quiz Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class QuickQuiz extends GameBase {
        constructor() {
            super({
                expectedGameType: 'quick_quiz',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.answerLabels = [];         // Array von String (Button-Labels)
            this.questions = [];            // Array von {text, correct}
            this.timePerQuestion = 12;      // Sekunden pro Frage

            // Spiel-State
            this.score = 0;
            this.highscore = 0;
            this.questionCount = 0;
            this.streak = 0;
            this.currentQuestion = null;
            this.remainingTime = this.timePerQuestion;
            this.timerId = null;
            this.locked = true;             // Buttons gesperrt
            this.hasStarted = false;        // Spiel wurde gestartet

            // DOM-Referenzen
            this.questionTextEl = null;
            this.sublineEl = null;
            this.optionsContainer = null;
            this.feedbackEl = null;
            this.scoreEl = null;
            this.highscoreEl = null;
            this.questionCountEl = null;
            this.streakEl = null;
            this.timerLabelEl = null;
            this.timerBarInnerEl = null;
            this.restartBtn = null;
            this.restartIconEl = null;
            this.restartLabelEl = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.questionTextEl = document.getElementById('question-text');
            this.sublineEl = document.getElementById('subline');
            this.optionsContainer = document.getElementById('options');
            this.feedbackEl = document.getElementById('feedback');
            this.scoreEl = document.getElementById('score');
            this.highscoreEl = document.getElementById('highscore');
            this.questionCountEl = document.getElementById('question-count');
            this.streakEl = document.getElementById('streak');
            this.timerLabelEl = document.getElementById('timer-label');
            this.timerBarInnerEl = document.getElementById('timer-bar-inner');
            this.restartBtn = document.getElementById('restart-btn');
            this.restartIconEl = document.getElementById('restart-icon');
            this.restartLabelEl = document.getElementById('restart-label');

            // Payload-Daten anwenden
            if (window.QuickQuizPayload) {
                window.QuickQuizPayload.applyPayloadToGame(this, data);
            }

            // Event-Listener
            this.restartBtn.addEventListener('click', () => this.handleRestartClick());

            // UI initialisieren
            this.renderOptions();
            this.setOptionsDisabled(true);
            this.updateStats();
            this.timerLabelEl.textContent = '– s';
            this.timerBarInnerEl.style.transform = 'scaleX(0)';
            this.updateRestartButton();
        }

        /**
         * Shuffle-Array Funktion
         */
        shuffleArray(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        /**
         * Aktualisiert Stats-Anzeige
         */
        updateStats() {
            this.scoreEl.textContent = String(this.score);
            this.highscoreEl.textContent = String(this.highscore);
            this.questionCountEl.textContent = String(this.questionCount);
            this.streakEl.textContent = String(this.streak);
        }

        /**
         * Setzt Feedback zurück
         */
        resetFeedback() {
            this.feedbackEl.textContent = '';
            this.feedbackEl.className = '';
        }

        /**
         * Stoppt Timer
         */
        stopTimer() {
            if (this.timerId !== null) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }

        /**
         * Aktualisiert Timer-UI
         */
        updateTimerUI() {
            this.timerLabelEl.textContent = `${this.remainingTime.toFixed(1)} s`;
            const factor = Math.max(0, Math.min(1, this.remainingTime / this.timePerQuestion));
            this.timerBarInnerEl.style.transform = `scaleX(${factor})`;
        }

        /**
         * Startet Timer
         */
        startTimer() {
            this.stopTimer();
            this.remainingTime = this.timePerQuestion;
            this.updateTimerUI();

            this.timerId = setInterval(() => {
                this.remainingTime -= 0.1;
                if (this.remainingTime <= 0) {
                    this.remainingTime = 0;
                    this.updateTimerUI();
                    this.stopTimer();
                    this.handleTimeout();
                } else {
                    this.updateTimerUI();
                }
            }, 100);
        }

        /**
         * Rendert Antwort-Buttons
         */
        renderOptions() {
            this.optionsContainer.innerHTML = '';
            const labels = [...this.answerLabels];
            labels.forEach(label => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = label;
                btn.dataset.value = label;
                btn.addEventListener('click', () => this.handleAnswer(label));
                this.optionsContainer.appendChild(btn);
            });
        }

        /**
         * Aktiviert/Deaktiviert Antwort-Buttons
         */
        setOptionsDisabled(disabled) {
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                if (disabled) {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                } else {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                    btn.classList.remove('correct', 'wrong');
                }
            });
        }

        /**
         * Wählt zufällige Frage
         */
        pickRandomQuestion() {
            const shuffled = this.shuffleArray(this.questions);
            return shuffled[0];
        }

        /**
         * Nächste Frage
         */
        nextQuestion() {
            if (!this.questions.length) {
                this.questionTextEl.textContent = 'Keine Fragen definiert.';
                return;
            }

            this.locked = false;
            this.resetFeedback();
            this.setOptionsDisabled(false);
            this.currentQuestion = this.pickRandomQuestion();
            this.questionTextEl.textContent = this.currentQuestion.text;
            this.questionCount++;
            this.updateStats();
            this.startTimer();
        }

        /**
         * Behandelt Timeout
         */
        handleTimeout() {
            if (this.locked) return;
            this.locked = true;
            this.setOptionsDisabled(true);

            this.streak = 0;
            this.updateStats();

            // Richtige Antwort markieren
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                if (btn.dataset.value === this.currentQuestion.correct) {
                    btn.classList.add('correct');
                }
            });

            this.feedbackEl.textContent = `Zeit abgelaufen! Richtig wäre: ${this.currentQuestion.correct}.`;
            this.feedbackEl.className = 'error';

            setTimeout(() => {
                this.nextQuestion();
            }, 900);
        }

        /**
         * Behandelt Antwort-Auswahl
         */
        handleAnswer(selected) {
            if (this.locked) return;
            this.locked = true;
            this.stopTimer();
            this.setOptionsDisabled(true);

            const isCorrect = selected === this.currentQuestion.correct;

            // Buttons markieren
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                const value = btn.dataset.value;
                if (value === this.currentQuestion.correct) {
                    btn.classList.add('correct');
                }
                if (value === selected && !isCorrect) {
                    btn.classList.add('wrong');
                }
            });

            if (isCorrect) {
                this.score++;
                this.streak++;
                if (this.score > this.highscore) {
                    this.highscore = this.score;
                }
                this.feedbackEl.textContent = 'Korrekt – weiter!';
                this.feedbackEl.className = 'ok';
            } else {
                this.streak = 0;
                this.feedbackEl.textContent = `Falsch. Richtig wäre: ${this.currentQuestion.correct}.`;
                this.feedbackEl.className = 'error';
            }

            this.updateStats();

            setTimeout(() => {
                this.nextQuestion();
            }, 800);
        }

        /**
         * Startet Spiel neu
         */
        restartGame() {
            this.score = 0;
            this.streak = 0;
            this.questionCount = 0;
            this.resetFeedback();
            this.updateStats();
            this.renderOptions();
            this.nextQuestion();
        }

        /**
         * Aktualisiert Restart-Button
         */
        updateRestartButton() {
            if (!this.hasStarted) {
                this.restartBtn.classList.remove('running');
                this.restartIconEl.textContent = '▶';
                this.restartLabelEl.textContent = 'Start';
            } else {
                this.restartBtn.classList.add('running');
                this.restartIconEl.textContent = '↻';
                this.restartLabelEl.textContent = 'Neustart';
            }
        }

        /**
         * Behandelt Restart-Button-Click
         */
        handleRestartClick() {
            if (!this.hasStarted) {
                this.hasStarted = true;
            }
            this.restartGame();
            this.updateRestartButton();
        }
    }

    // Spiel initialisieren, wenn DOM geladen
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new QuickQuiz();
            game.init();
        });
    } else {
        const game = new QuickQuiz();
        game.init();
    }
})();
