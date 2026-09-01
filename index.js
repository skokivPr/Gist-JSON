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
    const theme = isDark ? "terminal-dark" : "terminal-light";
    try {
      monaco.editor.setTheme(theme);
    } catch (e) {
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

// --- MONACO ENVIRONMENT & INIT (v0.56.0) ---
window.MonacoEnvironment = {
  getWorkerUrl: function (workerId, label) {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.56.0/min/' };
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.56.0/min/vs/base/worker/workerMain.js');
        `)}`;
  },
};

function initMonaco() {
  if (toolsEditor) return;
  els.tInput.innerHTML = "";

  let theme = isDark ? "terminal-dark" : "terminal-light";
  try {
    if (typeof monaco !== "undefined" && monaco.editor) {
      monaco.editor.setTheme(theme);
    }
  } catch (e) {
    theme = isDark ? "vs-dark" : "vs";
  }

  toolsEditor = monaco.editor.create(els.tInput, {
    value: localStorage.getItem("toolsEditor_content") || "",
    language: "json",
    theme: theme,
    automaticLayout: true,
    minimap: { enabled: true },
    fontFamily:
      "'JetBrains Mono', 'Share Tech Mono', 'Consolas', 'Monaco', 'Courier New', monospace",
    fontSize: 12,
    scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 },
    fontLigatures: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indent: true },
    renderLineHighlight: "line",
    smoothScrolling: true,
    mouseWheelZoom: true,
    wordWrap: "on",
  });

  toolsEditor.onDidChangeModelContent(() =>
    localStorage.setItem("toolsEditor_content", toolsEditor.getValue()),
  );
}

if (window.monaco) {
  setTimeout(() => initMonaco(), 100);
} else {
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.56.0/min/vs",
    },
  });
  require(["vs/editor/editor.main"], () => {
    setTimeout(() => initMonaco(), 100);
  });
}

function getToolsVal() {
  return toolsEditor ? toolsEditor.getValue() : "";
}
function setToolsVal(v) {
  if (toolsEditor) toolsEditor.setValue(v);
}

// --- NAVIGATION ---
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    els.sections.forEach((s) => s.classList.remove("active"));

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    const target = document.getElementById(tab.dataset.target);
    if (target) {
      target.classList.add("active");
      target.setAttribute("aria-hidden", "false");
    }

    els.sections.forEach((s) => {
      if (s !== target) s.setAttribute("aria-hidden", "true");
    });

    if (tab.dataset.target === "tools" && toolsEditor) {
      setTimeout(() => toolsEditor.layout(), 50);
    }
  });
});

// --- GENERATOR LOGIC ---
function validate() {
  els.addBtn.disabled = !(els.url.value.trim() && els.title.value.trim());
}

els.url.addEventListener("input", (e) => {
  validate();
  if (e.target.value.includes("/raw/") && !state.editingId) {
    try {
      const parts = e.target.value.split("/");
      const fname = parts[parts.length - 1];
      if (!els.filename.value) els.filename.value = decodeURIComponent(fname);
      if (!els.title.value) {
        els.title.value = decodeURIComponent(fname.split(".")[0])
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
      validate();
    } catch (err) {
      console.warn("Błąd parsowania URL", err);
    }
  }
});

els.title.addEventListener("input", validate);
els.filename.addEventListener("input", validate);

function resetForm() {
  els.url.value = "";
  els.title.value = "";
  els.filename.value = "";
  validate();
}

function resetEdit() {
  state.editingId = null;
  resetForm();
  els.addBtn.textContent = "DODAJ DO BUFORA";
  els.cancelBtn.classList.add("hidden");
  render();
}

els.addBtn.addEventListener("click", () => {
  const newItem = {
    title: els.title.value.trim(),
    filename: els.filename.value.trim() || "unknown",
    url: els.url.value.trim(),
  };

  if (state.editingId) {
    const idx = state.items.findIndex((i) => i.id === state.editingId);
    if (idx !== -1) state.items[idx] = { ...state.items[idx], ...newItem };
    resetEdit();
  } else {
    state.items.push({ id: state.nextId++, ...newItem });
    resetForm();
  }
  render();
});

els.cancelBtn.addEventListener("click", resetEdit);

window.editItem = function (id) {
  const item = state.items.find((i) => i.id === id);
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
  state.items = state.items.filter((i) => i.id !== id);
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
els.importBtn.addEventListener("click", () =>
  els.importArea.classList.toggle("hidden"),
);

els.confirmImport.addEventListener("click", async () => {
  if (!els.importUrl.value.trim()) return;
  els.confirmImport.textContent = "LOADING...";
  try {
    const res = await fetch(els.importUrl.value);
    if (!res.ok) throw new Error("Błąd sieci");
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("Oczekiwano tablicy JSON");

    state.items = data.map((i, idx) => ({
      id: idx + 1,
      title: i.title || "Bez tytułu",
      filename: i.filename || "file",
      url: i.url || "#",
    }));

    state.nextId = state.items.length + 1;
    render();
    toast("Import zakończony.");
    els.importArea.classList.add("hidden");
  } catch (e) {
    console.error(e);
    toast("Błąd importu.", "err");
  } finally {
    els.confirmImport.textContent = "LOAD";
  }
});

// --- RENDER ---
function render() {
  const jsonStr = state.items.length
    ? JSON.stringify(state.items, null, 2)
    : "| Oczekiwanie na dane...";

  els.jsonOutput.innerHTML = highlight(jsonStr);
  els.count.textContent = state.items.length;
  els.clearBtn.classList.toggle("hidden", state.items.length === 0);

  const listHtml = state.items
    .map(
      (i) => `
        <div class="list-item ${state.editingId === i.id ? "editing" : ""}">
            <div class="item-meta">
                <div class="item-title"><span class="item-id">[ID:${String(i.id).padStart(2, "0")}]</span>${escapeHTML(i.title)}</div>
                <div class="item-file">${escapeHTML(i.filename)}</div>
            </div>
            <div class="item-actions">
                <button onclick="editItem(${i.id})" class="btn-base btn-icon" style="width:28px;height:28px;font-size:1rem;"><i class="fas fa-edit"></i></button>
                <button onclick="removeItem(${i.id})" class="btn-base btn-icon btn-danger" style="width:28px;height:28px;font-size:1rem;"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `,
    )
    .join("");

  els.list.innerHTML =
    listHtml ||
    `<div style="text-align: center; padding: 20px 10px; color: var(--text-muted); font-size: 0.75rem;">| OCZEKIWANIE NA DANE...</div>`;

  if (isGridView) {
    els.list.classList.replace("list-view", "grid-view");
    if (!els.list.classList.contains("grid-view"))
      els.list.classList.add("grid-view");
    els.viewToggleBtn.innerHTML = '<i class="fas fa-list"></i>';
  } else {
    els.list.classList.replace("grid-view", "list-view");
    if (!els.list.classList.contains("list-view"))
      els.list.classList.add("list-view");
    els.viewToggleBtn.innerHTML = '<i class="fas fa-th-large"></i>';
  }
}

els.viewToggleBtn.addEventListener("click", () => {
  isGridView = !isGridView;
  localStorage.setItem("viewMode", isGridView ? "grid" : "list");
  render();
});

els.copyBtn.addEventListener("click", async () => {
  if (!state.items.length) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.items, null, 2));
    toast("JSON w schowku.");
  } catch (e) {
    toast("Błąd kopiowania", "err");
  }
});

