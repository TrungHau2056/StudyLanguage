# Vocab – Học từ vựng tiếng Anh

Web học từ vựng tiếng Anh cho người Việt. Chạy hoàn toàn trên trình duyệt, không cần server, dùng tốt trên điện thoại.

## Cách học

Web dựa trên mô hình 4 mảng học từ vựng của Paul Nation: học có chủ đích, đọc/nghe, nói/viết, luyện trôi chảy.

| Mục | Làm gì |
|---|---|
| **Học mới** | Mỗi từ có: nghĩa tiếng Việt, IPA, phát âm, câu ví dụ đúng nghĩa (kèm bản dịch), cụm từ hay gặp, họ từ |
| **Ôn tập** | Lặp lại ngắt quãng bằng FSRS. Có 4 kiểu hỏi, độ khó tăng theo mức quen thuộc: chọn nghĩa → nhớ nghĩa / nghe và gõ lại → nhìn nghĩa, gõ từ tiếng Anh |
| **Luyện viết** | Tự đặt câu với từ vừa học rồi so sánh với câu mẫu |
| **Đọc** | 141 bài đọc ngắn. Mỗi bài dùng khoảng 20 từ theo thứ tự tần suất, có nghe cả bài, bản dịch, chạm vào từ để xem nghĩa |
| **Kiểm tra vốn từ** | Bài kiểm tra Biết/Không biết có xen từ bịa để trừ điểm đoán mò. Từ kết quả, web bỏ qua các nhóm từ bạn đã biết từ 90% trở lên |

Từ mới mặc định học theo tần suất. Có thể chọn học theo chủ đề trong phần Cài đặt.

## Chạy

```bash
npm install
npm run dev
```

## Dữ liệu

```bash
node scripts/build-words.mjs   # tạo public/words.json và public/readings.json
```

- [NGSL 1.01](https://www.newgeneralservicelist.com/) (CC BY-SA 4.0), khoảng 2.800 từ, qua [koba-ninkigumi/ngsl](https://github.com/koba-ninkigumi/ngsl)
- Nghĩa phụ tiếng Việt và IPA: từ điển Anh–Việt (Hồ Ngọc Đức), qua [namduongit/english-vietnamese](https://github.com/namduongit/english-vietnamese)
- `scripts/data/enrich.json` (chủ đề, nghĩa ngắn gọn, ví dụ, cụm từ, họ từ) và `scripts/data/readings.json` (bài đọc) do AI tạo. Có thể còn sai sót.
- Audio phát âm: [Free Dictionary API](https://dictionaryapi.dev/). Không có audio thì dùng giọng đọc của trình duyệt.

## Deploy

Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự build và đưa lên GitHub Pages.

Tiến độ học lưu trong IndexedDB của trình duyệt. Dùng **Cài đặt → Xuất/Nhập dữ liệu** để sao lưu hoặc chuyển máy.

## Tài khoản (Firebase)

Đăng nhập bằng Google qua Firebase Authentication. Tiến độ của từng tài khoản lưu trên Firestore và đồng bộ giữa các thiết bị.

- Cấu hình nằm trong biến của GitHub repo (`VITE_FIREBASE_*`, xem `.env.example`). Khi chạy trên máy thì đặt các biến này trong `.env.local`.
- Quy tắc bảo mật của Firestore nằm trong `firestore.rules`: mỗi người chỉ đọc và ghi được `users/{uid}` của chính mình.
- Thiếu cấu hình thì web chạy ở chế độ chỉ lưu trong trình duyệt, không có đăng nhập.
