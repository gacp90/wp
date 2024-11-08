const { default: Baileys, useMultiFileAuthState, DisconnectReason } = require('baileys');
const qrcode = require('qrcode-terminal');

/** ======================================================================
 *  CONEXION
=========================================================================*/
const connectToWhatsApp = async (sessionId) => {
    let socket;

    const { state, saveCreds } = await useMultiFileAuthState(`./auth_info/${sessionId}`);    

    // Crear socket de Baileys
    socket = Baileys({
        auth: state,
        printQRInTerminal: true,  // Imprime el código QR en la terminal
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log('Escanea el siguiente código QR:', qr);
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`Conexión cerrada. Razón: ${reason}`);
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconectando...");
                connectToWhatsApp(sessionId);  // Intenta reconectar automáticamente
            } else {
                console.log("Se cerró sesión. Escanea el QR para autenticarte nuevamente.");
            }
        }

        if (connection === 'open') {
            console.log('Conexión exitosa con WhatsApp');
        }
    });

    return socket;
};

/** ======================================================================
 *  CONEXION
=========================================================================*/
const sendMessage = async (phoneNumber, message, socket) => {
    try {
        
        await socket.sendMessage(phoneNumber, { text: message });
        return true;

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });        
    } 
};

module.exports = {
    connectToWhatsApp,
    sendMessage
}