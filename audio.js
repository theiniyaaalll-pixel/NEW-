/*
 * Tesseract Audio Module (audio.js) - VEENA MELODY MODE
 * Guaranteed sound output on click.
 */

let synth;
let melodyLoop;
let isAudioInitialized = false;

// Scales for Veena-like feel (Major Pentatonic / Raga Mohanam ish)
const SCALE_NOTES = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4"];

async function initAudio() {
    if (isAudioInitialized) return;

    // 1. Resume Audio Context (Critical for browser autoplay)
    await Tone.start();
    console.log("Audio Context Started. Setting up synth...");

    // 2. Create a Reflective, Poetic Synth - TIMESCAPE THEME
    // Using FatSine for a rich, deep, soft texture that fills the room.
    // "Soft" timbre but "Loud" presence.
    synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsine", count: 3, spread: 30 },
        envelope: {
            attack: 0.5,       // Smooth entry
            decay: 1,
            sustain: 1,
            release: 5         // Extremely long release for "shimmering time" feel
        },
        volume: -4 // Louder, as requested (-12 was too quiet)
    }).toDestination();

    // 3. Add Reflective Effects
    // Massive Reverb for the "Poetic" atmosphere
    const reverb = new Tone.Reverb({ decay: 20, wet: 0.8 }).toDestination();

    // FeedbackDelay for "repeating history" / timescaping
    const delay = new Tone.FeedbackDelay("4n.", 0.6).toDestination();

    synth.connect(reverb);
    synth.connect(delay);


    // 4. Start Transport (Required for time-based effects)
    Tone.Transport.start();

    isAudioInitialized = true;
    console.log("Hand-Conductor Audio System Started.");
}

// Global state for hand tracking
let lastX = 0;
let lastY = 0;
let lastNoteTime = 0;

// Extended scale for full range interaction (3 Octaves of Pentatonic/Lydian)
// Extended scale for full range interaction (3 Octaves of Pentatonic/Lydian)
let GENERATIVE_SCALE = [
    "C3", "D3", "E3", "G3", "A3",
    "C4", "D4", "E4", "G4", "B4",
    "C5", "D5", "E5", "G5", "A5"
];

// ... (existing code) ...

// Drone state 
let isDroneActive = false;

function updateDroneState(handsPresent) {
    if (!synth || !isAudioInitialized) return;

    if (handsPresent) {
        // "Presence" mode: Active backing
        if (!isDroneActive) {
            // Just woke up from a pause! Modulate the scale to ensure freshness.
            modulateScale();
            isDroneActive = true;
        }

        synth.volume.rampTo(-4, 0.5);
        // Slightly brighter tone to support the melody
        // synth.set({ harmonicity: 0.2 }); // FatSine doesn't use harmonicity the same way, removing to avoid errors
    } else {
        // "Dream" mode: Deep silence / minimal drone
        isDroneActive = false;
        synth.volume.rampTo(-24, 4);
    }
}

function modulateScale() {
    // Pick a new root from compatible "Soft/Poetic" scales (Major Pentatonic variations)
    // This ensures the notes change (never repeat exactly the same set) but the MOOD (Major Pentatonic) stays the same.
    const MOODS = [
        ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "B4", "C5", "D5", "E5", "G5", "A5"], // C Major (Original)
        ["G3", "A3", "B3", "D4", "E4", "G4", "A4", "B4", "D5", "E5", "G5", "A5", "B5", "D6", "E6"], // G Major
        ["F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4", "C5", "D5", "F5", "G5", "A5", "C6", "D6"], // F Major
        ["D3", "E3", "F#3", "A3", "B3", "D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5"], // D Major
        ["Bb3", "C4", "D4", "F4", "G4", "Bb4", "C5", "D5", "F5", "G5", "Bb5", "C6", "D6", "F6", "G6"] // Bb Major
    ];

    // Pick a random mood
    let newIndex = Math.floor(Math.random() * MOODS.length);
    GENERATIVE_SCALE = MOODS[newIndex];
    console.log("Scale Modulated to Index: " + newIndex);

    // Reset last note to allow immediate replay of a similar pitch if needed, 
    // but practically this ensures the palette is fresh.
    lastPlayedNote = null;
}

// State for non-repeating notes
let lastPlayedNote = null;

// Hand interaction - THE CONDUCTOR
function updateAudioInteraction(x, y, videoHeight, tesseractSize, handSize) {
    if (!synth || !isAudioInitialized) return;

    // 1. Calculate Hand Speed & Normalize Position
    let normX = x / 640;
    let normY = y / videoHeight;

    let dx = normX - lastX;
    let dy = normY - lastY;
    let speed = Math.sqrt(dx * dx + dy * dy);

    let now = Tone.now();

    // 2. Dynamic Rhetoric/Rhythm
    let minInterval = map(speed, 0, 0.1, 0.8, 0.1);
    minInterval = constrain(minInterval, 0.15, 1.0);

    // Trigger Note Check
    if (now - lastNoteTime > minInterval && speed > 0.005) {

        // 3. Generative Note Selection (Non-Repeating)
        let baseIndex = Math.floor(map(normY, 1, 0, 0, GENERATIVE_SCALE.length - 1));

        let note;
        let attempts = 0;
        // Try to find a different note than the last one
        do {
            let variation = Math.floor(Math.random() * 5) - 2; // Wider variation
            let finalIndex = constrain(baseIndex + variation, 0, GENERATIVE_SCALE.length - 1);
            note = GENERATIVE_SCALE[finalIndex];
            attempts++;
        } while (note === lastPlayedNote && attempts < 10);

        lastPlayedNote = note;

        // 4. Volume Control by Depth (Hand Size)
        // Hand Size ~50 pixels (Far/Small) -> High Velocity (1.0) - Louder
        // Hand Size ~200 pixels (Close/Large) -> Low Velocity (0.2) - Quieter
        let velocity;
        if (handSize !== undefined && handSize > 1) {
            velocity = map(handSize, 40, 200, 1.0, 0.2);
        } else {
            // Fallback if size calc fails (use X axis)
            velocity = map(normX, 0, 1, 0.3, 1.0);
        }
        velocity = constrain(velocity, 0.1, 1.0);

        // 5. Play Note
        // Occasional harmony 
        if (Math.random() < 0.25) {
            let harmonyIndex = constrain(GENERATIVE_SCALE.indexOf(note) + 2, 0, GENERATIVE_SCALE.length - 1);
            let note2 = GENERATIVE_SCALE[harmonyIndex];
            synth.triggerAttackRelease([note, note2], "4n", now, velocity);
        } else {
            synth.triggerAttackRelease(note, "2n", now, velocity);
        }

        lastNoteTime = now;
    }

    // Store for next frame
    lastX = normX;
    lastY = normY;

    // 6. Texture Warp (Tesseract Size)
    let warp = map(tesseractSize, 50, 600, 0, 10);
    synth.set({ detune: warp });
}

// Helper map function
function map(n, start1, stop1, start2, stop2) {
    return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}
function constrain(n, low, high) {
    return Math.max(Math.min(n, high), low);
}


