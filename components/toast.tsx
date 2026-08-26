"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lời nhắn nhỏ hiện lên ở đáy màn hình rồi tự tắt.
 *
 * Dùng cho những việc làm xong mà KHÔNG đổi gì thấy được trên màn hình —
 * "đánh dấu đã đăng", "lưu thay đổi". Không có nó thì người dùng bấm nút xong
 * không biết đã ăn hay chưa. Việc nào đổi giao diện ngay (xoá một thẻ, mở một
 * mục) thì đừng gọi toast: bản thân màn hình đã là lời báo rồi.
 *
 * Giữ 90/5/5: nền mực, chữ giấy — giống nút chính. Amber chỉ ở nét kẻ trái.
 */

const HIEN_TRONG_MS = 3200;

type Loi = { id: number; text: string };

export function useToast() {
  const [loi, setLoi] = useState<Loi | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dem = useRef(0);

  const toast = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // id tăng dần để hai lần bấm liên tiếp cùng một câu vẫn chạy lại hiệu ứng.
    dem.current += 1;
    setLoi({ id: dem.current, text });
    timerRef.current = setTimeout(() => setLoi(null), HIEN_TRONG_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, toastNode: <Toast loi={loi} /> };
}

function Toast({ loi }: { loi: Loi | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {loi && (
        <p
          key={loi.id}
          className="toast-in border-l-2 border-amber bg-ink px-5 py-3 text-sm leading-snug text-paper shadow-lg"
        >
          {loi.text}
        </p>
      )}
    </div>
  );
}
