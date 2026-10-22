const WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const WIKIMEDIA_HOST = "upload.wikimedia.org";

export async function fetchItemImage(item, fetcher = fetch) {
  const pageTitle = item.image_page || item.name;
  const response = await fetcher(`${WIKIPEDIA_API}${encodeURIComponent(pageTitle)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;

  const summary = await response.json();
  const imageUrl = summary.thumbnail?.source ?? summary.originalimage?.source;
  if (!imageUrl) return null;

  let image;
  try {
    image = new URL(imageUrl);
  } catch {
    return null;
  }
  if (image.protocol !== "https:" || image.hostname !== WIKIMEDIA_HOST) return null;

  const pageUrl = summary.content_urls?.desktop?.page;
  if (
    typeof pageUrl !== "string" ||
    !pageUrl.startsWith("https://en.wikipedia.org/wiki/")
  ) {
    return null;
  }
  return { src: image.href, pageUrl, alt: item.name };
}
