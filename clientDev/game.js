function Game() { };
//
/** Game loops **/
//
Game.prototype.handleNetwork = function(socket) {
	s = socket;
	socket.emit('myNameIs', playerName);
	
	var c = document.getElementById('cvs');
	c.width = screenWidth; c.height = screenHeight;
	bindKeyboard(c);
	bindClickTap(c);
	
	// this is where all socket messages are received
	socket.on('playerSpawn', function (newPlayer, b) {
		document.getElementById('powerups').innerHTML = ''; // clear powerup description
		initBoard(b.boardW,b.boardH, b.LOS);
		player = newPlayer;
		player.name = playerName; // in case myNameIs hasn't registered yet
		player.size = 0;
		player.lpr = newPlayer.lpr;
		gameOver = false;
		tick();
	});
	
	socket.on('newVals', function (cts) {
		player.maxCooldown = cts.maxCooldown;
		player.lastDeltaPts = cts.dpts;
		player.teleportDist = cts.teleportDist;
		player.lpr = cts.lpr;
	});
	
	
	socket.on('updateBoard', function (newBoard) {
		for (var i=newBoard.x0;i<newBoard.x1;i++) {
			for (var j=newBoard.y0;j<newBoard.y1;j++) { // update xp and board
				board.isPowerUp[i][j] = newBoard.isPowerUp[i-newBoard.x0][j-newBoard.y0];
				board.blockId[i][j] = newBoard.blockId[i-newBoard.x0][j-newBoard.y0]; 
			}
		}
		// overide with short term client knowledge (to avoid flicker)
		lastFewBlocks.forEach( function(p) {
			board.blockId[p[0]][p[1]] = player.hue;
		});
		colors = newBoard.colors;
	});
	
	socket.on('updatePlayers', function (updatedPlayers, newLinks, selfUpdate) {
		// We keep some local values (x,y) because they're more reliable than server values (because of lag)
		updatedPlayers.forEach( function(p) {
			p.lastDeltaPts = p.dpts; // this will be used later
			if(otherPlayers)
				for ( var i=0; i < otherPlayers.length; i++ ) {
					var o = otherPlayers[i];
					if (o.name === p.name && o.hue === p.hue) { // if it's the same dude?
						if(o.dx == p.dx && o.dy == p.dy) { // if the direction hasn't changed
							if(Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < (Math.abs(o.dx) + Math.abs(o.dy)) * o.velocity * 0.1) {
								// keep the old values if the delta is small (to avoid jitter)
								p.x = otherPlayers[i].x;
								p.y = otherPlayers[i].y;
							}
							if(Math.abs(p.pts - o.pts) < p.dpts) {
								// keep the score values if the delta is small (to avoid jitter)
								p.pts = o.pts;
							}
						}
						break;
					}
				}
		});
		otherPlayers = updatedPlayers;
		links = newLinks;
		if(Math.abs(player.pts - selfUpdate.pts) > selfUpdate.dpts) {
			player.pts = selfUpdate.pts; // avoid jitter
		}
		player.dpts = selfUpdate.dpts;
		player.lastDeltaPts = selfUpdate.dpts; //cached dpts
		player.velocity = selfUpdate.velocity;
		player.slots = selfUpdate.slots;
	});
	
	socket.on('playerDied', function (message) {
		gameOver = true;
		lastFewBlocks = [];
		lastFewBlocksId = 0;
		player.size = 0;
		otherPlayers = [];
		deathMessage = message;
	});
	
	socket.on('newHue', function (v) {
		player.hue = v;
	});

	socket.on('updateLeaderBoard', function (leaderBoard) {
		displayLeaderBoard(leaderBoard);
	});	
	
	socket.on('newAbility', function (description) {
		document.getElementById('powerups').innerHTML = description;
	});
	
	socket.on('eliminatedPlayer', function () {
		console.log('eliminate player.');
		var lastFewBlocks = [];
		var lastFewBlocksId = 0; 
	});
}

