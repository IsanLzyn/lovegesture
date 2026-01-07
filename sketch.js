let handData = [];
let particles = [];
let capture; 
const numParticles = 400; 
let wasActive = false;
let currentMode = ""; 

// Konfigurasi Kamera Kecil
const camW = 200; 
const camH = 150; 
const margin = 20;

function setup() {
    createCanvas(windowWidth, windowHeight);
    
    capture = createCapture(VIDEO);
    capture.size(640, 480);
    capture.hide(); 

    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(i));
    }

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2, 
        modelComplexity: 1,
        minDetectionConfidence: 0.7, 
        minTrackingConfidence: 0.7
    });

    hands.onResults(results => { 
        handData = results.multiHandLandmarks; 
    });

    const camera = new Camera(capture.elt, {
        onFrame: async () => {
            await hands.send({image: capture.elt});
        },
        width: 640, height: 480
    });
    camera.start();
}

function draw() {
    background(0, 150); 

    // --- RENDER KAMERA KECIL & SKELETON ---
    push();
    translate(margin + camW, margin);
    scale(-1, 1);
    image(capture, 0, 0, camW, camH);
    
    // Gambar garis tangan di atas kamera kecil
    if (handData && handData.length > 0) {
        drawSkeleton();
    }
    pop();
    
    noFill();
    stroke(255, 100);
    rect(margin, margin, camW, camH);

    // --- LOGIKA DETEKSI UNTUK PARTIKEL ---
    let targetX = width/2, targetY = height/2;
    let isActive = false;
    currentMode = "";

    if (handData && handData.length > 0) {
        if (handData.length === 2) {
            let x1 = (1 - handData[0][8].x) * width;
            let y1 = handData[0][8].y * height;
            let x2 = (1 - handData[1][8].x) * width;
            let y2 = handData[1][8].y * height;
            if (dist(x1, y1, x2, y2) < 250) { 
                currentMode = "LOVE";
                targetX = (x1 + x2) / 2; targetY = (y1 + y2) / 2; isActive = true;
            }
        }

        if (!isActive && handData.length === 1) {
            let hand = handData[0];
            let indexUp = hand[8].y < hand[6].y;
            let middleUp = hand[12].y < hand[10].y;
            let ringDown = hand[16].y > hand[14].y;
            let pinkyDown = hand[20].y > hand[18].y;

            targetX = (1 - hand[8].x) * width;
            targetY = hand[8].y * height;

            if (indexUp && !middleUp && ringDown && pinkyDown) {
                currentMode = "I"; isActive = true;
            } else if (indexUp && middleUp && ringDown && pinkyDown) {
                currentMode = "YOU"; isActive = true;
            }
        }
    }

    // Update & Show Partikel
    if (wasActive && !isActive) { for (let p of particles) p.scatter(); }
    for (let p of particles) {
        if (isActive) {
            if (currentMode === "LOVE") p.formLove(targetX, targetY);
            else if (currentMode === "I") p.formI(targetX, targetY);
            else if (currentMode === "YOU") p.formYOU(targetX, targetY);
        } else { p.fall(); }
        p.update(); p.show(isActive);
    }
    wasActive = isActive;
}

// Fungsi untuk menggambar garis sendi tangan
function drawSkeleton() {
    strokeWeight(2);
    for (let hand of handData) {
        // Tentukan warna garis berdasarkan mode
        if (currentMode === "LOVE") stroke(255, 50, 150);
        else if (currentMode === "I") stroke(0, 200, 255);
        else if (currentMode === "YOU") stroke(255, 255, 0);
        else stroke(255, 200); // Putih jika tidak ada pose

        // Hubungan antar sendi (MediaPipe Hand Connections)
        const connections = [
            [0,1], [1,2], [2,3], [3,4], // Jempol
            [0,5], [5,6], [6,7], [7,8], // Telunjuk
            [5,9], [9,10], [10,11], [11,12], // Tengah
            [9,13], [13,14], [14,15], [15,16], // Manis
            [13,17], [17,18], [18,19], [19,20], [0,17] // Kelingking
        ];

        for (let conn of connections) {
            let start = hand[conn[0]];
            let end = hand[conn[1]];
            line(start.x * camW, start.y * camH, end.x * camW, end.y * camH);
        }
        
        // Gambar titik sendi
        fill(255);
        noStroke();
        for (let pt of hand) {
            circle(pt.x * camW, pt.y * camH, 4);
        }
    }
}

class Particle {
    constructor(id) {
        this.id = id;
        this.pos = createVector(random(width), random(height));
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.maxSpeed = 32; this.maxForce = 4.0; 
    }
    scatter() { this.applyForce(p5.Vector.random2D().mult(random(40, 80))); }
    formLove(tx, ty) {
        let t = map(this.id, 0, numParticles, 0, TWO_PI);
        let x = 16 * pow(sin(t), 3);
        let y = -(13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t));
        this.applySteer(tx + x * 10, ty + y * 10);
    }
    formI(tx, ty) {
        let y = map(this.id, 0, numParticles, -120, 120);
        this.applySteer(tx, ty + y);
    }
    formYOU(tx, ty) {
        let section = this.id % 3;
        let subId = floor(this.id / 3);
        let pPerLetter = numParticles / 3;
        let ox = 0, oy = 0;
        if (section === 0) { // Y
            ox = -120;
            if (subId < pPerLetter/2) { ox += map(subId, 0, pPerLetter/2, -40, 0); oy = map(subId, 0, pPerLetter/2, -70, 0); }
            else if (subId < pPerLetter*0.8) { ox += map(subId, pPerLetter/2, pPerLetter*0.8, 40, 0); oy = map(subId, pPerLetter/2, pPerLetter*0.8, -70, 0); }
            else { oy = map(subId, pPerLetter*0.8, pPerLetter, 0, 70); }
        } else if (section === 1) { // O
            let angle = map(subId, 0, pPerLetter, 0, TWO_PI);
            ox = cos(angle) * 45; oy = sin(angle) * 70;
        } else if (section === 2) { // U
            ox = 120;
            let a = map(subId, 0, pPerLetter, 0, PI);
            ox += cos(a) * 45; oy = sin(a) * 60;
            if (subId < pPerLetter/3) { ox = 120-45; oy = map(subId, 0, pPerLetter/3, -70, 0); }
            else if (subId > (pPerLetter/3)*2) { ox = 120+45; oy = map(subId, (pPerLetter/3)*2, pPerLetter, 0, -70); }
        }
        this.applySteer(tx + ox, ty + oy);
    }
    applySteer(tx, ty) {
        let target = createVector(tx, ty);
        let desired = p5.Vector.sub(target, this.pos);
        let d = desired.mag();
        let speed = this.maxSpeed;
        if (d < 100) speed = map(d, 0, 100, 0, this.maxSpeed);
        desired.setMag(speed);
        let steer = p5.Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        this.applyForce(steer);
    }
    fall() { this.applyForce(createVector(0, 0.4)); this.vel.mult(0.9); }
    applyForce(f) { this.acc.add(f); }
    update() {
        this.vel.add(this.acc); this.pos.add(this.vel); this.acc.mult(0);
        if (this.pos.y > height + 20) this.pos.y = -20;
    }
    show(active) {
        if (active) {
            if (currentMode === "LOVE") stroke(255, 50, 150);
            else if (currentMode === "I") stroke(0, 200, 255);
            else stroke(255, 255, 0);
            strokeWeight(6);
        } else { stroke(255, 120); strokeWeight(2.5); }
        point(this.pos.x, this.pos.y);
    }

}
