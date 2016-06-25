var net = require('net');
var Node = require('./mnode.js');
var Database = require('./database.js');

var nodes = [];

function receiveData(node, data) {

  var k = nodes.indexOf(node);

  if (data[0] == 255) {
    // ToDo: handle IAC codes
  } else {
    for (var j = 0; j < data.length; j++) {
      if (data[j] == 13 || data[j] == 127) {
        nodes[k].process(nodes, k);
      } else if (data[j] == 8) {
        if (nodes[k].buff.length > 0) {
          nodes[k].buff = nodes[k].buff.slice(0, -1);
          nodes[k].sock.write("\u001b[1D \u001b[1D");
        }
      } else if (data[j] != 10) {
        nodes[k].buff = nodes[k].buff + String.fromCharCode(data[j]);
        if (nodes[k].state === 1) {
          nodes[k].sock.write("*");
        } else {
          nodes[k].sock.write(String.fromCharCode(data[j]));
        }
      }
    }
  }
}

function closeSocket(node) {
  var i = nodes.indexOf(node);
  if (i != -1) {
    nodes.splice(i, 1);
  }
}

function newSocket(socket) {
  var node = new Node(socket);
  nodes.push(node);

  socket.write(new Buffer([255,251,1]));
  socket.write(new Buffer([255,251,3]));

  socket.write('Welcome Andrew\'s little experimental MUD\r\n(Type NEW to create an account)!\r\n');
  socket.write('Login: ');
  socket.on('data', function(data) {
    receiveData(node, data);
  })
  socket.on('end', function() {
    closeSocket(node);
  })
}

var server = net.createServer(newSocket);

Database.initDatabase();

server.listen(1337);
