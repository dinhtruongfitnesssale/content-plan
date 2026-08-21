import { Library } from "./library";

export const metadata = { title: "Thư viện · Bàn viết" };

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Library />
    </div>
  );
}
