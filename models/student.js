const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  nombre_name: { type: String, required: true },
  apellido: { type: String, required: true },
  numero_documento: { type: String, required: true, unique: true },
  programa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  photo_estudiante: { type: String }
}, { timestamps: { createdAt: 'fecha_creacion' } });

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

module.exports = Student;
