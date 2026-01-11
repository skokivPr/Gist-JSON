/* --- CORE LOGIC --- */
        const state = { items: [], nextId: 1, editingId: null };
        let toolsEditor = null;
        let isGridView = localStorage.getItem("viewMode") === "grid";

        // DOM Cache
        const els = {
            tabs: document.querySelectorAll(".btn-base[data-target]"),
            sections: document.querySelectorAll(".view-section"),
            themeToggle: document.getElementById("themeToggle"),
            url: document.getElementById("urlInput"),
            title: document.getElementById("titleInput"),
            filename: document.getElementById("filenameInput"),
            addBtn: document.getElementById("addBtn"),
            cancelBtn: document.getElementById("cancelBtn"),
            list: document.getElementById("list"),
            count: document.getElementById("count"),
            jsonOutput: document.getElementById("jsonOutput"),
            copyBtn: document.getElementById("copyBtn"),
            clearBtn: document.getElementById("clearBtn"),
            importBtn: document.getElementById("importBtn"),
            importArea: document.getElementById("importArea"),
            importUrl: document.getElementById("importUrlInput"),
            confirmImport: document.getElementById("confirmImportBtn"),
            tInput: document.getElementById("toolsInput"),
            tOutput: document.getElementById("toolsOutput"),
            resizer: document.getElementById("toolsResizer"),
            leftPanel: document.getElementById("toolsLeftPanel"),
            viewToggleBtn: document.getElementById("viewToggleBtn"),
            confirmModal: document.getElementById("confirmModal"),
            confirmOkBtn: document.getElementById("confirmOkBtn"),
            confirmCancelBtn: document.getElementById("confirmCancelBtn"),
        };

        // --- THEME ---
        let isDark = localStorage.getItem("theme") !== "light";
        function updateTheme() {
            document.documentElement.setAttribute("theme", isDark ? "dark" : "light");
            if (toolsEditor && window.monaco) {
                // Użyj motywów z monaco-styles.js jeśli są dostępne, w przeciwnym razie fallback do standardowych
                const theme = isDark ? 'terminal-dark' : 'terminal-light';
                try {
                    monaco.editor.setTheme(theme);
                } catch (e) {
                    // Fallback do standardowych motywów jeśli niestandardowe nie są dostępne
                    monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
                }
            }
        }
        updateTheme();
        els.themeToggle.addEventListener("click", () => {
            isDark = !isDark;
            localStorage.setItem("theme", isDark ? "dark" : "light");
            updateTheme();
        });

        // --- MONACO ---
        function initMonaco() {
            if (toolsEditor) return;
            els.tInput.innerHTML = "";

            // Użyj motywów z monaco-styles.js jeśli są dostępne
            let theme = isDark ? 'terminal-dark' : 'terminal-light';
            try {
                // Sprawdź czy motyw jest zdefiniowany
                if (typeof monaco !== 'undefined' && monaco.editor) {
                    // Spróbuj ustawić motyw - jeśli nie istnieje, zostanie rzucony błąd
                    monaco.editor.setTheme(theme);
                }
            } catch (e) {
                // Fallback do standardowych motywów
                theme = isDark ? "vs-dark" : "vs";
            }

            toolsEditor = monaco.editor.create(els.tInput, {
                value: localStorage.getItem("toolsEditor_content") || "",
                language: "json",
                theme: theme,
                automaticLayout: true,
                minimap: { enabled: false },
                fontFamily: "'JetBrains Mono', 'Share Tech Mono', 'Consolas', 'Monaco', 'Courier New', monospace",
                fontSize: 12,
                scrollBeyondLastLine: false,
                padding: { top: 10, bottom: 10 },
                minimap: { enabled: true },
                fontLigatures: true,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indent: true },
                renderLineHighlight: 'line',
                smoothScrolling: true,
                mouseWheelZoom: true,
                wordWrap: 'on'
            });
            toolsEditor.onDidChangeModelContent(() => localStorage.setItem("toolsEditor_content", toolsEditor.getValue()));
        }

        if (window.monaco) {
            // Monaco już załadowany, poczekaj na załadowanie motywów
            setTimeout(() => initMonaco(), 100);
        } else {
            require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs" } });
            require(["vs/editor/editor.main"], () => {
                // Poczekaj na załadowanie motywów z monaco-styles.js
                setTimeout(() => initMonaco(), 100);
            });
        }

        function getToolsVal() { return toolsEditor ? toolsEditor.getValue() : ""; }
        function setToolsVal(v) { if (toolsEditor) toolsEditor.setValue(v); }

        // --- NAVIGATION ---
        els.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                els.tabs.forEach(t => {
                    t.classList.remove("active");
                    t.setAttribute("aria-selected", "false");
                });
                els.sections.forEach(s => s.classList.remove("active"));
                tab.classList.add("active");
                tab.setAttribute("aria-selected", "true");
                const target = document.getElementById(tab.dataset.target);
                if (target) {
                    target.classList.add("active");
                    target.setAttribute("aria-hidden", "false");
                }
                els.sections.forEach(s => {
                    if (s !== target) s.setAttribute("aria-hidden", "true");
                });
                if (tab.dataset.target === "tools" && toolsEditor) setTimeout(() => toolsEditor.layout(), 50);
            });
        });

        // --- GENERATOR LOGIC ---
        els.url.addEventListener("input", (e) => {
            validate();
            if (e.target.value.includes("/raw/") && !state.editingId) {
                try {
                    const parts = e.target.value.split("/");
                    const fname = parts[parts.length - 1];
                    if (!els.filename.value) els.filename.value = decodeURIComponent(fname);
                    if (!els.title.value) els.title.value = decodeURIComponent(fname.split(".")[0]).replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    validate();
                } catch (err) { }
            }
        });
        els.title.addEventListener("input", validate);
        els.filename.addEventListener("input", validate);

        function validate() {
            els.addBtn.disabled = !(els.url.value.trim() && els.title.value.trim());
        }

        els.addBtn.addEventListener("click", () => {
            const newItem = {
                title: els.title.value,
                filename: els.filename.value || "unknown",
                url: els.url.value
            };

            if (state.editingId) {
                const idx = state.items.findIndex(i => i.id === state.editingId);
                if (idx !== -1) state.items[idx] = { ...state.items[idx], ...newItem };
                resetEdit();
            } else {
                state.items.push({ id: state.nextId++, ...newItem });
                resetForm();
            }
            render();
        });

        function resetForm() {
            els.url.value = ""; els.title.value = ""; els.filename.value = "";
            validate();
        }

        function resetEdit() {
            state.editingId = null;
            resetForm();
            els.addBtn.textContent = "DODAJ DO BUFORA";
            els.cancelBtn.classList.add("hidden");
            render();
        }
        els.cancelBtn.addEventListener("click", resetEdit);

        window.editItem = function (id) {
            const item = state.items.find(i => i.id === id);
            if (!item) return;
            state.editingId = id;
            els.url.value = item.url;
            els.title.value = item.title;
            els.filename.value = item.filename;
            els.addBtn.textContent = "AKTUALIZUJ REKORD";
            els.cancelBtn.classList.remove("hidden");
            validate();
            render();
        };

        window.removeItem = function (id) {
            if (state.editingId === id) resetEdit();
            state.items = state.items.filter(i => i.id !== id);
            render();
        };

        els.clearBtn.addEventListener("click", async () => {
            if (await confirmAction("Czy wyczyścić bufor danych?")) {
                resetEdit();
                state.items = [];
                state.nextId = 1;
                render();
                toast("Bufor wyczyszczony.");
            }
        });

        // Import
        els.importBtn.addEventListener("click", () => els.importArea.classList.toggle("hidden"));
        els.confirmImport.addEventListener("click", async () => {
            if (!els.importUrl.value) return;
            els.confirmImport.textContent = "LOADING...";
            try {
                const res = await fetch(els.importUrl.value);
                const data = await res.json();
                if (!Array.isArray(data)) throw new Error("Bad Format");
                state.items = data.map((i, idx) => ({
                    id: idx + 1,
                    title: i.title || "Bez tytułu",
                    filename: i.filename || "file",
                    url: i.url || "#"
                }));
                state.nextId = state.items.length + 1;
                render();
                toast("Import zakończony.");
                els.importArea.classList.add("hidden");
            } catch (e) { toast("Błąd importu.", "err"); }
            els.confirmImport.textContent = "LOAD";
        });

        // --- RENDER ---
        function render() {
            const jsonStr = state.items.length ? JSON.stringify(state.items, null, 2) : "// Oczekiwanie na dane...";
            els.jsonOutput.innerHTML = highlight(jsonStr);
            els.count.textContent = state.items.length;
            if (state.items.length) els.clearBtn.classList.remove("hidden");
            else els.clearBtn.classList.add("hidden");

            const listHtml = state.items.map(i => `
                <div class="list-item ${state.editingId === i.id ? 'editing' : ''}">
                    <div class="item-meta">
                        <div class="item-title"><span class="item-id">[ID:${String(i.id).padStart(2, '0')}]</span>${escape(i.title)}</div>
                        <div class="item-file">${escape(i.filename)}</div>
                    </div>
                    <div class="item-actions">
                        <button onclick="editItem(${i.id})" class="btn-base btn-icon" style="width:28px;height:28px;font-size:1rem;"><i class="fas fa-edit"></i></button>
                        <button onclick="removeItem(${i.id})" class="btn-base btn-icon btn-danger" style="width:28px;height:28px;font-size:1rem;"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `).join("");

            els.list.innerHTML = listHtml || `<div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 0.75rem;">OCZEKIWANIE NA DANE...</div>`;

            if (isGridView) {
                els.list.classList.remove('list-view');
                els.list.classList.add('grid-view');
                els.viewToggleBtn.innerHTML = '<i class="fas fa-list"></i>';
            } else {
                els.list.classList.remove('grid-view');
                els.list.classList.add('list-view');
                els.viewToggleBtn.innerHTML = '<i class="fas fa-th-large"></i>';
            }
        }

        els.viewToggleBtn.addEventListener("click", () => {
            isGridView = !isGridView;
            localStorage.setItem("viewMode", isGridView ? "grid" : "list");
            render();
        });

        els.copyBtn.addEventListener("click", () => {
            if (!state.items.length) return;
            navigator.clipboard.writeText(JSON.stringify(state.items, null, 2));
            toast("JSON w schowku.");
        });

        // --- TOOLS ---
        window.toolsEncode = () => { try { els.tOutput.value = btoa(unescape(encodeURIComponent(getToolsVal()))); toast("Base64 Encoded."); } catch (e) { toast("Error.", "err"); } };
        window.toolsDecode = () => { try { const dec = decodeURIComponent(escape(atob(els.tOutput.value.trim()))); setToolsVal(dec); try { setToolsVal(JSON.stringify(JSON.parse(dec), null, 2)); } catch (e) { } toast("Decoded."); } catch (e) { toast("Base64 Error.", "err"); } };
        window.toolsPrettify = () => { try { setToolsVal(JSON.stringify(JSON.parse(getToolsVal()), null, 2)); toast("Formatted."); } catch (e) { toast("JSON Error.", "err"); } };
        window.toolsMinify = () => { try { setToolsVal(JSON.stringify(JSON.parse(getToolsVal()))); toast("Minified."); } catch (e) { toast("JSON Error.", "err"); } };

        window.clearField = (id) => { if (id === 'toolsInput') setToolsVal(""); else document.getElementById(id).value = ""; };
        window.copyToClipboard = (id) => { document.getElementById(id).select(); document.execCommand("copy"); toast("Copied."); };
        window.pasteTo = async (id) => { try { setToolsVal(await navigator.clipboard.readText()); } catch (e) { } };

        // --- HELPERS ---
        function toast(msg, type = "ok") {
            const t = document.getElementById("toast");
            document.getElementById("toastMessage").textContent = msg;
            document.getElementById("toastIcon").className = type === "ok" ? "fas fa-check" : "fas fa-exclamation";
            t.classList.add("show");
            setTimeout(() => t.classList.remove("show"), 3000);
        }

        function confirmAction(msg) {
            return new Promise(resolve => {
                document.getElementById("confirmMessage").textContent = msg;
                const m = document.getElementById("confirmModal");
                m.classList.add("active");
                const close = (res) => { m.classList.remove("active"); resolve(res); };
                els.confirmOkBtn.onclick = () => close(true);
                els.confirmCancelBtn.onclick = () => close(false);
            });
        }

        function highlight(json) {
            return json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                    let cls = "json-number";
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) cls = "json-key";
                        else cls = "json-string";
                    } else if (/true|false/.test(match)) cls = "json-boolean";
                    else if (/null/.test(match)) cls = "json-null";
                    return '<span class="' + cls + '">' + match + "</span>";
                });
        }
        function escape(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;") : ""; }

        // --- RESIZER ---
        if (els.resizer) {
            els.resizer.onmousedown = (e) => {
                e.preventDefault();
                const isVertical = window.innerWidth <= 900;
                document.onmousemove = (e) => {
                    const box = document.querySelector(".panel").getBoundingClientRect(); // Parent container
                    if (isVertical) {
                        // Not implemented for simplicity in this version, simple flexbox handles mobile
                    } else {
                        const percent = ((e.clientX - box.left) / box.width) * 100;
                        if (percent > 10 && percent < 90) {
                            els.leftPanel.style.flex = `0 0 ${percent}%`;
                        }
                    }
                    if (toolsEditor) toolsEditor.layout();
                };
                document.onmouseup = () => { document.onmousemove = null; };
            };
        }

        render();
