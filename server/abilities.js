// this file contains the definition for all abilities
// this is the ordering (for reference only) : purple, yellow, blue, green, red, orange
// the functions that may be defined for each ability are:
// onTeleportLanding(), onBeamComplete()
module.exports = {
  abilities: [
		{
			name: 'purple',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal a large number of points.',
			recipe: [4,0,0,0,0,0],
			onLand() 
		},
		{
			name: 'yellow',
			description: 'Your teleport clearing effect now also removes nearby power ups.',
			recipe: [0,4,0,0,0,0]
		},
		{
			name: 'blue',
			description: 'After teleporting, you also clear blocks in a small radius for a short duration upond lading.',
			recipe: [0,0,4,0,0,0]
		},
		{
			name: 'green',
			description: 'After teleporting, you channel a beam on a nearby player in attempt to steal his color.',
			recipe: [0,0,0,4,0,0]
		},
		{
			name: 'red',
			description: 'The next wall you hit will trigger a medium size clearing effect, as well as your teleport cooldown.',
			recipe: [0,0,0,0,4,0]
		},
		{
			name: 'orange',
			description: 'Your teleport clearing effect can now kill other players.',
			recipe: [0,0,0,0,0,4]
		}
	]
};


