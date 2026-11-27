import { describe, expect, it } from 'vitest';
import {
  buildVietQrCheckout,
  calculateMembershipQuote,
  formatCurrency,
  generateMemberId,
  generateQrMatrix,
  VIETQR_BANK,
} from '../membership';

describe('Membership Billing, VietQR & Digital Member Pass Engine', () => {
  it('computes exact monthly membership quote including initiation fee and add-ons', () => {
    const quote = calculateMembershipQuote('club', 'monthly', ['dexa_scan']);
    expect(quote.discountedMonthlyVnd).toBe(4200000);
    expect(quote.addOnsMonthlyVnd).toBe(950000);
    expect(quote.initiationFeeDueVnd).toBe(1500000);
    expect(quote.dueTodayVnd).toBe(4200000 + 950000 + 1500000);
    expect(quote.annualSavingsVnd).toBe(0);
    expect(quote.discountPct).toBe(0);
  });

  it('applies exact 20% annual discount and waives initiation fee on Annual plan', () => {
    const quote = calculateMembershipQuote('performance', 'annual', []);
    // 6,800,000 * 0.8 = 5,440,000/mo
    expect(quote.discountedMonthlyVnd).toBe(5440000);
    expect(quote.initiationFeeDueVnd).toBe(0);
    expect(quote.dueTodayVnd).toBe(5440000 * 12);
    expect(quote.discountPct).toBe(20);
    // Savings = (6,800,000 - 5,440,000) * 12 + 2,000,000 initiation = 18,320,000
    expect(quote.annualSavingsVnd).toBe(18320000);
  });

  it('does not double-charge add-ons already included in upper tiers', () => {
    const perfWithCryo = calculateMembershipQuote('performance', 'monthly', [
      'unlimited_cryo',
    ]);
    expect(perfWithCryo.addOnsMonthlyVnd).toBe(0);

    const blackWithBoth = calculateMembershipQuote('black', 'monthly', [
      'unlimited_cryo',
      'dexa_scan',
    ]);
    expect(blackWithBoth.addOnsMonthlyVnd).toBe(0);

    const clubWithCryo = calculateMembershipQuote('club', 'monthly', [
      'unlimited_cryo',
    ]);
    expect(clubWithCryo.addOnsMonthlyVnd).toBe(1200000);
  });

  it('formats currency accurately in both VND and USD', () => {
    expect(formatCurrency(6800000, 'USD')).toBe('$272');
    expect(formatCurrency(12500000, 'USD')).toBe('$500');
    expect(formatCurrency(6800000, 'VND')).toContain('₫');
    expect(formatCurrency(6800000, 'VND')).toMatch(/6[.,]800[.,]000/);
  });

  it('generates real Techcombank VietQR checkout URL with exact bank coordinates', () => {
    const quote = calculateMembershipQuote('performance', 'annual', []);
    const qr = buildVietQrCheckout(quote, 'Nguyen Minh Anh');

    expect(qr.bankBin).toBe('970407');
    expect(qr.bankName).toBe('Techcombank');
    expect(qr.accountNumber).toBe('19077742964012');
    expect(qr.accountName).toBe('TRUONG VAN TINH');
    expect(qr.amountVnd).toBe(quote.dueTodayVnd);
    expect(qr.qrImageUrl).toContain(
      `https://img.vietqr.io/image/${VIETQR_BANK.bankBin}-${VIETQR_BANK.accountNumber}-compact2.png`
    );
    expect(qr.qrImageUrl).toContain(`amount=${quote.dueTodayVnd}`);
    expect(qr.qrImageUrl).toContain('TRUONG%20VAN%20TINH');
  });

  it('generates deterministic, tier-prefixed Digital Member IDs', () => {
    const id1 = generateMemberId('Truong Van Tinh', 'black');
    const id2 = generateMemberId('truong van tinh', 'black');
    const idPerf = generateMemberId('Truong Van Tinh', 'performance');

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^VGD-BLK-\d{4}$/);
    expect(idPerf).toMatch(/^VGD-PRF-\d{4}$/);
  });

  it('builds a valid deterministic 21x21 SVG QR matrix with all 3 finder patterns intact', () => {
    const m1 = generateQrMatrix('VGD-PRF-4821|PERFORMANCE');
    const m2 = generateQrMatrix('VGD-PRF-4821|PERFORMANCE');
    const mOther = generateQrMatrix('VGD-BLK-9910|BLACK');

    expect(m1).toHaveLength(21);
    expect(m1[0]).toHaveLength(21);
    expect(m1).toEqual(m2);
    expect(m1).not.toEqual(mOther);

    // Top-left finder corners and center dot
    expect(m1[0][0]).toBe(true);
    expect(m1[3][3]).toBe(true);
    expect(m1[1][1]).toBe(false);
    // Top-right finder
    expect(m1[0][20]).toBe(true);
    expect(m1[3][17]).toBe(true);
    // Bottom-left finder
    expect(m1[20][0]).toBe(true);
    expect(m1[17][3]).toBe(true);
  });

  it('deduplicates repeated add-on selections cleanly', () => {
    const single = calculateMembershipQuote('club', 'monthly', ['pt_pack_4']);
    const duped = calculateMembershipQuote('club', 'monthly', [
      'pt_pack_4',
      'pt_pack_4',
    ]);
    expect(duped.dueTodayVnd).toBe(single.dueTodayVnd);
  });
});