Game.prototype.handleLogic = function() {
	if (!player || gameOver) // the game hasn't initialized yet!
		return;
		
	// move player
	var dt = tick();
	var isNewBloc = movePlayer(player, dt);
	if(isNewBloc) {
		if(player.lastPos) { // this queue remembers last few values to reduce flicker from client-server disagreement
			lastFewBlocks[lastFewBlocksId] = player.lastPos;
			lastFewBlocksId = (lastFewBlocksId+1) % FEW_BLOCKS_LENGTH;
			
			// update if next block is edge
			if(player.x < 0 || player.y < 0 || player.x > board.H-1 || player.y > board.W-1) {
				updatePosition();
				gameOver = true; // server will validate this anyways, but doing it on client aswell feels more responsive
			}
			var newC = board.blockId[player.lastPos[0]][player.lastPos[1]];
			console.log('new square=' + newC + ' and player color = ' + player.hue);
			if(player.hue != newC && newC != EMPTY_BLOCK) {
				updatePosition();
				//gameOver = true;
			}
		}
		board.blockId[player.lastPos[0]][player.lastPos[1]] = player.hue; // gives a smooth display
	}
	
	updatePlayerDirection();
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			if (movePlayer(o, dt))
				board.blockId[o.lastPos[0]][o.lastPos[1]] = o.hue; // gives a smooth display
		});
	// update cooldown
	player.cooldown = Math.max(0, player.cooldown - dt);
}

Game.prototype.handleGraphics = function(gfx) {
	if (!player) // the game hasn't initialize yet!
		return;
	
	// this is where everything is drawn
	
	if(gameOver) {
		gfx.fillStyle = '#fbfcfc';
		gfx.fillRect(0, 0, screenWidth, screenHeight);
		gfx.fillStyle = '#2ecc71';
		gfx.strokeStyle = '#27ae60';
		gfx.font = 'bold 50px Verdana';
		gfx.textAlign = 'center';
		gfx.lineWidth = 2;
		gfx.fillText('G A M E  O V E R', screenWidth * 0.5, screenHeight * 0.4);
		gfx.strokeText('G A M E  O V E R', screenWidth * 0.5, screenHeight * 0.4);
		gfx.font = '24px Verdana';
		gfx.fillText(deathMessage, screenWidth * 0.5, screenHeight * 0.4 + 50);
		gfx.strokeText(deathMessage, screenWidth * 0.5, screenHeight * 0.4 + 50);
		gfx.font = '20px Verdana';
		gfx.fillText('press space bar to respawn...', screenWidth * 0.5, screenHeight * 0.7);
		gfx.strokeText('press space bar to respawn...', screenWidth * 0.5, screenHeight * 0.7);
		return;
	}
	
	gfx.fillStyle = '#CCC';
	gfx.fillRect(0, 0, screenWidth, screenHeight);
	var cx = screenWidth / 2;
	var cy = screenHeight / 2;
	gfx.fillStyle = '#fbfcfc';
	gfx.fillRect(cx - board.LOS, cy - board.LOS, 2*board.LOS, 2*board.LOS);

	// draw board
	drawBoard(gfx);
	
	// draw players
	drawPlayer(gfx, player);
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			drawPlayer(gfx, o);
		});
	// drawLinks
	drawLinks(gfx);
	
	//draw cooldown marker
	if(player.cooldown > 0) {
		var bx = screenWidth * 0.5 - HALF_BLOCK_SIZE_DISPLAY*.8,
			by = screenHeight * 0.5 - HALF_BLOCK_SIZE_DISPLAY*1.3;
		var ex = screenWidth * 0.5 + HALF_BLOCK_SIZE_DISPLAY*.8,
			ey = by;
		gfx.strokeStyle = '#000';
		gfx.lineWidth = 10;
		gfx.beginPath();
		gfx.moveTo(bx,by);
		gfx.lineTo(ex,ey);
		gfx.stroke();
		
		ex = bx + (ex-bx)*(1 - (player.cooldown / player.maxCooldown));
		gfx.strokeStyle = '#fff';
		gfx.lineWidth = 8;
		gfx.beginPath();
		gfx.moveTo(bx,by);
		gfx.lineTo(ex,ey);
		gfx.stroke();
	}
}

