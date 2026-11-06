# 🛡️ CCTV Adli İnceleme & Görüşme Tarayıcısı (CCTV Forensic Viewer)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Zero Server](https://img.shields.io/badge/Client--Side-100%25%20Offline-success.svg)](#-gizlilik-ve-güvenlik)

Modern, ultra hızlı ve doğrudan tarayıcıda çalışan **CCTV ve NVR Video İnceleme, Olay/Etkileşim Analizi ve Adli Raporlama** platformu.

Güvenlik kameralarından alınan parçalı video kayıtlarının zaman senkronizasyonunu sağlar, kare kare adli inceleme imkânı sunar, şüpheli olayları ve görüşmeleri etiketler, resmi adli tutanaklar (A4 PDF) ve kayıpsız FFmpeg kesim komutları üretir. **Tüm işlemler tamamen istemci tarafında (tarayıcınızda) gerçekleşir; videolarınız ve verileriniz hiçbir sunucuya yüklenmez.**

---

## ⚡ Hızlı Başlangıç (Kurulum Gerektirmez!)

Bu projeyi kullanmak için **Node.js kurmanıza bile gerek yoktur**:

1. [Releases](../../releases) bölümünden veya repo ana dizininden **`CCTV_Viewer.html`** dosyasını indirin.
2. Dosyaya çift tıklayarak herhangi bir modern tarayıcıda (Chrome, Edge, Brave vb.) açın.
3. Videolarınızı sürükleyip bırakarak adli incelemeye hemen başlayın!

> **Windows Kullanıcıları:** Klasördeki `CCTV_Baslat.bat` dosyasını kullanarak doğrudan tek tıkla başlatabilirsiniz.

---

## ✨ Öne Çıkan Özellikler

### 1. 📁 Çok Parçalı CCTV Kuyruğu & Akıllı Zaman Senkronizasyonu
* **Sürükle-Bırak Sıralama:** Sol paneldeki videoları mouse ile tutup yukarı-aşağı taşıyarak kolayca yeniden sıralayabilirsiniz. Sıralama değiştiğinde ardışık parçaların tarih ve saatleri yeni dizilime göre anında yeniden zincirlenir.
* **Doğal Sıralama (`naturalSort`):** Parçalanmış (`_1.mp4`, `_1-1.mp4`, `_2.mp4` vb.) CCTV videolarını doğru kronolojik sırada otomatik dizer.
* **Otomatik Tarih & Saat Tespiti:**
  * **Honeywell / NVR formatı:** Dosya adındaki çift 14 haneli zaman damgasını (`YYYYMMDDHHMMSS_YYYYMMDDHHMMSS`) otomatik ayrıştırır.
  * **Dahua / Hikvision / Standart ISO:** `YYYY-MM-DD_HH-MM-SS` ve tekil timestamp kalıplarını destekler.
* **Gece Yarısı / Gün Devri Desteği:** Gece yarısını geçen kayıtlarda (ör. 23:50 -> 00:20) takvim tarihi otomatik olarak bir sonraki güne devreder.
* **Manuel Zaman Düzenleme:** Parça bazında tarih (`YYYY-MM-DD`) ve saat (`HH:mm:ss`) düzenleme, önceki parçadan saat devralma ve sonrasını otomatik yeniden zincirleme.

---

### 2. 🔍 Gelişmiş Adli Oynatıcı & Görüntü İyileştirme
* **0.5x - 64x Akıcı Hızlandırma:** Yüksek hızlarda (özellikle `16x` ve üzeri) tarayıcı takılmalarını önleyen optimize oynatma mimarisi.
* **Kare Kare Hassas İlerleme (Frame-by-Frame):** Tek tuşla tek kare hassasiyetinde (`0.04 saniye`) ileri/geri inceleme.
* **Dijital Zoom & Pan:** Video üzerinde mouse tekerleğiyle yakınlaştırma yapabilir ve şüpheli alanları detaylı inceleyebilirsiniz.
* **Canlı Görüntü Filtreleri:** Düşük ışıklı veya aşırı parlak sahneler için canlı **Parlaklık (Brightness)** ve **Kontrast (Contrast)** ayarları.
* **Yüksek Çözünürlüklü Snapshot:** Tek tuşla (`S`) anlık video karesini PNG formatında dışa aktarma.

---

