(function () {
    'use strict';

    function applyPayloadToGame(game, config) {
        const sortSection = (config.sections || []).find(s => s.type === "sort");
        const quizSection = (config.sections || []).find(s => s.type === "quiz");
        const capitalSection = (config.sections || []).find(s => s.type === "capital");

        if (sortSection && Array.isArray(sortSection.sortCards)) {
            game.sortCardsData = sortSection.sortCards;
        }

        if (quizSection && Array.isArray(quizSection.questions)) {
            game.quizSolutions = {};
            quizSection.questions.forEach(q => {
                game.quizSolutions[q.id] = q.correct;

                const qRoot = document.querySelector(`.quiz-question[data-quiz-id="${String(q.id)}"]`);
                if (!qRoot) return;

                const textEl = qRoot.querySelector(".quiz-text");
                if (textEl) textEl.textContent = q.text;

                const listEl = qRoot.querySelector(".quiz-options");
                if (listEl && Array.isArray(q.options)) {
                    listEl.innerHTML = "";
                    q.options.forEach(o => {
                        const li = document.createElement("li");
                        li.innerHTML = `<label><input type="radio" name="${q.id}" value="${o.value}"> ${o.text}</label>`;
                        listEl.appendChild(li);
                    });
                }
            });
        }

        if (capitalSection && Array.isArray(capitalSection.rows)) {
            game.capitalSolutions = {};
            capitalSection.rows.forEach(row => {
                game.capitalSolutions[row.label] = row.correct;

                const sel = document.querySelector(`select[data-form="${row.label}"]`);
                if (sel && Array.isArray(row.options)) {
                    sel.innerHTML = "";
                    row.options.forEach(o => {
                        const opt = document.createElement("option");
                        opt.value = o.value;
                        opt.textContent = o.text;
                        sel.appendChild(opt);
                    });
                }
            });
        }
    }

    window.EscapeGamePayload = {
        applyPayloadToGame
    };
})();
