const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Lưu trữ trạng thái người chơi
const players = {};
let currentGameState = null;

io.on('connection', (socket) => {
    console.log(`Người chơi kết nối: ${socket.id}`);

    // Gán ID người chơi (P1 hoặc P2)
    const playerCount = Object.keys(players).length;
    players[socket.id] = {
        id: socket.id,
        playerId: playerCount % 2 === 0 ? 0 : 1, // 0 là P1, 1 là P2
        x: 0, y: 0, direction: 'down'
    };

    // Gửi dữ liệu khởi tạo cho client vừa kết nối
    socket.emit('init', { 
        playerId: players[socket.id].playerId, 
        players, 
        gameState: currentGameState 
    });

    // Thông báo cho các client khác có người mới vào
    socket.broadcast.emit('playerJoined', players[socket.id]);

    socket.on('syncGame', (data) => {
        currentGameState = data; // Server lưu lại map
        socket.broadcast.emit('gameSynced', data); // Báo cho các client khác
    });

    // Nhận cập nhật di chuyển từ client
    socket.on('playerMove', (data) => {
        players[socket.id] = { ...players[socket.id], ...data };
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // Nhận sự kiện đặt bom
    socket.on('placeBomb', (data) => {
        socket.broadcast.emit('bombPlaced', data);
    });

    // Trung chuyển dữ liệu rớt đồ (chỉ P1 gửi)
    socket.on('syncItem', (data) => {
        socket.broadcast.emit('itemSynced', data);
    });

    // Trung chuyển dữ liệu nhặt đồ và cập nhật điểm số
    socket.on('playerPickedItem', (data) => {
        socket.broadcast.emit('itemPickedByOther', data);
    });

    // Xử lý ngắt kết nối
    socket.on('disconnect', () => {
        console.log(`Người chơi ngắt kết nối: ${socket.id}`);
        delete players[socket.id];
        // CẬP NHẬT: Nếu phòng trống thì xóa map cũ đi
        if (Object.keys(players).length === 0) {
            currentGameState = null; 
        }
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});