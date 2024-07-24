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
      console.log('No image provided');
      return res.status(400).json({ error: 'No image provided' });
    }

    const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let queryImageCanvas;
    try {
      queryImageCanvas = await canvas.loadImage(buffer);
      console.log('Image loaded into canvas');
    } catch (error) {
      console.error('Error loading image into canvas:', error);
      return res.status(400).json({ error: 'Error loading image into canvas' });
    }

    let queryDetection;
    try {
      queryDetection = await faceapi.detectSingleFace(queryImageCanvas).withFaceLandmarks().withFaceDescriptor();
      console.log('Face detected in query image');
    } catch (error) {
      console.error('Error detecting face:', error);
      return res.status(400).json({ error: 'Error detecting face' });
    }

    if (!queryDetection) {
      console.log('No face detected in the uploaded image');
      return res.status(400).json({ error: 'Face not detected in the uploaded image' });
    }

    const students = await Student.find({ photo_estudiante: { $exists: true } });
    let match = null;

    for (let student of students) {
      const referenceImage = Buffer.from(student.photo_estudiante, 'base64');
      let referenceImageCanvas;
      try {
        referenceImageCanvas = await canvas.loadImage(referenceImage);
        console.log('Reference image loaded into canvas for student:', student._id);
      } catch (error) {
        console.error('Error loading reference image into canvas:', error);
        continue;
      }

      let referenceDetection;
      try {
        referenceDetection = await faceapi.detectSingleFace(referenceImageCanvas).withFaceLandmarks().withFaceDescriptor();
        console.log('Reference detection result for student:', student._id, referenceDetection);
      } catch (error) {
        console.error('Error detecting face in reference image for student:', student._id, error);
        continue;
      }

      if (referenceDetection) {
        const distance = faceapi.euclideanDistance(referenceDetection.descriptor, queryDetection.descriptor);
        console.log('Distance between query and reference for student:', student._id, distance);
        if (distance < 0.6) { // Ajusta el umbral según tus necesidades
          match = student;
          break;
        }
      }
    }

    if (match) {
      console.log('Match found:', match);
      res.json({ match: true, student: match });
    } else {
      console.log('No match found');
      res.json({ match: false });
    }
  } catch (err) {
    console.error('Error recognizing photo:', err);
    res.status(500).json({ error: 'Error recognizing photo' });
  }
});

module.exports = router;
