'use strict';
const crypto = require('crypto');
const password = process.argv[2] || '';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
process.stdout.write('pbkdf2$sha256$100000$' + salt + '$' + hash);
