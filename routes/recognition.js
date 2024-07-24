const express = require('express');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const { Canvas, Image, ImageData } = canvas;
const Student = require('../models/Student');
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
      console.log('Query image loaded into canvas');
    } catch (error) {
      return res.status(400).json({ error: 'Error loading query image into canvas' });
    }

    let queryDetection;
    try {
      queryDetection = await faceapi.detectSingleFace(queryImageCanvas).withFaceLandmarks().withFaceDescriptor();
      console.log('Face detected in query image');
    } catch (error) {
      return res.status(400).json({ error: 'Error detecting face in query image' });
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
        console.log(`Reference image loaded into canvas for student: ${student._id}`);
      } catch (error) {
        console.error(`Error loading reference image for student ${student._id}:`, error);
        continue;
      }

      let referenceDetection;
      try {
        referenceDetection = await faceapi.detectSingleFace(referenceImageCanvas).withFaceLandmarks().withFaceDescriptor();
        console.log(`Reference detection result for student ${student._id}`);
      } catch (error) {
        console.error(`Error detecting face in reference image for student ${student._id}:`, error);
        continue;
      }

      if (referenceDetection) {
        const distance = faceapi.euclideanDistance(referenceDetection.descriptor, queryDetection.descriptor);
        console.log(`Distance between query and reference for student ${student._id}: ${distance}`);
        if (distance < 0.7) {
          match = student;
          break;
        }
      }
    }

    if (match) {
      console.log(`Estudiante encontrado: ${match.nombre_name}`);
      res.json({ match: true, student: { name: match.nombre_name } });
    } else {
      console.log('Estudiante No encontrado');
      res.json({ match: false });
    }
  } catch (err) {
    console.error('Error recognizing photo:', err);
    res.status(500).json({ error: 'Error recognizing photo' });
  }
});

module.exports = router;
