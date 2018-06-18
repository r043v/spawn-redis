/*
 * redis db spawner, © 2k14 / 2k18 noferi Mickaël
 *  r043v / dph - noferov@gmail.com
 *   v 1.0.2 - under creative commons by-nc-sa 3.0
 */

var spawn = require('child_process').spawn;
var redis = require('redis');
var _ = require('lodash');

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

function grabPid(file,cb){
	fs.readFile(file,function(err,pid){
		err ? setTimeout(grabPid.bind(null,file,cb),11) : cb( parseInt(pid,10) );
	});
}

function waitPs(pid,cb){
	var active; try { active = process.kill(pid,0); } catch(e){ active = e.code === 'EPERM'; }
	if(!active) return cb();
	setTimeout(function(){
		waitPs(pid,cb);
	},111);
}

module.exports = function(d){
	var stdin = "", lr = "\r\n", copts = {};

	var o = new EventEmitter();

	var args = ['-'];
	var opts = { detached:false };
	var  cmd = "redis-server";

	var deamon = d.daemonize === 'yes';
	if( d.dir === undefined ) d.dir = "./";

	if(deamon && d.pidfile === undefined) d.pidfile = 'redis.pid';

	o.state = false;

	o.server = spawn(cmd,args,opts);
	o.pid = o.server.pid;

	_.each(d,function(v,k){
		switch(k){
			default:
				stdin += k+" "+v + lr;
			break;
			case 'requirepass':
				stdin += k+" "+v + lr;
				copts['auth_pass'] = v;
			break;
			case 'unixsocket':
			case 'port':
				stdin += k+" "+v + lr;
				copts[k] = v;
			break;
		};
	});

	o.server.stdin.write(stdin);
	o.server.stdin.end();

	if(deamon){
		o.pid = false;
		grabPid(d.dir+d.pidfile,function(pid){
			//console.log('pid grabed',pid)
			o.pid = pid;
		});
	}

	o.close = function(cb){
		if(o.closing !== undefined) return; o.closing = true;

		o.db.quit();

		function end(){ delete o.closing; o.state = false; cb(); }

		if(!deamon)
			o.server.on('close',end);

		o.db.on('end',function(){ // stop server
			function sigterm(){
				console.log("call sigterm on",o.pid);
				try { process.kill(o.pid,'SIGTERM'); } catch(e){}
			}

			if(deamon){
				var fn = function(){
					if(!o.pid) return setTimeout(fn,111); // pid not grabed.
					sigterm(); waitPs(o.pid,end);
				}; fn();
			} else sigterm();
		});
	}

	if(d.unixsocket)
			o.db = redis.createClient(d.dir+d.unixsocket,copts);
	else	o.db = redis.createClient(d.port,d.ip,copts)

	o.db.on('error',function(err){
		if( o.state !== true ){ // client not ready, check error to see if server just was not finish to start
			if( d.unixsocket ){
				if( err.message.indexOf('ENOENT') > -1 ) return; // not ready
			} else {
				if( err.message.indexOf('ECONNREFUSED') > -1 ) return; // not ready
			}

			if(err.code === 'UNCERTAIN_STATE') return; // not ready

		} else {
			if( d.unixsocket ){
				if( err.message.indexOf('ENOENT') > -1 ) return o.emit('down');
			} else {
				if( err.message.indexOf('ECONNREFUSED') > -1 ) return o.emit('down');
			}
		}

		o.emit('error',err);
	});

	o.db.on("ready",function(){
		o.state = true; o.emit('ready');
	});

	o.db.close = o.close;

	return o;
}
