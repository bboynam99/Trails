# Trails.io

Trails is a fast-paced multiplayer browser based arcade game based on the classic Tron game and inspired by Agar.io

![](https://github.com/jnblanchet/Trails/blob/master/client/img/logo.gif)

## How to play

You are a little block with a trail. Use the <b>arrow keys</b> to <b>turn</b>, <br />  or <b>tap</b> the sides. You cannot turn 180°.

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/1.gif)


<p>Use <b>spacebar</b> to <b>teleport</b> and avoid obstacles, or <b>tap</b> the center of the screen.<br /> Teleporting will also <b>clear blocks</b> around the landing area.<br /> This will trigger a short <b>cooldown</b> (black bar below your name).</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/2.gif)

   
<p><b>Crashing</b> into other trails will eliminate you.</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/3.gif)

<p>Your <b>own trail</b> will not eliminate you right away, but will cause you<br /> to lose points until you run out of points and lose.</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/4.gif)

<p>Gain points by <b>surviving</b> as long as possible. <br /> As you gain points, you <b>grow</b> in size, but also move progressively <b>slower</b>.</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/5.gif)

<p>Pick up <b>power ups</b> to become stronger.</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/6.gif)

<p>Power ups provide an instant <b>passive effect</b>:</p>

![](https://github.com/jnblanchet/Trails/blob/master/client/img/tutorial/7.gif)

<ol style="text-align:left">
	<li> <b style="color:#393">Green</b>: gain (and lose) points faster. </li>
	<li> <b style="color:#c00">Red</b>: move faster. </li>
	<li> <b style="color:#f53">Orange</b>: teleport further. </li>
	<li> <b style="color:#fc0">Yellow</b>: lose less points on your trail. </li>
	<li> <b style="color:#039">Blue</b>: clear more blocks when teleporting. </li>
	<li> <b style="color:#606">Purple</b>: teleport more often.</li>
</ol>
				
## Color Theme

Each color has a theme and provides a small passive bonus.

1. Green is about getting points, being greedy.
1. Red is about playing quickly, moving fast.
1. Blue is about being solitary, playing alone.
1. Orange is about being hostile or agressive to other players.
1. Yellow is about destruction and clearing of the map.
1. Purple is about being sneaky, and moving around unseen.

## Active abilities

1. red-red			Doomsday Device: Trigger a Doomsday clock. The last player to find shelter dies. This consumes your power ups in the process. Replaces teleport.
1. purple-purple	Easy Landing: Your teleport now also removes power ups on the ground in a large area.
1. green-green		Air Bags: Crashing into a wall will cause you to lose some points instead of killing you.
1. blue-blue		Laser Beam: Trigger a laser beam that clears an entire line, eliminating players in the process. Replaces teleport.
1. yellow-yellow 	E.M.P.: Clear the entire map (30 second cooldown). Replaces teleport.
1. orange-orange	Switch-A-Roo: After teleporting, you channel a ray to switch position and color with another player.

1. purple-red		Rapid recovery: After teleporting, channel a ray on a nearby player in attempt to trigger their cooldown, and reset yours.
1. purple-green	Improved Teleport: Greatly reduces the cooldown on your teleport at the cost of points.
1. purple-blue		Chameleon Device: After teleporting, channel a ray on a nearby player in attempt to steal their color
1. purple-yellow	Bulldozer blade: After teleporting, you also clear blocks in a small radius for a short duration.
1. purple-orange	Death Ray: After teleporting, channel a Death Ray in attempt to eliminate a nearby player.
1. red-green		Point Vacuum: After teleporting, channel a ray on a nearby player in attempt to steal a large number of points. 
1. red-blue		Black Hole: Before teleporting, drop a black hole, attracting nearby players for a few seconds.
1. red-yellow		C-4: When your teleport is ready, the next wall you hit will cause a large clearing effect and trigger a short cooldown.
1. green-blue		Bonus Points: Picking up additional blue or green Power Ups will provide bonus points.
1. red-orange		Quick Escape: Your teleport triggers automatically when you hit a wall. Greatly lowers the cooldown. 
1. green-yellow	Recycling Device: Gain bonus points for every block you clear by teleporting.
1. green-orange	Point ray: Channel a ray on a nearby player in attempt to steal a large number of points. Replaces teleport.
1. blue-yellow		*Cloaking Device: After teleporting, become invisible for a short duration. While invisible, you can pass through all walls. 
1. blue-orange		Stealing Ray: After teleporting, channel a ray in attempt to steal all of another player's power ups.
1. yellow-orange	Entrenchment: Clear everything in a large area around you, surrounding you with a thin wall. Replaces teleport.

## Quickstart

1. Install node.js
2. Open a command prompt or terminal and navigate to the root folder.
3. Run nmp to start the server. (on windows use "C:\Program Files\nodejs\npm.cmd" start)

### todo
- Quick Escape does not trigger (instant death)
- doomsday needs countdown.
- can't see other people's power ups??
- bulldozer blade needs a timer
- bulldozer blade tigger its effect if picked up with CD is still up
- can't see behind lazer beam. Clearing blocks should be instant
- doomsday: should have a timeout. everyone should be able to live.
- entrenchement should have holes (it's too strong)
- points powered air bags do not work well.
