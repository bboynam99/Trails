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
		resetBoard();
		queue = 0, queueMax = 0;
		document.getElementById('powerups').innerHTML = ''; // clear powerup description
		initBoard(b.boardW,b.boardH, b.LOS);
		updateDrawingSizes();
		player = newPlayer;
		player.name = playerName; // in case myNameIs hasn't registered yet
		player.size = 0;
		player.cdTimer = player.cooldown;
		gameOver = false;
		gameObjects = []; // clear all objects
		tick();
		socket.emit('myNameIs', playerName);		
		// THIS IS FOR TESTING ONLY:
		/*gameObjects.push({
			type: 8,
			dt:0,
			exp: 2.0,
			id: newPlayer.id
		});*/
	});
	
	socket.on('newVals', function (cts) {
		player.maxCooldown = cts.maxCooldown;
		player.lastDeltaPts = cts.dpts;
		player.teleportDist = cts.teleportDist;
		player.lpr = cts.lpr;
	});
	
	socket.on('trCd', function (cd) {
		player.cdTimer = cd;
		player.cooldown = cd;
	});
	
	socket.on('upBr', function (newBoard) {
		var id=0;
		for (var i=newBoard.pos[0];i<=newBoard.pos[1];i++) {
			for (var j=newBoard.pos[2];j<=newBoard.pos[3];j++) { // update xp and board
				board.isPowerUp[i][j] = 0;
				// the board state
				board.blockId[i][j] = newBoard.colors[newBoard.isBlock[id]]; 
				id++;
			}
		}
		// power ups if there are some
		if(newBoard.isPowerUp.length > 0)
			newBoard.isPowerUp.forEach(function(a){
				board.isPowerUp[a[0]][a[1]] = a[2];
			});
				
		// overide with short term client knowledge (to avoid flicker)
		lastFewBlocks.forEach(function(p) {
			board.blockId[p[0]][p[1]] = player.hue;
		});
		colors = [];
		for(var key in newBoard.colors) {
			var c = newBoard.colors[key];
			if(c >= 0)
				colors.push(newBoard.colors[key]);
		}
	});
	
	socket.on('upPl', function (updatedPlayers, selfUpdate) {
		// We keep some local values (x,y) because they're more reliable than server values (because of lag)
		updatedPlayers.forEach( function(p) {
			p.lastDeltaPts = p.dpts; // this will be used later
			if(otherPlayers)
				for ( var i=0; i < otherPlayers.length; i++ ) {
					var o = otherPlayers[i];
					if (o.id === p.id) { // if it's the same dude?
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
		player.pts = 0;
		otherPlayers = [];
		deathMessage = message;
		currentPhaseType = NO_PHASE;
	});
	
	socket.on('newHue', function (v) {
		player.hue = v;
	});

	socket.on('updateLeaderBoard', function (leaderBoard) {
		displayLeaderBoard(leaderBoard);
	});	
	
	socket.on('newAbility', function (description, flag) {
		teleportOverride = flag;
		document.getElementById('powerups').innerHTML = description;
	});
	
	socket.on('eliminatedPlayer', function (name) {
		lastFewBlocks = [];
		lastFewBlocksId = 0;
		lastEliminations.push({
			name: name,
			ts: Date.now()
		});
	});
	
	socket.on('sync', function (x,y) {
		player.x = x;
		player.y = y;
		updatePosition(); // update with server
	});
	
	socket.on('newState', function (x,y,dx,dy,hue) {
		player.x = x;
		player.y = y;
		player.dx = dx;
		player.dy = dy;
		player.hue = hue;
		lastFewBlocks = [];
		lastFewBlocksId = 0; 
	});
	
	socket.on('queue', function (q,qm) {
		queue = q;
		queueMax = qm;
	});
	
	socket.on('newO', function (o) {
		o.dt = 0;
		gameObjects.push(o);
	});
	
	socket.on('newPhase', function (type) {
		currentPhaseType = type;
		lastFewBlocks = [];
		lastFewBlocksId = 0; 
	});	
	
	socket.on('unphase', function () {
		currentPhaseType = NO_PHASE;
		lastFewBlocks = [];
		lastFewBlocksId = 0; 
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
			if(currentPhaseType == NO_PHASE){
				lastFewBlocks[lastFewBlocksId] = player.lastPos;
				lastFewBlocksId = (lastFewBlocksId+1) % FEW_BLOCKS_LENGTH;
			}
			// update if next block is edge
			if(player.x < 0 || player.y < 0 || player.x > board.H-1 || player.y > board.W-1) {
				updatePosition();
				gameOver = true; // server will validate this anyways, but doing it on client aswell feels more responsive
			}
			var newC = board.blockId[player.lastPos[0]][player.lastPos[1]];
			if(player.hue != newC && newC != EMPTY_BLOCK) {
				updatePosition(); // this will check with server for a game over.
			}
		}
		board.blockId[player.lastPos[0]][player.lastPos[1]] = player.hue; // gives a smooth display
	}
	
	updatePlayerDirection();
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			if (movePlayer(o, dt))
				if(o.lastPos[0] > 0 && o.lastPos[0] < board.W && o.lastPos[1] > 0 && o.lastPos[1] < board.H)
					board.blockId[o.lastPos[0]][o.lastPos[1]] = o.hue; // gives a smooth display
		});
	// update cooldown
	player.cooldown = Math.max(0, player.cooldown - dt);
	
	// update game objects
	updateGameObjects(dt);
	
	// update eliminated player
	for(var i=lastEliminations.length-1;i>=0;i--) {
		var ts = Date.now();
		const KILL_DISPLAY_TIME = 3000;
		if(ts - lastEliminations[i].ts > KILL_DISPLAY_TIME)
			lastEliminations.splice(i,1);
	}
	
	// update jitter effect for close call
	checkCloseCall();
}

Game.prototype.handleGraphics = function(gfx) {	
	// this is where everything is drawn
	if(queue > 0){
		gfx.fillStyle = '#fbfcfc';
		gfx.fillRect(0, 0, screenWidth, screenHeight);
		gfx.fillStyle = '#2ecc71';
		gfx.strokeStyle = '#27ae60';
		gfx.font = 'bold 50px Verdana';
		gfx.textAlign = 'center';
		gfx.lineWidth = 2;
		gfx.fillText('Server is full :(', screenWidth * 0.5, screenHeight * 0.4);
		gfx.strokeText('Server is full :(', screenWidth * 0.5, screenHeight * 0.4);
		gfx.font = '24px Verdana';
		gfx.fillText('Position in queue: ' + queue + ' of ' + queueMax + '.' , screenWidth * 0.5, screenHeight * 0.4 + 50);
		gfx.strokeText('Position in queue: ' + queue + ' of ' + queueMax + '.', screenWidth * 0.5, screenHeight * 0.4 + 50);
		return;
	}
	
	if (!player) // the game hasn't initialize yet!
		return;
		
	if(gameOver) {
		gfx.fillStyle = '#fbfcfc';
		gfx.fillRect(0, 0, screenWidth, screenHeight);
		gfx.fillStyle = '#f99';
		gfx.strokeStyle = '#900';
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
	switch(currentPhaseType) {
		case NO_PHASE:
		gfx.fillStyle = '#fbfcfc'; break;
		case INVIS:
		gfx.fillStyle = '#99ccff'; break;
		case DOOMSDAY:
		gfx.fillStyle = '#300'; break;
	}
		
	var los = board.LOS * BLOCK_TO_PIXELS;
	gfx.fillRect(cx - los, cy - los, 2*los, 2*los);

	// draw board
	var offsetJitter = isCloseCall ? getRandomInt(-10,10) : 0;
	drawBoard(gfx,offsetJitter);
	
	// draw players
	drawPlayer(gfx, player);
	if (otherPlayers)
		otherPlayers.forEach( function(o) {
			drawPlayer(gfx, o);
		});
	// draw game objects
	drawGameObjects(gfx);
	
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
		
		ex = bx + (ex-bx)*(1 - (player.cooldown / player.cdTimer));
		gfx.strokeStyle = '#fff';
		gfx.lineWidth = 8;
		gfx.beginPath();
		gfx.moveTo(bx,by);
		gfx.lineTo(ex,ey);
		gfx.stroke();
	}
	
	// draw teleport target
	if(spaceDown && currentPhaseType == NO_PHASE) {
		if(player.dx == player.dy)
			player.dy = 0;
		var tx = player.x + player.dx * player.teleportDist;
		var ty = player.y + player.dy * player.teleportDist;
		var coords = boardToScreen(tx,ty,true);
		gfx.strokeStyle = '#f00';
		gfx.lineWidth = 4;
		gfx.beginPath(); // draw "X"
			gfx.moveTo(coords[0]-HALF_BLOCK_SIZE_DISPLAY,coords[1]-HALF_BLOCK_SIZE_DISPLAY);
			gfx.lineTo(coords[0]+HALF_BLOCK_SIZE_DISPLAY,coords[1]+HALF_BLOCK_SIZE_DISPLAY);
			gfx.moveTo(coords[0]+HALF_BLOCK_SIZE_DISPLAY,coords[1]-HALF_BLOCK_SIZE_DISPLAY);
			gfx.lineTo(coords[0]-HALF_BLOCK_SIZE_DISPLAY,coords[1]+HALF_BLOCK_SIZE_DISPLAY);
		gfx.stroke();
	}
	
	// draw PU gui
	if(player.slots)
		drawPowerUpGUI(gfx,3*BLOCK_TO_PIXELS,3*BLOCK_TO_PIXELS,axisToSlots(player.slots),2*BLOCK_TO_PIXELS,true,true);
	
	// draw player elimination
	var offset = 0;
	lastEliminations.forEach(function(o) {
		gfx.fillStyle = '#2ecc71';
		gfx.strokeStyle = '#27ae60';
		gfx.font = 'bold 22px Verdana';
		gfx.textAlign = 'right';
		gfx.lineWidth = 2;
		gfx.fillText('Eliminated ', screenWidth * 0.5, screenHeight * 0.65 + offset);
		gfx.strokeText('Eliminated ', screenWidth * 0.5, screenHeight * 0.65 + offset);
		gfx.textAlign = 'left';
		gfx.fillStyle = '#ffbcbc';
		gfx.strokeStyle = '#ff2424';
		gfx.fillText(o.name, screenWidth * 0.5, screenHeight * 0.65 + offset);
		gfx.strokeText(o.name, screenWidth * 0.5, screenHeight * 0.65 + offset);
		
		offset += 25;
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
	blockId: null,
	isPowerUp: null,
	LOS: 0
};
var colors = []; // contains all colors to be drawn, received from server.
var gameObjects = [];
var lastFewBlocks = []; //client will always trust itself for board state of these pts
var lastFewBlocksId = 0; const FEW_BLOCKS_LENGTH = 5;
var lastUpdate = Date.now(); // used to compute the time delta between frames
var updateSize = [];
var lastEliminations = [];
function initBoard(H,W,LOS){
	// Board
	board.W = W;
	board.H = H;
	board.blockId = new Array(W);
	board.isPowerUp = new Array(W);
	board.LOS = LOS;
	for (var i=0;i<W;i++) {
		board.blockId[i] = new Array(H);
		board.isPowerUp[i] = new Array(H);
		for (var j=0;j<H;j++) {
			board.blockId[i][j] = EMPTY_BLOCK;
			board.isPowerUp[i][j] = 0;
			if(i == 0 || j == 0 || i == board.W-1 || j == board.H-1)
				board.blockId[i][j] = SIDE_WALL;
		}
	}
}
function resetBoard(){
	for (var i=0;i<board.W;i++) {
		for (var j=0;j<board.H;j++) {
			board.blockId[i][j] = EMPTY_BLOCK;
			board.isPowerUp[i][j] = 0;
		}
	}
}

var gameOver = false;
const NO_PHASE = 0, INVIS=6, DOOMSDAY=4;
var currentPhaseType = NO_PHASE;
var queue = 0, queueMax = 0;
var deathMessage = '';
var teleportOverride = false; // flags weather to trigger teleport or not

//
/** Game drawing constants **/
//
var HALF_BLOCK_SIZE_DISPLAY = 18; // the left and right padding in px when drawing a bloc
var BLOCK_TO_PIXELS = 36; // the size of a game bloc
var BLOCK_COLOR = '#777';
var PHASE_EXIT_COLOR = '#cf9';
var LINK_COLOR = '#99ccff';
var LINK_SCOLOR = '#00264d';
var LINK_INNER = 7;
var LINK_OUTER = 15;
var LINK_JITTER = 20; // adds a jitter effect (in px)
var POWERUP_RADIUS = 10;
var POWERUP_STROKE = 3;
var POWERUPSCOLOR = ['#cc0000','#660066','#003399','#339933','#ffcc00', '#ff5733'];
var POWERUPCOLOR = ['#ff5050', '#9900ff','#0066ff','#00cc00','#ffff00', '#ffbd33'];
var COLORDESCRIPTION = ['Fast','Sneaky','Solitary','Greedy','Destructive','Hostile'];
//
/** Game logic constants **/
//
var EMPTY_BLOCK = -1;
var SIDE_WALL = -2;
var PHASE_EXIT = -3;

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
	
	if (lastDirectionPressed == KEY_LEFT[0] && player.dx == 0) {
		changePlayerDirection(-1.0,0.0);
	} else if (lastDirectionPressed == KEY_RIGHT[0] && player.dx == 0) {
		changePlayerDirection(1.0,0.0);
	} else if (lastDirectionPressed == KEY_DOWN[0] && player.dy == 0) {
		changePlayerDirection(0.0,1.0);
	} else if (lastDirectionPressed == KEY_UP[0] && player.dy == 0) {
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

var isCloseCall=false; // this variable is set true if the player is in a position where he should die. The server tolerates close calls, so we give visual feedback instead.
function checkCloseCall() {
	isCloseCall = false;
	if(!otherPlayers || otherPlayers.length == 0)
		return;
	otherPlayers.forEach(function(o) {
		if(isCloseCall)
			return;
		var dx = Math.abs(o.x - player.x), dy = Math.abs(o.y - player.y);
		if (dx + dy < 1){
			isCloseCall = true;
			return;
		}
		if(dx + dy < 3 && ((dx < 0.5) ^ (dy < 0.5)) && o.dx == player.dx && o.dy == player.dy) {
			isCloseCall = true;
			return;
		}
	});
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
	// draw powerups GUI
	if(p.slots)
		drawPowerUpGUI(gfx,
			coords[0] + coords[2]/2,
			coords[1]+ coords[3]/2,
			axisToSlots(p.slots),
			HALF_BLOCK_SIZE_DISPLAY,
			false,false);
	
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

function axisToSlots(slots){
	return [	Math.max(slots[0],0),
				Math.max(slots[1],0),
				Math.max(slots[2],0),
				Math.max(-1*slots[0],0),
				Math.max(-1*slots[1],0),
				Math.max(-1*slots[2],0)
			];
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

function drawBoard(gfx,offsetJitter){
	// figure out how much can be seen by the player
	LosW = screenWidth / 2 / BLOCK_TO_PIXELS;
	LosH = screenHeight / 2 / BLOCK_TO_PIXELS;
	LosX0 = Math.round(Math.max(player.x - LosW,0));
	LosX1 = Math.round(Math.min(player.x + LosW, board.W-1));
	LosY0 = Math.round(Math.max(player.y - LosH,0));
	LosY1 = Math.round(Math.min(player.y + LosH, board.H-1));

	for (var c=-2; c < colors.length; c++) {
		// set brush color and target id
		var targetC;
		if (c == -1) { // second loop is for edges
			targetC = SIDE_WALL;
			gfx.fillStyle = BLOCK_COLOR;
		} else if (c == -2) { // first loop is for phase exists
			targetC = PHASE_EXIT;
			gfx.fillStyle = PHASE_EXIT_COLOR;
		} else {
			targetC = colors[c];
			if(targetC == player.hue) // self color is darker
				gfx.fillStyle = 'hsl(' + targetC + ', 100%, 60%)';
			else
				gfx.fillStyle = 'hsl(' + targetC + ', 70%, 80%)';
		}
		// draw board
		var pad = HALF_BLOCK_SIZE_DISPLAY*2;
		var sY=offsetJitter, sX = offsetJitter + Math.round(BLOCK_TO_PIXELS*(LosX0 - player.x) + screenWidth /2 ) - HALF_BLOCK_SIZE_DISPLAY;
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
	// draw power ups	
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

function drawPowerUpGUI(gfx,cx,cy,levels,scale,isDrawAllLines,isKeywordVisible) {
	const OFF = Math.PI *0.55;

	for (var i=0;i<levels.length;i++) {		
		if(isDrawAllLines){
			gfx.lineWidth = 1;
			gfx.strokeStyle = POWERUPSCOLOR[i];
			gfx.beginPath();
			gfx.moveTo(cx,cy);
			gfx.lineTo(cx + Math.cos(i*Math.PI/3 - OFF)*scale,cy + Math.sin(i*Math.PI/3 - OFF)*scale);
			gfx.stroke();
		}
		
		if(levels[i] != 0) {
			var dist = levels[i]/4 * scale;
			gfx.strokeStyle = POWERUPSCOLOR[i];
			gfx.lineWidth = 6;
			gfx.beginPath();
			gfx.moveTo(cx,cy);
			gfx.lineTo(cx + Math.cos(i*Math.PI/3 - OFF)*dist,cy + Math.sin(i*Math.PI/3 - OFF)*dist);
			gfx.stroke();
			gfx.strokeStyle = POWERUPCOLOR[i];
			gfx.lineWidth = 4;
			gfx.stroke();
		}
	}
	if(isKeywordVisible) {
		var TEXTDIST = scale*1.2;
		gfx.font = 'bold ' + Math.round(scale/5) +'px Verdana';
		gfx.textAlign = 'center';
		for (var i=0;i<levels.length;i++) {
			gfx.fillStyle = POWERUPSCOLOR[i];
			gfx.fillText(COLORDESCRIPTION[i], cx + Math.cos(i*Math.PI/3 - OFF)*TEXTDIST,cy + Math.sin(i*Math.PI/3 - OFF)*TEXTDIST);
		}
	}
}

function updateGameObjects(dt) {
	for(var i=gameObjects.length-1;i>=0;i--) {
		var l = gameObjects[i];
		switch(l.type){
			case 2: // Black hole
				l.dt += dt;
				if(l.dt >= l.exp)
					gameObjects.splice(i, 1);
				else {
					// attract player
					var dx = (l.x - player.x);
					var dy = (l.y - player.y);
					var dist = Math.sqrt(dx*dx+dy*dy);
					const BLKHL_RADIUS = 20, BLKHL_STR = 8;
					var mag = (1 - Math.min(dist / l.r,1)) * l.str;
					player.x += dx/dist * mag * dt;
					player.y += dy/dist * mag * dt;
				}
				break;
			case 3: // laser
				l.dt += dt;
				if(l.dt >= l.exp + LASER_PHASE3)
					gameObjects.splice(i, 1);
				break;
			default: // just add time until it expires: default behavior
				l.dt += dt;
				if(l.dt >= l.exp)
					gameObjects.splice(i, 1);
				break;
		}
	}
}

function drawGameObjects(gfx) {
	gameObjects.forEach(function (l) {
		switch(l.type) {
			case 1: // LINK
				//console.log('found type! its a link!');
				var A = getPlayerFromId(l.fromP);
				var B = getPlayerFromId(l.toP);
				if(!A || !B) // can't draw this link!
					break;
				var progress = l.dt / l.exp;
				
				switch(l.skin){
					case 1: // electric arc with fading color
						// compute line coords
						var progress = l.dt / l.exp;
						var s = boardToScreen(A.x,A.y,true);
						var x1 = A.x + (B.x - A.x) * progress,
							y1 = A.y + (B.y - A.y) * progress;
						var e = boardToScreen(x1,y1,true);
						//var s = [0,0], e = [screenWidth * progress,screenHeight * progress];
						
						var pts = new Array(22);
						var w = 0.0;
						var step = 1/(pts.length/2);
						for(var i=0; i<pts.length; i+=2) {
							pts[i] = s[0] + (e[0] - s[0]) * w + getRandomInt(-1 * LINK_JITTER, LINK_JITTER) * (((pts.length/2)-Math.abs(i - pts.length/2))/pts.length);
							pts[i+1] = s[1] + (e[1] - s[1]) * w + getRandomInt(-1 * LINK_JITTER, LINK_JITTER) * (((pts.length/2)-Math.abs(i - pts.length/2))/pts.length);
							w += step;
						}
						
						// draw outer line
						gfx.strokeStyle = '#000';
						gfx.lineWidth = LINK_OUTER;
						gfx.beginPath();
						gfx.moveTo(pts[0],pts[1]);
						for(var i=2; i<pts.length; i+=2) {
							gfx.lineTo(pts[i],pts[i+1]);
						}
						gfx.stroke();
						
						// draw inner line
						var gradient=gfx.createLinearGradient(0,0,170,0);
						gradient.addColorStop("0",'hsl('+A.hue+', 80%, 70%)');
						gradient.addColorStop("1.0",'hsl('+B.hue+', 80%, 70%)');

						gfx.strokeStyle = gradient;
						gfx.lineWidth = LINK_INNER;
						gfx.beginPath();
						gfx.moveTo(pts[0],pts[1]);
						for(var i=2; i<pts.length; i+=2) {
							gfx.lineTo(pts[i],pts[i+1]);
						}
						gfx.stroke();
						break;
					case 2: // arrow from B to A
						var s = boardToScreen(B.x,B.y,true);
						var x1 = B.x + (A.x - B.x) * progress,
							y1 = B.y + (A.y - B.y) * progress;
						var e = boardToScreen(x1,y1,true);
						//var s = [0,0], e = [screenWidth * progress,screenHeight * progress];
						drawArrow(gfx, l.dt, s[0], s[1], e[0], e[1]);
						break;
					case 3: // full line with a skull
						var s = boardToScreen(A.x,A.y,true);
						var e = boardToScreen(B.x,B.y,true);
						//var s = [0,0], e = [screenWidth,screenHeight];
						var x = s[0] + (e[0] - s[0]) * progress,
							y = s[1] + (e[1] - s[1]) * progress;
						
						// draw outer line
						gfx.strokeStyle = '#000';
						gfx.lineWidth = LINK_OUTER;
						gfx.beginPath();
						gfx.moveTo(s[0],s[1]);
						gfx.lineTo(e[0],e[1]);
						gfx.stroke();
						
						// draw inner line
						gfx.strokeStyle = '#800';
						gfx.lineWidth = LINK_INNER;
						gfx.beginPath();
						gfx.moveTo(s[0],s[1]);
						gfx.lineTo(e[0],e[1]);
						gfx.stroke();
						
						drawSkull(gfx, HALF_BLOCK_SIZE_DISPLAY, x, y-BLOCK_TO_PIXELS);
						break;
				}
				
				break; // end of LINK
			case 2: // BLACK HOLE
				var p = boardToScreen(l.x,l.y,true);
				drawBlkHl(gfx,p[0],p[1],0.35*l.r * BLOCK_TO_PIXELS,l.dt);
				break;// end of BLACK HOLE
			case 3: // Laser
				if(l.isH) {
					var s = boardToScreen(0,l.from,true);
					var e = boardToScreen(0,l.to,true);
					drawLaser(gfx,l.dt,l.exp,true,s[1]-HALF_BLOCK_SIZE_DISPLAY,e[1]+HALF_BLOCK_SIZE_DISPLAY);
				} else {
					var s = boardToScreen(l.from,0,false);
					var e = boardToScreen(l.to,0,true);
					drawLaser(gfx,l.dt,l.exp,false,s[0]-HALF_BLOCK_SIZE_DISPLAY,e[0]+HALF_BLOCK_SIZE_DISPLAY);
				}
				break;// end of Laser
			case 5: // bulldozer blade
				var p = getPlayerFromId(l.id);
				if(p) {
					gfx.fillStyle = '#e6e600';
					gfx.strokeStyle = '#4d4d00';
					gfx.lineWidth = 4;
					if(p.dx == 0){
						var ty = p.y + p.dy * 1.2 + p.size * p.dy;
						var coords = boardToScreen(p.x,ty,true);
						gfx.fillRect(coords[0]-BLOCK_TO_PIXELS*1.5, coords[1]-HALF_BLOCK_SIZE_DISPLAY, BLOCK_TO_PIXELS*3,BLOCK_TO_PIXELS);
						gfx.strokeRect(coords[0]-BLOCK_TO_PIXELS*1.5, coords[1]-HALF_BLOCK_SIZE_DISPLAY, BLOCK_TO_PIXELS*3,BLOCK_TO_PIXELS);
					}else if(p.dy == 0){
						var tx = p.x + p.dx * 1.2 + p.size * p.dx;
						var coords = boardToScreen(tx,p.y,true);
						gfx.fillRect(coords[0]-HALF_BLOCK_SIZE_DISPLAY,coords[1]-BLOCK_TO_PIXELS*1.5, BLOCK_TO_PIXELS,BLOCK_TO_PIXELS*3);
						gfx.strokeRect(coords[0]-HALF_BLOCK_SIZE_DISPLAY,coords[1]-BLOCK_TO_PIXELS*1.5, BLOCK_TO_PIXELS,BLOCK_TO_PIXELS*3);
					}
				}
			break;
			case 7: // AirBags
				var p = getPlayerFromId(l.id);
				if(p) {
						gfx.lineWidth = 2;
						gfx.fillStyle =  'rgba(200, 200, 200, 0.5)';
						gfx.strokeStyle =  '#000';
						coords = getBlocDrawCoordinates(p.x,p.y,BLOCK_TO_PIXELS);
						gfx.beginPath();
						gfx.arc(coords[0],coords[1],BLOCK_TO_PIXELS,.5*Math.PI,0);
						gfx.arc(coords[0]+coords[2],coords[1],BLOCK_TO_PIXELS,Math.PI,0.5*Math.PI);
						gfx.arc(coords[0]+coords[2],coords[1]+coords[3],BLOCK_TO_PIXELS,1.5*Math.PI,Math.PI);
						gfx.arc(coords[0],coords[1]+coords[3],BLOCK_TO_PIXELS,0,1.5*Math.PI);
						gfx.fill();
						gfx.stroke();
				}
			break;
			case 8: // C4
				var p = getPlayerFromId(l.id);
				if(p) {
						gfx.lineWidth = 6;
						
						for (var i=0;i<3;i++) {
							gfx.fillStyle =  'rgba('+getRandomInt(230,255)+', '+(getRandomInt(90,255))+', '+(getRandomInt(0,50))+', 0.75)';
							gfx.strokeStyle =  'rgba('+getRandomInt(230,255)+', '+(getRandomInt(0,255))+', '+(getRandomInt(0,15))+', 1.0)';
							coords = getBlocDrawCoordinates(p.x,p.y,HALF_BLOCK_SIZE_DISPLAY);
							gfx.beginPath();
							gfx.arc(coords[0]+getRandomInt(-1*HALF_BLOCK_SIZE_DISPLAY,BLOCK_TO_PIXELS),coords[1]+getRandomInt(-1*HALF_BLOCK_SIZE_DISPLAY,BLOCK_TO_PIXELS),HALF_BLOCK_SIZE_DISPLAY*getRandomInt(1,6),0,2*Math.PI);
							gfx.fill();
							gfx.stroke();
						}
				}
			break;
			
		}
		
	});
}

const LASER_PHASE1 = .33; // realive time of part1 of the animation
const LASER_PHASE2 = .67; // relative time of part2
const LASER_PHASE3 = 1.0; // absolute time in seconds for part3
function drawLaser(gfx, time,duration,isHorizontal, from, to) {
	// PHASE2
	progression = time/duration;
	if(progression > LASER_PHASE1) {
		gfx.fillStyle = 'hsl(0, 100%, '+(95-Math.round(Math.min(45,45*Math.min(1,(progression-LASER_PHASE1)/LASER_PHASE2))))+'%)';
		if(isHorizontal)
			gfx.fillRect(0, from, screenWidth, Math.abs(to - from));
		else
			gfx.fillRect(from, 0, Math.abs(to - from), screenHeight);
	}
	
	// PHASE1
	gfx.lineWidth = 5;
	gfx.strokeStyle = '#F00';
	var middle = from + Math.abs(to - from)/2
	var dd = Math.abs(to - from)/2 * Math.min(1,progression/LASER_PHASE1);
	gfx.beginPath();
	if(isHorizontal) {
		gfx.moveTo(0,middle+dd);
		gfx.lineTo(screenWidth,middle+dd);
		gfx.moveTo(0,middle-dd);
		gfx.lineTo(screenWidth,middle-dd);
	} else {
		gfx.moveTo(middle+dd,0);
		gfx.lineTo(middle+dd,screenHeight);
		gfx.moveTo(middle-dd,0);
		gfx.lineTo(middle-dd,screenHeight);
	}
	gfx.stroke();
	
	// PHASE3
	if(progression >= 1.0) {
		const N = 20;
		var colors = ['#800','#f93','#ff0'];
		for (c=0;c<colors.length;c++) {
			gfx.strokeStyle = colors[c];
			gfx.lineWidth = c+1;
			gfx.beginPath();
			if(isHorizontal) {
				gfx.moveTo(0,middle);
				for(var i=screenWidth/N; i<=screenWidth; i+=screenWidth/N) {
					var delta = getRandomInt(-5*dd, 5*dd) * ((screenWidth/2-Math.abs(i - screenWidth/2))/screenWidth);
					gfx.lineTo(i,middle+delta);
				}
			} else {
				gfx.moveTo(middle,0);
				for(var i=screenHeight/N; i<=screenHeight; i+=screenHeight/N) {
					var delta = getRandomInt(-5*dd, 5*dd) * ((screenHeight/2-Math.abs(i - screenHeight/2))/screenHeight);
					gfx.lineTo(middle+delta,i);
				}
			}
			gfx.stroke();
		}
	}
}

var PI2 = Math.PI/2;
function drawBlkHl(gfx,x,y,r,dt){
	// draw center part
	gfx.fillStyle = '#AAA';
	gfx.beginPath();
	gfx.arc(x,y,r,0,2*Math.PI);
	gfx.fill();

	gfx.fillStyle = '#444';
	gfx.beginPath();
	gfx.arc(x,y,.8*r,0,2*Math.PI);
	gfx.fill();

	gfx.fillStyle = '#000';
	gfx.beginPath();
	gfx.arc(x,y,.7*r,0,2*Math.PI);
	gfx.fill();

	gfx.lineWidth = 5; 
	gfx.strokeStyle = '#333';
	var phi = 2*Math.PI * dt * 0.075;
	for(var theta=phi;theta<Math.PI*2 + phi;theta += Math.PI * 0.25) {
		cx = Math.cos(theta) * r + x;
		cy = Math.sin(theta) * r + y;
		gfx.beginPath();
		gfx.arc(cx,cy,r,0+theta, 1.15*PI2 + theta);
		gfx.stroke();
	}
}

var skullScaleOff = 0;
function drawSkull(gfx, scale, x, y) {
	var max = Math.round(scale*1.5);
	scale = scale + (((max*.75)-Math.abs(skullScaleOff - max/2)))
	skullScaleOff = ++skullScaleOff % max;
	gfx.strokeStyle = '#000';
	gfx.lineWidth = 4;
	gfx.beginPath();
	gfx.arc(x,y,scale,0,2*Math.PI);
	gfx.stroke();
	gfx.beginPath();
	var o1 = 2*scale, o2 = .8*scale;
	gfx.moveTo(x-o1, y+o2);
	gfx.lineTo(x+o1, y+o1);
	gfx.moveTo(x+o1, y+o2);
	gfx.lineTo(x-o1, y+o1);
	o1 = .6*scale; o2 = .4*scale; var o3 = .2*scale
	gfx.moveTo(x-o1, y-o2);
	gfx.lineTo(x-o3, y);
	gfx.moveTo(x-o3, y-o2);
	gfx.lineTo(x-o1, y);

	gfx.moveTo(x+o3, y-o2);
	gfx.lineTo(x+o1, y);
	gfx.moveTo(x+o1, y-o2);
	gfx.lineTo(x+o3, y);
	gfx.stroke();
}

function drawArrow(gfx, dt, x0, y0, x1, y1, color, isDashed) {
	try {
	 //variables to be used when creating the arrow
	var headlen = 10;
	var angle = Math.atan2(y1-y0,x1-x0);
	//starting path of the arrow from the start square to the end square and drawing the stroke
	gfx.beginPath();
	gfx.moveTo(x0, y0);
	gfx.lineTo(x1, y1);
	gfx.setLineDash([5, 15]);
	gfx.lineDashOffset = Math.round(dt * 30);
	gfx.strokeStyle = "#cc0000";
	gfx.lineWidth = 5;
	gfx.stroke();
	
	//starting a new path from the head of the arrow to one of the sides of the point
	gfx.beginPath();
	gfx.moveTo(x1, y1);
	gfx.lineTo(x1-headlen*Math.cos(angle-Math.PI/7),y1-headlen*Math.sin(angle-Math.PI/7));

	//path from the side point of the arrow, to the other side point
	gfx.lineTo(x1-headlen*Math.cos(angle+Math.PI/7),y1-headlen*Math.sin(angle+Math.PI/7));

	//path from the side point back to the tip of the arrow, and then again to the opposite side point
	gfx.lineTo(x1, y1);
	gfx.lineTo(x1-headlen*Math.cos(angle-Math.PI/7),y1-headlen*Math.sin(angle-Math.PI/7));

	//draws the paths created above
	gfx.strokeStyle = "#cc0000";
	gfx.lineWidth = 5;
	gfx.stroke();
	gfx.fillStyle = "#cc0000";
	gfx.fill();
	} catch(ex){} finally {
		gfx.setLineDash([0,0]); 
		gfx.lineDashOffset=0;
	}
}

function useAbility() {
	if(player && currentPhaseType == NO_PHASE && player.cooldown == 0) {
		if(teleportOverride){
			socket.emit('teleport');
			return;
		} else {
			var tx = Math.round(player.x + player.dx * player.teleportDist);
			var ty = Math.round(player.y + player.dy * player.teleportDist);
			
			if((player.dx != 0 && tx > 1 && tx < board.W-2) || (player.dy != 0 && ty > 1 && ty < board.H-2)) {
				player.x = tx;
				player.y = ty;
				socket.emit('teleport',tx, ty, player.dx, player.dy);
				// TODO: draw a big red circle (explosion) on land
				triggerCooldown(player);
				clearFutureTurns(); // this is necessary, otherwise player goes nuts
			}
		}
	}
}

function triggerCooldown(player) {
	player.cooldown = player.maxCooldown;
	player.cdTimer = player.maxCooldown;
}

function displayLeaderBoard(leaderboard) {
	var status = '<h1>Recent High Scores</h1>';
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
var KEY_LEFT = [37,65];
var KEY_UP = [38,87];
var KEY_RIGHT = [39,68];
var KEY_DOWN = [40,83];
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
			key = KEY_DOWN[0];
		else if(deg < -45)
			key = KEY_LEFT[0];
		else if(deg > 45)
			key = KEY_RIGHT[0];
		else
			key = KEY_UP[0];

		applyKeyboardDirectionLogic(key);
	}, false);
}

var spaceDown = false;
function bindKeyboard(c) {
	c.addEventListener('keydown', directionDown, false);
	c.addEventListener('keyup', directionUp, false);
}

var lastDirectionPressed = NO_KEY;
var comboDirectionPressed = NO_KEY;
function directionDown(event) {
	var key = event.which || event.keyCode;
	if (KEY_DOWN[0] == key || KEY_DOWN[1] == key) {
		applyKeyboardDirectionLogic(KEY_DOWN[0]);
	} else if (KEY_LEFT[0] == key || KEY_LEFT[1] == key) {
		applyKeyboardDirectionLogic(KEY_LEFT[0]);
	} else if (KEY_RIGHT[0] == key || KEY_RIGHT[1] == key) {
		applyKeyboardDirectionLogic(KEY_RIGHT[0]);
	} else if (KEY_UP[0] == key || KEY_UP[1] == key) {
		applyKeyboardDirectionLogic(KEY_UP[0]);
	} else if(key == KEY_SPACE) {
		if(!teleportOverride)
			spaceDown = true;
		else
			spaceDown = false;
	}
}

function directionUp(event) {
	var key = event.which || event.keyCode;
	if(key == KEY_SPACE) {
		spaceDown = false;
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
		} else if(lastDirectionPressed != key) {
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

function updateDrawingSizes() {
	BLOCK_TO_PIXELS = Math.round(Math.min(screenHeight/board.LOS,screenWidth/board.LOS)); // the size of a game bloc
	HALF_BLOCK_SIZE_DISPLAY = Math.round(BLOCK_TO_PIXELS/2); // the left and right padding in px when drawing a bloc
	POWERUP_RADIUS = Math.round(HALF_BLOCK_SIZE_DISPLAY/2);
	POWERUP_STROKE = Math.round(POWERUP_RADIUS/3);
}

function getPlayerFromId(id) {
	if (player.id == id)
		return player;
		
	var i = otherPlayers.findIndex(function(p){return p.id == id});
	if(i > -1)
		return otherPlayers[i];
	return null;
}

var doCheck = true;
window.onresize = function(){
	if(doCheck) {
		doCheck = false;
		setTimeout(function(){
			doCheck = true;
			updateDrawingSizes();
		},200);
	}
};


setInterval(updatePosition, 500);