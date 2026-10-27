export type FaceitPlayer = {
  nickname: string;
  player_id: string;
  avatar?: string;
  country?: string;
  faceit_url?: string;
  games?: {
    cs2?: {
      skill_level: number;
      faceit_elo: number;
      game_player_id?: string;
      game_player_name?: string;
      region?: string;
    };
  };
};

export class FaceitApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FaceitApiError";
  }
}

export async function getFaceitPlayerByNickname(
  nickname: string,
): Promise<FaceitPlayer> {
  const apiKey = process.env.FACEIT_API_KEY;

  if (!apiKey) {
    throw new FaceitApiError("服务端没有配置 FACEIT_API_KEY", 500);
  }

  const url = new URL("https://open.faceit.com/data/v4/players");
  url.searchParams.set("nickname", nickname);
  url.searchParams.set("game", "cs2");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const message =
      response.status === 404
        ? "没有找到这个 FACEIT 玩家"
        : `FACEIT 请求失败（${response.status}）`;
    throw new FaceitApiError(message, response.status);
  }

  return (await response.json()) as FaceitPlayer;
}
