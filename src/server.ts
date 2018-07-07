import express from "express";
import fs from "fs";
import https from "https";
import {setUpBotWebHooks} from "./bot";

declare var process: any;

// **********************************************************************************

export const app: express.Express = express();
// const DIST_DIR = path.join(__dirname, "dist");
// app.use(express.static(DIST_DIR));
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded({extended: true})); // to support URL-encoded bodies
// var allowCrossDomain = function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', "*");
//   res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// }
// app.use(allowCrossDomain);
setUpBotWebHooks();
app.get("/", function(req: any, res: any) {
    res.send("MiniSquadron Bot Server");
});

// **********************************************************************************
console.log("process.env.PORT = " + process.env.PORT);

const PORT = process.env.PORT || 5000;

function main() {
  const host = server.address().address;
  const port = server.address().port;

  if (process.env.HTTPS === "true") {
    console.log("MSOBotServer listening at https://%s:%s", host, port);
  } else {
    console.log("MSOBotServer listening at http://%s:%s", host, port);
  }
}

let server: any = null;
if (process.env.HTTPS === "true") {
  const sslOptions = {
    cert: fs.readFileSync("cert.pem"),
    key: fs.readFileSync("key.pem"),
    passphrase: "password",
  };
  server = https.createServer(sslOptions, app).listen(PORT, main);
} else {
  server = app.listen(PORT, main);
}
