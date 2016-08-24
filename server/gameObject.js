// contains everything related to game objects (e.g. links)

var b = require('./board.js');
	
module.exports = {
	createLink,
	createBlackHole,
	createLaser,
	createDoomsdayPhase
};

var LINK_ID=1, BKHL_ID=2; LZR_ID=3; DMSDY_ID = 4;
var gameObjects = []; // gameObjects contains all objects on board.It is an array of a structure.

function updateLogic(dt) { // update every object's state, update functions may send out update packets
	var dt = tick();
	for(var i=gameObjects.length-1;i>=0;i--)
		gameObjects[i].update(gameObjects[i],dt);
}

var lastUpdate = Date.now(); // used to compute the time delta between frames
function tick() { // handles the delta time between frames
    var now = Date.now();
    var dt = now - lastUpdate;
    lastUpdate = now;
	
	return dt / 1000;
}

function sendNewObject(obj) {
	users.forEach(function(player){
		if(!player.isDead && obj.isVisibleByPlayer(player,obj)) {
			sockets[player.id].emit('newO',obj.toPlayerObject(obj));
			//console.log('emiting creating event for ' + obj.type + ' to player ' + player.name);
		}
	});
}

function removeObject(obj) {
	var index = gameObjects.indexOf(obj);
	if (index > -1) {
		gameObjects.splice(index, 1);
		// socket.emit DELETED OBJECT
	}
}

setInterval(updateLogic, 1000/10);

//
// LINKS
//
function createLink(playerA, playerB, duration, maxRange, linksSkin) {
	if(playerA && playerB) {
		//console.log('New link now channeling between ' + playerA.name + ' and ' + playerB.name);
		var newlink = {
			type: LINK_ID,
			update: updateLinks,
			isVisibleByPlayer: isLinkWithinRange,
			data: {
				fromP: playerA,
				toP: playerB,
				dt: 0,
				exp: duration,
				max: maxRange,
				skin: linksSkin
			},
			toPlayerObject: toClientLink
		};
		gameObjects.push(newlink);
		sendNewObject(newlink);
	}
}
function updateLinks(obj, dt) {
	//console.log('Updating object of type link:' + obj);
	var A = obj.data.fromP, B = obj.data.toP;
	var dist = (Math.abs(A.x - B.x) + Math.abs(A.y - B.y));
	if(A.isDead || B.isDead || dist > obj.data.max ) {
		//console.log('Link broke :(');
		removeObject(obj); // link broken!
	} else {
		obj.data.dt += dt;
		//console.log('link time is now :' + obj.data.dt + ' of ' + obj.data.exp);
		if(obj.data.dt >= obj.data.exp) { // link expired
			if(A.specialAbility && A.specialAbility.onLinkComplete)
				A.specialAbility.onLinkComplete(A,B);
			removeObject(obj);
			//console.log('Link completed!');
		}
	}
};
function toClientLink(link) {
	return {
		type: link.type,
		fromP: link.data.fromP.blockId,
		toP: link.data.toP.blockId,
		exp: link.data.exp,
		skin: link.data.skin
	};
}
function isLinkWithinRange(player,link) {
	var dist1 = (Math.abs(link.data.fromP.x - player.x) + Math.abs(link.data.fromP.y - player.y));
	var dist2 = (Math.abs(link.data.toP.x - player.x) + Math.abs(link.data.toP.y - player.y));
	return (Math.min(dist1,dist2) <= PLAYER_LOS_RANGE*1.5);
}

//
// BLACK HOLE
//
function createBlackHole(x,y,duration) {
	var newBlackHole = {
		type: BKHL_ID,
		update: updateBlackHole,
		isVisibleByPlayer: function(){return true;}, // always globally visible.
		data: {
			x: x,
			y: y,
			dt: 0,
			exp: duration
		},
		toPlayerObject: toClientBlackhole
	};
	gameObjects.push(newBlackHole);
	sendNewObject(newBlackHole);
}

const BLKHL_RADIUS = 20, BLKHL_STR = 7;
function updateBlackHole(obj, dt) {
	obj.data.dt += dt;
	if(obj.data.dt >= obj.data.exp) { // link expired
		removeObject(obj);
		// TODO: align every player's X and Y
	} else {
		users.forEach(function(p) {
			if(!p.isDead) {
				var dx = (obj.data.x - p.x);
				var dy = (obj.data.y - p.y);
				var dist = Math.sqrt(dx*dx+dy*dy);
				var mag = (1 - Math.min(dist / BLKHL_RADIUS,1)) * BLKHL_STR;
				p.x += dx/dist * mag * dt;
				p.y += dy/dist * mag * dt;
				//console.log('emiting creating event for ' + obj.type + ' to player ' + player.name);
			}
		});
	}
}

function toClientBlackhole(bh){
	return {
		type: bh.type,
		x: bh.data.x,
		y: bh.data.y,
		exp: bh.data.exp,
		r: BLKHL_RADIUS,
		str: BLKHL_STR
	};
}

