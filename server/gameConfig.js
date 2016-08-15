//
/** Game Constants **/
//
global.BOARD_W = 50;
global.BOARD_H = 50;
global.PLAYER_LOS_RANGE = 25;
global.SPAWN_SPACE_NEEDED = 10;
global.INITIAL_VELOCITY = 10.0;
global.DEFAULT_POINTS_PER_SEC = 15; // The default number of points per second
global.DEFAULT_LOSING_POINTS_RATIO = -10; // The ratio of ponts gain the player losses while on self-track
global.NUM_POWERUPS_ONBOARD = 40;
global.WALL_SOLIDIFICATION = 150; // the grace period in ms before a wall solidifies and can harm players
global.LINK_START = 0.01; // link will show after this (ms)
global.LINK_END = 0.75; // link will end after this
global.LINK_RANGE = 10; // link will start at this distance
global.LINK_SUSTAIN = 12; // link will stay alive at this range (hysteresis)
global.TELE_CLEAR_RADIUS = 4; // upond landing; a circle of this radius will be cleared
global.TELE_DISTANCE = 8; 
global.TELE_COOLDOWN = 6;
global.MAX_HEARTBEAT_KICK = 4000; // player will be killed after no input (ms);
global.MAX_DESYNC_TOLERENCE = 1.5; // the number of sec of desync tolerated before the player is kicked
global.PU_SLOTS = 4; // the number of powerups a player can carry at once
// Flags for the bloc board state
global.B_EMPTY = 0;
global.B_BORDERS = 10;
global.B_KILLSYOUTHRESHOLD = 5; // anything above that kills you
// PowerUp flags
global.PU_ID_NONE = 0;
global.PU_ID_TELECD = 1;
global.PU_ID_PTSLOSS = 2;
global.PU_ID_TELEAOE = 3;
global.PU_ID_POINTS = 4;
global.PU_ID_SPEED = 5;
global.PU_ID_TELERANGE = 6;
global.MAX_POWERUP_ID = 6; // UPDATE THIS everytime a new power up is added

global.PU_SPEED_MOD = 1.25; // bloc per second per PU
global.PU_TELE_CD = 1.25; // bonus sec cd per PU
global.PU_TELE_AOE = 2; // bonus radius per PU
global.PU_PTS_LOSS_MOD = -2.4; // The point loss modifier when stepping on own track
global.PU_POINTS_MOD = 5; // bonus points per sec per PU
global.PU_TELE_RANGE = 3; // bonus teleport distance

// abilities constants
global.ABILITY_4_PURPLE_CLEAR_RADIUS = 8;
global.ABILITY_4_RED_POINTS_STEAL_RATIO = 0.50; // the ratio of points stolen
global.ABILITY_4_ORANGE_KILL_RADIUS = 5; // the ratio of points stolen
global.ABILITY_4_GREEN_RADIUS_CLEAR = 6; // the ratio of points stolen
global.ABILITY_4_GREEN_CD = 2; // the cooldown triggered
global.ABILITY_4_BLUE_CLEARING_DURATION = 3.5; // the number of seconds the clearing effect lasts
global.ABILITY_4_BLUE_RADIUS_CLEAR = 2;
