/**
 * ============================================================================
 * sortier_spiel.js - Sortier-Spiel Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Drag & Drop Sortier-Spiel mit Pool und Sort-Spalten.
 * Karten können in mehrere korrekte Spalten gehören.
 * 
 * SPIELPRINZIP:
 * - Karten aus Pool in Spalten ziehen
 * - Jede Karte hat correctForms (array)
 * - Evaluation prüft ob Karte in korrekter Spalte
 * - Reset bringt alle Karten zurück in Pool (shuffled)
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Sortier-Spiel Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class SortierSpiel extends GameBase {
        constructor() {
            super({
                expectedGameType: 'sortier_spiel',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.columns = [];        // Array von {id, title, subtitle}
            this.cards = [];          // Array von {id, text, correctForms: [...]}

            // Spiel-State
            this.dragCardId = null;   // Aktuell gedragte Karte

            // DOM-Referenzen
            this.poolEl = null;
            this.columnsGridEl = null;
            this.feedbackEl = null;
            this.statTotalEl = null;
            this.statCorrectEl = null;
            this.checkBtn = null;
            this.resetBtn = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.poolEl = document.getElementById('pool');
            this.columnsGridEl = document.getElementById('columns-grid');
            this.feedbackEl = document.getElementById('feedback');
            this.statTotalEl = document.getElementById('stat-total');
            this.statCorrectEl = document.getElementById('stat-correct');
            this.checkBtn = document.getElementById('check-btn');
            this.resetBtn = document.getElementById('reset-btn');

            // Payload-Daten anwenden
            if (window.SortierSpielPayload) {
                window.SortierSpielPayload.applyPayloadToGame(this, data);
            }

            // Columns rendern
            this.renderColumns();

            // Event-Listener
            this.setupDragAndDrop();
            this.checkBtn.addEventListener('click', () => this.evaluate());
            this.resetBtn.addEventListener('click', () => this.resetBoard());

            // Cards initialisieren
            this.initCards();
        }

        /**
         * Shuffle-Funktion
         */
        shuffle(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /**
         * Rendert die Spalten
         */
        renderColumns() {
            this.columnsGridEl.innerHTML = '';
            this.columns.forEach(col => {
                const colDiv = document.createElement('div');
                colDiv.className = 'sort-column';
                colDiv.dataset.form = col.id;

                colDiv.innerHTML = `
                    <div class="column-header">
                        <span class="column-title">${col.title}</span>
                        <span class="column-sub">${col.subtitle || ''}</span>
                    </div>
                    <div class="sort-dropzone" data-dropzone="column" data-form="${col.id}"></div>
                `;

                this.columnsGridEl.appendChild(colDiv);
            });
        }

        /**
         * Erstellt eine Karte
         */
        createCard(card) {
            const el = document.createElement('div');
            el.className = 'sort-card';
            el.draggable = true;
            el.dataset.cardId = card.id;

            const textSpan = document.createElement('span');
            textSpan.className = 'sort-card-text';
            textSpan.textContent = card.text;

            const tagSpan = document.createElement('span');
            tagSpan.className = 'sort-card-tag';
            tagSpan.textContent = 'Eigenschaft';

            el.appendChild(textSpan);
            el.appendChild(tagSpan);

            el.addEventListener('dragstart', (e) => this.onDragStart(e));
            el.addEventListener('dragend', (e) => this.onDragEnd(e));

            return el;
        }

        /**
         * Initialisiert Karten im Pool
         */
        initCards() {
            this.poolEl.innerHTML = '';
            this.poolEl.classList.remove('empty');
            const shuffled = this.shuffle(this.cards);
            shuffled.forEach(card => {
                const el = this.createCard(card);
                this.poolEl.appendChild(el);
            });
            this.statTotalEl.textContent = this.cards.length;
            this.statCorrectEl.textContent = '0';
        }

        /**
         * Setup Drag & Drop Event-Listener
         */
        setupDragAndDrop() {
            const dropzones = document.querySelectorAll('[data-dropzone]');
            dropzones.forEach(zone => {
                zone.addEventListener('dragover', (e) => this.onDragOverZone(e));
                zone.addEventListener('dragleave', (e) => this.onDragLeaveZone(e));
                zone.addEventListener('drop', (e) => this.onDropZone(e));
            });
        }

        /**
         * Drag Start Handler
         */
        onDragStart(e) {
            const el = e.currentTarget;
            this.dragCardId = el.dataset.cardId;
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dragCardId);
        }

        /**
         * Drag End Handler
         */
        onDragEnd(e) {
            e.currentTarget.classList.remove('dragging');
            this.dragCardId = null;
            this.updatePoolEmptyState();
        }

        /**
         * Drag Over Zone Handler
         */
        onDragOverZone(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.currentTarget.classList.add('is-over');
        }

        /**
         * Drag Leave Zone Handler
         */
        onDragLeaveZone(e) {
            e.currentTarget.classList.remove('is-over');
        }

        /**
         * Drop Zone Handler
         */
        onDropZone(e) {
            e.preventDefault();
            const zone = e.currentTarget;
            zone.classList.remove('is-over');

            const cardId = e.dataTransfer.getData('text/plain') || this.dragCardId;
            if (!cardId) return;

            const cardEl = document.querySelector(`.sort-card[data-card-id="${cardId}"]`);
            if (!cardEl) return;

            cardEl.classList.remove('correct', 'wrong');
            zone.appendChild(cardEl);
            this.updatePoolEmptyState();
        }

        /**
         * Aktualisiert Pool Empty State
         */
        updatePoolEmptyState() {
            if (this.poolEl.children.length === 0) {
                this.poolEl.classList.add('empty');
                this.poolEl.textContent = 'Alle Karten verteilt – Auswerten oder Karten neu sortieren.';
            } else {
                if (this.poolEl.classList.contains('empty')) {
                    this.poolEl.classList.remove('empty');
                    this.poolEl.textContent = '';
                }
            }
        }

        /**
         * Löscht Card States
         */
        clearCardStates() {
            document.querySelectorAll('.sort-card').forEach(card => {
                card.classList.remove('correct', 'wrong');
            });
        }

        /**
         * Evaluiert die Sortierung
         */
        evaluate() {
            this.clearCardStates();
            let correctCount = 0;

            const total = this.cards.length;

            this.cards.forEach(cardData => {
                const cardEl = document.querySelector(`.sort-card[data-card-id="${cardData.id}"]`);
                if (!cardEl) return;

                const parentZone = cardEl.closest('[data-dropzone]');
                const assignedForm = parentZone ? parentZone.dataset.form || null : null;

                const isCorrect =
                    assignedForm &&
                    cardData.correctForms.includes(assignedForm);

                if (isCorrect) {
                    cardEl.classList.add('correct');
                    correctCount++;
                } else {
                    cardEl.classList.add('wrong');
                }
            });

            this.statCorrectEl.textContent = correctCount.toString();

            if (correctCount === total) {
                this.feedbackEl.className = 'feedback success';
                this.feedbackEl.innerHTML = 'Perfekt sortiert – alle Eigenschaften sind richtig zugeordnet. <strong>Prüfungsreif.</strong>';
            } else if (correctCount === 0) {
                this.feedbackEl.className = 'feedback error';
                this.feedbackEl.innerHTML = 'Hier passt fast nichts – schau dir die Lernhilfe an und sortiere gezielt.';
            } else {
                this.feedbackEl.className = 'feedback';
                this.feedbackEl.innerHTML = `Du hast <strong>${correctCount} von ${total}</strong> Eigenschaften richtig zugeordnet. Rote Karten kannst du neu ziehen und korrigieren.`;
            }
        }

        /**
         * Setzt Board zurück
         */
        resetBoard() {
            this.clearCardStates();
            this.initCards();
            this.feedbackEl.className = 'feedback';
            this.feedbackEl.textContent = 'Ziehe jede Eigenschaft in mindestens eine Spalte. Einige Eigenschaften passen zu mehreren Rechtsformen.';
        }
    }

    // Spiel initialisieren, wenn DOM geladen
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new SortierSpiel();
            game.init();
        });
    } else {
        const game = new SortierSpiel();
        game.init();
    }
})();
