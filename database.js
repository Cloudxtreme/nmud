var sqlite3 = require('sqlite3').verbose();

var dbs = {};

function initDatabase() {
  // Init database..
  dbs.user = new sqlite3.Database('users.db');
  dbs.user.serialize(function serialized() {
    dbs.user.run('CREATE TABLE IF NOT EXISTS users(' +
                    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                    'loginname TEXT COLLATE NOCASE,' +
                    'password TEXT,' +
                    'email TEXT,' +
                    'curroom INTEGER,' +
                    'currency INTEGER);'
    );
    dbs.user.run('CREATE TABLE IF NOT EXISTS inventory(' +
                    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                    'objectid INTEGER,' +
                    'playerid INTEGER);'
    );
  });
  dbs.world = new sqlite3.Database('world.db');
  dbs.world.serialize(function serialized() {
    dbs.world.run('CREATE TABLE IF NOT EXISTS rooms(' +
                  'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                  'name TEXT,' +
                  'description TEXT);'
                );
    dbs.world.run('CREATE TABLE IF NOT EXISTS exits(' +
                  'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                  'name TEXT,' +
                  'description TEXT,' +
                  'roomid INTEGER,' +
                  'nextroomid INTEGER);'
                );
    dbs.world.run('CREATE TABLE IF NOT EXISTS objects(' +
                  'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                  'name TEXT,' +
                  'description TEXT,' +
                  'uniq INTEGER,' +
                  'locked INTEGER);'
                );
    dbs.world.run('CREATE TABLE IF NOT EXISTS room_objs(' +
                  'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                  'roomid INTEGER,' +
                  'objectid INTEGER);'
                );

  });
}

exports.initDatabase = initDatabase;
exports.dbs = dbs;
