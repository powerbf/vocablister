const http = require('http')
const fs = require('fs')
var main = require('./main.js');

const hostname = '127.0.0.1'
const port = process.env.PORT || 3000

main.init();

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        collectRequestData(req, data => {
            console.log(data);
            res.end(JSON.stringify(main.process(data)));
        });
    }
    else if (req.url == "/client.js")
    {
        res.writeHead(200, { 'content-type': 'text/javascript' })
        fs.createReadStream('client.js').pipe(res)
    }
    else if (req.url == "/styles.css")
    {
        res.writeHead(200, { 'content-type': 'text/css' })
        fs.createReadStream('styles.css').pipe(res)
    }
    else {
        res.writeHead(200, { 'content-type': 'text/html' })
        fs.createReadStream('index.html').pipe(res)
    }
})

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`)
})

function collectRequestData(request, callback) {
    let body = '';
    request.on('data', chunk => {
        body += chunk.toString();
    });
    request.on('end', () => {
        //console.log(body);
        callback(JSON.parse(body));
    });
}
