const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const app = express();
const helmet = require('helmet');
app.use(helmet());

const csrf = require('csurf');
app.use(csrf());

app.use(express.json());
app.use(cors());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this Device, please try again later',
});
app.use(limiter);
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

const contactSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  message: String
});
const Contact = mongoose.model('Contact', contactSchema);

const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1R-uP39Yky74CsdHf6cl6G8F4vqWHlaf6Cr1ZzOXZ4No';

app.post('/api/contact', async (req, res) => {
  const { name, phone, email, message } = req.body;
  try {
    const newContact = new Contact({ name, phone, email, message });
    await newContact.save();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'sheet1!A2:D2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[name, phone, email, message]],
      },
    });

    res.status(201).json({ message: 'Form submitted successfully.' });
  } catch (err) {
    console.error('Error during form submission:', err); 
    res.status(500).json({ error: 'Failed to submit contact form', details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
