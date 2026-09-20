const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.use(cors());
app.use(express.json());

/*
========================================
TRANG KIỂM TRA
========================================
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "My Video Tool backend đang hoạt động!"
  });
});

/*
========================================
LOG
========================================
*/

function logStep(message, data = "") {
  console.log(
    `[My Video Tool] ${message}`,
    data
  );
}

/*
========================================
HTTP FETCH
========================================
*/

async function fetchPage(url, options = {}) {

  logStep("🌐 Đang truy cập:", url);

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",

    headers: {
      "User-Agent":
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

      "Cache-Control":
        "no-cache",

      ...(options.headers || {})
    }
  });

  const html = await response.text();

  logStep(
    `📄 HTTP ${response.status}`,
    `URL cuối: ${response.url}`
  );

  logStep(
    "📦 Kích thước HTML:",
    `${html.length} ký tự`
  );

  return {
    response,
    html
  };
}

/*
========================================
HTML DECODE
========================================
*/

function decodeHtml(value) {

  return String(value || "")

    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&nbsp;/g, " ");

}

/*
========================================
META TAG
========================================
*/

function getMeta(html, property) {

  if (!html) {
    return "";
  }

  const escaped =
    property.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

  const patterns = [

    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
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

      return decodeHtml(
        match[1].trim()
      );

    }

  }

  return "";
}

/*
========================================
JSON-LD
========================================
*/

function getJsonLd(html) {

  if (!html) {
    return [];
  }

  const results = [];

  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {

    try {

      const raw =
        match[1]
          .trim()
          .replace(
            /^\uFEFF/,
            ""
          );

      if (!raw) {
        continue;
      }

      const parsed =
        JSON.parse(raw);

      if (Array.isArray(parsed)) {

        results.push(...parsed);

      } else {

        results.push(parsed);

      }

    } catch {

      // JSON-LD không hợp lệ thì bỏ qua
    }

  }

  return results;
}

/*
========================================
TÌM VIDEO TRONG JSON-LD
========================================
*/

function getVideoFromJsonLd(html) {

  const data =
    getJsonLd(html);

  for (const item of data) {

    if (!item) {
      continue;
    }

    const type =
      Array.isArray(item["@type"])
        ? item["@type"].join(",")
        : String(item["@type"] || "");

    if (
      type.toLowerCase().includes("video")
    ) {

      return item;

    }

  }

  return null;
}

/*
========================================
VIDEO DURATION
========================================
*/

function normalizeDuration(value) {

  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  /*
  ISO 8601:
  PT1M32S
  PT45S
  PT1H2M3S
  */

  if (/^PT/i.test(text)) {
    return text;
  }

  /*
  Một số trang trả:
  01:32
  1:32
  01:02:03
  */

  if (
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(text)
  ) {

    const parts =
      text.split(":");

    if (parts.length === 2) {

      const minutes =
        Number(parts[0]);

      const seconds =
        Number(parts[1]);

      return (
        "PT" +
        (minutes > 0
          ? minutes + "M"
          : "") +
        (seconds > 0
          ? seconds + "S"
          : "")
      );

    }

    if (parts.length === 3) {

      const hours =
        Number(parts[0]);

      const minutes =
        Number(parts[1]);

      const seconds =
        Number(parts[2]);

      return (
        "PT" +
        (hours > 0
          ? hours + "H"
          : "") +
        (minutes > 0
          ? minutes + "M"
          : "") +
        (seconds > 0
          ? seconds + "S"
          : "")
      );

    }

  }

  return text;
}

/*
========================================
TRÍCH VIDEO DURATION TỪ HTML
========================================
*/

