import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection(
    'blog',
    ({ data }) => !data.draft
  );

  posts.sort(
    (a, b) =>
      new Date(b.data.pubDate).getTime() -
      new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: '0xwb7\'s blog',
    description: '공부하고 경험한 것들을 기록하는 곳입니다.',
    site: context.site,

    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/posts/${post.id}/`,
    })),

    customData: `<language>ko-KR</language>`,
  });
}