### 3. 👥 Akıllı Olay & Etkileşim Yönetimi (Interactions)
* **Otomatik İzleme & Yoksayma (Auto-Dismiss):** Videoyu izlerken üzerinden geçtiğiniz beklemedeki olaylar otomatik olarak incelendi statüsüne alınır.
* **Canlı Kare Vurgusu:** Oynatma esnasında geçerli saniye hangi olaya denk geliyorsa, o kart sağ listede altın sarısı çerçeve ve yanıp sönen **"Canlı Kare"** rozetiyle öne çıkarılır.
* **Akıllı Otomatik Kaydırma (Auto-Scroll):** Video ilerledikçe sağdaki olay listesi, sıradaki incelenecek olayı otomatik olarak ekranın ortasına getirir (not yazarken kullanıcıyı rahatsız etmemek için otomatik askıya alınır).
* **Anlık Snapshot Ekleme & Güncelleme:** Her yeni olay eklendiğinde o anki video karesi otomatik olarak olaya iliştirilir. Kart üzerindeki kamera simgesiyle şüphelinin en net görüldüğü kare tek tıkla kapak fotoğrafı yapılabilir.
* **Toplu Liste İçe Aktarma (Liste Yapıştır):** Harici notlardan veya analizlerden kopyalanan zaman aralıkları saniyeler içinde toplu olarak içeri aktarılabilir.
* **Hızlı Otomatik Görüşme Tarama:** Ayarlanabilir hassasiyet ve bekleme süresi parametreleriyle video boyunca temas/görüşme tespiti simülasyonu.

---

### 4. ⏱️ İnteraktif Adli Zaman Çizelgesi & Renkli Isı Haritası
* **Gerçek CCTV Zamanı vs. Video Süresi:** Zaman çizelgesini hem video süresi (`00:15:20`) hem de gerçek NVR kayıt tarihi/saati (`13.08.2026 08:15:20`) olarak eşzamanlı izleme.
* **Durum Bazlı Renkli Isı Haritası (Timeline Heatmap):**
  * 🟢 **Yeşil (Doğrulandı):** İncelenip teyit edilmiş olaylar.
  * 🟡 **Sarı (Beklemede):** Henüz incelenmemiş / teyit bekleyen olaylar.
  * ⚪ **Gri (Yoksayıldı / İncelendi):** Auto-dismiss ile geçilmiş veya elenmiş olaylar.
* **Mark-In / Mark-Out:** `[` ve `]` tuşlarıyla hızlıca inceleme aralığı belirleme.

---

### 5. 📄 Görsel Adli Raporlama & FFmpeg Entegrasyonu
* **🖨️ Görsel Adli Olay Tutanağı (A4 / Doğrudan PDF):**
  * Savcılık, emniyet, yönetim veya mahkeme dosyaları için resmi tutanak şablonu.
  * Olayların 16:9 video kareleri, adli takvim saatleri, tespit notları ve resmi imza/onay blokları.
  * Tarayıcının yerel yazdırma motoru (`window.print()`) sayesinde kusursuz Türkçe karakter desteği ve vektörel netlikte A4 PDF çıktısı.
* **💾 Bağımsız Tek Dosya HTML Rapor (.html):**
  * Tüm fotoğrafları içine gömülü (Base64) tek bir `.html` dosyası olarak kaydetme. USB bellek veya CD ile teslim edilebilir.
* **📝 Markdown Olay İnceleme Raporu (.md):**
  * Düz metin notlar ve teknik analizler için Markdown formatında dışa aktarma.
* **⚡ FFmpeg Kesim Komutları (Kayıpsız / Stream Copy):**
  * İşaretlenen aralıkları orijinal videodan yeniden kodlamadan, kayıpsız ve saniyeler içinde kesmek (`-c copy`) için terminale yapıştırılmaya hazır komut listesi.
* **💾 Proje Yedekleme & Geri Yükleme:**
  * Tüm inceleme oturumunu ve notları JSON olarak dışa aktarma / geri yükleme ve otomatik `localStorage` kalıcılığı.

---

## ⌨️ Klavye Kısayolları

| Tuş | İşlev |
| :--- | :--- |
| <kbd>Space</kbd> | Oynat / Duraklat |
| <kbd>+</kbd> / <kbd>-</kbd> | Oynatma Hızını Artır / Azalt (`0.5x` - `64x`) |
| <kbd>0</kbd> | Normal Hıza Dön (`1x`) |
| <kbd>→</kbd> / <kbd>←</kbd> | 5 Saniye İleri / Geri |
| <kbd>Shift</kbd> + <kbd>→</kbd> / <kbd>←</kbd> | 1 Saniye Hassas İlerleme |
| <kbd>.</kbd> (Nokta) / <kbd>,</kbd> (Virgül) | **1 Kare Hassas (0.04 sn)** İleri / Geri |
| <kbd>[</kbd> | Mark-In (Aralık Başlangıcı Belirle) |
| <kbd>]</kbd> | Mark-Out (Aralık Bitişi Belirle) |
| <kbd>M</kbd> veya <kbd>I</kbd> | Mevcut Konumda Yeni Olay/Görüşme Ekle |
| <kbd>S</kbd> | Anlık Ekran Görüntüsü (Snapshot) İndir |
| <kbd>?</kbd> | Kısayol Yardım Penceresini Aç |