//
/** Game logic variables **/
//
var player = null;
var otherPlayers = null;
var board = {
	H: 0,
	W: 0,
	blockId: null,
	isPowerUp: null,
	LOS: 0
};
var colors = []; // contains all colors to be drawn, received from server.
var links = [];
var lastFewBlocks = []; //client will always trust itself for board state of these pts
var lastFewBlocksId = 0; var FEW_BLOCKS_LENGTH = 10;
var lastUpdate = Date.now(); // used to compute the time delta between frames
var updateSize = [];
function initBoard(H,W,LOS){
	// Board
	board.W = W;
	board.H = H;
	board.blockId = new Array(W);
	board.isPowerUp = new Array(W);
	board.LOS = LOS * BLOCK_TO_PIXELS;
	for (var i=0;i<W;i++) {
		board.blockId[i] = new Array(H);
		board.isPowerUp[i] = new Array(H);
		for (var j=0;j<H;j++) {
			board.blockId[i][j] = EMPTY_BLOCK;
			board.isPowerUp[i][j] = 0;
		}
	}
}
var gameOver = false;
var deathMessage = '';

//
/** Game drawing constants **/
//
var HALF_BLOCK_SIZE_DISPLAY = 18; // the left and right padding in px when drawing a bloc
var BLOCK_TO_PIXELS = 36; // the size of a game bloc
var BLOCK_COLOR = '#777';
var LINK_COLOR = '#99ccff';
var LINK_SCOLOR = '#00264d';
var LINK_INNER = 7;
var LINK_OUTER = 15;
var LINK_JITTER = 5; // adds a jitter effect (in px)
var POWERUP_RADIUS = 10;
var POWERUP_STROKE = 3;
var POWERUPSCOLOR = ['#660066','#ffcc00','#003399','#339933','#cc0000', '#ff5733'];
var POWERUPCOLOR = ['#9900ff','#ffff00','#0066ff','#00cc00','#ff5050', '#ffbd33'];
//
/** Game logic constants **/
//
var EMPTY_BLOCK = -1;
var SIDE_WALL = -2;

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
		changePlayerDirection(-1.0,0.0);
	} else if (lastDirectionPressed == KEY_RIGHT && player.dx == 0) {
		changePlayerDirection(1.0,0.0);
	} else if (lastDirectionPressed == KEY_DOWN && player.dy == 0) {
		changePlayerDirection(0.0,1.0);
	} else if (lastDirectionPressed == KEY_UP && player.dy == 0) {
		changePlayerDirection(0.0,-1.0);
	}
	// if we had a delta, adjust according to the new direction
	player.x += player.dx * (delta);
	player.y += player.dy * (delta);
	lastDirectionPressed = comboDirectionPressed;
	comboDirectionPressed = NO_KEY;
	updateTurnTargetPosition();
}

function changePlayerDirection(dx,dy) {
	player.dx = dx;
	player.dy = dy;
	updatePosition();
}

