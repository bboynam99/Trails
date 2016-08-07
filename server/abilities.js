// this file contains the definition for all abilities
// this is the ordering (for reference only) : purple, yellow, blue, green, red, orange
// the functions that may be defined for each ability are:
// onTeleportLanding(x,y,p)
// onLinkComplete(A,B)
// onPlayerWallHit(x,y,p) // returns true if player lives, false if he dies
// onChangePosition(x,y,p)
var b = require('./board.js');
require('./server.js');

module.exports = {
  abilities: [
		{
			name: '4 purples',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal a large number of points.',
			recipe: [4,0,0,0,0,0],
			onTeleportLanding: function(board,playerLUT,x,y,p) {
				var nearestPlayer = b.findNearestPlayer(x,y,LINK_RANGE,p);
				
				if(nearestPlayer) // create link if possible
					b.createLink(board, p, nearestPlayer);
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
				b.applyLogicAroundPosition(x,y,ABILITY_4_YELLOW_CLEAR_RADIUS, function(x,y,result){
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
					b.clearAroundPoint(board,x,y,ABILITY_4_BLUE_RADIUS_CLEAR);
			}
		},
		{
			name: '4 greens',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal their color.',
			recipe: [0,0,0,4,0,0],
			onTeleportLanding: function(board,playerLUT,x,y,p) {
				var nearestPlayer = b.findNearestPlayer(x,y,LINK_RANGE,p);
				if(nearestPlayer) // create link if possible
					b.createLink(board, p, nearestPlayer);
			},
			onLinkComplete: function(A,B,board,sockets) {
				A.hue = B.hue;
				colorsLUT[A.blocId] = A.hue;
				sockets[A.id].emit('newHue', A.hue);
			}
		},
		{
			name: '4 reds',
			description: 'The next wall you hit will cause a large clearing effect and trigger your teleport cooldown.',
			recipe: [0,0,0,0,4,0],
			onPlayerWallHit: function(x,y,p) {
				if(p.cooldown > 0)
					return false; // kill player
					
				b.triggerCooldown(p);
				b.clearAroundPoint(board,x,y,ABILITY_4_RED_RADIUS_CLEAR);
				return true;
			}
		},
		{
			name: '4 oranges',
			description: 'Your teleport clearing effect can now kill other players.',
			recipe: [0,0,0,0,0,4],
			onTeleportLanding: function(board,playerLUT,x,y,p) {
				var nearestPlayer = b.findNearestPlayer(x,y,ABILITY_4_ORANGE_KILL_RADIUS,p);
				if(nearestPlayer) // kill players! TODO: the line below does not work :( need to find a visibility solution.
					hasCrashedInto(p, nearestPlayer, 'You were eliminated by ' + p.name + '\'s power up ability.');
			}
		}
	]
};



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