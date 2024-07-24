require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const recognitionRouter = require('./routes/recognition');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS
app.use(cors());

// Conectar a MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('Error connecting to MongoDB Atlas:', err);
});

// Middlewares
app.use(express.json());
app.use('/api/recognition', recognitionRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
