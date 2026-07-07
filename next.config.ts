import type { NextConfig } from "next";

// GitHub Pages(프로젝트 페이지)는 https://<user>.github.io/popfund 서브경로에서 서비스되므로
// 빌드 시 NEXT_PUBLIC_BASE_PATH=/popfund 를 주입한다. 로컬/루트 배포에서는 빈 값.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
};

export default nextConfig;