---

## 🛠️ Desteklenen CCTV Dosya Formatları

Uygulama aşağıdaki dosya adı formatlarından tarih ve saat bilgilerini otomatik olarak ayrıştırır:

1. **Honeywell & NVR Çift Zaman Damgası:**  
   `Honeywell_20260813080000_20260814065200_1.mp4`  
   *(Başlangıç: 13.08.2026 08:00:00, Bitiş: 14.08.2026 06:52:00)*
2. **Tekil 14 Haneli Zaman Damgası:**  
   `Kamera1_20260813083000.mp4` *(13.08.2026 08:30:00)*
3. **Standart Tarih-Saat:**  
   `CAM01_2026-08-13_09-15-00.mkv`
4. **Sadece Saat:**  
   `ch01_14-30-00.mp4`

Desteklenen video kapsayıcıları: `.mp4`, `.webm`, `.mkv`, `.avi` (tarayıcınızın donanımsal kodek desteğine bağlıdır).

---

## 💻 Geliştirici Kurulumu (Source Code)

Projeyi yerel ortamınızda geliştirmek veya özelleştirmek isterseniz:

### Gereksinimler
* [Node.js](https://nodejs.org/) (v18 veya üzeri)
* Modern bir web tarayıcısı (Google Chrome veya Microsoft Edge önerilir)

### Adımlar

1. **Depoyu klonlayın:**
   ```bash
   git clone https://github.com/aslansuat/cctv-viewer.git
   cd cctv-viewer
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Geliştirme sunucusunu başlatın:**
   ```bash
   npm run dev
   ```
   Tarayıcınızda `http://localhost:5173` adresine gidin.

4. **Tek Dosya HTML Üretin (Production Build):**
   ```bash
   npm run build
   ```
   Bu komut hem `dist/` klasörünü hem de doğrudan dağıtıma hazır tek parça `CCTV_Viewer.html` dosyasını üretir.

---

## 💡 Sorun Giderme (Windows PowerShell Notu)

Windows PowerShell üzerinde `npm run dev` çalıştırırken `PSSecurityException` veya `running scripts is disabled` hatası alıyorsanız:

1. PowerShell üzerinde tek seferlik şu komutu çalıştırarak yetki verin:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
2. Veya doğrudan CMD dosyası üzerinden çalıştırın:
   ```powershell
   npm.cmd run dev
   ```

---

## 🏗️ Teknoloji Mimarisi

* **Arayüz & Çatı:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
* **Geliştirme & Paketleme:** [Vite 8](https://vitejs.dev/), [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
* **Stil & Tasarım:** [Tailwind CSS v4](https://tailwindcss.com/)
* **İkonlar:** [Lucide React](https://lucide.dev/)

---

## 🔒 Gizlilik ve Güvenlik

Bu yazılım adli tıp, adli bilişim ve güvenlik analistlerinin gizlilik gereksinimleri gözetilerek geliştirilmiştir:
* **Sıfır Sunucu İletişimi:** Yüklediğiniz hiçbir video, görsel veya olay notu internete veya uzak bir sunucuya aktarılmaz.
* **Tamamen Çevrimdışı (Offline):** İnternet bağlantısı kesilmiş güvenli adli inceleme iş istasyonlarında %100 işlevseldir.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakabilirsiniz.

---

## ⚖️ Yasal Sorumluluk Reddi (Disclaimer)

Bu yazılım adli inceleme süreçlerine yardımcı olmak amacıyla geliştirilmiş bir analiz aracıdır. Elde edilen raporların ve tespitlerin doğruluğu, incelenen görüntülerin kalitesine ve analistin değerlendirmesine bağlıdır. Resmi makamlar nezdinde nihai adli sorumluluk incelemeyi yürüten uzmana aittir.
---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakabilirsiniz.

---

## ⚖️ Yasal Sorumluluk Reddi (Disclaimer)

Bu yazılım adli inceleme süreçlerine yardımcı olmak amacıyla geliştirilmiş bir analiz aracıdır. Elde edilen raporların ve tespitlerin doğruluğu, incelenen görüntülerin kalitesine ve analistin değerlendirmesine bağlıdır. Resmi makamlar nezdinde nihai adli sorumluluk incelemeyi yürüten uzmana aittir.