// player position update. returns true if the bloc has changed.
function movePlayer(p, dt) {
	p.x += p.dx * p.velocity * dt;
	p.y += p.dy * p.velocity * dt;
	var squareX = Math.round(p.x - p.dx*.5), squareY = Math.round(p.y - p.dy*.5);
	squareX = Math.min(Math.max(squareX,0),board.W-1);
	squareY = Math.min(Math.max(squareY,0),board.H-1);
	dilation(squareX,squareY,Math.floor(p.size),p.hue);
	
	// check if it's a new value
	var value = false;
	if (p.lastPos && (p.lastPos[0] != squareX || p.lastPos[1] != squareY)) {
		value = true;
	}
	p.lastPos = [squareX, squareY];
		
	// update points
	var x = Math.round(p.x + p.dx*(Math.floor(p.size)+1)), y = Math.ceil(p.y + p.dy*(Math.floor(p.size)+1));
	if((x > 0 && y > 0 && x < board.W-1 && y < board.H-1)) {
		if(board.blockId[x][y] == p.hue) {
			p.lastDeltaPts = (p.dpts*p.lpr);
			//console.log('red');
		}else
			p.lastDeltaPts = p.dpts;
		
		p.pts += p.lastDeltaPts * dt;
		//console.log('points changed to: ' + Math.round(p.pts));
	}
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
	p.size = getBonusSize(p.pts);
	var size = HALF_BLOCK_SIZE_DISPLAY * (1+2*p.size);
	var coords = getBlocDrawCoordinates(p.x,p.y,size);
	gfx.fillRect(coords[0],coords[1],coords[2],coords[3]);
	gfx.strokeRect(coords[0],coords[1],coords[2],coords[3]);
	
	// draw center frame
	gfx.lineWidth = 1;
	gfx.strokeStyle =  '#999';
	coords = getBlocDrawCoordinates(p.x,p.y,HALF_BLOCK_SIZE_DISPLAY);
	gfx.strokeRect(coords[0],coords[1],coords[2],coords[3]);
	// draw powerups
	if(p['slots']){
		var k=0;
		for(var i=0;i<2;i++)
			for(var j=0;j<2;j++){
				var id = p.slots[k++];
				if(id > 0) {
					gfx.fillStyle = POWERUPCOLOR[id - 1];
					gfx.fillRect(coords[0] + coords[2]/2 * i,coords[1]+ coords[3]/2 * j,coords[2]/2,coords[3]/2);
				}
			}
	}
	
	// draw name
	gfx.fillStyle = 'hsl(' + p.hue + ', 100%, 90%)';
	gfx.strokeStyle =  'hsl(' + p.hue + ', 90%, 40%)';
	gfx.font = 'bold 25px Verdana';
	gfx.textAlign = 'center';
	gfx.lineWidth = 2;
	//var coordsName = boardToScreen(p.x,p.y-1);
	var nx = coords[0] + coords[2]/2, ny = coords[1] - coords[3]*.35;
	gfx.fillText(p.name, nx, ny);
	gfx.strokeText(p.name, nx, ny);
	
	// draw score
	if(p.lastDeltaPts > 0) {
		gfx.fillStyle = '#060';
	} else if(p.lastDeltaPts < 0) {
		gfx.fillStyle = '#c00';
	}
	gfx.strokeStyle = '#fff';
	gfx.font = 'bold 16px Verdana';
	var t = Math.ceil(p.pts);
	//nx = coords[0] + BLOCK_TO_PIXELS*1.5, ny = coords[1] - BLOCK_TO_PIXELS*.35;
	nx = coords[0] + coords[2]*.75, ny = coords[1] + coords[3]*1.2;
	gfx.strokeText(t,nx,ny);
	gfx.fillText(t,nx,ny);
}

function getBonusSize(score) {
	 var x = Math.pow(score/1000,0.333333);
	 var xa = Math.floor(x);
	 
	 var dx = (x-xa);
	 return xa + Math.pow(dx,4);
}

function dilation(x,y,s,v) {
	// make the line fatter
	if (s > 0) {
		var x0 = Math.max(x - s,0);
		var x1 = Math.min(x + s, board.W - 1);
		var y0 = Math.max(y - s,0);
		var y1 = Math.min(y + s, board.H - 1);
		for(i=x0;i<=x1;i++)
			for(j=y0;j<=y1;j++)
				if (board.blockId[i][j] == EMPTY_BLOCK) {
					board.blockId[i][j] = v;
				}
	}
}

