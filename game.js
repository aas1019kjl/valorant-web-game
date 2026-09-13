// ============================================
// VALORANT Web Game - Game Logic
// ============================================

// Game Configuration
const CONFIG = {
    MAP_SIZE: 200,
    PLAYER_SPEED: 0.3,
    MOUSE_SENSITIVITY: 0.002,
    MAX_HEALTH: 100,
    MAX_AMMO: 90,
    MAGAZINE_SIZE: 30,
};

// Game State
let gameState = {
    players: [],
    bots: [],
    projectiles: [],
    effects: [],
    round: 1,
    time: 0,
};

// Initialize Three.js
const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0e27);
renderer.shadowMap.enabled = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// ============================================
// Player Class
// ============================================
class Player {
    constructor(x, y, z, isBot = false) {
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.isBot = isBot;
        this.id = Math.random();
        
        // Stats
        this.health = CONFIG.MAX_HEALTH;
        this.shield = 0;
        this.ammo = CONFIG.MAGAZINE_SIZE;
        this.totalAmmo = CONFIG.MAX_AMMO;
        this.ultimate = 0;
        this.maxUltimate = 100;
        
        // Abilities
        this.abilities = {
            Q: { name: 'Smoke', cooldown: 0, maxCooldown: 12, ready: true },
            E: { name: 'Heal', cooldown: 0, maxCooldown: 20, ready: true },
            R: { name: 'Stun', cooldown: 0, maxCooldown: 30, ready: true },
            F: { name: 'Ultimate', cooldown: 0, maxCooldown: 0, ready: false },
        };
        
        this.smokeActive = false;
        this.healActive = false;
        this.isStunned = false;
        this.stunDuration = 0;
        
        // 3D Model
        const geometry = new THREE.BoxGeometry(0.6, 2, 0.6);
        const material = new THREE.MeshPhongMaterial({ color: isBot ? 0xff4444 : 0x44ff44 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        
        // Head indicator
        const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: isBot ? 0xff6666 : 0x66ff66 });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 0.8;
        this.mesh.add(this.head);
        
        this.lastShootTime = 0;
        this.shootCooldown = 100; // milliseconds
    }
    
    update(deltaTime, keys) {
        if (this.isBot) {
            this.updateBot(deltaTime);
        } else {
            this.updatePlayer(deltaTime, keys);
        }
        
        // Update position
        this.position.add(this.velocity);
        this.mesh.position.copy(this.position);
        
        // Apply gravity
        if (this.position.y > 1) {
            this.velocity.y -= 0.02;
        } else {
            this.position.y = 1;
            this.velocity.y = 0;
        }
        
        // Boundary check
        const halfMap = CONFIG.MAP_SIZE / 2;
        this.position.x = Math.max(-halfMap, Math.min(halfMap, this.position.x));
        this.position.z = Math.max(-halfMap, Math.min(halfMap, this.position.z));
        
        // Update abilities
        for (let key in this.abilities) {
            if (this.abilities[key].cooldown > 0) {
                this.abilities[key].cooldown -= deltaTime;
                this.abilities[key].ready = false;
            } else {
                this.abilities[key].ready = true;
            }
        }
        
        // Update stun
        if (this.isStunned) {
            this.stunDuration -= deltaTime;
            if (this.stunDuration <= 0) {
                this.isStunned = false;
            }
        }
        
        // Update heal
        if (this.healActive) {
            this.health = Math.min(CONFIG.MAX_HEALTH, this.health + 0.5);
        }
        
        // Update ultimate
        this.ultimate = Math.min(this.maxUltimate, this.ultimate + 0.3);
        this.abilities.F.ready = this.ultimate >= this.maxUltimate;
    }
    
    updatePlayer(deltaTime, keys) {
        if (this.isStunned) return;
        
        const moveSpeed = CONFIG.PLAYER_SPEED;
        const forward = new THREE.Vector3(
            Math.sin(this.rotation.y),
            0,
            Math.cos(this.rotation.y)
        );
        const right = new THREE.Vector3(
            Math.cos(this.rotation.y),
            0,
            -Math.sin(this.rotation.y)
        );
        
        if (keys['w']) this.velocity.add(forward.multiplyScalar(moveSpeed));
        if (keys['s']) this.velocity.add(forward.multiplyScalar(-moveSpeed));
        if (keys['a']) this.velocity.add(right.multiplyScalar(-moveSpeed));
        if (keys['d']) this.velocity.add(right.multiplyScalar(moveSpeed));
        
        // Apply friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
    }
    
