const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 게임 설정 ---
const STAGE_WIDTH = canvas.width;
const STAGE_HEIGHT = canvas.height;
const GROUND_HEIGHT = 50;

// --- 게임 상태 관리 ---
let gameState = 'story'; // menu, stage, village
let activeUI = null; // null, 'quest', 'shop'
let storyPage = 0;
let stage = 1;
let ultimateGauge = 0;
let isUltimateActive = false;
let ultimateTimer = 0;
const ULTIMATE_DURATION = 10; // 10초
let gameTimer = 0;
let isBossFight = false;
let frameCount = 0;
let backgroundX = 0;
let isGroundSlippery = false;

// --- 리소스 관리 ---
const lasers = [];
const LASER_SPEED = 10;
const enemies = [];
let boss = null;
const bossProjectiles = [];
const lightningZones = []; // 스테이지 1, 3 보스용
const residualElectrics = []; // 스테이지 2 보스용
const bubbles = []; // 스테이지 3 보스용
const fires = []; // 스테이지 6 보스용
const particles = []; // 파티클 효과용
let villageVisitCount = 3;
let stage7BossRush = [];
let currentBossIndex = 0;

// --- 스테이지 데이터 ---
const stages = [
    { // Stage 1
        type: 'boss',
        bossSpawnTime: 90,
        drawBackground: drawStage1Background,
        createBoss: createStage1Boss,
    },
    { // Stage 2
        type: 'boss',
        bossSpawnTime: 60,
        drawBackground: drawStage2Background,
        createBoss: createStage2Boss,
    },
    { // Stage 3
        type: 'boss',
        bossSpawnTime: 50,
        drawBackground: drawStage3Background,
        createBoss: createStage3Boss,
    },
    { // Stage 4
        type: 'kill',
        killGoal: 10,
        drawBackground: drawStage5Background, // 어둠의 성 밖 배경
    },
    { // Stage 5
        type: 'boss',
        bossSpawnTime: 30,
        drawBackground: drawStage5Background,
        createBoss: createStage5Boss,
    },
    { // Stage 6
        type: 'boss',
        bossSpawnTime: 0, // 보스 즉시 등장
        drawBackground: drawStage6Background,
        createBoss: createStage6Boss,
    },
    { // Stage 7
        type: 'boss',
        bossSpawnTime: 0, // 보스 즉시 등장 (보스 러시)
        drawBackground: drawStage7Background,
        createBoss: () => { // 보스 러시 시작
            stage7BossRush = [createStage1Boss, createStage2Boss, createStage3Boss, createStage5Boss, createStage6Boss, createStage7Boss];
            currentBossIndex = 0;
            stage7BossRush[currentBossIndex]();
        }
    },
];


// --- 필살기 및 상점 데이터 ---
const ultimates = {
    damage: { name: '기본 필살기', description: '10초간 주변의 적에게 피해를 줍니다.', price: 0, purchased: true, type: 'ultimate' },
    defense: { name: '방어막', description: '10초간 모든 피해를 막습니다.', price: 200, purchased: false, type: 'ultimate' },
    chain_lightning: { name: '연쇄 번개', description: '가까운 적 5명에게 즉시 번개 피해를 줍니다.', price: 500, purchased: false, type: 'ultimate' },
    time_warp: { name: '시간 왜곡장', description: '10초간 주변의 적과 투사체를 느리게 만듭니다.', price: 700, purchased: false, type: 'ultimate' },
    vampiric_aura: { name: '흡혈 오라', description: '10초간 적을 공격 시 체력을 회복합니다.', price: 800, purchased: false, type: 'ultimate' },
    teleport: { name: '순간 이동', description: '바라보는 방향으로 빠르게 순간이동합니다.', price: 1000, purchased: false, type: 'ultimate' },
};

const shopConsumables = {
    potion: { id: 'potion', name: '회복 아이템', price: 50, type: 'consumable' }
};