function extractDurationFromHtml(html) {

  if (!html) {
    return null;
  }

  const patterns = [

    /"duration"\s*:\s*"([^"]+)"/i,

    /"duration"\s*:\s*(\d+)/i,

    /"video_duration"\s*:\s*(\d+)/i,

    /"durationMillis"\s*:\s*(\d+)/i,

    /"duration_ms"\s*:\s*(\d+)/i,

    /"durationMs"\s*:\s*(\d+)/i

  ];

  for (const pattern of patterns) {

    const match =
      html.match(pattern);

    if (!match) {
      continue;
    }

    const value =
      match[1];

    /*
    Nếu đã là ISO hoặc 01:32
    */

    if (
      /^PT/i.test(value) ||
      /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)
    ) {

      return normalizeDuration(value);

    }

    /*
    Nếu là số:
    TikTok/Douyin thường có thể dùng
    milliseconds hoặc seconds.
    */

    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {

      let seconds =
        number;

      /*
      Số lớn thường là milliseconds.
      */

      if (seconds > 10000) {
        seconds =
          Math.round(
            seconds / 1000
          );
      }

      const hours =
        Math.floor(
          seconds / 3600
        );

      const minutes =
        Math.floor(
          (seconds % 3600) / 60
        );

      const secs =
        Math.floor(
          seconds % 60
        );

      if (hours > 0) {

        return (
          `PT${hours}H` +
          (minutes
            ? `${minutes}M`
            : "") +
          (secs
            ? `${secs}S`
            : "")
        );

      }

      return (
        `PT` +
        (minutes
          ? `${minutes}M`
          : "") +
        (secs
          ? `${secs}S`
          : "")
      );

    }

  }

  return null;
}

/*
========================================
THUMBNAIL URL
========================================
*/

function getThumbnailFromJsonLd(video) {

  if (!video) {
    return "";
  }

  const image =
    video.thumbnailUrl ||
    video.thumbnail ||
    video.image;

  if (Array.isArray(image)) {
    return image[0] || "";
  }

  if (
    image &&
    typeof image === "object"
  ) {

    return (
      image.url ||
      image.contentUrl ||
      ""
    );

  }

  return image || "";
}

/*
========================================
YOUTUBE
========================================
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
========================================
TIKTOK
========================================
*/

function isTikTokUrl(url) {

  try {

    const host =
      new URL(url)
        .hostname
        .toLowerCase()
        .replace(/^www\./, "");

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
        .replace(/^www\./, "");

    return (
      host === "vt.tiktok.com" ||
      host === "vm.tiktok.com"
    );

  } catch {

    return false;

  }

}

/*
========================================
TIKTOK REDIRECT
========================================
*/

async function resolveTikTokUrl(url) {

  try {

    logStep(
      "🎵 TikTok short URL:",
      url
    );

    const result =
      await fetchPage(url);

    logStep(
      "🎵 TikTok URL cuối:",
      result.response.url
    );

    return (
      result.response.url ||
      url
    );

  } catch (error) {

    logStep(
      "❌ TikTok redirect lỗi:",
      error.message
    );

    return null;

  }

}

/*
========================================
TIKTOK HTML METADATA
========================================
*/

async function getTikTokMetadata(url) {

  try {

    logStep(
      "🎵 Đang lấy TikTok metadata:",
      url
    );

    /*
    ------------------------------------
    Thử oEmbed trước
    ------------------------------------
    */

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

      logStep(
        "🎵 TikTok oEmbed HTTP:",
        response.status
      );

      if (response.ok) {

        const data =
          await response.json();

        const result = {

          title:
            data.title || "",

          channel:
            data.author_name || "",

          thumbnail:
            data.thumbnail_url || "",

          duration:
            null

        };

        /*
        --------------------------------
        oEmbed không có duration.
        Lấy thêm HTML để tìm duration.
        --------------------------------
        */

        const page =
          await fetchPage(url);

        const jsonVideo =
          getVideoFromJsonLd(
            page.html
          );

        const htmlDuration =
          extractDurationFromHtml(
            page.html
          );

        result.duration =
          normalizeDuration(
            jsonVideo?.duration ||
            htmlDuration
          );

        /*
        Nếu oEmbed thiếu title/thumbnail
        thì lấy OpenGraph.
        */

        if (!result.title) {

          result.title =
            getMeta(
              page.html,
              "og:title"
            );

        }

        if (!result.thumbnail) {

          result.thumbnail =
            getMeta(
              page.html,
              "og:image"
            ) ||
            getMeta(
              page.html,
              "twitter:image"
            );

        }

        if (!result.channel) {

          result.channel =
            getMeta(
              page.html,
              "author"
            );

        }

        logStep(
          "🎵 TikTok metadata cuối:",
          JSON.stringify(result)
        );

        return result;

      }

    } catch (error) {

      logStep(
        "⚠️ TikTok oEmbed lỗi:",
        error.message
      );

    }

    /*
    ------------------------------------
    Fallback HTML
    ------------------------------------
    */

    const page =
      await fetchPage(url);

    if (!page.response.ok) {

      return null;

    }

    const jsonVideo =
      getVideoFromJsonLd(
        page.html
      );

    const title =
      getMeta(
        page.html,
        "og:title"
      ) ||
      jsonVideo?.name ||
      "";

    const thumbnail =
      getMeta(
        page.html,
        "og:image"
      ) ||
      getMeta(
        page.html,
        "twitter:image"
      ) ||
      getThumbnailFromJsonLd(
        jsonVideo
      );

    const author =
      getMeta(
        page.html,
        "author"
      ) ||
      jsonVideo?.author?.name ||
      "";

    const duration =
      normalizeDuration(
        jsonVideo?.duration
      ) ||
      extractDurationFromHtml(
        page.html
      );

    const result = {

      title,
      channel: author,
      thumbnail,
      duration:
        duration || null

    };

    logStep(
      "🎵 TikTok fallback metadata:",
      JSON.stringify(result)
    );

    return result;

  } catch (error) {

    logStep(
      "❌ TikTok metadata lỗi:",
      error.message
    );

    return null;

  }

}

