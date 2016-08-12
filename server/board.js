module.exports = {
	applyLogicAroundPosition,
	findNearestPlayer,
	clearAroundPoint,
	triggerCooldown,
	hasCrashedInto,
	killPlayer
}

global.board = { // game board
	H: BOARD_H,
	W: BOARD_W,
	blockId: null,
	isPowerUp: null,
	BlockTs: null,
	numPowerUpsOnBoard: 0,
	colorsLUT: []
};
board.colorsLUT = [];

// init board
board.blockId = new Array(board.W);
board.isPowerUp = new Array(board.W);
board.BlockTs = new Array(board.W);
for (var i=0;i<board.W;i++) {
	board.blockId[i] = new Array(board.H);
	board.isPowerUp[i] = new Array(board.H);
	board.BlockTs[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		board.isPowerUp[i][j] = PU_ID_NONE;
		board.blockId[i][j] = B_EMPTY;
		board.BlockTs[i][j] = 0;
		if(i == 0 || j == 0 || i == board.W-1 || j == board.H-1)
			board.blockId[i][j] = B_BORDERS;
	}
}

global.playerBoard = new Array(board.W); // allows to efficiently retrieve nearby players
for (var i=0;i<board.W;i++) {
	playerBoard[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		playerBoard[i][j] = null;
	}
}

global.blocIdLUT = {};

//
// A bunch of helper functions
//

// calls logic(x,y,r,board,previousResult) at each position, in a "fold left" fashion
function applyLogicAroundPosition(x,y,r,logic) {
	r = Math.round(r);
	X0 = Math.max(x - r,1);
	X1 = Math.min(x + r, board.W-2);
	Y0 = Math.max(y - r,1);
	Y1 = Math.min(y + r, board.H-2);
	r = r * r;
	result = null;
	for (var i=X0;i<=X1;i++) {
		for (var j=Y0;j<=Y1;j++) {
			if((i-x)*(i-x)+(j-y)*(j-y) <= r)
				result = logic(i,j,result);
		}
	}
	return result;
}

function findNearestPlayer(x,y,r,p){
	var val = applyLogicAroundPosition(x,y,r, function(i,j,result) {				
		if(i == x && j == y) // skip self
			return result;
		
		var o = playerBoard[i][j];
		
		if(result == null) // ignore empty cells
			return o;
		if(o == null)
			return result;
		
		// keep nearest player
		if(o.isDead || Math.abs(result.x - x) + Math.abs(result.y - x) < Math.abs(o.x - x) + Math.abs(o.y - x)) 
			return result;
		else
			return o;
	});
	return val;
}

function clearAroundPoint(x,y,r) {
	//console.log('clearing around point ('+x+','+y+') r='+r);
	applyLogicAroundPosition(x,y,r, function(i,j,result) {
		if(board.blockId[i][j] != B_BORDERS)
			board.blockId[i][j] = B_EMPTY;
		return undefined;
	});
}
function triggerCooldown(p,cd) {
	if(cd)
		p.cooldown = Math.max(p.cooldown,cd);
	else
		p.cooldown = Math.max(p.cooldown,p.maxCooldown);
}

function hasCrashedInto(crashee, crasher, customMsg) {
	crashee.pts += crasher.pts;
	for (var i=1;i<board.W-1;i++) { // clear crashee's trail
		for (var j=1;j<board.H-1;j++) {
			if(Math.abs(board.blockId[i][j]) == crashee.blocId) {
				board.blockId[i][j] = B_EMPTY;
			}
		}
	}
	if(!customMsg)
		customMsg = 'You were eliminated by ' + crashee.name + '.';
	killPlayer(crasher, ' was eliminated by ' + crashee.name, customMsg);
	sockets[crashee.id].emit('eliminatedPlayer');
}

function killPlayer(p, reason, message) {
	try {
		leaderboard.addScore(p.name,p.pts);
		console.log('Killing player ' + p.name + ' because: ' + reason)
		p.isDead = true;
		p.pts = 0;
		p.cooldown = TELE_COOLDOWN;
		p.lpr = DEFAULT_LOSING_POINTS_RATIO;
		p.bonusSizeCache = 0;
		
		for (var i=0;i<PU_SLOTS;i++)
			p.slots[i] = PU_ID_NONE;
		for (var i=0;i<MAX_POWERUP_ID;i++)
			p.slotAggregation[i]=0;
		p.lastSlotFilled = 0;
		
		sockets[p.id].emit('playerDied', message);
		if(Math.round(p.x) >= 0 && Math.round(p.y) >= 0 && Math.round(p.x) < board.W && Math.round(p.y) < board.H)
			playerBoard[Math.round(p.x)][Math.round(p.y)] = null;
		p.desyncCounter = 0;
		for (var i=1;i<board.W-1;i++) {
			for (var j=1;j<board.H-1;j++) {
				if(Math.abs(board.blockId[i][j]) == p.blocId) {
					board.blockId[i][j] = B_EMPTY;
				}
			}
		}
	} catch(err) {
		console.log('error while killing player: ' + err);
	}
}