import { NextResponse } from "next/server";
import {
  FaceitApiError,
  getFaceitPlayerByNickname,
} from "@/lib/faceit";

export async function GET(request: Request) {
  const nickname = new URL(request.url).searchParams.get("nickname")?.trim();

  if (!nickname) {
    return NextResponse.json({ error: "请输入 FACEIT 昵称" }, { status: 400 });
  }

  if (nickname.length > 32) {
    return NextResponse.json({ error: "FACEIT 昵称长度无效" }, { status: 400 });
  }

  try {
    const player = await getFaceitPlayerByNickname(nickname);
    return NextResponse.json(player);
  } catch (error) {
    if (error instanceof FaceitApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }

    const message = error instanceof Error ? error.message : "未知错误";
    const isTimeout = error instanceof Error && error.name === "TimeoutError";

    return NextResponse.json(
      { error: isTimeout ? "FACEIT 请求超时，请稍后重试" : message },
      { status: 502 },
    );
  }
}