    updateBot(deltaTime) {
        if (this.isStunned) return;
        
        // Simple bot AI: chase player and shoot
        const player = gameState.players[0];
        if (!player) return;
        
        const direction = player.position.clone().sub(this.position);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            direction.y = 0;
            this.rotation.y = Math.atan2(direction.x, direction.z);
        }
        
        // Move toward player
        const moveSpeed = CONFIG.PLAYER_SPEED * 0.8;
        const forward = new THREE.Vector3(
            Math.sin(this.rotation.y),
            0,
            Math.cos(this.rotation.y)
        );
        
        if (distance > 5) {
            this.velocity.copy(forward.multiplyScalar(moveSpeed));
        } else {
            this.velocity.multiplyScalar(0.5);
        }
        
        // Bot shoot
        if (distance < 50 && Math.random() > 0.95) {
            this.shoot();
        }
        
        // Bot abilities
        if (Math.random() > 0.98 && this.abilities.Q.ready) {
            this.useAbility('Q');
        }
        if (Math.random() > 0.99 && this.abilities.F.ready) {
            this.useAbility('F');
        }
    }
    
    shoot() {
        const now = Date.now();
        if (now - this.lastShootTime < this.shootCooldown) return;
        if (this.ammo <= 0) return;
        
        this.lastShootTime = now;
        this.ammo--;
        
        const direction = new THREE.Vector3(
            Math.sin(this.rotation.y) + (Math.random() - 0.5) * 0.1,
            Math.cos(this.rotation.x) + (Math.random() - 0.5) * 0.1,
            Math.cos(this.rotation.y) + (Math.random() - 0.5) * 0.1
        ).normalize();
        
        const projectile = new Projectile(
            this.position.clone(),
            direction,
            this.id
        );
        gameState.projectiles.push(projectile);
        
        if (this.ultimate < this.maxUltimate) {
            this.ultimate += 5;
        }
    }
    
    useAbility(key) {
        const ability = this.abilities[key];
        if (!ability.ready) return;
        
        ability.cooldown = ability.maxCooldown;
        ability.ready = false;
        
        switch (key) {
            case 'Q': // Smoke
                this.createSmoke();
                break;
            case 'E': // Heal
                this.healActive = true;
                setTimeout(() => { this.healActive = false; }, 5000);
                break;
            case 'R': // Stun
                this.createStun();
                break;
            case 'F': // Ultimate
                if (this.ultimate >= this.maxUltimate) {
                    this.launchUltimate();
                    this.ultimate = 0;
                }
                break;
        }
    }
    
    createSmoke() {
        const smokePos = this.position.clone().add(
            new THREE.Vector3(
                Math.sin(this.rotation.y) * 5,
                0,
                Math.cos(this.rotation.y) * 5
            )
        );
        
        const smoke = new Effect('smoke', smokePos, 8000);
        gameState.effects.push(smoke);
    }
    
    createStun() {
        // Stun all bots nearby
        gameState.bots.forEach(bot => {
            const distance = bot.position.distanceTo(this.position);
            if (distance < 20) {
                bot.isStunned = true;
                bot.stunDuration = 2;
            }
        });
    }
    
    launchUltimate() {
        // Launch 10 projectiles in all directions
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const direction = new THREE.Vector3(
                Math.cos(angle),
                0,
                Math.sin(angle)
            ).normalize();
            
            const projectile = new Projectile(
                this.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                direction,
                this.id,
                true // ultimate projectile (higher damage)
            );
            gameState.projectiles.push(projectile);
        }
    }
    
    takeDamage(amount) {
        const damageToShield = Math.min(this.shield, amount);
        this.shield -= damageToShield;
        const damageToHealth = amount - damageToShield;
        this.health -= damageToHealth;
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.health = 0;
        scene.remove(this.mesh);
        
        // Respawn after 3 seconds
        setTimeout(() => {
            this.respawn();
        }, 3000);
    }
    
    respawn() {
        this.health = CONFIG.MAX_HEALTH;
        this.shield = 0;
        this.ammo = CONFIG.MAGAZINE_SIZE;
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * 50,
            1,
            (Math.random() - 0.5) * 50
        );
        this.velocity.set(0, 0, 0);
        
        const geometry = new THREE.BoxGeometry(0.6, 2, 0.6);
        const material = new THREE.MeshPhongMaterial({ color: this.isBot ? 0xff4444 : 0x44ff44 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
        
        const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: this.isBot ? 0xff6666 : 0x66ff66 });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 0.8;
        this.mesh.add(this.head);
    }
}

// ============================================
// Projectile Class
// ============================================
class Projectile {
    constructor(position, direction, playerId, isUltimate = false) {
        this.position = position.clone();
        this.direction = direction.normalize();
        this.playerId = playerId;
        this.speed = 2;
        this.damage = isUltimate ? 50 : 25;
        this.isUltimate = isUltimate;
        this.life = 10; // seconds
        
        // 3D Model
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: isUltimate ? 0xffaa00 : 0xffff00 
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }
    
