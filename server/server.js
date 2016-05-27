var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var config  = require('./config.json');
app.use(express.static(__dirname + '/../client'));

//
/** Game Constants **/
//
var SPAWN_SPACE_NEEDED = 5;
var INITIAL_VELOCITY = 5.0;
var NUM_XP_ONBOARD = 25;
var MAX_PLAYER_SPEED = 15;
var FREQ_XP_DROP_ONDEATH = 4; // xp drop freq
var MAX_XP_ONBOARD = 250; // xp drop freq
var SPEED_BOOST_PER_XP = .04; // speed gain per xp
var LINK_START = 0.25; // link will show after this (ms)
var LINK_END = 2; // link will end after this
var LINK_RANGE = 5; // link will start at this distance
var LINK_SUSTAIN = 10; // link will stay alive at this range (hysteresis)
var POWERUP_CLEAR_RADIUS = 6; // upond landing, a circle of this radius will be cleared
var TELEPORT_DISTANCE = 10; // TODO: this should be received from server
var POWERUP_COOLDOWN = 10;
var MAX_HEARTBEAT_KICK = 5000; // player will be killed after no input (ms);
var MAX_DESYNC_TOLERENCE = 0.5; // the number of sec of desync tolerated before the player is kicked
// Flags for the bloc board state
var B_EMPTY = 0;
var B_BORDERS = 10;
var B_KILLSYOUTHRESHOLD = 5; // anything above that kills you

//
/** Game variables **/
//
var users = []; // players and their data
var board = { // game board
	H: 100,
	W: 100,
	isBloc: null,
	isXp: null,
};
var numXp = 0;
// init board
board.isBloc = new Array(board.W);
board.isXp = new Array(board.W);
for (var i=0;i<board.W;i++) {
	board.isBloc[i] = new Array(board.H);
	board.isXp[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		board.isXp[i][j] = false;
		board.isBloc[i][j] = B_EMPTY;
		if(i == 0 || j == 0 || i == board.W-1 || j == board.H-1)
			board.isBloc[i][j] = B_BORDERS;
	}
}

var playerBoard = new Array(board.W); // allows to efficiently retrieve nearby players
for (var i=0;i<board.W;i++) {
	playerBoard[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		playerBoard[i][j] = null;
	}
}

var blocIdLUT = {};
var blocIdGenerator = 11;
var links = []; // link maps between players
var colorsLUT = [];
var leaderBoard = [];

