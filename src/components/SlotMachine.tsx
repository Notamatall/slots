import React, { useState, useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import "./SlotMachine.css";

// Type definitions
interface Symbol {
  emoji: string;
  value: number;
  name: string;
  isWild?: boolean;
  isScatter?: boolean;
}

interface SymbolSprite {
  sprite: PIXI.Text;
  data: Symbol;
}

interface Reel {
  container: PIXI.Container;
  symbols: SymbolSprite[];
  position: number;
  speed: number;
  targetSpeed: number;
  stopping: boolean;
  stopDelay: number;
}

interface WinLine {
  type: "row" | "column" | "diagonal";
  index: number;
  symbols: Symbol[];
  winAmount: number;
}

// Symbol definitions
const SYMBOLS: Record<string, Symbol> = {
  CHERRY: { emoji: "🍒", value: 1, name: "Cherry" },
  LEMON: { emoji: "🍋", value: 2, name: "Lemon" },
  ORANGE: { emoji: "🍊", value: 3, name: "Orange" },
  PLUM: { emoji: "🍇", value: 4, name: "Plum" },
  BELL: { emoji: "🔔", value: 5, name: "Bell" },
  DIAMOND: { emoji: "💎", value: 10, name: "Diamond" },
  SEVEN: { emoji: "7️⃣", value: 20, name: "Seven" },
  WILD: { emoji: "🌟", value: 0, name: "Wild", isWild: true },
  SCATTER: { emoji: "💰", value: 0, name: "Scatter", isScatter: true },
};

const SYMBOL_ARRAY: Symbol[] = Object.values(SYMBOLS);
const REGULAR_SYMBOLS: Symbol[] = SYMBOL_ARRAY.filter(
  (s) => !s.isWild && !s.isScatter
);

// Game configuration
const REEL_COUNT: number = 5;
const ROW_COUNT: number = 5;
const SYMBOL_SIZE: number = 100;
const REEL_WIDTH: number = SYMBOL_SIZE - 2;
const MIN_BET: number = 10;
const MAX_BET: number = 100;
const BET_INCREMENT: number = 10;

const SlotMachine: React.FC = () => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const reelsRef = useRef<Reel[]>([]);
  const checkingWinRef = useRef<boolean>(false);

  const [balance, setBalance] = useState<number>(1000);
  const [spinning, setSpinning] = useState<boolean>(false);
  const spinningRef = useRef<boolean>(false);
  const [winMessage, setWinMessage] = useState<string>("");
  const [bet, setBet] = useState<number>(MIN_BET);
  const [lastWin, setLastWin] = useState<number>(0);
  const [bonusMode, setBonusMode] = useState<boolean>(false);
  const [freeSpins, setFreeSpins] = useState<number>(0);
  const [autoSpin, setAutoSpin] = useState<boolean>(false);

  // Helper functions
  const getRandomSymbol = (): Symbol => {
    const rand = Math.random();
    if (rand < 0.05) return SYMBOLS.WILD;
    if (rand < 0.1) return SYMBOLS.SCATTER;
    return REGULAR_SYMBOLS[Math.floor(Math.random() * REGULAR_SYMBOLS.length)];
  };

  const createSymbol = (symbolData: Symbol): PIXI.Text => {
    const style = new PIXI.TextStyle({
      fontSize: 50,
      fill: symbolData.isWild
        ? 0xffd700
        : symbolData.isScatter
        ? 0xff69b4
        : 0xffffff,
      dropShadow: true,
      dropShadowDistance: 2,
      dropShadowAlpha: 0.8,
    });

    const text = new PIXI.Text(symbolData.emoji, style);
    text.anchor.set(0.5);
    return text;
  };

  const updateReelPositions = (reel: Reel): void => {
    reel.symbols.forEach((symbol, j) => {
      const baseY = j * SYMBOL_SIZE;
      const adjustedPosition =
        reel.position % (reel.symbols.length * SYMBOL_SIZE);
      let newY = baseY + adjustedPosition;

      // Keep symbols cycling within bounds
      while (newY > SYMBOL_SIZE * (ROW_COUNT + 2)) {
        newY -= reel.symbols.length * SYMBOL_SIZE;
      }
      while (newY < -SYMBOL_SIZE * 3) {
        newY += reel.symbols.length * SYMBOL_SIZE;
      }

      symbol.sprite.y = newY;

      // Replace symbols that are far off screen
      if (newY < -SYMBOL_SIZE * 2 || newY > SYMBOL_SIZE * (ROW_COUNT + 1)) {
        const newSymbolData = getRandomSymbol();
        symbol.data = newSymbolData;
        symbol.sprite.text = newSymbolData.emoji;
        symbol.sprite.style.fill = newSymbolData.isWild
          ? 0xffd700
          : newSymbolData.isScatter
          ? 0xff69b4
          : 0xffffff;
      }
    });
  };

  // Initialize PIXI application
  useEffect(() => {
    if (!pixiContainer.current) return;

    const app = new PIXI.Application({
      width: 500,
      height: 500,
      backgroundColor: 0x1a1a2e,
      antialias: true,
    });

    pixiContainer.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);

    // Create background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0f0f23);
    bg.lineStyle(2, 0x333333);

    bg.endFill();
    mainContainer.addChild(bg);
    bg.drawRoundedRect(
      5,
      5,
      REEL_WIDTH * REEL_COUNT,
      SYMBOL_SIZE * ROW_COUNT - 10,
      10
    );
    const slotContainer = new PIXI.Container();
    slotContainer.x = 5;
    slotContainer.y = 5;
    mainContainer.addChild(slotContainer);

    // Create reels
    const reels: Reel[] = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      const reelContainer = new PIXI.Container();
      reelContainer.x = i * REEL_WIDTH;

      const symbols: SymbolSprite[] = [];
      const symbolCount = ROW_COUNT + 6;

      for (let j = 0; j < symbolCount; j++) {
        const randomSymbol = getRandomSymbol();
        const symbol = createSymbol(randomSymbol);
        symbol.x = REEL_WIDTH / 2;
        symbol.y = j * SYMBOL_SIZE - SYMBOL_SIZE / 2;
        reelContainer.addChild(symbol);
        symbols.push({
          sprite: symbol,
          data: randomSymbol,
        });
      }

      const reel: Reel = {
        container: reelContainer,
        symbols,
        position: 0,
        speed: 0,
        targetSpeed: 0,
        stopping: false,
        stopDelay: 0,
      };

      reels.push(reel);
      slotContainer.addChild(reelContainer);
    }

    reelsRef.current = reels;

    // Create mask
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(
      0,
      0,
      REEL_WIDTH * REEL_COUNT - 10,
      SYMBOL_SIZE * ROW_COUNT - 10
    );
    mask.endFill();
    slotContainer.mask = mask;
    slotContainer.addChild(mask);

    // Add grid lines
    const gridLines = new PIXI.Graphics();
    gridLines.lineStyle(1, 0x333333, 0.5);

    for (let i = 1; i < REEL_COUNT; i++) {
      gridLines.moveTo(i * REEL_WIDTH - 5, 0);
      gridLines.lineTo(i * REEL_WIDTH - 5, SYMBOL_SIZE * ROW_COUNT - 10);
    }

    for (let i = 1; i < ROW_COUNT; i++) {
      gridLines.moveTo(0, i * SYMBOL_SIZE - 5);
      gridLines.lineTo(REEL_WIDTH * REEL_COUNT - 10, i * SYMBOL_SIZE - 5);
    }

    slotContainer.addChild(gridLines);

    // Animation loop
    app.ticker.add(() => {
      reels.forEach((reel) => {
        if (reel.speed !== 0 || reel.targetSpeed !== 0) {
          if (reel.stopping) {
            reel.speed *= 0.93;
            if (reel.speed < 0.5) {
              reel.speed = 0;
              reel.targetSpeed = 0;
              const offset = reel.position % SYMBOL_SIZE;
              if (offset > SYMBOL_SIZE / 2) {
                reel.position += SYMBOL_SIZE - offset;
              } else {
                reel.position -= offset;
              }
              updateReelPositions(reel);
            }
          } else if (reel.speed < reel.targetSpeed) {
            reel.speed += 2;
          }

          if (reel.speed > 0) {
            reel.position += reel.speed;
            updateReelPositions(reel);
          }
        }
      });
      const canStop =
        spinningRef.current &&
        reels.every((reel) => reel.speed === 0 && reel.targetSpeed === 0) &&
        !checkingWinRef.current;

      if (canStop) {
        checkingWinRef.current = true;
        setTimeout(() => {
          checkWin();
          setSpinning(false);
          checkingWinRef.current = false;
        }, 100);
      }
    });

    return () => {
      app.destroy(true);
    };
  }, []);

  // Auto spin effect
  useEffect(() => {
    if (autoSpin && !spinning && (freeSpins > 0 || balance >= bet)) {
      const timer = setTimeout(() => {
        spin();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoSpin, spinning, freeSpins, balance, bet]);

  const spin = (): void => {
    if (spinning) return;

    const currentBet = freeSpins > 0 ? 0 : bet;
    if (balance < currentBet && freeSpins === 0) return;

    if (freeSpins === 0) {
      setBalance((prev) => prev - currentBet);
    } else {
      setFreeSpins((prev) => prev - 1);
    }

    setSpinning(true);
    spinningRef.current = true;
    setWinMessage("");
    setLastWin(0);

    reelsRef.current.forEach((reel, i) => {
      reel.targetSpeed = 30 + Math.random() * 10;
      reel.stopping = false;

      setTimeout(() => {
        reel.stopping = true;
      }, 2000 + i * 200);
    });
  };

  const getSymbolGrid = (): (Symbol | null)[][] => {
    const grid: (Symbol | null)[][] = [];
    for (let row = 0; row < ROW_COUNT; row++) {
      const rowSymbols: (Symbol | null)[] = [];
      reelsRef.current.forEach((reel) => {
        const targetY = row * SYMBOL_SIZE;
        let closestSymbol: SymbolSprite | null = null;
        let closestDistance = Infinity;

        for (let index = 0; index < reel.symbols.length; index++) {
          const element = reel.symbols[index];
          const distance = Math.abs(element.sprite.y - targetY);
          if (distance < closestDistance && distance < SYMBOL_SIZE / 2) {
            closestDistance = distance;
            closestSymbol = element;
          }
        }

        rowSymbols.push(closestSymbol ? closestSymbol.data : null);
      });
      grid.push(rowSymbols);
    }
    return grid;
  };

  const checkLine = (symbols: (Symbol | null)[]): number => {
    if (!symbols || symbols.length !== 5) return 0;

    const validSymbols = symbols.filter((s) => s !== null) as Symbol[];
    if (validSymbols.length !== 5) return 0;

    let matchSymbol = validSymbols[0];
    let matchCount = 1;

    for (let i = 1; i < validSymbols.length; i++) {
      if (
        validSymbols[i] === matchSymbol ||
        validSymbols[i].isWild ||
        matchSymbol.isWild
      ) {
        matchCount++;
        if (matchSymbol.isWild && !validSymbols[i].isWild) {
          matchSymbol = validSymbols[i];
        }
      } else {
        break;
      }
    }

    if (matchCount >= 3) {
      const multiplier = matchCount === 5 ? 10 : matchCount === 4 ? 5 : 2;
      return (matchSymbol.value || 1) * multiplier;
    }

    return 0;
  };

  const checkWin = (): void => {
    const grid = getSymbolGrid();
    let totalWin = 0;
    let scatterCount = 0;
    const winLines: WinLine[] = [];

    // Count scatters
    for (let row = 0; row < ROW_COUNT; row++) {
      for (let col = 0; col < REEL_COUNT; col++) {
        if (grid[row][col]?.isScatter) {
          scatterCount++;
        }
      }
    }

    // Check for scatter bonus
    if (scatterCount >= 3) {
      const bonusSpins = scatterCount * 5;
      setFreeSpins((prev) => prev + bonusSpins);
      setBonusMode(true);
      setWinMessage(`${scatterCount} SCATTERS! +${bonusSpins} FREE SPINS!`);
      totalWin += bet * scatterCount * 10;
    }

    // Check horizontal lines
    for (let row = 0; row < ROW_COUNT; row++) {
      const lineWin = checkLine(grid[row]);
      if (lineWin > 0) {
        totalWin += lineWin * bet;
        winLines.push({
          type: "row",
          index: row,
          symbols: grid[row].filter((s) => s !== null) as Symbol[],
          winAmount: lineWin * bet,
        });
      }
    }

    // Check vertical lines
    for (let col = 0; col < REEL_COUNT; col++) {
      const column: (Symbol | null)[] = [];
      for (let row = 0; row < ROW_COUNT; row++) {
        column.push(grid[row][col]);
      }
      const lineWin = checkLine(column);
      if (lineWin > 0) {
        totalWin += lineWin * bet;
        winLines.push({
          type: "column",
          index: col,
          symbols: column.filter((s) => s !== null) as Symbol[],
          winAmount: lineWin * bet,
        });
      }
    }

    // Check diagonals
    const diagonal1: (Symbol | null)[] = [];
    const diagonal2: (Symbol | null)[] = [];
    for (let i = 0; i < ROW_COUNT; i++) {
      diagonal1.push(grid[i][i]);
      diagonal2.push(grid[i][ROW_COUNT - 1 - i]);
    }

    const diag1Win = checkLine(diagonal1);
    if (diag1Win > 0) {
      totalWin += diag1Win * bet;
      winLines.push({
        type: "diagonal",
        index: 0,
        symbols: diagonal1.filter((s) => s !== null) as Symbol[],
        winAmount: diag1Win * bet,
      });
    }

    const diag2Win = checkLine(diagonal2);
    if (diag2Win > 0) {
      totalWin += diag2Win * bet;
      winLines.push({
        type: "diagonal",
        index: 1,
        symbols: diagonal2.filter((s) => s !== null) as Symbol[],
        winAmount: diag2Win * bet,
      });
    }

    // Update balance and show win
    if (totalWin > 0) {
      setBalance((prev) => prev + totalWin);
      setLastWin(totalWin);
      if (!winMessage) {
        setWinMessage(`WIN $${totalWin}!`);
      }
      setTimeout(() => setWinMessage(""), 3000);
    }

    // End bonus mode if no more free spins
    if (bonusMode && freeSpins === 0 && scatterCount < 3) {
      setBonusMode(false);
      setAutoSpin(false);
    }
  };

  const increaseBet = (): void => {
    if (bet < MAX_BET && !spinning) {
      setBet((prev) => prev + BET_INCREMENT);
    }
  };

  const decreaseBet = (): void => {
    if (bet > MIN_BET && !spinning) {
      setBet((prev) => prev - BET_INCREMENT);
    }
  };

  return (
    <div className="slot-machine">
      <h1 className="title">🎰 5x5 Mega Slots 🎰</h1>
      {bonusMode && <div className="bonus-mode">🎉 BONUS MODE ACTIVE! 🎉</div>}
      <div className="info-panel">
        <div className="balance">Balance: ${balance}</div>
        <div className="bet-controls">
          <button
            className="bet-button"
            onClick={decreaseBet}
            disabled={spinning}
          >
            -
          </button>
          <span className="bet-amount">Bet: ${bet}</span>
          <button
            className="bet-button"
            onClick={increaseBet}
            disabled={spinning}
          >
            +
          </button>
        </div>
        <div className="last-win">Last Win: ${lastWin}</div>
        {freeSpins > 0 && (
          <div className="free-spins">Free Spins: {freeSpins}</div>
        )}
      </div>
      <div ref={pixiContainer} className="game-container">
        {winMessage && <div className="win-message">{winMessage}</div>}
      </div>
      <div className="controls">
        <button
          className="spin-button"
          onClick={spin}
          disabled={spinning || (balance < bet && freeSpins === 0)}
        >
          {spinning
            ? "SPINNING..."
            : freeSpins > 0
            ? "FREE SPIN!"
            : `SPIN ($${bet})`}
        </button>
        <button
          className={`spin-button auto-spin-button ${autoSpin ? "active" : ""}`}
          onClick={() => setAutoSpin(!autoSpin)}
        >
          {autoSpin ? "STOP AUTO" : "AUTO SPIN"}
        </button>
      </div>
      <div className="legend">
        <div className="legend-item">🌟 Wild (substitutes any)</div>
        <div className="legend-item">💰 Scatter (3+ triggers bonus)</div>
        <div className="legend-item">
          Win Lines: All rows, columns & diagonals
        </div>
      </div>
    </div>
  );
};

export default SlotMachine;
