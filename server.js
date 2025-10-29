// server.js

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment'); 

// Cargamos variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🛑 FIX CRÍTICO FINAL: Limpieza AGRESIVA para cortar el exceso de texto.
let MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    // Paso 1: Limpieza del prefijo 'MONGO_URI=' y trim inicial.
    MONGO_URI = MONGO_URI.replace('MONGO_URI=', '').trim();
    
    // Paso 2: Localizar el final conocido de la URL (incluyendo el parámetro appName).
    // Esto corta cualquier cosa que Render haya pegado después, como 'PORT=3000'.
    const knownPattern = 'appName=Cluster0';
    const index = MONGO_URI.indexOf(knownPattern);
    
    if (index !== -1) {
        // Cortar la cadena exactamente después de 'appName=Cluster0'
        MONGO_URI = MONGO_URI.substring(0, index + knownPattern.length);
    }
    
    // Paso 3: Limpieza final de espacios o saltos de línea restantes.
    MONGO_URI = MONGO_URI.trim();
}
// ----------------------------------------------------

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '5mb' })); 

// ====================================================
// 1. CONEXIÓN A MONGODB ATLAS 
// ====================================================

// 🛑 ESTA LÍNEA DEBE MOSTRAR AHORA SOLO LA URL SIN TEXTO EXTRA 🛑
console.log('DIAGNÓSTICO MONGO_URI (Final): [' + MONGO_URI + ']');

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000 
})
    .then(() => console.log('Conectado a MongoDB Atlas. DB: enfermeriaDB'))
    .catch(err => {
        console.error('Error de conexión a MongoDB:', err);
    });


// ====================================================
// 2. MODELOS DE DATOS (SERVICIO Y AGENDA)
// ====================================================

const ActividadSchema = new mongoose.Schema({
    descripcion: { type: String, required: true },
    precio: { type: Number, default: 0 }
});

const ServicioSchema = new mongoose.Schema({
    fecha: { type: String, required: true },
    hora: { type: String, required: true },
    nombreFamiliar: { type: String, required: true },
    nombrePaciente: { type: String, required: true },
    nombreAuxiliar: { type: String, required: true },
    concepto: { type: String, required: true, enum: ['Higiene', 'Medicación', 'Acompañamiento', 'Otros'] },
    precio: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    firma: { type: String }, 
    actividades: [ActividadSchema]
});

const AgendaSchema = new mongoose.Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date },
    realizado: { type: Boolean, default: false },
    paciente: { type: String }, 
    auxiliar: { type: String }
});

const Servicio = mongoose.model('Servicio', ServicioSchema);
const Actividad = mongoose.model('Actividad', ActividadSchema);
const Agenda = mongoose.model('Agenda', AgendaSchema);


// ====================================================
// 3. RUTAS API (CRUD Y PDF) 
// ====================================================

// POST: Crear un nuevo servicio
app.post('/api/servicios', async (req, res) => {
    try {
        const newServicio = new Servicio(req.body);
        const savedServicio = await newServicio.save();
        res.status(201).json(savedServicio);
    } catch (error) {
        console.error('Error POST Servicio:', error);
        res.status(400).json({ message: 'Error al crear servicio', error: error.message });
    }
});

// GET: Obtener todos los servicios
app.get('/api/servicios', async (req, res) => {
    try {
        const servicios = await Servicio.find().sort({ fecha: -1, hora: -1 });
        res.json(servicios);
    } catch (error) {
        console.error('Error GET Servicios:', error);
        res.status(500).json({ message: 'Error al obtener servicios', error: error.message });
    }
});

// DELETE: Eliminar TODOS los servicios y citas
app.delete('/api/servicios', async (req, res) => {
    try {
        await Servicio.deleteMany({});
        await Agenda.deleteMany({}); 
        console.log('Todos los servicios y citas eliminados.');
        res.json({ message: 'Todos los servicios y citas eliminados con éxito.' });
    } catch (error) {
        console.error('Error DELETE ALL Servicios:', error);
        res.status(500).json({ message: 'Error al eliminar todos los servicios', error: error.message });
    }
});

