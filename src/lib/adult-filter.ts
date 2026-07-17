/**
 * CareCastTV 成人内容过滤策略：始终过滤，不提供任何绕过方式。
 *
 * 本应用面向家庭老人场景，成人内容过滤为硬性开启：
 * 原 DecoTV 支持通过 adult/filter 查询参数或站点配置关闭过滤，
 * CareCastTV 已移除这些开关，函数签名保留以兼容既有调用方。
 *
 * 维护者：DimLoong
 */
export function resolveAdultFilter(
  _searchParams: URLSearchParams,
  _disableYellowFilter: boolean,
): boolean {
  return true;
}
