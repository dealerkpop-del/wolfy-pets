const socket = io();

let collectedPets = [];
let selectedTeam = [];
let tutorialPet = null;
let tutorialEnemy = null;

socket.on('connect', () => {
  document.getElementById('status').textContent = '¡Conectado!';
  setTimeout(() => {
    document.getElementById('tutorial-phase').style.display = 'block';
    setupTutorial();
  }, 1000);
});

function setupTutorial() {
  tutorialPet = { id: 'gray', name: 'Tu Tanque', hp: 7, maxHp: 7, atk: 3, color: 'gray' };
  tutorialEnemy = { id: 'blue', name: 'Dummy Azul', hp: 3, maxHp: 3, atk: 3, color: 'blue' };
  
  document.getElementById('tutorial-player').appendChild(createPetElement(tutorialPet));
  document.getElementById('tutorial-enemy').appendChild(createPetElement(tutorialEnemy));
}

document.getElementById('start-tutorial').onclick = () => {
  document.getElementById('start-tutorial').disabled = true;
  runTutorialBattle();
};

function runTutorialBattle() {
  const log = document.getElementById('tutorial-log');
  let turn = 1;
  
  const interval = setInterval(() => {
    log.innerHTML += `<div><strong>--- Turno ${turn} ---</strong></div>`;
    
    if (tutorialPet.hp > 0 && tutorialEnemy.hp > 0) {
      tutorialEnemy.hp -= tutorialPet.atk;
      log.innerHTML += `<div>${tutorialPet.name} ataca a ${tutorialEnemy.name} por ${tutorialPet.atk} daño</div>`;
      log.innerHTML += `<div>${tutorialEnemy.name} HP: ${Math.max(0, tutorialEnemy.hp)}/${tutorialEnemy.maxHp}</div>`;
    }
    
    if (tutorialPet.hp > 0 && tutorialEnemy.hp > 0) {
      tutorialPet.hp -= tutorialEnemy.atk;
      log.innerHTML += `<div>${tutorialEnemy.name} ataca a ${tutorialPet.name} por ${tutorialEnemy.atk} daño</div>`;
      log.innerHTML += `<div>${tutorialPet.name} HP: ${Math.max(0, tutorialPet.hp)}/${tutorialPet.maxHp}</div>`;
    }
    
    if (tutorialEnemy.hp <= 0) {
      clearInterval(interval);
      log.innerHTML += `<div><strong>¡Victoria! Dummy azul derrotado</strong></div>`;
      socket.emit('tutorial-complete', true);
    } else if (tutorialPet.hp <= 0) {
      clearInterval(interval);
      log.innerHTML += `<div><strong>Derrota...</strong></div>`;
      socket.emit('tutorial-complete', false);
    }
    
    turn++;
    log.scrollTop = log.scrollHeight;
  }, 1500);
}

socket.on('show-reward', (data) => {
  document.getElementById('tutorial-phase').style.display = 'none';
  document.getElementById('reward-phase').style.display = 'block';
  
  const options = document.getElementById('reward-options');
  options.innerHTML = '';
  
  data.availablePets.forEach(pet => {
    const petDiv = createPetElement(pet);
    petDiv.classList.add('reward-pet');
    petDiv.onclick = () => socket.emit('select-reward', pet.id);
    options.appendChild(petDiv);
  });
});

socket.on('reward-selected', (data) => {
  document.getElementById('reward-phase').style.display = 'none';
  document.getElementById('selection-phase').style.display = 'block';
  
  collectedPets = data.collectedPets;
  displayCollectedPets();
});

function displayCollectedPets() {
  const pool = document.getElementById('collected-pets');
  pool.innerHTML = '';
  
  collectedPets.forEach((pet, index) => {
    const petDiv = createPetElement(pet);
    petDiv.onclick = () => togglePetSelection(pet, index, petDiv);
    pool.appendChild(petDiv);
  });
}

