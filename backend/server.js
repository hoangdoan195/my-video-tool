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

LẤY YOUTUBE VIDEO ID

*/

function getYouTubeVideoId(url) {

try {

const parsed = new URL(url);

const host =
  parsed.hostname
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

KIỂM TRA TIKTOK

*/

function isTikTokUrl(url) {

try {

const parsed = new URL(url);

const host =
  parsed.hostname
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

const host =
  parsed.hostname
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

KIỂM TRA DOUYIN

*/

function isDouyinUrl(url) {

try {

const parsed = new URL(url);

const host =
  parsed.hostname
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

const host =
  parsed.hostname
    .toLowerCase()
    .replace(/^www\./, "");

return host === "v.douyin.com";

} catch (error) {

return false;

}

}

/*

FACEBOOK

*/

function isFacebookUrl(url) {

try {

const parsed = new URL(url);

const host =
  parsed.hostname
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

RESOLVE LINK RÚT GỌN

*/

async function resolveRedirectUrl(url) {

try {

const response =
  await fetch(
    url,
    {
      method: "GET",
      redirect: "follow",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "Accept-Language":
          "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    }
  );

return response.url || null;

} catch (error) {

console.error(
  "Redirect resolve error:",
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

  console.log(
    "TikTok oEmbed status:",
    response.status
  );

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

LẤY METADATA TỪ HTML

*/

async function getHtmlMetadata(url) {

try {

const response =
  await fetch(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml"
      }
    }
  );

if (!response.ok) {

  console.log(
    "HTML metadata status:",
    response.status
  );

  return null;

}

const html =
  await response.text();


function getMeta(property) {

  const escaped =
    property.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

  const regex =
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      "i"
    );

  const match =
    html.match(regex);

  if (match) {
    return decodeHtmlEntities(
      match[1]
    );
  }

  return "";

}


function getMetaReverse(property) {

  const escaped =
    property.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

  const regex =
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i"
    );

  const match =
    html.match(regex);

  if (match) {
    return decodeHtmlEntities(
      match[1]
    );
  }

  return "";

}


const title =
  getMeta("og:title") ||
  getMetaReverse("og:title") ||
  getMeta("twitter:title") ||
  getMetaReverse("twitter:title");


const thumbnail =
  getMeta("og:image") ||
  getMetaReverse("og:image") ||
  getMeta("twitter:image") ||
  getMetaReverse("twitter:image");


const description =
  getMeta("og:description") ||
  getMetaReverse("og:description") ||
  getMeta("description") ||
  getMetaReverse("description");


return {

  title:
    title,

  thumbnail:
    thumbnail,

  description:
    description

};

} catch (error) {

console.error(
  "HTML metadata error:",
  error.message
);

return null;

}

}

/*

DECODE HTML ENTITY

*/

function decodeHtmlEntities(value) {

if (!value) {
return "";
}

return String(value)
.replace(/&/g, "&")
.replace(/"/g, '"')
.replace(/'/g, "'")
.replace(/'/gi, "'")
.replace(/</g, "<")
.replace(/>/g, ">");

}

/*

LẤY METADATA TIKTOK / DOUYIN

*/

async function getSocialMetadata(url, platform) {

let metadata = null;

/*
TikTok:
thử oEmbed trước
*/

if (platform === "TikTok") {

metadata =
  await getTikTokMetadata(url);

}

/*
Nếu không có metadata,
thử đọc HTML
*/

if (
!metadata ||
!metadata.title ||
!metadata.thumbnail
) {

const htmlMetadata =
  await getHtmlMetadata(url);


if (htmlMetadata) {

  metadata = {

    title:
      metadata?.title ||
      htmlMetadata.title ||
      "",

    channel:
      metadata?.channel ||
      "",

    thumbnail:
      metadata?.thumbnail ||
      htmlMetadata.thumbnail ||
      "",

    description:
      metadata?.description ||
      htmlMetadata.description ||
      ""

  };

}

}

if (!metadata) {

return null;

}

return {

title:
  metadata.title || "",

channel:
  metadata.channel || "",

thumbnail:
  metadata.thumbnail || "",

description:
  metadata.description || "",

duration:
  null

};

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
========================================
YOUTUBE
========================================
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
========================================
TIKTOK SHORT URL
========================================
*/

if (
  isTikTokShortUrl(url)
) {

  console.log(
    "TikTok short URL:",
    url
  );


  const resolvedUrl =
    await resolveRedirectUrl(url);


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
    await getSocialMetadata(
      resolvedUrl,
      "TikTok"
    );


  return res.json({

    success: true,

    platform:
      "TikTok",

    url:
      resolvedUrl,

    video:
      metadata
        ? metadata
        : null,

    message:
      metadata
        ? "Đã lấy thông tin TikTok."
        : "Đã xác định URL TikTok đích."

  });

}


/*
========================================
TIKTOK ĐẦY ĐỦ
========================================
*/

if (
  isTikTokUrl(url)
) {

  const metadata =
    await getSocialMetadata(
      url,
      "TikTok"
    );


  return res.json({

    success: true,

    platform:
      "TikTok",

    url:
      url,

    video:
      metadata
        ? metadata
        : null,

    message:
      metadata
        ? "Đã lấy thông tin TikTok."
        : "Đã nhận diện liên kết TikTok."

  });

}


/*
========================================
DOUYIN SHORT URL
========================================
*/

if (
  isDouyinShortUrl(url)
) {

  console.log(
    "Douyin short URL:",
    url
  );


  const resolvedUrl =
    await resolveRedirectUrl(url);


  if (!resolvedUrl) {

    return res.json({

      success: true,

      platform:
        "Douyin",

      url:
        url,

      video: null,

      message:
        "Đã nhận diện Douyin nhưng chưa xác định được URL đích."

    });

  }


  console.log(
    "Douyin resolved URL:",
    resolvedUrl
  );


  const metadata =
    await getSocialMetadata(
      resolvedUrl,
      "Douyin"
    );


  return res.json({

    success: true,

    platform:
      "Douyin",

    url:
      resolvedUrl,

    video:
      metadata
        ? metadata
        : null,

    message:
      metadata
        ? "Đã lấy thông tin Douyin."
        : "Đã xác định URL Douyin đích."

  });

}


/*
========================================
DOUYIN ĐẦY ĐỦ
========================================
*/

if (
  isDouyinUrl(url)
) {

  const metadata =
    await getSocialMetadata(
      url,
      "Douyin"
    );


  return res.json({

    success: true,

    platform:
      "Douyin",

    url:
      url,

    video:
      metadata
        ? metadata
        : null,

    message:
      metadata
        ? "Đã lấy thông tin Douyin."
        : "Đã nhận diện liên kết Douyin."

  });

}


/*
========================================
FACEBOOK
========================================
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
========================================
LINK KHÔNG HỖ TRỢ
========================================
*/

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
