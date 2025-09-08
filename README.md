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

3. **Install Playwright:**

   ```sh
   poetry run playwright install
   ```

4. **Run the combined scraper:**

   ```sh
poetry run uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
   ```

# Execute Automation

```sh
/automation/process
```

