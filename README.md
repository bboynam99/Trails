# Codename project Manhattan

This is private repo for the next big online io game.

## Quickstart

1. Install node.js
2. Run a console, and browse to the root folder.
3. Run nmp to start the server: "C:\Program Files\nodejs\npm.cmd" start

## TODO list:



*** new features
- add fun combos (teleport modifiers)
- phone support

*** needs testing:
- REDx4: when you trigger it, it seems to transfer points somehow

*** known bugs:

*** admin commands (new feature)
- broad cast restart countdown with custom message
- crash logs

======NEW ABILITY DESIGN======

Green: is about getting points.
Red: is about playing fast.
Orange: is about suprising others.
Yellow: is about playing on your own.
Blue: is about clearing stuff in your way.
Purple: is about teleporting.

red-red			*Doomsday Device: Triggers a Doomsday clock, consuming your power ups in the process. Replaces teleport.
purple-purple	Easy Landing: Your teleport now also removes power ups on the ground in a large area.
green-green		Air Bags: Crashing into a wall will cause you to lose some points instead of killing you.
yellow-yellow	*Laser Beam: Trigger a laser beam that clears an entire line, eliminating players in the process. Replaces teleport.
blue-blue: 		*E.M.P.: Clears the entire map (30 second cooldown). Replaces teleport.
orange-orange	Switch-A-Roo: After teleporting, you channel a ray to switch position and color with another player.

purple-red		Rapid recovery: After teleporting, you channel a ray on a nearby player in attempt to trigger their cooldown, and reset yours.
purple-green	Improved Teleport: Greatly reduces the cooldown on your teleport at the cost of points.
purple-yellow	Chameleon Device: After teleporting, you channel a ray on a nearby player in attempt to steal their color
purple-blue		Bulldozer blade: After teleporting, you also clear blocks in a small radius for a short duration.
purple-orange	Death Ray: After teleporting, you channel a Death Ray in attempt to eliminate a nearby player.
red-green		Point Vacuum: After teleporting, you channel a ray on a nearby player in attempt to steal a large number of points. 
red-yellow		*Black Hole: Before you teleport, drop a black hole, attracting nearby players for a few seconds.
red-blue		C-4: When your teleport is ready, the next wall you hit will cause a large clearing effect and trigger a short cooldown.
red-orange		*Quick Escape: Your teleport triggers automatically when you hit a wall. Considerably lowers the cooldown. 
green-yellow	*Bonus Points: Picking up additional yellow or green Power Ups will provide bonus points.
green-blue		*Recycling Device: You now gain points for every block you clear by teleporting.
green-orange	*Point ray: You channel a ray on a nearby player in attempt to steal a large number of points. Replaces teleport.
yellow-blue		*Cloaking Device: After teleporting, you become invisible for a short duration. While invisible, you can pass through all walls. 
yellow-orange	*Stealing Ray: After teleporting, you channel a ray in attempt to steal all of another player's power ups.
blue-orange		*Entrenchment: Clear everything in a large area around you, surrounding you with a thin wall. Replaces teleport.


