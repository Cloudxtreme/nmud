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
                    'curroom INTEGER);'
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
  });
}

exports.initDatabase = initDatabase;
exports.dbs = dbs;
