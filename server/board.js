module.exports = {
	createLink,
	applyLogicAroundPosition,
	findNearestPlayer,
	clearAroundPoint,
	triggerCooldown
}

global.board = { // game board
	H: 100,
	W: 100,
	blockId: null,
	isPowerUp: null,
	BlockTs: null,
	numPowerUpsOnBoard: 0,
	links: [],
	colorsLUT: []
};
board.links = []; // link maps between players
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

function createLink(playerA, playerB) {
	if(board.links) {
		if(!(playerA in board.links) && !(playerB in board.links)) { // players don't already have a link
			console.log('New link channeling between ' + playerA.name + ' and ' + playerB.name);
			board.links[playerA] = {
				fromP: playerA,
				toP: playerB,
				dt: 0
			}
		}
	}
}

// calls logic(x,y,r,board,previousResult) at each position, in a "fold left" fashion
function applyLogicAroundPosition(x,y,r,logic) {
	r = Math.round(r);
	X0 = Math.max(x - r,1);
	X1 = Math.min(x + r, board.W-2);
	Y0 = Math.max(y - r,1);
	Y1 = Math.min(y + r, board.H-2);
	r = r * r;
	result = undefined;
	for (var i=X0;i<=X1;i++) {
		for (var j=Y0;j<=Y1;j++) {
			if((i-x)*(i-x)+(j-y)*(j-y) <= r)
				result = logic(i,j,r,result);
		}
	}
	return result;
}

function findNearestPlayer(x,y,r,p){
	return applyLogicAroundPosition(x,y,r,board, function(x,y,result) {					
		if(x == p.x && y == p.y) // skip self
			return result;
		
		var o = playerBoard[x][y];
		
		if(!result) // ignore empty cells
			return o;
		if(!o)
			return result;
		
		// keep nearest player
		if(Math.abs(result.x - x) + Math.abs(result.y - x) < Math.abs(o.x - x) + Math.abs(o.y - x)) 
			return result;
		else
			return o;
	});
}

function clearAroundPoint(x,y,r) {
	//console.log('clearing around point ('+x+','+y+') r='+r);
	applyLogicAroundPosition(x,y,r, function(i,j,result) {
		if(board.blockId[i][j] != B_BORDERS)
			board.blockId[i][j] = B_EMPTY;
		return undefined;
	});
}
function triggerCooldown(p) {
	p.cooldown = p.maxCooldown;
}