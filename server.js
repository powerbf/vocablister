const http = require('http')
const fs = require('fs')
var main = require('./main.js');

const hostname = '127.0.0.1'
const port = process.env.PORT || 3000

main.init();

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        handlePostRequest(req, res);
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

function handlePostRequest(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 100000) {
            res.end(JSON.stringify({error: "Request too big"}));
            req.destroy();
        }
    });
    req.on('end', () => {
        try {
            console.log("Request size: " + body.length);
            let data = JSON.parse(body);
            let response = {};

            // validate input
            let sourceLang = data["source_lang"];
            let targetLang = data["target_lang"];
            if (typeof sourceLang != "string" || sourceLang.length != 2)
                response.error = "Invalid input";
            else if (typeof targetLang != "string" || targetLang.length != 2)
                response.error = "Invalid input";
            else if (typeof data["freqThreshold"] != "number")
                response.error = "Invalid input";
            else if (typeof data["show_all"] != "boolean")
                response.error = "Invalid input";
            else if (typeof data["text"] != "string")
                response.error = "Invalid input";

            // if all good then process the request
            if (response.error == null)
                response.results = main.process(data);

            let responseStr = JSON.stringify(response)
            responseStr = responseStr.replace("<", "&lt;");
            responseStr = responseStr.replace(">", "&gt;");
            res.end(responseStr);
        }
        catch (err) {
            let response = {};
            response.error = "Something went wrong: " + err.message;
            res.end(JSON.stringify(response));
        }
    });
}
