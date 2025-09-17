// src/components/SocialLogin.js
import React, { useState, useMemo } from "react";
import "./SocialLogin.css";

const SocialLogin = ({ type = "login" }) => {
  const [loading, setLoading] = useState(false);

  // 프록시/환경마다 다를 수 있으니 .env 지원
  const API_BASE = useMemo(
    () => process.env.REACT_APP_API_BASE || "http://192.168.0.3:3000",
    []
  );

  const go = (path) => {
    setLoading(true);
    // 반드시 백엔드 포트(3000)로 전체 URL 이동
    window.location.assign(`${API_BASE}${path}`);
  };

  return (
    <div className="social-login">
      <div className="social-divider"><span>또는</span></div>

      <div className="social-buttons">
        <button className="social-button kakao" onClick={() => go("/api/auth/kakao")} disabled={loading}>
          <span>{loading ? "처리 중..." : `카카오로 ${type === "login" ? "로그인" : "회원가입"}`}</span>
        </button>

        <button className="social-button naver" onClick={() => go("/api/auth/naver")} disabled={loading}>
          <span>{loading ? "처리 중..." : `네이버로 ${type === "login" ? "로그인" : "회원가입"}`}</span>
        </button>
      </div>
    </div>
  );
};

export default SocialLogin;