    update(deltaTime) {
        this.position.add(this.direction.clone().multiplyScalar(this.speed));
        this.mesh.position.copy(this.position);
        this.life -= deltaTime;
        
        // Check collisions
        for (let player of gameState.players.concat(gameState.bots)) {
            if (player.id === this.playerId) continue;
            
            const distance = player.position.distanceTo(this.position);
            if (distance < 1) {
                player.takeDamage(this.damage);
                this.remove();
                return;
            }
        }
        
        // Remove if out of bounds
        if (this.life <= 0 || Math.abs(this.position.x) > CONFIG.MAP_SIZE || Math.abs(this.position.z) > CONFIG.MAP_SIZE) {
            this.remove();
        }
    }
    
    remove() {
        scene.remove(this.mesh);
    }
}

// ============================================
// Effect Class (Smoke, etc.)
// ============================================
class Effect {
    constructor(type, position, duration) {
        this.type = type;
        this.position = position.clone();
        this.duration = duration;
        this.age = 0;
        this.radius = 8;
        
        if (type === 'smoke') {
            const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.4
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.copy(this.position);
            scene.add(this.mesh);
        }
    }
    
    update(deltaTime) {
        this.age += deltaTime;
        
        if (this.mesh) {
            this.mesh.material.opacity = 0.4 * (1 - this.age / this.duration);
        }
    }
    
    isActive() {
        return this.age < this.duration;
    }
    
    remove() {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
    }
}

// ============================================
// Map Creation
// ============================================
function createMap() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.MAP_SIZE, CONFIG.MAP_SIZE);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x333344 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Walls
    const wallHeight = 5;
    const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x555566 });
    
    const halfSize = CONFIG.MAP_SIZE / 2;
    
    // North Wall
    let wall = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.MAP_SIZE, wallHeight, 1), wallMaterial);
    wall.position.set(0, wallHeight / 2, -halfSize);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    // South Wall
    wall = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.MAP_SIZE, wallHeight, 1), wallMaterial);
    wall.position.set(0, wallHeight / 2, halfSize);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    // East Wall
    wall = new THREE.Mesh(new THREE.BoxGeometry(1, wallHeight, CONFIG.MAP_SIZE), wallMaterial);
    wall.position.set(halfSize, wallHeight / 2, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    // West Wall
    wall = new THREE.Mesh(new THREE.BoxGeometry(1, wallHeight, CONFIG.MAP_SIZE), wallMaterial);
    wall.position.set(-halfSize, wallHeight / 2, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    // Obstacles
    for (let i = 0; i < 8; i++) {
        const x = (Math.random() - 0.5) * (CONFIG.MAP_SIZE - 20);
        const z = (Math.random() - 0.5) * (CONFIG.MAP_SIZE - 20);
        const size = 2 + Math.random() * 3;
        
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 1.5, size),
            wallMaterial
        );
        obstacle.position.set(x, size * 0.75, z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        scene.add(obstacle);
    }
}

// ============================================
// Input Handling
// ============================================
const keys = {};
const mouse = { x: 0, y: 0, locked: false };

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

document.addEventListener('mousemove', (e) => {
    if (!mouse.locked) {
        document.addEventListener('click', () => canvas.requestPointerLock());
        return;
    }
    
    mouse.x += e.movementX * CONFIG.MOUSE_SENSITIVITY;
    mouse.y += e.movementY * CONFIG.MOUSE_SENSITIVITY;
});

document.addEventListener('click', () => canvas.requestPointerLock());

document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
});

// Ability keys
document.addEventListener('keydown', (e) => {
    const player = gameState.players[0];
    if (!player) return;
    
    if (e.key === 'q' || e.key === 'Q') player.useAbility('Q');
    if (e.key === 'e' || e.key === 'E') player.useAbility('E');
    if (e.key === 'r' || e.key === 'R') player.useAbility('R');
    if (e.key === 'f' || e.key === 'F') player.useAbility('F');
});

// Shooting
document.addEventListener('mousedown', () => {
    const player = gameState.players[0];
    if (player) player.shoot();
});

// ============================================
// Game Initialization
// ============================================
function initGame() {
    // Create map
    createMap();
    
    // Create player
    const player = new Player(0, 1, -30, false);
    gameState.players.push(player);
    camera.position.copy(player.position);
    camera.position.y += 1;
    
    // Create bots
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80 + 30;
        const bot = new Player(x, 1, z, true);
        gameState.bots.push(bot);
    }
}

