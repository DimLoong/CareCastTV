/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie, verifyApiAuth } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { RecentlyViewed } from '@/lib/types';

export const runtime = 'nodejs';

// 辅助函数：验证用户并获取用户名
async function validateAndGetUsername(
  request: NextRequest,
): Promise<{ username: string } | { error: string; status: number }> {
  const authResult = verifyApiAuth(request);
  if (!authResult.isValid) {
    return { error: 'Unauthorized', status: 401 };
  }

  const authInfo = getAuthInfoFromCookie(request);
  const username =
    authInfo?.username || (authResult.isLocalMode ? '__local__' : '');

  if (!username) {
    return { error: 'Unauthorized', status: 401 };
  }

  // 非本地模式时检查用户权限
  if (!authResult.isLocalMode) {
    const config = await getConfig();
    if (username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (!user) {
        return { error: '用户不存在', status: 401 };
      }
      if (user.banned) {
        return { error: '用户已被封禁', status: 401 };
      }
    }
  }

  return { username };
}

/**
 * GET /api/recentlyviewed
 *
 * 支持两种调用方式：
 * 1. 不带 query，返回全部最近浏览列表（Record<string, RecentlyViewed>）。
 * 2. 带 key=source+id，返回单条记录（RecentlyViewed | null）。
 */
export async function GET(request: NextRequest) {
  try {
    const result = await validateAndGetUsername(request);
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const { username } = result;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json(
          { error: 'Invalid key format' },
          { status: 400 },
        );
      }
      const item = await db.getRecentlyViewed(username, source, id);
      return NextResponse.json(item, { status: 200 });
    }

    const all = await db.getAllRecentlyViewed(username);
    return NextResponse.json(all, { status: 200 });
  } catch (err) {
    console.error('获取最近浏览失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/recentlyviewed
 * body: { key: string; item: RecentlyViewed }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await validateAndGetUsername(request);
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const { username } = result;

    const body = await request.json();
    const { key, item }: { key: string; item: RecentlyViewed } = body;

    if (!key || !item) {
      return NextResponse.json(
        { error: 'Missing key or item' },
        { status: 400 },
      );
    }

    if (!item.title || !item.source_name) {
      return NextResponse.json(
        { error: 'Invalid recently-viewed data' },
        { status: 400 },
      );
    }

    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json(
        { error: 'Invalid key format' },
        { status: 400 },
      );
    }

    const finalItem = {
      ...item,
      save_time: item.save_time ?? Date.now(),
    } as RecentlyViewed;

    await db.saveRecentlyViewed(username, source, id, finalItem);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('保存最近浏览失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recentlyviewed
 *
 * 1. 不带 query -> 清空全部最近浏览
 * 2. 带 key=source+id -> 删除单条记录
 * 3. 带 keys=k1,k2,k3（逗号分隔的 source+id）-> 批量删除多条记录（多选删除）
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await validateAndGetUsername(request);
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const { username } = result;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const keysParam = searchParams.get('keys');

    if (key) {
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json(
          { error: 'Invalid key format' },
          { status: 400 },
        );
      }
      await db.deleteRecentlyViewed(username, source, id);
    } else if (keysParam) {
      const keys = keysParam.split(',').filter(Boolean);
      for (const k of keys) {
        const [source, id] = k.split('+');
        if (source && id) {
          await db.deleteRecentlyViewed(username, source, id);
        }
      }
    } else {
      // 清空全部
      const all = await db.getAllRecentlyViewed(username);
      await Promise.all(
        Object.keys(all).map(async (k) => {
          const [s, i] = k.split('+');
          if (s && i) await db.deleteRecentlyViewed(username, s, i);
        }),
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('删除最近浏览失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
