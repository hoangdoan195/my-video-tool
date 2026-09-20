const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.use(cors());
app.use(express.json());

/*

TRANG KIỂM TRA BACKEND

*/

app.get("/", (req, res) => {

res.json({
success: true,
message: "My Video Tool backend đang hoạt động!"
});

});

/*

YOUTUBE

*/

function getYouTubeVideoId(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

if (host === "youtu.be") {

  return parsed.pathname
    .split("/")
    .filter(Boolean)[0] || null;

}

if (
  host === "youtube.com" ||
  host.endsWith(".youtube.com")
) {

  const videoId =
    parsed.searchParams.get("v");

  if (videoId) {
    return videoId;
  }

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

TIKTOK

*/

function isTikTokUrl(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

return (
  host === "tiktok.com" ||
  host.endsWith(".tiktok.com")
);

} catch (error) {

return false;

}

}

function isTikTokShortUrl(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

return (
  host === "vt.tiktok.com" ||
  host === "vm.tiktok.com"
);

} catch (error) {

return false;

}

}

/*

TIKTOK SHORT URL

*/

async function resolveTikTokUrl(url) {

try {

const response = await fetch(
  url,
  {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  }
);

const location =
  response.headers.get("location");

if (location) {
  return location;
}

return null;

} catch (error) {

console.error(
  "TikTok redirect error:",
  error.message
);

return null;

}

}

/*

TIKTOK OEMBED

*/

async function getTikTokMetadata(url) {

try {

const apiUrl =
  "https://www.tiktok.com/oembed?url=" +
  encodeURIComponent(url);

const response =
  await fetch(
    apiUrl,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0"
      }
    }
  );

if (!response.ok) {

  return null;

}

const data =
  await response.json();

return {

  title:
    data.title || "",

  channel:
    data.author_name || "",

  authorUrl:
    data.author_url || "",

  thumbnail:
    data.thumbnail_url || "",

  html:
    data.html || ""

};

} catch (error) {

console.error(
  "TikTok oEmbed error:",
  error.message
);

return null;

}

}

/*

FACEBOOK

*/

function isFacebookUrl(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

return (
  host === "facebook.com" ||
  host === "fb.watch" ||
  host.endsWith(".facebook.com")
);

} catch (error) {

return false;

}

}

/*

DOUYIN

*/

function isDouyinUrl(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

return (
  host === "douyin.com" ||
  host.endsWith(".douyin.com")
);

} catch (error) {

return false;

}

}

function isDouyinShortUrl(url) {

try {

const parsed = new URL(url);

const host = parsed.hostname
  .toLowerCase()
  .replace(/^www\./, "");

return host === "v.douyin.com";

} catch (error) {

return false;

}

}

/*

DÒ TÌM LINK DOUYIN TRONG TEXT

*/

function extractDouyinUrl(text) {

if (!text) {
return null;
}

const match =
text.match(
/https?://(?:v.douyin.com|www.douyin.com|douyin.com|iesdouyin.com)/[A-Za-z0-9?=&._~/%-]+/i
);

if (match) {

return match[0].replace(
  /[)\]}>，。！？；：]+$/g,
  ""
);

}

return null;

}

/*

API ANALYZE

*/

