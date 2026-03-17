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
//   state     — current price (kr/kWh)
//   today     — list of 96 × 15-minute price blocks for today
//   tomorrow  — list of 15-minute price blocks for tomorrow (available ~13:00)
//               When present, today+tomorrow are merged so graphs and best-
//               window searches cross midnight seamlessly.
//
// YAML config example:
//   type: custom:electricity-cost-card
//   entity: sensor.nordpool_kwh_se3_sek_3_10_025
//   hours_ahead: 6       — how many hours the price graph covers
//   search_hours: 12     — how far ahead to search for the best activity window
//   price_good: 1.5      — price ceiling (kr/kWh) for "Good price" badge
//   price_ok: 3.0        — price ceiling (kr/kWh) for "Normal" badge; above = "High price"
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


// =============================================================================
// VISUAL EDITOR
// Registered via getConfigElement() — HA shows this automatically when the
// card is added or edited through the UI dashboard editor.
// =============================================================================

class ElectricityCostCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = structuredClone(config);
    this._render();
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
    this._render();
  }

  _removeActivity(idx) {
    const acts = [...(this._config.activities ?? [])];
    acts.splice(idx, 1);
    this._config = { ...this._config, activities: acts };
    this._dispatch();
    this._render();
  }

  _updateActivity(idx, field, value) {
    const acts = structuredClone(this._config.activities ?? []);
    // Cast numeric fields
    const numericFields = ['kwh_min', 'kwh_max', 'threshold', 'duration_hours'];
    acts[idx][field] = numericFields.includes(field)
      ? (value === '' ? undefined : parseFloat(value))
      : value;
    // Remove duration_hours key entirely if cleared
    if (field === 'duration_hours' && !acts[idx].duration_hours) {
      delete acts[idx].duration_hours;
    }
    this._config = { ...this._config, activities: acts };
    this._dispatch();
  }

  _updateRoot(field, value) {
    const intFields   = ['hours_ahead', 'search_hours'];
    const floatFields = ['price_good', 'price_ok'];
    let parsed = value;
    if (intFields.includes(field))   parsed = parseInt(value);
    if (floatFields.includes(field)) parsed = parseFloat(value);
    this._config = { ...this._config, [field]: parsed };
    this._dispatch();
    if (!['entity', 'hours_ahead', 'search_hours', 'price_good', 'price_ok'].includes(field)) this._render();
  }

  _render() {
    const c = this._config;
    const acts = c.activities ?? [];

    const ICONS = ['🍽️','👕','🚿','🔋','🍳','🧹','❄️','💡','🖥️','🌡️','⚡','🛁','🏠','🔌'];

    const activityRows = acts.map((a, i) => `
      <div class="act-row">
        <div class="act-row-header">
          <span class="act-row-title">${a.name || 'Activity ' + (i + 1)}</span>
          <button class="remove-btn" data-idx="${i}">Remove</button>
        </div>
        <div class="field-grid">
          <div class="field">
            <label>Name</label>
            <input class="act-field" data-idx="${i}" data-field="name" value="${a.name ?? ''}" placeholder="e.g. Dishwasher"/>
          </div>
          <div class="field">
            <label>Icon</label>
            <select class="act-field" data-idx="${i}" data-field="icon">
              ${ICONS.map(ic => `<option value="${ic}" ${a.icon === ic ? 'selected' : ''}>${ic}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Min kWh</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="kwh_min" value="${a.kwh_min ?? ''}"/>
          </div>
          <div class="field">
            <label>Max kWh</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="kwh_max" value="${a.kwh_max ?? ''}"/>
          </div>
          <div class="field">
            <label>Good-price threshold (kr/kWh)</label>
            <input class="act-field" type="number" step="0.1" min="0.1" data-idx="${i}" data-field="threshold" value="${a.threshold ?? ''}" placeholder="e.g. 1.5"/>
          </div>
          <div class="field">
            <label>Duration (hours, optional)</label>
            <input class="act-field" type="number" step="0.5" min="0.5" data-idx="${i}" data-field="duration_hours" value="${a.duration_hours ?? ''}" placeholder="e.g. 2.0"/>
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
        .root-grid { display: grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 10px; }
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

      <div class="section">Card settings</div>
      <div class="root-grid">
        <div class="field" style="grid-column:1/-1">
          <label>Nordpool entity</label>
          <input id="entity-input" value="${c.entity ?? ''}" placeholder="sensor.nordpool_kwh_..."/>
        </div>
        <div class="field">
          <label>Graph: hours ahead</label>
          <input id="hours-input" type="number" min="1" max="24" value="${c.hours_ahead ?? 6}"/>
        </div>
        <div class="field">
          <label>Best window: search hours</label>
          <input id="search-input" type="number" min="1" max="24" value="${c.search_hours ?? 12}"/>
        </div>
        <div class="field">
          <label>Good price ceiling (kr/kWh)</label>
          <input id="price-good-input" type="number" step="0.1" min="0.1" value="${c.price_good ?? 1.5}"/>
        </div>
        <div class="field">
          <label>Normal price ceiling (kr/kWh)</label>
          <input id="price-ok-input" type="number" step="0.1" min="0.1" value="${c.price_ok ?? 3.0}"/>
        </div>
      </div>

      <div class="section">Activities</div>
      <div id="activity-list">${activityRows}</div>
      <button class="add-btn" id="add-btn">+ Add activity</button>

      <div class="section">Generated YAML</div>
      <button class="copy-btn" id="copy-btn">Copy</button>
      <div class="yaml-box" id="yaml-preview"></div>`;

    // ── Root field listeners ──────────────────────────────────────────────
    this.shadowRoot.getElementById('entity-input')
      .addEventListener('change', e => this._updateRoot('entity', e.target.value.trim()));
    this.shadowRoot.getElementById('hours-input')
      .addEventListener('change', e => this._updateRoot('hours_ahead', e.target.value));
    this.shadowRoot.getElementById('search-input')
      .addEventListener('change', e => this._updateRoot('search_hours', e.target.value));
    this.shadowRoot.getElementById('price-good-input')
      .addEventListener('change', e => this._updateRoot('price_good', e.target.value));
    this.shadowRoot.getElementById('price-ok-input')
      .addEventListener('change', e => this._updateRoot('price_ok', e.target.value));

    // ── Activity field listeners (delegated) ─────────────────────────────
    this.shadowRoot.getElementById('activity-list')
      .addEventListener('input', e => {
        const el = e.target;
        if (!el.dataset.idx) return;
        this._updateActivity(parseInt(el.dataset.idx), el.dataset.field, el.value);
        this._refreshYaml();
        // Update row title live
        if (el.dataset.field === 'name') {
          const titles = this.shadowRoot.querySelectorAll('.act-row-title');
          titles[parseInt(el.dataset.idx)].textContent = el.value || `Activity ${parseInt(el.dataset.idx) + 1}`;
        }
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
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });

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

    const yaml =
`type: custom:electricity-cost-card
entity: ${c.entity ?? 'sensor.nordpool_kwh_...'}
hours_ahead: ${c.hours_ahead ?? 6}
search_hours: ${c.search_hours ?? 12}
price_good: ${c.price_good ?? 1.5}
price_ok: ${c.price_ok ?? 3.0}
activities:
${acts}`;

    const box = this.shadowRoot.getElementById('yaml-preview');
    if (box) box.textContent = yaml;
  }
}

customElements.define('electricity-cost-card-editor', ElectricityCostCardEditor);


// =============================================================================
// MAIN CARD
// =============================================================================

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
  }

  // Called by HA when the card config is set or changed.
  setConfig(config) {
    if (!config.entity) throw new Error('electricity-cost-card: entity is required');
    this._config = {
      entity:       config.entity,
      hours_ahead:  config.hours_ahead  ?? 6,
      search_hours: config.search_hours ?? 12,
      price_good:   config.price_good   ?? 1.5,  // Good price ceiling (kr/kWh)
      price_ok:     config.price_ok     ?? 3.0,  // OK/Normal ceiling (kr/kWh)
      activities:   config.activities   ?? [],
    };
    this._render();
  }

  // Called by HA every time any entity state changes.
  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    if (!stateObj) return;
    this._livePrice = parseFloat(stateObj.state);
    this._today     = stateObj.attributes.today    ?? [];
    this._tomorrow  = stateObj.attributes.tomorrow ?? [];
    // Merge into a single timeline so all look-ahead logic crosses midnight seamlessly.
    // today has 96 blocks (00:00–23:45), tomorrow appended starts at index 96 (= 00:00 next day).
    this._prices = [...this._today, ...this._tomorrow];
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

  // Links to documentation from the HA card picker and editor UI.
  static getConfigDocumentation() {
    return 'https://github.com/johro897/electricity-cost-card';
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

  // Bar / gauge color based on absolute price level.
  _priceColor(p) {
    if (p <= 1.0) return '#639922'; // green
    if (p <= 2.0) return '#BA7517'; // amber
    if (p <= 3.0) return '#E24B4A'; // red
    return '#A32D2D';               // dark red
  }

  // Overall status badge — uses price_good / price_ok from root config.
  _priceStatus(p) {
    const good = this._config.price_good ?? 1.5;
    const ok   = this._config.price_ok   ?? 3.0;
    if (p <= good) return { cls: 'good', label: 'Good price' };
    if (p <= ok)   return { cls: 'ok',   label: 'Normal'     };
    return               { cls: 'bad',   label: 'High price'  };
  }

  // Per-activity simple recommendation (used when no duration_hours).
  _simpleRec(price, threshold) {
    if (price <= threshold)     return { cls: 'good', label: 'Good now' };
    if (price <= threshold * 2) return { cls: 'ok',   label: 'OK now'   };
    return                             { cls: 'bad',  label: 'Wait'     };
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

    const endIdx = Math.min(bestStart + numBlocks - 1, this._today.length - 1);
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

  // Render SVG bar chart + trend line for upcoming blocks.
  _buildGraph(blocks) {
    if (!blocks.length) {
      return '<div style="font-size:11px;color:var(--secondary-text-color);padding:8px 0;">No price data available</div>';
    }
    const prices = blocks.map(b => b.price);
    const maxP   = Math.max(...prices, 0.1);
    const W = 100, H = 52;
    const barW   = Math.max(0.8, (W / prices.length) - 0.4);

    const bars = prices.map((p, i) => {
      const bh  = Math.max(2, (p / maxP) * H);
      const x   = (i / prices.length) * W;
      const y   = H - bh;
      const col = blocks[i].isCurrent ? '#185FA5' : this._priceColor(p);
      const op  = blocks[i].isCurrent ? '1' : '0.6';
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${bh.toFixed(2)}" fill="${col}" opacity="${op}"/>`;
    }).join('');

    // Trend indicator comparing last vs first block
    const diff       = prices[prices.length - 1] - prices[0];
    const trendSym   = diff > 0.05 ? '↑' : diff < -0.05 ? '↓' : '→';
    const trendColor = diff > 0.05 ? '#E24B4A' : diff < -0.05 ? '#639922' : '#888780';
    const lastPrice  = this._fmt(prices[prices.length - 1]);

    return `
      <svg width="100%" viewBox="0 0 100 52" preserveAspectRatio="none" style="height:52px;display:block;">${bars}</svg>
      <div style="display:flex;justify-content:space-between;margin-top:3px;">
        <span style="font-size:10px;color:var(--secondary-text-color)">${blocks[0].time}</span>
        <span style="font-size:11px;font-weight:500;color:${trendColor}">${trendSym} ${lastPrice} kr/kWh</span>
        <span style="font-size:10px;color:var(--secondary-text-color)">${blocks[blocks.length - 1].time}</span>
      </div>`;
  }


  // ── Activity rendering ─────────────────────────────────────────────────────

  _renderActivity(activity) {
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
            <div class="activity-icon" style="background:${iconBg}">${activity.icon}</div>
            <div class="activity-info">
              <div class="activity-name">${activity.name}</div>
              <div class="activity-sub">${kwhStr}</div>
            </div>
            <div class="activity-right" style="color:var(--secondary-text-color);font-size:12px;">Loading…</div>
          </div>`;
      }
      const price   = this._simPrice !== null ? this._simPrice : this._livePrice;
      const cMin    = activity.kwh_min * price;
      const cMax    = activity.kwh_max * price;
      const costStr = activity.kwh_min === activity.kwh_max
        ? `${this._fmt(cMin)} kr`
        : `${this._fmt(cMin)}–${this._fmt(cMax)} kr`;
      const rec = this._simpleRec(price, activity.threshold ?? 1.5);

      return `
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${activity.icon}</div>
          <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
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
        ? `${this._fmt(cMin)} kr`
        : `${this._fmt(cMin)}–${this._fmt(cMax)} kr`;
      const rec = this._simpleRec(price, activity.threshold ?? 1.5);
      const durLabel = `${kwhStr} · ${activity.duration_hours}h`;
      return `
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${activity.icon}</div>
          <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
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
          ? `${this._fmt(nowCost.costMin)} kr`
          : `${this._fmt(nowCost.costMin)}–${this._fmt(nowCost.costMax)} kr`)
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
        ? `${this._fmt(best.costMin)} kr`
        : `${this._fmt(best.costMin)}–${this._fmt(best.costMax)} kr`;
      return `
        <div class="best-row">
          <span class="best-label"><span class="best-dot"></span>Best ${best.startTime}–${best.endTime}</span>
          <span class="best-cost">${bestStr}</span>
        </div>`;
    })() : '';

    return `
      <div class="activity-dur">
        <div class="activity">
          <div class="activity-icon" style="background:${iconBg}">${activity.icon}</div>
          <div class="activity-info">
            <div class="activity-name">${activity.name}</div>
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


  // ── Main render ────────────────────────────────────────────────────────────

  _render() {
    if (!this._config.entity) return;

    // Don't render meaningful data until we have a real price from HA.
    const hasPrice = this._livePrice !== null || this._simPrice !== null;
    const price        = this._simPrice !== null ? this._simPrice : (this._livePrice ?? 0);
    const isSimulating = this._simPrice !== null;
    const status       = this._priceStatus(price);
    const gaugePct     = Math.min(97, Math.max(3, (price / 5) * 100));
    const gaugeColor   = this._priceColor(price);
    const upcomingBlocks = this._getUpcomingBlocks();
    const graph        = this._buildGraph(upcomingBlocks);
    const activities   = this._config.activities.map(a => this._renderActivity(a)).join('');
    const timeNow      = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

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
        .sim-tag { font-size: 10px; font-weight: 500; background: #FAEEDA; color: #854F0B;
                   padding: 2px 8px; border-radius: 10px; }

        /* ── Status badge ── */
        .badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px;
                 border-radius: 20px; font-size: 12px; font-weight: 500; flex-shrink: 0; }
        .badge.good { background: #EAF3DE; color: #27500A; }
        .badge.ok   { background: #FAEEDA; color: #633806; }
        .badge.bad  { background: #FCEBEB; color: #791F1F; }
        .badge-dot  { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .badge.good .badge-dot { background: #639922; }
        .badge.ok   .badge-dot { background: #BA7517; }
        .badge.bad  .badge-dot { background: #E24B4A; }

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
        .rec.rec-good { color: #27500A; }
        .rec.rec-ok   { color: #633806; }
        .rec.rec-bad  { color: #791F1F; }
        .rec-dot  { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .rdot-good { background: #639922; }
        .rdot-ok   { background: #BA7517; }
        .rdot-bad  { background: #E24B4A; }

        /* Savings badge (green pill) */
        .save-badge { font-size: 10px; font-weight: 500; color: #27500A; background: #EAF3DE;
                      padding: 2px 7px; border-radius: 10px; margin-top: 3px; display: inline-block; }

        /* Best-window sub-row */
        .best-row  { display: flex; align-items: center; justify-content: space-between;
                     padding: 5px 11px 7px 55px; background: var(--secondary-background-color);
                     border-top: 0.5px solid var(--divider-color, #e0e0e0); }
        .best-label { display: flex; align-items: center; gap: 5px;
                      font-size: 11px; color: #27500A; font-weight: 500; }
        .best-dot   { width: 6px; height: 6px; border-radius: 50%; background: #639922;
                      display: inline-block; flex-shrink: 0; }
        .best-cost  { font-size: 11px; font-weight: 500; color: #27500A; }

        /* ── Footer ── */
        .divider { height: 1px; background: var(--divider-color, #e0e0e0); margin: 14px 0; }
        .footer  { font-size: 10px; color: var(--secondary-text-color); text-align: right; }
      </style>

      <ha-card>
        <div class="card-title">Electricity cost</div>

        <div class="header">
          <div class="price-row">
            <span class="price-value">${hasPrice ? price.toFixed(2) : '–'}</span>
            <span class="price-unit">kr/kWh</span>
            ${isSimulating ? '<span class="sim-tag">SIMULATION</span>' : ''}
          </div>
          <span class="badge ${hasPrice ? status.cls : 'ok'}">
            <span class="badge-dot"></span>${hasPrice ? status.label : 'Loading…'}
          </span>
        </div>

        <div class="gauge-track">
          <div class="gauge-fill" style="width:${gaugePct}%;background:${gaugeColor};"></div>
        </div>
        <div class="gauge-labels"><span>0 kr</span><span>2.5 kr</span><span>5 kr</span></div>

        <div class="slider-row">
          <input type="range" id="price-slider" min="0.10" max="5.00" step="0.01" value="${price.toFixed(2)}"/>
          ${isSimulating ? '<button class="reset-btn" id="reset-btn">↺ Live</button>' : ''}
        </div>

        <div class="section-label">Next ${this._config.hours_ahead} hours</div>
        <div class="graph-wrap">${graph}</div>

        <div class="section-label">Activities</div>
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
        this._render();
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
  type:        'electricity-cost-card',
  name:        'Electricity Cost Card',
  description: 'Real-time electricity pricing from Nordpool with per-activity cost calculations.',
  preview:     true,
});
