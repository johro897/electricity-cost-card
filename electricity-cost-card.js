// =============================================================================
// electricity-cost-card — Home Assistant Custom Card
// =============================================================================
// Displays real-time electricity pricing from Nordpool with per-activity cost
// calculations. Activities without duration_hours show a simple cost + rec-
// ommendation. Activities with duration_hours show:
//   • Integrated cost if started NOW (summed over real 15-min price blocks)
//   • Cheapest window within search_hours, crossing midnight if needed
//
// Required sensor attributes:
//   state     — current price (currency/kWh)
//   today     — list of 96 × 15-minute price blocks for today
//   tomorrow  — list of 15-minute price blocks for tomorrow (available ~13:00)
//               When present, today+tomorrow are merged so graphs and best-
//               window searches cross midnight seamlessly.
//
// Optional sensor attributes (auto-detected if present):
//   currency  — ISO code (e.g. "SEK", "EUR") used to pick a display symbol
//   unit      — energy unit (e.g. "kWh")
//
// YAML config example:
//   type: custom:electricity-cost-card
//   entity: sensor.nordpool_kwh_se3_sek_3_10_025
//   title: My electricity cost   — optional, defaults to "Electricity cost"
//   hours_ahead: 6               — how many hours the price graph covers
//   search_hours: 12             — how far ahead to search for the best activity window
//   price_good: 1.5              — price ceiling (currency/kWh) for "Good price" badge
//   price_ok: 3.0                — price ceiling (currency/kWh) for "Normal" badge; above = "High price"
//   currency: "kr"                — optional. Suffix shown after prices, e.g. "kr", "€", "$".
//                                    If omitted, auto-detected from the sensor's `currency`
//                                    attribute (Nordpool sets this to an ISO code like SEK/EUR)
//                                    and mapped to a symbol. Falls back to "kr" if unavailable.
//   unit: "kWh"                   — optional. Suffix shown after currency, e.g. "kr/kWh".
//                                    Auto-detected from the sensor's `unit` attribute, falls
//                                    back to "kWh".
//   price_max: 5.0                — optional. Top of the price gauge/slider. Defaults to
//                                    price_ok × 5/3 (price_ok=3.0 → 5.0, the original scale).
//                                    Set explicitly for currencies with a different typical
//                                    range, e.g. price_max: 0.6 for EUR dynamic prices.
//   price_min: 0                  — optional. Bottom of the price gauge/slider. Default 0.
//   activities:
//     - name: Dishwasher
//       icon: "🍽️"
//       kwh_min: 0.7
//       kwh_max: 1.5
//       threshold: 1.2    — activity rec: Good ≤ threshold, OK ≤ threshold×2, else Wait
//       duration_hours: 2.0
//     - name: 10-min shower
//       icon: "🚿"
//       kwh_min: 4.0
//       kwh_max: 4.0
//       threshold: 1.5
// =============================================================================


const DEFAULT_LANG = "en";

