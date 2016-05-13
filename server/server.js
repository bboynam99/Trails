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
var INITIAL_VELOCITY = 15.0;
// These flags for the bloc board state
var B_EMPTY = 0;
var B_INTERPOLATED = 1;
var B_BORDERS = 10;
var B_KILLSYOUTHRESHOLD = 5; // anything above that kills you


//
/** Game variables **/
//

var users = []; // players and their data

var board = { // game board
	H: 50,
	W: 50,
	isBloc: null
};
board.isBloc = new Array(board.W);
for (var i=0;i<board.W;i++) {
	board.isBloc[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
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

var blocIdGenerator = 11;

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
		dx: 0.0,
		dy: 0.0,
		velocity: INITIAL_VELOCITY, // in blocs per second
		xp: 0,
		level: 1,
		hue: Math.round(Math.random() * 360),
		lastHeartbeat: new Date().getTime(),
		name: '',
		blocId: blocIdGenerator
	};
	blocIdGenerator++;
	
	users.push(player);
	
	socket.on('myNameIs', function (name) {
		player['name'] = name;
	});	
	
	// emit [player, board]
	function emitRespawn(){
		player.isDead = false;
		socket.emit('playerSpawn',{
			x: player.x,
			y: player.y,
			dx:player.dx,
			dy:player.dy,
			velocity:player.velocity,
			xp:player.xp,
			level: player.level,
			hue: player.hue,
		}, {
			boardW:board.W,
			boardH:board.H
		});
	}
	emitRespawn();

		
	socket.on('playerMove', function (newPosition) {
		if(!player.isDead){
			var x = Math.round(player.x), y = Math.round(player.y);
			var nx = Math.round(newPosition.x), ny = Math.round(newPosition.y);
			// TODO: check if new position is reasonable. If sketchy, kill player (kick? time out?).
			if((nx != x || ny != y) && board.isBloc[x][y] > B_KILLSYOUTHRESHOLD){
				killPlayer(player);
			} else if(x <= 0 || y <= 0 || x >= board.W-1 || y >= board.H-1) {
				killPlayer(player); // it seems this check is necessary because of the lag (when moving at high speeds), player may sometimes leave game board
			} else if(nx != x || ny != y) {
				board.isBloc[x][y] = Math.abs(board.isBloc[x][y]); // give it it's positive (deadly) value once the player has left
				board.isBloc[nx][ny] = player.blocId * -1; // this will prevent from killing the player
				playerBoard[x][y] = null;
				playerBoard[nx][ny] = player;
			}
			player.lastHeartbeat = new Date().getTime(); // TODO: use this for a check (interval function), if no movement after 5 sec... TIMEOUT!
			player.x = newPosition.x;
			player.y = newPosition.y;
		}
	});
	socket.on('directionChange', function (direction) {
		if(!player.isDead){
			player.dx = direction.dx;
			player.dy = direction.dy;
		}
	});
	
	socket.on('disconnect', function () {
		delete sockets[player.id];
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
			player.dx = spawnPosition[2];
			player.dy = spawnPosition[3];
			player.velocity = INITIAL_VELOCITY;
			emitRespawn();
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
    // update leaderboard
	
	// update game state
}

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
				x0: losX0,
				x1: losX1,
				y0: losY0,
				y1: losY1
			};
			
			newBoard.isBloc = new Array(losX1-losX0);
			for (var i=0;i<losX1-losX0;i++) {
				newBoard.isBloc[i] = new Array(losY1-losY0);
				for (var j=0;j<losY1-losY0;j++) {
					newBoard.isBloc[i][j] = board.isBloc[i+losX0][j+losY0] > B_EMPTY; // copy the board
				}
			}

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
			
			for (var i=0;i<=losX1-losX0;i++) {
				for (var j=0;j<=losY1-losY0;j++) {
					if(playerBoard[i+losX0][j+losY0]){
						o = playerBoard[i+losX0][j+losY0];
						if(o.id != u.id)
							otherPlayers.push({
								x: o.x,
								y: o.y,
								dx:o.dx,
								dy:o.dy,
								velocity:o.velocity,
								hue: o.hue,
								name: o.name
							});

					}
				}
			}
			sockets[u.id].emit('updatePlayers', otherPlayers);
		}
	});
}

function dist(otherPlayer,player) {
  return Math.max(Math.abs(otherPlayer.x - player.x),Math.abs(otherPlayer.y - player.y)) < PLAYER_LOS_RANGE;
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
	// set a bloc (this is useful if the player d/c)
	var x = Math.round(p.x-p.dx*.5), y = Math.round(p.y-p.dy*.5);
	// TODO: check if new position is reasonable. If sketchy, kill player (kick? time out?).
	board.isBloc[x][y] = B_INTERPOLATED;
}

// returns a position and direction [x y dx dy] to spawn
function findGoodSpawn(){
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

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function killPlayer(p) {
	p.isDead = true;
	sockets[p.id].emit('playerDied');
}

/*function toBoardRange(x,y) {
	return [Math.round(Math.min(Math.max(x,0))]
	LosX0 = ;
	LosX1 = Math.round(Math.min(player.x + LosW, board.W-1));
	LosY0 = Math.round(Math.max(player.y - LosH,0));
	LosY1 = Math.round(Math.min(player.y + LosH, board.H-1));
}*/

/** Launch game **/
/*setInterval(moveloop, 1000 / 60);*/
setInterval(gameloop, 1000/30);
setInterval(sendUpdatesBoard, 1000 / 10);
setInterval(sendUpdatesPlayers, 1000 / 30);