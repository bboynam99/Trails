// handles score board (with persistency)

module.exports = {
	updateLeaderboard,
	addScore
}

var jsonfile = require('jsonfile')
var leaderboard = [];
var MAX_LENGTH = 10;
var PERSISTENCE = 1000*60*60; // the time in ms a score will last
var file = './leaderboard.json'
jsonfile.readFile(file, function(err, obj) {
	if(obj)
		leaderboard = obj;
});

function getLowestScore() {	
	if (leaderboard.length == 0)
		return 0;
	else
		return leaderboard[leaderboard.length-1].score;
}

function addScore(name, score) {
	if (leaderboard.length < MAX_LENGTH || score > getLowestScore()) {
		leaderboard.push({
			name:name,
			score:score,
			ts:Date.now()
		});
		leaderboard.sort(function(a, b){return b.score-a.score});
		var now = Date.now();
		leaderboard = leaderboard.filter(function(val){return (now - val.ts) <= PERSISTENCE});
		
		if(leaderboard.length > MAX_LENGTH)
			leaderboard.pop();
		// write to disk
		try {
		jsonfile.writeFile(file, leaderboard);
		}catch(err) {
			console.error('Failed to serizalize/save leaderboard: ' + err);
		}
	}
}

function updateLeaderboard(player) {
	var scores = leaderboard.map(function(obj){ // we don't want to send out timestamp
		return {
			name: obj.name,
			score: Math.round(obj.score)
		};
	})
	
	if(!player) {
		users.forEach( function(u) {
			if(!u.isDead)
				sockets[u.id].emit('updateLeaderBoard', scores);
		});
	} else {
		sockets[player.id].emit('updateLeaderBoard', scores);
	}
}

setInterval(updateLeaderboard, 10000);
	