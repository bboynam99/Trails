// handles player spawns

module.exports = {
	setSpawnLogic,
	setCountPlayersOnboard,
	queuePlayer
}


var MAX_PLAYERS = 1;
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
	if(playerCount < MAX_PLAYERS)
		spawnlogic(player);
	else
		queue.unshift(player);
}

function spawn(player) { // periodic check
	if (!validate()) return;

	var playerCount = countPlayersOnboard();
	while(playerCount <= MAX_PLAYERS && queue.length > 0) {
		var p = queue.pop();
		if(sockets[p.id] && sockets[p.id].connected){
			spawnlogic(p);
			playerCount++;
		}
	}
}

function sendQueueUpdates(){ // periodic updates
	if (!validate()) return;
	
	queue.forEach(function(p){
		//emit queue update
	});
}
setInterval(spawn, 1000);
setInterval(sendQueueUpdates, 500);