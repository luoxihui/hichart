var express = require('express');
var fs = require('fs');
var app = express();
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server,
wss = new WebSocketServer({ port: 8181, host: '127.0.0.1'});
//wss = new WebSocket("ws://192.168.13.77:8181");

var uuid = require('node-uuid');
var clients = [];

// 定义模板引擎
app.engine('html', function (filePath, options, callback) { 
	fs.readFile(filePath, function (err, content) {
		if (err) return callback(new Error(err));

		var rendered = content.toString().replace('#title#', '<title>'+ options.title +'</title>');
		return callback(null, rendered);
	})
});

// 指定视图所在的位置
app.set('views', './views');
// 注册模板引擎 
app.set('view engine', 'html'); 

app.use(express.static('./asset'));

app.get('/', function (req, res) {
	res.render('index', { title: '聊天室'});
})

var server = app.listen(3000, '127.0.0.1', function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});


function wsSend(type, client_uuid, nickname, message) {
    for (var i = 0; i < clients.length; i++) {
        var clientSocket = clients[i].ws;
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({
                "type": type,
                "id": client_uuid,
                "nickname": nickname,
                "message": message
            }));
        }
    }
}
var clientIndex = 1;
wss.on('connection', function(ws) {
    var client_uuid = uuid.v4();
    var nickname = "游客" + clientIndex;
    clientIndex += 1;

    clients.push({ "id": client_uuid, "ws": ws, "nickname": nickname });
    console.log('client [%s] connected', client_uuid);
    var connect_message = nickname + " 加入聊天室";

    wsSend("notification", client_uuid, nickname, connect_message);
    console.log('client [%s] connected', client_uuid);
    
    ws.on('message', function(message) {
        if (message.indexOf('/nick') === 0) {
            var nickname_array = message.split(' ');
            if (nickname_array.length >= 2) {
                var old_nickname = nickname;
                nickname = nickname_array[1];
                var nickname_message = "Client " + old_nickname + " changed to " + nickname;
                wsSend("nick_update", client_uuid, nickname, nickname_message);
            }
        } else {
            wsSend("message", client_uuid, nickname, message);
        }
    });
   var closeSocket = function(customMessage) {
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].id == client_uuid) {
                var disconnect_message;
                if (customMessage) {
                    disconnect_message = customMessage;
                } else {
                    disconnect_message = nickname + " has disconnected";
                }
                wsSend("notification", client_uuid, nickname, disconnect_message);
                clients.splice(i, 1);
            }
        }
    };
    ws.on('close', function () {
        closeSocket();
    });
    process.on('SIGINT', function () {
        console.log("Closing things");
        closeSocket('Server has disconnected');
        process.exit();
    });
});