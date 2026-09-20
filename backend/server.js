const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/*
========================================
YT-DLP
========================================
*/

const youtubedl = require("youtube-dl-exec");

/*
========================================
LOG
========================================
*/

function logStep(message, data = "") {
  if (data !== "") {
    console.log(`[My Video Tool] ${message}`, data);
  } else {
    console.log(`[My Video Tool] ${message}`);
  }
}

/*
========================================
TRANG KIỂM TRA
========================================
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "My Video Tool backend đang hoạt động!",
    version: "2.0.0"
  });
});

/*
========================================
HEALTH
========================================
*/

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok"
  });
});

/*
========================================
KIỂM TRA URL
========================================
*/

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

/*
========================================
NỀN TẢNG
========================================
*/

function detectPlatform(url) {
  try {
    const host = new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    ) {
      return "YouTube";
    }

    if (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com")
    ) {
      return "TikTok";
    }

    if (
      host === "douyin.com" ||
      host.endsWith(".douyin.com")
    ) {
      return "Douyin";
    }

    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch"
    ) {
      return "Facebook";
    }

    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    ) {
      return "Instagram";
    }

    return "Video";
  } catch {
    return "Video";
  }
}

/*
========================================
FORMAT DURATION
========================================
*/

function normalizeDuration(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number);
}

/*
========================================
FORMAT BYTES
========================================
*/

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/*
========================================
CHỌN FORMAT VIDEO
========================================
*/

function buildVideoFormats(info) {
  const formats = Array.isArray(info.formats)
    ? info.formats
    : [];

  const result = [];

  /*
  ========================================
  VIDEO + AUDIO
  ========================================
  */

  const progressive = formats
    .filter((format) => {
      const hasVideo =
        format.vcodec &&
        format.vcodec !== "none";

      const hasAudio =
        format.acodec &&
        format.acodec !== "none";

      return hasVideo && hasAudio;
    })
    .filter((format) => {
      return (
        format.ext === "mp4" ||
        format.ext === "webm" ||
        format.ext === "mkv"
      );
    });

  /*
  Ưu tiên MP4.
  */

  const mp4 = progressive
    .filter((format) => format.ext === "mp4")
    .sort((a, b) => {
      return (
        Number(b.height || 0) -
        Number(a.height || 0)
      );
    });

  /*
  Chỉ lấy các độ phân giải hữu ích.
  */

  const wantedHeights = [
    360,
    480,
    720,
    1080,
    1440,
    2160
  ];

  const addedHeights = new Set();

  for (const format of mp4) {
    const height =
      Number(format.height || 0);

    if (!height) {
      continue;
    }

    if (!wantedHeights.includes(height)) {
      continue;
    }

    if (addedHeights.has(height)) {
      continue;
    }

    if (!format.url) {
      continue;
    }

    addedHeights.add(height);

    result.push({
      id: `mp4-${height}`,
      type: "video",
      ext: "mp4",
      label:
        height >= 1080
          ? `MP4 ${height}p`
          : `MP4 ${height}p`,
      quality: `${height}p`,
      width: Number(format.width || 0),
      height,
      filesize:
        format.filesize ||
        format.filesize_approx ||
        null,
      filesizeText:
        format.filesize ||
        format.filesize_approx
          ? formatBytes(
              format.filesize ||
              format.filesize_approx
            )
          : "",
      url: format.url
    });
  }

  /*
  ========================================
  NẾU KHÔNG CÓ PROGRESSIVE MP4
  ========================================
  */

  if (result.length === 0) {
    const fallback = formats
      .filter((format) => {
        return (
          format.ext === "mp4" &&
          format.vcodec &&
          format.vcodec !== "none" &&
          format.url
        );
      })
      .sort((a, b) => {
        return (
          Number(b.height || 0) -
          Number(a.height || 0)
        );
      });

    for (const format of fallback) {
      const height =
        Number(format.height || 0);

      if (!height) {
        continue;
      }

      if (result.some(
        (item) => item.height === height
      )) {
        continue;
      }

      result.push({
        id: `mp4-${height}`,
        type: "video",
        ext: "mp4",
        label: `MP4 ${height}p`,
        quality: `${height}p`,
        width: Number(format.width || 0),
        height,
        filesize:
          format.filesize ||
          format.filesize_approx ||
          null,
        filesizeText:
          format.filesize ||
          format.filesize_approx
            ? formatBytes(
                format.filesize ||
                format.filesize_approx
              )
            : "",
        url: format.url
      });

      if (result.length >= 6) {
        break;
      }
    }
  }

  return result;
}

/*
========================================
AUDIO FORMATS
========================================
*/

function buildAudioFormats(info) {
  const formats = Array.isArray(info.formats)
    ? info.formats
    : [];

  const audio = formats
    .filter((format) => {
      return (
        format.acodec &&
        format.acodec !== "none" &&
        format.vcodec === "none" &&
        format.url
      );
    })
    .sort((a, b) => {
      return (
        Number(b.abr || 0) -
        Number(a.abr || 0)
      );
    });

  if (audio.length === 0) {
    return [];
  }

  const best =
    audio[0];

  /*
  ========================================
  LƯU Ý:
  ========================================

  URL này là audio stream gốc.
  Có thể là m4a/webm chứ chưa chắc là MP3.

  Chúng ta sẽ làm bước chuyển MP3
  bằng FFmpeg ở bước kế tiếp.
  */

  return [
    {
      id: "audio-best",
      type: "audio",
      ext: best.ext || "m4a",
      label: "Audio",
      quality:
        best.abr
          ? `${Math.round(best.abr)} kbps`
          : "Best",
      bitrate:
        best.abr || null,
      filesize:
        best.filesize ||
        best.filesize_approx ||
        null,
      filesizeText:
        best.filesize ||
        best.filesize_approx
          ? formatBytes(
              best.filesize ||
              best.filesize_approx
            )
          : "",
      url: best.url
    }
  ];
}

