(function () {
    'use strict';

    // --- Config (kommt aus debugg.html oder index.html) ---
    const cfg = window.DRIVE_CONFIG || {};
    const ROOT_FOLDER_ID = cfg.ROOT_FOLDER_ID || '';
    const API_KEY = cfg.API_KEY || '';

    // --- 1. Global Setup & State ---
    const THEME_KEY = 'globalTheme_v1';
    const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const FOLDER_MIME = 'application/vnd.google-apps.folder';

    // App State
    let currentFolderId = ROOT_FOLDER_ID;
    let appState = {
        selectedId: null,
        closedIds: [],
        drawerOpen: false
    };
    const STATE_KEY = 'driveTreeSpaState_v2';
    let rootTree = [];
    let rootName = 'Drive-Ordner';

    // --- 2. Theme Logic ---
    function applyTheme(theme) {
        const rootEl = document.documentElement;
        const toggleBtn = document.getElementById('theme-toggle-app');

        if (theme === 'light') {
            rootEl.classList.add('theme-light');
            toggleBtn.textContent = '☀️';
        } else {
            rootEl.classList.remove('theme-light');
            toggleBtn.textContent = '🌙';
        }

        const iframe = document.querySelector('iframe.game-iframe');
        if (iframe && iframe.contentDocument) {
            if (theme === 'light') iframe.contentDocument.documentElement.classList.add('theme-light');
            else iframe.contentDocument.documentElement.classList.remove('theme-light');
        }
    }

    function initTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        const initial = (stored === 'light' || stored === 'dark') ? stored : 'dark';
        applyTheme(initial);
    }

    function toggleTheme() {
        const isLight = document.documentElement.classList.contains('theme-light');
        const next = isLight ? 'dark' : 'light';
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
    }

    // --- 3. App Logic ---
    async function initAppLogic() {
        if (!API_KEY) {
            fatalError('API-Key fehlt!');
            return;
        }
        if (!ROOT_FOLDER_ID) {
            fatalError('ROOT_FOLDER_ID fehlt!');
            return;
        }

        const treeRootEl = document.getElementById('tree-root');
        const drawerBackdrop = document.getElementById('drawer-backdrop');
        const menuBtn = document.getElementById('menu-tree-btn');

        menuBtn.onclick = () => {
            appState.drawerOpen = !appState.drawerOpen;
            saveAppState();
            applyDrawerState();
        };
        drawerBackdrop.onclick = () => {
            appState.drawerOpen = false;
            saveAppState();
            applyDrawerState();
        };

        loadAppState();
        applyDrawerState();

        try {
            const meta = await fetchFolderMeta(currentFolderId);
            rootName = meta.name || 'Drive-Ordner';
            document.getElementById('drawer-title').textContent = rootName;

            rootTree = await buildTreeData(currentFolderId);
            treeRootEl.innerHTML = '';
            buildTreeHelper(treeRootEl, rootTree, 0);

            // Start state: No game selected, reset selection
            appState.selectedId = null;
            saveAppState();

            // Clear view
            document.getElementById('view-title').textContent = 'Bereit';
            document.getElementById('view-path').textContent = '';
            const viewBody = document.getElementById('view-body');
            viewBody.innerHTML = '<p style="padding:2rem; color: #888;">Bitte wähle eine Datei aus dem Menü.</p>';

            document.querySelector('.content-header').classList.remove('hidden');
            document.querySelector('.content').classList.remove('full-screen');
            viewBody.classList.remove('iframe-container');
            viewBody.classList.add('card');

            applySelectedCss();
        } catch (err) {
            console.error(err);
            fatalError('Fehler beim Laden von Drive:\n' + err.message);
        }
    }

    function loadAppState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            if (raw) Object.assign(appState, JSON.parse(raw));
        } catch (_) { }
    }

    function saveAppState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    }

    function applyDrawerState() {
        const backdrop = document.getElementById('drawer-backdrop');
        const menuBtn = document.getElementById('menu-tree-btn');

        if (appState.drawerOpen) {
            document.getElementById('app-view').classList.add('tree-open');
            menuBtn.classList.add('active');
            backdrop.classList.add('active');
        } else {
            document.getElementById('app-view').classList.remove('tree-open');
            menuBtn.classList.remove('active');
            backdrop.classList.remove('active');
        }
    }

    function fatalError(msg) {
        document.getElementById('view-title').textContent = 'Fehler';
        document.getElementById('view-body').innerHTML = `<p style="color:red">${msg}</p>`;
    }

    async function fetchJson(url) {
        const res = await fetch(url);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = (errData.error && errData.error.message) ? errData.error.message : res.statusText;
            throw new Error(`${res.status} ${msg}`);
        }
        return res.json();
    }

    async function fetchFolderMeta(id) {
        const params = new URLSearchParams({ key: API_KEY, fields: 'id,name', supportsAllDrives: 'true' });
        return fetchJson(`${DRIVE_FILES_ENDPOINT}/${id}?${params}`);
    }

    async function fetchChildren(id) {
        let files = [];
        let token = '';
        do {
            const params = new URLSearchParams({
                key: API_KEY,
                q: `'${id}' in parents and trashed=false`,
                fields: 'nextPageToken,files(id,name,mimeType)',
                pageSize: '1000',
                includeItemsFromAllDrives: 'true',
                supportsAllDrives: 'true'
            });
            if (token) params.set('pageToken', token);

            const data = await fetchJson(`${DRIVE_FILES_ENDPOINT}?${params}`);
            if (data.files) files.push(...data.files);
            token = data.nextPageToken;
        } while (token);
        return files;
    }

    async function buildTreeData(id) {
        const all = await fetchChildren(id);
        const folders = all.filter(f => f.mimeType === FOLDER_MIME);
        const files = all.filter(f =>
            f.mimeType !== FOLDER_MIME &&
            (f.mimeType === 'application/json' || f.mimeType === 'application/pdf' || f.name.endsWith('.json') || f.name.endsWith('.pdf'))
        );

        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        const folderNodes = [];
        for (const f of folders) {
            const kids = await buildTreeData(f.id);
            folderNodes.push({ id: f.id, name: f.name, isFolder: true, children: kids });
        }

        return [
            ...folderNodes,
            ...files.map(f => ({ id: f.id, name: f.name, isFolder: false, kind: f.name.endsWith('.json') ? 'json' : 'pdf' }))
        ];
    }

    function buildTreeHelper(container, nodes, level) {
        nodes.forEach(node => {
            const div = document.createElement('div');
            div.className = 'tree-node';
            div.dataset.id = node.id;
            if (appState.closedIds.includes(node.id)) div.classList.add('tree-node--collapsed');

            const row = document.createElement('div');
            row.className = 'tree-row';
            row.onclick = (e) => onNodeClick(e, node);

            if (node.isFolder) {
                const btn = document.createElement('button');
                btn.className = 'tree-toggle';
                btn.textContent = appState.closedIds.includes(node.id) ? '▸' : '▾';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleNode(div, node.id, btn);
                };
                row.appendChild(btn);
            } else {
                const sp = document.createElement('span');
                sp.className = 'tree-spacer';
                row.appendChild(sp);
            }

            const icon = document.createElement('span');
            icon.className = 'tree-icon';
            icon.textContent = node.isFolder
                ? (appState.closedIds.includes(node.id) ? '📁' : '📂')
                : (node.kind === 'pdf' ? '👁' : '🏋');
            row.appendChild(icon);

            const label = document.createElement('button');
            label.className = 'tree-label';
            label.textContent = node.name.replace(/\.[^.]+$/, '');
            row.appendChild(label);

            div.appendChild(row);

            const childCont = document.createElement('div');
            childCont.className = 'tree-children';
            if (node.isFolder && node.children) {
                buildTreeHelper(childCont, node.children, level + 1);
            }
            div.appendChild(childCont);

            container.appendChild(div);
        });
    }

    function toggleNode(div, id, btn) {
        const idx = appState.closedIds.indexOf(id);
        if (idx >= 0) {
            appState.closedIds.splice(idx, 1);
            div.classList.remove('tree-node--collapsed');
            btn.textContent = '▾';
        } else {
            appState.closedIds.push(id);
            div.classList.add('tree-node--collapsed');
            btn.textContent = '▸';
        }

        saveAppState();

        const icon = div.querySelector('.tree-icon');
        if (icon) icon.textContent = appState.closedIds.includes(id) ? '📁' : '📂';
    }

    function onNodeClick(e, node) {
        selectNode(node.id);
    }

    function selectNode(id) {
        appState.selectedId = id;
        saveAppState();
        applySelectedCss();
        renderViewForId(id);
    }

    function applySelectedCss() {
        document.querySelectorAll('.tree-node').forEach(n => {
            if (n.dataset.id === appState.selectedId) n.classList.add('tree-node--selected');
            else n.classList.remove('tree-node--selected');
        });
        document.getElementById('state-selected-label').textContent = appState.selectedId || '-';
    }

    function findNode(nodes, id) {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
                const f = findNode(n.children, id);
                if (f) return f;
            }
        }
        return null;
    }

    function findPath(nodes, id, path = []) {
        for (const n of nodes) {
            const sub = [...path, n.name];
            if (n.id === id) return sub;
            if (n.children) {
                const f = findPath(n.children, id, sub);
                if (f) return f;
            }
        }
        return null;
    }

    function renderViewForId(id) {
        const node = findNode(rootTree, id);
        if (!node) return;

        const viewTitle = document.getElementById('view-title');
        const viewPath = document.getElementById('view-path');
        const viewBody = document.getElementById('view-body');
        const contentEl = document.querySelector('.content');

        viewTitle.textContent = node.name;
        const p = findPath(rootTree, id) || [node.name];
        viewPath.textContent = p.join(' / ');

        if (node.isFolder) {
            document.querySelector('.content-header').classList.remove('hidden');
            contentEl.classList.remove('full-screen');
            viewBody.classList.remove('iframe-container');
            viewBody.classList.add('card');

            const list = (node.children || []).map(c => `<li>${c.name}</li>`).join('');
            viewBody.innerHTML = `<h3>Inhalt:</h3><ul>${list || '<li>Leer</li>'}</ul>`;
        } else {
            document.querySelector('.content-header').classList.add('hidden');
            contentEl.classList.add('full-screen');

            viewBody.innerHTML = '';
            viewBody.classList.remove('card');
            viewBody.classList.add('iframe-container');

            if (node.kind === 'json') {
                loadGame(node);
            } else {
                viewBody.innerHTML = '<p style="padding:2rem">PDF Anzeige noch nicht implementiert.</p>';
            }
        }
    }

    async function loadGame(node) {
        const viewBody = document.getElementById('view-body');
        try {
            await window.DriveInterpreter.loadGame({
                fileId: node.id,
                apiKey: API_KEY,
                driveFilesEndpoint: DRIVE_FILES_ENDPOINT,
                containerEl: viewBody,
                basePath: 'games',
                iframeClassName: 'game-iframe'
            });
        } catch (e) {
            viewBody.innerHTML = `<p class="error">Fehler beim Laden: ${e.message}</p>`;
        }
    }

    // --- Boot ---
    document.getElementById('theme-toggle-app').addEventListener('click', toggleTheme);
    initTheme();
    initAppLogic();
})();
