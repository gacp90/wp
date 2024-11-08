require('dotenv').config();
const express = require("express");
const cors = require('cors');

const app = express();
// CORS
app.use(cors());

//app.use(express.bodyParser({ limit: '50mb' }));
// READ BODY
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

// RUTAS
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

app.listen(process.env.PORT, () => {
    console.log('Servidor Corriendo en el Puerto', process.env.PORT);
});