// GET: Reporte Individual (Imprimir)
app.get('/api/reporte/individual/:id', async (req, res) => {
    try {
        const servicio = await Servicio.findById(req.params.id);
        if (!servicio) {
            return res.status(404).send('Servicio no encontrado');
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filename = `Servicio_${servicio.nombrePaciente}_${moment(servicio.fecha, 'DD/MM/YYYY').format('YYYYMMDD')}.pdf`;

        res.setHeader('Content-disposition', 'inline; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);
        
        // Lógica de generación de PDF individual
        doc.fillColor('#007A4D').fontSize(20).text('Reporte Individual de Servicio', { align: 'center' }).moveDown(0.5);
        doc.fontSize(12).fillColor('#333333').text(`Fecha: ${servicio.fecha} a las ${servicio.hora}`, { align: 'right' }).moveDown(1);
        doc.fontSize(14).fillColor('#00AEEF').text('DATOS DEL SERVICIO').moveDown(0.5);
        doc.fontSize(12).fillColor('#333333');
        doc.text(`Paciente: ${servicio.nombrePaciente}`);
        doc.text(`Auxiliar: ${servicio.nombreAuxiliar}`);
        doc.text(`Concepto: ${servicio.concepto}`);
        doc.text(`Familiar que recibe: ${servicio.nombreFamiliar}`).moveDown(1);
        doc.fontSize(14).fillColor('#00AEEF').text('DETALLE DE ACTIVIDADES').moveDown(0.5);
        doc.fontSize(12).fillColor('#333333');
        doc.text(`Servicio Base: $${(servicio.precio || 0).toLocaleString()}`).moveDown(0.2);
        
        servicio.actividades.forEach(act => {
            doc.text(`- ${act.descripcion}`, { indent: 15 }).moveDown(0.1); 
        });
        doc.moveDown(1);

        doc.fontSize(16).fillColor('#007A4D').text(`TOTAL COBRADO: $${(servicio.total || 0).toLocaleString()}`, { align: 'right' }).moveDown(2);

        doc.fontSize(12).fillColor('#333333').text('Firma del Familiar:').moveDown(0.5);
        if (servicio.firma) {
            doc.image(servicio.firma, doc.x, doc.y, { width: 200, height: 80 }).moveDown(2);
        } else {
            doc.text('(Firma no disponible)').moveDown(2);
        }
        
        doc.end();

    } catch (error) {
        console.error('Error al generar PDF individual:', error);
        res.status(500).send('Error interno al generar el reporte.');
    }
});

// GET: Reporte General
app.get('/api/reporte/general', async (req, res) => {
    try {
        const servicios = await Servicio.find().sort({ fecha: 1, hora: 1 });

        const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
        const filename = `ReporteGeneral_${moment().format('YYYYMMDD')}.pdf`;

        res.setHeader('Content-disposition', 'inline; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);
        
        // Lógica de generación de PDF general
        let totalGeneral = 0;

        doc.fillColor('#007A4D').fontSize(16).text('Reporte General de Servicios', { align: 'center' }).moveDown(1);
        doc.fontSize(10).fillColor('#333333');

        const tableTop = doc.y;
        const columns = [50, 100, 170, 240, 310, 390, 480, 570, 680];
        doc.fillColor('#00AEEF').text('Fecha', columns[0], tableTop);
        doc.text('Hora', columns[1], tableTop);
        doc.text('Paciente', columns[2], tableTop);
        doc.text('Auxiliar', columns[3], tableTop);
        doc.text('Concepto', columns[4], tableTop);
        doc.text('Actividades Ad.', columns[5], tableTop);
        doc.text('Base ($)', columns[6], tableTop, { align: 'right' });
        doc.text('Total ($)', columns[7], tableTop, { align: 'right' });
        doc.moveDown(1);

        let y = doc.y;

        servicios.forEach(servicio => {
            const fecha = servicio.fecha; 
            const actividadesStr = servicio.actividades.length > 1 ? `${servicio.actividades.length - 1} adiciones` : 'Ninguna';
            totalGeneral += servicio.total;

            doc.fillColor('#333333').text(fecha, columns[0], y);
            doc.text(servicio.hora, columns[1], y);
            doc.text(servicio.nombrePaciente, columns[2], y, { width: 60 });
            doc.text(servicio.nombreAuxiliar, columns[3], y, { width: 70 });
            doc.text(servicio.concepto, columns[4], y, { width: 80 });
            doc.text(actividadesStr, columns[5], y, { width: 80 });
            doc.text((servicio.precio || 0).toLocaleString(), columns[6], y, { align: 'right', width: 80 });
            doc.text((servicio.total || 0).toLocaleString(), columns[7], y, { align: 'right', width: 80 });

            y += 20;
            
            if (y > 550) {
                doc.addPage();
                y = 50;
                doc.fillColor('#00AEEF').text('Fecha', columns[0], y);
                doc.text('Hora', columns[1], y);
                doc.text('Paciente', columns[2], y);
                doc.text('Auxiliar', columns[3], y);
                doc.text('Concepto', columns[4], y);
                doc.text('Actividades Ad.', columns[5], y);
                doc.text('Base ($)', columns[6], y, { align: 'right' });
                doc.text('Total ($)', columns[7], y, { align: 'right' });
                y += 20;
            }
        });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#007A4D').text(`TOTAL RECAUDADO (General): $${totalGeneral.toLocaleString()}`, { align: 'right' }).moveDown(1);
        
        doc.end();

    } catch (error) {
        console.error('Error al generar PDF general:', error);
        res.status(500).send('Error interno al generar el reporte general.');
    }
});


// ----------------------------------------------------
// 4. RUTAS CRUD DE AGENDA 
// ----------------------------------------------------

// GET: Obtener todas las citas
app.get('/api/agenda', async (req, res) => {
    try {
        const agendas = await Agenda.find();
        const eventos = agendas.map(cita => ({
            id: cita._id,
            title: cita.title,
            start: cita.start,
            end: cita.end,
            extendedProps: {
                realizado: cita.realizado,
                paciente: cita.paciente,
                auxiliar: cita.auxiliar
            },
            color: cita.realizado ? '#007A4D' : '#00AEEF' 
        }));
        res.json(eventos);
    } catch (error) {
        console.error('Error GET Agenda:', error);
        res.status(500).json({ message: 'Error al obtener agenda', error: error.message });
    }
});

// POST: Crear una nueva cita
app.post('/api/agenda', async (req, res) => {
    try {
        const newAgenda = new Agenda(req.body);
        const savedAgenda = await newAgenda.save();
        res.status(201).json(savedAgenda);
    } catch (error) {
        console.error('Error POST Agenda (Mongoose/DB):', error);
        res.status(500).json({ message: 'Error de conexión con la base de datos o datos no válidos. Intenta de nuevo.', error: error.message });
    }
});

// PATCH: Actualizar/Reagendar una cita o marcar como realizado
app.patch('/api/agenda/:id', async (req, res) => {
    try {
        const citaActualizada = await Agenda.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(citaActualizada);
    } catch (error) {
        console.error('Error PATCH Agenda:', error);
        res.status(400).json({ message: 'Error al actualizar cita', error: error.message });
    }
});

// DELETE: Eliminar una cita
app.delete('/api/agenda/:id', async (req, res) => {
    try {
        await Agenda.findByIdAndDelete(req.params.id);
        res.json({ message: 'Cita eliminada con éxito' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar cita', error: error.message });
    }
});


// ----------------------------------------------------
// 5. Servir el Frontend Estático
// ----------------------------------------------------
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------------------------------------\
// 6. INICIAR EL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor de Enfermería (v2.0) corriendo en el puerto ${PORT}. ¡Render iniciado con éxito!`);
});