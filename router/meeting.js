const { hSet, hGetAll, hDel } = require("../redis");
const { getMsg, getParams } = require("../common");

const { server } = require("../config/app");
let io = require("socket.io")(server, { allowEIO3: true });
io.on("connection", async (socket) => {
  await onListener(socket);
});

const userMap = new Map(); // user - > socket
const roomKey = "meeting-room::";

/**
 * DB data
 * @author suke
 * @param {Object} userId
 * @param {Object} roomId
 * @param {Object} nickname
 * @param {Object} pub
 */
async function getUserDetailByUid(userId, roomId, nickname, pub) {
  let res = JSON.stringify({
    userId: userId,
    roomId: roomId,
    nickname: nickname,
    pub: pub,
  });
  return res;
}

/**
 * 监听
 * @param {Object} s
 */
async function onListener(s) {
  let url = s.client.request.url;
  let userId = getParams(url, "userId");
  let roomId = getParams(url, "roomId");
  let nickname = getParams(url, "nickname");
  let pub = getParams(url, "pub");
  userMap.set(userId, s);
  if (roomId) {
    await hSet(
      roomKey + roomId,
      userId,
      await getUserDetailByUid(userId, roomId, nickname, pub)
    );
    oneToRoomMany(
      roomId,
      getMsg("join", userId + " join then room", 200, {
        userId: userId,
        nickname: nickname,
      })
    );
  }

  // 收到消息
  s.on("msg", async (data) => {
    await oneToRoomMany(roomId, data);
  });
  // 离线
  s.on("disconnect", () => {
    userMap.delete(userId);
    if (roomId) {
      hDel(roomKey + roomId, userId);
      oneToRoomMany(
        roomId,
        getMsg("leave", userId + " leave the room ", 200, {
          userId: userId,
          nickname: nickname,
        })
      );
    }
  });
  // 用户列表
  s.on("roomUserList", async (data) => {
    s.emit("roomUserList", await getRoomOnlyUserList(data["roomId"]));
  });
  // 打电话
  s.on("call", (data) => {
    let targetUid = data["targetUid"];
    oneToOne(targetUid, getMsg("call", "远程呼叫", 200, data));
  });
  // 协商信息
  s.on("candidate", (data) => {
    let targetUid = data["targetUid"];
    oneToOne(targetUid, getMsg("candidate", "ice candidate", 200, data));
  });
  // 信令
  s.on("offer", (data) => {
    let targetUid = data["targetUid"];
    oneToOne(targetUid, getMsg("offer", "rtc offer", 200, data));
  });
  // 应答
  s.on("answer", (data) => {
    let targetUid = data["targetUid"];
    oneToOne(targetUid, getMsg("answer", "rtc answer", 200, data));
  });
  // 接收电话之前
  s.on("beforeCall", (data) => {
    let targetUid = data["targetUid"];
    oneToOne(targetUid, getMsg("beforeCall", "呼叫之前的确定", 200, data));
  });
  // 确定回复
  s.on("success", (data) => {
    // 消息传送给打电话的人,走正常的打电话流程
    let userId = data["userId"];
    oneToOne(userId, getMsg("success", "确定回复", 200, data));
  });
}

/**
 * ono to one
 * @author suke
 * @param {Object} uid
 * @param {Object} msg
 */
function oneToOne(uid, msg) {
  //   console.log(uid, msg);
  let s = userMap.get(uid);
  if (s) {
    s.emit("msg", msg);
  } else {
    console.log(uid + "用户不在线");
  }
}

/**
 * 获取房间用户列表(k-v) 原始KV数据
 * @author suke
 * @param {Object} roomId
 */
async function getRoomUser(roomId) {
  return await hGetAll(roomKey + roomId);
}

/**
 * 获取房间用户列表(list)
 * @author suke
 * @param {Object} roomId
 */
async function getRoomOnlyUserList(roomId) {
  let resList = [];
  let uMap = await hGetAll(roomKey + roomId);
  for (const key in uMap) {
    let detail = JSON.parse(uMap[key]);
    resList.push(detail);
  }
  return resList;
}

/**
 * broadcast
 * @author suc
 * @param {Object} roomId
 * @param {Object} msg
 */
async function oneToRoomMany(roomId, msg) {
  let uMap = await getRoomUser(roomId);
  for (const uid in uMap) {
    oneToOne(uid, msg);
  }
}