//
/** Socket communication (game events) **/
//
var sockets = {};
io.on('connection', function (socket) {
	console.log("A new player has connected: " + socket.id);
	sockets[socket.id] = socket;
		
	var spawnPosition = findGoodSpawn();
	var player = {
		id: socket.id,
		isDead: false,
		x: spawnPosition[0],
		y: spawnPosition[1],
		lastX: spawnPosition[0],
		lastY: spawnPosition[1],
		dx: 0.0,
		dy: 0.0,
		velocity: INITIAL_VELOCITY, // in blocs per second
		cooldown: POWERUP_COOLDOWN,
		xp: 0,
		hue: getUnusedColor(),
		lastHeartbeat: new Date().getTime(),
		name: '',
		blocId: blocIdGenerator,
		desyncCounter: 0 // the cumulated delta between client and server
	};
	colorsLUT[player.blocId] = player.hue;
	blocIdLUT[blocIdGenerator] = player;
	blocIdGenerator++;
	
	users.push(player);
	
	socket.on('myNameIs', function (name) {
		player['name'] = name;
	});	
	
	// emit [player, board]
	function emitRespawn() {
		player.hue = getUnusedColor(); // player is no longer part of any other hue groups!
		colorsLUT[player.blocId] = player.hue;
		player.isDead = false;
		socket.emit('playerSpawn',{
			x: player.x,
			y: player.y,
			dx:player.dx,
			dy:player.dy,
			velocity:player.velocity,
			hue: player.hue,
			cooldown: player.cooldown,
			maxCooldown: POWERUP_COOLDOWN,
			teleportDist: TELEPORT_DISTANCE
		}, {
			boardW:board.W,
			boardH:board.H
		});
	}
	emitRespawn();

		
	socket.on('playerMove', function (newPosition) {
		//console.log('moving from ('+player.x+','+player.y+') to ('+newPosition.x+','+newPosition.y+') with delta ('+player.dx+','+player.dy+') and velocity '+player.velocity)
		if(!player.isDead) {
			// check if new position is reasonable. If sketchy, close socket.
			var serverTravelTime = (Math.abs(player.x - player.lastX) + Math.abs(player.y - player.lastY)) / player.velocity;
			var clientTravelTime = (Math.abs(newPosition.x - player.lastX) + Math.abs(newPosition.y - player.lastY)) / player.velocity;
			player.desyncCounter += serverTravelTime - clientTravelTime;
			
			var x = player.lastX, y = player.lastY;
			var nx = Math.round(newPosition.x), ny = Math.round(newPosition.y);
			player.lastHeartbeat = new Date().getTime(); // see function checkHeartBeat
			player.x = newPosition.x;
			player.y = newPosition.y;
			board.isBloc[x][y] = player.blocId;
			player.lastX = nx;
			player.lastY = ny;
			
			if(board.isXp[nx][ny]) {
				board.isXp[nx][ny] = false;
				numXp--;
				player.velocity = Math.min(player.velocity + SPEED_BOOST_PER_XP, MAX_PLAYER_SPEED);
				player.xp++;
				sockets[player.id].emit('newSpeed', player.velocity);
			}
			
			if((nx <= 0 || ny <= 0 || nx >= board.W-1 || ny >= board.H-1) || // need to explicitly check if still on board (because of the lag, will not always hit boundary walls)
				colorsLUT[board.isBloc[nx][ny]] != player.hue && board.isBloc[nx][ny] > B_KILLSYOUTHRESHOLD) {
				killPlayer(player, true); 
			} else if(nx != x || ny != y) {
				playerBoard[x][y] = null;
				playerBoard[nx][ny] = player;
			}
		}
	});
	socket.on('directionChange', function (direction) {
		if(!player.isDead){
			player.dx = direction.dx;
			player.dy = direction.dy;
		}
	});
	
	socket.on('disconnect', function () {
		killPlayer(player, false);
		delete sockets[player.id];
		delete colorsLUT[player.blocId];
		var index = users.indexOf(player);
		if (index > -1){
            users.splice(index, 1);
			console.log('Player ' + player.name + ' disconnected!');
		}
    });
	
	socket.on('respawnRequest', function () {
		if(player.isDead){
			var spawnPosition = findGoodSpawn();
			player.x = spawnPosition[0];
			player.y = spawnPosition[1];
			player.lastX = spawnPosition[0];
			player.lastY = spawnPosition[1];
			player.dx = spawnPosition[2];
			player.dy = spawnPosition[3];
			player.velocity = INITIAL_VELOCITY;
			emitRespawn();
		}
    });
	socket.on('powerupUsed', function(x,y) {
		if(player.cooldown > 0)
			killPlayer(player, false);
		else if(Math.abs(Math.abs(x - player.x) + Math.abs(y - player.y) - TELEPORT_DISTANCE) > 1) // a small lag grace
			killPlayer(player, false);
		else {
			player.x = x;
			player.y = y;
			handlePlayerPowerup(player);
		}
	});
});	

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
	console.log("Server is listening on port " + serverPort);
});

//
/** Game state update functions **/
//
function moveloop(dt) {
	if (users.length > 0)
		users.forEach( function(u) {
			if(!u.isDead)
				movePlayer(u, dt);
		});
	// move other stuff here.
}
function gameloop() {
	dt = tick();
	
	// interpolate player position
	moveloop(dt);
	// spawn xp
	spawnXp();
	// update links
	updateLinks(dt);
	// update cooldowns
	users.forEach( function(u) {
		u.cooldown = Math.max(0, u.cooldown - dt);
	});	
}

