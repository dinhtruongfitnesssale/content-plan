import { Composer } from "./composer";

export const metadata = { title: "Soạn bài · Bàn viết" };

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Composer />
    </div>
  );
}
