// this file contains the definition for all abilities
// this is the ordering (for reference only) : purple, yellow, blue, green, red, orange
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
		recipe: [0,0,0,2,2,0], // purple, yellow, blue, green, red, orange
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
		recipe: [4,0,0,0,0,0], // purple, yellow, blue, green, red, orange
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
		recipe: [2,0,2,0,0,0], // purple, yellow, blue, green, red, orange
		onChangePosition: function(x,y,p) {
			const BULLDZR_CLEARING_DURATION = 0.75; // the fraction on the CD that the effect lasts
			const BULLDZR_RADIUS_CLEAR = 2;
			if(p.cooldown >= p.maxCooldown * (1-BULLDZR_CLEARING_DURATION))
				b.clearAroundPoint(x + Math.sign(p.dx)*2,y + Math.sign(p.dy)*2,BULLDZR_RADIUS_CLEAR);
		}
	},
	{
		name: 'Chameleon Device',
		description: 'After teleporting, channel a ray on a nearby player in attempt to steal their color.',
		recipe: [2,2,0,0,0,0], // purple, yellow, blue, green, red, orange
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,10,p);
			if(nearestPlayer != null) // create link if possible
				objects.createLink(p, nearestPlayer, 1.00, 12, 1);
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
		recipe: [0,0,2,0,2,0], // purple, yellow, blue, green, red, orange
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
		recipe: [2,0,0,0,0,2], // purple, yellow, blue, green, red, orange
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 2.5, 9, 3);
		},
		onLinkComplete: function(A,B) {
			b.hasCrashedInto(A, B, 'You were eliminated by ' + A.name + '\'s power up ability.');
		}
	},
	{
		name: 'Air Bags',
		description: 'Crashing into a wall will cause you to lose some points instead of killing you.',
		recipe: [0,0,0,4,0,0], // purple, yellow, blue, green, red, orange
		onPlayerWallHit: function(x,y,p) {
			b.clearAroundPoint(x,y,1);
			p.pts -= Math.Max(250,p.pts*.15);

			return true;
		}
	},
	{
		name: 'Switch-A-Roo',
		description: 'After teleporting, channel a ray on a nearby player to switch position and color.',
		recipe: [0,0,0,0,0,4], // purple, yellow, blue, green, red, orange
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
		recipe: [2,0,0,0,2,0], // purple, yellow, blue, green, red, orange
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 0.75, 9, 2);
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
		recipe: [2,0,0,2,0,0], // purple, yellow, blue, green, red, orange
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
		recipe: [0,0,4,0,0,0], // purple, yellow, blue, green, red, orange
		teleportOverride: function(p) {
			b.clearEntireBoard(); // TODO: add a fun visual effect
			b.triggerCooldown(p, 20);
			sockets[p.id].emit('trCd', 20);
		}
	},
	{
		name: 'Quick Escape',
		description: 'Your teleport triggers automatically when you hit a wall. Greatly lowers the cooldown.',
		recipe: [0,0,0,0,2,2], // purple, yellow, blue, green, red, orange
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
		recipe: [0,0,2,0,0,2], // purple, yellow, blue, green, red, orange
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
		description: 'Picking up additional yellow or green Power Ups will provide bonus points.',
		recipe: [0,2,0,2,0,0], // purple, yellow, blue, green, red, orange
		powerUpPickupOverride: function(p,type) {
			if(type == PU_ID_POINTS || type == PU_ID_PTSLOSS){ // green or yellow
				p.pts += 250;
				return false;
			}
			return true;
		}
	},
	{
		name: 'Recycling Device',
		description: 'Gain bonus points for every block you clear by teleporting.',
		recipe: [0,0,2,2,0,0], // purple, yellow, blue, green, red, orange
		teleportLandingOverride: function(p) {
			var r = TELE_CLEAR_RADIUS + p.slotAggregation[PU_ID_TELEAOE-1] * PU_TELE_AOE;
			
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
		recipe: [0,0,0,2,0,2], // purple, yellow, blue, green, red, orange
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
		recipe: [0,2,0,0,0,2], // purple, yellow, blue, green, red, orange
		onTeleportLanding: function(x,y,p) {
			var nearestPlayer = b.findNearestPlayer(x,y,8,p);
			
			if(nearestPlayer != null)  // create link if possible
				objects.createLink(p, nearestPlayer, 1.5, 10, 2);
		},
		onLinkComplete: function(A,B) {
			A.slots = B.slots;
			B.slots = Array.apply(null, Array(PU_SLOTS)).map(Number.prototype.valueOf,0);
			A.lastSlotFilled = 0; B.lastSlotFilled = 0;
			aggregatePowerUp(A);
			aggregatePowerUp(B);
			
		}
	},
	{
		name: 'Black Hole',
		description: 'Before teleporting, drop a black hole, attracting nearby players for a few seconds. Increases the cooldown.',
		recipe: [0,2,0,0,2,0], // purple, yellow, blue, green, red, orange
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
		recipe: [0,4,0,0,0,0], // purple, yellow, blue, green, red, orange
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
		recipe: [0,0,0,0,4,0], // purple, yellow, blue, green, red, orange
		teleportOverride: function(p) {
			objects.createDoomsdayPhase(p, function() { // creator gets out function
				// clear power ups
				p.slots = Array.apply(null, Array(PU_SLOTS)).map(Number.prototype.valueOf,0);
				p.lastSlotFilled = 0;
				aggregatePowerUp(p);
			});
			
			b.triggerCooldown(p, 1);
			sockets[p.id].emit('trCd', 1);			
		}
	}
];

// ability related functions:

function aggregatePowerUp(player) {
	for(var i =0;i<MAX_POWERUP_ID ;i++) //clear previous aggregation
		player.slotAggregation[i] = PU_ID_NONE;
	
	for(var i =0;i<PU_SLOTS ;i++) // count aggregation
		if(player.slots[i] > 0)
			player.slotAggregation[player.slots[i]-1]++;
			
	// update ability based on the totals computed
	player.specialAbility = abilities.find( function(a) {
		for(var i=0;i<MAX_POWERUP_ID;i++)
			if(player.slotAggregation[i] != a.recipe[i])
				return false;
		return true;
	});
	
	// send client update for tooltip
	if(player.specialAbility)
		sockets[player.id].emit('newAbility', player.specialAbility.name + ': ' + player.specialAbility.description, player.specialAbility.teleportOverride != null); // last param = true if client should NOT exec tele logic
	else
		sockets[player.id].emit('newAbility', '', false);
	
	// cache some stuff
	player.maxCooldown = TELE_COOLDOWN - player.slotAggregation[PU_ID_TELECD-1] * PU_TELE_CD;
	player.dpts = DEFAULT_POINTS_PER_SEC + player.slotAggregation[PU_ID_POINTS-1] * PU_POINTS_MOD ;
	player.teleportDist = TELE_DISTANCE + player.slotAggregation[PU_ID_TELERANGE-1] * PU_TELE_RANGE;
	player.lpr = DEFAULT_LOSING_POINTS_RATIO - player.slotAggregation[PU_ID_PTSLOSS-1] * PU_PTS_LOSS_MOD;
	
	if(player.specialAbility && player.specialAbility.afterCacheStatsLogic)
		player.specialAbility.afterCacheStatsLogic(player);
	
	sockets[player.id].emit('newVals', {
		maxCooldown: player.maxCooldown,
		dpts: player.dpts,
		lpr: player.lpr,
		teleportDist: player.teleportDist
	});
}