app.post(
"/api/analyze",
async (req, res) => {

const originalUrl =
  req.body &&
  req.body.url;

if (!originalUrl) {

  return res.status(400).json({

    success: false,

    message:
      "Thiếu URL."

  });

}

const url =
  String(originalUrl).trim();


/*
=================================
YOUTUBE
=================================
*/

const youtubeVideoId =
  getYouTubeVideoId(url);

if (youtubeVideoId) {

  if (!YOUTUBE_API_KEY) {

    return res.status(500).json({

      success: false,

      message:
        "Backend chưa có YOUTUBE_API_KEY."

    });

  }

  try {

    const apiUrl =
      "https://www.googleapis.com/youtube/v3/videos" +
      "?part=snippet,contentDetails" +
      "&id=" +
      encodeURIComponent(
        youtubeVideoId
      ) +
      "&key=" +
      encodeURIComponent(
        YOUTUBE_API_KEY
      );

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

    const thumbnails =
      snippet.thumbnails || {};

    const thumbnail =
      thumbnails.maxres?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      null;

    return res.json({

      success: true,

      platform:
        "YouTube",

      url:
        url,

      video: {

        id:
          youtubeVideoId,

        title:
          snippet.title ||
          "Không có tiêu đề",

        description:
          snippet.description ||
          "",

        channel:
          snippet.channelTitle ||
          "",

        publishedAt:
          snippet.publishedAt ||
          null,

        duration:
          contentDetails.duration ||
          null,

        thumbnail:
          thumbnail

      }

    });

  } catch (error) {

    console.error(
      "YouTube error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Lỗi khi kết nối YouTube API.",

      error:
        error.message ||
        "Unknown error"

    });

  }

}


/*
=================================
TIKTOK LINK RÚT GỌN
=================================
*/

if (
  isTikTokShortUrl(url)
) {

  console.log(
    "TikTok short URL:",
    url
  );

  const resolvedUrl =
    await resolveTikTokUrl(url);

  if (!resolvedUrl) {

    return res.json({

      success: true,

      platform:
        "TikTok",

      url:
        url,

      video: null,

      message:
        "Đã nhận diện TikTok nhưng chưa xác định được URL đích."

    });

  }

  console.log(
    "TikTok resolved URL:",
    resolvedUrl
  );

  const metadata =
    await getTikTokMetadata(
      resolvedUrl
    );

  return res.json({

    success: true,

    platform:
      "TikTok",

    url:
      resolvedUrl,

    video:
      metadata
        ? {
            title:
              metadata.title,

            channel:
              metadata.channel,

            thumbnail:
              metadata.thumbnail,

            duration:
              null

          }
        : null,

    message:
      metadata
        ? "Đã lấy thông tin TikTok."
        : "Đã xác định URL TikTok đích."

  });

}


/*
=================================
TIKTOK URL ĐẦY ĐỦ
=================================
*/

if (
  isTikTokUrl(url)
) {

  const metadata =
    await getTikTokMetadata(url);

  return res.json({

    success: true,

    platform:
      "TikTok",

    url:
      url,

    video:
      metadata
        ? {

            title:
              metadata.title,

            channel:
              metadata.channel,

            thumbnail:
              metadata.thumbnail,

            duration:
              null

          }
        : null,

    message:
      metadata
        ? "Đã lấy thông tin TikTok."
        : "Đã nhận diện liên kết TikTok."

  });

}


/*
=================================
FACEBOOK
=================================
*/

if (
  isFacebookUrl(url)
) {

  return res.json({

    success: true,

    platform:
      "Facebook",

    url:
      url,

    video: null,

    message:
      "Đã nhận diện liên kết Facebook. Metadata sẽ được xử lý nếu Facebook cho phép truy cập công khai."

  });

}


/*
=================================
DOUYIN
=================================
*/

if (
  isDouyinShortUrl(url) ||
  isDouyinUrl(url)
) {

  return res.json({

    success: true,

    platform:
      "Douyin",

    url:
      url,

    video: null,

    message:
      "Đã nhận diện liên kết Douyin."

  });

}


/*
=================================
LINK KHÔNG HỖ TRỢ
=================================
*/

const douyinFromText =
  extractDouyinUrl(url);

if (douyinFromText) {

  return res.json({

    success: true,

    platform:
      "Douyin",

    url:
      douyinFromText,

    video: null,

    message:
      "Đã tìm thấy liên kết Douyin trong nội dung chia sẻ."

  });

}


return res.status(400).json({

  success: false,

  message:
    "Liên kết này chưa được hỗ trợ."

});

}
);

/*

KHỞI ĐỘNG SERVER

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
