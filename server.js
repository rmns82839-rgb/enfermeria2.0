// server.js
// API RESTful para la gestión de Servicios de Enfermería (CRUD)

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config'; // Esto está bien para Render si NO tienes el .env en el repositorio

const app = express();

// Usar el puerto de Render o 3000 localmente
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// ===================================
// 1. Conexión a MongoDB Atlas
// ===================================

if (!MONGO_URI) {
    console.error('❌ Error Crítico: MONGO_URI no está definida. Verifica tu archivo .env o las variables de entorno de Render.');
    // En un entorno real, lanzarías una excepción o te asegurarías de que esto no ocurra.
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ MongoDB Atlas conectado exitosamente.'))
        .catch(err => {
            console.error('❌ Error de conexión a MongoDB:', err.message);
            // Salir si no hay conexión a la base de datos
            process.exit(1); 
        });
}


// Definición del Esquema y Modelo
const ServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del servicio es obligatorio.'],
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: 'Descripción pendiente.'
    },
    price: {
        type: Number,
        required: [true, 'El precio es obligatorio.'],
        min: [0, 'El precio no puede ser negativo.'],
    },
    durationMinutes: {
        type: Number,
        default: 60,
        min: [5, 'La duración mínima es de 5 minutos.']
    },
}, {
    timestamps: true // Para createdAt y updatedAt
});

// El tercer parámetro 'nursing_services' especifica el nombre de la colección en la BD
const Service = mongoose.model('Service', ServiceSchema, 'nursing_services');


// ===================================
// 2. Middlewares de Express
// ===================================

// Habilitar CORS para permitir peticiones desde el frontend
app.use(cors());

// Parsear el cuerpo de las solicitudes como JSON
app.use(express.json());

// ===================================
// 3. Rutas de la API (Endpoints CRUD)
// ===================================

// RUTA RAIZ: Comprobación de estado
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'API de Servicios de Enfermería funcionando.',
        status: 'online',
        database: mongoose.STATES[mongoose.connection.readyState],
        environment: process.env.NODE_ENV || 'development'
    });
});

// --- CREATE (POST) ---
app.post('/api/services', async (req, res) => {
    try {
        const newService = new Service(req.body);
        const savedService = await newService.save();
        res.status(201).json(savedService);
    } catch (error) {
        // Mongoose Validation Error (código 11000 es duplicado)
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
        const services = await Service.find().sort({ name: 1 });
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
        // Manejar IDs inválidos de MongoDB
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
            { new: true, runValidators: true } // Devuelve el nuevo documento y corre validadores
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
        // 204 No Content indica éxito sin cuerpo de respuesta
        res.status(204).send(); 
        
    } catch (error) {
         if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID de servicio no válido para eliminar.' });
        }
        res.status(500).json({ message: 'Error al eliminar el servicio', error: error.message });
    }
});


// ===================================
// 4. Iniciar el Servidor
// ===================================

app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
});

// Exportamos la app (no es necesario aquí, pero buena práctica)
export default app;
