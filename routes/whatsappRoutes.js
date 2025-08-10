const express = require('express');
const expressFileUpload = require('express-fileupload');

// CONTROLADORES
const {  sendMessage, getQR, sendImage, sendMasives, sendMasivesImg, logout } = require('../controllers/whatsappController');

const router = express.Router();
router.use(expressFileUpload());

/** =====================================================================
 *  GET QR
=========================================================================*/
router.get('/logout/', logout);

/** =====================================================================
 *  GET QR
=========================================================================*/
router.get('/qr/:id', getQR);

/** =====================================================================
 *  POST SMS
=========================================================================*/
router.post('/send/:id', sendMessage);

/** =====================================================================
 *  POST IMAGE
=========================================================================*/
router.post('/send-iamge/:id/:number', sendImage);

/** =====================================================================
 *  POST MASIVE SMS
=========================================================================*/
router.post('/masive/:id', sendMasives);

/** =====================================================================
 *  POST MASIVE SMS
=========================================================================*/
router.post('/masive/img/:id', sendMasivesImg);

module.exports = router;