//
// Laser
//
function createLaser(player, isHorizontal,axisPosition,paddingSize,chargeTime) {
	var newLaser = {
		type: LZR_ID,
		update: updateLaser,
		isVisibleByPlayer: function(){return true;}, // always globally visible.
		data: {
			caster: player,
			isH: isHorizontal,
			from: Math.max(0,Math.min((isHorizontal?BOARD_W:BOARD_H),axisPosition-paddingSize)),
			to:Math.max(0,Math.min((isHorizontal?BOARD_W:BOARD_H),axisPosition+paddingSize)),
			dt: 0,
			exp: chargeTime
		},
		toPlayerObject: toClientLaser
	};
	gameObjects.push(newLaser);
	sendNewObject(newLaser);
}

function updateLaser(obj, dt) {
	obj.data.dt += dt;
	//console.log('link time is now :' + obj.data.dt + ' of ' + obj.data.exp);
	if(obj.data.dt >= obj.data.exp) { // link expired
		// clear board and players
		
		var X0,X1,Y0,Y1;
		if(obj.data.isH) {
			X0 = 1; X1 = board.W-2;
			Y0 = obj.data.from; Y1 = obj.data.to;
		} else {
			X0 = obj.data.from; X1 = obj.data.to;
			Y0 = 1; Y1 = board.H-2;
		}
		for (var i=X0;i<=X1;i++) {
			for (var j=Y0;j<=Y1;j++) {
				if(board.blockId[i][i] != B_BORDERS) {
					board.blockId[i][j] = B_EMPTY;
				}
				if(playerBoard[i][j] != null && playerBoard[i][j] != obj.data.caster && !obj.data.caster.isDead && !playerBoard[i][j].isDead) {
					//console.log('found player '+playerBoard[i][j].name+' at position ('+i+','+j+') when searching in ('+X0+':'+X1+','+Y0+':'+Y1+')');
					b.hasCrashedInto(obj.data.caster, playerBoard[i][j], 'You were eliminated by ' + obj.data.caster.name + '\'s power up ability.');
				}
			}
		}
		
		// remove obj
		removeObject(obj);
	}
}

function toClientLaser(lzr){
	return {
		type: lzr.type,
		isH: lzr.data.isH,
		from: lzr.data.from,
		to: lzr.data.to,
		exp: lzr.data.exp
	};
}

//
// DoomsdayPhase
//

function createDoomsdayPhase(creator) {
	var newDoomsDayPhase = {
		type: DMSDY_ID,
		update: updateDoomsdayPhase,
		isVisibleByPlayer: function(player,phase){return }, // visible by unphased players
		data: {
			ID: getUniquePhaseId(),
			interpolationMoveOverride: doomsdayInterpolationMove,
			replayLineOverride: doomsdayReplayLine,
			board: createDoomsdayPhaseMap(),
			initialPlayerCount: 0,
			creator: creator.id
		},
		toPlayerObject: toClientDmsdy
	};
	gameObjects.push(newDoomsDayPhase);
	
	users.forEach(function(player){
		if(!player.isDead && player.phase == null) {
			b.changePhase(player, newDoomsDayPhase)
			newDoomsDayPhase.data.initialPlayerCount++;
		}
	});
}

function toClientDmsdy(obj) {
	return {
		type: obj.type
	};
}

function updateDoomsdayPhase(obj) {
	var inPhase = users.filter(function(p){ !p.isDead && p.phase == obj;});
	if(obj.data.initialPlayerCount <= 1 && inPhase.length == 0) {
		removeObject(obj);
	} else if(obj.data.initialPlayerCount > 1 && inPhase.length == 1) {
		//find creator (may have disconnected)
		var creator = users.find(function(p){p.id == obj.data.creator});
		if(creator && !creator.isDead) {
			b.hasCrashedInto(creator, inPhase[0], 'You\'ve been blasted into pieces by ' + creator.name + ' \'s Doomsday device.');
		} else {
			b.killPlayer(inPhase[0], 'was the last one in the doomsday phase.', 'You\'ve been blasted into pieces by the Doomsday device.')
		}
		removeObject(obj);
	}
}

function doomsdayInterpolationMove(x,y,p) {
	//does not create walls, check for safe spots
	if(p.phase.data.board.blockId[x][y] == DMSDY_EXIT) {
		b.clearAroundPoint(x,y,10);
		b.unphase(p);
	}
}

function doomsdayReplayLine(x0, y0, x1, y1, p) {
	//does not create walls
	if(p.phase.data.board.blockId[x1][y1] == DMSDY_EXIT) {
		b.clearAroundPoint(x1,y1,10);
		b.unphase(p);
	}
}

function createDoomsdayPhaseMap() {
	var phaseBoard = {
		H: BOARD_H,
		W: BOARD_W,
		blockId: null
	}
	
	phaseBoard.blockId = new Array(phaseBoard.W);
	for (var i=0;i<phaseBoard.W;i++) {
		phaseBoard.blockId[i] = new Array(phaseBoard.H);
		for (var j=0;j<phaseBoard.H;j++) {
			phaseBoard.blockId[i][j] = B_EMPTY;
			if(i == 0 || j == 0 || i == phaseBoard.W-1 || j == phaseBoard.H-1)
				phaseBoard.blockId[i][j] = B_BORDERS;
			else if(i % 55 == 0 && j % 55 == 0)
				phaseBoard.blockId[i][j] = DMSDY_EXIT;
			else if (Math.random() < 0.05)
				phaseBoard.blockId[i][j] = B_BORDERS
		}
	}
	return phaseBoard;
}

var phaseIdGenetator = 0;
function getUniquePhaseId() {
	return phaseIdGenetator++;
}