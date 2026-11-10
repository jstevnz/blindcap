import TastingHistory from "@/app/components/TastingHistory";
import ProfileAchievements from "@/app/components/ProfileAchievements";
export default function HistoryAndAwards() {
  return (
    <main className="narrow">
      <div className="row-between">
        <h1>My history & awards.</h1>
        <a href="/events">← Events</a>
      </div>
      <p>Your participated events, submitted bottles, revealed results and awards.</p>
      <TastingHistory />
      <ProfileAchievements />
    </main>
  );
}
