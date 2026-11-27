export type MembershipTierId = 'club' | 'performance' | 'black';
export type BillingCycle = 'monthly' | 'annual';
export type CurrencyCode = 'VND' | 'USD';
export type AddOnId = 'dexa_scan' | 'unlimited_cryo' | 'pt_pack_4';

export interface MembershipTier {
  id: MembershipTierId;
  nameEn: string;
  nameVi: string;
  taglineEn: string;
  taglineVi: string;
  monthlyPriceVnd: number;
  initiationFeeVnd: number;
  featured?: boolean;
  badgeEn?: string;
  badgeVi?: string;
  featuresEn: string[];
  featuresVi: string[];
}

export interface MembershipAddOn {
  id: AddOnId;
  nameEn: string;
  nameVi: string;
  descEn: string;
  descVi: string;
  monthlyPriceVnd: number;
}

export interface MembershipQuote {
  tier: MembershipTier;
  billingCycle: BillingCycle;
  monthlyBaseVnd: number;
  discountedMonthlyVnd: number;
  addOnsMonthlyVnd: number;
  effectiveMonthlyTotalVnd: number;
  initiationFeeDueVnd: number;
  dueTodayVnd: number;
  annualSavingsVnd: number;
  discountPct: number;
}

export interface VietQrPayload {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  transferContent: string;
  qrImageUrl: string;
  memberId: string;
  validThrough: string;
}

export const VND_PER_USD = 25000;
export const ANNUAL_DISCOUNT_RATE = 0.2;

export const VIETQR_BANK = {
  bankBin: '970407',
  bankName: 'Techcombank',
  accountNumber: '19077742964012',
  accountName: 'TRUONG VAN TINH',
} as const;

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'club',
    nameEn: 'Club Access',
    nameVi: 'Hội Viên Club Access',
    taglineEn: 'Flagship floor training & core studio classes',
    taglineVi: 'Toàn bộ sàn tập chuẩn flagship & lớp studio tiêu chuẩn',
    monthlyPriceVnd: 4200000,
    initiationFeeVnd: 1500000,
    featuresEn: [
      'Unlimited Iron Vault & Turf Lab floor access (05:30 – 22:30)',
      '8 Group Studio credits / month (HIIT Lab & Strength)',
      'InBody 970 monthly segmental body composition scan',
      'Eucalyptus steam room, chilled towels & locker valet',
    ],
    featuresVi: [
      'Không giới hạn sàn tập Iron Vault & Turf Lab (05:30 – 22:30)',
      '8 lượt lớp nhóm / tháng (HIIT Lab & Sức Mạnh)',
      'Đo thành phần cơ thể chuyên sâu InBody 970 hàng tháng',
      'Phòng xông bạch đàn, khăn lạnh & tủ đồ cao cấp',
    ],
  },
  {
    id: 'performance',
    nameEn: 'Performance All-Access',
    nameVi: 'Performance Toàn Diện',
    taglineEn: 'Unlimited Pilates, Contrast Cryo & Metabolic Lab',
    taglineVi: 'Không giới hạn Pilates, Ngâm Lạnh Cryo & Phòng Lab Chuyển Hóa',
    monthlyPriceVnd: 6800000,
    initiationFeeVnd: 2000000,
    featured: true,
    badgeEn: 'MOST SELECTED',
    badgeVi: 'PHỔ BIẾN NHẤT',
    featuresEn: [
      'Dual-Club Access: District 1 Flagship & Thao Dien Sanctuary',
      'Unlimited Reformer Pilates, HIIT Lab & Strength sessions',
      'Unlimited Basalt Cold Plunge (4.8°C) & Infrared Sauna',
      'Quarterly VO2 Max + Metabolic Blueprint recalibration',
      '2 Guest VIP passes per month + priority waitlist lock',
    ],
    featuresVi: [
      'Tập tại cả 2 CLB: Quận 1 Flagship & Thảo Điền Sanctuary',
      'Không giới hạn Reformer Pilates, HIIT Lab & Thanh Đòn',
      'Không giới hạn Bể Ngâm Lạnh 4.8°C & Xông Hồng Ngoại',
      'Đo VO2 Max & hiệu chỉnh phác đồ chuyển hóa mỗi quý',
      '2 vé khách VIP mỗi tháng & ưu tiên xếp lớp tự động',
    ],
  },
  {
    id: 'black',
    nameEn: 'Black Concierge + PT',
    nameVi: 'Black Concierge + PT 1-1',
    taglineEn: 'Dedicated bio-performance coach & private recovery suite',
    taglineVi: 'Huấn luyện viên riêng, đo DEXA & phòng phục hồi riêng tư',
    monthlyPriceVnd: 12500000,
    initiationFeeVnd: 0,
    badgeEn: 'PRIVATE TIER',
    badgeVi: 'ĐẶC QUYỀN',
    featuresEn: [
      'Everything in Performance All-Access with 0 VNĐ initiation',
      '8× Dedicated 1-on-1 Personal Trainer sessions every month',
      'Quarterly DEXA Scan + RMR Metabolic Breath Analysis',
      'Private laundry service, reserved gear locker & valet parking',
      'Direct coach WhatsApp/Zalo nutrition & HRV telemetry review',
    ],
    featuresVi: [
      'Toàn bộ đặc quyền Performance — miễn phí gia nhập 0 VNĐ',
      '8 buổi huấn luyện 1-kèm-1 cùng Chuyên gia mỗi tháng',
      'Đo DEXA & phân tích hơi thở RMR định kỳ mỗi quý',
      'Giặt ủi đồ tập riêng, tủ đồ cố định & đỗ xe Valet',
      'Chuyên gia theo dõi dinh dưỡng & chỉ số HRV trực tiếp',
    ],
  },
];

