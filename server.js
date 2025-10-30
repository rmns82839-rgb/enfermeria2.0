// server.js
// API RESTful para la gestión de Servicios de Enfermería (CRUD)
// MEJORADO: Eliminados los campos 'description' y 'signatureData'.

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config'; 
import path from 'path'; 
import { fileURLToPath } from 'url';

const app = express();

// Variables de Entorno y Configuración
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; 

// Obtener __dirname para servir archivos estáticos (index.html)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===================================
// 1. CONFIGURACIÓN INICIAL
// ===================================

// Middlewares
app.use(cors());
app.use(express.json());


// ===================================
// 2. Conexión a MongoDB Atlas
// ===================================

if (!MONGO_URI) {
    console.error('❌ Error Crítico: MONGO_URI no está definida.');
    process.exit(1); 
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas conectado exitosamente.'))
    .catch(err => {
        console.error('❌ Error de conexión a MongoDB:', err.message);
        process.exit(1); 
    });


// ===================================
// 3. DEFINICIÓN DEL ESQUEMA Y MODELO
// ===================================

const ServiceSchema = new mongoose.Schema({
    // Campos de gestión del paciente y familiar
    patientName: {
        type: String,
        required: [true, 'El nombre del paciente es obligatorio.'],
        trim: true,
        maxlength: 100
    },
    familyName: {
        type: String,
        trim: true,
        maxlength: 100
    },
    activity: { // La actividad realizada
        type: String,
        default: 'Baño asistido en ducha', 
        trim: true,
        maxlength: 100
    },
    // Fecha y Hora de Visita
    visitDate: { 
        type: Date,
        required: [true, 'La fecha de la visita es obligatoria.']
    },
    // --- Campo de Precio ---
    price: {
        type: Number,
        required: [true, 'El precio es obligatorio.'],
        default: 20000, 
        min: [0, 'El precio no puede ser negativo.'],
    },
    
    // Campo de Estado
    isCompleted: { 
        type: Boolean,
        default: false,
    }
    // CAMPOS ELIMINADOS: 'description' y 'signatureData'

}, {
    timestamps: true // Añade createdAt y updatedAt
});

// El tercer parámetro 'nursing_services' especifica el nombre de la colección
const Service = mongoose.model('Service', ServiceSchema, 'nursing_services');


// ===================================
// 4. Rutas de la API (Endpoints CRUD)
// ===================================

// RUTA RAIZ: Comprobación de estado y servir index.html
app.get('/', (req, res, next) => {
    // Si la solicitud acepta HTML (es un navegador), sirve el frontend
    if (req.accepts('html')) {
        return res.sendFile(path.join(__dirname, 'index.html'));
    }
    // Si no, sirve la respuesta JSON de estado (para tests/API calls)
    res.status(200).json({ 
        message: 'API de Servicios de Enfermería funcionando.',
        status: 'online',
        database: mongoose.STATES[mongoose.connection.readyState],
        environment: process.env.NODE_ENV || 'development'
    });
});

// Servir archivos estáticos como index.html si no es la ruta raíz.
app.use(express.static(__dirname));


// --- CREATE (POST) ---
app.post('/api/services', async (req, res) => {
    try {
        const newService = new Service(req.body);
        const savedService = await newService.save();
        res.status(201).json(savedService);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Error de validación', errors: messages });
        }
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
});

// --- READ ALL (GET) ---
app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find().sort({ visitDate: 1 }); 
        res.status(200).json(services);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los servicios', error: error.message });
    }
});

// --- READ ONE (GET by ID) ---
app.get('/api/services/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: 'Servicio no encontrado.' });
        }
        res.status(200).json(service);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID de servicio no válido.' });
        }
        res.status(500).json({ message: 'Error al obtener el servicio', error: error.message });
    }
});

// --- UPDATE (PUT) ---
app.put('/api/services/:id', async (req, res) => {
    try {
        const updatedService = await Service.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );

        if (!updatedService) {
            return res.status(404).json({ message: 'Servicio no encontrado para actualizar.' });
        }
        res.status(200).json(updatedService);

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Error de validación', errors: messages });
        }
        res.status(500).json({ message: 'Error al actualizar el servicio', error: error.message });
    }
});


// --- DELETE (DELETE) ---
app.delete('/api/services/:id', async (req, res) => {
    try {
        const deletedService = await Service.findByIdAndDelete(req.params.id);

        if (!deletedService) {
            return res.status(404).json({ message: 'Servicio no encontrado para eliminar.' });
        }
        res.status(204).send(); 
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID de servicio no válido para eliminar.' });
        }
        res.status(500).json({ message: 'Error al eliminar el servicio', error: error.message });
    }
});


// ===================================
// 5. Iniciar el Servidor
// ===================================

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
});

export default app;
