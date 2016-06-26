var sqlite3 = require('sqlite3').verbose();
var async = require('async');
function mnode(socket) {
  this.uid = 0;
  this.state = 0;
  this.sock = socket;
  this.buff = "";
  this.uname = "UNKNOWN";
  this.email = "";
  this.password = "";
  this.room = 1;
  this.currency = 0;
}

mnode.prototype.prompt = function(nodes, k) {
  nodes[k].buff = "";
  nodes[k].sock.write("\r\n:> ");
}

mnode.prototype.examine = function(nodes, k, object) {
  var userdb = require('./database.js').dbs.user;
  var worlddb = require('./database.js').dbs.world;


  async.series([
    function examineRoomObj(cb) {
      worlddb.all(
        'SELECT name,description FROM objects WHERE name LIKE ? AND id IN (SELECT objectid FROM room_objs WHERE roomid = ?)',
        [ object, nodes[k].room ],
        function(err, rows) {
          for (var i = 0;  i < rows.length; i++) {
            nodes[k].sock.write("\r\n" + rows[i].name + ": " + rows[i].description + "\r\n");
          }
          cb(null);
        }
      )
    },

    function examineExits(cb) {
      worlddb.all(
        'SELECT name,description FROM exits WHERE name LIKE ? AND roomid = ?',
        [ object, nodes[k].room ],
        function(err, rows) {
          for (var i = 0; i < rows.length; i++) {
            nodes[k].sock.write("\r\n" + rows[i].name + ": " + rows[i].description + "\r\n");
          }
          cb(null);
        }
      )
    },
    function examineInventory(cb) {
      userdb.all(
        'SELECT objectid FROM inventory WHERE playerid = ?',
        [ nodes[k].uid ],
        function(err, rows) {
          async.each(rows, function showInv(row, cb2) {
            worlddb.get(
              'SELECT name,description FROM objects WHERE id = ? AND name LIKE ?',
              [ row.objectid, object ],
              function(err, row) {
                if (row) {
                  nodes[k].sock.write("\r\n(Inventory) " + row.name + ": " + row.description + "\r\n");
                }
                cb2(null);
              }
            )
          }, function(err) {
            if (!err) {
              cb(null);
            }
          });
        }
      )
    }], function showPrompt(err) {
      nodes[k].prompt(nodes, k);
    }
  );
}

mnode.prototype.drop = function(nodes, k, object) {
  var userdb = require('./database.js').dbs.user;
  var worlddb = require('./database.js').dbs.world;

  var objectid = 0;

  worlddb.get(
    'SELECT id,uniq FROM objects WHERE name LIKE ?',
    [object],
    function onResults(err, row) {
      if (row) {
        objectid = row.id;
        if (row.uniq == 0) {
          nodes[k].sock.write("\r\nYou can't drop that.\r\n");
          nodes[k].prompt(nodes, k);
        } else {
          userdb.get (
            'SELECT id FROM inventory WHERE objectid=? AND playerid=?',
            [ objectid, nodes[k].uid ],
            function onResults(err, row) {
              if (row) {
                userdb.run(
                  'DELETE FROM inventory WHERE id=?',
                  [ row.id ]
                );
                worlddb.run(
                  'INSERT INTO room_objs (roomid, objectid) VALUES(?, ?)',
                  [ nodes[k].room, objectid ]
                );
                nodes[k].sock.write("\r\nItem Dropped!\r\n");
                nodes[k].prompt(nodes, k);
              } else {
                nodes[k].sock.write("\r\nYou don't have one of those!\r\n");
                nodes[k].prompt(nodes, k);
              }
            }
          )
        }
      } else {
        nodes[k].sock.write("\r\nYou don't have one of those!\r\n");
        nodes[k].prompt(nodes, k);
      }
    }
  );
}