export const MEMBERSHIP_ADDONS: MembershipAddOn[] = [
  {
    id: 'dexa_scan',
    nameEn: 'DEXA + RMR Lab Pack',
    nameVi: 'Gói Đo DEXA & RMR',
    descEn: 'Bone density, visceral fat & exact resting metabolic breath test',
    descVi: 'Đo mật độ xương, mỡ nội tạng & trao đổi chất qua hơi thở',
    monthlyPriceVnd: 950000,
  },
  {
    id: 'unlimited_cryo',
    nameEn: 'Unlimited Cryo + Sauna',
    nameVi: 'Không Giới Hạn Cryo & Sauna',
    descEn: 'Daily 4.8°C cold immersion + cedar infrared contrast circuit',
    descVi: 'Ngâm lạnh 4.8°C & xông hồng ngoại không giới hạn mỗi ngày',
    monthlyPriceVnd: 1200000,
  },
  {
    id: 'pt_pack_4',
    nameEn: '4× Monthly 1-on-1 PT',
    nameVi: 'Gói 4 Buổi PT 1-Kèm-1',
    descEn: 'Dedicated weekly coaching with your matched Vanguard specialist',
    descVi: 'Huấn luyện 1-kèm-1 hàng tuần với chuyên gia phù hợp nhất',
    monthlyPriceVnd: 3600000,
  },
];

export function calculateMembershipQuote(
  tierId: MembershipTierId,
  billingCycle: BillingCycle,
  selectedAddOns: AddOnId[] = []
): MembershipQuote {
  const tier =
    MEMBERSHIP_TIERS.find((t) => t.id === tierId) ?? MEMBERSHIP_TIERS[1];
  const isAnnual = billingCycle === 'annual';
  const discountMultiplier = isAnnual ? 1 - ANNUAL_DISCOUNT_RATE : 1;

  const discountedMonthlyVnd = Math.round(tier.monthlyPriceVnd * discountMultiplier);

  // Deduplicate add-ons and ignore redundant included add-ons on upper tiers
  const uniqueAddOns = Array.from(new Set(selectedAddOns));
  const addOnsMonthlyVnd = uniqueAddOns.reduce((sum, id) => {
    const addon = MEMBERSHIP_ADDONS.find((a) => a.id === id);
    if (!addon) return sum;
    if (id === 'unlimited_cryo' && (tierId === 'performance' || tierId === 'black')) {
      return sum;
    }
    if (id === 'dexa_scan' && tierId === 'black') {
      return sum;
    }
    return sum + addon.monthlyPriceVnd;
  }, 0);

  const effectiveMonthlyTotalVnd = discountedMonthlyVnd + addOnsMonthlyVnd;
  const initiationFeeDueVnd = isAnnual ? 0 : tier.initiationFeeVnd;
  const dueTodayVnd = isAnnual
    ? effectiveMonthlyTotalVnd * 12
    : effectiveMonthlyTotalVnd + initiationFeeDueVnd;

  const annualSavingsVnd = isAnnual
    ? (tier.monthlyPriceVnd - discountedMonthlyVnd) * 12 + tier.initiationFeeVnd
    : 0;

  return {
    tier,
    billingCycle,
    monthlyBaseVnd: tier.monthlyPriceVnd,
    discountedMonthlyVnd,
    addOnsMonthlyVnd,
    effectiveMonthlyTotalVnd,
    initiationFeeDueVnd,
    dueTodayVnd,
    annualSavingsVnd,
    discountPct: isAnnual ? 20 : 0,
  };
}

