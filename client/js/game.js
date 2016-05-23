function Game() { };
//
/** Game loops **/
//
Game.prototype.handleNetwork = function(socket) {
	socket.emit('myNameIs', playerName);
	
	bindKeyboard();
	// This is where all socket messages are received
	socket.on('playerSpawn', function (newPlayer, board) {
		initBoard(board.boardW,board.boardH);
		player = newPlayer;
		player['name'] = playerName; // in case myNameIs hasn't registered yet

		gameOver = false;
		tick();
	});
	
	socket.on('updateBoard', function (newBoard) {
		for (var i=newBoard.x0;i<newBoard.x1;i++) {
			for (var j=newBoard.y0;j<newBoard.y1;j++) { // update xp and board
				board.isXp[i][j] = newBoard.isXp[i-newBoard.x0][j-newBoard.y0];
				if(board.isBloc[i][j]  != [player.hue]) // this prevents a display sync problem
					board.isBloc[i][j] = newBoard.isBloc[i-newBoard.x0][j-newBoard.y0];
			}
		}
		colors = newBoard.colors;
	});
	
	socket.on('updatePlayers', function (updatedPlayers) {
		// We keep some local values (x,y) because they're more reliable than server values (because of lag)
		updatedPlayers.forEach( function(p) {
			for ( var i=0; i < otherPlayers.length; i++ ) {
				var o = otherPlayers[i];
				if (o.name === p.name && o.hue === p.hue) { // if it's the same dude?
					if(o.dx == p.dx && o.dy == p.dy) { // if the direction hasn't changed
						if(Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < (Math.abs(o.dx) + Math.abs(o.dy)) * o.velocity * 0.1) {
							// keep the old values if the delta is small (to avoid jitter)
							p.x = otherPlayers[i].x;
							p.y = otherPlayers[i].y;
						}
					}
					break;
				}
			}
		});
		otherPlayers = updatedPlayers;
		
	});
	
	socket.on('playerDied', function () {
		gameOver = true;
	});
	
	socket.on('newSpeed', function (v) {
		player.velocity = v;
	});
}

Game.prototype.handleLogic = function() {
	if (!player || gameOver) // the game hasn't initialized yet!
		return;
		
	// move player
	var dt = tick();
	var isNewBloc = movePlayer(player, dt);
	if(isNewBloc)
		socket.emit('playerMove', {x:player.x, y:player.y});
	updatePlayerDirection();
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			movePlayer(o, dt);
		});
	
}

Game.prototype.handleGraphics = function(gfx) {
	if (!player) // the game hasn't initialize yet!
		return;
		
	// This is where you draw everything
	gfx.fillStyle = '#fbfcfc';
	gfx.fillRect(0, 0, screenWidth, screenHeight);
	
	if(gameOver) {
		gfx.fillStyle = '#2ecc71';
		gfx.strokeStyle = '#27ae60';
		gfx.font = 'bold 50px Verdana';
		gfx.textAlign = 'center';
		gfx.lineWidth = 2;
		gfx.fillText('G A M E  O V E R', screenWidth * 0.5, screenHeight * 0.4);
		gfx.strokeText('G A M E  O V E R', screenWidth * 0.5, screenHeight * 0.4);
		gfx.font = 'bold 25px Verdana';
		gfx.fillText('press space bar to respawn...', screenWidth * 0.5, screenHeight * 0.7);
		gfx.strokeText('press space bar to respawn...', screenWidth * 0.5, screenHeight * 0.7);
		return;
	}

	// draw board
	drawBoard(gfx);
	
	// draw players
	drawPlayer(gfx, player);
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			drawPlayer(gfx, o);
		});
}

//
/** Game logic variables **/
//
var player = null;
var otherPlayers = null;
var board = {
	H: 0,
	W: 0,
	isBloc: null,
	isXp: null
};
var colors = []; // contains all colors to be drawn, received from server.

var lastUpdate = Date.now(); // used to compute the time delta between frames

function initBoard(H,W){
	// Board
	board.W = W;
	board.H = H;
	board.isBloc = new Array(W);
	board.isXp = new Array(W);
	for (var i=0;i<W;i++) {
		board.isBloc[i] = new Array(H);
		board.isXp[i] = new Array(H);
		for (var j=0;j<H;j++) {
			board.isBloc[i][j] = EMPTY_BLOC;
			board.isXp[i][j] = false;
		}
	}
}
var gameOver = false;