// --- 플레이어(토드) 설정 ---
const player = {
    x: 100,
    y: STAGE_HEIGHT - GROUND_HEIGHT - 100,
    width: 40,
    baseHeight: 80,
    crouchHeight: 50,
    height: 80,
    headRadius: 20,
    speed: 5,
    dx: 0,
    dy: 0,
    velocity: 0, // 미끄러운 바닥용
    friction: 0.98, // 미끄러운 바닥용
    gravity: 0.6,
    jumpPower: -15,
    isJumping: false,
    isCrouching: false,
    direction: 'right',
    hp: 3,
    maxHp: 3,
    coins: 0, // 초기 코인
    isInvincible: false,
    invincibleTimer: 0,
    inventory: {
        potions: 0,
    },
    equippedUltimate: 'damage',
    enemyKillCount: 0,

    draw() {
        const bodyY = this.y + this.headRadius * 2;
        const bodyHeight = this.height - this.headRadius * 2;
        const centerX = this.x + this.width / 2;

        // 필살기 오라 효과
        if (isUltimateActive && this.equippedUltimate === 'damage') {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'red';
            const auraRadius = 75 + Math.sin(frameCount * 0.3) * 10;
            ctx.beginPath();
            ctx.arc(centerX, this.y + this.height / 2, auraRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }


        if (this.isInvincible && Math.floor(this.invincibleTimer / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        } else {
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = '#ff0000';
        const legWidth = 15, legHeight = 30, footHeight = 5;
        ctx.fillRect(centerX - legWidth, this.y + this.height, legWidth, -legHeight);
        ctx.fillRect(centerX - legWidth - 5, this.y + this.height - footHeight, legWidth + 5, footHeight);
        ctx.fillRect(centerX, this.y + this.height, legWidth, -legHeight);
        ctx.fillRect(centerX, this.y + this.height - footHeight, legWidth + 5, footHeight);
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const springTurns = this.isCrouching ? 5 : 10;
        for (let i = 0; i < springTurns; i++) {
            const p = i / (springTurns - 1);
            const x = centerX + Math.sin(p * Math.PI * 4) * (this.width / 3);
            const y = bodyY + bodyHeight * p;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        const armXOffset = this.direction === 'right' ? 25 : -25;
        const armY = bodyY + bodyHeight / 2;
        ctx.arc(centerX + armXOffset, armY, 10, 0, Math.PI * 2);
        ctx.fill();
        const headY = this.y + this.headRadius;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, headY, this.headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#dddddd';
        ctx.stroke();
        const eyeXOffset = this.direction === 'right' ? 8 : -8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX + eyeXOffset, headY, 6, 0, Math.PI * 2);
        ctx.arc(centerX - eyeXOffset + (this.direction === 'right' ? 4 : -4), headY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        ctx.arc(centerX + eyeXOffset, headY, 4, 0, Math.PI * 2);
        ctx.arc(centerX - eyeXOffset + (this.direction === 'right' ? 4 : -4), headY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        const mouthY = headY + 5, mouthLeft = centerX - 12, mouthRight = centerX + 12, mouthBottom = headY + 20;
        ctx.beginPath();
        ctx.moveTo(mouthLeft, mouthY);
        ctx.quadraticCurveTo(centerX, mouthBottom, mouthRight, mouthY);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        const teethCount = 5, toothWidth = 3, toothHeight = 4, teethY = mouthY + 1;
        const totalTeethWidth = teethCount * toothWidth + (teethCount - 1) * 1;
        const startTeethX = centerX - totalTeethWidth / 2;
        for (let i = 0; i < teethCount; i++) {
            ctx.fillRect(startTeethX + i * (toothWidth + 1), teethY, toothWidth, toothHeight);
        }
        const hatY = this.y - 15;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(centerX - 25, hatY, 50, 10);
        ctx.fillRect(centerX - 15, hatY - 20, 30, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '15px Arial';
        ctx.fillText('T', centerX - 4, hatY - 5);
        if (isUltimateActive) {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(centerX, this.y - 30, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = 'yellow';
            ctx.shadowBlur = 20;
        }
        ctx.globalAlpha = 1.0;
    },

    update() {
        if (isGroundSlippery) {
            if (keys.left) this.velocity -= 1;
            if (keys.right) this.velocity += 1;
            this.velocity = Math.max(-this.speed, Math.min(this.speed, this.velocity));
        } else {
            this.velocity = 0;
            if (keys.left) this.velocity = -this.speed;
            if (keys.right) this.velocity = this.speed;
        }
        
        this.x += this.velocity;

        if(isGroundSlippery) {
            this.velocity *= this.friction;
        }


        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.isInvincible = false;
        }
        if (gameState === 'stage') {
             if (keys.left) backgroundX += this.speed / 4;
            if (keys.right) backgroundX -= this.speed / 4;
        }
        this.height = this.isCrouching ? this.crouchHeight : this.baseHeight;
        
        this.dy += this.gravity;
        this.y += this.dy;
        const ground = STAGE_HEIGHT - GROUND_HEIGHT;
        if (this.y + this.height > ground) {
            if (this.isJumping) { // 착지 시 먼지 효과
                createDustEffect(this.x + this.width / 2, this.y + this.height);
            }
            this.isJumping = false;
            this.y = ground - this.height;
            this.dy = 0;
        }
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > STAGE_WIDTH) this.x = STAGE_WIDTH - this.width;
    },

    jump() { 
        if (!this.isJumping && !this.isCrouching) { 
            this.isJumping = true; 
            this.dy = this.jumpPower; 
            createDustEffect(this.x + this.width / 2, this.y + this.height);
        } 
    },
    crouch(isPressed) { 
        if (this.isJumping) return; 
        if (isPressed && !this.isCrouching) { // 수그리기 시작 시 증기 효과
            createSteamEffect(this.x + this.width / 2, this.y + this.height / 2);
        }
        this.isCrouching = isPressed; 
    },
    shoot() {
        const armY = this.y + this.headRadius * 2 + (this.height - this.headRadius * 2) / 2;
        const laserX = this.x + this.width / 2;
        
        const laserProps = {
            x: laserX,
            y: armY,
            width: 20,
            height: 5,
            color: '#00ff00',
            direction: keys.b ? 'up' : this.direction
        };

        if (keys.b) {
            laserProps.width = 5;
            laserProps.height = 20;
            laserProps.x = laserX - laserProps.width / 2; // 중앙 정렬
        }

        lasers.push(laserProps);

        // 발사 섬광 효과
        particles.push({
            x: laserX, y: armY,
            dx: 0, dy: 0,
            radius: 8,
            color: '#fff',
            life: 5,
            startLife: 5
        });
    },
    takeDamage() {
        if (!this.isInvincible && !(isUltimateActive && this.equippedUltimate === 'defense')) {
            this.hp--;
            this.isInvincible = true;
            this.invincibleTimer = 120;
            if (this.hp <= 0) gameOver();
        }
    },
    usePotion() {
        if (this.inventory.potions > 0 && this.hp < this.maxHp) {
            this.inventory.potions--;
            this.hp = Math.min(this.maxHp, this.hp + 1);
            alert('체력을 1 회복했습니다.');
        }
    },
    knockback(amount) {
        this.x -= amount;
    }
};

// --- 퀘스트 데이터 ---
const quest = {
    id: 1,
    title: '일반 적 15마리 처치',
    goal: 15,
    reward: 100,
    isActive: false,
    isComplete: false
};

// --- 적/보스/NPC/발사체 생성 함수 ---
function createEnemy() {
    const size = 40;
    const newEnemy = {
        x: STAGE_WIDTH, y: STAGE_HEIGHT - GROUND_HEIGHT - size, width: size, height: size,
        speed: (Math.random() * 2 + 1) * (1 + (stage - 1) * 0.1),
        draw() { ctx.fillStyle = 'purple'; ctx.fillRect(this.x, this.y, this.width, this.height); },
        update(speedMultiplier = 1) { this.x -= this.speed * speedMultiplier; }
    };
    enemies.push(newEnemy);
    return newEnemy; // 반환하여 속성 수정 가능하게
}

function createBoss() {
    stages[stage - 1].createBoss();
}

function createStage1Boss() { 
    boss = {
        x: STAGE_WIDTH - 200, y: STAGE_HEIGHT - GROUND_HEIGHT - 150, width: 150, height: 150,
        hp: 1000 * (1 + (stage - 1) * 0.2), maxHp: 1000 * (1 + (stage - 1) * 0.2),
        attackCooldown: 0, pattern: 0,
        draw() {
            const centerX = this.x + this.width / 2, centerY = this.y + this.height / 2;
            ctx.fillStyle = '#333'; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#555'; ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#00ff00'; ctx.font = '30px Arial'; ctx.fillText(':)', centerX - 15, centerY + 10);
            ctx.fillStyle = '#8B4513'; ctx.beginPath();
            ctx.arc(this.x, centerY, 20, 0, Math.PI * 2); ctx.arc(this.x + this.width, centerY, 20, 0, Math.PI * 2); ctx.fill();
        },
        update() {
            this.attackCooldown--;
            if (this.attackCooldown <= 0) this.chooseAttack();
        },
        chooseAttack() {
            this.pattern = Math.floor(Math.random() * 3);
            switch (this.pattern) {
                case 0: this.attackCooldown = 180; for (let i = 0; i < 10; i++) bossProjectiles.push(createBalloon(this.x, this.y + this.height / 2)); break;
                case 1: this.attackCooldown = 120; for (let i = 0; i < 5; i++) setTimeout(() => this.shootLaser(), i * 200); break;
                case 2: this.attackCooldown = 240; for (let i = 0; i < 5; i++) createLightningZone(Math.random() * STAGE_WIDTH); break;
            }
        },
        shootLaser() {
            if (!boss) return;
            const angle = Math.random() * Math.PI * 2;
            bossProjectiles.push({ 
                x: this.x + this.width / 2, y: this.y + this.height / 2, width: 10, height: 10, speed: 7, angle: angle, type: 'laser',
                draw() { ctx.fillStyle = 'red'; ctx.fillRect(this.x, this.y, this.width, this.height); },
                update(speedMultiplier = 1) { this.x += Math.cos(this.angle) * this.speed * speedMultiplier; this.y += Math.sin(this.angle) * this.speed * speedMultiplier; }
            });
        }
    };
 }
function createStage2Boss() { 
    boss = {
        x: STAGE_WIDTH - 200, y: STAGE_HEIGHT - GROUND_HEIGHT - 200, width: 100, height: 200,
        hp: 1200 * (1 + (stage - 1) * 0.2), maxHp: 1200 * (1 + (stage - 1) * 0.2),
        attackCooldown: 120,
        state: 'idle', // idle, slamming, shooting, leaving
        stateTimer: 0,
        slamTargetX: 0,
        slamStartY: 0,

        draw() {
            const centerX = this.x + this.width / 2;
            // 몸통 (전선)
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.moveTo(centerX, this.y);
            for(let i = 0; i < this.height; i+=10) {
                ctx.lineTo(centerX + Math.sin(i * 0.5 + frameCount * 0.2) * 10, this.y + i);
            }
            ctx.lineTo(centerX, this.y + this.height);
            ctx.stroke();

            // 얼굴 (LED 전구)
            const headY = this.y;
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(centerX, headY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(centerX, headY, 40 + Math.sin(frameCount * 0.1) * 5, 0, Math.PI * 2);
            ctx.fill();

            // 인상 쓴 눈
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX - 15, headY - 5);
            ctx.lineTo(centerX - 5, headY);
            ctx.moveTo(centerX + 15, headY - 5);
            ctx.lineTo(centerX + 5, headY);
            ctx.stroke();
        },
        update() {
            this.attackCooldown--;
            if (this.attackCooldown <= 0 && this.state === 'idle') {
                this.state = 'slamming';
                this.stateTimer = 180; // 3초간 패턴 지속
                this.slamTargetX = player.x;
                this.slamStartY = this.y;
            }

            switch(this.state) {
                case 'slamming':
                    // 플레이어 위치로 이동 후 내리꽂기
                    this.x = this.slamTargetX - this.width / 2;
                    this.y += 20; // 내리꽂는 속도
                    if (this.y >= STAGE_HEIGHT - GROUND_HEIGHT - this.height) {
                        this.y = STAGE_HEIGHT - GROUND_HEIGHT - this.height;
                        this.state = 'shooting';
                        this.stateTimer = 300; // 5초간 레이저 발사
                    }
                    break;
                case 'shooting':
                    this.stateTimer--;
                    // 5초간 사방으로 레이저 발사
                    if (this.stateTimer % 10 === 0) {
                        const angle = Math.random() * Math.PI * 2;
                        bossProjectiles.push({
                            x: this.x + this.width / 2, y: this.y, width: 15, height: 3, speed: 5, angle: angle, type: 'laser',
                            draw() { ctx.fillStyle = 'red'; ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height); ctx.restore(); },
                            update(speedMultiplier = 1) { this.x += Math.cos(this.angle) * this.speed * speedMultiplier; this.y += Math.sin(this.angle) * this.speed * speedMultiplier; }
                        });
                    }
                    if (this.stateTimer <= 0) {
                        this.stateTimer = 300; // 5초간 전기 장판 남김
                        createResidualElectric(this.x, this.y + this.height, this.width, this.stateTimer);
                        this.y = this.slamStartY; // 원래 위치로 복귀
                        this.x = STAGE_WIDTH - 200;
                        this.state = 'idle';
                        this.attackCooldown = 240; // 다음 공격까지 4초
                    }
                    break;
            }
        },
    };
}

function createStage3Boss() {
    boss = {
        x: STAGE_WIDTH - 150, y: STAGE_HEIGHT - GROUND_HEIGHT - 150, width: 150, height: 150,
        hp: 1500, maxHp: 1500,
        attackCooldown: 120, pattern: 0, state: 'idle', stateTimer: 0,
        dx: 0,
        draw() {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            // 몸통
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            // 눈
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(centerX - 25, centerY - 10, 20, 0, Math.PI * 2);
            ctx.arc(centerX + 25, centerY - 10, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(centerX - 25, centerY - 10, 10, 0, Math.PI * 2);
            ctx.arc(centerX + 25, centerY - 10, 10, 0, Math.PI * 2);
            ctx.fill();
            // 인상
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(centerX - 40, centerY - 25);
            ctx.lineTo(centerX - 10, centerY - 15);
            ctx.moveTo(centerX + 40, centerY - 25);
            ctx.lineTo(centerX + 10, centerY - 15);
            ctx.stroke();
        },
        update() {
            this.attackCooldown--;
            if (this.attackCooldown <= 0 && this.state === 'idle') {
                this.pattern = Math.floor(Math.random() * 3);
                this.state = 'acting';
                switch (this.pattern) {
                    case 0: // 돌진
                        this.stateTimer = 120;
                        this.dx = -15;
                        break;
                    case 1: // 바닥 미끄럽게
                        this.stateTimer = 300;
                        isGroundSlippery = true;
                        break;
                    case 2: // 거품 발사
                        this.stateTimer = 300;
                        createLightningZone(player.x - 50); // 플레이어 뒤에 번개
                        break;
                }
            }

            if (this.state === 'acting') {
                this.stateTimer--;
                switch (this.pattern) {
                    case 0: // 돌진 중
                        this.x += this.dx;
                        if (this.x < 0) this.dx = 15;
                        if (this.x > STAGE_WIDTH - this.width) this.dx = -15;
                        break;
                    case 2: // 거품 발사 중
                        if (this.stateTimer % 15 === 0) {
                            bubbles.push({ 
                                x: this.x, y: this.y + Math.random() * this.height, 
                                width: 30, height: 30, speed: 5 + Math.random() * 5 
                            });
                        }
                        break;
                }
                if (this.stateTimer <= 0) {
                    this.state = 'idle';
                    this.attackCooldown = 120;
                    if (this.pattern === 1) isGroundSlippery = false;
                }
            }
        }
    };
}

function createStage5Boss() { 
    boss = {
        x: STAGE_WIDTH - 200, y: STAGE_HEIGHT - GROUND_HEIGHT - 150, width: 150, height: 150,
        hp: 2000, 
        maxHp: 2000,
        attackCooldown: 0, pattern: 0,
        draw() { 
            const centerX = this.x + this.width / 2, centerY = this.y + this.height / 2;
            ctx.fillStyle = '#581845'; // Dark purple
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#FF5733'; // Orange
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#FF5733'; ctx.font = 'bold 30px Arial'; ctx.fillText('>:)', centerX - 25, centerY + 10);
            ctx.fillStyle = '#C70039'; // Dark red
            ctx.beginPath();
            ctx.arc(this.x, centerY, 20, 0, Math.PI * 2); ctx.arc(this.x + this.width, centerY, 20, 0, Math.PI * 2); ctx.fill();
        },
        update() {
            this.attackCooldown--;
            if (this.attackCooldown <= 0) this.chooseAttack();
        },
        chooseAttack() {
            this.pattern = Math.floor(Math.random() * 3);
            switch (this.pattern) {
                case 0: this.attackCooldown = 120; for (let i = 0; i < 15; i++) bossProjectiles.push(createBalloon(this.x, this.y + this.height / 2)); break;
                case 1: this.attackCooldown = 90; for (let i = 0; i < 8; i++) setTimeout(() => this.shootLaser(), i * 150); break;
                case 2: this.attackCooldown = 180; for (let i = 0; i < 7; i++) createLightningZone(Math.random() * STAGE_WIDTH); break;
            }
        },
        shootLaser() {
            if (!boss) return;
            const angle = Math.random() * Math.PI * 2;
            bossProjectiles.push({ 
                x: this.x + this.width / 2, y: this.y + this.height / 2, width: 12, height: 12, speed: 9, angle: angle, type: 'laser',
                draw() { ctx.fillStyle = '#FF5733'; ctx.fillRect(this.x, this.y, this.width, this.height); },
                update(speedMultiplier = 1) { this.x += Math.cos(this.angle) * this.speed * speedMultiplier; this.y += Math.sin(this.angle) * this.speed * speedMultiplier; }
            });
        }
    };
 }

function createStage6Boss() {
    boss = {
        x: STAGE_WIDTH / 2 - 75, y: STAGE_HEIGHT - GROUND_HEIGHT - 80, width: 150, height: 80,
        hp: 2000, maxHp: 2000,
        state: 'idle', // idle, ascending, bombing
        stateTimer: 300, // 5초 대기 (60fps * 5)
        targetY: 100,
        rotorAngle: 0,
        draw() {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            // Rotor
            this.rotorAngle += 0.5;
            ctx.save();
            ctx.translate(centerX, this.y);
            ctx.rotate(this.rotorAngle);
            ctx.fillStyle = '#555';
            ctx.fillRect(-80, -5, 160, 10);
            ctx.restore();

            // Body
            ctx.fillStyle = '#34495e';
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cockpit
            ctx.fillStyle = '#aed6f1';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 20, centerY, 30, 25, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tail
            ctx.fillStyle = '#555';
            ctx.fillRect(this.x - 50, centerY - 5, 50, 10);
        },
        update() {
            this.stateTimer--;
            switch (this.state) {
                case 'idle':
                    if (this.stateTimer <= 0) {
                        this.state = 'ascending';
                    }
                    break;
                case 'ascending':
                    this.y -= 2;
                    if (this.y <= this.targetY) {
                        this.y = this.targetY;
                        this.state = 'bombing';
                        this.stateTimer = 0;
                    }
                    break;
                case 'bombing':
                    this.x += Math.sin(frameCount * 0.02) * 3;
                    this.stateTimer--;
                    if (this.stateTimer <= 0) {
                        this.stateTimer = 120; // 2초마다 폭탄 투하
                        bossProjectiles.push({
                            x: this.x + this.width / 2, y: this.y + this.height, 
                            width: 20, height: 20, speedY: 3, type: 'bomb',
                            draw() {
                                ctx.fillStyle = 'black';
                                ctx.beginPath();
                                ctx.arc(this.x, this.y, this.width/2, 0, Math.PI*2);
                                ctx.fill();
                            },
                            update() {
                                this.y += this.speedY;
                                if (this.y >= STAGE_HEIGHT - GROUND_HEIGHT - this.height/2) {
                                    createFire(this.x, STAGE_HEIGHT - GROUND_HEIGHT, 50, 180);
                                    const index = bossProjectiles.indexOf(this);
                                    if(index > -1) bossProjectiles.splice(index, 1);
                                }
                            }
                        });
                    }
                    break;
            }
        }
    };
}

function createStage7Boss() {
    boss = {
        x: STAGE_WIDTH / 2 - 75, y: STAGE_HEIGHT - GROUND_HEIGHT - 150, width: 150, height: 150,
        hp: 4000, maxHp: 4000,
        state: 'phase1', // phase1, frenzy, idle
        stateTimer: 0,
        attackCooldown: 120,
        frenzyDuration: 7 * 60, // 7초
        dx: 0,

        draw() {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            // 몸체
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            // 빨간 눈
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40 + Math.sin(frameCount * 0.2) * 5, 0, Math.PI * 2);
            ctx.fill();
        },
        update() {
            this.attackCooldown--;

            if (this.state === 'phase1' && this.attackCooldown <= 0) {
                this.chooseAttack();
            } else if (this.state === 'frenzy') {
                this.stateTimer--;
                // 7초간 모든 패턴 동시 사용
                if (this.stateTimer % 30 === 0) { // 돌진
                    this.dx = player.x < this.x ? -10 : 10;
                }
                this.x += this.dx;
                if (this.x < 0 || this.x > STAGE_WIDTH - this.width) this.dx *= -1;


                if (this.stateTimer % 20 === 0) { // 번개
                    createLightningZone(Math.random() * STAGE_WIDTH);
                }
                if (this.stateTimer % 15 === 0) { // 폭탄
                    bossProjectiles.push({
                        x: this.x + this.width / 2, y: this.y + this.height,
                        width: 20, height: 20, speedY: 4, type: 'bomb',
                        draw() { ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2); ctx.fill(); },
                        update() {
                            this.y += this.speedY;
                            if (this.y >= STAGE_HEIGHT - GROUND_HEIGHT - this.height / 2) {
                                createFire(this.x, STAGE_HEIGHT - GROUND_HEIGHT, 50, 120);
                                const index = bossProjectiles.indexOf(this);
                                if (index > -1) bossProjectiles.splice(index, 1);
                            }
                        }
                    });
                }

                if (this.stateTimer <= 0) {
                    this.state = 'phase1';
                    this.attackCooldown = 180;
                }
            }
            
            // HP가 50% 이하일 때 frenzy 모드 돌입
            if (this.hp < this.maxHp / 2 && this.state !== 'frenzy') {
                this.state = 'frenzy';
                this.stateTimer = this.frenzyDuration;
            }
        },
        chooseAttack() {
            const pattern = Math.floor(Math.random() * 3);
            switch (pattern) {
                case 0: // 양쪽에서 적 소환
                    this.attackCooldown = 180;
                    for(let i=0; i<3; i++) {
                        setTimeout(() => createEnemy(), i * 500);
                        setTimeout(() => { // 오른쪽에서도 소환
                            const enemy = createEnemy();
                            enemy.x = 0;
                            enemy.speed *= -1; // 반대 방향으로 이동
                        }, i * 500 + 250);
                    }
                    break;
                case 1: // 가로 레이저 10번
                    this.attackCooldown = 300;
                    for (let i = 0; i < 10; i++) {
                        setTimeout(() => this.shootHorizontalLaser(), i * 300);
                    }
                    break;
                case 2: // 세로 레이저
                    this.attackCooldown = 240;
                    for (let i = 0; i < 8; i++) {
                        setTimeout(() => this.shootVerticalLaser(), i * 100);
                    }
                    break;
            }
        },
        shootHorizontalLaser() {
            if (!boss) return;
            bossProjectiles.push({
                x: 0, y: Math.random() * (STAGE_HEIGHT - GROUND_HEIGHT - 20),
                width: STAGE_WIDTH, height: 10, timer: 30, // 0.5초
                type: 'wide_laser',
                draw() {
                    ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + (this.timer / 30) * 0.8})`;
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                },
                update() {
                    this.timer--;
                    if (this.timer <= 0) {
                        const index = bossProjectiles.indexOf(this);
                        if (index > -1) bossProjectiles.splice(index, 1);
                    }
                }
            });
        },
        shootVerticalLaser() {
            if (!boss) return;
            createLightningZone(Math.random() * STAGE_WIDTH); // 기존 번개 이펙트 재활용
        }
    };
}


function createBalloon(x, y) {
    const angleToPlayer = Math.atan2(player.y - y, player.x - x);
    return {
        x: x, y: y, width: 30, height: 20, speed: Math.random() * 2 + 2, angle: angleToPlayer, type: 'balloon',
        draw() { ctx.fillStyle = 'cyan'; ctx.beginPath(); ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2); ctx.fill(); },
        update(speedMultiplier = 1) { this.x += Math.cos(this.angle) * this.speed * speedMultiplier; this.y += Math.sin(this.angle) * this.speed * speedMultiplier; }
    };
}

function createLightningZone(x) {
    const zone = {
        x: x - 50, y: 0, width: 100, height: STAGE_HEIGHT - GROUND_HEIGHT, timer: 120, active: false,
        draw() {
            if (!this.active) { 
                ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'; 
                ctx.fillRect(this.x, this.y, this.width, this.height); 
            } else { 
                ctx.fillStyle = 'yellow'; 
                ctx.fillRect(this.x, this.y, this.width, this.height); 
            }
        },
        update() {
            this.timer--;
            if (this.timer <= 0 && !this.active) {
                this.active = true; this.timer = 60;
            }
            if (this.active) {
                 if (isColliding(player, this)) player.takeDamage();
            }
            if (this.active && this.timer <= 0) {
                const index = lightningZones.indexOf(this);
                if (index > -1) lightningZones.splice(index, 1);
            }
        }
    };
    lightningZones.push(zone);
}

// 스테이지 2 보스의 잔류 전기 공격
function createResidualElectric(x, y, width, duration) {
    residualElectrics.push({
        x: x, y: y - 20, width: width, height: 20, timer: duration,
        draw() {
            ctx.fillStyle = `rgba(255, 255, 0, ${0.2 + Math.random() * 0.3})`;
            ctx.beginPath();
            const groundY = STAGE_HEIGHT - GROUND_HEIGHT;
            ctx.moveTo(this.x, groundY);
            for(let i=0; i<this.width; i+=10) {
                ctx.lineTo(this.x + i, groundY - Math.random() * this.height);
            }
            ctx.lineTo(this.x + this.width, groundY);
            ctx.closePath();
            ctx.fill();
        },
        update() {
            this.timer--;
            if (isColliding(player, this)) {
                player.takeDamage();
            }
        }
    });
}

function createFire(x, y, width, duration) {
    fires.push({
        x: x - width / 2, y: y - 30, width: width, height: 30, timer: duration,
        draw() {
            ctx.fillStyle = `rgba(255, ${Math.random() * 100}, 0, 0.7)`;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height);
            for(let i=0; i < this.width; i+=5) {
                ctx.lineTo(this.x + i, this.y + this.height - (Math.random() * this.height));
            }
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        },
        update() {
            this.timer--;
            if(isColliding(player, this)) player.takeDamage();
        }
    });
}

// --- 파티클 효과 생성 함수 ---
function createDustEffect(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x, y: y,
            dx: (Math.random() - 0.5) * 2,
            dy: Math.random() * -1.5,
            radius: Math.random() * 3 + 1,
            color: '#888',
            life: 20,
            startLife: 20
        });
    }
}

function createSparkEffect(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x, y: y,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            radius: Math.random() * 2 + 1,
            color: '#ffcc00',
            life: 15,
            startLife: 15
        });
    }
}

function createSteamEffect(x, y) {
     for (let i = 0; i < 3; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 10, y: y,
            dx: (Math.random() - 0.5) * 0.5,
            dy: -0.5 - Math.random() * 0.5,
            radius: Math.random() * 4 + 2,
            color: '#fff',
            life: 25,
            startLife: 25
        });
    }
}


const npcs = {
    villageChief: { x: 150, y: STAGE_HEIGHT - GROUND_HEIGHT - 80, width: 50, height: 80, color: 'green' },
    merchant: { x: 600, y: STAGE_HEIGHT - GROUND_HEIGHT - 80, width: 50, height: 80, color: 'blue' },
    radio: { x: 400, y: STAGE_HEIGHT - GROUND_HEIGHT - 60, width: 40, height: 40, color: 'red' }
};

// --- 입력 처리 ---
const keys = { left: false, right: false, down: false, e: false, p: false, m: false, b: false };
function handleKeyDown(e) {
    const key = e.key.toLowerCase();
    if (activeUI) {
        if (key === 'e') keys.e = true;
        return;
    }

    if (key === 'arrowleft' || key === 'a') { keys.left = true; player.direction = 'left'; }
    if (key === 'arrowright' || key === 'd') { keys.right = true; player.direction = 'right'; }
    if (key === 'arrowdown' || key === 's') { keys.down = true; player.crouch(true); }
    if (key === 'arrowup' || key === 'w') player.jump();
    if (key === ' ') { e.preventDefault(); player.shoot(); }
    if (key === 'e') keys.e = true;
    if (key === 'p') player.usePotion();
    if (key === 'b') keys.b = true;
    if (key === 'm') {
        if (ultimateGauge >= 100 && !isUltimateActive) {
            isUltimateActive = true;
            ultimateTimer = ULTIMATE_DURATION;
            if (player.equippedUltimate === 'teleport') {
                const teleportDistance = 200;
                player.x += (player.direction === 'right' ? teleportDistance : -teleportDistance);
                player.isInvincible = true;
                player.invincibleTimer = 30;
                isUltimateActive = false;
                ultimateGauge = 0;
            } else if (player.equippedUltimate === 'chain_lightning') {
                let targets = enemies.sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x)).slice(0, 5);
                targets.forEach(t => {
                    const index = enemies.indexOf(t);
                    if(index > -1) enemies.splice(index, 1);
                });
                isUltimateActive = false;
                ultimateGauge = 0;
            }
        }
    }
}
function handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') keys.left = false;
    if (key === 'arrowright' || key === 'd') keys.right = false;
    if (key === 'arrowdown' || key === 's') { keys.down = false; player.crouch(false); }
    if (key === 'e') keys.e = false;
    if (key === 'b') keys.b = false;
}
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

function handleMouseClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const mousePos = { x: mouseX, y: mouseY, width: 1, height: 1 };

    if (gameState === 'story') {
        storyPage++;
        if (storyPage > 2) {
            gameState = 'menu';
        }
        return;
    }

    if (gameState === 'menu') {
        Object.keys(ultimates).forEach((id, index) => {
            const ultButton = { x: 250, y: 150 + index * 60, width: 300, height: 50 };
            if (isColliding(mousePos, ultButton) && ultimates[id].purchased) {
                player.equippedUltimate = id;
            }
        });
        const villageButton = { x: STAGE_WIDTH / 2 - 75, y: STAGE_HEIGHT - 80, width: 150, height: 40 };
        if(isColliding(mousePos, villageButton)) goToVillage();

    } else if (gameState === 'stage' && isColliding(mousePos, { x: STAGE_WIDTH - 120, y: 10, width: 110, height: 30 })) {
        goToVillage();
    } else if (gameState === 'village') {
        if (isColliding(mousePos, { x: 20, y: 10, width: 120, height: 30 })) goToMenu();
        if (isColliding(mousePos, { x: STAGE_WIDTH - 140, y: 10, width: 120, height: 30 })) goToStage();
    }

    if (activeUI === 'shop') {
        let itemY = 220;
        // 소모품 구매
        const potion = shopConsumables.potion;
        const potionButton = { x: 250, y: itemY, width: 300, height: 30 };
        if(isColliding(mousePos, potionButton)) buyItem(potion);
        itemY += 60;

        // 필살기 구매
        Object.keys(ultimates).forEach(id => {
            const ult = ultimates[id];
            if (ult.price > 0 && !ult.purchased) {
                const ultButton = { x: 250, y: itemY, width: 300, height: 30 };
                if (isColliding(mousePos, ultButton)) buyItem(ult, id);
                itemY += 40;
            }
        });
    } else if (activeUI === 'quest') {
        const acceptButton = { x: 350, y: 280, width: 100, height: 30 };
        if (isColliding(mousePos, acceptButton)) acceptQuest();
    }
}
document.addEventListener('click', handleMouseClick);


// ====================================================================
//                         게임 상태별 로직
// ====================================================================

function updateLogic() {
    if (activeUI) {
        if (keys.e) { activeUI = null; keys.e = false; }
        return;
    }
    if (gameState === 'story') { /* No updates needed */ }
    else if (gameState === 'menu') updateMenuLogic();
    else if (gameState === 'stage') updateStageLogic();
    else if (gameState === 'village') updateVillageLogic();
}

function draw() {
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    if (gameState === 'story') drawStory();
    else if (gameState === 'menu') drawMenu();
    else if (gameState === 'stage') drawStage();
    else if (gameState === 'village') drawVillage();

    if (activeUI === 'quest') drawQuestUI();
    else if (activeUI === 'shop') drawShopUI();
}

// --- 스토리 로직 ---
function drawStory() {
    const storyText = [
        "미래 언제 머~언 미래에",
        "멋진 ai가 만들어 지는 공장이 있었다.",
        "사람들에게 도움을 주는 ai가 되기 위해서 보스들을 물리치러 가는데....!"
    ];

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    ctx.fillStyle = 'black';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    
    if (storyPage < storyText.length) {
        ctx.fillText(storyText[storyPage], STAGE_WIDTH / 2, STAGE_HEIGHT / 2);
    }

    ctx.font = '16px Arial';
    ctx.fillText('(화면을 터치하여 계속)', STAGE_WIDTH / 2, STAGE_HEIGHT - 50);
    ctx.textAlign = 'left'; // Reset alignment for other functions
}

// --- 메뉴 로직 ---
function updateMenuLogic() {
    // 메뉴에서는 특별한 로직 없음
}

function drawMenu() {
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('필살기 선택', STAGE_WIDTH / 2, 80);
    ctx.font = '16px Arial';
    ctx.fillText('장착할 필살기를 클릭하세요.', STAGE_WIDTH / 2, 120);

    Object.keys(ultimates).forEach((id, index) => {
        const ult = ultimates[id];
        const ultButton = { x: 250, y: 150 + index * 60, width: 300, height: 50 };

        ctx.strokeStyle = player.equippedUltimate === id ? 'yellow' : 'white';
        ctx.lineWidth = player.equippedUltimate === id ? 4 : 2;
        ctx.globalAlpha = ult.purchased ? 1.0 : 0.5;

        ctx.strokeRect(ultButton.x, ultButton.y, ultButton.width, ultButton.height);

        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(ult.name, ultButton.x + 10, ultButton.y + 20);
        ctx.font = '12px Arial';
        ctx.fillText(ult.description, ultButton.x + 10, ultButton.y + 40);

        if (!ult.purchased) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'right';
            ctx.fillStyle = 'red';
            ctx.fillText(`잠김`, ultButton.x + ultButton.width - 10, ultButton.y + 30);
            ctx.fillStyle = 'white';
        }
        ctx.globalAlpha = 1.0;
    });
    ctx.textAlign = 'center';

    // 마을 가기 버튼
    const villageButton = { x: STAGE_WIDTH / 2 - 75, y: STAGE_HEIGHT - 80, width: 150, height: 40 };
    ctx.fillStyle = '#8f8';
    ctx.fillRect(villageButton.x, villageButton.y, villageButton.width, villageButton.height);
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText('마을로 가기', STAGE_WIDTH / 2, STAGE_HEIGHT - 55);

    ctx.textAlign = 'left';
}

// --- 스테이지 로직 ---
function updateStageLogic() {
    const currentStageData = stages[stage - 1];

    if (stage === 7) {
        isGroundSlippery = true;
        if (isBossFight && !boss) { // 보스러시 중 보스가 죽으면
            currentBossIndex++;
            if (currentBossIndex < stage7BossRush.length) {
                // 잠시 후 다음 보스 등장
                setTimeout(() => {
                    stage7BossRush[currentBossIndex]();
                }, 2000);
            } else {
                nextStage(); // 모든 보스 클리어
            }
        }
    } else {
        isGroundSlippery = false;
        if (currentStageData.type === 'boss' && !isBossFight) {
            gameTimer += 1 / 60;
            if (gameTimer >= currentStageData.bossSpawnTime) {
                isBossFight = true;
                enemies.length = 0;
                createBoss();
            }
        }
    }

    player.update();

    let speedMultiplier = 1;
    if (isUltimateActive && player.equippedUltimate === 'time_warp') {
        speedMultiplier = 0.3;
    }

    checkStageCollisions();

    for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        if (l.direction === 'right') {
            l.x += LASER_SPEED;
        } else if (l.direction === 'left') {
            l.x -= LASER_SPEED;
        } else if (l.direction === 'up') {
            l.y -= LASER_SPEED;
        }

        if (l.x > STAGE_WIDTH || l.x < 0 || l.y < 0) {
            lasers.splice(i, 1);
        }
    }

    // Enemy spawning logic
    if (!isBossFight) {
        const maxEnemies = (currentStageData.type === 'kill') ? 5 : 3;
        if (frameCount % 80 === 0 && enemies.length < maxEnemies) {
             createEnemy();
        }
    }
    
    enemies.forEach(e => e.update(speedMultiplier));
    for (let i = enemies.length - 1; i >= 0; i--) { if (enemies[i].x + enemies[i].width < 0) enemies.splice(i, 1); }
    
    if (isBossFight && boss) { 
        boss.update(); 
    }
    
    bubbles.forEach((b, i) => {
        b.x -= b.speed;
        if (b.x < -b.width) bubbles.splice(i, 1);
    });
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        const p = bossProjectiles[i];
        p.update(speedMultiplier);
        if (p.x < -p.width || p.x > STAGE_WIDTH || p.y < -p.height || p.y > STAGE_HEIGHT) bossProjectiles.splice(i, 1);
    }
    lightningZones.forEach(z => z.update());
    for (let i = residualElectrics.length - 1; i >= 0; i--) {
        const r = residualElectrics[i];
        r.update();
        if (r.timer <= 0) residualElectrics.splice(i, 1);
    }
    for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i];
        f.update();
        if (f.timer <= 0) fires.splice(i, 1);
    }

    if (isUltimateActive) {
        ultimateTimer -= 1 / 60;
        if (player.equippedUltimate === 'damage') {
             for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    enemies.splice(i, 1);
                }
            }
        }
        if (ultimateTimer <= 0) { isUltimateActive = false; ultimateGauge = 0; }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        if (p.radius > 0.2) p.radius -= 0.1;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function checkStageCollisions() {
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(laser, enemies[j])) {
                if (isUltimateActive && player.equippedUltimate === 'vampiric_aura') {
                    player.hp = Math.min(player.maxHp, player.hp + 1);
                }
                createSparkEffect(laser.x, laser.y); // 스파크 효과
                enemies.splice(j, 1);
                lasers.splice(i, 1);
                ultimateGauge = Math.min(100, ultimateGauge + 10);
                player.coins += 10;
                player.enemyKillCount++;

                const currentStageData = stages[stage - 1];
                if (currentStageData.type === 'kill' && player.enemyKillCount >= currentStageData.killGoal) {
                    nextStage();
                }
                break;
            }
        }
    }
    if (isBossFight && boss) {
        for (let i = lasers.length - 1; i >= 0; i--) {
            const laser = lasers[i];
            if (isColliding(laser, boss)) {
                boss.hp -= 10;
                createSparkEffect(laser.x, laser.y); // 스파크 효과
                lasers.splice(i, 1);
                if (boss.hp <= 0) {
                    player.coins += 500;
                    boss = null; // 보스 사망 처리
                    if (stage !== 7) {
                        nextStage();
                    }
                }
                break;
            }
        }
    }
    for (const enemy of enemies) { if (isColliding(player, enemy)) player.takeDamage(); }
    for (const p of bossProjectiles) { if (isColliding(player, p)) player.takeDamage(); }
    for (let i = bubbles.length - 1; i >= 0; i--) {
        if (isColliding(player, bubbles[i])) {
            player.knockback(50);
            bubbles.splice(i, 1);
        }
    }
    for (const fire of fires) { if(isColliding(player, fire)) player.takeDamage(); }
}

function drawStage() {
    const currentStage = stages[stage - 1];
    currentStage.drawBackground();

    player.draw();
    enemies.forEach(e => e.draw());
    if (isBossFight && boss) boss.draw();
    bossProjectiles.forEach(p => p.draw());
    lightningZones.forEach(z => z.draw());
    residualElectrics.forEach(r => r.draw());
    fires.forEach(f => f.draw());
    bubbles.forEach(b => {
        ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
        ctx.beginPath();
        ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = '#00ff00';
    lasers.forEach(l => ctx.fillRect(l.x, l.y, l.width, l.height));

    // Draw particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life / p.startLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    drawStageUI();
}

function drawStage1Background() {
    ctx.fillStyle = '#87CEEB'; // 하늘
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);
    // 산
    ctx.fillStyle = '#a9a9a9';
    const mountainX = -(backgroundX * 0.2 % STAGE_WIDTH);
    ctx.beginPath();
    ctx.moveTo(mountainX, STAGE_HEIGHT - GROUND_HEIGHT - 50);
    ctx.lineTo(mountainX + 150, STAGE_HEIGHT - GROUND_HEIGHT - 150);
    ctx.lineTo(mountainX + 300, STAGE_HEIGHT - GROUND_HEIGHT - 100);
    ctx.lineTo(mountainX + 500, STAGE_HEIGHT - GROUND_HEIGHT - 200);
    ctx.lineTo(mountainX + 650, STAGE_HEIGHT - GROUND_HEIGHT - 120);
    ctx.lineTo(mountainX + 800, STAGE_HEIGHT - GROUND_HEIGHT - 180);
    ctx.lineTo(mountainX + STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT - 50);
    ctx.lineTo(mountainX + STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(mountainX, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mountainX + STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT - 50);
    ctx.lineTo(mountainX + STAGE_WIDTH + 150, STAGE_HEIGHT - GROUND_HEIGHT - 150);
    ctx.lineTo(mountainX + STAGE_WIDTH + 300, STAGE_HEIGHT - GROUND_HEIGHT - 100);
    ctx.lineTo(mountainX + STAGE_WIDTH + 500, STAGE_HEIGHT - GROUND_HEIGHT - 200);
    ctx.lineTo(mountainX + STAGE_WIDTH + 650, STAGE_HEIGHT - GROUND_HEIGHT - 120);
    ctx.lineTo(mountainX + STAGE_WIDTH + 800, STAGE_HEIGHT - GROUND_HEIGHT - 180);
    ctx.lineTo(mountainX + STAGE_WIDTH * 2, STAGE_HEIGHT - GROUND_HEIGHT - 50);
    ctx.lineTo(mountainX + STAGE_WIDTH * 2, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(mountainX + STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();
    // 땅
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}

function drawStage2Background() {
    ctx.fillStyle = '#2c3e50'; // 어두운 밤하늘
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);

    // 성 그리기
    const castleX = STAGE_WIDTH / 2 - 200 - (backgroundX * 0.3);
    ctx.fillStyle = '#596275';
    ctx.fillRect(castleX, STAGE_HEIGHT - GROUND_HEIGHT - 250, 400, 250);
    // 탑
    ctx.fillRect(castleX - 50, STAGE_HEIGHT - GROUND_HEIGHT - 300, 80, 300);
    ctx.fillRect(castleX + 370, STAGE_HEIGHT - GROUND_HEIGHT - 300, 80, 300);
    // 창문
    ctx.fillStyle = 'yellow';
    for(let i=0; i<4; i++) {
        for(let j=0; j<3; j++) {
            ctx.fillRect(castleX + 20 + i * 100, STAGE_HEIGHT - GROUND_HEIGHT - 220 + j * 70, 20, 30);
        }
    }
    // 땅
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}

function drawStage3Background() {
    ctx.fillStyle = '#1abc9c'; // 바다색
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    // 파도
    for (let i = 0; i < 2; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + i * 0.1})`;
        ctx.beginPath();
        const waveY = STAGE_HEIGHT - GROUND_HEIGHT - 60 + i * 20;
        ctx.moveTo(0, waveY);
        for (let x = 0; x < STAGE_WIDTH; x++) {
            ctx.lineTo(x, waveY + Math.sin((x + frameCount) * 0.05 + i) * 10);
        }
        ctx.lineTo(STAGE_WIDTH, STAGE_HEIGHT);
        ctx.lineTo(0, STAGE_HEIGHT);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = '#f1c40f'; // 모래사장
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}

function drawStage5Background() {
    // Dark sky
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);

    // Distant dark castle silhouette
    const castleX = STAGE_WIDTH / 2 - 300 - (backgroundX * 0.1);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(castleX, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(castleX + 50, STAGE_HEIGHT - GROUND_HEIGHT - 200);
    ctx.lineTo(castleX + 100, STAGE_HEIGHT - GROUND_HEIGHT - 150);
    ctx.lineTo(castleX + 150, STAGE_HEIGHT - GROUND_HEIGHT - 250);
    ctx.lineTo(castleX + 200, STAGE_HEIGHT - GROUND_HEIGHT - 180);
    ctx.lineTo(castleX + 250, STAGE_HEIGHT - GROUND_HEIGHT - 300); // Main tower
    ctx.lineTo(castleX + 300, STAGE_HEIGHT - GROUND_HEIGHT - 180);
    ctx.lineTo(castleX + 350, STAGE_HEIGHT - GROUND_HEIGHT - 250);
    ctx.lineTo(castleX + 400, STAGE_HEIGHT - GROUND_HEIGHT - 150);
    ctx.lineTo(castleX + 450, STAGE_HEIGHT - GROUND_HEIGHT - 200);
    ctx.lineTo(castleX + 500, STAGE_HEIGHT - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Spooky trees
    for (let i = 0; i < 5; i++) {
        const treeX = (i * 250 - (backgroundX * 0.8 % 250)) % STAGE_WIDTH;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(treeX, STAGE_HEIGHT - GROUND_HEIGHT - 100, 10, 100);
        ctx.beginPath();
        ctx.arc(treeX + 5, STAGE_HEIGHT - GROUND_HEIGHT - 100, 30, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    // Ground
    ctx.fillStyle = '#333';
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}

function drawStage6Background() {
    ctx.fillStyle = '#87CEEB'; // 하늘
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT - GROUND_HEIGHT);
    // 땅
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}

function drawStage7Background() {
    // 어두운 성 내부
    ctx.fillStyle = '#1a1a2e'; // 매우 어두운 남색
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // 배경에 창문 추가
    for (let i = 0; i < 3; i++) {
        const windowX = 150 + i * 250 - (backgroundX * 0.2 % 250);
        const windowY = 150;
        ctx.fillStyle = '#f1c40f'; // 창문 빛
        ctx.beginPath();
        ctx.arc(windowX, windowY, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(windowX, windowY - 50);
        ctx.lineTo(windowX - 100, STAGE_HEIGHT);
        ctx.lineTo(windowX + 100, STAGE_HEIGHT);
        ctx.closePath();
        ctx.fill();
    }

    // 바닥
    ctx.fillStyle = '#000000'; // 검은색 바닥
    ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
}


function drawStageUI() {
    ctx.fillStyle = 'gray'; ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = 'yellow'; ctx.fillRect(10, 10, ultimateGauge * 2, 20);
    ctx.strokeStyle = 'white'; ctx.strokeRect(10, 10, 200, 20);
    ctx.fillStyle = 'white'; ctx.font = '20px Arial';

    const currentStageData = stages[stage - 1];
    if (currentStageData.type === 'kill') {
        ctx.fillText(`Kills: ${player.enemyKillCount} / ${currentStageData.killGoal}`, STAGE_WIDTH / 2 - 50, 30);
    } else if (stage !== 7) {
        const minutes = Math.floor(gameTimer / 60), seconds = Math.floor(gameTimer % 60);
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, STAGE_WIDTH - 70, 30);
    }
    
    ctx.fillText(`Stage: ${stage}`, 10, 30);
    if (stage === 7) {
        ctx.fillText(`마을 방문 가능: ${villageVisitCount}번`, STAGE_WIDTH / 2 - 100, 60);
        if (boss) {
            let bossName = `Boss ${currentBossIndex + 1}`;
            if (currentBossIndex === stage7BossRush.length - 1) {
                bossName = "FINAL BOSS";
            }
            ctx.fillText(bossName, STAGE_WIDTH / 2 - 50, 30);
        }
    }
    ctx.fillStyle = 'red';
    for (let i = 0; i < player.hp; i++) ctx.fillRect(10 + i * 35, 40, 30, 30);
    ctx.fillStyle = 'gold'; ctx.fillText(`Coins: ${player.coins}`, 10, 100);
    ctx.fillStyle = 'lightblue'; ctx.fillText(`Potions: ${player.inventory.potions} (P)`, 10, 130);
    if (quest.isActive && !quest.isComplete) {
        ctx.fillStyle = 'orange';
        ctx.fillText(`${quest.title}: ${player.enemyKillCount} / ${quest.goal}`, 10, 160);
    }
    if (isBossFight && boss) {
        ctx.fillStyle = 'gray'; ctx.fillRect(STAGE_WIDTH / 2 - 150, 10, 300, 20);
        ctx.fillStyle = 'red'; ctx.fillRect(STAGE_WIDTH / 2 - 150, 10, (boss.hp / boss.maxHp) * 300, 20);
        ctx.strokeStyle = 'white'; ctx.strokeRect(STAGE_WIDTH / 2 - 150, 10, 300, 20);
    }
    ctx.fillStyle = '#888'; ctx.fillRect(STAGE_WIDTH - 120, 10, 110, 30);
    ctx.fillStyle = 'white'; ctx.font = '16px Arial'; ctx.fillText('마을로 가기', STAGE_WIDTH - 110, 30);

    // Credit text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('승재가 만듬', STAGE_WIDTH - 10, STAGE_HEIGHT - 10);
    ctx.textAlign = 'left'; // Reset alignment
}

// --- 마을 로직 ---
function updateVillageLogic() {
    player.update();
    player.crouch(keys.down);
    if (keys.e) {
        if (activeUI) { activeUI = null; }
        else {
            if (isColliding(player, npcs.villageChief)) activeUI = 'quest';
            else if (isColliding(player, npcs.merchant)) activeUI = 'shop';
            else if (isColliding(player, npcs.radio)) toggleRadio();
        }
        keys.e = false;
    }
}

function drawVillage() {
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    // 아파트 배경 그리기
    ctx.fillStyle = '#1e272e'; // 밤하늘
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    for(let i = 0; i < 5; i++) {
        const aptX = i * 200 - (backgroundX * 0.1 % 200);
        const aptHeight = 200 + Math.sin(i) * 50;
        ctx.fillStyle = '#34495e';
        ctx.fillRect(aptX, STAGE_HEIGHT - GROUND_HEIGHT - aptHeight, 150, aptHeight);
        // 창문
        ctx.fillStyle = '#f1c40f';
        for(let y = 0; y < aptHeight - 30; y += 40) {
            for(let x = 0; x < 120; x += 40) {
                if(Math.random() > 0.3) {
                     ctx.fillRect(aptX + 15 + x, STAGE_HEIGHT - GROUND_HEIGHT - aptHeight + 20 + y, 20, 20);
                }
            }
        }
    }


    ctx.fillStyle = '#664422'; ctx.fillRect(0, STAGE_HEIGHT - GROUND_HEIGHT, STAGE_WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = npcs.villageChief.color; ctx.fillRect(npcs.villageChief.x, npcs.villageChief.y, npcs.villageChief.width, npcs.villageChief.height);
    ctx.fillStyle = 'white'; ctx.fillText('이장', npcs.villageChief.x + 10, npcs.villageChief.y - 10);
    ctx.fillStyle = npcs.merchant.color; ctx.fillRect(npcs.merchant.x, npcs.merchant.y, npcs.merchant.width, npcs.merchant.height);
    ctx.fillStyle = 'white'; ctx.fillText('상인', npcs.merchant.x + 10, npcs.merchant.y - 10);
    
    // 라디오 그리기
    const radio = npcs.radio;
    ctx.fillStyle = radio.color; 
    ctx.fillRect(radio.x, radio.y, radio.width, radio.height);
    ctx.fillStyle = '#333';
    ctx.fillRect(radio.x + 5, radio.y + 5, radio.width - 10, 10);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('라디오', radio.x, radio.y - 5);

    player.draw();
    ctx.fillStyle = 'white'; ctx.font = '20px Arial';
    ctx.fillText('마을 (E키로 상호작용)', 20, 60);
    ctx.fillText(`Coins: ${player.coins}`, 20, 90);
    ctx.fillStyle = '#888';
    ctx.fillRect(20, 10, 120, 30);
    ctx.fillRect(STAGE_WIDTH - 140, 10, 120, 30);
    ctx.fillStyle = 'white'; ctx.font = '16px Arial';
    ctx.fillText('메뉴로 가기', 30, 30);
    ctx.fillText('스테이지로 가기', STAGE_WIDTH - 130, 30);
}

// --- UI 로직 (퀘스트, 상점) ---
function drawQuestUI() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(200, 150, 400, 200);
    ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText('이장의 퀘스트', 400, 180);
    if (!quest.isActive) {
        ctx.fillText(quest.title, 400, 220);
        ctx.fillText(`보상: ${quest.reward} 코인`, 400, 250);
        ctx.fillStyle = '#8f8'; ctx.fillRect(350, 280, 100, 30);
        ctx.fillStyle = 'black'; ctx.fillText('수락', 400, 300);
    } else if (player.enemyKillCount < quest.goal) {
        ctx.fillText(`진행 상황: ${player.enemyKillCount} / ${quest.goal}`, 400, 220);
    } else {
        ctx.fillText('퀘스트 완료! 보상을 받으세요.', 400, 250);
        if (!quest.isComplete) { 
            quest.isComplete = true;
            player.coins += quest.reward;
        }
    }
    ctx.font = '16px Arial'; ctx.fillText('(E키를 누르면 닫기)', 400, 340);
    ctx.textAlign = 'left';
}

function drawShopUI() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(200, 150, 400, 350);
    ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
    ctx.fillText('상점', 400, 180);

    let itemY = 220;
    // 소모품
    const potion = shopConsumables.potion;
    ctx.fillStyle = '#9f9'; ctx.fillRect(250, itemY, 300, 30);
    ctx.fillStyle = 'black'; ctx.fillText(`${potion.name} (${potion.price} 코인)`, 400, itemY + 20);
    itemY += 60;

    // 필살기
    ctx.fillStyle = 'white'; ctx.fillText('--- 필살기 해금 ---', 400, itemY - 10);
    Object.keys(ultimates).forEach(id => {
        const ult = ultimates[id];
        if (ult.price > 0) {
            if (ult.purchased) {
                ctx.fillStyle = '#555';
                ctx.fillRect(250, itemY, 300, 30);
                ctx.fillStyle = '#aaa';
                ctx.fillText(`${ult.name} (보유 중)`, 400, itemY + 20);
            } else {
                ctx.fillStyle = '#aaf';
                ctx.fillRect(250, itemY, 300, 30);
                ctx.fillStyle = 'white';
                ctx.fillText(`${ult.name} (${ult.price} 코인)`, 400, itemY + 20);
            }
            itemY += 40;
        }
    });
    ctx.font = '16px Arial'; ctx.fillText('(클릭하여 구매, E키를 누르면 닫기)', 400, 530);
    ctx.textAlign = 'left';
}

function buyItem(item, id) {
    if (player.coins >= item.price) {
        player.coins -= item.price;
        if(item.type === 'consumable') {
            if(item.id === 'potion') player.inventory.potions++;
        } else if (item.type === 'ultimate') {
            ultimates[id].purchased = true;
        }
        alert(`${item.name}을(를) 구매했습니다!`);
    } else {
        alert('코인이 부족합니다.');
    }
}

function acceptQuest() {
    if (!quest.isActive) {
        quest.isActive = true;
        player.enemyKillCount = 0; // 퀘스트 수락 시 킬 카운트 초기화
        alert('퀘스트를 수락했습니다.');
        activeUI = null;
    }
}

// ====================================================================
//                         게임 관리 함수
// ====================================================================
function isColliding(rect1, rect2) {
    if (!rect1 || !rect2) return false;
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}

let audioCtx;
let isRadioPlaying = false;

function playRecorderSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (isRadioPlaying) {
        isRadioPlaying = false;
        return;
    }
    isRadioPlaying = true;

    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C4 to C5
    let noteIndex = 0;

    function playNote() {
        if (!isRadioPlaying || noteIndex >= notes.length) {
            isRadioPlaying = false;
            return;
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine'; // 리코더와 비슷한 음색
        oscillator.frequency.setValueAtTime(notes[noteIndex], audioCtx.currentTime);
        
        const noise = audioCtx.createBufferSource();
        const bufferSize = audioCtx.sampleRate * 0.5; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 0.02 - 0.01;
        }
        noise.buffer = buffer;
        noise.loop = true;

        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);

        oscillator.connect(gainNode);
        noise.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
        noise.start();
        noise.stop(audioCtx.currentTime + 0.5);

        noteIndex++;
        setTimeout(playNote, 300); 
    }

    playNote();
}

function toggleRadio() {
    playRecorderSound();
}

function nextStage() {
    stage++;
    if (stage > stages.length) {
        alert("축하합니다! 모든 스테이지를 클리어했습니다!");
        goToMenu();
        stage = 1; // 다시 시작
        villageVisitCount = 3; // 7스테이지 재도전을 위해 초기화
        return;
    }

    isBossFight = false;
    boss = null;
    gameTimer = 0;
    enemies.length = 0;
    bossProjectiles.length = 0;
    lightningZones.length = 0;
    residualElectrics.length = 0;
    bubbles.length = 0;
    fires.length = 0;
    isGroundSlippery = false;
    if (!quest.isActive) {
        player.enemyKillCount = 0;
    }
    
    alert(`Stage ${stage} Start!`);
    goToStage();
}

function goToMenu() { gameState = 'menu'; activeUI = null; }
function goToVillage() { 
    if (stage === 7) {
        if (villageVisitCount > 0) {
            villageVisitCount--;
            gameState = 'village';
            activeUI = null;
            if (villageVisitCount === 0) {
                alert("이제 더 이상 마을로 돌아갈 수 없습니다.");
            }
        } else {
            alert("마을로 돌아갈 수 없습니다.");
            return;
        }
    } else {
        gameState = 'village'; 
        activeUI = null; 
    }
}
function goToStage() { 
    gameState = 'stage'; 
    gameTimer = 0; 
    player.x = 100; 
    player.y = STAGE_HEIGHT - GROUND_HEIGHT - 100; 
    activeUI = null; 
    const currentStageData = stages[stage - 1];
    if(currentStageData.type === 'boss' && currentStageData.bossSpawnTime === 0) {
        isBossFight = true;
        boss = null; // 보스 초기화
        enemies.length = 0;
        bossProjectiles.length = 0;
        currentStageData.createBoss();
    }
}
function gameOver() { alert("Game Over"); document.location.reload(); }

function gameLoop() {
    frameCount++;
    updateLogic();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();


