# electricity-cost-card

Shows your current electricity price from Nordpool alongside what each of your appliances will cost to run — right now, and when the cheapest time to run them is.

## What it does

**Price at a glance** — the current Nordpool spot price with a color-coded status (good / normal / high) and a gauge showing where the price sits on a 0–5 kr/kWh scale.

**Price graph** — a bar chart of upcoming 15-minute price blocks so you can see at a glance whether prices are rising or falling.

**Activity costs** — each appliance you configure shows:
- What it will cost to run right now (based on your kWh values)
- A recommendation: Good now / OK now / Wait — based on your own threshold per appliance

**Smart duration mode** — for appliances with a set runtime (e.g. dishwasher runs for 2 hours), the card calculates the true integrated cost over the upcoming price blocks, not just the current spot price. It also finds the cheapest available time slot within your search window and shows the potential saving.

**Simulation** — drag the price slider to simulate any price level and see how costs change across all activities. A Live button snaps back to the real price.

## Configuration

All settings are managed through the built-in visual editor in the HA dashboard UI. You can add and remove appliances, set kWh values, thresholds, and runtimes without editing YAML by hand. A YAML copy button is available in the editor if you prefer to work directly in the config.

## Requirements

- [Nordpool integration](https://github.com/custom-components/nordpool) installed via HACS
- Sensor must expose `state` (current price) and `attributes.today` (96 × 15-min price blocks)
