var sqlite3 = require('sqlite3').verbose();

function mnode(socket) {
  this.uid = 0;
  this.state = 0;
  this.sock = socket;
  this.buff = "";
  this.uname = "UNKNOWN";
  this.email = "";
  this.password = "";
  this.room = 1;
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
          nodes[k].sock.write("\r\n\r\n" + row.name + "\r\n");
          nodes[k].sock.write("-----------------------------------------------------\r\n");
          nodes[k].sock.write(desc);

          nodes[k].sock.write("\r\n\r\nPlayers: ");

          for (var j = 0; j < nodes.length; j++) {
            if (j != k && nodes[j].room === nodes[k].room && nodes[j].uname !== "UNKNOWN") {
              nodes[k].sock.write(nodes[j].uname + " ");
            }
          }

          nodes[k].sock.write("\r\n\r\nExits: ");
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
                  for (var i = 0; i < rows.length; i++) {
                    nodes[k].sock.write(rows[i].name + " ");
                  }
                } else {
                  nodes[k].sock.write("none.")
                }
                nodes[k].sock.write("\r\n");
              }
            }
          );
        } else {
          nodes[k].sock.write("\r\nYou're floating through the twisting nether!\r\n");
        }
      }
    }
  );
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
      'SELECT id, loginname, password, curroom FROM users WHERE loginname LIKE ?',
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
        'INSERT INTO users (loginname, email, password, curroom) VALUES(?, ?, ?, ?)',
        [ nodes[k].uname, nodes[k].email, nodes[k].password, nodes[k].room ],
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
      nodes[k].buff = "";
    } else if (nodes[k].buff.substring(0, 3) === "say") {
      nodes[k].buff = nodes[k].buff.substring(4) + "\r\n";
      for (var i = 0; i < nodes.length; i++) {
        if (i != k) {
          nodes[i].sock.write(nodes[k].uname + ": " + nodes[k].buff);
        }
      }
      nodes[k].sock.write("\r\n");
      nodes[k].buff = "";
    } else if (nodes[k].buff === "help") {
      nodes[k].sock.write("\r\n\r\nSo, you need some help eh?\r\n\r\n");
      nodes[k].sock.write("Commands:\r\n");
      nodes[k].sock.write("    quit: Quits the game\r\n");
      nodes[k].sock.write("    look: Displays the room information\r\n");
      nodes[k].sock.write("    say [something]: will \"say\" [something]\r\n");
      nodes[k].sock.write("    [exit]: follows an \"exit\"\r\n");
      nodes[k].sock.write("\r\n");
      nodes[k].buff = "";
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
              for (var i = 0; i < rows.length; i++) {
                if (nodes[k].buff.toLowerCase() === rows[i].name.toLowerCase()) {
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
              nodes[k].buff = "";
            } else {
              nodes[k].sock.write("\r\nUnknown Command. Type HELP for help.\r\n");
              nodes[k].buff = "";
            }
          }
        }
      );
    }
  }
}

module.exports = mnode;
