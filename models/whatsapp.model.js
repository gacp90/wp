const { Schema, model } = require('mongoose');

const whatsappSessionSchema = Schema({
    sessionId: { type: String, required: true, unique: true },
    authState: { type: Object, required: true }
});

module.exports = model('Sockets', whatsappSessionSchema);