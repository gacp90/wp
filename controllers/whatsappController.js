const { response } = require('express');
const fs = require('fs');

const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// const { default: Baileys, useMultiFileAuthState, DisconnectReason } = require('baileys');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('baileys');

// NUEVO
const deleteSession = async() => {

    // try {
    //     if (socket) {
    //         await socket.logout();
    //         socket = null;
    //     }
    
    //     const sessionPath = `./auth_info`; 

    //     if (fs.existsSync(sessionPath)) {
    //         fs.rm(sessionPath, { recursive: true, force: true });
    //     }
    // } catch {
    // }

    try {
        if (socket) {
            await socket.logout();
            socket = null;
        }

        const folder = './auth_info';

        if (fs.existsSync(folder)) {
            fs.rm(folder, { recursive: true, force: true }, (err) => {
                if (err) console.error('Error eliminando carpeta:', err);
                else console.log('Session Eliminada');
            });
        }
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });
    }

}

/** ======================================================================
 *  GET QR
=========================================================================*/
let socket = null;
let globalQR = null;
const getQR = async (req, res) => {
    try {
        // Eliminar sesión anterior
        await deleteSession();

        const { state, saveCreds } = await useMultiFileAuthState('./auth_info/phone');
        const { version } = await fetchLatestBaileysVersion();

        socket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true
        });

        socket.ev.on('creds.update', saveCreds);

        socket.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                globalQR = qr;  // Guardamos temporalmente para devolverlo por HTTP
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                console.log('Conexión cerrada. Código:', code);
                if (code !== DisconnectReason.loggedOut) {
                    console.log('Reconectando...');
                } else {
                    console.log('Cierre de sesión detectado.');
                }
            }

            if (connection === 'open') {
                console.log('Conexión establecida con WhatsApp ✅');
            }
        });

        // Esperar máximo 15 segundos a que llegue el QR
        const waitForQR = async () => {
            for (let i = 0; i < 30; i++) {
                if (globalQR) return globalQR;
                await new Promise(r => setTimeout(r, 500)); // Esperar 500 ms
            }
            throw new Error('Timeout esperando QR');
        };

        const qrCode = await waitForQR();

        return res.status(200).json({
            ok: true,
            qr: qrCode
        });

    } catch (error) {
        console.log('Error en getQR:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error generando QR'
        });
    }
};
// const getQR = async(req, res = response) =>{

//     try {

//         await deleteSession();

//         const { state, saveCreds } = await useMultiFileAuthState(`./auth_info/phone`);    

//         // Crear socket de Baileys
//         socket = Baileys({
//             auth: state
//         });

//         socket.ev.on('creds.update', saveCreds);

//         socket.ev.on('connection.update', (update) => {
//             const { connection, qr, lastDisconnect } = update;

//             if (qr) {
//                 console.log('Escanea el siguiente código QR:', qr);
//                 // qrcode.generate(qr, { small: true });
//                 res.json({
//                     qr
//                 })
//             }

//             if (connection === 'close') {
//                 const reason = lastDisconnect?.error?.output?.statusCode;
//                 console.log(`Conexión cerrada. Razón: ${reason}`);
//                 if (reason !== DisconnectReason.loggedOut) {
//                     console.log("Reconectando...");
//                     getQR(req, res);  // Intenta reconectar automáticamente
//                 } else {
//                     console.log("Se cerró sesión. Escanea el QR para autenticarte nuevamente.");
//                 }
//             }

//             if (connection === 'open') {
//                 console.log('Conexión exitosa con WhatsApp');
//             }
//         });
        
//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             ok: false,
//             msg: 'Error inesperado, porfavor intente nuevamente'
//         });
//     }
// }

// Función para enviar un mensaje
const sendMessage = async(req, res)=> {

    let {number, message} = req.body;    

    if (!socket) {
        return res.status(404).send({ error: 'Sesión no encontrada o no conectada, vuelve a escanear el codigo QR' });
    }

    try {
        await socket.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({
            ok: true,
            msg: 'Mensaje enviado con éxito'
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });
    }

}

/** ======================================================================
 *  POST IMG
=========================================================================*/
const sendImage = async(req, res = response) => {


    try {
        let number = req.params.number;
        number = number.trim();
        const { caption } = req.body

        if (!socket) {
            return res.status(404).send({ error: 'Sesión no encontrada o no conectada, vuelve a escanear el codigo QR' });
        }

        // VALIDATE IMAGE
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'No has seleccionado ningún archivo'
            });
        }

        const file = await sharp(req.files.image.data).metadata();
        const extFile = file.format;

        // VALID EXT
        const validExt = ['jpg', 'png', 'jpeg', 'webp', 'bmp', 'svg'];
        if (!validExt.includes(extFile)) {
            return res.status(400).json({
                ok: false,
                msg: 'No se permite este tipo de imagen, solo extenciones JPG - jpeg - PNG - WEBP - SVG'
            });
        }
        // VALID EXT

        // GENERATE NAME
        const nameFile = `${ uuidv4() }.png`;

        // PATH IMAGE
        const path = `./uploads/images/${ nameFile }`;

        await sharp(req.files.image.data)
            .png()
            .toFile(path);

        const to = `${number}@s.whatsapp.net`;
        
        // Envia la imagen como un mensaje de tipo 'imageMessage'
        await socket.sendMessage(to, {
            image: fs.readFileSync(path),
            caption: caption,  // Texto que acompañará la imagen
        });

        if (fs.existsSync(path)) {
            // DELET IMAGE OLD
            fs.unlinkSync(path);
        }
                
        res.json({
            ok: true,
            msg: 'Imagen enviada'
        });


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });
    }

};