function togglePetSelection(pet, index, element) {
  const teamIndex = selectedTeam.findIndex(p => p.index === index);
  
  if (teamIndex > -1) {
    selectedTeam.splice(teamIndex, 1);
    element.classList.remove('selected');
  } else if (selectedTeam.length < 3) {
    selectedTeam.push({ ...pet, index });
    element.classList.add('selected');
  }
  
  updateSelectedTeamDisplay();
  document.getElementById('confirm-team').disabled = selectedTeam.length !== 0;
}

function updateSelectedTeamDisplay() {
  const display = document.getElementById('selected-team');
  display.innerHTML = '';
  selectedTeam.forEach(pet => display.appendChild(createPetElement(pet)));
}

document.getElementById('confirm-team').onclick = () => {
  const team = selectedTeam.map(p => ({
    id: p.id, name: p.name, hp: p.hp, atk: p.atk, color: p.color
  }));
  
  socket.emit('select-team', team);
  document.getElementById('selection-phase').style.display = 'none';
  document.getElementById('matchmaking-phase').style.display = 'block';
};

socket.on('waiting-for-match', () => {
  document.getElementById('status').textContent = 'Esperando otro jugador...';
});

socket.on('match-found', (data) => {
  document.getElementById('matchmaking-phase').style.display = 'none';
  document.getElementById('battle-phase').style.display = 'block';
  document.getElementById('status').textContent = '¡Batalla en progreso!';
  
  displayBattleTeams(data);
  runBattle(data);
});

function displayBattleTeams(data) {
  const yourTeamDiv = document.getElementById('your-team');
  const opponentTeamDiv = document.getElementById('opponent-team');
  
  yourTeamDiv.innerHTML = '<h3>Tu equipo</h3>';
  opponentTeamDiv.innerHTML = '<h3>Oponente</h3>';
  
  selectedTeam.forEach(pet => yourTeamDiv.appendChild(createPetElement(pet)));
  data.opponentTeam.forEach(pet => opponentTeamDiv.appendChild(createPetElement(pet)));
}

function runBattle(data) {
  const log = document.getElementById('battle-log');
  let turn = 1;
  
  const yourTeam = selectedTeam.map(p => ({ ...p, maxHp: p.hp }));
  const enemyTeam = data.opponentTeam.map(p => ({ ...p, maxHp: p.hp }));
  
  const interval = setInterval(() => {
    log.innerHTML += `<div><strong>--- Turno ${turn} ---</strong></div>`;
    
    yourTeam.forEach(pet => {
      if (pet.hp > 0 && enemyTeam.some(e => e.hp > 0)) {
        const target = enemyTeam.find(e => e.hp > 0);
        target.hp -= pet.atk;
        log.innerHTML += `<div>${pet.name} ataca a ${target.name} por ${pet.atk} daño</div>`;
      }
    });
    
    enemyTeam.forEach(pet => {
      if (pet.hp > 0 && yourTeam.some(e => e.hp > 0)) {
        const target = yourTeam.find(e => e.hp > 0);
        target.hp -= pet.atk;
        log.innerHTML += `<div>${pet.name} ataca a ${target.name} por ${pet.atk} daño</div>`;
      }
    });
    
    const yourAlive = yourTeam.filter(p => p.hp > 0).length;
    const enemyAlive = enemyTeam.filter(p => p.hp > 0).length;
    
    if (yourAlive === 0 || enemyAlive === 0) {
      clearInterval(interval);
      log.innerHTML += yourAlive > 0 
        ? `<div><strong>¡Victoria!</strong></div>` 
        : `<div><strong>Derrota...</strong></div>`;
    }
    
    turn++;
    log.scrollTop = log.scrollHeight;
  }, 1500);
}

function createPetElement(pet) {
  const div = document.createElement('div');
  div.className = `pet pet-${pet.color}`;
  div.innerHTML = `
    <div class="pet-body"></div>
    <div class="pet-name">${pet.name}</div>
    <div class="pet-stats">
      <span class="hp">❤️${pet.hp}</span> / 
      <span class="atk">⚔️${pet.atk}</span>
    </div>
  `;
  return div;
}

socket.on('tutorial-failed', () => {
  alert('¡Perdiste el tutorial! Recargando...');
  location.reload();
});