mnode.prototype.inventory = function(nodes, k) {
  var userdb = require('./database.js').dbs.user;
  var worlddb = require('./database.js').dbs.world;
  var inventoryObjects = [];

  userdb.all(
    'SELECT objectid FROM inventory WHERE playerid = ?',
    [nodes[k].uid],
    function onResults(err, rows) {
      for (var i = 0; i < rows.length; i++) {
        inventoryObjects.push(rows[i].objectid);
      }

      nodes[k].sock.write("\r\n\r\nInventory\r\n");
      nodes[k].sock.write("-----------------------------------------------------\r\n");

      async.each(inventoryObjects, function getName(object, cb) {
        worlddb.get(
          'SELECT name FROM objects WHERE id = ?',
          [ object ],
          function onResult(err, row) {
            if (row) {
              nodes[k].sock.write(row.name + "\r\n");
              cb();
            }
          }
        );
      }, function(err) {
        if (!err) {
          nodes[k].prompt(nodes, k);
        }
      });
    }
  );
}

mnode.prototype.getobj = function(nodes, k, obj_id) {
  var userdb = require('./database.js').dbs.user;
  var worlddb = require('./database.js').dbs.world;

  var shoulddelete = 0;
  var shouldget = 0;

  worlddb.serialize(function(){
    worlddb.get(
      'SELECT name, locked, uniq FROM objects WHERE id = ?',
      [ obj_id ],
      function onResults(err, row) {
        if (err) {
          // sql error?
          nodes[k].sock.write("\r\nSQL Error!\r\n");
          nodes[k].sock.end("Goodbye!\r\n");
        } else {
          if (row) {
            if (row.locked == 1) {
              nodes[k].sock.write("\r\nThat object can't be picked up!\r\n");
              nodes[k].prompt(nodes, k);
            } else {
              if (row.uniq == 1) {
                worlddb.run(
                  'DELETE FROM room_objs WHERE id = (SELECT id FROM room_objs WHERE roomid = ? AND objectid = ? LIMIT 1)',
                  [ nodes[k].room, obj_id ]
                );
                userdb.run(
                  'INSERT INTO inventory (objectid, playerid) VALUES(?, ?)',
                  [ obj_id, nodes[k].uid ]
                );
                nodes[k].sock.write("\r\nObject picked up!\r\n");
                nodes[k].prompt(nodes, k);
              } else {
                userdb.serialize(function() {
                  userdb.get(
                    'SELECT objectid FROM inventory WHERE objectid = ? AND playerid = ?',
                    [obj_id, nodes[k].uid],
                    function(err, row) {
                      if (err) {
                        // sql error?
                        nodes[k].sock.write("\r\nSQL Error!\r\n");
                        nodes[k].sock.end("Goodbye!\r\n");
                      } else {
                        if (row) {
                          nodes[k].sock.write("\r\nYou already have one of those.\r\n");
                          nodes[k].prompt(nodes, k);
                        } else {
                          nodes[k].sock.write("\r\nObject picked up!\r\n");
                          nodes[k].prompt(nodes, k);
                        }
                      }
                    }
                  )
                  userdb.run(
                    'INSERT INTO inventory (objectid, playerid) SELECT ?, ? WHERE NOT EXISTS(SELECT 1 FROM inventory WHERE objectid = ? AND playerid = ?)',
                    [ obj_id, nodes[k].uid, obj_id, nodes[k].uid ]
                  )
                });
              }
            }
          }
        }
      }
    )
  });
}

mnode.prototype.saveuser = function(nodes, k) {
  var userdb = require('./database.js').dbs.user;
  userdb.run(
    'UPDATE users SET curroom=? WHERE id=?',
    [ nodes[k].room, nodes[k].uid ]
  );
}

