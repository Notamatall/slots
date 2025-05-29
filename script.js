class SlotRNGEngine {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      reels: 5,
      rows: 3,
      paylines: 20,
      minBet: 0.2,
      maxBet: 100,
      targetRTP: 96.5, // Return to Player percentage
      volatility: "medium", // low, medium, high
      maxWin: 5000, // Maximum win multiplier
      ...config,
    };

    // Symbol definitions with weights and payouts
    this.symbols = {
      WILD: {
        weight: 3,
        payout: { 5: 1000, 4: 200, 3: 50 },
        substitutes: true,
        name: "🃏",
      },
      SCATTER: {
        weight: 4,
        payout: { 5: 500, 4: 100, 3: 25 },
        scatter: true,
        freeSpinsTrigger: true,
        name: "⭐",
      },
      SEVEN: {
        weight: 8,
        payout: { 5: 500, 4: 75, 3: 15 },
        name: "7️⃣",
      },
      BAR: {
        weight: 12,
        payout: { 5: 200, 4: 40, 3: 8 },
        name: "🔴",
      },
      BELL: {
        weight: 15,
        payout: { 5: 150, 4: 30, 3: 6 },
        name: "🔔",
      },
      CHERRY: {
        weight: 20,
        payout: { 5: 100, 4: 20, 3: 4, 2: 2 },
        name: "🍒",
      },
      LEMON: {
        weight: 25,
        payout: { 5: 75, 4: 15, 3: 3 },
        name: "🍋",
      },
      ORANGE: {
        weight: 30,
        payout: { 5: 50, 4: 10, 3: 2 },
        name: "🍊",
      },
      PLUM: {
        weight: 35,
        payout: { 5: 40, 4: 8, 3: 2 },
        name: "🟣",
      },
      GRAPE: {
        weight: 40,
        payout: { 5: 30, 4: 6, 3: 1 },
        name: "🍇",
      },
    };

    // Create weighted symbol array for each reel
    this.reelStrips = this.generateReelStrips();

    // Define paylines (standard 20-line pattern)
    this.paylines = this.generatePaylines();

    // Game state
    this.gameState = {
      balance: 1000,
      currentBet: 1.0,
      freeSpins: 0,
      multiplier: 1,
      totalWagered: 0,
      totalWon: 0,
    };

    // RNG seed (for reproducible results in testing)
    this.seed = Date.now();
  }

  // Cryptographically secure random number generator
  generateSecureRandom() {
    // In production, use crypto.getRandomValues() or server-side secure RNG
    // For demo purposes, using enhanced Math.random with seed
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Generate weighted reel strips
  generateReelStrips() {
    const strips = [];

    for (let reel = 0; reel < this.config.reels; reel++) {
      const strip = [];

      // Each reel has different symbol distribution for variance
      const reelMultiplier = 1 + reel * 0.1;

      Object.entries(this.symbols).forEach(([symbol, config]) => {
        const weight = Math.floor(config.weight * reelMultiplier);
        for (let i = 0; i < weight; i++) {
          strip.push(symbol);
        }
      });

      // Shuffle the strip
      for (let i = strip.length - 1; i > 0; i--) {
        const j = Math.floor(this.generateSecureRandom() * (i + 1));
        [strip[i], strip[j]] = [strip[j], strip[i]];
      }

      strips.push(strip);
    }

    return strips;
  }

  // Generate standard 20 paylines
  generatePaylines() {
    return [
      [1, 1, 1, 1, 1], // Middle row
      [0, 0, 0, 0, 0], // Top row
      [2, 2, 2, 2, 2], // Bottom row
      [0, 1, 2, 1, 0], // V shape
      [2, 1, 0, 1, 2], // Inverted V
      [1, 0, 0, 0, 1], // W shape
      [1, 2, 2, 2, 1], // Inverted W
      [0, 0, 1, 2, 2], // Ascending
      [2, 2, 1, 0, 0], // Descending
      [1, 2, 1, 0, 1], // Zigzag
      [1, 0, 1, 2, 1], // Reverse zigzag
      [0, 1, 0, 1, 0], // Up-down
      [2, 1, 2, 1, 2], // Down-up
      [0, 0, 2, 0, 0], // V bottom
      [2, 2, 0, 2, 2], // V top
      [1, 0, 2, 0, 1], // Diamond
      [1, 2, 0, 2, 1], // Reverse diamond
      [0, 2, 0, 2, 0], // Alternating top-bottom
      [2, 0, 2, 0, 2], // Alternating bottom-top
      [1, 1, 0, 1, 1], // Modified middle
    ];
  }

  // Spin the reels
  spin(betAmount) {
    if (betAmount < this.config.minBet || betAmount > this.config.maxBet) {
      throw new Error(
        `Bet must be between ${this.config.minBet} and ${this.config.maxBet}`
      );
    }

    if (this.gameState.balance < betAmount) {
      throw new Error("Insufficient balance");
    }

    // Deduct bet from balance
    this.gameState.balance -= betAmount;
    this.gameState.totalWagered += betAmount;
    this.gameState.currentBet = betAmount;

    // Generate reel results
    const reelResults = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      const strip = this.reelStrips[reel];
      const position = Math.floor(this.generateSecureRandom() * strip.length);

      // Get 3 consecutive symbols from the strip
      const symbols = [];
      for (let row = 0; row < this.config.rows; row++) {
        const index = (position + row) % strip.length;
        symbols.push(strip[index]);
      }
      reelResults.push(symbols);
    }

    // Calculate wins
    const winResult = this.calculateWins(reelResults, betAmount);

    // Check for scatter bonus
    const scatterResult = this.checkScatterBonus(reelResults);

    // Update balance
    this.gameState.balance += winResult.totalWin;
    this.gameState.totalWon += winResult.totalWin;

    // Handle free spins
    if (scatterResult.triggered) {
      this.gameState.freeSpins += scatterResult.freeSpins;
    }

    return {
      reels: reelResults,
      wins: winResult.wins,
      totalWin: winResult.totalWin,
      scatter: scatterResult,
      gameState: { ...this.gameState },
      rtp: this.calculateCurrentRTP(),
    };
  }

  // Calculate wins for all paylines
  calculateWins(reelResults, betAmount) {
    const wins = [];
    let totalWin = 0;

    this.paylines.forEach((payline, index) => {
      const lineWin = this.calculateLineWin(reelResults, payline, betAmount);
      if (lineWin.win > 0) {
        wins.push({
          payline: index + 1,
          symbols: lineWin.symbols,
          count: lineWin.count,
          win: lineWin.win,
          positions: payline,
        });
        totalWin += lineWin.win;
      }
    });

    return { wins, totalWin };
  }

  // Calculate win for a single payline
  calculateLineWin(reelResults, payline, betAmount) {
    const lineSymbols = payline.map(
      (row, reelIndex) => reelResults[reelIndex][row]
    );

    // Find the longest matching sequence from left to right
    let matchingSymbol = lineSymbols[0];
    let matchCount = 1;
    let isWild = false;

    // Handle wild substitution
    if (this.symbols[matchingSymbol]?.substitutes) {
      isWild = true;
      // Find first non-wild symbol
      for (let i = 1; i < lineSymbols.length; i++) {
        if (!this.symbols[lineSymbols[i]]?.substitutes) {
          matchingSymbol = lineSymbols[i];
          break;
        }
      }
    }

    // Count consecutive matches
    for (let i = 1; i < lineSymbols.length; i++) {
      const currentSymbol = lineSymbols[i];
      const isCurrentWild = this.symbols[currentSymbol]?.substitutes;

      if (
        currentSymbol === matchingSymbol ||
        isCurrentWild ||
        (isWild && this.symbols[matchingSymbol]?.substitutes)
      ) {
        matchCount++;
      } else {
        break;
      }
    }

    // Calculate payout
    let win = 0;
    if (matchCount >= 2) {
      // Minimum 2 symbols for cherry, 3 for others
      const symbolConfig = this.symbols[matchingSymbol];
      if (symbolConfig?.payout[matchCount]) {
        const basePayout = symbolConfig.payout[matchCount];
        const lineWin = (betAmount / this.config.paylines) * basePayout;
        win = lineWin * this.gameState.multiplier;
      }
    }

    return {
      win: Math.round(win * 100) / 100, // Round to 2 decimal places
      symbols: lineSymbols.slice(0, matchCount),
      count: matchCount,
    };
  }

  // Check for scatter bonus
  checkScatterBonus(reelResults) {
    const scatterSymbol = "SCATTER";
    let scatterCount = 0;
    const positions = [];

    // Count scatters across all reels
    reelResults.forEach((reel, reelIndex) => {
      reel.forEach((symbol, rowIndex) => {
        if (symbol === scatterSymbol) {
          scatterCount++;
          positions.push({ reel: reelIndex, row: rowIndex });
        }
      });
    });

    let triggered = false;
    let freeSpins = 0;
    let multiplier = 1;

    // Scatter bonus rules
    if (scatterCount >= 3) {
      triggered = true;
      freeSpins = 10 + (scatterCount - 3) * 5; // 10 + 5 per extra scatter
      multiplier = scatterCount >= 5 ? 3 : scatterCount >= 4 ? 2 : 1;
    }

    return {
      triggered,
      count: scatterCount,
      freeSpins,
      multiplier,
      positions,
    };
  }

  // Calculate current RTP
  calculateCurrentRTP() {
    if (this.gameState.totalWagered === 0) return 0;
    return (this.gameState.totalWon / this.gameState.totalWagered) * 100;
  }

  // Get current game state
  getGameState() {
    return { ...this.gameState };
  }

  // Get symbol information
  getSymbolInfo() {
    return Object.entries(this.symbols).map(([key, symbol]) => ({
      symbol: key,
      name: symbol.name,
      payout: symbol.payout,
      special: symbol.substitutes
        ? "WILD"
        : symbol.scatter
        ? "SCATTER"
        : "REGULAR",
    }));
  }

  // Get paytable
  getPaytable() {
    const paytable = {};
    Object.entries(this.symbols).forEach(([symbol, config]) => {
      paytable[symbol] = {
        name: config.name,
        payouts: Object.entries(config.payout || {}).map(([count, payout]) => ({
          symbols: parseInt(count),
          payout: payout,
        })),
      };
    });
    return paytable;
  }

  // Simulate multiple spins for RTP testing
  simulateSpins(numberOfSpins, betAmount = 1.0) {
    const results = {
      totalSpins: numberOfSpins,
      totalWagered: 0,
      totalWon: 0,
      bigWins: 0, // Wins > 10x bet
      bonusRounds: 0,
      hitFrequency: 0, // Percentage of winning spins
    };

    let winningSpins = 0;

    for (let i = 0; i < numberOfSpins; i++) {
      try {
        const result = this.spin(betAmount);
        results.totalWagered += betAmount;
        results.totalWon += result.totalWin;

        if (result.totalWin > 0) {
          winningSpins++;
        }

        if (result.totalWin > betAmount * 10) {
          results.bigWins++;
        }

        if (result.scatter.triggered) {
          results.bonusRounds++;
        }
      } catch (error) {
        // Handle insufficient balance by adding more
        this.gameState.balance += 1000;
        i--; // Retry this spin
      }
    }

    results.hitFrequency = (winningSpins / numberOfSpins) * 100;
    results.actualRTP = (results.totalWon / results.totalWagered) * 100;

    return results;
  }
}

