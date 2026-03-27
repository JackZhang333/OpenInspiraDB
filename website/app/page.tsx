"use client";

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    // 立即重定向到英文版本
    if (typeof window !== "undefined") {
      window.location.replace("/en/");
    }
  }, []);

  // 返回一个加载状态或空内容
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontFamily: "system-ui, sans-serif"
    }}>
      <p>Loading...</p>
    </div>
  );
}
