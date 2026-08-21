import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ResearchWorkbench } from "./workbench";

export const metadata = { title: "Nghiên cứu · Bàn viết" };

export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* useSearchParams đọc ?chu-de= nên phần này chỉ dựng được ở phía trình
          duyệt. Suspense giữ cho trang vẫn prerender được phần khung tĩnh. */}
      <Suspense fallback={<Skeleton />}>
        <ResearchWorkbench />
      </Suspense>
    </div>
  );
}

function Skeleton() {
  return (
    <PageHeader
      eyebrow="Nghiên cứu"
      title="Tra cứu bằng chứng"
      lede="Tìm trên PubMed và OpenAlex, rồi rút thành những phát hiện có thể dẫn thẳng vào bài."
    />
  );
}
