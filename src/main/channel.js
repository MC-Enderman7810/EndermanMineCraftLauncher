'use strict';

const fs = require('fs');
const path = require('path');

function readChannel() {
  if (process.env.EMCL_CHANNEL === 'dev' || process.env.EMCL_CHANNEL === 'release') {
    return process.env.EMCL_CHANNEL;
  }
  try {
    const file = path.join(__dirname, '../../channel.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && parsed.channel === 'dev') return 'dev';
  } catch { /* default release */ }
  return 'release';
}

const channel = readChannel();
module.exports = { channel, isDev: channel === 'dev' };