//
/** Game drawing constants **/
//
var HALF_BLOC_SIZE_DISPLAY = 18; // the left and right padding in px when drawing a bloc
var BLOC_TO_PIXELS = 36; // the size of a game bloc
var BLOC_COLOR = '#777';
var EMPTY_BLOC = -1;
var SIDE_WALL = -2;
var XP_RADIUS = 10;
var XP_STROKE = 3;
var XP_COLOR = '#9900ff';
var XP_SCOLOR = '#000066';

//
/** Game logic helpers **/
//
function tick() { // handles the delta time between frames
    var now = Date.now();
    var dt = now - lastUpdate;
    lastUpdate = now;
	
	return dt / 1000;
}

function updatePlayerDirection() {
	
	if(lastDirectionPressed == NO_KEY) // player does not want to switch direction
		return;
	
	// one of these two will be zero of very close, since player is always moving along the grid
	delta = (player.x - turnPosition[0]) * player.dx
			+ (player.y - turnPosition[1]) * player.dy;

	if(delta < 0) // if the distance between the player and the next valid turning position is negative, we haven't reached the turn point yet
		return;
		
	player.x = Math.round(player.x);
	player.y = Math.round(player.y);
	
	if (lastDirectionPressed == KEY_LEFT && player.dx == 0) {
		changePlayerSpeed(-1.0,0.0);
	} else if (lastDirectionPressed == KEY_RIGHT && player.dx == 0) {
		changePlayerSpeed(1.0,0.0);
	} else if (lastDirectionPressed == KEY_DOWN && player.dy == 0) {
		changePlayerSpeed(0.0,1.0);
	} else if (lastDirectionPressed == KEY_UP && player.dy == 0) {
		changePlayerSpeed(0.0,-1.0);
	}
	// if we had a delta, adjust according to the new direction
	player.x += player.dx * (delta);
	player.y += player.dy * (delta);
	lastDirectionPressed = comboDirectionPressed;
	comboDirectionPressed = NO_KEY;
	updateTurnTargetPosition();
}

function changePlayerSpeed(x,y) {
	player.dx = x;
	player.dy = y;
	socket.emit('directionChange',{dx:player.dx, dy:player.dy});
}

// player position update. returns true if the bloc has changed.
function movePlayer(p, dt) {
	p.x += p.dx * p.velocity * dt;
	p.y += p.dy * p.velocity * dt;
	var squareX = Math.round(p.x - p.dx*.5), squareY = Math.round(p.y - p.dy*.5);
	squareX = Math.min(Math.max(squareX,0),board.W-1);
	squareY = Math.min(Math.max(squareY,0),board.H-1);
	board.isBloc[squareX][squareY] = p.hue;
		
	// check if it's a new value
	var value = false;
	if(p.lastPos && (p.lastPos[0] != squareX || p.lastPos[1] != squareY)) {
		value = true;
	}
	p.lastPos = [squareX, squareY];
	
	return value;
}

//
/** Display helpers **/
//
function drawPlayer(gfx, p){	
	gfx.fillStyle = 'hsl(' + p.hue + ', 100%, 50%)';
	gfx.strokeStyle =  'hsl(' + p.hue + ', 90%, 40%)';
	gfx.lineWidth = 5;
	gfx.lineJoin = 'round';
	gfx.lineCap = 'round';
	var coords = getBlocDrawCoordinates(p.x,p.y,HALF_BLOC_SIZE_DISPLAY);
	gfx.fillRect(coords[0],coords[1],coords[2],coords[3]);
	gfx.strokeRect(coords[0],coords[1],coords[2],coords[3]);
	
	// draw name
	gfx.fillStyle = 'hsl(' + p.hue + ', 100%, 90%)';
	gfx.strokeStyle =  'hsl(' + p.hue + ', 90%, 40%)';
	gfx.font = 'bold 50px Verdana';
	gfx.textAlign = 'center';
	gfx.lineWidth = 2;
	coords = boardToScreen(p.x,p.y-1);
	gfx.fillText(p.name, coords[0], coords[1]);
	gfx.strokeText(p.name, coords[0], coords[1]);
}

