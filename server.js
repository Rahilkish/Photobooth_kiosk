const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // Allows large high-res photo files
});

// Create a folder to save photos if it doesn't exist
const uploadDir = path.join(__dirname, 'received_strips');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

io.on('connection', (socket) => {
    console.log('Laptop Connected: ' + socket.id);

    socket.on('send-strip', (data) => {
        const fileName = `Strip_${Date.now()}.jpg`;
        const filePath = path.join(uploadDir, fileName);
        
        // Remove the header from the base64 string and save
        const base64Data = data.image.replace(/^data:image\/jpeg;base64,/, "");
        
        fs.writeFile(filePath, base64Data, 'base64', (err) => {
            if (err) {
                console.log("Error saving file:", err);
            } else {
                console.log("Success! Saved to: " + fileName);
            }
        });
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('--- PRINT STATION ACTIVE ---');
    console.log('Listening for photos on port 3000...');
});