// ===== GRANNY: DARK HOUSE - ENGINE =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = 'menu';
let currentDay = 1;
const MAX_DAYS = 5;
let gameOver = false;
let escaped = false;

// ===== INPUT =====
const input = {
    joy: { x: 0, y: 0, active: false },
    interact: false,
    run: false,
    keys: {}
};

// ===== GIOCO =====
const player = {
    x: 400, y: 500, radius: 12,
    speed: 2, runSpeed: 4,
    angle: 0, stamina: 100,
    item: null, hidden: false,
    noise: 0
};

const granny = {
    x: 200, y: 200, radius: 15,
    speed: 1.8, chaseSpeed: 3.2,
    angle: 0, state: 'patrol', // patrol, investigate, chase
    targetX: 200, targetY: 200,
    hearingRange: 150, sightRange: 200,
    lastKnownX: 0, lastKnownY: 0,
    pathTimer: 0
};

const ball = null; // Non serve in Granny

let house = [];
let doors = [];
let items = [];
let hidingSpots = [];
let particles = [];

// ===== CAMERA =====
const camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    shake: 0
};

// ===== LUCI =====
let darkness = 0.85;
let flashlightOn = true;

// ===== INIT =====
function init() {
    setupControls();
    generateHouse();
    spawnItems();
    setupAI();
    
    document.getElementById('playBtn').onclick = startGame;
    gameLoop();
}

function startGame() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    gameState = 'playing';
    updateDayText();
}

// ===== GENERAZIONE CASA =====
function generateHouse() {
    // Muri esterni
    house = [
        {x: 50, y: 50, w: 700, h: 20}, // Top
        {x: 50, y: 550, w: 700, h: 20}, // Bottom
        {x: 50, y: 50, w: 20, h: 520}, // Left
        {x: 730, y: 50, w: 20, h: 520}, // Right
        
        // Stanze interne
        {x: 50, y: 200, w: 300, h: 20}, // Divisorio 1
        {x: 450, y: 200, w: 300, h: 20}, // Divisorio 2
        {x: 350, y: 70, w: 20, h: 130}, // Muro verticale
        {x: 350, y: 350, w: 20, h: 200}, // Muro verticale 2
    ];
    
    // Porte
    doors = [
        {x: 370, y: 70, w: 40, h: 20, open: false, locked: false, key: null, id: 'door1'},
        {x: 370, y: 350, w: 40, h: 20, open: false, locked: true, key: 'red', id: 'door2'},
        {x: 50, y: 280, w: 20, h: 40, open: false, locked: false, key: null, id: 'exit'},
    ];
    
    // Nascondigli
    hidingSpots = [
        {x: 100, y: 100, w: 40, h: 60, type: 'wardrobe'},
        {x: 600, y: 400, w: 80, h: 40, type: 'bed'},
        {x: 500, y: 100, w: 40, h: 60, type: 'wardrobe'},
    ];
}

function spawnItems() {
    items = [
        {x: 150, y: 120, type: 'hammer', name: 'Martello', taken: false},
        {x: 650, y: 450, type: 'key_red', name: 'Chiave Rossa', taken: false},
        {x: 400, y: 150, type: 'key_blue', name: 'Chiave Blu', taken: false},
        {x: 200, y: 450, type: 'plank', name: 'Asse', taken: false},
    ];
}

// ===== AI GRANNY =====
function setupAI() {
    setInterval(() => {
        if (gameState!== 'playing' || granny.state === 'chase') return;
        
        // Pattuglia casuale
        granny.targetX = 100 + Math.random() * 600;
        granny.targetY = 100 + Math.random() * 400;
        granny.pathTimer = 0;
    }, 5000);
}

