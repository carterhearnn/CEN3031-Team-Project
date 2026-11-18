import Leaderboard from "../leaderboard/Leaderboard.jsx";
import "./LeaderboardPage.css";

export default function LeaderboardPage() {
  return <main className="leaderboard-page" id="main">
    <div className="site-container leaderboard-page-content">
      <h1>Leaderboard</h1>
      <Leaderboard />
    </div>
  </main>;
}
