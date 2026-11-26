#!/usr/bin/env node
/* Saves the play stats into the repo, so they can be read without anyone pasting them:
     stats/latest.json        the raw answer from the stats function
     stats/latest.txt         the same plain-text report the stats page copies (what gets pasted into a chat)
     stats/history/DATE.json  one raw snapshot a day, to see how things move
   Run by .github/workflows/stats-snapshot.yml every day, or by hand: node tools/stats-snapshot.js */
'use strict';
const fs = require('fs');
const path = require('path');
const report = require('../stats/report.js');

const URL = 'https://kmkmtkjjlebqdmhsfewx.supabase.co';
const KEY = 'sb_publishable_55XiQN6TSodc2KOTab49Yg_g96sKZeC';   // the public (publishable) key, the same one the game and the stats page use
const dir = path.join(__dirname, '..', 'stats');

(async () => {
  const res = await fetch(URL + '/rest/v1/rpc/get_stats', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  const body = await res.text();
  if (!res.ok) { console.error('Stats request failed: ' + res.status + ' ' + body.slice(0, 300)); process.exit(1); }
  const d = JSON.parse(body);
  if (!d || typeof d !== 'object' || !Array.isArray(d.per_game)) { console.error('Unexpected answer: ' + body.slice(0, 300)); process.exit(1); }
  fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(d, null, 1) + '\n');
  fs.writeFileSync(path.join(dir, 'latest.txt'), report.summary(d) + '\n');
  const day = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dir, 'history', day + '.json'), JSON.stringify(d) + '\n');
  console.log('Saved stats for ' + d.players + ' players, ' + d.per_game.length + ' games (' + day + ').');
})().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
