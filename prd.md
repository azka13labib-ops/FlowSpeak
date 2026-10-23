Product Requirements Document (PRD): FlowSpeak

1. Ringkasan Produk
FlowSpeak adalah aplikasi latihan berbicara (speaking) bahasa Inggris berbasis suara dan AI. Aplikasi ini dirancang untuk memangkas waktu belajar teori yang terlalu panjang (seperti kurikulum sekolah yang langsung melompat ke materi rumit tanpa fondasi part of speech dan grammar, atau video YouTube yang memakan waktu tonton). FlowSpeak mengubah latihan speaking dari aktivitas yang mahal, sulit dijadwalkan, dan memicu rasa gugup menjadi latihan mandiri yang cepat, terukur, dan bisa diakses kapan saja.

2. Latar Belakang & Rumusan Masalah
Banyak pelajar memahami aturan tata bahasa, menghafal kosakata, dan mendapat nilai ujian tulis yang bagus di sekolah, tetapi tetap kaku saat harus berbicara. Kurikulum di sekolah sering melewatkan fondasi praktis (part of speech dan grammar dasar untuk percakapan) dan langsung masuk ke materi yang berat. Belajar mandiri lewat YouTube juga kurang efisien untuk latihan bicara karena pengguna hanya pasif menonton penjelasan panjang tanpa langsung mempraktikkannya.

4 Masalah Inti Pengguna

Kesenjangan antara pengetahuan bahasa dan kemampuan praktik: Paham teori grammar dan kosakata, tetapi kesulitan menyusun kalimat secara spontan saat berbicara.

Hambatan psikologis untuk memulai percakapan: Takut salah pengucapan (pronunciation), takut salah grammar, atau khawatir ditertawakan lawan bicara sehingga jarang berlatih.

Akses latihan percakapan yang terbatas dan mahal: Latihan bersama tutor manusia membutuhkan biaya privat, kecocokan jadwal, dan ketersediaan partner bicara.

Kurangnya umpan balik (feedback) yang cepat dan spesifik: Saat berlatih sendiri, pengguna tidak sadar ketika pelafalannya kurang tepat, terlalu sering berhenti (jeda), atau memakai kata yang kurang pas.

Rumusan Masalah Utama (Problem Statement)
"Bagaimana membantu orang yang ingin mahir berbicara bahasa Inggris agar bisa berlatih secara rutin, memperoleh evaluasi yang cepat dan berguna, serta membangun kepercayaan diri tanpa harus selalu bergantung pada tutor manusia?"

3. Prinsip Desain Produk
Mulai dari masalah yang spesifik: Fokus menyelesaikan hambatan speaking (beserta pembenahan grammar dan part of speech langsung pada kalimat yang diucapkan), bukan mengajarkan seluruh teori bahasa Inggris sekaligus.

Buat pengguna melakukan tindakan nyata: Pengguna harus langsung berbicara sejak sesi dimulai, bukan sekadar menonton video atau membaca materi.

Berikan feedback yang bisa ditindaklanjuti: Pengguna perlu tahu letak kesalahannya, alasan mengapa kalimat/ucapannya kurang tepat, dan cara memperbaikinya.

Tunjukkan kemajuan yang mudah dipahami: Skor dan riwayat latihan menampilkan perkembangan pengguna dari waktu ke waktu serta aspek yang masih perlu dilatih.

AI sebagai pemecah masalah nyata, bukan gimmick: AI bertugas mengevaluasi suara dan tata bahasa—pekerjaan yang sulit dilakukan saat belajar sendirian—bukan sekadar menjadi chatbot dengan tampilan menarik.

4. Target Pengguna
Pelajar dan Mahasiswa: Ingin berbicara lebih lancar, memperbaiki kemampuan bahasa Inggris untuk sekolah atau kuliah, dan meningkatkan kepercayaan diri.

Pencari Kerja dan Profesional: Perlu berkomunikasi dalam bahasa Inggris untuk wawancara kerja, rapat, atau diskusi dengan klien internasional.

Calon Peserta IELTS/TOEFL: Memerlukan latihan speaking yang terstruktur dan simulasi ujian.

Pembelajar Mandiri (Self-Learners): Tidak memiliki partner bicara dan ingin berlatih kapan pun tanpa harus mengatur jadwal dengan tutor.

5. Keunggulan Utama (Value Proposition)
Percakapan interaktif, bukan sekadar baca materi: Pengguna aktif berbicara dengan AI sehingga latihan lebih dekat dengan pemakaian bahasa sehari-hari.

Umpan balik instan: Evaluasi awal langsung keluar setelah selesai bicara tanpa harus menunggu guru atau tutor memeriksa hasil latihan.

Evaluasi spesifik di tiap aspek: Tidak hanya memberi label benar atau salah, tetapi membedah tata bahasa, pilihan kata, kelancaran, jeda, hingga pelafalan.

Mendorong kebiasaan latihan rutin: Sesi singkat (seperti pidato 60 detik), pilihan topik yang variatif, dan pencatatan skor berkala membantu pengguna menjadikan speaking sebagai rutinitas.

