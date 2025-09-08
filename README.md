## Indeed + DayforceHCM Scraper

Scrapes job titles from DayforceHCM and uses them as queries on Indeed Resumes using a single Camoufox/Playwright browser session. Intercepts Indeed's GraphQL response per query, deduplicates by request id, parses to a normalized structure, and saves:

- Raw GraphQL JSON
- Parsed JSON
- Pandas CSV
- JSONL

All outputs are written to the `results/` folder.

### Features
- **Single browser session**: Opens Indeed once and reuses the same page for all searches.
- **Dayforce title intake**: Scrapes today's job titles from `benchmark` candidate portal.
- **Request dedupe**: Avoids processing the same GraphQL response twice (tracks `rcpRequestId`).
- **Structured parsing**: Extracts name, location, skills, educations, experiences.
- **Pandas exports**: Generates CSV and JSONL for analysis; optional long-format utilities are in `parser.py`.

## Requirements
- **Python**: 3.13+
- **OS**: Windows, macOS, or Linux (Windows PowerShell examples shown)
- **Browser**: Managed via Camoufox/Playwright

### Python dependencies
Managed via `pyproject.toml`:

- `camoufox[geoip]`
- `playwright`
- `python-dateutil`
- `pandas`

## Installation


## Usage

### 1) Run the FastAPI server
```powershell
poetry install
poetry run uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

Endpoints:
- `GET /` → basic message
- `GET /health` → health check `{ "status": "ok" }`

Interactive docs available at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 2) Run the combined scraper
```powershell
poetry run python combined_scraper.py
```

What happens:
- Navigates to DayforceHCM and collects job titles posted today.
- Opens Indeed Resume search once. Complete any CAPTCHA/login if prompted.
- For each title: fills the search box, submits, waits for the first unique GraphQL response, saves outputs, then waits for Enter before the next query.

Outputs per query (in `results/`):
- `indeed_raw_{query}_{timestamp}.json` (raw GraphQL)
- `indeed_parsed_{query}_{timestamp}.json` (parsed structure)
- `{query}_pandas.csv` (flat table)
- `{query}_pandas.jsonl` (one candidate per line)

Notes:
- Filenames are sanitized; `timestamp` is UTC.
- Deduplication uses `data.findRCPMatches.rcpRequestId`.
- On timeout, a screenshot is saved to `results/indeed_timeout_screenshot.jpg`.

### 3) Parse a saved parsed JSON (optional, standalone)
You can re-run Pandas exports using the in-package CLI against any previously saved `indeed_parsed_*.json`:
```powershell
python -m app.scrapers.parser -i .\results\indeed_parsed_Maintenance_Supervisor_20250905T165931Z.json \
  --out-csv maintenance_supervisor_parsed_pandas.csv \
  --out-jsonl maintenance_supervisor_parsed_pandas.jsonl \
  --explode-experiences \
  --exploded-out maintenance_supervisor_experiences_long.csv
```

## Project Structure
- `combined_scraper.py`: End-to-end scraper (Dayforce → Indeed → save raw/parsed/CSV/JSONL).
- `app/scrapers/parser.py`: Pandas helpers and CLI to transform parsed JSON into analytics-friendly files.
- `pyproject.toml`: Dependencies and metadata.
- `results/`: Output directory created at runtime.

## Troubleshooting
- **CAPTCHA/login**: The script pauses after opening Indeed. Complete any verification and press Enter to continue.
- **No GraphQL captured**: Ensure the search page fully loads; the script waits up to 60s per query.
- **Empty matches**: Some queries may return zero candidates; outputs will still be written.

### Quick Start

1. **Start Chrome with remote debugging port:**

   Open a terminal (or Run dialog) and start Chrome with the following command (adjust the path if needed):

   ```sh
   start chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir="C:\temp\chromedata"
   ```

2. **Install dependencies:**

   ```sh
   poetry install
   ```

3. **Install Camoufox:**

   ```sh
   poetry run camoufox fetch
   ```

4. **Run the combined scraper:**

   ```sh
   poetry run python combined_scraper.py
   ```