mnode.prototype.displayroom = function(nodes, k) {
  var worlddb = require('./database.js').dbs.world;

  async.series([
    function getRoomDesc(cb) {
      worlddb.get(
        'SELECT id, name, description FROM rooms WHERE id = ?',
        [ nodes[k].room ],
        function onResults(err, row) {
          if (err) {
            // sql error?
            nodes[k].sock.write("\r\nSQL Error!\r\n");
            nodes[k].sock.end("Goodbye!\r\n");
          } else {
            if (row) {
              var desc = row.description.replace(/\r?\n/g, '\r\n');
              var noplayers = 1;
              nodes[k].sock.write("\r\n\r\n" + row.name + "\r\n");
              nodes[k].sock.write("-----------------------------------------------------\r\n");
              nodes[k].sock.write(desc);

              nodes[k].sock.write("\r\n\r\nPlayers: ");

              for (var j = 0; j < nodes.length; j++) {
                if (j != k && nodes[j].room === nodes[k].room && nodes[j].uname !== "UNKNOWN") {
                  nodes[k].sock.write(nodes[j].uname + ", ");
                  noplayers = 0;
                }
              }
              if (noplayers == 1) {
                nodes[k].sock.write("none.");
              }
              cb(null);
            } else {
              nodes[k].sock.write("\r\nYou're floating through the twisting nether!\r\n");
              cb('done');
            }
          }
        }
      );
    },
    function showExits(cb) {
      worlddb.all(
        'SELECT id, name, description, roomid, nextroomid FROM exits WHERE roomid = ?',
        [ nodes[k].room ],
        function onResults(err, rows) {
          if (err) {
            // sql error?
            nodes[k].sock.write("\r\nSQL Error!\r\n");
            nodes[k].sock.end("Goodbye!\r\n");
          } else {
            nodes[k].sock.write("\r\n\r\nExits: ");
            if (rows.length > 0) {
              for (var i = 0; i < rows.length; i++) {
                nodes[k].sock.write(rows[i].name + ", ");
              }
            } else {
              nodes[k].sock.write("none.")
            }
            nodes[k].sock.write("\r\n");
            cb(null);
          }
        }
      );
    },
    function showObjects(cb) {
      worlddb.all(
        'SELECT objects.name FROM room_objs,objects WHERE room_objs.roomid = ? AND room_objs.objectid = objects.id',
        [ nodes[k].room ],
        function onResult(err, rows) {
          if (err) {
            // sql error?
            nodes[k].sock.write("\r\nSQL Error!\r\n");
            nodes[k].sock.end("Goodbye!\r\n");
          } else {
            if (rows.length > 0) {
              nodes[k].sock.write("\r\nObjects: ")
              for (var i = 0; i < rows.length; i++) {
                nodes[k].sock.write(rows[i].name + ", ");
              }
              nodes[k].sock.write("\r\n");
            } else {
              nodes[k].sock.write("\r\nObjects: none.\r\n");
            }
          }
          cb(null);
        }
      );
    },
    function showPrompt(cb) {
      nodes[k].prompt(nodes, k);
      cb(null);
    }
  ]);
}