6. Pemetaan Masalah & Solusi Fitur
Masalah Pengguna	Solusi Fitur di FlowSpeak
Tidak punya teman untuk latihan speaking	Tutor AI untuk berlatih percakapan
Takut salah ketika berbicara	Ruang latihan mandiri tanpa harus langsung berbicara dengan manusia
Pengucapan kurang tepat	Analisis pronunciation dan umpan balik pelafalan
Sering berhenti ketika berbicara	Penilaian kelancaran (fluency), kecepatan bicara (pace), dan jeda
Bingung memilih kata	Evaluasi kosakata (vocabulary), identifikasi part of speech, dan saran kata pengganti
Grammar sering salah	Umpan balik dan koreksi tata bahasa per kalimat
Tidak tahu kemampuan speaking saat ini	Skor performa keseluruhan dan estimasi band IELTS
Sulit mempersiapkan IELTS Speaking	Simulasi tes dengan pewawancara AI
Tidak punya banyak waktu belajar	Mode latihan singkat, termasuk latihan bicara 60 detik (60-second speech)
Tidak tahu cara meningkatkan kemampuan	Rekomendasi latihan berikutnya berdasarkan histori kelemahan sesi
7. Alur Kerja Utama (Core User Flow)
Pengguna Berbicara (Speak): Pengguna memilih mode latihan (menjawab pertanyaan singkat, berbicara selama 60 detik, atau berdialog dengan AI) lalu merekam suaranya.

AI Menganalisis Ucapan (Analyze): Sistem mengubah suara menjadi teks (STT), lalu memproses transkrip dan metrik audio untuk mengevaluasi aspek bahasa serta performa berbicara.

Pengguna Menerima Feedback (Evaluate): Aplikasi menampilkan skor, daftar kesalahan yang terdeteksi (grammar, pilihan kata, jeda, pelafalan), alasan kesalahan, dan saran kalimat perbaikan.

Berlatih Kembali (Iterate): Pengguna memakai hasil evaluasi tersebut untuk mengulang latihan atau mengambil rekomendasi topik berikutnya.

8. Pembagian Fase Pengembangan (Release Scope)
Fase 1: MVP (Fokus Pemrosesan Suara & Server Ringan)

Latihan Bicara 60 Detik (Prompt-based Speaking): Pengguna diberikan satu topik/pertanyaan dan merekam suara maksimal 60 detik.

Transkripsi Suara Lokal (STT): Mengubah rekaman suara menjadi teks menggunakan Whisper.cpp (model tiny.en).

Koreksi Grammar, Part of Speech, & Kosakata (Local NLP): Menganalisis teks transkrip menggunakan LLM ringan di Ollama (llama3.2:1b / qwen2.5:1.5b) untuk mendeteksi kesalahan grammar, menjelaskan fungsi kata (part of speech), dan memberi saran kalimat yang natural.

Analisis Kelancaran Dasar (Fluency & Pace): Menghitung kecepatan bicara (Words Per Minute) dan mendeteksi jeda dari perbandingan durasi audio dengan jumlah kata.

Skor & Riwayat Sesi: Menyimpan transkrip, hasil koreksi, dan skor (1–100) agar pengguna bisa melihat kemajuannya.

Fase 2: Pengembangan Lanjutan (Full Vision)

Percakapan dua arah (real-time / turn-based) dengan AI Tutor menggunakan tambahan Text-to-Speech (TTS).

Analisis pronunciation tingkat kata/fonem.

Mode simulasi khusus wawancara IELTS Speaking beserta konversi skor ke estimasi Band IELTS (1.0–9.0).

Sistem rekomendasi latihan otomatis berdasarkan catatan kesalahan yang paling sering berulang.

9. Arsitektur & Tech Stack
Frontend (Mobile App): NativeScript (JavaScript/TypeScript) dengan gaya antarmuka Neobrutalism / Glassmorphism.

Backend API: Node.js dengan Express.js. Menggunakan multer untuk menerima unggahan file audio (multipart/form-data).

AI Engine (Self-Hosted di Axioo Hype 5):

Speech-to-Text: Whisper.cpp (model tiny.en) dieksekusi murni via CPU.

NLP & Evaluator: Ollama (model SLM llama3.2:1b atau qwen2.5:1.5b).

Database: SQLite untuk penyimpanan lokal yang ringan (menyimpan data user, sesi rekaman, dan skor).

10. Batasan Sistem (Out of Scope MVP)
Tidak ada fitur live streaming audio (audio direkam sampai selesai, baru dikirim ke server).

Tidak ada pembayaran atau sistem subscription (fokus penggunaan privat).

Belum mendukung penilaian aksen atau pronunciation per suku kata (fokus ke grammar dan fluency kata secara umum).

Apa yang Kurang dari PRD Lu Sebelumnya?

PRD draf pertama lu udah kuat banget di sisi bisnis dan masalah pengguna, tapi sebagai solo developer, dokumen lu kurang pagar teknis biar lu nggak burnout pas coding. Tiga hal ini yang gw tambahin ke versi di atas:

Tech Stack & Arsitektur (Bagian 9): Wajib ditulis biar lu nggak gonta-ganti framework di tengah jalan. Ngunci spec di Express, NativeScript, dan model AI CPU-friendly mastiin server laptop Axioo lu kuat nanggung bebannya.

Batasan MVP / Out of Scope (Bagian 10): Ini penting banget. PRD harus negasihin apa yang enggak lu bikin sekarang. Kalau nggak ditulis, lu bakal gatel pengen nambahin fitur ini-itu dan aplikasinya nggak rilis-rilis.

Format List yang Berantakan: Daftar masalah dan alur kerja di teks lu sempet tumpang tindih angkanya (misal ada "1. 2. Kesenjangan"). Udah gw rapiin biar enak dibaca.