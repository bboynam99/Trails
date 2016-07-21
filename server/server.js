var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var config  = require('./config.json');
app.use(express.static(__dirname + '/../client'));

//
/** Game Constants **/
//
var SPAWN_SPACE_NEEDED = 10;
var INITIAL_VELOCITY = 12.0;
var DEFAULT_POINTS_PER_SEC = 15; // The default number of points per second
var LOSING_POINTS_RATIO = -10; // The ratio of ponts gain the player losses while on self-track
var NUM_POWERUPS_ONBOARD = 3;
var LINK_START = 0.25; // link will show after this (ms)
var LINK_END = 3; // link will end after this
var LINK_RANGE = 5; // link will start at this distance
var LINK_SUSTAIN = 8; // link will stay alive at this range (hysteresis)
var POWERUP_CLEAR_RADIUS = 4; // upond landing, a circle of this radius will be cleared
var TELEPORT_DISTANCE = 8; // TODO: this should be received from server
var POWERUP_COOLDOWN = 10;
var MAX_HEARTBEAT_KICK = 2000; // player will be killed after no input (ms);
var MAX_DESYNC_TOLERENCE = 1.5; // the number of sec of desync tolerated before the player is kicked
// Flags for the bloc board state
var B_EMPTY = 0;
var B_BORDERS = 10;
var B_KILLSYOUTHRESHOLD = 5; // anything above that kills you
// PowerUp flags
var PU_NONE = 0;
var PU_ALLIANCE = 1;
var PU_TELEPORT = 2;
var PU_STEAL = 3;
var PU_SHIELD = 4;
var PU_MISSLE = 5;
var maxPowerUpId = 5; // UPDATE THIS everytime a new power up is added

