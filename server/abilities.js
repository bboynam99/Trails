// this file contains the definition for all abilities
// this is the ordering (for reference only) : Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
// the functions that may be defined for each ability are:
// onTeleportLanding(x,y,p)
// onLinkComplete(A,B)
// onPlayerWallHit(x,y,p) // returns true if player lives, false if he dies
// onChangePosition(x,y,p)
// afterCacheStatsLogic(p)
// teleportOverride(p)
// powerUpPickupOverride(p,type) // returns false to cancel default behavior 
// teleportLandingOverride(p)
var b = require('./board.js');
var objects = require('./gameObject.js');


module.exports = {
	aggregatePowerUp,
	abilities
};

var abilities = [
	{
		name: 'Point Vacuum',
		description: 'After teleporting, you channel a ray on a nearby player in attempt to steal a large number of points.',
		recipe: [-2,3,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			const POINTS_VAC_STEAL_RATIO = 0.35; // the ratio of points stolen
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 1.5, 10, 2);
		},
		onLinkComplete: function(A,B) {
			var ptsLoss = B.pts * POINTS_VAC_STEAL_RATIO;
			B.pts -= ptsLoss;
			A.pts += ptsLoss;
		}
	},
	{
		name: 'Safe Landing',
		description: 'Your teleport clearing effect now also removes power ups in a large area.',
		recipe: [0,3,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			const LANDING_CLEAR_RADIUS = 8;
			b.applyLogicAroundPosition(x,y,LANDING_CLEAR_RADIUS, function(x,y,result){
				if(board.isPowerUp[x][y] != PU_ID_NONE) {
					var id = board.isPowerUp[x][y];
					board.isPowerUp[x][y] = PU_ID_NONE;
					board.numPowerUpsOnBoard--;
				}
			});
		}
	},
	{
		name: 'Bulldozer blade', // TODO: add a fun visual
		description: 'After teleporting, you also clear blocks in a small radius for a short duration.',
		recipe: [-1,-2,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onChangePosition: function(x,y,p) {
			const BULLDZR_CLEARING_DURATION = 0.50; // the fraction on the CD that the effect lasts
			const BULLDZR_RADIUS_CLEAR = 2;
			//console.log(p.cooldown + '>=' + (p.maxCooldown * (1-BULLDZR_CLEARING_DURATION)))
			if(p.cooldown >= p.maxCooldown * (1-BULLDZR_CLEARING_DURATION))
				b.clearAroundPoint(x + Math.sign(p.dx)*2,y + Math.sign(p.dy)*2,BULLDZR_RADIUS_CLEAR);
		}
	},
	{
		name: 'Chameleon Device',
		description: 'After teleporting, channel a ray on a nearby player in attempt to steal their color.',
		recipe: [2,3,3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,10,p);
			if(nearestPlayer != null) // create link if possible
				objects.createLink(p, nearestPlayer, 0.65, 16, 1);
		},
		onLinkComplete: function(A,B) {
			A.hue = B.hue;
			board.colorsLUT[A.blockId] = A.hue;
			sockets[A.id].emit('newHue', A.hue);
		}
	},
	{
		name: 'C-4',
		description: 'When your teleport is ready, the next wall you hit will cause a large clearing effect and trigger a short cooldown.',
		recipe: [3,-3,3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onPlayerWallHit: function(x,y,p) {
			const C4_CD = 2; // the cooldown triggered
			if(p.cooldown > 0)
				return false; // kill player
				
			b.triggerCooldown(p,C4_CD);
			b.clearAroundPoint(x,y,6);
			sockets[p.id].emit('trCd', C4_CD);

			return true;
		}
	},
	{
		name: 'Death Ray',
		description: 'After teleporting, channel a Death Ray in attempt to eliminate a nearby player.',
		recipe: [0,0,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 1.5, 10, 3);
		},
		onLinkComplete: function(A,B) {
			b.hasCrashedInto(A, B, 'You were eliminated by ' + A.name + '\'s power up ability.');
		}
	},
	{
		name: 'Air Bags',
		description: 'Crashing into a wall will cause you to lose some points instead of eliminating you.',
		recipe: [-3,-2,2], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onPlayerWallHit: function(x,y,p) {
			b.clearAroundPoint(x,y,1);
			p.pts -= Math.max(250,p.pts*.15);
			return true;
		}
	},
	{
		name: 'Switch-A-Roo',
		description: 'After teleporting, channel a ray on a nearby player to switch position and color.',
		recipe: [1,3,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,10,p);
			if(nearestPlayer != null) // create link if possible
				objects.createLink(p, nearestPlayer, 1.50, 12, 1); // TODO: add unique effect
		},
		onLinkComplete: function(A,B) {
			var tmp = {
				x:A.x,
				y:A.y,
				dx:A.dx,
				dy:A.dy,
				hue:A.hue
			};
			b.newState(A,B.x,B.y,B.dx,B.dy,B.hue);
			b.newState(B,tmp.x,tmp.y,tmp.dx,tmp.dy,tmp.hue);
			board.colorsLUT[A.blockId] = A.hue;
			board.colorsLUT[B.blockId] = B.hue;
		}
	},
	{
		name: 'Rapid recovery',
		description: 'After teleporting, channel a ray on a nearby player in attempt to trigger their cooldown, and reset yours.',
		recipe: [2,1,-1], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 0.75, 12, 2);
		},
		onLinkComplete: function(A,B) {
			b.triggerCooldown(A,0.15);
			sockets[A.id].emit('trCd', 0.15);
			b.triggerCooldown(B);
			sockets[B.id].emit('trCd', B.maxCooldown);
		}
	},
	{
		name: 'Improved Teleport',
		description: 'Greatly reduces the cooldown on your teleport at the cost of points.',
		recipe: [3,3,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		afterCacheStatsLogic: function(p) {
			p.maxCooldown = 0.15;
		},
		onTeleportLanding: function(x,y,p) {
			p.pts -= 100;
		}
	},
	{
		name: 'E.M.P.',
		description: 'Clears the entire map (20 second cooldown). Replaces teleport.',
		recipe: [2,-4,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		teleportOverride: function(p) {
			b.clearEntireBoard(); // TODO: add a fun visual effect
			b.triggerCooldown(p, 20);
			sockets[p.id].emit('trCd', 20);
		}
	},
	{
		name: 'Quick Escape',
		description: 'Your teleport triggers automatically when you hit a wall. Greatly lowers the cooldown.',
		recipe: [3,0,3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onPlayerWallHit: function(x,y,p) {
			if(p.cooldown > 0){
				return false;
			}
			
			var tx = Math.round(p.x + p.dx * p.teleportDist);
			var ty = Math.round(p.y + p.dy * p.teleportDist);				
			b.teleportPlayer(p,tx,ty);
			const SHORT_CD_QUICK_ESCAPE = 2;
			b.triggerCooldown(p,SHORT_CD_QUICK_ESCAPE);
			sockets[p.id].emit('trCd', SHORT_CD_QUICK_ESCAPE);
			b.newState(p,tx,ty,p.dx,p.dy,p.hue);
			return true;
		}
	},
	{
		name: 'Entrenchment',
		description: 'Clear everything in a large area around you, surrounding you with a thin wall (12 sec cd). Replaces teleport.',
		recipe: [0,-3,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		teleportOverride: function(p) {
			const ENTRCH_CD = 12;
			const ENTRCH_RADIUS = 12;
			var ENTRCH_RADIUS2 = ENTRCH_RADIUS*ENTRCH_RADIUS;
			var now = Date.now();
			b.applyLogicAroundPosition(p.x,p.y,ENTRCH_RADIUS, function(i,j,result,dist2) {
				if(board.blockId[i][j] != B_BORDERS) {
					if(ENTRCH_RADIUS - Math.sqrt(dist2) <= 1.35) {
						board.blockId[i][j] = p.blockId;
						board.blockTs[i][j] = now;
					} else {
						board.blockId[i][j] = B_EMPTY;
					}
				}
				return result;
			});

			b.triggerCooldown(p, ENTRCH_CD);
			sockets[p.id].emit('trCd', ENTRCH_CD);
		}
	},
	{
		name: 'Bonus Points',
		description: 'Picking up additional green power ups provides bonus points.',
		recipe: [-3,2,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		powerUpPickupOverride: function(p,type) {
			if(type == PU_ID_POINTS) { // green or yellow
				p.pts += 150;
				return false;
			}
			return true;
		}
	},
	{
		name: 'Recycling Device',
		description: 'Gain bonus points for every block you clear by teleporting.',
		recipe: [-3,-3,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		teleportLandingOverride: function(p) {
			var r = TELE_CLEAR_RADIUS + Math.max(0,p.slotsAxis[PU_TO_AXIS[PU_ID_TELEAOE-1]] * PU_DIR[PU_ID_TELEAOE-1]) * PU_TELE_AOE;
			
			var count = b.applyLogicAroundPosition(p.x,p.y,r, function(i,j,result) {
				if(!result)
					result = 0;
				if(board.blockId[i][j] != B_BORDERS) {
					if(board.blockId[i][j] != B_EMPTY) {
						board.blockId[i][j] = B_EMPTY;
						result++;
					}
				}
				return result;
			});
			p.pts += count * 5;
			b.triggerCooldown(p);
		}
	},
	{
		name: 'Point ray',
		description: 'Channel a ray on a nearby player in attempt to steal a large number of points. Replaces teleport.',
		recipe: [-3,1,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		teleportOverride: function(p) {
			if(p.cooldown > 0)
				return;
			
			var nearestPlayer = b.findNearestPlayer(p.x,p.y,8,p);
			
			if(nearestPlayer != null){  // create link if possible
				objects.createLink(p, nearestPlayer, 1.5, 10, 2);
				b.triggerCooldown(p);
				sockets[p.id].emit('trCd', p.maxCooldown);
			}
		},
		onLinkComplete: function(A,B) {
			const POINTS_RAY_STEAL_RATIO = 0.35; // the ratio of points stolen
			var ptsLoss = B.pts * POINTS_RAY_STEAL_RATIO;
			B.pts -= ptsLoss;
			A.pts += ptsLoss;
		}
	},
	{
		name: 'Stealing Ray',
		description: 'After teleporting, channel a ray in attempt to steal all of another player\'s power ups.',
		recipe: [3,2,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 1.5, 10, 2);
		},
		onLinkComplete: function(A,B) {
			A.slotsAxis = B.slotsAxis;
			B.slotsAxis = Array.apply(null, Array(NUM_AXIS)).map(Number.prototype.valueOf,0);
			aggregatePowerUp(A);
			aggregatePowerUp(B);
			
		}
	},
	{
		name: 'Black Hole',
		description: 'Before teleporting, drop a black hole, attracting nearby players for a few seconds. Increases the cooldown.',
		recipe: [3,-1,0], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p,ox,oy) {
			objects.createBlackHole(ox,oy,7.0);//duration
		},
		afterCacheStatsLogic: function(p) {
			p.maxCooldown = 20;
		}
	},
	{
		name: 'Laser Beam',
		description: 'Trigger a laser beam that clears an entire line, eliminating players in the process (15s cd). Replaces teleport.',
		recipe: [0,-2,3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		onTeleportLanding: function(x,y,p,ox,oy) {
			if(p.dx != 0)
				objects.createLaser(p,true,y,1,2.25);
			else
				objects.createLaser(p,false,x,1,2.25);
		},
		afterCacheStatsLogic: function(p) {
			p.maxCooldown = 15;
		}
	},
	{
		name: 'Doomsday Device',
		description: 'Trigger a Doomsday clock. The last player to find shelter dies. This consumes your power ups in the process. Replaces teleport.',
		recipe: [3,-2,-3], // Fast vs Greedy  ||  Sneaky vs Destructive  || Solitary vs Hostile
		teleportOverride: function(p) {
			objects.createDoomsdayPhase(p, function() { // creator gets out function
				// clear power ups
				p.slotsAxis = Array.apply(null, Array(NUM_AXIS)).map(Number.prototype.valueOf,0);
				aggregatePowerUp(p);
			});
			
			b.triggerCooldown(p, 1);
			sockets[p.id].emit('trCd', 1);			
		}
	}
];

// ability related functions:

function aggregatePowerUp(player) {	
	// update ability based on the totals computed
	var sum = player.slotsAxis.reduce((prev, curr) => prev + Math.abs(curr),0);
	//console.log('player has ' + sum + ' PUs.');
	const NEEDS_AT_LEAST = 2;
	if (sum < NEEDS_AT_LEAST)
		player.specialAbility = null;
	else {
		var bestMatch = null;
		var bestMatchDist = Number.POSITIVE_INFINITY;
		for (var i=0; i<abilities.length; i++) {
			var dist = abilities[i].recipe.reduce((prev,cur,i) => prev + Math.abs(cur - player.slotsAxis[i]),0);
			//console.log('found a distance of ' + dist + ' for ability ' + abilities[i].name);
			if (dist < bestMatchDist) {
				bestMatchDist = dist;
				bestMatch = abilities[i];
			}
		}
		player.specialAbility = bestMatch;
	}
	
	// send client update for tooltip
	if(player.specialAbility)
		sockets[player.id].emit('newAbility', player.specialAbility.name + ': ' + player.specialAbility.description, player.specialAbility.teleportOverride != null); // last param = true if client should NOT exec tele logic
	else
		sockets[player.id].emit('newAbility', '', false);
	
	// cache some stuff
	
	player.maxCooldown = TELE_COOLDOWN - Math.max(0,player.slotsAxis[PU_TO_AXIS[PU_ID_TELECD-1]] * PU_DIR[PU_ID_TELECD-1]) * PU_TELE_CD;
	player.dpts = DEFAULT_POINTS_PER_SEC + Math.max(0,player.slotsAxis[PU_TO_AXIS[PU_ID_POINTS-1]] * PU_DIR[PU_ID_POINTS-1]) * PU_POINTS_MOD ;
	player.teleportDist = TELE_DISTANCE + Math.max(0,player.slotsAxis[PU_TO_AXIS[PU_ID_TELERANGE-1]] * PU_DIR[PU_ID_TELERANGE-1]) * PU_TELE_RANGE;
	player.lpr = DEFAULT_LOSING_POINTS_RATIO - Math.max(0,player.slotsAxis[PU_TO_AXIS[PU_ID_PTSLOSS-1]] * PU_DIR[PU_ID_PTSLOSS-1]) * PU_PTS_LOSS_MOD;
	
	if(player.specialAbility && player.specialAbility.afterCacheStatsLogic)
		player.specialAbility.afterCacheStatsLogic(player);
	
	sockets[player.id].emit('newVals', {
		maxCooldown: player.maxCooldown,
		dpts: player.dpts,
		lpr: player.lpr,
		teleportDist: player.teleportDist
	});
}