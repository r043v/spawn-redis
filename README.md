
const redisDb = require('spawn-redis');

/* launch redis server database */
const server = redisdb({
	daemonize:'yes',
	dir:'./data/db/',
	//unixsocket:'hey.sock', port:'0', unixsocketperm:'700',
	databases:'1',
	loglevel:'notice',
	logfile:'hey.log',
	'syslog-enabled':'no',
	'save 300':1,
	'save 60':30,
	'save 10':20,
	rdbcompression:'yes',
	rdbchecksum:'yes',
	dbfilename:'hey.rdb',
	requirepass:'bananaboat',
	maxclients:2,
	pidfile:'redis.pid',
	hz:1
});

const db = mainDb.db; // get client

db.on('ready', function(){
	db.close(function(){
		process.exit();
	});
});

