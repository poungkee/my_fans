interface RSSFeed {
  sourceName: string;
  feedUrl: string;
  sourceId: number;
}

export const RSS_FEEDS: RSSFeed[] = [
  {
    sourceName: '경향신문',
    feedUrl: 'https://www.khan.co.kr/rss/rssdata/total_news.xml',
    sourceId: 8
  },
  {
    sourceName: '동아일보',
    feedUrl: 'https://rss.donga.com/total.xml',
    sourceId: 2
  },
  {
    sourceName: '한겨레',
    feedUrl: 'https://www.hani.co.kr/rss/',
    sourceId: 7
  },
  {
    sourceName: '조선일보',
    feedUrl: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
    sourceId: 5
  }
];

export { RSSFeed };