const { server } = require("./config/app");

const meeting = require("./router/meeting");
server.listen(18080, async () => {
  console.log("服务器启动成功 *:18080");
});
