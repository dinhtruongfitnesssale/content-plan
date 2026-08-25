import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Trang Tổng hợp đã gộp vào trang Nghiên cứu — ở đó tra cứu xong thì
      // tích chọn dẫn chứng, chọn nhiều phát hiện là ra bài gộp. Giữ chuyển
      // hướng vì đường dẫn cũ còn nằm trong dấu trang và lịch sử trình duyệt;
      // 308 để trình duyệt nhớ luôn, không hỏi lại.
      { source: "/tong-hop", destination: "/nghien-cuu", permanent: true },
    ];
  },
};

export default nextConfig;