// Example usage and demonstration
const slotEngine = new SlotRNGEngine({
  reels: 5,
  rows: 3,
  paylines: 20,
  targetRTP: 96.5,
  volatility: "medium",
});

// Single spin example
console.log("=== SINGLE SPIN DEMO ===");
const spinResult = slotEngine.spin(1.0);
console.log(
  "Reel Results:",
  spinResult.reels.map((reel) =>
    reel.map((symbol) => slotEngine.symbols[symbol].name)
  )
);
console.log("Total Win:", spinResult.totalWin);
console.log("Winning Lines:", spinResult.wins.length);

// Simulation example
console.log("\n=== SIMULATION RESULTS ===");
const simulation = slotEngine.simulateSpins(10000, 1.0);
console.log(`RTP: ${simulation.actualRTP.toFixed(2)}%`);
console.log(`Hit Frequency: ${simulation.hitFrequency.toFixed(2)}%`);
console.log(`Big Wins: ${simulation.bigWins}`);
console.log(`Bonus Rounds: ${simulation.bonusRounds}`);

// Paytable
console.log("\n=== PAYTABLE ===");
const paytable = slotEngine.getPaytable();
Object.entries(paytable).forEach(([symbol, info]) => {
  console.log(`${info.name} ${symbol}:`, info.payouts);
});

module.exports = SlotRNGEngine;