export function formatCurrency(
  amountVnd: number,
  currency: CurrencyCode
): string {
  if (currency === 'USD') {
    const usd = Math.round(amountVnd / VND_PER_USD);
    return `$${usd.toLocaleString('en-US')}`;
  }
  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

/**
 * Deterministic 32-bit FNV-1a hash for stable member IDs & QR matrices.
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function generateMemberId(memberName: string, tierId: MembershipTierId): string {
  const normalized = (memberName.trim() || 'VANGUARD ATHLETE').toUpperCase();
  const hash = fnv1aHash(`${normalized}|${tierId}|2026`);
  const code = String((hash % 8999) + 1000);
  const prefix = tierId === 'black' ? 'BLK' : tierId === 'performance' ? 'PRF' : 'CLB';
  return `VGD-${prefix}-${code}`;
}

export function buildVietQrCheckout(
  quote: MembershipQuote,
  memberName: string
): VietQrPayload {
  const memberId = generateMemberId(memberName, quote.tier.id);
  const tierCode = quote.tier.id.slice(0, 4).toUpperCase();
  const cycleCode = quote.billingCycle === 'annual' ? 'YR' : 'MO';
  const transferContent = `${memberId} ${tierCode} ${cycleCode}`;

  const encodedInfo = encodeURIComponent(transferContent);
  const encodedName = encodeURIComponent(VIETQR_BANK.accountName);
  const qrImageUrl = `https://img.vietqr.io/image/${VIETQR_BANK.bankBin}-${VIETQR_BANK.accountNumber}-compact2.png?amount=${quote.dueTodayVnd}&addInfo=${encodedInfo}&accountName=${encodedName}`;

  const validDate = new Date();
  validDate.setFullYear(validDate.getFullYear() + (quote.billingCycle === 'annual' ? 1 : 0));
  if (quote.billingCycle === 'monthly') {
    validDate.setMonth(validDate.getMonth() + 1);
  }
  const validThrough = `${String(validDate.getMonth() + 1).padStart(2, '0')}/${validDate.getFullYear()}`;

  return {
    bankBin: VIETQR_BANK.bankBin,
    bankName: VIETQR_BANK.bankName,
    accountNumber: VIETQR_BANK.accountNumber,
    accountName: VIETQR_BANK.accountName,
    amountVnd: quote.dueTodayVnd,
    transferContent,
    qrImageUrl,
    memberId,
    validThrough,
  };
}

/**
 * Generates a crisp deterministic 21x21 Version-1 style QR matrix with authentic
 * 7x7 finder patterns, separators, timing tracks, and hash-encoded payload modules.
 */
export function generateQrMatrix(payload: string, size: number = 21): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const placeFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          grid[rr][cc] = true;
        } else {
          grid[rr][cc] = false;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic PRNG seeded by payload
  let seed = fnv1aHash(payload || 'VANGUARD-PASS');
  const nextBit = (): boolean => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return ((seed >>> 16) & 1) === 1;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        grid[r][c] = nextBit();
      }
    }
  }

  return grid;
}
