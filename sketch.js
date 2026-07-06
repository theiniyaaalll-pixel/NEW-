/*
 * Cosmic Bioluminescent Particle Swarm
 * (2D implementation for smooth fading trails and glow blending)
 */

let handPose;
let video;
let hands = [];

// Particles
let particles = [];
const NUM_PARTICLES = 18000; // Massive count for full-screen density

// Target values for smoothing (Hand position)
let targetPosX = 0;
let targetPosY = 0;
let targetScale = 100; // Used for audio/particle behavior

// Current Position & Scale
let posX = 0;
let posY = 0;
let currentBaseSize = 100;

// Gesture State
let fistStartTime = 0;
let isScreenshotTaken = false;

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  pixelDensity(1); 
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  
  // Set initial black background
  background(0);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);

  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(new Particle());
  }
}

function mousePressed() {
  // Start audio context on the first user interaction
  if (typeof initAudio === 'function') {
    initAudio().then(() => {
      console.log("Audio Initialized.");
    }).catch(e => console.error(e));
  }
}

function draw() {
  // Blend mode for fading the trails
  blendMode(BLEND);
  noStroke();
  fill(0, 0, 0, 15); // Slightly faster fade to keep trails short and defined
  rect(0, 0, width, height);

  // --- Hand Control Logic ---
  if (hands.length > 0) {
    let hand1 = hands[0];

    if (hand1.keypoints && hand1.keypoints[8]) {
      let indexTip1 = hand1.keypoints[8];
      let hx = indexTip1.x / video.width;
      let hy = indexTip1.y / video.height;

      // Position Mapping (2D: Origin is top-left. We mirror X for natural interaction)
      targetPosX = map(hx, 0, 1, width, 0);
      targetPosY = map(hy, 0, 1, 0, height);

      // Scaling (Single Hand: Thumb to Pinky)
      if (hand1.keypoints[4] && hand1.keypoints[20]) {
        let span = dist(hand1.keypoints[4].x, hand1.keypoints[4].y, hand1.keypoints[20].x, hand1.keypoints[20].y);
        targetScale = map(span, 30, 200, 50, 400);
        targetScale = constrain(targetScale, 50, 600);
      }

      // Proximity for Volume Control
      let handSize = 0;
      if (hand1.keypoints[0] && hand1.keypoints[9]) {
        handSize = dist(hand1.keypoints[0].x, hand1.keypoints[0].y, hand1.keypoints[9].x, hand1.keypoints[9].y);
      }

      if (typeof updateAudioInteraction === 'function') {
        updateAudioInteraction(indexTip1.x, indexTip1.y, video.height, currentBaseSize, handSize);
      }

      // Screenshot Gesture Detection
      let rightHand = hands.find(h => h.handedness === "Right");
      if (rightHand) {
        if (isFist(rightHand)) {
          if (fistStartTime === 0) {
            fistStartTime = millis();
            isScreenshotTaken = false;
          } else if (millis() - fistStartTime > 1500 && !isScreenshotTaken) {
            takeScreenshot();
            isScreenshotTaken = true;
          }
        } else {
          fistStartTime = 0;
          isScreenshotTaken = false;
        }
      } else {
        fistStartTime = 0;
      }

      if (typeof updateDroneState === 'function') {
        updateDroneState(true);
      }
    }
  } else {
    if (typeof updateDroneState === 'function') {
      updateDroneState(false);
    }
  }

  // Smooth Interpolation
  posX = lerp(posX, targetPosX, 0.15); 
  posY = lerp(posY, targetPosY, 0.15);
  currentBaseSize = lerp(currentBaseSize, targetScale, 0.05);

  // We switch to ADD blend mode for the particles to create that cosmic glowing look
  blendMode(ADD);

  // Render and Update Particles
  for (let p of particles) {
    p.drift(); 
    if (hands.length > 0) {
      p.disturb(posX, posY, currentBaseSize); 
    }
    p.update();
    p.show();
  }
}

