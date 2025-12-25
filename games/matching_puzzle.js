/**
 * ============================================================================
 * matching_puzzle.js - Matching-Puzzle Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Hauptlogik für das Matching-Puzzle-Spiel. Erweitert GameBase und implementiert
 * die spezifische Spielmechanik: 3 Karten aus 3 Spalten auswählen und matchen.
 * 
 * SPIELPRINZIP:
 * - Spieler wählt je eine Karte aus 3 Spalten (Name, Beschreibung, Beispiel)
 * - Bei vollständiger Auswahl wird automatisch geprüft
 * - Korrekte Sets werden grün markiert und bleiben
 * - Falsche Sets werden rot markiert und nach 900ms zurückgesetzt
 * - Ziel: Alle Sets korrekt zuordnen
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Matching-Puzzle Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class MatchingPuzzle extends GameBase {
        constructor() {
            super({
                expectedGameType: 'matching_puzzle',
                rootElementId: 'game-root'
            });

            // Spiel-State
            this.sets = [];           // Array of {id, name, description, example}
            this.selection = {        // Aktuelle Auswahl
                name: null,
                description: null,
                example: null
            };
            this.foundSets = 0;      // Anzahl gefundener Sets
            this.attempts = 0;        // Anzahl Versuche
            this.totalSets = 0;       // Gesamtanzahl Sets
            this.evaluationLock = false;  // Verhindert Klicks während Evaluation

            // DOM-Referenzen (werden in init() gesetzt)
            this.colNamesEl = null;
            this.colDescriptionsEl = null;
            this.colExamplesEl = null;
            this.foundSetsEl = null;
            this.attemptsEl = null;
            this.feedbackEl = null;
            this.newGameBtn = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         * @param {Object} data - Das JSON-Payload
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.colNamesEl = document.getElementById('col-names');
            this.colDescriptionsEl = document.getElementById('col-descriptions');
            this.colExamplesEl = document.getElementById('col-examples');
            this.foundSetsEl = document.getElementById('found-sets');
            this.attemptsEl = document.getElementById('attempts');
            this.feedbackEl = document.getElementById('feedback');
            this.newGameBtn = document.getElementById('new-game-btn');

            // Payload-Daten über payload.js anwenden
            if (window.MatchingPuzzlePayload) {
                window.MatchingPuzzlePayload.applyPayloadToGame(this, data);
            }

            // Event-Listener
            this.newGameBtn.addEventListener('click', () => this.resetGame());

            // Spiel starten
            this.resetGame();
        }

        /**
         * Mischt ein Array zufällig
         * Fisher-Yates Shuffle Algorithmus
         */
        shuffle(array) {
            const copy = [...array];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        /**
         * Aktualisiert die Statistik-Anzeige
         */
        updateStats() {
            this.foundSetsEl.textContent = `${this.foundSets}/${this.totalSets}`;
            this.attemptsEl.textContent = String(this.attempts);
        }

        /**
         * Setzt Selection-Visualisierung zurück
         * @param {string} typeToSkip - Type der übersprungen werden soll
         */
        resetSelectionVisuals(typeToSkip) {
            ['name', 'description', 'example'].forEach(type => {
                if (typeToSkip && type === typeToSkip) return;
                if (this.selection[type]) {
                    this.selection[type].classList.remove('selected');
                    this.selection[type] = null;
                }
            });
        }

        /**
         * Löscht alle Selections
         */
        clearAllSelections() {
            this.resetSelectionVisuals(null);
        }

        /**
         * Entfernt Wrong-Highlighting von allen Karten
         */
        clearWrongHighlight() {
            const wrongCards = document.querySelectorAll('.card.wrong');
            wrongCards.forEach(card => card.classList.remove('wrong'));
        }

        /**
         * Erstellt ein Karten-Element
         * @param {string} text - Kartentext
         * @param {string} type - Kartentyp (name/description/example)
         * @param {string} setId - ID des Sets
         * @returns {HTMLButtonElement}
         */
        makeCard(text, type, setId) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card';
            btn.textContent = text;
            btn.dataset.type = type;
            btn.dataset.setId = setId;
            btn.addEventListener('click', (e) => this.onCardClick(e));
            return btn;
        }

        /**
         * Rendert das Karten-Grid
         * Mischt alle 3 Spalten separat
         */
        renderGrid() {
            this.colNamesEl.innerHTML = '';
            this.colDescriptionsEl.innerHTML = '';
            this.colExamplesEl.innerHTML = '';

            const shuffledNames = this.shuffle(this.sets);
            const shuffledDescs = this.shuffle(this.sets);
            const shuffledExamples = this.shuffle(this.sets);

            shuffledNames.forEach(s => {
                this.colNamesEl.appendChild(this.makeCard(s.name, 'name', s.id));
            });
            shuffledDescs.forEach(s => {
                this.colDescriptionsEl.appendChild(this.makeCard(s.description, 'description', s.id));
            });
            shuffledExamples.forEach(s => {
                this.colExamplesEl.appendChild(this.makeCard(s.example, 'example', s.id));
            });
        }

        /**
         * Aktiviert/Deaktiviert alle Karten
         * @param {boolean} disabled - true = disable, false = enable
         */
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

        /**
         * Evaluiert die aktuelle Auswahl
         * Wird aufgerufen, wenn alle 3 Karten ausgewählt sind
         */
        evaluateSelection() {
            // Prüfen ob vollständige Auswahl
            if (!this.selection.name || !this.selection.description || !this.selection.example) {
                return;
            }

            this.evaluationLock = true;
            this.attempts++;
            this.clearWrongHighlight();

            // Set-IDs vergleichen
            const setIdName = this.selection.name.dataset.setId;
            const setIdDesc = this.selection.description.dataset.setId;
            const setIdExample = this.selection.example.dataset.setId;
            const isMatch = setIdName === setIdDesc && setIdName === setIdExample;

            if (isMatch) {
                // ✅ Korrektes Set gefunden
                [this.selection.name, this.selection.description, this.selection.example].forEach(card => {
                    card.classList.remove('selected');
                    card.classList.add('matched');
                    card.classList.add('disabled');
                    card.disabled = true;
                });

                this.foundSets++;
                this.feedbackEl.textContent = 'Korrektes Set gefunden!';
                this.feedbackEl.className = 'ok';
                this.selection = { name: null, description: null, example: null };
                this.evaluationLock = false;
                this.setCardsDisabled(false);
                this.updateStats();

                // Spiel gewonnen?
                if (this.foundSets === this.totalSets) {
                    this.feedbackEl.textContent = 'Alle Sets korrekt zugeordnet – stark!';
                    this.feedbackEl.className = 'ok';
                }

            } else {
                // ❌ Falsches Set
                [this.selection.name, this.selection.description, this.selection.example].forEach(card => {
                    card.classList.add('wrong');
                });

                this.feedbackEl.textContent = 'Das passt noch nicht zusammen. Versuch es erneut.';
                this.feedbackEl.className = 'error';
                this.setCardsDisabled(true);

                // Nach 900ms zurücksetzen
                setTimeout(() => {
                    [this.selection.name, this.selection.description, this.selection.example].forEach(card => {
                        card.classList.remove('selected', 'wrong');
                    });
                    this.selection = { name: null, description: null, example: null };
                    this.setCardsDisabled(false);
                    this.evaluationLock = false;
                    this.updateStats();
                }, 900);
            }
        }

        /**
         * Handler für Karten-Klicks
         * @param {Event} event - Click-Event
         */
        onCardClick(event) {
            if (this.evaluationLock) return;

            const card = event.currentTarget;
            if (card.classList.contains('matched')) return;

            const type = card.dataset.type;

            // Toggle: Gleiche Karte nochmal geklickt = abwählen
            if (this.selection[type] === card) {
                card.classList.remove('selected');
                this.selection[type] = null;
                return;
            }

            // Vorherige Auswahl des gleichen Typs abwählen
            if (this.selection[type]) {
                this.selection[type].classList.remove('selected');
            }

            // Neue Auswahl markieren
            card.classList.add('selected');
            this.selection[type] = card;

            // Bei vollständiger Auswahl evaluieren
            if (this.selection.name && this.selection.description && this.selection.example) {
                this.evaluateSelection();
            } else {
                this.feedbackEl.textContent = 'Wähle noch aus den anderen Spalten, um ein Set zu bilden.';
                this.feedbackEl.className = 'info';
            }
        }

        /**
         * Setzt das Spiel zurück (Neue Runde)
         */
        resetGame() {
            this.foundSets = 0;
            this.attempts = 0;
            this.selection = { name: null, description: null, example: null };
            this.evaluationLock = false;

            this.feedbackEl.textContent = 'Wähle je eine Karte aus jeder Spalte, um passende Dreier-Sets zu finden.';
            this.feedbackEl.className = 'info';

            this.renderGrid();
            this.setCardsDisabled(false);
            this.updateStats();
        }
    }

    // Spiel initialisieren, wenn DOM geladen
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