//
/** Game variables **/
//
var users = []; // players and their data
var board = { // game board
	H: 50,
	W: 50,
	isBloc: null,
	isPowerUp: null,
};
var numPowerUpsOnBoard = 0;
// init board
board.isBloc = new Array(board.W);
board.isPowerUp = new Array(board.W);
for (var i=0;i<board.W;i++) {
	board.isBloc[i] = new Array(board.H);
	board.isPowerUp[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		board.isPowerUp[i][j] = PU_NONE;
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
		dx: spawnPosition[2],
		dy: spawnPosition[3],
		velocity: INITIAL_VELOCITY, // in blocs per second
		cooldown: POWERUP_COOLDOWN,
		pts: 1, // this version of points is sync'd precisely
		dpts: DEFAULT_POINTS_PER_SEC, // dpts/dt when you're positive
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
	
	function validNick(n) {
		var regex = /^\w?[ \w]{0,14}$/;
		return regex.exec(n) !== null;
	}

	socket.on('myNameIs', function (name) {
		if(!name || !validNick(name)){
			killPlayer(player, 'invalid name'); 
			socket.disconnect();
		}
			
		player['name'] = name;
	});	
	
	// emit [player, board]
	function emitRespawn() {
		player.hue = getUnusedColor(); // player is no longer part of any other hue groups!
		colorsLUT[player.blocId] = player.hue;
		player.isDead = false;
		socket.emit('playerSpawn',{ // the player
			x: player.x,
			y: player.y,
			dx:player.dx,
			dy:player.dy,
			velocity:player.velocity,
			hue: player.hue,
			cooldown: player.cooldown,
			pts: player.pts,
			dpts: player.dpts,
			maxCooldown: POWERUP_COOLDOWN,
			teleportDist: TELEPORT_DISTANCE
		}, { // the board
			boardW:board.W,
			boardH:board.H
		}, { // some important game values
			lpr: LOSING_POINTS_RATIO
		});
	}
	emitRespawn();

		
	socket.on('mv', function (newInfo) {
		//console.log('moving from ('+player.x+','+player.y+') to ('+newInfo.x+','+newInfo.y+') with delta ('+player.dx+','+player.dy+') and velocity '+player.velocity)
		if(!player.isDead) {
			player.dx = newInfo.dx;
			player.dy = newInfo.dy;
		
			// check if new position is reasonable. If sketchy, close socket.
			var serverTravelTime = (Math.abs(player.x - player.lastX) + Math.abs(player.y - player.lastY)) / player.velocity;
			var clientTravelTime = (Math.abs(newInfo.x - player.lastX) + Math.abs(newInfo.y - player.lastY)) / player.velocity;
			player.desyncCounter += serverTravelTime - clientTravelTime;
			
			var x = player.lastX, y = player.lastY;
			var nx = Math.round(newInfo.x), ny = Math.round(newInfo.y);
			player.lastHeartbeat = new Date().getTime(); // see function checkHeartBeat
			player.x = newInfo.x;
			player.y = newInfo.y;
						
			if((nx <= 0 || ny <= 0 || nx >= board.W-1 || ny >= board.H-1)) {
				killPlayer(player, 'player is outside the playable area.'); 
			} else if(nx != x || ny != y) { // if position has changed 
				playerBoard[x][y] = null; // update player position LUT
				playerBoard[nx][ny] = player;
				player.lastX = nx;
				player.lastY = ny;
				replayLine(x, y, nx, ny, player.blocId, player);
			}
		}
	});

	socket.on('disconnect', function () {
		killPlayer(player, 'disconnected, killing his avatar');
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
			killPlayer(player, 'used a powerup while still on CD');
		else if(Math.abs(Math.abs(x - player.x) + Math.abs(y - player.y) - TELEPORT_DISTANCE) > 4){ // a small lag grace
			console.log('Kicked player because teleport was off by ' + Math.abs(Math.abs(x - player.x) + Math.abs(y - player.y) - TELEPORT_DISTANCE) + ', which is greater than ' + 4);
			killPlayer(player, 'teleported way too far.');
		} else {
			player.x = x;
			player.y = y;
			player.lastX = Math.round(x);
			player.lastY = Math.round(y);
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
	spawnPowerUps();
	// update links
	updateLinks(dt);
	// update cooldowns, scores and velocity
	users.forEach( function(u) {
		try{
			if (!u.isDead) {
				// cooldown
				u.cooldown = Math.max(0, u.cooldown - dt);
				// score
				var dist = Math.abs(u.x - Math.round(u.x)) + Math.abs(u.y - Math.round(u.y)); // distance to nearest square
			}
			}catch(e){} // sometimes the player is outside and this causes a crash... it's not important.
	});	
}

var EMPTY_BLOC = -1;
var SIDE_WALL = -2; // client side constants
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
				isPowerUp: null,
				x0: losX0,
				x1: losX1,
				y0: losY0,
				y1: losY1
			};
			if(losX1-losX0 >= 0 && losY1-losY0 > 0){ // sometimes players are outside, but not dead yet (not sure why)
				var colors = {};
				newBoard.isBloc = new Array(losX1-losX0);
				newBoard.isPowerUp = new Array(losX1-losX0);
				for (var i=0;i<losX1-losX0;i++) {
					newBoard.isBloc[i] = new Array(losY1-losY0);
					newBoard.isPowerUp[i] = new Array(losY1-losY0);
					for (var j=0;j<losY1-losY0;j++) {
						// this is for board and colors
						var id = board.isBloc[i+losX0][j+losY0];
						newBoard.isBloc[i][j] = EMPTY_BLOC;
						var c = blocIdLUT[Math.abs(id)];
						if(c) {
							newBoard.isBloc[i][j] = c.hue;
							colors[c.hue] = true;
						} else if (id == B_BORDERS) {
							newBoard.isBloc[i][j] = SIDE_WALL;
						}
						// this is for power ups
						newBoard.isPowerUp[i][j] = board.isPowerUp[i+losX0][j+losY0];
					}
				}
				newBoard.colors = Object.keys(colors);

				sockets[u.id].emit('updateBoard', newBoard);
			}
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
								name: o.name,
								pts: o.pts,
								dpts: o.dpts
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
			var selfPlayer = {
				velocity:u.velocity,
				pts: u.pts,
				dpts: u.dpts
			};
							
			sockets[u.id].emit('updatePlayers', otherPlayers, newLinks, selfPlayer);
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
	if((x > 0 && y > 0 && x < board.W-1 && y < board.H-1)) {
		if (board.isBloc[x][y] == B_EMPTY) {
			board.isBloc[x][y] = p.blocId * -1; // spawn "phantom" trail
			afterInterpolationMove(x,y,p);
		}
	}
}

function replayLine(x0, y0, x1, y1, v, p) { //also checks for collision (and possibly kills p)
	try {
		var dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
		if(!(dx == 0 ^ dy == 0)) return; // some weird lag happened? avoid infinite loop.
		
		while((x0!=x1) || (y0!=y1)) {
			beforeConfirmedMove(x0,y0,p);
			if(board.isBloc[x0][y0] == B_EMPTY || board.isBloc[x0][y0] == (p.blocId * -1)) { // fill empty cells or "phantom" trail from interpolation
				board.isBloc[x0][y0] = v;
			} else if(p && colorsLUT[board.isBloc[x0][y0]] != p.hue && board.isBloc[x0][y0] > B_KILSYOUTHRESHOLD) { // kill if needed
				hasCrashedInto(blocIdLUT[board.isBloc[x0][y0]], p);
				killPlayer(p,'the player stepped on another line of value ' + board.isBloc[x0][y0]);
				break;
			}
			x0 += dx;
			y0 += dy;
		}
	} catch(err) {
		console.log('fail to draw line at ' + x0 + ',' + y0 + '.');
	}
}

function afterInterpolationMove(x,y,p) {
	// check for powerups pickup
	if(board.isPowerUp[x][y]) {
		board.isPowerUp[x][y] = PU_NONE;
		numPowerUpsOnBoard--;
		//TODO: give power up to player
		//sockets[p.id].emit('newPowerUp', ...);
	}
	//console.log('added phantom with value ' + board.isBloc[x][y] + ' at posistion (' + x + ',' + y + ') for player #' + p.blocId);
	dilation(x,y,p,p.blocId * -1);
}

function beforeConfirmedMove(x,y,p) {
	// update points
	if(colorsLUT[board.isBloc[x][y]] == p.hue){
		p.pts += (DEFAULT_POINTS_PER_SEC*LOSING_POINTS_RATIO) / p.velocity;
	} else {
		p.pts += DEFAULT_POINTS_PER_SEC / p.velocity;
	}
	if(p.pts <= 0)
		killPlayer(p,'ran out of points')
	// update velocity based on points
	p.velocity = INITIAL_VELOCITY / (0.000071 * p.pts + 1); // at 10k pts, speed = 7
	
	dilation(x,y,p,p.blocId);
}

function dilation(x,y,p,v) {
	// make the line fatter
	var s = Math.floor(getBonusSize(p.pts));
	if (s > 0) {
		var px = Math.round(x-p.dx*2), py = Math.round(y-p.dy*2);
		for(i=-s;i<=s;i++)
			for(j=-s;j<=s;j++)
				if(x+i != Math.round(p.x) && y+j != Math.round(p.y))
					board.isBloc[x+i][y+j] = v;	
	}
}

function getBonusSize(score) {
	return Math.pow(score/1000,0.333333);
	 //return 968.8675 + (1.00653 - 968.8675)/(1 + Math.pow(score/57386000000,0.3469172));
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

function spawnPowerUps() {
	if(numPowerUpsOnBoard < NUM_POWERUPS_ONBOARD) {
		var x = getRandomInt(1,board.W - 2); // cannot spawn on borders
		var y = getRandomInt(1,board.H - 2);
		if(!board.isPowerUp[x][y] && !playerBoard[x][y]) {
			board.isPowerUp[x][y] = getRandomInt(1,maxPowerUpId);
			numPowerUpsOnBoard++;
		}
	}
}

function updateLeaderboard() {
	var sortedUsers = users.filter(function(a){return !a.isDead})
		.sort(function(a, b){return b.pts-a.pts});
	
	leaderBoard = [];
	for (var i=0; i<Math.min(sortedUsers.length,10); i++)
	{
		leaderBoard.push({
			name: sortedUsers[i].name,
			score: Math.round(sortedUsers[i].pts)
		});
	}
	
	users.forEach( function(u) {
		if(!u.isDead)
			sockets[u.id].emit('updateLeaderBoard', leaderBoard);
	});
}

function updateLinks(dt) {
/*	for (var key in links) {
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
	};*/
}
function checkForLink(playerA, playerB) {
/*	if(links) {
		if(colorsLUT[playerA.blocId] != colorsLUT[playerB.blocId]) {
			if(Math.abs(playerA.x - playerB.x) + Math.abs(playerA.y - playerB.y) <= LINK_RANGE) {
				if(playerA.dx == playerB.dx && playerA.dy == playerB.dy) {
					if(!(playerA in links) && !(playerB in links)) {
						if(playerA.pts > playerB.pts) {
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
	}*/
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function hasCrashedInto(crashee, crasher) {
	crashee.pts += crasher.pts;
	for (var i=1;i<board.W-1;i++) { // clear crashee's trail
		for (var j=1;j<board.H-1;j++) {
			if(Math.abs(board.isBloc[i][j]) == crashee.blocId) {
				board.isBloc[i][j] = B_EMPTY;
			}
		}
	}
	
	killPlayer(crasher, 'has crashed into the trail of player ' + crashee.name);
}

function killPlayer(p, reason) {
	try {
		console.log('Killing player ' + p.name + ' because: "' + reason)
		xpDropCounter = 0;
		p.isDead = true;
		p.pts = 0;
		p.cooldown = POWERUP_COOLDOWN;
		sockets[p.id].emit('playerDied');
		playerBoard[Math.round(p.x)][Math.round(p.y)] = null;
		p.desyncCounter = 0;
		for (var i=1;i<board.W-1;i++) {
			for (var j=1;j<board.H-1;j++) {
				if(Math.abs(board.isBloc[i][j]) == p.blocId) {
					board.isBloc[i][j] = B_EMPTY;
				}
			}
		}
	} catch(err) {
		console.log('error while killing player: ' + err);
	}
}

function handlePlayerPowerup(player) {
	var x = player.x, y = player.y;
	X0 = Math.max(x - POWERUP_CLEAR_RADIUS,1);
	X1 = Math.min(x + POWERUP_CLEAR_RADIUS, board.W-2);
	Y0 = Math.max(y - POWERUP_CLEAR_RADIUS,1);
	Y1 = Math.min(y + POWERUP_CLEAR_RADIUS, board.H-2);
	for (var i=X0;i<=X1;i++) {
		for (var j=Y0;j<=Y1;j++) {
			if(Math.sqrt((i-x)*(i-x)+(j-y)*(j-y)) <= POWERUP_CLEAR_RADIUS)
				if(board.isBloc[i][j] != B_BORDERS)
					board.isBloc[i][j] = B_EMPTY;
		}
	}
	player.cooldown = POWERUP_COOLDOWN;
}

function checkHeartBeat() {
	var now = Date.now();
    var dt = now - lastUpdate;
	
		users.forEach( function(u) {
			if(!u.isDead)
				if(now - u.lastHeartbeat >= MAX_HEARTBEAT_KICK)
					killPlayer(u, 'no hearthbeat received for more than ' + MAX_HEARTBEAT_KICK);
		});
}

// this function kicks players that are out of synch with the game clock.
function checkSync() {
	users.forEach( function(u) {
		if(!u.isDead)
			if(Math.abs(u.desyncCounter) > MAX_DESYNC_TOLERENCE) {
				console.log('Kicked player because desync was ' + u.desyncCounter + ', which is greater than ' + MAX_DESYNC_TOLERENCE);
				killPlayer(u, 'desync too high');
			}
	});
}

function getUnusedColor() {
	if(users.length >= 35) // there aren't any free colors.
		return Math.round(Math.random() * 35) * 10;
	
	var blackList = new Array(360);
	
	colorsLUT.forEach( function(c) {
		blackList[c] = true;
	});
	
	do {
		c = Math.round(Math.random() * 35) * 10;
	} while(blackList[c]);
	return c;
	
}


/** Launch game **/
setInterval(gameloop, 1000/15);
setInterval(sendUpdatesBoard, 1000 / 15);
setInterval(sendUpdatesPlayers, 1000 / 15);
setInterval(updateLeaderboard, 2000);
setInterval(checkHeartBeat, 2000);
setInterval(checkSync, 500); // security function
