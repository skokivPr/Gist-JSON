// --- STATE ---
const state = {
    items: [],
    nextId: 1,
    editingId: null
};

// Monaco instance
let toolsEditor = null;

// --- DOM ELEMENTS ---
const els = {
    tabs: document.querySelectorAll('.tab-btn'),
    sections: document.querySelectorAll('.view-section'),
    themeToggle: document.getElementById('themeToggle'),
    url: document.getElementById('urlInput'),
    title: document.getElementById('titleInput'),
    filename: document.getElementById('filenameInput'),
    addBtn: document.getElementById('addBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    list: document.getElementById('list'),
    count: document.getElementById('count'),
    jsonOutput: document.getElementById('jsonOutput'),
    copyBtn: document.getElementById('copyBtn'),
    clearBtn: document.getElementById('clearBtn'),
    importBtn: document.getElementById('importBtn'),
    importArea: document.getElementById('importArea'),
    importUrl: document.getElementById('importUrlInput'),
    confirmImport: document.getElementById('confirmImportBtn'),
    tInput: document.getElementById('toolsInput'), // Now a DIV container for Monaco
    tOutput: document.getElementById('toolsOutput'),
    tStatus: document.getElementById('toolsStatus'),
    // Resizing Elements
    toolsResizer: document.getElementById('toolsResizer'),
    toolsContainer: document.getElementById('toolsContainer'),
    toolsLeftPanel: document.getElementById('toolsLeftPanel'),
    toolsRightPanel: document.getElementById('toolsRightPanel')
};

// --- THEME LOGIC ---
let isDark = localStorage.getItem('theme') === 'dark';
updateTheme();

// --- MONACO EDITOR SETUP ---

function initMonacoEditor() {
    if (toolsEditor) return; // Prevent double initialization

    // Ensure container is empty before creating editor
    els.tInput.innerHTML = '';

    // Load saved content from localStorage
    const savedContent = localStorage.getItem('toolsEditor_content') || '';

    toolsEditor = monaco.editor.create(els.tInput, {
        value: savedContent,
        language: 'json',
        theme: isDark ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        scrollBeyondLastLine: false,
        padding: { top: 10, bottom: 10 }
    });

    // Save content to localStorage on change
    toolsEditor.onDidChangeModelContent(() => {
        localStorage.setItem('toolsEditor_content', toolsEditor.getValue());
    });
}

// Check if Monaco is already loaded (e.g. from a previous run or global script)
if (window.monaco) {
    initMonacoEditor();
} else {
    // Initialize Monaco Loader
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        initMonacoEditor();
    });
}

// Helper functions for Tools Input
function getToolsInputValue() {
    return toolsEditor ? toolsEditor.getValue() : '';
}

function setToolsInputValue(val) {
    if (toolsEditor) {
        toolsEditor.setValue(val);
    }
}

els.themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    if (isDark) {
        document.documentElement.setAttribute('theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('theme');
        localStorage.setItem('theme', 'light');
    }
    updateTheme();
});

function updateTheme() {
    if (isDark) {
        document.documentElement.setAttribute('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('theme');
    }
    // Update Monaco Theme
    if (toolsEditor && window.monaco) {
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
    }
}

// --- NAVIGATION LOGIC ---
els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        els.tabs.forEach(t => t.classList.remove('active'));
        els.sections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        // Fix layout when switching to tools tab
        if (targetId === 'tools' && toolsEditor) {
            setTimeout(() => toolsEditor.layout(), 100);
        }
    });
});

// --- GENERATOR LOGIC ---
els.url.addEventListener('input', (e) => {
    const val = e.target.value;
    validateForm();
    if (val.includes('/raw/') && !state.editingId) {
        try {
            const parts = val.split('/');
            const potentialFilename = parts[parts.length - 1];
            if (!els.filename.value) els.filename.value = decodeURIComponent(potentialFilename);
            if (!els.title.value) {
                const nameWithoutExt = potentialFilename.split('.')[0];
                els.title.value = decodeURIComponent(nameWithoutExt)
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
            }
            validateForm();
        } catch (err) { console.error(err); }
    }
});

els.title.addEventListener('input', validateForm);
els.filename.addEventListener('input', validateForm);

function validateForm() {
    const isValid = els.url.value.trim() !== '' && els.title.value.trim() !== '';
    els.addBtn.disabled = !isValid;
}

function resetForm() {
    els.url.value = '';
    els.title.value = '';
    els.filename.value = '';
    validateForm();
    els.url.focus();
}