var EMPTY_BLOC = -1;
var SIDE_WALL = -2;
var PLAYER_LOS_RANGE = 25;
function sendUpdatesBoard() {
	users.forEach( function(u) {
		if (!u.isDead) {
			// update walls
			var x = Math.round(u.x); var y = Math.round(u.y);
			losX0 = Math.max(x - PLAYER_LOS_RANGE,0);
			losX1 = Math.min(x + PLAYER_LOS_RANGE, board.W);
			losY0 = Math.max(y - PLAYER_LOS_RANGE,0);
			losY1 = Math.min(y + PLAYER_LOS_RANGE, board.H);
			var newBoard = {
				isBloc: null,
				colors: null,
				isXp: null,
				x0: losX0,
				x1: losX1,
				y0: losY0,
				y1: losY1
			};
			
			var colors = {};
			newBoard.isBloc = new Array(losX1-losX0);
			newBoard.isXp = new Array(losX1-losX0);
			for (var i=0;i<losX1-losX0;i++) {
				newBoard.isBloc[i] = new Array(losY1-losY0);
				newBoard.isXp[i] = new Array(losY1-losY0);
				for (var j=0;j<losY1-losY0;j++) {
					// this is for board and colors
					var id = board.isBloc[i+losX0][j+losY0];
					newBoard.isBloc[i][j] = EMPTY_BLOC;
					if(id > B_EMPTY && blocIdLUT[id]) {
						var c = blocIdLUT[id].hue;
						newBoard.isBloc[i][j] = c;
						colors[c] = true;
					} else if (id == B_BORDERS) {
						newBoard.isBloc[i][j] = SIDE_WALL;
					}
					// this is for xp
					newBoard.isXp[i][j] = board.isXp[i+losX0][j+losY0];
				}
			}
			newBoard.colors = Object.keys(colors);

			sockets[u.id].emit('updateBoard', newBoard);
		}
	});
}
function sendUpdatesPlayers() {
	users.forEach( function(u) {
		if (!u.isDead) {
			// update walls
			var x = Math.round(u.x); var y = Math.round(u.y);
			losX0 = Math.max(x - PLAYER_LOS_RANGE,0);
			losX1 = Math.min(x + PLAYER_LOS_RANGE, board.W-1);
			losY0 = Math.max(y - PLAYER_LOS_RANGE,0);
			losY1 = Math.min(y + PLAYER_LOS_RANGE, board.H-1);

			var otherPlayers = [];
			var newLinks = [];
			var l = links[u];
			if(l && l.dt >= LINK_START) {
				newLinks.push(toClientLink(l));
			}
			
			for (var i=0;i<=losX1-losX0;i++) {
				for (var j=0;j<=losY1-losY0;j++) {
					if(playerBoard[i+losX0][j+losY0]) {
						o = playerBoard[i+losX0][j+losY0];
						if(!o.isDead && o.id != u.id) {
							otherPlayers.push({
								x: o.x,
								y: o.y,
								dx:o.dx,
								dy:o.dy,
								velocity:o.velocity,
								hue: o.hue,
								name: o.name
							});
							l = links[otherPlayers];
							if(l && l.dt >= LINK_START) {
								newLinks.push(toClientLink(l));
							}
								
							// while were at it, check for links
							checkForLink(u, o);
						}
					}
				}
			}
			sockets[u.id].emit('updatePlayers', otherPlayers, newLinks);
		}
	});
}

function toClientLink(serverLink) {
	return {
		x0: serverLink.fromP.x,
		y0: serverLink.fromP.y,
		x1: serverLink.toP.x,
		y1: serverLink.toP.y,
		progress: (serverLink.dt - LINK_START) / (LINK_END - LINK_START)
	}
}


/** Game Logic Helpers **/
var lastUpdate = Date.now(); // used to compute the time delta between frames
function tick() { // handles the delta time between frames
    var now = Date.now();
    var dt = now - lastUpdate;
    lastUpdate = now;
	
	return dt / 1000;
}

