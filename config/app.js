var express = require("express");
var bodyParser = require("body-parser");
var app = express();
const http = require("http");
var server = http.createServer(app);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
module.exports = {
  app,
  server,
};
