// sessionUtils.js
const fs = require('fs');
const path = './sessions.json';

// Cargar todas las sesiones desde el archivo JSON
const loadSessionsFromFile = () => {
    try {
        if (fs.existsSync(path)) {
            const data = fs.readFileSync(path);
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error("Error al cargar sesiones:", error);
        return {};
    }
};

// Guardar todas las sesiones en el archivo JSON
const saveSessionsToFile = (sessions) => {
    try {
        fs.writeFileSync(path, JSON.stringify(sessions, null, 2));
    } catch (error) {
        console.error("Error al guardar sesiones:", error);
    }
};

// Guardar una sesión específica
const saveSession = (sessionId, authState) => {
    const sessions = loadSessionsFromFile();
    sessions[sessionId] = authState;
    saveSessionsToFile(sessions);
};

// Cargar una sesión específica
const loadSession = (sessionId) => {
    const sessions = loadSessionsFromFile();
    return sessions[sessionId] || null;
};

module.exports = { saveSession, loadSession };
