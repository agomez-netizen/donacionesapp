// ===============================
// Donaciones Solidarias - app.js
// Conectado a Google Sheets (Apps Script Web App)
// ===============================

// URL de tu Apps Script (Web App)
const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbxZW8d212MGs7gy6yyrxIG5lKaEk3PMT7rkMQvwiU_zAA80AinOIFa3XFOXeRwK25UxHA/exec";

  // Helpers
const $ = (sel) => document.querySelector(sel);

const catalogGrid = $("#catalogGrid");
const itemSelect = $("#itemSelect");
const donationForm = $("#donationForm");
const formStatus = $("#formStatus");

// Emojis por categoría principal (fallback)
const categoryEmoji = {
  "Alimentos No Perecederos": "🥫",
  "Ropa y Abrigos": "🧥",
  "Artículos de Higiene": "🧼",
  "Útiles Escolares": "🎒",
};

const pagination = document.getElementById("pagination");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const pageInfo = document.getElementById("pageInfo");

let ALL_ITEMS = [];
let CURRENT_PAGE = 1;
const PAGE_SIZE = 8; // ✅ cámbialo (8, 12, 16...)

// ===============================
// Util: convertir URL/ID de Drive a imagen usable
// ===============================
function driveImageUrl(input) {
  if (!input) return null;

  const str = String(input).trim();

  // Si ya viene URL directa googleusercontent
  if (str.includes("googleusercontent.com")) return str;

  // Extraer ID desde /file/d/ID/...
  const match = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const id = match?.[1] || (/^[a-zA-Z0-9_-]{20,}$/.test(str) ? str : null);
  if (!id) return null;

  // Mejor opción para <img>
  return `https://lh3.googleusercontent.com/d/${id}`;
}

// ===============================
// Progreso: "X/Y" -> barra
// ===============================
function renderProgressBar(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return "";

  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return "";

  const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));

  return `
    <div class="progress" aria-label="Progreso ${current} de ${total}">
      <div class="progress-top">
        <span class="progress-text">${current} / ${total}</span>
        <span class="progress-pct">${pct}%</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${total}">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

// ===============================
// Render catálogo (tarjetas)
// ===============================
function renderCatalog(items) {
  // Guardamos todos los activos una sola vez
  ALL_ITEMS = (items || []).filter(x => (x.estado || "").toUpperCase() === "ACTIVO");

  if (ALL_ITEMS.length === 0) {
    catalogGrid.innerHTML = `
      <article class="card">
        <div class="card-body">
          <h3 class="card-title">No hay productos disponibles</h3>
          <p class="card-desc">Revisa la hoja "catalogo" o activa productos.</p>
        </div>
      </article>
    `;
    if (pagination) pagination.style.display = "none";
    return;
  }

  // Reset a la página 1 cuando carga/recarga
  CURRENT_PAGE = 1;
  renderPage();
}


function renderPage() {
  const totalPages = Math.ceil(ALL_ITEMS.length / PAGE_SIZE);
  CURRENT_PAGE = Math.max(1, Math.min(CURRENT_PAGE, totalPages));

  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const pageItems = ALL_ITEMS.slice(start, start + PAGE_SIZE);

  const html = pageItems.map((item) => {
    const emoji = categoryEmoji[item.categoria] || "🎁";
    const imageUrl = driveImageUrl(item.imagenId);

    return `
      <article class="card" data-item-id="${escapeHtml(item.id)}">
        <div class="card-media">
          ${
            imageUrl
              ? `<img
                  src="${imageUrl}"
                  alt="${escapeHtml(item.nombre)}"
                  loading="lazy"
                  onerror="this.outerHTML='<div class=&quot;emoji&quot; aria-hidden=&quot;true&quot;>${emoji}</div>'"
                />`
              : `<div class="emoji" aria-hidden="true">${emoji}</div>`
          }
        </div>

        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.nombre)}</h3>
          <p class="card-desc">${escapeHtml(item.descripcion || "")}</p>
          ${renderProgressBar(item.progreso)}
        </div>

        <div class="card-actions">
          <a class="btn btn-success btn-card" href="#donar" data-select-item="${escapeHtml(item.id)}">
            Donar
          </a>
        </div>
      </article>
    `;
  }).join("");

  catalogGrid.innerHTML = html;

  // Paginación UI
  if (pagination) pagination.style.display = "flex";
  if (pageInfo) pageInfo.textContent = `Pág. ${CURRENT_PAGE} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = CURRENT_PAGE === 1;
  if (btnNext) btnNext.disabled = CURRENT_PAGE === totalPages;

  // ✅ IMPORTANTE: el click handler debe estar UNA SOLA VEZ
  // (lo manejamos fuera con setupCatalogClickHandler)
}

function setupPagination() {
  if (!btnPrev || !btnNext) return;

  btnPrev.addEventListener("click", () => {
    CURRENT_PAGE--;
    renderPage();
    document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
  });

  btnNext.addEventListener("click", () => {
    CURRENT_PAGE++;
    renderPage();
    document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
  });
}

