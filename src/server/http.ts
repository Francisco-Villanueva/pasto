/** IP del cliente detrás del proxy de Vercel. Solo se usa para limitar ráfagas y verificar el captcha. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return Response.json({ error: { code, message, ...extra } }, { status, headers });
}
