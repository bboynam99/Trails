// handles player spawns

module.exports = {
	setSpawnLogic,
	setCountPlayersOnboard,
	queuePlayer
}


var MAX_PLAYERS = 40;
var queue = [];
var spawnlogic;
var countPlayersOnboard;


function validate(){
	return countPlayersOnboard && setSpawnLogic;
}

function setSpawnLogic(logic) {
	spawnlogic = logic;
}

function setCountPlayersOnboard(logic){	
	countPlayersOnboard = logic;
}

function queuePlayer(player) {	
	var playerCount = countPlayersOnboard();
	
	if(playerCount < MAX_PLAYERS && queue.length == 0)
		spawnlogic(player);
	else if(queue.indexOf(player) == -1){
		queue.unshift(player);
	}
}

function spawn(player) { // periodic check
	if (!validate()) return;

	var playerCount = countPlayersOnboard();

	while(playerCount < MAX_PLAYERS && queue.length > 0) {
		var p = queue.pop();
		if(sockets[p.id]){
			spawnlogic(p);
			playerCount++;
		}
	}
}

function sendQueueUpdates(){ // periodic updates
	if (!validate()) return;
	
	//clean up queue (disconects)
	for(i=queue.length-1;i>=0;i--) {
		if(!sockets[queue[i].id]) {
			queue.splice(i, 1);
		}
	}
	pos = queue.length;
	// send updates to remaining players
	queue.forEach(function(p){
		sockets[p.id].emit('queue',pos--,queue.length);
	});
}
setInterval(spawn, 2000);
setInterval(sendQueueUpdates, 1000);