/*
========================================
DOUYIN
========================================
*/

function isDouyinUrl(url) {

  try {

    const host =
      new URL(url)
        .hostname
        .toLowerCase()
        .replace(/^www\./, "");

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
        .replace(/^www\./, "");

    return (
      host === "v.douyin.com"
    );

  } catch {

    return false;

  }

}

/*
========================================
DOUYIN REDIRECT
========================================
*/

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

    logStep(
      "❌ Douyin redirect lỗi:",
      error.message
    );

    return url;

  }

}

/*
========================================
DOUYIN METADATA
========================================
*/

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

    /*
    ------------------------------------
    1. OpenGraph
    ------------------------------------
    */

    let title =
      getMeta(
        html,
        "og:title"
      ) ||
      getMeta(
        html,
        "twitter:title"
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

    let description =
      getMeta(
        html,
        "og:description"
      );

    let author =
      getMeta(
        html,
        "author"
      );

    /*
    ------------------------------------
    2. JSON-LD
    ------------------------------------
    */

    const jsonVideo =
      getVideoFromJsonLd(
        html
      );

    if (!title) {

      title =
        jsonVideo?.name ||
        "";

    }

    if (!thumbnail) {

      thumbnail =
        getThumbnailFromJsonLd(
          jsonVideo
        );

    }

    if (!author) {

      if (
        jsonVideo?.author
      ) {

        if (
          typeof jsonVideo.author ===
          "string"
        ) {

          author =
            jsonVideo.author;

        } else {

          author =
            jsonVideo.author.name ||
            "";

        }

      }

    }

    /*
    ------------------------------------
    3. Duration
    ------------------------------------
    */

    const duration =
      normalizeDuration(
        jsonVideo?.duration
      ) ||
      extractDurationFromHtml(
        html
      );

    /*
    ------------------------------------
    4. Tìm dữ liệu Douyin trong HTML
    ------------------------------------
    */

    if (
      !title ||
      !thumbnail ||
      !author
    ) {

      /*
      Một số trang Douyin nhúng
      JSON với các key như:
      desc / nickname / cover / dynamicCover
      */

      const descMatch =
        html.match(
          /"desc"\s*:\s*"([^"]*)"/i
        );

      const nicknameMatch =
        html.match(
          /"nickname"\s*:\s*"([^"]*)"/i
        );

      const coverMatch =
        html.match(
          /"(?:cover|originCover|dynamicCover)"\s*:\s*"([^"]+)"/i
        );

      if (!title && descMatch) {

        title =
          decodeHtml(
            descMatch[1]
          );

      }

      if (!author && nicknameMatch) {

        author =
          decodeHtml(
            nicknameMatch[1]
          );

      }

      if (
        !thumbnail &&
        coverMatch
      ) {

        thumbnail =
          decodeHtml(
            coverMatch[1]
          );

      }

    }

    const result = {

      title:
        title || "",

      channel:
        author || "",

      thumbnail:
        thumbnail || "",

      description:
        description || "",

      duration:
        duration || null

    };

    logStep(
      "🎵 Douyin metadata cuối:",
      JSON.stringify(result)
    );

    return result;

  } catch (error) {

    logStep(
      "❌ Douyin metadata lỗi:",
      error.message
    );

    return null;

  }

}