els.addBtn.addEventListener('click', () => {
    if (state.editingId) {
        const index = state.items.findIndex(i => i.id === state.editingId);
        if (index !== -1) {
            state.items[index] = {
                ...state.items[index],
                title: els.title.value,
                filename: els.filename.value || 'unknown.html',
                url: els.url.value
            };
        }
        cancelEdit();
    } else {
        state.items.push({
            id: state.nextId++,
            title: els.title.value,
            filename: els.filename.value || 'unknown.html',
            url: els.url.value
        });
        resetForm();
    }
    render();
});

window.editItem = function (id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    state.editingId = id;
    els.url.value = item.url;
    els.title.value = item.title;
    els.filename.value = item.filename;
    els.addBtn.innerHTML = `<i class="fas fa-save"></i> ZAPISZ ZMIANY`;
    els.cancelBtn.style.display = 'inline-block';
    validateForm();
    render();
};

function cancelEdit() {
    state.editingId = null;
    resetForm();
    els.addBtn.innerHTML = `<i class="fas fa-plus"></i> DODAJ DO LISTY`;
    els.cancelBtn.style.display = 'none';
    render();
}

els.cancelBtn.addEventListener('click', cancelEdit);

window.removeItem = function (id) {
    if (state.editingId === id) cancelEdit();
    state.items = state.items.filter(item => item.id !== id);
    render();
}

els.clearBtn.addEventListener('click', () => {
    if (confirm('Wyczyścić całą listę?')) {
        cancelEdit();
        state.items = [];
        state.nextId = 1;
        render();
    }
});

els.importBtn.addEventListener('click', () => {
    els.importArea.classList.toggle('hidden');
});

els.confirmImport.addEventListener('click', async () => {
    const url = els.importUrl.value.trim();
    if (!url) return;

    els.confirmImport.textContent = "Ładowanie...";
    els.confirmImport.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Błąd sieci");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Format nie jest tablicą");

        state.items = data.map((item, index) => ({
            id: index + 1,
            title: item.title || 'Bez tytułu',
            filename: item.filename || 'unknown.html',
            url: item.url || '#'
        }));
        state.nextId = state.items.length + 1;
        render();
        showToast("Zaimportowano pomyślnie!");
        els.importArea.classList.add('hidden');
    } catch (error) {
        showToast("Błąd: " + error.message, 'error');
    } finally {
        els.confirmImport.textContent = "ZAŁADUJ";
        els.confirmImport.disabled = false;
    }
});

