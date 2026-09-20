const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.use(cors());
app.use(express.json());

/*

TRANG KIỂM TRA

*/

app.get("/", (req, res) => {
res.json({
success: true,
message: "My Video Tool backend đang hoạt động!"
});
});

/*

LOG

*/

function logStep(message, data = "") {
if (data !== "") {
console.log("[My Video Tool] ${message}", data);
} else {
console.log("[My Video Tool] ${message}");
}
}

/*

HTTP FETCH

*/

async function fetchPage(url) {
logStep("🌐 Đang truy cập:", url);

const response = await fetch(url, {
method: "GET",
redirect: "follow",

headers: {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

  "Accept-Language":
    "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"
}

});

const html = await response.text();

logStep(
"📄 HTTP ${response.status}",
"URL cuối: ${response.url}"
);

logStep(
"📦 Kích thước HTML:",
"${html.length} ký tự"
);

return {
response,
html
};
}

/*

HTML DECODE

*/

function decodeHtml(value) {
if (!value) {
return "";
}

return String(value)
.replace(/&/gi, "&")
.replace(/"/gi, '"')
.replace(/'/gi, "'")
.replace(/'/gi, "'")
.replace(/</gi, "<")
.replace(/>/gi, ">")
.replace(///gi, "/")
.replace(/ /gi, " ")
.replace(/\u00A0/g, " ")
.trim();
}

/*

META

*/

function getMeta(html, property) {
if (!html) {
return "";
}

const escaped = property.replace(
/[-/\^$*+?.()|[]{}]/g,
"\$&"
);

const patterns = [
new RegExp(
"<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>",
"i"
),

new RegExp(
  `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`,
  "i"
),

new RegExp(
  `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
  "i"
),

new RegExp(
  `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`,
  "i"
)

];

for (const pattern of patterns) {
const match = html.match(pattern);

if (match && match[1]) {
  return decodeHtml(match[1]);
}

}

return "";
}

/*

JSON

*/

function safeJsonParse(value) {
try {
return JSON.parse(value);
} catch {
return null;
}
}

/*

TÌM JSON SCRIPT

*/

function extractJsonScript(html, id) {
if (!html) {
return null;
}

const escapedId = id.replace(
/[-/\^$*+?.()|[]{}]/g,
"\$&"
);

const pattern = new RegExp(
"<script[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/script>",
"i"
);

const match = html.match(pattern);

if (!match || !match[1]) {
return null;
}

return safeJsonParse(
match[1].trim()
);
}

/*

DECODE JSON STRING

*/

function decodeJsonString(value) {
if (!value) {
return "";
}

try {
return JSON.parse(""${value}"");
} catch {
return String(value)
.replace(/\"/g, '"')
.replace(/\n/g, "\n")
.replace(/\r/g, "\r")
.replace(/\t/g, "\t")
.replace(/\u002F/gi, "/")
.replace(/\//g, "/");
}
}

/*

TÌM VALUE RECURSIVE

*/

function findValueDeep(
object,
keys,
depth = 0
) {
if (
!object ||
depth > 15 ||
typeof object !== "object"
) {
return "";
}

const wantedKeys =
keys.map(key => key.toLowerCase());

if (Array.isArray(object)) {
for (const item of object) {
const found = findValueDeep(
item,
wantedKeys,
depth + 1
);

  if (found) {
    return found;
  }
}

return "";

}

for (const key of Object.keys(object)) {
const lowerKey =
key.toLowerCase();

if (
  wantedKeys.includes(lowerKey)
) {
  const value = object[key];

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number"
  ) {
    return String(value);
  }
}

}

for (const key of Object.keys(object)) {
const found =
findValueDeep(
object[key],
wantedKeys,
depth + 1
);

if (found) {
  return found;
}

}

return "";
}

/*

TÌM IMAGE RECURSIVE

*/

function findImageDeep(
object,
depth = 0
) {
if (
!object ||
depth > 15 ||
typeof object !== "object"
) {
return "";
}

if (Array.isArray(object)) {
for (const item of object) {
const found =
findImageDeep(
item,
depth + 1
);

  if (found) {
    return found;
  }
}

return "";

}

const preferredKeys = [
"origincover",
"origin_cover",
"origincoverurl",
"origin_cover_url",
"dynamiccover",
"dynamic_cover",
"cover",
"coverurl",
"cover_url",
"thumbnail",
"thumbnailurl",
"thumbnail_url"
];

for (const key of preferredKeys) {
const value = object[key];

if (
  typeof value === "string" &&
  /^https?:\/\//i.test(value)
) {
  return value;
}

if (
  value &&
  typeof value === "object"
) {
  const nested =
    findImageDeep(
      value,
      depth + 1
    );

  if (nested) {
    return nested;
  }
}

}

for (const key of Object.keys(object)) {
const value = object[key];

if (
  typeof value === "string" &&
  /^https?:\/\//i.test(value) &&
  (
    key.toLowerCase().includes("cover") ||
    key.toLowerCase().includes("image") ||
    key.toLowerCase().includes("thumb")
  )
) {
  return value;
}

}

for (const key of Object.keys(object)) {
const found =
findImageDeep(
object[key],
depth + 1
);

if (found) {
  return found;
}

}

return "";
}

/*

DURATION

*/

function normalizeDuration(value) {
if (
value === null ||
value === undefined ||
value === ""
) {
return null;
}

const numeric =
Number(value);

if (
!Number.isFinite(numeric) ||
numeric < 0
) {
return null;
}

/*
Nếu >= 1000 thì giả định milliseconds.
*/

if (numeric >= 1000) {
return Math.round(
numeric / 1000
);
}

return Math.round(
numeric
);
}

/*

YOUTUBE

*/

function getYouTubeVideoId(url) {
try {
const parsed =
new URL(url);

const host =
  parsed.hostname
    .toLowerCase()
    .replace(/^www\./, "");

if (
  host === "youtu.be"
) {
  return (
    parsed.pathname
      .split("/")
      .filter(Boolean)[0] ||
    null
  );
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

} catch {
return null;
}
}

/*

TIKTOK

*/

function isTikTokUrl(url) {
try {
const host =
new URL(url)
.hostname
.toLowerCase()
.replace(/^www./, "");

return (
  host === "tiktok.com" ||
  host.endsWith(".tiktok.com")
);

} catch {
return false;
}
}

function isTikTokShortUrl(url) {
try {
const host =
new URL(url)
.hostname
.toLowerCase()
.replace(/^www./, "");

return (
  host === "vt.tiktok.com" ||
  host === "vm.tiktok.com"
);

} catch {
return false;
}
}

async function resolveTikTokUrl(url) {
try {
logStep(
"🎵 TikTok short URL:",
url
);

const response =
  await fetch(url, {
    method: "GET",
    redirect: "follow",

    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

logStep(
  "🎵 TikTok URL cuối:",
  response.url
);

return response.url || null;

} catch (error) {
console.error(
"❌ TikTok redirect error:",
error.message
);

return null;

}
}

/*

TIKTOK METADATA

*/

async function getTikTokMetadata(url) {
try {

logStep(
  "🎵 Gọi TikTok oEmbed:",
  url
);

/*
====================================
OEMBED
====================================
*/

const apiUrl =
  "https://www.tiktok.com/oembed?url=" +
  encodeURIComponent(url);

const response =
  await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

      "Accept":
        "application/json,text/plain,*/*",

      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

logStep(
  "🎵 TikTok oEmbed HTTP:",
  response.status
);

if (!response.ok) {
  return null;
}

const data =
  await response.json();

let title =
  data.title || "";

let channel =
  data.author_name || "";

let thumbnail =
  data.thumbnail_url || "";

let duration =
  null;

logStep(
  "🎵 TikTok oEmbed metadata:",
  JSON.stringify({
    title,
    author: channel,
    thumbnail
  })
);

/*
====================================
LẤY HTML TRANG TIKTOK
====================================

oEmbed không cung cấp duration.
Ta đọc thêm HTML video.
*/

try {

  logStep(
    "🎵 Đang đọc HTML TikTok để tìm duration..."
  );

  const pageResponse =
    await fetch(url, {
      method: "GET",
      redirect: "follow",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
          "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

        "Cache-Control":
          "no-cache",

        "Pragma":
          "no-cache"
      }
    });

  const html =
    await pageResponse.text();

  logStep(
    "🎵 TikTok HTML HTTP:",
    pageResponse.status
  );

  logStep(
    "🎵 TikTok HTML size:",
    `${html.length} ký tự`
  );

  /*
  ==================================
  DURATION PATTERNS
  ==================================
  */

  const durationPatterns = [

    /"duration"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"duration_ms"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"durationMs"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"video_duration"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"videoDuration"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"playTime"\s*:\s*(\d+(?:\.\d+)?)/i,

    /"play_time"\s*:\s*(\d+(?:\.\d+)?)/i
  ];

  for (
    const pattern of durationPatterns
  ) {

    const match =
      html.match(pattern);

    if (
      match &&
      match[1]
    ) {

      duration =
        normalizeDuration(
          match[1]
        );

      if (
        duration !== null
      ) {

        logStep(
          "🎵 Tìm thấy TikTok duration:",
          `${duration} giây`
        );

        break;
      }
    }
  }

  /*
  ==================================
  QUÉT SCRIPT
  ==================================
  */

  if (
    duration === null
  ) {

    const scripts =
      html.match(
        /<script[^>]*>([\s\S]*?)<\/script>/gi
      ) || [];

    logStep(
      "🎵 TikTok scripts:",
      scripts.length
    );

    for (
      const script of scripts
    ) {

      if (
        !/duration|videoDuration|video_duration/i
          .test(script)
      ) {
        continue;
      }

      const match =
        script.match(
          /"(?:duration|duration_ms|durationMs|video_duration|videoDuration|playTime|play_time)"\s*:\s*(\d+(?:\.\d+)?)/i
        );

      if (
        match &&
        match[1]
      ) {

        duration =
          normalizeDuration(
            match[1]
          );

        if (
          duration !== null
        ) {

          logStep(
            "🎵 Tìm thấy duration trong script:",
            `${duration} giây`
          );

          break;
        }
      }
    }
  }

  /*
  ==================================
  TITLE FALLBACK
  ==================================
  */

  if (!title) {

    title =
      getMeta(
        html,
        "og:title"
      ) ||
      getMeta(
        html,
        "twitter:title"
      );
  }

  /*
  ==================================
  THUMBNAIL FALLBACK
  ==================================
  */

  if (!thumbnail) {

    thumbnail =
      getMeta(
        html,
        "og:image"
      ) ||
      getMeta(
        html,
        "twitter:image"
      );
  }

  /*
  ==================================
  AUTHOR FALLBACK
  ==================================
  */

  if (!channel) {

    channel =
      getMeta(
        html,
        "author"
      );
  }

} catch (pageError) {

  console.error(
    "⚠️ TikTok HTML error:",
    pageError.message
  );
}

/*
====================================
KẾT QUẢ
====================================
*/

logStep(
  "🎵 TikTok metadata cuối:",
  JSON.stringify({
    title,
    author: channel,
    thumbnail,
    duration
  })
);

return {

  title:
    title || "",

  channel:
    channel || "",

  thumbnail:
    thumbnail || "",

  duration:
    duration
};

} catch (error) {

console.error(
  "❌ TikTok oEmbed error:",
  error.message
);

return null;

}
}

/*

DOUYIN

*/

function isDouyinUrl(url) {
try {
const host =
new URL(url)
.hostname
.toLowerCase()
.replace(/^www./, "");

return (
  host === "douyin.com" ||
  host.endsWith(".douyin.com")
);

} catch {
return false;
}
}

function isDouyinShortUrl(url) {
try {
const host =
new URL(url)
.hostname
.toLowerCase()
.replace(/^www./, "");

return (
  host === "v.douyin.com"
);

} catch {
return false;
}
}

function getDouyinVideoId(url) {
try {
const parsed =
new URL(url);

const match =
  parsed.pathname.match(
    /\/video\/(\d+)/
  );

return match
  ? match[1]
  : "";

} catch {
return "";
}
}

async function resolveDouyinUrl(url) {
try {
logStep(
"🎵 Douyin URL:",
url
);

const result =
  await fetchPage(url);

logStep(
  "🎵 Douyin URL cuối:",
  result.response.url
);

return (
  result.response.url ||
  url
);

} catch (error) {
console.error(
"❌ Douyin redirect error:",
error.message
);

return url;

}
}

/*

PARSE DOUYIN EMBEDDED DATA

*/

function parseDouyinEmbeddedData(html) {
let title = "";
let channel = "";
let thumbnail = "";
let description = "";
let duration = null;

const nextData =
extractJsonScript(
html,
"NEXT_DATA"
) ||
extractJsonScript(
html,
"NEXT_DATA"
);

if (nextData) {

logStep(
  "🎵 Đã tìm thấy NEXT_DATA"
);

title =
  title ||
  findValueDeep(
    nextData,
    [
      "desc",
      "title",
      "description"
    ]
  );

channel =
  channel ||
  findValueDeep(
    nextData,
    [
      "nickname",
      "authorname",
      "author_name",
      "authorName",
      "username",
      "unique_id",
      "uniqueId"
    ]
  );

thumbnail =
  thumbnail ||
  findImageDeep(
    nextData
  );

description =
  description ||
  findValueDeep(
    nextData,
    [
      "description",
      "desc"
    ]
  );

const nextDuration =
  findValueDeep(
    nextData,
    [
      "duration",
      "durationms",
      "duration_ms"
    ]
  );

duration =
  duration ||
  normalizeDuration(
    nextDuration
  );

} else {

logStep(
  "⚠️ Không tìm thấy NEXT_DATA"
);

}

const renderMatch =
html.match(
/<script[^>]+id=["']RENDER_DATA["'][^>]>([\s\S]?)</script>/i
);

if (
renderMatch &&
renderMatch[1]
) {

logStep(
  "🎵 Đã tìm thấy RENDER_DATA"
);

let encoded =
  renderMatch[1].trim();

try {
  encoded =
    decodeURIComponent(
      encoded
    );
} catch {}

const renderData =
  safeJsonParse(
    encoded
  );

if (renderData) {

  title =
    title ||
    findValueDeep(
      renderData,
      [
        "desc",
        "title",
        "description"
      ]
    );

  channel =
    channel ||
    findValueDeep(
      renderData,
      [
        "nickname",
        "authorname",
        "author_name",
        "authorName",
        "username",
        "unique_id",
        "uniqueId"
      ]
    );

  thumbnail =
    thumbnail ||
    findImageDeep(
      renderData
    );

  description =
    description ||
    findValueDeep(
      renderData,
      [
        "description",
        "desc"
      ]
    );

  const renderDuration =
    findValueDeep(
      renderData,
      [
        "duration",
        "durationms",
        "duration_ms"
      ]
    );

  duration =
    duration ||
    normalizeDuration(
      renderDuration
    );
}

} else {

logStep(
  "⚠️ Không tìm thấy RENDER_DATA"
);

}

const jsonLdMatches =
html.match(
/<script[^>]+type=["']application/ld+json["'][^>]>([\s\S]?)</script>/gi
) || [];

for (
const script of jsonLdMatches
) {

const jsonText =
  script
    .replace(
      /<script[^>]*>/i,
      ""
    )
    .replace(
      /<\/script>$/i,
      ""
    )
    .trim();

const jsonData =
  safeJsonParse(
    jsonText
  );

if (!jsonData) {
  continue;
}

title =
  title ||
  findValueDeep(
    jsonData,
    [
      "headline",
      "name",
      "description"
    ]
  );

channel =
  channel ||
  findValueDeep(
    jsonData,
    [
      "author",
      "creator",
      "name"
    ]
  );

thumbnail =
  thumbnail ||
  findImageDeep(
    jsonData
  );

duration =
  duration ||
  normalizeDuration(
    findValueDeep(
      jsonData,
      [
        "duration"
      ]
    )
  );

}

if (
!title ||
!channel ||
!thumbnail ||
!duration
) {

const scripts =
  html.match(
    /<script[^>]*>([\s\S]*?)<\/script>/gi
  ) || [];

logStep(
  "🎵 Số script tìm thấy:",
  scripts.length
);

for (
  const script of scripts
) {

  if (
    script.length < 100
  ) {
    continue;
  }

  const text =
    script
      .replace(
        /<script[^>]*>/i,
        ""
      )
      .replace(
        /<\/script>$/i,
        ""
      )
      .trim();

  if (
    !/video|aweme|author|cover|desc|duration/i
      .test(text)
  ) {
    continue;
  }

  if (!title) {

    const match =
      text.match(
        /"(?:desc|title|description|headline)"\s*:\s*"((?:\\.|[^"\\])*)"/i
      );

    if (match) {
      title =
        decodeJsonString(
          match[1]
        );
    }
  }

  if (!channel) {

    const match =
      text.match(
        /"(?:nickname|author_name|authorName|username|unique_id|uniqueId)"\s*:\s*"((?:\\.|[^"\\])*)"/i
      );

    if (match) {
      channel =
        decodeJsonString(
          match[1]
        );
    }
  }

  if (!thumbnail) {

    const match =
      text.match(
        /"(?:origin_cover|originCover|dynamic_cover|dynamicCover|cover|cover_url|coverUrl)"\s*:\s*(?:"([^"]+)"|\{[\s\S]{0,1000}?"url"\s*:\s*"([^"]+)")/i
      );

    if (match) {
      thumbnail =
        decodeJsonString(
          match[1] ||
          match[2] ||
          ""
        );
    }
  }

  if (!duration) {

    const match =
      text.match(
        /"(?:duration|duration_ms|durationMs)"\s*:\s*(\d+(?:\.\d+)?)/i
      );

    if (match) {
      duration =
        normalizeDuration(
          match[1]
        );
    }
  }

  if (
    title &&
    channel &&
    thumbnail &&
    duration
  ) {
    break;
  }
}

}

title =
title ||
getMeta(
html,
"og:title"
) ||
getMeta(
html,
"twitter:title"
);

thumbnail =
thumbnail ||
getMeta(
html,
"og:image"
) ||
getMeta(
html,
"twitter:image"
);

description =
description ||
getMeta(
html,
"og:description"
);

channel =
channel ||
getMeta(
html,
"author"
);

return {
title:
title || "",

channel:
  channel || "",

thumbnail:
  thumbnail || "",

description:
  description || "",

duration:
  duration || null

};
}

async function getDouyinMetadata(url) {
try {

logStep(
  "🎵 Đang lấy Douyin metadata:",
  url
);

const {
  response,
  html
} =
  await fetchPage(url);

if (!response.ok) {

  logStep(
    "❌ Douyin HTTP lỗi:",
    response.status
  );

  return null;
}

const videoId =
  getDouyinVideoId(url);

if (videoId) {

  logStep(
    "🎵 Douyin Video ID:",
    videoId
  );
}

const metadata =
  parseDouyinEmbeddedData(
    html
  );

logStep(
  "🎵 Douyin metadata cuối:",
  JSON.stringify(metadata)
);

return metadata;

} catch (error) {

console.error(
  "❌ Douyin metadata error:",
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

const host =
  new URL(url)
    .hostname
    .toLowerCase()
    .replace(/^www\./, "");

return (
  host === "facebook.com" ||
  host === "fb.watch" ||
  host.endsWith(".facebook.com")
);

} catch {
return false;
}
}

async function getFacebookMetadata(url) {
try {

logStep(
  "📘 Đang lấy Facebook metadata:",
  url
);

const {
  response,
  html
} =
  await fetchPage(url);

logStep(
  "📘 Facebook HTTP:",
  response.status
);

let title =
  getMeta(
    html,
    "og:title"
  );

let description =
  getMeta(
    html,
    "og:description"
  );

let thumbnail =
  getMeta(
    html,
    "og:image"
  ) ||
  getMeta(
    html,
    "twitter:image"
  );

const jsonLdMatches =
  html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ) || [];

for (
  const script of jsonLdMatches
) {

  const jsonText =
    script
      .replace(
        /<script[^>]*>/i,
        ""
      )
      .replace(
        /<\/script>$/i,
        ""
      )
      .trim();

  const data =
    safeJsonParse(
      jsonText
    );

  if (!data) {
    continue;
  }

  title =
    title ||
    findValueDeep(
      data,
      [
        "headline",
        "name",
        "description"
      ]
    );

  description =
    description ||
    findValueDeep(
      data,
      [
        "description"
      ]
    );

  thumbnail =
    thumbnail ||
    findImageDeep(
      data
    );
}

if (
  !title ||
  !thumbnail
) {

  const titleMatch =
    html.match(
      /"(?:og:title|title|name)"\s*:\s*"((?:\\.|[^"\\])*)"/i
    );

  if (
    !title &&
    titleMatch
  ) {
    title =
      decodeJsonString(
        titleMatch[1]
      );
  }

  const imageMatch =
    html.match(
      /"(?:og:image|image|thumbnail)"\s*:\s*"((?:\\.|[^"\\])*)"/i
    );

  if (
    !thumbnail &&
    imageMatch
  ) {
    thumbnail =
      decodeJsonString(
        imageMatch[1]
      );
  }
}

logStep(
  "📘 Facebook metadata:",
  JSON.stringify({
    httpStatus:
      response.status,
    title,
    thumbnail,
    description
  })
);

if (
  !title &&
  !thumbnail &&
  !description
) {
  return null;
}

return {

  title:
    title || "",

  channel:
    "",

  thumbnail:
    thumbnail || "",

  description:
    description || "",

  duration:
    null
};

} catch (error) {

console.error(
  "❌ Facebook metadata error:",
  error.message
);

return null;

}
}

/*

API ANALYZE

*/

app.post(
"/api/analyze",
async (req, res) => {

console.log(
  "========================================"
);

console.log(
  "📥 NHẬN REQUEST /api/analyze"
);

console.log(
  "URL:",
  req.body?.url
);

console.log(
  "========================================"
);

const originalUrl =
  req.body?.url;

if (!originalUrl) {

  return res.status(400).json({
    success: false,
    message:
      "Thiếu URL."
  });
}

const url =
  String(
    originalUrl
  ).trim();

/*
====================================
YOUTUBE
====================================
*/

const youtubeVideoId =
  getYouTubeVideoId(url);

if (youtubeVideoId) {

  logStep(
    "▶️ Nhận diện YouTube:",
    youtubeVideoId
  );

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
      await fetch(
        apiUrl
      );

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

    logStep(
      "✅ YouTube metadata OK"
    );

    return res.json({

      success: true,

      platform:
        "YouTube",

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
          "Không có thông tin",

        publishedAt:
          snippet.publishedAt ||
          null,

        duration:
          contentDetails.duration ||
          null,

        thumbnail
      }
    });

  } catch (error) {

    console.error(
      "❌ YouTube error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Lỗi khi kết nối YouTube API.",
      error:
        error.message
    });
  }
}

/*
====================================
TIKTOK SHORT
====================================
*/

if (
  isTikTokShortUrl(url)
) {

  logStep(
    "🎵 Nhận diện TikTok short URL"
  );

  const resolvedUrl =
    await resolveTikTokUrl(
      url
    );

  if (!resolvedUrl) {

    return res.json({
      success: true,
      platform:
        "TikTok",
      url,
      video: null,
      message:
        "Không xác định được URL TikTok đích."
    });
  }

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
              metadata.title ||
              "Không có tiêu đề",

            channel:
              metadata.channel ||
              "Không có thông tin",

            thumbnail:
              metadata.thumbnail ||
              null,

            duration:
              metadata.duration ||
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
====================================
TIKTOK FULL
====================================
*/

if (
  isTikTokUrl(url)
) {

  logStep(
    "🎵 Nhận diện TikTok"
  );

  const metadata =
    await getTikTokMetadata(
      url
    );

  return res.json({

    success: true,

    platform:
      "TikTok",

    url,

    video:
      metadata
        ? {
            title:
              metadata.title ||
              "Không có tiêu đề",

            channel:
              metadata.channel ||
              "Không có thông tin",

            thumbnail:
              metadata.thumbnail ||
              null,

            duration:
              metadata.duration ||
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
====================================
DOUYIN
====================================
*/

if (
  isDouyinShortUrl(url) ||
  isDouyinUrl(url)
) {

  logStep(
    "🎵 Nhận diện Douyin"
  );

  const resolvedUrl =
    await resolveDouyinUrl(
      url
    );

  logStep(
    "🎵 Douyin URL cuối:",
    resolvedUrl
  );

  const metadata =
    await getDouyinMetadata(
      resolvedUrl
    );

  return res.json({

    success: true,

    platform:
      "Douyin",

    url:
      resolvedUrl,

    video:
      metadata
        ? {
            title:
              metadata.title ||
              "Không có tiêu đề",

            channel:
              metadata.channel ||
              "Không có thông tin",

            thumbnail:
              metadata.thumbnail ||
              null,

            description:
              metadata.description ||
              "",

            duration:
              metadata.duration ||
              null
          }
        : null,

    message:
      metadata
        ? "Đã lấy thông tin Douyin."
        : "Đã nhận diện liên kết Douyin."
  });
}

/*
====================================
FACEBOOK
====================================
*/

if (
  isFacebookUrl(url)
) {

  logStep(
    "📘 Nhận diện Facebook"
  );

  const metadata =
    await getFacebookMetadata(
      url
    );

  return res.json({

    success: true,

    platform:
      "Facebook",

    url,

    video:
      metadata
        ? {
            title:
              metadata.title ||
              "Không có tiêu đề",

            channel:
              metadata.channel ||
              "Không có thông tin",

            thumbnail:
              metadata.thumbnail ||
              null,

            description:
              metadata.description ||
              "",

            duration:
              metadata.duration ||
              null
          }
        : null,

    message:
      metadata
        ? "Đã lấy thông tin Facebook."
        : "Facebook không trả metadata công khai cho liên kết này."
  });
}

/*
====================================
KHÔNG HỖ TRỢ
====================================
*/

logStep(
  "❓ Liên kết chưa được hỗ trợ:",
  url
);

return res.status(400).json({

  success: false,

  message:
    "Liên kết này chưa được hỗ trợ."
});

}
);

/*

START SERVER

*/

app.listen(
PORT,
"0.0.0.0",
() => {

console.log(
  "========================================"
);

console.log(
  `🚀 My Video Tool backend đang chạy tại port ${PORT}`
);

console.log(
  "========================================"
);

}
);
