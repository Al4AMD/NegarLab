۱. مبانی تصویر

Pixel Inspector: زوم تا سطح پیکسل، با نمایش ماتریس عددی ۸×۸ اطراف نشانگر. برای آموزش خیلی کاربردیه.
نمونه‌برداری و کوانتیزاسیون تصویر: تغییر رزولوشن مکانی، کاهش عمق بیت (مثلاً ۸ به ۱ بیت)، و نمایش false contouring و aliasing/moiré. این مستقیماً هم‌تای آزمایش آوالب برای نرخ نمونه‌برداری و عمق بیته.
نمایش کانال‌ها و آمار تصویر (میانگین، واریانس، آنتروپی).

۲. فضاهای رنگی

RGB، HSV/HSL، YCbCr، CMYK، CIE Lab و Grayscale، با جدا کردن کانال‌ها.
Chroma Subsampling (4:4:4، 4:2:2، 4:2:0): دیدن اینکه چرا فشرده‌سازی رنگ کمتر به چشم میاد.
شبیه‌سازی کوررنگی و تصحیح white balance.

۳. هیستوگرام و عملیات نقطه‌ای

هیستوگرام زنده، کشش کنتراست، Histogram Equalization، CLAHE، Histogram Matching.
Negative، Log، Gamma، Thresholding (Otsu و تطبیقی).

۴. فیلترهای مکانی و کانولوشن

ویرایشگر کرنل با کانولوشن گام‌به‌گام (انیمیشن «پنجره‌ی لغزان» روی تصویر).
Mean، Gaussian، Median، Bilateral، Sharpen، Unsharp Masking.
آشکارسازی لبه: Sobel، Prewitt، Laplacian، LoG، Canny.

۵. حوزه‌ی فرکانس (هم‌تای آزمایش فوریه‌ی آوالب)

FFT دوبعدی با اندازه و فاز.
فیلتر Low/High/Band-pass (ایده‌آل، Butterworth، Gaussian) با نمایش پدیده‌ی Ringing.
ویرایش Real/Imaginary و نقاشی روی طیف.
Notch Filter برای حذف نویز تناوبی.
آزمایش کلاسیک «تعویض فاز و اندازه‌ی دو تصویر»: فاز بیشتر اطلاعات ساختار رو حمل می‌کنه.

۶. نویز و بازسازی

تولید نویز (Gaussian، Salt & Pepper، Speckle، Poisson) و حذفش (Median، Bilateral، Non-local Means، Wiener).
محو شدن حرکتی/فوکوس و Deconvolution (Inverse و Wiener).

۷. مورفولوژی

Erosion، Dilation، Opening، Closing، Gradient، Top-hat، با ویرایشگر Structuring Element.

۸. تبدیل‌های هندسی

Scale، Rotate، Affine، Perspective.
مقایسه‌ی درون‌یابی (Nearest، Bilinear، Bicubic، Lanczos) کنار هم.
هرم‌های تصویر (Gaussian/Laplacian) و Blending چندمقیاسی.

۹. فشرده‌سازی تصویر (قلب درس چندرسانه‌ای)

Lossless: RLE، Huffman، LZW، DPCM/پیش‌بینی‌کننده‌ها، فیلترهای PNG، و آنتروپی تصویر.
Lossy: خط لوله‌ی JPEG گام‌به‌گام: بلوک‌های ۸×۸، DCT، ماتریس کوانتیزاسیون با اسلایدر کیفیت، Zigzag، کدگذاری آنتروپی، و دیدن Blocking Artifacts. به‌علاوه‌ی نمایش ۶۴ تابع پایه‌ی DCT.
موجک (Wavelet): تجزیه‌ی چندسطحی (Haar و Daubechies) و مقایسه‌ی JPEG با JPEG2000.
کدک‌های واقعی: JPEG، PNG، WebP، AVIF، JPEG XL و HEIC در بک‌اند.
نمودار Rate–Distortion و نقشه‌ی خطا (Error Heatmap) برای اینکه ببینیم فشرده‌سازی کجای تصویر رو خراب کرده.

۱۰. معیارهای کیفیت

MSE، PSNR، SSIM، MS-SSIM، نسبت فشرده‌سازی و bpp. شاید یک معیار ادراکی مثل LPIPS هم با مدل کوچیک.

۱۱. کاهش رنگ و Halftoning

Dithering (Floyd–Steinberg، Bayer/Ordered)، پالت رنگ (Median Cut و K-means)، و شبیه‌سازی GIF.

۱۲. قطعه‌بندی و ویژگی‌ها

K-means، Watershed، Region Growing، Connected Components.
Hough Transform (خط و دایره)، Harris Corner، تطبیق الگو، و ORB/SIFT.

۱۳. امنیت چندرسانه‌ای

Steganography (LSB) و Watermarking در حوزه‌ی DCT.
Error Level Analysis (ELA) و نمایش EXIF برای جعل‌شناسی تصویر.

۱۴. هوش مصنوعی با مدل‌های آماده‌ی HuggingFace (سبک، مناسب لپ‌تاپ)

Super-resolution و مقایسه‌اش با درون‌یابی کلاسیک.
حذف نویز یادگرفته‌شده، حذف پس‌زمینه، قطعه‌بندی تعاملی (خانواده‌ی SAM، نسخه‌های سبک)، تخمین عمق، طبقه‌بندی و تشخیص اشیاء، OCR، رنگ‌آمیزی و Inpainting.
کدک عصبی تصویر در مقابل JPEG روی نمودار Rate–Distortion. این هم‌تای مقایسه‌ی EnCodec/DAC در آوالبه.