// --- TOOLS ---
window.toolsEncode = () => {
  try {
    els.tOutput.value = btoa(unescape(encodeURIComponent(getToolsVal())));
    toast("Base64 Encoded.");
  } catch (e) {
    toast("Błąd kodowania.", "err");
  }
};

window.toolsDecode = () => {
  try {
    const dec = decodeURIComponent(escape(atob(els.tOutput.value.trim())));
    setToolsVal(dec);
    try {
      setToolsVal(JSON.stringify(JSON.parse(dec), null, 2));
    } catch (e) {
      // Ignoruj błąd formatowania, jeśli zdekodowany string nie jest JSONem
    }
    toast("Decoded.");
  } catch (e) {
    toast("Błąd dekodowania Base64.", "err");
  }
};

window.toolsPrettify = () => {
  try {
    setToolsVal(JSON.stringify(JSON.parse(getToolsVal()), null, 2));
    toast("Formatted.");
  } catch (e) {
    toast("Błąd składni JSON.", "err");
  }
};

window.toolsMinify = () => {
  try {
    setToolsVal(JSON.stringify(JSON.parse(getToolsVal())));
    toast("Minified.");
  } catch (e) {
    toast("Błąd składni JSON.", "err");
  }
};

window.clearField = (id) => {
  if (id === "toolsInput") setToolsVal("");
  else document.getElementById(id).value = "";
};

window.copyToClipboard = async (id) => {
  try {
    const el = document.getElementById(id);
    const textToCopy = el.value !== undefined ? el.value : el.textContent;
    await navigator.clipboard.writeText(textToCopy);
    toast("Skopiowano.");
  } catch (e) {
    toast("Błąd kopiowania.", "err");
  }
};

window.pasteTo = async (id) => {
  try {
    const text = await navigator.clipboard.readText();
    if (id === "toolsInput") setToolsVal(text);
    else document.getElementById(id).value = text;
  } catch (e) {
    toast("Brak dostępu do schowka.", "err");
  }
};

// --- HELPERS ---
function toast(msg, type = "ok") {
  const t = document.getElementById("toast");
  document.getElementById("toastMessage").textContent = msg;
  document.getElementById("toastIcon").className =
    type === "ok" ? "fas fa-check" : "fas fa-exclamation";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function confirmAction(msg) {
  return new Promise((resolve) => {
    document.getElementById("confirmMessage").textContent = msg;
    const m = document.getElementById("confirmModal");
    m.classList.add("active");
    const close = (res) => {
      m.classList.remove("active");
      els.confirmOkBtn.onclick = null;
      els.confirmCancelBtn.onclick = null;
      resolve(res);
    };
    els.confirmOkBtn.onclick = () => close(true);
    els.confirmCancelBtn.onclick = () => close(false);
  });
}

function highlight(json) {
  return escapeHTML(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = "json-key";
        else cls = "json-string";
      } else if (/true|false/.test(match)) cls = "json-boolean";
      else if (/null/.test(match)) cls = "json-null";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function escapeHTML(t) {
  return t
    ? String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    : "";
}

// --- RESIZER ---
if (els.resizer) {
  const handleMouseMove = (e) => {
    const box = els.leftPanel.parentElement.getBoundingClientRect();
    if (window.innerWidth > 900) {
      const percent = ((e.clientX - box.left) / box.width) * 100;
      if (percent > 10 && percent < 90) {
        els.leftPanel.style.flex = `0 0 ${percent}%`;
      }
    }
    if (toolsEditor) toolsEditor.layout();
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "default";
  };

  els.resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });
}

// Inicjalizacja
render();
