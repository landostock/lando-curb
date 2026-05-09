import type { GameLoop } from "kontra";

import { playGameOverSound, startGameMusic } from "./audio";
import { board, grid, resetBoard } from "./board";
import { svgPxToDisplayPx } from "./gfx/coords";
import { clearLayers } from "./gfx/layers";
import { resetViewBox } from "./gfx/svg";
import { gridRedHide, gridRedState } from "./input/grid-toggle";
import { initDemandBudgets, resetDemandBudgets } from "./logic/demand-budget";
import { generateRandomMap } from "./logic/generate-map";
import { resetSpawning } from "./logic/spawning";
import { businessParks, resetState, session } from "./state";
import type { Pixel } from "./types";
import {
  clearLostFocus,
  focusOnLostPark,
  hideGameover,
  initGameover,
  prepareRestart,
  showGameover,
  transitionGameoverToMenu,
} from "./ui/gameover";
import { hideMenu, initMenu, initMenuBackground, showMenu } from "./ui/menu";
import { hideGameHud, resetHudCounters, setMotorwayMode } from "./ui/ui";
import { resetUpgrades } from "./ui/upgrades";

type MapGenerator = (delay: number) => void;

export const gameState = {
  gameStarted: false,
  updateCount: 0,
  totalUpdateCount: 0,
  renderCount: 0,
  gameOverlayHidden: false,
  lostBusinessParkPosition: { x: 0, y: 0 } as Pixel,
  currentMap: generateRandomMap,
};

let loop: GameLoop;

const startGame = (): void => {
  if (!gameState.gameStarted) {
    resetHudCounters();
    hideMenu();
    gameState.gameStarted = true;
    gameState.updateCount = 1;
    gameState.totalUpdateCount = 1;
    gameState.renderCount = 1;
    startGameMusic();
  }
};

const selectMap = (map: MapGenerator): void => {
  gameState.currentMap = map;
  // Clear the preloaded random map and regenerate with chosen map
  resetState();
  initDemandBudgets();
  resetDemandBudgets();
  resetSpawning();
  clearLayers();
  gameState.currentMap(0);
  startGame();
};

const startNewGame = (): void => {
  // Had to wrap this all in a gameStarted check, because restart button still exists
  // (and has focus!) so could be "pressed" with space bar to re-restart
  if (!gameState.gameStarted && loop.isStopped) {
    gameState.gameStarted = true;
    prepareRestart();

    setTimeout(() => {
      resetState();
      initDemandBudgets();
      resetDemandBudgets();
      resetSpawning();
      setMotorwayMode(false);
      gameState.updateCount = 1;
      gameState.totalUpdateCount = 1;
      gameState.renderCount = 1;
      resetHudCounters();
      resetUpgrades();
      resetBoard();
      resetViewBox();
      clearLayers();
      hideGameover();
      clearLostFocus();

      setTimeout(() => {
        gameState.currentMap(0);
        startGameMusic();
        loop.start();
      }, 1000);
    }, 1000);
  }
};

const gameoverToMenu = (): void => {
  gameState.gameStarted = false;
  transitionGameoverToMenu(session.paths, () => {
    resetState();
    initDemandBudgets();
    resetDemandBudgets();
    resetSpawning();
    gameState.updateCount = 0;
    gameState.totalUpdateCount = 0;
    gameState.renderCount = 0;
    resetUpgrades();

    setTimeout(() => {
      gameState.currentMap(2000);
      showMenu(businessParks[0]!);
      loop.start();
    }, 750);
  });
};

const toggleGameoverlay = (): void => {
  if (gameState.gameOverlayHidden) {
    gameState.gameOverlayHidden = false;
    focusOnLostPark(gameState.lostBusinessParkPosition);
    showGameover();
  } else {
    gameState.gameOverlayHidden = true;
    clearLostFocus();
    hideGameover();
  }
};

export const checkGameOver = (): void => {
  for (const f of businessParks) {
    if (!f.isAlive()) {
      gameState.gameStarted = false;
      loop.stop();
      playGameOverSound();

      gameState.lostBusinessParkPosition = svgPxToDisplayPx({
        x: f.x - grid.width / 2 - board.x + f.width / 2,
        y: f.y - grid.height / 2 - board.y + f.height / 2,
      });
      focusOnLostPark(gameState.lostBusinessParkPosition);

      hideGameHud();
      gridRedState.on = false;
      gridRedHide();

      gameState.updateCount = 0;
      gameState.totalUpdateCount = 0;
      gameState.renderCount = 0;

      showGameover();
      return;
    }
  }
};

export const initGameFlow = (gameLoop: GameLoop): void => {
  loop = gameLoop;
  initGameover(startNewGame, gameoverToMenu, toggleGameoverlay);
  initMenu(selectMap);
};

export const bootMenu = (): void => {
  initMenuBackground();
  resetBoard();
  resetViewBox();
  initDemandBudgets();
  generateRandomMap(2500);
  showMenu(
    businessParks[0] ?? {
      x: board.x + board.width / 2,
      y: board.y + board.height / 2,
      width: 0,
      height: 0,
    },
    true,
  );
};