function updateGranny() {
    if (gameState!== 'playing') return;
    
    let dx = player.x - granny.x;
    let dy = player.y - granny.y;
    let distToPlayer = Math.sqrt(dx*dx + dy*dy);
    
    // Sistema udito
    if (player.noise > 0 && distToPlayer < granny.hearingRange && !player.hidden) {
        granny.state = 'investigate';
        granny.lastKnownX = player.x + (Math.random()-0.5)*50;
        granny.lastKnownY = player.y + (Math.random()-0.5)*50;
    }
    
    // Sistema vista
    if (distToPlayer < granny.sightRange && !player.hidden && canSee(granny, player)) {
        granny.state = 'chase';
        granny.lastKnownX = player.x;
        granny.lastKnownY = player.y;
        camera.shake = 10; // Heartbeat
    }
    
    // Movimento
    let speed = granny.state === 'chase'? granny.chaseSpeed : granny.speed;
    
    if (granny.state === 'chase' || granny.state === 'investigate') {
        let tdx = granny.lastKnownX - granny.x;
        let tdy = granny.lastKnownY - granny.y;
        let tdist = Math.sqrt(tdx*tdx + tdy*tdy);
        
        if (tdist > 5) {
            granny.x += (tdx/tdist) * speed;
            granny.y += (tdy/tdist) * speed;
            granny.angle = Math.atan2(tdy, tdx);
        } else if (granny.state === 'investigate') {
            granny.state = 'patrol';
        }
    } else {
        // Patrol
        let tdx = granny.targetX - granny.x;
        let tdy = granny.targetY - granny.y;
        let tdist = Math.sqrt(tdx*tdx + tdy*tdy);
        
        if (tdist > 5) {
            granny.x += (tdx/tdist) * speed;
            granny.y += (tdy/tdist) * speed;
            granny.angle = Math.atan2(tdy, tdx);
        }
    }
    
    // Collisione con player = morte
    if (distToPlayer < granny.radius + player.radius && !player.hidden) {
        playerDie();
    }
    
    // Apri porte se inseguo
    doors.forEach(door => {
        if (!door.open && !door.locked) {
            let ddx = door.x + door.w/2 - granny.x;
            let ddy = door.y + door.h/2 - granny.y;
            if (Math.sqrt(ddx*ddx + ddy*ddy) < 30 && granny.state === 'chase') {
                door.open = true;
                addNoise(door.x, door.y, 60);
            }
        }
    });
}

function canSee(from, to) {
    // Line of sight semplice
    let blocked = false;
    house.forEach(wall => {
        if (lineRectCollide(from.x, from.y, to.x, to.y, wall)) blocked = true;
    });
    doors.forEach(door => {
        if (!door.open && lineRectCollide(from.x, from.y, to.x, to.y, door)) blocked = true;
    });
    return!blocked;
}

function lineRectCollide(x1, y1, x2, y2, rect) {
    // Semplificato
    return (x1 < rect.x + rect.w && x2 > rect.x && y1 < rect.y + rect.h && y2 > rect.y);
}

// ===== PLAYER =====
function updatePlayer() {
    if (gameState!== 'playing' || player.hidden) return;
    
    let speed = input.run && player.stamina > 0? player.runSpeed : player.speed;
    let vx = input.joy.x * speed;
    let vy = input.joy.y * speed;
    
    // Movimento
    let newX = player.x + vx;
    let newY = player.y + vy;
    
    // Collisione muri
    if (!collideWithWalls(newX, player.y)) player.x = newX;
    if (!collideWithWalls(player.x, newY)) player.y = newY;
    
    if (vx!== 0 || vy!== 0) {
        player.angle = Math.atan2(vy, vx);
        // Rumore
        player.noise = input.run? 80 : 15;
        if (input.run) player.stamina -= 0.8;
    } else {
        player.noise = 0;
    }
    
    if (player.stamina < 100) player.stamina += 0.3;
    player.stamina = Math.max(0, Math.min(100, player.stamina));
    
    // Decay rumore
    player.noise *= 0.9;
    
    // Interazione
    if (input.interact) {
        interact();
        input.interact = false;
    }
}