// Every UI string this file's card + editor render, keyed by BCP-47 primary
// language subtag. Bundled inline (not fetched from separate
// translations/<lang>.json files) — see root CLAUDE.md's Kortkonventioner
// for why: HACS's plugin category only ever distributes the one file named
// in hacs.json, so extra files never reach a real install.
const TRANSLATIONS = {
  en: {
    title_default: "Electricity cost",
    loading: "Loading…",
    simulation_tag: "SIMULATION",
    price_status_good: "Good price",
    price_status_ok: "Normal",
    price_status_bad: "High price",
    simple_rec_good: "Good now",
    simple_rec_ok: "OK now",
    simple_rec_bad: "Wait",
    reset_live: "↺ Live",
    next_hours: "Next {hours} hours",
    activities_label: "Activities",
    simulate_price_aria: "Simulate price",
    no_price_data: "No price data available",
    best_window: "Best {start}–{end}",
    entity_required: "entity is required",
    editor_section_card_settings: "Card settings",
    editor_label_entity: "Nordpool entity",
    editor_label_title: "Card title (optional)",
    editor_label_hours_ahead: "Graph: hours ahead",
    editor_label_search_hours: "Best window: search hours",
    editor_label_price_good: "Good price ceiling (per kWh)",
    editor_label_price_ok: "Normal price ceiling (per kWh)",
    editor_section_advanced: "Advanced (optional)",
    editor_hint_advanced: "Leave blank to auto-detect from the sensor, or set explicitly for non-SEK currencies.",
    editor_label_currency: "Currency suffix",
    editor_placeholder_currency: "auto (kr, €, $...)",
    editor_label_unit: "Unit suffix",
    editor_placeholder_unit: "auto (kWh)",
    editor_label_price_max: "Gauge/slider max price",
    editor_placeholder_price_max: "auto (price_ok × 5/3)",
    editor_label_price_min: "Gauge/slider min price",
    editor_section_activities: "Activities",
    editor_add_activity: "+ Add activity",
    editor_section_yaml: "Generated YAML",
    editor_copy: "Copy",
    editor_copied: "Copied!",
    editor_activity_default_name: "Activity {n}",
    editor_remove: "Remove",
    editor_label_name: "Name",
    editor_placeholder_name: "e.g. Dishwasher",
    editor_label_icon: "Icon",
    editor_label_kwh_min: "Min kWh",
    editor_label_kwh_max: "Max kWh",
    editor_label_threshold: "Good-price threshold (per kWh)",
    editor_placeholder_threshold: "e.g. 1.5",
    editor_label_duration: "Duration (hours, optional)",
    editor_placeholder_duration: "e.g. 2.0",
  },
  sv: {
    title_default: "Elkostnad",
    loading: "Laddar…",
    simulation_tag: "SIMULERING",
    price_status_good: "Bra pris",
    price_status_ok: "Normalt",
    price_status_bad: "Högt pris",
    simple_rec_good: "Bra nu",
    simple_rec_ok: "OK nu",
    simple_rec_bad: "Vänta",
    reset_live: "↺ Live",
    next_hours: "Nästa {hours} timmar",
    activities_label: "Aktiviteter",
    simulate_price_aria: "Simulera pris",
    no_price_data: "Ingen prisdata tillgänglig",
    best_window: "Bäst {start}–{end}",
    entity_required: "entity krävs",
    editor_section_card_settings: "Kortinställningar",
    editor_label_entity: "Nordpool-entitet",
    editor_label_title: "Korttitel (valfritt)",
    editor_label_hours_ahead: "Graf: timmar framåt",
    editor_label_search_hours: "Bästa fönster: sök-timmar",
    editor_label_price_good: "Tak för bra pris (per kWh)",
    editor_label_price_ok: "Tak för normalt pris (per kWh)",
    editor_section_advanced: "Avancerat (valfritt)",
    editor_hint_advanced: "Lämna tomt för att auto-detektera från sensorn, eller ange explicit för icke-SEK-valutor.",
    editor_label_currency: "Valutasuffix",
    editor_placeholder_currency: "auto (kr, €, $...)",
    editor_label_unit: "Enhetssuffix",
    editor_placeholder_unit: "auto (kWh)",
    editor_label_price_max: "Mätare/slider: maxpris",
    editor_placeholder_price_max: "auto (price_ok × 5/3)",
    editor_label_price_min: "Mätare/slider: minpris",
    editor_section_activities: "Aktiviteter",
    editor_add_activity: "+ Lägg till aktivitet",
    editor_section_yaml: "Genererad YAML",
    editor_copy: "Kopiera",
    editor_copied: "Kopierat!",
    editor_activity_default_name: "Aktivitet {n}",
    editor_remove: "Ta bort",
    editor_label_name: "Namn",
    editor_placeholder_name: "t.ex. Diskmaskin",
    editor_label_icon: "Ikon",
    editor_label_kwh_min: "Min kWh",
    editor_label_kwh_max: "Max kWh",
    editor_label_threshold: "Tröskel för bra pris (per kWh)",
    editor_placeholder_threshold: "t.ex. 1.5",
    editor_label_duration: "Varaktighet (timmar, valfritt)",
    editor_placeholder_duration: "t.ex. 2.0",
  },
  de: {
    title_default: "Stromkosten",
    loading: "Wird geladen…",
    simulation_tag: "SIMULATION",
    price_status_good: "Guter Preis",
    price_status_ok: "Normal",
    price_status_bad: "Hoher Preis",
    simple_rec_good: "Jetzt gut",
    simple_rec_ok: "Jetzt OK",
    simple_rec_bad: "Warten",
    reset_live: "↺ Live",
    next_hours: "Nächste {hours} Stunden",
    activities_label: "Aktivitäten",
    simulate_price_aria: "Preis simulieren",
    no_price_data: "Keine Preisdaten verfügbar",
    best_window: "Beste Zeit {start}–{end}",
    entity_required: "entity ist erforderlich",
    editor_section_card_settings: "Karteneinstellungen",
    editor_label_entity: "Nordpool-Entität",
    editor_label_title: "Kartentitel (optional)",
    editor_label_hours_ahead: "Grafik: Stunden im Voraus",
    editor_label_search_hours: "Bestes Fenster: Suchstunden",
    editor_label_price_good: "Obergrenze guter Preis (pro kWh)",
    editor_label_price_ok: "Obergrenze normaler Preis (pro kWh)",
    editor_section_advanced: "Erweitert (optional)",
    editor_hint_advanced: "Leer lassen für automatische Erkennung vom Sensor, oder explizit für Nicht-SEK-Währungen festlegen.",
    editor_label_currency: "Währungssuffix",
    editor_placeholder_currency: "auto (kr, €, $...)",
    editor_label_unit: "Einheitssuffix",
    editor_placeholder_unit: "auto (kWh)",
    editor_label_price_max: "Anzeige/Regler: Höchstpreis",
    editor_placeholder_price_max: "auto (price_ok × 5/3)",
    editor_label_price_min: "Anzeige/Regler: Mindestpreis",
    editor_section_activities: "Aktivitäten",
    editor_add_activity: "+ Aktivität hinzufügen",
    editor_section_yaml: "Generiertes YAML",
    editor_copy: "Kopieren",
    editor_copied: "Kopiert!",
    editor_activity_default_name: "Aktivität {n}",
    editor_remove: "Entfernen",
    editor_label_name: "Name",
    editor_placeholder_name: "z. B. Geschirrspüler",
    editor_label_icon: "Symbol",
    editor_label_kwh_min: "Min. kWh",
    editor_label_kwh_max: "Max. kWh",
    editor_label_threshold: "Schwellenwert für guten Preis (pro kWh)",
    editor_placeholder_threshold: "z. B. 1.5",
    editor_label_duration: "Dauer (Stunden, optional)",
    editor_placeholder_duration: "z. B. 2.0",
  },
  fr: {
    title_default: "Coût de l'électricité",
    loading: "Chargement…",
    simulation_tag: "SIMULATION",
    price_status_good: "Bon prix",
    price_status_ok: "Normal",
    price_status_bad: "Prix élevé",
    simple_rec_good: "Bon maintenant",
    simple_rec_ok: "OK maintenant",
    simple_rec_bad: "Attendre",
    reset_live: "↺ Direct",
    next_hours: "Prochaines {hours} heures",
    activities_label: "Activités",
    simulate_price_aria: "Simuler le prix",
    no_price_data: "Aucune donnée de prix disponible",
    best_window: "Meilleur créneau {start}–{end}",
    entity_required: "entity est requis",
    editor_section_card_settings: "Paramètres de la carte",
    editor_label_entity: "Entité Nordpool",
    editor_label_title: "Titre de la carte (facultatif)",
    editor_label_hours_ahead: "Graphique : heures à venir",
    editor_label_search_hours: "Meilleur créneau : heures de recherche",
    editor_label_price_good: "Plafond bon prix (par kWh)",
    editor_label_price_ok: "Plafond prix normal (par kWh)",
    editor_section_advanced: "Avancé (facultatif)",
    editor_hint_advanced: "Laisser vide pour la détection automatique depuis le capteur, ou définir explicitement pour les devises autres que SEK.",
    editor_label_currency: "Suffixe de devise",
    editor_placeholder_currency: "auto (kr, €, $...)",
    editor_label_unit: "Suffixe d'unité",
    editor_placeholder_unit: "auto (kWh)",
    editor_label_price_max: "Jauge/curseur : prix maximum",
    editor_placeholder_price_max: "auto (price_ok × 5/3)",
    editor_label_price_min: "Jauge/curseur : prix minimum",
    editor_section_activities: "Activités",
    editor_add_activity: "+ Ajouter une activité",
    editor_section_yaml: "YAML généré",
    editor_copy: "Copier",
    editor_copied: "Copié !",
    editor_activity_default_name: "Activité {n}",
    editor_remove: "Supprimer",
    editor_label_name: "Nom",
    editor_placeholder_name: "ex. Lave-vaisselle",
    editor_label_icon: "Icône",
    editor_label_kwh_min: "kWh min",
    editor_label_kwh_max: "kWh max",
    editor_label_threshold: "Seuil de bon prix (par kWh)",
    editor_placeholder_threshold: "ex. 1.5",
    editor_label_duration: "Durée (heures, facultatif)",
    editor_placeholder_duration: "ex. 2.0",
  },
};

/** Resolves the HA-configured language to one of our translated languages, falling back to English. */
function _lang(hass) {
  const raw = (hass?.locale?.language || hass?.language || DEFAULT_LANG).toLowerCase();
  const primary = raw.split("-")[0];
  return TRANSLATIONS[primary] ? primary : DEFAULT_LANG;
}

/** Looks up a UI string in the current language, with {placeholder} substitution. */
function _t(hass, key, replacements) {
  const dict = TRANSLATIONS[_lang(hass)] || TRANSLATIONS[DEFAULT_LANG];
  const raw = dict[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
  if (!replacements) return raw;
  return raw.replace(/\{([^}]+)\}/g, (match, k) =>
    Object.prototype.hasOwnProperty.call(replacements, k) ? replacements[k] : match
  );
}

function escHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// VISUAL EDITOR
// Registered via getConfigElement() — HA shows this automatically when the
// card is added or edited through the UI dashboard editor.
//
// Focus-preservation strategy:
//   The editor shadow DOM is built ONCE in _render(). After that, all root
//   field changes (entity, hours_ahead, etc.) only update _config and dispatch
//   config-changed — they never call _render() again. This means the DOM stays
//   intact and input focus is never stolen mid-keystroke.
//   Only structural changes (add/remove activity) rebuild the DOM, which is
//   unavoidable and expected behaviour.
// =============================================================================

class ElectricityCostCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._rendered = false;  // Track whether initial DOM has been built
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = structuredClone(config);
    // Always do a full render on first call or when activities change structurally.
    // For root field edits HA calls setConfig again — we update input values
    // in-place instead of rebuilding the DOM to preserve focus.
    if (!this._rendered) {
      this._render();
    } else {
      this._syncRootFields();
    }
  }

  // Dispatch HA config-changed event so the card preview updates live.
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _addActivity() {
    const acts = this._config.activities ?? [];
    acts.push({ name: '', icon: '⚡', kwh_min: 1.0, kwh_max: 1.0, threshold: 1.5 });
    this._config = { ...this._config, activities: acts };
    this._dispatch();
    this._rendered = false;  // Force full rebuild so new row appears
    this._render();
  }

  _removeActivity(idx) {
    const acts = [...(this._config.activities ?? [])];
    acts.splice(idx, 1);
    this._config = { ...this._config, activities: acts };
    this._dispatch();
    this._rendered = false;  // Force full rebuild so removed row disappears
    this._render();
  }

  _updateRoot(field, value) {
    const intFields   = ['hours_ahead', 'search_hours'];
    const floatFields = ['price_good', 'price_ok', 'price_max', 'price_min'];
    let parsed = value;
    if (intFields.includes(field))   parsed = parseInt(value);
    if (floatFields.includes(field)) parsed = parseFloat(value);
    // A cleared/invalid numeric field parses to NaN — fall back to null
    // instead of writing NaN into config. setConfig() already treats null
    // as "use the documented default" for every one of these fields
    // (e.g. `config.hours_ahead ?? 6`), so this reuses that existing
    // fallback rather than needing a separate one here.
    if ((intFields.includes(field) || floatFields.includes(field)) && Number.isNaN(parsed)) {
      parsed = null;
    }
    this._config = { ...this._config, [field]: parsed };
    this._dispatch();
    // Never call _render() here — doing so would steal focus from the active input.
    // The YAML preview is refreshed separately without touching the input DOM.
    this._refreshYaml();
  }

  // Update root input values in-place when HA calls setConfig after a dispatch.
  // This keeps the DOM intact and input focus preserved.
  _syncRootFields() {
    const c = this._config;
    const set = (id, val) => {
      const el = this.shadowRoot.getElementById(id);
      if (el && document.activeElement !== el) el.value = val ?? '';
    };
    set('entity-input',     c.entity      ?? '');
    set('title-input',      c.title       ?? '');
    set('hours-input',      c.hours_ahead ?? 6);
    set('search-input',     c.search_hours ?? 12);
    set('price-good-input', c.price_good  ?? 1.5);
    set('price-ok-input',   c.price_ok    ?? 3.0);
    set('currency-input',   c.currency    ?? '');
    set('unit-input',       c.unit        ?? '');
    set('price-max-input',  c.price_max   ?? '');
    set('price-min-input',  c.price_min   ?? 0);
    this._refreshYaml();
  }

  _render() {
    const c = this._config;
    const acts = c.activities ?? [];

    const ICONS = ['🍽️','👕','🚿','🔋','🍳','🧹','❄️','💡','🖥️','🌡️','⚡','🛁','🏠','🔌'];

    const activityRows = acts.map((a, i) => `
      <div class="act-row">
        <div class="act-row-header">
          <span class="act-row-title">${escHtml(a.name || _t(this._hass, "editor_activity_default_name", { n: i + 1 }))}</span>
          <button class="remove-btn" data-idx="${i}">${_t(this._hass, "editor_remove")}</button>
        </div>
        <div class="field-grid">
          <div class="field">
            <label>${_t(this._hass, "editor_label_name")}</label>
            <input class="act-field" data-idx="${i}" data-field="name" value="${escHtml(a.name ?? '')}" placeholder="${_t(this._hass, "editor_placeholder_name")}"/>
          </div>
          <div class="field">
            <label>${_t(this._hass, "editor_label_icon")}</label>
            <select class="act-field" data-idx="${i}" data-field="icon">
              ${ICONS.map(ic => `<option value="${ic}" ${a.icon === ic ? 'selected' : ''}>${ic}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>${_t(this._hass, "editor_label_kwh_min")}</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="kwh_min" value="${a.kwh_min ?? ''}"/>
          </div>
          <div class="field">
            <label>${_t(this._hass, "editor_label_kwh_max")}</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="kwh_max" value="${a.kwh_max ?? ''}"/>
          </div>
          <div class="field">
            <label>${_t(this._hass, "editor_label_threshold")}</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="threshold" value="${a.threshold ?? ''}" placeholder="${_t(this._hass, "editor_placeholder_threshold")}"/>
          </div>
          <div class="field">
            <label>${_t(this._hass, "editor_label_duration")}</label>
            <input class="act-field" type="number" step="0.5" min="0.5" data-idx="${i}" data-field="duration_hours" value="${a.duration_hours ?? ''}" placeholder="${_t(this._hass, "editor_placeholder_duration")}"/>
          </div>
        </div>
      </div>`).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--primary-font-family, sans-serif); }
        .section { font-size: 11px; font-weight: 500; color: var(--secondary-text-color);
                   letter-spacing: .06em; text-transform: uppercase; margin: 16px 0 8px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        label { font-size: 11px; color: var(--secondary-text-color); }
        input, select {
          font-size: 13px; padding: 7px 9px;
          border-radius: 8px; border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff); color: var(--primary-text-color);
          width: 100%;
        }
        input:focus, select:focus { outline: none; border-color: var(--primary-color); }
        .root-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; }
        .hint { font-size: 10px; color: var(--secondary-text-color); margin: -4px 0 8px; }
        .act-row {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px; padding: 12px; margin-bottom: 8px;
        }
        .act-row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .act-row-title { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        .remove-btn {
          font-size: 11px; padding: 3px 9px; border-radius: 6px;
          border: 1px solid var(--divider-color); background: transparent;
          color: var(--error-color, #b00020); cursor: pointer;
        }
        .remove-btn:hover { background: var(--error-color, #b00020); color: #fff; }
        .field-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; }
        .add-btn {
          width: 100%; padding: 9px; border-radius: 8px; margin-top: 4px;
          border: 1px dashed var(--divider-color); background: transparent;
          color: var(--primary-color); font-size: 13px; cursor: pointer;
        }
        .add-btn:hover { background: var(--secondary-background-color); }
        .yaml-box {
          font-family: var(--code-font-family, monospace); font-size: 11px;
          background: var(--secondary-background-color); border-radius: 8px;
          padding: 10px 12px; white-space: pre; overflow-x: auto;
          color: var(--primary-text-color); border: 1px solid var(--divider-color);
          margin-top: 4px;
        }
        .copy-btn {
          font-size: 11px; padding: 4px 10px; border-radius: 6px; margin-top: 6px;
          border: 1px solid var(--divider-color); background: transparent;
          color: var(--secondary-text-color); cursor: pointer; float: right;
        }
        .copy-btn:hover { background: var(--secondary-background-color); }
      </style>

      <div class="section">${_t(this._hass, "editor_section_card_settings")}</div>
      <div class="root-grid">
        <div class="field" style="grid-column:1/-1">
          <label>${_t(this._hass, "editor_label_entity")}</label>
          <input id="entity-input" value="${c.entity ?? ''}" placeholder="sensor.nordpool_kwh_..."/>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>${_t(this._hass, "editor_label_title")}</label>
          <input id="title-input" value="${escHtml(c.title ?? '')}" placeholder="${_t(this._hass, "title_default")}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_hours_ahead")}</label>
          <input id="hours-input" type="number" min="1" max="24" value="${c.hours_ahead ?? 6}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_search_hours")}</label>
          <input id="search-input" type="number" min="1" max="24" value="${c.search_hours ?? 12}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_price_good")}</label>
          <input id="price-good-input" type="number" step="0.1" min="0.1" value="${c.price_good ?? 1.5}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_price_ok")}</label>
          <input id="price-ok-input" type="number" step="0.1" min="0.1" value="${c.price_ok ?? 3.0}"/>
        </div>
      </div>

      <div class="section">${_t(this._hass, "editor_section_advanced")}</div>
      <div class="hint">${_t(this._hass, "editor_hint_advanced")}</div>
      <div class="root-grid">
        <div class="field">
          <label>${_t(this._hass, "editor_label_currency")}</label>
          <input id="currency-input" value="${c.currency ?? ''}" placeholder="${_t(this._hass, "editor_placeholder_currency")}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_unit")}</label>
          <input id="unit-input" value="${c.unit ?? ''}" placeholder="${_t(this._hass, "editor_placeholder_unit")}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_price_max")}</label>
          <input id="price-max-input" type="number" step="0.01" min="0.01" value="${c.price_max ?? ''}" placeholder="${_t(this._hass, "editor_placeholder_price_max")}"/>
        </div>
        <div class="field">
          <label>${_t(this._hass, "editor_label_price_min")}</label>
          <input id="price-min-input" type="number" step="0.01" min="0" value="${c.price_min ?? 0}"/>
        </div>
      </div>

      <div class="section">${_t(this._hass, "editor_section_activities")}</div>
      <div id="activity-list">${activityRows}</div>
      <button class="add-btn" id="add-btn">${_t(this._hass, "editor_add_activity")}</button>

      <div class="section">${_t(this._hass, "editor_section_yaml")}</div>
      <button class="copy-btn" id="copy-btn">${_t(this._hass, "editor_copy")}</button>
      <div class="yaml-box" id="yaml-preview"></div>`;

    // ── Root field listeners — use 'change' not 'input' to avoid per-keystroke
    // dispatches that trigger setConfig → DOM rebuild → lost focus.
    this.shadowRoot.getElementById('entity-input')
      .addEventListener('change', e => this._updateRoot('entity', e.target.value.trim()));
    this.shadowRoot.getElementById('title-input')
      .addEventListener('change', e => this._updateRoot('title', e.target.value.trim()));
    this.shadowRoot.getElementById('hours-input')
      .addEventListener('change', e => this._updateRoot('hours_ahead', e.target.value));
    this.shadowRoot.getElementById('search-input')
      .addEventListener('change', e => this._updateRoot('search_hours', e.target.value));
    this.shadowRoot.getElementById('price-good-input')
      .addEventListener('change', e => this._updateRoot('price_good', e.target.value));
    this.shadowRoot.getElementById('price-ok-input')
      .addEventListener('change', e => this._updateRoot('price_ok', e.target.value));
    this.shadowRoot.getElementById('currency-input')
      .addEventListener('change', e => this._updateRoot('currency', e.target.value.trim()));
    this.shadowRoot.getElementById('unit-input')
      .addEventListener('change', e => this._updateRoot('unit', e.target.value.trim()));
    this.shadowRoot.getElementById('price-max-input')
      .addEventListener('change', e => this._updateRoot('price_max', e.target.value));
    this.shadowRoot.getElementById('price-min-input')
      .addEventListener('change', e => this._updateRoot('price_min', e.target.value));

    // ── Activity field listeners (delegated) — 'input' is fine here because
    // activity changes do NOT trigger a _render() call.
    // 'input' — fires on every keystroke: keeps YAML preview and row title live
    // but does NOT dispatch to HA yet (avoids per-keystroke re-renders in the card preview).
    this.shadowRoot.getElementById('activity-list')
      .addEventListener('input', e => {
        const el = e.target;
        if (!el.dataset.idx) return;
        // Update internal config silently (no dispatch)
        const acts = structuredClone(this._config.activities ?? []);
        const numericFields = ['kwh_min', 'kwh_max', 'threshold', 'duration_hours'];
        acts[parseInt(el.dataset.idx)][el.dataset.field] = numericFields.includes(el.dataset.field)
          ? (el.value === '' ? undefined : parseFloat(el.value))
          : el.value;
        if (el.dataset.field === 'duration_hours' && !acts[parseInt(el.dataset.idx)].duration_hours) {
          delete acts[parseInt(el.dataset.idx)].duration_hours;
        }
        this._config = { ...this._config, activities: acts };
        // Update YAML preview and row title without touching the card preview
        this._refreshYaml();
        if (el.dataset.field === 'name') {
          const titles = this.shadowRoot.querySelectorAll('.act-row-title');
          titles[parseInt(el.dataset.idx)].textContent = el.value || `Activity ${parseInt(el.dataset.idx) + 1}`;
        }
      });

    // 'change' — fires when focus leaves the field: dispatches to HA so the
    // card preview updates. This is the moment the user has finished editing.
    this.shadowRoot.getElementById('activity-list')
      .addEventListener('change', e => {
        const el = e.target;
        if (!el.dataset.idx) return;
        this._dispatch();
      });

    // Remove buttons
    this.shadowRoot.getElementById('activity-list')
      .addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
          this._removeActivity(parseInt(e.target.dataset.idx));
        }
      });

    // Add button
    this.shadowRoot.getElementById('add-btn')
      .addEventListener('click', () => this._addActivity());

    // Copy YAML button
    this.shadowRoot.getElementById('copy-btn')
      .addEventListener('click', () => {
        const yaml = this.shadowRoot.getElementById('yaml-preview').textContent;
        navigator.clipboard.writeText(yaml).then(() => {
          const btn = this.shadowRoot.getElementById('copy-btn');
          btn.textContent = _t(this._hass, "editor_copied");
          setTimeout(() => btn.textContent = _t(this._hass, "editor_copy"), 1500);
        });
      });

    this._rendered = true;
    this._refreshYaml();
  }

  // Build a human-readable YAML snippet from current config.
  _refreshYaml() {
    const c = this._config;
    const acts = (c.activities ?? []).map(a => {
      let s = `  - name: "${a.name ?? ''}"\n`;
      s += `    icon: "${a.icon ?? '⚡'}"\n`;
      s += `    kwh_min: ${a.kwh_min ?? 1.0}\n`;
      s += `    kwh_max: ${a.kwh_max ?? 1.0}\n`;
      s += `    threshold: ${a.threshold ?? 1.5}\n`;
      if (a.duration_hours) s += `    duration_hours: ${a.duration_hours}\n`;
      return s;
    }).join('');

    const titleLine     = c.title ? `title: ${c.title}\n` : '';
    // Advanced/optional lines — only emitted when explicitly set, so the
    // default YAML stays minimal and auto-detection keeps working.
    const currencyLine  = c.currency ? `currency: "${c.currency}"\n` : '';
    const unitLine       = c.unit ? `unit: "${c.unit}"\n` : '';
    const priceMaxLine  = c.price_max ? `price_max: ${c.price_max}\n` : '';
    const priceMinLine  = c.price_min ? `price_min: ${c.price_min}\n` : '';

    const yaml =
`type: custom:electricity-cost-card
entity: ${c.entity ?? 'sensor.nordpool_kwh_...'}
${titleLine}hours_ahead: ${c.hours_ahead ?? 6}
search_hours: ${c.search_hours ?? 12}
price_good: ${c.price_good ?? 1.5}
price_ok: ${c.price_ok ?? 3.0}
${currencyLine}${unitLine}${priceMaxLine}${priceMinLine}activities:
${acts}`;

    const box = this.shadowRoot.getElementById('yaml-preview');
    if (box) box.textContent = yaml;
  }
}

