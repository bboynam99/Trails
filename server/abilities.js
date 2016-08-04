// this file contains the definition for all abilities
// this is the ordering (for reference only) : purple, yellow, blue, green, red, orange
// the functions that may be defined for each ability are:
// onTeleportLanding(x,y,p)
// onLinkComplete(A,B)
// onPlayerWallHit(x,y,p) // returns true if player lives, false if he dies
// onChangePosition(x,y,p)
require('./server.js');

module.exports = {
  abilities: [
		{
			name: '4 purples',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal a large number of points.',
			recipe: [4,0,0,0,0,0],
			onTeleportLanding: function(x,y,p) {
				console.log('Player ' + p.name + ' landed, looking for neaby player in a radius of ' + LINK_RANGE);
				var nearestPlayer = applyLogicAroundPosition(x,y,LINK_RANGE, function(x,y,r,result) {					
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
				if(nearestPlayer) // create link if possible
					checkForLink(board, p, nearestPlayer);
				console.log('found this nearby player:' + nearestPlayer);
			},
			onLinkComplete: function(A,B) {
				var ptsLoss = B.pts * ABILITY_4_PURPLE_POINTS_STEAL_RATIO;
				B.pts -= ptsLoss;
				A.pts += ptsLoss;
			}
		},
		{
			name: '4 yellows',
			description: 'Your teleport clearing effect now also removes power ups in a large area.',
			recipe: [0,4,0,0,0,0],
			onTeleportLanding: function(x,y,p) {
				var r = 
				applyLogicAroundPosition(x,y,ABILITY_4_YELLOW_CLEAR_RADIUS, function(x,y,r,result){
					if(board.isPowerUp[x][y] != PU_ID_NONE) {
						var id = board.isPowerUp[x][y];
						board.isPowerUp[x][y] = PU_ID_NONE;
						board.numPowerUpsOnBoard--;
					}
				});
			}
		},
		{
			name: '4 blues',
			description: 'After teleporting, you also clear blocks in a small radius for a short duration upon landing.',
			recipe: [0,0,4,0,0,0],
			onChangePosition: function(x,y,p) {
				if(p.cooldown >= p.maxCooldown - ABILITY_4_BLUE_CLEARING_DURATION)
					clearAroundPoint(x,y,ABILITY_4_BLUE_RADIUS_CLEAR);
			}
		},
		{
			name: '4 greens',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal his color.',
			recipe: [0,0,0,4,0,0]
		},
		{
			name: '4 reds',
			description: 'The next wall you hit will cause a large clearing effect and trigger your teleport cooldown.',
			recipe: [0,0,0,0,4,0],
			onPlayerWallHit: function(x,y,p) {
				if(p.cooldown > 0)
					return false; // kill player
					
				triggerCooldown(p);
				clearAroundPoint(x,y,ABILITY_4_RED_RADIUS_CLEAR);
				return true;
			}
		},
		{
			name: '4 oranges',
			description: 'Your teleport clearing effect can now kill other players.',
			recipe: [0,0,0,0,0,4]
		}
	]
};

//
// A bunch of helper functions
//

function checkForLink(board, playerA, playerB) {
	if(board.links) {
		if(Math.abs(playerA.x - playerB.x) + Math.abs(playerA.y - playerB.y) <= LINK_RANGE) { // link range
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
}

// calls logic(x,y,r,board,previousResult) at each position, in a "fold left" fashion
function applyLogicAroundPosition(x,y,r,logic) {
	r = Math.round(r * 2);
	r = r * r;
	X0 = Math.max(x - r,1);
	X1 = Math.min(x + r, board.W-2);
	Y0 = Math.max(y - r,1);
	Y1 = Math.min(y + r, board.H-2);
	result = undefined;
	for (var i=X0;i<=X1;i++) {
		for (var j=Y0;j<=Y1;j++) {
			if((i-x)*(i-x)+(j-y)*(j-y) <= r)
				result = logic(i,j,r,result);
		}
	}
	return result;
}

// this may be useful at some point..
	/*if(board.links) {
		if(playerA.slotAggregation[PU_ID_PTSLOSS-1] > 0) { // has the ability to ally
			if(board.colorsLUT[playerA.blocId] != board.colorsLUT[playerB.blocId]) { // different colors
				if(playerB.pts >= playerA.pts * (1-LINK_ALLIANCE_T) && playerB.pts <= playerA.pts * (1/LINK_ALLIANCE_T)) { // is withing threshold
					if(Math.abs(playerA.x - playerB.x) + Math.abs(playerA.y - playerB.y) <= LINK_RANGE) { // link range
						if(playerA.dx == playerB.dx && playerA.dy == playerB.dy) { // direction is the same
							if(!(playerA in board.links) && !(playerB in board.links)) { // players don't already have a link
								if(playerA.pts > playerB.pts) {
									console.log('new link created between ' + playerA.name + ' and ' + playerB.name + '!');
									board.links[playerA] = {
										fromP: playerA,
										toP: playerB,
										dt: 0
									}
								}
							}
						}
					}
				}
			}
		}
	}*/
