# app/models.py
from sqlalchemy import Column, Integer, BigInteger, String, Text, Float, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import TSVECTOR, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# 뉴스-키워드 관계 테이블 (Many-to-Many)
news_keywords_table = Table(
    'news_keywords',
    Base.metadata,
    Column('news_id', BigInteger, ForeignKey('news_articles.id', ondelete='CASCADE'), primary_key=True),
    Column('keyword_id', Integer, ForeignKey('keywords.id', ondelete='CASCADE'), primary_key=True),
    Column('relevance', Float, default=1.0)
)

class NewsArticle(Base):
    """뉴스 기사 모델"""
    __tablename__ = "news_articles"

    id = Column(BigInteger, primary_key=True, index=True)

    # 기본 정보
    title = Column(String(500), nullable=False, index=True)
    content = Column(Text)
    summary = Column(Text)  # 네이버 원본 요약
    ai_summary = Column(Text)  # AI 생성 요약
    short_ai_summary = Column(String(50))  # 20-30자 짧은 요약

    # URL 정보
    url = Column(String(1000), unique=True)  # 네이버 뉴스 URL
    origin_url = Column(String(1000))  # 원본 기사 URL

    # 미디어 URL들 (JSONB 형태)
    media_urls = Column(JSONB, default={"images": [], "videos": []})

    # 메타데이터
    source = Column(String(100), index=True)  # 언론사
    category = Column(String(50), index=True)  # 카테고리
    pub_date = Column(DateTime(timezone=True), index=True)  # 발행일
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 전문검색용
    search_vector = Column(TSVECTOR)

    # 관계
    keywords = relationship("Keyword", secondary=news_keywords_table, back_populates="articles")
    bookmarks = relationship("Bookmark", back_populates="article", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<NewsArticle(id={self.id}, title='{self.title[:50]}...')>"

class Keyword(Base):
    """키워드 모델"""
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(100), unique=True, nullable=False, index=True)
    frequency = Column(Integer, default=1, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계
    articles = relationship("NewsArticle", secondary=news_keywords_table, back_populates="keywords")

    def __repr__(self):
        return f"<Keyword(keyword='{self.keyword}', frequency={self.frequency})>"

class User(Base):
    """사용자 모델"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))

    # 관계
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(username='{self.username}')>"

class Bookmark(Base):
    """북마크 모델"""
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    news_id = Column(BigInteger, ForeignKey("news_articles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계
    user = relationship("User", back_populates="bookmarks")
    article = relationship("NewsArticle", back_populates="bookmarks")

    def __repr__(self):
        return f"<Bookmark(user_id={self.user_id}, news_id={self.news_id})>"