function collideWithWalls(x, y) {
    let collided = false;
    house.forEach(wall => {
        if (x > wall.x - player.radius && x < wall.x + wall.w + player.radius &&
            y > wall.y - player.radius && y < wall.y + wall.h + player.radius) {
            collided = true;
        }
    });
    doors.forEach(door => {
        if (!door.open && x > door.x - player.radius && x < door.x + door.w + player.radius &&
            y > door.y - player.radius && y < door.y + door.h + player.radius) {
            collided = true;
        }
    });
    return collided;
}

function interact() {
    // Nascondigli
    for (let spot of hidingSpots) {
        if (player.x > spot.x && player.x < spot.x + spot.w &&
            player.y > spot.y && player.y < spot.y + spot.h) {
            player.hidden =!player.hidden;
            addNoise(player.x, player.y, 30);
            return;
        }
    }
    
    // Oggetti
    for (let item of items) {
        if (!item.taken) {
            let dx = item.x - player.x;
            let dy = item.y - player.y;
            if (Math.sqrt(dx*dx + dy*dy) < 30) {
                if (player.item) {
                    // Droppa item corrente
                    items.push({x: player.x+20, y: player.y, type: player.item, name: player.item, taken: false});
                }
                player.item = item.type;
                item.taken = true;
                updateItemSlot();
                return;
            }
        }
    }
    
    // Porte
    for (let door of doors) {
        let dx = door.x + door.w/2 - player.x;
        let dy = door.y + door.h/2 - player.y;
        if (Math.sqrt(dx*dx + dy*dy) < 40) {
            if (door.locked && player.item === 'key_' + door.key) {
                door.locked = false;
                player.item = null;
                updateItemSlot();
            }
            if (!door.locked) {
                door.open =!door.open;
                addNoise(door.x, door.y, 50);
            }
            return;
        }
    }
}

// ===== RUMORE =====
function addNoise(x, y, amount) {
    particles.push({
        x: x, y: y, radius: 0, maxRadius: amount,
        alpha: 1, type: 'noise'
    });
}

// ===== MORTE & VITTORIA =====
function playerDie() {
    if (gameOver) return;
    gameState = 'dead';
    camera.shake = 30;
    
    setTimeout(() => {
        currentDay++;
        if (currentDay > MAX_DAYS) {
            gameOver = true;
            showGameOver();
        } else {
            respawn();
        }
    }, 2000);
}

function respawn() {
    player.x = 400; player.y = 500;
    player.item = null; player.hidden = false;
    granny.x = 200; granny.y = 200; granny.state = 'patrol';
    items.forEach(i => i.taken = false);
    doors.forEach(d => { if (d.id!== 'exit') d.open = false; });
    gameState = 'playing';
    updateDayText();
    updateItemSlot();
}

function showGameOver() {
    alert('GAME OVER\nGranny ti ha preso al giorno ' + (currentDay-1));
    location.reload();
}

function updateDayText() {
    document.getElementById('dayText').textContent = `GIORNO ${currentDay}/${MAX_DAYS}`;
}

function updateItemSlot() {
    const slot = document.getElementById('itemSlot');
    slot.innerHTML = player.item? `<div style="color:#fff;font-size:10px;text-align:center;padding-top:20px;">${player.item}</div>` : '';
}

