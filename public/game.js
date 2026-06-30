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
  
  document.getElementById('tutorial-player').appendChild(createPetElement(tutorialPet, 't-player'));
  document.getElementById('tutorial-enemy').appendChild(createPetElement(tutorialEnemy, 't-enemy'));
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
      updatePetHP('t-enemy', tutorialEnemy.hp);
      log.innerHTML += `<div>${tutorialPet.name} ataca a ${tutorialEnemy.name} por ${tutorialPet.atk} daño</div>`;
    }
    
    if (tutorialPet.hp > 0 && tutorialEnemy.hp > 0) {
      tutorialPet.hp -= tutorialEnemy.atk;
      updatePetHP('t-player', tutorialPet.hp);
      log.innerHTML += `<div>${tutorialEnemy.name} ataca a ${tutorialPet.name} por ${tutorialEnemy.atk} daño</div>`;
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
  }, 2000); // Más lento (2 segundos por turno)
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
  // Permitir buscar rival con al menos 1 pet
  document.getElementById('confirm-team').disabled = selectedTeam.length === 0; 
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
  
  selectedTeam.forEach((pet, i) => yourTeamDiv.appendChild(createPetElement(pet, `your-${i}`)));
  data.opponentTeam.forEach((pet, i) => opponentTeamDiv.appendChild(createPetElement(pet, `enemy-${i}`)));
}

function runBattle(data) {
  const log = document.getElementById('battle-log');
  let turn = 1;
  
  const yourTeam = selectedTeam.map(p => ({ ...p, maxHp: p.hp }));
  const enemyTeam = data.opponentTeam.map(p => ({ ...p, maxHp: p.hp }));
  
  const interval = setInterval(() => {
    log.innerHTML += `<div><strong>--- Turno ${turn} ---</strong></div>`;
    
    yourTeam.forEach((pet, i) => {
      if (pet.hp > 0 && enemyTeam.some(e => e.hp > 0)) {
        const target = enemyTeam.find(e => e.hp > 0);
        const targetIndex = enemyTeam.indexOf(target);
        
        target.hp -= pet.atk;
        if(target.hp < 0) target.hp = 0;
        
        updatePetHP(`enemy-${targetIndex}`, target.hp);
        log.innerHTML += `<div>${pet.name} ataca a ${target.name} por ${pet.atk} daño</div>`;
      }
    });
    
    enemyTeam.forEach((pet, i) => {
      if (pet.hp > 0 && yourTeam.some(e => e.hp > 0)) {
        const target = yourTeam.find(e => e.hp > 0);
        const targetIndex = yourTeam.indexOf(target);
        
        target.hp -= pet.atk;
        if(target.hp < 0) target.hp = 0;
        
        updatePetHP(`your-${targetIndex}`, target.hp);
        log.innerHTML += `<div>${pet.name} ataca a ${target.name} por ${pet.atk} daño</div>`;
      }
    });
    
    const yourAlive = yourTeam.filter(p => p.hp > 0).length;
    const enemyAlive = enemyTeam.filter(p => p.hp > 0).length;
    
    if (yourAlive === 0 || enemyAlive === 0) {
      clearInterval(interval);
      if (yourAlive > 0) {
        log.innerHTML += `<div><strong>¡Victoria!</strong></div>`;
        socket.emit('battle-won', data.opponentTeam); 
   } else {
        log.innerHTML += `<div><strong>Derrota... Volviendo al menú en 3s.</strong></div>`;
        setTimeout(() => {
          // Ocultar batalla
          document.getElementById('battle-phase').style.display = 'none';
          // Mostrar selección
          document.getElementById('selection-phase').style.display = 'block';
          // Actualizar status
          document.getElementById('status').textContent = '¡Conectado! Arma tu equipo';
          // Resetear equipo seleccionado
          selectedTeam = [];
          document.getElementById('selected-team').innerHTML = '';
          document.getElementById('confirm-team').disabled = true;
          // Mostrar pets coleccionados
          displayCollectedPets();
        }, 3000);
      }
    
    turn++;
    log.scrollTop = log.scrollHeight;
  }, 2500); // Batalla más lenta (2.5 segundos por turno)
}

// Función para animar el cambio de HP en el DOM
function updatePetHP(elementId, newHp) {
  const el = document.getElementById(`pet-${elementId}`);
  if (el) {
    const hpSpan = el.querySelector('.hp');
    if (hpSpan) {
      hpSpan.textContent = `❤️${newHp}`;
      // Efecto visual de daño
      el.style.transform = 'scale(0.95)';
      setTimeout(() => el.style.transform = 'scale(1)', 150);
    }
  }
}

// --- NUEVO: Eventos de Clonación ---
socket.on('show-clone-options', (data) => {
  document.getElementById('battle-phase').style.display = 'none';
  document.getElementById('clone-phase').style.display = 'block';
  
  const options = document.getElementById('clone-options');
  options.innerHTML = '';
  
  data.opponentTeam.forEach(pet => {
    const petDiv = createPetElement(pet);
    petDiv.classList.add('reward-pet');
    petDiv.onclick = () => socket.emit('select-clone', pet);
    options.appendChild(petDiv);
  });
});

socket.on('clone-success', (data) => {
  document.getElementById('clone-phase').style.display = 'none';
  document.getElementById('selection-phase').style.display = 'block';
  
  collectedPets = data.collectedPets;
  displayCollectedPets();
});
// -----------------------------------

function createPetElement(pet, idSuffix = '') {
  const div = document.createElement('div');
  div.className = `pet pet-${pet.color}`;
  if (idSuffix) div.id = `pet-${idSuffix}`;
  
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
