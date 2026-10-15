/**
 * Cached entry points used by pages. Each function is a `'use cache'` scope
 * tagged "content" so admin actions can call updateTag("content") /
 * revalidateTag("content") after publishing. Search queries (free text) are NOT
 * cached, so arbitrary visitor input cannot grow the cache.
 */
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";
import * as q from "./queries";

export async function getHomeDataCached() {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.getHomeData(getDb());
}

async function listContentCached(params: q.ListParams) {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.listContent(getDb(), params);
}

export async function listContentPublic(params: q.ListParams) {
  return params.q ? q.listContent(getDb(), params) : listContentCached(params);
}

export async function getContentBySlugCached(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.getContentBySlug(getDb(), slug);
}

export async function listCategoryTreeCached() {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.listCategoryTree(getDb());
}

export async function getCategoryBySlugCached(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.getCategoryBySlug(getDb(), slug);
}

export async function listActiveTypesCached() {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  return q.listActiveTypes(getDb());
}

export async function getPublishedPageCached(key: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "pages");
  return q.getPublishedPage(getDb(), key);
}

export async function listPublishedPageLinksCached() {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "pages");
  return q.listPublishedPageLinks(getDb());
}