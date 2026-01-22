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

    const STORAGE_KEY_FOLDER = 'drive_root_folder_id';
    const HISTORY_KEY = 'drive_history_v1';
    let driveHistory = [];

    // App State
    // Prioritize ID from local storage if set (switching folders), else fallback to config
    let storedId = localStorage.getItem(STORAGE_KEY_FOLDER);
    if (!storedId) storedId = ROOT_FOLDER_ID;

    let currentFolderId = storedId;
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

        // --- Boot & Event Listeners ---
        const themeToggleGlobal = document.getElementById('theme-toggle-app');
        const drawerBackdrop = document.getElementById('drawer-backdrop');
        const topBarMenuBtn = document.getElementById('menu-tree-btn');
        const viewBody = document.getElementById('view-body');

        // Theme
        themeToggleGlobal.addEventListener('click', toggleTheme);
        initTheme();

        // Drawer / Nav
        // Drawer / Nav
        drawerBackdrop.addEventListener('click', () => setDrawer(false));
        topBarMenuBtn.addEventListener('click', toggleDrawer);

        // History Init
        // renderHistory() handled in initConnectionLogic

        // Load State
        initConnectionLogic();
        loadAppState();

        try {
            // If no current folder, show empty state helper
            if (!currentFolderId) {
                viewBody.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <h2>Kein Drive-Ordner verbunden</h2>
                        <p style="color:var(--txt-muted); margin-bottom: 2rem;">
                            Bitte öffne das Menü (oben links) und gib eine Drive-Folder-ID oder einen Link ein.
                        </p>
                        <button class="btn primary huge" onclick="document.getElementById('menu-tree-btn').click()">📂 Menü öffnen</button>
                    </div>
                `;
                viewBody.classList.add('card');
                viewBody.classList.remove('iframe-container');
                document.getElementById('view-title').textContent = 'Drive-Tree';
                document.getElementById('view-path').textContent = '';
                return;
            }

            const meta = await fetchFolderMeta(currentFolderId);
            rootName = meta.name || 'Drive-Ordner';
            document.getElementById('drawer-title').textContent = rootName;

            // Update History Name
            saveHistoryEntry(currentFolderId, rootName);

            rootTree = await buildTreeData(currentFolderId);
            const treeRootEl = document.getElementById('tree-root');
            treeRootEl.innerHTML = '';
            buildTreeHelper(treeRootEl, rootTree, 0);

            // Start state: No game selected, reset selection
            appState.selectedId = null;
            saveAppState();

            // Clear view
            document.getElementById('view-title').textContent = 'Bereit';
            document.getElementById('view-path').textContent = '';
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
            if (menuBtn) menuBtn.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        } else {
            document.getElementById('app-view').classList.remove('tree-open');
            if (menuBtn) menuBtn.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        }
    }

    function toggleDrawer() {
        appState.drawerOpen = !appState.drawerOpen;
        saveAppState();
        applyDrawerState();
    }

    function setDrawer(isOpen) {
        appState.drawerOpen = isOpen;
        saveAppState();
        applyDrawerState();
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
        const files = all.filter(f => f.mimeType !== FOLDER_MIME);

        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        const folderNodes = [];
        for (const f of folders) {
            const kids = await buildTreeData(f.id);
            folderNodes.push({ id: f.id, name: f.name, isFolder: true, children: kids });
        }

        return [
            ...folderNodes,
            ...files.map(f => ({ id: f.id, name: f.name, isFolder: false, kind: f.name.endsWith('.json') ? 'json' : 'file' }))
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
                : (node.kind !== 'json' ? '👁' : '🏋');
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
        if (!node.isFolder && node.kind !== 'json') {
            // Öffne NICHT-JSON-Dateien im Google Viewer in neuem Tab
            const url = `https://drive.google.com/file/d/${node.id}/preview`;
            window.open(url, '_blank');
            return;
        }
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
        // Removed: document.getElementById('state-selected-label').textContent = appState.selectedId || '-';
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

    // --- 4. Connection & History Logic (New) ---
    function initConnectionLogic() {
        loadHistory();
        initModal();
    }

    function loadHistory() {
        try {
            driveHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } catch (e) { driveHistory = []; }
        renderHistoryDropdown();
    }

    function saveHistoryEntry(id, name) {
        driveHistory = driveHistory.filter(h => h.id !== id);
        driveHistory.unshift({ id, name: name || id, date: Date.now() });
        if (driveHistory.length > 10) driveHistory.pop();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(driveHistory));
        renderHistoryDropdown();
    }

    function renderHistoryDropdown() {
        const dd = document.getElementById('history-dropdown');
        if (!dd) return;
        dd.innerHTML = '<option value="">Zuletzt verwendet...</option>';
        driveHistory.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = h.name;
            if (h.id === currentFolderId) opt.selected = true;
            dd.appendChild(opt);
        });

        dd.onchange = (e) => {
            const newId = e.target.value;
            if (newId && newId !== currentFolderId) {
                switchFolder(newId);
            }
        };
    }

    function switchFolder(id) {
        localStorage.setItem(STORAGE_KEY_FOLDER, id);
        location.reload();
    }

    function initModal() {
        const modal = document.getElementById('connect-modal');
        const btnOpenConnect = document.getElementById('btn-open-connect');
        const btnCancel = document.getElementById('btn-modal-cancel');
        const btnConfirm = document.getElementById('btn-modal-confirm');
        const modalInput = document.getElementById('modal-drive-input');

        if (!modal) return;

        if (btnOpenConnect) {
            btnOpenConnect.onclick = () => {
                modal.classList.add('active');
                modalInput.value = '';
                modalInput.focus();
            };
        }

        if (btnCancel) btnCancel.onclick = () => modal.classList.remove('active');

        if (btnConfirm) {
            btnConfirm.onclick = () => {
                const val = modalInput.value.trim();
                const id = extractFolderId(val);
                if (id) {
                    saveHistoryEntry(id, 'Neuer Ordner...');
                    switchFolder(id);
                } else {
                    alert('Ungültige URL oder ID');
                }
            };
        }

        if (modalInput) {
            modalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') btnConfirm.click();
            });
        }
    }

    function extractFolderId(url) {
        const idRegex = /[-\w]{25,}/;
        if (url.includes('drive.google.com')) {
            const parts = url.split('/');
            const folderIndex = parts.indexOf('folders');
            if (folderIndex !== -1 && parts[folderIndex + 1]) {
                const candidate = parts[folderIndex + 1].split('?')[0];
                if (idRegex.test(candidate)) return candidate;
            }
        }
        if (idRegex.test(url) && !url.includes('/')) return url;
        return null;
    }


    // --- Boot ---
    document.getElementById('theme-toggle-app').addEventListener('click', toggleTheme);
    initTheme();
    initAppLogic();
})();