// ============================================
// UI Update
// ============================================
function updateUI() {
    const player = gameState.players[0];
    if (!player) return;
    
    // Health bar
    document.getElementById('healthText').textContent = `${Math.ceil(player.health)}/100`;
    document.getElementById('healthBar').style.width = (player.health / 100 * 100) + '%';
    if (player.health < 30) {
        document.getElementById('healthBar').classList.add('low');
    } else {
        document.getElementById('healthBar').classList.remove('low');
    }
    
    // Shield bar
    document.getElementById('shieldText').textContent = `${Math.ceil(player.shield)}/100`;
    document.getElementById('shieldBar').style.width = (player.shield / 100 * 100) + '%';
    
    // Ammo
    document.getElementById('ammoText').textContent = `${player.ammo}/${player.totalAmmo}`;
    
    // Ultimate
    document.getElementById('ultText').textContent = `${Math.ceil(player.ultimate)}/${Math.ceil(player.maxUltimate)}`;
    document.getElementById('ultBar').style.width = (player.ultimate / player.maxUltimate * 100) + '%';
    
    // Abilities
    for (let key of ['Q', 'E', 'R', 'F']) {
        const ability = player.abilities[key];
        const element = document.getElementById('ability' + key);
        const cooldownPercent = (1 - ability.cooldown / ability.maxCooldown) * 100;
        
        if (ability.ready) {
            element.textContent = key + ' - ' + ability.name + ' (Ready)';
            element.classList.remove('cooldown');
        } else {
            element.textContent = key + ' - ' + ability.name + ' (' + Math.ceil(ability.cooldown) + 's)';
            element.classList.add('cooldown');
        }
    }
    
    // Debug info
    document.getElementById('debug').textContent = 
        `FPS: ${Math.round(1000/16)}\n` +
        `Pos: ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}\n` +
        `Bots: ${gameState.bots.length}\n` +
        `Projectiles: ${gameState.projectiles.length}`;
}

// ============================================
// Radar
// ============================================
function updateRadar() {
    const radarCanvas = document.getElementById('radarCanvas');
    const ctx = radarCanvas.getContext('2d');
    const size = radarCanvas.width;
    
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, size, size);
    
    ctx.strokeStyle = '#0099ff';
    ctx.strokeRect(0, 0, size, size);
    
    const player = gameState.players[0];
    if (!player) return;
    
    const scale = size / (CONFIG.MAP_SIZE * 1.2);
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Draw player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bots
    ctx.fillStyle = '#ff4444';
    for (let bot of gameState.bots) {
        if (bot.health <= 0) continue;
        
        const x = centerX + (bot.position.x - player.position.x) * scale;
        const y = centerY + (bot.position.z - player.position.z) * scale;
        
        if (x > 0 && x < size && y > 0 && y < size) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw effects (smoke)
    ctx.fillStyle = 'rgba(136, 136, 136, 0.5)';
    for (let effect of gameState.effects) {
        if (effect.type === 'smoke') {
            const x = centerX + (effect.position.x - player.position.x) * scale;
            const y = centerY + (effect.position.z - player.position.z) * scale;
            
            ctx.beginPath();
            ctx.arc(x, y, effect.radius * scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ============================================
// Game Loop
// ============================================
let lastTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    
    // Update player camera
    const player = gameState.players[0];
    if (player) {
        player.rotation.order = 'YXZ';
        player.rotation.y -= mouse.x;
        player.rotation.x -= mouse.y;
        
        player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
        
        mouse.x = 0;
        mouse.y = 0;
        
        camera.rotation.order = 'YXZ';
        camera.rotation.copy(player.rotation);
        camera.position.copy(player.position);
        camera.position.y += 1;
    }
    
    // Update all players
    for (let player of gameState.players) {
        player.update(deltaTime, keys);
    }
    
    // Update all bots
    for (let bot of gameState.bots) {
        bot.update(deltaTime, {});
    }
    
    // Update projectiles
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        gameState.projectiles[i].update(deltaTime);
        if (gameState.projectiles[i].life <= 0 || gameState.projectiles[i].position.y < 0) {
            gameState.projectiles[i].remove();
            gameState.projectiles.splice(i, 1);
        }
    }
    
    // Update effects
    for (let i = gameState.effects.length - 1; i >= 0; i--) {
        gameState.effects[i].update(deltaTime);
        if (!gameState.effects[i].isActive()) {
            gameState.effects[i].remove();
            gameState.effects.splice(i, 1);
        }
    }
    
    // Update UI
    updateUI();
    updateRadar();
    
    // Render
    renderer.render(scene, camera);
    
    requestAnimationFrame(gameLoop);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start game
initGame();
gameLoop();
