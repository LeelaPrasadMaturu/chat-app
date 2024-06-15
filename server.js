const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('ws');
const { v4: uuidv4 } = require('uuid');

// // Connect to MongoDB
// 

require('dotenv').config(); // Load environment variables from .env file

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for messages
const messageSchema = new mongoose.Schema({
    room: String,
    username: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

app.use(express.static('public'));
app.use(express.json()); // Parse JSON bodies

app.get('/generate-link', (req, res) => {
    const roomId = uuidv4();
    res.send({ link: `http://localhost:3000/chat.html?room=${roomId}` });
});

app.get('/chat.html', (req, res) => {
    res.sendFile(__dirname + '/public/chat.html');
});

app.get('/messages/:room', async (req, res) => {
    const room = req.params.room;
    try {
        const messages = await Message.find({ room }).sort({ timestamp: 1 }).exec();
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message);
        const { room, username, text } = parsedMessage;
        
        if (!room || !username || !text) {
            return;
        }
        
        try {
            const newMessage = new Message({ room, username, text });
            await newMessage.save();
            // Broadcast message to all clients
            wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(newMessage));
                }
            });
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });
});

server.listen(3000, function() {
    console.log('Server is listening on http://localhost:3000');
});
