import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-info">
            <span className="company-name">FANS</span>
            <span className="separator">|</span>
            <span>Fast & AI News Service</span>
          </div>
          <div className="footer-links">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="/contact">문의하기</a>
          </div>
          <div className="footer-copyright">
            © 2025 FANS. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