customElements.define('electricity-cost-card-editor', ElectricityCostCardEditor);


// =============================================================================
// MAIN CARD
// =============================================================================

// ISO currency code → display symbol. Nordpool's `currency` attribute is an
// ISO code (SEK, EUR, ...); we map the common ones to the suffix people
// actually expect to see. Unknown codes are shown as-is rather than guessed.
const CURRENCY_SYMBOLS = {
  SEK: 'kr', NOK: 'kr', DKK: 'kr', EUR: '€', GBP: '£', USD: '$',
};

class ElectricityCostCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._livePrice = null;   // Price from HA sensor state
    this._simPrice  = null;   // Non-null when user is dragging the slider
    this._today     = [];     // 15-min price blocks for today (96 entries)
    this._tomorrow  = [];     // 15-min price blocks for tomorrow (available from ~13:00)
    this._prices    = [];     // today + tomorrow merged — used for all look-aheads
    this._sensorCurrency = null; // ISO code read from the sensor's `currency` attribute
    this._sensorUnit     = null; // Unit read from the sensor's `unit` attribute
    this._renderRaf = null;      // Pending animation-frame handle for throttled slider re-renders
  }

  // Called by HA when the card config is set or changed.
  setConfig(config) {
    if (!config.entity) throw new Error('electricity-cost-card: ' + _t(this._hass, "entity_required"));
    this._config = {
      entity:       config.entity,
      title:        config.title        ?? null,   // Optional custom title; null = use default
      hours_ahead:  config.hours_ahead  ?? 6,
      search_hours: config.search_hours ?? 12,
      price_good:   config.price_good   ?? 1.5,    // Good price ceiling (currency/kWh)
      price_ok:     config.price_ok     ?? 3.0,    // OK/Normal ceiling (currency/kWh)
      price_min:    config.price_min    ?? 0,      // Bottom of gauge/slider
      price_max:    config.price_max    ?? null,   // null = auto-derive from price_ok
      currency:     config.currency     ?? null,   // null = auto-detect from sensor
      unit:         config.unit         ?? null,   // null = auto-detect from sensor
      activities:   config.activities   ?? [],
    };
    this._render();
  }

  // Called by HA every time any entity state changes.
  set hass(hass) {
    // HA guarantees hass.states[id] keeps the same object reference unless
    // that specific entity's state/attributes actually changed — so a
    // reference check tells us whether a re-render is needed, no need to
    // diff state/attributes by value.
    const prevStateObj = this._hass?.states?.[this._config.entity];
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    if (!stateObj) return;
    if (stateObj === prevStateObj) return;
    this._livePrice = parseFloat(stateObj.state);
    this._today     = stateObj.attributes.today    ?? [];
    this._tomorrow  = stateObj.attributes.tomorrow ?? [];
    // Merge into a single timeline so all look-ahead logic crosses midnight seamlessly.
    // today has 96 blocks (00:00–23:45), tomorrow appended starts at index 96 (= 00:00 next day).
    this._prices = [...this._today, ...this._tomorrow];
    // Auto-detection source for currency/unit display — only used when the
    // card config doesn't explicitly override them.
    this._sensorCurrency = stateObj.attributes.currency ?? null;
    this._sensorUnit     = stateObj.attributes.unit     ?? null;
    this._render();
  }

  // HA uses this to size the card in the grid.
  getCardSize() { return 7; }

  // Returns the editor element registered above.
  static getConfigElement() {
    return document.createElement('electricity-cost-card-editor');
  }

  // Default config shown when adding the card via UI.
  static getStubConfig() {
    return {
      entity:       'sensor.nordpool_kwh_se3_sek_3_10_025',
      hours_ahead:  6,
      search_hours: 12,
      price_good:   1.5,
      price_ok:     3.0,
      activities: [
        { name: 'Dishwasher',    icon: '🍽️', kwh_min: 0.7, kwh_max: 1.5, threshold: 1.5, duration_hours: 2.0 },
        { name: 'Wash & tumble', icon: '👕', kwh_min: 2.0, kwh_max: 4.0, threshold: 1.0, duration_hours: 3.0 },
        { name: 'Charge EV',     icon: '🔋', kwh_min: 40,  kwh_max: 100, threshold: 0.8, duration_hours: 4.0 },
        { name: '10-min shower', icon: '🚿', kwh_min: 4.0, kwh_max: 4.0, threshold: 1.5 },
      ],
    };
  }


  // ── Time helpers ───────────────────────────────────────────────────────────

  // Index of the current 15-minute block (0–95).
  _currentBlockIndex() {
    const now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) / 15 | 0;
  }

  // "HH:MM" label for a given block index.
  // Indices 0–95 = today, 96–191 = tomorrow. We always show clock time, never "day+1".
  _blockTime(idx) {
    const dayIdx = idx % 96;  // wrap so tomorrow's blocks show their own clock time
    const h = Math.floor(dayIdx / 4);
    const m = (dayIdx % 4) * 15;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }


  // ── Formatting helpers ─────────────────────────────────────────────────────

  // Smart number formatting: 2 decimals below 10, 1 decimal below 100, integer above.
  _fmt(v) {
    if (v >= 100) return Math.round(v).toString();
    if (v >= 10)  return v.toFixed(1);
    return v.toFixed(2);
  }

  // Currency suffix shown after price values. Priority:
  //   1. Explicit `currency` config key
  //   2. Sensor's `currency` attribute, mapped via CURRENCY_SYMBOLS
  //   3. Sensor's `currency` attribute as-is (unknown ISO code)
  //   4. "kr" — preserves the original default when nothing is available
  _currencySuffix() {
    if (this._config.currency) return this._config.currency;
    const raw = this._sensorCurrency;
    if (raw && CURRENCY_SYMBOLS[raw]) return CURRENCY_SYMBOLS[raw];
    if (raw) return raw;
    return 'kr';
  }

  // Unit suffix shown after the currency (e.g. "kr/kWh"). Same priority as above.
  _unitSuffix() {
    return this._config.unit || this._sensorUnit || 'kWh';
  }

  // Top of the price gauge/slider. If not explicitly configured, auto-scales
  // from price_ok using the same ratio as the original hardcoded values
  // (price_ok defaulted to 3.0, gauge topped out at 5.0 → factor 5/3).
  // This keeps existing SEK dashboards pixel-identical while giving EUR (or
  // any other currency) a sensibly scaled gauge without any config needed.
  _priceMax() {
    const explicit = this._config.price_max;
    if (explicit && explicit > 0) return explicit;
    const ok = this._config.price_ok > 0 ? this._config.price_ok : 3.0;
    return ok * (5 / 3);
  }

  // Bottom of the price gauge/slider. Default 0.
  _priceMin() {
    return this._config.price_min || 0;
  }

  // Bar / gauge color based on absolute price level.
  _priceColor(p) {
    if (p <= 1.0) return 'var(--success-color, #639922)'; // green
    if (p <= 2.0) return 'var(--warning-color, #BA7517)'; // amber
    if (p <= 3.0) return 'var(--error-color, #E24B4A)';   // red
    return '#A32D2D';                                     // dark red — beyond HA's error tier, no matching theme var
  }

  // Overall status badge — uses price_good / price_ok from root config.
  _priceStatus(p) {
    const good = this._config.price_good ?? 1.5;
    const ok   = this._config.price_ok   ?? 3.0;
    if (p <= good) return { cls: 'good', label: _t(this._hass, "price_status_good") };
    if (p <= ok)   return { cls: 'ok',   label: _t(this._hass, "price_status_ok") };
    return               { cls: 'bad',   label: _t(this._hass, "price_status_bad") };
  }

  // Per-activity simple recommendation (used when no duration_hours).
  _simpleRec(price, threshold) {
    if (price <= threshold)     return { cls: 'good', label: _t(this._hass, "simple_rec_good") };
    if (price <= threshold * 2) return { cls: 'ok',   label: _t(this._hass, "simple_rec_ok") };
    return                             { cls: 'bad',  label: _t(this._hass, "simple_rec_bad") };
  }


  // ── Duration cost calculations ─────────────────────────────────────────────

  // Average price per kWh over `numBlocks` 15-min blocks starting at `startIdx`.
  // Uses the merged today+tomorrow price array so windows can cross midnight.
  // Returns null if not enough data.
  _avgPriceForWindow(startIdx, numBlocks) {
    const blocks = [];
    for (let i = 0; i < numBlocks; i++) {
      const p = this._prices[startIdx + i];
      if (p !== undefined) blocks.push(p);
    }
    if (!blocks.length) return null;
    return blocks.reduce((sum, v) => sum + v, 0) / blocks.length;
  }

  // Cost if the activity starts RIGHT NOW, integrated over its actual block prices.
  // Returns { costMin, costMax, avgPrice } or null.
  _costIfStartNow(activity) {
    const numBlocks = Math.round(activity.duration_hours * 4);
    const startIdx  = this._currentBlockIndex();
    const avgPrice  = this._avgPriceForWindow(startIdx, numBlocks);
    if (avgPrice === null) return null;
    return {
      costMin:  activity.kwh_min * avgPrice,
      costMax:  activity.kwh_max * avgPrice,
      avgPrice,
    };
  }

  // Find the cheapest consecutive window of `duration_hours` within search_hours.
  // Uses the merged today+tomorrow array so searches can cross midnight.
  // Returns { avgPrice, costMin, costMax, startTime, endTime, isNow } or null.
  _bestWindow(activity) {
    const numBlocks    = Math.round(activity.duration_hours * 4);
    const startIdx     = this._currentBlockIndex();
    // Respect search_hours config — convert hours to blocks (4 per hour).
    const searchBlocks = this._config.search_hours * 4;
    const maxSearch    = Math.min(this._prices.length - numBlocks, startIdx + searchBlocks);

    let bestAvg   = Infinity;
    let bestStart = startIdx;

    for (let s = startIdx; s <= maxSearch; s++) {
      const avg = this._avgPriceForWindow(s, numBlocks);
      if (avg !== null && avg < bestAvg) {
        bestAvg   = avg;
        bestStart = s;
      }
    }
    if (bestAvg === Infinity) return null;

    const endIdx = Math.min(bestStart + numBlocks - 1, this._prices.length - 1);
    return {
      avgPrice:  bestAvg,
      costMin:   activity.kwh_min * bestAvg,
      costMax:   activity.kwh_max * bestAvg,
      startTime: this._blockTime(bestStart),
      endTime:   this._blockTime(endIdx),
      isNow:     bestStart === startIdx,
    };
  }


  // ── Price graph ────────────────────────────────────────────────────────────

  // Build the list of upcoming blocks for the graph.
  // Uses merged today+tomorrow so the graph crosses midnight seamlessly.
  _getUpcomingBlocks() {
    const blocksAhead = this._config.hours_ahead * 4;
    const idx         = this._currentBlockIndex();
    const blocks      = [];
    for (let i = 0; i < blocksAhead; i++) {
      const pos = idx + i;
      if (pos < this._prices.length) {
        blocks.push({
          time:      this._blockTime(pos),
          price:     this._prices[pos],
          isCurrent: i === 0,
        });
      }
    }
    return blocks;
  }

  // Render price graph with HTML y-axis labels and SVG bar chart.
  // Y-axis labels are rendered as HTML so they inherit the HA theme font
  // automatically, matching the x-axis time labels below the chart.
  _buildGraph(blocks) {
    if (!blocks.length) {
      return `<div style="font-size:11px;color:var(--secondary-text-color);padding:8px 0;">${_t(this._hass, "no_price_data")}</div>`;
    }
    const prices = blocks.map(b => b.price);
    const maxP   = Math.max(...prices, 0.1);
    const mid    = maxP / 2;
    // W/H for the bar area. LEFT is reserved for y-axis labels in the HTML layer.
    const W = 88, H = 52, LEFT = 14;
    const barW = Math.max(0.8, (W / prices.length) - 0.4);

    const bars = prices.map((p, i) => {
      const bh  = Math.max(2, (p / maxP) * H);
      const x   = (i / prices.length) * W;
      const y   = H - bh;
      const col = blocks[i].isCurrent ? 'var(--primary-color, #185FA5)' : this._priceColor(p);
      const op  = blocks[i].isCurrent ? '1' : '0.6';
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${bh.toFixed(2)}" fill="${col}" opacity="${op}"/>`;
    }).join('');

    // Dashed reference lines at max and mid, solid baseline at 0.
    const gridLines = `
      <line x1="0" y1="1"        x2="${W}" y2="1"        stroke="var(--divider-color,#e0e0e0)" stroke-width="0.5" stroke-dasharray="2,2"/>
      <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--divider-color,#e0e0e0)" stroke-width="0.5" stroke-dasharray="2,2"/>
      <line x1="0" y1="${H}"     x2="${W}" y2="${H}"     stroke="var(--divider-color,#e0e0e0)" stroke-width="0.5"/>`;

    const diff       = prices[prices.length - 1] - prices[0];
    const trendSym   = diff > 0.05 ? '↑' : diff < -0.05 ? '↓' : '→';
    const trendColor = diff > 0.05 ? 'var(--error-color, #E24B4A)' : diff < -0.05 ? 'var(--success-color, #639922)' : 'var(--secondary-text-color, #888780)';
    const lastPrice  = this._fmt(prices[prices.length - 1]);

    // Y-axis labels as HTML — inherits HA theme font identically to x-axis spans.
    return `
      <div style="position:relative;">
        <div style="position:absolute;left:0;top:0;bottom:16px;display:flex;flex-direction:column;justify-content:space-between;text-align:right;width:${LEFT}px;">
          <span style="font-size:10px;color:var(--secondary-text-color);line-height:1">${this._fmt(maxP)}</span>
          <span style="font-size:10px;color:var(--secondary-text-color);line-height:1">${this._fmt(mid)}</span>
          <span style="font-size:10px;color:var(--secondary-text-color);line-height:1">0</span>
        </div>
        <div style="margin-left:${LEFT + 3}px;overflow:hidden;">
          <svg width="100%" viewBox="0 0 ${W} ${H + 2}" preserveAspectRatio="none" style="height:54px;display:block;">
            ${gridLines}${bars}
          </svg>
          <div style="display:flex;justify-content:space-between;margin-top:3px;">
            <span style="font-size:10px;color:var(--secondary-text-color)">${blocks[0].time}</span>
            <span style="font-size:11px;font-weight:500;color:${trendColor}">${trendSym} ${lastPrice} ${this._currencySuffix()}/${this._unitSuffix()}</span>
            <span style="font-size:10px;color:var(--secondary-text-color)">${blocks[blocks.length - 1].time}</span>
          </div>
        </div>
      </div>`;
  }


  // ── Activity rendering ─────────────────────────────────────────────────────

  _renderActivity(activity) {
    const currency = this._currencySuffix();

    // Icon background colors keyed by emoji
    const iconColors = {
      '🍽️': '#EEEDFE', '👕': '#EAF3DE', '🚿': '#E6F1FB', '🔋': '#FAEEDA',
      '🍳': '#FAECE7', '🧹': '#EAF3DE', '❄️': '#E6F1FB', '💡': '#FAEEDA',
      '🖥️': '#EEEDFE', '🌡️': '#FAECE7', '⚡': '#FAEEDA', '🛁': '#E6F1FB',
      '🏠': '#EAF3DE', '🔌': '#EEEDFE',
    };
    const iconBg = iconColors[activity.icon] ?? '#F1EFE8';
    const kwhStr = activity.kwh_min === activity.kwh_max
      ? `${activity.kwh_min} kWh`
      : `${activity.kwh_min}–${activity.kwh_max} kWh`;

    // ── Simple mode: no duration_hours ────────────────────────────────────
    if (!activity.duration_hours) {
      // Use sim price if active, otherwise live price.
      // Never fall back to a hardcoded default — if we have no price yet,
      // return a loading placeholder so stale data never drives the rec badge.
      if (this._livePrice === null && this._simPrice === null) {
        return `
          <div class="activity">
            <div class="activity-icon" style="background:${iconBg}">${escHtml(activity.icon || '')}</div>
            <div class="activity-info">
              <div class="activity-name">${escHtml(activity.name || '')}</div>
              <div class="activity-sub">${kwhStr}</div>
            </div>
            <div class="activity-right" style="color:var(--secondary-text-color);font-size:12px;">${_t(this._hass, "loading")}</div>
          </div>`;
      }
      const price   = this._simPrice !== null ? this._simPrice : this._livePrice;
      const cMin    = activity.kwh_min * price;
      const cMax    = activity.kwh_max * price;
      const costStr = activity.kwh_min === activity.kwh_max
        ? `${this._fmt(cMin)} ${currency}`
        : `${this._fmt(cMin)}–${this._fmt(cMax)} ${currency}`;
      const rec = this._simpleRec(price, activity.threshold ?? 1.5);

      return `
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${escHtml(activity.icon || '')}</div>
          <div class="activity-info">
            <div class="activity-name">${escHtml(activity.name || '')}</div>
            <div class="activity-sub">${kwhStr}</div>
          </div>
          <div class="activity-right">
            <div class="activity-cost">${costStr}</div>
            <div class="rec rec-${rec.cls}"><span class="rec-dot rdot-${rec.cls}"></span>${rec.label}</div>
          </div>
        </div>`;
    }

    // ── Duration mode: integrated cost over actual block prices ───────────
    //
    // Simulation mode: when the user has dragged the slider, we skip the
    // real-price integration and simply multiply simPrice × kWh, mirroring
    // how simple activities behave. Best-window is hidden during simulation
    // because it is based on real future prices and would be misleading.
    const isSimulating = this._simPrice !== null;

    if (isSimulating) {
      const price   = this._simPrice;
      const cMin    = activity.kwh_min * price;
      const cMax    = activity.kwh_max * price;
      const costStr = activity.kwh_min === activity.kwh_max
        ? `${this._fmt(cMin)} ${currency}`
        : `${this._fmt(cMin)}–${this._fmt(cMax)} ${currency}`;
      const rec = this._simpleRec(price, activity.threshold ?? 1.5);
      const durLabel = `${kwhStr} · ${activity.duration_hours}h`;
      return `
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${escHtml(activity.icon || '')}</div>
          <div class="activity-info">
            <div class="activity-name">${escHtml(activity.name || '')}</div>
            <div class="activity-sub">${durLabel}</div>
          </div>
          <div class="activity-right">
            <div class="activity-cost">${costStr}</div>
            <div class="rec rec-${rec.cls}"><span class="rec-dot rdot-${rec.cls}"></span>${rec.label}</div>
          </div>
        </div>`;
    }

    // Live mode: integrate real upcoming block prices over the full duration.
    const nowCost  = this._costIfStartNow(activity);
    const best     = this._bestWindow(activity);
    const durLabel = `${kwhStr} · ${activity.duration_hours}h`;

    // Cost string for running NOW
    const nowStr = nowCost
      ? (activity.kwh_min === activity.kwh_max
          ? `${this._fmt(nowCost.costMin)} ${currency}`
          : `${this._fmt(nowCost.costMin)}–${this._fmt(nowCost.costMax)} ${currency}`)
      : '–';

    // Recommendation badge uses the same threshold logic as simple activities,
    // but applied to the integrated avg price over the activity's duration.
    // Additionally, if a cheaper window exists later, show the savings.
    let recHtml = '';
    if (nowCost) {
      const rec = this._simpleRec(nowCost.avgPrice, activity.threshold ?? 1.5);
      if (best && !best.isNow) {
        const savePct = Math.round(((nowCost.costMin - best.costMin) / nowCost.costMin) * 100);
        // Show savings badge when meaningful (>3%), otherwise fall back to threshold rec
        recHtml = savePct > 3
          ? `<div class="save-badge">↓ ${savePct}% at ${best.startTime}</div>`
          : `<div class="rec rec-${rec.cls}"><span class="rec-dot rdot-${rec.cls}"></span>${rec.label}</div>`;
      } else {
        // Best window IS now — show threshold-based label
        recHtml = `<div class="rec rec-${rec.cls}"><span class="rec-dot rdot-${rec.cls}"></span>${rec.label}</div>`;
      }
    }

    // Best-window row shown below the main row (only when best is later)
    const bestRowHtml = (best && !best.isNow) ? (() => {
      const bestStr = activity.kwh_min === activity.kwh_max
        ? `${this._fmt(best.costMin)} ${currency}`
        : `${this._fmt(best.costMin)}–${this._fmt(best.costMax)} ${currency}`;
      return `
        <div class="best-row">
          <span class="best-label"><span class="best-dot"></span>${_t(this._hass, "best_window", { start: best.startTime, end: best.endTime })}</span>
          <span class="best-cost">${bestStr}</span>
        </div>`;
    })() : '';

    return `
      <div class="activity-dur">
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${escHtml(activity.icon || '')}</div>
          <div class="activity-info">
            <div class="activity-name">${escHtml(activity.name || '')}</div>
            <div class="activity-sub">${durLabel}</div>
          </div>
          <div class="activity-right">
            <div class="activity-cost">${nowStr}</div>
            ${recHtml}
          </div>
        </div>
        ${bestRowHtml}
      </div>`;
  }


  // ── Live-patch during slider drag ───────────────────────────────────────────
  // Updates only the price-dependent nodes in place — never touches
  // #price-slider itself, so dragging isn't interrupted (see the "input"
  // listener below for why a full _render() during drag breaks dragging).
  _patchSimulatedPrice() {
    if (!this.shadowRoot.querySelector('.price-value')) { this._render(); return; }

    const hasPrice     = this._livePrice !== null || this._simPrice !== null;
    const price        = this._simPrice !== null ? this._simPrice : (this._livePrice ?? 0);
    const isSimulating = this._simPrice !== null;
    const status       = this._priceStatus(price);
    const priceMax     = this._priceMax();
    const priceMin     = this._priceMin();
    const gaugePct     = Math.min(97, Math.max(3, ((price - priceMin) / (priceMax - priceMin)) * 100));
    const gaugeColor   = this._priceColor(price);

    const priceValueEl = this.shadowRoot.querySelector('.price-value');
    if (priceValueEl) priceValueEl.textContent = hasPrice ? price.toFixed(2) : '–';

    const simTagEl = this.shadowRoot.getElementById('sim-tag');
    if (simTagEl) simTagEl.style.display = isSimulating ? '' : 'none';

    const badgeEl = this.shadowRoot.querySelector('.badge');
    if (badgeEl) badgeEl.className = `badge ${hasPrice ? status.cls : 'ok'}`;
    const badgeLabelEl = this.shadowRoot.querySelector('.badge-label');
    if (badgeLabelEl) badgeLabelEl.textContent = hasPrice ? status.label : 'Loading…';

    const gaugeFillEl = this.shadowRoot.querySelector('.gauge-fill');
    if (gaugeFillEl) {
      gaugeFillEl.style.width = `${gaugePct}%`;
      gaugeFillEl.style.background = gaugeColor;
    }

    const resetBtnEl = this.shadowRoot.getElementById('reset-btn');
    if (resetBtnEl) resetBtnEl.style.display = isSimulating ? '' : 'none';

    const activitiesEl = this.shadowRoot.querySelector('.activities');
    if (activitiesEl) {
      activitiesEl.innerHTML = this._config.activities.map(a => this._renderActivity(a)).join('');
    }
  }

  // ── Main render ────────────────────────────────────────────────────────────

  _render() {
    if (!this._config.entity) return;

    // Don't render meaningful data until we have a real price from HA.
    const hasPrice     = this._livePrice !== null || this._simPrice !== null;
    const price        = this._simPrice !== null ? this._simPrice : (this._livePrice ?? 0);
    const isSimulating = this._simPrice !== null;
    const status       = this._priceStatus(price);
    const currency     = this._currencySuffix();
    const unit         = this._unitSuffix();
    const priceMax     = this._priceMax();
    const priceMin     = this._priceMin();
    const gaugePct     = Math.min(97, Math.max(3, ((price - priceMin) / (priceMax - priceMin)) * 100));
    const gaugeColor   = this._priceColor(price);
    const upcomingBlocks = this._getUpcomingBlocks();
    const graph        = this._buildGraph(upcomingBlocks);
    const activities   = this._config.activities.map(a => this._renderActivity(a)).join('');
    const timeNow      = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    // Use configured title or fall back to default
    const cardTitle    = escHtml(this._config.title || _t(this._hass, "title_default"));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card { padding: 16px 20px 20px; font-family: var(--primary-font-family, sans-serif); }

        /* ── Header ── */
        .card-title { font-size: 11px; font-weight: 500; color: var(--secondary-text-color);
                      letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .price-row { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .price-value { font-size: 36px; font-weight: 400; color: var(--primary-text-color); line-height: 1; }
        .price-unit  { font-size: 14px; color: var(--secondary-text-color); }
        .sim-tag { font-size: 10px; font-weight: 500; background: rgba(var(--rgb-warning-color, 244,185,66), 0.18); color: var(--warning-color, #854F0B);
                   padding: 2px 8px; border-radius: 10px; }

        /* ── Status badge ── */
        .badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px;
                 border-radius: 20px; font-size: 12px; font-weight: 500; flex-shrink: 0; }
        .badge.good { background: rgba(var(--rgb-success-color, 99,153,34), 0.18); color: var(--success-color, #27500A); }
        .badge.ok   { background: rgba(var(--rgb-warning-color, 244,185,66), 0.18); color: var(--warning-color, #633806); }
        .badge.bad  { background: rgba(var(--rgb-error-color, 226,75,74), 0.18); color: var(--error-color, #791F1F); }
        .badge-dot  { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .badge.good .badge-dot { background: var(--success-color, #639922); }
        .badge.ok   .badge-dot { background: var(--warning-color, #BA7517); }
        .badge.bad  .badge-dot { background: var(--error-color, #E24B4A); }

        /* ── Gauge ── */
        .gauge-track  { height: 5px; border-radius: 3px; background: var(--divider-color, #e0e0e0);
                        overflow: hidden; margin-bottom: 3px; }
        .gauge-fill   { height: 100%; border-radius: 3px;
                        transition: width .5s ease, background .5s ease; }
        .gauge-labels { display: flex; justify-content: space-between; font-size: 10px;
                        color: var(--secondary-text-color); margin-bottom: 12px; }

        /* ── Simulation slider ── */
        .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .slider-row input[type=range] { flex: 1; accent-color: var(--primary-color); }
        .reset-btn { font-size: 11px; padding: 4px 10px; border-radius: 8px;
                     border: 1px solid var(--divider-color); background: transparent;
                     color: var(--secondary-text-color); cursor: pointer; white-space: nowrap; }
        .reset-btn:hover { background: var(--secondary-background-color); }

        /* ── Section labels ── */
        .section-label { font-size: 10px; font-weight: 500; color: var(--secondary-text-color);
                         letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }

        /* ── Price graph ── */
        .graph-wrap { margin-bottom: 16px; }

        /* ── Activities ── */
        .activities { display: flex; flex-direction: column; gap: 5px; }

        /* Single-row activity */
        .activity { display: flex; align-items: center; gap: 10px; padding: 9px 11px;
                    background: var(--secondary-background-color); border-radius: 8px; }

        /* Duration activity wraps main row + best-window row */
        .activity-dur { border-radius: 8px; overflow: hidden; }
        .activity-dur > .activity { border-radius: 0; }

        .activity-icon  { width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
                          display: flex; align-items: center; justify-content: center; font-size: 17px; }
        .activity-info  { flex: 1; min-width: 0; }
        .activity-name  { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        .activity-sub   { font-size: 11px; color: var(--secondary-text-color); margin-top: 1px; }
        .activity-right { text-align: right; flex-shrink: 0; }
        .activity-cost  { font-size: 15px; font-weight: 500; color: var(--primary-text-color); }

        /* Recommendation row */
        .rec { display: flex; align-items: center; gap: 4px; justify-content: flex-end;
               font-size: 10px; font-weight: 500; margin-top: 3px; }
        .rec.rec-good { color: var(--success-color, #27500A); }
        .rec.rec-ok   { color: var(--warning-color, #633806); }
        .rec.rec-bad  { color: var(--error-color, #791F1F); }
        .rec-dot  { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .rdot-good { background: var(--success-color, #639922); }
        .rdot-ok   { background: var(--warning-color, #BA7517); }
        .rdot-bad  { background: var(--error-color, #E24B4A); }

        /* Savings badge (green pill) */
        .save-badge { font-size: 10px; font-weight: 500; color: var(--success-color, #27500A); background: rgba(var(--rgb-success-color, 99,153,34), 0.18);
                      padding: 2px 7px; border-radius: 10px; margin-top: 3px; display: inline-block; }

        /* Best-window sub-row */
        .best-row  { display: flex; align-items: center; justify-content: space-between;
                     padding: 5px 11px 7px 55px; background: var(--secondary-background-color);
                     border-top: 0.5px solid var(--divider-color, #e0e0e0); }
        .best-label { display: flex; align-items: center; gap: 5px;
                      font-size: 11px; color: var(--success-color, #27500A); font-weight: 500; }
        .best-dot   { width: 6px; height: 6px; border-radius: 50%; background: var(--success-color, #639922);
                      display: inline-block; flex-shrink: 0; }
        .best-cost  { font-size: 11px; font-weight: 500; color: var(--success-color, #27500A); }

        /* ── Footer ── */
        .divider { height: 1px; background: var(--divider-color, #e0e0e0); margin: 14px 0; }
        .footer  { font-size: 10px; color: var(--secondary-text-color); text-align: right; }
      </style>

      <ha-card>
        <div class="card-title">${cardTitle}</div>

        <div class="header">
          <div class="price-row">
            <span class="price-value">${hasPrice ? price.toFixed(2) : '–'}</span>
            <span class="price-unit">${currency}/${unit}</span>
            <span class="sim-tag" id="sim-tag" role="status" aria-live="polite" style="display:${isSimulating ? '' : 'none'}">${_t(this._hass, "simulation_tag")}</span>
          </div>
          <span class="badge ${hasPrice ? status.cls : 'ok'}">
            <span class="badge-dot"></span><span class="badge-label">${hasPrice ? status.label : _t(this._hass, "loading")}</span>
          </span>
        </div>

        <div class="gauge-track">
          <div class="gauge-fill" style="width:${gaugePct}%;background:${gaugeColor};"></div>
        </div>
        <div class="gauge-labels">
          <span>${this._fmt(priceMin)} ${currency}</span>
          <span>${this._fmt((priceMin + priceMax) / 2)} ${currency}</span>
          <span>${this._fmt(priceMax)} ${currency}</span>
        </div>

        <div class="slider-row">
          <input type="range" id="price-slider" aria-label="${_t(this._hass, "simulate_price_aria")}" min="${priceMin.toFixed(2)}" max="${priceMax.toFixed(2)}" step="0.01" value="${price.toFixed(2)}"/>
          <button class="reset-btn" id="reset-btn" style="display:${isSimulating ? '' : 'none'}">${_t(this._hass, "reset_live")}</button>
        </div>

        <div class="section-label">${_t(this._hass, "next_hours", { hours: this._config.hours_ahead })}</div>
        <div class="graph-wrap">${graph}</div>

        <div class="section-label">${_t(this._hass, "activities_label")}</div>
        <div class="activities">${activities}</div>

        <div class="divider"></div>
        <div class="footer">Nordpool · ${timeNow}</div>
      </ha-card>`;

    // ── Slider: enter simulation mode when dragged away from live price ───
    const slider = this.shadowRoot.getElementById('price-slider');
    if (slider) {
      slider.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        this._simPrice = Math.abs(v - (this._livePrice ?? v)) > 0.01 ? v : null;
        // Patch just the price-dependent DOM nodes instead of calling the full
        // _render() (which replaces shadowRoot.innerHTML wholesale, destroying
        // and recreating #price-slider itself). Doing that while the user's
        // pointer is actively dragging the slider breaks the browser's native
        // drag tracking on that element — the slider would only "jump" on
        // click instead of dragging smoothly. Collapsed to at most one patch
        // per animation frame, same throttling as before.
        if (this._renderRaf) return;
        this._renderRaf = requestAnimationFrame(() => {
          this._renderRaf = null;
          this._patchSimulatedPrice();
        });
      });
    }

    // ── Reset button: snap back to live price ─────────────────────────────
    const resetBtn = this.shadowRoot.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._simPrice = null;
        this._render();
      });
    }
  }
}

customElements.define('electricity-cost-card', ElectricityCostCard);

// Register card in HA card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type:             'electricity-cost-card',
  name:             'Electricity Cost Card',
  description:      'Real-time electricity pricing from Nordpool with per-activity cost calculations.',
  preview:          true,
  documentationURL: 'https://github.com/johro897/electricity-cost-card',
});
