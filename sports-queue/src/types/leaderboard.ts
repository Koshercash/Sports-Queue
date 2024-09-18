export interface LeaderboardPlayer {
  id: string;
  name: string;
  profilePicture: string | null;
  mmr: number;
  rank: number;
}