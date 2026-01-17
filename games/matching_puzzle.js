/**
 * ============================================================================
 * matching_puzzle.js - Matching-Puzzle Spiellogik (Generic Refactor)
 * ============================================================================
 * 
 * ZWECK:
 * Hauptlogik für das Matching-Puzzle-Spiel. Erweitert GameBase.
 * Dynamisch generiert für beliebig viele Spalten (aktuell auf 3 ausgelegt via CSS/JSON),
 * basierend auf JSON-Konfiguration.
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    class MatchingPuzzle extends GameBase {
        constructor() {
            super({
                expectedGameType: 'matching_puzzle',
                rootElementId: 'game-root'
            });

            // Spiel-State
            this.sets = [];           // Array of objects {id, col1, col2, col3, ...}
            this.columnKeys = ['col1', 'col2', 'col3']; // Die Schlüssel für die Spalten
            this.selection = {};      // { col1: null, col2: null, col3: null }

            this.foundSets = 0;
            this.attempts = 0;
            this.totalSets = 0;
            this.evaluationLock = false;

            // DOM-Referenzen
            this.columnsContainer = null;
            this.foundSetsEl = null;
            this.attemptsEl = null;
            this.feedbackEl = null;
            this.newGameBtn = null;

            // Config-Cache
            this.configData = null;
        }

        onDataLoaded(data) {
            this.configData = data;

            // 1. DOM Referenzen
            this.columnsContainer = document.getElementById('columns-container');
            this.foundSetsEl = document.getElementById('found-sets');
            this.attemptsEl = document.getElementById('attempts');
            this.feedbackEl = document.getElementById('feedback');
            this.newGameBtn = document.getElementById('new-game-btn');

            if (data.sets && Array.isArray(data.sets)) {
                this.sets = data.sets;
                this.totalSets = data.sets.length;
            }

            // 2. Titel setzen
            if (data.title) {
                const titleEl = document.querySelector('.game-title');
                if (titleEl) titleEl.textContent = data.title;
                document.title = data.title;
            }
            if (data.subtitle) {
                const subEl = document.querySelector('.subtitle');
                if (subEl) subEl.textContent = data.subtitle;
            }

            // 3. Event Listener
            if (this.newGameBtn) {
                this.newGameBtn.addEventListener('click', () => this.resetGame());
            }

            // 4. Start
            this.resetGame();
        }

        shuffle(array) {
            const copy = [...array];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        updateStats() {
            if (this.foundSetsEl) this.foundSetsEl.textContent = `${this.foundSets}/${this.totalSets}`;
            if (this.attemptsEl) this.attemptsEl.textContent = String(this.attempts);
        }

        /**
         * Clears all selection references and removes visual 'selected' class.
         */
        clearAllSelections() {
            this.columnKeys.forEach(key => {
                if (this.selection[key]) {
                    this.selection[key].classList.remove('selected');
                    this.selection[key] = null;
                }
            });
        }

        setCardsDisabled(disabled) {
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                if (disabled) {
                    card.classList.add('disabled');
                    card.disabled = true;
                } else if (!card.classList.contains('matched')) {
                    card.classList.remove('disabled');
                    card.disabled = false;
                }
            });
        }

        clearWrongHighlight() {
            const wrongCards = document.querySelectorAll('.card.wrong');
            wrongCards.forEach(card => card.classList.remove('wrong'));
        }

        makeCard(text, colKey, setId) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card';
            btn.textContent = text;
            btn.dataset.colKey = colKey;
            btn.dataset.setId = setId;
            btn.addEventListener('click', (e) => this.onCardClick(e));
            return btn;
        }

        /**
         * Renders the columns dynamically based on this.columnKeys and configData
         */
        renderGrid() {
            this.columnsContainer.innerHTML = '';

            // Prepare shuffled data for each column
            const columnsData = {};
            this.columnKeys.forEach(key => {
                columnsData[key] = this.shuffle(this.sets);
            });

            // Hints / Titles from JSON
            const colTitles = this.configData.columnTitles || {};
            const colHints = this.configData.columnHints || {};

            // Render DOM for each column
            this.columnKeys.forEach((key, index) => {
                const colDiv = document.createElement('div');
                colDiv.className = 'column';

                // Display Title (1-based index for aesthetics)
                // e.g. "1 · Rechtsform"
                const displayNum = index + 1;
                const titleText = colTitles[key] ? `${displayNum} · ${colTitles[key]}` : `Spalte ${displayNum}`;

                const titleP = document.createElement('p');
                titleP.className = 'column-title';
                titleP.textContent = titleText;
                colDiv.appendChild(titleP);

                // Hint
                const hintText = colHints[key] || "";
                const hintP = document.createElement('p');
                hintP.className = 'column-hint';
                hintP.textContent = hintText;
                colDiv.appendChild(hintP);

                // Card List Container
                const listDiv = document.createElement('div');
                listDiv.className = 'card-list';
                listDiv.id = `list-${key}`;

                // Append Shuffled Cards
                columnsData[key].forEach(setItem => {
                    const card = this.makeCard(setItem[key], key, setItem.id);
                    listDiv.appendChild(card);
                });

                colDiv.appendChild(listDiv);
                this.columnsContainer.appendChild(colDiv);
            });
        }

        evaluateSelection() {
            // Check if all columns have a selection
            const allSelected = this.columnKeys.every(key => !!this.selection[key]);

            if (!allSelected) return;

            this.evaluationLock = true;
            this.attempts++;
            this.clearWrongHighlight();

            // Check if all selected cards have same setId
            const firstKey = this.columnKeys[0];
            const refId = this.selection[firstKey].dataset.setId;

            const isMatch = this.columnKeys.every(key => this.selection[key].dataset.setId === refId);

            const selectedCards = this.columnKeys.map(key => this.selection[key]);

            if (isMatch) {
                // MATCH
                selectedCards.forEach(card => {
                    card.classList.remove('selected');
                    card.classList.add('matched', 'disabled');
                    card.disabled = true;
                });

                this.foundSets++;
                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Korrektes Set gefunden!';
                    this.feedbackEl.className = 'ok';
                }

                // Clear selection state
                this.columnKeys.forEach(key => this.selection[key] = null);

                this.evaluationLock = false;
                this.setCardsDisabled(false);
                this.updateStats();

                if (this.foundSets === this.totalSets) {
                    if (this.feedbackEl) {
                        this.feedbackEl.textContent = 'Alle Sets korrekt zugeordnet – stark!';
                        this.feedbackEl.className = 'ok';
                    }
                }
            } else {
                // NO MATCH
                selectedCards.forEach(card => card.classList.add('wrong'));

                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Das passt noch nicht zusammen. Versuch es erneut.';
                    this.feedbackEl.className = 'error';
                }

                this.setCardsDisabled(true);

                setTimeout(() => {
                    selectedCards.forEach(card => {
                        card.classList.remove('selected', 'wrong');
                    });
                    this.columnKeys.forEach(key => this.selection[key] = null);

                    this.setCardsDisabled(false);
                    this.evaluationLock = false;
                    this.updateStats();
                }, 900);
            }
        }

        onCardClick(event) {
            if (this.evaluationLock) return;
            const card = event.currentTarget;
            if (card.classList.contains('matched')) return;

            const colKey = card.dataset.colKey;

            // Toggle off if same card clicked
            if (this.selection[colKey] === card) {
                card.classList.remove('selected');
                this.selection[colKey] = null;
                return;
            }

            // Deselect previous in this column
            if (this.selection[colKey]) {
                this.selection[colKey].classList.remove('selected');
            }

            // Select new
            card.classList.add('selected');
            this.selection[colKey] = card;

            // Check if full set selected
            const countSelected = this.columnKeys.filter(k => !!this.selection[k]).length;

            if (countSelected === this.columnKeys.length) {
                this.evaluateSelection();
            } else {
                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Wähle noch aus den anderen Spalten, um ein Set zu bilden.';
                    this.feedbackEl.className = 'info';
                }
            }
        }

        resetGame() {
            this.foundSets = 0;
            this.attempts = 0;
            // Clear selection object
            this.columnKeys.forEach(key => this.selection[key] = null);

            this.evaluationLock = false;

            if (this.feedbackEl) {
                this.feedbackEl.textContent = 'Wähle je eine Karte aus jeder Spalte, um passende Dreier-Sets zu finden.';
                this.feedbackEl.className = 'info';
            }

            this.renderGrid();
            this.setCardsDisabled(false);
            this.updateStats();
        }
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new MatchingPuzzle();
            game.init();
        });
    } else {
        const game = new MatchingPuzzle();
        game.init();
    }
})();
