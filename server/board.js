module.exports = {
	applyLogicAroundPosition,
	findNearestPlayer,
	clearAroundPoint,
	triggerCooldown,
	hasCrashedInto,
	killPlayer,
	newState,
	clearEntireBoard,
	teleportPlayer,
	changePhase,
	unphase,
	changedPosition
}

global.board = { // game board
	H: BOARD_H,
	W: BOARD_W,
	blockId: null,
	isPowerUp: null,
	blockTs: null,
	numPowerUpsOnBoard: 0,
	colorsLUT: []
};
board.colorsLUT = [];

// init board
board.blockId = new Array(board.W);
board.isPowerUp = new Array(board.W);
board.blockTs = new Array(board.W);
for (var i=0;i<board.W;i++) {
	board.blockId[i] = new Array(board.H);
	board.isPowerUp[i] = new Array(board.H);
	board.blockTs[i] = new Array(board.H);
	for (var j=0;j<board.H;j++) {
		board.isPowerUp[i][j] = PU_ID_NONE;
		board.blockId[i][j] = B_EMPTY;
		board.blockTs[i][j] = 0;
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

global.blockIdLUT = {};

//
// A bunch of helper functions
//

// calls logic(x,y,r,board,previousResult) at each position, in a "fold left" fashion
function applyLogicAroundPosition(x,y,r,logic) {
	r = Math.round(r);
	x = Math.round(x);
	y = Math.round(y);
	X0 = Math.max(x - r,1);
	X1 = Math.min(x + r, board.W-2);
	Y0 = Math.max(y - r,1);
	Y1 = Math.min(y + r, board.H-2);
	r = r * r;
	result = null;
	for (var i=X0;i<=X1;i++) {
		for (var j=Y0;j<=Y1;j++) {
			var dist = (i-x)*(i-x)+(j-y)*(j-y);
			if(dist <= r)
				result = logic(i,j,result,dist);
		}
	}
	return result;
}

function findNearestPlayer(x,y,r,p){
	var val = applyLogicAroundPosition(x,y,r, function(i,j,result) {				
		var o = playerBoard[i][j];
		
		if(o != null && (o.isDead || o.id == p.id || o.phase != p.phase)) // ignore self, dead players, and phased players
			return result;
		
		if(result == null) // ignore empty cells
			return o;
		if(o == null)
			return result;
		
		// keep nearest player
		if(Math.abs(result.x - x) + Math.abs(result.y - x) < Math.abs(o.x - x) + Math.abs(o.y - x)) 
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
		p.cooldown = cd;
	else
		p.cooldown = Math.max(p.cooldown,p.maxCooldown);
}

function hasCrashedInto(crashee, crasher, customMsg) {
	if(!crashee || crashee.isDead)
		return;
	
	crashee.pts += crasher.pts * 0.35;
	for (var i=1;i<board.W-1;i++) { // clear crashee's trail
		for (var j=1;j<board.H-1;j++) {
			if(Math.abs(board.blockId[i][j]) == crashee.blockId) {
				board.blockId[i][j] = B_EMPTY;
			}
		}
	}
	if(!customMsg)
		customMsg = 'You were eliminated by ' + crashee.name + '.';
	killPlayer(crasher, ' was eliminated by ' + crashee.name, customMsg);
	sockets[crashee.id].emit('eliminatedPlayer', crasher.name);
}

function killPlayer(p, reason, message) {
	try {
		score.addScore(p.name,p.bestPts);
		console.log('Killing player ' + p.name + ' because: ' + reason)
		p.isDead = true;
		p.pts = 1;
		p.bestPts = 1;
		p.cooldown = TELE_COOLDOWN;
		p.lpr = DEFAULT_LOSING_POINTS_RATIO;
		p.bonusSizeCache = 0;
		p.phase = null;
		
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
				if(Math.abs(board.blockId[i][j]) == p.blockId) {
					board.blockId[i][j] = B_EMPTY;
				}
			}
		}
	} catch(err) {
		console.log('error while killing player: ' + err);
	}
}

function newState(p,x,y,dx,dy,hue) {
	p.x = x; p.y = y;
	p.dx = dx; p.dy = dy;
	p.hue = hue;
	sockets[p.id].emit('newState',p.x,p.y,p.dx,p.dy,p.hue);
}

function clearEntireBoard() {
	for (var i=1;i<board.W-1;i++) {
		for (var j=1;j<board.H-1;j++) {
			board.blockId[i][j] = B_EMPTY;
		}
	}
}

function teleportPlayer(player,x,y,cd) {
	var originalX = Math.round(player.x), originalY = Math.round(player.y);
	player.x = x;
	player.y = y;
	playerBoard[player.lastX][player.lastY] = null; // update player position LUT
	player.lastX = Math.round(x);
	player.lastY = Math.round(y);
	playerBoard[player.lastX][player.lastY] = player;
	
	if(player.specialAbility && player.specialAbility.teleportLandingOverride) {
		player.specialAbility.teleportLandingOverride(player);
		return;
	}
	
	triggerCooldown(player, cd);
	var r = TELE_CLEAR_RADIUS + player.slotAggregation[PU_ID_TELEAOE-1] * PU_TELE_AOE;
	clearAroundPoint(player.x,player.y,r);
	
	if(player.specialAbility && player.specialAbility.onTeleportLanding)
		player.specialAbility.onTeleportLanding(player.x,player.y,player,originalX,originalY);
}

function changePhase(player, phase) {
	if(player.phase != phase) {
		player.phase = phase;
		sockets[player.id].emit('newPhase',phase.type);
	}
}

function unphase(player) {
	player.phase = null;
	sockets[player.id].emit('unphase');
}

function changedPosition(p, oldx,oldy,newx,newy) {// ROUND NUMBERS ONLY!
	playerBoard[oldx][oldy] = null; // update player position LUT
	playerBoard[newx][newy] = p;
	p.lastX = newx;
	p.lastY = newy;
}