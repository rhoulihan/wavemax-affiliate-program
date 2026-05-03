// Minimal static server used by Playwright (and by hand for local browsing).
// Serves /public on port 3101. No app logic, no database — just files.
const path = require('path');
const express = require('express');

const app = express();
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

const port = process.env.PORT || 3101;
app.listen(port, '127.0.0.1', () => {
  console.log(`[e2e static] listening on http://127.0.0.1:${port}`);
});
