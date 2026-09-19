const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
res.json({
success: true,
message: "My Video Tool backend đang hoạt động!"
});
});

app.post("/api/analyze", (req, res) => {

const url = req.body && req.body.url;

if (!url) {
return res.status(400).json({
success: false,
message: "Thiếu URL."
});
}

let platform = null;

try {

const hostname = new URL(url)
  .hostname
  .toLowerCase()
  .replace(/^www\./, "");


if (
  hostname === "youtube.com" ||
  hostname.endsWith(".youtube.com") ||
  hostname === "youtu.be"
) {
  platform = "YouTube";
}


else if (
  hostname === "tiktok.com" ||
  hostname.endsWith(".tiktok.com")
) {
  platform = "TikTok";
}


else if (
  hostname === "facebook.com" ||
  hostname.endsWith(".facebook.com") ||
  hostname === "fb.watch"
) {
  platform = "Facebook";
}


else if (
  hostname === "douyin.com" ||
  hostname.endsWith(".douyin.com") ||
  hostname === "iesdouyin.com" ||
  hostname.endsWith(".iesdouyin.com")
) {
  platform = "Douyin";
}

} catch (error) {

return res.status(400).json({
  success: false,
  message: "URL không hợp lệ."
});

}

if (!platform) {

return res.status(400).json({
  success: false,
  message: "Không nhận diện được nền tảng."
});

}

res.json({
success: true,
platform: platform,
url: url
});

});

app.listen(PORT, "0.0.0.0", () => {

console.log(
"My Video Tool backend đang chạy tại port ${PORT}"
);

});