function drawBoard(gfx){
	// figure out how much can be seen by the player
	LosW = screenWidth / 2 / BLOCK_TO_PIXELS;
	LosH = screenHeight / 2 / BLOCK_TO_PIXELS;
	LosX0 = Math.round(Math.max(player.x - LosW,0));
	LosX1 = Math.round(Math.min(player.x + LosW, board.W-1));
	LosY0 = Math.round(Math.max(player.y - LosH,0));
	LosY1 = Math.round(Math.min(player.y + LosH, board.H-1));

	for (var c=-1; c < colors.length; c++) {
		// set brush color and target id
		var targetC;
		if (c == -1) { // first loop is for edges
			targetC = SIDE_WALL;
			gfx.fillStyle = BLOCK_COLOR;
		} else {
			targetC = colors[c];
			if(targetC == player.hue) // self color is darker
				gfx.fillStyle = 'hsl(' + targetC + ', 100%, 60%)';
			else
				gfx.fillStyle = 'hsl(' + targetC + ', 70%, 80%)';
		}
		
		var pad = HALF_BLOCK_SIZE_DISPLAY*2;
		var sY=0, sX = Math.round(BLOCK_TO_PIXELS*(LosX0 - player.x) + screenWidth /2 ) - HALF_BLOCK_SIZE_DISPLAY;
		for (var i=LosX0;i<=LosX1;i++) {
			sY = Math.round(BLOCK_TO_PIXELS*(LosY0 - player.y) + screenHeight /2 ) - HALF_BLOCK_SIZE_DISPLAY;
			for (var j=LosY0;j<=LosY1;j++) {
				if (board.blockId[i][j] == targetC){
					gfx.fillRect(sX,sY,pad,pad);
				}
				sY += BLOCK_TO_PIXELS;
			}
			sX += BLOCK_TO_PIXELS;
		}
	}
	// draw xp
	gfx.lineWidth = POWERUP_STROKE;
	var PI2 = 2*Math.PI;
	var sY=0, sX = Math.round(BLOCK_TO_PIXELS*(LosX0 - player.x) + screenWidth /2 );
	for (var i=LosX0;i<=LosX1;i++) {
		sY = Math.round(BLOCK_TO_PIXELS*(LosY0 - player.y) + screenHeight /2 );
		for (var j=LosY0;j<=LosY1;j++) {
			if (board.isPowerUp[i][j] > 0) {
				gfx.fillStyle = POWERUPCOLOR[board.isPowerUp[i][j]-1];
				gfx.strokeStyle = POWERUPSCOLOR[board.isPowerUp[i][j]-1];
				gfx.beginPath();
				gfx.arc(sX,sY,POWERUP_RADIUS,0,PI2);
				gfx.fill();
				gfx.stroke();
			}
			sY += BLOCK_TO_PIXELS;
		}
		sX += BLOCK_TO_PIXELS;
	}
}

function drawLinks(gfx) {
	if(links)
		links.forEach( function(l) {
			// compute line coords
			var s = boardToScreen(l.x0,l.y0,true);
			var x1 = l.x0 + (l.x1 - l.x0) *(1.6 * l.progress),
				y1 = l.y0 + (l.y1 - l.y0) * (1.6 * l.progress);
			var e = boardToScreen(x1,y1,true);
			
			var pts = new Array(22);
			var w = 0.0;
			for(var i=0; i<=20; i+=2) {
				pts[i] = s[0] + (e[0] - s[0]) * w + getRandomInt(-1 * LINK_JITTER, LINK_JITTER);
				pts[i+1] = s[1] + (e[1] - s[1]) * w + getRandomInt(-1 * LINK_JITTER, LINK_JITTER);
				w += 0.05;
			}
			
			// draw outer line
			gfx.strokeStyle = LINK_SCOLOR;
			gfx.lineWidth = LINK_OUTER;
			gfx.beginPath();
			gfx.moveTo(pts[0],pts[1]);
			for(var i=2; i<pts.length; i+=2) {
				gfx.lineTo(pts[i],pts[i+1]);
			}
			gfx.stroke();
			
			// draw inner line
			gfx.strokeStyle = LINK_COLOR;
			gfx.lineWidth = LINK_INNER;
			gfx.beginPath();
			gfx.moveTo(pts[0],pts[1]);
			for(var i=2; i<pts.length; i+=2) {
				gfx.lineTo(pts[i],pts[i+1]);
			}
			gfx.stroke();
		});
}

