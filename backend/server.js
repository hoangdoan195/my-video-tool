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
HTTP
========================================
*/

async function fetchPage(url) {

  logStep("🌐 Đang truy cập:", url);

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",

    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const html =
    await response.text();

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
META
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

    const match =
      html.match(pattern);

    if (
      match &&
      match[1]
    ) {

      return decodeHtml(
        match[1].trim()
      );

    }

  }

  return "";
}

/*
========================================
HTML DECODE
========================================
*/

function decodeHtml(value) {

  return String(value)

    .replace(
      /&amp;/g,
      "&"
    )

    .replace(
      /&quot;/g,
      '"'
    )

    .replace(
      /&#39;/g,
      "'"
    )

    .replace(
      /&#x27;/gi,
      "'"
    )

    .replace(
      /&lt;/g,
      "<"
    )

    .replace(
      /&gt;/g,
      ">"
    )

    .replace(
      /&#x2F;/gi,
      "/"
    );
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
        .replace(
          /^www\./,
          ""
        );

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
      host.endsWith(
        ".youtube.com"
      )
    ) {

      const videoId =
        parsed.searchParams.get(
          "v"
        );

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
        .replace(
          /^www\./,
          ""
        );

    return (
      host === "tiktok.com" ||
      host.endsWith(
        ".tiktok.com"
      )
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
        .replace(
          /^www\./,
          ""
        );

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

    const response =
      await fetch(
        url,
        {
          method: "GET",
          redirect: "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    logStep(
      "🎵 TikTok URL cuối:",
      response.url
    );

    return (
      response.url ||
      null
    );

  } catch (error) {

    console.error(
      "❌ TikTok redirect error:",
      error.message
    );

    return null;

  }

}

/*
========================================
TIKTOK OEMBED
========================================
*/

async function getTikTokMetadata(url) {

  try {

    logStep(
      "🎵 Gọi TikTok oEmbed:",
      url
    );

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

    if (!response.ok) {

      return null;

    }

    const data =
      await response.json();

    logStep(
      "🎵 TikTok metadata:",
      JSON.stringify({
        title: data.title,
        author: data.author_name,
        thumbnail:
          data.thumbnail_url
      })
    );

    return {

      title:
        data.title || "",

      channel:
        data.author_name || "",

      thumbnail:
        data.thumbnail_url || "",

      duration:
        null

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
        .replace(
          /^www\./,
          ""
        );

    return (
      host === "douyin.com" ||
      host.endsWith(
        ".douyin.com"
      )
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
        .replace(
          /^www\./,
          ""
        );

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

    console.error(
      "❌ Douyin redirect error:",
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

    const title =
      getMeta(
        html,
        "og:title"
      ) ||
      getMeta(
        html,
        "twitter:title"
      );

    const thumbnail =
      getMeta(
        html,
        "og:image"
      ) ||
      getMeta(
        html,
        "twitter:image"
      );

    const description =
      getMeta(
        html,
        "og:description"
      );

    const author =
      getMeta(
        html,
        "author"
      );

    logStep(
      "🎵 Douyin metadata tìm được:",
      JSON.stringify({
        title,
        author,
        thumbnail
      })
    );

    return {

      title:
        title || "",

      channel:
        author || "",

      thumbnail:
        thumbnail || "",

      description:
        description || "",

      duration:
        null

    };

  } catch (error) {

    console.error(
      "❌ Douyin metadata error:",
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
        .replace(
          /^www\./,
          ""
        );

    return (
      host === "facebook.com" ||
      host === "fb.watch" ||
      host.endsWith(
        ".facebook.com"
      )
    );

  } catch {

    return false;

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

    const {
      response,
      html
    } =
      await fetchPage(url);

    if (!response.ok) {

      logStep(
        "❌ Facebook HTTP lỗi:",
        response.status
      );

      return null;

    }

    const title =
      getMeta(
        html,
        "og:title"
      );

    const description =
      getMeta(
        html,
        "og:description"
      );

    const thumbnail =
      getMeta(
        html,
        "og:image"
      ) ||
      getMeta(
        html,
        "twitter:image"
      );

    logStep(
      "📘 Facebook metadata:",
      JSON.stringify({
        title,
        thumbnail
      })
    );

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

        if (
          !response.ok
        ) {

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
                  null

              }
            : null,

        message:
          metadata
            ? "Đã lấy thông tin Facebook."
            : "Facebook không cho phép lấy metadata của liên kết này."

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