function movePlayer(p, dt) {
	p.x += p.dx * p.velocity * dt;
	p.y += p.dy * p.velocity * dt;
	var x = Math.round(p.x-p.dx*.5), y = Math.round(p.y-p.dy*.5);
	if (p.lastX != x || p.lastY != y)
		if(Math.abs(p.lastX - x) + Math.abs(p.lastY - y) > 1) // sometimes lag will cause client not to send packets, which will skip blocs. This interpolates to fill the void.
			fillLine(x,y,p.lastX, p.lastY, p.blocId);
		else
			board.isBloc[p.lastX][p.lastY] = p.blocId;
	// TODO: check if new position is reasonable. If sketchy, kill player (kick? time out?).
}
function fillLine(x0, y0, x1, y1, v){
	var dx = Math.abs(x1-x0); var dy = Math.abs(y1-y0);
	var sx = (x0 < x1) ? 1 : -1; var sy = (y0 < y1) ? 1 : -1;
	var err = dx-dy;
	do{
	board.isBloc[x0][y0] = v;
		var e2 = 2*err;
		if (e2 >-dy){ err -= dy; x0 += sx; }
		if (e2 < dx){ err += dx; y0 += sy; }
	}while(!((x0==x1) && (y0==y1)))
}

// returns a position and direction [x y dx dy] to spawn
function findGoodSpawn() {
	var x,y,dx,dy;
	var goodSpawn = false;
	do {
		x = getRandomInt(SPAWN_SPACE_NEEDED,board.W - SPAWN_SPACE_NEEDED);
		y = getRandomInt(SPAWN_SPACE_NEEDED,board.H - SPAWN_SPACE_NEEDED);
		dx = getRandomInt(0,1)*2 - 1;
		dy = 0;
		if(getRandomInt(0,1) == 0) { // sometimes use y
			dy = dx; dx = 0;
		}
		goodSpawn = true;
		for (var i=0;i<SPAWN_SPACE_NEEDED;i++){ // at least n squares to move forwards
			if(board.isBloc[x+dx*i][y+dy*i] > B_EMPTY){
				goodSpawn = false;
				break;
			}
		}
	} while(!goodSpawn);
	console.log('Spawning player at ' + x +',' + y + ' with direction ' + dx + ',' + dy);
	return [x,y,dx,dy];
}

function spawnXp() {
	if(numXp < NUM_XP_ONBOARD) {
		var x = getRandomInt(1,board.W - 2); // cannot spawn on borders
		var y = getRandomInt(1,board.H - 2);
		if(!board.isXp[x][y] && !playerBoard[x][y]) {
			board.isXp[x][y] = true;
			numXp++;
		}
	}
}

function updateLeaderboard() {
	var sortedUsers = users.filter(function(a){return !a.isDead})
		.sort(function(a, b){return b.xp-a.xp});
	
	leaderBoard = [];
	for (var i=0; i<Math.min(sortedUsers.length,10); i++)
	{
		leaderBoard.push({
			name: sortedUsers[i].name,
			score: sortedUsers[i].xp
		});
	}
	
	users.forEach( function(u) {
		if(!u.isDead)
			sockets[u.id].emit('updateLeaderBoard', leaderBoard);
	});
}

