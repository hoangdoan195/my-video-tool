const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
function detectPlatform(url) {
try {
const hostname = new URL(url)
.hostname
.toLowerCase()
.replace(/^www./, "");
￼
} catch (error) {
return null;
}
}
/*
API kiểm tra
*/
app.get("/", (req, res) => {
res.json({
success: true,
message: "My Video Tool backend đang hoạt động."
});
});
/*
API phân tích URL
*/
app.post("/api/analyze", (req, res) => {
const { url } = req.body || {};
if (!url) {
return res.status(400).json({
success: false,
message: "Thiếu URL."
});
}
const platform = detectPlatform(url);
if (!platform) {
return res.status(400).json({
success: false,
message: "Không nhận diện được nền tảng."
});
}
return res.json({
success: true,
platform: platform,
url: url
});
});
app.listen(PORT, () => {
console.log(
My Video Tool backend đang chạy tại port ${PORT}
);
});
