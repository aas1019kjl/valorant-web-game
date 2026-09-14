import { Game } from './Game.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
game.init();
game.start();