function updateLinks(dt) {
	for (var key in links) {
		var l = links[key];
		var A = l.fromP, B = l.toP;
		var dist = (Math.abs(A.x - B.x) + Math.abs(A.y - B.y));
		if(A.isDead || B.isDead || dist > LINK_SUSTAIN ) {
			delete links[key]; // link broken!
		} else {
			l.dt += dt;
			if(l.dt >= LINK_END) { // link conversion is complete!
				B.hue = A.hue;
				delete links[key];
				colorsLUT[B.blocId] = B.hue;
				sockets[B.id].emit('newHue', B.hue);
			}
		}
	};
}
function checkForLink(playerA, playerB) {
	if(links) {
		if(colorsLUT[playerA.blocId] != colorsLUT[playerB.blocId]) {
			if(Math.abs(playerA.x - playerB.x) + Math.abs(playerA.y - playerB.y) <= LINK_RANGE) {
				if(playerA.dx == playerB.dx && playerA.dy == playerB.dy) {
					if(!(playerA in links) && !(playerB in links)) {
						if(playerA.xp > playerB.xp) {
							console.log('new link created between ' + playerA.name + ' and ' + playerB.name + '!');
							links[playerA] = {
								fromP: playerA,
								toP: playerB,
								dt: 0
							}
						} else{
							console.log('new link created between ' + playerA.name + ' and ' + playerB.name + '!');
							links[playerB] = {
								fromP: playerB,
								toP: playerA,
								dt: 0
							}
						}
					}
				}
			}
		}
	}
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function killPlayer(p, isDropXp) {
	xpDropCounter = 0;
	p.isDead = true;
	p.xp = 0;
	sockets[p.id].emit('playerDied');
	playerBoard[Math.round(p.x)][Math.round(p.y)] = null;
	p.desyncCounter = 0;
	for (var i=1;i<board.W-1;i++) {
		for (var j=1;j<board.H-1;j++) {
			if(board.isBloc[i][j] == p.blocId) {
				board.isBloc[i][j] = B_EMPTY;
				if(isDropXp){
					xpDropCounter++;
					if(xpDropCounter == FREQ_XP_DROP_ONDEATH) {
						xpDropCounter = 0;
						if(numXp < MAX_XP_ONBOARD) {
							board.isXp[i][j] = true;
							numXp++;
						}
					}
				}
			}
		}
	}
}

function handlePlayerPowerup(player) {
	var x = player.x, y = player.y;
	X0 = Math.max(x - POWERUP_CLEAR_RADIUS,1);
	X1 = Math.min(x + POWERUP_CLEAR_RADIUS, board.W-2);
	Y0 = Math.max(y - POWERUP_CLEAR_RADIUS,1);
	Y1 = Math.min(y + POWERUP_CLEAR_RADIUS, board.H-2);
	for (var i=losX0;i<=losX1;i++) {
		for (var j=losY0;j<=losY1;j++) {
			if(Math.sqrt((i-x)*(i-x)+(j-y)*(j-y)) <= POWERUP_CLEAR_RADIUS)
				if(board.isBloc[i][j] != B_BORDERS)
					board.isBloc[i][j] = EMPTY_BLOC;
		}
	}
	player.cooldown = POWERUP_COOLDOWN;
}

function checkHeartBeat() {
	var now = Date.now();
    var dt = now - lastUpdate;
	
		users.forEach( function(u) {
			if(now - u.lastHeartbeat >= MAX_HEARTBEAT_KICK)
				killPlayer(u, false);
		});
}

// this function kicks players that are out of synch with the game clock.
function checkSync() {
	users.forEach( function(u) {
		if(!u.isDead)
			if(Math.abs(u.desyncCounter) > MAX_DESYNC_TOLERENCE) {
				killPlayer(u, false);
				console.log('Kicked player because desync was ' + u.desyncCounter + ', which is greater than ' + MAX_DESYNC_TOLERENCE);
			}
	});
}

function getUnusedColor() {
	if(users.length >= 360) // there aren't any free colors.
		return Math.round(Math.random() * 360);
	
	var blackList = new Array(360);
	
	do {
		c = Math.round(Math.random() * 360);
	} while(blackList[c]);
	return c;
	
}

/*function toBoardRange(x,y) {
	return [Math.round(Math.min(Math.max(x,0))]
	LosX0 = ;
	LosX1 = Math.round(Math.min(player.x + LosW, board.W-1));
	LosY0 = Math.round(Math.max(player.y - LosH,0));
	LosY1 = Math.round(Math.min(player.y + LosH, board.H-1));
}*/

/** Launch game **/
setInterval(gameloop, 1000/15);
setInterval(sendUpdatesBoard, 1000 / 15);
setInterval(sendUpdatesPlayers, 1000 / 15);
setInterval(updateLeaderboard, 2000);
setInterval(checkHeartBeat, 2000);
setInterval(checkSync, 500); // security function
