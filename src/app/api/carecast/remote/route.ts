/**
 * CareCastTV 远程配置拉取代理
 *
 * 老人端通过本接口轮询 GitHub 仓库中的 carecast.json 配置文件。
 * 走服务端代理的原因：
 * 1. 规避浏览器 CORS 限制（github.com blob 页面无 CORS 头）
 * 2. 私有仓库 token 不必暴露在页面请求的 URL 中（通过请求头传递）
 * 3. 统一做 host 白名单校验，防止被当作开放代理滥用
 *
 * 维护者：DimLoong
 */
import { NextRequest, NextResponse } from 'next/server';

import { careRemoteFileSchema } from '@/lib/carecast.types';

export const runtime = 'nodejs';

// 仅允许 GitHub 相关域名，防止 SSRF / 开放代理
const ALLOWED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'api.github.com',
  'github.com',
]);

/**
 * 规范化配置文件地址：
 * 将 github.com 的 blob 页面地址转换为 raw 直链，其余地址原样返回。
 * 例：https://github.com/u/r/blob/main/carecast.json
 *  -> https://raw.githubusercontent.com/u/r/main/carecast.json
 */
function normalizeGithubUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    // /user/repo/blob/branch/path... 或 /user/repo/raw/branch/path...
    if (parts.length >= 5 && (parts[2] === 'blob' || parts[2] === 'raw')) {
      const [user, repo, , branch, ...path] = parts;
      return new URL(
        `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path.join('/')}`,
      );
    }
  }
  return url;
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
  }

  let url: URL;
  try {
    url = normalizeGithubUrl(targetUrl);
  } catch {
    return NextResponse.json({ error: 'url 格式不合法' }, { status: 400 });
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return NextResponse.json(
      { error: '仅支持 GitHub 域名下的配置文件地址' },
      { status: 400 },
    );
  }

  // 私有仓库 token 通过自定义请求头传入，不落在 URL/日志里
  const token = request.headers.get('x-care-token') || '';

  try {
    const headers: Record<string, string> = {
      // GitHub raw 返回 text/plain，Accept 兼容 raw 与 API 两种形式
      Accept: 'application/vnd.github.raw+json, application/json, text/plain',
      'User-Agent': 'CareCastTV',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const upstream = await fetch(url.toString(), {
      headers,
      // 每次轮询都要拿最新内容
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `远程返回 ${upstream.status}` },
        { status: 502 },
      );
    }

    const text = await upstream.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: '远程文件不是合法 JSON' },
        { status: 502 },
      );
    }

    const parsed = careRemoteFileSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `配置文件结构不合法: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { data: parsed.data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json(
      { error: `拉取远程配置失败: ${message}` },
      { status: 502 },
    );
  }
}