function gotHands(results) {
  if (results) {
    hands = results;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0); // Reset background on resize
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(random(0.5, 2));
    this.acc = createVector();
    this.maxSpeed = random(2, 4); // Base drifting speed
    this.maxForce = 0.8;
  }
  
  disturb(tx, ty, scaleFactor) {
    let handPos = createVector(tx, ty); 
    let desired = p5.Vector.sub(this.pos, handPos); 
    let d = desired.mag();
    
    let effectRadius = map(scaleFactor, 50, 400, 200, 600);
    
    if (d < effectRadius) {
      desired.normalize();
      
      // Create swirling eddies (vortex effect) using 2D cross product equivalent (-y, x)
      let swirl = createVector(-desired.y, desired.x);
      
      let eddyNoise = noise(this.pos.x * 0.005, this.pos.y * 0.005) - 0.5;
      swirl.mult(eddyNoise * 6); // Strong swirl factor for turbulence
      
      desired.add(swirl).normalize();
      
      let force = map(d, 0, effectRadius, this.maxSpeed * 6, 0);
      desired.mult(force);
      
      let steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce * 2); 
      
      this.acc.add(steer);
    }
  }
  
  drift() {
    let noiseScale = 0.003;
    // Map noise to an angle to create a smooth, continuous flow field
    let angle = noise(this.pos.x * noiseScale, this.pos.y * noiseScale, frameCount * 0.002) * TWO_PI * 4;
    
    // Create a vector from that angle
    let flow = p5.Vector.fromAngle(angle);
    flow.mult(0.3); // Strength of the base drift
    
    this.acc.add(flow);
    
    // Smoothly wrap around screen edges
    if (this.pos.x < -50) this.pos.x = width + 50;
    if (this.pos.x > width + 50) this.pos.x = -50;
    if (this.pos.y < -50) this.pos.y = height + 50;
    if (this.pos.y > height + 50) this.pos.y = -50;
  }

  update() {
    this.vel.add(this.acc);
    // Add friction so high speeds from disturbance decay naturally and smoothly
    this.vel.mult(0.92);
    
    this.pos.add(this.vel);
    this.acc.mult(0); 
    
    // Respawn randomly to maintain uniform density across the screen and prevent empty spots
    if (random(1) < 0.005) { // 0.5% chance to respawn every frame
      this.pos = createVector(random(width), random(height));
      this.vel = p5.Vector.random2D().mult(random(0.5, 2));
    }
  }

  show() {
    let speed = this.vel.mag();
    
    // Bioluminescent coloring (Slow = Green/Cyan, Fast = Orange/Pink)
    let hueTarget = map(speed, 0, this.maxSpeed * 3, 160, 390); // 160 is more green
    let particleHue = hueTarget % 360;
    
    let sat = map(speed, 0, this.maxSpeed * 2, 70, 100);
    let bri = map(speed, 0, this.maxSpeed * 3, 70, 100);
    
    // Draw as very fine, short lines to create the dense TouchDesigner fluid look
    stroke(particleHue, sat, bri, 35); // Alpha 35 so they blend together smoothly
    strokeWeight(1.5);
    
    let tailLength = 2.5; // Short, sharp trail
    line(this.pos.x, this.pos.y, this.pos.x - this.vel.x * tailLength, this.pos.y - this.vel.y * tailLength);
  }
}

/* --- Gesture Helper Functions --- */
function isFist(hand) {
  if (!hand || !hand.keypoints) return false;

  let wrist = hand.keypoints[0];
  let tips = [8, 12, 16, 20];
  let totalDist = 0;
  for (let i = 0; i < tips.length; i++) {
    let tip = hand.keypoints[tips[i]];
    totalDist += dist(wrist.x, wrist.y, tip.x, tip.y);
  }
  let avgDist = totalDist / 4;

  let palmBase = hand.keypoints[9];
  let palmSize = dist(wrist.x, wrist.y, palmBase.x, palmBase.y);

  return avgDist < (palmSize * 1.6);
}

function takeScreenshot() {
  console.log("Taking Screenshot...");

  saveCanvas('particle_capture_' + frameCount, 'png');

  let dataUrl = canvas.toDataURL();
  let imgElement = document.getElementById('screenshot-preview');
  let modal = document.getElementById('screenshot-modal');

  if (imgElement && modal) {
    imgElement.src = dataUrl;
    modal.style.display = 'block';

    setTimeout(() => {
      modal.style.display = 'none';
    }, 1200);
  }
}