function useAbility() {
	if(player && player.cooldown == 0) {
		var tx = Math.round(player.x + player.dx * player.teleportDist);
		var ty = Math.round(player.y + player.dy * player.teleportDist);
		
		if((player.dx != 0 && tx > 1 && tx < board.W-2) || (player.dy != 0 && ty > 1 && ty < board.H-2)) {
			player.x = tx;
			player.y = ty;
			socket.emit('powerupUsed',tx, ty);
			// TODO: draw a big red circle (explosion) on land
			player.cooldown = player.maxCooldown;
			clearFutureTurns(); // this is necessary, otherwise player goes nuts
		}
	}
}

function displayLeaderBoard(leaderboard) {
	var status = '<h1>Leaderboard</h1>';
	i = 1;
	if(leaderboard)
		leaderboard.forEach( function(l) {
			status += '<br />';
			status += '<span style="float:left">' + (i++) + '. ' + l.name + '</span>&nbsp;&nbsp;&nbsp;' + '<span style="float:right">' + l.score + '</span>';
		});
	document.getElementById('leaderboard').innerHTML = status;
}

function boardToScreen(x,y,isfloat){
	if(isfloat)
		return [
			BLOCK_TO_PIXELS*(x - player.x) + screenWidth /2,
			BLOCK_TO_PIXELS*(y - player.y) + screenHeight /2
		];
	else
		return [
			Math.round(BLOCK_TO_PIXELS*(x - player.x) + screenWidth /2 ),
			Math.round(BLOCK_TO_PIXELS*(y - player.y) + screenHeight /2 )
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

var TAP_CENTER_REL_DIST = 0.05;
function bindClickTap(c) {
	c.addEventListener('click', function(event) {
		// figure out where the tap happened
		var w2 = screenWidth/2,
			h2 = screenHeight/2;
		var rx = event.x-w2,
			ry = h2-event.y;
		if(Math.sqrt(rx*rx+ry*ry) <= screenWidth * TAP_CENTER_REL_DIST)
		{
			if(gameOver) // SPACE BAR LOGIC
				socket.emit('respawnRequest', playerName);
			else if(!gameOver)
				useAbility();
			return;
		}
		
		var key = null;
		var deg = 180 * Math.atan2(rx, ry) / Math.PI;
		if(deg < -135 || deg > 135)
			key = KEY_DOWN;
		else if(deg < -45)
			key = KEY_LEFT;
		else if(deg > 45)
			key = KEY_RIGHT;
		else
			key = KEY_UP;

		applyKeyboardDirectionLogic(key);
	}, false);
}

function bindKeyboard(c) {
	c.addEventListener('keydown', directionDown, false);
}

var lastDirectionPressed = NO_KEY;
var comboDirectionPressed = NO_KEY;
function directionDown(event) {
	var key = event.which || event.keyCode;
	if (key == KEY_LEFT || key == KEY_RIGHT || key == KEY_DOWN || key == KEY_UP) {
		applyKeyboardDirectionLogic(key);
	} else if(key == KEY_SPACE) {
		if(gameOver)
			socket.emit('respawnRequest', playerName);
		else if(!gameOver)
			useAbility();
	}
}

function applyKeyboardDirectionLogic(key) {
	if(!gameOver) {
		if(lastDirectionPressed == NO_KEY) {
			lastDirectionPressed = key;
			updateTurnTargetPosition();
		} else {
			comboDirectionPressed = key;
		}
	}
}

function clearFutureTurns() {
	turnPosition = [0,0];
	lastDirectionPressed = NO_KEY;
	comboDirectionPressed = NO_KEY;
}
var turnPosition = [0,0];
function updateTurnTargetPosition() {
	turnPosition[0] = Math.round(player.x + player.dx/2);
	turnPosition[1] = Math.round(player.y + player.dy/2);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updatePosition() {
	if(player && !gameOver && socket)
		socket.emit('mv', {x:player.x, y:player.y, dx:player.dx, dy:player.dy});
}
setInterval(updatePosition, 500);