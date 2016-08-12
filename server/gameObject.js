// contains everything related to game objects (e.g. links)

// the functions that may be defined for each ability are:
// create
// update
var b = require('./board.js');
var gameObjects = [];
// gameObjects contains all objects on board.It is a structure like this:
/*
		type='',
		fcUpdate=function(Object, deltaTime), //(must call removeObject)
		fcIsVisibleByPlayer=function(object,player)
		data=''
*/	
module.exports = {
	createLink,
	linksSkins
};

var objectTypes = Object.freeze({'link':1});

function updateAllObjects(dt) { // update every object's state
	for(var i = gameObjects.length-1;i>0;i--)
		gameObjects[i].fcUpdate(obj,dt);
}

function sendUpdatesToPlayers() { // send updates to players	
	//for each player
	//filter objets that are near
	// playersubset.foreach
		//sockets[users].emit()
}
function sendNewObject(obj) { // send updates to players	
	for(player in sockets){
		if(!key.isDead && obj.fcIsVisibleByPlayer(obj,key)) {
			player.
		}
		// The value is obj[key]
	}

	//filter objets that are near
	// playersubset.foreach
		//sockets[users].emit()
}

function removeObject(obj) {
	var index = gameObjects.indexOf(obj);
	if (index > -1) {
		gameObjects.splice(index, 1);
	}
}

//
// LINKS
//
var linksSkins = Object.freeze({'electricArc':1});
function createLink(playerA, playerB, duration, maxRange, linksSkins) {
	if(playerA & playerB) {
		if(!(playerA in board.links) && !(playerB in board.links)) { // players don't already have a link
			console.log('New link channeling between ' + playerA.name + ' and ' + playerB.name);
			gameObjects.push({
				type: objectTypes.link
				fcUpdate=updateLinks,
				fcIsVisibleByPlayer=isLinkWithinRange,
				data: {
					fromP: playerA,
					toP: playerB,
					dt: 0,
					exp: duration,
					max: maxRange,
					skin: linksSkins
				}
			});
		}
	}
}

function updateLinks(obj, dt) {
	var A = obj.data.fromP, B = obj.data.toP;
	var dist = (Math.abs(A.x - B.x) + Math.abs(A.y - B.y));
	if(A.isDead || B.isDead || dist > obj.data.max ) {
		removeObject(obj); // link broken!
	} else {
		l.dt += dt;
		l.dt += dt;
		if(l.dt >= obj.data.exp) { // link expired
			if(A.specialAbility && A.specialAbility.onLinkComplete)
				A.specialAbility.onLinkComplete(A,B);
			removeObject(obj);
		}
	}
};

function isLinkWithinRange(link, player) {
	var dist1 = (Math.abs(link.data.fromP.x - player.x) + Math.abs(link.data.fromP.y - player.y));
	var dist2 = (Math.abs(link.data.toP.x - player.x) + Math.abs(link.data.toP.y - player.y));
	return (Math.Min(dist1,dist2) <= PLAYER_LOS_RANGE*2);
}