/*
========================================
LẤY THÔNG TIN BẰNG YT-DLP
========================================
*/

async function getVideoInfo(url) {
  logStep(
    "🔎 Đang phân tích bằng yt-dlp:",
    url
  );

  const result = await youtubedl(
    url,
    {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      skipDownload: true,
      noPlaylist: true
    },
    {
      timeout: 120000
    }
  );

  return result;
}

/*
========================================
FORMAT KẾT QUẢ
========================================
*/

function buildResponse(info, originalUrl) {
  const platform =
    detectPlatform(originalUrl);

  const title =
    info.title ||
    "Không có tiêu đề";

  const channel =
    info.channel ||
    info.uploader ||
    info.creator ||
    "Không có thông tin";

  const thumbnail =
    info.thumbnail ||
    null;

  const duration =
    normalizeDuration(
      info.duration
    );

  const videoFormats =
    buildVideoFormats(info);

  const audioFormats =
    buildAudioFormats(info);

  return {
    success: true,

    platform,

    url:
      info.webpage_url ||
      originalUrl,

    video: {
      id:
        info.id ||
        null,

      title,

      channel,

      author:
        info.uploader ||
        info.creator ||
        channel,

      thumbnail,

      description:
        info.description ||
        "",

      duration
    },

    formats: [
      ...videoFormats,
      ...audioFormats
    ],

    formatCount:
      videoFormats.length +
      audioFormats.length,

    message:
      "Đã phân tích video."
  };
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

    const originalUrl =
      req.body?.url;

    console.log(
      "URL:",
      originalUrl
    );

    console.log(
      "========================================"
    );

    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message:
          "Thiếu URL."
      });
    }

    const url =
      String(originalUrl).trim();

    if (!isValidHttpUrl(url)) {
      return res.status(400).json({
        success: false,
        message:
          "URL không hợp lệ."
      });
    }

    try {
      const info =
        await getVideoInfo(url);

      if (!info) {
        return res.status(404).json({
          success: false,
          message:
            "Không lấy được thông tin video."
        });
      }

      const result =
        buildResponse(
          info,
          url
        );

      logStep(
        "✅ Phân tích thành công:",
        JSON.stringify({
          platform:
            result.platform,

          title:
            result.video.title,

          duration:
            result.video.duration,

          formats:
            result.formats.length
        })
      );

      return res.json(result);

    } catch (error) {
      console.error(
        "❌ yt-dlp ERROR:",
        error
      );

      let message =
        "Không thể phân tích video.";

      const errorText =
        String(
          error?.stderr ||
          error?.message ||
          ""
        );

      if (
        /unsupported|not supported/i.test(
          errorText
        )
      ) {
        message =
          "Nền tảng hoặc liên kết này chưa được hỗ trợ.";
      }

      if (
        /private|login|sign in/i.test(
          errorText
        )
      ) {
        message =
          "Video riêng tư hoặc yêu cầu đăng nhập.";
      }

      if (
        /not found|unavailable/i.test(
          errorText
        )
      ) {
        message =
          "Không tìm thấy video hoặc video không còn khả dụng.";
      }

      return res.status(500).json({
        success: false,
        message,
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : errorText
      });
    }
  }
);

/*
========================================
API LẤY FORMAT
========================================
*/

app.post(
  "/api/formats",
  async (req, res) => {
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
      String(originalUrl).trim();

    if (!isValidHttpUrl(url)) {
      return res.status(400).json({
        success: false,
        message:
          "URL không hợp lệ."
      });
    }

    try {
      const info =
        await getVideoInfo(url);

      const result =
        buildResponse(
          info,
          url
        );

      return res.json({
        success: true,
        platform:
          result.platform,
        url:
          result.url,
        formats:
          result.formats
      });

    } catch (error) {
      console.error(
        "❌ formats ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Không lấy được danh sách định dạng.",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message
      });
    }
  }
);

/*
========================================
API REDIRECT DOWNLOAD
========================================

Cho phép frontend yêu cầu một format
đã lấy từ chính backend.

Không nhận URL tùy ý từ frontend
để tránh biến endpoint thành
proxy mở.
========================================
*/

app.get(
  "/api/download",
  async (req, res) => {
    const url =
      String(
        req.query?.url || ""
      ).trim();

    const filename =
      String(
        req.query?.filename ||
        "video"
      )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    if (!url) {
      return res.status(400).send(
        "Thiếu URL tải xuống."
      );
    }

    if (!isValidHttpUrl(url)) {
      return res.status(400).send(
        "URL không hợp lệ."
      );
    }

    try {
      logStep(
        "⬇️ Redirect download:",
        url
      );

      /*
      Redirect tới stream URL.
      */

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      return res.redirect(url);

    } catch (error) {
      console.error(
        "❌ Download ERROR:",
        error
      );

      return res.status(500).send(
        "Không thể tải video."
      );
    }
  }
);

/*
========================================
ERROR HANDLER
========================================
*/

app.use(
  (error, req, res, next) => {
    console.error(
      "❌ SERVER ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message:
        "Lỗi máy chủ."
    });
  }
);

/*
========================================
START
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
      "📦 yt-dlp downloader: READY"
    );

    console.log(
      "========================================"
    );
  }
);
