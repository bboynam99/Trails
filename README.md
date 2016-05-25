# Codename project Manhattan

This is private repo for the next big online io game.

## Quickstart

1. Install node.js
2. Run a console, and browse to the root folder.
3. Run nmp to start the server: "C:\Program Files\nodejs\npm.cmd" start

## TODO list:

- pressing left+bot (for example) teleports in an left+bot angle instead of just left which is the first key press
- make sure team conversion is done from highest score to lowest score (seems like this isn't always done correctly, not 100% sure)
- show points (somehow? next to name maybe?)
- ondeath, a player should drop mini xp's worth 1/10th of regular xps. This is just so killing others feels rewarding.
- side walls die to teleport. they shouldn't. add a check
- top speed is reached too fast. See if slower progression or higher speed cap could help.
- implement heartbeats check
- Assign colors intelligently: on spawn, assigned a unique unused color, ideally different visually different than the colors in use.
- players sometimes leave empty blocs in their trail due to client cpu spikes. server should interpolate between last bloc and new bloc and fill everything inbetween
- server authority validation (move, powerup, cooldowns)
- possible memory leak server side.
- visual effect related to teleport
- better cooldown tracking