/*
========================================
FACEBOOK
========================================
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

/*
========================================
FACEBOOK URL RESOLVE
========================================
*/

async function resolveFacebookUrl(url) {

  try {

    logStep(
      "📘 Đang resolve Facebook URL:",
      url
    );

    /*
    Thử HEAD trước
    */

    try {

      const head =
        await fetch(
          url,
          {
            method: "HEAD",
            redirect: "follow",
            headers: {
              "User-Agent":
                "Mozilla/5.0"
            }
          }
        );

      logStep(
        "📘 Facebook HEAD:",
        `HTTP ${head.status} -> ${head.url}`
      );

      if (
        head.url &&
        head.url !== url
      ) {

        return head.url;

      }

    } catch (error) {

      logStep(
        "⚠️ Facebook HEAD lỗi:",
        error.message
      );

    }

    /*
    Thử GET
    */

    const result =
      await fetchPage(url);

    if (
      result.response.url
    ) {

      logStep(
        "📘 Facebook URL cuối:",
        result.response.url
      );

      return result.response.url;

    }

    return url;

  } catch (error) {

    logStep(
      "❌ Facebook resolve lỗi:",
      error.message
    );

    return url;

  }

}

/*
========================================
FACEBOOK METADATA
========================================
*/

async function getFacebookMetadata(url) {

  try {

    logStep(
      "📘 Đang lấy Facebook metadata:",
      url
    );

    /*
    ------------------------------------
    Resolve share URL trước
    ------------------------------------
    */

    const resolvedUrl =
      await resolveFacebookUrl(
        url
      );

    logStep(
      "📘 Facebook URL dùng để lấy metadata:",
      resolvedUrl
    );

    const page =
      await fetchPage(
        resolvedUrl
      );

    const {
      response,
      html
    } = page;

    /*
    ------------------------------------
    Nếu Facebook trả 400/403
    ------------------------------------
    */

    if (
      !response.ok
    ) {

      logStep(
        "⚠️ Facebook HTTP không OK:",
        response.status
      );

      /*
      Vẫn thử lấy metadata từ HTML.
      */

    }

    /*
    ------------------------------------
    OpenGraph
    ------------------------------------
    */

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

    /*
    ------------------------------------
    JSON-LD
    ------------------------------------
    */

    const jsonVideo =
      getVideoFromJsonLd(
        html
      );

    if (!title) {

      title =
        jsonVideo?.name ||
        "";

    }

    if (!thumbnail) {

      thumbnail =
        getThumbnailFromJsonLd(
          jsonVideo
        );

    }

    /*
    ------------------------------------
    Duration
    ------------------------------------
    */

    const duration =
      normalizeDuration(
        jsonVideo?.duration
      ) ||
      extractDurationFromHtml(
        html
      );

    const result = {

      title:
        title || "",

      channel:
        "",

      thumbnail:
        thumbnail || "",

      description:
        description || "",

      duration:
        duration || null,

      resolvedUrl:
        resolvedUrl

    };

    logStep(
      "📘 Facebook metadata cuối:",
      JSON.stringify({
        title: result.title,
        thumbnail: result.thumbnail,
        duration: result.duration,
        resolvedUrl: result.resolvedUrl
      })
    );

    /*
    Nếu hoàn toàn không có dữ liệu
    */

    if (
      !result.title &&
      !result.thumbnail &&
      !result.description
    ) {

      return null;

    }

    return result;

  } catch (error) {

    logStep(
      "❌ Facebook metadata lỗi:",
      error.message
    );

    return null;

  }

}

/*
========================================
API ANALYZE
========================================
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

          url:
            url,

          video:
            null,

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
    TIKTOK ĐẦY ĐỦ
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

        url:
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

        url:
          metadata?.resolvedUrl ||
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
            ? "Đã lấy thông tin Facebook."
            : "Facebook không cung cấp metadata công khai cho liên kết này."

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
========================================
START SERVER
========================================
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
