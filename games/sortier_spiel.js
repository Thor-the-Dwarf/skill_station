/**
 * ============================================================================
 * sortier_spiel.js - Sortier-Spiel Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Drag & Drop Sortier-Spiel mit Pool und Sort-Spalten.
 * Karten können in mehrere Spalten gezogen werden (1:n).
 * 
 * SPIELPRINZIP:
 * - Karten aus Pool in Spalten ziehen (werden gecloned, nicht verschoben)
 * - Jede Karte kann in mehrere Spalten platziert werden
 * - Jede Karte hat correctForms (array) mit allen korrekten Zuordnungen
 * - Evaluation prüft alle Platzierungen separat
 * - Reset entfernt alle Clones, Originale bleiben im Pool
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
         * Drop Zone Handler - Erstellt Clone statt Karte zu verschieben
         */
        onDropZone(e) {
            e.preventDefault();
            const zone = e.currentTarget;
            zone.classList.remove('is-over');

            const cardId = e.dataTransfer.getData('text/plain') || this.dragCardId;
            if (!cardId) return;

            // Finde Original-Karte (im Pool oder bereits gecloned)
            let sourceCardEl = document.querySelector(`.sort-card[data-card-id="${cardId}"]`);

            // Falls es ein Clone ist, finde das Original
            if (!sourceCardEl) {
                sourceCardEl = document.querySelector(`.sort-card[data-original-id="${cardId}"]`);
            }

            if (!sourceCardEl) return;

            // Wenn Target der Pool ist: Lösche Clone (falls vorhanden)
            const isPoolDrop = zone.dataset.dropzone === 'pool';
            if (isPoolDrop) {
                // Clones können zurück in Pool gezogen werden -> löschen
                if (sourceCardEl.dataset.originalId) {
                    sourceCardEl.remove();
                }
                return;
            }

            // Prüfe ob diese Karte bereits in dieser Spalte ist
            const targetForm = zone.dataset.form;
            const existingClone = zone.querySelector(
                `.sort-card[data-original-id="${cardId}"][data-form="${targetForm}"], 
                 .sort-card[data-card-id="${cardId}"][data-form="${targetForm}"]`
            );

            if (existingClone) {
                // Karte ist bereits in dieser Spalte
                return;
            }

            // Erstelle Clone der Karte für diese Spalte
            const cardData = this.cards.find(c => c.id === cardId);
            if (!cardData) return;

            const cloneEl = this.createCard(cardData);
            cloneEl.dataset.originalId = cardId; // Markiere als Clone
            cloneEl.dataset.form = targetForm;   // Merke zu welcher Form es gehört
            cloneEl.classList.remove('correct', 'wrong');

            zone.appendChild(cloneEl);
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
         * Evaluiert die Sortierung - prüft alle Platzierungen
         */
        evaluate() {
            this.clearCardStates();
            let correctPlacements = 0;
            let totalPlacements = 0;

            this.cards.forEach(cardData => {
                // Finde alle Platzierungen dieser Karte (Original + Clones)
                const placements = document.querySelectorAll(
                    `.sort-card[data-card-id="${cardData.id}"], 
                     .sort-card[data-original-id="${cardData.id}"]`
                );

                placements.forEach(cardEl => {
                    // Nur Clones in Spalten zählen (nicht Original im Pool)
                    const parentZone = cardEl.closest('[data-dropzone="column"]');
                    if (!parentZone) return;

                    totalPlacements++;
                    const assignedForm = parentZone.dataset.form || null;

                    const isCorrect =
                        assignedForm &&
                        cardData.correctForms.includes(assignedForm);

                    if (isCorrect) {
                        cardEl.classList.add('correct');
                        correctPlacements++;
                    } else {
                        cardEl.classList.add('wrong');
                    }
                });
            });

            this.statCorrectEl.textContent = correctPlacements.toString();

            // Feedback basierend auf Placements
            if (totalPlacements === 0) {
                this.feedbackEl.className = 'feedback';
                this.feedbackEl.innerHTML = 'Ziehe die Eigenschaften in passende Spalten. Eine Eigenschaft kann in mehrere Spalten passen.';
            } else if (correctPlacements === totalPlacements && totalPlacements > 0) {
                this.feedbackEl.className = 'feedback success';
                this.feedbackEl.innerHTML = 'Perfekt sortiert – alle Zuordnungen sind korrekt. <strong>Prüfungsreif.</strong>';
            } else if (correctPlacements === 0) {
                this.feedbackEl.className = 'feedback error';
                this.feedbackEl.innerHTML = 'Hier passt fast nichts – überprüfe die Zuordnungen.';
            } else {
                this.feedbackEl.className = 'feedback';
                this.feedbackEl.innerHTML = `Du hast <strong>${correctPlacements} von ${totalPlacements}</strong> Zuordnungen richtig gemacht. Rote Karten kannst du entfernen oder verschieben.`;
            }
        }

        /**
         * Setzt Board zurück - entfernt alle Clones
         */
        resetBoard() {
            this.clearCardStates();

            // Entferne alle Clones aus Spalten
            document.querySelectorAll('.sort-card[data-original-id]').forEach(clone => {
                clone.remove();
            });

            // Originale bleiben im Pool, shuffle neu
            this.initCards();

            this.feedbackEl.className = 'feedback';
            this.feedbackEl.textContent = 'Ziehe jede Eigenschaft in passende Spalten. Eine Eigenschaft kann zu mehreren Rechtsformen passen.';
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