mnode.prototype.process = function(nodes, k) {
  var userdb = require('./database.js').dbs.user;
  var worlddb = require('./database.js').dbs.world;

  if (nodes[k].state === 0) {
    if (nodes[k].buff.toLowerCase() === 'new') {
      nodes[k].sock.write("\r\nWhat is your name, hero? ");
      nodes[k].state = 2;
      nodes[k].buff = "";
    } else {
      nodes[k].sock.write("\r\nPassword: ");
      nodes[k].uname = nodes[k].buff;
      nodes[k].state = 1;
      nodes[k].buff = "";
    }
  } else if (nodes[k].state === 1) {
    userdb.get(
      'SELECT id, loginname, password, curroom, currency FROM users WHERE loginname LIKE ?',
      [ nodes[k].uname ],
      function onResults(err, row) {
        if (err) {
          // sql error?
          nodes[k].sock.write("\r\nSQL Error!\r\n");
          nodes[k].sock.end("Goodbye!\r\n");
        } else {
          if (row) {
            // matching row
            if (row.password == nodes[k].buff) {
              nodes[k].uid = row.id;
              nodes[k].room = row.curroom;
              nodes[k].sock.write("\r\nWelcome " + nodes[k].uname + "!\r\n");
              nodes[k].displayroom(nodes, k);
              nodes[k].state = 10;
              nodes[k].currency = row.currency;
            } else {
              nodes[k].sock.end("\r\nPassword Mismatch! Goodbye!\r\n");
            }
          } else {
            // no matching row
            nodes[k].sock.write("\r\nNo such user!\r\n");
            nodes[k].sock.end("Goodbye!\r\n");
          }
        }
        nodes[k].buff = "";
      }
    );
  } else if (nodes[k].state == 2) {
    userdb.get(
      'SELECT loginname FROM users WHERE loginname LIKE ?',
      [ nodes[k].buff ],
      function onResults(err, row) {
        if (err) {
          nodes[k].sock.write("\r\nSQL Error!\r\n");
          nodes[k].sock.end("Goodbye!\r\n");
        } else {
          if (row) {
            // matching row, username in use
            nodes[k].sock.write("\r\nSorry, that username is in use.\r\n");
            nodes[k].sock.write("What is your name, hero? ");
          } else {
            nodes[k].uname = nodes[k].buff;
            nodes[k].sock.write("\r\nWhat is your email address? ");
            nodes[k].state = 3;
          }
          nodes[k].buff = "";
        }
      }
    )
  } else if (nodes[k].state == 3) {
    nodes[k].email = nodes[k].buff;
    nodes[k].buff = "";
    nodes[k].sock.write("\r\nWhat password do you desire? ");
    nodes[k].state = 4;
  } else if (nodes[k].state == 4) {
    nodes[k].password = nodes[k].buff;
    nodes[k].buff = "";
    nodes[k].currency = 0;
    nodes[k].sock.write("\r\n\r\nYou Entered:\r\n");
    nodes[k].sock.write("-----------------------------------------------------\r\n");
    nodes[k].sock.write("Login Name: " + nodes[k].uname + "\r\n");
    nodes[k].sock.write("    E-Mail: " + nodes[k].email + "\r\n");
    nodes[k].sock.write("  Password: " + nodes[k].password + "\r\n");
    nodes[k].sock.write("-----------------------------------------------------\r\n");
    nodes[k].sock.write("Is this correct? (Y/N) ");
    nodes[k].state = 5;
  } else if (nodes[k].state == 5) {
    if (nodes[k].buff[0] == 'y' || nodes[k].buff[0] == 'Y') {
      userdb.run(
        'INSERT INTO users (loginname, email, password, curroom, currency) VALUES(?, ?, ?, ?, ?)',
        [ nodes[k].uname, nodes[k].email, nodes[k].password, nodes[k].room, nodes[k].currency ],
        function userInsert(err) {
          if (err) {
            nodes[k].sock.end("\r\nSQL Error! Goodbye!\r\n");
          } else {
            nodes[k].sock.write("\r\nUser added Successfully!\r\n");
            nodes[k].state = 10;
            nodes[k].displayroom(nodes, k);
          }
        }
      )
    } else {
      nodes[k].sock.write("What is your name, hero? ");
      nodes[k].state = 2;
    }
    nodes[k].buff = "";
  } else if (nodes[k].state == 10){
    if (nodes[k].buff === "quit") {
      nodes[k].sock.end('\r\nGoodbye!\r\n');
    } else if (nodes[k].buff === "look") {
      nodes[k].displayroom(nodes, k);
    } else if (nodes[k].buff.substring(0, 3) === "say") {
      nodes[k].buff = nodes[k].buff.substring(4) + "\r\n";
      for (var i = 0; i < nodes.length; i++) {
        if (i != k) {
          nodes[i].sock.write(nodes[k].uname + ": " + nodes[k].buff);
        }
      }
      nodes[k].sock.write("\r\n");
      nodes[k].prompt(nodes, k);
    } else if (nodes[k].buff.substring(0, 3) === "inv") {
      nodes[k].inventory(nodes, k);
    } else if (nodes[k].buff.substring(0, 4) === "drop") {
      nodes[k].drop(nodes, k, nodes[k].buff.substring(5));
    } else if (nodes[k].buff.substring(0, 7) == "examine") {
      nodes[k].examine(nodes, k, nodes[k].buff.substring(8));
    } else if (nodes[k].buff.substring(0, 3) === "get") {
      var obj = nodes[k].buff.substring(4);
      worlddb.serialize(function() {
        worlddb.get(
          'SELECT objectid FROM room_objs WHERE roomid = ? AND objectid IN (SELECT id FROM objects WHERE name LIKE ?)',
          [ nodes[k].room, obj ],
          function onResults(err, row) {
            if (err) {
              nodes[k].sock.write("\r\nSQL Error!\r\n");
              nodes[k].sock.end("Goodbye!\r\n");
            } else {
              if (row) {
                nodes[k].getobj(nodes, k, row.objectid);
              } else {
                nodes[k].sock.write("\r\nNo such object?\r\n")
                nodes[k].prompt(nodes, k);
              }
            }
          }
        );
      });
    } else if (nodes[k].buff === "help") {
      nodes[k].sock.write("\r\n\r\nSo, you need some help eh?\r\n\r\n");
      nodes[k].sock.write("Commands:\r\n");
      nodes[k].sock.write("    quit: Quits the game\r\n");
      nodes[k].sock.write("    look: Displays the room information\r\n");
      nodes[k].sock.write("    say [something]: will \"say\" [something]\r\n");
      nodes[k].sock.write("    get [object]: will pickup [object]\r\n");
      nodes[k].sock.write("    inv: Show your inventory\r\n");
      nodes[k].sock.write("    drop [object]: drop [object] from your inventory\r\n");
      nodes[k].sock.write("    examine [thing]: examines [thing] which could be an object or an exit.\r\n")
      nodes[k].sock.write("    [exit]: follows an \"exit\"\r\n");
      nodes[k].sock.write("\r\n");
      nodes[k].prompt(nodes, k);
    } else {
      worlddb.all(
        'SELECT id, name, description, roomid, nextroomid FROM exits WHERE roomid = ?',
        [ nodes[k].room ],
        function onResults(err, rows) {
          if (err) {
            // sql error?
            nodes[k].sock.write("\r\nSQL Error!\r\n");
            nodes[k].sock.end("Goodbye!\r\n");
          } else {
            if (rows.length > 0) {
              var handled = 0;

              for (var i = 0; i < rows.length; i++) {
                if (nodes[k].buff.toLowerCase() === rows[i].name.toLowerCase()) {
                  handled = 1;
                  for (var j = 0; j < nodes.length; j++) {
                    if (k != j && nodes[j].room == nodes[k].room && nodes[j].uname !== "UNKNOWN") {
                      nodes[j].sock.write("\r\n\r\n" + nodes[k].uname + " leaves.\r\n\r\n");
                    }
                  }

                  nodes[k].room = rows[i].nextroomid;
                  nodes[k].saveuser(nodes, k);

                  for (var j = 0; j < nodes.length; j++) {
                    if (k != j && nodes[j].room == nodes[k].room && nodes[j].uname !== "UNKNOWN") {
                      nodes[j].sock.write("\r\n\r\n" + nodes[k].uname + " appears.\r\n\r\n");
                    }
                  }
                  nodes[k].displayroom(nodes, k);
                }
              }
              if (handled == 0) {
                nodes[k].sock.write("\r\nUnknown Command. Type HELP for help.\r\n");
              }
              nodes[k].prompt(nodes, k);
            } else {
              nodes[k].sock.write("\r\nUnknown Command. Type HELP for help.\r\n");
              nodes[k].prompt(nodes, k);
            }
          }
        }
      );
    }
  }
}

module.exports = mnode;
