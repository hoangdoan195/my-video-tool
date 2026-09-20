const express = require("express");
const cors = require("cors");
const { Innertube } = require("youtubei.js");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let youtube = null;

/*
Khởi tạo YouTube client
*/

async function getYoutubeClient() {

if (!youtube) {
youtube = await Innertube.create();
}

return youtube;
}

/*
Kiểm tra backend
*/

app.get("/", (req, res) => {

res.json({
success: true,
message: "My Video Tool backend đang hoạt động!"
});

});

/*
Phân tích YouTube
*/

app.post("/api/analyze", async (req, res) => {

const url = req.body && req.body.url;

if (!url) {

return res.status(400).json({
  success: false,
  message: "Thiếu URL."
});

}

/*
Kiểm tra URL có phải YouTube không
*/

let hostname;

try {

hostname = new URL(url)
  .hostname
  .toLowerCase()
  .replace(/^www\./, "");

} catch (error) {

return res.status(400).json({
  success: false,
  message: "URL không hợp lệ."
});

}

const isYoutube =
hostname === "youtube.com" ||
hostname.endsWith(".youtube.com") ||
hostname === "youtu.be";

if (!isYoutube) {

return res.status(400).json({
  success: false,
  message: "Bước thử nghiệm này hiện chỉ xử lý YouTube."
});

}

try {

/*
  Kết nối YouTube
*/

const yt =
  await getYoutubeClient();


/*
  Lấy thông tin video
*/

const video =
  await yt.getBasicInfo(url);


const info =
  video.basic_info;


/*
  Trả thông tin về web
*/

return res.json({

  success: true,

  platform: "YouTube",

  url: url,

  video: {

    title:
      info.title || "Không có tiêu đề",

    videoId:
      info.id || null,

    duration:
      info.duration || null,

    thumbnail:
      info.thumbnail?.[0]?.url || null

  }

});

}

catch (error) {

console.error(
  "YouTube error:",
  error
);


return res.status(500).json({

  success: false,

  message:
    "Không lấy được thông tin YouTube.",

  error:
    error.message || "Unknown error"

});

}

});

/*
Khởi động server
*/

app.listen(
PORT,
"0.0.0.0",
() => {

console.log(
  `My Video Tool backend đang chạy tại port ${PORT}`
);

}
);
