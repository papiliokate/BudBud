const generatePuzzle = require('./scripts/generate_puzzle.js');
// Wait, generate_puzzle.js is an ES module. I will just copy the relevant logic here to test.
const fs = require('fs');

const EMOJIS = [
  "emoji_apple.png", "emoji_fox.png", "emoji_sun.png", "emoji_basketball.png", 
  "emoji_car.png", "emoji_rocket.png", "emoji_guitar.png", "emoji_pizza.png", 
  "emoji_diamond.png", "emoji_butterfly.png", "emoji_mushroom.png", "emoji_watermelon.png", 
  "emoji_soccer.png", "emoji_rainbow.png", "emoji_balloon.png", "emoji_icecream.png",
  "emoji_sunflower.png", "emoji_palette.png", "emoji_taco.png", "emoji_ufo.png", 
  "emoji_turtle.png", "emoji_donut.png", "emoji_cactus.png", "emoji_piano.png"
];

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function testPuzzle(epoch) {
  const prng = mulberry32(epoch);

  let numBuds = 8; // Force 8 buds for testing

  const edges = [];
  const emojisCopy = [...EMOJIS];
  
  for (let i = emojisCopy.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [emojisCopy[i], emojisCopy[j]] = [emojisCopy[j], emojisCopy[i]];
  }

  for (let i = 0; i < numBuds; i++) {
    edges.push(emojisCopy[i]);
  }
  
  if (numBuds > 4) {
    edges[Math.floor(numBuds / 2)] = edges[0];
    if (numBuds >= 8) {
       edges[Math.floor(numBuds / 2) + Math.floor(numBuds / 4)] = edges[Math.floor(numBuds / 4)];
    }
  } else {
    edges[2] = edges[0];
  }

  const buds = [];
  for (let i = 0; i < numBuds; i++) {
    buds.push({ id: i, likes: [], dislike: null });
  }

  for (let i = 0; i < numBuds; i++) {
    const next = (i + 1) % numBuds;
    const edgeEmoji = edges[i];
    buds[i].likes.push(edgeEmoji);
    buds[next].likes.push(edgeEmoji);
  }

  // Count occurrences of each like
  const likeCounts = {};
  for (const bud of buds) {
    for (const like of bud.likes) {
      likeCounts[like] = (likeCounts[like] || 0) + 1;
    }
  }

  for (const [like, count] of Object.entries(likeCounts)) {
    if (count === 1) {
      console.log(`Epoch ${epoch}: Like ${like} appears only once!`);
    }
    if (count === 0) {
        console.log(`Epoch ${epoch}: Like ${like} appears 0 times!`);
    }
  }
  
  // Also check if any bud has a duplicate like
  for (const bud of buds) {
      if (bud.likes[0] === bud.likes[1]) {
          console.log(`Epoch ${epoch}: Bud ${bud.id} has duplicate likes: ${bud.likes[0]}`);
      }
  }
}

for (let i = 0; i < 10000; i++) {
  testPuzzle(20000 + i);
}
console.log("Test finished.");
