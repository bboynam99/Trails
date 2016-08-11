// handles score board (with persistency)

module.exports = {
	getScores,
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

function getHighestScore() {	
	if (leaderboard.length == 0)
		return 0;
	else
		return leaderboard[0].score;
}

function getScores() {
	return leaderboard;
}

function addScore(name, score) {
	if (score > getHighestScore()) {
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
		jsonfile.writeFile(file, leaderboard, function (err) {
			console.error('Failed to serizalize/save leaderboard: ' + err);
		})
	}
}