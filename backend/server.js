const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.use(cors());
app.use(express.json());

/*
Trang kiểm tra backend
*/

app.get("/", (req, res) => {

res.json({
success: true,
message: "My Video Tool backend đang hoạt động!"
});

});

/*
Lấy YouTube Video ID
*/

function getYouTubeVideoId(url) {

try {

const parsed = new URL(url);
const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");


/*
  youtu.be/VIDEO_ID
*/

if (host === "youtu.be") {

  return parsed.pathname
    .split("/")
    .filter(Boolean)[0] || null;

}


/*
  youtube.com/watch?v=VIDEO_ID
*/

if (
  host === "youtube.com" ||
  host.endsWith(".youtube.com")
) {

  const videoId =
    parsed.searchParams.get("v");

  if (videoId) {
    return videoId;
  }


  /*
    Hỗ trợ /shorts/VIDEO_ID
  */

  const parts =
    parsed.pathname
      .split("/")
      .filter(Boolean);


  if (
    parts[0] === "shorts" &&
    parts[1]
  ) {
    return parts[1];
  }


  /*
    Hỗ trợ /live/VIDEO_ID
  */

  if (
    parts[0] === "live" &&
    parts[1]
  ) {
    return parts[1];
  }

}


return null;

} catch (error) {

return null;

}

}

/*
API phân tích video
*/

app.post("/api/analyze", async (req, res) => {

const url =
req.body && req.body.url;

if (!url) {

return res.status(400).json({

  success: false,

  message: "Thiếu URL."

});

}

if (!YOUTUBE_API_KEY) {

return res.status(500).json({

  success: false,

  message: "Backend chưa có YOUTUBE_API_KEY."

});

}

const videoId =
getYouTubeVideoId(url);

if (!videoId) {

return res.status(400).json({

  success: false,

  message:
    "Không tìm thấy YouTube Video ID."

});

}

try {

/*
  Gọi YouTube Data API v3
*/

const apiUrl =
  "https://www.googleapis.com/youtube/v3/videos" +
  "?part=snippet,contentDetails" +
  "&id=" +
  encodeURIComponent(videoId) +
  "&key=" +
  encodeURIComponent(YOUTUBE_API_KEY);


const response =
  await fetch(apiUrl);


const data =
  await response.json();


if (!response.ok) {

  console.error(
    "YouTube API error:",
    data
  );

  return res.status(502).json({

    success: false,

    message:
      "YouTube API trả về lỗi.",

    error:
      data.error?.message ||
      "Unknown YouTube API error"

  });

}


if (
  !data.items ||
  data.items.length === 0
) {

  return res.status(404).json({

    success: false,

    message:
      "Không tìm thấy video YouTube."

  });

}


const video =
  data.items[0];


const snippet =
  video.snippet || {};


const contentDetails =
  video.contentDetails || {};


/*
  Chọn thumbnail
*/

const thumbnails =
  snippet.thumbnails || {};


const thumbnail =
  thumbnails.maxres?.url ||
  thumbnails.high?.url ||
  thumbnails.medium?.url ||
  thumbnails.default?.url ||
  null;


/*
  Trả kết quả về web
*/

return res.json({

  success: true,

  platform: "YouTube",

  url: url,

  video: {

    id: videoId,

    title:
      snippet.title || "Không có tiêu đề",

    description:
      snippet.description || "",

    channel:
      snippet.channelTitle || "",

    publishedAt:
      snippet.publishedAt || null,

    duration:
      contentDetails.duration || null,

    thumbnail:
      thumbnail

  }

});

} catch (error) {

console.error(
  "Backend error:",
  error
);


return res.status(500).json({

  success: false,

  message:
    "Lỗi khi kết nối YouTube API.",

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
