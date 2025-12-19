(function () {
    'use strict';

    class EscapeGame extends window.GameBase {
        constructor() {
            super({
                expectedGameType: 'escape_game',
                rootElementId: 'game-root'
            });

            // Game State
            this.START_SECONDS = 180;
            this.remainingSeconds = this.START_SECONDS;
            this.timerId = null;
            this.gameLocked = false;

            this.sectionSolved = {
                sort: false,
                quiz: false,
                capital: false
            };

            this.sortCardsData = [];
            this.quizSolutions = {};
            this.capitalSolutions = {};
            this.draggingCardId = null;

            // DOM Elements (assigned in onDataLoaded)
            this.statTimerEl = null;
            this.statSolvedEl = null;
            this.statStatusEl = null;
            this.doorEl = null;
            this.doorSignEl = null;
            this.doorGlowEl = null;
            this.sortPoolEl = null;
            this.quizFeedbackEl = null;
        }

        onDataLoaded(data) {
            // 1. Config parsen & Datenstrukturen füllen + DOM-Teile updaten
            window.EscapeGamePayload.applyPayloadToGame(this, data);

            // 2. DOM-Elemente binden
            this.statTimerEl = document.getElementById("stat-timer");
            this.statSolvedEl = document.getElementById("stat-solved");
            this.statStatusEl = document.getElementById("stat-status");

            this.doorEl = document.getElementById("door");
            this.doorSignEl = document.getElementById("door-sign");
            this.doorGlowEl = document.getElementById("door-glow");

            this.sortPoolEl = document.getElementById("sort-pool");
            this.quizFeedbackEl = document.getElementById("quiz-feedback");

            // Buttons
            document.getElementById("restart-btn").addEventListener("click", () => this.resetGame());
            document.getElementById("check-sort-btn").addEventListener("click", () => this.checkSort());
            document.getElementById("check-quiz-btn").addEventListener("click", () => this.checkQuiz());
            document.getElementById("check-capital-btn").addEventListener("click", () => this.checkCapital());

            // Drag Drop Zones
            const dropzones = document.querySelectorAll(".escape-dropzone");
            dropzones.forEach(zone => {
                zone.addEventListener("dragover", (e) => this.handleDragOverZone(e));
                zone.addEventListener("dragleave", (e) => this.handleDragLeaveZone(e));
                zone.addEventListener("drop", (e) => this.handleDropZone(e));
            });

            // Start
            this.resetGame();
        }

        // --- Timer Logic ---

        startTimer() {
            if (this.timerId) clearInterval(this.timerId);
            this.timerId = setInterval(() => this.tickTimer(), 1000);
        }

        tickTimer() {
            if (this.gameLocked) return;
            this.remainingSeconds -= 1;
            if (this.remainingSeconds <= 0) {
                this.remainingSeconds = 0;
                this.updateTimerDisplay();
                this.handleTimeUp();
                return;
            }
            this.updateTimerDisplay();
        }

        updateTimerDisplay() {
            if (!this.statTimerEl) return;
            this.statTimerEl.textContent = this.formatTime(this.remainingSeconds);
            this.statTimerEl.style.color = this.remainingSeconds <= 10
                ? 'hsl(var(--error))'
                : 'var(--text)';
        }

        formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            const mm = m < 10 ? "0" + m : String(m);
            const ss = s < 10 ? "0" + s : String(s);
            return mm + ":" + ss;
        }

        handleTimeUp() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
            this.gameLocked = true;

            this.doorSignEl.textContent = "ZU SPÄT";
            this.doorSignEl.classList.remove("door-sign--open");
            this.doorSignEl.classList.add("door-sign--closed");
            this.doorEl.classList.remove("door--open");
            this.doorGlowEl.classList.remove("door-glow--active");

            this._disableAllButtons();
        }

        _disableAllButtons() {
            const btns = document.querySelectorAll("#check-sort-btn, #check-quiz-btn, #check-capital-btn");
            btns.forEach(b => b.disabled = true);
        }

        _enableAllButtons() {
            const btns = document.querySelectorAll("#check-sort-btn, #check-quiz-btn, #check-capital-btn");
            btns.forEach(b => b.disabled = false);
        }

        // --- Game Logic ---

        updateSolvedStatus() {
            const solvedCount = Object.values(this.sectionSolved).filter(Boolean).length;
            this.statSolvedEl.textContent = solvedCount + " / 3";

            if (solvedCount === 3 && !this.gameLocked && this.remainingSeconds > 0) {
                this.openDoor();
            }
        }

        openDoor() {
            this.gameLocked = true;
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }

            this.doorEl.classList.add("door--open");
            this.doorGlowEl.classList.add("door-glow--active");
            this.doorSignEl.textContent = "OFFEN";
            this.doorSignEl.classList.remove("door-sign--closed");
            this.doorSignEl.classList.add("door-sign--open");

            this._disableAllButtons();
        }

        resetGame() {
            if (this.timerId) clearInterval(this.timerId);

            this.remainingSeconds = this.START_SECONDS;
            this.gameLocked = false;
            this.sectionSolved = { sort: false, quiz: false, capital: false };

            // UI Reset
            this.updateTimerDisplay();
            this.statSolvedEl.textContent = "0 / 3";

            document.getElementById("status-sort").textContent = "offen";
            document.getElementById("status-sort").className = "section-status";
            document.getElementById("status-quiz").textContent = "offen";
            document.getElementById("status-quiz").className = "section-status";
            document.getElementById("status-capital").textContent = "offen";
            document.getElementById("status-capital").className = "section-status";

            this.doorEl.classList.remove("door--open");
            this.doorGlowEl.classList.remove("door-glow--active");
            this.doorSignEl.textContent = "GESCHLOSSEN";
            this.doorSignEl.classList.add("door-sign--closed");
            this.doorSignEl.classList.remove("door-sign--open");

            this.resetSortBoard();

            // Quiz Reset
            document.querySelectorAll('input[type="radio"]').forEach(i => i.checked = false);
            this.quizFeedbackEl.textContent = "Wähle je Frage eine Antwort.";

            // Capital Reset
            document.querySelectorAll(".capital-table select").forEach(sel => {
                sel.value = "";
                sel.classList.remove("correct", "wrong");
            });

            this._enableAllButtons();
            this.startTimer();
        }

        // --- Drag & Drop ---

        resetSortBoard() {
            this.sortPoolEl.innerHTML = "";
            this.sortCardsData.forEach(card => {
                const el = this.createSortCard(card);
                this.sortPoolEl.appendChild(el);
            });

            const dropzones = document.querySelectorAll(".escape-dropzone");
            dropzones.forEach(zone => {
                zone.classList.remove("is-over");
                const children = Array.from(zone.children).filter(c => !c.classList.contains("escape-dropzone-label"));
                children.forEach(c => c.remove());
            });
        }

        createSortCard(cardData) {
            const el = document.createElement("div");
            el.className = "drag-card";
            el.draggable = true;
            el.dataset.cardId = cardData.id;
            el.dataset.correctZone = cardData.correctZone;

            const textSpan = document.createElement("span");
            textSpan.className = "drag-card-text";
            textSpan.textContent = cardData.text;
            el.appendChild(textSpan);

            el.addEventListener("dragstart", (e) => {
                if (this.gameLocked) {
                    e.preventDefault();
                    return;
                }
                this.draggingCardId = cardData.id;
                el.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", cardData.id);
            });

            el.addEventListener("dragend", () => {
                this.draggingCardId = null;
                el.classList.remove("dragging");
            });

            return el;
        }

        handleDragOverZone(e) {
            if (this.gameLocked) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            e.currentTarget.classList.add("is-over");
        }

        handleDragLeaveZone(e) {
            e.currentTarget.classList.remove("is-over");
        }

        handleDropZone(e) {
            if (this.gameLocked) return;
            e.preventDefault();
            const zone = e.currentTarget;
            zone.classList.remove("is-over");

            const cardId = e.dataTransfer.getData("text/plain") || this.draggingCardId;
            if (!cardId) return;

            const cardEl = document.querySelector(`.drag-card[data-card-id="${cardId}"]`);
            if (!cardEl) return;

            cardEl.classList.remove("correct", "wrong");
            zone.appendChild(cardEl);
        }

        checkSort() {
            if (this.gameLocked) return;

            let correct = 0;
            const total = this.sortCardsData.length;

            document.querySelectorAll(".drag-card").forEach(card => card.classList.remove("correct", "wrong"));

            this.sortCardsData.forEach(cardData => {
                const cardEl = document.querySelector(`.drag-card[data-card-id="${cardData.id}"]`);
                if (!cardEl) return;

                const parentZone = cardEl.closest(".escape-dropzone");
                const zoneName = parentZone ? parentZone.dataset.zone : null;

                if (!zoneName) {
                    cardEl.classList.add("wrong");
                    return;
                }

                if (zoneName === cardData.correctZone) {
                    cardEl.classList.add("correct");
                    correct += 1;
                } else {
                    cardEl.classList.add("wrong");
                }
            });

            const statusEl = document.getElementById("status-sort");
            if (correct === total) {
                this.sectionSolved.sort = true;
                statusEl.textContent = "gelöst";
                statusEl.className = "section-status section-status--done";
            } else {
                this.sectionSolved.sort = false;
                statusEl.textContent = "noch Fehler";
                statusEl.className = "section-status section-status--fail";
            }

            this.updateSolvedStatus();
        }

        // --- Quiz Logic ---

        checkQuiz() {
            if (this.gameLocked) return;

            const q1 = document.querySelector('input[name="q1"]:checked');
            const q2 = document.querySelector('input[name="q2"]:checked');

            const statusEl = document.getElementById("status-quiz");

            if (!q1 || !q2) {
                this.quizFeedbackEl.textContent = "Bitte jede der beiden Fragen beantworten.";
                this.sectionSolved.quiz = false;
                statusEl.textContent = "unvollständig";
                statusEl.className = "section-status section-status--fail";
                this.updateSolvedStatus();
                return;
            }

            const correctQ1 = q1.value === this.quizSolutions.q1;
            const correctQ2 = q2.value === this.quizSolutions.q2;

            if (correctQ1 && correctQ2) {
                this.sectionSolved.quiz = true;
                statusEl.textContent = "gelöst";
                statusEl.className = "section-status section-status--done";
                this.quizFeedbackEl.textContent = "Beide Antworten sind richtig.";
            } else {
                this.sectionSolved.quiz = false;
                statusEl.textContent = "noch Fehler";
                statusEl.className = "section-status section-status--fail";
                this.quizFeedbackEl.textContent = "Mindestens eine Antwort ist falsch.";
            }
            this.updateSolvedStatus();
        }

        // --- Capital Logic ---

        checkCapital() {
            if (this.gameLocked) return;

            let correct = 0;
            const total = Object.keys(this.capitalSolutions).length;
            const selects = document.querySelectorAll(".capital-table select");

            selects.forEach(sel => sel.classList.remove("correct", "wrong"));

            selects.forEach(sel => {
                const form = sel.dataset.form;
                const expected = this.capitalSolutions[form];
                const chosen = sel.value;

                if (!chosen) {
                    sel.classList.add("wrong");
                    return;
                }

                if (chosen === expected) {
                    sel.classList.add("correct");
                    correct += 1;
                } else {
                    sel.classList.add("wrong");
                }
            });

            const statusEl = document.getElementById("status-capital");
            if (correct === total) {
                this.sectionSolved.capital = true;
                statusEl.textContent = "gelöst";
                statusEl.className = "section-status section-status--done";
            } else {
                this.sectionSolved.capital = false;
                statusEl.textContent = "noch Fehler";
                statusEl.className = "section-status section-status--fail";
            }
            this.updateSolvedStatus();
        }
    }

    // --- Init ---
    const game = new EscapeGame();
    game.init();
})();
