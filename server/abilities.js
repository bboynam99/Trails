// this file contains the definition for all abilities
// this is the ordering (for reference only) : purple, yellow, blue, green, red, orange
// the functions that may be defined for each ability are:
// onTeleportLanding(board,playerLUT,x,y,p)
// onBeamComplete()
// onPlayerWallHit()
// onChangePosition()
module.exports = {
  abilities: [
		{
			name: '4 purples',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal a large number of points.',
			recipe: [4,0,0,0,0,0],
		},
		{
			name: '4 yellows',
			description: 'Your teleport clearing effect now also removes power ups in a large area.',
			recipe: [0,4,0,0,0,0],
			onTeleportLanding: function(board,playerLUT,x,y,r,p) {
				r = Math.round(r * 2);
				X0 = Math.max(x - r,1);
				X1 = Math.min(x + r, board.W-2);
				Y0 = Math.max(y - r,1);
				Y1 = Math.min(y + r, board.H-2);
				for (var i=X0;i<=X1;i++) {
					for (var j=Y0;j<=Y1;j++) {
						if(Math.sqrt((i-x)*(i-x)+(j-y)*(j-y)) <= r)
							if(board.isPowerUp[i][j] != PU_ID_NONE) {
							var id = board.isPowerUp[i][j];
							board.isPowerUp[i][j] = PU_ID_NONE;
							board.numPowerUpsOnBoard--;
						}					
					}
				}
			}
		},
		{
			name: '4 blues',
			description: 'After teleporting, you also clear blocks in a small radius for a short duration upond lading.',
			recipe: [0,0,4,0,0,0]
		},
		{
			name: '4 greens',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal his color.',
			recipe: [0,0,0,4,0,0]
		},
		{
			name: '4 reds',
			description: 'The next wall you hit will trigger a medium size clearing effect, as well as your teleport cooldown.',
			recipe: [0,0,0,0,4,0]
		},
		{
			name: '4 oranges',
			description: 'Your teleport clearing effect can now kill other players.',
			recipe: [0,0,0,0,0,4]
		}
	]
};


