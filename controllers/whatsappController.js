const { response } = require('express');
const fs = require('fs');

const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// const { default: Baileys, useMultiFileAuthState, DisconnectReason } = require('baileys');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

const SESSION_PATH = './auth_info/phone';
let socket = null;

// ✅ Elimina la sesión existente si hay
// const deleteSession = async () => {
//     if (fs.existsSync(SESSION_PATH)) {
//         // try {
//         //     fs.unlinkSync(SESSION_PATH);
//         //     console.log('✅ Sesión eliminada');
//         // } catch (err) {
//         //     console.error('Error al eliminar la sesión:', err);
//         // }

//         try {
//             fs.rmSync(SESSION_PATH, { recursive: true, force: true });
//             console.log('✅ Sesión eliminada');
//         } catch (err) {
//             console.error('❌ Error al eliminar la carpeta:', err);
//         }
//     }
// };
const deleteSession = async () => {
    try {
        // Verifica si existe antes de eliminar
        await fs.promises.access(SESSION_PATH, fs.constants.F_OK);
        
        await fs.promises.rm(SESSION_PATH, { recursive: true, force: true });
        console.log('✅ Sesión eliminada');
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('ℹ️ No existe la sesión, no se elimina nada');
        } else {
            console.error('❌ Error al eliminar la carpeta:', err);
        }
    }
};

// ✅ Cerrar sesión manualmente
const logout = async (req, res) => {
    if (!socket) {
        return res.status(400).json({ ok: false, msg: 'No hay sesión activa' });
    }

    try {
        await socket.logout();
        await deleteSession();
        res.json({ ok: true, msg: 'Sesión cerrada exitosamente' });
    } catch (err) {
        console.error('❌ Error al cerrar sesión:', err);
        res.status(500).json({ ok: false, msg: 'Error cerrando sesión' });
    }
};

const getQR = async (req, res) => {
  try {
    // await deleteSession(); // Si quieres reiniciar siempre la sesión

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

    socket = makeWASocket({
      auth: state,
      browser: ['Ubuntu', 'Chrome', '22.04.4']
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        console.log('📱 Escanea el siguiente código QR:', qr);
        return res.json({ qr });
      }

      if (connection === 'open') {
        console.log('✅ Conectado a WhatsApp');
        return res.status(500).json({
            ok: false,
            msg: '✅ Este dispositivo ya esta vinculado, vuelve a enviar 1 mensaje.'
        });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Conexión cerrada. Código: ${reason}`);

        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔁 Reconectando...');
          getQR(req, res);
        } else {
          console.log('🔒 Cierre de sesión detectado.');
        }
      }
    });

  } catch (err) {
    console.error('❌ Error al generar el QR:', err);
    return res.status(500).json({
      ok: false,
      msg: 'Error inesperado al generar el QR'
    });
  }
};

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
    const delayBetweenBatches = Math.random() * (7000 - 4500) + 4500; // Ajusta el retraso entre lotes (en milisegundos)

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
            const delayBetweenBatches2 = Math.random() * (7000 - 4500) + 4500;

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
    const delayM = Math.random() * (7000 - 4500) + 4500;
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
    const delayBetweenBatches = Math.random() * (7000 - 4500) + 4500; // Ajusta el retraso entre lotes (en milisegundos)

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
            const delayBetweenBatches2 = Math.random() * (7000 - 4500) + 4500;

            sendMessageMasiveImg(contact.number, contact.message, path)

            await delay(delayBetweenBatches2);
        }

        // Esperar un retraso antes de enviar el siguiente lote
        await delay(delayBetweenBatches);
    }
};

const sendMessageMasiveImg = async(number, message, path) => {

    // Pausa entre mensajes para evitar el spam
    const delayM = Math.random() * (7000 - 4500) + 4500;
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
    sendMasivesImg,
    logout
};
