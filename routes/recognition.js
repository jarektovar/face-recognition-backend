const express = require('express');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const { Canvas, Image, ImageData } = canvas;
const Student = require('../models/student'); // Ajusta la ruta según sea necesario
const { Buffer } = require('buffer');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const router = express.Router();

// Cargar modelos de face-api.js
const loadModels = async () => {
  const modelsPath = path.join(__dirname, '..', 'models');
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    console.log('Models loaded');
  } catch (error) {
    console.error('Error loading models:', error);
  }
};

loadModels();

// Ruta para reconocimiento facial
router.post('/', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let queryImageCanvas;
    try {
      queryImageCanvas = await canvas.loadImage(buffer);
    } catch (error) {
      return res.status(400).json({ error: 'Error loading image into canvas' });
    }

    let queryDetection;
    try {
      queryDetection = await faceapi.detectSingleFace(queryImageCanvas).withFaceLandmarks().withFaceDescriptor();
    } catch (error) {
      return res.status(400).json({ error: 'Error detecting face' });
    }

    if (!queryDetection) {
      return res.status(400).json({ error: 'Face not detected in the uploaded image' });
    }

    const students = await Student.find({ photo_estudiante: { $exists: true } });
    let match = null;

    for (let student of students) {
      const referenceImage = Buffer.from(student.photo_estudiante, 'base64');
      let referenceImageCanvas;
      try {
        referenceImageCanvas = await canvas.loadImage(referenceImage);
      } catch (error) {
        continue;
      }

      let referenceDetection;
      try {
        referenceDetection = await faceapi.detectSingleFace(referenceImageCanvas).withFaceLandmarks().withFaceDescriptor();
      } catch (error) {
        continue;
      }

      if (referenceDetection) {
        const distance = faceapi.euclideanDistance(referenceDetection.descriptor, queryDetection.descriptor);
        if (distance < 0.6) { // Ajusta el umbral según tus necesidades
          match = student;
          break;
        }
      }
    }

    if (match) {
      res.json({ match: true, student: match });
    } else {
      res.json({ match: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error recognizing photo' });
  }
});

module.exports = router;
