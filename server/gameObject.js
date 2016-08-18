// contains everything related to game objects (e.g. links)

var b = require('./board.js');
	
module.exports = {
	createLink,
	createBlackHole
};

var LINK_ID=1, BKHL_ID=2;
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
		fromP: link.data.fromP.blocId,
		toP: link.data.toP.blocId,
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
function updateBlackHole(obj, dt){
	obj.data.dt += dt;
	//console.log('link time is now :' + obj.data.dt + ' of ' + obj.data.exp);
	if(obj.data.dt >= obj.data.exp) { // link expired
		removeObject(obj);
		// TODO: align every player's X and Y
		//console.log('Link completed!');
	} else{
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