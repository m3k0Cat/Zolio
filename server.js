const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API route - could be expanded
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Zolio',
    role: 'Content Creator',
    game: 'Timebomb - Roblox',
    discord: 'https://discord.gg/Q8e7BXcp9b',
    description: 'Giving back to the community, one video at a time.'
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🔥 Zolio's Website is LIVE! 🔥     ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝
  `);
});