/** ======================================================================
 *  POST MASIVOS
=========================================================================*/
const sendMasives = async(req, res = response) => {

    try {

        const { id } = req.params;
        const contacts = req.body.contacts;

        res.json({
            ok: true,
            msg: `Se estan enviando los mensajes masivos...`
        });

        setImmediate(async() => {
            await sendMessagesInBatches(contacts);
        });



    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });
    }

}

// Servicio para manejar el envío de mensajes en lotes
const sendMessagesInBatches = async(contactList) => {
    const batchSize = 20; // Ajusta el tamaño de los lotes según la capacidad de tu servidor
    const delayBetweenBatches = Math.random() * (4500 - 3000) + 3000; // Ajusta el retraso entre lotes (en milisegundos)

    const createBatches = (arr, size) => {
        const batches = [];
        for (let i = 0; i < arr.length; i += size) {
            batches.push(arr.slice(i, i + size));
        }
        return batches;
    };

    const batches = createBatches(contactList, batchSize);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Enviando lote ${i + 1} de ${batches.length}`);

        // Enviar todos los mensajes del lote de forma simultánea
        // await Promise.all(batch.map(contact => sendMessage(contact.number, contact.message, id)));
        for (let e = 0; e < batch.length; e++) {
            const contact = batch[e];
            const delayBetweenBatches2 = Math.random() * (4500 - 3000) + 3000;

            sendMessageMasive(contact.number, contact.message)

            await delay(delayBetweenBatches2);
        }

        // Esperar un retraso antes de enviar el siguiente lote
        await delay(delayBetweenBatches);
    }
};

// Función para retrasar la ejecución
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessageMasive = async(number, message) => {

    // Pausa entre mensajes para evitar el spam
    const delayM = Math.random() * (4500 - 3000) + 3000;
    await delay(delayM);

    try {

        number = number.trim().replace(/\s/g, '');

        await socket.sendMessage(number, { text: message });

    } catch (error) {
        console.error(`Error al enviar el mensaje a ${number}`, error);
        throw error; // Devolver el error para que el controlador maneje el fallo
    }
};

/** ======================================================================
 *  POST MASIVOS IMG
=========================================================================*/
const sendMasivesImg = async(req, res = response) => {

    try {

        const { id } = req.params;
        const data = JSON.parse(req.body.message);   
        const contacts = data.contacts;        

        // VALIDATE IMAGE
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'No has seleccionado ningún archivo'
            });
        }

        const file = await sharp(req.files.image.data).metadata();
        const extFile = file.format;

        // VALID EXT
        const validExt = ['jpg', 'png', 'jpeg', 'webp', 'bmp', 'svg'];
        if (!validExt.includes(extFile)) {
            return res.status(400).json({
                ok: false,
                msg: 'No se permite este tipo de imagen, solo extenciones JPG - jpeg - PNG - WEBP - SVG'
            });
        }
        // VALID EXT

        // GENERATE NAME
        const nameFile = `${ uuidv4() }.png`;

        // PATH IMAGE
        const path = `./uploads/images/${ nameFile }`;

        await sharp(req.files.image.data)
            .png()
            .toFile(path);

        res.json({
            ok: true,
            msg: `Se estan enviando los mensajes masivos...`
        });

        setImmediate(async() => {
            await sendMessagesInBatchesWithImg(contacts, path);
        });



    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado, porfavor intente nuevamente'
        });
    }

}

/** ======================================================================
 *  SEND MASIVES WITH IMAGE
=========================================================================*/
const sendMessagesInBatchesWithImg = async(contactList, path) => {
    const batchSize = 20; // Ajusta el tamaño de los lotes según la capacidad de tu servidor
    const delayBetweenBatches = Math.random() * (4500 - 3000) + 3000; // Ajusta el retraso entre lotes (en milisegundos)

    const createBatches = (arr, size) => {
        const batches = [];
        for (let i = 0; i < arr.length; i += size) {
            batches.push(arr.slice(i, i + size));
        }
        return batches;
    };

    const batches = createBatches(contactList, batchSize);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Enviando lote ${i + 1} de ${batches.length}`);

        // Enviar todos los mensajes del lote de forma simultánea
        // await Promise.all(batch.map(contact => sendMessage(contact.number, contact.message, id)));
        for (let e = 0; e < batch.length; e++) {
            const contact = batch[e];
            const delayBetweenBatches2 = Math.random() * (4500 - 3000) + 3000;

            sendMessageMasiveImg(contact.number, contact.message, path)

            await delay(delayBetweenBatches2);
        }

        // Esperar un retraso antes de enviar el siguiente lote
        await delay(delayBetweenBatches);
    }
};

const sendMessageMasiveImg = async(number, message, path) => {

    // Pausa entre mensajes para evitar el spam
    const delayM = Math.random() * (4500 - 3000) + 3000;
    await delay(delayM);

    try {

        number = number.trim().replace(/\s/g, '');

        // await socket.sendMessage(number, { text: message });

        // Envia la imagen como un mensaje de tipo 'imageMessage'
        await socket.sendMessage(number, {
            image: fs.readFileSync(path),
            caption: message,  // Texto que acompañará la imagen
        });

    } catch (error) {
        console.error(`Error al enviar el mensaje a ${number}`, error);
        throw error; // Devolver el error para que el controlador maneje el fallo
    }
};




module.exports = {
    getQR,
    sendMessage,
    sendImage,
    sendMasives,
    sendMasivesImg
};
