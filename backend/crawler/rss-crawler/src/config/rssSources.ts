interface RSSFeed {
  sourceName: string;
  feedUrl: string;
  sourceId: number;
}

export const RSS_FEEDS: RSSFeed[] = [
  {
    sourceName: '경향신문',
    feedUrl: 'https://www.khan.co.kr/rss/rssdata/total_news.xml',
    sourceId: 32
  },
  {
    sourceName: '동아일보',
    feedUrl: 'https://rss.donga.com/total.xml',
    sourceId: 20
  },
  {
    sourceName: '한겨레',
    feedUrl: 'https://www.hani.co.kr/rss/',
    sourceId: 28
  },
  {
    sourceName: '조선일보',
    feedUrl: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
    sourceId: 23
  }
];

export { RSSFeed };