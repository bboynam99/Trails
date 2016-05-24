# Codename project Manhattan

This is private repo for the next big online io game.

## Quickstart

1. Install node.js
2. Run a console, and browse to the root folder.
3. Run nmp to start the server: "C:\Program Files\nodejs\npm.cmd" start

## TODO list:
- fix keyboard controls (sometimes feels unresponsive)
- fix mouse controls: use mouse move (if mouse left pressed) test on touchscreen
- possible memory leak server side.
- Assign colors intelligently: on spawn, assigned a unique unused color, ideally different visually different than the colors in use.
- the latest bloc sometimes flickers (because it hasn't registered on the server yet): use some explicit condition (if bloc behind me was used and is now no longer used, ignore)
- server authority validation (move, powerup, cooldowns)
- players sometimes leave empty blocs in their trail due to client cpu spikes. server should interpolate between last bloc and new bloc and fill everything inbetween
- implement heartbeats check
- visual effect related to teleport.