function highlightJSON(json) {
    if (!json) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function render() {
    let jsonStr = '';
    if (state.items.length) {
        jsonStr = highlightJSON(JSON.stringify(state.items, null, 2));
    } else {
        jsonStr = '<span style="color:var(--text-muted)">// Tutaj pojawi się JSON...</span>';
    }
    els.jsonOutput.innerHTML = jsonStr;
    els.count.textContent = state.items.length;
    els.clearBtn.style.display = state.items.length > 0 ? 'inline-block' : 'none';

    if (state.items.length === 0) {
        els.list.innerHTML = `<div class="empty-state">Brak elementów. Załaduj z URL lub dodaj ręcznie.</div>`;
        return;
    }

    els.list.innerHTML = '';
    state.items.forEach(item => {
        const isEditing = state.editingId === item.id;
        const el = document.createElement('div');
        el.className = `list-item ${isEditing ? 'editing' : ''}`;
        el.innerHTML = `
                <div class="item-info">
                    <div class="item-id">${item.id}</div>
                    <div class="item-text">
                        <h4>${escapeHtml(item.title)}</h4>
                        <p>${escapeHtml(item.filename)}</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editItem(${item.id})" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="removeItem(${item.id})" title="Usuń">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        els.list.appendChild(el);
    });
}

els.copyBtn.addEventListener('click', () => {
    if (state.items.length === 0) return;
    const jsonText = JSON.stringify(state.items, null, 2);
    navigator.clipboard.writeText(jsonText).then(() => {
        showToast("JSON skopiowany do schowka", "success");
    }).catch(() => {
        showToast("Błąd kopiowania do schowka", "error");
    });
});

// --- TOOLS ---

// UTF-8 handling for Polish characters
function utf8_to_b64(str) {
    try {
        return window.btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        throw new Error("Błąd kodowania znaków.");
    }
}

function b64_to_utf8(str) {
    try {
        return decodeURIComponent(escape(window.atob(str)));
    } catch (e) {
        throw new Error("Nieprawidłowy ciąg Base64.");
    }
}

window.toolsEncode = function () {
    const val = getToolsInputValue().trim();
    if (!val) {
        showToast("Wpisz tekst do zakodowania", "warning");
        return;
    }
    try {
        try {
            JSON.parse(val);
            els.tStatus.textContent = "Wykryto poprawny JSON";
        } catch (e) {
            els.tStatus.textContent = "Traktowane jako zwykły tekst";
        }
        const encoded = utf8_to_b64(val);
        els.tOutput.value = encoded;
        els.tStatus.textContent = `Zakodowano: ${encoded.length} znaków`;
        showToast("Pomyślnie zakodowano", "success");
    } catch (err) {
        showToast("Błąd kodowania: " + err.message, "error");
    }
}

window.toolsDecode = function () {
    const val = els.tOutput.value.trim();
    if (!val) {
        showToast("Wpisz kod Base64", "warning");
        return;
    }
    try {
        const decoded = b64_to_utf8(val);
        setToolsInputValue(decoded);

        try {
            const jsonObj = JSON.parse(decoded);
            setToolsInputValue(JSON.stringify(jsonObj, null, 2));
            els.tStatus.textContent = "Rozkodowano i sformatowano JSON";
        } catch (e) {
            els.tStatus.textContent = "Rozkodowano jako tekst";
        }

        showToast("Pomyślnie rozkodowano", "success");
    } catch (err) {
        showToast("Błąd: Nieprawidłowy Base64", "error");
        els.tStatus.textContent = "Błąd dekodowania";
    }
}

window.toolsPrettify = function () {
    try {
        const val = getToolsInputValue();
        const obj = JSON.parse(val);
        setToolsInputValue(JSON.stringify(obj, null, 2));
        els.tStatus.textContent = "JSON sformatowany";
        showToast("Sformatowano", "success");
    } catch (e) {
        showToast("To nie jest poprawny JSON", "error");
        els.tStatus.textContent = "Błąd składni JSON";
    }
}

window.toolsMinify = function () {
    try {
        const val = getToolsInputValue();
        const obj = JSON.parse(val);
        setToolsInputValue(JSON.stringify(obj));
        els.tStatus.textContent = "JSON zminifikowany";
        showToast("Zminifikowano", "success");
    } catch (e) {
        showToast("To nie jest poprawny JSON", "error");
    }
}

window.clearField = function (id) {
    if (id === 'toolsInput') {
        setToolsInputValue('');
        els.tStatus.textContent = "Wyczyszczono";
    } else {
        document.getElementById(id).value = '';
        if (id === 'toolsOutput') {
            els.tStatus.textContent = "Wyczyszczono";
        }
    }
}

window.pasteTo = async function (id) {
    try {
        const text = await navigator.clipboard.readText();
        if (id === 'toolsInput') {
            setToolsInputValue(text);
        } else {
            document.getElementById(id).value = text;
        }
    } catch (e) { }
}

window.copyToClipboard = function (id) {
    const el = document.getElementById(id);
    if (el.value) {
        el.select();
        document.execCommand('copy');
        showToast("Skopiowano", "success");
        window.getSelection().removeAllRanges();
    }
}

// Utils
function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = document.getElementById('toastIcon');

    msgEl.textContent = msg;
    toast.className = 'toast show';

    iconEl.className = type === 'success' ? 'fas fa-check' :
        type === 'error' ? 'fas fa-exclamation-triangle' :
            'fas fa-exclamation';

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}


// --- RESIZING LOGIC ---
if (els.toolsResizer && els.toolsContainer) {
    els.toolsResizer.addEventListener('mousedown', function (e) {
        e.preventDefault();

        // Add listeners to document to handle dragging outside the element
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);

        // Visual feedback
        els.toolsResizer.classList.add('active');

        // Disable pointer events on frames/editors to prevent event capturing
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        els.tInput.style.pointerEvents = 'none';
    });

    function resize(e) {
        const containerRect = els.toolsContainer.getBoundingClientRect();

        // Calculate X position relative to container
        let x = e.clientX - containerRect.left;

        // Set constraints (min width 150px for panels)
        const minWidth = 150;
        if (x < minWidth) x = minWidth;
        if (x > containerRect.width - minWidth) x = containerRect.width - minWidth;

        // Calculate percentage for the left column
        const leftPercent = (x / containerRect.width) * 100;

        // Apply grid template: left% gutter(12px) right(auto/1fr)
        els.toolsContainer.style.gridTemplateColumns = `${leftPercent}% 12px 1fr`;

        // Force layout update for Monaco
        if (toolsEditor) toolsEditor.layout();
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);

        els.toolsResizer.classList.remove('active');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        els.tInput.style.pointerEvents = '';

        if (toolsEditor) toolsEditor.layout();
    }
}


render();