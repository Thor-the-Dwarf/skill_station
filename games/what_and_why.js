/**
 * ============================================================================
 * what_and_why.js - What & Why Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Zweistufiges Lernspiel: Erst What auswählen (Radio), dann passende
 * Why-Begründungen markieren (Checkboxen). Beide werden separat bewertet.
 * 
 * SPIELPRINZIP:
 * 1. WHAT-Phase: Spieler wählt eine Option aus (Radio-Buttons)
 * 2. WHY-Phase: Basierend auf What-Wahl erscheinen passende Why-Statements
 * 3. Evaluation: What (0-1 Punkt) + Why (0-1 Punkt) = max 2 Punkte pro Fall
 * 4. Nächster Fall oder Final Summary
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * What & Why Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class WhatAndWhy extends GameBase {
        constructor() {
            super({
                expectedGameType: 'what_and_why',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.cases = [];              // Array von Cases

            // Spiel-State
            this.order = [];              // Shuffled indices
            this.currentIndex = 0;
            this.scoreWhat = 0;           // Punkte für richtige What-Wahl
            this.scoreWhy = 0;            // Punkte für richtige Why-Begründungen
            this.evaluated = false;       // Aktueller Fall bewertet?
            this.selectedWhatId = null;   // Aktuell gewählte What-Option

            // DOM-Referenzen
            this.roundLabelEl = null;
            this.scoreFormEl = null;
            this.scoreReasonEl = null;
            this.scoreTotalEl = null;
            this.caseTextEl = null;
            this.caseTagsEl = null;
            this.formOptionsEl = null;
            this.reasonOptionsEl = null;
            this.feedbackBoxEl = null;
            this.infoSectionEl = null;
            this.summaryBoxEl = null;
            this.whyGroupEl = null;
            this.checkBtn = null;
            this.restartBtn = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.roundLabelEl = document.getElementById('round-label');
            this.scoreFormEl = document.getElementById('score-form');
            this.scoreReasonEl = document.getElementById('score-reason');
            this.scoreTotalEl = document.getElementById('score-total');
            this.caseTextEl = document.getElementById('case-text');
            this.caseTagsEl = document.getElementById('case-tags');
            this.formOptionsEl = document.getElementById('form-options');
            this.reasonOptionsEl = document.getElementById('reason-options');
            this.feedbackBoxEl = document.getElementById('feedback-box');
            this.infoSectionEl = document.getElementById('info-section');
            this.summaryBoxEl = document.getElementById('summary-box');
            this.whyGroupEl = document.getElementById('why-group');
            this.checkBtn = document.getElementById('check-btn');
            this.restartBtn = document.getElementById('restart-btn');

            // Payload-Daten anwenden
            if (window.WhatAndWhyPayload) {
                window.WhatAndWhyPayload.applyPayloadToGame(this, data);
            }

            // Event-Listener
            this.checkBtn.addEventListener('click', () => this.nextStep());
            this.restartBtn.addEventListener('click', () => this.restart());

            // Spiel initialisieren
            if (this.cases.length === 0) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Keine Cases gefunden.';
                this.checkBtn.disabled = true;
                this.restartBtn.disabled = true;
                return;
            }

            this.initOrder();
            this.renderCase();
        }

        /**
         * Shuffle-Funktion
         */
        shuffleArray(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /**
         * Initialisiert shuffled Order
         */
        initOrder() {
            this.order = this.shuffleArray(this.cases.map((c, idx) => idx));
        }

        /**
         * Gibt aktuellen Case zurück
         */
        getCurrentCase() {
            return this.cases[this.order[this.currentIndex]];
        }

        /**
         * Rendert aktuellen Case
         */
        renderCase() {
            const c = this.getCurrentCase();
            if (!c) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Keine Falldaten gefunden.';
                this.checkBtn.disabled = true;
                this.restartBtn.disabled = true;
                return;
            }

            this.selectedWhatId = null;
            this.evaluated = false;

            // Round Label
            this.roundLabelEl.textContent = `${this.currentIndex + 1} / ${this.cases.length}`;

            // Case Text
            this.caseTextEl.textContent = c.profile;

            // Case Tags
            this.caseTagsEl.innerHTML = '';
            if (Array.isArray(c.tags)) {
                c.tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'case-tag';
                    span.textContent = tag;
                    this.caseTagsEl.appendChild(span);
                });
            }

            // What-Optionen rendern
            this.formOptionsEl.innerHTML = '';
            c.options.forEach(option => {
                const li = document.createElement('li');
                li.className = 'option';
                const id = `what-${c.id}-${option.id}`;
                li.innerHTML = `
                    <label class="option-label" for="${id}">
                        <input type="radio" name="what" id="${id}" value="${option.id}">
                        <div class="option-text">
                            ${option.label}
                            <div class="option-badge">What</div>
                        </div>
                    </label>
                `;
                this.formOptionsEl.appendChild(li);
            });

            // Event-Listener für What-Toggle
            this.formOptionsEl
                .querySelectorAll('input[name="what"]')
                .forEach(input => input.addEventListener('change', (e) => this.onWhatChanged(e)));

            // Why-Bereich verstecken
            this.whyGroupEl.style.display = 'none';
            this.reasonOptionsEl.innerHTML = '';

            // Feedback zurücksetzen
            this.feedbackBoxEl.className = 'feedback';
            this.feedbackBoxEl.innerHTML = 'Wähle zuerst eine Antwort oben (What). Danach erscheinen passende Why-Statements.';
            this.infoSectionEl.innerHTML = '';
            this.checkBtn.disabled = false;
            this.checkBtn.innerHTML = '<span>✔</span> Antwort prüfen';
        }

        /**
         * Wird aufgerufen, wenn What-Option gewählt wird
         */
        onWhatChanged(event) {
            const c = this.getCurrentCase();
            this.selectedWhatId = event.target.value;
            const option = c.options.find(o => o.id === this.selectedWhatId);
            if (!option) return;

            // Why-Checkboxen passend zum gewählten What aufbauen
            this.reasonOptionsEl.innerHTML = '';
            if (Array.isArray(option.whys)) {
                option.whys.forEach(why => {
                    const li = document.createElement('li');
                    li.className = 'option';
                    const id = `why-${c.id}-${this.selectedWhatId}-${why.id}`;
                    li.innerHTML = `
                        <label class="option-label" for="${id}">
                            <input type="checkbox" id="${id}" value="${why.id}">
                            <div class="option-text">
                                ${why.text}
                                <div class="option-badge">Why</div>
                            </div>
                        </label>
                    `;
                    this.reasonOptionsEl.appendChild(li);
                });
            }

            // Why-Checkboxen enablen
            this.reasonOptionsEl
                .querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.disabled = false);

            // Why-Gruppe anzeigen
            this.whyGroupEl.style.display = '';
            this.feedbackBoxEl.className = 'feedback';
            this.feedbackBoxEl.innerHTML = 'Jetzt passende Why-Begründungen markieren und auf <strong>Antwort prüfen</strong> klicken.';
        }

        /**
         * Gibt ausgewählte Why-IDs zurück
         */
        getSelectedReasons() {
            const checked = Array.from(this.reasonOptionsEl.querySelectorAll('input[type="checkbox"]:checked'));
            return checked.map(cb => cb.value);
        }

        /**
         * Evaluiert die Antworten
         */
        evaluate() {
            if (this.evaluated) return;

            const c = this.getCurrentCase();
            if (!c) return;

            if (!this.selectedWhatId) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Bitte zuerst ein What auswählen.';
                return;
            }

            const option = c.options.find(o => o.id === this.selectedWhatId);
            if (!option) return;

            const selectedReasons = this.getSelectedReasons();

            // Eingaben sperren
            this.formOptionsEl.querySelectorAll('input').forEach(i => i.disabled = true);
            this.reasonOptionsEl.querySelectorAll('input').forEach(i => i.disabled = true);

            let whatPoints = 0;
            let whyPoints = 0;

            // What-Bewertung
            const formLabels = this.formOptionsEl.querySelectorAll('.option-label');
            formLabels.forEach(lbl => {
                const input = lbl.querySelector('input');
                const optId = input.value;
                const opt = c.options.find(o => o.id === optId);

                if (opt && opt.isCorrect) {
                    lbl.classList.add('correct');
                }
                if (input.checked && (!opt || !opt.isCorrect)) {
                    lbl.classList.add('wrong');
                }
                lbl.classList.add('disabled');
            });

            if (option.isCorrect) {
                whatPoints = 1;
                this.scoreWhat += 1;
            }

            // Why-Bewertung relativ zum gewählten What
            const correctWhyIds = option.whys.filter(w => w.correct).map(w => w.id);
            const selectedSet = new Set(selectedReasons);
            const correctSet = new Set(correctWhyIds);

            const allMatch =
                correctSet.size === selectedSet.size &&
                [...correctSet].every(id => selectedSet.has(id));

            const reasonLabels = this.reasonOptionsEl.querySelectorAll('.option-label');
            reasonLabels.forEach(lbl => {
                const input = lbl.querySelector('input');
                const id = input.value;
                const isCorrect = correctSet.has(id);

                if (isCorrect) {
                    lbl.classList.add('correct');
                }
                if (input.checked && !isCorrect) {
                    lbl.classList.add('wrong');
                }
                lbl.classList.add('disabled');
            });

            if (allMatch && correctWhyIds.length > 0) {
                whyPoints = 1;
                this.scoreWhy += 1;
            }

            // Score aktualisieren
            const gained = whatPoints + whyPoints;
            this.scoreFormEl.textContent = this.scoreWhat;
            this.scoreReasonEl.textContent = this.scoreWhy;
            this.scoreTotalEl.textContent = this.scoreWhat + this.scoreWhy;

            // Feedback
            if (gained === 2) {
                this.feedbackBoxEl.className = 'feedback success';
                this.feedbackBoxEl.innerHTML = 'Top: Deine Wahl (What) und die Why-Begründungen passen perfekt. (+2 Punkte)';
            } else if (whatPoints === 1 && whyPoints === 0) {
                this.feedbackBoxEl.className = 'feedback';
                this.feedbackBoxEl.innerHTML = 'Das What passt (+1 Punkt), bei den Why-Statements ist noch Luft nach oben.';
            } else if (whatPoints === 0 && whyPoints === 1) {
                this.feedbackBoxEl.className = 'feedback';
                this.feedbackBoxEl.innerHTML = 'Deine Why-Argumentation ist stimmig (+1 Punkt), aber das What war nicht optimal gewählt.';
            } else {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.innerHTML = 'What und Why überzeugen noch nicht – schau dir den Lösungshinweis an. (0 Punkte)';
            }

            // Lösungshinweis anzeigen
            if (c.solution) {
                this.infoSectionEl.innerHTML = `<strong>Lösungshinweis:</strong> ${c.solution}`;
            }

            this.evaluated = true;
            this.checkBtn.innerHTML =
                this.currentIndex < this.cases.length - 1
                    ? '<span>➡</span> Nächster Fall'
                    : '<span>📊</span> Auswertung';
        }

        /**
         * Zeigt finale Zusammenfassung
         */
        showFinalSummary() {
            const maxWhat = this.cases.length;
            const maxWhy = this.cases.length;
            const total = this.scoreWhat + this.scoreWhy;
            const maxTotal = maxWhat + maxWhy;

            this.summaryBoxEl.innerHTML = `
                <strong>Auswertung:</strong><br>
                What-Punkte: ${this.scoreWhat} / ${maxWhat}<br>
                Why-Punkte: ${this.scoreWhy} / ${maxWhy}<br>
                Gesamt: ${total} / ${maxTotal}<br><br>
            `;
            this.feedbackBoxEl.className = 'feedback';
            this.feedbackBoxEl.textContent = 'Spiel beendet.';
            this.checkBtn.disabled = true;
        }

        /**
         * Nächster Schritt: Evaluate oder Next Case
         */
        nextStep() {
            if (!this.evaluated) {
                this.evaluate();
            } else {
                if (this.currentIndex < this.cases.length - 1) {
                    this.currentIndex += 1;
                    this.renderCase();
                } else {
                    this.showFinalSummary();
                }
            }
        }

        /**
         * Spiel neustarten
         */
        restart() {
            this.scoreWhat = 0;
            this.scoreWhy = 0;
            this.currentIndex = 0;
            this.scoreFormEl.textContent = '0';
            this.scoreReasonEl.textContent = '0';
            this.scoreTotalEl.textContent = '0';
            this.summaryBoxEl.innerHTML = '';
            this.initOrder();
            this.renderCase();
        }
    }

    // Spiel initialisieren, wenn DOM geladen
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new WhatAndWhy();
            game.init();
        });
    } else {
        const game = new WhatAndWhy();
        game.init();
    }
})();
