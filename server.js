const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayers = [];
let games = new Map();
let playerData = new Map();

const ALL_PETS = [
  { id: 'gray', name: 'Tanque Gris', hp: 7, atk: 3, color: 'gray' },
  { id: 'blue', name: 'Bufador Azul', hp: 3, atk: 3, color: 'blue', onDeath: 'buff_0_1' },
  { id: 'green', name: 'Dormilón Verde', hp: 12, atk: 2, color: 'green', onTurn: 'buff_1_0' }
];

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);
  
  playerData.set(socket.id, {
    collectedPets: [{ ...ALL_PETS[0] }],
    currentTeam: [],
    phase: 'tutorial'
  });

  socket.on('tutorial-complete', (won) => {
    const data = playerData.get(socket.id);
    if (won) {
      data.phase = 'reward';
      socket.emit('show-reward', { availablePets: ALL_PETS });
    } else {
      socket.emit('tutorial-failed');
    }
  });

  socket.on('select-reward', (petId) => {
    const data = playerData.get(socket.id);
    const pet = ALL_PETS.find(p => p.id === petId);
    if (pet) {
      data.collectedPets.push({ ...pet });
      data.phase = 'selection';
      socket.emit('reward-selected', { collectedPets: data.collectedPets });
    }
  });

  socket.on('select-team', (team) => {
    const data = playerData.get(socket.id);
    data.currentTeam = team;
    data.phase = 'matchmaking';
    
    if (waitingPlayers.length > 0) {
      const opponent = waitingPlayers.shift();
      const opponentData = playerData.get(opponent.id);
      const gameId = `game-${Date.now()}`;
      
      games.set(gameId, {
        id: gameId,
        player1: socket.id,
        player2: opponent.id,
        teams: {
          [socket.id]: team,
          [opponent.id]: opponentData.currentTeam
        }
      });

      socket.join(gameId);
      opponent.join(gameId);

      io.to(socket.id).emit('match-found', { 
        gameId, 
        isPlayer1: true,
        opponentTeam: opponentData.currentTeam
      });
      
      io.to(opponent.id).emit('match-found', { 
        gameId, 
        isPlayer1: false,
        opponentTeam: team
      });
      
      console.log(`Partida creada: ${gameId}`);
    } else {
      waitingPlayers.push(socket);
      socket.emit('waiting-for-match');
    }
  });

  // --- NUEVO: Sistema de Clonación ---
  socket.on('battle-won', (opponentTeam) => {
    socket.emit('show-clone-options', { opponentTeam });
  });

  socket.on('select-clone', (petToClone) => {
    const data = playerData.get(socket.id);
    const clonedPet = { ...petToClone, id: petToClone.id + '_clone_' + Date.now() }; 
    data.collectedPets.push(clonedPet);
    data.phase = 'selection';
    socket.emit('clone-success', { collectedPets: data.collectedPets });
  });
  // -----------------------------------

  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
    playerData.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
