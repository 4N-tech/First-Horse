import bcrypt from 'bcryptjs';

export async function getSeedSql(): Promise<string> {
  const adminHash = await bcrypt.hash('admin123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);
  const workerHash = await bcrypt.hash('worker123', 10);

  return `
-- Insert Staff Users
INSERT OR IGNORE INTO users (id, name, email, password_hash, phone, role, avatar, is_active) VALUES
(1, 'أحمد المنصوري (المدير العام)', 'admin@factory.com', '${adminHash}', '01000000001', 'ADMIN', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 1),
(2, 'سارة إبراهيم (مشرفة إنتاج)', 'manager@factory.com', '${managerHash}', '01000000002', 'MANAGER', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', 1),
(3, 'محمود فوزي (فني تشغيل وخياطة)', 'worker@factory.com', '${workerHash}', '01000000003', 'WORKER', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 1);

-- Insert Demo Categories
INSERT OR IGNORE INTO categories (id, name, slug, description, image_url, sort_order, is_active) VALUES
(1, 'تيشيرتات', 't-shirts', 'تيشيرتات مصنعية مصنوعة من أنقى أنواع القطن المصري الممشط بأوزان مختلفة', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600', 1, 1),
(2, 'بناطيل', 'pants', 'بناطيل جبردين وجينز وقماش معالجة ضد الانكماش وعالية التحمل', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600', 2, 1),
(3, 'ترنجات', 'tracksuits', 'أطقم وترنجات رياضية شتوية وصيفية بأقمشة ميلتون مبطنة وتقفيل مصنعي فائق', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600', 3, 1),
(4, 'ملابس أطفال', 'kids-wear', 'أطقم وملابس مريحة وآمنة لبشرة الأطفال من خامات قطنية ناعمة 100%', 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600', 4, 1);

-- Insert Demo Products
INSERT OR IGNORE INTO products (id, category_id, name, slug, description, base_price, image_url, is_active) VALUES
(1, 1, 'تيشيرت قطن ممشط فاخر 220 جرام', 'classic-combed-cotton-tshirt', 'تيشيرت كلاسيكي بقصة مريحة مصنوع من قطن مصري ممشط عالي الكثافة مع تقفيل درزات مزدوجة لضمان المتانة اليومية.', 280, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800', 1),
(2, 2, 'بنطلون جبردين مصنعي معالج', 'durable-gabardine-pants', 'بنطلون جبردين ثقيل عالي المتانة مناسب للعمل والاستخدام اليومي، معالج ضد الانكماش وتغير الألوان.', 420, 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800', 1),
(3, 3, 'ترنج رياضي ميلتون قطن شتوي', 'winter-melton-tracksuit', 'طقم ترنج متكامل قطعتين (جاكيت + بنطلون) من خامة الميلتون المعالج والمبطن لوبر حراري ناعم.', 750, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', 1),
(4, 4, 'طقم أطفال قطني صيفي قطعتين', 'kids-cotton-summer-set', 'طقم ولادي وبناتي خفيف ومريح للأطفال، مناسب للأيام الحارة من قطن طبيعي ناعم ومطاطي.', 320, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800', 1);

-- Insert Product Variants (SKU, Size, Color, Price, Stock)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color, price, stock_quantity, is_active) VALUES
(1, 1, 'TSH-BLK-M', 'M', 'أسود', 280, 45, 1),
(2, 1, 'TSH-BLK-L', 'L', 'أسود', 280, 60, 1),
(3, 1, 'TSH-BLK-XL', 'XL', 'أسود', 290, 35, 1),
(4, 1, 'TSH-WHT-M', 'M', 'أبيض', 280, 50, 1),
(5, 1, 'TSH-WHT-L', 'L', 'أبيض', 280, 40, 1),
(6, 1, 'TSH-NVY-L', 'L', 'كحلي', 280, 30, 1),

(7, 2, 'PNT-BEI-32', '32', 'بيج', 420, 25, 1),
(8, 2, 'PNT-BEI-34', '34', 'بيج', 420, 30, 1),
(9, 2, 'PNT-OLV-34', '34', 'زيتي', 420, 20, 1),
(10, 2, 'PNT-BLK-32', '32', 'أسود', 420, 28, 1),

(11, 3, 'TRK-NVY-L', 'L', 'كحلي', 750, 18, 1),
(12, 3, 'TRK-NVY-XL', 'XL', 'كحلي', 770, 14, 1),
(13, 3, 'TRK-GRY-L', 'L', 'رمادي غامق', 750, 22, 1),

(14, 4, 'KID-YEL-45', '4-5 سنوات', 'أصفر وبني', 320, 35, 1),
(15, 4, 'KID-BLU-67', '6-7 سنوات', 'أزرق سماوي', 320, 25, 1);

-- Insert Demo Customers
INSERT OR IGNORE INTO customers (id, name, phone) VALUES
(1, 'طارق المنشاوي', '01012345678'),
(2, 'منى عبد الرحمن', '01123456789'),
(3, 'شريف فهمي', '01234567890');

-- Insert Customer Addresses
INSERT OR IGNORE INTO customer_addresses (id, customer_id, governorate, city, address, notes) VALUES
(1, 1, 'القاهرة', 'المعادي', 'شارع النصر، برج الأمل، الدور الرابع، شقة 402', 'التسليم بعد الساعة 4 عصراً'),
(2, 2, 'الجيزة', 'الدقي', 'شارع مصدق، عمارة الأطباء، شقة 12', 'يرجى الاتصال قبل الوصول'),
(3, 3, 'الإسكندرية', 'سموحة', 'شارع فوزي معاذ، مجمع السرايا، عمارة 5', 'بجوار النادي');

-- Insert Demo Orders
INSERT OR IGNORE INTO orders (id, order_number, customer_id, status, subtotal, delivery_fee, total, customer_notes, assigned_to) VALUES
(1, 'ORD-2026-101', 1, 'PROCESSING', 560, 50, 610, 'يرجى التأكد من التغليف المحكم للملابس', 3),
(2, 'ORD-2026-102', 2, 'PENDING', 750, 50, 800, 'طلب عاجل', NULL),
(3, 'ORD-2026-103', 3, 'READY', 420, 60, 480, 'استلام شحن إسكندرية', 3);

-- Insert Order Items with Snapshots
INSERT OR IGNORE INTO order_items (id, order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, quantity, unit_price, total_price) VALUES
(1, 1, 1, 2, 'تيشيرت قطن ممشط فاخر 220 جرام', 'المقاس: L | اللون: أسود (SKU: TSH-BLK-L)', 2, 280, 560),
(2, 2, 3, 11, 'ترنج رياضي ميلتون قطن شتوي', 'المقاس: L | اللون: كحلي (SKU: TRK-NVY-L)', 1, 750, 750),
(3, 3, 2, 9, 'بنطلون جبردين مصنعي معالج', 'المقاس: 34 | اللون: زيتي (SKU: PNT-OLV-34)', 1, 420, 420);
`;
}
