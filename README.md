# electricity-cost-card

A Home Assistant custom card that displays real-time electricity pricing from Nordpool with per-activity cost calculations, a price graph for upcoming hours, and smart recommendations for when to run your appliances.

![](screenshots/screenshot.png)

## Features

- **Live price** from Nordpool sensor (15-minute blocks)
- **Currency-agnostic** — auto-detects currency and unit from the sensor (SEK, EUR, ...), or set them explicitly
- **Price graph** covering the next N hours, configurable per dashboard — crosses midnight seamlessly using tomorrow's prices when available
- **Per-activity cost** — each appliance shows what it will cost right now
- **Duration mode** — appliances with a set runtime show the integrated cost over real upcoming price blocks, not just the current spot price
- **Best window** — finds the cheapest consecutive time slot within your search horizon, including overnight
- **Simulation slider** — drag to simulate any price and see how costs change; resets to live with one tap
- **Visual editor** — configure all settings directly in the HA dashboard UI, with a generated YAML snippet you can copy
- **Threshold-based recommendations** — Good / OK / Wait per appliance, based on price per kWh vs your own threshold


## Requirements

- Home Assistant with a working [Nordpool integration](https://github.com/custom-components/nordpool) (HACS)
- The Nordpool sensor must expose:
  - `state` — current price (any currency per kWh)
  - `attributes.today` — list of 96 price values (one per 15-minute block)
  - `attributes.tomorrow` — list of price values for tomorrow (published by Nordpool ~13:00 each day, used to extend the graph and best-window search past midnight)
  - `attributes.currency` / `attributes.unit` — optional, used to auto-detect the display suffix (e.g. `SEK`/`kr`, `EUR`/`€`)


## Installation

### 1. Via HACS (recommended)

This card is not yet listed in the default HACS catalog. You can add it as a custom repository by clicking the button below (requires [My Home Assistant](https://my.home-assistant.io/) to be configured). HACS will ask you to confirm adding a custom repository — accept and then locate **Electricity Cost Card** under **Frontend** to install it.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=johro897&repository=electricity-cost-card&category=dashboard)

### 2. Manual install

1. Copy `electricity-cost-card.js` to `/config/www/electricity-cost-card/electricity-cost-card.js`

2. Add the resource through **Settings → Dashboards → Resources → +**:
   ```yaml
   url: /local/electricity-cost-card/electricity-cost-card.js
   type: module
   ```

3. Reload the browser cache (`Ctrl/Cmd + Shift + R`)


## Configuration

Add the card to any dashboard via the UI card picker, or paste the YAML manually.

### Minimal example (SEK / Nordic markets)

```yaml
type: custom:electricity-cost-card
entity: sensor.nordpool_kwh_se3_sek_3_10_025
activities:
  - name: Dishwasher
    icon: "🍽️"
    kwh_min: 0.7
    kwh_max: 1.5
    threshold: 1.2
```

No `currency` or `price_max` needed — these are auto-detected from the sensor and scaled from `price_ok`.

### Example for EUR / Dutch dynamic prices

If your Nordpool sensor reports EUR (`attributes.currency: EUR`), the card auto-detects the `€` suffix. For a typical 0.10–0.50 EUR/kWh range, set `price_ok` (and optionally `price_good`) to match your market — the gauge and slider scale automatically from it:

```yaml
type: custom:electricity-cost-card
entity: sensor.nordpool_kwh_nl_eur_3_10_0
price_good: 0.20
price_ok: 0.40
activities:
  - name: Dishwasher
    icon: "🍽️"
    kwh_min: 0.7
    kwh_max: 1.5
    threshold: 0.30
```

With `price_ok: 0.40`, the gauge/slider top out at `0.40 × 5/3 ≈ 0.67` — a sensible range for Dutch all-in prices. Override explicitly with `price_max` if you want a different ceiling.

### Full example

```yaml
type: custom:electricity-cost-card
entity: sensor.nordpool_kwh_se3_sek_3_10_025
hours_ahead: 6
search_hours: 12
price_good: 1.5
price_ok: 3.0
currency: "kr"        # optional — auto-detected if omitted
unit: "kWh"           # optional — auto-detected if omitted
price_max: 5.0        # optional — auto-derived from price_ok if omitted
price_min: 0          # optional — default 0
activities:
  - name: Dishwasher
    icon: "🍽️"
    kwh_min: 0.7
    kwh_max: 1.5
    threshold: 1.2
    duration_hours: 2.0
  - name: Wash & tumble
    icon: "👕"
    kwh_min: 2.0
    kwh_max: 4.0
    threshold: 1.0
    duration_hours: 3.0
  - name: Charge EV
    icon: "🔋"
    kwh_min: 40
    kwh_max: 100
    threshold: 0.8
    duration_hours: 4.0
  - name: 10-min shower
    icon: "🚿"
    kwh_min: 4.0
    kwh_max: 4.0
    threshold: 1.5
```

### Root options

| Key | Type | Default | Description |
|---|---|---|---|
| `entity` | string | **required** | Nordpool sensor entity ID |
| `hours_ahead` | integer | `6` | How many hours the price graph covers |
| `search_hours` | integer | `12` | How far ahead to search for the best activity window |
| `price_good` | number | `1.5` | Price ceiling (per kWh) for the "Good price" status badge |
| `price_ok` | number | `3.0` | Price ceiling (per kWh) for the "Normal" badge — above this shows "High price". Also used to auto-derive `price_max` (see below) |
| `currency` | string | *auto-detected* | Suffix shown after prices, e.g. `"kr"`, `"€"`, `"$"`. If omitted, read from the sensor's `currency` attribute (ISO code mapped to a symbol) and falls back to `"kr"` |
| `unit` | string | *auto-detected* | Suffix shown after currency, e.g. `"kr/kWh"`. If omitted, read from the sensor's `unit` attribute, falls back to `"kWh"` |
| `price_max` | number | `price_ok × 5/3` | Top of the price gauge/slider. The default keeps the original 0–5 kr scale when `price_ok` is left at its default (3.0), and scales proportionally for other markets |
| `price_min` | number | `0` | Bottom of the price gauge/slider |
| `activities` | list | `[]` | List of activity definitions (see below) |

### Activity options

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✓ | Display name |
| `icon` | emoji | ✓ | Icon shown on the card |
| `kwh_min` | number | ✓ | Minimum energy consumption in kWh |
| `kwh_max` | number | ✓ | Maximum energy consumption in kWh |
| `threshold` | number | ✓ | Price per kWh below which the activity is considered "good" |
| `duration_hours` | number | — | Runtime in hours. Enables integrated cost calculation and best-window search |


## How recommendations work

### Overall price badge

The status badge in the top-right corner compares the current price against `price_good` and `price_ok`:

| Condition | Badge |
|---|---|
| `price ≤ price_good` | 🟢 Good price |
| `price ≤ price_ok` | 🟡 Normal |
| `price > price_ok` | 🔴 High price |

### Per-activity recommendation

Each activity compares the price against its own `threshold`:

| Condition | Badge |
|---|---|
| `price ≤ threshold` | 🟢 Good now |
| `price ≤ threshold × 2` | 🟡 OK now |
| `price > threshold × 2` | 🔴 Wait |

For activities with `duration_hours`, the price used is the **average price over the full runtime** starting now — not just the spot price at this moment.

### Suggested threshold values (Swedish market, SEK)

| Appliance | Suggested threshold |
|---|---|
| EV charging (patient load) | `0.5` – `0.8` |
| Washing machine + tumble dryer | `0.8` – `1.0` |
| Dishwasher | `1.0` – `1.2` |
| Shower (hard to defer) | `1.5` – `2.0` |

For other currencies, scale these proportionally — e.g. for EUR markets with prices roughly 1/7th of SEK, a dishwasher threshold around `0.15`–`0.20` is a reasonable starting point.


## How duration cost is calculated

When `duration_hours` is set, the card looks up the actual 15-minute price blocks from Nordpool and calculates:

```
cost = average_price_over_window × kwh
```

**Cost if started now** — integrates the real upcoming blocks covering the full runtime.

**Best window** — slides a window of the same length across the next `search_hours` and finds the slot with the lowest average price. Searches cross midnight automatically when tomorrow's prices are available. The saving percentage is shown if it exceeds 3%.


## Currency and unit auto-detection

The card reads `attributes.currency` and `attributes.unit` from your Nordpool sensor automatically. Known ISO currency codes are mapped to a display symbol:

| ISO code | Displayed as |
|---|---|
| `SEK`, `NOK`, `DKK` | `kr` |
| `EUR` | `€` |
| `GBP` | `£` |
| `USD` | `$` |

Unrecognized codes are shown as-is (e.g. an unmapped code displays literally). If the sensor doesn't expose a `currency` attribute at all, the card falls back to `kr` to preserve original behavior. Set `currency` explicitly in the card config to override auto-detection at any time.


## Visual editor

The card includes a built-in visual editor accessible from the HA dashboard UI. It allows you to:

- Set the entity, graph hours, search hours, and price thresholds
- Optionally override currency, unit, and the gauge/slider price range under **Advanced**
- Add, edit, and remove activities with all fields
- Copy the generated YAML at any time

The editor does not save to a file — it updates the card config in your dashboard's YAML, which is backed up with Home Assistant as usual.


## Storage and backup

All configuration lives in the dashboard YAML (`ui-lovelace.yaml` or the `.storage/lovelace.*` files depending on your setup). It is included in Home Assistant backups automatically and shared across all devices and browsers that access your HA instance.


## Changelog

### v2.1
- **New:** `currency` config key — set an explicit price suffix, or let the card auto-detect it from the sensor's `currency` attribute
- **New:** `unit` config key — same auto-detection pattern for the energy unit
- **New:** `price_max` / `price_min` config keys — the gauge and simulation slider now scale to your market's price range instead of a fixed 0–5 kr. Default `price_max` is derived from `price_ok × 5/3`, preserving the original scale for existing SEK dashboards
- **Note:** the simulation slider's default minimum changed from a hardcoded `0.10` to `0` (override with `price_min` if you need a different floor)
- No breaking changes — existing configs continue to work unchanged

### v2.0
- Initial release


## License

MIT © 2026
