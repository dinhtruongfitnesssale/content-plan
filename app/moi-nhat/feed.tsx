"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chip, EvidencePyramidFilter, FilterGroup } from "@/components/evidence-filter";
import { Button, EmptyNote, ErrorNote, Eyebrow, Num, PageHeader } from "@/components/ui";
import { TIER_LABEL, toTier, type EvidenceTier } from "@/lib/research";
import { WATCHLIST } from "@/lib/watchlist";
import {
  clearLatestCache,
  readLatestCache,
  timeAgo,
  writeLatestCache,
} from "@/lib/latest-cache";
import type { BeatUpdate, LatestResponse, Paper } from "@/lib/types";

const WINDOW_CHOICES = [
  { value: 30, label: "30 ngày" },
  { value: 90, label: "3 tháng" },
  { value: 180, label: "6 tháng" },
  { value: 365, label: "1 năm" },
] as const;

const ALL_BEATS = WATCHLIST.map((beat) => beat.id);

export function LatestFeed() {
  const router = useRouter();

  const [beats, setBeats] = useState<string[]>(ALL_BEATS);
  const [days, setDays] = useState<number>(90);
  const [tiers, setTiers] = useState<EvidenceTier[]>([]);
  const [womenFocus, setWomenFocus] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LatestResponse | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const didInit = useRef(false);

  /**
   * Khôi phục lượt quét gần nhất nếu còn hạn. Không tự quét khi chưa có gì:
   * một lượt quét mất 15–30 giây và ăn hạn mức NCBI, nên để người dùng bấm.
   */
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const cached = readLatestCache();
    if (!cached) return;

    // localStorage chỉ đọc được ở trình duyệt nên phải đặt state sau khi
    // hydrate xong — đọc sớm hơn thì server và client dựng ra hai cây khác nhau.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBeats(cached.beats.length > 0 ? cached.beats : ALL_BEATS);
    setDays(cached.days);
    setTiers(cached.tiers);
    setWomenFocus(cached.womenFocus);
    setResult(cached.result);
    setSavedAt(cached.savedAt);
  }, []);

  async function scan() {
    if (pending || beats.length === 0) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/moi-nhat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          beats,
          days,
          tiers: tiers.length > 0 ? tiers : undefined,
          womenFocus,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);

      const fresh = json as LatestResponse;
      const at = Date.now();
      setResult(fresh);
      setSavedAt(at);
      writeLatestCache({ beats, days, tiers, womenFocus, result: fresh, savedAt: at });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi không rõ");
    } finally {
      setPending(false);
    }
  }

  function toggleBeat(id: string) {
    setBeats((current) =>
      current.includes(id) ? current.filter((beat) => beat !== id) : [...current, id],
    );
  }

  function toggleTier(tier: EvidenceTier) {
    setTiers((current) =>
      current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier],
    );
  }

  function forget() {
    clearLatestCache();
    setResult(null);
    setSavedAt(null);
    setError(null);
  }

  /** Chuyển sang trang Nghiên cứu để rút phát hiện tiếng Việt từ mảng này. */
  function digDeeper(beat: BeatUpdate) {
    router.push(`/nghien-cuu?chu-de=${encodeURIComponent(beat.query)}`);
  }

  const total = result?.beats.reduce((sum, beat) => sum + beat.papers.length, 0) ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Mới nhất"
        title="Nghiên cứu vừa ra"
        lede="Bảy mảng chủ đề được theo dõi thường trực — tăng cơ, giảm mỡ, sức mạnh, dinh dưỡng, sức khoẻ, thực phẩm bổ sung, nội tiết nữ. Lọc theo tháp bằng chứng để chỉ thấy thứ đủ chắc để viết."
      />

      <div className="space-y-6">
        <div>
          <Eyebrow>Mảng theo dõi</Eyebrow>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {WATCHLIST.map((beat) => {
              const active = beats.includes(beat.id);
              return (
                <button
                  key={beat.id}
                  type="button"
                  onClick={() => toggleBeat(beat.id)}
                  aria-pressed={active}
                  className={`border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-ink/55 bg-ink/[0.025]"
                      : "border-ink/12 hover:border-ink/35"
                  }`}
                >
                  <span
                    className={`block text-sm font-medium ${active ? "text-ink" : "text-ink/50"}`}
                  >
                    {beat.name}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink/45">
                    {beat.why}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterGroup label="Trong vòng">
            {WINDOW_CHOICES.map((choice) => (
              <Chip
                key={choice.value}
                active={days === choice.value}
                onClick={() => setDays(choice.value)}
              >
                {choice.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Đối tượng">
            <Chip active={!womenFocus} onClick={() => setWomenFocus(false)}>
              Tất cả
            </Chip>
            <Chip active={womenFocus} onClick={() => setWomenFocus(true)}>
              Ưu tiên nữ
            </Chip>
          </FilterGroup>
        </div>

        <EvidencePyramidFilter
          selected={tiers}
          onToggle={toggleTier}
          onClear={() => setTiers([])}
          hint="Không chọn gì thì lấy tất cả, và sẽ thấy nhiều bài ghi &laquo;Other&raquo; — PubMed gán nhãn thiết kế nghiên cứu sau khi bài ra vài tuần, nên bài mới nhất thường chưa có nhãn. Chọn một bậc là chỉ còn bài đã được gán nhãn chắc chắn. Ở đây kết quả xếp theo ngày ra, bậc bằng chứng chỉ phân xử khi trùng ngày."
        />

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={scan} disabled={pending || beats.length === 0}>
            {pending ? "Đang quét…" : result ? "Quét lại" : "Quét bảng tin"}
          </Button>
          {beats.length === 0 && (
            <span className="text-xs text-ink/45">Chọn ít nhất một mảng.</span>
          )}
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {pending && (
        <p className="text-sm text-ink/50">
          Quét lần lượt <Num>{beats.length}</Num> mảng trên PubMed và OpenAlex — mất
          khoảng <Num>{beats.length * 3}</Num> giây. Lượt này không gọi model nên không
          tốn gì ngoài thời gian.
        </p>
      )}

      {result && savedAt !== null && (
        <div className="rule flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-ink/45">
            Quét lúc {timeAgo(savedAt)} · <Num>{total}</Num> bài trong{" "}
            <Num>{result.days}</Num> ngày gần đây
            {result.womenFocus && " · chỉ nghiên cứu có đối tượng nữ"}
          </p>
          <button
            type="button"
            onClick={forget}
            className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink"
          >
            Xoá kết quả
          </button>
        </div>
      )}

      {result && total === 0 && (
        <EmptyNote>
          Không có bài nào lọt qua bộ lọc. Nới khoảng thời gian, bỏ bớt bậc bằng chứng,
          hoặc tắt &laquo;ưu tiên nữ&raquo; — phân tích gộp trên riêng phụ nữ có khi cả
          quý mới ra một bài.
        </EmptyNote>
      )}

      {result && (
        <div className="space-y-12">
          {result.beats.map((beat) => (
            <BeatSection key={beat.id} beat={beat} onDigDeeper={() => digDeeper(beat)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BeatSection({ beat, onDigDeeper }: { beat: BeatUpdate; onDigDeeper: () => void }) {
  return (
    <section className="space-y-4">
      <div className="rule flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
        <h2 className="font-serif text-2xl tracking-tight">{beat.name}</h2>
        <span className="text-xs text-ink/45">
          <Num>{beat.papers.length}</Num> bài mới
        </span>
      </div>

      {beat.error ? (
        <ErrorNote>Không quét được mảng này: {beat.error}</ErrorNote>
      ) : beat.papers.length === 0 ? (
        <EmptyNote>
          Chưa có gì mới lọt qua bộ lọc trong mảng này. Im lặng cũng là một thông tin —
          nghĩa là chưa có lý do để đổi lời khuyên đang dùng.
        </EmptyNote>
      ) : (
        <ul className="space-y-5">
          {beat.papers.map((paper) => (
            <li key={paper.id}>
              <PaperRow paper={paper} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4 pt-1">
        <Button variant="quiet" onClick={onDigDeeper}>
          Tra cứu sâu mảng này
        </Button>
        <span className="text-xs text-ink/45">
          Đọc abstract và rút phát hiện tiếng Việt để viết bài.
        </span>
      </div>
    </section>
  );
}

/**
 * Một bài trong bảng tin.
 *
 * Tiêu đề để nguyên tiếng Anh, không dịch: bảng tin này không gọi model, mà
 * dịch tiêu đề bằng code thì sai nghĩa chuyên môn. Muốn có tiếng Việt thì đi
 * qua "Tra cứu sâu" — ở đó abstract được đọc thật và có rào chắn kiểm chứng.
 */
function PaperRow({ paper }: { paper: Paper }) {
  return (
    <article className="rule border-b pb-5 last:border-0">
      <a
        href={paper.url}
        target="_blank"
        rel="noreferrer"
        className="font-serif text-lg leading-snug transition-colors hover:text-amber"
      >
        {paper.title}
      </a>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/45">
        <span className="text-ink/65">{TIER_LABEL[toTier(paper.studyTypes)]}</span>
        <span>
          <Num>{formatDate(paper)}</Num>
        </span>
        {paper.journal && <span>{paper.journal}</span>}
        {paper.citedByCount !== null && paper.citedByCount > 0 && (
          <span>
            <Num>{paper.citedByCount}</Num> trích dẫn
          </span>
        )}
        {paper.sampleSize !== null && (
          <span>
            n=<Num>{paper.sampleSize}</Num>
          </span>
        )}
        {paper.isOpenAccess && <span className="text-herb">đọc miễn phí</span>}
      </p>

      {paper.takeaway && (
        <p className="mt-2 border-l-2 border-slate/35 py-0.5 pl-3 text-xs leading-relaxed text-slate">
          {paper.takeaway}
        </p>
      )}
    </article>
  );
}

/**
 * Ngày ra bài. Có ngày đầy đủ thì hiện dd/mm/yyyy kiểu Việt; chỉ có năm thì
 * hiện năm — không độn ngày giả cho tròn định dạng.
 */
function formatDate(paper: Paper): string {
  if (paper.publishedOn) {
    const [year, month, day] = paper.publishedOn.split("-");
    return `${day}/${month}/${year}`;
  }
  return paper.year ? String(paper.year) : "?";
}