function setupCatalogClickHandler() {
  catalogGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select-item]");
    if (!btn) return;

    const id = btn.getAttribute("data-select-item");
    if (!id) return;

    itemSelect.value = id;

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const productoNombre = selectedOption
      ? selectedOption.textContent.split("—")[0].trim()
      : "este producto";

    const mensajeInput = donationForm.querySelector('textarea[name="mensaje"]');
    if (mensajeInput) {
      mensajeInput.value =
        `Buen día, estoy interesado en participar donando ${productoNombre}. ` +
        `Dejo mis datos para que se comuniquen conmigo y gestionemos mi aporte.`;
      mensajeInput.focus({ preventScroll: true });
    }

    document.querySelector("#donar")?.scrollIntoView({ behavior: "smooth" });
  });
}

// ===============================
// Llenar <select> productos
// ===============================
function fillItemSelect(items) {
  const active = (items || []).filter(
    (x) => (x.estado || "").toUpperCase() === "ACTIVO"
  );

  itemSelect.innerHTML =
    `<option value="" selected disabled>Elige un producto…</option>`;

  for (const item of active) {
    const opt = document.createElement("option");
    opt.value = item.id;
    const desc = item.descripcion ? ` — ${item.descripcion}` : "";
    opt.textContent = `${item.nombre}${desc}`;
    itemSelect.appendChild(opt);
  }
}

// ===============================
// Cargar catálogo desde API
// ===============================
async function loadCatalogFromApi() {
  catalogGrid.innerHTML = `
    <article class="card skeleton"><div class="card-media"></div></article>
    <article class="card skeleton"><div class="card-media"></div></article>
    <article class="card skeleton"><div class="card-media"></div></article>
    <article class="card skeleton"><div class="card-media"></div></article>
  `;

  try {
    const res = await fetch(`${API_BASE_URL}?action=catalogo`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || "Error");

    renderCatalog(data.items);
    fillItemSelect(data.items);
  } catch (err) {
    console.error(err);
    catalogGrid.innerHTML = `
      <article class="card">
        <div class="card-body">
          <h3 class="card-title">No se pudo cargar el catálogo</h3>
          <p class="card-desc">Revisa conexión o permisos.</p>
        </div>
      </article>
    `;
  }
}

// ===============================
// Enviar donación
// ===============================
async function postDonation(data) {
  try {
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "donar", ...data }),
    });
    return await res.json();
  } catch {
    const form = new URLSearchParams({ action: "donar", ...data });
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: form.toString(),
    });
    return await res.json();
  }
}

// ===============================
// Form submit
// ===============================
function setupFormSubmit() {
  donationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(donationForm).entries());
    data.cantidad = Number(data.cantidad || 0);

    if (!data.nombreDonante || !data.contacto || !data.ciudad || !data.itemId) {
      setStatus("Completa los campos obligatorios.", "warn");
      return;
    }

    setStatus("Enviando…", "info");
    setFormDisabled(true);

    try {
      const result = await postDonation(data);
      if (!result.ok) throw new Error(result.error);

      setStatus("¡Gracias por sumarte a esta causa! Pronto nos comunicaremos contigo.😌", "ok");
      donationForm.reset();
      itemSelect.value = "";
    } catch (err) {
      console.error(err);
      setStatus("Error al enviar la información.", "error");
    } finally {
      setFormDisabled(false);
    }
  });
}

// ===============================
// UI helpers
// ===============================
function setStatus(message, type) {
  formStatus.textContent = message;
  const colors = {
    info: "var(--muted)",
    ok: "#245d3c",
    warn: "#8a5a00",
    error: "#8a1f2d",
  };
  formStatus.style.color = colors[type] || "var(--muted)";
}

function setFormDisabled(disabled) {
  donationForm
    .querySelectorAll("input, select, textarea, button")
    .forEach((el) => (el.disabled = disabled));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===============================
// INIT
// ===============================
(function init() {
  loadCatalogFromApi();
  setupFormSubmit();
  setupPagination();
  setupCatalogClickHandler();
})();



function saveInteresado(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName("interesados");

  if (!sh) {
    throw new Error('No existe la hoja "interesados"');
  }

  sh.appendRow([
    new Date(),                 // timestamp
    data.nombreDonante || "",
    data.contacto || "",
    data.ciudad || "",
    data.itemId || "",
    Number(data.cantidad || 0),
    data.mensaje || ""
  ]);
}


document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("heroVideo");
  const btn = document.getElementById("btnSound");
  if (!video || !btn) return;

  video.muted = true;

  const render = () => {
    btn.textContent = video.muted ? "🔊 Activar sonido" : "🔇 Silenciar";
  };

  render();

  btn.addEventListener("click", async () => {
    await video.play();
    video.muted = !video.muted;
    render();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;

  const closeMenu = () => {
    nav.classList.remove("nav-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // cerrar al hacer click en un link
  nav.addEventListener("click", (e) => {
    if (e.target.closest(".nav-link")) closeMenu();
  });

  // cerrar si tocas fuera
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("nav-open") && !nav.contains(e.target) && !toggle.contains(e.target)) {
      closeMenu();
    }
  });

  // si cambia a desktop, cierra el menú
  window.addEventListener("resize", () => {
    if (window.innerWidth > 560) closeMenu();
  });
});


