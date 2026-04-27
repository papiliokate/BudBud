import fs from 'fs';
import path from 'path';

// Curated list of distinct emojis
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

// Generate a puzzle for a specific epoch
function generatePuzzle(epoch) {
  const prng = mulberry32(epoch);

  // Board size
  let numBuds = 4;
  if (epoch % 3 === 1) numBuds = 6;
  else if (epoch % 3 === 2) numBuds = 8;

  // We need to form a valid cycle: 0 -> 1 -> 2 ... -> n-1 -> 0
  const edges = [];
  const emojisCopy = [...EMOJIS];
  
  // Shuffle emojis
  for (let i = emojisCopy.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [emojisCopy[i], emojisCopy[j]] = [emojisCopy[j], emojisCopy[i]];
  }

  // To make it hard but solvable, we reuse 1 or 2 emojis spaced apart.
  for (let i = 0; i < numBuds; i++) {
    edges.push(emojisCopy[i]);
  }
  
  if (numBuds > 4) {
    // Duplicate edge 0 at opposite side
    edges[Math.floor(numBuds / 2)] = edges[0];
    if (numBuds >= 8) {
       // Duplicate another edge
       edges[Math.floor(numBuds / 2) + Math.floor(numBuds / 4)] = edges[Math.floor(numBuds / 4)];
    }
  } else {
    // For 4 buds, it is mathematically impossible to assign an active blocking dislike
    // without breaking the solution. We just duplicate one edge to create visual ambiguity.
    edges[2] = edges[0];
  }

  const buds = [];
  for (let i = 0; i < numBuds; i++) {
    buds.push({
      id: i,
      likes: [],
      dislike: null,
      asset: `bud_${i + 1}.png`
    });
  }

  // Assign likes based on edges
  for (let i = 0; i < numBuds; i++) {
    const next = (i + 1) % numBuds;
    const edgeEmoji = edges[i];
    buds[i].likes.push(edgeEmoji);
    buds[next].likes.push(edgeEmoji);
  }

  // Assign dislikes
  // To make it hard, we want dislikes to actively block WRONG connections.
  // A wrong connection happens when Bud A and Bud B share a like, but aren't adjacent in the cycle.
  for (let i = 0; i < numBuds; i++) {
    const myLikes = buds[i].likes;
    
    // Find all buds that share a like with me, but are NOT my actual neighbors
    const ambiguousTargets = [];
    for (let j = 0; j < numBuds; j++) {
      if (i === j) continue;
      const prev = (i - 1 + numBuds) % numBuds;
      const next = (i + 1) % numBuds;
      if (j === prev || j === next) continue; // valid neighbors
      
      const sharesLike = myLikes.some(l => buds[j].likes.includes(l));
      if (sharesLike) {
        ambiguousTargets.push(j);
      }
    }

    let assignedDislike = false;
    
    // Try to pick a dislike that blocks an ambiguous target
    if (ambiguousTargets.length > 0) {
      // Pick a random ambiguous target to block
      const targetId = ambiguousTargets[Math.floor(prng() * ambiguousTargets.length)];
      const targetLikes = buds[targetId].likes;
      // We must pick an emoji that target likes, BUT we do not like, AND our valid neighbors do not like (otherwise it breaks the solution)
      const prev = (i - 1 + numBuds) % numBuds;
      const next = (i + 1) % numBuds;
      
      const invalidDislikes = new Set([
        ...buds[prev].likes,
        ...buds[next].likes,
        ...buds[i].likes
      ]);
      
      const potentialDislikes = targetLikes.filter(l => !invalidDislikes.has(l));
      if (potentialDislikes.length > 0) {
        buds[i].dislike = potentialDislikes[Math.floor(prng() * potentialDislikes.length)];
        assignedDislike = true;
      }
    }

    // Fallback: pick any active edge that doesn't break the solution
    if (!assignedDislike) {
      const prev = (i - 1 + numBuds) % numBuds;
      const next = (i + 1) % numBuds;
      const invalidDislikes = new Set([
        ...buds[prev].likes,
        ...buds[next].likes,
        ...buds[i].likes
      ]);
      
      // Try to pick from other active edges first
      const activeEdges = Array.from(new Set(edges));
      const validActive = activeEdges.filter(e => !invalidDislikes.has(e));
      
      if (validActive.length > 0) {
        buds[i].dislike = validActive[Math.floor(prng() * validActive.length)];
      } else {
        // Ultimate fallback: pick unused emoji
        const validUnused = EMOJIS.filter(e => !invalidDislikes.has(e));
        buds[i].dislike = validUnused[Math.floor(prng() * validUnused.length)];
      }
    }
  }

  // Shuffle likes array within each bud
  for (let i = 0; i < numBuds; i++) {
    if (prng() > 0.5) {
      buds[i].likes.reverse();
    }
  }

  // Shuffle the buds array so the cycle isn't 0,1,2,3...
  for (let i = buds.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [buds[i], buds[j]] = [buds[j], buds[i]];
  }

  const puzzleDate = new Date(epoch * 86400000);
  const puzzleData = {
    epoch: epoch,
    date: puzzleDate.toISOString().split('T')[0],
    buds: buds
  };

  return puzzleData;
}

function main() {
  const puzzlesDir = path.resolve('public/puzzles');
  if (!fs.existsSync(puzzlesDir)) {
    fs.mkdirSync(puzzlesDir, { recursive: true });
  }

  const now = new Date();
  const options = { timeZone: 'Pacific/Kiritimati', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const tzDateStr = formatter.format(now);
  const tzDate = new Date(`${tzDateStr}T00:00:00Z`);
  const currentEpoch = Math.floor(tzDate.getTime() / 86400000);

  console.log(`Generating puzzles starting from epoch ${currentEpoch}...`);

  for (let i = 0; i < 1000; i++) {
    const epoch = currentEpoch + i;
    const puzzle = generatePuzzle(epoch);
    const outputPath = path.join(puzzlesDir, `${epoch}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(puzzle, null, 2));

    // Also write the first one as daily_puzzle.json for fallback compatibility
    if (i === 0) {
      fs.writeFileSync(path.resolve('public/daily_puzzle.json'), JSON.stringify(puzzle, null, 2));
    }
  }

  console.log(`Successfully generated 1000 puzzles in ${puzzlesDir}`);
}

main();