function drawBoard(gfx){
	// figure out how much can be seen by the player
	LosW = screenWidth / 2 / BLOC_TO_PIXELS;
	LosH = screenHeight / 2 / BLOC_TO_PIXELS;
	LosX0 = Math.round(Math.max(player.x - LosW,0));
	LosX1 = Math.round(Math.min(player.x + LosW, board.W-1));
	LosY0 = Math.round(Math.max(player.y - LosH,0));
	LosY1 = Math.round(Math.min(player.y + LosH, board.H-1));

	for (var c=-1; c < colors.length; c++) {
		// set brush color and target id
		var targetC;
		if (c == -1) { // first loop is for edges
			targetC = SIDE_WALL;
			gfx.fillStyle = BLOC_COLOR;
		} else {
			targetC = colors[c];
			gfx.fillStyle = 'hsl(' + targetC + ', 50%, 80%)';
		}
		
		var pad = HALF_BLOC_SIZE_DISPLAY*2;
		var sY=0, sX = Math.round(BLOC_TO_PIXELS*(LosX0 - player.x) + screenWidth /2 ) - HALF_BLOC_SIZE_DISPLAY;
		for (var i=LosX0;i<=LosX1;i++) {
			sY = Math.round(BLOC_TO_PIXELS*(LosY0 - player.y) + screenHeight /2 ) - HALF_BLOC_SIZE_DISPLAY;
			for (var j=LosY0;j<=LosY1;j++) {
				if (board.isBloc[i][j] == targetC){
					gfx.fillRect(sX,sY,pad,pad);
				}
				sY += BLOC_TO_PIXELS;
			}
			sX += BLOC_TO_PIXELS;
		}
	}
	// draw xp
	gfx.fillStyle = XP_COLOR;
	gfx.strokeStyle = XP_SCOLOR;
	gfx.lineWidth = XP_STROKE;
	var PI2 = 2*Math.PI;
	var sY=0, sX = Math.round(BLOC_TO_PIXELS*(LosX0 - player.x) + screenWidth /2 );
	for (var i=LosX0;i<=LosX1;i++) {
		sY = Math.round(BLOC_TO_PIXELS*(LosY0 - player.y) + screenHeight /2 );
		for (var j=LosY0;j<=LosY1;j++) {
			if (board.isXp[i][j]) {
				gfx.beginPath();
				gfx.arc(sX,sY,XP_RADIUS,0,PI2);
				gfx.fill();
				gfx.stroke();
			}
			sY += BLOC_TO_PIXELS;
		}
		sX += BLOC_TO_PIXELS;
	}
}
function boardToScreen(x,y){
	return [
		Math.round(BLOC_TO_PIXELS*(x - player.x) + screenWidth /2 ),
		Math.round(BLOC_TO_PIXELS*(y - player.y) + screenHeight /2 )
	];
}

function getBlocDrawCoordinates(x,y,size){
	var screenPos = boardToScreen(x,y);
	return [
		screenPos[0] - size,
		screenPos[1] - size,
		size*2,
		size*2
	];
}

/** Keyboard handling **/
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var KEY_SPACE = 32;
var NO_KEY = -1;

function bindKeyboard(){
	var c = document.getElementById('cvs');
	c.width = screenWidth; c.height = screenHeight;
	c.addEventListener('keydown', directionDown, false);
}

var lastDirectionPressed = NO_KEY;
var comboDirectionPressed = NO_KEY;
function directionDown(event) {
	var key = event.which || event.keyCode;
	if (key == KEY_LEFT || key == KEY_RIGHT || key == KEY_DOWN || key == KEY_UP) {
		if(!gameOver){
			if(lastDirectionPressed == NO_KEY) {
				lastDirectionPressed = key;
				updateTurnTargetPosition();
			} else {
				comboDirectionPressed = key; // TODO: combo doesn't work!
			}
		}
	} else if(key == KEY_SPACE) {
		if(gameOver)
			socket.emit('respawnRequest', playerName);
	}
}

var turnPosition = [0,0];
function updateTurnTargetPosition() {
	turnPosition[0] = Math.round(player.x + player.dx/2);
	turnPosition[1] = Math.round(player.y + player.dy/2);
}