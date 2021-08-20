// mycrypto
// © Will Smart 2018. Licence: MIT

// This wraps crypto for ease of use

// modified from Christoph Hartmann's code:  https://lollyrock.com/articles/nodejs-encryption/

// API is the functions as an object. Use via
//   const {encrypt, decrypt} = require(pathToFile)

module.exports = { hash, encrypt, decrypt };

const crypto = require('crypto'),
  algorithm = 'aes-256-ctr',
  basePassword = process.env.ENCRYPT_KEY || 'password',
  passwords = {},
  hashCycles = 20;

function passwordForMessageType(type) {
  return passwords[type] ? passwords[type] : (passwords[type] = hash('password', type).substring(0, 32));
}

function random(size) {
  const buf = Buffer.alloc(size);
  return crypto
    .randomFillSync(buf)
    .toString('base64')
    .substring(0, size)
    .padEnd(size, '=');
}

function hash(message, type = general) {
  message = `${message}__${basePassword}`;
  for (let count = hashCycles; count >= 0; count--) {
    const hash = crypto.createHash('sha256');
    hash.update(message);
    message = `${hash.digest('base64')}__${type}__${count}`;
  }
  const hash = crypto.createHash('sha256');
  return hash.digest('base64');
}

function encrypt(text, type = 'general') {
  const iv = new Buffer.alloc(16);
  var cipher = crypto.createCipheriv(algorithm, passwordForMessageType(type), iv);
  var crypted = cipher.update(`${random(10)}${text}`, 'utf8', 'base64');
  crypted += cipher.final('base64');
  return crypted;
}

function decrypt(text, type = 'general') {
  const iv = new Buffer.alloc(16);
  var decipher = crypto.createDecipheriv(algorithm, passwordForMessageType(type), iv);
  var dec = decipher.update(text, 'base64', 'utf8');
  dec += decipher.final('utf8');
  return dec.substring(10);
}