// ===== CONTROLLI =====
function setupControls() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joyKnob');
    let startX, startY;
    
    const start = (e) => {
        input.joy.active = true;
        const t = e.touches? e.touches[0] : e;
        const rect = joy.getBoundingClientRect();
        startX = rect.left + rect.width/2;
        startY = rect.top + rect.height/2;
    };
    
    const move = (e) => {
        if (!input.joy.active) return;
        const t = e.touches? e.touches[0] : e;
        let dx = t.clientX - startX;
        let dy = t.clientY - startY;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let max = 50;
        
        if (dist > max) {
            dx = dx/dist * max;
            dy = dy/dist * max;
        }
        
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.joy.x = dx/max;
        input.joy.y = dy/max;
    };
    
    const end = () => {
        input.joy.active = false;
        input.joy.x = 0; input.joy.y = 0;
        knob.style.transform = 'translate(0,0)';
    };
    
    joy.addEventListener('touchstart', start);
    joy.addEventListener('touchmove', move);
    joy.addEventListener('touchend', end);
    joy.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    
    document.getElementById('interactBtn').addEventListener('touchstart', (e) => {
        e.preventDefault(); input.interact = true;
    });
    document.getElementById('runBtn').addEventListener('touchstart', (e) => {
        e.preventDefault(); input.run = true;
    });
    document.getElementById('runBtn').addEventListener('touchend', () => {
        input.run = false;
    });
    
    // Tastiera
    window.addEventListener('keydown', e => input.keys[e.key] = true);
    window.addEventListener('keyup', e => input.keys[e.key] = false);
}

// ===== RENDER =====
function render() {
    // Camera follow
    camera.targetX = player.x - canvas.width/2;
    camera.targetY = player.y - canvas.height/2;
    camera.x += (camera.targetX - camera.x) * 0.1;
    camera.y += (camera.targetY - camera.y) * 0.1;
    
    if (camera.shake > 0) {
        camera.x += (Math.random()-0.5) * camera.shake;
        camera.y += (Math.random()-0.5) * camera.shake;
        camera.shake *= 0.9;
    }
    
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Sfondo
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
    
    // Pavimento legno
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 800; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 600);
        ctx.stroke();
    }
    
    // Muri
    ctx.fillStyle = '#3a3a3a';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;
    house.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    });
    ctx.shadowBlur = 0;
    
    // Porte
    doors.forEach(door => {
        if (!door.open) {
            ctx.fillStyle = door.locked? '#5a2a2a' : '#4a3a2a';
            ctx.fillRect(door.x, door.y, door.w, door.h);
            if (door.locked) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(door.x + door.w/2, door.y + door.h/2, 3, 0, Math.PI*2);
                ctx.fill();
            }
        }
    });
    
    // Nascondigli
    hidingSpots.forEach(spot => {
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
    });
    
    // Oggetti
    items.forEach(item => {
        if (!item.taken) {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    });
    
    // Granny
    drawCharacter(granny.x, granny.y, granny.angle, '#4a4a4a', granny.radius, granny.state === 'chase');
    
    // Player
    if (!player.hidden) {
        drawCharacter(player.x, player.y, player.angle, '#4169e1', player.radius, false);
    }
    
    // Particelle rumore
    particles = particles.filter(p => {
        p.radius += 2;
        p.alpha -= 0.02;
        if (p.type === 'noise') {
            ctx.strokeStyle = `rgba(255,0,0,${p.alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            ctx.stroke();
        }
        return p.alpha > 0;
    });
    
    // Oscurità + Luce
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(0,0,0,${darkness})`;
    ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
    
    ctx.globalCompositeOperation = 'lighter';
    let gradient = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 150);
    gradient.addColorStop(0, 'rgba(255,255,200,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(player.x-150, player.y-150, 300, 300);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    // Vignetta
    let vignette = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/1.5);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Jumpscare Granny se ti prende
    if (gameState === 'dead') {
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SEI MORTO', canvas.width/2, canvas.height/2);
    }
}

function drawCharacter(x, y, angle, color, radius, angry) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Corpo
    let gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#000');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI*2);
    ctx.fill();
    
    // Occhi
    ctx.fillStyle = angry? '#ff0000' : '#fff';
    ctx.beginPath();
    ctx.arc(-4, -3, 2, 0, Math.PI*2);
    ctx.arc(4, -3, 2, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
}

// ===== GAME LOOP =====
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        updatePlayer();
        updateGranny();
    }
    
    render();
    requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// START
init();
