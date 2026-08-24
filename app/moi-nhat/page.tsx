import { LatestFeed } from "./feed";

export const metadata = { title: "Mới nhất · Bàn viết" };

export default function LatestPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <LatestFeed />
    </div>
  );
}
